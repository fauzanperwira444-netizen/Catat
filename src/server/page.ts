// Titik masuk setiap halaman: konteks data, tanggal hari ini, dan proses
// pergantian hari (FR-30) yang dijalankan malas saat aplikasi dibuka.
import 'server-only';
import { emit } from '@/shared/events';
import { today } from '@/shared/time';
import { hasStaleTodos, prosesPergantianHari } from '@/modules/todos/service';
import { getCtx, inTransaction } from './db';

export async function pageCtx() {
  const t = today();
  const ctx = await getCtx();
  if (await hasStaleTodos(ctx, t)) {
    const events = await inTransaction((tx) => prosesPergantianHari(tx, t));
    if (events.length) await emit(events);
  }
  return { ctx, today: t };
}
