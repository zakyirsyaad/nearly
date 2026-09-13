# Nearly Fase 4c — Pesan: Design Spec

**Tanggal:** 2026-09-13
**Status:** Disetujui per bagian, menunggu tinjauan spec tertulis
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/specs/2026-09-08-nearly-fase-4a-blokir-design.md` (tuntas, tergabung ke main, terverifikasi lapangan)

---

## 1. Posisi dalam Roadmap

Spec 4a §1 memecah Fase 4 menjadi 4a (blokir), 4c (pesan), dan 4b (radar & visibilitas), dan
menaruh 4c sebelum 4b karena pesanlah yang menutup tesis produk di spec induk §1: **kamu bisa
tetap anon dan tetap terhubung**, tanpa menyerahkan Telegram.

Spec induk §7.5 mensyaratkan tiga hal sebelum pesan boleh ke produksi — blokir dari dalam
percakapan, lapor dari dalam percakapan, dan koneksi terblokir berhenti menghantar trust. Yang
ketiga sudah dibangun 4a. Dua yang pertama dibangun di fase ini.

**Kriteria selesai:** dua orang yang pernah bertemu fisik bisa saling berkirim pesan teks yang
terenkripsi ujung-ke-ujung; orang yang belum pernah bertemu tidak punya jalur apa pun untuk
mengirim, membaca kunci, atau melihat percakapan; blokir dan lapor bisa dilakukan dari dalam
percakapan; dan penerima mendapat notifikasi — best-effort — saat aplikasinya tertutup.

## 2. Keputusan yang Terkunci

Keputusan di tabel ini diambil pemilik project saat brainstorming.

| Aspek | Keputusan |
|---|---|
| Teknologi | **Relay sendiri + E2E**, BUKAN XMTP (§2.1) |
| Siapa bisa berkirim | Hanya pasangan yang punya baris `connections` (handshake tercetak) dan tidak berhubungan blokir ke arah mana pun. "Cocok" saja **tidak** membuka pesan |
| Pengiriman | Polling selama layar aktif + **push best-effort lewat Expo Go iOS** |
| Isi notifikasi | **Nama tampilan pengirim**, tanpa isi dan tanpa alamat (§7.2) |
| Kunci enkripsi | **Diturunkan dari tanda tangan dompet**, sama di perangkat mana pun (§5.1) |
| Autentikasi per pesan | Kunci sesi Ed25519 terdaftar — dompet tidak diminta konfirmasi per pesan (§5.4) |
| Lapor | **Bukti pesan yang bisa diverifikasi**, dipilih pelapor (§8.2) |
| Isi pesan | **Teks saja**, maksimal 2000 karakter |
| Edit / hapus pesan | Tidak ada di 4c |
| Status dibaca | Hanya untuk jumlah belum-dibaca milik penerima; tidak diperlihatkan ke pengirim |
| Saat terblokir | Percakapan hilang dari kedua pihak, pesan tidak diantar, mengirim ditolak `403 terblokir`; baris bertahan sehingga cabut blokir mengembalikan riwayat |
| On-chain | **Tidak ada.** Pesan, kunci, dan laporan semuanya off-chain |

### 2.1 Kenapa bukan XMTP

Spec induk §7.5 memilih XMTP (`@xmtp/react-native-sdk`). Tiga temuan saat brainstorming
membalik pilihan itu:

1. **SDK XMTP belum terbukti jalan di New Architecture.** Rilis terakhirnya 5.7.0 (Maret 2026);
   pekerjaan "verify that example app runs fine with new arch enabled" di repo XMTP (#775) masih
   draft. Expo SDK 55 ke atas hanya berjalan di New Architecture, dan repo ini memakai Expo 57.
2. **XMTP butuh native module**, jadi butuh development build. Pengembangan project ini memakai
   iPhone, dan mesin pengembangnya tidak punya Xcode — development build iOS berarti memasang
   Xcode atau keanggotaan Apple Developer berbayar untuk EAS Build.
3. **Jaminan "tanpa spam" XMTP hanya di sisi client** (spec induk §7.5 butir 2). Relay sendiri
   menegakkannya di server.

Relay sendiri + E2E dibangun dari pustaka JS murni (`@noble/*`), tidak menambah native module,
dan tetap jalan di Expo Go. Harganya diakui di §11: server melihat metadata, kita memiliki
komposisi kriptonya, dan tidak ada forward secrecy.

## 3. Model Data

Migrasi `supabase/migrations/0007_pesan.sql`. Seperti `blocks`: **RLS menyala tanpa policy**
(semua akses lewat API service role), dan setiap kolom alamat **huruf kecil saja** —
`check (kolom ~ '^0x[0-9a-f]{40}$')` dengan `~`, bukan `~*` (pelajaran Fase 3b).

### 3.1 `kunci_pesan`

| Kolom | Tipe | Aturan |
|---|---|---|
| `address` | text PK | huruf kecil |
| `kunci_enkripsi` | text | X25519 publik, `^0x[0-9a-f]{64}$` |
| `kunci_tanda` | text | Ed25519 publik, `^0x[0-9a-f]{64}$` |
| `created_at`, `updated_at` | timestamptz | default `now()` |

Satu kunci aktif per dompet. Karena kunci diturunkan deterministik (§5.1), mendaftar ulang
menghasilkan kunci yang sama; upsert menimpa bila `versi` penurunan kelak berubah.

### 3.2 `pesan`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | uuid PK | **dibuat HP**, supaya kirim ulang idempoten |
| `pengirim`, `penerima` | text | huruf kecil; `check (pengirim <> penerima)` |
| `ciphertext` | text | base64, maksimal 16 KB |
| `nonce` | text | `^0x[0-9a-f]{48}$` (24 byte) |
| `created_at` | timestamptz | default `now()` — waktu server |
| `dibaca_at` | timestamptz null | diisi saat penerima menandai dibaca |

Indeks: `(penerima, created_at desc)` untuk daftar percakapan dan jumlah belum-dibaca;
`(pengirim, penerima, created_at desc)` untuk riwayat per pasangan dan rem laju.

Pesan **tidak pernah dihapus** di 4c — termasuk saat blokir. Itu yang membuat bukti laporan
(§8.2) tidak bisa dihilangkan pengirimnya, dan yang membuat cabut blokir mengembalikan riwayat.

### 3.3 `token_push`

| Kolom | Tipe | Aturan |
|---|---|---|
| `address` | text | huruf kecil |
| `token` | text | token push Expo |
| `created_at` | timestamptz | default `now()` |

PK `(address, token)` — satu dompet bisa punya lebih dari satu HP.

### 3.4 `bukti_laporan_pesan`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | bigserial PK | |
| `laporan_id` | bigint | FK ke `reports(id)` |
| `pesan_id` | uuid | FK ke `pesan(id)` |
| `isi` | text | plaintext yang dibuka pelapor |
| `dikirim_ms` | bigint | dari dalam amplop |
| `tanda` | text | tanda tangan Ed25519 pengirim |
| `kunci_tanda` | text | salinan kunci tanda terlapor saat diverifikasi |
| `created_at` | timestamptz | default `now()` |

`reports` punya `unique (reporter, subject)` dan di-upsert, jadi melapor ulang orang yang sama
memperbarui baris laporannya. Bukti mengikutinya: setiap laporan dari percakapan **mengganti**
bukti lama untuk `laporan_id` itu, sehingga batas lima bukti per laporan tetap benar.
`ReportStore.recordReport` diubah supaya mengembalikan `id` baris laporannya.

## 4. Gerbang Pesan

Sepasang orang `(x, y)` **terhubung-pesan** bila ketiganya benar:

1. baris `connections` untuk pasangan kanonik `(min(x,y), max(x,y))` ada;
2. `adaBlokir(x, y)` dan `adaBlokir(y, x)` keduanya `false` (pemeriksaan pasangan tepat dari 4a,
   bukan memuat seluruh himpunan);
3. untuk mengirim dan mengambil kunci: penerima punya baris `kunci_pesan`.

**Urutan pemeriksaan di setiap endpoint pesan: autentikasi → gerbang (1)(2) → data → (3).**
Urutan ini disengaja: orang yang bukan koneksimu tidak boleh bisa membedakan "dia belum memakai
pesan" dari "kalian tidak terhubung". Kunci publik memang tidak rahasia, tapi keberadaannya
adalah informasi aktivitas.

**Daftar percakapan** hanya memuat lawan bicara yang lolos (1)(2). Pesan dari atau ke orang yang
berhubungan blokir tidak dikembalikan dari endpoint mana pun.

**Rem laju:** lebih dari 30 pesan dalam 60 detik terakhir dari satu pengirim (dihitung dari tabel
`pesan`) ditolak `429 terlalu_cepat`. Blokir tetap alat utama; ini hanya menahan banjir.

## 5. Kripto

Satu implementasi, dipakai HP dan server:

- `packages/shared/src/pesan.ts` — dua tipe EIP-712, penyandian kanonik (§5.3, §5.4)
- `packages/shared/src/pesan-kripto.ts` — penurunan kunci, enkripsi/dekripsi, tanda/verifikasi;
  semuanya fungsi murni

Pustaka: `@noble/curves` (ed25519, x25519), `@noble/hashes` (sha256, hkdf), `@noble/ciphers`
(xchacha20poly1305). Keluarga yang sama yang sudah dipakai `viem`; tanpa native module.
Keacakan HP lewat `crypto.getRandomValues` yang sudah dipolifil di `apps/mobile/src/polyfills.ts`.

### 5.1 Penurunan kunci

1. Dompet menandatangani EIP-712 `KunciPesan { who, versi: 1 }` (§6).
2. `bahan` = 65 byte tanda tangan itu.
3. `privTanda = hkdf(sha256, bahan, salt="nearly-pesan-v1", info="tanda-ed25519", 32)`
4. `privEnkripsi = hkdf(sha256, bahan, salt="nearly-pesan-v1", info="enkripsi-x25519", 32)`
5. Kunci publik keduanya diturunkan dari kunci privatnya.

Tanda tangan `KunciPesan` dan kunci privat **tidak pernah meninggalkan HP** dan hanya disimpan
di memori selama aplikasi terbuka. Signer pengembangan menandatanganinya tanpa jendela
konfirmasi; dompet sungguhan akan meminta satu konfirmasi per kali buka aplikasi.

### 5.2 Enkripsi satu pesan

1. `rahasia = x25519(privEnkripsiKu, pubEnkripsiLawan)`
2. `kunciPercakapan = hkdf(sha256, rahasia, salt="nearly-pesan-v1", info="percakapan|" + min(a,b) + "|" + max(a,b), 32)` — alamat huruf kecil. Kedua pihak mendapat kunci yang sama, jadi pengirim bisa membaca riwayat kirimannya sendiri.
3. `amplop` = JSON `{ "v": 1, "pengirim", "penerima", "isi", "dikirimMs", "tanda" }`
   dengan `tanda` dari §5.3.
4. `nonce` = 24 byte acak.
5. `ciphertext = xchacha20poly1305(kunciPercakapan, nonce, AAD = utf8(pengirim + "|" + penerima))
   .encrypt(utf8(JSON amplop))`.

AAD mengikat arah: server yang menukar `pengirim`/`penerima` di barisnya membuat dekripsi gagal.

**Saat menerima**, HP menolak menampilkan pesan sebagai sah bila dekripsi gagal, bila `pengirim`/
`penerima` di dalam amplop tidak sama dengan kolom baris, atau bila `tanda` tidak cocok dengan
`kunci_tanda` terdaftar milik pengirim. Pesan yang ditolak ditampilkan sebagai "Pesan tidak bisa
diverifikasi", bukan disembunyikan diam-diam.

### 5.3 Tanda tangan dalam amplop

`tanda = ed25519.sign(privTandaPengirim, utf8("nearly-pesan-v1\n" + pengirim + "\n" + penerima + "\n" + dikirimMs + "\n" + isi))`

Alamat huruf kecil, `dikirimMs` desimal. `isi` di posisi terakhir supaya baris baru di dalamnya
tidak bisa menggeser medan lain. Inilah yang diverifikasi server untuk bukti laporan (§8.2).

### 5.4 Autentikasi request

Setiap request pesan (kecuali pendaftaran kunci dan laporan) membawa tiga header:

- `x-nearly-who` — alamat
- `x-nearly-ts` — detik unix
- `x-nearly-tanda` — `ed25519.sign(privTanda, utf8("nearly-req-v1\n" + METHOD + "\n" + pathDenganQuery + "\n" + sha256hex(badan atau "") + "\n" + ts + "\n" + who))`

Server: `|now - ts| ≤ 300` detik, `who` punya `kunci_tanda`, tanda cocok. Header, bukan query
string, supaya tanda tangan tidak masuk log URL.

Verifikasi dibungkus helper yang **tidak pernah melempar** — bentuk tanda tangan atau kunci yang
cacat menghasilkan `401`, bukan `500`, sama seperti `pulihkanTandaTangan` untuk EIP-712. Penjaga
struktural di `apps/api/test/sig-rusak.test.ts` diperluas supaya memeriksa tidak ada verifikasi
Ed25519 telanjang di luar helper itu.

Replay dalam jendela 5 menit: `POST /pesan` idempoten lewat `id`; request baca yang diputar
ulang hanya berguna bagi yang sudah memegang tanda tangannya.

## 6. Tipe EIP-712

Setelah fase ini aplikasi punya **dua puluh empat** tipe EIP-712, tidak satu pun bertabrakan,
dan tidak satu pun dari dua tipe baru punya pasangan typehash di Solidity mana pun.

| Tipe | Medan | Dikirim ke server? |
|---|---|---|
| `KunciPesan` | `who: address`, `versi: uint32` | **Tidak pernah.** Tanpa `expiresAt` dengan sengaja — tanda tangannya harus selalu sama agar kunci bisa diturunkan ulang |
| `DaftarKunciPesan` | `who: address`, `kunciEnkripsi: bytes32`, `kunciTanda: bytes32`, `expiresAt: uint64` | Ya, satu kali per pendaftaran |

Domain sama dengan seluruh aplikasi: `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.

**Ruling 23.** `KunciPesan` berbentuk `{who, versi}` — beda dari keluarga `{who, expiresAt}`
(`LihatKecocokan`, `TandaiDilihat`, `LihatBlokir`, `LihatFeed`). Tetap diuji: tanda tangan
`KunciPesan` tidak pulih sebagai anggota keluarga itu, dan sebaliknya. Konsekuensinya lebih berat
dari tipe lain: tanda tangan `KunciPesan` yang bocor **membuka seluruh riwayat pesan**, jadi tidak
ada kode di repo ini yang boleh mengirimnya ke jaringan. Tes mobile memastikan pembangun
`KunciPesan` tidak dipakai di jalur request mana pun.

## 7. Permukaan API

`apps/api/src/routes/pesan.ts`, gerbang di `apps/api/src/pesan-gate.ts`, store di
`apps/api/src/pesan-store.ts`, port `PesanStore` di `ports.ts` dengan pengait dua arah
`METODE_PESAN_STORE` seperti `METODE_BLOKIR_STORE`.

| Endpoint | Auth | Fungsi | Penolakan |
|---|---|---|---|
| `POST /pesan/kunci` | EIP-712 `DaftarKunciPesan` | Daftar/perbarui kunci publik | 400, 401, 410 |
| `GET /pesan/kunci/:alamat` | Ed25519 | Kunci publik lawan | 403 `tidak_terhubung`/`terblokir`, lalu 409 `belum_siap` |
| `POST /pesan` | Ed25519 | `{ id, penerima, ciphertext, nonce }` | 400, 403, 409, 413, 429 |
| `GET /pesan/percakapan` | Ed25519 | Lawan bicara, pesan terakhir (ciphertext), jumlah belum dibaca, nama tampilan | — |
| `GET /pesan/dengan/:alamat?sebelum=&limit=` | Ed25519 | Riwayat dua arah, terbaru dulu; `limit` ≤ 50 | 403 |
| `POST /pesan/dengan/:alamat/dibaca` | Ed25519 | `{ sampaiMs }` — tandai pesan dari lawan sampai waktu itu | 403 |
| `GET /pesan/belum-dibaca` | Ed25519 | Total belum dibaca | — |
| `POST /pesan/token-push` | Ed25519 | `{ token }` | 400 |
| `POST /pesan/laporan` | EIP-712 `Report` (dompet) | §8.2 | 400, 401, 403, 410, 422 `bukti_tidak_sah` |

`POST /pesan` memakai `bodyLimit` 32 KB. Pesan ke diri sendiri ditolak di gerbang (400
`pesan_diri`) sebelum CHECK basis data, sama seperti `blokir_diri`.

Skema Zod permintaan di `packages/shared/src/schema.ts`.

### 7.1 Push

Setelah baris `pesan` tersimpan, rute memanggil pengirim push **tanpa `await`** (pola
`prosesUnggahGambar`), dan pengirim push dijamin tidak pernah melempar — kegagalannya dicatat,
pengiriman pesan tetap `200`.

- Dikirim ke Expo Push API untuk setiap `token_push` milik penerima.
- **Digabung per pengirim:** push tidak dikirim bila penerima masih punya pesan belum-dibaca
  lain dari pengirim yang sama. Satu notifikasi per rentetan, tanpa state di memori.
- Token yang dijawab `DeviceNotRegistered` dihapus.
- Port `PushPort` dengan implementasi HTTP di `apps/api/src/push.ts`.

### 7.2 Isi notifikasi

- judul: `Nearly`
- badan: `Pesan baru dari <display_name>` — dari `profiles.display_name`
- bila `display_name` kosong: `Pesan baru dari koneksimu`
- data: `{ "jenis": "pesan" }` saja

**Tidak pernah** memuat isi pesan, alamat pengirim, maupun alamat penerima. Tes API mengasersi
ketiganya.

## 8. Blokir dan Lapor dari Percakapan

### 8.1 Blokir

Menu di kepala layar percakapan memanggil `aksiBlokir` dari 4a setelah satu kalimat konfirmasi.
Tidak ada jalur blokir kedua — `apps/mobile/src/blokir-actions.ts` tetap satu-satunya tempat
`Blokir` ditandatangani. Sesudahnya layar kembali ke daftar percakapan.

Status tuntutan spec induk §7.5 butir 1:

| Tuntutan | Status |
|---|---|
| Menyembunyikan percakapan, menghentikan pesan masuk | Fase ini (§4) |
| Kontribusi trust dari orang itu berhenti | Sudah sejak 4a — edge terblokir dibuang (`packages/trust/src/graph.ts:62,75`) |
| Kontribusi vouch dari orang itu berhenti | Sudah sejak 4a — vouch hanya dihitung di atas edge yang tidak terblokir (`graph.ts:66-70`) |

**Yang berhenti adalah pengaruh vouch pada skor, bukan transaksi vouch on-chain.** Mencabut vouch
on-chain secara otomatis akan mengumumkan blokir yang privat (spec 4a §2). Skornya berubah pada
recompute berikutnya (spec 4a R10).

### 8.2 Lapor dengan bukti yang bisa diverifikasi

Alur HP: **Lapor** → pilih 1–5 pesan dari lawan bicara → alasan → kirim. Layar memperingatkan:
*"Pesan yang kamu pilih akan bisa dibaca peninjau."* Setelah terkirim, aplikasi menawarkan
"Blokir juga?". Urutannya lapor-lalu-blokir karena percakapan terblokir tidak lagi terlihat di
aplikasi; menu Blokir di percakapan karena itu mengingatkan "Laporkan dulu kalau perlu — setelah
diblokir, pesannya tidak bisa dipilih lagi sampai blokir dicabut". Server tetap menerima laporan
dari pasangan yang sudah terblokir (butir 2), supaya mencabut blokir sesaat untuk melapor tidak
pernah wajib di tingkat API.

Badan `POST /pesan/laporan`:

```
{
  laporan: <badan persis POST /report — tipe Report ditandatangani dompet>,
  bukti: [{ pesanId, isi, dikirimMs, tanda }]   // 1..5
}
```

Server:

1. Memverifikasi `laporan` persis seperti `POST /report` (`pulihkanTandaTangan`, kedaluwarsa,
   penanda tangan = `reporter`). Gerbang anti-brigading spec induk §9.3 berlaku utuh: laporan
   hanya memicu peninjauan, tidak pernah langsung menurunkan trust.
2. Mewajibkan baris `connections` untuk `(reporter, subject)` — blokir **tidak** menghalangi
   lapor, supaya laporan tetap bisa dikirim setelah pelapor memblokir terlapor. Tanpa koneksi →
   `403 tidak_terhubung`.
3. Untuk setiap bukti: pesan `pesanId` ada dengan `pengirim = subject` dan `penerima = reporter`,
   dan `tanda` cocok dengan `kunci_tanda` terlapor atas string §5.3. Satu bukti gagal → seluruh
   permintaan `422 bukti_tidak_sah`, tidak ada yang tercatat.
4. Mencatat laporan (`recordReport` → `id`), lalu mengganti bukti untuk `laporan_id` itu.

Pesan lain di percakapan tetap terenkripsi. `apps/api/src/routes/report.ts` tidak diubah; rute
baru memakai ulang `ReportStore` dan verifikasi `Report` yang sama.

## 9. Mobile

Semua di `apps/mobile/src/pesan/` dan `apps/mobile/app/pesan/`.

| Berkas | Tanggung jawab |
|---|---|
| `src/pesan/sesi.ts` | Tanda tangan `KunciPesan`, penurunan kunci, pendaftaran (idempoten), menyimpan kunci di memori |
| `src/pesan/pesan-api.ts` | `fetch` dengan tiga header autentikasi |
| `src/pesan/pesan-actions.ts` | **Satu-satunya** tempat pesan dienkripsi dan dikirim |
| `src/pesan/push.ts` | Izin + token push best-effort; ketuk notifikasi → `/pesan` |
| `app/pesan/index.tsx` | Daftar percakapan: nama, pratinjau terdekripsi, belum dibaca; muat saat fokus + tiap 15 detik |
| `app/pesan/[address].tsx` | Percakapan: gelembung, kolom tulis 2000 karakter, polling 4 detik selama fokus, tandai dibaca, menu Blokir / Lapor |
| `app/pesan/lapor/[address].tsx` | Pilih pesan + alasan + peringatan |
| `app/index.tsx` (ubah) | Tautan "Pesan" berlencana belum-dibaca |
| `app/profile/[address].tsx` (ubah) | Tombol "Kirim pesan" bila `/connected/:a/:b` benar |
| `src/messages.ts` (ubah) | `pesanErrorMessage` dan teks tombol, fungsi murni |

Pola yang wajib diikuti: signer di-memo, **satu** pemicu muat per layar (`useFocusEffect`), tidak
ada interval yang berjalan saat layar tidak fokus, logika yang bisa diuji diekstrak jadi fungsi
murni (tanpa tes render — repo ini tidak punya harness-nya, spec 4a R4). Izin notifikasi baru
diminta saat layar pesan pertama kali dibuka. Kegagalan push tidak pernah ditampilkan sebagai
galat.

Dependensi baru mobile: `expo-notifications`, `@noble/curves`, `@noble/hashes`, `@noble/ciphers`.
Tidak ada native module baru di luar yang didukung Expo Go.

## 10. Yang Sengaja TIDAK Ada di Fase Ini

- gambar, lampiran, edit, hapus pesan
- tanda "sudah dibaca" untuk pengirim, indikator mengetik, reaksi, grup
- forward secrecy, rotasi kunci, multi-versi kunci
- Notification Service Extension, development build
- pesan ke orang yang belum terkoneksi — termasuk yang sudah "cocok" lewat ingin bertemu
- signer dompet sungguhan (belum dirakit di aplikasi sejak awal)
- panel peninjauan laporan untuk admin

## 11. Batas yang Diakui

**11.1 Server melihat metadata.** Siapa berkirim ke siapa, kapan, dan kira-kira seberapa panjang.
Isinya tidak. Jangan pernah mengklaim "server tidak tahu apa pun".

**11.2 Tanpa forward secrecy.** Siapa pun yang memperoleh tanda tangan `KunciPesan` — atau kunci
privat yang diturunkan darinya — bisa membaca seluruh riwayat, dulu dan nanti.

**11.3 Phishing tanda tangan.** Situs yang meniru domain EIP-712 Nearly bisa meminta pengguna
menandatangani `KunciPesan`. Nama tipe dan medan `versi` membantu dompet menampilkannya, tapi
tidak mencegahnya. Risiko ini bawaan dari keputusan menurunkan kunci dari tanda tangan.

**11.4 Hanya dompet EOA.** Penurunan ulang butuh tanda tangan deterministik (RFC 6979). Dompet
smart contract tidak menjaminnya; di sana kunci bisa berubah antar-perangkat.

**11.5 Nama pengirim terlihat pihak ketiga.** Expo dan Apple melihat nama tampilan pengirim dan
waktu pengirimannya. Nama bisa muncul di layar kunci bila pengguna mengubah pratinjau iOS dari
bawaannya ("When Unlocked"). Menampilkan nama tanpa melewati pihak ketiga butuh Notification
Service Extension, jadi butuh development build.

**11.6 Push belum tentu jalan di Expo Go SDK 57.** Dokumentasi Expo mengarahkan push ke development
build, dan kredensial APNs untuk aplikasi sendiri butuh akun Apple Developer berbayar. Polling
adalah fondasinya; push hanya tambahan.

**11.7 Kita memiliki komposisi kriptonya.** Primitifnya dari pustaka yang diaudit, tapi
penyusunannya (§5) ditulis di repo ini, bukan protokol jadi.

**11.8 Bukti laporan membuktikan kepengarangan, bukan kecocokan ciphertext.** Server membuktikan
terlapor menulis teks itu untuk pelapor pada `dikirimMs`. Server tidak membuktikan teks itu sama
dengan ciphertext tersimpan — itu butuh kunci percakapan. Tanda tangan yang mengikat pengirim,
penerima, dan isi sudah cukup untuk peninjauan.

**11.9 Yang diblokir bisa menyimpulkan.** Mengirim selagi terblokir ditolak `403 terblokir`, dan
percakapannya hilang. Sama seperti spec 4a §10.2: blokir senyap berarti tanpa pemberitahuan,
bukan tidak bisa ditebak.

**11.10 Rem laju hanya per pengirim.** Akun sekali pakai tidak bisa berkirim pesan tanpa koneksi
fisik, jadi rem per pengirim cukup untuk 4c.

## 12. Verifikasi

**Tes otomatis**

- Kripto (shared): enkripsi-dekripsi pulang-pergi; kunci salah, ciphertext diubah, AAD ditukar
  → gagal; penurunan deterministik; tanda amplop dan tanda request tervalidasi dan menolak
  perubahan satu byte; penyandian kanonik dengan isi berbaris baru.
- Typehash: 24 tipe dalam dua blok `it` terpisah (jumlah vs tabrakan); tanpa pasangan Solidity;
  silang tipe `KunciPesan` dan `DaftarKunciPesan`.
- API gerbang: bukan koneksi ditolak **sebelum** keberadaan kunci terungkap; terblokir dua arah;
  `pesan_diri`; `429`; idempoten `id`; `413`.
- API autentikasi: tanda cacat → 401 bukan 500; `ts` di luar jendela; kunci tak dikenal; badan
  diubah setelah ditandatangani.
- Daftar percakapan membuang koneksi terblokir dan bukan-koneksi; status dibaca; belum-dibaca.
- Push: isi memuat nama / fallback, tidak pernah alamat atau isi; digabung per pengirim; token
  mati dihapus; kegagalan push tidak menggagalkan pengiriman.
- Laporan: bukti palsu, penerima salah, `pesanId` fiktif, tanda tangan dari kunci lain → `422`
  tanpa pencatatan; laporan tetap bisa dikirim setelah memblokir.
- Penjaga struktural `sig-rusak` mencakup verifikasi Ed25519.

**Uji lapangan** (pola 4a): skrip dua dompet terhadap API dan Supabase sungguhan dengan enkripsi
asli dari `packages/shared` — kirim, baca, dekripsi, blokir memutus, cabut blokir mengembalikan,
lapor dengan bukti asli dan bukti palsu, dan probe privasi (bukan koneksi tidak bisa membedakan
"belum siap" dari "tidak terhubung"). Push diuji manual di iPhone lewat Expo Go.

**Migrasi** `0007_pesan.sql` diterapkan oleh pemilik project **sebelum** API dari branch ini
dijalankan.

## 13. Perbaikan Spec Induk yang Termasuk Ruang Lingkup

Di `docs/superpowers/specs/2026-09-03-nearly-design.md`:

- **§7.5** — ganti XMTP dengan relay sendiri + E2E, rujuk spec ini §2.1. Butir "tanpa spam
  ditegakkan di sisi client" menjadi "ditegakkan di server". Butir blokir: "mencabut vouch"
  menjadi "menghentikan pengaruh vouch pada skor", rujuk §8.1.
- **Tabel teknologi dan tumpukan mobile** — hapus `@xmtp/react-native-sdk`.
- **§14 butir 5** — ketiga batas XMTP diganti rujukan ke §11 spec ini; catatan "Expo Go tidak
  bisa dipakai" dihapus karena fase ini tidak menambah native module.
- **Uji gerbang pesan dan uji blokir** di bagian verifikasi spec induk — "penegakan sisi client"
  menjadi "penegakan server".

## 14. Langkah Berikutnya

Tinjau spec tertulis ini, lalu susun rencana implementasi dengan `superpowers:writing-plans`.
