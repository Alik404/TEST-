-- Retired historical dump. This file intentionally contains no data or DDL.
-- It was incomplete, contained legacy credentials and reopened public access.
-- The previous local copy is encrypted under .private-backups/ by the repair.
-- Export a verified current backup with: npm run backup:export
do $$ begin
  raise exception 'Historical dump retired. Use npm run backup:export and backup:restore.';
end $$;
