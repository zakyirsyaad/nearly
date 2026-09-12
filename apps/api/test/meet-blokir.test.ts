import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMeetStore, type TandaDbRow } from "../src/meet-store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;
const OTHER1 = "0x00000000000000000000000000000000000000c1" as Address;
const OTHER2 = "0x00000000000000000000000000000000000000c2" as Address;
const T1 = "2026-09-07T10:00:00.000Z";
const T2 = "2026-09-07T11:00:00.000Z";

/**
 * Fake untuk `hitungTanda`: setiap `.from()` baru dicatat pada POSISI-nya
 * (0 = query total tanpa `.in()`, 1..n = query per kelompok, masing-masing
 * dengan `.in("who", …)`). `responder` memutuskan balasan tiap posisi —
 * ini yang membuat tes bisa memaksa satu kelompok gagal tanpa menggagalkan
 * yang lain, dan bisa membedakan query total dari query kelompok.
 */
function hitungDbPalsu(
  responder: (posisi: number) => { count: number | null; error: { message: string } | null },
) {
  const panggilan: { eq: [string, string][]; in: [string, string[]][] }[] = [];
  const db = {
    from: () => {
      const rec: { eq: [string, string][]; in: [string, string[]][] } = { eq: [], in: [] };
      const posisi = panggilan.length;
      panggilan.push(rec);
      const b = {
        select: () => b,
        eq: (k: string, v: string) => { rec.eq.push([k, v]); return b; },
        in: (k: string, v: string[]) => { rec.in.push([k, v]); return b; },
        then: (resolve: (v: unknown) => unknown) => resolve(responder(posisi)),
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { db, panggilan };
}

describe("hitungTanda menghormati `kecuali` tanpa membengkakkan URL", () => {
  it("kecuali kosong: hanya SATU request, tidak ada .in() sama sekali", async () => {
    const { db, panggilan } = hitungDbPalsu(() => ({ count: 5, error: null }));
    const hasil = await createMeetStore(db).hitungTanda(A, []);
    expect(hasil).toBe(5);
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]?.in).toEqual([]);
    expect(panggilan[0]?.eq).toEqual([["target", A.toLowerCase()]]);
  });

  it("kecuali satu alamat: total dikurangi hitungan kelompok itu, lewat request TERPISAH", async () => {
    const { db, panggilan } = hitungDbPalsu(
      (posisi) => (posisi === 0 ? { count: 10, error: null } : { count: 3, error: null }),
    );
    const hasil = await createMeetStore(db).hitungTanda(A, [B]);
    expect(hasil).toBe(7);
    expect(panggilan).toHaveLength(2);
    // Query total TIDAK membawa `.in()` sama sekali — ia menghitung SEMUA
    // tanda ke `target`, baru dikurangi belakangan.
    expect(panggilan[0]?.in).toEqual([]);
    expect(panggilan[1]?.in).toEqual([["who", [B.toLowerCase()]]]);
    // Kedua request menyaring `target`, BUKAN `who` — kalau query kelompok
    // kehilangan filter `target`-nya (atau memakainya untuk `who`), angka
    // publik `inginBertemuCount` akan salah untuk `target` yang lain: 0
    // kalau filternya hilang sama sekali, atau tetap menghitung tanda dari
    // orang terblokir kalau filternya tertukar ke `who`.
    expect(panggilan[0]?.eq).toEqual([["target", A.toLowerCase()]]);
    expect(panggilan[1]?.eq).toEqual([["target", A.toLowerCase()]]);
  });

  /**
   * IMPORTANT (ronde perbaikan 2). `.eq("target", t)` pada request TOTAL
   * maupun pada SETIAP request kelompok tidak pernah dipin sebelum ini —
   * `hitungDbPalsu` merekam `rec.eq` tapi tidak ada tes yang membacanya.
   * Query kelompok bisa kehilangan filter `target`-nya, atau memakai
   * `.eq("who", t)`, dan seluruh suite tetap hijau sementara
   * `inginBertemuCount` publik salah (terpotong ke 0 di kasus pertama, atau
   * tetap menghitung tanda dari orang terblokir di kasus kedua).
   */
  it("query total dan SETIAP query kelompok menyaring eq(\"target\", …), bukan eq(\"who\", …)", async () => {
    const { db, panggilan } = hitungDbPalsu(
      (posisi) => (posisi === 0 ? { count: 300, error: null } : { count: 10, error: null }),
    );
    const banyak = Array.from({ length: 250 }, (_, i) => `0x${String(i).padStart(40, "0")}`);
    await createMeetStore(db).hitungTanda(A, banyak);
    expect(panggilan).toHaveLength(4);
    for (const p of panggilan) {
      expect(p.eq).toEqual([["target", A.toLowerCase()]]);
    }
    // Tidak ada satu pun request yang menyaring `who` lewat `.eq()` — daftar
    // kecuali HARUS lewat `.in("who", …)`, bukan `.eq("who", …)`.
    expect(panggilan.some((p) => p.eq.some(([k]) => k === "who"))).toBe(false);
  });

  /**
   * IMPORTANT 1: memotong PARAMETER (seperti `tanpa()` versi lama) tidak
   * pernah membuat URL-nya pendek karena postgrest-js menumpuk semua
   * `.not()`/`.in()` ke URL yang SAMA. Satu-satunya cara URL-nya benar-benar
   * dibatasi adalah satu REQUEST HTTP per kelompok — itulah yang diuji di
   * sini: 250 alamat harus menghasilkan 1 (total) + 3 (kelompok) = 4
   * request, dan setiap `.in()` membawa maksimal UKURAN_KELOMPOK (100) nilai.
   */
  it("250 alamat terkecuali: 1 request total + 3 request kelompok, masing-masing ≤100 nilai", async () => {
    const { db, panggilan } = hitungDbPalsu(
      (posisi) => (posisi === 0 ? { count: 300, error: null } : { count: 10, error: null }),
    );
    const banyak = Array.from({ length: 250 }, (_, i) => `0x${String(i).padStart(40, "0")}`);
    const hasil = await createMeetStore(db).hitungTanda(A, banyak);
    expect(panggilan).toHaveLength(4);
    const grup = panggilan.slice(1);
    for (const g of grup) {
      expect(g.in).toHaveLength(1);
      expect(g.in[0]?.[1].length).toBeLessThanOrEqual(100);
    }
    // 300 total, tiga kelompok masing-masing melapor 10 -> 300 - 30 = 270.
    expect(hasil).toBe(270);
  });

  it("kesalahan pada kelompok mana pun membuat hitungTanda melempar, bukan menganggapnya nol", async () => {
    const { db } = hitungDbPalsu(
      (posisi) => (posisi === 0 ? { count: 10, error: null } : { count: null, error: { message: "db mati" } }),
    );
    await expect(createMeetStore(db).hitungTanda(A, [B])).rejects.toThrow("db mati");
  });
});

describe("adaTanda: who yang terkecuali TIDAK PERNAH memicu query", () => {
  it("tidak membuat query sama sekali kalau who ada di kecuali", async () => {
    const db = {
      from: () => { throw new Error("adaTanda TIDAK BOLEH membuat query saat who terkecuali"); },
    } as unknown as SupabaseClient;
    const hasil = await createMeetStore(db).adaTanda(A, B, [B]);
    expect(hasil).toBe(false);
  });

  it("pengecualian dibandingkan case-insensitive", async () => {
    const db = {
      from: () => { throw new Error("adaTanda TIDAK BOLEH membuat query saat who terkecuali"); },
    } as unknown as SupabaseClient;
    const hasil = await createMeetStore(db).adaTanda(A, B, [B.toUpperCase()]);
    expect(hasil).toBe(false);
  });

  it("who TIDAK terkecuali tetap menjalankan query seperti biasa", async () => {
    const eqCalls: [string, string][] = [];
    const rantai = (): unknown => ({
      select: () => rantai(),
      eq: (k: string, v: string) => { eqCalls.push([k, v]); return rantai(); },
      maybeSingle: async () => ({ data: { target: A }, error: null }),
    });
    const db = { from: () => rantai() } as unknown as SupabaseClient;
    const hasil = await createMeetStore(db).adaTanda(A, B, []);
    expect(hasil).toBe(true);
    expect(eqCalls).toEqual([["target", A.toLowerCase()], ["who", B.toLowerCase()]]);
  });
});

/**
 * Fake untuk `tandaOleh`/`tandaKe`: mengembalikan baris apa adanya lewat
 * `.limit()`, TANPA `.not()`/`.in()` apa pun — penyaringan pengecualian
 * terjadi di JS sesudahnya, jadi fake ini sengaja tidak merekam filter,
 * hanya baris yang dikembalikan.
 */
function limitDbPalsu(baris: TandaDbRow[]) {
  const rantai = (): unknown => ({
    select: () => rantai(),
    eq: () => rantai(),
    limit: () => ({ then: (r: (v: unknown) => unknown) => r({ data: baris, error: null }) }),
  });
  const db = { from: () => rantai() } as unknown as SupabaseClient;
  return { db };
}

describe("tandaOleh menyaring kolom TARGET, bukan WHO", () => {
  it("baris dengan target terblokir dibuang; baris dengan who terblokir (target lain) TETAP ada", async () => {
    const baris: TandaDbRow[] = [
      { target: B, who: A, created_at: T1 }, // target diblokir -> DIBUANG
      { target: OTHER1, who: B, created_at: T1 }, // who diblokir, target beda -> TETAP
      { target: OTHER2, who: A, created_at: T2 }, // tidak terkait -> TETAP
    ];
    const { db } = limitDbPalsu(baris);
    const hasil = await createMeetStore(db).tandaOleh(A, [B]);
    // Kalau implementasi keliru menyaring kolom `who` alih-alih `target`,
    // baris kedua akan ikut terbuang dan baris pertama akan lolos — urutan
    // dan isi himpunan di bawah ini akan berbeda dan tes ini merah.
    expect(hasil.map((h) => h.address)).toEqual([OTHER1, OTHER2]);
  });
});

describe("tandaKe menyaring kolom WHO, bukan TARGET", () => {
  it("baris dengan who terblokir dibuang; baris dengan target terblokir (who lain) TETAP ada", async () => {
    const baris: TandaDbRow[] = [
      { target: A, who: B, created_at: T1 }, // who diblokir -> DIBUANG
      { target: B, who: OTHER1, created_at: T1 }, // target diblokir, who beda -> TETAP
      { target: A, who: OTHER2, created_at: T2 }, // tidak terkait -> TETAP
    ];
    const { db } = limitDbPalsu(baris);
    const hasil = await createMeetStore(db).tandaKe(A, [B]);
    expect(hasil.map((h) => h.address)).toEqual([OTHER1, OTHER2]);
  });
});
