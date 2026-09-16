import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  detak, JEDA_DETAK_MIN_MS, JENDELA_HADIR_MS, lihatRadar, MAKS_KARTU_RADAR, urutkanKartuRadar,
} from "../src/radar-gate";
import {
  alamat, duniaRadar, EVENT_RADAR, MENIT, SEL_JAUH, SEL_PUSAT, SEL_TETANGGA,
} from "./support/dunia-radar";

const AKU = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const D = alamat(0xd);

describe("detak — setiap langkah spec 4b+5 §5.1", () => {
  it("langkah 3: acara tidak ada → 404 event_not_found", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const r = await detak(AKU, `0x${"99".repeat(32)}`, SEL_PUSAT, d.deps);
    expect(r).toEqual({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  it("langkah 4: acara belum mulai atau sudah selesai → 409 event_tidak_berlangsung", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    for (const acara of [{ startsAt: detik + 60n, endsAt: detik + 3600n }, { startsAt: detik - 7200n, endsAt: detik - 1n }]) {
      const d = duniaRadar({ checkIn: [AKU], acara });
      expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
        .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
    }
  });

  it("langkah 5: belum check-in → 403 belum_check_in", async () => {
    const d = duniaRadar();
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("langkah 6: detak kurang dari 20 detik setelah detak terakhir → 429 terlalu_cepat", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    expect((await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps)).ok).toBe(true);
    d.jam.sekarang += JEDA_DETAK_MIN_MS - 1;
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    d.jam.sekarang += 1;
    expect((await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps)).ok).toBe(true);
  });

  it("langkah 7: tersembunyi → 200 hadir:false alasan tersembunyi, dan baris kehadiran DIHAPUS", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 5);
    d.sembunyikan(AKU);
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: false, alasan: "tersembunyi" }, baruHadir: false } });
    expect(d.db.kehadiran.size).toBe(0);
  });

  it("langkah 8: di luar geofence → 200 hadir:false alasan di_luar_area, dan baris DIHAPUS", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 5);
    const r = await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: false, alasan: "di_luar_area" }, baruHadir: false } });
    expect(d.db.kehadiran.size).toBe(0);
  });

  it("langkah 9: di dalam geofence (sel tetangga pun) → upsert, hadir:true", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const r = await detak(AKU, EVENT_RADAR, SEL_TETANGGA, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: true }, baruHadir: true } });
    expect([...d.db.kehadiran.values()]).toEqual([
      { eventId: EVENT_RADAR, address: AKU, cell: SEL_TETANGGA, seenAtMs: d.jam.sekarang },
    ]);
  });

  it("detak berulang MENIMPA baris yang sama — bukan riwayat", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    d.jam.sekarang += MENIT;
    await detak(AKU, EVENT_RADAR, SEL_TETANGGA, d.deps);
    expect(d.db.kehadiran.size).toBe(1);
    expect([...d.db.kehadiran.values()][0]!.cell).toBe(SEL_TETANGGA);
  });
});

describe("detak — transisi tidak hadir → hadir", () => {
  it("detak pertama baruHadir, detak lanjutan dalam 15 menit tidak", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const pertama = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    d.jam.sekarang += MENIT;
    const kedua = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(pertama.ok && pertama.value.baruHadir).toBe(true);
    expect(kedua.ok && kedua.value.baruHadir).toBe(false);
  });

  it("baris yang lebih tua dari 15 menit dihitung tidak hadir → baruHadir lagi", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 16);
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r.ok && r.value.baruHadir).toBe(true);
  });

  it("tepat 15 menit masih hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.db.kehadiran.set(`${EVENT_RADAR}|${AKU}`, {
      eventId: EVENT_RADAR, address: AKU, cell: SEL_PUSAT, seenAtMs: d.jam.sekarang - JENDELA_HADIR_MS,
    });
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r.ok && r.value.baruHadir).toBe(false);
  });
});

describe("detak — urutan gerbang: pemeriksaan sebelumnya menang", () => {
  it("tersembunyi + di luar area + belum check-in → belum_check_in", async () => {
    const d = duniaRadar({ tersembunyi: [AKU] });
    expect(await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("acara tidak berlangsung + belum check-in → event_tidak_berlangsung", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    const d = duniaRadar({ acara: { startsAt: detik + 60n, endsAt: detik + 3600n } });
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
  });

  it("terlalu cepat + tersembunyi + di luar area → terlalu_cepat, dan baris TIDAK dihapus", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    d.db.kehadiran.set(`${EVENT_RADAR}|${AKU}`, {
      eventId: EVENT_RADAR, address: AKU, cell: SEL_PUSAT, seenAtMs: d.jam.sekarang - 5_000,
    });
    expect(await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps))
      .toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    expect(d.db.kehadiran.size).toBe(1);
  });

  it("tersembunyi + di luar area → tersembunyi", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    const r = await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps);
    expect(r.ok && r.value.jawaban).toEqual({ hadir: false, alasan: "tersembunyi" });
  });
});

describe("lihatRadar — gerbang spec 4b+5 §5.2", () => {
  it("acara tidak ada → 404", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, `0x${"99".repeat(32)}`, d.deps))
      .toEqual({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  it("acara tidak berlangsung → 409", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    const d = duniaRadar({ checkIn: [AKU], acara: { startsAt: detik - 7200n, endsAt: detik - 1n } });
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
  });

  it("belum check-in → 403 belum_check_in", async () => {
    const d = duniaRadar();
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  // TIMBAL BALIK: tidak ada cara mengintip tanpa ikut tampil.
  it("pemanggil tersembunyi → 403 tersembunyi, walau baris kehadirannya masih ada", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(AKU);
    d.hadirkan(B);
    d.sembunyikan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "tersembunyi", httpStatus: 403 } });
  });

  it("pemanggil belum hadir (tanpa baris) → 403 belum_hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(B);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_hadir", httpStatus: 403 } });
  });

  it("pemanggil basi (> 15 menit) → 403 belum_hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(AKU, 16);
    d.hadirkan(B);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_hadir", httpStatus: 403 } });
  });

  it("urutan: tersembunyi + belum hadir + belum check-in → belum_check_in", async () => {
    const d = duniaRadar({ tersembunyi: [AKU] });
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("urutan: tersembunyi + belum hadir → tersembunyi", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "tersembunyi", httpStatus: 403 } });
  });
});

describe("lihatRadar — isi daftar", () => {
  function hadirSemua(d: ReturnType<typeof duniaRadar>, ...orang: Address[]) {
    for (const o of orang) d.hadirkan(o);
  }
  const alamatKartu = (r: Awaited<ReturnType<typeof lihatRadar>>) =>
    (r.ok ? r.value.kartu.map((k) => k.address) : null);

  it("menampilkan orang lain yang hadir, tanpa pemanggil sendiri", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([B, C]);
  });

  it("orang basi (> 15 menit) tidak tampil", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C] });
    d.hadirkan(AKU);
    d.hadirkan(B, 16);
    d.hadirkan(C, 14);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("pindah ke Tersembunyi berlaku seketika walau baris kehadiran masih ada", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    hadirSemua(d, AKU, B);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([B]);
    d.sembunyikan(B);
    expect(d.db.kehadiran.has(`${EVENT_RADAR}|${B}`)).toBe(true);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([]);
  });

  it("aku memblokir B → kartu B hilang", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], blokir: [{ blocker: AKU, blocked: B }] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("B memblokir aku → kartu B hilang juga (blokir dua arah)", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], blokir: [{ blocker: B, blocked: AKU }] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("lencana: pernah bertemu dari connections; saling ingin bertemu dari irisan tanda; sepihak tidak", async () => {
    const d = duniaRadar({
      checkIn: [AKU, B, C, D],
      koneksi: [[AKU, B]],
      tanda: [
        { who: AKU, target: C }, { who: C, target: AKU }, // saling
        { who: D, target: AKU }, // sepihak
      ],
    });
    hadirSemua(d, AKU, B, C, D);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.map((k) => [k.address, k.pernahBertemu, k.salingInginBertemu])).toEqual([
      [C, false, true], [B, true, false], [D, false, false],
    ]);
  });

  it("urutan: saling → pernah bertemu → tier tertinggi → alamat", () => {
    const k = (address: string, tier: number, pernahBertemu: boolean, salingInginBertemu: boolean) =>
      ({ address, tier, pernahBertemu, salingInginBertemu });
    const hasil = [
      k("0x5", 3, false, false), k("0x4", 0, true, false), k("0x3", 1, false, false),
      k("0x2", 0, false, true), k("0x1", 1, false, false),
    ].sort(urutkanKartuRadar).map((x) => x.address);
    expect(hasil).toEqual(["0x2", "0x4", "0x5", "0x1", "0x3"]);
  });

  it("nama dan label tier dari profilRingkas; tanpa nama tetap string kosong", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], nama: { [B]: "Budi" }, tier: { [B]: 2, [C]: 1 } });
    hadirSemua(d, AKU, B, C);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.map((x) => [x.displayName, x.tierLabel])).toEqual([
      ["Budi", "Terpercaya"], ["", "Dikenal"],
    ]);
  });

  it("tier di luar rentang berlabel Baru, bukan undefined", async () => {
    const d = duniaRadar({ checkIn: [AKU, B], tier: { [B]: 9 } });
    hadirSemua(d, AKU, B);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu[0]!.tierLabel).toBe("Baru");
  });

  it("dibatasi MAKS_KARTU_RADAR kartu, dan jumlah = kartu yang dikirim", async () => {
    const orang = Array.from({ length: MAKS_KARTU_RADAR + 5 }, (_, i) => alamat(0x1000 + i));
    const d = duniaRadar({ checkIn: [AKU, ...orang] });
    hadirSemua(d, AKU, ...orang);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.length).toBe(MAKS_KARTU_RADAR);
    expect(r.ok && r.value.jumlah).toBe(MAKS_KARTU_RADAR);
  });

  // Jumlah sebelum penyaringan akan membocorkan berapa orang disembunyikan.
  it("jumlah tidak menghitung orang yang disaring blokir atau visibilitas", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C, D], blokir: [{ blocker: B, blocked: AKU }], tersembunyi: [C] });
    hadirSemua(d, AKU, B, C, D);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value).toEqual({ kartu: [expect.objectContaining({ address: D })], jumlah: 1 });
  });

  it("setiap kartu hanya memuat kunci yang diizinkan spec §5.2", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    hadirSemua(d, AKU, B);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && Object.keys(r.value.kartu[0]!).sort()).toEqual(
      ["address", "displayName", "pernahBertemu", "salingInginBertemu", "tierLabel"],
    );
  });
});
