# Supabase repair

This application uses a server secret key and application accounts in `public.users`.
The browser calls the Express API. Public database roles have no application table access.

For an existing database with the module tables, apply the migration in
`supabase/migrations/*_repair_cloud_contract.sql` before deploying this server.
It adds the missing material timestamp, audit table and transactional write/backup functions,
four foreign-key indexes, and server-only grants. Existing business records and Storage
objects are retained. The migration is repeatable. It is not a fresh-database baseline.

For a manual setup, run the module scripts, then `supabase_urgent_fixes.sql`,
`supabase_operations.sql` and `supabase_hardening.sql` in that order.
`materials_consumption.sql` and `supabase_migration.sql` are now repeatable and do not open public access.
The historical `supabase_complete_backup.sql` is retired; it must not be used to restore current data.

Run `npm run cloud:maintain -- --apply` after the migration. It:

- Saves an AES-256-GCM encrypted database recovery snapshot and a separate local key in `.private-backups/`.
- Converts legacy passwords to the same scrypt format as normal account creation, preserving passwords.
  A concurrent session-version change prevents overwriting that account. Converted accounts sign in again.
- Uploads available legacy daily attachments, downloads and compares their SHA-256 digest,
  then updates all references to that file. It never deletes local files or clears missing references.
- Lists missing filenames without printing credentials. To recover from another disk, pass `--uploads DIRECTORY`.

Keep `.private-backups/` and its keys private and outside source control. Recovery snapshot files contain
`12-byte IV | 16-byte GCM tag | ciphertext`; the key file is hexadecimal, and the decrypted payload is gzip JSON.
These database recovery snapshots do not include Storage binaries and are not complete file backups.

Use `npm run backup:export` or the director's export endpoint for a full, verified backup with attachments.
The command refuses to report success if a referenced file is missing. Restore with
`npm run backup:restore -- archive.json.gz --to NEW_DIRECTORY`.
HEIC/HEIF attachments are supported by backup validation as well as upload validation.

Local daily media is served only with a valid application session or a signed URL valid for 15 minutes.
Cloud media stays in private buckets and uses Supabase signed URLs. Access to an issued signed URL is
bearer access until its expiry, matching how browser image/audio/video elements load files.

Validation: `npm test`, `npm run lint:app`, `npm run build`.
The PostgreSQL regression test removes the material timestamp before applying the migration scripts,
then checks updating it, role restrictions, audit rollback and migration repeatability.
