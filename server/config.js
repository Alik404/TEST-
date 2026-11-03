import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

// Environment variables supplied by the host take precedence. Tests never load
// the project's credentials or open its data directory.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(serverDir, '../.env'), quiet: true });
}
if (process.env.NODE_ENV === 'test' && !process.env.APP_DATA_DIR) {
  throw new Error('Tests require an isolated APP_DATA_DIR.');
}

export const dataRoot = path.resolve(process.env.APP_DATA_DIR || serverDir);
