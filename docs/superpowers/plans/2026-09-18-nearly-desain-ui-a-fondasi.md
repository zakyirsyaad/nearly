# Desain UI Nearly — Rencana A (Fondasi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meletakkan fondasi desain ulang aplikasi mobile — BNA UI terpasang dan terbukti di Expo Go, palet B2 + font Inter/JetBrains Mono + tema selalu gelap, ikon/splash, fungsi murni bersama, komponen bersama, navigasi 5 tab dengan Stack per tab, lencana tab — serta tiga data baru dan isi push berbahasa Inggris di API. Layar lama tetap bekerja dengan tampilan lamanya di dalam tab baru; migrasi tampilan per layar adalah Rencana B.

**Architecture:** Komponen BNA disalin CLI ke `apps/mobile/components/ui/` lalu disunting lewat token `theme/colors.ts` (palet B2 di kunci `light` DAN `dark`) dan `theme/globals.ts` (huruf, jarak, radius). Navigasi memakai grup expo-router `app/(tabs)/(beranda|acara|salaman|pesan|profil)` dengan satu Stack per tab (`components/stack-tab.tsx`) sehingga URL tidak berubah; judul dan urutan tab dari satu sumber `src/judul-layar.ts`. Layar lama dipindah dengan `git mv`; latar isi gelap hanya untuk layar yang tercatat di `LAYAR_TERMIGRASI` (kosong di Rencana A). API mendapat `PertemuanStore` baru dan satu metode `RadarStore`, semua medan baru dibangun kunci demi kunci dengan tes fake termasuk kasus privasi.

**Tech Stack:** pnpm monorepo · TypeScript strict (`noUncheckedIndexedAccess`) · Expo SDK 57 / expo-router 57.0.18 / React Native 0.86.3 (Expo Go) · BNA UI (`bna-ui@3.0.0` CLI) · react-native-reanimated 4.5.1 + react-native-worklets 0.10.1 · lucide-react-native · `@expo-google-fonts/inter` + `@expo-google-fonts/jetbrains-mono` · expo-splash-screen · expo-system-ui · `@resvg/resvg-js` 2.6.2 · Hono + Supabase (API) · Vitest

**Spec:** `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md` (otoritas mengikat; spec induk `docs/superpowers/specs/2026-09-03-nearly-design.md`). Hasil spike BNA repo dicatat di spec §3.6.

## Global Constraints

### Keputusan terkunci yang dipakai rencana ini (spec §2, verbatim)

| # | Keputusan |
|---|---|
| 2 | **Tema SELALU GELAP** (`app.json` `userInterfaceStyle: "dark"`; tidak ada tema terang). |
| 3 | **Navigasi N1:** 5 tab bawah — Beranda, Acara, Salaman (tombol kuning besar di tengah, radius 14), Pesan (lencana belum dibaca), Profil. |
| 4 | **Ikon I2:** huruf "n" hitam `#07090f` di latar kuning `#f3ba2f`; splash: "n" kuning di `#07090f`. Ekspor PNG 1024 + ikon adaptif Android. |
| 5 | **Font:** Inter (semua teks) + JetBrains Mono (hanya alamat, kode, angka teknis), via paket `@expo-google-fonts`. |
| 7 | **Token B2:** background `#07090f`, card `#0f1420`, border `#1d2638`, text `#e6edf7`, textMuted `#8a96ad`, primary `#f3ba2f`, primaryForeground `#07090f`, verified `#37d6a8`, destructive `#f06a6a`. Radius 8 kartu/tombol, 14 tombol Salaman; kartu bergaris tanpa bayangan; haptic saat salaman berhasil & tombol utama. |
| 10 | **Data baru di fase ini (API ditambah):** (a) riwayat pertemuan di Profil orang (acara/tempat, kapan, jumlah kali) — hanya pertemuan antara penonton dan orang itu; (b) "Dijamin N orang yang juga kamu kenal" — jumlah penjamin (vouch) orang itu yang merupakan koneksimu; (c) "N koneksi bersama" di Radar untuk orang yang belum kamu temui — HANYA ANGKA tanpa nama, dan HANYA bila kedua pihak Terlihat; blokir dua arah tetap berlaku; (d) "hadir sejak <jam>" DIBUANG — cukup "hadir sekarang"; (e) "Kamu terlihat oleh N orang" DIGANTI "N orang terlihat di sini", dihitung dari kartu yang dikirim (`jumlah` yang ada); (f) batang trust BERTINGKAT per tier (4 ruas), bukan persentase — radar/profil tidak mengirim skor mentah. |
| 13 | **Urutan:** (1) spike BNA di monorepo SDK 57 — satu tombol BNA tampil di Expo Go; bila gagal, jatuh ke token + komponen sendiri; (2) fondasi tema/font/alias/ikon/splash; (3) navigasi tab + rute notifikasi; (4) API 3 data baru + tes privasi; (5) migrasi layar per kelompok …; (6) dokumen & verifikasi. Eksekutor: sesi `fcc`. |
| 15 | **Bahasa aplikasi mobile: Inggris** … Istilah terkunci: tab Home · Events · Handshake · Messages · Profile; … tier Baru · Dikenal · Terpercaya · Inti → New · Known · Trusted · Core; … lencana "✓ terverifikasi" → "✓ met in person"; … waktu relatif kemarin / N hari lalu → yesterday / N days ago; tanggal "Aug 12"; jam 24 jam "19:42". |
| 16B | **Warna ruas kosong batang trust** `#56627d` (token baru `segmentEmpty`), kontras 3,01:1 terhadap card `#0f1420` dan 3,3:1 terhadap `verified` `#37d6a8` (WCAG 1.4.11 non-teks ≥ 3:1); menggantikan `border` untuk ruas kosong. |
| 16E | **Aturan dasar aksesibilitas & ergonomi** (§3.7): target sentuh ≥ 44×44 pt iOS / 48×48 dp Android; skala jarak 4/8/12/16/24/32; maks. 4 ukuran huruf per layar, bobot 400 dan 600 (700 hanya `heading`), tanpa Inter 500, 10.5 dan 11 disatukan ke 11; teks ikut ukuran huruf sistem (label tab & lencana dibatasi 1,3×); Reduce Motion; safe area; `accessibilityLabel` untuk tombol ikon dan batang trust; tes baca-kode penjaga yang murah. |

- **R2.** Setiap tab punya Stack sendiri di grup rute (`(beranda)`, `(acara)`, `(salaman)`, `(pesan)`, `(profil)`), sehingga **URL tidak berubah**: `/`, `/feed`, `/events/<id>`, `/radar/<id>`, `/pesan`, `/pesan/<alamat>`, `/profil-saya`, `/connections`, … . `ruteDariNotifikasi` tidak perlu diubah (§4.5).
- **R3.** Tidak ada migrasi DB. Ketiga data baru dibaca dari tabel dan indeks yang sudah ada (§8.5).
- **R10.** Isi tab dipasang hanya saat tab fokus bila isinya berjalan terus (Salaman: QR berputar + kamera).
- **R11.** PNG ikon dibuat dari SVG sumber oleh skrip yang ikut di-commit (§3.5), bukan digambar tangan.
- **R12.** `expo.version` naik ke `0.2.0`.
- **R13.** Sheet salaman berhasil memakai `Modal` React Native, bukan komponen BNA (Rencana B).

### Nilai token yang mengikat (spec §3.1, §3.3, §3.4, §3.5, §3.7, verbatim)

| Token | Nilai |
|---|---|
| `background` | `#07090f` |
| `card` | `#0f1420` |
| `border` | `#1d2638` |
| `segmentEmpty` | `#56627d` |
| `text` / `foreground` / `cardForeground` | `#e6edf7` |
| `textMuted` / `mutedForeground` | `#8a96ad` |
| `primary` | `#f3ba2f` |
| `primaryForeground` | `#07090f` |
| `verified` | `#37d6a8` |
| `destructive` / `destructiveForeground` | `#f06a6a` |
| `input` (latar isian dan tab bar) | `#0b0f19` |
| `placeholder` | `#6b778e` |
| Spanduk pengingat | latar `rgba(243,186,47,0.10)`, garis `rgba(243,186,47,0.40)` |
| Tombol destruktif | latar `rgba(240,106,106,0.12)`, garis `rgba(240,106,106,0.35)`, teks `destructive` |
| Selubung sheet | `rgba(7,9,15,0.70)` |
| Gradasi avatar (§6) | `#2a3550`→`border` |

- Huruf: `heading` 30/700, `title` 18/600, `body` 15/400, `caption` 13/400 redup, `label` 11/600; `mono` JetBrains Mono 13/400 redup. Inter 500 dan JetBrains Mono 500 **tidak** dimuat.
- Radius 8 (kartu, tombol, isian); tombol Salaman 52×52 radius 14, naik 26, cincin 5 px warna latar tab bar; lencana ✓ garis 1 px `verified`, teks 11, radius 5; batang trust tinggi 6 (5 di kartu kecil), radius 3, 4 ruas bercelah 2.
- Jarak: skala **4 / 8 / 12 / 16 / 24 / 32** (`jarak.xs` 4 … `jarak.xxl` 32). Tidak ada nilai `margin*`/`padding*`/`gap` literal di luar skala di kode bertampilan baru.
- Target sentuh 48; label tab bar dan lencana `maxFontSizeMultiplier={1.3}`; `allowFontScaling` tidak pernah dimatikan.
- Path ikon "n" (viewBox `0 0 100 100`): `M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z`.
- Teks izin (`app.json` `ios.infoPlist`): `NSCameraUsageDescription` = "Nearly uses the camera only to scan the QR codes of people you meet."; `NSLocationWhenInUseUsageDescription` = "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event."
- Isi push (spec §7.4): `teksPush` → "New message from <name>" / "New message from a connection"; `teksNotifKedekatan` saling ingin bertemu → "<name> is at this event. You both want to meet." / "Someone you both want to meet is at this event."; pernah bertemu → "<name>, who you've met, is at this event." / "Someone you've met is at this event."
- Aturan bersama data baru (spec §8): (1) tidak pernah lewat spread — objek respons dibangun kunci demi kunci; (2) gagal = kunci hilang, bukan angka karangan; (3) tidak ada nama, alamat, atau sel lokasi orang ketiga; (4) semua alamat dibandingkan dalam huruf kecil.

### Batas jalur (spec §13 dipersempit untuk Rencana A)

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` (termasuk `app.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `assets/`, `scripts/`) | `packages/**` (termasuk `packages/trust/**` dan `TIER_LABELS`, `packages/contracts/**`, `packages/shared/**`) |
| `apps/api/src/ports.ts`, `apps/api/src/pertemuan-store.ts` (baru), `apps/api/src/pertemuan.ts` (baru), `apps/api/src/routes/profile.ts`, `apps/api/src/routes/radar.ts`, `apps/api/src/radar-gate.ts`, `apps/api/src/radar-store.ts`, `apps/api/src/pesan-push.ts`, `apps/api/src/radar-notif.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts` | `apps/web/**` |
| `apps/api/test/**` (tes di atas beserta `test/support/*`) | `.env` mana pun — root, `apps/mobile/.env`, `apps/api/.env` (dibaca pun tidak) |
| `pnpm-lock.yaml` (akibat `expo install` / `bna-ui add` / `pnpm add`) | `supabase/**` — tidak ada migrasi di fase ini |
| `docs/superpowers/plans/*` (hanya rencana ini bila controller meminta koreksi) | berkas lain di `apps/api/src` |

### Batas keras eksekusi

- **JANGAN membaca, mencetak, atau menyunting `.env` mana pun.** `npx expo export` memuat `apps/mobile/.env` sendiri; itu boleh, tetapi keluarannya tidak disalin ke laporan selain nama variabel yang dicetak Expo.
- **JANGAN menjalankan server di port 8787 atau 8081** (pemilik memakainya): tidak `pnpm dev`, tidak `npx expo start`, tidak simulator. Bundel diverifikasi dengan `npx expo export --platform ios` ke direktori sementara **di luar repo** (`mktemp -d`); uji di iPhone dilakukan pemilik project.
- Dilarang `git reset --hard`, `git clean`, `rm -r`, force-push, `git commit --amend`, dan push. `rm` hanya untuk berkas tunggal yang disebut di langkah; `rmdir` hanya untuk direktori kosong.
- Setiap commit memakai `git add` / `git rm` / `git mv` dengan **nama berkas eksplisit** (tidak pernah `git add -A` / `git add .` / `git add <direktori>`), pesan commit berbahasa Indonesia yang diakhiri satu baris kosong lalu `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Kunci dompet dan 12 kata tidak pernah dicatat ke log, konsol, atau laporan.
- Signer tidak dibuat di badan komponen (aturan yang ada: selalu lewat `useNearlySigner`, pola pembungkus + isi).
- **Protokol mutasi** (dijalankan SETELAH commit task): terapkan mutasi persis seperti tertulis → jalankan perintah tes yang disebut → **rekam nama tes yang merah** → kembalikan dengan `git checkout -- <berkas>` → jalankan ulang sampai hijau → `git status --short` kosong. Kalau mutasi TIDAK memerahkan tes yang disebut, laporkan — jangan menyetel tesnya sampai merah.
- Bila sebuah teks "lama" yang harus diganti di langkah Edit tidak ditemukan persis (mis. keluaran CLI BNA berbeda dari yang dicatat di sini), **berhenti dan laporkan** isi berkas di sekitar tempat itu — jangan menebak.

### Konvensi repo

- Pengenal, komentar, dan judul `describe`/`it` berbahasa Indonesia; **teks yang dilihat pengguna yang ditulis BARU di rencana ini berbahasa Inggris** (spec §7.4). Kalimat lama di layar yang belum dimigrasi dibiarkan (Rencana B menerjemahkannya).
- Impor: **tanpa ekstensi `.js`** (aturan Metro). `src/**` diimpor dengan jalur relatif (seperti sekarang). Salinan BNA dan kode di `components/`, `hooks/`, `theme/` diimpor lewat alias `@/…` (konvensi BNA; spec §10.1 mewajibkan `@/components/ui/input`). Kode di `src/` tidak pernah mengimpor `@/…`.
- Semua perintah dijalankan dari **akar worktree** `/Users/mac/developer/nearly-desain` kecuali disebut `cd apps/mobile`. Tes mobile: `pnpm --filter @nearly/mobile exec vitest run <path>`; typecheck mobile: `pnpm --filter @nearly/mobile exec tsc --noEmit`; tes API: `pnpm --filter @nearly/api exec vitest run <path>`; typecheck API: `pnpm --filter @nearly/api exec tsc --noEmit`. Setiap task berakhir dengan `pnpm -r test` dan `pnpm -r typecheck` hijau.
- Tes mobile **hanya fungsi murni atau baca-kode** (tidak ada harness render RN). Tes API memakai fake `test/support/*`.
- Judul tes TIDAK menyebut jumlah.
- Ekspor bundel (verifikasi Metro): `EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")` — Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`. Jangan menghapus direktori itu dengan `rm -r`; ia di luar repo.

---

## Pemetaan Spec → Task

| Spec | Isi | Task |
|---|---|---|
| §9 langkah 1, §3.6, §11 #1, #4 | Spike BNA, alias `@/*`, palet B2, layar uji, gerbang uji iPhone pemilik | 1 |
| §3.1, §3.3, §3.4, §3.6, §3.7 (Reduce Motion) | `globals.ts`, pemetaan varian→`fontFamily`, suntingan salinan BNA, `useGerakDikurangi`, penjaga warna/aksesibilitas awal | 2 |
| §3.5, R11 | SVG sumber, skrip `@resvg/resvg-js`, tiga PNG, `LogoN`, `app.json` ikon | 3 |
| §3.2, §3.3 (font), §3.5 (splash), §4.2, §7.4 (izin), R12 | Font + splash, `app.json` gelap/0.2.0/izin Inggris, root layout dengan `ToastProvider` | 4 |
| §7.1 (`pasanganJamak`), §7.4 (jamak, tanggal, jam, relatif), §6.1 (sapaan) | `src/jamak.ts`, `src/waktu.ts` | 5 |
| §6 (`labelAksesTrust`, `tierDariLabel`, `hurufAvatar`), §6.2 (`judulSheetBertemu`), §7.4 (tier Inggris, tag), §3.7 (hitSlop), §10.1 (`TIER_LABELS`) | `src/tier.ts`, `src/teks-ui.ts`, `src/aksesibilitas.ts`, `messages.ts`, penjaga `TIER_LABELS` | 6 |
| §6 komponen bersama, §7.2 empat keadaan, §3.7 | `Avatar`, `Lencana`, `BatangTrust`, `KartuOrang`, `Segmen`, keadaan, `TautanKecil` | 7 |
| §4.1, §4.2, §4.3, §4.5, §4.6, §4.7, §5, R1, R2, R10 | Pohon rute, Stack per tab, tab bar, Salaman gabungan, judul Inggris, tautan | 8 |
| §4.4 | `useLencanaTab`, lencana Pesan + titik Profil, muat ulang setelah dibaca/dilihat | 9 |
| §8.1, §8.2 (store), §8.5 | `PertemuanStore`, `supabase-memori` diperluas | 10 |
| §8.1, §8.2 (rute), §10.2 | `pertemuan` + `dijaminKenalan` di `GET /profile/:address` | 11 |
| §8.3, §10.2 | `koneksiBersama` di radar + cache 60 detik | 12 |
| §7.4 (push), §10.2 | Isi push Inggris | 13 |
| §9 (hijau per langkah), §13 | Verifikasi global, batas jalur, serah terima | 14 |

**Tidak di Rencana A (Rencana B):** spec §9 langkah 5 (a)–(g) dan langkah 6 — lihat "Serah terima ke Rencana B" di akhir.

## Ruling (keputusan rencana di luar teks spec)

- **A1. Hasil spike repo menggantikan "Hal BNA yang BELUM pasti" di spec §3.6** (sudah dicatat di spec bersama commit rencana ini): CLI `pnpm dlx bna-ui@3.0.0 add … --pnpm -y` berjalan di `apps/mobile` tanpa `init` asalkan `tsconfig.json` punya `baseUrl "."` + `paths {"@/*":["./*"]}`; CLI memasang `react-native-reanimated` **4.5.1**, `react-native-worklets` **0.10.1**, `react-native-gesture-handler` ~2.32.0, `expo-haptics` ~57.0.3, `lucide-react-native` ^1.47.0 lewat `expo install` (versi yang cocok dengan Expo Go SDK 57 — bukan 4.6.0/0.12.1 yang ada secara tidak langsung). **BNA tidak punya `ThemeProvider`**: `useColor` membaca `theme/colors.ts` menurut skema dari `hooks/useColorScheme.ts`; Nearly mengisi palet B2 di kunci `light` dan `dark` dan membuat `useColorScheme` selalu `"dark"`; `ModeProvider` tidak dipakai (`providers/mode-provider.tsx` dan `hooks/useColorScheme.web.ts` dihapus). Toast = `ToastProvider` (membungkus `GestureHandlerRootView`) di root layout + `useToast().toast({ title, description, variant })`. `Input` meneruskan semua `TextInputProps`. Tidak ada plugin babel tambahan. `npx expo export --platform ios` membundel.
- **A2. Layar yang belum dimigrasi tetap berlatar terang.** Header semua layar memakai token gelap sejak Task 4 (`OPSI_STACK`), tetapi `contentStyle` gelap hanya diberikan ke kunci di `LAYAR_TERMIGRASI` (`src/judul-layar.ts`, kosong di Rencana A). Tanpa ini, teks hitam bawaan layar lama tidak terbaca di atas latar `#07090f` selama Rencana B berjalan. Rencana B menambah kunci setiap layar yang dimigrasinya; setelah kelompok terakhir, himpunan itu memuat semua kunci.
- **A3. `src/warna.ts` dan `test/warna-isian.test.ts` BERTAHAN sampai Rencana B** (spec §9 langkah 2 menyebut dihapus di langkah 2). Keduanya dipakai setiap `<TextInput>` di layar yang belum dimigrasi; menghapusnya berarti menyentuh setiap layar formulir sekarang. Rencana B menghapusnya bersama `<TextInput>` terakhir. `test/tema.test.ts` mengecualikan `src/warna.ts` dari penjaga warna sampai saat itu.
- **A4. Penjaga baca-kode dibatasi pada "kode bertampilan baru"** lewat `test/support/berkas.ts`: komponen kita (bukan salinan BNA dan bukan `KOMPONEN_BELUM_DIMIGRASI`), `hooks/`, `theme/`, semua `app/**/_layout.tsx`, dan layar di `LAYAR_TERMIGRASI`. Penjaga warna juga mencakup salinan BNA dan `src/`. Rencana B menumbuhkan cakupan ini lewat dua himpunan itu (spec §9 langkah 5: "sebelum itu berlaku untuk berkas yang sudah dimigrasi").
- **A5. Satu komponen `components/stack-tab.tsx`** dipakai kelima `_layout.tsx` tab (`<StackTab grup="(acara)" />`), bukan lima salinan pendaftaran judul. Tes `judul-layar` memeriksa bahwa setiap layout tab merender `StackTab` dengan grupnya dan bahwa `StackTab` mendaftarkan `layarDalam(...)`.
- **A6. Lencana tab dirender di `components/tab/ikon-tab.tsx`, bukan lewat `tabBarBadge`.** Lencana bawaan bottom-tabs tidak menerima `maxFontSizeMultiplier` (spec §3.7 mengizinkan jalur ini). Warna lencana `destructive` dengan teks `background` (kontras terhadap tab aktif `primary`); titik Profil memakai warna yang sama.
- **A7. Komponen BNA di Rencana A:** `button`, `text`, `input`, `toast` (spike) + `card`, `skeleton`, `separator` (Task 2), beserta dependensi yang ditarik CLI (`icon`, `spinner`, `view`). `Avatar` adalah komponen kita (`components/avatar.tsx`, gradasi + huruf), bukan BNA `avatar`. `badge`, `progress`, `switch`, `alert-dialog`, `avoid-keyboard` ditambahkan Rencana B hanya bila layar yang dimigrasi membutuhkannya, dengan aturan suntingan yang sama (token, tanpa warna literal).
- **A8. Suntingan salinan BNA:** `text.tsx` ditulis ulang (varian spec + `mono`, `label`; `fontWeight` diterjemahkan ke `fontFamily` dan tidak diteruskan); `button.tsx` (haptic bawaan hanya varian `default`, destruktif = latar/garis transparansi `destructive`, tinggi `sm` 48); `input.tsx` (varian bawaan `outline` berlatar `input`, placeholder token, Inter); `toast.tsx` (warna token, garis, Reduce Motion lewat hook bersama); `card.tsx` (garis `border`, tanpa bayangan, padding 16); `skeleton.tsx` ditulis ulang (diam saat Reduce Motion). `GroupedInput`/`GroupedInputItem` di `input.tsx` tidak disunting dan **tidak boleh dipakai** tanpa disunting dulu.
- **A9. Ketukan notifikasi memakai `router.navigate`, bukan `router.push`.** Dengan `(tabs)` sebagai layar Stack akar, `push` bisa menumpuk navigator tab kedua di atas yang ada; `navigate` kembali ke `(tabs)` yang ada lalu berpindah tab. `ruteDariNotifikasi` tidak berubah.
- **A10. Layar Salaman di Rencana A:** pembungkus dua signer + `SalamanIsi` dengan `Segmen` "Show QR"/"Scan" dan `useIsFocused()`; `app/qr.tsx` → `components/salaman/mode-qr.tsx` dan `app/scan.tsx` → `components/salaman/mode-pindai.tsx` lewat `git mv`, isinya dipindah apa adanya (tampilan dan kalimat lama). Mode dari `?mode=pindai` dibaca saat pasang dan saat parameternya berubah. Sheet "You met …", terjemahan, dan tampilan baru adalah Rencana B 5(a).
- **A11. `useLencanaTab` dipasang di `(tabs)/_layout.tsx` dan dibagikan lewat konteks** (`PenyediaLencana`, `useLencana()`); Beranda lama membaca angkanya dari konteks sehingga tidak lagi menandatangani sendiri; Kecocokan dan Percakapan memanggil `muatUlangLencana()` setelah menandai dilihat/dibaca.
- **A12. `tsconfig.json` `include` tidak memuat `scripts`** (spec §3.6 menyebutnya): isinya `.mjs` yang tidak diperiksa `tsc` tanpa `allowJs`.
- **A13. Bobot 500 diterjemahkan ke `Inter_600SemiBold`** oleh `keluargaUntuk` — salinan BNA menulis `fontWeight: '500'` di beberapa tempat dan Inter 500 tidak dimuat.
- **A14. Penjaga jarak memakai nilai mutlak** (`|nilai| ∈ {0,4,8,12,16,24,32}`), supaya tumpang tindih avatar sheet (`-16`, Rencana B) lolos.
- **A15. Lencana varian `teks` (mis. "You both want to meet") bergaris dan berteks `primary`;** varian `terverifikasi`/`ringkas` `verified` (spec §3.4).
- **A16. `startsAt` di `pertemuan.acaraBersama` = detik unix sebagai string** (bentuk yang sama dengan `startsAt` acara di API sekarang, yang HP ubah dengan `Number(x) * 1000`).
- **A17. Cache koneksi bersama dibuat sekali per `radarRoutes`** (`buatPenghitungKoneksiBersama`), berkunci pemanggil + himpunan kandidat + himpunan blokir; `lihatRadar` menerima penghitung sebagai argumen keempat opsional (tanpa cache bila tidak diberikan — dipakai tes lama).
- **A18. `test/support/supabase-memori.ts` diperluas** dengan `in`, `order`, `range`, dan `maybeSingle` untuk tes pemetaan store baru; perilaku yang ada tidak berubah.
- **A19. Tipe respons baru di sisi HP dan kalimat data baru** ("✓ met in person · N events together", "Vouched for by …", "N mutual connections", "N people visible here", baris pertemuan, pemisahan kartu radar) **adalah Rencana B** (kelompok (c) dan (d)), bersama layar yang memakainya.

---

## Struktur Berkas

| Berkas | Tanggung jawab | Task |
|---|---|---|
| `apps/mobile/tsconfig.json`, `vitest.config.ts` | Alias `@/*` untuk tsc dan vitest | 1 |
| `apps/mobile/components/ui/{button,text,input,toast,icon,spinner}.tsx` | Salinan BNA (CLI) | 1, 2 |
| `apps/mobile/components/ui/{card,skeleton,separator,view}.tsx` | Salinan BNA (CLI) | 2 |
| `apps/mobile/hooks/{useColor,useColorScheme,useHaptics}.ts` | Salinan BNA; `useColorScheme` selalu gelap | 1 |
| `apps/mobile/hooks/useGerakDikurangi.ts` | Reduce Motion | 2 |
| `apps/mobile/theme/colors.ts` | Palet B2 (satu-satunya berkas TS berwarna literal) | 1 |
| `apps/mobile/theme/globals.ts`, `theme/huruf.ts` | Token huruf/jarak/radius/ukuran; berat → `fontFamily` | 2 |
| `apps/mobile/theme/navigasi.ts` | Opsi header Stack, `opsiTampilan(kunci)` | 4, 8 |
| `apps/mobile/app/spike-bna.tsx` | Layar uji spike SEMENTARA | 1 (dihapus di 8) |
| `apps/mobile/assets/sumber/n.svg`, `assets/{icon,adaptive-icon,splash-icon}.png`, `scripts/buat-ikon.mjs` | Ikon & splash | 3 |
| `apps/mobile/components/logo-n.tsx` | Logo "n" (SVG) | 3 |
| `apps/mobile/app/_layout.tsx` | Font, splash, `ToastProvider`, gerbang dompet, notifikasi | 4, 8 |
| `apps/mobile/app.json` | Gelap, 0.2.0, ikon, splash, izin Inggris | 3, 4 |
| `apps/mobile/src/splash.ts`, `src/teks-ui.ts`, `src/jamak.ts`, `src/waktu.ts`, `src/aksesibilitas.ts`, `src/salaman-mode.ts` | Fungsi & konstanta murni baru | 4–8 |
| `apps/mobile/src/tier.ts`, `src/messages.ts` | Tier Inggris; `judulSheetBertemu` | 6 |
| `apps/mobile/components/{avatar,lencana,batang-trust,kartu-orang,segmen,keadaan,tautan-kecil}.tsx` | Komponen bersama | 7 |
| `apps/mobile/src/judul-layar.ts` | `JUDUL_LAYAR`, `LAYAR_AKAR`, `layarMenurutDompet`, `layarDalam`, `TAB_BAWAH`, `LAYAR_TERMIGRASI` | 4, 8 |
| `apps/mobile/components/stack-tab.tsx`, `components/tab/{ikon-tab,tombol-salaman}.tsx` | Stack per tab, ikon & tombol tab bar | 8 |
| `apps/mobile/app/(tabs)/_layout.tsx`, `app/(tabs)/(…)/_layout.tsx`, `app/(tabs)/(salaman)/salaman.tsx` | Tabs, Stack per tab, layar Salaman | 8, 9 |
| `apps/mobile/components/salaman/{mode-qr,mode-pindai}.tsx` | `app/qr.tsx`/`app/scan.tsx` dipindah | 8 |
| 16 layar di `apps/mobile/app/` | Dipindah ke grup (`git mv`), impor relatif disesuaikan | 8 |
| `apps/mobile/src/lencana/{lencana-tab.ts,konteks-lencana.tsx}` | Lencana tab | 9 |
| `apps/mobile/test/{tema,aksesibilitas,huruf,ikon,app-json,splash,jamak,waktu,teks-ui,tautan,salaman-mode,lencana-tab}.test.ts`, `test/support/{berkas,rute}.ts` | Tes baru | 1–9 |
| `apps/mobile/test/{judul-layar,gerbang-dompet,dompet-tanpa-kunci-dev,rute-push,tier}.test.ts` | Tes yang diperbarui | 4–9 |
| `apps/api/src/ports.ts` | `PertemuanStore` (blok baru), `RadarStore.hitungKoneksiBersama` | 10, 12 |
| `apps/api/src/pertemuan-store.ts`, `apps/api/src/pertemuan.ts` | Store dan logika murni riwayat pertemuan/penjamin | 10, 11 |
| `apps/api/src/routes/profile.ts`, `radar-gate.ts`, `radar-store.ts`, `routes/radar.ts` | Medan baru | 11, 12 |
| `apps/api/src/pesan-push.ts`, `radar-notif.ts` | Isi push Inggris | 13 |
| `apps/api/src/app.ts`, `apps/api/src/index.ts` | `TrustDeps.pertemuan` | 10 |
| `apps/api/test/support/{supabase-memori,deps,dunia-radar,dunia-pertemuan}.ts`, tes baru dan tes yang diperbarui | Fake dan tes | 10–13 |

---
## Task 1: Spike BNA — gerbang uji iPhone pemilik

**Files:**
- Modify: `apps/mobile/tsconfig.json`, `apps/mobile/vitest.config.ts`, `apps/mobile/src/judul-layar.ts`, `apps/mobile/app/index.tsx`
- Modify (oleh CLI): `apps/mobile/package.json`, `pnpm-lock.yaml`, mungkin `apps/mobile/app.json`
- Create (oleh CLI): `apps/mobile/components/ui/{button,icon,input,spinner,text,toast}.tsx`, `apps/mobile/hooks/{useColor,useHaptics}.ts`, `apps/mobile/theme/globals.ts`
- Create (ditulis tangan, menimpa salinan CLI bila ada): `apps/mobile/theme/colors.ts`, `apps/mobile/hooks/useColorScheme.ts`
- Create: `apps/mobile/app/spike-bna.tsx` (SEMENTARA, dihapus di Task 8), `apps/mobile/test/tema.test.ts`
- Delete (bila dibuat CLI): `apps/mobile/providers/mode-provider.tsx`, `apps/mobile/hooks/useColorScheme.web.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - Alias `@/*` → `apps/mobile/*` di `tsc` dan vitest
  - `theme/colors.ts`: `Colors` (`{ light, dark }`, keduanya objek palet yang sama), `lightColors`, `darkColors`, `type ColorKeys` — kunci BNA + `verified`, `segmentEmpty`, `placeholder`, `avatarAwal`, `selubung`, `spandukLatar`, `spandukGaris`, `destruktifLatar`, `destruktifGaris`
  - `hooks/useColor.ts` (BNA): `useColor(nama: ColorKeys, props?: { light?: string; dark?: string }): string`
  - `hooks/useColorScheme.ts`: `useColorScheme(): "light" | "dark"` — selalu `"dark"`
  - `components/ui/{button,text,input,toast}.tsx` (BNA, belum disunting): `Button`, `Text`, `Input`, `ToastProvider`, `useToast`
  - Rute sementara `/spike-bna`

- [ ] **Step 1: Alias `@/*` di tsconfig dan vitest**

Ganti SELURUH isi `apps/mobile/tsconfig.json` dengan:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["src", "test", "app", "components", "hooks", "theme"]
}
```

Ganti SELURUH isi `apps/mobile/vitest.config.ts` dengan:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Alias yang sama dengan tsconfig "paths" (@/* → akar apps/mobile), supaya
  // tes yang mengimpor modul ber-alias tetap jalan (spec desain UI §3.6).
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["test/**/*.test.ts"],
    env: {
      EXPO_PUBLIC_API_URL: "http://localhost:8787",
      EXPO_PUBLIC_CONNECTION_REGISTRY: "0x0000000000000000000000000000000000000001",
      EXPO_PUBLIC_VOUCH_REGISTRY: "0x0000000000000000000000000000000000000002",
      EXPO_PUBLIC_ATTENDANCE_REGISTRY: "0x0000000000000000000000000000000000000003",
    },
  },
});
```

- [ ] **Step 2: Tulis tes palet yang gagal**

`apps/mobile/test/tema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Colors } from "../theme/colors";

// Nilai persis spec desain UI §3.1 dan §3.4 (keputusan #7, #16B).
const B2: Record<string, string> = {
  background: "#07090f",
  card: "#0f1420",
  border: "#1d2638",
  segmentEmpty: "#56627d",
  text: "#e6edf7",
  foreground: "#e6edf7",
  cardForeground: "#e6edf7",
  textMuted: "#8a96ad",
  mutedForeground: "#8a96ad",
  primary: "#f3ba2f",
  primaryForeground: "#07090f",
  verified: "#37d6a8",
  destructive: "#f06a6a",
  destructiveForeground: "#f06a6a",
  input: "#0b0f19",
  placeholder: "#6b778e",
};

const TURUNAN: Record<string, string> = {
  selubung: "rgba(7,9,15,0.70)",
  spandukLatar: "rgba(243,186,47,0.10)",
  spandukGaris: "rgba(243,186,47,0.40)",
  destruktifLatar: "rgba(240,106,106,0.12)",
  destruktifGaris: "rgba(240,106,106,0.35)",
};

describe("token warna B2", () => {
  // Tema dikunci gelap: skema apa pun yang terbaca tidak boleh menghasilkan
  // warna terang (spec §3.1, §3.2).
  it("objek light dan dark identik", () => {
    expect(Colors.light).toEqual(Colors.dark);
  });

  it("nilai token persis spec §3.1 dan §3.4", () => {
    for (const [kunci, nilai] of Object.entries(B2)) {
      expect(Colors.dark[kunci as keyof typeof Colors.dark], kunci).toBe(nilai);
    }
  });

  it("turunan transparansi persis spec §3.4", () => {
    for (const [kunci, nilai] of Object.entries(TURUNAN)) {
      expect(Colors.dark[kunci as keyof typeof Colors.dark], kunci).toBe(nilai);
    }
  });

  it("ruas kosong batang trust memakai segmentEmpty, bukan warna garis", () => {
    expect(Colors.dark.segmentEmpty).toBe("#56627d");
    expect(Colors.dark.segmentEmpty).not.toBe(Colors.dark.border);
  });

  // Tidak ada nilai baru di luar palet B2 selain turunan transparansi dan
  // gradasi avatar #2a3550 yang disebut spec §6.
  it("setiap nilai adalah warna palet atau turunannya", () => {
    const izin = new Set([...Object.values(B2), ...Object.values(TURUNAN), "#2a3550"]);
    const asing = Object.entries(Colors.dark).filter(([, v]) => !izin.has(v)).map(([k]) => k);
    expect(asing).toEqual([]);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/tema.test.ts`
Expected: FAIL — `Failed to resolve import "../theme/colors"` (berkas belum ada).

- [ ] **Step 4: Salin komponen BNA dengan CLI**

```bash
cd apps/mobile && pnpm dlx bna-ui@3.0.0 add button text input toast --pnpm -y && cd ../..
```

Expected: CLI selesai tanpa galat, menyalin `components/ui/*.tsx`, `hooks/*.ts`, `theme/*.ts`, dan memasang paket lewat `expo install`. Kalau CLI menolak ("alias"/"tsconfig") atau gagal karena jaringan, **berhenti dan laporkan** — jangan memasang BNA dengan cara lain.

- [ ] **Step 5: Periksa hasil CLI**

```bash
git status --short
(cd apps/mobile && node -e "for (const p of ['react-native-reanimated','react-native-worklets','react-native-gesture-handler','expo-haptics','lucide-react-native']) console.log(p, require(p + '/package.json').version)")
git diff -- apps/mobile/package.json | grep '^[-+] '
git diff -- apps/mobile/app.json
```

Expected:
- berkas baru di bawah `apps/mobile/components/ui/` (minimal `button.tsx`, `icon.tsx`, `input.tsx`, `spinner.tsx`, `text.tsx`, `toast.tsx`), `apps/mobile/hooks/` (minimal `useColor.ts`, `useColorScheme.ts`, `useHaptics.ts`), `apps/mobile/theme/` (`colors.ts`, `globals.ts`), mungkin `apps/mobile/providers/mode-provider.tsx` dan `apps/mobile/hooks/useColorScheme.web.ts`;
- versi `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `react-native-gesture-handler 2.32.x`, `expo-haptics 57.0.x`, `lucide-react-native 1.x`;
- `package.json` menambah tepat kelima paket itu di `dependencies`;
- `app.json` tidak berubah (atau hanya bertambah satu entri plugin — laporkan apa adanya).

Kalau versi reanimated/worklets BERBEDA dari 4.5.1/0.10.1, **berhenti dan laporkan** (spec §11 batas #4: versi JS harus persis cocok dengan modul native Expo Go). Kalau CLI menulis berkas di luar `components/`, `hooks/`, `theme/`, `providers/`, `package.json`, `app.json`, `tsconfig.json`, `pnpm-lock.yaml`, laporkan dan jangan commit berkas itu tanpa persetujuan controller.

- [ ] **Step 6: Kembalikan tsconfig, tulis palet B2, kunci skema gelap**

CLI bisa memformat ulang `apps/mobile/tsconfig.json`: tulis ulang SELURUH isinya persis seperti Step 1.

Ganti SELURUH isi `apps/mobile/theme/colors.ts` dengan:

```ts
/**
 * Palet B2 "Seimbang" (spec desain UI §3.1, keputusan #7 dan #16B).
 *
 * SATU-SATUNYA berkas TypeScript yang boleh memuat warna literal (dijaga
 * test/tema.test.ts). Nearly selalu gelap (keputusan #2): objek `light` dan
 * `dark` adalah palet yang SAMA, sehingga skema apa pun yang terbaca oleh
 * salinan BNA tidak pernah menghasilkan warna terang.
 *
 * Kunci bawaan BNA yang tidak ada di tabel spec dipetakan ke token B2 terdekat
 * (komentar per baris). Tidak ada nilai baru di luar palet selain turunan
 * transparansi dari nilai yang sama dan gradasi avatar (spec §6).
 */
const palet = {
  // Dasar (spec §3.1)
  background: "#07090f",
  foreground: "#e6edf7",
  card: "#0f1420",
  cardForeground: "#e6edf7",
  popover: "#0f1420", // = card
  popoverForeground: "#e6edf7",
  primary: "#f3ba2f",
  primaryForeground: "#07090f",
  secondary: "#0f1420", // = card
  secondaryForeground: "#e6edf7",
  muted: "#1d2638", // = border: latar skeleton
  mutedForeground: "#8a96ad",
  accent: "#0f1420", // = card
  accentForeground: "#e6edf7",
  destructive: "#f06a6a",
  destructiveForeground: "#f06a6a",
  border: "#1d2638",
  input: "#0b0f19", // latar isian dan tab bar (spec §3.4)
  ring: "#f3ba2f", // = primary: fokus isian
  text: "#e6edf7",
  textMuted: "#8a96ad",

  // Kunci lama BNA
  tint: "#f3ba2f", // = primary
  icon: "#8a96ad", // = textMuted
  tabIconDefault: "#8a96ad", // = textMuted
  tabIconSelected: "#f3ba2f", // = primary

  // Warna sistem iOS milik BNA → token B2 terdekat
  blue: "#f3ba2f", // tautan dan tombol bawaan → primary
  green: "#37d6a8", // → verified
  red: "#f06a6a", // → destructive
  orange: "#f3ba2f", // → primary
  yellow: "#f3ba2f", // → primary
  pink: "#f06a6a", // → destructive
  purple: "#8a96ad", // → textMuted
  teal: "#37d6a8", // → verified
  indigo: "#8a96ad", // → textMuted

  // Keadaan semantik BNA
  success: "#37d6a8", // → verified
  successForeground: "#07090f",
  warning: "#f3ba2f", // → primary
  warningForeground: "#07090f",
  info: "#e6edf7", // → text
  infoForeground: "#07090f",
  error: "#f06a6a", // → destructive
  errorForeground: "#07090f",

  // Kunci Nearly (spec §3.1, §3.4, §6)
  verified: "#37d6a8",
  segmentEmpty: "#56627d",
  placeholder: "#6b778e",
  avatarAwal: "#2a3550",
  selubung: "rgba(7,9,15,0.70)",
  spandukLatar: "rgba(243,186,47,0.10)",
  spandukGaris: "rgba(243,186,47,0.40)",
  destruktifLatar: "rgba(240,106,106,0.12)",
  destruktifGaris: "rgba(240,106,106,0.35)",
} as const;

export const lightColors = palet;
export const darkColors = palet;
export const Colors = { light: lightColors, dark: darkColors };

export type ColorKeys = keyof typeof palet;
```

Ganti SELURUH isi `apps/mobile/hooks/useColorScheme.ts` dengan:

```ts
/**
 * Skema warna aplikasi. Nearly SELALU gelap (spec desain UI §3.2, keputusan
 * #2): hook ini tidak membaca skema OS dan tidak memakai ModeProvider BNA.
 * Tipe kembaliannya tetap dua nilai supaya `useColor` salinan BNA tidak
 * perlu disunting.
 */
export function useColorScheme(): "light" | "dark" {
  return "dark";
}
```

Periksa pemakai `mode-provider` dan `useColorScheme.web`, lalu hapus kedua berkas bila ada:

```bash
grep -rn "mode-provider\|useModeContext\|ModeProvider" apps/mobile/components apps/mobile/hooks apps/mobile/theme apps/mobile/app apps/mobile/src
```

Expected: hanya `apps/mobile/hooks/useColorScheme.web.ts` (bila ada) dan `apps/mobile/providers/mode-provider.tsx` sendiri. Bila ada pemakai lain, **berhenti dan laporkan**. Kalau tidak:

```bash
rm -f apps/mobile/providers/mode-provider.tsx apps/mobile/hooks/useColorScheme.web.ts
rmdir apps/mobile/providers 2>/dev/null || true
```

- [ ] **Step 7: Jalankan tes palet, pastikan lulus**

Run: `pnpm --filter @nearly/mobile exec vitest run test/tema.test.ts`
Expected: PASS, kelima tes hijau.

- [ ] **Step 8: Layar uji spike sementara**

`apps/mobile/app/spike-bna.tsx`:

```tsx
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { useColor } from "@/hooks/useColor";

/**
 * SEMENTARA — layar uji spike BNA (Rencana A Task 1, spec desain UI §9
 * langkah 1). Pemilik membukanya di Expo Go lewat tautan di beranda lama.
 * Dihapus di Task 8.
 */
export default function SpikeBna() {
  return (
    <ToastProvider>
      <SpikeIsi />
    </ToastProvider>
  );
}

function SpikeIsi() {
  const { toast } = useToast();
  const latar = useColor("background");
  const [isi, setIsi] = useState("");
  return (
    <View style={[s.root, { backgroundColor: latar }]}>
      <Text variant="heading">Nearly</Text>
      <Text variant="caption">BNA spike · B2 palette</Text>
      <Input
        placeholder="Write a message…"
        value={isi}
        onChangeText={setIsi}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
      />
      <Button onPress={() => toast({ title: "Connected", description: "BNA toast works.", variant: "success" })}>
        Show toast
      </Button>
      <Button variant="outline" onPress={() => setIsi("")}>
        Clear
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
});
```

(Di Task 1 `components/ui/view.tsx` belum ada; `View` diambil dari `react-native` di berkas sementara ini.)

Di `apps/mobile/src/judul-layar.ts`, ganti

```ts
  "pesan/lapor/[address]": "Lapor",
};
```

dengan

```ts
  "pesan/lapor/[address]": "Lapor",
  // SEMENTARA (Rencana A Task 1) — dihapus bersama app/spike-bna.tsx di Task 8.
  "spike-bna": "Spike BNA",
};
```

Di `apps/mobile/app/index.tsx`, ganti

```tsx
      <Link href="/dompet" style={s.link}>Dompet</Link>
```

dengan

```tsx
      <Link href="/dompet" style={s.link}>Dompet</Link>
      <Link href="/spike-bna" style={s.link}>Spike BNA (sementara)</Link>
```

- [ ] **Step 9: Tes dan typecheck seluruh repo**

```bash
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: ketiganya lulus (keluar 0). Kalau `tsc` melaporkan galat di `components/ui/*` salinan CLI, **berhenti dan laporkan** isi galatnya (temuan spike: hanya `bottom-sheet` yang gagal, dan komponen itu tidak disalin).

- [ ] **Step 10: Ekspor bundel iOS ke direktori sementara**

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: …` tanpa `Error`; tidak ada peringatan "worklets" / "reanimated version mismatch". Laporkan dua baris terakhir keluarannya.

- [ ] **Step 11: Commit**

Tambahkan berkas SATU PER SATU sesuai `git status --short` (daftar di bawah adalah yang diharapkan; sesuaikan dengan nama yang benar-benar dibuat CLI di Step 5, tetap eksplisit):

```bash
git add apps/mobile/tsconfig.json apps/mobile/vitest.config.ts apps/mobile/package.json pnpm-lock.yaml \
  apps/mobile/components/ui/button.tsx apps/mobile/components/ui/icon.tsx apps/mobile/components/ui/input.tsx \
  apps/mobile/components/ui/spinner.tsx apps/mobile/components/ui/text.tsx apps/mobile/components/ui/toast.tsx \
  apps/mobile/hooks/useColor.ts apps/mobile/hooks/useColorScheme.ts apps/mobile/hooks/useHaptics.ts \
  apps/mobile/theme/colors.ts apps/mobile/theme/globals.ts \
  apps/mobile/app/spike-bna.tsx apps/mobile/app/index.tsx apps/mobile/src/judul-layar.ts apps/mobile/test/tema.test.ts
git status --short   # WAJIB kosong; bila app.json berubah di Step 5, tambahkan juga: git add apps/mobile/app.json
git commit -m "feat(mobile): spike BNA UI — salinan komponen, palet B2, layar uji sementara

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 12: BERHENTI — uji iPhone oleh pemilik (gerbang spike)**

**Pelaksana berhenti di sini dan melapor ke controller.** Controller meneruskan ke pemilik project dan **tidak memulai Task 2** sampai pemilik menjawab.

Instruksi untuk pemilik (Expo Go, iPhone):

1. Di `apps/mobile`: `npx expo start --go -c`, buka di Expo Go.
2. Beranda lama → ketuk **Spike BNA (sementara)**.
3. Periksa: latar gelap `#07090f`; judul "Nearly" terang; isian bisa diketik dan placeholder terbaca; tombol **Show toast** kuning dengan teks gelap, mengecil/membesar saat ditekan dan HP bergetar ringan; toast "Connected" muncul dari atas; tombol **Clear** bergaris; **tidak ada layar merah** (khususnya "worklets"/"reanimated version mismatch").

- **Lolos** → pemilik menjawab "spike lolos"; controller melanjutkan ke Task 2.
- **Gagal** → pemilik mengirim tangkapan layar/pesan galat. Controller **menghentikan eksekusi Rencana A**: jalur cadangan spec §9 langkah 1 (komponen sendiri tanpa reanimated dengan API yang meniru BNA) membutuhkan rencana yang direvisi, bukan improvisasi pelaksana.

---

## Task 2: Token bentuk & huruf, suntingan salinan BNA, Reduce Motion

**Files:**
- Create (oleh CLI): `apps/mobile/components/ui/{card,skeleton,separator,view}.tsx`
- Rewrite: `apps/mobile/theme/globals.ts`, `apps/mobile/components/ui/text.tsx`, `apps/mobile/components/ui/skeleton.tsx`
- Create: `apps/mobile/theme/huruf.ts`, `apps/mobile/hooks/useGerakDikurangi.ts`, `apps/mobile/test/support/berkas.ts`, `apps/mobile/test/huruf.test.ts`, `apps/mobile/test/aksesibilitas.test.ts`
- Modify: `apps/mobile/components/ui/button.tsx`, `apps/mobile/components/ui/input.tsx`, `apps/mobile/components/ui/toast.tsx`, `apps/mobile/components/ui/card.tsx`, `apps/mobile/test/tema.test.ts`

**Interfaces:**
- Consumes: `Colors`, `ColorKeys`, `useColor` (Task 1).
- Produces:
  - `theme/globals.ts`: `HEIGHT = 48`, `FONT_SIZE = 15`, `BORDER_RADIUS = 8`, `CORNERS = 8`, `SPACING` (BNA), `jarak = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }`, `FONT = { regular: "Inter_400Regular", semibold: "Inter_600SemiBold", bold: "Inter_700Bold", mono: "JetBrainsMono_400Regular" }`, `type VarianHuruf = "heading" | "title" | "body" | "caption" | "label" | "mono"`, `HURUF: Record<VarianHuruf, { fontSize; lineHeight; fontFamily; redup }>`, `RADIUS = { kartu: 8, salaman: 14, gelembung: 12, gelembungSudut: 4, lencana: 5, sheet: 12, batang: 3 }`, `UKURAN = { sentuh: 48, tombolSalaman: 52, naikSalaman: 26, cincinSalaman: 5, avatarKartu: 42, avatarSheet: 56, avatarKepala: 64, batangTrust: 6, batangTrustKecil: 5, celahRuas: 2, tinggiIsiTabBar: 56, tinggiKerangka: 72 }`, `MAKS_SKALA_HURUF_KECIL = 1.3`
  - `theme/huruf.ts`: `keluargaUntuk(dasar: string, berat: string | number | undefined): string`
  - `components/ui/text.tsx`: `Text` dengan prop `variant?: TextVariant` (`"heading" | "title" | "subtitle" | "body" | "caption" | "label" | "mono" | "link"`), `export type TextVariant`
  - `components/ui/skeleton.tsx`: `Skeleton({ width?: DimensionValue; height?: number; style?: ViewStyle })`
  - `components/ui/card.tsx`, `separator.tsx`, `view.tsx` (BNA): `Card`, `Separator`, `View`
  - `hooks/useGerakDikurangi.ts`: `useGerakDikurangi(): boolean`
  - `test/support/berkas.ts`: `MOBILE`, `semuaBerkas(folder, pola?)`, `baca(berkas)`, `tanpaKomentar(isi)`, `KOMPONEN_BELUM_DIMIGRASI`, `kodeTampilanBaru()`, `berkasTanpaWarna()`

- [ ] **Step 1: Salin komponen BNA tambahan dan lindungi berkas yang sudah disunting**

```bash
cd apps/mobile && pnpm dlx bna-ui@3.0.0 add card skeleton separator --pnpm -y && cd ../..
git status --short
git diff --name-only
```

CLI dengan `-y` bisa menimpa berkas yang sudah ada. Kembalikan SETIAP berkas terlacak yang diubah CLI (kecuali `apps/mobile/package.json` dan `pnpm-lock.yaml`) dengan `git checkout -- <berkas>`, satu per satu — terutama `apps/mobile/theme/colors.ts`, `apps/mobile/hooks/useColorScheme.ts`, `apps/mobile/tsconfig.json`, dan `apps/mobile/components/ui/*.tsx` dari Task 1. Bila CLI membuat ulang `apps/mobile/providers/mode-provider.tsx` atau `apps/mobile/hooks/useColorScheme.web.ts`, hapus lagi dengan `rm -f` (Task 1 Step 6).

Expected sesudahnya: `git status --short` hanya menunjukkan berkas baru `apps/mobile/components/ui/card.tsx`, `skeleton.tsx`, `separator.tsx`, `view.tsx` (dan `package.json`/`pnpm-lock.yaml` HANYA bila CLI menambah paket — laporkan barisnya).

- [ ] **Step 2: Tulis tes yang gagal**

`apps/mobile/test/support/berkas.ts`:

```ts
// Helper bersama tes baca-kode. BUKAN berkas tes (hanya "test/**/*.test.ts"
// yang dikumpulkan vitest).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const MOBILE = join(__dirname, "..", "..");

/** Semua berkas di bawah `folder` (relatif akar apps/mobile), dengan garis miring "/". */
export function semuaBerkas(folder: string, pola: RegExp = /\.(ts|tsx)$/): string[] {
  const akar = join(MOBILE, folder);
  if (!existsSync(akar)) return [];
  const jalan = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const jalur = join(dir, e.name);
      if (e.isDirectory()) return jalan(jalur);
      return pola.test(e.name) ? [relative(MOBILE, jalur).split(sep).join("/")] : [];
    });
  return jalan(akar);
}

export const baca = (berkas: string): string => readFileSync(join(MOBILE, berkas), "utf8");

/** Buang komentar, supaya catatan seperti "keputusan #16B" tidak terbaca sebagai warna. */
export function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/**
 * Komponen yang dipindah apa adanya dari app/ dan belum dimigrasi ke tampilan
 * baru (Ruling A4). Rencana B mengosongkan himpunan ini.
 */
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([]);

/**
 * Kode bertampilan baru selain salinan BNA: wajib token, skala jarak, dan
 * komponen teks BNA (spec desain UI §3.7, §10.1).
 */
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter(
      (b) => !b.startsWith("components/ui/") && !KOMPONEN_BELUM_DIMIGRASI.has(b),
    ),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
  ];
}

/** Berkas yang dilarang memuat literal warna (spec §10.1). */
export function berkasTanpaWarna(): string[] {
  return [
    ...semuaBerkas("components").filter((b) => !KOMPONEN_BELUM_DIMIGRASI.has(b)),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme").filter((b) => b !== "theme/colors.ts"),
    // src/warna.ts dihapus Rencana B bersama <TextInput> lama terakhir (Ruling A3).
    ...semuaBerkas("src").filter((b) => b !== "src/warna.ts"),
  ];
}
```

`apps/mobile/test/huruf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FONT, HURUF, jarak } from "../theme/globals";
import { keluargaUntuk } from "../theme/huruf";

describe("skala huruf (spec desain UI §3.3, §3.7)", () => {
  it("ukuran dan keluarga per varian persis spec", () => {
    expect(Object.fromEntries(Object.entries(HURUF).map(([v, h]) => [v, [h.fontSize, h.fontFamily, h.redup]])))
      .toEqual({
        heading: [30, FONT.bold, false],
        title: [18, FONT.semibold, false],
        body: [15, FONT.regular, false],
        caption: [13, FONT.regular, true],
        label: [11, FONT.semibold, false],
        mono: [13, FONT.mono, true],
      });
  });

  it("hanya heading yang memakai bobot 700", () => {
    const tebal = Object.entries(HURUF).filter(([, h]) => h.fontFamily === FONT.bold).map(([v]) => v);
    expect(tebal).toEqual(["heading"]);
  });

  it("tidak ada keluarga 500", () => {
    expect(Object.values(FONT).filter((f) => /500/.test(f))).toEqual([]);
  });

  it("jarak persis skala 4/8/12/16/24/32", () => {
    expect(jarak).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
  });
});

describe("keluargaUntuk — berat → berkas font", () => {
  it("tanpa berat memakai keluarga dasar varian", () => {
    expect(keluargaUntuk(FONT.regular, undefined)).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.bold, undefined)).toBe(FONT.bold);
  });

  it("600 dan 500 menjadi SemiBold (500 tidak dimuat)", () => {
    expect(keluargaUntuk(FONT.regular, "600")).toBe(FONT.semibold);
    expect(keluargaUntuk(FONT.regular, "500")).toBe(FONT.semibold);
    expect(keluargaUntuk(FONT.regular, 600)).toBe(FONT.semibold);
  });

  it("700 dan bold menjadi Bold; 400, normal, dan di bawahnya menjadi Regular", () => {
    expect(keluargaUntuk(FONT.regular, "700")).toBe(FONT.bold);
    expect(keluargaUntuk(FONT.regular, "bold")).toBe(FONT.bold);
    expect(keluargaUntuk(FONT.semibold, "400")).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.semibold, "normal")).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.semibold, "300")).toBe(FONT.regular);
  });

  it("mono selalu JetBrains Mono 400", () => {
    expect(keluargaUntuk(FONT.mono, "700")).toBe(FONT.mono);
  });

  it("berat yang tidak dikenal memakai keluarga dasar", () => {
    expect(keluargaUntuk(FONT.regular, "tebal")).toBe(FONT.regular);
  });
});
```

Tambahkan di AKHIR `apps/mobile/test/tema.test.ts`:

```ts

import { baca, berkasTanpaWarna, kodeTampilanBaru, tanpaKomentar } from "./support/berkas";

const POLA_WARNA = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

/** Nama yang diimpor dari "react-native" di satu berkas. */
function imporReactNative(isi: string): string[] {
  return [...isi.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']react-native["']/g)].flatMap((m) =>
    (m[1] ?? "").split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0] ?? "").filter(Boolean),
  );
}

describe("warna hanya dari theme/colors.ts (spec §10.1)", () => {
  it("ada berkas yang diperiksa", () => {
    expect(berkasTanpaWarna().length).toBeGreaterThan(0);
  });

  it("tidak ada literal warna di luar theme/colors.ts", () => {
    const salah = berkasTanpaWarna().filter((b) => POLA_WARNA.test(tanpaKomentar(baca(b))));
    expect(salah).toEqual([]);
  });
});

describe("teks dan isian lewat salinan BNA (spec §10.1)", () => {
  it("Text, TextInput, dan Button tidak diimpor dari react-native di kode bertampilan baru", () => {
    const salah = kodeTampilanBaru().filter((b) =>
      imporReactNative(baca(b)).some((n) => ["Text", "TextInput", "Button"].includes(n)));
    expect(salah).toEqual([]);
  });

  it("setiap <Input di kode bertampilan baru berasal dari @/components/ui/input", () => {
    const salah = kodeTampilanBaru().filter((b) => {
      const isi = baca(b);
      return /<Input\b/.test(isi) && !isi.includes('from "@/components/ui/input"');
    });
    expect(salah).toEqual([]);
  });
});
```

`apps/mobile/test/aksesibilitas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baca, kodeTampilanBaru, semuaBerkas, tanpaKomentar } from "./support/berkas";

const SKALA_JARAK = new Set([0, 4, 8, 12, 16, 24, 32]);
const POLA_JARAK = /\b(margin\w*|padding\w*|gap|rowGap|columnGap)\s*:\s*(-?\d+(?:\.\d+)?)\b/g;

// Penjaga murah spec desain UI §3.7 dan §10.1. Target sentuh, pembungkusan
// teks, Reduce Motion, dan safe area diuji tangan di iPhone (§10.3).
describe("aksesibilitas — penjaga baca-kode", () => {
  it("allowFontScaling tidak pernah dimatikan di app/ dan components/", () => {
    const berkas = [...semuaBerkas("app"), ...semuaBerkas("components")];
    const salah = berkas.filter((b) => /allowFontScaling\s*(=\s*\{\s*false\s*\}|:\s*false)/.test(baca(b)));
    expect(salah).toEqual([]);
  });

  it("tidak ada bobot 500 (Inter atau JetBrains Mono Medium) di mana pun", () => {
    const berkas = ["app", "components", "hooks", "theme", "src"].flatMap((d) => semuaBerkas(d));
    const salah = berkas.filter((b) => /Inter_500Medium|JetBrainsMono_500Medium/.test(baca(b)));
    expect(salah).toEqual([]);
  });

  it("tidak ada fontSize literal di luar theme/ dan components/ui/", () => {
    const salah = kodeTampilanBaru()
      .filter((b) => !b.startsWith("theme/"))
      .filter((b) => /\bfontSize\s*:\s*\d/.test(tanpaKomentar(baca(b))));
    expect(salah).toEqual([]);
  });

  // Nilai mutlak: tumpang tindih avatar (-16) sah (Ruling A14).
  it("jarak literal hanya dari skala 4/8/12/16/24/32", () => {
    const salah = kodeTampilanBaru()
      .filter((b) => !b.startsWith("theme/"))
      .flatMap((b) => [...tanpaKomentar(baca(b)).matchAll(POLA_JARAK)]
        .filter((m) => !SKALA_JARAK.has(Math.abs(Number(m[2]))))
        .map((m) => `${b}: ${m[0]}`));
    expect(salah).toEqual([]);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/huruf.test.ts test/tema.test.ts test/aksesibilitas.test.ts`
Expected: FAIL — `huruf.test.ts` gagal (`FONT`/`HURUF`/`jarak` tidak diekspor, `../theme/huruf` tidak ada), dan `tema.test.ts` › "tidak ada literal warna di luar theme/colors.ts" merah untuk `components/ui/toast.tsx`.

- [ ] **Step 4: `theme/globals.ts`**

Ganti SELURUH isi `apps/mobile/theme/globals.ts` dengan:

```ts
/**
 * Token bentuk, jarak, dan huruf (spec desain UI §3.3, §3.4, §3.7).
 *
 * HEIGHT, FONT_SIZE, BORDER_RADIUS, CORNERS, dan SPACING adalah nama yang
 * diimpor salinan BNA di components/ui — namanya dipertahankan, nilainya
 * mengikuti spec (radius 8, bukan pil).
 */
export const HEIGHT = 48;
export const FONT_SIZE = 15;
export const BORDER_RADIUS = 8;
export const CORNERS = 8;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Skala jarak Nearly: tepi layar 16, isi kartu 16, antarbutir 8–12, antarbagian 24–32. */
export const jarak = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Berkas font yang dimuat di app/_layout.tsx. Tidak ada 500 (keputusan #16E). */
export const FONT = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
} as const;

export type VarianHuruf = "heading" | "title" | "body" | "caption" | "label" | "mono";

export type GayaHuruf = { fontSize: number; lineHeight: number; fontFamily: string; redup: boolean };

/** 30 / 18 / 15 / 13 / 11; mono 13. Paling banyak 4 ukuran per layar. */
export const HURUF: Record<VarianHuruf, GayaHuruf> = {
  heading: { fontSize: 30, lineHeight: 36, fontFamily: FONT.bold, redup: false },
  title: { fontSize: 18, lineHeight: 24, fontFamily: FONT.semibold, redup: false },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONT.regular, redup: false },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONT.regular, redup: true },
  label: { fontSize: 11, lineHeight: 14, fontFamily: FONT.semibold, redup: false },
  mono: { fontSize: 13, lineHeight: 18, fontFamily: FONT.mono, redup: true },
};

export const RADIUS = {
  kartu: 8,
  salaman: 14,
  gelembung: 12,
  gelembungSudut: 4,
  lencana: 5,
  sheet: 12,
  batang: 3,
} as const;

/** Ukuran komponen — bukan jarak, tidak terikat skala jarak (spec §3.7). */
export const UKURAN = {
  sentuh: 48,
  tombolSalaman: 52,
  naikSalaman: 26,
  cincinSalaman: 5,
  avatarKartu: 42,
  avatarSheet: 56,
  avatarKepala: 64,
  batangTrust: 6,
  batangTrustKecil: 5,
  celahRuas: 2,
  tinggiIsiTabBar: 56,
  tinggiKerangka: 72,
} as const;

/** Batas pembesaran label tab bar dan lencana (spec §3.7). */
export const MAKS_SKALA_HURUF_KECIL = 1.3;
```

- [ ] **Step 5: `theme/huruf.ts`**

```ts
import { FONT } from "./globals";

/**
 * React Native tidak memilih berkas font dari `fontWeight` untuk font kustom
 * (spec desain UI §3.3). Berat diterjemahkan ke keluarga Inter yang dimuat;
 * 500 tidak dimuat (#16E) dan jatuh ke 600 (Ruling A13). Mono selalu
 * JetBrains Mono 400. Berat yang tidak dikenal memakai keluarga dasar.
 */
export function keluargaUntuk(dasar: string, berat: string | number | undefined): string {
  if (dasar === FONT.mono || berat === undefined) return dasar;
  const n = berat === "bold" ? 700 : berat === "normal" ? 400 : Number(berat);
  if (!Number.isFinite(n)) return dasar;
  if (n >= 700) return FONT.bold;
  if (n >= 500) return FONT.semibold;
  return FONT.regular;
}
```

- [ ] **Step 6: Tulis ulang `components/ui/text.tsx`**

Ganti SELURUH isi `apps/mobile/components/ui/text.tsx` dengan:

```tsx
import { useColor } from '@/hooks/useColor';
import { HURUF, type VarianHuruf } from '@/theme/globals';
import { keluargaUntuk } from '@/theme/huruf';
import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from 'react-native';

/**
 * Salinan BNA yang disunting (spec desain UI §3.3, Ruling A8): varian
 * memetakan ke ukuran dan KELUARGA font dari theme/globals.ts. `fontWeight`
 * dari `style` diterjemahkan ke `fontFamily` lalu TIDAK diteruskan — di
 * Android keduanya bisa bertabrakan. `subtitle` dan `link` dipertahankan
 * karena dipakai salinan BNA lain (toast, card).
 */
export type TextVariant = VarianHuruf | 'subtitle' | 'link';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  lightColor?: string;
  darkColor?: string;
  children?: React.ReactNode;
}

const VARIAN_JUDUL: TextVariant[] = ['heading', 'title', 'subtitle'];

function dasarVarian(variant: TextVariant): VarianHuruf {
  if (variant === 'subtitle') return 'title';
  if (variant === 'link') return 'body';
  return variant;
}

export const Text = React.memo(
  forwardRef<RNText, TextProps>(
    ({ variant = 'body', lightColor, darkColor, style, children, ...props }, ref) => {
      const warnaTeks = useColor('text', { light: lightColor, dark: darkColor });
      const warnaRedup = useColor('textMuted');
      const warnaTautan = useColor('primary');
      const dasar = HURUF[dasarVarian(variant)];

      const rata: TextStyle = StyleSheet.flatten(style) ?? {};
      const { fontWeight, fontFamily, ...sisa } = rata;

      const gaya: TextStyle = {
        fontSize: dasar.fontSize,
        // lineHeight varian hanya berlaku bila pemanggil tidak mengganti
        // fontSize — lineHeight kecil di huruf besar memotong teks.
        ...(sisa.fontSize === undefined ? { lineHeight: dasar.lineHeight } : {}),
        color: variant === 'link' ? warnaTautan : dasar.redup ? warnaRedup : warnaTeks,
        ...(variant === 'link' ? { textDecorationLine: 'underline' as const } : {}),
        ...sisa,
        fontFamily: fontFamily ?? keluargaUntuk(dasar.fontFamily, fontWeight),
      };

      return (
        <RNText
          ref={ref}
          style={gaya}
          accessibilityRole={VARIAN_JUDUL.includes(variant) ? 'header' : undefined}
          {...props}
        >
          {children}
        </RNText>
      );
    }
  )
);

Text.displayName = 'Text';
```

- [ ] **Step 7: Hook Reduce Motion**

`apps/mobile/hooks/useGerakDikurangi.ts`:

```ts
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Reduce Motion OS (spec desain UI §3.7). `false` sampai OS menjawab, lalu
 * mengikuti perubahan lewat `reduceMotionChanged`. Dipakai salinan BNA
 * `skeleton` dan `toast`, dan (Rencana B) sheet salaman.
 */
export function useGerakDikurangi(): boolean {
  const [dikurangi, setDikurangi] = useState(false);

  useEffect(() => {
    let aktif = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((nilai) => { if (aktif) setDikurangi(nilai); })
      .catch(() => {});
    const langganan = AccessibilityInfo.addEventListener("reduceMotionChanged", setDikurangi);
    return () => {
      aktif = false;
      langganan.remove();
    };
  }, []);

  return dikurangi;
}
```

- [ ] **Step 8: Tulis ulang `components/ui/skeleton.tsx`**

Ganti SELURUH isi `apps/mobile/components/ui/skeleton.tsx` dengan:

```tsx
import { useColor } from '@/hooks/useColor';
import { useGerakDikurangi } from '@/hooks/useGerakDikurangi';
import { BORDER_RADIUS } from '@/theme/globals';
import React, { useEffect } from 'react';
import { DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
}

/**
 * Salinan BNA yang disunting (spec desain UI §3.7, §7.2): radius 8, dan
 * menjadi blok DIAM tanpa kilau saat Reduce Motion menyala.
 */
export const Skeleton = React.memo(function Skeleton({
  width = '100%',
  height = 16,
  style,
}: SkeletonProps) {
  const warna = useColor('muted');
  const gerakDikurangi = useGerakDikurangi();
  const opacity = useSharedValue(0.7);

  const gayaAnimasi = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (gerakDikurangi) {
      cancelAnimation(opacity);
      opacity.value = 0.7;
      return;
    }
    opacity.value = 0.5;
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [gerakDikurangi, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
      style={[
        { width, height, backgroundColor: warna, borderRadius: BORDER_RADIUS },
        gayaAnimasi,
        style,
      ]}
    />
  );
});
```

- [ ] **Step 9: Sunting `components/ui/button.tsx`**

Lakukan penggantian berikut di `apps/mobile/components/ui/button.tsx` (setiap teks lama harus ditemukan persis sekali; kalau tidak, berhenti dan laporkan):

(a) Haptic bawaan hanya untuk varian utama (spec §3.4). Ganti

```tsx
      animation = true,
      haptic = true,
```

dengan

```tsx
      animation = true,
      haptic,
```

dan ganti

```tsx
    const feedback = useHaptics(haptic);
```

dengan

```tsx
    // Getar ringan bawaan hanya untuk varian utama (spec desain UI §3.4).
    const feedback = useHaptics(haptic ?? variant === 'default');
```

(b) Tombol destruktif = latar dan garis transparansi `destructive` (spec §3.4). Ganti

```tsx
    const destructiveColor = useColor('red');
```

dengan

```tsx
    const destruktifLatar = useColor('destruktifLatar');
    const destruktifGaris = useColor('destruktifGaris');
```

dan ganti

```tsx
        case 'destructive':
          return { ...baseStyle, backgroundColor: destructiveColor };
```

dengan

```tsx
        case 'destructive':
          return {
            ...baseStyle,
            backgroundColor: destruktifLatar,
            borderWidth: 1,
            borderColor: destruktifGaris,
          };
```

(c) Target sentuh 48 untuk ukuran `sm` (spec §3.7). Ganti

```tsx
          Object.assign(baseStyle, { height: 44, paddingHorizontal: 24 });
```

dengan

```tsx
          Object.assign(baseStyle, { height: HEIGHT, paddingHorizontal: 16 });
```

dan ganti

```tsx
              maxHeight: size === 'sm' ? 44 : size === 'lg' ? 54 : HEIGHT,
```

dengan

```tsx
              maxHeight: size === 'lg' ? 54 : HEIGHT,
```

(d) Tanpa bobot 500. Ganti

```tsx
        fontSize: FONT_SIZE,
        fontWeight: '500',
```

dengan

```tsx
        fontSize: FONT_SIZE,
        fontWeight: '600',
```

- [ ] **Step 10: Sunting `components/ui/input.tsx`**

(a) Ganti

```tsx
      variant = 'filled',
```

dengan

```tsx
      variant = 'outline',
```

(b) Ganti

```tsx
    const primary = useColor('primary');
    const danger = useColor('red');

    const isTextarea = type === 'textarea';

    // Calculate height based on type
```

dengan

```tsx
    const primary = useColor('primary');
    const danger = useColor('red');
    // Isian B2: latar `input`, placeholder `placeholder` (spec desain UI §3.4).
    const latarIsian = useColor('input');
    const warnaPlaceholder = useColor('placeholder');

    const isTextarea = type === 'textarea';

    // Calculate height based on type
```

(c) Ganti

```tsx
            borderColor: error ? danger : isFocused ? primary : borderColor,
            backgroundColor: 'transparent',
```

dengan

```tsx
            borderColor: error ? danger : isFocused ? primary : borderColor,
            backgroundColor: latarIsian,
```

(d) Ganti

```tsx
      fontSize: FONT_SIZE,
      lineHeight: isTextarea ? 20 : undefined,
```

dengan

```tsx
      fontSize: FONT_SIZE,
      fontFamily: FONT.regular,
      lineHeight: isTextarea ? 20 : undefined,
```

dan ganti baris impor

```tsx
import { BORDER_RADIUS, CORNERS, FONT_SIZE, HEIGHT } from '@/theme/globals';
```

dengan

```tsx
import { BORDER_RADIUS, CORNERS, FONT, FONT_SIZE, HEIGHT } from '@/theme/globals';
```

(e) Ganti

```tsx
                placeholderTextColor={error ? danger + '99' : muted}
                placeholder={placeholder || 'Type your message...'}
                onFocus={handleFocus}
```

dengan

```tsx
                placeholderTextColor={error ? danger : warnaPlaceholder}
                placeholder={placeholder || 'Type your message...'}
                onFocus={handleFocus}
```

dan ganti

```tsx
                  placeholderTextColor={error ? danger + 99 : muted}
```

dengan

```tsx
                  placeholderTextColor={error ? danger : warnaPlaceholder}
```

`GroupedInput`/`GroupedInputItem` di berkas yang sama TIDAK disunting (Ruling A8).

- [ ] **Step 11: Sunting `components/ui/toast.tsx`**

(a) Ganti

```tsx
import {
  AccessibilityInfo,
  Dimensions,
```

dengan

```tsx
import { useColor } from '@/hooks/useColor';
import { useGerakDikurangi } from '@/hooks/useGerakDikurangi';
import {
  Dimensions,
```

(b) Ganti

```tsx
  const [isExpanded, setIsExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);
```

dengan

```tsx
  const [isExpanded, setIsExpanded] = useState(false);
  // Reduce Motion lewat hook bersama (spec desain UI §3.7).
  const reduceMotion = useGerakDikurangi();
  const warnaBerhasil = useColor('verified');
  const warnaGalat = useColor('destructive');
  const warnaPeringatan = useColor('primary');
  const warnaTeks = useColor('text');
  const warnaGaris = useColor('border');
  const warnaTeksAksi = useColor('primaryForeground');
```

(c) Ganti

```tsx
  // Dynamic Island colors (dark theme optimized)
  const backgroundColor = '#1C1C1E'; // iOS Dynamic Island background
  const mutedTextColor = '#8E8E93'; // iOS secondary text color
```

dengan

```tsx
  // Warna dari token B2 (spec desain UI §3.1), bukan warna iOS bawaan salinan.
  const backgroundColor = useColor('card');
  const mutedTextColor = useColor('textMuted');
```

(d) Ganti

```tsx
      case 'success':
        return '#30D158'; // iOS green
      case 'error':
        return '#FF453A'; // iOS red
      case 'warning':
        return '#FF9F0A'; // iOS orange
      case 'info':
        return '#007AFF'; // iOS blue
      default:
        return '#8E8E93'; // iOS gray
```

dengan

```tsx
      case 'success':
        return warnaBerhasil;
      case 'error':
        return warnaGalat;
      case 'warning':
        return warnaPeringatan;
      case 'info':
        return warnaTeks;
      default:
        return mutedTextColor;
```

(e) Toast berhasil bergaris `verified`, lainnya `border` (spec §7.2). Ganti

```tsx
    backgroundColor,
    justifyContent: 'center',
```

dengan

```tsx
    backgroundColor,
    borderWidth: 1,
    borderColor: variant === 'success' ? warnaBerhasil : warnaGaris,
    justifyContent: 'center',
```

(f) Tanpa bayangan (spec §3.4). Hapus lima baris ini (ganti dengan tidak ada apa-apa):

```tsx
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
```

(g) Ganti

```tsx
                      color: '#FFFFFF',
                      fontSize: 15,
```

dengan

```tsx
                      color: warnaTeks,
                      fontSize: 15,
```

dan ganti

```tsx
                      color: '#FFFFFF',
                      fontSize: 12,
```

dengan

```tsx
                      color: warnaTeksAksi,
                      fontSize: 12,
```

Periksa tidak ada sisa: `grep -nE "#[0-9a-fA-F]{3,8}|AccessibilityInfo|setReduceMotion" apps/mobile/components/ui/toast.tsx` → WAJIB kosong.

- [ ] **Step 12: Sunting `components/ui/card.tsx`**

Ganti

```tsx
  const foregroundColor = useColor('foreground');
```

dengan

```tsx
  const borderColor = useColor('border');
```

dan ganti

```tsx
          padding: 18,
          shadowColor: foregroundColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
```

dengan

```tsx
          // Kartu bergaris tanpa bayangan (spec desain UI §3.4).
          padding: 16,
          borderWidth: 1,
          borderColor,
```

Bila `foregroundColor` masih dipakai di tempat lain di `Card`, **berhenti dan laporkan**.

- [ ] **Step 13: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/huruf.test.ts test/tema.test.ts test/aksesibilitas.test.ts
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 14: Commit**

```bash
git add apps/mobile/components/ui/card.tsx apps/mobile/components/ui/skeleton.tsx apps/mobile/components/ui/separator.tsx \
  apps/mobile/components/ui/view.tsx apps/mobile/components/ui/text.tsx apps/mobile/components/ui/button.tsx \
  apps/mobile/components/ui/input.tsx apps/mobile/components/ui/toast.tsx \
  apps/mobile/theme/globals.ts apps/mobile/theme/huruf.ts apps/mobile/hooks/useGerakDikurangi.ts \
  apps/mobile/test/support/berkas.ts apps/mobile/test/huruf.test.ts apps/mobile/test/tema.test.ts \
  apps/mobile/test/aksesibilitas.test.ts
git status --short   # WAJIB kosong (tambahkan package.json/pnpm-lock.yaml hanya bila Step 1 melaporkannya)
git commit -m "feat(mobile): token huruf/jarak/radius, suntingan salinan BNA, Reduce Motion

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 15: Mutasi — penjaga warna**

Di `apps/mobile/components/ui/card.tsx`, ganti `          borderColor,` dengan `          borderColor: '#123456',`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/tema.test.ts`
Expected: FAIL — `warna hanya dari theme/colors.ts (spec §10.1) > tidak ada literal warna di luar theme/colors.ts`. Rekam, lalu:

```bash
git checkout -- apps/mobile/components/ui/card.tsx
pnpm --filter @nearly/mobile exec vitest run test/tema.test.ts   # PASS
git status --short                                                # kosong
```

- [ ] **Step 16: Mutasi — pemetaan 500**

Di `apps/mobile/theme/huruf.ts`, ganti `  if (n >= 500) return FONT.semibold;` dengan `  if (n >= 600) return FONT.semibold;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/huruf.test.ts`
Expected: FAIL — `keluargaUntuk — berat → berkas font > 600 dan 500 menjadi SemiBold (500 tidak dimuat)`. Rekam, lalu `git checkout -- apps/mobile/theme/huruf.ts`, jalankan ulang (PASS), `git status --short` kosong.

---
## Task 3: Ikon, splash PNG, dan logo "n"

**Files:**
- Create: `apps/mobile/assets/sumber/n.svg`, `apps/mobile/scripts/buat-ikon.mjs`, `apps/mobile/assets/icon.png`, `apps/mobile/assets/adaptive-icon.png`, `apps/mobile/assets/splash-icon.png` (keluaran skrip), `apps/mobile/components/logo-n.tsx`, `apps/mobile/test/ikon.test.ts`
- Modify: `apps/mobile/package.json` (devDependency + skrip), `pnpm-lock.yaml`, `apps/mobile/app.json`

**Interfaces:**
- Consumes: `baca`, `MOBILE` (`test/support/berkas.ts`, Task 2); `useColor` (Task 1).
- Produces:
  - `components/logo-n.tsx`: `PATH_N: string`, `LogoN({ ukuran: number; warna?: "primary" | "text" })`
  - Skrip `pnpm --filter @nearly/mobile run ikon`
  - `app.json`: `expo.icon`, `expo.android.adaptiveIcon`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/ikon.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baca, MOBILE } from "./support/berkas";

const PATH_N_SPEC =
  "M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z";

/** Lebar dan tinggi dari kepala PNG (IHDR). */
function ukuranPng(berkas: string): [number, number] {
  const b = readFileSync(join(MOBILE, berkas));
  expect(b.subarray(1, 4).toString("ascii"), berkas).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("ikon dan splash (spec desain UI §3.5, R11)", () => {
  it("ketiga PNG berukuran 1024×1024", () => {
    for (const b of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash-icon.png"]) {
      expect(ukuranPng(b), b).toEqual([1024, 1024]);
    }
  });

  it("SVG sumber memuat path spec, dan LogoN memakai path yang sama persis", () => {
    const d = baca("assets/sumber/n.svg").match(/\sd="([^"]+)"/)?.[1];
    expect(d).toBe(PATH_N_SPEC);
    expect(baca("components/logo-n.tsx")).toContain(`"${PATH_N_SPEC}"`);
  });

  it("app.json menunjuk ikon dan ikon adaptif", () => {
    const expo = JSON.parse(baca("app.json")).expo;
    expect(expo.icon).toBe("./assets/icon.png");
    expect(expo.android.adaptiveIcon).toEqual({
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#f3ba2f",
    });
  });

  it("@resvg/resvg-js dipatok persis dan skrip ikon terdaftar", () => {
    const pkg = JSON.parse(baca("package.json"));
    expect(pkg.devDependencies["@resvg/resvg-js"]).toBe("2.6.2");
    expect(pkg.scripts.ikon).toBe("node scripts/buat-ikon.mjs");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/ikon.test.ts`
Expected: FAIL — `ENOENT … assets/icon.png`, `… assets/sumber/n.svg`, dan `expo.icon` undefined.

- [ ] **Step 3: Pasang `@resvg/resvg-js` dan daftarkan skrip**

```bash
pnpm --filter @nearly/mobile add -D -E @resvg/resvg-js@2.6.2
```

Expected: `apps/mobile/package.json` mendapat `"@resvg/resvg-js": "2.6.2"` di `devDependencies`; `pnpm-lock.yaml` berubah. (Paket ini membawa biner prabangun per platform lewat `optionalDependencies`, tanpa skrip install.) Kalau pnpm menolak karena kebijakan build, **berhenti dan laporkan**.

Di `apps/mobile/package.json`, ganti

```json
    "typecheck": "tsc --noEmit"
```

dengan

```json
    "typecheck": "tsc --noEmit",
    "ikon": "node scripts/buat-ikon.mjs"
```

- [ ] **Step 4: SVG sumber dan skrip**

`apps/mobile/assets/sumber/n.svg` (satu baris):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z"/></svg>
```

`apps/mobile/scripts/buat-ikon.mjs`:

```js
// Membuat PNG ikon dan splash dari assets/sumber/n.svg (spec desain UI §3.5, R11).
// Jalankan dari akar repo: pnpm --filter @nearly/mobile run ikon
// Hasilnya di-commit; mesin pemilik tidak punya rsvg-convert/ImageMagick.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ASET = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
// Sama dengan theme/colors.ts (primary, background): skrip Node ini tidak bisa
// mengimpor TypeScript.
const KUNING = "#f3ba2f";
const GELAP = "#07090f";
const SISI = 1024;

const sumber = readFileSync(join(ASET, "sumber", "n.svg"), "utf8");
const path = sumber.match(/\sd="([^"]+)"/)?.[1];
if (!path) throw new Error('path "n" tidak ditemukan di assets/sumber/n.svg');

// "n" (kotak x 28–72, y 25–75 di viewBox 100) diskalakan di sekitar pusat (50, 50).
function svg({ latar, warna, skala }) {
  const geser = 50 - 50 * skala;
  const kotak = latar ? `<rect width="100" height="100" fill="${latar}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SISI}" height="${SISI}" viewBox="0 0 100 100">${kotak}<path transform="translate(${geser} ${geser}) scale(${skala})" d="${path}" fill="${warna}"/></svg>`;
}

function tulis(nama, isi) {
  const png = new Resvg(isi, { fitTo: { mode: "width", value: SISI } }).render().asPng();
  writeFileSync(join(ASET, nama), png);
  console.log(`${nama}: ${png.length} bait`);
}

// icon.png: latar kuning penuh (iOS memotong sudut sendiri), "n" gelap
// selebar ±57% kanvas — lebar path 44, jadi skala 57/44.
tulis("icon.png", svg({ latar: KUNING, warna: GELAP, skala: 57 / 44 }));
// adaptive-icon.png: transparan, "n" gelap di dalam zona aman tengah 66%
// (setengah diagonal kotak 33,3 × 0,9 = 30 ≤ 33).
tulis("adaptive-icon.png", svg({ latar: null, warna: GELAP, skala: 0.9 }));
// splash-icon.png: transparan, "n" kuning (imageWidth 120 di app.json).
tulis("splash-icon.png", svg({ latar: null, warna: KUNING, skala: 1 }));
```

- [ ] **Step 5: Jalankan skrip dan periksa hasilnya**

```bash
pnpm --filter @nearly/mobile run ikon
```

Expected: tiga baris `icon.png: … bait`, `adaptive-icon.png: … bait`, `splash-icon.png: … bait`. Buka `apps/mobile/assets/icon.png` dengan alat Read (gambar) dan pastikan: kotak kuning penuh dengan huruf "n" gelap di tengah. Buka `apps/mobile/assets/splash-icon.png`: "n" kuning di latar transparan. Laporkan apa yang terlihat.

- [ ] **Step 6: Komponen `LogoN`**

`apps/mobile/components/logo-n.tsx`:

```tsx
import Svg, { Path } from "react-native-svg";
import { useColor } from "@/hooks/useColor";

/** Path "n" — SAMA PERSIS dengan assets/sumber/n.svg (dijaga test/ikon.test.ts). */
export const PATH_N =
  "M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z";

/**
 * Logo "n" besar untuk layar Mulai (spec desain UI §3.5, §7.1) — digambar
 * dari path yang sama dengan ikon, bukan dari PNG.
 */
export function LogoN({ ukuran, warna = "primary" }: { ukuran: number; warna?: "primary" | "text" }) {
  const isi = useColor(warna);
  return (
    <Svg width={ukuran} height={ukuran} viewBox="0 0 100 100">
      <Path d={PATH_N} fill={isi} />
    </Svg>
  );
}
```

- [ ] **Step 7: `app.json` — ikon dan ikon adaptif**

Di `apps/mobile/app.json`, ganti

```json
    "userInterfaceStyle": "automatic",
```

dengan

```json
    "userInterfaceStyle": "automatic",
    "icon": "./assets/icon.png",
```

dan ganti

```json
      "permissions": [
        "CAMERA",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ]
    },
```

dengan

```json
      "permissions": [
        "CAMERA",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#f3ba2f"
      }
    },
```

(`userInterfaceStyle` menjadi `"dark"` di Task 4.)

- [ ] **Step 8: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/ikon.test.ts test/tema.test.ts test/aksesibilitas.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/assets/sumber/n.svg apps/mobile/assets/icon.png apps/mobile/assets/adaptive-icon.png \
  apps/mobile/assets/splash-icon.png apps/mobile/scripts/buat-ikon.mjs apps/mobile/components/logo-n.tsx \
  apps/mobile/app.json apps/mobile/package.json pnpm-lock.yaml apps/mobile/test/ikon.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): ikon, ikon adaptif, dan splash dari satu SVG sumber lewat resvg

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Mutasi — path logo menyimpang**

Di `apps/mobile/components/logo-n.tsx`, ganti `v30z";` dengan `v31z";`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/ikon.test.ts`
Expected: FAIL — `SVG sumber memuat path spec, dan LogoN memakai path yang sama persis`. Rekam, lalu `git checkout -- apps/mobile/components/logo-n.tsx`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 4: Font, splash, tema gelap, root layout, `app.json`

**Files:**
- Modify (oleh `expo install`): `apps/mobile/package.json`, `pnpm-lock.yaml`
- Rewrite: `apps/mobile/app.json`, `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/theme/navigasi.ts`, `apps/mobile/src/splash.ts`, `apps/mobile/src/teks-ui.ts`, `apps/mobile/test/app-json.test.ts`, `apps/mobile/test/splash.test.ts`
- Modify: `apps/mobile/src/judul-layar.ts`, `apps/mobile/test/gerbang-dompet.test.ts`, `apps/mobile/test/judul-layar.test.ts`, `apps/mobile/test/support/berkas.ts`, `apps/mobile/test/tema.test.ts`

**Interfaces:**
- Consumes: `Colors` (Task 1); `FONT`, `Text`, `Button`, `ToastProvider` (Task 1–2); `layarMenurutDompet(punyaDompet): [string, string][]`, `ruteDariNotifikasi`, `DompetProvider`, `useDompet`, `pesanGalatDompet` (sudah ada).
- Produces:
  - `src/judul-layar.ts`: `LAYAR_TERMIGRASI: ReadonlySet<string>` (kosong)
  - `theme/navigasi.ts`: `OPSI_STACK` (opsi `screenOptions` Stack), `opsiTampilan(kunci: string)` → `{ contentStyle? }` (diperluas Task 8)
  - `src/splash.ts`: `bolehSembunyikanSplash(fontSelesai: boolean, keadaanDompet: KeadaanDompet): boolean`
  - `src/teks-ui.ts`: `TEKS_COBA_LAGI = "Try again"` (diperluas Task 6)
  - `test/support/berkas.ts`: `layoutApp()`, `layarTermigrasi()`; `kodeTampilanBaru()` dan `berkasTanpaWarna()` kini mencakup keduanya
  - Root layout: `ToastProvider` › `DompetProvider` › `Navigasi`; font Inter 400/600/700 + JetBrains Mono 400; splash tertahan; `StatusBar style="light"`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/app-json.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baca } from "./support/berkas";

const expo = JSON.parse(baca("app.json")).expo;
const pkg = JSON.parse(baca("package.json"));

describe("app.json (spec desain UI §3.2, §3.5, §7.4, R12)", () => {
  it("tema dikunci gelap dengan latar akar background", () => {
    expect(expo.userInterfaceStyle).toBe("dark");
    expect(expo.backgroundColor).toBe("#07090f");
  });

  it("versi 0.2.0 dengan runtimeVersion appVersion", () => {
    expect(expo.version).toBe("0.2.0");
    expect(expo.runtimeVersion).toEqual({ policy: "appVersion" });
  });

  it("teks izin iOS persis spec §7.4", () => {
    expect(expo.ios.infoPlist).toEqual({
      NSCameraUsageDescription: "Nearly uses the camera only to scan the QR codes of people you meet.",
      NSLocationWhenInUseUsageDescription:
        "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event.",
    });
  });

  it("splash: n kuning di latar gelap, lebar 120, sama untuk dark", () => {
    const splash = (expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === "expo-splash-screen");
    expect((splash as [string, unknown] | undefined)?.[1]).toEqual({
      image: "./assets/splash-icon.png",
      imageWidth: 120,
      backgroundColor: "#07090f",
      dark: { image: "./assets/splash-icon.png", backgroundColor: "#07090f" },
    });
  });

  it("paket tema dan font terpasang sebagai dependensi langsung", () => {
    for (const p of [
      "expo-splash-screen", "expo-system-ui", "@expo-google-fonts/inter", "@expo-google-fonts/jetbrains-mono",
      "react-native-reanimated", "react-native-worklets", "expo-haptics", "lucide-react-native",
    ]) {
      expect(pkg.dependencies[p], p).toBeDefined();
    }
  });
});
```

`apps/mobile/test/splash.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bolehSembunyikanSplash } from "../src/splash";

// Spec desain UI §3.5: splash disembunyikan setelah font termuat (atau gagal
// dimuat) DAN keadaan dompet bukan "memuat".
describe("bolehSembunyikanSplash", () => {
  it("tetap tampil selama font belum selesai", () => {
    for (const k of ["memuat", "galat", "belum-ada", "siap"] as const) {
      expect(bolehSembunyikanSplash(false, k), k).toBe(false);
    }
  });

  it("tetap tampil selama dompet memuat", () => {
    expect(bolehSembunyikanSplash(true, "memuat")).toBe(false);
  });

  it("disembunyikan saat font selesai dan dompet sudah punya keadaan", () => {
    for (const k of ["galat", "belum-ada", "siap"] as const) {
      expect(bolehSembunyikanSplash(true, k), k).toBe(true);
    }
  });
});
```

Di `apps/mobile/test/gerbang-dompet.test.ts`, ganti

```ts
  it("_layout.tsx membungkus navigasi dengan DompetProvider", () => {
    expect(baca("app/_layout.tsx")).toMatch(/<DompetProvider>\s*<Navigasi \/>\s*<\/DompetProvider>/);
  });
```

dengan

```ts
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
```

dan ganti

```ts
  it("keadaan galat tidak pernah jatuh ke layar Mulai", () => {
    expect(baca("app/_layout.tsx")).toMatch(/keadaan === "galat"\) \{[\s\S]*?Coba lagi/);
  });
```

dengan

```ts
  it("keadaan galat tidak pernah jatuh ke layar Mulai", () => {
    expect(baca("app/_layout.tsx")).toMatch(/keadaan === "galat"\) \{[\s\S]*?\{TEKS_COBA_LAGI\}/);
  });
```

Di `apps/mobile/test/judul-layar.test.ts`, ganti

```ts
import { JUDUL_LAYAR, layarMenurutDompet } from "../src/judul-layar";
```

dengan

```ts
import { JUDUL_LAYAR, LAYAR_TERMIGRASI, layarMenurutDompet } from "../src/judul-layar";
```

lalu tambahkan sebelum `});` penutup `describe("judul layar", …)` (baris terakhir berkas):

```ts

  it("LAYAR_TERMIGRASI hanya berisi kunci JUDUL_LAYAR", () => {
    expect([...LAYAR_TERMIGRASI].filter((k) => !(k in JUDUL_LAYAR))).toEqual([]);
  });
```

Di `apps/mobile/test/support/berkas.ts`, ganti

```ts
import { join, relative, sep } from "node:path";
```

dengan

```ts
import { join, relative, sep } from "node:path";
import { LAYAR_TERMIGRASI } from "../../src/judul-layar";
```

ganti

```ts
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter(
      (b) => !b.startsWith("components/ui/") && !KOMPONEN_BELUM_DIMIGRASI.has(b),
    ),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
  ];
}
```

dengan

```ts
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter(
      (b) => !b.startsWith("components/ui/") && !KOMPONEN_BELUM_DIMIGRASI.has(b),
    ),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
    ...layoutApp(),
    ...layarTermigrasi(),
  ];
}

/** Semua _layout.tsx di app/ — ditulis dengan komponen BNA sejak Rencana A. */
export function layoutApp(): string[] {
  return semuaBerkas("app").filter((b) => b.endsWith("/_layout.tsx"));
}

/** Berkas layar yang sudah dimigrasi Rencana B (kunci LAYAR_TERMIGRASI → berkas). */
export function layarTermigrasi(): string[] {
  return [...LAYAR_TERMIGRASI].map((k) => `app/${k}.tsx`);
}
```

dan ganti

```ts
    ...semuaBerkas("src").filter((b) => b !== "src/warna.ts"),
  ];
}
```

dengan

```ts
    ...semuaBerkas("src").filter((b) => b !== "src/warna.ts"),
    ...layoutApp(),
    ...layarTermigrasi(),
  ];
}
```

Tambahkan di AKHIR `apps/mobile/test/tema.test.ts`:

```ts

import { OPSI_STACK, opsiTampilan } from "../theme/navigasi";

describe("tema gelap navigasi (spec §3.2)", () => {
  it("header Stack memakai token latar dan teks", () => {
    expect(OPSI_STACK.headerStyle.backgroundColor).toBe(Colors.dark.background);
    expect(OPSI_STACK.headerTintColor).toBe(Colors.dark.text);
  });

  // Ruling A2: layar yang belum dimigrasi tetap berlatar terang.
  it("latar isi gelap tidak diberikan ke layar yang belum dimigrasi", () => {
    expect(opsiTampilan("mulai")).toEqual({});
  });

  it("root layout tidak membaca skema warna OS; useColorScheme selalu gelap", () => {
    expect(baca("app/_layout.tsx")).not.toMatch(/useColorScheme/);
    expect(baca("hooks/useColorScheme.ts")).toMatch(/return "dark";/);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/app-json.test.ts test/splash.test.ts test/gerbang-dompet.test.ts test/judul-layar.test.ts test/tema.test.ts`
Expected: FAIL — `app-json` (`userInterfaceStyle` masih `automatic`, versi `0.1.0`, teks izin Indonesia), `../src/splash` dan `../theme/navigasi` tidak ada, `LAYAR_TERMIGRASI` tidak diekspor, gerbang (`ToastProvider`, splash).

- [ ] **Step 3: Pasang paket font, splash, dan system UI**

```bash
cd apps/mobile && npx expo install expo-splash-screen expo-system-ui @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono && cd ../..
git diff -- apps/mobile/package.json | grep '^[-+] '
git diff -- apps/mobile/app.json
ls apps/mobile/node_modules/expo-system-ui/app.plugin.js
grep -rn "export declare function preventAutoHideAsync\|export declare function hideAsync" apps/mobile/node_modules/expo-splash-screen/build/
```

Expected: `package.json` mendapat tepat empat baris `+` (`expo-splash-screen` ~57.x, `expo-system-ui` ~57.x, `@expo-google-fonts/inter` ^0.4.x, `@expo-google-fonts/jetbrains-mono` ^0.4.x); `app.json` mungkin mendapat entri plugin; `app.plugin.js` ada; kedua deklarasi fungsi splash ada. Bila salah satu tidak ada, **berhenti dan laporkan** (kode Step 7 bergantung padanya).

- [ ] **Step 4: Tulis ulang `app.json`**

Ganti SELURUH isi `apps/mobile/app.json` dengan (bila Step 3 atau Task 1 menambahkan entri plugin lain yang tidak ada di daftar ini, pertahankan entri itu di akhir `plugins` dan laporkan):

```json
{
  "expo": {
    "name": "Nearly",
    "slug": "nearly",
    "scheme": "nearly",
    "version": "0.2.0",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#07090f",
    "icon": "./assets/icon.png",
    "ios": {
      "bundleIdentifier": "app.nearly.mobile",
      "supportsTablet": false,
      "infoPlist": {
        "NSCameraUsageDescription": "Nearly uses the camera only to scan the QR codes of people you meet.",
        "NSLocationWhenInUseUsageDescription": "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event."
      }
    },
    "android": {
      "package": "app.nearly.mobile",
      "permissions": [
        "CAMERA",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#f3ba2f"
      }
    },
    "plugins": [
      "expo-router",
      "expo-camera",
      "expo-location",
      "expo-asset",
      "expo-font",
      "expo-image-picker",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash-icon.png",
          "imageWidth": 120,
          "backgroundColor": "#07090f",
          "dark": {
            "image": "./assets/splash-icon.png",
            "backgroundColor": "#07090f"
          }
        }
      ],
      "expo-system-ui"
    ],
    "extra": {
      "eas": {
        "projectId": "7289a831-fc9c-45c5-82bd-6d2b49c1b611"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/7289a831-fc9c-45c5-82bd-6d2b49c1b611"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

- [ ] **Step 5: Fungsi dan konstanta murni**

`apps/mobile/src/splash.ts`:

```ts
import type { KeadaanDompet } from "./dompet/konteks-dompet";

/**
 * Spec desain UI §3.5: splash disembunyikan setelah font selesai — termuat
 * ATAU gagal dimuat (font yang gagal jatuh ke font sistem, §11 batas #2) —
 * DAN keadaan dompet bukan "memuat". Spinner "memuat" gerbang dompet
 * digantikan splash.
 */
export function bolehSembunyikanSplash(fontSelesai: boolean, keadaanDompet: KeadaanDompet): boolean {
  return fontSelesai && keadaanDompet !== "memuat";
}
```

`apps/mobile/src/teks-ui.ts`:

```ts
/**
 * Teks antarmuka BARU yang dipakai bersama (spec desain UI §7.3), berbahasa
 * Inggris (§7.4). Kalimat lama tetap di modul asalnya dan diterjemahkan oleh
 * Rencana B.
 */

/** Tombol keadaan galat (§7.2, §7.3). */
export const TEKS_COBA_LAGI = "Try again";
```

Di `apps/mobile/src/judul-layar.ts`, tambahkan di AKHIR berkas:

```ts

/**
 * Kunci JUDUL_LAYAR yang layarnya sudah dimigrasi ke tampilan baru (Rencana B).
 * Hanya layar ini yang mendapat latar isi gelap dari Stack (Ruling A2), dan
 * hanya layar ini yang dijaga penjaga tampilan baru (test/support/berkas.ts).
 * Rencana A: kosong.
 */
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([]);
```

`apps/mobile/theme/navigasi.ts`:

```ts
import { Colors } from "./colors";
import { FONT } from "./globals";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";

const warna = Colors.dark;

/**
 * `screenOptions` setiap Stack (spec desain UI §3.2): header dan judul dari
 * token. Garis bawah header memakai garis sistem native-stack — native-stack
 * tidak menerima warna garis.
 */
export const OPSI_STACK = {
  headerStyle: { backgroundColor: warna.background },
  headerTintColor: warna.text,
  headerTitleStyle: { fontFamily: FONT.semibold },
  headerLargeStyle: { backgroundColor: warna.background },
  headerLargeTitleStyle: { fontFamily: FONT.bold },
};

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR. Latar isi gelap hanya
 * untuk layar yang sudah dimigrasi (Ruling A2): layar lama memakai teks hitam
 * bawaan yang tidak terbaca di atas `background`.
 */
export function opsiTampilan(kunci: string): { contentStyle?: { backgroundColor: string } } {
  return LAYAR_TERMIGRASI.has(kunci) ? { contentStyle: { backgroundColor: warna.background } } : {};
}
```

- [ ] **Step 6: Periksa gerbang layout lama memakai `title`**

Run: `grep -n "layarMenurutDompet(true).map\|layarMenurutDompet(false).map" apps/mobile/app/_layout.tsx`
Expected: dua baris (bentuk `([name, title])`). Step 7 menulis ulang berkas ini.

- [ ] **Step 7: Tulis ulang `app/_layout.tsx`**

Ganti SELURUH isi `apps/mobile/app/_layout.tsx` dengan:

```tsx
import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ToastProvider } from "@/components/ui/toast";
import { useColor } from "@/hooks/useColor";
import { OPSI_STACK, opsiTampilan } from "@/theme/navigasi";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";
import { layarMenurutDompet } from "../src/judul-layar";
import { DompetProvider, useDompet } from "../src/dompet/konteks-dompet";
import { pesanGalatDompet } from "../src/dompet/teks-dompet";
import { bolehSembunyikanSplash } from "../src/splash";
import { TEKS_COBA_LAGI } from "../src/teks-ui";

// Splash tetap menutupi layar sampai font DAN dompet siap (spec desain UI
// §3.5). Tingkat modul: harus terpanggil sebelum layar pertama tergambar.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Notifikasi yang tiba saat aplikasi terbuka tetap ditampilkan sebagai banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  // ToastProvider di luar DompetProvider: toast dipakai layar di kedua sisi
  // gerbang, dan ia membawa GestureHandlerRootView untuk seluruh aplikasi.
  return (
    <ToastProvider>
      <DompetProvider>
        <Navigasi />
      </DompetProvider>
    </ToastProvider>
  );
}

/**
 * Gerbang dompet (spec dompet §5.1, spec desain UI §4.2). Tanpa dompet hanya
 * layar Mulai yang ada; dengan dompet, Mulai tidak bisa dibuka. Saat penjaga
 * berubah — dompet baru dibuat, atau dompet dihapus lewat Ganti dompet —
 * expo-router memindahkan tumpukan ke layar pertama yang diizinkan.
 */
function Navigasi() {
  const { keadaan, galat, muatUlang } = useDompet();
  const [fontTermuat, fontGagal] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });
  const latar = useColor("background");
  // Font yang gagal dimuat tidak memblokir aplikasi: teks jatuh ke font sistem.
  const fontSelesai = fontTermuat || fontGagal !== null;
  const splashBoleh = bolehSembunyikanSplash(fontSelesai, keadaan);

  useEffect(() => {
    if (splashBoleh) void SplashScreen.hideAsync().catch(() => {});
  }, [splashBoleh]);

  useEffect(() => {
    // Rute tujuan notifikasi hanya ada saat dompet siap.
    if (keadaan !== "siap") return;
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      if (rute) router.push(rute);
    });
    return () => langganan.remove();
  }, [keadaan]);

  // Selama "memuat" atau font belum selesai, splash masih menutupi layar.
  if (!splashBoleh) return null;

  if (keadaan === "galat") {
    // BUKAN layar Mulai: "Buat dompet baru" di sana akan menimpa dompet yang
    // mungkin hanya gagal terbaca sesaat.
    return (
      <SafeAreaView style={[s.tengah, { backgroundColor: latar }]}>
        <StatusBar style="light" />
        <Text variant="body" style={s.teksGalat}>{pesanGalatDompet(galat)}</Text>
        <Button onPress={muatUlang}>{TEKS_COBA_LAGI}</Button>
      </SafeAreaView>
    );
  }

  const punyaDompet = keadaan === "siap";

  // Judul semua layar dari JUDUL_LAYAR — alasannya di src/judul-layar.ts.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={OPSI_STACK}>
        <Stack.Protected guard={punyaDompet}>
          {layarMenurutDompet(true).map(([name, title]) => (
            <Stack.Screen key={name} name={name} options={{ title, ...opsiTampilan(name) }} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={!punyaDompet}>
          {layarMenurutDompet(false).map(([name, title]) => (
            <Stack.Screen key={name} name={name} options={{ title, ...opsiTampilan(name) }} />
          ))}
        </Stack.Protected>
      </Stack>
    </>
  );
}

const s = StyleSheet.create({
  tengah: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  teksGalat: { textAlign: "center" },
});
```

- [ ] **Step 8: Jalankan tes, typecheck, dan ekspor**

```bash
pnpm --filter @nearly/mobile exec vitest run
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: semua lulus; ekspor berakhir dengan `Exported: …` dan daftar aset memuat berkas `.ttf` Inter dan JetBrains Mono.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app.json apps/mobile/package.json pnpm-lock.yaml apps/mobile/app/_layout.tsx \
  apps/mobile/theme/navigasi.ts apps/mobile/src/splash.ts apps/mobile/src/teks-ui.ts apps/mobile/src/judul-layar.ts \
  apps/mobile/test/app-json.test.ts apps/mobile/test/splash.test.ts apps/mobile/test/gerbang-dompet.test.ts \
  apps/mobile/test/judul-layar.test.ts apps/mobile/test/support/berkas.ts apps/mobile/test/tema.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): tema gelap, font Inter + JetBrains Mono, splash, root layout dengan toast

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Mutasi — splash tanpa menunggu font**

Di `apps/mobile/app/_layout.tsx`, ganti `  const splashBoleh = bolehSembunyikanSplash(fontSelesai, keadaan);` dengan `  const splashBoleh = keadaan !== "memuat";`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/gerbang-dompet.test.ts`
Expected: FAIL — `gerbang dompet > splash disembunyikan hanya setelah font dan keadaan dompet siap`. Rekam, lalu `git checkout -- apps/mobile/app/_layout.tsx`, jalankan ulang (PASS), `git status --short` kosong.

---
## Task 5: Jamak, tanggal, jam, waktu relatif, sapaan

**Files:**
- Create: `apps/mobile/src/jamak.ts`, `apps/mobile/src/waktu.ts`, `apps/mobile/test/jamak.test.ts`, `apps/mobile/test/waktu.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `src/jamak.ts`: `pasanganJamak(n: number, tunggal: string, banyak: string): { angka: string; kata: string }`, `jamak(n: number, tunggal: string, banyak: string): string`
  - `src/waktu.ts`: `formatTanggal(t: Date, sekarang: Date): string`, `formatJam(t: Date): string`, `formatTanggalJam(t: Date, sekarang: Date): string`, `waktuRelatif(t: Date, sekarang: Date): string`, `sapaan(t: Date): "Good morning" | "Good afternoon" | "Good evening"`

Modul ini tidak boleh mengimpor `react`, `react-native`, `expo*`, atau memakai `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString`/`Intl`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/jamak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { jamak, pasanganJamak } from "../src/jamak";

// Spec desain UI §7.4: n === 1 → tunggal, selainnya jamak (termasuk 0).
describe("jamak", () => {
  it("0 dan 2 memakai bentuk jamak, 1 memakai bentuk tunggal", () => {
    expect(jamak(0, "connection", "connections")).toBe("0 connections");
    expect(jamak(1, "connection", "connections")).toBe("1 connection");
    expect(jamak(2, "connection", "connections")).toBe("2 connections");
  });
});

describe("pasanganJamak (spec §7.1)", () => {
  it("memisahkan angka dan kata supaya bisa diberi gaya berbeda", () => {
    expect(pasanganJamak(12, "connection", "connections")).toEqual({ angka: "12", kata: "connections" });
    expect(pasanganJamak(1, "connection", "connections")).toEqual({ angka: "1", kata: "connection" });
    expect(pasanganJamak(0, "connection", "connections")).toEqual({ angka: "0", kata: "connections" });
  });

  it("jamak adalah gabungan angka dan kata pasanganJamak", () => {
    for (const n of [0, 1, 2, 7]) {
      const p = pasanganJamak(n, "event", "events");
      expect(jamak(n, "event", "events")).toBe(`${p.angka} ${p.kata}`);
    }
  });
});
```

`apps/mobile/test/waktu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatJam, formatTanggal, formatTanggalJam, sapaan, waktuRelatif } from "../src/waktu";
import { baca, tanpaKomentar } from "./support/berkas";

/** Waktu LOKAL — sama dengan cara HP menampilkannya. */
const t = (tahun: number, bulan: number, hari: number, jam = 12, menit = 0) =>
  new Date(tahun, bulan - 1, hari, jam, menit);

describe("formatTanggal (spec desain UI §7.4)", () => {
  it("tahun berjalan: bulan tiga huruf + hari tanpa nol di depan", () => {
    expect(formatTanggal(t(2026, 8, 12), t(2026, 9, 18))).toBe("Aug 12");
    expect(formatTanggal(t(2026, 1, 5), t(2026, 9, 18))).toBe("Jan 5");
  });

  it("tahun lain ditambah tahun", () => {
    expect(formatTanggal(t(2025, 8, 12), t(2026, 9, 18))).toBe("Aug 12, 2025");
  });
});

describe("formatJam dan formatTanggalJam", () => {
  it("24 jam, dua digit", () => {
    expect(formatJam(t(2026, 8, 12, 19, 42))).toBe("19:42");
    expect(formatJam(t(2026, 8, 12, 8, 5))).toBe("08:05");
    expect(formatJam(t(2026, 8, 12, 0, 0))).toBe("00:00");
  });

  it("tanggal + jam acara", () => {
    expect(formatTanggalJam(t(2026, 8, 12, 19, 42), t(2026, 9, 18))).toBe("Aug 12, 19:42");
  });
});

describe("waktuRelatif — setiap batas spec §7.4", () => {
  const kini = t(2026, 9, 18, 15, 0);
  const mundur = (ms: number) => new Date(kini.getTime() - ms);
  const MENIT = 60_000;
  const JAM = 60 * MENIT;

  it("kurang dari 1 menit → just now (juga waktu di masa depan)", () => {
    expect(waktuRelatif(mundur(0), kini)).toBe("just now");
    expect(waktuRelatif(mundur(MENIT - 1), kini)).toBe("just now");
    expect(waktuRelatif(mundur(-5 * MENIT), kini)).toBe("just now");
  });

  it("kurang dari 60 menit → N minutes ago, tunggal untuk 1", () => {
    expect(waktuRelatif(mundur(MENIT), kini)).toBe("1 minute ago");
    expect(waktuRelatif(mundur(59 * MENIT), kini)).toBe("59 minutes ago");
  });

  it("kurang dari 24 jam → N hours ago, tunggal untuk 1", () => {
    expect(waktuRelatif(mundur(JAM), kini)).toBe("1 hour ago");
    expect(waktuRelatif(mundur(23 * JAM), kini)).toBe("23 hours ago");
  });

  it("hari kalender sebelumnya → yesterday", () => {
    expect(waktuRelatif(t(2026, 9, 17, 9, 0), kini)).toBe("yesterday");
  });

  it("sampai 6 hari → N days ago", () => {
    expect(waktuRelatif(t(2026, 9, 16, 15, 0), kini)).toBe("2 days ago");
    expect(waktuRelatif(t(2026, 9, 12, 15, 0), kini)).toBe("6 days ago");
  });

  it("selebihnya tanggal", () => {
    expect(waktuRelatif(t(2026, 9, 11, 15, 0), kini)).toBe("Sep 11");
    expect(waktuRelatif(t(2025, 9, 11, 15, 0), kini)).toBe("Sep 11, 2025");
  });
});

describe("sapaan Beranda — batas 04:00, 12:00, 18:00 (spec §6.1)", () => {
  it("pagi, siang, malam menurut jam lokal", () => {
    expect(sapaan(t(2026, 9, 18, 3, 59))).toBe("Good evening");
    expect(sapaan(t(2026, 9, 18, 4, 0))).toBe("Good morning");
    expect(sapaan(t(2026, 9, 18, 11, 59))).toBe("Good morning");
    expect(sapaan(t(2026, 9, 18, 12, 0))).toBe("Good afternoon");
    expect(sapaan(t(2026, 9, 18, 17, 59))).toBe("Good afternoon");
    expect(sapaan(t(2026, 9, 18, 18, 0))).toBe("Good evening");
  });
});

describe("waktu.ts murni", () => {
  it("tidak memakai Intl atau toLocale*", () => {
    expect(tanpaKomentar(baca("src/waktu.ts"))).not.toMatch(/toLocale|Intl\./);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/jamak.test.ts test/waktu.test.ts`
Expected: FAIL — `Failed to resolve import "../src/jamak"` dan `"../src/waktu"`.

- [ ] **Step 3: Implementasi**

`apps/mobile/src/jamak.ts`:

```ts
/**
 * Bentuk jamak bahasa Inggris (spec desain UI §7.4): n === 1 → tunggal,
 * selainnya jamak (termasuk 0). Tidak ada aturan jamak lain, tidak ada
 * Intl.PluralRules.
 */

/** Angka dan kata terpisah, untuk pasangan nilai/label yang diberi gaya berbeda (§7.1). */
export function pasanganJamak(n: number, tunggal: string, banyak: string): { angka: string; kata: string } {
  return { angka: String(n), kata: n === 1 ? tunggal : banyak };
}

/** "12 connections", "1 connection". */
export function jamak(n: number, tunggal: string, banyak: string): string {
  const p = pasanganJamak(n, tunggal, banyak);
  return `${p.angka} ${p.kata}`;
}
```

`apps/mobile/src/waktu.ts`:

```ts
import { jamak } from "./jamak";

/**
 * Tanggal dan jam berbahasa Inggris (spec desain UI §7.4). Fungsi murni TANPA
 * toLocaleString: hasil Intl di Hermes/Expo Go tidak dijamin sama antarperangkat,
 * dan tes harus deterministik. Semua memakai zona waktu lokal HP.
 */
const BULAN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MENIT_MS = 60_000;
const JAM_MS = 60 * MENIT_MS;
const HARI_MS = 24 * JAM_MS;

const duaDigit = (n: number) => String(n).padStart(2, "0");

/** "Aug 12"; bila bukan tahun berjalan: "Aug 12, 2025". */
export function formatTanggal(t: Date, sekarang: Date): string {
  const dasar = `${BULAN[t.getMonth()] ?? ""} ${t.getDate()}`;
  return t.getFullYear() === sekarang.getFullYear() ? dasar : `${dasar}, ${t.getFullYear()}`;
}

/** 24 jam, dua digit: "19:42", "08:05". */
export function formatJam(t: Date): string {
  return `${duaDigit(t.getHours())}:${duaDigit(t.getMinutes())}`;
}

/** Tanggal + jam acara: "Aug 12, 19:42" — pengganti toLocaleString("id-ID", …). */
export function formatTanggalJam(t: Date, sekarang: Date): string {
  return `${formatTanggal(t, sekarang)}, ${formatJam(t)}`;
}

function selisihHariKalender(t: Date, sekarang: Date): number {
  const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((awalHari(sekarang) - awalHari(t)) / HARI_MS);
}

/**
 * < 1 menit "just now"; < 60 menit "N minutes ago"; < 24 jam "N hours ago";
 * hari kalender sebelumnya "yesterday"; ≤ 6 hari "N days ago"; selebihnya tanggal.
 */
export function waktuRelatif(t: Date, sekarang: Date): string {
  const selisih = sekarang.getTime() - t.getTime();
  if (selisih < MENIT_MS) return "just now";
  if (selisih < JAM_MS) return jamak(Math.floor(selisih / MENIT_MS), "minute ago", "minutes ago");
  if (selisih < HARI_MS) return jamak(Math.floor(selisih / JAM_MS), "hour ago", "hours ago");
  const hari = selisihHariKalender(t, sekarang);
  if (hari <= 1) return "yesterday";
  if (hari <= 6) return jamak(hari, "day ago", "days ago");
  return formatTanggal(t, sekarang);
}

/** Sapaan Beranda (spec §6.1): 04:00–11:59 morning, 12:00–17:59 afternoon, selainnya evening. */
export function sapaan(t: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const jam = t.getHours();
  if (jam >= 4 && jam < 12) return "Good morning";
  if (jam >= 12 && jam < 18) return "Good afternoon";
  return "Good evening";
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/jamak.test.ts test/waktu.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/jamak.ts apps/mobile/src/waktu.ts apps/mobile/test/jamak.test.ts apps/mobile/test/waktu.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): jamak, tanggal, jam, waktu relatif, dan sapaan berbahasa Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi — batas yesterday**

Di `apps/mobile/src/waktu.ts`, ganti `  if (hari <= 1) return "yesterday";` dengan `  if (hari <= 0) return "yesterday";`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/waktu.test.ts`
Expected: FAIL — `waktuRelatif — setiap batas spec §7.4 > hari kalender sebelumnya → yesterday`. Rekam, lalu `git checkout -- apps/mobile/src/waktu.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 6: Tier berbahasa Inggris, teks bersama, hitSlop, penjaga `TIER_LABELS`

**Files:**
- Rewrite: `apps/mobile/src/tier.ts`, `apps/mobile/test/tier.test.ts`
- Modify: `apps/mobile/src/teks-ui.ts`, `apps/mobile/src/messages.ts` (tambah di akhir), `apps/mobile/app/kecocokan.tsx`
- Create: `apps/mobile/src/aksesibilitas.ts`, `apps/mobile/test/teks-ui.test.ts`

**Interfaces:**
- Consumes: `jamak` (Task 5); `TEKS_COBA_LAGI` (Task 4); `alamatSingkat` (`src/messages.ts`, sudah ada); `TIER_LABELS` (`@nearly/trust`, tidak diubah); `baca`, `semuaBerkas` (Task 2); `UKURAN` (Task 2).
- Produces:
  - `src/tier.ts`: `LABEL_TIER_EN` (`readonly ["New","Known","Trusted","Core"]`), `type LabelTierEn`, `JUMLAH_RUAS_TRUST = 4`, `labelTier(tier: number): LabelTierEn`, `tierDariLabel(label: string): number`, `labelAksesTrust(tier: number): string`, `ruasTerisiTrust(tier: number): number`, `SUGGESTED_TAGS` (Inggris), `tierView(tier, evidence): TierView` (Inggris), `type TrustEvidenceView`, `type TierView`
  - `src/teks-ui.ts`: `LENCANA_BERTEMU = "✓ met in person"`, `LENCANA_RINGKAS = "✓"`, `hurufAvatar(nama: string | null, alamat: string): string` (+ `TEKS_COBA_LAGI`)
  - `src/messages.ts`: `judulSheetBertemu(nama: string | null, alamat: string): string`
  - `src/aksesibilitas.ts`: `TARGET_SENTUH = 48`, `type Sisi = { top; bottom; left; right }`, `hitSlopSampai(lebar: number, tinggi?: number): Sisi`

- [ ] **Step 1: Tulis tes yang gagal**

Ganti SELURUH isi `apps/mobile/test/tier.test.ts` dengan:

```ts
import { describe, expect, it } from "vitest";
import { TIER_LABELS } from "@nearly/trust";
import {
  JUMLAH_RUAS_TRUST, LABEL_TIER_EN, labelAksesTrust, labelTier, ruasTerisiTrust, SUGGESTED_TAGS,
  tierDariLabel, tierView,
} from "../src/tier";
import { baca, semuaBerkas } from "./support/berkas";

const bukti = { connections: 47, occasions: 6, regions: 3, vouches: 12 };

describe("tierView", () => {
  it("menyusun label dan baris bukti sesuai spec §8", () => {
    const v = tierView(2, bukti);
    expect(v.label).toBe("Trusted");
    expect(v.evidenceLine).toBe("47 connections · 6 occasions · 3 regions · 12 vouches");
  });

  it("pengguna baru tanpa apa pun tetap punya baris bukti yang jujur", () => {
    const v = tierView(0, { connections: 0, occasions: 0, regions: 0, vouches: 0 });
    expect(v.label).toBe("New");
    expect(v.evidenceLine).toBe("no connections yet");
  });

  it("menghilangkan bagian yang bernilai nol dan memakai bentuk tunggal untuk 1", () => {
    const v = tierView(1, { connections: 3, occasions: 1, regions: 1, vouches: 0 });
    expect(v.evidenceLine).toBe("3 connections · 1 occasion · 1 region");
    expect(tierView(1, { connections: 1, occasions: 0, regions: 0, vouches: 1 }).evidenceLine)
      .toBe("1 connection · 1 vouch");
  });

  it("tier di luar rentang jatuh ke New, bukan undefined", () => {
    expect(tierView(9, bukti).label).toBe("New");
    expect(tierView(-1, bukti).label).toBe("New");
  });

  it("tag saran berbahasa Inggris dan tanpa spasi tepi", () => {
    expect([...SUGGESTED_TAGS]).toEqual(["real builder", "solid dev", "knows zk", "designer", "research"]);
    for (const t of SUGGESTED_TAGS) expect(t.trim()).toBe(t);
  });
});

describe("label tier Inggris (spec desain UI §7.4)", () => {
  it("LABEL_TIER_EN sepanjang TIER_LABELS", () => {
    expect(LABEL_TIER_EN.length).toBe(TIER_LABELS.length);
  });

  it("labelTier 0–3 → New/Known/Trusted/Core; di luar jangkauan → New", () => {
    expect([0, 1, 2, 3].map(labelTier)).toEqual(["New", "Known", "Trusted", "Core"]);
    for (const t of [4, -1, 1.5, Number.NaN]) expect(labelTier(t), String(t)).toBe("New");
  });

  it("tierDariLabel mengurai label kawat Indonesia; tak dikenal → 0", () => {
    expect(["Baru", "Dikenal", "Terpercaya", "Inti"].map(tierDariLabel)).toEqual([0, 1, 2, 3]);
    expect(tierDariLabel("Trusted")).toBe(0);
    expect(tierDariLabel("")).toBe(0);
  });

  it("labelAksesTrust 0–3 → Trust: New … Trust: Core", () => {
    expect([0, 1, 2, 3].map(labelAksesTrust)).toEqual(["Trust: New", "Trust: Known", "Trust: Trusted", "Trust: Core"]);
  });

  it("ruas batang terisi = tier + 1; di luar jangkauan satu ruas", () => {
    expect(JUMLAH_RUAS_TRUST).toBe(4);
    expect([0, 1, 2, 3].map(ruasTerisiTrust)).toEqual([1, 2, 3, 4]);
    expect(ruasTerisiTrust(9)).toBe(1);
  });
});

// Label kawat Indonesia tidak pernah tampil (spec §7.4, §10.1): hanya
// src/tier.ts yang boleh menyentuh TIER_LABELS.
describe("TIER_LABELS hanya diimpor src/tier.ts", () => {
  it("tidak ada berkas lain di app/, components/, src/ yang memakai TIER_LABELS", () => {
    const berkas = ["app", "components", "src"].flatMap((d) => semuaBerkas(d)).filter((b) => b !== "src/tier.ts");
    expect(berkas.filter((b) => baca(b).includes("TIER_LABELS"))).toEqual([]);
  });
});
```

`apps/mobile/test/teks-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hitSlopSampai, TARGET_SENTUH } from "../src/aksesibilitas";
import { judulSheetBertemu } from "../src/messages";
import { hurufAvatar, LENCANA_BERTEMU, LENCANA_RINGKAS, TEKS_COBA_LAGI } from "../src/teks-ui";
import { UKURAN } from "../theme/globals";

const ALAMAT = `0x9bE5${"0".repeat(32)}6ffA`;

describe("hurufAvatar (spec desain UI §6)", () => {
  it("huruf pertama nama yang di-trim, huruf besar", () => {
    expect(hurufAvatar("rina", ALAMAT)).toBe("R");
    expect(hurufAvatar("  budi ", ALAMAT)).toBe("B");
    expect(hurufAvatar("émile", ALAMAT)).toBe("É");
  });

  it("tanpa nama: karakter pertama setelah 0x, huruf besar", () => {
    expect(hurufAvatar(null, ALAMAT)).toBe("9");
    expect(hurufAvatar("", `0xab${"0".repeat(38)}`)).toBe("A");
    expect(hurufAvatar("   ", `0xcd${"0".repeat(38)}`)).toBe("C");
  });
});

describe("judulSheetBertemu (spec §6.2, R14)", () => {
  it("nama yang di-trim tidak kosong → You met ‹nama›", () => {
    expect(judulSheetBertemu("Rina", ALAMAT)).toBe("You met Rina");
    expect(judulSheetBertemu("  Rina ", ALAMAT)).toBe("You met Rina");
  });

  it("nama kosong, spasi, atau null → You met ‹alamat singkat›", () => {
    for (const nama of ["", "   ", null]) {
      expect(judulSheetBertemu(nama, ALAMAT)).toBe("You met 0x9bE5…6ffA");
    }
  });
});

describe("teks bersama baru (spec §7.3)", () => {
  it("lencana dan tombol galat berbahasa Inggris", () => {
    expect(LENCANA_BERTEMU).toBe("✓ met in person");
    expect(LENCANA_RINGKAS).toBe("✓");
    expect(TEKS_COBA_LAGI).toBe("Try again");
  });
});

describe("hitSlopSampai (spec §3.7)", () => {
  it("target sentuh 48 sama dengan token UKURAN.sentuh", () => {
    expect(TARGET_SENTUH).toBe(48);
    expect(UKURAN.sentuh).toBe(TARGET_SENTUH);
  });

  it("tombol kirim 40×40 mendapat 4 di tiap sisi", () => {
    expect(hitSlopSampai(40)).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
  });

  it("yang sudah ≥ 48 tidak mendapat tambahan", () => {
    expect(hitSlopSampai(52)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("tautan teks lebar tapi pendek hanya ditambah tingginya", () => {
    expect(hitSlopSampai(100, 20)).toEqual({ top: 14, bottom: 14, left: 0, right: 0 });
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/tier.test.ts test/teks-ui.test.ts`
Expected: FAIL — label masih "Terpercaya", ekspor baru tidak ada, `../src/aksesibilitas` tidak ada, dan penjaga `TIER_LABELS` merah untuk `app/kecocokan.tsx`.

- [ ] **Step 3: Tulis ulang `src/tier.ts`**

Ganti SELURUH isi `apps/mobile/src/tier.ts` dengan:

```ts
import { TIER_LABELS } from "@nearly/trust";
import { jamak } from "./jamak";

export type TrustEvidenceView = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TierView = { label: string; evidenceLine: string };

/**
 * Label tier yang TAMPIL (spec desain UI §7.4, keputusan #15). `TIER_LABELS`
 * bahasa Indonesia di packages/trust tetap nilai kawat API (`tierLabel`) dan
 * kunci graf /live — kode internal, tidak pernah dirender. Hanya berkas ini
 * yang mengimpornya (dijaga test/tier.test.ts).
 */
export const LABEL_TIER_EN = ["New", "Known", "Trusted", "Core"] as const;
export type LabelTierEn = (typeof LABEL_TIER_EN)[number];

/** Jumlah ruas batang trust (spec §6, keputusan #10f). */
export const JUMLAH_RUAS_TRUST = 4;

/** Tier 0–3 → label Inggris; di luar jangkauan → "New". */
export function labelTier(tier: number): LabelTierEn {
  return LABEL_TIER_EN[tier] ?? "New";
}

/** Label kawat Indonesia (radar, Pesan) → tier. Tak dikenal → 0. */
export function tierDariLabel(label: string): number {
  const i = (TIER_LABELS as readonly string[]).indexOf(label);
  return i < 0 ? 0 : i;
}

/** Label aksesibilitas BatangTrust: "Trust: Trusted" (spec §3.7, §6). */
export function labelAksesTrust(tier: number): string {
  return `Trust: ${labelTier(tier)}`;
}

/** Ruas terisi: New = 1, Known = 2, Trusted = 3, Core = 4. */
export function ruasTerisiTrust(tier: number): number {
  return LABEL_TIER_EN.indexOf(labelTier(tier)) + 1;
}

/**
 * Spec induk §7.3: tag itu deskriptif dan positif-saja. Tidak ada tag negatif.
 * Tag adalah isi yang ditandatangani (`tagsHash`): tag lama yang tercatat
 * tampil apa adanya (spec desain UI §7.4, §11 batas #15).
 */
export const SUGGESTED_TAGS = [
  "real builder",
  "solid dev",
  "knows zk",
  "designer",
  "research",
] as const;

/**
 * Tier SELALU tampil bersama buktinya (spec induk §8). Angka peringkat telanjang
 * menghidupkan lagi kecemasan ala Nosedive; fakta konkret lebih jujur dan lebih
 * berguna bagi orang yang sedang memutuskan apakah akan bicara dengan seseorang.
 */
export function tierView(tier: number, evidence: TrustEvidenceView): TierView {
  const bagian: string[] = [];
  if (evidence.connections > 0) bagian.push(jamak(evidence.connections, "connection", "connections"));
  if (evidence.occasions > 0) bagian.push(jamak(evidence.occasions, "occasion", "occasions"));
  if (evidence.regions > 0) bagian.push(jamak(evidence.regions, "region", "regions"));
  if (evidence.vouches > 0) bagian.push(jamak(evidence.vouches, "vouch", "vouches"));

  // "0 vouches" terbaca seperti tuduhan. Pengguna baru cukup dibilang apa adanya.
  return { label: labelTier(tier), evidenceLine: bagian.length > 0 ? bagian.join(" · ") : "no connections yet" };
}
```

- [ ] **Step 4: Teks bersama, judul sheet, hitSlop**

Tambahkan di AKHIR `apps/mobile/src/teks-ui.ts`:

```ts

/** Lencana "✓ terverifikasi" (keputusan #1, #15, R9): kamu dan orang ini sudah salaman. */
export const LENCANA_BERTEMU = "✓ met in person";

/** Lencana ringkas untuk kartu koneksi di radar (spec §6.4). */
export const LENCANA_RINGKAS = "✓";

/**
 * Huruf avatar (spec §6): huruf pertama nama yang di-trim (huruf besar); tanpa
 * nama, karakter pertama setelah "0x" (huruf besar). Array.from supaya huruf
 * di luar BMP tidak terbelah.
 */
export function hurufAvatar(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  if (n) return (Array.from(n)[0] ?? "").toUpperCase();
  const sisa = /^0x/i.test(alamat) ? alamat.slice(2) : alamat;
  return (sisa[0] ?? "?").toUpperCase();
}
```

Tambahkan di AKHIR `apps/mobile/src/messages.ts`:

```ts

/**
 * Judul sheet salaman berhasil (spec desain UI §6.2, R14): nama yang di-trim
 * tidak kosong → "You met ‹nama›"; selainnya "You met ‹alamat singkat›".
 * Dipakai Rencana B 5(a).
 */
export function judulSheetBertemu(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  return n ? `You met ${n}` : `You met ${alamatSingkat(alamat)}`;
}
```

`apps/mobile/src/aksesibilitas.ts`:

```ts
/** Target sentuh minimum (spec desain UI §3.7): 44 pt iOS / 48 dp Android → 48. */
export const TARGET_SENTUH = 48;

export type Sisi = { top: number; bottom: number; left: number; right: number };

/**
 * hitSlop yang membawa elemen selebar × setinggi itu ke TARGET_SENTUH tanpa
 * membesarkan tampilannya. Contoh: tombol kirim 40×40 → 4 di tiap sisi.
 */
export function hitSlopSampai(lebar: number, tinggi: number = lebar): Sisi {
  const v = Math.max(0, Math.ceil((TARGET_SENTUH - tinggi) / 2));
  const h = Math.max(0, Math.ceil((TARGET_SENTUH - lebar) / 2));
  return { top: v, bottom: v, left: h, right: h };
}
```

- [ ] **Step 5: Kecocokan berhenti merender `TIER_LABELS`**

Di `apps/mobile/app/kecocokan.tsx`, ganti

```tsx
import { TIER_LABELS } from "@nearly/trust";
```

dengan

```tsx
import { labelTier } from "../src/tier";
```

dan ganti

```tsx
            <Text style={s.meta}>{TIER_LABELS[k.tier] ?? TIER_LABELS[0]}</Text>
```

dengan

```tsx
            <Text style={s.meta}>{labelTier(k.tier)}</Text>
```

- [ ] **Step 6: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/tier.test.ts test/teks-ui.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. (Layar lama Profil orang kini menampilkan label tier, baris bukti, dan tag saran dalam bahasa Inggris — perubahan yang diharapkan spec §7.4 langkah 1.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/tier.ts apps/mobile/src/teks-ui.ts apps/mobile/src/messages.ts apps/mobile/src/aksesibilitas.ts \
  apps/mobile/app/kecocokan.tsx apps/mobile/test/tier.test.ts apps/mobile/test/teks-ui.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): label tier Inggris, teks bersama, judul sheet salaman, dan hitSlop

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — penjaga TIER_LABELS**

Di `apps/mobile/app/kecocokan.tsx`, tambahkan baris `import { TIER_LABELS } from "@nearly/trust";` tepat di bawah `import { labelTier } from "../src/tier";`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/tier.test.ts`
Expected: FAIL — `TIER_LABELS hanya diimpor src/tier.ts > tidak ada berkas lain di app/, components/, src/ yang memakai TIER_LABELS`. Rekam, lalu `git checkout -- apps/mobile/app/kecocokan.tsx`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 7: Komponen bersama

**Files:**
- Create: `apps/mobile/components/avatar.tsx`, `apps/mobile/components/lencana.tsx`, `apps/mobile/components/batang-trust.tsx`, `apps/mobile/components/kartu-orang.tsx`, `apps/mobile/components/segmen.tsx`, `apps/mobile/components/keadaan.tsx`, `apps/mobile/components/tautan-kecil.tsx`, `apps/mobile/test/komponen.test.ts`
- Modify: `apps/mobile/test/aksesibilitas.test.ts`, `apps/mobile/test/tema.test.ts`

**Interfaces:**
- Consumes: `Text`, `Button`, `Skeleton` (Task 1–2); `useColor`; `jarak`, `RADIUS`, `UKURAN`, `MAKS_SKALA_HURUF_KECIL` (Task 2); `hurufAvatar`, `LENCANA_BERTEMU`, `LENCANA_RINGKAS`, `TEKS_COBA_LAGI` (Task 4, 6); `labelTier`, `labelAksesTrust`, `ruasTerisiTrust`, `JUMLAH_RUAS_TRUST` (Task 6); `alamatSingkat`, `namaKartuRadar` (`src/messages.ts`, sudah ada).
- Produces:
  - `Avatar({ nama: string | null; alamat: string; ukuran: UkuranAvatar; cincin: CincinAvatar })`, `type UkuranAvatar = 42 | 56 | 64`, `type CincinAvatar = "primary" | "verified" | "avatarAwal"`
  - `Lencana(props: PropsLencana)`, `type PropsLencana = { varian: "terverifikasi"; ekor?: string } | { varian: "ringkas" } | { varian: "teks"; teks: string }`
  - `BatangTrust({ tier: number; kecil?: boolean; denganLabel?: boolean })`
  - `KartuOrang(props: PropsKartuOrang)`, `type PropsKartuOrang = { nama: string; alamat: string; terverifikasi: boolean; lencana?: ReactNode; keterangan?: string; tier?: number; onPress?: () => void }`
  - `Segmen<T extends string>({ pilihan: readonly PilihanSegmen<T>[]; nilai: T; onGanti: (nilai: T) => void })`, `type PilihanSegmen<T> = { nilai: T; label: string }`
  - `KeadaanKosong({ Ikon: ComponentType<LucideProps>; kalimat: string; aksi?: { label: string; onPress: () => void } })`, `KeadaanGalat({ kalimat: string; onCobaLagi: () => void })`, `KerangkaDaftar({ baris?: number })`
  - `TautanKecil({ label: string; onPress: () => void; accessibilityLabel?: string })`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/komponen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Tes baca-kode (tidak ada harness render RN): memastikan komponen bersama
// memakai fungsi murni yang teruji dan aturan spec desain UI §6, §3.7.
describe("komponen bersama", () => {
  it("BatangTrust membangun ruas dari ruasTerisiTrust dan menampilkan label Inggris", () => {
    const isi = baca("components/batang-trust.tsx");
    expect(isi).toContain("ruasTerisiTrust(tier)");
    expect(isi).toContain("labelTier(tier)");
    expect(tanpaKomentar(isi)).not.toContain("%"); // tier tidak pernah persentase (#10f)
  });

  it("Avatar dekoratif untuk pembaca layar dan hurufnya dari hurufAvatar", () => {
    const isi = baca("components/avatar.tsx");
    expect(isi).toContain("accessible={false}");
    expect(isi).toContain("hurufAvatar(nama, alamat)");
  });

  it("KartuOrang selalu menampilkan alamat singkat di sebelah nama (R4)", () => {
    const isi = baca("components/kartu-orang.tsx");
    expect(isi).toContain("namaKartuRadar(nama)");
    expect(isi).toContain("alamatSingkat(alamat)");
  });

  it("Lencana memakai teks bersama", () => {
    const isi = baca("components/lencana.tsx");
    expect(isi).toContain("LENCANA_BERTEMU");
    expect(isi).toContain("LENCANA_RINGKAS");
  });

  it("Segmen dan TautanKecil mencapai target sentuh 48", () => {
    expect(baca("components/segmen.tsx")).toContain("minHeight: UKURAN.sentuh");
    expect(baca("components/tautan-kecil.tsx")).toContain("minHeight: UKURAN.sentuh");
  });

  it("KeadaanGalat memakai tombol Try again bersama", () => {
    expect(baca("components/keadaan.tsx")).toContain("{TEKS_COBA_LAGI}");
  });
});
```

Tambahkan di dalam `describe("aksesibilitas — penjaga baca-kode", …)` di `apps/mobile/test/aksesibilitas.test.ts`, sebelum `});` penutupnya:

```ts

  it("BatangTrust adalah satu elemen aksesibel berlabel labelAksesTrust", () => {
    const isi = baca("components/batang-trust.tsx");
    expect(isi).toContain("accessibilityLabel={labelAksesTrust(tier)}");
    expect(isi).toMatch(/<View\s+accessible\b/);
  });

  it("Lencana dan Avatar membatasi pembesaran huruf 1,3×", () => {
    for (const b of ["components/lencana.tsx", "components/avatar.tsx"]) {
      expect(baca(b), b).toContain("maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}");
    }
  });
```

Tambahkan di AKHIR `apps/mobile/test/tema.test.ts`:

```ts

describe("batang trust (spec §3.4, #16B)", () => {
  it("ruas kosong memakai segmentEmpty, bukan border", () => {
    const isi = baca("components/batang-trust.tsx");
    expect(isi).toContain('useColor("segmentEmpty")');
    expect(isi).not.toContain('useColor("border")');
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/komponen.test.ts test/aksesibilitas.test.ts test/tema.test.ts`
Expected: FAIL — `ENOENT … components/batang-trust.tsx` (dan berkas komponen lain).

- [ ] **Step 3: `Avatar` dan `Lencana`**

`apps/mobile/components/avatar.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { hurufAvatar } from "../src/teks-ui";

export type UkuranAvatar = 42 | 56 | 64;
export type CincinAvatar = "primary" | "verified" | "avatarAwal";

/**
 * Lingkaran huruf awal (spec desain UI §6): 42 di kartu, 56 di sheet salaman,
 * 64 di kepala Profil orang; gradasi avatarAwal → border; cincin 2 px berwarna
 * pemberian pemanggil. Dekoratif untuk pembaca layar — nama selalu tampil di
 * sebelahnya (§3.7).
 */
export function Avatar({
  nama,
  alamat,
  ukuran,
  cincin,
}: {
  nama: string | null;
  alamat: string;
  ukuran: UkuranAvatar;
  cincin: CincinAvatar;
}) {
  const awal = useColor("avatarAwal");
  const akhir = useColor("border");
  const warnaCincin = useColor(cincin);
  const r = ukuran / 2;

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: ukuran, height: ukuran }}>
      <Svg width={ukuran} height={ukuran}>
        <Defs>
          <LinearGradient id="gradasiAvatar" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={awal} />
            <Stop offset="1" stopColor={akhir} />
          </LinearGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r - 1} fill="url(#gradasiAvatar)" stroke={warnaCincin} strokeWidth={2} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.tengah]}>
        <Text variant={ukuran >= 56 ? "title" : "body"} style={s.huruf} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
          {hurufAvatar(nama, alamat)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tengah: { alignItems: "center", justifyContent: "center" },
  huruf: { fontWeight: "600" },
});
```

`apps/mobile/components/lencana.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { jarak, MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { LENCANA_BERTEMU, LENCANA_RINGKAS } from "../src/teks-ui";

export type PropsLencana =
  | { varian: "terverifikasi"; ekor?: string }
  | { varian: "ringkas" }
  | { varian: "teks"; teks: string };

/**
 * Lencana (spec desain UI §3.4, §6): garis 1 px, teks 11, radius 5, dibatasi
 * 1,3× (§3.7). `terverifikasi` = "✓ met in person" (+ ekor seperti
 * " · 2 events together" dari pemanggil); `ringkas` = "✓"; `teks` = kalimat
 * bebas (mis. "You both want to meet") berwarna primary (Ruling A15).
 */
export function Lencana(props: PropsLencana) {
  const hijau = useColor("verified");
  const kuning = useColor("primary");
  const warna = props.varian === "teks" ? kuning : hijau;
  const teks =
    props.varian === "terverifikasi"
      ? `${LENCANA_BERTEMU}${props.ekor ?? ""}`
      : props.varian === "ringkas"
        ? LENCANA_RINGKAS
        : props.teks;

  return (
    <View style={[s.kotak, { borderColor: warna }]}>
      <Text variant="label" style={{ color: warna }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
        {teks}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kotak: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.lencana,
    paddingHorizontal: jarak.sm,
    paddingVertical: 0,
  },
});
```

- [ ] **Step 4: `BatangTrust` dan `KartuOrang`**

`apps/mobile/components/batang-trust.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { jarak, RADIUS, UKURAN } from "@/theme/globals";
import { JUMLAH_RUAS_TRUST, labelAksesTrust, labelTier, ruasTerisiTrust } from "../src/tier";

/**
 * Batang trust bertingkat (spec desain UI §6, keputusan #10f): 4 ruas, terisi
 * = tier + 1 berwarna `verified`, kosong `segmentEmpty` (#16B). Tidak pernah
 * persentase atau angka skor. SATU elemen aksesibel "Trust: ‹tier›"; bila label
 * tier ikut tampil, keduanya satu elemen supaya tidak terbaca dua kali (§3.7).
 */
export function BatangTrust({
  tier,
  kecil = false,
  denganLabel = false,
}: {
  tier: number;
  kecil?: boolean;
  denganLabel?: boolean;
}) {
  const terisi = useColor("verified");
  const kosong = useColor("segmentEmpty");
  const jumlahTerisi = ruasTerisiTrust(tier);
  const tinggi = kecil ? UKURAN.batangTrustKecil : UKURAN.batangTrust;

  return (
    <View accessible accessibilityLabel={labelAksesTrust(tier)} style={s.baris}>
      <View style={[s.ruas, { gap: UKURAN.celahRuas }]}>
        {Array.from({ length: JUMLAH_RUAS_TRUST }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: tinggi,
              borderRadius: RADIUS.batang,
              backgroundColor: i < jumlahTerisi ? terisi : kosong,
            }}
          />
        ))}
      </View>
      {denganLabel ? <Text variant="caption">{labelTier(tier)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: "row", alignItems: "center", gap: jarak.sm },
  ruas: { flex: 1, flexDirection: "row" },
});
```

`apps/mobile/components/kartu-orang.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { alamatSingkat, namaKartuRadar } from "../src/messages";
import { Avatar } from "./avatar";
import { BatangTrust } from "./batang-trust";

export type PropsKartuOrang = {
  nama: string;
  alamat: string;
  terverifikasi: boolean;
  lencana?: ReactNode;
  keterangan?: string;
  tier?: number;
  onPress?: () => void;
};

/**
 * Kartu orang ringkas (spec desain UI §6, R4): Avatar 42 (cincin `verified`
 * bila sudah salaman), nama + alamat SINGKAT mono yang tidak pernah
 * dihilangkan (anti-impersonasi), lencana, keterangan redup, batang trust
 * opsional.
 */
export function KartuOrang({ nama, alamat, terverifikasi, lencana, keterangan, tier, onPress }: PropsKartuOrang) {
  const latar = useColor("card");
  const garis = useColor("border");
  const gaya = [s.kartu, { backgroundColor: latar, borderColor: garis }];

  const isi = (
    <View style={s.baris}>
      <Avatar
        nama={nama}
        alamat={alamat}
        ukuran={UKURAN.avatarKartu}
        cincin={terverifikasi ? "verified" : "avatarAwal"}
      />
      <View style={s.teks}>
        <View style={s.nama}>
          <Text variant="body" style={s.tebal}>{namaKartuRadar(nama)}</Text>
          <Text variant="mono">{alamatSingkat(alamat)}</Text>
        </View>
        {lencana}
        {keterangan ? <Text variant="caption">{keterangan}</Text> : null}
        {tier !== undefined ? <BatangTrust tier={tier} kecil /> : null}
      </View>
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={gaya}>
      {isi}
    </Pressable>
  ) : (
    <View style={gaya}>{isi}</View>
  );
}

const s = StyleSheet.create({
  kartu: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 16 },
  baris: { flexDirection: "row", alignItems: "center", gap: 12 },
  teks: { flex: 1, gap: 4 },
  nama: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  tebal: { fontWeight: "600" },
});
```

- [ ] **Step 5: `Segmen`, `TautanKecil`, dan empat keadaan**

`apps/mobile/components/segmen.tsx`:

```tsx
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";

export type PilihanSegmen<T extends string> = { nilai: T; label: string };

/**
 * Pemilih mode (spec desain UI §3.6: BNA tidak punya segmented control).
 * Dipakai layar Salaman ("Show QR" | "Scan"). Setiap butir ≥ 48 tinggi.
 */
export function Segmen<T extends string>({
  pilihan,
  nilai,
  onGanti,
}: {
  pilihan: readonly PilihanSegmen<T>[];
  nilai: T;
  onGanti: (nilai: T) => void;
}) {
  const latar = useColor("card");
  const garis = useColor("border");
  const aktif = useColor("primary");
  const teksAktif = useColor("primaryForeground");
  const teks = useColor("text");

  return (
    <View accessibilityRole="tablist" style={[s.wadah, { backgroundColor: latar, borderColor: garis }]}>
      {pilihan.map((p) => {
        const terpilih = p.nilai === nilai;
        return (
          <Pressable
            key={p.nilai}
            accessibilityRole="tab"
            accessibilityState={{ selected: terpilih }}
            onPress={() => onGanti(p.nilai)}
            style={[s.butir, terpilih ? { backgroundColor: aktif } : null]}
          >
            <Text variant="body" style={{ color: terpilih ? teksAktif : teks, fontWeight: "600" }}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.kartu, padding: 4, gap: 4 },
  butir: {
    flex: 1,
    minHeight: UKURAN.sentuh,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.kartu,
  },
});
```

`apps/mobile/components/tautan-kecil.tsx`:

```tsx
import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";

/**
 * Tautan teks kecil ("See all ›", "Open radar ›", "Copy", "Report", …) dengan
 * target sentuh ≥ 48 lewat minHeight, tanpa membesarkan hurufnya (spec desain
 * UI §3.7).
 */
export function TautanKecil({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const warna = useColor("primary");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={s.sentuh}>
      <Text variant="caption" style={{ color: warna, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sentuh: { minHeight: UKURAN.sentuh, justifyContent: "center" },
});
```

`apps/mobile/components/keadaan.tsx`:

```tsx
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";
import { TEKS_COBA_LAGI } from "../src/teks-ui";

/**
 * Empat keadaan seragam (spec desain UI §7.2). "Berhasil" adalah toast BNA +
 * haptic, dipanggil langsung oleh layar. Kalimat kosong/galat selalu kalimat
 * yang SUDAH ADA di layar (diterjemahkan Rencana B), bukan teks baru.
 */

/** Kosong: ikon lucide redup + kalimat + satu aksi bila masuk akal. */
export function KeadaanKosong({
  Ikon,
  kalimat,
  aksi,
}: {
  Ikon: ComponentType<LucideProps>;
  kalimat: string;
  aksi?: { label: string; onPress: () => void };
}) {
  const redup = useColor("textMuted");
  return (
    <View style={s.tengah}>
      <Ikon color={redup} size={32} />
      <Text variant="body" style={[s.rata, { color: redup }]}>{kalimat}</Text>
      {aksi ? <Button onPress={aksi.onPress}>{aksi.label}</Button> : null}
    </View>
  );
}

/** Galat: kalimat galat + "Try again" yang memuat ulang. */
export function KeadaanGalat({ kalimat, onCobaLagi }: { kalimat: string; onCobaLagi: () => void }) {
  return (
    <View style={s.tengah}>
      <Text variant="body" style={s.rata}>{kalimat}</Text>
      <Button variant="outline" onPress={onCobaLagi}>{TEKS_COBA_LAGI}</Button>
    </View>
  );
}

/** Memuat: kerangka berbentuk kartu (diam saat Reduce Motion — lihat Skeleton). */
export function KerangkaDaftar({ baris = 3 }: { baris?: number }) {
  return (
    <View style={s.daftar}>
      {Array.from({ length: baris }, (_, i) => (
        <Skeleton key={i} height={UKURAN.tinggiKerangka} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tengah: { alignItems: "center", gap: 12, paddingVertical: 32, paddingHorizontal: 16 },
  rata: { textAlign: "center" },
  daftar: { gap: 12 },
});
```

- [ ] **Step 6: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/mobile exec vitest run test/komponen.test.ts test/aksesibilitas.test.ts test/tema.test.ts
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. Bila `tsc` menolak prop `accessible` pada `Svg` atau tipe `LucideProps`, **laporkan** galat persisnya — jangan mengganti tipe dengan `any`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/avatar.tsx apps/mobile/components/lencana.tsx apps/mobile/components/batang-trust.tsx \
  apps/mobile/components/kartu-orang.tsx apps/mobile/components/segmen.tsx apps/mobile/components/keadaan.tsx \
  apps/mobile/components/tautan-kecil.tsx apps/mobile/test/komponen.test.ts apps/mobile/test/aksesibilitas.test.ts \
  apps/mobile/test/tema.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): komponen bersama — avatar, lencana, batang trust, kartu orang, segmen, keadaan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — ruas kosong memakai border**

Di `apps/mobile/components/batang-trust.tsx`, ganti `  const kosong = useColor("segmentEmpty");` dengan `  const kosong = useColor("border");`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/tema.test.ts`
Expected: FAIL — `batang trust (spec §3.4, #16B) > ruas kosong memakai segmentEmpty, bukan border`. Rekam, lalu `git checkout -- apps/mobile/components/batang-trust.tsx`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — jarak di luar skala**

Di `apps/mobile/components/kartu-orang.tsx`, ganti `  teks: { flex: 1, gap: 4 },` dengan `  teks: { flex: 1, gap: 6 },`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/aksesibilitas.test.ts`
Expected: FAIL — `aksesibilitas — penjaga baca-kode > jarak literal hanya dari skala 4/8/12/16/24/32` dengan `components/kartu-orang.tsx: gap: 6`. Rekam, lalu `git checkout -- apps/mobile/components/kartu-orang.tsx`, jalankan ulang (PASS), `git status --short` kosong.

---
## Task 8: Pohon navigasi — tab, Stack per tab, Salaman gabungan, judul Inggris

**Files:**
- Move (`git mv`, isi dipertahankan kecuali jalur impor):

  | Dari (`apps/mobile/`) | Ke (`apps/mobile/`) |
  |---|---|
  | `app/index.tsx` | `app/(tabs)/(beranda)/index.tsx` |
  | `app/feed/index.tsx` | `app/(tabs)/(beranda)/feed/index.tsx` |
  | `app/feed/new.tsx` | `app/(tabs)/(beranda)/feed/new.tsx` |
  | `app/events/index.tsx` | `app/(tabs)/(acara)/events/index.tsx` |
  | `app/events/new.tsx` | `app/(tabs)/(acara)/events/new.tsx` |
  | `app/events/[id].tsx` | `app/(tabs)/(acara)/events/[id].tsx` |
  | `app/events/[id]/host-qr.tsx` | `app/(tabs)/(acara)/events/[id]/host-qr.tsx` |
  | `app/radar/[eventId].tsx` | `app/(tabs)/(acara)/radar/[eventId].tsx` |
  | `app/pesan/index.tsx` | `app/(tabs)/(pesan)/pesan/index.tsx` |
  | `app/pesan/[address].tsx` | `app/(tabs)/(pesan)/pesan/[address].tsx` |
  | `app/pesan/lapor/[address].tsx` | `app/(tabs)/(pesan)/pesan/lapor/[address].tsx` |
  | `app/profil-saya.tsx` | `app/(tabs)/(profil)/profil-saya.tsx` |
  | `app/connections.tsx` | `app/(tabs)/(profil)/connections.tsx` |
  | `app/kecocokan.tsx` | `app/(tabs)/(profil)/kecocokan.tsx` |
  | `app/dompet.tsx` | `app/(tabs)/(profil)/dompet.tsx` |
  | `app/blokir.tsx` | `app/(tabs)/(profil)/blokir.tsx` |
  | `app/qr.tsx` | `components/salaman/mode-qr.tsx` (lalu ditulis ulang tanpa pembungkus) |
  | `app/scan.tsx` | `components/salaman/mode-pindai.tsx` (lalu ditulis ulang tanpa pembungkus) |

- Delete: `apps/mobile/app/spike-bna.tsx`
- Rewrite: `apps/mobile/src/judul-layar.ts`, `apps/mobile/theme/navigasi.ts`, `apps/mobile/test/judul-layar.test.ts`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/(beranda)/_layout.tsx`, `apps/mobile/app/(tabs)/(acara)/_layout.tsx`, `apps/mobile/app/(tabs)/(salaman)/_layout.tsx`, `apps/mobile/app/(tabs)/(pesan)/_layout.tsx`, `apps/mobile/app/(tabs)/(profil)/_layout.tsx`, `apps/mobile/app/(tabs)/(salaman)/salaman.tsx`, `apps/mobile/components/stack-tab.tsx`, `apps/mobile/components/tab/ikon-tab.tsx`, `apps/mobile/components/tab/tombol-salaman.tsx`, `apps/mobile/src/salaman-mode.ts`, `apps/mobile/test/salaman-mode.test.ts`, `apps/mobile/test/tautan.test.ts`, `apps/mobile/test/support/rute.ts`
- Modify: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/(beranda)/index.tsx`, `apps/mobile/app/(tabs)/(acara)/events/[id].tsx`, `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, `apps/mobile/test/rute-push.test.ts`, `apps/mobile/test/aksesibilitas.test.ts`, `apps/mobile/test/support/berkas.ts`

**Interfaces:**
- Consumes: `OPSI_STACK` (Task 4); `Segmen`, `PilihanSegmen` (Task 7); `Text`, `useColor`, `UKURAN`, `RADIUS`, `MAKS_SKALA_HURUF_KECIL`; `useNearlySigner`, `CONFIG`, `NearlySigner`, `ruteDariNotifikasi` (sudah ada); `useIsFocused`, `useLocalSearchParams`, `Tabs`, `Stack` dari `expo-router`.
- Produces:
  - `src/judul-layar.ts`: `JUDUL_LAYAR` (kunci jalur berkas termasuk grup, nilai Inggris — spec §4.7), `LAYAR_AKAR = ["(tabs)", "mulai", "profile/[address]"] as const`, `RUTE_TANPA_DOMPET`, `type OpsiLayarAkar = { title: string } | { headerShown: false }`, `layarMenurutDompet(punyaDompet: boolean): [string, OpsiLayarAkar][]`, `type NamaIkonTab`, `type TabBawah = { grup; label; ikon: NamaIkonTab; layarAwal }`, `TAB_BAWAH` (5 tab, `as const`), `type GrupTab`, `layarDalam(induk: string): [string, string][]`, `LAYAR_TERMIGRASI`
  - `theme/navigasi.ts`: `OPSI_STACK`, `type OpsiTampilan`, `opsiTampilan(kunci: string): OpsiTampilan` (Beranda tanpa header, akar tab lain `headerLargeTitle`, latar gelap untuk `LAYAR_TERMIGRASI`)
  - `components/stack-tab.tsx`: `StackTab({ grup: GrupTab })`
  - `components/tab/ikon-tab.tsx`: `IkonTab({ Ikon: ComponentType<LucideProps>; warna: string; lencana?: string | null; titik?: boolean })`
  - `components/tab/tombol-salaman.tsx`: `TombolSalaman({ onPress: (e: GestureResponderEvent) => void; terpilih: boolean; label: string })`
  - `components/salaman/mode-qr.tsx`: `ModeQr({ signerSalaman: NearlySigner })`
  - `components/salaman/mode-pindai.tsx`: `ModePindai({ signerHadir: NearlySigner; signerSalaman: NearlySigner })`
  - `src/salaman-mode.ts`: `type ModeSalaman = "qr" | "pindai"`, `PILIHAN_MODE_SALAMAN`, `modeSalamanDariParam(param: string | string[] | undefined): ModeSalaman`
  - `app/(tabs)/(salaman)/salaman.tsx`: rute `/salaman` (`?mode=pindai` membuka Scan); `SalamanIsi` (tidak diekspor)
  - `test/support/rute.ts`: `semuaPolaRute(): string[][]`, `cocokRute(href: string, pola: string[][]): boolean`
  - URL lain tidak berubah (R2); `/qr` dan `/scan` hilang.

- [ ] **Step 1: Tulis ulang tes judul layar (gagal dulu)**

Ganti SELURUH isi `apps/mobile/test/judul-layar.test.ts` dengan:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JUDUL_LAYAR, LAYAR_AKAR, LAYAR_TERMIGRASI, layarDalam, layarMenurutDompet, TAB_BAWAH,
} from "../src/judul-layar";
import { opsiTampilan } from "../theme/navigasi";

const MOBILE = join(__dirname, "..");
const APP = join(MOBILE, "app");

/** Kunci setiap berkas layar: `app/(tabs)/(acara)/events/[id].tsx` → `(tabs)/(acara)/events/[id]`. */
function semuaRute(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const jalur = join(dir, e.name);
    if (e.isDirectory()) return semuaRute(jalur);
    if (!e.name.endsWith(".tsx") || e.name.startsWith("_")) return [];
    return [relative(APP, jalur).split(sep).join("/").replace(/\.tsx$/, "")];
  });
}

// Tanpa judul, header menampilkan nama rute mentah ("events/new",
// "profile/[address]") — ditemukan di iPhone saat uji lapangan Fase 4b + 5.
// Layar baru yang lupa didaftarkan harus membuat tes ini merah.
describe("judul layar", () => {
  it("setiap berkas layar di app/ punya judul", () => {
    const tanpaJudul = semuaRute().filter((r) => !(r in JUDUL_LAYAR));
    expect(tanpaJudul).toEqual([]);
  });

  it("tidak ada judul untuk rute yang sudah tidak ada", () => {
    const rute = new Set(semuaRute());
    expect(Object.keys(JUDUL_LAYAR).filter((r) => !rute.has(r))).toEqual([]);
  });

  it("judul tidak kosong dan bukan nama rute", () => {
    for (const [rute, judul] of Object.entries(JUDUL_LAYAR)) {
      expect(judul.trim(), rute).not.toBe("");
      expect(judul, rute).not.toMatch(/[\/\[\]]/);
    }
  });

  it("judul persis spec desain UI §4.7", () => {
    expect(JUDUL_LAYAR).toEqual({
      mulai: "Get started",
      "profile/[address]": "Profile",
      "(tabs)/(beranda)/index": "Home",
      "(tabs)/(beranda)/feed/index": "Feed",
      "(tabs)/(beranda)/feed/new": "New post",
      "(tabs)/(acara)/events/index": "Events",
      "(tabs)/(acara)/events/new": "Create event",
      "(tabs)/(acara)/events/[id]": "Event details",
      "(tabs)/(acara)/events/[id]/host-qr": "Check-in QR",
      "(tabs)/(acara)/radar/[eventId]": "Radar",
      "(tabs)/(salaman)/salaman": "Handshake",
      "(tabs)/(pesan)/pesan/index": "Messages",
      "(tabs)/(pesan)/pesan/[address]": "Conversation",
      "(tabs)/(pesan)/pesan/lapor/[address]": "Report",
      "(tabs)/(profil)/profil-saya": "Profile",
      "(tabs)/(profil)/connections": "Connections",
      "(tabs)/(profil)/kecocokan": "Matches",
      "(tabs)/(profil)/dompet": "Wallet",
      "(tabs)/(profil)/blokir": "Blocked",
    });
  });

  it("setiap kunci dimiliki tepat satu layout: Stack akar atau satu Stack tab", () => {
    const akar = LAYAR_AKAR.filter((n) => n !== "(tabs)");
    const perTab = TAB_BAWAH.flatMap((t) =>
      layarDalam(`(tabs)/${t.grup}`).map(([nama]) => `(tabs)/${t.grup}/${nama}`));
    const semua = [...akar, ...perTab];
    expect([...semua].sort()).toEqual(Object.keys(JUDUL_LAYAR).sort());
    expect(new Set(semua).size).toBe(semua.length);
  });

  // Tanpa dompet hanya layar Mulai; dengan dompet, (tabs) adalah layar pertama
  // yang dituju saat penjaga berubah (spec §4.2).
  it("layarMenurutDompet: tanpa dompet hanya mulai; dengan dompet (tabs) lebih dulu", () => {
    expect(layarMenurutDompet(false)).toEqual([["mulai", { title: "Get started" }]]);
    expect(layarMenurutDompet(true)).toEqual([
      ["(tabs)", { headerShown: false }],
      ["profile/[address]", { title: "Profile" }],
    ]);
  });

  // Memeriksa pemakaian, bukan sekadar nama: impor saja tanpa pendaftaran
  // meloloskan tes versi awal, dan judul yang ditulis tangan di layout akan
  // lolos dari tes "setiap layar punya judul" di atas.
  it("_layout.tsx akar mendaftarkan kedua sisi gerbang dompet, tanpa judul tulisan tangan", () => {
    const layout = readFileSync(join(APP, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/layarMenurutDompet\(true\)\.map\(/);
    expect(layout).toMatch(/layarMenurutDompet\(false\)\.map\(/);
    expect(layout).not.toMatch(/title:\s*"/);
  });

  it("TAB_BAWAH: lima grup dalam urutan spec §4.3, masing-masing punya _layout.tsx", () => {
    expect(TAB_BAWAH.map((t) => [t.grup, t.label])).toEqual([
      ["(beranda)", "Home"],
      ["(acara)", "Events"],
      ["(salaman)", "Handshake"],
      ["(pesan)", "Messages"],
      ["(profil)", "Profile"],
    ]);
    for (const t of TAB_BAWAH) expect(existsSync(join(APP, "(tabs)", t.grup, "_layout.tsx")), t.grup).toBe(true);
  });

  it("setiap _layout.tsx tab merender StackTab grupnya dengan initialRouteName layar akar tab", () => {
    for (const t of TAB_BAWAH) {
      const isi = readFileSync(join(APP, "(tabs)", t.grup, "_layout.tsx"), "utf8");
      expect(isi, t.grup).toContain(`<StackTab grup="${t.grup}" />`);
      expect(isi, t.grup).toContain(`initialRouteName: "${t.layarAwal}"`);
      expect(isi, t.grup).not.toMatch(/title:\s*"/);
      expect(`(tabs)/${t.grup}/${t.layarAwal}` in JUDUL_LAYAR, t.grup).toBe(true);
    }
  });

  it("StackTab mendaftarkan judul dari layarDalam, tanpa judul tulisan tangan", () => {
    const isi = readFileSync(join(MOBILE, "components", "stack-tab.tsx"), "utf8");
    expect(isi).toMatch(/layarDalam\(induk\)\.map\(/);
    expect(isi).not.toMatch(/title:\s*"/);
  });

  it("(tabs)/_layout.tsx memetakan TAB_BAWAH, tanpa judul tulisan tangan", () => {
    const isi = readFileSync(join(APP, "(tabs)", "_layout.tsx"), "utf8");
    expect(isi).toMatch(/TAB_BAWAH\.map\(/);
    expect(isi).toContain("name={tab.grup}");
    expect(isi).not.toMatch(/title:\s*"/);
  });

  it("LAYAR_TERMIGRASI hanya berisi kunci JUDUL_LAYAR", () => {
    expect([...LAYAR_TERMIGRASI].filter((k) => !(k in JUDUL_LAYAR))).toEqual([]);
  });

  it("Beranda tanpa header; layar akar tab lain berjudul besar (spec §4.7)", () => {
    expect(opsiTampilan("(tabs)/(beranda)/index")).toMatchObject({ headerShown: false });
    for (const k of [
      "(tabs)/(acara)/events/index", "(tabs)/(salaman)/salaman", "(tabs)/(pesan)/pesan/index",
      "(tabs)/(profil)/profil-saya",
    ]) {
      expect(opsiTampilan(k), k).toMatchObject({ headerLargeTitle: true });
    }
    expect(opsiTampilan("(tabs)/(acara)/events/[id]")).toEqual({});
  });
});
```

- [ ] **Step 2: Tes rute, tautan, Salaman, dan penjaga lain (gagal dulu)**

`apps/mobile/test/support/rute.ts`:

```ts
import { semuaBerkas } from "./berkas";

/**
 * Pola URL setiap berkas layar di app/: segmen grup "(…)" dibuang (R2) dan
 * "index" di akhir dibuang. `app/(tabs)/(pesan)/pesan/index.tsx` → ["pesan"].
 */
export function semuaPolaRute(): string[][] {
  return semuaBerkas("app", /\.tsx$/)
    .filter((b) => !(b.split("/").pop() ?? "").startsWith("_"))
    .map((b) => b.replace(/^app\//, "").replace(/\.tsx$/, "").split("/").filter((s) => !/^\(.+\)$/.test(s)))
    .map((seg) => (seg[seg.length - 1] === "index" ? seg.slice(0, -1) : seg));
}

/** Apakah href (tanpa query/fragmen) cocok dengan salah satu pola; `[param]` cocok dengan segmen apa pun. */
export function cocokRute(href: string, pola: string[][]): boolean {
  const jalur = href.split(/[?#]/)[0] ?? "";
  const seg = jalur.split("/").filter(Boolean);
  return pola.some((p) => p.length === seg.length && p.every((s, i) => /^\[.+\]$/.test(s) || s === seg[i]));
}
```

Tambahkan di AKHIR `apps/mobile/test/rute-push.test.ts`:

```ts

import { cocokRute, semuaPolaRute } from "./support/rute";

// Spec desain UI §4.5, §10.1: rute keluaran ruteDariNotifikasi harus tetap
// menunjuk berkas yang ada setelah layar dipindah ke grup tab.
describe("rute notifikasi ada di pohon app/", () => {
  it("/pesan dan /radar/<id> cocok dengan berkas di app/ setelah segmen grup dibuang", () => {
    const pola = semuaPolaRute();
    const pesan = ruteDariNotifikasi({ jenis: "pesan" });
    const radar = ruteDariNotifikasi({ jenis: "radar", eventId: `0x${"e1".repeat(32)}` });
    expect(pesan).not.toBeNull();
    expect(radar).not.toBeNull();
    expect(cocokRute(pesan ?? "", pola)).toBe(true);
    expect(cocokRute(radar ?? "", pola)).toBe(true);
  });
});
```

`apps/mobile/test/tautan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baca, semuaBerkas } from "./support/berkas";
import { cocokRute, semuaPolaRute } from "./support/rute";

/** Tautan statis di satu berkas; `${…}` di templat menjadi segmen bebas "_". */
function tautanStatis(isi: string): string[] {
  const hasil: string[] = [];
  for (const m of isi.matchAll(/href="([^"]+)"/g)) hasil.push(m[1] ?? "");
  for (const m of isi.matchAll(/router\.(?:push|replace|navigate)\("([^"]+)"\)/g)) hasil.push(m[1] ?? "");
  for (const m of isi.matchAll(/(?:href=\{|router\.(?:push|replace|navigate)\()`([^`]+)`/g)) {
    hasil.push((m[1] ?? "").replace(/\$\{[^}]+\}/g, "_"));
  }
  return hasil;
}

const tautan = [...semuaBerkas("app"), ...semuaBerkas("components")]
  .filter((b) => b.endsWith(".tsx"))
  .flatMap((b) => tautanStatis(baca(b)).map((href) => ({ berkas: b, href })));

// Spec desain UI §5, §10.1: layar pindah ke grup tab tanpa mengubah URL (R2);
// satu-satunya URL baru /salaman, dan /qr + /scan hilang.
describe("tautan", () => {
  it("ada tautan yang diperiksa", () => {
    expect(tautan.length).toBeGreaterThan(0);
  });

  it("setiap tautan statis menunjuk rute yang ada", () => {
    const pola = semuaPolaRute();
    expect(tautan.filter((t) => !cocokRute(t.href, pola))).toEqual([]);
  });

  it("tidak ada lagi /qr atau /scan", () => {
    expect(tautan.filter((t) => /^\/(qr|scan)(\/|\?|$)/.test(t.href))).toEqual([]);
  });
});
```

`apps/mobile/test/salaman-mode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { modeSalamanDariParam, PILIHAN_MODE_SALAMAN } from "../src/salaman-mode";
import { baca } from "./support/berkas";

describe("mode layar Salaman (spec desain UI §6.2)", () => {
  it("mode awal Show QR; ?mode=pindai membuka Scan", () => {
    expect(modeSalamanDariParam(undefined)).toBe("qr");
    expect(modeSalamanDariParam("pindai")).toBe("pindai");
    expect(modeSalamanDariParam(["pindai"])).toBe("pindai");
    expect(modeSalamanDariParam("lain")).toBe("qr");
  });

  it("label segmen berbahasa Inggris, Show QR lebih dulu", () => {
    expect(PILIHAN_MODE_SALAMAN.map((p) => [p.nilai, p.label])).toEqual([["qr", "Show QR"], ["pindai", "Scan"]]);
  });

  it("isi mode dirender hanya saat tab fokus, di komponen isi (R10)", () => {
    const isi = baca("app/(tabs)/(salaman)/salaman.tsx");
    const pembungkus = isi.slice(isi.indexOf("export default function"), isi.indexOf("function SalamanIsi"));
    expect(pembungkus).not.toContain("useIsFocused");
    expect(isi).toContain("const fokus = useIsFocused();");
    expect(isi).toMatch(/\{fokus && \(/);
    expect(isi).toContain("<ModeQr signerSalaman={signerSalaman} />");
    expect(isi).toContain("<ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />");
  });

  it("mode Pindai tetap mencoba QR check-in sebelum QR salaman, dengan penjaga busy", () => {
    const isi = baca("components/salaman/mode-pindai.tsx");
    const checkin = isi.indexOf("decodeCheckInQr(data)");
    expect(checkin).toBeGreaterThan(-1);
    expect(checkin).toBeLessThan(isi.indexOf("decodeQr(data)"));
    expect(isi).toContain("if (busy) return;");
  });
});
```

Di `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, ganti objek `HARAPAN` seluruhnya

```ts
    const HARAPAN: Record<string, string[]> = {
      "app/blokir.tsx": [`signer:${V}`],
      "app/connections.tsx": [`signer:${V}`],
      "app/events/[id].tsx": ["signer:attendanceRegistry"],
      "app/events/[id]/host-qr.tsx": ["signer:attendanceRegistry"],
      "app/events/new.tsx": ["signer:attendanceRegistry"],
      "app/feed/index.tsx": [`signer:${V}`],
      "app/feed/new.tsx": [`signer:${V}`],
      "app/index.tsx": [`signer:${V}`],
      "app/kecocokan.tsx": [`signer:${V}`],
      "app/pesan/[address].tsx": [`signer:${V}`],
      "app/pesan/index.tsx": [`signer:${V}`],
      "app/pesan/lapor/[address].tsx": [`signer:${V}`],
      "app/profil-saya.tsx": [`signer:${V}`],
      "app/profile/[address].tsx": [`signer:${V}`],
      "app/qr.tsx": [`signer:${V}`],
      "app/radar/[eventId].tsx": [`signer:${V}`],
      "app/scan.tsx": ["signerHadir:attendanceRegistry", `signerSalaman:${V}`],
    };
```

dengan

```ts
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
```

dan ganti

```ts
  it("layar pindai meneruskan signer hadir dan salaman ke prop yang sesuai", () => {
    const scan = kode.find((k) => k.berkas === "app/scan.tsx")!.isi;
    expect(scan).toMatch(/<ScanIsi\b[^>]*signerHadir=\{signerHadir\}[^>]*signerSalaman=\{signerSalaman\}/);
  });
```

dengan

```ts
  it("layar Salaman meneruskan signer hadir dan salaman ke prop yang sesuai", () => {
    const salaman = kode.find((k) => k.berkas === "app/(tabs)/(salaman)/salaman.tsx")!.isi;
    expect(salaman).toMatch(/<SalamanIsi\b[^>]*signerHadir=\{signerHadir\}[^>]*signerSalaman=\{signerSalaman\}/);
    expect(salaman).toContain("<ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />");
  });
```

Di `apps/mobile/test/support/berkas.ts`, ganti

```ts
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([]);
```

dengan

```ts
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([
  // app/qr.tsx dan app/scan.tsx dipindah apa adanya (Ruling A10) — Rencana B 5(a).
  "components/salaman/mode-qr.tsx",
  "components/salaman/mode-pindai.tsx",
]);
```

Tambahkan di dalam `describe("aksesibilitas — penjaga baca-kode", …)` di `apps/mobile/test/aksesibilitas.test.ts`, sebelum `});` penutupnya:

```ts

  it("label tab bar dan lencana tab membatasi pembesaran huruf 1,3×", () => {
    expect(baca("app/(tabs)/_layout.tsx")).toContain("maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}");
    expect(baca("components/tab/ikon-tab.tsx")).toContain("maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}");
  });

  it("tinggi tab bar menyertakan inset bawah; tombol Salaman berlabel aksesibilitas", () => {
    expect(baca("app/(tabs)/_layout.tsx")).toContain("UKURAN.tinggiIsiTabBar + insets.bottom");
    expect(baca("components/tab/tombol-salaman.tsx")).toContain("accessibilityLabel={label}");
  });
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts test/rute-push.test.ts test/tautan.test.ts test/salaman-mode.test.ts test/dompet-tanpa-kunci-dev.test.ts test/aksesibilitas.test.ts`
Expected: FAIL — `LAYAR_AKAR`/`layarDalam`/`TAB_BAWAH` tidak diekspor, `../src/salaman-mode` tidak ada, `tautan > tidak ada lagi /qr atau /scan` merah, `HARAPAN` tidak cocok, berkas tab belum ada.

- [ ] **Step 4: Pindahkan layar dengan `git mv`**

```bash
cd apps/mobile
mkdir -p "app/(tabs)/(beranda)/feed" "app/(tabs)/(acara)/events/[id]" "app/(tabs)/(acara)/radar" \
  "app/(tabs)/(salaman)" "app/(tabs)/(pesan)/pesan/lapor" "app/(tabs)/(profil)" "components/salaman"
git mv app/index.tsx "app/(tabs)/(beranda)/index.tsx"
git mv app/feed/index.tsx "app/(tabs)/(beranda)/feed/index.tsx"
git mv app/feed/new.tsx "app/(tabs)/(beranda)/feed/new.tsx"
git mv app/events/index.tsx "app/(tabs)/(acara)/events/index.tsx"
git mv app/events/new.tsx "app/(tabs)/(acara)/events/new.tsx"
git mv "app/events/[id].tsx" "app/(tabs)/(acara)/events/[id].tsx"
git mv "app/events/[id]/host-qr.tsx" "app/(tabs)/(acara)/events/[id]/host-qr.tsx"
git mv "app/radar/[eventId].tsx" "app/(tabs)/(acara)/radar/[eventId].tsx"
git mv app/pesan/index.tsx "app/(tabs)/(pesan)/pesan/index.tsx"
git mv "app/pesan/[address].tsx" "app/(tabs)/(pesan)/pesan/[address].tsx"
git mv "app/pesan/lapor/[address].tsx" "app/(tabs)/(pesan)/pesan/lapor/[address].tsx"
git mv app/profil-saya.tsx "app/(tabs)/(profil)/profil-saya.tsx"
git mv app/connections.tsx "app/(tabs)/(profil)/connections.tsx"
git mv app/kecocokan.tsx "app/(tabs)/(profil)/kecocokan.tsx"
git mv app/dompet.tsx "app/(tabs)/(profil)/dompet.tsx"
git mv app/blokir.tsx "app/(tabs)/(profil)/blokir.tsx"
git mv app/qr.tsx components/salaman/mode-qr.tsx
git mv app/scan.tsx components/salaman/mode-pindai.tsx
git rm app/spike-bna.tsx
rmdir "app/events/[id]" app/events app/feed app/pesan/lapor app/pesan app/radar
cd ../..
```

Expected: setiap perintah berhasil; `rmdir` hanya menghapus direktori yang kini kosong (bila salah satu tidak kosong, `rmdir` gagal — laporkan isinya, jangan memakai `rm -r`).

- [ ] **Step 5: Sesuaikan impor relatif layar yang dipindah**

Setiap layar di grup tab kini dua tingkat lebih dalam; setiap impor relatif (semuanya berawalan `../`) mendapat `../../` tambahan:

```bash
cd apps/mobile
for f in "app/(tabs)/(beranda)/index.tsx" "app/(tabs)/(beranda)/feed/index.tsx" "app/(tabs)/(beranda)/feed/new.tsx" \
  "app/(tabs)/(acara)/events/index.tsx" "app/(tabs)/(acara)/events/new.tsx" "app/(tabs)/(acara)/events/[id].tsx" \
  "app/(tabs)/(acara)/events/[id]/host-qr.tsx" "app/(tabs)/(acara)/radar/[eventId].tsx" \
  "app/(tabs)/(pesan)/pesan/index.tsx" "app/(tabs)/(pesan)/pesan/[address].tsx" "app/(tabs)/(pesan)/pesan/lapor/[address].tsx" \
  "app/(tabs)/(profil)/profil-saya.tsx" "app/(tabs)/(profil)/connections.tsx" "app/(tabs)/(profil)/kecocokan.tsx" \
  "app/(tabs)/(profil)/dompet.tsx" "app/(tabs)/(profil)/blokir.tsx"; do
  perl -pi -e 's{((?:from|import) ")\.\./}{$1../../../}g' "$f"
done
grep -rhn 'from "\.\|import "\.' "app/(tabs)" | sed 's/.*from //' | sort | uniq -c | head -40
cd ../..
```

Expected: setiap jalur impor di `app/(tabs)/` kini diawali `../../../` (layar tingkat grup) atau lebih dalam, dan semuanya berakhir di `src/…`. (`mode-qr.tsx` dan `mode-pindai.tsx` ditulis ulang utuh di Step 9.)

- [ ] **Step 6: Tulis ulang `src/judul-layar.ts`**

Ganti SELURUH isi `apps/mobile/src/judul-layar.ts` dengan:

```ts
/**
 * Judul header untuk setiap layar, didaftarkan di layout: Stack akar lewat
 * layarMenurutDompet (app/_layout.tsx), setiap Stack tab lewat layarDalam
 * (components/stack-tab.tsx).
 *
 * Didaftarkan di layout — bukan lewat <Stack.Screen> di dalam layar — karena
 * yang di dalam layar baru berlaku setelah layar selesai memuat; selama spinner
 * tampil, header dan tombol kembali layar berikutnya memakai nama rute mentah
 * seperti "events/new". test/judul-layar.test.ts membuat layar baru yang lupa
 * didaftarkan di sini langsung merah.
 *
 * Kunci = jalur berkas relatif app/ tanpa .tsx, TERMASUK nama grup; nilai
 * berbahasa Inggris (spec desain UI §4.7, keputusan #15).
 */
export const JUDUL_LAYAR: Record<string, string> = {
  mulai: "Get started",
  "profile/[address]": "Profile",
  "(tabs)/(beranda)/index": "Home",
  "(tabs)/(beranda)/feed/index": "Feed",
  "(tabs)/(beranda)/feed/new": "New post",
  "(tabs)/(acara)/events/index": "Events",
  "(tabs)/(acara)/events/new": "Create event",
  "(tabs)/(acara)/events/[id]": "Event details",
  "(tabs)/(acara)/events/[id]/host-qr": "Check-in QR",
  "(tabs)/(acara)/radar/[eventId]": "Radar",
  "(tabs)/(salaman)/salaman": "Handshake",
  "(tabs)/(pesan)/pesan/index": "Messages",
  "(tabs)/(pesan)/pesan/[address]": "Conversation",
  "(tabs)/(pesan)/pesan/lapor/[address]": "Report",
  "(tabs)/(profil)/profil-saya": "Profile",
  "(tabs)/(profil)/connections": "Connections",
  "(tabs)/(profil)/kecocokan": "Matches",
  "(tabs)/(profil)/dompet": "Wallet",
  "(tabs)/(profil)/blokir": "Blocked",
};

/**
 * Layar Stack akar, dalam urutan ini (spec §4.2). `(tabs)` harus layar pertama
 * sisi dompet: expo-router menuju layar pertama yang diizinkan saat penjaga
 * berubah.
 */
export const LAYAR_AKAR = ["(tabs)", "mulai", "profile/[address]"] as const;

/**
 * Rute yang HANYA bisa dibuka saat HP belum punya dompet. Semua layar akar lain
 * hanya bisa dibuka saat dompet siap (gerbang Stack.Protected di app/_layout.tsx).
 */
export const RUTE_TANPA_DOMPET: readonly string[] = ["mulai"];

export type OpsiLayarAkar = { title: string } | { headerShown: false };

/**
 * Pasangan [layar, opsi] Stack akar untuk satu sisi gerbang dompet. `(tabs)`
 * adalah grup, bukan berkas: tanpa judul, tanpa header (header datang dari
 * Stack tiap tab).
 */
export function layarMenurutDompet(punyaDompet: boolean): [string, OpsiLayarAkar][] {
  return LAYAR_AKAR
    .filter((nama) => RUTE_TANPA_DOMPET.includes(nama) !== punyaDompet)
    .map((nama): [string, OpsiLayarAkar] => {
      if (nama === "(tabs)") return [nama, { headerShown: false }];
      const judul = JUDUL_LAYAR[nama];
      if (judul === undefined) throw new Error(`judul untuk ${nama} tidak ada`);
      return [nama, { title: judul }];
    });
}

export type NamaIkonTab = "House" | "CalendarDays" | "ArrowLeftRight" | "MessageCircle" | "CircleUser";

export type TabBawah = { grup: string; label: string; ikon: NamaIkonTab; layarAwal: string };

/**
 * Lima tab bawah (spec §4.3) — satu sumber untuk urutan, label Inggris, ikon
 * lucide, dan layar akar setiap tab (initialRouteName Stack-nya).
 */
export const TAB_BAWAH = [
  { grup: "(beranda)", label: "Home", ikon: "House", layarAwal: "index" },
  { grup: "(acara)", label: "Events", ikon: "CalendarDays", layarAwal: "events/index" },
  { grup: "(salaman)", label: "Handshake", ikon: "ArrowLeftRight", layarAwal: "salaman" },
  { grup: "(pesan)", label: "Messages", ikon: "MessageCircle", layarAwal: "pesan/index" },
  { grup: "(profil)", label: "Profile", ikon: "CircleUser", layarAwal: "profil-saya" },
] as const satisfies readonly TabBawah[];

export type GrupTab = (typeof TAB_BAWAH)[number]["grup"];

/**
 * Pasangan [nama relatif terhadap layout, judul] untuk satu _layout.tsx.
 * Layout pemilik sebuah kunci adalah folder _layout.tsx terdalam yang menjadi
 * awalan kuncinya (spec §4.7) — di pohon ini, Stack tab `(tabs)/(grup)`.
 */
export function layarDalam(induk: string): [string, string][] {
  const awalan = `${induk}/`;
  return Object.entries(JUDUL_LAYAR)
    .filter(([kunci]) => kunci.startsWith(awalan))
    .map(([kunci, judul]): [string, string] => [kunci.slice(awalan.length), judul]);
}

/**
 * Kunci JUDUL_LAYAR yang layarnya sudah dimigrasi ke tampilan baru (Rencana B).
 * Hanya layar ini yang mendapat latar isi gelap dari Stack (Ruling A2), dan
 * hanya layar ini yang dijaga penjaga tampilan baru (test/support/berkas.ts).
 * Rencana A: kosong.
 */
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([]);
```

- [ ] **Step 7: `theme/navigasi.ts` dan `StackTab`**

Ganti SELURUH isi `apps/mobile/theme/navigasi.ts` dengan:

```ts
import { Colors } from "./colors";
import { FONT } from "./globals";
import { LAYAR_TERMIGRASI, TAB_BAWAH } from "../src/judul-layar";

const warna = Colors.dark;

/**
 * `screenOptions` setiap Stack (spec desain UI §3.2): header dan judul dari
 * token. Garis bawah header memakai garis sistem native-stack — native-stack
 * tidak menerima warna garis.
 */
export const OPSI_STACK = {
  headerStyle: { backgroundColor: warna.background },
  headerTintColor: warna.text,
  headerTitleStyle: { fontFamily: FONT.semibold },
  headerLargeStyle: { backgroundColor: warna.background },
  headerLargeTitleStyle: { fontFamily: FONT.bold },
};

const KUNCI_BERANDA = "(tabs)/(beranda)/index";

/** Layar akar tab selain Beranda: header besar dengan judul di atas (spec §4.7). */
const AKAR_TAB_JUDUL_BESAR: ReadonlySet<string> = new Set(
  TAB_BAWAH.filter((t) => t.grup !== "(beranda)").map((t) => `(tabs)/${t.grup}/${t.layarAwal}`),
);

export type OpsiTampilan = {
  headerShown?: false;
  headerLargeTitle?: true;
  contentStyle?: { backgroundColor: string };
};

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR: Beranda tanpa header
 * (sapaan besar menggantikannya), layar akar tab lain berjudul besar, dan
 * latar isi gelap hanya untuk layar yang sudah dimigrasi (Ruling A2) — layar
 * lama memakai teks hitam bawaan yang tidak terbaca di atas `background`.
 */
export function opsiTampilan(kunci: string): OpsiTampilan {
  return {
    ...(kunci === KUNCI_BERANDA ? { headerShown: false as const } : {}),
    ...(AKAR_TAB_JUDUL_BESAR.has(kunci) ? { headerLargeTitle: true as const } : {}),
    ...(LAYAR_TERMIGRASI.has(kunci) ? { contentStyle: { backgroundColor: warna.background } } : {}),
  };
}
```

`apps/mobile/components/stack-tab.tsx`:

```tsx
import { Stack } from "expo-router";
import { OPSI_STACK, opsiTampilan } from "@/theme/navigasi";
import { layarDalam, type GrupTab } from "../src/judul-layar";

/**
 * Stack satu tab (spec desain UI §4.1, R2, Ruling A5). Judul setiap layar
 * didaftarkan dari layarDalam — alasannya di src/judul-layar.ts.
 */
export function StackTab({ grup }: { grup: GrupTab }) {
  const induk = `(tabs)/${grup}`;
  return (
    <Stack screenOptions={OPSI_STACK}>
      {layarDalam(induk).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title, ...opsiTampilan(`${induk}/${name}`) }} />
      ))}
    </Stack>
  );
}
```

Lima layout Stack tab:

`apps/mobile/app/(tabs)/(beranda)/_layout.tsx`:

```tsx
import { StackTab } from "@/components/stack-tab";

// Layar akar tab: tautan dalam (notifikasi, router.push lintas tab) tetap
// punya layar ini di bawahnya dan tombol kembali pulang ke sana (spec §4.1).
export const unstable_settings = { initialRouteName: "index" };

export default function LayoutBeranda() {
  return <StackTab grup="(beranda)" />;
}
```

`apps/mobile/app/(tabs)/(acara)/_layout.tsx`:

```tsx
import { StackTab } from "@/components/stack-tab";

// Layar akar tab: Radar yang dibuka dari notifikasi punya daftar Acara di
// bawahnya, dan tombol kembali pulang ke sana (spec §4.1, §4.5).
export const unstable_settings = { initialRouteName: "events/index" };

export default function LayoutAcara() {
  return <StackTab grup="(acara)" />;
}
```

`apps/mobile/app/(tabs)/(salaman)/_layout.tsx`:

```tsx
import { StackTab } from "@/components/stack-tab";

export const unstable_settings = { initialRouteName: "salaman" };

export default function LayoutSalaman() {
  return <StackTab grup="(salaman)" />;
}
```

`apps/mobile/app/(tabs)/(pesan)/_layout.tsx`:

```tsx
import { StackTab } from "@/components/stack-tab";

// Layar akar tab: Percakapan dan Lapor selalu punya daftar Pesan di bawahnya
// (spec §4.1, §4.5).
export const unstable_settings = { initialRouteName: "pesan/index" };

export default function LayoutPesan() {
  return <StackTab grup="(pesan)" />;
}
```

`apps/mobile/app/(tabs)/(profil)/_layout.tsx`:

```tsx
import { StackTab } from "@/components/stack-tab";

export const unstable_settings = { initialRouteName: "profil-saya" };

export default function LayoutProfil() {
  return <StackTab grup="(profil)" />;
}
```

- [ ] **Step 8: Tab bar**

`apps/mobile/components/tab/ikon-tab.tsx`:

```tsx
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";

/**
 * Ikon tab dengan lencana angka (Pesan) atau titik (Profil). Dirender di sini,
 * bukan lewat tabBarBadge, supaya lencana dibatasi 1,3× (spec desain UI §3.7,
 * Ruling A6).
 */
export function IkonTab({
  Ikon,
  warna,
  lencana = null,
  titik = false,
}: {
  Ikon: ComponentType<LucideProps>;
  warna: string;
  lencana?: string | null;
  titik?: boolean;
}) {
  const latarLencana = useColor("destructive");
  const teksLencana = useColor("background");

  return (
    <View style={s.wadah}>
      <Ikon color={warna} size={22} />
      {lencana ? (
        <View style={[s.lencana, { backgroundColor: latarLencana }]}>
          <Text variant="label" style={{ color: teksLencana }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {lencana}
          </Text>
        </View>
      ) : titik ? (
        <View style={[s.titik, { backgroundColor: latarLencana }]} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { width: 32, height: 24, alignItems: "center", justifyContent: "center" },
  lencana: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  titik: { position: "absolute", top: 0, right: 2, width: 8, height: 8, borderRadius: 4 },
});
```

`apps/mobile/components/tab/tombol-salaman.tsx`:

```tsx
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";

/**
 * Tombol Salaman di tengah tab bar (spec desain UI §3.4, §4.3, keputusan #3):
 * kotak primary 52×52 radius 14, naik 26 dari garis tab, cincin 5 px warna
 * latar tab bar. 52×52 sudah ≥ target sentuh 48 (§3.7).
 */
export function TombolSalaman({
  onPress,
  terpilih,
  label,
}: {
  onPress: (e: GestureResponderEvent) => void;
  terpilih: boolean;
  label: string;
}) {
  const primary = useColor("primary");
  const ikon = useColor("primaryForeground");
  const latarBar = useColor("input");

  return (
    <View style={s.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: terpilih }}
        style={[s.cincin, { backgroundColor: latarBar }]}
      >
        <View style={[s.tombol, { backgroundColor: primary }]}>
          <ArrowLeftRight color={ikon} size={24} />
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  slot: { flex: 1, alignItems: "center" },
  cincin: {
    marginTop: -UKURAN.naikSalaman,
    padding: UKURAN.cincinSalaman,
    borderRadius: RADIUS.salaman + UKURAN.cincinSalaman,
  },
  tombol: {
    width: UKURAN.tombolSalaman,
    height: UKURAN.tombolSalaman,
    borderRadius: RADIUS.salaman,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

`apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import type { ComponentType } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftRight, CalendarDays, CircleUser, House, MessageCircle, type LucideProps,
} from "lucide-react-native";
import { IkonTab } from "@/components/tab/ikon-tab";
import { TombolSalaman } from "@/components/tab/tombol-salaman";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL, UKURAN } from "@/theme/globals";
import { TAB_BAWAH, type NamaIkonTab } from "../../src/judul-layar";

const IKON: Record<NamaIkonTab, ComponentType<LucideProps>> = {
  House, CalendarDays, ArrowLeftRight, MessageCircle, CircleUser,
};

/**
 * Lima tab bawah (spec desain UI §4.3, keputusan #3). Setiap tab adalah Stack
 * sendiri di grupnya (R2); label, ikon, dan urutan dari TAB_BAWAH.
 */
export default function LayoutTabs() {
  const insets = useSafeAreaInsets();
  const aktif = useColor("primary");
  const redup = useColor("textMuted");
  const latarBar = useColor("input");
  const garis = useColor("border");
  const latar = useColor("background");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: aktif,
        tabBarInactiveTintColor: redup,
        // Tinggi = isi + inset bawah (home indicator iOS, bilah gestur Android — §3.7).
        tabBarStyle: {
          backgroundColor: latarBar,
          borderTopColor: garis,
          height: UKURAN.tinggiIsiTabBar + insets.bottom,
        },
        sceneStyle: { backgroundColor: latar },
      }}
    >
      {TAB_BAWAH.map((tab) => (
        <Tabs.Screen
          key={tab.grup}
          name={tab.grup}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
            tabBarLabel: ({ color }) => (
              <Text variant="label" style={{ color }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
                {tab.label}
              </Text>
            ),
            tabBarIcon: ({ color }) => <IkonTab Ikon={IKON[tab.ikon]} warna={String(color)} />,
            tabBarButton:
              tab.grup === "(salaman)"
                ? (props) => (
                    <TombolSalaman
                      label={tab.label}
                      terpilih={props.accessibilityState?.selected === true}
                      onPress={(e) => props.onPress?.(e)}
                    />
                  )
                : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 9: Layar Salaman dan kedua mode**

`apps/mobile/src/salaman-mode.ts`:

```ts
/** Mode layar Salaman (spec desain UI §6.2): "Show QR" (qr) atau "Scan" (pindai). */
export type ModeSalaman = "qr" | "pindai";

/** Label segmen — teks baru spec §7.3. */
export const PILIHAN_MODE_SALAMAN = [
  { nilai: "qr", label: "Show QR" },
  { nilai: "pindai", label: "Scan" },
] as const satisfies readonly { nilai: ModeSalaman; label: string }[];

/** `?mode=pindai` membuka Scan; selainnya Show QR. Parameter expo-router bisa berupa larik. */
export function modeSalamanDariParam(param: string | string[] | undefined): ModeSalaman {
  const nilai = Array.isArray(param) ? param[0] : param;
  return nilai === "pindai" ? "pindai" : "qr";
}
```

Ganti SELURUH isi `apps/mobile/components/salaman/mode-qr.tsx` (hasil `git mv` dari `app/qr.tsx`) dengan:

```tsx
import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { NearlySigner } from "../../src/signer";
import { useRotatingQr } from "../../src/handshake/useRotatingQr";

/**
 * Mode "Show QR" layar Salaman — isi app/qr.tsx lama, dipindah apa adanya
 * (spec desain UI §6.2, Ruling A10). Dipasang hanya saat tab Salaman fokus dan
 * mode ini aktif; melepasnya menghentikan useRotatingQr, dan memasangnya lagi
 * langsung membuat offer baru. Tampilan dan kalimat dimigrasi Rencana B 5(a).
 */
export function ModeQr({ signerSalaman }: { signerSalaman: NearlySigner }) {
  const { value, secondsLeft, error } = useRotatingQr(signerSalaman);

  if (error) return <View style={s.root}><Text style={s.err}>{error}</Text></View>;
  if (!value) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <QRCode value={value} size={260} />
      <Text style={s.hint}>Minta dia memindai ini. Berganti dalam {secondsLeft} detik.</Text>
      <Text style={s.addr} selectable>{signerSalaman.address}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  hint: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  addr: { fontFamily: "Courier", fontSize: 12, opacity: 0.5 },
  err: { fontSize: 15, textAlign: "center" },
});
```

Ganti SELURUH isi `apps/mobile/components/salaman/mode-pindai.tsx` (hasil `git mv` dari `app/scan.tsx`) dengan:

```tsx
import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, StyleSheet, Text, View } from "react-native";
import { checkInAcceptTypedData, decodeCheckInQr, decodeQr, isQrExpired } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import type { NearlySigner } from "../../src/signer";
import { getCurrentCell } from "../../src/location";
import { ApiError, postAccept } from "../../src/api";
import { eventErrorMessage, handshakeErrorMessage } from "../../src/messages";
import { postCheckIn } from "../../src/events-api";

/**
 * Mode "Scan" layar Salaman — isi app/scan.tsx lama, dipindah apa adanya
 * (spec desain UI §6.2, Ruling A10). Dua domain EIP-712: check-in terikat
 * AttendanceRegistry (`signerHadir`), salaman terikat ConnectionRegistry
 * (`signerSalaman`); keduanya diambil pembungkus layar — hook tidak boleh
 * dipanggil di dalam callback pemindai. Dipasang hanya saat tab Salaman fokus
 * (kamera dilepas saat pindah tab). Sheet "You met …", tampilan, dan kalimat
 * Inggris adalah Rencana B 5(a).
 */
export function ModePindai({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!permission?.granted) {
    return (
      <View style={s.root}>
        <Text style={s.p}>Nearly butuh kamera untuk memindai QR orang yang kamu temui.</Text>
        <Button title="Izinkan kamera" onPress={requestPermission} />
      </View>
    );
  }

  async function onScan(data: string) {
    if (busy) return;
    setBusy(true);
    try {
      // QR check-in dicoba LEBIH DULU. Keduanya JSON, dan hanya yang ini
      // membawa penanda k:"checkin" — jadi urutannya tidak ambigu, tapi
      // menaruhnya belakangan akan membuat alur yang salah berjalan duluan.
      const checkin = decodeCheckInQr(data);
      if (checkin) {
        try {
          if (Date.now() > Number(checkin.expiresAt) * 1000) {
            setResult(eventErrorMessage("expired"));
            return;
          }
          const signer = signerHadir;
          const { cell, atMs } = await getCurrentCell();
          const sigAttendee = await signer.signTypedData(
            checkInAcceptTypedData(
              {
                eventId: checkin.eventId, nonce: checkin.nonce,
                attendee: signer.address, expiresAt: checkin.expiresAt,
              },
              CONFIG.attendanceRegistry,
            ),
          );
          const { txHash } = await postCheckIn(checkin.eventId, {
            eventId: checkin.eventId, nonce: checkin.nonce, attendee: signer.address,
            expiresAt: checkin.expiresAt.toString(), sigAttendee, cell, atMs,
          });
          setResult(`Check-in berhasil. ${txHash.slice(0, 10)}…`);
        } catch (e) {
          setResult(
            e instanceof ApiError
              ? eventErrorMessage(e.code, e.reason)
              : e instanceof Error ? e.message : "Check-in gagal.",
          );
        }
        return;
      }

      const payload = decodeQr(data);
      if (!payload) {
        setResult("QR ini bukan QR Nearly.");
        return;
      }
      if (isQrExpired(payload, Date.now())) {
        setResult(handshakeErrorMessage("expired"));
        return;
      }

      const signer = signerSalaman;
      if (signer.address.toLowerCase() === payload.initiator.toLowerCase()) {
        setResult("Itu QR-mu sendiri.");
        return;
      }

      const { cell, atMs } = await getCurrentCell();
      const accept = {
        initiator: payload.initiator,
        counterparty: signer.address,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt,
      };
      const sigAccept = await signer.signAccept(accept);

      const { txHash } = await postAccept({
        initiator: payload.initiator,
        counterparty: signer.address,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt.toString(),
        sigAccept,
        cell,
        atMs,
      });
      setResult(`Terkoneksi. ${txHash.slice(0, 10)}…`);
    } catch (e) {
      setResult(
        e instanceof ApiError
          ? handshakeErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : "Handshake gagal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <CameraView
        style={s.cam}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void onScan(data)}
      />
      {result && <Text style={s.p}>{result}</Text>}
      {result && <Button title="Pindai lagi" onPress={() => setResult(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, gap: 16 },
  cam: { flex: 1, borderRadius: 16, overflow: "hidden" },
  p: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
```

(Satu-satunya perubahan terhadap `app/scan.tsx`: pembungkus dan `export default` hilang, `ScanIsi` → `ModePindai`, jalur impor `../src` → `../../src`, dan `padding: 16` di `root` dibuang karena layar Salaman sudah memberi tepi.)

`apps/mobile/app/(tabs)/(salaman)/salaman.tsx`:

```tsx
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused, useLocalSearchParams } from "expo-router";
import { ModePindai } from "@/components/salaman/mode-pindai";
import { ModeQr } from "@/components/salaman/mode-qr";
import { Segmen } from "@/components/segmen";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { modeSalamanDariParam, PILIHAN_MODE_SALAMAN, type ModeSalaman } from "../../../src/salaman-mode";

export default function SalamanScreen() {
  // Dua domain EIP-712: check-in terikat AttendanceRegistry, salaman terikat
  // ConnectionRegistry. Keduanya diambil di tingkat komponen — hook tidak boleh
  // dipanggil di dalam callback pemindai.
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const signerSalaman = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi tab ini masih
  // terpasang. Isi layar tidak dirender, supaya hook di dalamnya tidak pernah
  // berjalan tanpa signer (Ruling D4 spec dompet).
  if (!signerHadir || !signerSalaman) return null;
  return <SalamanIsi key={signerSalaman.address} signerHadir={signerHadir} signerSalaman={signerSalaman} />;
}

function SalamanIsi({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<ModeSalaman>(() => modeSalamanDariParam(modeParam));
  // Tab tetap terpasang saat berpindah tab: tautan "/salaman?mode=pindai"
  // berikutnya (Detail acara) mengganti mode lewat parameternya.
  useEffect(() => {
    if (modeParam !== undefined) setMode(modeSalamanDariParam(modeParam));
  }, [modeParam]);
  // R10: QR berputar dan kamera hanya berjalan saat tab ini fokus (spec §4.6).
  const fokus = useIsFocused();

  return (
    <View style={s.root}>
      <Segmen pilihan={PILIHAN_MODE_SALAMAN} nilai={mode} onGanti={setMode} />
      {fokus && (mode === "qr"
        ? <ModeQr signerSalaman={signerSalaman} />
        : <ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />)}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
});
```

- [ ] **Step 10: Root layout, Beranda lama, Detail acara**

Di `apps/mobile/app/_layout.tsx`, ganti KEDUA kemunculan (satu di tiap `Stack.Protected`)

```tsx
.map(([name, title]) => (
            <Stack.Screen key={name} name={name} options={{ title, ...opsiTampilan(name) }} />
```

dengan

```tsx
.map(([name, opsi]) => (
            <Stack.Screen key={name} name={name} options={{ ...opsi, ...opsiTampilan(name) }} />
```

dan ganti

```tsx
      if (rute) router.push(rute);
```

dengan

```tsx
      // navigate, bukan push: dengan (tabs) sebagai layar Stack akar, push bisa
      // menumpuk navigator tab kedua (Ruling A9). ruteDariNotifikasi tidak berubah.
      if (rute) router.navigate(rute);
```

Di `apps/mobile/app/(tabs)/(beranda)/index.tsx`, ganti

```tsx
      <Link href="/qr" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/scan" style={s.link}>Pindai QR orang lain</Link>
```

dengan

```tsx
      <Link href="/salaman" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/salaman?mode=pindai" style={s.link}>Pindai QR orang lain</Link>
```

dan hapus baris

```tsx
      <Link href="/spike-bna" style={s.link}>Spike BNA (sementara)</Link>
```

Di `apps/mobile/app/(tabs)/(acara)/events/[id].tsx`, ganti

```tsx
        : <Link href="/scan" style={s.aksi}>Pindai QR host untuk check-in</Link>}
```

dengan

```tsx
        : <Link href="/salaman?mode=pindai" style={s.aksi}>Pindai QR host untuk check-in</Link>}
```

- [ ] **Step 11: Jalankan tes, typecheck, dan ekspor**

```bash
pnpm --filter @nearly/mobile exec vitest run
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
git grep -n '"/qr"\|"/scan"\|spike-bna' -- apps/mobile
```

Expected: semua tes dan typecheck lulus; ekspor berakhir `Exported: …`; `git grep` kosong. Bila `tsc` menolak nama ikon lucide (`House`, `CalendarDays`, `ArrowLeftRight`, `MessageCircle`, `CircleUser`), laporkan nama yang ditolak dan padanan yang diekspor versi terpasang (`grep -o "declare const [A-Z][A-Za-z]*" apps/mobile/node_modules/lucide-react-native/dist/*.d.ts | grep -i "<nama>"`) — maknanya yang mengikat (spec §4.3), bukan namanya. Bila `tsc` menolak tipe `props.onPress` di `tabBarButton`, laporkan pesan galatnya persis.

- [ ] **Step 12: Commit**

```bash
git add "apps/mobile/app/(tabs)/_layout.tsx" "apps/mobile/app/(tabs)/(beranda)/_layout.tsx" \
  "apps/mobile/app/(tabs)/(acara)/_layout.tsx" "apps/mobile/app/(tabs)/(salaman)/_layout.tsx" \
  "apps/mobile/app/(tabs)/(pesan)/_layout.tsx" "apps/mobile/app/(tabs)/(profil)/_layout.tsx" \
  "apps/mobile/app/(tabs)/(salaman)/salaman.tsx" \
  "apps/mobile/app/(tabs)/(beranda)/index.tsx" "apps/mobile/app/(tabs)/(beranda)/feed/index.tsx" \
  "apps/mobile/app/(tabs)/(beranda)/feed/new.tsx" "apps/mobile/app/(tabs)/(acara)/events/index.tsx" \
  "apps/mobile/app/(tabs)/(acara)/events/new.tsx" "apps/mobile/app/(tabs)/(acara)/events/[id].tsx" \
  "apps/mobile/app/(tabs)/(acara)/events/[id]/host-qr.tsx" "apps/mobile/app/(tabs)/(acara)/radar/[eventId].tsx" \
  "apps/mobile/app/(tabs)/(pesan)/pesan/index.tsx" "apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx" \
  "apps/mobile/app/(tabs)/(pesan)/pesan/lapor/[address].tsx" "apps/mobile/app/(tabs)/(profil)/profil-saya.tsx" \
  "apps/mobile/app/(tabs)/(profil)/connections.tsx" "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx" \
  "apps/mobile/app/(tabs)/(profil)/dompet.tsx" "apps/mobile/app/(tabs)/(profil)/blokir.tsx" \
  apps/mobile/app/_layout.tsx apps/mobile/components/salaman/mode-qr.tsx apps/mobile/components/salaman/mode-pindai.tsx \
  apps/mobile/components/stack-tab.tsx apps/mobile/components/tab/ikon-tab.tsx apps/mobile/components/tab/tombol-salaman.tsx \
  apps/mobile/src/judul-layar.ts apps/mobile/src/salaman-mode.ts apps/mobile/theme/navigasi.ts \
  apps/mobile/test/judul-layar.test.ts apps/mobile/test/rute-push.test.ts apps/mobile/test/tautan.test.ts \
  apps/mobile/test/salaman-mode.test.ts apps/mobile/test/dompet-tanpa-kunci-dev.test.ts \
  apps/mobile/test/aksesibilitas.test.ts apps/mobile/test/support/berkas.ts apps/mobile/test/support/rute.ts
git status --short   # WAJIB kosong (git mv dan git rm Step 4 sudah ter-stage)
git commit -m "feat(mobile): navigasi lima tab — Stack per tab, layar Salaman gabungan, judul Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git show --stat HEAD | grep -c "=>"   # rename terdeteksi: minimal 16
```

- [ ] **Step 13: Mutasi — layar tanpa judul**

Di `apps/mobile/src/judul-layar.ts`, hapus baris `  "(tabs)/(profil)/blokir": "Blocked",`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts`
Expected: FAIL — minimal `judul layar > setiap berkas layar di app/ punya judul` dan `judul layar > judul persis spec desain UI §4.7`. Rekam, lalu `git checkout -- apps/mobile/src/judul-layar.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 14: Mutasi — kamera berjalan saat tab tidak fokus**

Di `apps/mobile/app/(tabs)/(salaman)/salaman.tsx`, ganti `      {fokus && (mode === "qr"` dengan `      {(mode === "qr"`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman-mode.test.ts`
Expected: FAIL — `mode layar Salaman (spec desain UI §6.2) > isi mode dirender hanya saat tab fokus, di komponen isi (R10)`. Rekam, lalu `git checkout -- "apps/mobile/app/(tabs)/(salaman)/salaman.tsx"`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 15: Mutasi — tautan ke rute yang hilang**

Di `apps/mobile/app/(tabs)/(acara)/events/[id].tsx`, ganti `href="/salaman?mode=pindai"` dengan `href="/scan"`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/tautan.test.ts`
Expected: FAIL — `tautan > setiap tautan statis menunjuk rute yang ada` dan `tautan > tidak ada lagi /qr atau /scan`. Rekam, lalu `git checkout -- "apps/mobile/app/(tabs)/(acara)/events/[id].tsx"`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 9: Lencana tab

**Files:**
- Create: `apps/mobile/src/lencana/lencana-tab.ts`, `apps/mobile/src/lencana/konteks-lencana.tsx`, `apps/mobile/test/lencana-tab.test.ts`
- Rewrite: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/(beranda)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`, `apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx`, `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`

**Interfaces:**
- Consumes: `IkonTab`, `TombolSalaman`, `TAB_BAWAH`, `NamaIkonTab` (Task 8); `getKecocokan`, `kueriBuktiKecocokan`, `sesiPesan`, `getBelumDibaca`, `teksLencana`, `useNearlySigner`, `CONFIG` (sudah ada).
- Produces:
  - `src/lencana/lencana-tab.ts`: `JEDA_LENCANA_MS = 30_000`, `type AngkaLencana = { belumDibaca: number; kecocokanBaru: number }`, `LENCANA_KOSONG`, `bolehMuatLencana(terakhirMs: number | null, sekarangMs: number, paksa: boolean): boolean`
  - `src/lencana/konteks-lencana.tsx`: `type NilaiLencana = AngkaLencana & { muatUlangLencana: () => void; muatBilaPerlu: () => void }`, `useLencanaTab(signer: NearlySigner): NilaiLencana` (dipanggil SEKALI, di `(tabs)/_layout.tsx`), `PenyediaLencana({ nilai, children })`, `useLencana(): NilaiLencana`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/lencana-tab.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bolehMuatLencana, JEDA_LENCANA_MS, LENCANA_KOSONG } from "../src/lencana/lencana-tab";
import { baca } from "./support/berkas";

describe("bolehMuatLencana (spec desain UI §4.4)", () => {
  it("pemuatan pertama selalu boleh", () => {
    expect(bolehMuatLencana(null, 0, false)).toBe(true);
  });

  it("paling sering sekali per 30 detik", () => {
    expect(JEDA_LENCANA_MS).toBe(30_000);
    expect(bolehMuatLencana(1_000, 1_000 + JEDA_LENCANA_MS - 1, false)).toBe(false);
    expect(bolehMuatLencana(1_000, 1_000 + JEDA_LENCANA_MS, false)).toBe(true);
  });

  it("paksa (setelah menandai dibaca/dilihat) melewati batas", () => {
    expect(bolehMuatLencana(1_000, 1_001, true)).toBe(true);
  });

  it("angka awal nol", () => {
    expect(LENCANA_KOSONG).toEqual({ belumDibaca: 0, kecocokanBaru: 0 });
  });
});

describe("pemasangan lencana tab", () => {
  it("layout tab memasang useLencanaTab di isi dan membagikannya lewat konteks", () => {
    const isi = baca("app/(tabs)/_layout.tsx");
    expect(isi).toContain("const lencana = useLencanaTab(signer);");
    expect(isi).toContain("<PenyediaLencana nilai={lencana}>");
    expect(isi).toContain("screenListeners={{ focus: () => lencana.muatBilaPerlu() }}");
    expect(isi).toContain('tab.grup === "(pesan)" ? teksLencana(lencana.belumDibaca) : null');
    expect(isi).toContain('tab.grup === "(profil)" && lencana.kecocokanBaru > 0');
  });

  it("kegagalan masing-masing angka menjadi 0 tanpa galat", () => {
    const isi = baca("src/lencana/konteks-lencana.tsx");
    expect(isi.match(/\.catch\(\(\) => 0\)/g)?.length).toBe(2);
    expect(isi).toContain('AppState.addEventListener("change"');
  });

  it("Kecocokan dan Percakapan memuat ulang lencana setelah menandai", () => {
    expect(baca("app/(tabs)/(profil)/kecocokan.tsx"))
      .toMatch(/await tandaiKecocokanDilihat\(signer\)\.catch\(\(\) => \{\}\);[\s\S]{0,200}?muatUlangLencana\(\);/);
    expect(baca("app/(tabs)/(pesan)/pesan/[address].tsx"))
      .toMatch(/await postDibaca\(sesi, lawan, masukTerbaru\.createdAtMs\);[\s\S]{0,300}?muatUlangLencana\(\);/);
  });

  it("Beranda tidak lagi menandatangani bukti sendiri untuk lencana", () => {
    const isi = baca("app/(tabs)/(beranda)/index.tsx");
    expect(isi).not.toMatch(/getBelumDibaca|kueriBuktiKecocokan|sesiPesan/);
    expect(isi).toContain("useLencana()");
  });
});
```

Di `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, di dalam objek `HARAPAN`, ganti

```ts
    const HARAPAN: Record<string, string[]> = {
      "app/(tabs)/(acara)/events/[id].tsx": ["signer:attendanceRegistry"],
```

dengan

```ts
    const HARAPAN: Record<string, string[]> = {
      // Pemakai signer untuk lencana tab (spec desain UI §4.4, §10.1).
      "app/(tabs)/_layout.tsx": [`signer:${V}`],
      "app/(tabs)/(acara)/events/[id].tsx": ["signer:attendanceRegistry"],
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/lencana-tab.test.ts test/dompet-tanpa-kunci-dev.test.ts`
Expected: FAIL — `../src/lencana/lencana-tab` tidak ada, dan `HARAPAN` memuat `app/(tabs)/_layout.tsx` yang belum memakai signer.

- [ ] **Step 3: Logika dan konteks lencana**

`apps/mobile/src/lencana/lencana-tab.ts`:

```ts
/** Lencana tab dimuat paling sering sekali per 30 detik (spec desain UI §4.4). */
export const JEDA_LENCANA_MS = 30_000;

export type AngkaLencana = { belumDibaca: number; kecocokanBaru: number };

export const LENCANA_KOSONG: AngkaLencana = { belumDibaca: 0, kecocokanBaru: 0 };

/** Murni. `paksa` — setelah menandai dibaca/dilihat — melewati batas 30 detik. */
export function bolehMuatLencana(terakhirMs: number | null, sekarangMs: number, paksa: boolean): boolean {
  return paksa || terakhirMs === null || sekarangMs - terakhirMs >= JEDA_LENCANA_MS;
}
```

`apps/mobile/src/lencana/konteks-lencana.tsx`:

```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { NearlySigner } from "../signer";
import { getKecocokan, kueriBuktiKecocokan } from "../meet-api";
import { sesiPesan } from "../pesan/sesi";
import { getBelumDibaca } from "../pesan/pesan-api";
import { bolehMuatLencana, LENCANA_KOSONG, type AngkaLencana } from "./lencana-tab";

export type NilaiLencana = AngkaLencana & {
  /** Muat ulang SEKARANG, melewati batas 30 detik — dipanggil setelah menandai dibaca/dilihat. */
  muatUlangLencana: () => void;
  /** Muat bila sudah lewat 30 detik — dipanggil saat tab aktif berganti. */
  muatBilaPerlu: () => void;
};

const KonteksLencana = createContext<NilaiLencana>({
  ...LENCANA_KOSONG,
  muatUlangLencana: () => {},
  muatBilaPerlu: () => {},
});

/**
 * Angka lencana tab Pesan (belum dibaca) dan Profil (kecocokan baru) — spec
 * desain UI §4.4, pengganti lencana di daftar tautan beranda lama. Dipanggil
 * SEKALI, di (tabs)/_layout.tsx (pola pembungkus: signer tidak pernah null di
 * sini). Dimuat saat terpasang, saat tab aktif berganti, dan saat aplikasi
 * kembali ke depan; paling sering sekali per 30 detik.
 *
 * Satu tanda tangan per pemuatan untuk tiap angka — ongkos yang dipilih sadar
 * (spec §6.2 Fase 3c): endpoint hitung tanpa autentikasi akan membocorkan
 * berapa kecocokan dimiliki sebuah alamat. Dompet di HP menandatangani tanpa
 * jendela konfirmasi (spec dompet §3).
 */
export function useLencanaTab(signer: NearlySigner): NilaiLencana {
  const [angka, setAngka] = useState<AngkaLencana>(LENCANA_KOSONG);
  const terakhirMs = useRef<number | null>(null);
  const terpasang = useRef(true);
  useEffect(() => () => { terpasang.current = false; }, []);

  const muat = useCallback((paksa: boolean) => {
    const sekarang = Date.now();
    if (!bolehMuatLencana(terakhirMs.current, sekarang, paksa)) return;
    terakhirMs.current = sekarang;
    // Fungsi async DI DALAM callback, bukan callback yang async. Masing-masing
    // angka gagal sendiri menjadi 0: lencana tidak boleh menggagalkan apa pun.
    void (async () => {
      const [kecocokanBaru, belumDibaca] = await Promise.all([
        (async () => (await getKecocokan(await kueriBuktiKecocokan(signer))).baru)().catch(() => 0),
        (async () => (await getBelumDibaca(await sesiPesan(signer))).total)().catch(() => 0),
      ]);
      if (terpasang.current) setAngka({ belumDibaca, kecocokanBaru });
    })();
  }, [signer]);

  useEffect(() => { muat(false); }, [muat]);

  useEffect(() => {
    const langganan = AppState.addEventListener("change", (s) => { if (s === "active") muat(false); });
    return () => langganan.remove();
  }, [muat]);

  const muatUlangLencana = useCallback(() => muat(true), [muat]);
  const muatBilaPerlu = useCallback(() => muat(false), [muat]);

  return useMemo(
    () => ({ ...angka, muatUlangLencana, muatBilaPerlu }),
    [angka, muatUlangLencana, muatBilaPerlu],
  );
}

export function PenyediaLencana({ nilai, children }: { nilai: NilaiLencana; children: ReactNode }) {
  return <KonteksLencana.Provider value={nilai}>{children}</KonteksLencana.Provider>;
}

/** Angka lencana dan pemuat ulang untuk layar di dalam (tabs). */
export function useLencana(): NilaiLencana {
  return useContext(KonteksLencana);
}
```

- [ ] **Step 4: Tulis ulang `(tabs)/_layout.tsx` dengan pembungkus dan lencana**

Ganti SELURUH isi `apps/mobile/app/(tabs)/_layout.tsx` dengan:

```tsx
import type { ComponentType } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftRight, CalendarDays, CircleUser, House, MessageCircle, type LucideProps,
} from "lucide-react-native";
import { IkonTab } from "@/components/tab/ikon-tab";
import { TombolSalaman } from "@/components/tab/tombol-salaman";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../src/config";
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
import { TAB_BAWAH, type NamaIkonTab } from "../../src/judul-layar";
import { PenyediaLencana, useLencanaTab } from "../../src/lencana/konteks-lencana";
import { teksLencana } from "../../src/messages";

const IKON: Record<NamaIkonTab, ComponentType<LucideProps>> = {
  House, CalendarDays, ArrowLeftRight, MessageCircle, CircleUser,
};

export default function LayoutTabs() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, sebelum penjaga
  // melepas (tabs). Isi tidak dirender, supaya useLencanaTab tidak pernah
  // berjalan tanpa signer (Ruling D4 spec dompet, spec desain UI §4.2).
  if (!signer) return null;
  return <LayoutTabsIsi key={signer.address} signer={signer} />;
}

/**
 * Lima tab bawah (spec desain UI §4.3, keputusan #3). Setiap tab adalah Stack
 * sendiri di grupnya (R2); label, ikon, dan urutan dari TAB_BAWAH. Lencana
 * Pesan dan titik Profil dari useLencanaTab (§4.4).
 */
function LayoutTabsIsi({ signer }: { signer: NearlySigner }) {
  const lencana = useLencanaTab(signer);
  const insets = useSafeAreaInsets();
  const aktif = useColor("primary");
  const redup = useColor("textMuted");
  const latarBar = useColor("input");
  const garis = useColor("border");
  const latar = useColor("background");

  return (
    <PenyediaLencana nilai={lencana}>
      <Tabs
        screenListeners={{ focus: () => lencana.muatBilaPerlu() }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: aktif,
          tabBarInactiveTintColor: redup,
          // Tinggi = isi + inset bawah (home indicator iOS, bilah gestur Android — §3.7).
          tabBarStyle: {
            backgroundColor: latarBar,
            borderTopColor: garis,
            height: UKURAN.tinggiIsiTabBar + insets.bottom,
          },
          sceneStyle: { backgroundColor: latar },
        }}
      >
        {TAB_BAWAH.map((tab) => (
          <Tabs.Screen
            key={tab.grup}
            name={tab.grup}
            options={{
              title: tab.label,
              tabBarAccessibilityLabel: tab.label,
              tabBarLabel: ({ color }) => (
                <Text variant="label" style={{ color }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
                  {tab.label}
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                <IkonTab
                  Ikon={IKON[tab.ikon]}
                  warna={String(color)}
                  lencana={tab.grup === "(pesan)" ? teksLencana(lencana.belumDibaca) : null}
                  titik={tab.grup === "(profil)" && lencana.kecocokanBaru > 0}
                />
              ),
              tabBarButton:
                tab.grup === "(salaman)"
                  ? (props) => (
                      <TombolSalaman
                        label={tab.label}
                        terpilih={props.accessibilityState?.selected === true}
                        onPress={(e) => props.onPress?.(e)}
                      />
                    )
                  : undefined,
            }}
          />
        ))}
      </Tabs>
    </PenyediaLencana>
  );
}
```

- [ ] **Step 5: Beranda lama membaca lencana dari konteks**

Ganti SELURUH isi `apps/mobile/app/(tabs)/(beranda)/index.tsx` dengan (daftar tautan lama tetap; Rencana B 5(b) menggantinya dengan Beranda baru):

```tsx
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useDompet, useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { perluPengingatCadangan, TEKS_PENGINGAT_CADANGAN } from "../../../src/dompet/teks-dompet";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import { teksLencana } from "../../../src/messages";

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
  // Angka lencana dari (tabs)/_layout.tsx (spec desain UI §4.4, Ruling A11):
  // beranda tidak lagi menandatangani bukti sendiri hanya untuk lencana.
  const { belumDibaca, kecocokanBaru } = useLencana();
  const lencana = teksLencana(kecocokanBaru);
  const lencanaPesan = teksLencana(belumDibaca);

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      {pengingatCadangan && (
        <Link href="/dompet" style={s.spanduk}>{TEKS_PENGINGAT_CADANGAN}</Link>
      )}
      <Link href="/salaman" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/salaman?mode=pindai" style={s.link}>Pindai QR orang lain</Link>
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

- [ ] **Step 6: Kecocokan dan Percakapan memuat ulang lencana**

Di `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`, ganti

```tsx
import { meetErrorMessage } from "../../../src/messages";
```

dengan

```tsx
import { meetErrorMessage } from "../../../src/messages";
import { useLencana } from "../../../src/lencana/konteks-lencana";
```

ganti

```tsx
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
```

dengan

```tsx
  const [pesan, setPesan] = useState<string | null>(null);
  const { muatUlangLencana } = useLencana();

  const muat = useCallback(async () => {
```

ganti

```tsx
      await tandaiKecocokanDilihat(signer).catch(() => {});
    } catch (e) {
```

dengan

```tsx
      await tandaiKecocokanDilihat(signer).catch(() => {});
      // Titik lencana tab Profil hilang sekarang, bukan 30 detik lagi (spec desain UI §4.4).
      muatUlangLencana();
    } catch (e) {
```

dan ganti

```tsx
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : "Kecocokan gagal dimuat.");
    }
  }, [signer]);
```

dengan

```tsx
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : "Kecocokan gagal dimuat.");
    }
  }, [signer, muatUlangLencana]);
```

Di `apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx`, ganti

```tsx
import { getRiwayat, postDibaca } from "../../../../src/pesan/pesan-api";
```

dengan

```tsx
import { getRiwayat, postDibaca } from "../../../../src/pesan/pesan-api";
import { useLencana } from "../../../../src/lencana/konteks-lencana";
```

ganti

```tsx
  const layarAktif = useRef(false);
```

dengan

```tsx
  const layarAktif = useRef(false);
  const { muatUlangLencana } = useLencana();
```

ganti

```tsx
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
    }
  }, [signer, lawan]);
```

dengan

```tsx
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
      // Lencana tab Pesan turun sekarang, bukan 30 detik lagi (spec desain UI §4.4).
      muatUlangLencana();
    }
  }, [signer, lawan, muatUlangLencana]);
```

- [ ] **Step 7: Jalankan tes, typecheck, dan ekspor**

```bash
pnpm --filter @nearly/mobile exec vitest run
pnpm --filter @nearly/mobile exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: semua lulus; ekspor `Exported: …`.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lencana/lencana-tab.ts apps/mobile/src/lencana/konteks-lencana.tsx \
  "apps/mobile/app/(tabs)/_layout.tsx" "apps/mobile/app/(tabs)/(beranda)/index.tsx" \
  "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx" "apps/mobile/app/(tabs)/(pesan)/pesan/[address].tsx" \
  apps/mobile/test/lencana-tab.test.ts apps/mobile/test/dompet-tanpa-kunci-dev.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): lencana tab Pesan dan Profil — sekali per 30 detik, dimuat ulang setelah dibaca

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — batas 30 detik diabaikan**

Di `apps/mobile/src/lencana/lencana-tab.ts`, ganti `  return paksa || terakhirMs === null || sekarangMs - terakhirMs >= JEDA_LENCANA_MS;` dengan `  return true;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/lencana-tab.test.ts`
Expected: FAIL — `bolehMuatLencana (spec desain UI §4.4) > paling sering sekali per 30 detik`. Rekam, lalu `git checkout -- apps/mobile/src/lencana/lencana-tab.ts`, jalankan ulang (PASS), `git status --short` kosong.

---
## Task 10: API — `PertemuanStore` dan fake Supabase yang lebih lengkap

**Files:**
- Modify: `apps/api/src/ports.ts` (blok baru di akhir), `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/support/supabase-memori.ts`, `apps/api/test/support/deps.ts`, `apps/api/test/handshake.route.test.ts`
- Create: `apps/api/src/pertemuan-store.ts`, `apps/api/test/pertemuan-store.test.ts`, `apps/api/test/pertemuan-ports.test.ts`

**Interfaces:**
- Consumes: `fetchAllPages` (`src/trust/store.ts`), `potongKelompok` (`src/feed-store.ts`), `supabaseMemori` (`test/support/supabase-memori.ts`).
- Produces:
  - `ports.ts`: `type AcaraRingkas = { eventId: Hex; title: string; venueLabel: string; centerCell: string; startsAt: number; endsAt: number }` (detik unix), `type KoneksiPasangan = { atMs: number; cell: string | null }`, `type PertemuanStore = { koneksiPasangan(a, b): Promise<KoneksiPasangan | null>; acaraCheckInBersama(a, b): Promise<AcaraRingkas[]>; penjaminAktif(to): Promise<Address[]> }`, `METODE_PERTEMUAN_STORE`
  - `pertemuan-store.ts`: `createPertemuanStore(db: SupabaseClient): PertemuanStore`, `rowToAcaraRingkas(r)`
  - `app.ts`: `TrustDeps.pertemuan: PertemuanStore`
  - `supabase-memori.ts`: tambahan `in(kolom, nilai[])`, `order(kolom, { ascending? })`, `range(dari, sampai)`, `maybeSingle()`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/pertemuan-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_PERTEMUAN_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode harus jadi tindakan sadar, karena
 * support/deps.ts, handshake.route.test.ts, dan dunia-pertemuan.ts ikut berubah.
 */
describe("bentuk PertemuanStore", () => {
  it("daftar metode PertemuanStore persis seperti yang tercatat", () => {
    expect(METODE_PERTEMUAN_STORE).toEqual(["koneksiPasangan", "acaraCheckInBersama", "penjaminAktif"]);
  });
});
```

`apps/api/test/pertemuan-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { createPertemuanStore } from "../src/pertemuan-store";
import { supabaseMemori } from "./support/supabase-memori";

const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const ev = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const barisAcara = (n: number) => ({
  event_id: ev(n), host: a(0xdead), title: `Acara ${n}`, venue_label: "Kalibata", center_cell: "qqguv1r",
  starts_at: 1_700_000_000 + n, ends_at: 1_700_003_600 + n, tx_hash: "0xtx",
});

// Pemetaan store riwayat pertemuan (spec desain UI §8.1, §8.2, §10.2).
describe("createPertemuanStore", () => {
  it("koneksiPasangan membaca satu baris kanonik untuk kedua urutan argumen", async () => {
    const { db } = supabaseMemori({
      connections: [{
        id: 1, addr_a: a(1), addr_b: a(2), nonce: "0x1", tx_hash: "0xtx",
        created_at: "2023-11-14T22:13:20.000Z", cell: "qqguv1r",
      }],
    });
    const store = createPertemuanStore(db);
    const harapan = { atMs: 1_700_000_000_000, cell: "qqguv1r" };
    expect(await store.koneksiPasangan(a(1), a(2))).toEqual(harapan);
    expect(await store.koneksiPasangan(a(2), a(1))).toEqual(harapan);
  });

  it("koneksiPasangan: tanpa baris → null; koneksi lama tanpa sel → cell null", async () => {
    const { db } = supabaseMemori({
      connections: [{ id: 1, addr_a: a(1), addr_b: a(2), created_at: "2023-11-14T22:13:20.000Z", cell: null }],
    });
    const store = createPertemuanStore(db);
    expect(await store.koneksiPasangan(a(1), a(3))).toBeNull();
    expect(await store.koneksiPasangan(a(2), a(1))).toEqual({ atMs: 1_700_000_000_000, cell: null });
  });

  it("acaraCheckInBersama melewati batas halaman 1000 dan hanya memuat acara yang keduanya check-in", async () => {
    const N = 1001;
    const events = Array.from({ length: N + 2 }, (_, i) => barisAcara(i + 1));
    const checkins = [
      ...Array.from({ length: N }, (_, i) => [
        { event_id: ev(i + 1), address: a(1) },
        { event_id: ev(i + 1), address: a(2) },
      ]).flat(),
      { event_id: ev(N + 1), address: a(1) },
      { event_id: ev(N + 2), address: a(2) },
    ];
    const { db } = supabaseMemori({ events, checkins });
    const hasil = await createPertemuanStore(db).acaraCheckInBersama(a(1), a(2));
    expect(hasil).toHaveLength(N);
    const id = new Set(hasil.map((h) => h.eventId));
    expect(id.has(ev(N + 1))).toBe(false);
    expect(id.has(ev(N + 2))).toBe(false);
    expect(hasil.find((h) => h.eventId === ev(7))).toEqual({
      eventId: ev(7), title: "Acara 7", venueLabel: "Kalibata", centerCell: "qqguv1r",
      startsAt: 1_700_000_007, endsAt: 1_700_003_607,
    });
  });

  it("penjaminAktif hanya vouch yang belum dicabut, huruf kecil", async () => {
    const { db } = supabaseMemori({
      vouches: [
        { from_addr: a(3), to_addr: a(2), revoked_at: null },
        { from_addr: a(4), to_addr: a(2), revoked_at: "2023-11-14T22:13:20.000Z" },
        { from_addr: a(5), to_addr: a(6), revoked_at: null },
      ],
    });
    expect(await createPertemuanStore(db).penjaminAktif(a(2))).toEqual([a(3)]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/pertemuan-ports.test.ts test/pertemuan-store.test.ts`
Expected: FAIL — `METODE_PERTEMUAN_STORE` tidak diekspor; `../src/pertemuan-store` tidak ada.

- [ ] **Step 3: Port baru di `ports.ts`**

Tambahkan di AKHIR `apps/api/src/ports.ts` (blok yang ada tidak diubah):

```ts

// ── Desain UI (spec 2026-09-18 §8): riwayat pertemuan dan penjamin ──────────
//
// Blok baru; blok yang ada tidak diubah (preseden radar-store.ts). Store ini
// hanya MEMBACA `connections`, `checkins`, `events`, dan `vouches` — tabel
// milik store lain — seperti `RadarStore.terhubungDengan` dan
// `MeetStore.profilRingkas`. Tidak ada migrasi (R3).

/**
 * Satu acara ringkas untuk riwayat pertemuan. `startsAt`/`endsAt` unix DETIK.
 * `centerCell` hanya untuk geofence di server — TIDAK PERNAH dikirim ke HP.
 */
export type AcaraRingkas = {
  eventId: Hex;
  title: string;
  venueLabel: string;
  centerCell: string;
  startsAt: number;
  endsAt: number;
};

/** Baris `connections` satu pasangan. `cell` null untuk koneksi lama tanpa sel. */
export type KoneksiPasangan = { atMs: number; cell: string | null };

export type PertemuanStore = {
  /** Satu baris lewat `connections_unique_pair`; urutan argumen bebas. */
  koneksiPasangan(a: Address, b: Address): Promise<KoneksiPasangan | null>;
  /** Acara yang KEDUANYA check-in. Urutan tidak dijamin. Berhalaman penuh. */
  acaraCheckInBersama(a: Address, b: Address): Promise<AcaraRingkas[]>;
  /** Penjamin dengan vouch AKTIF (`revoked_at is null`) ke `to`, huruf kecil. */
  penjaminAktif(to: Address): Promise<Address[]>;
};

export const METODE_PERTEMUAN_STORE = [
  "koneksiPasangan", "acaraCheckInBersama", "penjaminAktif",
] as const satisfies readonly (keyof PertemuanStore)[];

type SisaMetodePertemuanStore = Exclude<keyof PertemuanStore, (typeof METODE_PERTEMUAN_STORE)[number]>;
type AssertNeverPertemuan<T extends never> = T;
type _PastikanMetodePertemuanStoreLengkap = AssertNeverPertemuan<SisaMetodePertemuanStore>;
```

- [ ] **Step 4: Perluas `supabase-memori.ts`**

Ganti SELURUH isi `apps/api/test/support/supabase-memori.ts` dengan:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Baris = Record<string, unknown>;

/**
 * Supabase di memori yang MENJALANKAN kueri, bukan hanya merekamnya — cukup
 * untuk `select`, `delete`, dan `update` dengan filter `eq`, `lt`, `gte`, `in`,
 * `is(null)`, dan `not(kolom, "is", null)`, ditambah `order`, `range`, dan
 * `maybeSingle` untuk select. Dipakai tes privasi retensi dan tes pemetaan
 * store: yang ingin dibuktikan adalah ISI tabel dan jawaban, bukan bentuk
 * kuerinya.
 *
 * Perbandingan `lt`/`gte`: angka dan string angka dibandingkan sebagai angka
 * (`expires_at` bigint), selain itu sebagai waktu ISO (`seen_at`, `sent_at`).
 * `order`: angka sebagai angka, selain itu sebagai string. Kolom di
 * `select(...)` tidak disaring — store yang diuji memetakan kolomnya sendiri.
 * Setiap `from()` tercatat di `tabelDisentuh`.
 */
export function supabaseMemori(awal: Record<string, Baris[]>) {
  const tabel: Record<string, Baris[]> = Object.fromEntries(
    Object.entries(awal).map(([n, rows]) => [n, rows.map((r) => ({ ...r }))]),
  );
  const tabelDisentuh: { tabel: string; op: string }[] = [];

  const nilai = (v: unknown): number =>
    typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));

  const banding = (x: unknown, y: unknown): number =>
    typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;

  function kueri(nama: string) {
    const filter: ((r: Baris) => boolean)[] = [];
    let op: "select" | "delete" | "update" = "select";
    let perubahan: Baris = {};
    let hitung = false;
    let urut: { kolom: string; naik: boolean } | null = null;
    let rentang: [number, number] | null = null;
    let tunggal = false;

    const rantai = {
      select: () => { op = "select"; return rantai; },
      delete: (o?: { count?: string }) => { op = "delete"; hitung = o?.count === "exact"; return rantai; },
      update: (v: Baris, o?: { count?: string }) => { op = "update"; perubahan = v; hitung = o?.count === "exact"; return rantai; },
      eq: (k: string, v: unknown) => { filter.push((r) => r[k] === v); return rantai; },
      lt: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) < nilai(v)); return rantai; },
      gte: (k: string, v: unknown) => { filter.push((r) => nilai(r[k]) >= nilai(v)); return rantai; },
      in: (k: string, v: unknown[]) => { filter.push((r) => v.includes(r[k])); return rantai; },
      is: (k: string, v: null) => { filter.push((r) => r[k] === v); return rantai; },
      not: (k: string, o: string, v: null) => {
        if (o !== "is" || v !== null) throw new Error(`not(${k}, ${o}) tidak didukung`);
        filter.push((r) => r[k] !== null);
        return rantai;
      },
      order: (k: string, o?: { ascending?: boolean }) => {
        urut = { kolom: k, naik: o?.ascending !== false };
        return rantai;
      },
      range: (dari: number, sampai: number) => { rentang = [dari, sampai]; return rantai; },
      maybeSingle: () => { tunggal = true; return rantai; },
      then: (selesai: (x: unknown) => unknown) => {
        tabelDisentuh.push({ tabel: nama, op });
        const rows = tabel[nama] ?? (tabel[nama] = []);
        let cocok = rows.filter((r) => filter.every((f) => f(r)));
        if (op === "delete") tabel[nama] = rows.filter((r) => !cocok.includes(r));
        if (op === "update") for (const r of cocok) Object.assign(r, perubahan);
        const u = urut;
        if (op === "select" && u) {
          cocok = [...cocok].sort((x, y) => (u.naik ? 1 : -1) * banding(x[u.kolom], y[u.kolom]));
        }
        const rg = rentang;
        if (op === "select" && rg) cocok = cocok.slice(rg[0], rg[1] + 1);
        const data = op === "select" ? (tunggal ? (cocok[0] ?? null) : cocok) : null;
        return selesai({ data, error: null, count: hitung ? cocok.length : null });
      },
    };
    return rantai;
  }

  const db = { from: (nama: string) => kueri(nama) } as unknown as SupabaseClient;
  return { db, tabel, tabelDisentuh };
}
```

- [ ] **Step 5: `pertemuan-store.ts`**

`apps/api/src/pertemuan-store.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { potongKelompok } from "./feed-store";
import type { AcaraRingkas, PertemuanStore } from "./ports";
import { fetchAllPages } from "./trust/store";

const kecil = (a: string) => a.toLowerCase();

/**
 * Kolom `events` yang BOLEH dibaca. `host` dan `tx_hash` sengaja tidak ada —
 * yang tidak pernah dibaca tidak bisa bocor (pola graf-store.ts). `center_cell`
 * dibaca HANYA untuk geofence di server.
 */
const KOLOM_ACARA = "event_id, title, venue_label, center_cell, starts_at, ends_at";

type BarisAcara = {
  event_id: string;
  title: string;
  venue_label: string;
  center_cell: string;
  starts_at: number | string;
  ends_at: number | string;
};

export function rowToAcaraRingkas(r: BarisAcara): AcaraRingkas {
  return {
    eventId: kecil(r.event_id) as Hex,
    title: r.title,
    venueLabel: r.venue_label,
    centerCell: r.center_cell,
    startsAt: Number(r.starts_at),
    endsAt: Number(r.ends_at),
  };
}

/**
 * Riwayat pertemuan dan penjamin (spec desain UI §8.1, §8.2). Semua kueri
 * dilayani indeks yang ada (§8.5): `connections_unique_pair`,
 * `checkins_address`, primary key `events`, `vouches_to` (parsial, aktif).
 */
export function createPertemuanStore(db: SupabaseClient): PertemuanStore {
  async function acaraCheckIn(address: Address): Promise<string[]> {
    // Berhalaman penuh dengan urutan total (event_id unik per alamat):
    // select polos terpotong 1000 baris tanpa galat (trust/store.ts).
    const baris = await fetchAllPages<{ event_id: string }>(
      (f, t) => db.from("checkins").select("event_id").eq("address", kecil(address))
        .order("event_id", { ascending: true }).range(f, t) as never,
      "baca check-in pertemuan",
    );
    return baris.map((r) => kecil(r.event_id));
  }

  return {
    async koneksiPasangan(a, b) {
      // Pasangan terurut addr_a < addr_b (0001): satu baris, satu kueri.
      const [x, y] = [kecil(a), kecil(b)].sort() as [string, string];
      const { data, error } = await db.from("connections").select("created_at, cell")
        .eq("addr_a", x).eq("addr_b", y).maybeSingle();
      if (error) throw new Error(`baca koneksi pasangan gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { created_at: string; cell: string | null };
      return { atMs: new Date(d.created_at).getTime(), cell: d.cell ?? null };
    },

    async acaraCheckInBersama(a, b) {
      const [milikA, milikB] = await Promise.all([acaraCheckIn(a), acaraCheckIn(b)]);
      const setB = new Set(milikB);
      const bersama = [...new Set(milikA)].filter((e) => setB.has(e));
      const hasil = await Promise.all(potongKelompok(bersama).map(async (bagian) => {
        const { data, error } = await db.from("events").select(KOLOM_ACARA).in("event_id", bagian);
        if (error) throw new Error(`baca acara pertemuan gagal: ${error.message}`);
        return ((data ?? []) as BarisAcara[]).map(rowToAcaraRingkas);
      }));
      return hasil.flat();
    },

    async penjaminAktif(to) {
      const baris = await fetchAllPages<{ from_addr: string }>(
        (f, t) => db.from("vouches").select("from_addr").eq("to_addr", kecil(to)).is("revoked_at", null)
          .order("from_addr", { ascending: true }).range(f, t) as never,
        "baca penjamin aktif",
      );
      return baris.map((r) => kecil(r.from_addr) as Address);
    },
  };
}
```

- [ ] **Step 6: Sambungkan ke `TrustDeps` dan fake**

Di `apps/api/src/app.ts`, ganti

```ts
import type { RadarStore, ProfilSayaStore } from "./ports";
```

dengan

```ts
import type { PertemuanStore, RadarStore, ProfilSayaStore } from "./ports";
```

dan ganti

```ts
  radar: RadarStore;
  profilSaya: ProfilSayaStore;
};
```

dengan

```ts
  radar: RadarStore;
  profilSaya: ProfilSayaStore;
  /** Desain UI: riwayat pertemuan dan penjamin di GET /profile/:address. */
  pertemuan: PertemuanStore;
};
```

Di `apps/api/src/index.ts`, ganti

```ts
import { createProfilSayaStore } from "./profil-store";
```

dengan

```ts
import { createProfilSayaStore } from "./profil-store";
import { createPertemuanStore } from "./pertemuan-store";
```

dan ganti

```ts
  profilSaya: createProfilSayaStore(supabase),
});
```

dengan

```ts
  profilSaya: createProfilSayaStore(supabase),
  pertemuan: createPertemuanStore(supabase),
});
```

Di `apps/api/test/support/deps.ts`, ganti

```ts
    profilSaya: {
      profilSaya: vi.fn(async () => ({ displayName: "", visibilitas: "terlihat" as const })),
      aturProfil: vi.fn(async () => {}),
      visibilitasBanyak: vi.fn(async () => new Map()),
    },
  };
}
```

dengan

```ts
    profilSaya: {
      profilSaya: vi.fn(async () => ({ displayName: "", visibilitas: "terlihat" as const })),
      aturProfil: vi.fn(async () => {}),
      visibilitasBanyak: vi.fn(async () => new Map()),
    },
    // Desain UI: diuji di profile-pertemuan.route.test.ts dengan dunia
    // sendiri; TrustDeps butuh medan ini supaya createApp bisa dibangun.
    pertemuan: {
      koneksiPasangan: vi.fn(async () => null),
      acaraCheckInBersama: vi.fn(async () => []),
      penjaminAktif: vi.fn(async () => []),
    },
  };
}
```

Di `apps/api/test/handshake.route.test.ts`, ganti

```ts
    profilSaya: {
      profilSaya: async () => ({ displayName: "", visibilitas: "terlihat" as const }),
      aturProfil: async () => {},
      visibilitasBanyak: async () => new Map(),
    },
  };
}
```

dengan

```ts
    profilSaya: {
      profilSaya: async () => ({ displayName: "", visibilitas: "terlihat" as const }),
      aturProfil: async () => {},
      visibilitasBanyak: async () => new Map(),
    },
    // Stub desain UI: createApp mendaftarkan profileRoutes dengan store ini.
    pertemuan: {
      koneksiPasangan: async () => null,
      acaraCheckInBersama: async () => [],
      penjaminAktif: async () => [],
    },
  };
}
```

- [ ] **Step 7: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/api exec vitest run test/pertemuan-ports.test.ts test/pertemuan-store.test.ts test/sapu-lokasi-privasi.test.ts
pnpm --filter @nearly/api exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus (termasuk `sapu-lokasi-privasi.test.ts`, pemakai lama `supabase-memori`).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ports.ts apps/api/src/pertemuan-store.ts apps/api/src/app.ts apps/api/src/index.ts \
  apps/api/test/support/supabase-memori.ts apps/api/test/support/deps.ts apps/api/test/handshake.route.test.ts \
  apps/api/test/pertemuan-store.test.ts apps/api/test/pertemuan-ports.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(api): PertemuanStore — koneksi pasangan, acara check-in bersama, penjamin aktif

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — vouch yang dicabut ikut terhitung**

Di `apps/api/src/pertemuan-store.ts`, ganti `.eq("to_addr", kecil(to)).is("revoked_at", null)` dengan `.eq("to_addr", kecil(to))`.

Run: `pnpm --filter @nearly/api exec vitest run test/pertemuan-store.test.ts`
Expected: FAIL — `createPertemuanStore > penjaminAktif hanya vouch yang belum dicabut, huruf kecil`. Rekam, lalu `git checkout -- apps/api/src/pertemuan-store.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 11: API — `pertemuan` dan `dijaminKenalan` di `GET /profile/:address`

**Files:**
- Create: `apps/api/src/pertemuan.ts`, `apps/api/test/pertemuan.test.ts`, `apps/api/test/support/dunia-pertemuan.ts`, `apps/api/test/profile-pertemuan.route.test.ts`
- Modify: `apps/api/src/routes/profile.ts`

**Interfaces:**
- Consumes: `PertemuanStore`, `AcaraRingkas`, `KoneksiPasangan` (Task 10); `RadarStore["terhubungDengan"]`, `BlokirStore.himpunanUntuk` (sudah ada); `isInsideGeofence` (`@nearly/shared`); `duniaBlokir`, `SEL_PUSAT`/`SEL_TETANGGA`/`SEL_JAUH` (fake yang ada).
- Produces:
  - `pertemuan.ts`: `MAKS_ACARA_BERSAMA = 10`, `type AcaraPertemuan = { eventId: Hex; title: string; venueLabel: string }`, `type Pertemuan = { salaman: { atMs: number; acara: AcaraPertemuan | null }; acaraBersama: (AcaraPertemuan & { startsAt: string })[]; jumlahAcaraBersama: number }`, `acaraSalaman(koneksi, bersama): AcaraRingkas | null`, `susunPertemuan(koneksi, bersama): Pertemuan`, `bacaPertemuan(pemanggil, addr, store): Promise<Pertemuan | null>`, `hitungDijaminKenalan(pemanggil, addr, kecuali: ReadonlySet<string>, deps): Promise<number>`
  - `GET /profile/:address` cabang terbukti: kunci `pertemuan: Pertemuan | null` dan `dijaminKenalan: number` (absen bila store gagal; `dijaminKenalan` absen untuk profil sendiri). Cabang publik tidak berubah.
  - `test/support/dunia-pertemuan.ts`: `duniaPertemuan(awal)` → `{ pertemuan: PertemuanStore; radar: Pick<RadarStore, "terhubungDengan"> }`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/support/dunia-pertemuan.ts`:

```ts
import { vi } from "vitest";
import type { Address, Hex } from "viem";
import type { AcaraRingkas, PertemuanStore, RadarStore } from "../../src/ports";

/**
 * Dunia riwayat pertemuan di memori: `connections` (dengan waktu dan sel),
 * `events`, `checkins`, dan `vouches` sebagai struktur data, dengan
 * PertemuanStore dan `terhubungDengan` yang membacanya SUNGGUHAN.
 */
export function duniaPertemuan(awal: {
  koneksi?: { a: Address; b: Address; atMs: number; cell?: string | null }[];
  acara?: AcaraRingkas[];
  checkIn?: { eventId: Hex; address: Address }[];
  vouch?: { from: Address; to: Address; dicabut?: boolean }[];
} = {}) {
  const kecil = (x: string) => x.toLowerCase();
  const pasangan = (x: string, y: string) => [kecil(x), kecil(y)].sort().join("|");
  const koneksi = new Map((awal.koneksi ?? []).map((k) => [pasangan(k.a, k.b), { atMs: k.atMs, cell: k.cell ?? null }]));
  const acara = awal.acara ?? [];
  const hadir = new Set((awal.checkIn ?? []).map((c) => `${kecil(c.eventId)}|${kecil(c.address)}`));
  const vouch = awal.vouch ?? [];

  const pertemuan: PertemuanStore = {
    koneksiPasangan: vi.fn(async (x: Address, y: Address) => koneksi.get(pasangan(x, y)) ?? null),
    acaraCheckInBersama: vi.fn(async (x: Address, y: Address) => acara.filter((e) =>
      hadir.has(`${kecil(e.eventId)}|${kecil(x)}`) && hadir.has(`${kecil(e.eventId)}|${kecil(y)}`))),
    penjaminAktif: vi.fn(async (to: Address) => vouch
      .filter((v) => kecil(v.to) === kecil(to) && !v.dicabut)
      .map((v) => kecil(v.from) as Address)),
  };

  const radar: Pick<RadarStore, "terhubungDengan"> = {
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => k !== kecil(who) && koneksi.has(pasangan(who, k))))),
  };

  return { pertemuan, radar };
}
```

`apps/api/test/pertemuan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { acaraSalaman, MAKS_ACARA_BERSAMA, susunPertemuan } from "../src/pertemuan";
import type { AcaraRingkas } from "../src/ports";
import { SEL_JAUH, SEL_PUSAT, SEL_TETANGGA } from "./support/dunia-radar";

const acara = (n: number, over: Partial<AcaraRingkas> = {}): AcaraRingkas => ({
  eventId: `0x${n.toString(16).padStart(64, "0")}` as Hex,
  title: `Acara ${n}`,
  venueLabel: `Tempat ${n}`,
  centerCell: SEL_PUSAT,
  startsAt: 1_000_000 + n * 10_000,
  endsAt: 1_000_000 + n * 10_000 + 3_600,
  ...over,
});
/** Milidetik, 60 detik setelah acara mulai. */
const diDalam = (a: AcaraRingkas) => (a.startsAt + 60) * 1000;

describe("acaraSalaman (spec desain UI §8.1)", () => {
  it("acara yang jendelanya memuat waktu salaman dan geofence-nya memuat sel koneksi", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: SEL_TETANGGA }, [a])?.eventId).toBe(a.eventId);
  });

  it("batas jendela waktu inklusif", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: a.startsAt * 1000, cell: SEL_PUSAT }, [a])).not.toBeNull();
    expect(acaraSalaman({ atMs: a.endsAt * 1000, cell: SEL_PUSAT }, [a])).not.toBeNull();
    expect(acaraSalaman({ atMs: a.startsAt * 1000 - 1, cell: SEL_PUSAT }, [a])).toBeNull();
    expect(acaraSalaman({ atMs: a.endsAt * 1000 + 1, cell: SEL_PUSAT }, [a])).toBeNull();
  });

  it("sel koneksi di luar geofence → null", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: SEL_JAUH }, [a])).toBeNull();
  });

  it("koneksi lama tanpa sel hanya diuji jendela waktunya", () => {
    const a = acara(1);
    expect(acaraSalaman({ atMs: diDalam(a), cell: null }, [a])?.eventId).toBe(a.eventId);
  });

  it("lebih dari satu yang cocok → startsAt terbaru", () => {
    const baru = acara(2);
    const lama = acara(1, { endsAt: baru.endsAt });
    expect(acaraSalaman({ atMs: diDalam(baru), cell: SEL_PUSAT }, [lama, baru])?.eventId).toBe(baru.eventId);
  });
});

describe("susunPertemuan", () => {
  it("acaraBersama tanpa acara salaman, terbaru dulu, maks. 10; jumlah total", () => {
    const semua = Array.from({ length: 12 }, (_, i) => acara(i + 1));
    const salamanDi = semua[4]!;
    const p = susunPertemuan({ atMs: diDalam(salamanDi), cell: SEL_PUSAT }, semua);
    expect(p.salaman).toEqual({
      atMs: diDalam(salamanDi),
      acara: { eventId: salamanDi.eventId, title: "Acara 5", venueLabel: "Tempat 5" },
    });
    expect(p.jumlahAcaraBersama).toBe(11);
    expect(p.acaraBersama).toHaveLength(MAKS_ACARA_BERSAMA);
    expect(p.acaraBersama.map((a) => a.title)).toEqual([
      "Acara 12", "Acara 11", "Acara 10", "Acara 9", "Acara 8", "Acara 7", "Acara 6", "Acara 4", "Acara 3", "Acara 2",
    ]);
    expect(p.acaraBersama[0]!.startsAt).toBe(String(semua[11]!.startsAt));
  });

  it("tanpa acara salaman: acara null dan semua acara bersama dihitung", () => {
    const semua = [acara(1), acara(2)];
    const p = susunPertemuan({ atMs: 5, cell: SEL_PUSAT }, semua);
    expect(p.salaman.acara).toBeNull();
    expect(p.jumlahAcaraBersama).toBe(2);
  });

  it("himpunan kunci persis — tanpa pusat acara, akhir acara, atau sel", () => {
    const semua = [acara(1), acara(2)];
    const p = susunPertemuan({ atMs: diDalam(semua[0]!), cell: SEL_PUSAT }, semua);
    expect(Object.keys(p).sort()).toEqual(["acaraBersama", "jumlahAcaraBersama", "salaman"]);
    expect(Object.keys(p.salaman).sort()).toEqual(["acara", "atMs"]);
    expect(Object.keys(p.salaman.acara!).sort()).toEqual(["eventId", "title", "venueLabel"]);
    expect(Object.keys(p.acaraBersama[0]!).sort()).toEqual(["eventId", "startsAt", "title", "venueLabel"]);
  });
});
```

`apps/api/test/profile-pertemuan.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatProfilTypedData } from "@nearly/shared";
import { profileRoutes } from "../src/routes/profile";
import type { Pertemuan } from "../src/pertemuan";
import type { AcaraRingkas } from "../src/ports";
import { duniaBlokir } from "./support/dunia-blokir";
import { duniaPertemuan } from "./support/dunia-pertemuan";
import { SEL_JAUH, SEL_PUSAT } from "./support/dunia-radar";

const aku = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const AKU = aku.address.toLowerCase() as Address;
const DIA = "0x000000000000000000000000000000000000dead" as Address;
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const alamat = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

const acara = (n: number): AcaraRingkas => ({
  eventId: `0x${n.toString(16).padStart(64, "0")}` as Hex,
  title: `Acara ${n}`,
  venueLabel: `Tempat ${n}`,
  centerCell: SEL_PUSAT,
  startsAt: 1_700_000_000 + n * 10_000,
  endsAt: 1_700_000_000 + n * 10_000 + 3_600,
});
const diDalam = (a: AcaraRingkas) => (a.startsAt + 60) * 1000;
const hadir = (a: AcaraRingkas, ...orang: Address[]) => orang.map((address) => ({ eventId: a.eventId, address }));

type Dunia = ReturnType<typeof duniaPertemuan>;
type ProfilJson = Record<string, unknown> & { pertemuan?: Pertemuan | null; dijaminKenalan?: number };

function app(dunia: Dunia, blokir: { blocker: Address; blocked: Address }[] = []) {
  const blok = duniaBlokir({ blokir });
  const deps = {
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 3),
      getDisplayName: vi.fn(async () => "Dia"),
    },
    identity: { ensName: vi.fn(async () => null), txCount: vi.fn(async () => 0) },
    meet: blok.meet,
    blokir: blok.blokir,
    pertemuan: dunia.pertemuan,
    radar: dunia.radar,
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  return new Hono().route("/", profileRoutes(deps as never));
}

/** Jalur dengan bukti LihatProfil sah dari `aku` untuk `target`. */
async function jalurTerbukti(target: Address): Promise<string> {
  const sig = await aku.signTypedData(lihatProfilTypedData({ target, who: aku.address, expiresAt: EXP }, KONTRAK));
  return `/profile/${target}?${new URLSearchParams({ who: aku.address, expiresAt: EXP.toString(), sig }).toString()}`;
}

async function profil(a: Hono, jalur: string): Promise<{ teks: string; json: ProfilJson }> {
  const res = await a.request(jalur);
  expect(res.status).toBe(200);
  const teks = await res.text();
  return { teks, json: JSON.parse(teks) as ProfilJson };
}

describe("GET /profile/:address — pertemuan (spec desain UI §8.1, §10.2)", () => {
  it("tanpa bukti: kunci baru absen, store tidak dibaca, bentuk respons publik tidak berubah", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: NOW - 1_000 }], vouch: [{ from: AKU, to: DIA }] });
    const { json } = await profil(app(d), `/profile/${DIA}?who=${aku.address}`);
    expect(Object.keys(json).sort()).toEqual(
      ["address", "connectionCount", "displayName", "ens", "inginBertemuCount", "txCount"],
    );
    expect(d.pertemuan.koneksiPasangan).not.toHaveBeenCalled();
    expect(d.pertemuan.acaraCheckInBersama).not.toHaveBeenCalled();
    expect(d.pertemuan.penjaminAktif).not.toHaveBeenCalled();
  });

  it("bukti sah + terkoneksi → waktu salaman", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: DIA, b: AKU, atMs: 1_700_000_123_000, cell: null }] });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.salaman).toEqual({ atMs: 1_700_000_123_000, acara: null });
  });

  it("salaman di acara yang keduanya check-in dan di dalam geofence → acara terisi", async () => {
    const e = acara(1);
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(e), cell: SEL_PUSAT }], acara: [e], checkIn: hadir(e, AKU, DIA),
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.salaman.acara).toEqual({ eventId: e.eventId, title: "Acara 1", venueLabel: "Tempat 1" });
  });

  it("di luar jendela waktu, di luar geofence, atau hanya satu pihak check-in → acara null", async () => {
    const e = acara(1);
    const kasus = [
      { atMs: (e.endsAt + 60) * 1000, cell: SEL_PUSAT, checkIn: hadir(e, AKU, DIA) },
      { atMs: diDalam(e), cell: SEL_JAUH, checkIn: hadir(e, AKU, DIA) },
      { atMs: diDalam(e), cell: SEL_PUSAT, checkIn: hadir(e, AKU) },
    ];
    for (const k of kasus) {
      const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: k.atMs, cell: k.cell }], acara: [e], checkIn: k.checkIn });
      const { json } = await profil(app(d), await jalurTerbukti(DIA));
      expect(json.pertemuan?.salaman.acara).toBeNull();
    }
  });

  it("acaraBersama tanpa acara salaman, terbaru dulu, maks. 10; jumlahAcaraBersama total", async () => {
    const semua = Array.from({ length: 12 }, (_, i) => acara(i + 1));
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(semua[0]!), cell: SEL_PUSAT }],
      acara: semua,
      checkIn: semua.flatMap((e) => hadir(e, AKU, DIA)),
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.pertemuan?.jumlahAcaraBersama).toBe(11);
    expect(json.pertemuan?.acaraBersama.map((a) => a.title)).toEqual([
      "Acara 12", "Acara 11", "Acara 10", "Acara 9", "Acara 8", "Acara 7", "Acara 6", "Acara 5", "Acara 4", "Acara 3",
    ]);
  });

  it("tidak terkoneksi → pertemuan null, kuncinya tetap ada", async () => {
    const d = duniaPertemuan();
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("pertemuan" in json).toBe(true);
    expect(json.pertemuan).toBeNull();
  });

  it("profil sendiri → pertemuan null dan dijaminKenalan absen", async () => {
    const P = alamat(0x101);
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: P, atMs: 1 }], vouch: [{ from: P, to: AKU }] });
    const { json } = await profil(app(d), await jalurTerbukti(AKU));
    expect(json.pertemuan).toBeNull();
    expect("dijaminKenalan" in json).toBe(false);
  });

  it("himpunan kunci persis; tidak ada sel, tx hash, host, atau pusat acara", async () => {
    const semua = [acara(1), acara(2)];
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: DIA, atMs: diDalam(semua[0]!), cell: SEL_PUSAT }],
      acara: semua,
      checkIn: semua.flatMap((e) => hadir(e, AKU, DIA)),
    });
    const { teks, json } = await profil(app(d), await jalurTerbukti(DIA));
    const p = json.pertemuan!;
    expect(Object.keys(p).sort()).toEqual(["acaraBersama", "jumlahAcaraBersama", "salaman"]);
    expect(Object.keys(p.salaman).sort()).toEqual(["acara", "atMs"]);
    expect(Object.keys(p.salaman.acara!).sort()).toEqual(["eventId", "title", "venueLabel"]);
    expect(Object.keys(p.acaraBersama[0]!).sort()).toEqual(["eventId", "startsAt", "title", "venueLabel"]);
    for (const terlarang of [SEL_PUSAT, "centerCell", "endsAt", "txHash", "tx_hash", "host", "cell"]) {
      expect(teks).not.toContain(terlarang);
    }
  });

  it("store gagal → kunci pertemuan absen, profil tetap 200 dengan bendera pribadi", async () => {
    const d = duniaPertemuan({ koneksi: [{ a: AKU, b: DIA, atMs: 1 }] });
    d.pertemuan.koneksiPasangan = vi.fn(async () => { throw new Error("mati"); });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("pertemuan" in json).toBe(false);
    expect(json.sudahKutandai).toBe(false);
  });
});

describe("GET /profile/:address — dijaminKenalan (spec desain UI §8.2, §10.2)", () => {
  const P1 = alamat(0x101);
  const P2 = alamat(0x102);
  const P3 = alamat(0x103);

  it("hanya vouch aktif dari penjamin yang terkoneksi dengan pemanggil", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: P2, atMs: 1 }],
      vouch: [{ from: P1, to: DIA }, { from: P2, to: DIA, dicabut: true }, { from: P3, to: DIA }],
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("pemanggil yang juga menjamin tidak menghitung dirinya", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: DIA, atMs: 1 }],
      vouch: [{ from: AKU, to: DIA }, { from: P1, to: DIA }],
    });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("penjamin yang diblokir pemanggil DAN yang memblokir pemanggil tidak dihitung", async () => {
    const d = duniaPertemuan({
      koneksi: [{ a: AKU, b: P1, atMs: 1 }, { a: AKU, b: P2, atMs: 1 }, { a: AKU, b: P3, atMs: 1 }],
      vouch: [{ from: P1, to: DIA }, { from: P2, to: DIA }, { from: P3, to: DIA }],
    });
    const blokir = [{ blocker: AKU, blocked: P1 }, { blocker: P2, blocked: AKU }];
    const { json } = await profil(app(d, blokir), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(1);
  });

  it("nilai 0 dikirim sebagai 0 (kuncinya ada)", async () => {
    const d = duniaPertemuan();
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect(json.dijaminKenalan).toBe(0);
  });

  it("store gagal → kunci dijaminKenalan absen, profil tetap 200", async () => {
    const d = duniaPertemuan({ vouch: [{ from: P1, to: DIA }] });
    d.pertemuan.penjaminAktif = vi.fn(async () => { throw new Error("mati"); });
    const { json } = await profil(app(d), await jalurTerbukti(DIA));
    expect("dijaminKenalan" in json).toBe(false);
    expect("pertemuan" in json).toBe(true);
  });

  it("tanpa bukti tidak pernah membaca penjamin", async () => {
    const d = duniaPertemuan({ vouch: [{ from: P1, to: DIA }] });
    const { json } = await profil(app(d), `/profile/${DIA}`);
    expect("dijaminKenalan" in json).toBe(false);
    expect(d.pertemuan.penjaminAktif).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/pertemuan.test.ts test/profile-pertemuan.route.test.ts`
Expected: FAIL — `../src/pertemuan` tidak ada; tes rute gagal karena kunci `pertemuan`/`dijaminKenalan` belum keluar.

- [ ] **Step 3: `pertemuan.ts`**

`apps/api/src/pertemuan.ts`:

```ts
import type { Address, Hex } from "viem";
import { isInsideGeofence } from "@nearly/shared";
import type { AcaraRingkas, KoneksiPasangan, PertemuanStore, RadarStore } from "./ports";

/** Spec desain UI §8.1: acaraBersama paling banyak 10, terbaru dulu. */
export const MAKS_ACARA_BERSAMA = 10;

export type AcaraPertemuan = { eventId: Hex; title: string; venueLabel: string };

/**
 * Riwayat pertemuan pemanggil dengan orang yang profilnya dibuka (§8.1).
 * `acaraBersama[].startsAt` = detik unix sebagai string (Ruling A16).
 */
export type Pertemuan = {
  salaman: { atMs: number; acara: AcaraPertemuan | null };
  acaraBersama: (AcaraPertemuan & { startsAt: string })[];
  jumlahAcaraBersama: number;
};

const kecil = (a: string) => a.toLowerCase();
const terbaruDulu = (a: AcaraRingkas, b: AcaraRingkas) =>
  (b.startsAt - a.startsAt) || a.eventId.localeCompare(b.eventId);

/**
 * Acara tempat salaman terjadi: salah satu acara yang KEDUANYA check-in, yang
 * jendelanya [startsAt, endsAt] memuat waktu koneksi, dan — bila sel koneksi
 * ada — geofence-nya memuat sel itu. Lebih dari satu → startsAt terbaru.
 */
export function acaraSalaman(koneksi: KoneksiPasangan, bersama: AcaraRingkas[]): AcaraRingkas | null {
  const cocok = bersama.filter((a) =>
    koneksi.atMs >= a.startsAt * 1000
    && koneksi.atMs <= a.endsAt * 1000
    && (koneksi.cell === null || isInsideGeofence(a.centerCell, koneksi.cell)));
  return [...cocok].sort(terbaruDulu)[0] ?? null;
}

/**
 * Murni. Dibangun kunci demi kunci — `centerCell`, `endsAt`, sel koneksi, tx
 * hash, dan host tidak pernah ikut (aturan bersama §8 #1, #3).
 */
export function susunPertemuan(koneksi: KoneksiPasangan, bersama: AcaraRingkas[]): Pertemuan {
  const di = acaraSalaman(koneksi, bersama);
  const lain = bersama.filter((a) => a.eventId !== di?.eventId).sort(terbaruDulu);
  return {
    salaman: {
      atMs: koneksi.atMs,
      acara: di ? { eventId: di.eventId, title: di.title, venueLabel: di.venueLabel } : null,
    },
    acaraBersama: lain.slice(0, MAKS_ACARA_BERSAMA).map((a) => ({
      eventId: a.eventId,
      title: a.title,
      venueLabel: a.venueLabel,
      startsAt: String(a.startsAt),
    })),
    jumlahAcaraBersama: lain.length,
  };
}

/**
 * null bila pemanggil membuka profilnya sendiri atau keduanya tidak
 * terkoneksi — co-kehadiran tanpa salaman BUKAN pertemuan (§8.1). Blokir dan
 * visibilitas tidak berpengaruh: ini riwayat pemanggil sendiri, dan salaman +
 * check-in sudah publik on-chain.
 */
export async function bacaPertemuan(
  pemanggil: Address, addr: Address, store: PertemuanStore,
): Promise<Pertemuan | null> {
  if (kecil(pemanggil) === kecil(addr)) return null;
  const koneksi = await store.koneksiPasangan(pemanggil, addr);
  if (!koneksi) return null;
  return susunPertemuan(koneksi, await store.acaraCheckInBersama(pemanggil, addr));
}

/**
 * Jumlah penjamin AKTIF `addr` yang terkoneksi dengan pemanggil, tanpa
 * pemanggil sendiri, `addr` sendiri, dan setiap alamat di himpunan blokir dua
 * arah pemanggil (§8.2). Hanya angka — siapa penjaminnya tidak pernah keluar.
 */
export async function hitungDijaminKenalan(
  pemanggil: Address,
  addr: Address,
  kecuali: ReadonlySet<string>,
  deps: { pertemuan: Pick<PertemuanStore, "penjaminAktif">; radar: Pick<RadarStore, "terhubungDengan"> },
): Promise<number> {
  const aku = kecil(pemanggil);
  const dia = kecil(addr);
  const penjamin = [...new Set((await deps.pertemuan.penjaminAktif(addr)).map(kecil))]
    .filter((p) => p !== aku && p !== dia && !kecuali.has(p)) as Address[];
  if (penjamin.length === 0) return 0;
  return (await deps.radar.terhubungDengan(pemanggil, penjamin)).size;
}
```

- [ ] **Step 4: Rute profil**

Di `apps/api/src/routes/profile.ts`, ganti

```ts
import type { BlokirStore, GateDeps, MeetStore } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

type ProfileMeetDeps = {
  meet: MeetStore;
  blokir: BlokirStore;
  verifyingContract: Address;
  nowMs: () => number;
};
```

dengan

```ts
import type { BlokirStore, GateDeps, MeetStore, PertemuanStore, RadarStore } from "../ports";
import { bacaPertemuan, hitungDijaminKenalan } from "../pertemuan";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

type ProfileMeetDeps = {
  meet: MeetStore;
  blokir: BlokirStore;
  /** Desain UI §8.1–§8.2: riwayat pertemuan dan penjamin, cabang terbukti saja. */
  pertemuan: PertemuanStore;
  radar: Pick<RadarStore, "terhubungDengan">;
  verifyingContract: Address;
  nowMs: () => number;
};
```

dan ganti

```ts
    const [sudahKutandai, diaMenandaiku, sudahKublokir] = await Promise.all([
      deps.meet.adaTanda(addr, pemanggil, kecuali),
      deps.meet.adaTanda(pemanggil, addr, kecuali),
      deps.blokir.adaBlokir(pemanggil, addr),
    ]);
    return c.json({
      ...dasar,
      sudahKutandai,
      salingMenandai: sudahKutandai && diaMenandaiku,
      sudahKublokir,
    });
```

dengan

```ts
    // Data baru desain UI (spec 2026-09-18 §8.1–§8.2) HANYA di cabang ini:
    // yang melihat riwayat pertemuan hanyalah salah satu dari dua orangnya.
    // Gagal = kunci hilang (aturan bersama §8 #2), bukan profil yang gagal dan
    // bukan angka karangan. Profil sendiri tidak mendapat dijaminKenalan.
    const [sudahKutandai, diaMenandaiku, sudahKublokir, pertemuan, dijaminKenalan] = await Promise.all([
      deps.meet.adaTanda(addr, pemanggil, kecuali),
      deps.meet.adaTanda(pemanggil, addr, kecuali),
      deps.blokir.adaBlokir(pemanggil, addr),
      bacaPertemuan(pemanggil, addr, deps.pertemuan).catch(() => undefined),
      pemanggil === addr
        ? Promise.resolve(undefined)
        : hitungDijaminKenalan(pemanggil, addr, new Set(kecuali), deps).catch(() => undefined),
    ]);
    return c.json({
      ...dasar,
      sudahKutandai,
      salingMenandai: sudahKutandai && diaMenandaiku,
      sudahKublokir,
      ...(pertemuan !== undefined ? { pertemuan } : {}),
      ...(dijaminKenalan !== undefined ? { dijaminKenalan } : {}),
    });
```

(`pemanggil` dan `addr` sudah huruf kecil di titik ini — `pemanggilTerbukti` dan `raw.toLowerCase()`.)

- [ ] **Step 5: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/api exec vitest run test/pertemuan.test.ts test/profile-pertemuan.route.test.ts test/profile-meet.route.test.ts test/profile.route.test.ts
pnpm --filter @nearly/api exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus — tes profil lama tetap hijau tanpa diubah (deps lama tanpa `pertemuan` jatuh ke kunci absen lewat `.catch`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pertemuan.ts apps/api/src/routes/profile.ts apps/api/test/pertemuan.test.ts \
  apps/api/test/profile-pertemuan.route.test.ts apps/api/test/support/dunia-pertemuan.ts
git status --short   # WAJIB kosong
git commit -m "feat(api): riwayat pertemuan dan penjamin yang kamu kenal di profil terbukti

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Mutasi — saringan blokir penjamin**

Di `apps/api/src/pertemuan.ts`, ganti `    .filter((p) => p !== aku && p !== dia && !kecuali.has(p)) as Address[];` dengan `    .filter((p) => p !== aku && p !== dia) as Address[];`.

Run: `pnpm --filter @nearly/api exec vitest run test/profile-pertemuan.route.test.ts`
Expected: FAIL — `GET /profile/:address — dijaminKenalan (spec desain UI §8.2, §10.2) > penjamin yang diblokir pemanggil DAN yang memblokir pemanggil tidak dihitung`. Rekam, lalu `git checkout -- apps/api/src/pertemuan.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 8: Mutasi — data baru bocor ke cabang publik**

Di `apps/api/src/routes/profile.ts`, ganti `    if (!pemanggil) return c.json(dasar);` dengan `    if (!pemanggil) return c.json({ ...dasar, pertemuan: null });`.

Run: `pnpm --filter @nearly/api exec vitest run test/profile-pertemuan.route.test.ts`
Expected: FAIL — `… > tanpa bukti: kunci baru absen, store tidak dibaca, bentuk respons publik tidak berubah`. Rekam, lalu `git checkout -- apps/api/src/routes/profile.ts`, jalankan ulang (PASS), `git status --short` kosong.

---
## Task 12: API — koneksi bersama di radar, dengan cache 60 detik

**Files:**
- Modify: `apps/api/src/ports.ts` (blok `RadarStore`), `apps/api/src/radar-store.ts`, `apps/api/src/radar-gate.ts`, `apps/api/src/routes/radar.ts`, `apps/api/test/support/dunia-radar.ts`, `apps/api/test/support/deps.ts`, `apps/api/test/handshake.route.test.ts`, `apps/api/test/radar-ports.test.ts`, `apps/api/test/radar-store.test.ts`, `apps/api/test/radar-gate.test.ts`, `apps/api/test/radar.route.test.ts`

**Interfaces:**
- Consumes: `buatCacheSingkat` (`src/cache-singkat.ts`), `fetchAllPages`, `potongKelompok`, `supabaseMemori` (Task 10), `duniaRadar` (fake yang ada).
- Produces:
  - `RadarStore.hitungKoneksiBersama(who: Address, kandidat: Address[], kecuali: readonly string[]): Promise<Map<string, number>>` (+ `METODE_RADAR_STORE`)
  - `radar-gate.ts`: `KartuRadar.koneksiBersama?: number`; `UMUR_CACHE_KONEKSI_BERSAMA_MS = 60_000`; `type PenghitungKoneksiBersama = (aku: Address, kandidat: Address[], kecuali: readonly string[]) => Promise<Map<string, number>>`; `buatPenghitungKoneksiBersama(deps: Pick<RadarDeps, "radar" | "nowMs">): PenghitungKoneksiBersama`; `lihatRadar(pemanggil, eventId, deps, hitungBersama?)`
  - `GET /radar/:eventId`: kartu `pernahBertemu === false` dengan ≥ 1 koneksi bersama mendapat `koneksiBersama: number`; kunci lain tidak berubah; `jumlah` tetap = jumlah kartu.

- [ ] **Step 1: Tulis tes yang gagal**

Di `apps/api/test/radar-ports.test.ts`, ganti

```ts
      "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
      "sapuLokasi",
    ]);
```

dengan

```ts
      "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
      "sapuLokasi", "hitungKoneksiBersama",
    ]);
```

Tambahkan di AKHIR `apps/api/test/radar-store.test.ts`:

```ts

import { supabaseMemori } from "./support/supabase-memori";

// Spec desain UI §8.3, §10.2: pemetaan dengan kandidat di KEDUA sisi urutan
// kanonik (addr_a < addr_b), blokir dua arah pemanggil tidak dihitung.
describe("createRadarStore — hitungKoneksiBersama", () => {
  const x = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
  const WHO = x(0x50);
  const K1 = x(0x90); // > WHO
  const K2 = x(0x10); // < WHO
  const M1 = x(0x30);
  const M2 = x(0x70);
  const BLOK = x(0x60);
  const baris = (id: number, a: Address, b: Address) => ({ id, addr_a: a < b ? a : b, addr_b: a < b ? b : a });

  it("menghitung irisan koneksi untuk kandidat di kedua sisi, tanpa himpunan blokir", async () => {
    const { db } = supabaseMemori({
      connections: [
        baris(1, WHO, M1), baris(2, M1, K1), baris(3, WHO, M2), baris(4, K2, M2),
        baris(5, WHO, BLOK), baris(6, BLOK, K1), baris(7, M2, K1),
      ],
    });
    const hasil = await createRadarStore(db).hitungKoneksiBersama(WHO, [K1, K2], [BLOK]);
    expect(hasil).toEqual(new Map([[K1, 2], [K2, 1]]));
  });

  it("kandidat tanpa koneksi bersama bernilai 0; pemanggil bukan kandidat", async () => {
    const { db } = supabaseMemori({ connections: [baris(1, WHO, M1)] });
    expect(await createRadarStore(db).hitungKoneksiBersama(WHO, [K1, WHO], [])).toEqual(new Map([[K1, 0]]));
  });

  it("tanpa kandidat tidak mengirim kueri", async () => {
    const { db, tabelDisentuh } = supabaseMemori({ connections: [] });
    expect(await createRadarStore(db).hitungKoneksiBersama(WHO, [], [])).toEqual(new Map());
    expect(tabelDisentuh).toEqual([]);
  });
});
```

Di `apps/api/test/radar-gate.test.ts`, ganti

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  detak, JEDA_DETAK_MIN_MS, JENDELA_HADIR_MS, lihatRadar, MAKS_KARTU_RADAR, urutkanKartuRadar,
} from "../src/radar-gate";
```

dengan

```ts
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import {
  buatPenghitungKoneksiBersama, detak, JEDA_DETAK_MIN_MS, JENDELA_HADIR_MS, lihatRadar, MAKS_KARTU_RADAR,
  UMUR_CACHE_KONEKSI_BERSAMA_MS, urutkanKartuRadar,
} from "../src/radar-gate";
```

lalu tambahkan di AKHIR berkas:

```ts

describe("lihatRadar — koneksi bersama (spec desain UI §8.3, §10.2)", () => {
  const M1 = alamat(0x31);
  const M2 = alamat(0x32);
  const H = alamat(0x4e);
  type Hasil = Awaited<ReturnType<typeof lihatRadar>>;
  const kartuDari = (r: Hasil) => (r.ok ? r.value.kartu : []);
  const kartuUntuk = (r: Hasil, a: Address) => kartuDari(r).find((k) => k.address === a);

  it("hanya kartu yang belum ditemui; absen bila 0", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C, D], koneksi: [[AKU, B], [AKU, M1], [M1, B], [M1, C]] });
    for (const o of [AKU, B, C, D]) d.hadirkan(o);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(kartuUntuk(r, B)).not.toHaveProperty("koneksiBersama");
    expect(kartuUntuk(r, C)?.koneksiBersama).toBe(1);
    expect(kartuUntuk(r, D)).not.toHaveProperty("koneksiBersama");
  });

  it("hitungan benar untuk graf kecil yang ditulis tangan", async () => {
    const d = duniaRadar({
      checkIn: [AKU, C], koneksi: [[AKU, M1], [AKU, M2], [AKU, B], [M1, C], [M2, C], [B, C]],
    });
    d.hadirkan(AKU); d.hadirkan(C);
    expect(kartuUntuk(await lihatRadar(AKU, EVENT_RADAR, d.deps), C)?.koneksiBersama).toBe(3);
  });

  it("koneksi bersama yang terblokir ke arah mana pun tidak dihitung", async () => {
    for (const blokir of [[{ blocker: AKU, blocked: M1 }], [{ blocker: M1, blocked: AKU }]]) {
      const d = duniaRadar({ checkIn: [AKU, C], koneksi: [[AKU, M1], [M1, C], [AKU, M2], [M2, C]], blokir });
      d.hadirkan(AKU); d.hadirkan(C);
      expect(kartuUntuk(await lihatRadar(AKU, EVENT_RADAR, d.deps), C)?.koneksiBersama).toBe(1);
    }
  });

  it("kandidat Tersembunyi tidak punya kartu dan tidak pernah dikirim ke hitungKoneksiBersama", async () => {
    const d = duniaRadar({ checkIn: [AKU, C, H], koneksi: [[AKU, M1], [M1, C], [M1, H]], tersembunyi: [H] });
    for (const o of [AKU, C, H]) d.hadirkan(o);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(kartuDari(r).map((k) => k.address)).toEqual([C]);
    const dikirim = vi.mocked(d.deps.radar.hitungKoneksiBersama).mock.calls.flatMap(([, kandidat]) => kandidat);
    expect(dikirim).not.toContain(H);
  });

  it("pemanggil Tersembunyi → 403 sebelum store dipanggil", async () => {
    const d = duniaRadar({ checkIn: [AKU, C], koneksi: [[AKU, M1], [M1, C]], tersembunyi: [AKU] });
    d.hadirkan(AKU); d.hadirkan(C);
    expect(await lihatRadar(AKU, EVENT_RADAR, d.deps)).toEqual({ ok: false, failure: { code: "tersembunyi", httpStatus: 403 } });
    expect(d.deps.radar.hitungKoneksiBersama).not.toHaveBeenCalled();
  });

  it("himpunan kunci setiap kartu persis; tanpa nama atau alamat koneksi bersama", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], koneksi: [[AKU, B], [AKU, M1], [M1, C]], nama: { [M1]: "Mawar" } });
    for (const o of [AKU, B, C]) d.hadirkan(o);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(Object.keys(kartuUntuk(r, B)!).sort())
      .toEqual(["address", "displayName", "pernahBertemu", "salingInginBertemu", "tierLabel"]);
    expect(Object.keys(kartuUntuk(r, C)!).sort())
      .toEqual(["address", "displayName", "koneksiBersama", "pernahBertemu", "salingInginBertemu", "tierLabel"]);
    const teks = JSON.stringify(r);
    expect(teks).not.toContain(M1);
    expect(teks).not.toContain("Mawar");
  });

  it("jumlah tetap = jumlah kartu yang dikirim", async () => {
    const d = duniaRadar({ checkIn: [AKU, B, C], koneksi: [[AKU, M1], [M1, C]] });
    for (const o of [AKU, B, C]) d.hadirkan(o);
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok && r.value.jumlah).toBe(kartuDari(r).length);
  });

  it("store gagal → kunci absen di semua kartu, radar tetap ok", async () => {
    const d = duniaRadar({ checkIn: [AKU, C], koneksi: [[AKU, M1], [M1, C]] });
    d.hadirkan(AKU); d.hadirkan(C);
    d.deps.radar.hitungKoneksiBersama = vi.fn(async () => { throw new Error("mati"); });
    const r = await lihatRadar(AKU, EVENT_RADAR, d.deps);
    expect(r.ok).toBe(true);
    expect(kartuUntuk(r, C)).not.toHaveProperty("koneksiBersama");
  });

  it("cache 60 detik: hasil yang sama di dalam jendela, dihitung ulang sesudahnya", async () => {
    const d = duniaRadar({ checkIn: [AKU, C], koneksi: [[AKU, M1], [M1, C]] });
    d.hadirkan(AKU); d.hadirkan(C);
    const hitung = buatPenghitungKoneksiBersama(d.deps);
    await lihatRadar(AKU, EVENT_RADAR, d.deps, hitung);
    await lihatRadar(AKU, EVENT_RADAR, d.deps, hitung);
    expect(d.deps.radar.hitungKoneksiBersama).toHaveBeenCalledTimes(1);
    d.jam.sekarang += UMUR_CACHE_KONEKSI_BERSAMA_MS - 1;
    await lihatRadar(AKU, EVENT_RADAR, d.deps, hitung);
    expect(d.deps.radar.hitungKoneksiBersama).toHaveBeenCalledTimes(1);
    d.jam.sekarang += 1;
    await lihatRadar(AKU, EVENT_RADAR, d.deps, hitung);
    expect(d.deps.radar.hitungKoneksiBersama).toHaveBeenCalledTimes(2);
  });
});
```

Tambahkan di dalam `describe("GET /radar/:eventId", …)` di `apps/api/test/radar.route.test.ts`, sebelum `});` penutupnya:

```ts

  it("rute memakai cache koneksi bersama: dua GET dalam 60 detik → satu hitungan", async () => {
    const { d, detak, radar } = dunia();
    d.hadirkan(B.address);
    await detak(A);
    await radar(A);
    await radar(A);
    expect(d.deps.radar.hitungKoneksiBersama).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/radar-ports.test.ts test/radar-store.test.ts test/radar-gate.test.ts test/radar.route.test.ts`
Expected: FAIL — `hitungKoneksiBersama` belum ada di port, store, dan fake; `buatPenghitungKoneksiBersama`/`UMUR_CACHE_KONEKSI_BERSAMA_MS` tidak diekspor.

- [ ] **Step 3: Port, fake, dan stub**

Di `apps/api/src/ports.ts`, ganti

```ts
  /** Empat pernyataan spec 4b+5 §4.5. `nowMs` dari pemanggil, supaya tes bisa memakai jam palsu. */
  sapuLokasi(nowMs: number): Promise<HasilSapuLokasi>;
};

export const METODE_RADAR_STORE = [
  "ambilKehadiran", "simpanKehadiran", "hapusKehadiran", "hapusSemuaKehadiran",
  "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
  "sapuLokasi",
] as const satisfies readonly (keyof RadarStore)[];
```

dengan

```ts
  /** Empat pernyataan spec 4b+5 §4.5. `nowMs` dari pemanggil, supaya tes bisa memakai jam palsu. */
  sapuLokasi(nowMs: number): Promise<HasilSapuLokasi>;
  /**
   * Desain UI §8.3: untuk setiap kandidat (huruf kecil), jumlah alamat yang
   * terkoneksi dengan `who` DAN dengan kandidat itu — tanpa `who`, kandidat
   * itu sendiri, dan `kecuali` (himpunan blokir dua arah pemanggil).
   * Kandidat tanpa koneksi bersama bernilai 0. HANYA angka, tidak pernah daftar.
   */
  hitungKoneksiBersama(who: Address, kandidat: Address[], kecuali: readonly string[]): Promise<Map<string, number>>;
};

export const METODE_RADAR_STORE = [
  "ambilKehadiran", "simpanKehadiran", "hapusKehadiran", "hapusSemuaKehadiran",
  "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
  "sapuLokasi", "hitungKoneksiBersama",
] as const satisfies readonly (keyof RadarStore)[];
```

Di `apps/api/test/support/dunia-radar.ts`, ganti

```ts
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => db.koneksi.has(pasangan(who, k))))),
```

dengan

```ts
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => db.koneksi.has(pasangan(who, k))))),
    hitungKoneksiBersama: vi.fn(async (who: Address, kandidat: Address[], kecuali: readonly string[]) => {
      const tetangga = (x: string) => {
        const s = new Set<string>();
        for (const p of db.koneksi) {
          const [a, b] = p.split("|") as [string, string];
          if (a === x) s.add(b);
          if (b === x) s.add(a);
        }
        return s;
      };
      const w = kecil(who);
      const buang = new Set([w, ...kecuali.map(kecil)]);
      const milikku = tetangga(w);
      return new Map(kandidat.map(kecil).filter((k) => k !== w).map((k) => [
        k, [...tetangga(k)].filter((m) => m !== k && !buang.has(m) && milikku.has(m)).length,
      ]));
    }),
```

Di `apps/api/test/support/deps.ts`, ganti

```ts
      sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
    },
```

dengan

```ts
      sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
      hitungKoneksiBersama: vi.fn(async () => new Map<string, number>()),
    },
```

Di `apps/api/test/handshake.route.test.ts`, ganti

```ts
      sapuLokasi: async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 }),
    },
```

dengan

```ts
      sapuLokasi: async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 }),
      hitungKoneksiBersama: async () => new Map<string, number>(),
    },
```

- [ ] **Step 4: Implementasi store**

Di `apps/api/src/radar-store.ts`, ganti

```ts
    async hitungNotifKedekatan(eventId, penerima) {
```

dengan

```ts
    async hitungKoneksiBersama(who, kandidat, kecuali) {
      const w = kecil(who);
      const unik = [...new Set(kandidat.map(kecil))].filter((k) => k !== w);
      if (unik.length === 0) return new Map();
      // Pemanggil, dan himpunan blokir dua arahnya, tidak pernah dihitung
      // sebagai koneksi bersama (spec desain UI §8.3).
      const buang = new Set([w, ...kecuali.map(kecil)]);

      // Koneksi pemanggil, berhalaman penuh di kedua sisi urutan kanonik.
      const [sisiA, sisiB] = await Promise.all([
        fetchAllPages<{ addr_b: string }>(
          (f, t) => db.from("connections").select("addr_b").eq("addr_a", w)
            .order("addr_b", { ascending: true }).range(f, t) as never,
          "baca koneksi pemanggil",
        ),
        fetchAllPages<{ addr_a: string }>(
          (f, t) => db.from("connections").select("addr_a").eq("addr_b", w)
            .order("addr_a", { ascending: true }).range(f, t) as never,
          "baca koneksi pemanggil",
        ),
      ]);
      const milikku = new Set(
        [...sisiA.map((r) => kecil(r.addr_b)), ...sisiB.map((r) => kecil(r.addr_a))].filter((m) => !buang.has(m)),
      );

      const hasil = new Map<string, number>(unik.map((k) => [k, 0]));
      if (milikku.size === 0) return hasil;

      // Koneksi kandidat: satu kueri per kelompok per sisi, seperti terhubungDengan.
      const kueri = potongKelompok(unik).flatMap((bagian) => ([
        fetchAllPages<{ addr_a: string; addr_b: string }>(
          (f, t) => db.from("connections").select("addr_a, addr_b").in("addr_a", bagian)
            .order("id", { ascending: true }).range(f, t) as never,
          "baca koneksi kandidat radar",
        ),
        fetchAllPages<{ addr_a: string; addr_b: string }>(
          (f, t) => db.from("connections").select("addr_a, addr_b").in("addr_b", bagian)
            .order("id", { ascending: true }).range(f, t) as never,
          "baca koneksi kandidat radar",
        ),
      ]));
      const terlihat = new Set<string>();
      for (const r of (await Promise.all(kueri)).flat()) {
        const a = kecil(r.addr_a);
        const b = kecil(r.addr_b);
        if (terlihat.has(`${a}|${b}`)) continue; // dua kandidat saling terhubung: baris muncul di dua kueri
        terlihat.add(`${a}|${b}`);
        if (hasil.has(a) && milikku.has(b)) hasil.set(a, (hasil.get(a) ?? 0) + 1);
        if (hasil.has(b) && milikku.has(a)) hasil.set(b, (hasil.get(b) ?? 0) + 1);
      }
      return hasil;
    },

    async hitungNotifKedekatan(eventId, penerima) {
```

- [ ] **Step 5: Gerbang radar dan rute**

Di `apps/api/src/radar-gate.ts`, ganti

```ts
import { kecocokanDari } from "./meet-rank";
import type { EventRecord, RadarDeps } from "./ports";
```

dengan

```ts
import { buatCacheSingkat } from "./cache-singkat";
import { kecocokanDari } from "./meet-rank";
import type { EventRecord, RadarDeps } from "./ports";
```

ganti

```ts
export type KartuRadar = {
  address: Address;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
};
```

dengan

```ts
export type KartuRadar = {
  address: Address;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
  /**
   * Desain UI §8.3: HANYA kartu `pernahBertemu === false`, HANYA bila ≥ 1.
   * Angka saja — tidak pernah daftar, nama, atau alamat koneksi bersama.
   */
  koneksiBersama?: number;
};

/** Radar dipanggil tiap 10 detik per penonton; angka basi sampai 60 detik diterima (§8.3). */
export const UMUR_CACHE_KONEKSI_BERSAMA_MS = 60_000;

export type PenghitungKoneksiBersama = (
  aku: Address, kandidat: Address[], kecuali: readonly string[],
) => Promise<Map<string, number>>;

/**
 * Penghitung ber-cache, dibuat SEKALI per radarRoutes (Ruling A17). Kunci:
 * pemanggil + himpunan kandidat + himpunan blokir — perubahan blokir
 * menghitung ulang seketika.
 */
export function buatPenghitungKoneksiBersama(deps: Pick<RadarDeps, "radar" | "nowMs">): PenghitungKoneksiBersama {
  const cache = buatCacheSingkat<Map<string, number>>(deps.nowMs, UMUR_CACHE_KONEKSI_BERSAMA_MS);
  return (aku, kandidat, kecuali) => {
    const kunci = [
      kecil(aku),
      [...kandidat].map(kecil).sort().join(","),
      [...kecuali].map(kecil).sort().join(","),
    ].join("|");
    return cache.ambil(kunci, () => deps.radar.hitungKoneksiBersama(aku, kandidat, kecuali));
  };
}
```

ganti

```ts
export async function lihatRadar(
  pemanggil: Address, eventIdMentah: Hex, deps: RadarDeps,
): Promise<RadarResult<ResponsRadar>> {
```

dengan

```ts
export async function lihatRadar(
  pemanggil: Address, eventIdMentah: Hex, deps: RadarDeps,
  hitungBersama: PenghitungKoneksiBersama = (a, k, x) => deps.radar.hitungKoneksiBersama(a, k, x),
): Promise<RadarResult<ResponsRadar>> {
```

dan ganti

```ts
  // Dibangun kunci demi kunci, BUKAN spread — medan tambahan di `baris`
  // (mis. `tier` mentah) tidak boleh ikut terkirim.
  const kartu: KartuRadar[] = baris.map((b) => ({
    address: b.address,
    displayName: b.displayName,
    tierLabel: labelTier(b.tier),
    pernahBertemu: b.pernahBertemu,
    salingInginBertemu: b.salingInginBertemu,
  }));
```

dengan

```ts
  // Koneksi bersama (desain UI §8.3): HANYA untuk kartu yang belum ditemui,
  // dihitung SETELAH saringan visibilitas dan blokir di atas — orang
  // Tersembunyi tidak pernah menjadi subjek hitungan. Blokir dua arah
  // pemanggil (`kecuali`) tidak dihitung sebagai koneksi bersama. Gagal =
  // kunci hilang di semua kartu, bukan angka karangan; radar tetap jalan.
  const belumBertemu = baris.filter((b) => !b.pernahBertemu).map((b) => b.address);
  const bersama = belumBertemu.length === 0
    ? new Map<string, number>()
    : await hitungBersama(aku, belumBertemu, kecuali).catch(() => null);

  // Dibangun kunci demi kunci, BUKAN spread — medan tambahan di `baris`
  // (mis. `tier` mentah) tidak boleh ikut terkirim.
  const kartu: KartuRadar[] = baris.map((b) => {
    const k: KartuRadar = {
      address: b.address,
      displayName: b.displayName,
      tierLabel: labelTier(b.tier),
      pernahBertemu: b.pernahBertemu,
      salingInginBertemu: b.salingInginBertemu,
    };
    const n = b.pernahBertemu ? undefined : bersama?.get(b.address);
    if (n !== undefined && n >= 1) k.koneksiBersama = n;
    return k;
  });
```

Di `apps/api/src/routes/radar.ts`, ganti

```ts
import { detak, lihatRadar } from "../radar-gate";
```

dengan

```ts
import { buatPenghitungKoneksiBersama, detak, lihatRadar } from "../radar-gate";
```

ganti

```ts
  const penyapu = buatPenyapuLokasi({ radar: deps.radar, nowMs: deps.nowMs });
```

dengan

```ts
  const penyapu = buatPenyapuLokasi({ radar: deps.radar, nowMs: deps.nowMs });
  // Satu cache per proses untuk koneksi bersama (desain UI §8.3, Ruling A17).
  const hitungBersama = buatPenghitungKoneksiBersama(deps);
```

dan ganti

```ts
    const hasil = await lihatRadar(pemanggil, eventId.toLowerCase() as Hex, deps);
```

dengan

```ts
    const hasil = await lihatRadar(pemanggil, eventId.toLowerCase() as Hex, deps, hitungBersama);
```

- [ ] **Step 6: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/api exec vitest run test/radar-ports.test.ts test/radar-store.test.ts test/radar-gate.test.ts test/radar.route.test.ts test/radar-notif.test.ts
pnpm --filter @nearly/api exec tsc --noEmit
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus, termasuk tes lama "setiap kartu hanya memuat kunci yang diizinkan spec §5.2" (kartunya tidak punya koneksi bersama).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ports.ts apps/api/src/radar-store.ts apps/api/src/radar-gate.ts apps/api/src/routes/radar.ts \
  apps/api/test/support/dunia-radar.ts apps/api/test/support/deps.ts apps/api/test/handshake.route.test.ts \
  apps/api/test/radar-ports.test.ts apps/api/test/radar-store.test.ts apps/api/test/radar-gate.test.ts \
  apps/api/test/radar.route.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(api): koneksi bersama di kartu radar yang belum ditemui — angka saja, cache 60 detik

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — kartu dibangun dengan spread**

Di `apps/api/src/radar-gate.ts`, ganti

```ts
    const k: KartuRadar = {
      address: b.address,
      displayName: b.displayName,
      tierLabel: labelTier(b.tier),
      pernahBertemu: b.pernahBertemu,
      salingInginBertemu: b.salingInginBertemu,
    };
```

dengan

```ts
    const k: KartuRadar = { ...b, tierLabel: labelTier(b.tier) };
```

Run: `pnpm --filter @nearly/api exec vitest run test/radar-gate.test.ts`
Expected: FAIL — minimal `lihatRadar — koneksi bersama (spec desain UI §8.3, §10.2) > himpunan kunci setiap kartu persis; tanpa nama atau alamat koneksi bersama` dan `lihatRadar — isi daftar > setiap kartu hanya memuat kunci yang diizinkan spec §5.2` (kunci `tier` ikut). Rekam, lalu `git checkout -- apps/api/src/radar-gate.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — syarat `pernahBertemu === false`**

Di `apps/api/src/radar-gate.ts`, ganti `  const belumBertemu = baris.filter((b) => !b.pernahBertemu).map((b) => b.address);` dengan `  const belumBertemu = baris.map((b) => b.address);` DAN `    const n = b.pernahBertemu ? undefined : bersama?.get(b.address);` dengan `    const n = bersama?.get(b.address);`.

Run: `pnpm --filter @nearly/api exec vitest run test/radar-gate.test.ts`
Expected: FAIL — `… > hanya kartu yang belum ditemui; absen bila 0` (kartu B mendapat `koneksiBersama`). Rekam, lalu `git checkout -- apps/api/src/radar-gate.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 10: Mutasi — blokir dihitung sebagai koneksi bersama**

Di `apps/api/src/radar-store.ts`, ganti `      const buang = new Set([w, ...kecuali.map(kecil)]);` dengan `      const buang = new Set([w]);`.

Run: `pnpm --filter @nearly/api exec vitest run test/radar-store.test.ts`
Expected: FAIL — `createRadarStore — hitungKoneksiBersama > menghitung irisan koneksi untuk kandidat di kedua sisi, tanpa himpunan blokir`. Rekam, lalu `git checkout -- apps/api/src/radar-store.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 13: API — isi push berbahasa Inggris

**Files:**
- Modify: `apps/api/src/pesan-push.ts`, `apps/api/src/radar-notif.ts`, `apps/api/test/pesan-push.test.ts`, `apps/api/test/radar-notif.test.ts`, `apps/api/test/pesan.route.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `teksPush(displayName: string): string` dan `teksNotifKedekatan(hubungan, displayName): string` berbahasa Inggris (spec §7.4); `judul` ("Nearly") dan `data` push tidak berubah.

(`apps/api/test/push.test.ts` memakai "Pesan baru dari Ani" sebagai MASUKAN port Expo push, bukan keluaran `teksPush` — dibiarkan.)

- [ ] **Step 1: Ubah tes ke kalimat Inggris (gagal dulu)**

Di `apps/api/test/pesan-push.test.ts`, ganti

```ts
  it("nama tampilan, atau fallback bila kosong", () => {
    expect(teksPush("Ani")).toBe("Pesan baru dari Ani");
    expect(teksPush("  ")).toBe("Pesan baru dari koneksimu");
    expect(teksPush("")).toBe("Pesan baru dari koneksimu");
  });
```

dengan

```ts
  it("nama tampilan, atau fallback bila kosong (spec desain UI §7.4)", () => {
    expect(teksPush("Ani")).toBe("New message from Ani");
    expect(teksPush("  ")).toBe("New message from a connection");
    expect(teksPush("")).toBe("New message from a connection");
  });
```

dan ganti

```ts
      tokens: ["ExponentPushToken[b]"], judul: "Nearly", badan: "Pesan baru dari Ani", data: { jenis: "pesan" },
```

dengan

```ts
      tokens: ["ExponentPushToken[b]"], judul: "Nearly", badan: "New message from Ani", data: { jenis: "pesan" },
```

Di `apps/api/test/pesan.route.test.ts`, ganti

```ts
    expect(d.push.kirim.mock.calls[0]![0].badan).toBe("Pesan baru dari Ani");
```

dengan

```ts
    expect(d.push.kirim.mock.calls[0]![0].badan).toBe("New message from Ani");
```

Di `apps/api/test/radar-notif.test.ts`, ganti

```ts
  it("kalimat persis spec 4b+5 §6.4", () => {
    expect(teksNotifKedekatan("saling_ingin_bertemu", "Budi")).toBe("Budi, yang saling ingin bertemu denganmu, ada di acara ini.");
    expect(teksNotifKedekatan("saling_ingin_bertemu", "  ")).toBe("Seseorang yang saling ingin bertemu denganmu ada di acara ini.");
    expect(teksNotifKedekatan("pernah_bertemu", "Budi")).toBe("Budi, yang pernah kamu temui, ada di acara ini.");
    expect(teksNotifKedekatan("pernah_bertemu", "")).toBe("Seseorang yang pernah kamu temui ada di acara ini.");
  });
```

dengan

```ts
  it("kalimat persis spec desain UI §7.4 (makna spec 4b+5 §6.4)", () => {
    expect(teksNotifKedekatan("saling_ingin_bertemu", "Budi")).toBe("Budi is at this event. You both want to meet.");
    expect(teksNotifKedekatan("saling_ingin_bertemu", "  ")).toBe("Someone you both want to meet is at this event.");
    expect(teksNotifKedekatan("pernah_bertemu", "Budi")).toBe("Budi, who you've met, is at this event.");
    expect(teksNotifKedekatan("pernah_bertemu", "")).toBe("Someone you've met is at this event.");
  });
```

ganti

```ts
      [token(R), "Sari, yang pernah kamu temui, ada di acara ini."],
      [token(S), "Rudi, yang pernah kamu temui, ada di acara ini."],
```

dengan

```ts
      [token(R), "Sari, who you've met, is at this event."],
      [token(S), "Rudi, who you've met, is at this event."],
```

dan ganti

```ts
      "Seseorang yang saling ingin bertemu denganmu ada di acara ini.",
      "Seseorang yang saling ingin bertemu denganmu ada di acara ini.",
```

dengan

```ts
      "Someone you both want to meet is at this event.",
      "Someone you both want to meet is at this event.",
```

Periksa tidak ada sisa: `grep -n "ada di acara ini\|Pesan baru dari\|pernah kamu temui" apps/api/test/radar-notif.test.ts apps/api/test/pesan-push.test.ts apps/api/test/pesan.route.test.ts` → WAJIB kosong.

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api exec vitest run test/pesan-push.test.ts test/radar-notif.test.ts test/pesan.route.test.ts`
Expected: FAIL — kalimat masih bahasa Indonesia.

- [ ] **Step 3: Implementasi**

Di `apps/api/src/pesan-push.ts`, ganti

```ts
/** Spec 4c §7.2. Tidak pernah alamat, tidak pernah isi pesan. */
export function teksPush(displayName: string): string {
  const nama = displayName.trim();
  return nama ? `Pesan baru dari ${nama}` : "Pesan baru dari koneksimu";
}
```

dengan

```ts
/**
 * Spec 4c §7.2, bahasa Inggris sejak spec desain UI §7.4. Tidak pernah alamat,
 * tidak pernah isi pesan.
 */
export function teksPush(displayName: string): string {
  const nama = displayName.trim();
  return nama ? `New message from ${nama}` : "New message from a connection";
}
```

Di `apps/api/src/radar-notif.ts`, ganti

```ts
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
```

dengan

```ts
/**
 * Spec 4b+5 §6.4, bahasa Inggris sejak spec desain UI §7.4. Tidak pernah
 * alamat, judul atau lokasi acara, maupun sel.
 */
export function teksNotifKedekatan(hubungan: HubunganKedekatan, displayName: string): string {
  const nama = displayName.trim();
  if (hubungan === "saling_ingin_bertemu") {
    return nama
      ? `${nama} is at this event. You both want to meet.`
      : "Someone you both want to meet is at this event.";
  }
  return nama
    ? `${nama}, who you've met, is at this event.`
    : "Someone you've met is at this event.";
}
```

- [ ] **Step 4: Jalankan tes dan typecheck**

```bash
pnpm --filter @nearly/api exec vitest run test/pesan-push.test.ts test/radar-notif.test.ts test/pesan.route.test.ts test/push.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus, termasuk pemeriksaan "muatan push tidak memuat alamat mana pun" dan "TANPA alamat siapa pun" yang tidak diubah.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pesan-push.ts apps/api/src/radar-notif.ts apps/api/test/pesan-push.test.ts \
  apps/api/test/radar-notif.test.ts apps/api/test/pesan.route.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(api): isi push pesan dan kedekatan berbahasa Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Mutasi — alamat masuk ke isi push**

Di `apps/api/src/pesan-push.ts`, ganti `      tokens, judul: "Nearly", badan: teksPush(nama), data: { jenis: "pesan" },` dengan `      tokens, judul: "Nearly", badan: \`${teksPush(nama)} (${baris.pengirim})\`, data: { jenis: "pesan" },`.

Run: `pnpm --filter @nearly/api exec vitest run test/pesan-push.test.ts`
Expected: FAIL — minimal `kirimPushPesan > muatan push tidak memuat alamat mana pun`. Rekam, lalu `git checkout -- apps/api/src/pesan-push.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 14: Verifikasi global, batas jalur, dan serah terima

**Files:** tidak ada berkas yang diubah (kecuali controller meminta koreksi).

- [ ] **Step 1: Verifikasi global**

Jalankan dari akar worktree dan laporkan ekor keluarannya apa adanya:

```bash
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: kedua perintah pertama lulus di semua paket (`packages/shared`, `packages/trust`, `apps/api`, `apps/mobile`, `apps/web`); ekspor `Exported: …`.

- [ ] **Step 2: Verifikasi batas jalur (spec §13)**

Jalankan setiap perintah terpisah; grep yang kosong keluar dengan status 1 — itu hasil yang diharapkan:

```bash
git diff --stat main...HEAD -- packages apps/web supabase                                          # WAJIB kosong
git diff --name-only main...HEAD | grep -vE '^(apps/mobile/|apps/api/(src|test)/|pnpm-lock\.yaml$|docs/)'   # WAJIB kosong
git diff --name-only main...HEAD -- apps/api/src | grep -vE '^apps/api/src/(ports|pertemuan-store|pertemuan|radar-gate|radar-store|pesan-push|radar-notif|app|index)\.ts$|^apps/api/src/routes/(profile|radar)\.ts$'   # WAJIB kosong
git diff --name-only main...HEAD | grep -E '(^|/)\.env'                                             # WAJIB kosong
git grep -n "Inter_500Medium\|JetBrainsMono_500Medium\|allowFontScaling={false}" -- apps/mobile     # WAJIB kosong
git grep -ln "TIER_LABELS" -- apps/mobile/app apps/mobile/components apps/mobile/src                # WAJIB tepat: apps/mobile/src/tier.ts
git grep -n '"/qr"\|"/scan"\|spike-bna' -- apps/mobile                                              # WAJIB kosong
git grep -n "useColorScheme" -- apps/mobile/app                                                     # WAJIB kosong
ls apps/mobile/providers 2>/dev/null                                                                # WAJIB kosong / tidak ada
git status --short                                                                                  # WAJIB kosong
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 3: Serahkan ke controller** (dilakukan controller, bukan pelaksana)

1. Laporkan ke pemilik project: daftar commit Rencana A, hasil Step 1–2, dan catatan terbuka dari setiap task (versi paket yang dilaporkan CLI/`expo install`, entri plugin tambahan di `app.json`, nama ikon lucide bila ada yang ditolak).
2. **Uji asap navigasi di iPhone (Expo Go), disarankan sebelum Rencana B dieksekusi** — spec §4.1 meminta perilaku `unstable_settings` di grup bersarang diverifikasi di langkah ini:
   1. `npx expo start --go -c` di `apps/mobile` → splash lalu tab **Home** (layar lama berlatar terang, header gelap); kelima tab berpindah; tombol Handshake kuning di tengah tidak menabrak home indicator; tab aktif kuning.
   2. Tab Handshake: segmen **Show QR** menampilkan QR berputar; **Scan** membuka kamera; pindah ke tab lain → lampu kamera iOS mati; kembali → kamera/QR hidup lagi.
   3. Events › Detail acara › "Pindai QR host untuk check-in" → tab Handshake dalam mode Scan.
   4. Dari tab Messages buka percakapan → tombol kembali ke daftar Messages. Dari Profile orang (mis. lewat Koneksi) → "Kirim pesan" → percakapan terbuka; catat apakah tab bar tampil dan ke mana tombol kembali pulang.
   5. Kirim pesan dari HP lain → lencana merah di tab Messages; buka percakapannya → lencana hilang. Ketuk notifikasi pesan → tab Messages. Notifikasi radar (bila bisa dipicu) → tab Events › Radar, kembali → daftar Events.
   6. Ganti dompet (Profile › Dompet) → layar Mulai tanpa tab bar.
   Hasilnya dicatat controller untuk penulisan/pelaksanaan Rencana B; kegagalan di butir 4 atau 5 adalah masukan Rencana B (bukan alasan mengubah Rencana A yang sudah di-commit tanpa persetujuan pemilik).

---

## Serah terima ke Rencana B

Rencana B menulis dan menjalankan spec §9 **langkah 5 (a)–(g)** dan **langkah 6** di atas antarmuka yang dihasilkan Rencana A ini.

### Antarmuka yang dihasilkan Rencana A

**Tema dan token (`apps/mobile/theme/`)**
- `colors.ts`: `Colors` (`{ light, dark }` identik), `lightColors`, `darkColors`, `type ColorKeys`. Kunci Nearly: `verified`, `segmentEmpty`, `placeholder`, `avatarAwal`, `input` (latar isian & tab bar), `selubung` (`rgba(7,9,15,0.70)`, sheet), `spandukLatar`/`spandukGaris` (spanduk cadangan), `destruktifLatar`/`destruktifGaris`.
- `globals.ts`: `HEIGHT`, `FONT_SIZE`, `BORDER_RADIUS`, `CORNERS`, `SPACING` (nama BNA); `jarak { xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 }`; `FONT { regular, semibold, bold, mono }`; `type VarianHuruf`; `HURUF`; `RADIUS { kartu 8, salaman 14, gelembung 12, gelembungSudut 4, lencana 5, sheet 12, batang 3 }`; `UKURAN { sentuh 48, tombolSalaman 52, naikSalaman 26, cincinSalaman 5, avatarKartu 42, avatarSheet 56, avatarKepala 64, batangTrust 6, batangTrustKecil 5, celahRuas 2, tinggiIsiTabBar 56, tinggiKerangka 72 }`; `MAKS_SKALA_HURUF_KECIL = 1.3`.
- `huruf.ts`: `keluargaUntuk(dasar, berat)`.
- `navigasi.ts`: `OPSI_STACK`, `type OpsiTampilan`, `opsiTampilan(kunci)`.

**Hooks (`apps/mobile/hooks/`)**: `useColor(nama: ColorKeys, props?)`, `useColorScheme()` (selalu `"dark"`), `useHaptics(aktif)` + `triggerHaptic(intent)` (BNA: `"success"`, `"impact-light"`, …), `useGerakDikurangi(): boolean`.

**Salinan BNA (`apps/mobile/components/ui/`)**: `Text` (`variant`: `heading | title | subtitle | body | caption | label | mono | link`; `fontWeight` diterjemahkan ke Inter), `Button` (`variant`: `default | destructive | success | outline | secondary | ghost | link`; `size`; `haptic` bawaan hanya `default`; `loading`; `icon`), `Input` (semua `TextInputProps` + `label`, `error`, `icon`, `rightComponent`, `variant` bawaan `outline`, `type="textarea"`), `ToastProvider` (sudah di root) + `useToast().toast({ title, description?, variant: "success" | "error" | "warning" | "info" | "default", duration? })`, `Card`/`CardHeader`/… (garis, tanpa bayangan), `Skeleton({ width?, height?, style? })`, `Separator`, `View`, `Icon`, `ButtonSpinner`. Belum disalin: `badge`, `progress`, `switch`, `alert-dialog`, `avoid-keyboard` — tambahkan dengan `pnpm dlx bna-ui@3.0.0 add <nama> --pnpm -y` dari `apps/mobile`, kembalikan berkas terlacak yang ditimpa CLI, lalu ganti setiap warna literal dengan token (penjaga `tema.test.ts` mencakup `components/ui/**`).

**Komponen bersama (`apps/mobile/components/`)**
- `Avatar({ nama: string | null; alamat: string; ukuran: 42 | 56 | 64; cincin: "primary" | "verified" | "avatarAwal" })`
- `Lencana({ varian: "terverifikasi"; ekor?: string } | { varian: "ringkas" } | { varian: "teks"; teks: string })`
- `BatangTrust({ tier: number; kecil?: boolean; denganLabel?: boolean })`
- `KartuOrang({ nama; alamat; terverifikasi; lencana?: ReactNode; keterangan?: string; tier?: number; onPress? })`
- `Segmen<T extends string>({ pilihan: readonly { nilai: T; label: string }[]; nilai: T; onGanti })`
- `KeadaanKosong({ Ikon; kalimat; aksi?: { label; onPress } })`, `KeadaanGalat({ kalimat; onCobaLagi })`, `KerangkaDaftar({ baris? })`
- `TautanKecil({ label; onPress; accessibilityLabel? })`
- `LogoN({ ukuran; warna?: "primary" | "text" })`, `PATH_N`
- `StackTab({ grup: GrupTab })`, `tab/IkonTab`, `tab/TombolSalaman`
- `salaman/ModeQr({ signerSalaman })`, `salaman/ModePindai({ signerHadir, signerSalaman })` — **tampilan dan kalimat lama**, tercatat di `KOMPONEN_BELUM_DIMIGRASI`.

**Fungsi dan konstanta murni (`apps/mobile/src/`)**
- `jamak.ts`: `jamak(n, tunggal, banyak)`, `pasanganJamak(n, tunggal, banyak) → { angka, kata }`
- `waktu.ts`: `formatTanggal(t, sekarang)`, `formatJam(t)`, `formatTanggalJam(t, sekarang)`, `waktuRelatif(t, sekarang)`, `sapaan(t)`
- `tier.ts`: `LABEL_TIER_EN`, `labelTier`, `tierDariLabel`, `labelAksesTrust`, `ruasTerisiTrust`, `JUMLAH_RUAS_TRUST`, `SUGGESTED_TAGS` (Inggris), `tierView` (Inggris)
- `teks-ui.ts`: `TEKS_COBA_LAGI`, `LENCANA_BERTEMU`, `LENCANA_RINGKAS`, `hurufAvatar(nama, alamat)`
- `messages.ts`: `judulSheetBertemu(nama, alamat)` (+ `alamatSingkat`, `namaKartuRadar`, `teksLencana` yang sudah ada — masih berbahasa Indonesia kecuali yang baru)
- `aksesibilitas.ts`: `TARGET_SENTUH`, `hitSlopSampai(lebar, tinggi?)`
- `splash.ts`: `bolehSembunyikanSplash(fontSelesai, keadaan)`
- `salaman-mode.ts`: `type ModeSalaman`, `PILIHAN_MODE_SALAMAN`, `modeSalamanDariParam(param)`
- `judul-layar.ts`: `JUDUL_LAYAR`, `LAYAR_AKAR`, `RUTE_TANPA_DOMPET`, `layarMenurutDompet`, `TAB_BAWAH`, `type GrupTab`, `type NamaIkonTab`, `layarDalam`, **`LAYAR_TERMIGRASI`** (kosong)
- `lencana/lencana-tab.ts`: `JEDA_LENCANA_MS`, `bolehMuatLencana`, `LENCANA_KOSONG`; `lencana/konteks-lencana.tsx`: `useLencanaTab(signer)` (hanya di `(tabs)/_layout.tsx`), `PenyediaLencana`, **`useLencana() → { belumDibaca, kecocokanBaru, muatUlangLencana, muatBilaPerlu }`**

**Navigasi**: pohon spec §4.1 lengkap; `/salaman` (`?mode=pindai`); header gelap semua layar; latar gelap hanya `LAYAR_TERMIGRASI`; Beranda tanpa header; akar tab lain `headerLargeTitle`; ketukan notifikasi `router.navigate` (Ruling A9).

**Tes dan penjaga**: `test/support/berkas.ts` (`semuaBerkas`, `baca`, `tanpaKomentar`, **`KOMPONEN_BELUM_DIMIGRASI`**, `kodeTampilanBaru`, `berkasTanpaWarna`, `layoutApp`, `layarTermigrasi`), `test/support/rute.ts` (`semuaPolaRute`, `cocokRute`); `tema.test.ts`, `aksesibilitas.test.ts`, `komponen.test.ts`, `tautan.test.ts`, `salaman-mode.test.ts`, `lencana-tab.test.ts`, `app-json.test.ts`, `ikon.test.ts`, `huruf.test.ts`, `splash.test.ts`, `jamak.test.ts`, `waktu.test.ts`, `teks-ui.test.ts`; penjaga `TIER_LABELS` di `tier.test.ts`.

**API (bentuk kawat untuk tipe HP Rencana B)**
- `GET /profile/:address` dengan bukti `LihatProfil` sah, tambahan: `pertemuan: null | { salaman: { atMs: number; acara: { eventId, title, venueLabel } | null }; acaraBersama: { eventId, title, venueLabel, startsAt: string /* detik unix */ }[] /* maks. 10, terbaru dulu, tanpa acara salaman */; jumlahAcaraBersama: number }` dan `dijaminKenalan: number` (absen untuk profil sendiri dan saat store gagal). Untuk lencana "✓ met in person · N events together" (R8: jumlah acara yang keduanya hadiri): **N = `jumlahAcaraBersama + (salaman.acara ? 1 : 0)`**.
- `GET /radar/:eventId`: `KartuRadar.koneksiBersama?: number` (hanya kartu belum ditemui, hanya ≥ 1). `jumlah` = jumlah kartu (untuk "N people visible here").
- Isi push sudah Inggris.

### Yang dikerjakan Rencana B (spec §9 langkah 5–6)

- **5(a) Salaman:** tampilan baru `mode-qr`/`mode-pindai` (pelat QR `text` radius 12, catatan lokasi, kalimat Inggris R5), `components/salaman/sheet-bertemu.tsx` (`Modal` RN, `judulSheetBertemu`, `GET /profile` publik R14, haptic Success, `animationType` menurut `useGerakDikurangi`, penjaga `onScan`), toast + haptic check-in, tes `salaman.test.ts` (spec §10.1), keluarkan kedua mode dari `KOMPONEN_BELUM_DIMIGRASI`, tambah `(tabs)/(salaman)/salaman` ke `LAYAR_TERMIGRASI`.
- **5(b) Beranda:** layout §6.1 (sapaan `sapaan()`, alamat singkat + "Copy" dengan `npx expo install expo-clipboard`, spanduk, LIVE, Recently met dengan `KartuOrang`/`waktuRelatif`, Feed), `SafeAreaView`, `useFocusEffect` ≤ 1×/30 detik.
- **5(c) Profil (tab) + Profil orang:** urutan #16A, kartu Trust bernilai dominan (`pasanganJamak`), tipe HP untuk `pertemuan`/`dijaminKenalan` dan kalimatnya ("Vouched for by …", "Handshake at …", "Met in person", "Both attended · …", " · N events together"), titik lencana tab Profil di baris "You both want to meet".
- **5(d) Acara + Radar:** `formatTanggalJam` menggantikan `toLocaleString`, tipe `KartuRadarApi.koneksiBersama`, "N people visible here", "Updated …", "here now", "N mutual connections", pemisahan kartu dua bagian, `tierDariLabel` + `BatangTrust`.
- **5(e) Pesan:** gelembung, `Input` BNA, tombol kirim `hitSlopSampai(40)`, menu ⋯, "🔒 end-to-end encrypted", tanpa "Dibaca" (R6).
- **5(f) Sisanya:** Feed, Unggahan baru, Buat acara, QR check-in, Koneksi, Kecocokan, Dompet, Diblokir, Lapor, Mulai (`LogoN`, kalimat Mulai), keadaan galat gerbang; hapus `src/warna.ts` + `test/warna-isian.test.ts` bersama `<TextInput>` terakhir (Ruling A3); `gerbang-dompet.test.ts` `<TextInput` → `<Input`; setelah kelompok ini `LAYAR_TERMIGRASI` memuat semua kunci — lalu penjaga "seluruh `app/`" di `tema.test.ts`/`aksesibilitas.test.ts` dinyalakan (dan `opsiTampilan` boleh menyederhanakan latar gelap menjadi bawaan `OPSI_STACK`).
- **5(g) Sapuan bahasa:** sisa teks Indonesia di `app/`, `components/`, `src/`, `app.json`; **`bahasa.test.ts`** (spec §7.4, §10.1 — penjaga kata Indonesia, `toLocale*`, nilai `infoPlist`) dinyalakan untuk seluruh pohon di akhir langkah ini, bukan di Rencana A, karena ia merah sampai semua layar diterjemahkan.
- **Langkah 6:** amandemen spec §15 (butir 1–4, periksa 5–6), `docs/demo/runbook.md`, uji iPhone §10.3 oleh pemilik.
- Terjemahan modul kalimat bersama (`messages.ts`, `errors.ts`, `dompet/teks-dompet.ts`, dan tesnya) di tugas pertama yang menyentuhnya (spec §7.4 butir 4).
