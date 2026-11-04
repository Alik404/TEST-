import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { PGlite } from '@electric-sql/pglite';
import { startApp } from './helpers.mjs';
import { DATA_TABLES } from '../server/backup-format.js';

test('PostgreSQL migrations run twice, preserve data, enforce audit permissions and roll back failed audit writes', async t => {
  const app = await startApp(t);
  const source = new sqlite3.Database(path.join(app.dataDir, 'project.db'), sqlite3.OPEN_READONLY);
  const columns = table => new Promise((resolve, reject) => source.all(`PRAGMA table_info(${table})`, (error, rows) => error ? reject(error) : resolve(rows)));
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);`);
  const jsonColumns = new Set(['basics','marble','sealants','bulk','site_images','data']);
  try {
    for (const table of DATA_TABLES.filter(name => name !== 'audit_events')) {
      const fields = await columns(table);
      const definitions = fields.map(column => {
        let type = column.pk && column.type === 'INTEGER' ? 'bigserial' : column.type === 'INTEGER' ? 'bigint' : column.type === 'REAL' ? 'numeric' : column.type === 'DATETIME' ? 'timestamptz' : 'text';
        if (jsonColumns.has(column.name)) type = 'jsonb';
        return `"${column.name}" ${type}${column.pk ? ' primary key' : ''}${column.notnull ? ' not null' : ''}${column.name === 'created_at' ? ' default now()' : ''}`;
      });
      await pg.exec(`CREATE TABLE public.${table} (${definitions.join(',')});`);
    }
  } finally { await new Promise(resolve => source.close(resolve)); }
  await pg.exec(await fs.readFile('supabase_handover.sql', 'utf8'));
  // Reproduce the actual old cloud schema; do not inherit this column from SQLite.
  await pg.exec('ALTER TABLE public.materials_consumption DROP COLUMN updated_at;');
  await pg.exec(await fs.readFile('supabase_urgent_fixes.sql', 'utf8'));
  const migration = await fs.readFile('supabase_operations.sql', 'utf8');
  await pg.exec(migration);
  const hardening = await fs.readFile('supabase_hardening.sql', 'utf8');
  await pg.exec(hardening);
  await pg.exec(hardening);
  await pg.exec(`GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
    REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM service_role;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;`);
  await pg.exec(migration);
  const actor = { id: '7', name: 'Test director', role: 'super_admin', request_id: 'test-request' };
  const mutate = async (table, action, data, id = null, acting = actor, expected = null) => (await pg.query(
    'SELECT public.app_mutate_record($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb) AS result',
    [table, action, JSON.stringify(data), id, JSON.stringify(acting), expected == null ? null : JSON.stringify(expected)],
  )).rows[0].result;
  await pg.exec('SET ROLE service_role');
  const material = await mutate('materials_consumption', 'insert', { id: 'old-cloud-material', date: '2026-11-05', day: 'Thursday', prepared_by: 'Test', notes: 'before' });
  const changedMaterial = await mutate('materials_consumption', 'update', { notes: 'after', updated_at: '2026-11-05T00:00:00Z' }, material.id);
  assert.equal(changedMaterial.notes, 'after');
  assert.ok(changedMaterial.updated_at);
  // Keep subsequent audit assertions scoped to their own operation.
  const user = await mutate('users', 'insert', { email: 'pg@test.invalid', name: 'PG user', role: 'super_admin', password: 'hash-hidden', session_version: 'version-hidden' });
  assert.ok(user.id);
  const created = (await pg.query("SELECT * FROM public.audit_events WHERE entity_table='users'")).rows[0];
  assert.equal(created.actor_name, actor.name);
  assert.equal(created.actor_role, 'super_admin');
  assert.equal(created.after_data.password, undefined);
  assert.equal(created.after_data.session_version, undefined);
  assert.ok(created.changed_fields.includes('password'));
  await mutate('users', 'update', { name: 'Changed name' }, String(user.id));
  const updated = (await pg.query("SELECT * FROM public.audit_events WHERE action='update' AND entity_table='users'")).rows[0];
  assert.equal(updated.before_data.name, 'PG user');
  assert.equal(updated.after_data.name, 'Changed name');
  assert.equal(await mutate('users', 'update', { name: 'Stale maintenance' }, String(user.id), actor, { session_version: 'stale' }), null);
  assert.equal((await mutate('users', 'update', { name: 'Changed name' }, String(user.id), actor, { session_version: 'version-hidden' })).name, 'Changed name');
  const note = await mutate('handover_notes', 'insert', { level: 'B37', note_type: 'joints', description: 'PG note', created_by: 7 });
  const review = await mutate('handover_notes', 'update', { status: 'approved', approved_seq: 1 }, note.id, actor, { status: 'pending' });
  assert.equal(review.status, 'approved');
  assert.equal(await mutate('handover_notes', 'update', { description: 'Stale update' }, note.id, actor, { status: 'pending' }), null);
  assert.equal(await mutate('handover_counters', 'next_seq', { level: 'B37', kind: 'A' }), 1);
  const settings = await mutate('handover_settings', 'upsert', { key: 'filterers', value: [7], updated_at: new Date().toISOString() });
  assert.deepEqual(settings.value, [7]);
  const receipt = await mutate('handover_receipts', 'upsert', { level: 'B37', status: 'received', updated_by_name: 'Director' });
  assert.equal(receipt.status, 'received');
  const snapshot = (await pg.query('SELECT public.app_backup_snapshot() AS result')).rows[0].result;
  assert.equal(snapshot.tables.users[0].name, 'Changed name');
  assert.equal(snapshot.tables.handover_notes.length, 1);
  await assert.rejects(pg.exec('DELETE FROM public.audit_events'), /permission denied/);
  await pg.exec('RESET ROLE');
  await pg.exec("ALTER TABLE public.audit_events ADD CONSTRAINT test_audit_rejection CHECK(actor_name <> 'Reject audit');");
  await pg.exec('SET ROLE service_role');
  await assert.rejects(mutate('users', 'update', { name: 'Should roll back' }, String(user.id), { ...actor, name: 'Reject audit' }), /test_audit_rejection/);
  assert.equal((await pg.query('SELECT name FROM public.users')).rows[0].name, 'Changed name');
  await pg.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(pg.exec('SELECT * FROM public.users'), /permission denied/);
  await assert.rejects(pg.exec('TRUNCATE public.users'), /permission denied/);
  await assert.rejects(pg.exec('SELECT public.app_capture_audit()'), /permission denied/);
  await assert.rejects(pg.exec('SELECT * FROM public.audit_events'), /permission denied/);
  await assert.rejects(pg.exec('SELECT public.app_backup_snapshot()'), /permission denied/);
  await assert.rejects(mutate('users', 'delete', {}, String(user.id)), /permission denied/);
  await pg.exec('RESET ROLE');
  const foreignKeyIndexes = (await pg.query("SELECT count(*)::int AS count FROM pg_indexes WHERE indexname IN ('tasks_category_id_idx','sub_units_task_id_idx','daily_updates_user_id_idx','daily_updates_reply_to_id_idx')")).rows[0].count;
  assert.equal(foreignKeyIndexes, 4);
  await pg.exec(migration);
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count, 1);
});
