// All writes use the configured primary store. Local mirrors are caches when
// cloud storage is enabled; a rejected cloud write must never become local-only.
import { cloudMutation } from './audit-context.js';
export class DataError extends Error {
  constructor(status, message, code = 'DATA_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const withTimeout = async (promise, ms = 10000) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DataError(504,
          'تعذّر تأكيد نتيجة العملية. حدّث السجل للتحقق قبل إعادة المحاولة.', 'RESULT_UNKNOWN')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const cloudResult = async (request, ms) => {
  let result;
  try {
    result = await withTimeout(request, ms);
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError(503, 'تعذّر الاتصال بقاعدة البيانات السحابية. تحقّق من السجل قبل إعادة المحاولة.', 'CLOUD_UNAVAILABLE');
  }
  if (result?.error) {
    const error = result.error;
    console.error('Cloud request failed:', error.code || '', error.message || '');
    if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error.code)) {
      throw new DataError(503, 'قاعدة البيانات تحتاج تحديثاً. طبّق supabase_urgent_fixes.sql ثم supabase_operations.sql والجداول المطلوبة.', 'SCHEMA_REQUIRED');
    }
    if (error.code === '23505') {
      throw new DataError(409, 'السجل موجود مسبقاً. حدّث القائمة قبل إعادة المحاولة.', 'CONFLICT');
    }
    // Network errors can arrive as a resolved Supabase error too. Do not claim
    // that nothing was saved: a response may have been lost after commit.
    throw new DataError(502, 'تعذّر تأكيد العملية في السحابة. حدّث السجل للتحقق قبل إعادة المحاولة.', 'CLOUD_WRITE_FAILED');
  }
  return result?.data;
};

const schema = {
  users: { columns: 'id email password name role session_version created_at' },
  tasks: { columns: 'id category_id name total_quantity completed_quantity progress_percent unit notes is_manual created_at' },
  sub_units: { columns: 'id task_id serial_number zone code status notes white_marked white_extra white_applied white_date brown_marked brown_extra brown_applied brown_date created_at' },
  marble_distribution: { columns: 'id zone task_name white_qty brown_qty status created_at' },
  daily_updates: { columns: 'id user_id sender_name sender_role message_text media_url media_type reply_to_id created_at' },
  materials_consumption: {
    columns: 'id date day start_time end_time prepared_by basics marble sealants bulk notes basics_notes marble_notes sealants_notes bulk_notes site_images created_at updated_at',
    json: ['basics', 'marble', 'sealants', 'bulk', 'site_images'], mirror: true,
  },
  workers_wages: { columns: 'id work_date work_item worker_name shifts_count shift_price total_amount daily_rate work_days advance_payment net_wage notes created_at', mirror: true },
  weekly_advance: { columns: 'id receipt_date team_leader site_name team_number data created_at updated_at', json: ['data'], mirror: true },
  marblex_progress: { columns: 'id zone item_name total_pieces applied_pieces pieces_progress total_steel applied_steel steel_progress overall_progress status notes updated_by created_at updated_at', mirror: true },
  joints_daily: { columns: 'id report_date workers_count notes data created_at updated_at', json: ['data'], mirror: true },
};

export const normalizeRecord = (table, row) => {
  if (!row) return row;
  const out = { ...row };
  for (const key of schema[table]?.json || []) {
    if (typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch { out[key] = null; }
    }
    out[key] ??= key === 'site_images' ? [] : {};
  }
  return out;
};

export function createPersistence({ cloud, sqlGet, sqlAll, sqlRun, saveJson, atomic = action => action(), audit = async () => {} }) {
  const definition = (table) => {
    if (!schema[table]) throw new Error(`Unsupported table: ${table}`);
    return schema[table];
  };
  const columns = (table, row) => {
    const allowed = new Set(definition(table).columns.split(' '));
    return Object.keys(row).filter(k => allowed.has(k) && row[k] !== undefined);
  };
  const values = (table, row, keys) => keys.map(k =>
    definition(table).json?.includes(k) && row[k] !== null ? JSON.stringify(row[k]) : row[k]);
  const mirrorQueue = new Map();

  const snapshot = async (table) => {
    if (!definition(table).mirror) return;
    const rows = await sqlAll(`SELECT * FROM ${table}`);
    if (!saveJson(`${table}.json`, rows.map(r => normalizeRecord(table, r)))) {
      throw new Error(`Could not write ${table} JSON mirror`);
    }
  };
  const mirror = (table, action) => {
    const task = (mirrorQueue.get(table) || Promise.resolve()).then(async () => {
      await action();
      await snapshot(table);
    }).catch(error => console.error(`Local mirror failed for ${table}; primary save succeeded:`, error.message));
    mirrorQueue.set(table, task);
    return task;
  };
  const upsertLocal = async (table, row) => {
    const keys = columns(table, row);
    const updates = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');
    await sqlRun(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})
      ON CONFLICT(id) DO UPDATE SET ${updates}`, values(table, row, keys));
  };
  const get = async (table, id) => {
    definition(table);
    const client = cloud();
    const row = client
      ? await cloudResult(client.from(table).select('*').eq('id', id).maybeSingle())
      : await sqlGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return normalizeRecord(table, row);
  };
  const list = async (table) => {
    definition(table);
    const client = cloud();
    const rows = client ? await cloudResult(client.from(table).select('*')) : await sqlAll(`SELECT * FROM ${table}`);
    return (rows || []).map(row => normalizeRecord(table, row));
  };
  const insert = async (table, input) => {
    const row = Object.fromEntries(columns(table, input).map(k => [k, input[k]]));
    const client = cloud();
    if (client) {
      const saved = normalizeRecord(table, await cloudMutation(client, table, 'insert', row));
      if (!saved?.id) throw new DataError(502, 'لم يصل تأكيد السجل المحفوظ. حدّث القائمة قبل إعادة المحاولة.', 'RESULT_UNKNOWN');
      await mirror(table, () => upsertLocal(table, saved));
      return saved;
    }
    const saved = await atomic(async () => {
      const keys = columns(table, row);
      const result = await sqlRun(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, values(table, row, keys));
      const record = await get(table, row.id ?? result.id);
      await audit(table, 'insert', record.id, null, record);
      return record;
    });
    await mirror(table, async () => {});
    return saved;
  };
  const update = async (table, id, input) => {
    const keys = columns(table, input).filter(k => k !== 'id' && k !== 'created_at');
    const patch = Object.fromEntries(keys.map(k => [k, input[k]]));
    const client = cloud();
    let saved;
    if (client) {
      saved = normalizeRecord(table, await cloudMutation(client, table, 'update', patch, id));
    } else {
      saved = await atomic(async () => {
        const before = await get(table, id);
        const result = await sqlRun(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...values(table, patch, keys), id]);
        if (!result.changes) return null;
        const record = await get(table, id);
        await audit(table, 'update', id, before, record);
        return record;
      });
    }
    if (!saved) throw new DataError(404, 'السجل غير موجود. حدّث القائمة.', 'NOT_FOUND');
    await mirror(table, () => client ? upsertLocal(table, saved) : Promise.resolve());
    return saved;
  };
  const remove = async (table, id) => {
    definition(table);
    const client = cloud();
    if (client) {
      await cloudMutation(client, table, 'delete', {}, id);
      await mirror(table, () => sqlRun(`DELETE FROM ${table} WHERE id = ?`, [id]));
    } else {
      await atomic(async () => {
        const before = await get(table, id);
        await sqlRun(`DELETE FROM ${table} WHERE id = ?`, [id]);
        if (before) await audit(table, 'delete', id, before, null);
      });
      await mirror(table, async () => {});
    }
  };
  return { get, list, insert, update, remove };
}
