// Dunia di memori untuk tes rute graf dan tes konsistensi aturan acara.
// BUKAN berkas test (tidak berakhiran .test.ts).
import { vi } from "vitest";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { grafRoutes } from "../../src/routes/graf";
import { rowToAcaraGraf, rowToKoneksiGraf } from "../../src/graf-store";
import type { AcaraGraf, GrafDeps, GrafStore, KoneksiGraf, ProfilRingkas } from "../../src/ports";
import type { GraphRows } from "../../src/trust/load-graph";

/** Baris seperti di Supabase — LENGKAP dengan kolom yang tidak boleh keluar. */
export type BarisKoneksiDb = {
  id: number; addr_a: string; addr_b: string; created_at: string;
  tx_hash: string; cell: string | null; nonce: string;
};
export type BarisAcaraDb = {
  event_id: string; host: string; title: string; center_cell: string;
  starts_at: number; ends_at: number;
};
export type BarisCheckInDb = { event_id: string; address: string; cell: string; nonce: string };

export type DataDunia = {
  connections: BarisKoneksiDb[];
  events: BarisAcaraDb[];
  checkins: BarisCheckInDb[];
  blocks: { blocker: string; blocked: string }[];
  profil: Record<string, ProfilRingkas>;
};

export const NOW_GRAF = 1_790_000_000_000;

export function alamat(n: number): Address {
  return `0x${n.toString(16).padStart(40, "0")}` as Address;
}

export function idAcara(hex2: string): Hex {
  return `0x${hex2.repeat(32)}` as Hex;
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function duniaGraf(
  over: Partial<DataDunia> = {},
  opsi: { nowMs?: number; webOrigins?: string[] } = {},
) {
  const data: DataDunia = {
    connections: [], events: [], checkins: [], blocks: [], profil: {}, ...over,
  };
  const jam = { sekarang: opsi.nowMs ?? NOW_GRAF };

  // Store palsu ini SENGAJA menempelkan kolom rahasia (`cell`, `nonce`,
  // `centerCell`, `host`) ke objek yang dikembalikannya — meniru regresi
  // "store mulai memilih kolom terlalu banyak". Penyaring kunci di graf.ts
  // yang harus membuangnya; tes nama kunci JSON membuktikannya.
  const bocorKoneksi = (r: BarisKoneksiDb): KoneksiGraf =>
    ({ ...rowToKoneksiGraf(r), cell: r.cell, nonce: r.nonce }) as KoneksiGraf;
  const bocorAcara = (r: BarisAcaraDb): AcaraGraf =>
    ({ ...rowToAcaraGraf(r), centerCell: r.center_cell, host: r.host }) as AcaraGraf;
  const urut = () => [...data.connections].sort((x, y) => x.id - y.id);

  const graf: GrafStore = {
    koneksiSejak: vi.fn(async (sejakId: number, batas: number) =>
      urut().filter((c) => c.id > sejakId).slice(0, batas).map(bocorKoneksi)),
    acara: vi.fn(async (eventId: Hex) => {
      const e = data.events.find((x) => x.event_id === eventId.toLowerCase());
      return e ? bocorAcara(e) : null;
    }),
    // SUPERSET dengan sengaja: seluruh acara, bukan hanya yang beririsan.
    // Kontrak port mengizinkannya, dan dengan begitu aturan jendela di
    // graf.ts tidak bisa bersandar pada penyaringan store.
    acaraBeririsan: vi.fn(async () => data.events.map(bocorAcara)),
    checkInAcara: vi.fn(async (ids: Hex[]) => {
      const set = new Set(ids.map((i) => i.toLowerCase()));
      return data.checkins.filter((c) => set.has(c.event_id))
        .map((c) => ({ eventId: c.event_id as Hex, address: c.address as Address }));
    }),
    // SUPERSET dengan sengaja: seluruh koneksi, alasan yang sama.
    koneksiDalamJendela: vi.fn(async () => urut().map(bocorKoneksi)),
    daftarAcara: vi.fn(async () => data.events.map(bocorAcara)),
  };

  const meet: GrafDeps["meet"] = {
    profilRingkas: vi.fn(async (addrs: Address[]) => {
      const m = new Map<string, ProfilRingkas>();
      for (const a of addrs) {
        const p = data.profil[a.toLowerCase()];
        if (p) m.set(a.toLowerCase(), p);
      }
      return m;
    }),
  };

  const deps: GrafDeps = {
    graf, meet, webOrigins: opsi.webOrigins ?? [], nowMs: () => jam.sekarang,
  };
  const app = new Hono().route("/", grafRoutes(deps));

  /** Baris yang sama persis, dalam bentuk yang dimakan `rowsToGraph`. */
  function barisTrust(): GraphRows {
    return {
      connections: data.connections.map((c) => ({
        addr_a: c.addr_a, addr_b: c.addr_b, cell: c.cell, created_at: c.created_at,
      })),
      vouches: [], seeds: [], slashes: [],
      checkins: data.checkins.map((c) => ({ event_id: c.event_id, address: c.address })),
      events: data.events.map((e) => ({
        event_id: e.event_id, center_cell: e.center_cell, starts_at: e.starts_at, ends_at: e.ends_at,
      })),
      blocks: data.blocks,
    };
  }

  return { app, deps, graf, meet, jam, data, barisTrust };
}

/** Memuat seluruh halaman sampai `lengkap: true`, seperti layar /live. */
export async function muatSemua(app: Hono, jalur: string): Promise<{ ids: number[]; halaman: unknown[] }> {
  const ids: number[] = [];
  const halaman: unknown[] = [];
  let sejakId = 0;
  for (let i = 0; i < 100; i++) {
    const res = await app.request(`${jalur}?sejakId=${sejakId}`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json() as { sisi: { id: number }[]; kursor: number; lengkap: boolean };
    halaman.push(body);
    ids.push(...body.sisi.map((s) => s.id));
    sejakId = body.kursor;
    if (body.lengkap) return { ids, halaman };
  }
  throw new Error("tidak pernah lengkap");
}
