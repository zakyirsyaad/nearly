import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { computeTrust } from "../src/index";
import type { TrustEdge, TrustGraph, TrustResult } from "../src/index";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const MIN = 60_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;
const SEED = addr(1);

function edge(a: Address, b: Address, occasionId: string, atMs: number): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

function graph(over: Partial<TrustGraph> = {}): TrustGraph {
  return {
    edges: [],
    vouches: [],
    seeds: [{ address: SEED, weight: 1 }],
    slashed: [],
    nowMs: NOW,
    ...over,
  };
}

const find = (rows: TrustResult[], a: Address): TrustResult =>
  rows.find((r) => r.address === (a.toLowerCase() as Address))!;

/** Graf jujur: satu orang bertemu banyak orang di banyak occasion, banyak hari. */
function honestEdges(who: Address, n: number, base = 100): TrustEdge[] {
  return Array.from({ length: n }, (_, i) =>
    edge(who, addr(base + i), `acara-${i % 8}`, NOW - (i % 8) * 20 * DAY),
  );
}

describe("computeTrust", () => {
  it("GERBANG: gumpalan sybil berdiri di tier Baru, orang jujur di atasnya", () => {
    const edges = [...honestEdges(SEED, 8, 100)];
    const sybil = Array.from({ length: 100 }, (_, i) => addr(2000 + i));
    for (let i = 0; i < sybil.length; i++) {
      for (let j = i + 1; j < sybil.length; j++) edges.push(edge(sybil[i]!, sybil[j]!, "gumpalan", NOW));
    }

    const rows = computeTrust(graph({ edges }));

    // Gumpalan sybil: NOL MUTLAK, bukan sekadar kecil. Tidak ada satu pun
    // jalur dari mereka ke seed, jadi tidak ada kepercayaan yang bisa masuk.
    for (const s of sybil) {
      expect(find(rows, s).ratio).toBe(0);
      expect(find(rows, s).tier).toBe(0);
    }

    // addr(100) baru sekali bersalaman, jadi dia pun tier Baru — dan itu benar,
    // dia memang baru. Yang membedakannya dari bot bukan tier-nya, melainkan
    // bahwa skornya BUKAN nol: ada jalur nyata dari dia ke seed.
    expect(find(rows, addr(100)).ratio).toBeGreaterThan(0.01);
    expect(find(rows, SEED).tier).toBe(3);
  });

  it("GERBANG: tier orang yang sama TIDAK berubah saat populasi naik 20 -> 200", () => {
    const inti = honestEdges(SEED, 12, 100);
    const kecil = computeTrust(graph({ edges: inti }));

    const besar = [...inti];
    // 180 orang baru berdatangan, saling kenal di antara mereka sendiri.
    for (let i = 0; i < 180; i++) {
      besar.push(edge(addr(5000 + i), addr(5000 + ((i + 1) % 180)), `baru-${i % 5}`, NOW - (i % 5) * DAY));
    }
    const setelah = computeTrust(graph({ edges: besar }));

    expect(find(setelah, addr(100)).tier).toBe(find(kecil, addr(100)).tier);
    expect(find(setelah, SEED).tier).toBe(find(kecil, SEED).tier);
  });

  it("selalu ada TEPAT SATU alamat di rasio 1, dan dia tier Inti", () => {
    const rows = computeTrust(graph({ edges: honestEdges(SEED, 5, 100) }));
    const puncak = rows.filter((r) => r.ratio >= 1);
    expect(puncak).toHaveLength(1);
    expect(puncak[0]!.tier).toBe(3);
    // Penyebutnya skor tertinggi, bukan skor seed: PageRank berpersonalisasi
    // tidak menjamin seed yang tertinggi (spec fase §4.5).
    for (const r of rows) expect(r.ratio).toBeLessThanOrEqual(1);
  });

  it("seed tetap berada jauh di atas gumpalan yang tidak terhubung", () => {
    const edges = [...honestEdges(SEED, 5, 100)];
    for (let i = 0; i < 20; i++) {
      edges.push(edge(addr(3000 + i), addr(3000 + ((i + 1) % 20)), "gumpalan", NOW));
    }
    const rows = computeTrust(graph({ edges }));
    expect(find(rows, SEED).ratio).toBeGreaterThan(find(rows, addr(3000)).ratio * 50);
  });

  it("vouch menaikkan skor orang yang dijamin", () => {
    const edges = [
      ...honestEdges(SEED, 6, 100),
      edge(SEED, addr(300), "acara-0", NOW),
      edge(SEED, addr(301), "acara-0", NOW),
    ];
    const tanpa = computeTrust(graph({ edges }));
    const dengan = computeTrust(
      graph({ edges, vouches: [{ from: SEED, to: addr(300), atMs: NOW }] }),
    );
    expect(find(dengan, addr(300)).score).toBeGreaterThan(find(tanpa, addr(300)).score);
  });

  it("50 koneksi di 1 occasion menghasilkan skor lebih kecil dari 50 koneksi di 10 occasion", () => {
    const sempitEdges = [
      ...honestEdges(SEED, 4, 50),
      ...Array.from({ length: 50 }, (_, i) => edge(addr(10), addr(400 + i), "satu-ruangan", NOW)),
      edge(SEED, addr(10), "acara-0", NOW),
    ];
    const luasEdges = [
      ...honestEdges(SEED, 4, 50),
      ...Array.from({ length: 50 }, (_, i) =>
        edge(addr(10), addr(400 + i), `acara-${i % 10}`, NOW - (i % 10) * 20 * DAY),
      ),
      edge(SEED, addr(10), "acara-0", NOW),
    ];
    const sempit = find(computeTrust(graph({ edges: sempitEdges })), addr(10));
    const luas = find(computeTrust(graph({ edges: luasEdges })), addr(10));
    expect(sempit.score).toBeLessThan(luas.score * 0.6);
  });

  it("lima akun satu operator berbagi satu skor, dibagi rata", () => {
    const edges = [...honestEdges(SEED, 6, 100)];
    const palsu = [901, 902, 903, 904, 905].map(addr);
    const korban = [100, 101, 102, 103, 104, 105].map(addr);
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000)));
    });

    const rows = computeTrust(graph({ edges }));
    const skor = palsu.map((p) => find(rows, p));
    for (const s of skor) expect(s.operatorCluster).toBe(palsu[0]!.toLowerCase());
    for (const s of skor) expect(s.score).toBeCloseTo(skor[0]!.score, 12);
  });

  it("alamat ter-slash jatuh ke Baru dan penjaminnya ikut turun", () => {
    const penipu = addr(666);
    const penjamin = addr(100);
    const edges = [
      ...honestEdges(SEED, 8, 100),
      edge(penjamin, penipu, "acara-1", NOW),
      edge(SEED, penipu, "acara-2", NOW - 20 * DAY),
    ];
    const vouches = [{ from: penjamin, to: penipu, atMs: NOW }];

    const sebelum = computeTrust(graph({ edges, vouches }));
    const sesudah = computeTrust(graph({ edges, vouches, slashed: [penipu] }));

    expect(find(sesudah, penipu).score).toBe(0);
    expect(find(sesudah, penipu).tier).toBe(0);
    expect(find(sesudah, penjamin).score).toBeLessThan(find(sebelum, penjamin).score);
  });

  it("bukti terhitung: koneksi, occasion, wilayah, vouch", () => {
    const edges = [
      edge(SEED, addr(100), "qqguv1r:1", NOW),
      edge(SEED, addr(101), "qqguv1r:2", NOW),
      edge(SEED, addr(102), "w1xyz00:1", NOW),
    ];
    // Vouch mengarah KE seed, karena bukti vouch menghitung yang DITERIMA —
    // lihat test berikutnya. Menjamin orang lain bukan bukti tentang dirimu.
    const rows = computeTrust(
      graph({ edges, vouches: [{ from: addr(100), to: SEED, atMs: NOW }] }),
    );
    const seed = find(rows, SEED);
    expect(seed.evidence.connections).toBe(3);
    expect(seed.evidence.occasions).toBe(3);
    expect(seed.evidence.regions).toBe(2);
    expect(seed.evidence.vouches).toBe(1);
  });

  it("bukti vouch menghitung yang DITERIMA, bukan yang diberikan", () => {
    const edges = [edge(SEED, addr(100), "o1:1", NOW)];
    const rows = computeTrust(
      graph({ edges, vouches: [{ from: SEED, to: addr(100), atMs: NOW }] }),
    );
    expect(find(rows, addr(100)).evidence.vouches).toBe(1);
    expect(find(rows, SEED).evidence.vouches).toBe(0);
  });

  it("deterministik: dua kali jalan menghasilkan hasil identik", () => {
    const g = graph({ edges: honestEdges(SEED, 10, 100) });
    expect(computeTrust(g)).toEqual(computeTrust(g));
  });

  it("terurut menurun berdasarkan skor", () => {
    const rows = computeTrust(graph({ edges: honestEdges(SEED, 10, 100) }));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.score).toBeGreaterThanOrEqual(rows[i]!.score);
    }
  });

  it("graf kosong dengan seed saja tidak meledak", () => {
    const rows = computeTrust(graph());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.address).toBe(SEED.toLowerCase());
  });
});
