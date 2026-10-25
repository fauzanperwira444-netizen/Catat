import os from 'node:os';
import path from 'node:path';

/** Folder data Catat: database dan cadangan. Default Documents/Catat di folder pengguna. */
export function dataDir(): string {
  const fromEnv = process.env.CATAT_DATA_DIR?.trim();
  return fromEnv ? path.resolve(fromEnv) : path.join(os.homedir(), 'Documents', 'Catat');
}

export function databasePath(): string {
  return path.join(dataDir(), 'catat.db');
}

export function backupDir(): string {
  return path.join(dataDir(), 'cadangan');
}

export { timeZone } from './tz';

/** Versi format file ekspor. Naikkan saat struktur data berubah. */
export const EXPORT_FORMAT_VERSION = 1;
