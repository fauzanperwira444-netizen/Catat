import { exportData, recordExport } from '@/modules/data/service';
import { getCtx } from '@/server/db';
import { now, today } from '@/shared/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCtx();
  const body = JSON.stringify(await exportData(ctx), null, 2);
  recordExport(now());
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="catat-ekspor-${today()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
