# Catat

Aplikasi pribadi untuk menjadwalkan projek jangka panjang, task kuliah, dan to-do harian. Catat berjalan lokal di laptop. Semua data tersimpan di satu file SQLite di folder Dokumen, tanpa akun dan tanpa internet.

## Menjalankan di Windows

Butuh [Node.js](https://nodejs.org) versi 20 atau lebih baru (pilih versi LTS).

1. Unduh atau clone repo ini ke laptop.
2. Buka folder repo di Command Prompt atau PowerShell, lalu jalankan sekali:

   ```
   npm run setup
   ```

   Perintah ini memasang dependensi, membangun aplikasi, menyiapkan database, dan membuat pintasan **Catat** di Desktop.
3. Buka Catat lewat pintasan di Desktop. Server lokal menyala di latar belakang (jendela kecil yang diminimalkan) dan browser terbuka di `http://127.0.0.1:3210`.

Untuk mematikan Catat, tutup jendela "Catat" di taskbar. Bila pintasan tidak terbuat, jalankan `catat.bat` dari folder repo.

### Lokasi data

- Database: `Documents\Catat\catat.db`
- Cadangan otomatis sebelum pemulihan data: `Documents\Catat\cadangan\`

Lokasi bisa diganti dengan variabel lingkungan `CATAT_DATA_DIR`. Zona waktu default `Asia/Jakarta`, bisa diganti dengan `CATAT_TIMEZONE`. Contohnya ada di `.env.example`.

Ekspor data secara berkala dari halaman **Data**. File ekspor bisa dipakai untuk memulihkan seluruh data.

### Memperbarui Catat

Ambil versi terbaru dari repo (`git pull`), lalu jalankan `npm run setup` lagi. Data tidak tersentuh; perubahan struktur database dijalankan otomatis saat aplikasi dibuka.

## Pengembangan

```
npm install
cp .env.example .env    # data pengembangan di folder ./data
npm run db:seed         # data contoh (tambahkan -- --force untuk mengganti data)
npm run dev             # http://127.0.0.1:3210
```

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm test` | Uji unit aturan domain (Vitest) |
| `npm run test:e2e` | Uji end-to-end 4 alur utama (Playwright, memakai folder data terpisah) |
| `npm run db:generate` | Buat file migrasi setelah mengubah `src/server/schema.ts` |
| `npm run db:migrate` | Jalankan migrasi secara manual |

### Struktur

```
src/
  app/            Halaman (App Router), Server Actions, route ekspor/pulihkan
  components/     Komponen UI dan overlay
  modules/        Logika domain per fitur: projects, tasks, labels, todos, calendar, data
  server/         Skema database, koneksi, pembungkus aksi
  shared/         Waktu dan tanggal, warna, urutan task, event domain
drizzle/          Migrasi SQL
tests/            Uji unit dan e2e
```

Arsitektur singkat: UI → Server Actions → use case domain (divalidasi dengan zod) → repository → SQLite. Status projek dan status telat dihitung saat dibaca, bukan disimpan. Pembatalan ditandai, tidak menghapus riwayat. Pergantian hari diproses saat aplikasi dibuka: to-do hari sebelumnya yang belum dikunci dikunci otomatis.

Teknologi: Next.js 15, React 19, TypeScript, Drizzle ORM dengan libSQL (SQLite), Radix UI, lucide-react, Vitest, Playwright.
