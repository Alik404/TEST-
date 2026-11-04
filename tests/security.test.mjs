import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { startApp, fakeCloud, photo } from './helpers.mjs';
import { safeBackupPath } from '../server/backup-format.js';

// Set isolation before importing modules that resolve server configuration.
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'security-config-test-'));
process.env.AUTH_SECRET = 'isolated-security-test-secret-longer-than-thirty-two-characters';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
const { upgradeLegacyPasswords, migrateLegacyAttachments } = await import('../server/cloud-maintenance.js');
const { verifyPassword } = await import('../server/auth.js');

test('local attachments require authentication or an unexpired signature bound to the file', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const posted = await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Private photo', media_data: photo } });
  assert.equal(posted.status, 201);
  const signed = new URL(posted.data.media_url, app.url);
  assert.ok(signed.searchParams.has('sig'));
  assert.equal((await fetch(signed)).status, 200);
  const bare = new URL(signed); bare.search = '';
  assert.equal((await fetch(bare)).status, 401);
  assert.equal((await fetch(bare, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  const expired = new URL(signed); expired.searchParams.set('exp', '1');
  assert.equal((await fetch(expired)).status, 401);
  const tampered = new URL(signed); tampered.searchParams.set('sig', '0'.repeat(64));
  assert.equal((await fetch(tampered)).status, 401);
  const copied = new URL(signed); copied.pathname = '/api/uploads/another.jpg';
  assert.equal((await fetch(copied)).status, 401);
  assert.equal((await fetch(signed)).headers.get('cache-control'), 'private, no-store');
});

test('legacy password maintenance preserves passwords, revokes old sessions and is repeatable', async t => {
  const cloud = await fakeCloud(t);
  cloud.tables.users[1].password = 'Legacy-test-password';
  const before = cloud.tables.users[1].session_version;
  const directorHash = cloud.tables.users[0].password;
  const client = createClient(cloud.url, 'test-key');
  assert.deepEqual(await upgradeLegacyPasswords(client), { upgraded: 1, changedConcurrently: 0 });
  assert.notEqual(cloud.tables.users[1].session_version, before);
  assert.equal((await verifyPassword('Legacy-test-password', cloud.tables.users[1].password)).ok, true);
  assert.equal(cloud.tables.users[0].password, directorHash);
  assert.deepEqual(await upgradeLegacyPasswords(client), { upgraded: 0, changedConcurrently: 0 });
  assert.equal(cloud.tables.audit_events[0].after_data.password, undefined);
});

test('legacy attachment migration verifies bytes, moves duplicate references, and retains missing references', async t => {
  const cloud = await fakeCloud(t);
  cloud.tables.daily_updates = [{ id: 1, media_url: '/api/uploads/present.webm', media_type: 'audio' },
    { id: 2, media_url: '/api/uploads/present.webm', media_type: 'audio' },
    { id: 3, media_url: '/api/uploads/missing.jpg', media_type: 'image' },
    { id: 4, media_url: '/api/uploads/broken.webm', media_type: 'audio' }];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-media-test-'));
  await fs.writeFile(path.join(directory, 'present.webm'), Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]), Buffer.from('verified legacy media')]));
  await fs.writeFile(path.join(directory, 'broken.webm'), Buffer.from('not valid media'));
  const client = createClient(cloud.url, 'test-key');
  assert.deepEqual(await migrateLegacyAttachments(client, directory), {
    migratedFiles: 1, migratedReferences: 2, missingFiles: ['missing.jpg'], invalidFiles: ['broken.webm'],
  });
  assert.equal(cloud.tables.daily_updates[0].media_url, 'storage:daily-attachments/present.webm');
  assert.equal(cloud.tables.daily_updates[1].media_url, 'storage:daily-attachments/present.webm');
  assert.equal(cloud.tables.daily_updates[2].media_url, '/api/uploads/missing.jpg');
  assert.equal(cloud.tables.daily_updates[3].media_url, '/api/uploads/broken.webm');
  assert.equal((await migrateLegacyAttachments(client, directory)).migratedFiles, 0);
  assert.ok(safeBackupPath('uploads/camera.heic'));
  assert.ok(safeBackupPath('uploads/camera.heif'));
});

test('a failed attachment verification never updates the legacy database reference', async t => {
  const cloud = await fakeCloud(t);
  cloud.tables.daily_updates = [{ id: 1, media_url: '/api/uploads/photo.jpg', media_type: 'image' }];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-failure-test-'));
  await fs.writeFile(path.join(directory, 'photo.jpg'), Buffer.concat([Buffer.from([255,216,255]), Buffer.from('legacy photo')]));
  cloud.fail(request => request.method === 'GET' && request.path.startsWith('/storage/'));
  await assert.rejects(migrateLegacyAttachments(createClient(cloud.url, 'test-key'), directory));
  assert.equal(cloud.tables.daily_updates[0].media_url, '/api/uploads/photo.jpg');
});
