import type { SupabaseClient } from "@supabase/supabase-js";

export type Baris = Record<string, unknown>;

/**
 * Supabase di memori yang MENJALANKAN kueri, bukan hanya merekamnya — cukup
 * untuk `select`, `delete`, dan `update` dengan filter `eq`, `lt`, `gte`, `in`,
 * `is(null)`, dan `not(kolom, "is", null)`, ditambah `order`, `range`, dan
 * `maybeSingle` untuk select. Dipakai tes privasi retensi dan tes pemetaan
 * store: yang ingin dibuktikan adalah ISI tabel dan jawaban, bukan bentuk
 * kuerinya.
 *
 * Perbandingan `lt`/`gte`: angka dan string angka dibandingkan sebagai angka
 * (`expires_at` bigint), selain itu sebagai waktu ISO (`seen_at`, `sent_at`).
 * `order`: angka sebagai angka, selain itu sebagai string. Kolom di
 * `select(...)` tidak disaring — store yang diuji memetakan kolomnya sendiri.
 * Setiap `from()` tercatat di `tabelDisentuh`.
 */
export function supabaseMemori(awal: Record<string, Baris[]>) {
  const tabel: Record<string, Baris[]> = Object.fromEntries(
    Object.entries(awal).map(([n, rows]) => [n, rows.map((r) => ({ ...r }))]),
  );
  const tabelDisentuh: { tabel: string; op: string }[] = [];

  const nilai = (v: unknown): number =>
    typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));

  const banding = (x: unknown, y: unknown): number =>
    typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;

  function kueri(nama: string) {
    const filter: ((r: Baris) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let perubahan: Baris = {};
    let hitung = false;
    let urut: { kolom: string; naik: boolean } | null = null;
    let rentang: [number, number] | null = null;
    let tunggal = false;

    const rantai = {
      select: () => { op = "select"; return rantai; },
      delete: (o?: { count?: string }) => { op = "delete"; hitung = o?.count === "exact"; return rantai; },
      update: (v: Baris, o?: { count?: string }) => { op = "update"; perubahan = v; hitung = o?.count === "exact"; return rantai; },
      eq: (k: string, v: unknown) => { filter.push((r) => r[k] === v); return rantai; },
      lt: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) < nilai(v)); return rantai; },
      gte: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) >= nilai(v)); return rantai; },
      in: (k: string, v: unknown[]) => { filter.push((r) => v.includes(r[k])); return rantai; },
      is: (k: string, v: null) => { filter.push((r) => r[k] === v); return rantai; },
      not: (k: string, o: string, v: null) => {
        if (o !== "is" || v !== null) throw new Error(`not(${k}, ${o}) tidak didukung`);
        filter.push((r) => r[k] !== null);
        return rantai;
      },
      order: (k: string, o?: { ascending?: boolean }) => {
        urut = { kolom: k, naik: o?.ascending !== false };
        return rantai;
      },
      range: (dari: number, sampai: number) => { rentang = [dari, sampai]; return rantai; },
      maybeSingle: () => { tunggal = true; return rantai; },
      then: (selesai: (x: unknown) => unknown) => {
        tabelDisentuh.push({ tabel: nama, op });
        const rows = tabel[nama] ?? (tabel[nama] = []);
        let cocok = rows.filter((r) => filter.every((f) => f(r)));
        if (op === "delete") tabel[nama] = rows.filter((r) => !cocok.includes(r));
        if (op === "update") for (const r of cocok) Object.assign(r, perubahan);
        const u = urut;
        if (op === "select" && u) {
          cocok = [...cocok].sort((x, y) => (u.naik ? 1 : -1) * banding(x[u.kolom], y[u.kolom]));
        }
        const rg = rentang;
        if (op === "select" && rg) cocok = cocok.slice(rg[0], rg[1] + 1);
        const data = op === "select" ? (tunggal ? (cocok[0] ?? null) : cocok) : null;
        return selesai({ data, error: null, count: hitung ? cocok.length : null });
      },
    };
    return rantai;
  }

  const db = { from: (nama: string) => kueri(nama) } as unknown as SupabaseClient;
  return { db, tabel, tabelDisentuh };
}
