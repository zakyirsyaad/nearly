# Nearly — Desain Ulang UI/UX Aplikasi Mobile: Design Spec

**Tanggal:** 2026-09-18
**Status:** keputusan disetujui pemilik project (2026-09-18, sesi brainstorming dengan mockup HTML), spec ini
menuliskannya; menunggu review tertulis
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
dibutuhkan layar kunci (riwayat pertemuan, penjamin yang kamu kenal, koneksi bersama di radar). Logika, kalimat, dan
perilaku layar yang ada tidak berubah kecuali yang disebut di spec ini (§2 keputusan #12).

## 2. Keputusan yang Terkunci

Diputuskan pemilik project (2026-09-18). Ditulis sesuai kata-kata pemilik; tidak dibuka ulang saat implementasi.

| # | Keputusan |
|---|---|
| 1 | **Karakter B2 "Seimbang":** gelap bernuansa teknis tapi berbahasa manusia; lencana "✓ terverifikasi"; trust sebagai batang; alamat mono hanya untuk alamat sendiri di beranda; detail on-chain saat kartu dibuka. |
| 2 | **Tema SELALU GELAP** (`app.json` `userInterfaceStyle: "dark"`; tidak ada tema terang). |
| 3 | **Navigasi N1:** 5 tab bawah — Beranda, Acara, Salaman (tombol kuning besar di tengah, radius 14), Pesan (lencana belum dibaca), Profil. |
| 4 | **Ikon I2:** huruf "n" hitam `#07090f` di latar kuning `#f3ba2f`; splash: "n" kuning di `#07090f`. Ekspor PNG 1024 + ikon adaptif Android. |
| 5 | **Font:** Inter (semua teks) + JetBrains Mono (hanya alamat, kode, angka teknis), via paket `@expo-google-fonts`. |
| 6 | **Pustaka komponen: BNA UI** (https://ui.ahmedbna.com) — gaya shadcn: `bna-ui add <komponen>` menyalin sumber ke repo (`components/ui/`), StyleSheet (bukan className), warna lewat `useColor(...)`, token di `@/theme/globals`, `ThemeProvider` di root layout, alias tsconfig `@/*`. Dependensi yang diketahui: `react-native-reanimated` (+ `react-native-worklets` untuk SDK 57), `expo-haptics`, `lucide-react-native` (`react-native-svg` sudah ada). Tema BNA dikunci gelap dan diisi palet B2. |
| 7 | **Token B2:** background `#07090f`, card `#0f1420`, border `#1d2638`, text `#e6edf7`, textMuted `#8a96ad`, primary `#f3ba2f`, primaryForeground `#07090f`, verified `#37d6a8`, destructive `#f06a6a`. Radius 8 kartu/tombol, 14 tombol Salaman; kartu bergaris tanpa bayangan; haptic saat salaman berhasil & tombol utama. |
| 8 | **Peta layar:** Beranda (sapaan, spanduk cadangan, acara LIVE, baru kamu temui, cuplikan feed → `feed/index`, `feed/new`); Acara (`events/index` → `events/[id]`, `radar/[eventId]`, `events/new`, `events/[id]/host-qr`); Salaman = SATU layar dua mode "Tampilkan QR ⟷ Pindai" menggabungkan `app/qr.tsx` + `app/scan.tsx` → setelah berhasil ke `profile/[address]`; Pesan (`pesan/index` → `pesan/[address]`, `pesan/lapor/[address]`); Profil (`profil-saya`: nama, alamat, trust, Terlihat/Tersembunyi → `connections`, `kecocokan`, `dompet`, `blokir`). Di luar tab: `mulai` (tanpa tab bar), `profile/[address]` dari mana saja. Ketuk notifikasi pesan → Pesan › Percakapan; radar → Acara › Radar. Tidak ada fitur hilang. |
| 9 | **Layar kunci** sesuai mockup layar kunci yang disetujui (Beranda, Salaman, Profil orang, Radar, Percakapan), dengan koreksi privasi #10. |
| 10 | **Data baru di fase ini (API ditambah):** (a) riwayat pertemuan di Profil orang (acara/tempat, kapan, jumlah kali) — hanya pertemuan antara penonton dan orang itu; (b) "Dijamin N orang yang juga kamu kenal" — jumlah penjamin (vouch) orang itu yang merupakan koneksimu; (c) "N koneksi bersama" di Radar untuk orang yang belum kamu temui — HANYA ANGKA tanpa nama, dan HANYA bila kedua pihak Terlihat; blokir dua arah tetap berlaku; (d) "hadir sejak <jam>" DIBUANG — cukup "hadir sekarang"; (e) "Kamu terlihat oleh N orang" DIGANTI "N orang terlihat di sini", dihitung dari kartu yang dikirim (`jumlah` yang ada); (f) batang trust BERTINGKAT per tier (4 ruas), bukan persentase — radar/profil tidak mengirim skor mentah. |
| 11 | **Pola layar lain:** daftar / formulir / detail; layar Mulai: logo "n" besar, kalimat "Kenali orang yang benar-benar kamu temui", tombol Buat dompet baru & Pakai dompet yang sudah ada. Empat keadaan seragam: memuat = skeleton; kosong = ikon + kalimat + aksi; galat = kalimat galat yang ada + Coba lagi; berhasil = toast hijau + haptic untuk aksi penting. |
| 12 | **Teks/kalimat, logika, dan perilaku layar yang ada TIDAK berubah** kecuali yang disebut di atas (fase ini tampilan + navigasi + 3 data baru). |
| 13 | **Urutan:** (1) spike BNA di monorepo SDK 57 — satu tombol BNA tampil di Expo Go; bila gagal, jatuh ke token + komponen sendiri; (2) fondasi tema/font/alias/ikon/splash; (3) navigasi tab + rute notifikasi; (4) API 3 data baru + tes privasi; (5) migrasi layar per kelompok: Salaman, Beranda, Profil, Acara+Radar, Pesan, sisanya; (6) dokumen & verifikasi. Eksekutor: sesi `fcc`. |
| 14 | **Pengujian:** tes baca-kode (tak ada warna hex di `app/` selain file tema; semua teks lewat komponen Text BNA; setiap TextInput lewat Input BNA — menggantikan `WARNA`/tes warna-isian; judul setiap layar tetap dijaga seperti `test/judul-layar.test.ts`), tes API dengan fake untuk 3 data baru termasuk kasus privasi (Tersembunyi, blokir dua arah, tidak ada nama di koneksi bersama), uji iPhone (Expo Go) oleh pemilik. |

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
  keputusan #1 "alamat mono hanya untuk alamat sendiri di beranda" dibaca sebagai: **alamat utuh** hanya untuk alamat
  sendiri di kepala Beranda dan di detail (Profil orang, Dompet); di kartu ringkas alamat orang lain tampil **singkat**
  di sebelah namanya, tidak pernah dihilangkan. Mockup kartu tanpa alamat dianggap ilustrasi.
- **R5. Kalimat yang sudah ada menang atas teks contoh di mockup.** Mockup menulis "Tunjukkan ke orang di depanmu",
  "berlaku 0:42", "Jamin (vouch)", "Trust tinggi"; layar tetap memakai kalimat yang ada ("Minta dia memindai ini.
  Berganti dalam N detik.", "Vouch", label tier `TIER_LABELS`). Teks **baru** hanya yang didaftar di §7.3.
- **R6. "Dibaca 19.42" di mockup Percakapan DIBUANG.** Tanda "sudah dibaca" untuk pengirim ada di daftar *di luar
  lingkup* spec 4c (baris "tanda sudah dibaca untuk pengirim, indikator mengetik, reaksi, grup"). Walau
  `dibacaAtMs` ikut terkirim di riwayat, menampilkannya ke pengirim adalah fitur privasi baru yang tidak diputuskan.
- **R7. "Tempat" pada riwayat pertemuan hanya nama acara + `venue_label` yang ditulis host.** Salaman di luar acara
  tampil sebagai "Bertemu langsung" tanpa tempat. Sel lokasi (`connections.cell`) tidak pernah dikirim ke HP — "tidak
  ada peta dengan pin orang" (spec induk §6 prinsip #2). Mockup "Kopi Kenangan Sudirman · 2 minggu lalu" tidak bisa
  diwujudkan dan dianggap ilustrasi.
- **R8. "Jumlah kali" diwujudkan sebagai jumlah acara yang kalian berdua hadiri (check-in), bukan jumlah salaman.**
  Salaman hanya bisa terjadi **sekali per pasangan, selamanya**: `connections_unique_pair` di
  `supabase/migrations/0001_init.sql` dan penolakan `already_connected` (409) di `apps/api/src/handshake-gate.ts`.
  Tidak ada data "bertemu 3 kali". Lencana menjadi "✓ bertemu langsung" ditambah " · N acara bersama" bila N ≥ 1
  (§8.1). Mencatat salaman ulang butuh perubahan perilaku handshake dan kontrak, dan tidak diambil (§11 batas #6).
- **R9. Lencana "✓ terverifikasi" berarti "kamu dan orang ini sudah salaman"** — koneksi yang tercatat setelah
  verifikasi ko-lokasi (spec induk §7.1). Bukan verifikasi identitas. Sumbernya `pernahBertemu` (radar), keanggotaan
  di `GET /connections/:address` (Beranda, Koneksi), dan `pertemuan !== null` (Profil orang).
- **R10. Isi tab dipasang hanya saat tab fokus bila isinya berjalan terus** (Salaman: QR berputar + kamera). Tab
  tetap terpasang saat berpindah tab; tanpa ini QR terus membuat offer tiap 30 detik dan kamera tetap menyala di
  latar (§4.6).
- **R11. PNG ikon dibuat dari SVG sumber oleh skrip yang ikut di-commit** (§3.5), bukan digambar tangan.
- **R12. `expo.version` naik ke `0.2.0`.** `runtimeVersion.policy` adalah `appVersion`; fase ini menambah modul
  native (reanimated, worklets, haptics, splash screen, system UI), jadi pembaruan EAS Update dari fase ini tidak boleh
  sampai ke build lama (§14).

## 3. Fondasi Visual

### 3.1 Token warna — `apps/mobile/theme/colors.ts`

Satu-satunya berkas TypeScript yang boleh memuat warna hex (dijaga tes §10.1). BNA memakai satu objek per skema;
**kedua** objek `light` dan `dark` diisi nilai yang sama persis, sehingga skema apa pun yang terbaca tidak pernah
menghasilkan warna terang.

| Token BNA / Nearly | Nilai | Dipakai untuk |
|---|---|---|
| `background` | `#07090f` | latar layar, latar splash |
| `card` | `#0f1420` | kartu, isian, segmen tak aktif |
| `border` | `#1d2638` | garis kartu, garis isian, ruas batang trust yang kosong |
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

- Paket: `@expo-google-fonts/inter` (400 Regular, 500 Medium, 600 SemiBold, 700 Bold) dan
  `@expo-google-fonts/jetbrains-mono` (400 Regular, 500 Medium), dimuat dengan `useFonts` di root layout.
- **React Native tidak memilih berkas font dari `fontWeight`** untuk font kustom. Komponen `Text` salinan BNA diubah
  agar varian/berat memetakan ke `fontFamily` (`Inter_700Bold`, …), dan `fontWeight` tidak diteruskan bersamaan
  (di Android keduanya bisa bertabrakan).
- Skala (dari mockup fondasi): 30 / 18 / 15 / 13, ditambah 11 untuk label kecil. Pemetaan ke varian BNA: `heading`
  30/700, `title` 18/600, `body` 15/400, `caption` 13/400 redup; varian tambahan `mono` (JetBrains Mono 13, redup) untuk
  alamat, kode, dan angka teknis. Nilai pasti per varian ditulis di `theme/globals.ts`.
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
| Tab bar | latar `#0b0f19`, garis atas `border`, label 10.5, aktif `primary`, tak aktif `textMuted` |
| Spanduk pengingat | latar `rgba(243,186,47,0.10)`, garis `rgba(243,186,47,0.40)`, teks `primary` |
| Tombol destruktif | latar `rgba(240,106,106,0.12)`, garis `rgba(240,106,106,0.35)`, teks `destructive` |
| Isian | latar `#0b0f19`, garis `border`; fokus: garis `primary`; placeholder `#6b778e` |
| Batang trust | tinggi 6 (5 di kartu kecil), radius 3, 4 ruas bercelah 2, terisi `verified`, kosong `border` |
| Lencana ✓ | garis 1 px `verified`, teks `verified` 11, radius 5 |

`#0b0f19` (latar isian dan tab bar) dan `#6b778e` (placeholder) diambil dari mockup fondasi; keduanya ikut masuk
`theme/colors.ts` sebagai token `input` dan `placeholder`.

- **Haptic** (`expo-haptics`): `notificationAsync(Success)` saat salaman berhasil dan saat toast berhasil lainnya
  (§7.2); getar ringan bawaan tombol BNA hanya untuk varian utama (`default`). Varian lain memakai `haptic={false}`.
- **Animasi:** hanya yang dibawa komponen BNA (skala tekan tombol, masuk/keluar toast, kilau skeleton). Tidak ada
  animasi buatan sendiri di fase ini.

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
  tanpa mengubah kalimat), `avoid-keyboard` (bila setara `src/hindari-keyboard.tsx`). BNA **tidak** punya komponen
  segmented control; pemilih mode Salaman dibuat sendiri di `components/segmen.tsx` dari `Pressable` + token.
- Setelah disalin, komponen BNA adalah **kode kita**: boleh disunting (font, haptic default, warna), dan disunting
  hanya lewat token.
- Dependensi dipasang dengan `npx expo install` (versi cocok SDK 57, dan cocok dengan modul native di dalam Expo Go):
  `react-native-reanimated`, `react-native-worklets`, `expo-haptics`, `lucide-react-native`, `expo-splash-screen`,
  `expo-system-ui`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`. Pohon pnpm saat ini sudah
  memuat `react-native-reanimated@4.6.0` dan `react-native-worklets@0.12.1` secara tidak langsung; keduanya dijadikan
  dependensi langsung `@nearly/mobile`.
- `ThemeProvider` BNA dibungkus di luar `DompetProvider` di `app/_layout.tsx`, bersama penyedia toast BNA.

**Hal BNA yang BELUM pasti** (dokumentasi daring hanya ringkas; diputuskan di spike, hasilnya dicatat di §11):

1. Letak `ThemeProvider` hasil salinan — dokumentasi menyebut `@/theme/theme-provider` di satu halaman dan
   `@/providers/theme-provider` di halaman lain.
2. Apakah `ThemeProvider` BNA membungkus `ThemeProvider` milik `@react-navigation/native` (yang di SDK 57 datang
   lewat `expo-router`) dan butuh impor langsung paket itu.
3. Apakah `Input` BNA meneruskan semua `TextInputProps` (`importantForAutofill`, `textContentType`, `keyboardType`,
   `secureTextEntry`, `autoComplete`) — dibutuhkan isian 12 kata (spec dompet §8 batas #12). Bila tidak, `Input`
   disunting agar meneruskannya.
4. Apakah `bna-ui` CLI berjalan di workspace pnpm (mendeteksi `apps/mobile` sebagai proyek Expo, tidak menulis ke
   akar monorepo), dan apa yang ditulisnya selain `components/ui/`.
5. Apakah ada plugin babel yang harus ditambahkan untuk reanimated 4 / worklets di SDK 57 (babel-preset-expo
   diharapkan sudah menyertakannya; tidak ada `babel.config.js` di repo sekarang).

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
`?mode=pindai`); `/qr` dan `/scan` hilang. Pemakai lama: tautan Beranda (ditulis ulang) dan `app/events/[id].tsx`
"Pindai QR host untuk check-in" → `/salaman?mode=pindai`.

### 4.2 Gerbang dompet

Pola `Stack.Protected` dua sisi dari spec dompet §5.1 **tetap**, hanya daftar layarnya yang berubah:

| Keadaan | Tampilan |
|---|---|
| `memuat` | splash tetap tampil (§3.5) |
| `galat` | kalimat galat yang ada + **Coba lagi**, tanpa navigator, dengan komponen BNA |
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

`TAB_BAWAH` di `src/judul-layar.ts` — satu sumber untuk urutan, label, dan grup:

| Urutan | Grup | Label | Ikon (lucide) | Catatan |
|---|---|---|---|---|
| 1 | `(beranda)` | Beranda | `House` | |
| 2 | `(acara)` | Acara | `CalendarDays` | |
| 3 | `(salaman)` | Salaman | `ArrowLeftRight` | `tabBarButton` kustom: kotak `primary` 52×52 radius 14, ikon `primaryForeground` |
| 4 | `(pesan)` | Pesan | `MessageCircle` | `tabBarBadge` = jumlah belum dibaca, disembunyikan bila 0 |
| 5 | `(profil)` | Profil | `CircleUser` | titik lencana bila ada kecocokan baru (§4.4) |

Nama ikon lucide diperiksa saat implementasi; yang mengikat adalah maknanya (⌂ ◷ ⇄ ✉ ◉ di mockup).

### 4.4 Lencana tab (pengganti lencana di daftar tautan beranda)

Beranda sekarang menandatangani dua bukti setiap kali dipasang: `kueriBuktiKecocokan` untuk angka "Saling ingin
bertemu" dan sesi pesan untuk `getBelumDibaca`. Keduanya pindah ke hook `useLencanaTab(signer)` di
`(tabs)/_layout.tsx` (dengan pola pembungkus):

- dimuat saat `(tabs)` terpasang, saat tab aktif berganti, dan saat aplikasi kembali ke depan (`AppState` `active`);
  paling sering **sekali per 30 detik**;
- kegagalan masing-masing menghasilkan 0 tanpa galat — perilaku yang sama dengan beranda sekarang ("Beranda tidak
  boleh gagal hanya karena lencana");
- angka Pesan → `tabBarBadge` Pesan; angka kecocokan baru → titik lencana tab Profil **dan** lencana di baris
  "Saling ingin bertemu" di layar Profil (kalimat `teksLencana` yang ada).
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
| Salaman | isi mode (QR berputar / kamera) dipasang **hanya saat tab fokus** (`useIsFocused` di komponen isi, bukan di pembungkus). Pindah tab = seperti keluar dari layar QR/Pindai hari ini: `useRotatingQr` berhenti, kamera dilepas. |
| Radar | sudah memakai `useFocusEffect` (detak & radar berhenti saat tidak fokus) — tetap. |
| Beranda | data dimuat saat fokus (`useFocusEffect`), paling sering sekali per 30 detik; setara "satu tanda tangan per pembukaan beranda" hari ini. |
| Pesan, Acara, Profil | memuat saat fokus dengan batas yang sama; layar yang sudah memuat saat dipasang tetap melakukannya. |

### 4.7 Judul layar

`JUDUL_LAYAR` sekarang berkunci **jalur berkas relatif `app/` tanpa `.tsx`, termasuk nama grup**:

```ts
export const JUDUL_LAYAR: Record<string, string> = {
  mulai: "Mulai",
  "profile/[address]": "Profil",
  "(tabs)/(beranda)/index": "Beranda",
  "(tabs)/(beranda)/feed/index": "Feed",
  "(tabs)/(beranda)/feed/new": "Unggahan baru",
  "(tabs)/(acara)/events/index": "Acara",
  "(tabs)/(acara)/events/new": "Buat acara",
  "(tabs)/(acara)/events/[id]": "Detail acara",
  "(tabs)/(acara)/events/[id]/host-qr": "QR check-in",
  "(tabs)/(acara)/radar/[eventId]": "Radar",
  "(tabs)/(salaman)/salaman": "Salaman",
  "(tabs)/(pesan)/pesan/index": "Pesan",
  "(tabs)/(pesan)/pesan/[address]": "Percakapan",
  "(tabs)/(pesan)/pesan/lapor/[address]": "Lapor",
  "(tabs)/(profil)/profil-saya": "Profil",
  "(tabs)/(profil)/connections": "Koneksi",
  "(tabs)/(profil)/kecocokan": "Kecocokan",
  "(tabs)/(profil)/dompet": "Dompet",
  "(tabs)/(profil)/blokir": "Diblokir",
};
```

- Judul lama dipertahankan kecuali tiga: `index` "Nearly" → "Beranda", `profil-saya` "Profil saya" → "Profil"
  (sama dengan label tab), dan `qr` "QR salaman" + `scan` "Pindai" → satu `salaman` "Salaman".
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
| `app/feed/index.tsx` | `(tabs)/(beranda)/feed/index.tsx` | Beranda | "Semua ›" cuplikan feed |
| `app/feed/new.tsx` | `(tabs)/(beranda)/feed/new.tsx` | Beranda | Feed "Tulis sesuatu" |
| `app/events/index.tsx` | `(tabs)/(acara)/events/index.tsx` | Acara | tab |
| `app/events/[id].tsx` | `(tabs)/(acara)/events/[id].tsx` | Acara | daftar acara, kartu LIVE Beranda |
| `app/radar/[eventId].tsx` | `(tabs)/(acara)/radar/[eventId].tsx` | Acara | Detail acara, kartu LIVE Beranda, notifikasi radar |
| `app/events/new.tsx` | `(tabs)/(acara)/events/new.tsx` | Acara | tombol "+ Buat acara" |
| `app/events/[id]/host-qr.tsx` | `(tabs)/(acara)/events/[id]/host-qr.tsx` | Acara | Detail acara (host) |
| `app/qr.tsx` + `app/scan.tsx` | `(tabs)/(salaman)/salaman.tsx` | Salaman | tab tengah, Detail acara (`?mode=pindai`), kartu radar "Salaman ›", keadaan kosong Beranda/Koneksi |
| `app/pesan/index.tsx` | `(tabs)/(pesan)/pesan/index.tsx` | Pesan | tab, notifikasi pesan |
| `app/pesan/[address].tsx` | `(tabs)/(pesan)/pesan/[address].tsx` | Pesan | daftar Pesan, Profil orang "Kirim pesan" |
| `app/pesan/lapor/[address].tsx` | `(tabs)/(pesan)/pesan/lapor/[address].tsx` | Pesan | Percakapan "Lapor" |
| `app/profil-saya.tsx` | `(tabs)/(profil)/profil-saya.tsx` | Profil | tab, Radar "Buka Profil saya" |
| `app/connections.tsx` | `(tabs)/(profil)/connections.tsx` | Profil | Profil, Beranda "Baru kamu temui · Semua ›" |
| `app/kecocokan.tsx` | `(tabs)/(profil)/kecocokan.tsx` | Profil | Profil |
| `app/dompet.tsx` | `(tabs)/(profil)/dompet.tsx` | Profil | Profil, spanduk cadangan Beranda |
| `app/blokir.tsx` | `(tabs)/(profil)/blokir.tsx` | Profil | Profil |
| `app/mulai.tsx` | `app/mulai.tsx` | — | gerbang, tanpa dompet |
| `app/profile/[address].tsx` | `app/profile/[address].tsx` | — (Stack akar) | Beranda, Radar, Koneksi, Kecocokan, Pesan, Feed, Salaman berhasil |

`router.push` ke rute tab lain berpindah ke tab itu (perilaku bawaan Tabs expo-router). Semua `href` di kode diperiksa
ulang terhadap tabel ini oleh tes §10.1 (href statis harus cocok dengan rute yang ada).

## 6. Layar Kunci

Kelima layar dari mockup layar kunci. Semua kartu mengikuti §3.4; semua nama orang mengikuti R4.

**Komponen bersama** (di `components/`, bukan `app/`):

- `KartuOrang` — avatar huruf awal (lingkaran 42, gradasi `#2a3550`→`border`, cincin `verified` bila terverifikasi,
  `#2a3550` bila belum), nama (`namaKartuRadar` — "Tanpa nama" untuk nama kosong), alamat singkat mono (`alamatSingkat`),
  lencana, baris keterangan redup, dan `BatangTrust` opsional.
- `BatangTrust({ tier })` — 4 ruas; ruas terisi = `tier + 1` (Baru = 1, Dikenal = 2, Terpercaya = 3, Inti = 4),
  **selalu** disertai label tier (`TIER_LABELS`) sebagai teks di sebelahnya atau sebagai `accessibilityLabel`.
  Tier tidak pernah tampil sebagai persentase atau angka skor.
- `tierDariLabel(label)` di `src/tier.ts` — `TIER_LABELS.indexOf(label)`, label tak dikenal → 0. Radar dan Pesan
  hanya mengirim label/tier, bukan skor (keputusan #10f), jadi batang dibangun dari itu.
- `Lencana` — varian `terverifikasi` ("✓ terverifikasi"), `ringkas` ("✓" saja, di radar), dan teks bebas (mis.
  "Saling ingin bertemu", kalimat `lencanaKartuRadar` yang ada).

### 6.1 Beranda — `(tabs)/(beranda)/index.tsx`

Urutan dari atas; setiap bagian memuat sendiri dan gagal sendiri (satu bagian gagal tidak menutup yang lain):

| Bagian | Isi | Sumber data (semua sudah ada) |
|---|---|---|
| Sapaan | "Selamat pagi/siang/sore/malam" (jam lokal: 04–10.59 pagi, 11–14.59 siang, 15–17.59 sore, selainnya malam), nama tampilan (varian `heading`), alamat sendiri **utuh** mono | nama: `GET /profile/:alamat-sendiri` `displayName`; kosong → baris nama tidak tampil, alamat tetap |
| Spanduk cadangan | `TEKS_PENGINGAT_CADANGAN` + " Buka Dompet ›", ke `/dompet` | `perluPengingatCadangan` (tidak berubah) |
| Acara LIVE | maks. 2 kartu acara yang sedang berlangsung: "● LIVE", `{checkins} hadir`, judul, lalu "Kamu sudah check-in · Buka radar ›" (ke `/radar/<id>`) bila `sudahCheckIn`, selainnya "Buka acara ›" (ke `/events/<id>`). Tidak ada acara live → bagian tidak tampil | `getDiscovery()` disaring `isEventLive`, lalu `getEvent(id, who, bukti)` dengan bukti yang sama seperti `events/[id]` |
| Baru kamu temui | judul bagian + "Semua ›" (ke `/connections`); maks. 3 `KartuOrang` terbaru: nama + alamat singkat, "✓ terverifikasi", waktu relatif (`kemarin`, `2 hari lalu`, tanggal), `BatangTrust` | `GET /connections/:alamat` (urut terbaru, sudah ada); per orang `GET /profile/:alamat` (nama) + `fetchTrust` (tier) — 3 × 2 permintaan publik |
| Feed | judul bagian + "Semua ›" (ke `/feed`); maks. 2 unggahan: nama penulis · waktu, teks terpotong 2 baris | `getFeed(kueriBuktiFeed(signer))` — bukti yang sama dengan layar Feed |

- Keadaan kosong "Baru kamu temui": kalimat yang ada "Belum ada koneksi. Koneksi hanya bisa dibuat dengan bertemu
  langsung." + aksi **Salaman** (ke tab Salaman).
- Daftar sepuluh tautan lama hilang; setiap tujuannya pindah ke tab (§5). Lencana Pesan dan kecocokan pindah ke tab
  (§4.4).
- Nama acara pada kartu "Baru kamu temui" (mockup "BNB Hack · kemarin") **tidak** ditampilkan di Beranda: ia hanya
  ada di riwayat pertemuan yang butuh bukti per orang (§8.1). Kartu cukup menampilkan waktu.

### 6.2 Salaman — `(tabs)/(salaman)/salaman.tsx`

**Perilaku sekarang** (dibaca dari kode, wajib dipertahankan):

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

- `SalamanIsi`: `Segmen` "Tampilkan QR" | "Pindai" (mode awal "Tampilkan QR"; `?mode=pindai` membuka Pindai), dan
  `useIsFocused()`; isi mode dirender **hanya saat fokus**.
- Mode **Tampilkan QR** = `QrScreenIsi` lama dipindah apa adanya ke `components/salaman/mode-qr.tsx` (menerima
  `signerSalaman`). Berganti mode atau tab melepasnya — interval berhenti; kembali ke mode ini memanggil `refresh`
  segera (efek pasang ulang), sama dengan membuka layar QR lagi hari ini. QR tampil di atas pelat `text` (`#e6edf7`)
  radius 12 supaya kontras pemindai terjaga di tema gelap; ukuran 260 tetap.
- Mode **Pindai** = `ScanIsi` lama dipindah apa adanya ke `components/salaman/mode-pindai.tsx` dengan kedua signer.
  Urutan check-in-lebih-dulu, penjaga `busy`, dan semua kalimat tidak berubah.
- **Perubahan perilaku yang diputuskan (keputusan #8):** saat `postAccept` berhasil —
  1. `Haptics.notificationAsync(Success)`;
  2. toast hijau berjudul **"Salaman berhasil"** dengan baris kedua kalimat yang ada "Terkoneksi. 0x1234…";
  3. `router.push("/profile/" + payload.initiator)` — Profil orang yang baru ditemui (di atas tab, R1); hasil
     dikosongkan sehingga kembali ke Salaman siap memindai lagi.
- Check-in berhasil **tidak** berpindah layar: hasil "Check-in berhasil. 0x1234…" tetap tampil seperti sekarang,
  ditambah toast hijau + haptic (§7.2).
- Pemegang QR (A) tetap tidak diberi tahu saat B berhasil memindai — tidak ada polling di `useRotatingQr` hari ini, dan
  menambahkannya di luar lingkup (§11 batas #7).
- Teks baru di layar ini: label segmen, dan catatan lokasi di mode QR "Lokasi kasar dipakai hanya untuk memastikan
  kalian berada di tempat yang sama" (sejalan dengan `NSLocationWhenInUseUsageDescription`).

### 6.3 Profil orang — `app/profile/[address].tsx`

Layar ini tetap satu-satunya pengecualian pola pembungkus (spec dompet §6: ia sudah menangani signer `null`).
Seluruh logika vouch, lapor, blokir, ingin bertemu, `loadError`, dan guliran ke isian tidak berubah; hanya tampilan
dan dua blok data baru.

Urutan:

1. Avatar besar (64), nama (`heading`), alamat/ENS **utuh** mono (seperti sekarang: ENS lalu alamat), lencana
   "✓ bertemu langsung" + " · N acara bersama" bila `pertemuan` ada (§8.1).
2. Kartu **Trust**: "Trust" + label tier, `BatangTrust`, baris bukti `tierView(...).evidenceLine` (sudah ada), lalu
   "Dijamin N orang yang juga kamu kenal" bila `dijaminKenalan ≥ 1` (§8.2). Nilai 0 atau absen → baris tidak tampil.
3. Kartu **Pertemuan** (hanya bila `pertemuan` ada): baris salaman ("Salaman di <acara> · <venue>" atau
   "Bertemu langsung", lalu tanggal), lalu baris "Hadir bersama · <acara> · <tanggal>" untuk `acaraBersama`.
4. Kartu **Detail on-chain** (B2: "detail on-chain saat kartu dibuka"): `{connectionCount} koneksi`,
   `{txCount} transaksi on-chain` — fakta yang sudah ada, dipindah ke kartunya sendiri.
5. Angka "ingin bertemu" dan tombolnya, "Kalian saling ingin bertemu." (tidak berubah).
6. Aksi: **Kirim pesan** (utama) dan tombol tanda ingin bertemu berdampingan; **Vouch** (sekunder) dengan pemilih
   tag; **Lapor**; **Blokir / Cabut blokir** (destruktif, teks). Label dan syarat tampil tidak berubah.

### 6.4 Radar — `(tabs)/(acara)/radar/[eventId].tsx`

Siklus detak 60 detik / radar 10 detik selama fokus dan seluruh penanganan keadaan tidak berubah.

- Kepala: judul "Radar" + pil "● Terlihat" (radar hanya tampil saat pemanggil Terlihat — gerbang spec 4b+5), lalu
  **"N orang terlihat di sini"** dengan N = `jumlah` dari respons (keputusan #10e) dan "Diperbarui <waktu relatif>"
  dari jam HP saat `getRadar` terakhir berhasil. "Kamu terlihat oleh N orang" **tidak** dipakai: angka itu
  mengklaim siapa yang melihatmu, padahal server hanya tahu siapa yang terlihat olehmu.
- Dua bagian dari urutan server (tanpa mengurutkan ulang): **"Koneksimu di sini"** (`pernahBertemu`) dan
  **"Belum kamu temui"** (sisanya), masing-masing dengan jumlah kartunya.
- Kartu: `KartuOrang` dengan nama + alamat singkat, lencana ✓ ringkas untuk koneksi, lencana `lencanaKartuRadar`
  yang ada ("Saling ingin bertemu"; "Pernah bertemu" digantikan ✓ ringkas karena bagiannya sudah mengatakannya),
  keterangan **"hadir sekarang"** (keputusan #10d — setiap kartu radar memang hadir dalam 15 menit terakhir; jam detak
  tidak pernah dikirim), `BatangTrust` dari `tierLabel`. Kartu "Belum kamu temui" menambah **"N koneksi bersama"**
  bila `koneksiBersama` ada (§8.3) dan tautan **"Salaman ›"** ke tab Salaman.
- Mengetuk kartu → `/profile/<alamat>` (seperti sekarang). Tetap tidak ada tombol pesan dan tidak ada peta.

### 6.5 Percakapan — `(tabs)/(pesan)/pesan/[address].tsx`

- Header: avatar + nama + alamat singkat, keterangan "🔒 terenkripsi ujung ke ujung" (fakta spec 4c), menu ⋯ berisi
  aksi yang sudah ada di layar ini (Lapor, Blokir) dengan kalimat yang sama.
- Gelembung: pesan masuk `card` bergaris di kiri; pesan keluar `primary` dengan teks `primaryForeground` di kanan;
  pemisah hari redup di tengah.
- Isian: `Input` BNA + tombol kirim `primary` 40×40 berikon panah; perilaku kirim, batas, dan galat tidak berubah.
- **Tidak ada "Dibaca …"** (R6).

## 7. Pola Layar Lain

### 7.1 Tiga pola

| Pola | Layar | Bentuk |
|---|---|---|
| **Daftar** | Acara, Feed, Pesan, Koneksi, Kecocokan, Diblokir | judul besar; aksi utama di kanan atas atau baris pertama ("+ Buat acara", "Tulis sesuatu"); baris = kartu bergaris; Acara menaruh acara LIVE di atas daftar |
| **Formulir** | Buat acara, Unggahan baru, Lapor, Profil (bagian nama & visibilitas), Mulai (isian 12 kata / kunci dev) | label kecil redup di atas `Input` BNA; peringatan dan penghitung karakter yang ada di bawah isian; tombol utama lebar penuh di bawah |
| **Detail** | Detail acara, QR check-in, Dompet, Profil orang | kepala (judul/nama), kartu fakta, aksi di bawah; aksi destruktif paling bawah dan berwarna `destructive` |

**Profil (tab)** = `profil-saya` diperluas: kepala (nama, alamat utuh mono, `{connectionCount} koneksi`, batang
trust + label dari `fetchTrust` alamat sendiri), lalu bagian nama & visibilitas yang sudah ada (Terlihat/Tersembunyi
dengan kalimat `kalimatVisibilitas` dan `KALIMAT_BATAS_TERSEMBUNYI`, tidak berubah), lalu daftar tautan: Koneksi,
Saling ingin bertemu (+ lencana), Dompet ("Alamat, 12 kata pemulihan, dan ganti dompet"), Diblokir.

**Mulai** (keputusan #11): logo "n" besar (`components/logo-n.tsx`, kuning di latar gelap), kalimat **"Kenali orang
yang benar-benar kamu temui"**, lalu tombol **Buat dompet baru** (utama) dan **Pakai dompet yang sudah ada (12 kata)**
(sekunder), tombol dev tetap di belakang `{__DEV__ && (`. Kalimat pembuka lama yang ada di bawah judul "Nearly"
digantikan kalimat ini; semua kalimat lain di layar Mulai (peringatan 12 kata, "Menyiapkan dompet…", galat)
tidak berubah, dan penjaga ketukan ganda, atribut isian Android, dan `textContentType="none"` tetap (dijaga
`gerbang-dompet.test.ts`).

### 7.2 Empat keadaan seragam

| Keadaan | Bentuk | Aturan |
|---|---|---|
| **Memuat** | `Skeleton` BNA berbentuk kartu/baris yang akan datang | menggantikan `ActivityIndicator` dan teks "Memuat…" di layar. Pengecualian: tombol yang sedang bekerja tetap memakai label sibuk yang ada ("Mengirim…", "Menyimpan…", "Menyiapkan dompet…") |
| **Kosong** | ikon lucide redup + kalimat kosong **yang ada** + satu aksi bila masuk akal | Koneksi & Beranda → Salaman; Acara → Buat acara; Feed → Tulis sesuatu; Kecocokan, Pesan, Diblokir → tanpa aksi. Aturan "daftar kosong di samping galat BUKAN keadaan kosong" (komentar di `kecocokan.tsx`, `blokir.tsx`, `pesan/index.tsx`) tetap |
| **Galat** | kalimat galat **yang ada** + tombol **Coba lagi** yang memuat ulang | layar yang sekarang tidak punya Coba lagi mendapatkannya; kalimatnya tidak berubah |
| **Berhasil** | `Toast` hijau (garis `verified`, ikon ✓) + `Haptics.notificationAsync(Success)` | hanya untuk aksi penting: salaman, check-in, vouch terkirim, acara dibuat, unggahan terkirim, profil disimpan, laporan terkirim. Kalimat toast = kalimat berhasil yang ada; pesan yang sekarang tampil sebagai teks di bawah tombol pindah ke toast — kecuali hasil pindai check-in, yang tetap tampil di layar bersama tombol "Pindai lagi" (§6.2). `Alert.alert` konfirmasi (Ganti dompet, Lihat 12 kata, Laporan terkirim → Blokir?) tetap dialog |

### 7.3 Teks baru yang diizinkan

Selain teks di daftar ini dan kalimat data baru §8, setiap kalimat berasal dari kode yang ada (keputusan #12, R5):

- Label tab: Beranda, Acara, Salaman, Pesan, Profil.
- Sapaan "Selamat pagi/siang/sore/malam"; judul bagian "Baru kamu temui", "Feed", "Koneksimu di sini",
  "Belum kamu temui", "Trust", "Pertemuan", "Detail on-chain"; tautan "Semua ›", "Buka radar ›", "Buka acara ›",
  "Buka Dompet ›", "Salaman ›"; "● LIVE"; "Kamu sudah check-in".
- Salaman: "Tampilkan QR", "Pindai", catatan lokasi (§6.2), toast "Salaman berhasil".
- Radar: "N orang terlihat di sini", "Diperbarui …", "hadir sekarang", "N koneksi bersama", pil "Terlihat".
- Lencana: "✓ terverifikasi", "✓ bertemu langsung", " · N acara bersama".
- Profil orang: "Dijamin N orang yang juga kamu kenal", "Salaman di …", "Bertemu langsung", "Hadir bersama · …".
- Percakapan: "🔒 terenkripsi ujung ke ujung".
- Mulai: "Kenali orang yang benar-benar kamu temui".
- Waktu relatif: "baru saja", "N menit lalu", "N jam lalu", "kemarin", "N hari lalu", lalu tanggal `id-ID`.

Semua kalimat baru ditaruh di fungsi/konstanta murni `src/` (pola `src/messages.ts`), diuji di vitest, bukan ditulis
di JSX.

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
  `blokir.himpunanUntuk(pemanggil)` (dua arah).
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
- **Blokir dua arah:** pasangan terblokir tidak punya kartu (sudah ada). Selain itu, alamat di
  `himpunanUntuk(pemanggil)` **tidak dihitung sebagai koneksi bersama**, supaya orang yang kamu blokir (atau yang
  memblokirmu) tidak muncul sebagai angka di kartu orang lain.
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

- (d) "hadir sekarang": teks tetap di HP. Jam detak (`seen_at`) tetap tidak pernah dikirim.
- (e) "N orang terlihat di sini": `jumlah` sudah ada dan sudah = jumlah kartu yang dikirim (bukan sebelum penyaringan).
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
2. **Fondasi:** `theme/colors.ts` + `globals.ts`, tema dikunci gelap, font + splash, `app.json` (tema, ikon, splash,
   `version` 0.2.0), skrip ikon + PNG, `components/` bersama (KartuOrang, BatangTrust, Lencana, Segmen, LogoN), hapus
   `src/warna.ts`. Layar belum dipindah.
3. **Navigasi:** pohon §4.1 (`git mv` supaya riwayat berkas terjaga), `(tabs)/_layout.tsx` + tab bar, Stack per tab
   dengan `unstable_settings`, `JUDUL_LAYAR`/`layarDalam`/`TAB_BAWAH`, gerbang dompet dengan daftar baru,
   `useLencanaTab`, Salaman sementara merender dua komponen lama berdampingan. Semua tes lama yang bergantung pada
   jalur diperbarui di langkah ini (§10.1).
4. **API tiga data baru** + tes fake dan tes privasi (§10.2). Tidak menyentuh HP.
5. **Migrasi layar per kelompok**, satu commit per kelompok: (a) Salaman; (b) Beranda; (c) Profil (tab) + Profil orang;
   (d) Acara + Radar; (e) Pesan; (f) sisanya (Feed, Unggahan baru, Buat acara, QR check-in, Koneksi, Kecocokan,
   Dompet, Diblokir, Lapor, Mulai, keadaan galat gerbang). Tes penjaga §10.1 yang bersifat "seluruh `app/`" dinyalakan
   di akhir (f); sebelum itu berlaku untuk berkas yang sudah dimigrasi (daftar eksplisit di tes).
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
    persis seperti §3.1;
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
  penjaga `busy` ada; `postAccept` berhasil diikuti `Haptics.notificationAsync` dan
  `router.push(\`/profile/${payload.initiator}\`)`; check-in berhasil **tidak** berpindah layar; isi mode dirender di
  balik `useIsFocused`; pembungkus hanya memanggil hook dompet.
- **`rute-push.test.ts` (ditambah):** `"/pesan"` dan `/radar/<id>` cocok dengan berkas di `app/` setelah segmen grup
  `(…)` dibuang.
- **`tautan.test.ts` (baru, baca-kode):** setiap `href="…"` dan `router.push("…")` statis di `app/**` dan
  `components/**` menunjuk rute yang ada; tidak ada lagi `/qr` atau `/scan`.
- **Fungsi murni baru:** `tierDariLabel` (empat label + tak dikenal), ruas batang `tier + 1`, sapaan per jam (batas
  04.00, 11.00, 15.00, 18.00), waktu relatif, kalimat pertemuan (`null`, tanpa acara, dengan acara, dengan venue
  kosong, 0/1/N acara bersama), "Dijamin N…" (0 → `null`), "N koneksi bersama" (absen → `null`), "N orang terlihat di
  sini", pemisahan kartu radar ke dua bagian tanpa mengubah urutan.
- Tes lama lain tetap hijau tanpa diubah maknanya.

### 10.2 Tes otomatis — `apps/api` (vitest dengan fake `support/*`)

- **Profil — `pertemuan`:** tanpa bukti → kunci `pertemuan` dan `dijaminKenalan` **absen** dan respons publik
  identik byte demi byte dengan sebelum fase ini; bukti sah + terkoneksi → `pertemuan.salaman.atMs` benar; salaman di
  dalam acara yang keduanya check-in dan di dalam geofence → `acara` terisi; di luar jendela waktu, di luar geofence,
  atau hanya satu pihak check-in → `acara: null`; `acaraBersama` tanpa acara salaman, urut terbaru, maks. 10,
  `jumlahAcaraBersama` total; tidak terkoneksi → `null`; profil sendiri → `null`; himpunan kunci `pertemuan` persis
  (tidak ada `cell`, `txHash`, `host`); store gagal → kunci absen, profil tetap 200.
- **Profil — `dijaminKenalan`:** hanya vouch aktif (vouch dicabut tidak dihitung); hanya penjamin yang terkoneksi
  dengan pemanggil; pemanggil yang juga menjamin tidak menghitung dirinya; penjamin yang diblokir pemanggil **dan**
  yang memblokir pemanggil tidak dihitung; nilai 0 dikirim sebagai `0` (kunci ada); store gagal → kunci absen.
- **Radar — `koneksiBersama`:** hanya pada kartu `pernahBertemu === false`; absen bila 0; hitungan benar untuk graf
  kecil yang ditulis tangan; koneksi bersama yang diblokir pemanggil (dua arah) tidak dihitung; kandidat Tersembunyi
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
- `pnpm -r test` dan `pnpm -r typecheck` hijau.

### 10.3 Uji di iPhone (Expo Go) — pemilik project

1. `npx expo start --go -c` di `apps/mobile` → splash "n" kuning di latar gelap (bila Expo Go menampilkannya — §11
   batas #3), lalu Beranda gelap dengan font Inter; alamat sendiri mono.
2. Ubah tampilan iPhone ke terang → aplikasi tetap gelap; teks isian tetap terbaca.
3. Kelima tab berpindah; tombol Salaman besar di tengah; tab aktif kuning.
4. Salaman: mode QR berganti tiap 30 detik; pindah ke Pindai → kamera; pindah tab lalu kembali → kamera/QR tidak
   berjalan di latar (lampu kamera iOS mati saat tab lain). Pindai QR HP kedua (atau `apps/api/tools/peer.ts`) →
   haptic, toast "Salaman berhasil", Profil orang itu terbuka dengan "✓ bertemu langsung".
5. Detail acara "Pindai QR host untuk check-in" → tab Salaman mode Pindai; check-in → toast, tetap di layar.
6. Profil orang yang pernah disalami di acara → kartu Pertemuan menampilkan nama acara; "Dijamin N…" tampil bila ada
   penjamin yang juga koneksimu.
7. Radar di acara live dengan dua HP lain (satu koneksi, satu belum) → dua bagian, "hadir sekarang", "N orang
   terlihat di sini", "N koneksi bersama" hanya di kartu yang belum ditemui. Catat waktu muat radar (§8.5 jalur
   cadangan).
8. Kirim pesan dari HP lain → lencana tab Pesan; ketuk notifikasi → tab Pesan. Notifikasi radar → tab Acara › Radar.
9. Ganti dompet dari tab Profil → layar Mulai tanpa tab bar, logo "n", kalimat baru; buat dompet → Beranda.
10. Semua layar lain dibuka sekali: tidak ada teks gelap-di-atas-gelap, tidak ada nama rute mentah di header.

## 11. Batas yang Diakui

1. **BNA UI belum terbukti di SDK 57 + pnpm monorepo + Expo Go.** Lima hal belum pasti di §3.6; spike §9 langkah 1
   memutuskan jalurnya. Hasil spike ditulis di sini.
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
7. **Pemegang QR tidak tahu salamannya berhasil** sampai membuka Profil/Beranda; hanya pemindai yang pindah ke Profil
   orang. Sama dengan hari ini.
8. **Lencana tab bisa basi sampai 30 detik** (§4.4), dan tidak diperbarui oleh push yang tiba saat aplikasi terbuka
   kecuali tab berganti atau aplikasi kembali ke depan.
9. **Kartu "Baru kamu temui" dan layar Koneksi memuat nama per orang.** Beranda memakai 3 × 2 permintaan publik;
   layar Koneksi (hingga 100 baris) tetap menampilkan alamat seperti sekarang, karena `GET /connections/:address` tidak
   mengirim nama dan menambahkannya adalah perubahan API di luar tiga data baru.
10. **Radar menghitung koneksi bersama setiap 60 detik per penonton.** Untuk acara ratusan orang dengan penonton yang
    punya ratusan koneksi, kueri per kelompok bisa lambat; jalur cadangan §8.5.
11. **Tombol kembali dari Radar yang dibuka lewat notifikasi pulang ke daftar Acara, bukan Detail acara** (§4.5).

## 12. Di Luar Lingkup

- Tema terang, pengalih tema, mengikuti tema sistem.
- Animasi rumit (transisi bersama, gerak kartu radar, animasi QR) — hanya animasi bawaan komponen BNA.
- Distribusi: development build, APK, TestFlight, EAS Build/Update — fase berikutnya; fase ini hanya menyiapkan ikon,
  splash, dan `version` (§14).
- Ekspor dan hapus data satu tap (spec induk §14 butir 8) — keputusan brainstorming sudah ada, spec belum ditulis.
- Tanda "sudah dibaca" untuk pengirim (R6), indikator mengetik, avatar foto (`pfp_url` belum dipakai).
- Nama tampilan di `GET /connections/:address`, salaman ulang, notifikasi "salamanmu berhasil" untuk pemegang QR.
- Perubahan kalimat di luar §7.3 dan §8 — termasuk teks contoh mockup yang berbeda dari kalimat yang ada (R5).
- `apps/web` (landing, `/live`).

## 13. Batas Jalur

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` (termasuk `app.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `assets/`, `scripts/`) | `packages/contracts/**`, `packages/trust/**` |
| `apps/api/**` | `apps/web/**` |
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
- Modul native baru (reanimated, worklets, haptics, splash screen, system UI) ada di Expo Go SDK 57, tetapi build EAS
  apa pun yang dibuat **sebelum** fase ini tidak memuatnya. `runtimeVersion.policy: "appVersion"` + `version` 0.2.0
  (R12) membuat EAS Update fase ini hanya sampai ke build 0.2.0 ke atas.
- `userInterfaceStyle: "dark"` dan warna latar akar adalah konfigurasi native: berlaku di build EAS setelah dibangun
  ulang, di Expo Go langsung.

## 15. Amandemen Spec Induk (dan spec 4b+5)

Langkah 6 rencana implementasi memperbarui:

1. **`2026-09-03-nearly-design.md` §10.1** — paragraf baru "Amandemen (2026-09-18) — tampilan": tema selalu gelap
   (palet B2), Inter + JetBrains Mono, komponen BNA UI disalin ke `apps/mobile/components/ui/` (atau komponen sendiri
   bila spike gagal), navigasi 5 tab dengan Salaman di tengah; rujukan ke spec ini.
2. **§11** — catatan (2026-09-18) bahwa desain ulang UI/UX berjalan setelah dompet per pengguna, sebelum distribusi.
3. **§12** — `apps/mobile/src/handshake/` tetap alur terpenting; layar Salaman kini
   `apps/mobile/app/(tabs)/(salaman)/salaman.tsx` dengan mode di `components/salaman/`.
4. **`2026-09-14-nearly-fase-4b5-radar-design.md` §5.2** — catatan amandemen: `KartuRadar` mendapat `koneksiBersama?`
   (angka, hanya kartu yang belum ditemui, hanya ≥ 1), dengan aturan privasi §8.3 spec ini. Daftar "yang TIDAK PERNAH
   ada" tetap berlaku.

## 16. Langkah Berikutnya

1. Pemilik project me-review spec ini, terutama R4 (alamat singkat di kartu), R6 (tanpa "Dibaca"), R8 ("jumlah kali"),
   dan §11 batas #5.
2. Rencana implementasi `docs/superpowers/plans/2026-09-18-nearly-desain-ui.md` di branch `desain-ui`, dieksekusi
   sesi `fcc`.
3. Langkah 1 (spike) dilaporkan ke pemilik sebelum langkah 2 dimulai; pemilik menjalankan uji iPhone spike.
4. Pemilik menjalankan uji iPhone §10.3 di akhir dan mengisi hasilnya.
