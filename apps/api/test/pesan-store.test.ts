import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { createPesanStore } from "../src/pesan-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NONCE = `0x${"cd".repeat(24)}` as Hex;

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

/**
 * Klien palsu yang MEREKAM setiap panggilan berantai. Setiap `from()` mengambil
 * satu jawaban dari depan antrean; tanpa jawaban tersisa, ia menjawab kosong.
 */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null, count: 0 };
      const rantai: Record<string, unknown> = {};
      for (const op of [
        "select", "insert", "upsert", "update", "delete", "eq", "neq", "is", "or", "in",
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

describe("createPesanStore", () => {
  it("simpanKunci meng-upsert alamat huruf kecil", async () => {
    const { db, jejak } = dbPalsu();
    await createPesanStore(db).simpanKunci(A, {
      kunciEnkripsi: `0x${"aa".repeat(32)}` as Hex, kunciTanda: `0x${"bb".repeat(32)}` as Hex,
    });
    const up = ops(jejak, "upsert")[0]!;
    expect((up.arg[0] as { address: string }).address).toBe(A.toLowerCase());
    expect(up.arg[1]).toEqual({ onConflict: "address" });
  });

  it("ambilKunci mengembalikan null bila tidak ada", async () => {
    const { db } = dbPalsu([{ data: null, error: null }]);
    expect(await createPesanStore(db).ambilKunci(A)).toBeNull();
  });

  it("simpanPesan: pelanggaran unik 23505 berarti sudah_ada, bukan galat", async () => {
    const { db } = dbPalsu([{ error: { message: "duplicate", code: "23505" } }]);
    expect(await createPesanStore(db).simpanPesan({
      id: ID, pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    })).toBe("sudah_ada");
  });

  it("simpanPesan: galat lain melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati", code: "08006" } }]);
    await expect(createPesanStore(db).simpanPesan({
      id: ID, pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    })).rejects.toThrow(/simpan pesan gagal/);
  });

  it("simpanPesan menyimpan alamat dan id huruf kecil", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createPesanStore(db).simpanPesan({
      id: ID.toUpperCase(), pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    });
    const baris = ops(jejak, "insert")[0]!.arg[0] as Record<string, string>;
    expect(baris.pengirim).toBe(A.toLowerCase());
    expect(baris.penerima).toBe(B.toLowerCase());
    expect(baris.id).toBe(ID);
  });

  it("riwayat menyaring KEDUA arah pasangan", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createPesanStore(db).riwayat(A, B, null, 50);
    const klausa = ops(jejak, "or")[0]!.arg[0] as string;
    const a = A.toLowerCase();
    const b = B.toLowerCase();
    expect(klausa).toContain(`and(pengirim.eq.${a},penerima.eq.${b})`);
    expect(klausa).toContain(`and(pengirim.eq.${b},penerima.eq.${a})`);
  });

  it("riwayat dengan kursor memakai lt created_at", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createPesanStore(db).riwayat(A, B, 1_700_000_000_000, 50);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(1_700_000_000_000).toISOString()]);
  });

  it("tandaiDibaca memakai lt(sampaiMs + 1) — presisi mikrodetik", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createPesanStore(db).tandaiDibaca(B, A, 1_700_000_000_123);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(1_700_000_000_124).toISOString()]);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["penerima", B.toLowerCase()], ["pengirim", A.toLowerCase()]]);
    expect(ops(jejak, "is")[0]!.arg).toEqual(["dibaca_at", null]);
  });

  it("belumDibacaPerPengirim menjumlah per pengirim huruf kecil", async () => {
    const { db } = dbPalsu([{
      data: [{ pengirim: A.toLowerCase() }, { pengirim: A.toLowerCase() }, { pengirim: B.toLowerCase() }],
    }]);
    const peta = await createPesanStore(db).belumDibacaPerPengirim(B);
    expect(peta.get(A.toLowerCase())).toBe(2);
    expect(peta.get(B.toLowerCase())).toBe(1);
  });

  it("simpanTokenPush mencabut token itu dari dompet lain lebih dulu", async () => {
    const { db, jejak } = dbPalsu([{ error: null }, { error: null }]);
    await createPesanStore(db).simpanTokenPush(A, "ExponentPushToken[x]");
    expect(jejak.map((j) => j.op).filter((o) => o === "delete" || o === "upsert")).toEqual(["delete", "upsert"]);
    expect(ops(jejak, "neq")[0]!.arg).toEqual(["address", A.toLowerCase()]);
  });

  it("hapusTokenPush tanpa token tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    await createPesanStore(db).hapusTokenPush([]);
    expect(jejak).toEqual([]);
  });

  it("gantiBuktiLaporan menghapus bukti lama lalu menyisipkan yang baru", async () => {
    const { db, jejak } = dbPalsu([{ error: null }, { error: null }]);
    await createPesanStore(db).gantiBuktiLaporan(7, [{
      pesanId: ID, isi: "halo", dikirimMs: 5,
      tanda: `0x${"ee".repeat(64)}` as Hex, kunciTanda: `0x${"bb".repeat(32)}` as Hex,
    }]);
    expect(jejak.map((j) => j.op).filter((o) => o === "delete" || o === "insert")).toEqual(["delete", "insert"]);
    expect((ops(jejak, "insert")[0]!.arg[0] as Record<string, unknown>[])[0]).toEqual({
      laporan_id: 7, pesan_id: ID, isi: "halo", dikirim_ms: 5,
      tanda: `0x${"ee".repeat(64)}`, kunci_tanda: `0x${"bb".repeat(32)}`,
    });
  });

  it("galat baca melempar, bukan jadi daftar kosong", async () => {
    const { db } = dbPalsu([{ data: null, error: { message: "mati" } }]);
    await expect(createPesanStore(db).pesanTerbaruUntuk(A, 500)).rejects.toThrow();
  });
});
