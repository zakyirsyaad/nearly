import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCORE_SCALE } from "../src/trust/recompute";

// Task 9: mirip pola packages/shared/test/vouch-typehash.test.ts — SCORE_SCALE
// di sini terikat ke TrustAttestor.sol HANYA lewat komentar ("WAJIB sama
// dengan SCORE_SCALE di TrustAttestor.sol"). Desinkron membuat SETIAP
// setScore revert BadScore, yang recomputeTrust telan menjadi failed++ —
// pemadaman publikasi on-chain yang senyap, tanpa error yang terlihat.
const SOL = fileURLToPath(
  new URL("../../../packages/contracts/src/TrustAttestor.sol", import.meta.url),
);

function solScoreScale(source: string): number {
  const m = source.match(/SCORE_SCALE\s*=\s*([\d_]+)\s*;/);
  if (!m) throw new Error("SCORE_SCALE tidak ditemukan di TrustAttestor.sol");
  return Number(m[1]!.replace(/_/g, ""));
}

describe("kunci SCORE_SCALE TypeScript <-> Solidity", () => {
  it("SCORE_SCALE di recompute.ts identik dengan SCORE_SCALE di TrustAttestor.sol", () => {
    const sol = readFileSync(SOL, "utf8");
    expect(SCORE_SCALE).toBe(solScoreScale(sol));
  });
});
