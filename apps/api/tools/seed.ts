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
