import { GalatApi, type AcaraApi, type HalamanAcara, type HalamanGraf, type HitunganAcara, type KlienGraf } from "./api";
import { gabungHalaman, gantiHalaman, KEADAAN_KOSONG, type KeadaanGraf } from "./gabung-graf";
import { jedaBerikutnya } from "./jeda";

/**
 * Siklus muat-dan-polling layar /live (spec 6 §6.2), lepas dari React supaya
 * bisa diuji dengan jam dan klien palsu:
 *
 * 1. muat halaman berturut-turut TANPA jeda sampai `lengkap: true`;
 * 2. lalu polling tiap 3 detik dengan `sejakId = max(0, kursor − TUMPANG_KURSOR)`;
 * 3. gagal → status "menyambung-ulang", graf yang sudah ada DIPERTAHANKAN,
 *    coba lagi dengan jeda 3 → 6 → 12 detik; berhasil → kembali 3 detik;
 * 4. acara tidak ada (404) → berhenti; mencoba ulang tidak akan menolong;
 * 5. mode acara: bila `hitungan.salaman` ≠ jumlah sisi yang dimiliki, atau
 *    sudah `MUAT_ULANG_ACARA_MS` sejak muat penuh terakhir, muat ulang dari
 *    `sejakId = 0` dan GANTI himpunan sisi (catatan 2026-09-17 di §6.2).
 *
 * Mengganti cakupan = hentikan siklus ini, mulai siklus baru dari keadaan kosong.
 */

/**
 * Polling membaca ulang sekian id di bawah kursor. `connections.id` adalah
 * bigserial: dua salaman bersamaan bisa COMMIT tidak berurutan (id 11 terlihat
 * sebelum id 10). Tanpa tumpang tindih, polling di sela itu memajukan kursor
 * ke 11 dan id 10 tidak pernah tergambar. Gabung idempoten per `id`, jadi
 * baris yang terbaca dua kali tidak menggandakan apa pun.
 */
export const TUMPANG_KURSOR = 50;

/**
 * Muat ulang penuh berkala di mode acara. Pemeriksaan hitungan menangkap
 * hampir semua perubahan keanggotaan, tapi tidak pertukaran yang jumlahnya
 * sama (satu sisi masuk, satu pindah ke acara lain di polling yang sama).
 * Server menyimpan hasil acara per `eventId` (spec 6 §4.5), jadi satu muat
 * ulang per menit per layar hampir gratis.
 */
export const MUAT_ULANG_ACARA_MS = 60_000;

export type Cakupan = { jenis: "jaringan" } | { jenis: "acara"; eventId: string };
export type StatusSiklus = "memuat" | "live" | "menyambung-ulang" | "tidak-ditemukan";

export type Tampilan = {
  keadaan: KeadaanGraf;
  status: StatusSiklus;
  acara: AcaraApi | null;
  hitungan: HitunganAcara | null;
};

export type OpsiSiklus = {
  klien: KlienGraf;
  cakupan: Cakupan;
  nowMs: () => number;
  tunda: (ms: number) => Promise<void>;
  saatBerubah: (t: Tampilan) => void;
};

export function mulaiSiklus(o: OpsiSiklus): { hentikan: () => void; selesai: Promise<void> } {
  let hidup = true;
  let t: Tampilan = { keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null };
  let gagalBeruntun = 0;
  let sudahLengkap = false;
  /** Halaman muat ulang penuh yang sedang dikumpulkan; null = tidak sedang memuat ulang. */
  let muatUlang: HalamanGraf[] | null = null;
  let muatPenuhTerakhirMs = 0;

  const kirim = (baru: Tampilan) => {
    t = baru;
    if (hidup) o.saatBerubah(t);
  };

  function sejakBerikutnya(): number {
    if (muatUlang !== null) return muatUlang[muatUlang.length - 1]?.kursor ?? 0;
    // Muatan awal persis di kursor: halaman-halamannya berurutan dan tumpang
    // tindih di sana hanya mengulang 50 sisi per halaman.
    if (!sudahLengkap) return t.keadaan.kursor;
    return Math.max(0, t.keadaan.kursor - TUMPANG_KURSOR);
  }

  async function satuPermintaan(): Promise<HalamanGraf | HalamanAcara> {
    const sejakId = sejakBerikutnya();
    return o.cakupan.jenis === "acara"
      ? o.klien.acara(o.cakupan.eventId, sejakId)
      : o.klien.jaringan(sejakId);
  }

  const selesai = (async () => {
    while (hidup) {
      try {
        const h = await satuPermintaan();
        if (!hidup) return;
        gagalBeruntun = 0;
        const acara = "acara" in h ? h.acara : t.acara;
        const hitungan = "hitungan" in h ? h.hitungan : t.hitungan;

        if (muatUlang !== null) {
          // Graf lama tetap di layar selama halaman-halaman muat ulang dikumpulkan.
          muatUlang.push(h);
          if (!h.lengkap) continue;
          const keadaan = gantiHalaman(t.keadaan, muatUlang, { nowMs: o.nowMs(), sorot: true });
          muatUlang = null;
          muatPenuhTerakhirMs = o.nowMs();
          kirim({ keadaan, status: "live", acara, hitungan });
          // Sengaja TANPA memeriksa hitungan lagi di sini: bila server terus
          // tidak konsisten, muat ulang beruntun tanpa jeda akan membanjirinya.
        } else {
          const lengkapSebelumnya = sudahLengkap;
          const keadaan = gabungHalaman(t.keadaan, h, { nowMs: o.nowMs(), sorot: sudahLengkap });
          if (h.lengkap && !sudahLengkap) {
            sudahLengkap = true;
            muatPenuhTerakhirMs = o.nowMs();
          }
          kirim({ keadaan, status: sudahLengkap ? "live" : "memuat", acara, hitungan });
          // Masih ada halaman: ambil segera, tanpa jeda.
          if (!h.lengkap) continue;
          if (
            lengkapSebelumnya && o.cakupan.jenis === "acara" && hitungan !== null
            && (hitungan.salaman !== keadaan.sisi.size || o.nowMs() - muatPenuhTerakhirMs >= MUAT_ULANG_ACARA_MS)
          ) {
            // Segera, tanpa jeda: inilah momen yang sedang ditonton ruangan.
            muatUlang = [];
            continue;
          }
        }
      } catch (e) {
        if (!hidup) return;
        if (e instanceof GalatApi && e.status === 404) {
          kirim({ ...t, status: "tidak-ditemukan" });
          return;
        }
        gagalBeruntun += 1;
        kirim({ ...t, status: "menyambung-ulang" });
      }
      await o.tunda(jedaBerikutnya(gagalBeruntun));
    }
  })();

  return {
    hentikan: () => { hidup = false; },
    selesai,
  };
}
