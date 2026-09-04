import { describe, expect, it } from "vitest";
import { TIER_LABELS, TIER_THRESHOLDS, tierOf } from "../src/index";

describe("tierOf", () => {
  it("memetakan tiap rentang ke tier yang benar", () => {
    expect(tierOf(0)).toBe(0);
    expect(tierOf(0.019)).toBe(0);
    expect(tierOf(0.02)).toBe(1);
    expect(tierOf(0.149)).toBe(1);
    expect(tierOf(0.15)).toBe(2);
    expect(tierOf(0.449)).toBe(2);
    expect(tierOf(0.45)).toBe(3);
    expect(tierOf(1)).toBe(3);
  });

  it("rasio negatif atau NaN jatuh ke Baru, bukan meledak", () => {
    expect(tierOf(-1)).toBe(0);
    expect(tierOf(Number.NaN)).toBe(0);
  });

  it("ambang dan label sesuai spec §4.5", () => {
    expect(TIER_THRESHOLDS).toEqual([0.02, 0.15, 0.45]);
    expect(TIER_LABELS).toEqual(["Baru", "Dikenal", "Terpercaya", "Inti"]);
  });
});
