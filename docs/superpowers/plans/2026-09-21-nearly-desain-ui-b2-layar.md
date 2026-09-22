# Desain UI Nearly — Rencana B2 (Migrasi Layar, Bagian 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menuntaskan desain ulang UI mobile: lebih dulu **perbaikan Minor review B1** (dengan **M3 — 12 kata tetap terbuka saat pindah tab** sebagai task pertama), lalu spec §9 langkah 5 **(d) Acara + Radar**, **(e) Pesan**, **(f) layar sisa** (Feed, Unggahan baru, Buat acara, QR check-in, Lapor, Mulai), **(g) sapuan bahasa** dengan `bahasa.test.ts`, dan **langkah 6** (amandemen dokumen + verifikasi). Di akhir rencana ini setiap layar di `app/` bertampilan baru dan berbahasa Inggris, dan penjaga tampilan/bahasa berlaku untuk seluruh pohon.

**Architecture:** Pola Rencana B1 dipertahankan: setiap layar yang dimigrasi ditulis ulang dengan salinan BNA + token, diterjemahkan di task yang sama, dan kuncinya masuk `LAYAR_TERMIGRASI` di task itu juga (Ruling B1-3). Teks **baru** per kelompok tinggal di modul murni `src/teks-acara.ts`, `src/teks-radar.ts`, `src/teks-pesan.ts`, `src/teks-feed.ts`, `src/teks-mulai.ts`; kalimat **lama** diterjemahkan di tempatnya (`src/messages.ts`, `src/gambar.ts`) bersama tesnya (Ruling B1-1). Kesegaran data lintas tab (review B1 M7) dipusatkan di `src/muat-fokus.ts` (generasi data) + `hooks/useMuatSaatFokus.ts`. Setelah layar terakhir dimigrasi, `LAYAR_TERMIGRASI` dan `KOMPONEN_BELUM_DIMIGRASI` dihapus: latar gelap menjadi bawaan `OPSI_STACK`, dan penjaga baca-kode berlaku untuk seluruh `app/`.

**Tech Stack:** pnpm monorepo · TypeScript strict (`noUncheckedIndexedAccess`) · Expo SDK 57 / expo-router 57.0.18 / React Native 0.86.3 (Expo Go) · salinan BNA UI di `components/ui/*` · lucide-react-native · `@expo-google-fonts/inter` + `@expo-google-fonts/jetbrains-mono` · `expo-clipboard` (sudah ada sejak B1) · TypeScript compiler API (`typescript` di `node_modules` akar, untuk `bahasa.test.ts`) · Vitest. **API tidak disentuh.**

**Spec:** `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md` (otoritas mengikat). **Rencana B1:** `docs/superpowers/plans/2026-09-19-nearly-desain-ui-b1-layar.md` — bagian "Serah terima ke Rencana B2" mendaftar antarmuka yang dipakai rencana ini. **Catatan Minor:** `docs/superpowers/plans/2026-09-21-catatan-minor-untuk-b2.md` (14 butir; nomor baris di sana berlaku di `5fe3fc5`, rencana ini sudah memeriksanya ulang di `069fa14`).

**Titik awal:** branch `desain-ui`, commit `069fa14` (worktree `/Users/mac/developer/nearly-desain`, PR #5).

## Global Constraints

### Keputusan terkunci yang dipakai rencana ini (spec §2, verbatim)

| # | Keputusan |
|---|---|
| 8 | **Peta layar:** … Acara (`events/index` → `events/[id]`, `radar/[eventId]`, `events/new`, `events/[id]/host-qr`); … Pesan (`pesan/index` → `pesan/[address]`, `pesan/lapor/[address]`); … Di luar tab: `mulai` (tanpa tab bar), `profile/[address]` dari mana saja. Ketuk notifikasi pesan → Pesan › Percakapan; radar → Acara › Radar. Tidak ada fitur hilang. |
| 10 | **Data baru:** … (c) "N koneksi bersama" di Radar untuk orang yang belum kamu temui — HANYA ANGKA tanpa nama …; (d) "hadir sejak <jam>" DIBUANG — cukup "hadir sekarang"; (e) "Kamu terlihat oleh N orang" DIGANTI "N orang terlihat di sini", dihitung dari kartu yang dikirim (`jumlah` yang ada); (f) batang trust BERTINGKAT per tier (4 ruas), bukan persentase — radar/profil tidak mengirim skor mentah. |
| 11 | **Pola layar lain:** daftar / formulir / detail; layar Mulai: logo "n" besar, kalimat "Kenali orang yang benar-benar kamu temui", tombol Buat dompet baru & Pakai dompet yang sudah ada. Empat keadaan seragam: memuat = skeleton; kosong = ikon + kalimat + aksi; galat = kalimat galat yang ada + Coba lagi; berhasil = toast hijau + haptic untuk aksi penting. |
| 12 | **Teks/kalimat, logika, dan perilaku layar yang ada TIDAK berubah** kecuali yang disebut di atas. *Diubah oleh #15:* kalimat yang ada **diterjemahkan 1:1 maknanya** ke bahasa Inggris — logika dan perilaku tetap, tidak ada penulisan ulang kalimat di luar terjemahan dan teks baru yang didaftar (§7.3). |
| 15 | **Bahasa aplikasi mobile: Inggris.** Istilah terkunci: Salaman → Handshake; Terlihat / Tersembunyi → Visible / Hidden; tier → New · Known · Trusted · Core; Vouch · Lapor · Blokir / Cabut blokir → Vouch · Report · Block / Unblock; Ingin bertemu / Saling ingin bertemu → Want to meet / You both want to meet; Koneksi · koneksi bersama → Connections · mutual connections; Dompet · 12 kata pemulihan → Wallet · 12-word recovery phrase; "N koneksi bersama" → "N mutual connections" (tunggal); "N orang terlihat di sini" → "N people visible here"; "hadir sekarang" → "here now"; kalimat Mulai → "Know the people you've actually met"; tombol Mulai → "Create a new wallet" / "Use an existing wallet"; tanggal "Aug 12"; jam 24 jam "19:42". |
| 16E | **Aksesibilitas & ergonomi** (§3.7): target sentuh ≥ 44×44 pt iOS / 48×48 dp Android; skala jarak 4/8/12/16/24/32; maks. 4 ukuran huruf per layar, bobot 400 dan 600 (700 hanya `heading`); teks ikut ukuran huruf sistem (label tab & lencana dibatasi 1,3×); Reduce Motion; safe area; `accessibilityLabel` untuk tombol ikon dan batang trust. |

- **R4.** Nama tampilan selalu didampingi alamat singkat (`0x12ab…cdef`, mono, redup) di setiap kartu orang — termasuk kartu Radar, daftar Pesan, kepala Percakapan, dan kartu Feed.
- **R5.** Terjemahan Inggris kalimat yang sudah ada **menang atas teks contoh di mockup**. Teks **baru** hanya yang didaftar di §7.3.
- **R6.** "Dibaca 19.42" di Percakapan **DIBUANG** — tidak ada tanda sudah dibaca untuk pengirim.
- **R10.** Isi tab yang berjalan terus dipasang hanya saat fokus (QR check-in host sudah memakai `useIsFocused` sejak Rencana A — dipertahankan).

**Spec §6.4 (Radar), §6.5 (Percakapan), §7.1–§7.3 mengikat;** kutipan persisnya ada di task yang memakainya.

### Nilai token yang mengikat (spec §3.1, §3.4, §3.7)

| Token | Nilai |
|---|---|
| `background` / `card` / `border` | `#07090f` / `#0f1420` / `#1d2638` |
| `text` / `textMuted` | `#e6edf7` / `#8a96ad` |
| `primary` / `primaryForeground` | `#f3ba2f` / `#07090f` |
| `verified` / `destructive` | `#37d6a8` / `#f06a6a` |
| `spandukLatar` / `spandukGaris` | `rgba(243,186,47,0.10)` / `rgba(243,186,47,0.40)` |

**Warna tidak pernah ditulis sebagai literal di luar `theme/colors.ts`** — selalu `useColor("<token>")` (dijaga `test/tema.test.ts`).

- Huruf: `heading` 30/700, `title` 18/600, `body` 15/400, `caption` 13/400 redup, `label` 11/600; `mono` JetBrains Mono 13/400 redup. Tidak ada `fontSize` literal di layar; penekanan di `body` memakai `style={{ fontWeight: "600" }}`.
- Jarak: **hanya** 4 / 8 / 12 / 16 / 24 / 32. Tepi layar 16, isi kartu 16, antarbutir 8–12, antarbagian 24–32.
- Target sentuh 48 (`UKURAN.sentuh`, `hitSlopSampai` dari `src/aksesibilitas.ts`, atau `components/tautan-kecil.tsx`); `maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}` hanya untuk label kecil (`variant="label"`) dan lencana.
- Radius: kartu/tombol/isian 8, gelembung pesan 12 dengan sudut pengirim 4 (`RADIUS.gelembung`, `RADIUS.gelembungSudut`), lencana/pil 5.
- Berhasil = `useKabar().berhasil(judul)` (toast + haptic Success) — **tidak pernah** `useToast()` langsung (Ruling B1-10).

### Batas jalur (spec §13 dipersempit untuk Rencana B2)

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` | **`apps/api/**` — API sudah selesai.** Bila sebuah layar tampak butuh perubahan API, **BERHENTI dan laporkan**. |
| `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md`, `docs/superpowers/specs/2026-09-03-nearly-design.md`, `docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md`, `docs/demo/runbook.md` — **hanya di Task 17** | `packages/**`, `apps/web/**`, `supabase/**` |
| `docs/superpowers/plans/2026-09-21-nearly-desain-ui-b2-layar.md` (hanya bila controller meminta koreksi) | `.env` mana pun — **dibaca pun tidak** |
| `pnpm-lock.yaml` — **tidak diharapkan berubah** (rencana ini tidak menambah dependensi) | spec lain selain tiga yang disebut di kiri |

**Komponen BNA baru: TIDAK ADA.** Bila sebuah layar ternyata butuh komponen BNA yang belum disalin, **berhenti dan laporkan dulu**.

### Batas keras eksekusi

- **JANGAN membaca, mencetak, atau menyunting `.env` mana pun.**
- **JANGAN menjalankan server di port 8787 atau 8081**: tidak `pnpm dev`, tidak `npx expo start`, tidak Metro, tidak simulator. Uji tampil di iPhone dilakukan pemilik project (Task 9 dan Task 18).
- **Verifikasi bundel** untuk task yang mengubah impor layar: `EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")` — Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`. Jangan menghapus direktori itu dengan `rm -r`.
- Dilarang `git reset --hard`, `git clean`, `rm -r`, force-push, `git commit --amend`, dan **push**. `rm` hanya untuk berkas tunggal yang disebut di langkah (lebih baik `git rm <berkas>`).
- Setiap commit memakai `git add` / `git rm` / `git mv` dengan **nama berkas eksplisit**, pesan commit berbahasa Indonesia yang diakhiri satu baris kosong lalu `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Kunci dompet dan 12 kata tidak pernah dicatat** ke log, konsol, atau laporan.
- **Signer tidak pernah dibuat di badan komponen**: pembungkus **hanya** memanggil `useNearlySigner`/`useDompet`, lalu `if (!signer) return null;` dan `return <XIsi key={signer.address} … />` (dijaga `test/dompet-tanpa-kunci-dev.test.ts`).
- **Impor tanpa ekstensi `.js`.** `src/**` **tidak pernah** mengimpor `@/…`; layar dan komponen mengimpor `@/components/…`, `@/hooks/…`, `@/theme/…` lewat alias dan `src/**` lewat jalur relatif. `hooks/**` mengimpor `src/**` lewat jalur relatif (`../src/…`).
- Setiap task berakhir dengan **`pnpm -r test` dan `pnpm -r typecheck` hijau**.
- **Protokol mutasi** (dijalankan SETELAH commit task): terapkan mutasi persis seperti tertulis → jalankan perintah tes yang disebut → **rekam nama tes yang merah** → kembalikan dengan `git checkout -- <berkas>` → jalankan ulang sampai hijau → `git status --short` kosong. Kalau mutasi TIDAK memerahkan tes yang disebut, laporkan — jangan menyetel tesnya sampai merah.
- Bila teks "lama" yang harus diganti di langkah Edit **tidak ditemukan persis**, **berhenti dan laporkan** isi berkas di sekitar tempat itu — jangan menebak.

### Konvensi repo

- Pengenal, komentar, dan judul `describe`/`it` **berbahasa Indonesia**; teks yang dilihat pengguna **berbahasa Inggris**. Judul tes tidak menyebut jumlah.
- Nama rute dan parameter tetap Indonesia; nilai kawat API tetap Indonesia (`tierLabel`, `visibilitas`, kode galat).
- Semua perintah dijalankan dari **akar worktree** `/Users/mac/developer/nearly-desain`. Tes mobile: `pnpm --filter @nearly/mobile exec vitest run <path>`; typecheck mobile: `pnpm --filter @nearly/mobile exec tsc --noEmit`.
- Tes mobile **hanya fungsi murni atau baca-kode** (tidak ada harness render RN).
- Setiap kalimat baru ditaruh di modul murni `src/` dan diuji vitest — **tidak pernah ditulis langsung di JSX**, termasuk penggabungan kalimat dengan `" · "` (spec §7.3).

---

## Pemetaan Spec / Catatan → Task

| Sumber | Isi | Task |
|---|---|---|
| Minor **M3** (keamanan) | 12 kata ditutup saat Dompet kehilangan fokus dan saat aplikasi tidak aktif | **1** |
| Minor M2, M5, M6, M9 | Profil orang: penjaga masuk ulang vouch/lapor, `Button` `minHeight`, target "Done", tes Meetings | 2 |
| Minor M1, M4, M10, M11, E2 | Kecocokan/Diblokir mempertahankan daftar + Try again, kepala Profil memakai nama tersimpan, hapus tes alias, chevron baris tautan | 3 |
| Minor M7, M8; spec §4.6 | Generasi data + `useMuatSaatFokus`; nama sheet per alamat | 4 |
| §6.4, §7.3, §7.4, §8.3, §8.4 | `src/teks-acara.ts`, `src/teks-radar.ts`, `src/events/daftar-acara.ts`, terjemahan kalimat acara/radar | 5 |
| §7.1 (daftar, detail), §7.2, §7.4 | `events/index`, `events/[id]` | 6 |
| §7.1 (formulir), §7.2, §4.6 | `events/new`, `events/[id]/host-qr` | 7 |
| §6.4, #10(c)(d)(e)(f) | `radar/[eventId]` | 8 |
| §10.3 butir 5, 7 + M3 | ⛔ **Gerbang STOP — uji iPhone pemilik** | 9 |
| §6.5, §7.3, §7.4 | `src/teks-pesan.ts`, terjemahan `PESAN_MESSAGES`, `labelKirimPesan`, `petunjukLaporan` | 10 |
| §6.5, §7.1, §7.2, R6 | `pesan/index`, `pesan/[address]` | 11 |
| §7.1 (formulir), §7.2 | `pesan/lapor/[address]` | 12 |
| §7.1, §7.2, §7.4 | `src/teks-feed.ts`, `feed/index`, `feed/new`, `src/gambar.ts` | 13 |
| §7.1 ("Mulai"), #11, #15 | `app/mulai.tsx`, hapus `src/warna.ts` | 14 |
| §9 langkah 5(f) akhir, §10.1 | Penjaga seluruh `app/`, hapus `LAYAR_TERMIGRASI` + `KOMPONEN_BELUM_DIMIGRASI` | 15 |
| §7.4, §9 langkah 5(g), §10.1 | Sapuan bahasa + `bahasa.test.ts` | 16 |
| §9 langkah 6, §15 | Amandemen spec + `docs/demo/runbook.md` | 17 |
| §9, §10.3, §13 | Verifikasi akhir, batas jalur, uji iPhone penuh | 18 |
| §4.2 keadaan galat gerbang | **Sudah** bertampilan baru dan berbahasa Inggris sejak Rencana A (`app/_layout.tsx`: `SafeAreaView`, `Text`/`Button` BNA, "Try again"), dijaga `gerbang-dompet.test.ts`; tercakup penjaga seluruh `app/` di Task 15. Tidak ada task sendiri. | — |

## Ruling (keputusan rencana di luar teks spec)

- **B2-1. M3 didahulukan dan ditutup di DUA pintu.** Tab tetap terpasang (expo-router 57), jadi 12 kata yang terbuka di Dompet tetap hidup saat pengguna pindah tab dan tetap ada di cuplikan app switcher iOS. Kata ditutup (a) di pembersih `useFocusEffect` dan (b) saat `AppState` meninggalkan `"active"` — **bukan hanya `"background"`**: iOS berpindah ke `"inactive"` lebih dulu saat app switcher dibuka, dan cuplikan diambil sebelum `"background"`. Harga yang diterima: menarik Control Center juga menutup kata. Selain itu `bukaKata` menolak membuka kata bila layar sudah tidak fokus atau aplikasi sudah tidak aktif saat `tampilkanMnemonik` selesai.
- **B2-2. M5 diperbaiki di salinan `Button`, bukan per layar.** Tombol bertinggi tetap terpotong di mana pun pada huruf besar; `minHeight` + teks `flexShrink: 1` membuatnya membungkus di semua layar sekaligus. Ukuran `icon` tetap persegi 48.
- **B2-3. Kesegaran lintas tab = generasi data + batas 30 detik yang hanya berlaku untuk pemuatan berhasil** (M7). `src/muat-fokus.ts` mendapat penghitung generasi modul (`tandaiDataBerubah()` / `generasiDataKini()`); layar yang memuat saat fokus memuat ulang bila generasi berubah walau belum 30 detik. Yang menaikkan generasi: salaman berhasil, check-in berhasil, acara dibuat. Logika fokus dipusatkan di `hooks/useMuatSaatFokus.ts` supaya Beranda, kepala Profil, daftar Acara, dan Detail acara tidak menulis ulang aturannya.
- **B2-4. Penjaga R14 di sheet menjadi perbandingan alamat SAAT RENDER** (M8): nama disimpan bersama alamat yang memintanya (`{ alamat, nama }`), dan `namaSheetUntuk(simpanan, hasil.initiator)` hanya mengembalikan nama bila alamatnya sama. Ini tetap "membandingkan alamat sebelum mengisi nama" (spec §10.1), tetapi terjangkau dan diuji sebagai fungsi murni; ref `alamatKini` yang praktis tak terjangkau dihapus.
- **B2-5. E1 (tombol "Copy address" di Dompet) dan E3 (konfirmasi sebelum Unblock) TIDAK dikerjakan.** Keduanya perilaku baru di luar spec (keputusan #12), dan E3 butuh kalimat dialog baru di luar §7.3. Dicatat sebagai pertanyaan untuk pemilik di laporan Task 18.
- **B2-6. "Event created." dan "Posted." adalah dua teks BARU yang diambil rencana ini.** Spec §7.2 mewajibkan toast untuk "acara dibuat" dan "unggahan terkirim", tetapi kedua layar hari ini tidak punya kalimat berhasil untuk diterjemahkan, dan §7.3 tidak mendaftarnya. Toast tanpa judul tidak mungkin; dua kata ini adalah padanan paling sempit dari nama aksinya. Dilaporkan ke pemilik di Task 18.
- **B2-7. "Laporan terkirim" di Lapor tetap `Alert.alert`** (bukan toast): kolom Aturan §7.2 menyebut dialog "laporan terkirim → blokir?" tetap dialog. Tidak ada toast tambahan di atasnya.
- **B2-8. `lencanaKartuRadar` menjadi `string | null`** dan hanya mengembalikan "You both want to meet": spec §6.4 menyebut "Pernah bertemu" digantikan lencana ✓ ringkas karena bagiannya sudah mengatakannya. Teksnya memakai `LENCANA_SALING_INGIN_BERTEMU` dari `src/teks-akun.ts` — satu kalimat untuk Kecocokan dan Radar.
- **B2-9. Kepala Percakapan dirender di dalam isi layar, bukan di header native.** Judul header tetap "Conversation" dari `JUDUL_LAYAR` (dipasang di layout — lihat `src/judul-layar.ts`); avatar + nama + alamat singkat + "🔒 end-to-end encrypted" + tombol ⋯ ada di baris pertama isi. Nama diambil dengan **satu** `GET /profile/:lawan` publik, pola yang sama dengan sheet salaman (R14); gagal → hanya alamat singkat.
- **B2-10. Menu ⋯ Percakapan adalah `Alert.alert` tiga tombol** (Report, Block, Cancel) berjudul nama atau alamat singkat lawan — dialog bawaan, tanpa komponen BNA baru dan tanpa kalimat baru.
- **B2-11. Pemisah hari di Percakapan memakai `formatTanggal`** ("Aug 12") — tanpa "Today"/"Yesterday", yang tidak ada di §7.3.
- **B2-12. Muat PERTAMA yang gagal di setiap layar B2 tampil sebagai `KeadaanGalat` + Try again; muat ulang yang gagal sesudahnya MEMPERTAHANKAN data yang sudah tampil** (pola #I3 B1, M1). Layar berpolling (Radar 10 dtk, Daftar Pesan 15 dtk, Percakapan 4 dtk) memasang ulang efek fokusnya lewat penghitung `percobaan` untuk Try again.
- **B2-13. Ikon keadaan kosong B2:** Acara → `CalendarDays`, Radar → `Radar` (diimpor sebagai `IkonRadar`), Pesan → `MessageCircle`, Feed → `FileText`, bukti Lapor → `MessageCircle`. Semuanya sudah diperiksa ada di `lucide-react-native` terpasang.
- **B2-14. Lokasi ditolak di Buat acara dan QR check-in memakai terjemahan kalimat yang sudah tampil hari ini** ("Izin lokasi ditolak" → "Location access was denied."), bukan kalimat Handshake `TEKS_IZIN_LOKASI` yang menyebut salaman. `Error.message` tetap tidak pernah dirender (review B1 #I1): kalimatnya dipilih lewat `e.name === "LocationDeniedError"`.
- **B2-15. `Input` salinan BNA tidak lagi memberi placeholder bawaan "Type your message..."** — isian berlabel di atasnya (pola formulir §7.1) tanpa placeholder akan menampilkan kalimat BNA yang bukan milik kita.
- **B2-16. `LAYAR_TERMIGRASI` dan `KOMPONEN_BELUM_DIMIGRASI` dihapus di Task 15**, bukan dibiarkan berisi semua kunci. Setelah semua layar dimigrasi keduanya tidak lagi membedakan apa pun; menyimpannya berarti menyimpan dua konsep "lama vs baru" yang sudah tidak ada.
- **B2-17. Mulai tanpa header** (spec §3.7 menyebut Mulai di antara layar tanpa header; §10.3 butir 9 "logo n"), dengan `SafeAreaView`. Judul "Get started" tetap di `JUDUL_LAYAR`.

---

## Struktur Berkas

| Berkas | Tanggung jawab | Task |
|---|---|---|
| `apps/mobile/src/dompet/tampil-kata.ts`, `test/dompet-kata.test.ts` | Kapan 12 kata harus ditutup (M3) | 1 |
| `apps/mobile/app/(tabs)/(profil)/dompet.tsx` | Menutup 12 kata saat fokus hilang / aplikasi tidak aktif | 1 |
| `apps/mobile/test/review-b1-minor.test.ts` | Penjaga baca-kode butir Minor | 2, 3, 4 |
| `apps/mobile/components/ui/button.tsx` | `minHeight`, teks membungkus (M5) | 2 |
| `apps/mobile/app/profile/[address].tsx`, `test/profil-orang.test.ts` | M2, M6, M9 | 2 |
| `apps/mobile/app/(tabs)/(profil)/{kecocokan,blokir,profil-saya}.tsx` | M1, M4, M11, E2 | 3 |
| `apps/mobile/src/muat-fokus.ts`, `hooks/useMuatSaatFokus.ts`, `test/muat-fokus.test.ts` | Generasi data + batas 30 detik (M7) | 4 |
| `apps/mobile/components/salaman/{sheet-bertemu,mode-pindai}.tsx`, `src/teks-salaman.ts` | M8; menandai data berubah setelah salaman/check-in | 4 |
| `apps/mobile/src/teks-acara.ts`, `src/teks-radar.ts`, `src/events/daftar-acara.ts`, tesnya | Teks + fungsi murni Acara/Radar | 5 |
| `apps/mobile/app/(tabs)/(acara)/events/{index,[id],new}.tsx`, `events/[id]/host-qr.tsx`, `test/acara.test.ts` | Layar Acara | 6, 7 |
| `apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx`, `test/radar.test.ts` | Layar Radar | 8 |
| `apps/mobile/src/teks-pesan.ts`, `test/teks-pesan.test.ts` | Teks Pesan | 10 |
| `apps/mobile/app/(tabs)/(pesan)/pesan/{index,[address]}.tsx`, `lapor/[address].tsx`, `test/pesan-layar.test.ts` | Layar Pesan | 11, 12 |
| `apps/mobile/src/teks-feed.ts`, `app/(tabs)/(beranda)/feed/{index,new}.tsx`, `test/feed-layar.test.ts` | Feed | 13 |
| `apps/mobile/src/teks-mulai.ts`, `app/mulai.tsx`, `test/mulai.test.ts` | Mulai | 14 |
| `apps/mobile/theme/navigasi.ts`, `src/judul-layar.ts`, `test/support/berkas.ts` | Penjaga seluruh `app/` | 14, 15 |
| `apps/mobile/test/bahasa.test.ts` | Penjaga bahasa (§7.4) | 16 |
| `docs/superpowers/specs/*` (tiga berkas), `docs/demo/runbook.md` | Amandemen + runbook | 17 |

---

## Task 1: M3 — 12 kata ditutup saat Dompet kehilangan fokus atau aplikasi tidak aktif

**Files:**
- Create: `apps/mobile/src/dompet/tampil-kata.ts`, `apps/mobile/test/dompet-kata.test.ts`
- Modify: `apps/mobile/app/(tabs)/(profil)/dompet.tsx`

**Interfaces:**
- Consumes: `useDompet()` (`tampilkanMnemonik`, dst. — tidak berubah), `kataBernomor` dari `src/dompet/teks-dompet.ts`.
- Produces: `kataHarusDitutup(keadaanApp: string): boolean` di `src/dompet/tampil-kata.ts`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/dompet-kata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kataHarusDitutup } from "../src/dompet/tampil-kata";
import { baca, tanpaKomentar } from "./support/berkas";

describe("kataHarusDitutup (review B1 M3)", () => {
  it("12 kata boleh terbuka hanya selagi aplikasi aktif", () => {
    expect(kataHarusDitutup("active")).toBe(false);
  });

  // iOS berpindah ke "inactive" saat app switcher dibuka, dan cuplikannya
  // diambil sebelum "background" — menunggu "background" sudah terlambat.
  it("keadaan selain active menutup kata, termasuk inactive", () => {
    for (const k of ["inactive", "background", "unknown", "extension"]) {
      expect(kataHarusDitutup(k), k).toBe(true);
    }
  });
});

describe("layar Dompet menutup 12 kata (review B1 M3)", () => {
  const isi = () => tanpaKomentar(baca("app/(tabs)/(profil)/dompet.tsx"));

  it("ditutup saat layar kehilangan fokus — tab tetap terpasang saat pindah tab", () => {
    expect(isi()).toMatch(
      /useFocusEffect\(useCallback\(\(\) => \{\s*fokus\.current = true;\s*return \(\) => \{\s*fokus\.current = false;\s*setKata\(null\);/,
    );
  });

  it("ditutup saat aplikasi meninggalkan keadaan aktif, dan langganannya dilepas", () => {
    const x = isi();
    expect(x).toMatch(/AppState\.addEventListener\("change", \(k\) => \{\s*if \(kataHarusDitutup\(k\)\) setKata\(null\);/);
    expect(x).toContain("return () => langganan.remove();");
  });

  it("kata yang selesai dibaca setelah layar ditinggalkan tidak dibuka", () => {
    const x = isi();
    const buka = x.slice(x.indexOf("const bukaKata = async"));
    const cek = buka.indexOf("if (!fokus.current || kataHarusDitutup(AppState.currentState)) return;");
    expect(cek).toBeGreaterThan(-1);
    expect(cek).toBeLessThan(buka.indexOf("setKata(kataBernomor(m));"));
  });

  it("hook dipanggil sebelum return awal (aturan hook React)", () => {
    const x = isi();
    const returnAwal = x.indexOf("if (address === null) return null;");
    expect(x.indexOf("useFocusEffect(")).toBeLessThan(returnAwal);
    expect(x.indexOf("AppState.addEventListener(")).toBeLessThan(returnAwal);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-kata.test.ts`
Expected: FAIL — modul `../src/dompet/tampil-kata` tidak ditemukan.

- [ ] **Step 3: Tulis fungsi murni**

Buat `apps/mobile/src/dompet/tampil-kata.ts`:

```ts
/**
 * 12 kata pemulihan hanya boleh terbuka selagi aplikasi AKTIF di depan
 * (review B1 M3). iOS berpindah ke "inactive" lebih dulu saat app switcher
 * dibuka, dan cuplikan layarnya diambil sebelum "background" — jadi menunggu
 * "background" berarti cuplikannya sudah memuat 12 kata. Harga yang diterima:
 * menarik Control Center juga menutup kata.
 *
 * Murni (tanpa impor react-native), supaya bisa diuji tanpa modul native.
 */
export function kataHarusDitutup(keadaanApp: string): boolean {
  return keadaanApp !== "active";
}
```

- [ ] **Step 4: Sunting layar Dompet**

Di `apps/mobile/app/(tabs)/(profil)/dompet.tsx`:

Ganti dua baris impor pertama:

```tsx
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
```

dengan:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, AppState, ScrollView, Share, StyleSheet, View } from "react-native";
```

Tambahkan impor sesudah baris `import { useDompet } from "../../../src/dompet/konteks-dompet";`:

```tsx
import { kataHarusDitutup } from "../../../src/dompet/tampil-kata";
```

Ganti:

```tsx
  const kabar = useKabar();

  // Sesaat setelah Ganti dompet, sebelum gerbang memindahkan ke layar Mulai.
  if (address === null) return null;
```

dengan:

```tsx
  const kabar = useKabar();
  const fokus = useRef(false);

  // 12 kata ditutup di DUA pintu (review B1 M3, Ruling B2-1): saat layar
  // kehilangan fokus — tab tetap terpasang saat pindah tab — dan saat aplikasi
  // meninggalkan keadaan aktif, sebelum iOS mengambil cuplikan app switcher.
  useFocusEffect(useCallback(() => {
    fokus.current = true;
    return () => {
      fokus.current = false;
      setKata(null);
    };
  }, []));

  useEffect(() => {
    const langganan = AppState.addEventListener("change", (k) => {
      if (kataHarusDitutup(k)) setKata(null);
    });
    return () => langganan.remove();
  }, []);

  // Sesaat setelah Ganti dompet, sebelum gerbang memindahkan ke layar Mulai.
  if (address === null) return null;
```

Ganti:

```tsx
      if (m === null) {
        setPesan(TEKS_TANPA_MNEMONIK);
        return;
      }
      setKata(kataBernomor(m));
```

dengan:

```tsx
      if (m === null) {
        setPesan(TEKS_TANPA_MNEMONIK);
        return;
      }
      // Pengguna bisa pindah tab atau keluar aplikasi selagi kata dibaca dari
      // penyimpan aman — kata tidak dibuka di layar yang sudah ditinggalkan.
      if (!fokus.current || kataHarusDitutup(AppState.currentState)) return;
      setKata(kataBernomor(m));
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-kata.test.ts test/dompet-blokir.test.ts`
Expected: PASS.

- [ ] **Step 6: Verifikasi penuh + bundel**

Run: `pnpm -r test && pnpm -r typecheck`, lalu perintah ekspor bundel dari "Batas keras eksekusi".
Expected: semua lulus; `Exported: …`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/dompet/tampil-kata.ts apps/mobile/test/dompet-kata.test.ts "apps/mobile/app/(tabs)/(profil)/dompet.tsx"
git commit -m "fix(mobile): 12 kata ditutup saat Dompet ditinggalkan atau aplikasi tidak aktif (review B1 M3)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi**

Di `dompet.tsx`, hapus baris `      setKata(null);` di dalam pembersih `useFocusEffect` (baris sesudah `fokus.current = false;`). Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-kata.test.ts`. Expected merah: `ditutup saat layar kehilangan fokus — tab tetap terpasang saat pindah tab`. Kembalikan dengan `git checkout -- "apps/mobile/app/(tabs)/(profil)/dompet.tsx"`.

---

## Task 2: Profil orang — ketukan ganda vouch/lapor, tombol membungkus, target "Done", tes Meetings (M2, M5, M6, M9)

**Files:**
- Create: `apps/mobile/test/review-b1-minor.test.ts`
- Modify: `apps/mobile/components/ui/button.tsx`, `apps/mobile/app/profile/[address].tsx`, `apps/mobile/test/profil-orang.test.ts`

**Interfaces:**
- Produces: `Button` salinan BNA dengan `minHeight` (ukuran `default`/`sm`/`lg`) dan teks yang membungkus — dipakai semua task berikutnya tanpa perubahan API komponen.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/review-b1-minor.test.ts`:

```ts
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts`
Expected: FAIL — ketiga `describe` merah (ref belum ada, `Button` masih `height`, gaya `selesai` belum ada).

- [ ] **Step 3: Sunting salinan `Button` (M5)**

Di `apps/mobile/components/ui/button.tsx`:

1. Tepat sebelum baris `export type ButtonVariant =`, sisipkan:

```tsx
// Isi tombol membungkus pada ukuran huruf besar alih-alih terpotong oleh
// tinggi tetap (review B1 M5, spec desain UI §3.7). maxWidth pada baris isi
// membuat teks di dalamnya punya lebar untuk menyusut.
const BARIS_ISI: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' };
const TEKS_MEMBUNGKUS: TextStyle = { flexShrink: 1, textAlign: 'center' };

```

2. Di `getButtonStyle`, ganti tiga penugasan ukuran:
   - `Object.assign(baseStyle, { height: HEIGHT, paddingHorizontal: 16 });` → `Object.assign(baseStyle, { minHeight: HEIGHT, paddingHorizontal: 16, paddingVertical: 8 });`
   - `Object.assign(baseStyle, { height: 54, paddingHorizontal: 36 });` → `Object.assign(baseStyle, { minHeight: 54, paddingHorizontal: 36, paddingVertical: 8 });`
   - `Object.assign(baseStyle, { height: HEIGHT, paddingHorizontal: 32 });` → `Object.assign(baseStyle, { minHeight: HEIGHT, paddingHorizontal: 32, paddingVertical: 8 });`

   Kasus `'icon'` (`height: HEIGHT, width: HEIGHT`) **tidak** diubah.

3. Di `getPressableStyle`, ganti:

```tsx
          ? {
              flex: flexValue,
              maxHeight: size === 'lg' ? 54 : HEIGHT,
            }
```

dengan:

```tsx
          ? { flex: flexValue }
```

4. Ganti **setiap** kemunculan `{ flexDirection: 'row', alignItems: 'center', gap: 6 }` yang dipakai sebagai nilai `style=` (tiga kemunculan: dua di jalur `Pressable`, satu di jalur `TouchableOpacity`) sehingga menjadi `style={BARIS_ISI}`. Bentuk yang ditemui ada dua:

```tsx
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
```

→

```tsx
            <View style={BARIS_ISI}>
```

dan

```tsx
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
```

→

```tsx
          <View style={BARIS_ISI}>
```

5. Ganti kedua kemunculan `style={[finalTextStyle, textStyle]}` menjadi `style={[finalTextStyle, TEKS_MEMBUNGKUS, textStyle]}`.

`TextStyle` dan `ViewStyle` sudah diimpor dari `react-native` di berkas ini (baris impor atas) — bila ternyata tidak, tambahkan ke impor yang sama.

- [ ] **Step 4: Sunting Profil orang (M2, M6)**

Di `apps/mobile/app/profile/[address].tsx`:

1. Tepat sesudah baris `  const scrollRef = useRef<ScrollView>(null);`, sisipkan:

```tsx
  // Penjaga SINKRON ketukan ganda (review B1 M2): dua ketukan dalam satu
  // frame sama-sama membaca `vouchBusy`/`reportBusy` lama dari closure yang
  // sama, lalu vouch kedua gagal "already vouched" di bawah toast berhasil.
  const vouchBerjalan = useRef(false);
  const laporBerjalan = useRef(false);
```

2. Ganti badan awal `handleVouch`:

```tsx
  async function handleVouch() {
    if (!signer || selectedTags.length === 0) return;
    setVouchBusy(true);
```

dengan:

```tsx
  async function handleVouch() {
    if (!signer || selectedTags.length === 0 || vouchBerjalan.current) return;
    vouchBerjalan.current = true;
    setVouchBusy(true);
```

dan di `finally` fungsi yang sama ganti:

```tsx
    } finally {
      setVouchBusy(false);
    }
```

dengan:

```tsx
    } finally {
      vouchBerjalan.current = false;
      setVouchBusy(false);
    }
```

3. Ganti badan awal `handleReport`:

```tsx
  async function handleReport() {
    if (!signer || !reportReason.trim()) return;
    setReportBusy(true);
```

dengan:

```tsx
  async function handleReport() {
    if (!signer || !reportReason.trim() || laporBerjalan.current) return;
    laporBerjalan.current = true;
    setReportBusy(true);
```

dan di `finally` fungsi yang sama ganti:

```tsx
    } finally {
      setReportBusy(false);
    }
```

dengan:

```tsx
    } finally {
      laporBerjalan.current = false;
      setReportBusy(false);
    }
```

4. Ganti tombol Done:

```tsx
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12} accessibilityRole="button">
```

dengan:

```tsx
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12} accessibilityRole="button" style={s.selesai}>
```

dan di `StyleSheet.create` tambahkan (sesudah `menyusut: { flexShrink: 1 },`):

```tsx
  // Target sentuh "Done" ≥ 48 tanpa membesarkan hurufnya (review B1 M6, §3.7).
  selesai: { minHeight: UKURAN.sentuh, justifyContent: "center" },
```

- [ ] **Step 5: Perbaiki tes Meetings yang selalu benar (M9)**

Di `apps/mobile/test/profil-orang.test.ts`, ganti isi `it("kartu Meetings hanya muncul bila pertemuan ada", …)`:

```ts
  it("kartu Meetings hanya muncul bila pertemuan ada", () => {
    const isi = profil();
    const kartu = isi.indexOf("{JUDUL_PERTEMUAN}");
    expect(kartu).toBeGreaterThan(-1);
    expect(isi.slice(0, kartu)).toMatch(/p\.pertemuan \?[\s\S]*$/);
    expect(isi).toContain("barisSalaman(p.pertemuan, kini)");
    expect(isi).toContain("barisAcaraBersama(a, kini)");
  });
```

dengan:

```ts
  it("kartu Meetings hanya muncul bila pertemuan ada", () => {
    const isi = profil();
    const kartu = isi.indexOf("{JUDUL_PERTEMUAN}");
    expect(kartu).toBeGreaterThan(-1);
    // Blok bersyarat yang MEMBUNGKUS kartu, bukan sembarang `p.pertemuan ?`
    // sebelumnya — lencana kepala sudah memuat `{p.pertemuan ? <Lencana`,
    // jadi asersi lama selalu benar (review B1 M9).
    const pembuka = isi.lastIndexOf("{p.pertemuan ? (", kartu);
    expect(pembuka).toBeGreaterThan(-1);
    const blok = isi.slice(pembuka, kartu);
    expect(blok).toContain("<Card");
    expect(blok).not.toContain(") : null}");
    expect(isi).toContain("barisSalaman(p.pertemuan, kini)");
    expect(isi).toContain("barisAcaraBersama(a, kini)");
  });
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts test/profil-orang.test.ts test/komponen.test.ts`
Expected: PASS.

- [ ] **Step 7: Verifikasi penuh + bundel**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel. Expected: lulus; `Exported: …`.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/test/review-b1-minor.test.ts apps/mobile/components/ui/button.tsx "apps/mobile/app/profile/[address].tsx" apps/mobile/test/profil-orang.test.ts
git commit -m "fix(mobile): Profil orang — ketukan ganda vouch/lapor, tombol membungkus, target Done (review B1 M2, M5, M6, M9)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi**

1. Di `app/profile/[address].tsx`, hapus ` || vouchBerjalan.current` dari syarat awal `handleVouch`. Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts`. Expected merah: `handleVouch dijaga ref vouchBerjalan …`. Kembalikan (`git checkout -- "apps/mobile/app/profile/[address].tsx"`).
2. Di `test/profil-orang.test.ts` tidak ada mutasi; sebagai gantinya, di `app/profile/[address].tsx` ganti `{p.pertemuan ? (` (pembuka kartu Meetings) menjadi `{true ? (` dan jalankan `vitest run test/profil-orang.test.ts` — Expected merah: `kartu Meetings hanya muncul bila pertemuan ada` (TypeScript tidak dijalankan vitest, jadi mutasi ini hanya menguji tesnya). Kembalikan.

---

## Task 3: Grup Profil — daftar dipertahankan saat muat ulang gagal, kepala memakai nama tersimpan, chevron, tes alias (M1, M4, M10, M11, E2)

**Files:**
- Modify: `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`, `apps/mobile/app/(tabs)/(profil)/blokir.tsx`, `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`, `apps/mobile/test/review-b1-minor.test.ts`
- Delete: `apps/mobile/test/dompet-blokir-layar.test.ts`, `apps/mobile/test/koneksi-kecocokan.test.ts`

**Interfaces:**
- Consumes: `KeadaanGalat`, `KeadaanKosong`, `KerangkaDaftar` dari `components/keadaan.tsx`; `potong` dari `test/review-b1-minor.test.ts` (Task 2).

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/review-b1-minor.test.ts`:

```ts
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts`
Expected: FAIL — tiga `describe` baru merah.

- [ ] **Step 3: Sunting Kecocokan (M1)**

Di `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`:

1. Ubah impor keadaan menjadi:

```tsx
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
```

2. Di `muat`, ganti blok `catch`:

```tsx
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_KECOCOKAN);
    }
```

dengan:

```tsx
    } catch (e) {
      // Baris yang sudah tampil DIPERTAHANKAN (review B1 M1, spec §7.2): muat
      // ulang saat fokus yang gagal tidak boleh membuat kecocokanmu hilang.
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_KECOCOKAN);
    }
```

3. Ganti blok render keadaan memuat:

```tsx
  if (baris === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }
```

dengan:

```tsx
  if (baris === null) {
    return (
      <View style={s.muat}>
        {pesan ? (
          <KeadaanGalat kalimat={pesan} onCobaLagi={() => void muat()} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }
```

4. Ganti:

```tsx
      ListHeaderComponent={pesan ? <Text variant="caption">{pesan}</Text> : null}
```

dengan:

```tsx
      ListHeaderComponent={pesan ? <KeadaanGalat kalimat={pesan} onCobaLagi={() => void muat()} /> : null}
```

5. Bila `Text` tidak lagi dipakai di berkas ini (`grep -n "<Text" "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx"` kosong), hapus baris `import { Text } from "@/components/ui/text";`.

- [ ] **Step 4: Sunting Diblokir (M1)**

Di `apps/mobile/app/(tabs)/(profil)/blokir.tsx`:

1. Ubah impor keadaan menjadi `import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";`.

2. Sesudah `const [sibuk, setSibuk] = useState<string | null>(null);` tambahkan:

```tsx
  // Galat MUAT terpisah dari pesan AKSI: "Try again" memuat ulang daftar, jadi
  // ia tidak boleh muncul di bawah kegagalan mencabut blokir.
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
```

3. Di `muat`, ganti `    setPesan(null);` menjadi `    setGalatMuat(null);` (muat yang berhasil membersihkan galat muat; pesan aksi dibersihkan oleh `cabut` sendiri).

4. Ganti seluruh blok pemicu fokus:

```tsx
  // SATU pemicu. `useFocusEffect` sudah menyala saat layar pertama kali fokus.
  // Galat dari `muat` ditangani DI SINI, bukan di dalam `muat`, supaya muat
  // pertama yang gagal mengosongkan daftar dan menampilkan pesan galat — beda
  // dengan reload di dalam `cabut`, yang tidak boleh mengosongkan daftar yang
  // barusan berhasil diperbarui aksinya.
  useFocusEffect(useCallback(() => {
    muat().catch((e) => {
      setBaris([]);
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : TEKS_GAGAL_MUAT_BLOKIR);
    });
  }, [muat]));
```

dengan:

```tsx
  // Galat dari `muat` ditangani DI SINI, bukan di dalam `muat`: reload di
  // dalam `cabut` punya arti kegagalannya sendiri. Baris yang sudah tampil
  // DIPERTAHANKAN (review B1 M1, spec §7.2).
  const muatDenganGalat = useCallback(() => {
    return muat().catch((e: unknown) => {
      setGalatMuat(e instanceof ApiError ? blokirErrorMessage(e.code) : TEKS_GAGAL_MUAT_BLOKIR);
    });
  }, [muat]);

  // SATU pemicu. `useFocusEffect` sudah menyala saat layar pertama kali fokus.
  useFocusEffect(useCallback(() => { void muatDenganGalat(); }, [muatDenganGalat]));
```

5. Ganti blok render memuat:

```tsx
  if (baris === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }
```

dengan:

```tsx
  if (baris === null) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatDenganGalat()} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }
```

6. Ganti:

```tsx
      ListHeaderComponent={pesan ? <Text variant="caption">{pesan}</Text> : null}
      ListEmptyComponent={
        // Kalau `pesan` terisi, daftar kosong ini BUKAN berarti "kamu tidak
        // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
        // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
        // pengguna.
        pesan ? null : (
```

dengan:

```tsx
      ListHeaderComponent={
        galatMuat || pesan ? (
          <View style={s.kepala}>
            {galatMuat ? <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatDenganGalat()} /> : null}
            {pesan ? <Text variant="caption">{pesan}</Text> : null}
          </View>
        ) : null
      }
      ListEmptyComponent={
        // Kalau `galatMuat` terisi, daftar kosong ini BUKAN berarti "kamu tidak
        // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
        // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
        // pengguna.
        galatMuat ? null : (
```

7. Di `StyleSheet.create` tambahkan `kepala: { gap: 8 },`.

- [ ] **Step 5: Sunting Profil (tab) (M4, E2)**

Di `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`:

1. Tambahkan impor ikon sesudah baris `import { Pressable, ScrollView, StyleSheet, View } from "react-native";`:

```tsx
import { ChevronRight } from "lucide-react-native";
```

2. Ganti fungsi `BarisTautan` seluruhnya dengan:

```tsx
/** Satu baris tautan di daftar bawah, setinggi target sentuh (spec §3.7). */
function BarisTautan({
  label,
  lencana,
  onPress,
}: {
  label: string;
  lencana?: string | null;
  onPress: () => void;
}) {
  const redup = useColor("textMuted");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.tautan}>
      {/* Label panjang ("Address, 12-word recovery phrase, …") membungkus,
          tidak mendorong chevron keluar kartu. */}
      <Text variant="body" style={[s.tebal, s.menyusut]}>{label}</Text>
      <View style={s.ujungTautan}>
        {lencana ? <Lencana varian="teks" teks={lencana} /> : null}
        {/* Tanda baris navigasi (catatan eksekutor B1 E2); dekoratif. */}
        <ChevronRight color={redup} size={20} />
      </View>
    </Pressable>
  );
}
```

3. Sesudah `const [nama, setNama] = useState("");` tambahkan:

```tsx
  // Nama yang TERSIMPAN di server, terpisah dari isian (review B1 M4): kepala
  // tidak ikut berubah selagi nama diketik, dan tidak mengaku "Unnamed" saat
  // profilnya gagal dimuat. null = belum diketahui atau kosong.
  const [namaTersimpan, setNamaTersimpan] = useState<string | null>(null);
```

4. Di `muatProfil`, sesudah `      setNama(p.displayName);` tambahkan `      setNamaTersimpan(p.displayName.trim() || null);`.

5. Di `simpan`, sesudah `      setNama(cek.nama);` tambahkan `      setNamaTersimpan(cek.nama.trim() || null);`.

6. Di kepala, ganti `        <Text variant="title">{namaKartuRadar(nama)}</Text>` dengan:

```tsx
        {namaTersimpan ? <Text variant="title">{namaTersimpan}</Text> : null}
```

7. Hapus `namaKartuRadar, ` dari impor `../../../src/messages` bila tidak ada pemakaian lain (`grep -n "namaKartuRadar" "apps/mobile/app/(tabs)/(profil)/profil-saya.tsx"` hanya menyisakan baris impor).

8. Di `StyleSheet.create` tambahkan:

```tsx
  menyusut: { flexShrink: 1 },
  ujungTautan: { flexDirection: "row", alignItems: "center", gap: 8 },
```

- [ ] **Step 6: Hapus tes alias yang menggandakan suite (M10)**

Kedua berkas hanya `import` berkas tes lain sehingga suite yang sama berjalan dua kali.

```bash
git rm apps/mobile/test/dompet-blokir-layar.test.ts apps/mobile/test/koneksi-kecocokan.test.ts
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts test/review-b1.test.ts test/daftar-profil.test.ts test/dompet-blokir.test.ts test/profil-saya.test.ts`
Expected: PASS. (Bila salah satu asersi lama di `review-b1.test.ts` atau `daftar-profil.test.ts` mengharapkan `setBaris([])` atau `{namaKartuRadar(nama)}`, **berhenti dan laporkan** asersinya — jangan mengubahnya tanpa persetujuan controller.)

- [ ] **Step 8: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx" "apps/mobile/app/(tabs)/(profil)/blokir.tsx" "apps/mobile/app/(tabs)/(profil)/profil-saya.tsx" apps/mobile/test/review-b1-minor.test.ts
git commit -m "fix(mobile): Kecocokan/Diblokir mempertahankan daftar saat muat ulang gagal; kepala Profil memakai nama tersimpan (review B1 M1, M4, M10, M11, E2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Penghapusan dua berkas alias sudah ter-stage oleh `git rm` di Step 6.)

- [ ] **Step 9: Mutasi**

Di `kecocokan.tsx`, tambahkan kembali `      setBaris([]);` sebagai baris pertama blok `catch` di `muat`. Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts`. Expected merah: `catch memuat galat tanpa membuang baris yang sudah tampil`. Kembalikan.

---

## Task 4: Kesegaran lintas tab dan nama sheet per alamat (M7, M8)

**Files:**
- Create: `apps/mobile/hooks/useMuatSaatFokus.ts`
- Modify: `apps/mobile/src/muat-fokus.ts`, `apps/mobile/test/muat-fokus.test.ts`, `apps/mobile/app/(tabs)/(beranda)/index.tsx`, `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`, `apps/mobile/components/salaman/mode-pindai.tsx`, `apps/mobile/components/salaman/sheet-bertemu.tsx`, `apps/mobile/src/teks-salaman.ts`, `apps/mobile/test/teks-salaman.test.ts`, `apps/mobile/test/salaman.test.ts`, `apps/mobile/test/beranda.test.ts`, `apps/mobile/test/review-b1.test.ts`, `apps/mobile/test/review-b1-minor.test.ts`

**Interfaces:**
- Produces (`src/muat-fokus.ts`): `tandaiDataBerubah(): void`, `generasiDataKini(): number`, `perluMuatUlang(terakhirMs: number | null, generasiDimuat: number | null, sekarangMs: number, generasiKini: number): boolean`. `bolehMuatFokus` dan `JEDA_MUAT_FOKUS_MS` tetap.
- Produces (`hooks/useMuatSaatFokus.ts`): `useMuatSaatFokus(muat: () => Promise<boolean>): void` — memanggil `muat` saat fokus bila `perluMuatUlang`; `muat` mengembalikan `true` bila SEMUA bagiannya berhasil. **Dipakai Task 6 (daftar dan Detail acara).**
- Produces (`src/teks-salaman.ts`): `type SimpananNama = { alamat: string; nama: string | null }`, `namaSheetUntuk(simpanan: SimpananNama | null, alamat: string): string | null`.

- [ ] **Step 1: Tulis tes fungsi murni yang gagal**

Tambahkan di akhir `apps/mobile/test/muat-fokus.test.ts` (dan tambahkan `generasiDataKini, perluMuatUlang, tandaiDataBerubah` ke impor `../src/muat-fokus` di atasnya):

```ts
describe("perluMuatUlang (review B1 M7)", () => {
  it("layar yang belum pernah memuat selalu memuat", () => {
    expect(perluMuatUlang(null, null, 1_000, 0)).toBe(true);
  });

  it("dalam 30 detik dengan generasi yang sama tidak memuat", () => {
    expect(perluMuatUlang(1_000, 0, 1_000 + JEDA_MUAT_FOKUS_MS - 1, 0)).toBe(false);
  });

  it("data yang berubah (salaman, check-in, acara dibuat) memuat walau belum 30 detik", () => {
    expect(perluMuatUlang(1_000, 0, 1_001, 1)).toBe(true);
  });

  it("lewat 30 detik memuat", () => {
    expect(perluMuatUlang(1_000, 0, 1_000 + JEDA_MUAT_FOKUS_MS, 0)).toBe(true);
  });
});

describe("generasi data", () => {
  it("tandaiDataBerubah menaikkan generasi tepat satu", () => {
    const awal = generasiDataKini();
    tandaiDataBerubah();
    expect(generasiDataKini()).toBe(awal + 1);
  });
});
```

Tambahkan di akhir `apps/mobile/test/teks-salaman.test.ts` (dan `namaSheetUntuk` ke impor `../src/teks-salaman`):

```ts
describe("namaSheetUntuk (R14, review B1 M8)", () => {
  const A = "0x9bE5aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6ffA";
  const B = "0x1111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2222";

  it("belum ada jawaban → tanpa nama", () => {
    expect(namaSheetUntuk(null, A)).toBeNull();
  });

  it("jawaban untuk alamat yang sama dipakai, tanpa peka huruf besar", () => {
    expect(namaSheetUntuk({ alamat: A.toLowerCase(), nama: "Rina" }, A)).toBe("Rina");
  });

  it("jawaban untuk pindaian lain dibuang", () => {
    expect(namaSheetUntuk({ alamat: B, nama: "Rina" }, A)).toBeNull();
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/muat-fokus.test.ts test/teks-salaman.test.ts`
Expected: FAIL — fungsi belum ada.

- [ ] **Step 2: Tulis fungsi murni**

Tambahkan di akhir `apps/mobile/src/muat-fokus.ts`:

```ts
/**
 * Generasi data milik pengguna ini (review B1 M7, Ruling B2-3). Naik setiap
 * kali aksi mengubah data yang ditampilkan tab LAIN — salaman, check-in,
 * acara dibuat — supaya layar itu memuat ulang saat difokuskan walau belum
 * 30 detik. Status modul, bukan konteks React: pemanggilnya komponen di tab
 * yang berbeda, dan nilainya hanya dibaca saat fokus.
 */
let generasiData = 0;

export function tandaiDataBerubah(): void {
  generasiData += 1;
}

export function generasiDataKini(): number {
  return generasiData;
}

/** Murni. `generasiDimuat` null = layar belum pernah memuat. */
export function perluMuatUlang(
  terakhirMs: number | null,
  generasiDimuat: number | null,
  sekarangMs: number,
  generasiKini: number,
): boolean {
  return generasiDimuat !== generasiKini || bolehMuatFokus(terakhirMs, sekarangMs);
}
```

Tambahkan di akhir `apps/mobile/src/teks-salaman.ts`:

```ts
/** Nama dari GET /profile publik, bersama alamat yang MEMINTANYA (R14). */
export type SimpananNama = { alamat: string; nama: string | null };

/**
 * R14: jawaban yang datang untuk pindaian lain dibuang — alamatnya dibandingkan
 * saat render, jadi sheet pindaian kedua tidak pernah memakai nama orang
 * pertama (review B1 M8, Ruling B2-4).
 */
export function namaSheetUntuk(simpanan: SimpananNama | null, alamat: string): string | null {
  return simpanan !== null && simpanan.alamat.toLowerCase() === alamat.toLowerCase() ? simpanan.nama : null;
}
```

Run lagi perintah Step 1. Expected: PASS.

- [ ] **Step 3: Tulis hook**

Buat `apps/mobile/hooks/useMuatSaatFokus.ts`:

```ts
import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { generasiDataKini, perluMuatUlang } from "../src/muat-fokus";

/**
 * Memuat saat layar tab fokus (spec desain UI §4.6): paling sering sekali per
 * 30 detik, KECUALI data berubah di tab lain (generasi naik) atau pemuatan
 * sebelumnya gagal (review B1 M7, Ruling B2-3). `muat` mengembalikan `true`
 * hanya bila SEMUA bagiannya berhasil.
 */
export function useMuatSaatFokus(muat: () => Promise<boolean>): void {
  const terakhir = useRef<number | null>(null);
  const generasiDimuat = useRef<number | null>(null);

  useFocusEffect(useCallback(() => {
    const kini = Date.now();
    const generasi = generasiDataKini();
    if (!perluMuatUlang(terakhir.current, generasiDimuat.current, kini, generasi)) return;
    terakhir.current = kini;
    generasiDimuat.current = generasi;
    void muat().then((berhasil) => {
      // Batas 30 detik hanya untuk pemuatan yang BERHASIL: tanpa ini, satu
      // kegagalan jaringan membuat layar basi 30 detik penuh.
      if (!berhasil && terakhir.current === kini) terakhir.current = null;
    });
  }, [muat]));
}
```

- [ ] **Step 4: Tulis tes baca-kode yang gagal**

Tambahkan di akhir `apps/mobile/test/review-b1-minor.test.ts`:

```ts
describe("kesegaran lintas tab (M7, Ruling B2-3)", () => {
  it("useMuatSaatFokus membatasi lewat perluMuatUlang dan melepas batas bila muat gagal", () => {
    const x = tanpaKomentar(baca("hooks/useMuatSaatFokus.ts"));
    expect(x).toContain("perluMuatUlang(terakhir.current, generasiDimuat.current, kini, generasi)");
    expect(x).toContain("if (!berhasil && terakhir.current === kini) terakhir.current = null;");
  });

  it("Beranda memuat keempat bagian lewat useMuatSaatFokus, dan setiap bagian melapor berhasil/gagal", () => {
    const x = tanpaKomentar(baca("app/(tabs)/(beranda)/index.tsx"));
    expect(x).toContain("useMuatSaatFokus(muatSemua);");
    expect(x).toMatch(/const hasil = await Promise\.all\(\[muatNama\(\), muatLive\(\), muatKoneksi\(\), muatFeed\(\)\]\);\s*return hasil\.every\(Boolean\);/);
    for (const nama of ["muatNama", "muatLive", "muatKoneksi", "muatFeed"]) {
      const badan = potong(x, `const ${nama} = useCallback(async () => {`, "}, [");
      expect(badan, nama).toContain("return true;");
      expect(badan, nama).toContain("return false;");
    }
    expect(x).not.toContain("bolehMuatFokus(");
  });

  it("kepala Profil (tab) memuat lewat useMuatSaatFokus", () => {
    const x = tanpaKomentar(baca("app/(tabs)/(profil)/profil-saya.tsx"));
    expect(x).toContain("useMuatSaatFokus(muatKepala);");
    expect(x).not.toContain("bolehMuatFokus(");
  });

  it("salaman dan check-in yang berhasil menandai data berubah", () => {
    const x = tanpaKomentar(baca("components/salaman/mode-pindai.tsx"));
    const checkIn = potong(x, "await postCheckIn(", "kabar.berhasil(");
    expect(checkIn).toContain("tandaiDataBerubah();");
    const salaman = potong(x, "await postAccept(", "setHasil(");
    expect(salaman).toContain("tandaiDataBerubah();");
  });
});

describe("sheet salaman: nama per alamat (M8, R14)", () => {
  it("jawaban disimpan bersama alamat pemintanya dan dibandingkan saat render; ref lama dihapus", () => {
    const x = tanpaKomentar(baca("components/salaman/sheet-bertemu.tsx"));
    expect(x).toContain("const nama = namaSheetUntuk(simpananNama, hasil.initiator);");
    expect(x).toContain("if (aktif) setSimpananNama({ alamat: untuk, nama: p.displayName ?? null });");
    expect(x).not.toContain("alamatKini");
    expect(x).not.toContain("terpasang");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts`
Expected: FAIL — dua `describe` baru merah.

- [ ] **Step 5: Sunting Beranda**

Di `apps/mobile/app/(tabs)/(beranda)/index.tsx`:

1. `muatNama`: di akhir blok `try` (sesudah `setNama(...)`) tambahkan `      return true;`; ganti blok `catch { … }` menjadi:

```tsx
    } catch {
      // Nama bukan identitas; tanpa nama, alamatnya tetap tampil (spec §9.2).
      return false;
    }
```

2. `muatLive`: sesudah `      setLive(rinci);` tambahkan `      return true;`; ganti blok `catch` luar:

```tsx
    } catch {
      setLive([]);
    }
```

dengan:

```tsx
    } catch {
      setLive([]);
      return false;
    }
```

(Blok `catch` DALAM per acara — "Tanpa bukti, kartunya tetap tampil" — **tidak** diubah: itu bukan kegagalan bagian.)

3. `muatKoneksi`: sesudah `      setKoneksi(kartu);` tambahkan `      return true;`; di blok `catch`-nya, sesudah `      setGalatKoneksi(true);` tambahkan `      return false;`.

4. `muatFeed`: sesudah pemanggilan `setFeed(posts.slice(…))` di dalam `try` tambahkan `      return true;`; ganti:

```tsx
    } catch {
      setFeed([]);
    }
```

dengan:

```tsx
    } catch {
      setFeed([]);
      return false;
    }
```

5. Ganti blok fokus:

```tsx
  // Memuat saat fokus, paling sering sekali per 30 detik (spec §4.6) — setara
  // "satu tanda tangan per pembukaan beranda" hari ini.
  const terakhir = useRef<number | null>(null);
  useFocusEffect(useCallback(() => {
    const kini = Date.now();
    if (!bolehMuatFokus(terakhir.current, kini)) return;
    terakhir.current = kini;
    void muatNama();
    void muatLive();
    void muatKoneksi();
    void muatFeed();
  }, [muatNama, muatLive, muatKoneksi, muatFeed]));
```

dengan:

```tsx
  // Memuat saat fokus, paling sering sekali per 30 detik (spec §4.6) — setara
  // "satu tanda tangan per pembukaan beranda" hari ini — kecuali data berubah
  // (salaman, check-in) atau pemuatan sebelumnya gagal (review B1 M7).
  const muatSemua = useCallback(async () => {
    const hasil = await Promise.all([muatNama(), muatLive(), muatKoneksi(), muatFeed()]);
    return hasil.every(Boolean);
  }, [muatNama, muatLive, muatKoneksi, muatFeed]);
  useMuatSaatFokus(muatSemua);
```

6. Tambahkan impor `import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";` sesudah `import { useKabar } from "@/hooks/useKabar";`. Hapus impor `bolehMuatFokus` dari `../../../src/muat-fokus` (hapus seluruh baris impor bila hanya itu isinya). Hapus `useFocusEffect` dari impor `expo-router` dan `useRef` dari impor `react` **hanya bila** `grep -n "useFocusEffect\|useRef" "apps/mobile/app/(tabs)/(beranda)/index.tsx"` tidak menemukan pemakaian lain.

- [ ] **Step 6: Sunting kepala Profil (tab)**

Di `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`, ganti:

```tsx
  const muatKepala = useCallback(() => {
    req<{ connectionCount: number }>(`/profile/${signer.address}`)
      .then((p) => setKoneksi(p.connectionCount))
      .catch(() => {});
    fetchTrust(signer.address).then(setTrust).catch(() => {});
  }, [signer.address]);

  // Tab tetap terpasang (expo-router 57): tanpa ini angka koneksi dan tier
  // tidak pernah berubah setelah salaman atau vouch. Dibatasi sekali per 30
  // detik, sama dengan Beranda (spec §4.6).
  const terakhir = useRef<number | null>(null);
  useFocusEffect(useCallback(() => {
    const kini = Date.now();
    if (!bolehMuatFokus(terakhir.current, kini)) return;
    terakhir.current = kini;
    void muatKepala();
  }, [muatKepala]));
```

dengan:

```tsx
  const muatKepala = useCallback(async () => {
    const [koneksiOk, trustOk] = await Promise.all([
      req<{ connectionCount: number }>(`/profile/${signer.address}`)
        .then((p) => { setKoneksi(p.connectionCount); return true; })
        .catch(() => false),
      fetchTrust(signer.address)
        .then((t) => { setTrust(t); return true; })
        .catch(() => false),
    ]);
    return koneksiOk && trustOk;
  }, [signer.address]);

  // Tab tetap terpasang (expo-router 57): tanpa ini angka koneksi dan tier
  // tidak pernah berubah setelah salaman atau vouch. Dibatasi sekali per 30
  // detik, kecuali data berubah atau muat sebelumnya gagal (spec §4.6, M7).
  useMuatSaatFokus(muatKepala);
```

Tambahkan impor `import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";` sesudah `import { useKabar } from "@/hooks/useKabar";`; hapus impor `bolehMuatFokus`; hapus `useFocusEffect` dari impor `expo-router` dan `useRef` dari impor `react` bila tidak ada pemakaian lain (periksa dengan `grep`).

- [ ] **Step 7: Tandai data berubah di mode Pindai**

Di `apps/mobile/components/salaman/mode-pindai.tsx`:

1. Tambahkan impor: `import { tandaiDataBerubah } from "../../src/muat-fokus";`
2. Ganti:

```tsx
          setResult(teksCheckInBerhasil(txHash));
          kabar.berhasil(teksCheckInBerhasil(txHash));
```

dengan:

```tsx
          // Kartu LIVE Beranda dan Detail acara memuat ulang "You're checked in"
          // saat difokuskan, walau belum 30 detik (review B1 M7).
          tandaiDataBerubah();
          setResult(teksCheckInBerhasil(txHash));
          kabar.berhasil(teksCheckInBerhasil(txHash));
```

3. Ganti:

```tsx
      // Momen puncak: sheet, bukan teks hasil dan bukan pindah layar (#16D).
```

dengan:

```tsx
      // "Recently met" di Beranda dan angka koneksi di Profil segar saat
      // difokuskan, walau belum 30 detik (review B1 M7).
      tandaiDataBerubah();
      // Momen puncak: sheet, bukan teks hasil dan bukan pindah layar (#16D).
```

- [ ] **Step 8: Sunting sheet (M8)**

Di `apps/mobile/components/salaman/sheet-bertemu.tsx`:

1. Ganti `import { useEffect, useRef, useState } from "react";` dengan `import { useEffect, useState } from "react";`.
2. Ganti impor teks-salaman:

```tsx
import {
  teksTerkoneksi, TEKS_LIHAT_PROFIL, TEKS_PINDAI_ORANG_LAIN,
} from "../../src/teks-salaman";
```

dengan:

```tsx
import {
  namaSheetUntuk, teksTerkoneksi, TEKS_LIHAT_PROFIL, TEKS_PINDAI_ORANG_LAIN, type SimpananNama,
} from "../../src/teks-salaman";
```

3. Ganti `  const [nama, setNama] = useState<string | null>(null);` dengan:

```tsx
  const [simpananNama, setSimpananNama] = useState<SimpananNama | null>(null);
  // R14: nama hanya dipakai untuk alamat yang memintanya (Ruling B2-4).
  const nama = namaSheetUntuk(simpananNama, hasil.initiator);
```

4. Ganti seluruh blok dari komentar `// R14: jawaban yang datang setelah sheet ditutup, …` sampai akhir `useEffect` (baris `  }, [hasil.initiator]);`) dengan:

```tsx
  useEffect(() => {
    // Jawaban yang datang setelah efek ini dibersihkan (sheet ditutup atau
    // alamat berganti) tidak disimpan; jawaban yang lolos pun disimpan BERSAMA
    // alamatnya dan dibandingkan saat render (namaSheetUntuk).
    let aktif = true;
    // Haptic tepat saat sheet TERBUKA (§6.2 butir 7), bukan saat ditutup.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const untuk = hasil.initiator;
    // SATU panggilan publik, rute dan bentuk yang sama dengan layar profil,
    // TANPA bukti: sheet hanya butuh displayName. Galat, waktu habis, atau
    // nama kosong → judul tetap alamat singkat, tanpa pesan galat (R14).
    req<{ displayName?: string }>(`/profile/${untuk}`)
      .then((p) => {
        if (aktif) setSimpananNama({ alamat: untuk, nama: p.displayName ?? null });
      })
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [hasil.initiator]);
```

Sisa berkas (judul, avatar) sudah membaca variabel `nama` — tidak diubah.

- [ ] **Step 9: Perbarui asersi lama yang menunjuk bentuk sebelumnya**

1. `apps/mobile/test/beranda.test.ts` — di `it("memuat saat fokus, paling sering sekali per 30 detik (§4.6)", …)` ganti dua `expect` di dalamnya dengan:

```ts
    expect(isi).toContain("useMuatSaatFokus(muatSemua);");
```

2. `apps/mobile/test/review-b1.test.ts` — ganti `it("angka koneksi dan tier dimuat saat fokus, dibatasi bolehMuatFokus (spec §4.6)", …)` seluruhnya dengan:

```ts
  it("angka koneksi dan tier dimuat saat fokus lewat useMuatSaatFokus (spec §4.6, review B1 M7)", () => {
    const x = isi();
    expect(x).toContain("useMuatSaatFokus(muatKepala);");
    const kepala = potong(x, "const muatKepala = useCallback(", "}, [signer.address]);");
    expect(kepala).toContain("connectionCount");
    expect(kepala).toContain("fetchTrust(signer.address)");
  });
```

3. `apps/mobile/test/salaman.test.ts` — ganti isi `it("jawaban basi dibuang dengan membandingkan alamat sebelum mengisi nama (R14)", …)` (dua `expect` yang menyebut `terpasang.current` dan `alamatKini.current`) dengan:

```ts
    const isi = baca("components/salaman/sheet-bertemu.tsx");
    expect(isi).toContain("setSimpananNama({ alamat: untuk, nama: p.displayName ?? null })");
    expect(isi).toContain("const nama = namaSheetUntuk(simpananNama, hasil.initiator);");
```

(Bila berkas tes itu membaca sheet lewat variabel/helper lain, pakai helper yang sama — yang mengikat adalah dua string di atas. Pastikan `baca` sudah diimpor dari `./support/berkas`.)

- [ ] **Step 10: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/review-b1-minor.test.ts test/muat-fokus.test.ts test/teks-salaman.test.ts test/salaman.test.ts test/beranda.test.ts test/review-b1.test.ts`
Expected: PASS.

- [ ] **Step 11: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/src/muat-fokus.ts apps/mobile/hooks/useMuatSaatFokus.ts apps/mobile/test/muat-fokus.test.ts "apps/mobile/app/(tabs)/(beranda)/index.tsx" "apps/mobile/app/(tabs)/(profil)/profil-saya.tsx" apps/mobile/components/salaman/mode-pindai.tsx apps/mobile/components/salaman/sheet-bertemu.tsx apps/mobile/src/teks-salaman.ts apps/mobile/test/teks-salaman.test.ts apps/mobile/test/salaman.test.ts apps/mobile/test/beranda.test.ts apps/mobile/test/review-b1.test.ts apps/mobile/test/review-b1-minor.test.ts
git commit -m "fix(mobile): layar tab segar setelah salaman/check-in dan setelah muat gagal; nama sheet per alamat (review B1 M7, M8)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Mutasi**

1. Di `hooks/useMuatSaatFokus.ts`, hapus baris `if (!berhasil && terakhir.current === kini) terakhir.current = null;`. Run: `vitest run test/review-b1-minor.test.ts`. Expected merah: `useMuatSaatFokus membatasi lewat perluMuatUlang …`. Kembalikan.
2. Di `src/teks-salaman.ts`, ganti badan `namaSheetUntuk` menjadi `return simpanan?.nama ?? null;`. Run: `vitest run test/teks-salaman.test.ts`. Expected merah: `jawaban untuk pindaian lain dibuang`. Kembalikan.
3. Di `src/muat-fokus.ts`, ganti badan `perluMuatUlang` menjadi `return bolehMuatFokus(terakhirMs, sekarangMs);`. Run: `vitest run test/muat-fokus.test.ts`. Expected merah: `data yang berubah (salaman, check-in, acara dibuat) memuat walau belum 30 detik`. Kembalikan.

---

## Task 5: Teks dan fungsi murni Acara + Radar

**Files:**
- Create: `apps/mobile/src/teks-acara.ts`, `apps/mobile/src/teks-radar.ts`, `apps/mobile/src/events/daftar-acara.ts`, `apps/mobile/test/teks-acara.test.ts`, `apps/mobile/test/teks-radar.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`teksPenandaHadir`, `teksKutandaiHadir`, `KALIMAT_RADAR`, `lencanaKartuRadar`), `apps/mobile/src/radar/radar-api.ts` (`KartuRadarApi.koneksiBersama`), `apps/mobile/src/events/useCheckInQr.ts` (kalimat cadangan), `apps/mobile/src/location.ts` (pesan pengembang), `apps/mobile/test/meet-gerbang-teks.test.ts`, `apps/mobile/test/radar-messages.test.ts`

**Interfaces:**
- Consumes: `jamak`, `pasanganJamak` (`src/jamak.ts`), `formatTanggalJam`, `waktuRelatif` (`src/waktu.ts`), `LENCANA_SALING_INGIN_BERTEMU` (`src/teks-akun.ts`), `isEventLive`, `GEOFENCE_SPAN_M` (`@nearly/shared`).
- Produces (`src/teks-acara.ts`): `TEKS_BUAT_ACARA`, `KOSONG_ACARA`, `TEKS_GAGAL_MUAT_ACARA`, `teksRsvp(n)`, `metaAcara(a: { startsAt: string; venueLabel: string }, sekarang: Date)`, `TEKS_GAGAL_MUAT_ACARA_INI`, `pasanganRsvp(n)`, `pasanganBelumHadir(n)`, `labelRsvp(sibuk)`, `TEKS_RSVP_TERCATAT`, `TEKS_RSVP_GAGAL`, `TEKS_RSVP_DULU`, `TEKS_CHECK_IN_SAAT_BERLANGSUNG`, `TEKS_PINDAI_QR_HOST`, `TEKS_BUKA_RADAR_ACARA`, `TEKS_BUKA_QR_HOST`, `LABEL_NAMA_ACARA`, `LABEL_TEMPAT_ACARA`, `catatanPusatAcara()`, `labelBuatAcara(sibuk)`, `TEKS_GAGAL_BUAT_ACARA`, `TEKS_ACARA_DIBUAT`, `teksPetunjukQrHost(detik)`, `TEKS_GAGAL_SIAPKAN_QR_HOST`, `TEKS_IZIN_LOKASI_DITOLAK`, `kalimatGagalAcara(e, cadangan)`.
- Produces (`src/teks-radar.ts`): `PIL_TERLIHAT`, `pasanganTerlihatDiSini(n)`, `teksDiperbarui(t, sekarang)`, `TEKS_HADIR_SEKARANG`, `teksKoneksiBersama(n?)`, `keteranganKartuRadar(k)`, `JUDUL_KONEKSI_DI_SINI`, `JUDUL_BELUM_DITEMUI`, `TEKS_HANDSHAKE_KARTU`, `TEKS_BUKA_PROFIL_SAYA`, `pisahKartuRadar(kartu)`, `radarBisaDicobaLagi(keadaan)`.
- Produces (`src/events/daftar-acara.ts`): `acaraLive(a, sekarangMs): boolean`, `liveDulu(acara, sekarangMs): T[]`.
- Produces (`src/messages.ts`): `lencanaKartuRadar(k): string | null` (**tanda tangan berubah** dari `string[]`, Ruling B2-8).
- Produces (`src/radar/radar-api.ts`): `KartuRadarApi.koneksiBersama?: number`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/teks-acara.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GEOFENCE_SPAN_M } from "@nearly/shared";
import { acaraLive, liveDulu } from "../src/events/daftar-acara";
import {
  catatanPusatAcara, kalimatGagalAcara, labelBuatAcara, labelRsvp, metaAcara, pasanganBelumHadir,
  pasanganRsvp, TEKS_GAGAL_BUAT_ACARA, TEKS_IZIN_LOKASI_DITOLAK, teksPetunjukQrHost, teksRsvp,
} from "../src/teks-acara";

describe("teks Acara (spec §7.4)", () => {
  it("jumlah RSVP tunggal dan jamak", () => {
    expect(teksRsvp(0)).toBe("0 RSVPs");
    expect(teksRsvp(1)).toBe("1 RSVP");
    expect(teksRsvp(12)).toBe("12 RSVPs");
    expect(pasanganRsvp(1)).toEqual({ angka: "1", kata: "RSVP" });
    expect(pasanganBelumHadir(3)).toEqual({ angka: "3", kata: "not checked in yet" });
  });

  it("baris waktu kartu memakai formatTanggalJam, tempat bila ada", () => {
    const sekarang = new Date(2026, 8, 21, 10, 0);
    const detik = String(Math.floor(new Date(2026, 7, 12, 19, 42).getTime() / 1000));
    expect(metaAcara({ startsAt: detik, venueLabel: "" }, sekarang)).toBe("Aug 12, 19:42");
    expect(metaAcara({ startsAt: detik, venueLabel: "Aula" }, sekarang)).toBe("Aug 12, 19:42 · Aula");
  });

  it("label tombol sibuk", () => {
    expect(labelRsvp(false)).toBe("RSVP");
    expect(labelRsvp(true)).toBe("Sending…");
    expect(labelBuatAcara(false)).toBe("Create event");
    expect(labelBuatAcara(true)).toBe("Creating…");
  });

  it("catatan pusat acara menyebut rentang geofence dari @nearly/shared", () => {
    expect(catatanPusatAcara()).toContain(`about ${GEOFENCE_SPAN_M} meters`);
  });

  it("petunjuk QR host menghitung mundur dengan bentuk tunggal", () => {
    expect(teksPetunjukQrHost(1)).toBe("Ask guests to scan this to check in. Changes in 1 second.");
    expect(teksPetunjukQrHost(30)).toBe("Ask guests to scan this to check in. Changes in 30 seconds.");
  });

  // Ruling B2-14: Error.message tidak pernah dirender; lokasi ditolak dikenali
  // lewat nama galatnya.
  it("lokasi ditolak punya kalimatnya sendiri; galat lain jatuh ke cadangan", () => {
    const ditolak = Object.assign(new Error("x"), { name: "LocationDeniedError" });
    expect(kalimatGagalAcara(ditolak, TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_IZIN_LOKASI_DITOLAK);
    expect(kalimatGagalAcara(new Error("bocor"), TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_GAGAL_BUAT_ACARA);
    expect(kalimatGagalAcara("bukan Error", TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_GAGAL_BUAT_ACARA);
  });
});

describe("acara LIVE di atas daftar (spec §7.1)", () => {
  const sekarangMs = 1_000_000;
  const detik = (ms: number) => String(Math.floor(ms / 1000));
  const lalu = { id: "lalu", startsAt: detik(sekarangMs - 7_200_000), endsAt: detik(sekarangMs - 3_600_000) };
  const liveA = { id: "liveA", startsAt: detik(sekarangMs - 1_000), endsAt: detik(sekarangMs + 3_600_000) };
  const nanti = { id: "nanti", startsAt: detik(sekarangMs + 3_600_000), endsAt: detik(sekarangMs + 7_200_000) };
  const liveB = { id: "liveB", startsAt: detik(sekarangMs - 2_000), endsAt: detik(sekarangMs + 60_000) };

  it("acaraLive mengikuti isEventLive", () => {
    expect(acaraLive(liveA, sekarangMs)).toBe(true);
    expect(acaraLive(nanti, sekarangMs)).toBe(false);
  });

  it("LIVE dipindah ke depan; urutan server dipertahankan di kedua kelompok", () => {
    expect(liveDulu([nanti, liveA, lalu, liveB], sekarangMs).map((a) => a.id)).toEqual(["liveA", "liveB", "nanti", "lalu"]);
  });
});
```

Buat `apps/mobile/test/teks-radar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  keteranganKartuRadar, pasanganTerlihatDiSini, pisahKartuRadar, radarBisaDicobaLagi,
  teksDiperbarui, teksKoneksiBersama,
} from "../src/teks-radar";

describe("teks Radar (spec §6.4, §7.3, keputusan #10)", () => {
  it("N people visible here — tunggal dan jamak, angka terpisah dari kata (§7.1)", () => {
    expect(pasanganTerlihatDiSini(1)).toEqual({ angka: "1", kata: "person visible here" });
    expect(pasanganTerlihatDiSini(4)).toEqual({ angka: "4", kata: "people visible here" });
  });

  it("Updated memakai waktu relatif", () => {
    const kini = new Date(2026, 8, 21, 10, 0, 30);
    expect(teksDiperbarui(new Date(2026, 8, 21, 10, 0, 10), kini)).toBe("Updated just now");
    expect(teksDiperbarui(new Date(2026, 8, 21, 9, 58, 0), kini)).toBe("Updated 2 minutes ago");
  });

  it("koneksi bersama: absen atau 0 → tidak ada teks; 1 tunggal; N jamak", () => {
    expect(teksKoneksiBersama(undefined)).toBeNull();
    expect(teksKoneksiBersama(0)).toBeNull();
    expect(teksKoneksiBersama(1)).toBe("1 mutual connection");
    expect(teksKoneksiBersama(3)).toBe("3 mutual connections");
  });

  it("keterangan kartu: here now, plus koneksi bersama hanya untuk yang belum ditemui (#10c)", () => {
    expect(keteranganKartuRadar({ pernahBertemu: false })).toBe("here now");
    expect(keteranganKartuRadar({ pernahBertemu: false, koneksiBersama: 2 })).toBe("here now · 2 mutual connections");
    // Kartu koneksi tidak pernah membawa angka ini (spec §8.3); kalau pun ada, tidak ditampilkan.
    expect(keteranganKartuRadar({ pernahBertemu: true, koneksiBersama: 2 })).toBe("here now");
  });

  it("dua bagian tanpa mengubah urutan server (§6.4)", () => {
    const k = [
      { id: "a", pernahBertemu: false }, { id: "b", pernahBertemu: true },
      { id: "c", pernahBertemu: false }, { id: "d", pernahBertemu: true },
    ];
    const { koneksi, belum } = pisahKartuRadar(k);
    expect(koneksi.map((x) => x.id)).toEqual(["b", "d"]);
    expect(belum.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("Try again hanya untuk keadaan yang bisa pulih dengan mencoba lagi", () => {
    for (const k of ["gagal", "server_tak_terjangkau", "sesi_tidak_sah", "izin_lokasi"] as const) {
      expect(radarBisaDicobaLagi(k), k).toBe(true);
    }
    for (const k of ["tersembunyi", "di_luar_area", "belum_check_in", "tidak_berlangsung", "tidak_ditemukan", "kosong"] as const) {
      expect(radarBisaDicobaLagi(k), k).toBe(false);
    }
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-acara.test.ts test/teks-radar.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 2: Tulis modul teks dan fungsi murni**

Buat `apps/mobile/src/events/daftar-acara.ts`:

```ts
import { isEventLive } from "@nearly/shared";

type BerWaktu = { startsAt: string; endsAt: string };

/** `startsAt`/`endsAt` = detik unix sebagai string (bentuk kawat EventSummary). */
export function acaraLive(a: BerWaktu, sekarangMs: number): boolean {
  return isEventLive(BigInt(a.startsAt), BigInt(a.endsAt), sekarangMs);
}

/**
 * Acara LIVE di atas daftar (spec desain UI §7.1). Urutan server dipertahankan
 * di dalam kedua kelompok — layar tidak mengarang urutan sendiri.
 */
export function liveDulu<T extends BerWaktu>(acara: readonly T[], sekarangMs: number): T[] {
  const live: T[] = [];
  const lain: T[] = [];
  for (const a of acara) (acaraLive(a, sekarangMs) ? live : lain).push(a);
  return [...live, ...lain];
}
```

Buat `apps/mobile/src/teks-acara.ts`:

```ts
import { GEOFENCE_SPAN_M } from "@nearly/shared";
import { jamak, pasanganJamak } from "./jamak";
import { formatTanggalJam } from "./waktu";

/**
 * Teks layar Acara (spec desain UI §7.1, §7.4): terjemahan 1:1 kalimat yang
 * sudah ada di events/index, events/[id], events/new, dan events/[id]/host-qr,
 * ditambah satu teks baru "Event created." (Ruling B2-6).
 */

/* Daftar acara — app/(tabs)/(acara)/events/index.tsx */

export const TEKS_BUAT_ACARA = "Create event";
export const KOSONG_ACARA = "No upcoming events yet. You can create the first one.";
export const TEKS_GAGAL_MUAT_ACARA = "Couldn't load events.";

/** "{rsvpCount} RSVP" di kartu daftar. */
export function teksRsvp(n: number): string {
  return jamak(n, "RSVP", "RSVPs");
}

/**
 * Baris waktu + tempat kartu acara: "Aug 12, 19:42 · Aula" — pengganti
 * toLocaleString("id-ID", …) (spec §7.4). `startsAt` = detik unix string.
 */
export function metaAcara(a: { startsAt: string; venueLabel: string }, sekarang: Date): string {
  const waktu = formatTanggalJam(new Date(Number(a.startsAt) * 1000), sekarang);
  return a.venueLabel ? `${waktu} · ${a.venueLabel}` : waktu;
}

/* Detail acara — app/(tabs)/(acara)/events/[id].tsx */

export const TEKS_GAGAL_MUAT_ACARA_INI = "Couldn't load this event.";

/** Pasangan nilai/label kartu kehadiran (§7.1): nilai lebih keras dari labelnya. */
export function pasanganRsvp(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "RSVP", "RSVPs");
}

export function pasanganBelumHadir(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "not checked in yet", "not checked in yet");
}

export function labelRsvp(sibuk: boolean): string {
  return sibuk ? "Sending…" : "RSVP";
}

export const TEKS_RSVP_TERCATAT = "RSVP recorded. Check in at the venue by scanning the host's QR code.";
export const TEKS_RSVP_GAGAL = "RSVP failed.";
export const TEKS_RSVP_DULU = "RSVP first to be able to check in.";
export const TEKS_CHECK_IN_SAAT_BERLANGSUNG = "Check-in opens while the event is running.";
/** Kalimat spec §4.1 (dulu "Pindai QR host untuk check-in"). */
export const TEKS_PINDAI_QR_HOST = "Scan the host's QR to check in";
export const TEKS_BUKA_RADAR_ACARA = "Open radar";
export const TEKS_BUKA_QR_HOST = "Open check-in QR (you're the host)";

/* Buat acara — app/(tabs)/(acara)/events/new.tsx */

export const LABEL_NAMA_ACARA = "Event name";
export const LABEL_TEMPAT_ACARA = "Venue name (optional)";

export function catatanPusatAcara(): string {
  return `Your location when you tap this button becomes the center of the event area (about ${GEOFENCE_SPAN_M} meters). Stand at the venue.`;
}

export function labelBuatAcara(sibuk: boolean): string {
  return sibuk ? "Creating…" : TEKS_BUAT_ACARA;
}

export const TEKS_GAGAL_BUAT_ACARA = "Couldn't create the event.";
/** Teks BARU (Ruling B2-6): §7.2 mewajibkan toast untuk acara dibuat. */
export const TEKS_ACARA_DIBUAT = "Event created.";

/* QR check-in host — app/(tabs)/(acara)/events/[id]/host-qr.tsx */

export function teksPetunjukQrHost(detik: number): string {
  return `Ask guests to scan this to check in. Changes in ${jamak(detik, "second", "seconds")}.`;
}

export const TEKS_GAGAL_SIAPKAN_QR_HOST = "Couldn't prepare the check-in QR code.";

/* Lokasi ditolak (Ruling B2-14) */

/** Terjemahan kalimat yang hari ini tampil lewat Error.message ("Izin lokasi ditolak"). */
export const TEKS_IZIN_LOKASI_DITOLAK = "Location access was denied.";

/**
 * Kalimat untuk galat yang BUKAN ApiError di layar Acara. Error.message tidak
 * pernah dirender (review B1 #I1); lokasi ditolak dikenali lewat namanya
 * supaya modul ini tetap murni (tanpa impor expo-location).
 */
export function kalimatGagalAcara(e: unknown, cadangan: string): string {
  return e instanceof Error && e.name === "LocationDeniedError" ? TEKS_IZIN_LOKASI_DITOLAK : cadangan;
}
```

Buat `apps/mobile/src/teks-radar.ts`:

```ts
import { jamak, pasanganJamak } from "./jamak";
import type { KeadaanRadar } from "./messages";
import { waktuRelatif } from "./waktu";

/**
 * Teks BARU layar Radar (spec desain UI §6.4, §7.3, keputusan #10). Kalimat
 * keadaan radar yang lama tetap di src/messages.ts (KALIMAT_RADAR).
 */

/** Pil kepala: radar hanya tampil bagi pemanggil yang Terlihat (gerbang spec 4b+5). */
export const PIL_TERLIHAT = "● Visible";

/**
 * "N people visible here" dari `jumlah` respons (#10e) — BUKAN "Kamu terlihat
 * oleh N orang": server hanya tahu siapa yang terlihat olehmu.
 */
export function pasanganTerlihatDiSini(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "person visible here", "people visible here");
}

/** Jam HP saat getRadar terakhir berhasil (§6.4). */
export function teksDiperbarui(t: Date, sekarang: Date): string {
  return `Updated ${waktuRelatif(t, sekarang)}`;
}

/** #10d: setiap kartu radar memang hadir dalam 15 menit terakhir; jam detak tidak pernah dikirim. */
export const TEKS_HADIR_SEKARANG = "here now";

/** #10c: hanya angka, tanpa nama; absen atau < 1 → tidak ada teks. */
export function teksKoneksiBersama(n: number | undefined): string | null {
  if (n === undefined || n < 1) return null;
  return jamak(n, "mutual connection", "mutual connections");
}

/** Keterangan redup kartu radar: "here now" (+ " · N mutual connections" untuk yang belum ditemui). */
export function keteranganKartuRadar(k: { pernahBertemu: boolean; koneksiBersama?: number }): string {
  const bersama = k.pernahBertemu ? null : teksKoneksiBersama(k.koneksiBersama);
  return bersama ? `${TEKS_HADIR_SEKARANG} · ${bersama}` : TEKS_HADIR_SEKARANG;
}

export const JUDUL_KONEKSI_DI_SINI = "Your connections here";
export const JUDUL_BELUM_DITEMUI = "Not met yet";
export const TEKS_HANDSHAKE_KARTU = "Handshake ›";
/** Keadaan Tersembunyi → tab Profil (spec §5, dulu "Buka Profil saya"). */
export const TEKS_BUKA_PROFIL_SAYA = "Open your profile";

/** Dua bagian dari urutan server, TANPA mengurutkan ulang (§6.4). */
export function pisahKartuRadar<K extends { pernahBertemu: boolean }>(
  kartu: readonly K[],
): { koneksi: K[]; belum: K[] } {
  return {
    koneksi: kartu.filter((k) => k.pernahBertemu),
    belum: kartu.filter((k) => !k.pernahBertemu),
  };
}

const BISA_DICOBA_LAGI: ReadonlySet<KeadaanRadar> = new Set<KeadaanRadar>([
  "gagal", "server_tak_terjangkau", "sesi_tidak_sah", "izin_lokasi",
]);

/**
 * Keadaan yang mendapat "Try again" (§7.2). Keadaan lain (Tersembunyi, di luar
 * area, belum check-in, acara selesai) bukan galat — mencoba lagi tidak
 * mengubah apa pun sampai penggunanya bertindak.
 */
export function radarBisaDicobaLagi(keadaan: KeadaanRadar): boolean {
  return BISA_DICOBA_LAGI.has(keadaan);
}
```

Run perintah Step 1 lagi. Expected: PASS.

- [ ] **Step 3: Terjemahkan kalimat lama di `src/messages.ts`**

1. Tambahkan impor sesudah `import { jamak } from "./jamak";`:

```ts
import { LENCANA_SALING_INGIN_BERTEMU } from "./teks-akun";
```

2. `teksPenandaHadir` — ganti `  return \`${jumlah} orang yang ingin bertemu kamu sudah RSVP.\`;` dengan:

```ts
  return jamak(jumlah, "person who wants to meet you has RSVP'd.", "people who want to meet you have RSVP'd.");
```

3. `teksKutandaiHadir` — ganti `  return \`${jumlah} orang yang saling ingin bertemu denganmu sudah RSVP.\`;` dengan:

```ts
  return jamak(jumlah, "person you both want to meet has RSVP'd.", "people you both want to meet have RSVP'd.");
```

4. Ganti isi `KALIMAT_RADAR` (nilai saja; kunci tetap):

```ts
const KALIMAT_RADAR: Record<KeadaanRadar, string> = {
  tersembunyi: "You're Hidden, so the radar can't be opened.",
  di_luar_area: "You appear to be outside the event area.",
  belum_check_in: "Check in first to open the radar.",
  tidak_berlangsung: "The radar is only active while the event is running.",
  tidak_ditemukan: "This event wasn't found.",
  kosong: "No one else is visible here yet.",
  izin_lokasi: "The radar needs location access while the app is open.",
  sesi_tidak_sah: "Your session isn't valid. Close this screen, then open it again.",
  server_tak_terjangkau: KALIMAT_SERVER_TAK_TERJANGKAU,
  gagal: "The radar failed to load. Try again in a moment.",
};
```

5. Ganti fungsi `lencanaKartuRadar` seluruhnya dengan:

```ts
/**
 * Lencana teks kartu radar (spec §6.4, Ruling B2-8). "Pernah bertemu" tidak
 * lagi berupa teks: kartu koneksi memakai lencana ✓ ringkas, dan bagiannya
 * ("Your connections here") sudah mengatakannya.
 */
export function lencanaKartuRadar(k: {
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
}): string | null {
  return k.salingInginBertemu ? LENCANA_SALING_INGIN_BERTEMU : null;
}
```

- [ ] **Step 4: Tipe radar, cadangan QR check-in, pesan pengembang lokasi**

1. `apps/mobile/src/radar/radar-api.ts` — di `KartuRadarApi` sesudah `salingInginBertemu: boolean;` tambahkan:

```ts
  /**
   * Spec desain UI §8.3: hanya pada kartu `pernahBertemu === false`, hanya bila
   * ≥ 1, dan ABSEN bila store server gagal. Angka saja — tidak pernah nama.
   */
  koneksiBersama?: number;
```

2. `apps/mobile/src/events/useCheckInQr.ts` — ganti:

```ts
          : e instanceof Error
            ? e.message
            : "Gagal menyiapkan QR check-in.",
```

dengan:

```ts
          : kalimatGagalAcara(e, TEKS_GAGAL_SIAPKAN_QR_HOST),
```

dan tambahkan impor `import { kalimatGagalAcara, TEKS_GAGAL_SIAPKAN_QR_HOST } from "../teks-acara";`.

3. `apps/mobile/src/location.ts` — ganti `    super("Izin lokasi ditolak");` dengan `    super("Location access was denied");` (pesan pengembang; layar memilih kalimatnya lewat `name`). Jalankan `git grep -n "Izin lokasi ditolak" -- apps/mobile` — bila ada tes yang mengharapkan string lama, ganti harapannya ke `"Location access was denied"`.

- [ ] **Step 5: Perbarui tes kalimat lama**

1. `apps/mobile/test/meet-gerbang-teks.test.ts` — ganti setiap harapan string `teksPenandaHadir`/`teksKutandaiHadir`:
   - `"0 orang yang ingin bertemu kamu sudah RSVP."` → `"0 people who want to meet you have RSVP'd."`
   - `"3 orang yang ingin bertemu kamu sudah RSVP."` → `"3 people who want to meet you have RSVP'd."`
   - `"0 orang yang saling ingin bertemu denganmu sudah RSVP."` → `"0 people you both want to meet have RSVP'd."`
   - harapan lain berpola `"N orang yang saling ingin bertemu denganmu sudah RSVP."` → `"N people you both want to meet have RSVP'd."`

   dan tambahkan di `describe` yang sama satu kasus tunggal:

```ts
  it("satu orang memakai bentuk tunggal", () => {
    expect(teksPenandaHadir(1)).toBe("1 person who wants to meet you has RSVP'd.");
    expect(teksKutandaiHadir(1)).toBe("1 person you both want to meet has RSVP'd.");
  });
```

2. `apps/mobile/test/radar-messages.test.ts` — di `it("kalimat spec persis", …)` ganti enam harapan Indonesia dengan:

```ts
    expect(kalimatRadar("tersembunyi")).toBe("You're Hidden, so the radar can't be opened.");
    expect(kalimatRadar("di_luar_area")).toBe("You appear to be outside the event area.");
    expect(kalimatRadar("belum_check_in")).toBe("Check in first to open the radar.");
    expect(kalimatRadar("tidak_berlangsung")).toBe("The radar is only active while the event is running.");
    expect(kalimatRadar("kosong")).toBe("No one else is visible here yet.");
    expect(kalimatRadar("izin_lokasi")).toBe("The radar needs location access while the app is open.");
```

   dan ganti keempat harapan `lencanaKartuRadar` dengan:

```ts
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: true })).toBe("You both want to meet");
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: false })).toBeNull();
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: true })).toBe("You both want to meet");
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: false })).toBeNull();
```

Layar Radar lama (`radar/[eventId].tsx`) masih memanggil `lencanaKartuRadar(k).map(…)` — **typecheck akan merah sampai Task 8**. Untuk menjaga setiap commit hijau, di task ini ganti pemakaian itu sementara di layar lama:

```tsx
              {lencanaKartuRadar(k).map((l) => (
                <Text key={l} style={s.lencana}>{"\n"}{l}</Text>
              ))}
```

menjadi:

```tsx
              {lencanaKartuRadar(k) ? (
                <Text style={s.lencana}>{"\n"}{lencanaKartuRadar(k)}</Text>
              ) : null}
```

(Seluruh layar ditulis ulang di Task 8.)

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-acara.test.ts test/teks-radar.test.ts test/meet-gerbang-teks.test.ts test/radar-messages.test.ts test/radar-api.test.ts`
Expected: PASS.

- [ ] **Step 7: Verifikasi penuh, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`.

```bash
git add apps/mobile/src/teks-acara.ts apps/mobile/src/teks-radar.ts apps/mobile/src/events/daftar-acara.ts apps/mobile/test/teks-acara.test.ts apps/mobile/test/teks-radar.test.ts apps/mobile/src/messages.ts apps/mobile/src/radar/radar-api.ts apps/mobile/src/events/useCheckInQr.ts apps/mobile/src/location.ts apps/mobile/test/meet-gerbang-teks.test.ts apps/mobile/test/radar-messages.test.ts "apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx"
git commit -m "feat(mobile): teks Acara dan Radar berbahasa Inggris, koneksiBersama di kartu radar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Tambahkan tes lain yang diubah di Step 4 butir 3 bila ada.)

- [ ] **Step 8: Mutasi**

Di `src/teks-radar.ts`, ganti badan `keteranganKartuRadar` sehingga baris `const bersama = …` menjadi `const bersama = teksKoneksiBersama(k.koneksiBersama);`. Run: `vitest run test/teks-radar.test.ts`. Expected merah: `keterangan kartu: here now, plus koneksi bersama hanya untuk yang belum ditemui (#10c)`. Kembalikan.

---

## Task 6: Migrasi daftar Acara dan Detail acara

**Files:**
- Create: `apps/mobile/test/acara.test.ts`
- Modify: `apps/mobile/app/(tabs)/(acara)/events/index.tsx` (tulis ulang), `apps/mobile/app/(tabs)/(acara)/events/[id].tsx` (tulis ulang), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`), `apps/mobile/test/judul-layar.test.ts` (satu baris)

**Interfaces:**
- Consumes: Task 4 `useMuatSaatFokus`; Task 5 `teks-acara`, `daftar-acara`; B1 `TEKS_LIVE`, `pasanganCheckIn` (`src/teks-beranda.ts`); `KeadaanGalat`, `KeadaanKosong`, `KerangkaDaftar`; `formatTanggalJam`.
- Produces: `LAYAR_TERMIGRASI` memuat `"(tabs)/(acara)/events/index"` dan `"(tabs)/(acara)/events/[id]"`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/acara.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const daftar = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/index.tsx"));
const detail = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/[id].tsx"));

describe("daftar Acara (spec §7.1 pola daftar, §4.7)", () => {
  it("dimigrasi dan dibangun di FlatList untuk judul besar", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/index")).toBe(true);
    expect(daftar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("acara LIVE di atas daftar; waktu lewat metaAcara, bukan toLocaleString", () => {
    const x = daftar();
    expect(x).toContain("liveDulu(events, kini)");
    expect(x).toContain("metaAcara(acara, new Date(kiniMs))");
    expect(x).not.toContain("toLocale");
  });

  it("empat keadaan: kerangka, galat + Try again, kosong + Create event", () => {
    const x = daftar();
    expect(x).toContain("<KerangkaDaftar />");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} />");
    expect(x).toMatch(/<KeadaanKosong\s+Ikon=\{CalendarDays\}\s+kalimat=\{KOSONG_ACARA\}\s+aksi=\{\{ label: TEKS_BUAT_ACARA, onPress: buat \}\}/);
  });

  it("memuat saat fokus lewat useMuatSaatFokus; gagal muat mempertahankan daftar dan tidak merender Error.message", () => {
    const x = daftar();
    expect(x).toContain("useMuatSaatFokus(load);");
    expect(x).not.toContain("setEvents([])");
    expect(x).not.toContain("e.message");
  });
});

describe("Detail acara (spec §7.1 pola detail)", () => {
  it("dimigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/[id]")).toBe(true);
  });

  it("gagal muat → galat + Try again, bukan kerangka selamanya", () => {
    expect(detail()).toMatch(/if \(!ev\) \{[\s\S]*?galatMuat \? \(\s*<KeadaanGalat kalimat=\{galatMuat\} onCobaLagi=\{\(\) => void load\(\)\} \/>/);
  });

  it("Handshake mode Scan dibuka lewat navigate lintas tab; radar dan QR host lewat push", () => {
    const x = detail();
    expect(x).toContain('router.navigate("/salaman?mode=pindai")');
    expect(x).toContain("router.push(`/radar/${ev.eventId}`)");
    expect(x).toContain("router.push(`/events/${ev.eventId}/host-qr`)");
  });

  it("angka penanda hadir tetap lewat fungsi gerbang — undefined bukan nol (spec 4a §4.3)", () => {
    const x = detail();
    expect(x).toContain("teksPenandaHadir(ev.penandaHadir)");
    expect(x).toContain("teksKutandaiHadir(ev.kutandaiHadir)");
    expect(x).toContain("barisPenandaHadir !== null ?");
    expect(x).toContain("barisKutandaiHadir !== null ?");
  });

  it("tanggal lewat formatTanggalJam; memuat saat fokus lewat useMuatSaatFokus (Ruling B2-3)", () => {
    const x = detail();
    expect(x).toContain("formatTanggalJam(new Date(Number(ev.startsAt) * 1000), new Date())");
    expect(x).not.toContain("toLocale");
    expect(x).toContain("useMuatSaatFokus(load);");
  });

  it("bukti baca LihatEvent, bukan Rsvp (tipe yang sama dengan POST bisa diputar ulang)", () => {
    const x = detail();
    const muat = x.slice(x.indexOf("const load = useCallback("), x.indexOf("useMuatSaatFokus(load);"));
    expect(muat).toContain("lihatEventTypedData(");
    expect(muat).not.toContain("rsvpTypedData(");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/acara.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tulis ulang daftar Acara**

Timpa `apps/mobile/app/(tabs)/(acara)/events/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { CalendarDays, Plus } from "lucide-react-native";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { ApiError } from "../../../../src/api";
import { acaraLive, liveDulu } from "../../../../src/events/daftar-acara";
import { getDiscovery, type EventSummary } from "../../../../src/events-api";
import { eventErrorMessage } from "../../../../src/messages";
import {
  KOSONG_ACARA, metaAcara, TEKS_BUAT_ACARA, TEKS_GAGAL_MUAT_ACARA, teksRsvp,
} from "../../../../src/teks-acara";
import { TEKS_LIVE } from "../../../../src/teks-beranda";

export default function EventsScreen() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { events: rows } = await getDiscovery();
      setEvents(rows);
      setGalat(null);
      return true;
    } catch (e) {
      // Daftar yang sudah tampil DIPERTAHANKAN (Ruling B2-12). Error.message
      // tidak pernah dirender (review B1 #I1).
      setGalat(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : TEKS_GAGAL_MUAT_ACARA);
      return false;
    }
  }, []);

  // Segar saat kembali ke layar ini dalam batas §4.6 — dan langsung setelah
  // acara dibuat, lewat generasi data (Ruling B2-3).
  useMuatSaatFokus(load);

  const kini = Date.now();
  const urut = events ? liveDulu(events, kini) : [];
  const kosong = events !== null && events.length === 0;
  const buat = () => router.push("/events/new");

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={urut}
      keyExtractor={(e) => e.eventId}
      ListHeaderComponent={
        <View style={s.kepala}>
          {/* Aksi utama di baris pertama (§7.1); keadaan kosong membawa aksinya sendiri. */}
          {!kosong ? <Button icon={Plus} onPress={buat}>{TEKS_BUAT_ACARA}</Button> : null}
          {events !== null && galat ? (
            <KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        events === null ? (
          galat ? <KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} /> : <KerangkaDaftar />
        ) : galat ? null : (
          <KeadaanKosong
            Ikon={CalendarDays}
            kalimat={KOSONG_ACARA}
            aksi={{ label: TEKS_BUAT_ACARA, onPress: buat }}
          />
        )
      }
      renderItem={({ item }) => <KartuAcara acara={item} kiniMs={kini} />}
    />
  );
}

/** Kartu acara (pola daftar §7.1): "● LIVE" hijau, judul, waktu · tempat, jumlah RSVP. */
function KartuAcara({ acara, kiniMs }: { acara: EventSummary; kiniMs: number }) {
  const hijau = useColor("verified");
  return (
    <Pressable onPress={() => router.push(`/events/${acara.eventId}`)} accessibilityRole="button">
      <Card style={s.kartu}>
        {acaraLive(acara, kiniMs) ? (
          <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {TEKS_LIVE}
          </Text>
        ) : null}
        <Text variant="body" style={s.tebal}>{acara.title}</Text>
        <Text variant="caption">{metaAcara(acara, new Date(kiniMs))}</Text>
        <Text variant="caption">{teksRsvp(acara.rsvpCount ?? 0)}</Text>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
  kepala: { gap: 12 },
  kartu: { gap: 4 },
  tebal: { fontWeight: "600" },
});
```

- [ ] **Step 3: Tulis ulang Detail acara**

Timpa `apps/mobile/app/(tabs)/(acara)/events/[id].tsx`:

```tsx
import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Hex } from "viem";
import { isEventLive, lihatEventTypedData, rsvpTypedData } from "@nearly/shared";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/api";
import { getEvent, postRsvp, type EventSummary } from "../../../../src/events-api";
import {
  eventErrorMessage, teksKutandaiHadir, teksPenandaHadir,
} from "../../../../src/messages";
import {
  labelRsvp, pasanganBelumHadir, pasanganRsvp, TEKS_BUKA_QR_HOST, TEKS_BUKA_RADAR_ACARA,
  TEKS_CHECK_IN_SAAT_BERLANGSUNG, TEKS_GAGAL_MUAT_ACARA_INI, TEKS_PINDAI_QR_HOST, TEKS_RSVP_DULU,
  TEKS_RSVP_GAGAL, TEKS_RSVP_TERCATAT,
} from "../../../../src/teks-acara";
import { pasanganCheckIn, TEKS_LIVE } from "../../../../src/teks-beranda";
import { formatTanggalJam } from "../../../../src/waktu";

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

  const [ev, setEv] = useState<EventSummary | null>(null);
  // Diseed dari server (bukan diasumsikan false) — server sudah tahu
  // jawabannya lewat `who`, dan tamu yang RSVP lalu menutup app tidak boleh
  // disuruh RSVP lagi hanya karena state lokal lupa.
  const [sudahRsvp, setSudahRsvp] = useState(false);
  const [sudahCheckIn, setSudahCheckIn] = useState(false);
  // Galat MUAT terpisah dari pesan AKSI: tanpa ini layar yang gagal memuat
  // menampilkan kerangka selamanya (spec §7.2).
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hijau = useColor("verified");

  const load = useCallback(async () => {
    setGalatMuat(null);
    try {
      // Bendera sudahRsvp/sudahCheckIn hanya keluar untuk pemanggil yang
      // MEMBUKTIKAN dirinya alamat itu — tanpa tanda tangan, `?who=` akan
      // jadi oracle yang bisa ditanya siapa pun tentang siapa pun. Tipe
      // LihatEvent dipakai di sini, BUKAN Rsvp: proof baca ini dikirim lewat
      // query string di setiap pembukaan layar, jadi kalau tipenya sama
      // dengan yang diterima POST /events/:id/rsvp, siapa pun yang membaca
      // URL itu (log, proxy) bisa memutarnya ulang sebagai RSVP sungguhan.
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        lihatEventTypedData(
          { eventId: id as Hex, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      const data = await getEvent(id, signer.address, {
        expiresAt: expiresAt.toString(), sig,
      });
      setEv(data);
      setSudahRsvp(data.sudahRsvp === true);
      setSudahCheckIn(data.sudahCheckIn === true);
      return true;
    } catch (e) {
      setGalatMuat(e instanceof ApiError ? eventErrorMessage(e.code) : TEKS_GAGAL_MUAT_ACARA_INI);
      return false;
    }
  }, [id, signer]);

  // Memuat saat fokus (spec §4.6): kembali dari check-in di tab Handshake
  // langsung menampilkan "already checked in" (generasi data, Ruling B2-3).
  useMuatSaatFokus(load);

  async function rsvp() {
    if (busy || !ev) return;
    setBusy(true);
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        rsvpTypedData(
          { eventId: ev.eventId, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      await postRsvp(ev.eventId, {
        eventId: ev.eventId, who: signer.address, expiresAt: expiresAt.toString(), sig,
      });
      setSudahRsvp(true);
      setPesan(TEKS_RSVP_TERCATAT);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rsvped") setSudahRsvp(true);
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : TEKS_RSVP_GAGAL);
    } finally {
      setBusy(false);
    }
  }

  if (!ev) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void load()} />
        ) : (
          <KerangkaDaftar baris={2} />
        )}
      </View>
    );
  }

  const berlangsung = isEventLive(BigInt(ev.startsAt), BigInt(ev.endsAt), Date.now());
  const akuHost = ev.host.toLowerCase() === signer.address.toLowerCase();

  // Tombol check-in TIDAK PERNAH gagal diam-diam (spec §2.2): syaratnya
  // terbaca sebelum orang berdiri di depan host, bukan sesudah. Kalau tamu
  // sudah check-in, jangan tawarkan tautan pindai lagi — beri tahu saja.
  const alasanTakBisaCheckIn = sudahCheckIn
    ? eventErrorMessage("already_checked_in")
    : !sudahRsvp
      ? TEKS_RSVP_DULU
      : !berlangsung
        ? TEKS_CHECK_IN_SAAT_BERLANGSUNG
        : null;

  const barisPenandaHadir = teksPenandaHadir(ev.penandaHadir);
  const barisKutandaiHadir = teksKutandaiHadir(ev.kutandaiHadir);
  const kehadiran = [
    pasanganRsvp(ev.rsvps ?? 0),
    pasanganCheckIn(ev.checkins ?? 0),
    pasanganBelumHadir(ev.rsvpBelumHadir ?? 0),
  ];

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      <View style={s.kepala}>
        {berlangsung ? (
          <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {TEKS_LIVE}
          </Text>
        ) : null}
        <Text variant="title">{ev.title}</Text>
        {ev.venueLabel ? <Text variant="caption">{ev.venueLabel}</Text> : null}
        <Text variant="caption">{formatTanggalJam(new Date(Number(ev.startsAt) * 1000), new Date())}</Text>
      </View>

      <Card style={s.kartu}>
        {/* Nilai lebih keras dari labelnya (§7.1). */}
        {kehadiran.map((p) => (
          <View key={p.kata} style={s.barisNilai}>
            <Text variant="body" style={s.tebal}>{p.angka}</Text>
            <Text variant="caption" style={s.menyusut}>{p.kata}</Text>
          </View>
        ))}
        {/*
          `undefined` untuk keduanya adalah keadaan NORMAL, bukan nol — untuk
          orang yang membuka tautan tanpa signer, dan untuk penandaHadir juga
          pada acara yang belum melewati kedua ambang k-anonimitas (spec §4.3).
          Gerbangnya di fungsi murni src/messages.ts supaya bisa diuji tanpa
          merender apa pun — regresi "0" di sini mengubah penyembunyian yang
          disengaja menjadi klaim yang bisa bohong.
        */}
        {barisPenandaHadir !== null ? <Text variant="caption">{barisPenandaHadir}</Text> : null}
        {barisKutandaiHadir !== null ? <Text variant="caption">{barisKutandaiHadir}</Text> : null}
      </Card>

      <View style={s.aksi}>
        {!sudahRsvp ? (
          <Button loading={busy} disabled={busy} onPress={() => void rsvp()}>{labelRsvp(busy)}</Button>
        ) : null}

        {alasanTakBisaCheckIn ? (
          <Text variant="caption">{alasanTakBisaCheckIn}</Text>
        ) : (
          <Button variant="outline" onPress={() => router.navigate("/salaman?mode=pindai")}>
            {TEKS_PINDAI_QR_HOST}
          </Button>
        )}

        {/* Radar hanya untuk yang sudah check-in, selama acara berlangsung (spec 4b+5 §8.1). */}
        {berlangsung && sudahCheckIn ? (
          <Button variant="outline" onPress={() => router.push(`/radar/${ev.eventId}`)}>
            {TEKS_BUKA_RADAR_ACARA}
          </Button>
        ) : null}

        {akuHost ? (
          <Button variant="outline" onPress={() => router.push(`/events/${ev.eventId}/host-qr`)}>
            {TEKS_BUKA_QR_HOST}
          </Button>
        ) : null}

        {pesan ? <Text variant="caption">{pesan}</Text> : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  muat: { flex: 1, padding: 16 },
  kepala: { gap: 4 },
  kartu: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  menyusut: { flexShrink: 1 },
  tebal: { fontWeight: "600" },
  aksi: { gap: 12 },
});
```

- [ ] **Step 4: Daftarkan kedua kunci dan perbarui satu asersi judul**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di akhir isi `LAYAR_TERMIGRASI` (sesudah `"(tabs)/(profil)/blokir",`):

```ts
  // Rencana B2 kelompok (d) — Acara (spec §9 langkah 5d).
  "(tabs)/(acara)/events/index",
  "(tabs)/(acara)/events/[id]",
```

Di `apps/mobile/test/judul-layar.test.ts`, ganti `    expect(opsiTampilan("(tabs)/(acara)/events/[id]")).toEqual({});` dengan `    expect(opsiTampilan("(tabs)/(acara)/events/[id]", new Set())).toEqual({});` (Detail acara kini termigrasi dan mendapat latar gelap; asersinya tentang judul besar, bukan latar).

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/acara.test.ts test/judul-layar.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/tautan.test.ts test/dompet-tanpa-kunci-dev.test.ts`
Expected: PASS.

- [ ] **Step 6: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/test/acara.test.ts "apps/mobile/app/(tabs)/(acara)/events/index.tsx" "apps/mobile/app/(tabs)/(acara)/events/[id].tsx" apps/mobile/src/judul-layar.ts apps/mobile/test/judul-layar.test.ts
git commit -m "feat(mobile): migrasi daftar Acara dan Detail acara — LIVE di atas, galat + Try again, Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Mutasi**

Di `events/index.tsx`, ganti `liveDulu(events, kini)` dengan `events`. Run: `vitest run test/acara.test.ts`. Expected merah: `acara LIVE di atas daftar; waktu lewat metaAcara, bukan toLocaleString`. Kembalikan.

---

## Task 7: Migrasi Buat acara dan QR check-in host

**Files:**
- Modify: `apps/mobile/app/(tabs)/(acara)/events/new.tsx` (tulis ulang), `apps/mobile/app/(tabs)/(acara)/events/[id]/host-qr.tsx` (tulis ulang), `apps/mobile/components/ui/input.tsx` (placeholder bawaan), `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/acara.test.ts`

**Interfaces:**
- Consumes: Task 4 `tandaiDataBerubah`; Task 5 `teks-acara`; `useKabar`; `Input`; `useCheckInQr` (tidak berubah kecuali kalimat cadangan di Task 5).
- Produces: `LAYAR_TERMIGRASI` memuat `"(tabs)/(acara)/events/new"` dan `"(tabs)/(acara)/events/[id]/host-qr"`; `Input` tanpa placeholder bawaan.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/acara.test.ts`:

```ts
const buat = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/new.tsx"));
const qrHost = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/[id]/host-qr.tsx"));

describe("Buat acara (spec §7.1 pola formulir)", () => {
  it("dimigrasi; label kecil di atas Input BNA", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/new")).toBe(true);
    const x = buat();
    expect(x).toContain('<Text variant="caption">{LABEL_NAMA_ACARA}</Text>');
    expect(x).toContain('<Text variant="caption">{LABEL_TEMPAT_ACARA}</Text>');
    expect(x).not.toContain("WARNA");
  });

  it("berhasil → toast + generasi data naik, lalu pindah ke detail", () => {
    const x = buat();
    const berhasil = x.slice(x.indexOf("await postCreateEvent("), x.indexOf("router.replace(`/events/${eventId}`)"));
    expect(berhasil).toContain("kabar.berhasil(TEKS_ACARA_DIBUAT);");
    expect(berhasil).toContain("tandaiDataBerubah();");
  });

  it("galat bukan ApiError tidak merender Error.message (Ruling B2-14)", () => {
    const x = buat();
    expect(x).toContain("kalimatGagalAcara(e, TEKS_GAGAL_BUAT_ACARA)");
    expect(x).not.toContain("e.message");
  });
});

describe("QR check-in host (spec §4.6, §7.1 pola detail)", () => {
  it("dimigrasi; QR hanya dipasang saat layar fokus (review Rencana A #2)", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/[id]/host-qr")).toBe(true);
    const x = qrHost();
    expect(x).toContain("const fokus = useIsFocused();");
    expect(x).toContain("return fokus ? <QrCheckInAktif signer={signer} /> : null;");
  });

  it("QR di atas pelat terang, ukuran token, petunjuk berbahasa Inggris", () => {
    const x = qrHost();
    expect(x).toContain('const pelat = useColor("text");');
    expect(x).toContain("<QRCode value={value} size={UKURAN.qr} />");
    expect(x).toContain("teksPetunjukQrHost(secondsLeft)");
  });
});

describe("Input BNA tanpa placeholder bawaan (Ruling B2-15)", () => {
  it("tidak ada 'Type your message...' di salinan Input", () => {
    expect(baca("components/ui/input.tsx")).not.toContain("Type your message");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/acara.test.ts`
Expected: FAIL — tiga `describe` baru merah.

- [ ] **Step 2: Hapus placeholder bawaan salinan Input**

Di `apps/mobile/components/ui/input.tsx`, ganti **kedua** kemunculan `placeholder={placeholder || 'Type your message...'}` dengan `placeholder={placeholder}`.

- [ ] **Step 3: Tulis ulang Buat acara**

Timpa `apps/mobile/app/(tabs)/(acara)/events/new.tsx`:

```tsx
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { cellToBytes32, createEventTypedData, makeEventId } from "@nearly/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { getCurrentCell } from "../../../../src/location";
import { ApiError } from "../../../../src/api";
import { postCreateEvent } from "../../../../src/events-api";
import { eventErrorMessage } from "../../../../src/messages";
import { tandaiDataBerubah } from "../../../../src/muat-fokus";
import {
  catatanPusatAcara, kalimatGagalAcara, LABEL_NAMA_ACARA, LABEL_TEMPAT_ACARA, labelBuatAcara,
  TEKS_ACARA_DIBUAT, TEKS_GAGAL_BUAT_ACARA,
} from "../../../../src/teks-acara";

/** Acara berdurasi tiga jam mulai sekarang. Fase ini tidak punya pemilih tanggal. */
const DURASI_DETIK = 3 * 3600;

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
  const kabar = useKabar();

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function buat() {
    if (busy || title.trim().length === 0) return;
    setBusy(true);
    try {
      const { cell } = await getCurrentCell();
      const eventId = makeEventId();
      const startsAt = BigInt(Math.floor(Date.now() / 1000));
      const endsAt = startsAt + BigInt(DURASI_DETIK);
      const expiresAt = startsAt + 600n;

      const sigHost = await signer.signTypedData(
        createEventTypedData(
          {
            eventId, host: signer.address, startsAt, endsAt,
            centerCell: cellToBytes32(cell), expiresAt,
          },
          CONFIG.attendanceRegistry,
        ),
      );

      await postCreateEvent({
        eventId, host: signer.address, title: title.trim(), venueLabel: venue.trim(),
        cell, startsAt: startsAt.toString(), endsAt: endsAt.toString(),
        expiresAt: expiresAt.toString(), sigHost,
      });
      // Aksi penting → toast + haptic (spec §7.2, Ruling B2-6). Daftar Acara
      // memuat ulang saat kembali, walau belum 30 detik (Ruling B2-3).
      kabar.berhasil(TEKS_ACARA_DIBUAT);
      tandaiDataBerubah();
      router.replace(`/events/${eventId}`);
    } catch (e) {
      setPesan(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : kalimatGagalAcara(e, TEKS_GAGAL_BUAT_ACARA),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.bagian}>
        <Text variant="caption">{LABEL_NAMA_ACARA}</Text>
        <Input value={title} onChangeText={setTitle} editable={!busy} accessibilityLabel={LABEL_NAMA_ACARA} />
      </View>
      <View style={s.bagian}>
        <Text variant="caption">{LABEL_TEMPAT_ACARA}</Text>
        <Input value={venue} onChangeText={setVenue} editable={!busy} accessibilityLabel={LABEL_TEMPAT_ACARA} />
      </View>
      <Text variant="caption">{catatanPusatAcara()}</Text>
      <Button loading={busy} disabled={busy} onPress={() => void buat()}>{labelBuatAcara(busy)}</Button>
      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  bagian: { gap: 8 },
});
```

- [ ] **Step 4: Tulis ulang QR check-in host**

Timpa `apps/mobile/app/(tabs)/(acara)/events/[id]/host-qr.tsx`:

```tsx
import { useIsFocused, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Hex } from "viem";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../../../src/config";
import type { NearlySigner } from "../../../../../src/signer";
import { useNearlySigner } from "../../../../../src/dompet/konteks-dompet";
import { useCheckInQr } from "../../../../../src/events/useCheckInQr";
import { teksPetunjukQrHost } from "../../../../../src/teks-acara";

export default function HostQrScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <HostQrScreenIsi key={signer.address} signer={signer} />;
}

function HostQrScreenIsi({ signer }: { signer: NearlySigner }) {
  // Layar di dalam tab tetap terpasang saat host pindah tab. Tanpa gerbang
  // fokus, useCheckInQr terus membaca GPS, menandatangani, dan mengirim
  // tawaran check-in tiap 30 detik tanpa ada yang melihat (review Rencana A #2,
  // spec §4.6). QR dilepas saat tidak fokus, jadi intervalnya ikut berhenti.
  const fokus = useIsFocused();
  return fokus ? <QrCheckInAktif signer={signer} /> : null;
}

function QrCheckInAktif({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { value, secondsLeft, error } = useCheckInQr(signer, id as Hex);
  const pelat = useColor("text");

  // Tanpa "Try again": useCheckInQr sengaja tidak mengekspor refresh (lihat
  // komentar di hook itu). Galat yang bisa pulih dicoba lagi sendiri oleh
  // rotasi 30 detik; penolakan 4xx memang tidak akan berubah.
  if (error) {
    return (
      <View style={s.root}>
        <Text variant="body" style={s.rata}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      {/* Pelat terang: kode QR gelap di atas latar gelap tidak terbaca kamera
          tamu (pola yang sama dengan mode Show QR, spec §6.2). */}
      <View style={[s.pelat, { backgroundColor: pelat }]}>
        {value ? (
          <QRCode value={value} size={UKURAN.qr} />
        ) : (
          <Skeleton width={UKURAN.qr} height={UKURAN.qr} />
        )}
      </View>
      {value ? <Text variant="body" style={s.rata}>{teksPetunjukQrHost(secondsLeft)}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 24, padding: 24 },
  pelat: { padding: 12, borderRadius: RADIUS.pelatQr },
  rata: { textAlign: "center" },
});
```

- [ ] **Step 5: Daftarkan kedua kunci**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di bawah dua kunci Acara dari Task 6:

```ts
  "(tabs)/(acara)/events/new",
  "(tabs)/(acara)/events/[id]/host-qr",
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/acara.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/warna-isian.test.ts test/dompet-tanpa-kunci-dev.test.ts test/profil-saya.test.ts test/profil-orang.test.ts`
Expected: PASS. (`warna-isian.test.ts` masih memeriksa `<TextInput` yang tersisa di layar lain; Buat acara tidak lagi punya `<TextInput`.)

- [ ] **Step 7: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add "apps/mobile/app/(tabs)/(acara)/events/new.tsx" "apps/mobile/app/(tabs)/(acara)/events/[id]/host-qr.tsx" apps/mobile/components/ui/input.tsx apps/mobile/src/judul-layar.ts apps/mobile/test/acara.test.ts
git commit -m "feat(mobile): migrasi Buat acara dan QR check-in host; Input tanpa placeholder bawaan BNA

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi**

Di `events/new.tsx`, hapus baris `      tandaiDataBerubah();`. Run: `vitest run test/acara.test.ts`. Expected merah: `berhasil → toast + generasi data naik, lalu pindah ke detail`. Kembalikan.

---

## Task 8: Migrasi Radar — dua bagian, "N people visible here", koneksi bersama

**Files:**
- Create: `apps/mobile/test/radar.test.ts`
- Modify: `apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx` (tulis ulang), `apps/mobile/src/judul-layar.ts`

**Interfaces:**
- Consumes: Task 5 `teks-radar`, `lencanaKartuRadar(): string | null`, `KartuRadarApi.koneksiBersama`; `KartuOrang`, `Lencana` (`ringkas`, `teks`), `TautanKecil`, `tierDariLabel`.
- Produces: `LAYAR_TERMIGRASI` memuat `"(tabs)/(acara)/radar/[eventId]"`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/radar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const radar = () => tanpaKomentar(baca("app/(tabs)/(acara)/radar/[eventId].tsx"));

describe("Radar (spec §6.4, keputusan #10)", () => {
  it("dimigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/radar/[eventId]")).toBe(true);
  });

  it("siklus detak 60 dtk / radar 10 dtk hanya selama fokus tetap", () => {
    const x = radar();
    expect(x).toContain("const JEDA_DETAK_MS = 60_000;");
    expect(x).toContain("const JEDA_RADAR_MS = 10_000;");
    expect(x).toContain("useFocusEffect(useCallback(() => {");
    expect(x).toContain("clearInterval(tDetak); clearInterval(tRadar);");
  });

  it("N people visible here dari `jumlah` respons, bukan jumlah kartu (#10e)", () => {
    const x = radar();
    expect(x).toContain("pasanganTerlihatDiSini(radar.jumlah)");
    expect(x).toContain("setRadar({ kartu: r.kartu, jumlah: r.jumlah, pada: new Date() });");
    expect(x).toContain("teksDiperbarui(radar.pada, kini)");
  });

  it("dua bagian dari urutan server, kartu memakai KartuOrang + batang dari tierDariLabel (#10f)", () => {
    const x = radar();
    expect(x).toContain("pisahKartuRadar(radar ? radar.kartu : [])");
    expect(x).toContain("<BagianRadar judul={JUDUL_KONEKSI_DI_SINI} kartu={koneksi} />");
    expect(x).toContain("<BagianRadar judul={JUDUL_BELUM_DITEMUI} kartu={belum} />");
    expect(x).toContain("tier={tierDariLabel(k.tierLabel)}");
    // Label tier kawat bahasa Indonesia tidak pernah dirender (spec §7.4).
    expect(x).not.toContain("{k.tierLabel}");
  });

  it("koneksi bersama dan Handshake › hanya untuk yang belum ditemui; tidak ada tombol pesan", () => {
    const x = radar();
    expect(x).toContain("keterangan={keteranganKartuRadar(k)}");
    expect(x).toMatch(/\{!k\.pernahBertemu \? \(\s*<TautanKecil label=\{TEKS_HANDSHAKE_KARTU\}/);
    // Jalur impor src/pesan/… sah; yang dilarang adalah NAVIGASI ke pesan.
    expect(x).not.toMatch(/router\.(push|navigate|replace)\([`"]\/pesan/);
  });

  it("keadaan: kosong berikon, galat yang bisa pulih punya Try again yang memasang ulang efek", () => {
    const x = radar();
    expect(x).toContain('<KeadaanKosong Ikon={IkonRadar} kalimat={kalimatRadar("kosong")} />');
    expect(x).toContain("radarBisaDicobaLagi(keadaan)");
    expect(x).toContain("onCobaLagi={() => setPercobaan((n) => n + 1)}");
    expect(x).toContain("}, [eventId, signer, percobaan]));");
  });

  it("Tersembunyi mengarah ke tab Profile lewat navigate lintas tab", () => {
    expect(radar()).toContain('router.navigate("/profil-saya")');
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/radar.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tulis ulang layar Radar**

Timpa `apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx`:

```tsx
import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Radar as IkonRadar } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { TautanKecil } from "@/components/tautan-kecil";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { getCurrentCell, LocationDeniedError } from "../../../../src/location";
import { sesiPesan, type SesiPesan } from "../../../../src/pesan/sesi";
import { daftarkanPush } from "../../../../src/pesan/push";
import { getRadar, postDetak, type KartuRadarApi } from "../../../../src/radar/radar-api";
import {
  kalimatRadar, keadaanRadarDariDetak, keadaanRadarDariKode, lencanaKartuRadar, type KeadaanRadar,
} from "../../../../src/messages";
import {
  JUDUL_BELUM_DITEMUI, JUDUL_KONEKSI_DI_SINI, keteranganKartuRadar, pasanganTerlihatDiSini,
  PIL_TERLIHAT, pisahKartuRadar, radarBisaDicobaLagi, TEKS_BUKA_PROFIL_SAYA, TEKS_HANDSHAKE_KARTU,
  teksDiperbarui,
} from "../../../../src/teks-radar";
import { tierDariLabel } from "../../../../src/tier";

/** Spec 4b+5 §8.2: detak setiap 60 detik, radar setiap 10 detik, hanya selama fokus. */
const JEDA_DETAK_MS = 60_000;
const JEDA_RADAR_MS = 10_000;

/** Hasil radar terakhir yang berhasil, dengan jam HP saat diterima (spec desain UI §6.4). */
type HasilRadar = { kartu: KartuRadarApi[]; jumlah: number; pada: Date };

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
  const [radar, setRadar] = useState<HasilRadar | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanRadar | null>(null);
  // "Try again" memasang ulang efek fokus: detak segera, lalu jadwal biasa
  // (Ruling B2-12).
  const [percobaan, setPercobaan] = useState(0);
  const hijau = useColor("verified");

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
        setRadar(null);
      }
    };

    const ambilRadar = async () => {
      if (!sesi || !hadir) return;
      try {
        const r = await getRadar(sesi, eventId);
        if (!aktif) return;
        setRadar({ kartu: r.kartu, jumlah: r.jumlah, pada: new Date() });
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
  }, [eventId, signer, percobaan]));

  if (radar === null && keadaan === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  const kini = new Date();
  const { koneksi, belum } = pisahKartuRadar(radar ? radar.kartu : []);

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      {radar ? (
        <View style={s.kepala}>
          {/* Radar hanya tampil bagi pemanggil yang Terlihat (gerbang spec 4b+5). */}
          <View style={[s.pil, { borderColor: hijau }]}>
            <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
              {PIL_TERLIHAT}
            </Text>
          </View>
          {/* Nilai lebih keras dari labelnya (§7.1). */}
          <View style={s.barisNilai}>
            <Text variant="title">{pasanganTerlihatDiSini(radar.jumlah).angka}</Text>
            <Text variant="caption" style={s.menyusut}>{pasanganTerlihatDiSini(radar.jumlah).kata}</Text>
          </View>
          <Text variant="caption">{teksDiperbarui(radar.pada, kini)}</Text>
        </View>
      ) : null}

      {keadaan === "kosong" ? (
        <KeadaanKosong Ikon={IkonRadar} kalimat={kalimatRadar("kosong")} />
      ) : keadaan !== null && radarBisaDicobaLagi(keadaan) ? (
        <KeadaanGalat kalimat={kalimatRadar(keadaan)} onCobaLagi={() => setPercobaan((n) => n + 1)} />
      ) : keadaan !== null ? (
        <Text variant="body">{kalimatRadar(keadaan)}</Text>
      ) : null}

      {keadaan === "tersembunyi" ? (
        <TautanKecil label={TEKS_BUKA_PROFIL_SAYA} onPress={() => router.navigate("/profil-saya")} />
      ) : null}

      {koneksi.length > 0 ? <BagianRadar judul={JUDUL_KONEKSI_DI_SINI} kartu={koneksi} /> : null}
      {belum.length > 0 ? <BagianRadar judul={JUDUL_BELUM_DITEMUI} kartu={belum} /> : null}
    </ScrollView>
  );
}

/** Satu bagian: label redup + jumlah kartu yang lebih keras (§7.1), lalu kartunya dalam urutan server. */
function BagianRadar({ judul, kartu }: { judul: string; kartu: KartuRadarApi[] }) {
  return (
    <View style={s.bagian}>
      <View style={s.barisNilai}>
        <Text variant="caption" style={s.menyusut}>{judul}</Text>
        <Text variant="body" style={s.tebal}>{String(kartu.length)}</Text>
      </View>
      {kartu.map((k) => <KartuRadar key={k.address} k={k} />)}
    </View>
  );
}

/**
 * Bukan peta, tanpa jarak, arah, atau jam detak (spec 4b+5 §3). Tidak ada
 * tombol pesan: pesan tetap hanya lewat koneksi, dari profil.
 */
function KartuRadar({ k }: { k: KartuRadarApi }) {
  const saling = lencanaKartuRadar(k);
  return (
    <View style={s.kartu}>
      <KartuOrang
        nama={k.displayName}
        alamat={k.address}
        terverifikasi={k.pernahBertemu}
        lencana={
          k.pernahBertemu || saling ? (
            <View style={s.lencana}>
              {k.pernahBertemu ? <Lencana varian="ringkas" /> : null}
              {saling ? <Lencana varian="teks" teks={saling} /> : null}
            </View>
          ) : undefined
        }
        keterangan={keteranganKartuRadar(k)}
        tier={tierDariLabel(k.tierLabel)}
        onPress={() => router.push(`/profile/${k.address}`)}
      />
      {!k.pernahBertemu ? (
        <TautanKecil label={TEKS_HANDSHAKE_KARTU} onPress={() => router.navigate("/salaman")} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 8 },
  pil: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.lencana, paddingHorizontal: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  menyusut: { flexShrink: 1 },
  tebal: { fontWeight: "600" },
  bagian: { gap: 12 },
  kartu: { gap: 4 },
  lencana: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
```

- [ ] **Step 3: Daftarkan kunci**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di bawah kunci Acara:

```ts
  "(tabs)/(acara)/radar/[eventId]",
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/radar.test.ts test/teks-radar.test.ts test/rute-push.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/tautan.test.ts test/dompet-tanpa-kunci-dev.test.ts`
Expected: PASS.

- [ ] **Step 5: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/test/radar.test.ts "apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx" apps/mobile/src/judul-layar.ts
git commit -m "feat(mobile): migrasi Radar — dua bagian, N people visible here, koneksi bersama, batang tier

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi**

Di `radar/[eventId].tsx`, ganti `pasanganTerlihatDiSini(radar.jumlah)` (kedua kemunculan) dengan `pasanganTerlihatDiSini(radar.kartu.length)`. Run: `vitest run test/radar.test.ts`. Expected merah: `N people visible here dari \`jumlah\` respons, bukan jumlah kartu (#10e)`. Kembalikan.

---

## Task 9: ⛔ GERBANG STOP — uji iPhone pemilik (Minor + Acara + Radar)

**Files:** tidak ada.

Pelaksana **berhenti** di sini dan melapor ke controller: daftar commit Task 1–8, hasil `pnpm -r test` / `pnpm -r typecheck`, dan ekspor bundel. Controller mem-push `desain-ui` lalu meminta pemilik project menguji di iPhone (Expo Go, `npx expo start --go -c` dijalankan **pemilik**). Task 10 **tidak dimulai** sebelum pemilik menjawab.

- [ ] **Step 1: Uji pemilik — keamanan 12 kata (M3)**
  1. Profile › Wallet › "Show 12-word recovery phrase" → Show → kata tampil. Pindah ke tab Home, kembali ke Profile › Wallet → **kata sudah tertutup** (tombol "Show …" tampil lagi).
  2. Buka kata lagi, lalu usap ke app switcher (tanpa keluar penuh) → **cuplikan Nearly tidak memuat 12 kata**; kembali ke aplikasi → kata tertutup.
  3. Buka kata lagi, kunci HP, buka lagi → kata tertutup.
- [ ] **Step 2: Uji pemilik — butir Minor lain**
  1. Profil orang yang terkoneksi: ketuk **Vouch** → pilih tag → ketuk kirim dua kali cepat → hanya satu toast "Vouch sent.", tanpa galat "already vouched".
  2. Text Size dua takik di atas bawaan → Profil orang: "Undo want to meet" / "Send message" membungkus, tidak terpotong; kembalikan ukuran.
  3. Salaman dengan orang baru → tab Home → kartu "Recently met" **langsung** memuat orang itu (tanpa menunggu 30 detik); tab Profile → angka koneksi naik.
  4. Profile › "You both want to meet" dan "Blocked": matikan Wi-Fi, pindah tab lalu kembali → daftar yang sudah tampil **tetap tampil**, galat + Try again muncul di atasnya; nyalakan Wi-Fi → Try again memuat ulang.
  5. Profile: ketik nama baru tanpa Save → kepala **tidak** ikut berubah; Save → kepala berubah. Baris tautan bertanda ›.
- [ ] **Step 3: Uji pemilik — Acara**
  1. Tab Events: judul besar; "Create event" di baris pertama; acara LIVE di atas bertanda "● LIVE"; tanggal "Sep 21, 19:42"; "N RSVPs".
  2. Create event → toast "Event created." + getar → Detail acara; tombol kembali → daftar sudah memuat acara baru.
  3. Detail acara: angka RSVP / checked in / not checked in yet lebih keras dari labelnya; "Scan the host's QR to check in" → tab Handshake mode Scan.
  4. Host: "Open check-in QR (you're the host)" → QR di pelat terang, "Ask guests to scan this to check in. Changes in N seconds."; pindah tab lalu kembali → QR baru (tidak berjalan di latar).
  5. Tamu check-in → kembali ke Events › acara → "You've already checked in at this event." tanpa menunggu 30 detik.
- [ ] **Step 4: Uji pemilik — Radar (dua HP lain di acara live: satu koneksi, satu belum)**
  1. "● Visible", "N people visible here" (N lebih besar dari kata), "Updated just now".
  2. Bagian "Your connections here" dengan ✓ ringkas dan "Not met yet" dengan "here now · N mutual connections" (bila ada) + "Handshake ›" → tab Handshake.
  3. Batang trust di setiap kartu; tidak ada label tier Indonesia.
  4. Profil diset Hidden → Radar: kalimat Hidden + "Open your profile" → tab Profile.
  5. Matikan Wi-Fi di Radar → kartu tetap tampil + galat "Nearly's server can't be reached…" dengan Try again. Catat waktu muat radar (spec §8.5).
- [ ] **Step 5: Catat hasil**

Controller mencatat jawaban pemilik (lulus / temuan) sebagai komentar di PR #5. Temuan yang memblokir diperbaiki **sebelum** Task 10, sebagai task tambahan yang disetujui pemilik.

---

## Task 10: Teks Pesan

**Files:**
- Create: `apps/mobile/src/teks-pesan.ts`, `apps/mobile/test/teks-pesan.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`PESAN_MESSAGES`, `pesanErrorMessage`, `labelKirimPesan`, `petunjukLaporan`), `apps/mobile/src/teks-ui.ts` (`teksSisaKarakter`), `apps/mobile/src/waktu.ts` (`hariSama`), `apps/mobile/test/pesan-messages.test.ts`, `apps/mobile/test/waktu.test.ts`, `apps/mobile/test/teks-ui.test.ts`

**Interfaces:**
- Consumes: `MIN_ALASAN_LAPORAN` (`src/pesan/pesan-actions.ts`), `jamak`.
- Produces (`src/teks-pesan.ts`): `KOSONG_PESAN`, `TEKS_PESAN_TIDAK_TERVERIFIKASI`, `TEKS_GAGAL_MUAT_DAFTAR_PESAN`, `TEKS_GAGAL_MUAT_PERCAKAPAN`, `TEKS_GAGAL_KIRIM_PESAN`, `JUDUL_DIALOG_BLOKIR`, `ISI_DIALOG_BLOKIR`, `TEKS_BLOKIR`, `PLACEHOLDER_PESAN`, `TEKS_TERENKRIPSI`, `LABEL_OPSI_LAIN`, `perluPemisahHari(daftar, i)`, `PERINGATAN_LAPOR_PESAN`, `labelPilihBukti(maks)`, `KOSONG_BUKTI`, `placeholderAlasanLapor()`, `TEKS_GAGAL_MUAT_BUKTI`, `TEKS_GAGAL_KIRIM_LAPORAN`, `JUDUL_LAPORAN_TERKIRIM`, `ISI_LAPORAN_TERKIRIM`, `TEKS_NANTI`, `teksLaporanTerkirimGagalBlokir(alasan)`.
- Produces: `teksSisaKarakter(n)` (`src/teks-ui.ts`, dipakai Percakapan dan Unggahan baru), `hariSama(a, b)` (`src/waktu.ts`).

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/teks-pesan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MIN_ALASAN_LAPORAN } from "../src/pesan/pesan-actions";
import {
  labelPilihBukti, perluPemisahHari, placeholderAlasanLapor, teksLaporanTerkirimGagalBlokir,
} from "../src/teks-pesan";

describe("teks Pesan (spec §6.5, §7.4)", () => {
  it("label pilih bukti menyebut batasnya", () => {
    expect(labelPilihBukti(5)).toBe("Select 1–5 messages as evidence");
  });

  it("placeholder alasan menyebut batas minimal dari konstanta yang sama dengan server", () => {
    expect(placeholderAlasanLapor()).toBe(`Reason (at least ${MIN_ALASAN_LAPORAN} characters)`);
  });

  // Laporannya SUDAH terkirim — kalimat ini tidak boleh mengaku sebaliknya.
  it("laporan terkirim tapi blokir gagal: dengan dan tanpa alasan", () => {
    expect(teksLaporanTerkirimGagalBlokir(null)).toBe("Report sent, but blocking failed.");
    expect(teksLaporanTerkirimGagalBlokir("You can't block yourself.")).toBe(
      "Report sent, but blocking failed: You can't block yourself.",
    );
  });
});

describe("perluPemisahHari (Ruling B2-11)", () => {
  // Daftar terbaru dulu (FlatList `inverted`): pemisah tampil di atas pesan
  // TERLAMA pada harinya, yaitu bila pesan sesudahnya di larik berbeda hari.
  const ms = (h: number, j: number) => new Date(2026, 8, h, j).getTime();
  const daftar = [{ createdAtMs: ms(21, 10) }, { createdAtMs: ms(21, 9) }, { createdAtMs: ms(20, 22) }];

  it("pesan terlama pada harinya mendapat pemisah; yang lain tidak", () => {
    expect(perluPemisahHari(daftar, 0)).toBe(false);
    expect(perluPemisahHari(daftar, 1)).toBe(true);
    expect(perluPemisahHari(daftar, 2)).toBe(true);
  });

  it("indeks di luar larik tidak mendapat pemisah", () => {
    expect(perluPemisahHari(daftar, 3)).toBe(false);
  });
});
```

Tambahkan di `apps/mobile/test/waktu.test.ts` (impor `hariSama` dari `../src/waktu`):

```ts
describe("hariSama", () => {
  it("hari kalender lokal yang sama, bukan selisih 24 jam", () => {
    expect(hariSama(new Date(2026, 8, 21, 0, 5), new Date(2026, 8, 21, 23, 55))).toBe(true);
    expect(hariSama(new Date(2026, 8, 20, 23, 55), new Date(2026, 8, 21, 0, 5))).toBe(false);
    expect(hariSama(new Date(2025, 8, 21, 10), new Date(2026, 8, 21, 10))).toBe(false);
  });
});
```

Tambahkan di `apps/mobile/test/teks-ui.test.ts` (impor `teksSisaKarakter` dari `../src/teks-ui`):

```ts
describe("teksSisaKarakter", () => {
  it("tunggal dan jamak", () => {
    expect(teksSisaKarakter(1)).toBe("1 character left");
    expect(teksSisaKarakter(99)).toBe("99 characters left");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-pesan.test.ts test/waktu.test.ts test/teks-ui.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tulis fungsi dan teks**

Tambahkan di akhir `apps/mobile/src/waktu.ts`:

```ts
/** Hari kalender lokal yang sama (pemisah hari Percakapan, Ruling B2-11). */
export function hariSama(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
```

Tambahkan di akhir `apps/mobile/src/teks-ui.ts` (dan `import { jamak } from "./jamak";` di atas berkas):

```ts
/** Penghitung isian panjang (Percakapan, Unggahan baru): terjemahan "N karakter tersisa". */
export function teksSisaKarakter(n: number): string {
  return jamak(n, "character left", "characters left");
}
```

Buat `apps/mobile/src/teks-pesan.ts`:

```ts
import { MIN_ALASAN_LAPORAN } from "./pesan/pesan-actions";
import { hariSama } from "./waktu";

/**
 * Teks layar Pesan (spec desain UI §6.5, §7.4): terjemahan 1:1 kalimat yang
 * sudah ada di pesan/index, pesan/[address], dan pesan/lapor/[address].
 * Teks baru hanya "🔒 end-to-end encrypted" dan label "More options" (§7.3).
 */

/* Daftar Pesan — app/(tabs)/(pesan)/pesan/index.tsx */

export const KOSONG_PESAN =
  "No conversations yet. Messages can only be sent to people you've met — open a connection's profile to start.";
export const TEKS_PESAN_TIDAK_TERVERIFIKASI = "This message can't be verified";
export const TEKS_GAGAL_MUAT_DAFTAR_PESAN = "Couldn't load conversations.";

/* Percakapan — app/(tabs)/(pesan)/pesan/[address].tsx */

export const TEKS_GAGAL_MUAT_PERCAKAPAN = "Couldn't load the conversation.";
export const TEKS_GAGAL_KIRIM_PESAN = "Couldn't send the message.";
export const JUDUL_DIALOG_BLOKIR = "Block this person?";
export const ISI_DIALOG_BLOKIR =
  "Report them first if needed — after blocking, their messages can't be selected until you unblock them.";
export const TEKS_BLOKIR = "Block";
export const PLACEHOLDER_PESAN = "Write a message";
/** Fakta spec 4c (§6.5, §7.3). */
export const TEKS_TERENKRIPSI = "🔒 end-to-end encrypted";
/** Label aksesibilitas menu ⋯ (§3.7, §7.3). */
export const LABEL_OPSI_LAIN = "More options";

/**
 * Pemisah hari di atas pesan TERLAMA pada harinya. `daftar` terbaru dulu (FlatList
 * `inverted`), jadi pesan sesudahnya di larik adalah pesan yang lebih lama.
 */
export function perluPemisahHari(daftar: readonly { createdAtMs: number }[], i: number): boolean {
  const ini = daftar[i];
  if (!ini) return false;
  const lebihLama = daftar[i + 1];
  if (!lebihLama) return true;
  return !hariSama(new Date(ini.createdAtMs), new Date(lebihLama.createdAtMs));
}

/* Lapor — app/(tabs)/(pesan)/pesan/lapor/[address].tsx */

export const PERINGATAN_LAPOR_PESAN =
  "The messages you select will be readable by reviewers. Other messages stay encrypted.";

export function labelPilihBukti(maks: number): string {
  return `Select 1–${maks} messages as evidence`;
}

export const KOSONG_BUKTI = "There are no incoming messages that can be used as evidence.";

export function placeholderAlasanLapor(): string {
  return `Reason (at least ${MIN_ALASAN_LAPORAN} characters)`;
}

export const TEKS_GAGAL_MUAT_BUKTI = "Couldn't load messages.";
export const TEKS_GAGAL_KIRIM_LAPORAN = "Couldn't send the report.";

/** Dialog tetap Alert.alert (spec §7.2, Ruling B2-7). */
export const JUDUL_LAPORAN_TERKIRIM = "Report sent";
export const ISI_LAPORAN_TERKIRIM = "Your report will be reviewed. Block this person too?";
export const TEKS_NANTI = "Later";

/** Laporannya SUDAH terkirim — jangan katakan sebaliknya. */
export function teksLaporanTerkirimGagalBlokir(alasan: string | null): string {
  return alasan ? `Report sent, but blocking failed: ${alasan}` : "Report sent, but blocking failed.";
}
```

- [ ] **Step 3: Terjemahkan kalimat lama di `src/messages.ts`**

1. Ganti isi `PESAN_MESSAGES` (kunci tetap, termasuk komentar `terblokir`):

```ts
const PESAN_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  tidak_terhubung: "Messages can only be sent to people you've met.",
  // Netral dengan sengaja, sama seperti `terblokir` di MEET_MESSAGES (Ruling R8
  // Fase 4a): benar untuk blokir satu arah, tidak mengatakan siapa memblokir.
  terblokir: "You can't message this person.",
  belum_siap: "This person hasn't opened messages in Nearly yet. Try again later.",
  terlalu_cepat: "Too many messages in a short time. Wait a moment.",
  terlalu_besar: "The message is too long.",
  pesan_diri: "You can't send a message to yourself.",
  butuh_autentikasi: "Your message session isn't valid. Close this screen, then open it again.",
  bukti_tidak_sah: "The message evidence can't be verified. Reload the conversation, then try again.",
  lapor_diri: "You can't report yourself.",
  expired: "This request has expired. Try again.",
  bad_signature: "The signature doesn't match. Try again.",
  invalid_body: "Some of the details aren't right yet.",
};
```

2. Di `pesanErrorMessage`, ganti `"Gagal. Coba lagi sebentar."` dengan `"Something went wrong. Try again in a moment."`.

3. Ganti badan `labelKirimPesan`: `  return sibuk ? "Sending…" : "Send";`

4. Ganti empat `kurang.push(…)` di `petunjukLaporan`:

```ts
  if (jumlahDipilih < 1) kurang.push("Select at least 1 message as evidence.");
  if (jumlahDipilih > MAKS_BUKTI_LAPORAN) kurang.push(`At most ${MAKS_BUKTI_LAPORAN} messages as evidence.`);
  const panjang = alasan.trim().length;
  if (panjang === 0) kurang.push(`Write a reason, at least ${MIN_ALASAN_LAPORAN} characters.`);
  else if (panjang < MIN_ALASAN_LAPORAN) {
    kurang.push(`The reason needs ${jamak(MIN_ALASAN_LAPORAN - panjang, "more character", "more characters")}.`);
  }
```

- [ ] **Step 4: Perbarui `test/pesan-messages.test.ts`**

1. `const FALLBACK = "Gagal. Coba lagi sebentar.";` → `const FALLBACK = "Something went wrong. Try again in a moment.";`
2. Di `it("terblokir netral", …)` tambahkan sesudah `expect` yang ada:

```ts
    expect(teks).not.toMatch(/blocked you|you blocked|each other/i);
```

3. `labelKirimPesan`: `"Kirim"` → `"Send"`, `"Mengirim…"` → `"Sending…"`.
4. `petunjukLaporan`:
   - `"Pilih minimal 1 pesan sebagai bukti."` → `"Select at least 1 message as evidence."`
   - `"Tulis alasan, minimal 10 karakter."` → `"Write a reason, at least 10 characters."`
   - `"Alasan kurang 6 karakter lagi."` → `"The reason needs 6 more characters."`
   - `"Alasan kurang 1 karakter lagi."` → `"The reason needs 1 more character."`
   - `"Pilih minimal 1 pesan sebagai bukti. Tulis alasan, minimal 10 karakter."` → `"Select at least 1 message as evidence. Write a reason, at least 10 characters."`
   - `"Maksimal 5 pesan sebagai bukti."` → `"At most 5 messages as evidence."`

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-pesan.test.ts test/pesan-messages.test.ts test/waktu.test.ts test/teks-ui.test.ts`
Expected: PASS.

- [ ] **Step 6: Verifikasi penuh, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`.

```bash
git add apps/mobile/src/teks-pesan.ts apps/mobile/test/teks-pesan.test.ts apps/mobile/src/messages.ts apps/mobile/src/teks-ui.ts apps/mobile/src/waktu.ts apps/mobile/test/pesan-messages.test.ts apps/mobile/test/waktu.test.ts apps/mobile/test/teks-ui.test.ts
git commit -m "feat(mobile): teks Pesan dan Lapor berbahasa Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Mutasi**

Di `src/teks-pesan.ts`, ganti `if (!lebihLama) return true;` dengan `if (!lebihLama) return false;`. Run: `vitest run test/teks-pesan.test.ts`. Expected merah: `pesan terlama pada harinya mendapat pemisah; yang lain tidak`. Kembalikan.

---

## Task 11: Migrasi daftar Pesan dan Percakapan

**Files:**
- Create: `apps/mobile/test/pesan-layar.test.ts`
- Modify: `apps/mobile/app/(tabs)/(pesan)/pesan/index.tsx` (tulis ulang), `apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx` (tulis ulang), `apps/mobile/components/kartu-orang.tsx` (`barisKeterangan`), `apps/mobile/theme/globals.ts` (`UKURAN.tombolKirim`), `apps/mobile/src/judul-layar.ts`

**Interfaces:**
- Consumes: Task 10 `teks-pesan`, `teksSisaKarakter`; `KartuOrang`, `Avatar`, `Lencana`, `Input`, `hitSlopSampai`, `useLencana`.
- Produces: `KartuOrang` prop opsional `barisKeterangan?: number` (diteruskan ke `numberOfLines` keterangan); `UKURAN.tombolKirim = 40`; `LAYAR_TERMIGRASI` memuat `"(tabs)/(pesan)/pesan/index"` dan `"(tabs)/(pesan)/pesan/[address]"`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/pesan-layar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { UKURAN } from "../theme/globals";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const daftar = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/index.tsx"));
const obrolan = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/[address].tsx"));

describe("daftar Pesan (spec §7.1 pola daftar, §4.7)", () => {
  it("dimigrasi; FlatList judul besar", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/index")).toBe(true);
    expect(daftar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kartu orang dengan alamat singkat (R4), lencana belum dibaca, pratinjau satu baris", () => {
    const x = daftar();
    expect(x).toContain("<KartuOrang");
    expect(x).toContain("teksLencana(item.belumDibaca)");
    expect(x).toContain("barisKeterangan={1}");
    expect(x).not.toContain("{item.lawan}</Text>");
  });

  it("muat pertama gagal → galat + Try again; muat ulang gagal mempertahankan baris; kosong di samping galat bukan keadaan kosong", () => {
    const x = daftar();
    expect(x).not.toContain("setBaris((b) => b ?? [])");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} />");
    expect(x).toContain("}, [muat, percobaan]));");
    expect(x).toMatch(/\) : galat \? null : \(/);
  });

  it("polling 15 detik hanya selama fokus tetap", () => {
    expect(daftar()).toContain("setInterval(() => { void jalankan(); }, 15_000);");
  });
});

describe("Percakapan (spec §6.5, R6)", () => {
  it("dimigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/[address]")).toBe(true);
  });

  it("kepala: avatar, nama dari satu GET /profile publik, alamat singkat, terenkripsi, menu ⋯ berlabel", () => {
    const x = obrolan();
    expect(x).toContain("req<{ displayName?: string }>(`/profile/${lawan}`)");
    expect(x).toContain("<Text variant=\"mono\">{alamatSingkat(lawan)}</Text>");
    expect(x).toContain("{TEKS_TERENKRIPSI}");
    expect(x).toContain("accessibilityLabel={LABEL_OPSI_LAIN}");
  });

  it("menu ⋯ berisi Report dan Block yang sudah ada — dialog bawaan (Ruling B2-10)", () => {
    const x = obrolan();
    const menu = x.slice(x.indexOf("function bukaMenu()"), x.indexOf("function bukaMenu()") + 600);
    expect(menu).toContain("Alert.alert(");
    expect(menu).toContain("router.push(`/pesan/lapor/${lawan}`)");
    expect(menu).toContain("onPress: blokir");
  });

  it("gelembung keluar primary di kanan, masuk card bergaris di kiri, sudut pengirim 4", () => {
    const x = obrolan();
    expect(x).toContain('const kuning = useColor("primary");');
    expect(x).toContain("borderBottomRightRadius: RADIUS.gelembungSudut");
    expect(x).toContain("borderBottomLeftRadius: RADIUS.gelembungSudut");
    expect(x).toContain("borderRadius: RADIUS.gelembung");
  });

  it("tombol kirim 40×40 dengan hitSlop ke 48 dan label dari labelKirimPesan (§3.7)", () => {
    const x = obrolan();
    expect(UKURAN.tombolKirim).toBe(40);
    expect(x).toContain("hitSlop={hitSlopSampai(UKURAN.tombolKirim)}");
    expect(x).toContain("accessibilityLabel={labelKirimPesan(sibuk)}");
  });

  it("tanpa tanda sudah dibaca (R6); pemisah hari lewat perluPemisahHari", () => {
    const x = obrolan();
    expect(x).not.toContain("dibacaAtMs");
    expect(x).toContain("perluPemisahHari(daftar, index)");
  });

  it("perilaku lama tetap: polling 4 dtk, buka bertahap, tandai dibaca lalu lencana dimuat ulang", () => {
    const x = obrolan();
    expect(x).toContain("setInterval(() => { void jalankan(); }, 4_000);");
    expect(x).toContain("bukaBertahap(pesan, buka,");
    expect(x).toMatch(/await postDibaca\([\s\S]*?muatUlangLencana\(\);/);
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/pesan-layar.test.ts`
Expected: FAIL.

- [ ] **Step 2: `KartuOrang.barisKeterangan` dan `UKURAN.tombolKirim`**

Di `apps/mobile/components/kartu-orang.tsx`:
1. Di `PropsKartuOrang` sesudah `keterangan?: string;` tambahkan:

```tsx
  /** Batas baris keterangan untuk teks ringkasan (pratinjau pesan, spec §3.7). */
  barisKeterangan?: number;
```

2. Ubah destrukturisasi menjadi `({ nama, alamat, terverifikasi, lencana, keterangan, barisKeterangan, tier, onPress }: PropsKartuOrang)`.
3. Ganti `        {keterangan ? <Text variant="caption">{keterangan}</Text> : null}` dengan:

```tsx
        {keterangan ? <Text variant="caption" numberOfLines={barisKeterangan}>{keterangan}</Text> : null}
```

Di `apps/mobile/theme/globals.ts`, di `UKURAN` sesudah `qr: 260,` tambahkan `  tombolKirim: 40,`.

- [ ] **Step 3: Tulis ulang daftar Pesan**

Timpa `apps/mobile/app/(tabs)/(pesan)/pesan/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { sesiPesan } from "../../../../src/pesan/sesi";
import { getPercakapan, type RingkasanPercakapanApi } from "../../../../src/pesan/pesan-api";
import { bukaBaris, kunciLawan } from "../../../../src/pesan/pesan-actions";
import { daftarkanPush } from "../../../../src/pesan/push";
import { pesanErrorMessage, teksLencana } from "../../../../src/messages";
import {
  KOSONG_PESAN, TEKS_GAGAL_MUAT_DAFTAR_PESAN, TEKS_PESAN_TIDAK_TERVERIFIKASI,
} from "../../../../src/teks-pesan";

type Baris = RingkasanPercakapanApi & { pratinjau: string };

export default function DaftarPesanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <DaftarPesanScreenIsi key={signer.address} signer={signer} />;
}

function DaftarPesanScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);

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
        return { ...p, pratinjau: t.status === "sah" ? t.isi : TEKS_PESAN_TIDAK_TERVERIFIKASI };
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
      // Baris yang sudah tampil DIPERTAHANKAN; muat pertama yang gagal
      // meninggalkan `baris` null → galat + Try again (Ruling B2-12).
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_DAFTAR_PESAN);
    });
    void jalankan();
    const t = setInterval(() => { void jalankan(); }, 15_000);
    return () => { aktif = false; clearInterval(t); };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

  const cobaLagi = () => setPercobaan((n) => n + 1);

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris ?? []}
      keyExtractor={(b) => b.lawan}
      ListHeaderComponent={baris !== null && galat ? <KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} /> : null}
      ListEmptyComponent={
        baris === null ? (
          galat ? <KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} /> : <KerangkaDaftar />
        ) : galat ? null : (
          // Daftar kosong di samping galat BUKAN "belum ada percakapan".
          <KeadaanKosong Ikon={MessageCircle} kalimat={KOSONG_PESAN} />
        )
      }
      renderItem={({ item }) => {
        const lencana = teksLencana(item.belumDibaca);
        return (
          <KartuOrang
            nama={item.displayName}
            alamat={item.lawan}
            // Pesan hanya antar-koneksi (spec 4c §4), dan koneksi berlaku
            // selamanya: lawan bicara selalu orang yang pernah kamu temui (R9).
            terverifikasi
            lencana={lencana ? <Lencana varian="teks" teks={lencana} /> : undefined}
            keterangan={item.pratinjau}
            barisKeterangan={1}
            tier={item.tier}
            onPress={() => router.push(`/pesan/${item.lawan}`)}
          />
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
});
```

- [ ] **Step 4: Tulis ulang Percakapan**

Timpa `apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { ArrowUp, Ellipsis } from "lucide-react-native";
import type { Address } from "viem";
import { MAKS_ISI_PESAN } from "@nearly/shared";
import { Avatar } from "@/components/avatar";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { hitSlopSampai } from "../../../../src/aksesibilitas";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { HindariKeyboard } from "../../../../src/hindari-keyboard";
import { ApiError, req } from "../../../../src/http";
import { aksiBlokir } from "../../../../src/blokir-actions";
import { sesiPesan } from "../../../../src/pesan/sesi";
import { getRiwayat, postDibaca } from "../../../../src/pesan/pesan-api";
import { useLencana } from "../../../../src/lencana/konteks-lencana";
import {
  bukaBaris, bukaBertahap, kirimPesan, kunciLawan, type PesanTerbuka,
} from "../../../../src/pesan/pesan-actions";
import {
  alamatSingkat, blokirErrorMessage, labelKirimPesan, pesanErrorMessage, sisaKarakterPesan,
} from "../../../../src/messages";
import { TEKS_BATAL } from "../../../../src/teks-akun";
import { TEKS_LAPOR, teksGagalBlokir } from "../../../../src/teks-profil";
import {
  ISI_DIALOG_BLOKIR, JUDUL_DIALOG_BLOKIR, LABEL_OPSI_LAIN, perluPemisahHari, PLACEHOLDER_PESAN,
  TEKS_BLOKIR, TEKS_GAGAL_KIRIM_PESAN, TEKS_GAGAL_MUAT_PERCAKAPAN, TEKS_PESAN_TIDAK_TERVERIFIKASI,
  TEKS_TERENKRIPSI,
} from "../../../../src/teks-pesan";
import { teksSisaKarakter } from "../../../../src/teks-ui";
import { formatTanggal } from "../../../../src/waktu";

// Memberi event loop kesempatan memproses event keyboard dan sentuhan.
const jedaUi = () => new Promise<void>((r) => { setTimeout(r, 0); });

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
  const [daftar, setDaftar] = useState<PesanTerbuka[] | null>(null);
  const [isi, setIsi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [nama, setNama] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const ditandaiSampai = useRef(0);
  const layarAktif = useRef(false);
  const { muatUlangLencana } = useLencana();
  // Pembukaan PERTAMA dibuat bertahap (lihat bukaBertahap). Polling sesudahnya
  // membuka sekaligus: pesan lama sudah tersimpan dan murah, dan bertahap di
  // setiap polling akan menyusutkan daftar ke bagian awal lalu menumbuhkannya
  // lagi — berkedip tiap 4 detik.
  const tahap = useRef<"belum" | "berjalan" | "selesai">("belum");
  const kuning = useColor("primary");
  const teksDiKuning = useColor("primaryForeground");
  const latarKartu = useColor("card");
  const garis = useColor("border");
  const merah = useColor("destructive");
  const redup = useColor("textMuted");

  // Nama lawan untuk kepala (spec §6.5, Ruling B2-9): SATU GET /profile publik,
  // pola yang sama dengan sheet salaman (R14). Gagal atau kosong → kepala
  // hanya alamat singkat, tanpa pesan galat.
  useEffect(() => {
    let aktif = true;
    req<{ displayName?: string }>(`/profile/${lawan}`)
      .then((p) => { if (aktif) setNama(p.displayName?.trim() || null); })
      .catch(() => {});
    return () => { aktif = false; };
  }, [lawan]);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    if (tahap.current === "berjalan") return; // putaran polling ini dilewati
    // Terbaru dulu — FlatList `inverted` menaruhnya di bawah.
    const buka = (b: (typeof pesan)[number]) => bukaBaris(sesi, k, b);
    if (tahap.current === "belum") {
      tahap.current = "berjalan";
      let selesai = false;
      try {
        selesai = await bukaBertahap(pesan, buka, {
          awal: 8, potongan: 4, jeda: jedaUi,
          masihBerlaku: () => layarAktif.current, tampilkan: setDaftar,
        });
      } finally {
        tahap.current = selesai ? "selesai" : "belum";
      }
      if (!selesai) return;
    } else {
      setDaftar(pesan.map(buka));
    }
    setGalat(null);

    const masukTerbaru = pesan.find((b) => b.pengirim.toLowerCase() === lawan.toLowerCase());
    if (masukTerbaru && masukTerbaru.createdAtMs > ditandaiSampai.current) {
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
      // Lencana tab Pesan turun sekarang, bukan 30 detik lagi (spec desain UI §4.4).
      muatUlangLencana();
    }
  }, [signer, lawan, muatUlangLencana]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    layarAktif.current = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      // Muat pertama yang gagal meninggalkan `daftar` null → galat + Try again;
      // sesudahnya pesan yang sudah tampil dipertahankan (Ruling B2-12).
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_PERCAKAPAN);
    });
    void jalankan();
    // Polling hanya selama layar aktif (spec 4c §9): pembersih di bawah
    // menghentikannya saat layar kehilangan fokus.
    const t = setInterval(() => { void jalankan(); }, 4_000);
    return () => { aktif = false; layarAktif.current = false; clearInterval(t); };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

  async function kirim() {
    if (sibuk || isi.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await kirimPesan(await sesiPesan(signer), lawan, isi);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_KIRIM_PESAN);
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
    Alert.alert(JUDUL_DIALOG_BLOKIR, ISI_DIALOG_BLOKIR, [
      { text: TEKS_BATAL, style: "cancel" },
      {
        text: TEKS_BLOKIR,
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            .catch((e: unknown) => setGalat(
              e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(false)));
        },
      },
    ]);
  }

  // Menu ⋯ (spec §6.5, Ruling B2-10): aksi yang sudah ada di layar ini, dialog bawaan.
  function bukaMenu() {
    Alert.alert(nama ?? alamatSingkat(lawan), undefined, [
      { text: TEKS_LAPOR, onPress: () => router.push(`/pesan/lapor/${lawan}`) },
      { text: TEKS_BLOKIR, style: "destructive", onPress: blokir },
      { text: TEKS_BATAL, style: "cancel" },
    ]);
  }

  const sisa = sisaKarakterPesan(isi);
  const bisaKirim = !sibuk && isi.trim().length > 0 && sisa >= 0;

  if (daftar === null) {
    return (
      <View style={s.muat}>
        {galat ? (
          <KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  const kini = new Date();

  return (
    <HindariKeyboard>
      <View style={s.root}>
        <View style={s.kepala}>
          <Avatar nama={nama} alamat={lawan} ukuran={UKURAN.avatarKartu} cincin="verified" />
          <View style={s.kepalaTeks}>
            {nama ? <Text variant="body" style={s.tebal}>{nama}</Text> : null}
            {/* Nama tidak pernah tanpa alamat (R4, anti-impersonasi). */}
            <Text variant="mono">{alamatSingkat(lawan)}</Text>
            <Text variant="caption">{TEKS_TERENKRIPSI}</Text>
          </View>
          <Pressable
            onPress={bukaMenu}
            accessibilityRole="button"
            accessibilityLabel={LABEL_OPSI_LAIN}
            style={s.tombolMenu}
          >
            <Ellipsis color={redup} size={24} />
          </Pressable>
        </View>

        {galat ? <Text variant="caption" style={{ color: merah }}>{galat}</Text> : null}

        <FlatList
          inverted
          style={s.daftar}
          contentContainerStyle={s.isiDaftar}
          // Isian multiline: return menyisipkan baris, bukan menutup keyboard.
          // Menggeser daftar adalah jalan keluarnya.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          data={daftar}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <View style={s.sel}>
              {/* Di dalam sel `inverted` isi tetap tegak: pemisah tampil di atas
                  pesan TERLAMA pada harinya (Ruling B2-11). */}
              {perluPemisahHari(daftar, index) ? (
                <Text variant="caption" style={s.pemisah}>{formatTanggal(new Date(item.createdAtMs), kini)}</Text>
              ) : null}
              <View
                style={[
                  s.gelembung,
                  item.dariAku
                    ? { alignSelf: "flex-end", backgroundColor: kuning, borderBottomRightRadius: RADIUS.gelembungSudut }
                    : {
                      alignSelf: "flex-start",
                      backgroundColor: latarKartu,
                      borderColor: garis,
                      borderWidth: 1,
                      borderBottomLeftRadius: RADIUS.gelembungSudut,
                    },
                ]}
              >
                <Text
                  variant="body"
                  style={item.status !== "sah" ? { color: merah } : item.dariAku ? { color: teksDiKuning } : undefined}
                >
                  {item.status === "sah" ? item.isi : TEKS_PESAN_TIDAK_TERVERIFIKASI}
                </Text>
              </View>
            </View>
          )}
        />

        <View style={s.tulis}>
          <View style={s.isian}>
            <Input
              value={isi}
              onChangeText={setIsi}
              placeholder={PLACEHOLDER_PESAN}
              accessibilityLabel={PLACEHOLDER_PESAN}
              type="textarea"
              rows={1}
              inputStyle={s.batasTinggi}
              maxLength={MAKS_ISI_PESAN}
            />
          </View>
          <Pressable
            onPress={() => { void kirim(); }}
            disabled={!bisaKirim}
            hitSlop={hitSlopSampai(UKURAN.tombolKirim)}
            accessibilityRole="button"
            accessibilityLabel={labelKirimPesan(sibuk)}
            accessibilityState={{ disabled: !bisaKirim, busy: sibuk }}
            style={[s.kirim, { backgroundColor: kuning, opacity: bisaKirim ? 1 : 0.4 }]}
          >
            <ArrowUp color={teksDiKuning} size={20} />
          </Pressable>
        </View>
        {sisa < 100 ? <Text variant="caption" style={s.kanan}>{teksSisaKarakter(sisa)}</Text> : null}
      </View>
    </HindariKeyboard>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { flex: 1, padding: 12, gap: 8 },
  kepala: { flexDirection: "row", alignItems: "center", gap: 12 },
  kepalaTeks: { flex: 1, gap: 4 },
  tebal: { fontWeight: "600" },
  tombolMenu: {
    width: UKURAN.sentuh,
    height: UKURAN.sentuh,
    alignItems: "center",
    justifyContent: "center",
  },
  daftar: { flex: 1 },
  isiDaftar: { gap: 4 },
  sel: { gap: 8, paddingVertical: 4 },
  pemisah: { alignSelf: "center" },
  gelembung: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.gelembung },
  tulis: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  isian: { flex: 1 },
  batasTinggi: { maxHeight: 120 },
  kirim: {
    width: UKURAN.tombolKirim,
    height: UKURAN.tombolKirim,
    borderRadius: RADIUS.kartu,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kanan: { textAlign: "right" },
});
```

- [ ] **Step 5: Daftarkan kedua kunci**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di akhir isi `LAYAR_TERMIGRASI`:

```ts
  // Rencana B2 kelompok (e) — Pesan (spec §9 langkah 5e).
  "(tabs)/(pesan)/pesan/index",
  "(tabs)/(pesan)/pesan/[address]",
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/pesan-layar.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/warna-isian.test.ts test/komponen.test.ts test/judul-layar.test.ts test/tautan.test.ts test/rute-push.test.ts test/dompet-tanpa-kunci-dev.test.ts`
Expected: PASS.

- [ ] **Step 7: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/test/pesan-layar.test.ts "apps/mobile/app/(tabs)/(pesan)/pesan/index.tsx" "apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx" apps/mobile/components/kartu-orang.tsx apps/mobile/theme/globals.ts apps/mobile/src/judul-layar.ts
git commit -m "feat(mobile): migrasi daftar Pesan dan Percakapan — kepala terenkripsi, gelembung, menu ⋯

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi**

Di `pesan/[address].tsx`, ganti `hitSlop={hitSlopSampai(UKURAN.tombolKirim)}` dengan `hitSlop={0}`. Run: `vitest run test/pesan-layar.test.ts`. Expected merah: `tombol kirim 40×40 dengan hitSlop ke 48 dan label dari labelKirimPesan (§3.7)`. Kembalikan.

---

## Task 12: Migrasi Lapor pesan

**Files:**
- Modify: `apps/mobile/app/(tabs)/(pesan)/pesan/lapor/[address].tsx` (tulis ulang), `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/pesan-layar.test.ts`

**Interfaces:**
- Consumes: Task 10 `teks-pesan`; `labelKirimLaporan` (`src/teks-profil.ts`); `laporanSiapDikirim`, `laporkanPercakapan`, `MAKS_BUKTI_LAPORAN` (`src/pesan/pesan-actions.ts`, tidak berubah).
- Produces: `LAYAR_TERMIGRASI` memuat `"(tabs)/(pesan)/pesan/lapor/[address]"`.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/pesan-layar.test.ts`:

```ts
const lapor = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/lapor/[address].tsx"));

describe("Lapor pesan (spec §7.1 pola formulir)", () => {
  it("dimigrasi; Input BNA, tanpa WARNA", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/lapor/[address]")).toBe(true);
    const x = lapor();
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
  });

  it("hanya pesan MASUK yang terverifikasi yang bisa jadi bukti (spec 4c §8.2)", () => {
    expect(lapor()).toContain('.filter((p): p is PesanSah => !p.dariAku && p.status === "sah")');
  });

  it("baris bukti adalah checkbox aksesibel setinggi target sentuh", () => {
    const x = lapor();
    expect(x).toContain('accessibilityRole="checkbox"');
    expect(x).toContain("accessibilityState={{ checked: dipilihIni }}");
    expect(x).toMatch(/baris: \{[^}]*minHeight: UKURAN\.sentuh/);
  });

  it("peringatan memakai gaya spanduk token; muat pertama gagal → galat + Try again", () => {
    const x = lapor();
    expect(x).toContain('useColor("spandukLatar")');
    expect(x).toContain("{PERINGATAN_LAPOR_PESAN}");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />");
    expect(x).not.toContain("setMasuk([])");
  });

  it("laporan terkirim tetap dialog (Ruling B2-7), dan kegagalan blokir tidak menyangkal laporannya", () => {
    const x = lapor();
    expect(x).toContain("Alert.alert(JUDUL_LAPORAN_TERKIRIM, ISI_LAPORAN_TERKIRIM,");
    expect(x).toContain("teksLaporanTerkirimGagalBlokir(");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/pesan-layar.test.ts`
Expected: FAIL — `describe` Lapor merah.

- [ ] **Step 2: Tulis ulang Lapor**

Timpa `apps/mobile/app/(tabs)/(pesan)/pesan/lapor/[address].tsx`:

```tsx
import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { MessageCircle, Square, SquareCheck } from "lucide-react-native";
import type { Address } from "viem";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../../../src/config";
import type { NearlySigner } from "../../../../../src/signer";
import { useNearlySigner } from "../../../../../src/dompet/konteks-dompet";
import { HindariKeyboard } from "../../../../../src/hindari-keyboard";
import { ApiError } from "../../../../../src/http";
import { aksiBlokir } from "../../../../../src/blokir-actions";
import { sesiPesan } from "../../../../../src/pesan/sesi";
import { getRiwayat } from "../../../../../src/pesan/pesan-api";
import {
  bukaBaris, kunciLawan, laporanSiapDikirim, laporkanPercakapan, MAKS_BUKTI_LAPORAN,
  type PesanTerbuka,
} from "../../../../../src/pesan/pesan-actions";
import { blokirErrorMessage, pesanErrorMessage, petunjukLaporan } from "../../../../../src/messages";
import { labelKirimLaporan } from "../../../../../src/teks-profil";
import {
  ISI_LAPORAN_TERKIRIM, JUDUL_LAPORAN_TERKIRIM, KOSONG_BUKTI, labelPilihBukti,
  PERINGATAN_LAPOR_PESAN, placeholderAlasanLapor, TEKS_BLOKIR, TEKS_GAGAL_KIRIM_LAPORAN,
  TEKS_GAGAL_MUAT_BUKTI, teksLaporanTerkirimGagalBlokir, TEKS_NANTI,
} from "../../../../../src/teks-pesan";

type PesanSah = Extract<PesanTerbuka, { status: "sah" }>;

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
  const [masuk, setMasuk] = useState<PesanSah[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const spandukLatar = useColor("spandukLatar");
  const spandukGaris = useColor("spandukGaris");
  const kuning = useColor("primary");
  const garis = useColor("border");
  const redup = useColor("textMuted");
  const merah = useColor("destructive");

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Hanya pesan MASUK yang terverifikasi yang bisa jadi bukti — server menolak
    // yang lain dengan 422 (spec 4c §8.2).
    setMasuk(pesan.map((b) => bukaBaris(sesi, k, b))
      .filter((p): p is PesanSah => !p.dariAku && p.status === "sah"));
    setGalat(null);
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    muat().catch((e: unknown) => {
      if (!aktif) return;
      // `masuk` dibiarkan null: muat pertama yang gagal tampil sebagai galat
      // + Try again (Ruling B2-12), bukan daftar bukti yang kosong.
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_BUKTI);
    });
    return () => { aktif = false; };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

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
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_KIRIM_LAPORAN);
      setSibuk(false);
      return;
    }
    setSibuk(false);
    Alert.alert(JUDUL_LAPORAN_TERKIRIM, ISI_LAPORAN_TERKIRIM, [
      { text: TEKS_NANTI, style: "cancel", onPress: () => router.back() },
      {
        text: TEKS_BLOKIR,
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            // Laporannya SUDAH terkirim — jangan katakan sebaliknya.
            .catch((e: unknown) => setGalat(teksLaporanTerkirimGagalBlokir(
              e instanceof ApiError ? blokirErrorMessage(e.code) : null)));
        },
      },
    ]);
  }

  const petunjuk = petunjukLaporan(dipilih.size, alasan);

  if (masuk === null) {
    return (
      <View style={s.muat}>
        {galat ? (
          <KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  return (
    <HindariKeyboard>
      <View style={s.root}>
        <View style={[s.spanduk, { backgroundColor: spandukLatar, borderColor: spandukGaris }]}>
          <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_LAPOR_PESAN}</Text>
        </View>
        {galat ? <Text variant="caption" style={{ color: merah }}>{galat}</Text> : null}
        <Text variant="caption" style={s.tebal}>{labelPilihBukti(MAKS_BUKTI_LAPORAN)}</Text>
        <FlatList
          style={s.daftar}
          contentContainerStyle={s.isiDaftar}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          data={masuk}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={<KeadaanKosong Ikon={MessageCircle} kalimat={KOSONG_BUKTI} />}
          renderItem={({ item }) => {
            const dipilihIni = dipilih.has(item.id);
            return (
              <Pressable
                onPress={() => alih(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dipilihIni }}
                style={[s.baris, { borderColor: dipilihIni ? kuning : garis }]}
              >
                {dipilihIni ? <SquareCheck color={kuning} size={20} /> : <Square color={redup} size={20} />}
                <Text variant="body" style={s.menyusut}>{item.isi}</Text>
              </Pressable>
            );
          }}
        />
        <Input
          value={alasan}
          onChangeText={setAlasan}
          placeholder={placeholderAlasanLapor()}
          accessibilityLabel={placeholderAlasanLapor()}
          type="textarea"
          rows={3}
          maxLength={1000}
        />
        {petunjuk ? <Text variant="caption">{petunjuk}</Text> : null}
        <Button
          loading={sibuk}
          disabled={sibuk || !laporanSiapDikirim(dipilih.size, alasan)}
          onPress={() => { void kirim(); }}
        >
          {labelKirimLaporan(sibuk)}
        </Button>
      </View>
    </HindariKeyboard>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { flex: 1, padding: 16, gap: 12 },
  spanduk: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12 },
  tebal: { fontWeight: "600" },
  daftar: { flex: 1 },
  isiDaftar: { gap: 8 },
  baris: {
    minHeight: UKURAN.sentuh,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.kartu,
    padding: 12,
  },
  menyusut: { flex: 1 },
});
```

- [ ] **Step 3: Daftarkan kunci**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di bawah dua kunci Pesan:

```ts
  "(tabs)/(pesan)/pesan/lapor/[address]",
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/pesan-layar.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/warna-isian.test.ts test/pesan-aksi.test.ts`
Expected: PASS.

- [ ] **Step 5: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add "apps/mobile/app/(tabs)/(pesan)/pesan/lapor/[address].tsx" apps/mobile/src/judul-layar.ts apps/mobile/test/pesan-layar.test.ts
git commit -m "feat(mobile): migrasi Lapor pesan — bukti sebagai checkbox, peringatan spanduk, Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi**

Di `lapor/[address].tsx`, ganti `!p.dariAku && p.status === "sah"` dengan `p.status === "sah"`. Run: `vitest run test/pesan-layar.test.ts`. Expected merah: `hanya pesan MASUK yang terverifikasi yang bisa jadi bukti (spec 4c §8.2)`. Kembalikan.

---

## Task 13: Teks Feed dan migrasi Feed + Unggahan baru

**Files:**
- Create: `apps/mobile/src/teks-feed.ts`, `apps/mobile/test/teks-feed.test.ts`, `apps/mobile/test/feed-layar.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`FEED_MESSAGES`, `feedErrorMessage`, `alasanMuncul`), `apps/mobile/src/gambar.ts` (`PESAN_FORMAT_TIDAK_DIDUKUNG`), `apps/mobile/test/feed-alasan.test.ts`, `apps/mobile/test/feed-messages.test.ts`, `apps/mobile/app/(tabs)/(beranda)/feed/index.tsx` (tulis ulang), `apps/mobile/app/(tabs)/(beranda)/feed/new.tsx` (tulis ulang), `apps/mobile/src/judul-layar.ts`

**Interfaces:**
- Consumes: `teksSisaKarakter` (Task 10), `TEKS_LAPOR`, `TEKS_GAGAL_MENANDAI` (`src/teks-profil.ts`), `useKabar`, `KeadaanGalat`/`KeadaanKosong`/`KerangkaDaftar`, `TautanKecil`, `Input`.
- Produces (`src/teks-feed.ts`): `TEKS_TULIS_SESUATU`, `KOSONG_FEED`, `TEKS_GAGAL_MUAT_FEED`, `TEKS_GAGAL_SUKA`, `TEKS_GAGAL_LAPOR_UNGGAHAN`, `TEKS_GAGAL_HAPUS_UNGGAHAN`, `TEKS_IZIN_GALERI`, `TEKS_GAGAL_UNGGAH_GAMBAR`, `TEKS_GAMBAR_DIUNGGAH`, `TEKS_GAMBAR_GAGAL`, `labelSuka(sudahSuka, n)`, `labelTandaFeed(sibuk)`, `labelHapus(konfirmasi)`, `TEKS_PILIH_ULANG_GAMBAR`, `PLACEHOLDER_TULIS`, `labelGambar(ada)`, `labelUnggah(sibuk)`, `TEKS_TERBIT_GAMBAR_GAGAL`, `TEKS_GAGAL_UNGGAH`, `TEKS_UNGGAHAN_TERKIRIM`.
- Produces: `LAYAR_TERMIGRASI` memuat `"(tabs)/(beranda)/feed/index"` dan `"(tabs)/(beranda)/feed/new"`.

- [ ] **Step 1: Tulis tes teks yang gagal**

Buat `apps/mobile/test/teks-feed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { labelGambar, labelHapus, labelSuka, labelTandaFeed, labelUnggah } from "../src/teks-feed";

describe("teks Feed (spec §7.4)", () => {
  it("tombol suka memakai simbol dan angka, tanpa kata baru", () => {
    expect(labelSuka(false, 3)).toBe("♡ 3");
    expect(labelSuka(true, 4)).toBe("♥ 4");
  });

  it("label sibuk dan konfirmasi hapus dua ketukan", () => {
    expect(labelTandaFeed(false)).toBe("Want to meet");
    expect(labelTandaFeed(true)).toBe("Marking…");
    expect(labelHapus(false)).toBe("Delete");
    expect(labelHapus(true)).toBe("Really delete?");
    expect(labelGambar(false)).toBe("Add image");
    expect(labelGambar(true)).toBe("Change image");
    expect(labelUnggah(false)).toBe("Post");
    expect(labelUnggah(true)).toBe("Sending…");
  });
});
```

Ganti isi `apps/mobile/test/feed-alasan.test.ts` (judul `describe`/`it` tetap Indonesia; harapan menjadi Inggris):

```ts
import { describe, expect, it } from "vitest";
import { alasanMuncul } from "../src/messages";

describe("alasanMuncul", () => {
  it("1 lompatan menyebut pertemuan langsung", () => {
    expect(alasanMuncul(1, "Andi")).toBe("You've met Andi.");
  });

  it("2 lompatan menyebut perantara tanpa mengaku kamu bertemu dia", () => {
    expect(alasanMuncul(2, "Andi")).toBe("Someone you know has met Andi.");
  });

  /**
   * hop 0 berarti unggahanmu sendiri. Tanpa cabang ini, unggahan sendiri
   * jatuh ke cabang terakhir dan kartunya memberi tahu penulisnya bahwa
   * unggahannya sendiri berada di luar jaringannya sendiri.
   */
  it("unggahan sendiri disebut milikmu, bukan luar jaringan", () => {
    expect(alasanMuncul(0, "Andi")).toBe("Your post.");
  });

  it("luar jaringan dinyatakan apa adanya", () => {
    expect(alasanMuncul(null, "Andi")).toBe("Outside your network.");
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("tidak menghasilkan kalimat rusak saat nama kosong", () => {
    expect(alasanMuncul(1, "  ")).toBe("You've met this person.");
    for (const hop of [0, 1, 2, null] as const) {
      const pesan = alasanMuncul(hop, "");
      expect(pesan.trim().length).toBeGreaterThan(5);
      expect(pesan).not.toContain("  ");
    }
  });
});
```

Di `apps/mobile/test/feed-messages.test.ts`, ganti judul `it("menerjemahkan setiap kode gerbang feed ke bahasa Indonesia", …)` menjadi `it("menerjemahkan setiap kode gerbang feed ke kalimat untuk orang", …)` dan tambahkan di akhir `describe`:

```ts
  it("image_unavailable tidak menyuruh coba lagi — mencoba ulang tidak menolong", () => {
    expect(feedErrorMessage("image_unavailable")).not.toMatch(/try again/i);
  });
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-feed.test.ts test/feed-alasan.test.ts test/feed-messages.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tulis teks dan terjemahan**

Buat `apps/mobile/src/teks-feed.ts`:

```ts
/**
 * Teks layar Feed dan Unggahan baru (spec desain UI §7.1, §7.4): terjemahan
 * 1:1 kalimat yang sudah ada, ditambah satu teks baru "Posted." (Ruling B2-6).
 */

/* Feed — app/(tabs)/(beranda)/feed/index.tsx */

export const TEKS_TULIS_SESUATU = "Write something";
export const KOSONG_FEED = "No posts yet.";
export const TEKS_GAGAL_MUAT_FEED = "Couldn't load the feed.";
export const TEKS_GAGAL_SUKA = "Couldn't like this post.";
export const TEKS_GAGAL_LAPOR_UNGGAHAN = "Couldn't report this post.";
export const TEKS_GAGAL_HAPUS_UNGGAHAN = "Couldn't delete this post.";
export const TEKS_IZIN_GALERI = "Nearly needs photo library access to attach an image.";
export const TEKS_GAGAL_UNGGAH_GAMBAR = "Couldn't upload the image.";
export const TEKS_GAMBAR_DIUNGGAH = "Uploading image…";
export const TEKS_GAMBAR_GAGAL = "The image failed to upload.";

/** Simbol + angka yang sudah ada; tidak ada kata baru. */
export function labelSuka(sudahSuka: boolean, jumlah: number): string {
  return `${sudahSuka ? "♥" : "♡"} ${jumlah}`;
}

/** Kartu feed SELALU menandai, tidak pernah mencabut (lihat komentar di layar). */
export function labelTandaFeed(sibuk: boolean): string {
  return sibuk ? "Marking…" : "Want to meet";
}

/** Hapus tidak bisa dibatalkan, jadi butuh dua ketukan. */
export function labelHapus(konfirmasi: boolean): string {
  return konfirmasi ? "Really delete?" : "Delete";
}

export const TEKS_PILIH_ULANG_GAMBAR = "Choose the image again";

/* Unggahan baru — app/(tabs)/(beranda)/feed/new.tsx */

export const PLACEHOLDER_TULIS = "What are you building?";

export function labelGambar(ada: boolean): string {
  return ada ? "Change image" : "Add image";
}

export function labelUnggah(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Post";
}

export const TEKS_TERBIT_GAMBAR_GAGAL =
  "Your text is posted, but the image failed to send. Try attaching it again later.";
export const TEKS_GAGAL_UNGGAH = "Couldn't post.";
/** Teks BARU (Ruling B2-6): §7.2 mewajibkan toast untuk unggahan terkirim. */
export const TEKS_UNGGAHAN_TERKIRIM = "Posted.";
```

Di `apps/mobile/src/messages.ts`:

1. Ganti isi `FEED_MESSAGES` (kunci dan komentar `image_unavailable` tetap):

```ts
const FEED_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  post_exists: "A post with that id already exists. Try writing it again.",
  post_not_found: "This post no longer exists.",
  not_author: "Only the author can change this post.",
  image_slot_taken: "This post already has an image. One image per post.",
  image_too_large: "The image is too large. 2 MB at most.",
  // Bukan salah penulisnya, dan mencoba ulang tidak akan menolong sampai
  // servernya dikonfigurasi — jadi kalimatnya tidak menyuruh coba lagi.
  image_unavailable: "Image attachments aren't available right now. Your text is still posted.",
  bad_signature: "The signature doesn't match. Try again.",
  expired: "This request has expired. Try again.",
  invalid_body: "Some of the details aren't right yet.",
};
```

2. Di `feedErrorMessage`, `"Gagal. Coba lagi sebentar."` → `"Something went wrong. Try again in a moment."`.

3. Ganti badan `alasanMuncul` (komentar tetap):

```ts
  if (hop === 0) return "Your post.";
  const nama = displayName.trim() || "this person";
  if (hop === 1) return `You've met ${nama}.`;
  if (hop === 2) return `Someone you know has met ${nama}.`;
  return "Outside your network.";
```

Di `apps/mobile/src/gambar.ts`, ganti nilai `PESAN_FORMAT_TIDAK_DIDUKUNG` dengan `"That image format isn't supported yet. Choose a JPEG or PNG file."`.

Run perintah Step 1. Expected: PASS.

- [ ] **Step 3: Tulis tes layar yang gagal**

Buat `apps/mobile/test/feed-layar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const feed = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/index.tsx"));
const tulis = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/new.tsx"));

describe("Feed (spec §7.1 pola daftar)", () => {
  it("dimigrasi; FlatList", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(beranda)/feed/index")).toBe(true);
    expect(feed()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kartu: nama penulis + alamat singkat (R4) dan alasan muncul (spec induk §10.3)", () => {
    const x = feed();
    expect(x).toContain("namaKartuRadar(p.displayName)");
    expect(x).toContain("alamatSingkat(p.author)");
    expect(x).toContain("alasanMuncul(p.hop, p.displayName)");
  });

  it("perilaku lama tetap: bukti LihatFeed setiap muat, tandai dijaga dari ketukan ganda, hapus dua ketukan", () => {
    const x = feed();
    expect(x).toContain("getFeed(await kueriBuktiFeed(signer))");
    expect(x).toContain("if (tandaiBusyId === p.postId) return;");
    expect(x).toContain("konfirmasiHapus === p.postId");
    expect(x).toContain("aksiTanda(signer, p.author as Address, false)");
  });

  it("muat pertama gagal → galat + Try again; muat ulang gagal mempertahankan unggahan", () => {
    const x = feed();
    expect(x).toContain("<KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} />");
    expect(x).not.toContain("setPosts([])");
    expect(x).toContain('<KeadaanKosong');
  });
});

describe("Unggahan baru (spec §7.1 pola formulir)", () => {
  it("dimigrasi; Input BNA, tanpa WARNA", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(beranda)/feed/new")).toBe(true);
    const x = tulis();
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
    expect(x).toContain("teksSisaKarakter(sisa)");
  });

  it("berhasil → toast + haptic lalu kembali ke feed; gambar dikirim SETELAH teks terbit (spec §8.2)", () => {
    const x = tulis();
    expect(x).toMatch(/kabar\.berhasil\(TEKS_UNGGAHAN_TERKIRIM\);\s*router\.replace\("\/feed"\);/);
    expect(x.indexOf("await postPost(")).toBeLessThan(x.indexOf("await postImage("));
  });

  it("gambar ditolak, bukan dilabeli ulang; Error.message tidak dirender", () => {
    const x = tulis();
    expect(x).toContain("mimeGambarDiterima(aset.mimeType)");
    expect(x).not.toContain("e.message");
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/feed-layar.test.ts`
Expected: FAIL.

- [ ] **Step 4: Tulis ulang Feed**

Timpa `apps/mobile/app/(tabs)/(beranda)/feed/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { FileText } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, likeTypedData } from "@nearly/shared";
import type { Address } from "viem";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { TautanKecil } from "@/components/tautan-kecil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import {
  getFeed, kueriBuktiFeed, postImage, postLike, type FeedPost,
} from "../../../../src/feed-api";
import {
  bisaHapus, hapusUnggahan, laporUnggahan, MASA_BERLAKU_DETIK,
} from "../../../../src/feed-actions";
import { aksiTanda } from "../../../../src/meet-actions";
import { mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG } from "../../../../src/gambar";
import {
  alamatSingkat, alasanMuncul, feedErrorMessage, meetErrorMessage, meetSuccessMessage,
  namaKartuRadar,
} from "../../../../src/messages";
import {
  KOSONG_FEED, labelHapus, labelSuka, labelTandaFeed, TEKS_GAGAL_HAPUS_UNGGAHAN,
  TEKS_GAGAL_LAPOR_UNGGAHAN, TEKS_GAGAL_MUAT_FEED, TEKS_GAGAL_SUKA, TEKS_GAGAL_UNGGAH_GAMBAR,
  TEKS_GAMBAR_DIUNGGAH, TEKS_GAMBAR_GAGAL, TEKS_IZIN_GALERI, TEKS_PILIH_ULANG_GAMBAR,
  TEKS_TULIS_SESUATU,
} from "../../../../src/teks-feed";
import { TEKS_GAGAL_MENANDAI, TEKS_LAPOR } from "../../../../src/teks-profil";

export default function FeedScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <FeedScreenIsi key={signer.address} signer={signer} />;
}

function FeedScreenIsi({ signer }: { signer: NearlySigner }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  // Galat MUAT terpisah dari pesan AKSI: "Try again" memuat ulang feed, jadi
  // ia tidak boleh muncul di bawah kegagalan menyukai atau menghapus.
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Hapus tidak bisa dibatalkan, jadi butuh dua ketukan. Disimpan sebagai
  // postId, bukan boolean, supaya konfirmasi satu kartu tidak menyalakan
  // konfirmasi kartu lain.
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);
  // postId yang sedang dalam proses ditandai, atau null. Dipakai untuk
  // mencegah dua ketukan beruntun mengirim dua permintaan tanda tangan
  // sekaligus untuk kartu yang sama (finding #5).
  const [tandaiBusyId, setTandaiBusyId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      // Bukti LihatFeed setiap muat: tanpa itu server tidak menerapkan
      // blokirmu di feed (review akhir 4a, C1). Satu tanda tangan per muat,
      // karena `muat` hanya punya satu pemicu di bawah.
      const { posts } = await getFeed(await kueriBuktiFeed(signer));
      setPosts(posts);
      setGalatMuat(null);
      setPesan(null);
    } catch (e) {
      // Unggahan yang sudah tampil DIPERTAHANKAN (Ruling B2-12).
      setGalatMuat(e instanceof ApiError ? feedErrorMessage(e.code) : TEKS_GAGAL_MUAT_FEED);
    }
  }, [signer]);

  // useFocusEffect SENDIRIAN, bukan berpasangan dengan useEffect: ia sudah
  // menyala saat layar pertama kali fokus — yaitu saat mount — jadi useEffect
  // di sebelahnya cuma menggandakan `GET /feed` setiap kali layar dibuka.
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  /**
   * Satu jalur galat untuk semua aksi kartu: ApiError diterjemahkan
   * feedErrorMessage, selebihnya kalimat cadangan. Setelah aksi berhasil,
   * SELALU muat ulang dari server — keadaan feed milik server, dan menebaknya
   * di klien membuat layar berbohong.
   */
  async function jalankan(aksi: () => Promise<void>, gagal: string) {
    try {
      await aksi();
      setKonfirmasiHapus(null);
      await muat();
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : gagal);
    }
  }

  const suka = (p: FeedPost) => jalankan(async () => {
    const berikutnya = !p.sudahSuka;
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + MASA_BERLAKU_DETIK);
    const sig = await signer.signTypedData(likeTypedData(
      { postId: p.postId, who: signer.address, suka: berikutnya, expiresAt },
      CONFIG.verifyingContract,
    ));
    await postLike(p.postId, {
      postId: p.postId, who: signer.address, suka: berikutnya,
      expiresAt: expiresAt.toString(), sig,
    });
  }, TEKS_GAGAL_SUKA);

  const lapor = (p: FeedPost) => jalankan(
    () => laporUnggahan(signer, p.postId, CONFIG.verifyingContract),
    TEKS_GAGAL_LAPOR_UNGGAHAN,
  );

  const hapus = (p: FeedPost) => jalankan(
    () => hapusUnggahan(signer, p.postId, CONFIG.verifyingContract),
    TEKS_GAGAL_HAPUS_UNGGAHAN,
  );

  /**
   * Coba unggah lagi setelah `image_status` jadi `failed`. Layar feed TIDAK
   * memegang byte gambar aslinya — jadi tombol ini meminta gambarnya dipilih
   * ulang, bukan berpura-pura bisa mengulang sendiri. Server mengizinkan ini:
   * attachImage menerima status `failed` (spec §9.1).
   */
  const unggahUlang = (p: FeedPost) => jalankan(async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setPesan(TEKS_IZIN_GALERI);
      return;
    }
    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.7,
    });
    const aset = hasil.assets?.[0];
    if (hasil.canceled || !aset?.base64) return;

    const mime = mimeGambarDiterima(aset.mimeType);
    if (!mime) {
      setPesan(PESAN_FORMAT_TIDAK_DIDUKUNG);
      return;
    }

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + MASA_BERLAKU_DETIK);
    const sig = await signer.signTypedData(lampirGambarTypedData(
      { postId: p.postId, author: signer.address, mime, expiresAt },
      CONFIG.verifyingContract,
    ));
    await postImage(p.postId, {
      postId: p.postId, author: signer.address, mime,
      expiresAt: expiresAt.toString(), sig, dataBase64: aset.base64,
    });
  }, TEKS_GAGAL_UNGGAH_GAMBAR);

  async function tandai(p: FeedPost) {
    // Sudah ada permintaan untuk kartu ini yang belum selesai — abaikan
    // ketukan berikutnya alih-alih mengirim tanda tangan kedua.
    if (tandaiBusyId === p.postId) return;
    setTandaiBusyId(p.postId);
    try {
      // Layar feed tidak tahu apakah kamu sudah menandai orang ini — bendera
      // itu hanya keluar dengan bukti baca di layar profil. Jadi dari sini
      // tombolnya SELALU menandai, tidak pernah mencabut.
      await aksiTanda(signer, p.author as Address, false);
      setPesan(meetSuccessMessage(true));
    } catch (e) {
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_MENANDAI);
    } finally {
      setTandaiBusyId(null);
    }
  }

  if (posts === null) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  const tulisBaru = () => router.push("/feed/new");

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      keyExtractor={(p) => p.postId}
      ListHeaderComponent={
        <View style={s.kepala}>
          {/* Aksi utama di baris pertama (§7.1); keadaan kosong membawa aksinya sendiri. */}
          {posts.length > 0 ? <Button onPress={tulisBaru}>{TEKS_TULIS_SESUATU}</Button> : null}
          {galatMuat ? <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} /> : null}
          {pesan ? <Text variant="caption">{pesan}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        galatMuat ? null : (
          <KeadaanKosong
            Ikon={FileText}
            kalimat={KOSONG_FEED}
            aksi={{ label: TEKS_TULIS_SESUATU, onPress: tulisBaru }}
          />
        )
      }
      renderItem={({ item: p }) => {
        const milikku = bisaHapus(p.author, signer.address);
        return (
          <Card style={s.kartu}>
            <Pressable
              onPress={() => router.push(`/profile/${p.author}`)}
              accessibilityRole="button"
              style={s.penulis}
            >
              <Text variant="body" style={s.tebal}>{namaKartuRadar(p.displayName)}</Text>
              {/* Nama tidak pernah tanpa alamat (R4, anti-impersonasi). */}
              <Text variant="mono">{alamatSingkat(p.author)}</Text>
            </Pressable>
            {/* Spec §10.3 — kartu harus menjelaskan kenapa ia muncul. */}
            <Text variant="caption">{alasanMuncul(p.hop, p.displayName)}</Text>
            <Text variant="body">{p.body}</Text>
            {p.imageStatus === "ready" && p.imageUrl
              ? <Image source={{ uri: p.imageUrl }} style={s.gambar} resizeMode="cover" />
              : null}
            {p.imageStatus === "pending" ? <Text variant="caption">{TEKS_GAMBAR_DIUNGGAH}</Text> : null}
            {p.imageStatus === "failed" ? <Text variant="caption">{TEKS_GAMBAR_GAGAL}</Text> : null}

            <View style={s.aksi}>
              <TautanKecil label={labelSuka(p.sudahSuka, p.likeCount)} onPress={() => void suka(p)} />
              <TautanKecil label={TEKS_LAPOR} onPress={() => void lapor(p)} />
              {/*
                Angka publiknya (inginBertemuCount) TIDAK ditampilkan di sini
                (spec §8) — hanya tombolnya. Disembunyikan untuk `milikku`:
                menandai diri sendiri hanya bisa gagal (server menolak dengan
                `tandai_diri`), jadi menawarkannya adalah tombol yang
                menjanjikan aksi yang tidak bisa ia lakukan (finding #4).
              */}
              {!milikku ? (
                <TautanKecil label={labelTandaFeed(tandaiBusyId === p.postId)} onPress={() => void tandai(p)} />
              ) : null}
              {milikku ? (
                <TautanKecil
                  label={labelHapus(konfirmasiHapus === p.postId)}
                  onPress={() => (konfirmasiHapus === p.postId
                    ? void hapus(p)
                    : setKonfirmasiHapus(p.postId))}
                />
              ) : null}
              {milikku && p.imageStatus === "failed" ? (
                <TautanKecil label={TEKS_PILIH_ULANG_GAMBAR} onPress={() => void unggahUlang(p)} />
              ) : null}
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
  kepala: { gap: 12 },
  kartu: { gap: 8 },
  penulis: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  tebal: { fontWeight: "600" },
  gambar: { width: "100%", height: 200, borderRadius: RADIUS.kartu },
  aksi: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
});
```

- [ ] **Step 5: Tulis ulang Unggahan baru**

Timpa `apps/mobile/app/(tabs)/(beranda)/feed/new.tsx`:

```tsx
import { useState } from "react";
import { useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, makePostId, postTypedData } from "@nearly/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { postImage, postPost } from "../../../../src/feed-api";
import { feedErrorMessage } from "../../../../src/messages";
import {
  mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG, type MimeGambar,
} from "../../../../src/gambar";
import {
  labelGambar, labelUnggah, PLACEHOLDER_TULIS, TEKS_GAGAL_UNGGAH, TEKS_IZIN_GALERI,
  TEKS_TERBIT_GAMBAR_GAGAL, TEKS_UNGGAHAN_TERKIRIM,
} from "../../../../src/teks-feed";
import { teksSisaKarakter } from "../../../../src/teks-ui";

const MAKS = 500;

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
  const kabar = useKabar();
  const [teks, setTeks] = useState("");
  const [gambar, setGambar] =
    useState<{ uri: string; base64: string; mime: MimeGambar } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function pilihGambar() {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setPesan(TEKS_IZIN_GALERI);
      return;
    }
    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.7,
    });
    const aset = hasil.assets?.[0];
    if (hasil.canceled || !aset?.base64) return;

    // DITOLAK, bukan dilabeli ulang: HEIC atau WebP yang naik berlabel JPEG
    // tidak akan pernah tampil. `mime` diikat tanda tangan LampirGambar
    // justru supaya tidak bisa diselewengkan — kliennya sendiri tidak boleh
    // jadi yang menyelewengkan.
    const mime = mimeGambarDiterima(aset.mimeType);
    if (!mime) {
      setPesan(PESAN_FORMAT_TIDAK_DIDUKUNG);
      return;
    }
    setPesan(null);
    setGambar({ uri: aset.uri, base64: aset.base64, mime });
  }

  async function kirim() {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const postId = makePostId();
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig = await signer.signTypedData(postTypedData(
        { postId, author: signer.address, body: teks, expiresAt }, CONFIG.verifyingContract,
      ));
      await postPost({
        postId, author: signer.address, body: teks,
        expiresAt: expiresAt.toString(), sig,
      });

      // Gambar dikirim SETELAH teks terbit, dan kegagalannya tidak membatalkan
      // unggahan (spec §8.2). Tanda tangannya tipe LampirGambar yang terpisah.
      if (gambar) {
        try {
          const expGambar = BigInt(Math.floor(Date.now() / 1000) + 300);
          const sigGambar = await signer.signTypedData(lampirGambarTypedData(
            { postId, author: signer.address, mime: gambar.mime, expiresAt: expGambar },
            CONFIG.verifyingContract,
          ));
          await postImage(postId, {
            postId, author: signer.address, mime: gambar.mime,
            expiresAt: expGambar.toString(), sig: sigGambar, dataBase64: gambar.base64,
          });
        } catch {
          setPesan(TEKS_TERBIT_GAMBAR_GAGAL);
        }
      }
      // Teksnya SUDAH terbit (Ruling B2-6).
      kabar.berhasil(TEKS_UNGGAHAN_TERKIRIM);
      router.replace("/feed");
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : TEKS_GAGAL_UNGGAH);
    } finally {
      setSibuk(false);
    }
  }

  const sisa = MAKS - teks.length;

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Input
        type="textarea"
        rows={5}
        maxLength={MAKS}
        placeholder={PLACEHOLDER_TULIS}
        accessibilityLabel={PLACEHOLDER_TULIS}
        value={teks}
        onChangeText={setTeks}
      />
      <Text variant="caption" style={s.kanan}>{teksSisaKarakter(sisa)}</Text>
      {gambar ? <Image source={{ uri: gambar.uri }} style={s.pratinjau} resizeMode="cover" /> : null}
      <Button variant="outline" onPress={() => void pilihGambar()}>{labelGambar(gambar !== null)}</Button>
      <Button loading={sibuk} disabled={sibuk || teks.trim().length === 0} onPress={() => void kirim()}>
        {labelUnggah(sibuk)}
      </Button>
      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 12 },
  kanan: { textAlign: "right" },
  pratinjau: { width: "100%", height: 180, borderRadius: RADIUS.kartu },
});
```

- [ ] **Step 6: Daftarkan kedua kunci**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di akhir isi `LAYAR_TERMIGRASI`:

```ts
  // Rencana B2 kelompok (f) — layar sisa (spec §9 langkah 5f).
  "(tabs)/(beranda)/feed/index",
  "(tabs)/(beranda)/feed/new",
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/feed-layar.test.ts test/teks-feed.test.ts test/feed-alasan.test.ts test/feed-messages.test.ts test/gambar.test.ts test/feed-actions.test.ts test/feed-bukti.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/warna-isian.test.ts test/tautan.test.ts`
Expected: PASS.

- [ ] **Step 8: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/src/teks-feed.ts apps/mobile/test/teks-feed.test.ts apps/mobile/test/feed-layar.test.ts apps/mobile/src/messages.ts apps/mobile/src/gambar.ts apps/mobile/test/feed-alasan.test.ts apps/mobile/test/feed-messages.test.ts "apps/mobile/app/(tabs)/(beranda)/feed/index.tsx" "apps/mobile/app/(tabs)/(beranda)/feed/new.tsx" apps/mobile/src/judul-layar.ts
git commit -m "feat(mobile): migrasi Feed dan Unggahan baru — kartu dengan alamat singkat, toast Posted., Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi**

Di `feed/index.tsx`, hapus baris `    if (tandaiBusyId === p.postId) return;`. Run: `vitest run test/feed-layar.test.ts`. Expected merah: `perilaku lama tetap: bukti LihatFeed setiap muat, tandai dijaga dari ketukan ganda, hapus dua ketukan`. Kembalikan.

---

## Task 14: Migrasi Mulai dan hapus `src/warna.ts`

**Files:**
- Create: `apps/mobile/src/teks-mulai.ts`, `apps/mobile/test/mulai.test.ts`
- Modify: `apps/mobile/app/mulai.tsx` (tulis ulang), `apps/mobile/theme/globals.ts` (`UKURAN.logoMulai`), `apps/mobile/theme/navigasi.ts` (Mulai tanpa header), `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/gerbang-dompet.test.ts`, `apps/mobile/test/tema.test.ts` (satu baris)
- Delete: `apps/mobile/src/warna.ts`, `apps/mobile/test/warna-isian.test.ts`

**Interfaces:**
- Consumes: `LogoN` (`components/logo-n.tsx`), `useDompet`, `PERINGATAN_MNEMONIK_UTAMA`/`pesanGalatDompet` (`src/dompet/teks-dompet.ts`), `LABEL_12_KATA` (`src/teks-akun.ts`), `Input`.
- Produces: `src/teks-mulai.ts` — `KALIMAT_MULAI`, `TEKS_BUAT_DOMPET`, `TEKS_PAKAI_DOMPET`, `TEKS_IMPOR_KUNCI_DEV`, `TEKS_MENYIAPKAN_DOMPET`, `PLACEHOLDER_12_KATA`, `TEKS_PAKAI_DOMPET_INI`, `TEKS_KEMBALI`, `LABEL_KUNCI_DEV`, `PERINGATAN_KUNCI_DEV`, `TEKS_PAKAI_KUNCI_INI`; `UKURAN.logoMulai = 96`; `LAYAR_TERMIGRASI` memuat `"mulai"` (kunci ke-19 — **semua** kunci `JUDUL_LAYAR`).

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/mobile/test/mulai.test.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { opsiTampilan } from "../theme/navigasi";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import {
  KALIMAT_MULAI, TEKS_BUAT_DOMPET, TEKS_MENYIAPKAN_DOMPET, TEKS_PAKAI_DOMPET,
} from "../src/teks-mulai";
import { baca, MOBILE, semuaBerkas, tanpaKomentar } from "./support/berkas";

const mulai = () => tanpaKomentar(baca("app/mulai.tsx"));

describe("Mulai (spec §7.1, keputusan #11, #15)", () => {
  it("kalimat dan tombol persis istilah terkunci #15", () => {
    expect(KALIMAT_MULAI).toBe("Know the people you've actually met");
    expect(TEKS_BUAT_DOMPET).toBe("Create a new wallet");
    expect(TEKS_PAKAI_DOMPET).toBe("Use an existing wallet");
    expect(TEKS_MENYIAPKAN_DOMPET).toBe("Setting up wallet…");
  });

  it("dimigrasi; tanpa header, isi di dalam SafeAreaView (Ruling B2-17)", () => {
    expect(LAYAR_TERMIGRASI.has("mulai")).toBe(true);
    expect(opsiTampilan("mulai")).toMatchObject({ headerShown: false });
    expect(mulai()).toContain("<SafeAreaView");
  });

  it("logo n besar dari path yang sama, lalu kalimat dan dua tombol", () => {
    const x = mulai();
    expect(x).toContain("<LogoN ukuran={UKURAN.logoMulai} />");
    expect(x).toContain("{KALIMAT_MULAI}");
    expect(x).toContain("{sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_BUAT_DOMPET}");
    expect(x).toContain("{TEKS_PAKAI_DOMPET}");
  });

  it("kalimat pembuka lama di bawah judul 'Nearly' digantikan", () => {
    expect(baca("app/mulai.tsx")).not.toContain("Identitasmu");
  });

  it("tidak ada lagi TextInput mentah atau WARNA di app/, dan src/warna.ts terhapus (Ruling A3)", () => {
    const salah = semuaBerkas("app").filter((b) => /<TextInput\b|src\/warna/.test(baca(b)));
    expect(salah).toEqual([]);
    expect(existsSync(join(MOBILE, "src/warna.ts"))).toBe(false);
  });
});
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/mulai.test.ts`
Expected: FAIL.

- [ ] **Step 2: Tulis teks Mulai**

Buat `apps/mobile/src/teks-mulai.ts`:

```ts
/**
 * Teks layar Mulai (spec desain UI §7.1 "Mulai", keputusan #11, #15). Tiga
 * teks baru: kalimat pembuka dan dua tombol utama; sisanya terjemahan 1:1.
 * Peringatan 12 kata tetap di src/dompet/teks-dompet.ts.
 */
export const KALIMAT_MULAI = "Know the people you've actually met";
export const TEKS_BUAT_DOMPET = "Create a new wallet";
export const TEKS_PAKAI_DOMPET = "Use an existing wallet";

/** Khusus pengembangan: tombolnya hanya dirender saat __DEV__ (spec dompet R5). */
export const TEKS_IMPOR_KUNCI_DEV = "Import private key (development only)";

/** Label sibuk semua tombol: menurunkan kunci bisa beberapa detik di HP. */
export const TEKS_MENYIAPKAN_DOMPET = "Setting up wallet…";

export const PLACEHOLDER_12_KATA = "word1 word2 word3 …";
export const TEKS_PAKAI_DOMPET_INI = "Use this wallet";
export const TEKS_KEMBALI = "Back";

export const LABEL_KUNCI_DEV = "Private key (development only)";
export const PERINGATAN_KUNCI_DEV =
  "Only for disposable test wallets. This option doesn't exist in production builds.";
export const TEKS_PAKAI_KUNCI_INI = "Use this key";
```

- [ ] **Step 3: Token dan navigasi**

1. `apps/mobile/theme/globals.ts` — di `UKURAN` sesudah `tombolKirim: 40,` tambahkan `  logoMulai: 96,`.
2. `apps/mobile/theme/navigasi.ts` — ganti:

```ts
const KUNCI_BERANDA = "(tabs)/(beranda)/index";
```

dengan:

```ts
/**
 * Tanpa header setelah dimigrasi: Beranda (sapaan besar menggantikannya) dan
 * Mulai (logo "n") — spec §4.7, §3.7, Ruling B2-17.
 */
const KUNCI_TANPA_HEADER: ReadonlySet<string> = new Set(["(tabs)/(beranda)/index", "mulai"]);
```

dan ganti `    ...(kunci === KUNCI_BERANDA && tampilanBaru ? { headerShown: false as const } : {}),` dengan `    ...(KUNCI_TANPA_HEADER.has(kunci) && tampilanBaru ? { headerShown: false as const } : {}),`. (Bila `KUNCI_BERANDA` dipakai di tempat lain di berkas itu, **berhenti dan laporkan**.)

3. `apps/mobile/test/tema.test.ts` — ganti `    expect(opsiTampilan("mulai")).toEqual({});` dengan `    expect(opsiTampilan("mulai", new Set())).toEqual({});` (Mulai kini termigrasi; asersi ini tentang layar yang BELUM dimigrasi).

- [ ] **Step 4: Tulis ulang Mulai**

Timpa `apps/mobile/app/mulai.tsx`:

```tsx
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoN } from "@/components/logo-n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";
import { useDompet } from "../src/dompet/konteks-dompet";
import { PERINGATAN_MNEMONIK_UTAMA, pesanGalatDompet } from "../src/dompet/teks-dompet";
import { LABEL_12_KATA } from "../src/teks-akun";
import {
  KALIMAT_MULAI, LABEL_KUNCI_DEV, PERINGATAN_KUNCI_DEV, PLACEHOLDER_12_KATA, TEKS_BUAT_DOMPET,
  TEKS_IMPOR_KUNCI_DEV, TEKS_KEMBALI, TEKS_MENYIAPKAN_DOMPET, TEKS_PAKAI_DOMPET,
  TEKS_PAKAI_DOMPET_INI, TEKS_PAKAI_KUNCI_INI,
} from "../src/teks-mulai";

// Membuat atau mengimpor dari 12 kata menurunkan kunci dengan PBKDF2 di thread
// JS — bisa beberapa detik di HP. Jeda ini memberi layar kesempatan
// menggambar "Setting up wallet…" sebelum thread sibuk.
const jedaUi = () => new Promise<void>((r) => { setTimeout(r, 50); });

type Mode = "pilih" | "mnemonik" | "kunci-dev";

export default function MulaiScreen() {
  const { buatBaru, imporMnemonik, imporKunciDev } = useDompet();
  const [mode, setMode] = useState<Mode>("pilih");
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Penjaga SINKRON: dua ketukan dalam satu frame sama-sama melihat `sibuk`
  // bernilai false dari closure render yang sama. Ref berubah seketika.
  const sibukRef = useRef(false);
  const [galat, setGalat] = useState<string | null>(null);
  const kuning = useColor("primary");
  const merah = useColor("destructive");

  const pindah = (m: Mode) => {
    setMode(m);
    setTeks("");
    setGalat(null);
  };

  async function jalankan(aksi: () => Promise<void>) {
    if (sibukRef.current) return;
    sibukRef.current = true;
    setSibuk(true);
    setGalat(null);
    await jedaUi();
    try {
      // Berhasil → gerbang di _layout.tsx pindah ke beranda dan layar ini dilepas.
      await aksi();
    } catch (e) {
      setGalat(pesanGalatDompet(e));
    } finally {
      sibukRef.current = false;
      setSibuk(false);
    }
  }

  return (
    <SafeAreaView style={s.flex}>
      <ScrollView
        contentContainerStyle={s.root}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.kepala}>
          <LogoN ukuran={UKURAN.logoMulai} />
          <Text variant="title" style={s.rata}>{KALIMAT_MULAI}</Text>
        </View>

        {mode === "pilih" && (
          <View style={s.bagian}>
            <Button disabled={sibuk} onPress={() => void jalankan(buatBaru)}>
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_BUAT_DOMPET}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("mnemonik")}>
              {TEKS_PAKAI_DOMPET}
            </Button>
            {/* Khusus pengembangan: tidak pernah dirender di build produksi (spec dompet R5). */}
            {__DEV__ && (
              <Button variant="ghost" disabled={sibuk} onPress={() => pindah("kunci-dev")}>
                {TEKS_IMPOR_KUNCI_DEV}
              </Button>
            )}
          </View>
        )}

        {mode === "mnemonik" && (
          <View style={s.bagian}>
            <Text variant="caption">{LABEL_12_KATA}</Text>
            <Input
              value={teks}
              onChangeText={setTeks}
              placeholder={PLACEHOLDER_12_KATA}
              accessibilityLabel={LABEL_12_KATA}
              type="textarea"
              rows={3}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              spellCheck={false}
              // Android: autoCorrect={false} tidak menghentikan Gboard belajar
              // dari ketikan; tipe visible-password mematikan saran & kamus.
              keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
              importantForAutofill="no"
              editable={!sibuk}
            />
            <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_MNEMONIK_UTAMA}</Text>
            <Button
              disabled={sibuk || teks.trim() === ""}
              onPress={() => void jalankan(() => imporMnemonik(teks))}
            >
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_PAKAI_DOMPET_INI}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("pilih")}>{TEKS_KEMBALI}</Button>
          </View>
        )}

        {__DEV__ && mode === "kunci-dev" && (
          <View style={s.bagian}>
            <Text variant="caption">{LABEL_KUNCI_DEV}</Text>
            <Input
              value={teks}
              onChangeText={setTeks}
              placeholder="0x…"
              accessibilityLabel={LABEL_KUNCI_DEV}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              editable={!sibuk}
            />
            <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_KUNCI_DEV}</Text>
            <Button
              disabled={sibuk || teks.trim() === ""}
              onPress={() => void jalankan(() => imporKunciDev(teks))}
            >
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_PAKAI_KUNCI_INI}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("pilih")}>{TEKS_KEMBALI}</Button>
          </View>
        )}

        {galat ? <Text variant="body" style={{ color: merah }}>{galat}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 32 },
  kepala: { alignItems: "center", gap: 16 },
  bagian: { gap: 12 },
  rata: { textAlign: "center" },
});
```

- [ ] **Step 5: Perbarui `test/gerbang-dompet.test.ts`**

1. `const tombol = mulai.indexOf("Impor kunci privat (khusus pengembangan)");` → `const tombol = mulai.indexOf("{TEKS_IMPOR_KUNCI_DEV}");`
2. Di tes isian Android: `mulai.indexOf("Hanya untuk dompet uji")` → `mulai.indexOf("{PERINGATAN_KUNCI_DEV}")`, dan `expect(blok).toContain("<TextInput");` → `expect(blok).toContain("<Input");`.
3. Judul `it` yang menyebut `TextInput`, bila ada, boleh tetap — yang mengikat asersinya. Komentar `// Kedua TextInput harus memiliki textContentType="none"` diganti `// Kedua isian harus memiliki textContentType="none"`.

- [ ] **Step 6: Daftarkan kunci, hapus `WARNA`**

Di `apps/mobile/src/judul-layar.ts`, tambahkan di bawah dua kunci Feed: `  "mulai",`.

Pastikan tidak ada lagi pemakai `WARNA`: `git grep -n "src/warna\|WARNA\." -- apps/mobile/app apps/mobile/components apps/mobile/src apps/mobile/hooks` — Expected: kosong. Lalu:

```bash
git rm apps/mobile/src/warna.ts apps/mobile/test/warna-isian.test.ts
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/mulai.test.ts test/gerbang-dompet.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/judul-layar.test.ts test/ikon.test.ts`
Expected: PASS.

- [ ] **Step 8: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/src/teks-mulai.ts apps/mobile/test/mulai.test.ts apps/mobile/app/mulai.tsx apps/mobile/theme/globals.ts apps/mobile/theme/navigasi.ts apps/mobile/src/judul-layar.ts apps/mobile/test/gerbang-dompet.test.ts apps/mobile/test/tema.test.ts
git commit -m "feat(mobile): migrasi layar Mulai — logo n, kalimat pembuka, Inggris; hapus src/warna.ts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Penghapusan `src/warna.ts` dan `test/warna-isian.test.ts` sudah ter-stage oleh `git rm` di Step 6.)

- [ ] **Step 9: Mutasi**

Di `app/mulai.tsx`, hapus `              importantForAutofill="no"` dari isian 12 kata. Run: `vitest run test/gerbang-dompet.test.ts`. Expected merah: tes `isian 12 kata & kunci dev: Android tanpa autofill …`. Kembalikan.

---

## Task 15: Penjaga berlaku untuk seluruh `app/` — hapus `LAYAR_TERMIGRASI` dan `KOMPONEN_BELUM_DIMIGRASI`

**Files:**
- Modify: `apps/mobile/theme/navigasi.ts` (tulis ulang), `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/support/berkas.ts`, `apps/mobile/test/judul-layar.test.ts`, `apps/mobile/test/tema.test.ts`, dan setiap berkas tes yang mengimpor `LAYAR_TERMIGRASI` (daftar di Step 4)

**Interfaces:**
- Produces: `OPSI_STACK.contentStyle` (latar isi gelap bawaan); `opsiTampilan(kunci: string): { headerShown?: false; headerLargeTitle?: true }` (**parameter kedua dihapus**); `kodeTampilanBaru()` dan `berkasTanpaWarna()` mencakup seluruh `app/`.
- Dihapus: `LAYAR_TERMIGRASI`, `KOMPONEN_BELUM_DIMIGRASI`, `layarTermigrasi()` (Ruling B2-16).

- [ ] **Step 1: Bukti semua layar sudah dimigrasi**

Tambahkan sementara di akhir `describe` utama `apps/mobile/test/judul-layar.test.ts`:

```ts
  it("SEMENTARA: LAYAR_TERMIGRASI memuat semua kunci JUDUL_LAYAR", () => {
    expect(Object.keys(JUDUL_LAYAR).filter((k) => !LAYAR_TERMIGRASI.has(k))).toEqual([]);
  });
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts`
Expected: PASS. **Bila merah, berhenti dan laporkan kunci yang tersisa** — ada layar yang belum dimigrasi dan task ini tidak boleh dilanjutkan.

Hapus lagi tes sementara itu (ia akan tidak terkompilasi setelah Step 3).

- [ ] **Step 2: Tulis tes akhir yang gagal**

Di `apps/mobile/test/judul-layar.test.ts`, ganti tiga `it` berikut — `it("LAYAR_TERMIGRASI hanya berisi kunci JUDUL_LAYAR", …)`, `it("Beranda lama tetap berheader; tanpa header hanya setelah dimigrasi (sapaan menggantikannya)", …)`, dan `it("layar akar tab selain Beranda berjudul besar HANYA setelah dimigrasi (spec §4.7)", …)` — dengan:

```ts
  it("Beranda dan Mulai tanpa header — sapaan dan logo menggantikannya (spec §4.7, Ruling B2-17)", () => {
    expect(opsiTampilan("(tabs)/(beranda)/index")).toEqual({ headerShown: false });
    expect(opsiTampilan("mulai")).toEqual({ headerShown: false });
  });

  it("layar akar tab selain Beranda berjudul besar; layar lain tanpa opsi tambahan (spec §4.7)", () => {
    for (const k of [
      "(tabs)/(acara)/events/index", "(tabs)/(salaman)/salaman", "(tabs)/(pesan)/pesan/index",
      "(tabs)/(profil)/profil-saya",
    ]) {
      expect(opsiTampilan(k), k).toEqual({ headerLargeTitle: true });
    }
    expect(opsiTampilan("(tabs)/(acara)/events/[id]")).toEqual({});
  });

  // Judul besar iOS hanya memberi ruang yang benar bila isinya ScrollView/
  // FlatList dengan contentInsetAdjustmentBehavior "automatic" — tanpa itu
  // bagian atas layar tertutup (uji iPhone 2026-09-19).
  it("setiap layar akar tab berjudul besar dibangun di wadah gulir yang menyesuaikan inset", () => {
    for (const t of TAB_BAWAH.filter((t) => t.grup !== "(beranda)")) {
      const berkas = `app/(tabs)/${t.grup}/${t.layarAwal}.tsx`;
      expect(baca(berkas), berkas).toContain('contentInsetAdjustmentBehavior="automatic"');
    }
  });
```

Pastikan `baca` diimpor dari `./support/berkas` di berkas itu, dan hapus `LAYAR_TERMIGRASI, ` dari impor `../src/judul-layar`.

Di `apps/mobile/test/tema.test.ts`, ganti:

```ts
  // Ruling A2: layar yang belum dimigrasi tetap berlatar terang.
  it("latar isi gelap tidak diberikan ke layar yang belum dimigrasi", () => {
    expect(opsiTampilan("mulai", new Set())).toEqual({});
  });
```

dengan:

```ts
  // Sejak Rencana B2 setiap layar bertampilan baru (Ruling B2-16): latar isi
  // gelap bawaan setiap Stack, bukan opsi per layar.
  it("setiap Stack memberi latar isi gelap; opsi per layar tidak mengulanginya", () => {
    expect(OPSI_STACK.contentStyle.backgroundColor).toBe(Colors.dark.background);
    for (const k of ["mulai", "(tabs)/(acara)/events/[id]", "(tabs)/(pesan)/pesan/index"]) {
      expect(opsiTampilan(k), k).not.toHaveProperty("contentStyle");
    }
  });
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts test/tema.test.ts`
Expected: FAIL (`OPSI_STACK.contentStyle` belum ada; `opsiTampilan` masih memberi `contentStyle`).

- [ ] **Step 3: Tulis ulang navigasi dan hapus `LAYAR_TERMIGRASI`**

Timpa `apps/mobile/theme/navigasi.ts`:

```ts
import { Colors } from "./colors";
import { FONT } from "./globals";
import { TAB_BAWAH } from "../src/judul-layar";

const warna = Colors.dark;

/**
 * `screenOptions` setiap Stack (spec desain UI §3.2): header, judul, dan latar
 * isi dari token. Latar isi gelap kini bawaan — sejak Rencana B2 setiap layar
 * bertampilan baru (Ruling A2 selesai, Ruling B2-16). Garis bawah header
 * memakai garis sistem native-stack — native-stack tidak menerima warna garis.
 */
export const OPSI_STACK = {
  headerStyle: { backgroundColor: warna.background },
  headerTintColor: warna.text,
  headerTitleStyle: { fontFamily: FONT.semibold },
  headerLargeStyle: { backgroundColor: warna.background },
  headerLargeTitleStyle: { fontFamily: FONT.bold },
  contentStyle: { backgroundColor: warna.background },
};

/** Tanpa header: Beranda (sapaan besar menggantikannya) dan Mulai (logo "n") — spec §4.7, §3.7. */
const TANPA_HEADER: ReadonlySet<string> = new Set(["(tabs)/(beranda)/index", "mulai"]);

/** Layar akar tab selain Beranda: header besar dengan judul di atas (spec §4.7). */
const AKAR_TAB_JUDUL_BESAR: ReadonlySet<string> = new Set(
  TAB_BAWAH.filter((t) => t.grup !== "(beranda)").map((t) => `(tabs)/${t.grup}/${t.layarAwal}`),
);

export type OpsiTampilan = { headerShown?: false; headerLargeTitle?: true };

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR. Judul besar iOS hanya
 * memberi ruang yang benar bila isi layarnya ScrollView/FlatList dengan
 * contentInsetAdjustmentBehavior "automatic" (dijaga test/judul-layar.test.ts).
 */
export function opsiTampilan(kunci: string): OpsiTampilan {
  return {
    ...(TANPA_HEADER.has(kunci) ? { headerShown: false as const } : {}),
    ...(AKAR_TAB_JUDUL_BESAR.has(kunci) ? { headerLargeTitle: true as const } : {}),
  };
}
```

Di `apps/mobile/src/judul-layar.ts`, hapus seluruh blok komentar + deklarasi `export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([ … ]);` sampai `]);` penutupnya.

Pemanggil `opsiTampilan(x)` di `app/_layout.tsx` dan `components/stack-tab.tsx` sudah satu argumen — tidak diubah.

- [ ] **Step 4: Penjaga seluruh `app/`, hapus sisa konsep "lama vs baru" dari tes**

Timpa bagian bawah `apps/mobile/test/support/berkas.ts` — mulai dari baris `import { LAYAR_TERMIGRASI } from "../../src/judul-layar";` (hapus baris impor itu) dan dari komentar `/** Komponen yang dipindah apa adanya …` sampai akhir berkas — dengan:

```ts
/**
 * Kode bertampilan baru selain salinan BNA: wajib token, skala jarak, dan
 * komponen teks BNA (spec desain UI §3.7, §10.1). Sejak Rencana B2 mencakup
 * SELURUH app/ (Ruling B2-16).
 */
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter((b) => !b.startsWith("components/ui/")),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
    ...semuaBerkas("app"),
  ];
}

/** Semua _layout.tsx di app/. */
export function layoutApp(): string[] {
  return semuaBerkas("app").filter((b) => b.endsWith("/_layout.tsx"));
}

/** Berkas yang dilarang memuat literal warna (spec §10.1). */
export function berkasTanpaWarna(): string[] {
  return [
    ...semuaBerkas("components"),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme").filter((b) => b !== "theme/colors.ts"),
    ...semuaBerkas("src"),
    ...semuaBerkas("app"),
  ];
}
```

Lalu, di setiap berkas tes berikut, **hapus** impor `LAYAR_TERMIGRASI` dan setiap baris `expect(LAYAR_TERMIGRASI.has(…)).toBe(true);`; bila sebuah `it` tidak lagi punya asersi, hapus `it` itu seluruhnya (`it(…)` kosong adalah tes palsu):

| Berkas | Yang dihapus |
|---|---|
| `test/beranda.test.ts` | impor + satu `expect` |
| `test/profil-saya.test.ts` | impor + satu `expect` |
| `test/profil-orang.test.ts` | impor + satu `expect` |
| `test/daftar-profil.test.ts` | impor + dua `expect` |
| `test/dompet-blokir.test.ts` | impor + dua `expect` |
| `test/salaman.test.ts` | `it("kuncinya terdaftar di LAYAR_TERMIGRASI", …)` seluruhnya |
| `test/acara.test.ts` | impor + empat `expect`; `it("dimigrasi", …)` Detail acara seluruhnya |
| `test/radar.test.ts` | impor + `it("dimigrasi", …)` seluruhnya |
| `test/pesan-layar.test.ts` | impor + tiga `expect`; `it("dimigrasi", …)` Percakapan seluruhnya |
| `test/feed-layar.test.ts` | impor + dua `expect` |
| `test/mulai.test.ts` | impor + satu `expect` |

Sesudahnya: `git grep -n "LAYAR_TERMIGRASI\|KOMPONEN_BELUM_DIMIGRASI\|layarTermigrasi" -- apps/mobile` — Expected: kosong.

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run`
Expected: PASS seluruh suite mobile. Penjaga `tema.test.ts` (tanpa warna literal, tanpa `Text`/`TextInput`/`Button` dari `react-native`) dan `aksesibilitas.test.ts` (tanpa `fontSize` literal, jarak hanya dari skala) kini memeriksa **setiap** berkas di `app/`. Bila salah satunya merah untuk sebuah layar, **perbaiki layarnya** (nilai jarak ke skala terdekat, warna ke token) — jangan melonggarkan penjaganya — dan sebutkan perbaikannya di laporan task.

- [ ] **Step 6: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/theme/navigasi.ts apps/mobile/src/judul-layar.ts apps/mobile/test/support/berkas.ts apps/mobile/test/judul-layar.test.ts apps/mobile/test/tema.test.ts apps/mobile/test/beranda.test.ts apps/mobile/test/profil-saya.test.ts apps/mobile/test/profil-orang.test.ts apps/mobile/test/daftar-profil.test.ts apps/mobile/test/dompet-blokir.test.ts apps/mobile/test/salaman.test.ts apps/mobile/test/acara.test.ts apps/mobile/test/radar.test.ts apps/mobile/test/pesan-layar.test.ts apps/mobile/test/feed-layar.test.ts apps/mobile/test/mulai.test.ts
git commit -m "refactor(mobile): semua layar bertampilan baru — penjaga seluruh app/, hapus LAYAR_TERMIGRASI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Tambahkan berkas layar yang diperbaiki di Step 5 bila ada.)

- [ ] **Step 7: Mutasi**

Di `app/(tabs)/(acara)/events/new.tsx`, ganti `bagian: { gap: 8 },` dengan `bagian: { gap: 10 },`. Run: `vitest run test/aksesibilitas.test.ts`. Expected merah: `jarak literal hanya dari skala 4/8/12/16/24/32` (sebelum task ini layar itu tercakup lewat `LAYAR_TERMIGRASI`; sesudahnya lewat seluruh `app/` — mutasi ini membuktikan cakupan baru tidak bolong). Kembalikan.

---

## Task 16: Sapuan bahasa dan `bahasa.test.ts`

**Files:**
- Create: `apps/mobile/test/bahasa.test.ts`
- Modify: berkas mana pun di `app/`, `components/`, `src/` yang masih memuat **teks tampilan** Indonesia (diharapkan tidak ada setelah Task 5–14)

**Interfaces:**
- Consumes: TypeScript compiler API (`typescript` di `node_modules` akar monorepo — resolusi Node dari `apps/mobile/test` naik ke akar; bila impor gagal, **berhenti dan laporkan**, jangan menambah dependensi tanpa persetujuan).

- [ ] **Step 1: Tulis `bahasa.test.ts`**

Buat `apps/mobile/test/bahasa.test.ts`:

```ts
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { baca, semuaBerkas } from "./support/berkas";

/**
 * Penjaga bahasa aplikasi (spec desain UI §7.4, §10.1): hanya SIMPUL TEKS —
 * string, templat, dan teks JSX — yang diperiksa, jadi pengenal dan komentar
 * Indonesia tetap boleh. `\b` memperlakukan `_` sebagai bagian kata, sehingga
 * kode seperti `dompet_tidak_konsisten` tidak cocok. Tes ini jaring, bukan
 * bukti: kalimat Indonesia tanpa kata di pola bisa lolos.
 */
const POLA_INDONESIA = /\b(yang|dan|kamu|tidak|sudah|belum|dengan|untuk|ini|itu|gagal|berhasil|coba|sedang)\b/i;

type Temuan = { berkas: string; teks: string };

/**
 * String KODE yang sah walau memuat kata di pola. Setiap pasangan harus masih
 * cocok dengan kode — yang tidak lagi cocok membuat tes merah, supaya daftar
 * ini tidak menumpuk.
 */
const IZIN: readonly (Temuan & { alasan: string })[] = [
  { berkas: "src/dompet/aksi-dompet.ts", teks: "belum-ada", alasan: "keadaan dompet internal, tidak pernah dirender" },
  { berkas: "src/dompet/konteks-dompet.tsx", teks: "belum-ada", alasan: "keadaan dompet internal, tidak pernah dirender" },
  { berkas: "src/pesan/pesan-api.ts", teks: "/pesan/dengan/", alasan: "jalur API — nama rute tetap Indonesia (§7.4)" },
  { berkas: "src/pesan/pesan-api.ts", teks: "/pesan/belum-dibaca", alasan: "jalur API" },
  { berkas: "src/messages.ts", teks: "gagal", alasan: "nilai KeadaanRadar internal" },
  { berkas: "app/(tabs)/(acara)/radar/[eventId].tsx", teks: "gagal", alasan: "nilai KeadaanRadar internal" },
  { berkas: "src/teks-radar.ts", teks: "gagal", alasan: "nilai KeadaanRadar internal (radarBisaDicobaLagi)" },
  { berkas: "app/(tabs)/(pesan)/pesan/[address].tsx", teks: "belum", alasan: "tahap pembukaan bertahap internal" },
  { berkas: "src/judul-layar.ts", teks: "judul untuk ", alasan: "pesan galat pengembang, tidak dirender" },
  { berkas: "src/judul-layar.ts", teks: " tidak ada", alasan: "pesan galat pengembang, tidak dirender" },
  { berkas: "src/trust-api.ts", teks: "gagal (", alasan: "Error.message pengembang; layar tidak merender Error.message (review B1 #I1)" },
  { berkas: "src/trust-api.ts", teks: "gagal membaca trust (", alasan: "idem" },
];

function temuanSumber(berkas: string, isi: string): Temuan[] {
  const sumber = ts.createSourceFile(
    berkas, isi, ts.ScriptTarget.Latest, true, berkas.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hasil: Temuan[] = [];
  const kunjungi = (n: ts.Node): void => {
    // Penentu modul import/export … from dilewati.
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n)) {
      const f = n.expression;
      // Argumen console.* dan require(...) dilewati.
      if (ts.isPropertyAccessExpression(f) && ts.isIdentifier(f.expression) && f.expression.text === "console") return;
      if (ts.isIdentifier(f) && f.text === "require") return;
    }
    // Kunci properti dilewati; NILAINYA tetap diperiksa.
    if (ts.isPropertyAssignment(n)) {
      kunjungi(n.initializer);
      return;
    }
    let teks: string | null = null;
    if (
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)
    ) {
      teks = n.text;
    } else if (ts.isJsxText(n)) {
      teks = n.text.trim();
    }
    if (teks && POLA_INDONESIA.test(teks)) hasil.push({ berkas, teks });
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sumber);
  return hasil;
}

const BERKAS = ["app", "components", "src"].flatMap((d) => semuaBerkas(d));
const TEMUAN = BERKAS.flatMap((b) => temuanSumber(b, baca(b)));
const diizinkan = (t: Temuan) => IZIN.some((i) => i.berkas === t.berkas && i.teks === t.teks);

describe("bahasa aplikasi: Inggris (spec §7.4, §10.1)", () => {
  it("penjaga menangkap teks, dan melewati impor, console, kunci properti, serta komentar", () => {
    const contoh = [
      'import x from "./yang";',
      'console.log("gagal dan coba");',
      'const peta = { "tidak_ada": 1, sudah: "Done" };',
      "// komentar yang tidak diperiksa",
      'const a = "Gagal memuat acara.";',
      "const b = <T>Belum ada unggahan.</T>;",
    ].join("\n");
    expect(temuanSumber("contoh.tsx", contoh).map((t) => t.teks)).toEqual([
      "Gagal memuat acara.", "Belum ada unggahan.",
    ]);
  });

  it("ada berkas yang diperiksa", () => {
    expect(BERKAS.length).toBeGreaterThan(50);
  });

  it("tidak ada teks Indonesia di app/, components/, src/", () => {
    expect(TEMUAN.filter((t) => !diizinkan(t))).toEqual([]);
  });

  it("setiap izin masih cocok dengan kode — izin basi dibuang", () => {
    expect(IZIN.filter((i) => !TEMUAN.some((t) => t.berkas === i.berkas && t.teks === i.teks))).toEqual([]);
  });

  it("TIER_LABELS (label kawat Indonesia) hanya diimpor src/tier.ts", () => {
    expect(BERKAS.filter((b) => b !== "src/tier.ts" && /\bTIER_LABELS\b/.test(baca(b)))).toEqual([]);
  });

  it("tanggal dan jam lewat src/waktu.ts — tidak ada toLocale*", () => {
    expect(BERKAS.filter((b) => /\btoLocale(String|DateString|TimeString)\b/.test(baca(b)))).toEqual([]);
  });

  it("teks izin app.json persis kalimat §7.4 dan lolos penjaga", () => {
    const plist = JSON.parse(baca("app.json")).expo.ios.infoPlist as Record<string, string>;
    expect(plist.NSCameraUsageDescription).toBe(
      "Nearly uses the camera only to scan the QR codes of people you meet.",
    );
    expect(plist.NSLocationWhenInUseUsageDescription).toBe(
      "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event.",
    );
    for (const [k, v] of Object.entries(plist)) {
      if (k.endsWith("UsageDescription")) expect(POLA_INDONESIA.test(v), k).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Jalankan, lalu tangani setiap temuan**

Run: `pnpm --filter @nearly/mobile exec vitest run test/bahasa.test.ts`

Expected: lulus. Bila `tidak ada teks Indonesia …` merah, tangani **setiap** temuan:
- **teks tampilan** (dilihat pengguna) → terjemahkan 1:1 ke modul teks yang sesuai (`src/teks-*.ts` atau kalimat lama di tempatnya), tambah/ubah tes kalimatnya, **jangan** menambah izin;
- **string kode** (nilai internal, jalur API, pesan pengembang yang tidak pernah dirender) → tambahkan pasangan ke `IZIN` dengan alasan satu baris.
Bila ragu sebuah string dirender atau tidak, **berhenti dan laporkan**.

Bila `setiap izin masih cocok …` merah, hapus pasangan yang basi dari `IZIN`.

- [ ] **Step 3: Sapuan manual (spec §7.4 butir 5)**

Penjaga tidak menangkap kalimat Indonesia tanpa kata di pola. Jalankan dan periksa setiap hit yang berupa **string**, bukan komentar:

```bash
git grep -nE "[\"'\`][^\"'\`]*\b(orang|acara|pesan|dompet|koneksi|salaman|kata|Buka|Pindai|Kirim|Lapor|Blokir|Simpan|Batal|Kembali|Tulis|Unggah|Hapus|Pilih|Tanpa nama|Menandai|Memuat|Mengirim|Terlihat|Tersembunyi|Ingin bertemu|Izin)\b" -- 'apps/mobile/app/*' 'apps/mobile/components/*' 'apps/mobile/src/*' apps/mobile/app.json
```

Hit yang sah (tidak diterjemahkan): impor (`from "../../src/…"`), jalur rute (`"/pesan"`, `/pesan/lapor/…`, `"/salaman?mode=pindai"`), nilai kawat (`"terlihat"`, `"tersembunyi"`, `jenis: "pesan"`), kunci/ID internal, dan komentar yang kebetulan berkutip. **Teks tampilan** yang tersisa diterjemahkan seperti Step 2. Catat di laporan task: jumlah hit dan setiap terjemahan yang dilakukan.

- [ ] **Step 4: Verifikasi penuh + bundel, lalu commit**

Run: `pnpm -r test && pnpm -r typecheck`, lalu ekspor bundel.

```bash
git add apps/mobile/test/bahasa.test.ts
git commit -m "test(mobile): penjaga bahasa Inggris untuk seluruh app/, components/, src/ (spec §7.4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Tambahkan berkas yang diterjemahkan di Step 2–3 bila ada, dengan nama eksplisit.)

- [ ] **Step 5: Mutasi**

1. Di `src/teks-feed.ts`, ganti nilai `KOSONG_FEED` dengan `"Belum ada unggahan."`. Run: `vitest run test/bahasa.test.ts`. Expected merah: `tidak ada teks Indonesia di app/, components/, src/`. Kembalikan.
2. Tambahkan sementara pasangan `{ berkas: "src/messages.ts", teks: "tidak ada lagi", alasan: "x" }` ke `IZIN`. Run lagi. Expected merah: `setiap izin masih cocok dengan kode — izin basi dibuang`. Kembalikan.

---

## Task 17: Dokumen — amandemen spec dan runbook demo

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md` (§10.1, §11, §12), `docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md` (§5.2), `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md` (§11 batas #1, catatan hasil rencana), `docs/demo/runbook.md`

**Interfaces:** tidak ada kode.

- [ ] **Step 1: Spec induk (spec desain UI §15 butir 1–3)**

Di `docs/superpowers/specs/2026-09-03-nearly-design.md`:

1. §10.1 — sesudah paragraf `**Amandemen (2026-09-17) — dompet dibuat di HP.** …` (paragraf yang diakhiri "…tetapi tidak direncanakan."), sisipkan paragraf baru:

```markdown
**Amandemen (2026-09-18) — tampilan.** Aplikasi mobile selalu bertema gelap (palet B2), memakai Inter +
JetBrains Mono, komponen BNA UI yang disalin ke `apps/mobile/components/ui/` (kode kita setelah disalin,
diwarnai lewat token `apps/mobile/theme/colors.ts`), navigasi lima tab bawah — Home, Events, Handshake
(tombol besar di tengah), Messages, Profile — dan berbahasa Inggris. Rincian di spec
`2026-09-18-nearly-desain-ui-design.md`.
```

2. §11 — sesudah paragraf `**Catatan (2026-09-17).** "Connect wallet" di Fase 0 …` (diakhiri "…graf demo bisa tumbuh."), sisipkan:

```markdown
**Catatan (2026-09-18).** Desain ulang UI/UX aplikasi mobile (spec `2026-09-18-nearly-desain-ui-design.md`)
berjalan setelah dompet per pengguna dan sebelum distribusi (APK, TestFlight): tema gelap, lima tab,
bahasa Inggris, dan tiga data baru di API (riwayat pertemuan, penjamin yang kamu kenal, koneksi bersama
di radar).
```

3. §12 — ganti butir `- \`apps/mobile/src/handshake/\` — QR bertanda tangan, rotasi, pemindai. Alur paling penting.` dengan:

```markdown
- `apps/mobile/src/handshake/` — QR bertanda tangan, rotasi, pemindai. Alur paling penting. Layarnya
  `apps/mobile/app/(tabs)/(salaman)/salaman.tsx` (satu layar dua mode) dengan mode di
  `apps/mobile/components/salaman/` (spec desain UI §6.2).
```

- [ ] **Step 2: Spec 4b+5 §5.2 (spec desain UI §15 butir 4)**

Di `docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md`, tepat sesudah paragraf `Yang **tidak pernah** ada di respons: …` (diakhiri "…bukan hanya nilainya (§11)."), sisipkan:

```markdown
*Diamandemen 2026-09-18 (spec desain UI `2026-09-18-nearly-desain-ui-design.md` §8.3):* kartu dengan
`pernahBertemu === false` boleh membawa `koneksiBersama` — **angka** koneksi bersama, hanya bila ≥ 1,
dihitung setelah saringan visibilitas dan blokir, tanpa nama atau alamat siapa pun; kartu koneksi tidak
pernah membawanya. Daftar "yang tidak pernah ada" di atas tetap berlaku.
```

- [ ] **Step 3: Periksa butir 5–6 masih ada**

```bash
grep -n "Diamandemen 2026-09-18" docs/superpowers/specs/2026-09-14-nearly-fase-6-demo-design.md docs/superpowers/specs/2026-09-08-nearly-fase-4a-blokir-design.md
```

Expected: satu hit di masing-masing berkas. **Jangan** menyunting keduanya; bila salah satunya hilang, laporkan.

- [ ] **Step 4: Spec desain UI — catatan hasil rencana**

Di `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md`:

1. §11 butir 1 — di akhir butir (sesudah "…menunggu pemilik (rencana A Task 1).") tambahkan: ` *Hasil (2026-09-21):* jalur BNA dipakai sampai akhir Rencana B2; tidak ada komponen dari jalur cadangan.`
2. Di akhir §16 tambahkan butir:

```markdown
5. *Catatan eksekusi (2026-09-21).* Rencana A (fondasi), B1 (Handshake, Beranda, Profil), dan B2 (Acara,
   Radar, Pesan, layar sisa, sapuan bahasa) tuntas di branch `desain-ui`. Keputusan rencana yang
   menyentuh teks spec: "Event created." dan "Posted." sebagai teks toast baru (Ruling B2-6 rencana B2),
   dan layar Mulai tanpa header (Ruling B2-17). Tombol "Copy address" di Dompet dan konfirmasi sebelum
   Unblock tidak dikerjakan (Ruling B2-5) — menunggu keputusan pemilik.
```

- [ ] **Step 5: Runbook demo (spec desain UI §9 langkah 6)**

Di `docs/demo/runbook.md`:

1. §3 butir 4 — ganti `setiap HP membuat dompetnya sendiri di layar **Mulai** saat pertama dibuka. Untuk memakai identitas uji` + baris berikutnya `lama di HP pengembang, pilih **Impor kunci privat (khusus pengembangan)** — tombol itu hanya ada saat` dengan `setiap HP membuat dompetnya sendiri di layar **Get started** saat pertama dibuka. Untuk memakai identitas uji` + `lama di HP pengembang, pilih **Import private key (development only)** — tombol itu hanya ada saat`.
2. §4 butir 2 — ganti teks tombol dan jalur layar:
   - `**Buat dompet baru**` → `**Create a new wallet**`
   - `(atau **Pakai dompet yang sudah ada (12 kata)** bila sudah punya), lalu layar **Dompet** →` → `(atau **Use an existing wallet** bila sudah punya 12 kata), lalu tab **Profile** › **Wallet** →`
   - `**Lihat 12 kata pemulihan** → catat → **Sudah saya catat**, lalu **Bagikan alamat** dan kirim alamatnya` → `**Show 12-word recovery phrase** → catat → **I've written them down**, lalu **Share address** dan kirim alamatnya`
   - `dari **Bagikan alamat** (atau BscScan)` → `dari **Share address** (atau BscScan)`
3. §4 butir 5 — `panitia bertier **Inti** di aplikasi` → `panitia bertier **Core** di aplikasi`.
4. §4 butir 6 — sesudah `Buat acara lewat aplikasi` tambahkan ` (tab **Events** › **Create event**)`.
5. §4 butir 7 — ganti `**Check-in dan satu salaman** dengan dua HP di dalam venue uji.` dengan `**Check-in dan satu salaman** dengan dua HP di dalam venue uji: host membuka tab **Events** › acara › **Open check-in QR (you're the host)**; tamu mengetuk **Scan the host's QR to check in** (atau tab **Handshake** › **Scan**). Salaman: satu HP di tab **Handshake** mode **Show QR**, yang lain mode **Scan** — pemindai melihat sheet **You met …**.`
6. §5 butir 2 — `**Mulai** lebih dulu (beberapa detik "Menyiapkan dompet…")` → `**Get started** lebih dulu (beberapa detik "Setting up wallet…")`.
7. Jalankan `grep -nE "Mulai|Dompet|Bagikan|Pindai|Buat dompet|Menyiapkan|Inti\*\*" docs/demo/runbook.md` — sisa hit yang menyebut **nama tombol/layar aplikasi** diterjemahkan dengan istilah §7.4; hit lain (kalimat runbook berbahasa Indonesia) tetap.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md docs/demo/runbook.md
git commit -m "docs: amandemen spec induk dan spec radar untuk desain ulang UI; runbook demo memakai nama tab dan tombol Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 18: Verifikasi akhir, batas jalur, dan uji iPhone penuh

**Files:** tidak ada berkas yang diubah (kecuali controller meminta koreksi).

- [ ] **Step 1: Verifikasi global**

```bash
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: dua perintah pertama lulus di semua paket; ekspor `Exported: …`. Laporkan ekor keluarannya apa adanya.

- [ ] **Step 2: Verifikasi batas jalur**

Jalankan setiap perintah terpisah; grep yang kosong keluar dengan status 1 — itu hasil yang diharapkan:

```bash
git diff --stat 069fa14..HEAD -- packages apps/web apps/api supabase                    # WAJIB kosong
git diff --name-only 069fa14..HEAD | grep -vE '^(apps/mobile/|docs/superpowers/plans/2026-09-21-nearly-desain-ui-b2-layar\.md$|docs/superpowers/specs/2026-09-03-nearly-design\.md$|docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design\.md$|docs/superpowers/specs/2026-09-18-nearly-desain-ui-design\.md$|docs/demo/runbook\.md$)'   # WAJIB kosong
git diff --name-only 069fa14..HEAD | grep -E '(^|/)\.env'                               # WAJIB kosong
git diff --stat 069fa14..HEAD -- pnpm-lock.yaml apps/mobile/package.json               # WAJIB kosong (tidak ada dependensi baru)
git grep -n "LAYAR_TERMIGRASI\|KOMPONEN_BELUM_DIMIGRASI\|src/warna" -- apps/mobile     # WAJIB kosong
git grep -n "toLocaleString\|toLocaleDateString\|toLocaleTimeString" -- apps/mobile/app apps/mobile/components apps/mobile/src   # WAJIB kosong
git grep -ln "TIER_LABELS" -- apps/mobile/app apps/mobile/components apps/mobile/src    # WAJIB tepat: apps/mobile/src/tier.ts
git grep -n "Type your message" -- apps/mobile                                          # WAJIB kosong
git status --short                                                                      # WAJIB kosong
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus.

- [ ] **Step 3: Serahkan ke controller** (dilakukan controller, bukan pelaksana)

1. Laporkan ke pemilik project: daftar commit Rencana B2 (Task 1–17), hasil Step 1–2, perbaikan layar yang terpaksa dilakukan di Task 15 Step 5 dan terjemahan tambahan di Task 16 (bila ada), serta **tiga pertanyaan keputusan**: (a) E1 tombol "Copy address" di Dompet, (b) E3 konfirmasi sebelum Unblock (butuh kalimat dialog baru), (c) persetujuan teks toast baru "Event created." dan "Posted." (Ruling B2-5, B2-6).
2. Controller melakukan push. **Pelaksana tidak pernah push.**
3. Pemilik project menjalankan **uji iPhone penuh spec §10.3 butir 1–13** (Expo Go, `npx expo start --go -c` dijalankan pemilik), dengan tambahan butir B2 berikut yang belum tercakup di Task 9:
   1. **Pesan:** tab Messages judul besar; kartu percakapan dengan alamat singkat, lencana belum dibaca, pratinjau satu baris. Percakapan: kepala avatar + nama + alamat singkat + "🔒 end-to-end encrypted"; ⋯ → Report / Block / Cancel; gelembung kuning di kanan, bergaris di kiri; pemisah tanggal "Sep 21"; tombol kirim bundar kecil tetap mudah diketuk; tidak ada "Read …".
   2. **Lapor:** peringatan kuning, baris bukti dengan kotak centang, petunjuk syarat, "Report sent" → Later / Block.
   3. **Feed:** kartu dengan alamat singkat di sebelah nama, "You've met …", ♡ / Report / Want to meet / Delete; "Write something" → Unggahan baru → Post → toast "Posted." + getar → kembali ke Feed.
   4. **Mulai:** Profile › Wallet › Switch wallet → layar tanpa header dan tanpa tab bar, logo "n" kuning, "Know the people you've actually met", "Create a new wallet" / "Use an existing wallet"; isian 12 kata tanpa saran keyboard.
   5. **Huruf besar** (§10.3 butir 11) juga untuk Events, Event details, Radar, Messages, Conversation, Feed, dan Mulai.
   6. **Tidak ada teks Indonesia** di layar mana pun, termasuk dialog dan galat (§10.3 butir 10).
4. Controller menulis hasil uji iPhone ke spec desain UI §10.3 (sebagai catatan "Hasil uji iPhone 2026-09-…" di akhir bagian itu) dalam commit terpisah, **setelah** pemilik menjawab.

---

## Setelah Rencana B2

Spec desain UI §9 langkah 1–6 tuntas. PR #5 siap direview akhir dan di-merge oleh pemilik project. Yang **tidak** termasuk rencana ini dan menunggu keputusan terpisah: E1, E3 (Ruling B2-5), fase distribusi (APK, TestFlight, domain, FCM — memori "Distribusi aplikasi"), dan ekspor/hapus data UU PDP (spec belum ditulis).
