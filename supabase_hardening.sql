-- Server-only access. Run after the module, urgent and operations scripts.
-- Repeatable and additive: no business records or Storage objects are removed.
begin;

alter table public.materials_consumption add column if not exists updated_at timestamptz;
create index if not exists tasks_category_id_idx on public.tasks(category_id);
create index if not exists sub_units_task_id_idx on public.sub_units(task_id);
create index if not exists daily_updates_user_id_idx on public.daily_updates(user_id);
create index if not exists daily_updates_reply_to_id_idx on public.daily_updates(reply_to_id);

do $$ declare p record; t record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke insert, update, delete, truncate, references, trigger on public.audit_events from service_role;
revoke all on function public.app_capture_audit(), public.app_audit_redact(jsonb),
  public.app_mutate_record(text,text,jsonb,text,jsonb,jsonb), public.app_backup_snapshot(),
  public.handover_next_seq(text,text) from public, anon, authenticated;
grant execute on function public.app_mutate_record(text,text,jsonb,text,jsonb,jsonb),
  public.app_backup_snapshot(), public.handover_next_seq(text,text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('daily-attachments','daily-attachments',false,12582912,array[
  'image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif',
  'video/mp4','video/webm','video/quicktime','video/3gpp',
  'audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
update storage.buckets set public = false where id = 'handover-photos';
notify pgrst, 'reload schema';
commit;
