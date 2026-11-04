-- Apply before deploying the urgent persistence/session fixes.
-- Additive migration: existing records and images are preserved.
begin;

alter table public.users
  add column if not exists session_version text not null default gen_random_uuid()::text;

alter table public.materials_consumption
  add column if not exists basics_notes text not null default '',
  add column if not exists marble_notes text not null default '',
  add column if not exists sealants_notes text not null default '',
  add column if not exists bulk_notes text not null default '',
  add column if not exists site_images jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz;

-- Daily attachments must survive a server redeploy. Access is through signed
-- links issued by the authenticated API, using the server's secret key.
insert into storage.buckets (id, name, public, file_size_limit)
values ('daily-attachments', 'daily-attachments', false, 12582912)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

commit;
