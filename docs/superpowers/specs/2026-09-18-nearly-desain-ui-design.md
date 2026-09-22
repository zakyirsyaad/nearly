# Nearly — Desain Ulang UI/UX Aplikasi Mobile: Design Spec

**Tanggal:** 2026-09-18
**Status:** keputusan disetujui pemilik project (2026-09-18, sesi brainstorming dengan mockup HTML), spec ini
menuliskannya; menunggu review tertulis. Diperbarui 2026-09-18: keputusan #15 — aplikasi berbahasa Inggris (§7.4);
keputusan #16 — hasil review UI/UX (urutan Profil orang, warna ruas kosong, alamat singkat + Copy di Beranda, sheet
salaman berhasil, aturan dasar aksesibilitas & ergonomi §3.7)
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Berkaitan:** spec dompet (`2026-09-17-nearly-dompet-per-pengguna-design.md`) §5–§6 — gerbang dompet dan pola
pembungkus signer; spec 4b+5 (`2026-09-14-nearly-fase-4b5-radar-design.md`) §5.2 — kunci kartu radar; spec 4c
(`2026-09-13-nearly-fase-4c-pesan-design.md`) §7.2 — isi push tanpa alamat

---

## 1. Posisi dalam Roadmap

Semua fase fitur (0–6) dan dompet per pengguna tuntas secara kode, tetapi aplikasi mobile masih berupa
**tumpukan layar polos**: beranda adalah daftar sepuluh tautan (`app/index.tsx`), setiap layar memakai
`Text`/`Button` bawaan React Native dengan gaya ditulis tangan per berkas, 28 warna hex tersebar di `app/`, dan
`app.json` memakai `userInterfaceStyle: "automatic"` sehingga teks bawaan iOS ikut memutih di atas latar yang selalu
terang (alasan `src/warna.ts` dan `test/warna-isian.test.ts` ada). Peserta demo dan juri akan menilai Nearly dari
layar ini lebih dulu daripada dari graf trust-nya.

Fase ini mengganti **tampilan dan navigasi** seluruh aplikasi mobile, dan menambah **tiga data baru** di API yang
dibutuhkan layar kunci (riwayat pertemuan, penjamin yang kamu kenal, koneksi bersama di radar). Karena setiap layar
disentuh, bahasa aplikasi sekaligus berpindah dari Indonesia ke **Inggris** (keputusan #15, §7.4). Logika dan perilaku
layar yang ada tidak berubah, dan kalimat yang ada hanya diterjemahkan, kecuali yang disebut di spec ini (keputusan #12).

## 2. Keputusan yang Terkunci

Diputuskan pemilik project (2026-09-18). Ditulis sesuai kata-kata pemilik; tidak dibuka ulang saat implementasi.

| # | Keputusan |
|---|---|
| 1 | **Karakter B2 "Seimbang":** gelap bernuansa teknis tapi berbahasa manusia; lencana "✓ terverifikasi"; trust sebagai batang; alamat mono hanya untuk alamat sendiri di beranda; detail on-chain saat kartu dibuka. *Diubah oleh #16C:* alamat sendiri di Beranda tampil **singkat** (mono) dengan tombol Copy; alamat utuh tinggal di Dompet dan Profil (R4). |
| 2 | **Tema SELALU GELAP** (`app.json` `userInterfaceStyle: "dark"`; tidak ada tema terang). |
| 3 | **Navigasi N1:** 5 tab bawah — Beranda, Acara, Salaman (tombol kuning besar di tengah, radius 14), Pesan (lencana belum dibaca), Profil. |
| 4 | **Ikon I2:** huruf "n" hitam `#07090f` di latar kuning `#f3ba2f`; splash: "n" kuning di `#07090f`. Ekspor PNG 1024 + ikon adaptif Android. |
| 5 | **Font:** Inter (semua teks) + JetBrains Mono (hanya alamat, kode, angka teknis), via paket `@expo-google-fonts`. |
| 6 | **Pustaka komponen: BNA UI** (https://ui.ahmedbna.com) — gaya shadcn: `bna-ui add <komponen>` menyalin sumber ke repo (`components/ui/`), StyleSheet (bukan className), warna lewat `useColor(...)`, token di `@/theme/globals`, `ThemeProvider` di root layout, alias tsconfig `@/*`. Dependensi yang diketahui: `react-native-reanimated` (+ `react-native-worklets` untuk SDK 57), `expo-haptics`, `lucide-react-native` (`react-native-svg` sudah ada). Tema BNA dikunci gelap dan diisi palet B2. |
| 7 | **Token B2:** background `#07090f`, card `#0f1420`, border `#1d2638`, text `#e6edf7`, textMuted `#8a96ad`, primary `#f3ba2f`, primaryForeground `#07090f`, verified `#37d6a8`, destructive `#f06a6a`. Radius 8 kartu/tombol, 14 tombol Salaman; kartu bergaris tanpa bayangan; haptic saat salaman berhasil & tombol utama. |
| 8 | **Peta layar:** Beranda (sapaan, spanduk cadangan, acara LIVE, baru kamu temui, cuplikan feed → `feed/index`, `feed/new`); Acara (`events/index` → `events/[id]`, `radar/[eventId]`, `events/new`, `events/[id]/host-qr`); Salaman = SATU layar dua mode "Tampilkan QR ⟷ Pindai" menggabungkan `app/qr.tsx` + `app/scan.tsx` → setelah berhasil ke `profile/[address]`; Pesan (`pesan/index` → `pesan/[address]`, `pesan/lapor/[address]`); Profil (`profil-saya`: nama, alamat, trust, Terlihat/Tersembunyi → `connections`, `kecocokan`, `dompet`, `blokir`). Di luar tab: `mulai` (tanpa tab bar), `profile/[address]` dari mana saja. Ketuk notifikasi pesan → Pesan › Percakapan; radar → Acara › Radar. Tidak ada fitur hilang. *Diubah oleh #16D:* setelah salaman berhasil, pemindai melihat sheet "You met …" di atas tab Salaman; `profile/[address]` dibuka lewat tombol "View profile" di sheet, bukan otomatis. |
| 9 | **Layar kunci** sesuai mockup layar kunci yang disetujui (Beranda, Salaman, Profil orang, Radar, Percakapan), dengan koreksi privasi #10. |
| 10 | **Data baru di fase ini (API ditambah):** (a) riwayat pertemuan di Profil orang (acara/tempat, kapan, jumlah kali) — hanya pertemuan antara penonton dan orang itu; (b) "Dijamin N orang yang juga kamu kenal" — jumlah penjamin (vouch) orang itu yang merupakan koneksimu; (c) "N koneksi bersama" di Radar untuk orang yang belum kamu temui — HANYA ANGKA tanpa nama, dan HANYA bila kedua pihak Terlihat; blokir dua arah tetap berlaku untuk kartu (hitungan hanya mengecualikan orang yang diblokir penonton — diamandemen 2026-09-18, §8.3); (d) "hadir sejak <jam>" DIBUANG — cukup "hadir sekarang"; (e) "Kamu terlihat oleh N orang" DIGANTI "N orang terlihat di sini", dihitung dari kartu yang dikirim (`jumlah` yang ada); (f) batang trust BERTINGKAT per tier (4 ruas), bukan persentase — radar/profil tidak mengirim skor mentah. |
| 11 | **Pola layar lain:** daftar / formulir / detail; layar Mulai: logo "n" besar, kalimat "Kenali orang yang benar-benar kamu temui", tombol Buat dompet baru & Pakai dompet yang sudah ada. Empat keadaan seragam: memuat = skeleton; kosong = ikon + kalimat + aksi; galat = kalimat galat yang ada + Coba lagi; berhasil = toast hijau + haptic untuk aksi penting. |
| 12 | **Teks/kalimat, logika, dan perilaku layar yang ada TIDAK berubah** kecuali yang disebut di atas (fase ini tampilan + navigasi + 3 data baru). *Diubah oleh #15:* kalimat yang ada **diterjemahkan 1:1 maknanya** ke bahasa Inggris — logika dan perilaku tetap, tidak ada penulisan ulang kalimat di luar terjemahan dan teks baru yang didaftar (§7.3). |
| 13 | **Urutan:** (1) spike BNA di monorepo SDK 57 — satu tombol BNA tampil di Expo Go; bila gagal, jatuh ke token + komponen sendiri; (2) fondasi tema/font/alias/ikon/splash; (3) navigasi tab + rute notifikasi; (4) API 3 data baru + tes privasi; (5) migrasi layar per kelompok: Salaman, Beranda, Profil, Acara+Radar, Pesan, sisanya; (6) dokumen & verifikasi. Eksekutor: sesi `fcc`. |
| 14 | **Pengujian:** tes baca-kode (tak ada warna hex di `app/` selain file tema; semua teks lewat komponen Text BNA; setiap TextInput lewat Input BNA — menggantikan `WARNA`/tes warna-isian; judul setiap layar tetap dijaga seperti `test/judul-layar.test.ts`), tes API dengan fake untuk 3 data baru termasuk kasus privasi (Tersembunyi, blokir dua arah, tidak ada nama di koneksi bersama), uji iPhone (Expo Go) oleh pemilik. |
| 15 | **Bahasa aplikasi mobile: Inggris** (diputuskan 2026-09-18, di fase yang sama karena setiap layar disentuh). Satu bahasa saja — tanpa kerangka i18n, tanpa pengalih bahasa. Istilah terkunci: tab Home · Events · Handshake · Messages · Profile; Salaman (aksi/layar) → Handshake; Terlihat / Tersembunyi → Visible / Hidden; tier Baru · Dikenal · Terpercaya · Inti → New · Known · Trusted · Core; Vouch · Lapor · Blokir / Cabut blokir → Vouch · Report · Block / Unblock; Ingin bertemu / Saling ingin bertemu → Want to meet / You both want to meet; Koneksi · koneksi bersama → Connections · mutual connections; Dompet · 12 kata pemulihan → Wallet · 12-word recovery phrase; lencana "✓ terverifikasi" → "✓ met in person"; "✓ bertemu langsung · N acara bersama" → "✓ met in person · N events together" (tunggal "1 event together"); "Bertemu langsung" → "Met in person"; "Dijamin N orang yang juga kamu kenal" → "Vouched for by N people you know" (tunggal "1 person"); "N koneksi bersama" → "N mutual connections" (tunggal); "N orang terlihat di sini" → "N people visible here"; "hadir sekarang" → "here now"; kalimat Mulai → "Know the people you've actually met"; tombol Mulai → "Create a new wallet" / "Use an existing wallet"; waktu relatif kemarin / N hari lalu → yesterday / N days ago; tanggal "Aug 12"; jam 24 jam "19:42". `apps/web` tidak disentuh (landing dan `/live` sudah berbahasa Inggris). Rincian di §7.4. |
| 16 | **Hasil review UI/UX** (diputuskan 2026-09-18). **A. Urutan Profil orang + hierarki trust:** baris aksi (Send message utama + Want to meet) pindah tepat di bawah blok kepala (avatar, nama, alamat utuh, lencana), SEBELUM kartu Trust, supaya terlihat tanpa menggulir; Vouch/Report/Block tetap paling bawah. Di kartu Trust nilainya dominan: label kecil redup "Trust" (`caption`) di atas nilai tier (mis. "Trusted") berukuran/berbobot `title`, lalu batang tier, baris bukti, "Vouched for by …". Aturan "nilai lebih keras dari label" berlaku di setiap pasangan label/nilai (mis. hitungan Radar, hitungan tab Profil) — §7.1. **B. Warna ruas kosong batang trust** `#56627d` (token baru `segmentEmpty`), kontras 3,01:1 terhadap card `#0f1420` dan 3,3:1 terhadap `verified` `#37d6a8` (WCAG 1.4.11 non-teks ≥ 3:1); menggantikan `border` untuk ruas kosong (§3.1, §3.4). **C. Alamat sendiri di Beranda disingkat** (`0x9bE5…6ffA`, mono) dengan tombol kecil "Copy" (ketuk → alamat utuh ke clipboard lewat `expo-clipboard`, toast "Address copied" + haptic ringan). Alamat utuh tetap di Dompet dan Profil (tab). Mengubah #1 dan R4; `expo-clipboard` dependensi baru (`npx expo install expo-clipboard`, ada di Expo Go). **D. Sheet salaman berhasil (momen puncak):** "toast lalu pindah ke profil" diganti bottom sheet di atas tab Handshake — dua avatar bertumpuk (milikmu bercincin `primary`, miliknya bercincin `verified`), judul "You met ‹nama›" (tanpa nama → alamat singkat), lencana "✓ met in person", baris redup berisi informasi "Connected. 0x…" yang sudah ada, tombol utama "View profile" (→ `profile/[address]`) dan sekunder "Scan someone else" (menutup sheet, pemindai siap lagi); haptic Success saat sheet terbuka; tanpa animasi kustom; nama diambil dengan satu panggilan publik `GET /profile/:alamat` yang sudah ada (R14, diputuskan pemilik 2026-09-18); hanya di sisi yang hari ini sudah tahu salaman berhasil (§6.2). Check-in lewat QR host tetap seperti sekarang. **E. Aturan dasar aksesibilitas & ergonomi** (§3.7): target sentuh ≥ 44×44 pt iOS / 48×48 dp Android; skala jarak 4/8/12/16/24/32; maks. 4 ukuran huruf per layar, bobot 400 dan 600 (700 hanya `heading`), tanpa Inter 500, 10.5 dan 11 disatukan ke 11; teks ikut ukuran huruf sistem (label tab & lencana dibatasi 1,3×); Reduce Motion; safe area; `accessibilityLabel` untuk tombol ikon dan batang trust; tes baca-kode penjaga yang murah. |

Teks UI yang dikutip di #1, #3, #8, #10, dan #11 adalah kata-kata pemilik dalam bahasa Indonesia; yang tampil di
aplikasi adalah padanan Inggrisnya menurut #15 dan §7.4. Di seluruh spec ini, nama Indonesia untuk layar dan tab
(Beranda, Salaman, Profil orang, …) adalah **nama internal** (sama dengan nama grup/berkas); label yang tampil ada di
§4.3 dan §4.7.

Keputusan teknis yang diambil spec ini (bisa ditinjau di review spec):

- **R1. `profile/[address]` tinggal di Stack akar, di atas tab** — sesuai keputusan #8 ("di luar tab … dari mana
  saja"). Dibuka dari tab mana pun, ia menutupi tab bar; tombol kembali pulang ke tab asal. Mockup Profil orang yang
  memperlihatkan tab bar dianggap ilustrasi (§6.3).
- **R2. Setiap tab punya Stack sendiri di grup rute** (`(beranda)`, `(acara)`, `(salaman)`, `(pesan)`, `(profil)`),
  sehingga **URL tidak berubah**: `/`, `/feed`, `/events/<id>`, `/radar/<id>`, `/pesan`, `/pesan/<alamat>`,
  `/profil-saya`, `/connections`, … . `ruteDariNotifikasi` tidak perlu diubah (§4.5).
- **R3. Tidak ada migrasi DB.** Ketiga data baru dibaca dari tabel dan indeks yang sudah ada (§8.5).
- **R4. Nama tampilan selalu didampingi alamat singkat** (`0x12ab…cdef`, mono, redup) di setiap kartu orang. Spec
  induk §6 mengunci "display name tidak pernah unik; alamat/ENS selalu tampil berdampingan" (anti-impersonasi §9.2);
  keputusan #1 "alamat mono hanya untuk alamat sendiri di beranda" dibaca sebagai: **alamat utuh** hanya di layar
  detail (Profil orang, Dompet, Profil tab) dan di bawah QR mode Show QR (seperti sekarang, §6.2); di kartu ringkas alamat orang lain tampil **singkat** di sebelah namanya,
  tidak pernah dihilangkan. Mockup kartu tanpa alamat dianggap ilustrasi. *Diamandemen oleh #16C (2026-09-18):*
  versi awal R4 menaruh alamat sendiri **utuh** di kepala Beranda; kini di Beranda alamat sendiri tampil **singkat**
  (`alamatSingkat`, mono) dengan tombol "Copy" yang menyalin alamat utuh (§6.1). Alamat utuh sendiri tetap di Dompet
  dan di kepala Profil (tab).
- **R5. Terjemahan Inggris kalimat yang sudah ada menang atas teks contoh di mockup.** Mockup menulis "Tunjukkan ke
  orang di depanmu", "berlaku 0:42", "Jamin (vouch)", "Trust tinggi"; layar memakai terjemahan kalimat yang ada
  ("Ask them to scan this. Changes in N seconds.", "Vouch", label tier dari `LABEL_TIER_EN` — §7.4). Teks **baru**
  hanya yang didaftar di §7.3.
- **R6. "Dibaca 19.42" di mockup Percakapan DIBUANG.** Tanda "sudah dibaca" untuk pengirim ada di daftar *di luar
  lingkup* spec 4c (baris "tanda sudah dibaca untuk pengirim, indikator mengetik, reaksi, grup"). Walau
  `dibacaAtMs` ikut terkirim di riwayat, menampilkannya ke pengirim adalah fitur privasi baru yang tidak diputuskan.
- **R7. "Tempat" pada riwayat pertemuan hanya nama acara + `venue_label` yang ditulis host.** Salaman di luar acara
  tampil sebagai "Met in person" tanpa tempat. Sel lokasi (`connections.cell`) tidak pernah dikirim ke HP — "tidak
  ada peta dengan pin orang" (spec induk §6 prinsip #2). Mockup "Kopi Kenangan Sudirman · 2 minggu lalu" tidak bisa
  diwujudkan dan dianggap ilustrasi.
- **R8. "Jumlah kali" diwujudkan sebagai jumlah acara yang kalian berdua hadiri (check-in), bukan jumlah salaman.**
  Salaman hanya bisa terjadi **sekali per pasangan, selamanya**: `connections_unique_pair` di
  `supabase/migrations/0001_init.sql` dan penolakan `already_connected` (409) di `apps/api/src/handshake-gate.ts`.
  Tidak ada data "bertemu 3 kali". Lencana menjadi "✓ met in person" ditambah " · N events together" (N = 1:
  " · 1 event together") bila N ≥ 1 (§8.1). Mencatat salaman ulang butuh perubahan perilaku handshake dan kontrak, dan tidak diambil (§11 batas #6).
- **R9. Lencana "✓ met in person" (keputusan #1 "✓ terverifikasi") berarti "kamu dan orang ini sudah salaman"** — koneksi yang tercatat setelah
  verifikasi ko-lokasi (spec induk §7.1). Bukan verifikasi identitas. Sumbernya `pernahBertemu` (radar), keanggotaan
  di `GET /connections/:address` (Beranda, Koneksi), dan `pertemuan !== null` (Profil orang). Karena #15 memetakan
  "✓ terverifikasi" dan "✓ bertemu langsung" ke teks yang sama, keduanya satu lencana: di Profil orang ia diberi ekor
  " · N events together" (R8), di kartu ringkas tidak.
- **R10. Isi tab dipasang hanya saat tab fokus bila isinya berjalan terus** (Salaman: QR berputar + kamera). Tab
  tetap terpasang saat berpindah tab; tanpa ini QR terus membuat offer tiap 30 detik dan kamera tetap menyala di
  latar (§4.6).
- **R11. PNG ikon dibuat dari SVG sumber oleh skrip yang ikut di-commit** (§3.5), bukan digambar tangan.
- **R12. `expo.version` naik ke `0.2.0`.** `runtimeVersion.policy` adalah `appVersion`; fase ini menambah modul
  native (reanimated, worklets, haptics, splash screen, system UI, clipboard), jadi pembaruan EAS Update dari fase ini
  tidak boleh sampai ke build lama (§14).
- **R13. Sheet salaman berhasil memakai `Modal` React Native, bukan komponen BNA** (#16D). Daftar komponen BNA di §3.6
  tidak memuat sheet/bottom-sheet, dan menambah satu berarti memverifikasi dependensi gerak/gesture baru di Expo Go di
  luar spike. `Modal` bawaan (`transparent`, `animationType="slide"`, `onRequestClose`) cukup dan tidak menambah
  paket (§6.2).
- **R14. Judul sheet "You met ‹nama›": alamat singkat dulu, lalu nama.** Setelah `postAccept` berhasil, pemindai hanya
  tahu `payload.initiator` (alamat, dari QR) dan `txHash`; QR tidak membawa nama. Pemilik project memutuskan
  (2026-09-18) nama diambil: sheet **langsung** terbuka dengan "You met ‹alamat singkat›", lalu **satu** panggilan
  publik `GET /profile/:initiator` **tanpa bukti** — rute dan bentuk yang sama dengan `req<Profile>(`/profile/${address}`)`
  di `app/profile/[address].tsx`, API tidak berubah — mengisi `displayName`; bila tidak kosong, judul berganti ke
  "You met ‹nama›" dan huruf avatarnya ikut nama. Galat, waktu habis, atau nama kosong → judul tetap alamat singkat,
  tanpa pesan galat (sheet tetap berguna). Jawaban yang datang setelah sheet ditutup, atau untuk alamat lain
  (pemindaian berikutnya), dibuang — bandingkan alamat sebelum `set`. Nama acara tetap tidak ditampilkan (tidak ada
  di alur salaman).

## 3. Fondasi Visual

### 3.1 Token warna — `apps/mobile/theme/colors.ts`

Satu-satunya berkas TypeScript yang boleh memuat warna hex (dijaga tes §10.1). BNA memakai satu objek per skema;
**kedua** objek `light` dan `dark` diisi nilai yang sama persis, sehingga skema apa pun yang terbaca tidak pernah
menghasilkan warna terang.

| Token BNA / Nearly | Nilai | Dipakai untuk |
|---|---|---|
| `background` | `#07090f` | latar layar, latar splash |
| `card` | `#0f1420` | kartu, isian, segmen tak aktif |
| `border` | `#1d2638` | garis kartu, garis isian |
| `segmentEmpty` (kunci baru Nearly, #16B) | `#56627d` | ruas batang trust yang kosong — kontras 3,01:1 terhadap `card`, 3,3:1 terhadap `verified` (WCAG 1.4.11) |
| `text` / `foreground` / `cardForeground` | `#e6edf7` | teks utama |
| `textMuted` / `mutedForeground` | `#8a96ad` | teks redup, alamat singkat, ikon tab tak aktif |
| `primary` | `#f3ba2f` | tombol utama, tombol Salaman, tab aktif, fokus isian |
| `primaryForeground` | `#07090f` | teks di atas primary |
| `verified` (kunci baru Nearly) | `#37d6a8` | lencana ✓, ruas batang trust terisi, toast berhasil, titik LIVE |
| `destructive` | `#f06a6a` | Blokir, Ganti dompet, galat |
| `destructiveForeground` | `#f06a6a` | teks tombol destruktif di atas latar `destructive` 12% |

Nama kunci BNA yang tidak ada di tabel ini (mis. `secondary`, warna sistem iOS `blue`/`green`/…) dipetakan ke token
terdekat di tabel dan dicatat di komentar berkas; tidak ada nilai baru di luar palet B2 kecuali turunan transparansi
dari nilai yang sama (mis. `rgba` dari `#f3ba2f` untuk spanduk, dari `#f06a6a` untuk tombol destruktif — nilai persis
di §3.4). **Nama kunci persis milik BNA diverifikasi saat spike** (§9 langkah 1): dokumentasi BNA menyebut `background`,
`foreground`, `card`, `cardForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`,
`destructive`, `destructiveForeground` dan warna sistem iOS, tetapi tidak merinci `border`/`muted`.

### 3.2 Tema dikunci gelap

- `app.json`: `"userInterfaceStyle": "dark"`, `"backgroundColor": "#07090f"`; paket `expo-system-ui` (dibutuhkan
  Android agar `userInterfaceStyle` dan warna latar akar berlaku).
- `ThemeProvider` BNA di root layout diberi skema `"dark"` tetap — **tidak** membaca `useColorScheme()`. Bila berkas
  `hooks/useColorScheme.ts` hasil salinan BNA dibaca komponen lain, ia diubah agar selalu mengembalikan `"dark"`.
- Tema navigasi (header, latar Stack, tab bar) memakai token yang sama: `headerStyle.backgroundColor = background`,
  `headerTintColor = text`, garis bawah header = `border`, `contentStyle.backgroundColor = background`.
- `expo-status-bar` dengan `style="light"`.
- `src/warna.ts` (`WARNA`) **dihapus** — alasannya (latar terang + mode gelap sistem) hilang bersama tema terang.

### 3.3 Tipografi

- Paket: `@expo-google-fonts/inter` (400 Regular, 600 SemiBold, 700 Bold) dan
  `@expo-google-fonts/jetbrains-mono` (400 Regular saja), dimuat dengan `useFonts` di root layout. **Inter 500 tidak
  dimuat** (#16E: bobot hanya 400 dan 600, plus 700 untuk `heading`); JetBrains Mono 500 juga tidak — varian `mono`
  berbobot 400 dan tidak ada tempat yang butuh mono lebih tebal. Makin sedikit berkas font, makin pendek splash (§11
  batas #2).
- **React Native tidak memilih berkas font dari `fontWeight`** untuk font kustom. Komponen `Text` salinan BNA diubah
  agar varian/berat memetakan ke `fontFamily` (`Inter_700Bold`, …), dan `fontWeight` tidak diteruskan bersamaan
  (di Android keduanya bisa bertabrakan).
- Skala (dari mockup fondasi): 30 / 18 / 15 / 13, ditambah 11 untuk label kecil (label tab, lencana — 10.5 di mockup
  disatukan ke 11, #16E). Pemetaan ke varian BNA: `heading` 30/700, `title` 18/600, `body` 15/400, `caption` 13/400
  redup, `label` 11/600; varian tambahan `mono` (JetBrains Mono 13/400, redup) untuk alamat, kode, dan angka teknis.
  Penekanan di dalam `body` memakai 600 (lewat pemetaan berat → `Inter_600SemiBold` di `Text`), bukan 500. Nilai pasti per varian ditulis di
  `theme/globals.ts`. **Paling banyak 4 ukuran per layar** dan tidak ada `fontSize` di luar varian (§3.7).
- **JetBrains Mono hanya untuk:** alamat (utuh maupun singkat), hash transaksi, 12 kata pemulihan, kunci privat dev,
  dan angka teknis (hitung mundur QR). Nama, kalimat, dan angka biasa (jumlah hadir, jumlah koneksi) memakai Inter.
- `fontFamily: "Courier"` yang sekarang ada di `app/` diganti varian `mono`.

### 3.4 Bentuk, jarak, gerak

| Unsur | Nilai |
|---|---|
| Radius kartu, tombol, isian | 8 |
| Radius tombol Salaman di tab bar | 14, ukuran 52×52, naik 26 dari garis tab, cincin 5 px warna latar tab bar |
| Radius gelembung pesan | 12, sudut pengirim 4 |
| Kartu | latar `card`, garis 1 px `border`, **tanpa bayangan** |
| Tab bar | latar `#0b0f19`, garis atas `border`, label 11 (varian `label`), aktif `primary`, tak aktif `textMuted`; tinggi = tinggi isi + inset bawah (§3.7) |
| Jarak | skala 4 / 8 / 12 / 16 / 24 / 32 (token `jarak` di `theme/globals.ts`); tepi layar 16, isi kartu 16, antarbutir dalam grup 8–12, antarbagian 24–32 (§3.7) |
| Spanduk pengingat | latar `rgba(243,186,47,0.10)`, garis `rgba(243,186,47,0.40)`, teks `primary` |
| Tombol destruktif | latar `rgba(240,106,106,0.12)`, garis `rgba(240,106,106,0.35)`, teks `destructive` |
| Sheet salaman berhasil | selubung `rgba(7,9,15,0.70)` (dari `background`), panel `card`, radius atas 12, garis atas `border` (§6.2) |
| Isian | latar `#0b0f19`, garis `border`; fokus: garis `primary`; placeholder `#6b778e` |
| Batang trust | tinggi 6 (5 di kartu kecil), radius 3, 4 ruas bercelah 2, terisi `verified`, kosong `segmentEmpty` (`#56627d`, #16B) |
| Lencana ✓ | garis 1 px `verified`, teks `verified` 11, radius 5 |

`#0b0f19` (latar isian dan tab bar) dan `#6b778e` (placeholder) diambil dari mockup fondasi; keduanya ikut masuk
`theme/colors.ts` sebagai token `input` dan `placeholder`. `#56627d` (ruas kosong) datang dari review UI/UX (#16B)
sebagai token `segmentEmpty`.

- **Haptic** (`expo-haptics`): `notificationAsync(Success)` saat sheet salaman berhasil terbuka (§6.2) dan saat toast
  berhasil lainnya (§7.2); `impactAsync(Light)` untuk "Copy" alamat (#16C); getar ringan bawaan tombol BNA hanya untuk
  varian utama (`default`). Varian lain memakai `haptic={false}`.
- **Animasi:** hanya yang dibawa komponen BNA (skala tekan tombol, masuk/keluar toast, kilau skeleton) dan geser
  bawaan `Modal` untuk sheet salaman (R13). Tidak ada animasi buatan sendiri di fase ini. Saat Reduce Motion menyala,
  semuanya mengikuti §3.7.

### 3.5 Ikon dan splash

Path SVG "n" (viewBox `0 0 100 100`), dari mockup ikon I2:

```
M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z
```

| Berkas (`apps/mobile/assets/`) | Isi |
|---|---|
| `sumber/n.svg` | path di atas, isi `currentColor` — satu-satunya sumber |
| `icon.png` | 1024×1024, latar `#f3ba2f` penuh (tanpa sudut membulat — iOS memotong sendiri), "n" `#07090f` selebar ±57% kanvas (proporsi mockup 86/150) |
| `adaptive-icon.png` | 1024×1024, latar transparan, "n" `#07090f` di dalam zona aman tengah 66% |
| `splash-icon.png` | 1024×1024, latar transparan, "n" `#f3ba2f` |

`app.json`:

- `"icon": "./assets/icon.png"`;
- `android.adaptiveIcon = { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#f3ba2f" }`;
- plugin `expo-splash-screen` dengan `image: "./assets/splash-icon.png"`, `imageWidth: 120`,
  `backgroundColor: "#07090f"` (sama untuk `dark`).

PNG dibuat oleh `apps/mobile/scripts/buat-ikon.mjs` dari `sumber/n.svg` memakai devDependency `@resvg/resvg-js`
(versi dipatok persis), lalu hasilnya di-commit. Mesin pemilik tidak punya `rsvg-convert`/ImageMagick, jadi skrip Node
adalah jalur yang bisa diulang. Logo "n" besar di layar Mulai digambar dari path yang sama lewat `react-native-svg`
(`components/logo-n.tsx`), bukan dari PNG.

**Splash sampai siap.** `SplashScreen.preventAutoHideAsync()` di tingkat modul root layout; splash disembunyikan
setelah **font termuat (atau gagal dimuat) DAN** keadaan dompet bukan `memuat`. Spinner `memuat` di gerbang dompet
digantikan splash. Font yang gagal dimuat tidak memblokir aplikasi: teks jatuh ke font sistem.

### 3.6 BNA UI di repo ini

- Lokasi: `apps/mobile/components/ui/*` (salinan komponen), `apps/mobile/theme/{colors,globals,theme-provider}.ts(x)`,
  `apps/mobile/hooks/{useColor,useColorScheme}.ts`. **Tidak di `app/`** — setiap berkas di `app/` adalah rute
  expo-router.
- Alias: `apps/mobile/tsconfig.json` mendapat `"paths": { "@/*": ["./*"] }` dan `include` ditambah `components`,
  `theme`, `hooks`, `scripts`. `vitest.config.ts` mendapat `resolve.alias` `@` → akar `apps/mobile`, supaya tes yang
  mengimpor modul ber-alias tetap jalan. Metro/babel-preset-expo SDK 57 membaca `paths` tsconfig tanpa konfigurasi
  tambahan (diverifikasi di spike).
- Perintah: `pnpm dlx bna-ui add <komponen>` dari `apps/mobile`. Komponen yang dipakai: `button`, `text`, `input`,
  `card`, `badge`, `progress` (atau batang trust sendiri — §6), `skeleton`, `toast`, `avatar`, `separator`,
  `spinner`, `switch` (bila cocok untuk Terlihat/Tersembunyi), `alert-dialog` (bila menggantikan `Alert.alert`
  tanpa mengubah makna kalimat), `avoid-keyboard` (bila setara `src/hindari-keyboard.tsx`). BNA **tidak** punya komponen
  segmented control; pemilih mode Salaman dibuat sendiri di `components/segmen.tsx` dari `Pressable` + token. Sheet
  salaman berhasil **bukan** komponen BNA: daftar ini tidak memuat sheet, jadi ia `Modal` React Native di
  `components/salaman/sheet-bertemu.tsx` (R13, §6.2).
- Setelah disalin, komponen BNA adalah **kode kita**: boleh disunting (font, haptic default, warna), dan disunting
  hanya lewat token.
- Dependensi dipasang dengan `npx expo install` (versi cocok SDK 57, dan cocok dengan modul native di dalam Expo Go):
  `react-native-reanimated`, `react-native-worklets`, `expo-haptics`, `lucide-react-native`, `expo-splash-screen`,
  `expo-system-ui`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`. Pohon pnpm saat ini sudah
  memuat `react-native-reanimated@4.6.0` dan `react-native-worklets@0.12.1` secara tidak langsung; keduanya dijadikan
  dependensi langsung `@nearly/mobile`. Ditambah **`expo-clipboard`** (#16C, ada di Expo Go) — dipasang dengan
  `npx expo install expo-clipboard` di langkah 5(b) (Beranda), tugas pertama yang memakainya, bukan di spike.
- `ThemeProvider` BNA dibungkus di luar `DompetProvider` di `app/_layout.tsx`, bersama penyedia toast BNA. *(Hasil spike: BNA tidak punya `ThemeProvider` — yang dibungkus hanya `ToastProvider`; butir 1 di bawah.)*

**Hasil spike repo (2026-09-18)** — dijalankan di worktree sementara dari `desain-ui` 3c5450d, lalu dibuang; uji tampil
di Expo Go (iPhone) tetap langkah 1 pemilik (§9). Menggantikan daftar "hal yang belum pasti" versi awal bagian ini:

1. **Tidak ada `ThemeProvider` BNA** dan tidak ada impor `@react-navigation`. `useColor(nama)` membaca `Colors[skema]`
   dari `theme/colors.ts`; skema = `ModeProvider` (bila dipasang) atau skema OS. Nearly mengisi palet B2 di kunci
   `light` DAN `dark`, membuat `hooks/useColorScheme.ts` selalu `"dark"`, dan tidak memakai `ModeProvider`. Yang
   dibungkus di root layout di luar `DompetProvider` adalah `ToastProvider` (yang membawa `GestureHandlerRootView`);
   toast dipanggil lewat `useToast().toast({ title, description, variant })`.
2. (Pertanyaan pembungkus tema `@react-navigation` gugur bersama butir 1.)
3. `Input` BNA: `InputProps extends Omit<TextInputProps, 'style'>` — semua prop `TextInput` diteruskan.
4. CLI `pnpm dlx bna-ui@latest add <komponen…> --pnpm -y` (versi 3.0.0) berjalan di `apps/mobile` tanpa `init`,
   asalkan `tsconfig.json` punya `"baseUrl": "."` + `"paths": { "@/*": ["./*"] }` dan `include` memuat folder
   salinannya. CLI memasang lewat `expo install` versi yang cocok SDK 57: `react-native-reanimated` **4.5.1**,
   `react-native-worklets` **0.10.1**, `react-native-gesture-handler` ~2.32.0 (dependensi toast, tidak ada di daftar
   awal), `expo-haptics` ~57.0.3, `lucide-react-native` ^1.47.0 — bukan 4.6.0/0.12.1 yang ada secara tidak langsung.
   CLI menambah plugin `"expo-image"` ke `app.json` hanya bila komponen `avatar`/`image` disalin.
5. Tidak ada plugin babel tambahan: `npx expo export --platform ios` membundel reanimated 4.5.1 + worklets 0.10.1
   (tanpa `babel.config.js`).

Temuan lain: salinan `text` memakai `fontWeight` tanpa `fontFamily` (disunting sesuai §3.3); `theme/globals.ts` bawaan
berradius pil (`CORNERS` 999, `BORDER_RADIUS` 26) dan disetel ke §3.4; `toast` memuat warna iOS literal (diganti
token); BNA **punya** `bottom-sheet`, tetapi salinannya gagal `tsc` repo ini (`noUncheckedIndexedAccess`) — R13 tetap:
sheet salaman memakai `Modal` React Native. Rincian pemakaian: rencana implementasi A
(`docs/superpowers/plans/2026-09-18-nearly-desain-ui-a-fondasi.md`, Ruling A1).

### 3.7 Aksesibilitas & ergonomi (keputusan #16E)

Aturan dasar untuk setiap layar dan komponen di fase ini. §7 (pola layar) dan §10 (tes, uji iPhone) merujuk ke sini.

**Target sentuh.** Setiap yang bisa diketuk berukuran sentuh ≥ **44×44 pt** (iOS) / **48×48 dp** (Android); karena
satu kode melayani keduanya, ukuran sasaran 48. Tautan teks kecil — "See all ›", "Open Wallet ›", "Open radar ›",
"Open event ›", "Handshake ›" di kartu radar, "Report", "Block", "Copy" — mendapat `hitSlop` atau `minHeight` + padding
sampai mencapainya, tanpa membesarkan tampilannya. Tombol kirim di Percakapan (tampil 40×40, §6.5) mendapat `hitSlop`
4 di tiap sisi. Tombol Salaman di tab bar (52×52) sudah cukup.

**Jarak.** Skala **4 / 8 / 12 / 16 / 24 / 32**, sebagai token `jarak` di `theme/globals.ts` (`jarak.xs` 4 … `jarak.xxl`
32). Tepi kiri-kanan layar 16, isi kartu 16, antarbutir di dalam satu grup 8–12, antarbagian 24–32. Tidak ada nilai
`margin*`/`padding*`/`gap` di luar skala. Ukuran komponen (avatar 42/64, tinggi batang trust 6/5 dan celah ruasnya 2,
tombol Salaman 52 dan naiknya 26, radius) bukan jarak dan tidak terikat skala ini.

**Tipografi.** Paling banyak **4 ukuran per layar** dari skala §3.3 (30 / 18 / 15 / 13 / 11). Bobot **400** dan
**600**; **700** hanya untuk varian `heading` (30). Inter 500 dan JetBrains Mono 500 tidak dimuat. Label tab (10.5 di
mockup) dan label kecil lain memakai **11**.

**Ukuran huruf sistem.** Teks ikut pengaturan ukuran huruf OS: `allowFontScaling` tidak pernah dimatikan. Label tab
bar dan lencana (`Lencana`, lencana tab) dibatasi `maxFontSizeMultiplier={1.3}` — `Text` salinan BNA meneruskan prop
itu; bila opsi `Tabs` bawaan tidak meneruskannya, label dirender lewat `tabBarLabel` berbentuk fungsi yang
mengembalikan `Text` kita. Pada 1,3× tata letak **membungkus**, bukan memotong, teks penting: nama, kalimat galat,
kalimat peringatan 12 kata, tombol. `numberOfLines` hanya untuk teks yang memang ringkasan (cuplikan feed 2 baris,
pratinjau pesan); alamat singkat tidak pernah terpotong karena sudah pendek.

**Reduce Motion.** Hook `hooks/useGerakDikurangi.ts` membaca `AccessibilityInfo.isReduceMotionEnabled()` dan mendengar
`reduceMotionChanged` (bekerja di jalur BNA maupun jalur cadangan tanpa reanimated; di jalur BNA boleh diganti
`useReducedMotion()` reanimated). Saat menyala: kilau skeleton menjadi blok diam; toast muncul tanpa geser (pudar atau
langsung); sheet salaman memakai `animationType="fade"` alih-alih `"slide"`. Komponen `skeleton` dan `toast` salinan
BNA disunting sedikit untuk membaca hook ini — tetap "kode kita" (§3.6).

**Safe area.** Tinggi tab bar = tinggi isi + inset bawah (`useSafeAreaInsets().bottom` — home indicator iOS, bilah
gestur Android); tombol Salaman yang naik tetap di atas area itu. Isi tidak pernah berada di bawah notch/Dynamic
Island: header native Stack, atau `SafeAreaView` (`react-native-safe-area-context`, sudah dependensi) untuk layar
tanpa header (Beranda, Mulai, galat gerbang). Android memakai tombol/gestur kembali sistem dan header native; tidak
ada tautan teks "‹ Back" buatan sendiri — tautan kembali di mockup adalah ilustrasi.

**Label aksesibilitas.** Tombol yang hanya berikon punya `accessibilityLabel` dan `accessibilityRole="button"`:
"Copy address" (tombol "Copy" Beranda — ikon + teks, labelnya menyebut apa yang disalin), tombol kirim Percakapan
(terjemahan `labelKirimPesan(sibuk)` yang ada: "Send" / "Sending…"), "More options" (menu ⋯ Percakapan), dan tombol
Salaman tab bar ("Handshake"). Ikon tab berlabel teks sudah terbaca dari labelnya. `BatangTrust` adalah satu elemen aksesibel
berlabel **"Trust: ‹tier›"** (mis. "Trust: Trusted") dari fungsi murni `labelAksesTrust(tier)` (§6). Avatar huruf
awal dekoratif (`accessible={false}`), karena nama tampil di sebelahnya.

**Penjaga murah** (§10.1 `aksesibilitas.test.ts`): tidak ada `allowFontScaling={false}`/`allowFontScaling: false` di
`app/**`, `components/**`; nilai numerik literal `margin*`/`padding*`/`gap` di `app/**` dan `components/**` di luar
`components/ui/**` hanya dari skala; tidak ada `fontSize` literal di luar `theme/` dan `components/ui/**`; tidak ada
`Inter_500Medium`/`JetBrainsMono_500Medium`. Sisanya (target sentuh, bungkus teks, Reduce Motion, safe area) diuji di
iPhone (§10.3).

## 4. Navigasi dan Struktur Rute

### 4.1 Pohon berkas

```
app/
├── _layout.tsx                         Stack akar: fonts + splash, ThemeProvider, toast, DompetProvider, gerbang
├── mulai.tsx                           tanpa dompet saja; tanpa tab bar
├── profile/[address].tsx               dengan dompet; di atas tab (R1)
└── (tabs)/
    ├── _layout.tsx                     Tabs: 5 tab (§4.3), lencana Pesan
    ├── (beranda)/_layout.tsx           Stack, initialRouteName "index"
    ├── (beranda)/index.tsx             Beranda                                  (dulu app/index.tsx)
    ├── (beranda)/feed/index.tsx        Feed
    ├── (beranda)/feed/new.tsx          Unggahan baru
    ├── (acara)/_layout.tsx             Stack, initialRouteName "events/index"
    ├── (acara)/events/index.tsx        Acara
    ├── (acara)/events/new.tsx          Buat acara
    ├── (acara)/events/[id].tsx         Detail acara
    ├── (acara)/events/[id]/host-qr.tsx QR check-in
    ├── (acara)/radar/[eventId].tsx     Radar
    ├── (salaman)/_layout.tsx           Stack, initialRouteName "salaman"
    ├── (salaman)/salaman.tsx           Salaman — menggantikan app/qr.tsx + app/scan.tsx
    ├── (pesan)/_layout.tsx             Stack, initialRouteName "pesan/index"
    ├── (pesan)/pesan/index.tsx         Pesan
    ├── (pesan)/pesan/[address].tsx     Percakapan
    ├── (pesan)/pesan/lapor/[address].tsx Lapor
    ├── (profil)/_layout.tsx            Stack, initialRouteName "profil-saya"
    ├── (profil)/profil-saya.tsx        Profil
    ├── (profil)/connections.tsx        Koneksi
    ├── (profil)/kecocokan.tsx          Kecocokan
    ├── (profil)/dompet.tsx             Dompet
    └── (profil)/blokir.tsx             Diblokir
```

Setiap tab Stack menetapkan `initialRouteName` lewat `export const unstable_settings`, supaya tautan dalam ke layar
anak (notifikasi, `router.push` lintas tab) tetap punya layar akar tab di bawahnya dan tombol kembali pulang ke sana.
Perilaku `unstable_settings` di grup bersarang expo-router 57 **diverifikasi di langkah 3** (§9); bila tidak berlaku,
layar akar tab didorong lebih dulu secara eksplisit sebelum layar tujuan.

URL tidak berubah karena nama grup tidak masuk URL (R2). Satu-satunya URL baru: `/salaman` (dengan parameter opsional
`?mode=pindai`); `/qr` dan `/scan` hilang. Pemakai lama: tautan Beranda (ditulis ulang) dan tombol `app/events/[id].tsx`
"Pindai QR host untuk check-in" (kini "Scan the host's QR to check in") → `/salaman?mode=pindai`. Nama rute dan
parameter tetap bahasa Indonesia (§7.4).

### 4.2 Gerbang dompet

Pola `Stack.Protected` dua sisi dari spec dompet §5.1 **tetap**, hanya daftar layarnya yang berubah:

| Keadaan | Tampilan |
|---|---|
| `memuat` | splash tetap tampil (§3.5) |
| `galat` | terjemahan kalimat galat yang ada + **Try again**, tanpa navigator, dengan komponen BNA |
| `belum-ada` | Stack akar — hanya `mulai` |
| `siap` | Stack akar — `(tabs)` dan `profile/[address]`; `mulai` tidak |

- `RUTE_TANPA_DOMPET = ["mulai"]` tetap. `layarMenurutDompet(punyaDompet)` sekarang bekerja atas **layar Stack akar
  saja**, dari konstanta `LAYAR_AKAR = ["(tabs)", "mulai", "profile/[address]"]` (urutan ini), dan mengembalikan
  `[nama, opsi]`: judul dari `JUDUL_LAYAR` untuk `mulai` dan `profile/[address]`, `{ headerShown: false }` untuk
  `(tabs)` (grup, bukan berkas, jadi tidak punya kunci judul). `(tabs)` harus layar pertama sisi dompet — pengganti
  `index` sebagai tujuan saat penjaga berubah.
- Header setiap layar di dalam tab datang dari Stack tabnya.
- Pendengar ketukan notifikasi tetap hanya dipasang saat `siap`.
- Pola pembungkus signer (spec dompet R7) tetap berlaku untuk setiap layar di `(tabs)`. Tab tetap terpasang saat
  **Ganti dompet** sampai penjaga melepas `(tabs)`; pembungkus mencegah hook berjalan tanpa signer seperti sebelumnya.

### 4.3 Tab bar

`TAB_BAWAH` di `src/judul-layar.ts` — satu sumber untuk urutan, label (bahasa Inggris, #15), dan grup:

| Urutan | Grup | Label | Ikon (lucide) | Catatan |
|---|---|---|---|---|
| 1 | `(beranda)` | Home | `House` | |
| 2 | `(acara)` | Events | `CalendarDays` | |
| 3 | `(salaman)` | Handshake | `ArrowLeftRight` | `tabBarButton` kustom: kotak `primary` 52×52 radius 14, ikon `primaryForeground`, `accessibilityLabel` "Handshake", tetap di atas inset bawah (§3.7) |
| 4 | `(pesan)` | Messages | `MessageCircle` | `tabBarBadge` = jumlah belum dibaca, disembunyikan bila 0 |
| 5 | `(profil)` | Profile | `CircleUser` | titik lencana bila ada kecocokan baru (§4.4) |

Nama ikon lucide diperiksa saat implementasi; yang mengikat adalah maknanya (⌂ ◷ ⇄ ✉ ◉ di mockup). Label tab 11
(varian `label`) dengan `maxFontSizeMultiplier` 1,3, lencana Pesan dan titik Profil juga; tinggi tab bar menyertakan
inset bawah (§3.7).

### 4.4 Lencana tab (pengganti lencana di daftar tautan beranda)

Beranda sekarang menandatangani dua bukti setiap kali dipasang: `kueriBuktiKecocokan` untuk angka kecocokan ("You
both want to meet") dan sesi pesan untuk `getBelumDibaca`. Keduanya pindah ke hook `useLencanaTab(signer)` di
`(tabs)/_layout.tsx` (dengan pola pembungkus):

- dimuat saat `(tabs)` terpasang, saat tab aktif berganti, dan saat aplikasi kembali ke depan (`AppState` `active`);
  paling sering **sekali per 30 detik**;
- kegagalan masing-masing menghasilkan 0 tanpa galat — perilaku yang sama dengan beranda sekarang (komentar kode
  "Beranda tidak boleh gagal hanya karena lencana");
- angka Pesan → `tabBarBadge` Pesan; angka kecocokan baru → titik lencana tab Profil **dan** lencana di baris
  "You both want to meet" di layar Profil (terjemahan kalimat `teksLencana` yang ada).
- Layar Pesan dan Kecocokan meminta hook memuat ulang setelah menandai dibaca/dilihat, supaya lencana tidak basi.

### 4.5 Notifikasi

`src/pesan/rute-push.ts` **tidak berubah**: `{ jenis: "pesan" }` → `"/pesan"`; `{ jenis: "radar", eventId }` →
`/radar/<eventId huruf kecil>`. Dengan grup:

- `/pesan` membuka tab **Pesan** di daftar percakapan. Isi push sengaja tidak memuat alamat (spec 4c §7.2; tes
  `rute-push.test.ts` "rute tidak pernah membuka percakapan tertentu langsung"), jadi "Pesan › Percakapan" di
  keputusan #8 berarti: tab Pesan terbuka, dan pengguna mengetuk percakapan dari sana. Tidak berubah.
- `/radar/<id>` membuka tab **Acara** dengan Radar di atas `events/index` (§4.1 `initialRouteName`). Tombol kembali
  pulang ke daftar Acara, bukan ke Detail acara (tidak ada `eventId` untuk membangun tumpukan itu tanpa mengubah
  rute).
- Uji tambahan (§10.1): kedua rute keluaran `ruteDariNotifikasi` harus cocok dengan berkas yang ada di pohon §4.1
  setelah nama grup dibuang.

### 4.6 Siklus hidup layar di tab

Layar tab **tidak dilepas** saat berpindah tab (berbeda dengan Stack lama, yang melepas layar saat kembali). Aturan:

| Layar | Aturan |
|---|---|
| Salaman | isi mode (QR berputar / kamera) dipasang **hanya saat tab fokus** (`useIsFocused` di komponen isi, bukan di pembungkus). Pindah tab = seperti keluar dari layar QR/Pindai hari ini: `useRotatingQr` berhenti, kamera dilepas. Sheet salaman berhasil (§6.2) hidup di dalam isi mode Pindai, jadi pindah tab saat sheet terbuka ikut menutupnya; koneksinya sudah tercatat dan tetap terlihat di Beranda/Koneksi. |
| Radar | sudah memakai `useFocusEffect` (detak & radar berhenti saat tidak fokus) — tetap. |
| QR check-in host (`events/[id]/host-qr`) | *Ditambahkan 2026-09-18 (review Rencana A #2):* QR check-in dipasang **hanya saat layar fokus** (`useIsFocused` di komponen isi, pola sama dengan Salaman). Tanpa ini `useCheckInQr` terus membaca GPS, menandatangani, dan mengirim tawaran check-in tiap 30 detik selagi host di tab lain. |
| Beranda | data dimuat saat fokus (`useFocusEffect`), paling sering sekali per 30 detik; setara "satu tanda tangan per pembukaan beranda" hari ini. |
| Pesan, Acara, Profil | memuat saat fokus dengan batas yang sama; layar yang sudah memuat saat dipasang tetap melakukannya. |

### 4.7 Judul layar

*Diamandemen 2026-09-22 (uji iPhone Rencana B2, keputusan pemilik):* **judul besar iOS tidak dipakai lagi.** Di iOS 26
`headerLargeTitle` tidak tergambar untuk ScrollView di dalam tab — header kosong sampai layar digulir
(react-native-screens #3100, expo #40717). Layar akar tab Events, Handshake, Messages, dan Profile memakai header biasa
(judul kecil); isinya tetap ScrollView/FlatList dengan `contentInsetAdjustmentBehavior="automatic"`. Warna judul header
ditulis eksplisit (`text`) supaya tidak mengikuti label sistem iOS. Paragraf di bawah dipertahankan sebagai riwayat.

*Ditambahkan 2026-09-19 (uji iPhone Rencana A):* judul besar iOS (`headerLargeTitle`) di layar akar tab dan Beranda
tanpa header hanya berlaku untuk layar di `LAYAR_TERMIGRASI`. Judul besar hanya memberi ruang yang benar bila isi
layar berupa `ScrollView` dengan `contentInsetAdjustmentBehavior="automatic"` — layar lama bukan ScrollView dan
bagian atasnya tertutup (segmen Show QR/Scan hilang). **Rencana B wajib membangun setiap layar akar tab yang
dimigrasi (termasuk Salaman) di dalam ScrollView tersebut** sebelum kuncinya masuk `LAYAR_TERMIGRASI`.

`JUDUL_LAYAR` sekarang berkunci **jalur berkas relatif `app/` tanpa `.tsx`, termasuk nama grup**; nilainya bahasa
Inggris (#15):

```ts
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
```

- Judul lama diterjemahkan 1:1 ("Detail acara" → "Event details", "Kecocokan" → "Matches", "Diblokir" → "Blocked",
  …), kecuali tiga yang juga berubah makna: `index` "Nearly" → "Home", `profil-saya` "Profil saya" → "Profile" (sama
  dengan label tab), dan `qr` "QR salaman" + `scan` "Pindai" → satu `salaman` "Handshake". `mulai` "Mulai" →
  "Get started".
- `layarDalam(grup)` mengembalikan pasangan `[nama relatif terhadap layout, judul]` untuk satu `_layout.tsx` —
  layout pemilik sebuah kunci adalah folder `_layout.tsx` terdalam yang menjadi awalan kuncinya. Setiap
  `_layout.tsx` Stack tab mendaftarkan judul dari `layarDalam("(tabs)/(acara)")` dst.; root layout tetap memakai
  `layarMenurutDompet`. Alasannya sama dengan komentar di `src/judul-layar.ts`: judul yang dipasang dari dalam layar
  baru berlaku setelah layar selesai memuat.
- Header layar akar tab: Beranda **tanpa header** (sapaan besar menggantikannya — mockup layar kunci 1); Acara,
  Salaman, Pesan, Profil memakai header besar dengan judul di atas. Judul tetap didaftarkan untuk label tombol
  kembali.

## 5. Peta Layar

Setiap layar yang ada punya tempat; tidak ada yang dihapus kecuali `qr` + `scan` yang digabung.

| Berkas lama | Berkas baru | Tab | Dibuka dari |
|---|---|---|---|
| `app/index.tsx` | `(tabs)/(beranda)/index.tsx` | Beranda | tab |
| `app/feed/index.tsx` | `(tabs)/(beranda)/feed/index.tsx` | Beranda | "See all ›" cuplikan feed |
| `app/feed/new.tsx` | `(tabs)/(beranda)/feed/new.tsx` | Beranda | Feed "Write something" |
| `app/events/index.tsx` | `(tabs)/(acara)/events/index.tsx` | Acara | tab |
| `app/events/[id].tsx` | `(tabs)/(acara)/events/[id].tsx` | Acara | daftar acara, kartu LIVE Beranda |
| `app/radar/[eventId].tsx` | `(tabs)/(acara)/radar/[eventId].tsx` | Acara | Detail acara, kartu LIVE Beranda, notifikasi radar |
| `app/events/new.tsx` | `(tabs)/(acara)/events/new.tsx` | Acara | tombol "+ Create event" |
| `app/events/[id]/host-qr.tsx` | `(tabs)/(acara)/events/[id]/host-qr.tsx` | Acara | Detail acara (host) |
| `app/qr.tsx` + `app/scan.tsx` | `(tabs)/(salaman)/salaman.tsx` | Salaman | tab tengah, Detail acara (`?mode=pindai`), kartu radar "Handshake ›", keadaan kosong Beranda/Koneksi |
| `app/pesan/index.tsx` | `(tabs)/(pesan)/pesan/index.tsx` | Pesan | tab, notifikasi pesan |
| `app/pesan/[address].tsx` | `(tabs)/(pesan)/pesan/[address].tsx` | Pesan | daftar Pesan, Profil orang "Send message" |
| `app/pesan/lapor/[address].tsx` | `(tabs)/(pesan)/pesan/lapor/[address].tsx` | Pesan | Percakapan "Report" |
| `app/profil-saya.tsx` | `(tabs)/(profil)/profil-saya.tsx` | Profil | tab, Radar "Open your profile" (dulu "Buka Profil saya") |
| `app/connections.tsx` | `(tabs)/(profil)/connections.tsx` | Profil | Profil, Beranda "Recently met · See all ›" |
| `app/kecocokan.tsx` | `(tabs)/(profil)/kecocokan.tsx` | Profil | Profil |
| `app/dompet.tsx` | `(tabs)/(profil)/dompet.tsx` | Profil | Profil, spanduk cadangan Beranda |
| `app/blokir.tsx` | `(tabs)/(profil)/blokir.tsx` | Profil | Profil |
| `app/mulai.tsx` | `app/mulai.tsx` | — | gerbang, tanpa dompet |
| `app/profile/[address].tsx` | `app/profile/[address].tsx` | — (Stack akar) | Beranda, Radar, Koneksi, Kecocokan, Pesan, Feed, sheet Salaman berhasil ("View profile") |

`router.push` ke rute tab lain berpindah ke tab itu (perilaku bawaan Tabs expo-router). Semua `href` di kode diperiksa
ulang terhadap tabel ini oleh tes §10.1 (href statis harus cocok dengan rute yang ada).

## 6. Layar Kunci

Kelima layar dari mockup layar kunci. Semua kartu mengikuti §3.4; semua nama orang mengikuti R4.

**Komponen bersama** (di `components/`, bukan `app/`):

- `Avatar` — lingkaran huruf awal (42 di kartu, 64 di kepala Profil orang, 56 di sheet salaman), gradasi
  `#2a3550`→`border`, cincin 2 px dengan warna yang diberikan pemanggil; huruf dari fungsi murni
  `hurufAvatar(nama, alamat)`: huruf pertama nama yang sudah di-`trim` (huruf besar), atau tanpa nama karakter pertama
  setelah `0x` (huruf besar). Dekoratif untuk pembaca layar (§3.7).
- `KartuOrang` — `Avatar` 42 (cincin `verified` bila terverifikasi, `#2a3550` bila belum), nama (`namaKartuRadar` —
  "Unnamed" untuk nama kosong, dulu "Tanpa nama"), alamat singkat mono (`alamatSingkat`), lencana, baris keterangan
  redup, dan `BatangTrust` opsional.
- `BatangTrust({ tier })` — 4 ruas; ruas terisi = `tier + 1` (New = 1, Known = 2, Trusted = 3, Core = 4), terisi
  `verified`, kosong `segmentEmpty` (#16B). Batang **selalu** satu elemen aksesibel berlabel `labelAksesTrust(tier)`
  = "Trust: ‹tier›" (mis. "Trust: Trusted"), dari label Inggris `labelTier(tier)` (`LABEL_TIER_EN`, §7.4). Bila label
  tier juga tampil sebagai teks di sebelahnya, batang dan teks itu dikelompokkan menjadi satu elemen dengan label yang
  sama, supaya pembaca layar tidak membacanya dua kali (§3.7).
  Tier tidak pernah tampil sebagai persentase atau angka skor.
- `tierDariLabel(label)` di `src/tier.ts` — `TIER_LABELS.indexOf(label)` atas label **kawat** bahasa Indonesia, label
  tak dikenal → 0. Radar dan Pesan hanya mengirim label/tier, bukan skor (keputusan #10f), jadi batang dibangun dari
  itu; label kawat tidak pernah ditampilkan langsung (§7.4).
- `Lencana` — varian `terverifikasi` ("✓ met in person"), `ringkas` ("✓" saja, di radar), dan teks bebas (mis.
  "You both want to meet", terjemahan kalimat `lencanaKartuRadar` yang ada). Teks 11 dengan `maxFontSizeMultiplier`
  1,3 (§3.7).

### 6.1 Beranda — `(tabs)/(beranda)/index.tsx`

Urutan dari atas; setiap bagian memuat sendiri dan gagal sendiri (satu bagian gagal tidak menutup yang lain):

| Bagian | Isi | Sumber data (semua sudah ada) |
|---|---|---|
| Sapaan | "Good morning/afternoon/evening" (jam lokal: 04:00–11:59 morning, 12:00–17:59 afternoon, selainnya evening), nama tampilan (varian `heading`), alamat sendiri **singkat** mono (`alamatSingkat`, mis. `0x9bE5…6ffA`) + tombol kecil **"Copy"** di sebelahnya (#16C) | nama: `GET /profile/:alamat-sendiri` `displayName`; kosong → baris nama tidak tampil, alamat tetap. Alamat: `signer.address` |
| Spanduk cadangan | terjemahan `TEKS_PENGINGAT_CADANGAN` + " Open Wallet ›", ke `/dompet` (target sentuh §3.7) | `perluPengingatCadangan` (tidak berubah) |
| Acara LIVE | maks. 2 kartu acara yang sedang berlangsung: "● LIVE", `{checkins} checked in`, judul, lalu "You're checked in · Open radar ›" (ke `/radar/<id>`) bila `sudahCheckIn`, selainnya "Open event ›" (ke `/events/<id>`). Tidak ada acara live → bagian tidak tampil | `getDiscovery()` disaring `isEventLive`, lalu `getEvent(id, who, bukti)` dengan bukti yang sama seperti `events/[id]` |
| Baru kamu temui | judul bagian "Recently met" + "See all ›" (ke `/connections`); maks. 3 `KartuOrang` terbaru: nama + alamat singkat, "✓ met in person", waktu relatif ("yesterday", "2 days ago", "Aug 12"), `BatangTrust` | `GET /connections/:alamat` (urut terbaru, sudah ada); per orang `GET /profile/:alamat` (nama) + `fetchTrust` (tier) — 3 × 2 permintaan publik |
| Feed | judul bagian "Feed" + "See all ›" (ke `/feed`); maks. 2 unggahan: nama penulis · waktu, teks terpotong 2 baris | `getFeed(kueriBuktiFeed(signer))` — bukti yang sama dengan layar Feed |

- **Tombol "Copy"** (#16C): ikon lucide `Copy` + teks "Copy" (varian `label`), `accessibilityLabel` "Copy address",
  target sentuh ≥ 48 lewat `hitSlop` (§3.7). Ketuk → `Clipboard.setStringAsync(signer.address)` (`expo-clipboard`) —
  **alamat utuh**, bukan yang disingkat — lalu toast "Address copied" dan `Haptics.impactAsync(Light)`. Gagal menyalin
  → tidak ada toast (tidak ada kalimat galat baru). Alamat utuh sendiri tetap di Dompet dan kepala Profil (tab) (R4).
- Keadaan kosong "Recently met": terjemahan kalimat yang ada — "No connections yet. Connections can only be made by
  meeting in person." — + aksi **Handshake** (ke tab Salaman).
- Daftar sepuluh tautan lama hilang; setiap tujuannya pindah ke tab (§5). Lencana Pesan dan kecocokan pindah ke tab
  (§4.4).
- Nama acara pada kartu "Recently met" (mockup "BNB Hack · kemarin") **tidak** ditampilkan di Beranda: ia hanya
  ada di riwayat pertemuan yang butuh bukti per orang (§8.1). Kartu cukup menampilkan waktu.

### 6.2 Salaman — `(tabs)/(salaman)/salaman.tsx`

**Perilaku sekarang** (dibaca dari kode, wajib dipertahankan; kalimat dikutip sebagaimana adanya hari ini dan
diterjemahkan saat dipindah — §7.4):

- `app/qr.tsx`: pembungkus `useNearlySigner(CONFIG.verifyingContract)` → `QrScreenIsi` dengan
  `useRotatingQr(signer)`. Setiap siklus `QR_TTL_MS` (30 detik): ambil sel lokasi sendiri → `signOffer` →
  `postOffer` (lokasi A tidak pernah dititipkan lewat B) → tampilkan QR; hitung mundur per detik dari `secondsLeft`;
  galat → teks galat; belum ada nilai → spinner. Alamat sendiri tampil di bawah QR.
- `app/scan.tsx`: pembungkus mengambil **dua** signer di tingkat komponen — `signerHadir`
  (`CONFIG.attendanceRegistry`, domain check-in) dan `signerSalaman` (`CONFIG.verifyingContract`, domain salaman) —
  karena hook tidak boleh dipanggil di dalam callback pemindai; `key={signerSalaman.address}`. Isi: izin kamera →
  `CameraView` QR → `onScan` dengan penjaga `busy`: **QR check-in dicoba lebih dulu** (`decodeCheckInQr`, penanda
  `k:"checkin"`), kedaluwarsa → `eventErrorMessage("expired")`, sah → sel lokasi → tanda tangan
  `checkInAcceptTypedData` → `postCheckIn` → "Check-in berhasil. 0x1234…"; bukan check-in → `decodeQr` → "QR ini
  bukan QR Nearly." / kedaluwarsa / "Itu QR-mu sendiri." → sel lokasi → `signAccept` → `postAccept` → "Terkoneksi.
  0x1234…"; galat → `handshakeErrorMessage` / `eventErrorMessage`; "Pindai lagi" mengosongkan hasil.

**Satu layar dua mode:**

```
export default function SalamanScreen() {                    // pembungkus: HANYA hook dompet
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const signerSalaman = useNearlySigner(CONFIG.verifyingContract);
  if (!signerHadir || !signerSalaman) return null;
  return <SalamanIsi key={signerSalaman.address} signerHadir={signerHadir} signerSalaman={signerSalaman} />;
}
```

- `SalamanIsi`: `Segmen` "Show QR" | "Scan" (mode awal "Show QR"; `?mode=pindai` membuka Scan), dan
  `useIsFocused()`; isi mode dirender **hanya saat fokus**.
- Mode **Show QR** (Tampilkan QR) = `QrScreenIsi` lama dipindah apa adanya ke `components/salaman/mode-qr.tsx` (menerima
  `signerSalaman`). Berganti mode atau tab melepasnya — interval berhenti; kembali ke mode ini memanggil `refresh`
  segera (efek pasang ulang), sama dengan membuka layar QR lagi hari ini. QR tampil di atas pelat `text` (`#e6edf7`)
  radius 12 supaya kontras pemindai terjaga di tema gelap; ukuran 260 tetap.
- Mode **Scan** (Pindai) = `ScanIsi` lama dipindah apa adanya ke `components/salaman/mode-pindai.tsx` dengan kedua signer.
  Urutan check-in-lebih-dulu dan penjaga `busy` tidak berubah; kalimatnya diterjemahkan 1:1 ("Checked in. 0x1234…",
  "This isn't a Nearly QR code.", "That's your own QR code.", "Connected. 0x1234…", "Scan again"). Kalimat mode QR
  "Minta dia memindai ini. Berganti dalam N detik." menjadi "Ask them to scan this. Changes in N seconds." (R5).
- **Perubahan perilaku yang diputuskan (keputusan #8, diubah #16D): sheet "You met …".** Saat `postAccept` berhasil,
  mode Pindai **tidak** menampilkan teks hasil dan **tidak** berpindah layar; ia membuka sheet
  `components/salaman/sheet-bertemu.tsx` di atas tab Salaman:
  1. **Komponen:** `Modal` React Native (R13) — `transparent`, `animationType="slide"` (`"fade"` bila Reduce Motion,
     §3.7), `onRequestClose` = "Scan someone else" (tombol/gestur kembali Android). Isi: panel `card` di bawah layar,
     radius atas 12, garis atas `border`, padding 16 + inset bawah (§3.7), di atas selubung `background` 70%
     (`rgba(7,9,15,0.70)`, token di `theme/colors.ts`, §3.4).
  2. **Dua avatar bertumpuk** (`Avatar` 56, tumpang tindih 16): milikmu bercincin `primary` (`hurufAvatar(null,
     signerSalaman.address)` — layar Salaman tidak memuat namamu), miliknya bercincin `verified`
     (`hurufAvatar(null, payload.initiator)`).
  3. **Judul** varian `title`: `judulSheetBertemu(nama, alamat)` di `src/messages.ts` — nama yang sudah di-`trim`
     tidak kosong → "You met ‹nama›"; selainnya "You met ‹alamatSingkat(alamat)›" (alamat dalam `mono`). Sheet dibuka
     dengan `nama = null`, lalu `nama` diisi dari satu `GET /profile/:initiator` publik (R14); jawaban basi (sheet
     sudah ditutup atau alamat berbeda) dibuang.
  4. **Lencana** `terverifikasi` "✓ met in person".
  5. **Baris redup** (`caption`): terjemahan kalimat yang ada "Connected. 0x1234…" (`txHash` 10 karakter + "…", mono)
     — informasi yang hari ini tampil sebagai teks hasil. Nama acara **tidak** ditampilkan: alur salaman tidak
     membawa acara, dan satu-satunya sumbernya (riwayat pertemuan, §8.1) butuh panggilan baru.
  6. **Tombol:** utama **"View profile"** → tutup sheet, lalu `router.push(\`/profile/${payload.initiator}\`)` (di
     atas tab, R1); sekunder **"Scan someone else"** → tutup sheet dan kosongkan hasil, sehingga pemindai siap lagi.
     Keduanya lebar penuh, bertumpuk, jarak 8.
  7. **Haptic:** `Haptics.notificationAsync(Success)` tepat saat sheet dibuka (bukan saat ditutup).
  8. **Penjaga:** selama sheet terbuka, `onScan` diabaikan (sama dengan penjaga `busy`), supaya kamera yang masih
     menangkap QR yang sama tidak memicu `already_connected`.
- Check-in lewat QR host berhasil **tidak** memakai sheet dan **tidak** berpindah layar: hasil "Checked in. 0x1234…"
  tetap tampil seperti sekarang bersama "Scan again", ditambah toast hijau + haptic (§7.2). Galat salaman dan galat
  check-in tetap teks hasil + "Scan again" seperti sekarang.
- **Siapa yang tahu salaman berhasil.** Hanya pemindai (B): ia yang memanggil `postAccept` dan menerima `{ txHash }`.
  Pemegang QR (A) tidak menerima sinyal apa pun — `useRotatingQr` hanya membuat offer baru tiap 30 detik, tanpa
  polling atau langganan. Karena itu **sheet hanya tampil di sisi pemindai**; sisi QR tidak diberi sheet, dan menambah
  sinyal baru untuknya di luar lingkup (§11 batas #7).
- Teks baru di layar ini: label segmen, catatan lokasi di mode QR "Approximate location is used only to confirm
  you're both in the same place." (sejalan dengan `NSLocationWhenInUseUsageDescription`, §7.4), dan teks sheet "You
  met …", "View profile", "Scan someone else" (§7.3).

### 6.3 Profil orang — `app/profile/[address].tsx`

Layar ini tetap satu-satunya pengecualian pola pembungkus (spec dompet §6: ia sudah menangani signer `null`).
Seluruh logika vouch, lapor, blokir, ingin bertemu, `loadError`, dan guliran ke isian tidak berubah; hanya tampilan,
terjemahan, dan dua blok data baru.

Urutan (#16A — aksi yang paling mungkin diambil terlihat tanpa menggulir):

1. **Kepala:** `Avatar` besar (64), nama (`heading`), alamat/ENS **utuh** mono (seperti sekarang: ENS lalu alamat),
   lencana "✓ met in person" + " · N events together" ("1 event together") bila `pertemuan` ada (§8.1).
2. **Baris aksi**, tepat di bawah kepala dan **sebelum** kartu Trust: **Send message** (utama) dan **Want to meet**
   (sekunder) berdampingan, masing-masing setengah lebar; bila hanya satu yang memenuhi syarat, ia lebar penuh; bila
   tidak ada, baris tidak tampil. Syarat tampil tidak berubah (Send message hanya untuk koneksi, tombol tanda hanya
   bila `labelTombolTanda !== null`). Tepat di bawahnya, redup: angka "want to meet" (`teksInginBertemu`), "You both
   want to meet." (terjemahan "Kalian saling ingin bertemu."), dan pesan hasil tanda — semuanya yang sudah ada.
3. Kartu **Trust** — nilai dominan (#16A): label kecil redup **"Trust"** (`caption`) di atas **nilai tier** (mis.
   "Trusted", varian `title` 18/600), lalu `BatangTrust`, baris bukti `tierView(...).evidenceLine` (sudah ada,
   diterjemahkan — §7.4, `caption`), lalu "Vouched for by N people you know" ("Vouched for by 1 person you know") bila
   `dijaminKenalan ≥ 1` (§8.2). Nilai 0 atau absen → baris tidak tampil.
4. Kartu **Pertemuan** berjudul "Meetings" (hanya bila `pertemuan` ada): baris salaman ("Handshake at <acara> ·
   <venue>" atau "Met in person", lalu tanggal "Aug 12"), lalu baris "Both attended · <acara> · <tanggal>" untuk
   `acaraBersama`.
5. Kartu **Detail on-chain** berjudul "On-chain details" (B2: "detail on-chain saat kartu dibuka"): dua pasangan
   nilai/label — angka connections dan angka on-chain transactions (tunggal "1 connection", "1 on-chain
   transaction"), angka lebih keras dari labelnya (§7.1) — fakta yang sudah ada, dipindah ke kartunya sendiri.
6. **Paling bawah:** **Vouch** (sekunder) dengan pemilih tag; **Report**; **Block / Unblock** (destruktif, teks;
   target sentuh §3.7). Syarat tampil tidak berubah; label diterjemahkan. Guliran ke isian lapor tetap bekerja.

### 6.4 Radar — `(tabs)/(acara)/radar/[eventId].tsx`

Siklus detak 60 detik / radar 10 detik selama fokus dan seluruh penanganan keadaan tidak berubah.

- Kepala: judul "Radar" + pil "● Visible" (radar hanya tampil saat pemanggil Terlihat — gerbang spec 4b+5), lalu
  **"N people visible here"** ("1 person visible here") dengan N = `jumlah` dari respons (keputusan #10e) dan
  "Updated <waktu relatif>" dari jam HP saat `getRadar` terakhir berhasil. Teks mockup "Kamu terlihat oleh N orang"
  **tidak** dipakai: angka itu
  mengklaim siapa yang melihatmu, padahal server hanya tahu siapa yang terlihat olehmu.
- Dua bagian dari urutan server (tanpa mengurutkan ulang): **"Your connections here"** (`pernahBertemu`) dan
  **"Not met yet"** (sisanya), masing-masing dengan jumlah kartunya. Angka N di "N people visible here" dan jumlah
  kartu per bagian tampil lebih keras dari labelnya (§7.1).
- Kartu: `KartuOrang` dengan nama + alamat singkat, lencana ✓ ringkas untuk koneksi, lencana `lencanaKartuRadar`
  yang ada, diterjemahkan ("You both want to meet"; "Pernah bertemu" digantikan ✓ ringkas karena bagiannya sudah
  mengatakannya), keterangan **"here now"** (keputusan #10d — setiap kartu radar memang hadir dalam 15 menit terakhir;
  jam detak tidak pernah dikirim), `BatangTrust` dari `tierDariLabel(tierLabel)` dengan label Inggris. Kartu
  "Not met yet" menambah **"N mutual connections"** ("1 mutual connection") bila `koneksiBersama` ada (§8.3) dan
  tautan **"Handshake ›"** ke tab Salaman.
- Mengetuk kartu → `/profile/<alamat>` (seperti sekarang). Tetap tidak ada tombol pesan dan tidak ada peta.

### 6.5 Percakapan — `(tabs)/(pesan)/pesan/[address].tsx`

- Header: avatar + nama + alamat singkat, keterangan "🔒 end-to-end encrypted" (fakta spec 4c), menu ⋯ berisi
  aksi yang sudah ada di layar ini (Report, Block) dengan terjemahan kalimat yang sama.
- Gelembung: pesan masuk `card` bergaris di kiri; pesan keluar `primary` dengan teks `primaryForeground` di kanan;
  pemisah hari redup di tengah.
- Isian: `Input` BNA + tombol kirim `primary` 40×40 berikon panah (`hitSlop` 4 → 48, `accessibilityLabel` dari
  `labelKirimPesan`, §3.7); perilaku kirim, batas, dan galat tidak berubah. Menu ⋯ berlabel "More options".
- **Tidak ada "Dibaca …"** (R6).

## 7. Pola Layar Lain

### 7.1 Tiga pola

| Pola | Layar | Bentuk |
|---|---|---|
| **Daftar** | Acara, Feed, Pesan, Koneksi, Kecocokan, Diblokir | judul besar; aksi utama di kanan atas atau baris pertama ("+ Create event", "Write something"); baris = kartu bergaris; Acara menaruh acara LIVE di atas daftar |
| **Formulir** | Buat acara, Unggahan baru, Lapor, Profil (bagian nama & visibilitas), Mulai (isian 12 kata / kunci dev) | label kecil redup di atas `Input` BNA; peringatan dan penghitung karakter yang ada di bawah isian; tombol utama lebar penuh di bawah |
| **Detail** | Detail acara, QR check-in, Dompet, Profil orang | kepala (judul/nama), kartu fakta, aksi di bawah; aksi destruktif paling bawah dan berwarna `destructive` |

Setiap pola memakai aturan dasar §3.7: tepi layar 16, jarak antarbagian 24–32, paling banyak 4 ukuran huruf, target
sentuh ≥ 48, teks membungkus pada ukuran huruf besar.

**Nilai lebih keras dari label (#16A).** Di mana pun label dan nilai tampil berpasangan — tier di kartu Trust,
hitungan di kepala Profil (tab), "N people visible here" dan jumlah per bagian di Radar, angka di kartu On-chain
details, `{checkins} checked in` di kartu LIVE — **nilainya** memakai varian yang lebih besar/tebal (`title` 18/600,
atau `body` + 600 di kartu kecil) dan **labelnya** `caption` redup. Untuk teks berangka, `src/jamak.ts` mendapat
`pasanganJamak(n, tunggal, banyak)` → `{ angka, kata }` (mis. `{ angka: "12", kata: "connections" }`); `jamak`
dibangun di atasnya, sehingga angka dan kata bisa diberi gaya berbeda tanpa aturan tunggal/jamak kedua. Kalimat
utuh yang tidak berbentuk label/nilai (mis. "Vouched for by 2 people you know") tetap satu gaya.

**Profil (tab)** = `profil-saya` diperluas: kepala (nama, alamat utuh mono, angka connections sebagai pasangan
nilai/label, batang trust + label Inggris dari `fetchTrust` alamat sendiri), lalu bagian nama & visibilitas yang sudah ada (Visible/Hidden
dengan kalimat `kalimatVisibilitas` dan `KALIMAT_BATAS_TERSEMBUNYI`, logikanya tidak berubah, kalimatnya
diterjemahkan), lalu daftar tautan: Connections, You both want to meet (+ lencana), Wallet ("Address, 12-word recovery
phrase, and switch wallet"), Blocked.

**Mulai** (keputusan #11): logo "n" besar (`components/logo-n.tsx`, kuning di latar gelap), kalimat **"Know the
people you've actually met"**, lalu tombol **Create a new wallet** (utama) dan **Use an existing wallet** (sekunder,
membuka isian 12 kata), tombol dev tetap di belakang `{__DEV__ && (`. Kalimat pembuka lama yang ada di bawah judul
"Nearly" digantikan kalimat ini; semua kalimat lain di layar Mulai (peringatan 12 kata, "Menyiapkan dompet…" →
"Setting up wallet…", galat) hanya diterjemahkan, dan penjaga ketukan ganda, atribut isian Android, dan `textContentType="none"` tetap (dijaga
`gerbang-dompet.test.ts`).

### 7.2 Empat keadaan seragam

| Keadaan | Bentuk | Aturan |
|---|---|---|
| **Memuat** | `Skeleton` BNA berbentuk kartu/baris yang akan datang; diam tanpa kilau saat Reduce Motion (§3.7) | menggantikan `ActivityIndicator` dan teks "Memuat…" di layar. Pengecualian: tombol yang sedang bekerja tetap memakai label sibuk yang ada, diterjemahkan ("Sending…", "Saving…", "Setting up wallet…") |
| **Kosong** | ikon lucide redup + terjemahan kalimat kosong **yang ada** + satu aksi bila masuk akal | Koneksi & Beranda → Handshake; Acara → Create event; Feed → Write something; Kecocokan, Pesan, Diblokir → tanpa aksi. Aturan "daftar kosong di samping galat BUKAN keadaan kosong" (komentar di `kecocokan.tsx`, `blokir.tsx`, `pesan/index.tsx`) tetap |
| **Galat** | terjemahan kalimat galat **yang ada** + tombol **Try again** yang memuat ulang | layar yang sekarang tidak punya Coba lagi mendapatkannya; maknanya tidak berubah |
| **Berhasil** | `Toast` hijau (garis `verified`, ikon ✓) + `Haptics.notificationAsync(Success)`; toast muncul tanpa geser saat Reduce Motion (§3.7) | hanya untuk aksi penting: check-in, vouch terkirim, acara dibuat, unggahan terkirim, profil disimpan, laporan terkirim. **Salaman memakai sheet "You met …", bukan toast** (#16D, §6.2) — haptic Success yang sama saat sheet terbuka. **"Address copied"** (#16C) memakai toast yang sama tetapi dengan `impactAsync(Light)`, bukan haptic Success. Kalimat toast = terjemahan kalimat berhasil yang ada; pesan yang sekarang tampil sebagai teks di bawah tombol pindah ke toast — kecuali hasil pindai check-in, yang tetap tampil di layar bersama tombol "Scan again" (§6.2). `Alert.alert` konfirmasi (ganti dompet, lihat 12 kata, laporan terkirim → blokir?) tetap dialog, kalimatnya diterjemahkan |

### 7.3 Teks baru yang diizinkan

Selain teks di daftar ini dan kalimat data baru §8, setiap kalimat adalah terjemahan kalimat yang ada di kode
(keputusan #12, #15, R5). Semua teks baru berbahasa Inggris:

- Label tab: Home, Events, Handshake, Messages, Profile.
- Sapaan "Good morning" / "Good afternoon" / "Good evening"; judul bagian "Recently met", "Feed", "Your connections
  here", "Not met yet", "Trust", "Meetings", "On-chain details"; tautan "See all ›", "Open radar ›", "Open event ›",
  "Open Wallet ›", "Handshake ›"; "● LIVE"; "N checked in"; "You're checked in".
- Beranda: tombol "Copy", toast "Address copied" (#16C).
- Handshake: "Show QR", "Scan", catatan lokasi "Approximate location is used only to confirm you're both in the same
  place."; sheet berhasil (#16D) "You met ‹nama›" / "You met ‹alamat singkat›", "View profile", "Scan someone else".
- Label aksesibilitas (§3.7): "Copy address", "More options", "Trust: ‹tier›" (tombol Salaman tab bar memakai label
  tab "Handshake", tombol kirim memakai terjemahan `labelKirimPesan`).
- Radar: "N people visible here", "Updated …", "here now", "N mutual connections", pil "Visible".
- Lencana: "✓ met in person", " · N events together".
- Profil orang: "Vouched for by N people you know", "Handshake at …", "Met in person", "Both attended · …".
- Percakapan: "🔒 end-to-end encrypted".
- Mulai: "Know the people you've actually met", "Create a new wallet", "Use an existing wallet".
- Waktu relatif: "just now", "N minutes ago", "N hours ago", "yesterday", "N days ago", lalu tanggal "Aug 12"
  (§7.4).
- Tombol galat: "Try again".

Setiap teks berangka memakai bentuk tunggal untuk `n === 1` ("1 minute ago", "1 person visible here", "1 mutual
connection", "1 event together", "Vouched for by 1 person you know"). Semua kalimat baru ditaruh di fungsi/konstanta
murni `src/` (pola `src/messages.ts`), diuji di vitest, bukan ditulis di JSX.

### 7.4 Bahasa Inggris (keputusan #15)

**Cakupan.** Setiap teks yang dilihat pengguna aplikasi mobile menjadi bahasa Inggris: layar di `app/`, komponen di
`components/`, modul kalimat di `src/`, judul layar dan label tab, teks izin di `app.json`, dan isi push yang dibuat
`apps/api`. Satu bahasa, tanpa kerangka i18n (tidak ada `i18next`/`expo-localization`, tidak ada berkas terjemahan,
tidak ada pengalih bahasa): kalimat Inggris ditulis langsung di tempat kalimat Indonesia hari ini.

**Yang tetap bahasa Indonesia:** nama berkas, nama rute dan parameter (`/salaman?mode=pindai`, `/profil-saya`,
`/dompet`), semua pengenal kode, kode galat (`dompet_tidak_konsisten`, `tersembunyi`, …), nilai kawat API
(`visibilitas: "terlihat"`, `jenis: "pesan"`, `tierLabel` — di bawah), komentar kode, judul `describe`/`it` di tes,
log `console.*`, dan semua dokumen. `apps/web` tidak disentuh.

**Daftar istilah (terkunci, #15):**

| Indonesia hari ini | Inggris |
|---|---|
| Beranda · Acara · Salaman · Pesan · Profil (tab) | Home · Events · Handshake · Messages · Profile |
| Salaman (aksi/layar) | Handshake |
| Terlihat / Tersembunyi | Visible / Hidden |
| Tier Baru · Dikenal · Terpercaya · Inti | New · Known · Trusted · Core |
| Vouch · Lapor · Blokir / Cabut blokir | Vouch · Report · Block / Unblock |
| Ingin bertemu / Saling ingin bertemu | Want to meet / You both want to meet |
| Koneksi · koneksi bersama | Connections · mutual connections |
| Dompet · 12 kata pemulihan | Wallet · 12-word recovery phrase |
| lencana "✓ terverifikasi" | "✓ met in person" |
| "✓ bertemu langsung · N acara bersama" | "✓ met in person · N events together" (tunggal "1 event together") |
| "Bertemu langsung" (salaman di luar acara) | "Met in person" |
| "Dijamin N orang yang juga kamu kenal" | "Vouched for by N people you know" (tunggal "1 person") |
| "N koneksi bersama" | "N mutual connections" (tunggal "1 mutual connection") |
| "N orang terlihat di sini" | "N people visible here" (tunggal "1 person visible here") |
| "hadir sekarang" | "here now" |
| "Kenali orang yang benar-benar kamu temui" | "Know the people you've actually met" |
| Buat dompet baru / Pakai dompet yang sudah ada | "Create a new wallet" / "Use an existing wallet" |
| kemarin / N hari lalu | yesterday / N days ago |

Kalimat lain diterjemahkan 1:1 maknanya oleh tugas yang memindahkan layarnya, memakai istilah di atas, dengan
register yang sama (orang kedua "you", hangat, pendek). Terjemahan yang dikutip di spec ini (R5, §6, §7.1–§7.3)
mengikat.

**Bentuk jamak.** Aturan tunggal: `n === 1` → bentuk tunggal, selainnya jamak (termasuk 0). Satu fungsi murni
`jamak(n, tunggal, banyak)` di `src/jamak.ts` mengembalikan `` `${n} ${n === 1 ? tunggal : banyak}` ``; semua teks
berangka memakainya — lewat `pasanganJamak` bila angka dan kata diberi gaya berbeda (§7.1). Tidak ada aturan jamak
lain (tidak ada `Intl.PluralRules`).

**Tanggal dan jam.** Fungsi murni di `src/waktu.ts`, **tidak** memakai `toLocaleString` (hasil `Intl` di Hermes/Expo
Go tidak dijamin sama antarperangkat, dan tes harus deterministik):

- tanggal: nama bulan Inggris tiga huruf tetap (`Jan` … `Dec`) + hari tanpa nol di depan — "Aug 12"; tahun
  ditambahkan bila bukan tahun berjalan — "Aug 12, 2025";
- jam: 24 jam, dua digit — "19:42", "08:05";
- tanggal + jam acara: "Aug 12, 19:42" — menggantikan `toLocaleString("id-ID", …)` di `events/index` dan
  `events/[id]`;
- waktu relatif (§7.3): < 1 menit "just now"; < 60 menit "N minutes ago"; < 24 jam "N hours ago"; hari kalender
  sebelumnya "yesterday"; ≤ 6 hari "N days ago"; selebihnya tanggal.

Semua memakai zona waktu lokal HP, seperti hari ini.

**Label tier: kawat vs tampilan.** `TIER_LABELS = ["Baru","Dikenal","Terpercaya","Inti"]` tinggal di
`packages/trust/src/tier.ts`, yang **tidak boleh diubah** (§13). API mengirim string itu sebagai `tierLabel`
(`radar-gate.ts`, `graf.ts`, `routes/trust.ts`), dan `apps/web/src/label.ts` `radiusSimpul` memakainya sebagai kunci
peta untuk graf `/live`. Karena itu:

- `tierLabel` di kawat **tetap bahasa Indonesia** dan diperlakukan sebagai **kode internal**, bukan teks tampilan;
- `apps/mobile/src/tier.ts` mendapat `LABEL_TIER_EN = ["New", "Known", "Trusted", "Core"] as const` (berindeks tier,
  panjang sama dengan `TIER_LABELS`) dan `labelTier(tier)` (tier di luar jangkauan → `"New"`);
- `tierDariLabel(label)` tetap mengurai label kawat Indonesia (`TIER_LABELS.indexOf`, tak dikenal → 0);
- `tierView` memakai `labelTier`, dan baris buktinya diterjemahkan dengan `jamak`: "12 connections · 3 occasions ·
  2 regions · 4 vouches"; tanpa bukti → "no connections yet";
- `app/kecocokan.tsx` hari ini merender `TIER_LABELS[k.tier]` langsung — diganti `labelTier(k.tier)`;
- **tidak ada layar yang merender `TIER_LABELS`**: hanya `src/tier.ts` yang boleh mengimpornya (tes §10.1).

**Tag vouch.** `SUGGESTED_TAGS` di `src/tier.ts` adalah saran yang tampil sebagai tombol, jadi diterjemahkan:
"real builder", "solid dev", "knows zk", "designer", "research". Tag adalah isi yang ditandatangani (`tagsHash`),
bukan teks antarmuka: tag yang sudah tercatat tampil apa adanya, dan API tidak berubah.

**Isi push (di `apps/api`).** Teks push dibuat API, bukan HP; judul tetap "Nearly":

| Berkas | Sekarang | Menjadi |
|---|---|---|
| `apps/api/src/pesan-push.ts` `teksPush(nama)` | "Pesan baru dari <nama>" / "Pesan baru dari koneksimu" | "New message from <name>" / "New message from a connection" |
| `apps/api/src/radar-notif.ts` `teksNotifKedekatan` — saling ingin bertemu | "<nama>, yang saling ingin bertemu denganmu, ada di acara ini." / "Seseorang yang saling ingin bertemu denganmu ada di acara ini." | "<name> is at this event. You both want to meet." / "Someone you both want to meet is at this event." |
| idem — pernah bertemu | "<nama>, yang pernah kamu temui, ada di acara ini." / "Seseorang yang pernah kamu temui ada di acara ini." | "<name>, who you've met, is at this event." / "Someone you've met is at this event." |

Aturan privasi isi push tidak berubah (spec 4c §7.2, spec 4b+5 §6.4): tanpa alamat, tanpa judul atau lokasi acara,
tanpa sel; hanya nama tampilan bila ada. `data` push (`jenis`, `eventId`) tidak berubah. Tes
`apps/api/test/pesan-push.test.ts` dan `radar-notif.test.ts` diperbarui ke kalimat Inggris; pemeriksaan "tanpa
alamat/judul/lokasi" di tes itu tetap.

**Teks izin (`app.json`).** `ios.infoPlist`:

- `NSCameraUsageDescription`: "Nearly uses the camera only to scan the QR codes of people you meet."
- `NSLocationWhenInUseUsageDescription`: "Nearly uses approximate location (~150 m) only while the app is open: during
  a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at
  the event."

Android tidak memakai teks izin kustom (`android.permissions` hanya daftar izin), dan izin notifikasi memakai dialog
sistem tanpa teks dari aplikasi (tidak ada plugin `expo-notifications` bertes izin di `app.json`); tidak ada teks
lain yang diterjemahkan di sana.

**Cara penerjemahan berjalan (§9):**

1. Langkah 2 (fondasi) menerjemahkan `src/tier.ts` (`LABEL_TIER_EN`, `labelTier`, `tierView`, `SUGGESTED_TAGS`),
   menambah `src/jamak.ts` + `src/waktu.ts`, dan teks izin `app.json` (berkas itu sudah disentuh di langkah ini).
2. Langkah 3 (navigasi) menulis `JUDUL_LAYAR` dan `TAB_BAWAH` langsung dalam bahasa Inggris (§4.3, §4.7).
3. Langkah 4 (API) menerjemahkan isi push dan tesnya.
4. Langkah 5: setiap kelompok menerjemahkan **layar yang dimigrasinya** di tugas yang sama. Modul kalimat bersama di
   `src/` (`messages.ts`, `errors.ts`, `dompet/teks-dompet.ts`, kalimat blokir/acara/feed/meet/pesan/radar/kecocokan
   yang diuji `blokir-messages`, `event-messages`, `feed-messages`, `feed-alasan`, `meet-messages`,
   `meet-gerbang-teks`, `pesan-messages`, `radar-messages`, `kecocokan-teks`, `teks-dompet`, `errors`,
   `galat-jaringan`, `messages`) diterjemahkan **di tugas pertama yang menyentuhnya**, bersama tesnya: harapan
   string di tes menjadi Inggris, judul `describe`/`it` tetap Indonesia.
5. Tugas terakhir langkah 5 adalah **sapuan**: `grep` teks Indonesia yang tersisa di `app/`, `components/`, `src/`,
   `app.json`, lalu tes penjaga bahasa §10.1 dinyalakan untuk seluruh pohon.

**Tes penjaga bahasa (`bahasa.test.ts`, baca-kode).** Memakai TypeScript compiler API (`typescript`, sudah
devDependency akar; bila tidak terjangkau dari `apps/mobile`, ditambahkan sebagai devDependency `@nearly/mobile` dengan
versi yang sama) untuk mengurai setiap `.ts`/`.tsx` di `app/`, `components/`, `src/`:

- yang diperiksa **hanya** simpul teks: `StringLiteral`, `NoSubstitutionTemplateLiteral`, bagian teks template
  (`TemplateHead`/`Middle`/`Tail`), dan `JsxText`. Pengenal dan komentar tidak pernah menjadi simpul itu, jadi tidak
  pernah terperiksa — komentar boleh tetap Indonesia;
- dilewati: penentu modul `import`/`export … from`/`require(...)`, argumen `console.*`, dan kunci properti
  (`{ "saling_ingin_bertemu": … }`);
- pola: kata utuh, tanpa peka huruf besar, `\b(yang|dan|kamu|tidak|sudah|belum|dengan|untuk|ini|itu|gagal|berhasil|coba|sedang)\b`.
  `\b` memperlakukan `_` sebagai bagian kata, sehingga kode seperti `dompet_tidak_konsisten` tidak cocok;
- **allowlist eksplisit** berupa pasangan `[berkas, literal]` di tes itu untuk string kode yang sah (mis. nilai kawat,
  kunci `JUDUL_LAYAR`), masing-masing dengan alasan satu baris; allowlist yang tidak lagi cocok dengan kode membuat tes
  merah, supaya tidak menumpuk (kunci `JUDUL_LAYAR` tidak perlu masuk — kunci properti sudah dilewati);
- `app.json`: setiap nilai `ios.infoPlist.*UsageDescription` lolos pola yang sama;
- selama langkah 5 tes berlaku untuk daftar berkas yang sudah dimigrasi; di sapuan akhir untuk seluruh pohon (sama
  dengan tes penjaga lain, §9).

Tes ini jaring, bukan bukti: kalimat Indonesia tanpa kata di pola bisa lolos, dan sapuan manual di langkah 5 tetap
wajib.

## 8. Data Baru di API

Ketiga data hanya menambah **medan** ke respons yang sudah ada; tidak ada rute baru, tidak ada tipe EIP-712 baru,
tidak ada perubahan `packages/shared` (tipe respons hidup di `apps/api/src` dan `apps/mobile/src`, seperti
`KartuRadar` dan `TrustResponse` sekarang).

**Aturan bersama:**

1. **Tidak pernah lewat spread.** Objek respons baru dibangun kunci demi kunci — pola yang dipakai
   `apps/api/src/radar-gate.ts` ("Dibangun kunci demi kunci, BUKAN spread — medan tambahan di `baris` … tidak boleh ikut
   terkirim"). Hasil store tidak pernah di-spread ke JSON.
2. **Gagal = kunci hilang, bukan angka karangan** — pola `inginBertemuCount` di `routes/profile.ts`. Kegagalan store
   untuk data baru tidak membuat profil atau radar gagal, dan tidak pernah memalsukan `0`/`null`.
3. **Tidak ada nama, alamat, atau sel lokasi orang ketiga** di data baru — hanya angka, nama acara, dan waktu.
4. Semua alamat dibandingkan dalam huruf kecil.

### 8.1 (a) Riwayat pertemuan — `GET /profile/:address`

**Hanya di cabang terbukti** (`pemanggilTerbukti` dengan bukti `LihatProfil` yang sudah ada), sehingga yang melihat
hanyalah salah satu dari dua orang dalam pertemuan itu. Tanpa bukti, respons publik tidak berubah sedikit pun.

```ts
pertemuan: null | {
  salaman: {
    atMs: number;                                   // connections.created_at
    acara: { eventId: Hex; title: string; venueLabel: string } | null;
  };
  acaraBersama: { eventId: Hex; title: string; venueLabel: string; startsAt: string }[]; // maks. 10, terbaru dulu
  jumlahAcaraBersama: number;                       // total, termasuk yang tidak masuk 10
}
```

- `null` bila pemanggil dan `addr` tidak terkoneksi (tidak ada baris `connections` untuk pasangan kanoniknya), dan
  bila `pemanggil === addr` (profil sendiri). Co-kehadiran tanpa salaman **tidak** disebut pertemuan.
- `salaman.acara`: acara yang **keduanya** check-in, dengan `created_at` koneksi di dalam `[startsAt, endsAt]`, dan
  `connections.cell` di dalam geofence acara (`isInsideGeofence(centerCell, cell)`) bila sel koneksi ada. Lebih dari
  satu yang cocok → yang `startsAt`-nya terbaru. Tidak ada → `null` → layar "Bertemu langsung".
- `acaraBersama`: acara yang keduanya check-in (`checkins` per alamat, indeks `checkins_address`), **tanpa** acara
  salaman di atas, urut `startsAt` terbaru.
- **Tidak dikirim:** `connections.cell`, `tx_hash`, `checkins.cell`, `at_ms` check-in, host.
- Blokir: `pertemuan` tetap keluar untuk pasangan terblokir — ini riwayat pemanggil sendiri, dan salaman + check-in
  keduanya sudah publik on-chain (`KALIMAT_BATAS_TERSEMBUNYI`). Visibilitas Tersembunyi tidak berpengaruh untuk alasan
  yang sama.
- Store baru `apps/api/src/pertemuan-store.ts` (port `PertemuanStore` di `ports.ts`, blok baru — blok yang ada tidak
  diubah, preseden `radar-store.ts` §komentar kepala):
  - `koneksiPasangan(a, b): Promise<{ atMs: number; cell: string | null } | null>` — satu baris lewat
    `connections_unique_pair`;
  - `acaraCheckInBersama(a, b): Promise<AcaraRingkas[]>` — dua kueri `checkins` berhalaman penuh (`fetchAllPages`),
    irisan di memori, lalu `events` per kelompok `potongKelompok`.

### 8.2 (b) Penjamin yang kamu kenal — `GET /profile/:address`

Juga **hanya di cabang terbukti**: `dijaminKenalan: number`.

- = jumlah alamat `P` dengan vouch **aktif** `P → addr` (`vouches.revoked_at is null`, indeks parsial `vouches_to`)
  yang **terkoneksi dengan pemanggil**, dikurangi pemanggil sendiri, `addr` sendiri, dan setiap alamat di
  `blokir.diblokirOleh(pemanggil)` — **satu arah**: hanya orang yang diblokir pemanggil. *Diamandemen 2026-09-18
  (keputusan pemilik, review Rencana A #5):* dulu dua arah (`himpunanUntuk`), tetapi graf vouch dan koneksi publik,
  sehingga angka yang turun satu membocorkan siapa yang memblokir pemanggil — alasan yang sama dengan
  `inginBertemuCount` (spec §5.2 yang diamandemen).
- Irisan memakai `RadarStore.terhubungDengan(pemanggil, penjamin)` yang sudah ada — satu kueri per kelompok.
- Port: `PertemuanStore.penjaminAktif(to): Promise<Address[]>`.
- Hanya angka. Siapa penjaminnya tidak dikirim (vouch memang publik on-chain di `VouchRegistry`, tetapi layar tidak
  butuh namanya dan keputusan pemilik adalah angka).
- Profil sendiri (`pemanggil === addr`) → kunci tidak dikirim.

### 8.3 (c) Koneksi bersama di radar — `GET /radar/:eventId`

`KartuRadar` mendapat satu kunci opsional: `koneksiBersama?: number`.

- Dihitung **hanya untuk kartu `pernahBertemu === false`**, dan dikirim **hanya bila ≥ 1**. Kartu koneksi tidak
  pernah membawa kunci ini.
- **Kedua pihak Terlihat:** dijamin gerbang yang sudah ada — pemanggil Tersembunyi ditolak 403 `tersembunyi` sebelum
  kartu dibangun, dan kandidat hanya lolos bila `visibilitas === "terlihat"`. Penghitungan berjalan **setelah**
  saringan visibilitas dan blokir, atas daftar `lolos` saja, sehingga orang Tersembunyi tidak pernah menjadi subjek
  hitungan.
- **Blokir:** pasangan terblokir (dua arah) tidak punya kartu (sudah ada). Hitungan koneksi bersama hanya
  mengecualikan orang yang **diblokir pemanggil** (`diblokirOleh`, satu arah). *Diamandemen 2026-09-18 (keputusan
  pemilik, review Rencana A #5):* orang yang memblokir pemanggil tetap dihitung, karena graf koneksi publik dan
  angka yang turun satu akan menjadi oracle "siapa yang memblokirku".
- Yang dihitung: |koneksi(pemanggil) ∩ koneksi(K)| tanpa pemanggil, K, dan himpunan blokir di atas. Koneksi bersama
  yang sedang Tersembunyi **tetap dihitung**: visibilitas mengatur radar, bukan graf, dan graf koneksi publik
  on-chain serta lewat `GET /connections/:address`.
- **Tanpa nama:** tidak ada daftar, alamat, atau nama koneksi bersama di respons. Tes membandingkan himpunan kunci
  kartu persis (§10.2).
- Port: `RadarStore.hitungKoneksiBersama(who, kandidat, kecuali): Promise<Map<string, number>>` (metode baru; daftar
  `METODE_RADAR_STORE` dan pengait `AssertNeverRadar` ikut diperbarui). Implementasi: koneksi pemanggil berhalaman
  penuh, lalu kueri `connections` dengan dua arah urutan kanonik (`addr_a < addr_b`) per kelompok
  `potongKelompok`, seperti `terhubungDengan`.
- Radar dipanggil tiap 10 detik per penonton; hasil `hitungKoneksiBersama` di-cache per pemanggil + himpunan kandidat
  selama 60 detik dengan `buatCacheSingkat` yang sudah ada. Angka yang basi sampai 60 detik diterima.

### 8.4 (d)(e)(f) Tanpa perubahan API

- (d) "here now": teks tetap di HP. Jam detak (`seen_at`) tetap tidak pernah dikirim.
- (e) "N people visible here": `jumlah` sudah ada dan sudah = jumlah kartu yang dikirim (bukan sebelum penyaringan).
  HP yang sekarang belum membacanya mulai membacanya.
- (f) Batang bertingkat: radar mengirim `tierLabel`, `/trust/:address` mengirim `tier` + `tierLabel` + bukti, Pesan
  mengirim `tier`. Tidak ada yang mengirim skor/rasio — tetap. HP membangun batang dari tier (§6).

### 8.5 Tidak ada migrasi

Semua kueri dilayani indeks yang ada: `connections_unique_pair` (pasangan), `connections_a_time` /
`connections_b_time` (koneksi per alamat), `checkins_address`, `vouches_to` (parsial, aktif), primary key `events`.
**Jalur cadangan bila radar terukur lambat** (uji iPhone §10.3): fungsi SQL `koneksi_bersama(aku text, kandidat
text[])` di `supabase/migrations/0009_koneksi_bersama.sql` dengan `revoke execute … from public, anon,
authenticated` — ditulis sebagai berkas migrasi dan **diterapkan pemilik project**, tidak pernah oleh sesi eksekusi.
Jalur ini tidak dikerjakan kecuali pemilik memintanya setelah pengukuran.

## 9. Urutan Kerja

Eksekutor: sesi `fcc` dengan `superpowers:subagent-driven-development`, di branch `desain-ui`. Setiap langkah diakhiri
`pnpm -r test` dan `pnpm -r typecheck` hijau.

1. **Spike BNA di monorepo SDK 57.** Di `apps/mobile`: pasang dependensi §3.6, `bna-ui add button` (dan `text`),
   alias `@/*`, `ThemeProvider` di root layout, satu `Button` BNA di Beranda lama.
   - **Berhasil** bila: `pnpm -r typecheck` dan `pnpm -r test` hijau; `npx expo start --go -c` membundel tanpa galat;
     di iPhone (Expo Go, **uji pemilik**) tombol tampil dengan warna B2, animasi tekan dan haptic jalan, tanpa layar
     merah "worklets/reanimated version mismatch".
   - **Gagal** bila salah satu tidak bisa dipenuhi dalam satu sesi kerja, atau CLI `bna-ui` merusak workspace pnpm,
     atau versi reanimated/worklets yang dituntut BNA tidak cocok dengan yang terbundel di Expo Go SDK 57.
   - **Jalur cadangan:** token §3 tetap persis sama, tetapi komponen ditulis sendiri di `components/ui/` dengan API
     yang meniru BNA (`Text` bervarian, `Button` bervarian dengan `haptic`, `Input`, `Card`, `Skeleton`, `Toast`,
     `useColor`), **tanpa** reanimated (animasi `Animated` bawaan RN, atau tanpa animasi). Semua tes §10 tetap
     berlaku dengan nama komponen yang sama, sehingga langkah 2–6 tidak berubah.
   - Hasil spike (jalur yang dipakai, lima hal belum pasti §3.6) ditulis ke §11 spec ini.
2. **Fondasi:** `theme/colors.ts` (termasuk `segmentEmpty` `#56627d`, #16B) + `globals.ts` (varian huruf §3.3 tanpa
   500, token `jarak` 4/8/12/16/24/32), tema dikunci gelap, font (Inter 400/600/700, JetBrains Mono 400) + splash,
   `app.json` (tema, ikon, splash, `version` 0.2.0, teks izin Inggris), skrip ikon + PNG, `components/` bersama
   (Avatar, KartuOrang, BatangTrust berlabel aksesibel, Lencana dengan `maxFontSizeMultiplier` 1,3, Segmen, LogoN),
   `hooks/useGerakDikurangi.ts` + suntingan kecil `skeleton`/`toast` salinan BNA untuk Reduce Motion (§3.7),
   `src/tier.ts` berlabel Inggris + `labelAksesTrust` + `src/jamak.ts` (dengan `pasanganJamak`) + `src/waktu.ts`
   (§7.4) + `hurufAvatar`, tes `aksesibilitas.test.ts` (§10.1), hapus `src/warna.ts`. Aturan §3.7 berlaku untuk setiap
   berkas yang ditulis sejak langkah ini. Layar belum dipindah.
3. **Navigasi:** pohon §4.1 (`git mv` supaya riwayat berkas terjaga), `(tabs)/_layout.tsx` + tab bar, Stack per tab
   dengan `unstable_settings`, `JUDUL_LAYAR`/`layarDalam`/`TAB_BAWAH` (berbahasa Inggris), gerbang dompet dengan daftar baru,
   `useLencanaTab`, Salaman sementara merender dua komponen lama berdampingan. Tab bar mengikuti §3.7 (tinggi dengan
   inset bawah, label 11 dibatasi 1,3×, label aksesibilitas tombol Salaman). Semua tes lama yang bergantung pada
   jalur diperbarui di langkah ini (§10.1).
4. **API tiga data baru** + tes fake dan tes privasi (§10.2), dan **isi push Inggris** di `pesan-push.ts` +
   `radar-notif.ts` beserta tesnya (§7.4). Tidak menyentuh HP.
5. **Migrasi layar per kelompok**, satu commit per kelompok; setiap kelompok **menerjemahkan layarnya sendiri** dan
   modul kalimat bersama yang pertama kali disentuhnya, bersama tesnya (§7.4): (a) Salaman — termasuk sheet "You met
   …" (`components/salaman/sheet-bertemu.tsx`, `judulSheetBertemu`, #16D); (b) Beranda — termasuk alamat singkat +
   "Copy" dan `npx expo install expo-clipboard` (#16C); (c) Profil (tab) + Profil orang — termasuk urutan baru dan
   kartu Trust bernilai dominan (#16A); (d) Acara + Radar; (e) Pesan; (f) sisanya (Feed, Unggahan baru, Buat acara, QR check-in,
   Koneksi, Kecocokan, Dompet, Diblokir, Lapor, Mulai, keadaan galat gerbang); (g) **sapuan bahasa** — sisa teks
   Indonesia di `app/`, `components/`, `src/`, `app.json`. Tes penjaga §10.1 yang bersifat "seluruh `app/`" dinyalakan
   di akhir (f), penjaga bahasa di akhir (g); sebelum itu berlaku untuk berkas yang sudah dimigrasi (daftar eksplisit
   di tes).
6. **Dokumen & verifikasi:** amandemen §15, `docs/demo/runbook.md` (langkah demo menyebut tab, bukan tautan beranda),
   hasil uji iPhone ke §10.3.

## 10. Verifikasi

### 10.1 Tes otomatis — `apps/mobile` (vitest, murni dan baca-kode)

Tes baru / diganti:

- **`tema.test.ts` (menggantikan `warna-isian.test.ts`):**
  - tidak ada literal warna (`#[0-9a-fA-F]{3,8}\b`, `rgb(`, `rgba(`) di `app/**`, `components/**` (termasuk salinan
    BNA di `components/ui/**` — literal warna bawaan salinan diganti token saat disalin), `hooks/**`, dan `src/**`;
    satu-satunya berkas TS yang memuatnya `theme/colors.ts`;
  - tidak ada `Text`, `TextInput`, atau `Button` yang diimpor dari `"react-native"` di `app/**` dan `components/**` di
    luar `components/ui/**`;
  - setiap `<Input` di `app/**` berasal dari `@/components/ui/input`;
  - `app.json`: `userInterfaceStyle === "dark"`; `theme/colors.ts`: objek `light` dan `dark` identik; nilai token B2
    persis seperti §3.1, termasuk `segmentEmpty === "#56627d"`; `BatangTrust` memakai `segmentEmpty` untuk ruas kosong,
    bukan `border`;
  - `ThemeProvider` di `app/_layout.tsx` tidak membaca `useColorScheme`.
- **`judul-layar.test.ts` (diperbarui):** setiap berkas layar di `app/` (termasuk grup, bukan `_layout`) punya judul;
  tidak ada judul untuk rute yang hilang; judul tidak kosong dan bukan nama rute; setiap kunci `JUDUL_LAYAR` dimiliki
  tepat satu layout — Stack akar (lewat `LAYAR_AKAR`) atau satu Stack tab (lewat `layarDalam`) — tanpa irisan dan tanpa
  sisa; setiap `_layout.tsx` Stack tab mendaftarkan `layarDalam("<grupnya>")` dan tidak ada
  `title: "` tulisan tangan di layout mana pun; `layarMenurutDompet(false)` = `["mulai"]`, `layarMenurutDompet(true)`
  diawali `(tabs)`; `TAB_BAWAH` berisi tepat lima grup dalam urutan §4.3, setiap grup punya folder dan `_layout.tsx`, dan
  `(tabs)/_layout.tsx` memetakannya.
- **`gerbang-dompet.test.ts` (diperbarui):** pola `Stack.Protected` dua sisi dan `<DompetProvider>` di dalam
  `ThemeProvider`; keadaan `galat` tetap tidak jatuh ke Mulai; semua pemeriksaan layar Mulai tetap, dengan `<TextInput`
  diganti `<Input`; splash disembunyikan hanya setelah font dan keadaan dompet siap.
- **`dompet-tanpa-kunci-dev.test.ts` (diperbarui):** jalur di `HARAPAN` mengikuti §4.1; `app/qr.tsx` + `app/scan.tsx`
  diganti `"app/(tabs)/(salaman)/salaman.tsx": ["signerHadir:attendanceRegistry", "signerSalaman:verifyingContract"]`;
  pemeriksaan `<ScanIsi …>` menjadi `<SalamanIsi …>`; `app/(tabs)/_layout.tsx` (pemakai signer untuk lencana) masuk
  daftar dengan kontrak `verifyingContract` dan pola pembungkus.
- **`salaman.test.ts` (baru, baca-kode):** komponen mode Pindai masih mencoba `decodeCheckInQr` sebelum `decodeQr`;
  penjaga `busy` ada; `postAccept` berhasil membuka `SheetBertemu` (bukan toast, dan **tidak** ada `router.push` di
  cabang itu); `sheet-bertemu.tsx` memanggil `Haptics.notificationAsync` saat terbuka, memakai `Modal` dari
  `"react-native"` dengan `onRequestClose`, dan `router.push(\`/profile/${…}\`)` hanya di penangan "View profile";
  `onScan` diabaikan selama sheet terbuka; check-in berhasil **tidak** membuka sheet dan tidak berpindah layar; isi
  mode dirender di balik `useIsFocused`; pembungkus hanya memanggil hook dompet; `components/salaman/mode-qr.tsx` dan
  `src/handshake/useRotatingQr.ts` tidak memuat sheet (sisi QR tidak diberi sinyal baru, §6.2). Pengambilan nama sheet (R14) memakai `/profile/` **tanpa** `kueriBuktiProfil`, dan membandingkan alamat sebelum mengisi nama (jawaban basi dibuang).
- **`aksesibilitas.test.ts` (baru, baca-kode, §3.7):** tidak ada `allowFontScaling={false}` / `allowFontScaling:
  false` di `app/**`, `components/**`; nilai numerik literal `margin*`/`padding*`/`gap`/`rowGap`/`columnGap` di
  `app/**` dan `components/**` di luar `components/ui/**` ∈ {0, 4, 8, 12, 16, 24, 32}; tidak ada `fontSize` literal di
  luar `theme/**` dan `components/ui/**`; tidak ada `Inter_500Medium` atau `JetBrainsMono_500Medium` di mana pun;
  `components/batang-trust.tsx` memuat `accessibilityLabel`; `Lencana` dan label tab memuat `maxFontSizeMultiplier`.
  Selama langkah 5 pemeriksaan jarak/`fontSize` berlaku untuk daftar berkas yang sudah dimigrasi, seperti penjaga
  lain.
- **`rute-push.test.ts` (ditambah):** `"/pesan"` dan `/radar/<id>` cocok dengan berkas di `app/` setelah segmen grup
  `(…)` dibuang.
- **`tautan.test.ts` (baru, baca-kode):** setiap `href="…"` dan `router.push("…")` statis di `app/**` dan
  `components/**` menunjuk rute yang ada; tidak ada lagi `/qr` atau `/scan`.
- **Fungsi murni baru:** `tierDariLabel` (empat label kawat Indonesia + tak dikenal), `labelTier` (0–3 → New/Known/
  Trusted/Core, di luar jangkauan → New; `LABEL_TIER_EN.length === TIER_LABELS.length`), ruas batang `tier + 1`,
  sapaan per jam (batas 04:00, 12:00, 18:00), `jamak` (0, 1, 2), tanggal/jam (`"Aug 12"`, tahun lain `"Aug 12, 2025"`,
  `"08:05"`, `"19:42"`), waktu relatif (setiap batas §7.4), kalimat pertemuan (`null`, tanpa acara, dengan acara,
  dengan venue kosong, 0/1/N events together), "Vouched for by …" (0 → `null`, 1 → "1 person", N), "N mutual
  connections" (absen → `null`, 1, N), "N people visible here" (1, N), pemisahan kartu radar ke dua bagian tanpa
  mengubah urutan; `judulSheetBertemu` (nama → "You met Rina"; nama kosong/spasi/`null` → "You met 0x9bE5…6ffA"),
  `hurufAvatar` (nama → huruf besar pertama; tanpa nama → karakter pertama setelah `0x`), `labelAksesTrust` (0–3 →
  "Trust: New" … "Trust: Core"), `pasanganJamak` (0, 1, 2 — dan `jamak` = gabungan keduanya).
- **Tes kalimat yang ada** (`messages`, `blokir-messages`, `event-messages`, `feed-messages`, `feed-alasan`,
  `meet-messages`, `meet-gerbang-teks`, `pesan-messages`, `radar-messages`, `kecocokan-teks`, `teks-dompet`, `errors`,
  `galat-jaringan`, `tier`, `judul-layar`, …): string yang diharapkan menjadi Inggris; kasus, cabang, dan judul
  `describe`/`it` tetap. Tes yang memeriksa kode galat atau nilai kawat tidak berubah.
- **`bahasa.test.ts` (baru, baca-kode):** penjaga teks Indonesia §7.4, plus: `TIER_LABELS` hanya diimpor oleh
  `src/tier.ts` (tidak ada berkas lain di `app/`, `components/`, `src/` yang mengimpor atau merendernya); tidak ada
  `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` di `app/`, `components/`, `src/` (tanggal lewat
  `src/waktu.ts`); nilai `ios.infoPlist` di `app.json` persis kalimat §7.4.
- Tes lama lain tetap hijau tanpa diubah maknanya.

### 10.2 Tes otomatis — `apps/api` (vitest dengan fake `support/*`)

- **Profil — `pertemuan`:** tanpa bukti → kunci `pertemuan` dan `dijaminKenalan` **absen** dan respons publik
  identik byte demi byte dengan sebelum fase ini; bukti sah + terkoneksi → `pertemuan.salaman.atMs` benar; salaman di
  dalam acara yang keduanya check-in dan di dalam geofence → `acara` terisi; di luar jendela waktu, di luar geofence,
  atau hanya satu pihak check-in → `acara: null`; `acaraBersama` tanpa acara salaman, urut terbaru, maks. 10,
  `jumlahAcaraBersama` total; tidak terkoneksi → `null`; profil sendiri → `null`; himpunan kunci `pertemuan` persis
  (tidak ada `cell`, `txHash`, `host`); store gagal → kunci absen, profil tetap 200.
- **Profil — `dijaminKenalan`:** hanya vouch aktif (vouch dicabut tidak dihitung); hanya penjamin yang terkoneksi
  dengan pemanggil; pemanggil yang juga menjamin tidak menghitung dirinya; penjamin yang diblokir pemanggil tidak dihitung,
  penjamin yang memblokir pemanggil **tetap** dihitung; nilai 0 dikirim sebagai `0` (kunci ada); store gagal → kunci absen.
- **Radar — `koneksiBersama`:** hanya pada kartu `pernahBertemu === false`; absen bila 0; hitungan benar untuk graf
  kecil yang ditulis tangan; koneksi bersama yang diblokir pemanggil tidak dihitung, yang memblokir pemanggil tetap dihitung; kandidat Tersembunyi
  tidak punya kartu **dan** fake store membuktikan ia tidak pernah dikirim ke `hitungKoneksiBersama`; pemanggil
  Tersembunyi → 403 sebelum store dipanggil; **himpunan kunci setiap kartu persis** `address, displayName, tierLabel,
  pernahBertemu, salingInginBertemu` (+ `koneksiBersama` bila ada) — tidak ada nama/alamat koneksi bersama, tidak ada
  `tier` mentah; `jumlah` tetap = jumlah kartu; cache 60 detik mengembalikan hasil yang sama di dalam jendela dan
  menghitung ulang setelahnya (jam palsu); store gagal → kunci absen di semua kartu, radar tetap 200.
- **Store (pemetaan, `supabase-memori`):** `koneksiPasangan` untuk kedua urutan argumen; `acaraCheckInBersama` melewati
  batas halaman 1000; `penjaminAktif` menyaring `revoked_at`; `hitungKoneksiBersama` untuk kandidat di kedua sisi
  urutan kanonik.
- Langkah mutasi dijalankan sungguhan untuk: saringan blokir di (b) dan (c), saringan `revoked_at`, syarat
  `pernahBertemu === false`, cabang terbukti di profil, dan pembangunan kartu kunci demi kunci (ganti dengan spread →
  tes kunci persis harus merah).
- **Isi push:** `pesan-push.test.ts` dan `radar-notif.test.ts` mengharapkan kalimat Inggris §7.4 (dengan dan tanpa
  nama, kedua hubungan); pemeriksaan bahwa isi tidak memuat alamat, judul acara, lokasi, atau sel tetap.
- `pnpm -r test` dan `pnpm -r typecheck` hijau.

### 10.3 Uji di iPhone (Expo Go) — pemilik project

1. `npx expo start --go -c` di `apps/mobile` → splash "n" kuning di latar gelap (bila Expo Go menampilkannya — §11
   batas #3), lalu Beranda gelap dengan font Inter; alamat sendiri **singkat** mono + "Copy" → toast "Address
   copied", getar ringan; tempel di Notes → alamat **utuh**.
2. Ubah tampilan iPhone ke terang → aplikasi tetap gelap; teks isian tetap terbaca.
3. Kelima tab berpindah; tombol Salaman besar di tengah dan tidak menabrak home indicator; tab aktif kuning.
4. Salaman: mode QR berganti tiap 30 detik; pindah ke Pindai → kamera; pindah tab lalu kembali → kamera/QR tidak
   berjalan di latar (lampu kamera iOS mati saat tab lain). Pindai QR HP kedua (atau `apps/api/tools/peer.ts`) →
   haptic, sheet "You met 0x…" yang dalam ~1 detik berganti "You met ‹nama›" bila orang itu punya nama, dengan dua avatar, "✓ met in person", baris "Connected. 0x…"; kamera tidak memindai
   ulang selama sheet terbuka. "Scan someone else" → sheet tertutup, pemindai siap. Ulangi dengan HP ketiga (atau
   identitas `peer.ts` lain — satu pasangan hanya bisa salaman sekali, R8), lalu
   "View profile" → Profil orang itu terbuka dengan "✓ met in person". Di HP pemegang QR tidak ada sheet (§11 batas
   #7).
5. Detail acara "Scan the host's QR to check in" → tab Handshake mode Scan; check-in → toast, tetap di layar.
6. Profil orang yang pernah disalami di acara → Send message dan Want to meet terlihat tanpa menggulir, di atas kartu
   Trust; kartu Trust menampilkan tier besar di bawah label "Trust" kecil, ruas kosong batang terlihat jelas (abu
   `#56627d`); kartu "Meetings" menampilkan nama acara; "Vouched for by …" tampil bila ada penjamin yang juga
   koneksimu; Vouch/Report/Block paling bawah.
7. Radar di acara live dengan dua HP lain (satu koneksi, satu belum) → dua bagian, "here now", "N people visible
   here", "N mutual connections" hanya di kartu yang belum ditemui. Catat waktu muat radar (§8.5 jalur
   cadangan).
8. Kirim pesan dari HP lain → lencana tab Messages; isi notifikasi "New message from …"; ketuk notifikasi → tab
   Messages. Notifikasi radar (kalimat Inggris §7.4) → tab Events › Radar.
9. Ganti dompet dari tab Profile → layar Mulai tanpa tab bar, logo "n", "Know the people you've actually met"; buat
   dompet → Home.
10. Semua layar lain dibuka sekali: tidak ada teks gelap-di-atas-gelap, tidak ada nama rute mentah di header, tidak
    ada teks Indonesia (termasuk dialog konfirmasi dan galat).
11. **Huruf besar** (§3.7): Settings › Display & Brightness › Text Size dinaikkan dua takik di atas bawaan (±1,3×),
    lalu buka Beranda, Profil orang, Radar, Percakapan, Mulai, dan sheet salaman: teks penting membungkus, tidak
    terpotong; label tab dan lencana berhenti membesar; tidak ada tombol yang keluar layar. Kembalikan ukuran.
12. **Reduce Motion** (Settings › Accessibility › Motion): skeleton diam, toast dan sheet salaman muncul tanpa geser.
    Matikan lagi.
13. Tautan kecil ("See all ›", "Copy", "Report", "Block", "Handshake ›" di radar) dan tombol kirim bisa diketuk tanpa
    harus tepat; isi tidak pernah berada di bawah notch/Dynamic Island.

**Hasil uji iPhone (pemilik project, iOS 26, Expo Go):**

- 2026-09-19 — Rencana A: lulus; menemukan `aria-selected` untuk tab aktif dan syarat ScrollView untuk judul besar
  (amandemen §4.7).
- 2026-09-20 — Rencana B1 (Handshake, Beranda, Profil): lulus di gerbang uji B1.
- 2026-09-22 — Rencana B2 gerbang Task 9 (keamanan 12 kata M3, butir Minor B1, Acara, Radar): lulus.
- 2026-09-22 — uji penuh butir 1–13 plus Pesan, Lapor, Feed, Mulai: lulus, setelah satu temuan diperbaiki —
  judul besar iOS tidak tergambar di iOS 26 (header kosong sampai digulir), diselesaikan dengan header biasa
  (amandemen §4.7, commit `c2ca7f9` dan `f23e58f`).

## 11. Batas yang Diakui

1. **BNA UI belum terbukti di SDK 57 + pnpm monorepo + Expo Go.** Lima hal belum pasti di §3.6; spike §9 langkah 1
   memutuskan jalurnya. Hasil spike ditulis di sini. *Hasil spike repo (2026-09-18):* CLI, typecheck, dan bundel iOS
   lolos (rincian §3.6); uji tampil di Expo Go menunggu pemilik (rencana A Task 1). *Hasil (2026-09-21):* jalur BNA dipakai sampai akhir Rencana B2; tidak ada komponen dari jalur cadangan.
2. **Font dimuat async.** Splash tertahan sampai font siap; di jaringan Metro yang lambat splash bisa lebih lama dari
   sekarang. Font yang gagal dimuat jatuh ke font sistem tanpa galat — tampilan berbeda, aplikasi tetap jalan.
3. **Ikon dan splash tidak terlihat di Expo Go.** Expo Go memakai ikonnya sendiri dan tidak menjamin splash kustom
   proyek tampil; ikon adaptif Android dan splash baru terlihat penuh di build EAS (§14). Uji §10.3 butir 1 mencatat
   apa yang terlihat.
4. **reanimated + worklets di Expo Go** hanya bekerja pada versi JS yang persis cocok dengan modul native di dalam
   Expo Go SDK 57; `npx expo install` wajib, bukan `pnpm add` bebas. Pembaruan Expo Go di App Store bisa menuntut
   penyesuaian versi.
5. **Data baru membuka sedikit informasi:**
   - (a) memberi tahu pemanggil acara mana saja yang juga dihadiri orang yang pernah disalaminya. Check-in dan salaman
     sudah publik on-chain (`AttendanceRegistry`, `ConnectionRegistry`), jadi yang baru adalah **kemudahan** membacanya,
     bukan kerahasiaan yang terbuka; dibatasi pada pasangan yang sudah terkoneksi.
   - (b) memberi tahu **berapa** koneksimu yang menjamin seseorang. Dengan satu koneksi, angka 1 menunjuk orang itu
     (eliminasi). Vouch sudah publik on-chain; batas ini diterima dan tidak diberi ambang k-anonimitas.
   - (c) memberi tahu seberapa dekat graf orang asing di ruangan dengan grafmu. Graf koneksi sudah publik
     (`GET /connections/:address`, `/live`), dan angka hanya muncul untuk orang yang sama-sama memilih Terlihat di acara
     yang sama. Probe lewat blokir (blokir seseorang, lihat angka turun) hanya menyingkap hubungan yang sudah publik.
6. **"Jumlah kali" bukan jumlah salaman** (R8). Satu pasangan hanya punya satu salaman; lencana memakai jumlah acara
   bersama. Bila pemilik menginginkan hitungan salaman ulang, itu butuh keputusan terpisah: menerima salaman kedua
   pasangan yang sama sebagai "pertemuan" off-chain tanpa transaksi, mengubah jawaban `already_connected`, dan tabel
   baru — di luar fase ini.
7. **Pemegang QR tidak tahu salamannya berhasil** sampai membuka Profil/Beranda, dan **tidak mendapat sheet "You met
   …"** (#16D): hanya pemindai yang menerima respons `postAccept`, sedangkan `useRotatingQr` tidak punya polling atau
   langganan. Momen puncak hanya terasa di satu dari dua HP. Sama dengan hari ini; sinyal baru untuk sisi QR di luar
   lingkup (§12).
8. **Lencana tab bisa basi sampai 30 detik** (§4.4), dan tidak diperbarui oleh push yang tiba saat aplikasi terbuka
   kecuali tab berganti atau aplikasi kembali ke depan.
9. **Kartu "Recently met" dan layar Koneksi memuat nama per orang.** Beranda memakai 3 × 2 permintaan publik;
   layar Koneksi (hingga 100 baris) tetap menampilkan alamat seperti sekarang, karena `GET /connections/:address` tidak
   mengirim nama dan menambahkannya adalah perubahan API di luar tiga data baru.
10. **Radar menghitung koneksi bersama setiap 60 detik per penonton.** Untuk acara ratusan orang dengan penonton yang
    punya ratusan koneksi, kueri per kelompok bisa lambat; jalur cadangan §8.5.
11. **Tombol kembali dari Radar yang dibuka lewat notifikasi pulang ke daftar Acara, bukan Detail acara** (§4.5).
12. **Pengguna berbahasa Indonesia kini mendapat aplikasi berbahasa Inggris** — diterima pemilik (#15). Tidak ada
    pengalih bahasa; menambah bahasa kedua nanti berarti memperkenalkan kerangka i18n dan memindahkan setiap kalimat ke
    berkas terjemahan, di luar fase ini.
13. **`tierLabel` di kawat tetap bahasa Indonesia** ("Baru", "Dikenal", "Terpercaya", "Inti"). Siapa pun yang membaca
    API langsung (atau `/live` di `apps/web`, yang hanya memakainya sebagai kunci ukuran simpul) melihat string itu;
    aplikasi mobile tidak pernah menampilkannya (§7.4). Mengubahnya butuh perubahan `packages/trust` dan `apps/web`,
    keduanya di luar jalur.
14. **Teks izin `app.json` tidak terlihat di Expo Go**, yang memakai teks izinnya sendiri; kalimat Inggris §7.4 baru
    tampil di build EAS (sama dengan batas #3).
15. **Tag vouch lama tetap bahasa Indonesia** ("paham zk", "desainer", "riset") — isi yang ditandatangani tampil apa
    adanya; tag baru memakai saran Inggris, jadi satu makna bisa tercatat dalam dua bahasa.
16. **Penjaga bahasa hanya jaring kata umum** (§7.4); kalimat Indonesia tanpa kata di pola bisa lolos. Sapuan manual
    langkah 5(g) dan uji §10.3 butir 10 menutup sisanya.
17. **Sheet salaman sempat menampilkan alamat singkat sebelum nama** (R14): nama datang dari satu panggilan
    `GET /profile` setelah sheet terbuka; tanpa jaringan atau tanpa nama, judul tetap alamat singkat. Avatarmu
    sendiri di sheet memakai huruf dari alamat (layar Salaman tidak memuat namamu).
18. **Label tab dan lencana berhenti membesar di 1,3×** (§3.7) — dipilih demi tata letak tab bar; teks lain ikut
    ukuran sistem tanpa batas, dan pada ukuran aksesibilitas terbesar (di atas ±1,3×) tata letak hanya dijanjikan
    tidak memotong teks penting, bukan tetap rapi.
19. **Aturan §3.7 hanya sebagian dijaga tes.** Tes baca-kode memeriksa `allowFontScaling`, skala jarak literal,
    `fontSize` literal, bobot 500, dan beberapa label aksesibilitas; target sentuh, pembungkusan teks, Reduce Motion,
    dan safe area hanya diuji tangan di iPhone (§10.3 butir 11–13). Android (48 dp, bilah gestur) tidak diuji di fase
    ini karena uji perangkat hanya iPhone.

## 12. Di Luar Lingkup

- Tema terang, pengalih tema, mengikuti tema sistem.
- Animasi rumit (transisi bersama, gerak kartu radar, animasi QR) — hanya animasi bawaan komponen BNA dan `Modal`
  (sheet salaman, R13).
- Distribusi: development build, APK, TestFlight, EAS Build/Update — fase berikutnya; fase ini hanya menyiapkan ikon,
  splash, dan `version` (§14).
- Ekspor dan hapus data satu tap (spec induk §14 butir 8) — keputusan brainstorming sudah ada, spec belum ditulis.
- Tanda "sudah dibaca" untuk pengirim (R6), indikator mengetik, avatar foto (`pfp_url` belum dipakai).
- Nama tampilan di `GET /connections/:address`, salaman ulang, notifikasi "salamanmu berhasil" untuk pemegang QR —
  termasuk sheet "You met …" di sisi QR dan sinyal apa pun (polling, push, langganan) yang dibutuhkannya (#16D).
- Nama acara di sheet salaman, dan rute/perubahan API baru untuknya (R14; nama orang memakai `GET /profile` yang sudah ada).
- Animasi kustom untuk sheet salaman (avatar yang bertemu, konfeti, dll.) — hanya geser/pudar bawaan `Modal` (#16D).
- Perubahan kalimat di luar terjemahan, §7.3, dan §8 — termasuk teks contoh mockup yang berbeda dari kalimat yang ada
  (R5).
- Kerangka i18n, pengalih bahasa, bahasa kedua, dan mengikuti bahasa sistem (#15).
- Menerjemahkan `tierLabel` di kawat, `TIER_LABELS`, atau tag vouch yang sudah tercatat (§7.4).
- `apps/web` (landing, `/live`) — sudah berbahasa Inggris.

## 13. Batas Jalur

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` (termasuk `app.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `assets/`, `scripts/`) | `packages/contracts/**`, `packages/trust/**` (termasuk `TIER_LABELS`) |
| `apps/api/**` — termasuk teks push `src/pesan-push.ts`, `src/radar-notif.ts` dan tesnya (§7.4) | `apps/web/**` |
| `packages/shared/**` — **hanya bila** skema benar-benar dibutuhkan (rencana spec ini: tidak ada) | `.env` root, `apps/mobile/.env` (dibaca pun tidak) |
| `supabase/migrations/0009_*.sql` baru — **hanya** jalur cadangan §8.5 atas permintaan pemilik; diterapkan pemilik | migrasi `0001`–`0008` |
| `pnpm-lock.yaml` (akibat `expo install` / `bna-ui add`) | |
| `docs/superpowers/specs/*` (amandemen §15), `docs/demo/runbook.md` | |

Sesi eksekusi tidak menjalankan migrasi, tidak menyentuh Supabase, dan tidak mem-push.

## 14. Hubungan dengan Keputusan Distribusi

- Ikon (`icon.png`, `adaptive-icon.png`) dan splash (`splash-icon.png` + plugin `expo-splash-screen`) adalah bahan
  **build EAS** fase distribusi; di Expo Go keduanya tidak menentukan apa pun (§11 batas #3). Karena itu keduanya
  dibuat lengkap sekarang, dari satu sumber SVG, dengan skrip yang bisa diulang.
- `eas.json` sudah punya profil `development` dan `preview` (APK internal). Fase ini tidak mengubahnya.
- Modul native baru (reanimated, worklets, haptics, splash screen, system UI, clipboard) ada di Expo Go SDK 57, tetapi build EAS
  apa pun yang dibuat **sebelum** fase ini tidak memuatnya. `runtimeVersion.policy: "appVersion"` + `version` 0.2.0
  (R12) membuat EAS Update fase ini hanya sampai ke build 0.2.0 ke atas.
- `userInterfaceStyle: "dark"` dan warna latar akar adalah konfigurasi native: berlaku di build EAS setelah dibangun
  ulang, di Expo Go langsung.

## 15. Amandemen Spec Induk (dan spec 4b+5, 4a, 6)

Langkah 6 rencana implementasi memperbarui butir 1–4:

1. **`2026-09-03-nearly-design.md` §10.1** — paragraf baru "Amandemen (2026-09-18) — tampilan": tema selalu gelap
   (palet B2), Inter + JetBrains Mono, komponen BNA UI disalin ke `apps/mobile/components/ui/` (atau komponen sendiri
   bila spike gagal), navigasi 5 tab dengan Salaman di tengah; rujukan ke spec ini.
2. **§11** — catatan (2026-09-18) bahwa desain ulang UI/UX berjalan setelah dompet per pengguna, sebelum distribusi.
3. **§12** — `apps/mobile/src/handshake/` tetap alur terpenting; layar Salaman kini
   `apps/mobile/app/(tabs)/(salaman)/salaman.tsx` dengan mode di `components/salaman/`.
4. **`2026-09-14-nearly-fase-4b5-radar-design.md` §5.2** — catatan amandemen: `KartuRadar` mendapat `koneksiBersama?`
   (angka, hanya kartu yang belum ditemui, hanya ≥ 1), dengan aturan privasi §8.3 spec ini. Daftar "yang TIDAK PERNAH
   ada" tetap berlaku.
5. **`2026-09-14-nearly-fase-6-demo-design.md` keputusan #5** ("Bahasa landing page: Inggris (aplikasi tetap
   berbahasa Indonesia)") — diamandemen: aplikasi mobile kini berbahasa Inggris (#15, §7.4); landing tidak berubah.
6. **`2026-09-08-nearly-fase-4a-blokir-design.md` §8** ("Semua teks berbahasa Indonesia") — diamandemen: teks blokir
   diterjemahkan ke bahasa Inggris (Block / Unblock, §7.4) dengan register orang kedua yang sama.

Butir 5 dan 6 sudah dicatat di kedua berkas itu bersama perubahan spec ini (catatan satu baris yang menunjuk §7.4);
langkah 6 hanya memeriksa bahwa catatannya masih ada.

## 16. Langkah Berikutnya

1. Pemilik project me-review spec ini, terutama R4 (alamat singkat di kartu), R6 (tanpa "Dibaca"), R8 ("jumlah kali"),
   §11 batas #5, dan keputusan teknis bahasa di §7.4 (sapaan tiga bagian, format tanggal, saran tag vouch, kalimat push).
   **Review UI/UX sudah dilakukan dan diputuskan** (2026-09-18, keputusan #16 A–E): urutan Profil orang dan hierarki
   trust, warna ruas kosong `#56627d`, alamat singkat + Copy di Beranda (R4 diamandemen), sheet salaman berhasil
   (R13 `Modal`, R14 judul alamat singkat lalu nama lewat `GET /profile` publik, hanya sisi pemindai), dan aturan dasar §3.7. Hal-hal ini tidak dibuka ulang
   saat implementasi.
2. Rencana implementasi `docs/superpowers/plans/2026-09-18-nearly-desain-ui.md` di branch `desain-ui`, dieksekusi
   sesi `fcc`.
3. Langkah 1 (spike) dilaporkan ke pemilik sebelum langkah 2 dimulai; pemilik menjalankan uji iPhone spike.
4. Pemilik menjalankan uji iPhone §10.3 di akhir dan mengisi hasilnya.
5. *Catatan eksekusi (2026-09-21).* Rencana A (fondasi), B1 (Handshake, Beranda, Profil), dan B2 (Acara,
   Radar, Pesan, layar sisa, sapuan bahasa) tuntas di branch `desain-ui`. Keputusan rencana yang
   menyentuh teks spec: "Event created." dan "Posted." sebagai teks toast baru (Ruling B2-6 rencana B2),
   dan layar Mulai tanpa header (Ruling B2-17). Tombol "Copy address" di Dompet dan konfirmasi sebelum
   Unblock tidak dikerjakan (Ruling B2-5) — menunggu keputusan pemilik.
