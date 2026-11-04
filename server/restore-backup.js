import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sqlite3 from 'sqlite3';
import { DATA_TABLES, MAX_BACKUP_BYTES, unpackBackup } from './backup-format.js';

const call = (db, method, sql, params = []) => new Promise((resolve, reject) => {
  db[method](sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});
export async function restoreBackup(file, destination, verifyOnly = false) {
  const size = (await fs.stat(file)).size;
  if (size > MAX_BACKUP_BYTES) throw new Error('Backup is too large.');
  const data = unpackBackup(await fs.readFile(file));
  const counts = Object.fromEntries(DATA_TABLES.map(table => [table, data.tables[table].length]));
  if (verifyOnly) return { verified: true, counts, files: data.files.length };
  if (!destination) throw new Error('Provide a new destination directory with --to.');
  const target = path.resolve(destination);
  // mkdir is exclusive: an existing directory is never overwritten, even empty.
  await fs.mkdir(target);
  const initialized = spawnSync(process.execPath, [fileURLToPath(new URL('./restore-init.js', import.meta.url))], {
    windowsHide: true, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, NODE_ENV: 'test', APP_DATA_DIR: target, SUPABASE_URL: '', SUPABASE_KEY: '',
      AUTH_SECRET: crypto.randomBytes(48).toString('hex'), INITIAL_ADMIN_EMAIL: 'restore-init@test.invalid', INITIAL_ADMIN_PASSWORD: crypto.randomUUID() },
  });
  if (initialized.status !== 0) throw new Error(`Could not prepare the restore directory: ${initialized.stderr || initialized.error?.message}`);
  const db = new sqlite3.Database(path.join(target, 'project.db'));
  try {
    await call(db, 'run', 'BEGIN IMMEDIATE');
    for (const table of [...DATA_TABLES].reverse()) await call(db, 'run', `DELETE FROM ${table}`);
    for (const table of DATA_TABLES) {
      const allowed = new Set((await call(db, 'all', `PRAGMA table_info(${table})`)).map(column => column.name));
      for (const original of data.tables[table]) {
        const row = { ...original };
        if (table === 'users') row.session_version = crypto.randomUUID();
        if (table === 'daily_updates' && row.media_url?.startsWith('storage:daily-attachments/')) row.media_url = `/api/uploads/${row.media_url.slice('storage:daily-attachments/'.length)}`;
        const keys = Object.keys(row);
        if (!keys.length || keys.some(key => !allowed.has(key))) throw new Error(`Unsupported columns in ${table}. Use a matching application version.`);
        const values = keys.map(key => row[key] && typeof row[key] === 'object' ? JSON.stringify(row[key]) : typeof row[key] === 'boolean' ? Number(row[key]) : row[key]);
        await call(db, 'run', `INSERT INTO ${table} (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, values);
      }
    }
    await call(db, 'run', 'INSERT INTO handover_state(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [JSON.stringify(data.handover)]);
    for (const file of data.files) {
      const targetFile = path.join(target, file.path);
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.writeFile(targetFile, Buffer.from(file.data, 'base64'), { flag: 'wx' });
    }
    const integrity = await call(db, 'get', 'PRAGMA integrity_check');
    if (integrity.integrity_check !== 'ok') throw new Error('Restored database failed its integrity check.');
    const foreignKeys = await call(db, 'all', 'PRAGMA foreign_key_check');
    if (foreignKeys.length) throw new Error('Restored database contains invalid relations.');
    await call(db, 'run', 'COMMIT');
  } catch (error) {
    await call(db, 'run', 'ROLLBACK');
    await fs.writeFile(path.join(target, 'RESTORE_FAILED.txt'), 'Restore did not complete. Do not use this directory.\n');
    throw error;
  } finally { await new Promise(resolve => db.close(resolve)); }
  await fs.writeFile(path.join(target, 'RESTORE_COMPLETE.json'), JSON.stringify({ restored_at: new Date().toISOString(), source_at: data.captured_at, counts, files: data.files.length }, null, 2));
  return { destination: target, counts, files: data.files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--'));
  const toIndex = args.indexOf('--to');
  if (!file || args.includes('--help')) {
    console.log('Usage: npm run backup:restore -- backup.json.gz --verify\n       npm run backup:restore -- backup.json.gz --to NEW_DIRECTORY');
  } else {
    try { console.log(JSON.stringify(await restoreBackup(file, toIndex < 0 ? null : args[toIndex + 1], args.includes('--verify')), null, 2)); }
    catch (error) { console.error('Restore failed:', error.message); process.exitCode = 1; }
  }
}
