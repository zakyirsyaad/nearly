import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import * as shared from "../src/index";
import {
  daftarKunciPesanTypedData, kunciPesanTypedData, lihatBlokirTypedData, lihatFeedTypedData,
  lihatKecocokanTypedData, recoverDaftarKunciPesanSigner, tandaiDilihatTypedData, VERSI_KUNCI_PESAN,
} from "../src/index";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const K1 = `0x${"11".repeat(32)}` as Hex;
const K2 = `0x${"22".repeat(32)}` as Hex;
const EXP = 1_800_000_000n;

const BUKTI_BACA = [lihatFeedTypedData, lihatBlokirTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData];

describe("KunciPesan", () => {
  // Kunci pesan diturunkan dari tanda tangan ini (spec 4c §5.1). Kalau tanda
  // tangannya berubah antar-panggilan, riwayat tidak bisa dibaca ulang.
  it("tanda tangannya deterministik", async () => {
    const td = kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, VC);
    expect(await A.signTypedData(td)).toBe(await A.signTypedData(td));
  });

  it("versi berbeda menghasilkan tanda tangan berbeda", async () => {
    const v1 = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    const v2 = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 2 }, VC));
    expect(v1).not.toBe(v2);
  });

  it("dompet berbeda menghasilkan tanda tangan berbeda", async () => {
    const td = (who: Address) => kunciPesanTypedData({ who, versi: 1 }, VC);
    expect(await A.signTypedData(td(A.address))).not.toBe(await B.signTypedData(td(B.address)));
  });

  it("tidak ada fungsi recover untuk KunciPesan", () => {
    const recover = Object.keys(shared).filter((k) => /^recover.*KunciPesan/.test(k));
    expect(recover).toEqual(["recoverDaftarKunciPesanSigner"]);
  });

  // Ruling 23. KunciPesan berbentuk {who, versi}, keluarga bukti baca
  // berbentuk {who, expiresAt}. Bentuk berbeda bukan jaminan — namanya yang
  // memisahkan typehash, dan inilah buktinya.
  it("tanda tangan KunciPesan tidak pulih sebagai bukti baca mana pun", async () => {
    const sig = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    for (const td of BUKTI_BACA) {
      const pulih = await recoverTypedDataAddress({
        ...td({ who: A.address, expiresAt: 1n }, VC),
        signature: sig,
      } as any);
      expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
    }
  });

  it("bukti baca mana pun tidak pulih sebagai KunciPesan", async () => {
    for (const td of BUKTI_BACA) {
      const sig = await A.signTypedData(td({ who: A.address, expiresAt: 1n }, VC) as any);
      const pulih = await recoverTypedDataAddress({
        ...kunciPesanTypedData({ who: A.address, versi: 1 }, VC), signature: sig,
      });
      expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
    }
  });
});

describe("DaftarKunciPesan", () => {
  const msg = { who: A.address, kunciEnkripsi: K1, kunciTanda: K2, expiresAt: EXP };

  it("pulih ke penandatangannya", async () => {
    const sig = await A.signTypedData(daftarKunciPesanTypedData(msg, VC));
    expect((await recoverDaftarKunciPesanSigner(msg, sig, VC)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  it("menukar kunciTanda membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(daftarKunciPesanTypedData(msg, VC));
    const ditukar = { ...msg, kunciTanda: K1 };
    expect((await recoverDaftarKunciPesanSigner(ditukar, sig, VC)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan KunciPesan tidak pulih sebagai DaftarKunciPesan", async () => {
    const sig = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    expect((await recoverDaftarKunciPesanSigner(msg, sig, VC)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});
