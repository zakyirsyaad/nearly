import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatFeedTypedData, recoverLihatFeedSigner } from "../src/feed";
import {
  lihatKecocokanTypedData, recoverLihatKecocokanSigner,
  recoverTandaiDilihatSigner, tandaiDilihatTypedData,
} from "../src/meet";
import { lihatBlokirTypedData, recoverLihatBlokirSigner } from "../src/blokir";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const KONTRAK = "0x00000000000000000000000000000000000c0de0" as Address;
const EXP = 1_800_000_000n;
const msg = { who: A.address as Address, expiresAt: EXP };
const aku = A.address.toLowerCase();

/**
 * C1 review akhir. `LihatFeed` anggota KEEMPAT keluarga `{ who, expiresAt }`
 * bersama LihatKecocokan, TandaiDilihat, dan LihatBlokir. Hanya nama tipenya
 * yang membedakan digest-nya — jadi setiap pasangan diuji ke DUA arah:
 * tanda tangan yang sah, dari kunci yang benar, atas nilai yang benar, hanya
 * nama tipenya berbeda, wajib tidak memulihkan penanda tangan.
 *
 * Arah yang paling berbahaya adalah bukti feed → TandaiDilihat: bukti feed
 * dikirim di query string setiap kali layar feed dibuka, jadi kalau ia sah
 * sebagai perintah tulis, siapa pun yang melihat log URL bisa menulis atas
 * nama pemiliknya.
 */
describe("LihatFeed", () => {
  it("memulihkan penanda tangan yang benar", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    expect((await recoverLihatFeedSigner(msg, sig, KONTRAK)).toLowerCase()).toBe(aku);
  });

  it("domain terikat ke kontrak — kontrak lain tidak memulihkan penanda tangan", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    const lain = "0x00000000000000000000000000000000000c0de1" as Address;
    expect((await recoverLihatFeedSigner(msg, sig, lain)).toLowerCase()).not.toBe(aku);
  });

  it("expiresAt ikut ditandatangani", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    const digeser = { ...msg, expiresAt: EXP + 3600n };
    expect((await recoverLihatFeedSigner(digeser, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });
});

describe("LihatFeed vs tiga tipe sebentuk lainnya", () => {
  it("tanda tangan LihatFeed TIDAK sah sebagai LihatKecocokan", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    expect((await recoverLihatKecocokanSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });

  it("tanda tangan LihatFeed TIDAK sah sebagai TandaiDilihat", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    expect((await recoverTandaiDilihatSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });

  it("tanda tangan LihatFeed TIDAK sah sebagai LihatBlokir", async () => {
    const sig = await A.signTypedData(lihatFeedTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });

  it("tanda tangan LihatKecocokan TIDAK sah sebagai LihatFeed", async () => {
    const sig = await A.signTypedData(lihatKecocokanTypedData(msg, KONTRAK));
    expect((await recoverLihatFeedSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });

  it("tanda tangan TandaiDilihat TIDAK sah sebagai LihatFeed", async () => {
    const sig = await A.signTypedData(tandaiDilihatTypedData(msg, KONTRAK));
    expect((await recoverLihatFeedSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });

  it("tanda tangan LihatBlokir TIDAK sah sebagai LihatFeed", async () => {
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverLihatFeedSigner(msg, sig, KONTRAK)).toLowerCase()).not.toBe(aku);
  });
});
