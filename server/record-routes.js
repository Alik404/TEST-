import crypto from 'node:crypto';
import { records, findUserByEmail, logActivity, isSupabaseActive } from './database.js';
import { DataError } from './persistence.js';
import { hashPassword, verifyPassword, issueToken, publicUser, USER_ROLES, requireAuth, requireEditor, requireSuperAdmin, parseUpload } from './auth.js';
import { saveDailyAttachment, shapeDailyMessages } from './attachments.js';

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const missing = () => new DataError(404, 'السجل غير موجود. حدّث القائمة.', 'NOT_FOUND');
const invalid = (message) => new DataError(400, message, 'INVALID_INPUT');
const requireFields = (body, fields) => {
  if (fields.some(key => typeof body[key] !== 'string' || !body[key].trim())) {
    throw invalid('أكمل الحقول المطلوبة قبل الحفظ.');
  }
};
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const jsonObject = (value) => {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { throw invalid('بيانات النموذج غير صحيحة.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('بيانات النموذج غير صحيحة.');
  return value;
};

export const handleRecord = (action) => async (req, res) => {
  try {
    await action(req, res);
  } catch (error) {
    console.error(`Request failed (${req.method} ${req.path}):`, error.message);
    const conflict = error.code === 'SQLITE_CONSTRAINT';
    res.status(error.status || (conflict ? 409 : 500)).json({
      error: error.status ? error.message : conflict ? 'السجل موجود أو يتعارض مع بيانات أخرى.' : 'تعذّر إكمال العملية. حدّث السجل للتحقق قبل إعادة المحاولة.',
      code: error.code || 'SAVE_FAILED',
    });
  }
};

const materialBody = (input) => {
  requireFields(input, ['date', 'day', 'prepared_by']);
  const images = input.site_images ?? [];
  if (!Array.isArray(images) || images.length > 6) throw invalid('الحد الأقصى ست صور لكل تقرير.');
  for (const image of images) {
    try {
      const upload = parseUpload(image);
      if (upload.kind !== 'image' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || upload.buffer.length > 2 * 1024 * 1024) {
        throw new Error('image');
      }
    } catch { throw invalid('صور التقرير يجب أن تكون JPEG أو PNG أو WebP، وبحجم لا يتجاوز 2 ميغابايت للصورة.'); }
  }
  const body = {
    date: input.date, day: input.day, prepared_by: input.prepared_by,
    start_time: input.start_time || '08:00', end_time: input.end_time || '17:00',
    notes: input.notes || '', site_images: images,
  };
  for (const key of ['basics', 'marble', 'sealants', 'bulk']) {
    body[key] = jsonObject(input[key] || {});
    body[`${key}_notes`] = input[`${key}_notes`] ?? body[key].section_notes ?? '';
  }
  return body;
};

const wageBody = (input) => {
  requireFields(input, ['work_date', 'work_item']);
  const shifts = number(input.shifts_count, -1);
  const price = number(input.shift_price, -1);
  if (shifts <= 0 || price < 0) throw invalid('أدخل عدد شفتات أكبر من صفر وسعراً غير سالب.');
  return { work_date: input.work_date, work_item: input.work_item,
    worker_name: input.worker_name || 'عمال ابو حيدر', shifts_count: shifts,
    shift_price: price, total_amount: shifts * price, notes: input.notes || '' };
};

const advanceBody = (input) => ({
  receipt_date: input.receipt_date || now().slice(0, 10),
  team_leader: input.team_leader || '', site_name: input.site_name || 'موقع الجندي المجهول',
  team_number: input.team_number || '', data: jsonObject(input.data || {}),
});

const marblexBody = (input) => {
  requireFields(input, ['zone', 'item_name']);
  const total_pieces = Math.max(0, Math.trunc(number(input.total_pieces)));
  const applied_pieces = Math.min(total_pieces, Math.max(0, Math.trunc(number(input.applied_pieces))));
  const total_steel = Math.max(0, Math.trunc(number(input.total_steel)));
  const applied_steel = Math.min(total_steel, Math.max(0, Math.trunc(number(input.applied_steel))));
  const pieces_progress = total_pieces ? +(applied_pieces / total_pieces * 100).toFixed(2) : 0;
  const steel_progress = total_steel ? +(applied_steel / total_steel * 100).toFixed(2) : 0;
  const overall_progress = +((pieces_progress + steel_progress) / 2).toFixed(2);
  const derived = overall_progress >= 100 ? 'منجز' : overall_progress === 0 ? 'غير مطبق' : 'قيد التنفيذ';
  return { zone: input.zone, item_name: input.item_name, total_pieces, applied_pieces, pieces_progress,
    total_steel, applied_steel, steel_progress, overall_progress,
    status: ['منجز', 'غير مطبق', 'قيد التنفيذ', 'متبقي'].includes(input.status) ? input.status : derived,
    notes: input.notes || '' };
};

const jointsBody = (input) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.report_date || '')) throw invalid('تاريخ الجرد مطلوب.');
  const data = jsonObject(input.data || {});
  const rows = (Array.isArray(data.rows) ? data.rows : []).slice(0, 50).map(r => ({
    type: r.type === 'vertical' ? 'vertical' : 'horizontal',
    zone: ['Zone A', 'Zone B', 'Zone C'].includes(r.zone) ? r.zone : 'Zone A',
    item: String(r.item || '').trim().slice(0, 120),
    count: Math.max(0, Math.min(1000, number(r.count))), length: Math.max(0, Math.min(1000, number(r.length))),
  })).filter(r => r.item && r.count > 0 && r.length > 0);
  if (!rows.length) throw invalid('أضف فقرة واحدة على الأقل بعدد نزلات وطول صحيحين.');
  return { report_date: input.report_date, workers_count: Math.max(0, Math.min(500, Math.trunc(number(input.workers_count)))),
    notes: String(input.notes || '').slice(0, 2000), data: { rows, sealant_rate: String(data.sealant_rate ?? '').slice(0, 20) } };
};

// Account changes are serialized in this server, including the last-director
// check. The configured deployment runs one Node process.
let accountChanges = Promise.resolve();
const changeAccount = (action) => {
  const result = accountChanges.then(action);
  accountChanges = result.catch(() => {});
  return result;
};
const accountBody = (body, creating) => {
  requireFields(body, ['email', 'name', 'role']);
  if (!USER_ROLES.has(body.role)) throw invalid('الدور المحدد غير مسموح.');
  if ((creating || body.password) && (typeof body.password !== 'string' || body.password.length < 8)) {
    throw invalid('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
  }
  return { email: body.email.trim().toLowerCase(), name: body.name.trim(), role: body.role };
};
const protectLastDirector = async (account, newRole) => {
  if (account.role !== 'super_admin' || newRole === 'super_admin') return;
  const directors = (await records.list('users')).filter(u => u.role === 'super_admin');
  if (directors.length <= 1) throw invalid('لا يمكن حذف المدير العام الوحيد أو تغيير دوره. أنشئ مديراً عاماً آخر أولاً.');
};

export function registerRecordRoutes(app) {
  app.use('/api', (req, res, next) => {
    res.setHeader('X-Storage-Mode', isSupabaseActive() ? 'cloud' : 'local');
    next();
  });
  app.post('/api/login', handleRecord(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    let record = await findUserByEmail(req.body.email.trim().toLowerCase());
    if (!record || !USER_ROLES.has(record.role)) throw new DataError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    const check = await verifyPassword(req.body.password, record.password);
    if (!check.ok) throw new DataError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    if (!record.session_version) throw new DataError(503, 'طبّق ملف supabase_urgent_fixes.sql لتحديث الجلسات.', 'SCHEMA_REQUIRED');
    if (check.needsUpgrade) {
      record = await records.update('users', record.id, {
        password: await hashPassword(req.body.password), session_version: newId(),
      });
    }
    res.json({ user: publicUser(record), token: issueToken(record) });
  }));

  app.get('/api/users', requireSuperAdmin, handleRecord(async (req, res) => {
    res.json((await records.list('users')).map(publicUser));
  }));
  app.post('/api/users', requireSuperAdmin, handleRecord(async (req, res) => {
    const row = await changeAccount(async () => {
      const body = accountBody(req.body, true);
      if (await findUserByEmail(body.email)) throw invalid('البريد الإلكتروني مستخدم بالفعل.');
      return records.insert('users', { ...body, password: await hashPassword(req.body.password), session_version: newId() });
    });
    res.status(201).json(publicUser(row));
  }));
  app.put('/api/users/:id', requireSuperAdmin, handleRecord(async (req, res) => {
    const row = await changeAccount(async () => {
      const old = await records.get('users', req.params.id);
      if (!old) throw missing();
      const body = accountBody(req.body, false);
      await protectLastDirector(old, body.role);
      const sameEmail = await findUserByEmail(body.email);
      if (sameEmail && String(sameEmail.id) !== String(old.id)) throw invalid('البريد الإلكتروني مستخدم بالفعل.');
      if (req.body.password) body.password = await hashPassword(req.body.password);
      return records.update('users', old.id, { ...body, session_version: newId() });
    });
    res.json(publicUser(row));
  }));
  app.delete('/api/users/:id', requireSuperAdmin, handleRecord(async (req, res) => {
    await changeAccount(async () => {
      const old = await records.get('users', req.params.id);
      if (!old) return;
      await protectLastDirector(old, null);
      await records.remove('users', old.id);
    });
    res.json({ success: true });
  }));

  const modules = [
    ['materials-consumption', 'materials_consumption', materialBody],
    ['workers-wages', 'workers_wages', wageBody],
    ['weekly-advance', 'weekly_advance', advanceBody],
    ['marblex', 'marblex_progress', marblexBody],
    ['joints-daily', 'joints_daily', jointsBody],
  ];
  for (const [route, table, prepare] of modules) {
    app.get(`/api/${route}`, requireAuth, handleRecord(async (req, res) => {
      let rows = await records.list(table);
      if (table === 'marblex_progress') {
        rows = rows.filter(r => (!req.query.zone || r.zone === req.query.zone) && (!req.query.status || r.status === req.query.status));
        rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      } else {
        const date = { materials_consumption: 'date', workers_wages: 'work_date', weekly_advance: 'receipt_date', joints_daily: 'report_date' }[table];
        rows.sort((a, b) => String(b[date]).localeCompare(String(a[date])) || String(b.created_at).localeCompare(String(a.created_at)));
      }
      res.json(rows);
    }));
    app.post(`/api/${route}`, requireEditor, handleRecord(async (req, res) => {
      const body = prepare(req.body);
      if (table === 'marblex_progress') body.updated_by = req.user.name;
      const saved = await records.insert(table, {
        ...body, ...(table === 'workers_wages' && isSupabaseActive() ? {} : { id: newId() }), created_at: now(),
      });
      if (['marblex_progress', 'joints_daily'].includes(table)) await logActivity(`قام (${req.user.name}) بإضافة سجل ${route} (${saved.id}).`);
      res.status(201).json(saved);
    }));
    app.put(`/api/${route}/:id`, requireEditor, handleRecord(async (req, res) => {
      const old = await records.get(table, req.params.id);
      if (!old) throw missing();
      const input = { ...old, ...req.body };
      // An omitted status means automatic calculation, including edits that
      // switch the UI back from a manually selected state to automatic.
      if (table === 'marblex_progress') input.status = req.body.status;
      const body = prepare(input);
      if (table !== 'workers_wages') body.updated_at = now();
      if (table === 'marblex_progress') body.updated_by = req.user.name;
      const saved = await records.update(table, req.params.id, body);
      if (table === 'marblex_progress') await logActivity(`قام (${req.user.name}) بتحديث الماربلكس (${saved.item_name}).`);
      res.json(saved);
    }));
    app.delete(`/api/${route}/:id`, requireEditor, handleRecord(async (req, res) => {
      await records.remove(table, req.params.id);
      res.json({ success: true, id: req.params.id });
    }));
  }

  app.get('/api/weekly-advance/:id', requireAuth, handleRecord(async (req, res) => {
    const row = await records.get('weekly_advance', req.params.id);
    if (!row) throw missing();
    res.json(row);
  }));

  app.get('/api/daily-updates', requireAuth, handleRecord(async (req, res) => {
    const rows = await records.list('daily_updates');
    rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    res.json(await shapeDailyMessages(rows));
  }));
  app.post('/api/daily-updates', requireAuth, handleRecord(async (req, res) => {
    if (!String(req.body.message_text || '').trim() && !req.body.media_data) throw invalid('محتوى الرسالة أو المرفق مطلوب.');
    const attachment = req.body.media_data ? await saveDailyAttachment(req.body.media_data) : { media_url: null, media_type: null };
    // Exactly one primary insert. Return that row, never a different local ID.
    const saved = await records.insert('daily_updates', {
      user_id: req.user.id, sender_name: req.user.name, sender_role: req.user.role,
      message_text: String(req.body.message_text || ''), reply_to_id: req.body.reply_to_id || null,
      ...attachment, created_at: now(),
    });
    // Signing is secondary to the committed insert; failure must not invite a
    // second submission. The next message refresh retries signed URLs.
    let shaped = { ...saved, media_url: attachment.media_url?.startsWith('storage:') ? null : attachment.media_url };
    try {
      const reply = saved.reply_to_id ? await records.get('daily_updates', saved.reply_to_id) : null;
      const messages = await shapeDailyMessages(reply ? [reply, saved] : [saved]);
      shaped = messages.at(-1);
    } catch (error) { console.error('Attachment link unavailable after save:', error.message); }
    res.status(201).json(shaped);
  }));

  app.post('/api/tasks/:id/progress', requireEditor, handleRecord(async (req, res) => {
    const task = await records.get('tasks', req.params.id);
    if (!task) throw missing();
    let completed = task.completed_quantity;
    let progress = task.progress_percent;
    if (task.total_quantity > 0 && req.body.completed_quantity !== undefined) {
      completed = Math.min(task.total_quantity, Math.max(0, number(req.body.completed_quantity)));
      progress = +(completed / task.total_quantity * 100).toFixed(2);
    } else if (req.body.progress_percent !== undefined) {
      progress = Math.min(100, Math.max(0, number(req.body.progress_percent)));
      if (task.total_quantity > 0) completed = +(task.total_quantity * progress / 100).toFixed(2);
    }
    const patch = { progress_percent: progress, completed_quantity: completed };
    if (req.body.notes !== undefined) patch.notes = req.body.notes;
    const saved = await records.update('tasks', task.id, patch);
    await logActivity(`قام (${req.user.name}) بتحديث تقدم فقرة "${task.name}" إلى ${progress}%.`);
    res.json({ ...saved, success: true });
  }));
  app.post('/api/tasks/:id/notes', requireEditor, handleRecord(async (req, res) => {
    const saved = await records.update('tasks', req.params.id, { notes: String(req.body.notes || '') });
    res.json({ id: saved.id, notes: saved.notes, success: true });
  }));
  for (const action of ['toggle', 'details']) {
    app.post(`/api/nazalat/:id/${action}`, requireEditor, handleRecord(async (req, res) => {
      const old = await records.get('sub_units', req.params.id);
      if (!old) throw missing();
      const status = action === 'toggle' ? (old.status === 'منجز' ? 'متبقي' : 'منجز') : (req.body.status || old.status);
      if (!['منجز', 'متبقي'].includes(status)) throw invalid('حالة النزلة غير صحيحة.');
      const patch = { status, notes: status === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل' };
      if (action === 'details') {
        for (const color of ['white', 'brown']) {
          for (const suffix of ['marked', 'extra', 'applied']) {
            const key = `${color}_${suffix}`;
            patch[key] = Math.max(0, number(req.body[key] ?? old[key]));
          }
          patch[`${color}_date`] = req.body[`${color}_date`] ?? old[`${color}_date`] ?? '';
        }
      }
      const saved = await records.update('sub_units', old.id, patch);
      // Dashboard derives automatic progress from sub_units. Keep the task cache
      // in sync, but never report the committed field update as failed.
      if (old.task_id) {
        try {
          const units = (await records.list('sub_units')).filter(u => u.task_id === old.task_id);
          const done = units.filter(u => u.status === 'منجز').length;
          await records.update('tasks', old.task_id, { completed_quantity: done, progress_percent: units.length ? +(done / units.length * 100).toFixed(2) : 0 });
        } catch (error) { console.error('Task aggregate refresh failed:', error.message); }
      }
      await logActivity(`قام (${req.user.name}) بتحديث النزلة ${old.code} (${old.zone}) إلى ${status}.`);
      res.json({ ...saved, newStatus: status, success: true });
    }));
  }
  app.post('/api/marble/:id/status', requireEditor, handleRecord(async (req, res) => {
    const saved = await records.update('marble_distribution', req.params.id, {
      status: req.body.status,
      white_qty: req.body.white_qty == null ? null : Math.max(0, Math.trunc(number(req.body.white_qty))),
      brown_qty: req.body.brown_qty == null ? null : Math.max(0, Math.trunc(number(req.body.brown_qty))),
    });
    await logActivity(`قام (${req.user.name}) بتحديث موقف مرمر "${saved.task_name}" (${saved.zone}).`);
    res.json({ ...saved, success: true });
  }));
}
