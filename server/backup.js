import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { dataRoot } from './config.js';
import { supabase, isSupabaseActive } from './database.js';
import { readHandoverLocal } from './handover.js';
import { cloudResult, DataError } from './persistence.js';
import { DATA_TABLES, attachmentReferences, MAX_BACKUP_BYTES, digest, packBackup } from './backup-format.js';

export const sqliteCall = (db, method, sql, params = []) => new Promise((resolve, reject) => {
  db[method](sql, params, function (error, rows) { if (error) reject(error); else resolve(rows ?? { changes: this.changes }); });
});

export async function createBackup() {
  const mode = isSupabaseActive() ? 'cloud' : 'local';
  let tables, handover, captured_at;
  if (mode === 'cloud') {
    const snapshot = await cloudResult(supabase.rpc('app_backup_snapshot'), 30000);
    if (!snapshot?.tables || DATA_TABLES.some(table => !Array.isArray(snapshot.tables[table]))) throw new Error('Incomplete cloud snapshot.');
    tables = Object.fromEntries(DATA_TABLES.map(table => [table, snapshot.tables[table]]));
    const source = snapshot.tables;
    for (const table of ['handover_notes', 'handover_receipts', 'handover_counters', 'handover_settings']) {
      if (!Array.isArray(source[table])) throw new Error(`Incomplete snapshot: ${table}`);
    }
    handover = { notes: source.handover_notes, receipts: source.handover_receipts,
      settings: Object.fromEntries(source.handover_settings.map(row => [row.key, row.value])),
      counters: Object.fromEntries(source.handover_counters.map(row => [`${row.level}|${row.kind}`, row.last_value])) };
    captured_at = snapshot.captured_at;
  } else {
    // A separate read transaction sees one SQLite snapshot without enlisting
    // concurrent API writes in its transaction.
    const db = new sqlite3.Database(path.join(dataRoot, 'project.db'), sqlite3.OPEN_READONLY);
    try {
      await sqliteCall(db, 'run', 'BEGIN');
      tables = {};
      for (const table of DATA_TABLES) tables[table] = await sqliteCall(db, 'all', `SELECT * FROM ${table}`);
      const stored = await sqliteCall(db, 'get', 'SELECT data FROM handover_state WHERE id = 1');
      handover = stored?.data ? JSON.parse(stored.data) : await readHandoverLocal();
      await sqliteCall(db, 'run', 'COMMIT');
      captured_at = new Date().toISOString();
    } finally { await new Promise(resolve => db.close(resolve)); }
  }
  // Normalize JSON columns, including legacy SQLite strings.
  for (const [table, keys] of Object.entries({ materials_consumption: ['basics','marble','sealants','bulk','site_images'],
    weekly_advance: ['data'], joints_daily: ['data'], audit_events: ['before_data','after_data','changed_fields'] })) {
    tables[table] = tables[table].map(row => ({ ...row, ...Object.fromEntries(keys.map(key => [key,
      typeof row[key] === 'string' ? JSON.parse(row[key]) : row[key]])) }));
  }
  let size = Buffer.byteLength(JSON.stringify({ tables, handover }));
  const files = [];
  for (const ref of attachmentReferences(tables, handover).values()) {
    let bytes;
    if (mode === 'cloud' && ref.bucket) {
      const blob = await cloudResult(supabase.storage.from(ref.bucket).download(ref.object), 30000);
      bytes = Buffer.from(await blob.arrayBuffer());
    } else {
      const actual = await fs.realpath(path.join(dataRoot, ref.name));
      const root = await fs.realpath(dataRoot);
      if (!actual.startsWith(root + path.sep)) throw new Error('Attachment leaves the data directory.');
      bytes = await fs.readFile(actual);
    }
    size += Math.ceil(bytes.length / 3) * 4;
    if (size > MAX_BACKUP_BYTES / 2) throw new DataError(413, 'حجم النسخة كبير لهذا التنزيل. استخدم نسخ قاعدة البيانات وStorage لدى مزوّد الاستضافة.', 'BACKUP_TOO_LARGE');
    files.push({ path: ref.name, sha256: digest(bytes), data: bytes.toString('base64') });
  }
  return packBackup({ captured_at, mode, tables, handover, files });
}
