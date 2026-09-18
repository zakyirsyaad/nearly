import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE = join(__dirname, "..");
const baca = (jalur: string) => readFileSync(join(MOBILE, jalur), "utf8");

// Tes baca-kode (pola warna-isian.test.ts): tidak ada harness render RN, jadi
// gerbang dan pembatas __DEV__ dijaga dari teks sumbernya.
describe("gerbang dompet", () => {
  it("_layout.tsx membungkus navigasi dengan DompetProvider", () => {
    expect(baca("app/_layout.tsx")).toMatch(/<DompetProvider>\s*<Navigasi \/>\s*<\/DompetProvider>/);
  });

  it("_layout.tsx menjaga kedua sisi dengan Stack.Protected", () => {
    const layout = baca("app/_layout.tsx");
    expect(layout).toMatch(/<Stack\.Protected guard=\{punyaDompet\}>\s*\{layarMenurutDompet\(true\)/);
    expect(layout).toMatch(/<Stack\.Protected guard=\{!punyaDompet\}>\s*\{layarMenurutDompet\(false\)/);
  });

  it("keadaan galat tidak pernah jatuh ke layar Mulai", () => {
    expect(baca("app/_layout.tsx")).toMatch(/keadaan === "galat"\) \{[\s\S]*?Coba lagi/);
  });

  it("impor kunci privat di layar Mulai hanya dirender saat __DEV__", () => {
    const mulai = baca("app/mulai.tsx");
    const tombol = mulai.indexOf("Impor kunci privat (khusus pengembangan)");
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
    // Kedua TextInput harus memiliki textContentType="none"
    const kecocokan = mulai.match(/textContentType="none"/g);
    expect(kecocokan?.length).toBe(2);
  });
});
