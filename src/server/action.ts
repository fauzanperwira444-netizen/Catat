// Pembungkus Server Action: satu transaksi, validasi, pesan galat yang ramah.
import 'server-only';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { DomainError } from '@/shared/errors';
import { emit, type DomainEvent } from '@/shared/events';
import { today } from '@/shared/time';
import { prosesPergantianHari } from '@/modules/todos/service';
import { inTransaction, type Ctx } from './db';

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; field?: string; fields?: Record<string, string>; details?: string[] };

type Out<T> = { data?: T; events?: DomainEvent[]; message?: string } | void;

export async function runAction<T>(fn: (ctx: Ctx, today: string) => Promise<Out<T>>): Promise<ActionResult<T>> {
  const t = today();
  try {
    const collected: DomainEvent[] = [];
    const out = await inTransaction(async (ctx) => {
      collected.push(...(await prosesPergantianHari(ctx, t)));
      return fn(ctx, t);
    });
    if (out?.events) collected.push(...out.events);
    if (collected.length) await emit(collected);
    revalidatePath('/', 'layout');
    return { ok: true, data: out?.data, message: out?.message };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message, field: e.field, details: e.details };
    if (e instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of e.issues) {
        const k = issue.path.join('.') || '_';
        if (!fields[k]) fields[k] = issue.message;
      }
      return { ok: false, error: 'Periksa isian yang ditandai.', fields };
    }
    console.error(e);
    return { ok: false, error: 'Terjadi kesalahan tak terduga. Coba lagi.' };
  }
}
