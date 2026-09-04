import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverOfferSigner, recoverAcceptSigner } from "@nearly/shared";
import { createDevSigner } from "../src/signer";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const OTHER = "0x0000000000000000000000000000000000000def" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const EXPIRES = 1_700_000_030n;

describe("createDevSigner", () => {
  const signer = createDevSigner(PK, VC);

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
