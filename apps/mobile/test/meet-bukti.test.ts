import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  lihatKecocokanTypedData, lihatProfilTypedData,
  recoverLihatKecocokanSigner, recoverLihatProfilSigner, recoverTandaiDilihatSigner,
} from "@nearly/shared";
import { kueriBuktiKecocokan, kueriBuktiProfil, tandaiKecocokanDilihat } from "../src/meet-api";

const akun = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
const TARGET = "0x000000000000000000000000000000000000dead" as Address;

const signer = {
  address: akun.address,
  signTypedData: (td: Parameters<typeof akun.signTypedData>[0]) => akun.signTypedData(td),
};

const asli = globalThis.fetch;
afterEach(() => { globalThis.fetch = asli; });

type BadanDilihat = { who: string; expiresAt: string; sig: string };

/** Menangkap badan yang benar-benar dikirim ke POST /kecocokan/dilihat. */
function tangkapDilihat() {
  const jejak: BadanDilihat[] = [];
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    jejak.push(JSON.parse(String(init?.body)) as BadanDilihat);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;
  return jejak;
}

describe("kueriBuktiProfil", () => {
  it("menghasilkan query string yang tanda tangannya bisa dipulihkan", async () => {
    const q = new URLSearchParams(await kueriBuktiProfil(signer, TARGET));
    const who = q.get("who")!;
    const expiresAt = q.get("expiresAt")!;
    const sig = q.get("sig")! as Hex;

    const pulih = await recoverLihatProfilSigner(
      { target: TARGET, who: who as Address, expiresAt: BigInt(expiresAt) },
      sig,
      // Domain memakai CONFIG.verifyingContract; nilainya disuntik
      // vitest.config.ts sebagai alamat sintetis.
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  it("expiresAt berada di masa depan", async () => {
    const q = new URLSearchParams(await kueriBuktiProfil(signer, TARGET));
    expect(Number(q.get("expiresAt"))).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("kueriBuktiKecocokan", () => {
  it("menghasilkan query string yang tanda tangannya bisa dipulihkan", async () => {
    const q = new URLSearchParams(await kueriBuktiKecocokan(signer));
    const pulih = await recoverLihatKecocokanSigner(
      { who: q.get("who") as Address, expiresAt: BigInt(q.get("expiresAt")!) },
      q.get("sig") as Hex,
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  // LihatKecocokan TIDAK mengikat target — memaksakannya akan membuat orang
  // berikutnya mengira kedua tipe bukti bisa dipertukarkan.
  it("tidak menyertakan target", async () => {
    const q = new URLSearchParams(await kueriBuktiKecocokan(signer));
    expect(q.get("target")).toBeNull();
  });
});

/**
 * tandaiKecocokanDilihat menandatangani TandaiDilihat, perintah TULIS —
 * bentuk fieldnya identik dengan LihatKecocokan di atas, tapi keduanya WAJIB
 * menghasilkan digest berbeda (lihat komentar TandaiDilihatMessage di
 * packages/shared/src/meet.ts). Tanpa tes ini, sepertiga permukaan yang
 * peka-tipe di berkas ini tidak terjaga: kalau tandaiDilihatTypedData
 * tertukar diam-diam dengan lihatKecocokanTypedData di dalam
 * tandaiKecocokanDilihat, tidak ada tes yang akan menangkapnya.
 */
describe("tandaiKecocokanDilihat", () => {
  it("badannya memulihkan penanda tangan lewat recoverTandaiDilihatSigner", async () => {
    const jejak = tangkapDilihat();
    await tandaiKecocokanDilihat(signer);
    expect(jejak).toHaveLength(1);
    const b = jejak[0]!;

    const pulih = await recoverTandaiDilihatSigner(
      { who: b.who as Address, expiresAt: BigInt(b.expiresAt) },
      b.sig as Hex,
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  // Buktinya SAMA persis, hanya tipenya yang berbeda — ini yang membuktikan
  // kedua tipe menghasilkan digest berbeda, bukan cuma kebetulan salah satu
  // ikut lolos verifikasi.
  it("tanda tangannya bukan tanda tangan LihatKecocokan", async () => {
    const jejak = tangkapDilihat();
    await tandaiKecocokanDilihat(signer);
    const b = jejak[0]!;

    const pulih = await recoverLihatKecocokanSigner(
      { who: b.who as Address, expiresAt: BigInt(b.expiresAt) },
      b.sig as Hex,
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).not.toBe(akun.address.toLowerCase());
  });
});
