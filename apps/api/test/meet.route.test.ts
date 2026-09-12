import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { meetRoutes } from "../src/routes/meet";
import type { BlokirStore, MeetDeps, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"33".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}),
    hitungTanda: vi.fn(async () => 0),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []),
    tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null),
    setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    ...over,
  };
}

// Fake BlokirStore dengan tepat empat metode (lihat METODE_BLOKIR_STORE di
// ports.ts) — `himpunanUntuk` kosong secara default supaya tes-tes lama
// (yang tidak peduli blokir) tetap berjalan seperti sebelum Task 10.
function blokirPalsu(over: Partial<BlokirStore> = {}): BlokirStore {
  return {
    setBlokir: vi.fn(async () => {}),
    adaBlokir: vi.fn(async () => false),
    diblokirOleh: vi.fn(async () => []),
    himpunanUntuk: vi.fn(async () => new Set<string>()),
    ...over,
  };
}

function app(meet: MeetStore, blokir: BlokirStore = blokirPalsu()) {
  const deps: MeetDeps = { meet, blokir, verifyingContract: KONTRAK, nowMs: () => NOW };
  const a = new Hono();
  a.route("/", meetRoutes(deps));
  return a;
}

const kirim = (a: Hono, path: string, body: unknown) =>
  a.request(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

describe("POST /ingin-bertemu", () => {
  async function badan(over: Record<string, unknown> = {}) {
    const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    return {
      target: TARGET, who: aku.address, ingin: true,
      expiresAt: EXP.toString(), sig, ...over,
    };
  }

  it("mengembalikan 200 untuk permintaan sah", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", await badan());
    expect(res.status).toBe(200);
  });

  it("mengembalikan 400 untuk badan yang tidak valid", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", { who: aku.address });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  // Bukan 500. Zod menjalankan refine walau field gagal.
  it("mengembalikan 400, bukan 500, untuk expiresAt bukan angka", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", await badan({ expiresAt: "besok" }));
    expect(res.status).toBe(400);
  });

  // Skema sengaja menerima target === who; gerbanglah yang menolaknya.
  it("meneruskan penolakan menandai diri sendiri sebagai 400", async () => {
    const pesan = { target: aku.address, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const res = await kirim(app(store()), "/ingin-bertemu", {
      target: aku.address, who: aku.address, ingin: true, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "tandai_diri" });
  });

  it("meneruskan httpStatus dari gerbang untuk tanda tangan salah", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu",
      await badan({ sig: `0x${"9".repeat(130)}` }));
    expect(res.status).toBe(401);
  });
});

describe("GET /kecocokan", () => {
  async function kueri(over: Record<string, string> = {}) {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const q = new URLSearchParams({
      who: aku.address, expiresAt: EXP.toString(), sig, ...over,
    });
    return `/kecocokan?${q.toString()}`;
  }

  it("mengembalikan daftar dan hitungan baru untuk bukti yang sah", async () => {
    const s = store({
      tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: NOW - 1000 }]),
      tandaKe: vi.fn(async () => [{ address: TARGET, atMs: NOW - 500 }]),
    });
    const res = await app(s).request(await kueri());
    expect(res.status).toBe(200);
    const json = await res.json() as { kecocokan: unknown[]; baru: number };
    expect(json.kecocokan).toHaveLength(1);
    expect(json.baru).toBe(1);
  });

  /**
   * Spec §6.2: MENOLAK, bukan daftar kosong. Daftar kosong dan "kamu tidak
   * berhak" adalah dua hal berbeda, dan klien perlu membedakannya — kalau
   * tidak, orang yang tanda tangannya kedaluwarsa akan disuguhi layar
   * "belum ada kecocokan" yang berbohong.
   */
  it("menolak 403 tanpa tanda tangan sama sekali", async () => {
    const res = await app(store()).request("/kecocokan");
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan orang lain", async () => {
    const lain = privateKeyToAccount(`0x${"44".repeat(32)}` as Hex);
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await lain.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const res = await app(store()).request(await kueri({ sig }));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { who: aku.address, expiresAt: lampau };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const res = await app(store()).request(await kueri({ expiresAt: lampau.toString(), sig }));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan cacat bentuknya, bukan 500", async () => {
    const res = await app(store()).request(await kueri({ sig: "0xbukan-tanda-tangan" }));
    expect(res.status).toBe(403);
  });

  /**
   * PASANGAN BERBAHAYA. `TandaiDilihat` punya bentuk field IDENTIK dengan
   * `LihatKecocokan`. Kalau tes ini lulus dengan 200, satu tanda tangan bisa
   * dipakai untuk keduanya dan pemisahan baca-tulis runtuh.
   */
  it("menolak 403 untuk tanda tangan TandaiDilihat", async () => {
    const sig = await aku.signTypedData(
      tandaiDilihatTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const res = await app(store()).request(await kueri({ sig }));
    expect(res.status).toBe(403);
  });
});

describe("POST /kecocokan/dilihat", () => {
  it("mengembalikan 200 dan menyetel waktu dilihat", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    const s = store();
    const res = await kirim(app(s), "/kecocokan/dilihat", {
      who: aku.address, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(200);
    expect(s.setCocokDilihat).toHaveBeenCalledWith(aku.address, NOW);
  });

  it("mengembalikan 401 untuk tanda tangan LihatKecocokan", async () => {
    const sig = await aku.signTypedData(
      lihatKecocokanTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const s = store();
    const res = await kirim(app(s), "/kecocokan/dilihat", {
      who: aku.address, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(401);
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });
});
