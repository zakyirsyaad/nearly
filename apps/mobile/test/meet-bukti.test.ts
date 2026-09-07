import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  lihatKecocokanTypedData, lihatProfilTypedData,
  recoverLihatKecocokanSigner, recoverLihatProfilSigner,
} from "@nearly/shared";
import { kueriBuktiKecocokan, kueriBuktiProfil } from "../src/meet-api";

const akun = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
const TARGET = "0x000000000000000000000000000000000000dead" as Address;

const signer = {
  address: akun.address,
  signTypedData: (td: Parameters<typeof akun.signTypedData>[0]) => akun.signTypedData(td),
};

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
