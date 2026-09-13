import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatEventTypedData } from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";
import type { BlokirStore, EventRecord, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const ATTENDANCE = "0x000000000000000000000000000000000000beef" as Address;
const A = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2" as Address;
const C = "0x00000000000000000000000000000000000000c3" as Address;
const D = "0x00000000000000000000000000000000000000d4" as Address;
const E = "0x00000000000000000000000000000000000000e5" as Address;
const ID = `0x${"1".repeat(64)}` as Hex;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

const acara: EventRecord = {
  eventId: ID, host: A, title: "Meetup", venueLabel: "Jakarta",
  centerCell: "qqguv1r", startsAt: BigInt(NOW / 1000), endsAt: BigInt(NOW / 1000 + 3600),
  txHash: "0xtx" as Hex,
};

function meetStore(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}), hitungTanda: vi.fn(async () => 0),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []), tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null), setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    ...over,
  };
}

// Fake BlokirStore dengan tepat lima metode (lihat METODE_BLOKIR_STORE di
// ports.ts) — `himpunanUntuk` kosong secara default supaya tes-tes lama
// (yang tidak peduli blokir) tetap berjalan seperti sebelum Task 10.
function blokirPalsu(over: Partial<BlokirStore> = {}): BlokirStore {
  return {
    setBlokir: vi.fn(async () => {}),
    adaBlokir: vi.fn(async () => false),
    diblokirOleh: vi.fn(async () => []),
    himpunanUntuk: vi.fn(async () => new Set<string>()),
    pemblokirUntuk: vi.fn(async () => new Set<string>()),
    ...over,
  };
}

/** Tanda dari daftar alamat, semuanya berwaktu sama. */
function tanda(...alamat: Address[]) {
  return alamat.map((address) => ({ address, atMs: NOW }));
}

// `rsvps` default 5: tepat di ambang PENANDA_HADIR_MIN_RSVP, supaya tes yang
// menegaskan isi `penandaHadir`/`kutandaiHadir` tidak ikut tersandung penjaga
// ukuran kerumunan yang diuji terpisah di bawah.
function app(meet: MeetStore, rsvpAddrs: Address[], rsvps = 5, blokir: BlokirStore = blokirPalsu()) {
  const deps = {
    events: {
      getEvent: vi.fn(async () => acara),
      attendanceSummary: vi.fn(async () => ({ rsvps, checkins: 1, rsvpBelumHadir: 2 })),
      hasRsvp: vi.fn(async () => true),
      hasCheckIn: vi.fn(async () => false),
      rsvpAddresses: vi.fn(async () => rsvpAddrs),
      listDiscovery: vi.fn(async () => []),
      recordEvent: vi.fn(async () => {}), recordRsvp: vi.fn(async () => {}),
      putCheckInOffer: vi.fn(async () => {}), getCheckInOffer: vi.fn(async () => null),
      consumeCheckInOffer: vi.fn(async () => {}), recordCheckIn: vi.fn(async () => {}),
    },
    attendance: { submitCreateEvent: vi.fn(), submitCheckIn: vi.fn() },
    profiles: { listConnections: vi.fn(), countConnections: vi.fn(), getDisplayName: vi.fn() },
    attendanceContract: ATTENDANCE,
    nowMs: () => NOW,
    onChanged: vi.fn(async () => {}),
    meet,
    blokir,
  };
  const a = new Hono();
  a.route("/", eventRoutes(deps as never));
  return a;
}

async function kueriTerbukti() {
  const sig = await aku.signTypedData(
    lihatEventTypedData({ eventId: ID, who: aku.address, expiresAt: EXP }, ATTENDANCE));
  const q = new URLSearchParams({ who: aku.address, expiresAt: EXP.toString(), sig });
  return `/events/${ID}?${q.toString()}`;
}

describe("kutandaiHadir memotong KECOCOKAN, bukan tanda sepihak", () => {
  it("menghitung orang yang saling menandai denganku dan sudah RSVP", async () => {
    const s = meetStore({
      tandaOleh: vi.fn(async () => tanda(B, C)),
      tandaKe: vi.fn(async () => tanda(B, C)),
    });
    const res = await app(s, [B, C]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 2 });
  });

  /**
   * SERANGAN ORACLE KEANGGOTAAN RSVP, ditulis sebagai serangannya sendiri.
   *
   * Versi lama menghitung |tandaOleh ∩ RSVP|. Menandai orang itu gratis,
   * sepihak, tanpa kontak sebelumnya, dan senyap — jadi penyerang cukup
   * membaca `kutandaiHadir`, menandai X, membaca lagi, dan selisih 1 berarti
   * "X RSVP di acara ini". Cabut tandanya dan angkanya kembali. Diulang
   * lintas penemuan acara, itu kalender fisik X.
   *
   * Ambang persetujuannya adalah KECOCOKAN: angka hanya bergerak kalau X
   * menandai balik — pilihan X, bukan pilihan penyerang.
   */
  it("tanda SEPIHAK ke peserta tidak menggerakkan angkanya", async () => {
    const sebelum = meetStore({ tandaOleh: vi.fn(async () => []) });
    const dasar = await (await app(sebelum, [B]).request(await kueriTerbukti())).json();
    expect(dasar).toMatchObject({ kutandaiHadir: 0 });

    // Penyerang menandai B. B tidak menandai balik. B RSVP di acara ini.
    const sesudah = meetStore({
      tandaOleh: vi.fn(async () => tanda(B)),
      tandaKe: vi.fn(async () => []),
    });
    const res = await app(sesudah, [B]).request(await kueriTerbukti());
    // Kalau ini 1, keanggotaan RSVP B baru saja bocor ke orang yang belum
    // pernah ditemuinya dan yang tidak pernah dia setujui.
    expect(await res.json()).toMatchObject({ kutandaiHadir: 0 });
  });

  it("kecocokan (tanda dua arah) MENGGERAKKAN angkanya", async () => {
    const s = meetStore({
      tandaOleh: vi.fn(async () => tanda(B)),
      tandaKe: vi.fn(async () => tanda(B)),
    });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 1 });
  });

  // Satu cocok (B), satu sepihak (C). Keduanya RSVP. Hanya B yang boleh
  // dihitung — kalau irisannya kembali memakai tandaOleh mentah, angkanya 2.
  it("memisahkan yang cocok dari yang sepihak di acara yang sama", async () => {
    const s = meetStore({
      tandaOleh: vi.fn(async () => tanda(B, C)),
      tandaKe: vi.fn(async () => tanda(B)),
    });
    const res = await app(s, [B, C]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 1 });
  });

  it("tidak menghitung orang yang cocok tapi belum RSVP", async () => {
    const s = meetStore({
      tandaOleh: vi.fn(async () => tanda(B, C)),
      tandaKe: vi.fn(async () => tanda(B, C)),
    });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 1 });
  });

  it("tidak peka besar-kecil huruf", async () => {
    const s = meetStore({
      tandaOleh: vi.fn(async () => tanda(B.toUpperCase() as Address)),
      tandaKe: vi.fn(async () => tanda(B)),
    });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 1 });
  });
});

describe("loop event di GET /events/:id", () => {
  it("menghitung penanda yang sudah RSVP", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D)) });
    const res = await app(s, [B, C, D]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 3 });
  });

  it("tidak menghitung penanda yang belum RSVP", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D, E)) });
    const res = await app(s, [B, C, D], 6).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 3 });
  });

  it("penanda tidak peka besar-kecil huruf", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [
      { address: B.toUpperCase() as Address, atMs: NOW },
      ...tanda(C, D),
    ]) });
    const res = await app(s, [B, C, D]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 3 });
  });

  /**
   * Tanpa penjaga ini, siapa pun bisa menanyakan "berapa orang yang ingin
   * bertemu Alice akan datang ke acara ini", dan dengan mengulanginya lintas
   * banyak acara, pola tanda Alice bisa disimpulkan tanpa pernah melihat satu
   * nama pun (spec §5.3).
   */
  it("kedua angka TIDAK keluar tanpa bukti", async () => {
    const s = meetStore({
      tandaKe: vi.fn(async () => tanda(B, C, D)),
      tandaOleh: vi.fn(async () => tanda(B, C, D)),
    });
    const res = await app(s, [B, C, D]).request(`/events/${ID}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.penandaHadir).toBeUndefined();
    expect(json.kutandaiHadir).toBeUndefined();
  });

  // Angka, bukan daftar (spec §4.3). Daftar membocorkan siapa menandai siapa.
  it("tidak pernah mengembalikan daftar nama", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D)) });
    const res = await app(s, [B, C, D]).request(await kueriTerbukti());
    const teks = await res.text();
    expect(teks).not.toContain(B.slice(2));
  });

  it("medan cabang terbukti yang lama tetap ada", async () => {
    const res = await app(meetStore(), []).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahRsvp).toBe(true);
    expect(json.sudahCheckIn).toBe(false);
  });
});

describe("dua ambang penandaHadir", () => {
  /**
   * Lapis PERTAMA: ukuran kerumunan (PENANDA_HADIR_MIN_RSVP). Lunak, karena
   * RSVP gratis dibuat — dipertahankan sebagai lapis kedua, bukan jaminan.
   */
  it("tidak keluar di acara yang RSVP-nya di bawah ambang kerumunan", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D)) });
    const res = await app(s, [B, C, D], 4).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "penandaHadir")).toBe(false);
    // kutandaiHadir TIDAK diambang: tetap keluar walau acaranya kecil.
    expect(json.kutandaiHadir).toBe(0);
  });

  /**
   * Lapis KEDUA: nilai angkanya sendiri (PENANDA_HADIR_MIN_NILAI). Inilah
   * yang benar-benar menutup identifikasi — `penandaHadir: 1` menyebut satu
   * orang lewat eliminasi berapa pun besar acaranya. Kuncinya harus HILANG,
   * bukan `0`: `0` adalah klaim faktual "tidak ada yang menandaimu".
   */
  it("tidak keluar kalau nilainya di bawah ambang nilai, walau kerumunannya besar", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C)) });
    const res = await app(s, [B, C], 50).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "penandaHadir")).toBe(false);
    expect(json.penandaHadir).toBeUndefined();
  });

  it("keluar tepat di ambang nilai", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D)) });
    const res = await app(s, [B, C, D], 50).request(await kueriTerbukti());
    expect((await res.json() as Record<string, unknown>).penandaHadir).toBe(3);
  });

  /**
   * Serangan sybil pada ambang kerumunan: `rsvp()` tidak meminta tier,
   * koneksi, ongkos, atau tulisan on-chain, jadi penyerang di acara berdua
   * bisa menambahkan alamat miliknya sendiri sampai `summary.rsvps` melewati
   * PENANDA_HADIR_MIN_RSVP. Gerbang pertama terbuka — gerbang NILAI tidak,
   * karena menggelembungkan RSVP tidak membuat siapa pun menandai penyerang.
   */
  it("menggelembungkan RSVP tidak membuka gerbang nilai", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B)) });
    const res = await app(s, [B, C, D, E], 6).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "penandaHadir")).toBe(false);
  });

  it("keduanya harus terpenuhi: nilai cukup tapi kerumunan kurang tetap disembunyikan", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => tanda(B, C, D)) });
    const res = await app(s, [B, C, D], 3).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "penandaHadir")).toBe(false);
  });
});
