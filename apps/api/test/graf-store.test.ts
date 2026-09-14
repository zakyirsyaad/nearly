import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import { createGrafStore, rowToKoneksiGraf } from "../src/graf-store";

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string } | null };

/**
 * Klien palsu yang MEREKAM setiap panggilan berantai. Setiap `from()` mengambil
 * satu jawaban dari depan antrean; tanpa jawaban tersisa, ia menjawab kosong.
 */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null };
      const rantai: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "gt", "gte", "lt", "lte", "order", "limit", "range", "maybeSingle"]) {
        rantai[op] = (...arg: unknown[]) => { jejak.push({ tabel, op, arg }); return rantai; };
      }
      rantai.then = (r: (v: unknown) => unknown) => r({ data: null, error: null, ...jawaban });
      return rantai;
    },
  } as unknown as SupabaseClient;
  return { db, jejak };
}

const ops = (j: Jejak[], op: string) => j.filter((x) => x.op === op);
const E = `0x${"11".repeat(32)}` as Hex;

function barisKoneksi(id: number) {
  return {
    id, addr_a: "0x00000000000000000000000000000000000000aa", addr_b: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-14T10:00:00.123+00:00", tx_hash: `0x${"ab".repeat(32)}`,
  };
}

describe("createGrafStore", () => {
  it("rowToKoneksiGraf mengurai waktu persis seperti rowsToGraph, termasuk mikrodetik", () => {
    const k = rowToKoneksiGraf({ ...barisKoneksi(7), id: "7", created_at: "2026-09-14T10:00:00.123456+00:00" });
    expect(k.id).toBe(7);
    expect(k.atMs).toBe(new Date("2026-09-14T10:00:00.123456+00:00").getTime());
  });

  it("koneksiSejak mengambil per potongan 1000 karena PostgREST memotong diam-diam", async () => {
    const { db, jejak } = dbPalsu([
      { data: Array.from({ length: 1000 }, (_, i) => barisKoneksi(i + 1)) },
      { data: Array.from({ length: 1000 }, (_, i) => barisKoneksi(i + 1001)) },
      { data: [barisKoneksi(2001)] },
    ]);
    const hasil = await createGrafStore(db).koneksiSejak(0, 2001);
    expect(hasil).toHaveLength(2001);
    expect(ops(jejak, "range").map((r) => r.arg)).toEqual([[0, 999], [1000, 1999], [2000, 2000]]);
    expect(ops(jejak, "gt")[0]!.arg).toEqual(["id", 0]);
    expect(ops(jejak, "order")[0]!.arg).toEqual(["id", { ascending: true }]);
  });

  it("koneksiSejak berhenti pada potongan yang tidak penuh", async () => {
    const { db, jejak } = dbPalsu([{ data: [barisKoneksi(1)] }]);
    expect(await createGrafStore(db).koneksiSejak(5, 2001)).toHaveLength(1);
    expect(ops(jejak, "range")).toHaveLength(1);
  });

  it("koneksiDalamJendela: gte awal, lt akhir + 1 ms (mikrodetik)", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createGrafStore(db).koneksiDalamJendela(1_000_000, 2_000_000);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["created_at", new Date(1_000_000).toISOString()]);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(2_000_001).toISOString()]);
  });

  it("acaraBeririsan: mulai sebelum akhir jendela dan berakhir setelah awal jendela", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createGrafStore(db).acaraBeririsan(100, 200);
    expect(ops(jejak, "lte")[0]!.arg).toEqual(["starts_at", 200]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["ends_at", 100]);
  });

  it("daftarAcara: sudah mulai, berakhir paling lama 7 hari lalu, terbaru berakhir dulu", async () => {
    const { db, jejak } = dbPalsu([{ data: [{ event_id: E, title: "x", starts_at: "1", ends_at: "2" }] }]);
    const hasil = await createGrafStore(db).daftarAcara(1_000_000, 50);
    expect(hasil).toEqual([{ eventId: E, title: "x", startsAt: 1, endsAt: 2 }]);
    expect(ops(jejak, "lte")[0]!.arg).toEqual(["starts_at", 1_000_000]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["ends_at", 1_000_000 - 604_800]);
    expect(ops(jejak, "order")[0]!.arg).toEqual(["ends_at", { ascending: false }]);
    expect(ops(jejak, "limit")[0]!.arg).toEqual([50]);
  });

  it("checkInAcara tanpa id tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    expect(await createGrafStore(db).checkInAcara([])).toEqual([]);
    expect(jejak).toEqual([]);
  });

  it("galat basis data melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati" } }]);
    await expect(createGrafStore(db).acara(E)).rejects.toThrow(/baca acara graf gagal/);
  });

  it("tidak pernah memilih kolom rahasia dan tidak pernah membaca tabel di luar tiga tabel graf", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }, { data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]);
    const s = createGrafStore(db);
    await s.koneksiSejak(0, 10);
    await s.acara(E);
    await s.acaraBeririsan(1, 2);
    await s.checkInAcara([E]);
    await s.koneksiDalamJendela(1, 2);
    await s.daftarAcara(1, 50);

    expect([...new Set(jejak.map((j) => j.tabel))].sort()).toEqual(["checkins", "connections", "events"]);
    for (const sel of ops(jejak, "select")) {
      expect(String(sel.arg[0])).not.toMatch(/\*|cell|nonce|host|venue|score|ratio|operator/);
    }
  });
});
