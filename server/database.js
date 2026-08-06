import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'project.db');

const sqliteDb = new sqlite3.Database(dbPath);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
let useSupabase = false;

const withTimeout = (promise, ms = 1000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Supabase timeout (${ms}ms)`)), ms))
  ]);
};

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    useSupabase = true;
    console.log('Initialized Supabase client (testing connectivity...).');

    // Fast initial check (800ms) to verify Supabase availability
    withTimeout(supabase.from('categories').select('id').limit(1), 800)
      .then(() => console.log('Supabase connection verified.'))
      .catch((err) => {
        console.warn('Supabase connectivity check failed, falling back to local SQLite:', err.message);
        useSupabase = false;
      });
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err.message);
  }
}

const sqliteGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

const sqliteAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const sqliteRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const db = supabase || sqliteDb;

const dbRun = async (sql, params = []) => {
  if (useSupabase && supabase) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      // 1. UPDATE sub_units SET status = ?, notes = ? WHERE id = ?
      if (sqlClean.includes('UPDATE sub_units SET status = ?, notes = ? WHERE id = ?')) {
        const [status, notes, id] = params;
        const { error } = await withTimeout(supabase.from('sub_units').update({ status, notes }).eq('id', id));
        if (error) throw error;
        return { changes: 1 };
      }

      // 1b. UPDATE sub_units details
      if (sqlClean.includes('UPDATE sub_units SET white_marked = ?, white_extra = ?, white_applied = ?, white_date = ?, brown_marked = ?, brown_extra = ?, brown_applied = ?, brown_date = ?, status = ?, notes = ? WHERE id = ?')) {
        const [white_marked, white_extra, white_applied, white_date, brown_marked, brown_extra, brown_applied, brown_date, status, notes, id] = params;
        const { error } = await withTimeout(supabase.from('sub_units').update({ white_marked, white_extra, white_applied, white_date, brown_marked, brown_extra, brown_applied, brown_date, status, notes }).eq('id', id));
        if (error) throw error;
        return { changes: 1 };
      }

      // 2. UPDATE tasks SET completed_quantity = ?, progress_percent = ? WHERE id = ?
      if (sqlClean.includes('UPDATE tasks SET completed_quantity = ?, progress_percent = ? WHERE id = ?')) {
        const [completed, progress, taskId] = params;
        const { error } = await withTimeout(supabase.from('tasks').update({ completed_quantity: completed, progress_percent: progress }).eq('id', taskId));
        if (error) throw error;
        return { changes: 1 };
      }

      // 3. INSERT INTO daily_updates
      if (sqlClean.includes('INSERT INTO daily_updates')) {
        let user_id = null, sender_name = '', sender_role = '', message_text = '', media_url = null, media_type = null, reply_to_id = null;
        if (sqlClean.includes('VALUES (null, ?, ?, ?, null, null, null)') || sqlClean.includes('VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)')) {
          [sender_name, sender_role, message_text] = params;
        } else {
          [user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id] = params;
        }
        const { data, error } = await withTimeout(supabase.from('daily_updates').insert([{ user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id }]).select().single());
        if (error) throw error;
        return { id: data.id, changes: 1 };
      }

      // 4. UPDATE tasks SET progress_percent = ?, completed_quantity = ? ...
      if (sqlClean.includes('UPDATE tasks SET progress_percent = ?, completed_quantity = ?')) {
        let updates = { progress_percent: params[0], completed_quantity: params[1] };
        let id;
        if (sqlClean.includes('notes = ?')) { updates.notes = params[2]; id = params[3]; } else { id = params[2]; }
        const { error } = await withTimeout(supabase.from('tasks').update(updates).eq('id', id));
        if (error) throw error;
        return { changes: 1 };
      }

      // 5. UPDATE tasks SET notes = ? WHERE id = ?
      if (sqlClean.includes('UPDATE tasks SET notes = ? WHERE id = ?')) {
        const [notes, id] = params;
        const { error } = await withTimeout(supabase.from('tasks').update({ notes }).eq('id', id));
        if (error) throw error;
        return { changes: 1 };
      }

      // 6. UPDATE marble_distribution SET status = ?, white_qty = ?, brown_qty = ? WHERE id = ?
      if (sqlClean.includes('UPDATE marble_distribution SET status = ?, white_qty = ?, brown_qty = ? WHERE id = ?')) {
        const [status, white_qty, brown_qty, id] = params;
        const { error } = await withTimeout(supabase.from('marble_distribution').update({ status, white_qty, brown_qty }).eq('id', id));
        if (error) throw error;
        return { changes: 1 };
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbRun warning, disabling Supabase and executing on local SQLite:', supabaseErr.message || supabaseErr);
      useSupabase = false;
    }
  }

  return sqliteRun(sql, params);
};

const dbGet = async (sql, params = []) => {
  if (useSupabase && supabase) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      if (sqlClean.includes('FROM users WHERE email = ? AND password = ?')) {
        const [email, password] = params;
        const { data, error } = await withTimeout(supabase.from('users').select('id, email, name, role').eq('email', email).eq('password', password).maybeSingle());
        if (error) throw error;
        if (data) return data;
      }

      if (sqlClean.includes('SELECT status, task_id, code, zone FROM sub_units WHERE id = ?')) {
        const { data, error } = await withTimeout(supabase.from('sub_units').select('status, task_id, code, zone, white_marked, white_extra, white_applied, white_date, brown_marked, brown_extra, brown_applied, brown_date').eq('id', params[0]).maybeSingle());
        if (error) throw error;
        if (data) return data;
      }

      if (sqlClean.includes('COUNT(*) as count FROM sub_units WHERE task_id = ?')) {
        const taskId = params[0];
        let query = supabase.from('sub_units').select('*', { count: 'exact', head: true }).eq('task_id', taskId);
        if (sqlClean.includes('status = ?')) query = query.eq('status', params[1]);
        const { count, error } = await withTimeout(query);
        if (error) throw error;
        return { count };
      }

      if (sqlClean.includes('SELECT * FROM tasks WHERE id = ?')) {
        const { data, error } = await withTimeout(supabase.from('tasks').select('*').eq('id', params[0]).maybeSingle());
        if (error) throw error;
        if (data) return data;
      }

      if (sqlClean.includes('FROM marble_distribution WHERE id = ?')) {
        const { data, error } = await withTimeout(supabase.from('marble_distribution').select('*').eq('id', params[0]).maybeSingle());
        if (error) throw error;
        if (data) return data;
      }

      if (sqlClean.includes('daily_updates d') && sqlClean.includes('WHERE d.id = ?')) {
        const { data, error } = await withTimeout(supabase.from('daily_updates_with_users').select('*').eq('id', params[0]).maybeSingle());
        if (error) throw error;
        if (data) return data;
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbGet warning, disabling Supabase and executing on local SQLite:', supabaseErr.message || supabaseErr);
      useSupabase = false;
    }
  }

  return sqliteGet(sql, params);
};

const dbAll = async (sql, params = []) => {
  if (useSupabase && supabase) {
    try {
      const sqlClean = sql.replace(/\s+/g, ' ').trim();

      if (sqlClean.includes('FROM categories')) {
        const { data, error } = await withTimeout(supabase.from('categories').select('*').order('id', { ascending: true }));
        if (error) throw error;
        if (data && data.length) return data;
      }

      if (sqlClean.includes('FROM tasks t') && sqlClean.includes('JOIN categories c')) {
        const { data, error } = await withTimeout(supabase.from('tasks').select('*, categories(name)').order('id', { ascending: true }));
        if (error) throw error;
        if (data && data.length) {
          return data.map(t => ({
            ...t,
            category_name: t.categories?.name
          }));
        }
      }

      if (sqlClean.includes('sub_units GROUP BY zone, status')) {
        const { data, error } = await withTimeout(supabase.from('sub_units_stats').select('*'));
        if (error) throw error;
        if (data && data.length) return data;
      }

      if (sqlClean.includes('FROM sub_units')) {
        let query = supabase.from('sub_units').select('*').order('serial_number', { ascending: true });
        let paramIdx = 0;
        if (sqlClean.includes('zone = ?')) query = query.eq('zone', params[paramIdx++]);
        if (sqlClean.includes('status = ?')) query = query.eq('status', params[paramIdx++]);
        const { data, error } = await withTimeout(query);
        if (error) throw error;
        if (data && data.length) return data;
      }

      if (sqlClean.includes('FROM marble_distribution')) {
        const { data, error } = await withTimeout(supabase.from('marble_distribution').select('*').order('id', { ascending: true }));
        if (error) throw error;
        if (data && data.length) return data;
      }

      if (sqlClean.includes('daily_updates d') && sqlClean.includes('LEFT JOIN users u')) {
        const { data, error } = await withTimeout(supabase.from('daily_updates_with_users').select('*').order('created_at', { ascending: true }));
        if (error) throw error;
        if (data && data.length) return data;
      }
    } catch (supabaseErr) {
      console.warn('Supabase dbAll warning, disabling Supabase and executing on local SQLite:', supabaseErr.message || supabaseErr);
      useSupabase = false;
    }
  }

  return sqliteAll(sql, params);
};

const initDatabase = async () => {
  console.log('Database initialized successfully.');
};

export {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase
};

