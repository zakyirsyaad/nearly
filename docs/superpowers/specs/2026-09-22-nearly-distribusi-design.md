# Nearly — Distribusi Aplikasi (Android dulu, iPhone disiapkan)

**Tanggal:** 2026-09-22 · **Status:** disetujui pemilik (rencana di sesi perencanaan 2026-09-22)
**Menyusul:** desain ulang UI (spec 2026-09-18, PR #5, merged `db20f48`).
**Keputusan asal:** brainstorming distribusi 2026-09-18 (dicatat di memori project, belum pernah ditulis sebagai spec — dokumen ini yang menuliskannya).

## 1. Tujuan

Orang lain bisa memasang dan memakai Nearly **tanpa Expo Go dan tanpa akun Expo**: unduh, pasang, buat dompet, salaman, terima notifikasi pesan. Expo Go SDK 57 di iOS mewajibkan login akun Expo yang sama dengan pemilik project, jadi Expo Go tidak dipakai untuk peserta.

## 2. Keputusan terkunci

| # | Keputusan |
|---|---|
| D1 | **Dua tahap.** Tahap 1 (rencana ini): Android — APK dari EAS Build, profil `preview`, diunduh langsung. Tahap 2 (menunggu Apple Developer Program $99/th): iPhone lewat TestFlight dengan tautan publik. Tahap 1 menyiapkan konfigurasi tahap 2 tanpa menjalankannya. |
| D2 | **API online di VPS pemilik dengan HTTPS** di `api.<domain>` (runbook §1 apa adanya: Node 24, systemd, Caddy + Let's Encrypt). APK rilis Android menolak `http://`; tidak ada pengecualian cleartext. |
| D3 | **Domain dibeli pemilik.** Tata letak: `<domain>` (dan `www`) → web di Vercel; `api.<domain>` → API di VPS; `unduh.<domain>` → berkas APK di VPS. |
| D4 | **APK di-host di VPS** (Caddy `file_server`, `https://unduh.<domain>/nearly.apk`). Alasan: tautan stabil (artefak EAS Build kedaluwarsa), tidak terkena batas ukuran berkas Vercel, dan satu tempat yang sudah diurus runbook §1. |
| D5 | **Notifikasi push disertakan.** Jalur kode sudah lengkap (spec 4c §7): aplikasi mendaftarkan Expo push token ke `POST /pesan/token-push`, API mengirim lewat Expo Push API. Yang ditambah: proyek Firebase gratis, `google-services.json`, kunci akun layanan FCM V1 diunggah ke EAS, plugin `expo-notifications`, dan kanal Android. |
| D6 | **Nilai `EXPO_PUBLIC_*` hanya di EAS environment variables** (environment `development`/`preview`/`production`), tidak di `eas.json` dan tidak di git. Blok `env` berisi IP LAN dihapus dari `eas.json`. |
| D7 | **`google-services.json` tidak di-commit.** Disimpan sebagai EAS file variable `GOOGLE_SERVICES_JSON`; `app.config.ts` memakainya bila ada, lalu jatuh ke `./google-services.json` lokal bila berkas itu ada, dan tidak memasang apa pun bila keduanya tidak ada (Expo Go dan `expo export` tetap jalan). |
| D8 | **EAS Update dipasang** (`expo-updates`). Kanal `preview` untuk APK peserta, `production` untuk tahap 2 / toko. `runtimeVersion.policy: appVersion` tetap: perubahan hanya-JS dikirim dengan `eas update`, perubahan native menaikkan `version` lalu build ulang. |
| D9 | **Ikon dan splash tidak dibuat ulang.** Aset yang ada (`assets/sumber/n.svg` → `scripts/buat-ikon.mjs`, commit 88f24b3) sudah memakai token akhir (`primary #f3ba2f`, `background #07090f`, `theme/colors.ts`). Ditambah satu aset: ikon notifikasi Android 96×96, "n" putih di atas transparan. |
| D10 | **Web mendapat bagian "Get the app"** di landing: tombol unduh APK dari `VITE_APK_URL` (hanya `https://`; bagian tidak tampil bila kosong), langkah singkat memasang APK, dan baris "iPhone: coming soon". Bahasa Inggris, mengikuti aturan salinan landing (tanpa klaim tanpa rujukan). |
| D11 | **`versionCode` Android dinaikkan otomatis** (`appVersionSource: remote` + `autoIncrement`) supaya APK baru bisa dipasang di atas APK lama tanpa copot-pasang (dompet di SecureStore tetap ada). |
| D12 | **`apps/api` tidak berubah.** Pesan push tanpa `channelId` diantar Expo ke kanal Android `default`; aplikasi membuat kanal itu sendiri (§4.2), jadi API tidak perlu diubah. |

## 3. Di luar lingkup

- Google Play Store dan App Store (profil `production` disiapkan, tidak dijalankan).
- Build iOS dan TestFlight (tahap 2, §7).
- Ekspor/hapus akun (ditunda, keputusan terpisah).
- Mainnet. Kontrak tetap di BNB Smart Chain testnet.

## 4. Perubahan kode

### 4.1 Konfigurasi build
- `app.config.ts` (baru) membungkus `app.json` dan hanya menambah `android.googleServicesFile` sesuai D7.
- `app.json`: plugin `["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#f3ba2f" }]`.
- `eas.json`: profil `development` (dev client, APK), `preview` (APK, kanal `preview`), `production` (Android `app-bundle`, iOS, kanal `production`); `autoIncrement` di `preview` dan `production`; tanpa blok `env`.
- `expo-updates` dipasang dengan `npx expo install expo-updates` — satu-satunya dependensi baru.
- `.gitignore`: `apps/mobile/google-services.json` dan `GoogleService-Info.plist`.

### 4.2 Push (`src/pesan/push.ts`)
Di Android, kanal `default` dibuat **sebelum** izin diminta (Android 13 hanya menampilkan dialog izin bila kanal sudah ada — dokumentasi expo-notifications SDK 57). Nama kanal yang dilihat pengguna di Pengaturan: **"Messages and Radar"**; kepentingan `HIGH`. Selebihnya perilaku tetap (best-effort, sekali per buka aplikasi, galat tidak pernah tampil ke pengguna).

### 4.3 Web
`src/unduhan.ts` (`tautanApk`) + bagian "Get the app" di `Landing.tsx` (D10).

### 4.4 Deploy
`deploy/Caddyfile` mendapat blok `{$NEARLY_DOWNLOAD_HOST}` yang melayani `/srv/nearly/unduh` dengan `Content-Type: application/vnd.android.package-archive` dan `Cache-Control: no-cache` untuk `*.apk`.

### 4.5 Dokumen
Runbook: §1 ditambah penyiapan `unduh.<domain>`; §3 ditulis ulang untuk EAS (env, Firebase, build, unggah APK, update); §8 baru untuk iPhone/TestFlight. `.env.example` menjelaskan bahwa `apps/mobile/.env` hanya untuk Metro lokal.

## 5. Langkah operasional pemilik (urutan)

1. Beli domain; record A `api` dan `unduh` → IP VPS; root/`www` → Vercel.
2. VPS sesuai runbook §1 (termasuk §1.7 unduhan). Periksa `https://api.<domain>/health`.
3. Firebase: proyek baru → app Android `app.nearly.mobile` → unduh `google-services.json` → `eas env:create --type file`. Kunci akun layanan (FCM V1) → `eas credentials`.
4. EAS env `preview`: `EXPO_PUBLIC_API_URL=https://api.<domain>` + tiga alamat kontrak.
5. `eas build -p android --profile preview` → unduh APK → `scp` ke `/srv/nearly/unduh/nearly.apk`.
6. Vercel: `VITE_API_URL`, `VITE_APK_URL=https://unduh.<domain>/nearly.apk`, redeploy.
7. Uji penerimaan §6.

## 6. Kriteria penerimaan

1. `pnpm -r test` dan `pnpm -r typecheck` hijau; `npx expo export` berhasil.
2. APK terpasang dari tautan di web pada HP Android nyata; aplikasi terbuka tanpa galat konfigurasi.
3. Buat dompet, salaman dengan perangkat kedua, koneksi tercatat on-chain.
4. Pesan dari perangkat kedua memunculkan notifikasi saat aplikasi di latar belakang; ketuk → Percakapan.
5. `eas update --channel preview` kecil sampai ke HP setelah aplikasi dibuka ulang dua kali.
6. APK baru terpasang di atas APK lama; dompet tetap ada.

## 7. Tahap 2 — iPhone (disiapkan, belum dijalankan)

- Prasyarat: Apple Developer Program ($99/th). Tidak perlu Mac dengan Xcode: EAS membangun di cloud dan membuat sertifikat, profil provisioning, dan kunci APNs.
- `eas build -p ios --profile production` → `eas submit -p ios` (menanyakan App Store Connect app secara interaktif; `ascAppId` baru ditulis ke `eas.json` setelah app dibuat).
- TestFlight: grup penguji eksternal + tautan publik (maks. 10.000 penguji), satu kali Beta App Review (±1–2 hari).
- `bundleIdentifier` `app.nearly.mobile` dan teks izin kamera/lokasi sudah ada di `app.json`. Push iOS memakai APNs lewat Expo; kode aplikasi tidak berubah.
- Web: baris "iPhone: coming soon" diganti tautan TestFlight.
