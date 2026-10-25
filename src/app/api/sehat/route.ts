// Pemeriksaan sederhana bahwa server Catat berjalan (dipakai catat.bat).
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ok: true, app: 'catat' });
}
