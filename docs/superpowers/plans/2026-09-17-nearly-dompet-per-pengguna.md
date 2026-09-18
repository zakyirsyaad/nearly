# Dompet per Pengguna (dibuat di HP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti kunci dev yang terbundel (`EXPO_PUBLIC_DEV_PRIVATE_KEY`) dengan dompet 12 kata BIP-39 yang dibuat otomatis di HP dan disimpan di Keychain, lengkap dengan layar Mulai, layar Dompet, impor 12 kata, dan impor kunci privat khusus `__DEV__` — tetap di Expo Go.

**Architecture:** Modul murni `src/dompet/dompet.ts` membuat dan memvalidasi 12 kata serta menurunkan kunci jalur `m/44'/60'/0'/0/0`; `penyimpan-dompet.ts` satu-satunya pemakai `expo-secure-store`; `aksi-dompet.ts` merangkai alur tanpa React; `konteks-dompet.tsx` menyediakan `DompetProvider`, `useDompet()`, dan `useNearlySigner(kontrak)`. `app/_layout.tsx` menggerbangi rute dengan `Stack.Protected` (Mulai tanpa dompet, semua layar lain dengan dompet). Ke-17 layar yang tadinya membuat signer dari kunci dev dipecah menjadi pembungkus (ambil signer dari hook) + isi (kode lama).

**Tech Stack:** pnpm monorepo · TypeScript strict · Expo Router / React Native (Expo Go SDK 57) · viem 2.56 (`viem/accounts`: `english`, `mnemonicToAccount`, `privateKeyToAccount`) · `expo-secure-store` · Vitest

**Spec:** `docs/superpowers/specs/2026-09-17-nearly-dompet-per-pengguna-design.md` (spec induk: `docs/superpowers/specs/2026-09-03-nearly-design.md`)

## Global Constraints

### Keputusan terkunci (spec §2, verbatim)

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Platform | Tetap **Expo Go** — tanpa development build, tanpa akun Apple |
| 2 | Asal dompet | **Dibuat otomatis di HP**; tidak ada rencana menyambung dompet luar |
| 3 | Cadangan | **12 kata pemulihan bisa dilihat kapan saja**, tidak wajib di awal |
| 4 | Impor | **Impor 12 kata** untuk memakai alamat yang sudah ada (panitia, juri, seed) |
| 5 | Kunci dev | Dihapus dari aplikasi; identitas uji lama dipakai lewat **impor kunci privat khusus `__DEV__`** |
| 6 | Paket baru | Hanya `expo-secure-store` (didukung Expo Go) |

- **R1. Satu dompet lokal per HP, EOA biasa.** Akun lokal viem; HP hanya memanggil `signTypedData` EIP-712 dan tidak pernah mengirim transaksi.
- **R2. BIP-39 12 kata (daftar English), jalur `m/44'/60'/0'/0/0`** — alamat yang sama dengan MetaMask untuk 12 kata yang sama. Impor hanya menerima 12 kata dengan checksum yang benar.
- **R3. Kunci diturunkan sekali.** PBKDF2-SHA512 2048 putaran (JS murni) hanya dijalankan saat membuat atau mengimpor dompet; yang disimpan adalah kunci privat hasil turunannya, sehingga membuka aplikasi tidak menurunkan ulang.
- **R4. `expo-secure-store` dengan `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`** di setiap panggilan (baca, tulis, hapus). Tiga kunci penyimpan (§4.2). Penyimpan menolak menimpa dompet yang sudah ada.
- **R5. Impor kunci privat hanya saat `__DEV__`** — tombolnya tidak dirender di luar `__DEV__`, dan fungsi impornya menolak sendiri bila tidak dalam mode pengembangan.
- **R6. Gerbang di `app/_layout.tsx` dengan `Stack.Protected`** (expo-router 57). Keadaan `memuat` dan `galat` ditampilkan di luar navigator; keadaan `galat` **tidak pernah** jatuh ke layar Mulai.
- **R7. Layar tidak pernah memegang kunci.** `useNearlySigner(kontrak)` mengembalikan `NearlySigner | null`. Layar yang memakai signer dipecah menjadi komponen pembungkus (mengambil signer, kembali `null` bila belum siap) dan komponen isi (hook-hook lama), supaya urutan hook tidak pernah bergantung pada keberadaan signer.
- **R8. Ganti dompet membersihkan memori per alamat**: sesi pesan (kunci privat pesan), cache kunci lawan, cache pesan terbuka, dan penanda "push sudah didaftarkan".

### Batas jalur (spec §11, verbatim)

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` | `apps/api/**`, `apps/web/**`, `packages/**`, `supabase/**` |
| `pnpm-lock.yaml` (akibat `expo install`) | `apps/mobile/.env`, `.env` root (nilai apa pun) |
| `.env.example` root (komentar saja) | |
| `docs/superpowers/specs/2026-09-03-nearly-design.md`, `docs/demo/runbook.md` | |

### Paket

- **Satu-satunya paket baru: `expo-secure-store`**, dipasang dengan `npx expo install expo-secure-store` dari `apps/mobile`. Rentang yang ditulis Expo: **`~57.0.3`** (`expo/bundledNativeModules.json` SDK 57); versi terbaru di rentang itu per 2026-09-17: **57.0.4**. Jangan memasang dengan `pnpm add` versi lain, dan jangan memasang paket lain (termasuk `@scure/bip39` — lihat Ruling D2).

### Batas keras eksekusi

- **JANGAN membaca, mencetak, atau mengubah `.env` mana pun** (`.env` root, `apps/mobile/.env`). Nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` di `apps/mobile/.env` dihapus PEMILIK PROJECT.
- **JANGAN menjalankan server, Metro, Expo Go, atau simulator.** Layar diverifikasi lewat typecheck dan tes baca-kode; uji iPhone dilakukan pemilik project (Task 8 Step 10).
- **JANGAN sentuh** `apps/api`, `apps/web`, `packages`, `supabase`.
- Setiap commit memakai `git add` / `git rm` dengan **nama berkas eksplisit** (tidak pernah `git add -A` / `git add .`), dan pesan commit diakhiri baris `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Dilarang `git reset --hard`, `git clean`, `rm -r`, force-push, dan push.
- **Protokol mutasi** (dijalankan SETELAH commit task, Ruling D17): terapkan mutasi persis seperti tertulis → jalankan perintah tes yang disebut → **rekam nama tes yang merah** → kembalikan dengan `git checkout -- <berkas>` → jalankan ulang sampai hijau → `git status --short` kosong. Kalau mutasi TIDAK memerahkan tes yang disebut, laporkan — jangan menyetel tesnya sampai merah.

### Konvensi repo

- Impor relatif **tanpa ekstensi**. Identifier, komentar, dan semua teks yang terlihat pengguna berbahasa Indonesia.
- Semua perintah dijalankan dari **akar worktree**. Tes: `pnpm --filter @nearly/mobile exec vitest run <path>`; seluruh tes mobile: `pnpm --filter @nearly/mobile exec vitest run`; typecheck: `pnpm --filter @nearly/mobile exec tsc --noEmit`.
- Tes mobile **hanya fungsi murni atau baca-kode** (tidak ada harness render RN). Modul native (`expo-secure-store`) di-mock dengan `vi.mock` + pabrik.
- Setiap `<TextInput>` wajib `placeholderTextColor={WARNA.placeholder}` dan warna teks `WARNA.teks` (`test/warna-isian.test.ts`).
- Setiap berkas layar baru di `app/` wajib punya judul di `JUDUL_LAYAR` (`test/judul-layar.test.ts`).
- Judul tes TIDAK menyebut jumlah.
- Vektor uji dompet: `test test test test test test test test test test test junk` → kunci `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` → alamat `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (diverifikasi dengan viem 2.56.3 terpasang).

---

## Pemetaan Spec → Task

| Spec | Isi | Task |
|---|---|---|
| §4.1, R2, R3 | `dompet.ts`: 12 kata, checksum, normalisasi, kunci turunan, kunci privat | 1 |
| §4.2, R4 | `expo-secure-store` + `penyimpan-dompet.ts` + mock | 2 |
| §4.3 aksi, R5, R8 | `aksi-dompet.ts`, fungsi reset cache menjadi ekspor resmi | 3 |
| §4.3 teks & konteks, R7, R8 | `teks-dompet.ts`, `konteks-dompet.tsx`, `lupakanPendaftaranPush` | 4 |
| §5.1–§5.3, R5, R6 | Gerbang `_layout.tsx`, layar Mulai, layar Dompet, `JUDUL_LAYAR` | 5 |
| §4.3 signer, §5.4, §6, R7 | Migrasi 17 layar, `createSignerDariKunci`, spanduk beranda, tautan Profil saya, tes penjaga | 6 |
| §7 | Hapus `use-signer.ts`, `wallet-signer.ts` (6); hapus `devPrivateKey`, komentar `.env.example` (7) | 6, 7 |
| §10 tes | Tes per task + langkah mutasi | 1–7 |
| §12, §10 uji iPhone, §11 | Amandemen spec induk, runbook, verifikasi global & batas, serah terima | 8 |
| §8, §9 | Tidak ada kode (batas yang diakui, di luar lingkup); dilaporkan di Task 8 | 8 |

## Ruling (keputusan rencana di luar rencana yang disetujui)

- **D1. Impor hanya menerima 12 kata** (bukan 24). Alasan: aplikasi hanya membuat 12 kata, dan 24 kata dari aplikasi lain hampir selalu dompet utama berisi aset — persis yang diperingatkan layar Mulai.
- **D2. `buatMnemonik` dan `mnemonikSah` ditulis sendiri di atas `english` dan `sha256` viem; `generateMnemonic`/`validateMnemonic` tidak dipakai.** Alasan: (a) `mnemonicToAccount` viem 2.56.3 **tidak** memeriksa checksum — 12 kali "test" diterima dan menghasilkan `0x72e37d393c70823113a7176aC1F7C579d2C5623E`; (b) `validateMnemonic` tidak diekspor `viem/accounts`, dan `@scure/bip39` bukan dependensi langsung `@nearly/mobile` (pnpm tidak mengizinkan impor transitif); (c) `generateMnemonic` memakai `randomBytes` `@noble/hashes`, yang mengambil `globalThis.crypto` **saat modul dimuat** (`@noble/hashes/crypto.js`), padahal di Hermes objek itu baru ada setelah `src/polyfills.ts` berjalan — urutan muat modul Metro tidak bisa diuji di vitest. Implementasinya diuji dengan vektor resmi BIP-39 dan disilangkan dengan `generateMnemonic` viem di Node.
- **D3. Alur tanpa React dipisah ke `aksi-dompet.ts`, kalimat ke `teks-dompet.ts`; `konteks-dompet.tsx` tipis.** Alasan: tes mobile hanya fungsi murni — logika di dalam provider tidak akan teruji.
- **D4. Layar pemakai signer dipecah menjadi pembungkus + isi** (`<Nama>Isi`, `key={signer.address}`), bukan `if (!signer) return null` di tempat. Alasan (spec §6): saat Ganti dompet, layar yang masih di tumpukan dirender ulang dengan signer `null`; pengembalian awal sebelum hook lain mengubah jumlah hook → React melempar galat. `app/profile/[address].tsx` dikecualikan karena sudah menangani signer `null`. Dijaga `test/dompet-tanpa-kunci-dev.test.ts`.
- **D5. Gerbang memakai `Stack.Protected`** (ada di expo-router 57.0.18 terpasang: `node_modules/expo-router/build/views/Protected.js`), bukan `<Redirect>` dari root layout. Keadaan `memuat`/`galat` dirender tanpa navigator, pola yang sama dengan templat Expo `if (!loaded) return null`.
- **D6. Keadaan keempat `galat`; `muatDompet` melempar `dompet_rusak` untuk isi kunci yang tidak sah; `simpanDompet` menolak menimpa (`dompet_sudah_ada`).** Alasan: tanpa itu, Keychain yang gagal terbaca membawa pengguna ke Mulai, dan "Buat dompet baru" menimpa identitasnya.
- **D7. Urutan SecureStore:** kunci ditulis terakhir dan dihapus pertama; opsi `OPSI_PENYIMPAN` yang sama di setiap panggilan, termasuk baca dan hapus.
- **D8. `imporDompetKunciDev(teks, modePengembangan)`** menerima `__DEV__` dari konteks sebagai penjaga kedua. Alasan: `__DEV__` tidak ada di vitest; parameter membuat penolakannya teruji.
- **D9. Impor 12 kata menandai `sudahDicadangkan = true`;** impor kunci privat tidak menyimpan mnemonik dan tidak memunculkan spanduk pengingat.
- **D10. Ganti dompet juga mereset penanda `sudahDicoba` di `src/pesan/push.ts`** lewat ekspor baru `lupakanPendaftaranPush()`. Temuan saat menulis rencana: `daftarkanPush` hanya mencoba sekali per kali buka aplikasi; tanpa reset, dompet baru tidak mendaftarkan token push sampai aplikasi ditutup, dan notifikasi dompet lama terus sampai. API sudah memindahkan token saat alamat baru mendaftar (`simpanTokenPush`, `apps/api/src/pesan-store.ts`). Dipanggil dari konteks, bukan `aksi-dompet.ts`, karena `push.ts` mengimpor `expo-notifications` yang tidak bisa dimuat di vitest.
- **D11. Nama ekspor resmi fungsi reset:** `lupakanSemuaSesiPesan` (`sesi.ts`), `lupakanCacheKunciLawan` dan `lupakanCacheBuka` (`pesan-actions.ts`).
- **D12. `RUTE_TANPA_DOMPET` dan `layarMenurutDompet` ditaruh di `src/judul-layar.ts`;** tes `_layout` di `test/judul-layar.test.ts` diganti, karena regex lama `Object.entries(JUDUL_LAYAR).map(` tidak bisa bertahan dengan dua penjaga.
- **D13. Ganti nama `createDevSigner` → `createSignerDariKunci` dilakukan di Task 6**, bersama hilangnya semua pemanggil lama. Alasan: setiap task wajib typecheck hijau; di Task 4 konteks memakai nama lama.
- **D14. Layar Mulai memberi jeda UI 50 ms sebelum PBKDF2** supaya "Menyiapkan dompet…" sempat tergambar (spec §8 batas #8).
- **D15. `.env.example` root: hanya komentar di atas `EXPO_PUBLIC_DEV_PRIVATE_KEY` yang diubah;** namanya tetap karena `scripts/uji-lapangan-pesan.ts` masih membacanya dari `.env` root.
- **D16. `npx expo install` boleh menambahkan `"expo-secure-store"` ke `plugins` di `apps/mobile/app.json`** (`@expo/cli` 57 punya `install/applyPlugins.js`). Perubahan itu di-commit apa adanya; plugin tidak berpengaruh di Expo Go.
- **D17. Langkah mutasi dijalankan setelah commit task**, supaya berkas yang baru dibuat pun bisa dikembalikan dengan `git checkout --`.

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `apps/mobile/src/dompet/dompet.ts` | Murni: 12 kata BIP-39, checksum, normalisasi, kunci turunan, kunci privat, alamat |
| `apps/mobile/src/dompet/penyimpan-dompet.ts` | Satu-satunya pemakai `expo-secure-store`: muat, simpan, baca mnemonik, tandai cadangan, hapus |
| `apps/mobile/src/dompet/aksi-dompet.ts` | Alur tanpa React: muat, buat, impor 12 kata, impor kunci dev, lupakan |
| `apps/mobile/src/dompet/teks-dompet.ts` | Semua kalimat dompet + `perluPengingatCadangan` |
| `apps/mobile/src/dompet/konteks-dompet.tsx` | `DompetProvider`, `useDompet`, `useNearlySigner` |
| `apps/mobile/src/signer.ts` (ubah) | `createDevSigner` → `createSignerDariKunci` |
| `apps/mobile/src/pesan/sesi.ts`, `pesan-actions.ts` (ubah) | Fungsi reset menjadi ekspor resmi |
| `apps/mobile/src/pesan/push.ts` (tambah di akhir) | `lupakanPendaftaranPush` |
| `apps/mobile/src/judul-layar.ts` (ubah) | Judul `mulai`/`dompet`, `RUTE_TANPA_DOMPET`, `layarMenurutDompet` |
| `apps/mobile/src/config.ts` (ubah) | Hapus `devPrivateKey` |
| `apps/mobile/src/meet-api.ts` (ubah) | Komentar `PenandaSigner` |
| `apps/mobile/app/_layout.tsx` (tulis ulang) | `DompetProvider` + gerbang `Stack.Protected` |
| `apps/mobile/app/mulai.tsx` | Layar Mulai |
| `apps/mobile/app/dompet.tsx` | Layar Dompet |
| `apps/mobile/app/index.tsx` (tulis ulang) | Pembungkus + spanduk cadangan + tautan Dompet |
| 16 layar lain di `apps/mobile/app/` (ubah) | Signer dari `useNearlySigner` |
| `apps/mobile/src/use-signer.ts`, `src/wallet-signer.ts`, `test/use-signer.test.ts` | Dihapus |
| `apps/mobile/test/dompet.test.ts`, `penyimpan-dompet.test.ts`, `aksi-dompet.test.ts`, `teks-dompet.test.ts`, `gerbang-dompet.test.ts`, `dompet-tanpa-kunci-dev.test.ts` | Tes baru |
| `apps/mobile/test/signer.test.ts`, `judul-layar.test.ts`, `pesan-sesi.test.ts`, `pesan-aksi.test.ts` (ubah) | Tes yang disesuaikan |
| `apps/mobile/package.json`, `pnpm-lock.yaml`, (mungkin) `apps/mobile/app.json` | `expo-secure-store` |
| `.env.example` (komentar) | Catatan bahwa aplikasi tidak lagi membaca kunci dev |
| `docs/superpowers/specs/2026-09-03-nearly-design.md`, `docs/demo/runbook.md` | Amandemen |

---

## Task 1: Inti dompet murni — `dompet.ts`

**Files:**
- Create: `apps/mobile/src/dompet/dompet.ts`
- Test: `apps/mobile/test/dompet.test.ts`

**Interfaces:**
- Consumes: `english`, `mnemonicToAccount`, `privateKeyToAccount` dari `viem/accounts`; `hexToBytes`, `sha256`, `toHex`, `Address`, `Hex` dari `viem` (semuanya sudah terpasang).
- Produces:
  - `const JUMLAH_KATA = 12`
  - `normalisasiMnemonik(teks: string): string`
  - `mnemonikDariEntropi(entropi: Uint8Array): string` — melempar bila bukan 16 bait
  - `buatMnemonik(): string`
  - `mnemonikSah(teks: string): boolean`
  - `kunciDariMnemonik(teks: string): Hex` — melempar `Error("mnemonik_tidak_sah")`
  - `normalisasiKunciPrivat(teks: string): Hex | null`
  - `kunciPrivatSah(teks: string): boolean`
  - `alamatDariKunci(kunci: Hex): Address`

Modul ini **tidak boleh** mengimpor `react`, `react-native`, atau `expo*` (dijaga di Task 5).

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/dompet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, type Hex } from "viem";
import {
  alamatDariKunci, buatMnemonik, JUMLAH_KATA, kunciDariMnemonik, kunciPrivatSah,
  mnemonikDariEntropi, mnemonikSah, normalisasiKunciPrivat, normalisasiMnemonik,
} from "../src/dompet/dompet";

// Vektor uji standar (Hardhat/Anvil): dompet pertama dari 12 kata ini.
const MNEMONIK_UJI = "test test test test test test test test test test test junk";
const ALAMAT_UJI = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const KUNCI_UJI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("mnemonikDariEntropi — vektor resmi BIP-39 (Trezor)", () => {
  const vektor: [string, string][] = [
    ["00".repeat(16), "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"],
    ["7f".repeat(16), "legal winner thank year wave sausage worth useful legal winner thank yellow"],
    ["80".repeat(16), "letter advice cage absurd amount doctor acoustic avoid letter advice cage above"],
    ["ff".repeat(16), "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"],
  ];
  for (const [entropi, kata] of vektor) {
    it(`entropi ${entropi.slice(0, 4)}… → ${kata.split(" ")[0]}…`, () => {
      expect(mnemonikDariEntropi(hexToBytes(`0x${entropi}` as Hex))).toBe(kata);
    });
  }

  it("menolak entropi yang bukan 16 bait", () => {
    expect(() => mnemonikDariEntropi(new Uint8Array(32))).toThrow();
  });
});

describe("mnemonikSah", () => {
  it("menerima vektor uji", () => {
    expect(mnemonikSah(MNEMONIK_UJI)).toBe(true);
  });

  it("menolak checksum salah — kata sah, urutan sah, bit terakhir salah", () => {
    // mnemonicToAccount milik viem MENERIMA ini; itu sebabnya pemeriksaan sendiri ada.
    expect(mnemonikSah("test test test test test test test test test test test test")).toBe(false);
  });

  it("menolak kata di luar daftar English", () => {
    expect(mnemonikSah("test test test test test test test test test test test jank")).toBe(false);
  });

  it("menolak jumlah kata yang salah", () => {
    expect(mnemonikSah("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art")).toBe(false);
    expect(mnemonikSah("")).toBe(false);
  });

  it("menerima huruf besar, spasi ganda, dan baris baru", () => {
    expect(mnemonikSah("  Test test\ttest  test\ntest test test test test test test JUNK \n")).toBe(true);
  });

  it("sepakat dengan generateMnemonic viem", () => {
    for (let i = 0; i < 25; i++) expect(mnemonikSah(generateMnemonic(english))).toBe(true);
  });
});

describe("normalisasiMnemonik", () => {
  it("huruf kecil dan satu spasi di antara kata", () => {
    expect(normalisasiMnemonik("  Test\n\nTEST test ")).toBe("test test test");
  });
});

describe("buatMnemonik", () => {
  it("menghasilkan kata yang sah, berbeda setiap kali", () => {
    const a = buatMnemonik();
    const b = buatMnemonik();
    expect(a.split(" ")).toHaveLength(JUMLAH_KATA);
    expect(mnemonikSah(a)).toBe(true);
    expect(mnemonikSah(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("kunciDariMnemonik", () => {
  it("vektor uji → kunci dan alamat yang dikenal (jalur m/44'/60'/0'/0/0)", () => {
    const kunci = kunciDariMnemonik(MNEMONIK_UJI);
    expect(kunci).toBe(KUNCI_UJI);
    expect(alamatDariKunci(kunci)).toBe(ALAMAT_UJI);
  });

  it("sama dengan mnemonicToAccount viem untuk mnemonik acak", () => {
    const m = buatMnemonik();
    expect(alamatDariKunci(kunciDariMnemonik(m))).toBe(mnemonicToAccount(m).address);
  });

  it("menormalkan dulu — huruf besar dan spasi tidak mengubah alamat", () => {
    expect(alamatDariKunci(kunciDariMnemonik(`  ${MNEMONIK_UJI.toUpperCase()}  `))).toBe(ALAMAT_UJI);
  });

  it("melempar untuk mnemonik tidak sah", () => {
    expect(() => kunciDariMnemonik("test test test test test test test test test test test test"))
      .toThrow("mnemonik_tidak_sah");
  });
});

describe("normalisasiKunciPrivat / kunciPrivatSah", () => {
  it("menerima dengan atau tanpa 0x, huruf besar menjadi kecil", () => {
    expect(normalisasiKunciPrivat(KUNCI_UJI)).toBe(KUNCI_UJI);
    expect(normalisasiKunciPrivat(`  ${KUNCI_UJI.slice(2).toUpperCase()} `)).toBe(KUNCI_UJI);
    expect(kunciPrivatSah(KUNCI_UJI)).toBe(true);
  });

  it("menolak panjang salah, bukan hex, nol, dan di atas orde kurva", () => {
    expect(normalisasiKunciPrivat(KUNCI_UJI.slice(0, 64))).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"zz".repeat(32)}`)).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"00".repeat(32)}`)).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"ff".repeat(32)}`)).toBeNull();
    expect(kunciPrivatSah(MNEMONIK_UJI)).toBe(false);
  });

  it("alamatDariKunci sama dengan privateKeyToAccount", () => {
    expect(alamatDariKunci(KUNCI_UJI as Hex)).toBe(privateKeyToAccount(KUNCI_UJI as Hex).address);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet.test.ts`
Expected: FAIL — modul `../src/dompet/dompet` belum ada (`Failed to load url ../src/dompet/dompet`).

- [ ] **Step 3: Implementasi**

`apps/mobile/src/dompet/dompet.ts`:

```ts
import { english, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, sha256, toHex, type Address, type Hex } from "viem";

/**
 * Inti dompet per pengguna — fungsi murni, TANPA impor react-native atau expo,
 * supaya seluruhnya teruji di vitest (spec dompet §4).
 *
 * Hanya 12 kata (128 bit entropi) yang dibuat dan diterima. Jalur turunan
 * standar m/44'/60'/0'/0/0 — alamat yang sama dengan MetaMask untuk 12 kata
 * yang sama.
 */
export const JUMLAH_KATA = 12;
const BAIT_ENTROPI = 16;

/** Huruf kecil, spasi di tepi dibuang, spasi/baris baru di antara kata menjadi satu spasi. */
export function normalisasiMnemonik(teks: string): string {
  return teks.trim().toLowerCase().split(/\s+/).filter((k) => k !== "").join(" ");
}

function bitDari(bait: Uint8Array): string {
  return Array.from(bait, (b) => b.toString(2).padStart(8, "0")).join("");
}

/** BIP-39: 128 bit entropi + 4 bit checksum (sha256) → 12 kata daftar English. */
export function mnemonikDariEntropi(entropi: Uint8Array): string {
  if (entropi.length !== BAIT_ENTROPI) throw new Error("entropi harus 16 bait");
  const checksum = hexToBytes(sha256(entropi))[0]! >> 4;
  const bit = bitDari(entropi) + checksum.toString(2).padStart(4, "0");
  const kata: string[] = [];
  for (let i = 0; i < JUMLAH_KATA; i++) {
    kata.push(english[parseInt(bit.slice(i * 11, i * 11 + 11), 2)]!);
  }
  return kata.join(" ");
}

/**
 * 12 kata baru dari `crypto.getRandomValues`.
 *
 * Sengaja TIDAK memakai `generateMnemonic` viem (Ruling D2): generator itu
 * mengambil `globalThis.crypto` saat modul @noble/hashes pertama kali dimuat,
 * dan di Hermes objek itu baru ada setelah src/polyfills.ts berjalan. Di sini
 * `globalThis.crypto` dibaca saat fungsi DIPANGGIL.
 */
export function buatMnemonik(): string {
  const entropi = new Uint8Array(BAIT_ENTROPI);
  globalThis.crypto.getRandomValues(entropi);
  return mnemonikDariEntropi(entropi);
}

/** Tepat 12 kata dari daftar English dengan checksum BIP-39 yang benar. */
export function mnemonikSah(teks: string): boolean {
  const kata = normalisasiMnemonik(teks).split(" ");
  if (kata.length !== JUMLAH_KATA) return false;
  const indeks = kata.map((k) => english.indexOf(k));
  if (indeks.some((i) => i < 0)) return false;
  const bit = indeks.map((i) => i.toString(2).padStart(11, "0")).join("");
  const entropi = new Uint8Array(BAIT_ENTROPI);
  for (let i = 0; i < BAIT_ENTROPI; i++) entropi[i] = parseInt(bit.slice(i * 8, i * 8 + 8), 2);
  // Menyandikan ulang entropinya harus menghasilkan kata yang sama persis —
  // itu sekaligus memeriksa 4 bit checksum.
  return mnemonikDariEntropi(entropi) === kata.join(" ");
}

/**
 * Kunci privat jalur m/44'/60'/0'/0/0. Mahal: PBKDF2-SHA512 2048 putaran dalam
 * JS murni — dipanggil HANYA saat membuat atau mengimpor dompet, tidak pernah
 * saat aplikasi dibuka (spec dompet R3).
 */
export function kunciDariMnemonik(teks: string): Hex {
  const mnemonik = normalisasiMnemonik(teks);
  if (!mnemonikSah(mnemonik)) throw new Error("mnemonik_tidak_sah");
  const kunci = mnemonicToAccount(mnemonik).getHdKey().privateKey;
  if (!kunci) throw new Error("mnemonik_tidak_sah");
  return toHex(kunci);
}

/**
 * `0x` + 64 hex huruf kecil, atau null. Menerima tanpa awalan `0x` dan huruf
 * besar, karena kunci biasanya ditempel dari pengelola kunci lain. Menolak
 * nilai di luar rentang kurva secp256k1 (mis. nol).
 */
export function normalisasiKunciPrivat(teks: string): Hex | null {
  const t = teks.trim().toLowerCase();
  const hex = t.startsWith("0x") ? t : `0x${t}`;
  if (!/^0x[0-9a-f]{64}$/.test(hex)) return null;
  try {
    privateKeyToAccount(hex as Hex);
  } catch {
    return null;
  }
  return hex as Hex;
}

export function kunciPrivatSah(teks: string): boolean {
  return normalisasiKunciPrivat(teks) !== null;
}

export function alamatDariKunci(kunci: Hex): Address {
  return privateKeyToAccount(kunci).address;
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet.test.ts`
Expected: PASS, semua tes di berkas itu hijau.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @nearly/mobile exec tsc --noEmit`
Expected: keluar dengan status 0, tanpa keluaran galat.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/dompet/dompet.ts apps/mobile/test/dompet.test.ts
git commit -m "feat(mobile): inti dompet — 12 kata BIP-39, checksum, kunci turunan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Mutasi — checksum**

Di `apps/mobile/src/dompet/dompet.ts`, ganti baris

```ts
  return mnemonikDariEntropi(entropi) === kata.join(" ");
```

dengan

```ts
  return true;
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet.test.ts`
Expected: FAIL — minimal `mnemonikSah > menolak checksum salah — kata sah, urutan sah, bit terakhir salah` dan `kunciDariMnemonik > melempar untuk mnemonik tidak sah`. Rekam nama tes yang merah, lalu:

```bash
git checkout -- apps/mobile/src/dompet/dompet.ts
pnpm --filter @nearly/mobile exec vitest run test/dompet.test.ts   # PASS
git status --short                                                  # kosong
```

---

## Task 2: `expo-secure-store` dan penyimpan dompet

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`, dan mungkin `apps/mobile/app.json` (oleh `npx expo install`)
- Create: `apps/mobile/src/dompet/penyimpan-dompet.ts`
- Test: `apps/mobile/test/penyimpan-dompet.test.ts`

**Interfaces:**
- Consumes: `normalisasiKunciPrivat` (Task 1); `expo-secure-store`: `getItemAsync(key, options)`, `setItemAsync(key, value, options)`, `deleteItemAsync(key, options)`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `type SecureStoreOptions`.
- Produces:
  - `const KUNCI_PENYIMPAN = { mnemonik: "nearly.dompet.mnemonik", kunci: "nearly.dompet.kunci", sudahDicadangkan: "nearly.dompet.sudahDicadangkan" } as const`
  - `const OPSI_PENYIMPAN: SecureStore.SecureStoreOptions` — `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }`
  - `type DompetTersimpan = { kunci: Hex; punyaMnemonik: boolean; sudahDicadangkan: boolean }`
  - `type DompetBaru = { kunci: Hex; mnemonik: string | null; sudahDicadangkan: boolean }`
  - `muatDompet(): Promise<DompetTersimpan | null>` — melempar `Error("dompet_rusak")` untuk isi kunci tidak sah
  - `simpanDompet(d: DompetBaru): Promise<void>` — melempar `Error("dompet_sudah_ada")`
  - `bacaMnemonik(): Promise<string | null>`
  - `tandaiSudahDicadangkan(): Promise<void>`
  - `hapusDompet(): Promise<void>`

- [ ] **Step 1: Pasang paket**

```bash
cd apps/mobile && npx expo install expo-secure-store && cd ../..
```

Expected: `apps/mobile/package.json` mendapat `"expo-secure-store": "~57.0.3"` di `dependencies`; `pnpm-lock.yaml` berubah; `apps/mobile/app.json` mungkin mendapat `"expo-secure-store"` di `plugins` (Ruling D16). Kalau perintah gagal (mis. jaringan), **laporkan dan berhenti** — jangan memasang dengan cara lain atau versi lain.

- [ ] **Step 2: Periksa versi, API, dan cakupan perubahan**

```bash
(cd apps/mobile && node -e "console.log(require('expo-secure-store/package.json').version)")   # 57.0.x (57.0.4 per 2026-09-17)
grep -c "WHEN_UNLOCKED_THIS_DEVICE_ONLY" apps/mobile/node_modules/expo-secure-store/build/SecureStore.d.ts   # ≥ 1
grep -n "export declare function getItemAsync\|export declare function setItemAsync\|export declare function deleteItemAsync\|export type SecureStoreOptions" apps/mobile/node_modules/expo-secure-store/build/SecureStore.d.ts   # keempatnya ada
git status --short          # hanya apps/mobile/package.json, pnpm-lock.yaml, dan (mungkin) apps/mobile/app.json
git diff -- apps/mobile/app.json   # kosong, ATAU hanya satu baris "expo-secure-store" ditambahkan di plugins
```

Laporkan keluarannya apa adanya. Kalau salah satu nama API tidak ada, **berhenti dan laporkan** — kode Step 5 bergantung pada nama-nama itu.

- [ ] **Step 3: Tulis tes yang gagal**

`apps/mobile/test/penyimpan-dompet.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

/**
 * expo-secure-store adalah modul native: memuat aslinya di Node menarik
 * react-native dan gagal. Pabrik vi.mock menggantinya SEBELUM impor apa pun
 * (vi.mock diangkat ke atas berkas), dengan Map di memori sebagai Keychain.
 */
const keychain = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  ALWAYS_THIS_DEVICE_ONLY: 6,
  getItemAsync: vi.fn(async (k: string) => keychain.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => { keychain.set(k, v); }),
  deleteItemAsync: vi.fn(async (k: string) => { keychain.delete(k); }),
}));

import * as SecureStore from "expo-secure-store";
import {
  bacaMnemonik, hapusDompet, KUNCI_PENYIMPAN, muatDompet, OPSI_PENYIMPAN, simpanDompet,
  tandaiSudahDicadangkan,
} from "../src/dompet/penyimpan-dompet";

const KUNCI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const MNEMONIK = "test test test test test test test test test test test junk";

beforeEach(() => {
  keychain.clear();
  vi.clearAllMocks();
});

describe("penyimpan dompet", () => {
  it("kosong → muatDompet null", async () => {
    expect(await muatDompet()).toBeNull();
  });

  it("simpan lalu muat — dompet dari 12 kata, belum dicadangkan", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    expect(await muatDompet()).toEqual({ kunci: KUNCI, punyaMnemonik: true, sudahDicadangkan: false });
    expect(await bacaMnemonik()).toBe(MNEMONIK);
  });

  it("dompet dari kunci privat tidak punya mnemonik", async () => {
    keychain.set(KUNCI_PENYIMPAN.mnemonik, "sisa dompet lama");
    await simpanDompet({ kunci: KUNCI, mnemonik: null, sudahDicadangkan: true });
    expect(await muatDompet()).toEqual({ kunci: KUNCI, punyaMnemonik: false, sudahDicadangkan: true });
    expect(await bacaMnemonik()).toBeNull();
  });

  it("tandaiSudahDicadangkan tersimpan", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    await tandaiSudahDicadangkan();
    expect((await muatDompet())?.sudahDicadangkan).toBe(true);
  });

  it("menolak menimpa dompet yang sudah ada", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    const lain = `0x${"11".repeat(32)}` as Hex;
    await expect(simpanDompet({ kunci: lain, mnemonik: null, sudahDicadangkan: true }))
      .rejects.toThrow("dompet_sudah_ada");
    expect((await muatDompet())?.kunci).toBe(KUNCI);
  });

  it("kunci ditulis terakhir", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    const tulisan = vi.mocked(SecureStore.setItemAsync).mock.calls.map((c) => c[0]);
    expect(tulisan.at(-1)).toBe(KUNCI_PENYIMPAN.kunci);
  });

  it("hapusDompet menghapus ketiganya, kunci lebih dulu", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: true });
    vi.clearAllMocks();
    await hapusDompet();
    expect(keychain.size).toBe(0);
    expect(vi.mocked(SecureStore.deleteItemAsync).mock.calls[0]?.[0]).toBe(KUNCI_PENYIMPAN.kunci);
    expect(await muatDompet()).toBeNull();
  });

  it("isi kunci yang rusak melempar, bukan dianggap belum ada", async () => {
    keychain.set(KUNCI_PENYIMPAN.kunci, "bukan kunci");
    await expect(muatDompet()).rejects.toThrow("dompet_rusak");
  });

  it("setiap panggilan memakai WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
    expect(OPSI_PENYIMPAN).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    await muatDompet();
    await bacaMnemonik();
    await tandaiSudahDicadangkan();
    await hapusDompet();
    const semua = [
      ...vi.mocked(SecureStore.getItemAsync).mock.calls.map((c) => c[1]),
      ...vi.mocked(SecureStore.setItemAsync).mock.calls.map((c) => c[2]),
      ...vi.mocked(SecureStore.deleteItemAsync).mock.calls.map((c) => c[1]),
    ];
    expect(semua.length).toBeGreaterThan(0);
    for (const opsi of semua) {
      expect(opsi).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
  });
});
```

Konstanta di pabrik mock sengaja bernilai berbeda satu sama lain: implementasi yang memakai konstanta aksesibilitas yang salah pasti menghasilkan opsi yang berbeda dari yang diharapkan tes.

- [ ] **Step 4: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/penyimpan-dompet.test.ts`
Expected: FAIL — modul `../src/dompet/penyimpan-dompet` belum ada.

- [ ] **Step 5: Implementasi**

`apps/mobile/src/dompet/penyimpan-dompet.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import type { Hex } from "viem";
import { normalisasiKunciPrivat } from "./dompet";

/**
 * Satu-satunya berkas yang menyentuh expo-secure-store (Keychain iOS /
 * Keystore Android). Dijaga test/dompet-tanpa-kunci-dev.test.ts.
 */
export const KUNCI_PENYIMPAN = {
  mnemonik: "nearly.dompet.mnemonik",
  kunci: "nearly.dompet.kunci",
  sudahDicadangkan: "nearly.dompet.sudahDicadangkan",
} as const;

/**
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY: terbaca hanya saat HP tidak terkunci, dan
 * TIDAK ikut cadangan iCloud maupun pindah ke HP baru. Satu-satunya cadangan
 * dompet adalah 12 kata (spec dompet §8 batas #1). Opsi yang sama dipakai di
 * setiap panggilan — baca, tulis, hapus.
 */
export const OPSI_PENYIMPAN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type DompetTersimpan = {
  kunci: Hex;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
};

export type DompetBaru = {
  kunci: Hex;
  /** null untuk dompet dari impor kunci privat (khusus pengembangan). */
  mnemonik: string | null;
  sudahDicadangkan: boolean;
};

const baca = (k: string) => SecureStore.getItemAsync(k, OPSI_PENYIMPAN);
const tulis = (k: string, v: string) => SecureStore.setItemAsync(k, v, OPSI_PENYIMPAN);
const hapus = (k: string) => SecureStore.deleteItemAsync(k, OPSI_PENYIMPAN);

/**
 * null = belum ada dompet. Isi kunci yang rusak MELEMPAR, bukan null: null
 * membawa pengguna ke layar Mulai, dan "Buat dompet baru" di sana menimpa
 * identitas yang mungkin masih bisa diselamatkan.
 */
export async function muatDompet(): Promise<DompetTersimpan | null> {
  const kunci = await baca(KUNCI_PENYIMPAN.kunci);
  if (kunci === null) return null;
  const sah = normalisasiKunciPrivat(kunci);
  if (sah === null || sah !== kunci) throw new Error("dompet_rusak");
  const mnemonik = await baca(KUNCI_PENYIMPAN.mnemonik);
  const cadangan = await baca(KUNCI_PENYIMPAN.sudahDicadangkan);
  return { kunci: sah, punyaMnemonik: mnemonik !== null, sudahDicadangkan: cadangan === "1" };
}

/**
 * Menolak menimpa dompet yang sudah ada — dompet lama wajib dihapus lewat
 * `hapusDompet` lebih dulu. Kunci ditulis TERAKHIR: keberadaannya yang
 * menandai dompet ada, jadi penulisan yang terputus di tengah jalan tidak
 * pernah meninggalkan dompet setengah jadi yang terbaca sebagai "siap".
 */
export async function simpanDompet(d: DompetBaru): Promise<void> {
  if ((await baca(KUNCI_PENYIMPAN.kunci)) !== null) throw new Error("dompet_sudah_ada");
  if (d.mnemonik === null) await hapus(KUNCI_PENYIMPAN.mnemonik);
  else await tulis(KUNCI_PENYIMPAN.mnemonik, d.mnemonik);
  if (d.sudahDicadangkan) await tulis(KUNCI_PENYIMPAN.sudahDicadangkan, "1");
  else await hapus(KUNCI_PENYIMPAN.sudahDicadangkan);
  await tulis(KUNCI_PENYIMPAN.kunci, d.kunci);
}

/** 12 kata, dibaca dari penyimpan hanya saat diminta — tidak pernah ditahan di memori. */
export function bacaMnemonik(): Promise<string | null> {
  return baca(KUNCI_PENYIMPAN.mnemonik);
}

export function tandaiSudahDicadangkan(): Promise<void> {
  return tulis(KUNCI_PENYIMPAN.sudahDicadangkan, "1");
}

/** Kunci dihapus PERTAMA, dengan alasan yang sama dengan urutan di `simpanDompet`. */
export async function hapusDompet(): Promise<void> {
  await hapus(KUNCI_PENYIMPAN.kunci);
  await hapus(KUNCI_PENYIMPAN.mnemonik);
  await hapus(KUNCI_PENYIMPAN.sudahDicadangkan);
}
```

- [ ] **Step 6: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/penyimpan-dompet.test.ts   # PASS
pnpm --filter @nearly/mobile exec vitest run                                 # PASS seluruhnya
pnpm --filter @nearly/mobile exec tsc --noEmit                               # status 0
```

- [ ] **Step 7: Commit**

Sertakan `apps/mobile/app.json` HANYA bila Step 2 menunjukkan berkas itu berubah.

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/dompet/penyimpan-dompet.ts apps/mobile/test/penyimpan-dompet.test.ts
git add apps/mobile/app.json   # hanya bila berubah di Step 2
git commit -m "feat(mobile): penyimpan dompet di Keychain lewat expo-secure-store

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — opsi Keychain**

Di `apps/mobile/src/dompet/penyimpan-dompet.ts`, ganti `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,` dengan `keychainAccessible: SecureStore.WHEN_UNLOCKED,`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/penyimpan-dompet.test.ts`
Expected: FAIL — `penyimpan dompet > setiap panggilan memakai WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Rekam, lalu `git checkout -- apps/mobile/src/dompet/penyimpan-dompet.ts` dan jalankan ulang sampai PASS.

- [ ] **Step 9: Mutasi — menolak menimpa**

Di berkas yang sama, hapus baris

```ts
  if ((await baca(KUNCI_PENYIMPAN.kunci)) !== null) throw new Error("dompet_sudah_ada");
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/penyimpan-dompet.test.ts`
Expected: FAIL — `penyimpan dompet > menolak menimpa dompet yang sudah ada`. Rekam, lalu:

```bash
git checkout -- apps/mobile/src/dompet/penyimpan-dompet.ts
pnpm --filter @nearly/mobile exec vitest run test/penyimpan-dompet.test.ts   # PASS
git status --short                                                            # kosong
```

---

## Task 3: Aksi dompet dan pembersihan memori per alamat

**Files:**
- Modify: `apps/mobile/src/pesan/sesi.ts:55-58`, `apps/mobile/src/pesan/pesan-actions.ts:22-30`, `apps/mobile/test/pesan-sesi.test.ts`, `apps/mobile/test/pesan-aksi.test.ts`
- Create: `apps/mobile/src/dompet/aksi-dompet.ts`
- Test: `apps/mobile/test/aksi-dompet.test.ts`

**Interfaces:**
- Consumes: `alamatDariKunci`, `buatMnemonik`, `kunciDariMnemonik`, `mnemonikSah`, `normalisasiKunciPrivat`, `normalisasiMnemonik` (Task 1); `hapusDompet`, `muatDompet`, `simpanDompet`, `bacaMnemonik` (Task 2); `sesiPesan`, `SesiPesan` (`src/pesan/sesi.ts`); `bukaBaris`, `kunciLawan` (`src/pesan/pesan-actions.ts`).
- Produces:
  - `lupakanSemuaSesiPesan(): void` (ganti nama `_resetSesiPesanUntukTes`)
  - `lupakanCacheKunciLawan(): void` (ganti nama `_resetKunciLawanUntukTes`)
  - `lupakanCacheBuka(): void` (ganti nama `_resetCacheBukaUntukTes`)
  - `type InfoDompet = { kunci: Hex; address: Address; punyaMnemonik: boolean; sudahDicadangkan: boolean }`
  - `muatInfoDompet(): Promise<InfoDompet | null>`
  - `buatDompetBaru(): Promise<InfoDompet>`
  - `imporDompetMnemonik(teks: string): Promise<InfoDompet>` — melempar `mnemonik_tidak_sah`
  - `imporDompetKunciDev(teks: string, modePengembangan: boolean): Promise<InfoDompet>` — melempar `hanya_pengembangan` / `kunci_tidak_sah`
  - `lupakanDompet(): Promise<void>`

- [ ] **Step 1: Ubah tes pesan ke nama baru (gagal dulu)**

Di `apps/mobile/test/pesan-sesi.test.ts`, ganti

```ts
import { _resetSesiPesanUntukTes, sesiPesan } from "../src/pesan/sesi";
```

dengan

```ts
import { lupakanSemuaSesiPesan, sesiPesan } from "../src/pesan/sesi";
```

dan ganti

```ts
beforeEach(() => _resetSesiPesanUntukTes());
```

dengan

```ts
beforeEach(() => lupakanSemuaSesiPesan());
```

Di `apps/mobile/test/pesan-aksi.test.ts`, ganti

```ts
  _resetCacheBukaUntukTes, _resetKunciLawanUntukTes, bukaBaris, bukaBertahap, kirimPesan, laporanSiapDikirim,
  laporkanPercakapan,
```

dengan

```ts
  bukaBaris, bukaBertahap, kirimPesan, laporanSiapDikirim, laporkanPercakapan, lupakanCacheBuka,
  lupakanCacheKunciLawan,
```

dan ganti

```ts
beforeEach(() => { _resetKunciLawanUntukTes(); _resetCacheBukaUntukTes(); });
```

dengan

```ts
beforeEach(() => { lupakanCacheKunciLawan(); lupakanCacheBuka(); });
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/pesan-sesi.test.ts test/pesan-aksi.test.ts`
Expected: FAIL — `lupakanSemuaSesiPesan is not a function` / `lupakanCacheKunciLawan is not a function`.

- [ ] **Step 2: Jadikan fungsi reset ekspor resmi**

Di `apps/mobile/src/pesan/sesi.ts`, ganti

```ts
/** Hanya untuk tes. */
export function _resetSesiPesanUntukTes(): void {
  sesiPerAlamat.clear();
}
```

dengan

```ts
/**
 * Membuang semua sesi di memori. Dipanggil saat dompet dihapus dari HP (Ganti
 * dompet): kunci privat pesan dompet lama tidak boleh tinggal di memori
 * setelah dompetnya pergi.
 */
export function lupakanSemuaSesiPesan(): void {
  sesiPerAlamat.clear();
}
```

Di `apps/mobile/src/pesan/pesan-actions.ts`, ganti

```ts
/** Hanya untuk tes. */
export function _resetKunciLawanUntukTes(): void {
  cacheKunciLawan.clear();
}

/** Hanya untuk tes. */
export function _resetCacheBukaUntukTes(): void {
  cacheBuka.clear();
}
```

dengan

```ts
/** Dipanggil saat dompet dihapus dari HP (Ganti dompet), dan oleh tes. */
export function lupakanCacheKunciLawan(): void {
  cacheKunciLawan.clear();
}

/**
 * Dipanggil saat dompet dihapus dari HP (Ganti dompet), dan oleh tes: isi
 * pesan yang sudah dibuka tidak boleh tinggal di memori setelah dompetnya pergi.
 */
export function lupakanCacheBuka(): void {
  cacheBuka.clear();
}
```

```bash
pnpm --filter @nearly/mobile exec vitest run test/pesan-sesi.test.ts test/pesan-aksi.test.ts   # PASS
grep -rn "_reset" apps/mobile/src apps/mobile/test                                             # WAJIB kosong
```

- [ ] **Step 3: Tulis tes aksi yang gagal**

`apps/mobile/test/aksi-dompet.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";

const keychain = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  ALWAYS_THIS_DEVICE_ONLY: 6,
  getItemAsync: vi.fn(async (k: string) => keychain.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => { keychain.set(k, v); }),
  deleteItemAsync: vi.fn(async (k: string) => { keychain.delete(k); }),
}));

import { CONFIG } from "../src/config";
import {
  buatDompetBaru, imporDompetKunciDev, imporDompetMnemonik, lupakanDompet, muatInfoDompet,
} from "../src/dompet/aksi-dompet";
import { mnemonikSah } from "../src/dompet/dompet";
import { bacaMnemonik } from "../src/dompet/penyimpan-dompet";
import { sesiPesan, type SesiPesan } from "../src/pesan/sesi";
import { bukaBaris, kunciLawan } from "../src/pesan/pesan-actions";

const MNEMONIK_UJI = "test test test test test test test test test test test junk";
const ALAMAT_UJI = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const KUNCI_UJI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const aslinya = globalThis.fetch;
beforeEach(() => keychain.clear());
afterEach(() => { globalThis.fetch = aslinya; });

describe("buatDompetBaru", () => {
  it("menyimpan kata pemulihan yang sah, belum dicadangkan, dan termuat ulang dengan alamat yang sama", async () => {
    const info = await buatDompetBaru();
    const mnemonik = await bacaMnemonik();
    expect(mnemonik !== null && mnemonikSah(mnemonik)).toBe(true);
    expect(info.punyaMnemonik).toBe(true);
    expect(info.sudahDicadangkan).toBe(false);
    expect(info.address).toBe(privateKeyToAccount(info.kunci).address);
    expect(await muatInfoDompet()).toEqual(info);
  });

  it("menolak saat dompet sudah ada", async () => {
    await buatDompetBaru();
    await expect(buatDompetBaru()).rejects.toThrow("dompet_sudah_ada");
  });
});

describe("imporDompetMnemonik", () => {
  it("vektor uji → alamat yang dikenal, dianggap sudah dicadangkan", async () => {
    const info = await imporDompetMnemonik(`  ${MNEMONIK_UJI.toUpperCase()} `);
    expect(info.address).toBe(ALAMAT_UJI);
    expect(info.sudahDicadangkan).toBe(true);
    expect(await bacaMnemonik()).toBe(MNEMONIK_UJI);
  });

  it("checksum salah → mnemonik_tidak_sah, tidak ada yang tersimpan", async () => {
    await expect(imporDompetMnemonik("test test test test test test test test test test test test"))
      .rejects.toThrow("mnemonik_tidak_sah");
    expect(keychain.size).toBe(0);
  });
});

describe("imporDompetKunciDev", () => {
  it("di luar mode pengembangan selalu ditolak, walau kuncinya sah", async () => {
    await expect(imporDompetKunciDev(KUNCI_UJI, false)).rejects.toThrow("hanya_pengembangan");
    expect(keychain.size).toBe(0);
  });

  it("mode pengembangan: kunci sah → alamatnya, tanpa mnemonik", async () => {
    const info = await imporDompetKunciDev(KUNCI_UJI.slice(2), true);
    expect(info).toEqual({ kunci: KUNCI_UJI, address: ALAMAT_UJI, punyaMnemonik: false, sudahDicadangkan: true });
    expect(await bacaMnemonik()).toBeNull();
  });

  it("kunci tidak sah → kunci_tidak_sah", async () => {
    await expect(imporDompetKunciDev("0x1234", true)).rejects.toThrow("kunci_tidak_sah");
    expect(keychain.size).toBe(0);
  });
});

describe("lupakanDompet", () => {
  it("menghapus dompet dari penyimpan", async () => {
    await buatDompetBaru();
    await lupakanDompet();
    expect(await muatInfoDompet()).toBeNull();
    expect(keychain.size).toBe(0);
  });

  it("membuang sesi pesan, kunci lawan, dan pesan terbuka di memori", async () => {
    const akun = privateKeyToAccount(KUNCI_UJI as Hex);
    const tanda = vi.fn((td: never) => akun.signTypedData(td as Parameters<typeof akun.signTypedData>[0]));
    const signer = { address: akun.address as Address, signTypedData: tanda };
    const kunciSesi = turunkanKunciPesan(await akun.signTypedData(
      kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract)));
    const lawan = { kunciEnkripsi: kunciSesi.pubEnkripsi, kunciTanda: kunciSesi.pubTanda };
    const ambil = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("/pesan/kunci/") ? lawan : { ok: true }), { status: 200 }));
    globalThis.fetch = ambil as never;

    const sesi: SesiPesan = await sesiPesan(signer);
    await kunciLawan(sesi, ALAMAT_UJI);
    const baris = {
      id: "00000000-0000-4000-8000-000000000001", pengirim: ALAMAT_UJI, penerima: ALAMAT_UJI,
      ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: 1, dibacaAtMs: null,
    };
    const terbuka = bukaBaris(sesi, lawan, baris);
    const tandaSebelum = tanda.mock.calls.length;

    await lupakanDompet();

    await sesiPesan(signer);
    expect(tanda.mock.calls.length).toBeGreaterThan(tandaSebelum);
    await kunciLawan(sesi, ALAMAT_UJI);
    expect(ambil.mock.calls.filter((c) => String(c[0]).includes("/pesan/kunci/0x")).length).toBe(2);
    expect(bukaBaris(sesi, lawan, baris)).not.toBe(terbuka);
  });
});
```

- [ ] **Step 4: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/aksi-dompet.test.ts`
Expected: FAIL — modul `../src/dompet/aksi-dompet` belum ada.

- [ ] **Step 5: Implementasi**

`apps/mobile/src/dompet/aksi-dompet.ts`:

```ts
import type { Address, Hex } from "viem";
import {
  alamatDariKunci, buatMnemonik, kunciDariMnemonik, mnemonikSah, normalisasiKunciPrivat,
  normalisasiMnemonik,
} from "./dompet";
import { hapusDompet, muatDompet, simpanDompet } from "./penyimpan-dompet";
import { lupakanSemuaSesiPesan } from "../pesan/sesi";
import { lupakanCacheBuka, lupakanCacheKunciLawan } from "../pesan/pesan-actions";

/**
 * Alur dompet tanpa React — dipakai konteks-dompet.tsx, diuji di
 * test/aksi-dompet.test.ts dengan expo-secure-store di-mock. Setiap galat
 * dilempar sebagai `Error(kode)`; kalimatnya di teks-dompet.ts.
 */
export type InfoDompet = {
  kunci: Hex;
  address: Address;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
};

export async function muatInfoDompet(): Promise<InfoDompet | null> {
  const d = await muatDompet();
  return d === null ? null : { ...d, address: alamatDariKunci(d.kunci) };
}

export async function buatDompetBaru(): Promise<InfoDompet> {
  const mnemonik = buatMnemonik();
  const kunci = kunciDariMnemonik(mnemonik);
  await simpanDompet({ kunci, mnemonik, sudahDicadangkan: false });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: false };
}

export async function imporDompetMnemonik(teks: string): Promise<InfoDompet> {
  const mnemonik = normalisasiMnemonik(teks);
  if (!mnemonikSah(mnemonik)) throw new Error("mnemonik_tidak_sah");
  const kunci = kunciDariMnemonik(mnemonik);
  // Yang mengetik 12 kata sudah memegang cadangannya — tanpa spanduk pengingat.
  await simpanDompet({ kunci, mnemonik, sudahDicadangkan: true });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: true };
}

/**
 * Khusus pengembangan (spec dompet R5): memakai lagi identitas uji lama.
 * `modePengembangan` diisi `__DEV__` oleh pemanggil — penjaga kedua setelah
 * tombolnya yang hanya dirender saat `__DEV__`.
 */
export async function imporDompetKunciDev(teks: string, modePengembangan: boolean): Promise<InfoDompet> {
  if (!modePengembangan) throw new Error("hanya_pengembangan");
  const kunci = normalisasiKunciPrivat(teks);
  if (kunci === null) throw new Error("kunci_tidak_sah");
  await simpanDompet({ kunci, mnemonik: null, sudahDicadangkan: true });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: false, sudahDicadangkan: true };
}

/**
 * Menghapus dompet dari HP, lalu semua yang di memori terikat ke dompet itu:
 * sesi pesan (kunci privat pesan), kunci lawan, dan isi pesan yang sudah dibuka.
 */
export async function lupakanDompet(): Promise<void> {
  await hapusDompet();
  lupakanSemuaSesiPesan();
  lupakanCacheKunciLawan();
  lupakanCacheBuka();
}
```

- [ ] **Step 6: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/aksi-dompet.test.ts   # PASS
pnpm --filter @nearly/mobile exec vitest run                            # PASS seluruhnya
pnpm --filter @nearly/mobile exec tsc --noEmit                          # status 0
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/pesan/sesi.ts apps/mobile/src/pesan/pesan-actions.ts apps/mobile/test/pesan-sesi.test.ts apps/mobile/test/pesan-aksi.test.ts apps/mobile/src/dompet/aksi-dompet.ts apps/mobile/test/aksi-dompet.test.ts
git commit -m "feat(mobile): aksi dompet — buat, impor, lupakan beserta memori per alamat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — tiga pembersihan memori**

Lakukan tiga kali, satu per satu. Setiap kali: hapus SATU baris dari badan `lupakanDompet` di `apps/mobile/src/dompet/aksi-dompet.ts`, jalankan `pnpm --filter @nearly/mobile exec vitest run test/aksi-dompet.test.ts`, rekam, lalu `git checkout -- apps/mobile/src/dompet/aksi-dompet.ts`.

| Baris yang dihapus | Tes yang WAJIB merah |
|---|---|
| `  lupakanSemuaSesiPesan();` | `lupakanDompet > membuang sesi pesan, kunci lawan, dan pesan terbuka di memori` |
| `  lupakanCacheKunciLawan();` | idem |
| `  lupakanCacheBuka();` | idem |

- [ ] **Step 9: Mutasi — penjaga mode pengembangan**

Hapus baris `  if (!modePengembangan) throw new Error("hanya_pengembangan");` dari `apps/mobile/src/dompet/aksi-dompet.ts`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/aksi-dompet.test.ts`
Expected: FAIL — `imporDompetKunciDev > di luar mode pengembangan selalu ditolak, walau kuncinya sah`. Rekam, lalu:

```bash
git checkout -- apps/mobile/src/dompet/aksi-dompet.ts
pnpm --filter @nearly/mobile exec vitest run test/aksi-dompet.test.ts   # PASS
git status --short                                                       # kosong
```

---

## Task 4: Teks dompet dan konteks dompet

**Files:**
- Create: `apps/mobile/src/dompet/teks-dompet.ts`, `apps/mobile/src/dompet/konteks-dompet.tsx`
- Modify: `apps/mobile/src/pesan/push.ts` (tambah di akhir berkas)
- Test: `apps/mobile/test/teks-dompet.test.ts`

**Interfaces:**
- Consumes: `buatDompetBaru`, `imporDompetKunciDev`, `imporDompetMnemonik`, `lupakanDompet`, `muatInfoDompet`, `InfoDompet` (Task 3); `bacaMnemonik`, `tandaiSudahDicadangkan` (Task 2); `createDevSigner`, `NearlySigner` (`src/signer.ts`, nama lama — diganti di Task 6, Ruling D13).
- Produces:
  - `teks-dompet.ts`: `type RingkasDompet = { punyaMnemonik: boolean; sudahDicadangkan: boolean }`; `perluPengingatCadangan(d: RingkasDompet): boolean`; `TEKS_PENGINGAT_CADANGAN`, `PERINGATAN_MNEMONIK_UTAMA`, `PERINGATAN_LIHAT_MNEMONIK`, `TEKS_TANPA_MNEMONIK` (string); `peringatanGantiDompet(d: RingkasDompet): string`; `kataBernomor(mnemonik: string): string[]`; `pesanGalatDompet(e: unknown): string`
  - `push.ts`: `lupakanPendaftaranPush(): void`
  - `konteks-dompet.tsx`:
    - `type KeadaanDompet = "memuat" | "galat" | "belum-ada" | "siap"`
    - `type NilaiDompet = { keadaan: KeadaanDompet; galat: unknown; address: Address | null; punyaMnemonik: boolean; sudahDicadangkan: boolean; muatUlang(): void; buatBaru(): Promise<void>; imporMnemonik(teks: string): Promise<void>; imporKunciDev(teks: string): Promise<void>; gantiDompet(): Promise<void>; tampilkanMnemonik(): Promise<string | null>; tandaiSudahDicadangkan(): Promise<void> }`
    - `DompetProvider({ children }: { children: ReactNode })`
    - `useDompet(): NilaiDompet` — melempar di luar provider
    - `useNearlySigner(verifyingContract: Address): NearlySigner | null`

- [ ] **Step 1: Tulis tes teks yang gagal**

`apps/mobile/test/teks-dompet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  kataBernomor, perluPengingatCadangan, peringatanGantiDompet, pesanGalatDompet,
} from "../src/dompet/teks-dompet";

describe("perluPengingatCadangan", () => {
  it("hanya dompet dari 12 kata yang belum ditandai sudah dicatat", () => {
    expect(perluPengingatCadangan({ punyaMnemonik: true, sudahDicadangkan: false })).toBe(true);
    expect(perluPengingatCadangan({ punyaMnemonik: true, sudahDicadangkan: true })).toBe(false);
    // Impor kunci privat (khusus pengembangan): tidak ada kata untuk dicatat.
    expect(perluPengingatCadangan({ punyaMnemonik: false, sudahDicadangkan: false })).toBe(false);
  });
});

describe("peringatanGantiDompet", () => {
  it("belum dicatat → peringatan paling keras, menyebut hilang selamanya", () => {
    const t = peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: false });
    expect(t).toContain("BELUM");
    expect(t).toContain("hilang selamanya");
  });

  it("sudah dicatat → hanya lewat 12 kata pemulihan", () => {
    expect(peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: true })).toContain("12 kata pemulihan");
  });

  it("tanpa mnemonik → menyebut kunci privat", () => {
    expect(peringatanGantiDompet({ punyaMnemonik: false, sudahDicadangkan: true })).toContain("kunci privat");
  });
});

describe("kataBernomor", () => {
  it("bernomor mulai dari satu, urutan dipertahankan", () => {
    expect(kataBernomor("abandon ability able")).toEqual(["1. abandon", "2. ability", "3. able"]);
  });
});

describe("pesanGalatDompet", () => {
  it("setiap kode galat dompet punya kalimat sendiri", () => {
    const kode = ["mnemonik_tidak_sah", "kunci_tidak_sah", "hanya_pengembangan", "dompet_sudah_ada", "dompet_rusak"];
    const kalimat = kode.map((k) => pesanGalatDompet(new Error(k)));
    expect(new Set(kalimat).size).toBe(kode.length);
    for (const t of kalimat) expect(t).not.toBe(pesanGalatDompet(new Error("lain")));
  });

  it("galat lain (mis. Keychain) → kalimat umum, tanpa pesan mentah", () => {
    expect(pesanGalatDompet(new Error("User interaction is not allowed"))).toBe("Dompet gagal disiapkan. Coba lagi.");
    expect(pesanGalatDompet("bukan Error")).toBe("Dompet gagal disiapkan. Coba lagi.");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-dompet.test.ts`
Expected: FAIL — modul `../src/dompet/teks-dompet` belum ada.

- [ ] **Step 3: Implementasi teks**

`apps/mobile/src/dompet/teks-dompet.ts`:

```ts
/**
 * Semua kalimat dompet yang terlihat pengguna, murni dan teruji
 * (test/teks-dompet.test.ts).
 */

export type RingkasDompet = { punyaMnemonik: boolean; sudahDicadangkan: boolean };

/** Spanduk beranda: hanya dompet dari 12 kata yang belum ditandai sudah dicatat. */
export function perluPengingatCadangan(d: RingkasDompet): boolean {
  return d.punyaMnemonik && !d.sudahDicadangkan;
}

export const TEKS_PENGINGAT_CADANGAN =
  "Catat 12 kata pemulihanmu. Tanpa itu, identitas dan koneksimu hilang kalau HP hilang atau aplikasi dihapus.";

export const PERINGATAN_MNEMONIK_UTAMA =
  "Jangan pakai 12 kata dompet utama yang menyimpan aset. Kunci dompet disimpan di HP ini, bukan di dompet perangkat keras.";

export const PERINGATAN_LIHAT_MNEMONIK =
  "Siapa pun yang melihat 12 kata ini bisa memakai identitasmu. Pastikan tidak ada orang atau kamera yang melihat layarmu.";

export const TEKS_TANPA_MNEMONIK =
  "Dompet ini diimpor dari kunci privat (khusus pengembangan) dan tidak punya 12 kata pemulihan.";

export function peringatanGantiDompet(d: RingkasDompet): string {
  if (!d.punyaMnemonik) {
    return "Dompet ini akan dihapus dari HP. Tanpa 12 kata pemulihan, kamu hanya bisa memakainya lagi dengan kunci privat yang sama.";
  }
  if (!d.sudahDicadangkan) {
    return "Kamu BELUM mencatat 12 kata pemulihan. Kalau dompet ini dihapus sekarang, identitas, koneksi, dan riwayat pesanmu hilang selamanya.";
  }
  return "Dompet ini akan dihapus dari HP. Identitas, koneksi, dan riwayat pesanmu hanya bisa kembali lewat 12 kata pemulihan yang sudah kamu catat.";
}

/** "1. kata", "2. kata", … — nomor membantu mencatat urutan dengan benar. */
export function kataBernomor(mnemonik: string): string[] {
  return mnemonik.split(" ").map((k, i) => `${i + 1}. ${k}`);
}

const PESAN_GALAT: Record<string, string> = {
  mnemonik_tidak_sah: "12 kata itu tidak sah. Periksa ejaan dan urutannya.",
  kunci_tidak_sah: "Kunci privat tidak sah.",
  hanya_pengembangan: "Impor kunci privat hanya tersedia di mode pengembangan.",
  dompet_sudah_ada: "HP ini sudah punya dompet. Hapus dulu lewat Ganti dompet.",
  dompet_rusak:
    "Data dompet di HP ini tidak terbaca. Jangan hapus aplikasi dulu — coba lagi, dan siapkan 12 kata pemulihanmu.",
};

export function pesanGalatDompet(e: unknown): string {
  const kode = e instanceof Error ? e.message : "";
  return PESAN_GALAT[kode] ?? "Dompet gagal disiapkan. Coba lagi.";
}
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-dompet.test.ts`
Expected: PASS.

- [ ] **Step 4: `lupakanPendaftaranPush` di `push.ts`**

Tambahkan di AKHIR `apps/mobile/src/pesan/push.ts` (setelah penutup `daftarkanPush`), tanpa mengubah baris lain:

```ts

/**
 * Dipanggil saat dompet dihapus dari HP (Ganti dompet): dompet berikutnya
 * mencoba mendaftarkan token push lagi pada layar Pesan atau Radar berikutnya.
 */
export function lupakanPendaftaranPush(): void {
  sudahDicoba = false;
}
```

- [ ] **Step 5: Konteks dompet**

`apps/mobile/src/dompet/konteks-dompet.tsx`:

```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import type { Address, Hex } from "viem";
import { createDevSigner, type NearlySigner } from "../signer";
import { lupakanPendaftaranPush } from "../pesan/push";
import {
  buatDompetBaru, imporDompetKunciDev, imporDompetMnemonik, lupakanDompet, muatInfoDompet,
  type InfoDompet,
} from "./aksi-dompet";
import { bacaMnemonik, tandaiSudahDicadangkan as tandaiDiPenyimpan } from "./penyimpan-dompet";

export type KeadaanDompet = "memuat" | "galat" | "belum-ada" | "siap";

export type NilaiDompet = {
  keadaan: KeadaanDompet;
  /** Terisi hanya saat keadaan "galat"; kalimatnya lewat pesanGalatDompet. */
  galat: unknown;
  address: Address | null;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
  muatUlang(): void;
  buatBaru(): Promise<void>;
  imporMnemonik(teks: string): Promise<void>;
  imporKunciDev(teks: string): Promise<void>;
  gantiDompet(): Promise<void>;
  tampilkanMnemonik(): Promise<string | null>;
  tandaiSudahDicadangkan(): Promise<void>;
};

type Status =
  | { keadaan: "memuat" }
  | { keadaan: "galat"; galat: unknown }
  | { keadaan: "belum-ada" }
  | { keadaan: "siap"; info: InfoDompet };

const KonteksDompet = createContext<NilaiDompet | null>(null);

/**
 * Kunci privat dipisah ke konteks sendiri, TIDAK ikut di NilaiDompet: layar
 * tidak pernah memegang kunci, hanya signer dari useNearlySigner. Layar yang
 * memakai signer juga tidak dirender ulang saat penanda cadangan berubah.
 */
const KonteksKunci = createContext<Hex | null>(null);

export function DompetProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ keadaan: "memuat" });

  const muatUlang = useCallback(() => {
    setStatus({ keadaan: "memuat" });
    muatInfoDompet()
      .then((info) => setStatus(info === null ? { keadaan: "belum-ada" } : { keadaan: "siap", info }))
      .catch((galat: unknown) => setStatus({ keadaan: "galat", galat }));
  }, []);

  useEffect(() => { muatUlang(); }, [muatUlang]);

  const buatBaru = useCallback(async () => {
    const info = await buatDompetBaru();
    setStatus({ keadaan: "siap", info });
  }, []);

  const imporMnemonik = useCallback(async (teks: string) => {
    const info = await imporDompetMnemonik(teks);
    setStatus({ keadaan: "siap", info });
  }, []);

  const imporKunciDev = useCallback(async (teks: string) => {
    const info = await imporDompetKunciDev(teks, __DEV__);
    setStatus({ keadaan: "siap", info });
  }, []);

  const gantiDompet = useCallback(async () => {
    await lupakanDompet();
    // Dompet berikutnya mendaftarkan token push ulang; API memindahkan token
    // itu dari dompet lama (pesan-store.ts simpanTokenPush).
    lupakanPendaftaranPush();
    setStatus({ keadaan: "belum-ada" });
  }, []);

  const tandaiSudahDicadangkan = useCallback(async () => {
    await tandaiDiPenyimpan();
    setStatus((s) => (s.keadaan === "siap" ? { keadaan: "siap", info: { ...s.info, sudahDicadangkan: true } } : s));
  }, []);

  const info = status.keadaan === "siap" ? status.info : null;

  const nilai = useMemo<NilaiDompet>(() => ({
    keadaan: status.keadaan,
    galat: status.keadaan === "galat" ? status.galat : null,
    address: info?.address ?? null,
    punyaMnemonik: info?.punyaMnemonik ?? false,
    sudahDicadangkan: info?.sudahDicadangkan ?? false,
    muatUlang,
    buatBaru,
    imporMnemonik,
    imporKunciDev,
    gantiDompet,
    tampilkanMnemonik: bacaMnemonik,
    tandaiSudahDicadangkan,
  }), [status, info, muatUlang, buatBaru, imporMnemonik, imporKunciDev, gantiDompet, tandaiSudahDicadangkan]);

  return (
    <KonteksKunci.Provider value={info?.kunci ?? null}>
      <KonteksDompet.Provider value={nilai}>{children}</KonteksDompet.Provider>
    </KonteksKunci.Provider>
  );
}

export function useDompet(): NilaiDompet {
  const nilai = useContext(KonteksDompet);
  if (nilai === null) throw new Error("useDompet harus di dalam DompetProvider (app/_layout.tsx)");
  return nilai;
}

/**
 * Signer dompet HP ini untuk satu kontrak domain EIP-712, atau null bila dompet
 * belum siap. Objeknya stabil selama kunci dan kontraknya sama — efek yang
 * bergantung pada `signer` tidak menembak ulang setiap render.
 */
export function useNearlySigner(verifyingContract: Address): NearlySigner | null {
  const kunci = useContext(KonteksKunci);
  return useMemo(
    () => (kunci === null ? null : createDevSigner(kunci, verifyingContract)),
    [kunci, verifyingContract],
  );
}
```

- [ ] **Step 6: Typecheck dan seluruh tes**

```bash
pnpm --filter @nearly/mobile exec tsc --noEmit        # status 0
pnpm --filter @nearly/mobile exec vitest run          # PASS seluruhnya
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/dompet/teks-dompet.ts apps/mobile/test/teks-dompet.test.ts apps/mobile/src/dompet/konteks-dompet.tsx apps/mobile/src/pesan/push.ts
git commit -m "feat(mobile): konteks dompet, useNearlySigner, dan kalimat dompet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — pengingat cadangan**

Di `apps/mobile/src/dompet/teks-dompet.ts`, ganti `  return d.punyaMnemonik && !d.sudahDicadangkan;` dengan `  return !d.sudahDicadangkan;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-dompet.test.ts`
Expected: FAIL — `perluPengingatCadangan > hanya dompet dari 12 kata yang belum ditandai sudah dicatat`. Rekam, lalu:

```bash
git checkout -- apps/mobile/src/dompet/teks-dompet.ts
pnpm --filter @nearly/mobile exec vitest run test/teks-dompet.test.ts   # PASS
git status --short                                                       # kosong
```

---

## Task 5: Gerbang dompet, layar Mulai, layar Dompet

**Files:**
- Modify: `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/judul-layar.test.ts`
- Rewrite: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/mulai.tsx`, `apps/mobile/app/dompet.tsx`
- Test: `apps/mobile/test/gerbang-dompet.test.ts`

**Interfaces:**
- Consumes: `DompetProvider`, `useDompet` (Task 4); `pesanGalatDompet`, `PERINGATAN_MNEMONIK_UTAMA`, `PERINGATAN_LIHAT_MNEMONIK`, `TEKS_TANPA_MNEMONIK`, `kataBernomor`, `peringatanGantiDompet` (Task 4); `ruteDariNotifikasi` (sudah ada); `WARNA` (sudah ada).
- Produces:
  - `JUDUL_LAYAR` mendapat `mulai: "Mulai"` dan `dompet: "Dompet"`
  - `const RUTE_TANPA_DOMPET: readonly string[]` = `["mulai"]`
  - `layarMenurutDompet(punyaDompet: boolean): [string, string][]`
  - Rute `/mulai` dan `/dompet`

- [ ] **Step 1: Ubah tes judul layar (gagal dulu)**

Di `apps/mobile/test/judul-layar.test.ts`, ganti

```ts
import { JUDUL_LAYAR } from "../src/judul-layar";
```

dengan

```ts
import { JUDUL_LAYAR, layarMenurutDompet } from "../src/judul-layar";
```

lalu ganti tes terakhir

```ts
  it("_layout.tsx mendaftarkan SEMUA judul dari JUDUL_LAYAR, tanpa judul tulisan tangan", () => {
    const layout = readFileSync(join(APP, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/Object\.entries\(JUDUL_LAYAR\)\.map\(/);
    expect(layout).not.toMatch(/title:\s*"/);
  });
});
```

dengan

```ts
  it("_layout.tsx mendaftarkan judul dari kedua sisi gerbang dompet, tanpa judul tulisan tangan", () => {
    const layout = readFileSync(join(APP, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/layarMenurutDompet\(true\)\.map\(/);
    expect(layout).toMatch(/layarMenurutDompet\(false\)\.map\(/);
    expect(layout).not.toMatch(/title:\s*"/);
  });

  it("layarMenurutDompet membagi SEMUA judul tanpa irisan", () => {
    const dengan = layarMenurutDompet(true).map(([r]) => r);
    const tanpa = layarMenurutDompet(false).map(([r]) => r);
    expect([...dengan, ...tanpa].sort()).toEqual(Object.keys(JUDUL_LAYAR).sort());
    expect(dengan.filter((r) => tanpa.includes(r))).toEqual([]);
  });

  // Tanpa dompet hanya layar Mulai; dengan dompet, beranda adalah layar pertama
  // yang dituju saat penjaga berubah.
  it("mulai hanya tanpa dompet; index layar pertama dengan dompet", () => {
    expect(layarMenurutDompet(false).map(([r]) => r)).toEqual(["mulai"]);
    expect(layarMenurutDompet(true)[0]?.[0]).toBe("index");
  });
});
```

(Komentar tiga baris di atas tes itu — "Memeriksa pemakaian, bukan sekadar nama…" — dibiarkan.)

- [ ] **Step 2: Tulis tes gerbang yang gagal**

`apps/mobile/test/gerbang-dompet.test.ts`:

```ts
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

  it("konteks meneruskan __DEV__ ke imporDompetKunciDev", () => {
    expect(baca("src/dompet/konteks-dompet.tsx")).toContain("imporDompetKunciDev(teks, __DEV__)");
  });

  it("modul dompet murni tidak mengimpor react, react-native, atau expo", () => {
    for (const berkas of ["src/dompet/dompet.ts", "src/dompet/aksi-dompet.ts", "src/dompet/teks-dompet.ts"]) {
      expect(baca(berkas), berkas).not.toMatch(/from "(react-native|expo[^"]*|react)"/);
    }
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts test/gerbang-dompet.test.ts`
Expected: FAIL — `layarMenurutDompet is not a function`, `ENOENT … app/mulai.tsx`, dan `_layout.tsx` belum memuat `DompetProvider`.

- [ ] **Step 4: `judul-layar.ts`**

Di `apps/mobile/src/judul-layar.ts`, ganti

```ts
export const JUDUL_LAYAR: Record<string, string> = {
  index: "Nearly",
```

dengan

```ts
export const JUDUL_LAYAR: Record<string, string> = {
  index: "Nearly",
  mulai: "Mulai",
  dompet: "Dompet",
```

lalu tambahkan di AKHIR berkas:

```ts

/**
 * Rute yang HANYA bisa dibuka saat HP belum punya dompet. Semua rute lain
 * hanya bisa dibuka saat dompet siap (gerbang Stack.Protected di
 * app/_layout.tsx).
 */
export const RUTE_TANPA_DOMPET: readonly string[] = ["mulai"];

/** Pasangan [rute, judul] untuk satu sisi gerbang dompet, urutan JUDUL_LAYAR dipertahankan. */
export function layarMenurutDompet(punyaDompet: boolean): [string, string][] {
  return Object.entries(JUDUL_LAYAR)
    .filter(([rute]) => RUTE_TANPA_DOMPET.includes(rute) !== punyaDompet);
}
```

`index` harus tetap entri PERTAMA `JUDUL_LAYAR` — expo-router menuju layar pertama yang diizinkan saat penjaga berubah.

- [ ] **Step 5: Tulis ulang `app/_layout.tsx`**

Ganti SELURUH isi `apps/mobile/app/_layout.tsx` dengan:

```tsx
import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";
import { layarMenurutDompet } from "../src/judul-layar";
import { DompetProvider, useDompet } from "../src/dompet/konteks-dompet";
import { pesanGalatDompet } from "../src/dompet/teks-dompet";

// Notifikasi yang tiba saat aplikasi terbuka tetap ditampilkan sebagai banner.
// Sesuaikan nama medan dengan NotificationBehavior versi terpasang (Step 1).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <DompetProvider>
      <Navigasi />
    </DompetProvider>
  );
}

/**
 * Gerbang dompet (spec dompet §5.1). Tanpa dompet hanya layar Mulai yang ada;
 * dengan dompet, Mulai tidak bisa dibuka. Saat penjaga berubah — dompet baru
 * dibuat, atau dompet dihapus lewat Ganti dompet — expo-router memindahkan
 * tumpukan ke layar pertama yang diizinkan.
 */
function Navigasi() {
  const { keadaan, galat, muatUlang } = useDompet();

  useEffect(() => {
    // Rute tujuan notifikasi hanya ada saat dompet siap.
    if (keadaan !== "siap") return;
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      if (rute) router.push(rute);
    });
    return () => langganan.remove();
  }, [keadaan]);

  if (keadaan === "memuat") {
    return <View style={s.tengah}><ActivityIndicator /></View>;
  }

  if (keadaan === "galat") {
    // BUKAN layar Mulai: "Buat dompet baru" di sana akan menimpa dompet yang
    // mungkin hanya gagal terbaca sesaat.
    return (
      <View style={s.tengah}>
        <Text style={s.galat}>{pesanGalatDompet(galat)}</Text>
        <Button title="Coba lagi" onPress={muatUlang} />
      </View>
    );
  }

  const punyaDompet = keadaan === "siap";

  // Judul semua layar dari JUDUL_LAYAR — alasannya di src/judul-layar.ts.
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Protected guard={punyaDompet}>
        {layarMenurutDompet(true).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={!punyaDompet}>
        {layarMenurutDompet(false).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

const s = StyleSheet.create({
  tengah: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  galat: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
```

`Stack.Protected` ada di expo-router terpasang (Ruling D5). Baris impor polyfill WAJIB tetap baris pertama.

- [ ] **Step 6: Layar Mulai**

`apps/mobile/app/mulai.tsx`:

```tsx
import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useDompet } from "../src/dompet/konteks-dompet";
import { PERINGATAN_MNEMONIK_UTAMA, pesanGalatDompet } from "../src/dompet/teks-dompet";
import { WARNA } from "../src/warna";

// Membuat atau mengimpor dari 12 kata menurunkan kunci dengan PBKDF2 di thread
// JS — bisa beberapa detik di HP. Jeda ini memberi layar kesempatan
// menggambar "Menyiapkan dompet…" sebelum thread sibuk.
const jedaUi = () => new Promise<void>((r) => { setTimeout(r, 50); });

type Mode = "pilih" | "mnemonik" | "kunci-dev";

export default function MulaiScreen() {
  const { buatBaru, imporMnemonik, imporKunciDev } = useDompet();
  const [mode, setMode] = useState<Mode>("pilih");
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const pindah = (m: Mode) => {
    setMode(m);
    setTeks("");
    setGalat(null);
  };

  async function jalankan(aksi: () => Promise<void>) {
    if (sibuk) return;
    setSibuk(true);
    setGalat(null);
    await jedaUi();
    try {
      // Berhasil → gerbang di _layout.tsx pindah ke beranda dan layar ini dilepas.
      await aksi();
    } catch (e) {
      setGalat(pesanGalatDompet(e));
    } finally {
      setSibuk(false);
    }
  }

  const labelSibuk = "Menyiapkan dompet…";

  return (
    <ScrollView
      contentContainerStyle={s.root}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Nearly</Text>
      <Text style={s.p}>
        Identitasmu di Nearly adalah dompet yang dibuat dan disimpan di HP ini. Tidak perlu aplikasi
        dompet lain, email, atau nomor telepon.
      </Text>

      {mode === "pilih" && (
        <>
          <Button
            title={sibuk ? labelSibuk : "Buat dompet baru"}
            disabled={sibuk}
            onPress={() => void jalankan(buatBaru)}
          />
          <Button
            title="Pakai dompet yang sudah ada (12 kata)"
            disabled={sibuk}
            onPress={() => pindah("mnemonik")}
          />
          {/* Khusus pengembangan: tidak pernah dirender di build produksi (spec dompet R5). */}
          {__DEV__ && (
            <Button
              title="Impor kunci privat (khusus pengembangan)"
              disabled={sibuk}
              onPress={() => pindah("kunci-dev")}
            />
          )}
        </>
      )}

      {mode === "mnemonik" && (
        <>
          <Text style={s.label}>12 kata pemulihan</Text>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            placeholder="kata1 kata2 kata3 …"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            editable={!sibuk}
            style={[s.isian, s.isianBesar, { color: WARNA.teks }]}
            placeholderTextColor={WARNA.placeholder}
          />
          <Text style={s.peringatan}>{PERINGATAN_MNEMONIK_UTAMA}</Text>
          <Button
            title={sibuk ? labelSibuk : "Pakai dompet ini"}
            disabled={sibuk || teks.trim() === ""}
            onPress={() => void jalankan(() => imporMnemonik(teks))}
          />
          <Button title="Kembali" disabled={sibuk} onPress={() => pindah("pilih")} />
        </>
      )}

      {__DEV__ && mode === "kunci-dev" && (
        <>
          <Text style={s.label}>Kunci privat (khusus pengembangan)</Text>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            placeholder="0x…"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={!sibuk}
            style={[s.isian, { color: WARNA.teks }]}
            placeholderTextColor={WARNA.placeholder}
          />
          <Text style={s.peringatan}>
            Hanya untuk dompet uji sekali pakai. Pilihan ini tidak ada di build produksi.
          </Text>
          <Button
            title={sibuk ? labelSibuk : "Pakai kunci ini"}
            disabled={sibuk || teks.trim() === ""}
            onPress={() => void jalankan(() => imporKunciDev(teks))}
          />
          <Button title="Kembali" disabled={sibuk} onPress={() => pindah("pilih")} />
        </>
      )}

      {galat && <Text style={s.galat}>{galat}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  h1: { fontSize: 32, fontWeight: "700" },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.75 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 8 },
  isian: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, fontSize: 16 },
  isianBesar: { minHeight: 96, textAlignVertical: "top" },
  peringatan: { fontSize: 13, lineHeight: 19, color: "#8a4b00" },
  galat: { fontSize: 15, lineHeight: 22, color: "#b00" },
});
```

- [ ] **Step 7: Layar Dompet**

`apps/mobile/app/dompet.tsx`:

```tsx
import { useState } from "react";
import { Alert, Button, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useDompet } from "../src/dompet/konteks-dompet";
import {
  kataBernomor, PERINGATAN_LIHAT_MNEMONIK, peringatanGantiDompet, pesanGalatDompet,
  TEKS_TANPA_MNEMONIK,
} from "../src/dompet/teks-dompet";

export default function DompetScreen() {
  const {
    address, punyaMnemonik, sudahDicadangkan, tampilkanMnemonik, tandaiSudahDicadangkan, gantiDompet,
  } = useDompet();
  const [kata, setKata] = useState<string[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  // Sesaat setelah Ganti dompet, sebelum gerbang memindahkan ke layar Mulai.
  if (address === null) return null;

  const bagikan = () => {
    // Share bawaan React Native — tanpa paket baru. Untuk daftar seed panitia.
    Share.share({ message: address }).catch(() => {});
  };

  const bukaKata = async () => {
    try {
      const m = await tampilkanMnemonik();
      if (m === null) {
        setPesan(TEKS_TANPA_MNEMONIK);
        return;
      }
      setKata(kataBernomor(m));
      setPesan(null);
    } catch (e) {
      setPesan(pesanGalatDompet(e));
    }
  };

  const lihatKata = () => {
    Alert.alert("Lihat 12 kata pemulihan?", PERINGATAN_LIHAT_MNEMONIK, [
      { text: "Batal", style: "cancel" },
      { text: "Tampilkan", onPress: () => { void bukaKata(); } },
    ]);
  };

  const sudahDicatat = async () => {
    try {
      await tandaiSudahDicadangkan();
      setKata(null);
      setPesan("Tersimpan. Simpan catatanmu di tempat yang aman dan tidak online.");
    } catch (e) {
      setPesan(pesanGalatDompet(e));
    }
  };

  const hapus = async () => {
    setSibuk(true);
    try {
      // Berhasil → gerbang di _layout.tsx pindah ke layar Mulai.
      await gantiDompet();
    } catch (e) {
      setPesan(pesanGalatDompet(e));
      setSibuk(false);
    }
  };

  const ganti = () => {
    Alert.alert("Ganti dompet?", peringatanGantiDompet({ punyaMnemonik, sudahDicadangkan }), [
      { text: "Batal", style: "cancel" },
      { text: "Hapus dompet dari HP ini", style: "destructive", onPress: () => { void hapus(); } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={s.root}>
      <Text style={s.label}>Alamat</Text>
      {/* Alamat tampil utuh — alamat-lah identitasnya (spec induk §9.2). */}
      <Text style={s.alamat} selectable>{address}</Text>
      <Button title="Bagikan alamat" onPress={bagikan} />
      <Text style={s.catatan}>
        Alamat boleh dibagikan, misalnya ke panitia untuk daftar seed. Yang tidak boleh dibagikan
        kepada siapa pun adalah 12 kata pemulihan.
      </Text>

      <Text style={s.label}>12 kata pemulihan</Text>
      {!punyaMnemonik && <Text style={s.catatan}>{TEKS_TANPA_MNEMONIK}</Text>}
      {punyaMnemonik && kata === null && (
        <Button title="Lihat 12 kata pemulihan" onPress={lihatKata} />
      )}
      {kata && (
        <View style={s.kotakKata}>
          {kata.map((k) => <Text key={k} style={s.kata}>{k}</Text>)}
          <Button title="Sudah saya catat" onPress={() => { void sudahDicatat(); }} />
        </View>
      )}

      <Text style={s.label}>Ganti dompet</Text>
      <Text style={s.catatan}>Menghapus dompet ini dari HP, lalu kembali ke layar Mulai.</Text>
      <Button title={sibuk ? "Menghapus…" : "Ganti dompet"} color="#b00" disabled={sibuk} onPress={ganti} />

      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 12 },
  alamat: { fontFamily: "Courier", fontSize: 13 },
  catatan: { fontSize: 13, lineHeight: 19, opacity: 0.6 },
  kotakKata: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 6 },
  kata: { fontFamily: "Courier", fontSize: 16 },
  pesan: { fontSize: 15, lineHeight: 22 },
});
```

- [ ] **Step 8: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts test/gerbang-dompet.test.ts test/warna-isian.test.ts   # PASS
pnpm --filter @nearly/mobile exec vitest run                                                                                # PASS seluruhnya
pnpm --filter @nearly/mobile exec tsc --noEmit                                                                              # status 0
```

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/judul-layar.ts apps/mobile/test/judul-layar.test.ts apps/mobile/app/_layout.tsx apps/mobile/app/mulai.tsx apps/mobile/app/dompet.tsx apps/mobile/test/gerbang-dompet.test.ts
git commit -m "feat(mobile): gerbang dompet, layar Mulai, dan layar Dompet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Mutasi — tiga penjaga**

Satu per satu; setiap kali jalankan perintah tesnya, rekam, lalu `git checkout -- <berkas>`.

| Berkas | Mutasi | Perintah | Tes yang WAJIB merah |
|---|---|---|---|
| `apps/mobile/app/mulai.tsx` | ganti kemunculan PERTAMA `{__DEV__ && (` dengan `{(` | `pnpm --filter @nearly/mobile exec vitest run test/gerbang-dompet.test.ts` | `gerbang dompet > impor kunci privat di layar Mulai hanya dirender saat __DEV__` |
| `apps/mobile/src/judul-layar.ts` | ganti `= ["mulai"];` dengan `= [];` | `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts` | `judul layar > mulai hanya tanpa dompet; index layar pertama dengan dompet` |
| `apps/mobile/src/dompet/konteks-dompet.tsx` | ganti `imporDompetKunciDev(teks, __DEV__)` dengan `imporDompetKunciDev(teks, true)` | `pnpm --filter @nearly/mobile exec vitest run test/gerbang-dompet.test.ts` | `gerbang dompet > konteks meneruskan __DEV__ ke imporDompetKunciDev` |

Setelah ketiganya: `pnpm --filter @nearly/mobile exec vitest run` PASS dan `git status --short` kosong.

---

## Task 6: Migrasi 17 layar ke `useNearlySigner`

**Files:**
- Rewrite: `apps/mobile/app/index.tsx`, `apps/mobile/test/signer.test.ts`
- Modify: `apps/mobile/src/signer.ts:16-25`, `apps/mobile/src/dompet/konteks-dompet.tsx`, `apps/mobile/src/meet-api.ts:8`, `apps/mobile/app/qr.tsx`, `app/connections.tsx`, `app/kecocokan.tsx`, `app/blokir.tsx`, `app/pesan/[address].tsx`, `app/pesan/lapor/[address].tsx`, `app/pesan/index.tsx`, `app/events/[id].tsx`, `app/events/[id]/host-qr.tsx`, `app/events/new.tsx`, `app/feed/index.tsx`, `app/feed/new.tsx`, `app/radar/[eventId].tsx`, `app/profil-saya.tsx`, `app/scan.tsx`, `app/profile/[address].tsx`
- Delete: `apps/mobile/src/use-signer.ts`, `apps/mobile/src/wallet-signer.ts`, `apps/mobile/test/use-signer.test.ts`
- Test: `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`

**Interfaces:**
- Consumes: `useNearlySigner`, `useDompet` (Task 4); `perluPengingatCadangan`, `TEKS_PENGINGAT_CADANGAN` (Task 4); `kunciDariMnemonik` (Task 1).
- Produces:
  - `createSignerDariKunci(privateKey: Hex, verifyingContract: Address): NearlySigner` (ganti nama `createDevSigner`, perilaku identik)
  - Setiap layar pemakai signer (kecuali `app/profile/[address].tsx`): `export default function <Nama>()` = pembungkus; `function <Nama>Isi({ signer }: { signer: NearlySigner })` = isi lama. `app/scan.tsx`: `ScanIsi({ signerHadir, signerSalaman })`.
  - Tidak ada lagi `pickSigner` (`use-signer.ts`) maupun `createWalletSigner` (`wallet-signer.ts`).

Kontrak domain per layar dipertahankan PERSIS (spec §6): `attendanceRegistry` untuk `events/new`, `events/[id]`, `events/[id]/host-qr`, dan check-in di `scan`; `verifyingContract` untuk sisanya.

- [ ] **Step 1: Tulis tes penjaga yang gagal**

`apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`:

```ts
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

  it("tidak ada createDevSigner di app/ dan src/", () => {
    expect(yangMemuat(/createDevSigner/)).toEqual([]);
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
```

- [ ] **Step 2: Ubah `signer.test.ts` ke nama baru (gagal dulu)**

Ganti SELURUH isi `apps/mobile/test/signer.test.ts` dengan:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  kunciPesanTypedData, recoverAcceptSigner, recoverOfferSigner, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { createSignerDariKunci } from "../src/signer";
import { kunciDariMnemonik } from "../src/dompet/dompet";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const OTHER = "0x0000000000000000000000000000000000000def" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const EXPIRES = 1_700_000_030n;

describe("createSignerDariKunci", () => {
  const signer = createSignerDariKunci(PK, VC);

  it("alamatnya sama dengan alamat turunan private key", () => {
    expect(signer.address).toBe(privateKeyToAccount(PK).address);
  });

  it("signOffer menghasilkan tanda tangan yang memulihkan alamatnya sendiri", async () => {
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signOffer(offer);
    expect(await recoverOfferSigner(offer, sig, VC)).toBe(signer.address);
  });

  it("signAccept menghasilkan tanda tangan yang memulihkan alamatnya sendiri", async () => {
    const acc = { initiator: OTHER, counterparty: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signAccept(acc);
    expect(await recoverAcceptSigner(acc, sig, VC)).toBe(signer.address);
  });

  it("tanda tangan terikat ke verifyingContract — kontrak lain tidak memulihkan alamat yang sama", async () => {
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    const sig = await signer.signOffer(offer);
    expect(await recoverOfferSigner(offer, sig, OTHER)).not.toBe(signer.address);
  });
});

describe("signer dari kunci turunan 12 kata", () => {
  const kunci = kunciDariMnemonik("test test test test test test test test test test test junk");
  const signer = createSignerDariKunci(kunci, VC);

  it("memulihkan ke alamat vektor uji", async () => {
    expect(signer.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const offer = { initiator: signer.address, nonce: NONCE, expiresAt: EXPIRES };
    expect(await recoverOfferSigner(offer, await signer.signOffer(offer), VC)).toBe(signer.address);
  });

  // Kunci pesan Fase 4c diturunkan dari tanda tangan KunciPesan (spec 4c §11.4):
  // tanda tangan yang berubah-ubah berarti riwayat pesan tidak bisa dibuka lagi.
  it("tanda tangan KunciPesan deterministik", async () => {
    const td = kunciPesanTypedData({ who: signer.address, versi: VERSI_KUNCI_PESAN }, VC);
    const a = await signer.signTypedData(td);
    const b = await signer.signTypedData(td);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts test/signer.test.ts`
Expected: FAIL —
- `signer.test.ts`: `createSignerDariKunci is not a function`;
- `tanpa kunci dev terbundel > tidak ada createDevSigner di app/ dan src/`: daftar berisi 17 layar, `src/dompet/konteks-dompet.tsx`, `src/meet-api.ts`, `src/signer.ts`, dan `src/wallet-signer.ts`;
- `… signer dari kunci hanya dibuat di konteks dompet`, `… setiap layar pemakai useNearlySigner memakai pola pembungkus`, dan `… layar pemakai signer tidak lagi membuat signer sendiri lewat useMemo` juga merah.

- [ ] **Step 4: Ganti nama di `signer.ts` dan konteks**

Di `apps/mobile/src/signer.ts`, ganti

```ts
/**
 * Signer untuk pengembangan: menandatangani dengan private key lokal, sehingga
 * seluruh alur handshake bisa diuji di simulator tanpa memasang aplikasi wallet
 * di dua perangkat.
 *
 * PERINGATAN: private key yang masuk lewat EXPO_PUBLIC_* IKUT TERBUNDEL dan bisa
 * dibaca siapa pun yang punya file aplikasinya. Pakai HANYA dompet sekali pakai
 * berisi tBNB testnet, dan jangan pernah aktif di build produksi.
 */
export function createDevSigner(privateKey: Hex, verifyingContract: Address): NearlySigner {
```

dengan

```ts
/**
 * Signer dari kunci privat dompet di HP ini (spec dompet §3). Tanda tangan
 * lokal viem deterministik (RFC 6979) — syarat kunci pesan Fase 4c.
 *
 * Satu-satunya pemanggil di aplikasi adalah useNearlySigner
 * (src/dompet/konteks-dompet.tsx); layar tidak pernah memegang kunci privat.
 * Dijaga test/dompet-tanpa-kunci-dev.test.ts.
 */
export function createSignerDariKunci(privateKey: Hex, verifyingContract: Address): NearlySigner {
```

Di `apps/mobile/src/dompet/konteks-dompet.tsx`, ganti

```tsx
import { createDevSigner, type NearlySigner } from "../signer";
```

dengan

```tsx
import { createSignerDariKunci, type NearlySigner } from "../signer";
```

dan ganti

```tsx
    () => (kunci === null ? null : createDevSigner(kunci, verifyingContract)),
```

dengan

```tsx
    () => (kunci === null ? null : createSignerDariKunci(kunci, verifyingContract)),
```

Di `apps/mobile/src/meet-api.ts`, ganti

```ts
/** Bentuk minimal yang dibutuhkan; createDevSigner memenuhinya. */
```

dengan

```ts
/** Bentuk minimal yang dibutuhkan; signer dari useNearlySigner memenuhinya. */
```

- [ ] **Step 5: Tulis ulang beranda**

Ganti SELURUH isi `apps/mobile/app/index.tsx` dengan:

```tsx
import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import type { NearlySigner } from "../src/signer";
import { useDompet, useNearlySigner } from "../src/dompet/konteks-dompet";
import { perluPengingatCadangan, TEKS_PENGINGAT_CADANGAN } from "../src/dompet/teks-dompet";
import { getKecocokan, kueriBuktiKecocokan } from "../src/meet-api";
import { teksLencana } from "../src/messages";
import { sesiPesan } from "../src/pesan/sesi";
import { getBelumDibaca } from "../src/pesan/pesan-api";

export default function Home() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const { punyaMnemonik, sudahDicadangkan } = useDompet();
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return (
    <HomeIsi
      key={signer.address}
      signer={signer}
      pengingatCadangan={perluPengingatCadangan({ punyaMnemonik, sudahDicadangkan })}
    />
  );
}

function HomeIsi({ signer, pengingatCadangan }: { signer: NearlySigner; pengingatCadangan: boolean }) {
  const [baru, setBaru] = useState(0);
  const [belumDibaca, setBelumDibaca] = useState(0);

  useEffect(() => {
    // Satu tanda tangan per pembukaan beranda, hanya untuk angka lencana.
    // Ongkos yang dipilih sadar (spec §6.2): endpoint hitung tanpa autentikasi
    // akan membocorkan berapa kecocokan dimiliki sebuah alamat.
    //
    // Fungsi async DI DALAM useEffect, bukan useEffect yang async —
    // useEffect yang mengembalikan Promise merusak jalur pembersihannya.
    void (async () => {
      try {
        const { baru } = await getKecocokan(await kueriBuktiKecocokan(signer));
        setBaru(baru);
      } catch {
        // Beranda tidak boleh gagal hanya karena lencana gagal dimuat.
        setBaru(0);
      }
    })();

    // Lencana pesan, dengan kegagalannya sendiri: beranda tidak boleh gagal
    // hanya karena lencana. Membuka beranda memulai sesi kunci pesan — dompet
    // di HP menandatangani tanpa jendela konfirmasi (spec dompet §3).
    void (async () => {
      try {
        const { total } = await getBelumDibaca(await sesiPesan(signer));
        setBelumDibaca(total);
      } catch {
        setBelumDibaca(0);
      }
    })();
  }, [signer]);

  const lencana = teksLencana(baru);
  const lencanaPesan = teksLencana(belumDibaca);

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      {pengingatCadangan && (
        <Link href="/dompet" style={s.spanduk}>{TEKS_PENGINGAT_CADANGAN}</Link>
      )}
      <Link href="/qr" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/scan" style={s.link}>Pindai QR orang lain</Link>
      <Link href="/connections" style={s.link}>Koneksiku</Link>
      <Link href="/events" style={s.link}>Acara</Link>
      <Link href="/feed" style={s.link}>Feed</Link>
      <Link href="/kecocokan" style={s.link}>
        Saling ingin bertemu{lencana ? `  ${lencana}` : ""}
      </Link>
      <Link href="/pesan" style={s.link}>
        Pesan{lencanaPesan ? `  ${lencanaPesan}` : ""}
      </Link>
      <Link href="/blokir" style={s.link}>Daftar blokir</Link>
      <Link href="/profil-saya" style={s.link}>Profil saya</Link>
      <Link href="/dompet" style={s.link}>Dompet</Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  h1: { fontSize: 32, fontWeight: "700" },
  addr: { fontFamily: "Courier", fontSize: 13, opacity: 0.6 },
  spanduk: {
    fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 8,
    backgroundColor: "#fff4d6", color: "#6b4a00", overflow: "hidden",
  },
  link: { fontSize: 17, paddingVertical: 12 },
});
```

- [ ] **Step 6: Migrasi 13 layar berpola standar**

Setiap layar di bawah mendapat TIGA penggantian persis (cari → ganti). Setiap blok "cari" muncul tepat sekali di berkasnya; kalau tidak, berhenti dan laporkan.

**6.1 — `apps/mobile/app/qr.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Hapus baris

```tsx
import { useMemo } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function QrScreen() {
  // WAJIB useMemo: tanpa ini signer lahir baru tiap render, refresh ikut berubah,
  // dan efek rotasi jalan ulang tiap detik — QR berganti tiap detik, bukan 30 detik.
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function QrScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <QrScreenIsi key={signer.address} signer={signer} />;
}

function QrScreenIsi({ signer }: { signer: NearlySigner }) {
```

**6.2 — `apps/mobile/app/connections.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useEffect, useMemo, useState } from "react";
```

   dengan

```tsx
import { useEffect, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function Connections() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function Connections() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ConnectionsIsi key={signer.address} signer={signer} />;
}

function ConnectionsIsi({ signer }: { signer: NearlySigner }) {
```

**6.3 — `apps/mobile/app/kecocokan.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function KecocokanScreen() {
  const signer = useMemo(
    // Domain meet terikat ke ConnectionRegistry, sama seperti tipe feed.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function KecocokanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <KecocokanScreenIsi key={signer.address} signer={signer} />;
}

function KecocokanScreenIsi({ signer }: { signer: NearlySigner }) {
```

**6.4 — `apps/mobile/app/blokir.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function BlokirScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function BlokirScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <BlokirScreenIsi key={signer.address} signer={signer} />;
}

function BlokirScreenIsi({ signer }: { signer: NearlySigner }) {
```

**6.5 — `apps/mobile/app/pesan/[address].tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
```

   dengan

```tsx
import { useCallback, useRef, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function PercakapanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function PercakapanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <PercakapanScreenIsi key={signer.address} signer={signer} />;
}

function PercakapanScreenIsi({ signer }: { signer: NearlySigner }) {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
```

**6.6 — `apps/mobile/app/pesan/lapor/[address].tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function LaporPesanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function LaporPesanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <LaporPesanScreenIsi key={signer.address} signer={signer} />;
}

function LaporPesanScreenIsi({ signer }: { signer: NearlySigner }) {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
```

**6.7 — `apps/mobile/app/pesan/index.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function DaftarPesanScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function DaftarPesanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <DaftarPesanScreenIsi key={signer.address} signer={signer} />;
}

function DaftarPesanScreenIsi({ signer }: { signer: NearlySigner }) {
```

**6.8 — `apps/mobile/app/events/[id].tsx`** (kontrak `CONFIG.attendanceRegistry`)

1. Ganti

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useEffect, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );
```

   dengan

```tsx
export default function EventDetailScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <EventDetailScreenIsi key={signer.address} signer={signer} />;
}

function EventDetailScreenIsi({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();
```

**6.9 — `apps/mobile/app/events/[id]/host-qr.tsx`** (kontrak `CONFIG.attendanceRegistry`)

1. Hapus baris

```tsx
import { useMemo } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function HostQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );
```

   dengan

```tsx
export default function HostQrScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <HostQrScreenIsi key={signer.address} signer={signer} />;
}

function HostQrScreenIsi({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();
```

**6.10 — `apps/mobile/app/events/new.tsx`** (kontrak `CONFIG.attendanceRegistry`)

1. Ganti

```tsx
import { useMemo, useState } from "react";
```

   dengan

```tsx
import { useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function NewEventScreen() {
  const router = useRouter();
  // WAJIB useMemo — signer di badan komponen lahir baru tiap render.
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );
```

   dengan

```tsx
export default function NewEventScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <NewEventScreenIsi key={signer.address} signer={signer} />;
}

function NewEventScreenIsi({ signer }: { signer: NearlySigner }) {
  const router = useRouter();
```

**6.11 — `apps/mobile/app/feed/index.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function FeedScreen() {
  const signer = useMemo(
    // Domain feed terikat ke ConnectionRegistry, BUKAN AttendanceRegistry.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function FeedScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <FeedScreenIsi key={signer.address} signer={signer} />;
}

function FeedScreenIsi({ signer }: { signer: NearlySigner }) {
```

**6.12 — `apps/mobile/app/feed/new.tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useMemo, useState } from "react";
```

   dengan

```tsx
import { useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function TulisScreen() {
  const router = useRouter();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function TulisScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <TulisScreenIsi key={signer.address} signer={signer} />;
}

function TulisScreenIsi({ signer }: { signer: NearlySigner }) {
  const router = useRouter();
```

**6.13 — `apps/mobile/app/radar/[eventId].tsx`** (kontrak `CONFIG.verifyingContract`)

1. Ganti

```tsx
import { useCallback, useMemo, useState } from "react";
```

   dengan

```tsx
import { useCallback, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function RadarScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function RadarScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <RadarScreenIsi key={signer.address} signer={signer} />;
}

function RadarScreenIsi({ signer }: { signer: NearlySigner }) {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
```

- [ ] **Step 7: Migrasi `app/profil-saya.tsx` (pola standar + tautan Dompet)**

Di `apps/mobile/app/profil-saya.tsx` (kontrak `CONFIG.verifyingContract`):

1. Ganti

```tsx
import { useEffect, useMemo, useState } from "react";
```

   dengan

```tsx
import { useEffect, useState } from "react";
```

2. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

   dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

3. Ganti

```tsx
export default function ProfilSayaScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
```

   dengan

```tsx
export default function ProfilSayaScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ProfilSayaScreenIsi key={signer.address} signer={signer} />;
}

function ProfilSayaScreenIsi({ signer }: { signer: NearlySigner }) {
```

4. Ganti

```tsx
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
```

   dengan

```tsx
import { Link } from "expo-router";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
```

5. Ganti

```tsx
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </ScrollView>
```

   dengan

```tsx
      {pesan && <Text style={s.pesan}>{pesan}</Text>}

      <Text style={s.label}>Dompet</Text>
      <Link href="/dompet" style={s.tautan}>Alamat, 12 kata pemulihan, dan ganti dompet</Link>
    </ScrollView>
```

6. Ganti

```tsx
  pesan: { fontSize: 15, lineHeight: 22 },
});
```

   dengan

```tsx
  pesan: { fontSize: 15, lineHeight: 22 },
  tautan: { fontSize: 15, fontWeight: "600", paddingVertical: 6 },
});
```

- [ ] **Step 8: Migrasi `app/scan.tsx` (dua signer)**

Di `apps/mobile/app/scan.tsx`:

1. Ganti

```tsx
import { createDevSigner } from "../src/signer";
```

dengan

```tsx
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
```

2. Ganti

```tsx
export default function ScanScreen() {
```

dengan

```tsx
export default function ScanScreen() {
  // Dua domain EIP-712: check-in terikat AttendanceRegistry, salaman terikat
  // ConnectionRegistry. Keduanya diambil di tingkat komponen — hook tidak boleh
  // dipanggil di dalam callback pemindai.
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const signerSalaman = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signerHadir || !signerSalaman) return null;
  return <ScanIsi key={signerSalaman.address} signerHadir={signerHadir} signerSalaman={signerSalaman} />;
}

function ScanIsi({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
```

3. Ganti

```tsx
          const signer = createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry);
```

dengan

```tsx
          const signer = signerHadir;
```

4. Ganti

```tsx
      const signer = createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract);
```

dengan

```tsx
      const signer = signerSalaman;
```

- [ ] **Step 9: Migrasi `app/profile/[address].tsx` (tanpa pembungkus)**

Layar ini sudah menangani signer `null` (Ruling D4), jadi hanya sumber signernya yang berganti. Di `apps/mobile/app/profile/[address].tsx`:

1. Ganti `import { useCallback, useEffect, useMemo, useRef, useState } from "react";` dengan `import { useCallback, useEffect, useRef, useState } from "react";`
2. Hapus baris `import { createDevSigner } from "../../src/signer";`
3. Ganti `import { WARNA } from "../../src/warna";` dengan

```tsx
import { WARNA } from "../../src/warna";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
```

4. Ganti

```tsx
  // Signer pengembangan, sama seperti layar lain di Fase 1 — wallet sungguhan
  // menyusul setelah alur ini terbukti jalan (lihat catatan di index.tsx).
  const signer = useMemo(
    () => (CONFIG.devPrivateKey
      ? createDevSigner(CONFIG.devPrivateKey, CONFIG.verifyingContract)
      : null),
    [],
  );
```

dengan

```tsx
  // Null sesaat setelah Ganti dompet; layar ini memang sudah menangani signer
  // null, jadi tidak perlu dipecah seperti layar lain (Ruling D4).
  const signer = useNearlySigner(CONFIG.verifyingContract);
```

- [ ] **Step 10: Hapus pemilih signer lama dan signer dompet luar**

`src/wallet-signer.ts` menyebut `createDevSigner` di komentarnya, dan tidak ada rencana dompet luar (spec §7) — ketiganya dihapus di sini, bukan di Task 7, supaya tes penjaga task ini bisa hijau.

```bash
git rm apps/mobile/src/use-signer.ts apps/mobile/src/wallet-signer.ts apps/mobile/test/use-signer.test.ts
```

- [ ] **Step 11: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts test/signer.test.ts   # PASS
pnpm --filter @nearly/mobile exec vitest run                                                          # PASS seluruhnya
pnpm --filter @nearly/mobile exec tsc --noEmit                                                        # status 0
grep -rn "createDevSigner" apps/mobile/app apps/mobile/src                                            # WAJIB kosong
grep -rln "useNearlySigner(" apps/mobile/app | wc -l                                                  # 17
git grep -n "pickSigner\|createWalletSigner" -- apps/mobile                                           # WAJIB kosong
```

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/test/dompet-tanpa-kunci-dev.test.ts apps/mobile/test/signer.test.ts apps/mobile/src/signer.ts apps/mobile/src/dompet/konteks-dompet.tsx apps/mobile/src/meet-api.ts apps/mobile/app/index.tsx apps/mobile/app/qr.tsx apps/mobile/app/connections.tsx apps/mobile/app/kecocokan.tsx apps/mobile/app/blokir.tsx "apps/mobile/app/pesan/[address].tsx" "apps/mobile/app/pesan/lapor/[address].tsx" apps/mobile/app/pesan/index.tsx "apps/mobile/app/events/[id].tsx" "apps/mobile/app/events/[id]/host-qr.tsx" apps/mobile/app/events/new.tsx apps/mobile/app/feed/index.tsx apps/mobile/app/feed/new.tsx "apps/mobile/app/radar/[eventId].tsx" apps/mobile/app/profil-saya.tsx apps/mobile/app/scan.tsx "apps/mobile/app/profile/[address].tsx"
git commit -m "feat(mobile): semua layar menandatangani dengan dompet HP lewat useNearlySigner

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(`git rm` di Step 10 sudah mementaskan penghapusan tiga berkas; commit ini ikut membawanya.)

- [ ] **Step 13: Mutasi — tes penjaga**

Satu per satu; setiap kali jalankan `pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts`, rekam, lalu `git checkout -- <berkas>`.

| Berkas | Mutasi | Tes yang WAJIB merah |
|---|---|---|
| `apps/mobile/app/qr.tsx` | hapus baris `  if (!signer) return null;` | `tanpa kunci dev terbundel > setiap layar pemakai useNearlySigner memakai pola pembungkus` |
| `apps/mobile/app/qr.tsx` | tambahkan baris `// createSignerDariKunci(k, v)` di akhir berkas | `tanpa kunci dev terbundel > signer dari kunci hanya dibuat di konteks dompet` |
| `apps/mobile/src/meet-api.ts` | tambahkan baris `// createDevSigner` di akhir berkas | `tanpa kunci dev terbundel > tidak ada createDevSigner di app/ dan src/` |

Setelah ketiganya: `pnpm --filter @nearly/mobile exec vitest run` PASS dan `git status --short` kosong.

---

## Task 7: Hapus kunci dev dari konfigurasi

**Files:**
- Modify: `apps/mobile/src/config.ts:1,22-23`, `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, `.env.example:37`

**Interfaces:**
- Consumes: tes penjaga Task 6.
- Produces: `CONFIG` tanpa `devPrivateKey` (`{ apiUrl, verifyingContract, vouchRegistry, attendanceRegistry }`).

- [ ] **Step 1: Perluas tes penjaga (gagal dulu)**

Di `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, ganti

```ts
  it("tidak ada createDevSigner di app/ dan src/", () => {
    expect(yangMemuat(/createDevSigner/)).toEqual([]);
  });
```

dengan

```ts
  it("tidak ada createDevSigner, devPrivateKey, atau EXPO_PUBLIC_DEV_PRIVATE_KEY di app/ dan src/", () => {
    expect(yangMemuat(/createDevSigner|devPrivateKey|EXPO_PUBLIC_DEV_PRIVATE_KEY/)).toEqual([]);
  });
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts`
Expected: FAIL — daftar berisi `src/config.ts`.

- [ ] **Step 2: Hapus `devPrivateKey` dari `config.ts`**

Di `apps/mobile/src/config.ts`, ganti `import type { Address, Hex } from "viem";` dengan `import type { Address } from "viem";`, lalu hapus dua baris ini:

```ts
  /** Hanya dipakai kalau __DEV__. Lihat peringatan di signer.ts. */
  devPrivateKey: process.env.EXPO_PUBLIC_DEV_PRIVATE_KEY as Hex | undefined,
```

- [ ] **Step 3: Komentar `.env.example` root (Ruling D15)**

Di `.env.example` (akar repo), ganti SATU baris komentar

```
# Dompet sekali pakai berisi tBNB testnet. Simpan lewat EAS secret, bukan di eas.json.
```

dengan

```
# TIDAK lagi dibaca aplikasi mobile — dompet dibuat di HP (spec 2026-09-17 dompet
# per pengguna). Hanya dipakai scripts/uji-lapangan-pesan.ts dari .env root. Untuk
# memakai identitas yang sama di HP: layar Mulai → Impor kunci privat (khusus pengembangan).
```

Baris `EXPO_PUBLIC_DEV_PRIVATE_KEY=` di bawahnya TIDAK diubah.

- [ ] **Step 4: Jalankan tes, typecheck, dan periksa sisa**

```bash
pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts   # PASS
pnpm --filter @nearly/mobile exec vitest run                                      # PASS seluruhnya
pnpm --filter @nearly/mobile exec tsc --noEmit                                    # status 0
git grep -n "EXPO_PUBLIC_DEV_PRIVATE_KEY\|devPrivateKey\|pickSigner\|createWalletSigner\|use-signer\|wallet-signer" -- apps/mobile   # WAJIB kosong
git diff -- .env.example | grep '^[-+][A-Z_]*='                                   # WAJIB kosong (hanya komentar berubah)
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/config.ts apps/mobile/test/dompet-tanpa-kunci-dev.test.ts .env.example
git commit -m "feat(mobile): hapus kunci dev terbundel dari konfigurasi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi — kunci dev kembali**

Tambahkan baris `// devPrivateKey` di akhir `apps/mobile/src/config.ts`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts`
Expected: FAIL — `tanpa kunci dev terbundel > tidak ada createDevSigner, devPrivateKey, atau EXPO_PUBLIC_DEV_PRIVATE_KEY di app/ dan src/`. Rekam, lalu:

```bash
git checkout -- apps/mobile/src/config.ts
pnpm --filter @nearly/mobile exec vitest run test/dompet-tanpa-kunci-dev.test.ts   # PASS
git status --short                                                                 # kosong
```

---

## Task 8: Amandemen spec induk, runbook, verifikasi global dan batas, serah terima

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md` (§10.1, §11), `docs/demo/runbook.md` (§3, §4 butir 2, §5)

**Interfaces:**
- Consumes: seluruh Task 1–7.
- Produces: dokumen yang sesuai dengan yang dibangun (spec §12); bukti verifikasi global dan batas jalur; daftar uji iPhone untuk pemilik project.

- [ ] **Step 1: Amandemen spec induk §10.1**

Di `docs/superpowers/specs/2026-09-03-nearly-design.md`, ganti paragraf

```
Wallet: **connect wallet yang sudah ada** sebagai jalur utama — persona anon seseorang *adalah*
wallet-nya, jadi reputasi harus menempel di sana. Embedded wallet lewat Privy sebagai cadangan
untuk pendatang baru. Tanpa OTP, tanpa email wajib.
```

dengan

```
Wallet: persona anon seseorang *adalah* wallet-nya, jadi reputasi menempel di sana. Tanpa OTP,
tanpa email wajib.

**Amandemen (2026-09-17) — dompet dibuat di HP.** Jalur saat ini BUKAN connect wallet: aplikasi
membuat dompet sendiri saat pertama dibuka — 12 kata BIP-39, jalur `m/44'/60'/0'/0/0`, kunci di
Keychain HP lewat `expo-secure-store` — dengan impor 12 kata untuk memakai alamat yang sudah ada dan
impor kunci privat khusus `__DEV__`. Alasan: aplikasi tetap di Expo Go dan belum ada Apple Developer
Program, sehingga dompet luar (WalletConnect) dan dompet tersemat (Privy) tidak tersedia. Aman karena HP
hanya menandatangani EIP-712 dan relayer yang membayar gas. Batas yang diakui — terutama: tanpa 12 kata,
hapus aplikasi atau ganti HP berarti identitas hilang — di spec `2026-09-17-nearly-dompet-per-pengguna-design.md`
§8. Menyambung dompet luar tetap mungkin kelak di development build, tetapi tidak direncanakan.
```

- [ ] **Step 2: Catatan di spec induk §11**

Tambahkan paragraf ini tepat SETELAH paragraf yang diawali `**Catatan (2026-09-14).** Fase 6 tuntas secara kode:` (dan sebelum `### 11.1`):

```
**Catatan (2026-09-17).** "Connect wallet" di Fase 0 diwujudkan sebagai **dompet yang dibuat di HP**
(amandemen §10.1, spec `2026-09-17-nearly-dompet-per-pengguna-design.md`). Kunci pengembangan yang
terbundel (`EXPO_PUBLIC_DEV_PRIVATE_KEY`) tidak lagi dibaca aplikasi, sehingga setiap HP adalah orang
yang berbeda dan graf demo bisa tumbuh.
```

- [ ] **Step 3: Runbook §3 — aplikasi mobile**

Di `docs/demo/runbook.md`, ganti

```
3. Dengan domain HTTPS, HP tidak lagi bergantung pada IP Wi-Fi Mac — HP dan laptop boleh di jaringan berbeda.
```

dengan

```
3. Dengan domain HTTPS, HP tidak lagi bergantung pada IP Wi-Fi Mac — HP dan laptop boleh di jaringan berbeda.
4. **Hapus nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` dari `apps/mobile/.env`.** Aplikasi tidak lagi membacanya:
   setiap HP membuat dompetnya sendiri di layar **Mulai** saat pertama dibuka. Untuk memakai identitas uji
   lama di HP pengembang, pilih **Impor kunci privat (khusus pengembangan)** — tombol itu hanya ada saat
   Metro berjalan dalam mode pengembangan.
```

- [ ] **Step 4: Runbook §4 butir 2 — alamat seed dari layar Dompet**

Ganti

```
2. **CSV panitia & juri.** Format `address,catatan,bobot` (lihat `docs/demo/seed-inti-contoh.csv`).
   Catatan tanpa koma. Bobot desimal biasa, > 0 dan ≤ 100 (`1`, `1.5`, `2`). Salin alamat apa adanya
   dari dompet/BscScan: alamat huruf campur diperiksa checksum-nya, jadi salah ketik satu karakter
   ditolak.
```

dengan

```
2. **CSV panitia & juri.** Setiap panitia dan juri membuka aplikasi di HP-nya sendiri: **Buat dompet baru**
   (atau **Pakai dompet yang sudah ada (12 kata)** bila sudah punya), lalu layar **Dompet** →
   **Lihat 12 kata pemulihan** → catat → **Sudah saya catat**, lalu **Bagikan alamat** dan kirim alamatnya
   ke penyusun CSV. Tanpa 12 kata yang tercatat, HP hilang atau aplikasi terhapus berarti alamat seed itu
   hilang dan CSV harus diulang. Format `address,catatan,bobot` (lihat `docs/demo/seed-inti-contoh.csv`).
   Catatan tanpa koma. Bobot desimal biasa, > 0 dan ≤ 100 (`1`, `1.5`, `2`). Tempel alamat apa adanya
   dari **Bagikan alamat** (atau BscScan): alamat huruf campur diperiksa checksum-nya, jadi salah ketik
   satu karakter ditolak.
```

- [ ] **Step 5: Runbook §5 — hari-H**

Ganti

```
2. Host menampilkan QR check-in di pintu.
```

dengan

```
2. Host menampilkan QR check-in di pintu. Peserta yang baru memasang aplikasi membuat dompet di layar
   **Mulai** lebih dulu (beberapa detik "Menyiapkan dompet…"), baru memindai QR check-in.
```

- [ ] **Step 6: Verifikasi dokumen**

```bash
grep -n "Amandemen (2026-09-17)" docs/superpowers/specs/2026-09-03-nearly-design.md        # tepat satu baris
grep -n "Catatan (2026-09-17)" docs/superpowers/specs/2026-09-03-nearly-design.md          # tepat satu baris
grep -n "Embedded wallet lewat Privy" docs/superpowers/specs/2026-09-03-nearly-design.md   # WAJIB kosong
grep -n "Bagikan alamat\|EXPO_PUBLIC_DEV_PRIVATE_KEY\|layar \*\*Mulai\*\*" docs/demo/runbook.md   # minimal §3 butir 4, §4 butir 2, §5 butir 2
```

Laporkan keluarannya apa adanya.

- [ ] **Step 7: Verifikasi global**

Jalankan dari akar worktree dan laporkan ekor keluarannya apa adanya:

```bash
pnpm -r test
pnpm -r typecheck
```

Expected: keduanya lulus di semua paket (`packages/shared`, `packages/trust`, `apps/api`, `apps/mobile`, `apps/web`).

- [ ] **Step 8: Verifikasi batas jalur (spec §11)**

Jalankan setiap perintah terpisah; grep/diff yang kosong keluar dengan status 0 atau 1 — itu hasil yang diharapkan:

```bash
git diff --stat main...HEAD -- apps/api apps/web packages supabase                              # WAJIB kosong
git diff --name-only main...HEAD | grep -vE '^(apps/mobile/|docs/|pnpm-lock\.yaml$|\.env\.example$)'   # WAJIB kosong
git diff main...HEAD -- apps/mobile/package.json | grep '^[-+] '                                # WAJIB tepat satu baris: +    "expo-secure-store": "~57.0.3",
git diff main...HEAD -- .env.example | grep '^[-+][A-Z_]*='                                     # WAJIB kosong
git grep -n "createDevSigner\|devPrivateKey\|EXPO_PUBLIC_DEV_PRIVATE_KEY" -- apps/mobile/app apps/mobile/src   # WAJIB kosong
git grep -ln "from \"expo-secure-store\"" -- apps/mobile/app apps/mobile/src                     # WAJIB tepat: apps/mobile/src/dompet/penyimpan-dompet.ts
git grep -n "@scure/bip39\|generateMnemonic" -- apps/mobile/app apps/mobile/src                  # WAJIB kosong (Ruling D2)
git status --short                                                                              # WAJIB kosong
```

Bila baris `package.json` yang berubah berbeda dari `"expo-secure-store": "~57.0.3"` (mis. Expo menulis rentang lain), laporkan apa adanya — jangan menyuntingnya.

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md docs/demo/runbook.md
git commit -m "docs: amandemen spec induk §10.1 dan runbook — dompet dibuat di HP

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Serahkan ke pemilik project** (dilakukan controller, bukan pelaksana)

1. **Hapus nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` dari `apps/mobile/.env`** (sesi eksekusi tidak menyentuh berkas itu). Simpan kunci dev lama di pengelola kata sandi bila ingin memakai identitas "alvary" lagi.
2. **Uji di iPhone (Expo Go), spec §10:**
   1. Di `apps/mobile`: `npx expo start --go -c`.
   2. Buka aplikasi → layar Mulai → **Buat dompet baru** → beranda tampil dengan alamat baru dan spanduk cadangan. Catat berapa lama "Menyiapkan dompet…" tampil (spec §8 batas #8).
   3. Layar Dompet → **Lihat 12 kata pemulihan** → catat → **Sudah saya catat** → kembali ke beranda, spanduk hilang.
   4. Tutup paksa dan buka lagi → alamat sama, tanpa layar Mulai; buka Pesan → sesi pesan jalan.
   5. Salaman dengan dompet lain (`apps/api/tools/peer.ts` atau HP kedua) → koneksi tercatat untuk alamat baru.
   6. **Ganti dompet** → layar Mulai → **Impor kunci privat (khusus pengembangan)** dengan kunci dev lama → identitas lama ("alvary", koneksi lama) kembali, pesan lama terbaca.
   7. **Ganti dompet** lagi → **Pakai dompet yang sudah ada (12 kata)** dengan kata dari langkah 3 → alamat sama dengan langkah 2. (Bila ada HP kedua: impor 12 kata yang sama di sana → alamat sama.)
   8. SecureStore: tutup paksa Expo Go → buka lagi (dompet harus tetap ada); lalu hapus dan pasang ulang Expo Go → catat apakah dompet masih ada. **Tulis hasilnya di spec dompet §8 batas #4.**
3. **Batas yang diakui (spec §8) dan di luar lingkup (spec §9)** tidak punya kode dan dilaporkan apa adanya: tanpa 12 kata identitas hilang; satu dompet per HP; kunci di Keychain, bukan dompet perangkat keras; perilaku SecureStore di Expo Go belum diketahui; alamat gratis dibuat; notifikasi dompet lama bisa sampai setelah ganti dompet sampai dompet baru membuka Pesan/Radar; 12 kata bisa tertangkap layar; PBKDF2 memblokir thread JS; keadaan `galat` hanya punya Coba lagi; ketukan notifikasi saat aplikasi mati sebelum dompet dimuat bisa terlewat.

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.
