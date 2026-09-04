import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { allAddresses, buildDirectedGraph, personalizedPageRank } from "../src/index";
import type { TrustEdge, TrustGraph } from "../src/index";

const NOW = 1_700_000_000_000;
const addr = (n: number): Address =>
  (`0x${n.toString(16).padStart(40, "0")}`) as Address;

const SEED = addr(1);

function edge(a: Address, b: Address, occasionId = "o1", atMs = NOW): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

function run(edges: TrustEdge[], seeds = [{ address: SEED, weight: 1 }]) {
  const g: TrustGraph = { edges, vouches: [], seeds, slashed: [], nowMs: NOW };
  return personalizedPageRank(buildDirectedGraph(g), seeds, allAddresses(g));
}

describe("personalizedPageRank", () => {
  it("GERBANG: gumpalan 100 sybil tanpa jalur ke seed mendekati nol", () => {
    const edges: TrustEdge[] = [];
    // Graf jujur kecil yang tersambung ke seed.
    for (let i = 2; i <= 6; i++) edges.push(edge(SEED, addr(i), `jujur-${i}`));

    // 100 akun sybil, saling terkoneksi rapat, TANPA satu pun jalur ke seed.
    const sybil = Array.from({ length: 100 }, (_, i) => addr(1000 + i));
    for (let i = 0; i < sybil.length; i++) {
      for (let j = i + 1; j < sybil.length; j++) {
        edges.push(edge(sybil[i]!, sybil[j]!, "gumpalan"));
      }
    }

    const scores = run(edges);
    const seedScore = scores.get(SEED.toLowerCase())!;
    for (const s of sybil) {
      expect(scores.get(s.toLowerCase())! / seedScore).toBeLessThan(0.01);
    }
  });

  it("seed selalu menerima setidaknya jatah teleport-nya", () => {
    const scores = run([edge(SEED, addr(2)), edge(addr(2), addr(3))]);
    // (1 - damping) x bobot teleport = 0.15. Ini lantai yang dijamin
    // matematika: seed tidak bisa jatuh di bawahnya sebesar apa pun grafnya.
    expect(scores.get(SEED.toLowerCase())!).toBeGreaterThanOrEqual(0.15);
  });

  it("simpul hub BISA melampaui seed — dan itu memang benar", () => {
    // seed hanya punya satu tetangga; addr(2) punya dua, jadi kepercayaan
    // menumpuk di sana. PageRank berpersonalisasi TIDAK menjamin seed
    // tertinggi, dan inilah alasan rasio dinormalisasi terhadap skor
    // tertinggi di graf, bukan terhadap skor seed (spec fase §4.5).
    // Jangan "perbaiki" ini dengan memaksa seed menang.
    const scores = run([edge(SEED, addr(2)), edge(addr(2), addr(3))]);
    expect(scores.get(addr(2).toLowerCase())!).toBeCloseTo(0.45946, 4);
    expect(scores.get(SEED.toLowerCase())!).toBeCloseTo(0.34527, 4);
  });

  it("makin jauh dari seed makin kecil", () => {
    const scores = run([edge(SEED, addr(2)), edge(addr(2), addr(3)), edge(addr(3), addr(4))]);
    expect(scores.get(addr(2).toLowerCase())!).toBeGreaterThan(scores.get(addr(3).toLowerCase())!);
    expect(scores.get(addr(3).toLowerCase())!).toBeGreaterThan(scores.get(addr(4).toLowerCase())!);
  });

  it("total skor mendekati 1", () => {
    const scores = run([edge(SEED, addr(2)), edge(addr(2), addr(3))]);
    const total = [...scores.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("deterministik: dua kali jalan menghasilkan angka identik", () => {
    const edges = [edge(SEED, addr(2)), edge(addr(2), addr(3)), edge(SEED, addr(4))];
    expect([...run(edges).entries()]).toEqual([...run(edges).entries()]);
  });

  it("node tanpa koneksi apa pun mendapat nol", () => {
    const g: TrustGraph = {
      edges: [edge(SEED, addr(2))],
      vouches: [],
      seeds: [{ address: SEED, weight: 1 }],
      slashed: [],
      nowMs: NOW,
    };
    const nodes = [...allAddresses(g), addr(99).toLowerCase()];
    const scores = personalizedPageRank(buildDirectedGraph(g), g.seeds, nodes);
    expect(scores.get(addr(99).toLowerCase())).toBe(0);
  });

  it("beberapa seed berbagi massa sesuai bobotnya", () => {
    const s2 = addr(2);
    const seeds = [{ address: SEED, weight: 3 }, { address: s2, weight: 1 }];
    const scores = run([edge(SEED, addr(5)), edge(s2, addr(6))], seeds);
    expect(scores.get(SEED.toLowerCase())!).toBeGreaterThan(scores.get(s2.toLowerCase())!);
  });
});
