import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  buildDirectedGraph, halfLifeDecay, noDecay, vouchKey, VOUCH_EDGE_WEIGHT,
  allAddresses,
} from "../src/index";
import type { TrustGraph } from "../src/index";

const A = "0x000000000000000000000000000000000000000a" as Address;
const B = "0x000000000000000000000000000000000000000b" as Address;
const C = "0x000000000000000000000000000000000000000c" as Address;

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function graph(over: Partial<TrustGraph> = {}): TrustGraph {
  return {
    edges: [{ a: A, b: B, occasionId: "o1", atMs: NOW, blocked: false }],
    vouches: [],
    seeds: [{ address: A, weight: 1 }],
    slashed: [],
    nowMs: NOW,
    ...over,
  };
}

describe("buildDirectedGraph", () => {
  it("satu koneksi menjadi dua edge berarah berbobot 1", () => {
    const g = buildDirectedGraph(graph());
    expect(g.get(A)?.get(B)).toBe(1);
    expect(g.get(B)?.get(A)).toBe(1);
  });

  it("vouch hanya menaikkan bobot ke arah yang dijamin", () => {
    const g = buildDirectedGraph(graph({ vouches: [{ from: A, to: B, atMs: NOW }] }));
    expect(g.get(A)?.get(B)).toBe(VOUCH_EDGE_WEIGHT);
    expect(g.get(B)?.get(A)).toBe(1);
  });

  it("vouch tanpa koneksi fisik diabaikan sepenuhnya", () => {
    const g = buildDirectedGraph(graph({ vouches: [{ from: A, to: C, atMs: NOW }] }));
    expect(g.get(A)?.get(C)).toBeUndefined();
  });

  it("edge blocked tidak masuk graf sama sekali", () => {
    const g = buildDirectedGraph(
      graph({ edges: [{ a: A, b: B, occasionId: "o1", atMs: NOW, blocked: true }] }),
    );
    expect(g.get(A)?.get(B)).toBeUndefined();
    expect(g.get(B)?.get(A)).toBeUndefined();
  });

  it("alamat ter-slash tidak lagi menghantar kepercayaan ke luar", () => {
    const g = buildDirectedGraph(graph({ slashed: [B] }));
    // A tetap terhubung ke B; yang dicabut adalah aliran KELUAR dari B.
    expect(g.get(A)?.get(B)).toBe(1);
    expect(g.get(B)?.size ?? 0).toBe(0);
  });

  it("peluruhan mati secara bawaan (spec §11.1 butir 7)", () => {
    const lama = graph({
      edges: [{ a: A, b: B, occasionId: "o1", atMs: NOW - 700 * DAY, blocked: false }],
    });
    expect(buildDirectedGraph(lama).get(A)?.get(B)).toBe(1);
  });

  it("peluruhan melemahkan koneksi lama saat diaktifkan", () => {
    const lama = graph({
      edges: [{ a: A, b: B, occasionId: "o1", atMs: NOW - 180 * DAY, blocked: false }],
    });
    const w = buildDirectedGraph(lama, { decay: halfLifeDecay(180 * DAY) }).get(A)?.get(B);
    expect(w).toBeCloseTo(0.5, 6);
  });

  it("alamat huruf besar dinormalkan jadi huruf kecil", () => {
    const upper = "0x000000000000000000000000000000000000000A" as Address;
    const g = buildDirectedGraph(graph({ edges: [{ a: upper, b: B, occasionId: "o1", atMs: NOW, blocked: false }] }));
    expect(g.get(A)?.get(B)).toBe(1);
  });
});

describe("allAddresses", () => {
  it("terurut dan tanpa duplikat, supaya hasilnya deterministik", () => {
    const g = graph({
      edges: [
        { a: B, b: C, occasionId: "o1", atMs: NOW, blocked: false },
        { a: A, b: B, occasionId: "o1", atMs: NOW, blocked: false },
      ],
    });
    expect(allAddresses(g)).toEqual([A, B, C]);
  });
});

describe("vouchKey", () => {
  it("berarah: from->to berbeda dari to->from", () => {
    expect(vouchKey(A, B)).not.toBe(vouchKey(B, A));
  });
});

describe("noDecay", () => {
  it("selalu 1", () => {
    expect(noDecay(0)).toBe(1);
    expect(noDecay(999 * DAY)).toBe(1);
  });
});
