import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
  recoverInginBertemuSigner, recoverLihatKecocokanSigner, recoverLihatProfilSigner,
  recoverTandaiDilihatSigner,
} from "../src/meet";

const aku = privateKeyToAccount(`0x${"aa".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"bb".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const EXP = 1_800_000_000n;

describe("tanda tangan InginBertemu", () => {
  const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    expect((await recoverInginBertemuSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });

  // `ingin` bool berarti PENCABUTAN ikut ditandatangani. Tanpa ini, satu tanda
  // tangan bisa dipakai menandai DAN mencabut.
  it("tanda tangan ingin:true TIDAK sah sebagai ingin:false", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const cabut = { ...pesan, ingin: false };
    expect((await recoverInginBertemuSigner(cabut, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  // Target ikut ditandatangani: tanda tangan untuk menandai A tidak boleh
  // dipakai menandai B.
  it("target yang ditukar membuat pemulihan meleset", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const ditukar = { ...pesan, target: lain.address };
    expect((await recoverInginBertemuSigner(ditukar, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });
});

describe("tanda tangan LihatProfil", () => {
  const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    expect((await recoverLihatProfilSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});

describe("tanda tangan TandaiDilihat", () => {
  const pesan = { who: aku.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    expect((await recoverTandaiDilihatSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});

/**
 * INTI TASK INI. `LihatProfil` adalah bukti BACA yang berkeliaran di query
 * string; `InginBertemu` dan `TandaiDilihat` adalah perintah TULIS. Kalau
 * salah satu tes di bawah berubah menjadi "cocok", tanda tangan baca bisa
 * dipakai menandai orang atas nama korban — dan menandai memicu pengungkapan
 * identitas. Kelas kesalahan Ruling 23.
 */
describe("tanda tangan tidak boleh menyeberang antar perintah", () => {
  const dasar = { target: TARGET, who: aku.address, expiresAt: EXP };

  it("LihatProfil TIDAK sah sebagai InginBertemu", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(dasar, KONTRAK));
    const tulis = { ...dasar, ingin: true };
    expect((await recoverInginBertemuSigner(tulis, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("InginBertemu TIDAK sah sebagai LihatProfil", async () => {
    const sig = await aku.signTypedData(
      inginBertemuTypedData({ ...dasar, ingin: true }, KONTRAK));
    expect((await recoverLihatProfilSigner(dasar, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("LihatProfil TIDAK sah sebagai TandaiDilihat", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(dasar, KONTRAK));
    expect((await recoverTandaiDilihatSigner(
      { who: aku.address, expiresAt: EXP }, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("TandaiDilihat TIDAK sah sebagai InginBertemu", async () => {
    const sig = await aku.signTypedData(
      tandaiDilihatTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const tulis = { ...dasar, ingin: true };
    expect((await recoverInginBertemuSigner(tulis, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  /**
   * PASANGAN PALING BERBAHAYA. `LihatKecocokan` dan `TandaiDilihat` punya
   * bentuk field IDENTIK — hanya nama tipenya yang memisahkan bukti BACA dari
   * perintah TULIS. Kalau tes ini berubah menjadi "cocok", tanda tangan baca
   * yang bocor lewat query string bisa dipakai menghapus lencana kecocokan
   * orang lain, menyembunyikan dari mereka bahwa seseorang baru saja saling
   * menandai.
   */
  it("LihatKecocokan TIDAK sah sebagai TandaiDilihat", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    expect((await recoverTandaiDilihatSigner(pesan, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("TandaiDilihat TIDAK sah sebagai LihatKecocokan", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    expect((await recoverLihatKecocokanSigner(pesan, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("LihatKecocokan memulihkan penanda tangannya sendiri", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    expect((await recoverLihatKecocokanSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});
