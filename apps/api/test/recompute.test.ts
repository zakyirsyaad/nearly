import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import type { TrustResult } from "@nearly/trust";
import { changedTiers, recomputeTrust, SCORE_SCALE, toChainScore } from "../src/trust/recompute";
import type { AttestorPort, TrustStore } from "../src/ports";

const NOW = 1_700_000_000_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;

function result(a: Address, tier: 0 | 1 | 2 | 3, ratio = 0.5): TrustResult {
  return {
    address: a.toLowerCase() as Address,
    score: ratio,
    ratio,
    tier,
    evidence: { connections: 1, occasions: 1, regions: 1, vouches: 0 },
    operatorCluster: null,
  };
}

describe("toChainScore", () => {
  it("rasio 0.15 menjadi 150000", () => {
    expect(toChainScore(0.15)).toBe(150_000);
  });

  it("membulatkan ke bilangan bulat", () => {
    expect(Number.isInteger(toChainScore(0.1234567))).toBe(true);
  });

  it("dijepit ke rentang yang diterima kontrak", () => {
    expect(toChainScore(1.5)).toBe(SCORE_SCALE);
    expect(toChainScore(-1)).toBe(0);
    expect(toChainScore(Number.NaN)).toBe(0);
  });
});

describe("changedTiers", () => {
  it("alamat yang belum pernah dipublikasi ikut terkirim", () => {
    expect(changedTiers([result(addr(1), 2)], new Map())).toHaveLength(1);
  });

  it("GERBANG: tier yang tidak berubah TIDAK ikut terkirim", () => {
    const published = new Map([[addr(1).toLowerCase(), 2]]);
    expect(changedTiers([result(addr(1), 2)], published)).toEqual([]);
  });

  it("skor bergeser tapi tier tetap sama TIDAK ikut terkirim", () => {
    const published = new Map([[addr(1).toLowerCase(), 2]]);
    expect(changedTiers([result(addr(1), 2, 0.44)], published)).toEqual([]);
  });

  it("tier naik ikut terkirim", () => {
    const published = new Map([[addr(1).toLowerCase(), 1]]);
    expect(changedTiers([result(addr(1), 2)], published)).toHaveLength(1);
  });

  it("tier turun ikut terkirim", () => {
    const published = new Map([[addr(1).toLowerCase(), 3]]);
    expect(changedTiers([result(addr(1), 0)], published)).toHaveLength(1);
  });

  it("dari 200 alamat yang cuma 3 berubah tier, hanya 3 yang terkirim", () => {
    const rows = Array.from({ length: 200 }, (_, i) => result(addr(i + 1), 1));
    const published = new Map(rows.map((r) => [r.address, 1]));
    rows[5]!.tier = 2;
    rows[50]!.tier = 3;
    rows[199]!.tier = 0;
    expect(changedTiers(rows, published)).toHaveLength(3);
  });
});

describe("recomputeTrust", () => {
  it("menyimpan snapshot untuk SEMUA alamat, bukan hanya yang berubah", async () => {
    const saved: TrustResult[][] = [];
    const trust: TrustStore = {
      loadGraph: async () => ({
        edges: [], vouches: [], seeds: [{ address: addr(1), weight: 1 }],
        slashed: [], nowMs: NOW,
      }),
      saveSnapshots: async (rows) => { saved.push(rows); },
      getSnapshot: async () => null,
      listPublishedTiers: async () => new Map([[addr(1).toLowerCase(), 3]]),
      markPublished: async () => {},
    };
    const attestor: AttestorPort = {
      setScore: vi.fn(async (): Promise<Hex> => "0xdeadbeef" as Hex),
    };

    const out = await recomputeTrust(
      { trust, attestor, nowMs: () => NOW },
      { override: [result(addr(1), 3), result(addr(2), 0)] },
    );

    // Dua alamat disimpan sebagai snapshot, tapi hanya SATU yang tier-nya
    // berbeda dari yang sudah dipublikasi — jadi hanya satu yang naik ke chain.
    expect(saved[0]).toHaveLength(2);
    expect(out.computed).toBe(2);
    expect(out.published).toBe(1);
    expect(attestor.setScore).toHaveBeenCalledTimes(1);
  });

  it("satu tx yang gagal tidak membatalkan sisanya", async () => {
    let call = 0;
    const attestor: AttestorPort = {
      setScore: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error("gas habis");
        return "0xabc" as Hex;
      }),
    };
    const rows = [result(addr(1), 3), result(addr(2), 2), result(addr(3), 1)];
    const trust: TrustStore = {
      loadGraph: async () => ({
        edges: [], vouches: [], seeds: [{ address: addr(1), weight: 1 }],
        slashed: [], nowMs: NOW,
      }),
      saveSnapshots: async () => {},
      getSnapshot: async () => null,
      listPublishedTiers: async () => new Map(),
      markPublished: async () => {},
    };
    const out = await recomputeTrust(
      { trust, attestor, nowMs: () => NOW },
      { override: rows },
    );
    expect(out.failed).toBe(1);
    expect(out.published).toBe(2);
  });

  it("hanya menandai published untuk tx yang benar-benar berhasil", async () => {
    const marked: { address: Address }[][] = [];
    const attestor: AttestorPort = {
      setScore: vi.fn(async () => { throw new Error("gagal"); }),
    };
    const trust: TrustStore = {
      loadGraph: async () => ({
        edges: [], vouches: [], seeds: [{ address: addr(1), weight: 1 }],
        slashed: [], nowMs: NOW,
      }),
      saveSnapshots: async () => {},
      getSnapshot: async () => null,
      listPublishedTiers: async () => new Map(),
      markPublished: async (rows) => { marked.push(rows); },
    };
    await recomputeTrust(
      { trust, attestor, nowMs: () => NOW },
      { override: [result(addr(1), 3)] },
    );
    expect(marked.flat()).toHaveLength(0);
  });
});
