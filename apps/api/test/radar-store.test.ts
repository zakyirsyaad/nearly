import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { createRadarStore } from "../src/radar-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;
const E = `0x${"E1".repeat(32)}` as Hex;

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

/** Klien palsu yang MEREKAM setiap panggilan berantai (pola pesan-store.test.ts). */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null, count: 0 };
      const rantai: Record<string, unknown> = {};
      for (const op of [
        "select", "insert", "upsert", "update", "delete", "eq", "neq", "is", "not", "or", "in",
        "lt", "lte", "gte", "order", "limit", "range", "maybeSingle", "single",
      ]) {
        rantai[op] = (...arg: unknown[]) => { jejak.push({ tabel, op, arg }); return rantai; };
      }
      rantai.then = (r: (v: unknown) => unknown) => r({ data: null, error: null, ...jawaban });
      return rantai;
    },
  } as unknown as SupabaseClient;
  return { db, jejak };
}

const ops = (j: Jejak[], op: string) => j.filter((x) => x.op === op);

describe("createRadarStore", () => {
  it("ambilKehadiran memetakan seen_at ke milidetik, dengan kunci huruf kecil", async () => {
    const { db, jejak } = dbPalsu([{ data: { cell: "qqguv1r", seen_at: "2023-11-14T22:13:20.000Z" } }]);
    expect(await createRadarStore(db).ambilKehadiran(E, A)).toEqual({ cell: "qqguv1r", seenAtMs: 1_700_000_000_000 });
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()], ["address", A.toLowerCase()]]);
  });

  it("ambilKehadiran tanpa baris → null", async () => {
    const { db } = dbPalsu([{ data: null }]);
    expect(await createRadarStore(db).ambilKehadiran(E, A)).toBeNull();
  });

  it("simpanKehadiran meng-upsert satu baris per (acara, orang)", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createRadarStore(db).simpanKehadiran(E, A, "qqguv1r", 1_700_000_000_000);
    const up = ops(jejak, "upsert")[0]!;
    expect(up.arg[0]).toEqual({
      event_id: E.toLowerCase(), address: A.toLowerCase(), cell: "qqguv1r", seen_at: "2023-11-14T22:13:20.000Z",
    });
    expect(up.arg[1]).toEqual({ onConflict: "event_id,address" });
  });

  it("hapusSemuaKehadiran hanya menyaring alamat, semua acara", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createRadarStore(db).hapusSemuaKehadiran(A);
    expect(ops(jejak, "delete")).toHaveLength(1);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["address", A.toLowerCase()]]);
  });

  it("hadirSejak menyaring acara dan seen_at, berurutan alamat dan berhalaman", async () => {
    const { db, jejak } = dbPalsu([{ data: [{ address: A }] }]);
    expect(await createRadarStore(db).hadirSejak(E, Date.parse("2023-11-14T21:30:00.000Z"))).toEqual([A.toLowerCase()]);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()]]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["seen_at", "2023-11-14T21:30:00.000Z"]);
    expect(ops(jejak, "order")[0]!.arg[0]).toBe("address");
    expect(ops(jejak, "range")[0]!.arg).toEqual([0, 999]);
  });

  it("terhubungDengan memakai urutan kanonik addr_a < addr_b, satu kueri per sisi", async () => {
    const who = "0x0000000000000000000000000000000000000050" as Address;
    const lebihKecil = "0x0000000000000000000000000000000000000010" as Address;
    const lebihBesar = "0x0000000000000000000000000000000000000090" as Address;
    const { db, jejak } = dbPalsu([
      { data: [{ addr_b: lebihBesar }] },
      { data: [{ addr_a: lebihKecil }] },
    ]);
    const hasil = await createRadarStore(db).terhubungDengan(who, [lebihBesar, lebihKecil, who]);
    expect(hasil).toEqual(new Set([lebihBesar, lebihKecil]));
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["addr_a", who], ["addr_b", who]]);
    expect(ops(jejak, "in").map((e) => e.arg)).toEqual([["addr_b", [lebihBesar]], ["addr_a", [lebihKecil]]]);
  });

  it("terhubungDengan tanpa kandidat tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    expect(await createRadarStore(db).terhubungDengan(A, [])).toEqual(new Set());
    expect(jejak).toEqual([]);
  });

  it("sisipNotifKedekatan: tersisip → true; pelanggaran unik 23505 → false, bukan galat", async () => {
    const tersisip = dbPalsu([{ error: null }]);
    expect(await createRadarStore(tersisip.db).sisipNotifKedekatan(E, A, B)).toBe(true);
    expect(ops(tersisip.jejak, "insert")[0]!.arg[0]).toEqual({
      event_id: E.toLowerCase(), penerima: A.toLowerCase(), subjek: B.toLowerCase(),
    });
    const ganda = dbPalsu([{ error: { message: "duplicate", code: "23505" } }]);
    expect(await createRadarStore(ganda.db).sisipNotifKedekatan(E, A, B)).toBe(false);
  });

  it("sisipNotifKedekatan: galat lain melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati", code: "08006" } }]);
    await expect(createRadarStore(db).sisipNotifKedekatan(E, A, B)).rejects.toThrow(/sisip notifikasi kedekatan gagal/);
  });

  it("hitungNotifKedekatan menghitung per (acara, penerima)", async () => {
    const { db, jejak } = dbPalsu([{ count: 4 }]);
    expect(await createRadarStore(db).hitungNotifKedekatan(E, A)).toBe(4);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()], ["penerima", A.toLowerCase()]]);
  });

  it("sapuLokasi melempar bila salah satu pernyataan gagal", async () => {
    const { db } = dbPalsu([{ error: null }, { error: { message: "mati" } }, { error: null }, { error: null }]);
    await expect(createRadarStore(db).sapuLokasi(1_700_000_000_000)).rejects.toThrow(/sapu notifikasi kedekatan gagal/);
  });
});

import { supabaseMemori } from "./support/supabase-memori";

// Spec desain UI §8.3, §10.2: pemetaan dengan kandidat di KEDUA sisi urutan
// kanonik (addr_a < addr_b), blokir dua arah pemanggil tidak dihitung.
describe("createRadarStore — hitungKoneksiBersama", () => {
  const x = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
  const WHO = x(0x50);
  const K1 = x(0x90); // > WHO
  const K2 = x(0x10); // < WHO
  const M1 = x(0x30);
  const M2 = x(0x70);
  const BLOK = x(0x60);
  const baris = (id: number, a: Address, b: Address) => ({ id, addr_a: a < b ? a : b, addr_b: a < b ? b : a });

  it("menghitung irisan koneksi untuk kandidat di kedua sisi, tanpa himpunan blokir", async () => {
    const { db } = supabaseMemori({
      connections: [
        baris(1, WHO, M1), baris(2, M1, K1), baris(3, WHO, M2), baris(4, K2, M2),
        baris(5, WHO, BLOK), baris(6, BLOK, K1), baris(7, M2, K1),
      ],
    });
    const hasil = await createRadarStore(db).hitungKoneksiBersama(WHO, [K1, K2], [BLOK]);
    expect(hasil).toEqual(new Map([[K1, 2], [K2, 1]]));
  });

  it("kandidat tanpa koneksi bersama bernilai 0; pemanggil bukan kandidat", async () => {
    const { db } = supabaseMemori({ connections: [baris(1, WHO, M1)] });
    expect(await createRadarStore(db).hitungKoneksiBersama(WHO, [K1, WHO], [])).toEqual(new Map([[K1, 0]]));
  });

  it("tanpa kandidat tidak mengirim kueri", async () => {
    const { db, tabelDisentuh } = supabaseMemori({ connections: [] });
    expect(await createRadarStore(db).hitungKoneksiBersama(WHO, [], [])).toEqual(new Map());
    expect(tabelDisentuh).toEqual([]);
  });
});
