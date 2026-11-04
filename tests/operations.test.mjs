import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { gzipSync, gunzipSync } from 'node:zlib';
import { startApp, fakeCloud, localRows, fixtures, material, password, photo } from './helpers.mjs';
import { unpackBackup, packBackup, digest } from '../server/backup-format.js';
import { restoreBackup } from '../server/restore-backup.js';

const sql = async (directory, statement) => {
  const db = new sqlite3.Database(path.join(directory, 'project.db'));
  try { await new Promise((resolve, reject) => db.exec(statement, error => error ? reject(error) : resolve())); }
  finally { await new Promise(resolve => db.close(resolve)); }
};
const download = async (app, token) => {
  const response = await fetch(`${app.url}/api/backups/export`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers };
};

test('audit shows real actors, before/after values, password redaction and stable pagination', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const saved = await app.api('/api/materials-consumption', { token, method: 'POST', body: { ...material, actor_name: 'Spoofed user' } });
  await app.api(`/api/materials-consumption/${saved.data.id}`, { token, method: 'PUT', body: { notes: 'After edit' } });
  await app.api(`/api/materials-consumption/${saved.data.id}`, { token, method: 'DELETE' });
  const page = await app.api('/api/audit-events?entity=materials_consumption&limit=2', { token });
  assert.equal(page.status, 200);
  assert.equal(page.data.items.length, 2);
  assert.ok(page.data.next_cursor);
  assert.deepEqual(page.data.items.map(row => row.action), ['delete','update']);
  const edit = page.data.items[1];
  assert.equal(edit.actor_name, 'المدير العام');
  assert.equal(edit.actor_role, 'super_admin');
  assert.ok(edit.request_id);
  assert.equal(edit.before_data.notes, '');
  assert.equal(edit.after_data.notes, 'After edit');
  assert.deepEqual(edit.after_data.site_images, { count: 1 });
  const older = await app.api(`/api/audit-events?entity=materials_consumption&limit=2&cursor=${page.data.next_cursor}`, { token });
  assert.equal(older.data.items.length, 1);
  assert.equal(older.data.items[0].action, 'insert');
  assert.equal(older.data.next_cursor, null);
  const account = await app.api('/api/users', { token, method: 'POST', body: { email: 'audit@test.invalid', password, name: 'Audit engineer', role: 'admin' } });
  const engineer = await app.login('audit@test.invalid');
  const events = await app.api('/api/audit-events?entity=users', { token });
  assert.equal(events.data.items[0].record_id, String(account.data.id));
  assert.equal(events.data.items[0].after_data.password, undefined);
  assert.equal(events.data.items[0].after_data.session_version, undefined);
  assert.doesNotMatch(JSON.stringify(events.data), /scrypt\$|Test-password/);
  assert.equal((await app.api('/api/audit-events', { token: engineer })).status, 403);
  assert.equal((await download(app, engineer)).status, 403);
  assert.equal((await app.api('/api/audit-events?entity=users;drop', { token })).status, 400);
  assert.equal((await app.api('/api/audit-events?cursor=bad', { token })).status, 400);
  assert.equal((await app.api('/api/audit-events', { method: 'DELETE', token })).status, 404);
});

test('audit failure rolls back a local business save and concurrent requests keep their actors', async t => {
  const app = await startApp(t);
  const token = await app.login();
  await sql(app.dataDir, "CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit unavailable'); END;");
  assert.equal((await app.api('/api/materials-consumption', { token, method: 'POST', body: material })).status, 409);
  assert.equal((await localRows(app.dataDir, 'materials_consumption')).length, 0);
  assert.equal((await localRows(app.dataDir, 'audit_events')).length, 0);
  await sql(app.dataDir, 'DROP TRIGGER reject_test_audit;');
  await app.api('/api/users', { token, method: 'POST', body: { email: 'second@test.invalid', password, name: 'Second engineer', role: 'admin' } });
  const second = await app.login('second@test.invalid');
  await Promise.all(Array.from({ length: 8 }, (_, index) => app.api('/api/materials-consumption', {
    token: index % 2 ? second : token, method: 'POST', body: { ...material, prepared_by: index % 2 ? 'Second engineer' : 'المدير العام' },
  }).then(result => assert.equal(result.status, 201))));
  const logs = await app.api('/api/audit-events?entity=materials_consumption', { token });
  assert.equal(logs.data.items.length, 8);
  for (const row of logs.data.items) assert.equal(row.actor_name, row.after_data.prepared_by);
});

test('a local full backup restores records, account access, daily files and handover photos into a new directory', async t => {
  const app = await startApp(t);
  const token = await app.login();
  for (const [route, , body] of fixtures) assert.equal((await app.api(`/api/${route}`, { token, method: 'POST', body })).status, 201);
  assert.equal((await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'With image', media_data: photo } })).status, 201);
  const note = await app.api('/api/handover/notes', { token, method: 'POST', body: {
    level: 'B37', note_type: 'joints', description: 'Backup test note', photos: [{ full: photo, thumb: photo }],
  } });
  assert.equal(note.status, 201, JSON.stringify(note.data));
  const exported = await download(app, token);
  assert.equal(exported.status, 200, exported.bytes.toString());
  assert.equal(exported.headers.get('cache-control'), 'no-store');
  const data = unpackBackup(exported.bytes);
  assert.equal(data.files.length, 3);
  assert.equal(data.handover.notes.length, 1);
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'site-restore-test-'));
  const file = path.join(parent, 'backup.json.gz');
  await fs.writeFile(file, exported.bytes);
  const verified = await restoreBackup(file, null, true);
  assert.equal(verified.verified, true);
  const destination = path.join(parent, 'restored');
  const restored = await restoreBackup(file, destination);
  assert.equal(restored.files, 3);
  await assert.rejects(restoreBackup(file, destination), /EEXIST/);
  const recovered = await startApp(t, { directory: destination });
  const recoveredToken = await recovered.login();
  assert.equal((await recovered.api('/api/me', { token })).status, 401);
  for (const [route] of fixtures) assert.equal((await recovered.api(`/api/${route}`, { token: recoveredToken })).data.length, 1);
  const materials = await recovered.api('/api/materials-consumption', { token: recoveredToken });
  assert.deepEqual(materials.data[0].site_images, [photo]);
  const messages = await recovered.api('/api/daily-updates', { token: recoveredToken });
  const image = messages.data.find(row => row.message_text === 'With image');
  assert.equal((await fetch(recovered.url + image.media_url)).status, 200);
  const notes = await recovered.api('/api/handover/notes', { token: recoveredToken });
  assert.equal(notes.data[0].description, 'Backup test note');
  assert.equal((await fetch(recovered.url + notes.data[0].photos[0].url)).status, 200);
  const audit = await recovered.api('/api/audit-events?entity=handover_notes', { token: recoveredToken });
  assert.equal(audit.data.items[0].actor_role, 'super_admin');
  assert.equal((await fs.stat(path.join(destination, 'RESTORE_COMPLETE.json'))).isFile(), true);
});

test('backup rejects missing attachments, corruption, unsafe paths and unknown tables before creating a restore directory', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const exported = await download(app, token);
  assert.equal(exported.status, 200);
  const data = unpackBackup(exported.bytes);
  const archive = JSON.parse(gunzipSync(exported.bytes));
  archive.payload += ' ';
  assert.throws(() => unpackBackup(gzipSync(JSON.stringify(archive))), /checksum/);
  const invalid = structuredClone(data);
  invalid.tables.unexpected = [];
  assert.throws(() => unpackBackup(packBackup(invalid)), /Unknown backup table/);
  invalid.tables = structuredClone(data.tables);
  invalid.files.push({ path: '../escape.txt', data: Buffer.from('bad').toString('base64'), sha256: digest('bad') });
  assert.throws(() => unpackBackup(packBackup(invalid)), /Invalid backup attachment/);
  const noDirector = structuredClone(data);
  noDirector.tables.users = [];
  assert.throws(() => unpackBackup(packBackup(noDirector)), /general director/);
  await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Missing attachment', media_data: photo } });
  const rows = await localRows(app.dataDir, 'daily_updates');
  const attached = rows.find(row => row.media_url);
  const source = path.join(app.dataDir, 'uploads', path.basename(attached.media_url));
  await fs.rename(source, source + '.hidden');
  assert.equal((await download(app, token)).status, 503);
});

test('cloud audit and snapshots use the primary store, retain all rows and include durable attachments', async t => {
  const cloud = await fakeCloud(t);
  for (let index = 0; index < 1005; index++) cloud.tables.workers_wages.push({ id: index + 1, work_date: '2026-11-03', work_item: `Work ${index}`, shift_price: 1, shifts_count: 1 });
  const app = await startApp(t, { cloud });
  const token = await app.login();
  assert.equal((await app.api('/api/materials-consumption', { token, method: 'POST', body: material })).status, 201);
  const audit = await app.api('/api/audit-events?entity=materials_consumption', { token });
  assert.equal(audit.data.items[0].actor_id, '1');
  assert.equal(audit.data.items[0].actor_role, 'super_admin');
  cloud.fail(r => r.table === 'audit_events' && r.method === 'POST');
  assert.equal((await app.api('/api/materials-consumption', { token, method: 'POST', body: material })).status, 502);
  assert.equal(cloud.tables.materials_consumption.length, 1);
  cloud.fail(() => false);
  await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Cloud file', media_data: photo } });
  const exported = await download(app, token);
  assert.equal(exported.status, 200, exported.bytes.toString());
  const data = unpackBackup(exported.bytes);
  assert.equal(data.mode, 'cloud');
  assert.equal(data.tables.workers_wages.length, 1005);
  assert.equal(data.files.length, 1);
  assert.equal(data.tables.materials_consumption.length, 1);
  cloud.fail(r => r.table === 'app_backup_snapshot');
  assert.equal((await download(app, token)).status, 502);
});
