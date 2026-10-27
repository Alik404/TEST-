-- Handover notes (ملاحظات الاستلام) and the polishing handover register (استلام الجلي).
-- Run ONCE in the Supabase SQL Editor of the SAME project the site already uses.
-- Safe to re-run: nothing is dropped and existing notes are kept.
--
-- Security model (same as the rest of the site): the browser never talks to
-- Supabase. Only the server does, with the SECRET key, which bypasses row level
-- security. RLS is ON with no policies, so the publishable key can neither read
-- nor change these tables, and the photo bucket is private. Who may add,
-- review or export notes is enforced by the server on every request.
--
-- Everything runs as one unit: if any line fails, nothing is applied.

begin;

-- 1. Notes. A note gets its number only when it is approved (B37-01) or
--    deferred (B37-D01). The two sequences are stored separately and never
--    change once given, even if the note is later returned for review.
create table if not exists public.handover_notes (
  id               uuid primary key default gen_random_uuid(),
  level            text not null check (level ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  note_type        text not null check (note_type in ('joints', 'polishing', 'cleaning', 'cracks', 'other')),
  description      text not null check (char_length(description) between 1 and 2000),
  location         text not null default '',
  final_text       text,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'deferred', 'rejected')),
  reject_reason    text check (reject_reason in ('duplicate', 'inaccurate', 'out_of_scope', 'resolved')),
  approved_seq     integer check (approved_seq > 0),
  deferred_seq     integer check (deferred_seq > 0),
  photos           jsonb not null default '[]'::jsonb,
  created_by       bigint,
  created_by_name  text not null default '',
  reviewed_by      bigint,
  reviewed_by_name text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- A number can never be given twice inside the same level.
create unique index if not exists handover_notes_approved_no
  on public.handover_notes (level, approved_seq) where approved_seq is not null;
create unique index if not exists handover_notes_deferred_no
  on public.handover_notes (level, deferred_seq) where deferred_seq is not null;
create index if not exists handover_notes_level_status
  on public.handover_notes (level, status);

-- 2. Number counters, one per level and kind (A = approved, D = deferred).
--    They only go up, so a deleted or rejected note never frees its number.
create table if not exists public.handover_counters (
  level      text not null,
  kind       text not null check (kind in ('A', 'D')),
  last_value integer not null default 0,
  primary key (level, kind)
);

create or replace function public.handover_next_seq(p_level text, p_kind text)
returns integer
language sql
volatile
set search_path = public
as $$
  insert into public.handover_counters as c (level, kind, last_value)
  values (p_level, p_kind, 1)
  on conflict (level, kind) do update set last_value = c.last_value + 1
  returning last_value;
$$;

-- Only the server's secret key may call it; the public API roles may not.
revoke all on function public.handover_next_seq(text, text) from public, anon, authenticated;
grant execute on function public.handover_next_seq(text, text) to service_role;

-- 3. Settings: the list of levels (editable from the app) and who reviews.
create table if not exists public.handover_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.handover_settings (key, value) values
  ('levels', '["B37","B36","B35","B34","B33","B32","B31","B30","B29","B28","B27","B26","B25","B24","B23","B22","B21","B20","B19","B18","B17","B16","B15","B14","B13","B12","B11","B10","B9","B8","B7","B6","B5","B4","B3","B2","B1"]'::jsonb),
  ('filterers', '[]'::jsonb)
on conflict (key) do nothing;

-- 4. Polishing handover register: one row per level.
create table if not exists public.handover_receipts (
  level           text primary key,
  status          text not null default 'not_received' check (status in ('not_received', 'with_notes', 'received')),
  received_on     date,
  notes           text not null default '',
  updated_by      bigint,
  updated_by_name text,
  updated_at      timestamptz not null default now()
);

-- 5. Lock the tables to the server.
alter table public.handover_notes    enable row level security;
alter table public.handover_counters enable row level security;
alter table public.handover_settings enable row level security;
alter table public.handover_receipts enable row level security;

revoke all on public.handover_notes, public.handover_counters, public.handover_settings, public.handover_receipts
  from anon, authenticated;

-- 6. Private photo bucket (JPEG only, 5 MB per file). No storage policies are
--    added, so only the server can upload, read or delete; the app shows
--    photos through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handover-photos', 'handover-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Check 1: four tables, every one with rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'handover_%'
order by c.relname;

-- Check 2: the bucket exists and is private (public = false).
select id, public, file_size_limit from storage.buckets where id = 'handover-photos';
