-- Lock the database to the server only (clears the Security Advisor warnings
-- "RLS Policy Always True" and "Security Definer View").
-- Run ONCE in the Supabase SQL Editor. Safe to re-run.
--
-- Why this is safe for the app: the site never talks to Supabase from the
-- browser. Only the server does, with the SECRET key, and the secret key
-- bypasses row level security. So removing the open policies changes nothing
-- for the app, and closes the database to anyone holding the publishable key.
--
-- Everything runs as one unit: if any line fails, nothing is applied.

begin;

-- 1. Remove every policy on the app's tables. The old "Allow public operations"
--    policies let anyone with the publishable key read the users table
--    (emails, password hashes) and edit or delete any record.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2. Keep row level security ON for every table, so with no policy the
--    publishable key sees nothing and can change nothing.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 3. The two views ran with their creator's rights, which skips row level
--    security. Make them run with the caller's rights, and close them to the
--    public roles (the server does not use them).
alter view if exists public.sub_units_stats set (security_invoker = true);
alter view if exists public.daily_updates_with_users set (security_invoker = true);
do $$
begin
  if to_regclass('public.sub_units_stats') is not null then
    revoke all on public.sub_units_stats from anon, authenticated;
  end if;
  if to_regclass('public.daily_updates_with_users') is not null then
    revoke all on public.daily_updates_with_users from anon, authenticated;
  end if;
end $$;

commit;

-- Check 1: should return no rows (no policies left).
select tablename, policyname from pg_policies where schemaname = 'public';

-- Check 2: every table should show rls_enabled = true, including joints_daily.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
