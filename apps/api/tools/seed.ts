/**
 * Mengisi trust_seeds. Ini SATU-SATUNYA kepercayaan yang disuntik manusia ke
 * seluruh sistem — semua angka lain dihitung darinya.
 *
 * Pakai: tsx tools/seed.ts 0xalamat "catatan kenapa dipercaya" [bobot]
 */
import { createSupabase } from "../src/db";

const [address, note = "", weight = "1"] = process.argv.slice(2);
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("Pakai: tsx tools/seed.ts <alamat> [catatan] [bobot]");
  process.exit(1);
}
if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) {
  console.error("bobot harus angka lebih besar dari 0");
  process.exit(1);
}
// Posisi argumen [note] [bobot]: kalau argumen kedua dilewati (mis. "tsx
// tools/seed.ts 0x... 5"), note diam-diam menjadi "5" dan bobot diam-diam
// tetap 1 — bukan salah SINTAKS, jadi tidak pernah dilempar sebagai error,
// hanya salah ARTI. Ini satu-satunya kepercayaan yang disuntik manusia ke
// seluruh sistem (spec fase §12 butir 2); salah pakai di sini tidak boleh
// lolos diam-diam.
if (note.trim().length > 0 && Number.isFinite(Number(note))) {
  console.error(
    `peringatan: catatan "${note}" terbaca sebagai angka — kemungkinan besar ` +
    `argumen [bobot] tertukar posisi dengan [catatan]. Pakai: ` +
    `tsx tools/seed.ts <alamat> [catatan] [bobot]`,
  );
}

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const { error } = await db.from("trust_seeds").upsert(
  { address: address.toLowerCase(), note, weight: Number(weight) },
  { onConflict: "address" },
);

if (error) {
  console.error("gagal:", error.message);
  process.exit(1);
}
console.log(`seed ditambahkan: ${address.toLowerCase()} (bobot ${weight})`);
