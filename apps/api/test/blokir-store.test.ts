import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createBlokirStore } from "../src/blokir-store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;

/** Klien palsu yang MEREKAM panggilan, supaya bentuk kuerinya bisa diasersi. */
function dbPalsu(hasil: Record<string, unknown>[] = []) {
  const panggilan: { tabel: string; op: string; arg: unknown }[] = [];
  const rantai = (tabel: string) => ({
    select: () => rantai(tabel),
    eq: (kolom: string, nilai: unknown) => {
      panggilan.push({ tabel, op: `eq:${kolom}`, arg: nilai });
      return rantai(tabel);
    },
    or: (klausa: string) => {
      panggilan.push({ tabel, op: "or", arg: klausa });
      return rantai(tabel);
    },
    order: () => rantai(tabel),
    limit: () => rantai(tabel),
    then: (r: (v: unknown) => unknown) => r({ data: hasil, error: null }),
    upsert: (baris: unknown) => {
      panggilan.push({ tabel, op: "upsert", arg: baris });
      return { then: (r: (v: unknown) => unknown) => r({ error: null }) };
    },
    delete: () => ({
      eq: (kolom: string, nilai: unknown) => {
        panggilan.push({ tabel, op: `delete-eq:${kolom}`, arg: nilai });
        return {
          eq: (k2: string, v2: unknown) => {
            panggilan.push({ tabel, op: `delete-eq:${k2}`, arg: v2 });
            return { then: (r: (v: unknown) => unknown) => r({ error: null }) };
          },
        };
      },
    }),
  });
  return { db: { from: (t: string) => rantai(t) } as never, panggilan };
}

describe("createBlokirStore", () => {
  it("setBlokir(true) menulis baris huruf kecil", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, true);
    const up = panggilan.find((p) => p.op === "upsert");
    expect(up?.tabel).toBe("blocks");
    expect(up?.arg).toEqual({ blocker: A.toLowerCase(), blocked: B.toLowerCase() });
  });

  it("setBlokir(false) MENGHAPUS baris, bukan menulis bendera", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, false);
    expect(panggilan.some((p) => p.op.startsWith("delete-eq:blocker"))).toBe(true);
    expect(panggilan.some((p) => p.op === "upsert")).toBe(false);
  });

  // Blokir DUA ARAH: himpunan penyaring tidak peduli siapa yang memulai.
  // Kalau hanya satu arah yang dibaca, orang yang memblokirmu tetap muncul di
  // feedmu — separuh fitur ini bocor tanpa satu galat pun.
  it("himpunanUntuk membaca KEDUA arah", async () => {
    const { db, panggilan } = dbPalsu([
      { blocker: A.toLowerCase(), blocked: B.toLowerCase() },
      { blocker: "0x00000000000000000000000000000000000000cc", blocked: A.toLowerCase() },
    ]);
    const set = await createBlokirStore(db).himpunanUntuk(A);
    const klausa = panggilan.find((p) => p.op === "or")?.arg as string;
    expect(klausa).toContain("blocker.eq.");
    expect(klausa).toContain("blocked.eq.");
    // Alamat SENDIRI tidak boleh ikut masuk himpunan — kalau ikut, penonton
    // menyaring unggahannya sendiri dari feednya sendiri.
    expect(set.has(A.toLowerCase())).toBe(false);
    expect(set.has(B.toLowerCase())).toBe(true);
    expect(set.has("0x00000000000000000000000000000000000000cc")).toBe(true);
  });

  it("diblokirOleh hanya arah pemblokir", async () => {
    const { db, panggilan } = dbPalsu([
      { blocked: B.toLowerCase(), created_at: "2026-09-08T00:00:00.000Z" },
    ]);
    const baris = await createBlokirStore(db).diblokirOleh(A);
    expect(panggilan.some((p) => p.op === "eq:blocker")).toBe(true);
    expect(panggilan.some((p) => p.op === "or")).toBe(false);
    expect(baris[0]?.address).toBe(B.toLowerCase());
    expect(baris[0]?.atMs).toBe(Date.parse("2026-09-08T00:00:00.000Z"));
  });

  it("adaBlokir memeriksa tepat satu arah", async () => {
    const { db, panggilan } = dbPalsu([{ blocker: A.toLowerCase(), blocked: B.toLowerCase() }]);
    expect(await createBlokirStore(db).adaBlokir(A, B)).toBe(true);
    expect(panggilan.filter((p) => p.op.startsWith("eq:")).length).toBe(2);
  });
});
