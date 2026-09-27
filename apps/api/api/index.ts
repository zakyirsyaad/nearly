import { handle } from "@hono/node-server/vercel";
import { buatAplikasiProduksi } from "../src/aplikasi-produksi";

/**
 * Entri serverless Vercel (2026-09-27).
 *
 * Kenapa ada: VPS lama kehabisan kuota bandwidth dan jaringannya diputus
 * penyedia sampai siklus berikutnya. Semua VPS lain milik pemilik hanya
 * menyisakan 117-160 MB RAM, sementara proses API ini memuncak di ~295 MB —
 * menumpangkannya berarti memicu OOM dan mematikan proyek lain di mesin itu.
 *
 * API ini memang cocok dipindah: tidak ada timer latar (sapuan lokasi dipicu
 * per permintaan di rute radar, dan cron di vercel.json menangani yang
 * terjadwal), tidak ada tulisan ke filesystem, dan Supabase diakses lewat HTTP.
 * Satu-satunya state di server lama adalah berkas env.
 *
 * Aplikasinya dibangun sekali per instans (cold start), lalu dipakai ulang
 * selama instans itu hidup. Dependensinya identik dengan entri proses Node —
 * keduanya memanggil `buatAplikasiProduksi()`, dan ada penjaga tes untuk itu.
 */
const { app } = buatAplikasiProduksi();

export default handle(app);
