import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { blokirTypedData, lihatBlokirTypedData } from "@nearly/shared";
import { setBlokir } from "../src/blokir-gate";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function deps() {
  return {
    verifyingContract: VC, nowMs: () => NOW,
    blokir: {
      setBlokir: vi.fn(async () => {}),
      adaBlokir: vi.fn(async () => false),
      diblokirOleh: vi.fn(async () => []),
      himpunanUntuk: vi.fn(async () => new Set<string>()),
    },
  } as never;
}

async function masukan(over: Record<string, unknown> = {}) {
  const msg = {
    target: (over.target as Address) ?? B,
    who: A.address as Address,
    blokir: (over.blokir as boolean) ?? true,
    expiresAt: (over.expiresAt as bigint) ?? EXP,
  };
  return { ...msg, sig: await A.signTypedData(blokirTypedData(msg, VC)), ...over } as never;
}

describe("setBlokir", () => {
  it("memblokir orang lain berhasil", async () => {
    const d = deps();
    const r = await setBlokir(await masukan(), d);
    expect(r.ok).toBe(true);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[][] } } } })
      .blokir.setBlokir.mock.calls[0]).toEqual([A.address, B, true]);
  });

  it("mencabut blokir berhasil dan meneruskan false", async () => {
    const d = deps();
    const r = await setBlokir(await masukan({ blokir: false }), d);
    expect(r.ok).toBe(true);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[][] } } } })
      .blokir.setBlokir.mock.calls[0]?.[2]).toBe(false);
  });

  // Ditolak di GERBANG, bukan di skema (spec §7.1). Alamat huruf kecil
  // dipakai supaya viem tetap menerimanya sebagai alamat sah — `toUpperCase`
  // menghasilkan "0X..." yang gagal isAddress dan membuat signTypedData
  // melempar SEBELUM gerbangnya sempat dijalankan.
  it("memblokir diri sendiri ditolak 400", async () => {
    const d = deps();
    const r = await setBlokir(
      await masukan({ target: A.address.toLowerCase() as Address }), d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.failure.code).toBe("blokir_diri");
    expect(!r.ok && r.failure.httpStatus).toBe(400);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[] } } } })
      .blokir.setBlokir.mock.calls.length).toBe(0);
  });

  it("kedaluwarsa ditolak 410", async () => {
    const d = deps();
    const lewat = BigInt(Math.floor(NOW / 1000) - 1);
    const r = await setBlokir(await masukan({ expiresAt: lewat }), d);
    expect(!r.ok && r.failure.code).toBe("expired");
  });

  // Batas persis: expiresAt * 1000 === nowMs() masih SAH. Tanpa tes ini,
  // membalik `>` jadi `>=` tidak merahkan apa pun.
  it("tepat di batas kedaluwarsa masih sah", async () => {
    const d = deps();
    const r = await setBlokir(await masukan({ expiresAt: BigInt(NOW / 1000) }), d);
    expect(r.ok).toBe(true);
  });

  it("tanda tangan orang lain ditolak 401", async () => {
    const lain = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await lain.signTypedData(blokirTypedData(msg, VC));
    const r = await setBlokir({ ...msg, sig } as never, deps());
    expect(!r.ok && r.failure.code).toBe("bad_signature");
  });

  // Tanda tangan yang PANJANGNYA sah tapi byte `v`-nya rusak membuat viem
  // melempar. Itu harus jadi 401, bukan 500.
  it("tanda tangan cacat bentuk → 401, bukan lemparan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const rusak = (`0x${"99".repeat(65)}`) as Hex;
    const r = await setBlokir({ ...msg, sig: rusak } as never, deps());
    expect(!r.ok && r.failure.httpStatus).toBe(401);
  });

  // LihatBlokir berbentuk { who, expiresAt } — beda dari Blokir, jadi kasus
  // ini mudah. Yang sulit ada di Task 7: LihatKecocokan sebagai LihatBlokir.
  it("tanda tangan LihatBlokir TIDAK sah sebagai perintah blokir", async () => {
    const d = deps();
    const sig = await A.signTypedData(
      lihatBlokirTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await setBlokir({
      target: B, who: A.address as Address, blokir: true, expiresAt: EXP, sig,
    } as never, d);
    expect(!r.ok && r.failure.code).toBe("bad_signature");
  });

  // Pengikatan medan: tanda tangan sah untuk PESAN TERTENTU, bukan untuk
  // apa pun yang kebetulan tiba dengan tanda tangan itu. Dibangun eksplisit
  // di luar `masukan()` — sebar akhir `masukan()` menerapkan `over` yang
  // SAMA sebelum menandatangani, jadi pesan yang ditandatangani dan objek
  // akhir selalu selaras dan tidak pernah bisa mensimulasikan gangguan ini.
  it("target diubah setelah tanda tangan ditolak 401, bukan diteruskan ke store", async () => {
    const d = deps();
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const C = "0x0000000000000000000000000000000000000ccc" as Address;
    const r = await setBlokir({ ...msg, target: C, sig } as never, d);
    expect(!r.ok && r.failure.code).toBe("bad_signature");
    expect(!r.ok && r.failure.httpStatus).toBe(401);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[] } } } })
      .blokir.setBlokir.mock.calls.length).toBe(0);
  });

  it("blokir diubah setelah tanda tangan ditolak 401, bukan diteruskan ke store", async () => {
    const d = deps();
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const r = await setBlokir({ ...msg, blokir: false, sig } as never, d);
    expect(!r.ok && r.failure.code).toBe("bad_signature");
    expect(!r.ok && r.failure.httpStatus).toBe(401);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[] } } } })
      .blokir.setBlokir.mock.calls.length).toBe(0);
  });
});
