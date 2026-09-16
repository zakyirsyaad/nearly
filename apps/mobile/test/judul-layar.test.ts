import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { JUDUL_LAYAR } from "../src/judul-layar";

const APP = join(__dirname, "..", "app");

/** Nama rute expo-router untuk setiap berkas layar: `app/events/[id].tsx` → `events/[id]`. */
function semuaRute(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const jalur = join(dir, e.name);
    if (e.isDirectory()) return semuaRute(jalur);
    if (!e.name.endsWith(".tsx") || e.name.startsWith("_")) return [];
    return [relative(APP, jalur).replace(/\.tsx$/, "")];
  });
}

// Tanpa judul, header menampilkan nama rute mentah ("events/new",
// "profile/[address]") — ditemukan di iPhone saat uji lapangan Fase 4b + 5.
// Layar baru yang lupa didaftarkan harus membuat tes ini merah.
describe("judul layar", () => {
  it("setiap berkas layar di app/ punya judul", () => {
    const tanpaJudul = semuaRute().filter((r) => !(r in JUDUL_LAYAR));
    expect(tanpaJudul).toEqual([]);
  });

  it("tidak ada judul untuk rute yang sudah tidak ada", () => {
    const rute = new Set(semuaRute());
    expect(Object.keys(JUDUL_LAYAR).filter((r) => !rute.has(r))).toEqual([]);
  });

  it("judul tidak kosong dan bukan nama rute", () => {
    for (const [rute, judul] of Object.entries(JUDUL_LAYAR)) {
      expect(judul.trim(), rute).not.toBe("");
      expect(judul, rute).not.toMatch(/[\/\[\]]/);
    }
  });

  // Memeriksa pemakaian, bukan sekadar nama: impor saja tanpa pendaftaran
  // meloloskan tes versi awal, dan judul yang ditulis tangan di layout akan
  // lolos dari tes "setiap layar punya judul" di atas.
  it("_layout.tsx mendaftarkan SEMUA judul dari JUDUL_LAYAR, tanpa judul tulisan tangan", () => {
    const layout = readFileSync(join(APP, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/Object\.entries\(JUDUL_LAYAR\)\.map\(/);
    expect(layout).not.toMatch(/title:\s*"/);
  });
});
