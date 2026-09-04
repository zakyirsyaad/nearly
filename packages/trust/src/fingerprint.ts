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
