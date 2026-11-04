import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseReady, closeDatabase } from './database.js';
import { createBackup } from './backup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  await databaseReady;
  const archive = await createBackup();
  const target = path.resolve(process.argv[2] || path.join(root, '.private-backups', `site-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, archive, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ file: target, bytes: archive.length }));
} catch (error) {
  console.error('Complete backup failed:', error.message);
  process.exitCode = 1;
} finally { await closeDatabase(); }
