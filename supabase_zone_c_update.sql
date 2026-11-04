-- Zone C downspouts (نزلات زون C), C1 - C38, set to the values of the signed
-- progress table "جدول تقدم أعمال سجل النزلات - زون C" printed on 29/07/2026.
--
-- Run ONCE in the Supabase SQL Editor of the project the site uses.
-- Safe to re-run: it only overwrites zone C rows with the same values.
-- Everything runs as one unit: if any row is missing, nothing is changed.
--
-- Expected totals after running (same as the printed table):
--   white   marked 805,  extra 29, applied 845
--   walnut  marked 1098, extra 37, applied 1253
--   backfill entitlement (white + walnut applied) 2098

begin;

create temporary table zone_c_values (
  code text primary key,
  white_marked integer, white_extra integer, white_applied integer, white_date text,
  brown_marked integer, brown_extra integer, brown_applied integer, brown_date text
) on commit drop;

insert into zone_c_values values
  ('C1', 0, 0, 0, '', 0, 0, 0, ''),
  ('C2', 0, 0, 0, '', 0, 0, 0, ''),
  ('C3', 0, 0, 0, '', 0, 0, 0, ''),
  ('C4', 0, 0, 0, '', 0, 0, 0, ''),
  ('C5', 0, 0, 0, '', 0, 0, 0, ''),
  ('C6', 0, 0, 0, '', 0, 0, 0, ''),
  ('C7', 0, 0, 0, '', 0, 0, 0, ''),
  ('C8', 0, 0, 0, '', 0, 0, 0, ''),
  ('C9', 0, 0, 0, '', 0, 0, 0, ''),
  ('C10', 0, 0, 0, '', 0, 0, 0, ''),
  ('C11', 0, 0, 0, '', 0, 0, 0, ''),
  ('C12', 0, 0, 0, '', 0, 0, 0, ''),
  ('C13', 0, 0, 0, '', 0, 0, 0, ''),
  ('C14', 0, 0, 0, '', 0, 0, 0, ''),
  ('C15', 0, 0, 0, '', 0, 0, 0, ''),
  ('C16', 0, 0, 0, '', 0, 0, 0, ''),
  ('C17', 0, 0, 0, '', 0, 0, 0, ''),
  ('C18', 0, 0, 0, '', 0, 0, 0, ''),
  ('C19', 0, 0, 45, '10/6/2026', 0, 0, 58, '10/6/2026'),
  ('C20', 67, 0, 101, '10/6/2026', 116, 0, 147, '10/6/2026'),
  ('C21', 91, 0, 145, '10/6/2026', 112, 0, 182, '10/6/2026'),
  ('C22', 75, 0, 135, '10/6/2026', 105, 0, 173, '10/6/2026'),
  ('C23', 63, 0, 94, '10/6/2026', 114, 0, 152, '10/6/2026'),
  ('C24', 33, 0, 19, '10/6/2026', 45, 0, 53, '10/6/2026'),
  ('C25', 43, 0, 12, '10/6/2026', 38, 1, 26, '10/6/2026'),
  ('C26', 41, 0, 16, '10/6/2026', 31, 0, 8, '10/6/2026'),
  ('C27', 49, 2, 13, '10/6/2026', 58, 0, 25, '10/6/2026'),
  ('C28', 47, 0, 22, '2026/07/29', 56, 0, 23, '2026/07/29'),
  ('C29', 66, 1, 41, '2026/07/29', 69, 4, 56, '2026/07/29'),
  ('C30', 31, 3, 35, '2026/07/29', 39, 4, 44, '2026/07/29'),
  ('C31', 36, 1, 39, '2026/07/29', 64, 5, 67, '2026/07/29'),
  ('C32', 48, 12, 43, '2026/07/29', 59, 11, 55, '2026/07/29'),
  ('C33', 31, 2, 34, '15/07/2026', 43, 1, 45, '15/07/2026'),
  ('C34', 35, 2, 33, '15/07/2026', 43, 1, 28, '15/07/2026'),
  ('C35', 19, 0, 9, '15/07/2026', 30, 2, 42, '15/07/2026'),
  ('C36', 12, 2, 5, '15/07/2026', 33, 4, 22, '15/07/2026'),
  ('C37', 6, 2, 3, '15/07/2026', 23, 2, 19, '15/07/2026'),
  ('C38', 12, 2, 1, '15/07/2026', 20, 2, 28, '15/07/2026');

update public.sub_units s
set white_marked  = v.white_marked,
    white_extra   = v.white_extra,
    white_applied = v.white_applied,
    white_date    = v.white_date,
    brown_marked  = v.brown_marked,
    brown_extra   = v.brown_extra,
    brown_applied = v.brown_applied,
    brown_date    = v.brown_date,
    status        = 'منجز'
from zone_c_values v
where s.code = v.code;

-- Stop (and undo everything) if any of the 38 downspouts is missing.
do $$
declare missing text;
begin
  select string_agg(v.code, ', ') into missing
  from zone_c_values v
  where not exists (select 1 from public.sub_units s where s.code = v.code);
  if missing is not null then
    raise exception 'Zone C rows not found in sub_units: %', missing;
  end if;
end $$;

commit;

-- Check: should show 38 | 805 | 29 | 845 | 1098 | 37 | 1253 | 2098
select count(*)              as downspouts,
       sum(white_marked)     as white_marked,
       sum(white_extra)      as white_extra,
       sum(white_applied)    as white_applied,
       sum(brown_marked)     as brown_marked,
       sum(brown_extra)      as brown_extra,
       sum(brown_applied)    as brown_applied,
       sum(white_applied + brown_applied) as backfill
from public.sub_units
where code ~ '^C([1-9]|[12][0-9]|3[0-8])$';
