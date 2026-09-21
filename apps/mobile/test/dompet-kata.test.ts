import { describe, expect, it } from "vitest";
import { kataHarusDitutup } from "../src/dompet/tampil-kata";
import { baca, tanpaKomentar } from "./support/berkas";

describe("kataHarusDitutup (review B1 M3)", () => {
  it("12 kata boleh terbuka hanya selagi aplikasi aktif", () => {
    expect(kataHarusDitutup("active")).toBe(false);
  });

  // iOS berpindah ke "inactive" saat app switcher dibuka, dan cuplikannya
  // diambil sebelum "background" — menunggu "background" sudah terlambat.
  it("keadaan selain active menutup kata, termasuk inactive", () => {
    for (const k of ["inactive", "background", "unknown", "extension"]) {
      expect(kataHarusDitutup(k), k).toBe(true);
    }
  });
});

describe("layar Dompet menutup 12 kata (review B1 M3)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/dompet.tsx"));

  it("ditutup saat layar kehilangan fokus — tab tetap terpasang saat pindah tab", () => {
    expect(isi()).toMatch(
      /useFocusEffect\(useCallback\(\(\) => \{\s*fokus\.current = true;\s*return \(\) => \{\s*fokus\.current = false;\s*setKata\(null\);/,
    );
  });

  it("ditutup saat aplikasi meninggalkan keadaan aktif, dan langganannya dilepas", () => {
    const x = isi();
    expect(x).toMatch(/AppState\.addEventListener\("change", \(k\) => \{\s*if \(kataHarusDitutup\(k\)\) setKata\(null\);/);
    expect(x).toContain("return () => langganan.remove();");
  });

  it("kata yang selesai dibaca setelah layar ditinggalkan tidak dibuka", () => {
    const x = isi();
    const buka = x.slice(x.indexOf("const bukaKata = async"));
    const cek = buka.indexOf("if (!fokus.current || kataHarusDitutup(AppState.currentState)) return;");
    expect(cek).toBeGreaterThan(-1);
    expect(cek).toBeLessThan(buka.indexOf("setKata(kataBernomor(m));"));
  });

  it("hook dipanggil sebelum return awal (aturan hook React)", () => {
    const x = isi();
    const returnAwal = x.indexOf("if (address === null) return null;");
    expect(x.indexOf("useFocusEffect(")).toBeLessThan(returnAwal);
    expect(x.indexOf("AppState.addEventListener(")).toBeLessThan(returnAwal);
  });
});
