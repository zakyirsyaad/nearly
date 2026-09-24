import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE = join(__dirname, "..");
const baca = (jalur: string) => readFileSync(join(MOBILE, jalur), "utf8");

// Tes baca-kode (pola warna-isian.test.ts): tidak ada harness render RN, jadi
// gerbang dan pembatas __DEV__ dijaga dari teks sumbernya.
describe("gerbang dompet", () => {
  it("_layout.tsx membungkus navigasi dengan ToastProvider lalu DompetProvider", () => {
    expect(baca("app/_layout.tsx")).toMatch(
      /<ToastProvider>\s*<DompetProvider>\s*<Navigasi \/>\s*<\/DompetProvider>\s*<\/ToastProvider>/,
    );
  });

  it("splash disembunyikan hanya setelah font dan keadaan dompet siap", () => {
    const layout = baca("app/_layout.tsx");
    const awalEkspor = layout.indexOf("export default function RootLayout");
    expect(awalEkspor).toBeGreaterThan(-1);
    expect(layout.slice(0, awalEkspor)).toContain("SplashScreen.preventAutoHideAsync()");
    expect(layout).toContain("const splashBoleh = bolehSembunyikanSplash(fontSelesai, keadaan);");
    expect(layout).toMatch(/if \(splashBoleh\) void SplashScreen\.hideAsync\(\)/);
    expect(layout).toContain("if (!splashBoleh) return null;");
    expect(layout.match(/SplashScreen\.hideAsync\(/g)?.length).toBe(1);
  });

  it("_layout.tsx menjaga KETIGA sisi dengan Stack.Protected", () => {
    const layout = baca("app/_layout.tsx");
    // Gerbang nama (2026-09-24) menyisipkan satu sisi di antara keduanya:
    // dompet siap tapi nama masih kosong.
    expect(layout).toMatch(/<Stack\.Protected guard=\{punyaDompet && perluNama\}>\s*\{layarMenurutDompet\(true, true\)/);
    expect(layout).toMatch(/<Stack\.Protected guard=\{punyaDompet && !perluNama\}>\s*\{layarMenurutDompet\(true\)/);
    expect(layout).toMatch(/<Stack\.Protected guard=\{!punyaDompet\}>\s*\{layarMenurutDompet\(false\)/);
  });

  it("gerbang nama memakai modul murni, bukan syarat inline", () => {
    expect(baca("app/_layout.tsx")).toContain("perluIsiNama(punyaDompet, namaTampilan)");
  });

  it("keadaan galat tidak pernah jatuh ke layar Mulai", () => {
    expect(baca("app/_layout.tsx")).toMatch(/keadaan === "galat"\) \{[\s\S]*?\{TEKS_COBA_LAGI\}/);
  });

  it("impor kunci privat di layar Mulai hanya dirender saat __DEV__", () => {
    const mulai = baca("app/mulai.tsx");
    const tombol = mulai.indexOf("{TEKS_IMPOR_KUNCI_DEV}");
    expect(tombol).toBeGreaterThan(-1);
    expect(mulai.slice(Math.max(0, tombol - 200), tombol)).toContain("{__DEV__ && (");
    expect(mulai).toContain('{__DEV__ && mode === "kunci-dev" && (');
  });

  it("layar Mulai menolak ketukan ganda dengan penjaga sinkron (ref) sebelum await pertama", () => {
    const mulai = baca("app/mulai.tsx");
    const jalankan = mulai.slice(mulai.indexOf("async function jalankan("));
    const awaitPertama = jalankan.indexOf("await ");
    expect(awaitPertama).toBeGreaterThan(-1);
    const sebelumAwait = jalankan.slice(0, awaitPertama);
    expect(sebelumAwait).toMatch(/if \(sibukRef\.current\) return;\s*sibukRef\.current = true;/);
    expect(jalankan).toMatch(/finally \{[\s\S]*?sibukRef\.current = false;/);
  });

  it("Ganti dompet: push dilupakan setelah dompet dihapus, lalu keadaan belum-ada", () => {
    const konteks = baca("src/dompet/konteks-dompet.tsx");
    const ganti = konteks.slice(konteks.indexOf("const gantiDompet = useCallback("));
    // Jalur berhasil = sesudah blok catch; lupakanPendaftaranPush di dalam
    // catch tidak dihitung.
    const berhasil = ganti.slice(ganti.indexOf("throw galat;"));
    expect(ganti).toMatch(/^[\s\S]*?await lupakanDompet\(\);/);
    expect(berhasil).toMatch(/^throw galat;\s*\}[^}]*?lupakanPendaftaranPush\(\);\s*setStatus\(\{ keadaan: "belum-ada" \}\);/);
  });

  it("Ganti dompet yang gagal di tengah jalan menyamakan keadaan dengan isi penyimpan", () => {
    const konteks = baca("src/dompet/konteks-dompet.tsx");
    const ganti = konteks.slice(konteks.indexOf("const gantiDompet = useCallback("), konteks.indexOf("}, []);", konteks.indexOf("const gantiDompet = useCallback(")));
    expect(ganti).toMatch(/catch \(galat\) \{[\s\S]*?lupakanPendaftaranPush\(\);[\s\S]*?setStatus\(await keadaanPenyimpan\(\)\);[\s\S]*?throw galat;/);
  });

  it("muatUlang membaca keadaan lewat keadaanPenyimpan", () => {
    const konteks = baca("src/dompet/konteks-dompet.tsx");
    expect(konteks).toMatch(/const muatUlang = useCallback\(\(\) => \{\s*setStatus\(\{ keadaan: "memuat" \}\);\s*void keadaanPenyimpan\(\)\.then\(setStatus\);/);
  });

  it("isian 12 kata & kunci dev: Android tanpa autofill dan tanpa keyboard yang belajar", () => {
    const mulai = baca("app/mulai.tsx");
    const blokMnemonik = mulai.slice(mulai.indexOf('{mode === "mnemonik" && ('), mulai.indexOf("{PERINGATAN_MNEMONIK_UTAMA}"));
    const blokKunci = mulai.slice(mulai.indexOf('{__DEV__ && mode === "kunci-dev" && ('), mulai.indexOf("{PERINGATAN_KUNCI_DEV}"));
    for (const blok of [blokMnemonik, blokKunci]) {
      expect(blok).toContain("<Input");
      expect(blok).toContain('importantForAutofill="no"');
      expect(blok).toContain("autoCorrect={false}");
      expect(blok).toContain('autoComplete="off"');
    }
    // Gboard tetap belajar dari ketikan walau autoCorrect mati; tipe
    // visible-password mematikan saran dan pembelajaran kata.
    expect(blokMnemonik).toContain('keyboardType={Platform.OS === "android" ? "visible-password" : "default"}');
  });

  it("konteks meneruskan __DEV__ ke imporDompetKunciDev", () => {
    expect(baca("src/dompet/konteks-dompet.tsx")).toContain("imporDompetKunciDev(teks, __DEV__)");
  });

  it("modul dompet murni tidak mengimpor react, react-native, atau expo", () => {
    for (const berkas of ["src/dompet/dompet.ts", "src/dompet/aksi-dompet.ts", "src/dompet/teks-dompet.ts"]) {
      expect(baca(berkas), berkas).not.toMatch(/from "(react-native|expo[^"]*|react)"/);
    }
  });

  it("layar Mulai mematikan perekaman QuickType/autocomplete pada isian mnemonik & kunci dev", () => {
    const mulai = baca("app/mulai.tsx");
    // Kedua isian harus memiliki textContentType="none"
    const kecocokan = mulai.match(/textContentType="none"/g);
    expect(kecocokan?.length).toBe(2);
  });
});
