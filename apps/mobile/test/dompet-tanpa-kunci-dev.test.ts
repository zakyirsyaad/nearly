import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE = join(__dirname, "..");

function semuaBerkas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const jalur = join(dir, e.name);
    if (e.isDirectory()) return semuaBerkas(jalur);
    return /\.(ts|tsx)$/.test(e.name) ? [relative(MOBILE, jalur)] : [];
  });
}

const kode = [...semuaBerkas(join(MOBILE, "app")), ...semuaBerkas(join(MOBILE, "src"))]
  .map((berkas) => ({ berkas, isi: readFileSync(join(MOBILE, berkas), "utf8") }));

const yangMemuat = (pola: RegExp) => kode.filter((k) => pola.test(k.isi)).map((k) => k.berkas);

// Kunci dev yang terbundel membuat setiap orang yang membuka aplikasi menjadi
// orang yang sama, dan kuncinya terbaca dari bundel (spec dompet §1). Tes ini
// memastikan jalur itu tidak kembali lewat pintu belakang.
describe("tanpa kunci dev terbundel", () => {
  it("ada berkas yang diperiksa", () => {
    expect(kode.length).toBeGreaterThan(0);
  });

  it("tidak ada createDevSigner, devPrivateKey, atau EXPO_PUBLIC_DEV_PRIVATE_KEY di app/ dan src/", () => {
    expect(yangMemuat(/createDevSigner|devPrivateKey|EXPO_PUBLIC_DEV_PRIVATE_KEY/)).toEqual([]);
  });

  it("tidak ada pickSigner atau createWalletSigner di app/ dan src/", () => {
    expect(yangMemuat(/pickSigner|createWalletSigner/)).toEqual([]);
  });

  it("signer dari kunci hanya dibuat di konteks dompet", () => {
    expect(yangMemuat(/(?<!function )createSignerDariKunci\(/)).toEqual(["src/dompet/konteks-dompet.tsx"]);
  });

  it("expo-secure-store hanya disentuh penyimpan dompet", () => {
    expect(yangMemuat(/from "expo-secure-store"/)).toEqual(["src/dompet/penyimpan-dompet.ts"]);
  });

  // Ruling D4: layar yang mengambil signer dipecah menjadi pembungkus + isi.
  // Pembungkus hanya boleh memanggil useNearlySigner/useDompet lalu kembali
  // lebih awal; hook lain di pembungkus akan berjalan tanpa signer atau
  // dilewati secara kondisional.
  it("setiap layar pemakai useNearlySigner memakai pola pembungkus", () => {
    const PENGECUALIAN = new Set(["app/profile/[address].tsx"]); // signer boleh null di layar ini
    const layar = kode.filter((k) => k.berkas.startsWith("app/") && k.isi.includes("useNearlySigner("));
    expect(layar.length).toBeGreaterThan(0);
    const salah = layar.filter((k) => {
      if (PENGECUALIAN.has(k.berkas)) return false;
      const mulai = k.isi.indexOf("export default function");
      const akhir = k.isi.indexOf("\n}\n", mulai);
      const pembungkus = k.isi.slice(mulai, akhir);
      const hook = [...pembungkus.matchAll(/\b(use[A-Z]\w*)\(/g)].map((m) => m[1]);
      const hookLain = hook.filter((h) => h !== "useNearlySigner" && h !== "useDompet");
      return hookLain.length > 0 || !/if \(!signer/.test(pembungkus) || !/return \(?\s*<\w+Isi\b/.test(pembungkus);
    }).map((k) => k.berkas);
    expect(salah).toEqual([]);
  });

  it("layar pemakai signer tidak lagi membuat signer sendiri lewat useMemo", () => {
    expect(yangMemuat(/const signer = useMemo\(/)).toEqual([]);
  });
});
