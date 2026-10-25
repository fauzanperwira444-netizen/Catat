import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb, getCtx, inTransaction, type Ctx } from '@/server/db';
import { setNowForTesting } from '@/shared/time';

/** Database kosong baru di folder sementara, dengan jam Catat dikunci. */
export async function freshDb(nowIso = '2026-10-25T08:00:00+07:00'): Promise<Ctx> {
  await closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catat-test-'));
  process.env.CATAT_DATA_DIR = dir;
  process.env.CATAT_MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', 'drizzle');
  setNowForTesting(new Date(nowIso));
  return getCtx();
}

export function setNow(iso: string) {
  setNowForTesting(new Date(iso));
}

export { inTransaction };
