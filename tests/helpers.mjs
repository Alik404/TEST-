import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import sqlite3 from 'sqlite3';
import { redactAudit } from '../server/audit-context.js';

export const password = 'Test-password-123';
const hash = () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$16384$8$1$${salt}$${key}`;
};
export const account = (id, role) => ({ id, email: `${role}@test.invalid`, name: role, role,
  password: hash(), session_version: crypto.randomUUID() });

export async function startApp(t, { cloud, directory } = {}) {
  const dataDir = directory || await fs.mkdtemp(path.join(os.tmpdir(), 'site-urgent-test-'));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', APP_DATA_DIR: dataDir, PORT: '0',
      AUTH_SECRET: 'test-session-secret-that-is-longer-than-thirty-two-characters',
      SUPABASE_URL: cloud?.url || '', SUPABASE_KEY: cloud ? (cloud.key ?? 'test-key') : '',
      INITIAL_ADMIN_EMAIL: 'super_admin@test.invalid', INITIAL_ADMIN_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (child.exitCode === null) {
      const exit = once(child, 'exit');
      child.kill();
      await exit;
    }
  };
  t.after(close);
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${logs}`)), 20000);
    const onData = chunk => {
      logs += chunk;
      const found = logs.match(/running at (http:\/\/localhost:\d+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${logs}`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const api = async (route, { token, method = 'GET', body } = {}) => {
    const res = await fetch(url + route, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    return { status: res.status, data, mode: res.headers.get('x-storage-mode') };
  };
  const login = async (email = 'super_admin@test.invalid', secret = password) => {
    const result = await api('/api/login', { method: 'POST', body: { email, password: secret } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.ok(result.data.token);
    return result.data.token;
  };
  return { api, login, close, dataDir, url, logs: () => logs };
}

export async function localRows(dataDir, table) {
  assert.match(table, /^[a-z_]+$/);
  const db = new sqlite3.Database(path.join(dataDir, 'project.db'), sqlite3.OPEN_READONLY);
  try {
    return await new Promise((resolve, reject) => db.all(`SELECT * FROM ${table}`, (err, rows) => err ? reject(err) : resolve(rows)));
  } finally { await new Promise(resolve => db.close(resolve)); }
}

export async function fakeCloud(t) {
  const tables = {
    users: [account(1, 'super_admin'), account(2, 'admin'), account(3, 'viewer')],
    categories: [{ id: 1, name: 'Test category' }],
    tasks: [{ id: 1, category_id: 1, name: 'Test task', total_quantity: 10, completed_quantity: 0, progress_percent: 0, unit: 'pcs', is_manual: 1 }],
    sub_units: [{ id: 1, task_id: 1, serial_number: 1, zone: 'Zone A', code: 'A1', status: 'متبقي' }],
    marble_distribution: [{ id: 1, zone: 'Zone A', task_name: 'Test marble', white_qty: 0, brown_qty: 0, status: 'متبقي' }],
    daily_updates: [], materials_consumption: [], workers_wages: [], weekly_advance: [], marblex_progress: [], joints_daily: [],
    handover_settings: [{ key: 'levels', value: ['B37'] }, { key: 'filterers', value: [] }], handover_notes: [], handover_receipts: [], handover_counters: [], audit_events: [],
  };
  const calls = [];
  const objects = new Map();
  let rejectRequest = () => false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let raw = Buffer.concat(chunks);
    let table = url.pathname.split('/').at(-1);
    let method = req.method;
    let mutation;
    calls.push({ method, table, path: url.pathname });
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (table === 'app_backup_snapshot') return rejectRequest({ method, table, path: url.pathname })
      ? send(503, { code: 'TEST_FAILURE' }) : send(200, { tables, captured_at: new Date().toISOString() });
    if (table === 'app_mutate_record') {
      mutation = JSON.parse(raw.toString());
      table = mutation.p_table;
      method = { insert: 'POST', update: 'PATCH', delete: 'DELETE', upsert: 'PATCH' }[mutation.p_action];
      raw = Buffer.from(JSON.stringify(mutation.p_data));
      const key = table === 'handover_settings' ? 'key' : table === 'handover_receipts' ? 'level' : 'id';
      if (mutation.p_id != null) url.searchParams.set(key, `eq.${mutation.p_id}`);
      if (mutation.p_expected?.status) url.searchParams.set('status', `eq.${mutation.p_expected.status}`);
      calls.push({ method, table, path: url.pathname });
    }
    if (rejectRequest({ method, table, path: url.pathname }) || (mutation && rejectRequest({ method: 'POST', table: 'audit_events', path: '/trigger/audit_events' }))) {
      return send(503, { code: 'TEST_FAILURE', message: 'Injected cloud failure' });
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      return send(200, { signedURL: `/object/sign/${url.pathname.split('/sign/')[1]}?token=test` });
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (method === 'GET') {
        const key = url.pathname.replace('/object/authenticated/', '/object/');
        const bytes = objects.get(key);
        if (!bytes) return send(404, { message: 'Missing object' });
        res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(bytes);
      }
      objects.set(url.pathname, raw);
      return send(200, { Key: url.pathname.split('/object/')[1] });
    }
    if (!tables[table]) return send(404, { code: 'PGRST205', message: 'Missing table' });
    const matches = row => [...url.searchParams].every(([key, val]) => {
      if (['select', 'order', 'limit', 'offset', 'or'].includes(key)) return true;
      if (val.startsWith('eq.')) return String(row[key]) === val.slice(3);
      return true;
    });
    let data = tables[table].filter(matches);
    const before = structuredClone(data);
    if (method === 'POST') {
      const input = JSON.parse(raw.toString());
      data = (Array.isArray(input) ? input : [input]).map(row => ({
        id: row.id ?? Math.max(0, ...tables[table].map(r => Number(r.id) || 0)) + 1,
        created_at: new Date().toISOString(), ...row,
      }));
      if (table === 'users' && data.some(row => tables.users.some(u => u.email === row.email))) {
        return send(409, { code: '23505', message: 'Duplicate email' });
      }
      tables[table].push(...data);
    } else if (method === 'PATCH') {
      const patch = JSON.parse(raw.toString());
      data.forEach(row => Object.assign(row, patch));
    } else if (method === 'DELETE') {
      tables[table] = tables[table].filter(row => !matches(row));
    }
    if (mutation) {
      const actor = mutation.p_actor;
      for (let index = 0; index < data.length; index++) {
        const old = method === 'POST' ? null : before[index];
        const after = method === 'DELETE' ? null : data[index];
        tables.audit_events.push({ id: crypto.randomUUID(), actor_id: actor.id, actor_name: actor.name, actor_role: actor.role,
          request_id: actor.request_id, entity_table: table, record_id: String(data[index].id), action: mutation.p_action,
          before_data: redactAudit(old), after_data: redactAudit(after), changed_fields: Object.keys(mutation.p_data), created_at: new Date().toISOString() });
      }
      return send(200, data[0] ?? null);
    }
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Range': `0-${data.length - 1}/${data.length}` });
      return res.end();
    }
    const order = url.searchParams.get('order');
    if (order) {
      data = [...data].sort((a, b) => {
        for (const part of order.split(',')) {
          const [key, direction] = part.split('.');
          const compared = String(a[key]).localeCompare(String(b[key])) * (direction === 'desc' ? -1 : 1);
          if (compared) return compared;
        }
        return 0;
      });
    }
    const offset = Number(url.searchParams.get('offset')) || 0;
    const limit = Number(url.searchParams.get('limit')) || data.length;
    data = data.slice(offset, offset + limit);
    if (url.searchParams.get('select')?.includes('categories(name)')) data = data.map(r => ({ ...r, categories: { name: 'Test category' } }));
    const single = req.headers.accept?.includes('application/vnd.pgrst.object+json');
    send(req.method === 'POST' ? 201 : 200, single ? data[0] : data);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { url: `http://127.0.0.1:${server.address().port}`, tables, calls, objects,
    fail: rule => { rejectRequest = rule; } };
}

export const photo = 'data:image/jpeg;base64,/9j/2Q==';
export const material = { date: '2026-11-03', day: 'الثلاثاء', prepared_by: 'Test engineer',
  basics: { cement: { remaining: '5' } }, marble: {}, sealants: {}, bulk: {},
  basics_notes: 'Notes retained', site_images: [photo] };
export const fixtures = [
  ['materials-consumption', 'materials_consumption', material],
  ['workers-wages', 'workers_wages', { work_date: '2026-11-03', work_item: 'Test work', shifts_count: 2, shift_price: 30000 }],
  ['weekly-advance', 'weekly_advance', { receipt_date: '2026-11-03', team_leader: 'Test leader', data: JSON.stringify({ quantities: [{ price: 10, qty: 5 }] }) }],
  ['marblex', 'marblex_progress', { zone: 'Zone A', item_name: 'Test panel', total_pieces: 10, applied_pieces: 2, total_steel: 20, applied_steel: 4 }],
  ['joints-daily', 'joints_daily', { report_date: '2026-11-03', data: { rows: [{ item: 'Test joints', type: 'horizontal', zone: 'Zone A', count: 2, length: 58 }] } }],
];
