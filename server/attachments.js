import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dataRoot } from './config.js';
import { supabase, isSupabaseActive } from './database.js';
import { parseUpload } from './auth.js';
import { cloudResult } from './persistence.js';

const BUCKET = 'daily-attachments';
const PREFIX = `storage:${BUCKET}/`;
const LOCAL_PREFIX = '/api/uploads/';
const LOCAL_KEY = process.env.AUTH_SECRET || crypto.randomBytes(48).toString('hex');
const LOCAL_TTL = 15 * 60;
export const SAFE_ATTACHMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|webm|mov|3gp|mp3|m4a|ogg|wav)$/;
const localSignature = (name, exp) => crypto.createHmac('sha256', LOCAL_KEY)
  .update(`daily-attachment:${name}:${exp}`).digest('hex');

export function verifyLocalAttachment(name, exp, sig) {
  if (!SAFE_ATTACHMENT_NAME.test(name) || !/^\d+$/.test(String(exp)) || typeof sig !== 'string') return false;
  const expires = Number(exp), now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + LOCAL_TTL) return false;
  const expected = localSignature(name, expires);
  return /^[0-9a-f]{64}$/.test(sig) && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const localAttachmentUrl = (url) => {
  if (!url?.startsWith(LOCAL_PREFIX)) return url;
  const name = url.slice(LOCAL_PREFIX.length);
  if (!SAFE_ATTACHMENT_NAME.test(name)) return null;
  const exp = Math.floor(Date.now() / 1000) + LOCAL_TTL;
  return `${LOCAL_PREFIX}${name}?exp=${exp}&sig=${localSignature(name, exp)}`;
};

export async function saveDailyAttachment(data) {
  const upload = parseUpload(data);
  const filename = `${crypto.randomUUID()}.${upload.extension}`;
  if (isSupabaseActive()) {
    const mime = String(data).slice(5, String(data).indexOf(';base64,'));
    await cloudResult(supabase.storage.from(BUCKET).upload(filename, upload.buffer, { contentType: mime, upsert: false }), 30000);
    return { media_url: PREFIX + filename, media_type: upload.kind };
  }
  const directory = path.join(dataRoot, 'uploads');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), upload.buffer);
  return { media_url: `/api/uploads/${filename}`, media_type: upload.kind };
}

export async function shapeDailyMessages(rows) {
  const byId = new Map(rows.map(row => [String(row.id), row]));
  const urls = new Map();
  for (const row of rows) {
    if (!row.media_url?.startsWith(PREFIX) || urls.has(row.media_url)) continue;
    const data = await cloudResult(supabase.storage.from(BUCKET).createSignedUrl(row.media_url.slice(PREFIX.length), 3600));
    urls.set(row.media_url, data.signedUrl);
  }
  return rows.map(row => {
    const reply = byId.get(String(row.reply_to_id));
    return {
      ...row, media_url: urls.get(row.media_url) || localAttachmentUrl(row.media_url),
      reply_sender_name: reply?.sender_name || null,
      reply_message_text: reply?.message_text || null,
      reply_media_url: urls.get(reply?.media_url) || localAttachmentUrl(reply?.media_url) || null,
      reply_media_type: reply?.media_type || null,
    };
  });
}
