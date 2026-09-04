import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { VOUCH_TYPES } from "../src/index";

const SOL = fileURLToPath(
  new URL("../../contracts/src/VouchRegistry.sol", import.meta.url),
);

function encodeType(name: keyof typeof VOUCH_TYPES): string {
  const fields = VOUCH_TYPES[name].map((f) => `${f.type} ${f.name}`).join(",");
  return `${name}(${fields})`;
}

/** Mengambil isi keccak256("...") yang mengikuti nama konstanta di Solidity. */
function typehashLiteral(source: string, constantName: string): string {
  const re = new RegExp(`${constantName}[^=]*=\\s*keccak256\\(\\s*"([^"]+)"`, "m");
  const m = source.match(re);
  if (!m) throw new Error(`typehash ${constantName} tidak ditemukan di VouchRegistry.sol`);
  return m[1]!;
}

describe("kunci EIP-712 TS <-> Solidity", () => {
  const sol = readFileSync(SOL, "utf8");

  it("string tipe Vouch identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "VOUCH_TYPEHASH")).toBe(encodeType("Vouch"));
  });

  it("string tipe RevokeVouch identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "REVOKE_TYPEHASH")).toBe(encodeType("RevokeVouch"));
  });

  it("hash-nya pun identik, bukan cuma stringnya", () => {
    expect(keccak256(toHex(typehashLiteral(sol, "VOUCH_TYPEHASH"))))
      .toBe(keccak256(toHex(encodeType("Vouch"))));
  });

  it("domain di kontrak memakai nama dan versi yang sama dengan TypeScript", () => {
    expect(sol).toContain('keccak256("Nearly")');
    expect(sol).toContain('keccak256("1")');
  });
});
