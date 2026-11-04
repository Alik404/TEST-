import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, password } from './helpers.mjs';

test('remembered sessions retain their lifetime and still revoke when the account changes', async t => {
  const app = await startApp(t);
  const normal = await app.api('/api/login', { method: 'POST', body: { email: 'super_admin@test.invalid', password, remember: false } });
  const remembered = await app.api('/api/login', { method: 'POST', body: { email: 'super_admin@test.invalid', password, remember: true } });
  assert.equal(normal.status, 200);
  assert.equal(remembered.status, 200);
  const decode = token => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  const now = Math.floor(Date.now() / 1000);
  assert.ok(Math.abs(decode(normal.data.token).exp - now - 12 * 3600) < 3);
  assert.ok(Math.abs(decode(remembered.data.token).exp - now - 30 * 86400) < 3);
  assert.equal((await app.api('/api/me', { token: remembered.data.token })).status, 200);
  const changed = await app.api(`/api/users/${normal.data.user.id}`, { method: 'PUT', token: normal.data.token,
    body: { email: 'super_admin@test.invalid', name: 'Director', role: 'super_admin', password: 'New-test-password-456' } });
  assert.equal(changed.status, 200);
  assert.equal((await app.api('/api/me', { token: normal.data.token })).status, 401);
  assert.equal((await app.api('/api/me', { token: remembered.data.token })).status, 401);
});

test('a note covering every level survives the audited persistence integration', async t => {
  const app = await startApp(t);
  const token = await app.login();
  const created = await app.api('/api/handover/notes', { method: 'POST', token,
    body: { level: 'ALL', note_type: 'joints', description: 'Applies to every level', photos: [] } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.level, 'ALL');
  const assigned = await app.api('/api/handover/settings', { method: 'PUT', token,
    body: { filterers: [created.data.created_by] } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
  const approved = await app.api(`/api/handover/notes/${created.data.id}/review`, { method: 'POST', token,
    body: { action: 'approve' } });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  assert.equal(approved.data.status, 'approved');
  assert.equal(approved.data.approved_seq, 1);
  const audit = await app.api('/api/audit-events?entity=handover_notes', { token });
  assert.equal(audit.data.items[0].actor_role, 'super_admin');
  const invalid = await app.api('/api/handover/settings', { method: 'PUT', token,
    body: { levels: ['B37', 'ALL'] } });
  assert.equal(invalid.status, 400);
});
