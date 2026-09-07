import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMeetStore, rowToTanda, type TandaDbRow } from "../src/meet-store";
import { potongKelompok } from "../src/feed-store";

describe("rowToTanda", () => {
  const row: TandaDbRow = {
    target: "0x00000000000000000000000000000000000000aa",
    who: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-07T10:00:00.000Z",
  };

  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToTanda(row, "who").atMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  // Satu baris dibaca dari DUA arah: saat mencari "siapa yang kutandai" yang
  // menarik adalah `target`; saat mencari "siapa yang menandaiku" yang
  // menarik adalah `who`. Satu pemeta, dua sisi.
  it("mengambil sisi yang diminta", () => {
    expect(rowToTanda(row, "target").address).toBe(row.target);
    expect(rowToTanda(row, "who").address).toBe(row.who);
  });
});

describe("potongKelompok dipakai ulang dari feed-store", () => {
  it("memotong 250 alamat menjadi tiga kelompok maksimal 100", () => {
    const alamat = Array.from({ length: 250 }, (_, i) => `0x${String(i).padStart(40, "0")}`);
    const kelompok = potongKelompok(alamat);
    expect(kelompok).toHaveLength(3);
    for (const k of kelompok) expect(k.length).toBeLessThanOrEqual(100);
    expect(kelompok.flat()).toHaveLength(250);
  });
});

/**
 * Tes di bawah ini menjalankan `createMeetStore` SUNGGUHAN lewat klien
 * Supabase palsu — bukan sekadar mengetes `rowToTanda`/`potongKelompok`
 * secara terisolasi. Polanya mengikuti `feed-store-mapping.test.ts`
 * (`dbPalsu` yang menjejaki `.eq()`/`.in()` lalu membalas lewat `.then()`).
 *
 * Tiga risiko yang harus tertangkap:
 * 1. `tandaOleh`/`tandaKe` bisa saling tertukar kolom filter atau sisi
 *    ekstraksinya — `db` bertipe `SupabaseClient` yang TIDAK tahu nama
 *    kolom, jadi `.eq("who", …)` vs `.eq("target", …)` cuma string biasa.
 * 2. `setTanda` bisa kehilangan salah satu dari dua `ensureProfile` —
 *    kompail lulus, tipe lulus, tapi FK violation muncul lagi di kasus
 *    paling umum fitur ini: menandai orang yang belum pernah handshake.
 * 3. `profilRingkas` bisa kehilangan `potongKelompok` — hasil tetap benar
 *    melawan fake, tapi proksi Supabase sungguhan menolak `.in()` beruas
 *    ratusan nilai (lihat komentar di `meet-store.ts`).
 */

describe("tandaOleh dan tandaKe: arah filter dan sisi ekstraksi", () => {
  type PanggilanEq = { tabel: string; eq: [string, string][]; limit: number | null };

  // Fake dangkal: hanya meniru `.from(tabel).select(...).eq(kolom, nilai)`
  // yang di-await langsung (thenable), cukup untuk membuktikan kolom filter
  // DAN baris yang dibalas, tanpa mensimulasikan Postgres sungguhan.
  // `.limit()` ikut dijejaki karena tanpa batas eksplisit kedua pembacaan ini
  // bergantung pada `db-max-rows` PostgREST — dan `tandaOleh` yang terpotong
  // diam-diam menjatuhkan kecocokan sungguhan dari GET /kecocokan.
  function dbPalsuEq(baris: TandaDbRow[]) {
    const jejak: PanggilanEq[] = [];
    const buat = (tabel: string) => {
      const rec: PanggilanEq = { tabel, eq: [], limit: null };
      jejak.push(rec);
      const b = {
        select: () => b,
        eq: (kolom: string, nilai: string) => { rec.eq.push([kolom, nilai]); return b; },
        limit: (n: number) => { rec.limit = n; return b; },
        then: (teruskan: (h: { data: unknown[]; error: null }) => unknown) =>
          teruskan({ data: baris, error: null }),
      };
      return b;
    };
    const db = { from: (tabel: string) => buat(tabel) } as unknown as SupabaseClient;
    return { db, jejak };
  }

  const BARIS: TandaDbRow = {
    target: "0x00000000000000000000000000000000000000aa",
    who: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-07T10:00:00.000Z",
  };
  const TARGET = "0x00000000000000000000000000000000000000AA" as Address;
  const WHO = "0x00000000000000000000000000000000000000BB" as Address;

  it("tandaOleh menyaring kolom who dan mengekstrak alamat dari target", async () => {
    const { db, jejak } = dbPalsuEq([BARIS]);
    const store = createMeetStore(db);

    const hasil = await store.tandaOleh(WHO);

    expect(jejak).toHaveLength(1);
    const [rec] = jejak;
    expect(rec?.tabel).toBe("ingin_bertemu");
    // Pin kolom filter — bukan cuma hasilnya, supaya .eq("target", …) yang
    // tertukar ke sini ikut tertangkap meski hasil baris masih sama.
    expect(rec?.eq).toEqual([["who", WHO.toLowerCase()]]);
    expect(hasil).toEqual([{ address: BARIS.target, atMs: Date.parse(BARIS.created_at) }]);
  });

  /**
   * Batas baris EKSPLISIT, bukan `db-max-rows` PostgREST yang tak terlihat di
   * kode. Keduanya diuji karena akibat terpotongnya berbeda-beda tapi
   * sama-sama senyap: `tandaOleh` yang terpotong menjatuhkan kecocokan
   * sungguhan dari GET /kecocokan — dua orang yang sudah saling menandai
   * tidak pernah diberi tahu.
   */
  it("tandaOleh dan tandaKe memasang batas baris eksplisit", async () => {
    const a = dbPalsuEq([BARIS]);
    await createMeetStore(a.db).tandaOleh(WHO);
    expect(a.jejak[0]?.limit).toBeGreaterThan(0);

    const b = dbPalsuEq([BARIS]);
    await createMeetStore(b.db).tandaKe(TARGET);
    expect(b.jejak[0]?.limit).toBe(a.jejak[0]?.limit);
  });

  /**
   * Terpotong harus TERLIHAT, bukan senyap. Kalau jumlah baris yang kembali
   * persis sama dengan batasnya, kemungkinan besar masih ada baris lain di
   * belakangnya — dan itulah momen kecocokan mulai hilang tanpa jejak.
   */
  it("memperingatkan kalau jumlah baris menyentuh batasnya", async () => {
    const batas = (() => {
      const { db, jejak } = dbPalsuEq([]);
      void createMeetStore(db).tandaOleh(WHO);
      return jejak[0]?.limit ?? 0;
    })();
    expect(batas).toBeGreaterThan(0);

    const penuh = Array.from({ length: batas }, () => BARIS);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await createMeetStore(dbPalsuEq(penuh).db).tandaOleh(WHO);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain("tandaOleh");

      warn.mockClear();
      await createMeetStore(dbPalsuEq([BARIS]).db).tandaOleh(WHO);
      // Di bawah batas TIDAK boleh berisik — peringatan yang muncul setiap
      // hari berhenti dibaca, dan justru saat penting ia ikut terlewat.
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("tandaKe menyaring kolom target dan mengekstrak alamat dari who", async () => {
    const { db, jejak } = dbPalsuEq([BARIS]);
    const store = createMeetStore(db);

    const hasil = await store.tandaKe(TARGET);

    expect(jejak).toHaveLength(1);
    const [rec] = jejak;
    expect(rec?.tabel).toBe("ingin_bertemu");
    expect(rec?.eq).toEqual([["target", TARGET.toLowerCase()]]);
    expect(hasil).toEqual([{ address: BARIS.who, atMs: Date.parse(BARIS.created_at) }]);
  });
});

describe("setTanda memastikan profil KEDUA pihak sebelum menandai", () => {
  type PanggilanUpsert = { table: string; payload: unknown; options?: unknown };

  // Fake dangkal: hanya meniru `.from(table).upsert(payload, options)`,
  // cukup untuk membuktikan urutan dan tujuan panggilan (pola sama seperti
  // "recordEvent memastikan profil host" di event-store-mapping.test.ts).
  function fakeSupabaseUpsert() {
    const panggilan: PanggilanUpsert[] = [];
    const db = {
      from(table: string) {
        return {
          upsert(payload: unknown, options?: unknown) {
            panggilan.push({ table, payload, options });
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown as SupabaseClient;
    return { db, panggilan };
  }

  const TARGET = "0x000000000000000000000000000000000000AAAA" as Address;
  const WHO = "0x000000000000000000000000000000000000BBBB" as Address;

  it("mengupsert profiles untuk target DAN who sebelum upsert ke ingin_bertemu", async () => {
    const { db, panggilan } = fakeSupabaseUpsert();
    const store = createMeetStore(db);

    await store.setTanda(TARGET, WHO, true);

    const upsertProfiles = panggilan.filter((p) => p.table === "profiles");
    // Kedua alamat wajib punya baris profiles — menandai orang yang belum
    // pernah handshake adalah kasus PALING UMUM fitur ini, dan kehilangan
    // salah satu ensureProfile mengembalikan FK violation mentah dari
    // Postgres persis di kasus itu.
    expect(upsertProfiles).toHaveLength(2);
    expect(upsertProfiles.map((p) => p.payload)).toEqual(
      expect.arrayContaining([
        { address: TARGET.toLowerCase() },
        { address: WHO.toLowerCase() },
      ]),
    );

    const indexIngin = panggilan.findIndex((p) => p.table === "ingin_bertemu");
    expect(indexIngin).toBeGreaterThan(-1);
    for (const p of upsertProfiles) {
      expect(panggilan.indexOf(p)).toBeLessThan(indexIngin);
    }
  });
});

describe("profilRingkas memotong .in() lewat store sungguhan", () => {
  type PanggilanIn = { tabel: string; in: [string, string[]][] };

  function dbPalsuIn(rows: Record<string, unknown[]>) {
    const jejak: PanggilanIn[] = [];
    const buat = (tabel: string) => {
      const rec: PanggilanIn = { tabel, in: [] };
      jejak.push(rec);
      const b = {
        select: () => b,
        in: (kolom: string, nilai: string[]) => { rec.in.push([kolom, nilai]); return b; },
        then: (teruskan: (h: { data: unknown[]; error: null }) => unknown) =>
          teruskan({ data: rows[tabel] ?? [], error: null }),
      };
      return b;
    };
    const db = { from: (tabel: string) => buat(tabel) } as unknown as SupabaseClient;
    return { db, jejak };
  }

  // 250 alamat unik -> tiga kelompok (100, 100, 50) lewat potongKelompok.
  const ALAMAT = Array.from(
    { length: 250 },
    (_, i) => `0x${String(i).padStart(40, "0")}`,
  ) as Address[];

  it("profilRingkas mengirim tepat tiga .in() per tabel untuk 250 alamat", async () => {
    const { db, jejak } = dbPalsuIn({ profiles: [], trust_snapshots: [] });
    const store = createMeetStore(db);

    await store.profilRingkas(ALAMAT);

    const inProfiles = jejak.filter((p) => p.tabel === "profiles").flatMap((p) => p.in);
    const inTrust = jejak.filter((p) => p.tabel === "trust_snapshots").flatMap((p) => p.in);
    // Bukan cuma hasil yang benar — satu `.in()` tak terpotong dengan 250
    // nilai tetap membalas benar melawan fake ini, tapi ditolak proksi
    // Supabase sungguhan. Jumlah panggilan `.in()` itu sendiri yang diuji.
    expect(inProfiles).toHaveLength(3);
    expect(inTrust).toHaveLength(3);
    for (const [, nilai] of [...inProfiles, ...inTrust]) {
      expect(nilai.length).toBeLessThanOrEqual(100);
    }
  });
});
