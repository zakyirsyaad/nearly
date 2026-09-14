import { describe, expect, it } from "vitest";
import { GalatApi, type HalamanAcara, type HalamanGraf, type KlienGraf } from "../src/api";
import { mulaiSiklus, type Tampilan } from "../src/siklus-graf";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

function h(id: number, lengkap: boolean, a = A, b = B): HalamanGraf {
  return {
    simpul: [{ address: a, displayName: "", tierLabel: "Baru" }, { address: b, displayName: "", tierLabel: "Baru" }],
    sisi: [{ id, a, b, atMs: id, txHash: "0x" }],
    kursor: id,
    lengkap,
  };
}
const KOSONG = (kursor: number): HalamanGraf => ({ simpul: [], sisi: [], kursor, lengkap: true });

/**
 * Klien palsu yang menjawab dari antrean. Setiap jawaban berupa halaman atau
 * galat. `sejak` merekam sejakId setiap panggilan.
 */
function klienDari(antrean: (HalamanGraf | HalamanAcara | Error)[]) {
  const sejak: number[] = [];
  const berikut = async (s: number) => {
    sejak.push(s);
    const j = antrean.shift();
    if (j === undefined) throw new Error("antrean habis");
    if (j instanceof Error) throw j;
    return j;
  };
  const klien: KlienGraf = {
    jaringan: (s) => berikut(s) as Promise<HalamanGraf>,
    acara: (_id, s) => berikut(s) as Promise<HalamanAcara>,
    daftarAcara: async () => [],
  };
  return { klien, sejak };
}

/** Menjalankan siklus sampai `n` jeda tercatat, lalu menghentikannya. */
async function jalankan(klien: KlienGraf, n: number, cakupan: Parameters<typeof mulaiSiklus>[0]["cakupan"] = { jenis: "jaringan" }) {
  const jeda: number[] = [];
  const tampilan: Tampilan[] = [];
  let jam = 1_000;
  const s = mulaiSiklus({
    klien, cakupan,
    nowMs: () => (jam += 10),
    tunda: async (ms) => {
      jeda.push(ms);
      if (jeda.length >= n) s.hentikan();
    },
    saatBerubah: (t) => tampilan.push(t),
  });
  await s.selesai;
  return { jeda, tampilan, akhir: tampilan[tampilan.length - 1]! };
}

describe("siklus graf", () => {
  it("muat halaman berturut-turut tanpa jeda sampai lengkap, lalu polling 3 detik dengan kursor", async () => {
    const { klien, sejak } = klienDari([h(1, false), h(2, true, B, C), KOSONG(2)]);
    const { jeda, akhir } = await jalankan(klien, 2);
    expect(sejak).toEqual([0, 1, 2]);
    expect(jeda).toEqual([3_000, 3_000]);
    expect(akhir.status).toBe("live");
    expect(akhir.keadaan.sisi.size).toBe(2);
  });

  it("muatan awal tidak menyala; sisi dari polling sesudahnya menyala", async () => {
    const { klien } = klienDari([h(1, true), h(2, true, B, C)]);
    const { akhir } = await jalankan(klien, 2);
    expect(akhir.keadaan.sisi.get(1)!.baruSampaiMs).toBeNull();
    expect(akhir.keadaan.sisi.get(2)!.baruSampaiMs).not.toBeNull();
  });

  it("gagal: graf dipertahankan, Reconnecting, jeda 3 → 6 → 12 → 12, lalu kembali 3", async () => {
    const mati = new GalatApi(null, "jaringan", "mati");
    const { klien, sejak } = klienDari([h(1, true), mati, mati, mati, mati, KOSONG(1), KOSONG(1)]);
    const { jeda, tampilan, akhir } = await jalankan(klien, 7);
    expect(jeda).toEqual([3_000, 3_000, 6_000, 12_000, 12_000, 3_000, 3_000]);
    const saatGagal = tampilan.filter((t) => t.status === "menyambung-ulang");
    expect(saatGagal).toHaveLength(4);
    for (const t of saatGagal) expect(t.keadaan.sisi.size).toBe(1);
    expect(sejak.slice(1)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(akhir.status).toBe("live");
  });

  it("acara tidak ditemukan: berhenti tanpa mencoba ulang", async () => {
    const { klien, sejak } = klienDari([new GalatApi(404, "event_not_found", "404")]);
    const { jeda, akhir } = await jalankan(klien, 99, { jenis: "acara", eventId: "0xabc" });
    expect(jeda).toEqual([]);
    expect(sejak).toEqual([0]);
    expect(akhir.status).toBe("tidak-ditemukan");
  });

  it("mode acara menyimpan acara dan hitungan dari respons", async () => {
    const r: HalamanAcara = {
      ...h(1, true),
      acara: { eventId: "0xabc", title: "Hack", startsAt: 1, endsAt: 2, live: true },
      hitungan: { hadir: 12, salaman: 1 },
    };
    const { klien } = klienDari([r]);
    const { akhir } = await jalankan(klien, 1, { jenis: "acara", eventId: "0xabc" });
    expect(akhir.acara?.title).toBe("Hack");
    expect(akhir.hitungan).toEqual({ hadir: 12, salaman: 1 });
  });

  it("setelah dihentikan, jawaban yang terlambat tidak diteruskan ke layar", async () => {
    let lepas!: (x: HalamanGraf) => void;
    const klien: KlienGraf = {
      jaringan: () => new Promise((r) => { lepas = r; }),
      acara: async () => { throw new Error("tidak dipakai"); },
      daftarAcara: async () => [],
    };
    const tampilan: Tampilan[] = [];
    const s = mulaiSiklus({
      klien, cakupan: { jenis: "jaringan" }, nowMs: () => 0,
      tunda: async () => {}, saatBerubah: (t) => tampilan.push(t),
    });
    s.hentikan();
    lepas(h(1, true));
    await s.selesai;
    expect(tampilan).toEqual([]);
  });
});
