import { AlertTriangle, Download } from 'lucide-react';
import { RestoreData } from '@/components/RestoreData';
import { dataStats, readMeta } from '@/modules/data/service';
import { pageCtx } from '@/server/page';
import { backupDir, databasePath } from '@/shared/config';
import { fmtClock, fmtLong, localParts } from '@/shared/time';

export const metadata = { title: 'Data' };

export default async function DataPage() {
  const { ctx } = await pageCtx();
  const stats = await dataStats(ctx);
  const meta = readMeta();
  const last = meta.lastExportAt ? new Date(meta.lastExportAt) : null;
  return (
    <main className="page" style={{ gap: 24 }}>
      <header>
        <h1 className="title" style={{ margin: 0 }}>
          Data
        </h1>
        <div className="muted" style={{ marginTop: 4 }}>
          Semua data Catat tersimpan di laptop ini. Ekspor secara berkala sebagai cadangan.
        </div>
      </header>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section aria-labelledby="isi-h" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="isi-h" style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>
            Isi data saat ini
          </h2>
          <div className="stats">
            <div className="stat">
              <b>{stats.projects}</b>
              <span>Projek</span>
            </div>
            <div className="stat">
              <b>{stats.tasks}</b>
              <span>Task</span>
            </div>
            <div className="stat">
              <b>{stats.todoDays}</b>
              <span>Hari riwayat to-do</span>
            </div>
            <div className="stat">
              <b>{stats.progressLogs}</b>
              <span>Catatan progress</span>
            </div>
          </div>
          <div className="small muted" style={{ wordBreak: 'break-all' }}>
            Lokasi database: {databasePath()}
          </div>
        </section>

        <section className="card" aria-labelledby="eks-h">
          <h2 className="h2" id="eks-h">
            Ekspor data
          </h2>
          <div>
            Unduh seluruh data, termasuk projek, sesi, task, label, riwayat to-do, dan catatan progress, ke satu file.
          </div>
          <div className="small muted tabular">
            {last
              ? `Ekspor terakhir: ${fmtLong(localParts(last).date)} pukul ${fmtClock(last)}`
              : 'Belum pernah diekspor.'}
          </div>
          <a className="btn btn-primary" href="/data/ekspor" download>
            <Download size={16} aria-hidden />
            Ekspor data
          </a>
        </section>

        <section className="card" aria-labelledby="pul-h">
          <h2 className="h2" id="pul-h">
            Pulihkan data
          </h2>
          <div>Ganti seluruh data saat ini dengan isi file ekspor. Data yang belum diekspor akan hilang.</div>
          <div
            className="small"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--late-bg)',
              color: 'var(--late)',
              borderRadius: 4,
              padding: '8px 10px',
            }}
          >
            <AlertTriangle size={14} aria-hidden style={{ flex: 'none' }} />
            Ekspor data saat ini dulu sebelum memulihkan, supaya ada cadangan. Catat juga menyimpan salinan otomatis di{' '}
            {backupDir()}.
          </div>
          <RestoreData />
        </section>
      </div>
    </main>
  );
}
