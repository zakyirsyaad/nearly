/**
 * Menjalankan penyapuan lokasi (spec 4b+5 §4.5) dari terminal atau cron VPS.
 * Menutup celah janji 24 jam saat API tidak menerima detak.
 *
 * Pakai (dari apps/api): node --env-file=../../.env --import=tsx tools/sapu-lokasi.ts
 */
import { createSupabase } from "../src/db";
import { createRadarStore } from "../src/radar-store";

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const hasil = await createRadarStore(db).sapuLokasi(Date.now());

console.log(
  `kehadiran ${hasil.kehadiran} · notifikasi kedekatan ${hasil.notifKedekatan}`
  + ` · sel QR salaman ${hasil.offerSalaman} · sel QR check-in ${hasil.offerCheckIn}`,
);
