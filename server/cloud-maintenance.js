import './config.js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, isHashed } from './auth.js';
import { cloudResult } from './persistence.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|webm|mov|3gp|mp3|m4a|ogg|wav)$/;
const mimeFor = (name, kind) => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  webm: kind === 'audio' ? 'audio/webm' : 'video/webm', mp4: 'video/mp4', mov: 'video/quicktime',
  '3gp': 'video/3gpp', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
})[name.split('.').at(-1)];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hasMediaHeader = (bytes, filename) => {
  const extension = filename.split('.').at(-1);
  const starts = values => bytes.subarray(0, values.length).equals(Buffer.from(values));
  if (extension === 'webm') return starts([0x1a, 0x45, 0xdf, 0xa3]);
  if (extension === 'jpg' || extension === 'jpeg') return starts([0xff, 0xd8, 0xff]);
  if (extension === 'png') return starts([137,80,78,71,13,10,26,10]);
  if (extension === 'gif') return /^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii'));
  if (extension === 'webp') return bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (['mp4','mov','m4a','3gp','heic','heif'].includes(extension)) return /^(ftyp|moov|mdat|wide)$/.test(bytes.subarray(4,8).toString());
  if (extension === 'ogg') return bytes.subarray(0,4).toString() === 'OggS';
  if (extension === 'wav') return bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE';
  if (extension === 'mp3') return bytes.subarray(0,3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  return false;
};

export async function upgradeLegacyPasswords(client) {
  const accounts = await cloudResult(client.from('users').select('id,password,session_version'));
  let upgraded = 0, changedConcurrently = 0;
  for (const account of accounts) {
    if (isHashed(account.password)) continue;
    if (typeof account.password !== 'string' || !account.password) throw new Error('Invalid legacy password; use account recovery.');
    const data = { password: await hashPassword(account.password), session_version: crypto.randomUUID() };
    const saved = await cloudResult(client.rpc('app_mutate_record', {
      p_table: 'users', p_action: 'update', p_data: data, p_id: String(account.id),
      p_actor: { id: null, name: 'صيانة الأمان', role: 'system', request_id: crypto.randomUUID() },
      p_expected: { session_version: account.session_version },
    }));
    if (saved) upgraded++; else changedConcurrently++;
  }
  return { upgraded, changedConcurrently };
}

// Missing files are reported and their database references are retained.
// An object must download with the exact original bytes before references move.
export async function migrateLegacyAttachments(client, uploadsDirectory) {
  const rows = await cloudResult(client.from('daily_updates').select('id,media_url,media_type').like('media_url', '/api/uploads/%'));
  const urls = new Map(rows.filter(row => row.media_url?.startsWith('/api/uploads/')).map(row => [row.media_url, row]));
  const result = { migratedFiles: 0, migratedReferences: 0, missingFiles: [], invalidFiles: [] };
  const root = path.resolve(uploadsDirectory);
  for (const [url, row] of urls) {
    const filename = url.slice('/api/uploads/'.length);
    if (!SAFE_NAME.test(filename)) throw new Error('Unsafe legacy attachment name.');
    let bytes;
    try {
      const actual = await fs.realpath(path.join(root, filename));
      const actualRoot = await fs.realpath(root);
      if (!actual.startsWith(actualRoot + path.sep)) throw new Error('Legacy attachment leaves its directory.');
      bytes = await fs.readFile(actual);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      result.missingFiles.push(filename); continue;
    }
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error('Invalid legacy attachment size.');
    if (!hasMediaHeader(bytes, filename)) { result.invalidFiles.push(filename); continue; }
    const storage = client.storage.from('daily-attachments');
    const uploaded = await storage.upload(filename, bytes, { contentType: mimeFor(filename, row.media_type), upsert: false });
    if (uploaded.error && !['409','Duplicate'].includes(String(uploaded.error.statusCode || uploaded.error.error))
      && !/already exists|duplicate/i.test(uploaded.error.message || '')) throw new Error('Legacy upload failed.');
    const blob = await cloudResult(storage.download(filename), 30000);
    if (digest(Buffer.from(await blob.arrayBuffer())) !== digest(bytes)) throw new Error('Uploaded attachment did not verify; reference retained.');
    const moved = await cloudResult(client.from('daily_updates').update({ media_url: `storage:daily-attachments/${filename}` })
      .eq('media_url', url).select('id'));
    result.migratedFiles++;
    result.migratedReferences += moved.length;
  }
  return result;
}

export async function saveEncryptedSnapshot(client, directory) {
  const snapshot = await cloudResult(client.rpc('app_backup_snapshot'), 30000);
  if (!snapshot?.tables?.users || !snapshot.tables.audit_events) throw new Error('Incomplete recovery snapshot.');
  await fs.mkdir(directory, { recursive: true });
  const basename = `before-maintenance-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))), cipher.final()]);
  await fs.writeFile(path.join(directory, `${basename}.key`), key.toString('hex'), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(directory, `${basename}.json.gz.enc`), Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), { flag: 'wx', mode: 0o600 });
  return { snapshot: basename, tables: Object.keys(snapshot.tables).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--apply')) {
    console.log('Usage: node server/cloud-maintenance.js --apply [--uploads DIRECTORY]');
  } else {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) throw new Error('Supabase server configuration is required.');
      const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } });
      const index = process.argv.indexOf('--uploads');
      const uploads = index < 0 ? path.join(process.env.APP_DATA_DIR || path.join(projectRoot, 'server'), 'uploads') : process.argv[index + 1];
      if (!uploads) throw new Error('Missing uploads directory.');
      const recovery = await saveEncryptedSnapshot(client, path.join(projectRoot, '.private-backups'));
      const passwords = await upgradeLegacyPasswords(client);
      const attachments = await migrateLegacyAttachments(client, uploads);
      console.log(JSON.stringify({ recovery, passwords, attachments }));
    } catch (error) { console.error('Maintenance failed:', error.message); process.exitCode = 1; }
  }
}
