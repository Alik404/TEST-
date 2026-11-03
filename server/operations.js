import { requireSuperAdmin } from './auth.js';
import { supabase, isSupabaseActive, sqliteAll } from './database.js';
import { cloudResult, DataError } from './persistence.js';
import { handleRecord } from './record-routes.js';
import { createBackup } from './backup.js';
import { DATA_TABLES, HANDOVER_TABLES } from './backup-format.js';

const entities = new Set([...DATA_TABLES.filter(table => table !== 'audit_events'), ...HANDOVER_TABLES]);
const invalid = () => new DataError(400, 'مرشحات سجل التدقيق غير صحيحة.', 'INVALID_FILTER');
let backupRunning = false;
export function registerOperations(app) {
  app.get('/api/audit-events', requireSuperAdmin, handleRecord(async (req, res) => {
    const { entity, action, cursor } = req.query;
    if ((entity && !entities.has(entity)) || (action && !['insert','update','delete'].includes(action))) throw invalid();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    let after;
    if (cursor) {
      try { after = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw invalid(); }
      if (!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|\+00:00)$/.test(after?.created_at || '') || !/^[0-9a-f-]{36}$/.test(after?.id || '')) throw invalid();
    }
    let rows;
    if (isSupabaseActive()) {
      let query = supabase.from('audit_events').select('*');
      if (entity) query = query.eq('entity_table', entity);
      if (action) query = query.eq('action', action);
      if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`);
      rows = await cloudResult(query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1));
    } else {
      const clauses = [], values = [];
      if (entity) { clauses.push('entity_table = ?'); values.push(entity); }
      if (action) { clauses.push('action = ?'); values.push(action); }
      if (after) { clauses.push('(created_at < ? OR (created_at = ? AND id < ?))'); values.push(after.created_at, after.created_at, after.id); }
      rows = await sqliteAll(`SELECT * FROM audit_events ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT ?`, [...values, limit + 1]);
    }
    const items = rows.slice(0, limit).map(row => ({ ...row,
      ...Object.fromEntries(['before_data','after_data','changed_fields'].map(key => [key, typeof row[key] === 'string' ? JSON.parse(row[key]) : row[key]])) }));
    const last = items.at(-1);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items, next_cursor: rows.length > limit ? Buffer.from(JSON.stringify({ id: last.id, created_at: last.created_at })).toString('base64url') : null });
  }));
  app.post('/api/backups/export', requireSuperAdmin, handleRecord(async (req, res) => {
    if (backupRunning) throw new DataError(409, 'يجري إنشاء نسخة احتياطية. انتظر اكتمالها ثم أعد المحاولة.', 'BACKUP_BUSY');
    backupRunning = true;
    try {
      const buffer = await createBackup();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="site-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz"`);
      res.send(buffer);
    } catch (error) {
      if (error instanceof DataError) throw error;
      console.error('Backup failed:', error.message);
      throw new DataError(503, 'تعذّر إنشاء نسخة كاملة. تحقق من إعدادات الجداول ووجود المرفقات ثم أعد المحاولة.', 'BACKUP_INCOMPLETE');
    } finally { backupRunning = false; }
  }));
}
