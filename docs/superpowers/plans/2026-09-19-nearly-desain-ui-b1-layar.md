# Desain UI Nearly — Rencana B1 (Migrasi Layar, Bagian 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasi tiga kelompok layar pertama spec §9 langkah 5 ke tampilan baru dan bahasa Inggris — **(a) Handshake** (dua mode + sheet "You met …"), **(b) Beranda**, dan **(c) Profil** (`profil-saya`, `connections`, `kecocokan`, `dompet`, `blokir`, dan `profile/[address]`) — di atas fondasi Rencana A. Setiap layar yang dimigrasi berpindah ke salinan BNA + token, diterjemahkan di tugas yang sama, dan kuncinya masuk `LAYAR_TERMIGRASI` sehingga penjaga tampilan baru ikut menjaganya. Di antara (b) dan (c) ada **gerbang STOP**: pemilik project menguji di iPhone sebelum kelompok berikutnya dikerjakan.

**Architecture:** Setiap layar akar tab yang dimigrasi dibangun di dalam `ScrollView` dengan `contentInsetAdjustmentBehavior="automatic"` supaya judul besar iOS memberi ruang yang benar (spec §4.7, amandemen 2026-09-19) — syarat sebelum kuncinya masuk `LAYAR_TERMIGRASI`. Teks **baru** setiap kelompok tinggal di modul murni `src/teks-salaman.ts`, `src/teks-beranda.ts`, `src/teks-profil.ts` (pola `src/teks-ui.ts` Rencana A) dan diuji vitest; kalimat **lama** diterjemahkan di tempatnya (`src/messages.ts`, `src/errors.ts`, `src/dompet/teks-dompet.ts`) bersama tesnya. Sheet salaman berhasil adalah `Modal` React Native (R13) di `components/salaman/sheet-bertemu.tsx` yang mengambil nama lewat **satu** `GET /profile/:initiator` publik (R14). Tipe respons HP untuk `pertemuan` dan `dijaminKenalan` (spec §8.1, §8.2) ditulis di `src/teks-profil.ts` bersama kalimat yang membacanya, sehingga bentuk kawat dan kalimatnya diuji di satu tempat.

**Tech Stack:** pnpm monorepo · TypeScript strict (`noUncheckedIndexedAccess`) · Expo SDK 57 / expo-router 57.0.18 / React Native 0.86.3 (Expo Go) · salinan BNA UI di `components/ui/*` · react-native-reanimated 4.5.1 + react-native-worklets 0.10.1 · lucide-react-native · `@expo-google-fonts/inter` + `@expo-google-fonts/jetbrains-mono` · **`expo-clipboard` (dipasang di Task 7)** · Hono + Supabase (API, **tidak disentuh**) · Vitest

**Spec:** `docs/superpowers/specs/2026-09-18-nearly-desain-ui-design.md` (otoritas mengikat, termasuk amandemen 2026-09-18 §8.2/§8.3 dan 2026-09-19 §4.6/§4.7). **Rencana A:** `docs/superpowers/plans/2026-09-18-nearly-desain-ui-a-fondasi.md` — bagian "Serah terima ke Rencana B" mendaftar antarmuka yang dipakai rencana ini. Ledger Rencana A: `.superpowers/sdd/2026-09-18-nearly-desain-ui-a-fondasi/progress.md`.

**Kelompok yang TIDAK di rencana ini:** spec §9 langkah 5 (d) Acara + Radar, (e) Pesan, (f) sisanya, (g) sapuan bahasa, dan langkah 6 (dokumen) — lihat "Serah terima ke Rencana B2" di akhir.

## Global Constraints

### Keputusan terkunci yang dipakai rencana ini (spec §2, verbatim)

| # | Keputusan |
|---|---|
| 1 | **Karakter B2 "Seimbang":** gelap bernuansa teknis tapi berbahasa manusia; lencana "✓ terverifikasi"; trust sebagai batang; alamat mono hanya untuk alamat sendiri di beranda; detail on-chain saat kartu dibuka. *Diubah oleh #16C:* alamat sendiri di Beranda tampil **singkat** (mono) dengan tombol Copy; alamat utuh tinggal di Dompet dan Profil (R4). |
| 8 | **Peta layar:** … Salaman = SATU layar dua mode "Tampilkan QR ⟷ Pindai" menggabungkan `app/qr.tsx` + `app/scan.tsx` … *Diubah oleh #16D:* setelah salaman berhasil, pemindai melihat sheet "You met …" di atas tab Salaman; `profile/[address]` dibuka lewat tombol "View profile" di sheet, bukan otomatis. |
| 11 | **Pola layar lain:** daftar / formulir / detail … Empat keadaan seragam: memuat = skeleton; kosong = ikon + kalimat + aksi; galat = kalimat galat yang ada + Coba lagi; berhasil = toast hijau + haptic untuk aksi penting. |
| 12 | **Teks/kalimat, logika, dan perilaku layar yang ada TIDAK berubah** kecuali yang disebut di atas. *Diubah oleh #15:* kalimat yang ada **diterjemahkan 1:1 maknanya** ke bahasa Inggris — logika dan perilaku tetap, tidak ada penulisan ulang kalimat di luar terjemahan dan teks baru yang didaftar (§7.3). |
| 15 | **Bahasa aplikasi mobile: Inggris.** Istilah terkunci: Salaman (aksi/layar) → Handshake; Terlihat / Tersembunyi → Visible / Hidden; tier → New · Known · Trusted · Core; Vouch · Lapor · Blokir / Cabut blokir → Vouch · Report · Block / Unblock; Ingin bertemu / Saling ingin bertemu → Want to meet / You both want to meet; Koneksi · koneksi bersama → Connections · mutual connections; Dompet · 12 kata pemulihan → Wallet · 12-word recovery phrase; lencana "✓ terverifikasi" → "✓ met in person"; "✓ bertemu langsung · N acara bersama" → "✓ met in person · N events together"; "Bertemu langsung" → "Met in person"; "Dijamin N orang yang juga kamu kenal" → "Vouched for by N people you know"; kemarin / N hari lalu → yesterday / N days ago. |
| 16A | **Urutan Profil orang + hierarki trust:** baris aksi (Send message utama + Want to meet) pindah tepat di bawah blok kepala, SEBELUM kartu Trust; Vouch/Report/Block tetap paling bawah. Di kartu Trust nilainya dominan: label kecil redup "Trust" (`caption`) di atas nilai tier berukuran/berbobot `title`, lalu batang tier, baris bukti, "Vouched for by …". Aturan "nilai lebih keras dari label" berlaku di setiap pasangan label/nilai (§7.1). |
| 16C | **Alamat sendiri di Beranda disingkat** (`0x9bE5…6ffA`, mono) dengan tombol kecil "Copy" (ketuk → alamat utuh ke clipboard lewat `expo-clipboard`, toast "Address copied" + haptic ringan). Alamat utuh tetap di Dompet dan Profil (tab). |
| 16D | **Sheet salaman berhasil (momen puncak):** bottom sheet di atas tab Handshake — dua avatar bertumpuk (milikmu bercincin `primary`, miliknya bercincin `verified`), judul "You met ‹nama›" (tanpa nama → alamat singkat), lencana "✓ met in person", baris redup berisi informasi "Connected. 0x…" yang sudah ada, tombol utama "View profile" dan sekunder "Scan someone else"; haptic Success saat sheet terbuka; tanpa animasi kustom; nama diambil dengan satu panggilan publik `GET /profile/:alamat` (R14); hanya di sisi pemindai. Check-in lewat QR host tetap seperti sekarang. |
| 16E | **Aturan dasar aksesibilitas & ergonomi** (§3.7): target sentuh ≥ 44×44 pt iOS / 48×48 dp Android; skala jarak 4/8/12/16/24/32; maks. 4 ukuran huruf per layar, bobot 400 dan 600 (700 hanya `heading`); teks ikut ukuran huruf sistem (label tab & lencana dibatasi 1,3×); Reduce Motion; safe area; `accessibilityLabel` untuk tombol ikon dan batang trust. |

- **R1.** `profile/[address]` tinggal di Stack akar, di atas tab; dibuka dari mana saja, menutupi tab bar.
- **R4.** Nama tampilan selalu didampingi alamat singkat (`0x12ab…cdef`, mono, redup) di setiap kartu orang. **Alamat utuh** hanya di layar detail (Profil orang, Dompet, Profil tab) dan di bawah QR mode Show QR.
- **R5.** Terjemahan Inggris kalimat yang sudah ada **menang atas teks contoh di mockup**. Teks **baru** hanya yang didaftar di §7.3.
- **R8.** "N events together" = jumlah acara yang kalian berdua hadiri (check-in), bukan jumlah salaman. Satu pasangan hanya bisa salaman **sekali, selamanya**.
- **R9.** Lencana "✓ met in person" berarti "kamu dan orang ini sudah salaman" — bukan verifikasi identitas.
- **R10.** Isi tab dipasang hanya saat tab fokus bila isinya berjalan terus (Salaman: QR berputar + kamera).
- **R13.** Sheet salaman berhasil memakai `Modal` React Native, bukan komponen BNA.
- **R14.** Judul sheet: alamat singkat dulu, lalu nama dari **satu** `GET /profile/:initiator` **tanpa bukti**; jawaban basi (sheet sudah ditutup, atau alamat berbeda) dibuang dengan membandingkan alamat sebelum `set`. Galat/waktu habis/nama kosong → judul tetap alamat singkat, tanpa pesan galat.

### Nilai token yang mengikat (spec §3.1, §3.3, §3.4, §3.7, verbatim)

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
| `selubung` (sheet) | `rgba(7,9,15,0.70)` |
| `spandukLatar` / `spandukGaris` | `rgba(243,186,47,0.10)` / `rgba(243,186,47,0.40)` |
| `destruktifLatar` / `destruktifGaris` | `rgba(240,106,106,0.12)` / `rgba(240,106,106,0.35)` |

**Warna tidak pernah ditulis sebagai literal di luar `theme/colors.ts`** — selalu `useColor("<token>")` (dijaga `test/tema.test.ts`, yang mencakup setiap berkas di `LAYAR_TERMIGRASI` begitu kuncinya ditambahkan).

- Huruf: `heading` 30/700, `title` 18/600, `body` 15/400, `caption` 13/400 redup, `label` 11/600; `mono` JetBrains Mono 13/400 redup. Tidak ada `fontSize` literal di layar; penekanan di `body` memakai `style={{ fontWeight: "600" }}` (diterjemahkan ke `Inter_600SemiBold` oleh `Text`).
- Jarak: **hanya** 4 / 8 / 12 / 16 / 24 / 32 (`jarak.xs` … `jarak.xxl`), nilai mutlak (`-16` sah untuk tumpang tindih avatar). Tepi layar 16, isi kartu 16, antarbutir 8–12, antarbagian 24–32.
- Target sentuh 48 (`UKURAN.sentuh`, `hitSlopSampai` dari `src/aksesibilitas.ts`); `allowFontScaling` tidak pernah dimatikan; `maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}` hanya untuk label kecil dan lencana.
- Radius: kartu/tombol/isian 8, sheet (sudut atas) 12, lencana 5, batang trust 3.
- Haptic: `notificationAsync(Success)` saat sheet salaman terbuka dan toast berhasil lain; `impactAsync(Light)` untuk "Copy" alamat; getar bawaan tombol BNA hanya varian `default`.
- Animasi: hanya yang dibawa salinan BNA + geser bawaan `Modal`. Reduce Motion (`useGerakDikurangi`) mengubah `animationType` sheet dari `"slide"` ke `"fade"`.

### Batas jalur (spec §13 dipersempit untuk Rencana B1)

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` (termasuk `package.json` dan `app.json` bila `expo install` menyentuhnya) | **`apps/api/**` — API sudah selesai.** Bila sebuah layar tampak butuh perubahan API, **BERHENTI dan laporkan**; jangan mengarang medan baru dan jangan menambalnya di HP. |
| `pnpm-lock.yaml` — **hanya** akibat `npx expo install expo-clipboard` (Task 7), atau `pnpm dlx bna-ui@3.0.0 add <nama> --pnpm -y` bila sebuah layar benar-benar butuh komponen BNA baru | `packages/**` (termasuk `packages/trust/**` dan `TIER_LABELS`, `packages/contracts/**`, `packages/shared/**`) |
| `docs/superpowers/plans/2026-09-19-nearly-desain-ui-b1-layar.md` (hanya bila controller meminta koreksi) | `apps/web/**`, `supabase/**` |
| | `.env` mana pun — root, `apps/mobile/.env`, `apps/api/.env` (**dibaca pun tidak**) |
| | `docs/superpowers/specs/**` (amandemen spec adalah langkah 6, Rencana B2) |

**Komponen BNA yang diperkirakan dibutuhkan B1: TIDAK ADA.** Salinan yang sudah ada (`button`, `text`, `input`, `card`, `skeleton`, `separator`, `toast`, `icon`, `spinner`, `view`) cukup: batang trust memakai `components/batang-trust.tsx` (bukan `progress`), lencana memakai `components/lencana.tsx` (bukan `badge`), pemilih Visible/Hidden tetap `Pressable` bergaya radio yang sudah ada (bukan `switch`), dialog konfirmasi tetap `Alert.alert` (bukan `alert-dialog`), dan penghindar keyboard tetap `automaticallyAdjustKeyboardInsets` yang sudah ada (bukan `avoid-keyboard`). Bila ternyata sebuah layar butuh salah satunya, **berhenti dan laporkan dulu**; kalau controller menyetujui: `pnpm dlx bna-ui@3.0.0 add <nama> --pnpm -y` dari `apps/mobile`, kembalikan berkas terlacak yang ditimpa CLI (`git checkout -- <berkas>`), lalu ganti setiap warna literal salinannya dengan token.

### Batas keras eksekusi

- **JANGAN membaca, mencetak, atau menyunting `.env` mana pun.** `npx expo export` memuat `apps/mobile/.env` sendiri; itu boleh, tetapi keluarannya tidak disalin ke laporan selain nama variabel yang dicetak Expo.
- **JANGAN menjalankan server di port 8787 atau 8081** (pemilik memakainya): tidak `pnpm dev`, tidak `npx expo start`, tidak Metro, tidak simulator. Uji tampil di iPhone dilakukan pemilik project (Task 12).
- **Verifikasi bundel** untuk task yang menambah dependensi atau mengubah impor:
  `EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")` — Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`. Direktori itu di luar repo; **jangan** menghapusnya dengan `rm -r`.
- Dilarang `git reset --hard`, `git clean`, `rm -r`, force-push, `git commit --amend`, dan **push** (controller yang push). `rm` hanya untuk berkas tunggal yang disebut di langkah; `rmdir` hanya untuk direktori kosong.
- Setiap commit memakai `git add` / `git rm` / `git mv` dengan **nama berkas eksplisit** (tidak pernah `git add -A` / `git add .` / `git add <direktori>`), pesan commit berbahasa Indonesia yang diakhiri satu baris kosong lalu `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Kunci dompet dan 12 kata tidak pernah dicatat** ke log, konsol, atau laporan. Layar Dompet tetap hanya menampilkannya di layar setelah konfirmasi.
- **Signer tidak pernah dibuat di badan komponen**: selalu `useNearlySigner`, pola pembungkus + isi. Pembungkus **hanya** boleh memanggil `useNearlySigner`/`useDompet`, lalu `if (!signer) return null;` dan `return <XIsi key={signer.address} … />` (dijaga `test/dompet-tanpa-kunci-dev.test.ts`). `app/profile/[address].tsx` tetap satu-satunya pengecualian (signer boleh `null`).
- **Impor tanpa ekstensi `.js`.** Kode di `src/**` **tidak pernah** mengimpor `@/…`; layar dan komponen mengimpor `@/components/…`, `@/hooks/…`, `@/theme/…` lewat alias, dan `src/**` lewat jalur relatif — sama dengan kode yang ada.
- Setiap task berakhir dengan **`pnpm -r test` dan `pnpm -r typecheck` hijau**.
- **Protokol mutasi** (dijalankan SETELAH commit task): terapkan mutasi persis seperti tertulis → jalankan perintah tes yang disebut → **rekam nama tes yang merah** → kembalikan dengan `git checkout -- <berkas>` → jalankan ulang sampai hijau → `git status --short` kosong. Kalau mutasi TIDAK memerahkan tes yang disebut, laporkan — jangan menyetel tesnya sampai merah.
- Bila sebuah teks "lama" yang harus diganti di langkah Edit **tidak ditemukan persis**, **berhenti dan laporkan** isi berkas di sekitar tempat itu — jangan menebak. Ini berlaku khusus untuk suntingan salinan BNA di `components/ui/**` (bila sampai dibutuhkan) dan untuk setiap `Edit` terhadap berkas yang tidak ditulis ulang utuh.

### Konvensi repo

- Pengenal, komentar, dan judul `describe`/`it` **berbahasa Indonesia**; teks yang dilihat pengguna **berbahasa Inggris**. Judul tes tidak menyebut jumlah.
- Nama rute dan parameter tetap Indonesia (`/salaman?mode=pindai`, `/profil-saya`, `/dompet`, `/blokir`, `/kecocokan`); nilai kawat API tetap Indonesia (`visibilitas: "terlihat"`, `tierLabel`, kode galat).
- Semua perintah dijalankan dari **akar worktree** `/Users/mac/developer/nearly-desain` kecuali disebut `cd apps/mobile`. Tes mobile: `pnpm --filter @nearly/mobile exec vitest run <path>`; typecheck mobile: `pnpm --filter @nearly/mobile exec tsc --noEmit`.
- Tes mobile **hanya fungsi murni atau baca-kode** (tidak ada harness render RN).
- Setiap kalimat baru ditaruh di modul murni `src/` dan diuji vitest — **tidak pernah ditulis langsung di JSX** (spec §7.3).

---

## Pemetaan Spec → Task

| Spec | Isi | Task |
|---|---|---|
| §6.2, §7.3, §7.4 (galat salaman & check-in) | `src/teks-salaman.ts`, terjemahan `PESAN` + `EVENT_MESSAGES` + kalimat jaringan bersama | 1 |
| §6.2 butir 1–8, R13, R14, §10.1 (`salaman.test.ts`) | `components/salaman/sheet-bertemu.tsx` | 2 |
| §6.2, §4.6, §4.7, §10.1, §7.2 (toast) | `mode-qr.tsx`, `mode-pindai.tsx`, `salaman.tsx`, `hooks/useKabar.ts`, `LAYAR_TERMIGRASI`, `KOMPONEN_BELUM_DIMIGRASI` | 3 |
| §6.1, §7.1, §7.3, §4.6, #16C | `src/teks-beranda.ts`, `src/muat-fokus.ts` | 4 |
| §6.1, §7.2, §4.6, §4.7, #16C | Layar Beranda + `npx expo install expo-clipboard` | 5 |
| §10.3 butir 1–5, §9 langkah 5 | ⛔ **Gerbang STOP — uji iPhone pemilik** | 6 |
| §8.1, §8.2, §6.3, §7.1, §7.3 | `src/teks-profil.ts` (tipe `Pertemuan`, `dijaminKenalan`, kalimatnya) + terjemahan meet/blokir/vouch | 7 |
| §6.3, #16A, §7.2 | `app/profile/[address].tsx` | 8 |
| §7.1 ("Profil (tab)"), §7.4 | `app/(tabs)/(profil)/profil-saya.tsx` + `src/teks-akun.ts` + terjemahan kalimat profil | 9 |
| §7.1 (pola daftar), §7.2, §11 batas #9 | `connections.tsx` + `kecocokan.tsx` | 10 |
| §7.1 (pola detail), §7.2, §7.4 | `dompet.tsx` + `blokir.tsx` + `src/dompet/teks-dompet.ts` | 11 |
| §9 (hijau per langkah), §13 | Verifikasi kelompok, batas jalur, serah terima ke B2 | 12 |

## Ruling (keputusan rencana di luar teks spec)

- **B1-1. `src/messages.ts` diterjemahkan per KELOMPOK EKSPOR, bukan sekaligus seluruh berkas.** Spec §7.4 butir 4 berkata modul kalimat bersama diterjemahkan "di tugas pertama yang menyentuhnya". `src/messages.ts` bukan satu modul melainkan sembilan domain yang kebetulan satu berkas (handshake, acara, feed, meet, blokir, pesan, radar, profil, lapor), masing-masing dengan berkas tesnya sendiri. Menerjemahkan seluruh berkas di Task 1 berarti menyentuh sembilan tes dan sembilan layar yang belum dimigrasi dalam satu commit — tidak bisa direview. Karena itu **unit terjemahannya adalah peta/fungsi yang diekspor**, dan tugas yang pertama kali *merender* kelompok itu yang menerjemahkannya bersama tes kelompok itu.
  - **B1 menerjemahkan:** `KALIMAT_SERVER_TAK_TERJANGKAU` + `GALAT_JARINGAN`, `PESAN`/`handshakeErrorMessage`, `EVENT_MESSAGES`/`eventErrorMessage` (Task 1); `teksInginBertemuCount`, `tombolTandaLabel`, `meetSuccessMessage`, `MEET_MESSAGES`/`meetErrorMessage`, `BLOKIR_MESSAGES`/`blokirErrorMessage`, `blokirTombolLabel`, `namaKartuRadar`, dan `src/errors.ts` `PESAN_GAGAL`/`pesanGagal` (Task 9); `kalimatVisibilitas`, `KALIMAT_BATAS_TERSEMBUNYI`, `pesanNamaTidakSah`, `PROFIL_MESSAGES`/`profilErrorMessage`, `labelSimpanProfil` (Task 10); `src/dompet/teks-dompet.ts` seluruhnya (Task 12).
  - **B2 menerjemahkan sisanya:** `FEED_MESSAGES`/`feedErrorMessage`, `alasanMuncul`, `PESAN_MESSAGES`/`pesanErrorMessage`, `labelKirimPesan`, `sisaKarakterPesan`-terkait, `petunjukLaporan`, `teksPenandaHadir`, `teksKutandaiHadir`, `KALIMAT_RADAR`/`kalimatRadar`, `lencanaKartuRadar`.
  - `alamatSingkat`, `teksLencana`, `sisaKarakterNama`, dan `judulSheetBertemu` tidak memuat teks Indonesia dan tidak perlu diterjemahkan.
- **B1-2. Teks BARU per kelompok tinggal di modul `src/teks-*.ts` sendiri** (`teks-salaman.ts`, `teks-beranda.ts`, `teks-profil.ts`), bukan ditambahkan ke `src/messages.ts`. Berkas kalimat lama sudah 420 baris dan bercampur sembilan domain; menumpuk teks baru di sana membuat daftar §7.3 tidak bisa dibaca sebagai daftar. Pola sama dengan `src/teks-ui.ts` (Rencana A).
- **B1-3. Kunci masuk `LAYAR_TERMIGRASI` hanya setelah layarnya benar-benar `ScrollView` + `contentInsetAdjustmentBehavior="automatic"`** (spec §4.7, amandemen 2026-09-19). Karena `LAYAR_TERMIGRASI` juga menyalakan latar gelap (Ruling A2) dan penjaga tampilan baru (Ruling A4), penambahan kunci selalu di task yang sama dengan penulisan ulang layarnya, tidak pernah lebih awal.
- **B1-4. Kamera mode Scan berukuran persegi (`aspectRatio: 1`), bukan `flex: 1`.** Syarat judul besar (B1-3) menaruh isi Salaman di dalam `ScrollView`; anak `flex: 1` di dalam `ScrollView` tidak punya tinggi. Persegi selebar layar juga jendela pindai yang lebih masuk akal daripada seluruh layar, dan menyisakan ruang untuk hasil + tombol tanpa menggulir.
- **B1-5. Beranda tetap TANPA judul besar** (`headerShown: false`, sapaan `heading` menggantikannya — spec §4.7), tetapi tetap `ScrollView` + `SafeAreaView` supaya isinya tidak berada di bawah notch (§3.7) dan bisa digulir pada ukuran huruf besar.
- **B1-6. Setiap bagian Beranda memuat dan gagal sendiri** (spec §6.1). Kegagalan satu bagian membuat bagian itu tidak tampil (atau tampil sebagai kartu galat kecil untuk bagian yang punya aksi), **tidak pernah** mengosongkan layar. Nama dan tier per orang di "Recently met" diambil per orang; kegagalannya membuat kartu tetap tampil tanpa nama/tier.
- **B1-7. Pengambilan nama R14 hidup DI DALAM `sheet-bertemu.tsx`**, bukan di `mode-pindai.tsx`. Sheet-lah yang tahu kapan ia terbuka dan tertutup, jadi "jawaban basi dibuang" cukup dibandingkan dengan alamat prop-nya sendiri; `mode-pindai` tidak menumbuhkan state baru. Spec §10.1 memang menempatkan penjaga R14 di berkas sheet.
- **B1-8. Tipe HP untuk `pertemuan` dan `dijaminKenalan` ditulis di `src/teks-profil.ts`**, bukan di layar. Bentuk kawat dan kalimat yang membacanya jadi satu berkas yang bisa diuji tanpa merender; layar hanya menyusunnya. `type Profile` tetap di layar (komentar panjangnya adalah dokumentasi absen-lawan-nol yang tidak boleh terpisah dari pemakainya) dan mengimpor kedua tipe itu.
- **B1-9. "N events together" = `jumlahAcaraBersama + (salaman.acara ? 1 : 0)`** (serah terima Rencana A, R8): `acaraBersama` sengaja **tidak** memuat acara salaman, jadi menghitung panjangnya saja akan kehilangan satu.
- **B1-10. Toast berhasil + haptic dipusatkan di `hooks/useKabar.ts`** (`berhasil(judul)` = toast `success` + `notificationAsync(Success)`; `disalin(judul)` = toast `success` + `impactAsync(Light)`). Tanpa ini setiap layar mengulang dua panggilan dan cepat atau lambat ada yang lupa haptiknya, atau memakai haptic yang salah untuk "Copy" (#16C secara eksplisit memakai impact ringan, bukan Success).
- **B1-11. Batas muat saat fokus dipusatkan di `src/muat-fokus.ts`** (`JEDA_MUAT_FOKUS_MS = 30_000`, `bolehMuatFokus(terakhirMs, sekarangMs)`). `src/lencana/lencana-tab.ts` punya fungsi setara untuk lencana; menamai ulang atau memakai ulang fungsi lencana di layar akan mencampur dua kebijakan yang kebetulan bernilai sama.
- **B1-12. Keadaan kosong memakai ikon lucide berikut** (§7.2 hanya menyebut "ikon lucide redup"): Beranda/Koneksi "Recently met" → `Handshake`; Kecocokan → `Users`; Diblokir → `ShieldOff`; Feed di Beranda → `FileText`. Nama ikon diperiksa saat implementasi; bila salah satunya tidak ada di `lucide-react-native` yang terpasang, pakai yang paling dekat maknanya dan **catat di laporan task**.
- **B1-13. Layar yang belum dimigrasi tidak disentuh sama sekali**, termasuk tautan yang menunjuk ke layar yang dimigrasi. Tidak ada "perbaikan kecil sekalian" di luar kelompok task.
- **B1-14. `Alert.alert` tetap `Alert.alert`** (spec §7.2: dialog konfirmasi tetap dialog, kalimatnya diterjemahkan). Tombol dialog ikut diterjemahkan ("Cancel", "Show", "Delete wallet from this phone").
- **B1-15. Tombol destruktif memakai `variant="destructive"` salinan BNA** (latar `destruktifLatar`, garis `destruktifGaris`, teks `destructiveForeground` — sudah disunting di Rencana A), bukan `color="#b00"` React Native.
- **B1-16. Awalan judul sheet dipisah menjadi `AWALAN_SHEET_BERTEMU`.** Spec §6.2 butir 3 meminta alamat singkat di judul sheet dirender dengan varian `mono`, sedangkan `judulSheetBertemu` (Rencana A) mengembalikan satu string. Memecah kalimat di JSX akan melanggar §7.3 ("kalimat baru ditaruh di `src/`"), jadi awalannya menjadi konstanta yang dipakai **keduanya**, dan sebuah tes mengikat `judulSheetBertemu(null, a) === AWALAN_SHEET_BERTEMU + alamatSingkat(a)` sehingga kedua jalur tidak bisa berbeda diam-diam.
- **B1-17. Layar yang BUKAN akar tab tidak wajib `contentInsetAdjustmentBehavior`.** Syarat §4.7 lahir dari judul besar iOS, dan `opsiTampilan` hanya memberi `headerLargeTitle` kepada layar akar tab. Layar anak (Koneksi, Kecocokan, Dompet, Diblokir, Profil orang) tetap memakainya di daftar karena murah dan membuat perilaku guliran seragam, tetapi kegagalannya bukan pelanggaran spec.

---

## Struktur Berkas

| Berkas | Tanggung jawab | Task |
|---|---|---|
| `apps/mobile/src/teks-salaman.ts`, `test/teks-salaman.test.ts` | Teks baru layar Handshake (§7.3) | 1 |
| `apps/mobile/src/messages.ts` | Terjemahan per kelompok ekspor (Ruling B1-1) | 1, 5, 7, 9 |
| `apps/mobile/test/{messages,event-messages}.test.ts` | Harapan string menjadi Inggris | 1 |
| `apps/mobile/components/salaman/sheet-bertemu.tsx`, `test/salaman.test.ts` | Sheet "You met …" (§6.2, R13, R14) | 2, 3 |
| `apps/mobile/hooks/useKabar.ts` | Toast berhasil + haptic (Ruling B1-10) | 3 |
| `apps/mobile/theme/globals.ts` | `RADIUS.pelatQr`, `UKURAN.qr` | 3 |
| `apps/mobile/components/salaman/{mode-qr,mode-pindai}.tsx`, `app/(tabs)/(salaman)/salaman.tsx` | Tampilan baru + Inggris; `ScrollView` judul besar | 3 |
| `apps/mobile/src/judul-layar.ts`, `test/support/berkas.ts` | `LAYAR_TERMIGRASI` bertambah; `KOMPONEN_BELUM_DIMIGRASI` dikosongkan | 3, 5, 8–11 |
| `apps/mobile/src/teks-beranda.ts`, `src/muat-fokus.ts`, tes keduanya | Teks baru Beranda + batas muat 30 detik | 4 |
| `apps/mobile/app/(tabs)/(beranda)/index.tsx`, `test/beranda.test.ts` | Beranda baru (§6.1) | 5 |
| `apps/mobile/package.json`, `pnpm-lock.yaml` | `expo-clipboard` (#16C) | 5 |
| `apps/mobile/src/teks-profil.ts`, `test/teks-profil.test.ts` | Tipe `Pertemuan`/`dijaminKenalan` + kalimat Profil orang (§8.1, §8.2) | 7 |
| `apps/mobile/src/errors.ts`, `test/errors.test.ts` | Terjemahan kalimat vouch/report | 7 |
| `apps/mobile/app/profile/[address].tsx`, `test/profil-orang.test.ts` | Profil orang (§6.3, #16A) | 8 |
| `apps/mobile/src/teks-akun.ts`, `test/teks-akun.test.ts` | Kalimat grup tab Profile | 9, 10, 11 |
| `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`, `test/profil-saya.test.ts` | Profil (tab) (§7.1) | 9 |
| `apps/mobile/app/(tabs)/(profil)/{connections,kecocokan}.tsx`, `test/daftar-profil.test.ts` | Daftar Koneksi & Kecocokan | 10 |
| `apps/mobile/app/(tabs)/(profil)/{dompet,blokir}.tsx`, `src/dompet/teks-dompet.ts`, `test/dompet-blokir.test.ts` | Dompet & Diblokir | 11 |
| `apps/mobile/test/{radar-messages,meet-messages,meet-gerbang-teks,blokir-messages,teks-dompet}.test.ts` | Harapan string menjadi Inggris | 5, 7, 9, 11 |

---

## Task 1: Teks Inggris layar Handshake dan galat salaman/check-in

**Files:**
- Create: `apps/mobile/src/teks-salaman.ts`, `apps/mobile/test/teks-salaman.test.ts`
- Modify: `apps/mobile/src/messages.ts` (kalimat jaringan bersama, `PESAN`, `handshakeErrorMessage`, `EVENT_MESSAGES`, `eventErrorMessage` — Ruling B1-1), `apps/mobile/src/handshake/useRotatingQr.ts` (satu kalimat galat), `apps/mobile/test/messages.test.ts`, `apps/mobile/test/event-messages.test.ts`

**Interfaces:**
- Consumes: `src/jamak.ts` `jamak` (Rencana A)
- Produces:
  - `src/teks-salaman.ts`: `TEKS_IZIN_KAMERA`, `TEKS_TOMBOL_IZIN_KAMERA`, `CATATAN_LOKASI_QR`, `teksHitungMundurQr(detik: number): string`, `TEKS_GAGAL_SIAPKAN_QR`, `TEKS_BUKAN_QR_NEARLY`, `TEKS_QR_SENDIRI`, `potongTxHash(txHash: string): string`, `teksTerkoneksi(txHash: string): string`, `teksCheckInBerhasil(txHash: string): string`, `TEKS_PINDAI_LAGI`, `TEKS_LIHAT_PROFIL`, `TEKS_PINDAI_ORANG_LAIN`, `TEKS_GAGAL_SALAMAN`, `TEKS_GAGAL_CHECK_IN`
  - `src/messages.ts`: `KALIMAT_SERVER_TAK_TERJANGKAU`, `handshakeErrorMessage`, `eventErrorMessage` — **tanda tangan tidak berubah**, hanya kalimatnya berbahasa Inggris

Modul `src/teks-salaman.ts` tidak boleh mengimpor `react`, `react-native`, `expo*`, atau `@/…`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/teks-salaman.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CATATAN_LOKASI_QR,
  potongTxHash,
  teksCheckInBerhasil,
  teksHitungMundurQr,
  teksTerkoneksi,
  TEKS_BUKAN_QR_NEARLY,
  TEKS_LIHAT_PROFIL,
  TEKS_PINDAI_LAGI,
  TEKS_PINDAI_ORANG_LAIN,
  TEKS_QR_SENDIRI,
} from "../src/teks-salaman";

const TX = "0x1234567890abcdef1234567890abcdef12345678";

// Terjemahan 1:1 kalimat yang ada (spec desain UI §6.2, R5) + teks baru §7.3.
describe("teks layar Handshake", () => {
  it("hitung mundur QR memakai bentuk tunggal untuk satu detik", () => {
    expect(teksHitungMundurQr(30)).toBe("Ask them to scan this. Changes in 30 seconds.");
    expect(teksHitungMundurQr(1)).toBe("Ask them to scan this. Changes in 1 second.");
    expect(teksHitungMundurQr(0)).toBe("Ask them to scan this. Changes in 0 seconds.");
  });

  it("hasil pindai memotong tx hash pada sepuluh karakter", () => {
    expect(potongTxHash(TX)).toBe("0x12345678…");
    expect(teksTerkoneksi(TX)).toBe("Connected. 0x12345678…");
    expect(teksCheckInBerhasil(TX)).toBe("Checked in. 0x12345678…");
  });

  it("kalimat penolakan pindai adalah terjemahan kalimat yang ada", () => {
    expect(TEKS_BUKAN_QR_NEARLY).toBe("This isn't a Nearly QR code.");
    expect(TEKS_QR_SENDIRI).toBe("That's your own QR code.");
    expect(TEKS_PINDAI_LAGI).toBe("Scan again");
  });

  it("tombol sheet berhasil memakai teks baru yang didaftar spec §7.3", () => {
    expect(TEKS_LIHAT_PROFIL).toBe("View profile");
    expect(TEKS_PINDAI_ORANG_LAIN).toBe("Scan someone else");
  });

  it("catatan lokasi mode QR sejalan dengan teks izin lokasi", () => {
    expect(CATATAN_LOKASI_QR).toBe(
      "Approximate location is used only to confirm you're both in the same place.",
    );
  });
});

describe("teks-salaman.ts murni", () => {
  it("tidak ada konstanta teks yang kosong", async () => {
    const modul = await import("../src/teks-salaman");
    for (const [nama, nilai] of Object.entries(modul)) {
      if (typeof nilai === "string") expect(nilai.length, nama).toBeGreaterThan(0);
    }
  });
});
```

Di `apps/mobile/test/messages.test.ts`, ganti enam harapan berbahasa Indonesia (sisanya tidak berubah):

| Baris lama | Baris baru |
|---|---|
| `      .toBe("Kalian terlalu jauh. Handshake hanya berhasil kalau kalian benar-benar berdekatan.");` | `      .toBe("You're too far apart. A handshake only works when you're really next to each other.");` |
| `    expect(lama).toContain("terlalu lama");` | `    expect(lama).toContain("too much time");` |
| `    expect(handshakeErrorMessage("expired")).toContain("QR baru");` | `    expect(handshakeErrorMessage("expired")).toContain("a new one");` |
| `    expect(handshakeErrorMessage("already_connected")).toContain("sudah terkoneksi");` | `    expect(handshakeErrorMessage("already_connected")).toContain("already connected");` |
| `    expect(handshakeErrorMessage("quota_exceeded")).toContain("batas");` | `    expect(handshakeErrorMessage("quota_exceeded")).toContain("limit");` |
| `    expect(handshakeErrorMessage("chain_error").toLowerCase()).toContain("coba lagi");` | `    expect(handshakeErrorMessage("chain_error").toLowerCase()).toContain("try again");` |

Di `apps/mobile/test/event-messages.test.ts`, ganti satu harapan:

| Baris lama | Baris baru |
|---|---|
| `    expect(m).toMatch(/venue|lokasi/i);` | `    expect(m).toMatch(/venue/i);` |

**Kalau salah satu baris lama tidak ditemukan persis, berhenti dan laporkan** isi berkas tes di sekitarnya — jangan menebak.

`apps/mobile/test/galat-jaringan.test.ts` **tidak diubah**: ia membandingkan hasil setiap penerjemah dengan konstanta `KALIMAT_SERVER_TAK_TERJANGKAU`, bukan dengan string tertulis, jadi terjemahannya otomatis ikut.

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-salaman.test.ts test/messages.test.ts test/event-messages.test.ts`
Expected: FAIL — `Failed to resolve import "../src/teks-salaman"`, plus `messages.test.ts` dan `event-messages.test.ts` merah karena kalimatnya masih Indonesia.

- [ ] **Step 3: Tulis `apps/mobile/src/teks-salaman.ts`**

```ts
import { jamak } from "./jamak";

/**
 * Teks layar Handshake (spec desain UI §6.2): terjemahan 1:1 kalimat yang ada
 * (R5) plus teks baru yang didaftar §7.3. Modul murni — diuji vitest, tidak
 * pernah ditulis langsung di JSX.
 */

/** Izin kamera — terjemahan kalimat app/scan.tsx yang ada. */
export const TEKS_IZIN_KAMERA = "Nearly needs the camera to scan the QR codes of people you meet.";
export const TEKS_TOMBOL_IZIN_KAMERA = "Allow camera";

/**
 * Teks baru §7.3, sejalan dengan NSLocationWhenInUseUsageDescription: mode QR
 * mengirim sel lokasi sendiri tiap siklus, dan itu harus terbaca di layar,
 * bukan hanya di dialog izin sistem.
 */
export const CATATAN_LOKASI_QR =
  "Approximate location is used only to confirm you're both in the same place.";

/** "Minta dia memindai ini. Berganti dalam N detik." (R5). */
export function teksHitungMundurQr(detik: number): string {
  return `Ask them to scan this. Changes in ${jamak(detik, "second", "seconds")}.`;
}

/** Galat useRotatingQr — satu-satunya kalimat yang dibuat hook itu sendiri. */
export const TEKS_GAGAL_SIAPKAN_QR = "Couldn't prepare the QR code.";

export const TEKS_BUKAN_QR_NEARLY = "This isn't a Nearly QR code.";
export const TEKS_QR_SENDIRI = "That's your own QR code.";

/**
 * Sepuluh karakter pertama + "…" — bentuk yang sudah dipakai layar pindai hari
 * ini. Bukan alamat: ini hash transaksi yang memang publik on-chain.
 */
export function potongTxHash(txHash: string): string {
  return `${txHash.slice(0, 10)}…`;
}

/** "Terkoneksi. 0x1234…" — kini baris redup di sheet berhasil (§6.2 butir 5). */
export function teksTerkoneksi(txHash: string): string {
  return `Connected. ${potongTxHash(txHash)}`;
}

/** "Check-in berhasil. 0x1234…" — tetap teks hasil di layar, bukan sheet (§6.2). */
export function teksCheckInBerhasil(txHash: string): string {
  return `Checked in. ${potongTxHash(txHash)}`;
}

export const TEKS_PINDAI_LAGI = "Scan again";

/** Tombol sheet berhasil (§7.3, #16D). */
export const TEKS_LIHAT_PROFIL = "View profile";
export const TEKS_PINDAI_ORANG_LAIN = "Scan someone else";

/** Cadangan saat galat bukan ApiError dan bukan Error — kalimat yang ada. */
export const TEKS_GAGAL_SALAMAN = "Handshake failed. Try again.";
export const TEKS_GAGAL_CHECK_IN = "Check-in failed.";
```

- [ ] **Step 4: Terjemahkan kelompok salaman dan acara di `src/messages.ts`**

Semua suntingan di bawah adalah penggantian teks **persis**. Komentar kode tetap bahasa Indonesia dan **tidak diubah**.

4a. Kalimat jaringan bersama — ganti:

```ts
export const KALIMAT_SERVER_TAK_TERJANGKAU =
  "Server Nearly tidak bisa dihubungi. Periksa koneksi internetmu, lalu coba lagi.";
```

dengan:

```ts
export const KALIMAT_SERVER_TAK_TERJANGKAU =
  "Nearly's server can't be reached. Check your internet connection, then try again.";
```

4b. Peta galat salaman — ganti seluruh blok dari `const PESAN: Record<string, string> = {` sampai `};` tepat sebelum `export function handshakeErrorMessage` dengan:

```ts
const PESAN: Record<string, string> = {
  ...GALAT_JARINGAN,
  expired: "That QR code has expired. Ask for a new one, then scan again.",
  offer_not_found: "This QR code isn't recognized. Ask them to open their QR screen again.",
  offer_consumed: "This QR code has already been used. Ask for a new one.",
  bad_offer_signature: "This QR code isn't valid. Ask them to open their QR screen again.",
  bad_accept_signature: "Your signature isn't valid. Try scanning again.",
  nonce_used: "This QR code has been used before. Ask for a new one.",
  already_connected: "You're already connected. One connection lasts forever.",
  quota_exceeded: "You've reached today's connection limit. Continue tomorrow.",
  chain_error: "The network is congested. Try again in a moment.",
  invalid_body: "Something was wrong with the request. Try scanning again.",
};
```

4c. Ganti badan `handshakeErrorMessage` — blok:

```ts
    return reason === "time_too_far"
      ? "Jaraknya oke, tapi selisih waktunya terlalu lama. Pindai ulang sekarang."
      : "Kalian terlalu jauh. Handshake hanya berhasil kalau kalian benar-benar berdekatan.";
  }
  return PESAN[code] ?? "Handshake gagal. Coba lagi.";
```

dengan:

```ts
    return reason === "time_too_far"
      ? "You're close enough, but too much time has passed. Scan again now."
      : "You're too far apart. A handshake only works when you're really next to each other.";
  }
  return PESAN[code] ?? "Handshake failed. Try again.";
```

4d. Peta galat acara — ganti seluruh blok dari `const EVENT_MESSAGES: Record<string, string> = {` sampai `};` tepat sebelum `export function eventErrorMessage` dengan:

```ts
const EVENT_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  not_rsvped: "RSVP first to check in at this event.",
  already_checked_in: "You've already checked in at this event.",
  already_rsvped: "You've already RSVP'd to this event.",
  event_not_live: "Check-in is only open while the event is running.",
  event_over: "This event is over.",
  event_not_found: "This event wasn't found.",
  event_exists: "An event with that id already exists.",
  outside_geofence: "You're outside the event's location. Check-in only works at the venue.",
  offer_not_found: "This check-in QR code isn't recognized. Ask the host to show it again.",
  offer_consumed: "This check-in QR code has already been used. Ask the host to show it again.",
  nonce_used: "This check-in QR code has been used before.",
  not_host: "Only the event host can open check-in.",
  expired: "That QR code has expired. Ask the host to show it again.",
  bad_signature: "The signature doesn't match.",
  chain_error: "The network is having trouble. Try again in a moment.",
  invalid_body: "Some of the details aren't right yet.",
};
```

4e. Ganti badan `eventErrorMessage` — blok:

```ts
    return reason === "time_too_far"
      ? "Terlalu lama sejak QR ditampilkan. Minta host menampilkannya lagi."
      : "Kamu terlalu jauh dari host. Dekati orang yang menampilkan QR.";
  }
  return EVENT_MESSAGES[code] ?? "Gagal. Coba lagi.";
```

dengan:

```ts
    return reason === "time_too_far"
      ? "Too much time has passed since the QR code was shown. Ask the host to show it again."
      : "You're too far from the host. Move closer to the person showing the QR code.";
  }
  return EVENT_MESSAGES[code] ?? "Something went wrong. Try again.";
```

- [ ] **Step 5: Pakai kalimat baru di `src/handshake/useRotatingQr.ts`**

Tambahkan impor tepat di bawah `import { getCurrentCell } from "../location";`:

```ts
import { TEKS_GAGAL_SIAPKAN_QR } from "../teks-salaman";
```

lalu ganti:

```ts
      setError(e instanceof Error ? e.message : "Gagal menyiapkan QR");
```

dengan:

```ts
      setError(e instanceof Error ? e.message : TEKS_GAGAL_SIAPKAN_QR);
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/teks-salaman.test.ts test/messages.test.ts test/event-messages.test.ts test/galat-jaringan.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. `galat-jaringan.test.ts` lulus tanpa diubah — tujuh penerjemah tetap memakai kalimat jaringan yang sama.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/teks-salaman.ts apps/mobile/test/teks-salaman.test.ts apps/mobile/src/messages.ts apps/mobile/src/handshake/useRotatingQr.ts apps/mobile/test/messages.test.ts apps/mobile/test/event-messages.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): teks Inggris layar Handshake dan galat salaman/check-in

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — bentuk tunggal hitung mundur**

Di `apps/mobile/src/teks-salaman.ts`, ganti `jamak(detik, "second", "seconds")` dengan `` `${detik} seconds` ``.

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-salaman.test.ts`
Expected: FAIL — `teks layar Handshake > hitung mundur QR memakai bentuk tunggal untuk satu detik`. Rekam, lalu `git checkout -- apps/mobile/src/teks-salaman.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — kalimat jaringan bersama masih menyebar ke peta acara**

Di `apps/mobile/src/messages.ts`, hapus baris `  ...GALAT_JARINGAN,` dari `EVENT_MESSAGES` (sisakan peta tanpa baris itu).

Run: `pnpm --filter @nearly/mobile exec vitest run test/galat-jaringan.test.ts`
Expected: FAIL — `server_tak_terjangkau di setiap penerjemah galat > event memakai kalimat koneksi yang sama`. Rekam, lalu `git checkout -- apps/mobile/src/messages.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 2: Sheet "You met …" (`components/salaman/sheet-bertemu.tsx`)

**Files:**
- Create: `apps/mobile/components/salaman/sheet-bertemu.tsx`, `apps/mobile/test/salaman.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`AWALAN_SHEET_BERTEMU` dipakai `judulSheetBertemu`), `apps/mobile/test/teks-ui.test.ts` (satu `it` baru)

**Interfaces:**
- Consumes: `judulSheetBertemu`, `alamatSingkat` (`src/messages.ts`), `teksTerkoneksi`, `TEKS_LIHAT_PROFIL`, `TEKS_PINDAI_ORANG_LAIN` (Task 1), `Avatar`, `Lencana`, `Button`, `Text`, `useColor`, `useGerakDikurangi`, `jarak`/`RADIUS`/`UKURAN`, `req` (`src/http.ts`)
- Produces:
  - `components/salaman/sheet-bertemu.tsx`: `type HasilSalaman = { initiator: string; txHash: string }`, `SheetBertemu({ hasil, alamatSendiri, onTutup })`
  - `src/messages.ts`: `AWALAN_SHEET_BERTEMU = "You met "`

**Keputusan yang diwujudkan task ini** (spec §6.2 butir 1–8, R13, R14, Ruling B1-7):
`Modal` React Native `transparent`, geser (`"fade"` saat Reduce Motion), `onRequestClose` = "Scan someone else"; dua avatar 56 bertumpuk 16; judul alamat singkat dulu lalu nama dari **satu** `GET /profile/:initiator` **tanpa bukti**, jawaban basi dibuang dengan membandingkan alamat; lencana "✓ met in person"; baris redup "Connected. 0x…"; haptic Success saat terbuka; "View profile" menutup sheet lalu `router.push`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/salaman.test.ts` (bagian sheet; mode QR/Pindai ditambahkan di Task 3):

```ts
import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Tes baca-kode: repo ini tidak punya harness render React Native (pola yang
// sama dengan test/salaman-mode.test.ts dan test/review-fondasi.test.ts).
const sheet = () => tanpaKomentar(baca("components/salaman/sheet-bertemu.tsx"));

describe("sheet salaman berhasil (spec desain UI §6.2, R13)", () => {
  it("memakai Modal React Native dengan onRequestClose, bukan komponen BNA", () => {
    const isi = sheet();
    expect(isi).toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*"react-native"/);
    expect(isi).toContain("onRequestClose={pindaiOrangLain}");
    expect(isi).not.toContain("bottom-sheet");
  });

  it("geser bawaan Modal, dan memudar saat Reduce Motion menyala", () => {
    expect(sheet()).toContain('animationType={gerakDikurangi ? "fade" : "slide"}');
  });

  it("haptic Success dipicu saat sheet terbuka", () => {
    const isi = sheet();
    expect(isi).toContain("Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)");
    // Dipicu oleh efek pembukaan, bukan oleh penangan tombol penutup.
    const efek = isi.slice(isi.indexOf("useEffect(() => {"), isi.indexOf("}, [hasil.initiator]);"));
    expect(efek).toContain("Haptics.notificationAsync");
  });

  it("nama diambil dari GET /profile publik tanpa bukti (R14)", () => {
    const isi = sheet();
    expect(isi).toContain("req<{ displayName?: string }>(`/profile/${untuk}`)");
    expect(isi).not.toContain("kueriBuktiProfil");
  });

  it("jawaban basi dibuang dengan membandingkan alamat sebelum mengisi nama (R14)", () => {
    const isi = sheet();
    expect(isi).toContain("if (!terpasang.current) return;");
    expect(isi).toContain("if (alamatKini.current.toLowerCase() !== untuk.toLowerCase()) return;");
  });

  it("View profile menutup sheet lalu membuka profil; hanya di penangan itu ada router.push", () => {
    const isi = sheet();
    const penangan = isi.slice(isi.indexOf("const lihatProfil"), isi.indexOf("const pindaiOrangLain"));
    expect(penangan).toContain("onTutup();");
    expect(penangan).toContain("router.push(`/profile/${hasil.initiator}`);");
    expect([...isi.matchAll(/router\.push\(/g)]).toHaveLength(1);
  });

  it("judul, lencana, dan baris tx memakai fungsi murni yang teruji", () => {
    const isi = sheet();
    expect(isi).toContain("judulSheetBertemu(nama, hasil.initiator)");
    expect(isi).toContain("AWALAN_SHEET_BERTEMU");
    expect(isi).toContain('<Lencana varian="terverifikasi" />');
    expect(isi).toContain("teksTerkoneksi(hasil.txHash)");
  });

  it("avatarmu bercincin primary, avatarnya bercincin verified (#16D)", () => {
    const isi = sheet();
    expect(isi).toContain('cincin="primary"');
    expect(isi).toContain('cincin="verified"');
    // Layar Salaman tidak memuat namamu sendiri (§11 batas #17).
    expect(isi).toContain("nama={null}");
  });
});
```

Di `apps/mobile/test/teks-ui.test.ts`, tambahkan satu `it` di dalam `describe("judulSheetBertemu (spec §6.2, R14)", …)` yang sudah ada, dan tambahkan `AWALAN_SHEET_BERTEMU` serta `alamatSingkat` ke impor dari `"../src/messages"` di berkas itu:

```ts
  it("awalan judul dipisah supaya alamat singkat bisa dirender mono di sheet", () => {
    expect(judulSheetBertemu(null, ALAMAT)).toBe(`${AWALAN_SHEET_BERTEMU}${alamatSingkat(ALAMAT)}`);
    expect(judulSheetBertemu("Rina", ALAMAT)).toBe(`${AWALAN_SHEET_BERTEMU}Rina`);
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts test/teks-ui.test.ts`
Expected: FAIL — `ENOENT … components/salaman/sheet-bertemu.tsx` dan `AWALAN_SHEET_BERTEMU is not exported`.

- [ ] **Step 3: Pisahkan awalan judul di `src/messages.ts`**

Ganti blok `judulSheetBertemu` yang ada:

```ts
export function judulSheetBertemu(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  return n ? `You met ${n}` : `You met ${alamatSingkat(alamat)}`;
}
```

dengan:

```ts
/**
 * Awalan judul, dipisah supaya sheet bisa merender alamat singkat dengan
 * varian `mono` (spec §6.2 butir 3) tanpa memecah kalimatnya sendiri di JSX.
 */
export const AWALAN_SHEET_BERTEMU = "You met ";

export function judulSheetBertemu(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  return `${AWALAN_SHEET_BERTEMU}${n || alamatSingkat(alamat)}`;
}
```

- [ ] **Step 4: Tulis `apps/mobile/components/salaman/sheet-bertemu.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/avatar";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useGerakDikurangi } from "@/hooks/useGerakDikurangi";
import { jarak, RADIUS, UKURAN } from "@/theme/globals";
import { req } from "../../src/http";
import { alamatSingkat, AWALAN_SHEET_BERTEMU, judulSheetBertemu } from "../../src/messages";
import {
  teksTerkoneksi, TEKS_LIHAT_PROFIL, TEKS_PINDAI_ORANG_LAIN,
} from "../../src/teks-salaman";

/** Yang diketahui pemindai setelah postAccept berhasil — alamat dari QR + txHash. */
export type HasilSalaman = { initiator: string; txHash: string };

/**
 * Sheet "You met …" (spec desain UI §6.2, keputusan #16D, R13, R14). Hanya sisi
 * PEMINDAI yang melihatnya: pemegang QR tidak menerima sinyal apa pun dari
 * postAccept (§11 batas #7).
 *
 * Modal React Native, bukan komponen BNA: daftar komponen §3.6 tidak memuat
 * sheet, dan salinan `bottom-sheet` BNA gagal tsc repo ini (R13).
 */
export function SheetBertemu({
  hasil,
  alamatSendiri,
  onTutup,
}: {
  hasil: HasilSalaman;
  alamatSendiri: string;
  onTutup: () => void;
}) {
  const [nama, setNama] = useState<string | null>(null);
  const gerakDikurangi = useGerakDikurangi();
  const insets = useSafeAreaInsets();
  const selubung = useColor("selubung");
  const latar = useColor("card");
  const garis = useColor("border");

  // R14: jawaban yang datang setelah sheet ditutup, atau untuk pindaian
  // BERIKUTNYA, dibuang — alamatnya dibandingkan sebelum `setNama`. Tanpa ini,
  // sheet pindaian kedua bisa berganti nama menjadi nama orang pertama.
  const terpasang = useRef(true);
  const alamatKini = useRef(hasil.initiator);
  alamatKini.current = hasil.initiator;

  useEffect(() => {
    terpasang.current = true;
    // Haptic tepat saat sheet TERBUKA (§6.2 butir 7), bukan saat ditutup.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const untuk = hasil.initiator;
    // SATU panggilan publik, rute dan bentuk yang sama dengan layar profil,
    // TANPA bukti: sheet hanya butuh displayName. Galat, waktu habis, atau
    // nama kosong → judul tetap alamat singkat, tanpa pesan galat (R14).
    req<{ displayName?: string }>(`/profile/${untuk}`)
      .then((p) => {
        if (!terpasang.current) return;
        if (alamatKini.current.toLowerCase() !== untuk.toLowerCase()) return;
        setNama(p.displayName ?? null);
      })
      .catch(() => {});
    return () => {
      terpasang.current = false;
    };
  }, [hasil.initiator]);

  const lihatProfil = () => {
    onTutup();
    router.push(`/profile/${hasil.initiator}`);
  };

  const pindaiOrangLain = () => {
    onTutup();
  };

  const namaBersih = nama?.trim() ?? "";

  return (
    <Modal
      transparent
      visible
      animationType={gerakDikurangi ? "fade" : "slide"}
      onRequestClose={pindaiOrangLain}
    >
      <View style={[s.selubung, { backgroundColor: selubung }]}>
        <View
          style={[
            s.panel,
            {
              backgroundColor: latar,
              borderTopColor: garis,
              paddingBottom: jarak.lg + insets.bottom,
            },
          ]}
        >
          <View style={s.avatar}>
            <Avatar nama={null} alamat={alamatSendiri} ukuran={UKURAN.avatarSheet} cincin="primary" />
            <View style={s.tumpuk}>
              <Avatar
                nama={namaBersih || null}
                alamat={hasil.initiator}
                ukuran={UKURAN.avatarSheet}
                cincin="verified"
              />
            </View>
          </View>

          {namaBersih ? (
            <Text variant="title">{judulSheetBertemu(nama, hasil.initiator)}</Text>
          ) : (
            <Text variant="title">
              {AWALAN_SHEET_BERTEMU}
              <Text variant="mono">{alamatSingkat(hasil.initiator)}</Text>
            </Text>
          )}

          <Lencana varian="terverifikasi" />

          <Text variant="caption">{teksTerkoneksi(hasil.txHash)}</Text>

          <View style={s.tombol}>
            <Button onPress={lihatProfil} style={s.penuh}>{TEKS_LIHAT_PROFIL}</Button>
            <Button variant="outline" onPress={pindaiOrangLain} style={s.penuh}>
              {TEKS_PINDAI_ORANG_LAIN}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  selubung: { flex: 1, justifyContent: "flex-end" },
  panel: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  avatar: { flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  // Tumpang tindih 16 (§6.2 butir 2) — nilai mutlak tetap di skala jarak.
  tumpuk: { marginLeft: -16 },
  tombol: { alignSelf: "stretch", gap: 8, paddingTop: 4 },
  penuh: { width: "100%" },
});
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts test/teks-ui.test.ts test/tema.test.ts test/aksesibilitas.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. `tema.test.ts` dan `aksesibilitas.test.ts` sudah mencakup berkas ini — ia komponen kita, bukan salinan BNA, dan **tidak** ada di `KOMPONEN_BELUM_DIMIGRASI`.

- [ ] **Step 6: Verifikasi bundel** (impor baru: `expo-haptics` di komponen, `react-native-safe-area-context`)

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/salaman/sheet-bertemu.tsx apps/mobile/test/salaman.test.ts apps/mobile/src/messages.ts apps/mobile/test/teks-ui.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): sheet salaman berhasil dengan nama dari profil publik

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — jawaban basi**

Di `apps/mobile/components/salaman/sheet-bertemu.tsx`, hapus baris:

```ts
        if (alamatKini.current.toLowerCase() !== untuk.toLowerCase()) return;
```

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts`
Expected: FAIL — `sheet salaman berhasil (spec desain UI §6.2, R13) > jawaban basi dibuang dengan membandingkan alamat sebelum mengisi nama (R14)`. Rekam, lalu `git checkout -- apps/mobile/components/salaman/sheet-bertemu.tsx`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — Reduce Motion**

Di berkas yang sama, ganti `animationType={gerakDikurangi ? "fade" : "slide"}` dengan `animationType="slide"`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts`
Expected: FAIL — `… > geser bawaan Modal, dan memudar saat Reduce Motion menyala`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 3: Migrasi layar Handshake — dua mode, sheet terpasang, judul besar

**Files:**
- Create: `apps/mobile/hooks/useKabar.ts`
- Rewrite: `apps/mobile/components/salaman/mode-qr.tsx`, `apps/mobile/components/salaman/mode-pindai.tsx`, `apps/mobile/app/(tabs)/(salaman)/salaman.tsx`
- Modify: `apps/mobile/theme/globals.ts` (`RADIUS.pelatQr`, `UKURAN.qr`), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`), `apps/mobile/test/support/berkas.ts` (`KOMPONEN_BELUM_DIMIGRASI`), `apps/mobile/test/salaman.test.ts` (tambahan)

**Interfaces:**
- Consumes: `SheetBertemu`, `HasilSalaman` (Task 2), semua konstanta `src/teks-salaman.ts` (Task 1), `Segmen`, `KeadaanGalat`, `Skeleton`, `Button`, `Text`, `useColor`
- Produces:
  - `hooks/useKabar.ts`: `useKabar(): { berhasil(judul: string): void; disalin(judul: string): void }`
  - `theme/globals.ts`: `RADIUS.pelatQr = 12`, `UKURAN.qr = 260`
  - `src/judul-layar.ts`: `LAYAR_TERMIGRASI` memuat `"(tabs)/(salaman)/salaman"`
  - `test/support/berkas.ts`: `KOMPONEN_BELUM_DIMIGRASI` **kosong**

**Catatan cakupan penjaga.** Begitu kedua komponen keluar dari `KOMPONEN_BELUM_DIMIGRASI` dan kunci Salaman masuk `LAYAR_TERMIGRASI`, ketiga berkas itu langsung tercakup `tema.test.ts` (tanpa warna literal, tanpa `Text`/`Button`/`TextInput` dari `react-native`) dan `aksesibilitas.test.ts` (tanpa `fontSize` literal, jarak hanya dari skala). Himpunan `KOMPONEN_BELUM_DIMIGRASI` menjadi kosong di task ini; **konstantanya sendiri tetap ada** — Rencana B2 masih bisa memerlukannya untuk komponen yang dipindah apa adanya dari layar Pesan/Radar, dan B2-lah yang menghapusnya bila akhirnya tidak terpakai.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/salaman.test.ts` (setelah `describe` sheet dari Task 2):

```ts
const pindai = () => tanpaKomentar(baca("components/salaman/mode-pindai.tsx"));

describe("mode Pindai memakai sheet, bukan teks hasil (spec §6.2, keputusan #16D)", () => {
  it("postAccept berhasil membuka sheet dan tidak berpindah layar", () => {
    const isi = pindai();
    expect(isi).toContain("setHasil({ initiator: payload.initiator, txHash });");
    expect(isi).toContain("<SheetBertemu");
    expect(isi).not.toContain("router.push(");
    expect(isi).not.toContain("router.navigate(");
  });

  it("onScan diabaikan selama sheet terbuka", () => {
    expect(pindai()).toContain("if (busy || hasil) return;");
  });

  it("check-in berhasil tetap teks hasil + toast, tanpa sheet", () => {
    const isi = pindai();
    const cabang = isi.slice(isi.indexOf("const checkin = decodeCheckInQr(data);"), isi.indexOf("const payload = decodeQr(data);"));
    expect(cabang).toContain("setResult(teksCheckInBerhasil(txHash));");
    expect(cabang).toContain("kabar.berhasil(teksCheckInBerhasil(txHash));");
    expect(cabang).not.toContain("setHasil(");
  });

  it("sisi QR tidak diberi sinyal baru — mode QR dan useRotatingQr tidak memuat sheet", () => {
    expect(baca("components/salaman/mode-qr.tsx")).not.toContain("SheetBertemu");
    expect(baca("src/handshake/useRotatingQr.ts")).not.toContain("SheetBertemu");
  });
});

describe("judul besar layar Handshake (spec §4.7, amandemen 2026-09-19)", () => {
  it("isi layar berada di dalam ScrollView dengan penyesuaian inset otomatis", () => {
    const isi = baca("app/(tabs)/(salaman)/salaman.tsx");
    expect(isi).toContain('contentInsetAdjustmentBehavior="automatic"');
    expect(isi).toContain("<ScrollView");
  });

  it("kuncinya terdaftar di LAYAR_TERMIGRASI", async () => {
    const { LAYAR_TERMIGRASI } = await import("../src/judul-layar");
    expect(LAYAR_TERMIGRASI.has("(tabs)/(salaman)/salaman")).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts`
Expected: FAIL — `mode Pindai memakai sheet, bukan teks hasil …` dan `judul besar layar Handshake …` merah (komponen masih versi lama, `LAYAR_TERMIGRASI` masih kosong).

- [ ] **Step 3: Tambah dua token ukuran di `apps/mobile/theme/globals.ts`**

Di objek `RADIUS`, tambahkan baris setelah `  sheet: 12,`:

```ts
  pelatQr: 12,
```

Di objek `UKURAN`, tambahkan baris setelah `  avatarKepala: 64,`:

```ts
  qr: 260,
```

- [ ] **Step 4: Tulis `apps/mobile/hooks/useKabar.ts`**

```ts
import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";

/**
 * Keadaan "berhasil" yang seragam (spec desain UI §7.2): toast hijau +
 * haptic. Dipusatkan supaya tidak ada layar yang lupa haptiknya, dan supaya
 * "Address copied" memakai impact ringan (#16C) — bukan haptic Success yang
 * dipakai aksi penting.
 */
export function useKabar() {
  const { success } = useToast();

  /** Aksi penting: check-in, vouch terkirim, profil disimpan, laporan terkirim. */
  const berhasil = useCallback(
    (judul: string) => {
      success(judul);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [success],
  );

  /** Menyalin alamat (#16C): toast yang sama, getar ringan. */
  const disalin = useCallback(
    (judul: string) => {
      success(judul);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [success],
  );

  return { berhasil, disalin };
}
```

- [ ] **Step 5: Tulis ulang `apps/mobile/components/salaman/mode-qr.tsx`**

```tsx
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { KeadaanGalat } from "@/components/keadaan";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import type { NearlySigner } from "../../src/signer";
import { useRotatingQr } from "../../src/handshake/useRotatingQr";
import { CATATAN_LOKASI_QR, teksHitungMundurQr } from "../../src/teks-salaman";

/**
 * Mode "Show QR" layar Salaman (spec desain UI §6.2). Dipasang hanya saat tab
 * Salaman fokus dan mode ini aktif (R10); melepasnya menghentikan
 * useRotatingQr, dan memasangnya lagi langsung membuat offer baru.
 *
 * QR digambar di atas pelat `text` supaya kontras pemindai terjaga di tema
 * gelap — kode QR gelap di atas latar gelap tidak terbaca kamera.
 */
export function ModeQr({ signerSalaman }: { signerSalaman: NearlySigner }) {
  const { value, secondsLeft, error, refresh } = useRotatingQr(signerSalaman);
  const pelat = useColor("text");

  if (error) return <KeadaanGalat kalimat={error} onCobaLagi={() => void refresh()} />;

  return (
    <View style={s.root}>
      <View style={[s.pelat, { backgroundColor: pelat }]}>
        {value ? (
          <QRCode value={value} size={UKURAN.qr} />
        ) : (
          <Skeleton width={UKURAN.qr} height={UKURAN.qr} />
        )}
      </View>
      {value ? <Text variant="body" style={s.rata}>{teksHitungMundurQr(secondsLeft)}</Text> : null}
      {/* Alamat UTUH di sini (R4): ini layar detail milikmu sendiri. */}
      <Text variant="mono" selectable>{signerSalaman.address}</Text>
      <Text variant="caption" style={s.rata}>{CATATAN_LOKASI_QR}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: "center", gap: 16, paddingVertical: 24 },
  pelat: { padding: 12, borderRadius: RADIUS.pelatQr },
  rata: { textAlign: "center" },
});
```

- [ ] **Step 6: Tulis ulang `apps/mobile/components/salaman/mode-pindai.tsx`**

```tsx
import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StyleSheet, View } from "react-native";
import { checkInAcceptTypedData, decodeCheckInQr, decodeQr, isQrExpired } from "@nearly/shared";
import { SheetBertemu, type HasilSalaman } from "@/components/salaman/sheet-bertemu";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../src/config";
import type { NearlySigner } from "../../src/signer";
import { getCurrentCell } from "../../src/location";
import { ApiError, postAccept } from "../../src/api";
import { eventErrorMessage, handshakeErrorMessage } from "../../src/messages";
import { postCheckIn } from "../../src/events-api";
import {
  teksCheckInBerhasil, TEKS_BUKAN_QR_NEARLY, TEKS_GAGAL_CHECK_IN, TEKS_GAGAL_SALAMAN,
  TEKS_IZIN_KAMERA, TEKS_PINDAI_LAGI, TEKS_QR_SENDIRI, TEKS_TOMBOL_IZIN_KAMERA,
} from "../../src/teks-salaman";

/**
 * Mode "Scan" layar Salaman (spec desain UI §6.2). Dua domain EIP-712:
 * check-in terikat AttendanceRegistry (`signerHadir`), salaman terikat
 * ConnectionRegistry (`signerSalaman`); keduanya diambil pembungkus layar —
 * hook tidak boleh dipanggil di dalam callback pemindai. Dipasang hanya saat
 * tab Salaman fokus, jadi kamera dilepas saat pindah tab (R10).
 *
 * Salaman berhasil membuka sheet "You met …" (#16D) dan TIDAK berpindah layar;
 * check-in berhasil tetap teks hasil + "Scan again", ditambah toast dan haptic.
 */
export function ModePindai({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilSalaman | null>(null);
  const kabar = useKabar();
  const garis = useColor("border");

  if (!permission?.granted) {
    return (
      <View style={s.root}>
        <Text variant="body" style={s.rata}>{TEKS_IZIN_KAMERA}</Text>
        <Button onPress={() => void requestPermission()}>{TEKS_TOMBOL_IZIN_KAMERA}</Button>
      </View>
    );
  }

  async function onScan(data: string) {
    // Penjaga sheet (§6.2 butir 8): selama sheet terbuka kamera masih
    // menangkap QR yang sama, dan pindaian kedua akan memicu
    // already_connected untuk pasangan yang barusan berhasil.
    if (busy || hasil) return;
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
          setResult(teksCheckInBerhasil(txHash));
          kabar.berhasil(teksCheckInBerhasil(txHash));
        } catch (e) {
          setResult(
            e instanceof ApiError
              ? eventErrorMessage(e.code, e.reason)
              : e instanceof Error ? e.message : TEKS_GAGAL_CHECK_IN,
          );
        }
        return;
      }

      const payload = decodeQr(data);
      if (!payload) {
        setResult(TEKS_BUKAN_QR_NEARLY);
        return;
      }
      if (isQrExpired(payload, Date.now())) {
        setResult(handshakeErrorMessage("expired"));
        return;
      }

      const signer = signerSalaman;
      if (signer.address.toLowerCase() === payload.initiator.toLowerCase()) {
        setResult(TEKS_QR_SENDIRI);
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
      // Momen puncak: sheet, bukan teks hasil dan bukan pindah layar (#16D).
      // Hasil pindai sebelumnya dibersihkan supaya tidak ikut terbaca di balik sheet.
      setResult(null);
      setHasil({ initiator: payload.initiator, txHash });
    } catch (e) {
      setResult(
        e instanceof ApiError
          ? handshakeErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : TEKS_GAGAL_SALAMAN,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Persegi, bukan flex: isi layar berada di dalam ScrollView supaya
          judul besar iOS memberi ruang yang benar (spec §4.7). */}
      <View style={[s.jendela, { borderColor: garis }]}>
        <CameraView
          style={s.cam}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => void onScan(data)}
        />
      </View>
      {result ? <Text variant="body" style={s.rata}>{result}</Text> : null}
      {result ? (
        <Button variant="outline" onPress={() => setResult(null)}>{TEKS_PINDAI_LAGI}</Button>
      ) : null}
      {hasil ? (
        <SheetBertemu
          hasil={hasil}
          alamatSendiri={signerSalaman.address}
          onTutup={() => setHasil(null)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16, paddingVertical: 16 },
  jendela: { width: "100%", aspectRatio: 1, borderWidth: 1, borderRadius: RADIUS.kartu, overflow: "hidden" },
  cam: { flex: 1 },
  rata: { textAlign: "center" },
});
```

- [ ] **Step 7: Tulis ulang `apps/mobile/app/(tabs)/(salaman)/salaman.tsx`**

Hanya pembungkus tampilan yang berubah; pembungkus signer, efek `?mode=`, dan `useIsFocused` **tidak** berubah (dijaga `salaman-mode.test.ts` dan `review-fondasi.test.ts`).

```tsx
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
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
  // berikutnya (Detail acara) mengganti mode lewat parameternya. Parameternya
  // dikosongkan setelah dipakai — kalau tidak, tautan yang SAMA sesudah
  // pengguna menggeser segmen tidak mengubah apa pun, karena nilainya tidak
  // berubah dan efek ini tidak berjalan (review Rencana A #3).
  useEffect(() => {
    if (modeParam === undefined) return;
    setMode(modeSalamanDariParam(modeParam));
    router.setParams({ mode: undefined });
  }, [modeParam]);
  // R10: QR berputar dan kamera hanya berjalan saat tab ini fokus (spec §4.6).
  const fokus = useIsFocused();

  return (
    // Judul besar iOS hanya memberi ruang yang benar bila isinya ScrollView
    // dengan penyesuaian inset otomatis (spec §4.7, amandemen 2026-09-19).
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Segmen pilihan={PILIHAN_MODE_SALAMAN} nilai={mode} onGanti={setMode} />
      {fokus && (mode === "qr"
        ? <ModeQr signerSalaman={signerSalaman} />
        : <ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 16 },
});
```

- [ ] **Step 8: Daftarkan layar sebagai termigrasi**

Di `apps/mobile/src/judul-layar.ts`, ganti:

```ts
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([]);
```

dengan:

```ts
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([
  // Rencana B1 kelompok (a) — Handshake (spec §9 langkah 5a).
  "(tabs)/(salaman)/salaman",
]);
```

Di `apps/mobile/test/support/berkas.ts`, ganti:

```ts
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([
  // app/qr.tsx dan app/scan.tsx dipindah apa adanya (Ruling A10) — Rencana B 5(a).
  "components/salaman/mode-qr.tsx",
  "components/salaman/mode-pindai.tsx",
]);
```

dengan:

```ts
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([
  // Kosong sejak Rencana B1 kelompok (a): kedua mode Salaman sudah dimigrasi.
  // Konstantanya dipertahankan untuk komponen yang dipindah apa adanya di
  // Rencana B2 (Pesan, Radar); B2 menghapusnya bila tidak terpakai.
]);
```

- [ ] **Step 9: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts test/salaman-mode.test.ts test/review-fondasi.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/judul-layar.test.ts test/tautan.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. Bila `tema.test.ts` atau `aksesibilitas.test.ts` merah untuk salah satu dari tiga berkas ini, penyebabnya adalah warna literal / `fontSize` literal / jarak di luar skala yang tersisa — perbaiki di berkasnya, **jangan** melonggarkan penjaganya.

- [ ] **Step 10: Verifikasi bundel**

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/hooks/useKabar.ts apps/mobile/theme/globals.ts apps/mobile/components/salaman/mode-qr.tsx apps/mobile/components/salaman/mode-pindai.tsx "apps/mobile/app/(tabs)/(salaman)/salaman.tsx" apps/mobile/src/judul-layar.ts apps/mobile/test/support/berkas.ts apps/mobile/test/salaman.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi layar Handshake — tampilan baru, bahasa Inggris, sheet berhasil

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Mutasi — penjaga sheet pada pemindai**

Di `apps/mobile/components/salaman/mode-pindai.tsx`, ganti `if (busy || hasil) return;` dengan `if (busy) return;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts`
Expected: FAIL — `mode Pindai memakai sheet, bukan teks hasil (spec §6.2, keputusan #16D) > onScan diabaikan selama sheet terbuka`. Rekam, lalu `git checkout -- apps/mobile/components/salaman/mode-pindai.tsx`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 13: Mutasi — judul besar butuh ScrollView**

Di `apps/mobile/app/(tabs)/(salaman)/salaman.tsx`, hapus baris `      contentInsetAdjustmentBehavior="automatic"`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/salaman.test.ts`
Expected: FAIL — `judul besar layar Handshake (spec §4.7, amandemen 2026-09-19) > isi layar berada di dalam ScrollView dengan penyesuaian inset otomatis`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 4: Teks Beranda dan batas muat saat fokus

**Files:**
- Create: `apps/mobile/src/teks-beranda.ts`, `apps/mobile/src/muat-fokus.ts`, `apps/mobile/test/teks-beranda.test.ts`, `apps/mobile/test/muat-fokus.test.ts`

**Interfaces:**
- Consumes: `pasanganJamak` (`src/jamak.ts`)
- Produces:
  - `src/teks-beranda.ts`: `JUDUL_RECENTLY_MET`, `JUDUL_FEED`, `TEKS_LIHAT_SEMUA`, `TEKS_BUKA_RADAR`, `TEKS_BUKA_ACARA`, `TEKS_BUKA_DOMPET`, `TEKS_LIVE`, `pasanganCheckIn(n: number): { angka: string; kata: string }`, `TEKS_SUDAH_CHECK_IN`, `TEKS_SALIN`, `LABEL_SALIN_ALAMAT`, `TEKS_ALAMAT_DISALIN`, `KOSONG_KONEKSI`, `TEKS_AKSI_HANDSHAKE`
  - `src/muat-fokus.ts`: `JEDA_MUAT_FOKUS_MS`, `bolehMuatFokus(terakhirMs: number | null, sekarangMs: number): boolean`

Kedua modul murni: tidak mengimpor `react`, `react-native`, `expo*`, atau `@/…`.

**Catatan.** `KOSONG_KONEKSI` dipakai **dua** layar (keadaan kosong "Recently met" di Beranda dan layar Koneksi, spec §6.1 dan §7.2) — karena itu ia kalimat bersama di `src/`, bukan di salah satu layar. Task 11 (Koneksi) memakainya kembali, tidak menulis ulang.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/teks-beranda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  KOSONG_KONEKSI,
  LABEL_SALIN_ALAMAT,
  pasanganCheckIn,
  TEKS_AKSI_HANDSHAKE,
  TEKS_ALAMAT_DISALIN,
  TEKS_BUKA_ACARA,
  TEKS_BUKA_DOMPET,
  TEKS_BUKA_RADAR,
  TEKS_LIHAT_SEMUA,
  TEKS_LIVE,
  TEKS_SALIN,
  TEKS_SUDAH_CHECK_IN,
  JUDUL_FEED,
  JUDUL_RECENTLY_MET,
} from "../src/teks-beranda";

// Teks baru yang diizinkan spec desain UI §7.3 — tidak ada yang lain.
describe("teks Beranda", () => {
  it("judul bagian dan tautan persis seperti daftar §7.3", () => {
    expect(JUDUL_RECENTLY_MET).toBe("Recently met");
    expect(JUDUL_FEED).toBe("Feed");
    expect(TEKS_LIHAT_SEMUA).toBe("See all ›");
    expect(TEKS_BUKA_RADAR).toBe("Open radar ›");
    expect(TEKS_BUKA_ACARA).toBe("Open event ›");
    expect(TEKS_BUKA_DOMPET).toBe("Open Wallet ›");
    expect(TEKS_LIVE).toBe("● LIVE");
    expect(TEKS_SUDAH_CHECK_IN).toBe("You're checked in");
  });

  it("jumlah check-in memisahkan angka dari katanya supaya angkanya lebih keras (§7.1)", () => {
    expect(pasanganCheckIn(12)).toEqual({ angka: "12", kata: "checked in" });
    expect(pasanganCheckIn(1)).toEqual({ angka: "1", kata: "checked in" });
    expect(pasanganCheckIn(0)).toEqual({ angka: "0", kata: "checked in" });
  });

  it("tombol Copy punya label aksesibilitas yang menyebut apa yang disalin (#16C)", () => {
    expect(TEKS_SALIN).toBe("Copy");
    expect(LABEL_SALIN_ALAMAT).toBe("Copy address");
    expect(TEKS_ALAMAT_DISALIN).toBe("Address copied");
  });

  it("keadaan kosong koneksi adalah terjemahan kalimat yang sudah ada", () => {
    expect(KOSONG_KONEKSI).toBe(
      "No connections yet. Connections can only be made by meeting in person.",
    );
    expect(TEKS_AKSI_HANDSHAKE).toBe("Handshake");
  });
});
```

`apps/mobile/test/muat-fokus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bolehMuatFokus, JEDA_MUAT_FOKUS_MS } from "../src/muat-fokus";

// Spec desain UI §4.6: layar tab memuat saat fokus, paling sering sekali per
// 30 detik — setara "satu tanda tangan per pembukaan beranda" hari ini.
describe("batas muat saat fokus", () => {
  it("pemuatan pertama selalu boleh", () => {
    expect(bolehMuatFokus(null, 1_000)).toBe(true);
  });

  it("pemuatan berikutnya ditahan sampai jeda terlewati", () => {
    expect(bolehMuatFokus(1_000, 1_000)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS - 1)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS)).toBe(true);
  });

  it("jedanya tiga puluh detik", () => {
    expect(JEDA_MUAT_FOKUS_MS).toBe(30_000);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-beranda.test.ts test/muat-fokus.test.ts`
Expected: FAIL — `Failed to resolve import "../src/teks-beranda"` dan `"../src/muat-fokus"`.

- [ ] **Step 3: Tulis `apps/mobile/src/teks-beranda.ts`**

```ts
import { pasanganJamak } from "./jamak";

/**
 * Teks Beranda (spec desain UI §6.1). Seluruhnya ada di daftar teks baru yang
 * diizinkan §7.3, kecuali KOSONG_KONEKSI yang merupakan terjemahan kalimat
 * kosong yang sudah ada di layar Koneksi.
 */

export const JUDUL_RECENTLY_MET = "Recently met";
export const JUDUL_FEED = "Feed";

export const TEKS_LIHAT_SEMUA = "See all ›";
export const TEKS_BUKA_RADAR = "Open radar ›";
export const TEKS_BUKA_ACARA = "Open event ›";
export const TEKS_BUKA_DOMPET = "Open Wallet ›";

export const TEKS_LIVE = "● LIVE";
export const TEKS_SUDAH_CHECK_IN = "You're checked in";

/**
 * "N checked in" dengan angka terpisah dari katanya: nilai tampil lebih keras
 * daripada labelnya (§7.1, #16A). Bentuk tunggal dan jamaknya sama — "1
 * checked in" sudah benar dalam bahasa Inggris.
 */
export function pasanganCheckIn(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "checked in", "checked in");
}

/** Tombol Copy alamat sendiri (#16C). Labelnya menyebut APA yang disalin (§3.7). */
export const TEKS_SALIN = "Copy";
export const LABEL_SALIN_ALAMAT = "Copy address";
export const TEKS_ALAMAT_DISALIN = "Address copied";

/**
 * Terjemahan kalimat kosong layar Koneksi yang sudah ada. Dipakai Beranda
 * (bagian "Recently met") DAN layar Koneksi — satu kalimat, dua tempat, supaya
 * keduanya tidak mulai mengajarkan hal yang berbeda tentang cara berkoneksi.
 */
export const KOSONG_KONEKSI =
  "No connections yet. Connections can only be made by meeting in person.";

/** Aksi keadaan kosong itu: membuka tab Handshake (§7.2). */
export const TEKS_AKSI_HANDSHAKE = "Handshake";
```

- [ ] **Step 4: Tulis `apps/mobile/src/muat-fokus.ts`**

```ts
/**
 * Batas pemuatan layar tab saat fokus (spec desain UI §4.6): paling sering
 * sekali per 30 detik. Terpisah dari batas lencana di
 * src/lencana/lencana-tab.ts meski nilainya sama — keduanya kebijakan yang
 * berbeda, dan menyatukannya membuat perubahan salah satu diam-diam mengubah
 * yang lain.
 */
export const JEDA_MUAT_FOKUS_MS = 30_000;

/** Murni. `terakhirMs` null berarti layar belum pernah memuat. */
export function bolehMuatFokus(terakhirMs: number | null, sekarangMs: number): boolean {
  return terakhirMs === null || sekarangMs - terakhirMs >= JEDA_MUAT_FOKUS_MS;
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/teks-beranda.test.ts test/muat-fokus.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/teks-beranda.ts apps/mobile/src/muat-fokus.ts apps/mobile/test/teks-beranda.test.ts apps/mobile/test/muat-fokus.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): teks Beranda dan batas muat saat fokus

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Mutasi — batas muat**

Di `apps/mobile/src/muat-fokus.ts`, ganti `sekarangMs - terakhirMs >= JEDA_MUAT_FOKUS_MS` dengan `sekarangMs - terakhirMs > 0`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/muat-fokus.test.ts`
Expected: FAIL — `batas muat saat fokus > pemuatan berikutnya ditahan sampai jeda terlewati`. Rekam, lalu `git checkout -- apps/mobile/src/muat-fokus.ts`, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 5: Migrasi Beranda — sapaan, Copy alamat, LIVE, Recently met, Feed

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/(beranda)/index.tsx`
- Create: `apps/mobile/test/beranda.test.ts`
- Modify: `apps/mobile/package.json` + `pnpm-lock.yaml` (`npx expo install expo-clipboard`), `apps/mobile/src/dompet/teks-dompet.ts` (satu konstanta), `apps/mobile/src/messages.ts` (`namaKartuRadar`), `apps/mobile/test/radar-messages.test.ts` (dua baris), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`), `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts` (satu baris `HARAPAN`)

**Interfaces:**
- Consumes: `src/teks-beranda.ts` + `src/muat-fokus.ts` (Task 4), `useKabar` (Task 3), `sapaan`/`waktuRelatif` (Rencana A), `KartuOrang`, `Lencana`, `TautanKecil`, `KeadaanKosong`, `KerangkaDaftar`, `Card`, `Text`, `hitSlopSampai`, `alamatSingkat`, `namaKartuRadar`, `getDiscovery`/`getEvent`, `getFeed`/`kueriBuktiFeed`, `fetchTrust`, `req`
- Produces: Beranda berbahasa Inggris dengan latar gelap dan tanpa header (`LAYAR_TERMIGRASI` memuat `"(tabs)/(beranda)/index"`)

**Dua signer di Beranda.** Bendera `sudahCheckIn` kartu LIVE hanya keluar untuk pemanggil yang membuktikan dirinya dengan tipe `LihatEvent` di domain **AttendanceRegistry** (spec §6.1: "bukti yang sama seperti `events/[id]`"), sedangkan bukti feed memakai **ConnectionRegistry**. Karena itu layar ini mengambil dua signer di pembungkus — pola yang sama dengan layar Salaman — dan `HARAPAN` di `dompet-tanpa-kunci-dev.test.ts` ikut diperbarui.

- [ ] **Step 1: Pasang `expo-clipboard`**

```bash
cd apps/mobile && npx expo install expo-clipboard
```

Expected: paket terpasang dengan versi yang cocok SDK 57 (baris `expo-clipboard` muncul di `apps/mobile/package.json` `dependencies`). **Catat versi persis yang dilaporkan CLI di laporan task.** Bila CLI menambahkan entri `plugins` ke `app.json`, **laporkan** (fase ini tidak mengharapkannya — `expo-clipboard` tidak punya plugin config).

Jangan menjalankan `pnpm add expo-clipboard`: versinya harus yang cocok dengan modul native di dalam Expo Go SDK 57 (§11 batas #4).

- [ ] **Step 2: Tulis tes yang gagal**

`apps/mobile/test/beranda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const beranda = () => tanpaKomentar(baca("app/(tabs)/(beranda)/index.tsx"));

// Tes baca-kode (tidak ada harness render RN), pola yang sama dengan
// test/salaman.test.ts.
describe("Beranda baru (spec desain UI §6.1)", () => {
  it("terdaftar termigrasi, sehingga tanpa header dan berlatar gelap", async () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(beranda)/index")).toBe(true);
    const { opsiTampilan } = await import("../theme/navigasi");
    expect(opsiTampilan("(tabs)/(beranda)/index").headerShown).toBe(false);
  });

  it("isi berada di dalam SafeAreaView + ScrollView dengan penyesuaian inset otomatis", () => {
    const isi = beranda();
    expect(isi).toContain("<SafeAreaView");
    expect(isi).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("sapaan per jam dan alamat SINGKAT mono di kepala (#16C)", () => {
    const isi = beranda();
    expect(isi).toContain("sapaan(new Date())");
    expect(isi).toContain("alamatSingkat(signer.address)");
  });

  it("Copy menyalin alamat UTUH, bukan yang disingkat, lalu toast + getar ringan", () => {
    const isi = beranda();
    expect(isi).toContain("Clipboard.setStringAsync(signer.address)");
    expect(isi).toContain("kabar.disalin(TEKS_ALAMAT_DISALIN)");
    expect(isi).toContain("accessibilityLabel={LABEL_SALIN_ALAMAT}");
  });

  it("gagal menyalin tidak memunculkan kalimat galat baru (#16C)", () => {
    const isi = beranda();
    const salin = isi.slice(isi.indexOf("async function salinAlamat"), isi.indexOf("const muatNama"));
    expect(salin).toContain("catch {");
    expect(salin).not.toContain("setPesan");
  });

  it("setiap bagian memuat dan gagal sendiri", () => {
    const isi = beranda();
    for (const nama of ["muatNama", "muatLive", "muatKoneksi", "muatFeed"]) {
      expect(isi, nama).toContain(`const ${nama} = useCallback(`);
    }
    // Empat pemuat, empat penangkap galat: satu bagian yang gagal tidak
    // menutup bagian lain (spec §6.1).
    expect([...isi.matchAll(/\bcatch\b/g)].length).toBeGreaterThanOrEqual(4);
  });

  it("memuat saat fokus, paling sering sekali per 30 detik (§4.6)", () => {
    const isi = beranda();
    expect(isi).toContain("useFocusEffect(");
    expect(isi).toContain("bolehMuatFokus(terakhir.current, kini)");
  });

  it('"Recently met" memakai KartuOrang dan waktu relatif', () => {
    const isi = beranda();
    expect(isi).toContain("<KartuOrang");
    expect(isi).toContain("waktuRelatif(");
    expect(isi).toContain("KOSONG_KONEKSI");
  });

  it("daftar sepuluh tautan lama hilang", () => {
    const isi = beranda();
    for (const lama of ["Koneksiku", "Daftar blokir", "Profil saya", "Tampilkan QR-ku", "Pindai QR orang lain"]) {
      expect(isi, lama).not.toContain(lama);
    }
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/beranda.test.ts`
Expected: FAIL — `LAYAR_TERMIGRASI` belum memuat kunci Beranda, dan layar masih daftar sepuluh tautan.

- [ ] **Step 4: Terjemahkan spanduk cadangan di `src/dompet/teks-dompet.ts`**

Beranda adalah tugas pertama yang MERENDER kalimat ini (Ruling B1-1); sisa berkas itu diterjemahkan di Task 11 bersama layar Dompet. Ganti:

```ts
export const TEKS_PENGINGAT_CADANGAN =
  "Catat 12 kata pemulihanmu. Tanpa itu, identitas dan koneksimu hilang kalau HP hilang atau aplikasi dihapus.";
```

dengan:

```ts
export const TEKS_PENGINGAT_CADANGAN =
  "Write down your 12-word recovery phrase. Without it, your identity and connections are gone if you lose this phone or delete the app.";
```

`test/teks-dompet.test.ts` tidak menyentuh konstanta ini, jadi tidak ada tes yang perlu diubah.

- [ ] **Step 4b: Terjemahkan `namaKartuRadar` di `src/messages.ts`**

`KartuOrang` merendernya, dan Beranda adalah layar pertama yang memakai `KartuOrang` (Ruling B1-1). Ganti:

```ts
export function namaKartuRadar(displayName: string): string {
  return displayName.trim() || "Tanpa nama";
}
```

dengan:

```ts
export function namaKartuRadar(displayName: string): string {
  return displayName.trim() || "Unnamed";
}
```

Di `apps/mobile/test/radar-messages.test.ts`, ganti dua baris (judul `it` tetap bahasa Indonesia, tetapi menyebut kalimat barunya):

| Baris lama | Baris baru |
|---|---|
| `  it("nama kosong → Tanpa nama", () => {` | `  it("nama kosong → Unnamed", () => {` |
| `    expect(namaKartuRadar("  ")).toBe("Tanpa nama");` | `    expect(namaKartuRadar("  ")).toBe("Unnamed");` |

Layar Radar, Pesan, dan Profil orang masih menampilkan "Tanpa nama"-nya sendiri secara harfiah; keduanya dimigrasi di Task 8 (Profil orang) dan Rencana B2 (Radar, Pesan).

- [ ] **Step 5: Tulis ulang `apps/mobile/app/(tabs)/(beranda)/index.tsx`**

```tsx
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Copy, Handshake } from "lucide-react-native";
import type { Address } from "viem";
import { isEventLive, lihatEventTypedData } from "@nearly/shared";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { TautanKecil } from "@/components/tautan-kecil";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { hitSlopSampai } from "../../../src/aksesibilitas";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useDompet, useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { perluPengingatCadangan, TEKS_PENGINGAT_CADANGAN } from "../../../src/dompet/teks-dompet";
import { getDiscovery, getEvent, type EventSummary } from "../../../src/events-api";
import { getFeed, kueriBuktiFeed } from "../../../src/feed-api";
import { req } from "../../../src/http";
import { alamatSingkat, namaKartuRadar } from "../../../src/messages";
import { bolehMuatFokus } from "../../../src/muat-fokus";
import {
  JUDUL_FEED, JUDUL_RECENTLY_MET, KOSONG_KONEKSI, LABEL_SALIN_ALAMAT, pasanganCheckIn,
  TEKS_AKSI_HANDSHAKE, TEKS_ALAMAT_DISALIN, TEKS_BUKA_ACARA, TEKS_BUKA_DOMPET, TEKS_BUKA_RADAR,
  TEKS_LIHAT_SEMUA, TEKS_LIVE, TEKS_SALIN, TEKS_SUDAH_CHECK_IN,
} from "../../../src/teks-beranda";
import { fetchTrust } from "../../../src/trust-api";
import { sapaan, waktuRelatif } from "../../../src/waktu";

/** Batas jumlah kartu per bagian (spec §6.1). */
const MAKS_LIVE = 2;
const MAKS_KONEKSI = 3;
const MAKS_FEED = 2;
/** Ikon "Copy" sengaja lebih kecil dari teksnya — bukan ukuran huruf. */
const IKON_SALIN = 14;

type KartuKoneksi = { alamat: string; nama: string; tier: number | null; waktu: string };
type KartuFeed = { id: string; nama: string; waktu: string; isi: string };

export default function Home() {
  // Bukti feed memakai ConnectionRegistry; bendera sudahCheckIn kartu LIVE
  // memakai AttendanceRegistry — domain yang sama dengan layar Detail acara.
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const { punyaMnemonik, sudahDicadangkan } = useDompet();
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer || !signerHadir) return null;
  return (
    <HomeIsi
      key={signer.address}
      signer={signer}
      signerHadir={signerHadir}
      pengingatCadangan={perluPengingatCadangan({ punyaMnemonik, sudahDicadangkan })}
    />
  );
}

function HomeIsi({
  signer,
  signerHadir,
  pengingatCadangan,
}: {
  signer: NearlySigner;
  signerHadir: NearlySigner;
  pengingatCadangan: boolean;
}) {
  const [nama, setNama] = useState<string | null>(null);
  const [live, setLive] = useState<EventSummary[]>([]);
  const [koneksi, setKoneksi] = useState<KartuKoneksi[] | null>(null);
  const [feed, setFeed] = useState<KartuFeed[] | null>(null);
  const kabar = useKabar();

  const kuning = useColor("primary");
  const hijau = useColor("verified");
  const spandukLatar = useColor("spandukLatar");
  const spandukGaris = useColor("spandukGaris");

  async function salinAlamat() {
    try {
      // Alamat UTUH, bukan yang disingkat (#16C).
      await Clipboard.setStringAsync(signer.address);
      kabar.disalin(TEKS_ALAMAT_DISALIN);
    } catch {
      // Gagal menyalin → tidak ada toast dan TIDAK ada kalimat galat baru:
      // spec §7.3 tidak mengizinkan kalimat yang belum diputuskan (#16C).
    }
  }

  // Setiap bagian memuat SENDIRI dan gagal SENDIRI (spec §6.1): satu bagian
  // yang gagal tidak pernah menutup bagian lain atau mengosongkan layar.
  const muatNama = useCallback(async () => {
    try {
      const p = await req<{ displayName?: string }>(`/profile/${signer.address}`);
      setNama(p.displayName?.trim() || null);
    } catch {
      // Nama bukan identitas; tanpa nama, alamatnya tetap tampil (spec §9.2).
    }
  }, [signer.address]);

  const muatLive = useCallback(async () => {
    try {
      const { events } = await getDiscovery();
      const sekarang = Date.now();
      const berlangsung = events
        .filter((e) => isEventLive(BigInt(e.startsAt), BigInt(e.endsAt), sekarang))
        .slice(0, MAKS_LIVE);
      const rinci = await Promise.all(berlangsung.map(async (e) => {
        try {
          // Bukti BACA (LihatEvent), bukan Rsvp — sama dengan layar Detail
          // acara: tipe yang sama dengan POST akan bisa diputar ulang.
          const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
          const sig = await signerHadir.signTypedData(
            lihatEventTypedData(
              { eventId: e.eventId, who: signerHadir.address, expiresAt },
              CONFIG.attendanceRegistry,
            ),
          );
          return await getEvent(e.eventId, signerHadir.address, {
            expiresAt: expiresAt.toString(), sig,
          });
        } catch {
          // Tanpa bukti, kartunya tetap tampil — hanya tanpa "You're checked in".
          return e;
        }
      }));
      setLive(rinci);
    } catch {
      setLive([]);
    }
  }, [signerHadir]);

  const muatKoneksi = useCallback(async () => {
    try {
      const { connections } = await req<{ connections?: { address: string; at: number }[] }>(
        `/connections/${signer.address}`,
      );
      const kini = new Date();
      const kartu = await Promise.all((connections ?? []).slice(0, MAKS_KONEKSI).map(async (k) => {
        // GET /connections tidak mengirim nama; nama dan tier diambil per
        // orang (§11 batas #9). Kegagalannya membuat kartu tampil tanpa
        // nama/tier, bukan menghilangkan kartunya.
        const [namaOrang, tier] = await Promise.all([
          req<{ displayName?: string }>(`/profile/${k.address}`).then((p) => p.displayName ?? "").catch(() => ""),
          fetchTrust(k.address as Address).then((t) => t.tier).catch(() => null),
        ]);
        return { alamat: k.address, nama: namaOrang, tier, waktu: waktuRelatif(new Date(k.at), kini) };
      }));
      setKoneksi(kartu);
    } catch {
      setKoneksi([]);
    }
  }, [signer.address]);

  const muatFeed = useCallback(async () => {
    try {
      const { posts } = await getFeed(await kueriBuktiFeed(signer));
      const kini = new Date();
      setFeed(posts.slice(0, MAKS_FEED).map((p) => ({
        id: p.postId,
        nama: namaKartuRadar(p.displayName),
        waktu: waktuRelatif(new Date(p.createdAtMs), kini),
        isi: p.body,
      })));
    } catch {
      setFeed([]);
    }
  }, [signer]);

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

  return (
    <SafeAreaView edges={["top"]} style={s.flex}>
      <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
        <View style={s.kepala}>
          <Text variant="heading">{sapaan(new Date())}</Text>
          {nama ? <Text variant="title">{nama}</Text> : null}
          <View style={s.barisAlamat}>
            {/* Alamat SINGKAT (#16C); yang utuh ada di Wallet dan Profile. */}
            <Text variant="mono">{alamatSingkat(signer.address)}</Text>
            <Pressable
              onPress={() => void salinAlamat()}
              accessibilityRole="button"
              accessibilityLabel={LABEL_SALIN_ALAMAT}
              hitSlop={hitSlopSampai(48, 20)}
              style={s.salin}
            >
              <Copy color={kuning} size={IKON_SALIN} />
              <Text
                variant="label"
                style={{ color: kuning }}
                maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}
              >
                {TEKS_SALIN}
              </Text>
            </Pressable>
          </View>
        </View>

        {pengingatCadangan ? (
          <View style={[s.spanduk, { backgroundColor: spandukLatar, borderColor: spandukGaris }]}>
            <Text variant="caption" style={{ color: kuning }}>{TEKS_PENGINGAT_CADANGAN}</Text>
            <TautanKecil label={TEKS_BUKA_DOMPET} onPress={() => router.push("/dompet")} />
          </View>
        ) : null}

        {live.map((e) => (
          <Card key={e.eventId} style={s.kartu}>
            <View style={s.barisKartu}>
              <Text variant="label" style={{ color: hijau }}>{TEKS_LIVE}</Text>
              <View style={s.nilai}>
                <Text variant="body" style={s.tebal}>{pasanganCheckIn(e.checkins ?? 0).angka}</Text>
                <Text variant="caption">{pasanganCheckIn(e.checkins ?? 0).kata}</Text>
              </View>
            </View>
            <Text variant="title">{e.title}</Text>
            {e.sudahCheckIn ? (
              <View style={s.barisKartu}>
                <Text variant="caption">{TEKS_SUDAH_CHECK_IN}</Text>
                <TautanKecil label={TEKS_BUKA_RADAR} onPress={() => router.push(`/radar/${e.eventId}`)} />
              </View>
            ) : (
              <TautanKecil label={TEKS_BUKA_ACARA} onPress={() => router.push(`/events/${e.eventId}`)} />
            )}
          </Card>
        ))}

        <View style={s.bagian}>
          <View style={s.barisJudul}>
            <Text variant="title">{JUDUL_RECENTLY_MET}</Text>
            <TautanKecil label={TEKS_LIHAT_SEMUA} onPress={() => router.push("/connections")} />
          </View>
          {koneksi === null ? (
            <KerangkaDaftar baris={MAKS_KONEKSI} />
          ) : koneksi.length === 0 ? (
            <KeadaanKosong
              Ikon={Handshake}
              kalimat={KOSONG_KONEKSI}
              aksi={{ label: TEKS_AKSI_HANDSHAKE, onPress: () => router.push("/salaman") }}
            />
          ) : (
            koneksi.map((k) => (
              <KartuOrang
                key={k.alamat}
                nama={k.nama}
                alamat={k.alamat}
                terverifikasi
                lencana={<Lencana varian="terverifikasi" />}
                keterangan={k.waktu}
                tier={k.tier ?? undefined}
                onPress={() => router.push(`/profile/${k.alamat}`)}
              />
            ))
          )}
        </View>

        {feed === null || feed.length > 0 ? (
          <View style={s.bagian}>
            <View style={s.barisJudul}>
              <Text variant="title">{JUDUL_FEED}</Text>
              <TautanKecil label={TEKS_LIHAT_SEMUA} onPress={() => router.push("/feed")} />
            </View>
            {feed === null ? (
              <KerangkaDaftar baris={MAKS_FEED} />
            ) : (
              feed.map((p) => (
                <Card key={p.id} style={s.kartu}>
                  <View style={s.barisKartu}>
                    <Text variant="body" style={s.tebal}>{p.nama}</Text>
                    <Text variant="caption">{p.waktu}</Text>
                  </View>
                  <Text variant="body" numberOfLines={2}>{p.isi}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 4 },
  barisAlamat: { flexDirection: "row", alignItems: "center", gap: 12 },
  salin: { flexDirection: "row", alignItems: "center", gap: 4 },
  spanduk: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12, gap: 4 },
  kartu: { gap: 8 },
  barisKartu: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nilai: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  bagian: { gap: 12 },
  barisJudul: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tebal: { fontWeight: "600" },
});
```

- [ ] **Step 6: Daftarkan Beranda sebagai termigrasi dan perbarui penjaga signer**

Di `apps/mobile/src/judul-layar.ts`, ganti isi `LAYAR_TERMIGRASI` dengan:

```ts
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([
  // Rencana B1 kelompok (a) — Handshake (spec §9 langkah 5a).
  "(tabs)/(salaman)/salaman",
  // Rencana B1 kelompok (b) — Beranda (spec §9 langkah 5b).
  "(tabs)/(beranda)/index",
]);
```

Di `apps/mobile/test/dompet-tanpa-kunci-dev.test.ts`, ganti:

```ts
      "app/(tabs)/(beranda)/index.tsx": [`signer:${V}`],
```

dengan:

```ts
      // Dua domain: bukti feed (ConnectionRegistry) dan bendera sudahCheckIn
      // kartu LIVE (AttendanceRegistry) — spec desain UI §6.1.
      "app/(tabs)/(beranda)/index.tsx": [`signer:${V}`, "signerHadir:attendanceRegistry"],
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/beranda.test.ts test/dompet-tanpa-kunci-dev.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/tautan.test.ts test/judul-layar.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. Bila `lucide-react-native` menolak nama ikon `Handshake` atau `Copy`, pakai nama terdekat yang ada (mis. `HandCoins` → **jangan**; pilih yang maknanya sama, mis. `Users` untuk Handshake) dan **catat penggantinya di laporan task** (Ruling B1-12).

- [ ] **Step 8: Verifikasi bundel** (dependensi baru + impor baru)

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`.

- [ ] **Step 9: Commit**

```bash
git add "apps/mobile/app/(tabs)/(beranda)/index.tsx" apps/mobile/test/beranda.test.ts apps/mobile/src/judul-layar.ts apps/mobile/src/dompet/teks-dompet.ts apps/mobile/src/messages.ts apps/mobile/test/radar-messages.test.ts apps/mobile/test/dompet-tanpa-kunci-dev.test.ts apps/mobile/package.json pnpm-lock.yaml
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi Beranda — sapaan, Copy alamat, acara LIVE, Recently met, feed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Mutasi — Copy menyalin alamat utuh**

Di `apps/mobile/app/(tabs)/(beranda)/index.tsx`, ganti `Clipboard.setStringAsync(signer.address)` dengan `Clipboard.setStringAsync(alamatSingkat(signer.address))`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/beranda.test.ts`
Expected: FAIL — `Beranda baru (spec desain UI §6.1) > Copy menyalin alamat UTUH, bukan yang disingkat, lalu toast + getar ringan`. Rekam, lalu `git checkout -- "apps/mobile/app/(tabs)/(beranda)/index.tsx"`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 11: Mutasi — batas muat saat fokus dipakai**

Di berkas yang sama, ganti `if (!bolehMuatFokus(terakhir.current, kini)) return;` dengan baris kosong.

Run: `pnpm --filter @nearly/mobile exec vitest run test/beranda.test.ts`
Expected: FAIL — `… > memuat saat fokus, paling sering sekali per 30 detik (§4.6)`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 6: ⛔ GERBANG STOP — uji iPhone pemilik sebelum kelompok Profil

**Files:** tidak ada berkas yang diubah.

> **BERHENTI DI SINI.** Task 7 dan seterusnya **tidak boleh dimulai** sebelum pemilik project menjawab. Ini gerbang yang sama bentuknya dengan Task 1 Rencana A: dua kelompok layar pertama (Handshake dan Beranda) adalah yang pertama memakai judul besar + `ScrollView`, latar gelap, sheet `Modal`, `expo-clipboard`, toast, dan haptic. Kalau salah satu pola itu ternyata salah di perangkat sungguhan, memperbaikinya setelah enam layar Profil ikut memakainya jauh lebih mahal — dan Rencana B2 mewarisi kesalahannya.

- [ ] **Step 1: Verifikasi lokal sebelum menyerahkan**

```bash
pnpm -r test
pnpm -r typecheck
git log --oneline f5691be..HEAD
git status --short          # WAJIB kosong
```

Expected: dua perintah pertama hijau; log memuat lima commit Task 1–5; `git status` kosong.

- [ ] **Step 2: Controller melakukan push** (bukan pelaksana)

Controller mendorong branch `desain-ui` ke remote, lalu memberi tahu pemilik project bahwa kelompok (a) dan (b) siap diuji.

- [ ] **Step 3: Pemilik project menguji di iPhone (Expo Go)**

`npx expo start --go -c` di `apps/mobile`. Yang diperiksa — **persis daftar ini**, dengan hasil dicatat butir demi butir:

1. **Judul besar dan guliran.** Tab **Handshake**: judul "Handshake" besar di atas, segmen **Show QR / Scan** terlihat penuh (tidak tertutup header), dan judulnya mengecil saat isi digulir. *(Ini butir yang menggagalkan Rencana A — spec §4.7 amandemen 2026-09-19.)*
2. **Latar gelap dan status bar.** Beranda dan Handshake berlatar gelap; jam, sinyal, dan baterai di status bar **terbaca** (terang di atas gelap). Ubah tampilan iPhone ke **terang** → aplikasi tetap gelap, teks tetap terbaca.
3. **Segmen Show QR / Scan.** "Show QR" menampilkan QR di atas pelat terang yang berganti tiap 30 detik, dengan hitung mundur "Ask them to scan this. Changes in N seconds.", alamat utuh, dan catatan lokasi di bawahnya. "Scan" membuka kamera **persegi**. Pindah ke tab lain → lampu kamera iOS mati; kembali → hidup lagi.
4. **Alur sheet lengkap** (butuh HP kedua, atau `apps/api/tools/peer.ts`). Pindai QR orang kedua →
   - getar (haptic Success) **saat sheet muncul**;
   - sheet naik dari bawah dengan dua avatar bertumpuk (punyamu bercincin kuning, punyanya hijau), judul "You met 0x…" yang **dalam ~1 detik berganti "You met ‹nama›"** bila orang itu punya nama, lencana "✓ met in person", dan baris "Connected. 0x…";
   - kamera **tidak** memindai ulang selama sheet terbuka (tidak ada pesan "You're already connected");
   - **"Scan someone else"** menutup sheet dan pemindai siap lagi;
   - tombol/gestur **kembali Android** (bila diuji di Android) berperilaku sama dengan "Scan someone else";
   - ulangi dengan identitas ketiga, lalu **"View profile"** → Profil orang itu terbuka (tampilan lama; migrasinya Task 8).
   - Di HP **pemegang QR**: tidak ada sheet dan tidak ada notifikasi apa pun (ini memang batas yang diakui, §11 #7).
5. **Copy dan toast.** Beranda: alamat tampil **singkat** (`0x…`) dengan tombol "Copy" → toast hijau "Address copied" + getar ringan; tempel di Notes → alamat **utuh**. Tombol "Copy" bisa diketuk tanpa harus tepat.
6. **Sapaan.** Beranda menampilkan "Good morning/afternoon/evening" sesuai jam HP, nama tampilanmu di bawahnya (atau tidak ada baris nama kalau namamu kosong).
7. **Kartu "Recently met".** Bagian "Recently met" menampilkan sampai tiga kartu: nama + alamat singkat mono, "✓ met in person", waktu relatif ("yesterday", "2 days ago", "Aug 12"), dan batang trust. Ketuk kartu → Profil orang itu. "See all ›" → layar Koneksi. Kalau belum punya koneksi: ikon + kalimat "No connections yet…" + tombol **Handshake** yang membuka tab Handshake.
8. **Label tab.** Kelima label tab bar terbaca (**Home · Events · Handshake · Messages · Profile**), tombol Handshake kuning di tengah tidak menabrak home indicator, dan tab aktif berwarna kuning.

Catatan tambahan yang diminta (tidak memblokir): apakah kartu LIVE muncul saat ada acara berlangsung, dan apakah "You're checked in · Open radar ›" muncul untuk acara yang sudah kamu check-in.

- [ ] **Step 4: Gerbang**

- **Lulus** bila butir 1–8 berperilaku seperti di atas. Controller mencatat jawabannya, lalu Task 7 boleh dimulai.
- **Gagal** bila salah satu butir tidak bisa dipenuhi. Controller **berhenti**, melaporkan butir mana dan apa yang terlihat, dan meminta keputusan pemilik sebelum kelompok (c) dikerjakan. Perbaikan atas butir yang gagal ditulis sebagai task tambahan di rencana ini oleh controller — **bukan** disisipkan diam-diam ke dalam Task 7–11.

---

## Task 7: Tipe dan kalimat Profil orang (`pertemuan`, `dijaminKenalan`, teks layar)

**Files:**
- Create: `apps/mobile/src/teks-profil.ts`, `apps/mobile/test/teks-profil.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`teksInginBertemuCount`, `tombolTandaLabel`, `meetSuccessMessage`, `MEET_MESSAGES`, `BLOKIR_MESSAGES`, `blokirTombolLabel`), `apps/mobile/src/errors.ts` (`PESAN_GAGAL`, `pesanGagal`), `apps/mobile/test/{meet-messages,meet-gerbang-teks,blokir-messages,errors}.test.ts`

**Interfaces:**
- Consumes: `jamak`, `pasanganJamak`, `formatTanggal`
- Produces:
  - `src/teks-profil.ts` — **tipe kawat HP** untuk dua medan baru API (spec §8.1, §8.2, Ruling B1-8): `AcaraPertemuan`, `AcaraBersama`, `Pertemuan`; **kalimat**: `JUDUL_TRUST`, `JUDUL_PERTEMUAN`, `JUDUL_ONCHAIN`, `jumlahAcaraBersamaTotal`, `ekorLencanaPertemuan`, `barisSalaman`, `barisAcaraBersama`, `teksDijaminKenalan`, `pasanganKoneksi`, `pasanganTransaksi`, `TEKS_GAGAL_MUAT_PROFIL`, `TEKS_SALING_INGIN_BERTEMU`, `TEKS_KIRIM_PESAN`, `TEKS_GAGAL_MENANDAI`, `TEKS_TANDA_TERSIMPAN_GAGAL_MUAT`, `teksGagalBlokir`, `teksBlokirTersimpanGagalMuat`, `TEKS_CATATAN_DIBLOKIR`, `TEKS_VOUCH`, `TEKS_KUOTA_VOUCH`, `labelKirimVouch`, `TEKS_VOUCH_TERKIRIM`, `TEKS_LAPOR`, `TEKS_LABEL_ALASAN`, `TEKS_SELESAI`, `TEKS_PLACEHOLDER_ALASAN`, `labelKirimLaporan`, `TEKS_LAPORAN_DITERIMA`

**API tidak disentuh.** Kedua medan sudah dikirim `GET /profile/:address` sejak Rencana A (Task 11): `pertemuan` dan `dijaminKenalan`, keduanya **hanya di cabang terbukti** dan **absen** (bukan `0`/`null`) bila store gagal. Kalau bentuk yang diterima ternyata berbeda dari tipe di bawah, **berhenti dan laporkan** — jangan mengubah `apps/api/**` dan jangan menambal bentuknya di HP.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/teks-profil.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  barisAcaraBersama,
  barisSalaman,
  ekorLencanaPertemuan,
  jumlahAcaraBersamaTotal,
  labelKirimLaporan,
  labelKirimVouch,
  pasanganKoneksi,
  pasanganTransaksi,
  teksBlokirTersimpanGagalMuat,
  teksDijaminKenalan,
  teksGagalBlokir,
  type Pertemuan,
} from "../src/teks-profil";

const KINI = new Date(2026, 8, 18, 15, 0); // 18 Sep 2026, waktu lokal
const AGUSTUS = new Date(2026, 7, 12, 19, 42).getTime();

const acara = (judul: string, venue = "Hall A") => ({ eventId: "0xabc", title: judul, venueLabel: venue });
const bersama = (judul: string, detik: number) => ({ ...acara(judul), startsAt: String(detik) });

const pertemuan = (ubah: Partial<Pertemuan> = {}): Pertemuan => ({
  salaman: { atMs: AGUSTUS, acara: null },
  acaraBersama: [],
  jumlahAcaraBersama: 0,
  ...ubah,
});

// Spec desain UI §8.1, §6.3, R8, Ruling B1-9.
describe("jumlah acara bersama", () => {
  it("acara salaman ikut dihitung — acaraBersama sengaja tidak memuatnya", () => {
    expect(jumlahAcaraBersamaTotal(pertemuan())).toBe(0);
    expect(jumlahAcaraBersamaTotal(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack") } }))).toBe(1);
    expect(jumlahAcaraBersamaTotal(pertemuan({ jumlahAcaraBersama: 3 }))).toBe(3);
    expect(jumlahAcaraBersamaTotal(pertemuan({
      salaman: { atMs: AGUSTUS, acara: acara("BNB Hack") },
      jumlahAcaraBersama: 3,
    }))).toBe(4);
  });
});

describe("ekor lencana '✓ met in person · N events together'", () => {
  it("tanpa pertemuan atau tanpa acara sama sekali → tidak ada ekor", () => {
    expect(ekorLencanaPertemuan(null)).toBeUndefined();
    expect(ekorLencanaPertemuan(undefined)).toBeUndefined();
    expect(ekorLencanaPertemuan(pertemuan())).toBeUndefined();
  });

  it("satu acara memakai bentuk tunggal", () => {
    expect(ekorLencanaPertemuan(pertemuan({ jumlahAcaraBersama: 1 }))).toBe(" · 1 event together");
    expect(ekorLencanaPertemuan(pertemuan({ jumlahAcaraBersama: 4 }))).toBe(" · 4 events together");
  });
});

describe("kartu Meetings (spec §6.3 butir 4, R7)", () => {
  it("salaman di acara menyebut acara dan tempatnya", () => {
    const b = barisSalaman(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack", "Hall A") } }), KINI);
    expect(b.judul).toBe("Handshake at BNB Hack · Hall A");
    expect(b.tanggal).toBe("Aug 12");
  });

  it("tempat kosong tidak meninggalkan pemisah menggantung", () => {
    const b = barisSalaman(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack", "  ") } }), KINI);
    expect(b.judul).toBe("Handshake at BNB Hack");
  });

  it("salaman di luar acara → Met in person, tanpa tempat", () => {
    const b = barisSalaman(pertemuan(), KINI);
    expect(b.judul).toBe("Met in person");
    expect(b.tanggal).toBe("Aug 12");
  });

  it("acara bersama memakai startsAt dalam DETIK unix", () => {
    const detik = Math.floor(new Date(2026, 7, 12, 9, 0).getTime() / 1000);
    expect(barisAcaraBersama(bersama("Devcon", detik), KINI)).toBe("Both attended · Devcon · Aug 12");
  });
});

describe("Vouched for by N people you know (spec §8.2)", () => {
  it("absen dan nol sama-sama tidak menampilkan baris", () => {
    expect(teksDijaminKenalan(undefined)).toBeNull();
    expect(teksDijaminKenalan(0)).toBeNull();
  });

  it("satu orang memakai bentuk tunggal", () => {
    expect(teksDijaminKenalan(1)).toBe("Vouched for by 1 person you know");
    expect(teksDijaminKenalan(5)).toBe("Vouched for by 5 people you know");
  });
});

describe("pasangan nilai/label kartu On-chain details (§7.1)", () => {
  it("angka dan kata terpisah supaya angkanya bisa lebih keras", () => {
    expect(pasanganKoneksi(1)).toEqual({ angka: "1", kata: "connection" });
    expect(pasanganKoneksi(12)).toEqual({ angka: "12", kata: "connections" });
    expect(pasanganTransaksi(1)).toEqual({ angka: "1", kata: "on-chain transaction" });
    expect(pasanganTransaksi(0)).toEqual({ angka: "0", kata: "on-chain transactions" });
  });
});

describe("kalimat aksi layar profil", () => {
  it("label sibuk tidak menjanjikan aksi", () => {
    expect(labelKirimVouch(true)).toBe("Sending…");
    expect(labelKirimVouch(false)).toBe("Send vouch");
    expect(labelKirimLaporan(true)).toBe("Sending…");
    expect(labelKirimLaporan(false)).toBe("Send report");
  });

  it("kegagalan MEMUAT ULANG tidak pernah mengaku aksinya gagal", () => {
    expect(teksGagalBlokir(true)).not.toBe(teksGagalBlokir(false));
    for (const cabut of [true, false]) {
      const t = teksBlokirTersimpanGagalMuat(cabut);
      expect(t.toLowerCase()).toContain("reload");
      expect(t.toLowerCase()).not.toContain("couldn't");
    }
  });
});
```

Di `apps/mobile/test/meet-gerbang-teks.test.ts`, ganti enam harapan (bagian `teksPenandaHadir` dan `teksKutandaiHadir` **tidak** diubah — layarnya dimigrasi Rencana B2):

| Baris lama | Baris baru |
|---|---|
| `    expect(teksInginBertemuCount(0)).toBe("0 orang ingin bertemu dia");` | `    expect(teksInginBertemuCount(0)).toBe("0 people want to meet them");` |
| `    expect(teksInginBertemuCount(12)).toBe("12 orang ingin bertemu dia");` | `    expect(teksInginBertemuCount(12)).toBe("12 people want to meet them");` |
| `    expect(tombolTandaLabel(false, biasa)).toBe("Ingin bertemu");` | `    expect(tombolTandaLabel(false, biasa)).toBe("Want to meet");` |
| `    expect(tombolTandaLabel(true, biasa)).toBe("Batal ingin bertemu");` | `    expect(tombolTandaLabel(true, biasa)).toBe("Undo want to meet");` |
| `    expect(tombolTandaLabel(false, { milikSendiri: false, sibuk: true })).toBe("Mengirim…");` | `    expect(tombolTandaLabel(false, { milikSendiri: false, sibuk: true })).toBe("Sending…");` |
| `    expect(tombolTandaLabel(true, { milikSendiri: false, sibuk: true })).toBe("Mengirim…");` | `    expect(tombolTandaLabel(true, { milikSendiri: false, sibuk: true })).toBe("Sending…");` |

Tambahkan satu `it` di dalam `describe("teksInginBertemuCount", …)` yang sudah ada:

```ts
  it("satu orang memakai bentuk tunggal", () => {
    expect(teksInginBertemuCount(1)).toBe("1 person wants to meet them");
  });
```

Di `apps/mobile/test/meet-messages.test.ts`, ganti tiga baris:

| Baris lama | Baris baru |
|---|---|
| `  it("menerjemahkan setiap kode gerbang meet ke bahasa Indonesia", () => {` | `  it("menerjemahkan setiap kode gerbang meet ke kalimat Inggris", () => {` |
| `      "Ditandai. Kalau dia menandaimu balik, kalian akan saling tahu.",` | `      "Marked. If they mark you back, you'll both know.",` |
| `    expect(meetErrorMessage("terblokir")).toBe("Kamu tidak bisa menandai orang ini.");` | `    expect(meetErrorMessage("terblokir")).toBe("You can't mark this person.");` |

Di `apps/mobile/test/blokir-messages.test.ts`, ganti empat baris:

| Baris lama | Baris baru |
|---|---|
| `    expect(blokirTombolLabel(false, false)).toContain("Blokir");` | `    expect(blokirTombolLabel(false, false)).toContain("Block");` |
| `    expect(blokirTombolLabel(true, false)).toContain("Cabut");` | `    expect(blokirTombolLabel(true, false)).toContain("Unblock");` |
| `    expect(blokirTombolLabel(false, true)).not.toContain("Blokir");` | `    expect(blokirTombolLabel(false, true)).not.toContain("Block");` |
| `    expect(blokirTombolLabel(true, true)).not.toContain("Cabut");` | `    expect(blokirTombolLabel(true, true)).not.toContain("Unblock");` |

Di `apps/mobile/test/errors.test.ts`, ganti satu baris:

| Baris lama | Baris baru |
|---|---|
| `  it.each(kodeDikenal)("memetakan kode '%s' ke kalimat Indonesia yang tidak kosong", (kode) => {` | `  it.each(kodeDikenal)("memetakan kode '%s' ke kalimat Inggris yang tidak kosong", (kode) => {` |

**Kalau salah satu baris lama tidak ditemukan persis, berhenti dan laporkan.**

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-profil.test.ts test/meet-gerbang-teks.test.ts test/meet-messages.test.ts test/blokir-messages.test.ts`
Expected: FAIL — `Failed to resolve import "../src/teks-profil"` dan harapan kalimat Inggris belum terpenuhi.

- [ ] **Step 3: Tulis `apps/mobile/src/teks-profil.ts`**

```ts
import { jamak, pasanganJamak } from "./jamak";
import { formatTanggal } from "./waktu";

/**
 * Bentuk kawat dua medan baru GET /profile/:address (spec desain UI §8.1,
 * §8.2) dan setiap kalimat layar Profil orang (§6.3). Tipe dan kalimat yang
 * membacanya sengaja satu berkas: keduanya bisa diuji tanpa merender apa pun
 * (Ruling B1-8).
 *
 * Kedua medan hanya ada di cabang TERBUKTI, dan ABSEN (bukan 0/null) bila
 * store di server gagal — absen berarti "tidak diketahui", dan mengarang
 * angka dari kegagalan adalah kebohongan tentang orang lain.
 */

export type AcaraPertemuan = { eventId: string; title: string; venueLabel: string };
/** `startsAt` = detik unix sebagai string, bentuk yang sama dengan acara lain di API. */
export type AcaraBersama = AcaraPertemuan & { startsAt: string };

export type Pertemuan = {
  salaman: { atMs: number; acara: AcaraPertemuan | null };
  /** Maks. 10, terbaru dulu, TANPA acara salaman di atas. */
  acaraBersama: AcaraBersama[];
  jumlahAcaraBersama: number;
};

export const JUDUL_TRUST = "Trust";
export const JUDUL_PERTEMUAN = "Meetings";
export const JUDUL_ONCHAIN = "On-chain details";

/**
 * R8: "jumlah kali" adalah jumlah acara yang KALIAN BERDUA hadiri. Acara
 * tempat salaman terjadi sengaja tidak masuk `acaraBersama`, jadi menghitung
 * panjang larik saja akan kehilangan satu (Ruling B1-9).
 */
export function jumlahAcaraBersamaTotal(p: Pertemuan): number {
  return p.jumlahAcaraBersama + (p.salaman.acara ? 1 : 0);
}

/** Ekor lencana "✓ met in person · N events together"; tanpa acara → tanpa ekor. */
export function ekorLencanaPertemuan(p: Pertemuan | null | undefined): string | undefined {
  if (!p) return undefined;
  const n = jumlahAcaraBersamaTotal(p);
  return n < 1 ? undefined : ` · ${jamak(n, "event together", "events together")}`;
}

/**
 * Baris salaman di kartu Meetings. Tempat hanya nama acara + venueLabel yang
 * ditulis host (R7) — sel lokasi tidak pernah dikirim ke HP.
 */
export function barisSalaman(p: Pertemuan, sekarang: Date): { judul: string; tanggal: string } {
  const a = p.salaman.acara;
  const tempat = a?.venueLabel.trim() ?? "";
  return {
    judul: a ? `Handshake at ${a.title}${tempat ? ` · ${tempat}` : ""}` : "Met in person",
    tanggal: formatTanggal(new Date(p.salaman.atMs), sekarang),
  };
}

export function barisAcaraBersama(a: AcaraBersama, sekarang: Date): string {
  const tanggal = formatTanggal(new Date(Number(a.startsAt) * 1000), sekarang);
  return `Both attended · ${a.title} · ${tanggal}`;
}

/**
 * Spec §8.2. `undefined` (store gagal) dan `0` sama-sama tidak menampilkan
 * baris: nol bukan fakta yang perlu dipamerkan, dan absen bukan nol.
 */
export function teksDijaminKenalan(jumlah: number | undefined): string | null {
  if (jumlah === undefined || jumlah < 1) return null;
  return `Vouched for by ${jamak(jumlah, "person you know", "people you know")}`;
}

/** Kartu On-chain details: nilai lebih keras dari labelnya (§7.1, #16A). */
export function pasanganKoneksi(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "connection", "connections");
}

export function pasanganTransaksi(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "on-chain transaction", "on-chain transactions");
}

/* Kalimat layar — terjemahan 1:1 kalimat yang sudah ada di app/profile/[address].tsx. */

export const TEKS_GAGAL_MUAT_PROFIL =
  "Couldn't load this profile. Check your connection, then try again.";

export const TEKS_SALING_INGIN_BERTEMU = "You both want to meet.";

export const TEKS_KIRIM_PESAN = "Send message";

export const TEKS_GAGAL_MENANDAI = "Couldn't save that. Try again.";

/**
 * Tandanya SUDAH tersimpan di server pada titik ini — kegagalan memuat ulang
 * adalah kegagalan yang BERBEDA, dan kalimatnya tidak boleh mengaku aksinya
 * gagal.
 */
export const TEKS_TANDA_TERSIMPAN_GAGAL_MUAT =
  "Your mark was saved, but the profile failed to reload. Reload this screen to see the latest numbers.";

export function teksGagalBlokir(akanMencabut: boolean): string {
  return akanMencabut ? "Couldn't unblock." : "Couldn't block.";
}

export function teksBlokirTersimpanGagalMuat(akanMencabut: boolean): string {
  return akanMencabut
    ? "The block was removed, but the profile failed to reload. Reload this screen to see the latest status."
    : "This person is blocked, but the profile failed to reload. Reload this screen to see the latest status.";
}

export const TEKS_CATATAN_DIBLOKIR =
  "You blocked this person. You won't appear in each other's feed, and you can't mark each other.";

export const TEKS_VOUCH = "Vouch";

/** Server-lah yang tahu sisa kuota; layar hanya menyebut batasnya. */
export const TEKS_KUOTA_VOUCH = "Up to 3 vouches a day.";

export function labelKirimVouch(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Send vouch";
}

export const TEKS_VOUCH_TERKIRIM = "Vouch sent.";

export const TEKS_LAPOR = "Report";
export const TEKS_LABEL_ALASAN = "Reason for the report";
export const TEKS_SELESAI = "Done";
export const TEKS_PLACEHOLDER_ALASAN = "Tell us what happened";

export function labelKirimLaporan(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Send report";
}

/**
 * Bukan hiasan: kalimat ini mencegah pengguna mengira Report adalah senjata
 * yang menurunkan skor orang lain (spec induk §6).
 */
export const TEKS_LAPORAN_DITERIMA =
  "Report received. Reports don't lower anyone's score — they trigger a review.";
```

- [ ] **Step 4: Terjemahkan kelompok meet dan blokir di `src/messages.ts`**

4a. Ganti badan `meetSuccessMessage`:

```ts
  return sudahDitandai
    ? "Ditandai. Kalau dia menandaimu balik, kalian akan saling tahu."
    : "Dibatalkan. Dia tidak lagi tahu kamu menandainya.";
```

dengan:

```ts
  return sudahDitandai
    ? "Marked. If they mark you back, you'll both know."
    : "Undone. They no longer know you marked them.";
```

4b. Ganti seluruh blok `const MEET_MESSAGES: Record<string, string> = { … };` (komentar Indonesia di dalamnya **dipertahankan**) dengan:

```ts
const MEET_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  expired: "This request has expired. Try again.",
  bad_signature: "The signature doesn't match. Try again.",
  tandai_diri: "You can't mark yourself.",
  // Penandatanganan buktinya otomatis, jadi ini bukan salah pengguna — buktinya
  // hilang, kedaluwarsa, atau dibuat dari dompet yang berbeda dari yang
  // dipakai sekarang. Muat ulang layarnya memaksa bukti baru dibuat.
  butuh_bukti: "The proof is missing, expired, or from a different wallet. Reload this screen to try again.",
  invalid_body: "Some of the details aren't right yet.",
  invalid_address: "That address isn't valid. Try again from the previous screen.",
  // POST /meet mengembalikan ini (403) kalau penanda tangan dan target
  // punya hubungan blokir, arah mana pun. Kalimatnya sengaja netral: tidak
  // bilang siapa yang memblokir siapa, dan tidak bilang "saling memblokir"
  // (itu salah untuk blokir sepihak). Spec menerima bahwa orang yang
  // diblokir bisa MENYIMPULKAN adanya blokir dari sini — tapi tidak
  // memberitahunya secara eksplisit.
  terblokir: "You can't mark this person.",
};
```

4c. Ganti `  return MEET_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";` dengan `  return MEET_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";`

4d. Ganti badan `teksInginBertemuCount`:

```ts
  if (jumlah === undefined) return null;
  return `${jumlah} orang ingin bertemu dia`;
```

dengan:

```ts
  if (jumlah === undefined) return null;
  return jamak(jumlah, "person wants to meet them", "people want to meet them");
```

dan tambahkan impor di baris paling atas berkas, tepat di bawah impor `@nearly/shared` yang pertama:

```ts
import { jamak } from "./jamak";
```

4e. Ganti badan `tombolTandaLabel` bagian akhir:

```ts
  if (opsi.sibuk) return "Mengirim…";
  return sudahKutandai ? "Batal ingin bertemu" : "Ingin bertemu";
```

dengan:

```ts
  if (opsi.sibuk) return "Sending…";
  return sudahKutandai ? "Undo want to meet" : "Want to meet";
```

4f. Ganti seluruh blok `const BLOKIR_MESSAGES: Record<string, string> = { … };` (komentar dipertahankan) dengan:

```ts
const BLOKIR_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  blokir_diri: "You can't block yourself.",
  bad_signature: "The signature doesn't match. Try again.",
  expired: "This request has expired. Try again.",
  // Sama seperti di layar kecocokan: bukan salah pengguna, dan yang menolong
  // adalah memuat ulang, bukan mengetuk tombol yang sama lagi.
  butuh_bukti: "The proof is missing, expired, or from a different wallet. Reload this screen to try again.",
  invalid_body: "Some of the details aren't right yet.",
};
```

4g. Ganti `  return BLOKIR_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";` dengan `  return BLOKIR_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";`

4h. Ganti badan `blokirTombolLabel`:

```ts
  if (sibuk) return "Mengirim…";
  return sudahDiblokir ? "Cabut blokir" : "Blokir orang ini";
```

dengan:

```ts
  if (sibuk) return "Sending…";
  return sudahDiblokir ? "Unblock" : "Block this person";
```

- [ ] **Step 5: Terjemahkan `src/errors.ts`**

Ganti seluruh blok `const PESAN_GAGAL: Record<string, string> = { … };` dan baris cadangan `pesanGagal` dengan:

```ts
const PESAN_GAGAL: Record<string, string> = {
  ...GALAT_JARINGAN,
  quota_exceeded: "You've used up today's vouches.",
  not_connected: "You can only vouch for someone you've met in person.",
  already_vouched: "You've already vouched for this person.",
  not_vouched: "You haven't vouched for this person.",
  bad_signature: "Your signature isn't valid. Try again.",
  chain_error: "The network is congested. Try again in a moment.",
  self_vouch: "You can't vouch for yourself.",
  expired: "This request has expired. Try again.",
  invalid_body: "Something was wrong with the request. Try again.",
};

/** Kode yang tidak dikenal tetap dapat kalimat, bukan nama field mentah. */
export function pesanGagal(code: string): string {
  return PESAN_GAGAL[code] ?? "Something went wrong. Try again.";
}
```

Komentar blok di atas `PESAN_GAGAL` **tidak diubah**, kecuali kata "kalimat Indonesia" di dalamnya menjadi "kalimat Inggris".

- [ ] **Step 6: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/teks-profil.test.ts test/meet-gerbang-teks.test.ts test/meet-messages.test.ts test/blokir-messages.test.ts test/errors.test.ts test/galat-jaringan.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/teks-profil.ts apps/mobile/test/teks-profil.test.ts apps/mobile/src/messages.ts apps/mobile/src/errors.ts apps/mobile/test/meet-gerbang-teks.test.ts apps/mobile/test/meet-messages.test.ts apps/mobile/test/blokir-messages.test.ts apps/mobile/test/errors.test.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): tipe pertemuan dan penjamin, serta kalimat Inggris layar Profil orang

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — acara salaman ikut dihitung**

Di `apps/mobile/src/teks-profil.ts`, ganti badan `jumlahAcaraBersamaTotal` dengan `  return p.jumlahAcaraBersama;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-profil.test.ts`
Expected: FAIL — `jumlah acara bersama > acara salaman ikut dihitung — acaraBersama sengaja tidak memuatnya`. Rekam, lalu `git checkout -- apps/mobile/src/teks-profil.ts`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — absen lawan nol pada penjamin**

Di berkas yang sama, ganti `if (jumlah === undefined || jumlah < 1) return null;` dengan `if (jumlah === undefined) return null;`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-profil.test.ts`
Expected: FAIL — `Vouched for by N people you know (spec §8.2) > absen dan nol sama-sama tidak menampilkan baris`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 8: Migrasi Profil orang — urutan #16A, kartu Trust, Meetings, On-chain details

**Files:**
- Rewrite: `apps/mobile/app/profile/[address].tsx`
- Create: `apps/mobile/test/profil-orang.test.ts`
- Modify: `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`)

**Interfaces:**
- Consumes: seluruh `src/teks-profil.ts` (Task 7), `Avatar`, `BatangTrust`, `Lencana`, `KeadaanGalat`, `KerangkaDaftar`, `Card`, `Input`, `Button`, `Text`, `useKabar`, `labelAksesTrust`/`tierView`/`SUGGESTED_TAGS`, `namaKartuRadar`, `teksInginBertemuCount`, `tombolTandaLabel`, `meetSuccessMessage`, `blokirTombolLabel`, `pesanGagal`
- Produces: Profil orang berbahasa Inggris dengan urutan #16A; `LAYAR_TERMIGRASI` memuat `"profile/[address]"` (latar isi gelap dari `opsiTampilan` di root layout)

**Yang TIDAK berubah** (keputusan #12): seluruh logika vouch, lapor, blokir, tanda, `loadError`, gerbang absen-lawan-nol (`sudahKutandai`/`sudahKublokir` diperiksa `!== undefined`), pemisahan kegagalan AKSI dari kegagalan MUAT ULANG, guliran ke isian lapor, `router.navigate` untuk membuka percakapan (Ruling A9 + `review-fondasi.test.ts`), dan layar ini tetap satu-satunya pengecualian pola pembungkus (signer boleh `null`).

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/profil-orang.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const profil = () => tanpaKomentar(baca("app/profile/[address].tsx"));

describe("urutan Profil orang (keputusan #16A)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("profile/[address]")).toBe(true);
  });

  it("baris aksi berada di bawah kepala dan SEBELUM kartu Trust", () => {
    const isi = profil();
    const kepala = isi.indexOf("UKURAN.avatarKepala");
    const aksi = isi.indexOf("TEKS_KIRIM_PESAN");
    const trust = isi.indexOf("JUDUL_TRUST");
    expect(kepala).toBeGreaterThan(-1);
    expect(kepala).toBeLessThan(aksi);
    expect(aksi).toBeLessThan(trust);
  });

  it("Vouch, Report, dan Block berada paling bawah, Block terakhir", () => {
    const isi = profil();
    const onchain = isi.indexOf("JUDUL_ONCHAIN");
    expect(onchain).toBeLessThan(isi.indexOf("TEKS_VOUCH"));
    expect(isi.indexOf("TEKS_VOUCH")).toBeLessThan(isi.indexOf("TEKS_LAPOR"));
    expect(isi.indexOf("TEKS_LAPOR")).toBeLessThan(isi.indexOf("blokirTombolLabel("));
  });

  it("kartu Trust menaruh nilai tier di atas batang, dengan label kecil di atasnya", () => {
    const isi = profil();
    const label = isi.indexOf("{JUDUL_TRUST}");
    const nilai = isi.indexOf("tierView(trust.tier, trust.evidence).label");
    const batang = isi.indexOf("<BatangTrust");
    expect(label).toBeLessThan(nilai);
    expect(nilai).toBeLessThan(batang);
    // Batang dan label tier dikelompokkan jadi satu elemen aksesibel (§3.7).
    expect(isi).toContain("accessibilityLabel={labelAksesTrust(trust.tier)}");
  });
});

describe("dua medan baru API di layar Profil orang (spec §8.1, §8.2)", () => {
  it("lencana memakai ekor '· N events together' hanya bila pertemuan ada", () => {
    const isi = profil();
    expect(isi).toContain("ekorLencanaPertemuan(p.pertemuan)");
    expect(isi).toContain("{p.pertemuan ? <Lencana");
  });

  it("kartu Meetings hanya muncul bila pertemuan ada", () => {
    const isi = profil();
    const kartu = isi.indexOf("{JUDUL_PERTEMUAN}");
    expect(kartu).toBeGreaterThan(-1);
    expect(isi.slice(0, kartu)).toMatch(/p\.pertemuan \?[\s\S]*$/);
    expect(isi).toContain("barisSalaman(p.pertemuan, kini)");
    expect(isi).toContain("barisAcaraBersama(a, kini)");
  });

  it("'Vouched for by …' dibangun fungsi murni, dan 0 tidak merender apa pun", () => {
    const isi = profil();
    expect(isi).toContain("teksDijaminKenalan(p.dijaminKenalan)");
    expect(isi).toContain("{penjamin ? <Text");
  });

  it("kartu On-chain details memakai pasangan nilai/label (§7.1)", () => {
    const isi = profil();
    expect(isi).toContain("pasanganKoneksi(p.connectionCount)");
    expect(isi).toContain("pasanganTransaksi(p.txCount)");
  });
});

describe("perilaku layar Profil orang tidak berubah (keputusan #12)", () => {
  it("gerbang absen-lawan-nol tetap memeriksa !== undefined, bukan truthiness", () => {
    expect(profil()).toContain("p.sudahKublokir !== undefined");
  });

  it("percakapan tetap dibuka dengan navigate, bukan push (Ruling A9)", () => {
    const isi = profil();
    expect(isi).toContain("router.navigate(`/pesan/${address}`)");
    expect(isi).not.toContain("router.push(");
  });

  it("isian alasan laporan memakai Input BNA, bukan TextInput react-native", () => {
    const isi = profil();
    expect(isi).toContain('from "@/components/ui/input"');
    expect(isi).not.toContain("WARNA");
  });

  it("vouch dan laporan yang berhasil pindah ke toast (spec §7.2)", () => {
    const isi = profil();
    expect(isi).toContain("kabar.berhasil(TEKS_VOUCH_TERKIRIM)");
    expect(isi).toContain("kabar.berhasil(TEKS_LAPORAN_DITERIMA)");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/profil-orang.test.ts`
Expected: FAIL — `LAYAR_TERMIGRASI` belum memuat kuncinya, dan layar masih versi lama.

- [ ] **Step 3: Tulis ulang `apps/mobile/app/profile/[address].tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Address } from "viem";
import { Avatar } from "@/components/avatar";
import { BatangTrust } from "@/components/batang-trust";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../src/config";
import { pesanGagal } from "../../src/errors";
import { ApiError, req } from "../../src/http";
import { aksiBlokir } from "../../src/blokir-actions";
import { aksiTanda } from "../../src/meet-actions";
import { kueriBuktiProfil } from "../../src/meet-api";
import {
  blokirErrorMessage, blokirTombolLabel, meetErrorMessage, meetSuccessMessage, namaKartuRadar,
  teksInginBertemuCount, tombolTandaLabel,
} from "../../src/messages";
import {
  barisAcaraBersama, barisSalaman, ekorLencanaPertemuan, JUDUL_ONCHAIN, JUDUL_PERTEMUAN,
  JUDUL_TRUST, labelKirimLaporan, labelKirimVouch, pasanganKoneksi, pasanganTransaksi,
  teksBlokirTersimpanGagalMuat, teksDijaminKenalan, teksGagalBlokir, TEKS_CATATAN_DIBLOKIR,
  TEKS_GAGAL_MENANDAI, TEKS_GAGAL_MUAT_PROFIL, TEKS_KIRIM_PESAN, TEKS_KUOTA_VOUCH,
  TEKS_LABEL_ALASAN, TEKS_LAPOR, TEKS_LAPORAN_DITERIMA, TEKS_PLACEHOLDER_ALASAN,
  TEKS_SALING_INGIN_BERTEMU, TEKS_SELESAI, TEKS_TANDA_TERSIMPAN_GAGAL_MUAT, TEKS_VOUCH,
  TEKS_VOUCH_TERKIRIM, type Pertemuan,
} from "../../src/teks-profil";
import { labelAksesTrust, SUGGESTED_TAGS, tierView } from "../../src/tier";
import { fetchTrust, sendReport, sendVouch, type TrustResponse } from "../../src/trust-api";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
  /**
   * Angka publik (spec §8) — tidak butuh bukti apa pun. Tapi BENAR-BENAR
   * opsional: server menghilangkan kuncinya kalau store gagal menjawab,
   * justru supaya kegagalan itu tidak menyamar sebagai `0` (lihat GET
   * /profile/:address). Dirender lewat `teksInginBertemuCount`, bukan
   * `?? 0` — "0 people want to meet them" adalah klaim faktual tentang orang
   * lain, dan mengarangnya dari store yang mati adalah bohong.
   */
  inginBertemuCount?: number;
  /**
   * ABSEN (bukan `false`) kalau bukti baca gagal atau tidak dikirim — server
   * hanya menyertakan bendera ini untuk pemanggil yang membuktikan dirinya
   * (lihat GET /profile/:address). Absen berarti "tidak diketahui", BUKAN
   * "belum kamu tandai" — dua hal itu tidak sama, dan menyamakannya membuat
   * layar ini berbohong.
   */
  sudahKutandai?: boolean;
  salingMenandai?: boolean;
  /**
   * ABSEN (bukan `false`) untuk alasan yang sama persis dengan
   * `sudahKutandai`: siapa memblokir siapa bukan informasi publik, jadi
   * server hanya menyertakannya untuk pemanggil yang bukti bacanya berhasil.
   * Absen berarti "tidak diketahui" — layar ini WAJIB memeriksa
   * `!== undefined`, bukan truthiness, atau "tidak diketahui" akan diam-diam
   * dibaca sebagai "belum diblokir".
   */
  sudahKublokir?: boolean;
  /**
   * Riwayat pertemuan (spec desain UI §8.1). `null` = pemanggil dan orang ini
   * tidak terkoneksi, atau ini profil sendiri. Kunci ABSEN = store gagal;
   * keduanya berarti tidak ada kartu Meetings dan tidak ada lencana.
   */
  pertemuan?: Pertemuan | null;
  /** Penjamin yang juga koneksimu (spec §8.2). Absen = store gagal, bukan nol. */
  dijaminKenalan?: number;
};

export default function ProfileScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * Menggulirkan isian ke atas keyboard.
   *
   * Tanpa ini, membuka form laporan meninggalkan kotak isiannya di belakang
   * keyboard dan tidak ada yang memindahkannya — pengguna mengetik ke sesuatu
   * yang tidak bisa dilihatnya. Jeda 150 ms menunggu animasi keyboard selesai;
   * dipanggil lebih awal, viewport belum menyusut dan gulirannya berhenti di
   * posisi lama.
   */
  const gulirKeIsian = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };
  const [p, setP] = useState<Profile | null>(null);
  const [trust, setTrust] = useState<TrustResponse | null>(null);
  const kabar = useKabar();
  const kuning = useColor("primary");
  const garis = useColor("border");

  // Null sesaat setelah Ganti dompet; layar ini memang sudah menangani signer
  // null, jadi tidak perlu dipecah seperti layar lain (Ruling D4).
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const isOwnProfile = !!signer && !!address
    && signer.address.toLowerCase() === address.toLowerCase();

  const [connected, setConnected] = useState<boolean | null>(null);

  // Pesan sendiri, TERPISAH dari vouchMessage: tombol "Want to meet" tampil
  // untuk siapa pun yang bukti bacanya berhasil, terlepas dari `connected`
  // (dua orang bisa saling menandai lewat feed tanpa pernah terkoneksi).
  const [meetMessage, setMeetMessage] = useState<string | null>(null);
  // Sedang menandai/mencabut — dipakai untuk menolak ketukan kedua sebelum
  // yang pertama selesai dan untuk memberi tahu pengguna bahwa ketukannya
  // sudah terdaftar, bukan diam saja.
  const [meetBusy, setMeetBusy] = useState(false);

  // Sama seperti meetMessage/meetBusy di atas, tapi untuk aksi blokir —
  // TERPISAH supaya pesan blokir tidak menimpa pesan tanda atau sebaliknya.
  const [blokirMessage, setBlokirMessage] = useState<string | null>(null);
  const [blokirBusy, setBlokirBusy] = useState(false);

  // Kegagalan MEMUAT profil (bukan kegagalan membuat bukti baca — itu
  // ditangani secara terpisah di bawah dan tidak boleh menutup profil publik).
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showVouchPicker, setShowVouchPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [vouchBusy, setVouchBusy] = useState(false);
  const [vouchMessage, setVouchMessage] = useState<string | null>(null);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const muatProfil = useCallback(async () => {
    setLoadError(null);
    // Bukti baca (LihatProfil) hanya disertakan kalau ada signer — tanpa
    // itu server tetap membalas dengan angka publiknya saja, dan bendera
    // sudahKutandai/salingMenandai/pertemuan/dijaminKenalan memang absen.
    //
    // Kegagalan MEMBUAT buktinya ditangkap DI SINI, terpisah dari permintaan
    // profilnya sendiri — endpoint ini publik, dan bukti hanya membuka
    // bendera privat tambahan.
    let kueri = "";
    if (signer && address) {
      try {
        kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      } catch { /* lanjut sebagai pemanggil tanpa bukti, bukan gagal total */ }
    }
    try {
      // `req` melempar ApiError kalau responsnya bukan 2xx — tanpa ini, badan
      // galat dari server bisa lolos ke `setP` dan dirender seolah profil.
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setLoadError(TEKS_GAGAL_MUAT_PROFIL);
    }
  }, [address, signer]);

  useEffect(() => { void muatProfil(); }, [muatProfil]);

  useEffect(() => {
    if (!address) return;
    fetchTrust(address as Address).then(setTrust).catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!signer || !address || isOwnProfile) { setConnected(null); return; }
    // Endpoint khusus ya/tidak, BUKAN menarik daftar koneksi — daftar itu
    // dibatasi 100 terbaru dan akan salah untuk pasangan yang koneksinya
    // lebih lama dari itu (lihat GET /connected/:a/:b di apps/api).
    req<{ connected?: boolean }>(`/connected/${signer.address}/${address}`)
      .then((j) => setConnected(!!j.connected))
      .catch(() => setConnected(false));
  }, [signer, address, isOwnProfile]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    ));
  }

  async function handleVouch() {
    if (!signer || selectedTags.length === 0) return;
    setVouchBusy(true);
    setVouchMessage(null);
    try {
      await sendVouch(signer, address as Address, selectedTags);
      setSelectedTags([]);
      setShowVouchPicker(false);
      // Aksi penting → toast hijau + haptic (spec §7.2), bukan teks di layar.
      kabar.berhasil(TEKS_VOUCH_TERKIRIM);
      // Muat ulang bukti — tier atau evidenceLine bisa langsung berubah.
      fetchTrust(address as Address).then(setTrust).catch(() => {});
    } catch (e) {
      // Kode kegagalan mentah dari server tidak pernah tampil apa adanya.
      setVouchMessage(e instanceof Error ? pesanGagal(e.message) : pesanGagal(""));
    } finally {
      setVouchBusy(false);
    }
  }

  async function handleReport() {
    if (!signer || !reportReason.trim()) return;
    setReportBusy(true);
    try {
      await sendReport(signer, address as Address, reportReason.trim());
      Keyboard.dismiss();
      setShowReportForm(false);
      setReportReason("");
      setReportMessage(null);
      // Kalimat ini bukan hiasan: ia mencegah pengguna mengira Report adalah
      // senjata yang menurunkan skor orang lain (spec induk §6).
      kabar.berhasil(TEKS_LAPORAN_DITERIMA);
    } catch (e) {
      setReportMessage(e instanceof Error ? pesanGagal(e.message) : pesanGagal(""));
    } finally {
      setReportBusy(false);
    }
  }

  async function toggleTanda() {
    if (!signer || !address || meetBusy) return;
    // Dibersihkan di AWAL, bukan setelah `aksiTanda` berhasil — kalau tidak,
    // pesan galat percobaan sebelumnya nongkrong di layar sepanjang percobaan
    // berikutnya, termasuk selama request ini berjalan.
    setMeetMessage(null);
    setMeetBusy(true);
    const akanMencabut = !!p?.sudahKutandai;
    try {
      await aksiTanda(signer, address as Address, akanMencabut);
    } catch (e) {
      setMeetMessage(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_MENANDAI);
      setMeetBusy(false);
      return;
    }
    // Tandanya SUDAH tersimpan di server pada titik ini. Kegagalan di bawah
    // (memuat ulang) adalah kegagalan yang BERBEDA dari kegagalan menandai —
    // memakai kalimat "gagal menandai" di sini akan membohongi pengguna
    // tentang aksi yang justru berhasil.
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
      // Kalimat "menandai"-nya SAMA PERSIS dengan yang diucapkan kartu feed
      // untuk aksi yang sama — lihat meetSuccessMessage.
      setMeetMessage(meetSuccessMessage(!akanMencabut));
    } catch {
      setMeetMessage(TEKS_TANDA_TERSIMPAN_GAGAL_MUAT);
    } finally {
      setMeetBusy(false);
    }
  }

  // Mengikuti pola toggleTanda persis: pesan dibersihkan di AWAL, ketukan
  // ganda ditolak lewat blokirBusy, dan kegagalan AKSI dipisahkan dari
  // kegagalan MUAT ULANG sesudahnya.
  async function toggleBlokir() {
    if (!signer || !address || blokirBusy) return;
    setBlokirMessage(null);
    setBlokirBusy(true);
    const akanMencabut = !!p?.sudahKublokir;
    try {
      await aksiBlokir(signer, address as Address, akanMencabut);
    } catch (e) {
      setBlokirMessage(e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(akanMencabut));
      setBlokirBusy(false);
      return;
    }
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setBlokirMessage(teksBlokirTersimpanGagalMuat(akanMencabut));
    } finally {
      setBlokirBusy(false);
    }
  }

  if (!p) {
    // `loadError` hanya terisi kalau permintaan profilnya sendiri gagal (bukan
    // kalau hanya pembuatan buktinya yang gagal) — lihat `muatProfil`. Tanpa
    // cabang ini, kegagalan jaringan membekukan layar di keadaan memuat
    // selamanya, tanpa pesan dan tanpa jalan keluar.
    return (
      <View style={s.memuat}>
        {loadError
          ? <KeadaanGalat kalimat={loadError} onCobaLagi={() => void muatProfil()} />
          : <KerangkaDaftar baris={4} />}
      </View>
    );
  }

  const teksInginBertemu = teksInginBertemuCount(p.inginBertemuCount);
  const labelTombolTanda = tombolTandaLabel(
    p.sudahKutandai, { milikSendiri: isOwnProfile, sibuk: meetBusy },
  );
  // Hanya untuk koneksi (spec 4c §4). Server tetap menegakkan gerbangnya
  // sendiri — tombol ini kenyamanan, bukan pengaman.
  const bolehKirimPesan = !!signer && !isOwnProfile && connected === true;
  const adaBarisAksi = bolehKirimPesan || labelTombolTanda !== null;
  const penjamin = teksDijaminKenalan(p.dijaminKenalan);
  const kini = new Date();

  return (
    // Alasan laporan itu multiline, jadi tombol return menyisipkan baris baru
    // dan TIDAK menutup keyboard. iOS juga TIDAK mendukung inputAccessoryViewID
    // pada isian multiline, jadi batang menempel keyboard bukan pilihan. Yang
    // menggantikannya tiga hal: automaticallyAdjustKeyboardInsets,
    // gulirKeIsian(), dan tombol "Done" DI ATAS isian.
    <ScrollView
      ref={scrollRef}
      style={s.flex}
      contentContainerStyle={s.root}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={s.kepala}>
        <Avatar
          nama={p.displayName || null}
          alamat={p.address}
          ukuran={UKURAN.avatarKepala}
          cincin={p.pertemuan ? "verified" : "avatarAwal"}
        />
        {/* Nama boleh apa saja dan TIDAK unik. Alamat SELALU tampil di
            bawahnya — nama bukan identitas, alamat-lah identitasnya (§9.2). */}
        <Text variant="heading">{namaKartuRadar(p.displayName)}</Text>
        <Text variant="mono" selectable>{p.ens ?? p.address}</Text>
        {p.ens ? <Text variant="mono" selectable>{p.address}</Text> : null}
        {p.pertemuan ? <Lencana varian="terverifikasi" ekor={ekorLencanaPertemuan(p.pertemuan)} /> : null}
      </View>

      {/* #16A: aksi yang paling mungkin diambil terlihat tanpa menggulir. */}
      {adaBarisAksi ? (
        <View style={s.bagian}>
          <View style={s.barisAksi}>
            {bolehKirimPesan ? (
              <Button style={s.tombolAksi} onPress={() => router.navigate(`/pesan/${address}`)}>
                {TEKS_KIRIM_PESAN}
              </Button>
            ) : null}
            {labelTombolTanda !== null ? (
              <Button
                variant="secondary"
                style={s.tombolAksi}
                disabled={meetBusy}
                onPress={() => void toggleTanda()}
              >
                {labelTombolTanda}
              </Button>
            ) : null}
          </View>
          {teksInginBertemu !== null ? <Text variant="caption">{teksInginBertemu}</Text> : null}
          {p.salingMenandai ? <Text variant="caption">{TEKS_SALING_INGIN_BERTEMU}</Text> : null}
          {meetMessage ? <Text variant="caption">{meetMessage}</Text> : null}
        </View>
      ) : null}

      {/* Tier SELALU tampil bersama buktinya, tidak pernah sebagai angka
          telanjang (spec induk §8); nilainya dominan atas labelnya (#16A). */}
      {trust ? (
        <Card style={s.kartu}>
          <View accessible accessibilityLabel={labelAksesTrust(trust.tier)} style={s.grupTrust}>
            <Text variant="caption">{JUDUL_TRUST}</Text>
            <Text variant="title">{tierView(trust.tier, trust.evidence).label}</Text>
            <BatangTrust tier={trust.tier} />
          </View>
          <Text variant="caption">{tierView(trust.tier, trust.evidence).evidenceLine}</Text>
          {penjamin ? <Text variant="caption">{penjamin}</Text> : null}
        </Card>
      ) : null}

      {p.pertemuan ? (
        <Card style={s.kartu}>
          <Text variant="caption">{JUDUL_PERTEMUAN}</Text>
          <View style={s.barisNilai}>
            <Text variant="body" style={s.tebal}>{barisSalaman(p.pertemuan, kini).judul}</Text>
            <Text variant="caption">{barisSalaman(p.pertemuan, kini).tanggal}</Text>
          </View>
          {p.pertemuan.acaraBersama.map((a) => (
            <Text key={a.eventId} variant="caption">{barisAcaraBersama(a, kini)}</Text>
          ))}
        </Card>
      ) : null}

      <Card style={s.kartu}>
        <Text variant="caption">{JUDUL_ONCHAIN}</Text>
        <View style={s.barisNilai}>
          <Text variant="title">{pasanganKoneksi(p.connectionCount).angka}</Text>
          <Text variant="caption">{pasanganKoneksi(p.connectionCount).kata}</Text>
        </View>
        <View style={s.barisNilai}>
          <Text variant="title">{pasanganTransaksi(p.txCount).angka}</Text>
          <Text variant="caption">{pasanganTransaksi(p.txCount).kata}</Text>
        </View>
      </Card>

      {signer && !isOwnProfile && connected ? (
        <View style={s.bagian}>
          <View style={s.barisNilai}>
            <Button variant="outline" onPress={() => setShowVouchPicker((v) => !v)}>{TEKS_VOUCH}</Button>
            {/* Server-lah satu-satunya yang benar-benar tahu sisa kuota;
                angka yang bisa basi lebih buruk daripada tanpa angka. */}
            <Text variant="caption">{TEKS_KUOTA_VOUCH}</Text>
          </View>

          {showVouchPicker ? (
            <View style={s.bagian}>
              <View style={s.tag}>
                {SUGGESTED_TAGS.map((tag) => {
                  const dipilih = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: dipilih }}
                      style={[s.pil, { borderColor: dipilih ? kuning : garis }]}
                    >
                      <Text variant="caption" style={dipilih ? { color: kuning } : undefined}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                disabled={vouchBusy || selectedTags.length === 0}
                loading={vouchBusy}
                onPress={() => void handleVouch()}
              >
                {labelKirimVouch(vouchBusy)}
              </Button>
            </View>
          ) : null}

          {vouchMessage ? <Text variant="caption">{vouchMessage}</Text> : null}
        </View>
      ) : null}

      {signer && !isOwnProfile ? (
        <View style={s.bagian}>
          <Button
            variant="outline"
            onPress={() => {
              setShowReportForm((v) => !v);
              gulirKeIsian();
            }}
          >
            {TEKS_LAPOR}
          </Button>

          {showReportForm ? (
            <View style={s.bagian}>
              {/* "Done" duduk DI ATAS isian, bukan di bawahnya: yang di bawah
                  akan tertutup keyboard, persis masalah yang mau diselesaikan. */}
              <View style={s.barisNilai}>
                <Text variant="caption">{TEKS_LABEL_ALASAN}</Text>
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12} accessibilityRole="button">
                  <Text variant="label" style={{ color: kuning }}>{TEKS_SELESAI}</Text>
                </Pressable>
              </View>
              <Input
                placeholder={TEKS_PLACEHOLDER_ALASAN}
                value={reportReason}
                onChangeText={setReportReason}
                onFocus={gulirKeIsian}
                type="textarea"
              />
              <Button
                disabled={reportBusy || !reportReason.trim()}
                loading={reportBusy}
                onPress={() => void handleReport()}
              >
                {labelKirimLaporan(reportBusy)}
              </Button>
            </View>
          ) : null}

          {reportMessage ? <Text variant="caption">{reportMessage}</Text> : null}
        </View>
      ) : null}

      {/*
        `sudahKublokir !== undefined`, BUKAN cek truthiness — absen berarti
        "tidak diketahui" (bukti baca gagal/tidak dikirim), dan melonggarkannya
        ke truthiness diam-diam membuat "tidak diketahui" jadi "belum
        diblokir". Tombol tanda di atas TIDAK ikut disembunyikan: mencabut
        tanda yang sudah ada tetap boleh saat terblokir, hanya MEMASANG tanda
        baru yang ditolak server.
      */}
      {p.sudahKublokir !== undefined && !isOwnProfile ? (
        <View style={s.bagian}>
          <Button variant="destructive" disabled={blokirBusy} onPress={() => { void toggleBlokir(); }}>
            {blokirTombolLabel(p.sudahKublokir, blokirBusy)}
          </Button>
          {p.sudahKublokir ? <Text variant="caption">{TEKS_CATATAN_DIBLOKIR}</Text> : null}
          {blokirMessage ? <Text variant="caption">{blokirMessage}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  memuat: { flex: 1, padding: 16 },
  kepala: { alignItems: "center", gap: 8 },
  bagian: { gap: 12 },
  barisAksi: { flexDirection: "row", gap: 8 },
  tombolAksi: { flex: 1 },
  kartu: { gap: 8 },
  grupTrust: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  tag: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pil: {
    borderWidth: 1,
    borderRadius: RADIUS.lencana,
    paddingHorizontal: 12,
    minHeight: UKURAN.sentuh,
    justifyContent: "center",
  },
  tebal: { fontWeight: "600" },
});
```

- [ ] **Step 4: Daftarkan layar sebagai termigrasi**

Di `apps/mobile/src/judul-layar.ts`, tambahkan satu baris di dalam `LAYAR_TERMIGRASI`:

```ts
  // Rencana B1 kelompok (c) — Profil orang (spec §9 langkah 5c).
  "profile/[address]",
```

Latar gelapnya datang dari `opsiTampilan(name)` yang sudah dipanggil root layout untuk setiap layar Stack akar.

- [ ] **Step 5: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/profil-orang.test.ts test/review-fondasi.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/dompet-tanpa-kunci-dev.test.ts test/tautan.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. `review-fondasi.test.ts` menjaga `router.navigate(\`/pesan/${address}\`)` tetap ada dan tidak ada `router.push` di `app/profile/**`.

- [ ] **Step 6: Verifikasi bundel**

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`.

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/profile/[address].tsx" apps/mobile/test/profil-orang.test.ts apps/mobile/src/judul-layar.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi Profil orang — urutan aksi, kartu Trust, Meetings, detail on-chain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mutasi — urutan #16A**

Di `apps/mobile/app/profile/[address].tsx`, pindahkan seluruh blok `{adaBarisAksi ? ( … ) : null}` ke **bawah** blok kartu Trust (`{trust ? ( … ) : null}`).

Run: `pnpm --filter @nearly/mobile exec vitest run test/profil-orang.test.ts`
Expected: FAIL — `urutan Profil orang (keputusan #16A) > baris aksi berada di bawah kepala dan SEBELUM kartu Trust`. Rekam, lalu `git checkout -- "apps/mobile/app/profile/[address].tsx"`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 9: Mutasi — gerbang absen-lawan-nol**

Di berkas yang sama, ganti `{p.sudahKublokir !== undefined && !isOwnProfile ? (` dengan `{p.sudahKublokir && !isOwnProfile ? (`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/profil-orang.test.ts`
Expected: FAIL — `perilaku layar Profil orang tidak berubah (keputusan #12) > gerbang absen-lawan-nol tetap memeriksa !== undefined, bukan truthiness`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 9: Migrasi Profil (tab) — kepala, visibilitas, daftar tautan

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`
- Create: `apps/mobile/src/teks-akun.ts`, `apps/mobile/test/teks-akun.test.ts`
- Modify: `apps/mobile/src/messages.ts` (`kalimatVisibilitas`, `KALIMAT_BATAS_TERSEMBUNYI`, `pesanNamaTidakSah`, `PROFIL_MESSAGES`, `profilErrorMessage`, `labelSimpanProfil`), `apps/mobile/test/radar-messages.test.ts` (empat baris), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`)

**Interfaces:**
- Consumes: `pasanganKoneksi` (Task 7), `BatangTrust`, `Input`, `Button`, `Text`, `useKabar`, `useLencana`, `teksLencana`, `fetchTrust`, `namaKartuRadar`
- Produces: `src/teks-akun.ts` — kalimat grup tab **Profile** (layar ini + Koneksi, Kecocokan, Dompet, Diblokir di Task 10–11). Task 9 mengisi bagian `profil-saya`; Task 10 dan 11 **menambah** di berkas yang sama.

**Bentuk layar (spec §7.1 "Profil (tab)"):** kepala (nama, alamat **utuh** mono, angka connections sebagai pasangan nilai/label, batang trust berlabel dari `fetchTrust` alamat sendiri) → bagian nama & visibilitas yang sudah ada (logikanya **tidak** berubah) → daftar tautan: Connections, You both want to meet (+ lencana kecocokan), Wallet, Blocked.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/teks-akun.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CATATAN_NAMA, LABEL_NAMA_TAMPILAN, LABEL_TERLIHAT, LABEL_TERSEMBUNYI, LABEL_VISIBILITAS,
  PLACEHOLDER_NAMA, TAUTAN_BLOKIR, TAUTAN_DOMPET, TAUTAN_KECOCOKAN, TAUTAN_KONEKSI,
  TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN, TEKS_TERSIMPAN,
} from "../src/teks-akun";

// Istilah terkunci spec desain UI §7.4 (keputusan #15).
describe("teks grup tab Profile", () => {
  it("Visible / Hidden, bukan terjemahan lain", () => {
    expect(LABEL_VISIBILITAS).toBe("Visibility");
    expect(LABEL_TERLIHAT).toBe("Visible");
    expect(LABEL_TERSEMBUNYI).toBe("Hidden");
  });

  it("daftar tautan memakai istilah terkunci", () => {
    expect(TAUTAN_KONEKSI).toBe("Connections");
    expect(TAUTAN_KECOCOKAN).toBe("You both want to meet");
    expect(TAUTAN_BLOKIR).toBe("Blocked");
    expect(TAUTAN_DOMPET).toBe("Address, 12-word recovery phrase, and switch wallet");
  });

  it("kalimat isian nama tidak kosong dan bukan nama kunci", () => {
    for (const t of [LABEL_NAMA_TAMPILAN, PLACEHOLDER_NAMA, CATATAN_NAMA, TEKS_TERSIMPAN,
      TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN]) {
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toMatch(/_/);
    }
  });

  it("placeholder nama memakai kata yang sama dengan kartu orang tanpa nama", async () => {
    const { namaKartuRadar } = await import("../src/messages");
    expect(PLACEHOLDER_NAMA).toBe(namaKartuRadar(""));
  });
});
```

`apps/mobile/test/profil-saya.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const layar = () => tanpaKomentar(baca("app/(tabs)/(profil)/profil-saya.tsx"));

describe("Profil (tab) baru (spec desain UI §7.1)", () => {
  it("terdaftar termigrasi dan memakai judul besar iOS", async () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/profil-saya")).toBe(true);
    const { opsiTampilan } = await import("../theme/navigasi");
    expect(opsiTampilan("(tabs)/(profil)/profil-saya").headerLargeTitle).toBe(true);
  });

  it("isi berada di dalam ScrollView dengan penyesuaian inset otomatis (§4.7)", () => {
    expect(layar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kepala menampilkan alamat UTUH, jumlah koneksi sebagai pasangan, dan batang trust", () => {
    const isi = layar();
    expect(isi).toContain("{signer.address}");
    expect(isi).toContain("pasanganKoneksi(");
    expect(isi).toContain("<BatangTrust");
  });

  it("daftar tautan lengkap, dengan lencana kecocokan di barisnya", () => {
    const isi = layar();
    for (const t of ["TAUTAN_KONEKSI", "TAUTAN_KECOCOKAN", "TAUTAN_DOMPET", "TAUTAN_BLOKIR"]) {
      expect(isi, t).toContain(t);
    }
    expect(isi).toContain("teksLencana(kecocokanBaru)");
  });

  it("isian nama memakai Input BNA, dan WARNA lama hilang", () => {
    const isi = layar();
    expect(isi).toContain('from "@/components/ui/input"');
    expect(isi).not.toContain("WARNA");
  });

  it("logika simpan tidak berubah: periksaNamaTampilan sebelum mengirim", () => {
    const isi = layar();
    expect(isi).toContain("const cek = periksaNamaTampilan(nama);");
    expect(isi).toContain("if (!cek.ok) {");
    expect(isi).toContain("kabar.berhasil(TEKS_TERSIMPAN)");
  });
});
```

Di `apps/mobile/test/radar-messages.test.ts`, ganti empat baris:

| Baris lama | Baris baru |
|---|---|
| `      expect(profilErrorMessage(code)).not.toBe("Gagal. Coba lagi sebentar.");` | `      expect(profilErrorMessage(code)).not.toBe("Something went wrong. Try again in a moment.");` |
| `    expect(kalimatVisibilitas("tersembunyi")).toMatch(/tidak bisa membuka radar/);` | `    expect(kalimatVisibilitas("tersembunyi")).toMatch(/can't open the radar/);` |
| `    expect(labelSimpanProfil(false)).toBe("Simpan");` | `    expect(labelSimpanProfil(false)).toBe("Save");` |
| `    expect(labelSimpanProfil(true)).toBe("Menyimpan…");` | `    expect(labelSimpanProfil(true)).toBe("Saving…");` |

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-akun.test.ts test/profil-saya.test.ts test/radar-messages.test.ts`
Expected: FAIL — `Failed to resolve import "../src/teks-akun"`, kunci belum termigrasi, dan kalimat profil masih Indonesia.

- [ ] **Step 3: Tulis `apps/mobile/src/teks-akun.ts`**

```ts
/**
 * Kalimat grup tab Profile (spec desain UI §7.1): layar Profil, Koneksi,
 * Kecocokan, Dompet, dan Diblokir. Terjemahan 1:1 kalimat yang sudah ada,
 * memakai istilah terkunci §7.4.
 *
 * Bagian Koneksi/Kecocokan ditambahkan Rencana B1 Task 10, bagian
 * Dompet/Diblokir Task 11 — satu berkas supaya istilah grup ini tidak
 * bercabang antar-layar.
 */

/* Profil (tab) — app/(tabs)/(profil)/profil-saya.tsx */

export const LABEL_NAMA_TAMPILAN = "Display name";
/** Sama dengan nama yang dipakai kartu orang tanpa nama, supaya tidak ada dua kata untuk satu keadaan. */
export const PLACEHOLDER_NAMA = "Unnamed";
export const CATATAN_NAMA = "Names aren't unique. Your address always shows next to it.";

export const LABEL_VISIBILITAS = "Visibility";
export const LABEL_TERLIHAT = "Visible";
export const LABEL_TERSEMBUNYI = "Hidden";

export const TEKS_TERSIMPAN = "Saved.";
export const TEKS_GAGAL_MUAT_PROFIL_SAYA = "Couldn't load your profile.";
export const TEKS_GAGAL_SIMPAN = "Couldn't save. Try again.";

export const TAUTAN_KONEKSI = "Connections";
export const TAUTAN_KECOCOKAN = "You both want to meet";
export const TAUTAN_DOMPET = "Address, 12-word recovery phrase, and switch wallet";
export const TAUTAN_BLOKIR = "Blocked";
```

- [ ] **Step 4: Terjemahkan kelompok profil di `src/messages.ts`**

4a. Ganti badan `kalimatVisibilitas`:

```ts
  return v === "terlihat"
    ? "Orang lain di acara yang sama bisa melihatmu di radar, dan kamu bisa membuka radar."
    : "Kamu tidak muncul di radar dan tidak memicu notifikasi kedekatan — tapi kamu juga tidak bisa membuka radar.";
```

dengan:

```ts
  return v === "terlihat"
    ? "Other people at the same event can see you on the radar, and you can open the radar."
    : "You don't show up on the radar and you don't trigger proximity notifications — but you can't open the radar either.";
```

4b. Ganti:

```ts
export const KALIMAT_BATAS_TERSEMBUNYI =
  "Tersembunyi tidak menyembunyikan salaman dan check-in: keduanya tetap tercatat publik on-chain.";
```

dengan:

```ts
export const KALIMAT_BATAS_TERSEMBUNYI =
  "Hidden doesn't hide handshakes and check-ins: both stay recorded publicly on-chain.";
```

4c. Ganti badan `pesanNamaTidakSah`:

```ts
  return alasan === "terlalu_panjang"
    ? `Nama paling panjang ${MAKS_NAMA_TAMPILAN} karakter.`
    : "Nama memuat karakter tak terlihat atau pengatur arah teks. Hapus karakter itu lalu coba lagi.";
```

dengan:

```ts
  return alasan === "terlalu_panjang"
    ? `Names can be at most ${MAKS_NAMA_TAMPILAN} characters.`
    : "Your name contains invisible or text-direction characters. Remove them, then try again.";
```

4d. Ganti seluruh blok `const PROFIL_MESSAGES: Record<string, string> = { … };` dengan:

```ts
const PROFIL_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  nama_tidak_sah: "That name isn't valid. Check its length and characters.",
  expired: "This request has expired. Try again.",
  bad_signature: "The signature doesn't match. Try again.",
  butuh_autentikasi: "Your session isn't valid. Close this screen, then open it again.",
  invalid_body: "Some of the details aren't right yet.",
};
```

4e. Ganti `  return PROFIL_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";` dengan `  return PROFIL_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";`

4f. Ganti badan `labelSimpanProfil`:

```ts
  return sibuk ? "Menyimpan…" : "Simpan";
```

dengan:

```ts
  return sibuk ? "Saving…" : "Save";
```

- [ ] **Step 5: Tulis ulang `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`**

```tsx
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { periksaNamaTampilan, type Visibilitas } from "@nearly/shared";
import { BatangTrust } from "@/components/batang-trust";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError, req } from "../../../src/http";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import { sesiPesan } from "../../../src/pesan/sesi";
import { getProfilSaya, simpanProfil } from "../../../src/radar/radar-api";
import {
  KALIMAT_BATAS_TERSEMBUNYI, kalimatVisibilitas, labelSimpanProfil, namaKartuRadar,
  pesanNamaTidakSah, profilErrorMessage, sisaKarakterNama, teksLencana,
} from "../../../src/messages";
import {
  CATATAN_NAMA, LABEL_NAMA_TAMPILAN, LABEL_TERLIHAT, LABEL_TERSEMBUNYI, LABEL_VISIBILITAS,
  PLACEHOLDER_NAMA, TAUTAN_BLOKIR, TAUTAN_DOMPET, TAUTAN_KECOCOKAN, TAUTAN_KONEKSI,
  TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN, TEKS_TERSIMPAN,
} from "../../../src/teks-akun";
import { pasanganKoneksi } from "../../../src/teks-profil";
import { fetchTrust, type TrustResponse } from "../../../src/trust-api";

const MODE: { nilai: Visibilitas; judul: string }[] = [
  { nilai: "terlihat", judul: LABEL_TERLIHAT },
  { nilai: "tersembunyi", judul: LABEL_TERSEMBUNYI },
];

export default function ProfilSayaScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ProfilSayaScreenIsi key={signer.address} signer={signer} />;
}

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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.tautan}>
      <Text variant="body" style={s.tebal}>{label}</Text>
      {lencana ? <Lencana varian="teks" teks={lencana} /> : null}
    </Pressable>
  );
}

function ProfilSayaScreenIsi({ signer }: { signer: NearlySigner }) {
  const [nama, setNama] = useState("");
  const [visibilitas, setVisibilitas] = useState<Visibilitas>("terlihat");
  const [dimuat, setDimuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [koneksi, setKoneksi] = useState<number | null>(null);
  const [trust, setTrust] = useState<TrustResponse | null>(null);
  const { kecocokanBaru } = useLencana();
  const kabar = useKabar();
  const merah = useColor("destructive");
  const garis = useColor("border");
  const kuning = useColor("primary");

  useEffect(() => {
    void (async () => {
      try {
        const p = await getProfilSaya(await sesiPesan(signer));
        setNama(p.displayName);
        setVisibilitas(p.visibilitas);
      } catch (e) {
        setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : TEKS_GAGAL_MUAT_PROFIL_SAYA);
      } finally {
        setDimuat(true);
      }
    })();
  }, [signer]);

  // Kepala: angka publik dan tier sendiri. Gagal sendiri — kepala yang tidak
  // lengkap tidak boleh menutup bagian nama dan visibilitas di bawahnya.
  useEffect(() => {
    req<{ connectionCount: number }>(`/profile/${signer.address}`)
      .then((p) => setKoneksi(p.connectionCount))
      .catch(() => {});
    fetchTrust(signer.address).then(setTrust).catch(() => {});
  }, [signer.address]);

  async function simpan() {
    if (sibuk) return;
    const cek = periksaNamaTampilan(nama);
    if (!cek.ok) {
      setPesan(pesanNamaTidakSah(cek.alasan));
      return;
    }
    setSibuk(true);
    try {
      await simpanProfil(signer, { displayName: cek.nama, visibilitas });
      setNama(cek.nama);
      setPesan(null);
      // Aksi penting → toast hijau + haptic (spec §7.2).
      kabar.berhasil(TEKS_TERSIMPAN);
    } catch (e) {
      setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : TEKS_GAGAL_SIMPAN);
    } finally {
      setSibuk(false);
    }
  }

  const sisa = sisaKarakterNama(nama);
  const pasangan = koneksi === null ? null : pasanganKoneksi(koneksi);

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.kepala}>
        <Text variant="title">{namaKartuRadar(nama)}</Text>
        {/* Alamat UTUH di layar detail milikmu sendiri (R4). */}
        <Text variant="mono" selectable>{signer.address}</Text>
        {pasangan ? (
          <View style={s.barisNilai}>
            <Text variant="title">{pasangan.angka}</Text>
            <Text variant="caption">{pasangan.kata}</Text>
          </View>
        ) : null}
        {trust ? <BatangTrust tier={trust.tier} denganLabel /> : null}
      </View>

      <View style={s.bagian}>
        <Text variant="caption">{LABEL_NAMA_TAMPILAN}</Text>
        <Input
          value={nama}
          onChangeText={setNama}
          placeholder={PLACEHOLDER_NAMA}
          editable={dimuat && !sibuk}
          autoCorrect={false}
        />
        {/* Penghitung code point, bukan maxLength — maxLength menghitung unit UTF-16 dan memotong emoji. */}
        <Text variant="caption" style={[s.penghitung, sisa < 0 ? { color: merah } : null]}>{sisa}</Text>
        <Text variant="caption">{CATATAN_NAMA}</Text>
      </View>

      <View style={s.bagian}>
        <Text variant="caption">{LABEL_VISIBILITAS}</Text>
        {MODE.map((m) => {
          const terpilih = visibilitas === m.nilai;
          return (
            <Pressable
              key={m.nilai}
              onPress={() => setVisibilitas(m.nilai)}
              disabled={!dimuat || sibuk}
              style={[s.mode, { borderColor: terpilih ? kuning : garis }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: terpilih }}
            >
              <Text variant="body" style={s.tebal}>{terpilih ? "● " : "○ "}{m.judul}</Text>
              <Text variant="caption">{kalimatVisibilitas(m.nilai)}</Text>
            </Pressable>
          );
        })}
        <Text variant="caption">{KALIMAT_BATAS_TERSEMBUNYI}</Text>
        <Button onPress={() => void simpan()} loading={sibuk} disabled={!dimuat || sibuk || sisa < 0}>
          {labelSimpanProfil(sibuk)}
        </Button>
        {pesan ? <Text variant="caption">{pesan}</Text> : null}
      </View>

      <Card style={s.daftar}>
        <BarisTautan label={TAUTAN_KONEKSI} onPress={() => router.push("/connections")} />
        <BarisTautan
          label={TAUTAN_KECOCOKAN}
          lencana={teksLencana(kecocokanBaru)}
          onPress={() => router.push("/kecocokan")}
        />
        <BarisTautan label={TAUTAN_DOMPET} onPress={() => router.push("/dompet")} />
        <BarisTautan label={TAUTAN_BLOKIR} onPress={() => router.push("/blokir")} />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  bagian: { gap: 8 },
  penghitung: { alignSelf: "flex-end" },
  mode: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12, gap: 4 },
  daftar: { gap: 4 },
  tautan: {
    minHeight: UKURAN.sentuh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tebal: { fontWeight: "600" },
});
```

- [ ] **Step 6: Daftarkan layar sebagai termigrasi**

Di `apps/mobile/src/judul-layar.ts`, tambahkan satu baris di dalam `LAYAR_TERMIGRASI`:

```ts
  "(tabs)/(profil)/profil-saya",
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/teks-akun.test.ts test/profil-saya.test.ts test/radar-messages.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/tautan.test.ts test/dompet-tanpa-kunci-dev.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(tabs)/(profil)/profil-saya.tsx" apps/mobile/src/teks-akun.ts apps/mobile/test/teks-akun.test.ts apps/mobile/test/profil-saya.test.ts apps/mobile/src/messages.ts apps/mobile/test/radar-messages.test.ts apps/mobile/src/judul-layar.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi Profil (tab) — kepala, visibilitas Inggris, daftar tautan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — judul besar butuh ScrollView**

Di `apps/mobile/app/(tabs)/(profil)/profil-saya.tsx`, hapus baris `      contentInsetAdjustmentBehavior="automatic"`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/profil-saya.test.ts`
Expected: FAIL — `Profil (tab) baru (spec desain UI §7.1) > isi berada di dalam ScrollView dengan penyesuaian inset otomatis (§4.7)`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 10: Mutasi — nama tetap diperiksa sebelum dikirim**

Di berkas yang sama, hapus tiga baris `const cek = periksaNamaTampilan(nama);` … `}` (blok `if (!cek.ok)`) dan ganti pemakaian `cek.nama` dengan `nama`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/profil-saya.test.ts`
Expected: FAIL — `… > logika simpan tidak berubah: periksaNamaTampilan sebelum mengirim`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 10: Migrasi Koneksi dan Kecocokan

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/(profil)/connections.tsx`, `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`
- Create: `apps/mobile/test/daftar-profil.test.ts`
- Modify: `apps/mobile/src/teks-akun.ts` (bagian Koneksi & Kecocokan), `apps/mobile/test/teks-akun.test.ts` (satu `describe` baru), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`)

**Interfaces:**
- Consumes: `KOSONG_KONEKSI` + `TEKS_AKSI_HANDSHAKE` (Task 4 — satu kalimat, dua layar), `KartuOrang`, `Lencana`, `KeadaanKosong`, `KerangkaDaftar`, `Card`, `waktuRelatif`, `meetErrorMessage` (sudah Inggris sejak Task 7)
- Produces: `src/teks-akun.ts` bertambah `KOSONG_KECOCOKAN`, `TEKS_GAGAL_KECOCOKAN`, `LENCANA_SALING_INGIN_BERTEMU`

**Dua catatan perilaku (keputusan #12):**
1. **Koneksi tetap menampilkan alamat, bukan nama** — `GET /connections/:address` memang tidak mengirim nama, dan menambahkannya adalah perubahan API di luar tiga data baru (§11 batas #9). Karena itu layar ini **tidak** memakai `KartuOrang` (yang selalu memasangkan nama dengan alamat): barisnya alamat mono + waktu relatif, seperti sekarang, hanya bergaya baru.
2. **Tautan "Lihat profil" per baris Kecocokan menjadi kartu yang bisa diketuk.** Tujuannya sama persis (membuka `/profile/<alamat>`); yang hilang hanya teks tautannya, digantikan target sentuh sebesar kartunya. Aturan "daftar kosong di samping galat BUKAN keadaan kosong" **tetap**.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/teks-akun.test.ts`:

```ts
import { KOSONG_KECOCOKAN, LENCANA_SALING_INGIN_BERTEMU, TEKS_GAGAL_KECOCOKAN } from "../src/teks-akun";

describe("teks Koneksi dan Kecocokan", () => {
  it("lencana kecocokan memakai istilah terkunci, tanpa titik", () => {
    expect(LENCANA_SALING_INGIN_BERTEMU).toBe("You both want to meet");
  });

  it("kalimat kosong kecocokan mengajak menandai, bukan sekadar menyatakan kosong", () => {
    expect(KOSONG_KECOCOKAN.toLowerCase()).toContain("mark");
    expect(TEKS_GAGAL_KECOCOKAN.length).toBeGreaterThan(0);
  });
});
```

`apps/mobile/test/daftar-profil.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const koneksi = () => tanpaKomentar(baca("app/(tabs)/(profil)/connections.tsx"));
const kecocokan = () => tanpaKomentar(baca("app/(tabs)/(profil)/kecocokan.tsx"));

describe("layar Koneksi (spec §7.1 pola daftar)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/connections")).toBe(true);
  });

  it("daftar menyesuaikan inset supaya judul besar bekerja (§4.7)", () => {
    expect(koneksi()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("baris menampilkan alamat, bukan nama karangan (§11 batas #9)", () => {
    const isi = koneksi();
    expect(isi).toContain("variant=\"mono\"");
    expect(isi).not.toContain("<KartuOrang");
  });

  it("keadaan kosong memakai kalimat bersama dan mengajak Handshake (§7.2)", () => {
    const isi = koneksi();
    expect(isi).toContain("KOSONG_KONEKSI");
    expect(isi).toContain("TEKS_AKSI_HANDSHAKE");
  });

  it("keadaan memuat memakai kerangka, bukan teks Memuat…", () => {
    const isi = koneksi();
    expect(isi).toContain("<KerangkaDaftar");
    expect(isi).not.toContain("Memuat");
  });
});

describe("layar Kecocokan (spec §7.1, §7.2)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/kecocokan")).toBe(true);
  });

  it("kartu memakai KartuOrang dengan lencana dan tier", () => {
    const isi = kecocokan();
    expect(isi).toContain("<KartuOrang");
    expect(isi).toContain("LENCANA_SALING_INGIN_BERTEMU");
    expect(isi).toContain("tier={k.tier}");
  });

  it("daftar kosong DI SAMPING galat tetap bukan keadaan kosong", () => {
    const isi = kecocokan();
    expect(isi).toContain("pesan ? null : (");
  });

  it("lencana tab dimuat ulang setelah kecocokan ditandai dilihat (§4.4)", () => {
    expect(kecocokan()).toContain("muatUlangLencana();");
  });

  it("tidak lagi merender TIER_LABELS lewat labelTier di JSX — batang trust menggantikannya", () => {
    expect(kecocokan()).not.toContain("labelTier(");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/daftar-profil.test.ts test/teks-akun.test.ts`
Expected: FAIL — konstanta baru belum ada dan kedua layar masih versi lama.

- [ ] **Step 3: Tambah kalimat di `apps/mobile/src/teks-akun.ts`**

Tambahkan di akhir berkas:

```ts
/* Koneksi dan Kecocokan — app/(tabs)/(profil)/{connections,kecocokan}.tsx */

/** Terjemahan lencana `lencanaKartuRadar` yang ada, tanpa titik (teks lencana). */
export const LENCANA_SALING_INGIN_BERTEMU = "You both want to meet";

export const KOSONG_KECOCOKAN =
  "No one has matched with you yet. Mark the people you want to meet — if they mark you back, you'll both know.";

export const TEKS_GAGAL_KECOCOKAN = "Couldn't load your matches.";
```

- [ ] **Step 4: Tulis ulang `apps/mobile/app/(tabs)/(profil)/connections.tsx`**

```tsx
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Handshake } from "lucide-react-native";
import { KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import { req } from "../../../src/http";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { KOSONG_KONEKSI, TEKS_AKSI_HANDSHAKE } from "../../../src/teks-beranda";
import { waktuRelatif } from "../../../src/waktu";

type Row = { address: string; txHash: string; at: number };

export default function Connections() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ConnectionsIsi key={signer.address} signer={signer} />;
}

function ConnectionsIsi({ signer }: { signer: NearlySigner }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    req<{ connections?: Row[] }>(`/connections/${signer.address}`)
      .then((j) => setRows(j.connections ?? []))
      .catch(() => setRows([]));
  }, [signer.address]);

  if (!rows) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  const kini = new Date();

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(r) => r.address}
      ListEmptyComponent={
        <KeadaanKosong
          Ikon={Handshake}
          kalimat={KOSONG_KONEKSI}
          aksi={{ label: TEKS_AKSI_HANDSHAKE, onPress: () => router.push("/salaman") }}
        />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/profile/${item.address}`)} accessibilityRole="button">
          <Card style={s.kartu}>
            {/* GET /connections tidak mengirim nama; alamat adalah identitasnya
                (spec §9.2, §11 batas #9). */}
            <Text variant="mono">{item.address}</Text>
            <Text variant="caption">{waktuRelatif(new Date(item.at), kini)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
  kartu: { gap: 4 },
});
```

- [ ] **Step 5: Tulis ulang `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`**

```tsx
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { Users } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../src/http";
import {
  getKecocokan, kueriBuktiKecocokan, tandaiKecocokanDilihat, type BarisKecocokan,
} from "../../../src/meet-api";
import { meetErrorMessage } from "../../../src/messages";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import {
  KOSONG_KECOCOKAN, LENCANA_SALING_INGIN_BERTEMU, TEKS_GAGAL_KECOCOKAN,
} from "../../../src/teks-akun";

export default function KecocokanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <KecocokanScreenIsi key={signer.address} signer={signer} />;
}

function KecocokanScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<BarisKecocokan[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const { muatUlangLencana } = useLencana();

  const muat = useCallback(async () => {
    try {
      const { kecocokan } = await getKecocokan(await kueriBuktiKecocokan(signer));
      setBaris(kecocokan);
      setPesan(null);
      // Membuka layar ini MENANDAI sudah dilihat. Kegagalannya tidak boleh
      // mengosongkan daftar yang sudah berhasil dimuat.
      await tandaiKecocokanDilihat(signer).catch(() => {});
      // Titik lencana tab Profil hilang sekarang, bukan 30 detik lagi (spec §4.4).
      muatUlangLencana();
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_KECOCOKAN);
    }
  }, [signer, muatUlangLencana]);

  // SATU pemicu, bukan dua. `useFocusEffect` sudah menyala saat layar pertama
  // kali fokus — yaitu saat mount — jadi `useEffect` di sini akan menjadi
  // duplikat: dua tanda tangan `LihatKecocokan`, dua `GET /kecocokan`, dan dua
  // `POST /kecocokan/dilihat` yang berlomba setiap kali layar dibuka.
  //
  // Fokus juga yang membuat pesan `butuh_bukti` jujur: ia menjanjikan "reload
  // this screen to try again", dan `muat` memoized pada `signer` yang tidak
  // pernah berubah.
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  if (baris === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris}
      keyExtractor={(k) => k.address}
      ListHeaderComponent={pesan ? <Text variant="caption">{pesan}</Text> : null}
      ListEmptyComponent={
        // Kalau `pesan` terisi (mis. 403 butuh_bukti), daftar kosong ini BUKAN
        // berarti "belum ada kecocokan" — itu kegagalan otorisasi. Menampilkan
        // keadaan kosong di atas pesan galat akan membuat kegagalan terlihat
        // seperti keadaan normal.
        pesan ? null : (
          <KeadaanKosong Ikon={Users} kalimat={KOSONG_KECOCOKAN} />
        )
      }
      renderItem={({ item: k }) => (
        <KartuOrang
          nama={k.displayName}
          alamat={k.address}
          terverifikasi={false}
          lencana={<Lencana varian="teks" teks={LENCANA_SALING_INGIN_BERTEMU} />}
          tier={k.tier}
          onPress={() => router.push(`/profile/${k.address}`)}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
});
```

- [ ] **Step 6: Daftarkan kedua layar sebagai termigrasi**

Di `apps/mobile/src/judul-layar.ts`, tambahkan dua baris di dalam `LAYAR_TERMIGRASI`:

```ts
  "(tabs)/(profil)/connections",
  "(tabs)/(profil)/kecocokan",
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/daftar-profil.test.ts test/teks-akun.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/tautan.test.ts test/tier.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. `tier.test.ts` menjaga bahwa `TIER_LABELS` hanya diimpor `src/tier.ts`; layar Kecocokan kini membangun batang dari `tier`, bukan merender label.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(tabs)/(profil)/connections.tsx" "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx" apps/mobile/src/teks-akun.ts apps/mobile/test/teks-akun.test.ts apps/mobile/test/daftar-profil.test.ts apps/mobile/src/judul-layar.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi Koneksi dan Kecocokan ke kartu bergaya baru

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Mutasi — daftar kosong di samping galat**

Di `apps/mobile/app/(tabs)/(profil)/kecocokan.tsx`, ganti `pesan ? null : (` (di `ListEmptyComponent`) dengan `(` dan hapus penutup `)` yang berpasangan, sehingga keadaan kosong selalu dirender.

Run: `pnpm --filter @nearly/mobile exec vitest run test/daftar-profil.test.ts`
Expected: FAIL — `layar Kecocokan (spec §7.1, §7.2) > daftar kosong DI SAMPING galat tetap bukan keadaan kosong`. Rekam, lalu `git checkout -- "apps/mobile/app/(tabs)/(profil)/kecocokan.tsx"`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 10: Mutasi — lencana tab tidak basi**

Di berkas yang sama, hapus baris `      muatUlangLencana();`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/daftar-profil.test.ts`
Expected: FAIL — `… > lencana tab dimuat ulang setelah kecocokan ditandai dilihat (§4.4)`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 11: Migrasi Dompet dan Diblokir

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/(profil)/dompet.tsx`, `apps/mobile/app/(tabs)/(profil)/blokir.tsx`, `apps/mobile/src/dompet/teks-dompet.ts` (kalimat saja — tanda tangan dan logika tetap)
- Create: `apps/mobile/test/dompet-blokir.test.ts`
- Modify: `apps/mobile/src/teks-akun.ts` (bagian Dompet & Diblokir), `apps/mobile/test/teks-akun.test.ts` (satu `describe` baru), `apps/mobile/test/teks-dompet.test.ts` (enam baris), `apps/mobile/src/judul-layar.ts` (`LAYAR_TERMIGRASI`)

**Interfaces:**
- Consumes: `teksGagalBlokir` (Task 7 — "Couldn't unblock." dipakai ulang di sini), `blokirTombolLabel` (Inggris sejak Task 7), `Card`, `Button`, `Text`, `KeadaanKosong`, `KerangkaDaftar`
- Produces: `src/teks-akun.ts` bertambah kalimat layar Dompet dan Diblokir; `src/dompet/teks-dompet.ts` berbahasa Inggris seluruhnya

**Kunci dompet dan 12 kata tidak pernah dicatat ke log atau laporan.** Layar ini hanya menampilkannya di layar setelah konfirmasi, persis seperti sekarang; `Alert.alert` konfirmasi tetap dialog (Ruling B1-14), hanya kalimat dan label tombolnya diterjemahkan.

**Catatan lingkup.** `PERINGATAN_MNEMONIK_UTAMA` di `teks-dompet.ts` dirender layar **Mulai**, yang dimigrasi Rencana B2. Ia tetap diterjemahkan di sini: berkas itu satu modul kalimat dompet, dan meninggalkan satu konstanta berbahasa Indonesia di tengahnya membuat sapuan bahasa B2 harus membukanya lagi. Perilakunya tidak berubah — hanya teksnya.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `apps/mobile/test/teks-akun.test.ts`:

```ts
import {
  CATATAN_ALAMAT, KOSONG_BLOKIR, labelGantiDompet, LABEL_12_KATA, LABEL_ALAMAT,
  TEKS_BLOKIR_DICABUT_GAGAL_MUAT, TEKS_GAGAL_MUAT_BLOKIR, TEKS_HAPUS_DOMPET,
} from "../src/teks-akun";

describe("teks Dompet dan Diblokir", () => {
  it("istilah dompet terkunci", () => {
    expect(LABEL_ALAMAT).toBe("Address");
    expect(LABEL_12_KATA).toBe("12-word recovery phrase");
    expect(labelGantiDompet(false)).toBe("Switch wallet");
    expect(labelGantiDompet(true)).toBe("Deleting…");
  });

  it("catatan alamat tetap menegaskan apa yang TIDAK boleh dibagikan", () => {
    expect(CATATAN_ALAMAT).toContain("12-word recovery phrase");
    expect(TEKS_HAPUS_DOMPET.toLowerCase()).toContain("delete");
  });

  it("kalimat daftar blokir membedakan gagal memuat dari gagal mencabut", () => {
    expect(KOSONG_BLOKIR.length).toBeGreaterThan(0);
    expect(TEKS_GAGAL_MUAT_BLOKIR).not.toBe(TEKS_BLOKIR_DICABUT_GAGAL_MUAT);
    // Pencabutannya SUDAH tersimpan; kalimatnya tidak boleh mengaku gagal.
    expect(TEKS_BLOKIR_DICABUT_GAGAL_MUAT.toLowerCase()).not.toContain("couldn't unblock");
  });
});
```

`apps/mobile/test/dompet-blokir.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const dompet = () => tanpaKomentar(baca("app/(tabs)/(profil)/dompet.tsx"));
const blokir = () => tanpaKomentar(baca("app/(tabs)/(profil)/blokir.tsx"));

describe("layar Dompet (spec §7.1 pola detail)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/dompet")).toBe(true);
  });

  it("alamat tampil UTUH (R4) dan 12 kata hanya setelah konfirmasi", () => {
    const isi = dompet();
    expect(isi).toContain("{address}");
    expect(isi).toContain("Alert.alert(JUDUL_DIALOG_12_KATA");
    expect(isi).toContain("tampilkanMnemonik()");
  });

  it("aksi destruktif memakai varian destructive, bukan warna literal", () => {
    const isi = dompet();
    expect(isi).toContain('variant="destructive"');
    expect(isi).not.toContain("#b00");
  });

  it("12 kata tidak pernah masuk log", () => {
    expect(dompet()).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });
});

describe("layar Diblokir (spec §7.1, §7.2)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/blokir")).toBe(true);
  });

  it("daftar kosong DI SAMPING galat tetap bukan keadaan kosong", () => {
    expect(blokir()).toContain("pesan ? null : (");
  });

  it("kegagalan MUAT ULANG setelah cabut tidak mengaku aksinya gagal", () => {
    const isi = blokir();
    expect(isi).toContain("TEKS_BLOKIR_DICABUT_GAGAL_MUAT");
    expect(isi).toContain("teksGagalBlokir(true)");
  });

  it("tanpa warna literal lagi", () => {
    const isi = blokir();
    for (const warna of ["#b00", "#666", "#eee"]) expect(isi, warna).not.toContain(warna);
  });
});
```

Di `apps/mobile/test/teks-dompet.test.ts`, ganti enam baris:

| Baris lama | Baris baru |
|---|---|
| `    expect(t).toContain("BELUM");` | `    expect(t).toContain("NOT");` |
| `    expect(t).toContain("hilang selamanya");` | `    expect(t).toContain("gone forever");` |
| `    expect(peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: true })).toContain("12 kata pemulihan");` | `    expect(peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: true })).toContain("12-word recovery phrase");` |
| `    expect(peringatanGantiDompet({ punyaMnemonik: false, sudahDicadangkan: true })).toContain("kunci privat");` | `    expect(peringatanGantiDompet({ punyaMnemonik: false, sudahDicadangkan: true })).toContain("private key");` |
| `    expect(pesanGalatDompet(new Error("User interaction is not allowed"))).toBe("Dompet gagal disiapkan. Coba lagi.");` | `    expect(pesanGalatDompet(new Error("User interaction is not allowed"))).toBe("Couldn't set up the wallet. Try again.");` |
| `    expect(pesanGalatDompet("bukan Error")).toBe("Dompet gagal disiapkan. Coba lagi.");` | `    expect(pesanGalatDompet("bukan Error")).toBe("Couldn't set up the wallet. Try again.");` |

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-blokir.test.ts test/teks-akun.test.ts test/teks-dompet.test.ts`
Expected: FAIL — konstanta baru belum ada, kedua layar masih versi lama, dan kalimat dompet masih Indonesia.

- [ ] **Step 3: Terjemahkan `apps/mobile/src/dompet/teks-dompet.ts`**

Ganti setiap kalimat (tanda tangan fungsi, `kataBernomor`, dan komentar Indonesia **tidak** berubah; `TEKS_PENGINGAT_CADANGAN` sudah diterjemahkan di Task 5):

```ts
export const PERINGATAN_MNEMONIK_UTAMA =
  "Don't use the 12 words of a main wallet that holds assets. The wallet key is stored on this phone, not in a hardware wallet.";

export const PERINGATAN_LIHAT_MNEMONIK =
  "Anyone who sees these 12 words can use your identity. Make sure no person and no camera can see your screen.";

export const TEKS_TANPA_MNEMONIK =
  "This wallet was imported from a private key (development only) and has no 12-word recovery phrase.";

export function peringatanGantiDompet(d: RingkasDompet): string {
  if (!d.punyaMnemonik) {
    return "This wallet will be deleted from the phone. Without a 12-word recovery phrase, you can only use it again with the same private key.";
  }
  if (!d.sudahDicadangkan) {
    return "You have NOT written down your 12-word recovery phrase. If this wallet is deleted now, your identity, connections, and message history are gone forever.";
  }
  return "This wallet will be deleted from the phone. Your identity, connections, and message history can only come back through the 12-word recovery phrase you wrote down.";
}
```

dan peta galatnya:

```ts
const PESAN_GALAT: Record<string, string> = {
  mnemonik_tidak_sah: "Those 12 words aren't valid. Check the spelling and the order.",
  kunci_tidak_sah: "That private key isn't valid.",
  hanya_pengembangan: "Importing a private key is only available in development mode.",
  dompet_sudah_ada: "This phone already has a wallet. Remove it first with Switch wallet.",
  entropi_lemah: "This phone failed to generate random numbers, so no wallet was created. Close the app, then try again.",
  dompet_tidak_konsisten: "The wallet didn't save correctly and has been rolled back. Try again.",
  dompet_gagal_dihapus: "The wallet couldn't be deleted from the phone. Try again.",
  dompet_rusak:
    "The wallet data on this phone can't be read. Don't delete the app yet — try again, and have your 12-word recovery phrase ready.",
};

export function pesanGalatDompet(e: unknown): string {
  const kode = e instanceof Error ? e.message : "";
  return PESAN_GALAT[kode] ?? "Couldn't set up the wallet. Try again.";
}
```

- [ ] **Step 4: Tambah kalimat di `apps/mobile/src/teks-akun.ts`**

Tambahkan di akhir berkas:

```ts
/* Dompet — app/(tabs)/(profil)/dompet.tsx */

export const LABEL_ALAMAT = "Address";
export const TEKS_BAGIKAN_ALAMAT = "Share address";
export const CATATAN_ALAMAT =
  "Your address is safe to share, for example with organizers for a seed list. What you must never share with anyone is your 12-word recovery phrase.";

export const LABEL_12_KATA = "12-word recovery phrase";
export const TEKS_LIHAT_12_KATA = "Show 12-word recovery phrase";
export const TEKS_SUDAH_DICATAT = "I've written them down";
export const TEKS_CATATAN_TERSIMPAN = "Saved. Keep your note somewhere safe and offline.";

export const LABEL_GANTI_DOMPET = "Switch wallet";
export const CATATAN_GANTI_DOMPET =
  "Deletes this wallet from the phone, then returns to the Get started screen.";

export function labelGantiDompet(sibuk: boolean): string {
  return sibuk ? "Deleting…" : LABEL_GANTI_DOMPET;
}

/** Dialog konfirmasi tetap Alert.alert (spec §7.2); hanya kalimatnya diterjemahkan. */
export const JUDUL_DIALOG_12_KATA = "Show your 12-word recovery phrase?";
export const JUDUL_DIALOG_GANTI = "Switch wallet?";
export const TEKS_BATAL = "Cancel";
export const TEKS_TAMPILKAN = "Show";
export const TEKS_HAPUS_DOMPET = "Delete wallet from this phone";

/* Diblokir — app/(tabs)/(profil)/blokir.tsx */

export const KOSONG_BLOKIR =
  "You haven't blocked anyone. You can block someone from their profile.";
export const TEKS_GAGAL_MUAT_BLOKIR = "Couldn't load your block list.";
/** Pencabutannya SUDAH tersimpan — kalimat ini tidak boleh mengaku aksinya gagal. */
export const TEKS_BLOKIR_DICABUT_GAGAL_MUAT =
  "The block was removed, but the list failed to reload.";
```

- [ ] **Step 5: Tulis ulang `apps/mobile/app/(tabs)/(profil)/dompet.tsx`**

```tsx
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { useDompet } from "../../../src/dompet/konteks-dompet";
import {
  kataBernomor, PERINGATAN_LIHAT_MNEMONIK, peringatanGantiDompet, pesanGalatDompet,
  TEKS_TANPA_MNEMONIK,
} from "../../../src/dompet/teks-dompet";
import {
  CATATAN_ALAMAT, CATATAN_GANTI_DOMPET, JUDUL_DIALOG_12_KATA, JUDUL_DIALOG_GANTI,
  LABEL_12_KATA, LABEL_ALAMAT, LABEL_GANTI_DOMPET, labelGantiDompet, TEKS_BAGIKAN_ALAMAT,
  TEKS_BATAL, TEKS_CATATAN_TERSIMPAN, TEKS_HAPUS_DOMPET, TEKS_LIHAT_12_KATA,
  TEKS_SUDAH_DICATAT, TEKS_TAMPILKAN,
} from "../../../src/teks-akun";

export default function DompetScreen() {
  const {
    address, punyaMnemonik, sudahDicadangkan, tampilkanMnemonik, tandaiSudahDicadangkan, gantiDompet,
  } = useDompet();
  const [kata, setKata] = useState<string[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const kabar = useKabar();

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
    Alert.alert(JUDUL_DIALOG_12_KATA, PERINGATAN_LIHAT_MNEMONIK, [
      { text: TEKS_BATAL, style: "cancel" },
      { text: TEKS_TAMPILKAN, onPress: () => { void bukaKata(); } },
    ]);
  };

  const sudahDicatat = async () => {
    try {
      await tandaiSudahDicadangkan();
      setKata(null);
      setPesan(null);
      kabar.berhasil(TEKS_CATATAN_TERSIMPAN);
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
    Alert.alert(JUDUL_DIALOG_GANTI, peringatanGantiDompet({ punyaMnemonik, sudahDicadangkan }), [
      { text: TEKS_BATAL, style: "cancel" },
      { text: TEKS_HAPUS_DOMPET, style: "destructive", onPress: () => { void hapus(); } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_ALAMAT}</Text>
        {/* Alamat tampil utuh — alamat-lah identitasnya (spec induk §9.2). */}
        <Text variant="mono" selectable>{address}</Text>
        <Button variant="outline" onPress={bagikan}>{TEKS_BAGIKAN_ALAMAT}</Button>
        <Text variant="caption">{CATATAN_ALAMAT}</Text>
      </Card>

      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_12_KATA}</Text>
        {!punyaMnemonik ? <Text variant="caption">{TEKS_TANPA_MNEMONIK}</Text> : null}
        {punyaMnemonik && kata === null ? (
          <Button variant="outline" onPress={lihatKata}>{TEKS_LIHAT_12_KATA}</Button>
        ) : null}
        {kata ? (
          <View style={s.kotakKata}>
            {kata.map((k) => <Text key={k} variant="mono">{k}</Text>)}
            <Button onPress={() => { void sudahDicatat(); }}>{TEKS_SUDAH_DICATAT}</Button>
          </View>
        ) : null}
      </Card>

      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_GANTI_DOMPET}</Text>
        <Text variant="caption">{CATATAN_GANTI_DOMPET}</Text>
        <Button variant="destructive" loading={sibuk} disabled={sibuk} onPress={ganti}>
          {labelGantiDompet(sibuk)}
        </Button>
      </Card>

      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 16 },
  kartu: { gap: 8 },
  kotakKata: { gap: 8 },
});
```

- [ ] **Step 6: Tulis ulang `apps/mobile/app/(tabs)/(profil)/blokir.tsx`**

```tsx
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { ShieldOff } from "lucide-react-native";
import type { Address } from "viem";
import { KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../src/http";
import { getBlokir, kueriBuktiBlokir, type BarisBlokir } from "../../../src/blokir-api";
import { aksiBlokir } from "../../../src/blokir-actions";
import { blokirErrorMessage, blokirTombolLabel } from "../../../src/messages";
import {
  KOSONG_BLOKIR, TEKS_BLOKIR_DICABUT_GAGAL_MUAT, TEKS_GAGAL_MUAT_BLOKIR,
} from "../../../src/teks-akun";
import { teksGagalBlokir } from "../../../src/teks-profil";

export default function BlokirScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <BlokirScreenIsi key={signer.address} signer={signer} />;
}

function BlokirScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<BarisBlokir[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  // TIDAK menangkap galatnya sendiri: pemanggil (pemicu fokus di bawah, dan
  // `cabut`) yang memutuskan apa arti kegagalan di konteks masing-masing.
  const muat = useCallback(async () => {
    const { blokir } = await getBlokir(await kueriBuktiBlokir(signer));
    setBaris(blokir);
    setPesan(null);
  }, [signer]);

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

  async function cabut(alamat: string) {
    if (sibuk) return;
    setSibuk(alamat);
    setPesan(null);
    try {
      await aksiBlokir(signer, alamat as Address, true);
    } catch (e) {
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(true));
      setSibuk(null);
      return;
    }
    setSibuk(null);
    try {
      await muat();
    } catch {
      // Pencabutannya SUDAH tersimpan. Mengatakan "gagal mencabut" di sini
      // akan berbohong tentang aksi yang berhasil — jadi baris yang dicabut
      // dibuang dari state lokal (tanpa membuang seluruh daftar) dan
      // pesannya jujur: aksinya berhasil, cuma daftarnya yang gagal segar.
      setBaris((b) => b?.filter((x) => x.address !== alamat) ?? b);
      setPesan(TEKS_BLOKIR_DICABUT_GAGAL_MUAT);
    }
  }

  if (baris === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris}
      keyExtractor={(b) => b.address}
      ListHeaderComponent={pesan ? <Text variant="caption">{pesan}</Text> : null}
      ListEmptyComponent={
        // Kalau `pesan` terisi, daftar kosong ini BUKAN berarti "kamu tidak
        // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
        // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
        // pengguna.
        pesan ? null : <KeadaanKosong Ikon={ShieldOff} kalimat={KOSONG_BLOKIR} />
      }
      renderItem={({ item }) => (
        <Card style={s.kartu}>
          <Text variant="mono">{item.address}</Text>
          <Button
            variant="destructive"
            // `true` tetap: setiap baris di layar ini, by construction, adalah
            // orang yang sudah diblokir pengguna.
            disabled={sibuk === item.address}
            loading={sibuk === item.address}
            onPress={() => { void cabut(item.address); }}
          >
            {blokirTombolLabel(true, sibuk === item.address)}
          </Button>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
  kartu: { gap: 8 },
});
```

- [ ] **Step 7: Daftarkan kedua layar sebagai termigrasi**

Di `apps/mobile/src/judul-layar.ts`, tambahkan dua baris di dalam `LAYAR_TERMIGRASI`:

```ts
  "(tabs)/(profil)/dompet",
  "(tabs)/(profil)/blokir",
```

- [ ] **Step 8: Jalankan tes, pastikan lulus**

```bash
pnpm --filter @nearly/mobile exec vitest run test/dompet-blokir.test.ts test/teks-akun.test.ts test/teks-dompet.test.ts test/tema.test.ts test/aksesibilitas.test.ts test/gerbang-dompet.test.ts test/dompet.test.ts
pnpm -r test
pnpm -r typecheck
```

Expected: semua lulus. `gerbang-dompet.test.ts` masih memeriksa layar Mulai (belum dimigrasi) — kalau ia merah karena kalimat `teks-dompet.ts` yang berubah, **laporkan baris tesnya** sebelum menyentuhnya: layar Mulai adalah lingkup B2, dan tes gerbang tidak boleh dilonggarkan hanya supaya hijau.

- [ ] **Step 9: Verifikasi bundel**

```bash
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: berakhir dengan `Exported: <direktori>` tanpa `Error`.

- [ ] **Step 10: Commit**

```bash
git add "apps/mobile/app/(tabs)/(profil)/dompet.tsx" "apps/mobile/app/(tabs)/(profil)/blokir.tsx" apps/mobile/src/dompet/teks-dompet.ts apps/mobile/src/teks-akun.ts apps/mobile/test/teks-akun.test.ts apps/mobile/test/teks-dompet.test.ts apps/mobile/test/dompet-blokir.test.ts apps/mobile/src/judul-layar.ts
git status --short   # WAJIB kosong
git commit -m "feat(mobile): migrasi Dompet dan Diblokir, kalimat dompet berbahasa Inggris

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Mutasi — kegagalan muat ulang setelah cabut**

Di `apps/mobile/app/(tabs)/(profil)/blokir.tsx`, ganti `setPesan(TEKS_BLOKIR_DICABUT_GAGAL_MUAT);` dengan `setPesan(teksGagalBlokir(true));`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/dompet-blokir.test.ts`
Expected: FAIL — `layar Diblokir (spec §7.1, §7.2) > kegagalan MUAT ULANG setelah cabut tidak mengaku aksinya gagal`. Rekam, lalu `git checkout -- "apps/mobile/app/(tabs)/(profil)/blokir.tsx"`, jalankan ulang (PASS), `git status --short` kosong.

- [ ] **Step 12: Mutasi — peringatan Ganti dompet paling keras**

Di `apps/mobile/src/dompet/teks-dompet.ts`, ganti `"You have NOT written down your 12-word recovery phrase. If this wallet is deleted now, your identity, connections, and message history are gone forever."` dengan `"This wallet will be deleted from the phone."`.

Run: `pnpm --filter @nearly/mobile exec vitest run test/teks-dompet.test.ts`
Expected: FAIL — `peringatanGantiDompet > belum dicatat → peringatan paling keras, menyebut hilang selamanya`. Rekam, kembalikan, jalankan ulang (PASS), `git status --short` kosong.

---

## Task 12: Verifikasi kelompok, batas jalur, dan serah terima

**Files:** tidak ada berkas yang diubah (kecuali controller meminta koreksi).

- [ ] **Step 1: Verifikasi global**

Jalankan dari akar worktree dan laporkan ekor keluarannya apa adanya:

```bash
pnpm -r test
pnpm -r typecheck
EKSPOR=$(mktemp -d "${TMPDIR:-/tmp}/nearly-ekspor-XXXXXX") && (cd apps/mobile && npx expo export --platform ios --output-dir "$EKSPOR")
```

Expected: dua perintah pertama lulus di semua paket (`packages/shared`, `packages/trust`, `apps/api`, `apps/mobile`, `apps/web`); ekspor `Exported: …`.

- [ ] **Step 2: Verifikasi batas jalur**

Jalankan setiap perintah terpisah; grep yang kosong keluar dengan status 1 — itu hasil yang diharapkan:

```bash
git diff --stat f5691be..HEAD -- packages apps/web apps/api supabase docs/superpowers/specs   # WAJIB kosong
git diff --name-only f5691be..HEAD | grep -vE '^(apps/mobile/|pnpm-lock\.yaml$|docs/superpowers/plans/)'   # WAJIB kosong
git diff --name-only f5691be..HEAD | grep -E '(^|/)\.env'                                     # WAJIB kosong
git grep -n "Inter_500Medium\|JetBrainsMono_500Medium\|allowFontScaling={false}" -- apps/mobile   # WAJIB kosong
git grep -ln "TIER_LABELS" -- apps/mobile/app apps/mobile/components apps/mobile/src            # WAJIB tepat: apps/mobile/src/tier.ts
git grep -n '"/qr"\|"/scan"' -- apps/mobile                                                     # WAJIB kosong
git status --short                                                                              # WAJIB kosong
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 3: Verifikasi cakupan kelompok (a)–(c)**

```bash
pnpm --filter @nearly/mobile exec vitest run test/judul-layar.test.ts
```

Expected: lulus, dan `LAYAR_TERMIGRASI` berisi **tepat delapan** kunci:

```
(tabs)/(salaman)/salaman
(tabs)/(beranda)/index
profile/[address]
(tabs)/(profil)/profil-saya
(tabs)/(profil)/connections
(tabs)/(profil)/kecocokan
(tabs)/(profil)/dompet
(tabs)/(profil)/blokir
```

Sisa kunci `JUDUL_LAYAR` (Acara, Radar, Pesan, Feed, host-qr, Mulai, Lapor, Buat acara, Unggahan baru) **belum** termigrasi — itu kelompok (d)–(f) Rencana B2, dan latar isinya memang masih terang sampai saat itu (Ruling A2).

Catat juga daftar berkas yang masih memuat teks Indonesia sebagai bahan B2, tanpa memperbaikinya:

```bash
git grep -lnE "\b(yang|dan|kamu|tidak|sudah|belum|dengan|untuk|gagal|berhasil)\b" -- 'apps/mobile/app/*' 'apps/mobile/components/*' 'apps/mobile/src/*'
```

Keluarannya akan memuat berkas dengan komentar Indonesia (itu memang boleh, spec §7.4) — yang dicatat hanya berkas dengan **teks tampilan** Indonesia yang tersisa.

- [ ] **Step 4: Serahkan ke controller** (dilakukan controller, bukan pelaksana)

1. Laporkan ke pemilik project: daftar commit Rencana B1 (Task 1–11), hasil Step 1–3, versi persis `expo-clipboard` yang dipasang, dan setiap nama ikon lucide yang harus diganti (Ruling B1-12).
2. Controller melakukan push. **Pelaksana tidak pernah push.**
3. Uji iPhone kelompok (c) oleh pemilik project — tidak memblokir Rencana B2, tetapi hasilnya dicatat:
   1. **Profil orang** yang pernah disalami di acara: **Send message** dan **Want to meet** terlihat **tanpa menggulir**, di atas kartu Trust; kartu Trust menampilkan tier besar di bawah label "Trust" kecil, dan ruas kosong batangnya terlihat jelas (abu `#56627d`); kartu **Meetings** menyebut nama acara dan tanggalnya; "Vouched for by …" muncul bila ada penjamin yang juga koneksimu; kartu **On-chain details** menampilkan angka lebih keras dari labelnya; Vouch/Report/Block paling bawah, Block berwarna merah.
   2. **Profil (tab):** nama, alamat utuh, jumlah koneksi, batang trust berlabel; Visible/Hidden dengan penjelasannya; menyimpan nama → toast "Saved." + getar; daftar tautan Connections / You both want to meet (+ lencana bila ada kecocokan baru) / Address, 12-word recovery phrase, and switch wallet / Blocked.
   3. **Koneksi** menampilkan alamat + waktu relatif dan bisa diketuk; **Kecocokan** menampilkan kartu orang dengan lencana "You both want to meet" dan batang trust; **Diblokir** menampilkan alamat + tombol Unblock merah.
   4. **Dompet:** alamat utuh, Share address, dialog "Show your 12-word recovery phrase?" dengan tombol Cancel/Show, 12 kata bernomor dalam mono, "I've written them down" → toast, dan "Switch wallet?" dengan tombol "Delete wallet from this phone".
   5. Tidak ada teks Indonesia di layar mana pun dari kelompok (a)–(c), termasuk di dialog konfirmasi dan pesan galat.

---

## Serah terima ke Rencana B2

Rencana B2 menulis dan menjalankan spec §9 **langkah 5 (d)–(g)** dan **langkah 6** di atas antarmuka yang dihasilkan Rencana A **dan** rencana ini.

### Antarmuka yang dihasilkan Rencana B1

**Hook (`apps/mobile/hooks/`)**
- `useKabar(): { berhasil(judul: string): void; disalin(judul: string): void }` — keadaan "berhasil" seragam (§7.2): `berhasil` = toast `success` + `Haptics.notificationAsync(Success)`; `disalin` = toast `success` + `Haptics.impactAsync(Light)` (#16C). **Setiap toast berhasil di B2 memakai hook ini**, bukan `useToast()` langsung.

**Komponen (`apps/mobile/components/`)**
- `salaman/SheetBertemu({ hasil: HasilSalaman; alamatSendiri: string; onTutup: () => void })` dan `type HasilSalaman = { initiator: string; txHash: string }` — `Modal` RN, haptic saat terbuka, nama lewat satu `GET /profile` publik, `router.push("/profile/…")` hanya di "View profile".
- `salaman/ModeQr({ signerSalaman })` dan `salaman/ModePindai({ signerHadir, signerSalaman })` — **sudah dimigrasi**; keduanya keluar dari `KOMPONEN_BELUM_DIMIGRASI` (himpunan itu kini **kosong**, konstantanya masih ada untuk dipakai B2 bila perlu).
- Pola baris tautan setinggi target sentuh ada sebagai komponen lokal `BarisTautan` di `app/(tabs)/(profil)/profil-saya.tsx` — **bila B2 membutuhkannya di layar lain, angkat ke `components/` di task yang pertama memerlukannya**, jangan disalin.

**Token (`apps/mobile/theme/globals.ts`)**
- `RADIUS.pelatQr = 12` (pelat terang di bawah QR), `UKURAN.qr = 260`.

**Fungsi dan konstanta murni (`apps/mobile/src/`)**
- `teks-salaman.ts`: `TEKS_IZIN_KAMERA`, `TEKS_TOMBOL_IZIN_KAMERA`, `CATATAN_LOKASI_QR`, `teksHitungMundurQr(detik)`, `TEKS_GAGAL_SIAPKAN_QR`, `TEKS_BUKAN_QR_NEARLY`, `TEKS_QR_SENDIRI`, `potongTxHash(txHash)`, `teksTerkoneksi(txHash)`, `teksCheckInBerhasil(txHash)`, `TEKS_PINDAI_LAGI`, `TEKS_LIHAT_PROFIL`, `TEKS_PINDAI_ORANG_LAIN`, `TEKS_GAGAL_SALAMAN`, `TEKS_GAGAL_CHECK_IN`.
- `teks-beranda.ts`: `JUDUL_RECENTLY_MET`, `JUDUL_FEED`, `TEKS_LIHAT_SEMUA`, `TEKS_BUKA_RADAR`, `TEKS_BUKA_ACARA`, `TEKS_BUKA_DOMPET`, `TEKS_LIVE`, `pasanganCheckIn(n)`, `TEKS_SUDAH_CHECK_IN`, `TEKS_SALIN`, `LABEL_SALIN_ALAMAT`, `TEKS_ALAMAT_DISALIN`, **`KOSONG_KONEKSI`** (dipakai Beranda dan Koneksi), `TEKS_AKSI_HANDSHAKE`.
- `teks-profil.ts`: tipe kawat **`AcaraPertemuan`**, **`AcaraBersama`**, **`Pertemuan`**; `JUDUL_TRUST`, `JUDUL_PERTEMUAN`, `JUDUL_ONCHAIN`, `jumlahAcaraBersamaTotal(p)`, `ekorLencanaPertemuan(p)`, `barisSalaman(p, sekarang)`, `barisAcaraBersama(a, sekarang)`, `teksDijaminKenalan(n)`, `pasanganKoneksi(n)`, `pasanganTransaksi(n)`, `TEKS_GAGAL_MUAT_PROFIL`, `TEKS_SALING_INGIN_BERTEMU`, `TEKS_KIRIM_PESAN`, `TEKS_GAGAL_MENANDAI`, `TEKS_TANDA_TERSIMPAN_GAGAL_MUAT`, `teksGagalBlokir(akanMencabut)`, `teksBlokirTersimpanGagalMuat(akanMencabut)`, `TEKS_CATATAN_DIBLOKIR`, `TEKS_VOUCH`, `TEKS_KUOTA_VOUCH`, `labelKirimVouch(sibuk)`, `TEKS_VOUCH_TERKIRIM`, `TEKS_LAPOR`, `TEKS_LABEL_ALASAN`, `TEKS_SELESAI`, `TEKS_PLACEHOLDER_ALASAN`, `labelKirimLaporan(sibuk)`, `TEKS_LAPORAN_DITERIMA`.
- `teks-akun.ts` (grup tab Profile): `LABEL_NAMA_TAMPILAN`, `PLACEHOLDER_NAMA`, `CATATAN_NAMA`, `LABEL_VISIBILITAS`, `LABEL_TERLIHAT`, `LABEL_TERSEMBUNYI`, `TEKS_TERSIMPAN`, `TEKS_GAGAL_MUAT_PROFIL_SAYA`, `TEKS_GAGAL_SIMPAN`, `TAUTAN_KONEKSI`, `TAUTAN_KECOCOKAN`, `TAUTAN_DOMPET`, `TAUTAN_BLOKIR`, `LENCANA_SALING_INGIN_BERTEMU`, `KOSONG_KECOCOKAN`, `TEKS_GAGAL_KECOCOKAN`, `LABEL_ALAMAT`, `TEKS_BAGIKAN_ALAMAT`, `CATATAN_ALAMAT`, `LABEL_12_KATA`, `TEKS_LIHAT_12_KATA`, `TEKS_SUDAH_DICATAT`, `TEKS_CATATAN_TERSIMPAN`, `LABEL_GANTI_DOMPET`, `CATATAN_GANTI_DOMPET`, `labelGantiDompet(sibuk)`, `JUDUL_DIALOG_12_KATA`, `JUDUL_DIALOG_GANTI`, `TEKS_BATAL`, `TEKS_TAMPILKAN`, `TEKS_HAPUS_DOMPET`, `KOSONG_BLOKIR`, `TEKS_GAGAL_MUAT_BLOKIR`, `TEKS_BLOKIR_DICABUT_GAGAL_MUAT`.
- `muat-fokus.ts`: `JEDA_MUAT_FOKUS_MS` (30 detik), `bolehMuatFokus(terakhirMs, sekarangMs)` — **dipakai setiap layar tab yang memuat saat fokus** (§4.6).
- `messages.ts` (`AWALAN_SHEET_BERTEMU` baru; `judulSheetBertemu` dibangun darinya).

**Kalimat yang SUDAH berbahasa Inggris** (jangan diterjemahkan lagi di B2): `KALIMAT_SERVER_TAK_TERJANGKAU` + `GALAT_JARINGAN`, `handshakeErrorMessage`, `eventErrorMessage`, `meetErrorMessage`, `meetSuccessMessage`, `teksInginBertemuCount`, `tombolTandaLabel`, `blokirErrorMessage`, `blokirTombolLabel`, `namaKartuRadar`, `kalimatVisibilitas`, `KALIMAT_BATAS_TERSEMBUNYI`, `pesanNamaTidakSah`, `profilErrorMessage`, `labelSimpanProfil`, seluruh `src/errors.ts`, seluruh `src/dompet/teks-dompet.ts`, dan `src/tier.ts` (sejak Rencana A).

**Layar yang sudah dimigrasi** (`LAYAR_TERMIGRASI`, delapan kunci): `(tabs)/(salaman)/salaman`, `(tabs)/(beranda)/index`, `profile/[address]`, `(tabs)/(profil)/profil-saya`, `(tabs)/(profil)/connections`, `(tabs)/(profil)/kecocokan`, `(tabs)/(profil)/dompet`, `(tabs)/(profil)/blokir`.

**Tes dan penjaga baru**: `teks-salaman.test.ts`, `salaman.test.ts`, `beranda.test.ts`, `teks-beranda.test.ts`, `muat-fokus.test.ts`, `teks-profil.test.ts`, `profil-orang.test.ts`, `teks-akun.test.ts`, `profil-saya.test.ts`, `daftar-profil.test.ts`, `dompet-blokir.test.ts`. Penjaga yang cakupannya tumbuh bersama `LAYAR_TERMIGRASI`: `tema.test.ts`, `aksesibilitas.test.ts`. `test/support/berkas.ts` `KOMPONEN_BELUM_DIMIGRASI` kini **kosong**.

**Dependensi baru**: `expo-clipboard` (via `npx expo install`, ada di Expo Go SDK 57). Tidak ada komponen BNA baru yang disalin.

### Yang dikerjakan Rencana B2 (spec §9 langkah 5 (d)–(g) dan langkah 6)

- **5(d) Acara + Radar** — `(tabs)/(acara)/events/index`, `events/[id]`, `events/new`, `events/[id]/host-qr`, `radar/[eventId]`:
  - `formatTanggalJam` menggantikan `toLocaleString("id-ID", …)` di `events/index` dan `events/[id]`;
  - tipe HP `KartuRadarApi.koneksiBersama?: number` (spec §8.3; API **sudah** mengirimnya) dan kalimat "N mutual connections" (tunggal "1 mutual connection"), "N people visible here" dari `jumlah`, "Updated ‹waktu relatif›", "here now", pil "Visible";
  - pemisahan kartu radar ke dua bagian **tanpa mengubah urutan server**: "Your connections here" (`pernahBertemu`) dan "Not met yet";
  - `tierDariLabel(tierLabel)` + `BatangTrust` di kartu radar, `KartuOrang` untuk kartunya, tautan "Handshake ›";
  - terjemahan `KALIMAT_RADAR`/`kalimatRadar`, `lencanaKartuRadar`, `teksPenandaHadir`, `teksKutandaiHadir`, dan kalimat layar acara, beserta `radar-messages.test.ts` + `event-messages.test.ts` bagian yang tersisa;
  - `host-qr` sudah memakai `useIsFocused` (Rencana A) — B2 hanya tampilannya.
- **5(e) Pesan** — `(tabs)/(pesan)/pesan/index`, `pesan/[address]`, `pesan/lapor/[address]`: gelembung (`RADIUS.gelembung` 12, sudut pengirim 4), `Input` BNA + tombol kirim 40×40 dengan `hitSlopSampai(40)`, menu ⋯ berlabel "More options", keterangan "🔒 end-to-end encrypted", **tanpa** "Dibaca …" (R6); terjemahan `PESAN_MESSAGES`, `labelKirimPesan`, `petunjukLaporan`.
- **5(f) Sisanya** — Feed, Unggahan baru, Buat acara, Koneksi… (sudah di B1), **Mulai** (`LogoN`, "Know the people you've actually met", "Create a new wallet", "Use an existing wallet"), dan **keadaan galat gerbang**; terjemahan `FEED_MESSAGES`, `alasanMuncul`. Di akhir kelompok ini:
  - hapus `src/warna.ts` + `test/warna-isian.test.ts` bersama `<TextInput>` terakhir (Ruling A3);
  - `gerbang-dompet.test.ts`: `<TextInput` → `<Input`;
  - `LAYAR_TERMIGRASI` memuat **semua** kunci `JUDUL_LAYAR` → nyalakan penjaga "seluruh `app/`" di `tema.test.ts` dan `aksesibilitas.test.ts`, dan `opsiTampilan` boleh menyederhanakan latar gelap menjadi bawaan `OPSI_STACK`;
  - kosongkan/hapus `KOMPONEN_BELUM_DIMIGRASI` di `test/support/berkas.ts` bila tidak ada komponen yang dipindah apa adanya.
- **5(g) Sapuan bahasa** — sisa teks Indonesia di `app/`, `components/`, `src/`, dan `app.json`; lalu **`bahasa.test.ts`** (spec §7.4, §10.1: penjaga kata Indonesia dengan allowlist berpasangan, `TIER_LABELS` hanya di `src/tier.ts`, tidak ada `toLocale*`, nilai `ios.infoPlist` persis) dinyalakan untuk **seluruh pohon**. Penjaga ini **sengaja tidak dinyalakan di B1**: ia merah selama masih ada layar berbahasa Indonesia, jadi menyalakannya lebih awal berarti menumpuk allowlist yang harus dibongkar lagi.
- **Langkah 6 — dokumen & verifikasi:** amandemen spec induk §15 butir 1–4 (dan periksa butir 5–6 masih ada), `docs/demo/runbook.md` (langkah demo menyebut tab, bukan daftar tautan beranda), dan pengisian hasil uji iPhone §10.3 oleh pemilik project.

**Yang TIDAK boleh dilakukan B2:** menyentuh `apps/api/**` (API selesai), `packages/**`, `apps/web/**`, `supabase/**`, atau `.env` mana pun; menambah rute API baru untuk nama acara di sheet salaman atau sinyal apa pun untuk sisi pemegang QR (keduanya eksplisit di luar lingkup, spec §12).
