import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

// Force override from .env so any old process.env inherited by nodemon is overwritten
dotenv.config({ path: envPath, override: true });
dotenv.config({ override: true });

const dbPath = path.join(__dirname, 'project.db');
const sqliteDb = new sqlite3.Database(dbPath);

// Hard safeguard: Never allow the old decommissioned project URL (xzlsrqtptuspoqovbgpg)
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || supabaseUrl.includes('xzlsrqtptuspoqovbgpg')) {
  console.warn('Overriding outdated or missing Supabase URL with active cloud URL.');
  supabaseUrl = 'https://dmplquohltuocdjajwzq.supabase.co';
}
if (!supabaseKey || supabaseKey.includes('placeholder')) {
  supabaseKey = 'sb_publishable_pcl28wueyhYMoIMcIUZJcg_kgO-TsED';
}

let supabase = null;
let useSupabase = false;
let supabaseReady = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    useSupabase = true;
    supabaseReady = true;
    console.log('Initialized Supabase client (Primary Cloud Database active).');

    // Async verification test in background without disabling on initial latency
    Promise.race([
      supabase.from('categories').select('id').limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Initial ping timeout (8s)')), 8000))
    ])
      .then((result) => {
        if (result && result.error) throw result.error;
        console.log('Supabase cloud connection verified successfully.');
      })
      .catch((err) => {
        console.warn('Supabase cloud initial ping warning (will retry on incoming requests):', err.message || err);
      });
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err.message);
    useSupabase = false;
    supabaseReady = false;
  }
}

export const withTimeout = (promise, ms = 8000) => {
  return Promise.race([
    Promise.resolve(promise).catch(err => ({ data: null, error: err })),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Supabase timeout (${ms}ms)`)), ms))
  ]);
};

// Safe Supabase call wrapper — guarantees no unhandled errors and does not disable cloud permanently
export const safeSupa = async (supabaseCall, fallbackValue = null) => {
  if (!useSupabase || !supabase) return fallbackValue;
  try {
    const result = await withTimeout(supabaseCall, 8000);
    if (result && result.error) {
      console.warn('Supabase query error:', result.error.message || result.error);
      return fallbackValue;
    }
    return result;
  } catch (err) {
    console.warn('Supabase call warning:', err.message || err);
    return fallbackValue;
  }
};

// ── SQLite Promise Helpers ──────────────────────────────────────────────────
export const sqliteGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

export const sqliteAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

export const sqliteRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// ── JSON file helpers for persistent local offline fallback ─────────────────
export const getJsonFallback = (filename, defaultVal = []) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const fp = path.join(dataDir, filename);
    if (!fs.existsSync(fp)) return defaultVal;
    return JSON.parse(fs.readFileSync(fp, 'utf8') || '[]');
  } catch {
    return defaultVal;
  }
};

export const saveJsonFallback = (filename, data) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const fp = path.join(dataDir, filename);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
};

// ── Automatic Schema Initialization & Seed Migration ───────────────────────
export const initDatabase = async () => {
  try {
    // 1. Users table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Categories table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tasks table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        total_quantity REAL,
        completed_quantity REAL,
        progress_percent REAL DEFAULT 0,
        unit TEXT,
        notes TEXT,
        is_manual INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      )
    `);

    // 4. Sub-units (Nazalat) table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS sub_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        serial_number INTEGER,
        zone TEXT,
        code TEXT,
        white_marked INTEGER DEFAULT 0,
        white_extra INTEGER DEFAULT 0,
        white_applied INTEGER DEFAULT 0,
        white_date TEXT,
        brown_marked INTEGER DEFAULT 0,
        brown_extra INTEGER DEFAULT 0,
        brown_applied INTEGER DEFAULT 0,
        brown_date TEXT,
        status TEXT DEFAULT 'متبقي',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Marble distribution table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS marble_distribution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone TEXT NOT NULL,
        task_name TEXT NOT NULL,
        white_qty INTEGER,
        brown_qty INTEGER,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Daily updates table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS daily_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        sender_name TEXT,
        sender_role TEXT,
        message_text TEXT,
        media_url TEXT,
        media_type TEXT,
        reply_to_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Materials consumption table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS materials_consumption (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        day TEXT,
        start_time TEXT,
        end_time TEXT,
        prepared_by TEXT,
        basics TEXT,
        marble TEXT,
        sealants TEXT,
        bulk TEXT,
        notes TEXT,
        basics_notes TEXT,
        marble_notes TEXT,
        sealants_notes TEXT,
        bulk_notes TEXT,
        site_images TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
      )
    `);

    // 8. Workers wages table migration to support both schemas
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS workers_wages_new (
        id TEXT PRIMARY KEY,
        work_date TEXT NOT NULL,
        work_item TEXT,
        worker_name TEXT DEFAULT 'عمال ابو حيدر',
        shifts_count REAL DEFAULT 1,
        shift_price REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        daily_rate REAL DEFAULT 0,
        work_days REAL DEFAULT 1,
        advance_payment REAL DEFAULT 0,
        net_wage REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if old workers_wages table exists without work_item
    const wagesCols = await sqliteAll('PRAGMA table_info(workers_wages)');
    const hasWorkItem = wagesCols.some(c => c.name === 'work_item');
    if (!hasWorkItem && wagesCols.length > 0) {
      await sqliteRun('DROP TABLE IF EXISTS workers_wages');
    }
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS workers_wages (
        id TEXT PRIMARY KEY,
        work_date TEXT NOT NULL,
        work_item TEXT,
        worker_name TEXT DEFAULT 'عمال ابو حيدر',
        shifts_count REAL DEFAULT 1,
        shift_price REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        daily_rate REAL DEFAULT 0,
        work_days REAL DEFAULT 1,
        advance_payment REAL DEFAULT 0,
        net_wage REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Weekly advance table
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS weekly_advance (
        id TEXT PRIMARY KEY,
        receipt_date TEXT NOT NULL,
        team_leader TEXT,
        site_name TEXT,
        team_number TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
      )
    `);

    // Seed default users if empty
    const userCount = await sqliteGet('SELECT COUNT(*) as count FROM users');
    if (!userCount || userCount.count === 0) {
      await sqliteRun(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        ['admin@project.com', 'admin123', 'المدير العام', 'super_admin']
      );
      await sqliteRun(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        ['engineer@project.com', 'admin123', 'المهندس المقيم', 'admin']
      );
      await sqliteRun(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        ['viewer@project.com', 'viewer123', 'الإدارة العليا / الجهة المستفيدة', 'viewer']
      );
      console.log('Default users initialized in SQLite.');
    }

    // Migrate & seed Materials Consumption if SQLite is empty
    const consumptionCount = await sqliteGet('SELECT COUNT(*) as count FROM materials_consumption');
    if (!consumptionCount || consumptionCount.count === 0) {
      const historicalReports = [
        {
          id: '1787200000001',
          date: '2026-08-20',
          day: 'الخميس',
          start_time: '08:00',
          end_time: '17:00',
          prepared_by: 'المهندس علي حاتم',
          basics: {
            varnish: { pulled: '15', remaining: '185' },
            granite_granules: { pulled: '40', remaining: '80' },
            brown_paint: { pulled: '12', remaining: '28' },
            gray_base: { pulled: '8', remaining: '24' },
            putty: { pulled: '6', remaining: '18' },
            primer: { pulled: '5', remaining: '15' },
            roller: { pulled: '2', remaining: '21' }
          },
          marble: {
            zone_a: { white: { skiliat: '2', pieces_per_skilia: '198', loose: '45', total: 441 }, brown: { skiliat: '1', pieces_per_skilia: '198', loose: '60', total: 258 } },
            zone_b: { white: { skiliat: '1', pieces_per_skilia: '198', loose: '20', total: 218 }, brown: { skiliat: '2', pieces_per_skilia: '198', loose: '30', total: 426 } },
            zone_c: { white: { skiliat: '3', pieces_per_skilia: '198', loose: '80', total: 674 }, brown: { skiliat: '3', pieces_per_skilia: '198', loose: '50', total: 644 } }
          },
          sealants: {
            beige_paint: { pulled: '80', remaining: '242' },
            white_paint: { pulled: '95', remaining: '310' },
            primer: { pulled: '10', remaining: '22' },
            tape: { pulled: '8', remaining: '24' },
            sponge_1cm: { pulled: '12', remaining: '35' },
            sponge_2cm: { pulled: '15', remaining: '40' },
            sponge_3cm: { pulled: '10', remaining: '25' }
          },
          bulk: {
            cement: '45',
            sand: '12',
            foam: { pulled: '10', remaining: '40' }
          },
          notes: 'تم إنجاز أعمال التطبيك لزون A وزون B وفق المخططات وجرد المخزن مطابق.',
          created_at: '2026-08-20T14:30:00.000Z'
        },
        {
          id: '1787000000002',
          date: '2026-08-18',
          day: 'الثلاثاء',
          start_time: '08:00',
          end_time: '16:30',
          prepared_by: 'المهندس علي حاتم',
          basics: {
            varnish: { pulled: '10', remaining: '200' },
            granite_granules: { pulled: '30', remaining: '120' },
            brown_paint: { pulled: '8', remaining: '40' },
            gray_base: { pulled: '5', remaining: '32' },
            putty: { pulled: '4', remaining: '24' },
            primer: { pulled: '4', remaining: '20' },
            roller: { pulled: '1', remaining: '23' }
          },
          marble: {
            zone_a: { white: { skiliat: '1', pieces_per_skilia: '198', loose: '30', total: 228 }, brown: { skiliat: '1', pieces_per_skilia: '198', loose: '20', total: 218 } },
            zone_b: { white: { skiliat: '1', pieces_per_skilia: '198', loose: '50', total: 248 }, brown: { skiliat: '1', pieces_per_skilia: '198', loose: '40', total: 238 } },
            zone_c: { white: { skiliat: '2', pieces_per_skilia: '198', loose: '40', total: 436 }, brown: { skiliat: '2', pieces_per_skilia: '198', loose: '35', total: 431 } }
          },
          sealants: {
            beige_paint: { pulled: '60', remaining: '322' },
            white_paint: { pulled: '70', remaining: '405' },
            primer: { pulled: '6', remaining: '32' },
            tape: { pulled: '5', remaining: '32' },
            sponge_1cm: { pulled: '8', remaining: '47' },
            sponge_2cm: { pulled: '10', remaining: '55' },
            sponge_3cm: { pulled: '6', remaining: '35' }
          },
          bulk: {
            cement: '30',
            sand: '8',
            foam: { pulled: '6', remaining: '50' }
          },
          notes: 'استلام وجبة صوصج بيجي واسفنج 2 سم ومطابقة الكميات المسحوبة.',
          created_at: '2026-08-18T13:45:00.000Z'
        },
        {
          id: '1781871048975',
          date: '2026-06-19',
          day: 'الأحد',
          start_time: '08:00',
          end_time: '17:00',
          prepared_by: 'علي حاتم',
          basics: {
            varnish: { pulled: '0', remaining: '200' },
            granite_granules: { pulled: '0', remaining: '33' },
            brown_paint: { pulled: '32', remaining: '32' },
            gray_base: { pulled: '32', remaining: '32' },
            putty: { pulled: '3', remaining: '23' },
            primer: { pulled: '0', remaining: '0' },
            roller: { pulled: '0', remaining: '23' }
          },
          marble: {
            zone_a: { white: { skiliat: '1', pieces_per_skilia: '198', loose: '32', total: 230 }, brown: { skiliat: '1', pieces_per_skilia: '198', loose: '323', total: 521 } },
            zone_b: { white: { skiliat: '2', pieces_per_skilia: '198', loose: '4423', total: 4819 }, brown: { skiliat: '3', pieces_per_skilia: '198', loose: '43', total: 637 } },
            zone_c: { white: { skiliat: '3', pieces_per_skilia: '198', loose: '342', total: 936 }, brown: { skiliat: '4', pieces_per_skilia: '198', loose: '43', total: 835 } }
          },
          sealants: {
            beige_paint: { pulled: '323', remaining: '322' },
            white_paint: { pulled: '32', remaining: '32' },
            primer: { pulled: '32', remaining: '32' },
            tape: { pulled: '32', remaining: '32' },
            sponge_1cm: { pulled: '32', remaining: '3' },
            sponge_2cm: { pulled: '32', remaining: '32' },
            sponge_3cm: { pulled: '32', remaining: '32' }
          },
          bulk: {
            cement: '33',
            sand: '',
            foam: { pulled: '3', remaining: '343' }
          },
          notes: 'تقرير جرد أولي معتمد من الكوادر الفنية.',
          created_at: '2026-06-19T12:10:48.975Z'
        }
      ];

      for (const rep of historicalReports) {
        await sqliteRun(`
          INSERT INTO materials_consumption (id, date, day, start_time, end_time, prepared_by, basics, marble, sealants, bulk, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rep.id,
          rep.date,
          rep.day,
          rep.start_time || '08:00',
          rep.end_time || '17:00',
          rep.prepared_by,
          JSON.stringify(rep.basics || {}),
          JSON.stringify(rep.marble || {}),
          JSON.stringify(rep.sealants || {}),
          JSON.stringify(rep.bulk || {}),
          rep.notes || '',
          rep.created_at || new Date().toISOString()
        ]);
      }
      saveJsonFallback('materials_consumption.json', historicalReports);
      console.log(`Seeded ${historicalReports.length} materials consumption records.`);
    }

    // Migrate & seed Workers Wages if SQLite is empty
    const wagesCount = await sqliteGet('SELECT COUNT(*) as count FROM workers_wages');
    if (!wagesCount || wagesCount.count === 0) {
      const historicalWages = [
        { id: '1786520369375', work_date: '2026-08-02', work_item: 'رفع انقاض', worker_name: 'عمال ابو حيدر', shifts_count: 2, shift_price: 35000, total_amount: 70000, notes: 'بموافقة مهندس امير', created_at: '2026-08-12T07:39:29.375Z' },
        { id: '1786012709387', work_date: '2026-08-02', work_item: 'تصنيف نزلات', worker_name: 'عمال ابو حيدر', shifts_count: 2, shift_price: 30000, total_amount: 60000, notes: 'اكمال تنظيف النزلات لأجل اكمال اعمال الجلي والشربتة', created_at: '2026-08-06T10:38:29.387Z' },
        { id: '1786012607713', work_date: '2026-08-01', work_item: 'تصنيف نزلات', worker_name: 'عمال ابو حيدر', shifts_count: 2, shift_price: 30000, total_amount: 60000, notes: 'اكمال تنظيف النزلات لأجل اكمال اعمال الجلي والشربتة', created_at: '2026-08-06T10:36:47.713Z' },
        { id: '1785000000001', work_date: '2026-07-21', work_item: 'تنظيف جوينات', worker_name: 'عمال ابو حيدر', shifts_count: 2, shift_price: 30000, total_amount: 60000, notes: 'تنظيف النزلات لأجل اكمال هناك الشربت', created_at: '2026-07-21T09:00:00.000Z' },
        { id: '1785000000002', work_date: '2026-07-20', work_item: 'تنظيف نزلات', worker_name: 'عمال ابو حيدر', shifts_count: 2, shift_price: 30000, total_amount: 60000, notes: 'استمرار تنظيف نزلات زون A', created_at: '2026-07-20T09:00:00.000Z' }
      ];

      for (const w of historicalWages) {
        await sqliteRun(`
          INSERT INTO workers_wages (id, work_date, work_item, worker_name, shifts_count, shift_price, total_amount, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [w.id, w.work_date, w.work_item, w.worker_name, w.shifts_count, w.shift_price, w.total_amount, w.notes, w.created_at]);
      }
      saveJsonFallback('workers_wages.json', historicalWages);
      console.log(`Seeded ${historicalWages.length} workers wages records.`);
    }

    // Migrate & seed Weekly Advance if SQLite is empty
    const advanceCount = await sqliteGet('SELECT COUNT(*) as count FROM weekly_advance');
    if (!advanceCount || advanceCount.count === 0) {
      const jsonAdvances = getJsonFallback('weekly_advance.json', []);
      for (const adv of jsonAdvances) {
        await sqliteRun(`
          INSERT INTO weekly_advance (id, receipt_date, team_leader, site_name, team_number, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          String(adv.id),
          adv.receipt_date || '2026-07-26',
          adv.team_leader || 'خلفة ابو حيدر',
          adv.site_name || 'موقع الجندي المجهول',
          adv.team_number || '1',
          typeof adv.data === 'object' ? JSON.stringify(adv.data) : (adv.data || '{}'),
          adv.created_at || new Date().toISOString()
        ]);
      }
      console.log(`Migrated ${jsonAdvances.length} weekly advance records to SQLite.`);
    }

    console.log('Database schema & records verified successfully.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

// Initialize immediately on module load
initDatabase();

export const isSupabaseActive = () => Boolean(useSupabase && supabase);

// ── Unified Database Abstraction ────────────────────────────────────────────

export const dbRun = async (sql, params = []) => {
  if (isSupabaseActive()) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      if (sqlClean.includes('UPDATE sub_units SET status = ?, notes = ? WHERE id = ?')) {
        const [status, notes, id] = params;
        const result = await safeSupa(supabase.from('sub_units').update({ status, notes }).eq('id', id));
        if (result && !result.error) {
          sqliteRun(sql, params).catch(() => {});
          return { changes: 1 };
        }
      }

      if (sqlClean.includes('UPDATE sub_units SET white_marked = ?')) {
        const [white_marked, white_extra, white_applied, white_date, brown_marked, brown_extra, brown_applied, brown_date, status, notes, id] = params;
        const result = await safeSupa(supabase.from('sub_units').update({
          white_marked, white_extra, white_applied, white_date,
          brown_marked, brown_extra, brown_applied, brown_date,
          status, notes
        }).eq('id', id));
        if (result && !result.error) {
          sqliteRun(sql, params).catch(() => {});
          return { changes: 1 };
        }
      }

      if (sqlClean.includes('UPDATE tasks SET')) {
        const updateData = {};
        const paramList = [...params];
        const taskId = paramList[paramList.length - 1]; // Last parameter is always the WHERE id = ?

        if (sqlClean.includes('completed_quantity = ?') && sqlClean.includes('progress_percent = ?')) {
          const completedFirst = sqlClean.indexOf('completed_quantity') < sqlClean.indexOf('progress_percent');
          updateData.completed_quantity = params[completedFirst ? 0 : 1];
          updateData.progress_percent = params[completedFirst ? 1 : 0];
          if (sqlClean.includes('notes = ?')) {
            updateData.notes = params[2];
          }
        } else if (sqlClean.includes('notes = ?')) {
          updateData.notes = params[0];
        } else if (sqlClean.includes('progress_percent = ?')) {
          updateData.progress_percent = params[0];
        }

        const result = await safeSupa(supabase.from('tasks').update(updateData).eq('id', taskId));
        if (result && !result.error) {
          sqliteRun(sql, params).catch(() => {});
          return { changes: 1 };
        }
      }

      if (sqlClean.includes('INSERT INTO daily_updates')) {
        let user_id = null, sender_name = '', sender_role = '', message_text = '', media_url = null, media_type = null, reply_to_id = null;
        if (sqlClean.includes('VALUES (null, ?, ?, ?, null, null, null)') || sqlClean.includes('VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)')) {
          [sender_name, sender_role, message_text] = params;
        } else {
          [user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id] = params;
        }
        const result = await safeSupa(supabase.from('daily_updates').insert([{
          user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id
        }]).select().single());
        if (result && result.data && !result.error) {
          sqliteRun(sql, params).catch(() => {});
          return { id: result.data.id, changes: 1 };
        }
      }

      if (sqlClean.includes('UPDATE marble_distribution SET status = ?, white_qty = ?, brown_qty = ? WHERE id = ?')) {
        const [status, white_qty, brown_qty, id] = params;
        const result = await safeSupa(supabase.from('marble_distribution').update({ status, white_qty, brown_qty }).eq('id', id));
        if (result && !result.error) {
          sqliteRun(sql, params).catch(() => {});
          return { changes: 1 };
        }
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbRun fallback:', supabaseErr?.message || supabaseErr);
    }
  }

  return sqliteRun(sql, params);
};

export const dbGet = async (sql, params = []) => {
  if (isSupabaseActive()) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      // Users lookup
      if (sqlClean.includes('FROM users WHERE')) {
        if (sqlClean.includes('password = ?')) {
          const [email, password] = params;
          const result = await safeSupa(
            supabase.from('users').select('id, email, name, role').ilike('email', email.trim()).eq('password', password).maybeSingle()
          );
          if (result && result.data) return result.data;
        } else if (sqlClean.includes('LOWER(email) = LOWER(?)') || sqlClean.includes('email = ?')) {
          const [email] = params;
          const result = await safeSupa(
            supabase.from('users').select('id, email, name, role').ilike('email', email.trim()).maybeSingle()
          );
          if (result && result.data) return result.data;
        }
      }

      // Single sub-unit
      if (sqlClean.includes('FROM sub_units WHERE id = ?')) {
        const result = await safeSupa(supabase.from('sub_units').select('*').eq('id', params[0]).maybeSingle());
        if (result && result.data) return result.data;
      }

      // Sub-units counts
      if (sqlClean.includes('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ?')) {
        let q = supabase.from('sub_units').select('*', { count: 'exact', head: true }).eq('task_id', params[0]);
        if (sqlClean.includes('status = ?')) {
          q = q.eq('status', params[1]);
        }
        const result = await safeSupa(q);
        if (result && result.count !== null && result.count !== undefined) {
          return { count: result.count };
        }
      }

      // Marble distribution
      if (sqlClean.includes('FROM marble_distribution WHERE id = ?')) {
        const result = await safeSupa(supabase.from('marble_distribution').select('*').eq('id', params[0]).maybeSingle());
        if (result && result.data) return result.data;
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbGet fallback:', supabaseErr?.message || supabaseErr);
    }
  }

  return sqliteGet(sql, params);
};

export const dbAll = async (sql, params = []) => {
  if (isSupabaseActive()) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      // 1. Categories
      if (sqlClean.includes('FROM categories')) {
        const result = await safeSupa(supabase.from('categories').select('*').order('id', { ascending: true }));
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 2. Tasks with Category Name
      if (sqlClean.includes('FROM tasks') && (sqlClean.includes('JOIN categories') || sqlClean.includes('categories c'))) {
        const result = await safeSupa(supabase.from('tasks').select('*, categories(name)').order('id', { ascending: true }));
        if (result && result.data && result.data.length > 0) {
          return result.data.map(t => ({
            ...t,
            category_name: t.categories?.name || ''
          }));
        }
      }

      // 3. All Tasks
      if (sqlClean === 'SELECT * FROM tasks' || sqlClean.startsWith('SELECT * FROM tasks ORDER BY')) {
        const result = await safeSupa(supabase.from('tasks').select('*').order('id', { ascending: true }));
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 4. Sub-units (Nazalat) Aggregation (Dashboard KPIs)
      if (sqlClean.includes('FROM sub_units') && sqlClean.includes('GROUP BY zone, status')) {
        const result = await safeSupa(supabase.from('sub_units').select('zone, status'));
        if (result && result.data && result.data.length > 0) {
          const map = {};
          result.data.forEach(item => {
            const key = `${item.zone}:::${item.status}`;
            if (!map[key]) map[key] = { zone: item.zone, status: item.status, count: 0 };
            map[key].count++;
          });
          return Object.values(map);
        }
      }

      // 5. Sub-units (Nazalat Tracking Table & Counts)
      if (sqlClean.includes('FROM sub_units')) {
        if (sqlClean.includes('COUNT(*)')) {
          let q = supabase.from('sub_units').select('*', { count: 'exact', head: true });
          if (sqlClean.includes('WHERE task_id = ? AND status = ?')) {
            q = q.eq('task_id', params[0]).eq('status', params[1]);
          } else if (sqlClean.includes('WHERE task_id = ?')) {
            q = q.eq('task_id', params[0]);
          }
          const result = await safeSupa(q);
          if (result && result.count !== null && result.count !== undefined) {
            return [{ count: result.count }];
          }
        }

        let q = supabase.from('sub_units').select('*').order('serial_number', { ascending: true });
        if (sqlClean.includes('zone = ?') && sqlClean.includes('status = ?')) {
          q = q.eq('zone', params[0]).eq('status', params[1]);
        } else if (sqlClean.includes('zone = ?')) {
          q = q.eq('zone', params[0]);
        } else if (sqlClean.includes('status = ?')) {
          q = q.eq('status', params[0]);
        }
        const result = await safeSupa(q);
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 6. Marble Distribution
      if (sqlClean.includes('FROM marble_distribution')) {
        const result = await safeSupa(supabase.from('marble_distribution').select('*').order('id', { ascending: true }));
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 7. Daily Updates
      if (sqlClean.includes('FROM daily_updates')) {
        const result = await safeSupa(supabase.from('daily_updates').select('*').order('created_at', { ascending: true }));
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 8. Materials Consumption
      if (sqlClean.includes('FROM materials_consumption')) {
        const result = await safeSupa(
          supabase.from('materials_consumption').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
        );
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 9. Workers Wages
      if (sqlClean.includes('FROM workers_wages')) {
        const result = await safeSupa(
          supabase.from('workers_wages').select('*').order('work_date', { ascending: false }).order('created_at', { ascending: false })
        );
        if (result && result.data && result.data.length > 0) return result.data;
      }

      // 10. Users List
      if (sqlClean.includes('FROM users')) {
        const result = await safeSupa(
          supabase.from('users').select('id, email, name, role, password').order('id', { ascending: true })
        );
        if (result && result.data && result.data.length > 0) return result.data;
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbAll fallback:', supabaseErr?.message || supabaseErr);
    }
  }

  return sqliteAll(sql, params);
};

export {
  supabase,
  sqliteDb
};
