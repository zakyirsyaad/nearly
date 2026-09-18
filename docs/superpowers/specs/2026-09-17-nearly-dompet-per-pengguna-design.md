# Nearly — Dompet per Pengguna (dibuat di HP): Design Spec

**Tanggal:** 2026-09-17
**Status:** rencana disetujui pemilik project (2026-09-17), spec ini menuliskannya; menunggu review tertulis
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Berkaitan:** spec Fase 4c (`2026-09-13-nearly-fase-4c-pesan-design.md`) §11.4 — kunci pesan butuh tanda tangan deterministik

---

## 1. Posisi dalam Roadmap

Semua fase fitur (0–6) tuntas secara kode, tetapi aplikasi mobile masih memakai **satu kunci privat
pengembangan yang ikut terbundel**: `EXPO_PUBLIC_DEV_PRIVATE_KEY` → `CONFIG.devPrivateKey` →
`createDevSigner(CONFIG.devPrivateKey!, …)` di 17 layar. Akibatnya:

- setiap orang yang membuka aplikasi adalah **orang yang sama** — dua peserta hackathon tidak bisa
  bersalaman, dan graf di layar `/live` tidak pernah tumbuh;
- kunci itu terbaca oleh siapa pun yang memegang bundel aplikasi.

Ini penghalang terbesar sebelum demo dengan peserta sungguhan. Spec induk §10.1 menjanjikan
"connect wallet yang sudah ada" sebagai jalur utama, tetapi jalur itu tidak bisa dijalankan hari ini:
aplikasi tetap di **Expo Go** dan pemilik project belum punya Apple Developer Program, sehingga dompet
luar (MetaMask, WalletConnect) dan dompet tersemat (Privy dan sejenisnya) tidak tersedia. Spec ini
menggantinya dengan **dompet yang dibuat otomatis di HP**, dan mengamandemen §10.1 (§12).

## 2. Keputusan yang Terkunci

Diputuskan pemilik project (2026-09-17). Tidak dibuka ulang saat implementasi.

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Platform | Tetap **Expo Go** — tanpa development build, tanpa akun Apple |
| 2 | Asal dompet | **Dibuat otomatis di HP**; tidak ada rencana menyambung dompet luar |
| 3 | Cadangan | **12 kata pemulihan bisa dilihat kapan saja**, tidak wajib di awal |
| 4 | Impor | **Impor 12 kata** untuk memakai alamat yang sudah ada (panitia, juri, seed) |
| 5 | Kunci dev | Dihapus dari aplikasi; identitas uji lama dipakai lewat **impor kunci privat khusus `__DEV__`** |
| 6 | Paket baru | Hanya `expo-secure-store` (didukung Expo Go) |

Keputusan teknis (bisa ditinjau di review spec):

- **R1. Satu dompet lokal per HP, EOA biasa.** Akun lokal viem; HP hanya memanggil `signTypedData`
  EIP-712 dan tidak pernah mengirim transaksi.
- **R2. BIP-39 12 kata (daftar English), jalur `m/44'/60'/0'/0/0`** — alamat yang sama dengan MetaMask
  untuk 12 kata yang sama. Impor hanya menerima 12 kata dengan checksum yang benar.
- **R3. Kunci diturunkan sekali.** PBKDF2-SHA512 2048 putaran (JS murni) hanya dijalankan saat membuat
  atau mengimpor dompet; yang disimpan adalah kunci privat hasil turunannya, sehingga membuka aplikasi
  tidak menurunkan ulang.
- **R4. `expo-secure-store` dengan `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`** di setiap
  panggilan (baca, tulis, hapus). Tiga kunci penyimpan (§4.2). Penyimpan menolak menimpa dompet yang
  sudah ada.
- **R5. Impor kunci privat hanya saat `__DEV__`** — tombolnya tidak dirender di luar `__DEV__`, dan fungsi
  impornya menolak sendiri bila tidak dalam mode pengembangan.
- **R6. Gerbang di `app/_layout.tsx` dengan `Stack.Protected`** (expo-router 57). Keadaan `memuat` dan
  `galat` ditampilkan di luar navigator; keadaan `galat` **tidak pernah** jatuh ke layar Mulai.
- **R7. Layar tidak pernah memegang kunci.** `useNearlySigner(kontrak)` mengembalikan `NearlySigner | null`.
  Layar yang memakai signer dipecah menjadi komponen pembungkus (mengambil signer, kembali `null` bila
  belum siap) dan komponen isi (hook-hook lama), supaya urutan hook tidak pernah bergantung pada
  keberadaan signer.
- **R8. Ganti dompet membersihkan memori per alamat**: sesi pesan (kunci privat pesan), cache kunci lawan,
  cache pesan terbuka, dan penanda "push sudah didaftarkan".

## 3. Mengapa Dompet di HP Aman dan Cukup

- **Tanpa gas, tanpa transaksi.** HP hanya menandatangani EIP-712; relayer server yang mengirim transaksi
  dan membayar gas (`apps/api/src/relayer.ts`, `vouch-relayer.ts`, `attendance-relayer.ts`). Dompet HP
  tidak perlu saldo, dan tanda tangannya tidak memindahkan aset apa pun.
- **Kunci pesan tetap bekerja.** Kunci pesan Fase 4c diturunkan dari tanda tangan `KunciPesan`, yang
  harus identik setiap kali (spec 4c §11.4). Akun lokal viem menandatangani secara deterministik
  (RFC 6979) — dibuktikan tes (§10).
- **Tanpa jendela konfirmasi.** Dompet ada di proses aplikasi, jadi tanda tangan tidak memunculkan popup
  — sama dengan perilaku signer pengembangan hari ini.
- **Trust tidak memakai umur atau riwayat dompet.** Pertahanan sybil tetap salaman fisik dan struktur graf
  (spec induk §8–§9). Alamat yang gratis dibuat sudah diterima sebagai celah di spec 3b/3c (§8 batas #5).

## 4. Inti Dompet dan Penyimpanan

### 4.1 `apps/mobile/src/dompet/dompet.ts` — murni

Tanpa impor `react`, `react-native`, atau `expo*`; seluruhnya diuji di vitest.

| Fungsi | Perilaku |
|---|---|
| `normalisasiMnemonik(teks)` | trim, huruf kecil, semua spasi/baris baru di antara kata menjadi satu spasi |
| `mnemonikDariEntropi(entropi)` | 16 bait → 12 kata (BIP-39: 128 bit + 4 bit checksum SHA-256) |
| `buatMnemonik()` | 12 kata baru dari `globalThis.crypto.getRandomValues`, dibaca saat dipanggil |
| `mnemonikSah(teks)` | tepat 12 kata dari daftar English **dan** checksum benar |
| `kunciDariMnemonik(teks)` | kunci privat jalur `m/44'/60'/0'/0/0` (`mnemonicToAccount(...).getHdKey().privateKey`); melempar `mnemonik_tidak_sah` |
| `normalisasiKunciPrivat(teks)` / `kunciPrivatSah(teks)` | `0x` + 64 hex (awalan dan huruf besar ditoleransi), di dalam orde kurva secp256k1 |
| `alamatDariKunci(kunci)` | alamat checksum EIP-55 |

`mnemonicToAccount` milik viem **tidak** memeriksa checksum BIP-39 (12 kali "test" diterima dan
menghasilkan alamat), dan `validateMnemonic` tidak diekspor `viem/accounts`. Karena itu pemeriksaan
checksum ditulis di sini dan diuji dengan vektor resmi BIP-39.

### 4.2 `apps/mobile/src/dompet/penyimpan-dompet.ts` — Keychain

Satu-satunya berkas yang mengimpor `expo-secure-store`.

| Kunci penyimpan | Isi |
|---|---|
| `nearly.dompet.kunci` | kunci privat `0x…` — **keberadaannya yang menandai dompet ada** |
| `nearly.dompet.mnemonik` | 12 kata; tidak ada untuk dompet dari impor kunci privat |
| `nearly.dompet.sudahDicadangkan` | `"1"` bila pengguna menandai sudah mencatat; tidak ada bila belum |

Aturan:

1. Opsi `{ keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY }` di **setiap** panggilan. Item tidak ikut
   cadangan iCloud dan tidak pindah ke HP baru — satu-satunya cadangan adalah 12 kata.
2. **Tulis:** mnemonik dan penanda dulu, **kunci terakhir**. **Hapus:** **kunci pertama**. Penulisan atau
   penghapusan yang terputus tidak pernah meninggalkan dompet setengah jadi yang terbaca sebagai siap.
3. `simpanDompet` menolak (`dompet_sudah_ada`) bila kunci sudah ada. Dompet lama wajib dihapus lebih dulu.
4. `muatDompet`: tidak ada kunci → `null`; kunci yang tidak sah → **melempar** `dompet_rusak`, bukan
   `null`. `null` berarti layar Mulai, dan "Buat dompet baru" di sana akan menimpa identitas yang mungkin
   hanya gagal terbaca.
5. 12 kata dibaca dari penyimpan **hanya saat diminta** (layar Dompet), tidak ditahan di memori.

### 4.3 Aksi dan konteks

- **`src/dompet/aksi-dompet.ts`** (tanpa React, diuji dengan penyimpan di-mock):
  `muatInfoDompet`, `buatDompetBaru`, `imporDompetMnemonik`, `imporDompetKunciDev(teks, modePengembangan)`,
  `lupakanDompet`. Galat dilempar sebagai `Error(kode)`: `mnemonik_tidak_sah`, `kunci_tidak_sah`,
  `hanya_pengembangan`, `dompet_sudah_ada`, `dompet_rusak`.
  - Buat baru → `sudahDicadangkan = false`.
  - Impor 12 kata → `sudahDicadangkan = true` (yang mengetik 12 kata sudah memegang cadangannya).
  - Impor kunci privat → tanpa mnemonik, tanpa spanduk pengingat.
  - `lupakanDompet` → hapus dari penyimpan, lalu `lupakanSemuaSesiPesan`, `lupakanCacheKunciLawan`,
    `lupakanCacheBuka` (fungsi reset yang sekarang bernama `_reset…UntukTes` menjadi ekspor resmi).
- **`src/dompet/teks-dompet.ts`** (murni): semua kalimat dompet — pengingat cadangan, peringatan ganti
  dompet, peringatan sebelum menampilkan 12 kata, peringatan "jangan pakai 12 kata dompet utama", kalimat
  per kode galat.
- **`src/dompet/konteks-dompet.tsx`**: `DompetProvider` memuat dompet saat aplikasi mulai.

  ```
  keadaan: "memuat" | "galat" | "belum-ada" | "siap"
  useDompet() → { keadaan, galat, address, punyaMnemonik, sudahDicadangkan,
                  muatUlang(), buatBaru(), imporMnemonik(teks), imporKunciDev(teks),
                  gantiDompet(), tampilkanMnemonik(), tandaiSudahDicadangkan() }
  useNearlySigner(verifyingContract) → NearlySigner | null   // useMemo per kunci + kontrak
  ```

  Kunci privat berada di konteks terpisah yang tidak diekspor; `useDompet()` tidak pernah mengembalikannya.
  `gantiDompet()` memanggil `lupakanDompet()` lalu `lupakanPendaftaranPush()`, supaya dompet berikutnya
  mendaftarkan token push-nya sendiri — API sudah memindahkan token dari dompet lama saat itu terjadi
  (`simpanTokenPush` di `apps/api/src/pesan-store.ts`).
- **`src/signer.ts`**: `createDevSigner` berganti nama menjadi `createSignerDariKunci(privateKey,
  verifyingContract)`, perilaku identik. Satu-satunya pemanggilnya `useNearlySigner`.

## 5. Layar dan Gerbang

### 5.1 Gerbang — `app/_layout.tsx`

`RootLayout` membungkus navigasi dengan `DompetProvider`.

| Keadaan | Tampilan |
|---|---|
| `memuat` | spinner di tengah, tanpa navigator |
| `galat` | kalimat galat + tombol **Coba lagi** (`muatUlang`), tanpa navigator |
| `belum-ada` | `Stack` — hanya layar `mulai` yang diizinkan |
| `siap` | `Stack` — semua layar lain diizinkan; `mulai` tidak |

Pembagian rute ada di `src/judul-layar.ts`: `RUTE_TANPA_DOMPET = ["mulai"]` dan
`layarMenurutDompet(punyaDompet)`, yang mempertahankan urutan `JUDUL_LAYAR` sehingga `index` selalu layar
pertama yang dituju saat penjaga berubah. `JUDUL_LAYAR` mendapat `mulai: "Mulai"` dan
`dompet: "Dompet"`. Pendengar ketukan notifikasi hanya dipasang saat `siap`, karena rute tujuannya
dilindungi.

### 5.2 Layar Mulai — `app/mulai.tsx`

- **Buat dompet baru**.
- **Pakai dompet yang sudah ada (12 kata)** → isian banyak baris + peringatan: *jangan pakai 12 kata dompet
  utama yang menyimpan aset; kunci disimpan di HP ini, bukan dompet perangkat keras.*
- **Impor kunci privat (khusus pengembangan)** → dirender hanya saat `__DEV__`; isian `secureTextEntry`.
- Selama menurunkan kunci, tombol menampilkan "Menyiapkan dompet…"; layar memberi jeda 50 ms sebelum
  PBKDF2 supaya teks itu sempat tergambar.
- Berhasil → gerbang memindahkan ke beranda. Gagal → kalimat dari `pesanGalatDompet`.

### 5.3 Layar Dompet — `app/dompet.tsx`

- **Alamat** utuh + **Bagikan alamat** (`Share` bawaan React Native, tanpa paket baru) — untuk CSV seed panitia.
- **Lihat 12 kata pemulihan** → dialog konfirmasi (peringatan: siapa pun yang melihatnya bisa memakai
  identitasmu) → kata bernomor → **Sudah saya catat** menandai `sudahDicadangkan` dan menyembunyikan kata.
  Dompet tanpa mnemonik menampilkan kalimat bahwa ia tidak punya 12 kata.
- **Ganti dompet** → dialog destruktif dengan peringatan bertingkat: belum dicatat ("hilang selamanya"),
  sudah dicatat ("hanya lewat 12 kata"), atau tanpa mnemonik ("hanya dengan kunci privat yang sama").
  Berhasil → gerbang memindahkan ke Mulai.

### 5.4 Beranda dan Profil saya

- `app/index.tsx`: kalimat "Isi EXPO_PUBLIC_DEV_PRIVATE_KEY…" hilang. Selama `perluPengingatCadangan`
  (punya mnemonik dan belum dicadangkan), spanduk pengingat tampil sebagai tautan ke `/dompet`. Tautan
  **Dompet** ditambahkan di daftar menu.
- `app/profil-saya.tsx`: tautan ke `/dompet` di bagian bawah.

## 6. Migrasi 17 Layar

Pola: `const signer = useMemo(() => createDevSigner(CONFIG.devPrivateKey!, X), [])` → komponen
pembungkus dengan `useNearlySigner(X)` (R7). Kontrak domain **dipertahankan persis**:

| Layar | Kontrak | Catatan |
|---|---|---|
| `app/index.tsx` | `verifyingContract` | ditulis ulang (§5.4) |
| `app/qr.tsx` | `verifyingContract` | |
| `app/scan.tsx` | `attendanceRegistry` **dan** `verifyingContract` | dua signer yang tadinya dibuat di dalam callback pemindai; kedua hook diambil di pembungkus |
| `app/connections.tsx` | `verifyingContract` | |
| `app/kecocokan.tsx` | `verifyingContract` | |
| `app/blokir.tsx` | `verifyingContract` | |
| `app/profil-saya.tsx` | `verifyingContract` | + tautan Dompet |
| `app/profile/[address].tsx` | `verifyingContract` | **tanpa** pembungkus — layar ini sudah menangani signer `null` |
| `app/events/new.tsx` | `attendanceRegistry` | |
| `app/events/[id].tsx` | `attendanceRegistry` | |
| `app/events/[id]/host-qr.tsx` | `attendanceRegistry` | |
| `app/feed/index.tsx` | `verifyingContract` | |
| `app/feed/new.tsx` | `verifyingContract` | |
| `app/pesan/index.tsx` | `verifyingContract` | |
| `app/pesan/[address].tsx` | `verifyingContract` | |
| `app/pesan/lapor/[address].tsx` | `verifyingContract` | |
| `app/radar/[eventId].tsx` | `verifyingContract` | |

**Mengapa pembungkus, bukan `if (!signer) return null` di tempat.** Rencana yang disetujui menyebut
pengembalian awal cukup karena gerbang mencegah layar dirender sebelum dompet siap. Itu benar saat
membuka aplikasi, tetapi tidak saat **Ganti dompet**: layar yang masih ada di tumpukan (beranda di bawah
layar Dompet) dirender ulang dengan signer `null` sebelum navigator melepasnya. Pengembalian awal yang
diletakkan sebelum `useState`/`useEffect` lain mengubah jumlah hook di antara dua render — React
melempar galat dan aplikasi mati. Pembungkus hanya berisi hook dompet dan selalu memanggilnya dalam
jumlah yang sama; komponen isi dilepas utuh saat signer hilang, dan dipasang ulang dengan
`key={signer.address}` saat dompet berganti.

## 7. Kunci Dev Dihapus

- `devPrivateKey` dihapus dari `src/config.ts`.
- `src/use-signer.ts` (`pickSigner`), `src/wallet-signer.ts`, dan `test/use-signer.test.ts` dihapus —
  tidak ada rencana dompet luar.
- Komentar `src/meet-api.ts` yang menyebut `createDevSigner` diperbarui.
- `.env.example` root: **nama** `EXPO_PUBLIC_DEV_PRIVATE_KEY` tetap (masih dibaca
  `scripts/uji-lapangan-pesan.ts` dari `.env` root), komentarnya diperbarui bahwa aplikasi tidak lagi
  membacanya. Nilai di `apps/mobile/.env` **dihapus oleh pemilik project**, bukan oleh sesi eksekusi.
- Identitas uji lama (dompet dev yang sudah punya koneksi dan nama "alvary") dipakai lagi lewat
  **Impor kunci privat (khusus pengembangan)** di layar Mulai.

## 8. Batas yang Diakui

1. **Tanpa 12 kata, hapus aplikasi atau ganti HP berarti identitas, koneksi, dan riwayat pesan hilang.**
   Kunci pesan diturunkan dari tanda tangan dompet, jadi riwayat pesan ikut tidak terbuka.
2. **Satu dompet per HP.** Memakai dompet yang sama di dua HP hanya lewat impor 12 kata.
3. **Kunci tersimpan di Keychain HP**, dilindungi kunci layar — bukan dompet perangkat keras. HP yang
   dibobol dalam keadaan tidak terkunci membuka dompetnya.
4. **Di Expo Go, SecureStore berada di wadah Expo Go.** Perilaku setelah Expo Go ditutup paksa, dihapus,
   atau diinstal ulang belum diketahui dan wajib dicek di iPhone (uji §10 butir 8). *Hasil uji
   2026-09-18: dompet tetap ada setelah Expo Go ditutup paksa. Perilaku setelah Expo Go dihapus dan
   dipasang ulang belum diuji.*
5. **Alamat gratis dibuat**, sehingga spam hitungan "ingin bertemu", RSVP, dan feed menjadi murah (sudah
   diterima di spec 3b/3c). Trust tidak terpengaruh.
6. **Notifikasi dompet lama bisa tetap sampai setelah Ganti dompet**, sampai dompet baru membuka layar
   Pesan atau Radar dan mendaftarkan token push-nya (saat itu API memindahkan token). Membersihkan token
   di server saat ganti dompet butuh perubahan `apps/api` dan di luar spec ini.
7. **12 kata tampil sebagai teks biasa di layar.** Expo Go tidak bisa mencegah tangkapan layar atau
   rekaman layar; hanya dialog peringatan yang melindungi.
8. **Menurunkan kunci dari 12 kata memblokir thread JS** (PBKDF2 2048 putaran dalam JS murni di Hermes).
   Layar Mulai menampilkan "Menyiapkan dompet…" selama itu. *Hasil uji 2026-09-18 di iPhone (Expo Go):
   sekitar 0–1 detik.*
9. **Keadaan `galat` hanya punya tombol Coba lagi.** Bila isi Keychain benar-benar rusak (bukan gagal
   terbaca sesaat), tidak ada jalan keluar di dalam aplikasi selain memasang ulang Expo Go — lihat batas #4.
10. **Ketukan notifikasi saat aplikasi mati** baru ditangani setelah dompet selesai dimuat; ketukan yang
    tiba sebelum itu bisa tidak membuka layar tujuan.
11. **12 kata yang sedang terbuka di layar Dompet ikut terekam cuplikan app switcher iOS** sampai pengguna
    menekan "Sudah saya catat". Mencegahnya dengan andal butuh modul native (di luar Expo Go); mengosongkan
    kata lewat `AppState` belum dicoba karena efektivitasnya hanya bisa dibuktikan di iPhone.
12. **Isian 12 kata di Android** memakai `keyboardType="visible-password"` dan `importantForAutofill="no"`
    supaya keyboard tidak belajar dari ketikan. Perilakunya per keyboard (Gboard, Samsung) belum diuji di
    perangkat Android. Deep link `nearly:///radar/<id>` saat aplikasi mati juga belum diuji (lihat #10).

## 9. Di Luar Lingkup

- Dompet luar, WalletConnect/Reown, Privy atau dompet tersemat lain.
- Development build, TestFlight, dan distribusi aplikasi ke peserta (dibahas terpisah; Expo Go + EAS
  Update gratis adalah kandidatnya).
- Cadangan iCloud, Face ID / kode sandi untuk melihat 12 kata, blokir tangkapan layar.
- Impor 24 kata, passphrase BIP-39, lebih dari satu akun per mnemonik.
- Ekspor dan hapus data satu tap (spec induk §14 butir 8) — tetap wajib sebelum pengguna publik.
- Perubahan apa pun di `apps/api`, `apps/web`, `packages/*`, `supabase/*`.

## 10. Verifikasi

**Tes otomatis — `apps/mobile` (vitest, fungsi murni dan baca-kode):**

- `dompet.ts`: vektor resmi BIP-39 (entropi `00…`, `7f…`, `80…`, `ff…`); vektor uji
  `test test test test test test test test test test test junk` → kunci
  `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` → alamat
  `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`; checksum salah ditolak (walau viem menerimanya); kata di
  luar daftar dan jumlah kata salah ditolak; normalisasi huruf besar/spasi/baris baru; mnemonik baru sah
  dan berbeda; `mnemonikSah` sepakat dengan `generateMnemonic` viem; kunci privat nol dan di atas orde
  kurva ditolak.
- `penyimpan-dompet.ts` dengan `expo-secure-store` di-mock: simpan/muat/hapus; dompet tanpa mnemonik;
  menolak menimpa; kunci ditulis terakhir dan dihapus pertama; isi rusak melempar; **setiap** panggilan
  memakai `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- `aksi-dompet.ts`: buat baru termuat ulang dengan alamat sama; impor 12 kata vektor uji; impor gagal
  tidak menyimpan apa pun; impor kunci privat ditolak di luar mode pengembangan; `lupakanDompet`
  membuang sesi pesan, kunci lawan, dan pesan terbuka (dibuktikan perilaku, bukan hanya pemanggilan).
- `signer.test.ts` tetap hijau setelah ganti nama; signer dari kunci turunan 12 kata memulihkan ke
  alamatnya, dan dua tanda tangan `KunciPesan` identik.
- `teks-dompet.ts`: pengingat cadangan, peringatan bertingkat, kata bernomor, kalimat per kode galat.
- Tes penjaga baca-kode: tidak ada `createDevSigner` / `devPrivateKey` / `EXPO_PUBLIC_DEV_PRIVATE_KEY`
  di `app/` dan `src/`; `createSignerDariKunci` hanya dipanggil konteks dompet; `expo-secure-store` hanya
  diimpor penyimpan; setiap layar pemakai `useNearlySigner` memakai pola pembungkus (kecuali
  `profile/[address]`); gerbang `Stack.Protected` dua sisi; impor kunci privat terbungkus `__DEV__`;
  modul dompet murni tidak mengimpor React/RN/Expo.
- `judul-layar.test.ts`: `mulai` dan `dompet` wajib berjudul; `layarMenurutDompet` membagi semua judul
  tanpa irisan, `mulai` hanya tanpa dompet, `index` pertama dengan dompet.
- Langkah mutasi dijalankan sungguhan untuk: checksum, opsi Keychain, penolakan menimpa, penjaga
  `__DEV__` (aksi dan konteks), ketiga pembersihan memori, dan setiap tes penjaga baca-kode.
- `pnpm -r test` dan `pnpm -r typecheck` hijau.

**Uji di iPhone (Expo Go) — pemilik project:**

1. Hapus nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` dari `apps/mobile/.env`, lalu `npx expo start --go -c` di `apps/mobile`.
2. Buka aplikasi → layar Mulai → **Buat dompet baru** → beranda tampil dengan alamat baru dan spanduk
   cadangan. Catat berapa lama "Menyiapkan dompet…" tampil (batas #8).
3. Layar Dompet → **Lihat 12 kata pemulihan** → catat → **Sudah saya catat** → kembali ke beranda, spanduk hilang.
4. Tutup paksa dan buka lagi → alamat sama, tanpa layar Mulai; buka Pesan → sesi pesan jalan.
5. Salaman dengan dompet lain (`apps/api/tools/peer.ts` atau HP kedua) → koneksi tercatat untuk alamat baru.
6. **Ganti dompet** → layar Mulai → **Impor kunci privat (khusus pengembangan)** dengan kunci dev lama →
   identitas lama ("alvary", koneksi lama) kembali, pesan lama terbaca.
7. **Ganti dompet** lagi → **Pakai dompet yang sudah ada (12 kata)** dengan kata dari langkah 3 → alamat
   sama dengan langkah 2. (Bila ada HP kedua: impor 12 kata yang sama di sana → alamat sama.)
8. Cek SecureStore: tutup paksa Expo Go → buka lagi (dompet harus tetap ada); lalu hapus dan pasang ulang
   Expo Go → catat apakah dompet masih ada. Tulis hasilnya di §8 batas #4.

### Hasil uji iPhone (2026-09-18, Expo Go)

| Uji | Hasil |
|---|---|
| Buat dompet baru → beranda, alamat baru, spanduk cadangan | Lolos; "Menyiapkan dompet…" sekitar 0–1 detik |
| Lihat 12 kata → Sudah saya catat → spanduk hilang | Lolos |
| Tutup paksa → buka lagi → alamat sama, tanpa Mulai; Pesan terbuka | Lolos |
| Ganti dompet → impor kunci privat dev → identitas lama dan pesan lama terbaca | Lolos |
| Ganti dompet → impor 12 kata → alamat sama dengan dompet pertama, tanpa spanduk | Lolos |
| Ketuk ganda Buat dompet baru → tetap satu dompet, 12 kata sah | Lolos |
| Salaman dengan dompet lain | Tidak diuji terpisah: jalur tanda tangan identik dengan kunci dev (`createSignerDariKunci`) yang sudah lolos uji lapangan |
| Ketuk notifikasi saat aplikasi mati | Belum diuji (batas #10) |
| Hapus lalu pasang ulang Expo Go | Belum diuji (batas #4) |

## 11. Batas Jalur

| Boleh diubah | Tidak boleh diubah |
|---|---|
| `apps/mobile/**` | `apps/api/**`, `apps/web/**`, `packages/**`, `supabase/**` |
| `pnpm-lock.yaml` (akibat `expo install`) | `apps/mobile/.env`, `.env` root (nilai apa pun) |
| `.env.example` root (komentar saja) | |
| `docs/superpowers/specs/2026-09-03-nearly-design.md`, `docs/demo/runbook.md` | |

Tidak ada migrasi, tidak ada tipe EIP-712 baru, tidak ada rute API baru.

## 12. Amandemen Spec Induk

Task terakhir rencana implementasi memperbarui `2026-09-03-nearly-design.md`:

1. **§10.1** — paragraf "Wallet: connect wallet yang sudah ada sebagai jalur utama … Privy sebagai
   cadangan" diganti: jalur saat ini adalah **dompet yang dibuat di HP** (12 kata BIP-39, Keychain, impor
   12 kata), dengan alasan Expo Go tanpa akun Apple; menyambung dompet luar tetap mungkin kelak di
   development build, tetapi tidak direncanakan.
2. **§11** — catatan (2026-09-17) bahwa Fase 0 "connect wallet" diwujudkan sebagai dompet di HP, dengan
   rujukan ke spec ini.

Dan `docs/demo/runbook.md`: panitia/juri membuat atau mengimpor dompet di aplikasi, lalu **Bagikan
alamat** dari layar Dompet untuk CSV seed; nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` di `apps/mobile/.env`
dihapus.

## 13. Langkah Berikutnya

1. Pemilik project me-review spec ini.
2. Rencana implementasi `docs/superpowers/plans/2026-09-17-nearly-dompet-per-pengguna.md` di branch
   `dompet-per-pengguna`, dieksekusi sesi `fcc` dengan `superpowers:subagent-driven-development`.
3. Pemilik project menghapus nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` dari `apps/mobile/.env` dan menjalankan
   uji iPhone §10, lalu mengisi hasil batas #4.
