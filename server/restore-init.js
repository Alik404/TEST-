// Used only by the restore command, which supplies a new, isolated data directory.
import { databaseReady, closeDatabase } from './database.js';
await databaseReady;
await closeDatabase();
