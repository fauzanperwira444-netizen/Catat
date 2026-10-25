// Jalankan migrasi database secara eksplisit (biasanya otomatis saat aplikasi dibuka).
import { closeDb, getDb } from '@/server/db';
import { databasePath } from '@/shared/config';

getDb()
  .then(async () => {
    console.log(`Database siap: ${databasePath()}`);
    await closeDb();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
