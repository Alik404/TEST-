import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startApp, fakeCloud, localRows, password, material, photo, fixtures } from './helpers.mjs';
import { cloudResult, createPersistence } from '../server/persistence.js';

test('local saves survive restart, retain photos, and identify local mode', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const ids = {};
  for (const [route, table, body] of fixtures) {
    const result = await app.api(`/api/${route}`, { token, method: 'POST', body });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.mode, 'local');
    assert.ok(result.data.id);
    ids[route] = result.data.id;
    assert.equal((await localRows(app.dataDir, table)).length, 1);
  }
  await app.close();
  const restarted = await startApp(t, { directory: app.dataDir });
  const newToken = await restarted.login();
  const mats = await restarted.api('/api/materials-consumption', { token: newToken });
  assert.deepEqual(mats.data[0].site_images, [photo]);
  assert.equal(mats.data[0].basics_notes, material.basics_notes);
  const updated = await restarted.api(`/api/materials-consumption/${ids['materials-consumption']}`, {
    token: newToken, method: 'PUT', body: { ...material, site_images: [photo, photo], basics_notes: 'Changed notes' },
  });
  assert.equal(updated.status, 200);
  const reread = await restarted.api('/api/materials-consumption', { token: newToken });
  assert.equal(reread.data[0].site_images.length, 2);
  assert.equal(reread.data[0].basics_notes, 'Changed notes');
  for (const [route, table] of fixtures) {
    const result = await restarted.api(`/api/${route}/${ids[route]}`, { token: newToken, method: 'DELETE' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal((await localRows(app.dataDir, table)).length, 0);
  }
});

test('sessions are revoked on role, password and account changes, with enforced roles', async t => {
  const app = await startApp(t);
  const director = await app.login();
  const user = { email: 'engineer@test.invalid', password, name: 'Engineer', role: 'admin' };
  const created = await app.api('/api/users', { token: director, method: 'POST', body: user });
  assert.equal(created.status, 201);
  assert.equal(created.data.password, undefined);
  assert.equal(created.data.session_version, undefined);
  const id = created.data.id;
  const engineer = await app.login(user.email);
  assert.equal((await app.api('/api/users', { token: engineer })).status, 403);
  assert.equal((await app.api(`/api/users/${id}`, { token: director, method: 'PUT', body: { ...user, password: '', role: 'viewer' } })).status, 200);
  assert.equal((await app.api('/api/me', { token: engineer })).status, 401);
  const viewer = await app.login(user.email);
  assert.equal((await app.api('/api/materials-consumption', { token: viewer, method: 'POST', body: material })).status, 403);
  assert.equal((await app.api('/api/weekly-advance', { token: viewer, method: 'POST', body: fixtures[2][2] })).status, 403);
  // Returning to the former role must not revive its earlier token.
  await app.api(`/api/users/${id}`, { token: director, method: 'PUT', body: { ...user, password: '' } });
  assert.equal((await app.api('/api/me', { token: engineer })).status, 401);
  const beforePassword = await app.login(user.email);
  const changedPassword = 'A-different-password-456';
  await app.api(`/api/users/${id}`, { token: director, method: 'PUT', body: { ...user, password: changedPassword } });
  assert.equal((await app.api('/api/me', { token: beforePassword })).status, 401);
  const afterPassword = await app.login(user.email, changedPassword);
  await app.api(`/api/users/${id}`, { token: director, method: 'DELETE' });
  assert.equal((await app.api('/api/me', { token: afterPassword })).status, 401);
  assert.equal((await app.api('/api/users', { token: director, method: 'POST', body: { ...user, role: 'owner' } })).status, 400);
  const me = await app.api('/api/me', { token: director });
  assert.equal((await app.api(`/api/users/${me.data.user.id}`, { token: director, method: 'DELETE' })).status, 400);
  assert.equal((await app.api(`/api/users/${me.data.user.id}`, { token: director, method: 'PUT', body: { ...me.data.user, role: 'viewer' } })).status, 400);
});

test('cloud create/update/delete failures do not change SQLite or JSON mirrors', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const token = await app.login();
  for (const [route, table, body] of fixtures) {
    const before = await localRows(app.dataDir, table);
    cloud.fail(r => r.table === table && r.method === 'POST');
    const rejected = await app.api(`/api/${route}`, { token, method: 'POST', body });
    assert.equal(rejected.status, 502, JSON.stringify(rejected.data));
    assert.deepEqual(await localRows(app.dataDir, table), before);
    assert.equal(cloud.tables[table].length, 0);
    cloud.fail(() => false);
    const created = await app.api(`/api/${route}`, { token, method: 'POST', body });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.mode, 'cloud');
    const id = created.data.id;
    const diskBefore = await localRows(app.dataDir, table);
    const jsonPath = path.join(app.dataDir, 'data', `${table}.json`);
    const jsonBefore = await fs.readFile(jsonPath, 'utf8');
    cloud.fail(r => r.table === table && ['PATCH', 'DELETE'].includes(r.method));
    for (const method of ['PUT', 'DELETE']) {
      const result = await app.api(`/api/${route}/${id}`, { token, method, body: method === 'PUT' ? body : undefined });
      assert.equal(result.status, 502, JSON.stringify(result.data));
      assert.deepEqual(await localRows(app.dataDir, table), diskBefore);
      assert.equal(await fs.readFile(jsonPath, 'utf8'), jsonBefore);
      assert.equal(cloud.tables[table].length, 1);
    }
    cloud.fail(() => false);
    assert.equal((await app.api(`/api/${route}/${id}`, { token, method: 'PUT', body })).status, 200);
    assert.equal((await app.api(`/api/${route}/${id}`, { token, method: 'DELETE' })).status, 200);
    assert.equal(cloud.tables[table].length, 0);
  }
});

test('daily messages are inserted once, return the cloud ID, and attachments use durable storage', async t => {
  const cloud = await fakeCloud(t);
  cloud.tables.daily_updates.push({ id: 100, sender_name: 'Prior author', message_text: 'Prior message', created_at: '2026-01-01T00:00:00Z' });
  const app = await startApp(t, { cloud });
  const token = await app.login();
  const before = cloud.calls.filter(r => r.table === 'daily_updates' && r.method === 'POST').length;
  const posted = await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Only once', media_data: photo, reply_to_id: 100 } });
  assert.equal(posted.status, 201, JSON.stringify(posted.data));
  assert.equal(cloud.calls.filter(r => r.table === 'daily_updates' && r.method === 'POST').length - before, 1);
  assert.equal(posted.data.id, 101);
  assert.equal(posted.data.reply_sender_name, 'Prior author');
  assert.equal(cloud.objects.size, 1);
  assert.match(cloud.tables.daily_updates[1].media_url, /^storage:daily-attachments\//);
  assert.match(posted.data.media_url, /\/storage\/v1\/object\/sign\//);
  const mirrored = (await localRows(app.dataDir, 'daily_updates')).find(r => r.id === 101);
  assert.equal(mirrored.message_text, 'Only once');
  const list = await app.api('/api/daily-updates', { token });
  assert.equal(list.data[1].reply_sender_name, 'Prior author');
  assert.equal(list.data[1].reply_message_text, 'Prior message');
  await app.close();
  const restarted = await startApp(t, { cloud });
  const newToken = await restarted.login();
  const persisted = await restarted.api('/api/daily-updates', { token: newToken });
  assert.equal(persisted.data.filter(r => r.message_text === 'Only once').length, 1);
  assert.match(persisted.data.find(r => r.id === 101).media_url, /\/object\/sign\//);
});

test('cloud authentication fails closed and cannot use a stale local account', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const token = await app.login();
  cloud.tables.users = cloud.tables.users.filter(u => u.id !== 1);
  assert.equal((await app.api('/api/me', { token })).status, 401);
  assert.equal((await localRows(app.dataDir, 'users')).some(u => u.id === 1), true);
  const login = await app.api('/api/login', { method: 'POST', body: { email: 'super_admin@test.invalid', password } });
  assert.equal(login.status, 401);
  cloud.fail(r => r.table === 'users' && r.method === 'GET');
  assert.equal((await app.api('/api/me', { token })).status, 502);
  assert.equal((await app.api('/api/login', { method: 'POST', body: { email: 'super_admin@test.invalid', password } })).status, 502);
});

test('primary cloud success remains success if the local cache is unavailable', async () => {
  const saved = { id: 42, work_date: '2026-11-03', work_item: 'Saved in cloud' };
  let attempts = 0;
  const store = createPersistence({
    cloud: () => ({ rpc: async () => { attempts++; return { data: saved, error: null }; } }),
    sqlGet: async () => null, sqlAll: async () => [],
    sqlRun: async () => { throw new Error('Disk unavailable'); }, saveJson: () => false,
  });
  assert.deepEqual(await store.insert('workers_wages', saved), saved);
  assert.equal(attempts, 1);
});

test('a timeout reports an unknown result instead of claiming an unsaved operation', async () => {
  await assert.rejects(cloudResult(new Promise(() => {}), 20), error => error.status === 504 && error.code === 'RESULT_UNKNOWN');
});

test('failed cloud account changes preserve accounts and sessions, confirmed changes revoke them', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const director = await app.login();
  const engineer = await app.login('admin@test.invalid');
  const beforeLocal = await localRows(app.dataDir, 'users');
  const beforeCloud = structuredClone(cloud.tables.users);
  cloud.fail(r => r.table === 'users' && r.method !== 'GET');
  const body = { name: 'Changed engineer', email: 'admin@test.invalid', role: 'viewer', password };
  for (const [method, route, input] of [
    ['POST', '/api/users', { ...body, email: 'new@test.invalid' }],
    ['PUT', '/api/users/2', body], ['DELETE', '/api/users/2'],
  ]) {
    assert.equal((await app.api(route, { token: director, method, body: input })).status, 502);
    assert.deepEqual(await localRows(app.dataDir, 'users'), beforeLocal);
    assert.deepEqual(cloud.tables.users, beforeCloud);
    assert.equal((await app.api('/api/me', { token: engineer })).status, 200);
  }
  cloud.fail(() => false);
  assert.equal((await app.api('/api/users/2', { token: director, method: 'PUT', body })).status, 200);
  assert.equal((await app.api('/api/me', { token: engineer })).status, 401);
  const viewer = await app.login(body.email);
  assert.equal((await app.api('/api/tasks/1/notes', { token: viewer, method: 'POST', body: { notes: 'Forbidden' } })).status, 403);
});

test('progress, notes, downspouts and marble require confirmed cloud writes', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const token = await app.login();
  for (const [route, table, body] of [
    ['/api/tasks/1/progress', 'tasks', { completed_quantity: 5 }],
    ['/api/tasks/1/notes', 'tasks', { notes: 'New note' }],
    ['/api/nazalat/1/toggle', 'sub_units', {}],
    ['/api/nazalat/1/details', 'sub_units', { white_applied: 5 }],
    ['/api/marble/1/status', 'marble_distribution', { status: 'منجز', white_qty: 5, brown_qty: 2 }],
  ]) {
    const beforeLocal = await localRows(app.dataDir, table);
    const beforeCloud = structuredClone(cloud.tables[table]);
    cloud.fail(r => r.table === table && r.method === 'PATCH');
    assert.equal((await app.api(route, { token, method: 'POST', body })).status, 502);
    assert.deepEqual(await localRows(app.dataDir, table), beforeLocal);
    assert.deepEqual(cloud.tables[table], beforeCloud);
    cloud.fail(() => false);
    assert.equal((await app.api(route, { token, method: 'POST', body })).status, 200);
  }
  assert.equal(cloud.tables.tasks[0].notes, 'New note');
  assert.equal(cloud.tables.sub_units[0].white_applied, 5);
  assert.equal(cloud.tables.marble_distribution[0].white_qty, 5);
});

test('material photos survive cloud redeployment and local JSON recovery', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const token = await app.login();
  const saved = await app.api('/api/materials-consumption', { token, method: 'POST', body: material });
  assert.equal(saved.status, 201);
  assert.deepEqual(cloud.tables.materials_consumption[0].site_images, [photo]);
  // Omitted photos on an edit must not erase the existing ones.
  const edited = await app.api(`/api/materials-consumption/${saved.data.id}`, {
    token, method: 'PUT', body: { notes: 'Edited without changing photos' },
  });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.data.site_images, [photo]);
  await app.close();
  const redeployed = await startApp(t, { cloud });
  const newToken = await redeployed.login();
  const reread = await redeployed.api('/api/materials-consumption', { token: newToken });
  assert.deepEqual(reread.data[0].site_images, [photo]);
  assert.equal(reread.data[0].basics_notes, material.basics_notes);
  const recoveredDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-urgent-recovery-'));
  await fs.mkdir(path.join(recoveredDir, 'data'));
  await fs.copyFile(path.join(redeployed.dataDir, 'data', 'materials_consumption.json'), path.join(recoveredDir, 'data', 'materials_consumption.json'));
  const recovered = await startApp(t, { directory: recoveredDir });
  const recoveredToken = await recovered.login();
  const report = await recovered.api('/api/materials-consumption', { token: recoveredToken });
  assert.deepEqual(report.data[0].site_images, [photo]);
  assert.equal(report.data[0].basics_notes, material.basics_notes);
});

test('daily insert failure leaves no local message and signing failure cannot disguise a committed save', async t => {
  const cloud = await fakeCloud(t);
  const app = await startApp(t, { cloud });
  const token = await app.login();
  cloud.fail(r => r.table === 'daily_updates' && r.method === 'POST');
  const rejected = await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Rejected' } });
  assert.equal(rejected.status, 502);
  assert.equal(cloud.tables.daily_updates.length, 0);
  assert.equal((await localRows(app.dataDir, 'daily_updates')).length, 0);
  cloud.fail(r => r.path.startsWith('/storage/v1/object/sign/'));
  const saved = await app.api('/api/daily-updates', { token, method: 'POST', body: { message_text: 'Saved without signed URL', media_data: photo } });
  assert.equal(saved.status, 201, JSON.stringify(saved.data));
  assert.equal(saved.data.media_url, null);
  assert.equal(cloud.tables.daily_updates.length, 1);
  assert.equal((await localRows(app.dataDir, 'daily_updates')).length, 1);
  cloud.fail(() => false);
  const reread = await app.api('/api/daily-updates', { token });
  assert.match(reread.data[0].media_url, /\/object\/sign\//);
});

test('partial and invalid cloud configuration cannot silently start in local mode', async t => {
  for (const cloud of [{ url: '' }, { url: 'not-a-url' }, { url: 'https://xzlsrqtptuspoqovbgpg.supabase.co' }]) {
    await assert.rejects(startApp(t, { cloud }), /Server exited/);
  }
});

test('automatic Marblex status is recalculated when an edit omits the manual status', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const saved = await app.api('/api/marblex', { token, method: 'POST', body: fixtures[3][2] });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.status, 'قيد التنفيذ');
  const edited = await app.api(`/api/marblex/${saved.data.id}`, {
    token, method: 'PUT', body: { applied_pieces: 10, applied_steel: 20 },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.overall_progress, 100);
  assert.equal(edited.data.status, 'منجز');
});
