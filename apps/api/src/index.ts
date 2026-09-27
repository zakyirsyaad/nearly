import { serve } from "@hono/node-server";
import { buatAplikasiProduksi } from "./aplikasi-produksi";
import { sapuLokasiAman } from "./penyapu-lokasi";
import { bacaHost, bacaPort } from "./server-env";

/**
 * Entri server Node: pengembangan lokal dan penyebaran berbasis proses.
 * Penyebaran serverless memakai `api/index.ts`, dan keduanya berbagi
 * `buatAplikasiProduksi()`.
 */
const { app, radar } = buatAplikasiProduksi();

const port = bacaPort(process.env.PORT);
const hostname = bacaHost(process.env.HOST);
serve({ fetch: app.fetch, port, hostname });
console.log(`API Nearly berjalan di http://${hostname ?? "localhost"}:${port}`);


// Fase 4b + 5 (spec §4.5, R3): sapuan lokasi saat API mulai. Di Vercel tidak
// ada "mulai", jadi di sana sapuan itu dijalankan cron — lihat vercel.json.
void sapuLokasiAman(radar, Date.now());
