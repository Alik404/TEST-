-- Daily joints progress (تقدم أعمال الجوينات اليومي): create the cloud table.
-- Run ONCE in the Supabase SQL Editor, BEFORE entering any joints records in the app.
-- Safe to re-run: nothing is duplicated or dropped.

begin;

-- 1. The table, matching the columns the server reads and writes.
--    data = { "rows": [{ "type": "horizontal"|"vertical", "item": text, "count": number, "length": number }],
--             "sealant_rate": text }
create table if not exists public.joints_daily (
  id            text primary key,
  report_date   date not null,
  workers_count integer not null default 0,
  notes         text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create index if not exists joints_daily_report_date_idx on public.joints_daily (report_date desc);

-- 2. Same protection as every other table: only the server's secret key can reach it.
alter table public.joints_daily enable row level security;

commit;

-- Check: should return 0 rows on a fresh table.
select id, report_date, workers_count from public.joints_daily order by report_date desc;
