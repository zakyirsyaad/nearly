import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  blokirTypedData, lihatBlokirTypedData,
  recoverBlokirSigner, recoverLihatBlokirSigner,
} from "../src/blokir";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, recoverInginBertemuSigner,
  recoverTandaiDilihatSigner, tandaiDilihatTypedData,
} from "../src/meet";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const KONTRAK = "0x00000000000000000000000000000000000c0de0" as Address;
const EXP = 1_800_000_000n;

describe("Blokir", () => {
  it("memulihkan penanda tangan yang benar", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    expect((await recoverBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  // `blokir` ikut ditandatangani supaya PENCABUTAN juga terbukti. Tanpa ini
  // siapa pun bisa mencabut blokir orang lain lewat badan permintaan.
  it("membalik `blokir` membatalkan tanda tangan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    const dibalik = { ...msg, blokir: false };
    expect((await recoverBlokirSigner(dibalik, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("domain terikat ke kontrak — kontrak lain tidak memulihkan penanda tangan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    const lain = "0x00000000000000000000000000000000000c0de1" as Address;
    expect((await recoverBlokirSigner(msg, sig, lain)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});

describe("LihatBlokir vs dua tipe sebentuk lainnya", () => {
  const msg = { who: A.address as Address, expiresAt: EXP };

  it("memulihkan penanda tangan yang benar", async () => {
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  // Ketiganya berbentuk { who, expiresAt }. Hanya nama tipenya yang berbeda,
  // dan itulah satu-satunya hal yang membuat digest-nya berbeda.
  it("tanda tangan LihatKecocokan TIDAK sah sebagai LihatBlokir", async () => {
    const sig = await A.signTypedData(lihatKecocokanTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan TandaiDilihat TIDAK sah sebagai LihatBlokir", async () => {
    const sig = await A.signTypedData(tandaiDilihatTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan LihatBlokir TIDAK sah sebagai LihatKecocokan — arah sebaliknya", async () => {
    const { recoverLihatKecocokanSigner } = await import("../src/meet");
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverLihatKecocokanSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});

/**
 * Minor T1 review akhir. Dua arah yang belum dikunci:
 *
 * - bukti BACA → perintah TULIS: LihatBlokir berkeliaran di query string
 *   `GET /blokir`; kalau ia sah sebagai TandaiDilihat, siapa pun yang
 *   menangkap URL-nya bisa membungkam lencana kecocokan pemiliknya.
 * - Blokir vs InginBertemu: bentuk jenisnya sama (address, address, bool,
 *   uint64), hanya nama tipe dan nama medan bool yang berbeda. Kalau salah
 *   satu sah sebagai yang lain, memblokir seseorang sekaligus menandainya —
 *   atau menandai seseorang sekaligus memblokirnya.
 */
describe("LihatBlokir vs TandaiDilihat, Blokir vs InginBertemu", () => {
  it("tanda tangan LihatBlokir TIDAK sah sebagai TandaiDilihat", async () => {
    const msg = { who: A.address as Address, expiresAt: EXP };
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverTandaiDilihatSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan Blokir TIDAK sah sebagai InginBertemu", async () => {
    const sig = await A.signTypedData(blokirTypedData(
      { target: B, who: A.address as Address, blokir: true, expiresAt: EXP }, KONTRAK));
    expect((await recoverInginBertemuSigner(
      { target: B, who: A.address as Address, ingin: true, expiresAt: EXP }, sig, KONTRAK,
    )).toLowerCase()).not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan InginBertemu TIDAK sah sebagai Blokir", async () => {
    const sig = await A.signTypedData(inginBertemuTypedData(
      { target: B, who: A.address as Address, ingin: true, expiresAt: EXP }, KONTRAK));
    expect((await recoverBlokirSigner(
      { target: B, who: A.address as Address, blokir: true, expiresAt: EXP }, sig, KONTRAK,
    )).toLowerCase()).not.toBe(A.address.toLowerCase());
  });
});
