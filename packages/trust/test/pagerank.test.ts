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
    // Lantai matematis: (1 - damping) x bobot-teleport-SEED-sendiri. Di sini
    // SEED sendirian memegang seluruh bobot teleport (weight 1 dari total 1),
    // jadi lantainya persis 0.15 = 0.15 x 1. Kalau ada seed lain yang berbagi
    // bobot teleport, lantai TIAP seed adalah porsinya masing-masing —
    // bukan tetap 0.15 "sebesar apa pun grafnya".
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

  it("graf tanpa seed sama sekali menghasilkan skor nol untuk semua node", () => {
    // Constraint global: tanpa seed (total bobot seed <= 0), tidak ada
    // kepercayaan sama sekali — bukan cuma seed yang nol, SEMUA node nol.
    const g: TrustGraph = {
      edges: [edge(SEED, addr(2)), edge(addr(2), addr(3))],
      vouches: [],
      seeds: [],
      slashed: [],
      nowMs: NOW,
    };
    const scores = personalizedPageRank(buildDirectedGraph(g), g.seeds, allAddresses(g));
    for (const [, s] of scores) expect(s).toBe(0);
  });

  it("massa dangling dari akun ter-slash kembali ke seed, bukan disebar rata", () => {
    const A = addr(10);
    const X = addr(11); // akan di-slash
    const Z1 = addr(20);
    const Z2 = addr(21); // komponen terpisah total, tanpa jalur ke seed sama sekali

    const seeds = [{ address: SEED, weight: 1 }];
    const g: TrustGraph = {
      edges: [edge(SEED, A), edge(A, X), edge(Z1, Z2)],
      vouches: [],
      seeds,
      slashed: [X],
      nowMs: NOW,
    };
    const nodes = allAddresses(g);
    const scores = personalizedPageRank(buildDirectedGraph(g), seeds, nodes);

    // X ter-slash: edge KELUAR-nya dihapus (lihat buildDirectedGraph), jadi X
    // jadi buntu sambil tetap memegang massa MASUK dari A — inilah dangling
    // mass yang nyata, bukan node kosong seperti test "node tanpa koneksi".
    expect(scores.get(X.toLowerCase())!).toBeGreaterThan(0);

    // Massa buntu itu WAJIB kembali ke seed lewat vektor teleport, bukan
    // disebar rata ke semua node. Z1/Z2 adalah komponen terpisah total, nol
    // bobot teleport, nol jalur ke seed — persis seperti gumpalan sybil di
    // test GERBANG. Kalau baris `dangling * t` diganti jadi `dangling /
    // nodes.length` (sebar rata), Z1 dan Z2 akan ikut kebagian dan tesnya
    // akan gagal.
    expect(scores.get(Z1.toLowerCase())).toBe(0);
    expect(scores.get(Z2.toLowerCase())).toBe(0);
  });
});
