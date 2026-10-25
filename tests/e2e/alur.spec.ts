import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

// Empat alur utama Catat, dijalankan berurutan pada database kosong.
test.describe.configure({ mode: 'serial' });

function ymd(offset = 0) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
}

async function fillTaskForm(page: Page, o: { name: string; date: string; difficulty: number; label?: string }) {
  const dlg = page.getByRole('dialog');
  if (o.label) {
    await dlg.getByLabel('Label (wajib)').fill(o.label);
    await dlg.getByLabel('Nama task').click();
  }
  await dlg.getByLabel('Nama task').fill(o.name);
  await dlg.getByLabel('Tanggal deadline').fill(o.date);
  await dlg.getByRole('radio', { name: String(o.difficulty) }).click();
  await dlg.getByRole('button', { name: 'Simpan task' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('1. Projek: buat projek, sesi, dan task projek', async ({ page }) => {
  await page.goto('/projek');
  await page.getByRole('button', { name: 'Projek' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nama projek').fill('Lomba Business Plan');
  await dlg.getByRole('radio', { name: /Oranye/ }).click();
  await dlg.getByRole('button', { name: 'Buat projek' }).click();
  await expect(page).toHaveURL(/\/projek\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lomba Business Plan');
  await expect(page.getByText('Belum dijadwalkan').first()).toBeVisible();

  // Sesi yang bertabrakan ditolak, lalu sesi valid disimpan.
  await page.getByRole('button', { name: 'Sesi', exact: true }).click();
  const s = page.getByRole('dialog');
  await s.getByLabel('Nama sesi').fill('Riset');
  await s.getByLabel('Tanggal mulai').fill(ymd(-2));
  await s.getByLabel('Tanggal selesai').fill(ymd(10));
  await s.getByRole('button', { name: 'Simpan sesi' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Berjalan').first()).toBeVisible();

  await page.getByRole('button', { name: 'Sesi', exact: true }).click();
  await page.getByLabel('Nama sesi').fill('Bentrok');
  await page.getByLabel('Tanggal mulai').fill(ymd(5));
  await page.getByLabel('Tanggal selesai').fill(ymd(12));
  await page.getByRole('button', { name: 'Simpan sesi' }).click();
  await expect(page.getByText(/bertabrakan dengan sesi "Riset"/)).toBeVisible();
  await page.getByRole('button', { name: 'Batal' }).click();

  // Task projek: deadline di luar sesi ditolak.
  await page.getByRole('button', { name: 'Task', exact: true }).first().click();
  await fillTaskForm(page, { name: 'Wawancara calon pengguna', date: ymd(3), difficulty: 4 });
  await expect(page.getByRole('button', { name: 'Wawancara calon pengguna', exact: true })).toBeVisible();

  // Warna oranye sekarang dipakai: tidak bisa dipilih projek lain.
  await page.goto('/projek?o=projek-baru');
  await expect(page.getByRole('radio', { name: /Oranye/ })).toHaveAttribute('aria-disabled', 'true');
});

test('2. To-do: susun, kunci, ceklis, dan perbarui progress sampai selesai', async ({ page }) => {
  await page.goto('/task?o=task-baru');
  await fillTaskForm(page, { name: 'Tugas jaringan komputer', date: ymd(1), difficulty: 3, label: 'Tugas kuliah' });

  await page.goto('/todo');
  await page.getByRole('button', { name: /Tambah Tugas jaringan komputer/ }).click();
  await page.getByRole('button', { name: /Tambah Wawancara calon pengguna/ }).click();
  await expect(page.getByText('2 task').first()).toBeVisible();

  await page.getByRole('button', { name: 'Kunci to-do' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kunci to-do' }).click();
  await expect(page.getByText(/Terkunci pukul/)).toBeVisible();

  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Ceklis Tugas jaringan komputer' }).check();
  await expect(page.getByText('1 dari 2 diceklis')).toBeVisible();

  await page.getByRole('button', { name: 'Tugas jaringan komputer', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Perbarui progress')).toBeVisible();
  await dlg.getByRole('slider', { name: 'Progress' }).fill('10');
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(dlg.getByText('Tulis apa yang dikerjakan.')).toBeVisible();
  await dlg.getByLabel('Deskripsi progress').fill('Semua soal subnetting selesai dikerjakan.');
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByRole('status')).toHaveText('Task selesai.');
  await expect(dlg.getByText('Semua soal subnetting selesai dikerjakan.')).toBeVisible();
  await expect(dlg.getByText('0 → 10')).toBeVisible();
});

test('3. Kalender: riwayat hari ini tampil di detail hari', async ({ page }) => {
  await page.goto('/kalender');
  await expect(page.getByText(/1\/2 diceklis/)).toBeVisible();
  await page.getByRole('link', { name: /hari ini/ }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('To-do · 1 dari 2 diceklis')).toBeVisible();
  await expect(dlg.getByText('Progress 0 → 10')).toBeVisible();
  await expect(dlg.getByText('Lomba Business Plan · Riset')).toBeVisible();

  await page.goto('/kalender?v=minggu');
  await expect(page.getByText('0 → 10')).toBeVisible();
});

test('4. Data: ekspor lalu pulihkan dari file', async ({ page }, info) => {
  await page.goto('/data');
  await expect(page.getByText('Belum pernah diekspor.')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Ekspor data' }).click()]);
  const file = info.outputPath('ekspor.json');
  await download.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(json.format).toBe('catat');
  expect(json.data.tasks).toHaveLength(2);

  // Ubah data setelah ekspor, lalu pulihkan: perubahan itu hilang.
  await page.goto('/task?o=task-baru');
  await fillTaskForm(page, { name: 'Task setelah ekspor', date: ymd(2), difficulty: 1, label: 'Pribadi' });
  await page.goto('/data');
  await expect(page.locator('.stat').nth(1)).toContainText('3');

  await page.getByLabel('File ekspor').setInputFiles(file);
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Ganti seluruh data dengan file ini?')).toBeVisible();
  await dlg.getByRole('button', { name: 'Ganti data' }).click();
  await expect(page.getByRole('status')).toContainText('Data dipulihkan');
  await expect(page.locator('.stat').nth(1)).toContainText('2');

  // File rusak ditolak tanpa mengubah data.
  const bad = info.outputPath('rusak.json');
  fs.writeFileSync(bad, '{"format":"catat","version":1,"data":{}}');
  await page.getByLabel('File ekspor').setInputFiles(bad);
  await expect(page.locator('.form-error')).toContainText('rusak');
});
