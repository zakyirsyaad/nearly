import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatEventTypedData } from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";
import type { EventRecord, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const ATTENDANCE = "0x000000000000000000000000000000000000beef" as Address;
const A = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2" as Address;
const C = "0x00000000000000000000000000000000000000c3" as Address;
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
    hitungTandaBanyak: vi.fn(async () => new Map()),
    ...over,
  };
}

// `rsvps` default 5: tepat di ambang PENANDA_HADIR_MIN_RSVP, supaya tes lama
// yang menegaskan isi `penandaHadir`/`kutandaiHadir` tidak ikut tersandung
// penjaga k-anonimitas yang diuji terpisah di bawah.
function app(meet: MeetStore, rsvpAddrs: Address[], rsvps = 5) {
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

describe("loop event di GET /events/:id", () => {
  it("menghitung penanda yang sudah RSVP", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [
      { address: B, atMs: NOW }, { address: C, atMs: NOW },
    ]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 1 });
  });

  it("menghitung orang yang kutandai dan sudah RSVP", async () => {
    const s = meetStore({ tandaOleh: vi.fn(async () => [
      { address: B, atMs: NOW }, { address: C, atMs: NOW },
    ]) });
    const res = await app(s, [B, C]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 2 });
  });

  // Sebelum tes ini: `kutandaiHadir = tandaOleh.length` lolos semua tes lain
  // di berkas ini, karena setiap kasus yang ada kebetulan menandai orang yang
  // juga RSVP. Di sini C ditandai tapi TIDAK RSVP — kalau implementasinya
  // tidak benar-benar memotong dengan daftar RSVP, angkanya akan 2, bukan 1.
  it("tidak menghitung orang yang kutandai tapi belum RSVP", async () => {
    const s = meetStore({ tandaOleh: vi.fn(async () => [
      { address: B, atMs: NOW }, { address: C, atMs: NOW },
    ]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 1 });
  });

  it("nol kalau tidak ada yang beririsan", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: C, atMs: NOW }]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 0 });
  });

  it("tidak peka besar-kecil huruf", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [
      { address: B.toUpperCase() as Address, atMs: NOW },
    ]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 1 });
  });

  /**
   * Tanpa penjaga ini, siapa pun bisa menanyakan "berapa orang yang ingin
   * bertemu Alice akan datang ke acara ini", dan dengan mengulanginya lintas
   * banyak acara, pola tanda Alice bisa disimpulkan tanpa pernah melihat satu
   * nama pun (spec §5.3).
   */
  it("kedua angka TIDAK keluar tanpa bukti", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B]).request(`/events/${ID}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.penandaHadir).toBeUndefined();
    expect(json.kutandaiHadir).toBeUndefined();
  });

  // Angka, bukan daftar (spec §4.3). Daftar membocorkan siapa menandai siapa.
  it("tidak pernah mengembalikan daftar nama", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    const teks = await res.text();
    expect(teks).not.toContain(B.slice(2));
  });

  it("medan cabang terbukti yang lama tetap ada", async () => {
    const res = await app(meetStore(), []).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahRsvp).toBe(true);
    expect(json.sudahCheckIn).toBe(false);
  });

  /**
   * Ambang k-anonimitas (PENANDA_HADIR_MIN_RSVP). Di event kecil, pemanggil
   * terbukti yang tahu jumlah RSVP event ini bisa menyimpulkan siapa
   * menandainya lewat eliminasi murni — reveal SEPIHAK yang bertentangan
   * dengan aturan inti aplikasi. Di bawah ambang, `penandaHadir` harus
   * benar-benar TIDAK ADA sebagai kunci (bukan `0` — itu klaim faktual
   * "tidak ada yang menandaimu", yang bisa saja bohong).
   */
  it("penandaHadir tidak keluar di event kecil (di bawah ambang k-anonimitas)", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B], 4).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "penandaHadir")).toBe(false);
    expect(json.penandaHadir).toBeUndefined();
    // kutandaiHadir TIDAK diambang: tetap keluar walau event kecil.
    expect(json.kutandaiHadir).toBe(0);
  });

  it("penandaHadir keluar tepat di ambang k-anonimitas", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B], 5).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(json.penandaHadir).toBe(1);
  });
});
