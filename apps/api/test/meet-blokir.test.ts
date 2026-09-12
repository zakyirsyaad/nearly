import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createMeetStore } from "../src/meet-store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb";

/** Merekam `not(...)` supaya bentuk kuerinya bisa diasersi. */
function dbPalsu(baris: Record<string, unknown>[] = []) {
  const panggilan: { op: string; arg: unknown }[] = [];
  const rantai = () => ({
    select: () => rantai(),
    eq: () => rantai(),
    not: (kolom: string, op: string, nilai: unknown) => {
      panggilan.push({ op: `not:${kolom}:${op}`, arg: nilai });
      return rantai();
    },
    order: () => rantai(),
    // Stub tambahan supaya rantai tetap bisa dipanggil sampai selesai lewat
    // `.limit()`/`.maybeSingle()` sungguhan di implementasi — fake ini hanya
    // peduli merekam bentuk filter `not`, bukan mensimulasikan batas baris
    // atau baris tunggal Postgres.
    limit: () => rantai(),
    maybeSingle: () => rantai(),
    then: (r: (v: unknown) => unknown) => r({ data: baris, error: null, count: baris.length }),
  });
  return { db: { from: () => rantai() } as never, panggilan };
}

describe("MeetStore menghormati `kecuali`", () => {
  it("hitungTanda tanpa pengecualian tidak memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).hitungTanda(A, []);
    expect(panggilan.filter((p) => p.op.startsWith("not:")).length).toBe(0);
  });

  it("hitungTanda dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).hitungTanda(A, [B]);
    const not = panggilan.find((p) => p.op.startsWith("not:"));
    expect(not).toBeDefined();
    expect(String(not?.arg)).toContain(B);
  });

  it("tandaOleh dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).tandaOleh(A, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  it("tandaKe dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).tandaKe(A, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  it("adaTanda dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).adaTanda(A, B as Address, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  // Daftar pengecualian yang panjang tidak boleh membangun query string
  // raksasa yang ditolak PostgREST — jebakan yang sama yang melahirkan
  // potongKelompok di Fase 3b.
  it("pengecualian lebih dari UKURAN_KELOMPOK dipotong, bukan dikirim sekaligus", async () => {
    const { db, panggilan } = dbPalsu();
    const banyak = Array.from({ length: 250 }, (_, i) =>
      `0x${String(i).padStart(40, "0")}`);
    await createMeetStore(db).hitungTanda(A, banyak);
    const nots = panggilan.filter((p) => p.op.startsWith("not:"));
    expect(nots.length).toBeGreaterThanOrEqual(3);
    for (const n of nots) expect(String(n.arg).split(",").length).toBeLessThanOrEqual(100);
  });
});
