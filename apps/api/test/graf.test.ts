import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  alamatDiSisi, BATAS_HALAMAN, BATAS_JENDELA_ACARA_GRAF_DETIK, bacaEventId, bacaSejakId, hitungHadir,
  jendelaAcaraDidukung, keAcaraPublik, keSisiPublik, labelTier, potongHalaman, sisiAcara, susunSimpul,
} from "../src/graf";
import type { AcaraGraf, CheckInGraf, KoneksiGraf } from "../src/ports";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;
const C = "0x00000000000000000000000000000000000000CC" as Address;

function sisi(n: number, mulai = 1): KoneksiGraf[] {
  return Array.from({ length: n }, (_, i) => ({
    id: mulai + i, a: A, b: B, atMs: 1_000 + i, txHash: `0x${"ab".repeat(32)}` as Hex,
  }));
}

describe("potongHalaman", () => {
  it("memotong di batas halaman dan menandai belum lengkap", () => {
    const h = potongHalaman(sisi(BATAS_HALAMAN + 1), 0);
    expect(h.sisi).toHaveLength(BATAS_HALAMAN);
    expect(h.kursor).toBe(BATAS_HALAMAN);
    expect(h.lengkap).toBe(false);
  });

  it("tepat sebanyak batas berarti lengkap", () => {
    const h = potongHalaman(sisi(BATAS_HALAMAN), 0);
    expect(h.sisi).toHaveLength(BATAS_HALAMAN);
    expect(h.lengkap).toBe(true);
  });

  it("kursor adalah id terbesar di halaman", () => {
    expect(potongHalaman(sisi(3, 41), 40).kursor).toBe(43);
  });

  it("halaman kosong mengembalikan sejakId apa adanya — kursor tidak pernah mundur", () => {
    expect(potongHalaman([], 42)).toEqual({ sisi: [], kursor: 42, lengkap: true });
  });
});

describe("simpul", () => {
  it("alamat unik huruf kecil dari kedua ujung sisi", () => {
    expect(alamatDiSisi(sisi(3))).toEqual([A.toLowerCase(), B.toLowerCase()]);
  });

  it("tanpa snapshot → Baru", () => {
    expect(susunSimpul([A], new Map())).toEqual([
      { address: A.toLowerCase(), displayName: "", tierLabel: "Baru" },
    ]);
  });

  it("tier di luar rentang → Baru, bukan undefined", () => {
    expect(labelTier(7)).toBe("Baru");
    expect(labelTier(-1)).toBe("Baru");
    expect(labelTier(undefined)).toBe("Baru");
  });

  it("nama tampilan dan label tier dari profil", () => {
    const profil = new Map([[A.toLowerCase(), { displayName: "Budi", tier: 3 }]]);
    expect(susunSimpul([A], profil)).toEqual([
      { address: A.toLowerCase(), displayName: "Budi", tierLabel: "Inti" },
    ]);
  });
});

describe("keSisiPublik", () => {
  it("menyaring kunci satu per satu dan menormalkan alamat huruf kecil", () => {
    const input: KoneksiGraf & { cell?: string; nonce?: string } = {
      id: 1,
      a: A,
      b: B,
      atMs: 5000,
      txHash: `0x${"11".repeat(32)}` as Hex,
      cell: "qqqqqqq",
      nonce: "0x123",
    };
    const hasil = keSisiPublik(input);
    expect(hasil).toEqual({
      id: 1,
      a: A.toLowerCase(),
      b: B.toLowerCase(),
      atMs: 5000,
      txHash: `0x${"11".repeat(32)}`,
    });
    expect(Object.keys(hasil).sort()).toEqual(["a", "atMs", "b", "id", "txHash"]);
  });
});

describe("keAcaraPublik", () => {
  const ev = { eventId: `0x${"11".repeat(32)}` as Hex, title: "Hack", startsAt: 100, endsAt: 200 };

  it("live hanya di dalam jendela, inklusif", () => {
    expect(keAcaraPublik(ev, 99).live).toBe(false);
    expect(keAcaraPublik(ev, 100).live).toBe(true);
    expect(keAcaraPublik(ev, 200).live).toBe(true);
    expect(keAcaraPublik(ev, 201).live).toBe(false);
  });
});

describe("jendelaAcaraDidukung", () => {
  const ev = (startsAt: number, endsAt: number) => ({ eventId: `0x${"11".repeat(32)}` as Hex, title: "x", startsAt, endsAt });

  it("paling lama 7 hari, inklusif", () => {
    expect(BATAS_JENDELA_ACARA_GRAF_DETIK).toBe(7 * 86_400);
    expect(jendelaAcaraDidukung(ev(1_000, 1_000 + 7 * 86_400))).toBe(true);
    expect(jendelaAcaraDidukung(ev(1_000, 1_000 + 7 * 86_400 + 1))).toBe(false);
  });

  it("jendela terbalik, bukan bilangan bulat aman, atau di luar rentang Date → tidak didukung", () => {
    expect(jendelaAcaraDidukung(ev(2_000, 1_000))).toBe(false);
    expect(jendelaAcaraDidukung(ev(Number.NaN, 1_000))).toBe(false);
    expect(jendelaAcaraDidukung(ev(1.5, 100))).toBe(false);
    expect(jendelaAcaraDidukung(ev(-100, 100))).toBe(false);
    expect(jendelaAcaraDidukung(ev(9e12, 9e12 + 60))).toBe(false);
    // Tepat di batas: akhirMs + 1 masih bisa diubah toISOString().
    const maksDetik = Math.floor((8.64e15 - 1) / 1000);
    expect(jendelaAcaraDidukung(ev(maksDetik - 60, maksDetik))).toBe(true);
    expect(() => new Date(maksDetik * 1000 + 1).toISOString()).not.toThrow();
  });
});

describe("sisiAcara", () => {
  const E1 = `0x${"11".repeat(32)}` as Hex;
  const E2 = `0x${"22".repeat(32)}` as Hex;

  const acara: AcaraGraf[] = [
    { eventId: E1, title: "Acara 1", startsAt: 100, endsAt: 200 },
    { eventId: E2, title: "Acara 2", startsAt: 150, endsAt: 250 },
  ];

  it("koneksi hanya masuk jika KEDUA pihak check-in di acara dan waktu cocok", () => {
    const checkins: CheckInGraf[] = [
      { eventId: E1, address: A },
      { eventId: E1, address: B },
    ];
    const koneksi: KoneksiGraf[] = [
      { id: 1, a: A, b: B, atMs: 150_000, txHash: `0x${"aa".repeat(32)}` as Hex },
      { id: 2, a: A, b: C, atMs: 150_000, txHash: `0x${"bb".repeat(32)}` as Hex }, // C tidak checkin
      { id: 3, a: A, b: B, atMs: 99_000, txHash: `0x${"cc".repeat(32)}` as Hex },  // sebelum mulai
      { id: 4, a: A, b: B, atMs: 201_000, txHash: `0x${"dd".repeat(32)}` as Hex }, // setelah selesai
    ];

    const hasil = sisiAcara(E1, koneksi, acara, checkins);
    expect(hasil.map((k) => k.id)).toEqual([1]);
  });

  it("acara tumpang tindih: event_id terkecil secara leksikografis yang menang (Ruling R-A)", () => {
    // Keduanya checkin di E1 dan E2
    const checkins: CheckInGraf[] = [
      { eventId: E1, address: A },
      { eventId: E1, address: B },
      { eventId: E2, address: A },
      { eventId: E2, address: B },
    ];
    // Salaman di detik 175 (175_000 ms) yang berada di irisan [150, 200]
    // E1 < E2, jadi salaman milik E1, bukan E2
    const koneksiIrisan: KoneksiGraf = {
      id: 5, a: A, b: B, atMs: 175_000, txHash: `0x${"ee".repeat(32)}` as Hex,
    };

    expect(sisiAcara(E1, [koneksiIrisan], acara, checkins).map((k) => k.id)).toEqual([5]);
    expect(sisiAcara(E2, [koneksiIrisan], acara, checkins)).toEqual([]);
  });

  it("mengembalikan sisi urut id naik", () => {
    const checkins: CheckInGraf[] = [
      { eventId: E1, address: A },
      { eventId: E1, address: B },
    ];
    const koneksi: KoneksiGraf[] = [
      { id: 10, a: A, b: B, atMs: 120_000, txHash: `0x${"aa".repeat(32)}` as Hex },
      { id: 2, a: A, b: B, atMs: 130_000, txHash: `0x${"bb".repeat(32)}` as Hex },
      { id: 7, a: A, b: B, atMs: 140_000, txHash: `0x${"cc".repeat(32)}` as Hex },
    ];

    const hasil = sisiAcara(E1, koneksi, acara, checkins);
    expect(hasil.map((k) => k.id)).toEqual([2, 7, 10]);
  });
});

describe("hitungHadir", () => {
  it("alamat unik di acara itu saja", () => {
    const E = `0x${"11".repeat(32)}` as Hex;
    const L = `0x${"22".repeat(32)}` as Hex;
    expect(hitungHadir(E, [
      { eventId: E, address: A }, { eventId: E, address: B }, { eventId: L, address: A },
    ])).toBe(2);
  });
});

describe("masukan query", () => {
  it("sejakId kosong → 0; bilangan bulat diterima; selain itu null", () => {
    expect(bacaSejakId(undefined)).toBe(0);
    expect(bacaSejakId("")).toBe(0);
    expect(bacaSejakId("42")).toBe(42);
    expect(bacaSejakId("-1")).toBeNull();
    expect(bacaSejakId("1.5")).toBeNull();
    expect(bacaSejakId("abc")).toBeNull();
    expect(bacaSejakId("99999999999999999")).toBeNull();
  });

  it("eventId harus 0x + 64 hex, dinormalkan huruf kecil", () => {
    expect(bacaEventId(`0x${"AB".repeat(32)}`)).toBe(`0x${"ab".repeat(32)}`);
    expect(bacaEventId("0x1234")).toBeNull();
    expect(bacaEventId(`${"ab".repeat(32)}`)).toBeNull();
  });
});
