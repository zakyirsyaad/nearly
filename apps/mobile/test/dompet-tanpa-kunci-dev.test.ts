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

  // Domain EIP-712 per layar: check-in terikat AttendanceRegistry, sisanya
  // ConnectionRegistry. Kontrak yang salah tetap lolos tsc, tetapi tanda
  // tangannya ditolak API. Layar baru pemakai signer wajib ditambahkan di sini.
  it("setiap layar memakai kontrak EIP-712 yang benar untuk signernya", () => {
    const V = "verifyingContract";
    const HARAPAN: Record<string, string[]> = {
      "app/(tabs)/(acara)/events/[id].tsx": ["signer:attendanceRegistry"],
      "app/(tabs)/(acara)/events/[id]/host-qr.tsx": ["signer:attendanceRegistry"],
      "app/(tabs)/(acara)/events/new.tsx": ["signer:attendanceRegistry"],
      "app/(tabs)/(acara)/radar/[eventId].tsx": [`signer:${V}`],
      "app/(tabs)/(beranda)/feed/index.tsx": [`signer:${V}`],
      "app/(tabs)/(beranda)/feed/new.tsx": [`signer:${V}`],
      "app/(tabs)/(beranda)/index.tsx": [`signer:${V}`],
      "app/(tabs)/(pesan)/pesan/[address].tsx": [`signer:${V}`],
      "app/(tabs)/(pesan)/pesan/index.tsx": [`signer:${V}`],
      "app/(tabs)/(pesan)/pesan/lapor/[address].tsx": [`signer:${V}`],
      "app/(tabs)/(profil)/blokir.tsx": [`signer:${V}`],
      "app/(tabs)/(profil)/connections.tsx": [`signer:${V}`],
      "app/(tabs)/(profil)/kecocokan.tsx": [`signer:${V}`],
      "app/(tabs)/(profil)/profil-saya.tsx": [`signer:${V}`],
      "app/(tabs)/(salaman)/salaman.tsx": ["signerHadir:attendanceRegistry", `signerSalaman:${V}`],
      "app/profile/[address].tsx": [`signer:${V}`],
    };
    const nyata = Object.fromEntries(
      kode.filter((k) => k.isi.includes("useNearlySigner(") && k.berkas.startsWith("app/")).map((k) => [
        k.berkas,
        [...k.isi.matchAll(/const (\w+) = useNearlySigner\(CONFIG\.(\w+)\)/g)].map((m) => `${m[1]}:${m[2]}`),
      ]),
    );
    expect(nyata).toEqual(HARAPAN);
  });

  it("layar Salaman meneruskan signer hadir dan salaman ke prop yang sesuai", () => {
    const salaman = kode.find((k) => k.berkas === "app/(tabs)/(salaman)/salaman.tsx")!.isi;
    expect(salaman).toMatch(/<SalamanIsi\b[^>]*signerHadir=\{signerHadir\}[^>]*signerSalaman=\{signerSalaman\}/);
    expect(salaman).toContain("<ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />");
  });

  // key={signer.address}: saat dompet berganti, isi layar dipasang ulang
  // dari nol — tidak ada state dompet lama yang terbawa ke dompet baru.
  it("setiap pembungkus memasang isi dengan key alamat signer", () => {
    const PENGECUALIAN = new Set(["app/profile/[address].tsx"]);
    const layar = kode.filter((k) => k.berkas.startsWith("app/") && k.isi.includes("useNearlySigner(")
      && !PENGECUALIAN.has(k.berkas));
    expect(layar.length).toBeGreaterThan(0);
    const salah = layar.filter((k) => !/<\w+Isi\b[^>]*\bkey=\{signer\w*\.address\}/.test(k.isi)).map((k) => k.berkas);
    expect(salah).toEqual([]);
  });

  it("layar pemakai signer tidak lagi membuat signer sendiri lewat useMemo", () => {
    expect(yangMemuat(/const signer = useMemo\(/)).toEqual([]);
  });
});
