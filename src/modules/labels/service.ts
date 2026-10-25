// Label untuk task mandiri (FR-15). Nama unik, bisa diganti.
// Riwayat merujuk label lewat id, sehingga nama baru ikut tampil di riwayat.
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/server/db';
import { labels, tasks } from '@/server/schema';
import { DomainError } from '@/shared/errors';

export const labelNameSchema = z
  .string()
  .trim()
  .min(1, 'Isi nama label.')
  .max(40, 'Nama label paling panjang 40 karakter.');

async function findByName(ctx: Ctx, name: string) {
  const rows = await ctx.db
    .select()
    .from(labels)
    .where(sql`lower(${labels.name}) = lower(${name})`)
    .limit(1);
  return rows[0];
}

/** Pakai label yang ada (nama sama, huruf besar-kecil diabaikan) atau buat baru. */
export async function findOrCreateLabel(ctx: Ctx, rawName: string) {
  const name = labelNameSchema.parse(rawName);
  const existing = await findByName(ctx, name);
  if (existing) return existing;
  const [row] = await ctx.db.insert(labels).values({ name }).returning();
  return row;
}

export async function renameLabel(ctx: Ctx, input: { id: string; name: string }) {
  const name = labelNameSchema.parse(input.name);
  const clash = await ctx.db
    .select({ id: labels.id })
    .from(labels)
    .where(and(sql`lower(${labels.name}) = lower(${name})`, ne(labels.id, input.id)))
    .limit(1);
  if (clash.length) throw new DomainError(`Label "${name}" sudah ada. Pakai nama lain.`, 'name');
  const res = await ctx.db.update(labels).set({ name }).where(eq(labels.id, input.id)).returning();
  if (!res.length) throw new DomainError('Label tidak ditemukan.');
  return res[0];
}

export async function listLabelsWithCounts(ctx: Ctx) {
  return ctx.db
    .select({
      id: labels.id,
      name: labels.name,
      activeCount: sql<number>`count(${tasks.id})`.mapWith(Number),
    })
    .from(labels)
    .leftJoin(tasks, and(eq(tasks.labelId, labels.id), isNull(tasks.doneAt), isNull(tasks.canceledAt)))
    .groupBy(labels.id)
    .orderBy(asc(labels.name));
}
