import { GalatApi, type AcaraApi, type HalamanAcara, type HalamanGraf, type HitunganAcara, type KlienGraf } from "./api";
import { gabungHalaman, KEADAAN_KOSONG, type KeadaanGraf } from "./gabung-graf";
import { jedaBerikutnya } from "./jeda";

/**
 * Siklus muat-dan-polling layar /live (spec 6 §6.2), lepas dari React supaya
 * bisa diuji dengan jam dan klien palsu:
 *
 * 1. muat halaman berturut-turut TANPA jeda sampai `lengkap: true`;
 * 2. lalu polling tiap 3 detik dengan `sejakId = kursor`;
 * 3. gagal → status "menyambung-ulang", graf yang sudah ada DIPERTAHANKAN,
 *    coba lagi dengan jeda 3 → 6 → 12 detik; berhasil → kembali 3 detik;
 * 4. acara tidak ada (404) → berhenti; mencoba ulang tidak akan menolong.
 *
 * Mengganti cakupan = hentikan siklus ini, mulai siklus baru dari keadaan kosong.
 */

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

  const kirim = (baru: Tampilan) => {
    t = baru;
    if (hidup) o.saatBerubah(t);
  };

  async function satuPermintaan(): Promise<HalamanGraf | HalamanAcara> {
    return o.cakupan.jenis === "acara"
      ? o.klien.acara(o.cakupan.eventId, t.keadaan.kursor)
      : o.klien.jaringan(t.keadaan.kursor);
  }

  const selesai = (async () => {
    while (hidup) {
      try {
        const h = await satuPermintaan();
        if (!hidup) return;
        gagalBeruntun = 0;
        const keadaan = gabungHalaman(t.keadaan, h, { nowMs: o.nowMs(), sorot: sudahLengkap });
        if (h.lengkap) sudahLengkap = true;
        const acara = "acara" in h ? h.acara : t.acara;
        const hitungan = "hitungan" in h ? h.hitungan : t.hitungan;
        kirim({ keadaan, status: sudahLengkap ? "live" : "memuat", acara, hitungan });
        // Masih ada halaman: ambil segera, tanpa jeda.
        if (!h.lengkap) continue;
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
