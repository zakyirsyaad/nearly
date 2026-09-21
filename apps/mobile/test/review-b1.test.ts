import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Temuan review menyeluruh Rencana B1 (2026-09-21). Tes baca-kode: repo tidak
// punya harness render RN (pola yang sama dengan test/review-fondasi.test.ts).

/** Potongan JSX dari `awal` sampai `akhir` (keduanya harus ada). */
function potong(isi: string, awal: string, akhir: string): string {
  const i = isi.indexOf(awal);
  const j = isi.indexOf(akhir, i + 1);
  expect(i, awal).toBeGreaterThan(-1);
  expect(j, akhir).toBeGreaterThan(i);
  return isi.slice(i, j);
}

describe("gagal memuat koneksi bukan keadaan kosong (review B1 #I3, spec §7.2)", () => {
  it("Beranda: catch tidak mengosongkan daftar, dan galat tampil dengan Try again", () => {
    const isi = tanpaKomentar(baca("app/(tabs)/(beranda)/index.tsx"));
    const muat = potong(isi, "const muatKoneksi = useCallback(", "}, [signer.address]);");
    expect(muat).not.toContain("setKoneksi([])");
    expect(muat).toContain("setGalatKoneksi(true)");
    const bagian = potong(isi, "{JUDUL_RECENTLY_MET}", "{JUDUL_FEED}");
    expect(bagian).toContain("<KeadaanGalat kalimat={TEKS_GAGAL_MUAT_KONEKSI} onCobaLagi={() => void muatKoneksi()} />");
    // Galat hanya menggantikan kerangka memuat — data lama yang sudah tampil
    // tetap tampil, dan keadaan kosong hanya untuk daftar yang benar-benar kosong.
    expect(bagian).toMatch(/koneksi === null \? \(\s*galatKoneksi \?/);
  });

  it("Koneksi: catch tidak mengosongkan daftar, dan galat tampil dengan Try again", () => {
    const isi = tanpaKomentar(baca("app/(tabs)/(profil)/connections.tsx"));
    expect(isi).not.toContain("setRows([])");
    expect(isi).toContain("setGalat(true)");
    expect(isi).toContain("<KeadaanGalat kalimat={TEKS_GAGAL_MUAT_KONEKSI} onCobaLagi={() => void muat()} />");
    expect(isi).toMatch(/if \(!rows\) \{\s*if \(galat\)/);
  });
});

describe("tab Profil: gagal muat tidak membuka formulir, kepala segar saat fokus (review B1 #I4)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/profil-saya.tsx"));

  it("formulir hanya terbuka setelah profil berhasil dimuat — bukan di finally", () => {
    const muat = potong(isi(), "const muatProfil = useCallback(", "}, [signer]);");
    // Kalau terbuka di finally, gagal muat menyisakan nilai bawaan
    // (nama kosong, "terlihat"), dan satu Save membuat orang yang memilih
    // Hidden tampil di radar tanpa pernah memilihnya.
    expect(muat).not.toContain("finally");
    expect(muat).toMatch(/setVisibilitas\(p\.visibilitas\);\s*setDimuat\(true\);/);
    expect(muat).toContain("setGalatMuat(");
  });

  it("gagal muat menggantikan bagian nama dan visibilitas dengan galat + Try again", () => {
    const x = isi();
    expect(x).toContain("<KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatProfil()} />");
    const galatDulu = x.indexOf("galatMuat ? (");
    expect(galatDulu).toBeGreaterThan(-1);
    expect(galatDulu).toBeLessThan(x.indexOf("{LABEL_NAMA_TAMPILAN}"));
  });

  it("angka koneksi dan tier dimuat saat fokus, dibatasi bolehMuatFokus (spec §4.6)", () => {
    const x = isi();
    const fokus = potong(x, "useFocusEffect(useCallback(() => {", "}, [muatKepala]));");
    expect(fokus).toContain("bolehMuatFokus(terakhir.current, kini)");
    expect(fokus).toContain("void muatKepala();");
    const kepala = potong(x, "const muatKepala = useCallback(", "}, [signer.address]);");
    expect(kepala).toContain("connectionCount");
    expect(kepala).toContain("fetchTrust(signer.address)");
  });
});
