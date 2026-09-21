import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Butir Minor review menyeluruh Rencana B1 (docs/superpowers/plans/
// 2026-09-21-catatan-minor-untuk-b2.md). Tes baca-kode: repo tidak punya
// harness render RN.

/** Potongan dari `awal` sampai `akhir` (keduanya harus ada). */
export function potong(isi: string, awal: string, akhir: string): string {
  const i = isi.indexOf(awal);
  const j = isi.indexOf(akhir, i + 1);
  expect(i, awal).toBeGreaterThan(-1);
  expect(j, akhir).toBeGreaterThan(i);
  return isi.slice(i, j);
}

describe("Profil orang: vouch dan laporan menolak ketukan ganda (M2)", () => {
  const isi = () => tanpaKomentar(baca("app/profile/[address].tsx"));

  it.each([
    ["handleVouch", "vouchBerjalan"],
    ["handleReport", "laporBerjalan"],
  ])("%s dijaga ref %s sebelum await pertama, dan dilepas di finally", (fungsi, ref) => {
    const badan = potong(isi(), `async function ${fungsi}() {`, "\n  }\n");
    const sebelumAwait = badan.slice(0, badan.indexOf("await "));
    // Ref, bukan state: dua ketukan dalam satu frame sama-sama membaca state
    // lama dari closure render yang sama.
    expect(sebelumAwait).toContain(`${ref}.current) return;`);
    expect(sebelumAwait).toContain(`${ref}.current = true;`);
    expect(badan).toMatch(new RegExp(`finally \\{[\\s\\S]*${ref}\\.current = false;`));
  });
});

describe("Button membungkus teks pada huruf besar (M5)", () => {
  const isi = () => baca("components/ui/button.tsx");

  it("ukuran default, sm, dan lg memakai minHeight, bukan height tetap", () => {
    const x = isi();
    expect(x).toContain("{ minHeight: HEIGHT, paddingHorizontal: 16, paddingVertical: 8 }");
    expect(x).toContain("{ minHeight: HEIGHT, paddingHorizontal: 32, paddingVertical: 8 }");
    expect(x).toContain("{ minHeight: 54, paddingHorizontal: 36, paddingVertical: 8 }");
    expect(x).not.toMatch(/\bheight: (HEIGHT|54), paddingHorizontal/);
  });

  it("tombol ber-flex tidak dibatasi maxHeight", () => {
    expect(isi()).not.toContain("maxHeight");
  });

  it("teks tombol boleh menyusut dan membungkus di kedua jalur render", () => {
    const x = isi();
    expect(x).toContain("const TEKS_MEMBUNGKUS: TextStyle = { flexShrink: 1, textAlign: 'center' };");
    expect(x.match(/style=\{\[finalTextStyle, TEKS_MEMBUNGKUS, textStyle\]\}/g)?.length).toBe(2);
    expect(x.match(/style=\{BARIS_ISI\}/g)?.length).toBe(3);
  });
});

describe("Profil orang: tombol Done setinggi target sentuh (M6)", () => {
  it("Pressable Done memakai gaya selesai dengan minHeight UKURAN.sentuh", () => {
    const x = tanpaKomentar(baca("app/profile/[address].tsx"));
    expect(x).toMatch(/<Pressable onPress=\{\(\) => Keyboard\.dismiss\(\)\}[^>]*style=\{s\.selesai\}/);
    expect(x).toMatch(/selesai: \{ minHeight: UKURAN\.sentuh, justifyContent: "center" \}/);
  });
});

describe("Kecocokan: muat ulang yang gagal tidak mengosongkan daftar (M1, M11)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/kecocokan.tsx"));

  it("catch memuat galat tanpa membuang baris yang sudah tampil", () => {
    const muat = potong(isi(), "const muat = useCallback(", "}, [signer, muatUlangLencana]);");
    expect(muat).not.toContain("setBaris([])");
    expect(muat).toContain("setPesan(");
  });

  it("muat pertama yang gagal tampil sebagai galat + Try again, bukan kerangka selamanya", () => {
    expect(isi()).toMatch(
      /if \(baris === null\) \{[\s\S]*?\{pesan \? \(\s*<KeadaanGalat kalimat=\{pesan\} onCobaLagi=\{\(\) => void muat\(\)\} \/>/,
    );
  });

  it("galat di atas daftar yang sudah tampil punya Try again", () => {
    expect(isi()).toContain(
      "ListHeaderComponent={pesan ? <KeadaanGalat kalimat={pesan} onCobaLagi={() => void muat()} /> : null}",
    );
  });

  it("daftar kosong di samping galat bukan keadaan kosong; muat saat fokus tetap satu pemicu", () => {
    const x = isi();
    expect(x).toMatch(/ListEmptyComponent=\{\s*pesan \? null : \(/);
    expect(x).toContain("useFocusEffect(useCallback(() => { void muat(); }, [muat]));");
    expect(x).not.toMatch(/\buseEffect\(/);
  });
});

describe("Diblokir: muat ulang yang gagal tidak mengosongkan daftar (M1, M11)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/blokir.tsx"));

  it("galat muat terpisah dari pesan aksi, dan tidak mengosongkan baris", () => {
    const muat = potong(isi(), "const muatDenganGalat = useCallback(", "}, [muat]);");
    expect(muat).toContain("setGalatMuat(");
    expect(muat).not.toContain("setBaris(");
  });

  it("muat pertama yang gagal tampil sebagai galat + Try again", () => {
    expect(isi()).toMatch(
      /if \(baris === null\) \{[\s\S]*?\{galatMuat \? \(\s*<KeadaanGalat kalimat=\{galatMuat\} onCobaLagi=\{\(\) => void muatDenganGalat\(\)\} \/>/,
    );
  });

  it("galat di atas daftar yang sudah tampil punya Try again; pesan aksi tetap teks", () => {
    const x = isi();
    expect(x).toContain("{galatMuat ? <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatDenganGalat()} /> : null}");
    expect(x).toContain("{pesan ? <Text variant=\"caption\">{pesan}</Text> : null}");
  });

  it("daftar kosong di samping galat bukan keadaan kosong; muat saat fokus lewat muatDenganGalat", () => {
    const x = isi();
    expect(x).toMatch(/ListEmptyComponent=\{\s*galatMuat \? null : \(/);
    expect(x).toContain("useFocusEffect(useCallback(() => { void muatDenganGalat(); }, [muatDenganGalat]));");
  });
});

describe("Profil (tab): kepala memakai nama TERSIMPAN (M4) dan baris tautan bertanda chevron (E2)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/profil-saya.tsx"));

  it("kepala tidak menampilkan isian yang sedang diketik, dan tidak 'Unnamed' setelah gagal muat", () => {
    const kepala = potong(isi(), "<View style={s.kepala}>", "{trust ?");
    expect(kepala).toContain('{namaTersimpan ? <Text variant="title">{namaTersimpan}</Text> : null}');
    expect(kepala).not.toContain("{nama}");
    expect(kepala).not.toContain("namaKartuRadar(");
  });

  it("nama tersimpan diisi saat muat berhasil dan saat simpan berhasil", () => {
    const x = isi();
    const muat = potong(x, "const muatProfil = useCallback(", "}, [signer]);");
    expect(muat).toContain("setNamaTersimpan(p.displayName.trim() || null);");
    const simpan = potong(x, "async function simpan() {", "\n  }\n");
    expect(simpan).toMatch(/await simpanProfil\([\s\S]*setNamaTersimpan\(cek\.nama\.trim\(\) \|\| null\);/);
  });

  it("BarisTautan menampilkan ChevronRight redup dan labelnya boleh membungkus", () => {
    const baris = potong(isi(), "function BarisTautan(", "\n}\n");
    expect(baris).toContain("<ChevronRight color={redup} size={20} />");
    expect(baris).toContain("style={[s.tebal, s.menyusut]}");
  });
});
