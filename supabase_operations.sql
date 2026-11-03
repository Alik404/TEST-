-- Run after supabase_urgent_fixes.sql and the module table migrations.
-- Additive: business records are preserved. Requires a server secret key.
begin;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text, actor_name text not null, actor_role text not null,
  request_id text not null, entity_table text not null, record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before_data jsonb, after_data jsonb, changed_fields jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists audit_events_time on public.audit_events(created_at desc, id desc);
create index if not exists audit_events_entity on public.audit_events(entity_table, created_at desc, id desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated, service_role;
grant select on public.audit_events to service_role;

create or replace function public.app_audit_redact(v jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog, public as $$
declare result jsonb; k text; item jsonb;
begin
  if jsonb_typeof(v) = 'object' then
    result := '{}'::jsonb;
    for k, item in select key, value from jsonb_each(v) loop
      if k = any(array['password','session_version','token','secret','media_data']) then continue; end if;
      if k = 'site_images' then
        item := jsonb_build_object('count', case when jsonb_typeof(item) = 'array' then jsonb_array_length(item) else 0 end);
      else item := public.app_audit_redact(item); end if;
      result := result || jsonb_build_object(k, item);
    end loop;
    return result;
  elsif jsonb_typeof(v) = 'array' then
    select coalesce(jsonb_agg(public.app_audit_redact(value)), '[]'::jsonb) into result from jsonb_array_elements(v);
    return result;
  elsif jsonb_typeof(v) = 'string' and (v #>> '{}') like 'data:%' then
    return '"[attachment omitted]"'::jsonb;
  end if;
  return v;
end $$;

create or replace function public.app_capture_audit() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare b jsonb; a jsonb; actor jsonb; row_data jsonb; fields jsonb;
begin
  b := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  a := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_data := coalesce(a, b);
  actor := coalesce(nullif(current_setting('app.audit_actor', true), '')::jsonb, '{}'::jsonb);
  select coalesce(jsonb_agg(key order by key), '[]'::jsonb) into fields
  from (select jsonb_object_keys(coalesce(b,'{}'::jsonb) || coalesce(a,'{}'::jsonb)) as key) keys
  where key <> 'session_version' and (b -> key) is distinct from (a -> key);
  insert into public.audit_events(actor_id, actor_name, actor_role, request_id, entity_table, record_id,
    action, before_data, after_data, changed_fields)
  values (actor ->> 'id', coalesce(actor ->> 'name', 'النظام'), coalesce(actor ->> 'role', 'system'),
    coalesce(actor ->> 'request_id', gen_random_uuid()::text), tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'key', (row_data ->> 'level') || coalesce('|' || (row_data ->> 'kind'), '')),
    lower(tg_op), public.app_audit_redact(b), public.app_audit_redact(a), fields);
  return coalesce(new, old);
end $$;

do $$ declare name text; begin
  foreach name in array array['users','categories','tasks','sub_units','marble_distribution','daily_updates',
    'materials_consumption','workers_wages','weekly_advance','marblex_progress','joints_daily',
    'handover_notes','handover_counters','handover_settings','handover_receipts'] loop
    if to_regclass('public.' || name) is not null then
      execute format('drop trigger if exists app_audit on public.%I', name);
      execute format('create trigger app_audit after insert or update or delete on public.%I for each row execute function public.app_capture_audit()', name);
    end if;
  end loop;
end $$;

-- Business write and trigger execute in the same transaction. No public role
-- may provide an actor or use this function; the authenticated Express API does.
create or replace function public.app_mutate_record(
  p_table text, p_action text, p_data jsonb, p_id text, p_actor jsonb, p_expected jsonb default null
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare cols text; vals text; assignments text; key_name text; result jsonb; predicate text;
begin
  if not p_table = any(array['users','tasks','sub_units','marble_distribution','daily_updates',
    'materials_consumption','workers_wages','weekly_advance','marblex_progress','joints_daily',
    'handover_notes','handover_counters','handover_settings','handover_receipts']) then
    raise exception 'Unsupported mutation table';
  end if;
  perform set_config('app.audit_actor', p_actor::text, true);
  if p_action = 'next_seq' and p_table = 'handover_counters' then
    return to_jsonb(public.handover_next_seq(p_data ->> 'level', p_data ->> 'kind'));
  end if;
  if p_action not in ('insert','update','delete','upsert') or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Unsupported mutation action';
  end if;
  key_name := case p_table when 'handover_settings' then 'key' when 'handover_receipts' then 'level' else 'id' end;
  if p_action = 'upsert' and p_table not in ('handover_settings','handover_receipts') then
    raise exception 'Unsupported upsert';
  end if;
  if exists(select 1 from jsonb_object_keys(p_data) k where not exists(
    select 1 from pg_attribute where attrelid = to_regclass('public.' || p_table) and attname = k and attnum > 0 and not attisdropped)) then
    raise exception 'Unknown column';
  end if;
  select string_agg(format('%I', key), ', ' order by key), string_agg(format('r.%I', key), ', ' order by key)
    into cols, vals from jsonb_object_keys(p_data) as keys(key);
  predicate := format('target.%I::text = $2', key_name);
  if p_expected is not null then
    if p_table <> 'handover_notes' or (select count(*) from jsonb_object_keys(p_expected)) <> 1 or not (p_expected ? 'status') then
      raise exception 'Unsupported expected state';
    end if;
    predicate := predicate || ' and target.status = ($3 ->> ''status'')';
  end if;
  if p_action = 'insert' then
    execute format('insert into public.%I as target (%s) select %s from jsonb_populate_record(null::public.%I, $1) r returning to_jsonb(target.*)', p_table, cols, vals, p_table)
      into result using p_data;
  elsif p_action = 'upsert' then
    select string_agg(format('%I = excluded.%I', key, key), ', ' order by key) into assignments
      from jsonb_object_keys(p_data) as keys(key) where key <> key_name;
    execute format('insert into public.%I as target (%s) select %s from jsonb_populate_record(null::public.%I, $1) r on conflict (%I) do update set %s returning to_jsonb(target.*)', p_table, cols, vals, p_table, key_name, assignments)
      into result using p_data;
  elsif p_action = 'update' then
    select string_agg(format('%I = r.%I', key, key), ', ' order by key) into assignments
      from jsonb_object_keys(p_data) as keys(key) where key not in (key_name, 'created_at');
    if assignments is null then raise exception 'Empty update'; end if;
    execute format('update public.%I as target set %s from jsonb_populate_record(null::public.%I, $1) r where %s returning to_jsonb(target.*)', p_table, assignments, p_table, predicate)
      into result using p_data, p_id, p_expected;
  else
    execute format('delete from public.%I as target where %s returning to_jsonb(target.*)', p_table, predicate)
      into result using p_data, p_id, p_expected;
  end if;
  return result;
end $$;

-- STABLE shares the caller's snapshot across all SELECTs, so all tables are
-- exported from one database snapshot rather than paginated REST responses.
create or replace function public.app_backup_snapshot() returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare name text; rows jsonb; tables jsonb := '{}'::jsonb;
begin
  foreach name in array array['users','categories','tasks','sub_units','marble_distribution','daily_updates',
    'materials_consumption','workers_wages','weekly_advance','marblex_progress','joints_daily',
    'audit_events','handover_notes','handover_counters','handover_settings','handover_receipts'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r', name) into rows;
    tables := tables || jsonb_build_object(name, rows);
  end loop;
  return jsonb_build_object('tables', tables, 'captured_at', statement_timestamp());
end $$;

revoke all on function public.app_mutate_record(text,text,jsonb,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.app_backup_snapshot() from public, anon, authenticated;
revoke all on function public.app_audit_redact(jsonb) from public, anon, authenticated;
grant execute on function public.app_mutate_record(text,text,jsonb,text,jsonb,jsonb) to service_role;
grant execute on function public.app_backup_snapshot() to service_role;
commit;
