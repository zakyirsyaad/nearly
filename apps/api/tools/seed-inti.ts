/**
 * Mengisi trust_seeds dari CSV panitia & juri, lalu SATU KALI hitung ulang
 * trust (spec 6 §7). Tanpa --jalankan hanya uji coba: tidak ada yang ditulis.
 *
 * Pakai (dari apps/api):
 *   node --env-file=<berkas env> --import=tsx tools/seed-inti.ts <berkas.csv> [--jalankan]
 *
 * CSV: address,catatan,bobot — baris kosong dan baris diawali # diabaikan.
 */
import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { createSupabase } from "../src/db";
import { createAttestor } from "../src/trust/attestor";
import { createTrustStore } from "../src/trust/store";
import { recomputeTrust } from "../src/trust/recompute";
import { bacaArgumen, jalankanSeedInti } from "./seed-inti-logika";

function wajib(nama: string): string {
  const v = process.env[nama];
  if (!v) throw new Error(`env ${nama} wajib diisi untuk --jalankan`);
  return v;
}

const arg = bacaArgumen(process.argv.slice(2));
if (!arg) {
  console.error("Pakai: tools/seed-inti.ts <berkas.csv> [--jalankan]");
  process.exit(1);
}

const teks = readFileSync(arg.berkas, "utf8");

// Klien Supabase dan relayer dibuat MALAS, di dalam fungsi: uji coba tidak
// butuh env apa pun dan tidak boleh bisa menulis walau env-nya lengkap.
const kode = await jalankanSeedInti(teks, arg.jalankan, {
  async upsertSeeds(baris) {
    const db = createSupabase(wajib("SUPABASE_URL"), wajib("SUPABASE_SERVICE_ROLE_KEY"));
    const { error } = await db.from("trust_seeds").upsert(
      baris.map((b) => ({ address: b.address, note: b.catatan, weight: b.bobot })),
      { onConflict: "address" },
    );
    if (error) throw new Error(`upsert trust_seeds gagal: ${error.message}`);
  },
  async hitungUlang() {
    const db = createSupabase(wajib("SUPABASE_URL"), wajib("SUPABASE_SERVICE_ROLE_KEY"));
    // Jalur yang sama persis dengan tools/recompute.ts.
    return recomputeTrust({
      trust: createTrustStore(db),
      attestor: createAttestor({
        rpcUrl: wajib("RPC_URL"),
        privateKey: wajib("RELAYER_PRIVATE_KEY") as Hex,
        attestor: wajib("TRUST_ATTESTOR_ADDRESS") as Address,
      }),
      nowMs: () => Date.now(),
    });
  },
  cetak: (s) => console.log(s),
  galat: (s) => console.error(s),
});
process.exit(kode);
