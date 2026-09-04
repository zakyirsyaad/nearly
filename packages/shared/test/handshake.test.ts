import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  offerTypedData, acceptTypedData,
  recoverOfferSigner, recoverAcceptSigner,
  QR_TTL_MS, OfferRequestSchema, AcceptRequestSchema,
} from "../src/index";

const A = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const B = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const VC = "0x0000000000000000000000000000000000000abc" as const;
const NONCE = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const EXPIRES = 1_700_000_030n;

describe("offer", () => {
  it("memulihkan alamat penanda tangan", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await A.signTypedData(offerTypedData(offer, VC));
    expect(await recoverOfferSigner(offer, sig, VC)).toBe(A.address);
  });

  it("payload yang diubah menghasilkan penanda tangan berbeda", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await A.signTypedData(offerTypedData(offer, VC));
    const diubah = { ...offer, expiresAt: EXPIRES + 1n };
    expect(await recoverOfferSigner(diubah, sig, VC)).not.toBe(A.address);
  });

  it("verifyingContract berbeda menghasilkan penanda tangan berbeda", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await A.signTypedData(offerTypedData(offer, VC));
    const lain = "0x0000000000000000000000000000000000000def" as const;
    expect(await recoverOfferSigner(offer, sig, lain)).not.toBe(A.address);
  });
});

describe("accept", () => {
  it("memulihkan alamat pemindai", async () => {
    const acc = { initiator: A.address, counterparty: B.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await B.signTypedData(acceptTypedData(acc, VC));
    expect(await recoverAcceptSigner(acc, sig, VC)).toBe(B.address);
  });

  it("tanda tangan offer TIDAK berlaku sebagai accept", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
    const sigOffer = await A.signTypedData(offerTypedData(offer, VC));
    const acc = { ...offer, counterparty: B.address };
    expect(await recoverAcceptSigner(acc, sigOffer, VC)).not.toBe(A.address);
  });
});

describe("QR_TTL_MS", () => {
  it("30 detik sesuai spec §7.1", () => {
    expect(QR_TTL_MS).toBe(30_000);
  });
});

describe("OfferRequestSchema", () => {
  const valid = {
    initiator: A.address,
    nonce: NONCE,
    expiresAt: "1700000030",
    sigOffer: `0x${"11".repeat(65)}`,
    cell: "qqguv3z",
    atMs: 1_700_000_000_000,
  };

  it("menerima body yang sah", () => {
    expect(OfferRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak alamat yang bukan hex 20 byte", () => {
    expect(OfferRequestSchema.safeParse({ ...valid, initiator: "bukan-alamat" }).success).toBe(false);
  });

  it("menolak sel geohash yang panjangnya bukan 7", () => {
    expect(OfferRequestSchema.safeParse({ ...valid, cell: "qqg" }).success).toBe(false);
  });

  it("menolak sel dengan huruf yang tidak ada di alfabet geohash", () => {
    expect(OfferRequestSchema.safeParse({ ...valid, cell: "qqguv3a" }).success).toBe(false);
  });
});

describe("AcceptRequestSchema", () => {
  const valid = {
    initiator: A.address,
    counterparty: B.address,
    nonce: NONCE,
    expiresAt: "1700000030",
    sigAccept: `0x${"22".repeat(65)}`,
    cell: "qqguv3z",
    atMs: 1_700_000_000_000,
  };

  it("menerima body yang sah", () => {
    expect(AcceptRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak handshake dengan diri sendiri", () => {
    expect(AcceptRequestSchema.safeParse({ ...valid, counterparty: valid.initiator }).success).toBe(false);
  });

  it("menolak handshake dengan diri sendiri walau beda kapitalisasi", () => {
    expect(AcceptRequestSchema.safeParse({
      ...valid, counterparty: valid.initiator.toUpperCase().replace("0X", "0x"),
    }).success).toBe(false);
  });
});
