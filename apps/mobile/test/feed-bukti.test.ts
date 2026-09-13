import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  recoverLihatBlokirSigner, recoverLihatFeedSigner, recoverLihatKecocokanSigner,
} from "@nearly/shared";
import { CONFIG } from "../src/config";
import { getFeed, kueriBuktiFeed } from "../src/feed-api";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const signer = {
  address: A.address as Address,
  signTypedData: (a: Parameters<typeof A.signTypedData>[0]) => A.signTypedData(a),
};

const aslinya = globalThis.fetch;
afterEach(() => { globalThis.fetch = aslinya; });

function pulihkanDari(kueri: URLSearchParams) {
  return {
    msg: { who: kueri.get("who") as Address, expiresAt: BigInt(kueri.get("expiresAt")!) },
    sig: kueri.get("sig") as Hex,
  };
}

/**
 * C1 review akhir 4a. Tanpa bukti LihatFeed, server tidak menerapkan efek
 * blokir di feed — orang yang kamu blokir tetap muncul. Pembangunnya wajib
 * memakai `lihatFeedTypedData`: tiga tipe lain berbentuk field identik, dan
 * bukti yang tertukar tetap "terlihat sah" sampai server menolaknya diam-diam
 * (feed tidak pernah 4xx, jadi kesalahan ini tidak akan terlihat sebagai
 * galat — hanya sebagai blokir yang tidak bekerja).
 */
describe("kueriBuktiFeed", () => {
  it("menghasilkan bukti LihatFeed yang bisa dipulihkan", async () => {
    const { msg, sig } = pulihkanDari(new URLSearchParams(await kueriBuktiFeed(signer as never)));
    expect((await recoverLihatFeedSigner(msg, sig, CONFIG.verifyingContract)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  it("BUKAN tanda tangan LihatKecocokan", async () => {
    const { msg, sig } = pulihkanDari(new URLSearchParams(await kueriBuktiFeed(signer as never)));
    expect((await recoverLihatKecocokanSigner(msg, sig, CONFIG.verifyingContract)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("BUKAN tanda tangan LihatBlokir", async () => {
    const { msg, sig } = pulihkanDari(new URLSearchParams(await kueriBuktiFeed(signer as never)));
    expect((await recoverLihatBlokirSigner(msg, sig, CONFIG.verifyingContract)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("alamat masuk kueri apa adanya, tanpa diubah casingnya", async () => {
    const kueri = new URLSearchParams(await kueriBuktiFeed(signer as never));
    expect(kueri.get("who")).toBe(A.address);
  });
});

describe("getFeed", () => {
  it("mengirim who, expiresAt, dan sig bukti ke GET /feed", async () => {
    let url = "";
    globalThis.fetch = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ posts: [], cursor: null }), { status: 200 });
    }) as never;

    const bukti = await kueriBuktiFeed(signer as never);
    await getFeed(bukti);

    const dikirim = new URL(url);
    expect(dikirim.pathname).toBe("/feed");
    const { msg, sig } = pulihkanDari(dikirim.searchParams);
    expect(msg.who).toBe(A.address);
    expect((await recoverLihatFeedSigner(msg, sig, CONFIG.verifyingContract)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  it("cursor ikut terkirim bersama bukti", async () => {
    let url = "";
    globalThis.fetch = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ posts: [], cursor: null }), { status: 200 });
    }) as never;
    await getFeed(await kueriBuktiFeed(signer as never), "30");
    const p = new URL(url).searchParams;
    expect(p.get("cursor")).toBe("30");
    expect(p.get("sig")).toMatch(/^0x[0-9a-f]+$/);
  });
});
