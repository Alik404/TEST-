import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseActive, withTimeout, sqliteAll } from './database.js';
import { requireAuth, parseUpload } from './auth.js';

// ── Handover notes (ملاحظات الاستلام) ────────────────────────────────────────
// Site engineers record notes with photos per level (نزلة); the reviewer
// approves, defers or rejects them; approved notes get a permanent number
// (B37-01, deferred B37-D01) and are exported as images from the browser.
//
// With Supabase active it is the only store: notes live in its tables and
// photos in a private Storage bucket, so a server restart loses nothing. Without
// Supabase (local development) the same API runs on a JSON file and a private
// folder next to this file.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NOTE_TYPES = new Set(['joints', 'polishing', 'cleaning', 'cracks', 'other']);
const REJECT_REASONS = new Set(['duplicate', 'inaccurate', 'out_of_scope', 'resolved']);
const RECEIPT_STATUSES = new Set(['not_received', 'with_notes', 'received']);
const DEFAULT_LEVELS = Array.from({ length: 37 }, (_, i) => `B${37 - i}`);
const LEVEL_RE = /^[A-Z0-9][A-Z0-9-]{0,11}$/;
const PHOTO_PATH_RE = /^notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}(_t)?\.jpg$/;

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const BUCKET = 'handover-photos';
const URL_TTL_SECONDS = 6 * 60 * 60;
const SETTINGS_TTL_MS = 15 * 1000;

const SETUP_MESSAGE =
  'لم تُجهَّز قاعدة البيانات لملاحظات الاستلام بعد. شغّل الملف supabase_handover.sql في Supabase (SQL Editor) ثم أعد المحاولة.';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isSetupError = (error) => {
  const msg = String(error?.message || error || '');
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code)
    || /does not exist|could not find the (table|function)|bucket not found/i.test(msg);
};

// Supabase calls resolve to { data, error }; turn an error into a thrown one.
const must = async (call, ms = 10000) => {
  const { data, error } = await withTimeout(call, ms);
  if (error) throw error;
  return data;
};

// ── Cloud store (Supabase tables + private bucket) ──────────────────────────
const signedCache = new Map(); // path -> { url, until }

const cloudStore = {
  mode: 'cloud',
  listNotes: () => must(supabase.from('handover_notes').select('*').order('created_at', { ascending: true }), 15000),
  getNote: (id) => must(supabase.from('handover_notes').select('*').eq('id', id).maybeSingle()),
  insertNote: (row) => must(supabase.from('handover_notes').insert([row]).select().single()),
  // Updates only while the note is still in the status the caller read, so two
  // reviewers acting at once cannot both change it. Returns null on a conflict.
  updateNote: async (id, patch, expectedStatus) => {
    let q = supabase.from('handover_notes').update(patch).eq('id', id);
    if (expectedStatus) q = q.eq('status', expectedStatus);
    const rows = await must(q.select());
    return rows?.[0] || null;
  },
  deleteNote: (id) => must(supabase.from('handover_notes').delete().eq('id', id)),
  nextSeq: (level, kind) => must(supabase.rpc('handover_next_seq', { p_level: level, p_kind: kind })),
  readSettings: async () => {
    const rows = await must(supabase.from('handover_settings').select('key, value'));
    return Object.fromEntries((rows || []).map(r => [r.key, r.value]));
  },
  writeSetting: (key, value) => must(
    supabase.from('handover_settings').upsert({ key, value, updated_at: new Date().toISOString() })),
  listReceipts: () => must(supabase.from('handover_receipts').select('*')),
  upsertReceipt: (row) => must(supabase.from('handover_receipts').upsert(row).select().single()),
  putPhoto: (objectPath, buffer) => must(
    supabase.storage.from(BUCKET).upload(objectPath, buffer, { contentType: 'image/jpeg', cacheControl: '86400', upsert: false }),
    30000),
  removePhotos: async (paths) => {
    if (!paths.length) return;
    paths.forEach(p => signedCache.delete(p));
    await must(supabase.storage.from(BUCKET).remove(paths));
  },
  // Signed links are reused until an hour before they expire, so the browser
  // keeps hitting its cache instead of downloading every photo again.
  photoUrls: async (paths) => {
    const now = Date.now();
    const urls = new Map();
    const missing = [];
    for (const p of paths) {
      const hit = signedCache.get(p);
      if (hit && hit.until > now) urls.set(p, hit.url);
      else missing.push(p);
    }
    for (let i = 0; i < missing.length; i += 500) {
      const batch = missing.slice(i, i + 500);
      const signed = await must(supabase.storage.from(BUCKET).createSignedUrls(batch, URL_TTL_SECONDS), 15000);
      for (const s of signed || []) {
        if (!s.signedUrl) continue;
        urls.set(s.path, s.signedUrl);
        signedCache.set(s.path, { url: s.signedUrl, until: now + (URL_TTL_SECONDS - 3600) * 1000 });
      }
    }
    return urls;
  },
};

// ── Local store (development without Supabase) ──────────────────────────────
const LOCAL_FILE = path.join(__dirname, 'data', 'handover_local.json');
const LOCAL_PHOTOS = path.join(__dirname, 'handover_local');
const LOCAL_URL_KEY = crypto.randomBytes(32);

const emptyLocal = () => ({
  notes: [],
  counters: {},
  settings: { levels: DEFAULT_LEVELS, filterers: [] },
  receipts: [],
});

const readLocal = () => {
  try {
    return { ...emptyLocal(), ...JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')) };
  } catch {
    return emptyLocal();
  }
};

let localQueue = Promise.resolve();
// Serialises read-modify-write cycles on the JSON file.
const mutateLocal = (fn) => {
  const run = localQueue.then(() => {
    const db = readLocal();
    const result = fn(db);
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(db, null, 2), 'utf8');
    return result;
  });
  localQueue = run.catch(() => {});
  return run;
};

const signLocal = (p, exp) => crypto.createHmac('sha256', LOCAL_URL_KEY).update(`${p}.${exp}`).digest('hex');

const localStore = {
  mode: 'local',
  listNotes: async () => readLocal().notes,
  getNote: async (id) => readLocal().notes.find(n => n.id === id) || null,
  insertNote: (row) => mutateLocal(db => {
    db.notes.push(row);
    return row;
  }),
  updateNote: (id, patch, expectedStatus) => mutateLocal(db => {
    const note = db.notes.find(n => n.id === id);
    if (!note || (expectedStatus && note.status !== expectedStatus)) return null;
    Object.assign(note, patch);
    return note;
  }),
  deleteNote: (id) => mutateLocal(db => {
    db.notes = db.notes.filter(n => n.id !== id);
  }),
  nextSeq: (level, kind) => mutateLocal(db => {
    const key = `${level}|${kind}`;
    db.counters[key] = (db.counters[key] || 0) + 1;
    return db.counters[key];
  }),
  readSettings: async () => readLocal().settings,
  writeSetting: (key, value) => mutateLocal(db => {
    db.settings[key] = value;
  }),
  listReceipts: async () => readLocal().receipts,
  upsertReceipt: (row) => mutateLocal(db => {
    db.receipts = db.receipts.filter(r => r.level !== row.level).concat(row);
    return row;
  }),
  putPhoto: async (objectPath, buffer) => {
    const fp = path.join(LOCAL_PHOTOS, objectPath);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, buffer);
  },
  removePhotos: async (paths) => {
    for (const p of paths) fs.rmSync(path.join(LOCAL_PHOTOS, p), { force: true });
  },
  photoUrls: async (paths) => {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    return new Map(paths.map(p => [p, `/api/handover/local-photo?p=${encodeURIComponent(p)}&exp=${exp}&sig=${signLocal(p, exp)}`]));
  },
};

const store = () => (isSupabaseActive() ? cloudStore : localStore);

// ── Settings and permissions ────────────────────────────────────────────────
let settingsCache = null;

const loadSettings = async () => {
  if (settingsCache && settingsCache.until > Date.now() && settingsCache.mode === store().mode) {
    return settingsCache.value;
  }
  const raw = await store().readSettings();
  const value = {
    levels: Array.isArray(raw.levels) && raw.levels.length ? raw.levels.map(String) : DEFAULT_LEVELS,
    filterers: Array.isArray(raw.filterers) ? raw.filterers.map(Number).filter(Number.isFinite) : [],
  };
  settingsCache = { value, until: Date.now() + SETTINGS_TTL_MS, mode: store().mode };
  return value;
};

const permissionsFor = (user, settings) => {
  const isFilterer = settings.filterers.includes(Number(user.id));
  const isDirector = user.role === 'super_admin';
  return {
    isFilterer,
    canEnter: isFilterer || isDirector || user.role === 'admin',
    canReview: isFilterer,
    canManageLevels: isFilterer || isDirector,
    canManageFilterers: isDirector,
    canEditReceipts: isFilterer || isDirector,
  };
};

const listUsers = async () => {
  if (isSupabaseActive()) {
    try {
      return await must(supabase.from('users').select('id, name, role').order('id', { ascending: true }));
    } catch (e) {
      console.warn('Supabase users read fallback (handover):', e.message || e);
    }
  }
  return sqliteAll('SELECT id, name, role FROM users ORDER BY id ASC');
};

// ── Shaping and validation ──────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');

const noteNumber = (n) => {
  if (n.status === 'approved' && n.approved_seq) return `${n.level}-${pad2(n.approved_seq)}`;
  if (n.status === 'deferred' && n.deferred_seq) return `${n.level}-D${pad2(n.deferred_seq)}`;
  return null;
};

const photoPaths = (notes) => notes.flatMap(n => (n.photos || []).flatMap(p => [p.path, p.thumb].filter(Boolean)));

const shapeNote = (n, urls) => ({
  id: n.id,
  level: n.level,
  note_type: n.note_type,
  description: n.description,
  location: n.location || '',
  final_text: n.final_text || '',
  status: n.status,
  reject_reason: n.reject_reason || null,
  approved_seq: n.approved_seq || null,
  deferred_seq: n.deferred_seq || null,
  number: noteNumber(n),
  photos: (n.photos || []).map(p => ({
    path: p.path,
    url: urls.get(p.path) || null,
    thumb: urls.get(p.thumb) || urls.get(p.path) || null,
  })),
  created_by: n.created_by != null ? Number(n.created_by) : null,
  created_by_name: n.created_by_name || '',
  reviewed_by_name: n.reviewed_by_name || '',
  reviewed_at: n.reviewed_at || null,
  created_at: n.created_at,
  updated_at: n.updated_at,
});

const shapeNotes = async (notes) => {
  const urls = await store().photoUrls(photoPaths(notes));
  return notes.map(n => shapeNote(n, urls));
};

const cleanText = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const cleanLevel = (value) => String(value ?? '').trim().toUpperCase();

const parseJpeg = (dataUri) => {
  let part;
  try {
    part = parseUpload(dataUri);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
  if (part.extension !== 'jpg') throw new HttpError(400, 'الصور تُرفع بصيغة JPEG فقط. أعد اختيار الصورة.');
  if (part.buffer.length > MAX_PHOTO_BYTES) throw new HttpError(400, 'حجم الصورة كبير جداً بعد التصغير. اختر صورة أخرى.');
  return part.buffer;
};

// Each photo arrives as { full, thumb } data URIs, already resized to JPEG by the browser.
const parsePhotos = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map(item => ({
    full: parseJpeg(item?.full),
    thumb: item?.thumb ? parseJpeg(item.thumb) : null,
  }));
};

// Uploads every photo or none: on failure the files already stored are removed.
const uploadPhotos = async (noteId, parsed) => {
  const entries = [];
  const files = [];
  try {
    for (const { full, thumb } of parsed) {
      const base = `notes/${noteId}/${crypto.randomUUID()}`;
      const entry = { path: `${base}.jpg` };
      await store().putPhoto(entry.path, full);
      files.push(entry.path);
      if (thumb) {
        entry.thumb = `${base}_t.jpg`;
        await store().putPhoto(entry.thumb, thumb);
        files.push(entry.thumb);
      }
      entries.push(entry);
    }
    return entries;
  } catch (err) {
    await store().removePhotos(files).catch(() => {});
    throw err;
  }
};

const filesOf = (photos) => (photos || []).flatMap(p => [p.path, p.thumb].filter(Boolean));

// One handler wrapper: known errors keep their status, a missing table or
// bucket becomes a clear setup message, anything else a generic 500.
const handle = (fn, fallbackMessage) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (isSetupError(err)) {
      console.error('Handover setup missing:', err.message || err);
      return res.status(503).json({ error: SETUP_MESSAGE, setup_required: true });
    }
    console.error(`Handover error (${req.method} ${req.path}):`, err?.message || err);
    res.status(500).json({ error: fallbackMessage });
  }
};

const context = async (req) => {
  const settings = await loadSettings();
  return { settings, can: permissionsFor(req.user, settings) };
};

// ── Routes ──────────────────────────────────────────────────────────────────
export const registerHandoverRoutes = (app) => {
  app.get('/api/handover/bootstrap', requireAuth, handle(async (req, res) => {
    const { settings, can } = await context(req);
    // Reading the receipts table too confirms every table exists before the UI opens.
    await store().listReceipts();
    const payload = {
      storage: store().mode,
      levels: settings.levels,
      filterers: settings.filterers,
      permissions: can,
    };
    if (can.canManageFilterers || can.canManageLevels) {
      payload.users = (await listUsers()).map(u => ({ id: Number(u.id), name: u.name, role: u.role }));
    }
    res.json(payload);
  }, 'تعذر تحميل إعدادات ملاحظات الاستلام.'));

  app.get('/api/handover/notes', requireAuth, handle(async (req, res) => {
    const notes = await store().listNotes();
    res.json(await shapeNotes(notes));
  }, 'تعذر تحميل الملاحظات.'));

  app.post('/api/handover/notes', requireAuth, handle(async (req, res) => {
    const { settings, can } = await context(req);
    if (!can.canEnter) throw new HttpError(403, 'لا تملك صلاحية إدخال الملاحظات.');

    const level = cleanLevel(req.body?.level);
    const noteType = String(req.body?.note_type || '');
    const description = cleanText(req.body?.description, 2000);
    const location = cleanText(req.body?.location, 200);
    if (!settings.levels.includes(level)) throw new HttpError(400, 'اختر النزلة من القائمة.');
    if (!NOTE_TYPES.has(noteType)) throw new HttpError(400, 'اختر نوع الملاحظة.');
    if (!description) throw new HttpError(400, 'اكتب وصف الملاحظة.');

    const parsed = parsePhotos(req.body?.photos);
    if (parsed.length > MAX_PHOTOS) throw new HttpError(400, `الحد الأقصى ${MAX_PHOTOS} صور للملاحظة.`);

    const id = crypto.randomUUID();
    const photos = await uploadPhotos(id, parsed);
    const now = new Date().toISOString();
    const row = {
      id,
      level,
      note_type: noteType,
      description,
      location,
      final_text: null,
      status: 'pending',
      reject_reason: null,
      approved_seq: null,
      deferred_seq: null,
      photos,
      created_by: Number(req.user.id),
      created_by_name: req.user.name || '',
      created_at: now,
      updated_at: now,
    };

    let saved;
    try {
      saved = await store().insertNote(row);
    } catch (err) {
      await store().removePhotos(filesOf(photos)).catch(() => {});
      throw err;
    }
    const [shaped] = await shapeNotes([saved]);
    res.status(201).json(shaped);
  }, 'تعذر حفظ الملاحظة، لم يُحفظ شيء. أعد المحاولة.'));

  app.put('/api/handover/notes/:id', requireAuth, handle(async (req, res) => {
    const { settings, can } = await context(req);
    const note = await store().getNote(req.params.id);
    if (!note) throw new HttpError(404, 'الملاحظة غير موجودة. ربما حُذفت.');
    const isOwner = Number(note.created_by) === Number(req.user.id);
    if (!isOwner && !can.canReview) throw new HttpError(403, 'تعديل الملاحظة متاح لصاحبها أو للمفلتر فقط.');
    if (note.status !== 'pending') throw new HttpError(409, 'لا يمكن التعديل بعد الفلترة. اطلب إرجاعها للفلترة أولاً.');

    const level = cleanLevel(req.body?.level);
    const noteType = String(req.body?.note_type || '');
    const description = cleanText(req.body?.description, 2000);
    const location = cleanText(req.body?.location, 200);
    if (!settings.levels.includes(level) && level !== note.level) throw new HttpError(400, 'اختر النزلة من القائمة.');
    if (!NOTE_TYPES.has(noteType)) throw new HttpError(400, 'اختر نوع الملاحظة.');
    if (!description) throw new HttpError(400, 'اكتب وصف الملاحظة.');

    const keepPaths = new Set(Array.isArray(req.body?.keep) ? req.body.keep.map(String) : []);
    const kept = (note.photos || []).filter(p => keepPaths.has(p.path));
    const dropped = (note.photos || []).filter(p => !keepPaths.has(p.path));
    const parsed = parsePhotos(req.body?.photos);
    if (kept.length + parsed.length > MAX_PHOTOS) throw new HttpError(400, `الحد الأقصى ${MAX_PHOTOS} صور للملاحظة.`);

    const added = await uploadPhotos(note.id, parsed);
    const patch = {
      level,
      note_type: noteType,
      description,
      location,
      photos: [...kept, ...added],
      updated_at: new Date().toISOString(),
    };
    // A number belongs to its level; moving the note retires the old numbers.
    if (level !== note.level) {
      patch.approved_seq = null;
      patch.deferred_seq = null;
    }

    let saved;
    try {
      saved = await store().updateNote(note.id, patch, 'pending');
    } catch (err) {
      await store().removePhotos(filesOf(added)).catch(() => {});
      throw err;
    }
    if (!saved) {
      await store().removePhotos(filesOf(added)).catch(() => {});
      throw new HttpError(409, 'تغيّرت حالة الملاحظة قبل الحفظ. حدّث القائمة وحاول مجدداً.');
    }
    await store().removePhotos(filesOf(dropped)).catch(e => console.warn('Handover photo cleanup:', e.message || e));
    const [shaped] = await shapeNotes([saved]);
    res.json(shaped);
  }, 'تعذر تعديل الملاحظة.'));

  app.delete('/api/handover/notes/:id', requireAuth, handle(async (req, res) => {
    const { can } = await context(req);
    const note = await store().getNote(req.params.id);
    if (!note) return res.json({ success: true });
    const isOwner = Number(note.created_by) === Number(req.user.id);
    if (!isOwner && !can.canReview) throw new HttpError(403, 'حذف الملاحظة متاح لصاحبها أو للمفلتر فقط.');
    if (note.status !== 'pending') throw new HttpError(409, 'لا يمكن حذف ملاحظة بعد فلترتها.');
    await store().deleteNote(note.id);
    await store().removePhotos(filesOf(note.photos)).catch(e => console.warn('Handover photo cleanup:', e.message || e));
    res.json({ success: true });
  }, 'تعذر حذف الملاحظة.'));

  app.post('/api/handover/notes/:id/review', requireAuth, handle(async (req, res) => {
    const { can } = await context(req);
    if (!can.canReview) throw new HttpError(403, 'الفلترة متاحة للمفلتر فقط.');
    const note = await store().getNote(req.params.id);
    if (!note) throw new HttpError(404, 'الملاحظة غير موجودة. ربما حُذفت.');

    const action = String(req.body?.action || '');
    const finalText = cleanText(req.body?.final_text, 2000);
    const noteType = req.body?.note_type ? String(req.body.note_type) : note.note_type;
    if (!NOTE_TYPES.has(noteType)) throw new HttpError(400, 'نوع الملاحظة غير صحيح.');

    const now = new Date().toISOString();
    const patch = { note_type: noteType, updated_at: now };
    if (finalText) patch.final_text = finalText;

    if (action === 'return') {
      if (note.status === 'pending') throw new HttpError(409, 'الملاحظة بانتظار الفلترة أصلاً.');
      Object.assign(patch, { status: 'pending', reject_reason: null, reviewed_by: null, reviewed_by_name: null, reviewed_at: null });
    } else {
      if (note.status !== 'pending') throw new HttpError(409, 'تمت فلترة هذه الملاحظة مسبقاً. حدّث القائمة.');
      Object.assign(patch, { reviewed_by: Number(req.user.id), reviewed_by_name: req.user.name || '', reviewed_at: now });
      if (action === 'approve' || action === 'defer') {
        if (!finalText && !note.final_text) patch.final_text = note.description;
        patch.reject_reason = null;
        if (action === 'approve') {
          patch.status = 'approved';
          if (!note.approved_seq) patch.approved_seq = Number(await store().nextSeq(note.level, 'A'));
        } else {
          patch.status = 'deferred';
          if (!note.deferred_seq) patch.deferred_seq = Number(await store().nextSeq(note.level, 'D'));
        }
      } else if (action === 'reject') {
        const reason = String(req.body?.reason || '');
        if (!REJECT_REASONS.has(reason)) throw new HttpError(400, 'اختر سبب الاستبعاد.');
        Object.assign(patch, { status: 'rejected', reject_reason: reason });
      } else {
        throw new HttpError(400, 'إجراء غير معروف.');
      }
    }

    const saved = await store().updateNote(note.id, patch, note.status);
    if (!saved) throw new HttpError(409, 'تغيّرت حالة الملاحظة قبل الحفظ. حدّث القائمة وحاول مجدداً.');
    const [shaped] = await shapeNotes([saved]);
    res.json(shaped);
  }, 'تعذر حفظ قرار الفلترة.'));

  app.put('/api/handover/settings', requireAuth, handle(async (req, res) => {
    const { can } = await context(req);
    const body = req.body || {};

    if (body.levels !== undefined) {
      if (!can.canManageLevels) throw new HttpError(403, 'تعديل قائمة النزلات متاح للمفلتر والمدير العام.');
      if (!Array.isArray(body.levels)) throw new HttpError(400, 'قائمة النزلات غير صحيحة.');
      const levels = [...new Set(body.levels.map(cleanLevel))];
      const bad = levels.find(l => !LEVEL_RE.test(l));
      if (bad !== undefined) throw new HttpError(400, `اسم النزلة "${bad}" غير مقبول. استخدم حروفاً لاتينية وأرقاماً فقط، مثل B38.`);
      if (levels.length === 0 || levels.length > 300) throw new HttpError(400, 'القائمة يجب أن تحتوي نزلة واحدة على الأقل.');
      await store().writeSetting('levels', levels);
    }

    if (body.filterers !== undefined) {
      if (!can.canManageFilterers) throw new HttpError(403, 'تحديد المفلتر متاح للمدير العام فقط.');
      if (!Array.isArray(body.filterers)) throw new HttpError(400, 'قائمة المفلترين غير صحيحة.');
      const known = new Set((await listUsers()).map(u => Number(u.id)));
      const filterers = [...new Set(body.filterers.map(Number))].filter(id => known.has(id)).slice(0, 20);
      await store().writeSetting('filterers', filterers);
    }

    settingsCache = null;
    const settings = await loadSettings();
    res.json({ levels: settings.levels, filterers: settings.filterers, permissions: permissionsFor(req.user, settings) });
  }, 'تعذر حفظ الإعدادات.'));

  app.get('/api/handover/receipts', requireAuth, handle(async (req, res) => {
    res.json(await store().listReceipts());
  }, 'تعذر تحميل سجل الاستلام.'));

  app.put('/api/handover/receipts/:level', requireAuth, handle(async (req, res) => {
    const { settings, can } = await context(req);
    if (!can.canEditReceipts) throw new HttpError(403, 'تحديث سجل الاستلام متاح للمفلتر والمدير العام.');
    const level = cleanLevel(req.params.level);
    if (!settings.levels.includes(level)) throw new HttpError(400, 'النزلة غير موجودة في القائمة.');
    const status = String(req.body?.status || '');
    if (!RECEIPT_STATUSES.has(status)) throw new HttpError(400, 'اختر حالة الاستلام.');
    const date = String(req.body?.received_on || '');
    const receivedOn = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    if (status !== 'not_received' && !receivedOn) throw new HttpError(400, 'حدد تاريخ الاستلام.');

    const row = {
      level,
      status,
      received_on: status === 'not_received' ? null : receivedOn,
      notes: cleanText(req.body?.notes, 1000),
      updated_by: Number(req.user.id),
      updated_by_name: req.user.name || '',
      updated_at: new Date().toISOString(),
    };
    res.json(await store().upsertReceipt(row));
  }, 'تعذر حفظ حالة الاستلام.'));

  // Photos in local mode. The signature in the link is the permission, the same
  // way Supabase signed links work, so <img> tags can load them directly.
  app.get('/api/handover/local-photo', (req, res) => {
    if (store().mode !== 'local') return res.status(404).end();
    const p = String(req.query.p || '');
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || '');
    const expected = signLocal(p, exp);
    const valid = PHOTO_PATH_RE.test(p)
      && Number.isFinite(exp) && exp > Date.now() / 1000
      && sig.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) return res.status(403).end();
    const fp = path.join(LOCAL_PHOTOS, p);
    if (!fs.existsSync(fp)) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(fp).pipe(res);
  });
};
