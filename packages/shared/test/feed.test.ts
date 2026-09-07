import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  hapusPostTypedData, lampirGambarTypedData, likeTypedData, makePostId, postTypedData,
  recoverHapusPostSigner, recoverLampirGambarSigner, recoverLikeSigner, recoverPostSigner,
} from "../src/feed";

const KEY = `0x${"11".repeat(32)}` as Hex;
const akun = privateKeyToAccount(KEY);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const EXP = 1_800_000_000n;

describe("makePostId", () => {
  it("menghasilkan bytes32 heksa lowercase", () => {
    expect(makePostId()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("tidak pernah menghasilkan dua id yang sama", () => {
    const kumpulan = new Set(Array.from({ length: 200 }, () => makePostId()));
    expect(kumpulan.size).toBe(200);
  });
});

describe("tanda tangan Post", () => {
  const pesan = {
    postId: makePostId(), author: akun.address, body: "halo", expiresAt: EXP,
  };

  it("memulihkan penanda tangan", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    expect((await recoverPostSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // Body ikut ditandatangani: kalau tidak, siapa pun bisa menukar isi
  // unggahan sambil memakai tanda tangan yang sah.
  it("body yang diubah membuat pemulihan meleset", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    const dipalsu = { ...pesan, body: "halo!" };
    expect((await recoverPostSigner(dipalsu, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("kontrak domain yang berbeda membuat pemulihan meleset", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    const lain = "0x000000000000000000000000000000000000beef" as Address;
    expect((await recoverPostSigner(pesan, sig, lain)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});

describe("tanda tangan Like", () => {
  const dasar = { postId: makePostId(), who: akun.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const pesan = { ...dasar, suka: true };
    const sig = await akun.signTypedData(likeTypedData(pesan, KONTRAK));
    expect((await recoverLikeSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // `suka` bool berarti PEMBATALAN ikut ditandatangani. Tanpa ini, satu
  // tanda tangan bisa dipakai untuk menyukai DAN membatalkan.
  it("tanda tangan suka:true TIDAK sah sebagai suka:false", async () => {
    const sig = await akun.signTypedData(likeTypedData({ ...dasar, suka: true }, KONTRAK));
    const batal = { ...dasar, suka: false };
    expect((await recoverLikeSigner(batal, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});

/**
 * Penjaga langsung terhadap kelas kesalahan Ruling 23. Kalau salah satu tes
 * di bawah ini berubah hijau menjadi "cocok", artinya dua perintah berbeda
 * menerima tanda tangan yang sama dan satu bisa diputar ulang sebagai yang
 * lain.
 */
describe("tanda tangan tidak boleh menyeberang antar perintah", () => {
  const postId = makePostId();
  const dasar = { postId, author: akun.address, expiresAt: EXP };

  it("tanda tangan Post TIDAK sah sebagai HapusPost", async () => {
    const sig = await akun.signTypedData(
      postTypedData({ ...dasar, body: "halo" }, KONTRAK));
    expect((await recoverHapusPostSigner(dasar, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("tanda tangan Post TIDAK sah sebagai LampirGambar", async () => {
    const sig = await akun.signTypedData(
      postTypedData({ ...dasar, body: "halo" }, KONTRAK));
    const lampir = { ...dasar, mime: "image/jpeg" };
    expect((await recoverLampirGambarSigner(lampir, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("tanda tangan HapusPost TIDAK sah sebagai LampirGambar", async () => {
    const sig = await akun.signTypedData(hapusPostTypedData(dasar, KONTRAK));
    const lampir = { ...dasar, mime: "image/jpeg" };
    expect((await recoverLampirGambarSigner(lampir, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("HapusPost memulihkan penanda tangannya sendiri", async () => {
    const sig = await akun.signTypedData(hapusPostTypedData(dasar, KONTRAK));
    expect((await recoverHapusPostSigner(dasar, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  it("LampirGambar memulihkan penanda tangannya sendiri", async () => {
    const lampir = { ...dasar, mime: "image/jpeg" };
    const sig = await akun.signTypedData(lampirGambarTypedData(lampir, KONTRAK));
    expect((await recoverLampirGambarSigner(lampir, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // mime ikut ditandatangani: tanda tangan untuk JPEG tidak boleh dipakai
  // melampirkan tipe berkas lain.
  it("mime yang diubah membuat LampirGambar meleset", async () => {
    const lampir = { ...dasar, mime: "image/jpeg" };
    const sig = await akun.signTypedData(lampirGambarTypedData(lampir, KONTRAK));
    const ditukar = { ...dasar, mime: "image/png" };
    expect((await recoverLampirGambarSigner(ditukar, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});
