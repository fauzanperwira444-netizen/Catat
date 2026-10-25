// Data contoh untuk mencoba Catat (sesuai mockup). Hanya mengisi database kosong.
// Pakai: npm run db:seed  (tambahkan -- --force untuk menghapus data lama dulu)
import fs from 'node:fs';
import { closeDb, getCtx, inTransaction } from '@/server/db';
import { databasePath } from '@/shared/config';
import { addDays, setNowForTesting, today } from '@/shared/time';
import { createProject, createSession } from '@/modules/projects/service';
import { createTask } from '@/modules/tasks/service';
import { addToTodo, checkTodoItem, lockTodo, prosesPergantianHari, updateProgress } from '@/modules/todos/service';
import { projects } from '@/server/schema';

async function main() {
  const force = process.argv.includes('--force');
  if (force) {
    await closeDb();
    for (const f of [databasePath(), databasePath() + '-wal', databasePath() + '-shm']) fs.rmSync(f, { force: true });
  }
  const ctx0 = await getCtx();
  if ((await ctx0.db.select().from(projects).limit(1)).length) {
    console.log('Database sudah berisi data. Jalankan dengan --force untuk mengganti dengan data contoh.');
    return;
  }
  const realToday = today();
  const D = (n: number) => addDays(realToday, n);
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);

  // Mulai seminggu lalu supaya ada riwayat.
  setNowForTesting(at(D(-8), '07:00'));
  const T0 = D(-8);
  const ids = await inTransaction(async (ctx) => {
    const sisa = await createProject(
      ctx,
      {
        name: 'SISA',
        color: 'orange',
        description: 'Aplikasi marketplace sisa bahan makanan untuk lomba bisnis digital.',
        team: ['Fauzan', 'Rani', 'Dimas'],
        links: [{ name: 'Proposal', url: 'https://docs.google.com/document/d/contoh' }],
      },
      T0,
    );
    const go = await createProject(ctx, { name: 'GO-Heal', color: 'purple', description: 'Riset layanan kesehatan mental kampus.' }, T0);
    const pkm = await createProject(ctx, { name: 'PKM Kewirausahaan', color: 'yellow' }, T0);
    await createProject(ctx, { name: 'Lomba UI/UX', color: 'blue' }, T0);

    await createSession(ctx, sisa.id, { name: 'Riset', startDate: D(-24), endDate: D(-9), goals: 'Validasi masalah.' }, T0);
    const proto = await createSession(
      ctx,
      sisa.id,
      { name: 'Prototype', startDate: D(-8), endDate: D(8), description: 'Membangun prototype utama.', goals: 'Prototype bisa diuji 5 pengguna.' },
      T0,
    );
    await createSession(ctx, sisa.id, { name: 'Uji', startDate: D(9), endDate: D(26) }, T0);
    const riset = await createSession(ctx, go.id, { name: 'Riset', startDate: D(-10), endDate: D(1) }, T0);
    await createSession(ctx, go.id, { name: 'Desain UI', startDate: D(3), endDate: D(20) }, T0);
    await createSession(ctx, pkm.id, { name: 'Penyusunan proposal', startDate: D(9), endDate: D(30) }, T0);

    const t = async (name: string, o: { sessionId?: string; label?: string; d: number; time?: string; dif: number }) =>
      (
        await createTask(
          ctx,
          {
            name,
            kind: o.sessionId ? 'projek' : 'mandiri',
            sessionId: o.sessionId,
            labelName: o.label,
            deadlineDate: D(o.d),
            deadlineTime: o.time,
            difficulty: o.dif,
          },
          T0,
        )
      ).id;
    return {
      jarkom: await t('Tugas jaringan komputer', { label: 'Tugas kuliah', d: -2, dif: 3 }),
      wawancara: await t('Wawancara pengguna', { sessionId: riset.id, d: -1, dif: 4 }),
      bmc: await t('Revisi BMC', { sessionId: proto.id, d: 1, dif: 4 }),
      laporan: await t('Laporan praktikum modul 5', { label: 'Tugas kuliah', d: 1, time: '08:00', dif: 3 }),
      kuis: await t('Kuis statistika bab 4', { label: 'Tugas kuliah', d: 0, time: '23:59', dif: 2 }),
      katalog: await t('Prototype halaman katalog', { sessionId: proto.id, d: 3, dif: 5 }),
      esai: await t('Esai kewarganegaraan', { label: 'Tugas kuliah', d: 4, time: '10:00', dif: 2 }),
      checkout: await t('Uji alur checkout', { sessionId: proto.id, d: 6, dif: 3 }),
      jurnal: await t('Rangkuman jurnal riset', { sessionId: riset.id, d: -3, dif: 2 }),
      lpj: await t('Laporan pertanggungjawaban acara', { label: 'Kepanitiaan', d: 10, dif: 3 }),
    };
  });

  // Riwayat 6 hari terakhir.
  type Step = { id: keyof typeof ids; check?: boolean; to?: number; note?: string };
  const plan: Step[][] = [
    [{ id: 'wawancara', check: true, to: 3, note: 'Menyusun daftar pertanyaan wawancara.' }, { id: 'jarkom', check: true, to: 2, note: 'Membaca modul subnetting.' }, { id: 'jurnal', check: true, to: 5, note: 'Merangkum tiga jurnal.' }],
    [{ id: 'bmc', check: true, to: 2, note: 'Membaca ulang catatan revisi dari juri.' }, { id: 'jarkom' }, { id: 'katalog', check: true, to: 1, note: 'Wireframe kasar katalog.' }, { id: 'laporan' }],
    [{ id: 'katalog', check: true, to: 3, note: 'Komponen kartu produk.' }, { id: 'jarkom', check: true, to: 3, note: 'Latihan soal bagian 2.' }, { id: 'laporan', check: true, to: 2, note: 'Bab pendahuluan.' }, { id: 'esai', check: true }],
    [{ id: 'bmc', check: true, to: 4, note: 'Value proposition ditulis ulang.' }, { id: 'jarkom' }, { id: 'wawancara', to: 5, note: 'Menghubungi tiga calon responden.' }],
    [{ id: 'wawancara', check: true, to: 7, note: 'Wawancara dua responden.' }, { id: 'jarkom', check: true, to: 4, note: 'Mengerjakan soal 1–5.' }],
    [{ id: 'bmc', check: true, to: 6, note: 'Struktur biaya dirapikan dan disesuaikan dengan model bisnis.' }, { id: 'katalog', check: true }, { id: 'checkout' }, { id: 'kuis', check: true }, { id: 'esai' }],
  ];
  for (const [i, steps] of plan.entries()) {
    const day = D(i - 6);
    setNowForTesting(at(day, '07:30'));
    await inTransaction(async (ctx) => {
      await prosesPergantianHari(ctx, day);
      await addToTodo(ctx, day, steps.map((s) => ids[s.id]), day);
      await lockTodo(ctx, day, day);
    });
    setNowForTesting(at(day, '20:00'));
    await inTransaction(async (ctx) => {
      for (const s of steps) {
        if (s.check) await checkTodoItem(ctx, ids[s.id], true, day);
        if (s.to !== undefined) await updateProgress(ctx, { taskId: ids[s.id], after: s.to, description: s.note! }, day);
      }
    });
  }
  // Hari ini: rancangan belum dikunci, plus rancangan besok.
  setNowForTesting(at(realToday, '07:00'));
  await inTransaction(async (ctx) => {
    await prosesPergantianHari(ctx, realToday);
    await addToTodo(ctx, realToday, [ids.jarkom, ids.wawancara, ids.bmc, ids.laporan], realToday);
    await addToTodo(ctx, D(1), [ids.katalog, ids.checkout, ids.esai], realToday);
  });
  setNowForTesting(null);
  console.log('Data contoh dibuat.');
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
