import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportStore } from "../src/trust/store";

/**
 * Bukti laporan pesan menaut ke `reports.id` (spec 4c §3.4), jadi
 * `recordReport` harus mengembalikan id baris — termasuk saat upsert
 * memperbarui laporan lama untuk pasangan (reporter, subject) yang sama.
 */
describe("recordReport mengembalikan id", () => {
  const baris = {
    reporter: "0x00000000000000000000000000000000000000aa" as const,
    subject: "0x00000000000000000000000000000000000000bb" as const,
    reason: "alasan yang cukup panjang",
  };

  it("id baris hasil upsert", async () => {
    const panggilan: string[] = [];
    const db = {
      from: (tabel: string) => {
        panggilan.push(`from:${tabel}`);
        const b = {
          upsert: (_row: unknown, opsi: { onConflict: string }) => { panggilan.push(`upsert:${opsi.onConflict}`); return b; },
          select: (kolom: string) => { panggilan.push(`select:${kolom}`); return b; },
          single: async () => ({ data: { id: 42 }, error: null }),
        };
        return b;
      },
    } as unknown as SupabaseClient;

    expect(await createReportStore(db).recordReport(baris)).toBe(42);
    expect(panggilan).toEqual(["from:reports", "upsert:reporter,subject", "select:id"]);
  });

  it("galat basis data melempar", async () => {
    const db = {
      from: () => {
        const b = {
          upsert: () => b, select: () => b,
          single: async () => ({ data: null, error: { message: "mati" } }),
        };
        return b;
      },
    } as unknown as SupabaseClient;
    await expect(createReportStore(db).recordReport(baris)).rejects.toThrow(/catat laporan gagal/);
  });
});
