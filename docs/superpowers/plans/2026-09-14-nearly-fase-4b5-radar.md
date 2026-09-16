# Fase 4b + 5 — Radar, Visibilitas, Notifikasi Kedekatan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun radar acara (daftar kartu orang yang hadir sekarang), saklar visibilitas Terlihat/Tersembunyi yang timbal balik, nama tampilan, notifikasi kedekatan untuk koneksi dan yang saling ingin bertemu, serta penyapuan data lokasi ≤ 24 jam.

**Architecture:** HP berdetak (sel geohash7) setiap 60 detik selagi layar Radar terbuka; API menyimpan satu baris `kehadiran` per (acara, orang) dan menyajikan radar lewat polling 10 detik. Detak, radar, dan `GET /profil/saya` diautentikasi header sesi Ed25519 Fase 4c (`pemanggilPesan`); nama + visibilitas ditulis lewat satu tipe EIP-712 baru `AturProfil`. Notifikasi kedekatan dipicu transisi tidak hadir → hadir, tanpa await, memakai ulang `PushPort` dan token push Fase 4c tanpa mengubahnya. Penyapuan lokasi dijalankan API sendiri (saat mulai + oportunistik dari detak) dan alat CLI.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono · Supabase (service role) · viem (EIP-712) · Zod · Vitest · Expo Router / React Native (Expo Go SDK 57) · `expo-location` · `expo-notifications`

**Spec:** `docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md` (spec induk: `docs/superpowers/specs/2026-09-03-nearly-design.md`)

## Global Constraints

### Keputusan terkunci (spec §2, verbatim)

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Siapa yang muncul di radar | Sudah **check-in terverifikasi** di acara yang **sedang berlangsung** DAN **masih di area acara** (detak dalam 15 menit terakhir) |
| 2 | Default visibilitas | **Terlihat** |
| 3 | Aturan Tersembunyi | **Timbal balik**: tidak muncul di radar, **tidak bisa membuka radar**, tidak memicu dan tidak menerima notifikasi kedekatan |
| 4 | Penerima notifikasi kedekatan | **Koneksi** (pernah bertemu) **dan** yang **saling ingin bertemu** — bukan tanda sepihak |
| 5 | Retensi lokasi 24 jam | Hapus jejak yang **tidak dipakai trust**: kehadiran, notifikasi kedekatan, sel di QR salaman & QR check-in yang kedaluwarsa. Sel di `connections` & `checkins` dipertahankan (§10) |
| 6 | Nama tampilan | Dikerjakan **di fase ini** |
| 7 | Istilah | **"Tersembunyi"**, bukan "hantu" / "ghost" — di spec, kode yang terlihat pengguna, dan salinan UI |

- **R1.** Detak dan radar diautentikasi dengan tanda tangan sesi Ed25519 Fase 4c (`pemanggilPesan`, header `x-nearly-who/ts/tanda`), bukan bukti EIP-712 per request — polling 10 detik tidak boleh memunculkan popup dompet.
- **R2.** Satu tipe EIP-712 tulis baru, `AturProfil` (nama + visibilitas sekaligus). Tidak ada tipe baca baru. Total tipe menjadi **25**.
- **R3.** Penghapusan data lokasi dijalankan **API sendiri** secara oportunistik + alat CLI, bukan `pg_cron`: `pg_cron` belum tentu aktif di project Supabase, dan fase ini tidak boleh bergantung pada pengaturan akun.
- **R4.** Radar memakai **polling 10 detik** (spec induk §11.1 butir 5), bukan Supabase Realtime.

### Batas jalur paralel dengan Fase 6 (spec §12, verbatim)

| | Jalur ini (4b + 5) | Jalur Fase 6 |
|---|---|---|
| Branch / worktree | `fase-4b5-radar` | `fase-6-demo` |
| Migrasi | **`0008_radar.sql`** saja | `0009_*` |
| Tipe EIP-712 | +1 (`AturProfil`) → 25 | tidak menambah |
| `apps/mobile` | ya | tidak menyentuh |
| `apps/web` | **tidak menyentuh** | ya |
| `apps/api` | `routes/radar.ts`, `routes/profil.ts`, store baru, `db.ts` & `event-store.ts` (pemetaan sel null) | `routes/graf.ts`, CORS, alat seed |

- Berkas bersama yang disentuh kedua jalur — **hanya penambahan, di akhir blok yang ada**, tanpa mengubah atau memindahkan baris yang sudah ada: `apps/api/src/ports.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/deps.ts`, `packages/shared/src/index.ts`.
- Jalur ini **tidak** mengubah: `packages/trust`, `packages/contracts`, `apps/api/src/handshake-gate.ts`, `apps/api/src/event-gate.ts`, `apps/api/src/trust/**`, dan seluruh kode pesan Fase 4c selain memanggilnya (satu pengecualian yang diwajibkan spec §8.3: `apps/mobile/src/pesan/rute-push.ts`, lihat Ruling P15).

### Batas keras eksekusi

- **JANGAN PERNAH menerapkan migrasi** (`supabase db push`, SQL editor, psql, apa pun) **dan JANGAN PERNAH menulis ke Supabase atau blockchain** — tidak ada skrip, tes, atau alat yang dijalankan terhadap layanan sungguhan. Semua tes memakai fake di memori. `tools/sapu-lokasi.ts` DITULIS, tidak DIJALANKAN.
- **JANGAN sentuh** `packages/trust`, `packages/contracts`, `apps/api/src/handshake-gate.ts`, `apps/api/src/event-gate.ts`, `apps/api/src/trust/**`, `apps/web`.
- Migrasi baru **hanya** `supabase/migrations/0008_radar.sql`.
- Setiap commit memakai `git add` dengan **nama berkas eksplisit** (tidak pernah `git add -A` / `git add .`), dan pesan commit diakhiri baris `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Dilarang `git reset --hard`, `git clean`, `rm -r`, force-push.
- Setiap langkah mutasi: terapkan → jalankan tes → **rekam nama tes yang merah** → kembalikan dengan `git checkout -- <berkas>` → jalankan ulang sampai hijau → `git status` hanya menunjukkan berkas task itu. Kalau mutasi TIDAK memerahkan tes yang disebut, laporkan — jangan menyetel tesnya sampai merah.

### Konvensi repo

- Impor relatif **tanpa ekstensi**. Identifier, komentar, dan semua teks yang terlihat pengguna berbahasa Indonesia.
- Tes: vitest, `test/**/*.test.ts`. Perintah per paket: `pnpm --filter <nama> exec vitest run <path>`; typecheck: `pnpm --filter <nama> exec tsc --noEmit`. Nama paket: `@nearly/shared`, `@nearly/api`, `@nearly/mobile`.
- Tes mobile **hanya fungsi murni** (tidak ada harness render RN); layar diverifikasi lewat typecheck.
- Judul tes TIDAK menyebut jumlah (pelajaran Fase 3c).
- RLS menyala di setiap tabel baru tanpa policy; kolom alamat huruf kecil dengan `~`, bukan `~*`.
- Setiap pemulihan tanda tangan EIP-712 lewat `pulihkanTandaTangan`.
- Isi push kedekatan: judul `Nearly`, data `{ jenis: "radar", eventId }`. **Tidak pernah** alamat, judul atau lokasi acara, maupun sel (spec §6.4).
- Respons radar **tidak pernah** memuat `cell`, `seen_at`, jumlah detak, jarak, skor trust mentah, atau siapa yang disembunyikan blokir (spec §5.2).

---

## Pemetaan Spec → Task

| Spec | Isi | Task |
|---|---|---|
| §2 R2, §7.1 | Tipe EIP-712 `AturProfil`, `JUMLAH_TIPE` 25, tidak di Solidity | 1 |
| §7.2 aturan nama, §11 shared | Validasi nama murni di `packages/shared` (32 code point, Cc/Cf, trim) | 2 |
| §5.1 langkah 2, §7.2 langkah 1 | Skema Zod badan detak dan `POST /profil` | 2 |
| §4.1–§4.4 | Migrasi `0008_radar.sql` | 3 |
| §4.4, §11 | Pemetaan store `cell = null` → `""`; offer bersel kosong tidak pernah sukses | 4 |
| §12 | Port store baru + `METODE_*` + `AssertNever` | 5 |
| §4.2, §4.3, §5.2 `pernahBertemu`, §6.3 | `radar-store.ts` (kehadiran, notif, koneksi) | 6 |
| §4.5, §10.8, §11 tes privasi | `sapuLokasi`, penyapu oportunistik, alat CLI, tes privasi retensi + mutasi | 6, 7 |
| §7.3, §5.2 penyaring visibilitas | `profil-store.ts` | 8 |
| §3, §5.1, §5.2, §11 | Gerbang detak & radar, urutan gerbang, timbal balik, blokir + mutasi | 9 |
| §6, §11 | `kirimNotifKedekatan` + mutasi batas 5 | 10 |
| §7.2, §7.3, §11 | Gerbang `POST /profil` & `GET /profil/saya` | 11 |
| §5.1, §5.2, §5.3, §4.5 butir 1–2, §7.2, §7.3, §11 tes nama kunci JSON | Rute, perakitan `app.ts`/`index.ts`, tes rute | 12 |
| §8.2 keadaan, §8.3, §11 mobile | Klien API, fungsi murni `messages.ts`, `ruteDariNotifikasi` | 13 |
| §8.1 Profil saya, §10.3 | Layar Profil saya + tautan beranda | 14 |
| §8.1 radar, §8.2, §8.4 | Layar Radar, tombol Buka radar, izin lokasi | 15 |
| §13, §11 verifikasi, §12 | Amandemen spec induk + verifikasi global + verifikasi batas | 16 |
| §9, §10 | Tidak ada kode (batas yang diakui); dicatat di Task 16 | 16 |

## Ruling (keputusan rencana di luar teks spec)

- **P1. `AturProfil` hidup di berkas baru `packages/shared/src/profil.ts`** dengan keluarga `PROFIL_TYPES`, bersama konstanta `VISIBILITAS`. Alasan: pola satu-berkas-per-keluarga (`meet.ts`, `blokir.ts`, `pesan.ts`) membuat `typehash-semua.test.ts` cukup menambah satu spread.
- **P2. Validasi Cc/Cf memakai tabel rentang eksplisit, bukan `/\p{Cc}|\p{Cf}/u`,** dan juga menolak surrogate tunggal. Alasan: fungsi yang sama berjalan di Hermes (Expo Go); regex yang tidak didukung mesin JS di HP gagal saat bundel dimuat dan mematikan seluruh aplikasi. Tabel diuji sama persis dengan `\p{Cc}|\p{Cf}` milik Node untuk setiap code point. Surrogate tunggal bukan Cc/Cf, tapi Postgres tidak bisa menyimpannya sebagai teks — tanpa penolakan ia menjadi 500.
- **P3. Skema Zod `POST /profil` hanya membatasi `displayName` mentah ≤ 256 karakter;** aturan nama sebenarnya di gerbang. Alasan: kalau skema ikut menolak, 400 `nama_tidak_sah` (langkah 4 spec §7.2) tidak pernah terjangkau dan urutan gerbang berbohong.
- **P4. Dua store baru: `RadarStore` (kehadiran, notif_kedekatan, baca `connections`, sapuan) dan `ProfilSayaStore` (`profiles.display_name` + `visibilitas`).** `terhubungDengan` membaca `connections` dari `RadarStore`, bukan metode baru di `HandshakeStore`. Alasan: menambah metode ke `HandshakeStore` mengubah blok lama di `ports.ts` (dilarang §12); presedennya `MeetStore.profilRingkas` yang membaca `profiles` dan `trust_snapshots`.
- **P5. `bacaRequest`/`uraiJson` disalin ke `apps/api/src/baca-request-sesi.ts`,** tidak diekspor dari `routes/pesan.ts`. Alasan: §12 melarang mengubah kode Fase 4c selain memanggilnya.
- **P6. `:eventId` cacat bentuk → 404 `event_not_found`,** diperiksa setelah langkah 1–2. Alasan: tanpa kode galat baru; bagi pemanggil sama dengan acara yang tidak ada.
- **P7. `jumlah` di respons radar = jumlah kartu yang dikirim** (setelah penyaringan dan batas 200). Alasan: jumlah sebelum penyaringan membocorkan berapa orang disembunyikan blokir atau visibilitas.
- **P8. Gerbang radar gagal tertutup:** alamat yang tidak ada di peta `visibilitasBanyak` dianggap tersembunyi. Store menjamin setiap alamat yang diminta punya entri (default `terlihat`), jadi jalur normal tidak berubah.
- **P9. Langkah 7 dan 8 detak menghapus baris kehadiran tanpa syarat** (idempoten), bukan hanya bila baris ada.
- **P10. `POST /profil` menghapus seluruh kehadiran setiap kali visibilitas yang disimpan `tersembunyi`,** tanpa membaca nilai lama; upsert profil DULU, baru hapus kehadiran. Alasan: urutan terbalik membiarkan detak di antaranya membaca `terlihat` dan menulis baris baru.
- **P11. `expiresAt` tepat `sekarang + 3600` detik masih diterima** (batas inklusif).
- **P12. Notifikasi:** baris `notif_kedekatan` tetap disisip walau penerima tak punya token push (sekali-per-pasangan dan batas 5 berlaku apa pun keadaan token); kegagalan satu arah tidak menghentikan arah lain; `push === null` → tidak membaca atau menulis apa pun (pola `kirimPushPesan`).
- **P13. Sapuan oportunistik hanya dipicu detak yang berakhir `hadir: true`** (spec §5.1 langkah 9); penanda waktu dimulai kosong sehingga detak pertama setelah proses mulai ikut menyapu. Sapuan saat mulai ditambahkan di akhir `index.ts`, bukan di `createApp` (yang dipanggil puluhan tes).
- **P14. `bodyLimit` 1 KB untuk detak dan 4 KB untuk `POST /profil` → 413 `terlalu_besar`,** berjalan sebelum autentikasi — pola yang sama dengan `POST /pesan`.
- **P15. `apps/mobile/src/pesan/rute-push.ts` (kode 4c) diubah** untuk menerima `jenis: "radar"`. Alasan: spec §8.3 mewajibkannya secara eksplisit, dan itu lebih spesifik daripada larangan umum §12; perilaku `jenis: "pesan"` tidak berubah (tes lamanya tetap).
- **P16. Kartu radar boleh menampilkan dua lencana sekaligus** (Saling ingin bertemu dan Pernah bertemu). Aturan "hubungan terkuat" spec §6.4 hanya untuk kalimat notifikasi.
- **P17. Keadaan layar Radar di luar tabel spec §8.2:** `tidak_ditemukan` (404), `sesi_tidak_sah` (401), `gagal` (lainnya). `terlalu_cepat` (429) bukan keadaan — layar tetap mengambil radar karena kehadiran dari detak sebelumnya masih berlaku.
- **P18. `apps/api/test/handshake.route.test.ts` ikut mendapat stub `radar`/`profilSaya`** (penambahan saja) karena ia membangun `TrustDeps` sendiri tanpa cast.
- **P19. Indeks tambahan di `0008_radar.sql`** di luar spec §4: `kehadiran (address)` untuk `hapusSemuaKehadiran`, `kehadiran (seen_at)` dan `notif_kedekatan (sent_at)` untuk sapuan.
- **P20. Contoh nama samaran `0xghost` di spec induk (§3, §7.4, §10.3) ikut diganti `0xanon`.** Alasan: keputusan #7 menuntut istilah "ghost" hilang dari spec; nama samaran yang sama persis dengan istilah mode lama membuat grep verifikasi tidak bisa membedakan keduanya.
- **P21. Nama yang disimpan adalah hasil `trim()`, sedangkan yang ditandatangani adalah nama apa adanya;** HP selalu mengirim nama yang sudah di-trim sehingga keduanya sama pada jalur normal.

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/profil.ts` | `VISIBILITAS`, tipe EIP-712 `AturProfil`, typed data, recover |
| `packages/shared/src/nama-tampilan.ts` | Aturan nama murni: trim, 32 code point, tabel Cc/Cf |
| `packages/shared/src/schema.ts` (tambah di akhir) | `DetakRequestSchema`, `AturProfilRequestSchema` |
| `packages/shared/src/index.ts` (tambah di akhir) | Ekspor dua berkas baru |
| `packages/shared/test/typehash-semua.test.ts` (ubah) | 24 → 25 |
| `supabase/migrations/0008_radar.sql` | `profiles.visibilitas`, `kehadiran`, `notif_kedekatan`, sel offer nullable |
| `apps/api/src/db.ts`, `apps/api/src/event-store.ts` (ubah) | `cell = null` → `""` |
| `apps/api/src/ports.ts` (tambah di akhir) | `RadarStore`, `ProfilSayaStore`, `METODE_*`, `RadarDeps`, `ProfilDeps` |
| `apps/api/src/radar-store.ts` | Supabase: kehadiran, notif_kedekatan, baca connections, `sapuLokasi` |
| `apps/api/src/profil-store.ts` | Supabase: nama & visibilitas |
| `apps/api/src/penyapu-lokasi.ts` | Sapuan aman (tidak pernah melempar) + pembatas 10 menit |
| `apps/api/tools/sapu-lokasi.ts` | CLI sapuan untuk pemilik project / cron VPS |
| `apps/api/src/radar-gate.ts` | Gerbang detak & radar |
| `apps/api/src/radar-notif.ts` | Notifikasi kedekatan, tidak pernah melempar |
| `apps/api/src/profil-gate.ts` | Gerbang `POST /profil`, baca profil saya |
| `apps/api/src/baca-request-sesi.ts` | Baca request untuk autentikasi sesi (salinan P5) |
| `apps/api/src/routes/radar.ts`, `routes/profil.ts` | Rute |
| `apps/api/src/app.ts`, `index.ts` (tambah di akhir) | Perakitan + sapuan saat mulai |
| `apps/api/test/support/dunia-radar.ts` | Dunia radar di memori |
| `apps/api/test/support/supabase-memori.ts` | Supabase di memori yang MENJALANKAN kueri (tes privasi) |
| `apps/api/test/support/deps.ts`, `test/handshake.route.test.ts` (tambah) | Stub `radar`/`profilSaya` |
| `apps/mobile/src/radar/radar-api.ts` | `postDetak`, `getRadar`, `getProfilSaya`, `simpanProfil` |
| `apps/mobile/src/messages.ts` (tambah di akhir) | Kalimat keadaan radar, lencana, penghitung nama, galat profil |
| `apps/mobile/src/pesan/rute-push.ts` (ubah) | `jenis: "radar"` → `/radar/<eventId>` |
| `apps/mobile/app/profil-saya.tsx` | Layar Profil saya |
| `apps/mobile/app/radar/[eventId].tsx` | Layar Radar |
| `apps/mobile/app/_layout.tsx`, `index.tsx`, `events/[id].tsx`, `app.json` (ubah) | Judul, tautan, tombol, izin lokasi |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Amandemen spec §13 |

---

## Task 1: Tipe EIP-712 `AturProfil`

**Files:**
- Create: `packages/shared/src/profil.ts`
- Modify: `packages/shared/src/index.ts` (tambah di akhir), `packages/shared/test/typehash-semua.test.ts`
- Test: `packages/shared/test/profil.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`; `lihatFeedTypedData`, `lihatBlokirTypedData`, `lihatKecocokanTypedData`, `tandaiDilihatTypedData`, `lihatProfilTypedData`, `inginBertemuTypedData`, `blokirTypedData` (sudah ada).
- Produces:
  - `const VISIBILITAS = ["terlihat", "tersembunyi"] as const`; `type Visibilitas = "terlihat" | "tersembunyi"`
  - `type AturProfilMessage = { who: Address; displayName: string; visibilitas: Visibilitas; expiresAt: bigint }`
  - `const PROFIL_TYPES` (satu kunci: `AturProfil`)
  - `aturProfilTypedData(msg: AturProfilMessage, verifyingContract: Address)`
  - `recoverAturProfilSigner(msg: AturProfilMessage, signature: Hex, verifyingContract: Address): Promise<Address>`

Domain sama dengan `InginBertemu` (`packages/shared/src/meet.ts:90`): `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`. Tipe TULIS, tanpa tipe baca pasangan (R2).

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/profil.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import {
  aturProfilTypedData, blokirTypedData, inginBertemuTypedData, lihatBlokirTypedData,
  lihatFeedTypedData, lihatKecocokanTypedData, lihatProfilTypedData, recoverAturProfilSigner,
  tandaiDilihatTypedData, VISIBILITAS,
} from "../src/index";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const EXP = 1_800_000_000n;

const msg = { who: A.address, displayName: "Budi", visibilitas: "terlihat" as const, expiresAt: EXP };

const sama = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

describe("AturProfil", () => {
  it("pulih ke penandatangannya", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(true);
  });

  it("dompet lain tidak pulih sebagai who", async () => {
    const sig = await B.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(false);
  });

  // Visibilitas ikut ditandatangani. Tanpa itu, siapa pun yang menangkap satu
  // permintaan bisa memutarnya ulang dengan visibilitas dibalik.
  it("menukar visibilitas membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    const dibalik = { ...msg, visibilitas: "tersembunyi" as const };
    expect(sama(await recoverAturProfilSigner(dibalik, sig, VC), A.address)).toBe(false);
  });

  it("mengubah nama membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner({ ...msg, displayName: "Budi " }, sig, VC), A.address)).toBe(false);
  });

  it("domain terikat verifyingContract", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    const lain = "0x0000000000000000000000000000000000000def" as Address;
    expect(sama(await recoverAturProfilSigner(msg, sig, lain), A.address)).toBe(false);
  });

  it("VISIBILITAS persis dua mode", () => {
    expect(VISIBILITAS).toEqual(["terlihat", "tersembunyi"]);
  });
});

/**
 * Ruling 23: nama tipe baca ≠ tulis. AturProfil tidak punya tipe baca
 * pasangan, tapi ia hidup di domain yang SAMA dengan keluarga meet, blokir,
 * dan feed. Tanda tangan dari tipe mana pun di domain itu tidak boleh sah
 * sebagai AturProfil — dan sebaliknya.
 */
describe("AturProfil tidak tertukar dengan tipe lain di domain yang sama", () => {
  const who = A.address;
  const target = B.address;
  const lain = [
    () => lihatFeedTypedData({ who, expiresAt: EXP }, VC),
    () => lihatBlokirTypedData({ who, expiresAt: EXP }, VC),
    () => lihatKecocokanTypedData({ who, expiresAt: EXP }, VC),
    () => tandaiDilihatTypedData({ who, expiresAt: EXP }, VC),
    () => lihatProfilTypedData({ target, who, expiresAt: EXP }, VC),
    () => inginBertemuTypedData({ target, who, ingin: true, expiresAt: EXP }, VC),
    () => blokirTypedData({ target, who, blokir: true, expiresAt: EXP }, VC),
  ];

  it("tanda tangan tipe lain tidak pulih sebagai AturProfil", async () => {
    for (const td of lain) {
      const sig = await A.signTypedData(td() as Parameters<typeof A.signTypedData>[0]);
      expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(false);
    }
  });

  it("tanda tangan AturProfil tidak pulih sebagai tipe lain", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    for (const td of lain) {
      const pulih = await recoverTypedDataAddress({ ...(td() as never as object), signature: sig } as never);
      expect(sama(pulih, A.address)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared exec vitest run test/profil.test.ts`
Expected: FAIL — `aturProfilTypedData` bukan fungsi / tidak diekspor.

- [ ] **Step 3: Buat `packages/shared/src/profil.ts`**

```ts
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/** Satu saklar per akun, bukan per acara (spec 4b+5 §3). Default `terlihat`. */
export const VISIBILITAS = ["terlihat", "tersembunyi"] as const;
export type Visibilitas = (typeof VISIBILITAS)[number];

/**
 * Perintah TULIS: nama tampilan dan visibilitas sekaligus (spec 4b+5 §7.1, R2).
 *
 * Satu tipe untuk keduanya, dengan sengaja. Keduanya selalu dikirim bersama
 * dari layar Profil saya, dan dua tipe terpisah hanya menambah satu popup
 * dompet tanpa menambah keamanan.
 *
 * Tidak ada tipe BACA pasangannya: `GET /profil/saya` diautentikasi header sesi
 * Ed25519 Fase 4c, bukan bukti EIP-712 (R1). Karena itu tidak ada bukti baca
 * yang bisa bocor lewat query string lalu diputar ulang sebagai perintah ini
 * (Ruling 23).
 *
 * TIDAK PERNAH naik on-chain. Nama tampilan dan visibilitas adalah data
 * off-chain milik pengguna.
 */
export type AturProfilMessage = {
  who: Address;
  displayName: string;
  visibilitas: Visibilitas;
  expiresAt: bigint;
};

const TYPES = {
  AturProfil: [
    { name: "who", type: "address" },
    { name: "displayName", type: "string" },
    { name: "visibilitas", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const PROFIL_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function aturProfilTypedData(msg: AturProfilMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { AturProfil: TYPES.AturProfil },
    primaryType: "AturProfil",
    message: msg,
  } as const;
}

export function recoverAturProfilSigner(
  msg: AturProfilMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...aturProfilTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 4: Ekspor dari `packages/shared/src/index.ts`**

Tambahkan SATU baris di akhir berkas (jangan ubah baris lain):

```ts
export * from "./profil";
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared exec vitest run test/profil.test.ts`
Expected: PASS.

- [ ] **Step 6: Perbarui penjaga typehash**

Di `packages/shared/test/typehash-semua.test.ts`:

1. Tambahkan impor tepat di bawah `import { PESAN_TYPES } from "../src/pesan";`:
   ```ts
   import { PROFIL_TYPES } from "../src/profil";
   ```
2. Ganti baris `  ...BLOKIR_TYPES, ...PESAN_TYPES,` di objek `SEMUA` dengan:
   ```ts
     ...BLOKIR_TYPES, ...PESAN_TYPES, ...PROFIL_TYPES,
   ```
3. Ganti dua baris
   ```ts
   // 24 sejak Fase 4c: KunciPesan dan DaftarKunciPesan.
   const JUMLAH_TIPE = 24;
   ```
   dengan
   ```ts
   // 25 sejak Fase 4b + 5: AturProfil.
   const JUMLAH_TIPE = 25;
   ```
4. Ganti baris `      + Object.keys(PESAN_TYPES).length;` di tes "jumlah tipe per keluarga" dengan:
   ```ts
         + Object.keys(PESAN_TYPES).length + Object.keys(PROFIL_TYPES).length;
   ```
5. Tambahkan dua tes ini tepat sebelum `});` penutup `describe` terakhir:
   ```ts
     // AturProfil TIDAK PERNAH naik on-chain (spec 4b+5 §7.1).
     it("tidak ada typehash profil di Solidity mana pun", () => {
       const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
       expect(berkasSol.length).toBeGreaterThan(0);
       for (const berkas of berkasSol) {
         const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
         for (const nama of Object.keys(PROFIL_TYPES)) {
           expect(sumber).not.toContain(`${nama}(`);
         }
       }
     });

     it("encodeType profil persis seperti spec 4b+5 §7.1", () => {
       expect(encodeType("AturProfil", PROFIL_TYPES.AturProfil))
         .toBe("AturProfil(address who,string displayName,string visibilitas,uint64 expiresAt)");
     });
   ```

- [ ] **Step 7: Jalankan seluruh tes dan typecheck shared**

Run: `pnpm --filter @nearly/shared exec vitest run && pnpm --filter @nearly/shared exec tsc --noEmit`
Expected: PASS, tanpa keluaran galat typecheck.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/profil.ts packages/shared/src/index.ts \
  packages/shared/test/profil.test.ts packages/shared/test/typehash-semua.test.ts
git commit -m "feat(shared): tipe EIP-712 AturProfil — nama dan visibilitas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — buktikan penjaga typehash menggigit**

Dijalankan SETELAH commit, supaya setiap mutasi bisa dikembalikan dengan `git checkout -- packages/shared/src/profil.ts`. Jalankan keduanya sungguhan, satu per satu.

**Mutasi A (jalur pertumbuhan):** tambahkan baris `  Uji: [{ name: "x", type: "uint8" }],` tepat setelah `const TYPES = {` di `profil.ts`.
Run: `pnpm --filter @nearly/shared exec vitest run test/typehash-semua.test.ts`
Expected MERAH: `jumlah tipe per keluarga sesuai jumlah yang diharapkan`, `SEMUA tidak kehilangan tipe akibat tabrakan nama lintas keluarga`, `setiap encodeType unik`. Kembalikan: `git checkout -- packages/shared/src/profil.ts`.

**Mutasi B (jalur tabrakan):** ganti kunci `  AturProfil: [` di `TYPES` menjadi `  LihatFeed: [`.
Run: perintah yang sama.
Expected: `jumlah tipe per keluarga …` TETAP hijau, tetapi MERAH: `SEMUA tidak kehilangan tipe akibat tabrakan nama lintas keluarga`, `setiap encodeType unik`, `encodeType profil persis seperti spec 4b+5 §7.1`. Kembalikan: `git checkout -- packages/shared/src/profil.ts`.

Run ulang: `pnpm --filter @nearly/shared exec vitest run test/typehash-semua.test.ts` → PASS. Lalu `git status --short` → WAJIB kosong. Rekam nama tes merah kedua mutasi di laporan task.

---

## Task 2: Aturan nama tampilan dan skema Zod radar/profil

**Files:**
- Create: `packages/shared/src/nama-tampilan.ts`
- Modify: `packages/shared/src/schema.ts` (satu impor + tambah di akhir), `packages/shared/src/index.ts` (tambah di akhir)
- Test: `packages/shared/test/nama-tampilan.test.ts`, `packages/shared/test/schema-radar.test.ts`

**Interfaces:**
- Consumes: `VISIBILITAS` dari `packages/shared/src/profil.ts` (Task 1); `cell`, `address`, `signature`, `unixSeconds` (privat di `schema.ts`, sudah ada).
- Produces:
  - `const MAKS_NAMA_TAMPILAN = 32`
  - `const RENTANG_KONTROL_FORMAT: readonly (readonly [number, number])[]`
  - `karakterTerlarang(codePoint: number): boolean`
  - `panjangNamaTampilan(nama: string): number` — code point setelah trim
  - `type HasilNamaTampilan = { ok: true; nama: string } | { ok: false; alasan: "terlalu_panjang" | "karakter_terlarang" }`
  - `periksaNamaTampilan(masukan: string): HasilNamaTampilan`
  - `DetakRequestSchema` — `{ cell }`
  - `AturProfilRequestSchema` — `{ who, displayName (≤256 mentah), visibilitas, expiresAt, sig }`

- [ ] **Step 1: Tulis tes nama yang gagal**

`packages/shared/test/nama-tampilan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  karakterTerlarang, MAKS_NAMA_TAMPILAN, panjangNamaTampilan, periksaNamaTampilan,
} from "../src/index";

describe("periksaNamaTampilan", () => {
  it("nama biasa sah dan dikembalikan setelah trim", () => {
    expect(periksaNamaTampilan("  Budi Santoso  ")).toEqual({ ok: true, nama: "Budi Santoso" });
  });

  // Nama kosong adalah cara menghapus nama (spec 4b+5 §7.2).
  it("nama kosong dan nama spasi saja sah, menjadi string kosong", () => {
    expect(periksaNamaTampilan("")).toEqual({ ok: true, nama: "" });
    expect(periksaNamaTampilan("    ")).toEqual({ ok: true, nama: "" });
  });

  it("tepat batas code point sah, satu lebih ditolak", () => {
    expect(MAKS_NAMA_TAMPILAN).toBe(32);
    expect(periksaNamaTampilan("a".repeat(32))).toEqual({ ok: true, nama: "a".repeat(32) });
    expect(periksaNamaTampilan("a".repeat(33))).toEqual({ ok: false, alasan: "terlalu_panjang" });
  });

  // 👍 adalah DUA unit UTF-16 tapi SATU code point. Menghitung `.length` akan
  // menolak 32 emoji yang sah.
  it("emoji dihitung per code point, bukan per unit UTF-16", () => {
    const emoji = "👍".repeat(32);
    expect(emoji.length).toBe(64);
    expect(periksaNamaTampilan(emoji)).toEqual({ ok: true, nama: emoji });
    expect(periksaNamaTampilan("👍".repeat(33))).toEqual({ ok: false, alasan: "terlalu_panjang" });
  });

  it("spasi di tepi tidak ikut dihitung", () => {
    expect(periksaNamaTampilan(`  ${"a".repeat(32)}  `).ok).toBe(true);
  });

  it("penanda arah U+202E ditolak", () => {
    expect(periksaNamaTampilan("Budi‮gnp.exe")).toEqual({ ok: false, alasan: "karakter_terlarang" });
  });

  it("karakter lebar-nol U+200B ditolak", () => {
    expect(periksaNamaTampilan("Bu​di")).toEqual({ ok: false, alasan: "karakter_terlarang" });
  });

  it("isolat arah U+2066–U+2069 dan kontrol baris baru ditolak", () => {
    for (const ch of ["⁦", "⁧", "⁨", "⁩", "\n", " ", ""]) {
      expect(periksaNamaTampilan(`a${ch}b`)).toEqual({ ok: false, alasan: "karakter_terlarang" });
    }
  });

  it("surrogate tunggal ditolak", () => {
    expect(periksaNamaTampilan("a\uD800b")).toEqual({ ok: false, alasan: "karakter_terlarang" });
  });

  it("karakter terlarang di tepi yang TIDAK dibuang trim tetap ditolak", () => {
    expect(periksaNamaTampilan("‮Budi")).toEqual({ ok: false, alasan: "karakter_terlarang" });
  });

  it("aksara non-Latin sah", () => {
    expect(periksaNamaTampilan("ブディ").ok).toBe(true);
    expect(periksaNamaTampilan("Буди").ok).toBe(true);
  });
});

describe("panjangNamaTampilan", () => {
  it("menghitung code point setelah trim", () => {
    expect(panjangNamaTampilan("  👍a ")).toBe(2);
    expect(panjangNamaTampilan("")).toBe(0);
  });
});

describe("karakterTerlarang", () => {
  // Tabel eksplisit dipakai karena Hermes. Tes ini memastikan tabelnya PERSIS
  // `\p{Cc}|\p{Cf}` versi Unicode milik Node, untuk setiap code point.
  it("sama persis dengan \\p{Cc}|\\p{Cf} untuk setiap code point non-surrogate", () => {
    const re = /^[\p{Cc}\p{Cf}]$/u;
    const beda: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (karakterTerlarang(cp) !== re.test(String.fromCodePoint(cp))) beda.push(cp.toString(16));
      if (beda.length > 5) break;
    }
    expect(beda).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/shared exec vitest run test/nama-tampilan.test.ts`
Expected: FAIL — `periksaNamaTampilan` tidak diekspor.

- [ ] **Step 3: Buat `packages/shared/src/nama-tampilan.ts`**

```ts
/**
 * Aturan nama tampilan (spec 4b+5 §7.2). Satu fungsi murni, dipakai API dan
 * layar mobile, supaya kedua sisi tidak berselisih soal nama yang sah.
 *
 * Nama TIDAK unik (spec induk §9.2) — alamat selalu tampil di sebelahnya.
 */
export const MAKS_NAMA_TAMPILAN = 32;

/**
 * Rentang code point kategori Unicode `Cc` (kontrol) dan `Cf` (format),
 * Unicode 17.0 — termasuk penanda arah teks (U+202A–U+202E, U+2066–U+2069)
 * dan karakter lebar-nol (U+200B–U+200F). Karakter itu bisa membalik urutan
 * tampilan di sebelah alamat dan dipakai menyamar.
 *
 * Tabel eksplisit, BUKAN `/\p{Cc}|\p{Cf}/u`: fungsi ini juga jalan di Hermes
 * (Expo Go), dan regex yang tidak didukung mesin JS di HP gagal saat bundel
 * dimuat — seluruh aplikasi mati, bukan hanya layar ini. Tes
 * `nama-tampilan.test.ts` membandingkan tabel ini dengan `\p{Cc}|\p{Cf}` milik
 * Node untuk SETIAP code point, jadi tabel yang tertinggal dari Unicode
 * versi Node akan memerahkan tes.
 */
export const RENTANG_KONTROL_FORMAT: readonly (readonly [number, number])[] = [
  [0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x600, 0x605], [0x61c, 0x61c],
  [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891], [0x8e2, 0x8e2], [0x180e, 0x180e],
  [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f],
  [0xfeff, 0xfeff], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd],
  [0x13430, 0x1343f], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a], [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
];

export function karakterTerlarang(codePoint: number): boolean {
  // Surrogate tunggal (U+D800–U+DFFF) tidak bisa disimpan Postgres sebagai
  // teks; tanpa penolakan ini ia lolos ke upsert dan menjadi 500.
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return true;
  return RENTANG_KONTROL_FORMAT.some(([dari, sampai]) => codePoint >= dari && codePoint <= sampai);
}

/** Panjang nama SETELAH trim, dalam code point — emoji 👍 dihitung satu. */
export function panjangNamaTampilan(nama: string): number {
  return [...nama.trim()].length;
}

export type HasilNamaTampilan =
  | { ok: true; nama: string }
  | { ok: false; alasan: "terlalu_panjang" | "karakter_terlarang" };

/** Nama kosong SAH — itu cara menghapus nama. */
export function periksaNamaTampilan(masukan: string): HasilNamaTampilan {
  const nama = masukan.trim();
  for (const ch of nama) {
    if (karakterTerlarang(ch.codePointAt(0)!)) return { ok: false, alasan: "karakter_terlarang" };
  }
  if ([...nama].length > MAKS_NAMA_TAMPILAN) return { ok: false, alasan: "terlalu_panjang" };
  return { ok: true, nama };
}
```

Tambahkan SATU baris di akhir `packages/shared/src/index.ts`:

```ts
export * from "./nama-tampilan";
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `pnpm --filter @nearly/shared exec vitest run test/nama-tampilan.test.ts`
Expected: PASS (tes perbandingan seluruh code point selesai dalam < 1 detik).

- [ ] **Step 5: Tulis tes skema yang gagal**

`packages/shared/test/schema-radar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AturProfilRequestSchema, DetakRequestSchema } from "../src/schema";

const ALAMAT = "0x000000000000000000000000000000000000bEEF";
const SIG = `0x${"11".repeat(65)}`;

describe("DetakRequestSchema", () => {
  it("menerima sel geohash7", () => {
    expect(DetakRequestSchema.safeParse({ cell: "qqguv1r" }).success).toBe(true);
  });
  it("menolak sel yang bukan geohash7", () => {
    for (const cell of ["qqguv1", "qqguv1rr", "QQGUV1R", "qqguv1a", ""]) {
      expect(DetakRequestSchema.safeParse({ cell }).success).toBe(false);
    }
  });
  it("menolak badan tanpa sel", () => {
    expect(DetakRequestSchema.safeParse({}).success).toBe(false);
    expect(DetakRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe("AturProfilRequestSchema", () => {
  const sah = { who: ALAMAT, displayName: "Budi", visibilitas: "terlihat", expiresAt: "1800000000", sig: SIG };
  it("menerima badan sah", () => expect(AturProfilRequestSchema.safeParse(sah).success).toBe(true));
  it("menolak visibilitas di luar dua mode", () => {
    for (const visibilitas of ["hantu", "ghost", "TERLIHAT", ""]) {
      expect(AturProfilRequestSchema.safeParse({ ...sah, visibilitas }).success).toBe(false);
    }
  });
  // Aturan nama sengaja di gerbang, bukan di skema (lihat komentar skema).
  it("TIDAK menolak nama bidi atau 33 code point — itu tugas gerbang", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a‮b" }).success).toBe(true);
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a".repeat(33) }).success).toBe(true);
  });
  it("menolak nama mentah lebih dari 256 karakter", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a".repeat(257) }).success).toBe(false);
  });
  it("menolak expiresAt bukan angka", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, expiresAt: "besok" }).success).toBe(false);
  });
});
```

Run: `pnpm --filter @nearly/shared exec vitest run test/schema-radar.test.ts`
Expected: FAIL — `DetakRequestSchema` undefined.

- [ ] **Step 6: Tambahkan skema ke `packages/shared/src/schema.ts`**

1. Tambahkan impor tepat di bawah baris `import { MAKS_ISI_PESAN } from "./pesan-kripto";`:
   ```ts
   import { VISIBILITAS } from "./profil";
   ```
2. Tambahkan di AKHIR berkas:

```ts
// ── Fase 4b + 5: radar dan profil ───────────────────────────────────────────

/** Badan `POST /radar/:eventId/detak`. Hanya sel geohash7 — tidak pernah koordinat. */
export const DetakRequestSchema = z.object({ cell });

/**
 * Badan `POST /profil`. `displayName` hanya dibatasi panjang MENTAH di sini,
 * sebagai penahan badan raksasa. Aturan nama yang sebenarnya (32 code point,
 * tanpa Cc/Cf) ditegakkan gerbang lewat `periksaNamaTampilan`, SETELAH tanda
 * tangan — kalau skema ikut menolaknya, 400 `nama_tidak_sah` tidak pernah
 * terjangkau dan urutan gerbang spec 4b+5 §7.2 berbohong.
 */
export const AturProfilRequestSchema = z.object({
  who: address,
  displayName: z.string().max(256),
  visibilitas: z.enum(VISIBILITAS),
  expiresAt: unixSeconds,
  sig: signature,
});
```

- [ ] **Step 7: Jalankan seluruh tes dan typecheck shared**

Run: `pnpm --filter @nearly/shared exec vitest run && pnpm --filter @nearly/shared exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/nama-tampilan.ts packages/shared/src/schema.ts packages/shared/src/index.ts \
  packages/shared/test/nama-tampilan.test.ts packages/shared/test/schema-radar.test.ts
git commit -m "feat(shared): aturan nama tampilan dan skema detak/profil

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — tabel arah teks**

Setelah commit: hapus entri `[0x202a, 0x202e], ` dari `RENTANG_KONTROL_FORMAT` di `packages/shared/src/nama-tampilan.ts`.
Run: `pnpm --filter @nearly/shared exec vitest run test/nama-tampilan.test.ts`
Expected MERAH: `penanda arah U+202E ditolak`, `karakter terlarang di tepi yang TIDAK dibuang trim tetap ditolak`, `sama persis dengan \p{Cc}|\p{Cf} untuk setiap code point non-surrogate`. Kembalikan: `git checkout -- packages/shared/src/nama-tampilan.ts`; jalankan ulang → PASS; `git status --short` → WAJIB kosong.

---

## Task 3: Migrasi `0008_radar.sql`

**Files:**
- Create: `supabase/migrations/0008_radar.sql`

**Interfaces:**
- Consumes: tabel `profiles` (0001), `events` (0003), `handshake_offers` (0001), `checkin_offers` (0003).
- Produces (dipakai Task 6–8): kolom `profiles.visibilitas text not null default 'terlihat'`; tabel `kehadiran(event_id, address, cell, seen_at)` PK `(event_id, address)`; tabel `notif_kedekatan(event_id, penerima, subjek, sent_at)` PK `(event_id, penerima, subjek)`; `handshake_offers.cell` dan `checkin_offers.cell` boleh null.

**Migrasi ini DITULIS, TIDAK DITERAPKAN.** Pemilik project yang menerapkannya (Task 16 Step 5).

- [ ] **Step 1: Buat `supabase/migrations/0008_radar.sql`**

```sql
-- Nearly Fase 4b + 5: radar, visibilitas, notifikasi kedekatan
-- (docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md §4).
--
-- Diterapkan PEMILIK PROJECT, bukan sesi eksekusi. Semua kolom alamat huruf
-- kecil saja, dengan `~` bukan operator case-insensitive (pelajaran Fase 3b).
-- RLS menyala tanpa policy di setiap tabel baru: API memakai service role.

-- §4.1 Satu saklar per akun. Default `terlihat` (keputusan #2).
alter table profiles
  add column if not exists visibilitas text not null default 'terlihat'
    check (visibilitas in ('terlihat', 'tersembunyi'));

-- §4.2 Satu baris per (acara, orang), di-upsert setiap detak. BUKAN riwayat:
-- detak baru menimpa yang lama, jadi tabel ini tidak pernah bisa
-- merekonstruksi jalur gerak seseorang. `cell` hanya untuk memeriksa geofence
-- detak berikutnya, dan ikut terhapus bersama barisnya ≤ 24 jam.
create table if not exists kehadiran (
  event_id text not null references events(event_id) on delete cascade,
  address  text not null check (address ~ '^0x[0-9a-f]{40}$'),
  cell     char(7) not null,
  seen_at  timestamptz not null default now(),
  primary key (event_id, address)
);
create index if not exists kehadiran_event_seen on kehadiran (event_id, seen_at);
-- Pindah ke Tersembunyi menghapus SEMUA baris milik satu alamat.
create index if not exists kehadiran_address on kehadiran (address);
alter table kehadiran enable row level security;

-- §4.3 Dasar "sekali per pasangan per acara" dan batas 5 per orang per acara.
-- Setiap baris membuktikan dua orang berada di acara yang sama pada jam itu,
-- jadi tabel ini data lokasi dan ikut dihapus ≤ 24 jam.
create table if not exists notif_kedekatan (
  event_id text not null references events(event_id) on delete cascade,
  penerima text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
  subjek   text not null check (subjek ~ '^0x[0-9a-f]{40}$'),
  sent_at  timestamptz not null default now(),
  primary key (event_id, penerima, subjek)
);
create index if not exists notif_kedekatan_penerima on notif_kedekatan (event_id, penerima);
alter table notif_kedekatan enable row level security;

-- §4.4 Barisnya TIDAK dihapus — hanya selnya dikosongkan. Keberadaan baris QR
-- yang menolak nonce dipakai ulang (handshake-gate.ts `nonce_used`,
-- event-gate.ts). Menghapus baris membuka replay; mengosongkan sel tidak.
alter table handshake_offers alter column cell drop not null;
alter table checkin_offers   alter column cell drop not null;

-- Penyapuan (§4.5) mencari `seen_at` / `sent_at` / `expires_at` lama.
create index if not exists kehadiran_seen on kehadiran (seen_at);
create index if not exists notif_kedekatan_sent on notif_kedekatan (sent_at);
-- `handshake_offers_expiry` dan `checkin_offers_expiry` sudah ada sejak 0001/0003.
```

- [ ] **Step 2: Periksa bentuknya tanpa database**

Jalankan setiap perintah dan laporkan keluarannya apa adanya:

```bash
ls supabase/migrations                                                   # hanya 0001–0008, tidak ada 0009
grep -c "enable row level security" supabase/migrations/0008_radar.sql     # 2
grep -n "~\*" supabase/migrations/0008_radar.sql                          # WAJIB kosong (exit 1)
grep -n "create policy" supabase/migrations/0008_radar.sql                # WAJIB kosong (exit 1)
grep -n "drop table\|delete from\|truncate" supabase/migrations/0008_radar.sql   # WAJIB kosong (exit 1)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_radar.sql
git commit -m "feat(db): migrasi 0008 — visibilitas, kehadiran, notif_kedekatan, sel offer nullable

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Pemetaan sel offer null, dan offer bersel kosong tidak pernah sukses

**Files:**
- Modify: `apps/api/src/db.ts` (tipe `OfferRow` dan `rowToOffer`), `apps/api/src/event-store.ts` (tipe `OfferDbRow` dan `rowToCheckInOffer`)
- Test: `apps/api/test/offer-sel-kosong.test.ts`

**Interfaces:**
- Consumes: `rowToOffer` (`apps/api/src/db.ts`), `rowToCheckInOffer` (`apps/api/src/event-store.ts`), `acceptHandshake`, `submitOffer` (`handshake-gate.ts`), `acceptCheckIn`, `submitCheckInOffer` (`event-gate.ts`).
- Produces: `rowToOffer` dan `rowToCheckInOffer` menerima `cell: string | null` dan mengembalikan `cell: ""` untuk null. Tipe `PendingOffer.cell` / `PendingCheckInOffer.cell` di `ports.ts` TETAP `string`.

**`handshake-gate.ts` dan `event-gate.ts` TIDAK disentuh** — tes ini membuktikan gerbang yang ada sudah menolak offer tersapu.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/offer-sel-kosong.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  acceptTypedData, checkInAcceptTypedData, checkInOfferTypedData, offerTypedData,
} from "@nearly/shared";
import { rowToOffer } from "../src/db";
import { rowToCheckInOffer } from "../src/event-store";
import { acceptHandshake, submitOffer } from "../src/handshake-gate";
import { acceptCheckIn, submitCheckInOffer } from "../src/event-gate";
import type { PendingCheckInOffer, PendingOffer } from "../src/ports";

/**
 * Offer yang selnya sudah dikosongkan `sapuLokasi` (spec 4b+5 §4.4) TIDAK
 * PERNAH menghasilkan sukses di gerbang salaman maupun check-in — dan gerbangnya
 * sendiri tidak diubah. Offer dibangun lewat pemeta store SUNGGUHAN dari baris
 * `cell: null`, persis bentuk yang dikembalikan Supabase setelah sapuan.
 */
const NOW = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW / 1000);
const HARI_DETIK = 86_400;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const CELL = "qqguv1r";
const A = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const B = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

function offerSalamanTersapu(expiresAtDetik: number, consumed = false): PendingOffer {
  return rowToOffer({
    nonce: NONCE, initiator: A.address.toLowerCase(), expires_at: String(expiresAtDetik),
    sig_offer: `0x${"22".repeat(65)}`, cell: null, at_ms: String(NOW),
    consumed_at: consumed ? "2026-09-13T00:00:00Z" : null,
  });
}

function offerCheckInTersapu(expiresAtDetik: number, consumed = false): PendingCheckInOffer {
  return rowToCheckInOffer({
    nonce: NONCE, event_id: EVENT_ID, host: A.address.toLowerCase(), expires_at: String(expiresAtDetik),
    sig_host: `0x${"33".repeat(65)}`, cell: null, at_ms: String(NOW),
    consumed_at: consumed ? "2026-09-13T00:00:00Z" : null,
  });
}

function depsSalaman(offer: PendingOffer) {
  return {
    verifyingContract: VC,
    nowMs: () => NOW,
    store: {
      putOffer: vi.fn(async () => {}),
      getOffer: vi.fn(async () => offer),
      consumeOffer: vi.fn(async () => {}),
      areConnected: vi.fn(async () => false),
      countConnectionsSince: vi.fn(async () => 0),
      recordConnection: vi.fn(async () => {}),
    },
    chain: { submitConnect: vi.fn(async () => `0x${"ab".repeat(32)}` as Hex) },
  } as never;
}

function depsCheckIn(offer: PendingCheckInOffer) {
  return {
    events: {
      getEvent: vi.fn(async () => ({
        eventId: EVENT_ID, host: A.address, title: "t", venueLabel: "", centerCell: CELL,
        startsAt: BigInt(NOW_SEC - 600), endsAt: BigInt(NOW_SEC + 3600), txHash: "0xtx",
      })),
      hasRsvp: vi.fn(async () => true),
      hasCheckIn: vi.fn(async () => false),
      getCheckInOffer: vi.fn(async () => offer),
      putCheckInOffer: vi.fn(async () => {}),
      consumeCheckInOffer: vi.fn(async () => {}),
      recordCheckIn: vi.fn(async () => {}),
    },
    attendance: { submitCheckIn: vi.fn(async () => "0xtx" as Hex) },
    profiles: {},
    attendanceContract: VC,
    nowMs: () => NOW,
  } as never;
}

async function terimaSalaman(offer: PendingOffer) {
  const acc = { initiator: A.address, counterparty: B.address, nonce: NONCE, expiresAt: offer.expiresAt };
  const deps = depsSalaman(offer);
  const hasil = await acceptHandshake({
    ...acc, sigAccept: await B.signTypedData(acceptTypedData(acc, VC)), cell: CELL, atMs: NOW,
  }, deps);
  return { hasil, deps: deps as { chain: { submitConnect: ReturnType<typeof vi.fn> } } };
}

async function terimaCheckIn(offer: PendingCheckInOffer) {
  const msg = { eventId: EVENT_ID, nonce: NONCE, attendee: B.address, expiresAt: offer.expiresAt };
  const deps = depsCheckIn(offer);
  const hasil = await acceptCheckIn({
    ...msg, sigAttendee: await B.signTypedData(checkInAcceptTypedData(msg, VC)), cell: CELL, atMs: NOW,
  }, deps);
  return { hasil, deps: deps as { attendance: { submitCheckIn: ReturnType<typeof vi.fn> } } };
}

describe("pemetaan store menerima sel null", () => {
  it("rowToOffer: cell null → string kosong", () => {
    expect(offerSalamanTersapu(NOW_SEC).cell).toBe("");
  });
  it("rowToCheckInOffer: cell null → string kosong", () => {
    expect(offerCheckInTersapu(NOW_SEC).cell).toBe("");
  });
});

describe("offer salaman bersel kosong tidak pernah sukses", () => {
  it("hasil sapuan (kedaluwarsa > 24 jam) → 410 expired, chain tidak dipanggil", async () => {
    const { hasil, deps } = await terimaSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1));
    expect(hasil).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(deps.chain.submitConnect).not.toHaveBeenCalled();
  });

  it("hasil sapuan yang sudah terpakai → 409 offer_consumed", async () => {
    const { hasil } = await terimaSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1, true));
    expect(hasil).toEqual({ ok: false, failure: { code: "offer_consumed", httpStatus: 409 } });
  });

  // Defensif: di dunia nyata sel hanya kosong setelah kedaluwarsa > 24 jam.
  it("bahkan bila belum kedaluwarsa, sel kosong → 422 not_colocated", async () => {
    const { hasil, deps } = await terimaSalaman(offerSalamanTersapu(NOW_SEC + 30));
    expect(hasil).toEqual({ ok: false, failure: { code: "not_colocated", reason: "cell_too_far", httpStatus: 422 } });
    expect(deps.chain.submitConnect).not.toHaveBeenCalled();
  });

  // Inilah alasan barisnya DIPERTAHANKAN: nonce tetap tidak bisa dipakai ulang.
  it("nonce offer tersapu tetap ditolak 409 nonce_used", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: BigInt(NOW_SEC + 30) };
    const hasil = await submitOffer({
      ...offer, sigOffer: await A.signTypedData(offerTypedData(offer, VC)), cell: CELL, atMs: NOW,
    }, depsSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1)));
    expect(hasil).toEqual({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });
});

describe("offer check-in bersel kosong tidak pernah sukses", () => {
  it("hasil sapuan (kedaluwarsa > 24 jam) → 410 expired, chain tidak dipanggil", async () => {
    const { hasil, deps } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1));
    expect(hasil).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(deps.attendance.submitCheckIn).not.toHaveBeenCalled();
  });

  it("hasil sapuan yang sudah terpakai → 409 offer_consumed", async () => {
    const { hasil } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1, true));
    expect(hasil).toEqual({ ok: false, failure: { code: "offer_consumed", httpStatus: 409 } });
  });

  it("bahkan bila belum kedaluwarsa, sel kosong → 422 not_colocated", async () => {
    const { hasil, deps } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC + 30));
    expect(hasil).toEqual({ ok: false, failure: { code: "not_colocated", reason: "cell_too_far", httpStatus: 422 } });
    expect(deps.attendance.submitCheckIn).not.toHaveBeenCalled();
  });

  it("nonce offer check-in tersapu tetap ditolak 409 nonce_used", async () => {
    const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt: BigInt(NOW_SEC + 30) };
    const hasil = await submitCheckInOffer({
      ...msg, host: A.address, sigHost: await A.signTypedData(checkInOfferTypedData(msg, VC)), cell: CELL, atMs: NOW,
    }, depsCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1)));
    expect(hasil).toEqual({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/offer-sel-kosong.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: FAIL — setidaknya `rowToOffer: cell null → string kosong` dan `rowToCheckInOffer: cell null → string kosong` MERAH (`null` bukan `""`); typecheck juga gagal di `offer-sel-kosong.test.ts` karena `cell: null` tidak cocok dengan `string`.

- [ ] **Step 3: Ubah `apps/api/src/db.ts`**

Ganti blok tipe

```ts
type OfferRow = {
  nonce: string; initiator: string; expires_at: string | number;
  sig_offer: string; cell: string; at_ms: string | number; consumed_at: string | null;
};
```

dengan

```ts
type OfferRow = {
  nonce: string; initiator: string; expires_at: string | number;
  sig_offer: string;
  /** null setelah `sapuLokasi` mengosongkannya (migrasi 0008, spec 4b+5 §4.4). */
  cell: string | null;
  at_ms: string | number; consumed_at: string | null;
};
```

dan di `rowToOffer` ganti baris `    cell: row.cell,` dengan

```ts
    // Sel yang sudah disapu menjadi string kosong. Gerbang tidak diubah: offer
    // bersel kosong pasti sudah kedaluwarsa > 24 jam dan ditolak lebih dulu.
    cell: row.cell ?? "",
```

- [ ] **Step 4: Ubah `apps/api/src/event-store.ts`**

Ganti blok tipe

```ts
export type OfferDbRow = {
  nonce: string; event_id: string; host: string; expires_at: string | number;
  sig_host: string; cell: string; at_ms: string | number; consumed_at: string | null;
};
```

dengan

```ts
export type OfferDbRow = {
  nonce: string; event_id: string; host: string; expires_at: string | number;
  sig_host: string;
  /** null setelah `sapuLokasi` mengosongkannya (migrasi 0008, spec 4b+5 §4.4). */
  cell: string | null;
  at_ms: string | number; consumed_at: string | null;
};
```

dan di `rowToCheckInOffer` ganti baris `    cell: row.cell,` dengan

```ts
    // Sel yang sudah disapu menjadi string kosong (lihat rowToOffer di db.ts).
    cell: row.cell ?? "",
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/offer-sel-kosong.test.ts test/db-mapping.test.ts test/event-store-mapping.test.ts test/handshake-gate.test.ts test/event-gate-checkin.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Pastikan gerbang tidak tersentuh**

Run: `git diff --stat -- apps/api/src/handshake-gate.ts apps/api/src/event-gate.ts`
Expected: kosong.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db.ts apps/api/src/event-store.ts apps/api/test/offer-sel-kosong.test.ts
git commit -m "feat(api): sel offer yang disapu dipetakan ke string kosong

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Port radar dan profil

**Files:**
- Modify: `apps/api/src/ports.ts` (tambah di AKHIR berkas saja)
- Test: `apps/api/test/radar-ports.test.ts`

**Interfaces:**
- Consumes: `Visibilitas` dari `@nearly/shared` (Task 1); `EventStore`, `BlokirStore`, `MeetStore`, `PesanStore`, `PushPort` (sudah ada di `ports.ts`).
- Produces (dipakai Task 6–12):
  - `type BarisKehadiran = { cell: string; seenAtMs: number }`
  - `type HasilSapuLokasi = { kehadiran: number; notifKedekatan: number; offerSalaman: number; offerCheckIn: number }`
  - `type RadarStore` — `ambilKehadiran(eventId: Hex, address: Address): Promise<BarisKehadiran | null>`, `simpanKehadiran(eventId: Hex, address: Address, cell: string, seenAtMs: number): Promise<void>`, `hapusKehadiran(eventId: Hex, address: Address): Promise<void>`, `hapusSemuaKehadiran(address: Address): Promise<void>`, `hadirSejak(eventId: Hex, sejakMs: number): Promise<Address[]>`, `terhubungDengan(who: Address, kandidat: Address[]): Promise<Set<string>>`, `hitungNotifKedekatan(eventId: Hex, penerima: Address): Promise<number>`, `sisipNotifKedekatan(eventId: Hex, penerima: Address, subjek: Address): Promise<boolean>`, `sapuLokasi(nowMs: number): Promise<HasilSapuLokasi>`
  - `const METODE_RADAR_STORE`
  - `type ProfilSaya = { displayName: string; visibilitas: Visibilitas }`
  - `type ProfilSayaStore` — `profilSaya(address): Promise<ProfilSaya>`, `aturProfil(address, profil: ProfilSaya): Promise<void>`, `visibilitasBanyak(addresses: Address[]): Promise<Map<string, Visibilitas>>`
  - `const METODE_PROFIL_SAYA_STORE`
  - `type RadarDeps = { radar: RadarStore; profilSaya: Pick<ProfilSayaStore, "visibilitasBanyak">; events: Pick<EventStore, "getEvent" | "hasCheckIn">; blokir: Pick<BlokirStore, "himpunanUntuk">; meet: Pick<MeetStore, "tandaOleh" | "tandaKe" | "profilRingkas">; pesan: Pick<PesanStore, "ambilKunci" | "tokenPush" | "hapusTokenPush">; push: PushPort | null; nowMs: () => number }`
  - `type ProfilDeps = { profilSaya: ProfilSayaStore; radar: Pick<RadarStore, "hapusSemuaKehadiran">; pesan: Pick<PesanStore, "ambilKunci">; verifyingContract: Address; nowMs: () => number }`

`TrustDeps` di `app.ts` BELUM diubah di task ini (Task 12) — menambah medan ke sana sekarang akan membuat stub `deps.ts` gagal kompilasi sebelum store-nya ada.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/radar-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_PROFIL_SAYA_STORE, METODE_RADAR_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode harus jadi tindakan sadar, karena
 * dunia-radar.ts dan fake di support/deps.ts ikut berubah. Judul tanpa jumlah.
 */
describe("bentuk RadarStore dan ProfilSayaStore", () => {
  it("daftar metode RadarStore persis seperti yang tercatat", () => {
    expect(METODE_RADAR_STORE).toEqual([
      "ambilKehadiran", "simpanKehadiran", "hapusKehadiran", "hapusSemuaKehadiran",
      "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
      "sapuLokasi",
    ]);
  });

  it("daftar metode ProfilSayaStore persis seperti yang tercatat", () => {
    expect(METODE_PROFIL_SAYA_STORE).toEqual(["profilSaya", "aturProfil", "visibilitasBanyak"]);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar-ports.test.ts`
Expected: FAIL — `METODE_RADAR_STORE` undefined.

- [ ] **Step 2: Tambahkan port di AKHIR `apps/api/src/ports.ts`**

Jangan ubah atau pindahkan baris mana pun yang sudah ada. Tempel blok ini setelah baris terakhir berkas (`};` penutup `PesanDeps`):

```ts
// ── Fase 4b + 5: radar, visibilitas, notifikasi kedekatan ──────────────────

import type { Visibilitas } from "@nearly/shared";

/** Satu baris `kehadiran`. `seenAtMs` MILIDETIK. */
export type BarisKehadiran = { cell: string; seenAtMs: number };

/** Jumlah baris yang tersentuh satu sapuan (spec 4b+5 §4.5). */
export type HasilSapuLokasi = {
  kehadiran: number;
  notifKedekatan: number;
  offerSalaman: number;
  offerCheckIn: number;
};

export type RadarStore = {
  ambilKehadiran(eventId: Hex, address: Address): Promise<BarisKehadiran | null>;
  /** Upsert satu baris per (acara, orang). BUKAN riwayat: detak baru menimpa yang lama. */
  simpanKehadiran(eventId: Hex, address: Address, cell: string, seenAtMs: number): Promise<void>;
  hapusKehadiran(eventId: Hex, address: Address): Promise<void>;
  /** Semua acara — dipakai saat pindah ke Tersembunyi (spec 4b+5 §7.2). */
  hapusSemuaKehadiran(address: Address): Promise<void>;
  /** Alamat huruf kecil dengan `seen_at >= sejakMs` di acara ini. Berhalaman penuh. */
  hadirSejak(eventId: Hex, sejakMs: number): Promise<Address[]>;
  /**
   * Subset `kandidat` (huruf kecil) yang punya baris `connections` dengan
   * `who`. Satu kueri per kelompok, bukan satu per kandidat.
   */
  terhubungDengan(who: Address, kandidat: Address[]): Promise<Set<string>>;
  hitungNotifKedekatan(eventId: Hex, penerima: Address): Promise<number>;
  /** true HANYA bila baris benar-benar tersisip (spec 4b+5 §6.3 butir 1). */
  sisipNotifKedekatan(eventId: Hex, penerima: Address, subjek: Address): Promise<boolean>;
  /** Empat pernyataan spec 4b+5 §4.5. `nowMs` dari pemanggil, supaya tes bisa memakai jam palsu. */
  sapuLokasi(nowMs: number): Promise<HasilSapuLokasi>;
};

export const METODE_RADAR_STORE = [
  "ambilKehadiran", "simpanKehadiran", "hapusKehadiran", "hapusSemuaKehadiran",
  "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
  "sapuLokasi",
] as const satisfies readonly (keyof RadarStore)[];

// Arah kedua dari pengait, sama seperti METODE_PESAN_STORE.
type SisaMetodeRadarStore = Exclude<keyof RadarStore, (typeof METODE_RADAR_STORE)[number]>;
type AssertNeverRadar<T extends never> = T;
type _PastikanMetodeRadarStoreLengkap = AssertNeverRadar<SisaMetodeRadarStore>;

export type ProfilSaya = { displayName: string; visibilitas: Visibilitas };

export type ProfilSayaStore = {
  /** Profil yang belum punya baris: nama kosong, `terlihat` (default kolom). */
  profilSaya(address: Address): Promise<ProfilSaya>;
  /** Upsert `profiles` — hanya dua kolom ini yang disentuh. */
  aturProfil(address: Address, profil: ProfilSaya): Promise<void>;
  /**
   * Visibilitas SETIAP alamat yang diminta, kunci huruf kecil. Alamat tanpa
   * baris `profiles` bernilai `terlihat` (default kolom, keputusan #2).
   */
  visibilitasBanyak(addresses: Address[]): Promise<Map<string, Visibilitas>>;
};

export const METODE_PROFIL_SAYA_STORE = [
  "profilSaya", "aturProfil", "visibilitasBanyak",
] as const satisfies readonly (keyof ProfilSayaStore)[];

type SisaMetodeProfilSayaStore = Exclude<keyof ProfilSayaStore, (typeof METODE_PROFIL_SAYA_STORE)[number]>;
type AssertNeverProfilSaya<T extends never> = T;
type _PastikanMetodeProfilSayaStoreLengkap = AssertNeverProfilSaya<SisaMetodeProfilSayaStore>;

export type RadarDeps = {
  radar: RadarStore;
  profilSaya: Pick<ProfilSayaStore, "visibilitasBanyak">;
  events: Pick<EventStore, "getEvent" | "hasCheckIn">;
  blokir: Pick<BlokirStore, "himpunanUntuk">;
  meet: Pick<MeetStore, "tandaOleh" | "tandaKe" | "profilRingkas">;
  /** `ambilKunci` untuk autentikasi sesi (R1); token push dipakai ulang tanpa diubah (spec 4b+5 §6.5). */
  pesan: Pick<PesanStore, "ambilKunci" | "tokenPush" | "hapusTokenPush">;
  /** null di tes dan saat push dimatikan. */
  push: PushPort | null;
  nowMs: () => number;
};

export type ProfilDeps = {
  profilSaya: ProfilSayaStore;
  radar: Pick<RadarStore, "hapusSemuaKehadiran">;
  pesan: Pick<PesanStore, "ambilKunci">;
  /** ConnectionRegistry — domain `AturProfil`, sama dengan `InginBertemu`. */
  verifyingContract: Address;
  nowMs: () => number;
};
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/radar-ports.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Pastikan hanya penambahan**

Run: `git diff -- apps/api/src/ports.ts | grep '^-' | grep -v '^---'`
Expected: kosong (exit 1).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ports.ts apps/api/test/radar-ports.test.ts
git commit -m "feat(api): port RadarStore dan ProfilSayaStore

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi — pengait AssertNever**

Setelah commit: tambahkan medan `  uji(): Promise<void>;` sebagai baris terakhir di dalam `export type RadarStore = {` … `};`.
Run: `pnpm --filter @nearly/api exec tsc --noEmit`
Expected: gagal kompilasi di baris `type _PastikanMetodeRadarStoreLengkap = AssertNeverRadar<SisaMetodeRadarStore>;` (`"uji"` tidak memenuhi `never`). Kembalikan: `git checkout -- apps/api/src/ports.ts`; `git status --short` → kosong.

---

## Task 6: `radar-store.ts` — akses Supabase radar

**Files:**
- Create: `apps/api/src/radar-store.ts`
- Test: `apps/api/test/radar-store.test.ts`

**Interfaces:**
- Consumes: `RadarStore` (Task 5); `potongKelompok` dari `apps/api/src/feed-store.ts`; `fetchAllPages` dari `apps/api/src/trust/store.ts` (hanya diimpor, tidak diubah).
- Produces:
  - `createRadarStore(db: SupabaseClient): RadarStore`
  - `const RETENSI_LOKASI_MS = 86_400_000`, `const RETENSI_LOKASI_DETIK = 86_400`

`sapuLokasi` diimplementasikan di sini (bagian dari `RadarStore`), tetapi tes privasinya ada di Task 7.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/radar-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { createRadarStore } from "../src/radar-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;
const E = `0x${"E1".repeat(32)}` as Hex;

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

/** Klien palsu yang MEREKAM setiap panggilan berantai (pola pesan-store.test.ts). */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null, count: 0 };
      const rantai: Record<string, unknown> = {};
      for (const op of [
        "select", "insert", "upsert", "update", "delete", "eq", "neq", "is", "not", "or", "in",
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

describe("createRadarStore", () => {
  it("ambilKehadiran memetakan seen_at ke milidetik, dengan kunci huruf kecil", async () => {
    const { db, jejak } = dbPalsu([{ data: { cell: "qqguv1r", seen_at: "2023-11-14T22:13:20.000Z" } }]);
    expect(await createRadarStore(db).ambilKehadiran(E, A)).toEqual({ cell: "qqguv1r", seenAtMs: 1_700_000_000_000 });
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()], ["address", A.toLowerCase()]]);
  });

  it("ambilKehadiran tanpa baris → null", async () => {
    const { db } = dbPalsu([{ data: null }]);
    expect(await createRadarStore(db).ambilKehadiran(E, A)).toBeNull();
  });

  it("simpanKehadiran meng-upsert satu baris per (acara, orang)", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createRadarStore(db).simpanKehadiran(E, A, "qqguv1r", 1_700_000_000_000);
    const up = ops(jejak, "upsert")[0]!;
    expect(up.arg[0]).toEqual({
      event_id: E.toLowerCase(), address: A.toLowerCase(), cell: "qqguv1r", seen_at: "2023-11-14T22:13:20.000Z",
    });
    expect(up.arg[1]).toEqual({ onConflict: "event_id,address" });
  });

  it("hapusSemuaKehadiran hanya menyaring alamat, semua acara", async () => {
    const { db, jejak } = dbPalsu([{ error: null }]);
    await createRadarStore(db).hapusSemuaKehadiran(A);
    expect(ops(jejak, "delete")).toHaveLength(1);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["address", A.toLowerCase()]]);
  });

  it("hadirSejak menyaring acara dan seen_at, berurutan alamat dan berhalaman", async () => {
    const { db, jejak } = dbPalsu([{ data: [{ address: A }] }]);
    expect(await createRadarStore(db).hadirSejak(E, Date.parse("2023-11-14T21:30:00.000Z"))).toEqual([A.toLowerCase()]);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()]]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["seen_at", "2023-11-14T21:30:00.000Z"]);
    expect(ops(jejak, "order")[0]!.arg[0]).toBe("address");
    expect(ops(jejak, "range")[0]!.arg).toEqual([0, 999]);
  });

  it("terhubungDengan memakai urutan kanonik addr_a < addr_b, satu kueri per sisi", async () => {
    const who = "0x0000000000000000000000000000000000000050" as Address;
    const lebihKecil = "0x0000000000000000000000000000000000000010" as Address;
    const lebihBesar = "0x0000000000000000000000000000000000000090" as Address;
    const { db, jejak } = dbPalsu([
      { data: [{ addr_b: lebihBesar }] },
      { data: [{ addr_a: lebihKecil }] },
    ]);
    const hasil = await createRadarStore(db).terhubungDengan(who, [lebihBesar, lebihKecil, who]);
    expect(hasil).toEqual(new Set([lebihBesar, lebihKecil]));
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["addr_a", who], ["addr_b", who]]);
    expect(ops(jejak, "in").map((e) => e.arg)).toEqual([["addr_b", [lebihBesar]], ["addr_a", [lebihKecil]]]);
  });

  it("terhubungDengan tanpa kandidat tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    expect(await createRadarStore(db).terhubungDengan(A, [])).toEqual(new Set());
    expect(jejak).toEqual([]);
  });

  it("sisipNotifKedekatan: tersisip → true; pelanggaran unik 23505 → false, bukan galat", async () => {
    const tersisip = dbPalsu([{ error: null }]);
    expect(await createRadarStore(tersisip.db).sisipNotifKedekatan(E, A, B)).toBe(true);
    expect(ops(tersisip.jejak, "insert")[0]!.arg[0]).toEqual({
      event_id: E.toLowerCase(), penerima: A.toLowerCase(), subjek: B.toLowerCase(),
    });
    const ganda = dbPalsu([{ error: { message: "duplicate", code: "23505" } }]);
    expect(await createRadarStore(ganda.db).sisipNotifKedekatan(E, A, B)).toBe(false);
  });

  it("sisipNotifKedekatan: galat lain melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati", code: "08006" } }]);
    await expect(createRadarStore(db).sisipNotifKedekatan(E, A, B)).rejects.toThrow(/sisip notifikasi kedekatan gagal/);
  });

  it("hitungNotifKedekatan menghitung per (acara, penerima)", async () => {
    const { db, jejak } = dbPalsu([{ count: 4 }]);
    expect(await createRadarStore(db).hitungNotifKedekatan(E, A)).toBe(4);
    expect(ops(jejak, "eq").map((e) => e.arg)).toEqual([["event_id", E.toLowerCase()], ["penerima", A.toLowerCase()]]);
  });

  it("sapuLokasi melempar bila salah satu pernyataan gagal", async () => {
    const { db } = dbPalsu([{ error: null }, { error: { message: "mati" } }, { error: null }, { error: null }]);
    await expect(createRadarStore(db).sapuLokasi(1_700_000_000_000)).rejects.toThrow(/sapu notifikasi kedekatan gagal/);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar-store.test.ts`
Expected: FAIL — `../src/radar-store` tidak ditemukan.

- [ ] **Step 2: Buat `apps/api/src/radar-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { potongKelompok } from "./feed-store";
import type { RadarStore } from "./ports";
import { fetchAllPages } from "./trust/store";

/** Retensi data lokasi yang tidak dipakai trust (spec 4b+5 §4.5, keputusan #5). */
export const RETENSI_LOKASI_MS = 24 * 60 * 60 * 1000;
export const RETENSI_LOKASI_DETIK = 24 * 60 * 60;

const kecil = (a: string) => a.toLowerCase();
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Akses Supabase untuk `kehadiran` dan `notif_kedekatan`, satu kueri baca ke
 * `connections`, dan penyapuan lokasi.
 *
 * `terhubungDengan` membaca tabel `connections` yang dimiliki HandshakeStore.
 * Menambah metode ke HandshakeStore berarti mengubah blok yang sudah ada di
 * ports.ts — dilarang batas jalur paralel spec 4b+5 §12. Presedennya
 * `MeetStore.profilRingkas`, yang membaca `profiles` dan `trust_snapshots`.
 */
export function createRadarStore(db: SupabaseClient): RadarStore {
  return {
    async ambilKehadiran(eventId, address) {
      const { data, error } = await db.from("kehadiran").select("cell, seen_at")
        .eq("event_id", kecil(eventId)).eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca kehadiran gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { cell: string; seen_at: string };
      return { cell: d.cell, seenAtMs: Date.parse(d.seen_at) };
    },

    async simpanKehadiran(eventId, address, cell, seenAtMs) {
      const { error } = await db.from("kehadiran").upsert({
        event_id: kecil(eventId), address: kecil(address), cell, seen_at: iso(seenAtMs),
      }, { onConflict: "event_id,address" });
      if (error) throw new Error(`simpan kehadiran gagal: ${error.message}`);
    },

    async hapusKehadiran(eventId, address) {
      const { error } = await db.from("kehadiran").delete()
        .eq("event_id", kecil(eventId)).eq("address", kecil(address));
      if (error) throw new Error(`hapus kehadiran gagal: ${error.message}`);
    },

    async hapusSemuaKehadiran(address) {
      const { error } = await db.from("kehadiran").delete().eq("address", kecil(address));
      if (error) throw new Error(`hapus semua kehadiran gagal: ${error.message}`);
    },

    async hadirSejak(eventId, sejakMs) {
      // Berhalaman penuh dengan urutan total (address unik per acara): select
      // polos terpotong 1000 baris tanpa galat, dan orang yang terpotong
      // hilang dari radar tanpa jejak (trust/store.ts).
      const baris = await fetchAllPages<{ address: string }>(
        (f, t) => db.from("kehadiran").select("address")
          .eq("event_id", kecil(eventId)).gte("seen_at", iso(sejakMs))
          .order("address", { ascending: true }).range(f, t) as never,
        "baca kehadiran acara",
      );
      return baris.map((r) => kecil(r.address) as Address);
    },

    async terhubungDengan(who, kandidat) {
      const w = kecil(who);
      const unik = [...new Set(kandidat.map(kecil))].filter((a) => a !== w);
      // `connections` menyimpan pasangan terurut `addr_a < addr_b` (0001).
      // Kandidat yang lebih besar dari `who` ada di `addr_b`, yang lebih
      // kecil di `addr_a` — dua kueri tepat, tanpa `.or()` yang membengkak.
      const lebihBesar = unik.filter((a) => a > w);
      const lebihKecil = unik.filter((a) => a < w);

      const kueri = [
        ...potongKelompok(lebihBesar).map(async (bagian) => {
          const { data, error } = await db.from("connections").select("addr_b")
            .eq("addr_a", w).in("addr_b", bagian);
          if (error) throw new Error(`baca koneksi radar gagal: ${error.message}`);
          return ((data ?? []) as { addr_b: string }[]).map((r) => kecil(r.addr_b));
        }),
        ...potongKelompok(lebihKecil).map(async (bagian) => {
          const { data, error } = await db.from("connections").select("addr_a")
            .eq("addr_b", w).in("addr_a", bagian);
          if (error) throw new Error(`baca koneksi radar gagal: ${error.message}`);
          return ((data ?? []) as { addr_a: string }[]).map((r) => kecil(r.addr_a));
        }),
      ];
      return new Set((await Promise.all(kueri)).flat());
    },

    async hitungNotifKedekatan(eventId, penerima) {
      const { count, error } = await db.from("notif_kedekatan")
        .select("subjek", { count: "exact", head: true })
        .eq("event_id", kecil(eventId)).eq("penerima", kecil(penerima));
      if (error) throw new Error(`hitung notifikasi kedekatan gagal: ${error.message}`);
      return count ?? 0;
    },

    async sisipNotifKedekatan(eventId, penerima, subjek) {
      const { error } = await db.from("notif_kedekatan").insert({
        event_id: kecil(eventId), penerima: kecil(penerima), subjek: kecil(subjek),
      });
      // 23505 = unique_violation: pasangan ini sudah pernah diberi tahu di acara ini.
      if (error && (error as { code?: string }).code === "23505") return false;
      if (error) throw new Error(`sisip notifikasi kedekatan gagal: ${error.message}`);
      return true;
    },

    async sapuLokasi(nowMs) {
      const batasIso = iso(nowMs - RETENSI_LOKASI_MS);
      const batasDetik = Math.floor(nowMs / 1000) - RETENSI_LOKASI_DETIK;

      // Persis pernyataan spec 4b+5 §4.5. TIDAK ADA `connections` atau
      // `checkins` di sini: selnya dipakai sidik jari ko-lokasi trust
      // (load-graph.ts) — pengecualian keputusan #5, dicatat di §10.7.
      //
      // Offer TIDAK dihapus, hanya selnya dikosongkan: keberadaan barisnya yang
      // menolak nonce dipakai ulang (§4.4).
      const [kehadiran, notif, salaman, checkIn] = await Promise.all([
        db.from("kehadiran").delete({ count: "exact" }).lt("seen_at", batasIso),
        db.from("notif_kedekatan").delete({ count: "exact" }).lt("sent_at", batasIso),
        db.from("handshake_offers").update({ cell: null }, { count: "exact" })
          .lt("expires_at", batasDetik).not("cell", "is", null),
        db.from("checkin_offers").update({ cell: null }, { count: "exact" })
          .lt("expires_at", batasDetik).not("cell", "is", null),
      ]);
      if (kehadiran.error) throw new Error(`sapu kehadiran gagal: ${kehadiran.error.message}`);
      if (notif.error) throw new Error(`sapu notifikasi kedekatan gagal: ${notif.error.message}`);
      if (salaman.error) throw new Error(`sapu sel QR salaman gagal: ${salaman.error.message}`);
      if (checkIn.error) throw new Error(`sapu sel QR check-in gagal: ${checkIn.error.message}`);

      return {
        kehadiran: kehadiran.count ?? 0,
        notifKedekatan: notif.count ?? 0,
        offerSalaman: salaman.count ?? 0,
        offerCheckIn: checkIn.count ?? 0,
      };
    },
  };
}
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/radar-store.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/radar-store.ts apps/api/test/radar-store.test.ts
git commit -m "feat(api): radar-store — kehadiran, notifikasi kedekatan, sapuan lokasi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Tes privasi retensi, penyapu oportunistik, dan alat CLI

**Files:**
- Create: `apps/api/test/support/supabase-memori.ts`, `apps/api/src/penyapu-lokasi.ts`, `apps/api/tools/sapu-lokasi.ts`
- Test: `apps/api/test/sapu-lokasi-privasi.test.ts`, `apps/api/test/penyapu-lokasi.test.ts`

**Interfaces:**
- Consumes: `createRadarStore`, `RETENSI_LOKASI_MS` (Task 6); `RadarStore` (Task 5); `createSupabase` (`apps/api/src/db.ts`).
- Produces:
  - `supabaseMemori(awal: Record<string, Baris[]>): { db: SupabaseClient; tabel: Record<string, Baris[]>; tabelDisentuh: { tabel: string; op: string }[] }` (support tes)
  - `const JEDA_SAPU_MS = 600_000`
  - `sapuLokasiAman(radar: Pick<RadarStore, "sapuLokasi">, nowMs: number): Promise<void>` — tidak pernah melempar
  - `buatPenyapuLokasi(deps: { radar: Pick<RadarStore, "sapuLokasi">; nowMs: () => number }): { mungkinSapu(): void }`

Tes privasi memeriksa ISI tabel setelah sapuan dengan jam palsu — bukan bentuk kueri — supaya sapuan yang salah sasaran benar-benar merah. **Alat CLI ditulis, TIDAK dijalankan** (batas keras).

- [ ] **Step 1: Buat Supabase di memori**

`apps/api/test/support/supabase-memori.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Baris = Record<string, unknown>;

/**
 * Supabase di memori yang MENJALANKAN kueri, bukan hanya merekamnya — cukup
 * untuk `select`, `delete`, dan `update` dengan filter `eq`, `lt`, `gte`,
 * `is(null)`, dan `not(kolom, "is", null)`. Dipakai tes privasi retensi: yang
 * ingin dibuktikan adalah ISI tabel sesudah sapuan, bukan bentuk kuerinya.
 *
 * Perbandingan `lt`/`gte`: angka dan string angka dibandingkan sebagai angka
 * (`expires_at` bigint), selain itu sebagai waktu ISO (`seen_at`, `sent_at`).
 * Setiap `from()` tercatat di `tabelDisentuh`.
 */
export function supabaseMemori(awal: Record<string, Baris[]>) {
  const tabel: Record<string, Baris[]> = Object.fromEntries(
    Object.entries(awal).map(([n, rows]) => [n, rows.map((r) => ({ ...r }))]),
  );
  const tabelDisentuh: { tabel: string; op: string }[] = [];

  const nilai = (v: unknown): number =>
    typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));

  function kueri(nama: string) {
    const filter: ((r: Baris) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let perubahan: Baris = {};
    let hitung = false;

    const rantai = {
      select: () => { op = "select"; return rantai; },
      delete: (o?: { count?: string }) => { op = "delete"; hitung = o?.count === "exact"; return rantai; },
      update: (v: Baris, o?: { count?: string }) => { op = "update"; perubahan = v; hitung = o?.count === "exact"; return rantai; },
      eq: (k: string, v: unknown) => { filter.push((r) => r[k] === v); return rantai; },
      lt: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) < nilai(v)); return rantai; },
      gte: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) >= nilai(v)); return rantai; },
      is: (k: string, v: null) => { filter.push((r) => r[k] === v); return rantai; },
      not: (k: string, o: string, v: null) => {
        if (o !== "is" || v !== null) throw new Error(`not(${k}, ${o}) tidak didukung`);
        filter.push((r) => r[k] !== null);
        return rantai;
      },
      then: (selesai: (x: unknown) => unknown) => {
        tabelDisentuh.push({ tabel: nama, op });
        const rows = tabel[nama] ?? (tabel[nama] = []);
        const cocok = rows.filter((r) => filter.every((f) => f(r)));
        if (op === "delete") tabel[nama] = rows.filter((r) => !cocok.includes(r));
        if (op === "update") for (const r of cocok) Object.assign(r, perubahan);
        return selesai({ data: op === "select" ? cocok : null, error: null, count: hitung ? cocok.length : null });
      },
    };
    return rantai;
  }

  const db = { from: (nama: string) => kueri(nama) } as unknown as SupabaseClient;
  return { db, tabel, tabelDisentuh };
}
```

- [ ] **Step 2: Tulis tes privasi retensi**

`apps/api/test/sapu-lokasi-privasi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRadarStore, RETENSI_LOKASI_MS } from "../src/radar-store";
import { supabaseMemori } from "./support/supabase-memori";

/**
 * TES PRIVASI RETENSI (spec induk §13, spec 4b+5 §4.5, §11).
 *
 * Jam palsu: `nowMs` diberikan langsung ke `sapuLokasi`. Yang diperiksa adalah
 * ISI tabel sesudah sapuan — bukan bentuk kueri — supaya sapuan yang salah
 * sasaran (menghapus baris offer, menyentuh `connections`) benar-benar merah.
 */
const NOW = Date.parse("2026-09-14T12:00:00.000Z");
const NOW_DETIK = Math.floor(NOW / 1000);
const JAM = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const A = `0x${"a".repeat(40)}`;
const B = `0x${"b".repeat(40)}`;
const E = `0x${"e".repeat(64)}`;

function dunia() {
  return supabaseMemori({
    kehadiran: [
      { event_id: E, address: A, cell: "qqguv1r", seen_at: iso(NOW - 25 * JAM) },
      { event_id: E, address: B, cell: "qqguv1r", seen_at: iso(NOW - 23 * JAM) },
      { event_id: `0x${"f".repeat(64)}`, address: A, cell: "qqguv1r", seen_at: iso(NOW - RETENSI_LOKASI_MS) },
    ],
    notif_kedekatan: [
      { event_id: E, penerima: A, subjek: B, sent_at: iso(NOW - 25 * JAM) },
      { event_id: E, penerima: B, subjek: A, sent_at: iso(NOW - 1 * JAM) },
    ],
    handshake_offers: [
      { nonce: "0x01", initiator: A, expires_at: String(NOW_DETIK - 86_400 - 1), cell: "qqguv1r", consumed_at: "2026-09-13T00:00:00Z" },
      { nonce: "0x02", initiator: A, expires_at: String(NOW_DETIK - 3_600), cell: "qqguv1r", consumed_at: null },
      { nonce: "0x03", initiator: B, expires_at: String(NOW_DETIK - 90_000), cell: null, consumed_at: null },
    ],
    checkin_offers: [
      { nonce: "0x11", event_id: E, host: A, expires_at: String(NOW_DETIK - 86_400 - 60), cell: "qqguv1r", consumed_at: null },
      { nonce: "0x12", event_id: E, host: A, expires_at: String(NOW_DETIK - 86_400), cell: "qqguv1r", consumed_at: null },
    ],
    connections: [
      { id: 1, addr_a: A, addr_b: B, nonce: "0x01", cell: "qqguv1r", created_at: iso(NOW - 30 * 24 * JAM) },
    ],
    checkins: [
      { event_id: E, address: B, nonce: "0x11", cell: "qqguv1r", at_ms: NOW - 30 * 24 * JAM, created_at: iso(NOW - 30 * 24 * JAM) },
    ],
  });
}

describe("sapuLokasi — privasi retensi", () => {
  it("menghapus kehadiran yang lebih tua dari 24 jam, menyisakan yang lebih baru atau tepat 24 jam", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.kehadiran!.map((r) => [r.address, r.seen_at])).toEqual([
      [B, iso(NOW - 23 * JAM)],
      [A, iso(NOW - RETENSI_LOKASI_MS)],
    ]);
  });

  it("menghapus notifikasi kedekatan yang lebih tua dari 24 jam", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.notif_kedekatan!.map((r) => r.penerima)).toEqual([B]);
  });

  it("mengosongkan sel QR salaman yang kedaluwarsa lebih dari 24 jam, TANPA menghapus barisnya", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.handshake_offers!.map((r) => [r.nonce, r.cell])).toEqual([
      ["0x01", null], ["0x02", "qqguv1r"], ["0x03", null],
    ]);
    // Baris yang tersisa adalah yang menolak nonce dipakai ulang.
    expect(m.tabel.handshake_offers!.find((r) => r.nonce === "0x01")!.consumed_at).toBe("2026-09-13T00:00:00Z");
  });

  it("mengosongkan sel QR check-in yang kedaluwarsa lebih dari 24 jam, TANPA menghapus barisnya", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.checkin_offers!.map((r) => [r.nonce, r.cell])).toEqual([
      ["0x11", null], ["0x12", "qqguv1r"],
    ]);
  });

  // Pengecualian keputusan #5 dan §10.7: sel keduanya dipakai sidik jari trust.
  it("TIDAK menyentuh connections dan checkins sama sekali", async () => {
    const m = dunia();
    const sebelum = structuredClone({ connections: m.tabel.connections, checkins: m.tabel.checkins });
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect({ connections: m.tabel.connections, checkins: m.tabel.checkins }).toEqual(sebelum);
    expect(m.tabelDisentuh.map((t) => t.tabel)).not.toContain("connections");
    expect(m.tabelDisentuh.map((t) => t.tabel)).not.toContain("checkins");
  });

  it("pernyataannya persis spec §4.5, dan tidak satu pun menghapus baris offer", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabelDisentuh).toEqual([
      { tabel: "kehadiran", op: "delete" },
      { tabel: "notif_kedekatan", op: "delete" },
      { tabel: "handshake_offers", op: "update" },
      { tabel: "checkin_offers", op: "update" },
    ]);
  });

  it("mengembalikan jumlah baris yang tersentuh", async () => {
    const m = dunia();
    expect(await createRadarStore(m.db).sapuLokasi(NOW)).toEqual({
      kehadiran: 1, notifKedekatan: 1, offerSalaman: 1, offerCheckIn: 1,
    });
  });

  it("sapuan kedua pada jam yang sama tidak mengubah apa pun", async () => {
    const m = dunia();
    const store = createRadarStore(m.db);
    await store.sapuLokasi(NOW);
    const setelahPertama = structuredClone(m.tabel);
    expect(await store.sapuLokasi(NOW)).toEqual({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 });
    expect(m.tabel).toEqual(setelahPertama);
  });
});
```

- [ ] **Step 3: Jalankan tes privasi**

Run: `pnpm --filter @nearly/api exec vitest run test/sapu-lokasi-privasi.test.ts`
Expected: PASS (implementasi sudah ada sejak Task 6; tes ini adalah penjaga, dan Step 9 membuktikannya menggigit).

- [ ] **Step 4: Tulis tes penyapu yang gagal**

`apps/api/test/penyapu-lokasi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { buatPenyapuLokasi, JEDA_SAPU_MS, sapuLokasiAman } from "../src/penyapu-lokasi";

const tunggu = () => new Promise((r) => setTimeout(r, 0));
const HASIL = { kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 };

afterEach(() => vi.restoreAllMocks());

describe("buatPenyapuLokasi", () => {
  it("menyapu pada panggilan pertama, lalu paling sering sekali per JEDA_SAPU_MS", async () => {
    const jam = { sekarang: 1_700_000_000_000 };
    const radar = { sapuLokasi: vi.fn(async () => HASIL) };
    const p = buatPenyapuLokasi({ radar, nowMs: () => jam.sekarang });

    p.mungkinSapu();
    jam.sekarang += JEDA_SAPU_MS - 1;
    p.mungkinSapu();
    await tunggu();
    expect(radar.sapuLokasi).toHaveBeenCalledTimes(1);
    expect(radar.sapuLokasi).toHaveBeenCalledWith(1_700_000_000_000);

    jam.sekarang += 1;
    p.mungkinSapu();
    await tunggu();
    expect(radar.sapuLokasi).toHaveBeenCalledTimes(2);
  });

  it("sapuan yang gagal tidak melempar dan dicatat", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    const radar = { sapuLokasi: vi.fn(async () => { throw new Error("supabase mati"); }) };
    const p = buatPenyapuLokasi({ radar, nowMs: () => 1 });
    expect(() => p.mungkinSapu()).not.toThrow();
    await tunggu();
    expect(galat).toHaveBeenCalledWith("sapu lokasi gagal:", "supabase mati");
  });
});

describe("sapuLokasiAman", () => {
  it("meneruskan jam pemanggil dan menelan galat", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const radar = { sapuLokasi: vi.fn(async () => { throw new Error("x"); }) };
    await expect(sapuLokasiAman(radar, 42)).resolves.toBeUndefined();
    expect(radar.sapuLokasi).toHaveBeenCalledWith(42);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/penyapu-lokasi.test.ts`
Expected: FAIL — `../src/penyapu-lokasi` tidak ditemukan.

- [ ] **Step 5: Buat `apps/api/src/penyapu-lokasi.ts`**

```ts
import type { RadarStore } from "./ports";

/** Sapuan oportunistik dari rute detak paling sering sekali per 10 menit per proses (spec 4b+5 §4.5). */
export const JEDA_SAPU_MS = 10 * 60_000;

/** Tidak pernah melempar: kegagalan dicatat, pemanggil tidak ikut gagal. */
export async function sapuLokasiAman(radar: Pick<RadarStore, "sapuLokasi">, nowMs: number): Promise<void> {
  try {
    await radar.sapuLokasi(nowMs);
  } catch (e) {
    console.error("sapu lokasi gagal:", e instanceof Error ? e.message : e);
  }
}

/**
 * Penanda waktu di MEMORI, satu per `radarRoutes` — `createApp` dipanggil
 * sekali per proses di index.ts. `mungkinSapu` tanpa await dan dijamin tidak
 * pernah melempar.
 */
export function buatPenyapuLokasi(deps: { radar: Pick<RadarStore, "sapuLokasi">; nowMs: () => number }) {
  let terakhirMs: number | null = null;
  return {
    mungkinSapu(): void {
      const now = deps.nowMs();
      if (terakhirMs !== null && now - terakhirMs < JEDA_SAPU_MS) return;
      terakhirMs = now;
      void sapuLokasiAman(deps.radar, now);
    },
  };
}
```

- [ ] **Step 6: Buat alat CLI `apps/api/tools/sapu-lokasi.ts`**

```ts
/**
 * Menjalankan penyapuan lokasi (spec 4b+5 §4.5) dari terminal atau cron VPS.
 * Menutup celah janji 24 jam saat API tidak menerima detak.
 *
 * Pakai (dari apps/api): node --env-file=../../.env --import=tsx tools/sapu-lokasi.ts
 */
import { createSupabase } from "../src/db";
import { createRadarStore } from "../src/radar-store";

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const hasil = await createRadarStore(db).sapuLokasi(Date.now());

console.log(
  `kehadiran ${hasil.kehadiran} · notifikasi kedekatan ${hasil.notifKedekatan}`
  + ` · sel QR salaman ${hasil.offerSalaman} · sel QR check-in ${hasil.offerCheckIn}`,
);
```

JANGAN jalankan alat ini — ia menulis ke Supabase sungguhan.

- [ ] **Step 7: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/sapu-lokasi-privasi.test.ts test/penyapu-lokasi.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS (typecheck mencakup `tools/`).

- [ ] **Step 8: Commit**

```bash
git add apps/api/test/support/supabase-memori.ts apps/api/test/sapu-lokasi-privasi.test.ts \
  apps/api/test/penyapu-lokasi.test.ts apps/api/src/penyapu-lokasi.ts apps/api/tools/sapu-lokasi.ts
git commit -m "feat(api): penyapu lokasi 24 jam, alat CLI, dan tes privasi retensi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — pengecualian `connections`/`checkins` dan baris offer**

Jalankan sungguhan setelah commit, satu per satu.

**Mutasi A (sapuan menyentuh `checkins`):** di `sapuLokasi` (`apps/api/src/radar-store.ts`), tepat sebelum baris `      if (kehadiran.error) throw …`, sisipkan:
```ts
      await db.from("checkins").update({ cell: null }).lt("created_at", batasIso);
```
Run: `pnpm --filter @nearly/api exec vitest run test/sapu-lokasi-privasi.test.ts`
Expected MERAH: `TIDAK menyentuh connections dan checkins sama sekali`, `pernyataannya persis spec §4.5, dan tidak satu pun menghapus baris offer`. Kembalikan: `git checkout -- apps/api/src/radar-store.ts`.

**Mutasi B (sapuan menghapus baris offer):** ganti `db.from("handshake_offers").update({ cell: null }, { count: "exact" })` dengan `db.from("handshake_offers").delete({ count: "exact" })`.
Run: perintah yang sama.
Expected MERAH: `mengosongkan sel QR salaman yang kedaluwarsa lebih dari 24 jam, TANPA menghapus barisnya`, `pernyataannya persis spec §4.5, dan tidak satu pun menghapus baris offer`. Kembalikan: `git checkout -- apps/api/src/radar-store.ts`.

Run ulang → PASS; `git status --short` → kosong.

---

## Task 8: `profil-store.ts` — nama dan visibilitas

**Files:**
- Create: `apps/api/src/profil-store.ts`
- Test: `apps/api/test/profil-store.test.ts`

**Interfaces:**
- Consumes: `ProfilSayaStore` (Task 5); `Visibilitas` (Task 1); `potongKelompok` (`feed-store.ts`).
- Produces:
  - `keVisibilitas(nilai: unknown): Visibilitas` — hanya `"tersembunyi"` yang menyembunyikan
  - `createProfilSayaStore(db: SupabaseClient): ProfilSayaStore`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/profil-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { createProfilSayaStore, keVisibilitas } from "../src/profil-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;

describe("keVisibilitas", () => {
  it("hanya tersembunyi yang menyembunyikan; tanpa baris berarti terlihat", () => {
    expect(keVisibilitas("tersembunyi")).toBe("tersembunyi");
    expect(keVisibilitas("terlihat")).toBe("terlihat");
    expect(keVisibilitas(undefined)).toBe("terlihat");
    expect(keVisibilitas(null)).toBe("terlihat");
  });
});

describe("createProfilSayaStore", () => {
  it("visibilitasBanyak: setiap alamat diminta punya entri huruf kecil; tanpa baris → terlihat", async () => {
    const panggilan: unknown[][] = [];
    const db = {
      from: () => ({
        select: () => ({
          in: (k: string, v: string[]) => {
            panggilan.push([k, v]);
            return Promise.resolve({ data: [{ address: B.toLowerCase(), visibilitas: "tersembunyi" }], error: null });
          },
        }),
      }),
    } as never;
    const peta = await createProfilSayaStore(db).visibilitasBanyak([A, B, A]);
    expect([...peta.entries()]).toEqual([[A.toLowerCase(), "terlihat"], [B.toLowerCase(), "tersembunyi"]]);
    expect(panggilan).toEqual([["address", [A.toLowerCase(), B.toLowerCase()]]]);
  });

  it("visibilitasBanyak tanpa alamat tidak mengirim kueri", async () => {
    const db = { from: () => { throw new Error("tidak boleh dipanggil"); } } as never;
    expect(await createProfilSayaStore(db).visibilitasBanyak([])).toEqual(new Map());
  });

  it("profilSaya: baris tidak ada → nama kosong, terlihat", async () => {
    const db = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
    } as never;
    expect(await createProfilSayaStore(db).profilSaya(A)).toEqual({ displayName: "", visibilitas: "terlihat" });
  });

  it("aturProfil meng-upsert hanya address, display_name, visibilitas", async () => {
    const rekam: unknown[] = [];
    const db = {
      from: (t: string) => ({ upsert: (v: unknown, o: unknown) => { rekam.push([t, v, o]); return Promise.resolve({ error: null }); } }),
    } as never;
    await createProfilSayaStore(db).aturProfil(A, { displayName: "Budi", visibilitas: "tersembunyi" });
    expect(rekam).toEqual([["profiles", { address: A.toLowerCase(), display_name: "Budi", visibilitas: "tersembunyi" }, { onConflict: "address" }]]);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/profil-store.test.ts`
Expected: FAIL — `../src/profil-store` tidak ditemukan.

- [ ] **Step 2: Buat `apps/api/src/profil-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visibilitas } from "@nearly/shared";
import { potongKelompok } from "./feed-store";
import type { ProfilSayaStore } from "./ports";

const kecil = (a: string) => a.toLowerCase();

/**
 * Hanya nilai persis `tersembunyi` yang menyembunyikan. Kolom punya CHECK dua
 * nilai (0008), jadi nilai lain tidak pernah datang dari basis data; baris yang
 * tidak ada berarti default kolom, `terlihat` (keputusan #2).
 */
export function keVisibilitas(nilai: unknown): Visibilitas {
  return nilai === "tersembunyi" ? "tersembunyi" : "terlihat";
}

export function createProfilSayaStore(db: SupabaseClient): ProfilSayaStore {
  return {
    async profilSaya(address) {
      const { data, error } = await db.from("profiles").select("display_name, visibilitas")
        .eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca profil saya gagal: ${error.message}`);
      const d = data as { display_name: string | null; visibilitas: string | null } | null;
      return { displayName: d?.display_name ?? "", visibilitas: keVisibilitas(d?.visibilitas) };
    },

    async aturProfil(address, profil) {
      // Upsert: orang yang belum pernah salaman belum punya baris profiles.
      // Kolom lain (pfp_url, cocok_dilihat_at) tidak disebut, jadi tidak disentuh.
      const { error } = await db.from("profiles").upsert({
        address: kecil(address), display_name: profil.displayName, visibilitas: profil.visibilitas,
      }, { onConflict: "address" });
      if (error) throw new Error(`atur profil gagal: ${error.message}`);
    },

    async visibilitasBanyak(addresses) {
      const unik = [...new Set(addresses.map(kecil))];
      const keluar = new Map<string, Visibilitas>(unik.map((a) => [a, "terlihat"]));
      // Dipotong per kelompok 100 — `.in()` dengan ratusan nilai ditolak proksi
      // Supabase (Fase 3b).
      const hasil = await Promise.all(potongKelompok(unik).map(async (bagian) => {
        const { data, error } = await db.from("profiles").select("address, visibilitas").in("address", bagian);
        if (error) throw new Error(`baca visibilitas gagal: ${error.message}`);
        return (data ?? []) as { address: string; visibilitas: string }[];
      }));
      for (const r of hasil.flat()) keluar.set(kecil(r.address), keVisibilitas(r.visibilitas));
      return keluar;
    },
  };
}
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/profil-store.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/profil-store.ts apps/api/test/profil-store.test.ts
git commit -m "feat(api): profil-store — nama tampilan dan visibilitas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Dunia uji radar dan gerbang detak & radar

**Files:**
- Create: `apps/api/test/support/dunia-radar.ts`, `apps/api/src/radar-gate.ts`
- Test: `apps/api/test/radar-gate.test.ts`

**Interfaces:**
- Consumes: `RadarDeps`, `ProfilDeps`, `RadarStore`, `ProfilSayaStore`, `BarisKehadiran`, `EventRecord`, `KunciPesanTerdaftar`, `PushPort` (`ports.ts`); `duniaBlokir` (`apps/api/test/support/dunia-blokir.ts`, sudah ada); `kecocokanDari` (`apps/api/src/meet-rank.ts`); `isEventLive`, `isInsideGeofence`, `encodeCell`, `neighborCells` (`@nearly/shared`); `TIER_LABELS` (`@nearly/trust`, hanya diimpor).
- Produces:
  - Support: `duniaRadar(awal?)` → `{ deps: RadarDeps & ProfilDeps; db; push; jam; acara; pasangBlokir; hadirkan(a, menitLalu?, cell?); sembunyikan(a) }`; konstanta `NOW_RADAR`, `EVENT_RADAR`, `SEL_PUSAT`, `SEL_TETANGGA`, `SEL_JAUH`, `VC_RADAR`, `MENIT`; `alamat(n: number): Address`
  - `const JENDELA_HADIR_MS = 900_000`, `const JEDA_DETAK_MIN_MS = 20_000`, `const MAKS_KARTU_RADAR = 200`
  - `type RadarFailure` — `event_not_found` 404 · `event_tidak_berlangsung` 409 · `belum_check_in` 403 · `terlalu_cepat` 429 · `tersembunyi` 403 · `belum_hadir` 403
  - `type RadarResult<T> = { ok: true; value: T } | { ok: false; failure: RadarFailure }`
  - `type JawabanDetak = { hadir: true } | { hadir: false; alasan: "tersembunyi" | "di_luar_area" }`
  - `type HasilDetak = { jawaban: JawabanDetak; baruHadir: boolean }`
  - `type KartuRadar = { address: Address; displayName: string; tierLabel: string; pernahBertemu: boolean; salingInginBertemu: boolean }`
  - `type ResponsRadar = { kartu: KartuRadar[]; jumlah: number }`
  - `detak(pemanggil: Address, eventId: Hex, cell: string, deps: RadarDeps): Promise<RadarResult<HasilDetak>>` — langkah 3–9 spec §5.1
  - `lihatRadar(pemanggil: Address, eventId: Hex, deps: RadarDeps): Promise<RadarResult<ResponsRadar>>` — langkah 2–7 spec §5.2
  - `urutkanKartuRadar(a, b): number`

Fungsi gerbang menerima `pemanggil` yang SUDAH terautentikasi; langkah 1 (sesi) dan 2 (badan) milik rute (Task 12).

- [ ] **Step 1: Buat dunia uji `apps/api/test/support/dunia-radar.ts`**

```ts
import { vi } from "vitest";
import type { Address, Hex } from "viem";
import { encodeCell, neighborCells, type Visibilitas } from "@nearly/shared";
import type {
  BarisKehadiran, EventRecord, KunciPesanTerdaftar, ProfilDeps, ProfilSayaStore, PushPort,
  RadarDeps, RadarStore,
} from "../../src/ports";
import { duniaBlokir } from "./dunia-blokir";

export const NOW_RADAR = 1_700_000_000_000;
export const EVENT_RADAR = `0x${"e1".repeat(32)}` as Hex;
export const SEL_PUSAT = encodeCell(-6.2088, 106.8456);
export const SEL_TETANGGA = neighborCells(SEL_PUSAT)[0]!;
/** Beberapa kilometer dari pusat — pasti di luar geofence 3×3. */
export const SEL_JAUH = encodeCell(-6.3, 106.95);
export const VC_RADAR = "0x0000000000000000000000000000000000000abc" as Address;
export const MENIT = 60_000;

/** Alamat uji huruf kecil yang urutannya bisa ditebak: `alamat(1) < alamat(2)`. */
export const alamat = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

/**
 * Dunia radar di memori: tabel `kehadiran`, `notif_kedekatan`, `profiles`,
 * `connections`, `checkins`, dan token push sebagai struktur data, dengan store
 * yang membacanya SUNGGUHAN. Meet dan blokir memakai duniaBlokir supaya kedua
 * arah blokir dan semantik `kecuali` nyata — fake yang mengembalikan jawaban
 * karangan tidak bisa membuktikan "blokir satu arah mana pun menyembunyikan".
 */
export function duniaRadar(awal: {
  acara?: Partial<EventRecord>;
  checkIn?: Address[];
  koneksi?: [Address, Address][];
  tanda?: { who: Address; target: Address }[];
  blokir?: { blocker: Address; blocked: Address }[];
  nama?: Record<string, string>;
  tier?: Record<string, number>;
  tersembunyi?: Address[];
  token?: Record<string, string[]>;
  nowMs?: number;
} = {}) {
  const kecil = (a: string) => a.toLowerCase();
  const pasangan = (a: string, b: string) => [kecil(a), kecil(b)].sort().join("|");
  const jam = { sekarang: awal.nowMs ?? NOW_RADAR };
  const detik = BigInt(Math.floor(jam.sekarang / 1000));

  const acara: EventRecord = {
    eventId: EVENT_RADAR, host: alamat(0xdead), title: "Hackathon", venueLabel: "Kalibata",
    centerCell: SEL_PUSAT, startsAt: detik - 600n, endsAt: detik + 3600n, txHash: "0xtx" as Hex,
    ...awal.acara,
  };

  const db = {
    kehadiran: new Map<string, BarisKehadiran & { eventId: string; address: string }>(),
    notif: [] as { eventId: string; penerima: string; subjek: string; sentAtMs: number }[],
    profil: new Map<string, { displayName: string; visibilitas: Visibilitas }>(),
    checkIn: new Set((awal.checkIn ?? []).map((a) => `${kecil(acara.eventId)}|${kecil(a)}`)),
    koneksi: new Set((awal.koneksi ?? []).map(([a, b]) => pasangan(a, b))),
    kunci: new Map<string, KunciPesanTerdaftar>(),
    token: Object.entries(awal.token ?? {}).flatMap(([a, ts]) => ts.map((t) => ({ address: kecil(a), token: t }))),
  };
  for (const a of awal.tersembunyi ?? []) db.profil.set(kecil(a), { displayName: "", visibilitas: "tersembunyi" });
  for (const [a, n] of Object.entries(awal.nama ?? {})) {
    const lama = db.profil.get(kecil(a));
    db.profil.set(kecil(a), { displayName: n, visibilitas: lama?.visibilitas ?? "terlihat" });
  }
  const tier = new Map(Object.entries(awal.tier ?? {}).map(([a, t]) => [kecil(a), t]));
  const kunciHadir = (e: string, a: string) => `${kecil(e)}|${kecil(a)}`;

  const blok = duniaBlokir({ tanda: awal.tanda, blokir: awal.blokir });

  const radar: RadarStore = {
    ambilKehadiran: vi.fn(async (e: Hex, a: Address) => {
      const b = db.kehadiran.get(kunciHadir(e, a));
      return b ? { cell: b.cell, seenAtMs: b.seenAtMs } : null;
    }),
    simpanKehadiran: vi.fn(async (e: Hex, a: Address, cell: string, seenAtMs: number) => {
      db.kehadiran.set(kunciHadir(e, a), { eventId: kecil(e), address: kecil(a), cell, seenAtMs });
    }),
    hapusKehadiran: vi.fn(async (e: Hex, a: Address) => { db.kehadiran.delete(kunciHadir(e, a)); }),
    hapusSemuaKehadiran: vi.fn(async (a: Address) => {
      for (const [k, b] of db.kehadiran) if (b.address === kecil(a)) db.kehadiran.delete(k);
    }),
    hadirSejak: vi.fn(async (e: Hex, sejakMs: number) => [...db.kehadiran.values()]
      .filter((b) => b.eventId === kecil(e) && b.seenAtMs >= sejakMs)
      .map((b) => b.address as Address).sort()),
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => db.koneksi.has(pasangan(who, k))))),
    hitungNotifKedekatan: vi.fn(async (e: Hex, p: Address) =>
      db.notif.filter((n) => n.eventId === kecil(e) && n.penerima === kecil(p)).length),
    sisipNotifKedekatan: vi.fn(async (e: Hex, p: Address, s: Address) => {
      if (db.notif.some((n) => n.eventId === kecil(e) && n.penerima === kecil(p) && n.subjek === kecil(s))) return false;
      db.notif.push({ eventId: kecil(e), penerima: kecil(p), subjek: kecil(s), sentAtMs: jam.sekarang });
      return true;
    }),
    sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
  };

  const profilSaya: ProfilSayaStore = {
    profilSaya: vi.fn(async (a: Address) => {
      const p = db.profil.get(kecil(a));
      return { displayName: p?.displayName ?? "", visibilitas: p?.visibilitas ?? "terlihat" };
    }),
    aturProfil: vi.fn(async (a: Address, p: { displayName: string; visibilitas: Visibilitas }) => {
      db.profil.set(kecil(a), { displayName: p.displayName, visibilitas: p.visibilitas });
    }),
    visibilitasBanyak: vi.fn(async (addrs: Address[]) =>
      new Map(addrs.map((a) => [kecil(a), db.profil.get(kecil(a))?.visibilitas ?? "terlihat" as Visibilitas]))),
  };

  const push = { kirim: vi.fn<PushPort["kirim"]>(async () => ({ tokenMati: [] })) };

  const deps: RadarDeps & ProfilDeps = {
    radar,
    profilSaya,
    events: {
      getEvent: vi.fn(async (e: Hex) => (kecil(e) === kecil(acara.eventId) ? acara : null)),
      hasCheckIn: vi.fn(async (e: Hex, a: Address) => db.checkIn.has(`${kecil(e)}|${kecil(a)}`)),
    },
    blokir: blok.blokir,
    meet: {
      tandaOleh: blok.meet.tandaOleh,
      tandaKe: blok.meet.tandaKe,
      profilRingkas: vi.fn(async (addrs: Address[]) => new Map(addrs.map((a) => [
        kecil(a), { displayName: db.profil.get(kecil(a))?.displayName ?? "", tier: tier.get(kecil(a)) ?? 0 },
      ]))),
    },
    pesan: {
      ambilKunci: vi.fn(async (a: Address) => db.kunci.get(kecil(a)) ?? null),
      tokenPush: vi.fn(async (a: Address) => db.token.filter((t) => t.address === kecil(a)).map((t) => t.token)),
      hapusTokenPush: vi.fn(async (ts: string[]) => { db.token = db.token.filter((t) => !ts.includes(t.token)); }),
    },
    push,
    verifyingContract: VC_RADAR,
    nowMs: () => jam.sekarang,
  };

  return {
    deps,
    db,
    push,
    jam,
    acara,
    pasangBlokir: blok.pasangBlokir,
    /** Menulis baris kehadiran langsung, seperti detak yang lolos `menitLalu` menit lalu. */
    hadirkan(a: Address, menitLalu = 0, cell = SEL_PUSAT) {
      db.kehadiran.set(kunciHadir(acara.eventId, a), {
        eventId: kecil(acara.eventId), address: kecil(a), cell, seenAtMs: jam.sekarang - menitLalu * MENIT,
      });
    },
    sembunyikan(a: Address) {
      const lama = db.profil.get(kecil(a));
      db.profil.set(kecil(a), { displayName: lama?.displayName ?? "", visibilitas: "tersembunyi" });
    },
  };
}
```

- [ ] **Step 2: Tulis tes gerbang yang gagal**

`apps/api/test/radar-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  detak, JEDA_DETAK_MIN_MS, JENDELA_HADIR_MS, lihatRadar, MAKS_KARTU_RADAR, urutkanKartuRadar,
} from "../src/radar-gate";
import {
  alamat, duniaRadar, EVENT_RADAR, MENIT, SEL_JAUH, SEL_PUSAT, SEL_TETANGGA,
} from "./support/dunia-radar";

const AKU = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const D = alamat(0xd);

describe("detak — setiap langkah spec 4b+5 §5.1", () => {
  it("langkah 3: acara tidak ada → 404 event_not_found", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const r = await detak(AKU, `0x${"99".repeat(32)}`, SEL_PUSAT, d.deps);
    expect(r).toEqual({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  it("langkah 4: acara belum mulai atau sudah selesai → 409 event_tidak_berlangsung", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    for (const acara of [{ startsAt: detik + 60n, endsAt: detik + 3600n }, { startsAt: detik - 7200n, endsAt: detik - 1n }]) {
      const d = duniaRadar({ checkIn: [AKU], acara });
      expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
        .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
    }
  });

  it("langkah 5: belum check-in → 403 belum_check_in", async () => {
    const d = duniaRadar();
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("langkah 6: detak kurang dari 20 detik setelah detak terakhir → 429 terlalu_cepat", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    expect((await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps)).ok).toBe(true);
    d.jam.sekarang += JEDA_DETAK_MIN_MS - 1;
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    d.jam.sekarang += 1;
    expect((await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps)).ok).toBe(true);
  });

  it("langkah 7: tersembunyi → 200 hadir:false alasan tersembunyi, dan baris kehadiran DIHAPUS", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 5);
    d.sembunyikan(AKU);
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: false, alasan: "tersembunyi" }, baruHadir: false } });
    expect(d.db.kehadiran.size).toBe(0);
  });

  it("langkah 8: di luar geofence → 200 hadir:false alasan di_luar_area, dan baris DIHAPUS", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 5);
    const r = await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: false, alasan: "di_luar_area" }, baruHadir: false } });
    expect(d.db.kehadiran.size).toBe(0);
  });

  it("langkah 9: di dalam geofence (sel tetangga pun) → upsert, hadir:true", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const r = await detak(AKU, EVENT_RADAR, SEL_TETANGGA, d.deps);
    expect(r).toEqual({ ok: true, value: { jawaban: { hadir: true }, baruHadir: true } });
    expect([...d.db.kehadiran.values()]).toEqual([
      { eventId: EVENT_RADAR, address: AKU, cell: SEL_TETANGGA, seenAtMs: d.jam.sekarang },
    ]);
  });

  it("detak berulang MENIMPA baris yang sama — bukan riwayat", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    d.jam.sekarang += MENIT;
    await detak(AKU, EVENT_RADAR, SEL_TETANGGA, d.deps);
    expect(d.db.kehadiran.size).toBe(1);
    expect([...d.db.kehadiran.values()][0]!.cell).toBe(SEL_TETANGGA);
  });
});

describe("detak — transisi tidak hadir → hadir", () => {
  it("detak pertama baruHadir, detak lanjutan dalam 15 menit tidak", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    const pertama = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    d.jam.sekarang += MENIT;
    const kedua = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(pertama.ok && pertama.value.baruHadir).toBe(true);
    expect(kedua.ok && kedua.value.baruHadir).toBe(false);
  });

  it("baris yang lebih tua dari 15 menit dihitung tidak hadir → baruHadir lagi", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU, 16);
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r.ok && r.value.baruHadir).toBe(true);
  });

  it("tepat 15 menit masih hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.db.kehadiran.set(`${EVENT_RADAR}|${AKU}`, {
      eventId: EVENT_RADAR, address: AKU, cell: SEL_PUSAT, seenAtMs: d.jam.sekarang - JENDELA_HADIR_MS,
    });
    const r = await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps);
    expect(r.ok && r.value.baruHadir).toBe(false);
  });
});

describe("detak — urutan gerbang: pemeriksaan sebelumnya menang", () => {
  it("tersembunyi + di luar area + belum check-in → belum_check_in", async () => {
    const d = duniaRadar({ tersembunyi: [AKU] });
    expect(await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("acara tidak berlangsung + belum check-in → event_tidak_berlangsung", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    const d = duniaRadar({ acara: { startsAt: detik + 60n, endsAt: detik + 3600n } });
    expect(await detak(AKU, EVENT_RADAR, SEL_PUSAT, d.deps))
      .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
  });

  it("terlalu cepat + tersembunyi + di luar area → terlalu_cepat, dan baris TIDAK dihapus", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    d.db.kehadiran.set(`${EVENT_RADAR}|${AKU}`, {
      eventId: EVENT_RADAR, address: AKU, cell: SEL_PUSAT, seenAtMs: d.jam.sekarang - 5_000,
    });
    expect(await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps))
      .toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    expect(d.db.kehadiran.size).toBe(1);
  });

  it("tersembunyi + di luar area → tersembunyi", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    const r = await detak(AKU, EVENT_RADAR, SEL_JAUH, d.deps);
    expect(r.ok && r.value.jawaban).toEqual({ hadir: false, alasan: "tersembunyi" });
  });
});

describe("lihatRadar — gerbang spec 4b+5 §5.2", () => {
  it("acara tidak ada → 404", async () => {
    const d = duniaRadar({ checkIn: [AKU] });
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, `0x${"99".repeat(32)}`, d.deps))
      .toEqual({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  it("acara tidak berlangsung → 409", async () => {
    const detik = BigInt(Math.floor(1_700_000_000_000 / 1000));
    const d = duniaRadar({ checkIn: [AKU], acara: { startsAt: detik - 7200n, endsAt: detik - 1n } });
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "event_tidak_berlangsung", httpStatus: 409 } });
  });

  it("belum check-in → 403 belum_check_in", async () => {
    const d = duniaRadar();
    d.hadirkan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  // TIMBAL BALIK: tidak ada cara mengintip tanpa ikut tampil.
  it("pemanggil tersembunyi → 403 tersembunyi, walau baris kehadirannya masih ada", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(AKU);
    d.hadirkan(B);
    d.sembunyikan(AKU);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "tersembunyi", httpStatus: 403 } });
  });

  it("pemanggil belum hadir (tanpa baris) → 403 belum_hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(B);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_hadir", httpStatus: 403 } });
  });

  it("pemanggil basi (> 15 menit) → 403 belum_hadir", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    d.hadirkan(AKU, 16);
    d.hadirkan(B);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_hadir", httpStatus: 403 } });
  });

  it("urutan: tersembunyi + belum hadir + belum check-in → belum_check_in", async () => {
    const d = duniaRadar({ tersembunyi: [AKU] });
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "belum_check_in", httpStatus: 403 } });
  });

  it("urutan: tersembunyi + belum hadir → tersembunyi", async () => {
    const d = duniaRadar({ checkIn: [AKU], tersembunyi: [AKU] });
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps))
      .toEqual({ ok: false, failure: { code: "tersembunyi", httpStatus: 403 } });
  });
});

describe("lihatRadar — isi daftar", () => {
  function hadirSemua(d: ReturnType<typeof duniaRadar>, ...orang: Address[]) {
    for (const o of orang) d.hadirkan(o);
  }
  const alamatKartu = (r: Awaited<ReturnType<typeof lihatRadar>>) =>
    (r.ok ? r.value.kartu.map((k) => k.address) : null);

  it("menampilkan orang lain yang hadir, tanpa pemanggil sendiri", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([B, C]);
  });

  it("orang basi (> 15 menit) tidak tampil", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C] });
    d.hadirkan(AKU);
    d.hadirkan(B, 16);
    d.hadirkan(C, 14);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("pindah ke Tersembunyi berlaku seketika walau baris kehadiran masih ada", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    hadirSemua(d, AKU, B);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([B]);
    d.sembunyikan(B);
    expect(d.db.kehadiran.has(`${EVENT_RADAR}|${B}`)).toBe(true);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([]);
  });

  it("aku memblokir B → kartu B hilang", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], blokir: [{ blocker: AKU, blocked: B }] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("B memblokir aku → kartu B hilang juga (blokir dua arah)", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], blokir: [{ blocker: B, blocked: AKU }] });
    hadirSemua(d, AKU, B, C);
    expect(alamatKartu(await lihatRadar(AKU, EVENT_RADAR, d.deps))).toEqual([C]);
  });

  it("lencana: pernah bertemu dari connections; saling ingin bertemu dari irisan tanda; sepihak tidak", async () => {
    const d = duniaRadar({
      checkIn: [AKU, B, C, D],
      koneksi: [[AKU, B]],
      tanda: [
        { who: AKU, target: C }, { who: C, target: AKU }, // saling
        { who: D, target: AKU }, // sepihak
      ],
    });
    hadirSemua(d, AKU, B, C, D);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.map((k) => [k.address, k.pernahBertemu, k.salingInginBertemu])).toEqual([
      [C, false, true], [B, true, false], [D, false, false],
    ]);
  });

  it("urutan: saling → pernah bertemu → tier tertinggi → alamat", () => {
    const k = (address: string, tier: number, pernahBertemu: boolean, salingInginBertemu: boolean) =>
      ({ address, tier, pernahBertemu, salingInginBertemu });
    const hasil = [
      k("0x5", 3, false, false), k("0x4", 0, true, false), k("0x3", 1, false, false),
      k("0x2", 0, false, true), k("0x1", 1, false, false),
    ].sort(urutkanKartuRadar).map((x) => x.address);
    expect(hasil).toEqual(["0x2", "0x4", "0x5", "0x1", "0x3"]);
  });

  it("nama dan label tier dari profilRingkas; tanpa nama tetap string kosong", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], nama: { [B]: "Budi" }, tier: { [B]: 2, [C]: 1 } });
    hadirSemua(d, AKU, B, C);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.map((x) => [x.displayName, x.tierLabel])).toEqual([
      ["Budi", "Terpercaya"], ["", "Dikenal"],
    ]);
  });

  it("tier di luar rentang berlabel Baru, bukan undefined", async () => {
    const d = duniaRadar({ checkIn: [AKU, B], tier: { [B]: 9 } });
    hadirSemua(d, AKU, B);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu[0]!.tierLabel).toBe("Baru");
  });

  it("dibatasi MAKS_KARTU_RADAR kartu, dan jumlah = kartu yang dikirim", async () => {
    const orang = Array.from({ length: MAKS_KARTU_RADAR + 5 }, (_, i) => alamat(0x1000 + i));
    const d = duniaRadar({ checkIn: [AKU, ...orang] });
    hadirSemua(d, AKU, ...orang);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.kartu.length).toBe(MAKS_KARTU_RADAR);
    expect(r.ok && r.value.jumlah).toBe(MAKS_KARTU_RADAR);
  });

  // Jumlah sebelum penyaringan akan membocorkan berapa orang disembunyikan.
  it("jumlah tidak menghitung orang yang disaring blokir atau visibilitas", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C, D], blokir: [{ blocker: B, blocked: AKU }], tersembunyi: [C] });
    hadirSemua(d, AKU, B, C, D);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value).toEqual({ kartu: [expect.objectContaining({ address: D })], jumlah: 1 });
  });

  it("setiap kartu hanya memuat kunci yang diizinkan spec §5.2", async () => {
    const d = duniaRadar({ checkIn: [AKU, B] });
    hadirSemua(d, AKU, B);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && Object.keys(r.value.kartu[0]!).sort()).toEqual(
      ["address", "displayName", "pernahBertemu", "salingInginBertemu", "tierLabel"],
    );
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar-gate.test.ts`
Expected: FAIL — `../src/radar-gate` tidak ditemukan.

- [ ] **Step 3: Buat `apps/api/src/radar-gate.ts`**

```ts
import type { Address, Hex } from "viem";
import { isEventLive, isInsideGeofence } from "@nearly/shared";
import { TIER_LABELS } from "@nearly/trust";
import { kecocokanDari } from "./meet-rank";
import type { EventRecord, RadarDeps } from "./ports";

/** "Hadir sekarang": detak dalam 15 menit terakhir (keputusan #1). */
export const JENDELA_HADIR_MS = 15 * 60_000;
/** Detak lebih rapat dari ini ditolak 429 (spec 4b+5 §5.1 langkah 6). */
export const JEDA_DETAK_MIN_MS = 20_000;
export const MAKS_KARTU_RADAR = 200;

export type RadarFailure =
  | { code: "event_not_found"; httpStatus: 404 }
  | { code: "event_tidak_berlangsung"; httpStatus: 409 }
  | { code: "belum_check_in"; httpStatus: 403 }
  | { code: "terlalu_cepat"; httpStatus: 429 }
  | { code: "tersembunyi"; httpStatus: 403 }
  | { code: "belum_hadir"; httpStatus: 403 };

export type RadarResult<T> = { ok: true; value: T } | { ok: false; failure: RadarFailure };

const fail = (failure: RadarFailure): { ok: false; failure: RadarFailure } => ({ ok: false, failure });
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const kecil = (a: string) => a.toLowerCase();

/** Yang dikirim ke HP. Langkah 7 dan 8 BUKAN galat (spec 4b+5 §5.1). */
export type JawabanDetak =
  | { hadir: true }
  | { hadir: false; alasan: "tersembunyi" | "di_luar_area" };

/** `baruHadir` untuk rute saja — TIDAK PERNAH dikirim ke HP. */
export type HasilDetak = { jawaban: JawabanDetak; baruHadir: boolean };

/**
 * Hanya kunci ini. Yang TIDAK PERNAH ada: `cell`, `seen_at`, jumlah detak,
 * jarak, skor trust mentah, dan siapa yang disembunyikan blokir (§5.2).
 */
export type KartuRadar = {
  address: Address;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
};

export type ResponsRadar = { kartu: KartuRadar[]; jumlah: number };

/**
 * Visibilitas dibaca SAAT permintaan. Alamat yang tidak ada di peta dianggap
 * tersembunyi — gagal tertutup: store yang lupa satu alamat tidak boleh
 * menampilkan orang yang memilih bersembunyi.
 */
async function terlihat(deps: RadarDeps, address: Address): Promise<boolean> {
  const peta = await deps.profilSaya.visibilitasBanyak([address]);
  return peta.get(kecil(address)) === "terlihat";
}

/** Langkah 3–5, bersama untuk detak dan radar. */
async function gerbangAcara(
  eventId: Hex, pemanggil: Address, deps: RadarDeps, nowMs: number,
): Promise<RadarResult<EventRecord>> {
  const ev = await deps.events.getEvent(eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });
  if (!isEventLive(ev.startsAt, ev.endsAt, nowMs)) {
    return fail({ code: "event_tidak_berlangsung", httpStatus: 409 });
  }
  if (!(await deps.events.hasCheckIn(eventId, pemanggil))) {
    return fail({ code: "belum_check_in", httpStatus: 403 });
  }
  return ok(ev);
}

/**
 * `POST /radar/:eventId/detak`, langkah 3–9 (spec 4b+5 §5.1). Langkah 1
 * (sesi) dan 2 (badan) milik rute. Pertama yang gagal menang.
 */
export async function detak(
  pemanggil: Address, eventIdMentah: Hex, cell: string, deps: RadarDeps,
): Promise<RadarResult<HasilDetak>> {
  const now = deps.nowMs();
  const eventId = kecil(eventIdMentah) as Hex;
  const aku = kecil(pemanggil) as Address;

  const acara = await gerbangAcara(eventId, aku, deps, now);
  if (!acara.ok) return acara;

  // Laju dihitung dari `seen_at` baris yang ada — tanpa tabel atau memori tambahan.
  const sebelumnya = await deps.radar.ambilKehadiran(eventId, aku);
  if (sebelumnya && now - sebelumnya.seenAtMs < JEDA_DETAK_MIN_MS) {
    return fail({ code: "terlalu_cepat", httpStatus: 429 });
  }

  // Langkah 7 dan 8 menghapus baris: orang langsung hilang dari radar saat
  // pindah ke Tersembunyi atau keluar area, tanpa menunggu 15 menit.
  if (!(await terlihat(deps, aku))) {
    await deps.radar.hapusKehadiran(eventId, aku);
    return ok({ jawaban: { hadir: false, alasan: "tersembunyi" }, baruHadir: false });
  }
  if (!isInsideGeofence(acara.value.centerCell, cell)) {
    await deps.radar.hapusKehadiran(eventId, aku);
    return ok({ jawaban: { hadir: false, alasan: "di_luar_area" }, baruHadir: false });
  }

  const sudahHadir = sebelumnya !== null && now - sebelumnya.seenAtMs <= JENDELA_HADIR_MS;
  await deps.radar.simpanKehadiran(eventId, aku, cell, now);
  return ok({ jawaban: { hadir: true }, baruHadir: !sudahHadir });
}

/** Saling ingin bertemu → pernah bertemu → tier tertinggi → alamat. */
export function urutkanKartuRadar(
  a: { address: string; tier: number; pernahBertemu: boolean; salingInginBertemu: boolean },
  b: { address: string; tier: number; pernahBertemu: boolean; salingInginBertemu: boolean },
): number {
  return (Number(b.salingInginBertemu) - Number(a.salingInginBertemu))
    || (Number(b.pernahBertemu) - Number(a.pernahBertemu))
    || (b.tier - a.tier)
    || a.address.localeCompare(b.address);
}

const labelTier = (tier: number): string => TIER_LABELS[tier] ?? TIER_LABELS[0];

/**
 * `GET /radar/:eventId`, langkah 2–7 (spec 4b+5 §5.2). Langkah 5 dan 6
 * menegakkan timbal balik: siapa pun yang bisa melihat radar sedang terlihat
 * di radar yang sama.
 */
export async function lihatRadar(
  pemanggil: Address, eventIdMentah: Hex, deps: RadarDeps,
): Promise<RadarResult<ResponsRadar>> {
  const now = deps.nowMs();
  const eventId = kecil(eventIdMentah) as Hex;
  const aku = kecil(pemanggil) as Address;

  const acara = await gerbangAcara(eventId, aku, deps, now);
  if (!acara.ok) return acara;

  if (!(await terlihat(deps, aku))) return fail({ code: "tersembunyi", httpStatus: 403 });

  const barisku = await deps.radar.ambilKehadiran(eventId, aku);
  if (!barisku || now - barisku.seenAtMs > JENDELA_HADIR_MS) {
    return fail({ code: "belum_hadir", httpStatus: 403 });
  }

  const hadir = (await deps.radar.hadirSejak(eventId, now - JENDELA_HADIR_MS))
    .map((a) => kecil(a) as Address)
    .filter((a) => a !== aku);
  if (hadir.length === 0) return ok({ kartu: [], jumlah: 0 });

  // Visibilitas dari `profiles`, BUKAN dari baris kehadiran — pindah ke
  // Tersembunyi berlaku seketika walau barisnya masih ada. Blokir DUA arah.
  const [visibilitas, terblokir] = await Promise.all([
    deps.profilSaya.visibilitasBanyak(hadir),
    deps.blokir.himpunanUntuk(aku),
  ]);
  const lolos = hadir.filter((a) => visibilitas.get(a) === "terlihat" && !terblokir.has(a));
  if (lolos.length === 0) return ok({ kartu: [], jumlah: 0 });

  const kecuali = [...terblokir];
  const [koneksi, oleh, ke, profil] = await Promise.all([
    deps.radar.terhubungDengan(aku, lolos),
    deps.meet.tandaOleh(aku, kecuali),
    deps.meet.tandaKe(aku, kecuali),
    deps.meet.profilRingkas(lolos),
  ]);
  const saling = new Set(kecocokanDari(oleh, ke).map((k) => kecil(k.address)));

  const baris = lolos.map((a) => ({
    address: a,
    displayName: profil.get(a)?.displayName ?? "",
    tier: profil.get(a)?.tier ?? 0,
    pernahBertemu: koneksi.has(a),
    salingInginBertemu: saling.has(a),
  })).sort(urutkanKartuRadar).slice(0, MAKS_KARTU_RADAR);

  // Dibangun kunci demi kunci, BUKAN spread — medan tambahan di `baris`
  // (mis. `tier` mentah) tidak boleh ikut terkirim.
  const kartu: KartuRadar[] = baris.map((b) => ({
    address: b.address,
    displayName: b.displayName,
    tierLabel: labelTier(b.tier),
    pernahBertemu: b.pernahBertemu,
    salingInginBertemu: b.salingInginBertemu,
  }));
  // `jumlah` = kartu yang dikirim. Jumlah sebelum penyaringan akan membocorkan
  // berapa orang disembunyikan blokir atau visibilitas.
  return ok({ kartu, jumlah: kartu.length });
}
```

- [ ] **Step 4: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/radar-gate.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/support/dunia-radar.ts apps/api/src/radar-gate.ts apps/api/test/radar-gate.test.ts
git commit -m "feat(api): gerbang detak dan radar — timbal balik, blokir dua arah, hadir 15 menit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi — timbal balik radar dan blokir dua arah**

Jalankan sungguhan setelah commit, satu per satu. Setiap mutasi dikembalikan dengan `git checkout -- apps/api/src/radar-gate.ts`. Perintah uji untuk semuanya: `pnpm --filter @nearly/api exec vitest run test/radar-gate.test.ts`.

**Mutasi A (timbal balik — langkah 5):** di `lihatRadar`, hapus baris
```ts
  if (!(await terlihat(deps, aku))) return fail({ code: "tersembunyi", httpStatus: 403 });
```
Expected MERAH: `pemanggil tersembunyi → 403 tersembunyi, walau baris kehadirannya masih ada`, `urutan: tersembunyi + belum hadir → tersembunyi`.

**Mutasi B (timbal balik — langkah 6):** di `lihatRadar`, hapus blok
```ts
  if (!barisku || now - barisku.seenAtMs > JENDELA_HADIR_MS) {
    return fail({ code: "belum_hadir", httpStatus: 403 });
  }
```
Expected MERAH: `pemanggil belum hadir (tanpa baris) → 403 belum_hadir`, `pemanggil basi (> 15 menit) → 403 belum_hadir`.

**Mutasi C (blokir satu arah — hanya yang memblokirku):** di `lihatRadar`, ganti `    deps.blokir.himpunanUntuk(aku),` (di dalam `Promise.all` sebelum `const lolos`) dengan
```ts
    (deps.blokir as never as { pemblokirUntuk: (a: Address) => Promise<Set<string>> }).pemblokirUntuk(aku),
```
Expected MERAH: `aku memblokir B → kartu B hilang`.

**Mutasi D (blokir satu arah — hanya yang kublokir):** ganti baris yang sama dengan
```ts
    (deps.blokir as never as { diblokirOleh: (a: Address) => Promise<{ address: string }[]> }).diblokirOleh(aku)
      .then((b) => new Set(b.map((x) => x.address.toLowerCase()))),
```
Expected MERAH: `B memblokir aku → kartu B hilang juga (blokir dua arah)`, `jumlah tidak menghitung orang yang disaring blokir atau visibilitas`.

Run ulang tanpa mutasi → PASS; `git status --short` → kosong. Rekam nama tes merah setiap mutasi.

---

## Task 10: Notifikasi kedekatan

**Files:**
- Create: `apps/api/src/radar-notif.ts`
- Test: `apps/api/test/radar-notif.test.ts`

**Interfaces:**
- Consumes: `RadarDeps` (Task 5); `JENDELA_HADIR_MS` (Task 9); `kecocokanDari` (`meet-rank.ts`); `duniaRadar`, `alamat`, `EVENT_RADAR` (Task 9 support). Kode Fase 4c (`pesan-push.ts`, `push.ts`, `PesanStore`) hanya DIPANGGIL lewat `deps.pesan.tokenPush` / `hapusTokenPush` dan `deps.push.kirim` — tidak diubah.
- Produces:
  - `const BATAS_NOTIF_KEDEKATAN = 5`
  - `type HubunganKedekatan = "saling_ingin_bertemu" | "pernah_bertemu"`
  - `teksNotifKedekatan(hubungan: HubunganKedekatan, displayName: string): string`
  - `kirimNotifKedekatan(deps: Pick<RadarDeps, "radar" | "profilSaya" | "blokir" | "meet" | "pesan" | "push" | "nowMs">, a: { eventId: Hex; subjek: Address }): Promise<void>` — dijamin tidak pernah melempar

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/radar-notif.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { BATAS_NOTIF_KEDEKATAN, kirimNotifKedekatan, teksNotifKedekatan } from "../src/radar-notif";
import { alamat, duniaRadar, EVENT_RADAR } from "./support/dunia-radar";

const S = alamat(0x5);
const R = alamat(0x7);
const T = alamat(0x8);

const tokenDari = (...orang: Address[]) => Object.fromEntries(orang.map((o) => [o, [`ExponentPushToken[${o.slice(-4)}]`]]));
const penerimaPush = (d: ReturnType<typeof duniaRadar>) =>
  d.push.kirim.mock.calls.map(([p]) => p.tokens[0]);
const token = (o: Address) => `ExponentPushToken[${o.slice(-4)}]`;

describe("teksNotifKedekatan", () => {
  it("kalimat persis spec 4b+5 §6.4", () => {
    expect(teksNotifKedekatan("saling_ingin_bertemu", "Budi")).toBe("Budi, yang saling ingin bertemu denganmu, ada di acara ini.");
    expect(teksNotifKedekatan("saling_ingin_bertemu", "  ")).toBe("Seseorang yang saling ingin bertemu denganmu ada di acara ini.");
    expect(teksNotifKedekatan("pernah_bertemu", "Budi")).toBe("Budi, yang pernah kamu temui, ada di acara ini.");
    expect(teksNotifKedekatan("pernah_bertemu", "")).toBe("Seseorang yang pernah kamu temui ada di acara ini.");
  });
});

describe("kirimNotifKedekatan — penerima", () => {
  it("koneksi yang hadir diberi tahu, DUA arah", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], nama: { [S]: "Sari", [R]: "Rudi" }, token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim.mock.calls.map(([p]) => [p.tokens[0], p.badan])).toEqual([
      [token(R), "Sari, yang pernah kamu temui, ada di acara ini."],
      [token(S), "Rudi, yang pernah kamu temui, ada di acara ini."],
    ]);
  });

  it("saling ingin bertemu diberi tahu, dan kalimatnya mengalahkan pernah bertemu", async () => {
    const d = duniaRadar({
      koneksi: [[S, R]], tanda: [{ who: S, target: R }, { who: R, target: S }], token: tokenDari(S, R),
    });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim.mock.calls.map(([p]) => p.badan)).toEqual([
      "Seseorang yang saling ingin bertemu denganmu ada di acara ini.",
      "Seseorang yang saling ingin bertemu denganmu ada di acara ini.",
    ]);
  });

  // Tanda sepihak BUKAN hubungan — vektor penguntitan (spec 4b+5 §6.2, §13 butir 2).
  it("tanda sepihak ke arah mana pun tidak memicu apa pun", async () => {
    for (const tanda of [[{ who: R, target: S }], [{ who: S, target: R }]]) {
      const d = duniaRadar({ tanda, token: tokenDari(S, R) });
      d.hadirkan(S); d.hadirkan(R);
      await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
      expect(d.push.kirim).not.toHaveBeenCalled();
      expect(d.db.notif).toEqual([]);
    }
  });

  it("orang tanpa hubungan tidak diberi tahu", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R, T) });
    d.hadirkan(S); d.hadirkan(R); d.hadirkan(T);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(penerimaPush(d)).not.toContain(token(T));
  });

  it("koneksi yang basi (> 15 menit) atau tidak hadir tidak diberi tahu", async () => {
    const d = duniaRadar({ koneksi: [[S, R], [S, T]], token: tokenDari(S, R, T) });
    d.hadirkan(S); d.hadirkan(R, 16);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("koneksi yang Tersembunyi tidak menerima dan tidak diberitahukan", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], tersembunyi: [R], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("subjek yang Tersembunyi tidak memicu apa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], tersembunyi: [S], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("blokir satu arah mana pun memutus kedua arah", async () => {
    for (const blokir of [[{ blocker: S, blocked: R }], [{ blocker: R, blocked: S }]]) {
      const d = duniaRadar({ koneksi: [[S, R]], blokir, token: tokenDari(S, R) });
      d.hadirkan(S); d.hadirkan(R);
      await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
      expect(d.push.kirim).not.toHaveBeenCalled();
    }
  });
});

describe("kirimNotifKedekatan — penggabungan dan batas", () => {
  it("sekali per pasangan per acara: pemicu kedua tidak mengirim ulang", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: R });
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
  });

  it("paling banyak BATAS_NOTIF_KEDEKATAN notifikasi per orang per acara", async () => {
    const koneksiLama = Array.from({ length: BATAS_NOTIF_KEDEKATAN + 2 }, (_, i) => alamat(0x100 + i));
    const d = duniaRadar({
      koneksi: koneksiLama.map((k) => [S, k] as [Address, Address]),
      token: tokenDari(S, ...koneksiLama),
    });
    d.hadirkan(S);
    for (const k of koneksiLama) d.hadirkan(k);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });

    const keS = penerimaPush(d).filter((t) => t === token(S));
    expect(keS).toHaveLength(BATAS_NOTIF_KEDEKATAN);
    expect(d.db.notif.filter((n) => n.penerima === S)).toHaveLength(BATAS_NOTIF_KEDEKATAN);
    // Setiap koneksi tetap diberi tahu tentang S — batas milik PENERIMA.
    for (const k of koneksiLama) expect(penerimaPush(d)).toContain(token(k));
  });

  it("penerima tanpa token tetap tercatat (sekali per pasangan) tapi tidak dikirimi", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(penerimaPush(d)).toEqual([token(S)]);
    expect(d.db.notif).toHaveLength(2);
  });

  it("token mati dihapus lewat hapusTokenPush", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    d.push.kirim.mockResolvedValueOnce({ tokenMati: [token(R)] });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.db.token.map((t) => t.token)).toEqual([token(S)]);
  });
});

describe("kirimNotifKedekatan — isi dan sifat", () => {
  it("muatan: judul Nearly, data jenis radar + eventId, TANPA alamat siapa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], nama: { [S]: "Sari" }, token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    for (const [muatan] of d.push.kirim.mock.calls) {
      expect(muatan.judul).toBe("Nearly");
      expect(muatan.data).toEqual({ jenis: "radar", eventId: EVENT_RADAR });
      const teks = JSON.stringify({ judul: muatan.judul, badan: muatan.badan, data: muatan.data }).toLowerCase();
      expect(teks).not.toContain(S.slice(2));
      expect(teks).not.toContain(R.slice(2));
      expect(teks).not.toContain("hackathon");
      expect(teks).not.toContain("kalibata");
    }
  });

  it("push null → tidak membaca apa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]] });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan({ ...d.deps, push: null }, { eventId: EVENT_RADAR, subjek: S });
    expect(d.deps.radar.hadirSejak).not.toHaveBeenCalled();
  });

  it("tidak pernah melempar: store mati", async () => {
    const d = duniaRadar({ koneksi: [[S, R]] });
    d.hadirkan(S); d.hadirkan(R);
    (d.deps.radar.hadirSejak as unknown as { mockRejectedValueOnce: (e: Error) => void })
      .mockRejectedValueOnce(new Error("supabase mati"));
    await expect(kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S })).resolves.toBeUndefined();
  });

  it("tidak pernah melempar: push mati di satu arah tidak menghentikan arah lain", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    d.push.kirim.mockRejectedValueOnce(new Error("expo mati"));
    await expect(kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S })).resolves.toBeUndefined();
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar-notif.test.ts`
Expected: FAIL — `../src/radar-notif` tidak ditemukan.

- [ ] **Step 2: Buat `apps/api/src/radar-notif.ts`**

```ts
import type { Address, Hex } from "viem";
import { JENDELA_HADIR_MS } from "./radar-gate";
import { kecocokanDari } from "./meet-rank";
import type { RadarDeps } from "./ports";

/** Paling banyak lima notifikasi per orang per acara (spec 4b+5 §6.3). */
export const BATAS_NOTIF_KEDEKATAN = 5;

export type HubunganKedekatan = "saling_ingin_bertemu" | "pernah_bertemu";

/** Spec 4b+5 §6.4. Tidak pernah alamat, judul atau lokasi acara, maupun sel. */
export function teksNotifKedekatan(hubungan: HubunganKedekatan, displayName: string): string {
  const nama = displayName.trim();
  if (hubungan === "saling_ingin_bertemu") {
    return nama
      ? `${nama}, yang saling ingin bertemu denganmu, ada di acara ini.`
      : "Seseorang yang saling ingin bertemu denganmu ada di acara ini.";
  }
  return nama
    ? `${nama}, yang pernah kamu temui, ada di acara ini.`
    : "Seseorang yang pernah kamu temui ada di acara ini.";
}

type DepsNotif = Pick<RadarDeps, "radar" | "profilSaya" | "blokir" | "meet" | "pesan" | "push" | "nowMs">;

/** Satu arah: `penerima` diberi tahu tentang `subjek`. Kegagalannya tidak menghentikan arah lain. */
async function kirimSatuArah(
  deps: DepsNotif & { push: NonNullable<RadarDeps["push"]> },
  a: { eventId: Hex; penerima: Address; subjek: Address; namaSubjek: string; hubungan: HubunganKedekatan },
): Promise<void> {
  try {
    if (await deps.radar.hitungNotifKedekatan(a.eventId, a.penerima) >= BATAS_NOTIF_KEDEKATAN) return;
    // Kirim HANYA bila baris benar-benar tersisip: sekali per pasangan per acara.
    if (!(await deps.radar.sisipNotifKedekatan(a.eventId, a.penerima, a.subjek))) return;

    const tokens = await deps.pesan.tokenPush(a.penerima);
    if (tokens.length === 0) return;
    const { tokenMati } = await deps.push.kirim({
      tokens,
      judul: "Nearly",
      badan: teksNotifKedekatan(a.hubungan, a.namaSubjek),
      data: { jenis: "radar", eventId: a.eventId },
    });
    if (tokenMati.length > 0) await deps.pesan.hapusTokenPush(tokenMati);
  } catch (e) {
    console.error("notifikasi kedekatan gagal:", e instanceof Error ? e.message : e);
  }
}

/**
 * Dipanggil TANPA await oleh rute detak saat `subjek` berpindah dari tidak
 * hadir ke hadir (spec 4b+5 §6.1). Dijamin tidak pernah melempar — pola
 * `kirimPushPesan`; detak tetap 200 apa pun yang terjadi di sini.
 *
 * Penerima (§6.2): hadir sekarang dan terlihat, bukan subjek, tanpa blokir dua
 * arah, dan pernah bertemu ATAU saling ingin bertemu. Tanda SEPIHAK tidak
 * cukup — itu vektor penguntitan. Dikirim ke DUA arah, berurutan.
 */
export async function kirimNotifKedekatan(
  deps: DepsNotif, a: { eventId: Hex; subjek: Address },
): Promise<void> {
  const push = deps.push;
  if (!push) return;
  try {
    const eventId = a.eventId.toLowerCase() as Hex;
    const subjek = a.subjek.toLowerCase() as Address;
    const now = deps.nowMs();

    const hadir = (await deps.radar.hadirSejak(eventId, now - JENDELA_HADIR_MS))
      .map((x) => x.toLowerCase() as Address)
      .filter((x) => x !== subjek);
    if (hadir.length === 0) return;

    const [visibilitas, terblokir] = await Promise.all([
      deps.profilSaya.visibilitasBanyak([subjek, ...hadir]),
      deps.blokir.himpunanUntuk(subjek),
    ]);
    // Subjek yang sudah pindah ke Tersembunyi sejak detaknya tidak memicu apa pun.
    if (visibilitas.get(subjek) !== "terlihat") return;
    const kandidat = hadir.filter((x) => visibilitas.get(x) === "terlihat" && !terblokir.has(x));
    if (kandidat.length === 0) return;

    const kecuali = [...terblokir];
    const [koneksi, oleh, ke] = await Promise.all([
      deps.radar.terhubungDengan(subjek, kandidat),
      deps.meet.tandaOleh(subjek, kecuali),
      deps.meet.tandaKe(subjek, kecuali),
    ]);
    const saling = new Set(kecocokanDari(oleh, ke).map((k) => k.address.toLowerCase()));
    const penerima = kandidat.filter((x) => saling.has(x) || koneksi.has(x));
    if (penerima.length === 0) return;

    const profil = await deps.meet.profilRingkas([subjek, ...penerima]);
    const nama = (x: string) => profil.get(x)?.displayName ?? "";
    const depsPush = { ...deps, push };

    for (const r of penerima) {
      // Saling ingin bertemu mengalahkan pernah bertemu (§6.4).
      const hubungan: HubunganKedekatan = saling.has(r) ? "saling_ingin_bertemu" : "pernah_bertemu";
      await kirimSatuArah(depsPush, { eventId, penerima: r, subjek, namaSubjek: nama(subjek), hubungan });
      await kirimSatuArah(depsPush, { eventId, penerima: subjek, subjek: r, namaSubjek: nama(r), hubungan });
    }
  } catch (e) {
    console.error("notifikasi kedekatan gagal:", e instanceof Error ? e.message : e);
  }
}
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/radar-notif.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/radar-notif.ts apps/api/test/radar-notif.test.ts
git commit -m "feat(api): notifikasi kedekatan — koneksi dan saling ingin bertemu, dua arah, batas 5

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Mutasi — batas 5 dan tanda sepihak**

Jalankan sungguhan setelah commit; kembalikan setiap mutasi dengan `git checkout -- apps/api/src/radar-notif.ts`. Perintah: `pnpm --filter @nearly/api exec vitest run test/radar-notif.test.ts`.

**Mutasi A (batas 5):** ganti `>= BATAS_NOTIF_KEDEKATAN` dengan `> BATAS_NOTIF_KEDEKATAN`.
Expected MERAH: `paling banyak BATAS_NOTIF_KEDEKATAN notifikasi per orang per acara`.

**Mutasi B (tanda sepihak dianggap hubungan):** ganti baris
```ts
    const saling = new Set(kecocokanDari(oleh, ke).map((k) => k.address.toLowerCase()));
```
dengan
```ts
    const saling = new Set([...oleh, ...ke].map((k) => k.address.toLowerCase()));
```
Expected MERAH: `tanda sepihak ke arah mana pun tidak memicu apa pun`.

Run ulang → PASS; `git status --short` → kosong.

---

## Task 11: Gerbang `POST /profil` dan profil saya

**Files:**
- Create: `apps/api/src/profil-gate.ts`
- Test: `apps/api/test/profil-gate.test.ts`

**Interfaces:**
- Consumes: `ProfilDeps`, `ProfilSaya` (Task 5); `periksaNamaTampilan`, `recoverAturProfilSigner`, `aturProfilTypedData`, `Visibilitas` (Task 1–2); `pulihkanTandaTangan` (`apps/api/src/pulihkan-tanda-tangan.ts`); `duniaRadar`, `alamat`, `EVENT_RADAR`, `VC_RADAR` (Task 9 support).
- Produces:
  - `const MAKS_UMUR_ATUR_PROFIL_DETIK = 3600`
  - `type ProfilFailure` — `expired` 410 · `bad_signature` 401 · `nama_tidak_sah` 400
  - `type ProfilResult<T>`
  - `type AturProfilInput = { who: Address; displayName: string; visibilitas: Visibilitas; expiresAt: bigint; sig: Hex }`
  - `aturProfil(input: AturProfilInput, deps: ProfilDeps): Promise<ProfilResult<void>>` — langkah 2–5 spec §7.2
  - `ambilProfilSaya(pemanggil: Address, deps: ProfilDeps): Promise<ProfilSaya>`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/profil-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { aturProfilTypedData, type Visibilitas } from "@nearly/shared";
import { ambilProfilSaya, aturProfil, MAKS_UMUR_ATUR_PROFIL_DETIK } from "../src/profil-gate";
import { alamat, duniaRadar, EVENT_RADAR, VC_RADAR } from "./support/dunia-radar";

const AKU = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const LAIN = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function masukan(d: ReturnType<typeof duniaRadar>, over: {
  displayName?: string; visibilitas?: Visibilitas; expiresAt?: bigint; penanda?: typeof AKU;
} = {}) {
  const msg = {
    who: AKU.address,
    displayName: over.displayName ?? "Budi",
    visibilitas: over.visibilitas ?? "terlihat",
    expiresAt: over.expiresAt ?? BigInt(Math.floor(d.jam.sekarang / 1000) + 300),
  };
  const sig = await (over.penanda ?? AKU).signTypedData(aturProfilTypedData(msg, VC_RADAR));
  return { ...msg, sig };
}

describe("aturProfil — gerbang spec 4b+5 §7.2", () => {
  it("sah → profil tersimpan dengan nama setelah trim", async () => {
    const d = duniaRadar();
    expect(await aturProfil(await masukan(d, { displayName: "  Budi  " }), d.deps)).toEqual({ ok: true, value: undefined });
    expect(d.db.profil.get(AKU.address.toLowerCase())).toEqual({ displayName: "Budi", visibilitas: "terlihat" });
  });

  it("nama kosong menghapus nama", async () => {
    const d = duniaRadar({ nama: { [AKU.address]: "Lama" } });
    await aturProfil(await masukan(d, { displayName: "" }), d.deps);
    expect(d.db.profil.get(AKU.address.toLowerCase())?.displayName).toBe("");
  });

  it("langkah 2: expiresAt sudah lewat → 410 expired", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) - 1) });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("langkah 2: expiresAt lebih dari 1 jam ke depan → 410 expired", async () => {
    const d = duniaRadar();
    const nowSec = BigInt(Math.floor(d.jam.sekarang / 1000));
    const tepat = await masukan(d, { expiresAt: nowSec + BigInt(MAKS_UMUR_ATUR_PROFIL_DETIK) });
    const lebih = await masukan(d, { expiresAt: nowSec + BigInt(MAKS_UMUR_ATUR_PROFIL_DETIK) + 1n });
    expect((await aturProfil(tepat, d.deps)).ok).toBe(true);
    expect(await aturProfil(lebih, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("langkah 3: ditandatangani dompet lain → 401 bad_signature, tidak menulis", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { penanda: LAIN });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(d.deps.profilSaya.aturProfil).not.toHaveBeenCalled();
  });

  it("langkah 3: tanda tangan cacat bentuk (v = 0x99) → 401, bukan melempar", async () => {
    const d = duniaRadar();
    const m = { ...(await masukan(d)), sig: `0x${"99".repeat(65)}` as Hex };
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("langkah 3: visibilitas ditukar setelah ditandatangani → 401", async () => {
    const d = duniaRadar();
    const m = { ...(await masukan(d, { visibilitas: "terlihat" })), visibilitas: "tersembunyi" as const };
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("langkah 4: nama bidi → 400 nama_tidak_sah, tidak menulis", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "Budi‮gnp" });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "nama_tidak_sah", httpStatus: 400 } });
    expect(d.deps.profilSaya.aturProfil).not.toHaveBeenCalled();
  });

  it("langkah 4: nama 33 code point → 400 nama_tidak_sah", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "👍".repeat(33) });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "nama_tidak_sah", httpStatus: 400 } });
  });

  it("urutan: kedaluwarsa + tanda tangan salah + nama bidi → expired", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "a‮b", penanda: LAIN, expiresAt: 1n });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("urutan: tanda tangan salah + nama bidi → bad_signature", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "a‮b", penanda: LAIN });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("pindah ke Tersembunyi menghapus SEMUA baris kehadiran who, di acara mana pun", async () => {
    const d = duniaRadar();
    const aku = AKU.address.toLowerCase();
    const acaraLain = `0x${"e2".repeat(32)}`;
    d.db.kehadiran.set(`${EVENT_RADAR}|${aku}`, { eventId: EVENT_RADAR, address: aku, cell: "qqguv1r", seenAtMs: 1 });
    d.db.kehadiran.set(`${acaraLain}|${aku}`, { eventId: acaraLain, address: aku, cell: "qqguv1r", seenAtMs: 1 });
    d.hadirkan(alamat(0xb));
    await aturProfil(await masukan(d, { visibilitas: "tersembunyi" }), d.deps);
    expect([...d.db.kehadiran.values()].map((b) => b.address)).toEqual([alamat(0xb)]);
    expect(d.db.profil.get(aku)?.visibilitas).toBe("tersembunyi");
  });

  it("tetap Terlihat tidak menghapus kehadiran", async () => {
    const d = duniaRadar();
    d.hadirkan(AKU.address.toLowerCase() as `0x${string}`);
    await aturProfil(await masukan(d, { visibilitas: "terlihat" }), d.deps);
    expect(d.db.kehadiran.size).toBe(1);
  });
});

describe("ambilProfilSaya", () => {
  it("hanya displayName dan visibilitas; default untuk profil yang belum ada", async () => {
    const d = duniaRadar();
    expect(await ambilProfilSaya(AKU.address, d.deps)).toEqual({ displayName: "", visibilitas: "terlihat" });
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/profil-gate.test.ts`
Expected: FAIL — `../src/profil-gate` tidak ditemukan.

- [ ] **Step 2: Buat `apps/api/src/profil-gate.ts`**

```ts
import type { Address, Hex } from "viem";
import { periksaNamaTampilan, recoverAturProfilSigner, type Visibilitas } from "@nearly/shared";
import type { ProfilDeps, ProfilSaya } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

/** `expiresAt` paling jauh satu jam ke depan (spec 4b+5 §7.2 langkah 2). */
export const MAKS_UMUR_ATUR_PROFIL_DETIK = 60 * 60;

export type ProfilFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "nama_tidak_sah"; httpStatus: 400 };

export type ProfilResult<T> = { ok: true; value: T } | { ok: false; failure: ProfilFailure };

const fail = (failure: ProfilFailure): { ok: false; failure: ProfilFailure } => ({ ok: false, failure });

export type AturProfilInput = {
  who: Address; displayName: string; visibilitas: Visibilitas; expiresAt: bigint; sig: Hex;
};

/**
 * `POST /profil`, langkah 2–5 (spec 4b+5 §7.2). Langkah 1 (badan) milik rute.
 *
 * Nama diperiksa SETELAH tanda tangan: tanpa tanda tangan sah, tidak ada yang
 * bisa memakai rute ini untuk menguji aturan nama. Yang disimpan adalah nama
 * setelah trim, sedangkan yang ditandatangani adalah nama apa adanya — HP
 * mengirim nama yang sudah di-trim, jadi keduanya sama pada jalur normal.
 */
export async function aturProfil(input: AturProfilInput, deps: ProfilDeps): Promise<ProfilResult<void>> {
  const nowMs = deps.nowMs();
  const exp = Number(input.expiresAt);
  if (nowMs > exp * 1000 || exp > Math.floor(nowMs / 1000) + MAKS_UMUR_ATUR_PROFIL_DETIK) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  // Lewat pulihkanTandaTangan: byte `v` cacat membuat viem melempar → 401, bukan 500.
  const signer = await pulihkanTandaTangan(() => recoverAturProfilSigner(
    { who: input.who, displayName: input.displayName, visibilitas: input.visibilitas, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.who.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  const nama = periksaNamaTampilan(input.displayName);
  if (!nama.ok) return fail({ code: "nama_tidak_sah", httpStatus: 400 });

  // Upsert DULU, baru hapus kehadiran. Urutan terbalik membuka celah: detak
  // yang tiba di antaranya masih membaca `terlihat` dan menulis baris baru.
  await deps.profilSaya.aturProfil(input.who, { displayName: nama.nama, visibilitas: input.visibilitas });
  if (input.visibilitas === "tersembunyi") await deps.radar.hapusSemuaKehadiran(input.who);
  return { ok: true, value: undefined };
}

/** `GET /profil/saya`. Pemanggil sudah terautentikasi sesi (R1). Hanya dua kunci ini. */
export async function ambilProfilSaya(pemanggil: Address, deps: ProfilDeps): Promise<ProfilSaya> {
  const p = await deps.profilSaya.profilSaya(pemanggil);
  return { displayName: p.displayName, visibilitas: p.visibilitas };
}
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run test/profil-gate.test.ts && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/profil-gate.ts apps/api/test/profil-gate.test.ts
git commit -m "feat(api): gerbang profil — AturProfil, aturan nama, Tersembunyi menghapus kehadiran

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Mutasi — urutan gerbang profil**

Setelah commit: di `aturProfil`, pindahkan dua baris
```ts
  const nama = periksaNamaTampilan(input.displayName);
  if (!nama.ok) return fail({ code: "nama_tidak_sah", httpStatus: 400 });
```
ke tepat SEBELUM komentar `// Lewat pulihkanTandaTangan: …`.
Run: `pnpm --filter @nearly/api exec vitest run test/profil-gate.test.ts`
Expected MERAH: `urutan: tanda tangan salah + nama bidi → bad_signature`. Kembalikan: `git checkout -- apps/api/src/profil-gate.ts`; run ulang → PASS; `git status --short` → kosong.

---

## Task 12: Rute radar dan profil, perakitan API

**Files:**
- Create: `apps/api/src/baca-request-sesi.ts`, `apps/api/src/routes/radar.ts`, `apps/api/src/routes/profil.ts`
- Modify (hanya penambahan): `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/deps.ts`, `apps/api/test/handshake.route.test.ts`
- Test: `apps/api/test/radar.route.test.ts`, `apps/api/test/profil.route.test.ts`

**Interfaces:**
- Consumes: `pemanggilPesan`, `RequestPesan` (`apps/api/src/pesan-auth.ts`, hanya dipanggil); `DetakRequestSchema`, `AturProfilRequestSchema`, `aturProfilTypedData`, `tandaRequest` (`@nearly/shared`); `detak`, `lihatRadar` (Task 9); `kirimNotifKedekatan` (Task 10); `aturProfil`, `ambilProfilSaya` (Task 11); `buatPenyapuLokasi`, `sapuLokasiAman` (Task 7); `createRadarStore` (Task 6); `createProfilSayaStore` (Task 8); `buatPengguna` (`apps/api/test/support/dunia-pesan.ts`, hanya dipanggil); `duniaRadar` (Task 9).
- Produces:
  - `bacaRequestSesi(c: Context): Promise<RequestPesan>`, `uraiJsonAman(teks: string): unknown`
  - `radarRoutes(deps: RadarDeps): Hono` — `POST /radar/:eventId/detak`, `GET /radar/:eventId`
  - `profilRoutes(deps: ProfilDeps): Hono` — `POST /profil`, `GET /profil/saya`
  - `TrustDeps` mendapat `radar: RadarStore` dan `profilSaya: ProfilSayaStore`

- [ ] **Step 1: Tulis tes rute radar yang gagal**

`apps/api/test/radar.route.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { tandaRequest } from "@nearly/shared";
import { radarRoutes } from "../src/routes/radar";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";
import { buatPengguna } from "./support/dunia-pesan";
import { duniaRadar, EVENT_RADAR, MENIT, SEL_JAUH, SEL_PUSAT } from "./support/dunia-radar";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;
let B: Pengguna;

beforeEach(async () => {
  [A, B] = await Promise.all([buatPengguna("a1"), buatPengguna("b2")]);
});

const tunggu = () => new Promise((r) => setTimeout(r, 0));

function dunia(awal: Parameters<typeof duniaRadar>[0] = {}) {
  const d = duniaRadar({ checkIn: [A.address, B.address], ...awal });
  for (const p of [A, B]) d.db.kunci.set(p.address.toLowerCase(), p.terdaftar);
  const app = new Hono().route("/", radarRoutes(d.deps));

  async function panggil(p: Pengguna, method: "GET" | "POST", path: string, body?: unknown, over: { badanDikirim?: string } = {}) {
    const badan = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = tandaRequest(p.kunci.privTanda, { method, pathDenganQuery: path, badan, ts, who: p.address });
    return app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-nearly-who": p.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda },
      body: method === "GET" ? undefined : (over.badanDikirim ?? badan),
    });
  }
  const detak = (p: Pengguna, cell = SEL_PUSAT) => panggil(p, "POST", `/radar/${EVENT_RADAR}/detak`, { cell });
  const radar = (p: Pengguna) => panggil(p, "GET", `/radar/${EVENT_RADAR}`);
  return { d, app, panggil, detak, radar };
}

describe("POST /radar/:eventId/detak — langkah 1 dan 2 di rute", () => {
  it("tanpa header → 401 butuh_autentikasi", async () => {
    const { app } = dunia();
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cell: SEL_PUSAT }),
    });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: "butuh_autentikasi" });
  });

  it("urutan: tanpa header DENGAN badan sampah → 401, bukan 400", async () => {
    const { app } = dunia();
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "sampah",
    });
    expect(r.status).toBe(401);
  });

  it("pemanggil tanpa kunci sesi terdaftar → 401 yang sama", async () => {
    const { d, detak } = dunia();
    d.db.kunci.delete(A.address.toLowerCase());
    const r = await detak(A);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: "butuh_autentikasi" });
  });

  it("badan diubah setelah ditandatangani → 401", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/${EVENT_RADAR}/detak`, { cell: SEL_PUSAT }, {
      badanDikirim: JSON.stringify({ cell: SEL_JAUH }),
    });
    expect(r.status).toBe(401);
  });

  it("sel bukan geohash7 → 400 invalid_body", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/${EVENT_RADAR}/detak`, { cell: "bukan" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: "invalid_body" });
  });

  it("urutan: badan tidak sah untuk acara yang tidak ada → 400, bukan 404", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/0x${"99".repeat(32)}/detak`, { cell: "bukan" });
    expect(r.status).toBe(400);
  });

  it("eventId cacat bentuk → 404 event_not_found", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", "/radar/bukan-id/detak", { cell: SEL_PUSAT });
    expect(r.status).toBe(404);
  });
});

describe("POST /radar/:eventId/detak — jawaban", () => {
  it("hadir: kunci JSON persis { hadir }", async () => {
    const { detak } = dunia();
    const r = await detak(A);
    expect(r.status).toBe(200);
    const json = await r.json() as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(["hadir"]);
    expect(json).toEqual({ hadir: true });
  });

  it("di luar area: kunci JSON persis { hadir, alasan } — tanpa baruHadir", async () => {
    const { detak } = dunia();
    const json = await (await detak(A, SEL_JAUH)).json() as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["alasan", "hadir"]);
    expect(json).toEqual({ hadir: false, alasan: "di_luar_area" });
  });

  it("galat gerbang diteruskan dengan status HTTP-nya", async () => {
    const { d, detak } = dunia({ checkIn: [] });
    for (const p of [A, B]) d.db.kunci.set(p.address.toLowerCase(), p.terdaftar);
    const r = await detak(A);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: "belum_check_in" });
  });
});

describe("notifikasi kedekatan dari rute", () => {
  it("transisi tidak hadir → hadir memicu notifikasi tepat sekali; detak lanjutan tidak", async () => {
    const { d, detak } = dunia({
      koneksi: [[A.address, B.address]],
      token: { [A.address]: ["ExponentPushToken[a]"], [B.address]: ["ExponentPushToken[b]"] },
    });
    d.hadirkan(B.address);
    expect((await detak(A)).status).toBe(200);
    await tunggu();
    expect(d.push.kirim).toHaveBeenCalledTimes(2); // dua arah, satu pasangan

    d.jam.sekarang += MENIT;
    expect((await detak(A)).status).toBe(200);
    await tunggu();
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
    expect(d.deps.radar.hadirSejak).toHaveBeenCalledTimes(1);
  });

  it("push yang gagal tidak menggagalkan detak", async () => {
    const { d, detak } = dunia({ koneksi: [[A.address, B.address]], token: { [B.address]: ["ExponentPushToken[b]"] } });
    d.hadirkan(B.address);
    d.push.kirim.mockRejectedValue(new Error("expo mati"));
    expect((await detak(A)).status).toBe(200);
    await tunggu();
  });

  it("detak yang lolos memicu sapuan lokasi paling sering sekali per 10 menit", async () => {
    const { d, detak } = dunia();
    await detak(A);
    d.jam.sekarang += MENIT;
    await detak(A);
    await tunggu();
    expect(d.deps.radar.sapuLokasi).toHaveBeenCalledTimes(1);
  });
});

describe("GET /radar/:eventId", () => {
  it("tanpa header → 401", async () => {
    const { app } = dunia();
    expect((await app.request(`/radar/${EVENT_RADAR}`)).status).toBe(401);
  });

  it("belum hadir → 403 belum_hadir", async () => {
    const { radar } = dunia();
    const r = await radar(A);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: "belum_hadir" });
  });

  // Spec 4b+5 §5.2 dan §11: nama KUNCI, bukan hanya nilai.
  it("nama kunci JSON: { kartu, jumlah }, kartu hanya kunci yang diizinkan, tanpa cell/seen_at/skor", async () => {
    const { d, detak, radar } = dunia({
      koneksi: [[A.address, B.address]], nama: { [B.address]: "Budi" }, tier: { [B.address]: 2 },
    });
    d.hadirkan(B.address);
    await detak(A);
    const r = await radar(A);
    expect(r.status).toBe(200);
    const teks = await r.text();
    const json = JSON.parse(teks) as { kartu: Record<string, unknown>[]; jumlah: number };

    expect(Object.keys(json).sort()).toEqual(["jumlah", "kartu"]);
    expect(json.kartu).toHaveLength(1);
    expect(Object.keys(json.kartu[0]!).sort()).toEqual(
      ["address", "displayName", "pernahBertemu", "salingInginBertemu", "tierLabel"],
    );
    expect(json.kartu[0]).toEqual({
      address: B.address.toLowerCase(), displayName: "Budi", tierLabel: "Terpercaya",
      pernahBertemu: true, salingInginBertemu: false,
    });
    for (const terlarang of ["cell", "seen_at", "seenAt", "score", "skor", "tier\"", "ratio", SEL_PUSAT]) {
      expect(teks).not.toContain(terlarang);
    }
  });

  it("A memblokir B → keduanya saling tidak terlihat lewat HTTP", async () => {
    const { d, detak, radar } = dunia({ blokir: [{ blocker: A.address, blocked: B.address }] });
    await detak(A);
    await detak(B);
    expect(await (await radar(A)).json()).toEqual({ kartu: [], jumlah: 0 });
    expect(await (await radar(B)).json()).toEqual({ kartu: [], jumlah: 0 });
    expect(d.db.kehadiran.size).toBe(2);
  });
});

describe("perakitan createApp", () => {
  it("rute radar terpasang: tanpa header → 401", async () => {
    const app = createApp(depsFor());
    expect((await app.request(`/radar/${EVENT_RADAR}`)).status).toBe(401);
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, { method: "POST", body: "{}" });
    expect(r.status).toBe(401);
  });
});
```

- [ ] **Step 2: Tulis tes rute profil yang gagal**

`apps/api/test/profil.route.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Hex } from "viem";
import { aturProfilTypedData, tandaRequest } from "@nearly/shared";
import { profilRoutes } from "../src/routes/profil";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";
import { buatPengguna } from "./support/dunia-pesan";
import { duniaRadar, EVENT_RADAR, VC_RADAR } from "./support/dunia-radar";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;

beforeEach(async () => {
  A = await buatPengguna("a1");
});

function dunia() {
  const d = duniaRadar();
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  const app = new Hono().route("/", profilRoutes(d.deps));

  async function simpan(over: { displayName?: string; visibilitas?: "terlihat" | "tersembunyi"; sig?: Hex } = {}) {
    const msg = {
      who: A.address, displayName: over.displayName ?? "Budi", visibilitas: over.visibilitas ?? "terlihat",
      expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) + 300),
    } as const;
    const sig = over.sig ?? await A.akun.signTypedData(aturProfilTypedData(msg, VC_RADAR));
    return app.request("/profil", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: msg.expiresAt.toString(), sig }),
    });
  }

  async function saya() {
    const path = "/profil/saya";
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = tandaRequest(A.kunci.privTanda, { method: "GET", pathDenganQuery: path, badan: "", ts, who: A.address });
    return app.request(path, { headers: { "x-nearly-who": A.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda } });
  }
  return { d, app, simpan, saya };
}

describe("POST /profil", () => {
  it("sah → 200 { ok: true }, lalu GET /profil/saya membacanya", async () => {
    const { simpan, saya } = dunia();
    const r = await simpan({ displayName: "  Budi  ", visibilitas: "tersembunyi" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await (await saya()).json()).toEqual({ displayName: "Budi", visibilitas: "tersembunyi" });
  });

  it("badan tidak sah → 400 invalid_body", async () => {
    const { app } = dunia();
    const r = await app.request("/profil", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: "invalid_body" });
  });

  it("tanda tangan cacat bentuk → 401 bad_signature, bukan 500", async () => {
    const { simpan } = dunia();
    const r = await simpan({ sig: `0x${"99".repeat(65)}` as Hex });
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ code: "bad_signature" });
  });

  it("nama bidi → 400 nama_tidak_sah", async () => {
    const { simpan } = dunia();
    const r = await simpan({ displayName: "Budi‮gnp" });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "nama_tidak_sah" });
  });

  it("pindah ke Tersembunyi lewat HTTP menghapus kehadiran", async () => {
    const { d, simpan } = dunia();
    d.hadirkan(A.address.toLowerCase() as Hex);
    expect(d.db.kehadiran.has(`${EVENT_RADAR}|${A.address.toLowerCase()}`)).toBe(true);
    await simpan({ visibilitas: "tersembunyi" });
    expect(d.db.kehadiran.size).toBe(0);
  });
});

describe("GET /profil/saya", () => {
  it("tanpa header → 401", async () => {
    const { app } = dunia();
    expect((await app.request("/profil/saya")).status).toBe(401);
  });

  it("nama kunci JSON persis { displayName, visibilitas }", async () => {
    const { saya } = dunia();
    const json = await (await saya()).json() as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["displayName", "visibilitas"]);
  });
});

describe("perakitan createApp", () => {
  it("rute profil terpasang", async () => {
    const app = createApp(depsFor());
    expect((await app.request("/profil/saya")).status).toBe(401);
    expect((await app.request("/profil", { method: "POST", body: "{}" })).status).toBe(400);
  });
});
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar.route.test.ts test/profil.route.test.ts`
Expected: FAIL — `../src/routes/radar` dan `../src/routes/profil` tidak ditemukan.

- [ ] **Step 3: Buat `apps/api/src/baca-request-sesi.ts`**

```ts
import type { Context } from "hono";
import type { RequestPesan } from "./pesan-auth";

/**
 * Salinan `bacaRequest` dan `uraiJson` dari routes/pesan.ts, dengan sengaja:
 * spec 4b+5 §12 melarang mengubah kode Fase 4c selain memanggilnya, jadi
 * fungsi privat di sana tidak diekspor ulang.
 *
 * Badan dibaca sebagai TEKS satu kali — hash-nya masuk tanda tangan sesi —
 * lalu diurai dari teks yang sama.
 */
export async function bacaRequestSesi(c: Context): Promise<RequestPesan> {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    pathDenganQuery: url.pathname + url.search,
    badan: await c.req.text(),
    header: (nama) => c.req.header(nama),
  };
}

export function uraiJsonAman(teks: string): unknown {
  try { return JSON.parse(teks); } catch { return null; }
}
```

- [ ] **Step 4: Buat `apps/api/src/routes/radar.ts`**

```ts
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Hex } from "viem";
import { DetakRequestSchema } from "@nearly/shared";
import { bacaRequestSesi, uraiJsonAman } from "../baca-request-sesi";
import { pemanggilPesan } from "../pesan-auth";
import { buatPenyapuLokasi } from "../penyapu-lokasi";
import type { RadarDeps } from "../ports";
import { detak, lihatRadar } from "../radar-gate";
import { kirimNotifKedekatan } from "../radar-notif";

const BUTUH_AUTENTIKASI = { code: "butuh_autentikasi" } as const;
const EVENT_ID = /^0x[0-9a-fA-F]{64}$/;

export function radarRoutes(deps: RadarDeps) {
  const r = new Hono();
  const penyapu = buatPenyapuLokasi({ radar: deps.radar, nowMs: deps.nowMs });

  // Diautentikasi sesi Ed25519 Fase 4c (R1): polling tidak boleh memunculkan
  // popup dompet. Urutan spec 4b+5 §5.1: sesi → badan → acara → … .
  r.post(
    "/radar/:eventId/detak",
    bodyLimit({ maxSize: 1024, onError: (c) => c.json({ code: "terlalu_besar" }, 413) }),
    async (c) => {
      const req = await bacaRequestSesi(c);
      const pemanggil = await pemanggilPesan(req, deps);
      if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
      const parsed = DetakRequestSchema.safeParse(uraiJsonAman(req.badan));
      if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
      // eventId cacat bentuk diperlakukan sama dengan acara yang tidak ada.
      const eventId = c.req.param("eventId");
      if (!EVENT_ID.test(eventId)) return c.json({ code: "event_not_found", httpStatus: 404 }, 404);

      const hasil = await detak(pemanggil, eventId.toLowerCase() as Hex, parsed.data.cell, deps);
      if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

      if (hasil.value.baruHadir) {
        // TANPA await, dengan sengaja (spec 4b+5 §6.5). Dijamin tidak pernah melempar.
        void kirimNotifKedekatan(deps, { eventId: eventId.toLowerCase() as Hex, subjek: pemanggil });
      }
      if (hasil.value.jawaban.hadir) penyapu.mungkinSapu();
      // HANYA `jawaban` — `baruHadir` tidak pernah keluar.
      return c.json(hasil.value.jawaban);
    },
  );

  r.get("/radar/:eventId", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequestSesi(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const eventId = c.req.param("eventId");
    if (!EVENT_ID.test(eventId)) return c.json({ code: "event_not_found", httpStatus: 404 }, 404);
    const hasil = await lihatRadar(pemanggil, eventId.toLowerCase() as Hex, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ kartu: hasil.value.kartu, jumlah: hasil.value.jumlah });
  });

  return r;
}
```

- [ ] **Step 5: Buat `apps/api/src/routes/profil.ts`**

```ts
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Address, Hex } from "viem";
import { AturProfilRequestSchema } from "@nearly/shared";
import { bacaRequestSesi } from "../baca-request-sesi";
import { pemanggilPesan } from "../pesan-auth";
import type { ProfilDeps } from "../ports";
import { ambilProfilSaya, aturProfil } from "../profil-gate";

export function profilRoutes(deps: ProfilDeps) {
  const r = new Hono();

  // Tanpa header sesi: identitas dibuktikan tanda tangan EIP-712 `AturProfil`
  // dompet (R2), sama seperti POST /blokir.
  r.post(
    "/profil",
    bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ code: "terlalu_besar" }, 413) }),
    async (c) => {
      const parsed = AturProfilRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
      const b = parsed.data;
      const hasil = await aturProfil({
        who: b.who as Address, displayName: b.displayName, visibilitas: b.visibilitas,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      }, deps);
      if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
      return c.json({ ok: true });
    },
  );

  // Tidak ada cara membaca visibilitas orang lain (spec 4b+5 §7.3).
  r.get("/profil/saya", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequestSesi(c), deps);
    if (!pemanggil) return c.json({ code: "butuh_autentikasi" }, 401);
    return c.json(await ambilProfilSaya(pemanggil, deps));
  });

  return r;
}
```

- [ ] **Step 6: Rakit di `apps/api/src/app.ts` (hanya penambahan)**

1. Tambahkan dua baris tepat di bawah `import { pesanRoutes } from "./routes/pesan";`:
   ```ts
   import { radarRoutes } from "./routes/radar";
   import { profilRoutes } from "./routes/profil";
   ```
2. Tambahkan satu baris tepat di bawah blok `import type { … } from "./ports";` yang sudah ada (JANGAN mengubah blok itu):
   ```ts
   import type { RadarStore, ProfilSayaStore } from "./ports";
   ```
3. Di tipe `TrustDeps`, tambahkan dua baris tepat setelah `  push: PushPort | null;` (sebelum `};`):
   ```ts
     radar: RadarStore;
     profilSaya: ProfilSayaStore;
   ```
4. Di `createApp`, tambahkan tepat setelah `  app.route("/", pesanRoutes(deps));` (sebelum `  return app;`):
   ```ts
     // `onChanged` TIDAK dipanggil dari rute radar dan profil — hadir di acara dan
     // mengganti nama bukan bertemu, jadi graf pertemuan tidak berubah.
     app.route("/", radarRoutes(deps));
     app.route("/", profilRoutes(deps));
   ```

- [ ] **Step 7: Rakit di `apps/api/src/index.ts` (hanya penambahan)**

1. Tambahkan tiga baris tepat di bawah `import { createExpoPush } from "./push";`:
   ```ts
   import { createRadarStore } from "./radar-store";
   import { createProfilSayaStore } from "./profil-store";
   import { sapuLokasiAman } from "./penyapu-lokasi";
   ```
2. Di objek `createApp({ … })`, tambahkan dua baris tepat setelah `  push: createExpoPush(),`:
   ```ts
     radar: createRadarStore(supabase),
     profilSaya: createProfilSayaStore(supabase),
   ```
3. Tambahkan di AKHIR berkas (setelah `console.log("API Nearly berjalan …")`):
   ```ts

   // Fase 4b + 5 (spec §4.5, R3): sapuan lokasi saat API mulai. Tanpa await dan
   // tidak pernah melempar; rute detak dan tools/sapu-lokasi.ts menyusul.
   void sapuLokasiAman(createRadarStore(supabase), Date.now());
   ```

- [ ] **Step 8: Stub di `apps/api/test/support/deps.ts` (hanya penambahan)**

Tambahkan tepat setelah baris `    push: null,` (sebelum `  };` penutup objek yang dikembalikan `depsFor`):

```ts
    // Fase 4b + 5: rute radar dan profil diuji lewat dunia-radar.ts, tapi
    // TrustDeps butuh medan ini supaya createApp bisa dibangun.
    radar: {
      ambilKehadiran: vi.fn(async () => null),
      simpanKehadiran: vi.fn(async () => {}),
      hapusKehadiran: vi.fn(async () => {}),
      hapusSemuaKehadiran: vi.fn(async () => {}),
      hadirSejak: vi.fn(async () => []),
      terhubungDengan: vi.fn(async () => new Set<string>()),
      hitungNotifKedekatan: vi.fn(async () => 0),
      sisipNotifKedekatan: vi.fn(async () => true),
      sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
    },
    profilSaya: {
      profilSaya: vi.fn(async () => ({ displayName: "", visibilitas: "terlihat" as const })),
      aturProfil: vi.fn(async () => {}),
      visibilitasBanyak: vi.fn(async () => new Map()),
    },
```

- [ ] **Step 9: Stub di `apps/api/test/handshake.route.test.ts` (hanya penambahan, Ruling P18)**

Berkas ini membangun `TrustDeps` sendiri tanpa cast, jadi typecheck gagal tanpa medan baru. Tambahkan tepat setelah baris `    push: null,` di fungsi `deps`:

```ts
    // Stub Fase 4b + 5: createApp mendaftarkan radarRoutes dan profilRoutes.
    radar: {
      ambilKehadiran: async () => null,
      simpanKehadiran: async () => {},
      hapusKehadiran: async () => {},
      hapusSemuaKehadiran: async () => {},
      hadirSejak: async () => [],
      terhubungDengan: async () => new Set<string>(),
      hitungNotifKedekatan: async () => 0,
      sisipNotifKedekatan: async () => true,
      sapuLokasi: async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 }),
    },
    profilSaya: {
      profilSaya: async () => ({ displayName: "", visibilitas: "terlihat" as const }),
      aturProfil: async () => {},
      visibilitasBanyak: async () => new Map(),
    },
```

- [ ] **Step 10: Jalankan seluruh tes API dan typecheck**

Run: `pnpm --filter @nearly/api exec vitest run && pnpm --filter @nearly/api exec tsc --noEmit`
Expected: PASS — seluruh berkas tes API, termasuk tes 4c yang lama.

- [ ] **Step 11: Pastikan berkas bersama hanya bertambah**

Run: `git diff -- apps/api/src/app.ts apps/api/src/index.ts apps/api/test/support/deps.ts | grep '^-' | grep -v '^---'`
Expected: kosong (exit 1).

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/baca-request-sesi.ts apps/api/src/routes/radar.ts apps/api/src/routes/profil.ts \
  apps/api/src/app.ts apps/api/src/index.ts apps/api/test/support/deps.ts \
  apps/api/test/handshake.route.test.ts apps/api/test/radar.route.test.ts apps/api/test/profil.route.test.ts
git commit -m "feat(api): rute radar dan profil, sapuan lokasi saat API mulai

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 13: Mutasi — nama kunci JSON dan urutan sesi → badan**

Jalankan sungguhan setelah commit; kembalikan dengan `git checkout -- apps/api/src/routes/radar.ts`. Perintah: `pnpm --filter @nearly/api exec vitest run test/radar.route.test.ts`.

**Mutasi A (`baruHadir` bocor):** ganti `      return c.json(hasil.value.jawaban);` dengan `      return c.json(hasil.value);`.
Expected MERAH: `hadir: kunci JSON persis { hadir }`, `di luar area: kunci JSON persis { hadir, alasan } — tanpa baruHadir`.

**Mutasi B (badan sebelum sesi):** di `POST /radar/:eventId/detak`, pindahkan dua baris
```ts
      const parsed = DetakRequestSchema.safeParse(uraiJsonAman(req.badan));
      if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
```
ke tepat SEBELUM `      const pemanggil = await pemanggilPesan(req, deps);`.
Expected MERAH: `urutan: tanpa header DENGAN badan sampah → 401, bukan 400`, `rute radar terpasang: tanpa header → 401`.

Run ulang → PASS; `git status --short` → kosong.

---

## Task 13: Mobile — klien radar, kalimat keadaan, dan rute notifikasi

**Files:**
- Create: `apps/mobile/src/radar/radar-api.ts`
- Modify: `apps/mobile/src/messages.ts` (satu impor + tambah di akhir), `apps/mobile/src/pesan/rute-push.ts` (Ruling P15), `apps/mobile/test/rute-push.test.ts` (tambah di akhir)
- Test: `apps/mobile/test/radar-messages.test.ts`, `apps/mobile/test/radar-api.test.ts`

**Interfaces:**
- Consumes: `reqPesan` (`apps/mobile/src/pesan/pesan-api.ts`), `SesiPesan` (`apps/mobile/src/pesan/sesi.ts`), `postJson` (`apps/mobile/src/http.ts`), `PenandaSigner` (`apps/mobile/src/meet-api.ts`), `CONFIG` (`apps/mobile/src/config.ts`), `KALIMAT_SERVER_TAK_TERJANGKAU`, `GALAT_JARINGAN` (sudah ada di `messages.ts`); `aturProfilTypedData`, `recoverAturProfilSigner`, `MAKS_NAMA_TAMPILAN`, `panjangNamaTampilan`, `Visibilitas`, `turunkanKunciPesan`, `verifikasiRequest` (`@nearly/shared`).
- Produces:
  - `type JawabanDetakApi`, `type KartuRadarApi = { address: string; displayName: string; tierLabel: string; pernahBertemu: boolean; salingInginBertemu: boolean }`
  - `postDetak(sesi: SesiPesan, eventId: string, cell: string): Promise<JawabanDetakApi>`
  - `getRadar(sesi: SesiPesan, eventId: string): Promise<{ kartu: KartuRadarApi[]; jumlah: number }>`
  - `getProfilSaya(sesi: SesiPesan): Promise<{ displayName: string; visibilitas: Visibilitas }>`
  - `simpanProfil(signer: PenandaSigner, profil: { displayName: string; visibilitas: Visibilitas }): Promise<{ ok: true }>`
  - `messages.ts`: `type KeadaanRadar`, `kalimatRadar(k)`, `keadaanRadarDariDetak(j)`, `keadaanRadarDariKode(code): KeadaanRadar | null`, `lencanaKartuRadar(k): string[]`, `namaKartuRadar(nama)`, `alamatSingkat(address)`, `sisaKarakterNama(nama)`, `kalimatVisibilitas(v)`, `KALIMAT_BATAS_TERSEMBUNYI`, `pesanNamaTidakSah(alasan)`, `profilErrorMessage(code)`, `labelSimpanProfil(sibuk)`
  - ``ruteDariNotifikasi(data: unknown): "/pesan" | `/radar/${string}` | null``

Tes mobile hanya fungsi murni. `radar-api.ts` tidak mengimpor modul Expo, jadi bisa diuji di Node.

- [ ] **Step 1: Tulis tes kalimat yang gagal**

`apps/mobile/test/radar-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  alamatSingkat, KALIMAT_BATAS_TERSEMBUNYI, KALIMAT_SERVER_TAK_TERJANGKAU, kalimatRadar,
  kalimatVisibilitas, keadaanRadarDariDetak, keadaanRadarDariKode, labelSimpanProfil,
  lencanaKartuRadar, namaKartuRadar, pesanNamaTidakSah, profilErrorMessage, sisaKarakterNama,
  type KeadaanRadar,
} from "../src/messages";

const SEMUA_KEADAAN: KeadaanRadar[] = [
  "tersembunyi", "di_luar_area", "belum_check_in", "tidak_berlangsung", "tidak_ditemukan",
  "kosong", "izin_lokasi", "sesi_tidak_sah", "server_tak_terjangkau", "gagal",
];

describe("kalimatRadar — keadaan layar → kalimat (spec 4b+5 §8.2)", () => {
  it("kalimat spec persis", () => {
    expect(kalimatRadar("tersembunyi")).toBe("Kamu sedang Tersembunyi, jadi radar tidak bisa dibuka.");
    expect(kalimatRadar("di_luar_area")).toBe("Kamu terlihat berada di luar area acara.");
    expect(kalimatRadar("belum_check_in")).toBe("Check-in dulu untuk membuka radar.");
    expect(kalimatRadar("tidak_berlangsung")).toBe("Radar hanya aktif selama acara berlangsung.");
    expect(kalimatRadar("kosong")).toBe("Belum ada orang lain yang terlihat di sini.");
    expect(kalimatRadar("izin_lokasi")).toBe("Radar butuh izin lokasi saat aplikasi dibuka.");
    expect(kalimatRadar("server_tak_terjangkau")).toBe(KALIMAT_SERVER_TAK_TERJANGKAU);
  });

  it("setiap keadaan punya kalimatnya sendiri", () => {
    const kalimat = SEMUA_KEADAAN.map(kalimatRadar);
    expect(new Set(kalimat).size).toBe(SEMUA_KEADAAN.length);
    for (const k of kalimat) expect(k.trim().length).toBeGreaterThan(0);
  });

  // Keputusan #7: "Tersembunyi", bukan "hantu"/"ghost".
  it("tidak ada istilah hantu atau ghost di salinan radar dan profil", () => {
    const salinan = [
      ...SEMUA_KEADAAN.map(kalimatRadar), kalimatVisibilitas("terlihat"), kalimatVisibilitas("tersembunyi"),
      KALIMAT_BATAS_TERSEMBUNYI, pesanNamaTidakSah("terlalu_panjang"), pesanNamaTidakSah("karakter_terlarang"),
    ];
    for (const s of salinan) expect(s).not.toMatch(/hantu|ghost/i);
  });
});

describe("keadaanRadarDariDetak", () => {
  it("hadir → null (lanjut ambil radar)", () => {
    expect(keadaanRadarDariDetak({ hadir: true })).toBeNull();
  });
  it("alasan tersembunyi dan di_luar_area", () => {
    expect(keadaanRadarDariDetak({ hadir: false, alasan: "tersembunyi" })).toBe("tersembunyi");
    expect(keadaanRadarDariDetak({ hadir: false, alasan: "di_luar_area" })).toBe("di_luar_area");
  });
});

describe("keadaanRadarDariKode", () => {
  it("setiap kode yang dikembalikan rute radar dipetakan", () => {
    expect(keadaanRadarDariKode("tersembunyi")).toBe("tersembunyi");
    expect(keadaanRadarDariKode("belum_hadir")).toBe("di_luar_area");
    expect(keadaanRadarDariKode("belum_check_in")).toBe("belum_check_in");
    expect(keadaanRadarDariKode("event_tidak_berlangsung")).toBe("tidak_berlangsung");
    expect(keadaanRadarDariKode("event_not_found")).toBe("tidak_ditemukan");
    expect(keadaanRadarDariKode("butuh_autentikasi")).toBe("sesi_tidak_sah");
    expect(keadaanRadarDariKode("server_tak_terjangkau")).toBe("server_tak_terjangkau");
  });
  it("terlalu_cepat bukan keadaan baru", () => {
    expect(keadaanRadarDariKode("terlalu_cepat")).toBeNull();
  });
  it("kode tak dikenal → gagal", () => {
    expect(keadaanRadarDariKode("entah")).toBe("gagal");
  });
});

describe("kartu radar", () => {
  it("lencana: saling dulu, lalu pernah bertemu; tanpa hubungan tanpa lencana", () => {
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: true })).toEqual(["Saling ingin bertemu", "Pernah bertemu"]);
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: false })).toEqual(["Pernah bertemu"]);
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: true })).toEqual(["Saling ingin bertemu"]);
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: false })).toEqual([]);
  });
  it("nama kosong → Tanpa nama", () => {
    expect(namaKartuRadar("  ")).toBe("Tanpa nama");
    expect(namaKartuRadar(" Budi ")).toBe("Budi");
  });
  it("alamat singkat", () => {
    expect(alamatSingkat("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});

describe("penghitung nama", () => {
  it("sisa dari 32 code point setelah trim; emoji dihitung satu", () => {
    expect(sisaKarakterNama("")).toBe(32);
    expect(sisaKarakterNama("  Budi  ")).toBe(28);
    expect(sisaKarakterNama("👍👍")).toBe(30);
    expect(sisaKarakterNama("a".repeat(33))).toBe(-1);
  });
  it("pesan nama tidak sah per alasan", () => {
    expect(pesanNamaTidakSah("terlalu_panjang")).toContain("32");
    expect(pesanNamaTidakSah("karakter_terlarang")).not.toBe(pesanNamaTidakSah("terlalu_panjang"));
  });
});

describe("profil", () => {
  it("setiap kode POST /profil punya kalimatnya sendiri", () => {
    for (const code of ["nama_tidak_sah", "expired", "bad_signature", "butuh_autentikasi", "invalid_body", "server_tak_terjangkau"]) {
      expect(profilErrorMessage(code)).not.toBe("Gagal. Coba lagi sebentar.");
    }
  });
  it("kalimat visibilitas berbeda per mode dan menyebut timbal balik", () => {
    expect(kalimatVisibilitas("tersembunyi")).toMatch(/tidak bisa membuka radar/);
    expect(kalimatVisibilitas("terlihat")).not.toBe(kalimatVisibilitas("tersembunyi"));
  });
  it("batas Tersembunyi menyebut on-chain", () => {
    expect(KALIMAT_BATAS_TERSEMBUNYI).toMatch(/on-chain/);
  });
  it("label simpan", () => {
    expect(labelSimpanProfil(false)).toBe("Simpan");
    expect(labelSimpanProfil(true)).toBe("Menyimpan…");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/radar-messages.test.ts`
Expected: FAIL — `kalimatRadar` bukan fungsi.

- [ ] **Step 2: Tambahkan ke `apps/mobile/src/messages.ts`**

1. Tambahkan impor tepat di bawah baris `import { MAKS_BUKTI_LAPORAN, MIN_ALASAN_LAPORAN } from "./pesan/pesan-actions";`:
   ```ts
   import { MAKS_NAMA_TAMPILAN, panjangNamaTampilan, type Visibilitas } from "@nearly/shared";
   ```
2. Tambahkan di AKHIR berkas:

```ts
// ── Fase 4b + 5: radar dan profil ───────────────────────────────────────────

/** Keadaan layar Radar yang punya kalimatnya sendiri (spec 4b+5 §8.2). */
export type KeadaanRadar =
  | "tersembunyi" | "di_luar_area" | "belum_check_in" | "tidak_berlangsung" | "tidak_ditemukan"
  | "kosong" | "izin_lokasi" | "sesi_tidak_sah" | "server_tak_terjangkau" | "gagal";

const KALIMAT_RADAR: Record<KeadaanRadar, string> = {
  tersembunyi: "Kamu sedang Tersembunyi, jadi radar tidak bisa dibuka.",
  di_luar_area: "Kamu terlihat berada di luar area acara.",
  belum_check_in: "Check-in dulu untuk membuka radar.",
  tidak_berlangsung: "Radar hanya aktif selama acara berlangsung.",
  tidak_ditemukan: "Acara ini tidak ditemukan.",
  kosong: "Belum ada orang lain yang terlihat di sini.",
  izin_lokasi: "Radar butuh izin lokasi saat aplikasi dibuka.",
  sesi_tidak_sah: "Sesi tidak sah. Tutup lalu buka lagi layar ini.",
  server_tak_terjangkau: KALIMAT_SERVER_TAK_TERJANGKAU,
  gagal: "Radar gagal dimuat. Coba lagi sebentar.",
};

export function kalimatRadar(keadaan: KeadaanRadar): string {
  return KALIMAT_RADAR[keadaan];
}

/**
 * Jawaban detak → keadaan layar. `null` berarti hadir: lanjut ambil radar.
 * Langkah 7 dan 8 gerbang detak bukan galat — jawabannya yang memberi tahu
 * layar apa yang ditampilkan.
 */
export function keadaanRadarDariDetak(
  jawaban: { hadir: true } | { hadir: false; alasan: "tersembunyi" | "di_luar_area" },
): KeadaanRadar | null {
  if (jawaban.hadir) return null;
  return jawaban.alasan === "tersembunyi" ? "tersembunyi" : "di_luar_area";
}

/**
 * Kode galat API (detak atau radar) → keadaan layar.
 *
 * `null` untuk `terlalu_cepat` SAJA: layar yang dibuka-tutup cepat berdetak
 * lagi sebelum 20 detik, dan kehadiran dari detak sebelumnya masih berlaku —
 * itu bukan keadaan baru, jadi layar tetap mengambil radar.
 */
export function keadaanRadarDariKode(code: string): KeadaanRadar | null {
  switch (code) {
    case "terlalu_cepat": return null;
    case "tersembunyi": return "tersembunyi";
    case "belum_hadir": return "di_luar_area";
    case "belum_check_in": return "belum_check_in";
    case "event_tidak_berlangsung": return "tidak_berlangsung";
    case "event_not_found": return "tidak_ditemukan";
    case "butuh_autentikasi": return "sesi_tidak_sah";
    case "server_tak_terjangkau": return "server_tak_terjangkau";
    default: return "gagal";
  }
}

/** Lencana kartu radar, yang terkuat dulu. Tidak ada lencana untuk tanda sepihak. */
export function lencanaKartuRadar(k: { pernahBertemu: boolean; salingInginBertemu: boolean }): string[] {
  const lencana: string[] = [];
  if (k.salingInginBertemu) lencana.push("Saling ingin bertemu");
  if (k.pernahBertemu) lencana.push("Pernah bertemu");
  return lencana;
}

export function namaKartuRadar(displayName: string): string {
  return displayName.trim() || "Tanpa nama";
}

/** `0x1234…abcd`. Alamat SELALU tampil di sebelah nama — nama tidak unik (spec induk §9.2). */
export function alamatSingkat(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Penghitung isian nama: sisa code point setelah trim. Negatif berarti kelebihan. */
export function sisaKarakterNama(nama: string): number {
  return MAKS_NAMA_TAMPILAN - panjangNamaTampilan(nama);
}

/** Satu kalimat per mode, di layar Profil saya (spec 4b+5 §8.1). */
export function kalimatVisibilitas(v: Visibilitas): string {
  return v === "terlihat"
    ? "Orang lain di acara yang sama bisa melihatmu di radar, dan kamu bisa membuka radar."
    : "Kamu tidak muncul di radar dan tidak memicu notifikasi kedekatan — tapi kamu juga tidak bisa membuka radar.";
}

/** Batas yang diakui spec 4b+5 §10.3 — wajib disebut di layar Profil saya. */
export const KALIMAT_BATAS_TERSEMBUNYI =
  "Tersembunyi tidak menyembunyikan salaman dan check-in: keduanya tetap tercatat publik on-chain.";

export function pesanNamaTidakSah(alasan: "terlalu_panjang" | "karakter_terlarang"): string {
  return alasan === "terlalu_panjang"
    ? `Nama paling panjang ${MAKS_NAMA_TAMPILAN} karakter.`
    : "Nama memuat karakter tak terlihat atau pengatur arah teks. Hapus karakter itu lalu coba lagi.";
}

const PROFIL_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  nama_tidak_sah: "Nama tidak sah. Periksa panjang dan karakternya.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  butuh_autentikasi: "Sesi tidak sah. Tutup lalu buka lagi layar ini.",
  invalid_body: "Ada isian yang belum benar.",
};

export function profilErrorMessage(code: string): string {
  return PROFIL_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

export function labelSimpanProfil(sibuk: boolean): string {
  return sibuk ? "Menyimpan…" : "Simpan";
}
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/radar-messages.test.ts`
Expected: PASS.

- [ ] **Step 3: Tambahkan tes rute radar yang gagal**

Tambahkan di AKHIR `apps/mobile/test/rute-push.test.ts`:

```ts
describe("ruteDariNotifikasi — radar (spec 4b+5 §8.3)", () => {
  const EVENT = `0x${"e1".repeat(32)}`;

  it("jenis radar dengan eventId sah membuka radar acara itu", () => {
    expect(ruteDariNotifikasi({ jenis: "radar", eventId: EVENT })).toBe(`/radar/${EVENT}`);
  });

  it("eventId berhuruf besar dinormalkan ke huruf kecil", () => {
    expect(ruteDariNotifikasi({ jenis: "radar", eventId: EVENT.toUpperCase().replace("0X", "0x") })).toBe(`/radar/${EVENT}`);
  });

  it("radar tanpa eventId sah tidak membuka apa pun", () => {
    for (const eventId of [undefined, null, "", "0x123", `${EVENT}00`, "../pesan", 42]) {
      expect(ruteDariNotifikasi({ jenis: "radar", eventId })).toBeNull();
    }
    expect(ruteDariNotifikasi({ jenis: "radar" })).toBeNull();
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/rute-push.test.ts`
Expected: FAIL — `jenis radar dengan eventId sah membuka radar acara itu` dan `eventId berhuruf besar dinormalkan ke huruf kecil` merah (keluaran `null`).

- [ ] **Step 4: Ganti isi `apps/mobile/src/pesan/rute-push.ts`**

Perilaku `jenis: "pesan"` tidak berubah; tes lamanya tetap di berkas yang sama.

```ts
const EVENT_ID = /^0x[0-9a-fA-F]{64}$/;

/**
 * Murni: data tersembunyi notifikasi → rute yang dibuka saat diketuk.
 *
 * `radar` (Fase 4b + 5, spec §8.3) membuka radar acaranya HANYA dengan
 * `eventId` yang sah — data rusak tidak membuka apa pun.
 */
export function ruteDariNotifikasi(data: unknown): "/pesan" | `/radar/${string}` | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as { jenis?: unknown; eventId?: unknown };
  if (d.jenis === "pesan") return "/pesan";
  if (d.jenis === "radar" && typeof d.eventId === "string" && EVENT_ID.test(d.eventId)) {
    return `/radar/${d.eventId.toLowerCase()}`;
  }
  return null;
}
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/rute-push.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis tes klien yang gagal**

`apps/mobile/test/radar-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverAturProfilSigner, turunkanKunciPesan, verifikasiRequest } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { getRadar, postDetak, simpanProfil } from "../src/radar/radar-api";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const EVENT = `0x${"e1".repeat(32)}`;

const aslinya = globalThis.fetch;
afterEach(() => { globalThis.fetch = aslinya; });

function pasangFetch() {
  const rekaman: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    return new Response(JSON.stringify({ hadir: true }), { status: 200 });
  }) as never;
  return rekaman;
}

async function sesi() {
  const kunci = turunkanKunciPesan(`0x${"77".repeat(65)}` as Hex);
  return { address: A.address as Address, kunci };
}

describe("radar-api", () => {
  it("postDetak menandatangani path dan badan persis yang dikirim", async () => {
    const rek = pasangFetch();
    const s = await sesi();
    await postDetak(s, EVENT, "qqguv1r");
    const { url, init } = rek[0]!;
    expect(url).toBe(`${CONFIG.apiUrl}/radar/${EVENT}/detak`);
    const h = init.headers as Record<string, string>;
    expect(init.body).toBe(JSON.stringify({ cell: "qqguv1r" }));
    expect(verifikasiRequest({
      method: "POST", pathDenganQuery: `/radar/${EVENT}/detak`, badan: String(init.body),
      ts: Number(h["x-nearly-ts"]), who: h["x-nearly-who"]!, tanda: h["x-nearly-tanda"]!,
    }, s.kunci.pubTanda)).toBe(true);
  });

  it("getRadar tanpa badan", async () => {
    const rek = pasangFetch();
    await getRadar(await sesi(), EVENT);
    expect(rek[0]!.url).toBe(`${CONFIG.apiUrl}/radar/${EVENT}`);
    expect(rek[0]!.init.body).toBeUndefined();
  });

  it("simpanProfil: tanda tangan AturProfil pulih ke dompet, atas medan yang persis dikirim", async () => {
    const rek = pasangFetch();
    const signer = { address: A.address as Address, signTypedData: (td: never) => A.signTypedData(td) };
    await simpanProfil(signer, { displayName: "Budi", visibilitas: "tersembunyi" });
    const badan = JSON.parse(String(rek[0]!.init.body)) as {
      who: Address; displayName: string; visibilitas: "terlihat" | "tersembunyi"; expiresAt: string; sig: Hex;
    };
    expect(rek[0]!.url).toBe(`${CONFIG.apiUrl}/profil`);
    const pulih = await recoverAturProfilSigner(
      { who: badan.who, displayName: badan.displayName, visibilitas: badan.visibilitas, expiresAt: BigInt(badan.expiresAt) },
      badan.sig, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
    expect(badan.visibilitas).toBe("tersembunyi");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/radar-api.test.ts`
Expected: FAIL — `../src/radar/radar-api` tidak ditemukan.

- [ ] **Step 6: Buat `apps/mobile/src/radar/radar-api.ts`**

```ts
import type { Address, Hex } from "viem";
import { aturProfilTypedData, type Visibilitas } from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";
import { reqPesan } from "../pesan/pesan-api";
import type { SesiPesan } from "../pesan/sesi";

export type JawabanDetakApi =
  | { hadir: true }
  | { hadir: false; alasan: "tersembunyi" | "di_luar_area" };

export type KartuRadarApi = {
  address: string;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
};

/** Umur tanda tangan `AturProfil`. Server menolak lebih dari 1 jam (spec 4b+5 §7.2). */
const UMUR_DETIK = 300;

/** Detak diautentikasi sesi Ed25519 Fase 4c — tanpa popup dompet (R1). */
export const postDetak = (sesi: SesiPesan, eventId: string, cell: string) =>
  reqPesan<JawabanDetakApi>(sesi, "POST", `/radar/${eventId}/detak`, { cell });

export const getRadar = (sesi: SesiPesan, eventId: string) =>
  reqPesan<{ kartu: KartuRadarApi[]; jumlah: number }>(sesi, "GET", `/radar/${eventId}`);

export const getProfilSaya = (sesi: SesiPesan) =>
  reqPesan<{ displayName: string; visibilitas: Visibilitas }>(sesi, "GET", "/profil/saya");

/**
 * `displayName` HARUS sudah lolos `periksaNamaTampilan` (nama setelah trim):
 * yang ditandatangani persis yang dikirim, dan server menyimpan hasil trim.
 */
export async function simpanProfil(
  signer: PenandaSigner, profil: { displayName: string; visibilitas: Visibilitas },
): Promise<{ ok: true }> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const msg = {
    who: signer.address as Address, displayName: profil.displayName, visibilitas: profil.visibilitas, expiresAt,
  };
  const sig: Hex = await signer.signTypedData(aturProfilTypedData(msg, CONFIG.verifyingContract) as never);
  return postJson<{ ok: true }>("/profil", { ...msg, expiresAt: expiresAt.toString(), sig });
}
```

- [ ] **Step 7: Jalankan seluruh tes mobile dan typecheck**

Run: `pnpm --filter @nearly/mobile exec vitest run && pnpm --filter @nearly/mobile exec tsc --noEmit`
Expected: PASS. Typecheck mencakup `app/_layout.tsx`, yang memanggil `router.push(rute)` dengan tipe kembalian baru.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/radar/radar-api.ts apps/mobile/src/messages.ts apps/mobile/src/pesan/rute-push.ts \
  apps/mobile/test/radar-messages.test.ts apps/mobile/test/radar-api.test.ts apps/mobile/test/rute-push.test.ts
git commit -m "feat(mobile): klien radar, kalimat keadaan radar, rute notifikasi kedekatan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — rute notifikasi menolak eventId rusak**

Setelah commit: di `rute-push.ts`, hapus ` && EVENT_ID.test(d.eventId)` dari kondisi radar.
Run: `pnpm --filter @nearly/mobile exec vitest run test/rute-push.test.ts`
Expected MERAH: `radar tanpa eventId sah tidak membuka apa pun`. Kembalikan: `git checkout -- apps/mobile/src/pesan/rute-push.ts`; run ulang → PASS; `git status --short` → kosong.

---

## Task 14: Mobile — layar Profil saya

**Files:**
- Create: `apps/mobile/app/profil-saya.tsx`
- Modify: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`

**Interfaces:**
- Consumes: `getProfilSaya`, `simpanProfil` (Task 13); `sesiPesan` (`src/pesan/sesi.ts`); `periksaNamaTampilan`, `Visibilitas` (`@nearly/shared`); `KALIMAT_BATAS_TERSEMBUNYI`, `kalimatVisibilitas`, `labelSimpanProfil`, `pesanNamaTidakSah`, `profilErrorMessage`, `sisaKarakterNama` (Task 13); `createDevSigner` (`src/signer.ts`); `ApiError` (`src/http.ts`).
- Produces: rute `/profil-saya`.

Tidak ada harness render RN — verifikasinya typecheck, lalu uji manual pemilik project.

- [ ] **Step 1: Buat `apps/mobile/app/profil-saya.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { periksaNamaTampilan, type Visibilitas } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { ApiError } from "../src/http";
import { sesiPesan } from "../src/pesan/sesi";
import { getProfilSaya, simpanProfil } from "../src/radar/radar-api";
import {
  KALIMAT_BATAS_TERSEMBUNYI, kalimatVisibilitas, labelSimpanProfil, pesanNamaTidakSah,
  profilErrorMessage, sisaKarakterNama,
} from "../src/messages";

const MODE: { nilai: Visibilitas; judul: string }[] = [
  { nilai: "terlihat", judul: "Terlihat" },
  { nilai: "tersembunyi", judul: "Tersembunyi" },
];

export default function ProfilSayaScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [nama, setNama] = useState("");
  const [visibilitas, setVisibilitas] = useState<Visibilitas>("terlihat");
  const [dimuat, setDimuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await getProfilSaya(await sesiPesan(signer));
        setNama(p.displayName);
        setVisibilitas(p.visibilitas);
      } catch (e) {
        setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : "Profil gagal dimuat.");
      } finally {
        setDimuat(true);
      }
    })();
  }, [signer]);

  async function simpan() {
    if (sibuk) return;
    const cek = periksaNamaTampilan(nama);
    if (!cek.ok) { setPesan(pesanNamaTidakSah(cek.alasan)); return; }
    setSibuk(true);
    try {
      await simpanProfil(signer, { displayName: cek.nama, visibilitas });
      setNama(cek.nama);
      setPesan("Tersimpan.");
    } catch (e) {
      setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  const sisa = sisaKarakterNama(nama);

  return (
    <ScrollView contentContainerStyle={s.root} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Nama tampilan</Text>
      <TextInput
        value={nama}
        onChangeText={setNama}
        placeholder="Tanpa nama"
        editable={dimuat && !sibuk}
        autoCorrect={false}
        style={s.isian}
      />
      {/* Penghitung code point, bukan maxLength — maxLength menghitung unit UTF-16 dan memotong emoji. */}
      <Text style={[s.penghitung, sisa < 0 && s.lebih]}>{sisa}</Text>
      <Text style={s.catatan}>Nama tidak unik. Alamatmu selalu tampil di sebelahnya.</Text>

      <Text style={s.label}>Visibilitas</Text>
      {MODE.map((m) => (
        <Pressable
          key={m.nilai}
          onPress={() => setVisibilitas(m.nilai)}
          disabled={!dimuat || sibuk}
          style={[s.mode, visibilitas === m.nilai && s.modeDipilih]}
          accessibilityRole="radio"
          accessibilityState={{ selected: visibilitas === m.nilai }}
        >
          <Text style={s.modeJudul}>{visibilitas === m.nilai ? "● " : "○ "}{m.judul}</Text>
          <Text style={s.modePenjelasan}>{kalimatVisibilitas(m.nilai)}</Text>
        </Pressable>
      ))}
      <Text style={s.catatan}>{KALIMAT_BATAS_TERSEMBUNYI}</Text>

      <View style={s.tombol}>
        <Button title={labelSimpanProfil(sibuk)} onPress={() => void simpan()} disabled={!dimuat || sibuk || sisa < 0} />
      </View>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 8 },
  isian: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, fontSize: 16 },
  penghitung: { fontSize: 12, opacity: 0.6, alignSelf: "flex-end" },
  lebih: { color: "#b00", opacity: 1 },
  catatan: { fontSize: 13, lineHeight: 19, opacity: 0.6 },
  mode: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 4 },
  modeDipilih: { borderWidth: 2 },
  modeJudul: { fontSize: 16, fontWeight: "600" },
  modePenjelasan: { fontSize: 14, lineHeight: 20, opacity: 0.75 },
  tombol: { paddingTop: 8 },
  pesan: { fontSize: 15, lineHeight: 22 },
});
```

- [ ] **Step 2: Daftarkan judul di `apps/mobile/app/_layout.tsx`**

Tambahkan satu baris tepat setelah `      <Stack.Screen name="pesan/lapor/[address]" options={{ title: "Lapor" }} />`:

```tsx
      <Stack.Screen name="profil-saya" options={{ title: "Profil saya" }} />
```

- [ ] **Step 3: Tautan di beranda `apps/mobile/app/index.tsx`**

Tambahkan satu baris tepat setelah `      <Link href="/blokir" style={s.link}>Daftar blokir</Link>`:

```tsx
      <Link href="/profil-saya" style={s.link}>Profil saya</Link>
```

- [ ] **Step 4: Typecheck dan tes mobile**

Run: `pnpm --filter @nearly/mobile exec tsc --noEmit && pnpm --filter @nearly/mobile exec vitest run`
Expected: PASS.

- [ ] **Step 5: Pastikan istilah**

Run: `grep -rniwE "hantu|ghost" apps/mobile/app/profil-saya.tsx apps/mobile/src/radar`
Expected: kosong (exit 1).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/profil-saya.tsx apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx
git commit -m "feat(mobile): layar Profil saya — nama tampilan dan Terlihat/Tersembunyi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: Mobile — layar Radar

**Files:**
- Create: `apps/mobile/app/radar/[eventId].tsx`
- Modify: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/events/[id].tsx`, `apps/mobile/app.json`

**Interfaces:**
- Consumes: `postDetak`, `getRadar`, `KartuRadarApi` (Task 13); `alamatSingkat`, `kalimatRadar`, `keadaanRadarDariDetak`, `keadaanRadarDariKode`, `lencanaKartuRadar`, `namaKartuRadar`, `KeadaanRadar` (Task 13); `getCurrentCell`, `LocationDeniedError` (`src/location.ts`); `sesiPesan`, `SesiPesan` (`src/pesan/sesi.ts`); `daftarkanPush` (`src/pesan/push.ts`); `createDevSigner`, `ApiError`, `CONFIG`.
- Produces: rute `/radar/[eventId]`; tombol **Buka radar** di layar acara.

Perilaku (spec §8.2): saat fokus — `sesiPesan` → `daftarkanPush` (best-effort) → `getCurrentCell` → detak → bila hadir ambil radar; detak setiap 60 detik, radar setiap 10 detik; kehilangan fokus menghentikan kedua timer. Rute di `app/radar/[eventId].tsx`, BUKAN di bawah `app/events/[id]/`, supaya tidak bertabrakan dengan `app/events/[id].tsx`.

- [ ] **Step 1: Buat `apps/mobile/app/radar/[eventId].tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { getCurrentCell, LocationDeniedError } from "../../src/location";
import { sesiPesan, type SesiPesan } from "../../src/pesan/sesi";
import { daftarkanPush } from "../../src/pesan/push";
import { getRadar, postDetak, type KartuRadarApi } from "../../src/radar/radar-api";
import {
  alamatSingkat, kalimatRadar, keadaanRadarDariDetak, keadaanRadarDariKode, lencanaKartuRadar,
  namaKartuRadar, type KeadaanRadar,
} from "../../src/messages";

/** Spec 4b+5 §8.2: detak setiap 60 detik, radar setiap 10 detik, hanya selama fokus. */
const JEDA_DETAK_MS = 60_000;
const JEDA_RADAR_MS = 10_000;

export default function RadarScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [kartu, setKartu] = useState<KartuRadarApi[] | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanRadar | null>(null);

  useFocusEffect(useCallback(() => {
    // Variabel efek, bukan state: timer yang sudah berjalan harus membaca
    // nilai terbaru tanpa efeknya dipasang ulang.
    let aktif = true;
    let hadir = false;
    let sesi: SesiPesan | null = null;

    const tampilkan = (k: KeadaanRadar) => {
      setKeadaan(k);
      // Galat jaringan tidak menghapus kartu yang sudah tampil; keadaan lain
      // berarti pemanggil memang tidak boleh melihat radar sekarang.
      if (k !== "server_tak_terjangkau") {
        hadir = false;
        setKartu(null);
      }
    };

    const ambilRadar = async () => {
      if (!sesi || !hadir) return;
      try {
        const r = await getRadar(sesi, eventId);
        if (!aktif) return;
        setKartu(r.kartu);
        setKeadaan(r.kartu.length === 0 ? "kosong" : null);
      } catch (e) {
        if (!aktif) return;
        const k = e instanceof ApiError ? keadaanRadarDariKode(e.code) : "gagal";
        if (k !== null) tampilkan(k);
      }
    };

    const kirimDetak = async () => {
      try {
        if (!sesi) {
          sesi = await sesiPesan(signer);
          void daftarkanPush(sesi);
        }
        const { cell } = await getCurrentCell();
        const jawaban = await postDetak(sesi, eventId, cell);
        if (!aktif) return;
        const k = keadaanRadarDariDetak(jawaban);
        if (k !== null) { tampilkan(k); return; }
        hadir = true;
        await ambilRadar();
      } catch (e) {
        if (!aktif) return;
        if (e instanceof LocationDeniedError) { tampilkan("izin_lokasi"); return; }
        const k = e instanceof ApiError ? keadaanRadarDariKode(e.code) : "gagal";
        if (k === null) {
          // terlalu_cepat: kehadiran dari detak sebelumnya masih berlaku.
          hadir = true;
          await ambilRadar();
          return;
        }
        tampilkan(k);
      }
    };

    void kirimDetak();
    const tDetak = setInterval(() => { void kirimDetak(); }, JEDA_DETAK_MS);
    const tRadar = setInterval(() => { void ambilRadar(); }, JEDA_RADAR_MS);
    // Kehilangan fokus: kedua timer berhenti. Tidak ada detak dari latar belakang (§10.1).
    return () => { aktif = false; clearInterval(tDetak); clearInterval(tRadar); };
  }, [eventId, signer]));

  if (kartu === null && keadaan === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {keadaan && <Text style={s.keadaan}>{kalimatRadar(keadaan)}</Text>}
      {keadaan === "tersembunyi" && (
        <Link href="/profil-saya" style={s.tautan}>Buka Profil saya</Link>
      )}
      {kartu && kartu.length > 0 && (
        <FlatList
          data={kartu}
          keyExtractor={(k) => k.address}
          renderItem={({ item: k }) => (
            // Bukan peta, tanpa jarak, arah, atau jam detak (spec 4b+5 §3).
            // Tidak ada tombol pesan: pesan tetap hanya lewat koneksi, dari profil.
            <Link href={`/profile/${k.address}`} style={s.kartu}>
              <Text style={s.nama}>{namaKartuRadar(k.displayName)}</Text>
              {"\n"}
              <Text style={s.alamat}>{alamatSingkat(k.address)} · {k.tierLabel}</Text>
              {lencanaKartuRadar(k).map((l) => (
                <Text key={l} style={s.lencana}>{"\n"}{l}</Text>
              ))}
            </Link>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  keadaan: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
  tautan: { fontSize: 15, fontWeight: "600", paddingVertical: 6 },
  kartu: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 16, fontWeight: "600" },
  alamat: { fontFamily: "Courier", fontSize: 12, opacity: 0.6 },
  lencana: { fontSize: 13, fontWeight: "500" },
});
```

- [ ] **Step 2: Daftarkan judul di `apps/mobile/app/_layout.tsx`**

Tambahkan satu baris tepat setelah `      <Stack.Screen name="pesan/lapor/[address]" options={{ title: "Lapor" }} />` (di atas baris `profil-saya` dari Task 14):

```tsx
      <Stack.Screen name="radar/[eventId]" options={{ title: "Radar" }} />
```

- [ ] **Step 3: Tombol Buka radar di `apps/mobile/app/events/[id].tsx`**

Tambahkan tepat SEBELUM baris `      {akuHost && (` (di dalam `return`):

```tsx
      {/* Radar hanya untuk yang sudah check-in, selama acara berlangsung (spec 4b+5 §8.1). */}
      {berlangsung && sudahCheckIn && (
        <Link href={`/radar/${ev.eventId}`} style={s.aksi}>Buka radar</Link>
      )}

```

`berlangsung`, `sudahCheckIn`, `Link`, dan `s.aksi` sudah ada di berkas itu.

- [ ] **Step 4: Kalimat izin lokasi di `apps/mobile/app.json`**

Ganti nilai `NSLocationWhenInUseUsageDescription` menjadi:

```json
"NSLocationWhenInUseUsageDescription": "Nearly memakai lokasi kasar (~150 m) hanya saat aplikasi terbuka: saat handshake, untuk memastikan kalian benar-benar berada di tempat yang sama, dan saat layar Radar terbuka, untuk menandai kehadiranmu di area acara."
```

Di Expo Go kalimat ini milik Expo Go; perubahan berlaku untuk development build kelak (spec §8.4).

- [ ] **Step 5: Typecheck, tes, dan validasi JSON**

Run: `pnpm --filter @nearly/mobile exec tsc --noEmit && pnpm --filter @nearly/mobile exec vitest run && node -e "JSON.parse(require('fs').readFileSync('apps/mobile/app.json','utf8'))"`
Expected: PASS, tanpa keluaran galat.

- [ ] **Step 6: Pastikan tidak ada lokasi latar belakang dan tidak ada modul native baru**

```bash
grep -rn "expo-task-manager\|startLocationUpdatesAsync\|requestBackgroundPermissionsAsync" apps/mobile   # WAJIB kosong
git diff -- apps/mobile/package.json                                                                     # WAJIB kosong
grep -rniwE "hantu|ghost" "apps/mobile/app/radar/[eventId].tsx"                                          # WAJIB kosong
```

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/radar/[eventId].tsx" apps/mobile/app/_layout.tsx "apps/mobile/app/events/[id].tsx" apps/mobile/app.json
git commit -m "feat(mobile): layar Radar dan tombol Buka radar di acara

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: Amandemen spec induk, verifikasi global, verifikasi batas, serah terima

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`
- Apply (oleh PEMILIK PROJECT, bukan pelaksana): `supabase/migrations/0008_radar.sql`

**Interfaces:**
- Consumes: seluruh Task 1–15.
- Produces: spec induk yang sesuai dengan yang dibangun (spec 4b+5 §13); bukti verifikasi global dan batas jalur.

- [ ] **Step 1: Temukan titik amandemen**

Run: `grep -niE "hantu|ghost|presence|pg_cron|Postgres cron|proximity|24 jam" docs/superpowers/specs/2026-09-03-nearly-design.md`
Laporkan keluarannya apa adanya. Titik yang diharapkan: §3 (`0xghost` baris ~44), prinsip 4 (~126), §7.4 (~157), §10.2 (~413–416), §10.3 (~434), §10.4 (~448), Fase 5 (~511), §11.1 butir 6 (~543), uji privasi (~618), §14 butir 6 (~648).

- [ ] **Step 2: Amandemen spec §13 butir 1 — istilah**

1. **§11.1 butir 6** — ganti seluruh baris
   `6. **Mode visibilitas 3 → 2**: hadir-terlihat vs ghost. Mode event digabung ke hadir-terlihat.`
   dengan
   `6. **Mode visibilitas 3 → 2**: **Terlihat** dan **Tersembunyi**, satu saklar per akun. Tersembunyi bersifat timbal balik — tidak muncul di radar, tidak bisa membuka radar, tidak memicu dan tidak menerima notifikasi kedekatan. Mode event digabung ke Terlihat (spec Fase 4b + 5 §2).`
2. **§3 dan §10.3** — ganti setiap nama samaran `` `0xghost` `` dengan `` `0xanon` `` (Ruling P20).

- [ ] **Step 3: Amandemen spec §13 butir 2 — contoh notifikasi §7.4**

Ganti blok kutipan

```
> *"@0xghost yang kamu tandai sedang ada di event ini."*
```

dengan

```
> *"Budi, yang saling ingin bertemu denganmu, ada di acara ini."*

Notifikasi kedekatan hanya dikirim kepada **koneksi** (pernah bertemu) dan orang yang **saling**
ingin bertemu — tidak pernah untuk tanda sepihak. Tanda sepihak yang memberi tahu kapan targetnya
hadir adalah vektor penguntitan: siapa pun bisa menandai seseorang lalu menunggu pemberitahuan
lokasinya. Rincian, batas 5 per orang per acara, dan isinya di spec Fase 4b + 5 §6.
```

- [ ] **Step 4: Amandemen spec §13 butir 3–5 — model data, janji 24 jam, peta fase**

1. **§10.2** — di paragraf pertama, ganti frasa `Menyimpan presence sementara,` dengan `Menyimpan kehadiran sementara,` (baris lain paragraf itu tidak diubah). Lalu ganti paragraf `Tabel presence mentah **auto-purge 24 jam** (Postgres cron). Yang bertahan hanya koneksi.` dengan:

   ```
   Data lokasi yang tidak dipakai trust — baris `kehadiran`, `notif_kedekatan`, dan sel di QR salaman
   serta QR check-in yang kedaluwarsa — dihapus atau dikosongkan **paling lambat 24 jam + interval
   sapuan** oleh API sendiri (saat mulai, dan dari rute detak paling sering sekali per 10 menit) serta
   alat CLI `apps/api/tools/sapu-lokasi.ts` untuk cron VPS — bukan `pg_cron`, yang belum tentu aktif
   di project Supabase. **Pengecualian yang diakui:** `connections.cell` dan `checkins.cell` belum
   dihapus karena dipakai sidik jari ko-lokasi trust (`load-graph.ts`); menepatinya butuh perubahan
   `packages/trust` dan menjadi pekerjaan terpisah (spec Fase 4b + 5 §4.5, §10.7–8).
   ```
2. **§10.4** — ganti baris
   `presence(ephemeral_id, geohash7, seen_at)              -- purge < 24 jam`
   dengan
   `kehadiran(event_id, address, cell, seen_at)            -- satu baris per orang per acara; dihapus ≤ 24 jam`
   dan tambahkan tepat di bawahnya:
   `notif_kedekatan(event_id, penerima, subjek, sent_at)   -- sekali per pasangan per acara; dihapus ≤ 24 jam`
   Ganti juga `visibility)` di baris `profiles(...)` menjadi `visibilitas)`.
3. **Prinsip 4** — ganti `4. **Lokasi mentah dihapus dalam 24 jam.** Yang bertahan hanya koneksi.` dengan `4. **Lokasi mentah dihapus dalam 24 jam.** Yang bertahan hanya koneksi dan check-in — selnya masih dipakai trust dan menjadi pengecualian yang diakui (§10.2).`
4. **Uji privasi** — ganti baris `**Uji privasi** — verifikasi tabel presence mentah benar-benar terhapus setelah 24 jam.` dengan:

   ```
   **Uji privasi** — `sapuLokasi` dengan jam palsu menghapus kehadiran dan notifikasi kedekatan yang
   lebih tua dari 24 jam, mengosongkan sel QR yang kedaluwarsa lebih dari 24 jam tanpa menghapus
   barisnya, dan tidak menyentuh `connections` maupun `checkins` (`apps/api/test/sapu-lokasi-privasi.test.ts`).
   ```
5. **Peta fase** — tambahkan paragraf ini tepat setelah paragraf `**Catatan urutan (2026-09-07).** …`:

   ```
   **Catatan urutan (2026-09-14).** Fase 4 tuntas: 4a (blokir), 4c (pesan relay + E2E), dan 4b
   (radar, visibilitas Terlihat/Tersembunyi, nama tampilan — spec `2026-09-14-nearly-fase-4b5-radar-design.md`).
   Fase 5 tuntas: feed di 3b, "ingin bertemu" di 3c, notifikasi kedekatan di spec yang sama dengan 4b.
   ```
6. **Fase 5** — ganti `notifikasi proximity, lapor.` dengan `notifikasi kedekatan (spec Fase 4b + 5 §6), lapor.`
7. **§14 butir 6** — ganti `4b (radar & visibilitas) — lihat spec Fase 4a §1 dan spec Fase 4c.` dengan `4b (radar & visibilitas, tuntas bersama notifikasi kedekatan — spec Fase 4b + 5) — lihat spec Fase 4a §1 dan spec Fase 4c.`

- [ ] **Step 5: Verifikasi amandemen**

```bash
grep -niE "hantu|ghost" docs/superpowers/specs/2026-09-03-nearly-design.md          # WAJIB kosong
grep -niE "presence|pg_cron|Postgres cron" docs/superpowers/specs/2026-09-03-nearly-design.md   # hanya kalimat "bukan pg_cron"
grep -n "Tersembunyi" docs/superpowers/specs/2026-09-03-nearly-design.md            # minimal §11.1 butir 6
```

Laporkan ketiga keluaran apa adanya.

- [ ] **Step 6: Verifikasi global**

Jalankan dari akar worktree dan laporkan ekor keluarannya apa adanya:

```bash
pnpm -r test
pnpm -r typecheck
```

Expected: keduanya lulus di `packages/shared`, `packages/trust`, `apps/api`, `apps/mobile`.

- [ ] **Step 7: Verifikasi batas jalur (spec §12)**

Jalankan setiap perintah terpisah; grep/diff yang kosong keluar dengan status 0 atau 1 — itu hasil yang diharapkan:

```bash
git diff --stat main...HEAD -- packages/trust packages/contracts apps/web \
  apps/api/src/handshake-gate.ts apps/api/src/event-gate.ts apps/api/src/trust            # WAJIB kosong
git diff --name-only main...HEAD -- supabase/migrations                                   # WAJIB tepat: supabase/migrations/0008_radar.sql
git diff main...HEAD -- apps/api/src/ports.ts apps/api/src/app.ts apps/api/src/index.ts \
  apps/api/test/support/deps.ts packages/shared/src/index.ts | grep '^-' | grep -v '^---' # WAJIB kosong (hanya penambahan)
git diff --name-only main...HEAD -- apps/api/src/pesan-auth.ts apps/api/src/pesan-gate.ts \
  apps/api/src/pesan-push.ts apps/api/src/pesan-store.ts apps/api/src/push.ts \
  apps/api/src/routes/pesan.ts apps/mobile/src/pesan/sesi.ts apps/mobile/src/pesan/pesan-api.ts \
  apps/mobile/src/pesan/push.ts                                                            # WAJIB kosong (kode 4c hanya dipanggil)
git diff --name-only main...HEAD -- apps/mobile/src/pesan                                 # WAJIB tepat: apps/mobile/src/pesan/rute-push.ts (Ruling P15)
grep -rn "AturProfil" packages/contracts                                                  # WAJIB kosong
grep -rniwE "hantu|ghost" apps/mobile/app apps/mobile/src      # WAJIB kosong (-w: `sigHost` bukan kata "ghost")
grep -rn "pg_cron" supabase/migrations/0008_radar.sql apps/api/src                        # WAJIB kosong
git diff --name-only main...HEAD -- apps/mobile/package.json pnpm-lock.yaml               # WAJIB kosong
pnpm --filter @nearly/shared exec vitest run test/typehash-semua.test.ts                  # PASS dengan JUMLAH_TIPE = 25
git status --short                                                                        # WAJIB kosong
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "docs: amandemen spec induk — Tersembunyi, kehadiran, notifikasi kedekatan, janji 24 jam

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Serahkan ke pemilik project** (dilakukan controller, bukan pelaksana)

1. **Terapkan `supabase/migrations/0008_radar.sql` SEBELUM menjalankan API dari branch ini.** Tanpa kolom `profiles.visibilitas` dan tabel `kehadiran`/`notif_kedekatan`, rute radar dan profil gagal 500 dan sapuan saat mulai mencatat galat (tidak menjatuhkan API).
2. **Cron VPS (opsional, menutup celah janji 24 jam saat API sepi):** `cd apps/api && node --env-file=../../.env --import=tsx tools/sapu-lokasi.ts`, misalnya setiap jam.
3. **Uji lapangan spec §11** — dua HP, satu acara uji yang sedang berlangsung, keduanya check-in:
   1. Keduanya membuka Radar → saling melihat kartu.
   2. A pindah ke Tersembunyi → kartu A hilang dari radar B dalam ≤ 10 detik; A tidak bisa membuka radar.
   3. A kembali Terlihat → A dan B yang pernah bertemu saling menerima notifikasi kedekatan sekali.
   4. B keluar area (atau memalsukan sel di luar geofence lewat skrip) → hilang dari radar A.
   5. A memblokir B → saling tidak terlihat.
   6. Nama diatur di Profil saya → tampil di kartu radar dan di notifikasi.
4. **Batas yang diakui (spec §9, §10)** tidak punya kode di fase ini dan dilaporkan apa adanya: kehadiran hanya saat aplikasi terbuka; sel dilaporkan HP; Tersembunyi tidak menyembunyikan `Connected`/`CheckedIn` on-chain; pola waktu terlihat di radar; nama di notifikasi terlihat Expo dan Apple; `connections.cell`/`checkins.cell` belum disapu; geofence ±460 m berkedip di tepi venue.

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`. Jalur yang merge **kedua** (4b+5 atau 6) menyelesaikan konflik di berkas bersama §12 dan menjalankan ulang `pnpm -r test` setelah rebase.
