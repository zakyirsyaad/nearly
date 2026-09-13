# Fase 4c — Pesan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun pesan teks terenkripsi ujung-ke-ujung antara dua orang yang pernah bertemu fisik, dengan gerbang dan blokir yang ditegakkan server, lapor dengan bukti yang bisa diverifikasi, dan notifikasi push best-effort.

**Architecture:** Relay sendiri: API Hono + Supabase menyimpan ciphertext saja. Kunci pesan (X25519 untuk enkripsi, Ed25519 untuk tanda tangan) diturunkan di HP dari satu tanda tangan EIP-712 `KunciPesan` yang tidak pernah dikirim; kunci publiknya didaftarkan lewat `DaftarKunciPesan`. Setiap request pesan diautentikasi dengan tanda tangan Ed25519 di header. Kripto hidup di SATU tempat, `packages/shared`, dipakai HP dan server.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono · Supabase (service role) · viem (EIP-712) · `@noble/curves` · `@noble/hashes` · `@noble/ciphers` · Zod · Vitest · Expo Router / React Native · `expo-notifications`

**Spec:** `docs/superpowers/specs/2026-09-13-nearly-fase-4c-pesan-design.md`

## Global Constraints

- **`packages/trust` TIDAK BOLEH DISENTUH.** Dibuktikan `git diff --stat <base>..HEAD -- packages/trust` kosong.
- **Tidak ada bagian fase ini yang menyentuh blockchain** — tanpa kontrak, transaksi, maupun relayer baru (spec §2).
- **Kedua tipe EIP-712 baru tidak boleh punya pasangan typehash di Solidity mana pun** (spec §6).
- Setelah fase ini aplikasi punya **dua puluh empat** tipe EIP-712, dan tidak satu pun boleh bertabrakan (spec §6).
- Domain EIP-712: `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }` — KECUALI tipe `Report`, yang sejak Fase 2 memakai `VouchRegistry` (`deps.vouchContract` di API, `CONFIG.vouchRegistry` di mobile).
- **Tanda tangan `KunciPesan` TIDAK PERNAH dikirim ke jaringan** dan tidak ada fungsi `recover` untuknya (spec §6).
- **Pesan hanya antara pasangan yang punya baris `connections` dan tidak berhubungan blokir ke arah mana pun** (spec §4). "Cocok" saja tidak membuka pesan.
- **Urutan pemeriksaan di setiap endpoint pesan: autentikasi → gerbang koneksi & blokir → data → keberadaan kunci** (spec §4).
- **Isi push: `Pesan baru dari <display_name>`, fallback `Pesan baru dari koneksimu`. TIDAK PERNAH isi pesan, alamat pengirim, maupun alamat penerima** (spec §7.2).
- **Push tidak pernah menggagalkan pengiriman pesan** (spec §7.1).
- Isi pesan maksimal **2000** karakter; `ciphertext` base64 maksimal **16384** karakter; `bodyLimit` `POST /pesan` **32 KB**; rem laju **30 pesan / 60 detik** per pengirim; jendela autentikasi **±300 detik**; riwayat maksimal **50** per halaman; bukti laporan **1–5**.
- **Setiap pemulihan tanda tangan EIP-712 lewat `pulihkanTandaTangan`**; **verifikasi Ed25519 hanya lewat fungsi `verifikasi*` di `packages/shared`** yang dijamin tidak pernah melempar — `apps/api/src` tidak boleh mengimpor `@noble/curves` langsung.
- RLS menyala di setiap tabel baru, **tanpa policy**. Kolom alamat huruf kecil saja, dengan `~` bukan `~*`.
- `apps/api/src/handshake-gate.ts` dan `apps/api/src/routes/report.ts` **tidak disentuh**.
- **Tidak ada native module baru** di luar yang didukung Expo Go (spec §9).
- Semua teks yang terlihat pengguna dan semua komentar kode berbahasa Indonesia.
- Judul tes TIDAK menyebut jumlah (pelajaran Fase 3c: judul "sembilan metode" berbohong setelah satu metode dihapus).

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/pesan.ts` | Dua tipe EIP-712 + typed data + recover `DaftarKunciPesan` |
| `packages/shared/src/pesan-kripto.ts` | Penurunan kunci, enkripsi/dekripsi, tanda/verifikasi amplop & request |
| `packages/shared/src/schema.ts` (ubah) | Skema Zod permintaan pesan |
| `packages/shared/src/index.ts` (ubah) | Ekspor dua berkas di atas |
| `packages/shared/test/typehash-semua.test.ts` (ubah) | 22 → 24 |
| `supabase/migrations/0007_pesan.sql` | `kunci_pesan`, `pesan`, `token_push`, `bukti_laporan_pesan` |
| `apps/api/src/ports.ts` (ubah) | `PesanStore`, `METODE_PESAN_STORE`, `PushPort`, `PesanDeps`; `recordReport` mengembalikan `id` |
| `apps/api/src/trust/store.ts` (ubah) | `recordReport` mengembalikan `id` |
| `apps/api/src/pesan-store.ts` | Akses Supabase untuk keempat tabel |
| `apps/api/src/pesan-auth.ts` | Autentikasi header Ed25519 |
| `apps/api/src/pesan-gate.ts` | Kunci, gerbang pasangan, kirim, riwayat, dibaca, percakapan |
| `apps/api/src/pesan-laporan.ts` | Lapor dengan bukti terverifikasi |
| `apps/api/src/push.ts` | Implementasi `PushPort` lewat Expo Push API |
| `apps/api/src/pesan-push.ts` | Keputusan & isi push, tidak pernah melempar |
| `apps/api/src/routes/pesan.ts` | Sembilan endpoint |
| `apps/api/src/app.ts`, `index.ts` (ubah) | Perakitan |
| `apps/api/test/support/dunia-pesan.ts` | Dunia di memori untuk tes gerbang & rute |
| `apps/mobile/src/pesan/sesi.ts` | Sesi kunci per kali buka aplikasi |
| `apps/mobile/src/pesan/pesan-api.ts` | `fetch` terautentikasi + pembungkus endpoint |
| `apps/mobile/src/pesan/pesan-actions.ts` | **Satu-satunya** tempat pesan dienkripsi & dikirim; buka baris; lapor |
| `apps/mobile/src/pesan/rute-push.ts` | Fungsi murni: data notifikasi → rute |
| `apps/mobile/src/pesan/push.ts` | Izin + token push best-effort |
| `apps/mobile/src/messages.ts` (ubah) | `pesanErrorMessage`, `labelKirimPesan`, `sisaKarakterPesan` |
| `apps/mobile/app/_layout.tsx` (ubah) | Pendengar ketuk notifikasi |
| `apps/mobile/app/pesan/index.tsx` | Daftar percakapan |
| `apps/mobile/app/pesan/[address].tsx` | Percakapan |
| `apps/mobile/app/pesan/lapor/[address].tsx` | Lapor dengan bukti |
| `apps/mobile/app/index.tsx`, `profile/[address].tsx` (ubah) | Tautan berlencana; tombol kirim pesan |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Amandemen §7.5 dan kawan-kawan (spec 4c §13) |

**Keputusan rencana yang menyimpang dari teks spec, dengan alasannya:**

- **`@noble/*` hanya jadi dependensi `packages/shared`, tidak ditambahkan ke `apps/mobile`** (spec §9 menyebutnya dependensi mobile). Mobile tidak pernah mengimpor `@noble` langsung — ia memakai fungsi dari `@nearly/shared`, dan pnpm meresolusi `@noble` dari `node_modules` milik shared. Menambahkannya dua kali membuka peluang dua versi berbeda di satu bundel.
- **`PesanDeps` memakai `meet.profilRingkas` untuk nama tampilan** (daftar percakapan dan isi push), bukan `profiles.getDisplayName`. `profilRingkas` sudah dipotong per kelompok dan mengambil banyak alamat sekali jalan; `getDisplayName` satu kueri per alamat.
- **Daftar percakapan tidak memeriksa ulang `connections` per lawan bicara.** Baris `pesan` hanya tercipta lewat gerbang yang memeriksa koneksi, dan koneksi di Nearly permanen (tidak ada jalur menghapusnya), jadi lawan bicara mana pun di tabel `pesan` pasti terkoneksi. Yang disaring ulang hanya blokir, lewat satu `himpunanUntuk`. Memeriksa koneksi per lawan akan menjadi kueri N+1.

---

## Task 1: Dua tipe EIP-712 pesan

**Files:**
- Create: `packages/shared/src/pesan.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/test/typehash-semua.test.ts`
- Test: `packages/shared/test/pesan.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`; `lihatFeedTypedData`, `lihatBlokirTypedData`, `lihatKecocokanTypedData`, `tandaiDilihatTypedData` (sudah ada).
- Produces:
  - `type KunciPesanMessage = { who: Address; versi: number }`
  - `type DaftarKunciPesanMessage = { who: Address; kunciEnkripsi: Hex; kunciTanda: Hex; expiresAt: bigint }`
  - `const VERSI_KUNCI_PESAN = 1`
  - `kunciPesanTypedData(msg, verifyingContract)`, `daftarKunciPesanTypedData(msg, verifyingContract)`
  - `recoverDaftarKunciPesanSigner(msg, signature, verifyingContract): Promise<Address>`
  - `PESAN_TYPES`

**Tidak ada `recoverKunciPesanSigner`, dengan sengaja.** Tanda tangan `KunciPesan` adalah bahan kunci privat. Tidak ada pihak sah yang perlu memverifikasinya, dan fungsi recover yang tersedia adalah undangan untuk mengirimnya ke server.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/pesan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import * as shared from "../src/index";
import {
  daftarKunciPesanTypedData, kunciPesanTypedData, lihatBlokirTypedData, lihatFeedTypedData,
  lihatKecocokanTypedData, recoverDaftarKunciPesanSigner, tandaiDilihatTypedData, VERSI_KUNCI_PESAN,
} from "../src/index";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const K1 = `0x${"11".repeat(32)}` as Hex;
const K2 = `0x${"22".repeat(32)}` as Hex;
const EXP = 1_800_000_000n;

const BUKTI_BACA = [lihatFeedTypedData, lihatBlokirTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData];

describe("KunciPesan", () => {
  // Kunci pesan diturunkan dari tanda tangan ini (spec 4c §5.1). Kalau tanda
  // tangannya berubah antar-panggilan, riwayat tidak bisa dibaca ulang.
  it("tanda tangannya deterministik", async () => {
    const td = kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, VC);
    expect(await A.signTypedData(td)).toBe(await A.signTypedData(td));
  });

  it("versi berbeda menghasilkan tanda tangan berbeda", async () => {
    const v1 = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    const v2 = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 2 }, VC));
    expect(v1).not.toBe(v2);
  });

  it("dompet berbeda menghasilkan tanda tangan berbeda", async () => {
    const td = (who: Address) => kunciPesanTypedData({ who, versi: 1 }, VC);
    expect(await A.signTypedData(td(A.address))).not.toBe(await B.signTypedData(td(B.address)));
  });

  it("tidak ada fungsi recover untuk KunciPesan", () => {
    const recover = Object.keys(shared).filter((k) => /^recover.*KunciPesan/.test(k));
    expect(recover).toEqual(["recoverDaftarKunciPesanSigner"]);
  });

  // Ruling 23. KunciPesan berbentuk {who, versi}, keluarga bukti baca
  // berbentuk {who, expiresAt}. Bentuk berbeda bukan jaminan — namanya yang
  // memisahkan typehash, dan inilah buktinya.
  it("tanda tangan KunciPesan tidak pulih sebagai bukti baca mana pun", async () => {
    const sig = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    for (const td of BUKTI_BACA) {
      const pulih = await recoverTypedDataAddress({ ...td({ who: A.address, expiresAt: 1n }, VC), signature: sig });
      expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
    }
  });

  it("bukti baca mana pun tidak pulih sebagai KunciPesan", async () => {
    for (const td of BUKTI_BACA) {
      const sig = await A.signTypedData(td({ who: A.address, expiresAt: 1n }, VC));
      const pulih = await recoverTypedDataAddress({
        ...kunciPesanTypedData({ who: A.address, versi: 1 }, VC), signature: sig,
      });
      expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
    }
  });
});

describe("DaftarKunciPesan", () => {
  const msg = { who: A.address, kunciEnkripsi: K1, kunciTanda: K2, expiresAt: EXP };

  it("pulih ke penandatangannya", async () => {
    const sig = await A.signTypedData(daftarKunciPesanTypedData(msg, VC));
    expect((await recoverDaftarKunciPesanSigner(msg, sig, VC)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  it("menukar kunciTanda membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(daftarKunciPesanTypedData(msg, VC));
    const ditukar = { ...msg, kunciTanda: K1 };
    expect((await recoverDaftarKunciPesanSigner(ditukar, sig, VC)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan KunciPesan tidak pulih sebagai DaftarKunciPesan", async () => {
    const sig = await A.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC));
    expect((await recoverDaftarKunciPesanSigner(msg, sig, VC)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test pesan.test`
Expected: FAIL — `kunciPesanTypedData` tidak diekspor.

- [ ] **Step 3: Buat `packages/shared/src/pesan.ts`**

Baca `packages/shared/src/blokir.ts` dulu dan ikuti bentuknya.

```ts
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * BAHAN KUNCI — bukan perintah dan bukan bukti. Tanda tangan atas tipe ini
 * diturunkan menjadi kunci privat pesan (spec 4c §5.1) dan TIDAK PERNAH
 * dikirim ke jaringan. Tanda tangan yang bocor membuka seluruh riwayat pesan.
 *
 * Sengaja tanpa `expiresAt`: tanda tangannya harus selalu sama supaya kunci
 * yang sama bisa diturunkan ulang di perangkat mana pun. Karena itu pula tidak
 * ada `recoverKunciPesanSigner` — tidak ada pihak sah yang perlu memverifikasi
 * tanda tangan ini, dan fungsi recover yang tersedia adalah undangan untuk
 * mengirimnya ke server.
 */
export type KunciPesanMessage = { who: Address; versi: number };

/** Mengikat kunci publik pesan ke dompet. Dikirim satu kali per pendaftaran. */
export type DaftarKunciPesanMessage = {
  who: Address;
  kunciEnkripsi: Hex;
  kunciTanda: Hex;
  expiresAt: bigint;
};

/** Menaikkan angka ini mengganti SEMUA kunci pesan — riwayat lama tak terbaca. */
export const VERSI_KUNCI_PESAN = 1;

const TYPES = {
  KunciPesan: [
    { name: "who", type: "address" },
    { name: "versi", type: "uint32" },
  ],
  DaftarKunciPesan: [
    { name: "who", type: "address" },
    { name: "kunciEnkripsi", type: "bytes32" },
    { name: "kunciTanda", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const PESAN_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function kunciPesanTypedData(msg: KunciPesanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { KunciPesan: TYPES.KunciPesan },
    primaryType: "KunciPesan",
    message: msg,
  } as const;
}

export function daftarKunciPesanTypedData(msg: DaftarKunciPesanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { DaftarKunciPesan: TYPES.DaftarKunciPesan },
    primaryType: "DaftarKunciPesan",
    message: msg,
  } as const;
}

export function recoverDaftarKunciPesanSigner(
  msg: DaftarKunciPesanMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...daftarKunciPesanTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 4: Ekspor dari `packages/shared/src/index.ts`**

Tambahkan baris terakhir:

```ts
export * from "./pesan";
```

- [ ] **Step 5: Perbarui penjaga typehash**

Di `packages/shared/test/typehash-semua.test.ts`:

1. Tambahkan impor `import { PESAN_TYPES } from "../src/pesan";`.
2. Tambahkan `...PESAN_TYPES,` ke objek `SEMUA`.
3. Ubah `JUMLAH_TIPE` jadi `24`, dengan komentar `// 24 sejak Fase 4c: KunciPesan dan DaftarKunciPesan.`
4. Tambahkan `+ Object.keys(PESAN_TYPES).length` ke penjumlahan di tes "jumlah tipe per keluarga".
5. Ganti judul tes `"kedua puluh dua encodeType unik"` jadi `"setiap encodeType unik"` — judul tidak boleh menyebut jumlah.
6. Tambahkan dua tes di akhir `describe`:

```ts
  // Kedua tipe pesan TIDAK PERNAH naik on-chain (spec 4c §6).
  it("tidak ada typehash pesan di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(PESAN_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType pesan persis seperti spec 4c §6", () => {
    expect(encodeType("KunciPesan", PESAN_TYPES.KunciPesan))
      .toBe("KunciPesan(address who,uint32 versi)");
    expect(encodeType("DaftarKunciPesan", PESAN_TYPES.DaftarKunciPesan))
      .toBe("DaftarKunciPesan(address who,bytes32 kunciEnkripsi,bytes32 kunciTanda,uint64 expiresAt)");
  });
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS.

- [ ] **Step 7: Buktikan penjaga tabrakan masih menggigit**

Dua mutasi, jalankan sungguhan lalu kembalikan. Keduanya perlu karena Vitest berhenti di `expect` pertama yang gagal dalam satu `it`.

**Mutasi A (jalur pertumbuhan):** tambahkan `Uji: [{ name: "x", type: "uint8" }],` ke `TYPES` di `pesan.ts`. Harapkan tes jumlah merah (25 bukan 24), dan tes `SEMUA` juga merah.

**Mutasi B (jalur tabrakan):** ganti nama kunci `DaftarKunciPesan` di `TYPES` jadi `LihatFeed` (nama yang sudah ada di keluarga feed). Harapkan tes jumlah per keluarga TETAP hijau (24) tetapi tes `"SEMUA tidak kehilangan tipe akibat tabrakan nama lintas keluarga"` merah (23).

Kalau salah satu mutasi tidak memerahkan tes yang disebut, laporkan — jangan tutupi.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/pesan.ts packages/shared/src/index.ts \
  packages/shared/test/pesan.test.ts packages/shared/test/typehash-semua.test.ts
git commit -m "feat(shared): dua tipe EIP-712 pesan"
```

---

## Task 2: Kripto pesan di `packages/shared`

**Files:**
- Create: `packages/shared/src/pesan-kripto.ts`
- Modify: `packages/shared/package.json`, `packages/shared/src/index.ts`, `pnpm-lock.yaml`
- Test: `packages/shared/test/pesan-kripto.test.ts`

**Interfaces:**
- Consumes: `kunciPesanTypedData`, `VERSI_KUNCI_PESAN` (Task 1) — hanya di tes.
- Produces:
  - `const LABEL_PESAN = "nearly-pesan-v1"`, `const MAKS_ISI_PESAN = 2000`
  - `type KunciPesanTurunan = { privTanda: Uint8Array; pubTanda: Hex; privEnkripsi: Uint8Array; pubEnkripsi: Hex }`
  - `turunkanKunciPesan(tandaTangan: Hex): KunciPesanTurunan`
  - `kunciPercakapan(privEnkripsiKu: Uint8Array, pubEnkripsiLawan: Hex, alamatA: string, alamatB: string): Uint8Array`
  - `type IsiAmplop = { pengirim: string; penerima: string; dikirimMs: number; isi: string }`
  - `type Amplop = IsiAmplop & { v: 1; tanda: Hex }`
  - `stringAmplop(a: IsiAmplop): string`, `tandaAmplop(privTanda: Uint8Array, a: IsiAmplop): Hex`, `verifikasiAmplop(a: IsiAmplop & { tanda: string }, pubTanda: string): boolean`
  - `enkripsiPesan(p: { kunci; pubEnkripsiLawan; pengirim; penerima; isi; dikirimMs }): { ciphertext: string; nonce: Hex }`
  - `type HasilBuka = { ok: true; amplop: Amplop } | { ok: false }`, `bukaPesan(p: { kunci; pubEnkripsiLawan; pubTandaPengirim; pengirim; penerima; ciphertext; nonce }): HasilBuka`
  - `type IsiRequest = { method: string; pathDenganQuery: string; badan: string; ts: number; who: string }`
  - `stringRequest(r: IsiRequest): string`, `tandaRequest(privTanda: Uint8Array, r: IsiRequest): Hex`, `verifikasiRequest(r: IsiRequest & { tanda: string }, pubTanda: string): boolean`
  - `buatIdPesan(): string` (uuid v4)

**Setiap `verifikasi*` dan `bukaPesan` TIDAK PERNAH melempar.** Masukan cacat → `false` / `{ ok: false }`. Itulah yang membuat server bebas dari bug 500-alih-alih-401 tanpa pembungkus tambahan (lihat `apps/api/src/pulihkan-tanda-tangan.ts` untuk sejarahnya).

API `@noble` di bawah sudah diperiksa terhadap versi yang terpasang di lockfile: `ed25519.sign(pesan, priv)`, `ed25519.verify(sig, pesan, pub)` mengembalikan `false` (bukan melempar) untuk tanda tangan atau kunci sampah, `x25519.getSharedSecret(priv, pub)`, `xchacha20poly1305(kunci, nonce, aad).encrypt/decrypt` melempar `invalid tag` bila AAD berbeda, dan `bytesToUtf8` tersedia di `@noble/ciphers/utils`.

- [ ] **Step 1: Pasang dependensi**

Di `packages/shared/package.json`, tambahkan ke `dependencies` versi yang SUDAH ada di lockfile lewat `viem`, supaya bundel tidak memuat dua salinan:

```json
    "@noble/ciphers": "^1.3.0",
    "@noble/curves": "^1.9.1",
    "@noble/hashes": "^1.8.0",
```

Run: `pnpm install`
Expected: lockfile hanya menambahkan tautan importer, bukan versi `@noble` baru. Periksa dengan `git diff pnpm-lock.yaml | grep -E "^\+\s+'?@noble/(curves|hashes|ciphers)@" ` — WAJIB kosong (tidak ada entri paket baru).

- [ ] **Step 2: Tulis tes yang gagal**

`packages/shared/test/pesan-kripto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import {
  bukaPesan, buatIdPesan, enkripsiPesan, kunciPercakapan, kunciPesanTypedData, MAKS_ISI_PESAN,
  stringAmplop, tandaAmplop, tandaRequest, turunkanKunciPesan, verifikasiAmplop,
  verifikasiRequest, VERSI_KUNCI_PESAN, type KunciPesanTurunan,
} from "../src/index";

const VC = "0x0000000000000000000000000000000000000abc" as Address;
const akun = (h: string) => privateKeyToAccount(`0x${h.repeat(32)}` as Hex);
const A = akun("a1");
const B = akun("b2");
const C = akun("c3");
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

async function kunciDari(a: typeof A): Promise<KunciPesanTurunan> {
  return turunkanKunciPesan(await a.signTypedData(
    kunciPesanTypedData({ who: a.address, versi: VERSI_KUNCI_PESAN }, VC)));
}

describe("turunkanKunciPesan", () => {
  it("deterministik untuk tanda tangan yang sama", async () => {
    const k1 = await kunciDari(A);
    const k2 = await kunciDari(A);
    expect(k1.pubTanda).toBe(k2.pubTanda);
    expect(k1.pubEnkripsi).toBe(k2.pubEnkripsi);
  });

  it("dompet berbeda, kunci berbeda; kunci tanda ≠ kunci enkripsi", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    expect(ka.pubTanda).not.toBe(kb.pubTanda);
    expect(ka.pubTanda).not.toBe(ka.pubEnkripsi);
    expect(ka.pubTanda).toMatch(/^0x[0-9a-f]{64}$/);
    expect(ka.pubEnkripsi).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("menolak bahan yang bukan 65 byte", () => {
    expect(() => turunkanKunciPesan(`0x${"11".repeat(32)}` as Hex)).toThrow(/65 byte/);
  });
});

describe("kunciPercakapan", () => {
  it("simetris: kedua pihak mendapat kunci yang sama", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const dariA = kunciPercakapan(ka.privEnkripsi, kb.pubEnkripsi, A.address, B.address);
    const dariB = kunciPercakapan(kb.privEnkripsi, ka.pubEnkripsi, B.address, A.address);
    expect(hex(dariA)).toBe(hex(dariB));
  });
});

describe("enkripsiPesan dan bukaPesan", () => {
  it("penerima membuka pesan dan tanda tangannya sah", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const { ciphertext, nonce } = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo\nbaris dua", dikirimMs: 1234,
    });
    const hasil = bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext, nonce,
    });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.amplop.isi).toBe("halo\nbaris dua");
      expect(hasil.amplop.dikirimMs).toBe(1234);
      expect(hasil.amplop.pengirim).toBe(A.address.toLowerCase());
    }
  });

  // Riwayat pesan milik sendiri harus terbaca ulang — kalau kunci percakapan
  // tidak simetris, pengirim kehilangan setiap pesan yang pernah ia kirim.
  it("pengirim membuka pesan kirimannya sendiri", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "catatanku", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(true);
  });

  it("orang ketiga tidak bisa membuka", async () => {
    const [ka, kb, kc] = await Promise.all([kunciDari(A), kunciDari(B), kunciDari(C)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "rahasia", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kc, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(false);
  });

  it("ciphertext yang diubah satu karakter ditolak", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    const diubah = (p.ciphertext[0] === "A" ? "B" : "A") + p.ciphertext.slice(1);
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext: diubah, nonce: p.nonce,
    }).ok).toBe(false);
  });

  // AAD mengikat arah (spec 4c §5.2): server yang menukar kolom pengirim dan
  // penerima di barisnya harus membuat dekripsi gagal — bahkan kalau
  // pemeriksa memberikan kunci tanda yang "cocok" untuk arah palsu itu.
  it("arah yang ditukar ditolak", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: B.address, penerima: A.address, ...p,
    }).ok).toBe(false);
  });

  // AAD SENDIRI, tanpa bergantung pada pemeriksaan medan amplop di bukaPesan.
  // Dua asersi sengaja dalam satu tes: AAD yang benar HARUS berhasil, AAD
  // terbalik HARUS gagal. Enkripsi tanpa AAD akan menggagalkan yang pertama.
  it("AAD terikat arah: dekripsi langsung dengan AAD benar berhasil, terbalik gagal", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    const kunci = kunciPercakapan(kb.privEnkripsi, ka.pubEnkripsi, A.address, B.address);
    const nonce = Buffer.from(p.nonce.slice(2), "hex");
    const ct = Buffer.from(p.ciphertext, "base64");
    const aadBenar = new TextEncoder().encode(`${A.address.toLowerCase()}|${B.address.toLowerCase()}`);
    const aadTerbalik = new TextEncoder().encode(`${B.address.toLowerCase()}|${A.address.toLowerCase()}`);
    expect(() => xchacha20poly1305(kunci, nonce, aadBenar).decrypt(ct)).not.toThrow();
    expect(() => xchacha20poly1305(kunci, nonce, aadTerbalik).decrypt(ct)).toThrow();
  });

  it("kunci tanda pengirim yang salah ditolak", async () => {
    const [ka, kb, kc] = await Promise.all([kunciDari(A), kunciDari(B), kunciDari(C)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: kc.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(false);
  });

  it("nonce 24 byte, ciphertext base64", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "x", dikirimMs: 1,
    });
    expect(p.nonce).toMatch(/^0x[0-9a-f]{48}$/);
    expect(p.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("isi kosong atau melebihi batas ditolak saat mengenkripsi", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const dasar = { kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi, pengirim: A.address, penerima: B.address, dikirimMs: 1 };
    expect(() => enkripsiPesan({ ...dasar, isi: "" })).toThrow();
    expect(() => enkripsiPesan({ ...dasar, isi: "x".repeat(MAKS_ISI_PESAN + 1) })).toThrow();
    expect(() => enkripsiPesan({ ...dasar, isi: "x".repeat(MAKS_ISI_PESAN) })).not.toThrow();
  });

  // Batas skema ciphertext (Task 3) harus memuat isi terpanjang yang sah,
  // termasuk karakter 4 byte.
  it("isi terpanjang dengan emoji tetap di bawah batas ciphertext 16384", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "😀".repeat(MAKS_ISI_PESAN / 2), dikirimMs: 1,
    });
    expect(p.ciphertext.length).toBeLessThanOrEqual(16384);
  });

  it("bukaPesan tidak pernah melempar untuk masukan sampah", async () => {
    const kb = await kunciDari(B);
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: "0x12" as Hex, pubTandaPengirim: "0xzz" as Hex,
      pengirim: "bukan", penerima: "alamat", ciphertext: "!!!", nonce: "0x00" as Hex,
    }).ok).toBe(false);
  });
});

describe("amplop", () => {
  it("tanda tangan amplop terverifikasi dan menolak perubahan medan mana pun", async () => {
    const ka = await kunciDari(A);
    const isi = { pengirim: A.address, penerima: B.address, dikirimMs: 5, isi: "a\nb" };
    const tanda = tandaAmplop(ka.privTanda, isi);
    expect(verifikasiAmplop({ ...isi, tanda }, ka.pubTanda)).toBe(true);
    expect(verifikasiAmplop({ ...isi, isi: "a\nc", tanda }, ka.pubTanda)).toBe(false);
    expect(verifikasiAmplop({ ...isi, dikirimMs: 6, tanda }, ka.pubTanda)).toBe(false);
    expect(verifikasiAmplop({ ...isi, penerima: C.address, tanda }, ka.pubTanda)).toBe(false);
  });

  // `isi` di posisi terakhir supaya baris baru di dalamnya tidak bisa
  // menggeser medan lain (spec 4c §5.3).
  it("isi di posisi terakhir penyandian kanonik, alamat huruf kecil", () => {
    const s = stringAmplop({ pengirim: "0xAA", penerima: "0xBB", dikirimMs: 7, isi: "x\ny" });
    expect(s).toBe("nearly-pesan-v1\n0xaa\n0xbb\n7\nx\ny");
  });

  it("verifikasiAmplop tidak pernah melempar", () => {
    expect(verifikasiAmplop({ pengirim: "a", penerima: "b", dikirimMs: Number.NaN, isi: "x", tanda: "0x99" }, "zz")).toBe(false);
    expect(verifikasiAmplop({ pengirim: "a", penerima: "b", dikirimMs: 1, isi: "x", tanda: `0x${"99".repeat(64)}` }, `0x${"ff".repeat(32)}`)).toBe(false);
  });
});

describe("tanda request", () => {
  const dasar = { method: "POST", pathDenganQuery: "/pesan", badan: "{\"a\":1}", ts: 1_700_000_000, who: A.address };

  it("terverifikasi, dan setiap medan terikat", async () => {
    const ka = await kunciDari(A);
    const tanda = tandaRequest(ka.privTanda, dasar);
    expect(verifikasiRequest({ ...dasar, tanda }, ka.pubTanda)).toBe(true);
    for (const ubah of [
      { method: "GET" }, { pathDenganQuery: "/pesan?x=1" }, { badan: "{\"a\":2}" },
      { ts: dasar.ts + 1 }, { who: B.address },
    ]) {
      expect(verifikasiRequest({ ...dasar, ...ubah, tanda }, ka.pubTanda)).toBe(false);
    }
  });

  it("verifikasiRequest tidak pernah melempar", () => {
    expect(verifikasiRequest({ ...dasar, tanda: "0x99" }, "bukan-hex")).toBe(false);
  });
});

describe("buatIdPesan", () => {
  it("uuid v4 yang unik", () => {
    const a = buatIdPesan();
    const b = buatIdPesan();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test pesan-kripto`
Expected: FAIL — `turunkanKunciPesan` tidak diekspor.

- [ ] **Step 4: Buat `packages/shared/src/pesan-kripto.ts`**

```ts
import { ed25519, x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { bytesToUtf8 } from "@noble/ciphers/utils";
import type { Hex } from "viem";

/**
 * Kripto pesan Fase 4c — SATU implementasi untuk HP dan server (spec 4c §5).
 * Kalau penyandian kanoniknya ditulis dua kali, dua sisi bisa diam-diam
 * berbeda format dan setiap tanda tangan gagal tanpa pesan galat yang jelas.
 *
 * Setiap fungsi `verifikasi*` dan `bukaPesan` TIDAK PERNAH melempar. Masukan
 * cacat berarti `false`. Itu yang membuat server tidak butuh pembungkus
 * seperti `pulihkanTandaTangan` untuk Ed25519.
 */
export const LABEL_PESAN = "nearly-pesan-v1";
export const MAKS_ISI_PESAN = 2000;

const SALT = utf8ToBytes(LABEL_PESAN);
const kecil = (a: string) => a.toLowerCase();
const keHex = (b: Uint8Array): Hex => `0x${bytesToHex(b)}`;
const dariHex = (h: string): Uint8Array => hexToBytes(h.startsWith("0x") ? h.slice(2) : h);

// base64 lewat btoa/atob: tersedia global di Node dan di Hermes.
function keBase64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function dariBase64(s: string): Uint8Array {
  const bin = atob(s);
  const keluar = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) keluar[i] = bin.charCodeAt(i);
  return keluar;
}

export type KunciPesanTurunan = {
  privTanda: Uint8Array;
  pubTanda: Hex;
  privEnkripsi: Uint8Array;
  pubEnkripsi: Hex;
};

/** Spec 4c §5.1. `tandaTangan` = tanda tangan EIP-712 `KunciPesan`, 65 byte. */
export function turunkanKunciPesan(tandaTangan: Hex): KunciPesanTurunan {
  const bahan = dariHex(tandaTangan);
  if (bahan.length !== 65) throw new Error("tanda tangan KunciPesan harus 65 byte");
  const privTanda = hkdf(sha256, bahan, SALT, utf8ToBytes("tanda-ed25519"), 32);
  const privEnkripsi = hkdf(sha256, bahan, SALT, utf8ToBytes("enkripsi-x25519"), 32);
  return {
    privTanda,
    pubTanda: keHex(ed25519.getPublicKey(privTanda)),
    privEnkripsi,
    pubEnkripsi: keHex(x25519.getPublicKey(privEnkripsi)),
  };
}

/**
 * Spec 4c §5.2 butir 2. Alamat diurutkan supaya kedua pihak mendapat kunci
 * yang sama — itu yang membuat pengirim bisa membaca riwayat kirimannya.
 */
export function kunciPercakapan(
  privEnkripsiKu: Uint8Array, pubEnkripsiLawan: Hex, alamatA: string, alamatB: string,
): Uint8Array {
  const [x, y] = [kecil(alamatA), kecil(alamatB)].sort();
  const rahasia = x25519.getSharedSecret(privEnkripsiKu, dariHex(pubEnkripsiLawan));
  return hkdf(sha256, rahasia, SALT, utf8ToBytes(`percakapan|${x}|${y}`), 32);
}

export type IsiAmplop = { pengirim: string; penerima: string; dikirimMs: number; isi: string };
export type Amplop = IsiAmplop & { v: 1; tanda: Hex };

/** Spec 4c §5.3. `isi` TERAKHIR: baris baru di dalamnya tidak bisa menggeser medan lain. */
export function stringAmplop(a: IsiAmplop): string {
  return `${LABEL_PESAN}\n${kecil(a.pengirim)}\n${kecil(a.penerima)}\n${a.dikirimMs}\n${a.isi}`;
}

export function tandaAmplop(privTanda: Uint8Array, a: IsiAmplop): Hex {
  return keHex(ed25519.sign(utf8ToBytes(stringAmplop(a)), privTanda));
}

export function verifikasiAmplop(a: IsiAmplop & { tanda: string }, pubTanda: string): boolean {
  try {
    if (!Number.isSafeInteger(a.dikirimMs) || a.dikirimMs < 0) return false;
    return ed25519.verify(dariHex(a.tanda), utf8ToBytes(stringAmplop(a)), dariHex(pubTanda));
  } catch {
    return false;
  }
}

const aad = (pengirim: string, penerima: string) =>
  utf8ToBytes(`${kecil(pengirim)}|${kecil(penerima)}`);

export function enkripsiPesan(p: {
  kunci: KunciPesanTurunan;
  pubEnkripsiLawan: Hex;
  pengirim: string;
  penerima: string;
  isi: string;
  dikirimMs: number;
}): { ciphertext: string; nonce: Hex } {
  if (p.isi.length === 0 || p.isi.length > MAKS_ISI_PESAN) {
    throw new Error(`isi pesan harus 1–${MAKS_ISI_PESAN} karakter`);
  }
  const isiAmplop: IsiAmplop = {
    pengirim: kecil(p.pengirim), penerima: kecil(p.penerima), dikirimMs: p.dikirimMs, isi: p.isi,
  };
  const amplop: Amplop = { v: 1, ...isiAmplop, tanda: tandaAmplop(p.kunci.privTanda, isiAmplop) };
  const nonce = randomBytes(24);
  const kunci = kunciPercakapan(p.kunci.privEnkripsi, p.pubEnkripsiLawan, p.pengirim, p.penerima);
  const ct = xchacha20poly1305(kunci, nonce, aad(p.pengirim, p.penerima))
    .encrypt(utf8ToBytes(JSON.stringify(amplop)));
  return { ciphertext: keBase64(ct), nonce: keHex(nonce) };
}

export type HasilBuka = { ok: true; amplop: Amplop } | { ok: false };

/**
 * Menolak (tanpa melempar) bila dekripsi gagal, bila pengirim/penerima di dalam
 * amplop tidak sama dengan kolom baris, atau bila tanda tangannya tidak cocok
 * dengan kunci tanda pengirim (spec 4c §5.2).
 *
 * `pubEnkripsiLawan` SELALU kunci enkripsi pihak LAIN dalam percakapan — untuk
 * pesan masuk maupun keluar. `pubTandaPengirim` kunci tanda siapa pun yang
 * menulis pesannya.
 */
export function bukaPesan(p: {
  kunci: KunciPesanTurunan;
  pubEnkripsiLawan: Hex;
  pubTandaPengirim: Hex;
  pengirim: string;
  penerima: string;
  ciphertext: string;
  nonce: Hex;
}): HasilBuka {
  try {
    const kunci = kunciPercakapan(p.kunci.privEnkripsi, p.pubEnkripsiLawan, p.pengirim, p.penerima);
    const polos = xchacha20poly1305(kunci, dariHex(p.nonce), aad(p.pengirim, p.penerima))
      .decrypt(dariBase64(p.ciphertext));
    const a = JSON.parse(bytesToUtf8(polos)) as Partial<Amplop>;
    if (a.v !== 1 || typeof a.isi !== "string" || typeof a.dikirimMs !== "number"
      || typeof a.tanda !== "string" || typeof a.pengirim !== "string"
      || typeof a.penerima !== "string") {
      return { ok: false };
    }
    if (kecil(a.pengirim) !== kecil(p.pengirim) || kecil(a.penerima) !== kecil(p.penerima)) {
      return { ok: false };
    }
    if (!verifikasiAmplop(a as Amplop, p.pubTandaPengirim)) return { ok: false };
    return { ok: true, amplop: a as Amplop };
  } catch {
    return { ok: false };
  }
}

export type IsiRequest = {
  method: string;
  pathDenganQuery: string;
  badan: string;
  ts: number;
  who: string;
};

/** Spec 4c §5.4. */
export function stringRequest(r: IsiRequest): string {
  const hashBadan = bytesToHex(sha256(utf8ToBytes(r.badan)));
  return `nearly-req-v1\n${r.method.toUpperCase()}\n${r.pathDenganQuery}\n${hashBadan}\n${r.ts}\n${kecil(r.who)}`;
}

export function tandaRequest(privTanda: Uint8Array, r: IsiRequest): Hex {
  return keHex(ed25519.sign(utf8ToBytes(stringRequest(r)), privTanda));
}

export function verifikasiRequest(r: IsiRequest & { tanda: string }, pubTanda: string): boolean {
  try {
    return ed25519.verify(dariHex(r.tanda), utf8ToBytes(stringRequest(r)), dariHex(pubTanda));
  } catch {
    return false;
  }
}

/** uuid v4 dari keacakan kriptografis — id pesan dibuat HP supaya kirim ulang idempoten. */
export function buatIdPesan(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
```

- [ ] **Step 5: Ekspor dari `packages/shared/src/index.ts`**

```ts
export * from "./pesan-kripto";
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS.

- [ ] **Step 7: Buktikan dua sifat keamanan menggigit**

**Mutasi A:** di `enkripsiPesan` saja, ganti argumen AAD `aad(p.pengirim, p.penerima)` dengan `undefined`. Harapkan `"AAD terikat arah: dekripsi langsung dengan AAD benar berhasil, terbalik gagal"` MERAH pada asersi pertama. (Tes `"arah yang ditukar ditolak"` boleh tetap hijau karena pemeriksaan medan amplop di `bukaPesan` juga menangkapnya — itulah sebabnya tes AAD langsung ada.)

**Mutasi B:** di `kunciPercakapan`, hapus `.sort()`. Harapkan `"simetris: kedua pihak mendapat kunci yang sama"` dan `"penerima membuka pesan dan tanda tangannya sah"` MERAH.

Kembalikan keduanya.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/package.json pnpm-lock.yaml packages/shared/src/pesan-kripto.ts \
  packages/shared/src/index.ts packages/shared/test/pesan-kripto.test.ts
git commit -m "feat(shared): kripto pesan — penurunan kunci, amplop, tanda request"
```

---

## Task 3: Skema Zod permintaan pesan

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Test: `packages/shared/test/schema-pesan.test.ts`

**Interfaces:**
- Consumes: helper privat `address`, `signature`, `unixSeconds` dan `ReportRequestSchema` yang SUDAH ADA di `schema.ts`; `MAKS_ISI_PESAN` dari Task 2.
- Produces: `DaftarKunciPesanRequestSchema`, `KirimPesanRequestSchema`, `TandaiDibacaRequestSchema`, `TokenPushRequestSchema`, `LaporanPesanRequestSchema`.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/schema-pesan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DaftarKunciPesanRequestSchema, KirimPesanRequestSchema, LaporanPesanRequestSchema,
  TandaiDibacaRequestSchema, TokenPushRequestSchema,
} from "../src/schema";

const ALAMAT = "0x000000000000000000000000000000000000bEEF";
const KUNCI = `0x${"ab".repeat(32)}`;
const SIG = `0x${"11".repeat(65)}`;
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("DaftarKunciPesanRequestSchema", () => {
  const sah = { who: ALAMAT, kunciEnkripsi: KUNCI, kunciTanda: KUNCI, expiresAt: "1800000000", sig: SIG };
  it("menerima badan sah", () => expect(DaftarKunciPesanRequestSchema.safeParse(sah).success).toBe(true));
  // Kolom basis data menuntut huruf kecil; skema menolak lebih dulu dengan 400
  // alih-alih membiarkan CHECK Postgres menjadi 500.
  it("menolak kunci berhuruf besar", () => {
    expect(DaftarKunciPesanRequestSchema.safeParse({ ...sah, kunciTanda: `0x${"AB".repeat(32)}` }).success).toBe(false);
  });
  it("menolak kunci yang bukan 32 byte", () => {
    expect(DaftarKunciPesanRequestSchema.safeParse({ ...sah, kunciEnkripsi: "0xab" }).success).toBe(false);
  });
});

describe("KirimPesanRequestSchema", () => {
  const sah = { id: ID, penerima: ALAMAT, ciphertext: "QUJD", nonce: `0x${"cd".repeat(24)}` };
  it("menerima badan sah", () => expect(KirimPesanRequestSchema.safeParse(sah).success).toBe(true));
  it("menolak id yang bukan uuid", () => expect(KirimPesanRequestSchema.safeParse({ ...sah, id: "x" }).success).toBe(false));
  it("menolak ciphertext bukan base64", () => expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "a b" }).success).toBe(false));
  it("batas ciphertext 16384 karakter", () => {
    expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "A".repeat(16385) }).success).toBe(false);
    expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "A".repeat(16384) }).success).toBe(true);
  });
  it("menolak nonce yang bukan 24 byte", () => {
    expect(KirimPesanRequestSchema.safeParse({ ...sah, nonce: `0x${"cd".repeat(12)}` }).success).toBe(false);
  });
  // Tidak ada pemeriksaan penerima = pengirim di sini: pengirim datang dari
  // header terautentikasi, bukan badan. Gerbang yang menolaknya (spec 4c §7).
});

describe("TandaiDibacaRequestSchema", () => {
  it("menerima bilangan bulat non-negatif", () => expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: 5 }).success).toBe(true));
  it("menolak pecahan dan negatif", () => {
    expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: 1.5 }).success).toBe(false);
    expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: -1 }).success).toBe(false);
  });
});

describe("TokenPushRequestSchema", () => {
  it("menerima token Expo", () => {
    expect(TokenPushRequestSchema.safeParse({ token: "ExponentPushToken[abc123_-]" }).success).toBe(true);
    expect(TokenPushRequestSchema.safeParse({ token: "ExpoPushToken[abc]" }).success).toBe(true);
  });
  it("menolak string sembarang", () => expect(TokenPushRequestSchema.safeParse({ token: "halo" }).success).toBe(false));
});

describe("LaporanPesanRequestSchema", () => {
  const laporan = {
    reporter: ALAMAT, subject: "0x000000000000000000000000000000000000cafe",
    reason: "mengirim ancaman berulang kali", expiresAt: "1800000000", sig: SIG,
  };
  const bukti = { pesanId: ID, isi: "halo", dikirimMs: 1, tanda: `0x${"ee".repeat(64)}` };
  it("menerima satu sampai lima bukti", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [bukti] }).success).toBe(true);
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: Array(5).fill(bukti) }).success).toBe(true);
  });
  it("menolak nol atau enam bukti", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [] }).success).toBe(false);
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: Array(6).fill(bukti) }).success).toBe(false);
  });
  it("menolak tanda yang bukan 64 byte", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [{ ...bukti, tanda: "0xee" }] }).success).toBe(false);
  });
  it("menolak laporan yang tidak sah menurut ReportRequestSchema", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan: { ...laporan, reason: "pendek" }, bukti: [bukti] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test schema-pesan`
Expected: FAIL — skema tidak diekspor.

- [ ] **Step 3: Tambahkan skema**

Tambahkan `import { MAKS_ISI_PESAN } from "./pesan-kripto";` ke deretan impor di puncak `packages/shared/src/schema.ts`. Lalu di akhir berkas:

```ts
// ── Fase 4c: pesan ──────────────────────────────────────────────────────────

/** Huruf kecil saja: kolom basis data menuntutnya (spec 4c §3). */
const kunciPublik = z.string().regex(/^0x[0-9a-f]{64}$/);

export const DaftarKunciPesanRequestSchema = z.object({
  who: address,
  kunciEnkripsi: kunciPublik,
  kunciTanda: kunciPublik,
  expiresAt: unixSeconds,
  sig: signature,
});

export const KirimPesanRequestSchema = z.object({
  id: z.string().uuid(),
  penerima: address,
  ciphertext: z.string().min(1).max(16384).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  nonce: z.string().regex(/^0x[0-9a-f]{48}$/),
});

export const TandaiDibacaRequestSchema = z.object({
  sampaiMs: z.number().int().nonnegative(),
});

export const TokenPushRequestSchema = z.object({
  token: z.string().max(200).regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/),
});

export const LaporanPesanRequestSchema = z.object({
  laporan: ReportRequestSchema,
  bukti: z.array(z.object({
    pesanId: z.string().uuid(),
    isi: z.string().min(1).max(MAKS_ISI_PESAN),
    dikirimMs: z.number().int().nonnegative(),
    tanda: z.string().regex(/^0x[0-9a-f]{128}$/),
  })).min(1).max(5),
});
```

`pesan-kripto.ts` tidak mengimpor `schema.ts`, jadi tidak ada impor melingkar.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema.ts packages/shared/test/schema-pesan.test.ts
git commit -m "feat(shared): skema Zod permintaan pesan"
```

---

## Task 4: Migrasi `0007_pesan.sql`

**Files:**
- Create: `supabase/migrations/0007_pesan.sql`

**Interfaces:**
- Produces: tabel `kunci_pesan`, `pesan`, `token_push`, `bukti_laporan_pesan` — dipakai Task 6.

Baca `supabase/migrations/0006_blokir.sql` dan `0002_trust.sql` (tabel `reports`) dulu; ikuti konvensi komentar dan RLS-nya.

- [ ] **Step 1: Buat berkasnya**

```sql
-- Fase 4c: pesan (spec 4c §3). Relay sendiri + E2E: server hanya menyimpan
-- ciphertext dan kunci PUBLIK. Kunci privat dan tanda tangan KunciPesan tidak
-- pernah sampai ke sini.
--
-- Semua kolom alamat huruf kecil SAJA, dengan `~` bukan `~*`. Fase 3b pernah
-- kebobolan: regex case-insensitive di kolom kunci membuat satu orang masuk
-- dua kali dengan casing berbeda.

create table if not exists kunci_pesan (
  address        text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  kunci_enkripsi text not null check (kunci_enkripsi ~ '^0x[0-9a-f]{64}$'),
  kunci_tanda    text not null check (kunci_tanda ~ '^0x[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists pesan (
  -- Dibuat HP (uuid v4), supaya kirim ulang setelah jaringan putus idempoten.
  id         uuid primary key,
  pengirim   text not null check (pengirim ~ '^0x[0-9a-f]{40}$'),
  penerima   text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
  ciphertext text not null check (char_length(ciphertext) between 1 and 16384),
  nonce      text not null check (nonce ~ '^0x[0-9a-f]{48}$'),
  created_at timestamptz not null default now(),
  dibaca_at  timestamptz,
  -- Lapis TERAKHIR. Gerbang menolak lebih dulu dengan `pesan_diri`.
  constraint pesan_bukan_diri_sendiri check (pengirim <> penerima)
);
-- Pesan TIDAK PERNAH dihapus di 4c, termasuk saat blokir: bukti laporan tidak
-- bisa dihilangkan pengirimnya, dan cabut blokir mengembalikan riwayat.

-- Daftar percakapan dan jumlah belum-dibaca.
create index if not exists pesan_penerima_idx on pesan (penerima, created_at desc);
-- Riwayat per pasangan (setiap arah) dan rem laju per pengirim.
create index if not exists pesan_pasangan_idx on pesan (pengirim, penerima, created_at desc);

create table if not exists token_push (
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  token      text not null check (char_length(token) between 1 and 200),
  created_at timestamptz not null default now(),
  -- Satu dompet bisa punya lebih dari satu HP.
  primary key (address, token)
);
-- Mencabut token dari dompet lain saat didaftarkan ulang (Task 6).
create index if not exists token_push_token_idx on token_push (token);

create table if not exists bukti_laporan_pesan (
  id          bigserial primary key,
  laporan_id  bigint not null references reports (id) on delete cascade,
  pesan_id    uuid not null references pesan (id),
  -- Plaintext yang DIBUKA pelapor untuk peninjau. Pesan lain tetap terenkripsi.
  isi         text not null check (char_length(isi) between 1 and 2000),
  dikirim_ms  bigint not null check (dikirim_ms >= 0),
  tanda       text not null check (tanda ~ '^0x[0-9a-f]{128}$'),
  -- Salinan kunci tanda terlapor SAAT diverifikasi, supaya bukti tetap bisa
  -- diperiksa ulang walau kunci kelak berganti versi.
  kunci_tanda text not null check (kunci_tanda ~ '^0x[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);
create index if not exists bukti_laporan_pesan_laporan_idx on bukti_laporan_pesan (laporan_id);

alter table kunci_pesan enable row level security;
alter table pesan enable row level security;
alter table token_push enable row level security;
alter table bukti_laporan_pesan enable row level security;
```

- [ ] **Step 2: Verifikasi bentuknya dan laporkan keluarannya apa adanya**

```bash
F=supabase/migrations/0007_pesan.sql
grep -c "enable row level security" $F        # WAJIB 4
grep -c "create policy" $F                     # WAJIB 0
grep -c "~\*" $F                               # WAJIB 0
grep -c "A-F" $F                               # WAJIB 0
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_pesan.sql
git commit -m "feat(db): tabel pesan, kunci pesan, token push, bukti laporan"
```

**Migrasi ini TIDAK diterapkan oleh pelaksana.** Pemilik project menerapkannya di Task 16.

---

## Task 5: Port pesan, dan `recordReport` mengembalikan `id`

**Files:**
- Modify: `apps/api/src/ports.ts`, `apps/api/src/trust/store.ts`
- Test: `apps/api/test/pesan-ports.test.ts`, `apps/api/test/report-store-id.test.ts`

**Interfaces:**
- Consumes: `BlokirStore`, `HandshakeStore`, `MeetStore`, `ReportStore` yang sudah ada di `ports.ts`.
- Produces (dipakai Task 6–11): `BarisPesan`, `KunciPesanTerdaftar`, `BuktiTersimpan`, `PesanStore` (14 metode di Step 3), `METODE_PESAN_STORE`, `PushPort`, `PesanDeps`; dan `ReportStore.recordReport(...)` kini `Promise<number>`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pesan-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_PESAN_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode PesanStore harus jadi tindakan
 * sadar, karena dunia-pesan.ts dan fake di support/deps.ts ikut berubah.
 * Judulnya sengaja tidak menyebut jumlah.
 */
describe("bentuk PesanStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_PESAN_STORE).toEqual([
      "simpanKunci", "ambilKunci", "simpanPesan", "hitungTerkirimSejak",
      "pesanTerbaruUntuk", "belumDibacaPerPengirim", "riwayat", "tandaiDibaca",
      "adaBelumDibacaLainDari", "simpanTokenPush", "tokenPush", "hapusTokenPush",
      "pesanBerdasarkanId", "gantiBuktiLaporan",
    ]);
  });
});
```

`apps/api/test/report-store-id.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createReportStore } from "../src/trust/store";

/**
 * Bukti laporan pesan menaut ke `reports.id` (spec 4c §3.4), jadi
 * `recordReport` harus mengembalikan id baris — termasuk saat upsert
 * memperbarui laporan lama untuk pasangan (reporter, subject) yang sama.
 */
describe("recordReport mengembalikan id", () => {
  const baris = {
    reporter: "0x00000000000000000000000000000000000000aa" as const,
    subject: "0x00000000000000000000000000000000000000bb" as const,
    reason: "alasan yang cukup panjang",
  };

  it("id baris hasil upsert", async () => {
    const panggilan: string[] = [];
    const db = {
      from: (tabel: string) => {
        panggilan.push(`from:${tabel}`);
        const b = {
          upsert: (_row: unknown, opsi: { onConflict: string }) => { panggilan.push(`upsert:${opsi.onConflict}`); return b; },
          select: (kolom: string) => { panggilan.push(`select:${kolom}`); return b; },
          single: async () => ({ data: { id: 42 }, error: null }),
        };
        return b;
      },
    } as unknown as SupabaseClient;

    expect(await createReportStore(db).recordReport(baris)).toBe(42);
    expect(panggilan).toEqual(["from:reports", "upsert:reporter,subject", "select:id"]);
  });

  it("galat basis data melempar", async () => {
    const db = {
      from: () => {
        const b = {
          upsert: () => b, select: () => b,
          single: async () => ({ data: null, error: { message: "mati" } }),
        };
        return b;
      },
    } as unknown as SupabaseClient;
    await expect(createReportStore(db).recordReport(baris)).rejects.toThrow(/catat laporan gagal/);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan-ports report-store-id`
Expected: FAIL — `METODE_PESAN_STORE` tidak diekspor; `recordReport` mengembalikan `undefined`.

- [ ] **Step 3: Tambahkan tipe di `apps/api/src/ports.ts`**

Ubah `ReportStore.recordReport` jadi:

```ts
  /** Mengembalikan `reports.id` — bukti laporan pesan menaut ke sana (spec 4c §3.4). */
  recordReport(row: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
  }): Promise<number>;
```

Lalu tambahkan di akhir berkas, setelah `BlokirDeps`:

```ts
// ── Fase 4c: pesan ──────────────────────────────────────────────────────────

export type BarisPesan = {
  id: string;
  pengirim: Address;
  penerima: Address;
  /** base64 — server tidak pernah melihat plaintext. */
  ciphertext: string;
  nonce: Hex;
  createdAtMs: number;
  dibacaAtMs: number | null;
};

export type KunciPesanTerdaftar = { kunciEnkripsi: Hex; kunciTanda: Hex };

export type BuktiTersimpan = {
  pesanId: string; isi: string; dikirimMs: number; tanda: Hex; kunciTanda: Hex;
};

export type PesanStore = {
  /** Upsert — mendaftar ulang dengan kunci yang sama tidak mengubah apa pun. */
  simpanKunci(address: Address, kunci: KunciPesanTerdaftar): Promise<void>;
  ambilKunci(address: Address): Promise<KunciPesanTerdaftar | null>;
  /** "sudah_ada" bila `id` sudah tersimpan — kirim ulang idempoten. */
  simpanPesan(row: {
    id: string; pengirim: Address; penerima: Address; ciphertext: string; nonce: Hex;
  }): Promise<"baru" | "sudah_ada">;
  /** Untuk rem laju: pesan dari `pengirim` sejak `sejakMs`. */
  hitungTerkirimSejak(pengirim: Address, sejakMs: number): Promise<number>;
  /** Pesan masuk DAN keluar `who`, terbaru dulu, paling banyak `batas`. */
  pesanTerbaruUntuk(who: Address, batas: number): Promise<BarisPesan[]>;
  /** Jumlah pesan belum dibaca per pengirim, untuk `penerima`. Berhalaman penuh. */
  belumDibacaPerPengirim(penerima: Address): Promise<Map<string, number>>;
  /** Dua arah antara `a` dan `b`, terbaru dulu. `sebelumMs` eksklusif. */
  riwayat(a: Address, b: Address, sebelumMs: number | null, batas: number): Promise<BarisPesan[]>;
  /** Pesan dari `pengirim` ke `penerima` dengan `createdAtMs <= sampaiMs`. */
  tandaiDibaca(penerima: Address, pengirim: Address, sampaiMs: number): Promise<void>;
  /** Untuk penggabungan push (spec 4c §7.1). */
  adaBelumDibacaLainDari(penerima: Address, pengirim: Address, kecualiId: string): Promise<boolean>;
  /** Satu token hanya milik satu dompet: mendaftarkannya mencabutnya dari dompet lain. */
  simpanTokenPush(address: Address, token: string): Promise<void>;
  tokenPush(address: Address): Promise<string[]>;
  hapusTokenPush(tokens: string[]): Promise<void>;
  pesanBerdasarkanId(ids: string[]): Promise<BarisPesan[]>;
  /** MENGGANTI bukti lama untuk laporan itu (spec 4c §3.4). */
  gantiBuktiLaporan(laporanId: number, bukti: BuktiTersimpan[]): Promise<void>;
};

export const METODE_PESAN_STORE = [
  "simpanKunci", "ambilKunci", "simpanPesan", "hitungTerkirimSejak",
  "pesanTerbaruUntuk", "belumDibacaPerPengirim", "riwayat", "tandaiDibaca",
  "adaBelumDibacaLainDari", "simpanTokenPush", "tokenPush", "hapusTokenPush",
  "pesanBerdasarkanId", "gantiBuktiLaporan",
] as const satisfies readonly (keyof PesanStore)[];

// Arah kedua dari pengait, sama seperti METODE_BLOKIR_STORE.
type SisaMetodePesanStore = Exclude<keyof PesanStore, (typeof METODE_PESAN_STORE)[number]>;
type AssertNeverPesan<T extends never> = T;
type _PastikanMetodePesanStoreLengkap = AssertNeverPesan<SisaMetodePesanStore>;

/** Pengirim notifikasi push. Implementasi HTTP di push.ts. */
export type PushPort = {
  kirim(p: {
    tokens: string[]; judul: string; badan: string; data: Record<string, string>;
  }): Promise<{ tokenMati: string[] }>;
};

export type PesanDeps = {
  pesan: PesanStore;
  blokir: BlokirStore;
  store: Pick<HandshakeStore, "areConnected">;
  /** Nama tampilan untuk daftar percakapan dan isi push — dipotong per kelompok. */
  meet: Pick<MeetStore, "profilRingkas">;
  reports: Pick<ReportStore, "recordReport">;
  /** null di tes dan saat push dimatikan. */
  push: PushPort | null;
  /** ConnectionRegistry — domain `DaftarKunciPesan`. */
  verifyingContract: Address;
  /** VouchRegistry — domain `Report`, sejak Fase 2. */
  vouchContract: Address;
  nowMs: () => number;
};
```

- [ ] **Step 4: Ubah `recordReport` di `apps/api/src/trust/store.ts`**

```ts
    async recordReport(row) {
      const { data, error } = await db.from("reports").upsert(
        {
          reporter: row.reporter.toLowerCase(),
          subject: row.subject.toLowerCase(),
          reason: row.reason,
          evidence: row.evidence ?? null,
        },
        { onConflict: "reporter,subject" },
      ).select("id").single();
      if (error) throw new Error(`catat laporan gagal: ${error.message}`);
      return (data as { id: number }).id;
    },
```

- [ ] **Step 5: Jalankan typecheck dan perbaiki fake yang rusak**

Run: `pnpm --filter @nearly/api typecheck`

Fake `ReportStore` di tes yang tipenya menjadi salah karena kembalian `void` akan ditunjuk typecheck. Perbaiki minimal — `vi.fn(async () => 1)`. Fake `vi.fn(async () => {})` tanpa anotasi yang tetap lolos typecheck jangan disentuh.

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 7: Buktikan pengait dua arah menggigit**

**Arah 1:** ganti `"tokenPush"` di `METODE_PESAN_STORE` jadi `"tokenPushXXX"`. Harapkan `TS2820`.

**Arah 2:** tambahkan `metodeBaruUjiCoba(): Promise<void>;` ke `PesanStore` tanpa menyentuh konstanta. Harapkan `TS2344`.

Kembalikan keduanya.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ports.ts apps/api/src/trust/store.ts \
  apps/api/test/pesan-ports.test.ts apps/api/test/report-store-id.test.ts
git commit -m "feat(api): port pesan; recordReport mengembalikan id laporan"
```

Tambahkan juga, satu per satu dengan nama eksplisit, berkas tes lain yang diubah di Step 5.

---

## Task 6: `pesan-store.ts` — akses Supabase

**Files:**
- Create: `apps/api/src/pesan-store.ts`
- Test: `apps/api/test/pesan-store.test.ts`

**Interfaces:**
- Consumes: `PesanStore`, `BarisPesan` (Task 5); `potongKelompok` dari `apps/api/src/feed-store.ts`; `fetchAllPages` dari `apps/api/src/trust/store.ts`.
- Produces: `createPesanStore(db: SupabaseClient): PesanStore`, `rowToPesan(r)`.

**Jebakan presisi waktu.** `created_at` Postgres menyimpan MIKRODETIK, `Date.parse` hanya milidetik. Pesan tercipta `10:00:00.123456` punya `createdAtMs` `…123`. Filter `lte("created_at", iso(…123))` membandingkan dengan `.123000` dan MENGECUALIKAN pesan itu sendiri — pesan terakhir tidak pernah tertandai dibaca. Karena itu `tandaiDibaca` memakai `lt("created_at", iso(sampaiMs + 1))`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pesan-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { createPesanStore } from "../src/pesan-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NONCE = `0x${"cd".repeat(24)}` as Hex;

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

/**
 * Klien palsu yang MEREKAM setiap panggilan berantai. Setiap `from()` mengambil
 * satu jawaban dari depan antrean; tanpa jawaban tersisa, ia menjawab kosong.
 */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null, count: 0 };
      const rantai: Record<string, unknown> = {};
      for (const op of [
        "select", "insert", "upsert", "update", "delete", "eq", "neq", "is", "or", "in",
        "lt", "lte", "gte", "order", "limit", "range", "maybeSingle", "single",
      ]) {
        rantai[op] = (...arg: unknown[]) => { jejak.push({ tabel, op, arg }); return rantai; };
      }
      rantai.then = (r: (v: unknown) => unknown) => r({ data: null, error: null, ...jawaban });
      return rantai;
    },
  } as unknown as SupabaseClient;
  return { db, jejak };
}

const ops = (j: Jejak[], op: string) => j.filter((x) => x.op === op);

describe("createPesanStore", () => {
  it("simpanKunci meng-upsert alamat huruf kecil", async () => {
    const { db, jejak } = dbPalsu();
    await createPesanStore(db).simpanKunci(A, {
      kunciEnkripsi: `0x${"aa".repeat(32)}` as Hex, kunciTanda: `0x${"bb".repeat(32)}` as Hex,
    });
    const up = ops(jejak, "upsert")[0]!;
    expect((up.arg[0] as { address: string }).address).toBe(A.toLowerCase());
    expect(up.arg[1]).toEqual({ onConflict: "address" });
  });

  it("ambilKunci mengembalikan null bila tidak ada", async () => {
    const { db } = dbPalsu([{ data: null, error: null }]);
    expect(await createPesanStore(db).ambilKunci(A)).toBeNull();
  });

  it("simpanPesan: pelanggaran unik 23505 berarti sudah_ada, bukan galat", async () => {
    const { db } = dbPalsu([{ error: { message: "duplicate", code: "23505" } }]);
    expect(await createPesanStore(db).simpanPesan({
      id: ID, pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    })).toBe("sudah_ada");
  });

  it("simpanPesan: galat lain melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati", code: "08006" } }]);
    await expect(createPesanStore(db).simpanPesan({
      id: ID, pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    })).rejects.toThrow(/simpan pesan gagal/);
  });

  it("simpanPesan menyimpan alamat dan id huruf kecil", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createPesanStore(db).simpanPesan({
      id: ID.toUpperCase(), pengirim: A, penerima: B, ciphertext: "QQ==", nonce: NONCE,
    });
    const baris = ops(jejak, "insert")[0]!.arg[0] as Record<string, string>;
    expect(baris.pengirim).toBe(A.toLowerCase());
    expect(baris.penerima).toBe(B.toLowerCase());
    expect(baris.id).toBe(ID);
  });

  it("riwayat menyaring KEDUA arah pasangan", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createPesanStore(db).riwayat(A, B, null, 50);
    const klausa = ops(jejak, "or")[0]!.arg[0] as string;
    const a = A.toLowerCase();
    const b = B.toLowerCase();
    expect(klausa).toContain(`and(pengirim.eq.${a},penerima.eq.${b})`);
    expect(klausa).toContain(`and(pengirim.eq.${b},penerima.eq.${a})`);
  });

  it("riwayat dengan kursor memakai lt created_at", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createPesanStore(db).riwayat(A, B, 1_700_000_000_000, 50);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(1_700_000_000_000).toISOString()]);
  });

  it("tandaiDibaca memakai lt(sampaiMs + 1) — presisi mikrodetik", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createPesanStore(db).tandaiDibaca(B, A, 1_700_000_000_123);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(1_700_000_000_124).toISOString()]);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["penerima", B.toLowerCase()], ["pengirim", A.toLowerCase()]]);
    expect(ops(jejak, "is")[0]!.arg).toEqual(["dibaca_at", null]);
  });

  it("belumDibacaPerPengirim menjumlah per pengirim huruf kecil", async () => {
    const { db } = dbPalsu([{
      data: [{ pengirim: A.toLowerCase() }, { pengirim: A.toLowerCase() }, { pengirim: B.toLowerCase() }],
    }]);
    const peta = await createPesanStore(db).belumDibacaPerPengirim(B);
    expect(peta.get(A.toLowerCase())).toBe(2);
    expect(peta.get(B.toLowerCase())).toBe(1);
  });

  it("simpanTokenPush mencabut token itu dari dompet lain lebih dulu", async () => {
    const { db, jejak } = dbPalsu([{ error: null }, { error: null }]);
    await createPesanStore(db).simpanTokenPush(A, "ExponentPushToken[x]");
    expect(jejak.map((j) => j.op).filter((o) => o === "delete" || o === "upsert")).toEqual(["delete", "upsert"]);
    expect(ops(jejak, "neq")[0]!.arg).toEqual(["address", A.toLowerCase()]);
  });

  it("hapusTokenPush tanpa token tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    await createPesanStore(db).hapusTokenPush([]);
    expect(jejak).toEqual([]);
  });

  it("gantiBuktiLaporan menghapus bukti lama lalu menyisipkan yang baru", async () => {
    const { db, jejak } = dbPalsu([{ error: null }, { error: null }]);
    await createPesanStore(db).gantiBuktiLaporan(7, [{
      pesanId: ID, isi: "halo", dikirimMs: 5,
      tanda: `0x${"ee".repeat(64)}` as Hex, kunciTanda: `0x${"bb".repeat(32)}` as Hex,
    }]);
    expect(jejak.map((j) => j.op).filter((o) => o === "delete" || o === "insert")).toEqual(["delete", "insert"]);
    expect((ops(jejak, "insert")[0]!.arg[0] as Record<string, unknown>[])[0]).toEqual({
      laporan_id: 7, pesan_id: ID, isi: "halo", dikirim_ms: 5,
      tanda: `0x${"ee".repeat(64)}`, kunci_tanda: `0x${"bb".repeat(32)}`,
    });
  });

  it("galat baca melempar, bukan jadi daftar kosong", async () => {
    const { db } = dbPalsu([{ data: null, error: { message: "mati" } }]);
    await expect(createPesanStore(db).pesanTerbaruUntuk(A, 500)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan-store`
Expected: FAIL — `createPesanStore` tidak ada.

- [ ] **Step 3: Buat `apps/api/src/pesan-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { BarisPesan, PesanStore } from "./ports";
import { potongKelompok } from "./feed-store";
import { fetchAllPages } from "./trust/store";

type BarisDb = {
  id: string; pengirim: string; penerima: string; ciphertext: string; nonce: string;
  created_at: string; dibaca_at: string | null;
};

const KOLOM = "id, pengirim, penerima, ciphertext, nonce, created_at, dibaca_at";
const kecil = (a: string) => a.toLowerCase();
const iso = (ms: number) => new Date(ms).toISOString();

export function rowToPesan(r: BarisDb): BarisPesan {
  return {
    id: r.id,
    pengirim: r.pengirim as Address,
    penerima: r.penerima as Address,
    ciphertext: r.ciphertext,
    nonce: r.nonce as Hex,
    createdAtMs: Date.parse(r.created_at),
    dibacaAtMs: r.dibaca_at ? Date.parse(r.dibaca_at) : null,
  };
}

export function createPesanStore(db: SupabaseClient): PesanStore {
  return {
    async simpanKunci(address, kunci) {
      const { error } = await db.from("kunci_pesan").upsert({
        address: kecil(address),
        kunci_enkripsi: kecil(kunci.kunciEnkripsi),
        kunci_tanda: kecil(kunci.kunciTanda),
        updated_at: new Date().toISOString(),
      }, { onConflict: "address" });
      if (error) throw new Error(`simpan kunci pesan gagal: ${error.message}`);
    },

    async ambilKunci(address) {
      const { data, error } = await db.from("kunci_pesan")
        .select("kunci_enkripsi, kunci_tanda").eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca kunci pesan gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { kunci_enkripsi: string; kunci_tanda: string };
      return { kunciEnkripsi: d.kunci_enkripsi as Hex, kunciTanda: d.kunci_tanda as Hex };
    },

    async simpanPesan(row) {
      const { error } = await db.from("pesan").insert({
        id: kecil(row.id),
        pengirim: kecil(row.pengirim),
        penerima: kecil(row.penerima),
        ciphertext: row.ciphertext,
        nonce: kecil(row.nonce),
      });
      // 23505 = unique_violation. `id` dibuat HP; yang sama berarti kirim ulang.
      if (error && (error as { code?: string }).code === "23505") return "sudah_ada";
      if (error) throw new Error(`simpan pesan gagal: ${error.message}`);
      return "baru";
    },

    async hitungTerkirimSejak(pengirim, sejakMs) {
      const { count, error } = await db.from("pesan")
        .select("id", { count: "exact", head: true })
        .eq("pengirim", kecil(pengirim)).gte("created_at", iso(sejakMs));
      if (error) throw new Error(`hitung pesan terkirim gagal: ${error.message}`);
      return count ?? 0;
    },

    async pesanTerbaruUntuk(who, batas) {
      const a = kecil(who);
      const { data, error } = await db.from("pesan").select(KOLOM)
        .or(`pengirim.eq.${a},penerima.eq.${a}`)
        .order("created_at", { ascending: false }).limit(batas);
      if (error) throw new Error(`baca pesan terbaru gagal: ${error.message}`);
      return ((data ?? []) as BarisDb[]).map(rowToPesan);
    },

    async belumDibacaPerPengirim(penerima) {
      // Berhalaman penuh: select polos terpotong 1000 baris tanpa galat
      // (trust/store.ts), dan lencana belum-dibaca yang diam-diam salah lebih
      // buruk daripada kueri yang sedikit lebih mahal.
      const baris = await fetchAllPages<{ pengirim: string }>(
        (f, t) => db.from("pesan").select("pengirim, created_at, id")
          .eq("penerima", kecil(penerima)).is("dibaca_at", null)
          .order("created_at", { ascending: true }).order("id", { ascending: true })
          .range(f, t) as never,
        "baca pesan belum dibaca",
      );
      const peta = new Map<string, number>();
      for (const r of baris) peta.set(kecil(r.pengirim), (peta.get(kecil(r.pengirim)) ?? 0) + 1);
      return peta;
    },

    async riwayat(a, b, sebelumMs, batas) {
      const x = kecil(a);
      const y = kecil(b);
      let q = db.from("pesan").select(KOLOM)
        .or(`and(pengirim.eq.${x},penerima.eq.${y}),and(pengirim.eq.${y},penerima.eq.${x})`);
      if (sebelumMs !== null) q = q.lt("created_at", iso(sebelumMs));
      const { data, error } = await q.order("created_at", { ascending: false }).limit(batas);
      if (error) throw new Error(`baca riwayat pesan gagal: ${error.message}`);
      return ((data ?? []) as BarisDb[]).map(rowToPesan);
    },

    async tandaiDibaca(penerima, pengirim, sampaiMs) {
      // `lt(sampaiMs + 1)`, BUKAN `lte(sampaiMs)`: created_at menyimpan
      // mikrodetik, dan `lte` dengan milidetik mengecualikan pesan terakhir.
      const { error } = await db.from("pesan")
        .update({ dibaca_at: new Date().toISOString() })
        .eq("penerima", kecil(penerima)).eq("pengirim", kecil(pengirim))
        .is("dibaca_at", null).lt("created_at", iso(sampaiMs + 1));
      if (error) throw new Error(`tandai dibaca gagal: ${error.message}`);
    },

    async adaBelumDibacaLainDari(penerima, pengirim, kecualiId) {
      const { count, error } = await db.from("pesan")
        .select("id", { count: "exact", head: true })
        .eq("penerima", kecil(penerima)).eq("pengirim", kecil(pengirim))
        .is("dibaca_at", null).neq("id", kecil(kecualiId));
      if (error) throw new Error(`cek belum dibaca gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async simpanTokenPush(address, token) {
      // Satu HP berganti dompet: tanpa ini, notifikasi dompet lama terus sampai
      // ke pemakai HP yang baru.
      const { error: e1 } = await db.from("token_push").delete()
        .eq("token", token).neq("address", kecil(address));
      if (e1) throw new Error(`cabut token push lama gagal: ${e1.message}`);
      const { error: e2 } = await db.from("token_push").upsert(
        { address: kecil(address), token },
        { onConflict: "address,token", ignoreDuplicates: true },
      );
      if (e2) throw new Error(`simpan token push gagal: ${e2.message}`);
    },

    async tokenPush(address) {
      const { data, error } = await db.from("token_push").select("token").eq("address", kecil(address));
      if (error) throw new Error(`baca token push gagal: ${error.message}`);
      return ((data ?? []) as { token: string }[]).map((r) => r.token);
    },

    async hapusTokenPush(tokens) {
      if (tokens.length === 0) return;
      for (const bagian of potongKelompok([...new Set(tokens)])) {
        const { error } = await db.from("token_push").delete().in("token", bagian);
        if (error) throw new Error(`hapus token push gagal: ${error.message}`);
      }
    },

    async pesanBerdasarkanId(ids) {
      const unik = [...new Set(ids.map(kecil))];
      const keluar: BarisPesan[] = [];
      for (const bagian of potongKelompok(unik)) {
        const { data, error } = await db.from("pesan").select(KOLOM).in("id", bagian);
        if (error) throw new Error(`baca pesan bukti gagal: ${error.message}`);
        keluar.push(...((data ?? []) as BarisDb[]).map(rowToPesan));
      }
      return keluar;
    },

    async gantiBuktiLaporan(laporanId, bukti) {
      const { error: e1 } = await db.from("bukti_laporan_pesan").delete().eq("laporan_id", laporanId);
      if (e1) throw new Error(`hapus bukti lama gagal: ${e1.message}`);
      if (bukti.length === 0) return;
      const { error: e2 } = await db.from("bukti_laporan_pesan").insert(bukti.map((b) => ({
        laporan_id: laporanId,
        pesan_id: kecil(b.pesanId),
        isi: b.isi,
        dikirim_ms: b.dikirimMs,
        tanda: kecil(b.tanda),
        kunci_tanda: kecil(b.kunciTanda),
      })));
      if (e2) throw new Error(`simpan bukti laporan gagal: ${e2.message}`);
    },
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test pesan-store && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 5: Buktikan dua jebakan menggigit**

**Mutasi A:** di `tandaiDibaca`, ganti `.lt("created_at", iso(sampaiMs + 1))` dengan `.lte("created_at", iso(sampaiMs))`. Harapkan `"tandaiDibaca memakai lt(sampaiMs + 1)"` MERAH.

**Mutasi B:** di `riwayat`, hapus klausa arah kedua dari `.or(...)`. Harapkan `"riwayat menyaring KEDUA arah pasangan"` MERAH.

Kembalikan keduanya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pesan-store.ts apps/api/test/pesan-store.test.ts
git commit -m "feat(api): pesan-store — kunci, pesan, token push, bukti laporan"
```

---

## Task 7: `pesan-auth.ts` — autentikasi header Ed25519

**Files:**
- Create: `apps/api/src/pesan-auth.ts`
- Modify: `apps/api/test/sig-rusak.test.ts`
- Test: `apps/api/test/pesan-auth.test.ts`

**Interfaces:**
- Consumes: `verifikasiRequest`, `tandaRequest`, `turunkanKunciPesan`, `kunciPesanTypedData`, `VERSI_KUNCI_PESAN` dari `@nearly/shared` (Task 1–2); `PesanStore` (Task 5).
- Produces:
  - `const HEADER_WHO = "x-nearly-who"`, `HEADER_TS = "x-nearly-ts"`, `HEADER_TANDA = "x-nearly-tanda"`, `JENDELA_AUTH_DETIK = 300`
  - `type RequestPesan = { method: string; pathDenganQuery: string; badan: string; header: (nama: string) => string | undefined }`
  - `pemanggilPesan(r: RequestPesan, deps: { pesan: Pick<PesanStore, "ambilKunci">; nowMs: () => number }): Promise<Address | null>`

**`ambilKunci` dipanggil DI LUAR penanganan galat apa pun.** Store yang mati harus jadi 500, bukan 401. Aturan yang sama yang tertulis di `pulihkanTandaTangan`: bungkus hanya verifikasinya, jangan pemanggilan infrastrukturnya. Di sini verifikasinya sudah total — `verifikasiRequest` tidak pernah melempar (Task 2).

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pesan-auth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, tandaRequest, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";
import { pemanggilPesan, type RequestPesan } from "../src/pesan-auth";

const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function kunci(akun: typeof A) {
  return turunkanKunciPesan(await akun.signTypedData(
    kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, VC)));
}

async function requestBertanda(over: Partial<{ method: string; path: string; badan: string; ts: number; who: string }> = {}) {
  const ka = await kunci(A);
  const isi = {
    method: over.method ?? "POST", pathDenganQuery: over.path ?? "/pesan",
    badan: over.badan ?? "{\"x\":1}", ts: over.ts ?? Math.floor(NOW / 1000), who: over.who ?? A.address,
  };
  const tanda = tandaRequest(ka.privTanda, isi);
  const header: Record<string, string> = {
    "x-nearly-who": isi.who, "x-nearly-ts": String(isi.ts), "x-nearly-tanda": tanda,
  };
  const r: RequestPesan = {
    method: isi.method, pathDenganQuery: isi.pathDenganQuery, badan: isi.badan,
    header: (n) => header[n.toLowerCase()],
  };
  return { r, header, ka };
}

function deps(peta: Record<string, { kunciEnkripsi: Hex; kunciTanda: Hex }>) {
  return {
    nowMs: () => NOW,
    pesan: { ambilKunci: vi.fn(async (a: Address) => peta[a.toLowerCase()] ?? null) },
  };
}

describe("pemanggilPesan", () => {
  it("request bertanda sah → alamat huruf kecil", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan(r, d)).toBe(A.address.toLowerCase());
  });

  it("header hilang → null tanpa membaca store", async () => {
    const { r } = await requestBertanda();
    const d = deps({});
    expect(await pemanggilPesan({ ...r, header: () => undefined }, d)).toBeNull();
    expect(d.pesan.ambilKunci).not.toHaveBeenCalled();
  });

  it("ts di luar jendela 300 detik → null", async () => {
    for (const geser of [-301, 301]) {
      const { r, ka } = await requestBertanda({ ts: Math.floor(NOW / 1000) + geser });
      const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
      expect(await pemanggilPesan(r, d)).toBeNull();
    }
  });

  it("alamat tanpa kunci terdaftar → null", async () => {
    const { r } = await requestBertanda();
    expect(await pemanggilPesan(r, deps({}))).toBeNull();
  });

  it("badan diubah setelah ditandatangani → null", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan({ ...r, badan: "{\"x\":2}" }, d)).toBeNull();
  });

  it("path diubah setelah ditandatangani → null", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan({ ...r, pathDenganQuery: "/pesan/kunci" }, d)).toBeNull();
  });

  // Tanda tangan A tapi mengaku B, dan B punya kunci terdaftar.
  it("mengaku alamat lain → null", async () => {
    const { header, ka } = await requestBertanda();
    const kb = await kunci(B);
    const d = deps({
      [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda },
      [B.address.toLowerCase()]: { kunciEnkripsi: kb.pubEnkripsi, kunciTanda: kb.pubTanda },
    });
    const palsu = { ...header, "x-nearly-who": B.address };
    expect(await pemanggilPesan({
      method: "POST", pathDenganQuery: "/pesan", badan: "{\"x\":1}", header: (n) => palsu[n],
    }, d)).toBeNull();
  });

  it("tanda cacat bentuk → null, bukan lemparan", async () => {
    const { header, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    const cacat = { ...header, "x-nearly-tanda": `0x${"9".repeat(130)}` };
    await expect(pemanggilPesan({
      method: "POST", pathDenganQuery: "/pesan", badan: "{\"x\":1}", header: (n) => cacat[n],
    }, d)).resolves.toBeNull();
  });

  // Store yang mati BUKAN penolakan autentikasi — ia harus sampai ke Hono
  // sebagai 500 supaya pemadaman terlihat.
  it("galat store merambat, tidak dicuci jadi null", async () => {
    const { r } = await requestBertanda();
    const d = { nowMs: () => NOW, pesan: { ambilKunci: vi.fn(async () => { throw new Error("db mati"); }) } };
    await expect(pemanggilPesan(r, d)).rejects.toThrow("db mati");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan-auth`
Expected: FAIL — `pemanggilPesan` tidak ada.

- [ ] **Step 3: Buat `apps/api/src/pesan-auth.ts`**

```ts
import { isAddress, type Address } from "viem";
import { verifikasiRequest } from "@nearly/shared";
import type { PesanStore } from "./ports";

export const HEADER_WHO = "x-nearly-who";
export const HEADER_TS = "x-nearly-ts";
export const HEADER_TANDA = "x-nearly-tanda";
export const JENDELA_AUTH_DETIK = 300;

export type RequestPesan = {
  method: string;
  /** Persis seperti yang ditandatangani HP: path + query string, tanpa host. */
  pathDenganQuery: string;
  /** Badan mentah sebagai teks; "" untuk GET. */
  badan: string;
  header: (nama: string) => string | undefined;
};

/**
 * Autentikasi request pesan (spec 4c §5.4). Header, bukan query string, supaya
 * tanda tangan tidak masuk log URL.
 *
 * Mengembalikan alamat pemanggil huruf kecil, atau null untuk SEMUA bentuk
 * penolakan — header hilang, `ts` di luar jendela, kunci tak terdaftar, tanda
 * tangan salah maupun cacat. Penolakan tidak dibedakan supaya respons tidak
 * memberi tahu penyerang mengapa ia ditolak.
 *
 * `ambilKunci` sengaja TIDAK dibungkus: store yang mati harus jadi 500.
 * `verifikasiRequest` sendiri total — tidak pernah melempar (packages/shared).
 */
export async function pemanggilPesan(
  r: RequestPesan,
  deps: { pesan: Pick<PesanStore, "ambilKunci">; nowMs: () => number },
): Promise<Address | null> {
  const who = r.header(HEADER_WHO);
  const ts = r.header(HEADER_TS);
  const tanda = r.header(HEADER_TANDA);
  if (!who || !ts || !tanda) return null;
  if (!isAddress(who, { strict: false })) return null;
  if (!/^\d{1,12}$/.test(ts)) return null;
  const detik = Number(ts);
  if (Math.abs(deps.nowMs() / 1000 - detik) > JENDELA_AUTH_DETIK) return null;

  const kunci = await deps.pesan.ambilKunci(who.toLowerCase() as Address);
  if (!kunci) return null;

  const sah = verifikasiRequest({
    method: r.method, pathDenganQuery: r.pathDenganQuery, badan: r.badan, ts: detik, who, tanda,
  }, kunci.kunciTanda);
  return sah ? (who.toLowerCase() as Address) : null;
}
```

- [ ] **Step 4: Tambahkan penjaga struktural di `apps/api/test/sig-rusak.test.ts`**

Tambahkan `describe` baru di akhir berkas:

```ts
/**
 * Fase 4c. Verifikasi Ed25519 hanya boleh lewat fungsi `verifikasi*` di
 * packages/shared, yang dijamin tidak pernah melempar. `ed25519.verify`
 * telanjang di apps/api bisa melempar untuk masukan cacat — mengembalikan bug
 * 500-alih-alih-401 yang `pulihkanTandaTangan` tutup untuk EIP-712.
 */
describe("verifikasi Ed25519 hanya lewat packages/shared", () => {
  it("apps/api/src tidak mengimpor @noble/curves langsung", () => {
    const src = join(__dirname, "..", "src");
    const semua: string[] = [];
    const jelajah = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) jelajah(p);
        else if (p.endsWith(".ts")) semua.push(p);
      }
    };
    jelajah(src);
    expect(semua.length).toBeGreaterThan(10);
    const pelanggar = semua.filter((f) => /from\s+["']@noble\/curves/.test(readFileSync(f, "utf8")));
    expect(pelanggar).toEqual([]);
  });
});
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test pesan-auth sig-rusak && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 6: Buktikan dua hal menggigit**

**Mutasi A:** tambahkan `import { ed25519 } from "@noble/curves/ed25519";` di baris atas `pesan-auth.ts`. Harapkan tes penjaga struktural MERAH. (Typecheck boleh ikut gagal karena `apps/api` tidak bergantung langsung pada `@noble/curves` — itu tambahan, bukan pengganti.)

**Mutasi B:** hapus pemeriksaan jendela waktu (`if (Math.abs(...) > JENDELA_AUTH_DETIK) return null;`). Harapkan `"ts di luar jendela 300 detik → null"` MERAH.

Kembalikan keduanya.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/pesan-auth.ts apps/api/test/pesan-auth.test.ts apps/api/test/sig-rusak.test.ts
git commit -m "feat(api): autentikasi request pesan lewat tanda tangan Ed25519"
```

---

## Task 8: Dunia uji pesan dan `pesan-gate.ts`

**Files:**
- Create: `apps/api/test/support/dunia-pesan.ts`, `apps/api/src/pesan-gate.ts`
- Test: `apps/api/test/pesan-gate.test.ts`

**Interfaces:**
- Consumes: `PesanDeps`, `PesanStore`, `BarisPesan`, `KunciPesanTerdaftar` (Task 5); `duniaBlokir` dari `apps/api/test/support/dunia-blokir.ts` (sudah ada); `recoverDaftarKunciPesanSigner`, `daftarKunciPesanTypedData`, `kunciPesanTypedData`, `turunkanKunciPesan`, `VERSI_KUNCI_PESAN` dari `@nearly/shared`; `pulihkanTandaTangan`.
- Produces:
  - `duniaPesan(awal)` → `{ deps, db, push, laporan, jam, pasangBlokir }`, `buatPengguna(hexByte)`, `VC_PESAN`, `VOUCH_PESAN` (support)
  - `type PesanFailure`, `type PesanResult<T>`
  - `BATAS_LAJU = 30`, `JENDELA_LAJU_MS = 60_000`, `JENDELA_PERCAKAPAN = 500`, `MAKS_HALAMAN_RIWAYAT = 50`
  - `daftarKunci(input: DaftarKunciInput, deps): Promise<PesanResult<void>>`
  - `gerbangPasangan(a: Address, b: Address, deps): Promise<PesanFailure | null>`
  - `ambilKunciLawan(pemanggil: Address, lawan: Address, deps): Promise<PesanResult<KunciPesanTerdaftar>>`
  - `kirimPesan(pemanggil: Address, input: KirimInput, deps): Promise<PesanResult<{ baru: boolean }>>`
  - `kelompokkanPercakapan(baris: BarisPesan[], pemanggil: Address, terblokir: ReadonlySet<string>): { lawan: Address; terakhir: BarisPesan }[]`
  - `type RingkasanPercakapan = { lawan: Address; displayName: string; tier: number; belumDibaca: number; terakhir: BarisPesan }`
  - `daftarPercakapan(pemanggil: Address, deps): Promise<RingkasanPercakapan[]>`
  - `riwayatPercakapan(pemanggil: Address, lawan: Address, sebelumMs: number | null, batas: number, deps): Promise<PesanResult<BarisPesan[]>>`
  - `tandaiPercakapanDibaca(pemanggil: Address, lawan: Address, sampaiMs: number, deps): Promise<PesanResult<void>>`
  - `totalBelumDibaca(pemanggil: Address, deps): Promise<number>`
  - `simpanTokenPush(pemanggil: Address, token: string, deps): Promise<void>`

Fungsi gerbang menerima `pemanggil` yang SUDAH terautentikasi (Task 7). Rute (Task 11) yang merangkai keduanya.

- [ ] **Step 1: Buat dunia uji `apps/api/test/support/dunia-pesan.ts`**

```ts
import { vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";
import type {
  BarisPesan, BuktiTersimpan, KunciPesanTerdaftar, PesanDeps, PesanStore, PushPort,
} from "../../src/ports";
import { duniaBlokir } from "./dunia-blokir";

export const VC_PESAN = "0x0000000000000000000000000000000000000abc" as Address;
export const VOUCH_PESAN = "0x0000000000000000000000000000000000000def" as Address;

/** Pengguna uji dengan kunci pesan SUNGGUHAN, diturunkan persis seperti di HP. */
export async function buatPengguna(hexByte: string) {
  const akun = privateKeyToAccount(`0x${hexByte.repeat(32)}` as Hex);
  const kunci = turunkanKunciPesan(await akun.signTypedData(
    kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, VC_PESAN)));
  return {
    akun,
    address: akun.address as Address,
    kunci,
    terdaftar: { kunciEnkripsi: kunci.pubEnkripsi, kunciTanda: kunci.pubTanda } as KunciPesanTerdaftar,
  };
}

/**
 * Dunia pesan di memori: tabel sebagai larik, dengan PesanStore yang
 * membacanya SUNGGUHAN. Blokir memakai duniaBlokir supaya kedua arahnya
 * nyata. Fake yang mengembalikan jawaban karangan tidak bisa membuktikan
 * urutan gerbang — "bukan koneksi tidak bisa membedakan belum_siap" hanya
 * bermakna kalau kunci lawan BENAR-BENAR ada di dunia ini.
 */
export function duniaPesan(awal: {
  koneksi?: [Address, Address][];
  blokir?: { blocker: Address; blocked: Address }[];
  nama?: Record<string, string>;
  nowMs?: number;
} = {}) {
  const kecil = (a: string) => a.toLowerCase();
  const pasangan = (a: string, b: string) => [kecil(a), kecil(b)].sort().join("|");
  const koneksi = new Set((awal.koneksi ?? []).map(([a, b]) => pasangan(a, b)));
  const nama = new Map(Object.entries(awal.nama ?? {}).map(([k, v]) => [kecil(k), v]));
  const jam = { sekarang: awal.nowMs ?? 1_700_000_000_000 };
  const db = {
    kunci: new Map<string, KunciPesanTerdaftar>(),
    pesan: [] as BarisPesan[],
    token: [] as { address: string; token: string }[],
    bukti: new Map<number, BuktiTersimpan[]>(),
  };
  const blok = duniaBlokir({ blokir: awal.blokir });
  const laporan: { id: number; reporter: string; subject: string; reason: string }[] = [];

  const pesan: PesanStore = {
    simpanKunci: vi.fn(async (a: Address, k: KunciPesanTerdaftar) => {
      db.kunci.set(kecil(a), { kunciEnkripsi: kecil(k.kunciEnkripsi) as Hex, kunciTanda: kecil(k.kunciTanda) as Hex });
    }),
    ambilKunci: vi.fn(async (a: Address) => db.kunci.get(kecil(a)) ?? null),
    simpanPesan: vi.fn(async (r) => {
      if (db.pesan.some((p) => p.id === kecil(r.id))) return "sudah_ada" as const;
      db.pesan.push({
        id: kecil(r.id), pengirim: kecil(r.pengirim) as Address, penerima: kecil(r.penerima) as Address,
        ciphertext: r.ciphertext, nonce: r.nonce, createdAtMs: jam.sekarang, dibacaAtMs: null,
      });
      return "baru" as const;
    }),
    hitungTerkirimSejak: vi.fn(async (p: Address, sejak: number) =>
      db.pesan.filter((x) => x.pengirim === kecil(p) && x.createdAtMs >= sejak).length),
    pesanTerbaruUntuk: vi.fn(async (w: Address, batas: number) => db.pesan
      .filter((x) => x.pengirim === kecil(w) || x.penerima === kecil(w))
      .sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, batas)),
    belumDibacaPerPengirim: vi.fn(async (pen: Address) => {
      const m = new Map<string, number>();
      for (const x of db.pesan) {
        if (x.penerima === kecil(pen) && x.dibacaAtMs === null) m.set(x.pengirim, (m.get(x.pengirim) ?? 0) + 1);
      }
      return m;
    }),
    riwayat: vi.fn(async (a: Address, b: Address, sebelum: number | null, batas: number) => db.pesan
      .filter((x) => pasangan(x.pengirim, x.penerima) === pasangan(a, b)
        && (sebelum === null || x.createdAtMs < sebelum))
      .sort((p, q) => q.createdAtMs - p.createdAtMs).slice(0, batas)),
    tandaiDibaca: vi.fn(async (pen: Address, pengirim: Address, sampai: number) => {
      for (const x of db.pesan) {
        if (x.penerima === kecil(pen) && x.pengirim === kecil(pengirim)
          && x.dibacaAtMs === null && x.createdAtMs <= sampai) x.dibacaAtMs = jam.sekarang;
      }
    }),
    adaBelumDibacaLainDari: vi.fn(async (pen: Address, pengirim: Address, kecuali: string) => db.pesan
      .some((x) => x.penerima === kecil(pen) && x.pengirim === kecil(pengirim)
        && x.dibacaAtMs === null && x.id !== kecil(kecuali))),
    simpanTokenPush: vi.fn(async (a: Address, t: string) => {
      db.token = db.token.filter((x) => !(x.token === t && x.address !== kecil(a)));
      if (!db.token.some((x) => x.token === t)) db.token.push({ address: kecil(a), token: t });
    }),
    tokenPush: vi.fn(async (a: Address) => db.token.filter((x) => x.address === kecil(a)).map((x) => x.token)),
    hapusTokenPush: vi.fn(async (ts: string[]) => { db.token = db.token.filter((x) => !ts.includes(x.token)); }),
    pesanBerdasarkanId: vi.fn(async (ids: string[]) => db.pesan.filter((x) => ids.map(kecil).includes(x.id))),
    gantiBuktiLaporan: vi.fn(async (id: number, b: BuktiTersimpan[]) => { db.bukti.set(id, b); }),
  };

  const push = { kirim: vi.fn<PushPort["kirim"]>(async () => ({ tokenMati: [] })) };

  const deps: PesanDeps = {
    pesan,
    blokir: blok.blokir,
    store: { areConnected: vi.fn(async (a: Address, b: Address) => koneksi.has(pasangan(a, b))) },
    meet: {
      profilRingkas: vi.fn(async (addrs: Address[]) => new Map(addrs.map((a) => [
        kecil(a), { displayName: nama.get(kecil(a)) ?? "", tier: 1 },
      ]))),
    },
    reports: {
      recordReport: vi.fn(async (r) => {
        const id = laporan.length + 1;
        laporan.push({ id, reporter: kecil(r.reporter), subject: kecil(r.subject), reason: r.reason });
        return id;
      }),
    },
    push,
    verifyingContract: VC_PESAN,
    vouchContract: VOUCH_PESAN,
    nowMs: () => jam.sekarang,
  };

  return { deps, db, push, laporan, jam, pasangBlokir: blok.pasangBlokir };
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`apps/api/test/pesan-gate.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { daftarKunciPesanTypedData, kunciPesanTypedData } from "@nearly/shared";
import {
  ambilKunciLawan, daftarKunci, daftarPercakapan, kirimPesan, riwayatPercakapan,
  tandaiPercakapanDibaca, totalBelumDibaca,
} from "../src/pesan-gate";
import { buatPengguna, duniaPesan, VC_PESAN } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>;
let B: Awaited<ReturnType<typeof buatPengguna>>;
let C: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

const NONCE = `0x${"cd".repeat(24)}` as Hex;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function siapkan(over: Parameters<typeof duniaPesan>[0] = {}) {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], ...over });
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  d.db.kunci.set(B.address.toLowerCase(), B.terdaftar);
  return d;
}

describe("daftarKunci", () => {
  const exp = (nowMs: number) => BigInt(Math.floor(nowMs / 1000) + 300);

  it("tanda tangan sah menyimpan kunci", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await A.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect((await daftarKunci({ ...msg, sig }, d.deps)).ok).toBe(true);
    expect(d.db.kunci.get(A.address.toLowerCase())).toEqual(A.terdaftar);
  });

  it("kedaluwarsa → 410", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) - 1) };
    const sig = await A.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect(await daftarKunci({ ...msg, sig }, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  // Mendaftarkan kunci atas nama orang lain = membaca pesan yang dikirim ke dia.
  it("ditandatangani dompet lain → 401, tidak tersimpan", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: C.terdaftar.kunciEnkripsi, kunciTanda: C.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await C.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect(await daftarKunci({ ...msg, sig }, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(d.db.kunci.size).toBe(0);
  });

  it("tanda tangan KunciPesan tidak diterima sebagai DaftarKunciPesan → 401", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await A.akun.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC_PESAN));
    expect((await daftarKunci({ ...msg, sig }, d.deps)).ok).toBe(false);
  });

  it("tanda tangan cacat bentuk → 401, bukan lemparan", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    await expect(daftarKunci({ ...msg, sig: `0x${"9".repeat(130)}` as Hex }, d.deps))
      .resolves.toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });
});

describe("gerbang pasangan lewat ambilKunciLawan", () => {
  it("diri sendiri → 400 pesan_diri", async () => {
    const d = siapkan();
    expect(await ambilKunciLawan(A.address, A.address, d.deps)).toEqual({ ok: false, failure: { code: "pesan_diri", httpStatus: 400 } });
  });

  // INTI spec 4c §4: bukan koneksi tidak boleh bisa membedakan "dia punya
  // kunci" dari "dia belum memakai pesan". Keduanya 403 tidak_terhubung.
  it("bukan koneksi → 403 tidak_terhubung, sama persis entah lawan punya kunci atau tidak", async () => {
    const d = siapkan();
    const punyaKunci = await ambilKunciLawan(C.address, A.address, d.deps);
    const d2 = siapkan();
    d2.db.kunci.delete(A.address.toLowerCase());
    const tanpaKunci = await ambilKunciLawan(C.address, A.address, d2.deps);
    expect(punyaKunci).toEqual({ ok: false, failure: { code: "tidak_terhubung", httpStatus: 403 } });
    expect(tanpaKunci).toEqual(punyaKunci);
    expect(d.deps.pesan.ambilKunci).not.toHaveBeenCalled();
  });

  it("A memblokir B → keduanya 403 terblokir", async () => {
    const d = siapkan({ blokir: [{ blocker: A.address, blocked: B.address }] });
    expect((await ambilKunciLawan(A.address, B.address, d.deps))).toEqual({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
    expect((await ambilKunciLawan(B.address, A.address, d.deps))).toEqual({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
  });

  it("koneksi tanpa kunci lawan → 409 belum_siap", async () => {
    const d = siapkan();
    d.db.kunci.delete(B.address.toLowerCase());
    expect(await ambilKunciLawan(A.address, B.address, d.deps)).toEqual({ ok: false, failure: { code: "belum_siap", httpStatus: 409 } });
  });

  it("koneksi dengan kunci → kunci lawan", async () => {
    const d = siapkan();
    expect(await ambilKunciLawan(A.address, B.address, d.deps)).toEqual({ ok: true, value: B.terdaftar });
  });
});

describe("kirimPesan", () => {
  const masukan = (n = 1) => ({ id: id(n), penerima: B.address, ciphertext: "QUJD", nonce: NONCE });

  it("sah → baru, tersimpan huruf kecil", async () => {
    const d = siapkan();
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: true, value: { baru: true } });
    expect(d.db.pesan[0]).toMatchObject({ pengirim: A.address.toLowerCase(), penerima: B.address.toLowerCase() });
  });

  it("id yang sama dua kali → satu baris, kedua kalinya baru=false", async () => {
    const d = siapkan();
    await kirimPesan(A.address, masukan(), d.deps);
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: true, value: { baru: false } });
    expect(d.db.pesan).toHaveLength(1);
  });

  it("tiga puluh dalam enam puluh detik diterima, berikutnya 429; lewat jendela diterima lagi", async () => {
    const d = siapkan();
    for (let i = 0; i < 30; i++) {
      expect((await kirimPesan(A.address, masukan(i), d.deps)).ok).toBe(true);
    }
    expect(await kirimPesan(A.address, masukan(30), d.deps)).toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    d.jam.sekarang += 60_001;
    expect((await kirimPesan(A.address, masukan(31), d.deps)).ok).toBe(true);
  });

  it("terblokir → 403 dan tidak tersimpan", async () => {
    const d = siapkan({ blokir: [{ blocker: B.address, blocked: A.address }] });
    expect((await kirimPesan(A.address, masukan(), d.deps)).ok).toBe(false);
    expect(d.db.pesan).toHaveLength(0);
  });

  it("penerima tanpa kunci → 409 dan tidak tersimpan", async () => {
    const d = siapkan();
    d.db.kunci.delete(B.address.toLowerCase());
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: false, failure: { code: "belum_siap", httpStatus: 409 } });
    expect(d.db.pesan).toHaveLength(0);
  });
});

describe("daftarPercakapan dan belum dibaca", () => {
  it("per lawan: pesan terakhir, jumlah belum dibaca, nama tampilan", async () => {
    const d = siapkan({ koneksi: [[A.address, B.address], [A.address, C.address]], nama: { [B.address]: "Budi" } });
    d.db.kunci.set(C.address.toLowerCase(), C.terdaftar);
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1000;
    await kirimPesan(B.address, { id: id(2), penerima: A.address, ciphertext: "Qg==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1000;
    await kirimPesan(A.address, { id: id(3), penerima: C.address, ciphertext: "Qw==", nonce: NONCE }, d.deps);

    const daftar = await daftarPercakapan(A.address, d.deps);
    expect(daftar.map((p) => p.lawan)).toEqual([C.address.toLowerCase(), B.address.toLowerCase()]);
    const budi = daftar.find((p) => p.lawan === B.address.toLowerCase())!;
    expect(budi.terakhir.id).toBe(id(2));
    expect(budi.belumDibaca).toBe(2);
    expect(budi.displayName).toBe("Budi");
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(2);
  });

  it("lawan yang berhubungan blokir ke arah mana pun tidak muncul dan tidak dihitung", async () => {
    const d = siapkan();
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.pasangBlokir(B.address, A.address);
    expect(await daftarPercakapan(A.address, d.deps)).toEqual([]);
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(0);
    expect(await daftarPercakapan(B.address, d.deps)).toEqual([]);
  });
});

describe("riwayat dan tandai dibaca", () => {
  it("bukan koneksi → 403", async () => {
    const d = siapkan();
    expect((await riwayatPercakapan(C.address, A.address, null, 50, d.deps)).ok).toBe(false);
    expect((await tandaiPercakapanDibaca(C.address, A.address, 1, d.deps)).ok).toBe(false);
  });

  it("riwayat dua arah, batas dijepit ke 50", async () => {
    const d = siapkan();
    await kirimPesan(A.address, { id: id(1), penerima: B.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1;
    await kirimPesan(B.address, { id: id(2), penerima: A.address, ciphertext: "Qg==", nonce: NONCE }, d.deps);
    const r = await riwayatPercakapan(A.address, B.address, null, 999, d.deps);
    expect(r.ok && r.value.map((p) => p.id)).toEqual([id(2), id(1)]);
    expect(d.deps.pesan.riwayat).toHaveBeenCalledWith(A.address.toLowerCase(), B.address.toLowerCase(), null, 50);
  });

  it("tandai dibaca menurunkan belum dibaca ke nol", async () => {
    const d = siapkan();
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    expect((await tandaiPercakapanDibaca(A.address, B.address, d.jam.sekarang, d.deps)).ok).toBe(true);
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(0);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan-gate`
Expected: FAIL — `../src/pesan-gate` tidak ada.

- [ ] **Step 4: Buat `apps/api/src/pesan-gate.ts`**

```ts
import type { Address, Hex } from "viem";
import { recoverDaftarKunciPesanSigner } from "@nearly/shared";
import type { BarisPesan, KunciPesanTerdaftar, PesanDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export const BATAS_LAJU = 30;
export const JENDELA_LAJU_MS = 60_000;
/**
 * Daftar percakapan dibangun dari paling banyak sekian pesan terbaru. Lawan
 * bicara yang pesan terakhirnya lebih tua dari jendela ini tidak muncul di
 * daftar sampai ada pesan baru — batas yang diterima untuk 4c, dicatat di
 * rencana, bukan kebetulan.
 */
export const JENDELA_PERCAKAPAN = 500;
export const MAKS_HALAMAN_RIWAYAT = 50;

export type PesanFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "pesan_diri"; httpStatus: 400 }
  | { code: "tidak_terhubung"; httpStatus: 403 }
  | { code: "terblokir"; httpStatus: 403 }
  | { code: "belum_siap"; httpStatus: 409 }
  | { code: "terlalu_cepat"; httpStatus: 429 };

export type PesanResult<T> = { ok: true; value: T } | { ok: false; failure: PesanFailure };

const fail = (failure: PesanFailure): { ok: false; failure: PesanFailure } => ({ ok: false, failure });
const kecil = (a: string) => a.toLowerCase() as Address;
const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type DaftarKunciInput = {
  who: Address; kunciEnkripsi: Hex; kunciTanda: Hex; expiresAt: bigint; sig: Hex;
};

/** Spec 4c §6. Satu-satunya jalur yang mengikat kunci publik pesan ke dompet. */
export async function daftarKunci(input: DaftarKunciInput, deps: PesanDeps): Promise<PesanResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  // recoverDaftarKunciPesanSigner dan TIDAK PERNAH yang lain — kunci yang
  // didaftarkan atas nama orang lain membuat pesan untuk dia terbaca penyerang.
  const signer = await pulihkanTandaTangan(() => recoverDaftarKunciPesanSigner(
    {
      who: input.who, kunciEnkripsi: input.kunciEnkripsi,
      kunciTanda: input.kunciTanda, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.pesan.simpanKunci(kecil(input.who), {
    kunciEnkripsi: kecil(input.kunciEnkripsi) as Hex, kunciTanda: kecil(input.kunciTanda) as Hex,
  });
  return { ok: true, value: undefined };
}

/**
 * Spec 4c §4 butir (1)(2). Urutannya disengaja: koneksi dulu, baru blokir, dan
 * keberadaan kunci SESUDAH keduanya (di pemanggil). Bukan koneksi tidak boleh
 * bisa membedakan "dia belum memakai pesan" dari "kalian tidak terhubung".
 */
export async function gerbangPasangan(a: Address, b: Address, deps: PesanDeps): Promise<PesanFailure | null> {
  if (samaAlamat(a, b)) return { code: "pesan_diri", httpStatus: 400 };
  if (!(await deps.store.areConnected(kecil(a), kecil(b)))) {
    return { code: "tidak_terhubung", httpStatus: 403 };
  }
  // Pemeriksaan pasangan tepat dua arah (4a I1), bukan memuat seluruh himpunan.
  const [ab, ba] = await Promise.all([
    deps.blokir.adaBlokir(kecil(a), kecil(b)),
    deps.blokir.adaBlokir(kecil(b), kecil(a)),
  ]);
  if (ab || ba) return { code: "terblokir", httpStatus: 403 };
  return null;
}

export async function ambilKunciLawan(
  pemanggil: Address, lawan: Address, deps: PesanDeps,
): Promise<PesanResult<KunciPesanTerdaftar>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  const kunci = await deps.pesan.ambilKunci(kecil(lawan));
  if (!kunci) return fail({ code: "belum_siap", httpStatus: 409 });
  return { ok: true, value: kunci };
}

export type KirimInput = { id: string; penerima: Address; ciphertext: string; nonce: Hex };

export async function kirimPesan(
  pemanggil: Address, input: KirimInput, deps: PesanDeps,
): Promise<PesanResult<{ baru: boolean }>> {
  const g = await gerbangPasangan(pemanggil, input.penerima, deps);
  if (g) return fail(g);
  if (!(await deps.pesan.ambilKunci(kecil(input.penerima)))) {
    return fail({ code: "belum_siap", httpStatus: 409 });
  }

  const terkirim = await deps.pesan.hitungTerkirimSejak(kecil(pemanggil), deps.nowMs() - JENDELA_LAJU_MS);
  if (terkirim >= BATAS_LAJU) return fail({ code: "terlalu_cepat", httpStatus: 429 });

  const hasil = await deps.pesan.simpanPesan({
    id: input.id.toLowerCase(),
    pengirim: kecil(pemanggil),
    penerima: kecil(input.penerima),
    ciphertext: input.ciphertext,
    nonce: kecil(input.nonce) as Hex,
  });
  return { ok: true, value: { baru: hasil === "baru" } };
}

/**
 * Murni. `baris` terbaru dulu; pesan pertama yang terlihat per lawan adalah
 * pesan terakhirnya.
 */
export function kelompokkanPercakapan(
  baris: BarisPesan[], pemanggil: Address, terblokir: ReadonlySet<string>,
): { lawan: Address; terakhir: BarisPesan }[] {
  const aku = pemanggil.toLowerCase();
  const terlihat = new Map<string, BarisPesan>();
  for (const b of baris) {
    const lawan = b.pengirim.toLowerCase() === aku ? b.penerima.toLowerCase() : b.pengirim.toLowerCase();
    if (lawan === aku || terblokir.has(lawan) || terlihat.has(lawan)) continue;
    terlihat.set(lawan, b);
  }
  return [...terlihat.entries()]
    .map(([lawan, terakhir]) => ({ lawan: lawan as Address, terakhir }))
    .sort((x, y) => y.terakhir.createdAtMs - x.terakhir.createdAtMs);
}

export type RingkasanPercakapan = {
  lawan: Address; displayName: string; tier: number; belumDibaca: number; terakhir: BarisPesan;
};

/**
 * Koneksi TIDAK diperiksa ulang per lawan: baris `pesan` hanya tercipta lewat
 * gerbang yang memeriksa koneksi, dan koneksi Nearly permanen. Yang disaring
 * ulang hanya blokir — satu `himpunanUntuk`, bukan N kueri.
 */
export async function daftarPercakapan(pemanggil: Address, deps: PesanDeps): Promise<RingkasanPercakapan[]> {
  const aku = kecil(pemanggil);
  const [baris, terblokir, belum] = await Promise.all([
    deps.pesan.pesanTerbaruUntuk(aku, JENDELA_PERCAKAPAN),
    deps.blokir.himpunanUntuk(aku),
    deps.pesan.belumDibacaPerPengirim(aku),
  ]);
  const grup = kelompokkanPercakapan(baris, aku, terblokir);
  if (grup.length === 0) return [];
  const profil = await deps.meet.profilRingkas(grup.map((g) => g.lawan));
  return grup.map((g) => ({
    ...g,
    displayName: profil.get(g.lawan)?.displayName ?? "",
    tier: profil.get(g.lawan)?.tier ?? 0,
    belumDibaca: belum.get(g.lawan) ?? 0,
  }));
}

export async function riwayatPercakapan(
  pemanggil: Address, lawan: Address, sebelumMs: number | null, batas: number, deps: PesanDeps,
): Promise<PesanResult<BarisPesan[]>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  const jepit = Math.max(1, Math.min(MAKS_HALAMAN_RIWAYAT, Math.floor(batas)));
  return { ok: true, value: await deps.pesan.riwayat(kecil(pemanggil), kecil(lawan), sebelumMs, jepit) };
}

export async function tandaiPercakapanDibaca(
  pemanggil: Address, lawan: Address, sampaiMs: number, deps: PesanDeps,
): Promise<PesanResult<void>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  await deps.pesan.tandaiDibaca(kecil(pemanggil), kecil(lawan), sampaiMs);
  return { ok: true, value: undefined };
}

export async function totalBelumDibaca(pemanggil: Address, deps: PesanDeps): Promise<number> {
  const [belum, terblokir] = await Promise.all([
    deps.pesan.belumDibacaPerPengirim(kecil(pemanggil)),
    deps.blokir.himpunanUntuk(kecil(pemanggil)),
  ]);
  let total = 0;
  for (const [pengirim, n] of belum) if (!terblokir.has(pengirim)) total += n;
  return total;
}

export async function simpanTokenPush(pemanggil: Address, token: string, deps: PesanDeps): Promise<void> {
  await deps.pesan.simpanTokenPush(kecil(pemanggil), token);
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test pesan-gate && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 6: Buktikan tiga sifat gerbang menggigit**

**Mutasi A:** di `ambilKunciLawan`, pindahkan `ambilKunci` + penolakan `belum_siap` ke SEBELUM `gerbangPasangan`. Harapkan `"bukan koneksi → 403 tidak_terhubung, sama persis entah lawan punya kunci atau tidak"` MERAH.

**Mutasi B:** di `gerbangPasangan`, hapus `ba` (hanya periksa `adaBlokir(a, b)`). Harapkan `"A memblokir B → keduanya 403 terblokir"` MERAH.

**Mutasi C:** ganti `terkirim >= BATAS_LAJU` jadi `terkirim > BATAS_LAJU`. Harapkan tes rem laju MERAH.

Kembalikan ketiganya.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/pesan-gate.ts apps/api/test/pesan-gate.test.ts apps/api/test/support/dunia-pesan.ts
git commit -m "feat(api): gerbang pesan — kunci, koneksi, blokir, laju, percakapan"
```

---

## Task 9: `pesan-laporan.ts` — lapor dengan bukti terverifikasi

**Files:**
- Create: `apps/api/src/pesan-laporan.ts`
- Test: `apps/api/test/pesan-laporan.test.ts`

**Interfaces:**
- Consumes: `PesanDeps` (Task 5); `duniaPesan`, `buatPengguna`, `VOUCH_PESAN`, `VC_PESAN` (Task 8); `recoverReportSigner`, `reasonHashOf`, `reportTypedData`, `tandaAmplop`, `verifikasiAmplop` dari `@nearly/shared`; `pulihkanTandaTangan`.
- Produces:
  - `type LaporanFailure = { code: "expired"; httpStatus: 410 } | { code: "bad_signature"; httpStatus: 401 } | { code: "lapor_diri"; httpStatus: 400 } | { code: "tidak_terhubung"; httpStatus: 403 } | { code: "bukti_tidak_sah"; httpStatus: 422 }`
  - `type LaporanInput = { laporan: { reporter: Address; subject: Address; reason: string; evidence?: string; expiresAt: bigint; sig: Hex }; bukti: { pesanId: string; isi: string; dikirimMs: number; tanda: Hex }[] }`
  - `laporkanPesan(input: LaporanInput, deps: PesanDeps): Promise<{ ok: true; value: { laporanId: number } } | { ok: false; failure: LaporanFailure }>`

**Tipe `Report` terikat ke `deps.vouchContract` (VouchRegistry), bukan `verifyingContract`** — sama seperti `apps/api/src/routes/report.ts` sejak Fase 2. `routes/report.ts` sendiri TIDAK disentuh.

**Semua verifikasi selesai SEBELUM tulisan pertama.** Satu bukti gagal → tidak ada laporan tercatat sama sekali.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pesan-laporan.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { reasonHashOf, reportTypedData, tandaAmplop } from "@nearly/shared";
import { laporkanPesan } from "../src/pesan-laporan";
import { buatPengguna, duniaPesan, VC_PESAN, VOUCH_PESAN } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>; // pelapor
let B: Awaited<ReturnType<typeof buatPengguna>>; // terlapor
let C: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

const ID1 = "00000000-0000-4000-8000-000000000001";
const ALASAN = "mengirim ancaman berulang kali";

/** Dunia dengan satu pesan SUNGGUHAN dari B ke A, dan bukti bertanda tangan B. */
function siapkan(over: Parameters<typeof duniaPesan>[0] = {}) {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], ...over });
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  d.db.kunci.set(B.address.toLowerCase(), B.terdaftar);
  d.db.pesan.push({
    id: ID1, pengirim: B.address.toLowerCase() as Address, penerima: A.address.toLowerCase() as Address,
    ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: d.jam.sekarang, dibacaAtMs: null,
  });
  const isi = { pengirim: B.address, penerima: A.address, dikirimMs: 1234, isi: "kutunggu di parkiran" };
  const bukti = { pesanId: ID1, isi: isi.isi, dikirimMs: isi.dikirimMs, tanda: tandaAmplop(B.kunci.privTanda, isi) };
  return { d, bukti };
}

async function laporanDari(
  pelapor: typeof A, subject: Address, nowMs: number,
  kontrak: Address = VOUCH_PESAN, expiresAt = BigInt(Math.floor(nowMs / 1000) + 300),
) {
  const msg = { reporter: pelapor.address, subject, reasonHash: reasonHashOf(ALASAN), expiresAt };
  const sig = await pelapor.akun.signTypedData(reportTypedData(msg, kontrak));
  return { reporter: pelapor.address, subject, reason: ALASAN, expiresAt, sig };
}

describe("laporkanPesan", () => {
  it("bukti sah → laporan tercatat dan bukti tersimpan dengan kunci tanda terlapor", async () => {
    const { d, bukti } = siapkan();
    const hasil = await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps);
    expect(hasil).toEqual({ ok: true, value: { laporanId: 1 } });
    expect(d.laporan).toEqual([{ id: 1, reporter: A.address.toLowerCase(), subject: B.address.toLowerCase(), reason: ALASAN }]);
    expect(d.db.bukti.get(1)).toEqual([{ ...bukti, kunciTanda: B.terdaftar.kunciTanda }]);
  });

  // Pelapor tidak bisa mengarang pesan atas nama terlapor.
  it("tanda tangan bukti dari kunci lain → 422, tidak ada yang tercatat", async () => {
    const { d, bukti } = siapkan();
    const palsu = { ...bukti, tanda: tandaAmplop(C.kunci.privTanda, { pengirim: B.address, penerima: A.address, dikirimMs: bukti.dikirimMs, isi: bukti.isi }) };
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [palsu] }, d.deps))
      .toEqual({ ok: false, failure: { code: "bukti_tidak_sah", httpStatus: 422 } });
    expect(d.laporan).toEqual([]);
    expect(d.db.bukti.size).toBe(0);
  });

  it("isi bukti diubah → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [{ ...bukti, isi: "isi lain" }] }, d.deps)).ok).toBe(false);
  });

  it("pesanId fiktif → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [{ ...bukti, pesanId: "00000000-0000-4000-8000-00000000dead" }] }, d.deps)).ok).toBe(false);
  });

  // Pelapor hanya bisa melaporkan pesan yang DITUJUKAN kepadanya.
  it("pesan yang bukan untuk pelapor → 422", async () => {
    const { d, bukti } = siapkan({ koneksi: [[A.address, B.address], [C.address, B.address]] });
    d.db.kunci.set(C.address.toLowerCase(), C.terdaftar);
    expect((await laporkanPesan({ laporan: await laporanDari(C, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps)).ok).toBe(false);
  });

  it("satu bukti sah dan satu palsu → 422, tidak ada yang tercatat", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti, { ...bukti, isi: "x" }] }, d.deps)).ok).toBe(false);
    expect(d.laporan).toEqual([]);
  });

  it("pesanId ganda → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti, bukti] }, d.deps)).ok).toBe(false);
  });

  // Spec 4c §8.2 butir 2: blokir TIDAK menghalangi lapor.
  it("pasangan yang sudah terblokir tetap bisa melapor", async () => {
    const { d, bukti } = siapkan({ blokir: [{ blocker: A.address, blocked: B.address }] });
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps)).ok).toBe(true);
  });

  it("bukan koneksi → 403", async () => {
    const { d, bukti } = siapkan({ koneksi: [] });
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "tidak_terhubung", httpStatus: 403 } });
  });

  it("Report ditandatangani untuk ConnectionRegistry, bukan VouchRegistry → 401", async () => {
    const { d, bukti } = siapkan();
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang, VC_PESAN), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("Report kedaluwarsa → 410", async () => {
    const { d, bukti } = siapkan();
    const lap = await laporanDari(A, B.address, d.jam.sekarang, VOUCH_PESAN, BigInt(Math.floor(d.jam.sekarang / 1000) - 1));
    expect(await laporkanPesan({ laporan: lap, bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("melaporkan diri sendiri → 400", async () => {
    const { d, bukti } = siapkan();
    expect(await laporkanPesan({ laporan: await laporanDari(A, A.address, d.jam.sekarang), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "lapor_diri", httpStatus: 400 } });
  });

  it("tanda tangan Report cacat bentuk → 401, bukan lemparan", async () => {
    const { d, bukti } = siapkan();
    const lap = { ...(await laporanDari(A, B.address, d.jam.sekarang)), sig: `0x${"9".repeat(130)}` as Hex };
    await expect(laporkanPesan({ laporan: lap, bukti: [bukti] }, d.deps))
      .resolves.toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan-laporan`
Expected: FAIL — `../src/pesan-laporan` tidak ada.

- [ ] **Step 3: Buat `apps/api/src/pesan-laporan.ts`**

```ts
import type { Address, Hex } from "viem";
import { reasonHashOf, recoverReportSigner, verifikasiAmplop } from "@nearly/shared";
import type { PesanDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type LaporanFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "lapor_diri"; httpStatus: 400 }
  | { code: "tidak_terhubung"; httpStatus: 403 }
  | { code: "bukti_tidak_sah"; httpStatus: 422 };

export type LaporanInput = {
  laporan: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
    expiresAt: bigint; sig: Hex;
  };
  bukti: { pesanId: string; isi: string; dikirimMs: number; tanda: Hex }[];
};

type Hasil = { ok: true; value: { laporanId: number } } | { ok: false; failure: LaporanFailure };

const fail = (failure: LaporanFailure): Hasil => ({ ok: false, failure });
const kecil = (a: string) => a.toLowerCase();

/**
 * Lapor dari percakapan dengan bukti yang bisa diverifikasi (spec 4c §8.2).
 *
 * Laporannya sendiri persis `POST /report`: tipe `Report`, ditandatangani
 * dompet, domain VouchRegistry. Gerbang anti-brigading spec induk §9.3 berlaku
 * utuh — laporan hanya memicu peninjauan.
 *
 * Buktinya membuktikan terlapor MENULIS teks itu untuk pelapor. Ia tidak
 * membuktikan teks itu sama dengan ciphertext tersimpan (spec 4c §11.8).
 *
 * SELURUH verifikasi selesai sebelum tulisan pertama: satu bukti gagal berarti
 * tidak ada laporan tercatat.
 */
export async function laporkanPesan(input: LaporanInput, deps: PesanDeps): Promise<Hasil> {
  const l = input.laporan;
  if (deps.nowMs() > Number(l.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  const signer = await pulihkanTandaTangan(() => recoverReportSigner(
    { reporter: l.reporter, subject: l.subject, reasonHash: reasonHashOf(l.reason), expiresAt: l.expiresAt },
    l.sig,
    deps.vouchContract,
  ));
  if (signer === null || kecil(signer) !== kecil(l.reporter)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }
  if (kecil(l.reporter) === kecil(l.subject)) return fail({ code: "lapor_diri", httpStatus: 400 });

  const pelapor = kecil(l.reporter) as Address;
  const terlapor = kecil(l.subject) as Address;

  // Koneksi saja — blokir TIDAK menghalangi lapor (spec 4c §8.2 butir 2).
  if (!(await deps.store.areConnected(pelapor, terlapor))) {
    return fail({ code: "tidak_terhubung", httpStatus: 403 });
  }

  const ids = input.bukti.map((b) => kecil(b.pesanId));
  if (new Set(ids).size !== ids.length) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });

  const [baris, kunci] = await Promise.all([
    deps.pesan.pesanBerdasarkanId(ids),
    deps.pesan.ambilKunci(terlapor),
  ]);
  if (!kunci) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });

  const perId = new Map(baris.map((b) => [kecil(b.id), b]));
  for (const b of input.bukti) {
    const row = perId.get(kecil(b.pesanId));
    if (!row || kecil(row.pengirim) !== terlapor || kecil(row.penerima) !== pelapor) {
      return fail({ code: "bukti_tidak_sah", httpStatus: 422 });
    }
    const sah = verifikasiAmplop(
      { pengirim: terlapor, penerima: pelapor, dikirimMs: b.dikirimMs, isi: b.isi, tanda: b.tanda },
      kunci.kunciTanda,
    );
    if (!sah) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });
  }

  const laporanId = await deps.reports.recordReport({
    reporter: pelapor, subject: terlapor, reason: l.reason, evidence: l.evidence,
  });
  await deps.pesan.gantiBuktiLaporan(laporanId, input.bukti.map((b) => ({
    pesanId: kecil(b.pesanId), isi: b.isi, dikirimMs: b.dikirimMs,
    tanda: kecil(b.tanda) as Hex, kunciTanda: kunci.kunciTanda,
  })));
  return { ok: true, value: { laporanId } };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test pesan-laporan && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 5: Buktikan dua sifat menggigit**

**Mutasi A:** hapus pemeriksaan `verifikasiAmplop` (anggap selalu sah). Harapkan `"tanda tangan bukti dari kunci lain → 422"` dan `"isi bukti diubah → 422"` MERAH.

**Mutasi B:** pindahkan `recordReport` ke dalam perulangan, sebelum verifikasi bukti pertama. Harapkan `"satu bukti sah dan satu palsu → 422, tidak ada yang tercatat"` MERAH.

Kembalikan keduanya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pesan-laporan.ts apps/api/test/pesan-laporan.test.ts
git commit -m "feat(api): lapor dari percakapan dengan bukti pesan terverifikasi"
```

---

## Task 10: Push — `push.ts` dan `pesan-push.ts`

**Files:**
- Create: `apps/api/src/push.ts`, `apps/api/src/pesan-push.ts`
- Test: `apps/api/test/push.test.ts`, `apps/api/test/pesan-push.test.ts`

**Interfaces:**
- Consumes: `PushPort`, `PesanDeps` (Task 5); `potongKelompok` dari `feed-store.ts`; `duniaPesan`, `buatPengguna` (Task 8).
- Produces:
  - `URL_PUSH_EXPO = "https://exp.host/--/api/v2/push/send"`, `MAKS_PUSH_PER_PERMINTAAN = 100`
  - `createExpoPush(fetchFn?: typeof fetch): PushPort`
  - `teksPush(displayName: string): string`
  - `kirimPushPesan(deps: Pick<PesanDeps, "pesan" | "push" | "meet">, baris: { id: string; pengirim: Address; penerima: Address }): Promise<void>` — **tidak pernah melempar**

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/push.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createExpoPush, URL_PUSH_EXPO } from "../src/push";

function fetchPalsu(jawab: (badan: unknown[]) => { ok?: boolean; status?: number; data?: unknown[] }) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const badan = JSON.parse(String(init.body)) as unknown[];
    const j = jawab(badan);
    return { ok: j.ok ?? true, status: j.status ?? 200, json: async () => ({ data: j.data }) } as Response;
  });
}

describe("createExpoPush", () => {
  it("satu pesan per token, ke Expo Push API", async () => {
    const f = fetchPalsu((b) => ({ data: b.map(() => ({ status: "ok" })) }));
    await createExpoPush(f as never).kirim({
      tokens: ["ExponentPushToken[a]", "ExponentPushToken[b]"], judul: "Nearly", badan: "Pesan baru dari Ani", data: { jenis: "pesan" },
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe(URL_PUSH_EXPO);
    expect(JSON.parse(String(f.mock.calls[0]![1].body))).toEqual([
      { to: "ExponentPushToken[a]", title: "Nearly", body: "Pesan baru dari Ani", data: { jenis: "pesan" }, sound: "default" },
      { to: "ExponentPushToken[b]", title: "Nearly", body: "Pesan baru dari Ani", data: { jenis: "pesan" }, sound: "default" },
    ]);
  });

  it("lebih dari seratus token dipecah per seratus", async () => {
    const f = fetchPalsu((b) => ({ data: b.map(() => ({ status: "ok" })) }));
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
    await createExpoPush(f as never).kirim({ tokens, judul: "Nearly", badan: "x", data: {} });
    expect(f.mock.calls.map((c) => (JSON.parse(String(c[1].body)) as unknown[]).length)).toEqual([100, 100, 50]);
  });

  it("DeviceNotRegistered dikembalikan sebagai token mati, galat lain tidak", async () => {
    const f = fetchPalsu(() => ({ data: [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "MessageRateExceeded" } },
      { status: "ok" },
    ] }));
    const hasil = await createExpoPush(f as never).kirim({
      tokens: ["ExponentPushToken[mati]", "ExponentPushToken[sibuk]", "ExponentPushToken[hidup]"], judul: "Nearly", badan: "x", data: {},
    });
    expect(hasil).toEqual({ tokenMati: ["ExponentPushToken[mati]"] });
  });

  it("HTTP bukan 2xx melempar", async () => {
    const f = fetchPalsu(() => ({ ok: false, status: 500 }));
    await expect(createExpoPush(f as never).kirim({ tokens: ["ExponentPushToken[a]"], judul: "Nearly", badan: "x", data: {} }))
      .rejects.toThrow(/HTTP 500/);
  });
});
```

`apps/api/test/pesan-push.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import { kirimPushPesan, teksPush } from "../src/pesan-push";
import { buatPengguna, duniaPesan } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>;
let B: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B] = await Promise.all([buatPengguna("a1"), buatPengguna("b2")]);
});

const baris = (id: string) => ({ id, pengirim: A.address.toLowerCase() as Address, penerima: B.address.toLowerCase() as Address });

function dengPesanBelumDibaca(d: ReturnType<typeof duniaPesan>, id: string) {
  d.db.pesan.push({
    id, pengirim: A.address.toLowerCase() as Address, penerima: B.address.toLowerCase() as Address,
    ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: d.jam.sekarang, dibacaAtMs: null,
  });
}

describe("teksPush", () => {
  it("nama tampilan, atau fallback bila kosong", () => {
    expect(teksPush("Ani")).toBe("Pesan baru dari Ani");
    expect(teksPush("  ")).toBe("Pesan baru dari koneksimu");
    expect(teksPush("")).toBe("Pesan baru dari koneksimu");
  });
});

describe("kirimPushPesan", () => {
  it("mengirim nama pengirim ke token penerima", async () => {
    const d = duniaPesan({ nama: { [A.address]: "Ani" } });
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.push.kirim).toHaveBeenCalledWith({
      tokens: ["ExponentPushToken[b]"], judul: "Nearly", badan: "Pesan baru dari Ani", data: { jenis: "pesan" },
    });
  });

  // Spec 4c §7.2 — tidak pernah alamat pengirim, alamat penerima, atau isi.
  it("muatan push tidak memuat alamat mana pun", async () => {
    const d = duniaPesan({ nama: { [A.address]: "Ani" } });
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    const muatan = JSON.stringify(d.push.kirim.mock.calls[0]![0]).toLowerCase();
    expect(muatan).not.toContain(A.address.toLowerCase().slice(2));
    expect(muatan).not.toContain(B.address.toLowerCase().slice(2));
  });

  it("digabung per pengirim: pesan belum dibaca lain dari pengirim yang sama → tidak dikirim", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    dengPesanBelumDibaca(d, "id-2");
    await kirimPushPesan(d.deps, baris("id-2"));
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("penerima tanpa token → tidak mengirim dan tidak membaca nama", async () => {
    const d = duniaPesan();
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.push.kirim).not.toHaveBeenCalled();
    expect(d.deps.meet.profilRingkas).not.toHaveBeenCalled();
  });

  it("token mati dihapus", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[mati]" });
    dengPesanBelumDibaca(d, "id-1");
    d.push.kirim.mockResolvedValueOnce({ tokenMati: ["ExponentPushToken[mati]"] });
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.db.token).toEqual([]);
  });

  it("push yang gagal tidak pernah melempar", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    d.push.kirim.mockRejectedValueOnce(new Error("Expo mati"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(kirimPushPesan(d.deps, baris("id-1"))).resolves.toBeUndefined();
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });

  it("push null → tidak melakukan apa pun", async () => {
    const d = duniaPesan();
    await expect(kirimPushPesan({ ...d.deps, push: null }, baris("id-1"))).resolves.toBeUndefined();
    expect(d.deps.pesan.tokenPush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test push pesan-push`
Expected: FAIL — modul tidak ada.

- [ ] **Step 3: Buat `apps/api/src/push.ts`**

```ts
import type { PushPort } from "./ports";
import { potongKelompok } from "./feed-store";

export const URL_PUSH_EXPO = "https://exp.host/--/api/v2/push/send";
/** Expo Push API menerima paling banyak 100 pesan per permintaan. */
export const MAKS_PUSH_PER_PERMINTAAN = 100;

type Tiket = { status?: string; details?: { error?: string } };

/**
 * Implementasi PushPort lewat layanan push Expo. Expo dan Apple melihat isi
 * notifikasi — itulah sebabnya isinya diputuskan di pesan-push.ts dan tidak
 * pernah memuat isi pesan atau alamat (spec 4c §7.2, §11.5).
 */
export function createExpoPush(fetchFn: typeof fetch = fetch): PushPort {
  return {
    async kirim({ tokens, judul, badan, data }) {
      const tokenMati: string[] = [];
      for (const bagian of potongKelompok(tokens, MAKS_PUSH_PER_PERMINTAAN)) {
        const res = await fetchFn(URL_PUSH_EXPO, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(bagian.map((to) => ({ to, title: judul, body: badan, data, sound: "default" }))),
        });
        if (!res.ok) throw new Error(`push Expo gagal: HTTP ${res.status}`);
        const tiket = ((await res.json()) as { data?: Tiket[] }).data ?? [];
        bagian.forEach((token, i) => {
          if (tiket[i]?.status === "error" && tiket[i]?.details?.error === "DeviceNotRegistered") {
            tokenMati.push(token);
          }
        });
      }
      return { tokenMati };
    },
  };
}
```

- [ ] **Step 4: Buat `apps/api/src/pesan-push.ts`**

```ts
import type { Address } from "viem";
import type { PesanDeps } from "./ports";

/** Spec 4c §7.2. Tidak pernah alamat, tidak pernah isi pesan. */
export function teksPush(displayName: string): string {
  const nama = displayName.trim();
  return nama ? `Pesan baru dari ${nama}` : "Pesan baru dari koneksimu";
}

/**
 * Dipanggil TANPA await setelah pesan tersimpan (pola prosesUnggahGambar).
 * Dijamin tidak pernah melempar: push yang gagal dicatat, dan pengiriman pesan
 * tetap berhasil (spec 4c §7.1) — polling adalah fondasinya, push tambahan.
 */
export async function kirimPushPesan(
  deps: Pick<PesanDeps, "pesan" | "push" | "meet">,
  baris: { id: string; pengirim: Address; penerima: Address },
): Promise<void> {
  if (!deps.push) return;
  try {
    // Satu notifikasi per rentetan: kalau penerima masih punya pesan belum
    // dibaca lain dari pengirim ini, ia sudah pernah diberi tahu.
    if (await deps.pesan.adaBelumDibacaLainDari(baris.penerima, baris.pengirim, baris.id)) return;

    const tokens = await deps.pesan.tokenPush(baris.penerima);
    if (tokens.length === 0) return;

    const profil = await deps.meet.profilRingkas([baris.pengirim]);
    const nama = profil.get(baris.pengirim.toLowerCase())?.displayName ?? "";

    const { tokenMati } = await deps.push.kirim({
      tokens, judul: "Nearly", badan: teksPush(nama), data: { jenis: "pesan" },
    });
    if (tokenMati.length > 0) await deps.pesan.hapusTokenPush(tokenMati);
  } catch (e) {
    console.error("push pesan gagal:", e instanceof Error ? e.message : e);
  }
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test push pesan-push && pnpm --filter @nearly/api typecheck`
Expected: PASS. Keluaran `stderr` dari tes "push yang gagal tidak pernah melempar" disenyapkan oleh `vi.spyOn`, jadi keluaran tetap bersih.

- [ ] **Step 6: Buktikan penggabungan menggigit**

**Mutasi:** hapus baris `if (await deps.pesan.adaBelumDibacaLainDari(...)) return;`. Harapkan `"digabung per pengirim..."` MERAH. Kembalikan.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/push.ts apps/api/src/pesan-push.ts apps/api/test/push.test.ts apps/api/test/pesan-push.test.ts
git commit -m "feat(api): push pesan lewat Expo, digabung per pengirim, tanpa alamat"
```

---

## Task 11: Rute pesan dan perakitan

**Files:**
- Create: `apps/api/src/routes/pesan.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/deps.ts`, `apps/api/test/sig-rusak.test.ts`
- Test: `apps/api/test/pesan.route.test.ts`

**Interfaces:**
- Consumes: semua dari Task 5–10; skema dari Task 3; `enkripsiPesan`, `bukaPesan`, `tandaRequest`, `tandaAmplop`, `daftarKunciPesanTypedData`, `reportTypedData`, `reasonHashOf` dari `@nearly/shared`.
- Produces: `pesanRoutes(deps: PesanDeps)` dengan endpoint:

| Endpoint | Badan / query | Respons sukses |
|---|---|---|
| `POST /pesan/kunci` | `DaftarKunciPesanRequestSchema` | `{ ok: true }` |
| `GET /pesan/kunci/:alamat` | — | `{ kunciEnkripsi, kunciTanda }` |
| `POST /pesan` | `KirimPesanRequestSchema` | `{ ok: true }` |
| `GET /pesan/percakapan` | — | `{ percakapan: RingkasanPercakapan[] }` |
| `GET /pesan/dengan/:alamat` | `?sebelum=<ms>&limit=<n>` | `{ pesan: BarisPesan[] }` |
| `POST /pesan/dengan/:alamat/dibaca` | `TandaiDibacaRequestSchema` | `{ ok: true }` |
| `GET /pesan/belum-dibaca` | — | `{ total: number }` |
| `POST /pesan/token-push` | `TokenPushRequestSchema` | `{ ok: true }` |
| `POST /pesan/laporan` | `LaporanPesanRequestSchema` | `{ ok: true, status: "diterima" }` |

Kegagalan autentikasi: `401 { code: "butuh_autentikasi" }`. Badan tak sah: `400 { code: "invalid_body" }`. Alamat tak sah: `400 { code: "invalid_address" }`. Terlalu besar: `413 { code: "terlalu_besar" }`.

**Autentikasi SELALU lebih dulu, lalu validasi badan.** Badan dibaca sebagai teks satu kali — hash-nya masuk tanda tangan — lalu diurai dari teks yang sama.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pesan.route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import {
  bukaPesan, daftarKunciPesanTypedData, enkripsiPesan, reasonHashOf, reportTypedData, tandaRequest,
} from "@nearly/shared";
import { pesanRoutes } from "../src/routes/pesan";
import { buatPengguna, duniaPesan, VC_PESAN, VOUCH_PESAN } from "./support/dunia-pesan";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;
let B: Pengguna;
let C: Pengguna;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

function dunia() {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], nama: { [A.address]: "Ani" } });
  const app = new Hono().route("/", pesanRoutes(d.deps));

  async function panggil(p: Pengguna, method: string, path: string, body?: unknown, over: { badan?: string; tanda?: string } = {}) {
    const badan = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = over.tanda ?? tandaRequest(p.kunci.privTanda, { method, pathDenganQuery: path, badan, ts, who: p.address });
    return app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-nearly-who": p.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda },
      body: method === "GET" ? undefined : (over.badan ?? badan),
    });
  }

  async function daftar(p: Pengguna) {
    const msg = { who: p.address, kunciEnkripsi: p.terdaftar.kunciEnkripsi, kunciTanda: p.terdaftar.kunciTanda, expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) + 300) };
    const sig = await p.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    return app.request("/pesan/kunci", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: msg.expiresAt.toString(), sig }),
    });
  }

  function amplopDari(pengirim: Pengguna, penerima: Pengguna, isi: string) {
    return enkripsiPesan({
      kunci: pengirim.kunci, pubEnkripsiLawan: penerima.terdaftar.kunciEnkripsi,
      pengirim: pengirim.address, penerima: penerima.address, isi, dikirimMs: d.jam.sekarang,
    });
  }

  return { d, app, panggil, daftar, amplopDari };
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tunggu = () => new Promise((r) => setTimeout(r, 0));

describe("alur pesan ujung-ke-ujung", () => {
  it("daftar kunci, kirim terenkripsi, lawan melihat percakapan, membuka, menandai dibaca", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    expect((await daftar(A)).status).toBe(200);
    expect((await daftar(B)).status).toBe(200);

    const kunciB = await panggil(A, "GET", `/pesan/kunci/${B.address}`);
    expect(kunciB.status).toBe(200);
    expect(await kunciB.json()).toEqual(B.terdaftar);

    const amplop = amplopDari(A, B, "sampai jumpa di acara besok");
    expect((await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplop })).status).toBe(200);

    const daftarB = await (await panggil(B, "GET", "/pesan/percakapan")).json() as { percakapan: { lawan: string; belumDibaca: number; displayName: string }[] };
    expect(daftarB.percakapan).toEqual([expect.objectContaining({ lawan: A.address.toLowerCase(), belumDibaca: 1, displayName: "Ani" })]);

    const riwayat = await (await panggil(B, "GET", `/pesan/dengan/${A.address}?limit=50`)).json() as { pesan: { ciphertext: string; nonce: Hex; pengirim: string; penerima: string }[] };
    const terbuka = bukaPesan({
      kunci: B.kunci, pubEnkripsiLawan: A.terdaftar.kunciEnkripsi, pubTandaPengirim: A.terdaftar.kunciTanda,
      pengirim: riwayat.pesan[0]!.pengirim, penerima: riwayat.pesan[0]!.penerima,
      ciphertext: riwayat.pesan[0]!.ciphertext, nonce: riwayat.pesan[0]!.nonce,
    });
    expect(terbuka.ok && terbuka.amplop.isi).toBe("sampai jumpa di acara besok");

    expect((await panggil(B, "POST", `/pesan/dengan/${A.address}/dibaca`, { sampaiMs: d.jam.sekarang })).status).toBe(200);
    expect(await (await panggil(B, "GET", "/pesan/belum-dibaca")).json()).toEqual({ total: 0 });
  });
});

describe("autentikasi", () => {
  it("tanpa header → 401", async () => {
    const { app, daftar } = dunia();
    await daftar(A);
    expect((await app.request("/pesan/percakapan")).status).toBe(401);
  });

  it("badan diubah setelah ditandatangani → 401", async () => {
    const { panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    const asli = { id: ID(1), penerima: B.address, ...amplopDari(A, B, "halo") };
    const diubah = JSON.stringify({ ...asli, id: ID(2) });
    expect((await panggil(A, "POST", "/pesan", asli, { badan: diubah })).status).toBe(401);
  });

  it("tanda tangan cacat bentuk → 401, bukan 500", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A);
    expect((await panggil(A, "GET", "/pesan/percakapan", undefined, { tanda: `0x${"9".repeat(130)}` })).status).toBe(401);
  });
});

describe("gerbang lewat HTTP", () => {
  it("bukan koneksi → 403 tidak_terhubung walau lawan punya kunci", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A); await daftar(C);
    const r = await panggil(C, "GET", `/pesan/kunci/${A.address}`);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ code: "tidak_terhubung", httpStatus: 403 });
  });

  it("badan lebih dari 32 KB → 413", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A);
    const r = await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ciphertext: "A".repeat(40_000), nonce: `0x${"cd".repeat(24)}` });
    expect(r.status).toBe(413);
  });
});

describe("push dari rute", () => {
  it("pesan baru memicu push bernama; pesan kedua yang belum dibaca tidak", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    expect((await panggil(B, "POST", "/pesan/token-push", { token: "ExponentPushToken[b]" })).status).toBe(200);

    await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplopDari(A, B, "satu") });
    await tunggu();
    await panggil(A, "POST", "/pesan", { id: ID(2), penerima: B.address, ...amplopDari(A, B, "dua") });
    await tunggu();

    expect(d.push.kirim).toHaveBeenCalledTimes(1);
    expect(d.push.kirim.mock.calls[0]![0].badan).toBe("Pesan baru dari Ani");
  });

  it("push yang gagal tidak menggagalkan pengiriman", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    await panggil(B, "POST", "/pesan/token-push", { token: "ExponentPushToken[b]" });
    d.push.kirim.mockRejectedValueOnce(new Error("Expo mati"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplopDari(A, B, "halo") })).status).toBe(200);
    await tunggu();
    galat.mockRestore();
  });
});

describe("lapor lewat HTTP", () => {
  it("bukti dari pesan yang dibuka pelapor diterima", async () => {
    const { d, app, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    const amplop = amplopDari(B, A, "ancaman");
    await panggil(B, "POST", "/pesan", { id: ID(1), penerima: A.address, ...amplop });

    const terbuka = bukaPesan({
      kunci: A.kunci, pubEnkripsiLawan: B.terdaftar.kunciEnkripsi, pubTandaPengirim: B.terdaftar.kunciTanda,
      pengirim: B.address, penerima: A.address, ...amplop,
    });
    if (!terbuka.ok) throw new Error("amplop uji harus terbuka");

    const reason = "mengirim ancaman berulang kali";
    const expiresAt = BigInt(Math.floor(d.jam.sekarang / 1000) + 300);
    const sig = await A.akun.signTypedData(reportTypedData({ reporter: A.address, subject: B.address, reasonHash: reasonHashOf(reason), expiresAt }, VOUCH_PESAN));
    const r = await app.request("/pesan/laporan", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        laporan: { reporter: A.address, subject: B.address, reason, expiresAt: expiresAt.toString(), sig },
        bukti: [{ pesanId: ID(1), isi: terbuka.amplop.isi, dikirimMs: terbuka.amplop.dikirimMs, tanda: terbuka.amplop.tanda }],
      }),
    });
    expect(r.status).toBe(200);
    expect(d.db.bukti.get(1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test pesan.route`
Expected: FAIL — `../src/routes/pesan` tidak ada.

- [ ] **Step 3: Buat `apps/api/src/routes/pesan.ts`**

```ts
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isAddress, type Address, type Hex } from "viem";
import {
  DaftarKunciPesanRequestSchema, KirimPesanRequestSchema, LaporanPesanRequestSchema,
  TandaiDibacaRequestSchema, TokenPushRequestSchema,
} from "@nearly/shared";
import type { PesanDeps } from "../ports";
import { pemanggilPesan, type RequestPesan } from "../pesan-auth";
import {
  ambilKunciLawan, daftarKunci, daftarPercakapan, kirimPesan, MAKS_HALAMAN_RIWAYAT,
  riwayatPercakapan, simpanTokenPush, tandaiPercakapanDibaca, totalBelumDibaca,
} from "../pesan-gate";
import { laporkanPesan } from "../pesan-laporan";
import { kirimPushPesan } from "../pesan-push";

const BUTUH_AUTENTIKASI = { code: "butuh_autentikasi" } as const;

/**
 * Badan dibaca sebagai TEKS satu kali — hash-nya masuk tanda tangan request —
 * lalu diurai dari teks yang sama. Mengurai lewat `c.req.json()` terpisah akan
 * membuka celah badan yang diverifikasi berbeda dari badan yang dipakai.
 */
async function bacaRequest(c: Context): Promise<RequestPesan> {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    pathDenganQuery: url.pathname + url.search,
    badan: await c.req.text(),
    header: (nama) => c.req.header(nama),
  };
}

function uraiJson(teks: string): unknown {
  try { return JSON.parse(teks); } catch { return null; }
}

const terlaluBesar = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.json({ code: "terlalu_besar" }, 413) });

export function pesanRoutes(deps: PesanDeps) {
  const r = new Hono();

  // Satu-satunya endpoint pesan yang tidak memakai header Ed25519: di sini
  // kunci Ed25519-nya justru sedang didaftarkan, jadi yang membuktikan identitas
  // adalah tanda tangan EIP-712 dompet.
  r.post("/pesan/kunci", async (c) => {
    const parsed = DaftarKunciPesanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;
    const hasil = await daftarKunci({
      who: b.who as Address, kunciEnkripsi: b.kunciEnkripsi as Hex, kunciTanda: b.kunciTanda as Hex,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/pesan/kunci/:alamat", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const hasil = await ambilKunciLawan(pemanggil, lawan as Address, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json(hasil.value);
  });

  r.post("/pesan", terlaluBesar(32 * 1024), async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const parsed = KirimPesanRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const hasil = await kirimPesan(pemanggil, {
      id: b.id, penerima: b.penerima as Address, ciphertext: b.ciphertext, nonce: b.nonce as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

    if (hasil.value.baru) {
      // TANPA await, dengan sengaja (spec 4c §7.1). kirimPushPesan dijamin
      // tidak pernah melempar; kirim ulang dengan id yang sama tidak memicu
      // push kedua.
      void kirimPushPesan(deps, {
        id: b.id.toLowerCase(), pengirim: pemanggil, penerima: b.penerima.toLowerCase() as Address,
      });
    }
    return c.json({ ok: true });
  });

  r.get("/pesan/percakapan", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    return c.json({ percakapan: await daftarPercakapan(pemanggil, deps) });
  });

  r.get("/pesan/dengan/:alamat", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const q = c.req.query();
    const sebelumMs = q.sebelum && /^\d{1,15}$/.test(q.sebelum) ? Number(q.sebelum) : null;
    const batas = q.limit && /^\d{1,4}$/.test(q.limit) ? Number(q.limit) : MAKS_HALAMAN_RIWAYAT;
    const hasil = await riwayatPercakapan(pemanggil, lawan as Address, sebelumMs, batas, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ pesan: hasil.value });
  });

  r.post("/pesan/dengan/:alamat/dibaca", async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const parsed = TandaiDibacaRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const hasil = await tandaiPercakapanDibaca(pemanggil, lawan as Address, parsed.data.sampaiMs, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/pesan/belum-dibaca", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    return c.json({ total: await totalBelumDibaca(pemanggil, deps) });
  });

  r.post("/pesan/token-push", async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const parsed = TokenPushRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    await simpanTokenPush(pemanggil, parsed.data.token, deps);
    return c.json({ ok: true });
  });

  // Tanpa header Ed25519: identitas pelapor dibuktikan tanda tangan `Report`
  // dompet, persis POST /report — gerbang anti-brigading bergantung padanya.
  r.post("/pesan/laporan", terlaluBesar(64 * 1024), async (c) => {
    const parsed = LaporanPesanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const { laporan: l, bukti } = parsed.data;
    const hasil = await laporkanPesan({
      laporan: {
        reporter: l.reporter as Address, subject: l.subject as Address, reason: l.reason,
        evidence: l.evidence, expiresAt: BigInt(l.expiresAt), sig: l.sig as Hex,
      },
      bukti: bukti.map((b) => ({ pesanId: b.pesanId, isi: b.isi, dikirimMs: b.dikirimMs, tanda: b.tanda as Hex })),
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true, status: "diterima" });
  });

  return r;
}
```

- [ ] **Step 4: Rakit di `apps/api/src/app.ts`**

1. Tambahkan `PesanStore, PushPort` ke impor tipe dari `./ports`, dan `import { pesanRoutes } from "./routes/pesan";`.
2. Tambahkan ke `TrustDeps`:

```ts
  pesan: PesanStore;
  push: PushPort | null;
```

3. Setelah `app.route("/", blokirRoutes(deps));`:

```ts
  // `onChanged` TIDAK dipanggil dari rute pesan — berkirim pesan bukan bertemu,
  // jadi graf pertemuan tidak berubah dan tidak ada skor trust yang perlu
  // dihitung ulang. Blokir dari percakapan memakai POST /blokir yang sudah ada,
  // yang juga sengaja tanpa recompute (Ruling R10 Fase 4a).
  app.route("/", pesanRoutes(deps));
```

`TrustDeps` sudah memuat `store`, `blokir`, `meet`, `reports`, `verifyingContract`, `vouchContract`, dan `nowMs`, jadi ia memenuhi `PesanDeps` tanpa pemetaan.

- [ ] **Step 5: Rakit di `apps/api/src/index.ts`**

Impor `createPesanStore` dari `./pesan-store` dan `createExpoPush` dari `./push`, lalu tambahkan ke objek deps:

```ts
  pesan: createPesanStore(supabase),
  push: createExpoPush(),
```

- [ ] **Step 6: Perbarui `apps/api/test/support/deps.ts`**

`TrustDeps` kini menuntut `pesan` dan `push`. Tambahkan ke objek yang dikembalikan `depsFor`, di samping stub port lain:

```ts
    pesan: {
      simpanKunci: vi.fn(async () => {}),
      ambilKunci: vi.fn(async () => null),
      simpanPesan: vi.fn(async () => "baru" as const),
      hitungTerkirimSejak: vi.fn(async () => 0),
      pesanTerbaruUntuk: vi.fn(async () => []),
      belumDibacaPerPengirim: vi.fn(async () => new Map<string, number>()),
      riwayat: vi.fn(async () => []),
      tandaiDibaca: vi.fn(async () => {}),
      adaBelumDibacaLainDari: vi.fn(async () => false),
      simpanTokenPush: vi.fn(async () => {}),
      tokenPush: vi.fn(async () => []),
      hapusTokenPush: vi.fn(async () => {}),
      pesanBerdasarkanId: vi.fn(async () => []),
      gantiBuktiLaporan: vi.fn(async () => {}),
    },
    push: null,
```

Nama metodenya persis `METODE_PESAN_STORE` (Task 5). Kalau `reports.recordReport` di berkas ini masih mengembalikan `undefined`, ubah jadi `vi.fn(async () => 1)`.

- [ ] **Step 7: Tambahkan kasus rute pesan ke `apps/api/test/sig-rusak.test.ts`**

Tambahkan `describe` ini, supaya tabel "tanda tangan cacat bentuk tidak boleh jadi 500" mencakup rute pesan:

```ts
describe("rute pesan dengan tanda tangan cacat bentuk", () => {
  const RUSAK = `0x${"9".repeat(130)}`;

  it("POST /pesan/kunci dengan sig rusak → 401, bukan 500", async () => {
    const { duniaPesan } = await import("./support/dunia-pesan");
    const { pesanRoutes } = await import("../src/routes/pesan");
    const d = duniaPesan();
    const app = new Hono().route("/", pesanRoutes(d.deps));
    const r = await app.request("/pesan/kunci", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        who: "0x00000000000000000000000000000000000000aa", kunciEnkripsi: `0x${"ab".repeat(32)}`,
        kunciTanda: `0x${"ab".repeat(32)}`, expiresAt: String(Math.floor(d.jam.sekarang / 1000) + 300), sig: RUSAK,
      }),
    });
    expect(r.status).toBe(401);
  });

  it("POST /pesan/laporan dengan sig Report rusak → 401, bukan 500", async () => {
    const { duniaPesan } = await import("./support/dunia-pesan");
    const { pesanRoutes } = await import("../src/routes/pesan");
    const d = duniaPesan();
    const app = new Hono().route("/", pesanRoutes(d.deps));
    const r = await app.request("/pesan/laporan", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        laporan: {
          reporter: "0x00000000000000000000000000000000000000aa", subject: "0x00000000000000000000000000000000000000bb",
          reason: "alasan yang cukup panjang", expiresAt: String(Math.floor(d.jam.sekarang / 1000) + 300), sig: RUSAK,
        },
        bukti: [{ pesanId: "00000000-0000-4000-8000-000000000001", isi: "x", dikirimMs: 1, tanda: `0x${"99".repeat(64)}` }],
      }),
    });
    expect(r.status).toBe(401);
  });
});
```

Kalau `Hono` belum diimpor di berkas itu, tambahkan `import { Hono } from "hono";` di deretan impor atasnya.

- [ ] **Step 8: Jalankan seluruh suite**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS. Penjaga struktural "tidak ada panggilan recover telanjang" ikut memindai `routes/pesan.ts` — ia harus tetap hijau karena rute ini tidak memanggil `recover*Signer` sama sekali.

- [ ] **Step 9: Buktikan urutan autentikasi-dulu menggigit**

**Mutasi:** di `POST /pesan`, pindahkan `KirimPesanRequestSchema.safeParse(...)` beserta penolakan 400-nya ke SEBELUM `pemanggilPesan`, dan ubah tes `"tanpa header → 401"` sementara untuk memanggil `POST /pesan` dengan badan sampah tanpa header. Harapkan 400 alih-alih 401 — itu membuktikan urutan penting. Kembalikan mutasi dan perubahan tesnya; lalu tambahkan tes permanen `"POST /pesan tanpa header dengan badan sampah → 401"` supaya urutannya terkunci.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/routes/pesan.ts apps/api/src/app.ts apps/api/src/index.ts \
  apps/api/test/pesan.route.test.ts apps/api/test/support/deps.ts apps/api/test/sig-rusak.test.ts
git commit -m "feat(api): sembilan endpoint pesan dan perakitannya"
```

---

## Task 12: Mobile — sesi kunci dan klien terautentikasi

**Files:**
- Create: `apps/mobile/src/pesan/sesi.ts`, `apps/mobile/src/pesan/pesan-api.ts`
- Test: `apps/mobile/test/pesan-sesi.test.ts`

**Interfaces:**
- Consumes: `kunciPesanTypedData`, `daftarKunciPesanTypedData`, `turunkanKunciPesan`, `tandaRequest`, `VERSI_KUNCI_PESAN`, `type KunciPesanTurunan` dari `@nearly/shared`; `req`, `postJson` dari `apps/mobile/src/http.ts`; `CONFIG`; `PenandaSigner` dari `apps/mobile/src/meet-api.ts`.
- Produces:
  - `type SesiPesan = { address: Address; kunci: KunciPesanTurunan }`
  - `sesiPesan(signer: PenandaSigner): Promise<SesiPesan>`, `_resetSesiPesanUntukTes(): void`
  - `type BarisPesanApi`, `type RingkasanPercakapanApi`, `type KunciLawan = { kunciEnkripsi: Hex; kunciTanda: Hex }`
  - `reqPesan<T>(sesi, method: "GET" | "POST", path: string, body?: unknown): Promise<T>`
  - `getKunciLawan(sesi, lawan)`, `postPesan(sesi, b)`, `getPercakapan(sesi)`, `getRiwayat(sesi, lawan, sebelumMs?)`, `postDibaca(sesi, lawan, sampaiMs)`, `getBelumDibaca(sesi)`, `postTokenPush(sesi, token)`

**Tanda tangan `KunciPesan` hanya hidup di dalam `bukaSesi` dan tidak pernah disimpan maupun dikirim.** Satu tes membuktikannya dengan memeriksa setiap URL, badan, dan header yang meninggalkan HP.

**Path yang ditandatangani relatif terhadap asal API.** `CONFIG.apiUrl` saat ini tanpa prefiks path (mis. `http://192.168.0.102:8787`). Kalau kelak API dipasang di bawah prefiks (`/api`), server akan menandatangani path yang berbeda dari yang ditandatangani HP dan setiap request pesan menjadi 401 — `reqPesan` harus ikut menyertakan prefiks itu.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/pesan-sesi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  kunciPesanTypedData, recoverDaftarKunciPesanSigner, turunkanKunciPesan, verifikasiRequest, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { CONFIG } from "../src/config";
import { _resetSesiPesanUntukTes, sesiPesan } from "../src/pesan/sesi";
import { getRiwayat, postPesan, reqPesan } from "../src/pesan/pesan-api";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);

function signerBerhitung() {
  const tanda = vi.fn((td: never) => A.signTypedData(td as Parameters<typeof A.signTypedData>[0]));
  return { signer: { address: A.address as Address, signTypedData: tanda }, tanda };
}

type Rekaman = { url: string; init: RequestInit };

function pasangFetch(jawab: (url: string) => { status?: number; body?: unknown } = () => ({ body: { ok: true } })) {
  const rekaman: Rekaman[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    const j = jawab(url);
    return new Response(JSON.stringify(j.body ?? {}), { status: j.status ?? 200 });
  }) as never;
  return rekaman;
}

const aslinya = globalThis.fetch;
beforeEach(() => _resetSesiPesanUntukTes());
afterEach(() => { globalThis.fetch = aslinya; });

describe("sesiPesan", () => {
  it("menandatangani tepat dua kali per kali buka aplikasi, walau dipanggil bersamaan", async () => {
    const rek = pasangFetch();
    const { signer, tanda } = signerBerhitung();
    const [s1, s2] = await Promise.all([sesiPesan(signer), sesiPesan(signer)]);
    expect(s1).toBe(s2);
    expect(tanda).toHaveBeenCalledTimes(2);
    expect(rek.filter((r) => r.url.endsWith("/pesan/kunci"))).toHaveLength(1);
  });

  it("mendaftarkan kunci publik hasil penurunan, ditandatangani dompet", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    const badan = JSON.parse(String(rek[0]!.init.body)) as {
      who: Address; kunciEnkripsi: Hex; kunciTanda: Hex; expiresAt: string; sig: Hex;
    };
    const harapan = turunkanKunciPesan(await A.signTypedData(
      kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract)));
    expect(badan.kunciTanda).toBe(harapan.pubTanda);
    expect(badan.kunciEnkripsi).toBe(harapan.pubEnkripsi);
    expect(sesi.kunci.pubTanda).toBe(harapan.pubTanda);
    const pulih = await recoverDaftarKunciPesanSigner(
      { who: badan.who, kunciEnkripsi: badan.kunciEnkripsi, kunciTanda: badan.kunciTanda, expiresAt: BigInt(badan.expiresAt) },
      badan.sig, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  // Spec 4c §6: tanda tangan KunciPesan membuka seluruh riwayat pesan.
  it("tanda tangan KunciPesan TIDAK PERNAH meninggalkan HP", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    await postPesan(sesi, {
      id: "00000000-0000-4000-8000-000000000001", penerima: A.address,
      ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex,
    });
    await getRiwayat(sesi, A.address);
    const rahasia = (await A.signTypedData(
      kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract))).slice(2).toLowerCase();
    expect(rek.length).toBeGreaterThanOrEqual(3);
    for (const r of rek) {
      const semua = `${r.url} ${String(r.init.body ?? "")} ${JSON.stringify(r.init.headers ?? {})}`.toLowerCase();
      expect(semua).not.toContain(rahasia);
    }
  });

  it("pendaftaran yang gagal tidak disimpan: panggilan berikutnya mencoba lagi", async () => {
    pasangFetch(() => ({ status: 500, body: { code: "x" } }));
    const { signer, tanda } = signerBerhitung();
    await expect(sesiPesan(signer)).rejects.toThrow();
    pasangFetch();
    await sesiPesan(signer);
    expect(tanda).toHaveBeenCalledTimes(4);
  });
});

describe("reqPesan", () => {
  it("tanda request di header terverifikasi dengan kunci tanda sesi, untuk GET dan POST", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    await reqPesan(sesi, "GET", "/pesan/percakapan");
    await reqPesan(sesi, "POST", "/pesan/token-push", { token: "ExponentPushToken[x]" });
    await getRiwayat(sesi, A.address, 1_700_000_000_000);
    for (const r of rek.slice(1)) {
      const h = r.init.headers as Record<string, string>;
      const u = new URL(r.url);
      expect(verifikasiRequest({
        method: r.init.method!, pathDenganQuery: u.pathname + u.search, badan: String(r.init.body ?? ""),
        ts: Number(h["x-nearly-ts"]), who: h["x-nearly-who"]!, tanda: h["x-nearly-tanda"]!,
      }, sesi.kunci.pubTanda)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test pesan-sesi`
Expected: FAIL — modul `../src/pesan/sesi` tidak ada.

- [ ] **Step 3: Buat `apps/mobile/src/pesan/sesi.ts`**

```ts
import type { Address } from "viem";
import {
  daftarKunciPesanTypedData, kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN,
  type KunciPesanTurunan,
} from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";

export type SesiPesan = { address: Address; kunci: KunciPesanTurunan };

const UMUR_DETIK = 300;

/**
 * Satu sesi per dompet per kali buka aplikasi. Promise-nya yang disimpan,
 * bukan hasilnya, supaya dua layar yang meminta sesi bersamaan tidak memicu
 * dua tanda tangan dan dua pendaftaran.
 *
 * Kunci privat hanya di memori (spec 4c §5.1). Menutup aplikasi membuangnya;
 * membuka lagi menurunkannya ulang dari tanda tangan yang sama.
 */
const sesiPerAlamat = new Map<string, Promise<SesiPesan>>();

export function sesiPesan(signer: PenandaSigner): Promise<SesiPesan> {
  const kunciMap = signer.address.toLowerCase();
  let sesi = sesiPerAlamat.get(kunciMap);
  if (!sesi) {
    sesi = bukaSesi(signer);
    sesiPerAlamat.set(kunciMap, sesi);
    // Sesi yang gagal tidak boleh tersimpan: tanpa ini, satu gangguan jaringan
    // saat pendaftaran mematikan pesan sampai aplikasi ditutup.
    sesi.catch(() => sesiPerAlamat.delete(kunciMap));
  }
  return sesi;
}

async function bukaSesi(signer: PenandaSigner): Promise<SesiPesan> {
  // Tanda tangan ini BAHAN KUNCI. Ia hidup hanya di baris-baris ini — tidak
  // disimpan, tidak dikirim, tidak dicatat (spec 4c §6).
  const bahan = await signer.signTypedData(
    kunciPesanTypedData({ who: signer.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract) as never);
  const kunci = turunkanKunciPesan(bahan);

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const pesan = {
    who: signer.address, kunciEnkripsi: kunci.pubEnkripsi, kunciTanda: kunci.pubTanda, expiresAt,
  };
  const sig = await signer.signTypedData(
    daftarKunciPesanTypedData(pesan, CONFIG.verifyingContract) as never);
  await postJson<{ ok: true }>("/pesan/kunci", { ...pesan, expiresAt: expiresAt.toString(), sig });

  return { address: signer.address, kunci };
}

/** Hanya untuk tes. */
export function _resetSesiPesanUntukTes(): void {
  sesiPerAlamat.clear();
}
```

- [ ] **Step 4: Buat `apps/mobile/src/pesan/pesan-api.ts`**

```ts
import type { Hex } from "viem";
import { tandaRequest } from "@nearly/shared";
import { req } from "../http";
import type { SesiPesan } from "./sesi";

export type BarisPesanApi = {
  id: string; pengirim: string; penerima: string; ciphertext: string; nonce: Hex;
  createdAtMs: number; dibacaAtMs: number | null;
};

export type RingkasanPercakapanApi = {
  lawan: string; displayName: string; tier: number; belumDibaca: number; terakhir: BarisPesanApi;
};

export type KunciLawan = { kunciEnkripsi: Hex; kunciTanda: Hex };

/**
 * Request pesan terautentikasi (spec 4c §5.4). `path` HARUS persis path +
 * query yang dilihat server — ia masuk ke tanda tangan. Badan diserialisasi
 * SATU kali dan string yang sama yang dikirim dan di-hash.
 */
export function reqPesan<T>(
  sesi: SesiPesan, method: "GET" | "POST", path: string, body?: unknown,
): Promise<T> {
  const badan = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const tanda = tandaRequest(sesi.kunci.privTanda, {
    method, pathDenganQuery: path, badan, ts, who: sesi.address,
  });
  return req<T>(path, {
    method,
    headers: {
      ...(badan ? { "content-type": "application/json" } : {}),
      "x-nearly-who": sesi.address,
      "x-nearly-ts": String(ts),
      "x-nearly-tanda": tanda,
    },
    body: badan || undefined,
  });
}

export const getKunciLawan = (sesi: SesiPesan, lawan: string) =>
  reqPesan<KunciLawan>(sesi, "GET", `/pesan/kunci/${lawan}`);

export const postPesan = (
  sesi: SesiPesan, b: { id: string; penerima: string; ciphertext: string; nonce: Hex },
) => reqPesan<{ ok: true }>(sesi, "POST", "/pesan", b);

export const getPercakapan = (sesi: SesiPesan) =>
  reqPesan<{ percakapan: RingkasanPercakapanApi[] }>(sesi, "GET", "/pesan/percakapan");

export function getRiwayat(sesi: SesiPesan, lawan: string, sebelumMs?: number) {
  const q = new URLSearchParams({ limit: "50" });
  if (sebelumMs !== undefined) q.set("sebelum", String(sebelumMs));
  return reqPesan<{ pesan: BarisPesanApi[] }>(sesi, "GET", `/pesan/dengan/${lawan}?${q.toString()}`);
}

export const postDibaca = (sesi: SesiPesan, lawan: string, sampaiMs: number) =>
  reqPesan<{ ok: true }>(sesi, "POST", `/pesan/dengan/${lawan}/dibaca`, { sampaiMs });

export const getBelumDibaca = (sesi: SesiPesan) =>
  reqPesan<{ total: number }>(sesi, "GET", "/pesan/belum-dibaca");

export const postTokenPush = (sesi: SesiPesan, token: string) =>
  reqPesan<{ ok: true }>(sesi, "POST", "/pesan/token-push", { token });
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS.

- [ ] **Step 6: Buktikan dua sifat menggigit**

**Mutasi A:** di `sesiPesan`, simpan hasil `await bukaSesi(...)` alih-alih promise-nya — cara termudah: jangan `set` sebelum `await`. Harapkan `"menandatangani tepat dua kali per kali buka aplikasi, walau dipanggil bersamaan"` MERAH.

**Mutasi B:** di `reqPesan`, tandatangani `JSON.stringify(body)` tapi kirim `JSON.stringify(body, null, 2)`. Harapkan tes `reqPesan` MERAH.

Kembalikan keduanya.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/pesan/sesi.ts apps/mobile/src/pesan/pesan-api.ts apps/mobile/test/pesan-sesi.test.ts
git commit -m "feat(mobile): sesi kunci pesan dan klien terautentikasi Ed25519"
```

---

## Task 13: Mobile — aksi pesan dan pesan galat

**Files:**
- Create: `apps/mobile/src/pesan/pesan-actions.ts`
- Modify: `apps/mobile/src/messages.ts`
- Test: `apps/mobile/test/pesan-aksi.test.ts`, `apps/mobile/test/pesan-messages.test.ts`

**Interfaces:**
- Consumes: `SesiPesan`, `getKunciLawan`, `postPesan`, `BarisPesanApi`, `KunciLawan` (Task 12); `bukaPesan`, `buatIdPesan`, `enkripsiPesan`, `MAKS_ISI_PESAN`, `reasonHashOf`, `reportTypedData` dari `@nearly/shared`; `postJson`, `CONFIG`, `PenandaSigner`.
- Produces:
  - `kunciLawan(sesi, lawan): Promise<KunciLawan>`, `_resetKunciLawanUntukTes()`
  - `kirimPesan(sesi, penerima: Address, isi: string): Promise<void>` — **satu-satunya tempat pesan dienkripsi & dikirim**
  - `type PesanTerbuka = { id; dariAku; createdAtMs; status: "sah"; isi; dikirimMs; tanda: Hex } | { id; dariAku; createdAtMs; status: "tidak_terverifikasi" }`
  - `bukaBaris(sesi, lawan: KunciLawan, baris: BarisPesanApi): PesanTerbuka`
  - `MAKS_BUKTI_LAPORAN = 5`, `MIN_ALASAN_LAPORAN = 10`, `laporanSiapDikirim(jumlahDipilih: number, alasan: string): boolean`
  - `laporkanPercakapan(signer: PenandaSigner, terlapor: Address, alasan: string, bukti: { pesanId; isi; dikirimMs; tanda: Hex }[]): Promise<void>`
  - di `messages.ts`: `pesanErrorMessage(code: string): string`, `labelKirimPesan(sibuk: boolean): string`, `sisaKarakterPesan(isi: string): number`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/pesan-aksi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  bukaPesan, enkripsiPesan, kunciPesanTypedData, recoverReportSigner, reasonHashOf,
  turunkanKunciPesan, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { CONFIG } from "../src/config";
import type { SesiPesan } from "../src/pesan/sesi";
import {
  _resetKunciLawanUntukTes, bukaBaris, kirimPesan, laporanSiapDikirim, laporkanPercakapan,
} from "../src/pesan/pesan-actions";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function sesiDari(akun: typeof A): Promise<SesiPesan> {
  return {
    address: akun.address as Address,
    kunci: turunkanKunciPesan(await akun.signTypedData(
      kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract))),
  };
}

type Rekaman = { url: string; init: RequestInit };
const aslinya = globalThis.fetch;
beforeEach(() => _resetKunciLawanUntukTes());
afterEach(() => { globalThis.fetch = aslinya; });

function pasangFetch(sb: SesiPesan) {
  const rekaman: Rekaman[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    const body = url.includes("/pesan/kunci/")
      ? { kunciEnkripsi: sb.kunci.pubEnkripsi, kunciTanda: sb.kunci.pubTanda }
      : { ok: true };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as never;
  return rekaman;
}

describe("kirimPesan", () => {
  it("mengenkripsi untuk penerima; penerima membuka isi yang sudah dirapikan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await kirimPesan(sa, B.address, "  halo dari A  ");
    const kirim = rek.find((r) => r.url.endsWith("/pesan") && r.init.method === "POST")!;
    const badan = JSON.parse(String(kirim.init.body)) as { id: string; penerima: string; ciphertext: string; nonce: Hex };
    expect(badan.id).toMatch(/^[0-9a-f-]{36}$/);
    const hasil = bukaPesan({
      kunci: sb.kunci, pubEnkripsiLawan: sa.kunci.pubEnkripsi, pubTandaPengirim: sa.kunci.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext: badan.ciphertext, nonce: badan.nonce,
    });
    expect(hasil.ok && hasil.amplop.isi).toBe("halo dari A");
    // Server tidak pernah melihat plaintext.
    expect(String(kirim.init.body)).not.toContain("halo dari A");
  });

  it("kunci lawan diambil sekali untuk beberapa pesan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await kirimPesan(sa, B.address, "satu");
    await kirimPesan(sa, B.address, "dua");
    expect(rek.filter((r) => r.url.includes("/pesan/kunci/"))).toHaveLength(1);
  });

  it("isi kosong atau terlalu panjang ditolak sebelum menyentuh jaringan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await expect(kirimPesan(sa, B.address, "   ")).rejects.toThrow();
    await expect(kirimPesan(sa, B.address, "x".repeat(2001))).rejects.toThrow();
    expect(rek).toHaveLength(0);
  });
});

describe("bukaBaris", () => {
  it("pesan masuk dan keluar sama-sama terbuka; yang dirusak tidak terverifikasi", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const lawanB = { kunciEnkripsi: sb.kunci.pubEnkripsi, kunciTanda: sb.kunci.pubTanda };
    const masuk = enkripsiPesan({ kunci: sb.kunci, pubEnkripsiLawan: sa.kunci.pubEnkripsi, pengirim: B.address, penerima: A.address, isi: "dari B", dikirimMs: 1 });
    const keluar = enkripsiPesan({ kunci: sa.kunci, pubEnkripsiLawan: sb.kunci.pubEnkripsi, pengirim: A.address, penerima: B.address, isi: "dari A", dikirimMs: 2 });
    const baris = (p: { ciphertext: string; nonce: Hex }, pengirim: string, penerima: string) =>
      ({ id: "x", pengirim, penerima, createdAtMs: 0, dibacaAtMs: null, ...p });

    const m = bukaBaris(sa, lawanB, baris(masuk, B.address.toLowerCase(), A.address.toLowerCase()));
    expect(m).toMatchObject({ status: "sah", isi: "dari B", dariAku: false });
    const k = bukaBaris(sa, lawanB, baris(keluar, A.address.toLowerCase(), B.address.toLowerCase()));
    expect(k).toMatchObject({ status: "sah", isi: "dari A", dariAku: true });
    const rusak = bukaBaris(sa, lawanB, baris({ ...masuk, ciphertext: `A${masuk.ciphertext.slice(1)}` }, B.address.toLowerCase(), A.address.toLowerCase()));
    expect(rusak.status).toBe("tidak_terverifikasi");
  });
});

describe("laporkanPercakapan", () => {
  it("Report ditandatangani untuk VouchRegistry, bukti diteruskan apa adanya", async () => {
    const rekaman: Rekaman[] = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
      rekaman.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;
    const signer = { address: A.address as Address, signTypedData: (td: never) => A.signTypedData(td as Parameters<typeof A.signTypedData>[0]) };
    const bukti = [{ pesanId: "00000000-0000-4000-8000-000000000001", isi: "ancaman", dikirimMs: 5, tanda: `0x${"ee".repeat(64)}` as Hex }];

    await laporkanPercakapan(signer, B.address, "  mengirim ancaman berulang kali  ", bukti);

    expect(rekaman[0]!.url).toBe(`${CONFIG.apiUrl}/pesan/laporan`);
    const badan = JSON.parse(String(rekaman[0]!.init.body)) as {
      laporan: { reporter: Address; subject: Address; reason: string; expiresAt: string; sig: Hex }; bukti: unknown;
    };
    expect(badan.bukti).toEqual(bukti);
    expect(badan.laporan.reason).toBe("mengirim ancaman berulang kali");
    const pulih = await recoverReportSigner({
      reporter: badan.laporan.reporter, subject: badan.laporan.subject,
      reasonHash: reasonHashOf(badan.laporan.reason), expiresAt: BigInt(badan.laporan.expiresAt),
    }, badan.laporan.sig, CONFIG.vouchRegistry);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });
});

describe("laporanSiapDikirim", () => {
  it("butuh 1–5 pesan dan alasan minimal 10 karakter setelah dirapikan", () => {
    expect(laporanSiapDikirim(0, "alasan yang cukup")).toBe(false);
    expect(laporanSiapDikirim(1, "alasan yang cukup")).toBe(true);
    expect(laporanSiapDikirim(5, "alasan yang cukup")).toBe(true);
    expect(laporanSiapDikirim(6, "alasan yang cukup")).toBe(false);
    expect(laporanSiapDikirim(1, "   pendek  ")).toBe(false);
  });
});
```

`apps/mobile/test/pesan-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { labelKirimPesan, pesanErrorMessage, sisaKarakterPesan } from "../src/messages";

const FALLBACK = "Gagal. Coba lagi sebentar.";

describe("pesanErrorMessage", () => {
  it("setiap kode yang dikembalikan rute pesan punya kalimatnya sendiri", () => {
    for (const code of [
      "tidak_terhubung", "terblokir", "belum_siap", "terlalu_cepat", "terlalu_besar", "pesan_diri",
      "butuh_autentikasi", "bukti_tidak_sah", "lapor_diri", "expired", "bad_signature", "invalid_body",
    ]) {
      expect(pesanErrorMessage(code)).not.toBe(FALLBACK);
    }
  });

  it("kode tak dikenal jatuh ke kalimat umum", () => {
    expect(pesanErrorMessage("entah")).toBe(FALLBACK);
  });

  // Sama seperti R8 Fase 4a: benar untuk blokir satu arah ke arah mana pun,
  // tidak mengatakan siapa memblokir siapa.
  it("terblokir netral", () => {
    const teks = pesanErrorMessage("terblokir");
    expect(teks).not.toMatch(/saling|memblokirmu|kamu blokir/i);
  });
});

describe("labelKirimPesan dan sisaKarakterPesan", () => {
  it("label mengikuti keadaan sibuk", () => {
    expect(labelKirimPesan(false)).toBe("Kirim");
    expect(labelKirimPesan(true)).toBe("Mengirim…");
  });

  it("sisa karakter dari batas 2000", () => {
    expect(sisaKarakterPesan("")).toBe(2000);
    expect(sisaKarakterPesan("x".repeat(2001))).toBe(-1);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test pesan-aksi pesan-messages`
Expected: FAIL — modul dan fungsi belum ada.

- [ ] **Step 3: Buat `apps/mobile/src/pesan/pesan-actions.ts`**

```ts
import type { Address, Hex } from "viem";
import {
  bukaPesan, buatIdPesan, enkripsiPesan, MAKS_ISI_PESAN, reasonHashOf, reportTypedData,
} from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";
import type { SesiPesan } from "./sesi";
import { getKunciLawan, postPesan, type BarisPesanApi, type KunciLawan } from "./pesan-api";

const cacheKunciLawan = new Map<string, KunciLawan>();

export async function kunciLawan(sesi: SesiPesan, lawan: string): Promise<KunciLawan> {
  const k = `${sesi.address.toLowerCase()}|${lawan.toLowerCase()}`;
  const ada = cacheKunciLawan.get(k);
  if (ada) return ada;
  const kunci = await getKunciLawan(sesi, lawan);
  cacheKunciLawan.set(k, kunci);
  return kunci;
}

/** Hanya untuk tes. */
export function _resetKunciLawanUntukTes(): void {
  cacheKunciLawan.clear();
}

/**
 * SATU-SATUNYA tempat pesan dienkripsi dan dikirim di aplikasi mobile — aturan
 * yang sama yang membuat blokir-actions.ts ada. Dua tempat mengenkripsi satu
 * operasi adalah cara termudah salah satunya kelak lupa menandatangani amplop.
 */
export async function kirimPesan(sesi: SesiPesan, penerima: Address, isi: string): Promise<void> {
  const teks = isi.trim();
  if (teks.length === 0 || teks.length > MAKS_ISI_PESAN) {
    throw new Error(`isi pesan harus 1–${MAKS_ISI_PESAN} karakter`);
  }
  const k = await kunciLawan(sesi, penerima);
  const { ciphertext, nonce } = enkripsiPesan({
    kunci: sesi.kunci, pubEnkripsiLawan: k.kunciEnkripsi,
    pengirim: sesi.address, penerima, isi: teks, dikirimMs: Date.now(),
  });
  await postPesan(sesi, { id: buatIdPesan(), penerima, ciphertext, nonce });
}

export type PesanTerbuka =
  | { id: string; dariAku: boolean; createdAtMs: number; status: "sah"; isi: string; dikirimMs: number; tanda: Hex }
  | { id: string; dariAku: boolean; createdAtMs: number; status: "tidak_terverifikasi" };

/**
 * Murni. Pesan yang gagal dibuka ditampilkan sebagai "tidak bisa diverifikasi",
 * BUKAN disembunyikan diam-diam (spec 4c §5.2) — pesan yang hilang tanpa jejak
 * membuat pengguna tidak tahu ada yang salah.
 */
export function bukaBaris(sesi: SesiPesan, lawan: KunciLawan, baris: BarisPesanApi): PesanTerbuka {
  const dariAku = baris.pengirim.toLowerCase() === sesi.address.toLowerCase();
  const hasil = bukaPesan({
    kunci: sesi.kunci,
    pubEnkripsiLawan: lawan.kunciEnkripsi,
    pubTandaPengirim: dariAku ? sesi.kunci.pubTanda : lawan.kunciTanda,
    pengirim: baris.pengirim, penerima: baris.penerima,
    ciphertext: baris.ciphertext, nonce: baris.nonce,
  });
  const dasar = { id: baris.id, dariAku, createdAtMs: baris.createdAtMs };
  return hasil.ok
    ? { ...dasar, status: "sah", isi: hasil.amplop.isi, dikirimMs: hasil.amplop.dikirimMs, tanda: hasil.amplop.tanda }
    : { ...dasar, status: "tidak_terverifikasi" };
}

export const MAKS_BUKTI_LAPORAN = 5;
/** Sama dengan `reason.min(10)` di ReportRequestSchema. */
export const MIN_ALASAN_LAPORAN = 10;

export function laporanSiapDikirim(jumlahDipilih: number, alasan: string): boolean {
  return jumlahDipilih >= 1 && jumlahDipilih <= MAKS_BUKTI_LAPORAN
    && alasan.trim().length >= MIN_ALASAN_LAPORAN;
}

/**
 * Lapor dari percakapan (spec 4c §8.2). `Report` terikat VouchRegistry sejak
 * Fase 2 — sama dengan `sendReport` di trust-api.ts.
 */
export async function laporkanPercakapan(
  signer: PenandaSigner, terlapor: Address, alasan: string,
  bukti: { pesanId: string; isi: string; dikirimMs: number; tanda: Hex }[],
): Promise<void> {
  const reason = alasan.trim();
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const msg = { reporter: signer.address, subject: terlapor, reasonHash: reasonHashOf(reason), expiresAt };
  const sig = await signer.signTypedData(reportTypedData(msg, CONFIG.vouchRegistry) as never);
  await postJson<{ ok: true }>("/pesan/laporan", {
    laporan: { reporter: signer.address, subject: terlapor, reason, expiresAt: expiresAt.toString(), sig },
    bukti,
  });
}
```

- [ ] **Step 4: Tambahkan pesan di `apps/mobile/src/messages.ts`**

Tambahkan `import { MAKS_ISI_PESAN } from "@nearly/shared";` ke impor di puncak berkas bila belum ada impor dari `@nearly/shared`, lalu di akhir berkas:

```ts
const PESAN_MESSAGES: Record<string, string> = {
  tidak_terhubung: "Pesan hanya bisa dikirim ke orang yang pernah kamu temui.",
  // Netral dengan sengaja, sama seperti `terblokir` di MEET_MESSAGES (Ruling R8
  // Fase 4a): benar untuk blokir satu arah, tidak mengatakan siapa memblokir.
  terblokir: "Kamu tidak bisa berkirim pesan dengan orang ini.",
  belum_siap: "Orang ini belum membuka pesan di Nearly. Coba lagi nanti.",
  terlalu_cepat: "Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar.",
  terlalu_besar: "Pesannya terlalu panjang.",
  pesan_diri: "Kamu tidak bisa mengirim pesan ke dirimu sendiri.",
  butuh_autentikasi: "Sesi pesan tidak sah. Tutup lalu buka lagi layar ini.",
  bukti_tidak_sah: "Bukti pesan tidak bisa diverifikasi. Muat ulang percakapan lalu coba lagi.",
  lapor_diri: "Kamu tidak bisa melaporkan dirimu sendiri.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function pesanErrorMessage(code: string): string {
  return PESAN_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/** Fungsi murni supaya layar percakapan tidak mengarang labelnya sendiri (Ruling R4). */
export function labelKirimPesan(sibuk: boolean): string {
  return sibuk ? "Mengirim…" : "Kirim";
}

export function sisaKarakterPesan(isi: string): number {
  return MAKS_ISI_PESAN - isi.length;
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS.

- [ ] **Step 6: Buktikan pemilihan kunci tanda menggigit**

**Mutasi:** di `bukaBaris`, ganti `dariAku ? sesi.kunci.pubTanda : lawan.kunciTanda` dengan `lawan.kunciTanda`. Harapkan tes `bukaBaris` MERAH pada pesan keluar. Kembalikan.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/pesan/pesan-actions.ts apps/mobile/src/messages.ts \
  apps/mobile/test/pesan-aksi.test.ts apps/mobile/test/pesan-messages.test.ts
git commit -m "feat(mobile): aksi pesan — kirim terenkripsi, buka, lapor dengan bukti"
```

---

## Task 14: Mobile — notifikasi push best-effort

**Files:**
- Create: `apps/mobile/src/pesan/rute-push.ts`, `apps/mobile/src/pesan/push.ts`
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`, `apps/mobile/app/_layout.tsx`
- Test: `apps/mobile/test/rute-push.test.ts`

**Interfaces:**
- Consumes: `SesiPesan`, `postTokenPush` (Task 12).
- Produces: `ruteDariNotifikasi(data: unknown): "/pesan" | null`; `daftarkanPush(sesi: SesiPesan): Promise<void>` — **tidak pernah melempar**.

`expo-notifications` adalah modul yang didukung Expo Go, jadi fase ini tetap tanpa native module baru. `push.ts` tidak diuji unit — ia hanya merangkai API modul native yang tidak bisa dimuat di Vitest Node (Ruling R4). Logika yang bisa diuji diekstrak ke `rute-push.ts`.

- [ ] **Step 1: Pasang `expo-notifications` dengan versi yang cocok untuk SDK 57**

Run: `pnpm --filter @nearly/mobile exec expo install expo-notifications`
Expected: `apps/mobile/package.json` mendapat `"expo-notifications": "~57.0.x"`. Bila perintah itu gagal karena jaringan, tambahkan `"expo-notifications": "~57.0.18"` secara manual lalu `pnpm install`, dan laporkan versi yang terpasang.

Periksa nama medan `NotificationBehavior` di versi terpasang sebelum Step 4:
`grep -n "shouldShow" node_modules/.pnpm/expo-notifications@*/node_modules/expo-notifications/build/Notifications.types.d.ts | head`

- [ ] **Step 2: Tulis tes yang gagal**

`apps/mobile/test/rute-push.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";

describe("ruteDariNotifikasi", () => {
  it("jenis pesan membuka daftar percakapan", () => {
    expect(ruteDariNotifikasi({ jenis: "pesan" })).toBe("/pesan");
  });

  // Isi push tidak memuat alamat (spec 4c §7.2), jadi rute tidak pernah
  // membuka percakapan tertentu langsung — aplikasi mencarinya lewat API.
  it("data lain atau rusak diabaikan", () => {
    expect(ruteDariNotifikasi({ jenis: "lain" })).toBeNull();
    expect(ruteDariNotifikasi(null)).toBeNull();
    expect(ruteDariNotifikasi("pesan")).toBeNull();
    expect(ruteDariNotifikasi(undefined)).toBeNull();
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test rute-push`
Expected: FAIL — modul tidak ada.

- [ ] **Step 4: Buat berkasnya**

`apps/mobile/src/pesan/rute-push.ts`:

```ts
/** Murni: data tersembunyi notifikasi → rute yang dibuka saat diketuk. */
export function ruteDariNotifikasi(data: unknown): "/pesan" | null {
  if (typeof data === "object" && data !== null && (data as { jenis?: unknown }).jenis === "pesan") {
    return "/pesan";
  }
  return null;
}
```

`apps/mobile/src/pesan/push.ts`:

```ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { SesiPesan } from "./sesi";
import { postTokenPush } from "./pesan-api";

let sudahDicoba = false;

/**
 * Best-effort (spec 4c §7.1, §11.6): izin diminta saat layar pesan pertama
 * kali dibuka, token didaftarkan bila didapat. Semua kegagalan ditelan dengan
 * sengaja — push belum tentu jalan di Expo Go SDK 57, dan polling tetap
 * mengantar pesan. Galat push TIDAK PERNAH ditampilkan ke pengguna.
 *
 * Dicoba sekali per kali buka aplikasi, supaya penolakan izin tidak ditanyakan
 * ulang setiap layar difokuskan.
 */
export async function daftarkanPush(sesi: SesiPesan): Promise<void> {
  if (sudahDicoba) return;
  sudahDicoba = true;
  try {
    let izin = await Notifications.getPermissionsAsync();
    if (!izin.granted) izin = await Notifications.requestPermissionsAsync();
    if (!izin.granted) return;

    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await postTokenPush(sesi, token);
  } catch (e) {
    if (__DEV__) console.warn("push tidak tersedia:", e instanceof Error ? e.message : e);
  }
}
```

Ganti isi `apps/mobile/app/_layout.tsx`:

```tsx
import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";

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
  useEffect(() => {
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      if (rute) router.push(rute);
    });
    return () => langganan.remove();
  }, []);

  return <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }} />;
}
```

- [ ] **Step 5: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS. Kalau typecheck menolak nama medan di `setNotificationHandler`, pakai nama dari `NotificationBehavior` versi terpasang dan catat di laporan.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/pesan/rute-push.ts \
  apps/mobile/src/pesan/push.ts apps/mobile/app/_layout.tsx apps/mobile/test/rute-push.test.ts
git commit -m "feat(mobile): notifikasi push pesan best-effort lewat expo-notifications"
```

---

## Task 15: Mobile — layar pesan

**Files:**
- Create: `apps/mobile/app/pesan/index.tsx`, `apps/mobile/app/pesan/[address].tsx`, `apps/mobile/app/pesan/lapor/[address].tsx`
- Modify: `apps/mobile/app/index.tsx`, `apps/mobile/app/profile/[address].tsx`
- Test: tidak ada tes render baru (Ruling R4) — logikanya sudah diuji di Task 12–14

**Interfaces:**
- Consumes: `sesiPesan` (T12); `getPercakapan`, `getRiwayat`, `postDibaca`, `getBelumDibaca` (T12); `kunciLawan`, `bukaBaris`, `kirimPesan`, `laporkanPercakapan`, `laporanSiapDikirim`, `MAKS_BUKTI_LAPORAN`, `PesanTerbuka` (T13); `daftarkanPush` (T14); `pesanErrorMessage`, `labelKirimPesan`, `sisaKarakterPesan` (T13), `teksLencana`, `blokirErrorMessage` (sudah ada); `aksiBlokir` (4a); `createDevSigner`, `CONFIG`, `ApiError`; `MAKS_ISI_PESAN` dari `@nearly/shared`.
- Produces: rute `/pesan`, `/pesan/[address]`, `/pesan/lapor/[address]`.

Pola wajib (pelajaran Fase 3c dan 4a): signer di-`useMemo`; **satu** pemicu muat per layar lewat `useFocusEffect`; interval dibersihkan saat layar kehilangan fokus; galat muat ulang setelah aksi yang BERHASIL tidak pernah dilaporkan sebagai kegagalan aksi; alamat lawan selalu tampil (nama bukan identitas). Baca `apps/mobile/app/blokir.tsx` dan `kecocokan.tsx` dulu.

- [ ] **Step 1: Buat `apps/mobile/app/pesan/index.tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { sesiPesan } from "../../src/pesan/sesi";
import { getPercakapan, type RingkasanPercakapanApi } from "../../src/pesan/pesan-api";
import { bukaBaris, kunciLawan } from "../../src/pesan/pesan-actions";
import { daftarkanPush } from "../../src/pesan/push";
import { pesanErrorMessage, teksLencana } from "../../src/messages";

type Baris = RingkasanPercakapanApi & { pratinjau: string };

export default function DaftarPesanScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  // TIDAK menangkap galatnya sendiri — pemicu di bawah yang menangkap, pola
  // yang sama dengan blokir.tsx (Ruling R9 Fase 4a).
  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    // Izin notifikasi diminta saat layar pesan pertama kali dibuka (spec 4c §9).
    void daftarkanPush(sesi);
    const { percakapan } = await getPercakapan(sesi);
    const hasil = await Promise.all(percakapan.map(async (p): Promise<Baris> => {
      try {
        const t = bukaBaris(sesi, await kunciLawan(sesi, p.lawan), p.terakhir);
        return { ...p, pratinjau: t.status === "sah" ? t.isi : "Pesan tidak bisa diverifikasi" };
      } catch {
        return { ...p, pratinjau: "…" };
      }
    }));
    setBaris(hasil);
    setGalat(null);
  }, [signer]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      setBaris((b) => b ?? []);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Percakapan gagal dimuat.");
    });
    void jalankan();
    const t = setInterval(() => { void jalankan(); }, 15_000);
    return () => { aktif = false; clearInterval(t); };
  }, [muat]));

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(b) => b.lawan}
        ListEmptyComponent={
          // Daftar kosong di samping galat BUKAN "belum ada percakapan".
          galat ? null : (
            <Text style={s.kosong}>
              Belum ada percakapan. Pesan hanya bisa dikirim ke orang yang pernah kamu temui — buka profil koneksimu untuk mulai.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const lencana = teksLencana(item.belumDibaca);
          return (
            <Link href={`/pesan/${item.lawan}`} style={s.kartu}>
              <Text style={s.nama}>
                {item.displayName || "Tanpa nama"}{lencana ? `  (${lencana})` : ""}
              </Text>
              {"\n"}
              <Text style={s.alamat}>{item.lawan}</Text>
              {"\n"}
              <Text style={s.pratinjau}>{item.pratinjau}</Text>
            </Link>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  galat: { color: "#b00" },
  kosong: { color: "#666", lineHeight: 20 },
  kartu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  nama: { fontWeight: "600" },
  alamat: { fontFamily: "monospace", fontSize: 11, color: "#666" },
  pratinjau: { color: "#333" },
});
```

- [ ] **Step 2: Buat `apps/mobile/app/pesan/[address].tsx`**

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { MAKS_ISI_PESAN } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { aksiBlokir } from "../../src/blokir-actions";
import { sesiPesan } from "../../src/pesan/sesi";
import { getRiwayat, postDibaca } from "../../src/pesan/pesan-api";
import { bukaBaris, kirimPesan, kunciLawan, type PesanTerbuka } from "../../src/pesan/pesan-actions";
import {
  blokirErrorMessage, labelKirimPesan, pesanErrorMessage, sisaKarakterPesan,
} from "../../src/messages";

export default function PercakapanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [daftar, setDaftar] = useState<PesanTerbuka[] | null>(null);
  const [isi, setIsi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const ditandaiSampai = useRef(0);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Terbaru dulu — FlatList `inverted` menaruhnya di bawah.
    setDaftar(pesan.map((b) => bukaBaris(sesi, k, b)));
    setGalat(null);

    const masukTerbaru = pesan.find((b) => b.pengirim.toLowerCase() === lawan.toLowerCase());
    if (masukTerbaru && masukTerbaru.createdAtMs > ditandaiSampai.current) {
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
    }
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      setDaftar((d) => d ?? []);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Percakapan gagal dimuat.");
    });
    void jalankan();
    // Polling hanya selama layar aktif (spec 4c §9): pembersih di bawah
    // menghentikannya saat layar kehilangan fokus.
    const t = setInterval(() => { void jalankan(); }, 4_000);
    return () => { aktif = false; clearInterval(t); };
  }, [muat]));

  async function kirim() {
    if (sibuk || isi.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await kirimPesan(await sesiPesan(signer), lawan, isi);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Pesan gagal dikirim.");
      setSibuk(false);
      return;
    }
    setIsi("");
    setSibuk(false);
    // Pesannya SUDAH tersimpan. Gagal memuat ulang bukan kegagalan kirim —
    // polling berikutnya akan menampilkannya.
    muat().catch(() => {});
  }

  function blokir() {
    Alert.alert(
      "Blokir orang ini?",
      "Laporkan dulu kalau perlu — setelah diblokir, pesannya tidak bisa dipilih lagi sampai blokir dicabut.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Blokir",
          style: "destructive",
          onPress: () => {
            aksiBlokir(signer, lawan, false)
              .then(() => router.replace("/pesan"))
              .catch((e: unknown) => setGalat(
                e instanceof ApiError ? blokirErrorMessage(e.code) : "Gagal memblokir."));
          },
        },
      ],
    );
  }

  const sisa = sisaKarakterPesan(isi);

  if (daftar === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: "Pesan" }} />
      <Text style={s.alamat}>{lawan}</Text>
      <View style={s.aksi}>
        <Button title="Lapor" onPress={() => router.push(`/pesan/lapor/${lawan}`)} />
        <Button title="Blokir" color="#b00" onPress={blokir} />
      </View>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <FlatList
        inverted
        style={s.daftar}
        data={daftar}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={[s.gelembung, item.dariAku ? s.milikku : s.milikLawan]}>
            <Text style={item.status === "sah" ? s.teks : s.tidakSah}>
              {item.status === "sah" ? item.isi : "Pesan tidak bisa diverifikasi"}
            </Text>
          </View>
        )}
      />
      <View style={s.tulis}>
        <TextInput
          style={s.input}
          value={isi}
          onChangeText={setIsi}
          placeholder="Tulis pesan"
          multiline
          maxLength={MAKS_ISI_PESAN}
        />
        <Button
          title={labelKirimPesan(sibuk)}
          disabled={sibuk || isi.trim().length === 0 || sisa < 0}
          onPress={() => { void kirim(); }}
        />
      </View>
      {sisa < 100 && <Text style={s.sisa}>{sisa} karakter tersisa</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 8 },
  tengah: { flex: 1 },
  alamat: { fontFamily: "monospace", fontSize: 11, color: "#666" },
  aksi: { flexDirection: "row", justifyContent: "space-between" },
  galat: { color: "#b00" },
  daftar: { flex: 1 },
  gelembung: { maxWidth: "80%", padding: 10, borderRadius: 12, marginVertical: 3 },
  milikku: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  milikLawan: { alignSelf: "flex-start", backgroundColor: "#f1f1f1" },
  teks: { color: "#111" },
  tidakSah: { color: "#b00", fontStyle: "italic" },
  tulis: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, maxHeight: 120 },
  sisa: { color: "#666", fontSize: 12, textAlign: "right" },
});
```

- [ ] **Step 3: Buat `apps/mobile/app/pesan/lapor/[address].tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../../../src/config";
import { createDevSigner } from "../../../src/signer";
import { ApiError } from "../../../src/http";
import { aksiBlokir } from "../../../src/blokir-actions";
import { sesiPesan } from "../../../src/pesan/sesi";
import { getRiwayat } from "../../../src/pesan/pesan-api";
import {
  bukaBaris, kunciLawan, laporanSiapDikirim, laporkanPercakapan, MAKS_BUKTI_LAPORAN,
  type PesanTerbuka,
} from "../../../src/pesan/pesan-actions";
import { blokirErrorMessage, pesanErrorMessage } from "../../../src/messages";

type PesanSah = Extract<PesanTerbuka, { status: "sah" }>;

export default function LaporPesanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [masuk, setMasuk] = useState<PesanSah[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Hanya pesan MASUK yang terverifikasi yang bisa jadi bukti — server menolak
    // yang lain dengan 422 (spec 4c §8.2).
    setMasuk(pesan.map((b) => bukaBaris(sesi, k, b))
      .filter((p): p is PesanSah => !p.dariAku && p.status === "sah"));
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    muat().catch((e: unknown) => {
      if (!aktif) return;
      setMasuk([]);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Pesan gagal dimuat.");
    });
    return () => { aktif = false; };
  }, [muat]));

  function alih(id: string) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else if (baru.size < MAKS_BUKTI_LAPORAN) baru.add(id);
      return baru;
    });
  }

  async function kirim() {
    if (sibuk || !masuk || !laporanSiapDikirim(dipilih.size, alasan)) return;
    setSibuk(true);
    setGalat(null);
    const bukti = masuk.filter((p) => dipilih.has(p.id))
      .map((p) => ({ pesanId: p.id, isi: p.isi, dikirimMs: p.dikirimMs, tanda: p.tanda }));
    try {
      await laporkanPercakapan(signer, lawan, alasan, bukti);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Laporan gagal dikirim.");
      setSibuk(false);
      return;
    }
    setSibuk(false);
    Alert.alert("Laporan terkirim", "Laporanmu akan ditinjau. Blokir orang ini juga?", [
      { text: "Nanti", style: "cancel", onPress: () => router.back() },
      {
        text: "Blokir",
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            // Laporannya SUDAH terkirim — jangan katakan sebaliknya.
            .catch((e: unknown) => setGalat(e instanceof ApiError
              ? `Laporan terkirim, tapi gagal memblokir: ${blokirErrorMessage(e.code)}`
              : "Laporan terkirim, tapi gagal memblokir."));
        },
      },
    ]);
  }

  if (masuk === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Text style={s.peringatan}>
        Pesan yang kamu pilih akan bisa dibaca peninjau. Pesan lain tetap terenkripsi.
      </Text>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <Text style={s.label}>Pilih 1–{MAKS_BUKTI_LAPORAN} pesan sebagai bukti</Text>
      <FlatList
        style={s.daftar}
        data={masuk}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={galat ? null : <Text style={s.kosong}>Tidak ada pesan masuk yang bisa dijadikan bukti.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => alih(item.id)} style={s.baris}>
            <Text style={s.kotak}>{dipilih.has(item.id) ? "☑" : "☐"}</Text>
            <Text style={s.isi}>{item.isi}</Text>
          </Pressable>
        )}
      />
      <TextInput
        style={s.input}
        value={alasan}
        onChangeText={setAlasan}
        placeholder="Alasan (minimal 10 karakter)"
        multiline
        maxLength={1000}
      />
      <Button
        title={sibuk ? "Mengirim…" : "Kirim laporan"}
        disabled={sibuk || !laporanSiapDikirim(dipilih.size, alasan)}
        onPress={() => { void kirim(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  tengah: { flex: 1 },
  peringatan: { backgroundColor: "#fff4e5", padding: 10, borderRadius: 8, color: "#7a4a00" },
  galat: { color: "#b00" },
  label: { fontWeight: "600" },
  daftar: { flex: 1 },
  kosong: { color: "#666" },
  baris: { flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  kotak: { fontSize: 18 },
  isi: { flex: 1 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, minHeight: 60 },
});
```

- [ ] **Step 4: Tautan berlencana di `apps/mobile/app/index.tsx`**

1. Impor `sesiPesan` dari `../src/pesan/sesi` dan `getBelumDibaca` dari `../src/pesan/pesan-api`.
2. Tambahkan state `const [belumDibaca, setBelumDibaca] = useState(0);` di samping `baru`.
3. Di dalam `useEffect` yang sudah ada (JANGAN buat efek atau pemicu kedua), setelah blok IIFE kecocokan, tambahkan IIFE kedua dengan kegagalannya sendiri:

```tsx
    // Lencana pesan, dengan kegagalannya sendiri: beranda tidak boleh gagal
    // hanya karena lencana. Membuka beranda memulai sesi kunci pesan — dengan
    // signer pengembangan tanpa jendela konfirmasi; dompet sungguhan kelak
    // akan meminta satu konfirmasi per kali buka aplikasi (spec 4c §5.1).
    void (async () => {
      try {
        const { total } = await getBelumDibaca(await sesiPesan(signer));
        setBelumDibaca(total);
      } catch {
        setBelumDibaca(0);
      }
    })();
```

4. Di bawah `const lencana = teksLencana(baru);` tambahkan `const lencanaPesan = teksLencana(belumDibaca);`, lalu tambahkan tautan setelah tautan "Saling ingin bertemu":

```tsx
      <Link href="/pesan" style={s.link}>
        Pesan{lencanaPesan ? `  ${lencanaPesan}` : ""}
      </Link>
```

- [ ] **Step 5: Tombol di `apps/mobile/app/profile/[address].tsx`**

Tambahkan `router` ke impor `expo-router`. Tepat SEBELUM blok yang diawali `{signer && !isOwnProfile && connected && (` (seksi vouch), tambahkan:

```tsx
      {signer && !isOwnProfile && connected && (
        // Hanya untuk koneksi (spec 4c §4). Server tetap menegakkan gerbangnya
        // sendiri — tombol ini kenyamanan, bukan pengaman.
        <View style={s.section}>
          <Button title="Kirim pesan" onPress={() => router.push(`/pesan/${address}`)} />
        </View>
      )}
```

`connected === true` hanya bila `GET /connected/:a/:b` benar; `null`/`false` menyembunyikan tombol.

- [ ] **Step 6: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS.

- [ ] **Step 7: Periksa pola wajib dan laporkan keluarannya**

```bash
# Setiap layar pesan: tepat satu useFocusEffect, tanpa useEffect.
for f in apps/mobile/app/pesan/index.tsx "apps/mobile/app/pesan/[address].tsx" "apps/mobile/app/pesan/lapor/[address].tsx"; do
  echo "$f focus=$(grep -c useFocusEffect\( "$f") effect=$(grep -c "useEffect(" "$f")"
done
# Satu-satunya tempat enkripsi pesan dan penandatanganan KunciPesan.
grep -rn "enkripsiPesan(" apps/mobile/src apps/mobile/app | grep -v "src/pesan/pesan-actions.ts"   # WAJIB kosong
grep -rn "kunciPesanTypedData(" apps/mobile/src apps/mobile/app | grep -v "src/pesan/sesi.ts"      # WAJIB kosong
```

Harapkan `focus=1 effect=0` untuk ketiga layar (impor `useFocusEffect` terhitung satu baris; sesuaikan hitungannya bila impornya berada di baris yang sama dan laporkan angka mentahnya).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/pesan/index.tsx "apps/mobile/app/pesan/[address].tsx" \
  "apps/mobile/app/pesan/lapor/[address].tsx" apps/mobile/app/index.tsx "apps/mobile/app/profile/[address].tsx"
git commit -m "feat(mobile): layar daftar percakapan, percakapan, dan lapor dengan bukti"
```

---

## Task 16: Amandemen spec induk, verifikasi batas global, serah terima

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`
- Apply: `supabase/migrations/0007_pesan.sql` (oleh pemilik project)

- [ ] **Step 1: Amandemen spec induk sesuai spec 4c §13**

Temukan setiap penyebutan XMTP: `grep -n -i "xmtp" docs/superpowers/specs/2026-09-03-nearly-design.md`. Lalu:

1. **§7.5** — ganti paragraf teknologi XMTP dengan relay sendiri + E2E dan rujuk `docs/superpowers/specs/2026-09-13-nearly-fase-4c-pesan-design.md` §2.1. Butir "jaminan tanpa spam ditegakkan di sisi client" menjadi "ditegakkan di server". Butir 1 blokir: "mencabut vouch serta kontribusi trust" menjadi "menghentikan pengaruh vouch dan kontribusi trust pada skor (vouch on-chain tidak dicabut otomatis — lihat spec 4c §8.1)".
2. **Tabel teknologi** (baris `| Pesan | XMTP, ...`) dan **tumpukan mobile** — hapus `@xmtp/react-native-sdk`; tulis "relay Nearly + E2E (`@noble/*`)".
3. **Catatan "Expo Go tidak bisa dipakai begitu XMTP masuk"** di bagian tumpukan dan Fase 0 — ganti dengan catatan bahwa XMTP diganti di Fase 4c sehingga alasan itu gugur; development build tetap diperlukan kelak untuk Notification Service Extension (spec 4c §11.5).
4. **Deskripsi Fase 4** — "pesan lewat XMTP" menjadi "pesan (relay + E2E, spec 4c)".
5. **§14 butir 5** — ketiga batas XMTP diganti satu kalimat rujukan ke batas yang diakui di spec 4c §11.
6. **Uji gerbang pesan** dan **uji blokir** di bagian verifikasi — "penegakan sisi client" menjadi "penegakan server".

Setelah selesai, `grep -n -i "xmtp"` hanya boleh menyisakan kalimat yang menjelaskan bahwa XMTP DIGANTI di Fase 4c. Laporkan keluaran grep itu apa adanya.

- [ ] **Step 2: Jalankan verifikasi batas global dan laporkan keluarannya apa adanya**

Jalankan setiap perintah terpisah (grep yang kosong keluar dengan status 1 — itu hasil yang diharapkan, bukan kegagalan):

```bash
BASE=$(git merge-base main HEAD)
git diff --stat "$BASE"..HEAD -- packages/trust packages/contracts                              # WAJIB kosong
git diff --stat "$BASE"..HEAD -- apps/api/src/handshake-gate.ts apps/api/src/routes/report.ts   # WAJIB kosong
grep -rn "@noble/curves" apps/api/src apps/mobile/src apps/mobile/app                             # WAJIB kosong
grep -rn "recoverKunciPesanSigner" packages apps                                                  # WAJIB kosong
grep -rn "kunciPesanTypedData(" apps/mobile/src apps/mobile/app | grep -v "src/pesan/sesi.ts"      # WAJIB kosong
grep -rn "await recover[A-Za-z]*Signer(" apps/api/src | grep -v pulihkanTandaTangan               # WAJIB kosong
grep -rn "@xmtp" apps packages                                                                    # WAJIB kosong
git diff "$BASE"..HEAD -- apps/mobile/package.json                                                # hanya expo-notifications
pnpm -r test
pnpm -r typecheck
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "docs: amandemen spec induk — pesan lewat relay + E2E, bukan XMTP"
```

- [ ] **Step 4: Serahkan ke pemilik project** (dilakukan controller, bukan pelaksana)

1. **Terapkan `supabase/migrations/0007_pesan.sql` SEBELUM menjalankan API dari branch ini.** Tanpa tabel `pesan` dan `kunci_pesan`, setiap endpoint pesan dan lencana beranda gagal 500.
2. **Uji lapangan** (pola 4a, skrip dua dompet terhadap API + Supabase sungguhan dengan enkripsi asli dari `packages/shared`):
   - A dan B yang terkoneksi mendaftarkan kunci; A mengirim; B melihat percakapan, membuka isinya, menandai dibaca, lencana turun
   - C yang bukan koneksi: `GET /pesan/kunci/<A>` → 403 `tidak_terhubung` — identik entah A punya kunci atau tidak
   - Isi pesan tidak pernah muncul di baris `pesan` Supabase (periksa kolom `ciphertext`)
   - A memblokir B → percakapan hilang di kedua sisi, kirim → 403 `terblokir`; cabut blokir → riwayat kembali
   - Lapor dengan bukti asli → 200 dan baris `bukti_laporan_pesan`; bukti palsu → 422 tanpa baris laporan
   - Tanda tangan cacat bentuk di `x-nearly-tanda` → 401, bukan 500
   - 31 pesan dalam satu menit → yang ke-31 `429`
3. **Push diuji manual** di iPhone lewat Expo Go: izin, token terdaftar, notifikasi "Pesan baru dari …" saat aplikasi tertutup. Hasilnya dilaporkan apa adanya — kalau push tidak jalan di SDK 57, itu batas yang diakui spec 4c §11.6, bukan kegagalan fase.

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.
