import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatProfilTypedData } from "@nearly/shared";
import { profileRoutes } from "../src/routes/profile";
import type { Pertemuan } from "../src/pertemuan";
import type { AcaraRingkas } from "../src/ports";
import { duniaBlokir } from "./support/dunia-blokir";
import { duniaPertemuan } from "./support/dunia-pertemuan";
import { SEL_JAUH, SEL_PUSAT } from "./support/dunia-radar";

const aku = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const AKU = aku.address.toLowerCase() as Address;
const DIA = "0x000000000000000000000000000000000000dead" as Address;
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const alamat = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

const acara = (n: number): AcaraRingkas => ({
  eventId: `0x${n.toString(16).padStart(64, "0")}` as Hex,
  title: `Acara ${n}`,
  venueLabel: `Tempat ${n}`,
  centerCell: SEL_PUSAT,
  startsAt: 1_700_000_000 + n * 10_000,
  endsAt: 1_700_000_000 + n * 10_000 + 3_600,
});
const diDalam = (a: AcaraRingkas) => (a.startsAt + 60) * 1000;
const hadir = (a: AcaraRingkas, ...orang: Address[]) => orang.map((address) => ({ eventId: a.eventId, address }));

type Dunia = ReturnType<typeof duniaPertemuan>;
type ProfilJson = Record<string, unknown> & { pertemuan?: Pertemuan | null; dijaminKenalan?: number };

function app(dunia: Dunia, blokir: { blocker: Address; blocked: Address }[] = []) {
  const blok = duniaBlokir({ blokir });
  const deps = {
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 3),
      getDisplayName: vi.fn(async () => "Dia"),
    },
    identity: { ensName: vi.fn(async () => null), txCount: vi.fn(async () => 0) },
    meet: blok.meet,
    blokir: blok.blokir,
    pertemuan: dunia.pertemuan,
    radar: dunia.radar,
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  return new Hono().route("/", profileRoutes(deps as never));
}

/** Jalur dengan bukti LihatProfil sah dari `aku` untuk `target`. */
async function jalurTerbukti(target: Address): Promise<string> {
  const sig = await aku.signTypedData(lihatProfilTypedData({ target, who: aku.address, expiresAt: EXP }, KONTRAK));
  return `/profile/${target}?${new URLSearchParams({ who: aku.address, expiresAt: EXP.toString(), sig }).toString()}`;
}

async function profil(a: Hono, jalur: string): Promise<{ teks: string; json: ProfilJson }> {
  const res = await a.request(jalur);
  expect(res.status).toBe(200);
  const teks = await res.text();
  return { teks, json: JSON.parse(teks) as ProfilJson };
}

describe("GET /profile/:address — pertemuan (spec desain UI §8.1, §10.2)", () => {
  it("tanpa bukti: kunci baru absen, store tidak dibaca, bentuk respons publik tidak berubah", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: NOW - 1_000 }], vouch: [{ from: AKU, to: DIA }] });
    const { json } = await profil(app(d), `/profile/${DIA}?who=${aku.address}`);
    expect(Object.keys(json).sort()).toEqual(
      ["address", "connectionCount", "displayName", "ens", "inginBertemuCount", "txCount"],
    );
    expect(d.pertemuan.koneksiPasangan).not.toHaveBeenCalled();
    expect(d.pertemuan.acaraCheckInBersama).not.toHaveBeenCalled();
    expect(d.pertemuan.penjaminAktif).not.toHaveBeenCalled();
  });

  it("bukti sah + terkoneksi → waktu salaman", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: DIA, b: AKU, atMs: 1_700_000_123_000, cell: null }] });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.salaman).toEqual({ atMs: 1_700_000_123_000, acara: null });
  });

  it("salaman di acara yang keduanya check-in dan di dalam geofence → acara terisi", async () => {
    const e = acara(1);
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(e), cell: SEL_PUSAT }], acara: [e], checkIn: hadir(e, AKU, DIA),
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.salaman.acara).toEqual({ eventId: e.eventId, title: "Acara 1", venueLabel: "Tempat 1" });
  });

  it("di luar jendela waktu, di luar geofence, atau hanya satu pihak check-in → acara null", async () => {
    const e = acara(1);
    const kasus = [
      { atMs: (e.endsAt + 60) * 1000, cell: SEL_PUSAT, checkIn: hadir(e, AKU, DIA) },
      { atMs: diDalam(e), cell: SEL_JAUH, checkIn: hadir(e, AKU, DIA) },
      { atMs: diDalam(e), cell: SEL_PUSAT, checkIn: hadir(e, AKU) },
    ];
    for (const k of kasus) {
      const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: k.atMs, cell: k.cell }], acara: [e], checkIn: k.checkIn });
      const { json } = await profil(app(d), await jalurTerbukti(DIA));
      expect(json.pertemuan?.salaman.acara).toBeNull();
    }
  });

  it("acaraBersama tanpa acara salaman, terbaru dulu, maks. 10; jumlahAcaraBersama total", async () => {
    const semua = Array.from({ length: 12 }, (_, i) => acara(i + 1));
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(semua[0]!), cell: SEL_PUSAT }],
      acara: semua,
      checkIn: semua.flatMap((e) => hadir(e, AKU, DIA)),
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.jumlahAcaraBersama).toBe(11);
    expect(json.pertemuan?.acaraBersama.map((a) => a.title)).toEqual([
      "Acara 12", "Acara 11", "Acara 10", "Acara 9", "Acara 8", "Acara 7", "Acara 6", "Acara 5", "Acara 4", "Acara 3",
    ]);
  });

  it("tidak terkoneksi → pertemuan null, kuncinya tetap ada", async () => {
    const d = duniaPertemuan();
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("pertemuan" in json).toBe(true);
    expect(json.pertemuan).toBeNull();
  });

  it("profil sendiri → pertemuan null dan dijaminKenalan absen", async () => {
    const P = alamat(0x101);
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: P, atMs: 1 }], vouch: [{ from: P, to: AKU }] });
    const { json } = await profil(app(d), await jalurTerbukti(AKU));
    expect(json.pertemuan).toBeNull();
    expect("dijaminKenalan" in json).toBe(false);
  });

  it("himpunan kunci persis; tidak ada sel, tx hash, host, atau pusat acara", async () => {
    const semua = [acara(1), acara(2)];
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(semua[0]!), cell: SEL_PUSAT }],
      acara: semua,
      checkIn: semua.flatMap((e) => hadir(e, AKU, DIA)),
    });
    const { teks, json } = await profil(app(d), await jalurTerbukti(DIA));
    const p = json.pertemuan!;
    expect(Object.keys(p).sort()).toEqual(["acaraBersama", "jumlahAcaraBersama", "salaman"]);
    expect(Object.keys(p.salaman).sort()).toEqual(["acara", "atMs"]);
    expect(Object.keys(p.salaman.acara!).sort()).toEqual(["eventId", "title", "venueLabel"]);
    expect(Object.keys(p.acaraBersama[0]!).sort()).toEqual(["eventId", "startsAt", "title", "venueLabel"]);
    for (const terlarang of [SEL_PUSAT, "centerCell", "endsAt", "txHash", "tx_hash", "host", "cell"]) {
      expect(teks).not.toContain(terlarang);
    }
  });

  it("store gagal → kunci pertemuan absen, profil tetap 200 dengan bendera pribadi", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: 1 }] });
    d.pertemuan.koneksiPasangan = vi.fn(async () => { throw new Error("mati"); });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("pertemuan" in json).toBe(false);
    expect(json.sudahKutandai).toBe(false);
  });
});

describe("GET /profile/:address — dijaminKenalan (spec desain UI §8.2, §10.2)", () => {
  const P1 = alamat(0x101);
  const P2 = alamat(0x102);
  const P3 = alamat(0x103);

  it("hanya vouch aktif dari penjamin yang terkoneksi dengan pemanggil", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: P2, atMs: 1 }],
      vouch: [{ from: P1, to: DIA }, { from: P2, to: DIA, dicabut: true }, { from: P3, to: DIA }],
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("pemanggil yang juga menjamin tidak menghitung dirinya", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: DIA, atMs: 1 }],
      vouch: [{ from: AKU, to: DIA }, { from: P1, to: DIA }],
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("penjamin yang diblokir pemanggil DAN yang memblokir pemanggil tidak dihitung", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: P2, atMs: 1 }, { a: AKU, b: P3, atMs: 1 }],
      vouch: [{ from: P1, to: DIA }, { from: P2, to: DIA }, { from: P3, to: DIA }],
    });
    const blokir = [{ blocker: AKU, blocked: P1 }, { blocker: P2, blocked: AKU }];
    const { json } = await profil(app(d, blokir), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("nilai 0 dikirim sebagai 0 (kuncinya ada)", async () => {
    const d = duniaPertemuan();
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(0);
  });

  it("store gagal → kunci dijaminKenalan absen, profil tetap 200", async () => {
    const d = duniaPertemuan({ vouch: [{ from: P1, to: DIA }] });
    d.pertemuan.penjaminAktif = vi.fn(async () => { throw new Error("mati"); });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("dijaminKenalan" in json).toBe(false);
    expect("pertemuan" in json).toBe(true);
  });

  it("tanpa bukti tidak pernah membaca penjamin", async () => {
    const d = duniaPertemuan({ vouch: [{ from: P1, to: DIA }] });
    const { json } = await profil(app(d), `/profile/${DIA}`);
    expect("dijaminKenalan" in json).toBe(false);
    expect(d.pertemuan.penjaminAktif).not.toHaveBeenCalled();
  });
});
