import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  makeNonce, qrExpiresAt, encodeQr, decodeQr, isQrExpired, QR_TTL_MS,
} from "../src/index.js";

const P = {
  v: 1 as const,
  initiator: "0x0000000000000000000000000000000000000abc" as Address,
  nonce: `0x${"11".repeat(32)}` as Hex,
  expiresAt: 1_700_000_030n,
  sigOffer: `0x${"22".repeat(65)}` as Hex,
};

describe("makeNonce", () => {
  it("menghasilkan hex 32 byte", () => {
    expect(makeNonce()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("tidak pernah mengulang — 500 nonce harus unik semua", () => {
    const set = new Set(Array.from({ length: 500 }, () => makeNonce()));
    expect(set.size).toBe(500);
  });
});

describe("qrExpiresAt", () => {
  it("30 detik ke depan, dalam satuan detik", () => {
    expect(qrExpiresAt(1_700_000_000_000)).toBe(1_700_000_030n);
  });

  it("konsisten dengan QR_TTL_MS", () => {
    const now = 1_700_000_000_000;
    expect(qrExpiresAt(now)).toBe(BigInt((now + QR_TTL_MS) / 1000));
  });
});

describe("encodeQr / decodeQr", () => {
  it("bolak-balik tanpa kehilangan data", () => {
    expect(decodeQr(encodeQr(P))).toEqual(P);
  });

  it("expiresAt tetap bigint setelah decode", () => {
    expect(typeof decodeQr(encodeQr(P))!.expiresAt).toBe("bigint");
  });

  it("mengembalikan null untuk string sembarang", () => {
    expect(decodeQr("halo dunia")).toBeNull();
  });

  it("mengembalikan null untuk JSON yang bukan payload QR", () => {
    expect(decodeQr('{"a":1}')).toBeNull();
  });

  it("mengembalikan null untuk versi format yang tidak dikenal", () => {
    const asing = encodeQr(P).replace('"v":1', '"v":99');
    expect(decodeQr(asing)).toBeNull();
  });

  it("mengembalikan null kalau tanda tangannya bukan 65 byte", () => {
    expect(decodeQr(encodeQr({ ...P, sigOffer: "0x1234" as Hex }))).toBeNull();
  });

  it("mengembalikan null untuk string kosong", () => {
    expect(decodeQr("")).toBeNull();
  });
});

describe("isQrExpired", () => {
  it("belum kedaluwarsa satu detik sebelum batas", () => {
    expect(isQrExpired(P, 1_700_000_029_000)).toBe(false);
  });

  it("belum kedaluwarsa tepat di batas", () => {
    expect(isQrExpired(P, 1_700_000_030_000)).toBe(false);
  });

  it("kedaluwarsa satu milidetik setelah batas", () => {
    expect(isQrExpired(P, 1_700_000_030_001)).toBe(true);
  });
});
