# Nearly — Rencana Implementasi Fase 2: Trust Score

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serangan sybil bisa didemokan dan gagal secara matematis: 100 akun yang saling terkoneksi berdiri di tier `Baru` dengan skor mendekati nol, sementara orang yang benar-benar bertemu manusia nyata berdiri di `Terpercaya`.

**Architecture:** Seluruh algoritma hidup sebagai **fungsi murni tanpa I/O** di `packages/trust`, dengan `computeTrust()` sebagai satu-satunya pintu keluar. API memuat graf dari Supabase, memanggilnya, menyimpan snapshot, lalu menulis on-chain **hanya untuk alamat yang tier-nya berubah**. Ini pola yang sama dengan Fase 1 (`colocation.ts` murni, `handshake-gate.ts` merakit), dan alasannya sama: uji sybil harus bisa berjalan tanpa DB, tanpa chain, tanpa device.

**Tech Stack:** pnpm workspaces · TypeScript · Vitest · viem · Hono · Supabase · Foundry/Solidity · BSC testnet (chainId 97) · Expo SDK 57

**Spec:** `docs/superpowers/specs/2026-09-04-nearly-fase-2-trust-design.md`

## Global Constraints

- **Tidak ada yang menilai siapa pun** (spec induk §6). Tidak ada downvote, rating, atau tombol untuk menjatuhkan orang. Satu-satunya yang menurunkan trust adalah slash terkonfirmasi.
- **Laporan TIDAK PERNAH menurunkan trust secara langsung** (§6 spec fase). Ia hanya memicu peninjauan.
- **`packages/trust` bebas I/O.** Tidak boleh mengimpor `@supabase/supabase-js`, `hono`, `node:fs`, atau melakukan panggilan jaringan. Kalau sebuah fungsi butuh data, data itu masuk lewat argumen.
- **Deterministik.** Input sama harus menghasilkan output identik — §10.3 spec induk menjanjikan siapa pun bisa menghitung ulang. Dilarang memakai `Math.random()`, `Date.now()` di dalam paket, atau iterasi atas `Set`/`Map` yang urutannya bergantung sisipan tanpa pengurutan eksplisit.
- **Alamat selalu huruf kecil** di seluruh perbandingan dan kunci map. Ini sudah jadi aturan repo sejak `orderPair()` di `apps/api/src/db.ts`.
- **Import relatif ditulis tanpa ekstensi** (aturan repo dari catatan Fase 1 butir 8 — Metro tidak memetakan `"./x.js"` ke `x.ts`).
- **Chain: BSC testnet, chainId 97.** `NEARLY_CHAIN_ID` di `packages/shared/src/handshake.ts` adalah sumber kebenarannya, dijaga test.
- **Ambang tier:** `0.02` / `0.15` / `0.45` atas rasio terhadap **skor tertinggi di graf** (bukan skor seed — PageRank berpersonalisasi tidak menjamin seed yang tertinggi).
- **Kuota vouch:** 3 per hari, global, ditegakkan di API.
- **Peluruhan waktu dibangun tapi tidak diaktifkan** (§11.1 butir 7 spec induk).
- Bahasa komentar & pesan commit: Indonesia. Nama simbol kode: Inggris.

### Yang sengaja TIDAK ada di fase ini

- Tidak ada tabel `events`, RSVP, atau check-in. `occasionId` diisi dari `(cell, jendela 3 jam)`.
- Tidak ada blokir. Kolom `blocked` ada di tipe dan selalu `false`.
- Tidak ada UI antrean moderasi. Konfirmasi slash lewat endpoint admin.
- Tidak ada batch `setScores`. Satu tx per skor.
- Tidak ada XMTP, radar, FYP.

---

## Peta Task

| # | Task | Deliverable |
|---|---|---|
| 1 | Paket `trust` + tipe + graf berarah | Fondasi; edge jadi dua arah berbobot |
| 2 | `pagerank.ts` | **Gumpalan sybil mendekati nol** |
| 3 | `diversity.ts` | 1 occasion jauh di bawah 10 occasion |
| 4 | `fingerprint.ts` | 5 akun satu operator terdeteksi |
| 5 | `slashing.ts` | **Brigading 20 orang gagal; 3 orang independen lolos** |
| 6 | `tier.ts` + `computeTrust()` | Pipeline §4.6 utuh; tier stabil saat populasi naik |
| 7 | EIP-712 vouch di `shared` | Tanda tangan vouch & revoke |
| 8 | `VouchRegistry.sol` | Vouch tanpa koneksi gagal on-chain |
| 9 | Kunci EIP-712 TS ↔ Solidity | Pagar anti-drift antar dua implementasi |
| 10 | `TrustAttestor.sol` + `NearlyResolver.sol` | Skor terbaca kontrak lain |
| 11 | Migrasi `0002_trust.sql` + port DB | Enam tabel + pemuat graf |
| 12 | Recompute + publish | **Publish hanya saat tier berubah** |
| 13 | Route trust, vouch, report, admin | Permukaan API lengkap |
| 14 | Deploy + seed + verifikasi manual | Tiga kontrak hidup di BSC testnet |
| 15 | Mobile: tier, bukti, vouch, lapor | Yang dilihat pengguna |

**Task 2 dan 5 adalah gerbang sebenarnya.** Task 2 membuktikan klaim anti-sybil; Task 5 menutup titik paling rawan di seluruh sistem (§12 spec induk). Kalau salah satunya lolos padahal seharusnya gagal, fase ini belum selesai berapa pun task lain yang sudah hijau.

**Urutan berantai lewat tipe.** Task 1 → 2 → 3 → 4 → 5 → 6 berurut. Task 7 → 8 → 9 berurut. Task 11 butuh 6. Task 12 butuh 6, 10, 11. Task 13 butuh 7, 11, 12. Task 14 butuh 8, 10. Task 15 butuh 13.

---

## Struktur File

| File | Tanggung jawab |
|---|---|
| `packages/trust/src/types.ts` | Kosakata bersama. Tidak ada logika |
| `packages/trust/src/graph.ts` | Edge kanonik + vouch berarah → graf berarah berbobot |
| `packages/trust/src/pagerank.ts` | Personalized PageRank dari seed |
| `packages/trust/src/diversity.ts` | Entropi occasion & waktu, clustering, pengali |
| `packages/trust/src/fingerprint.ts` | Jaccard + korelasi temporal → klaster operator |
| `packages/trust/src/slashing.ts` | Gerbang laporan + penalti penjamin |
| `packages/trust/src/tier.ts` | Rasio → tier |
| `packages/trust/src/index.ts` | `computeTrust()` — satu-satunya pintu keluar |
| `packages/shared/src/vouch.ts` | EIP-712 `Vouch` / `RevokeVouch` + `tagsHash` |
| `packages/contracts/src/VouchRegistry.sol` | Vouch, revoke, slash on-chain |
| `packages/contracts/src/TrustAttestor.sol` | Publikasi skor |
| `packages/contracts/src/NearlyResolver.sol` | Antarmuka baca untuk dApp lain |
| `apps/api/src/trust/load-graph.ts` | Supabase → `TrustGraph`. Satu-satunya yang tahu SQL trust |
| `apps/api/src/trust/recompute.ts` | Perakit + `changedTiers()` yang murni |
| `apps/api/src/trust/store.ts` | Adapter Supabase untuk trust, vouch, laporan |
| `apps/api/src/trust/attestor.ts` | Port tulis ke `TrustAttestor` |
| `apps/api/src/vouch-relayer.ts` | Port tulis ke `VouchRegistry` |
| `apps/api/src/vouch-gate.ts` | Kuota & aturan vouch, teruji tanpa HTTP |
| `apps/api/src/routes/trust.ts` | `GET /trust/:address` |
| `apps/api/src/routes/vouch.ts` | `POST /vouch`, `POST /vouch/revoke` |
| `apps/api/src/routes/report.ts` | `POST /report` |
| `apps/api/src/routes/admin.ts` | `POST /admin/slash/:address` |
| `supabase/migrations/0002_trust.sql` | Enam tabel trust |
| `apps/mobile/src/tier.ts` | Label tier + baris bukti (murni, teruji) |
| `apps/mobile/src/trust-api.ts` | Panggilan HTTP trust, vouch, lapor |

**Alasan pembagian ini:** `graph.ts` dipisah dari `pagerank.ts` karena perakitan bobot (vouch berarah, peluruhan, alamat ter-slash) adalah sumber bug yang berbeda dari iterasi numerik, dan keduanya perlu diuji terpisah. `changedTiers()` dipisah sebagai fungsi murni di dalam `recompute.ts` supaya penghematan gas — hal yang paling mudah rusak diam-diam — bisa diuji tanpa DB dan tanpa chain. Spec fase §3 menyebut `trust/publish.ts` sebagai berkas
tersendiri; di rencana ini perannya dipecah dua — `attestor.ts` sebagai port tulis, dan
penyaringnya ikut `recompute.ts` — supaya `changedTiers()` duduk tepat di sebelah pemanggilnya
dan tidak ada berkas berisi satu fungsi tanpa test sendiri.

---

## Task 1: Paket `trust` + tipe + graf berarah

**Files:**
- Create: `packages/trust/package.json`, `packages/trust/tsconfig.json`, `packages/trust/vitest.config.ts`
- Create: `packages/trust/src/types.ts`, `packages/trust/src/graph.ts`, `packages/trust/src/index.ts`
- Test: `packages/trust/test/graph.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `TrustEdge`, `Vouch`, `Seed`, `TrustGraph`, `TrustResult`, `Tier`, `DecayFn`
  - `VOUCH_EDGE_WEIGHT: 3`
  - `vouchKey(from: Address, to: Address): string`
  - `noDecay: DecayFn`
  - `halfLifeDecay(halfLifeMs: number): DecayFn`
  - `buildDirectedGraph(g: TrustGraph, opts?: { decay?: DecayFn }): DirectedGraph`
  - `type DirectedGraph = Map<string, Map<string, number>>`
  - `allAddresses(g: TrustGraph): string[]` — terurut, deterministik

- [ ] **Step 1: Buat kerangka paket**

`packages/trust/package.json`:
```json
{
  "name": "@nearly/trust",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "viem": "^2.21.0"
  }
}
```

`packages/trust/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/trust/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
```

Lalu jalankan `pnpm install` dari akar repo supaya workspace mengenali paket baru.

- [ ] **Step 2: Tulis tipe**

`packages/trust/src/types.ts`:
```ts
import type { Address } from "viem";

/**
 * Satu pertemuan fisik. KANONIK: a < b (huruf kecil), sama seperti constraint
 * connections_ordered di database. Edge tidak menyimpan vouch, karena vouch
 * berarah sedangkan pertemuan tidak (spec fase §4.1).
 */
export type TrustEdge = {
  a: Address;
  b: Address;
  /** Fase 2: `${cell}:${jendela 3 jam}`. Fase 3: id event terverifikasi. */
  occasionId: string;
  atMs: number;
  /** Fase 4. Selalu false sekarang; sudah ada di tipe supaya tidak perlu migrasi tipe nanti. */
  blocked: boolean;
};

/** BERARAH. `from` menjamin `to`, bukan sebaliknya. */
export type Vouch = { from: Address; to: Address; atMs: number };

export type Seed = { address: Address; weight: number };

export type TrustGraph = {
  edges: TrustEdge[];
  vouches: Vouch[];
  seeds: Seed[];
  /** Pelaku penipuan yang sudah dikonfirmasi manusia. */
  slashed: Address[];
  nowMs: number;
};

export type Tier = 0 | 1 | 2 | 3;

export type TrustEvidence = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TrustResult = {
  address: Address;
  /** Skor akhir setelah seluruh pipeline §4.6. */
  score: number;
  /** score / skor tertinggi di graf, 0..1. */
  ratio: number;
  tier: Tier;
  evidence: TrustEvidence;
  operatorCluster: string | null;
};

/** Umur koneksi (ms) -> pengali bobot. */
export type DecayFn = (ageMs: number) => number;
```

- [ ] **Step 3: Tulis test yang gagal**

`packages/trust/test/graph.test.ts`:
```ts
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
```

- [ ] **Step 4: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: FAIL — `Cannot find module '../src/index'`

- [ ] **Step 5: Implementasi**

`packages/trust/src/graph.ts`:
```ts
import type { Address } from "viem";
import type { DecayFn, TrustGraph } from "./types";

/** Bobot edge ke arah orang yang dijamin (spec fase §5). */
export const VOUCH_EDGE_WEIGHT = 3;

/** from -> to -> bobot. Kunci selalu alamat huruf kecil. */
export type DirectedGraph = Map<string, Map<string, number>>;

const lower = (a: Address): string => a.toLowerCase();

export function vouchKey(from: Address, to: Address): string {
  return `${lower(from)}->${lower(to)}`;
}

export const noDecay: DecayFn = () => 1;

/** Peluruhan eksponensial. Dibangun & diuji, tapi tidak dipakai di Fase 2. */
export function halfLifeDecay(halfLifeMs: number): DecayFn {
  return (ageMs) => Math.pow(2, -Math.max(0, ageMs) / halfLifeMs);
}

/** Terurut supaya seluruh perhitungan deterministik (Global Constraints). */
export function allAddresses(g: TrustGraph): string[] {
  const set = new Set<string>();
  for (const e of g.edges) {
    set.add(lower(e.a));
    set.add(lower(e.b));
  }
  for (const s of g.seeds) set.add(lower(s.address));
  return [...set].sort();
}

function put(graph: DirectedGraph, from: string, to: string, weight: number): void {
  let row = graph.get(from);
  if (!row) {
    row = new Map();
    graph.set(from, row);
  }
  row.set(to, weight);
}

/**
 * Merakit graf berarah dari pertemuan fisik (dua arah) + vouch (satu arah).
 *
 * Dua pencabutan penting terjadi di sini, bukan di pagerank:
 * - edge `blocked` dibuang sepenuhnya (Fase 4)
 * - alamat ter-slash kehilangan seluruh aliran KELUAR, sehingga tidak lagi
 *   menghantar kepercayaan ke siapa pun. Aliran MASUK dibiarkan karena
 *   pertemuannya memang terjadi — itu fakta, dan fakta tidak dihapus.
 */
export function buildDirectedGraph(
  g: TrustGraph,
  opts: { decay?: DecayFn } = {},
): DirectedGraph {
  const decay = opts.decay ?? noDecay;
  const slashed = new Set(g.slashed.map(lower));

  const vouched = new Set<string>();
  const connected = new Set<string>();
  for (const e of g.edges) {
    if (e.blocked) continue;
    connected.add(`${lower(e.a)}->${lower(e.b)}`);
    connected.add(`${lower(e.b)}->${lower(e.a)}`);
  }
  // Vouch tanpa koneksi fisik tidak berarti apa-apa. Kontrak menolaknya juga,
  // tapi data lama atau bug relayer tidak boleh bisa menyelundupkannya.
  for (const v of g.vouches) {
    const k = vouchKey(v.from, v.to);
    if (connected.has(k)) vouched.add(k);
  }

  const graph: DirectedGraph = new Map();
  for (const e of g.edges) {
    if (e.blocked) continue;
    const a = lower(e.a);
    const b = lower(e.b);
    const base = decay(Math.max(0, g.nowMs - e.atMs));

    if (!slashed.has(a)) {
      put(graph, a, b, base * (vouched.has(`${a}->${b}`) ? VOUCH_EDGE_WEIGHT : 1));
    }
    if (!slashed.has(b)) {
      put(graph, b, a, base * (vouched.has(`${b}->${a}`) ? VOUCH_EDGE_WEIGHT : 1));
    }
  }
  return graph;
}
```

`packages/trust/src/index.ts`:
```ts
export * from "./types";
export * from "./graph";
```

- [ ] **Step 6: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: PASS — 11 test

- [ ] **Step 7: Typecheck**

Jalankan: `pnpm --filter @nearly/trust typecheck`
Diharapkan: keluar tanpa error

- [ ] **Step 8: Commit**

```bash
git add packages/trust pnpm-lock.yaml
git commit -m "feat: paket trust — tipe dan perakitan graf berarah"
```

---

## Task 2: `pagerank.ts` — gerbang anti-sybil

**Files:**
- Create: `packages/trust/src/pagerank.ts`
- Modify: `packages/trust/src/index.ts`
- Test: `packages/trust/test/pagerank.test.ts`

**Interfaces:**
- Consumes: `DirectedGraph`, `Seed`, `allAddresses`, `buildDirectedGraph` (Task 1)
- Produces:
  - `DAMPING: 0.85`
  - `personalizedPageRank(graph: DirectedGraph, seeds: Seed[], nodes: string[], opts?: { damping?: number; tolerance?: number; maxIterations?: number }): Map<string, number>`

- [ ] **Step 1: Tulis test yang gagal**

`packages/trust/test/pagerank.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test pagerank`
Diharapkan: FAIL — `personalizedPageRank is not a function`

- [ ] **Step 3: Implementasi**

`packages/trust/src/pagerank.ts`:
```ts
import type { Seed } from "./types";
import type { DirectedGraph } from "./graph";

/** Nilai standar PageRank. */
export const DAMPING = 0.85;

/**
 * Personalized PageRank.
 *
 * SATU DETAIL YANG MEMBUAT SELURUH KLAIM ANTI-SYBIL BENAR: vektor teleport
 * diisi SEED, bukan disebar rata ke semua node. Di PageRank biasa setiap node
 * mendapat jatah awal, dan gumpalan bot yang padat justru MENUMPUK peringkat.
 * Dengan teleport hanya ke seed, kepercayaan cuma bisa masuk lewat seed, jadi
 * gumpalan tanpa jalur ke seed konvergen ke ~0.
 *
 * Kalau seseorang mengganti baris teleport ini jadi 1/N, produknya kehilangan
 * premisnya dan test pertama di pagerank.test.ts akan gagal.
 */
export function personalizedPageRank(
  graph: DirectedGraph,
  seeds: Seed[],
  nodes: string[],
  opts: { damping?: number; tolerance?: number; maxIterations?: number } = {},
): Map<string, number> {
  const damping = opts.damping ?? DAMPING;
  const tolerance = opts.tolerance ?? 1e-9;
  const maxIterations = opts.maxIterations ?? 100;

  const scores = new Map<string, number>();
  for (const n of nodes) scores.set(n, 0);

  // Vektor teleport dari seed, dinormalisasi ke total 1.
  const teleport = new Map<string, number>();
  const seedTotal = seeds.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (seedTotal <= 0) return scores; // tanpa seed, tidak ada kepercayaan sama sekali
  for (const s of seeds) {
    const key = s.address.toLowerCase();
    if (!scores.has(key)) continue;
    teleport.set(key, (teleport.get(key) ?? 0) + Math.max(0, s.weight) / seedTotal);
  }

  // Bobot keluar per node, dihitung sekali di luar loop iterasi.
  const outWeight = new Map<string, number>();
  for (const [from, row] of graph) {
    let total = 0;
    for (const w of row.values()) total += w;
    outWeight.set(from, total);
  }

  let current = new Map(teleport);
  for (const n of nodes) if (!current.has(n)) current.set(n, 0);

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Map<string, number>();
    for (const n of nodes) next.set(n, 0);

    // Massa dari node buntu (tidak punya edge keluar, mis. akun ter-slash)
    // dikembalikan ke seed, bukan disebar rata — menyebarnya rata akan
    // memberi hadiah gratis ke gumpalan sybil.
    let dangling = 0;
    for (const n of nodes) {
      const mass = current.get(n) ?? 0;
      const out = outWeight.get(n) ?? 0;
      if (out <= 0) {
        dangling += mass;
        continue;
      }
      for (const [to, w] of graph.get(n)!) {
        next.set(to, (next.get(to) ?? 0) + (mass * w) / out);
      }
    }

    let delta = 0;
    for (const n of nodes) {
      const t = teleport.get(n) ?? 0;
      const value = damping * ((next.get(n) ?? 0) + dangling * t) + (1 - damping) * t;
      delta += Math.abs(value - (current.get(n) ?? 0));
      next.set(n, value);
    }

    current = next;
    if (delta < tolerance) break;
  }

  return current;
}
```

Tambahkan ke `packages/trust/src/index.ts`:
```ts
export * from "./pagerank";
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: PASS — 19 test

- [ ] **Step 5: Commit**

```bash
git add packages/trust
git commit -m "feat: personalized PageRank — gumpalan sybil konvergen ke nol"
```

---

## Task 3: `diversity.ts`

**Files:**
- Create: `packages/trust/src/diversity.ts`
- Modify: `packages/trust/src/index.ts`
- Test: `packages/trust/test/diversity.test.ts`

**Interfaces:**
- Consumes: `TrustEdge` (Task 1)
- Produces:
  - `DIVERSITY_FLOOR: 0.15`
  - `TIME_BUCKET_MS: 86_400_000`
  - `REGION_PREFIX: 4`
  - `normalizedEntropy(counts: number[]): number` — 0..1
  - `neighborsOf(edges: TrustEdge[]): Map<string, Set<string>>`
  - `clusteringCoefficient(address: string, neighbors: Map<string, Set<string>>): number`
  - `diversityMultiplier(address: string, edges: TrustEdge[], neighbors: Map<string, Set<string>>): number` — `DIVERSITY_FLOOR..1`
  - `regionOf(occasionId: string): string`

`occasionId` di Fase 2 berbentuk `"<geohash7>:<indeks jendela 3 jam>"`, jadi wilayah diambil dari 4 huruf pertamanya (~40 km). Di Fase 3 bentuknya berubah jadi id event dan `regionOf` ikut disesuaikan di sana — bukan sekarang.

- [ ] **Step 1: Tulis test yang gagal**

`packages/trust/test/diversity.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  clusteringCoefficient, DIVERSITY_FLOOR, diversityMultiplier,
  neighborsOf, normalizedEntropy, regionOf,
} from "../src/index";
import type { TrustEdge } from "../src/index";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;
const HUB = addr(1);

function edge(a: Address, b: Address, occasionId: string, atMs: number): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

describe("normalizedEntropy", () => {
  it("semua di satu ember memberi 0", () => {
    expect(normalizedEntropy([50])).toBe(0);
  });

  it("tiap koneksi di ember sendiri memberi 1", () => {
    expect(normalizedEntropy(Array.from({ length: 50 }, () => 1))).toBeCloseTo(1, 6);
  });

  it("GERBANG: makin banyak ember makin tinggi, pada jumlah koneksi yang sama", () => {
    // Ini yang membedakan penyebut ln(TOTAL) dari ln(jumlah ember).
    // Dengan ln(jumlah ember), ketiganya bernilai 1.0 dan sebaran ke 2 occasion
    // dinilai sama dengan sebaran ke 10 — membatalkan aturan inti spec §8
    // ("50 orang di 1 event jauh di bawah 50 orang di 10 event, 5 kota").
    // JANGAN mengganti penyebutnya menjadi ln(counts.length).
    const dua = normalizedEntropy([25, 25]);
    const lima = normalizedEntropy([10, 10, 10, 10, 10]);
    const sepuluh = normalizedEntropy([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    expect(dua).toBeLessThan(lima);
    expect(lima).toBeLessThan(sepuluh);
  });

  it("mereproduksi angka yang ditulis spec §4.3: 50 koneksi di 10 occasion", () => {
    expect(normalizedEntropy([5, 5, 5, 5, 5, 5, 5, 5, 5, 5])).toBeCloseTo(0.5886, 4);
  });

  it("tersebar timpang berada di antaranya", () => {
    const h = normalizedEntropy([47, 1, 1, 1]);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(0.5);
  });

  it("kosong memberi 0, bukan NaN", () => {
    expect(normalizedEntropy([])).toBe(0);
  });
});

describe("clusteringCoefficient", () => {
  it("segitiga tertutup memberi 1", () => {
    const n = neighborsOf([
      edge(addr(1), addr(2), "o", NOW),
      edge(addr(2), addr(3), "o", NOW),
      edge(addr(1), addr(3), "o", NOW),
    ]);
    expect(clusteringCoefficient(addr(1).toLowerCase(), n)).toBe(1);
  });

  it("bintang tanpa segitiga memberi 0", () => {
    const n = neighborsOf([
      edge(HUB, addr(2), "o", NOW),
      edge(HUB, addr(3), "o", NOW),
      edge(HUB, addr(4), "o", NOW),
    ]);
    expect(clusteringCoefficient(HUB.toLowerCase(), n)).toBe(0);
  });

  it("kurang dari dua tetangga memberi 0", () => {
    const n = neighborsOf([edge(HUB, addr(2), "o", NOW)]);
    expect(clusteringCoefficient(HUB.toLowerCase(), n)).toBe(0);
  });
});

describe("diversityMultiplier", () => {
  it("GERBANG: 50 koneksi di 1 occasion jauh di bawah 50 koneksi di 10 occasion", () => {
    const sempit: TrustEdge[] = [];
    const luas: TrustEdge[] = [];
    for (let i = 0; i < 50; i++) {
      sempit.push(edge(HUB, addr(100 + i), "satu-ruangan", NOW));
      luas.push(edge(HUB, addr(100 + i), `acara-${i % 10}`, NOW - (i % 10) * 30 * DAY));
    }
    const a = diversityMultiplier(HUB.toLowerCase(), sempit, neighborsOf(sempit));
    const b = diversityMultiplier(HUB.toLowerCase(), luas, neighborsOf(luas));
    expect(a).toBe(DIVERSITY_FLOOR);
    expect(b).toBeGreaterThan(a * 2);
  });

  it("tidak pernah turun di bawah lantai, supaya pengguna baru tidak difitnah", () => {
    const satu = [edge(HUB, addr(2), "o1", NOW)];
    expect(diversityMultiplier(HUB.toLowerCase(), satu, neighborsOf(satu))).toBe(DIVERSITY_FLOOR);
  });

  it("tidak pernah melebihi 1", () => {
    const edges: TrustEdge[] = [];
    for (let i = 0; i < 20; i++) edges.push(edge(HUB, addr(200 + i), `o-${i}`, NOW - i * 40 * DAY));
    expect(diversityMultiplier(HUB.toLowerCase(), edges, neighborsOf(edges))).toBeLessThanOrEqual(1);
  });

  it("lingkaran yang semuanya saling kenal dihukum clustering", () => {
    const rapat: TrustEdge[] = [];
    const orang = [1, 2, 3, 4, 5, 6].map(addr);
    for (let i = 0; i < orang.length; i++) {
      for (let j = i + 1; j < orang.length; j++) {
        rapat.push(edge(orang[i]!, orang[j]!, `o-${(i + j) % 5}`, NOW - ((i + j) % 5) * 30 * DAY));
      }
    }
    const longgar: TrustEdge[] = [];
    for (let i = 0; i < 5; i++) longgar.push(edge(HUB, addr(300 + i), `o-${i}`, NOW - i * 30 * DAY));

    const rapatSkor = diversityMultiplier(orang[0]!.toLowerCase(), rapat, neighborsOf(rapat));
    const longgarSkor = diversityMultiplier(HUB.toLowerCase(), longgar, neighborsOf(longgar));
    expect(rapatSkor).toBeLessThan(longgarSkor);
  });
});

describe("regionOf", () => {
  it("mengambil 4 huruf pertama sel geohash", () => {
    expect(regionOf("qqguv1r:5")).toBe("qqgu");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test diversity`
Diharapkan: FAIL — `normalizedEntropy is not a function`

- [ ] **Step 3: Implementasi**

`packages/trust/src/diversity.ts`:
```ts
import type { TrustEdge } from "./types";

/**
 * Lantai pengali diversitas.
 *
 * Tanpa lantai ini, pengguna baru yang jujur — satu koneksi, satu tempat —
 * mendapat entropi nol dan skor nol, PERSIS seperti bot. Dia memang harus
 * rendah, tapi tidak boleh difitnah.
 */
export const DIVERSITY_FLOOR = 0.15;

export const TIME_BUCKET_MS = 86_400_000;

/** ~40 km. Kita tidak tahu nama kotanya, jadi ini disebut "wilayah". */
export const REGION_PREFIX = 4;

export function regionOf(occasionId: string): string {
  return occasionId.split(":")[0]!.slice(0, REGION_PREFIX);
}

/**
 * Entropi Shannon dinormalisasi oleh ln(TOTAL PENGAMATAN), bukan ln(jumlah ember).
 *
 * Bedanya menentukan arti seluruh faktor diversitas. Dengan ln(jumlah ember),
 * yang terukur adalah KERATAAN saja: 50 koneksi merata di 2 occasion bernilai
 * 1.0, sama persis dengan 50 koneksi merata di 10 occasion. Dengan ln(total),
 * yang terukur adalah KELUASAN: 2 occasion memberi 0.177, 10 occasion memberi
 * 0.589, dan nilai 1.0 hanya tercapai kalau tiap koneksi terjadi di occasion
 * yang berbeda.
 *
 * Aturan inti spec §8 menuntut yang kedua. Angka 0.589 itu pun tertulis di
 * spec fase §4.3 dan dikunci sebuah test.
 */
export function normalizedEntropy(counts: number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total <= 1 || counts.length <= 1) return 0;

  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return Math.min(1, h / Math.log(total));
}

export function neighborsOf(edges: TrustEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (x: string, y: string) => {
    let s = map.get(x);
    if (!s) {
      s = new Set();
      map.set(x, s);
    }
    s.add(y);
  };
  for (const e of edges) {
    if (e.blocked) continue;
    add(e.a.toLowerCase(), e.b.toLowerCase());
    add(e.b.toLowerCase(), e.a.toLowerCase());
  }
  return map;
}

/** Porsi pasangan tetangga yang juga saling terkoneksi. */
export function clusteringCoefficient(
  address: string,
  neighbors: Map<string, Set<string>>,
): number {
  const own = neighbors.get(address);
  if (!own || own.size < 2) return 0;

  const list = [...own].sort();
  let links = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (neighbors.get(list[i]!)?.has(list[j]!)) links++;
    }
  }
  const possible = (list.length * (list.length - 1)) / 2;
  return links / possible;
}

/**
 * D = H(occasion) x H(waktu) x (1 - clustering), lalu diangkat dari lantai.
 *
 * Ini sifat SATU ORANG (seberapa tersebar pertemuannya), bukan sifat satu
 * hubungan — karena itu diterapkan setelah PageRank, bukan sebagai bobot edge
 * (spec fase §4.6).
 */
export function diversityMultiplier(
  address: string,
  edges: TrustEdge[],
  neighbors: Map<string, Set<string>>,
): number {
  const mine = edges.filter(
    (e) => !e.blocked && (e.a.toLowerCase() === address || e.b.toLowerCase() === address),
  );
  if (mine.length === 0) return DIVERSITY_FLOOR;

  const byOccasion = new Map<string, number>();
  const byTime = new Map<number, number>();
  for (const e of mine) {
    byOccasion.set(e.occasionId, (byOccasion.get(e.occasionId) ?? 0) + 1);
    const bucket = Math.floor(e.atMs / TIME_BUCKET_MS);
    byTime.set(bucket, (byTime.get(bucket) ?? 0) + 1);
  }

  const d =
    normalizedEntropy([...byOccasion.values()]) *
    normalizedEntropy([...byTime.values()]) *
    (1 - clusteringCoefficient(address, neighbors));

  return DIVERSITY_FLOOR + (1 - DIVERSITY_FLOOR) * Math.max(0, Math.min(1, d));
}
```

Tambahkan ke `packages/trust/src/index.ts`:
```ts
export * from "./diversity";
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: PASS — 35 test (21 dari Task 1-2 + 14 baru)

- [ ] **Step 5: Commit**

```bash
git add packages/trust
git commit -m "feat: faktor diversitas — entropi occasion, waktu, dan clustering"
```

---

## Task 4: `fingerprint.ts` — deteksi satu operator banyak akun

**Files:**
- Create: `packages/trust/src/fingerprint.ts`
- Modify: `packages/trust/src/index.ts`
- Test: `packages/trust/test/fingerprint.test.ts`

**Interfaces:**
- Consumes: `TrustEdge` (Task 1). Sengaja TIDAK memakai `neighborsOf`: sidik jari butuh WAKTU tiap pertemuan, sedangkan `neighborsOf` membuang informasi itu
- Produces:
  - `FINGERPRINT_DEFAULTS: { minJaccard: 0.8; minTemporal: 0.6; minConnections: 5; windowMs: 600_000 }`
  - `type OperatorCluster = { id: string; members: string[] }`
  - `jaccard(a: Set<string>, b: Set<string>): number`
  - `detectOperators(edges: TrustEdge[], opts?: Partial<typeof FINGERPRINT_DEFAULTS>): OperatorCluster[]`

`id` klaster adalah alamat terkecil di dalamnya, supaya deterministik dan bisa disimpan ke kolom `operator_cluster` tanpa tabel tambahan.

- [ ] **Step 1: Tulis test yang gagal**

`packages/trust/test/fingerprint.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { detectOperators, jaccard } from "../src/index";
import type { TrustEdge } from "../src/index";

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;

function edge(a: Address, b: Address, occasionId: string, atMs: number): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

describe("jaccard", () => {
  it("himpunan identik memberi 1", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("tanpa irisan memberi 0", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  it("dua himpunan kosong memberi 0, bukan NaN", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("detectOperators", () => {
  it("GERBANG: 5 akun dengan pola ko-lokasi identik tergabung jadi satu operator", () => {
    const edges: TrustEdge[] = [];
    const palsu = [901, 902, 903, 904, 905].map(addr);
    const korban = [1, 2, 3, 4, 5, 6].map(addr);

    // Kelima akun menyalami orang yang sama, di occasion yang sama, dalam menit yang sama.
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => {
        edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000));
      });
    });

    // Para korban juga punya kenalannya sendiri-sendiri, seperti orang sungguhan
    // di ruangan sungguhan. Tanpa baris-baris ini himpunan lawan bicara mereka
    // identik satu sama lain dan mereka ikut tergabung — lihat test berikutnya,
    // yang mengunci batas itu dengan sengaja.
    korban.forEach((k, ki) => {
      for (let j = 0; j < 3; j++) {
        edges.push(edge(k, addr(500 + ki * 10 + j), "acara-a", NOW + (ki * 3 + j) * MIN * 11));
      }
    });

    const clusters = detectOperators(edges);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.members.sort()).toEqual(palsu.map((p) => p.toLowerCase()).sort());
  });

  it("BATAS YANG DIAKUI: riwayat pertemuan yang identik dan bersamaan tidak bisa dibedakan dari satu operator", () => {
    // Kalau enam orang jujur HANYA pernah menyalami himpunan orang yang sama,
    // pada menit yang sama, tidak ada satu pun informasi di graf yang
    // membedakan mereka dari lima akun milik satu orang. Detektor akan
    // menggabungkan mereka, dan skor mereka dibagi rata.
    //
    // Ini batas nyata, bukan bug, dan tercatat di spec fase §12. Test ini
    // menguncinya supaya perilakunya tidak berubah diam-diam — dan supaya
    // siapa pun yang menyetel ambangnya nanti tahu apa yang dipertaruhkan.
    const edges: TrustEdge[] = [];
    const palsu = [901, 902, 903, 904, 905].map(addr);
    const korban = [1, 2, 3, 4, 5, 6].map(addr);
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000)));
    });

    const clusters = detectOperators(edges);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.members.length).sort()).toEqual([5, 6]);
  });

  it("orang jujur yang menghadiri acara sama TIDAK digabung", () => {
    const edges: TrustEdge[] = [];
    // Dua orang di acara yang sama, tapi menyalami orang yang sebagian besar berbeda.
    for (let i = 0; i < 8; i++) edges.push(edge(addr(11), addr(100 + i), "acara-a", NOW + i * MIN));
    for (let i = 0; i < 8; i++) edges.push(edge(addr(12), addr(200 + i), "acara-a", NOW + i * MIN));
    expect(detectOperators(edges)).toEqual([]);
  });

  it("koneksi identik tapi terpisah berhari-hari TIDAK digabung", () => {
    const edges: TrustEdge[] = [];
    const korban = [1, 2, 3, 4, 5, 6].map(addr);
    korban.forEach((k, i) => {
      edges.push(edge(addr(901), k, `acara-${i}`, NOW + i * MIN));
      edges.push(edge(addr(902), k, `acara-${i}`, NOW + i * MIN + 5 * 86_400_000));
    });
    expect(detectOperators(edges)).toEqual([]);
  });

  it("akun dengan koneksi di bawah ambang minimum diabaikan", () => {
    const edges: TrustEdge[] = [];
    [1, 2].forEach((k, i) => {
      edges.push(edge(addr(901), addr(k), "acara-a", NOW + i * MIN));
      edges.push(edge(addr(902), addr(k), "acara-a", NOW + i * MIN));
    });
    expect(detectOperators(edges)).toEqual([]);
  });

  it("id klaster adalah alamat terkecil, jadi deterministik", () => {
    const edges: TrustEdge[] = [];
    const palsu = [905, 901, 903].map(addr);
    const korban = [1, 2, 3, 4, 5, 6].map(addr);
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000)));
    });
    expect(detectOperators(edges)[0]!.id).toBe(addr(901).toLowerCase());
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test fingerprint`
Diharapkan: FAIL — `detectOperators is not a function`

- [ ] **Step 3: Implementasi**

`packages/trust/src/fingerprint.ts`:
```ts
import type { TrustEdge } from "./types";

/**
 * Ambang awal yang jujur, BELUM tervalidasi lapangan (spec fase §12 butir 3).
 * Sengaja jadi parameter supaya bisa disetel setelah data nyata masuk, bukan
 * angka yang ditanam di dalam badan fungsi.
 */
export const FINGERPRINT_DEFAULTS = {
  minJaccard: 0.8,
  minTemporal: 0.6,
  minConnections: 5,
  windowMs: 600_000,
} as const;

export type OperatorCluster = { id: string; members: string[] };

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

type Contact = { peer: string; atMs: number };

function contactsOf(edges: TrustEdge[]): Map<string, Contact[]> {
  const map = new Map<string, Contact[]>();
  const add = (owner: string, peer: string, atMs: number) => {
    const list = map.get(owner);
    if (list) list.push({ peer, atMs });
    else map.set(owner, [{ peer, atMs }]);
  };
  for (const e of edges) {
    if (e.blocked) continue;
    add(e.a.toLowerCase(), e.b.toLowerCase(), e.atMs);
    add(e.b.toLowerCase(), e.a.toLowerCase(), e.atMs);
  }
  return map;
}

/**
 * Mencari beberapa akun yang ternyata dipegang satu orang.
 *
 * Dua akun dianggap satu operator kalau himpunan lawan bicaranya hampir sama
 * (Jaccard) DAN pertemuan bersama itu terjadi nyaris bersamaan (korelasi
 * temporal). Syarat kedua yang membedakannya dari dua orang jujur yang kebetulan
 * bergaul di lingkaran yang sama — mereka bertemu orang yang sama, tapi tidak
 * dalam menit yang sama, berulang kali.
 *
 * Efeknya diterapkan di computeTrust: anggota satu klaster BERBAGI satu skor,
 * dibagi rata (spec induk §9.1 — akun ganda mengencerkan trust, bukan
 * melipatgandakannya).
 */
export function detectOperators(
  edges: TrustEdge[],
  opts: Partial<typeof FINGERPRINT_DEFAULTS> = {},
): OperatorCluster[] {
  const cfg = { ...FINGERPRINT_DEFAULTS, ...opts };
  const contacts = contactsOf(edges);

  const candidates = [...contacts.entries()]
    .filter(([, list]) => list.length >= cfg.minConnections)
    .map(([addr]) => addr)
    .sort();

  const peers = new Map<string, Set<string>>();
  const times = new Map<string, Map<string, number[]>>();
  for (const a of candidates) {
    const set = new Set<string>();
    const byPeer = new Map<string, number[]>();
    for (const c of contacts.get(a)!) {
      set.add(c.peer);
      const arr = byPeer.get(c.peer);
      if (arr) arr.push(c.atMs);
      else byPeer.set(c.peer, [c.atMs]);
    }
    peers.set(a, set);
    times.set(a, byPeer);
  }

  // Union-find sederhana; jumlah kandidatnya kecil, jadi O(n^2) sudah cukup.
  const parent = new Map<string, string>(candidates.map((a) => [a, a]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (x: string, y: string) => {
    const [rx, ry] = [find(x), find(y)];
    if (rx !== ry) parent.set(rx < ry ? ry : rx, rx < ry ? rx : ry);
  };

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      if (jaccard(peers.get(a)!, peers.get(b)!) < cfg.minJaccard) continue;

      const shared = [...peers.get(a)!].filter((p) => peers.get(b)!.has(p));
      if (shared.length === 0) continue;

      let nearCount = 0;
      for (const p of shared) {
        const ta = times.get(a)!.get(p)!;
        const tb = times.get(b)!.get(p)!;
        const near = ta.some((x) => tb.some((y) => Math.abs(x - y) <= cfg.windowMs));
        if (near) nearCount++;
      }
      if (nearCount / shared.length >= cfg.minTemporal) union(a, b);
    }
  }

  const groups = new Map<string, string[]>();
  for (const a of candidates) {
    const root = find(a);
    const list = groups.get(root);
    if (list) list.push(a);
    else groups.set(root, [a]);
  }

  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([id, members]) => ({ id, members: members.sort() }))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
}
```

Tambahkan ke `packages/trust/src/index.ts`:
```ts
export * from "./fingerprint";
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: PASS — 44 test (35 dari Task 1-3 + 9 baru)

- [ ] **Step 5: Commit**

```bash
git add packages/trust
git commit -m "feat: sidik jari ko-lokasi — beberapa akun satu operator terdeteksi"
```

---

## Task 5: `slashing.ts` — gerbang laporan (titik paling rawan)

Spec induk §12 menyebut file ini **titik paling rawan di seluruh sistem**: di sinilah brigading bisa masuk lagi kalau gerbangnya longgar. Test brigading di bawah lebih penting daripada implementasinya.

**Files:**
- Create: `packages/trust/src/slashing.ts`
- Modify: `packages/trust/src/index.ts`
- Test: `packages/trust/test/slashing.test.ts`

**Interfaces:**
- Consumes: `Vouch` (Task 1)
- Produces:
  - `MIN_REPORTERS: 3`
  - `MIN_REPORTER_RATIO: 0.15`
  - `VOUCHER_PENALTY: 0.7`
  - `type Report = { reporter: Address; subject: Address; atMs: number }`
  - `type GateContext = { ratioOf(a: string): number; areConnected(x: string, y: string): boolean; clusterOf(a: string): string | null }`
  - `type GateVerdict = { passes: boolean; independent: string[]; reason: "cukup" | "pelapor_kurang" | "trust_pelapor_rendah" | "pelapor_tidak_independen" }`
  - `reportGate(subject: Address, reports: Report[], ctx: GateContext): GateVerdict`
  - `voucherPenalties(slashed: Address[], vouches: Vouch[]): Map<string, number>`

- [ ] **Step 1: Tulis test yang gagal**

`packages/trust/test/slashing.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  MIN_REPORTERS, reportGate, VOUCHER_PENALTY, voucherPenalties,
} from "../src/index";
import type { GateContext, Report, Vouch } from "../src/index";

const NOW = 1_700_000_000_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;
const SUBJECT = addr(666);

function reports(who: Address[]): Report[] {
  return who.map((reporter) => ({ reporter, subject: SUBJECT, atMs: NOW }));
}

/** Semua pelapor tepercaya dan saling asing, kecuali yang disebut di `connected`. */
function ctx(over: Partial<GateContext> = {}): GateContext {
  return {
    ratioOf: () => 0.5,
    areConnected: () => false,
    clusterOf: () => null,
    ...over,
  };
}

describe("reportGate", () => {
  it("GERBANG: 20 pelapor yang saling terkoneksi TIDAK memicu apa pun", () => {
    const brigade = Array.from({ length: 20 }, (_, i) => addr(700 + i));
    const verdict = reportGate(SUBJECT, reports(brigade), ctx({ areConnected: () => true }));
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("pelapor_tidak_independen");
    expect(verdict.independent).toHaveLength(1);
  });

  it("GERBANG: 3 pelapor tepercaya yang saling asing memicu peninjauan", () => {
    const verdict = reportGate(SUBJECT, reports([addr(1), addr(2), addr(3)]), ctx());
    expect(verdict.passes).toBe(true);
    expect(verdict.reason).toBe("cukup");
  });

  it("dua pelapor saja belum cukup", () => {
    const verdict = reportGate(SUBJECT, reports([addr(1), addr(2)]), ctx());
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("pelapor_kurang");
  });

  it("pelapor ber-trust di bawah Terpercaya tidak dihitung", () => {
    const verdict = reportGate(
      SUBJECT,
      reports([addr(1), addr(2), addr(3)]),
      ctx({ ratioOf: (a) => (a === addr(1).toLowerCase() ? 0.5 : 0.01) }),
    );
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("trust_pelapor_rendah");
  });

  it("pelapor dalam satu klaster operator hanya terhitung satu suara", () => {
    const verdict = reportGate(
      SUBJECT,
      reports([addr(1), addr(2), addr(3)]),
      ctx({ clusterOf: () => "operator-x" }),
    );
    expect(verdict.passes).toBe(false);
    expect(verdict.independent).toHaveLength(1);
  });

  it("gerombolan berisi 3 orang luar tetap lolos lewat orang-orang luar itu", () => {
    const brigade = Array.from({ length: 10 }, (_, i) => addr(700 + i));
    const luar = [addr(1), addr(2), addr(3)];
    const brigadeSet = new Set(brigade.map((b) => b.toLowerCase()));
    const verdict = reportGate(
      SUBJECT,
      reports([...brigade, ...luar]),
      ctx({ areConnected: (x, y) => brigadeSet.has(x) && brigadeSet.has(y) }),
    );
    expect(verdict.passes).toBe(true);
    expect(verdict.independent).toHaveLength(1 + luar.length);
  });

  it("BATAS YANG DIAKUI: rantai kenalan bisa menyumbang tiga suara yang berpasangan asing", () => {
    // Lima akun membentuk rantai A-B-C-D-E: tiap orang hanya bersebelahan
    // dengan tetangganya. Gerbang meloloskan {A, C, E} — dan himpunan itu
    // MEMANG berpasangan tidak bersebelahan, persis yang diminta aturannya.
    //
    // Aturan yang lebih ketat ("semua pelapor harus dari komponen terhubung
    // yang berbeda") TIDAK boleh dipakai sebagai perbaikan: di graf sosial
    // nyata hampir semua orang berada di satu komponen raksasa, sehingga
    // gerbang tidak akan pernah lolos dan slashing jadi mustahil selamanya.
    //
    // Yang menahan celah ini bukan gerbang sendirian, melainkan tiga lapis:
    // pelapor harus mencapai tier Terpercaya, klaster operator ikut diperiksa,
    // dan tidak ada slash yang terjadi tanpa konfirmasi manusia.
    // Tercatat di spec fase §12.
    const rantai = [addr(1), addr(2), addr(3), addr(4), addr(5)];
    const bersebelahan = new Set(["1|2", "2|3", "3|4", "4|5"]);
    const idx = (a: string) => String(rantai.findIndex((r) => r.toLowerCase() === a) + 1);

    const verdict = reportGate(
      SUBJECT,
      reports(rantai),
      ctx({
        areConnected: (x, y) =>
          bersebelahan.has(`${idx(x)}|${idx(y)}`) || bersebelahan.has(`${idx(y)}|${idx(x)}`),
      }),
    );
    expect(verdict.passes).toBe(true);
    expect(verdict.independent).toHaveLength(3);
  });

  it("laporan ganda dari orang yang sama hanya dihitung sekali", () => {
    const dobel = [...reports([addr(1)]), ...reports([addr(1)]), ...reports([addr(1)])];
    const verdict = reportGate(SUBJECT, dobel, ctx());
    expect(verdict.passes).toBe(false);
    expect(verdict.independent).toHaveLength(1);
  });

  it("laporan untuk subjek lain diabaikan", () => {
    const lain: Report[] = [{ reporter: addr(9), subject: addr(5), atMs: NOW }];
    const verdict = reportGate(SUBJECT, [...reports([addr(1), addr(2)]), ...lain], ctx());
    expect(verdict.independent).toHaveLength(2);
  });

  it("MIN_REPORTERS memang 3", () => {
    expect(MIN_REPORTERS).toBe(3);
  });
});

describe("voucherPenalties", () => {
  it("penjamin satu pelaku terkonfirmasi dikali 0.7", () => {
    const vouches: Vouch[] = [{ from: addr(1), to: SUBJECT, atMs: NOW }];
    expect(voucherPenalties([SUBJECT], vouches).get(addr(1).toLowerCase())).toBeCloseTo(VOUCHER_PENALTY, 9);
  });

  it("menjamin dua pelaku menumpuk jadi 0.7 x 0.7", () => {
    const s2 = addr(667);
    const vouches: Vouch[] = [
      { from: addr(1), to: SUBJECT, atMs: NOW },
      { from: addr(1), to: s2, atMs: NOW },
    ];
    expect(voucherPenalties([SUBJECT, s2], vouches).get(addr(1).toLowerCase()))
      .toBeCloseTo(VOUCHER_PENALTY * VOUCHER_PENALTY, 9);
  });

  it("BERHENTI SATU LOMPATAN: penjamin dari penjamin tidak kena", () => {
    const vouches: Vouch[] = [
      { from: addr(1), to: SUBJECT, atMs: NOW },  // menjamin pelaku
      { from: addr(2), to: addr(1), atMs: NOW },  // menjamin si penjamin
    ];
    const p = voucherPenalties([SUBJECT], vouches);
    expect(p.get(addr(1).toLowerCase())).toBeCloseTo(VOUCHER_PENALTY, 9);
    expect(p.has(addr(2).toLowerCase())).toBe(false);
  });

  it("orang yang tidak menjamin siapa pun tidak kena apa-apa", () => {
    expect(voucherPenalties([SUBJECT], []).size).toBe(0);
  });

  it("vouch KE arah lain tidak menghukum: dijamin pelaku bukan menjamin pelaku", () => {
    const vouches: Vouch[] = [{ from: SUBJECT, to: addr(1), atMs: NOW }];
    expect(voucherPenalties([SUBJECT], vouches).size).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test slashing`
Diharapkan: FAIL — `reportGate is not a function`

- [ ] **Step 3: Implementasi**

`packages/trust/src/slashing.ts`:
```ts
import type { Address } from "viem";
import type { Vouch } from "./types";

export const MIN_REPORTERS = 3;
/** Ambang tier Terpercaya (spec fase §4.5). */
export const MIN_REPORTER_RATIO = 0.15;
export const VOUCHER_PENALTY = 0.7;

export type Report = { reporter: Address; subject: Address; atMs: number };

export type GateContext = {
  ratioOf(address: string): number;
  areConnected(x: string, y: string): boolean;
  clusterOf(address: string): string | null;
};

export type GateVerdict = {
  passes: boolean;
  /** Wakil dari tiap kelompok pelapor yang saling terhubung. */
  independent: string[];
  reason: "cukup" | "pelapor_kurang" | "trust_pelapor_rendah" | "pelapor_tidak_independen";
};

/**
 * Gerbang laporan. Lolos gerbang BUKAN berarti di-slash — ia hanya membuat
 * kasusnya layak ditinjau manusia (spec fase §6).
 *
 * Yang mematikan brigading ada di langkah "independen": gerombolan yang saling
 * kenal secara definisi saling terkoneksi, jadi seluruh gerombolan hanya
 * terhitung SATU suara berapa pun jumlah orangnya. Untuk lolos dibutuhkan tiga
 * orang tepercaya yang saling asing — pola yang mahal dipalsukan, karena
 * penyerang harus memiliki tiga identitas tepercaya yang tidak saling mengenal.
 *
 * JANGAN melonggarkan syarat ini tanpa mengubah test brigading lebih dulu.
 *
 * Dan JANGAN "memperketatnya" menjadi pemeriksaan komponen terhubung. Yang
 * ditegakkan di sini adalah ketidakbersebelahan BERPASANGAN, dan itu memang
 * aturannya. Rantai kenalan A-B-C-D-E tetap bisa menyumbang {A, C, E} — sebuah
 * batas yang diakui dan dikunci sebuah test. Mengganti aturannya menjadi "tiap
 * pelapor dari komponen terhubung yang berbeda" akan membuat gerbang tidak
 * pernah lolos sama sekali, karena di graf sosial nyata hampir semua orang
 * berada di satu komponen raksasa.
 */
export function reportGate(
  subject: Address,
  reports: Report[],
  ctx: GateContext,
): GateVerdict {
  const target = subject.toLowerCase();

  const unique = [
    ...new Set(
      reports
        .filter((r) => r.subject.toLowerCase() === target)
        .map((r) => r.reporter.toLowerCase()),
    ),
  ].sort();

  const trusted = unique.filter((r) => ctx.ratioOf(r) >= MIN_REPORTER_RATIO);

  // Satu wakil per kelompok yang saling terhubung atau satu klaster operator.
  const independent: string[] = [];
  for (const r of trusted) {
    const terkait = independent.some(
      (kept) =>
        ctx.areConnected(kept, r) ||
        (ctx.clusterOf(kept) !== null && ctx.clusterOf(kept) === ctx.clusterOf(r)),
    );
    if (!terkait) independent.push(r);
  }

  if (independent.length >= MIN_REPORTERS) return { passes: true, independent, reason: "cukup" };
  if (unique.length < MIN_REPORTERS) return { passes: false, independent, reason: "pelapor_kurang" };
  if (trusted.length < MIN_REPORTERS) {
    return { passes: false, independent, reason: "trust_pelapor_rendah" };
  }
  return { passes: false, independent, reason: "pelapor_tidak_independen" };
}

/**
 * Penalti untuk para penjamin pelaku terkonfirmasi: 0.7 pangkat jumlah pelaku
 * yang dia jamin.
 *
 * BERHENTI DI SATU LOMPATAN, dengan sengaja. Tanpa batas itu satu penipu bisa
 * menyeret separuh graf — dan penjamin-dari-penjamin tidak pernah menjamin
 * siapa pun secara langsung.
 */
export function voucherPenalties(slashed: Address[], vouches: Vouch[]): Map<string, number> {
  const guilty = new Set(slashed.map((a) => a.toLowerCase()));
  const counts = new Map<string, number>();

  for (const v of vouches) {
    if (!guilty.has(v.to.toLowerCase())) continue;
    const from = v.from.toLowerCase();
    counts.set(from, (counts.get(from) ?? 0) + 1);
  }

  const penalties = new Map<string, number>();
  for (const [addr, n] of counts) penalties.set(addr, Math.pow(VOUCHER_PENALTY, n));
  return penalties;
}
```

Tambahkan ke `packages/trust/src/index.ts`:
```ts
export * from "./slashing";
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test`
Diharapkan: PASS — 59 test (44 dari Task 1-4 + 15 baru)

- [ ] **Step 5: Commit**

```bash
git add packages/trust
git commit -m "feat: gerbang laporan anti-brigading + penalti penjamin"
```

---

## Task 6: `tier.ts` + `computeTrust()` — pipeline utuh

**Files:**
- Create: `packages/trust/src/tier.ts`, `packages/trust/src/compute.ts`
- Modify: `packages/trust/src/index.ts`
- Test: `packages/trust/test/tier.test.ts`, `packages/trust/test/compute.test.ts`

**Interfaces:**
- Consumes: semua dari Task 1–5
- Produces:
  - `TIER_THRESHOLDS: readonly [0.02, 0.15, 0.45]`
  - `TIER_LABELS: readonly ["Baru", "Dikenal", "Terpercaya", "Inti"]`
  - `tierOf(ratio: number): Tier`
  - `type TrustOptions = { decay?: DecayFn; fingerprint?: Partial<typeof FINGERPRINT_DEFAULTS>; pagerank?: { damping?: number; tolerance?: number; maxIterations?: number } }`
  - `computeTrust(graph: TrustGraph, opts?: TrustOptions): TrustResult[]` — terurut menurun berdasarkan skor

- [ ] **Step 1: Tulis test tier yang gagal**

`packages/trust/test/tier.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test tier`
Diharapkan: FAIL — `tierOf is not a function`

- [ ] **Step 3: Implementasi tier**

`packages/trust/src/tier.ts`:
```ts
import type { Tier } from "./types";

/**
 * Ambang atas RASIO terhadap skor tertinggi di graf, bukan atas skor mentah.
 *
 * Skor PageRank bersifat relatif — totalnya selalu 1. Ambang absolut pada skor
 * mentah akan menurunkan tier semua peserta serentak begitu populasi bertambah,
 * padahal tidak ada yang berubah pada mereka. Lihat test "populasi naik" di
 * compute.test.ts, yang mengunci perilaku ini.
 */
export const TIER_THRESHOLDS = [0.02, 0.15, 0.45] as const;
export const TIER_LABELS = ["Baru", "Dikenal", "Terpercaya", "Inti"] as const;

export function tierOf(ratio: number): Tier {
  if (!Number.isFinite(ratio) || ratio < TIER_THRESHOLDS[0]) return 0;
  if (ratio < TIER_THRESHOLDS[1]) return 1;
  if (ratio < TIER_THRESHOLDS[2]) return 2;
  return 3;
}
```

- [ ] **Step 4: Tulis test pipeline yang gagal**

`packages/trust/test/compute.test.ts`:
```ts
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
```

- [ ] **Step 5: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/trust test compute`
Diharapkan: FAIL — `computeTrust is not a function`

- [ ] **Step 6: Implementasi pipeline**

`packages/trust/src/compute.ts`:
```ts
import type { Address } from "viem";
import type { DecayFn, TrustEvidence, TrustGraph, TrustResult } from "./types";
import { allAddresses, buildDirectedGraph } from "./graph";
import { personalizedPageRank } from "./pagerank";
import { diversityMultiplier, neighborsOf, regionOf } from "./diversity";
import { detectOperators, FINGERPRINT_DEFAULTS } from "./fingerprint";
import { voucherPenalties } from "./slashing";
import { tierOf } from "./tier";

export type TrustOptions = {
  decay?: DecayFn;
  fingerprint?: Partial<typeof FINGERPRINT_DEFAULTS>;
  pagerank?: { damping?: number; tolerance?: number; maxIterations?: number };
};

function evidenceFor(address: string, g: TrustGraph): TrustEvidence {
  const mine = g.edges.filter(
    (e) => !e.blocked && (e.a.toLowerCase() === address || e.b.toLowerCase() === address),
  );
  return {
    connections: mine.length,
    occasions: new Set(mine.map((e) => e.occasionId)).size,
    regions: new Set(mine.map((e) => regionOf(e.occasionId))).size,
    // Vouch yang DITERIMA. Menjamin orang lain bukan bukti tentang dirimu.
    vouches: g.vouches.filter((v) => v.to.toLowerCase() === address).length,
  };
}

/**
 * Satu-satunya pintu keluar paket ini. Urutan langkah di bawah MENGIKAT —
 * mengubahnya mengubah hasil (spec fase §4.6).
 */
export function computeTrust(graph: TrustGraph, opts: TrustOptions = {}): TrustResult[] {
  const nodes = allAddresses(graph);

  // 1-3. Graf berarah (blocked & slashed sudah tercabut di sini) lalu PageRank.
  const directed = buildDirectedGraph(graph, { decay: opts.decay });
  const scores = personalizedPageRank(directed, graph.seeds, nodes, opts.pagerank);

  // 4. Diversitas — sifat satu orang, jadi diterapkan SETELAH PageRank.
  const neighbors = neighborsOf(graph.edges);
  const adjusted = new Map<string, number>();
  for (const n of nodes) {
    adjusted.set(n, (scores.get(n) ?? 0) * diversityMultiplier(n, graph.edges, neighbors));
  }

  // 5. Klaster operator berbagi satu skor, dibagi rata (spec induk §9.1).
  const clusters = detectOperators(graph.edges, opts.fingerprint);
  const clusterOf = new Map<string, string>();
  for (const c of clusters) {
    const total = c.members.reduce((s, m) => s + (adjusted.get(m) ?? 0), 0);
    const share = total / c.members.length;
    for (const m of c.members) {
      clusterOf.set(m, c.id);
      adjusted.set(m, share);
    }
  }

  // 6. Penalti penjamin, satu lompatan.
  for (const [addr, factor] of voucherPenalties(graph.slashed, graph.vouches)) {
    if (adjusted.has(addr)) adjusted.set(addr, adjusted.get(addr)! * factor);
  }
  // Pelaku terkonfirmasi kehilangan skornya sendiri, bukan cuma aliran keluarnya.
  for (const s of graph.slashed) adjusted.set(s.toLowerCase(), 0);

  // 7. Rasio terhadap skor TERTINGGI DI GRAF -> tier.
  //
  // Penyebutnya bukan skor seed. PageRank berpersonalisasi tidak menjamin seed
  // memegang skor tertinggi: kepercayaan mengalir keluar dari seed lalu menumpuk
  // di simpul yang paling banyak tetangganya. Kalau penyebutnya skor seed,
  // rasio bisa melebihi 1 dan janji rentang 0..1 di spec fase §4.5 jadi bohong.
  // reduce, bukan Math.max(...spread): spread punya batas jumlah argumen di
  // mesin JS (~65k di V8), dan API memanggil ini atas SELURUH graf, bukan satu
  // event. Batas itu akan terlampaui jauh sebelum grafnya terasa besar.
  const topScore = nodes.reduce((max, n) => Math.max(max, adjusted.get(n) ?? 0), 0);

  const rows: TrustResult[] = nodes.map((n) => {
    const score = adjusted.get(n) ?? 0;
    const ratio = topScore > 0 ? score / topScore : 0;
    return {
      address: n as Address,
      score,
      ratio,
      tier: tierOf(ratio),
      evidence: evidenceFor(n, graph),
      operatorCluster: clusterOf.get(n) ?? null,
    };
  });

  // Urutan alamat sebagai pemecah seri, supaya hasilnya deterministik.
  return rows.sort((x, y) => (y.score - x.score) || (x.address < y.address ? -1 : 1));
}
```

Tambahkan ke `packages/trust/src/index.ts`:
```ts
export * from "./tier";
export * from "./compute";
```

- [ ] **Step 7: Jalankan seluruh test paket, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/trust test && pnpm --filter @nearly/trust typecheck`
Diharapkan: PASS — 69 test, typecheck bersih

- [ ] **Step 8: Commit**

```bash
git add packages/trust
git commit -m "feat: tier dari rasio ke seed + pipeline computeTrust utuh"
```

---

## Task 7: EIP-712 vouch di `packages/shared`

**Files:**
- Create: `packages/shared/src/vouch.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/schema.ts`
- Test: `packages/shared/test/vouch.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` (Fase 1, `packages/shared/src/handshake.ts`)
- Produces:
  - `type VouchMessage = { from: Address; to: Address; tagsHash: Hex; expiresAt: bigint }`
  - `type RevokeMessage = { from: Address; to: Address; expiresAt: bigint }`
  - `VOUCH_TYPES`
  - `MAX_TAGS: 5`, `MAX_TAG_LENGTH: 24`
  - `normalizeTags(tags: string[]): string[]`
  - `tagsHashOf(tags: string[]): Hex`
  - `vouchTypedData(msg, verifyingContract)`, `revokeTypedData(msg, verifyingContract)`
  - `recoverVouchSigner(msg, sig, verifyingContract): Promise<Address>`
  - `recoverRevokeSigner(msg, sig, verifyingContract): Promise<Address>`
  - `VouchRequestSchema`, `RevokeRequestSchema`, `ReportRequestSchema` (Zod)

- [ ] **Step 1: Tulis test yang gagal**

`packages/shared/test/vouch.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  normalizeTags, recoverRevokeSigner, recoverVouchSigner, revokeTypedData,
  tagsHashOf, vouchTypedData, VouchRequestSchema,
} from "../src/index";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const TO = "0x000000000000000000000000000000000000beef" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;

const msg = {
  from: account.address,
  to: TO,
  tagsHash: tagsHashOf(["real builder"]),
  expiresAt: 1_800_000_000n,
};

describe("normalizeTags", () => {
  it("memangkas spasi, menyeragamkan huruf kecil, membuang duplikat, dan mengurutkan", () => {
    expect(normalizeTags(["  Solid Dev ", "real builder", "SOLID DEV"]))
      .toEqual(["real builder", "solid dev"]);
  });

  it("membuang tag kosong", () => {
    expect(normalizeTags(["", "   ", "zk"])).toEqual(["zk"]);
  });

  it("memotong pada jumlah tag maksimum", () => {
    expect(normalizeTags(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(5);
  });

  it("memotong tag yang kepanjangan", () => {
    expect(normalizeTags(["x".repeat(100)])[0]).toHaveLength(24);
  });
});

describe("tagsHashOf", () => {
  it("urutan masukan tidak mengubah hash", () => {
    expect(tagsHashOf(["b", "a"])).toBe(tagsHashOf(["a", "b"]));
  });

  it("GERBANG: tag bermultikata tidak bertabrakan dengan pemisah", () => {
    // Digabung dengan spasi, keduanya menjadi "a b c" dan hash-nya identik.
    // Itu membuat satu himpunan tag bisa ditukar diam-diam dengan himpunan
    // lain yang tetap lolos verifikasi terhadap hash on-chain.
    expect(tagsHashOf(["a b", "c"])).not.toBe(tagsHashOf(["a", "b c"]));
  });

  it("isi berbeda menghasilkan hash berbeda", () => {
    expect(tagsHashOf(["a"])).not.toBe(tagsHashOf(["b"]));
  });

  it("tag kosong tetap menghasilkan hash yang sah", () => {
    expect(tagsHashOf([])).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("vouchTypedData", () => {
  it("tanda tangan bisa dipulihkan kembali ke penandatangan", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    expect((await recoverVouchSigner(msg, sig, CONTRACT)).toLowerCase())
      .toBe(account.address.toLowerCase());
  });

  it("mengubah SATU field membuat pemulihan meleset", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const diubah = { ...msg, to: CONTRACT };
    expect((await recoverVouchSigner(diubah, sig, CONTRACT)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });

  it("terikat ke chainId 97 — tanda tangan tidak bisa dipakai ulang di chain lain", () => {
    expect(vouchTypedData(msg, CONTRACT).domain.chainId).toBe(97);
  });

  it("terikat ke alamat kontrak", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const lain = "0x00000000000000000000000000000000000c0de1" as Address;
    expect((await recoverVouchSigner(msg, sig, lain)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });
});

describe("revokeTypedData", () => {
  it("tanda tangan bisa dipulihkan kembali ke penandatangan", async () => {
    const r = { from: account.address, to: TO, expiresAt: 1_800_000_000n };
    const sig = await account.signTypedData(revokeTypedData(r, CONTRACT));
    expect((await recoverRevokeSigner(r, sig, CONTRACT)).toLowerCase())
      .toBe(account.address.toLowerCase());
  });

  it("tanda tangan vouch TIDAK bisa dipakai sebagai revoke", async () => {
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const r = { from: account.address, to: TO, expiresAt: msg.expiresAt };
    expect((await recoverRevokeSigner(r, sig, CONTRACT)).toLowerCase())
      .not.toBe(account.address.toLowerCase());
  });
});

describe("VouchRequestSchema", () => {
  it("menerima badan permintaan yang sah", () => {
    expect(VouchRequestSchema.safeParse({
      from: account.address, to: TO, tags: ["zk"],
      expiresAt: "1800000000", sig: `0x${"1".repeat(130)}`,
    }).success).toBe(true);
  });

  it("menolak alamat yang tidak sah", () => {
    expect(VouchRequestSchema.safeParse({
      from: "bukan-alamat", to: TO, tags: [], expiresAt: "1800000000", sig: `0x${"1".repeat(130)}`,
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/shared test vouch`
Diharapkan: FAIL — `normalizeTags is not a function`

- [ ] **Step 3: Implementasi**

`packages/shared/src/vouch.ts`:
```ts
import {
  encodeAbiParameters, keccak256, recoverTypedDataAddress, type Address, type Hex,
} from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

export type VouchMessage = {
  from: Address;
  to: Address;
  tagsHash: Hex;
  expiresAt: bigint;
};

export type RevokeMessage = { from: Address; to: Address; expiresAt: bigint };

// WAJIB identik dengan typehash di packages/contracts/src/VouchRegistry.sol.
// Dijaga oleh test kunci di Task 9.
const TYPES = {
  Vouch: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "tagsHash", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  RevokeVouch: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const VOUCH_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

/**
 * Menyeragamkan tag supaya "Solid Dev" dan "solid dev" adalah tag yang sama,
 * dan supaya hash-nya tidak bergantung pada urutan pengguna mengetik.
 */
export function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((t) => t.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
    .filter((t) => t.length > 0);
  return [...new Set(cleaned)].sort().slice(0, MAX_TAGS);
}

/**
 * Teks tag hidup di Postgres; hanya hash-nya yang naik on-chain (spec fase §5).
 * Menyimpan array string di BSC mahal tanpa guna, sementara hash sudah cukup
 * membuktikan tag tidak diubah belakangan.
 *
 * Array-nya di-ABI-encode, TIDAK digabung dengan spasi. Menggabung dengan
 * pemisah yang bisa muncul di dalam tag menciptakan tabrakan sungguhan:
 * ["a b", "c"] dan ["a", "b c"] sama-sama menjadi "a b c" dan menghasilkan hash
 * identik — yang persis membatalkan jaminan bahwa hash membuktikan tag tidak
 * diubah. ABI encoding membawa panjang tiap elemen, jadi batas antar tag tidak
 * bisa dikaburkan.
 */
export function tagsHashOf(tags: string[]): Hex {
  return keccak256(encodeAbiParameters([{ type: "string[]" }], [normalizeTags(tags)]));
}

export function vouchTypedData(msg: VouchMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Vouch: TYPES.Vouch },
    primaryType: "Vouch",
    message: msg,
  } as const;
}

export function revokeTypedData(msg: RevokeMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { RevokeVouch: TYPES.RevokeVouch },
    primaryType: "RevokeVouch",
    message: msg,
  } as const;
}

export function recoverVouchSigner(
  msg: VouchMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...vouchTypedData(msg, verifyingContract), signature });
}

export function recoverRevokeSigner(
  msg: RevokeMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...revokeTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 4: Tambahkan skema Zod**

Periksa dulu isi `packages/shared/src/schema.ts`. Fase 1 sudah punya validator alamat dan tanda tangan di sana, hanya belum diekspor — kemungkinan bernama `address` dan `signature`. **Ekspor ulang yang sudah ada, jangan mendeklarasikan pasangan kedua dengan regex yang sama.** Dua definisi untuk satu konsep akan menyimpang diam-diam begitu format alamat berubah di salah satunya:

```ts
// Satu definisi per konsep. Nama lama tetap dipakai skema Fase 1.
export const AddressSchema = address;
export const SignatureSchema = signature;
```

Lalu tambahkan di akhir file:
```ts
export const VouchRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  tags: z.array(z.string()).max(16),
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const RevokeRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const ReportRequestSchema = z.object({
  reporter: AddressSchema,
  subject: AddressSchema,
  reason: z.string().min(10).max(1000),
  evidence: z.string().max(2000).optional(),
});
```

Tambahkan ke `packages/shared/src/index.ts`:
```ts
export * from "./vouch";
```

- [ ] **Step 5: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/shared test`
Diharapkan: PASS — 46 test lama tetap hijau + 15 test baru

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat: EIP-712 vouch dan revoke + hash tag"
```

---

## Task 8: `VouchRegistry.sol`

**Files:**
- Create: `packages/contracts/src/VouchRegistry.sol`
- Test: `packages/contracts/test/VouchRegistry.t.sol`

**Interfaces:**
- Consumes: `ConnectionRegistry.isConnected` (Fase 1)
- Produces (ABI yang dipakai Task 12 & 13):
  - `vouch(address from, address to, bytes32 tagsHash, uint64 expiresAt, bytes sig)`
  - `revoke(address from, address to, uint64 expiresAt, bytes sig)`
  - `slash(address subject)`
  - `isVouched(address from, address to) view returns (bool)`
  - `slashed(address) view returns (bool)`
  - `DOMAIN_SEPARATOR() view returns (bytes32)`

**CATATAN URUTAN CHEATCODE — pelajaran mahal dari Fase 1.** `vm.prank` hanya berlaku untuk **satu panggilan berikutnya**, dan `vm.sign` sendiri adalah panggilan cheatcode. Kalau helper tanda tangan dipanggil sebagai *argumen* `reg.vouch(...)`, ia menelan prank itu dan test gagal dengan `NotAttestor()` padahal kontraknya benar. Urutan yang benar, dan yang dipakai di seluruh test di bawah: **hitung tanda tangan ke variabel lokal → `vm.expectRevert` → `vm.prank` → panggil.**

- [ ] **Step 1: Tulis test Foundry yang gagal**

`packages/contracts/test/VouchRegistry.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";

contract VouchRegistryTest is Test {
    ConnectionRegistry conn;
    VouchRegistry reg;

    address attestor = address(0xA77E);
    uint256 pkA = 0xA11CE;
    uint256 pkB = 0xB0B;
    address alice;
    address bob;
    bytes32 constant TAGS = keccak256("real builder");
    uint64 expiresAt;

    function setUp() public {
        alice = vm.addr(pkA);
        bob = vm.addr(pkB);
        conn = new ConnectionRegistry(attestor);
        reg = new VouchRegistry(attestor, address(conn));
        expiresAt = uint64(block.timestamp + 1 hours);
        _connect();
    }

    function _connect() internal {
        bytes32 nonce = keccak256("n1");
        uint64 exp = uint64(block.timestamp + 1 hours);
        bytes memory sigOffer = _sign(pkA, _offerDigest(alice, nonce, exp));
        bytes memory sigAccept = _sign(pkB, _acceptDigest(alice, bob, nonce, exp));
        vm.prank(attestor);
        conn.connect(alice, bob, nonce, exp, sigOffer, sigAccept);
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 separator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", separator, structHash));
    }

    function _offerDigest(address initiator, bytes32 nonce, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)"),
            initiator, nonce, exp
        ));
        return _eip712(conn.DOMAIN_SEPARATOR(), h);
    }

    function _acceptDigest(address initiator, address counterparty, bytes32 nonce, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256(
                "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)"
            ),
            initiator, counterparty, nonce, exp
        ));
        return _eip712(conn.DOMAIN_SEPARATOR(), h);
    }

    function _vouchDigest(address from, address to, bytes32 tagsHash, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("Vouch(address from,address to,bytes32 tagsHash,uint64 expiresAt)"),
            from, to, tagsHash, exp
        ));
        return _eip712(reg.DOMAIN_SEPARATOR(), h);
    }

    function _revokeDigest(address from, address to, uint64 exp)
        internal view returns (bytes32)
    {
        bytes32 h = keccak256(abi.encode(
            keccak256("RevokeVouch(address from,address to,uint64 expiresAt)"), from, to, exp
        ));
        return _eip712(reg.DOMAIN_SEPARATOR(), h);
    }

    function test_vouch_berhasil() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        assertTrue(reg.isVouched(alice, bob));
    }

    function test_vouch_berarah_tidak_berlaku_sebaliknya() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        assertFalse(reg.isVouched(bob, alice));
    }

    function test_vouch_tanpa_koneksi_gagal() public {
        address carol = vm.addr(0xC0);
        bytes memory sig = _sign(pkA, _vouchDigest(alice, carol, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.NotConnected.selector);
        vm.prank(attestor);
        reg.vouch(alice, carol, TAGS, expiresAt, sig);
    }

    function test_vouch_bukan_attestor_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.NotAttestor.selector);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_tanda_tangan_salah_gagal() public {
        bytes memory sig = _sign(pkB, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_kedaluwarsa_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(VouchRegistry.Expired.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_vouch_ke_diri_sendiri_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, alice, TAGS, expiresAt));
        vm.expectRevert(VouchRegistry.SelfVouch.selector);
        vm.prank(attestor);
        reg.vouch(alice, alice, TAGS, expiresAt, sig);
    }

    function test_vouch_dua_kali_gagal() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
        vm.expectRevert(VouchRegistry.AlreadyVouched.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sig);
    }

    function test_revoke_berhasil() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
        assertFalse(reg.isVouched(alice, bob));
    }

    function test_revoke_oleh_orang_lain_gagal() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkB, _revokeDigest(alice, bob, expiresAt));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_revoke_yang_belum_pernah_ada_gagal() public {
        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.expectRevert(VouchRegistry.NotVouched.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_vouch_TIDAK_bisa_diputar_ulang_setelah_revoke() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        // Tanda tangan vouch yang SAMA dikirim ulang. Tanpa penjagaan ini,
        // attestor bisa menghidupkan kembali vouch yang sudah dicabut pengguna
        // tanpa persetujuan baru dari pengguna itu.
        vm.expectRevert(VouchRegistry.AlreadyVouched.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);
    }

    function test_revoke_TIDAK_bisa_diputar_ulang() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        vm.expectRevert(VouchRegistry.NotVouched.selector);
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);
    }

    function test_tanda_tangan_high_s_ditolak() public {
        bytes memory sig = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        bytes32 r;
        bytes32 sVal;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            sVal := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        // Pasangan malleable: (r, n - s, v terbalik) memulihkan alamat yang sama
        // di ecrecover polos. Kontrak harus menolaknya.
        bytes32 sHigh = bytes32(
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - uint256(sVal)
        );
        bytes memory malleable = abi.encodePacked(r, sHigh, v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(VouchRegistry.BadSignature.selector);
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, malleable);
    }

    function test_slash_hanya_attestor() public {
        vm.expectRevert(VouchRegistry.NotAttestor.selector);
        reg.slash(bob);
    }

    function test_slash_menandai_subjek() public {
        vm.prank(attestor);
        reg.slash(bob);
        assertTrue(reg.slashed(bob));
    }

    function test_revoke_tidak_menghapus_slash() public {
        bytes memory sigV = _sign(pkA, _vouchDigest(alice, bob, TAGS, expiresAt));
        vm.prank(attestor);
        reg.vouch(alice, bob, TAGS, expiresAt, sigV);
        vm.prank(attestor);
        reg.slash(bob);

        bytes memory sigR = _sign(pkA, _revokeDigest(alice, bob, expiresAt));
        vm.prank(attestor);
        reg.revoke(alice, bob, expiresAt, sigR);

        // Mencabut vouch melepas tanggung jawab KE DEPAN, tapi slash yang sudah
        // terjadi tetap berdiri — kalau tidak, "skin in the game" jadi kosong.
        assertTrue(reg.slashed(bob));
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `cd packages/contracts && forge test --match-contract VouchRegistryTest`
Diharapkan: FAIL — file `VouchRegistry.sol` tidak ditemukan

- [ ] **Step 3: Implementasi**

`packages/contracts/src/VouchRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConnectionRegistry {
    function isConnected(address x, address y) external view returns (bool);
}

/**
 * Vouch, revoke, dan slash.
 *
 * Vouch adalah taruhan reputasi: kamu menjamin seseorang, dan kalau dia
 * terbukti menipu, skormu ikut turun (spec induk §7.3). Karena itu kontrak
 * menegakkan satu hal yang tidak boleh bisa dilewati server: VOUCH TANPA
 * KONEKSI FISIK MUSTAHIL.
 *
 * Kunci map BERARAH, tidak seperti ConnectionRegistry yang kanonik —
 * A menjamin B bukan hal yang sama dengan B menjamin A.
 *
 * SATU VOUCH PER PASANGAN, SELAMANYA. Catatannya tidak pernah dihapus; revoke
 * hanya menandai `revokedAt`. Ini menutup pemutaran ulang tanda tangan: tanpa
 * nonce, `delete` akan membuat tanda tangan vouch lama sah kembali, sehingga
 * attestor bisa MEMBATALKAN pencabutan yang sudah dilakukan pengguna tanpa
 * persetujuan baru. Aturan ini juga cerminan "satu koneksi per pasangan orang,
 * selamanya" (spec induk §9.4).
 */
contract VouchRegistry {
    error NotAttestor();
    error NotConnected();
    error SelfVouch();
    error Expired();
    error BadSignature();
    error AlreadyVouched();
    error NotVouched();

    // WAJIB identik dengan VOUCH_TYPES di packages/shared/src/vouch.ts (dijaga Task 9).
    bytes32 private constant VOUCH_TYPEHASH =
        keccak256("Vouch(address from,address to,bytes32 tagsHash,uint64 expiresAt)");
    bytes32 private constant REVOKE_TYPEHASH =
        keccak256("RevokeVouch(address from,address to,uint64 expiresAt)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable attestor;
    IConnectionRegistry public immutable connections;

    struct VouchRecord {
        bytes32 tagsHash;
        uint64 at;
        uint64 revokedAt;
    }

    /// keccak(from, to) => vouch. BERARAH, dan PERMANEN sekali dibuat.
    mapping(bytes32 => VouchRecord) public vouches;
    mapping(address => bool) public slashed;

    event Vouched(address indexed from, address indexed to, bytes32 tagsHash, uint64 at);
    event Revoked(address indexed from, address indexed to, uint64 at);
    event Slashed(address indexed subject, uint64 at);

    constructor(address _attestor, address _connections) {
        attestor = _attestor;
        connections = IConnectionRegistry(_connections);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("Nearly"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    function vouchKey(address from, address to) public pure returns (bytes32) {
        return keccak256(abi.encode(from, to));
    }

    function isVouched(address from, address to) external view returns (bool) {
        VouchRecord storage v = vouches[vouchKey(from, to)];
        return v.at != 0 && v.revokedAt == 0;
    }

    function vouch(
        address from,
        address to,
        bytes32 tagsHash,
        uint64 expiresAt,
        bytes calldata sig
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        // _recover mengembalikan address(0) untuk tanda tangan cacat; tanpa
        // penjagaan ini, from == address(0) akan lolos dengan sampah.
        if (from == address(0)) revert BadSignature();
        if (from == to) revert SelfVouch();
        if (block.timestamp > expiresAt) revert Expired();
        if (!connections.isConnected(from, to)) revert NotConnected();

        bytes32 digest =
            _digest(keccak256(abi.encode(VOUCH_TYPEHASH, from, to, tagsHash, expiresAt)));
        if (_recover(digest, sig) != from) revert BadSignature();

        bytes32 key = vouchKey(from, to);
        if (vouches[key].at != 0) revert AlreadyVouched();

        vouches[key] = VouchRecord({tagsHash: tagsHash, at: uint64(block.timestamp), revokedAt: 0});
        emit Vouched(from, to, tagsHash, uint64(block.timestamp));
    }

    function revoke(address from, address to, uint64 expiresAt, bytes calldata sig) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (block.timestamp > expiresAt) revert Expired();

        bytes32 digest = _digest(keccak256(abi.encode(REVOKE_TYPEHASH, from, to, expiresAt)));
        if (_recover(digest, sig) != from) revert BadSignature();

        bytes32 key = vouchKey(from, to);
        if (vouches[key].at == 0) revert NotVouched();
        // Mencabut dua kali ditolak. Bersama catatan yang tidak pernah dihapus,
        // inilah yang membuat tanda tangan tidak bisa diputar ulang.
        if (vouches[key].revokedAt != 0) revert NotVouched();

        vouches[key].revokedAt = uint64(block.timestamp);
        emit Revoked(from, to, uint64(block.timestamp));
    }

    /**
     * Hasil peninjauan manusia atas laporan yang lolos gerbang (spec fase §6).
     * Gerbangnya sendiri hidup off-chain di packages/trust/src/slashing.ts —
     * isi laporan berisi tuduhan terhadap orang dan tidak boleh naik on-chain.
     */
    function slash(address subject) external {
        if (msg.sender != attestor) revert NotAttestor();
        slashed[subject] = true;
        emit Slashed(subject, uint64(block.timestamp));
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR, structHash));
    }

    /// Setengah orde kurva secp256k1. Di atas ini, tanda tangan malleable.
    uint256 private constant HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // Sebagian library menghasilkan v = 0/1, bukan 27/28.
        if (v < 27) v += 27;
        // Tiap tanda tangan sah punya pasangan malleable (r, n-s, v terbalik)
        // yang memulihkan alamat sama. Menolak separuh atas membuat satu
        // persetujuan hanya punya satu bentuk byte.
        if (uint256(s) > HALF_N) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `cd packages/contracts && forge test --match-contract VouchRegistryTest -vv`
Diharapkan: PASS — 17 test

- [ ] **Step 5: Pastikan test Fase 1 masih hijau**

Jalankan: `cd packages/contracts && forge test`
Diharapkan: PASS — 13 test `ConnectionRegistryTest` + 17 test baru

- [ ] **Step 6: Commit**

```bash
git add packages/contracts
git commit -m "feat: VouchRegistry — vouch tanpa koneksi fisik ditolak kontrak"
```

---

## Task 9: Kunci EIP-712 TS ↔ Solidity

Dua implementasi hash yang harus identik selamanya: TypeScript di `packages/shared` dan Solidity di `VouchRegistry`. Kalau salah satunya bergeser, **setiap tanda tangan ditolak dengan `BadSignature` dan errornya tidak menunjukkan penyebabnya.** Fase 1 sudah punya pagar yang sama untuk handshake; ini menambahkannya untuk vouch.

**Files:**
- Test: `packages/shared/test/vouch-typehash.test.ts`

**Interfaces:**
- Consumes: `VOUCH_TYPES` (Task 7), `VouchRegistry.sol` (Task 8)
- Produces: —

- [ ] **Step 1: Tulis test kunci**

`packages/shared/test/vouch-typehash.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/shared test vouch-typehash`
Diharapkan: PASS — 4 test.

Kalau GAGAL, artinya Task 7 dan Task 8 sudah saling berbeda. **Perbaiki salah satu implementasinya sampai cocok — jangan melonggarkan test-nya.** Test inilah satu-satunya yang menangkap pergeseran itu sebelum ia muncul sebagai `BadSignature` yang membingungkan di perangkat nyata.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/test/vouch-typehash.test.ts
git commit -m "test: kunci typehash vouch antara TypeScript dan Solidity"
```

---

## Task 10: `TrustAttestor.sol` + `NearlyResolver.sol`

**Files:**
- Create: `packages/contracts/src/TrustAttestor.sol`, `packages/contracts/src/NearlyResolver.sol`
- Test: `packages/contracts/test/TrustAttestor.t.sol`, `packages/contracts/test/NearlyResolver.t.sol`

**Interfaces:**
- Consumes: `ConnectionRegistry` (Fase 1), `VouchRegistry` (Task 8)
- Produces (ABI yang dipakai Task 12):
  - `TrustAttestor.setScore(address who, uint32 score, uint8 tier)`
  - `TrustAttestor.scores(address) view returns (uint32 score, uint8 tier, uint64 at)`
  - `NearlyResolver.getTrust(address) view returns (uint32)`
  - `NearlyResolver.getTier(address) view returns (uint8)`
  - `NearlyResolver.isSlashed(address) view returns (bool)`
  - `NearlyResolver.isConnected(address, address) view returns (bool)`

`score` adalah **rasio × 1.000.000** disimpan sebagai `uint32` — Solidity tidak punya bilangan desimal, jadi rasio `0.15` tersimpan sebagai `150000`. Skala ini dipakai lagi di Task 12; kalau berubah di satu tempat, harus berubah di keduanya.

- [ ] **Step 1: Tulis test TrustAttestor yang gagal**

`packages/contracts/test/TrustAttestor.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";

contract TrustAttestorTest is Test {
    TrustAttestor att;
    address attestor = address(0xA77E);
    address who = address(0xBEEF);

    event ScoreUpdated(address indexed who, uint32 score, uint8 tier, uint64 at);

    function setUp() public {
        att = new TrustAttestor(attestor);
    }

    function test_setScore_menyimpan_skor_dan_tier() public {
        vm.prank(attestor);
        att.setScore(who, 150_000, 2);

        (uint32 score, uint8 tier, uint64 at) = att.scores(who);
        assertEq(score, 150_000);
        assertEq(tier, 2);
        assertEq(at, uint64(block.timestamp));
    }

    function test_setScore_bukan_attestor_gagal() public {
        vm.expectRevert(TrustAttestor.NotAttestor.selector);
        att.setScore(who, 1, 1);
    }

    function test_setScore_tier_di_luar_rentang_gagal() public {
        vm.expectRevert(TrustAttestor.BadTier.selector);
        vm.prank(attestor);
        att.setScore(who, 1, 4);
    }

    function test_setScore_skor_melebihi_skala_gagal() public {
        vm.expectRevert(TrustAttestor.BadScore.selector);
        vm.prank(attestor);
        att.setScore(who, 1_000_001, 3);
    }

    function test_setScore_memancarkan_event() public {
        vm.expectEmit(true, false, false, true);
        emit ScoreUpdated(who, 450_000, 3, uint64(block.timestamp));
        vm.prank(attestor);
        att.setScore(who, 450_000, 3);
    }

    function test_setScore_menimpa_nilai_lama() public {
        vm.prank(attestor);
        att.setScore(who, 10_000, 0);
        vm.prank(attestor);
        att.setScore(who, 500_000, 3);

        (uint32 score, uint8 tier,) = att.scores(who);
        assertEq(score, 500_000);
        assertEq(tier, 3);
    }

    function test_alamat_yang_belum_pernah_ditulis_bernilai_nol() public view {
        (uint32 score, uint8 tier, uint64 at) = att.scores(address(0xDEAD));
        assertEq(score, 0);
        assertEq(tier, 0);
        assertEq(at, 0);
    }

    function test_konstruktor_menolak_attestor_nol() public {
        vm.expectRevert(TrustAttestor.ZeroAddress.selector);
        new TrustAttestor(address(0));
    }

    function test_skala_penuh_diterima() public {
        vm.prank(attestor);
        att.setScore(who, 1_000_000, 3);
        (uint32 score,,) = att.scores(who);
        assertEq(score, 1_000_000);
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `cd packages/contracts && forge test --match-contract TrustAttestorTest`
Diharapkan: FAIL — file `TrustAttestor.sol` tidak ditemukan

- [ ] **Step 3: Implementasi TrustAttestor**

`packages/contracts/src/TrustAttestor.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Publikasi Trust Score.
 *
 * Skor dihitung off-chain di packages/trust lalu diterbitkan ke sini. Yang
 * membuat ini layak on-chain: setiap koneksi juga on-chain, jadi siapa pun bisa
 * MENGHITUNG ULANG skor dari graf publik dan membuktikan angka di sini tidak
 * dikarang (spec induk §10.3).
 *
 * Event ScoreUpdated dipancarkan di setiap penulisan, sehingga seluruh riwayat
 * skor bisa direkonstruksi dari log tanpa perlu arsip terpisah.
 */
contract TrustAttestor {
    error NotAttestor();
    error BadTier();
    error BadScore();
    error ZeroAddress();

    /// Solidity tidak punya desimal: rasio 0.15 disimpan sebagai 150000.
    uint32 public constant SCORE_SCALE = 1_000_000;

    struct Score {
        uint32 score;
        uint8 tier;
        uint64 at;
    }

    address public immutable attestor;
    mapping(address => Score) public scores;

    event ScoreUpdated(address indexed who, uint32 score, uint8 tier, uint64 at);

    constructor(address _attestor) {
        // attestor immutable: salah ketik saat deploy tidak bisa diperbaiki,
        // dan address(0) membuat setScore mustahil dipanggil selamanya.
        if (_attestor == address(0)) revert ZeroAddress();
        attestor = _attestor;
    }

    function setScore(address who, uint32 score, uint8 tier) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (tier > 3) revert BadTier();
        if (score > SCORE_SCALE) revert BadScore();

        scores[who] = Score({score: score, tier: tier, at: uint64(block.timestamp)});
        emit ScoreUpdated(who, score, tier, uint64(block.timestamp));
    }
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Jalankan: `cd packages/contracts && forge test --match-contract TrustAttestorTest`
Diharapkan: PASS — 9 test

- [ ] **Step 5: Tulis test NearlyResolver yang gagal**

`packages/contracts/test/NearlyResolver.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {NearlyResolver} from "../src/NearlyResolver.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";

contract NearlyResolverTest is Test {
    ConnectionRegistry conn;
    VouchRegistry vouch;
    TrustAttestor att;
    NearlyResolver resolver;

    address attestor = address(0xA77E);
    uint256 pkA = 0xA11CE;
    uint256 pkB = 0xB0B;
    address alice;
    address bob;

    function setUp() public {
        alice = vm.addr(pkA);
        bob = vm.addr(pkB);
        conn = new ConnectionRegistry(attestor);
        vouch = new VouchRegistry(attestor, address(conn));
        att = new TrustAttestor(attestor);
        resolver = new NearlyResolver(address(conn), address(vouch), address(att));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 separator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", separator, structHash));
    }

    function _connect() internal {
        bytes32 nonce = keccak256("n1");
        uint64 exp = uint64(block.timestamp + 1 hours);

        bytes32 ho = keccak256(abi.encode(
            keccak256("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)"),
            alice, nonce, exp
        ));
        bytes32 ha = keccak256(abi.encode(
            keccak256(
                "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)"
            ),
            alice, bob, nonce, exp
        ));
        bytes memory sigOffer = _sign(pkA, _eip712(conn.DOMAIN_SEPARATOR(), ho));
        bytes memory sigAccept = _sign(pkB, _eip712(conn.DOMAIN_SEPARATOR(), ha));
        vm.prank(attestor);
        conn.connect(alice, bob, nonce, exp, sigOffer, sigAccept);
    }

    function test_getTrust_dan_getTier_membaca_dari_attestor() public {
        vm.prank(attestor);
        att.setScore(alice, 450_000, 3);
        assertEq(resolver.getTrust(alice), 450_000);
        assertEq(resolver.getTier(alice), 3);
    }

    function test_alamat_asing_bernilai_nol_dan_tier_Baru() public view {
        assertEq(resolver.getTrust(address(0xDEAD)), 0);
        assertEq(resolver.getTier(address(0xDEAD)), 0);
    }

    function test_isConnected_membaca_dari_ConnectionRegistry() public {
        assertFalse(resolver.isConnected(alice, bob));
        _connect();
        assertTrue(resolver.isConnected(alice, bob));
    }

    function test_isConnected_tidak_peduli_urutan_argumen() public {
        _connect();
        assertTrue(resolver.isConnected(bob, alice));
    }

    function test_isSlashed_membaca_dari_VouchRegistry() public {
        assertFalse(resolver.isSlashed(bob));
        vm.prank(attestor);
        vouch.slash(bob);
        assertTrue(resolver.isSlashed(bob));
    }

    function test_konstruktor_menolak_alamat_nol() public {
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(0), address(vouch), address(att));
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(conn), address(0), address(att));
        vm.expectRevert(NearlyResolver.ZeroAddress.selector);
        new NearlyResolver(address(conn), address(vouch), address(0));
    }

    function test_resolver_bukan_attestor_di_kontrak_mana_pun() public view {
        // Resolver hanya baca. Kalau suatu saat seseorang menambahkan fungsi
        // tulis di sini, panggilannya tetap gagal karena alamat ini bukan
        // attestor di registry mana pun.
        assertTrue(address(resolver) != conn.attestor());
        assertTrue(address(resolver) != vouch.attestor());
        assertTrue(address(resolver) != att.attestor());
    }
}
```

- [ ] **Step 6: Implementasi NearlyResolver**

`packages/contracts/src/NearlyResolver.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConnections {
    function isConnected(address x, address y) external view returns (bool);
}

interface IVouches {
    function slashed(address subject) external view returns (bool);
}

interface IAttestor {
    function scores(address who) external view returns (uint32 score, uint8 tier, uint64 at);
}

/**
 * Antarmuka baca untuk dApp lain (spec induk §10.3).
 *
 * Inilah titik di mana Nearly berhenti menjadi aplikasi dan menjadi primitif
 * reputasi yang bisa dipakai orang lain: satu alamat, empat pertanyaan, tanpa
 * perlu tahu ada tiga kontrak di belakangnya.
 *
 * HANYA BACA. Tidak ada satu pun fungsi yang mengubah state.
 */
contract NearlyResolver {
    error ZeroAddress();

    IConnections public immutable connections;
    IVouches public immutable vouches;
    IAttestor public immutable attestor;

    constructor(address _connections, address _vouches, address _attestor) {
        // Ketiganya immutable dan diisi dari variabel env saat deploy. Alamat
        // nol membuat setiap panggilan revert dan kontraknya mati permanen —
        // satu-satunya obatnya deploy ulang. Murah dijaga di sini.
        if (_connections == address(0) || _vouches == address(0) || _attestor == address(0)) {
            revert ZeroAddress();
        }
        connections = IConnections(_connections);
        vouches = IVouches(_vouches);
        attestor = IAttestor(_attestor);
    }

    /// Rasio x 1.000.000. Alamat yang belum pernah dihitung bernilai 0.
    function getTrust(address who) external view returns (uint32) {
        (uint32 score,,) = attestor.scores(who);
        return score;
    }

    /// 0 Baru, 1 Dikenal, 2 Terpercaya, 3 Inti.
    function getTier(address who) external view returns (uint8) {
        (, uint8 tier,) = attestor.scores(who);
        return tier;
    }

    function isSlashed(address who) external view returns (bool) {
        return vouches.slashed(who);
    }

    function isConnected(address x, address y) external view returns (bool) {
        return connections.isConnected(x, y);
    }
}
```

- [ ] **Step 7: Jalankan seluruh test kontrak, pastikan LULUS**

Jalankan: `cd packages/contracts && forge test`
Diharapkan: PASS — 13 (Fase 1) + 14 (VouchRegistry) + 9 (TrustAttestor) + 7 (NearlyResolver) = 46 test

- [ ] **Step 8: Commit**

```bash
git add packages/contracts
git commit -m "feat: TrustAttestor publikasi skor + NearlyResolver antarmuka baca"
```

---

## Task 11: Migrasi `0002_trust.sql` + port DB + pemuat graf

**Files:**
- Create: `supabase/migrations/0002_trust.sql`
- Create: `apps/api/src/trust/load-graph.ts`, `apps/api/src/trust/store.ts`
- Modify: `apps/api/src/ports.ts`, `apps/api/src/db.ts`, `apps/api/src/handshake-gate.ts`, `apps/api/package.json`
- Test: `apps/api/test/load-graph.test.ts`

**Interfaces:**
- Consumes: `TrustGraph`, `TrustResult`, `Vouch`, `TrustEdge` (Task 1, 6)
- Produces:
  - `OCCASION_WINDOW_MS: 10_800_000`
  - `occasionIdOf(cell: string, atMs: number): string`
  - `type GraphRows = { connections: ConnRow[]; vouches: VouchRow[]; seeds: SeedRow[]; slashes: SlashRow[] }`
  - `rowsToGraph(rows: GraphRows, nowMs: number): TrustGraph`
  - `TrustStore`, `VouchStore`, `ReportStore`, `AttestorPort`, `VouchChainPort` (tipe di `ports.ts`)
  - `createTrustStore(db)`, `createVouchStore(db)`, `createReportStore(db)`

`occasionIdOf` adalah tempat keputusan §2.1 spec fase diterapkan. **Hanya fungsi ini yang berubah di Fase 3**, saat occasion diisi dari check-in event terverifikasi — `packages/trust` tidak berubah sebaris pun.

- [ ] **Step 1: Tulis migrasi**

`supabase/migrations/0002_trust.sql`:
```sql
-- Nearly Fase 2. Enam tabel trust. RLS menyala tanpa policy publik, sama
-- seperti 0001: API mengaksesnya lewat service role key.

-- Satu-satunya kepercayaan yang disuntik manusia ke seluruh sistem. Semua
-- angka lain dihitung. Ubah isi tabel ini, dan seluruh papan skor berubah.
create table if not exists trust_seeds (
  address    text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  weight     numeric not null default 1 check (weight > 0),
  note       text not null default '',
  added_at   timestamptz not null default now()
);

-- BERARAH: primary key (from_addr, to_addr), bukan pasangan kanonik seperti
-- connections. A menjamin B bukan hal yang sama dengan B menjamin A.
create table if not exists vouches (
  from_addr  text not null check (from_addr ~ '^0x[0-9a-f]{40}$'),
  to_addr    text not null check (to_addr ~ '^0x[0-9a-f]{40}$'),
  tags       text[] not null default '{}',
  tags_hash  text not null,
  tx_hash    text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (from_addr, to_addr),
  constraint vouches_no_self check (from_addr <> to_addr)
);

create index if not exists vouches_to on vouches (to_addr) where revoked_at is null;

-- Isi laporan TIDAK PERNAH naik on-chain: ini tuduhan terhadap orang (spec §9.3).
create table if not exists reports (
  id         bigserial primary key,
  reporter   text not null check (reporter ~ '^0x[0-9a-f]{40}$'),
  subject    text not null check (subject ~ '^0x[0-9a-f]{40}$'),
  reason     text not null,
  evidence   text,
  status     text not null default 'baru'
             check (status in ('baru', 'layak_ditinjau', 'ditolak', 'terkonfirmasi')),
  created_at timestamptz not null default now(),
  -- Menutup cara paling murah menembus gerbang: satu orang mengirim laporan
  -- yang sama berkali-kali supaya terhitung sebagai beberapa pelapor.
  constraint reports_one_vote unique (reporter, subject),
  constraint reports_no_self check (reporter <> subject)
);

create index if not exists reports_subject on reports (subject);

create table if not exists slashes (
  subject      text primary key check (subject ~ '^0x[0-9a-f]{40}$'),
  confirmed_at timestamptz not null default now(),
  tx_hash      text not null
);

create table if not exists trust_snapshots (
  address          text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  score            double precision not null,
  ratio            double precision not null,
  tier             smallint not null check (tier between 0 and 3),
  connections      integer not null default 0,
  occasions        integer not null default 0,
  regions          integer not null default 0,
  vouches          integer not null default 0,
  operator_cluster text,
  computed_at      timestamptz not null default now()
);

-- Menjawab satu pertanyaan: apakah tier alamat ini sudah berubah sejak terakhir
-- dipublikasi? Tanpa tabel ini tidak ada cara tahu transaksi mana yang layak
-- dikirim, dan penghematan gas di spec fase §7.1 tidak bisa ditegakkan.
create table if not exists trust_published (
  address      text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  tier         smallint not null check (tier between 0 and 3),
  score        integer not null,
  tx_hash      text not null,
  published_at timestamptz not null default now()
);

-- Diversitas butuh tahu koneksi ini terjadi di sel mana (spec fase §4.3).
-- Fase 1 hanya menyimpan sel di handshake_offers, yang boleh dibersihkan;
-- koneksi harus membawa selnya sendiri karena ia permanen.
alter table connections add column if not exists cell char(7);

alter table trust_seeds enable row level security;
alter table vouches enable row level security;
alter table reports enable row level security;
alter table slashes enable row level security;
alter table trust_snapshots enable row level security;
alter table trust_published enable row level security;
```

- [ ] **Step 2: Simpan `cell` saat koneksi dicetak**

Tiga perubahan kecil yang harus dilakukan bersama, kalau tidak kolom `cell` akan selalu `null`:

1. `apps/api/src/ports.ts` — pada tipe argumen `recordConnection`, tambahkan `cell: string`.
2. `apps/api/src/db.ts` — di `recordConnection`, tambahkan `cell: row.cell` ke objek `insert`.
3. `apps/api/src/handshake-gate.ts` — di pemanggilan `deps.store.recordConnection({...})` dalam `acceptHandshake`, tambahkan `cell: offer.cell`.

Sel diambil dari **offer**, bukan dari input B, karena itulah sel yang sudah lolos verifikasi ko-lokasi.

- [ ] **Step 3: Tulis test pemuat graf yang gagal**

`apps/api/test/load-graph.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { occasionIdOf, OCCASION_WINDOW_MS, rowsToGraph } from "../src/trust/load-graph";
import type { GraphRows } from "../src/trust/load-graph";

const NOW = 1_700_000_000_000;

function rows(over: Partial<GraphRows> = {}): GraphRows {
  return { connections: [], vouches: [], seeds: [], slashes: [], ...over };
}

describe("occasionIdOf", () => {
  it("dua koneksi di sel dan jendela yang sama masuk occasion yang sama", () => {
    expect(occasionIdOf("qqguv1r", NOW)).toBe(occasionIdOf("qqguv1r", NOW + 60_000));
  });

  it("sel berbeda menghasilkan occasion berbeda walau waktunya sama", () => {
    expect(occasionIdOf("qqguv1r", NOW)).not.toBe(occasionIdOf("w1xyz00", NOW));
  });

  it("selisih lebih dari satu jendela menghasilkan occasion berbeda", () => {
    expect(occasionIdOf("qqguv1r", NOW))
      .not.toBe(occasionIdOf("qqguv1r", NOW + OCCASION_WINDOW_MS * 2));
  });

  it("berbentuk cell:indeks supaya regionOf bisa membacanya", () => {
    expect(occasionIdOf("qqguv1r", NOW)).toMatch(/^qqguv1r:\d+$/);
  });
});

describe("rowsToGraph", () => {
  it("baris koneksi menjadi edge dengan occasion terhitung", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: "qqguv1r", created_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]!.occasionId).toBe(occasionIdOf("qqguv1r", NOW));
    expect(g.edges[0]!.blocked).toBe(false);
  });

  it("koneksi lama tanpa cell tetap masuk graf, masing-masing occasion sendiri", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: null, created_at: new Date(NOW).toISOString() },
          { addr_a: "0x0a", addr_b: "0x0c", cell: null, created_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    // Koneksi Fase 1 tercatat sebelum kolom cell ada. Tidak boleh hilang dari
    // graf, tapi juga tidak boleh menyatu jadi satu occasion raksasa yang
    // menjatuhkan diversitas semua orang yang punya koneksi lama.
    expect(g.edges).toHaveLength(2);
    expect(g.edges[0]!.occasionId).not.toBe(g.edges[1]!.occasionId);
  });

  it("vouch yang sudah dicabut tidak ikut masuk", () => {
    const g = rowsToGraph(
      rows({
        vouches: [
          { from_addr: "0x0a", to_addr: "0x0b", created_at: new Date(NOW).toISOString(), revoked_at: null },
          { from_addr: "0x0a", to_addr: "0x0c", created_at: new Date(NOW).toISOString(), revoked_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    expect(g.vouches).toHaveLength(1);
    expect(g.vouches[0]!.to).toBe("0x0b");
  });

  it("seed dan slash diteruskan, alamat dinormalkan huruf kecil", () => {
    const g = rowsToGraph(
      rows({ seeds: [{ address: "0x0A", weight: 3 }], slashes: [{ subject: "0x0C" }] }),
      NOW,
    );
    expect(g.seeds).toEqual([{ address: "0x0a", weight: 3 }]);
    expect(g.slashed).toEqual(["0x0c"]);
  });

  it("nowMs diteruskan ke graf", () => {
    expect(rowsToGraph(rows(), NOW).nowMs).toBe(NOW);
  });
});
```

- [ ] **Step 4: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/api test load-graph`
Diharapkan: FAIL — `Cannot find module '../src/trust/load-graph'`

- [ ] **Step 5: Tambahkan dependensi paket trust**

Di `apps/api/package.json`, tambahkan ke `dependencies`:
```json
"@nearly/trust": "workspace:*"
```
Lalu jalankan `pnpm install` dari akar repo.

- [ ] **Step 6: Implementasi pemuat graf**

`apps/api/src/trust/load-graph.ts`:
```ts
import type { Address } from "viem";
import type { TrustEdge, TrustGraph, Vouch } from "@nearly/trust";

/**
 * Jendela 3 jam. Ini penerapan keputusan spec fase §2.1: di Fase 2 "occasion"
 * ditebak dari (sel, jendela waktu), karena entitas event baru lahir di Fase 3.
 *
 * FUNGSI INI SATU-SATUNYA YANG BERUBAH DI FASE 3 — saat itu occasionId diisi
 * dari event_id check-in terverifikasi, dan packages/trust tidak ikut berubah.
 */
export const OCCASION_WINDOW_MS = 10_800_000;

export function occasionIdOf(cell: string, atMs: number): string {
  return `${cell}:${Math.floor(atMs / OCCASION_WINDOW_MS)}`;
}

export type ConnRow = {
  addr_a: string;
  addr_b: string;
  cell: string | null;
  created_at: string;
};
export type VouchRow = {
  from_addr: string;
  to_addr: string;
  created_at: string;
  revoked_at: string | null;
};
export type SeedRow = { address: string; weight: number };
export type SlashRow = { subject: string };

export type GraphRows = {
  connections: ConnRow[];
  vouches: VouchRow[];
  seeds: SeedRow[];
  slashes: SlashRow[];
};

/**
 * Murni, jadi bisa diuji tanpa Supabase. Seluruh penerjemahan baris SQL ke tipe
 * domain terjadi di sini dan tidak di tempat lain.
 */
export function rowsToGraph(rows: GraphRows, nowMs: number): TrustGraph {
  const edges: TrustEdge[] = rows.connections.map((r, i) => {
    const atMs = new Date(r.created_at).getTime();
    return {
      a: r.addr_a.toLowerCase() as Address,
      b: r.addr_b.toLowerCase() as Address,
      // Koneksi Fase 1 tercatat sebelum kolom cell ada. Jangan buang — tapi juga
      // jangan satukan jadi satu occasion raksasa, karena itu akan menjatuhkan
      // diversitas semua orang yang punya koneksi lama.
      occasionId: r.cell ? occasionIdOf(r.cell, atMs) : `tanpa-sel-${i}:0`,
      atMs,
      blocked: false,
    };
  });

  const vouches: Vouch[] = rows.vouches
    .filter((v) => v.revoked_at === null)
    .map((v) => ({
      from: v.from_addr.toLowerCase() as Address,
      to: v.to_addr.toLowerCase() as Address,
      atMs: new Date(v.created_at).getTime(),
    }));

  return {
    edges,
    vouches,
    seeds: rows.seeds.map((s) => ({
      address: s.address.toLowerCase() as Address,
      weight: Number(s.weight),
    })),
    slashed: rows.slashes.map((s) => s.subject.toLowerCase() as Address),
    nowMs,
  };
}
```

- [ ] **Step 7: Tambahkan port trust**

Tambahkan di akhir `apps/api/src/ports.ts`:
```ts
import type { TrustGraph, TrustResult } from "@nearly/trust";

export type TrustStore = {
  loadGraph(nowMs: number): Promise<TrustGraph>;
  saveSnapshots(rows: TrustResult[], computedAt: number): Promise<void>;
  getSnapshot(addr: Address): Promise<TrustResult | null>;
  /** address -> tier yang terakhir benar-benar ditulis on-chain. */
  listPublishedTiers(): Promise<Map<string, number>>;
  markPublished(
    rows: { address: Address; tier: number; score: number; txHash: Hex }[],
  ): Promise<void>;
};

export type VouchStore = {
  countVouchesSince(from: Address, sinceMs: number): Promise<number>;
  hasVouch(from: Address, to: Address): Promise<boolean>;
  recordVouch(row: {
    from: Address; to: Address; tags: string[]; tagsHash: Hex; txHash: Hex;
  }): Promise<void>;
  markRevoked(from: Address, to: Address): Promise<void>;
};

export type ReportRow = { reporter: Address; subject: Address; atMs: number };

export type ReportStore = {
  recordReport(row: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
  }): Promise<void>;
  listReports(subject: Address): Promise<ReportRow[]>;
  setReportStatus(subject: Address, status: string): Promise<void>;
  recordSlash(subject: Address, txHash: Hex): Promise<void>;
};

export type AttestorPort = {
  setScore(who: Address, score: number, tier: number): Promise<Hex>;
};

export type VouchChainPort = {
  submitVouch(args: {
    from: Address; to: Address; tagsHash: Hex; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitRevoke(args: {
    from: Address; to: Address; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitSlash(subject: Address): Promise<Hex>;
};
```

- [ ] **Step 8: Implementasi adapter Supabase**

`apps/api/src/trust/store.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { TrustResult } from "@nearly/trust";
import type { ReportStore, TrustStore, VouchStore } from "../ports";
import { rowsToGraph } from "./load-graph";

type Res<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(res: Res<T[]>, what: string): T[] {
  if (res.error) throw new Error(`${what} gagal: ${res.error.message}`);
  return res.data ?? [];
}

export function createTrustStore(db: SupabaseClient): TrustStore {
  return {
    async loadGraph(nowMs) {
      const [connections, vouches, seeds, slashes] = await Promise.all([
        db.from("connections").select("addr_a, addr_b, cell, created_at"),
        db.from("vouches").select("from_addr, to_addr, created_at, revoked_at"),
        db.from("trust_seeds").select("address, weight"),
        db.from("slashes").select("subject"),
      ]);
      return rowsToGraph(
        {
          connections: unwrap(connections as never, "baca koneksi"),
          vouches: unwrap(vouches as never, "baca vouch"),
          seeds: unwrap(seeds as never, "baca seed"),
          slashes: unwrap(slashes as never, "baca slash"),
        },
        nowMs,
      );
    },

    async saveSnapshots(rows, computedAt) {
      if (rows.length === 0) return;
      const { error } = await db.from("trust_snapshots").upsert(
        rows.map((r) => ({
          address: r.address.toLowerCase(),
          score: r.score,
          ratio: r.ratio,
          tier: r.tier,
          connections: r.evidence.connections,
          occasions: r.evidence.occasions,
          regions: r.evidence.regions,
          vouches: r.evidence.vouches,
          operator_cluster: r.operatorCluster,
          computed_at: new Date(computedAt).toISOString(),
        })),
        { onConflict: "address" },
      );
      if (error) throw new Error(`simpan snapshot gagal: ${error.message}`);
    },

    async getSnapshot(addr) {
      const { data, error } = await db
        .from("trust_snapshots")
        .select("*")
        .eq("address", addr.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca snapshot gagal: ${error.message}`);
      if (!data) return null;
      return {
        address: data.address as Address,
        score: Number(data.score),
        ratio: Number(data.ratio),
        tier: data.tier as TrustResult["tier"],
        evidence: {
          connections: data.connections as number,
          occasions: data.occasions as number,
          regions: data.regions as number,
          vouches: data.vouches as number,
        },
        operatorCluster: (data.operator_cluster as string | null) ?? null,
      };
    },

    async listPublishedTiers() {
      const { data, error } = await db.from("trust_published").select("address, tier");
      if (error) throw new Error(`baca publikasi gagal: ${error.message}`);
      return new Map((data ?? []).map((r) => [r.address as string, r.tier as number]));
    },

    async markPublished(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("trust_published").upsert(
        rows.map((r) => ({
          address: r.address.toLowerCase(),
          tier: r.tier,
          score: r.score,
          tx_hash: r.txHash,
          published_at: new Date().toISOString(),
        })),
        { onConflict: "address" },
      );
      if (error) throw new Error(`catat publikasi gagal: ${error.message}`);
    },
  };
}

export function createVouchStore(db: SupabaseClient): VouchStore {
  return {
    async countVouchesSince(from, sinceMs) {
      const { count, error } = await db
        .from("vouches")
        .select("from_addr", { count: "exact", head: true })
        .eq("from_addr", from.toLowerCase())
        .gte("created_at", new Date(sinceMs).toISOString());
      if (error) throw new Error(`hitung kuota vouch gagal: ${error.message}`);
      return count ?? 0;
    },

    // "Pernah vouch", bukan "vouch masih aktif". Kontrak menyimpan catatan
    // vouch selamanya (satu vouch per pasangan), jadi mencoba vouch ulang
    // setelah dicabut akan revert AlreadyVouched. Menyaring revoked_at di sini
    // akan membuat API mengirim transaksi yang pasti gagal.
    async hasVouch(from, to) {
      const { count, error } = await db
        .from("vouches")
        .select("from_addr", { count: "exact", head: true })
        .eq("from_addr", from.toLowerCase())
        .eq("to_addr", to.toLowerCase());
      if (error) throw new Error(`cek vouch gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async recordVouch(row) {
      const { error } = await db.from("vouches").upsert(
        {
          from_addr: row.from.toLowerCase(),
          to_addr: row.to.toLowerCase(),
          tags: row.tags,
          tags_hash: row.tagsHash,
          tx_hash: row.txHash,
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "from_addr,to_addr" },
      );
      if (error) throw new Error(`catat vouch gagal: ${error.message}`);
    },

    async markRevoked(from, to) {
      const { error } = await db
        .from("vouches")
        .update({ revoked_at: new Date().toISOString() })
        .eq("from_addr", from.toLowerCase())
        .eq("to_addr", to.toLowerCase());
      if (error) throw new Error(`cabut vouch gagal: ${error.message}`);
    },
  };
}

export function createReportStore(db: SupabaseClient): ReportStore {
  return {
    async recordReport(row) {
      const { error } = await db.from("reports").upsert(
        {
          reporter: row.reporter.toLowerCase(),
          subject: row.subject.toLowerCase(),
          reason: row.reason,
          evidence: row.evidence ?? null,
        },
        { onConflict: "reporter,subject" },
      );
      if (error) throw new Error(`catat laporan gagal: ${error.message}`);
    },

    async listReports(subject) {
      const { data, error } = await db
        .from("reports")
        .select("reporter, subject, created_at")
        .eq("subject", subject.toLowerCase());
      if (error) throw new Error(`baca laporan gagal: ${error.message}`);
      return (data ?? []).map((r) => ({
        reporter: r.reporter as Address,
        subject: r.subject as Address,
        atMs: new Date(r.created_at as string).getTime(),
      }));
    },

    async setReportStatus(subject, status) {
      const { error } = await db
        .from("reports")
        .update({ status })
        .eq("subject", subject.toLowerCase());
      if (error) throw new Error(`ubah status laporan gagal: ${error.message}`);
    },

    async recordSlash(subject, txHash) {
      const { error } = await db.from("slashes").upsert(
        { subject: subject.toLowerCase(), tx_hash: txHash, confirmed_at: new Date().toISOString() },
        { onConflict: "subject" },
      );
      if (error) throw new Error(`catat slash gagal: ${error.message}`);
    },
  };
}
```

- [ ] **Step 9: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Diharapkan: PASS — 34 test Fase 1 tetap hijau + 10 test baru, typecheck bersih

- [ ] **Step 10: Commit**

```bash
git add supabase apps/api pnpm-lock.yaml
git commit -m "feat: skema trust + pemuat graf dari Supabase"
```

---

## Task 12: Recompute + publish — penghematan gas yang ditegakkan

**Files:**
- Create: `apps/api/src/trust/recompute.ts`, `apps/api/src/trust/attestor.ts`
- Modify: `apps/api/src/abi.ts`
- Test: `apps/api/test/recompute.test.ts`

**Interfaces:**
- Consumes: `computeTrust` (Task 6), `TrustStore`, `AttestorPort` (Task 11), `TrustAttestor` ABI (Task 10)
- Produces:
  - `SCORE_SCALE: 1_000_000`
  - `toChainScore(ratio: number): number` — 0..1.000.000, bilangan bulat
  - `changedTiers(results: TrustResult[], published: Map<string, number>): TrustResult[]`
  - `recomputeTrust(deps: { trust: TrustStore; attestor: AttestorPort; nowMs: () => number }): Promise<{ computed: number; published: number; failed: number }>`
  - `createAttestor(cfg): AttestorPort`
  - `TRUST_ATTESTOR_ABI`

`changedTiers` sengaja dipisah sebagai **fungsi murni**: inilah satu-satunya hal yang berdiri antara demo yang berjalan dan relayer kehabisan gas di tengah acara, dan hal seperti itu tidak boleh hanya diuji lewat integrasi.

- [ ] **Step 1: Tulis test yang gagal**

`apps/api/test/recompute.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/api test recompute`
Diharapkan: FAIL — `Cannot find module '../src/trust/recompute'`

- [ ] **Step 3: Implementasi**

`apps/api/src/trust/recompute.ts`:
```ts
import { computeTrust, type TrustResult } from "@nearly/trust";
import type { Address, Hex } from "viem";
import type { AttestorPort, TrustStore } from "../ports";

/** WAJIB sama dengan SCORE_SCALE di TrustAttestor.sol. */
export const SCORE_SCALE = 1_000_000;

export function toChainScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(SCORE_SCALE, Math.round(ratio * SCORE_SCALE));
}

/**
 * Penyaring yang membuat demo ini mampu dibiayai.
 *
 * PageRank bersifat global: satu salaman menggeser skor hampir semua orang
 * sedikit-sedikit. Kalau setiap pergeseran ditulis on-chain, satu ruangan berisi
 * 100 orang menghasilkan ~10.000 transaksi, sementara saldo relayer cukup untuk
 * puluhan. Yang benar-benar berarti bagi siapa pun yang membaca chain adalah
 * PERPINDAHAN TIER, bukan pergeseran 0.0001 di belakang koma.
 *
 * Murni dengan sengaja: ini satu-satunya hal yang berdiri antara demo yang
 * berjalan dan relayer kehabisan gas di tengah acara.
 */
export function changedTiers(
  results: TrustResult[],
  published: Map<string, number>,
): TrustResult[] {
  return results.filter((r) => published.get(r.address.toLowerCase()) !== r.tier);
}

export type RecomputeDeps = {
  trust: TrustStore;
  attestor: AttestorPort;
  nowMs: () => number;
};

export async function recomputeTrust(
  deps: RecomputeDeps,
  opts: { override?: TrustResult[] } = {},
): Promise<{ computed: number; published: number; failed: number }> {
  const now = deps.nowMs();
  const graph = await deps.trust.loadGraph(now);
  const results = opts.override ?? computeTrust(graph);

  // Snapshot disimpan untuk SEMUA alamat, tiap kali. Inilah yang dibaca
  // aplikasi, jadi skor di layar tetap bergerak hidup walau chain jarang ditulis.
  await deps.trust.saveSnapshots(results, now);

  const published = await deps.trust.listPublishedTiers();
  const perlu = changedTiers(results, published);

  const berhasil: { address: Address; tier: number; score: number; txHash: Hex }[] = [];
  let failed = 0;

  for (const r of perlu) {
    const score = toChainScore(r.ratio);
    try {
      const txHash = await deps.attestor.setScore(r.address, score, r.tier);
      berhasil.push({ address: r.address, tier: r.tier, score, txHash });
    } catch {
      // Satu tx gagal (gas habis, nonce bentrok, RPC tersendat) tidak boleh
      // menjatuhkan sisanya. Yang gagal tidak ditandai published, jadi ia akan
      // dicoba lagi pada recompute berikutnya dengan sendirinya.
      failed++;
    }
  }

  await deps.trust.markPublished(berhasil);
  return { computed: results.length, published: berhasil.length, failed };
}
```

`apps/api/src/trust/attestor.ts`:
```ts
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { TRUST_ATTESTOR_ABI } from "../abi";
import type { AttestorPort } from "../ports";

export function createAttestor(cfg: {
  rpcUrl: string; privateKey: Hex; attestor: Address;
}): AttestorPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });

  return {
    setScore(who, score, tier) {
      return client.writeContract({
        address: cfg.attestor,
        abi: TRUST_ATTESTOR_ABI,
        functionName: "setScore",
        args: [who, score, tier],
      });
    },
  };
}
```

- [ ] **Step 4: Tambahkan ABI**

Tambahkan di akhir `apps/api/src/abi.ts`:
```ts
export const TRUST_ATTESTOR_ABI = [
  {
    type: "function",
    name: "setScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "who", type: "address" },
      { name: "score", type: "uint32" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "scores",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [
      { name: "score", type: "uint32" },
      { name: "tier", type: "uint8" },
      { name: "at", type: "uint64" },
    ],
  },
] as const;

export const VOUCH_REGISTRY_ABI = [
  {
    type: "function",
    name: "vouch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tagsHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "expiresAt", type: "uint64" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "slash",
    stateMutability: "nonpayable",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isVouched",
    stateMutability: "view",
    inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;
```

- [ ] **Step 5: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/api test`
Diharapkan: PASS — 12 test baru di `recompute.test.ts`, sisanya tetap hijau

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: recompute trust + publish on-chain hanya saat tier berubah"
```

---

## Task 13: Route trust, vouch, report, admin

**Files:**
- Create: `apps/api/src/vouch-gate.ts`, `apps/api/src/routes/trust.ts`, `apps/api/src/routes/vouch.ts`, `apps/api/src/routes/report.ts`, `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/vouch-relayer.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/routes/handshake.ts`, `.env.example`
- Test: `apps/api/test/vouch-gate.test.ts`, `apps/api/test/trust.route.test.ts`

**Interfaces:**
- Consumes: semua port Task 11, `recomputeTrust` (Task 12), skema Zod & `tagsHashOf` (Task 7), `reportGate` (Task 5)
- Produces:
  - `DAILY_VOUCH_QUOTA: 3`
  - `type TrustDeps = GateDeps & { trust: TrustStore; vouches: VouchStore; reports: ReportStore; attestor: AttestorPort; vouchChain: VouchChainPort; vouchContract: Address; adminToken: string }`
  - `submitVouch(input, deps): Promise<GateResult<{ txHash: Hex }>>`
  - `revokeVouch(input, deps): Promise<GateResult<{ txHash: Hex }>>`
  - `confirmSlash(subject, deps): Promise<GateResult<{ txHash: Hex }>>`
  - `trustRoutes(deps)`, `vouchRoutes(deps)`, `reportRoutes(deps)`, `adminRoutes(deps)`
  - `createVouchRelayer(cfg): VouchChainPort`

- [ ] **Step 1: Tulis test gerbang vouch yang gagal**

`apps/api/test/vouch-gate.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { DAILY_VOUCH_QUOTA, submitVouch } from "../src/vouch-gate";

const NOW = 1_700_000_000_000;
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const TO = "0x000000000000000000000000000000000000beef" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;

function deps(over: Record<string, unknown> = {}) {
  return {
    store: { areConnected: vi.fn(async () => true) },
    vouches: {
      countVouchesSince: vi.fn(async () => 0),
      hasVouch: vi.fn(async () => false),
      recordVouch: vi.fn(async () => {}),
      markRevoked: vi.fn(async () => {}),
    },
    vouchChain: { submitVouch: vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    vouchContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function input(over: Record<string, unknown> = {}) {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const tags = ["real builder"];
  const msg = { from: account.address, to: TO, tagsHash: tagsHashOf(tags), expiresAt };
  return {
    from: account.address,
    to: TO,
    tags,
    expiresAt,
    sig: await account.signTypedData(vouchTypedData(msg, CONTRACT)),
    ...over,
  } as never;
}

describe("submitVouch", () => {
  it("vouch yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await submitVouch(await input(), d);
    expect(r.ok).toBe(true);
  });

  it("menolak vouch ke orang yang belum pernah ditemui", async () => {
    const d = deps({ store: { areConnected: vi.fn(async () => false) } });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_connected", httpStatus: 422 } });
  });

  it("menolak vouch ke diri sendiri", async () => {
    const r = await submitVouch(await input({ to: account.address }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "self_vouch" } });
  });

  it("menolak tanda tangan yang tidak cocok", async () => {
    const r = await submitVouch(await input({ tags: ["tag lain"] }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("menolak kalau kuota harian sudah habis", async () => {
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => DAILY_VOUCH_QUOTA),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "quota_exceeded", httpStatus: 429 } });
  });

  it("menolak vouch ganda ke orang yang sama", async () => {
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => true),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_vouched", httpStatus: 409 } });
  });

  it("menolak yang sudah kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 10);
    const msg = {
      from: account.address, to: TO, tagsHash: tagsHashOf(["x"]), expiresAt: lampau,
    };
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const r = await submitVouch(
      await input({ tags: ["x"], expiresAt: lampau, sig }),
      deps(),
    );
    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("tidak mencatat apa pun kalau transaksi chain gagal", async () => {
    const recordVouch = vi.fn(async () => {});
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch,
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => { throw new Error("gagal"); }) },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(recordVouch).not.toHaveBeenCalled();
  });

  it("kuota harian memang 3 (spec §11.1 butir 8)", () => {
    expect(DAILY_VOUCH_QUOTA).toBe(3);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/api test vouch-gate`
Diharapkan: FAIL — `Cannot find module '../src/vouch-gate'`

- [ ] **Step 3: Implementasi gerbang vouch**

`apps/api/src/vouch-gate.ts`:
```ts
import type { Address, Hex } from "viem";
import { recoverRevokeSigner, recoverVouchSigner, tagsHashOf } from "@nearly/shared";
import { reportGate, type Report } from "@nearly/trust";
import type {
  AttestorPort, HandshakeStore, ReportStore, TrustStore, VouchChainPort, VouchStore,
} from "./ports";

/** Spec induk §11.1 butir 8: kuota harian global, bukan per-event. */
export const DAILY_VOUCH_QUOTA = 3;
const DAY_MS = 86_400_000;

export type VouchFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "self_vouch"; httpStatus: 400 }
  | { code: "not_connected"; httpStatus: 422 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "already_vouched"; httpStatus: 409 }
  | { code: "not_vouched"; httpStatus: 404 }
  | { code: "quota_exceeded"; httpStatus: 429 }
  | { code: "gate_not_passed"; httpStatus: 409 }
  | { code: "chain_error"; httpStatus: 502 };

export type VouchResult<T> = { ok: true; value: T } | { ok: false; failure: VouchFailure };

const fail = (failure: VouchFailure): { ok: false; failure: VouchFailure } =>
  ({ ok: false, failure });

export type VouchDeps = {
  store: Pick<HandshakeStore, "areConnected">;
  vouches: VouchStore;
  vouchChain: VouchChainPort;
  vouchContract: Address;
  nowMs: () => number;
};

export type VouchInput = {
  from: Address; to: Address; tags: string[]; expiresAt: bigint; sig: Hex;
};

export async function submitVouch(
  input: VouchInput, deps: VouchDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  if (input.from.toLowerCase() === input.to.toLowerCase()) {
    return fail({ code: "self_vouch", httpStatus: 400 });
  }
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  // Vouch adalah pernyataan tentang seseorang yang BENAR-BENAR kamu temui.
  // Kontrak juga menolaknya, tapi menolak di sini menghemat satu tx gagal.
  if (!(await deps.store.areConnected(input.from, input.to))) {
    return fail({ code: "not_connected", httpStatus: 422 });
  }

  const tagsHash = tagsHashOf(input.tags);
  const signer = await recoverVouchSigner(
    { from: input.from, to: input.to, tagsHash, expiresAt: input.expiresAt },
    input.sig,
    deps.vouchContract,
  );
  if (signer.toLowerCase() !== input.from.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (await deps.vouches.hasVouch(input.from, input.to)) {
    return fail({ code: "already_vouched", httpStatus: 409 });
  }

  const sejak = deps.nowMs() - DAY_MS;
  if ((await deps.vouches.countVouchesSince(input.from, sejak)) >= DAILY_VOUCH_QUOTA) {
    return fail({ code: "quota_exceeded", httpStatus: 429 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitVouch({
      from: input.from, to: input.to, tagsHash, expiresAt: input.expiresAt, sig: input.sig,
    });
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.vouches.recordVouch({
    from: input.from, to: input.to, tags: input.tags, tagsHash, txHash,
  });
  return { ok: true, value: { txHash } };
}

export type RevokeInput = { from: Address; to: Address; expiresAt: bigint; sig: Hex };

export async function revokeVouch(
  input: RevokeInput, deps: VouchDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const signer = await recoverRevokeSigner(
    { from: input.from, to: input.to, expiresAt: input.expiresAt },
    input.sig,
    deps.vouchContract,
  );
  if (signer.toLowerCase() !== input.from.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!(await deps.vouches.hasVouch(input.from, input.to))) {
    return fail({ code: "not_vouched", httpStatus: 404 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitRevoke({
      from: input.from, to: input.to, expiresAt: input.expiresAt, sig: input.sig,
    });
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.vouches.markRevoked(input.from, input.to);
  return { ok: true, value: { txHash } };
}

export type SlashDeps = {
  trust: TrustStore;
  reports: ReportStore;
  vouchChain: VouchChainPort;
  nowMs: () => number;
};

/**
 * Konfirmasi manusia atas laporan yang lolos gerbang.
 *
 * Gerbangnya dijalankan ULANG di sini, bukan dipercaya dari status yang
 * tersimpan: antara laporan masuk dan admin menekan tombol, skor pelapor bisa
 * berubah, atau mereka bisa ternyata satu klaster operator. Yang berlaku adalah
 * keadaan pada saat keputusan diambil.
 */
export async function confirmSlash(
  subject: Address, deps: SlashDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  const reports: Report[] = await deps.reports.listReports(subject);
  const snapshots = new Map<string, { ratio: number; cluster: string | null }>();

  for (const r of reports) {
    const snap = await deps.trust.getSnapshot(r.reporter);
    snapshots.set(r.reporter.toLowerCase(), {
      ratio: snap?.ratio ?? 0,
      cluster: snap?.operatorCluster ?? null,
    });
  }

  const graph = await deps.trust.loadGraph(deps.nowMs());
  const connected = new Set<string>();
  for (const e of graph.edges) {
    connected.add(`${e.a.toLowerCase()}|${e.b.toLowerCase()}`);
    connected.add(`${e.b.toLowerCase()}|${e.a.toLowerCase()}`);
  }

  const verdict = reportGate(subject, reports, {
    ratioOf: (a) => snapshots.get(a)?.ratio ?? 0,
    areConnected: (x, y) => connected.has(`${x}|${y}`),
    clusterOf: (a) => snapshots.get(a)?.cluster ?? null,
  });

  if (!verdict.passes) {
    await deps.reports.setReportStatus(subject, "ditolak");
    return fail({ code: "gate_not_passed", httpStatus: 409 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitSlash(subject);
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.reports.recordSlash(subject, txHash);
  await deps.reports.setReportStatus(subject, "terkonfirmasi");
  return { ok: true, value: { txHash } };
}
```

- [ ] **Step 4: Implementasi relayer vouch**

`apps/api/src/vouch-relayer.ts`:
```ts
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { VOUCH_REGISTRY_ABI } from "./abi";
import type { VouchChainPort } from "./ports";

export function createVouchRelayer(cfg: {
  rpcUrl: string; privateKey: Hex; registry: Address;
}): VouchChainPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });
  const base = { address: cfg.registry, abi: VOUCH_REGISTRY_ABI } as const;

  return {
    submitVouch: (a) =>
      client.writeContract({
        ...base, functionName: "vouch",
        args: [a.from, a.to, a.tagsHash, a.expiresAt, a.sig],
      }),
    submitRevoke: (a) =>
      client.writeContract({
        ...base, functionName: "revoke", args: [a.from, a.to, a.expiresAt, a.sig],
      }),
    submitSlash: (subject) =>
      client.writeContract({ ...base, functionName: "slash", args: [subject] }),
  };
}
```

- [ ] **Step 5: Tulis test route trust yang gagal**

`apps/api/test/trust.route.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import { trustRoutes } from "../src/routes/trust";

const A = "0x000000000000000000000000000000000000000a" as Address;

function app(snapshot: unknown) {
  return trustRoutes({
    trust: { getSnapshot: vi.fn(async () => snapshot) },
  } as never);
}

describe("GET /trust/:address", () => {
  it("mengembalikan tier, label, dan bukti", async () => {
    const res = await app({
      address: A, score: 0.4, ratio: 0.4, tier: 2,
      evidence: { connections: 47, occasions: 6, regions: 3, vouches: 12 },
      operatorCluster: null,
    }).request(`/trust/${A}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe(2);
    expect(body.tierLabel).toBe(TIER_LABELS[2]);
    expect(body.evidence.connections).toBe(47);
  });

  it("alamat yang belum pernah dihitung mengembalikan tier Baru, bukan 404", async () => {
    const res = await app(null).request(`/trust/${A}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe(0);
    expect(body.tierLabel).toBe("Baru");
    expect(body.evidence.connections).toBe(0);
  });

  it("menolak alamat yang tidak sah", async () => {
    const res = await app(null).request("/trust/bukan-alamat");
    expect(res.status).toBe(400);
  });

  it("TIDAK membocorkan skor mentah", async () => {
    const res = await app({
      address: A, score: 0.4, ratio: 0.4, tier: 2,
      evidence: { connections: 1, occasions: 1, regions: 1, vouches: 0 },
      operatorCluster: "0xabc",
    }).request(`/trust/${A}`);
    const body = await res.json();
    // Spec induk §8: tampilkan tier + bukti, bukan angka telanjang. Klaster
    // operator juga tidak dibuka — itu tuduhan, dan gerbangnya belum dilewati.
    expect(body.score).toBeUndefined();
    expect(body.operatorCluster).toBeUndefined();
  });
});
```

- [ ] **Step 6: Implementasi route**

`apps/api/src/routes/trust.ts`:
```ts
import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import type { TrustStore } from "../ports";

const KOSONG = { connections: 0, occasions: 0, regions: 0, vouches: 0 };

export function trustRoutes(deps: { trust: Pick<TrustStore, "getSnapshot"> }) {
  const r = new Hono();

  r.get("/trust/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);

    const snap = await deps.trust.getSnapshot(raw.toLowerCase() as Address);
    const tier = snap?.tier ?? 0;

    // Sengaja TIDAK mengirim score, ratio, atau operatorCluster.
    // Spec induk §8: tier + bukti, bukan angka telanjang — angka peringkat
    // telanjang menghidupkan lagi kecemasan ala Nosedive.
    return c.json({
      address: raw.toLowerCase(),
      tier,
      tierLabel: TIER_LABELS[tier],
      evidence: snap?.evidence ?? KOSONG,
    });
  });

  return r;
}
```

`apps/api/src/routes/vouch.ts`:
```ts
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { RevokeRequestSchema, VouchRequestSchema } from "@nearly/shared";
import { revokeVouch, submitVouch, type VouchDeps } from "../vouch-gate";

export function vouchRoutes(deps: VouchDeps & { onChanged: () => Promise<void> }) {
  const r = new Hono();

  r.post("/vouch", async (c) => {
    const parsed = VouchRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const result = await submitVouch(
      {
        from: b.from as Address, to: b.to as Address, tags: b.tags,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  r.post("/vouch/revoke", async (c) => {
    const parsed = RevokeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const result = await revokeVouch(
      {
        from: b.from as Address, to: b.to as Address,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
```

`apps/api/src/routes/report.ts`:
```ts
import { Hono } from "hono";
import type { Address } from "viem";
import { ReportRequestSchema } from "@nearly/shared";
import type { ReportStore } from "../ports";

export function reportRoutes(deps: { reports: ReportStore }) {
  const r = new Hono();

  r.post("/report", async (c) => {
    const parsed = ReportRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    await deps.reports.recordReport({
      reporter: b.reporter as Address,
      subject: b.subject as Address,
      reason: b.reason,
      evidence: b.evidence,
    });

    // TIDAK ada perhitungan ulang trust di sini, dengan sengaja. Laporan tidak
    // pernah menurunkan trust — ia hanya memicu peninjauan (spec fase §6).
    return c.json({ ok: true, status: "diterima" });
  });

  return r;
}
```

`apps/api/src/routes/admin.ts`:
```ts
import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import { confirmSlash, type SlashDeps } from "../vouch-gate";

export function adminRoutes(
  deps: SlashDeps & { adminToken: string; onChanged: () => Promise<void> },
) {
  const r = new Hono();

  r.post("/admin/slash/:address", async (c) => {
    // Token dibandingkan lengkap, dan header yang hilang tidak boleh cocok
    // dengan token kosong.
    const token = c.req.header("x-admin-token") ?? "";
    if (deps.adminToken.length === 0 || token !== deps.adminToken) {
      return c.json({ code: "unauthorized" }, 401);
    }

    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);

    const result = await confirmSlash(raw.toLowerCase() as Address, deps);
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
```

- [ ] **Step 6b: Tulis test pemicu recompute dan test laporan yang gagal**

Dua baris di spec fase §11 belum punya rumah: *"recompute terpanggil setelah handshake dan
vouch berhasil"* dan *"`POST /report` tidak pernah mengubah skor secara langsung"*. Keduanya
menguji hal yang tidak terlihat dari luar, jadi harus diuji lewat pemanggilannya.

Tambahkan di `apps/api/test/trust.route.test.ts`:
```ts
import { reportRoutes } from "../src/routes/report";
import { vouchRoutes } from "../src/routes/vouch";

describe("pemicu recompute", () => {
  it("vouch yang berhasil memicu recompute tepat sekali", async () => {
    const onChanged = vi.fn(async () => {});
    const app = vouchRoutes({
      store: { areConnected: vi.fn(async () => true) },
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => "0xtx") },
      vouchContract: CONTRACT,
      nowMs: () => NOW,
      onChanged,
    } as never);

    await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VOUCH_BODY),
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("vouch yang DITOLAK tidak memicu recompute", async () => {
    const onChanged = vi.fn(async () => {});
    const app = vouchRoutes({
      store: { areConnected: vi.fn(async () => false) },
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => "0xtx") },
      vouchContract: CONTRACT,
      nowMs: () => NOW,
      onChanged,
    } as never);

    await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VOUCH_BODY),
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("POST /report", () => {
  // Test ini WAJIB dibangun lewat createApp, bukan lewat reportRoutes langsung.
  //
  // Versi sebelumnya membuat dua vi.fn() lokal dan menegaskan keduanya tidak
  // terpanggil — padahal keduanya tidak pernah disambungkan ke apa pun, jadi
  // assertion-nya benar apa pun yang dilakukan route. Test yang tidak bisa
  // gagal lebih buruk daripada tidak ada test, karena ia terlihat seperti
  // perlindungan. Spy HARUS spy yang sama yang dipakai jalur recompute
  // sungguhan, dan test kedua di bawah membuktikan spy itu memang terjangkau.
  it("GERBANG: laporan mencatat, tapi TIDAK menyentuh skor sama sekali", async () => {
    const saveSnapshots = vi.fn(async () => {});
    const setScore = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const recordReport = vi.fn(async () => {});
    const app = createApp(depsFor({ saveSnapshots, setScore, recordReport }));

    const res = await app.request("/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reporter: A, subject: B, reason: "menjual token palsu di venue",
      }),
    });

    expect(res.status).toBe(200);
    expect(recordReport).toHaveBeenCalledTimes(1);
    // Spec induk §6: laporan TIDAK PERNAH menurunkan trust secara langsung.
    expect(saveSnapshots).not.toHaveBeenCalled();
    expect(setScore).not.toHaveBeenCalled();
  });

  it("spy yang sama TERPANGGIL lewat jalur yang memang memicu recompute", async () => {
    // Tanpa test ini, test di atas bisa lolos hanya karena spy-nya tidak
    // terjangkau. Ini yang membuktikan spy-nya hidup.
    const saveSnapshots = vi.fn(async () => {});
    const setScore = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const app = createApp(depsFor({ saveSnapshots, setScore }));

    const res = await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await signedVouchBody()),
    });

    expect(res.status).toBe(200);
    expect(saveSnapshots).toHaveBeenCalled();
  });
});
```

Dua helper yang dipakai blok di atas — `depsFor(overrides)` dan `signedVouchBody()` — kamu
tulis sendiri di berkas test ini:

- **`depsFor(overrides)`** mengembalikan `TrustDeps` lengkap yang diterima `createApp`, dengan
  seluruh port distub sebagai `vi.fn()`. Pakai kembali pola `deps()` yang sudah kamu buat di
  `handshake.route.test.ts`. Yang penting: `trust.saveSnapshots` dan `attestor.setScore` harus
  memakai spy yang dioper lewat `overrides`, supaya assertion di atas benar-benar mengamati
  jalur yang sama dengan yang dipakai `onChanged`. `trust.loadGraph` mengembalikan graf minimal
  berisi satu seed, dan `store.areConnected` mengembalikan `true` supaya jalur vouch bisa lewat.
- **`signedVouchBody()`** menghasilkan badan permintaan vouch yang tanda tangannya sah, dengan
  pola yang sama seperti helper `input()` di `vouch-gate.test.ts`: `privateKeyToAccount` +
  `vouchTypedData`, memakai `vouchContract` yang sama dengan yang dikembalikan `depsFor`.

Lengkapi juga berkas test dengan konstanta yang dipakai di atas, di bawah deklarasi `A` yang
sudah ada:
```ts
const B = "0x000000000000000000000000000000000000000b" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const NOW = 1_700_000_000_000;

// Badan permintaan vouch yang tanda tangannya SENGAJA tidak sah, dipakai HANYA
// oleh test "vouch yang DITOLAK tidak memicu recompute". Test pemicu yang
// positif memakai signedVouchBody(), karena vouch yang ditolak tidak pernah
// sampai ke onChanged.
const VOUCH_BODY_INVALID = {
  from: A, to: B, tags: ["zk"],
  expiresAt: String(Math.floor(NOW / 1000) + 3600),
  sig: `0x${"1".repeat(130)}`,
};
```

Karena tanda tangan pada `VOUCH_BODY` tidak sah, test pertama akan **gagal** sampai kamu
mengganti `VOUCH_BODY` dengan badan bertanda tangan sungguhan — pakai pola yang sama seperti
helper `input()` di `vouch-gate.test.ts` (`privateKeyToAccount` + `vouchTypedData`). Lakukan
itu sebagai bagian dari langkah ini; jangan melonggarkan assertion-nya.

- [ ] **Step 7: Rakit di `app.ts` dan `index.ts`**

Di `apps/api/src/app.ts`, perluas `createApp` untuk menerima dependensi trust dan memasang keempat route baru. Recompute dipicu lewat satu fungsi `onChanged` yang dibagikan ke route vouch, admin, dan handshake:

```ts
import { recomputeTrust } from "./trust/recompute";
// ...di dalam createApp, setelah deps lengkap:
const onChanged = async () => {
  try {
    await recomputeTrust({ trust: deps.trust, attestor: deps.attestor, nowMs: deps.nowMs });
  } catch (e) {
    // Perhitungan ulang yang gagal TIDAK boleh menggagalkan handshake atau
    // vouch yang sudah tercetak on-chain. Skor akan menyusul pada pemicu
    // berikutnya; koneksinya sendiri sudah permanen.
    console.error("recompute gagal:", e);
  }
};

app.route("/", trustRoutes(deps));
app.route("/", vouchRoutes({ ...deps, onChanged }));
app.route("/", reportRoutes(deps));
app.route("/", adminRoutes({ ...deps, onChanged }));
```

Panggil `onChanged()` juga setelah `POST /handshake/accept` berhasil, di `routes/handshake.ts` — koneksi baru menggeser graf, dan itulah pemicu utama sesuai keputusan cadence.

Di `apps/api/src/index.ts`, tambahkan pembacaan env dan perakitan store baru:
```ts
const vouchRegistry = required("VOUCH_REGISTRY_ADDRESS") as Address;
const trustAttestorAddress = required("TRUST_ATTESTOR_ADDRESS") as Address;

// ...tambahkan ke objek createApp({...}):
trust: createTrustStore(supabase),
vouches: createVouchStore(supabase),
reports: createReportStore(supabase),
attestor: createAttestor({
  rpcUrl: required("RPC_URL"),
  privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
  attestor: trustAttestorAddress,
}),
vouchChain: createVouchRelayer({
  rpcUrl: required("RPC_URL"),
  privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
  registry: vouchRegistry,
}),
vouchContract: vouchRegistry,
adminToken: required("ADMIN_TOKEN"),
```

- [ ] **Step 8: Tambahkan env baru**

Di `.env.example`, tambahkan di bawah blok BSC testnet:
```
VOUCH_REGISTRY_ADDRESS=
TRUST_ATTESTOR_ADDRESS=
NEARLY_RESOLVER_ADDRESS=
# Token untuk POST /admin/slash. Acak dan panjang; JANGAN pernah masuk bundle mobile.
ADMIN_TOKEN=
```

- [ ] **Step 9: Jalankan seluruh test API, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Diharapkan: PASS — seluruh test Fase 1 tetap hijau + 16 test baru (9 `vouch-gate`, 7 `trust.route`)

- [ ] **Step 10: Commit**

```bash
git add apps/api .env.example
git commit -m "feat: endpoint trust, vouch, laporan, dan konfirmasi slash"
```

---

## Task 14: Deploy tiga kontrak + isi seed + verifikasi manual

Task ini **bergantung pada hal di luar kode**: dompet relayer harus berisi tBNB testnet. Catatan akhir Fase 1 mencatat saldo tersisa ~53 handshake, dan sekarang ada tiga kontrak untuk di-deploy plus penulisan skor. **Ambil faucet BSC testnet sebelum memulai task ini**, jangan menjelang demo.

**Files:**
- Modify: `packages/contracts/script/Deploy.s.sol`
- Create: `apps/api/tools/seed.ts`, `apps/api/tools/recompute.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: ketiga kontrak (Task 8, 10), `createTrustStore` (Task 11), `recomputeTrust` (Task 12)
- Produces: alamat ter-deploy di `.env`; baris di `trust_seeds`

- [ ] **Step 1: Perluas skrip deploy**

`packages/contracts/script/Deploy.s.sol` — ganti isinya:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ConnectionRegistry} from "../src/ConnectionRegistry.sol";
import {NearlyResolver} from "../src/NearlyResolver.sol";
import {TrustAttestor} from "../src/TrustAttestor.sol";
import {VouchRegistry} from "../src/VouchRegistry.sol";

/**
 * ConnectionRegistry sudah ter-deploy sejak Fase 1 dan TIDAK boleh di-deploy
 * ulang — mencetaknya lagi akan mengosongkan seluruh graf koneksi yang sudah
 * ada. Alamatnya dibaca dari env.
 */
contract DeployPhase2 is Script {
    function run()
        external
        returns (VouchRegistry vouch, TrustAttestor attestorContract, NearlyResolver resolver)
    {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        address connections = vm.envAddress("CONNECTION_REGISTRY_ADDRESS");

        vm.startBroadcast();
        vouch = new VouchRegistry(attestor, connections);
        attestorContract = new TrustAttestor(attestor);
        resolver = new NearlyResolver(connections, address(vouch), address(attestorContract));
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2: Deploy**

```bash
cd packages/contracts && forge script script/Deploy.s.sol:DeployPhase2 --rpc-url "$RPC_URL" --broadcast
```

Salin ketiga alamat hasilnya ke `.env`: `VOUCH_REGISTRY_ADDRESS`, `TRUST_ATTESTOR_ADDRESS`, `NEARLY_RESOLVER_ADDRESS`.

- [ ] **Step 3: Verifikasi `DOMAIN_SEPARATOR` VouchRegistry cocok dengan viem**

Ini pemeriksaan yang sama yang menyelamatkan Fase 1. Kalau tidak cocok, setiap vouch akan ditolak `BadSignature` tanpa petunjuk penyebabnya.

```bash
cast call "$VOUCH_REGISTRY_ADDRESS" "DOMAIN_SEPARATOR()(bytes32)" --rpc-url "$RPC_URL"
```

Bandingkan dengan hasil viem:
```bash
cd apps/api && ./node_modules/.bin/tsx -e "
import { domainSeparator } from 'viem';
console.log(domainSeparator({ domain: {
  name: 'Nearly', version: '1', chainId: 97,
  verifyingContract: process.env.VOUCH_REGISTRY_ADDRESS,
}}));
"
```
Diharapkan: dua nilai identik. Kalau berbeda, **berhenti** dan periksa `NEARLY_CHAIN_ID` serta alamat kontrak sebelum melanjutkan.

- [ ] **Step 4: Terapkan migrasi**

```bash
supabase db push
```

Atau tempel isi `supabase/migrations/0002_trust.sql` ke SQL editor di dashboard Supabase.

- [ ] **Step 5: Tulis alat pengisi seed**

`apps/api/tools/seed.ts`:
```ts
/**
 * Mengisi trust_seeds. Ini SATU-SATUNYA kepercayaan yang disuntik manusia ke
 * seluruh sistem — semua angka lain dihitung darinya.
 *
 * Pakai: tsx tools/seed.ts 0xalamat "catatan kenapa dipercaya" [bobot]
 */
import { createSupabase } from "../src/db";

const [address, note = "", weight = "1"] = process.argv.slice(2);
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("Pakai: tsx tools/seed.ts <alamat> [catatan] [bobot]");
  process.exit(1);
}

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const { error } = await db.from("trust_seeds").upsert(
  { address: address.toLowerCase(), note, weight: Number(weight) },
  { onConflict: "address" },
);

if (error) {
  console.error("gagal:", error.message);
  process.exit(1);
}
console.log(`seed ditambahkan: ${address.toLowerCase()} (bobot ${weight})`);
```

`apps/api/tools/recompute.ts`:
```ts
/**
 * Memicu perhitungan ulang trust dari terminal. Berguna setelah mengubah seed,
 * dan sebagai jaring pengaman kalau pemicu otomatis pernah gagal.
 *
 * Pakai: tsx tools/recompute.ts
 */
import type { Address, Hex } from "viem";
import { createSupabase } from "../src/db";
import { createAttestor } from "../src/trust/attestor";
import { createTrustStore } from "../src/trust/store";
import { recomputeTrust } from "../src/trust/recompute";

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const out = await recomputeTrust({
  trust: createTrustStore(db),
  attestor: createAttestor({
    rpcUrl: process.env.RPC_URL!,
    privateKey: process.env.RELAYER_PRIVATE_KEY! as Hex,
    attestor: process.env.TRUST_ATTESTOR_ADDRESS! as Address,
  }),
  nowMs: () => Date.now(),
});

console.log(
  `dihitung ${out.computed} alamat · dipublikasi ${out.published} · gagal ${out.failed}`,
);
```

- [ ] **Step 6: Isi seed dan jalankan perhitungan pertama**

```bash
cd apps/api && set -a && . ../../.env && set +a && ./node_modules/.bin/tsx tools/seed.ts "$SEED_ADDRESS" "pemilik project"
```

```bash
cd apps/api && set -a && . ../../.env && set +a && ./node_modules/.bin/tsx tools/recompute.ts
```

Diharapkan: keluaran menyebut jumlah alamat yang dihitung, dan `dipublikasi` sama dengan jumlah alamat yang tier-nya bukan yang sudah tercatat (pada jalan pertama: semuanya).

- [ ] **Step 7: Verifikasi manual — inilah bukti Fase 2 bekerja**

Empat pemeriksaan, semua harus lulus:

1. **Seed berdiri tinggi.**
   ```bash
   curl -s "$API_URL/trust/$SEED_ADDRESS" | jq
   ```
   Diharapkan: `"tier"` bernilai **2 atau 3** (`Terpercaya` atau `Inti`). Jangan menuntut
   `Inti`: penyebut rasio adalah skor tertinggi di graf, dan peserta yang paling banyak
   bersalaman bisa saja melampaui seed. Itu perilaku yang benar, bukan kerusakan.

2. **Alamat asing berdiri di `Baru`.**
   ```bash
   curl -s "$API_URL/trust/0x000000000000000000000000000000000000dead" | jq
   ```
   Diharapkan: `"tier": 0`, `"tierLabel": "Baru"`, seluruh bukti nol.

3. **Skor benar-benar ada di chain.**
   ```bash
   cast call "$NEARLY_RESOLVER_ADDRESS" "getTier(address)(uint8)" "$SEED_ADDRESS" --rpc-url "$RPC_URL"
   ```
   Diharapkan: `3`. Ini membuktikan `NearlyResolver` bisa dibaca dApp lain — janji §10.3.

4. **Penulisan berulang tidak menghabiskan gas.** Jalankan `tools/recompute.ts` dua kali berturut-turut tanpa mengubah apa pun.
   Diharapkan: jalan kedua melaporkan **`dipublikasi 0`**. Kalau angkanya bukan nol, penghematan gas di spec fase §7.1 tidak bekerja — **berhenti dan perbaiki `changedTiers` sebelum melanjutkan**, karena kalau lolos, relayer akan kehabisan gas di tengah demo.

- [ ] **Step 8: Tambahkan `SEED_ADDRESS` ke `.env.example`**

```
# Alamat yang menjadi seed set. Dipakai alat tools/seed.ts.
SEED_ADDRESS=
```

- [ ] **Step 9: Commit**

```bash
git add packages/contracts apps/api/tools .env.example
git commit -m "feat: deploy tiga kontrak Fase 2 + alat seed dan recompute"
```

---

## Task 15: Mobile — tier, bukti, vouch, lapor

**Files:**
- Create: `apps/mobile/src/tier.ts`, `apps/mobile/src/trust-api.ts`
- Modify: `apps/mobile/app/profile/[address].tsx`, `apps/mobile/src/config.ts`,
  `apps/mobile/src/signer.ts`, `apps/mobile/src/wallet-signer.ts`, `apps/mobile/package.json`
- Test: `apps/mobile/test/tier.test.ts`

**Interfaces:**
- Consumes: `GET /trust/:address`, `POST /vouch`, `POST /report` (Task 13); `vouchTypedData`, `tagsHashOf` (Task 7)
- Produces:
  - `type TierView = { label: string; evidenceLine: string }`
  - `tierView(tier: number, evidence: TrustEvidenceView): TierView`
  - `SUGGESTED_TAGS: readonly string[]`
  - `fetchTrust(address): Promise<TrustResponse>`
  - `sendVouch(signer, to, tags): Promise<void>`
  - `sendReport(reporter, subject, reason): Promise<void>`

- [ ] **Step 1: Tulis test yang gagal**

`apps/mobile/test/tier.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SUGGESTED_TAGS, tierView } from "../src/tier";

const bukti = { connections: 47, occasions: 6, regions: 3, vouches: 12 };

describe("tierView", () => {
  it("menyusun label dan baris bukti sesuai spec §8", () => {
    const v = tierView(2, bukti);
    expect(v.label).toBe("Terpercaya");
    expect(v.evidenceLine).toBe("47 koneksi · 6 occasion · 3 wilayah · 12 vouch");
  });

  it("pengguna baru tanpa apa pun tetap punya baris bukti yang jujur", () => {
    const v = tierView(0, { connections: 0, occasions: 0, regions: 0, vouches: 0 });
    expect(v.label).toBe("Baru");
    expect(v.evidenceLine).toBe("belum ada koneksi");
  });

  it("menghilangkan bagian yang bernilai nol, bukan menulis '0 vouch'", () => {
    const v = tierView(1, { connections: 3, occasions: 1, regions: 1, vouches: 0 });
    expect(v.evidenceLine).toBe("3 koneksi · 1 occasion · 1 wilayah");
  });

  it("tier di luar rentang jatuh ke Baru, bukan undefined", () => {
    expect(tierView(9, bukti).label).toBe("Baru");
    expect(tierView(-1, bukti).label).toBe("Baru");
  });

  it("tag saran ada dan tidak kosong", () => {
    expect(SUGGESTED_TAGS.length).toBeGreaterThan(0);
    for (const t of SUGGESTED_TAGS) expect(t.trim()).toBe(t);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Jalankan: `pnpm --filter @nearly/mobile test tier`
Diharapkan: FAIL — `Cannot find module '../src/tier'`

- [ ] **Step 3: Tambahkan dependensi paket trust ke mobile**

`tier.ts` mengimpor `TIER_LABELS` dari `@nearly/trust`, sedangkan `apps/mobile/package.json`
baru punya `@nearly/shared`. Tambahkan ke `dependencies`:
```json
"@nearly/trust": "workspace:*"
```
Lalu jalankan `pnpm install` dari akar repo. Tanpa ini, test lolos di Vitest (yang mengikuti
tsconfig paths) tapi **Metro gagal memuat aplikasi di HP** — persis kelas kesalahan yang
tercatat di catatan Fase 1 butir 8.

- [ ] **Step 4: Implementasi**

`apps/mobile/src/tier.ts`:
```ts
import { TIER_LABELS } from "@nearly/trust";

export type TrustEvidenceView = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TierView = { label: string; evidenceLine: string };

/** Spec induk §7.3: tag itu deskriptif dan positif-saja. Tidak ada tag negatif. */
export const SUGGESTED_TAGS = [
  "real builder",
  "solid dev",
  "paham zk",
  "desainer",
  "riset",
] as const;

/**
 * Tier SELALU tampil bersama buktinya (spec induk §8). Angka peringkat telanjang
 * menghidupkan lagi kecemasan ala Nosedive; fakta konkret lebih jujur dan lebih
 * berguna bagi orang yang sedang memutuskan apakah akan bicara dengan seseorang.
 */
export function tierView(tier: number, evidence: TrustEvidenceView): TierView {
  const label = TIER_LABELS[tier] ?? TIER_LABELS[0];

  const bagian: string[] = [];
  if (evidence.connections > 0) bagian.push(`${evidence.connections} koneksi`);
  if (evidence.occasions > 0) bagian.push(`${evidence.occasions} occasion`);
  if (evidence.regions > 0) bagian.push(`${evidence.regions} wilayah`);
  if (evidence.vouches > 0) bagian.push(`${evidence.vouches} vouch`);

  // "0 vouch" terbaca seperti tuduhan. Pengguna baru cukup dibilang apa adanya.
  return { label, evidenceLine: bagian.length > 0 ? bagian.join(" · ") : "belum ada koneksi" };
}
```

`apps/mobile/src/trust-api.ts`:
```ts
import type { Address } from "viem";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import type { NearlySigner } from "./signer";
import type { TrustEvidenceView } from "./tier";

export type TrustResponse = {
  address: string;
  tier: number;
  tierLabel: string;
  evidence: TrustEvidenceView;
};

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new Error(detail?.code ?? `gagal (${res.status})`);
  }
}

export async function fetchTrust(address: Address): Promise<TrustResponse> {
  const res = await fetch(`${CONFIG.apiUrl}/trust/${address}`);
  if (!res.ok) throw new Error(`gagal membaca trust (${res.status})`);
  return (await res.json()) as TrustResponse;
}

export async function sendVouch(
  signer: NearlySigner, to: Address, tags: string[],
): Promise<void> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const msg = {
    from: signer.address, to, tagsHash: tagsHashOf(tags), expiresAt,
  };
  const sig = await signer.signTypedData(
    vouchTypedData(msg, CONFIG.vouchRegistry),
  );
  await post("/vouch", {
    from: signer.address, to, tags, expiresAt: expiresAt.toString(), sig,
  });
}

export async function sendReport(
  reporter: Address, subject: Address, reason: string,
): Promise<void> {
  await post("/report", { reporter, subject, reason });
}
```

- [ ] **Step 5: Perluas `NearlySigner` dan `CONFIG`**

`sendVouch` memanggil `signer.signTypedData`, sedangkan `NearlySigner` dari Fase 1 hanya punya `signOffer` dan `signAccept`. Tambahkan satu method generik `signTypedData(data: unknown): Promise<Hex>` ke tipe `NearlySigner` di `apps/mobile/src/signer.ts`, lalu implementasikan di `createDevSigner` (pakai `account.signTypedData`) dan di `createWalletSigner` (teruskan ke `signTypedDataAsync`). Method lama tetap ada supaya alur handshake tidak tersentuh.

Di `apps/mobile/src/config.ts`, tambahkan:
```ts
vouchRegistry: process.env.EXPO_PUBLIC_VOUCH_REGISTRY as Address,
```

Di `apps/mobile/.env` dan `.env.example`, tambahkan:
```
EXPO_PUBLIC_VOUCH_REGISTRY=
```

- [ ] **Step 6: Pasang di layar profil**

Di `apps/mobile/app/profile/[address].tsx`:

1. Panggil `fetchTrust(address)` di samping panggilan profil yang sudah ada.
2. Tampilkan badge `tierView(...).label` besar, dengan `evidenceLine` tepat di bawahnya.
3. Kalau alamat yang dibuka **bukan** milik sendiri dan sudah terkoneksi, tampilkan tombol **Vouch** yang membuka pemilih `SUGGESTED_TAGS` (boleh pilih beberapa) lalu memanggil `sendVouch`. Tampilkan sisa kuota hari ini di sebelahnya — jatah yang tidak terlihat tidak terasa berharga.
4. Tampilkan tombol **Lapor** yang membuka isian alasan lalu memanggil `sendReport`. Setelah terkirim, tampilkan pesan yang jujur: **"Laporan diterima. Laporan tidak menurunkan skor siapa pun — ia memicu peninjauan."** Kalimat ini bukan hiasan: ia mencegah pengguna mengira tombol itu senjata.
5. Kalau `sendVouch` gagal dengan `quota_exceeded`, tampilkan "Jatah vouch hari ini sudah habis", bukan pesan error mentah.

Tetap tampilkan alamat/ENS berdampingan dengan nama seperti Fase 1 — aturan anti-impersonasi §9.2 tidak berubah.

- [ ] **Step 7: Jalankan test, pastikan LULUS**

Jalankan: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Diharapkan: PASS — 16 test Fase 1 tetap hijau + 5 test baru

- [ ] **Step 8: Verifikasi manual di perangkat**

Buka aplikasi, masuk ke profil orang yang sudah terkoneksi:
- badge tier dan baris bukti tampil
- tekan Vouch, pilih dua tag, kirim → tx berhasil, dan setelah beberapa detik tier orang itu naik atau buktinya bertambah `1 vouch`
- vouch keempat di hari yang sama ditolak dengan pesan kuota
- tekan Lapor, kirim → pesan "memicu peninjauan" tampil, dan skor subjek **tidak berubah**

Poin terakhir yang paling penting: kalau skor berubah setelah laporan, prinsip §6 dilanggar dan gerbangnya bocor.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile .env.example
git commit -m "feat: tampilan tier + bukti, tombol vouch dan lapor di profil"
```

---

## Setelah Semua Task Selesai

- [ ] **Jalankan seluruh test satu kali dari akar repo**

```bash
pnpm test && pnpm typecheck && (cd packages/contracts && forge test)
```

Diharapkan hijau semua: `shared` 65, `trust` 69, `api` 72, `mobile` 21, Solidity 41.
Angka-angka ini indikatif — kalau kamu menambahkan test di luar yang tertulis di rencana,
jumlahnya wajar lebih besar. Yang tidak boleh terjadi adalah **lebih kecil**.

- [ ] **Isi catatan pelaksanaan**

Tambahkan bagian `## Catatan Pelaksanaan` di akhir dokumen ini, mengikuti pola Fase 0+1: apa yang berbeda dari rencana, apa yang belum dikerjakan dan kenapa, serta apa yang masih terbuka. **Kode di repo adalah sumber kebenaran, bukan cuplikan di rencana ini** — kalau keduanya berbeda, rencananya yang salah.

- [ ] **Periksa kriteria selesai Fase 2**

Fase 2 baru boleh disebut selesai kalau ketiganya benar:

1. `pnpm --filter @nearly/trust test` hijau, **termasuk** uji gumpalan sybil dan uji brigading.
2. `curl "$API_URL/trust/<alamat asing>"` mengembalikan tier `Baru`, dan seed mengembalikan `Inti`.
3. `cast call "$NEARLY_RESOLVER_ADDRESS" "getTier(address)(uint8)"` mengembalikan nilai yang sama dengan yang dilaporkan API.

Kalau ketiganya lulus, klaim *"serangan sybil bisa didemokan dan gagal secara matematis"* sudah bisa dipertanggungjawabkan di depan juri.
