import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const DATA_TABLES = ['users', 'categories', 'tasks', 'sub_units', 'marble_distribution', 'daily_updates',
  'materials_consumption', 'workers_wages', 'weekly_advance', 'marblex_progress', 'joints_daily', 'audit_events'];
export const HANDOVER_TABLES = ['handover_notes', 'handover_counters', 'handover_settings', 'handover_receipts'];
export const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
export const digest = data => crypto.createHash('sha256').update(data).digest('hex');

export const safeBackupPath = name => typeof name === 'string' && (
  /^uploads\/[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|webm|mov|3gp|mp3|m4a|ogg|wav)$/.test(name)
  || /^handover_local\/notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}(_t)?\.jpg$/.test(name));

export function attachmentReferences(tables, handover) {
  const refs = new Map();
  for (const row of tables.daily_updates) {
    if (!row.media_url) continue;
    let filename, bucket;
    if (row.media_url.startsWith('storage:daily-attachments/')) {
      filename = row.media_url.slice('storage:daily-attachments/'.length); bucket = 'daily-attachments';
    } else if (row.media_url.startsWith('/api/uploads/')) filename = row.media_url.slice('/api/uploads/'.length);
    else throw new Error('Unsupported attachment reference in daily updates.');
    const name = `uploads/${filename}`;
    if (!safeBackupPath(name)) throw new Error('Unsafe attachment path.');
    refs.set(name, { name, bucket, object: filename });
  }
  for (const note of handover.notes) {
    for (const photo of note.photos || []) {
      for (const object of [photo.path, photo.thumb].filter(Boolean)) {
        const name = `handover_local/${object}`;
        if (!safeBackupPath(name)) throw new Error('Unsafe handover photo path.');
        refs.set(name, { name, bucket: 'handover-photos', object });
      }
    }
  }
  return refs;
}

export function packBackup(data) {
  const payload = JSON.stringify(data);
  const archive = JSON.stringify({ format: 'site-backup', version: 1, sha256: digest(payload), payload });
  if (Buffer.byteLength(archive) > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the supported size (128 MiB).');
  return gzipSync(archive);
}

export function unpackBackup(buffer) {
  if (buffer.length > MAX_BACKUP_BYTES) throw new Error('Backup file is too large.');
  const archive = JSON.parse(gunzipSync(buffer, { maxOutputLength: MAX_BACKUP_BYTES }).toString('utf8'));
  if (archive.format !== 'site-backup' || archive.version !== 1 || typeof archive.payload !== 'string' || digest(archive.payload) !== archive.sha256) {
    throw new Error('Backup format or checksum is invalid.');
  }
  const data = JSON.parse(archive.payload);
  if (!['local', 'cloud'].includes(data.mode) || !data.tables || !data.handover || !Array.isArray(data.files)) throw new Error('Incomplete backup.');
  if (Object.keys(data.tables).some(table => !DATA_TABLES.includes(table))) throw new Error('Unknown backup table.');
  for (const table of DATA_TABLES) {
    if (!Array.isArray(data.tables[table]) || data.tables[table].some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(`Invalid backup table: ${table}`);
  }
  if (!Array.isArray(data.handover.notes) || !Array.isArray(data.handover.receipts) || !data.handover.settings || !data.handover.counters) throw new Error('Invalid handover backup.');
  if (!data.tables.users.some(user => user.role === 'super_admin')) throw new Error('Backup must contain a general director.');
  const refs = attachmentReferences(data.tables, data.handover);
  const seen = new Set();
  for (const file of data.files) {
    if (!safeBackupPath(file.path) || !refs.has(file.path) || seen.has(file.path) || typeof file.data !== 'string'
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw new Error('Invalid backup attachment.');
    const bytes = Buffer.from(file.data, 'base64');
    if (!bytes.length || bytes.length > 12 * 1024 * 1024 || digest(bytes) !== file.sha256) throw new Error('Attachment checksum or size is invalid.');
    seen.add(file.path);
  }
  if (seen.size !== refs.size) throw new Error('Backup is missing required attachments.');
  return data;
}
