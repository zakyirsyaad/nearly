import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { inginBertemuTypedData, lihatProfilTypedData } from "@nearly/shared";
import { profileRoutes } from "../src/routes/profile";
import type { MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function meetStore(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}),
    hitungTanda: vi.fn(async () => 7),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []),
    tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null),
    setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    hitungTandaBanyak: vi.fn(async () => new Map()),
    ...over,
  };
}

function app(meet: MeetStore) {
  const deps = {
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 3),
      getDisplayName: vi.fn(async () => "Andi"),
    },
    identity: { ensName: vi.fn(async () => null), txCount: vi.fn(async () => 0) },
    meet,
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  const a = new Hono();
  a.route("/", profileRoutes(deps as never));
  return a;
}

async function buktiBaca(over: Record<string, string> = {}) {
  const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };
  const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
  const q = new URLSearchParams({
    who: aku.address, expiresAt: EXP.toString(), sig, ...over,
  });
  return `/profile/${TARGET}?${q.toString()}`;
}

describe("GET /profile/:address — angka publik", () => {
  it("inginBertemuCount SELALU keluar, tanpa bukti apa pun", async () => {
    const res = await app(meetStore()).request(`/profile/${TARGET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inginBertemuCount: 7 });
  });

  it("medan lama tidak berubah", async () => {
    const res = await app(meetStore()).request(`/profile/${TARGET}`);
    const json = await res.json() as Record<string, unknown>;
    for (const k of ["address", "displayName", "ens", "txCount", "connectionCount"]) {
      expect(json).toHaveProperty(k);
    }
  });
});

describe("GET /profile/:address — bendera pribadi", () => {
  /**
   * INTI TASK INI. Tanpa bukti, siapa pun bisa menanyakan satu alamat demi
   * satu alamat dan memetakan siapa menginginkan siapa — membatalkan
   * anonimitas yang jadi syarat fitur (spec induk §7.6).
   */
  it("TIDAK keluar tanpa tanda tangan sama sekali", async () => {
    const res = await app(meetStore({ adaTanda: vi.fn(async () => true) }))
      .request(`/profile/${TARGET}?who=${aku.address}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBeUndefined();
    expect(json.salingMenandai).toBeUndefined();
  });

  it("keluar dengan bukti LihatProfil yang sah", async () => {
    const s = meetStore({ adaTanda: vi.fn(async () => true) });
    const res = await app(s).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBe(true);
    expect(json.salingMenandai).toBe(true);
  });

  it("membedakan sudahKutandai dari salingMenandai", async () => {
    // Aku menandai dia, dia belum menandaiku.
    const s = meetStore({
      adaTanda: vi.fn(async (target: Address) =>
        target.toLowerCase() === TARGET.toLowerCase()),
    });
    const res = await app(s).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBe(true);
    expect(json.salingMenandai).toBe(false);
  });

  it("TIDAK keluar untuk tanda tangan orang lain", async () => {
    const lain = privateKeyToAccount(`0x${"66".repeat(32)}` as Hex);
    const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };
    const sig = await lain.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    const res = await app(meetStore()).request(await buktiBaca({ sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  it("TIDAK keluar untuk tanda tangan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { target: TARGET, who: aku.address, expiresAt: lampau };
    const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    const res = await app(meetStore())
      .request(await buktiBaca({ expiresAt: lampau.toString(), sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  /**
   * INVARIAN Ruling 23. `InginBertemu` adalah perintah TULIS; kalau ia sah
   * sebagai bukti baca, arah sebaliknya juga akan tergoda untuk disamakan —
   * dan tanda tangan baca yang bocor bisa dipakai menandai atas nama korban.
   */
  it("TIDAK keluar untuk tanda tangan InginBertemu", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(
      { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP }, KONTRAK));
    const res = await app(meetStore()).request(await buktiBaca({ sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  /**
   * Rute profil tidak boleh GAGAL untuk orang asing yang membuka tautan
   * (spec §5.1). Ini sengaja berbeda dari GET /kecocokan yang menolak 403.
   */
  it("tanda tangan cacat bentuknya tetap 200, bukan galat", async () => {
    const res = await app(meetStore()).request(await buktiBaca({ sig: "0xbukan" }));
    expect(res.status).toBe(200);
    expect((await res.json() as Record<string, unknown>).inginBertemuCount).toBe(7);
  });
});
