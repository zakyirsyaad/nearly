import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Penjaga penyebaran ganda (2026-09-27). API berjalan di dua tempat: proses
 * Node (`src/index.ts`) dan serverless Vercel (`api/index.ts`). Bahaya yang
 * dijaga di sini bukan "tidak jalan" — melainkan dua entri yang perlahan
 * membangun dependensi berbeda, sehingga produksi berperilaku lain dari
 * pengembangan tanpa satu pun tes merah.
 */
const baca = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

describe("entri Vercel dan entri Node", () => {
  it("keduanya memakai satu pembangun dependensi yang sama", () => {
    for (const berkas of ["src/entri-vercel.ts", "src/index.ts"]) {
      expect(baca(berkas), berkas).toContain("buatAplikasiProduksi");
      // Tidak boleh menyusun deps sendiri: itulah cara keduanya bercabang.
      expect(baca(berkas), berkas).not.toContain("createApp(");
    }
  });

  it("entri serverless tidak menyalakan server yang mendengarkan port", () => {
    const isi = baca("src/entri-vercel.ts");
    expect(isi).not.toContain("serve(");
    expect(isi).toContain('from "@hono/node-server/vercel"');
  });

  it("entri Node tetap menyajikan port dan menjalankan sapuan saat mulai", () => {
    const isi = baca("src/index.ts");
    expect(isi).toContain("serve({");
    expect(isi).toContain("sapuLokasiAman(radar");
  });
});

describe("vercel.json", () => {
  const cfg = JSON.parse(baca("vercel.json"));

  it("seluruh path diarahkan ke satu fungsi — API ini satu aplikasi Hono", () => {
    expect(cfg.rewrites).toEqual([{ source: "/(.*)", destination: "/api/index" }]);
  });

  it("jalur cron sama dengan rute yang benar-benar didaftarkan kode", () => {
    // Drift di sini senyap: cron akan memanggil 404 setiap hari tanpa keluhan,
    // dan retensi lokasi berhenti disapu tanpa ada yang tahu.
    const jalurCron = cfg.crons.map((c: { path: string }) => c.path);
    for (const jalur of jalurCron) {
      expect(baca("src/routes/tugas.ts")).toContain(`r.get("${jalur}"`);
    }
    expect(jalurCron).toContain("/tugas/sapu-lokasi");
  });

  it("fungsi yang disebarkan adalah bundel JS, bukan TypeScript mentah", () => {
    // Paket ini `type: "module"` sementara seluruh kode mengimpor tanpa
    // ekstensi berkas — sah untuk `moduleResolution: "Bundler"` dan `tsx`,
    // tapi ESM Node menolaknya saat runtime. Menyerahkan .ts apa adanya ke
    // Vercel BERHASIL DIBANGUN lalu mati di setiap permintaan dengan
    // ERR_MODULE_NOT_FOUND. Bundel menghapus resolusi modul relatif.
    const berkas = Object.keys(cfg.functions);
    expect(berkas).toEqual(["api/index.js"]);
    expect(cfg.buildCommand).toContain("build:vercel");
    const pkg = JSON.parse(baca("package.json"));
    expect(pkg.scripts["build:vercel"]).toContain("--bundle");
    expect(pkg.scripts["build:vercel"]).toContain("--outfile=api/index.js");
  });

  it("deteksi backend framework dimatikan", () => {
    // Dibiarkan menyala, Vercel membangun fungsi KEDUA dari src/app.ts dengan
    // kompilasi TypeScript per-berkas — yang mati oleh impor tanpa ekstensi —
    // lalu routing mode framework memblokir tujuan rewrite kita
    // (`^/api(/.*)?$ -> 404`) dan menjatuhkan SEMUA permintaan ke fungsi rusak
    // itu. Gejalanya menipu: build hijau, bundel benar terbentuk, tapi setiap
    // permintaan 500.
    expect(cfg.framework).toBeNull();
  });

  it("batas durasi ada dan masih di dalam batas paket Hobby (60 detik)", () => {
    const d = cfg.functions["api/index.js"].maxDuration;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(60);
  });
});
