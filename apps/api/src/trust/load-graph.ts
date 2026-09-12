import type { Address } from "viem";
import type { TrustEdge, TrustGraph, Vouch } from "@nearly/trust";
import type { PasanganBlokir } from "../ports";

/**
 * Jendela 3 jam. CADANGAN, bukan lagi jalur utama: sejak Fase 3a, koneksi yang
 * kedua pihaknya check-in di sebuah event memakai id event itu (spec §9).
 * Tebakan ini hanya dipakai kalau tidak ada event yang memenuhi.
 */
export const OCCASION_WINDOW_MS = 10_800_000;

export function occasionIdOf(cell: string, atMs: number): string {
  return `${cell}:${Math.floor(atMs / OCCASION_WINDOW_MS)}`;
}

/**
 * Occasion sebuah event. FORMATNYA TIDAK BEBAS.
 *
 * regionOf() di packages/trust/src/diversity.ts membaca wilayah dengan
 * occasionId.split(":")[0].slice(0, 4). Kalau bagian pertama bukan sel
 * geohash — misalnya "evt" — maka SETIAP event menghasilkan wilayah yang sama,
 * seluruh entropi wilayah runtuh, dan orang yang hadir di banyak acara di
 * banyak kota justru kehilangan diversitasnya. Persis kebalikan dari maksud
 * faktor ini. Dikunci sebuah test di load-graph.test.ts.
 */
export function eventOccasionIdOf(centerCell: string, eventId: string): string {
  return `${centerCell}:e:${eventId}`;
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

export type CheckInRow = { event_id: string; address: string };

export type EventWindowRow = {
  event_id: string;
  center_cell: string;
  /** unix DETIK */
  starts_at: string | number;
  /** unix DETIK */
  ends_at: string | number;
};

export type GraphRows = {
  connections: ConnRow[];
  vouches: VouchRow[];
  seeds: SeedRow[];
  slashes: SlashRow[];
  checkins: CheckInRow[];
  events: EventWindowRow[];
  blocks: PasanganBlokir[];
};

/**
 * Kunci kanonik satu pasangan, urutan tidak dipedulikan. Blokir disimpan
 * berarah tapi trust cuma punya satu boolean per edge — dan itu benar, karena
 * trust tidak boleh mengalir ke arah mana pun lewat pasangan yang salah
 * satunya memblokir (spec §4).
 */
function kunciPasangan(a: string, b: string): string {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

type EventWindow = { centerCell: string; startMs: number; endMs: number };

/**
 * Satuan waktu: starts_at/ends_at DETIK, atMs MILIDETIK. Dikalikan 1000 di
 * sini, sekali, supaya tidak ada pembanding di bawah yang perlu memikirkannya.
 */
function indexEvents(rows: EventWindowRow[]): Map<string, EventWindow> {
  const m = new Map<string, EventWindow>();
  for (const e of rows) {
    m.set(e.event_id.toLowerCase(), {
      centerCell: e.center_cell,
      startMs: Number(e.starts_at) * 1000,
      endMs: Number(e.ends_at) * 1000,
    });
  }
  return m;
}

function indexCheckins(rows: CheckInRow[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of rows) {
    const addr = c.address.toLowerCase();
    let s = m.get(addr);
    if (!s) {
      s = new Set();
      m.set(addr, s);
    }
    s.add(c.event_id.toLowerCase());
  }
  return m;
}

/**
 * Spec §9: sebuah koneksi milik event E kalau — dan hanya kalau — KEDUA
 * pihaknya punya check-in terverifikasi di E, dan salamannya jatuh di jendela
 * waktu E.
 *
 * Kalau ada lebih dari satu E yang memenuhi (dua acara tumpang tindih yang
 * dihadiri keduanya), ambil event_id terkecil secara leksikografis. Aturan ini
 * sewenang-wenang tapi DETERMINISTIK, dan determinisme yang penting: skor
 * harus sama tiap kali dihitung ulang.
 */
function eventOccasionFor(
  a: string, b: string, atMs: number,
  checkins: Map<string, Set<string>>,
  events: Map<string, EventWindow>,
): string | null {
  const ea = checkins.get(a.toLowerCase());
  const eb = checkins.get(b.toLowerCase());
  if (!ea || !eb) return null;

  const cocok: string[] = [];
  for (const id of ea) {
    if (!eb.has(id)) continue;
    const w = events.get(id);
    if (!w) continue;
    if (atMs < w.startMs || atMs > w.endMs) continue;
    cocok.push(id);
  }
  if (cocok.length === 0) return null;

  cocok.sort();
  const pilihan = cocok[0]!;
  return eventOccasionIdOf(events.get(pilihan)!.centerCell, pilihan);
}

/**
 * Murni, jadi bisa diuji tanpa Supabase. Seluruh penerjemahan baris SQL ke tipe
 * domain terjadi di sini dan tidak di tempat lain.
 */
export function rowsToGraph(rows: GraphRows, nowMs: number): TrustGraph {
  const events = indexEvents(rows.events);
  const checkins = indexCheckins(rows.checkins);
  const terblokir = new Set(rows.blocks.map((b) => kunciPasangan(b.blocker, b.blocked)));

  const edges: TrustEdge[] = rows.connections.map((r, i) => {
    const atMs = new Date(r.created_at).getTime();
    const fromEvent = eventOccasionFor(r.addr_a, r.addr_b, atMs, checkins, events);
    return {
      a: r.addr_a.toLowerCase() as Address,
      b: r.addr_b.toLowerCase() as Address,
      // Event terverifikasi menang. Kalau tidak ada, tebakan geohash Fase 2.
      // Koneksi Fase 1 tercatat sebelum kolom cell ada — jangan buang, tapi
      // juga jangan satukan jadi satu occasion raksasa.
      occasionId:
        fromEvent ?? (r.cell ? occasionIdOf(r.cell, atMs) : `tanpa-sel-${i}:0`),
      atMs,
      blocked: terblokir.has(kunciPasangan(r.addr_a, r.addr_b)),
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
