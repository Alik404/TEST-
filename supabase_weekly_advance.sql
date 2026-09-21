-- Weekly advance (السلفة الأسبوعية): create the cloud table and move existing records into it.
-- Run ONCE in the Supabase SQL Editor. Safe to re-run: nothing is duplicated.
-- Everything runs as one unit: if any line fails, nothing is applied.

begin;

-- 1. The table, matching the columns the server reads and writes.
create table if not exists public.weekly_advance (
  id           text primary key,
  receipt_date text not null,
  team_leader  text,
  site_name    text,
  team_number  text,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

-- 2. Existing records (1), copied from the local database.
--    Must happen together with step 1: on its next boot the server replaces its
--    local copy with this table, so an empty table would erase these records.
insert into public.weekly_advance
  (id, receipt_date, team_leader, site_name, team_number, data, created_at)
values
  ($q$1785073485052$q$, $q$2026-07-26$q$, $q$خلفة ابو حيدر$q$, $q$موقع الجندي المجهول$q$, $q$1$q$, $q${"site_name":"موقع الجندي المجهول","tech_name":"","receipt_date":"2026-07-26","receipt_voucher":"","receipt_type":"جزئي","measuring_unit":"","start_date":"","supervisor":"","has_contract":"لا","work_type":"","has_blueprints":"نعم","daily_staff_rate":"","unit_price":"","expected_end_date":"","performance":[{"criteria":"الالتزام بالتشغيل أثناء وبعد العمل","rating":"جيد","notes":""},{"criteria":"الالتزام بالعمل ضمن المخططات","rating":"جيد","notes":""},{"criteria":"المحافظة على المواد المستلمة","rating":"جيد","notes":""},{"criteria":"حالة المخزن","rating":"جيد","notes":""},{"criteria":"مدى التفاهم بين الفني وفريق الإشراف","rating":"جيد","notes":""},{"criteria":"عدد الكوادر مقارنة بحجم العمل","rating":"جيد","notes":""},{"criteria":"الالتزام بشروط السلامة","rating":"جيد","notes":""},{"criteria":"وقت طلب المواد","rating":"جيد","notes":""},{"criteria":"سرعة سير العمل","rating":"جيد","notes":""}],"materials":[{"name":"مرمر","received":"","prepared":"","consumed":"","notes":""},{"name":"رمل","received":"","prepared":"","consumed":"","notes":""},{"name":"اسمنت","received":"","prepared":"","consumed":"","notes":""},{"name":"","received":"","prepared":"","consumed":"","notes":""}],"quantities":[{"paragraph":"","zone":"","unit":"","price":"","qty":"","notes":""},{"paragraph":"","zone":"","unit":"","price":"","qty":"","notes":""},{"paragraph":"","zone":"","unit":"","price":"","qty":"","notes":""},{"paragraph":"","zone":"","unit":"","price":"","qty":"","notes":""}],"total_notes":"","resolved_notes":"","unresolved_notes":"","last_memo_date":"","partial_or_final":"جزئي","previous_advances":"","remaining_balance":""}$q$::jsonb, $q$2026-07-26T13:44:45.052Z$q$::timestamptz)
on conflict (id) do nothing;

-- 3. Same protection as every other table: only the server's secret key can reach it.
alter table public.weekly_advance enable row level security;

commit;

-- Check: should list 1 record(s).
select id, receipt_date, team_leader, team_number from public.weekly_advance order by receipt_date;
