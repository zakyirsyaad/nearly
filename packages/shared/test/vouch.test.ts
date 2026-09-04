import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  normalizeTags, recoverRevokeSigner, recoverVouchSigner, revokeTypedData,
  tagsHashOf, vouchTypedData, VouchRequestSchema,
} from "../src/index";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const TO = "0x000000000000000000000000000000000000beef" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;

const msg = {
  from: account.address,
  to: TO,
  tagsHash: tagsHashOf(["real builder"]),
  expiresAt: 1_800_000_000n,
};

describe("normalizeTags", () => {
  it("memangkas spasi, menyeragamkan huruf kecil, membuang duplikat, dan mengurutkan", () => {
    expect(normalizeTags(["  Solid Dev ", "real builder", "SOLID DEV"]))
      .toEqual(["real builder", "solid dev"]);
  });

  it("membuang tag kosong", () => {
    expect(normalizeTags(["", "   ", "zk"])).toEqual(["zk"]);
  });

  it("memotong pada jumlah tag maksimum", () => {
    expect(normalizeTags(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(5);
  });

  it("memotong tag yang kepanjangan", () => {
    expect(normalizeTags(["x".repeat(100)])[0]).toHaveLength(24);
  });
});

describe("tagsHashOf", () => {
  it("urutan masukan tidak mengubah hash", () => {
    expect(tagsHashOf(["b", "a"])).toBe(tagsHashOf(["a", "b"]));
  });

  it("isi berbeda menghasilkan hash berbeda", () => {
    expect(tagsHashOf(["a"])).not.toBe(tagsHashOf(["b"]));
  });

  it("tag kosong tetap menghasilkan hash yang sah", () => {
    expect(tagsHashOf([])).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("vouchTypedData", () => {
  it("tanda tangan bisa dipulihkan kembali ke penandatangan", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    expect((await recoverVouchSigner(msg, sig, CONTRACT)).toLowerCase())
      .toBe(account.address.toLowerCase());
  });

  it("mengubah SATU field membuat pemulihan meleset", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const diubah = { ...msg, to: CONTRACT };
    expect((await recoverVouchSigner(diubah, sig, CONTRACT)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });

  it("terikat ke chainId 97 — tanda tangan tidak bisa dipakai ulang di chain lain", () => {
    expect(vouchTypedData(msg, CONTRACT).domain.chainId).toBe(97);
  });

  it("terikat ke alamat kontrak", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const lain = "0x00000000000000000000000000000000000c0de1" as Address;
    expect((await recoverVouchSigner(msg, sig, lain)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });
});

describe("revokeTypedData", () => {
  it("tanda tangan bisa dipulihkan kembali ke penandatangan", async () => {
    const r = { from: account.address, to: TO, expiresAt: 1_800_000_000n };
    const sig = await account.signTypedData(revokeTypedData(r, CONTRACT));
    expect((await recoverRevokeSigner(r, sig, CONTRACT)).toLowerCase())
      .toBe(account.address.toLowerCase());
  });

  it("tanda tangan vouch TIDAK bisa dipakai sebagai revoke", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const r = { from: account.address, to: TO, expiresAt: msg.expiresAt };
    expect((await recoverRevokeSigner(r, sig, CONTRACT)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });
});

describe("VouchRequestSchema", () => {
  it("menerima badan permintaan yang sah", () => {
    expect(VouchRequestSchema.safeParse({
      from: account.address, to: TO, tags: ["zk"],
      expiresAt: "1800000000", sig: `0x${"1".repeat(130)}`,
    }).success).toBe(true);
  });

  it("menolak alamat yang tidak sah", () => {
    expect(VouchRequestSchema.safeParse({
      from: "bukan-alamat", to: TO, tags: [], expiresAt: "1800000000", sig: `0x${"1".repeat(130)}`,
    }).success).toBe(false);
  });
});
