import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, override: true });
dotenv.config({ override: true });

import { 
  dbAll, dbGet, dbRun, 
  sqliteAll, sqliteGet, sqliteRun, 
  supabase, isSupabaseActive, 
  getJsonFallback, saveJsonFallback 
} from './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsDir));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health Check Endpoint ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database_mode: isSupabaseActive() ? 'supabase_cloud' : 'sqlite_local',
    uptime_seconds: Math.floor(process.uptime()),
    version: '2.0.0'
  });
});

// ── 1. Authentication Endpoint ──────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبة.' });
  }

  try {
    let user = null;
    if (isSupabaseActive()) {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, email, name, role')
          .eq('email', email.trim().toLowerCase())
          .eq('password', password)
          .maybeSingle();
        user = data;
      } catch (err) {
        console.warn('Supabase login query fallback:', err.message);
      }
    }

    if (!user) {
      user = await sqliteGet(
        'SELECT id, email, name, role FROM users WHERE LOWER(email) = LOWER(?) AND password = ?',
        [email.trim(), password]
      );
    }

    if (user) {
      res.json({ user });
    } else {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم أثناء تسجيل الدخول.' });
  }
});

// ── 2. Fetch Dashboard Data (KPIs + Progress Table) ─────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY id ASC');
    const tasks = await dbAll(`
      SELECT t.*, c.name as category_name 
      FROM tasks t 
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.id ASC
    `);

    // Dynamic KPIs from sub_units
    const nazalatStats = await dbAll(`
      SELECT zone, status, COUNT(*) as count 
      FROM sub_units 
      GROUP BY zone, status
    `);

    let completedA = 0, completedB = 0, completedC = 0;
    nazalatStats.forEach(stat => {
      if (stat.zone === 'Zone A' && stat.status === 'منجز') completedA = stat.count;
      if (stat.zone === 'Zone B' && stat.status === 'منجز') completedB = stat.count;
      if (stat.zone === 'Zone C' && stat.status === 'منجز') completedC = stat.count;
    });

    const totalCompletedNazalat = completedA + completedB + completedC;
    const totalNazalat = 113;
    const nazalatProgressPercent = totalNazalat > 0 ? (totalCompletedNazalat / totalNazalat) * 100 : 0;

    // Marble pieces sum from sub_units and marble_distribution
    const marbleRows = await dbAll('SELECT * FROM marble_distribution');
    let computedAppliedWhite = 0;
    let computedAppliedBrown = 0;

    marbleRows.forEach(item => {
      computedAppliedWhite += (item.white_qty || 0);
      computedAppliedBrown += (item.brown_qty || 0);
    });

    const totalAppliedMarble = computedAppliedWhite + computedAppliedBrown;

    // Overall Progress Calculation
    let sumProgress = 0;
    tasks.forEach(t => {
      if (t.name === 'تطبيك النزلات (محدث تلقائياً)' && t.is_manual === 0) {
        t.progress_percent = parseFloat(nazalatProgressPercent.toFixed(2));
        t.completed_quantity = totalCompletedNazalat;
      }
      sumProgress += (Number(t.progress_percent) || 0);
    });
    const overallProgress = tasks.length > 0 ? (sumProgress / tasks.length) : 0;

    res.json({
      categories,
      tasks,
      kpis: {
        total_marble_pieces: totalAppliedMarble > 0 ? totalAppliedMarble : 10830,
        applied_marble_pieces: totalAppliedMarble,
        applied_white_marble: Math.round(computedAppliedWhite),
        applied_brown_marble: Math.round(computedAppliedBrown),
        overall_progress_percent: parseFloat(overallProgress.toFixed(2)),
        skylight_progress_percent: 100.0,
        nazalat_total: totalNazalat,
        nazalat_completed: totalCompletedNazalat,
        nazalat_progress_percent: parseFloat(nazalatProgressPercent.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Fetch dashboard error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم.' });
  }
});

// ── 3. Sub-Units (Nazalat Tracking) Endpoints ───────────────────────────────
app.get('/api/nazalat', async (req, res) => {
  const { zone, status } = req.query;

  let query = 'SELECT * FROM sub_units';
  const params = [];
  const conditions = [];

  if (zone) {
    conditions.push('zone = ?');
    params.push(zone);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY serial_number ASC';

  try {
    const rows = await dbAll(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch nazalat error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجلات النزلات.' });
  }
});

// Toggle status of a Nazala
app.post('/api/nazalat/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { userName, userRole } = req.body;

  try {
    const item = await dbGet('SELECT status, task_id, code, zone FROM sub_units WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'النزلة المطلوبة غير موجودة.' });
    }

    const newStatus = item.status === 'منجز' ? 'متبقي' : 'منجز';
    const notes = newStatus === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل';

    await dbRun('UPDATE sub_units SET status = ?, notes = ? WHERE id = ?', [newStatus, notes, id]);

    if (item.task_id) {
      const totalRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ?', [item.task_id]);
      const doneRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ? AND status = ?', [item.task_id, 'منجز']);
      const total = totalRow?.count || 1;
      const completed = doneRow?.count || 0;
      const progress = parseFloat(((completed / total) * 100).toFixed(2));

      await dbRun(
        'UPDATE tasks SET completed_quantity = ?, progress_percent = ? WHERE id = ?',
        [completed, progress, item.task_id]
      );
    }

    if (userName) {
      const actionText = `قام (${userName}) بتحديث حالة النزلة ${item.code} في ${item.zone} إلى: ${newStatus === 'منجز' ? 'منجزة (مكتملة)' : 'متبقية'}`;
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({ success: true, id, newStatus });
  } catch (error) {
    console.error('Toggle nazala status error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث حالة النزلة.' });
  }
});

// Update details of a Nazala
app.post('/api/nazalat/:id/details', async (req, res) => {
  const { id } = req.params;
  const { 
    userName, 
    userRole,
    white_marked,
    white_extra,
    white_applied,
    white_date,
    brown_marked,
    brown_extra,
    brown_applied,
    brown_date,
    status
  } = req.body;

  try {
    const item = await dbGet('SELECT status, task_id, code, zone FROM sub_units WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'النزلة المطلوبة غير موجودة.' });
    }

    const newStatus = status || item.status;
    const notes = newStatus === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل';

    await dbRun(
      `UPDATE sub_units SET 
        white_marked = ?, white_extra = ?, white_applied = ?, white_date = ?, 
        brown_marked = ?, brown_extra = ?, brown_applied = ?, brown_date = ?, 
        status = ?, notes = ? 
       WHERE id = ?`, 
      [
        Number(white_marked) || 0,
        Number(white_extra) || 0,
        Number(white_applied) || 0,
        white_date || '',
        Number(brown_marked) || 0,
        Number(brown_extra) || 0,
        Number(brown_applied) || 0,
        brown_date || '',
        newStatus, 
        notes, 
        id
      ]
    );

    if (userName) {
      const actionText = `قام (${userName}) بتحديث تفاصيل النزلة ${item.code} (${item.zone}) - الأبيض المطبق: ${white_applied || 0}، الجوزي المطبق: ${brown_applied || 0}، الحالة: ${newStatus}`;
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({ success: true, id, status: newStatus });
  } catch (error) {
    console.error('Update nazala details error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث تفاصيل النزلة.' });
  }
});

// ── 4. Task Progress & Notes Endpoints ──────────────────────────────────────
app.post('/api/tasks/:id/progress', async (req, res) => {
  const { id } = req.params;
  const { completed_quantity, progress_percent, notes, userName, userRole } = req.body;

  try {
    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'الفقرة المطلوبة غير موجودة.' });
    }

    let progress = task.progress_percent;
    let completed = task.completed_quantity;

    if (task.total_quantity !== null && task.total_quantity > 0) {
      if (completed_quantity !== undefined) {
        completed = Math.min(Math.max(0, parseFloat(completed_quantity) || 0), task.total_quantity);
        progress = parseFloat(((completed / task.total_quantity) * 100).toFixed(2));
      } else if (progress_percent !== undefined) {
        progress = Math.min(Math.max(0, parseFloat(progress_percent) || 0), 100);
        completed = parseFloat((task.total_quantity * (progress / 100)).toFixed(2));
      }
    } else {
      if (progress_percent !== undefined) {
        progress = Math.min(Math.max(0, parseFloat(progress_percent) || 0), 100);
      }
    }

    const taskUpdates = { progress_percent: progress, completed_quantity: completed };
    if (notes !== undefined) taskUpdates.notes = notes;

    if (isSupabaseActive()) {
      try {
        await supabase.from('tasks').update(taskUpdates).eq('id', id);
      } catch (e) {
        console.warn('Supabase tasks update warning:', e.message);
      }
    }

    let query = 'UPDATE tasks SET progress_percent = ?, completed_quantity = ?';
    const params = [progress, completed];

    if (notes !== undefined) {
      query += ', notes = ?';
      params.push(notes);
    }
    query += ' WHERE id = ?';
    params.push(id);

    await dbRun(query, params);

    if (userName) {
      const actionText = `قام (${userName}) بتحديث تقدم فقرة "${task.name}" إلى ${progress}%` + (notes ? ` (ملاحظات: ${notes})` : '');
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({ success: true, id, progress_percent: progress, completed_quantity: completed, notes });
  } catch (error) {
    console.error('Update task progress error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الفقرة.' });
  }
});

app.post('/api/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    if (isSupabaseActive()) {
      try {
        await supabase.from('tasks').update({ notes }).eq('id', id);
      } catch (e) {
        console.warn('Supabase task notes update warning:', e.message);
      }
    }
    await dbRun('UPDATE tasks SET notes = ? WHERE id = ?', [notes, id]);
    res.json({ success: true, id, notes });
  } catch (error) {
    console.error('Update task notes error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الملاحظات.' });
  }
});

// ── 5. Marble Distribution Endpoints ────────────────────────────────────────
app.get('/api/marble', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM marble_distribution ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Fetch marble error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب توزيع المرمر.' });
  }
});

app.post('/api/marble/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, white_qty, brown_qty, userName } = req.body;

  try {
    const whiteVal = white_qty === undefined || white_qty === null ? null : parseInt(white_qty, 10);
    const brownVal = brown_qty === undefined || brown_qty === null ? null : parseInt(brown_qty, 10);

    await dbRun(
      'UPDATE marble_distribution SET status = ?, white_qty = ?, brown_qty = ? WHERE id = ?',
      [status, whiteVal, brownVal, id]
    );

    if (userName) {
      const item = await dbGet('SELECT * FROM marble_distribution WHERE id = ?', [id]);
      if (item) {
        const actionText = `قام (${userName}) بتحديث موقف مرمر "${item.task_name}" (${item.zone}) - الأبيض: ${whiteVal ?? '-'}، الجوزي: ${brownVal ?? '-'} | الحالة: "${status}"`;
        await dbRun(
          `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
           VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
          ['النظام', 'system', actionText]
        );
      }
    }

    res.json({ success: true, id, status, white_qty: whiteVal, brown_qty: brownVal });
  } catch (error) {
    console.error('Update marble error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث موقف المرمر.' });
  }
});

// ── 6. Daily Updates / Chat API Endpoints ───────────────────────────────────
app.get('/api/daily-updates', async (req, res) => {
  try {
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabase
          .from('daily_updates')
          .select('*')
          .order('created_at', { ascending: true });
        if (data && !error && data.length > 0) {
          return res.json(data);
        }
      } catch (e) {
        console.warn('Supabase daily-updates query fallback:', e.message);
      }
    }

    const rows = await sqliteAll(`
      SELECT d.*, u.name as user_name, u.role as user_role,
             r.sender_name as reply_sender_name, r.message_text as reply_message_text, r.media_url as reply_media_url, r.media_type as reply_media_type
      FROM daily_updates d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN daily_updates r ON d.reply_to_id = r.id
      ORDER BY d.created_at ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch daily updates error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل التحديث اليومي.' });
  }
});

app.post('/api/daily-updates', async (req, res) => {
  const { user_id, sender_name, sender_role, message_text, media_data, media_name, reply_to_id } = req.body;

  if (!message_text && !media_data) {
    return res.status(400).json({ error: 'محتوى الرسالة أو المرفق مطلوب.' });
  }

  try {
    let media_url = null;
    let media_type = null;

    if (media_data) {
      let buffer;
      let extension = 'bin';

      const parts = media_data.split(';base64,');
      if (parts.length === 2) {
        const mimeType = parts[0].replace('data:', '');
        buffer = Buffer.from(parts[1], 'base64');
        
        if (mimeType.includes('image')) {
          media_type = 'image';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'png';
        } else if (mimeType.includes('video')) {
          media_type = 'video';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'mp4';
        } else if (mimeType.includes('audio')) {
          media_type = 'audio';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'webm';
        }
      } else {
        buffer = Buffer.from(media_data, 'base64');
        if (media_name) {
          const ext = media_name.split('.').pop().toLowerCase();
          extension = ext;
          if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) {
            media_type = media_name.startsWith('voice_') ? 'audio' : 'video';
          } else if (['mp3', 'wav', 'm4a', 'aac', 'opus', 'caf'].includes(ext)) {
            media_type = 'audio';
          } else {
            media_type = 'image';
          }
        }
      }

      const filename = `upload_${Date.now()}_${Math.round(Math.random() * 1000)}.${extension}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
      media_url = `/api/uploads/${filename}`;
    }

    const result = await dbRun(
      `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, sender_name, sender_role, message_text || '', media_url, media_type, reply_to_id || null]
    );

    const newMessage = await sqliteGet(`
      SELECT d.*, u.name as user_name, u.role as user_role,
             r.sender_name as reply_sender_name, r.message_text as reply_message_text, r.media_url as reply_media_url, r.media_type as reply_media_type
      FROM daily_updates d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN daily_updates r ON d.reply_to_id = r.id
      WHERE d.id = ?
    `, [result.id]);

    res.json(newMessage);
  } catch (error) {
    console.error('Post daily update error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرسالة.' });
  }
});

// ── 7. Materials Consumption API Endpoints ──────────────────────────────────
app.get('/api/materials-consumption', async (req, res) => {
  try {
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabase
          .from('materials_consumption')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });
        if (data && !error && data.length > 0) {
          const parsed = data.map(r => ({
            ...r,
            basics: typeof r.basics === 'string' ? JSON.parse(r.basics || '{}') : r.basics,
            marble: typeof r.marble === 'string' ? JSON.parse(r.marble || '{}') : r.marble,
            sealants: typeof r.sealants === 'string' ? JSON.parse(r.sealants || '{}') : r.sealants,
            bulk: typeof r.bulk === 'string' ? JSON.parse(r.bulk || '{}') : r.bulk,
          }));
          return res.json(parsed);
        }
      } catch (e) {
        console.warn('Supabase materials query fallback:', e.message);
      }
    }

    const rows = await sqliteAll('SELECT * FROM materials_consumption ORDER BY date DESC, created_at DESC');
    const parsed = rows.map(r => ({
      ...r,
      basics: typeof r.basics === 'string' ? JSON.parse(r.basics || '{}') : r.basics,
      marble: typeof r.marble === 'string' ? JSON.parse(r.marble || '{}') : r.marble,
      sealants: typeof r.sealants === 'string' ? JSON.parse(r.sealants || '{}') : r.sealants,
      bulk: typeof r.bulk === 'string' ? JSON.parse(r.bulk || '{}') : r.bulk,
    }));
    res.json(parsed);
  } catch (err) {
    console.warn('SQLite materials consumption query fallback to JSON:', err.message);
    const data = getJsonFallback('materials_consumption.json', []);
    res.json(data);
  }
});

app.post('/api/materials-consumption', async (req, res) => {
  const report = req.body;
  if (!report.date || !report.day || !report.prepared_by) {
    return res.status(400).json({ error: 'الحقول الأساسية للتاريخ والمعد مطلوبة.' });
  }

  const id = report.id || Date.now().toString();
  const createdAt = new Date().toISOString();

  try {
    await sqliteRun(`
      INSERT INTO materials_consumption (id, date, day, start_time, end_time, prepared_by, basics, marble, sealants, bulk, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      report.date,
      report.day,
      report.start_time || '08:00',
      report.end_time || '17:00',
      report.prepared_by,
      JSON.stringify(report.basics || {}),
      JSON.stringify(report.marble || {}),
      JSON.stringify(report.sealants || {}),
      JSON.stringify(report.bulk || {}),
      report.notes || '',
      createdAt
    ]);

    // Save JSON fallback sync
    const jsonList = getJsonFallback('materials_consumption.json', []);
    jsonList.unshift({ ...report, id, created_at: createdAt });
    saveJsonFallback('materials_consumption.json', jsonList);

    // Sync Supabase if available
    if (isSupabaseActive()) {
      try {
        await supabase.from('materials_consumption').insert([{
          id,
          date: report.date,
          day: report.day,
          start_time: report.start_time,
          end_time: report.end_time,
          prepared_by: report.prepared_by,
          basics: report.basics,
          marble: report.marble,
          sealants: report.sealants,
          bulk: report.bulk,
          notes: report.notes,
          created_at: createdAt
        }]);
      } catch (e) {
        console.warn('Supabase consumption sync skipped:', e.message);
      }
    }

    res.status(201).json({ ...report, id, created_at: createdAt });
  } catch (err) {
    console.error('Create consumption error:', err);
    res.status(500).json({ error: 'فشل حفظ تقرير استهلاك المواد.' });
  }
});

app.put('/api/materials-consumption/:id', async (req, res) => {
  const { id } = req.params;
  const report = req.body;
  const updatedAt = new Date().toISOString();

  try {
    await sqliteRun(`
      UPDATE materials_consumption SET
        date = ?, day = ?, start_time = ?, end_time = ?, prepared_by = ?,
        basics = ?, marble = ?, sealants = ?, bulk = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      report.date,
      report.day,
      report.start_time,
      report.end_time,
      report.prepared_by,
      JSON.stringify(report.basics || {}),
      JSON.stringify(report.marble || {}),
      JSON.stringify(report.sealants || {}),
      JSON.stringify(report.bulk || {}),
      report.notes || '',
      updatedAt,
      id
    ]);

    const jsonList = getJsonFallback('materials_consumption.json', []);
    const idx = jsonList.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
      jsonList[idx] = { ...jsonList[idx], ...report, updated_at: updatedAt };
      saveJsonFallback('materials_consumption.json', jsonList);
    }

    res.json({ ...report, id, updated_at: updatedAt });
  } catch (err) {
    console.error('Update consumption error:', err);
    res.status(500).json({ error: 'فشل تحديث تقرير استهلاك المواد.' });
  }
});

app.delete('/api/materials-consumption/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sqliteRun('DELETE FROM materials_consumption WHERE id = ?', [id]);

    const jsonList = getJsonFallback('materials_consumption.json', []);
    const filtered = jsonList.filter(item => String(item.id) !== String(id));
    saveJsonFallback('materials_consumption.json', filtered);

    if (isSupabaseActive()) {
      try { await supabase.from('materials_consumption').delete().eq('id', id); } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete consumption error:', err);
    res.status(500).json({ error: 'فشل حذف تقرير الاستهلاك.' });
  }
});

// ── 8. Workers Wages API Endpoints ──────────────────────────────────────────
app.get('/api/workers-wages', async (req, res) => {
  try {
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabase
          .from('workers_wages')
          .select('*')
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false });
        if (data && !error && data.length > 0) {
          return res.json(data);
        }
      } catch (e) {
        console.warn('Supabase workers wages query fallback:', e.message);
      }
    }

    const rows = await sqliteAll('SELECT * FROM workers_wages ORDER BY work_date DESC, created_at DESC');
    res.json(rows);
  } catch (err) {
    const data = getJsonFallback('workers_wages.json', []);
    res.json(data);
  }
});

app.post('/api/workers-wages', async (req, res) => {
  const record = req.body;
  if (!record.work_date || !record.work_item) {
    return res.status(400).json({ error: 'تاريخ العمل والفقرة مطلوبة.' });
  }

  const id = record.id || Date.now().toString();
  const shiftsCount = Number(record.shifts_count) || 1;
  const shiftPrice = Number(record.shift_price) || 0;
  const totalAmount = shiftsCount * shiftPrice;
  const createdAt = new Date().toISOString();

  const newWage = {
    id,
    work_date: record.work_date,
    work_item: record.work_item,
    worker_name: record.worker_name || 'عمال ابو حيدر',
    shifts_count: shiftsCount,
    shift_price: shiftPrice,
    total_amount: totalAmount,
    notes: record.notes || '',
    created_at: createdAt
  };

  try {
    await sqliteRun(`
      INSERT INTO workers_wages (id, work_date, work_item, worker_name, shifts_count, shift_price, total_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [newWage.id, newWage.work_date, newWage.work_item, newWage.worker_name, newWage.shifts_count, newWage.shift_price, newWage.total_amount, newWage.notes, newWage.created_at]);

    const jsonList = getJsonFallback('workers_wages.json', []);
    jsonList.unshift(newWage);
    saveJsonFallback('workers_wages.json', jsonList);

    if (isSupabaseActive()) {
      try { 
        const numId = parseInt(newWage.id, 10) || Date.now();
        await supabase.from('workers_wages').insert([{
          id: numId,
          work_date: newWage.work_date,
          work_item: newWage.work_item,
          worker_name: newWage.worker_name,
          shifts_count: newWage.shifts_count,
          shift_price: newWage.shift_price,
          total_amount: newWage.total_amount,
          notes: newWage.notes || null,
          created_at: newWage.created_at
        }]); 
      } catch (e) {
        console.warn('Supabase wage insert warning:', e.message);
      }
    }

    res.status(201).json(newWage);
  } catch (err) {
    console.error('Create wage error:', err);
    res.status(500).json({ error: 'فشل إضافة سجل الأجور.' });
  }
});

app.put('/api/workers-wages/:id', async (req, res) => {
  const { id } = req.params;
  const record = req.body;
  const shiftsCount = Number(record.shifts_count) || 1;
  const shiftPrice = Number(record.shift_price) || 0;
  const totalAmount = shiftsCount * shiftPrice;

  try {
    await sqliteRun(`
      UPDATE workers_wages SET
        work_date = ?, work_item = ?, worker_name = ?, shifts_count = ?,
        shift_price = ?, total_amount = ?, notes = ?
      WHERE id = ?
    `, [record.work_date, record.work_item, record.worker_name, shiftsCount, shiftPrice, totalAmount, record.notes || '', id]);

    const jsonList = getJsonFallback('workers_wages.json', []);
    const idx = jsonList.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
      jsonList[idx] = { ...jsonList[idx], ...record, shifts_count: shiftsCount, shift_price: shiftPrice, total_amount: totalAmount };
      saveJsonFallback('workers_wages.json', jsonList);
    }

    if (isSupabaseActive()) {
      try {
        const numId = parseInt(id, 10);
        await supabase.from('workers_wages').update({
          work_date: record.work_date,
          work_item: record.work_item,
          worker_name: record.worker_name,
          shifts_count: shiftsCount,
          shift_price: shiftPrice,
          total_amount: totalAmount,
          notes: record.notes || null
        }).eq('id', numId || id);
      } catch (e) {
        console.warn('Supabase wage update warning:', e.message);
      }
    }

    res.json({ ...record, id, total_amount: totalAmount });
  } catch (err) {
    console.error('Update wage error:', err);
    res.status(500).json({ error: 'فشل تعديل سجل الأجور.' });
  }
});

app.delete('/api/workers-wages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sqliteRun('DELETE FROM workers_wages WHERE id = ?', [id]);

    const jsonList = getJsonFallback('workers_wages.json', []);
    const filtered = jsonList.filter(item => String(item.id) !== String(id));
    saveJsonFallback('workers_wages.json', filtered);

    if (isSupabaseActive()) {
      try { 
        const numId = parseInt(id, 10);
        await supabase.from('workers_wages').delete().eq('id', numId || id); 
      } catch (e) {
        console.warn('Supabase wage delete warning:', e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete wage error:', err);
    res.status(500).json({ error: 'فشل حذف سجل الأجور.' });
  }
});

// ── 9. Weekly Advance API Endpoints ─────────────────────────────────────────
app.get('/api/weekly-advance', async (req, res) => {
  try {
    const rows = await sqliteAll('SELECT * FROM weekly_advance ORDER BY receipt_date DESC, created_at DESC');
    const parsed = rows.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data
    }));
    res.json(parsed);
  } catch (err) {
    const data = getJsonFallback('weekly_advance.json', []);
    res.json(data);
  }
});

app.get('/api/weekly-advance/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const row = await sqliteGet('SELECT * FROM weekly_advance WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ error: 'السجل غير موجود.' });
    }
    row.data = typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب تفاصيل السلفة.' });
  }
});

app.post('/api/weekly-advance', async (req, res) => {
  const { receipt_date, team_leader, site_name, team_number, data: formData } = req.body;
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();

  const newRec = {
    id,
    receipt_date: receipt_date || new Date().toISOString().split('T')[0],
    team_leader: team_leader || '',
    site_name: site_name || 'موقع النصب التذكاري للجندي المجهول',
    team_number: team_number || '',
    data: formData || {},
    created_at: createdAt
  };

  try {
    await sqliteRun(`
      INSERT INTO weekly_advance (id, receipt_date, team_leader, site_name, team_number, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, newRec.receipt_date, newRec.team_leader, newRec.site_name, newRec.team_number, JSON.stringify(newRec.data), createdAt]);

    const jsonList = getJsonFallback('weekly_advance.json', []);
    jsonList.unshift(newRec);
    saveJsonFallback('weekly_advance.json', jsonList);

    if (isSupabaseActive()) {
      try {
        await supabase.from('weekly_advance').insert([{
          id,
          receipt_date: newRec.receipt_date,
          team_leader: newRec.team_leader,
          site_name: newRec.site_name,
          team_number: newRec.team_number,
          data: newRec.data
        }]);
      } catch {}
    }

    res.status(201).json(newRec);
  } catch (err) {
    console.error('Create weekly advance error:', err);
    res.status(500).json({ error: 'فشل حفظ سجل السلفة.' });
  }
});

app.put('/api/weekly-advance/:id', async (req, res) => {
  const { id } = req.params;
  const { receipt_date, team_leader, site_name, team_number, data: formData } = req.body;
  const updatedAt = new Date().toISOString();

  try {
    await sqliteRun(`
      UPDATE weekly_advance SET
        receipt_date = ?, team_leader = ?, site_name = ?, team_number = ?, data = ?, updated_at = ?
      WHERE id = ?
    `, [receipt_date, team_leader, site_name, team_number, JSON.stringify(formData || {}), updatedAt, id]);

    const jsonList = getJsonFallback('weekly_advance.json', []);
    const idx = jsonList.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
      jsonList[idx] = { ...jsonList[idx], receipt_date, team_leader, site_name, team_number, data: formData, updated_at: updatedAt };
      saveJsonFallback('weekly_advance.json', jsonList);
    }

    res.json({ id, receipt_date, team_leader, site_name, team_number, data: formData, updated_at: updatedAt });
  } catch (err) {
    console.error('Update weekly advance error:', err);
    res.status(500).json({ error: 'فشل تعديل سجل السلفة.' });
  }
});

app.delete('/api/weekly-advance/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sqliteRun('DELETE FROM weekly_advance WHERE id = ?', [id]);

    const jsonList = getJsonFallback('weekly_advance.json', []);
    const filtered = jsonList.filter(item => String(item.id) !== String(id));
    saveJsonFallback('weekly_advance.json', filtered);

    if (isSupabaseActive()) {
      try { await supabase.from('weekly_advance').delete().eq('id', id); } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete weekly advance error:', err);
    res.status(500).json({ error: 'فشل حذف سجل السلفة.' });
  }
});

// ── 9.5 Marblex Work Progress API Endpoints ────────────────────────────────
app.get('/api/marblex', async (req, res) => {
  const { zone, status } = req.query;
  try {
    let query = 'SELECT * FROM marblex_progress';
    const params = [];
    const conditions = [];

    if (zone) {
      conditions.push('zone = ?');
      params.push(zone);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at ASC';

    const rows = await dbAll(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch marblex progress error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب تقدم أعمال الماربلكس.' });
  }
});

app.post('/api/marblex', async (req, res) => {
  const { 
    zone, item_name, total_pieces, applied_pieces, 
    total_steel, applied_steel, notes, userName 
  } = req.body;

  if (!zone || !item_name) {
    return res.status(400).json({ error: 'الزون واسم المقطع مطلوبان.' });
  }

  const id = 'mbx-' + Date.now().toString();
  const totP = Math.max(0, parseInt(total_pieces, 10) || 0);
  const appP = Math.min(totP, Math.max(0, parseInt(applied_pieces, 10) || 0));
  const totS = Math.max(0, parseInt(total_steel, 10) || 0);
  const appS = Math.min(totS, Math.max(0, parseInt(applied_steel, 10) || 0));

  const pProg = totP > 0 ? parseFloat(((appP / totP) * 100).toFixed(2)) : 0;
  const sProg = totS > 0 ? parseFloat(((appS / totS) * 100).toFixed(2)) : 0;
  const oProg = parseFloat(((pProg + sProg) / 2).toFixed(2));

  let status = 'قيد التنفيذ';
  if (oProg >= 100) status = 'منجز';
  else if (oProg === 0) status = 'غير مطبق';

  const updatedBy = userName || 'المهندس المقيم';
  const createdAt = new Date().toISOString();

  const newRecord = {
    id,
    zone,
    item_name,
    total_pieces: totP,
    applied_pieces: appP,
    pieces_progress: pProg,
    total_steel: totS,
    applied_steel: appS,
    steel_progress: sProg,
    overall_progress: oProg,
    status,
    notes: notes || '',
    updated_by: updatedBy,
    created_at: createdAt
  };

  try {
    await sqliteRun(`
      INSERT INTO marblex_progress (id, zone, item_name, total_pieces, applied_pieces, pieces_progress, total_steel, applied_steel, steel_progress, overall_progress, status, notes, updated_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, zone, item_name, totP, appP, pProg, totS, appS, sProg, oProg, status, notes || '', updatedBy, createdAt]);

    const jsonList = getJsonFallback('marblex_progress.json', []);
    jsonList.push(newRecord);
    saveJsonFallback('marblex_progress.json', jsonList);

    if (isSupabaseActive()) {
      try {
        await supabase.from('marblex_progress').insert([newRecord]);
      } catch (e) {
        console.warn('Supabase marblex insert warning:', e.message);
      }
    }

    if (userName) {
      const actionText = `قام (${userName}) بإضافة مقطع ماربلكس جديد "${item_name}" في (${zone}) - نسبة الإنجاز: ${oProg}%`;
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Create marblex record error:', err);
    res.status(500).json({ error: 'فشل حفظ سجل الماربلكس.' });
  }
});

app.put('/api/marblex/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    zone, item_name, total_pieces, applied_pieces, 
    total_steel, applied_steel, status: manualStatus, notes, userName 
  } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM marblex_progress WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'السجل غير موجود.' });
    }

    const curZone = zone || existing.zone;
    const curName = item_name || existing.item_name;
    const totP = total_pieces !== undefined ? Math.max(0, parseInt(total_pieces, 10) || 0) : existing.total_pieces;
    const appP = applied_pieces !== undefined ? Math.max(0, parseInt(applied_pieces, 10) || 0) : existing.applied_pieces;
    const totS = total_steel !== undefined ? Math.max(0, parseInt(total_steel, 10) || 0) : existing.total_steel;
    const appS = applied_steel !== undefined ? Math.max(0, parseInt(applied_steel, 10) || 0) : existing.applied_steel;

    const pProg = totP > 0 ? parseFloat(((appP / totP) * 100).toFixed(2)) : 0;
    const sProg = totS > 0 ? parseFloat(((appS / totS) * 100).toFixed(2)) : 0;
    const oProg = parseFloat(((pProg + sProg) / 2).toFixed(2));

    let status = manualStatus;
    if (!status) {
      if (oProg >= 100) status = 'منجز';
      else if (oProg === 0) status = 'غير مطبق';
      else status = 'قيد التنفيذ';
    }

    const updatedBy = userName || existing.updated_by || 'المهندس المقيم';
    const updatedAt = new Date().toISOString();

    await sqliteRun(`
      UPDATE marblex_progress SET
        zone = ?, item_name = ?, total_pieces = ?, applied_pieces = ?, pieces_progress = ?,
        total_steel = ?, applied_steel = ?, steel_progress = ?, overall_progress = ?,
        status = ?, notes = ?, updated_by = ?, updated_at = ?
      WHERE id = ?
    `, [curZone, curName, totP, appP, pProg, totS, appS, sProg, oProg, status, notes !== undefined ? notes : existing.notes, updatedBy, updatedAt, id]);

    const updatedRecord = {
      ...existing,
      zone: curZone,
      item_name: curName,
      total_pieces: totP,
      applied_pieces: appP,
      pieces_progress: pProg,
      total_steel: totS,
      applied_steel: appS,
      steel_progress: sProg,
      overall_progress: oProg,
      status,
      notes: notes !== undefined ? notes : existing.notes,
      updated_by: updatedBy,
      updated_at: updatedAt
    };

    const jsonList = getJsonFallback('marblex_progress.json', []);
    const idx = jsonList.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
      jsonList[idx] = updatedRecord;
      saveJsonFallback('marblex_progress.json', jsonList);
    }

    if (isSupabaseActive()) {
      try {
        await supabase.from('marblex_progress').update({
          zone: curZone,
          item_name: curName,
          total_pieces: totP,
          applied_pieces: appP,
          pieces_progress: pProg,
          total_steel: totS,
          applied_steel: appS,
          steel_progress: sProg,
          overall_progress: oProg,
          status,
          notes: notes !== undefined ? notes : existing.notes,
          updated_by: updatedBy,
          updated_at: updatedAt
        }).eq('id', id);
      } catch (e) {
        console.warn('Supabase marblex update warning:', e.message);
      }
    }

    if (userName) {
      const actionText = `قام (${userName}) بتحديث مقطع ماربلكس "${curName}" (${curZone}) - نسبة الإنجاز: ${oProg}% | الحالة: ${status}`;
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json(updatedRecord);
  } catch (err) {
    console.error('Update marblex error:', err);
    res.status(500).json({ error: 'فشل تحديث سجل الماربلكس.' });
  }
});

app.delete('/api/marblex/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sqliteRun('DELETE FROM marblex_progress WHERE id = ?', [id]);

    const jsonList = getJsonFallback('marblex_progress.json', []);
    const filtered = jsonList.filter(item => String(item.id) !== String(id));
    saveJsonFallback('marblex_progress.json', filtered);

    if (isSupabaseActive()) {
      try {
        await supabase.from('marblex_progress').delete().eq('id', id);
      } catch {}
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('Delete marblex error:', err);
    res.status(500).json({ error: 'فشل حذف سجل الماربلكس.' });
  }
});

// ── 10. Users Management API Endpoints ──────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, name, role, password')
          .order('id', { ascending: true });
        if (data && !error && data.length > 0) {
          return res.json(data);
        }
      } catch (e) {
        console.warn('Supabase users query fallback:', e.message);
      }
    }

    const rows = await sqliteAll('SELECT id, email, name, role, password, created_at FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب قائمة المستخدمين.' });
  }
});

app.post('/api/users', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }

  try {
    const existing = await sqliteGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل.' });
    }

    const result = await sqliteRun(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [email.trim().toLowerCase(), password, name.trim(), role]
    );

    const newUser = {
      id: result.id,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      password
    };

    if (isSupabaseActive()) {
      try {
        await supabase.from('users').insert([newUser]);
      } catch (e) {
        console.warn('Supabase user insert skipped:', e.message);
      }
    }

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { email, password, name, role } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: 'البريد الإلكتروني والاسم والدور مطلوبة.' });
  }

  try {
    if (password) {
      await sqliteRun(
        'UPDATE users SET email = ?, password = ?, name = ?, role = ? WHERE id = ?',
        [email.trim().toLowerCase(), password, name.trim(), role, id]
      );
    } else {
      await sqliteRun(
        'UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?',
        [email.trim().toLowerCase(), name.trim(), role, id]
      );
    }

    if (isSupabaseActive()) {
      try {
        const updateObj = { email: email.trim().toLowerCase(), name: name.trim(), role };
        if (password) updateObj.password = password;
        await supabase.from('users').update(updateObj).eq('id', id);
      } catch {}
    }

    res.json({ id, email: email.trim().toLowerCase(), name: name.trim(), role });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الحساب.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sqliteRun('DELETE FROM users WHERE id = ?', [id]);

    if (isSupabaseActive()) {
      try { await supabase.from('users').delete().eq('id', id); } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الحساب.' });
  }
});

// ── Static Asset & SPA Serving ──────────────────────────────────────────────
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

app.get('/*any', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Server is running. Run `npm run client` or `npm run build` for the frontend.');
  }
});

app.listen(PORT, () => {
  console.log(`Engineering Management Server running at http://localhost:${PORT}`);
});
