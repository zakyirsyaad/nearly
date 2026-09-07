import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverInginBertemuSigner } from "@nearly/shared";
import { aksiTanda } from "../src/meet-actions";

const akun = privateKeyToAccount(`0x${"99".repeat(32)}` as Hex);
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const KONTRAK = process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address;

const signer = {
  address: akun.address,
  signTypedData: (td: Parameters<typeof akun.signTypedData>[0]) => akun.signTypedData(td),
};

describe("aksiTanda", () => {
  it("mengirim ingin:true saat belum ditandai", async () => {
    const mata = vi.fn(async () => ({ ok: true as const }));
    await aksiTanda(signer, TARGET, false, mata as never);
    expect(mata).toHaveBeenCalledWith(expect.objectContaining({ ingin: true }));
  });

  it("mengirim ingin:false saat sudah ditandai", async () => {
    const mata = vi.fn(async () => ({ ok: true as const }));
    await aksiTanda(signer, TARGET, true, mata as never);
    expect(mata).toHaveBeenCalledWith(expect.objectContaining({ ingin: false }));
  });

  /**
   * Tanda tangan harus benar-benar memulihkan penandanya, dan harus MENGIKAT
   * nilai `ingin` yang dikirim. Kalau tidak, satu tanda tangan bisa dipakai
   * dua arah — dan mencabut adalah satu-satunya cara menutup pintu
   * pengungkapan (spec §2.1).
   */
  it("tanda tangannya mengikat target dan nilai ingin yang dikirim", async () => {
    let dikirim: Record<string, unknown> | null = null;
    await aksiTanda(signer, TARGET, false, (async (b: Record<string, unknown>) => {
      dikirim = b;
      return { ok: true as const };
    }) as never);

    const b = dikirim as unknown as {
      target: Address; who: Address; ingin: boolean; expiresAt: string; sig: Hex;
    };
    const pulih = await recoverInginBertemuSigner(
      { target: b.target, who: b.who, ingin: b.ingin, expiresAt: BigInt(b.expiresAt) },
      b.sig, KONTRAK,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());

    // Nilai ingin yang DITUKAR harus membuat pemulihan meleset.
    const pulihDitukar = await recoverInginBertemuSigner(
      { target: b.target, who: b.who, ingin: !b.ingin, expiresAt: BigInt(b.expiresAt) },
      b.sig, KONTRAK,
    );
    expect(pulihDitukar.toLowerCase()).not.toBe(akun.address.toLowerCase());
  });
});
