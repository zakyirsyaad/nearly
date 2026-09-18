import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  kunciPesanTypedData, recoverAcceptSigner, recoverOfferSigner, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { createSignerDariKunci } from "../src/signer";
import { kunciDariMnemonik } from "../src/dompet/dompet";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const OTHER = "0x0000000000000000000000000000000000000def" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const EXPIRES = 1_700_000_030n;

describe("createSignerDariKunci", () => {
  const signer = createSignerDariKunci(PK, VC);

  it("alamatnya sama dengan alamat turunan private key", () => {
    expect(signer.address).toBe(privateKeyToAccount(PK).address);
  });

  it("signOffer menghasilkan tanda tangan yang memulihkan alamatnya sendiri", async () => {
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signOffer(offer);
    expect(await recoverOfferSigner(offer, sig, VC)).toBe(signer.address);
  });

  it("signAccept menghasilkan tanda tangan yang memulihkan alamatnya sendiri", async () => {
    const acc = { initiator: OTHER, counterparty: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signAccept(acc);
    expect(await recoverAcceptSigner(acc, sig, VC)).toBe(signer.address);
  });

  it("tanda tangan terikat ke verifyingContract — kontrak lain tidak memulihkan alamat yang sama", async () => {
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signOffer(offer);
    expect(await recoverOfferSigner(offer, sig, OTHER)).not.toBe(signer.address);
  });
});

describe("signer dari kunci turunan 12 kata", () => {
  const kunci = kunciDariMnemonik("test test test test test test test test test test test junk");
  const signer = createSignerDariKunci(kunci, VC);

  it("memulihkan ke alamat vektor uji", async () => {
    expect(signer.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    expect(await recoverOfferSigner(offer, await signer.signOffer(offer), VC)).toBe(signer.address);
  });

  // Kunci pesan Fase 4c diturunkan dari tanda tangan KunciPesan (spec 4c §11.4):
  // tanda tangan yang berubah-ubah berarti riwayat pesan tidak bisa dibuka lagi.
  it("tanda tangan KunciPesan deterministik", async () => {
    const td = kunciPesanTypedData({ who: signer.address, versi: VERSI_KUNCI_PESAN }, VC);
    const a = await signer.signTypedData(td);
    const b = await signer.signTypedData(td);
    expect(a).toBe(b);
  });
});
