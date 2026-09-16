/**
 * Logika alat seed-inti.ts, murni dan teruji (spec 6 §7). Tidak membaca env,
 * berkas, maupun Supabase — semua efek samping masuk lewat `DepsSeedInti`,
 * supaya "tanpa --jalankan tidak menulis apa pun" bisa DIBUKTIKAN tes, bukan
 * sekadar diharapkan.
 */

import { isAddress } from "viem";

export type BarisSeedInti = { address: string; catatan: string; bobot: number };
export type KesalahanCsv = { baris: number; pesan: string };

export type HasilUrai =
  | { ok: true; baris: BarisSeedInti[] }
  | { ok: false; kesalahan: KesalahanCsv[] };

const HEADER = "address,catatan,bobot";
const BATAS_CATATAN = 200;
/**
 * Bobot seed terbesar yang diterima. PageRank menormalkan bobot menjadi
 * peluang teleport, jadi yang penting perbandingannya: satu seed berbobot
 * 10000 (salah ketik "1.0000"?) menelan hampir seluruh teleport dan membuat
 * seed lain tak berarti. 100 kali seed biasa sudah jauh di atas kebutuhan.
 */
export const BATAS_BOBOT_SEED = 100;
/**
 * Desimal biasa saja. `Number()` menerima "0x10" (16), "1e3" (1000), dan
 * "Infinity" — bobot yang tidak pernah dimaksud operator lolos diam-diam.
 */
const POLA_BOBOT = /^\d+(\.\d+)?$/;

/**
 * CSV `address,catatan,bobot`. Baris kosong dan baris diawali `#` diabaikan;
 * baris header persis `address,catatan,bobot` di awal boleh ada.
 *
 * SEMUA baris diperiksa dan SEMUA kesalahan dikumpulkan sebelum memutuskan —
 * satu baris salah menggagalkan seluruh berkas. Catatan tidak boleh memuat
 * koma: tanpa aturan kutip CSV, koma di catatan akan menggeser bobot diam-diam.
 */
export function uraiCsvSeedInti(teks: string): HasilUrai {
  const baris: BarisSeedInti[] = [];
  const kesalahan: KesalahanCsv[] = [];
  const dilihat = new Map<string, number>();
  let headerBoleh = true;

  teks.split(/\r?\n/).forEach((mentah, i) => {
    const nomor = i + 1;
    const isi = mentah.trim();
    if (isi === "" || isi.startsWith("#")) return;
    if (headerBoleh && isi.toLowerCase().replace(/\s+/g, "") === HEADER) {
      headerBoleh = false;
      return;
    }
    headerBoleh = false;

    const kolom = isi.split(",").map((k) => k.trim());
    if (kolom.length !== 3) {
      kesalahan.push({ baris: nomor, pesan: `harus tepat 3 kolom (address,catatan,bobot), ada ${kolom.length}` });
      return;
    }
    const [address, catatan, bobotMentah] = kolom as [string, string, string];

    let sah = true;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      kesalahan.push({ baris: nomor, pesan: `alamat tidak sah: "${address}"` });
      sah = false;
    } else if (/[a-f]/.test(address.slice(2)) && /[A-F]/.test(address.slice(2))
      && !isAddress(address, { strict: true })) {
      // Huruf campur = alamat ber-checksum EIP-55 (disalin dari dompet atau
      // BscScan). Checksum yang tidak cocok hampir pasti salah ketik satu
      // karakter — dan seed yang salah alamat memberi trust ke orang asing.
      // Huruf kecil semua atau besar semua tidak membawa checksum.
      kesalahan.push({ baris: nomor, pesan: `checksum alamat tidak cocok (salah ketik?): "${address}"` });
      sah = false;
    }
    const bobot = Number(bobotMentah);
    if (!POLA_BOBOT.test(bobotMentah) || !(bobot > 0) || bobot > BATAS_BOBOT_SEED) {
      kesalahan.push({
        baris: nomor,
        pesan: `bobot harus angka desimal lebih besar dari 0 dan paling besar ${BATAS_BOBOT_SEED}: "${bobotMentah}"`,
      });
      sah = false;
    }
    if (catatan.length > BATAS_CATATAN) {
      kesalahan.push({ baris: nomor, pesan: `catatan lebih dari ${BATAS_CATATAN} karakter` });
      sah = false;
    }
    if (sah) {
      const kunci = address.toLowerCase();
      const sebelumnya = dilihat.get(kunci);
      if (sebelumnya !== undefined) {
        kesalahan.push({ baris: nomor, pesan: `alamat berulang (sudah ada di baris ${sebelumnya}): ${kunci}` });
        return;
      }
      dilihat.set(kunci, nomor);
      baris.push({ address: kunci, catatan, bobot });
    }
  });

  if (kesalahan.length > 0) return { ok: false, kesalahan };
  if (baris.length === 0) return { ok: false, kesalahan: [{ baris: 0, pesan: "tidak ada satu pun baris seed" }] };
  return { ok: true, baris };
}

export type ArgumenSeedInti = { berkas: string; jalankan: boolean };

/**
 * `<berkas.csv> [--jalankan]`. Argumen lain apa pun — termasuk `--jalankn`
 * yang salah ketik — DITOLAK, bukan diabaikan: salah ketik yang diabaikan
 * berarti operator mengira sudah menulis padahal belum, atau sebaliknya.
 */
export function bacaArgumen(argv: string[]): ArgumenSeedInti | null {
  const jalankan = argv.includes("--jalankan");
  const sisa = argv.filter((a) => a !== "--jalankan");
  if (sisa.length !== 1 || sisa[0]!.startsWith("-")) return null;
  if (argv.filter((a) => a === "--jalankan").length > 1) return null;
  return { berkas: sisa[0]!, jalankan };
}

export type DepsSeedInti = {
  upsertSeeds(baris: BarisSeedInti[]): Promise<void>;
  hitungUlang(): Promise<{ computed: number; published: number; failed: number }>;
  cetak(s: string): void;
  galat(s: string): void;
};

export const PERINGATAN_RELAYER =
  "PERINGATAN: hitung ulang dapat mengirim transaksi setScore lewat relayer untuk SETIAP alamat "
  + "yang tier-nya berubah. Pastikan saldo tBNB relayer cukup sebelum --jalankan.";

/** Mengembalikan kode keluar proses. */
export async function jalankanSeedInti(
  teksCsv: string, jalankan: boolean, deps: DepsSeedInti,
): Promise<number> {
  const hasil = uraiCsvSeedInti(teksCsv);
  if (!hasil.ok) {
    deps.galat("CSV ditolak — TIDAK ADA yang ditulis:");
    for (const k of hasil.kesalahan) deps.galat(`  baris ${k.baris}: ${k.pesan}`);
    return 1;
  }

  deps.cetak(`${hasil.baris.length} seed akan di-upsert ke trust_seeds:`);
  for (const b of hasil.baris) deps.cetak(`  ${b.address}  bobot ${b.bobot}  ${b.catatan}`);
  deps.cetak(PERINGATAN_RELAYER);

  if (!jalankan) {
    deps.cetak("Uji coba: tidak ada yang ditulis. Tambahkan --jalankan untuk menulis.");
    return 0;
  }

  await deps.upsertSeeds(hasil.baris);
  deps.cetak("seed ditulis. Menghitung ulang trust (satu kali)…");
  const out = await deps.hitungUlang();
  deps.cetak(`dihitung ${out.computed} alamat · dipublikasi ${out.published} · gagal ${out.failed}`);
  return out.failed > 0 ? 2 : 0;
}
