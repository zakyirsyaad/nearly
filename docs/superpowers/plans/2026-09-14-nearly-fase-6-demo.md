# Fase 6 — Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat graf pertemuan Nearly terlihat hidup di layar proyektor — API graf publik baca-saja, aplikasi web (landing page + layar `/live`), alat seed trusted core, dan templat serta panduan deploy — tanpa menyentuh aplikasi mobile, trust, kontrak, maupun migrasi.

**Architecture:** API Hono mendapat modul graf baca-saja (`graf.ts` murni, `graf-store.ts` kueri sempit, `routes/graf.ts`) dengan cache 2 detik dan CORS sendiri yang hanya berlaku di `/graf/*`; aturan "salaman di acara ini" ditulis ulang di `graf.ts` dan dikunci identik dengan `rowsToGraph` lewat tes konsistensi. `apps/web` adalah Vite + React statis untuk Vercel: fungsi murni (penggabung halaman, label, jeda, siklus polling) diuji di Node, kanvas `react-force-graph-2d` hanya lapisan gambar. Alat `tools/seed-inti.ts` tipis di atas logika murni yang memvalidasi seluruh CSV sebelum menulis.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono 4 · Supabase (service role, baca-saja di modul graf) · Vitest 2 · Vite 5 · React 19.2.3 · `react-force-graph-2d` · systemd · Caddy · Vercel

**Spec:** `docs/superpowers/specs/2026-09-14-nearly-fase-6-demo-design.md` (baca UTUH sebelum Task 1). Spec induk: `docs/superpowers/specs/2026-09-03-nearly-design.md`.

## Global Constraints

### Keputusan terkunci (spec §2, verbatim)

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Cakupan graf | **Keduanya, bisa diganti**: "Acara ini" dan "Seluruh jaringan" |
| 2 | Label simpul | **Nama tampilan + alamat singkat**, mis. `Budi · 0x12ab…` |
| 3 | Hosting API | **VPS** milik pemilik project |
| 4 | Hosting web | **Vercel** |
| 5 | Bahasa landing page | **Inggris** (aplikasi tetap berbahasa Indonesia) |
| 6 | Pengaturan nama tampilan | Dikerjakan di jalur **4b + 5**, bukan di sini. Selama nama kosong, simpul menampilkan alamat singkat saja |

- **R1. Vite + React + TypeScript, bukan Next.js.** Spec induk §10 dan §12 menulis Next.js (`apps/web/src/app/live/page.tsx`). Landing page dan layar graf sama-sama cukup berupa berkas statis yang memanggil API; tidak ada data yang harus dirender di server. Vite menghasilkan satu folder statis untuk Vercel, lebih sedikit konsep yang harus dipahami, dan mengikuti vitest yang sudah dipakai repo. Dicatat sebagai amandemen spec induk (§12).
- **R2. `react-force-graph-2d`** untuk graf (spec induk menyebut react-force-graph). Kanvas 2D, bukan 3D: terbaca dari belakang ruangan dan ringan di laptop proyektor.
- **R3. Polling tiap 3 detik** dengan kursor, bukan WebSocket/SSE/Realtime. Spec induk §11.1 butir 5 sudah memilih polling untuk radar; alasan yang sama berlaku, dan jeda 3 detik tidak terasa sebagai "tidak live" di layar proyektor.
- **R4. Tanpa tipe EIP-712 baru dan tanpa autentikasi.** Graf koneksi memang publik (spec induk §10); endpoint graf hanya membaca data yang sudah publik on-chain atau lewat endpoint yang ada.
- **R5. Simpul di graf acara hanya orang yang punya salaman di acara itu**, bukan seluruh daftar check-in. Angka hadir tetap tampil sebagai hitungan. Menampilkan setiap orang yang check-in sebagai simpul menambah paparan tanpa menambah momen "graf tumbuh".
- **R6. Tanpa migrasi.** Kursor memakai `connections.id` (`bigserial`, `0001_init.sql:26`) dan penyaringan acara memakai kunci `checkins` yang sudah ada. Bila rencana implementasi membuktikan indeks baru diperlukan, nomornya **`0009`**.

### Batas jalur paralel (spec §11, verbatim)

| | Jalur ini (Fase 6) | Jalur 4b + 5 |
|---|---|---|
| Branch / worktree | `fase-6-demo` | `fase-4b5-radar` |
| Migrasi | tidak ada (bila perlu: **`0009`**) | `0008_radar.sql` |
| Tipe EIP-712 | **tidak menambah** | +1 → 25 |
| `apps/mobile` | **tidak menyentuh** | ya |
| `apps/web` | ya | tidak menyentuh |
| `apps/api` | `routes/graf.ts`, `graf.ts`, `graf-store.ts`, CORS, `PORT`, `tools/seed-inti.ts` | rute radar & profil, store baru |

Berkas bersama yang disentuh kedua jalur — **hanya penambahan, di akhir blok yang ada**, tanpa mengubah atau memindahkan baris yang sudah ada: `apps/api/src/ports.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/deps.ts`. `pnpm-lock.yaml` pasti berubah di jalur ini (workspace web baru); konflik lockfile diselesaikan dengan `pnpm install` ulang, bukan diedit tangan. Jalur yang merge **kedua** melakukan rebase dan menjalankan ulang seluruh tes.

Jalur ini **tidak** mengubah: `packages/trust`, `packages/contracts`, `packages/shared`, `apps/api/src/trust/**` (hanya mengimpor `rowsToGraph` dan `TIER_LABELS` untuk tes dan label), gerbang tulis mana pun, dan seluruh kode Fase 4c.

Ringkasnya, per baris:

- **Tanpa migrasi.** Bila ternyata perlu, nomornya `0009` — dan itu keputusan pemilik project, bukan pelaksana.
- **Tidak menambah tipe EIP-712.**
- **Tidak menyentuh `apps/mobile` dan `packages/shared`.**
- **Berkas bersama API (`ports.ts`, `app.ts`, `index.ts`, `test/support/deps.ts`) hanya penambahan di akhir blok.** Pengecualian yang tak terhindarkan dicatat di Ruling R-E.
- **Konflik `pnpm-lock.yaml` diselesaikan dengan `pnpm install` ulang**, tidak pernah diedit tangan.

### Batas keras eksekusi

- **JANGAN PERNAH** menerapkan migrasi, menulis ke Supabase atau blockchain, menjalankan `seed-inti.ts --jalankan`, men-deploy, atau membuat/mengubah akun apa pun (Vercel, VPS, domain, GitHub).
- **JANGAN** menjalankan API dengan env sungguhan (`pnpm --filter @nearly/api dev` membaca `.env` root berisi kunci relayer). Semua verifikasi API lewat tes.
- **JANGAN sentuh** `packages/trust`, `packages/contracts`, `apps/api/src/trust/**` (hanya impor), dan gerbang tulis mana pun (`handshake-gate.ts`, `event-gate.ts`, `vouch-gate.ts`, `feed-gate.ts`, `meet-gate.ts`, `blokir-gate.ts`, `pesan-gate.ts`, `pesan-laporan.ts`, dan rute tulisnya).
- Setiap commit memakai `git add` dengan **nama berkas eksplisit** (tidak pernah `git add -A` / `git add .`), dan pesan commit diakhiri baris `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- DILARANG: `git reset --hard`, `git clean`, `rm -r`, force-push. Langkah mutasi dikembalikan dengan `git checkout -- <berkas>` per berkas.
- Impor relatif **tanpa ekstensi**. Identifier dan komentar kode **bahasa Indonesia**; teks yang terlihat di web (**landing dan `/live`**) **bahasa Inggris** (spec §5, §6.1).
- Judul tes TIDAK menyebut jumlah (pelajaran Fase 3c).
- Perintah tes per paket: `pnpm --filter <nama> exec vitest run <path>`.

---

## Paket baru (untuk ditinjau pemilik project)

Hanya di `apps/web/package.json`. Versi **exact** (tanpa `^`), diverifikasi dengan `pnpm view` pada 2026-09-14. TypeScript dan Vitest TIDAK ditambahkan — keduanya sudah di `package.json` root dan dipakai semua workspace.

| Paket | Versi | Jenis | Catatan |
|---|---|---|---|
| `react` | `19.2.3` | dependencies | sama persis dengan `apps/mobile` → satu salinan React di lockfile |
| `react-dom` | `19.2.3` | dependencies | `peerDependencies: react ^19.2.3` |
| `react-force-graph-2d` | `1.29.1` | dependencies | `peerDependencies: react *`; menarik `force-graph@^1.51` (terbaru 1.51.4) |
| `vite` | `5.4.21` | devDependencies | versi yang SUDAH ada di lockfile lewat vitest 2.1.9 — satu vite di monorepo (Ruling R-J) |
| `@vitejs/plugin-react` | `4.7.0` | devDependencies | `peerDependencies: vite ^4.2.0 \|\| ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0` |
| `@types/react` | `19.2.18` | devDependencies | versi yang sudah ada di lockfile |
| `@types/react-dom` | `19.2.3` | devDependencies | `peerDependencies: @types/react ^19.2.0` |

Versi terbaru saat diperiksa (sengaja TIDAK dipilih): vite 8.3.0, @vitejs/plugin-react 6.1.1, react 19.3.0. Kombinasi di tabel sudah dibuktikan saat menulis rencana ini — di salinan terpisah di luar repo — dengan `tsc --noEmit`, seluruh tes web, `vite build`, dan uji asap di browser terhadap API tiruan.

---

## Ruling — keputusan rencana di luar teks spec

- **R-A. Aturan acara menyertakan pemecah seri trust.** (Spec §4.3 sudah diperbarui pada 2026-09-14 dan kini menulis ketiga syarat; Ruling ini dipertahankan sebagai catatan asal-usulnya.) Versi awal spec §4.3 menulis dua syarat (keduanya check-in di E, waktu di jendela E). `eventOccasionFor` (`apps/api/src/trust/load-graph.ts:120`) punya syarat KETIGA: bila lebih dari satu acara memenuhi, dipilih `event_id` terkecil secara leksikografis. Tanpa syarat itu, tes konsistensi kasus "dua acara tumpang tindih" yang diwajibkan spec §10 tidak mungkin hijau — salaman di irisan waktu tampil di dua layar, sementara trust memberinya ke satu acara. Rencana mengikuti trust persis. Konsekuensi yang harus diketahui pemilik project: salaman di irisan dua acara yang dihadiri keduanya hanya tampil di layar acara ber-id terkecil.
- **R-B. Nama tampilan dan tier diambil lewat `MeetStore.profilRingkas`** (`apps/api/src/meet-store.ts:212`), yang sudah membaca `profiles.display_name` dan `trust_snapshots.tier` per kelompok 100 alamat. `GrafDeps.meet` = `Pick<MeetStore, "profilRingkas">`. Kueri ketiga yang sama di `graf-store.ts` hanya menduplikasi. Alamat tanpa snapshot mendapat tier 0 → `Baru`, sumber label tetap `TIER_LABELS`.
- **R-C. CORS ditulis sendiri (`apps/api/src/cors-graf.ts`), bukan `hono/cors`.** Hono 4.13.5 yang terpasang sudah menolak origin tak terdaftar untuk permintaan biasa, tetapi untuk preflight `OPTIONS` dari origin tak terdaftar ia tetap memasang `Access-Control-Allow-Methods` — spec §4.6 meminta origin lain mendapat nol header CORS. Rentang `hono: ^4.6.0` juga mencakup versi lama yang mengembalikan origin pertama di daftar untuk origin tak dikenal. Middleware sendiri ±30 baris, terbaca utuh.
- **R-D. Impor dari `apps/api/src/trust/**` sedikit melebihi daftar spec §11** — tanpa mengubah satu baris pun: `graf-store.ts` mengimpor `fetchAllPages` dan `PAGE_SIZE` dari `trust/store.ts` (pembaca berhalaman yang sudah menutup jebakan pemotongan 1000 baris PostgREST), dan tes mengimpor tipe `GraphRows` serta `eventOccasionIdOf` dari `trust/load-graph.ts` selain `rowsToGraph`.
- **R-E. Dua pengecualian "hanya penambahan".** (1) `apps/api/src/index.ts`: baris `serve({ fetch: app.fetch, port: 8787 })` dan `console.log(...)` di akhir berkas DIGANTI, karena spec §4.7 memang meminta `PORT` dari env; impor dan medan `createApp` tetap ditambahkan di akhir bloknya. (2) `apps/api/test/handshake.route.test.ts` ikut diubah (dua medan ditambahkan di akhir objek deps-nya) karena berkas itu membangun `TrustDeps` lengkap sendiri, tidak lewat `support/deps.ts`; tanpanya typecheck merah.
- **R-F. Masukan tak sah.** `sejakId` selain bilangan bulat ≥ 0 → `400 { code: "invalid_cursor" }`. `eventId` yang bentuknya bukan `0x` + 64 hex → `404 event_not_found` tanpa kueri.
- **R-G. Muatan awal tidak menyala.** Spec §6.2 menandai "sisi yang baru masuk" dengan `baruSampaiMs`. Halaman-halaman muatan awal (sebelum `lengkap: true` pertama) tidak ditandai: ribuan sisi lama yang menyala bersamaan bukan momen "graf tumbuh". Setelah muatan awal, setiap sisi baru menyala 4 detik.
- **R-H. Siklus polling dipisah ke `apps/web/src/siklus-graf.ts`** (tidak ada di tabel spec §5) supaya "muat sampai lengkap → poll 3 detik → gagal pertahankan graf dengan jeda 3/6/12" diuji dengan klien dan jam palsu, bukan hanya dilihat. Acara yang tidak ada (404) menghentikan siklus dengan status "Event not found" alih-alih mencoba ulang selamanya dengan "Reconnecting…".
- **R-I. Berkas web tambahan di luar tabel spec §5:** `index.html`, `vitest.config.ts`, `src/vite-env.d.ts`, `src/gaya.css` (CSS "satu berkas" spec §5), `src/jeda.ts`, `src/rute.ts`, `src/siklus-graf.ts`, dan tes di `apps/web/test/`.
- **R-J. Vite 5.4.21 + `@vitejs/plugin-react` 4.7.0, bukan Vite 8.** Vite 5.4.21 sudah ada di lockfile sebagai dependensi vitest 2.1.9; memakai versi yang sama menjaga satu vite di monorepo dan `vitest.config.ts` web tidak bentrok tipe dengan `vite.config.ts`.
- **R-K. Alamat kontrak dari tiga berkas run.** `packages/contracts/broadcast/Deploy.s.sol/97/run-latest.json` hanya memuat deploy terakhir (AttendanceRegistry). Kelima alamat diambil dari `run-1788453189701.json` (ConnectionRegistry), `run-1788544216266.json` (VouchRegistry, TrustAttestor, NearlyResolver), dan `run-1788754863309.json` = `run-latest.json` (AttendanceRegistry). Folder `broadcast/` di-gitignore (`packages/contracts/.gitignore`) sehingga **tidak ada di worktree ini** — nilainya tertulis verbatim di Task 9; ConnectionRegistry cocok dengan `apps/mobile/eas.json`, AttendanceRegistry cocok dengan spec 3a.
- **R-L. Format CSV seed.** Baris header `address,catatan,bobot` opsional; catatan tidak boleh memuat koma (tanpa aturan kutip, koma menggeser bobot diam-diam) dan maksimal 200 karakter; argumen selain `<berkas>` dan `--jalankan` (termasuk salah ketik `--jalankn`) ditolak; kode keluar 2 bila hitung ulang melaporkan transaksi gagal.
- **R-M. Pemotongan nama** per karakter Unicode: nama > 20 karakter ditampilkan 20 karakter pertama + `…`, supaya emoji di batas potongan tidak terbelah.
- **R-N. Cache 2 detik menyimpan promise**, bukan hasil — permintaan bersamaan menunggu satu kueri — dan dibatasi 1000 kunci, karena kunci memuat `sejakId` bebas dari query.
- **R-O. Env server.** `WEB_ORIGINS` membuang spasi dan garis miring penutup (origin browser tidak pernah berakhiran `/`, dan salah cocok itu senyap). `PORT` yang tak sah melempar saat boot alih-alih diam-diam kembali ke 8787.
- **R-P. Pemilih acara hanya acara yang sudah mulai** (`starts_at ≤ sekarang` dan `ends_at ≥ sekarang − 7 hari`), sesuai teks spec §4.3. Acara yang belum mulai tidak muncul; runbook meminta acara dibuat dengan waktu mulai sebelum layar dibuka.
- **R-Q. Detail kanvas:** `autoPauseRedraw={false}` supaya efek menyala 4 detik tetap dianimasikan; gaya tolak dibatasi `distanceMax(250)` supaya pasangan-pasangan yang belum tersambung tidak terdorong keluar layar; `zoomToFit` sekali per cakupan setelah tata letak awal tenang.
- **R-R. CSV contoh `docs/demo/seed-inti-contoh.csv`** berisi alamat palsu jelas (`0x…0001`, `0x…0002`) untuk uji lapangan §10 butir 5; berkomentar "JANGAN PERNAH --jalankan".
- **R-S. `deploy/Caddyfile` memakai placeholder env `{$NEARLY_API_HOST}`** supaya berkas yang di-commit tidak memuat domain; nilainya diisi lewat `systemctl edit caddy` (runbook §1.5).

---

## Pemetaan spec → task

| Spec | Isi | Task |
|---|---|---|
| §2 R1–R6 | Keputusan terkunci | Global Constraints; R1/R2 Task 9–11; R3 Task 10; R4 Task 5; R5 Task 2 & 5; R6 seluruh rencana (tanpa migrasi) |
| §3 | Arsitektur tiga bagian kode + operasional | Task 1–8 (API & alat), 9–11 (web), 12 (operasional) |
| §4.1 | Modul `routes/graf.ts`, `graf-store.ts`, `graf.ts`; tanpa `TrustStore.loadGraph` | Task 1, 2, 3, 5 |
| §4.2 | `GET /graf/jaringan`, 2000/halaman, `kursor`, `lengkap`, `tierLabel`, `displayName` | Task 2, 3, 5 |
| §4.3 | `GET /graf/acara`, `GET /graf/acara/:eventId`, aturan acara identik trust, `hitungan`, 404 | Task 2, 3, 5, 6 |
| §4.4 | Yang tidak pernah keluar; blokir tanpa penanda | Task 2 (penyaring), 3 (kolom), 5 (tes kunci JSON + blokir) |
| §4.5 | Cache 2 detik per kunci, `Cache-Control: public, max-age=2` | Task 4, 5 |
| §4.6 | CORS `/graf/*`, `WEB_ORIGINS`, hanya GET | Task 4 (parser), 5 (middleware), 7 (rute non-graf) |
| §4.7 | `PORT` dari env, default 8787 | Task 4, 7 |
| §5 | Struktur `apps/web` | Task 9, 10, 11 |
| §6.1 | Layar `/live` | Task 11 |
| §6.2 | Penggabungan, polling 3 detik, coba ulang 3→6→12 | Task 9 (jeda), 10 (gabung-graf, siklus) |
| §6.3 | Label, ukuran per tier, menyala 4 detik, label ≤ 300 | Task 9 (label), 10 (sorot), 11 (kanvas) |
| §6.4 | Landing page enam bagian, klaim tertunjuk ke spec, kontrak | Task 9 (kontrak.ts), 11 (Landing.tsx) |
| §7 | `tools/seed-inti.ts` | Task 8 |
| §8 | `deploy/nearly-api.service`, `deploy/Caddyfile`, `vercel.json`, `docs/demo/runbook.md` | Task 9 (vercel.json), 12 |
| §9 | Yang sengaja tidak ada | Global Constraints; verifikasi batas Task 13 |
| §10 | Verifikasi (termasuk langkah mutasi) | Task 2–10 (tes), 5/6/8 (mutasi), 11 (build), 13 (global) |
| §11 | Batas jalur paralel | Global Constraints; Task 13 Step 2 |
| §12 | Amandemen spec induk | Task 13 Step 1 |

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `apps/api/src/ports.ts` (ubah, tambah di akhir) | `KoneksiGraf`, `AcaraGraf`, `CheckInGraf`, `GrafStore`, `METODE_GRAF_STORE`, `GrafDeps` |
| `apps/api/src/graf.ts` | Fungsi murni: potong halaman, simpul, penyaring kunci JSON, aturan acara, masukan query |
| `apps/api/src/graf-store.ts` | Kueri Supabase sempit untuk `connections`, `events`, `checkins` |
| `apps/api/src/cache-singkat.ts` | Cache promise di memori, per kunci, berumur |
| `apps/api/src/server-env.ts` | `bacaPort`, `bacaWebOrigins` |
| `apps/api/src/cors-graf.ts` | Middleware CORS khusus `/graf/*` |
| `apps/api/src/routes/graf.ts` | Tiga endpoint GET graf |
| `apps/api/src/app.ts`, `index.ts` (ubah) | Perakitan, `PORT`, `WEB_ORIGINS` |
| `apps/api/test/support/deps.ts`, `handshake.route.test.ts` (ubah) | Fake `graf` + `webOrigins` |
| `apps/api/test/support/dunia-graf.ts` | Dunia di memori untuk tes rute & konsistensi |
| `apps/api/tools/seed-inti-logika.ts` | Validasi CSV, argumen, orkestrasi uji coba/jalankan — murni |
| `apps/api/tools/seed-inti.ts` | Pembungkus tipis: berkas, Supabase, hitung ulang |
| `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `vercel.json`, `index.html` | Workspace `@nearly/web` |
| `apps/web/src/api.ts` | Klien `GET /graf/*`, batas waktu 10 detik |
| `apps/web/src/gabung-graf.ts` | Penggabung halaman graf (§6.2) |
| `apps/web/src/label.ts` | Label, jari-jari, kapan label digambar |
| `apps/web/src/jeda.ts` | Jeda polling dan coba ulang |
| `apps/web/src/siklus-graf.ts` | Siklus muat-dan-polling lepas dari React |
| `apps/web/src/rute.ts` | Pemilih halaman dan `?acara` |
| `apps/web/src/kontrak.ts` | Alamat kontrak testnet |
| `apps/web/src/main.tsx`, `pages/Landing.tsx`, `pages/Live.tsx`, `gaya.css`, `vite-env.d.ts` | UI |
| `deploy/nearly-api.service`, `deploy/Caddyfile` | Templat operasional |
| `docs/demo/runbook.md`, `docs/demo/seed-inti-contoh.csv` | Panduan deploy & hari-H, CSV contoh |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Amandemen §10, §11, §12 |

---

## Task 1: Port graf

**Files:**
- Modify: `apps/api/src/ports.ts` (tambah di AKHIR berkas, setelah `PesanDeps`)
- Test: `apps/api/test/graf-ports.test.ts`

**Interfaces:**
- Consumes: `MeetStore` (sudah ada di `ports.ts`), `Address`/`Hex` dari viem.
- Produces (dipakai Task 2–7):
  - `type KoneksiGraf = { id: number; a: Address; b: Address; atMs: number; txHash: Hex }`
  - `type AcaraGraf = { eventId: Hex; title: string; startsAt: number; endsAt: number }` (unix DETIK)
  - `type CheckInGraf = { eventId: Hex; address: Address }`
  - `type GrafStore` dengan metode `koneksiSejak(sejakId, batas)`, `acara(eventId)`, `acaraBeririsan(mulaiDetik, akhirDetik)`, `checkInAcara(eventIds)`, `koneksiDalamJendela(mulaiMs, akhirMs)`, `daftarAcara(nowDetik, batas)`
  - `const METODE_GRAF_STORE`
  - `type GrafDeps = { graf: GrafStore; meet: Pick<MeetStore, "profilRingkas">; webOrigins: readonly string[]; nowMs: () => number }`

Baca `ports.ts` bagian `METODE_PESAN_STORE` dulu dan ikuti pola pengait dua arahnya.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/graf-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_GRAF_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah metode GrafStore harus jadi tindakan sadar: dunia-graf.ts
 * dan fake di support/deps.ts ikut berubah, dan setiap metode baru adalah
 * pintu baru ke data publik yang harus melewati penyaring kunci.
 */
describe("bentuk GrafStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_GRAF_STORE).toEqual([
      "koneksiSejak", "acara", "acaraBeririsan", "checkInAcara", "koneksiDalamJendela", "daftarAcara",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/graf-ports.test.ts`
Expected: FAIL — `METODE_GRAF_STORE` tidak diekspor (undefined).

- [ ] **Step 3: Tambahkan di AKHIR `apps/api/src/ports.ts`**

Satu baris kosong setelah penutup `PesanDeps`, lalu:

```ts
// ── Fase 6: graf publik ─────────────────────────────────────────────────────

/**
 * Satu koneksi seperti yang boleh dilihat endpoint graf publik. Sengaja TANPA
 * `cell` dan `nonce` (spec 6 §4.4): store graf tidak pernah memilih kolom itu,
 * jadi tidak ada yang bisa bocor lewat penyusun respons.
 */
export type KoneksiGraf = {
  id: number;
  /** Huruf kecil. */
  a: Address;
  /** Huruf kecil. */
  b: Address;
  /** MILIDETIK — `new Date(created_at).getTime()`, sama persis dengan trust. */
  atMs: number;
  txHash: Hex;
};

/** Jendela sebuah acara. Tanpa `center_cell` dan `host`, dengan sengaja. */
export type AcaraGraf = {
  /** Huruf kecil. */
  eventId: Hex;
  title: string;
  /** unix DETIK */
  startsAt: number;
  /** unix DETIK */
  endsAt: number;
};

export type CheckInGraf = { eventId: Hex; address: Address };

export type GrafStore = {
  /** Koneksi dengan `id > sejakId`, urut `id` naik, paling banyak `batas`. */
  koneksiSejak(sejakId: number, batas: number): Promise<KoneksiGraf[]>;
  acara(eventId: Hex): Promise<AcaraGraf | null>;
  /**
   * Acara yang jendelanya beririsan dengan `[mulaiDetik, akhirDetik]`,
   * termasuk acara pemilik jendela itu sendiri. BOLEH mengembalikan lebih
   * (superset): aturan acara di graf.ts yang memutuskan.
   */
  acaraBeririsan(mulaiDetik: number, akhirDetik: number): Promise<AcaraGraf[]>;
  checkInAcara(eventIds: Hex[]): Promise<CheckInGraf[]>;
  /**
   * SELURUH koneksi yang waktunya di `[mulaiMs, akhirMs]`, urut `id` naik.
   * BOLEH superset — aturan acara di graf.ts yang memutuskan.
   */
  koneksiDalamJendela(mulaiMs: number, akhirMs: number): Promise<KoneksiGraf[]>;
  /** Acara yang sudah mulai dan belum lewat 7 hari sejak berakhir, terbaru berakhir dulu. */
  daftarAcara(nowDetik: number, batas: number): Promise<AcaraGraf[]>;
};

export const METODE_GRAF_STORE = [
  "koneksiSejak", "acara", "acaraBeririsan", "checkInAcara", "koneksiDalamJendela", "daftarAcara",
] as const satisfies readonly (keyof GrafStore)[];

type SisaMetodeGrafStore = Exclude<keyof GrafStore, (typeof METODE_GRAF_STORE)[number]>;
type AssertNeverGraf<T extends never> = T;
type _PastikanMetodeGrafStoreLengkap = AssertNeverGraf<SisaMetodeGrafStore>;

export type GrafDeps = {
  graf: GrafStore;
  /** Nama tampilan + tier, dipotong per kelompok — sumber yang sama dengan feed dan pesan. */
  meet: Pick<MeetStore, "profilRingkas">;
  /** Origin web yang boleh membaca `/graf/*` lewat browser. Kosong = CORS mati. */
  webOrigins: readonly string[];
  nowMs: () => number;
};
```

- [ ] **Step 4: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/graf-ports.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS, typecheck bersih.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ports.ts \
  apps/api/test/graf-ports.test.ts
git commit -m "$(cat <<'EOF'
feat(api): port graf publik baca-saja

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Buktikan pengait dua arah menggigit (mutasi sungguhan)**

**Arah 1:** di `METODE_GRAF_STORE`, ganti `"daftarAcara"` menjadi `"daftarAcaraXXX"`. Jalankan `pnpm --filter @nearly/api typecheck`. Harapkan `TS2820` di konstanta itu (dan `TS2344` di baris `_PastikanMetodeGrafStoreLengkap`, karena `"daftarAcara"` kini tidak terdaftar). Catat kode galatnya. Kembalikan: `git checkout -- apps/api/src/ports.ts`.

**Arah 2:** tambahkan `metodeBaruUjiCoba(): Promise<void>;` di dalam `GrafStore` tanpa menyentuh konstanta. Jalankan typecheck. Harapkan `TS2344` di baris `_PastikanMetodeGrafStoreLengkap`. Kembalikan: `git checkout -- apps/api/src/ports.ts`.

Run: `git status --short`
Expected: kosong.

---

## Task 2: `graf.ts` — fungsi murni

**Files:**
- Create: `apps/api/src/graf.ts`
- Test: `apps/api/test/graf.test.ts`

**Interfaces:**
- Consumes: `KoneksiGraf`, `AcaraGraf`, `CheckInGraf`, `ProfilRingkas` (Task 1 / sudah ada); `TIER_LABELS` dari `@nearly/trust`.
- Produces (dipakai Task 3, 5, 6):
  - `BATAS_HALAMAN = 2000`, `JENDELA_DAFTAR_ACARA_DETIK = 604800`, `BATAS_DAFTAR_ACARA = 50`
  - `type TierLabel`, `SimpulPublik`, `SisiPublik`, `AcaraPublik`, `HalamanGraf`, `HalamanAcara`
  - `potongHalaman(urut: KoneksiGraf[], sejakId: number, batas?): { sisi; kursor; lengkap }`
  - `alamatDiSisi(sisi: KoneksiGraf[]): Address[]`
  - `labelTier(tier: number | undefined): TierLabel`
  - `susunSimpul(alamat: Address[], profil: Map<string, ProfilRingkas>): SimpulPublik[]`
  - `keSisiPublik(k: KoneksiGraf): SisiPublik`, `keAcaraPublik(e: AcaraGraf, nowDetik: number): AcaraPublik`
  - `sisiAcara(eventId: Hex, koneksi: KoneksiGraf[], acara: AcaraGraf[], checkins: CheckInGraf[]): KoneksiGraf[]` — urut `id` naik
  - `hitungHadir(eventId: Hex, checkins: CheckInGraf[]): number`
  - `bacaSejakId(raw: string | undefined): number | null`, `bacaEventId(raw: string): Hex | null`

Baca `eventOccasionFor` di `apps/api/src/trust/load-graph.ts:120` sebelum menulis `sisiAcara` — aturannya harus sama persis, termasuk pemecah seri `event_id` terkecil (Ruling R-A). JANGAN mengimpor apa pun dari `trust/load-graph.ts` di berkas ini; kesamaannya dibuktikan tes Task 6.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/graf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  alamatDiSisi, BATAS_HALAMAN, bacaEventId, bacaSejakId, hitungHadir, keAcaraPublik,
  labelTier, potongHalaman, susunSimpul,
} from "../src/graf";
import type { KoneksiGraf } from "../src/ports";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;

function sisi(n: number, mulai = 1): KoneksiGraf[] {
  return Array.from({ length: n }, (_, i) => ({
    id: mulai + i, a: A, b: B, atMs: 1_000 + i, txHash: `0x${"ab".repeat(32)}` as Hex,
  }));
}

describe("potongHalaman", () => {
  it("memotong di batas halaman dan menandai belum lengkap", () => {
    const h = potongHalaman(sisi(BATAS_HALAMAN + 1), 0);
    expect(h.sisi).toHaveLength(BATAS_HALAMAN);
    expect(h.kursor).toBe(BATAS_HALAMAN);
    expect(h.lengkap).toBe(false);
  });

  it("tepat sebanyak batas berarti lengkap", () => {
    const h = potongHalaman(sisi(BATAS_HALAMAN), 0);
    expect(h.sisi).toHaveLength(BATAS_HALAMAN);
    expect(h.lengkap).toBe(true);
  });

  it("kursor adalah id terbesar di halaman", () => {
    expect(potongHalaman(sisi(3, 41), 40).kursor).toBe(43);
  });

  it("halaman kosong mengembalikan sejakId apa adanya — kursor tidak pernah mundur", () => {
    expect(potongHalaman([], 42)).toEqual({ sisi: [], kursor: 42, lengkap: true });
  });
});

describe("simpul", () => {
  it("alamat unik huruf kecil dari kedua ujung sisi", () => {
    expect(alamatDiSisi(sisi(3))).toEqual([A.toLowerCase(), B.toLowerCase()]);
  });

  it("tanpa snapshot → Baru", () => {
    expect(susunSimpul([A], new Map())).toEqual([
      { address: A.toLowerCase(), displayName: "", tierLabel: "Baru" },
    ]);
  });

  it("tier di luar rentang → Baru, bukan undefined", () => {
    expect(labelTier(7)).toBe("Baru");
    expect(labelTier(-1)).toBe("Baru");
    expect(labelTier(undefined)).toBe("Baru");
  });

  it("nama tampilan dan label tier dari profil", () => {
    const profil = new Map([[A.toLowerCase(), { displayName: "Budi", tier: 3 }]]);
    expect(susunSimpul([A], profil)).toEqual([
      { address: A.toLowerCase(), displayName: "Budi", tierLabel: "Inti" },
    ]);
  });
});

describe("keAcaraPublik", () => {
  const ev = { eventId: `0x${"11".repeat(32)}` as Hex, title: "Hack", startsAt: 100, endsAt: 200 };

  it("live hanya di dalam jendela, inklusif", () => {
    expect(keAcaraPublik(ev, 99).live).toBe(false);
    expect(keAcaraPublik(ev, 100).live).toBe(true);
    expect(keAcaraPublik(ev, 200).live).toBe(true);
    expect(keAcaraPublik(ev, 201).live).toBe(false);
  });
});

describe("hitungHadir", () => {
  it("alamat unik di acara itu saja", () => {
    const E = `0x${"11".repeat(32)}` as Hex;
    const L = `0x${"22".repeat(32)}` as Hex;
    expect(hitungHadir(E, [
      { eventId: E, address: A }, { eventId: E, address: B }, { eventId: L, address: A },
    ])).toBe(2);
  });
});

describe("masukan query", () => {
  it("sejakId kosong → 0; bilangan bulat diterima; selain itu null", () => {
    expect(bacaSejakId(undefined)).toBe(0);
    expect(bacaSejakId("")).toBe(0);
    expect(bacaSejakId("42")).toBe(42);
    expect(bacaSejakId("-1")).toBeNull();
    expect(bacaSejakId("1.5")).toBeNull();
    expect(bacaSejakId("abc")).toBeNull();
    expect(bacaSejakId("99999999999999999")).toBeNull();
  });

  it("eventId harus 0x + 64 hex, dinormalkan huruf kecil", () => {
    expect(bacaEventId(`0x${"AB".repeat(32)}`)).toBe(`0x${"ab".repeat(32)}`);
    expect(bacaEventId("0x1234")).toBeNull();
    expect(bacaEventId(`${"ab".repeat(32)}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/graf.test.ts`
Expected: FAIL — `Failed to resolve import "../src/graf"`.

- [ ] **Step 3: Buat `apps/api/src/graf.ts`**

```ts
import type { Address, Hex } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import type { AcaraGraf, CheckInGraf, KoneksiGraf, ProfilRingkas } from "./ports";

/** Paling banyak sisi per respons (spec 6 §4.2). */
export const BATAS_HALAMAN = 2000;

/** Daftar acara di pemilih `/live`: berakhir paling lama 7 hari lalu (spec 6 §4.3). */
export const JENDELA_DAFTAR_ACARA_DETIK = 7 * 86_400;
export const BATAS_DAFTAR_ACARA = 50;

export type TierLabel = (typeof TIER_LABELS)[number];

export type SimpulPublik = { address: Address; displayName: string; tierLabel: TierLabel };
export type SisiPublik = { id: number; a: Address; b: Address; atMs: number; txHash: Hex };
export type AcaraPublik = { eventId: Hex; title: string; startsAt: number; endsAt: number; live: boolean };

export type HalamanGraf = {
  simpul: SimpulPublik[];
  sisi: SisiPublik[];
  kursor: number;
  lengkap: boolean;
};

export type HalamanAcara = HalamanGraf & {
  acara: AcaraPublik;
  hitungan: { hadir: number; salaman: number };
};

/**
 * Memotong sisi (sudah urut `id` naik, semuanya `id > sejakId`) menjadi satu
 * halaman. `kursor` tidak pernah mundur: halaman kosong mengembalikan
 * `sejakId` apa adanya.
 */
export function potongHalaman(
  urut: KoneksiGraf[], sejakId: number, batas = BATAS_HALAMAN,
): { sisi: KoneksiGraf[]; kursor: number; lengkap: boolean } {
  const sisi = urut.slice(0, batas);
  const terakhir = sisi[sisi.length - 1];
  return { sisi, kursor: terakhir ? terakhir.id : sejakId, lengkap: urut.length <= batas };
}

/** Alamat unik (huruf kecil) yang muncul di sisi, urut kemunculan. */
export function alamatDiSisi(sisi: KoneksiGraf[]): Address[] {
  const unik = new Set<string>();
  for (const s of sisi) {
    unik.add(s.a.toLowerCase());
    unik.add(s.b.toLowerCase());
  }
  return [...unik] as Address[];
}

/** Alamat tanpa snapshot — atau tier di luar rentang — tampil `Baru`. */
export function labelTier(tier: number | undefined): TierLabel {
  return TIER_LABELS[tier ?? 0] ?? TIER_LABELS[0];
}

/**
 * Penyaring kunci JSON, bagian simpul. Setiap medan disebut SATU PER SATU —
 * jangan pernah mengganti ini dengan spread, karena spread adalah cara kolom
 * baru di store diam-diam keluar lewat endpoint publik (spec 6 §4.4).
 */
export function susunSimpul(alamat: Address[], profil: Map<string, ProfilRingkas>): SimpulPublik[] {
  return alamat.map((a) => {
    const p = profil.get(a.toLowerCase());
    return {
      address: a.toLowerCase() as Address,
      displayName: p?.displayName ?? "",
      tierLabel: labelTier(p?.tier),
    };
  });
}

/** Penyaring kunci JSON, bagian sisi. Medan disebut satu per satu, tanpa spread. */
export function keSisiPublik(k: KoneksiGraf): SisiPublik {
  return {
    id: k.id,
    a: k.a.toLowerCase() as Address,
    b: k.b.toLowerCase() as Address,
    atMs: k.atMs,
    txHash: k.txHash,
  };
}

/** Penyaring kunci JSON, bagian acara. Medan disebut satu per satu, tanpa spread. */
export function keAcaraPublik(e: AcaraGraf, nowDetik: number): AcaraPublik {
  return {
    eventId: e.eventId,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    live: e.startsAt <= nowDetik && nowDetik <= e.endsAt,
  };
}

/**
 * ATURAN "SALAMAN DI ACARA INI". WAJIB identik dengan `eventOccasionFor` di
 * apps/api/src/trust/load-graph.ts — dikunci tes graf-konsistensi.test.ts
 * yang menjalankan `rowsToGraph` pada data yang sama.
 *
 * Koneksi milik acara E bila, dan hanya bila:
 *   1. KEDUA alamat check-in di E, dan
 *   2. waktu koneksi di jendela `[startsAt, endsAt]` E (inklusif), dan
 *   3. di antara semua acara yang memenuhi 1 dan 2, `event_id` E yang terkecil
 *      secara leksikografis — pemecah seri trust untuk acara tumpang tindih.
 *
 * Tanpa butir 3, sebuah salaman di dua acara tumpang tindih tampil di layar
 * kedua acara, sementara trust hanya menghitungnya untuk satu. Layar proyektor
 * dan skor lalu menceritakan dua kisah tentang ruangan yang sama.
 */
export function sisiAcara(
  eventId: Hex,
  koneksi: KoneksiGraf[],
  acara: AcaraGraf[],
  checkins: CheckInGraf[],
): KoneksiGraf[] {
  const jendela = new Map<string, { mulaiMs: number; akhirMs: number }>();
  for (const e of acara) {
    jendela.set(e.eventId.toLowerCase(), { mulaiMs: e.startsAt * 1000, akhirMs: e.endsAt * 1000 });
  }

  const hadirDi = new Map<string, Set<string>>();
  for (const c of checkins) {
    const addr = c.address.toLowerCase();
    let s = hadirDi.get(addr);
    if (!s) {
      s = new Set();
      hadirDi.set(addr, s);
    }
    s.add(c.eventId.toLowerCase());
  }

  const target = eventId.toLowerCase();

  function acaraMilik(k: KoneksiGraf): string | null {
    const ea = hadirDi.get(k.a.toLowerCase());
    const eb = hadirDi.get(k.b.toLowerCase());
    if (!ea || !eb) return null;
    const cocok: string[] = [];
    for (const id of ea) {
      if (!eb.has(id)) continue;
      const w = jendela.get(id);
      if (!w) continue;
      if (k.atMs < w.mulaiMs || k.atMs > w.akhirMs) continue;
      cocok.push(id);
    }
    if (cocok.length === 0) return null;
    cocok.sort();
    return cocok[0]!;
  }

  return koneksi
    .filter((k) => acaraMilik(k) === target)
    .sort((x, y) => x.id - y.id);
}

/** Jumlah alamat unik yang check-in di acara `eventId`. */
export function hitungHadir(eventId: Hex, checkins: CheckInGraf[]): number {
  const target = eventId.toLowerCase();
  const unik = new Set<string>();
  for (const c of checkins) {
    if (c.eventId.toLowerCase() === target) unik.add(c.address.toLowerCase());
  }
  return unik.size;
}

/**
 * `sejakId` dari query. Kosong → 0. Selain bilangan bulat ≥ 0 yang aman → null
 * (rute menjawab 400). Dibatasi `Number.MAX_SAFE_INTEGER` karena `id` bigserial
 * dibandingkan sebagai number di seluruh jalur ini.
 */
export function bacaSejakId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 0;
  if (!/^\d{1,16}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** `event_id` sah: 0x + 64 hex. Dinormalkan huruf kecil. */
export function bacaEventId(raw: string): Hex | null {
  return /^0x[0-9a-fA-F]{64}$/.test(raw) ? (raw.toLowerCase() as Hex) : null;
}
```

- [ ] **Step 4: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/graf.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/graf.ts \
  apps/api/test/graf.test.ts
git commit -m "$(cat <<'EOF'
feat(api): fungsi murni graf — halaman, simpul, penyaring kunci, aturan acara

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `graf-store.ts` — kueri Supabase sempit

**Files:**
- Create: `apps/api/src/graf-store.ts`
- Test: `apps/api/test/graf-store.test.ts`

**Interfaces:**
- Consumes: `GrafStore`, `KoneksiGraf`, `AcaraGraf`, `CheckInGraf` (Task 1); `JENDELA_DAFTAR_ACARA_DETIK` (Task 2); `fetchAllPages`, `PAGE_SIZE` dari `apps/api/src/trust/store.ts` (hanya impor, Ruling R-D); `potongKelompok` dari `apps/api/src/feed-store.ts`.
- Produces (dipakai Task 5, 6, 7):
  - `createGrafStore(db: SupabaseClient): GrafStore`
  - `rowToKoneksiGraf(r: BarisKoneksiGraf): KoneksiGraf`, `rowToAcaraGraf(r: BarisAcaraGraf): AcaraGraf`
  - `type BarisKoneksiGraf = { id: number | string; addr_a: string; addr_b: string; created_at: string; tx_hash: string }`
  - `type BarisAcaraGraf = { event_id: string; title: string; starts_at: number | string; ends_at: number | string }`

**Tiga jebakan yang ditutup berkas ini:**
1. PostgREST memotong di 1000 baris TANPA galat. Halaman 2000 sisi diambil per potongan `PAGE_SIZE`.
2. `created_at` bermikrodetik. Jendela acara memakai `lt(akhirMs + 1)`, bukan `lte(akhirMs)`, supaya koneksi yang `getTime()`-nya tepat `akhirMs` — yang MASUK menurut trust — tidak terbuang. Store boleh mengembalikan superset; `graf.ts` yang memutuskan.
3. Kolom rahasia (`cell`, `nonce`, `center_cell`, `host`) tidak pernah dipilih — yang tidak dibaca tidak bisa bocor. Tabel `blocks`, `trust_snapshots`, `vouches`, `slashes`, `reports` tidak pernah dibaca store ini.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/graf-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import { createGrafStore, rowToKoneksiGraf } from "../src/graf-store";

type Jejak = { tabel: string; op: string; arg: unknown[] };
type Jawaban = { data?: unknown; error?: { message: string } | null };

/**
 * Klien palsu yang MEREKAM setiap panggilan berantai. Setiap `from()` mengambil
 * satu jawaban dari depan antrean; tanpa jawaban tersisa, ia menjawab kosong.
 */
function dbPalsu(antrean: Jawaban[] = []) {
  const jejak: Jejak[] = [];
  const db = {
    from(tabel: string) {
      const jawaban = antrean.shift() ?? { data: [], error: null };
      const rantai: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "gt", "gte", "lt", "lte", "order", "limit", "range", "maybeSingle"]) {
        rantai[op] = (...arg: unknown[]) => { jejak.push({ tabel, op, arg }); return rantai; };
      }
      rantai.then = (r: (v: unknown) => unknown) => r({ data: null, error: null, ...jawaban });
      return rantai;
    },
  } as unknown as SupabaseClient;
  return { db, jejak };
}

const ops = (j: Jejak[], op: string) => j.filter((x) => x.op === op);
const E = `0x${"11".repeat(32)}` as Hex;

function barisKoneksi(id: number) {
  return {
    id, addr_a: "0x00000000000000000000000000000000000000aa", addr_b: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-14T10:00:00.123+00:00", tx_hash: `0x${"ab".repeat(32)}`,
  };
}

describe("createGrafStore", () => {
  it("rowToKoneksiGraf mengurai waktu persis seperti rowsToGraph, termasuk mikrodetik", () => {
    const k = rowToKoneksiGraf({ ...barisKoneksi(7), id: "7", created_at: "2026-09-14T10:00:00.123456+00:00" });
    expect(k.id).toBe(7);
    expect(k.atMs).toBe(new Date("2026-09-14T10:00:00.123456+00:00").getTime());
  });

  it("koneksiSejak mengambil per potongan 1000 karena PostgREST memotong diam-diam", async () => {
    const { db, jejak } = dbPalsu([
      { data: Array.from({ length: 1000 }, (_, i) => barisKoneksi(i + 1)) },
      { data: Array.from({ length: 1000 }, (_, i) => barisKoneksi(i + 1001)) },
      { data: [barisKoneksi(2001)] },
    ]);
    const hasil = await createGrafStore(db).koneksiSejak(0, 2001);
    expect(hasil).toHaveLength(2001);
    expect(ops(jejak, "range").map((r) => r.arg)).toEqual([[0, 999], [1000, 1999], [2000, 2000]]);
    expect(ops(jejak, "gt")[0]!.arg).toEqual(["id", 0]);
    expect(ops(jejak, "order")[0]!.arg).toEqual(["id", { ascending: true }]);
  });

  it("koneksiSejak berhenti pada potongan yang tidak penuh", async () => {
    const { db, jejak } = dbPalsu([{ data: [barisKoneksi(1)] }]);
    expect(await createGrafStore(db).koneksiSejak(5, 2001)).toHaveLength(1);
    expect(ops(jejak, "range")).toHaveLength(1);
  });

  it("koneksiDalamJendela: gte awal, lt akhir + 1 ms (mikrodetik)", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createGrafStore(db).koneksiDalamJendela(1_000_000, 2_000_000);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["created_at", new Date(1_000_000).toISOString()]);
    expect(ops(jejak, "lt")[0]!.arg).toEqual(["created_at", new Date(2_000_001).toISOString()]);
  });

  it("acaraBeririsan: mulai sebelum akhir jendela dan berakhir setelah awal jendela", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }]);
    await createGrafStore(db).acaraBeririsan(100, 200);
    expect(ops(jejak, "lte")[0]!.arg).toEqual(["starts_at", 200]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["ends_at", 100]);
  });

  it("daftarAcara: sudah mulai, berakhir paling lama 7 hari lalu, terbaru berakhir dulu", async () => {
    const { db, jejak } = dbPalsu([{ data: [{ event_id: E, title: "x", starts_at: "1", ends_at: "2" }] }]);
    const hasil = await createGrafStore(db).daftarAcara(1_000_000, 50);
    expect(hasil).toEqual([{ eventId: E, title: "x", startsAt: 1, endsAt: 2 }]);
    expect(ops(jejak, "lte")[0]!.arg).toEqual(["starts_at", 1_000_000]);
    expect(ops(jejak, "gte")[0]!.arg).toEqual(["ends_at", 1_000_000 - 604_800]);
    expect(ops(jejak, "order")[0]!.arg).toEqual(["ends_at", { ascending: false }]);
    expect(ops(jejak, "limit")[0]!.arg).toEqual([50]);
  });

  it("checkInAcara tanpa id tidak mengirim kueri", async () => {
    const { db, jejak } = dbPalsu();
    expect(await createGrafStore(db).checkInAcara([])).toEqual([]);
    expect(jejak).toEqual([]);
  });

  it("galat basis data melempar", async () => {
    const { db } = dbPalsu([{ error: { message: "mati" } }]);
    await expect(createGrafStore(db).acara(E)).rejects.toThrow(/baca acara graf gagal/);
  });

  it("tidak pernah memilih kolom rahasia dan tidak pernah membaca tabel di luar tiga tabel graf", async () => {
    const { db, jejak } = dbPalsu([{ data: [] }, { data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]);
    const s = createGrafStore(db);
    await s.koneksiSejak(0, 10);
    await s.acara(E);
    await s.acaraBeririsan(1, 2);
    await s.checkInAcara([E]);
    await s.koneksiDalamJendela(1, 2);
    await s.daftarAcara(1, 50);

    expect([...new Set(jejak.map((j) => j.tabel))].sort()).toEqual(["checkins", "connections", "events"]);
    for (const sel of ops(jejak, "select")) {
      expect(String(sel.arg[0])).not.toMatch(/\*|cell|nonce|host|venue|score|ratio|operator/);
    }
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/graf-store.test.ts`
Expected: FAIL — `Failed to resolve import "../src/graf-store"`.

- [ ] **Step 3: Buat `apps/api/src/graf-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { potongKelompok } from "./feed-store";
import { fetchAllPages, PAGE_SIZE } from "./trust/store";
import type { AcaraGraf, CheckInGraf, GrafStore, KoneksiGraf } from "./ports";
import { JENDELA_DAFTAR_ACARA_DETIK } from "./graf";

/**
 * Kolom yang BOLEH dipilih dari `connections` untuk graf publik. `cell` dan
 * `nonce` sengaja tidak ada (spec 6 §4.4) — yang tidak pernah dibaca tidak
 * bisa bocor.
 */
const KOLOM_KONEKSI = "id, addr_a, addr_b, created_at, tx_hash";
/** Tanpa `center_cell`, `host`, `venue_label`, `tx_hash`. */
const KOLOM_ACARA = "event_id, title, starts_at, ends_at";

export type BarisKoneksiGraf = {
  id: number | string; addr_a: string; addr_b: string; created_at: string; tx_hash: string;
};
export type BarisAcaraGraf = {
  event_id: string; title: string; starts_at: number | string; ends_at: number | string;
};

/** Waktu diurai PERSIS seperti `rowsToGraph`: `new Date(created_at).getTime()`. */
export function rowToKoneksiGraf(r: BarisKoneksiGraf): KoneksiGraf {
  return {
    id: Number(r.id),
    a: r.addr_a.toLowerCase() as Address,
    b: r.addr_b.toLowerCase() as Address,
    atMs: new Date(r.created_at).getTime(),
    txHash: r.tx_hash as Hex,
  };
}

export function rowToAcaraGraf(r: BarisAcaraGraf): AcaraGraf {
  return {
    eventId: r.event_id.toLowerCase() as Hex,
    title: r.title,
    startsAt: Number(r.starts_at),
    endsAt: Number(r.ends_at),
  };
}

export function createGrafStore(db: SupabaseClient): GrafStore {
  return {
    async koneksiSejak(sejakId, batas) {
      // PostgREST memotong di 1000 baris TANPA galat (lihat fetchAllPages),
      // jadi halaman 2000 diambil per potongan PAGE_SIZE. Offset di atas
      // `id > sejakId order by id` stabil: id tidak pernah berubah dan baris
      // baru selalu mendapat id lebih besar.
      const hasil: KoneksiGraf[] = [];
      for (let from = 0; hasil.length < batas; from += PAGE_SIZE) {
        const to = Math.min(from + PAGE_SIZE, batas) - 1;
        const { data, error } = await db.from("connections").select(KOLOM_KONEKSI)
          .gt("id", sejakId).order("id", { ascending: true }).range(from, to);
        if (error) throw new Error(`baca koneksi graf gagal: ${error.message}`);
        const halaman = (data ?? []) as BarisKoneksiGraf[];
        hasil.push(...halaman.map(rowToKoneksiGraf));
        if (halaman.length < to - from + 1) break;
      }
      return hasil;
    },

    async acara(eventId) {
      const { data, error } = await db.from("events").select(KOLOM_ACARA)
        .eq("event_id", eventId.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca acara graf gagal: ${error.message}`);
      return data ? rowToAcaraGraf(data as BarisAcaraGraf) : null;
    },

    async acaraBeririsan(mulaiDetik, akhirDetik) {
      const rows = await fetchAllPages<BarisAcaraGraf>(
        (f, t) => db.from("events").select(KOLOM_ACARA)
          .lte("starts_at", akhirDetik).gte("ends_at", mulaiDetik)
          .order("event_id", { ascending: true }).range(f, t) as never,
        "baca acara beririsan",
      );
      return rows.map(rowToAcaraGraf);
    },

    async checkInAcara(eventIds) {
      const unik = [...new Set(eventIds.map((e) => e.toLowerCase()))];
      if (unik.length === 0) return [];
      const perKelompok = await Promise.all(potongKelompok(unik).map((bagian) =>
        fetchAllPages<{ event_id: string; address: string }>(
          (f, t) => db.from("checkins").select("event_id, address")
            .in("event_id", bagian)
            .order("event_id", { ascending: true }).order("address", { ascending: true })
            .range(f, t) as never,
          "baca check-in graf",
        )));
      return perKelompok.flat().map((r): CheckInGraf => ({
        eventId: r.event_id.toLowerCase() as Hex,
        address: r.address.toLowerCase() as Address,
      }));
    },

    async koneksiDalamJendela(mulaiMs, akhirMs) {
      // `lt(akhirMs + 1)`, bukan `lte(akhirMs)`: created_at bisa bermikrodetik.
      // Koneksi pada akhirMs + 0,4 ms punya getTime() === akhirMs dan MASUK
      // menurut trust; `lte` akan membuangnya. Superset aman — graf.ts memutuskan.
      const rows = await fetchAllPages<BarisKoneksiGraf>(
        (f, t) => db.from("connections").select(KOLOM_KONEKSI)
          .gte("created_at", new Date(mulaiMs).toISOString())
          .lt("created_at", new Date(akhirMs + 1).toISOString())
          .order("id", { ascending: true }).range(f, t) as never,
        "baca koneksi acara",
      );
      return rows.map(rowToKoneksiGraf);
    },

    async daftarAcara(nowDetik, batas) {
      const { data, error } = await db.from("events").select(KOLOM_ACARA)
        .lte("starts_at", nowDetik)
        .gte("ends_at", nowDetik - JENDELA_DAFTAR_ACARA_DETIK)
        .order("ends_at", { ascending: false })
        .limit(batas);
      if (error) throw new Error(`baca daftar acara gagal: ${error.message}`);
      return ((data ?? []) as BarisAcaraGraf[]).map(rowToAcaraGraf);
    },
  };
}
```

- [ ] **Step 4: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/graf-store.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/graf-store.ts \
  apps/api/test/graf-store.test.ts
git commit -m "$(cat <<'EOF'
feat(api): store graf — kolom sempit, berhalaman, jendela mikrodetik

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Cache singkat dan env server

**Files:**
- Create: `apps/api/src/cache-singkat.ts`, `apps/api/src/server-env.ts`
- Test: `apps/api/test/cache-singkat.test.ts`, `apps/api/test/server-env.test.ts`

**Interfaces:**
- Consumes: —
- Produces (dipakai Task 5 dan 7):
  - `type CacheSingkat<T> = { ambil(kunci: string, hitung: () => Promise<T>): Promise<T>; ukuran(): number }`
  - `buatCacheSingkat<T>(nowMs: () => number, umurMs: number, batasEntri?: number): CacheSingkat<T>`
  - `PORT_BAWAAN = 8787`, `bacaPort(raw: string | undefined): number`
  - `bacaWebOrigins(raw: string | undefined): string[]`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/cache-singkat.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buatCacheSingkat } from "../src/cache-singkat";

describe("buatCacheSingkat", () => {
  it("kunci sama dalam umurnya → hitung sekali; setelah umur habis → hitung lagi", async () => {
    const jam = { t: 0 };
    const c = buatCacheSingkat<number>(() => jam.t, 2000);
    const hitung = vi.fn(async () => 1);
    await c.ambil("k", hitung);
    jam.t = 1999;
    await c.ambil("k", hitung);
    expect(hitung).toHaveBeenCalledTimes(1);
    jam.t = 2000;
    await c.ambil("k", hitung);
    expect(hitung).toHaveBeenCalledTimes(2);
  });

  it("panggilan bersamaan berbagi satu promise", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000);
    let selesai!: (n: number) => void;
    const hitung = vi.fn(() => new Promise<number>((r) => { selesai = r; }));
    const p1 = c.ambil("k", hitung);
    const p2 = c.ambil("k", hitung);
    selesai(5);
    expect(await Promise.all([p1, p2])).toEqual([5, 5]);
    expect(hitung).toHaveBeenCalledTimes(1);
  });

  it("promise yang gagal tidak disimpan", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000);
    await expect(c.ambil("k", async () => { throw new Error("mati"); })).rejects.toThrow("mati");
    expect(await c.ambil("k", async () => 7)).toBe(7);
  });

  it("jumlah entri dibatasi — sejakId bebas dari query tidak bisa mengisi memori", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000, 3);
    for (let i = 0; i < 10; i++) await c.ambil(`k${i}`, async () => i);
    expect(c.ukuran()).toBeLessThanOrEqual(3);
  });
});
```

`apps/api/test/server-env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bacaPort, bacaWebOrigins, PORT_BAWAAN } from "../src/server-env";

describe("PORT (spec 6 §4.7)", () => {
  it("tidak ada atau kosong → 8787", () => {
    expect(PORT_BAWAAN).toBe(8787);
    expect(bacaPort(undefined)).toBe(8787);
    expect(bacaPort("")).toBe(8787);
    expect(bacaPort("   ")).toBe(8787);
  });

  it("bilangan bulat dari env dipakai", () => {
    expect(bacaPort("3000")).toBe(3000);
    expect(bacaPort(" 8080 ")).toBe(8080);
  });

  it("nilai tak sah melempar, bukan diam-diam kembali ke 8787", () => {
    for (const v of ["0", "65536", "abc", "80.5", "-1", "8787x"]) {
      expect(() => bacaPort(v), v).toThrow(/PORT tidak sah/);
    }
  });
});

describe("WEB_ORIGINS (spec 6 §4.6)", () => {
  it("tidak ada atau kosong → daftar kosong (CORS mati)", () => {
    expect(bacaWebOrigins(undefined)).toEqual([]);
    expect(bacaWebOrigins("")).toEqual([]);
    expect(bacaWebOrigins(" , ")).toEqual([]);
  });

  it("dipisah koma, spasi dan garis miring penutup dibuang", () => {
    expect(bacaWebOrigins("https://nearly.vercel.app/, https://nearly.xyz")).toEqual([
      "https://nearly.vercel.app", "https://nearly.xyz",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/cache-singkat.test.ts test/server-env.test.ts`
Expected: FAIL — kedua modul tidak ditemukan.

- [ ] **Step 3: Buat `apps/api/src/cache-singkat.ts`**

```ts
/**
 * Cache di memori proses untuk endpoint publik yang dipanggil tiap 3 detik
 * oleh setiap layar yang terbuka (spec 6 §4.5).
 *
 * Yang disimpan adalah PROMISE, bukan hasil: sepuluh tab yang meminta kunci
 * yang sama di milidetik yang sama menunggu SATU kueri, bukan sepuluh kueri
 * yang berlomba lalu menulis cache bersamaan. Promise yang gagal langsung
 * dibuang, supaya galat sesaat tidak tersimpan 2 detik.
 */
export type CacheSingkat<T> = {
  ambil(kunci: string, hitung: () => Promise<T>): Promise<T>;
  ukuran(): number;
};

export function buatCacheSingkat<T>(
  nowMs: () => number, umurMs: number, batasEntri = 1000,
): CacheSingkat<T> {
  const isi = new Map<string, { sampaiMs: number; nilai: Promise<T> }>();

  function bersihkan(sekarang: number) {
    for (const [k, v] of isi) if (v.sampaiMs <= sekarang) isi.delete(k);
    // Kunci memuat `sejakId` bebas dari query — tanpa batas, siapa pun bisa
    // mengisi memori proses dengan sejakId=1, 2, 3, ...
    while (isi.size >= batasEntri) {
      const tertua = isi.keys().next().value;
      if (tertua === undefined) break;
      isi.delete(tertua);
    }
  }

  return {
    ambil(kunci, hitung) {
      const sekarang = nowMs();
      const ada = isi.get(kunci);
      if (ada && ada.sampaiMs > sekarang) return ada.nilai;

      bersihkan(sekarang);
      const nilai = hitung();
      isi.set(kunci, { sampaiMs: sekarang + umurMs, nilai });
      nilai.catch(() => {
        if (isi.get(kunci)?.nilai === nilai) isi.delete(kunci);
      });
      return nilai;
    },
    ukuran: () => isi.size,
  };
}
```

- [ ] **Step 4: Buat `apps/api/src/server-env.ts`**

```ts
/**
 * Pembacaan env server yang cukup rawan untuk diuji sendiri (spec 6 §4.6, §4.7).
 * Murni: menerima nilai mentah, tidak membaca `process.env` sendiri.
 */

export const PORT_BAWAAN = 8787;

/** Kosong atau tidak ada → 8787. Selain bilangan bulat 1–65535 → melempar. */
export function bacaPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return PORT_BAWAAN;
  const t = raw.trim();
  const n = Number(t);
  if (!/^\d+$/.test(t) || !Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`env PORT tidak sah: "${raw}" (harus bilangan bulat 1–65535)`);
  }
  return n;
}

/**
 * `WEB_ORIGINS` dipisah koma. Spasi dan garis miring penutup dibuang: header
 * `Origin` dari browser tidak pernah berakhiran `/`, jadi
 * `https://nearly.vercel.app/` yang tersalin dari bilah alamat tidak akan
 * pernah cocok — dan kegagalannya senyap (CORS mati tanpa pesan di server).
 */
export function bacaWebOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter((s) => s.length > 0);
}
```

- [ ] **Step 5: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/cache-singkat.test.ts test/server-env.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/cache-singkat.ts \
  apps/api/src/server-env.ts \
  apps/api/test/cache-singkat.test.ts \
  apps/api/test/server-env.test.ts
git commit -m "$(cat <<'EOF'
feat(api): cache 2 detik berbasis promise; PORT dan WEB_ORIGINS dari env

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rute graf dan CORS

**Files:**
- Create: `apps/api/src/cors-graf.ts`, `apps/api/src/routes/graf.ts`, `apps/api/test/support/dunia-graf.ts`
- Test: `apps/api/test/graf.route.test.ts`

**Interfaces:**
- Consumes: `GrafDeps`, `KoneksiGraf` (Task 1); semua ekspor `graf.ts` (Task 2); `rowToKoneksiGraf`, `rowToAcaraGraf` (Task 3); `buatCacheSingkat` (Task 4); tipe `GraphRows` dari `apps/api/src/trust/load-graph.ts` (hanya di dunia uji).
- Produces (dipakai Task 6 dan 7):
  - `corsGraf(origins: readonly string[]): MiddlewareHandler`
  - `grafRoutes(deps: GrafDeps): Hono`, `UMUR_CACHE_GRAF_MS = 2000`
  - `duniaGraf(over?: Partial<DataDunia>, opsi?: { nowMs?; webOrigins? })` → `{ app, deps, graf, meet, jam, data, barisTrust }`; `muatSemua(app, jalur)`; `alamat(n)`, `idAcara(hex2)`, `iso(ms)`, `NOW_GRAF`; tipe `DataDunia`

| Endpoint | Query | Sukses | Gagal |
|---|---|---|---|
| `GET /graf/jaringan` | `sejakId` (default 0) | `{ simpul, sisi, kursor, lengkap }` | `400 invalid_cursor` |
| `GET /graf/acara` | — | `{ acara: AcaraPublik[] }` | — |
| `GET /graf/acara/:eventId` | `sejakId` | `{ simpul, sisi, kursor, lengkap, acara, hitungan }` | `400 invalid_cursor`, `404 event_not_found` |

Semua respons 200 membawa `Cache-Control: public, max-age=2`.

**Store palsu di `dunia-graf.ts` SENGAJA membocorkan kolom rahasia** (`cell`, `nonce`, `centerCell`, `host`) ke objek yang dikembalikannya, dan sengaja mengembalikan SUPERSET untuk `acaraBeririsan` dan `koneksiDalamJendela`. Dengan begitu tes nama kunci JSON membuktikan penyaring di `graf.ts`, dan tes konsistensi Task 6 membuktikan aturan jendela di `graf.ts` — bukan kebetulan penyaringan store. Jangan "memperbaiki" kebocoran itu.

- [ ] **Step 1: Buat dunia uji `apps/api/test/support/dunia-graf.ts`**

```ts
// Dunia di memori untuk tes rute graf dan tes konsistensi aturan acara.
// BUKAN berkas test (tidak berakhiran .test.ts).
import { vi } from "vitest";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { grafRoutes } from "../../src/routes/graf";
import { rowToAcaraGraf, rowToKoneksiGraf } from "../../src/graf-store";
import type { AcaraGraf, GrafDeps, GrafStore, KoneksiGraf, ProfilRingkas } from "../../src/ports";
import type { GraphRows } from "../../src/trust/load-graph";

/** Baris seperti di Supabase — LENGKAP dengan kolom yang tidak boleh keluar. */
export type BarisKoneksiDb = {
  id: number; addr_a: string; addr_b: string; created_at: string;
  tx_hash: string; cell: string | null; nonce: string;
};
export type BarisAcaraDb = {
  event_id: string; host: string; title: string; center_cell: string;
  starts_at: number; ends_at: number;
};
export type BarisCheckInDb = { event_id: string; address: string; cell: string; nonce: string };

export type DataDunia = {
  connections: BarisKoneksiDb[];
  events: BarisAcaraDb[];
  checkins: BarisCheckInDb[];
  blocks: { blocker: string; blocked: string }[];
  profil: Record<string, ProfilRingkas>;
};

export const NOW_GRAF = 1_790_000_000_000;

export function alamat(n: number): Address {
  return `0x${n.toString(16).padStart(40, "0")}` as Address;
}

export function idAcara(hex2: string): Hex {
  return `0x${hex2.repeat(32)}` as Hex;
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function duniaGraf(
  over: Partial<DataDunia> = {},
  opsi: { nowMs?: number; webOrigins?: string[] } = {},
) {
  const data: DataDunia = {
    connections: [], events: [], checkins: [], blocks: [], profil: {}, ...over,
  };
  const jam = { sekarang: opsi.nowMs ?? NOW_GRAF };

  // Store palsu ini SENGAJA menempelkan kolom rahasia (`cell`, `nonce`,
  // `centerCell`, `host`) ke objek yang dikembalikannya — meniru regresi
  // "store mulai memilih kolom terlalu banyak". Penyaring kunci di graf.ts
  // yang harus membuangnya; tes nama kunci JSON membuktikannya.
  const bocorKoneksi = (r: BarisKoneksiDb): KoneksiGraf =>
    ({ ...rowToKoneksiGraf(r), cell: r.cell, nonce: r.nonce }) as KoneksiGraf;
  const bocorAcara = (r: BarisAcaraDb): AcaraGraf =>
    ({ ...rowToAcaraGraf(r), centerCell: r.center_cell, host: r.host }) as AcaraGraf;
  const urut = () => [...data.connections].sort((x, y) => x.id - y.id);

  const graf: GrafStore = {
    koneksiSejak: vi.fn(async (sejakId: number, batas: number) =>
      urut().filter((c) => c.id > sejakId).slice(0, batas).map(bocorKoneksi)),
    acara: vi.fn(async (eventId: Hex) => {
      const e = data.events.find((x) => x.event_id === eventId.toLowerCase());
      return e ? bocorAcara(e) : null;
    }),
    // SUPERSET dengan sengaja: seluruh acara, bukan hanya yang beririsan.
    // Kontrak port mengizinkannya, dan dengan begitu aturan jendela di
    // graf.ts tidak bisa bersandar pada penyaringan store.
    acaraBeririsan: vi.fn(async () => data.events.map(bocorAcara)),
    checkInAcara: vi.fn(async (ids: Hex[]) => {
      const set = new Set(ids.map((i) => i.toLowerCase()));
      return data.checkins.filter((c) => set.has(c.event_id))
        .map((c) => ({ eventId: c.event_id as Hex, address: c.address as Address }));
    }),
    // SUPERSET dengan sengaja: seluruh koneksi, alasan yang sama.
    koneksiDalamJendela: vi.fn(async () => urut().map(bocorKoneksi)),
    daftarAcara: vi.fn(async () => data.events.map(bocorAcara)),
  };

  const meet: GrafDeps["meet"] = {
    profilRingkas: vi.fn(async (addrs: Address[]) => {
      const m = new Map<string, ProfilRingkas>();
      for (const a of addrs) {
        const p = data.profil[a.toLowerCase()];
        if (p) m.set(a.toLowerCase(), p);
      }
      return m;
    }),
  };

  const deps: GrafDeps = {
    graf, meet, webOrigins: opsi.webOrigins ?? [], nowMs: () => jam.sekarang,
  };
  const app = new Hono().route("/", grafRoutes(deps));

  /** Baris yang sama persis, dalam bentuk yang dimakan `rowsToGraph`. */
  function barisTrust(): GraphRows {
    return {
      connections: data.connections.map((c) => ({
        addr_a: c.addr_a, addr_b: c.addr_b, cell: c.cell, created_at: c.created_at,
      })),
      vouches: [], seeds: [], slashes: [],
      checkins: data.checkins.map((c) => ({ event_id: c.event_id, address: c.address })),
      events: data.events.map((e) => ({
        event_id: e.event_id, center_cell: e.center_cell, starts_at: e.starts_at, ends_at: e.ends_at,
      })),
      blocks: data.blocks,
    };
  }

  return { app, deps, graf, meet, jam, data, barisTrust };
}

/** Memuat seluruh halaman sampai `lengkap: true`, seperti layar /live. */
export async function muatSemua(app: Hono, jalur: string): Promise<{ ids: number[]; halaman: unknown[] }> {
  const ids: number[] = [];
  const halaman: unknown[] = [];
  let sejakId = 0;
  for (let i = 0; i < 100; i++) {
    const res = await app.request(`${jalur}?sejakId=${sejakId}`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json() as { sisi: { id: number }[]; kursor: number; lengkap: boolean };
    halaman.push(body);
    ids.push(...body.sisi.map((s) => s.id));
    sejakId = body.kursor;
    if (body.lengkap) return { ids, halaman };
  }
  throw new Error("tidak pernah lengkap");
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`apps/api/test/graf.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { alamat, duniaGraf, idAcara, iso, NOW_GRAF, type DataDunia } from "./support/dunia-graf";

const A = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const E1 = idAcara("11");
const T0 = Math.floor(NOW_GRAF / 1000) - 3_600;
const ORIGIN = "https://nearly.vercel.app";

function koneksi(id: number, a: string, b: string, detik: number) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return {
    id, addr_a: x, addr_b: y, created_at: iso(detik * 1000),
    tx_hash: `0x${String(id).padStart(64, "0")}`, cell: "qqguv1r", nonce: `0x${String(id).padStart(64, "9")}`,
  };
}

const DATA: Partial<DataDunia> = {
  events: [{ event_id: E1, host: A, title: "BNB Hack", center_cell: "qqguv1r", starts_at: T0, ends_at: T0 + 7_200 }],
  checkins: [
    { event_id: E1, address: A, cell: "qqguv1r", nonce: "0x01" },
    { event_id: E1, address: B, cell: "qqguv1r", nonce: "0x02" },
    { event_id: E1, address: C, cell: "qqguv1r", nonce: "0x03" },
  ],
  connections: [koneksi(1, A, B, T0 + 60), koneksi(2, B, C, T0 + 120)],
  profil: { [A]: { displayName: "Budi", tier: 2 } },
};

/** Seluruh nama kunci, di kedalaman berapa pun. */
function semuaKunci(x: unknown, keluar = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => semuaKunci(v, keluar));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      keluar.add(k);
      semuaKunci(v, keluar);
    }
  }
  return keluar;
}

function headerCors(res: Response): string[] {
  return [...res.headers.keys()].filter((k) => k.toLowerCase().startsWith("access-control-"));
}

describe("GET /graf/jaringan", () => {
  it("bentuk respons: simpul dari sisi halaman ini, tier tanpa snapshot Baru, kursor, lengkap", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request("/graf/jaringan");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=2");
    expect(await res.json()).toEqual({
      simpul: [
        { address: A, displayName: "Budi", tierLabel: "Terpercaya" },
        { address: B, displayName: "", tierLabel: "Baru" },
        { address: C, displayName: "", tierLabel: "Baru" },
      ],
      sisi: [
        { id: 1, a: A, b: B, atMs: (T0 + 60) * 1000, txHash: `0x${"1".padStart(64, "0")}` },
        { id: 2, a: B, b: C, atMs: (T0 + 120) * 1000, txHash: `0x${"2".padStart(64, "0")}` },
      ],
      kursor: 2,
      lengkap: true,
    });
  });

  it("sejakId melewati sisi yang sudah dimiliki; halaman kosong mempertahankan kursor", async () => {
    const { app } = duniaGraf(DATA);
    const satu = await (await app.request("/graf/jaringan?sejakId=1")).json() as { sisi: { id: number }[]; kursor: number };
    expect(satu.sisi.map((s) => s.id)).toEqual([2]);
    const kosong = await (await app.request("/graf/jaringan?sejakId=2")).json();
    expect(kosong).toEqual({ simpul: [], sisi: [], kursor: 2, lengkap: true });
  });

  it("sejakId tak sah → 400 invalid_cursor", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request("/graf/jaringan?sejakId=-5");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_cursor" });
  });
});

describe("GET /graf/acara", () => {
  it("daftar acara untuk pemilih, dengan live", async () => {
    const { app } = duniaGraf(DATA);
    expect(await (await app.request("/graf/acara")).json()).toEqual({
      acara: [{ eventId: E1, title: "BNB Hack", startsAt: T0, endsAt: T0 + 7_200, live: true }],
    });
  });
});

describe("GET /graf/acara/:eventId", () => {
  it("halaman graf ditambah acara dan hitungan", async () => {
    const { app } = duniaGraf(DATA);
    const body = await (await app.request(`/graf/acara/${E1}`)).json() as Record<string, unknown>;
    expect(body.acara).toEqual({ eventId: E1, title: "BNB Hack", startsAt: T0, endsAt: T0 + 7_200, live: true });
    expect(body.hitungan).toEqual({ hadir: 3, salaman: 2 });
    expect(body.kursor).toBe(2);
    expect(body.lengkap).toBe(true);
  });

  it("id huruf besar dinormalkan", async () => {
    const { app } = duniaGraf(DATA);
    expect((await app.request(`/graf/acara/${E1.toUpperCase().replace("0X", "0x")}`)).status).toBe(200);
  });

  it("acara tidak ada → 404 event_not_found", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request(`/graf/acara/${idAcara("99")}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "event_not_found" });
  });

  it("id berbentuk salah → 404 tanpa menyentuh store", async () => {
    const { app, graf } = duniaGraf(DATA);
    expect((await app.request("/graf/acara/bukan-id")).status).toBe(404);
    expect(graf.acara).not.toHaveBeenCalled();
  });
});

describe("yang tidak pernah keluar (spec 6 §4.4)", () => {
  const DILARANG = [
    "cell", "center_cell", "centerCell", "nonce", "score", "ratio", "operator_cluster", "operatorCluster",
    "blocked", "blocker", "blocks", "blokir", "terblokir", "diblokir", "host",
  ];
  const DIIZINKAN = new Set([
    "simpul", "address", "displayName", "tierLabel", "sisi", "id", "a", "b", "atMs", "txHash",
    "kursor", "lengkap", "acara", "eventId", "title", "startsAt", "endsAt", "live", "hitungan", "hadir", "salaman",
  ]);

  it("tidak ada kunci terlarang di respons mana pun — walau store membawanya", async () => {
    const { app } = duniaGraf(DATA);
    const kunci = new Set<string>();
    for (const jalur of ["/graf/jaringan", "/graf/acara", `/graf/acara/${E1}`]) {
      semuaKunci(await (await app.request(jalur)).json(), kunci);
    }
    for (const k of DILARANG) expect(kunci.has(k), `kunci terlarang: ${k}`).toBe(false);
    for (const k of kunci) {
      expect(k, `kunci tak dikenal: ${k}`).not.toMatch(/cell|nonce|score|ratio|operator|block|blokir|vouch|slash|report|lapor/i);
    }
    expect([...kunci].filter((k) => !DIIZINKAN.has(k))).toEqual([]);
  });

  it("sisi antara dua orang yang saling memblokir tampil tanpa penanda apa pun", async () => {
    const tanpa = duniaGraf(DATA);
    const dengan = duniaGraf({ ...DATA, blocks: [{ blocker: A, blocked: B }, { blocker: B, blocked: A }] });
    for (const jalur of ["/graf/jaringan", `/graf/acara/${E1}`]) {
      const x = await (await tanpa.app.request(jalur)).json() as { sisi: Record<string, unknown>[] };
      const y = await (await dengan.app.request(jalur)).json() as { sisi: Record<string, unknown>[] };
      expect(y).toEqual(x);
      const ab = y.sisi.find((s) => s.id === 1)!;
      expect(Object.keys(ab).sort()).toEqual(["a", "atMs", "b", "id", "txHash"]);
    }
  });
});

describe("cache 2 detik (spec 6 §4.5)", () => {
  it("dua permintaan identik dalam 2 detik → satu kueri store", async () => {
    const { app, graf, jam } = duniaGraf(DATA);
    await app.request("/graf/jaringan?sejakId=0");
    jam.sekarang += 1_999;
    await app.request("/graf/jaringan?sejakId=0");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(1);

    jam.sekarang += 1;
    await app.request("/graf/jaringan?sejakId=0");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(2);
  });

  it("permintaan bersamaan menunggu kueri yang sama", async () => {
    const { app, graf } = duniaGraf(DATA);
    await Promise.all([app.request(`/graf/acara/${E1}`), app.request(`/graf/acara/${E1}`)]);
    expect(graf.acara).toHaveBeenCalledTimes(1);
  });

  it("sejakId berbeda adalah kunci berbeda", async () => {
    const { app, graf } = duniaGraf(DATA);
    await app.request("/graf/jaringan?sejakId=0");
    await app.request("/graf/jaringan?sejakId=1");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(2);
  });

  it("galat store tidak disimpan", async () => {
    // Hono mencetak galat 500 ke console.error; dibungkam supaya keluaran tes bersih.
    const diam = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = duniaGraf(DATA);
    let gagal = true;
    const asli = d.graf.koneksiSejak;
    d.graf.koneksiSejak = async (s, b) => {
      if (gagal) throw new Error("mati");
      return asli(s, b);
    };
    expect((await d.app.request("/graf/jaringan")).status).toBe(500);
    gagal = false;
    expect((await d.app.request("/graf/jaringan")).status).toBe(200);
    diam.mockRestore();
  });
});

describe("CORS (spec 6 §4.6)", () => {
  it("origin terdaftar mendapat header origin itu", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: ORIGIN } });
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("origin lain tidak mendapat header CORS apa pun", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: "https://jahat.example" } });
    expect(res.status).toBe(200);
    expect(headerCors(res)).toEqual([]);
  });

  it("WEB_ORIGINS kosong → tidak ada header, bahkan untuk origin yang biasanya sah", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [] });
    const res = await app.request(`/graf/acara/${E1}`, { headers: { Origin: ORIGIN } });
    expect(headerCors(res)).toEqual([]);
  });

  it("preflight: origin terdaftar dijawab 204 dengan GET saja; origin lain tanpa header", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const ok = await app.request("/graf/jaringan", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-methods")).toBe("GET");
    const lain = await app.request("/graf/jaringan", { method: "OPTIONS", headers: { Origin: "https://jahat.example" } });
    expect(headerCors(lain)).toEqual([]);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/graf.route.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/routes/graf"`.

- [ ] **Step 4: Buat `apps/api/src/cors-graf.ts`**

```ts
import type { MiddlewareHandler } from "hono";

/**
 * CORS khusus `/graf/*` (spec 6 §4.6). Ditulis sendiri, bukan `hono/cors`:
 * untuk permintaan OPTIONS dari origin yang TIDAK terdaftar, `hono/cors` tetap
 * memasang `Access-Control-Allow-Methods`, sedangkan spec meminta origin lain
 * mendapat NOL header CORS. Aturannya cukup kecil untuk dibaca utuh di sini.
 *
 * - origin terdaftar → `Access-Control-Allow-Origin: <origin itu>` + `Vary: Origin`
 * - origin lain, atau tanpa header Origin → tanpa header CORS apa pun
 * - daftar kosong → CORS mati sepenuhnya
 * - hanya GET; preflight OPTIONS dari origin terdaftar dijawab 204, dari
 *   origin lain diteruskan apa adanya (tidak ada rute OPTIONS → 404)
 */
export function corsGraf(origins: readonly string[]): MiddlewareHandler {
  const izin = new Set(origins);
  return async (c, next) => {
    const origin = c.req.header("origin");
    const boleh = origin !== undefined && izin.has(origin);

    if (c.req.method === "OPTIONS" && boleh) {
      return c.body(null, 204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
    }

    await next();
    if (boleh) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin", { append: true });
    }
  };
}
```

- [ ] **Step 5: Buat `apps/api/src/routes/graf.ts`**

```ts
import { Hono } from "hono";
import type { Hex } from "viem";
import { buatCacheSingkat } from "../cache-singkat";
import { corsGraf } from "../cors-graf";
import {
  alamatDiSisi, BATAS_DAFTAR_ACARA, BATAS_HALAMAN, bacaEventId, bacaSejakId, hitungHadir,
  keAcaraPublik, keSisiPublik, potongHalaman, sisiAcara, susunSimpul,
  type AcaraPublik, type HalamanAcara, type HalamanGraf,
} from "../graf";
import type { GrafDeps, KoneksiGraf } from "../ports";

/** Umur cache per kunci (spec 6 §4.5). */
export const UMUR_CACHE_GRAF_MS = 2000;

type Jawaban =
  | { status: 200; body: HalamanGraf | HalamanAcara | { acara: AcaraPublik[] } }
  | { status: 404; body: { code: "event_not_found" } };

/**
 * Graf publik, baca-saja, tanpa autentikasi (spec 6 §4, R4). Tidak memanggil
 * `onChanged`: tidak ada yang ditulis.
 *
 * `TrustStore.loadGraph` sengaja TIDAK dipakai — ia membawa sel, blokir,
 * slash, dan vouch. Store graf memilih kolomnya sendiri, dan setiap respons
 * disusun lewat penyaring kunci di graf.ts.
 */
export function grafRoutes(deps: GrafDeps) {
  const r = new Hono();
  const cache = buatCacheSingkat<Jawaban>(deps.nowMs, UMUR_CACHE_GRAF_MS);

  r.use("/graf/*", corsGraf(deps.webOrigins));

  async function halaman(sisi: KoneksiGraf[], sejakId: number): Promise<HalamanGraf> {
    const potong = potongHalaman(sisi, sejakId);
    const alamat = alamatDiSisi(potong.sisi);
    const profil = alamat.length === 0 ? new Map() : await deps.meet.profilRingkas(alamat);
    return {
      simpul: susunSimpul(alamat, profil),
      sisi: potong.sisi.map(keSisiPublik),
      kursor: potong.kursor,
      lengkap: potong.lengkap,
    };
  }

  r.get("/graf/jaringan", async (c) => {
    const sejakId = bacaSejakId(c.req.query("sejakId"));
    if (sejakId === null) return c.json({ code: "invalid_cursor" }, 400);

    const j = await cache.ambil(`jaringan?${sejakId}`, async () => {
      // Satu lebih dari batas: satu-satunya cara jujur tahu `lengkap`.
      const sisi = await deps.graf.koneksiSejak(sejakId, BATAS_HALAMAN + 1);
      return { status: 200 as const, body: await halaman(sisi, sejakId) };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  r.get("/graf/acara", async (c) => {
    const j = await cache.ambil("acara", async () => {
      const nowDetik = Math.floor(deps.nowMs() / 1000);
      const daftar = await deps.graf.daftarAcara(nowDetik, BATAS_DAFTAR_ACARA);
      return { status: 200 as const, body: { acara: daftar.map((e) => keAcaraPublik(e, nowDetik)) } };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  r.get("/graf/acara/:eventId", async (c) => {
    const sejakId = bacaSejakId(c.req.query("sejakId"));
    if (sejakId === null) return c.json({ code: "invalid_cursor" }, 400);
    // id yang bentuknya saja salah pasti bukan acara — tanpa kueri.
    const eventId = bacaEventId(c.req.param("eventId"));
    if (eventId === null) return c.json({ code: "event_not_found" }, 404);

    const j = await cache.ambil(`acara/${eventId}?${sejakId}`, async (): Promise<Jawaban> => {
      const ev = await deps.graf.acara(eventId);
      if (!ev) return { status: 404, body: { code: "event_not_found" } };

      const beririsan = await deps.graf.acaraBeririsan(ev.startsAt, ev.endsAt);
      const acara = beririsan.some((e) => e.eventId === ev.eventId) ? beririsan : [ev, ...beririsan];
      const [checkins, koneksi] = await Promise.all([
        deps.graf.checkInAcara(acara.map((e) => e.eventId as Hex)),
        deps.graf.koneksiDalamJendela(ev.startsAt * 1000, ev.endsAt * 1000),
      ]);

      const semua = sisiAcara(ev.eventId, koneksi, acara, checkins);
      const h = await halaman(semua.filter((k) => k.id > sejakId), sejakId);
      const nowDetik = Math.floor(deps.nowMs() / 1000);
      return {
        status: 200,
        body: {
          ...h,
          acara: keAcaraPublik(ev, nowDetik),
          hitungan: { hadir: hitungHadir(ev.eventId, checkins), salaman: semua.length },
        },
      };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  return r;
}
```

- [ ] **Step 6: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/graf.route.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS. Keluaran tes bersih (galat 500 yang disengaja dibungkam).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/cors-graf.ts \
  apps/api/src/routes/graf.ts \
  apps/api/test/support/dunia-graf.ts \
  apps/api/test/graf.route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): rute graf publik dengan cache 2 detik dan CORS khusus /graf/*

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Mutasi sungguhan — penyaring kunci JSON**

**Mutasi A (acara):** di `apps/api/src/graf.ts`, ganti isi `keAcaraPublik` menjadi

```ts
  return { ...e, live: e.startsAt <= nowDetik && nowDetik <= e.endsAt };
```

Run: `pnpm --filter @nearly/api exec vitest run test/graf.route.test.ts`
Expected: FAIL, termasuk `tidak ada kunci terlarang di respons mana pun` dengan pesan `kunci terlarang: centerCell`. Catat judul tes yang merah. Kembalikan: `git checkout -- apps/api/src/graf.ts`.

**Mutasi B (sisi):** ganti isi `keSisiPublik` menjadi

```ts
  return { ...k, a: k.a.toLowerCase() as Address, b: k.b.toLowerCase() as Address };
```

Run: `pnpm --filter @nearly/api exec vitest run test/graf.route.test.ts`
Expected: FAIL, termasuk `kunci terlarang: cell` dan tes sisi yang saling memblokir. Kembalikan: `git checkout -- apps/api/src/graf.ts`.

Run: `pnpm --filter @nearly/api exec vitest run test/graf.route.test.ts && git status --short`
Expected: PASS, dan `git status` kosong.

---

## Task 6: Tes konsistensi aturan acara dengan `rowsToGraph`

**Files:**
- Test: `apps/api/test/graf-konsistensi.test.ts`

**Interfaces:**
- Consumes: `duniaGraf`, `muatSemua`, `alamat`, `idAcara`, `iso`, `NOW_GRAF`, `DataDunia` (Task 5); `rowsToGraph`, `eventOccasionIdOf` dari `apps/api/src/trust/load-graph.ts` (hanya impor).
- Produces: — (penjaga; tidak ada kode produksi baru)

Tes ini TIDAK menulis ulang aturannya. Ia menyusun satu himpunan baris, memberikannya ke `rowsToGraph` yang sungguhan dan ke rute graf lewat dunia uji, lalu membandingkan himpunan `id`. Datanya memuat keempat kasus spec §10: salaman di dalam jendela oleh dua orang yang check-in (masuk), salaman di luar jendela (tidak), salaman dengan satu pihak belum check-in (tidak), dan dua acara tumpang tindih — ditambah batas jendela inklusif dan pasangan yang saling memblokir.

Karena kode produksinya sudah ada sejak Task 2 dan 5, tes ini diharapkan LANGSUNG hijau. Buktinya menggigit ada di Step 3.

- [ ] **Step 1: Tulis tes**

`apps/api/test/graf-konsistensi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventOccasionIdOf, rowsToGraph } from "../src/trust/load-graph";
import { alamat, duniaGraf, idAcara, iso, muatSemua, NOW_GRAF, type DataDunia } from "./support/dunia-graf";

/**
 * Aturan "salaman di acara ini" di layar proyektor WAJIB identik dengan aturan
 * trust (spec 6 §4.3). Tes ini tidak menulis ulang aturannya: ia menjalankan
 * `rowsToGraph` yang SUNGGUHAN pada baris yang sama persis dengan yang dibaca
 * rute graf, lalu membandingkan himpunan id.
 */

const JAM = 3_600;
const T0 = 1_789_000_000; // unix DETIK

const A = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const D = alamat(0xd);
const E = alamat(0xe);
const F = alamat(0xf);
const G = alamat(0x10);

// E1 dan E2 tumpang tindih di [T0+2j, T0+4j]. E3 hari lain.
const E1 = idAcara("11");
const E2 = idAcara("22");
const E3 = idAcara("33");

function koneksi(id: number, a: string, b: string, detik: number) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return {
    id, addr_a: x, addr_b: y, created_at: iso(detik * 1000),
    tx_hash: `0x${String(id).padStart(64, "0")}`, cell: "qqguv1r", nonce: `0x${String(id).padStart(64, "9")}`,
  };
}

function checkin(eventId: string, address: string) {
  return { event_id: eventId, address, cell: "qqguv1r", nonce: `0x${address.slice(2)}${eventId.slice(2, 26)}` };
}

const DATA: Partial<DataDunia> = {
  events: [
    { event_id: E1, host: A, title: "Satu", center_cell: "qqguv1r", starts_at: T0, ends_at: T0 + 4 * JAM },
    { event_id: E2, host: B, title: "Dua", center_cell: "qqguv1x", starts_at: T0 + 2 * JAM, ends_at: T0 + 6 * JAM },
    { event_id: E3, host: C, title: "Tiga", center_cell: "w1xyz00", starts_at: T0 + 48 * JAM, ends_at: T0 + 52 * JAM },
  ],
  checkins: [
    checkin(E1, A), checkin(E1, B), checkin(E1, C), checkin(E1, D),
    checkin(E2, A), checkin(E2, B), checkin(E2, E),
    checkin(E3, D), checkin(E3, G),
  ],
  connections: [
    // Di jendela E1, keduanya check-in di E1 → MASUK E1.
    koneksi(1, C, D, T0 + 1 * JAM),
    // Dua acara tumpang tindih: A dan B check-in di E1 DAN E2, salaman di
    // irisan jendela → trust memilih event_id terkecil (E1). TIDAK masuk E2.
    koneksi(2, A, B, T0 + 3 * JAM),
    // Keduanya check-in di E1 tetapi DI LUAR jendela E1 → tidak masuk E1.
    koneksi(3, B, C, T0 + 5 * JAM),
    // Satu pihak (F) belum check-in di mana pun → tidak masuk.
    koneksi(4, A, F, T0 + 1 * JAM),
    // Di jendela E2, keduanya check-in di E2 → MASUK E2.
    koneksi(5, A, E, T0 + 5 * JAM),
    // Di irisan waktu, tapi E hanya check-in di E2 → MASUK E2.
    koneksi(6, B, E, T0 + 3 * JAM),
    // Tepat di detik ends_at E1 → jendela inklusif, MASUK E1.
    koneksi(7, A, D, T0 + 4 * JAM),
    // Keduanya check-in di E3 tapi salaman dua hari sebelum E3 → tidak masuk.
    koneksi(8, D, G, T0 + 1 * JAM),
  ],
  blocks: [{ blocker: A, blocked: B }, { blocker: B, blocked: A }],
};

function idsMenurutTrust(eventId: string): number[] {
  const d = duniaGraf(DATA);
  const g = rowsToGraph(d.barisTrust(), NOW_GRAF);
  const ev = d.data.events.find((e) => e.event_id === eventId)!;
  const occ = eventOccasionIdOf(ev.center_cell, eventId);
  return d.data.connections
    .filter((_, i) => g.edges[i]!.occasionId === occ)
    .map((c) => c.id)
    .sort((x, y) => x - y);
}

async function idsMenurutGraf(eventId: string): Promise<number[]> {
  const d = duniaGraf(DATA);
  const { ids } = await muatSemua(d.app, `/graf/acara/${eventId}`);
  return [...ids].sort((x, y) => x - y);
}

describe("konsistensi aturan acara dengan rowsToGraph", () => {
  it("acara pertama: di jendela & keduanya check-in masuk; luar jendela, satu pihak belum check-in, dan seri tumpang tindih ke acara ini", async () => {
    expect(idsMenurutTrust(E1)).toEqual([1, 2, 7]);
    expect(await idsMenurutGraf(E1)).toEqual(idsMenurutTrust(E1));
  });

  it("acara kedua yang tumpang tindih: salaman yang trust berikan ke acara pertama tidak ikut tampil", async () => {
    expect(idsMenurutTrust(E2)).toEqual([5, 6]);
    expect(await idsMenurutGraf(E2)).toEqual(idsMenurutTrust(E2));
  });

  it("acara tanpa salaman di jendelanya: kosong di kedua sisi", async () => {
    expect(idsMenurutTrust(E3)).toEqual([]);
    expect(await idsMenurutGraf(E3)).toEqual([]);
  });

  it("hitungan salaman sama dengan jumlah sisi menurut trust, hadir sama dengan check-in", async () => {
    const d = duniaGraf(DATA);
    const res = await d.app.request(`/graf/acara/${E1}`);
    const body = await res.json() as { hitungan: { hadir: number; salaman: number } };
    expect(body.hitungan).toEqual({ hadir: 4, salaman: idsMenurutTrust(E1).length });
  });
});
```

- [ ] **Step 2: Jalankan tes**

Run: `pnpm --filter @nearly/api exec vitest run test/graf-konsistensi.test.ts`
Expected: PASS. Kalau MERAH, aturan di `graf.ts` berselisih dengan trust: perbaiki `sisiAcara` di `graf.ts` — JANGAN mengubah `apps/api/src/trust/load-graph.ts` dan JANGAN menyesuaikan angka harapan di tes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/graf-konsistensi.test.ts
git commit -m "$(cat <<'EOF'
test(api): aturan acara graf identik dengan rowsToGraph

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Mutasi sungguhan — hapus syarat jendela waktu**

Di `apps/api/src/graf.ts`, di dalam `sisiAcara`, hapus baris:

```ts
      if (k.atMs < w.mulaiMs || k.atMs > w.akhirMs) continue;
```

Run: `pnpm --filter @nearly/api exec vitest run test/graf-konsistensi.test.ts`
Expected: FAIL. Harapan yang tercatat saat rencana ini ditulis: `expected [ 1, 2, 3, 7 ] to deeply equal [ 1, 2, 7 ]` (acara pertama), `expected [ 8 ] to deeply equal []` (acara ketiga), dan `hitungan` `salaman: 4` vs `3`. Laporkan keluaran sebenarnya apa adanya.

Kembalikan: `git checkout -- apps/api/src/graf.ts`

Run: `pnpm --filter @nearly/api exec vitest run test/graf-konsistensi.test.ts && git status --short`
Expected: PASS, dan `git status` kosong.

---

## Task 7: Perakitan — `app.ts`, `index.ts`, fake deps

**Files:**
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/deps.ts`, `apps/api/test/handshake.route.test.ts`
- Test: `apps/api/test/app-graf.test.ts`

**Interfaces:**
- Consumes: `GrafStore` (Task 1), `createGrafStore` (Task 3), `bacaPort`, `bacaWebOrigins` (Task 4), `grafRoutes` (Task 5).
- Produces: `TrustDeps` kini memuat `graf: GrafStore` dan `webOrigins: readonly string[]`; `createApp` memasang `/graf/*`; `index.ts` membaca `PORT` dan `WEB_ORIGINS`.

**Semua perubahan adalah penambahan di akhir blok** (spec §11), kecuali dua baris `serve`/`console.log` di akhir `index.ts` yang memang diganti (Ruling R-E). Jangan mengubah urutan atau isi baris lain — jalur 4b + 5 menambah di blok yang sama.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/app-graf.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";

const ORIGIN = "https://nearly.vercel.app";
const A = "0x000000000000000000000000000000000000000a";

function headerCors(res: Response): string[] {
  return [...res.headers.keys()].filter((k) => k.toLowerCase().startsWith("access-control-"));
}

describe("perakitan graf di createApp", () => {
  it("rute graf terpasang dan mendapat CORS untuk origin terdaftar", async () => {
    const app = createApp({ ...depsFor(), webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("rute non-graf tidak pernah mendapat header CORS, walau origin terdaftar", async () => {
    const app = createApp({ ...depsFor(), webOrigins: [ORIGIN] });
    const permintaan: [string, RequestInit][] = [
      ["/health", {}],
      [`/trust/${A}`, {}],
      ["/handshake/offer", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }],
      ["/blokir", { method: "OPTIONS" }],
    ];
    for (const [jalur, init] of permintaan) {
      const headers = { ...(init.headers as Record<string, string> | undefined), Origin: ORIGIN };
      const res = await app.request(jalur, { ...init, headers });
      expect(headerCors(res), jalur).toEqual([]);
    }
  });
});

describe("index.ts (spec 6 §4.6, §4.7)", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

  it("memakai bacaPort, bukan 8787 yang ditulis mati", () => {
    expect(src).toContain("bacaPort(process.env.PORT)");
    expect(src).not.toMatch(/port:\s*8787/);
  });

  it("meneruskan WEB_ORIGINS dan store graf ke createApp", () => {
    expect(src).toContain("bacaWebOrigins(process.env.WEB_ORIGINS)");
    expect(src).toContain("graf: createGrafStore(supabase)");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/app-graf.test.ts`
Expected: FAIL — `/graf/jaringan` menjawab 404, dan `index.ts` tidak memuat `bacaPort(process.env.PORT)`.

- [ ] **Step 3: `apps/api/src/app.ts`**

Tambahkan impor rute di AKHIR blok impor rute (setelah `import { pesanRoutes } from "./routes/pesan";`):

```ts
import { grafRoutes } from "./routes/graf";
```

Tambahkan impor tipe sebagai baris BARU setelah `import type { Address } from "viem";` (baris `import type { ... } from "./ports";` yang ada TIDAK diubah):

```ts
import type { GrafStore } from "./ports";
```

Di `TrustDeps`, tambahkan di akhir, setelah `push: PushPort | null;`:

```ts
  graf: GrafStore;
  webOrigins: readonly string[];
```

Di `createApp`, tambahkan tepat sebelum `return app;` (setelah `app.route("/", pesanRoutes(deps));`):

```ts
  // Graf publik baca-saja untuk layar /live (spec 6 §4). `onChanged` TIDAK
  // dipanggil — tidak ada yang ditulis. CORS dipasang DI DALAM grafRoutes dan
  // hanya untuk /graf/*; rute lain di atas tidak pernah mendapat header CORS.
  app.route("/", grafRoutes(deps));
```

- [ ] **Step 4: `apps/api/src/index.ts`**

Tambahkan di AKHIR blok impor (setelah `import { createExpoPush } from "./push";`):

```ts
import { createGrafStore } from "./graf-store";
import { bacaPort, bacaWebOrigins } from "./server-env";
```

Di objek `createApp({ ... })`, tambahkan di akhir, setelah `push: createExpoPush(),`:

```ts
  graf: createGrafStore(supabase),
  webOrigins: bacaWebOrigins(process.env.WEB_ORIGINS),
```

Ganti dua baris terakhir berkas:

```ts
serve({ fetch: app.fetch, port: 8787 });
console.log("API Nearly berjalan di http://localhost:8787");
```

dengan:

```ts
const port = bacaPort(process.env.PORT);
serve({ fetch: app.fetch, port });
console.log(`API Nearly berjalan di http://localhost:${port}`);
```

- [ ] **Step 5: `apps/api/test/support/deps.ts`**

Di objek yang dikembalikan `depsFor`, tambahkan di akhir, setelah `push: null,`:

```ts
    // Fase 6: rute graf diuji di graf.route.test.ts dengan dunia sendiri, tapi
    // TrustDeps butuh medan ini supaya createApp bisa dibangun oleh test route
    // lain. `webOrigins` kosong = CORS mati, sama dengan env tanpa WEB_ORIGINS.
    graf: {
      koneksiSejak: vi.fn(async () => []),
      acara: vi.fn(async () => null),
      acaraBeririsan: vi.fn(async () => []),
      checkInAcara: vi.fn(async () => []),
      koneksiDalamJendela: vi.fn(async () => []),
      daftarAcara: vi.fn(async () => []),
    },
    webOrigins: [],
```

- [ ] **Step 6: `apps/api/test/handshake.route.test.ts`**

Berkas ini membangun `TrustDeps` sendiri di fungsi `deps()`. Tambahkan di akhir objeknya, setelah `push: null,`:

```ts
    // Fase 6: tidak dipakai test handshake, tapi TrustDeps butuh bentuknya.
    graf: {
      koneksiSejak: async () => [],
      acara: async () => null,
      acaraBeririsan: async () => [],
      checkInAcara: async () => [],
      koneksiDalamJendela: async () => [],
      daftarAcara: async () => [],
    },
    webOrigins: [],
```

Kalau typecheck di Step 7 menunjuk berkas tes LAIN yang membangun `TrustDeps` penuh, tambahkan dua medan yang sama di akhir objeknya dengan cara yang sama, dan sebut berkasnya di commit.

- [ ] **Step 7: Jalankan seluruh tes API dan typecheck**

Run: `pnpm --filter @nearly/api typecheck && pnpm --filter @nearly/api test`
Expected: PASS semua.

- [ ] **Step 8: Verifikasi hanya-penambahan**

Run: `git diff -U0 apps/api/src/app.ts apps/api/src/index.ts apps/api/test/support/deps.ts apps/api/test/handshake.route.test.ts | grep '^-[^-]'`
Expected: TEPAT dua baris, keduanya dari `index.ts`: `-serve({ fetch: app.fetch, port: 8787 });` dan `-console.log("API Nearly berjalan di http://localhost:8787");`. Laporkan keluarannya apa adanya.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/app.ts \
  apps/api/src/index.ts \
  apps/api/test/support/deps.ts \
  apps/api/test/handshake.route.test.ts \
  apps/api/test/app-graf.test.ts
git commit -m "$(cat <<'EOF'
feat(api): rakit rute graf; PORT dan WEB_ORIGINS dari env

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Alat seed trusted core

**Files:**
- Create: `apps/api/tools/seed-inti-logika.ts`, `apps/api/tools/seed-inti.ts`, `docs/demo/seed-inti-contoh.csv`
- Test: `apps/api/test/seed-inti.test.ts`

**Interfaces:**
- Consumes: `createSupabase` (`apps/api/src/db.ts`), `createTrustStore` (`trust/store.ts`), `createAttestor` (`trust/attestor.ts`), `recomputeTrust` (`trust/recompute.ts`) — jalur yang sama persis dengan `tools/recompute.ts`.
- Produces:
  - `uraiCsvSeedInti(teks: string): HasilUrai` — `{ ok: true; baris: BarisSeedInti[] } | { ok: false; kesalahan: KesalahanCsv[] }`
  - `bacaArgumen(argv: string[]): { berkas: string; jalankan: boolean } | null`
  - `jalankanSeedInti(teksCsv: string, jalankan: boolean, deps: DepsSeedInti): Promise<number>` (kode keluar)
  - `PERINGATAN_RELAYER`

Baca `apps/api/tools/seed.ts` dan `apps/api/tools/recompute.ts` dulu. Upsert memakai bentuk baris yang sama dengan `seed.ts`: `{ address, note, weight }`, `onConflict: "address"`.

**Pelaksana TIDAK PERNAH menjalankan alat ini dengan `--jalankan`, dan tidak pernah dengan `--env-file`.**

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/seed-inti.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  bacaArgumen, jalankanSeedInti, PERINGATAN_RELAYER, uraiCsvSeedInti, type DepsSeedInti,
} from "../tools/seed-inti-logika";

const A = "0x00000000000000000000000000000000000000Aa";
const B = "0x00000000000000000000000000000000000000bb";

function deps() {
  const keluaran: string[] = [];
  const d = {
    upsertSeeds: vi.fn(async () => {}),
    hitungUlang: vi.fn(async () => ({ computed: 3, published: 1, failed: 0 })),
    cetak: vi.fn((s: string) => { keluaran.push(s); }),
    galat: vi.fn((s: string) => { keluaran.push(s); }),
  } satisfies DepsSeedInti;
  return { d, keluaran };
}

describe("uraiCsvSeedInti", () => {
  it("header, komentar, dan baris kosong diabaikan; alamat dinormalkan huruf kecil", () => {
    const hasil = uraiCsvSeedInti(`address,catatan,bobot\n# panitia\n\n${A},Ketua panitia,2\n${B}, Juri ,1.5\n`);
    expect(hasil).toEqual({
      ok: true,
      baris: [
        { address: A.toLowerCase(), catatan: "Ketua panitia", bobot: 2 },
        { address: B, catatan: "Juri", bobot: 1.5 },
      ],
    });
  });

  it("alamat tidak sah, bobot bukan angka > 0, dan kolom salah — SEMUA dilaporkan dengan nomor baris", () => {
    const hasil = uraiCsvSeedInti(`0x123,x,1\n${A},x,0\n${B},x,abc\n${A},satu,dua,1\n`);
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.kesalahan.map((k) => k.baris)).toEqual([1, 2, 3, 4]);
  });

  it("bobot kosong dan bobot negatif ditolak", () => {
    expect(uraiCsvSeedInti(`${A},x,\n`).ok).toBe(false);
    expect(uraiCsvSeedInti(`${A},x,-1\n`).ok).toBe(false);
  });

  it("alamat berulang ditolak, termasuk beda huruf besar-kecil", () => {
    const hasil = uraiCsvSeedInti(`${A},x,1\n${A.toLowerCase()},y,1\n`);
    expect(hasil).toEqual({
      ok: false,
      kesalahan: [{ baris: 2, pesan: expect.stringContaining("alamat berulang") }],
    });
  });

  it("berkas tanpa baris seed ditolak", () => {
    expect(uraiCsvSeedInti("address,catatan,bobot\n# kosong\n").ok).toBe(false);
  });
});

describe("bacaArgumen", () => {
  it("berkas saja → uji coba; dengan --jalankan → jalankan", () => {
    expect(bacaArgumen(["seed.csv"])).toEqual({ berkas: "seed.csv", jalankan: false });
    expect(bacaArgumen(["--jalankan", "seed.csv"])).toEqual({ berkas: "seed.csv", jalankan: true });
  });

  it("salah ketik flag, dua berkas, atau tanpa berkas ditolak", () => {
    expect(bacaArgumen(["seed.csv", "--jalankn"])).toBeNull();
    expect(bacaArgumen(["a.csv", "b.csv"])).toBeNull();
    expect(bacaArgumen([])).toBeNull();
    expect(bacaArgumen(["--jalankan"])).toBeNull();
  });
});

describe("jalankanSeedInti", () => {
  it("satu baris salah → nol tulisan dan nol hitung ulang, walau --jalankan", async () => {
    const { d } = deps();
    const kode = await jalankanSeedInti(`${A},benar,1\n0xsalah,rusak,1\n${B},benar,1\n`, true, d);
    expect(kode).toBe(1);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
    expect(d.hitungUlang).not.toHaveBeenCalled();
  });

  it("alamat berulang → nol tulisan", async () => {
    const { d } = deps();
    expect(await jalankanSeedInti(`${A},x,1\n${A},y,1\n`, true, d)).toBe(1);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
  });

  it("tanpa --jalankan → mencetak rencana dan peringatan, nol tulisan", async () => {
    const { d, keluaran } = deps();
    expect(await jalankanSeedInti(`${A},Ketua,2\n`, false, d)).toBe(0);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
    expect(d.hitungUlang).not.toHaveBeenCalled();
    expect(keluaran.join("\n")).toContain(A.toLowerCase());
    expect(keluaran).toContain(PERINGATAN_RELAYER);
  });

  it("--jalankan → upsert sekali dengan semua baris, lalu hitung ulang tepat sekali", async () => {
    const { d, keluaran } = deps();
    expect(await jalankanSeedInti(`${A},Ketua,2\n${B},Juri,1\n`, true, d)).toBe(0);
    expect(d.upsertSeeds).toHaveBeenCalledTimes(1);
    expect(d.upsertSeeds).toHaveBeenCalledWith([
      { address: A.toLowerCase(), catatan: "Ketua", bobot: 2 },
      { address: B, catatan: "Juri", bobot: 1 },
    ]);
    expect(d.hitungUlang).toHaveBeenCalledTimes(1);
    expect(d.upsertSeeds.mock.invocationCallOrder[0]!).toBeLessThan(d.hitungUlang.mock.invocationCallOrder[0]!);
    expect(keluaran).toContain(PERINGATAN_RELAYER);
  });

  it("hitung ulang dengan transaksi gagal → kode keluar bukan nol", async () => {
    const { d } = deps();
    d.hitungUlang.mockResolvedValueOnce({ computed: 3, published: 1, failed: 2 });
    expect(await jalankanSeedInti(`${A},Ketua,2\n`, true, d)).toBe(2);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/seed-inti.test.ts`
Expected: FAIL — `Failed to resolve import "../tools/seed-inti-logika"`.

- [ ] **Step 3: Buat `apps/api/tools/seed-inti-logika.ts`**

```ts
/**
 * Logika alat seed-inti.ts, murni dan teruji (spec 6 §7). Tidak membaca env,
 * berkas, maupun Supabase — semua efek samping masuk lewat `DepsSeedInti`,
 * supaya "tanpa --jalankan tidak menulis apa pun" bisa DIBUKTIKAN tes, bukan
 * sekadar diharapkan.
 */

export type BarisSeedInti = { address: string; catatan: string; bobot: number };
export type KesalahanCsv = { baris: number; pesan: string };

export type HasilUrai =
  | { ok: true; baris: BarisSeedInti[] }
  | { ok: false; kesalahan: KesalahanCsv[] };

const HEADER = "address,catatan,bobot";
const BATAS_CATATAN = 200;

/**
 * CSV `address,catatan,bobot`. Baris kosong dan baris diawali `#` diabaikan;
 * baris header persis `address,catatan,bobot` di awal boleh ada.
 *
 * SEMUA baris diperiksa dan SEMUA kesalahan dikumpulkan sebelum memutuskan —
 * satu baris salah menggagalkan seluruh berkas. Catatan tidak boleh memuat
 * koma: tanpa aturan kutip CSV, koma di catatan akan menggeser bobot diam-diam.
 */
export function uraiCsvSeedInti(teks: string): HasilUrai {
  const baris: BarisSeedInti[] = [];
  const kesalahan: KesalahanCsv[] = [];
  const dilihat = new Map<string, number>();
  let headerBoleh = true;

  teks.split(/\r?\n/).forEach((mentah, i) => {
    const nomor = i + 1;
    const isi = mentah.trim();
    if (isi === "" || isi.startsWith("#")) return;
    if (headerBoleh && isi.toLowerCase().replace(/\s+/g, "") === HEADER) {
      headerBoleh = false;
      return;
    }
    headerBoleh = false;

    const kolom = isi.split(",").map((k) => k.trim());
    if (kolom.length !== 3) {
      kesalahan.push({ baris: nomor, pesan: `harus tepat 3 kolom (address,catatan,bobot), ada ${kolom.length}` });
      return;
    }
    const [address, catatan, bobotMentah] = kolom as [string, string, string];

    let sah = true;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      kesalahan.push({ baris: nomor, pesan: `alamat tidak sah: "${address}"` });
      sah = false;
    }
    const bobot = Number(bobotMentah);
    if (bobotMentah === "" || !Number.isFinite(bobot) || bobot <= 0) {
      kesalahan.push({ baris: nomor, pesan: `bobot harus angka lebih besar dari 0: "${bobotMentah}"` });
      sah = false;
    }
    if (catatan.length > BATAS_CATATAN) {
      kesalahan.push({ baris: nomor, pesan: `catatan lebih dari ${BATAS_CATATAN} karakter` });
      sah = false;
    }
    if (sah) {
      const kunci = address.toLowerCase();
      const sebelumnya = dilihat.get(kunci);
      if (sebelumnya !== undefined) {
        kesalahan.push({ baris: nomor, pesan: `alamat berulang (sudah ada di baris ${sebelumnya}): ${kunci}` });
        return;
      }
      dilihat.set(kunci, nomor);
      baris.push({ address: kunci, catatan, bobot });
    }
  });

  if (kesalahan.length > 0) return { ok: false, kesalahan };
  if (baris.length === 0) return { ok: false, kesalahan: [{ baris: 0, pesan: "tidak ada satu pun baris seed" }] };
  return { ok: true, baris };
}

export type ArgumenSeedInti = { berkas: string; jalankan: boolean };

/**
 * `<berkas.csv> [--jalankan]`. Argumen lain apa pun — termasuk `--jalankn`
 * yang salah ketik — DITOLAK, bukan diabaikan: salah ketik yang diabaikan
 * berarti operator mengira sudah menulis padahal belum, atau sebaliknya.
 */
export function bacaArgumen(argv: string[]): ArgumenSeedInti | null {
  const jalankan = argv.includes("--jalankan");
  const sisa = argv.filter((a) => a !== "--jalankan");
  if (sisa.length !== 1 || sisa[0]!.startsWith("-")) return null;
  if (argv.filter((a) => a === "--jalankan").length > 1) return null;
  return { berkas: sisa[0]!, jalankan };
}

export type DepsSeedInti = {
  upsertSeeds(baris: BarisSeedInti[]): Promise<void>;
  hitungUlang(): Promise<{ computed: number; published: number; failed: number }>;
  cetak(s: string): void;
  galat(s: string): void;
};

export const PERINGATAN_RELAYER =
  "PERINGATAN: hitung ulang dapat mengirim transaksi setScore lewat relayer untuk SETIAP alamat "
  + "yang tier-nya berubah. Pastikan saldo tBNB relayer cukup sebelum --jalankan.";

/** Mengembalikan kode keluar proses. */
export async function jalankanSeedInti(
  teksCsv: string, jalankan: boolean, deps: DepsSeedInti,
): Promise<number> {
  const hasil = uraiCsvSeedInti(teksCsv);
  if (!hasil.ok) {
    deps.galat("CSV ditolak — TIDAK ADA yang ditulis:");
    for (const k of hasil.kesalahan) deps.galat(`  baris ${k.baris}: ${k.pesan}`);
    return 1;
  }

  deps.cetak(`${hasil.baris.length} seed akan di-upsert ke trust_seeds:`);
  for (const b of hasil.baris) deps.cetak(`  ${b.address}  bobot ${b.bobot}  ${b.catatan}`);
  deps.cetak(PERINGATAN_RELAYER);

  if (!jalankan) {
    deps.cetak("Uji coba: tidak ada yang ditulis. Tambahkan --jalankan untuk menulis.");
    return 0;
  }

  await deps.upsertSeeds(hasil.baris);
  deps.cetak("seed ditulis. Menghitung ulang trust (satu kali)…");
  const out = await deps.hitungUlang();
  deps.cetak(`dihitung ${out.computed} alamat · dipublikasi ${out.published} · gagal ${out.failed}`);
  return out.failed > 0 ? 2 : 0;
}
```

- [ ] **Step 4: Buat `apps/api/tools/seed-inti.ts`**

```ts
/**
 * Mengisi trust_seeds dari CSV panitia & juri, lalu SATU KALI hitung ulang
 * trust (spec 6 §7). Tanpa --jalankan hanya uji coba: tidak ada yang ditulis.
 *
 * Pakai (dari apps/api):
 *   node --env-file=<berkas env> --import=tsx tools/seed-inti.ts <berkas.csv> [--jalankan]
 *
 * CSV: address,catatan,bobot — baris kosong dan baris diawali # diabaikan.
 */
import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { createSupabase } from "../src/db";
import { createAttestor } from "../src/trust/attestor";
import { createTrustStore } from "../src/trust/store";
import { recomputeTrust } from "../src/trust/recompute";
import { bacaArgumen, jalankanSeedInti } from "./seed-inti-logika";

function wajib(nama: string): string {
  const v = process.env[nama];
  if (!v) throw new Error(`env ${nama} wajib diisi untuk --jalankan`);
  return v;
}

const arg = bacaArgumen(process.argv.slice(2));
if (!arg) {
  console.error("Pakai: tools/seed-inti.ts <berkas.csv> [--jalankan]");
  process.exit(1);
}

const teks = readFileSync(arg.berkas, "utf8");

// Klien Supabase dan relayer dibuat MALAS, di dalam fungsi: uji coba tidak
// butuh env apa pun dan tidak boleh bisa menulis walau env-nya lengkap.
const kode = await jalankanSeedInti(teks, arg.jalankan, {
  async upsertSeeds(baris) {
    const db = createSupabase(wajib("SUPABASE_URL"), wajib("SUPABASE_SERVICE_ROLE_KEY"));
    const { error } = await db.from("trust_seeds").upsert(
      baris.map((b) => ({ address: b.address, note: b.catatan, weight: b.bobot })),
      { onConflict: "address" },
    );
    if (error) throw new Error(`upsert trust_seeds gagal: ${error.message}`);
  },
  async hitungUlang() {
    const db = createSupabase(wajib("SUPABASE_URL"), wajib("SUPABASE_SERVICE_ROLE_KEY"));
    // Jalur yang sama persis dengan tools/recompute.ts.
    return recomputeTrust({
      trust: createTrustStore(db),
      attestor: createAttestor({
        rpcUrl: wajib("RPC_URL"),
        privateKey: wajib("RELAYER_PRIVATE_KEY") as Hex,
        attestor: wajib("TRUST_ATTESTOR_ADDRESS") as Address,
      }),
      nowMs: () => Date.now(),
    });
  },
  cetak: (s) => console.log(s),
  galat: (s) => console.error(s),
});
process.exit(kode);
```

- [ ] **Step 5: Buat `docs/demo/seed-inti-contoh.csv`**

```csv
# CONTOH untuk uji coba seed-inti.ts (spec 6 §7, §10 uji lapangan butir 5).
# Alamat di bawah BUKAN orang sungguhan. JANGAN PERNAH dijalankan dengan --jalankan.
# Kolom: address,catatan,bobot — catatan tanpa koma, bobot angka > 0.
address,catatan,bobot
0x0000000000000000000000000000000000000001,Contoh ketua panitia,2
0x0000000000000000000000000000000000000002,Contoh juri,1
```

- [ ] **Step 6: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/api exec vitest run test/seed-inti.test.ts && pnpm --filter @nearly/api typecheck`
Expected: PASS. (`apps/api/tsconfig.json` sudah mencakup `tools`.)

- [ ] **Step 7: Uji coba alat terhadap CSV contoh — TANPA env, TANPA `--jalankan`**

Run (dari root repo): `env -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u RELAYER_PRIVATE_KEY pnpm --filter @nearly/api exec tsx tools/seed-inti.ts ../../docs/demo/seed-inti-contoh.csv; echo "kode keluar $?"`
Expected: mencetak `2 seed akan di-upsert ke trust_seeds:`, kedua alamat contoh, baris `PERINGATAN: hitung ulang dapat mengirim transaksi setScore…`, lalu `Uji coba: tidak ada yang ditulis.` dan `kode keluar 0`. Tanpa `--jalankan`, klien Supabase tidak pernah dibuat.

Run: `pnpm --filter @nearly/api exec tsx tools/seed-inti.ts ../../docs/demo/seed-inti-contoh.csv --jalankn; echo "kode keluar $?"`
Expected: `Pakai: tools/seed-inti.ts <berkas.csv> [--jalankan]` dan `kode keluar 1` — salah ketik ditolak.

- [ ] **Step 8: Commit**

```bash
git add apps/api/tools/seed-inti-logika.ts \
  apps/api/tools/seed-inti.ts \
  apps/api/test/seed-inti.test.ts \
  docs/demo/seed-inti-contoh.csv
git commit -m "$(cat <<'EOF'
feat(api): alat seed-inti — validasi seluruh CSV sebelum menulis, uji coba bawaan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Mutasi sungguhan — validasi-sebelum-tulis**

Di `apps/api/tools/seed-inti-logika.ts`, ubah baris

```ts
  if (kesalahan.length > 0) return { ok: false, kesalahan };
```

menjadi

```ts
  if (kesalahan.length > 0 && baris.length === 0) return { ok: false, kesalahan };
```

(meniru regresi "tulis saja baris yang sah").

Run: `pnpm --filter @nearly/api exec vitest run test/seed-inti.test.ts`
Expected: FAIL, termasuk `satu baris salah → nol tulisan dan nol hitung ulang, walau --jalankan` dan `alamat berulang → nol tulisan`. Catat judul yang merah.

Kembalikan: `git checkout -- apps/api/tools/seed-inti-logika.ts`

Run: `pnpm --filter @nearly/api exec vitest run test/seed-inti.test.ts && git status --short`
Expected: PASS, dan `git status` kosong.

---

## Task 9: Workspace `apps/web` dan modul murni dasar

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/vercel.json`, `apps/web/index.html`, `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/label.ts`, `apps/web/src/jeda.ts`, `apps/web/src/rute.ts`, `apps/web/src/kontrak.ts`
- Modify: `pnpm-lock.yaml` (lewat `pnpm install`, tidak pernah diedit tangan)
- Test: `apps/web/test/label.test.ts`, `apps/web/test/jeda.test.ts`, `apps/web/test/rute.test.ts`, `apps/web/test/kontrak.test.ts`

**Interfaces:**
- Consumes: — (web TIDAK mengimpor `@nearly/shared` maupun `@nearly/trust`, spec §5)
- Produces (dipakai Task 10–11):
  - `alamatSingkat(address)`, `labelSimpul(displayName, address)`, `radiusSimpul(tierLabel)`, `perluLabel(jumlahSimpul, simpulBaru, skala)`; `PANJANG_NAMA_MAKS = 20`, `BATAS_SIMPUL_BERLABEL = 300`, `SKALA_LABEL_PENUH = 2.5`
  - `JEDA_POLLING_MS = 3000`, `JEDA_MAKS_MS = 12000`, `jedaBerikutnya(gagalBeruntun: number): number`
  - `type Halaman = "landing" | "live"`, `pilihHalaman(pathname)`, `bacaParamAcara(search): string | null`
  - `CHAIN_ID = 97`, `BSCSCAN_TESTNET`, `type Kontrak`, `KONTRAK`, `tautanBscScan(alamat)`

- [ ] **Step 1: Buat berkas workspace**

`apps/web/package.json` — versi exact, lihat tabel "Paket baru":

```json
{
  "name": "@nearly/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-force-graph-2d": "1.29.1"
  },
  "devDependencies": {
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "4.7.0",
    "vite": "5.4.21"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pengembangan lokal: API di http://localhost:8787 (pnpm --filter @nearly/api dev).
// Proxy membuat /graf/* satu origin dengan dev server, jadi CORS tidak
// dibutuhkan di lokal — WEB_ORIGINS boleh kosong (spec 6 §4.6).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/graf": "http://localhost:8787" },
  },
});
```

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Terpisah dari vite.config.ts: tes web hanya menguji fungsi murni di Node,
// tanpa plugin React dan tanpa DOM.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
```

`apps/web/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Nearly — a social graph where connections can only be made in person." />
    <title>Nearly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis API, mis. https://api.<domain>. Kosong = origin yang sama (proxy dev). */
  readonly VITE_API_URL?: string;
}
```

- [ ] **Step 2: Pasang dependensi**

Run: `pnpm install`
Expected: selesai tanpa galat; `pnpm-lock.yaml` berubah dan memuat importer `apps/web`.

Run: `git diff --stat -- pnpm-lock.yaml apps/mobile packages`
Expected: hanya `pnpm-lock.yaml`. Lalu periksa bagian lockfile yang berubah untuk importer `apps/mobile`: `git diff pnpm-lock.yaml | grep -n "react-dom" | head`. Mobile tidak memakai `react-dom` secara langsung (hanya peer opsional yang dipasang otomatis), jadi resolusi ulangnya bukan kerusakan — tapi LAPORKAN apa adanya bila bagian `apps/mobile` di lockfile ikut berubah, supaya controller bisa menilai.

- [ ] **Step 3: Tulis tes yang gagal**

`apps/web/test/label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alamatSingkat, labelSimpul, perluLabel, radiusSimpul } from "../src/label";

const ALAMAT = "0x12ab34cd56ef7890123456789012345678901234";

describe("label simpul", () => {
  it("alamat singkat = 6 karakter pertama + elipsis", () => {
    expect(alamatSingkat(ALAMAT)).toBe("0x12ab…");
  });

  it("nama ada → nama · alamat singkat", () => {
    expect(labelSimpul("Budi", ALAMAT)).toBe("Budi · 0x12ab…");
  });

  it("nama kosong atau spasi saja → alamat singkat saja, tidak pernah 'Tanpa nama'", () => {
    expect(labelSimpul("", ALAMAT)).toBe("0x12ab…");
    expect(labelSimpul("   ", ALAMAT)).toBe("0x12ab…");
    expect(labelSimpul("", ALAMAT)).not.toMatch(/tanpa nama/i);
  });

  it("nama panjang dipotong 20 karakter", () => {
    expect(labelSimpul("Bartholomew Kusumawardhana", ALAMAT)).toBe("Bartholomew Kusumawa… · 0x12ab…");
    expect(labelSimpul("12345678901234567890", ALAMAT)).toBe("12345678901234567890 · 0x12ab…");
  });

  it("emoji di batas potongan tidak terbelah", () => {
    const nama = `${"a".repeat(19)}😀😀`;
    expect(labelSimpul(nama, ALAMAT)).toBe(`${"a".repeat(19)}😀… · 0x12ab…`);
  });
});

describe("ukuran dan label", () => {
  it("jari-jari naik dengan tier; tier tak dikenal = terkecil", () => {
    const r = ["Baru", "Dikenal", "Terpercaya", "Inti"].map(radiusSimpul);
    expect([...r].sort((x, y) => x - y)).toEqual(r);
    expect(new Set(r).size).toBe(4);
    expect(radiusSimpul("???")).toBe(radiusSimpul("Baru"));
  });

  it("label semua simpul sampai 300; di atasnya hanya simpul baru atau saat diperbesar", () => {
    expect(perluLabel(300, false, 1)).toBe(true);
    expect(perluLabel(301, false, 1)).toBe(false);
    expect(perluLabel(301, true, 1)).toBe(true);
    expect(perluLabel(301, false, 2.5)).toBe(true);
  });
});
```

`apps/web/test/jeda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { jedaBerikutnya } from "../src/jeda";

describe("jeda coba ulang", () => {
  it("sehat 3 detik; gagal beruntun 3 → 6 → 12 → tetap 12; berhasil kembali 3", () => {
    const urutan = [0, 1, 2, 3, 4, 9, 0].map(jedaBerikutnya);
    expect(urutan).toEqual([3_000, 3_000, 6_000, 12_000, 12_000, 12_000, 3_000]);
  });
});
```

`apps/web/test/rute.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bacaParamAcara, pilihHalaman } from "../src/rute";

describe("rute", () => {
  it("/live dan /live/ → live; selain itu landing", () => {
    expect(pilihHalaman("/live")).toBe("live");
    expect(pilihHalaman("/live/")).toBe("live");
    expect(pilihHalaman("/")).toBe("landing");
    expect(pilihHalaman("/lively")).toBe("landing");
    expect(pilihHalaman("/apa-saja")).toBe("landing");
  });

  it("?acara hanya diterima sebagai 0x + 64 hex, huruf kecil", () => {
    const id = `0x${"AB".repeat(32)}`;
    expect(bacaParamAcara(`?acara=${id}`)).toBe(id.toLowerCase());
    expect(bacaParamAcara("?acara=0x12")).toBeNull();
    expect(bacaParamAcara("")).toBeNull();
  });
});
```

`apps/web/test/kontrak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHAIN_ID, KONTRAK, tautanBscScan } from "../src/kontrak";

describe("kontrak testnet", () => {
  it("kelima kontrak Nearly, nama unik, alamat 20 byte", () => {
    expect(KONTRAK.map((k) => k.nama).sort()).toEqual([
      "AttendanceRegistry", "ConnectionRegistry", "NearlyResolver", "TrustAttestor", "VouchRegistry",
    ]);
    for (const k of KONTRAK) expect(k.alamat).toMatch(/^0x[0-9a-f]{40}$/);
    expect(new Set(KONTRAK.map((k) => k.alamat)).size).toBe(5);
  });

  it("BSC testnet chainId 97 dengan tautan BscScan testnet", () => {
    expect(CHAIN_ID).toBe(97);
    expect(tautanBscScan("0xabc")).toBe("https://testnet.bscscan.com/address/0xabc");
  });
});
```

- [ ] **Step 4: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/web exec vitest run`
Expected: FAIL — keempat modul `../src/*` tidak ditemukan.

- [ ] **Step 5: Buat `apps/web/src/label.ts`**

```ts
/**
 * Label dan ukuran simpul di layar proyektor (spec 6 §6.3). Murni.
 */

export const PANJANG_NAMA_MAKS = 20;
export const BATAS_SIMPUL_BERLABEL = 300;
/** Skala zoom kanvas di atas ini dianggap "diperbesar": semua label digambar. */
export const SKALA_LABEL_PENUH = 2.5;

/** `0x12ab…` — enam karakter pertama alamat + elipsis. */
export function alamatSingkat(address: string): string {
  return `${address.slice(0, 6)}…`;
}

/**
 * `Budi · 0x12ab…`, atau `0x12ab…` saja bila nama kosong. TIDAK PERNAH
 * "Tanpa nama": di depan ruangan, label itu terbaca sebagai ejekan.
 * Nama dipotong per karakter Unicode (bukan per unit UTF-16), supaya emoji di
 * batas potongan tidak terbelah jadi kotak rusak.
 */
export function labelSimpul(displayName: string, address: string): string {
  const nama = Array.from(displayName.trim());
  if (nama.length === 0) return alamatSingkat(address);
  const tampil = nama.length > PANJANG_NAMA_MAKS ? `${nama.slice(0, PANJANG_NAMA_MAKS).join("")}…` : nama.join("");
  return `${tampil} · ${alamatSingkat(address)}`;
}

/**
 * Jari-jari simpul naik dengan tier. WARNA sengaja sama untuk semua tier:
 * warna tier terbaca sebagai peringkat di depan ruangan (spec 6 §6.3).
 */
const RADIUS: Record<string, number> = { Baru: 4, Dikenal: 5, Terpercaya: 6.5, Inti: 8 };
const RADIUS_BAWAAN = 4;

export function radiusSimpul(tierLabel: string): number {
  return RADIUS[tierLabel] ?? RADIUS_BAWAAN;
}

/** Semua label bila ≤ 300 simpul; di atas itu hanya simpul baru dan saat diperbesar. */
export function perluLabel(jumlahSimpul: number, simpulBaru: boolean, skala: number): boolean {
  return jumlahSimpul <= BATAS_SIMPUL_BERLABEL || simpulBaru || skala >= SKALA_LABEL_PENUH;
}
```

- [ ] **Step 6: Buat `apps/web/src/jeda.ts`**

```ts
/**
 * Jeda polling dan coba ulang (spec 6 §6.2): 3 detik saat sehat; setelah
 * kegagalan beruntun 3 → 6 → 12 detik, maksimal 12; kembali 3 begitu berhasil.
 */

export const JEDA_POLLING_MS = 3_000;
export const JEDA_MAKS_MS = 12_000;

/** `gagalBeruntun` 0 berarti permintaan terakhir berhasil. */
export function jedaBerikutnya(gagalBeruntun: number): number {
  if (gagalBeruntun <= 0) return JEDA_POLLING_MS;
  return Math.min(JEDA_POLLING_MS * 2 ** (gagalBeruntun - 1), JEDA_MAKS_MS);
}
```

- [ ] **Step 7: Buat `apps/web/src/rute.ts`**

```ts
/** Tanpa pustaka router: dua halaman tidak butuh satu (spec 6 §5). */

export type Halaman = "landing" | "live";

export function pilihHalaman(pathname: string): Halaman {
  return /^\/live\/?$/.test(pathname) ? "live" : "landing";
}

/** `?acara=<eventId>` — hanya 0x + 64 hex, dinormalkan huruf kecil. Selain itu null. */
export function bacaParamAcara(search: string): string | null {
  const nilai = new URLSearchParams(search).get("acara");
  return nilai && /^0x[0-9a-fA-F]{64}$/.test(nilai) ? nilai.toLowerCase() : null;
}
```

- [ ] **Step 8: Buat `apps/web/src/kontrak.ts`**

Alamat di bawah disalin verbatim dari berkas broadcast (Ruling R-K). Folder broadcast tidak ada di worktree ini; JANGAN mengarang atau "memperbaiki" alamat.

```ts
/**
 * Kontrak Nearly di BNB Smart Chain testnet (chainId 97), untuk bagian
 * "On-chain" landing page (spec 6 §6.4).
 *
 * Disalin VERBATIM dari packages/contracts/broadcast/Deploy.s.sol/97/ —
 * run-1788453189701.json (ConnectionRegistry), run-1788544216266.json
 * (VouchRegistry, TrustAttestor, NearlyResolver), dan run-1788754863309.json
 * = run-latest.json (AttendanceRegistry). run-latest.json saja hanya memuat
 * deploy terakhir (AttendanceRegistry), jadi ketiga run dibaca.
 * Folder broadcast di-gitignore; salinan inilah sumber web.
 */

export const CHAIN_ID = 97;
export const BSCSCAN_TESTNET = "https://testnet.bscscan.com";

export type Kontrak = { nama: string; alamat: `0x${string}`; peran: string };

export const KONTRAK: readonly Kontrak[] = [
  {
    nama: "ConnectionRegistry",
    alamat: "0x7814656e4bcc5acae46099bd0238856e2a118811",
    peran: "Every verified in-person connection.",
  },
  {
    nama: "AttendanceRegistry",
    alamat: "0x8d1e85ff67553e5569d337690fc8102d7bd02299",
    peran: "Proof of attendance from check-ins made inside the venue during the event.",
  },
  {
    nama: "VouchRegistry",
    alamat: "0xb8472f186725b9895231d1092e887306dbd6e751",
    peran: "Vouches and tags between people who have met — revocable, and slashable.",
  },
  {
    nama: "TrustAttestor",
    alamat: "0x82621fa6e18acc3e403af6f50da18be20005b4e7",
    peran: "Published trust scores and tiers.",
  },
  {
    nama: "NearlyResolver",
    alamat: "0xd95e4b03cf92b541fea31af804c35474b6e49352",
    peran: "Read interface for other dApps: trust and tier by address.",
  },
];

export function tautanBscScan(alamat: string): string {
  return `${BSCSCAN_TESTNET}/address/${alamat}`;
}
```

- [ ] **Step 9: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/web exec vitest run && pnpm --filter @nearly/web typecheck`
Expected: PASS, typecheck bersih.

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json \
  apps/web/tsconfig.json \
  apps/web/vite.config.ts \
  apps/web/vitest.config.ts \
  apps/web/vercel.json \
  apps/web/index.html \
  apps/web/src/vite-env.d.ts \
  apps/web/src/label.ts \
  apps/web/src/jeda.ts \
  apps/web/src/rute.ts \
  apps/web/src/kontrak.ts \
  apps/web/test/label.test.ts \
  apps/web/test/jeda.test.ts \
  apps/web/test/rute.test.ts \
  apps/web/test/kontrak.test.ts \
  pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): workspace Vite + React; label, jeda, rute, alamat kontrak

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Klien API, penggabung graf, dan siklus polling

**Files:**
- Create: `apps/web/src/api.ts`, `apps/web/src/gabung-graf.ts`, `apps/web/src/siklus-graf.ts`
- Test: `apps/web/test/api.test.ts`, `apps/web/test/gabung-graf.test.ts`, `apps/web/test/siklus-graf.test.ts`

**Interfaces:**
- Consumes: `jedaBerikutnya` (Task 9). Bentuk JSON dari Task 5: `{ simpul: [{ address, displayName, tierLabel }], sisi: [{ id, a, b, atMs, txHash }], kursor, lengkap }` ditambah `acara` dan `hitungan: { hadir, salaman }` untuk mode acara.
- Produces (dipakai Task 11):
  - `api.ts`: tipe `SimpulApi`, `SisiApi`, `HalamanGraf`, `AcaraApi`, `HitunganAcara`, `HalamanAcara`, `KlienGraf`; `BATAS_WAKTU_MS = 10000`; `class GalatApi { status: number | null; kode: string }`; `basisApi(nilai)`, `urlGraf(basis, jalur, sejakId?)`, `pastikanHalaman(x)`, `buatKlienGraf(basis, ambil?, batasMs?): KlienGraf`
  - `gabung-graf.ts`: `DURASI_SOROT_MS = 4000`; tipe `SimpulLayar`, `SisiLayar`, `KeadaanGraf`; `KEADAAN_KOSONG`; `gabungHalaman(lama, halaman, { nowMs, sorot }): KeadaanGraf`
  - `siklus-graf.ts`: tipe `Cakupan`, `StatusSiklus` (`"memuat" | "live" | "menyambung-ulang" | "tidak-ditemukan"`), `Tampilan`, `OpsiSiklus`; `mulaiSiklus(o): { hentikan(): void; selesai: Promise<void> }`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/web/test/api.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { basisApi, buatKlienGraf, GalatApi, urlGraf } from "../src/api";

const HALAMAN = { simpul: [], sisi: [], kursor: 0, lengkap: true };

function jawab(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("klien graf", () => {
  it("basis dari VITE_API_URL tanpa garis miring penutup; kosong = origin yang sama", () => {
    expect(basisApi("https://api.nearly.xyz/")).toBe("https://api.nearly.xyz");
    expect(basisApi(undefined)).toBe("");
    expect(urlGraf("", "/graf/jaringan", 5)).toBe("/graf/jaringan?sejakId=5");
  });

  it("jaringan dan acara memakai sejakId; hanya header Accept", async () => {
    const ambil = jawab(200, { ...HALAMAN, acara: { eventId: "0x1", title: "x", startsAt: 1, endsAt: 2, live: true }, hitungan: { hadir: 1, salaman: 0 } });
    const k = buatKlienGraf("https://api.x", ambil);
    await k.jaringan(7);
    await k.acara("0xabc", 9);
    expect(ambil.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([
      "https://api.x/graf/jaringan?sejakId=7", "https://api.x/graf/acara/0xabc?sejakId=9",
    ]);
    const init = (ambil.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("404 event_not_found menjadi GalatApi dengan status dan kode", async () => {
    const k = buatKlienGraf("", jawab(404, { code: "event_not_found" }));
    await expect(k.acara("0xabc", 0)).rejects.toMatchObject({ status: 404, kode: "event_not_found" });
  });

  it("bentuk respons salah ditolak", async () => {
    const k = buatKlienGraf("", jawab(200, { simpul: "bukan array" }));
    await expect(k.jaringan(0)).rejects.toBeInstanceOf(GalatApi);
  });

  it("batas waktu membatalkan permintaan", async () => {
    const ambil = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, tolak) => {
      init.signal!.addEventListener("abort", () => tolak(new Error("aborted")));
    }));
    const k = buatKlienGraf("", ambil, 20);
    await expect(k.jaringan(0)).rejects.toMatchObject({ status: null, kode: "batas_waktu" });
  });

  it("galat jaringan menjadi kode jaringan", async () => {
    const k = buatKlienGraf("", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(k.jaringan(0)).rejects.toMatchObject({ status: null, kode: "jaringan" });
  });
});
```

`apps/web/test/gabung-graf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HalamanGraf } from "../src/api";
import { DURASI_SOROT_MS, gabungHalaman, KEADAAN_KOSONG, type KeadaanGraf } from "../src/gabung-graf";

const A = "0x00000000000000000000000000000000000000AA";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

function halaman(over: Partial<HalamanGraf> = {}): HalamanGraf {
  return {
    simpul: [
      { address: A, displayName: "Budi", tierLabel: "Baru" },
      { address: B, displayName: "", tierLabel: "Dikenal" },
    ],
    sisi: [{ id: 1, a: A, b: B, atMs: 10, txHash: "0x01" }],
    kursor: 1,
    lengkap: true,
    ...over,
  };
}

/** Salinan dalam yang bisa dibandingkan — Map dibekukan jadi array. */
function potret(k: KeadaanGraf) {
  return JSON.parse(JSON.stringify({ simpul: [...k.simpul], sisi: [...k.sisi], kursor: k.kursor }));
}

describe("gabungHalaman", () => {
  it("simpul dikunci alamat huruf kecil, sisi dikunci id", () => {
    const k = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    expect([...k.simpul.keys()]).toEqual([A.toLowerCase(), B.toLowerCase()]);
    expect(k.sisi.get(1)).toMatchObject({ a: A.toLowerCase(), b: B.toLowerCase() });
  });

  it("sisi dan simpul yang sama tidak diduplikasi", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({
      simpul: [{ address: A.toLowerCase(), displayName: "Budi", tierLabel: "Baru" }],
    }), { nowMs: 0, sorot: true });
    expect(k2.sisi.size).toBe(1);
    expect(k2.simpul.size).toBe(2);
  });

  it("respons tanpa perubahan mengembalikan keadaan yang sama persis", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    expect(gabungHalaman(k1, halaman(), { nowMs: 5, sorot: true })).toBe(k1);
  });

  it("data simpul yang lebih baru menimpa nama dan tier, tanpa menyalakan ulang simpul lama", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({
      simpul: [{ address: A, displayName: "Budi Santoso", tierLabel: "Inti" }], sisi: [],
    }), { nowMs: 100, sorot: true });
    expect(k2.simpul.get(A.toLowerCase())).toEqual({
      address: A.toLowerCase(), displayName: "Budi Santoso", tierLabel: "Inti", baruSampaiMs: null,
    });
  });

  it("kursor tidak pernah mundur", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman({ kursor: 50 }), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({ simpul: [], sisi: [], kursor: 7 }), { nowMs: 0, sorot: false });
    expect(k2.kursor).toBe(50);
  });

  it("keadaan lama tidak termutasi", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const sebelum = potret(k1);
    gabungHalaman(k1, halaman({
      simpul: [{ address: A, displayName: "Lain", tierLabel: "Inti" }, { address: C, displayName: "", tierLabel: "Baru" }],
      sisi: [{ id: 2, a: B, b: C, atMs: 20, txHash: "0x02" }],
      kursor: 2,
    }), { nowMs: 1, sorot: true });
    expect(potret(k1)).toEqual(sebelum);
    expect(potret(KEADAAN_KOSONG)).toEqual({ simpul: [], sisi: [], kursor: 0 });
  });

  it("sorot: sisi dan simpul baru menyala 4 detik; muatan awal tidak", () => {
    const awal = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 1_000, sorot: false });
    expect(awal.sisi.get(1)!.baruSampaiMs).toBeNull();

    const k = gabungHalaman(awal, halaman({
      simpul: [{ address: C, displayName: "", tierLabel: "Baru" }],
      sisi: [{ id: 2, a: B, b: C, atMs: 20, txHash: "0x02" }],
      kursor: 2,
    }), { nowMs: 5_000, sorot: true });
    expect(k.sisi.get(2)!.baruSampaiMs).toBe(5_000 + DURASI_SOROT_MS);
    expect(k.simpul.get(C.toLowerCase())!.baruSampaiMs).toBe(5_000 + DURASI_SOROT_MS);
    expect(k.sisi.get(1)!.baruSampaiMs).toBeNull();
  });

  it("sisi yang ujungnya tidak disertakan simpul tetap punya simpul pengganti", () => {
    const k = gabungHalaman(KEADAAN_KOSONG, halaman({ simpul: [] }), { nowMs: 0, sorot: false });
    expect(k.simpul.get(A.toLowerCase())).toEqual({
      address: A.toLowerCase(), displayName: "", tierLabel: "Baru", baruSampaiMs: null,
    });
  });
});
```

`apps/web/test/siklus-graf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GalatApi, type HalamanAcara, type HalamanGraf, type KlienGraf } from "../src/api";
import { mulaiSiklus, type Tampilan } from "../src/siklus-graf";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

function h(id: number, lengkap: boolean, a = A, b = B): HalamanGraf {
  return {
    simpul: [{ address: a, displayName: "", tierLabel: "Baru" }, { address: b, displayName: "", tierLabel: "Baru" }],
    sisi: [{ id, a, b, atMs: id, txHash: "0x" }],
    kursor: id,
    lengkap,
  };
}
const KOSONG = (kursor: number): HalamanGraf => ({ simpul: [], sisi: [], kursor, lengkap: true });

/**
 * Klien palsu yang menjawab dari antrean. Setiap jawaban berupa halaman atau
 * galat. `sejak` merekam sejakId setiap panggilan.
 */
function klienDari(antrean: (HalamanGraf | HalamanAcara | Error)[]) {
  const sejak: number[] = [];
  const berikut = async (s: number) => {
    sejak.push(s);
    const j = antrean.shift();
    if (j === undefined) throw new Error("antrean habis");
    if (j instanceof Error) throw j;
    return j;
  };
  const klien: KlienGraf = {
    jaringan: (s) => berikut(s) as Promise<HalamanGraf>,
    acara: (_id, s) => berikut(s) as Promise<HalamanAcara>,
    daftarAcara: async () => [],
  };
  return { klien, sejak };
}

/** Menjalankan siklus sampai `n` jeda tercatat, lalu menghentikannya. */
async function jalankan(klien: KlienGraf, n: number, cakupan: Parameters<typeof mulaiSiklus>[0]["cakupan"] = { jenis: "jaringan" }) {
  const jeda: number[] = [];
  const tampilan: Tampilan[] = [];
  let jam = 1_000;
  const s = mulaiSiklus({
    klien, cakupan,
    nowMs: () => (jam += 10),
    tunda: async (ms) => {
      jeda.push(ms);
      if (jeda.length >= n) s.hentikan();
    },
    saatBerubah: (t) => tampilan.push(t),
  });
  await s.selesai;
  return { jeda, tampilan, akhir: tampilan[tampilan.length - 1]! };
}

describe("siklus graf", () => {
  it("muat halaman berturut-turut tanpa jeda sampai lengkap, lalu polling 3 detik dengan kursor", async () => {
    const { klien, sejak } = klienDari([h(1, false), h(2, true, B, C), KOSONG(2)]);
    const { jeda, akhir } = await jalankan(klien, 2);
    expect(sejak).toEqual([0, 1, 2]);
    expect(jeda).toEqual([3_000, 3_000]);
    expect(akhir.status).toBe("live");
    expect(akhir.keadaan.sisi.size).toBe(2);
  });

  it("muatan awal tidak menyala; sisi dari polling sesudahnya menyala", async () => {
    const { klien } = klienDari([h(1, true), h(2, true, B, C)]);
    const { akhir } = await jalankan(klien, 2);
    expect(akhir.keadaan.sisi.get(1)!.baruSampaiMs).toBeNull();
    expect(akhir.keadaan.sisi.get(2)!.baruSampaiMs).not.toBeNull();
  });

  it("gagal: graf dipertahankan, Reconnecting, jeda 3 → 6 → 12 → 12, lalu kembali 3", async () => {
    const mati = new GalatApi(null, "jaringan", "mati");
    const { klien, sejak } = klienDari([h(1, true), mati, mati, mati, mati, KOSONG(1), KOSONG(1)]);
    const { jeda, tampilan, akhir } = await jalankan(klien, 7);
    expect(jeda).toEqual([3_000, 3_000, 6_000, 12_000, 12_000, 3_000, 3_000]);
    const saatGagal = tampilan.filter((t) => t.status === "menyambung-ulang");
    expect(saatGagal).toHaveLength(4);
    for (const t of saatGagal) expect(t.keadaan.sisi.size).toBe(1);
    expect(sejak.slice(1)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(akhir.status).toBe("live");
  });

  it("acara tidak ditemukan: berhenti tanpa mencoba ulang", async () => {
    const { klien, sejak } = klienDari([new GalatApi(404, "event_not_found", "404")]);
    const { jeda, akhir } = await jalankan(klien, 99, { jenis: "acara", eventId: "0xabc" });
    expect(jeda).toEqual([]);
    expect(sejak).toEqual([0]);
    expect(akhir.status).toBe("tidak-ditemukan");
  });

  it("mode acara menyimpan acara dan hitungan dari respons", async () => {
    const r: HalamanAcara = {
      ...h(1, true),
      acara: { eventId: "0xabc", title: "Hack", startsAt: 1, endsAt: 2, live: true },
      hitungan: { hadir: 12, salaman: 1 },
    };
    const { klien } = klienDari([r]);
    const { akhir } = await jalankan(klien, 1, { jenis: "acara", eventId: "0xabc" });
    expect(akhir.acara?.title).toBe("Hack");
    expect(akhir.hitungan).toEqual({ hadir: 12, salaman: 1 });
  });

  it("setelah dihentikan, jawaban yang terlambat tidak diteruskan ke layar", async () => {
    let lepas!: (x: HalamanGraf) => void;
    const klien: KlienGraf = {
      jaringan: () => new Promise((r) => { lepas = r; }),
      acara: async () => { throw new Error("tidak dipakai"); },
      daftarAcara: async () => [],
    };
    const tampilan: Tampilan[] = [];
    const s = mulaiSiklus({
      klien, cakupan: { jenis: "jaringan" }, nowMs: () => 0,
      tunda: async () => {}, saatBerubah: (t) => tampilan.push(t),
    });
    s.hentikan();
    lepas(h(1, true));
    await s.selesai;
    expect(tampilan).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/web exec vitest run test/api.test.ts test/gabung-graf.test.ts test/siklus-graf.test.ts`
Expected: FAIL — ketiga modul tidak ditemukan.

- [ ] **Step 3: Buat `apps/web/src/api.ts`**

```ts
/**
 * Klien `GET /graf/*` (spec 6 §4). Tanpa pustaka: tiga endpoint GET tidak
 * butuh satu.
 *
 * Tidak ada header selain `Accept` — header itu termasuk daftar aman CORS,
 * jadi browser tidak mengirim preflight OPTIONS untuk setiap polling.
 */

export type SimpulApi = { address: string; displayName: string; tierLabel: string };
export type SisiApi = { id: number; a: string; b: string; atMs: number; txHash: string };
export type HalamanGraf = { simpul: SimpulApi[]; sisi: SisiApi[]; kursor: number; lengkap: boolean };
export type AcaraApi = { eventId: string; title: string; startsAt: number; endsAt: number; live: boolean };
export type HitunganAcara = { hadir: number; salaman: number };
export type HalamanAcara = HalamanGraf & { acara: AcaraApi; hitungan: HitunganAcara };

/** Batas waktu setiap permintaan (spec 6 §5). */
export const BATAS_WAKTU_MS = 10_000;

export class GalatApi extends Error {
  constructor(
    readonly status: number | null,
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatApi";
  }
}

/** `VITE_API_URL` tanpa garis miring penutup. Kosong = origin yang sama (proxy dev Vite). */
export function basisApi(nilai: string | undefined): string {
  return (nilai ?? "").trim().replace(/\/+$/, "");
}

export function urlGraf(basis: string, jalur: string, sejakId?: number): string {
  return sejakId === undefined ? `${basis}${jalur}` : `${basis}${jalur}?sejakId=${sejakId}`;
}

function angka(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Respons yang bentuknya salah ditolak di sini, bukan meledak di kanvas. */
export function pastikanHalaman(x: unknown): HalamanGraf {
  const h = x as Partial<HalamanGraf> | null;
  if (
    !h || !Array.isArray(h.simpul) || !Array.isArray(h.sisi)
    || !angka(h.kursor) || typeof h.lengkap !== "boolean"
    || !h.sisi.every((s) => s && angka(s.id) && typeof s.a === "string" && typeof s.b === "string")
    || !h.simpul.every((s) => s && typeof s.address === "string")
  ) {
    throw new GalatApi(null, "bentuk_tidak_sah", "respons graf tidak berbentuk halaman");
  }
  return h as HalamanGraf;
}

export type KlienGraf = {
  jaringan(sejakId: number): Promise<HalamanGraf>;
  acara(eventId: string, sejakId: number): Promise<HalamanAcara>;
  daftarAcara(): Promise<AcaraApi[]>;
};

type Ambil = (url: string, init: RequestInit) => Promise<Response>;

export function buatKlienGraf(
  basis: string,
  ambil: Ambil = (url, init) => fetch(url, init),
  batasMs = BATAS_WAKTU_MS,
): KlienGraf {
  async function getJson(url: string): Promise<unknown> {
    const kendali = new AbortController();
    const pewaktu = setTimeout(() => kendali.abort(), batasMs);
    try {
      const res = await ambil(url, { signal: kendali.signal, headers: { Accept: "application/json" } });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const kode = (body as { code?: unknown } | null)?.code;
        throw new GalatApi(res.status, typeof kode === "string" ? kode : "http", `HTTP ${res.status}`);
      }
      return body;
    } catch (e) {
      if (e instanceof GalatApi) throw e;
      throw new GalatApi(null, kendali.signal.aborted ? "batas_waktu" : "jaringan", String(e));
    } finally {
      clearTimeout(pewaktu);
    }
  }

  return {
    async jaringan(sejakId) {
      return pastikanHalaman(await getJson(urlGraf(basis, "/graf/jaringan", sejakId)));
    },
    async acara(eventId, sejakId) {
      const body = await getJson(urlGraf(basis, `/graf/acara/${eventId}`, sejakId));
      const h = pastikanHalaman(body) as HalamanAcara;
      if (!h.acara || !h.hitungan || !angka(h.hitungan.hadir) || !angka(h.hitungan.salaman)) {
        throw new GalatApi(null, "bentuk_tidak_sah", "respons acara tanpa acara atau hitungan");
      }
      return h;
    },
    async daftarAcara() {
      const body = (await getJson(urlGraf(basis, "/graf/acara"))) as { acara?: unknown } | null;
      if (!body || !Array.isArray(body.acara)) {
        throw new GalatApi(null, "bentuk_tidak_sah", "respons daftar acara tidak sah");
      }
      return body.acara as AcaraApi[];
    },
  };
}
```

- [ ] **Step 4: Buat `apps/web/src/gabung-graf.ts`**

```ts
import type { HalamanGraf } from "./api";

/**
 * Keadaan graf di layar dan penggabungnya (spec 6 §6.2). Murni: keadaan lama
 * TIDAK PERNAH diubah — kanvas menyimpan referensi ke keadaan sebelumnya.
 */

/** Lamanya sisi baru menyala (spec 6 §6.3). */
export const DURASI_SOROT_MS = 4_000;

export type SimpulLayar = {
  /** Huruf kecil — kunci peta. */
  address: string;
  displayName: string;
  tierLabel: string;
  /** null = sudah ada sejak muatan awal; tidak dianimasikan. */
  baruSampaiMs: number | null;
};

export type SisiLayar = {
  id: number;
  a: string;
  b: string;
  atMs: number;
  txHash: string;
  /** Menyala sampai waktu ini. null = bagian muatan awal. */
  baruSampaiMs: number | null;
};

export type KeadaanGraf = {
  readonly simpul: ReadonlyMap<string, SimpulLayar>;
  readonly sisi: ReadonlyMap<number, SisiLayar>;
  readonly kursor: number;
};

export const KEADAAN_KOSONG: KeadaanGraf = { simpul: new Map(), sisi: new Map(), kursor: 0 };

/**
 * `sorot` false untuk halaman-halaman muatan awal: ribuan sisi lama yang
 * menyala bersamaan bukan "graf tumbuh", melainkan layar putih. Setelah muatan
 * awal lengkap, setiap sisi yang baru datang menyala.
 *
 * Mengembalikan keadaan yang SAMA (referensi) bila respons tidak mengubah apa
 * pun, supaya polling tanpa salaman baru tidak memicu render ulang kanvas.
 */
export function gabungHalaman(
  lama: KeadaanGraf,
  halaman: HalamanGraf,
  opsi: { nowMs: number; sorot: boolean },
): KeadaanGraf {
  const baruSampai = opsi.sorot ? opsi.nowMs + DURASI_SOROT_MS : null;
  let simpul: Map<string, SimpulLayar> | null = null;
  let sisi: Map<number, SisiLayar> | null = null;

  for (const s of halaman.simpul) {
    const kunci = s.address.toLowerCase();
    const ada = (simpul ?? lama.simpul).get(kunci);
    if (ada && ada.displayName === s.displayName && ada.tierLabel === s.tierLabel) continue;
    simpul ??= new Map(lama.simpul);
    simpul.set(kunci, {
      address: kunci,
      displayName: s.displayName,
      tierLabel: s.tierLabel,
      // Data yang lebih baru menimpa nama dan tier, tapi simpul yang sudah
      // ada tidak "lahir" lagi.
      baruSampaiMs: ada ? ada.baruSampaiMs : baruSampai,
    });
  }

  for (const s of halaman.sisi) {
    if ((sisi ?? lama.sisi).has(s.id)) continue;
    sisi ??= new Map(lama.sisi);
    const a = s.a.toLowerCase();
    const b = s.b.toLowerCase();
    sisi.set(s.id, { id: s.id, a, b, atMs: s.atMs, txHash: s.txHash, baruSampaiMs: baruSampai });

    // Kanvas melempar galat bila sebuah sisi menunjuk simpul yang tidak ada.
    // API selalu menyertakan simpul untuk sisi di halaman yang sama, tapi
    // layar proyektor tidak boleh padam karena satu respons yang cacat.
    for (const ujung of [a, b]) {
      if ((simpul ?? lama.simpul).has(ujung)) continue;
      simpul ??= new Map(lama.simpul);
      simpul.set(ujung, { address: ujung, displayName: "", tierLabel: "Baru", baruSampaiMs: baruSampai });
    }
  }

  const kursor = Math.max(lama.kursor, halaman.kursor);
  if (simpul === null && sisi === null && kursor === lama.kursor) return lama;
  return { simpul: simpul ?? lama.simpul, sisi: sisi ?? lama.sisi, kursor };
}
```

- [ ] **Step 5: Buat `apps/web/src/siklus-graf.ts`**

```ts
import { GalatApi, type AcaraApi, type HalamanAcara, type HalamanGraf, type HitunganAcara, type KlienGraf } from "./api";
import { gabungHalaman, KEADAAN_KOSONG, type KeadaanGraf } from "./gabung-graf";
import { jedaBerikutnya } from "./jeda";

/**
 * Siklus muat-dan-polling layar /live (spec 6 §6.2), lepas dari React supaya
 * bisa diuji dengan jam dan klien palsu:
 *
 * 1. muat halaman berturut-turut TANPA jeda sampai `lengkap: true`;
 * 2. lalu polling tiap 3 detik dengan `sejakId = kursor`;
 * 3. gagal → status "menyambung-ulang", graf yang sudah ada DIPERTAHANKAN,
 *    coba lagi dengan jeda 3 → 6 → 12 detik; berhasil → kembali 3 detik;
 * 4. acara tidak ada (404) → berhenti; mencoba ulang tidak akan menolong.
 *
 * Mengganti cakupan = hentikan siklus ini, mulai siklus baru dari keadaan kosong.
 */

export type Cakupan = { jenis: "jaringan" } | { jenis: "acara"; eventId: string };
export type StatusSiklus = "memuat" | "live" | "menyambung-ulang" | "tidak-ditemukan";

export type Tampilan = {
  keadaan: KeadaanGraf;
  status: StatusSiklus;
  acara: AcaraApi | null;
  hitungan: HitunganAcara | null;
};

export type OpsiSiklus = {
  klien: KlienGraf;
  cakupan: Cakupan;
  nowMs: () => number;
  tunda: (ms: number) => Promise<void>;
  saatBerubah: (t: Tampilan) => void;
};

export function mulaiSiklus(o: OpsiSiklus): { hentikan: () => void; selesai: Promise<void> } {
  let hidup = true;
  let t: Tampilan = { keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null };
  let gagalBeruntun = 0;
  let sudahLengkap = false;

  const kirim = (baru: Tampilan) => {
    t = baru;
    if (hidup) o.saatBerubah(t);
  };

  async function satuPermintaan(): Promise<HalamanGraf | HalamanAcara> {
    return o.cakupan.jenis === "acara"
      ? o.klien.acara(o.cakupan.eventId, t.keadaan.kursor)
      : o.klien.jaringan(t.keadaan.kursor);
  }

  const selesai = (async () => {
    while (hidup) {
      try {
        const h = await satuPermintaan();
        if (!hidup) return;
        gagalBeruntun = 0;
        const keadaan = gabungHalaman(t.keadaan, h, { nowMs: o.nowMs(), sorot: sudahLengkap });
        if (h.lengkap) sudahLengkap = true;
        const acara = "acara" in h ? h.acara : t.acara;
        const hitungan = "hitungan" in h ? h.hitungan : t.hitungan;
        kirim({ keadaan, status: sudahLengkap ? "live" : "memuat", acara, hitungan });
        // Masih ada halaman: ambil segera, tanpa jeda.
        if (!h.lengkap) continue;
      } catch (e) {
        if (!hidup) return;
        if (e instanceof GalatApi && e.status === 404) {
          kirim({ ...t, status: "tidak-ditemukan" });
          return;
        }
        gagalBeruntun += 1;
        kirim({ ...t, status: "menyambung-ulang" });
      }
      await o.tunda(jedaBerikutnya(gagalBeruntun));
    }
  })();

  return {
    hentikan: () => { hidup = false; },
    selesai,
  };
}
```

- [ ] **Step 6: Jalankan tes dan typecheck, pastikan lulus**

Run: `pnpm --filter @nearly/web exec vitest run && pnpm --filter @nearly/web typecheck`
Expected: PASS semua tes web.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/api.ts \
  apps/web/src/gabung-graf.ts \
  apps/web/src/siklus-graf.ts \
  apps/web/test/api.test.ts \
  apps/web/test/gabung-graf.test.ts \
  apps/web/test/siklus-graf.test.ts
git commit -m "$(cat <<'EOF'
feat(web): klien graf, penggabung halaman, siklus polling dengan coba ulang

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Halaman — `/live`, landing, CSS

**Files:**
- Create: `apps/web/src/main.tsx`, `apps/web/src/pages/Live.tsx`, `apps/web/src/pages/Landing.tsx`, `apps/web/src/gaya.css`

**Interfaces:**
- Consumes: semua dari Task 9 dan 10; `ForceGraph2D` default export dan tipe `ForceGraphMethods`, `GraphData`, `LinkObject`, `NodeObject` dari `react-force-graph-2d`.
- Produces: `Live()` dan `Landing()` (named export); bundel statis `apps/web/dist`.

Komponen UI tidak diuji unit (tidak ada DOM di tes web); logikanya sudah di modul murni Task 9–10. Buktinya di sini adalah typecheck, build, dan uji asap Step 6.

**Salinan landing page (spec §6.4).** Setiap blok diawali komentar yang menunjuk bagian spec sumber klaimnya. Jangan menambah klaim, angka pengguna, testimoni, logo mitra, maupun analitik. Beberapa kalimat sengaja lebih lemah dari yang "enak dibaca" — mis. tidak ada klaim bahwa peluruhan waktu meredam wallet yang dijual, karena spec induk §11.1 butir 7 menyatakan peluruhan tidak diaktifkan. Jangan dikuatkan.

- [ ] **Step 1: Buat `apps/web/src/main.tsx`**

```tsx
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./gaya.css";
import { Landing } from "./pages/Landing";
import { pilihHalaman } from "./rute";

// Layar graf dimuat terpisah: force-graph cukup berat, dan pengunjung landing
// page tidak perlu mengunduhnya.
const Live = lazy(() => import("./pages/Live").then((m) => ({ default: m.Live })));

const akar = document.getElementById("root");
if (!akar) throw new Error("elemen #root tidak ada di index.html");

createRoot(akar).render(
  <StrictMode>
    {pilihHalaman(window.location.pathname) === "live"
      ? <Suspense fallback={<div className="live live-memuat">Loading…</div>}><Live /></Suspense>
      : <Landing />}
  </StrictMode>,
);
```

- [ ] **Step 2: Buat `apps/web/src/pages/Live.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods, type GraphData, type LinkObject, type NodeObject,
} from "react-force-graph-2d";
import { basisApi, buatKlienGraf, type AcaraApi } from "../api";
import { KEADAAN_KOSONG, type KeadaanGraf } from "../gabung-graf";
import { labelSimpul, perluLabel, radiusSimpul } from "../label";
import { bacaParamAcara } from "../rute";
import { mulaiSiklus, type Cakupan, type Tampilan } from "../siklus-graf";

/**
 * Layar proyektor (spec 6 §6.1). Teks berbahasa Inggris, sama dengan landing.
 *
 * force-graph MEMUTASI objek simpul (x, y, vx, vy) dan sisi (source/target
 * diganti objek simpul). Karena itu objek gambar disimpan di kolam per
 * cakupan dan DIPAKAI ULANG di setiap polling: objek baru untuk simpul lama
 * akan membuat seluruh graf melompat ke posisi acak setiap 3 detik.
 */

type SimpulGambar = { id: string; label: string; radius: number; baruSampaiMs: number | null; munculMs: number };
type SisiGambar = { id: number; source: string; target: string; baruSampaiMs: number | null };

const WARNA_SIMPUL = "#e8eefc";
const WARNA_SISI = "rgba(160, 180, 220, 0.35)";
const WARNA_SOROT = "#ffd166";
const WARNA_LABEL = "rgba(232, 238, 252, 0.9)";
const DURASI_TUMBUH_MS = 600;

const klien = buatKlienGraf(basisApi(import.meta.env.VITE_API_URL as string | undefined));
const tunda = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ukuranJendela() {
  return { lebar: window.innerWidth, tinggi: window.innerHeight };
}

export function Live() {
  const eventIdUrl = useMemo(() => bacaParamAcara(window.location.search), []);
  const [cakupan, setCakupan] = useState<Cakupan>(
    eventIdUrl ? { jenis: "acara", eventId: eventIdUrl } : { jenis: "jaringan" },
  );
  const [tampilan, setTampilan] = useState<Tampilan>({
    keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null,
  });
  const [ukuran, setUkuran] = useState(ukuranJendela);
  const [daftarAcara, setDaftarAcara] = useState<AcaraApi[]>([]);

  const kanvas = useRef<ForceGraphMethods<NodeObject<SimpulGambar>, LinkObject<SimpulGambar, SisiGambar>> | undefined>(undefined);
  const sudahPas = useRef(false);
  const kolamSimpul = useRef(new Map<string, NodeObject<SimpulGambar>>());
  const kolamSisi = useRef(new Map<number, LinkObject<SimpulGambar, SisiGambar>>());

  useEffect(() => {
    const ubah = () => setUkuran(ukuranJendela());
    window.addEventListener("resize", ubah);
    return () => window.removeEventListener("resize", ubah);
  }, []);

  // Pemilih acara hanya muncul tanpa ?acara (spec 6 §6.1).
  useEffect(() => {
    if (eventIdUrl) return;
    let hidup = true;
    klien.daftarAcara().then((a) => { if (hidup) setDaftarAcara(a); }).catch(() => {});
    return () => { hidup = false; };
  }, [eventIdUrl]);

  // Di awal acara graf berisi banyak pasangan yang belum saling tersambung.
  // Gaya tolak d3 tanpa batas jarak mendorong komponen-komponen itu menjauh
  // tanpa henti sampai keluar layar; dibatasi supaya semuanya tetap di ruangan.
  useEffect(() => {
    kanvas.current?.d3Force("charge")?.distanceMax?.(250);
  }, []);

  const kunciCakupan = cakupan.jenis === "acara" ? `acara:${cakupan.eventId}` : "jaringan";

  useEffect(() => {
    kolamSimpul.current = new Map();
    kolamSisi.current = new Map();
    sudahPas.current = false;
    setTampilan({ keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null });
    const siklus = mulaiSiklus({
      klien, cakupan, nowMs: () => Date.now(), tunda, saatBerubah: setTampilan,
    });
    return siklus.hentikan;
    // Sengaja hanya kunciCakupan: objek cakupan baru berisi sama tidak boleh memulai ulang siklus.
  }, [kunciCakupan]);

  const dataGraf = useMemo(
    () => susunDataGraf(tampilan.keadaan, kolamSimpul.current, kolamSisi.current),
    [tampilan.keadaan],
  );
  const jumlahSimpul = tampilan.keadaan.simpul.size;

  const judul = cakupan.jenis === "acara" ? (tampilan.acara?.title ?? "Loading event…") : "Nearly network";
  const angka = cakupan.jenis === "acara"
    ? [
      { nilai: tampilan.hitungan?.salaman ?? 0, label: "handshakes" },
      { nilai: tampilan.hitungan?.hadir ?? 0, label: "checked in" },
    ]
    : [
      { nilai: tampilan.keadaan.sisi.size, label: "connections" },
      { nilai: jumlahSimpul, label: "people" },
    ];

  return (
    <div className="live">
      <ForceGraph2D<SimpulGambar, SisiGambar>
        ref={kanvas}
        graphData={dataGraf}
        width={ukuran.lebar}
        height={ukuran.tinggi}
        backgroundColor="#05070d"
        enableNodeDrag={false}
        autoPauseRedraw={false}
        cooldownTime={15_000}
        // Sekali per cakupan, setelah tata letak awal tenang: seluruh graf
        // masuk layar. Tidak diulang, supaya zoom operator tidak direbut.
        onEngineStop={() => {
          if (sudahPas.current || jumlahSimpul === 0) return;
          sudahPas.current = true;
          kanvas.current?.zoomToFit(600, 80);
        }}
        nodeLabel={() => ""}
        linkColor={(l) => (menyala(l.baruSampaiMs) ? WARNA_SOROT : WARNA_SISI)}
        linkWidth={(l) => (menyala(l.baruSampaiMs) ? 3 : 1)}
        nodeCanvasObject={(n, ctx, skala) => {
          const tumbuh = Math.min(1, (Date.now() - n.munculMs) / DURASI_TUMBUH_MS);
          const r = n.radius * (0.2 + 0.8 * tumbuh);
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = WARNA_SIMPUL;
          ctx.fill();
          if (perluLabel(jumlahSimpul, menyala(n.baruSampaiMs), skala)) {
            const ukuranHuruf = 12 / skala;
            ctx.font = `${ukuranHuruf}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = WARNA_LABEL;
            ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + r + 2 / skala);
          }
        }}
      />

      <header className="live-kiri">
        <h1>{judul}</h1>
        <div className="live-tombol">
          <button
            type="button"
            disabled={!eventIdUrl}
            aria-pressed={cakupan.jenis === "acara"}
            onClick={() => eventIdUrl && setCakupan({ jenis: "acara", eventId: eventIdUrl })}
          >
            This event
          </button>
          <button
            type="button"
            aria-pressed={cakupan.jenis === "jaringan"}
            onClick={() => setCakupan({ jenis: "jaringan" })}
          >
            Whole network
          </button>
        </div>
        {!eventIdUrl && daftarAcara.length > 0 && (
          <label className="live-pemilih">
            Event
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) window.location.assign(`/live?acara=${e.target.value}`);
              }}
            >
              <option value="" disabled>Choose an event…</option>
              {daftarAcara.map((a) => (
                <option key={a.eventId} value={a.eventId}>
                  {a.live ? "● " : ""}{a.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <aside className="live-kanan">
        {angka.map((a) => (
          <div key={a.label} className="live-angka">
            <strong>{a.nilai.toLocaleString("en-US")}</strong>
            <span>{a.label}</span>
          </div>
        ))}
      </aside>

      <footer className="live-bawah">
        <p>Scan, shake hands, watch the graph grow.</p>
        <button type="button" onClick={() => void layarPenuh()}>Fullscreen</button>
      </footer>

      {tampilan.status !== "live" && (
        <div className="live-status" role="status">
          {tampilan.status === "memuat" && "Loading…"}
          {tampilan.status === "menyambung-ulang" && "Reconnecting…"}
          {tampilan.status === "tidak-ditemukan" && "Event not found"}
        </div>
      )}
    </div>
  );
}

function menyala(baruSampaiMs: number | null): boolean {
  return baruSampaiMs !== null && Date.now() < baruSampaiMs;
}

async function layarPenuh() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

function susunDataGraf(
  keadaan: KeadaanGraf,
  kolamSimpul: Map<string, NodeObject<SimpulGambar>>,
  kolamSisi: Map<number, LinkObject<SimpulGambar, SisiGambar>>,
): GraphData<NodeObject<SimpulGambar>, LinkObject<SimpulGambar, SisiGambar>> {
  const nodes: NodeObject<SimpulGambar>[] = [];
  for (const s of keadaan.simpul.values()) {
    let n = kolamSimpul.get(s.address);
    if (!n) {
      n = {
        id: s.address, label: "", radius: 0, baruSampaiMs: s.baruSampaiMs,
        // Simpul dari muatan awal langsung tampil penuh; yang baru membesar.
        munculMs: s.baruSampaiMs === null ? 0 : Date.now(),
      };
      kolamSimpul.set(s.address, n);
    }
    n.label = labelSimpul(s.displayName, s.address);
    n.radius = radiusSimpul(s.tierLabel);
    n.baruSampaiMs = s.baruSampaiMs;
    nodes.push(n);
  }

  const links: LinkObject<SimpulGambar, SisiGambar>[] = [];
  for (const s of keadaan.sisi.values()) {
    let l = kolamSisi.get(s.id);
    if (!l) {
      l = { id: s.id, source: s.a, target: s.b, baruSampaiMs: s.baruSampaiMs };
      kolamSisi.set(s.id, l);
    }
    links.push(l);
  }
  return { nodes, links };
}
```

- [ ] **Step 3: Buat `apps/web/src/pages/Landing.tsx`**

```tsx
import { CHAIN_ID, KONTRAK, tautanBscScan } from "../kontrak";

/**
 * Landing page (spec 6 §6.4). Bahasa Inggris.
 *
 * ATURAN SALINAN: setiap klaim harus bisa ditunjuk ke spec. Rujukannya ditulis
 * di komentar tepat di atas setiap blok — "induk" = 2026-09-03-nearly-design.md,
 * "fase 6" = 2026-09-14-nearly-fase-6-demo-design.md. Tidak ada angka
 * pengguna, testimoni, logo mitra, atau analitik. Klaim baru tanpa rujukan
 * tidak boleh masuk.
 */
export function Landing() {
  return (
    <main className="landing">
      {/* induk §2 (aturan inti), fase 6 §6.4 butir 1 */}
      <section className="hero">
        <p className="merek">Nearly</p>
        <h1>Connections you can only make in person.</h1>
        <p className="lead">
          Nearly is a social graph with one rule: a connection cannot be made remotely. No follows,
          no friend requests. The only way into someone&apos;s network is to stand next to them and
          both confirm.
        </p>
        <a className="tombol-utama" href="/live">See the live graph</a>
      </section>

      {/* induk §7.1 (QR 30 detik, verifikasi ko-lokasi, on-chain lewat relayer), §9.4 (satu
          koneksi per pasangan); fase 6 §1 dan §6.4 butir 2 (BNB Smart Chain testnet) */}
      <section>
        <h2>How it works</h2>
        <ol className="langkah">
          <li>
            <h3>Meet</h3>
            <p>You are in the same room as someone. That is the only starting point Nearly accepts.</p>
          </li>
          <li>
            <h3>Scan</h3>
            <p>One phone shows a signed QR code that rotates every 30 seconds. The other phone scans it.</p>
          </li>
          <li>
            <h3>Verified, then recorded</h3>
            <p>
              The server checks that both phones were in the same place at the same time. Only then is
              the connection written on-chain, on BNB Smart Chain testnet. One connection per pair of
              people, forever.
            </p>
          </li>
        </ol>
      </section>

      {/* induk §7.2 dan §8 (PageRank dari seed, diversitas, sybil terisolasi, tier + bukti),
          §9.1 (akun ganda mengencerkan), §14 butir 2 (seed = penyelenggara) */}
      <section>
        <h2>Trust comes from the graph</h2>
        <p>
          Nobody rates anybody. Trust is computed from where you sit in the graph of real meetings,
          using personalized PageRank seeded from a small set of trusted accounts, such as event
          organizers.
        </p>
        <ul>
          <li>
            <strong>Diversity counts.</strong> Meeting people across many events and over time weighs
            more than meeting many people in one room in one hour.
          </li>
          <li>
            <strong>Fake accounts struggle.</strong> A cluster of accounts that only connect to each
            other has no path to the trusted seed, so its trust stays near zero. Extra accounts dilute
            trust instead of multiplying it.
          </li>
          <li>
            <strong>A tier with evidence, not a bare number.</strong> People see a tier alongside
            concrete facts: connections, events, regions, and vouches.
          </li>
        </ul>
      </section>

      {/* induk §6 prinsip 2 dan 3 (tanpa peta orang, identitas asli tidak publik), §7.5 (pesan
          E2E hanya antar yang pernah bertemu, batas metadata server); fase 6 §6.4 butir 4 (lokasi
          kasar saja) */}
      <section>
        <h2>Privacy by design</h2>
        <ul>
          <li><strong>No map of people.</strong> Nearly never shows people as pins on a map.</li>
          <li>
            <strong>Coarse location only.</strong> Handshakes are checked against a coarse location
            cell, not precise GPS coordinates.
          </li>
          <li>
            <strong>End-to-end encrypted messages</strong>, and only between people who have actually
            met. The relay stores ciphertext; it can still see who messages whom, and when.
          </li>
          <li><strong>Your real identity is never public.</strong> You can stay pseudonymous.</li>
        </ul>
      </section>

      {/* induk §9.3 dan §14 butir 4 ("jangan pernah mengklaim lebih dari ini"), §9.1 (sybil
          dideteksi, tidak dicegah), §9.5 (wallet dijual), §9.6 dan §14 butir 1 (GPS), §10.3 dan
          §14 butir 3 (graf publik); fase 6 §6.4 butir 5 — bagian ini WAJIB ada */}
      <section className="batas">
        <h2>What Nearly does not claim</h2>
        <ul>
          <li>
            <strong>Nearly proves that a real human showed up. It does not prove that they are a good
            person.</strong>
          </li>
          <li>
            <strong>Multi-device sybils are detected, not prevented.</strong> One person with several
            real phones can still create several accounts; co-location fingerprints and the diversity
            factor make that pattern visible and weaker.
          </li>
          <li>
            <strong>Location can be spoofed and is imprecise indoors.</strong> Short-lived QR codes and a
            tight time window raise the cost of faking a meeting; they do not make it impossible.
          </li>
          <li>
            <strong>A wallet with a good reputation can be sold.</strong> No soulbound system can fully
            stop that, including this one.
          </li>
          <li>
            <strong>The connection graph is public.</strong> Anyone can see that two addresses met.
            That is the trade-off that lets anyone recompute trust and check our work.
          </li>
        </ul>
      </section>

      {/* fase 6 §6.4 butir 6; alamat dari src/kontrak.ts, peran dari induk §10.3 */}
      <section>
        <h2>On-chain</h2>
        <p>BNB Smart Chain testnet (chainId {CHAIN_ID}).</p>
        <ul className="kontrak">
          {KONTRAK.map((k) => (
            <li key={k.nama}>
              <span className="kontrak-nama">{k.nama}</span>
              <span className="kontrak-peran">{k.peran}</span>
              <a href={tautanBscScan(k.alamat)} target="_blank" rel="noreferrer">
                <code>{k.alamat}</code>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="kaki">
        <p>Nearly · testnet demo</p>
      </footer>
    </main>
  );
}
```

- [ ] **Step 4: Buat `apps/web/src/gaya.css`**

```css
/* Satu berkas CSS biasa untuk dua halaman (spec 6 §5): tanpa Tailwind, tanpa pustaka UI. */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.55;
  color: #111827;
  background: #fbfaf7;
}

button {
  font: inherit;
}

/* ── Landing ─────────────────────────────────────────────────────────────── */

.landing {
  max-width: 46rem;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
}

.landing section {
  margin-top: 3.5rem;
}

.landing h2 {
  font-size: 1.5rem;
  margin: 0 0 1rem;
}

.landing h3 {
  font-size: 1.05rem;
  margin: 0 0 0.25rem;
}

.landing ul,
.landing ol {
  padding-left: 1.25rem;
}

.landing li {
  margin-bottom: 0.75rem;
}

.hero {
  margin-top: 2rem;
}

.merek {
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7280;
  margin: 0;
}

.hero h1 {
  font-size: clamp(2rem, 6vw, 3.25rem);
  line-height: 1.1;
  margin: 0.5rem 0 1rem;
}

.lead {
  font-size: 1.15rem;
  color: #374151;
}

.tombol-utama {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  background: #111827;
  color: #fbfaf7;
  font-weight: 600;
  text-decoration: none;
}

.tombol-utama:hover {
  background: #1f2937;
}

.langkah {
  list-style: decimal;
}

.batas {
  border-left: 4px solid #d97706;
  padding-left: 1rem;
}

.kontrak {
  list-style: none;
  padding-left: 0 !important;
}

.kontrak li {
  display: grid;
  gap: 0.15rem;
}

.kontrak-nama {
  font-weight: 600;
}

.kontrak-peran {
  color: #4b5563;
}

.kontrak code {
  font-size: 0.85rem;
  word-break: break-all;
}

.kaki {
  margin-top: 4rem;
  color: #6b7280;
  font-size: 0.9rem;
}

/* ── Live (proyektor, tema gelap) ────────────────────────────────────────── */

.live {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #05070d;
  color: #e8eefc;
}

.live-memuat {
  display: grid;
  place-items: center;
  font-size: 1.5rem;
}

.live-kiri,
.live-kanan,
.live-bawah,
.live-status {
  position: absolute;
  z-index: 1;
}

.live-kiri {
  top: 1.5rem;
  left: 1.75rem;
  max-width: 40vw;
}

.live-kiri h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.5rem, 2.8vw, 2.5rem);
  line-height: 1.15;
}

.live-tombol {
  display: flex;
  gap: 0.5rem;
}

.live button {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(232, 238, 252, 0.35);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.live button[aria-pressed="true"] {
  background: #e8eefc;
  color: #05070d;
}

.live button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.live-pemilih {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}

.live-pemilih select {
  font: inherit;
  max-width: 28rem;
  padding: 0.35rem;
  background: #0d1220;
  color: inherit;
  border: 1px solid rgba(232, 238, 252, 0.35);
  border-radius: 0.4rem;
}

.live-kanan {
  top: 1.5rem;
  right: 1.75rem;
  display: flex;
  gap: 2.5rem;
  text-align: right;
}

.live-angka strong {
  display: block;
  font-size: clamp(2.5rem, 6vw, 5rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.live-angka span {
  font-size: 1.1rem;
  opacity: 0.75;
}

.live-bawah {
  left: 0;
  right: 0;
  bottom: 1.25rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-size: clamp(1rem, 1.8vw, 1.5rem);
}

.live-bawah p {
  margin: 0;
}

.live-status {
  bottom: 1.25rem;
  right: 1.75rem;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.9);
  color: #05070d;
  font-weight: 600;
}
```

- [ ] **Step 5: Typecheck, tes, dan build**

Run: `pnpm --filter @nearly/web typecheck && pnpm --filter @nearly/web test && pnpm --filter @nearly/web build`
Expected: bersih; build menghasilkan `apps/web/dist/index.html`, satu berkas CSS, dan dua potongan JS (`index-*.js` dan `Live-*.js` — layar graf dimuat terpisah). Saat rencana ditulis, masing-masing ±200 kB (±64 kB gzip).

- [ ] **Step 6: Uji asap tanpa API (tidak menjalankan API sungguhan)**

Run (latar belakang): `pnpm --filter @nearly/web dev`
Buka `http://localhost:5173/` → landing tampil dengan keenam bagian. Buka `http://localhost:5173/live` → kanvas gelap, judul "Nearly network", angka 0, dan setelah ±10 detik lencana **Reconnecting…** di kanan bawah (tidak ada API di 8787 — itu yang diharapkan). Konsol browser tanpa galat selain permintaan `/graf/*` yang gagal. Hentikan dev server. JANGAN menjalankan `pnpm --filter @nearly/api dev` untuk "melengkapi" uji ini.

- [ ] **Step 7: Periksa salinan landing**

Run: `grep -niE "users|testimonial|partner|analytics|gtag|plausible|posthog|tanpa nama" apps/web/src/pages/Landing.tsx apps/web/src/pages/Live.tsx apps/web/index.html`
Expected: kosong (grep keluar dengan status 1).

Run: `grep -c "induk §\|fase 6 §" apps/web/src/pages/Landing.tsx`
Expected: 6 atau lebih — satu rujukan per bagian.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/main.tsx \
  apps/web/src/pages/Live.tsx \
  apps/web/src/pages/Landing.tsx \
  apps/web/src/gaya.css
git commit -m "$(cat <<'EOF'
feat(web): layar proyektor /live dan landing page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Templat deploy dan runbook

**Files:**
- Create: `deploy/nearly-api.service`, `deploy/Caddyfile`, `docs/demo/runbook.md`

**Interfaces:**
- Consumes: nama env dari `apps/api/src/index.ts` (`required(...)`), `ENV_GREENFIELD` (`apps/api/src/greenfield.ts:154`), `WEB_ORIGINS` dan `PORT` (Task 4 & 7); `tools/seed-inti.ts` (Task 8); `apps/web/vercel.json` (Task 9).
- Produces: berkas operasional untuk pemilik project. **Tidak ada yang dijalankan.**

**Aturan berkas-berkas ini:** hanya NAMA variabel env, tidak pernah nilai; tidak ada domain, IP, atau URL repo sungguhan (pakai `<domain>`, `<vps>`, `<vercel-domain>`, `<url-repo>`).

- [ ] **Step 1: Buat `deploy/nearly-api.service`**

```ini
# Unit systemd API Nearly (spec 6 §8). Templat — dipasang pemilik project,
# BUKAN sesi eksekusi. Langkah pasangnya di docs/demo/runbook.md bagian 1.
#
# Asumsi runbook: repo di /opt/nearly, pengguna sistem `nearly`, Node 24 dari
# paket distro/NodeSource di /usr/bin/node, berkas env di /etc/nearly/api.env
# (pemilik root, grup nearly, mode 640). Nilai rahasia TIDAK PERNAH masuk berkas ini.

[Unit]
Description=Nearly API (Hono)
After=network-online.target
Wants=network-online.target
# Env yang salah membuat proses langsung keluar; jangan biarkan systemd
# berhenti mencoba setelah beberapa kegagalan cepat berturut-turut.
StartLimitIntervalSec=0

[Service]
Type=simple
User=nearly
Group=nearly
WorkingDirectory=/opt/nearly/apps/api
ExecStart=/usr/bin/node --env-file=/etc/nearly/api.env --import=tsx src/index.ts
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Buat `deploy/Caddyfile`**

Indentasi di dalam blok memakai TAB (konvensi `caddy fmt`).

```
# Caddy di depan API Nearly (spec 6 §8). HTTPS otomatis lewat Let's Encrypt
# begitu DNS api.<domain> sudah menunjuk ke VPS dan port 80/443 terbuka.
#
# NEARLY_API_HOST diisi lewat env layanan Caddy, bukan ditulis di sini —
# langkahnya di docs/demo/runbook.md bagian 1. Contoh nilainya: api.<domain>.

{$NEARLY_API_HOST} {
	encode gzip
	reverse_proxy localhost:8787
}
```

- [ ] **Step 3: Buat `docs/demo/runbook.md`**

````markdown
# Runbook Demo Nearly — Deploy dan Hari-H

**Spec:** `docs/superpowers/specs/2026-09-14-nearly-fase-6-demo-design.md` §8
**Dijalankan oleh:** pemilik project. Sesi eksekusi kode TIDAK menjalankan satu pun langkah di sini.

> **Uji lapangan di satu meetup nyata SEBELUM hari-H** (spec induk §13). Akurasi lokasi di dalam
> ruangan, baterai, dan sinyal venue tidak bisa diuji dari meja. Kalau belum pernah dicoba di
> ruangan sungguhan, anggap demo belum siap.

Dokumen ini hanya menyebut **nama** variabel env. Nilainya tidak pernah ditulis di repo, di
issue, maupun di chat.

Placeholder yang dipakai di bawah: `<domain>` = domain milikmu (mis. `nearly.xyz`),
`<vps>` = alamat IP VPS, `<vercel-domain>` = domain yang diberikan Vercel.

---

## 1. VPS — API

### 1.1 Prasyarat

- Ubuntu/Debian dengan akses `sudo`, port 22, 80, dan 443 terbuka.
- **Node 24** (dari NodeSource, sehingga biner ada di `/usr/bin/node`), `corepack` untuk pnpm,
  `git`, dan **Caddy** (paket resmi `caddy` dari repositori Caddy).

```bash
node -v                 # harus v24.x
corepack enable
caddy version
```

### 1.2 Kode

```bash
sudo useradd --system --create-home --home-dir /var/lib/nearly --shell /usr/sbin/nologin nearly
sudo mkdir -p /opt/nearly && sudo chown nearly:nearly /opt/nearly
sudo -u nearly git clone <url-repo> /opt/nearly
cd /opt/nearly
sudo -u nearly corepack pnpm install --frozen-lockfile
```

`tsx` ada di `devDependencies` API dan dibutuhkan saat berjalan, jadi JANGAN pakai `--prod`.

### 1.3 Berkas env `/etc/nearly/api.env`

```bash
sudo mkdir -p /etc/nearly
sudo touch /etc/nearly/api.env
sudo chown root:nearly /etc/nearly/api.env
sudo chmod 640 /etc/nearly/api.env
sudoedit /etc/nearly/api.env
```

Isi dengan baris `NAMA=nilai` untuk variabel berikut (nilainya dari `.env` laptopmu, bukan dari dokumen ini):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ya | |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | rahasia — hanya di server |
| `RPC_URL` | ya | BSC testnet |
| `MAINNET_RPC` | ya | ENS |
| `RELAYER_PRIVATE_KEY` | ya | rahasia — dompet relayer sekali pakai |
| `CONNECTION_REGISTRY_ADDRESS` | ya | |
| `VOUCH_REGISTRY_ADDRESS` | ya | |
| `TRUST_ATTESTOR_ADDRESS` | ya | |
| `ATTENDANCE_REGISTRY_ADDRESS` | ya | |
| `ADMIN_TOKEN` | ya | rahasia |
| `WEB_ORIGINS` | ya untuk web | origin web dipisah koma, mis. `https://<vercel-domain>`; spasi dan garis miring penutup dibuang otomatis |
| `PORT` | tidak | default `8787`; kalau diubah, ubah juga `deploy/Caddyfile` |
| `GREENFIELD_RPC`, `GREENFIELD_CHAIN_ID`, `GREENFIELD_BUCKET`, `GREENFIELD_SP_ENDPOINT` | tidak | isi keempatnya atau kosongkan keempatnya |

`WEB_ORIGINS` kosong berarti layar `/live` di Vercel TIDAK bisa membaca API (CORS mati). Itu
disengaja untuk pengembangan lokal, dan penyebab paling mungkin kalau web memuat tapi graf kosong.

### 1.4 Layanan systemd

```bash
sudo cp /opt/nearly/deploy/nearly-api.service /etc/systemd/system/nearly-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now nearly-api
sudo systemctl status nearly-api --no-pager
curl -s http://localhost:8787/health          # {"ok":true}
journalctl -u nearly-api -n 50 --no-pager      # kalau gagal: env apa yang kurang?
```

### 1.5 Caddy dan DNS

1. Di pengelola DNS domainmu: rekaman **A** `api.<domain>` → `<vps>`. Tunggu sampai
   `dig +short api.<domain>` mengembalikan `<vps>`.
2. Pasang Caddyfile dan beri tahu Caddy nama host-nya:

```bash
sudo cp /opt/nearly/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl edit caddy
#   tambahkan di bagian yang dibuka editor:
#   [Service]
#   Environment=NEARLY_API_HOST=api.<domain>
sudo systemctl restart caddy
```

3. Verifikasi dari laptop, bukan dari VPS:

```bash
curl -s https://api.<domain>/health           # {"ok":true}
curl -s https://api.<domain>/graf/acara       # {"acara":[...]}
```

### 1.6 Memperbarui API

```bash
cd /opt/nearly
sudo -u nearly git pull
sudo -u nearly corepack pnpm install --frozen-lockfile
sudo systemctl restart nearly-api
```

---

## 2. Vercel — Web

1. Hubungkan repo di Vercel. **Root Directory:** `apps/web`. Framework preset: Vite.
2. **Build Command:** `pnpm build`. **Output Directory:** `dist`.
3. **Environment Variables:** `VITE_API_URL` = `https://api.<domain>` (Production dan Preview).
   `VITE_*` ikut terbundel ke browser — jangan pernah menaruh rahasia di sana.
4. Repo memakai `packageManager: pnpm@11.x`. Kalau build Vercel gagal karena versi pnpm, tambahkan
   env `ENABLE_EXPERIMENTAL_COREPACK` = `1` lalu deploy ulang.
5. Setelah deploy: tambahkan `https://<vercel-domain>` (dan domain kustom web bila ada) ke
   `WEB_ORIGINS` di `/etc/nearly/api.env`, lalu `sudo systemctl restart nearly-api`.
6. Buka `https://<vercel-domain>/` (landing) dan `https://<vercel-domain>/live` (graf seluruh jaringan).
   `vercel.json` menulis ulang semua path ke `index.html`, jadi memuat ulang `/live` tidak 404.

Periksa CORS dari laptop:

```bash
curl -s -D - -o /dev/null -H "Origin: https://<vercel-domain>" https://api.<domain>/graf/jaringan | grep -i access-control
# harus: access-control-allow-origin: https://<vercel-domain>
```

---

## 3. Aplikasi mobile

1. Di **`apps/mobile/.env`** (BUKAN `.env` di root repo): `EXPO_PUBLIC_API_URL=https://api.<domain>`.
2. Jalankan ulang Metro dengan cache bersih: `cd apps/mobile && npx expo start -c`.
3. Dengan domain HTTPS, HP tidak lagi bergantung pada IP Wi-Fi Mac — HP dan laptop boleh di jaringan berbeda.

---

## 4. H-1

1. **Saldo relayer.** Isi tBNB dompet relayer dari faucet BSC testnet. Setiap salaman, check-in,
   dan perubahan tier mengirim transaksi.
2. **CSV panitia & juri.** Format `address,catatan,bobot` (lihat `docs/demo/seed-inti-contoh.csv`).
   Catatan tanpa koma.
3. **Seed trusted core — uji coba dulu:**

```bash
cd /opt/nearly/apps/api
sudo -u nearly node --env-file=/etc/nearly/api.env --import=tsx tools/seed-inti.ts /path/panitia.csv
```

   Periksa daftar yang tercetak. Satu baris salah → tidak ada yang ditulis; perbaiki CSV dan ulangi.

4. **Seed trusted core — sungguhan:**

```bash
sudo -u nearly node --env-file=/etc/nearly/api.env --import=tsx tools/seed-inti.ts /path/panitia.csv --jalankan
```

   Hitung ulang berjalan satu kali dan dapat mengirim `setScore` untuk setiap tier yang berubah.
5. **Periksa hasil:** panitia bertier **Inti** di aplikasi; event `ScoreUpdated` terlihat di BscScan
   testnet pada kontrak `TrustAttestor`.
6. **Acara uji.** Buat acara lewat aplikasi dengan waktu mulai **sebelum sekarang** — pemilih acara
   di `/live` hanya menampilkan acara yang sudah mulai (atau berakhir ≤ 7 hari lalu). Jendela waktunya
   **tidak boleh beririsan** dengan acara hackathon: salaman di irisan dua acara yang sama-sama
   dihadiri hanya tampil di layar acara ber-`event_id` terkecil (spec §4.3 syarat 3).
7. **Check-in dan satu salaman** dengan dua HP di dalam venue uji.
8. **Laptop proyektor:** buka `https://<vercel-domain>/live?acara=<eventId>`, pastikan sisi baru
   menyala dalam ≤ 6 detik setelah salaman, lalu tekan **Fullscreen**.
9. **Rekam layar** graf selama uji ini — itulah rencana cadangan (bagian 6).

---

## 5. Hari-H

1. Buat acara hackathon lewat aplikasi (waktu mulai sebelum pintu dibuka).
2. Host menampilkan QR check-in di pintu.
3. Laptop proyektor: `https://<vercel-domain>/live?acara=<eventId>`, layar penuh.

**Daftar periksa bila graf tidak bergerak** — urut, berhenti di yang pertama gagal:

1. Pojok kanan bawah menampilkan **Reconnecting…**? → masalah jaringan laptop atau API.
2. `curl -s https://api.<domain>/health` → `{"ok":true}`? Kalau tidak:
   `sudo systemctl status nearly-api` dan `journalctl -u nearly-api -n 100`.
3. `curl -s "https://api.<domain>/graf/acara/<eventId>"` → `hitungan.salaman` naik setelah salaman?
   - Tidak naik, tapi salaman di HP berhasil → kedua orang sudah check-in di acara ini? Salaman
     dihitung untuk acara hanya bila **keduanya** check-in dan waktunya di dalam jendela acara.
   - Salaman di HP gagal → lihat pesan galat di HP.
4. Relayer masih bersaldo? Periksa saldo dompet relayer di BscScan testnet. Saldo habis = salaman
   dan check-in gagal dengan `chain_error`.
5. Satu orang tidak bisa bersalaman lagi → kuota koneksi harian (30 per orang per hari,
   `DAILY_CONNECTION_QUOTA` di `apps/api/src/handshake-gate.ts`) mungkin habis. Itu perilaku
   yang disengaja, bukan kerusakan.
6. Web memuat tapi graf kosong dan tidak ada **Reconnecting…** → buka DevTools; galat CORS berarti
   origin web belum ada di `WEB_ORIGINS`.

---

## 6. Rencana cadangan

Bila API atau jaringan venue gagal dan tidak pulih dalam beberapa menit: putar **rekaman layar graf
dari uji H-1** di proyektor dan jelaskan terus terang bahwa itu rekaman. Jangan menyajikan rekaman
sebagai siaran langsung.

---

## 7. Kerangka video pitch (±3 menit)

Pembuatan video di luar kode. Adegan:

1. **Masalah (0:00–0:30).** Koneksi palsu: pulang dari acara membawa puluhan username yang tak
   pernah ditindaklanjuti, dan tidak ada cara membedakan yang beneran dari yang omong kosong.
2. **Salaman QR (0:30–1:00).** Dua orang, dua HP, QR yang berganti tiap 30 detik, koneksi tercatat
   on-chain. Tidak ada tombol follow.
3. **Graf tumbuh di proyektor (1:00–1:45).** Layar `/live?acara=…`: sisi baru menyala saat orang
   bersalaman di ruangan.
4. **Trust dari graf (1:45–2:30).** Tier + bukti, bukan angka telanjang; kenapa gumpalan akun palsu
   tetap mendekati nol.
5. **Batas yang jujur (2:30–3:00).** Nearly membuktikan manusia hadir, bukan bahwa ia orang baik;
   sybil multi-perangkat dideteksi, belum dicegah.
````

- [ ] **Step 4: Verifikasi tidak ada nilai rahasia maupun nama env yang salah ketik**

Run: `grep -nE "=[^<[:space:]]" deploy/nearly-api.service | grep -vE "^[0-9]+:(Description|After|Wants|StartLimitIntervalSec|Type|User|Group|WorkingDirectory|ExecStart|Restart|RestartSec|NoNewPrivileges|PrivateTmp|ProtectSystem|WantedBy)="`
Expected: kosong.

Run: `grep -nE "(eyJ|sk_|0x[0-9a-fA-F]{64}|supabase\.co)" docs/demo/runbook.md deploy/Caddyfile deploy/nearly-api.service`
Expected: kosong.

Run: `for v in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RPC_URL MAINNET_RPC RELAYER_PRIVATE_KEY CONNECTION_REGISTRY_ADDRESS VOUCH_REGISTRY_ADDRESS TRUST_ATTESTOR_ADDRESS ATTENDANCE_REGISTRY_ADDRESS ADMIN_TOKEN; do grep -q "\"$v\"" apps/api/src/index.ts || echo "TIDAK ADA di index.ts: $v"; done`
Expected: kosong — setiap variabel wajib di tabel runbook memang dibaca `index.ts`.

- [ ] **Step 5: Commit**

```bash
git add deploy/nearly-api.service \
  deploy/Caddyfile \
  docs/demo/runbook.md
git commit -m "$(cat <<'EOF'
docs(demo): templat systemd + Caddy dan runbook deploy & hari-H

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Amandemen spec induk, verifikasi global, verifikasi batas

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: spec induk yang sesuai dengan spec Fase 6 §12; bukti verifikasi global.

- [ ] **Step 1: Amandemen spec induk (spec Fase 6 §12)**

Enam penyuntingan persis (1a–1f), masing-masing dengan string lama yang unik di berkas itu.

**1a — §10 pohon repo (spec 6 §12 butir 1).** Ganti

```text
│   └── web/             # Next.js — landing + halaman demo juri (visualisasi graf live)
```

dengan

```text
│   └── web/             # Vite + React — landing + layar /live (visualisasi graf live)
```

**1b — §10, paragraf baru tepat sebelum baris `### 10.1 Mobile`** (spec 6 §12 butir 1):

```markdown
**Amandemen Fase 6 (2026-09-14):** `apps/web` memakai **Vite + React + TypeScript, bukan Next.js**.
Landing page dan layar graf cukup berupa berkas statis yang memanggil API; tidak ada data yang harus
dirender di server, dan Vite menghasilkan satu folder statis untuk Vercel. Alasan lengkap: spec
`2026-09-14-nearly-fase-6-demo-design.md` R1.

```

**1c — §10, subbagian baru tepat sebelum baris `## 11. Fase Pembangunan`** (spec 6 §12 butir 2):

```markdown
### 10.5 Hosting (Fase 6)

- **API** berjalan di **VPS** sebagai layanan systemd (`deploy/nearly-api.service`), di belakang
  **Caddy** yang menyediakan HTTPS otomatis untuk `api.<domain>` (`deploy/Caddyfile`).
- **Web** (`apps/web`) di **Vercel** sebagai situs statis; alamat API lewat `VITE_API_URL`.
- **CORS hanya untuk `/graf/*`**, terbatas pada origin di env `WEB_ORIGINS`. Rute lain — salaman,
  pesan, feed, dan seterusnya — tidak pernah mendapat header CORS.
- Langkah lengkap: `docs/demo/runbook.md` (spec Fase 6 §8).

```

**1d — §11 Fase 6** (spec 6 §12 butir 3). Setelah baris

```text
*Selesai = graf tumbuh hidup di layar saat orang-orang bersalaman di ruangan.*
```

sisipkan satu baris kosong lalu:

```markdown
**Wujud Fase 6 (spec `2026-09-14-nearly-fase-6-demo-design.md`):** "event mode" adalah layar
`/live?acara=<eventId>` di laptop proyektor — tanpa perubahan aplikasi mobile; seed trusted core
lewat `apps/api/tools/seed-inti.ts`; video pitch dibuat di luar kode (kerangkanya di
`docs/demo/runbook.md`).
```

**1e — Peta fase** (spec 6 §12 butir 4). Setelah paragraf yang berakhir dengan baris

```text
untuk hidup sampai feed ada.
```

sisipkan satu baris kosong lalu:

```markdown
**Catatan (2026-09-14).** Fase 6 tuntas secara kode: API graf baca-saja, `apps/web` (landing + `/live`),
`seed-inti.ts`, dan templat deploy. Kesiapan demo bergantung pada runbook `docs/demo/runbook.md`
(spec Fase 6 §8) yang dijalankan pemilik project — VPS, Vercel, seed trusted core, dan uji lapangan.
```

**1f — §12** (spec 6 §12 butir 1). Ganti

```text
- `apps/web/src/app/live/page.tsx` — visualisasi graf untuk juri (react-force-graph).
```

dengan

```text
- `apps/web/src/pages/Live.tsx` — layar proyektor `/live` (`react-force-graph-2d`, Vite + React; spec Fase 6 R1, R2).
```

Verifikasi:

Run: `grep -n "Next.js\|app/live/page.tsx" docs/superpowers/specs/2026-09-03-nearly-design.md`
Expected: hanya baris paragraf amandemen 1b ("bukan Next.js"). Laporkan keluarannya apa adanya.

- [ ] **Step 2: Verifikasi global dan batas — laporkan setiap keluaran apa adanya**

Jalankan setiap perintah terpisah. Grep yang kosong keluar dengan status 1 — itu hasil yang diharapkan.

```bash
pnpm -r test
pnpm -r typecheck
pnpm --filter @nearly/web build
git diff --stat main...HEAD -- apps/mobile packages/shared packages/trust packages/contracts apps/api/src/trust supabase/migrations   # WAJIB kosong
git diff --stat main...HEAD -- apps/api/src/handshake-gate.ts apps/api/src/event-gate.ts apps/api/src/vouch-gate.ts apps/api/src/feed-gate.ts apps/api/src/meet-gate.ts apps/api/src/blokir-gate.ts apps/api/src/pesan-gate.ts apps/api/src/pesan-laporan.ts apps/api/src/routes/handshake.ts apps/api/src/routes/events.ts apps/api/src/routes/vouch.ts apps/api/src/routes/report.ts apps/api/src/routes/admin.ts apps/api/src/routes/feed.ts apps/api/src/routes/meet.ts apps/api/src/routes/blokir.ts apps/api/src/routes/pesan.ts   # WAJIB kosong
git diff --name-only main...HEAD -- packages/shared/src | wc -l                      # WAJIB 0 (tidak ada tipe EIP-712 baru)
grep -rn "hono/cors" apps/api/src                                                   # WAJIB kosong
grep -rn "loadGraph(\|createTrustStore" apps/api/src/graf.ts apps/api/src/graf-store.ts apps/api/src/routes/graf.ts   # WAJIB kosong
grep -rn "@nearly/shared\|@nearly/trust\|viem" apps/web/src apps/web/package.json    # WAJIB kosong
grep -rn "blocks" apps/api/src/graf.ts apps/api/src/graf-store.ts apps/api/src/routes/graf.ts   # WAJIB kosong
git status --short                                                                  # WAJIB hanya: M docs/superpowers/specs/2026-09-03-nearly-design.md
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "$(cat <<'EOF'
docs: amandemen spec induk — web Vite + React, hosting VPS + Vercel, wujud Fase 6

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Serahkan ke pemilik project** (dilakukan controller, bukan pelaksana)

1. **Tidak ada migrasi** yang perlu diterapkan dari branch ini.
2. Tinjau tabel **Paket baru** dan perubahan `pnpm-lock.yaml`, termasuk laporan Task 9 Step 2 tentang importer `apps/mobile`.
3. Jalur yang merge **kedua** (Fase 6 atau 4b + 5) melakukan rebase, menyelesaikan konflik `pnpm-lock.yaml` dengan `pnpm install` ulang, dan menjalankan ulang `pnpm -r test` serta `pnpm -r typecheck`. Konflik yang paling mungkin: akhir `ports.ts`, akhir `TrustDeps` dan `createApp` di `app.ts`, akhir objek `createApp({...})` di `index.ts`, akhir `depsFor` di `test/support/deps.ts` — ambil KEDUA sisi.
4. Pemilik project menjalankan `docs/demo/runbook.md` (VPS, Vercel, seed) dan uji lapangan spec §10:
   - API di VPS menjawab lewat HTTPS; web di Vercel memuat graf seluruh jaringan
   - Dua HP bersalaman di acara uji → sisi baru menyala di `/live?acara=…` dalam ≤ 6 detik
   - Ganti ke "Whole network" dan kembali → graf dimuat ulang tanpa galat
   - Matikan API sebentar → "Reconnecting…", graf tetap tampil, pulih sendiri
   - `seed-inti.ts` uji coba terhadap `docs/demo/seed-inti-contoh.csv` → keluaran sesuai, tanpa tulisan

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.

