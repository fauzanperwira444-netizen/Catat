// Pemulihan data dari file ekspor. ?pratinjau=1 hanya memeriksa file dan membandingkan isinya.
import { revalidatePath } from 'next/cache';
import { backupDatabase, dataStats, parseExport, replaceAll, statsOf } from '@/modules/data/service';
import { getCtx, inTransaction } from '@/server/db';
import { DomainError } from '@/shared/errors';
import { emit } from '@/shared/events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const preview = new URL(req.url).searchParams.has('pratinjau');
  try {
    const text = await req.text();
    const file = parseExport(text);
    const ctx = await getCtx();
    if (preview)
      return Response.json({ ok: true, exportedAt: file.exportedAt, current: await dataStats(ctx), incoming: statsOf(file) });
    const backup = await backupDatabase(ctx, 'sebelum-pulihkan');
    await inTransaction((tx) => replaceAll(tx, file));
    await emit([{ type: 'DataDipulihkan' }]);
    revalidatePath('/', 'layout');
    return Response.json({ ok: true, backup });
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ ok: false, error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ ok: false, error: 'Pemulihan gagal. Data lama tidak berubah.' }, { status: 500 });
  }
}
