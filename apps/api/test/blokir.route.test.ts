import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  blokirTypedData, lihatBlokirTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { blokirRoutes } from "../src/routes/blokir";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Record<string, unknown> = {}) {
  return {
    setBlokir: vi.fn(async () => {}),
    adaBlokir: vi.fn(async () => false),
    diblokirOleh: vi.fn(async () => [{ address: B, atMs: NOW }]),
    himpunanUntuk: vi.fn(async () => new Set<string>()),
    pemblokirUntuk: vi.fn(async () => new Set<string>()),
    ...over,
  };
}

function app(s = store()) {
  const a = new Hono();
  a.route("/", blokirRoutes({ blokir: s, verifyingContract: VC, nowMs: () => NOW } as never));
  return { a, s };
}

async function kueriBukti(penandatangan = A) {
  const sig = await penandatangan.signTypedData(
    lihatBlokirTypedData({ who: penandatangan.address as Address, expiresAt: EXP }, VC));
  return `who=${penandatangan.address}&expiresAt=${EXP}&sig=${sig}`;
}

describe("POST /blokir", () => {
  it("badan sah → 200", async () => {
    const { a, s } = app();
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: EXP.toString(), sig }),
    });
    expect(r.status).toBe(200);
    expect(s.setBlokir).toHaveBeenCalled();
  });

  it("badan tak sah → 400 invalid_body", async () => {
    const { a } = app();
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: "bukan-alamat" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json() as { code: string }).code).toBe("invalid_body");
  });

  it("memblokir diri sendiri → 400 blokir_diri", async () => {
    const { a } = app();
    const diri = A.address.toLowerCase() as Address;
    const msg = { target: diri, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: EXP.toString(), sig }),
    });
    expect(r.status).toBe(400);
    expect((await r.json() as { code: string }).code).toBe("blokir_diri");
  });
});

describe("GET /blokir", () => {
  it("bukti sah → 200 dengan daftar", async () => {
    const { a } = app();
    const r = await a.request(`/blokir?${await kueriBukti()}`);
    expect(r.status).toBe(200);
    expect((await r.json() as { blokir: unknown[] }).blokir).toHaveLength(1);
  });

  // 403, BUKAN daftar kosong. Daftar kosong tidak bisa dibedakan dari "kamu
  // tidak memblokir siapa pun", jadi otorisasi yang rusak akan terlihat
  // seperti keadaan normal dan tidak ada yang menyadarinya.
  it("tanpa tanda tangan → 403, bukan daftar kosong", async () => {
    const { a, s } = app();
    const r = await a.request("/blokir");
    expect(r.status).toBe(403);
    expect(s.diblokirOleh).not.toHaveBeenCalled();
  });

  it("tanda tangan penandatangan salah → 403", async () => {
    const { a } = app();
    const lain = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
    const sig = await lain.signTypedData(
      lihatBlokirTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });

  it("tanda tangan cacat bentuk → 403, bukan 500", async () => {
    const { a } = app();
    const rusak = `0x${"99".repeat(65)}`;
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${rusak}`);
    expect(r.status).toBe(403);
  });

  // INI tes yang paling penting di berkas ini. LihatKecocokan dan
  // TandaiDilihat berbentuk field IDENTIK dengan LihatBlokir; tanda
  // tangannya sah, dari kunci yang benar, atas nilai yang benar. HANYA nama
  // tipenya yang berbeda, dan itulah satu-satunya hal yang menolaknya.
  it("tanda tangan LihatKecocokan → 403", async () => {
    const { a } = app();
    const sig = await A.signTypedData(
      lihatKecocokanTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });

  it("tanda tangan TandaiDilihat → 403", async () => {
    const { a } = app();
    const sig = await A.signTypedData(
      tandaiDilihatTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });
});
