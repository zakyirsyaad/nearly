import type { SupabaseClient } from "@supabase/supabase-js";

export type Baris = Record<string, unknown>;

/**
 * Supabase di memori yang MENJALANKAN kueri, bukan hanya merekamnya — cukup
 * untuk `select`, `delete`, dan `update` dengan filter `eq`, `lt`, `gte`,
 * `is(null)`, dan `not(kolom, "is", null)`. Dipakai tes privasi retensi: yang
 * ingin dibuktikan adalah ISI tabel sesudah sapuan, bukan bentuk kuerinya.
 *
 * Perbandingan `lt`/`gte`: angka dan string angka dibandingkan sebagai angka
 * (`expires_at` bigint), selain itu sebagai waktu ISO (`seen_at`, `sent_at`).
 * Setiap `from()` tercatat di `tabelDisentuh`.
 */
export function supabaseMemori(awal: Record<string, Baris[]>) {
  const tabel: Record<string, Baris[]> = Object.fromEntries(
    Object.entries(awal).map(([n, rows]) => [n, rows.map((r) => ({ ...r }))]),
  );
  const tabelDisentuh: { tabel: string; op: string }[] = [];

  const nilai = (v: unknown): number =>
    typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));

  function kueri(nama: string) {
    const filter: ((r: Baris) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let perubahan: Baris = {};
    let hitung = false;

    const rantai = {
      select: () => { op = "select"; return rantai; },
      delete: (o?: { count?: string }) => { op = "delete"; hitung = o?.count === "exact"; return rantai; },
      update: (v: Baris, o?: { count?: string }) => { op = "update"; perubahan = v; hitung = o?.count === "exact"; return rantai; },
      eq: (k: string, v: unknown) => { filter.push((r) => r[k] === v); return rantai; },
      lt: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) < nilai(v)); return rantai; },
      gte: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) >= nilai(v)); return rantai; },
      is: (k: string, v: null) => { filter.push((r) => r[k] === v); return rantai; },
      not: (k: string, o: string, v: null) => {
        if (o !== "is" || v !== null) throw new Error(`not(${k}, ${o}) tidak didukung`);
        filter.push((r) => r[k] !== null);
        return rantai;
      },
      then: (selesai: (x: unknown) => unknown) => {
        tabelDisentuh.push({ tabel: nama, op });
        const rows = tabel[nama] ?? (tabel[nama] = []);
        const cocok = rows.filter((r) => filter.every((f) => f(r)));
        if (op === "delete") tabel[nama] = rows.filter((r) => !cocok.includes(r));
        if (op === "update") for (const r of cocok) Object.assign(r, perubahan);
        return selesai({ data: op === "select" ? cocok : null, error: null, count: hitung ? cocok.length : null });
      },
    };
    return rantai;
  }

  const db = { from: (nama: string) => kueri(nama) } as unknown as SupabaseClient;
  return { db, tabel, tabelDisentuh };
}
