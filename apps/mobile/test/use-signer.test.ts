import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { pickSigner } from "../src/use-signer.js";

const ADDR = "0x0000000000000000000000000000000000000aaa" as Address;
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

describe("pickSigner", () => {
  it("wallet yang terhubung selalu menang atas dev key", () => {
    expect(pickSigner({ walletAddress: ADDR, devPrivateKey: PK, isDev: true }))
      .toEqual({ kind: "wallet" });
  });

  it("pakai dev key kalau tidak ada wallet DAN sedang mode dev", () => {
    expect(pickSigner({ walletAddress: undefined, devPrivateKey: PK, isDev: true }))
      .toEqual({ kind: "dev" });
  });

  it("TIDAK PERNAH pakai dev key di luar mode dev, walau key-nya ada", () => {
    expect(pickSigner({ walletAddress: undefined, devPrivateKey: PK, isDev: false }))
      .toEqual({ kind: "none" });
  });

  it("none kalau tidak ada wallet dan tidak ada dev key", () => {
    expect(pickSigner({ walletAddress: undefined, devPrivateKey: undefined, isDev: true }))
      .toEqual({ kind: "none" });
  });
});
