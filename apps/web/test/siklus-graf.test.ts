import { describe, expect, it } from "vitest";
import { GalatApi, type HalamanAcara, type HalamanGraf, type KlienGraf } from "../src/api";
import { MUAT_ULANG_ACARA_MS, mulaiSiklus, TUMPANG_KURSOR, type Tampilan } from "../src/siklus-graf";

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
  it("muat halaman berturut-turut tanpa jeda sampai lengkap (persis di kursor), lalu polling 3 detik", async () => {
    const { klien, sejak } = klienDari([h(1, false), h(2, true, B, C), KOSONG(2)]);
    const { jeda, akhir } = await jalankan(klien, 2);
    // Polling membaca ulang TUMPANG_KURSOR id di bawah kursor 2 → dijepit ke 0.
    expect(sejak).toEqual([0, 1, 0]);
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
    // Kursor 1 dikurangi tumpang tindih, dijepit ke 0 — sama di setiap percobaan ulang.
    expect(sejak.slice(1)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(akhir.status).toBe("live");
  });

  it("acara tidak ditemukan: berhenti tanpa mencoba ulang", async () => {
    const { klien, sejak } = klienDari([new GalatApi(404, "event_not_found", "404")]);
    const { jeda, akhir } = await jalankan(klien, 99, { jenis: "acara", eventId: "0xabc" });
    expect(jeda).toEqual([]);
    expect(sejak).toEqual([0]);
    expect(akhir.status).toBe("tidak-ditemukan");
  });

  it("jendela acara tak didukung (404 event_window_unsupported): berhenti dengan status tersendiri", async () => {
    const { klien, sejak } = klienDari([new GalatApi(404, "event_window_unsupported", "404")]);
    const { jeda, akhir } = await jalankan(klien, 99, { jenis: "acara", eventId: "0xabc" });
    expect(jeda).toEqual([]);
    expect(sejak).toEqual([0]);
    expect(akhir.status).toBe("jendela-tak-didukung");
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

/**
 * Server acara palsu yang menjawab seperti API sungguhan: sisi `id > sejakId`
 * dari himpunan SAAT INI, dan `hitungan.salaman` = ukuran seluruh himpunan.
 * Himpunan bisa diubah di antara polling — meniru check-in yang datang
 * belakangan (sisi lama menjadi milik acara) atau check-in di acara tumpang
 * tindih ber-event_id lebih kecil (sisi pindah ke acara lain).
 */
function serverAcara(awal: number[]) {
  const ids = new Set(awal);
  const sejak: number[] = [];
  const ujung = (id: number) => [
    `0x${(id * 2).toString(16).padStart(40, "0")}`,
    `0x${(id * 2 + 1).toString(16).padStart(40, "0")}`,
  ] as const;
  const klien: KlienGraf = {
    jaringan: async () => { throw new Error("tidak dipakai"); },
    acara: async (_id, sejakId) => {
      sejak.push(sejakId);
      const semua = [...ids].sort((x, y) => x - y);
      const baru = semua.filter((id) => id > sejakId);
      return {
        simpul: baru.flatMap((id) => ujung(id).map((address) => ({ address, displayName: "", tierLabel: "Baru" }))),
        sisi: baru.map((id) => ({ id, a: ujung(id)[0], b: ujung(id)[1], atMs: id, txHash: "0x" })),
        kursor: baru.length ? baru[baru.length - 1]! : sejakId,
        lengkap: true,
        acara: { eventId: "0xabc", title: "Hack", startsAt: 1, endsAt: 2, live: true },
        hitungan: { hadir: 9, salaman: semua.length },
      };
    },
    daftarAcara: async () => [],
  };
  return { ids, sejak, klien, ujung };
}

/** Seperti `jalankan`, tapi jam maju sebesar jeda dan `saatJeda` bisa mengubah server. */
async function jalankanDenganJam(klien: KlienGraf, n: number, saatJeda: (ke: number) => void) {
  let jam = 1_000;
  let jeda = 0;
  const tampilan: Tampilan[] = [];
  const s = mulaiSiklus({
    klien, cakupan: { jenis: "acara", eventId: "0xabc" },
    nowMs: () => jam,
    tunda: async (ms) => {
      jam += ms;
      jeda += 1;
      saatJeda(jeda);
      // Batas keras: siklus yang rusak tidak boleh membuat tes berputar selamanya.
      if (!(jeda < n) || jeda >= 200) s.hentikan();
    },
    saatBerubah: (t) => tampilan.push(t),
  });
  await s.selesai;
  return tampilan[tampilan.length - 1]!;
}

describe("mode acara: himpunan sisi yang berubah di belakang kursor (I-1)", () => {
  it("salaman yang menjadi milik acara SETELAH kursor melewatinya tetap tergambar dan menyala", async () => {
    // id 10: salaman sebelum salah satu pihak check-in. Kursor sudah di 200.
    const srv = serverAcara([200]);
    const akhir = await jalankanDenganJam(srv.klien, 3, (ke) => { if (ke === 1) srv.ids.add(10); });
    expect([...akhir.keadaan.sisi.keys()].sort((x, y) => x - y)).toEqual([10, 200]);
    expect(akhir.keadaan.sisi.get(10)!.baruSampaiMs).not.toBeNull();
    expect(akhir.keadaan.sisi.get(200)!.baruSampaiMs).toBeNull();
    expect(akhir.hitungan?.salaman).toBe(akhir.keadaan.sisi.size);
  });

  it("sisi yang pindah ke acara lain ikut hilang, beserta simpulnya", async () => {
    const srv = serverAcara([10, 200]);
    const akhir = await jalankanDenganJam(srv.klien, 3, (ke) => { if (ke === 1) srv.ids.delete(10); });
    expect([...akhir.keadaan.sisi.keys()]).toEqual([200]);
    expect(akhir.keadaan.simpul.has(srv.ujung(10)[0])).toBe(false);
    expect(akhir.keadaan.simpul.has(srv.ujung(200)[0])).toBe(true);
  });

  it("pertukaran yang tidak mengubah hitungan tertangkap muat ulang berkala", async () => {
    const srv = serverAcara([10, 200]);
    const polling = Math.ceil(MUAT_ULANG_ACARA_MS / 3_000) + 2;
    const akhir = await jalankanDenganJam(srv.klien, polling, (ke) => {
      if (ke === 1) { srv.ids.delete(10); srv.ids.add(20); }
    });
    expect([...akhir.keadaan.sisi.keys()].sort((x, y) => x - y)).toEqual([20, 200]);
  });

  it("tanpa perubahan, tidak ada muat ulang selain yang berkala", async () => {
    const srv = serverAcara([10, 200]);
    await jalankanDenganJam(srv.klien, 5, () => {});
    expect(srv.sejak.filter((x) => x === 0)).toHaveLength(1);
  });
});

describe("polling tumpang tindih kursor (M-1)", () => {
  it("baris ber-id di bawah kursor yang commit terlambat tetap tertangkap, tanpa duplikat", async () => {
    // Dua insert bersamaan: id 480 commit SETELAH id 500 sudah terbaca.
    const ids = new Set([100, 500]);
    const sejak: number[] = [];
    const klien: KlienGraf = {
      jaringan: async (sejakId) => {
        sejak.push(sejakId);
        const baru = [...ids].sort((x, y) => x - y).filter((id) => id > sejakId);
        return {
          simpul: [],
          sisi: baru.map((id) => ({ id, a: A, b: B, atMs: id, txHash: "0x" })),
          kursor: baru.length ? baru[baru.length - 1]! : sejakId,
          lengkap: true,
        };
      },
      acara: async () => { throw new Error("tidak dipakai"); },
      daftarAcara: async () => [],
    };
    const tampilan: Tampilan[] = [];
    let jeda = 0;
    const s = mulaiSiklus({
      klien, cakupan: { jenis: "jaringan" }, nowMs: () => 0,
      tunda: async () => {
        jeda += 1;
        if (jeda === 1) ids.add(480);
        if (jeda >= 3) s.hentikan();
      },
      saatBerubah: (t) => tampilan.push(t),
    });
    await s.selesai;
    const akhir = tampilan[tampilan.length - 1]!;
    expect([...akhir.keadaan.sisi.keys()].sort((x, y) => x - y)).toEqual([100, 480, 500]);
    expect(akhir.keadaan.kursor).toBe(500);
    expect(sejak).toEqual([0, 500 - TUMPANG_KURSOR, 500 - TUMPANG_KURSOR]);
  });

  it("kursor kecil tidak pernah menghasilkan sejakId negatif", async () => {
    const { klien, sejak } = klienDari([h(3, true), KOSONG(3)]);
    await jalankan(klien, 2);
    expect(sejak).toEqual([0, 0]);
  });
});
