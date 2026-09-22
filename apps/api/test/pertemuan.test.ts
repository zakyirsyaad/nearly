import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { acaraSalaman, MAKS_ACARA_BERSAMA, susunPertemuan } from "../src/pertemuan";
import type { AcaraRingkas } from "../src/ports";
import { SEL_JAUH, SEL_PUSAT, SEL_TETANGGA } from "./support/dunia-radar";

const acara = (n: number, over: Partial<AcaraRingkas> = {}): AcaraRingkas => ({
  eventId: `0x${n.toString(16).padStart(64, "0")}` as Hex,
  title: `Acara ${n}`,
  venueLabel: `Tempat ${n}`,
  centerCell: SEL_PUSAT,
  startsAt: 1_000_000 + n * 10_000,
  endsAt: 1_000_000 + n * 10_000 + 3_600,
  ...over,
});
/** Milidetik, 60 detik setelah acara mulai. */
const diDalam = (a: AcaraRingkas) => (a.startsAt + 60) * 1000;

describe("acaraSalaman (spec desain UI §8.1)", () => {
  it("acara yang jendelanya memuat waktu salaman dan geofence-nya memuat sel koneksi", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: SEL_TETANGGA }, [a])?.eventId).toBe(a.eventId);
  });

  it("batas jendela waktu inklusif", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: a.startsAt * 1000, cell: SEL_PUSAT }, [a])).not.toBeNull();
    expect(acaraSalaman({ atMs: a.endsAt * 1000, cell: SEL_PUSAT }, [a])).not.toBeNull();
    expect(acaraSalaman({ atMs: a.startsAt * 1000 - 1, cell: SEL_PUSAT }, [a])).toBeNull();
    expect(acaraSalaman({ atMs: a.endsAt * 1000 + 1, cell: SEL_PUSAT }, [a])).toBeNull();
  });

  it("sel koneksi di luar geofence → null", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: SEL_JAUH }, [a])).toBeNull();
  });

  it("koneksi lama tanpa sel hanya diuji jendela waktunya", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: null }, [a])?.eventId).toBe(a.eventId);
  });

  it("lebih dari satu yang cocok → startsAt terbaru", () => {
    const baru = acara(2);
    const lama = acara(1, { endsAt: baru.endsAt });
    expect(acaraSalaman({ atMs: diDalam(baru), cell: SEL_PUSAT }, [lama, baru])?.eventId).toBe(baru.eventId);
  });
});

describe("susunPertemuan", () => {
  it("acaraBersama tanpa acara salaman, terbaru dulu, maks. 10; jumlah total", () => {
    const semua = Array.from({ length: 12 }, (_, i) => acara(i + 1));
    const salamanDi = semua[4]!;
    const p = susunPertemuan({ atMs: diDalam(salamanDi), cell: SEL_PUSAT }, semua);
    expect(p.salaman).toEqual({
      atMs: diDalam(salamanDi),
      acara: { eventId: salamanDi.eventId, title: "Acara 5", venueLabel: "Tempat 5" },
    });
    expect(p.jumlahAcaraBersama).toBe(11);
    expect(p.acaraBersama).toHaveLength(MAKS_ACARA_BERSAMA);
    expect(p.acaraBersama.map((a) => a.title)).toEqual([
      "Acara 12", "Acara 11", "Acara 10", "Acara 9", "Acara 8", "Acara 7", "Acara 6", "Acara 4", "Acara 3", "Acara 2",
    ]);
    expect(p.acaraBersama[0]!.startsAt).toBe(String(semua[11]!.startsAt));
  });

  it("tanpa acara salaman: acara null dan semua acara bersama dihitung", () => {
    const semua = [acara(1), acara(2)];
    const p = susunPertemuan({ atMs: 5, cell: SEL_PUSAT }, semua);
    expect(p.salaman.acara).toBeNull();
    expect(p.jumlahAcaraBersama).toBe(2);
  });

  it("himpunan kunci persis — tanpa pusat acara, akhir acara, atau sel", () => {
    const semua = [acara(1), acara(2)];
    const p = susunPertemuan({ atMs: diDalam(semua[0]!), cell: SEL_PUSAT }, semua);
    expect(Object.keys(p).sort()).toEqual(["acaraBersama", "jumlahAcaraBersama", "salaman"]);
    expect(Object.keys(p.salaman).sort()).toEqual(["acara", "atMs"]);
    expect(Object.keys(p.salaman.acara!).sort()).toEqual(["eventId", "title", "venueLabel"]);
    expect(Object.keys(p.acaraBersama[0]!).sort()).toEqual(["eventId", "startsAt", "title", "venueLabel"]);
  });
});
