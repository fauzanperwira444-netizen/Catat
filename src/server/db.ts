// Koneksi database dan konteks repository.
// Semua akses data lewat objek konteks (Ctx). Saat Catat nanti multi-pengguna,
// saringan pengguna cukup ditambahkan di konteks dan repository.
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';
import { databasePath, dataDir } from '@/shared/config';

export type Db = LibSQLDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export interface Ctx {
  db: Executor;
  /** Disiapkan untuk masa depan multi-pengguna. Di v0 selalu null. */
  userId: string | null;
}

type Holder = { client: Client; db: Db; ready: Promise<void> } | undefined;
const g = globalThis as unknown as { __catatDb?: Holder };

function migrationsFolder() {
  return process.env.CATAT_MIGRATIONS_DIR ?? path.join(process.cwd(), 'drizzle');
}

function open(): NonNullable<Holder> {
  fs.mkdirSync(dataDir(), { recursive: true });
  const client = createClient({ url: `file:${databasePath()}` });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
    await migrate(db, { migrationsFolder: migrationsFolder() });
  })();
  return { client, db, ready };
}

/** Database yang siap dipakai. Migrasi dijalankan otomatis saat pertama dibuka. */
export async function getDb(): Promise<Db> {
  if (!g.__catatDb) g.__catatDb = open();
  await g.__catatDb.ready;
  return g.__catatDb.db;
}

export async function getCtx(): Promise<Ctx> {
  return { db: await getDb(), userId: null };
}

/** Jalankan fungsi di dalam satu transaksi, dengan konteks transaksi. */
export async function inTransaction<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => fn({ db: tx, userId: null }));
}

/** Tutup koneksi. Dipakai saat pengujian dan saat pemulihan data. */
export async function closeDb() {
  if (g.__catatDb) {
    try {
      await g.__catatDb.ready;
    } catch {
      /* abaikan */
    }
    g.__catatDb.client.close();
    g.__catatDb = undefined;
  }
}
