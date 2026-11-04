-- Repeatable server-only setup; preserves existing records.
begin;
create table if not exists public.materials_consumption (
  id text primary key, date text not null, day text, start_time text, end_time text,
  prepared_by text, basics jsonb, marble jsonb, sealants jsonb, bulk jsonb, notes text,
  created_at timestamptz default now(), updated_at timestamptz
);
alter table public.materials_consumption add column if not exists updated_at timestamptz;
alter table public.materials_consumption enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='materials_consumption' loop
    execute format('drop policy %I on public.materials_consumption', p.policyname);
  end loop;
end $$;
revoke all on public.materials_consumption from public, anon, authenticated;
grant select, insert, update, delete on public.materials_consumption to service_role;
commit;
