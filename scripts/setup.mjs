// Persiapan sekali jalan di Windows/macOS/Linux:
// 1) build aplikasi, 2) siapkan database, 3) buat pintasan "Catat" di Desktop (Windows).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`Catat butuh Node.js 20 atau lebih baru. Versi sekarang: ${process.versions.node}`);
  process.exit(1);
}

console.log('\n[1/3] Membangun aplikasi…');
run('npx next build');

console.log('\n[2/3] Menyiapkan database…');
run('npx tsx scripts/migrate.ts');

if (process.platform === 'win32') {
  console.log('\n[3/3] Membuat pintasan di Desktop…');
  const bat = path.join(root, 'catat.bat');
  const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Catat.lnk'))
$s.TargetPath = '${bat.replace(/'/g, "''")}'
$s.WorkingDirectory = '${root.replace(/'/g, "''")}'
$s.WindowStyle = 7
$s.Description = 'Buka Catat'
$s.Save()`;
  const psFile = path.join(os.tmpdir(), 'catat-pintasan.ps1');
  try {
    fs.writeFileSync(psFile, ps, 'utf8');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: 'inherit' });
    console.log('Pintasan "Catat" dibuat di Desktop.');
  } catch {
    console.log('Pintasan gagal dibuat. Jalankan catat.bat langsung dari folder ini.');
  }
} else {
  console.log('\n[3/3] Lewati pintasan (bukan Windows). Jalankan: npm start');
}
const dataDir = process.env.CATAT_DATA_DIR || path.join(os.homedir(), 'Documents', 'Catat');
console.log(`\nSelesai. Data tersimpan di ${dataDir}`);
console.log('Buka Catat lewat pintasan di Desktop, atau jalankan catat.bat.');
