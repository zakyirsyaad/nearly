import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { orderPair, rowToOffer } from "../src/db.js";

const LOW = "0x0000000000000000000000000000000000000001" as Address;
const HIGH = "0xffffffffffffffffffffffffffffffffffffffff" as Address;

describe("orderPair", () => {
  it("mengembalikan urutan kanonik apa pun urutan masukannya", () => {
    expect(orderPair(LOW, HIGH)).toEqual([LOW, HIGH]);
    expect(orderPair(HIGH, LOW)).toEqual([LOW, HIGH]);
  });

  it("selalu huruf kecil, supaya constraint addr_a < addr_b konsisten", () => {
    const [a, b] = orderPair("0xAABB000000000000000000000000000000000000" as Address, LOW);
    expect(a).toBe(a.toLowerCase());
    expect(b).toBe(b.toLowerCase());
    expect(a < b).toBe(true);
  });
});

describe("rowToOffer", () => {
  const row = {
    nonce: `0x${"11".repeat(32)}`,
    initiator: "0x0000000000000000000000000000000000000abc",
    expires_at: "1700000030",
    sig_offer: `0x${"22".repeat(65)}`,
    cell: "qqguv3z",
    at_ms: "1700000000000",
    consumed_at: null,
  };

  it("mengubah expires_at menjadi bigint", () => {
    expect(rowToOffer(row).expiresAt).toBe(1_700_000_030n);
  });

  it("mengubah at_ms menjadi number", () => {
    expect(rowToOffer(row).atMs).toBe(1_700_000_000_000);
  });

  it("consumed_at null berarti belum terpakai", () => {
    expect(rowToOffer(row).consumed).toBe(false);
  });

  it("consumed_at berisi nilai berarti sudah terpakai", () => {
    expect(rowToOffer({ ...row, consumed_at: "2026-09-03T00:00:00Z" }).consumed).toBe(true);
  });
});
