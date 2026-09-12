import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverBlokirSigner, recoverLihatBlokirSigner, recoverLihatKecocokanSigner } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { kueriBuktiBlokir } from "../src/blokir-api";
import { aksiBlokir } from "../src/blokir-actions";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const signer = {
  address: A.address as Address,
  signTypedData: (a: Parameters<typeof A.signTypedData>[0]) => A.signTypedData(a),
};

const aslinya = globalThis.fetch;
afterEach(() => { globalThis.fetch = aslinya; });

describe("kueriBuktiBlokir", () => {
  it("menghasilkan bukti LihatBlokir yang bisa dipulihkan", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    const pulih = await recoverLihatBlokirSigner(
      { who: kueri.get("who") as Address, expiresAt: BigInt(kueri.get("expiresAt")!) },
      kueri.get("sig") as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  // Bentuk fieldnya identik dengan LihatKecocokan. Kalau pembangunnya suatu
  // saat tertukar, tanda tangan ini akan tetap "terlihat sah" sampai
  // dipulihkan dengan tipe yang salah.
  it("BUKAN tanda tangan LihatKecocokan", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    const pulih = await recoverLihatKecocokanSigner(
      { who: kueri.get("who") as Address, expiresAt: BigInt(kueri.get("expiresAt")!) },
      kueri.get("sig") as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
  });

  it("alamat masuk kueri apa adanya, tanpa diubah casingnya", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    expect(kueri.get("who")).toBe(A.address);
  });
});

describe("aksiBlokir", () => {
  it("menandatangani Blokir dan mengirim `blokir` sesuai kebalikan keadaan", async () => {
    let dikirim: Record<string, unknown> = {};
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      dikirim = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;

    await aksiBlokir(signer as never, B, false);
    expect(dikirim.blokir).toBe(true);

    const pulih = await recoverBlokirSigner(
      {
        target: dikirim.target as Address, who: dikirim.who as Address,
        blokir: dikirim.blokir as boolean, expiresAt: BigInt(String(dikirim.expiresAt)),
      },
      dikirim.sig as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  it("sedang diblokir → mengirim blokir false", async () => {
    let dikirim: Record<string, unknown> = {};
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      dikirim = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;
    await aksiBlokir(signer as never, B, true);
    expect(dikirim.blokir).toBe(false);
  });
});
