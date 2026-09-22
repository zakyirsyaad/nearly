# Nearly Fase 4b + 5 — Radar, Visibilitas, Notifikasi Kedekatan: Design Spec

**Tanggal:** 2026-09-14
**Status:** disetujui pemilik project (brainstorming 2026-09-14), menunggu review tertulis
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Dikerjakan paralel dengan:** Fase 6 — Demo (`2026-09-14-nearly-fase-6-demo-design.md`)

---

## 1. Posisi dalam Roadmap

Spec induk §11 menaruh radar dan mode visibilitas di **Fase 4**, dan notifikasi proximity di
**Fase 5**. Fase 4 sudah dipecah (spec 4a §1): 4a blokir dan 4c pesan tuntas; yang tersisa **4b —
radar & visibilitas**. Fase 5 hampir seluruhnya sudah dikerjakan lebih awal di 3b (feed, gambar,
lapor unggahan) dan 3c (ingin bertemu); yang tersisa **hanya notifikasi proximity**.

Keduanya digabung dalam satu spec karena saling bergantung: notifikasi kedekatan harus tunduk pada
mode visibilitas, dan keduanya dipicu oleh data yang sama — kehadiran seseorang di acara. Dua spec
terpisah yang dikerjakan bersamaan akan membuat salah satunya dibangun di atas tebakan, dan
tebakan soal privasi adalah yang menghasilkan dua temuan Critical di Fase 4a.

Spec ini juga menambahkan **pengaturan nama tampilan**. API hari ini hanya membaca
`profiles.display_name` dan tidak punya jalur tulis, sehingga semua orang tampil "Tanpa nama" —
di radar, di notifikasi, dan di layar proyektor Fase 6.

Fase ini dikerjakan **paralel dengan Fase 6** di sesi eksekusi terpisah. Batas jalur di §12
wajib dipatuhi.

## 2. Keputusan yang Terkunci

Diputuskan pemilik project saat brainstorming. Tidak dibuka ulang saat implementasi.

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Siapa yang muncul di radar | Sudah **check-in terverifikasi** di acara yang **sedang berlangsung** DAN **masih di area acara** (detak dalam 15 menit terakhir) |
| 2 | Default visibilitas | **Terlihat** |
| 3 | Aturan Tersembunyi | **Timbal balik**: tidak muncul di radar, **tidak bisa membuka radar**, tidak memicu dan tidak menerima notifikasi kedekatan |
| 4 | Penerima notifikasi kedekatan | **Koneksi** (pernah bertemu) **dan** yang **saling ingin bertemu** — bukan tanda sepihak |
| 5 | Retensi lokasi 24 jam | Hapus jejak yang **tidak dipakai trust**: kehadiran, notifikasi kedekatan, sel di QR salaman & QR check-in yang kedaluwarsa. Sel di `connections` & `checkins` dipertahankan (§10) |
| 6 | Nama tampilan | Dikerjakan **di fase ini** |
| 7 | Istilah | **"Tersembunyi"**, bukan "hantu" / "ghost" — di spec, kode yang terlihat pengguna, dan salinan UI |

Keputusan teknis yang diambil saat menulis spec ini (bisa ditinjau di review spec):

- **R1.** Detak dan radar diautentikasi dengan tanda tangan sesi Ed25519 Fase 4c
  (`pemanggilPesan`, header `x-nearly-who/ts/tanda`), bukan bukti EIP-712 per request —
  polling 10 detik tidak boleh memunculkan popup dompet.
- **R2.** Satu tipe EIP-712 tulis baru, `AturProfil` (nama + visibilitas sekaligus). Tidak ada tipe
  baca baru. Total tipe menjadi **25**.
- **R3.** Penghapusan data lokasi dijalankan **API sendiri** secara oportunistik + alat CLI, bukan
  `pg_cron`: `pg_cron` belum tentu aktif di project Supabase, dan fase ini tidak boleh bergantung
  pada pengaturan akun.
- **R4.** Radar memakai **polling 10 detik** (spec induk §11.1 butir 5), bukan Supabase Realtime.

## 3. Konsep

**Hadir sekarang.** Seseorang hadir di acara E pada saat t bila semua benar:

1. E sedang berlangsung pada t (`isEventLive`, `packages/shared/src/geofence.ts:32`);
2. ia sudah check-in terverifikasi di E (`checkins`, Fase 3a);
3. visibilitasnya `terlihat`;
4. ada baris `kehadiran` untuk (E, dia) dengan `seen_at ≥ t − 15 menit`.

Baris `kehadiran` hanya tercipta dari detak yang lolos seluruh gerbang §5.1, termasuk sel HP di
dalam geofence acara.

**Detak.** Laporan dari HP selagi layar Radar terbuka: sel geohash7 (±150 m) hasil
`getCurrentCell()` (`apps/mobile/src/location.ts:15`). HP tidak pernah mengirim koordinat presisi —
aturan yang sama sejak Fase 1.

**Radar.** Daftar kartu orang yang hadir sekarang di acara yang sama. **Bukan peta, tanpa jarak,
tanpa arah, tanpa jam detak** (spec induk: "Tidak ada peta berisi pin orang").

**Terlihat / Tersembunyi.** Satu saklar per akun, bukan per acara.

**Notifikasi kedekatan.** Push saat seseorang *baru* hadir, kepada orang yang juga hadir dan punya
hubungan dengannya (§6).

## 4. Model Data — migrasi `0008_radar.sql`

Satu berkas migrasi. **Pemilik project yang menerapkannya**; sesi eksekusi hanya menulisnya.

### 4.1 `profiles.visibilitas`

```sql
alter table profiles
  add column if not exists visibilitas text not null default 'terlihat'
    check (visibilitas in ('terlihat', 'tersembunyi'));
```

`display_name` tetap tanpa kolom baru; aturan isinya ditegakkan di API (§7.2), karena kolomnya sudah
ada sejak `0001` dengan default `''`.

### 4.2 `kehadiran`

```sql
create table if not exists kehadiran (
  event_id text not null references events(event_id) on delete cascade,
  address  text not null check (address ~ '^0x[0-9a-f]{40}$'),
  cell     char(7) not null,
  seen_at  timestamptz not null default now(),
  primary key (event_id, address)
);
create index if not exists kehadiran_event_seen on kehadiran (event_id, seen_at);
alter table kehadiran enable row level security;
```

Satu baris per (acara, orang), di-upsert setiap detak. **Bukan riwayat**: detak baru menimpa yang
lama, jadi tabel ini tidak pernah bisa merekonstruksi jalur gerak seseorang. `cell` disimpan hanya
untuk memeriksa geofence detak berikutnya dan dihapus bersama barisnya (§4.5).

### 4.3 `notif_kedekatan`

```sql
create table if not exists notif_kedekatan (
  event_id text not null references events(event_id) on delete cascade,
  penerima text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
  subjek   text not null check (subjek ~ '^0x[0-9a-f]{40}$'),
  sent_at  timestamptz not null default now(),
  primary key (event_id, penerima, subjek)
);
create index if not exists notif_kedekatan_penerima on notif_kedekatan (event_id, penerima);
alter table notif_kedekatan enable row level security;
```

Mencatat bahwa penerima sudah diberi tahu tentang subjek di acara itu — dasar "sekali per pasangan
per acara" dan batas 5 per orang per acara (§6.3). Karena setiap baris juga membuktikan **dua orang
berada di acara yang sama pada jam itu**, tabel ini diperlakukan sebagai data lokasi dan ikut
dihapus ≤ 24 jam.

Penghapusan berdasarkan `sent_at < now() − 24 jam` aman terhadap aturan "sekali per acara": acara
berdurasi paling lama 24 jam (`schema.ts:117`) dan `sent_at ≥ starts_at`, sehingga saat baris
terhapus acaranya pasti sudah selesai.

### 4.4 Sel di QR salaman dan QR check-in

```sql
alter table handshake_offers alter column cell drop not null;
alter table checkin_offers   alter column cell drop not null;
```

**Barisnya tidak dihapus — hanya selnya dikosongkan.** Keberadaan baris QR adalah yang menolak
nonce dipakai ulang (`handshake-gate.ts:34` → `nonce_used`; `event-gate.ts:141`). Menghapus baris
akan membuka replay; mengosongkan sel tidak.

Pemetaan store (`db.ts` / `event-store.ts`) wajib menerima `cell = null` dan memetakannya ke string
kosong. Gerbang yang ada **tidak diubah**: QR yang selnya sudah dikosongkan pasti sudah kedaluwarsa
≥ 24 jam, sehingga gerbang menolaknya di pemeriksaan kedaluwarsa sebelum sampai ke ko-lokasi. Tes
wajib membuktikan offer bersel kosong tidak pernah menghasilkan sukses (§11).

### 4.5 Penyapuan lokasi

Satu fungsi store, `sapuLokasi(nowMs)`, menjalankan empat pernyataan:

| Target | Kondisi |
|---|---|
| `delete from kehadiran` | `seen_at < now − 24 jam` |
| `delete from notif_kedekatan` | `sent_at < now − 24 jam` |
| `update handshake_offers set cell = null` | `expires_at < now_detik − 86400` dan `cell is not null` |
| `update checkin_offers set cell = null` | `expires_at < now_detik − 86400` dan `cell is not null` |

Dipanggil (R3):

1. saat API mulai berjalan;
2. oportunistik dari rute detak, **paling sering sekali per 10 menit** per proses (penanda waktu di
   memori), tanpa `await` dan dijamin tidak pernah melempar — kegagalannya dicatat, detak tetap
   berhasil;
3. lewat `apps/api/tools/sapu-lokasi.ts` untuk dijalankan pemilik project secara manual atau dari
   cron VPS.

Janji spec induk "≤ 24 jam" berarti **paling lambat 24 jam + interval sapuan**. Selama API hidup dan
menerima detak, interval itu ≤ 10 menit; tanpa lalu lintas, sapuan saat start dan cron VPS menutup
celahnya. Ini dicatat di §10.

## 5. Gerbang

### 5.1 `POST /radar/:eventId/detak`

Badan: `{ cell }`. Autentikasi: header sesi Ed25519 (R1).

Urutan pemeriksaan — **pertama yang gagal menang**:

| # | Pemeriksaan | Gagal → |
|---|---|---|
| 1 | Header sesi sah (`pemanggilPesan`) | 401 `butuh_autentikasi` |
| 2 | Badan valid; `cell` geohash7 | 400 `invalid_body` |
| 3 | Acara ada | 404 `event_not_found` |
| 4 | Acara sedang berlangsung | 409 `event_tidak_berlangsung` |
| 5 | Pemanggil sudah check-in di acara | 403 `belum_check_in` |
| 6 | Laju: detak terakhir pemanggil untuk acara ini ≥ 20 detik lalu | 429 `terlalu_cepat` |
| 7 | Visibilitas pemanggil `terlihat` | 200 `{ hadir: false, alasan: "tersembunyi" }` + hapus baris kehadiran pemanggil di acara ini |
| 8 | `isInsideGeofence(events.center_cell, cell)` | 200 `{ hadir: false, alasan: "di_luar_area" }` + hapus baris kehadiran pemanggil di acara ini |
| 9 | — | upsert kehadiran → 200 `{ hadir: true }` |

Langkah 7 dan 8 **bukan galat**: HP memang boleh berdetak saat tersembunyi atau di luar area, dan
jawabannya memberi tahu layar apa yang harus ditampilkan. Menghapus baris di dua langkah itu yang
membuat orang langsung hilang dari radar saat pindah ke Tersembunyi atau keluar area, tanpa
menunggu 15 menit.

Setelah upsert pada langkah 9: bila **sebelum** upsert pemanggil tidak hadir (tidak ada baris, atau
`seen_at` lebih tua dari 15 menit), rute memanggil `kirimNotifKedekatan` **tanpa await** (§6), lalu
memicu `sapuLokasi` bila jatahnya sudah tiba (§4.5).

Laju langkah 6 dihitung dari `seen_at` baris yang ada, sehingga tidak butuh tabel atau memori
tambahan. HP berdetak setiap 60 detik; 20 detik memberi ruang untuk layar yang dibuka-tutup.

### 5.2 `GET /radar/:eventId`

Autentikasi: header sesi Ed25519 (R1).

| # | Pemeriksaan | Gagal → |
|---|---|---|
| 1 | Header sesi sah | 401 `butuh_autentikasi` |
| 2 | Acara ada | 404 `event_not_found` |
| 3 | Acara sedang berlangsung | 409 `event_tidak_berlangsung` |
| 4 | Pemanggil sudah check-in | 403 `belum_check_in` |
| 5 | Visibilitas pemanggil `terlihat` | 403 `tersembunyi` |
| 6 | Pemanggil **hadir sekarang** (§3) | 403 `belum_hadir` |
| 7 | — | 200 daftar kartu |

Langkah 5 dan 6 menegakkan timbal balik: siapa pun yang bisa melihat radar juga sedang terlihat di
radar yang sama. Tidak ada cara mengintip tanpa ikut tampil.

Isi daftar — semua orang yang **hadir sekarang** di acara ini, dengan penyaringan:

1. bukan pemanggil;
2. visibilitas `terlihat` **dibaca saat permintaan**, bukan dari baris kehadiran — pindah ke
   Tersembunyi berlaku seketika;
3. tidak ada blokir **dua arah** dengan pemanggil (`himpunanUntuk`, `ports.ts:398`), sama seperti
   daftar kecocokan dan feed;
4. paling banyak **200 kartu**.

Bentuk respons:

```json
{
  "kartu": [
    {
      "address": "0x…",
      "displayName": "Budi",
      "tierLabel": "Terpercaya",
      "pernahBertemu": true,
      "salingInginBertemu": false
    }
  ],
  "jumlah": 1
}
```

- `pernahBertemu`: ada baris `connections` antara pemanggil dan orang itu — satu kueri untuk seluruh
  daftar, bukan satu per kartu.
- `salingInginBertemu`: irisan `tandaOleh(pemanggil)` dan `tandaKe(pemanggil)` (`MeetStore`), dengan
  penyaringan blokir yang sama seperti daftar kecocokan 3c.
- Nama dan tier dari `profilRingkas` (`meet-store.ts:212`).
- Urutan: saling ingin bertemu → pernah bertemu → tier tertinggi → alamat.

Yang **tidak pernah** ada di respons: `cell`, `seen_at`, jumlah detak, jarak, skor trust mentah, dan
siapa saja yang disembunyikan oleh blokir. Tes route wajib memeriksa **nama kunci JSON**, bukan hanya
nilainya (§11).

*Diamandemen 2026-09-18 (spec desain UI `2026-09-18-nearly-desain-ui-design.md` §8.3):* kartu dengan
`pernahBertemu === false` boleh membawa `koneksiBersama` — **angka** koneksi bersama, hanya bila ≥ 1,
dihitung setelah saringan visibilitas dan blokir, tanpa nama atau alamat siapa pun; kartu koneksi tidak
pernah membawanya. Daftar "yang tidak pernah ada" di atas tetap berlaku.

### 5.3 Pemanggil tanpa kunci sesi

Kedua rute bergantung pada `kunci_pesan` pemanggil (R1). HP mendaftarkannya lewat `sesiPesan` sebelum
berdetak (§8.2). Pemanggil tanpa kunci terdaftar mendapat 401 yang sama dengan tanda tangan salah —
tidak dibedakan, mengikuti `pesan-auth.ts`.

## 6. Notifikasi Kedekatan

### 6.1 Pemicu

Transisi **tidak hadir → hadir** subjek S di acara E (§5.1 langkah 9). Detak lanjutan dari orang yang
sudah hadir tidak memicu apa pun.

### 6.2 Penerima

Semua R yang memenuhi sekaligus:

1. R **hadir sekarang** di E (§3) — termasuk visibilitas `terlihat`;
2. R ≠ S;
3. tidak ada blokir dua arah antara R dan S;
4. R dan S **pernah bertemu** (baris `connections`) **atau** **saling ingin bertemu**.

Notifikasi dikirim **ke dua arah**: R diberi tahu tentang S, dan S diberi tahu tentang R. Tanpa arah
kedua, orang yang datang belakangan tidak pernah tahu siapa yang sudah menunggunya.

### 6.3 Penggabungan dan batas

Untuk setiap arah (penerima P, subjek Q):

1. `insert into notif_kedekatan (event_id, penerima, subjek) … on conflict do nothing`; kirim hanya
   bila baris **benar-benar tersisip** — sekali per pasangan per acara;
2. sebelum menyisip, hitung baris `(E, P)`; bila sudah **5**, lewati — paling banyak 5 notifikasi per
   orang per acara. Hackathon 300 orang bisa berisi puluhan koneksi lama; tanpa batas, notifikasi
   berubah jadi spam dan dimatikan.

Dua arah diproses berurutan dalam satu pemanggilan; tidak ada antrean.

### 6.4 Isi

Judul: `Nearly`. Badan, sesuai hubungan terkuat (saling ingin bertemu mengalahkan pernah bertemu):

| Hubungan | Dengan nama | Tanpa nama |
|---|---|---|
| Saling ingin bertemu | `{nama}, yang saling ingin bertemu denganmu, ada di acara ini.` | `Seseorang yang saling ingin bertemu denganmu ada di acara ini.` |
| Pernah bertemu | `{nama}, yang pernah kamu temui, ada di acara ini.` | `Seseorang yang pernah kamu temui ada di acara ini.` |

Data tersembunyi: `{ jenis: "radar", eventId }`. **Tidak pernah**: alamat, judul atau lokasi acara,
sel. Nama sengaja ikut, mengikuti keputusan Fase 4c §7.2; konsekuensinya sama — Expo dan Apple
melihat nama itu (§10).

### 6.5 Sifat

`kirimNotifKedekatan` dipanggil tanpa await dan **dijamin tidak pernah melempar** (pola
`kirimPushPesan`, `pesan-push.ts`). Token diambil dengan `tokenPush` dan token mati dibersihkan dengan
`hapusTokenPush` — dipakai ulang lewat `Pick<PesanStore, "tokenPush" | "hapusTokenPush">`, **tanpa
memindahkan atau mengubah** kode Fase 4c. Kegagalan push dicatat; detak tetap 200.

## 7. Profil: Nama dan Visibilitas

### 7.1 Tipe EIP-712 `AturProfil` (R2)

```
AturProfil(address who, string displayName, string visibilitas, uint64 expiresAt)
```

Domain sama dengan `InginBertemu` (`packages/shared/src/meet.ts:90`). Tipe **tulis**. Nama tipe tidak
bertabrakan dengan tipe mana pun (Ruling 23). `JUMLAH_TIPE` di
`packages/shared/test/typehash-semua.test.ts` naik dari 24 ke **25**, dan tipe ini tidak boleh muncul
di Solidity (tes yang sama).

### 7.2 `POST /profil`

Badan: `{ who, displayName, visibilitas, expiresAt, sig }`.

| # | Pemeriksaan | Gagal → |
|---|---|---|
| 1 | Badan valid | 400 `invalid_body` |
| 2 | `expiresAt` belum lewat dan ≤ sekarang + 1 jam | 410 `expired` |
| 3 | Tanda tangan dipulihkan ke `who` (`pulihkanTandaTangan`) | 401 `bad_signature` |
| 4 | Nama sah (aturan di bawah) | 400 `nama_tidak_sah` |
| 5 | — | upsert `profiles` → 200 `{ ok: true }` |

Aturan nama, setelah `trim()`:

- panjang **0–32 code point** (0 = menghapus nama);
- **tidak boleh** memuat karakter kategori Unicode `Cc` (kontrol) atau `Cf` (format) — termasuk
  penanda arah teks (U+202A–U+202E, U+2066–U+2069) dan karakter lebar-nol. Karakter itu bisa membalik
  urutan tampilan di sebelah alamat dan dipakai menyamar;
- tidak unik — tetap aturan spec induk §9.2; alamat selalu tampil di sebelah nama.

Bila `visibilitas` berubah menjadi `tersembunyi`, rute menghapus **semua** baris `kehadiran` milik
`who`, lalu menjawab. Radar orang lain tidak lagi menampilkannya di polling berikutnya.

Validasi nama ditaruh di `packages/shared` sebagai fungsi murni, dipakai API dan layar mobile, supaya
kedua sisi tidak berselisih soal nama yang sah.

### 7.3 `GET /profil/saya`

Autentikasi: header sesi Ed25519. Respons `{ displayName, visibilitas }` milik pemanggil, untuk mengisi
layar Profil saya. Tidak ada cara membaca visibilitas orang lain — visibilitas orang lain hanya
terlihat lewat ada atau tidaknya kartunya di radar.

## 8. Mobile

### 8.1 Layar

| Rute | Isi |
|---|---|
| `app/profil-saya.tsx` | Isian nama (penghitung 32), saklar **Terlihat / Tersembunyi** dengan penjelasan satu kalimat untuk tiap mode, tombol Simpan |
| `app/radar/[eventId].tsx` | Radar acara |
| `app/events/[id].tsx` (ubah) | Tombol **Buka radar** saat acara berlangsung dan pemanggil sudah check-in |
| `app/index.tsx` (ubah) | Tautan ke Profil saya |

Rute radar sengaja `app/radar/[eventId].tsx`, bukan di bawah `app/events/[id]/`, supaya tidak
bertabrakan dengan berkas `app/events/[id].tsx` yang sudah ada.

Judul layar didaftarkan di `app/_layout.tsx` (pola `adaf0d8`): **Radar**, **Profil saya**.

### 8.2 Perilaku layar Radar

Saat layar mendapat fokus:

1. `sesiPesan(signer)` — mendaftarkan kunci sesi bila belum;
2. `daftarkanPush(sesi)` (Fase 4c) — best-effort;
3. `getCurrentCell()` → detak;
4. bila `hadir: true` → ambil radar.

Selama fokus: detak setiap **60 detik**, radar setiap **10 detik**. Saat kehilangan fokus: kedua timer
berhenti. Tidak ada detak dari latar belakang (§10).

Keadaan layar, masing-masing dengan kalimat sendiri di `messages.ts`:

| Keadaan | Tampilan |
|---|---|
| `alasan: "tersembunyi"` / 403 `tersembunyi` | "Kamu sedang Tersembunyi, jadi radar tidak bisa dibuka." + tautan ke Profil saya |
| `alasan: "di_luar_area"` / 403 `belum_hadir` | "Kamu terlihat berada di luar area acara." |
| 403 `belum_check_in` | "Check-in dulu untuk membuka radar." |
| 409 `event_tidak_berlangsung` | "Radar hanya aktif selama acara berlangsung." |
| Daftar kosong | "Belum ada orang lain yang terlihat di sini." |
| Izin lokasi ditolak | "Radar butuh izin lokasi saat aplikasi dibuka." |
| `server_tak_terjangkau` | kalimat yang sudah ada (`0d8a0cd`) |

Kartu radar menampilkan nama (atau "Tanpa nama"), alamat singkat, label tier, dan lencana *Saling
ingin bertemu* / *Pernah bertemu*. Mengetuk kartu membuka `profile/[address]`. Tidak ada tombol pesan
di kartu: pesan tetap hanya lewat koneksi, dan tombol itu sudah ada di profil.

### 8.3 Push

`ruteDariNotifikasi` (`apps/mobile/src/pesan/rute-push.ts`) menerima `jenis: "radar"` dengan `eventId`
yang sah → `/radar/<eventId>`. Data tanpa `eventId` sah → `null`, tidak membuka apa pun.

### 8.4 Izin lokasi

`NSLocationWhenInUseUsageDescription` di `app.json` diperbarui supaya menyebut radar selain salaman.
Di Expo Go kalimat ini milik Expo Go; perubahan berlaku untuk development build kelak.

## 9. Yang Sengaja TIDAK Ada di Fase Ini

- Peta, jarak, arah, atau urutan berdasarkan kedekatan.
- Lokasi latar belakang, `expo-task-manager`, geofencing OS.
- Supabase Realtime (R4).
- Riwayat kehadiran, "siapa melihat radarmu", atau jejak "terakhir terlihat".
- Visibilitas per acara, per orang, atau "terlihat hanya untuk koneksi".
- Penyaring trust di radar (spec induk sengaja tidak menyaring trust-nol, lihat §7.6 induk).
- Menghapus atau mengaburkan sel di `connections` dan `checkins` (keputusan #5).
- Ekspor dan hapus data satu tap (spec induk §14 butir 8) — tetap wajib sebelum pengguna publik,
  tapi di luar fase ini.

## 10. Batas yang Diakui

1. **Kehadiran hanya tercatat saat aplikasi terbuka.** Expo Go tidak punya lokasi latar belakang.
   Orang yang mengunci HP hilang dari radar setelah 15 menit, dan kedatangannya baru memicu
   notifikasi saat ia membuka Radar.
2. **Sel dilaporkan HP.** Orang yang sudah check-in sah bisa memalsukan sel untuk "tetap hadir"
   setelah pulang. Check-in itu sendiri tetap diverifikasi ko-lokasi dengan host (Fase 3a); detak tidak.
3. **Tersembunyi hanya menyembunyikan dari radar dan notifikasi kedekatan.** Salaman dan check-in
   tetap tercatat publik on-chain (`Connected`, `CheckedIn`) dan bisa tampil di layar graf Fase 6.
   Layar Profil saya wajib menyebut ini dalam satu kalimat.
4. **Radar membocorkan pola waktu.** Orang yang hadir bisa mengamati kapan seseorang muncul dan
   menghilang dari daftar. Ini melekat pada "hadir sekarang" dan menjadi alasan saklar Tersembunyi ada.
5. **Notifikasi kedekatan membuka kehadiranmu ke koneksi lama dan yang saling ingin bertemu** di
   acara yang sama — pilihan sadar pemilik project (keputusan #4).
6. **Nama di notifikasi terlihat oleh Expo dan Apple** (sama dengan spec 4c §11.5), sampai ada
   development build dengan Notification Service Extension.
7. **Janji 24 jam spec induk belum ditepati untuk `connections.cell` dan `checkins.cell`.** Keduanya
   dipakai sidik jari ko-lokasi trust (`load-graph.ts:163`). Menepatinya butuh perubahan
   `packages/trust` dan menjadi pekerjaan terpisah.
8. **"≤ 24 jam" berarti 24 jam + interval sapuan** (§4.5).
9. **Geofence ±460 m dan GPS dalam ruangan meleset 50–100 m** (spec induk §14): orang di tepi venue
   bisa berkedip keluar-masuk radar.

## 11. Verifikasi

**`packages/shared`**
- `AturProfil`: typed data, pemulihan, `JUMLAH_TIPE = 25`, tidak bertabrakan dan tidak ada di
  Solidity.
- Validasi nama: batas 32 code point (emoji dihitung per code point), trim, nama kosong sah, penolakan
  `Cc`/`Cf` termasuk U+202E dan U+200B.

**`apps/api`**
- Gerbang detak: **setiap langkah §5.1 punya tes**, dan tes urutan membuktikan pemeriksaan
  sebelumnya menang (mis. tersembunyi + di luar area + belum check-in → `belum_check_in`).
- Detak tersembunyi / di luar area **menghapus** baris kehadiran.
- Transisi tidak hadir → hadir memicu notifikasi tepat sekali; detak lanjutan tidak.
- Radar: timbal balik (tersembunyi → 403, belum hadir → 403); blokir satu arah **mana pun**
  menyembunyikan kartu; orang basi (> 15 menit) tidak tampil; pindah ke Tersembunyi berlaku seketika
  walau baris kehadiran masih ada.
- Radar: **tes nama kunci JSON** — respons tidak memuat `cell`, `seen_at`, atau skor.
- Notifikasi: penerima hanya koneksi atau saling ingin bertemu (tanda **sepihak tidak**), dua arah,
  sekali per pasangan per acara, batas 5 per orang per acara, isi tanpa alamat, tidak pernah
  melempar.
- `POST /profil`: urutan gerbang, pemulihan tanda tangan salah → 401 bukan 500, nama bidi → 400,
  pindah ke Tersembunyi menghapus seluruh kehadiran `who`.
- **Tes privasi retensi (spec induk §13):** `sapuLokasi` dengan jam palsu menghapus kehadiran dan
  notifikasi > 24 jam, mengosongkan sel offer > 24 jam lewat kedaluwarsa, **tidak** menyentuh
  `connections` dan `checkins`, dan tidak menghapus baris offer.
- Offer bersel kosong (hasil sapuan) di gerbang salaman dan check-in tidak pernah sukses.
- Langkah mutasi dijalankan sungguhan untuk: timbal balik radar, blokir dua arah, batas 5 notifikasi,
  dan pengecualian `connections`/`checkins` dari sapuan.

**`apps/mobile`**
- Fungsi murni: pemetaan keadaan layar → kalimat, `ruteDariNotifikasi` untuk `radar`, label lencana
  kartu, penghitung nama.

**Uji lapangan (pemilik project, setelah migrasi diterapkan)** — dua HP, satu acara uji yang sedang
berlangsung, keduanya check-in:

1. Keduanya membuka Radar → saling melihat kartu.
2. A pindah ke Tersembunyi → kartu A hilang dari radar B dalam ≤ 10 detik; A tidak bisa membuka radar.
3. A kembali Terlihat → A dan B yang pernah bertemu saling menerima notifikasi kedekatan sekali.
4. B keluar area (atau memalsukan sel di luar geofence lewat skrip) → hilang dari radar A.
5. A memblokir B → saling tidak terlihat.
6. Nama diatur di Profil saya → tampil di kartu radar dan di notifikasi.

## 12. Batas Jalur Paralel dengan Fase 6

Fase 6 dikerjakan bersamaan di worktree dan branch lain. Aturan untuk jalur ini:

| | Jalur ini (4b + 5) | Jalur Fase 6 |
|---|---|---|
| Branch / worktree | `fase-4b5-radar` | `fase-6-demo` |
| Migrasi | **`0008_radar.sql`** saja | `0009_*` |
| Tipe EIP-712 | +1 (`AturProfil`) → 25 | tidak menambah |
| `apps/mobile` | ya | tidak menyentuh |
| `apps/web` | **tidak menyentuh** | ya |
| `apps/api` | `routes/radar.ts`, `routes/profil.ts`, store baru, `db.ts` & `event-store.ts` (pemetaan sel null) | `routes/graf.ts`, CORS, alat seed |

Berkas bersama yang disentuh kedua jalur — **hanya penambahan, di akhir blok yang ada**, tanpa
mengubah atau memindahkan baris yang sudah ada: `apps/api/src/ports.ts`, `apps/api/src/app.ts`,
`apps/api/src/index.ts`, `apps/api/test/support/deps.ts`, `packages/shared/src/index.ts`. Konflik merge
di berkas-berkas ini diharapkan kecil dan diselesaikan oleh jalur yang merge **kedua**, dengan
menjalankan ulang seluruh tes setelah rebase.

Jalur ini **tidak** mengubah: `packages/trust`, `packages/contracts`, `apps/api/src/handshake-gate.ts`,
`apps/api/src/event-gate.ts`, `apps/api/src/trust/**`, dan seluruh kode pesan Fase 4c selain
memanggilnya.

## 13. Perbaikan Spec Induk yang Termasuk Ruang Lingkup

Task terakhir rencana implementasi memperbarui `2026-09-03-nearly-design.md`:

1. **Istilah:** "hantu"/"ghost" → **Tersembunyi**; §11.1 butir 6 menyebut dua mode *Terlihat* dan
   *Tersembunyi*.
2. **§7.4 contoh notifikasi:** contoh "@0xghost yang kamu tandai…" (tanda sepihak) diganti aturan
   koneksi + saling ingin bertemu, dengan alasan vektor penguntitan.
3. **§10.2 / §10.4:** tabel `presence(ephemeral_id, geohash7, seen_at)` → `kehadiran(event_id,
   address, cell, seen_at)` satu baris per orang per acara; penghapusan oleh API + CLI, bukan pg_cron.
4. **Janji 24 jam:** dicatat jujur apa yang sudah ditegakkan dan pengecualian `connections`/`checkins`.
5. **Peta fase:** 4b tuntas; Fase 5 tuntas (feed di 3b, ingin bertemu di 3c, kedekatan di sini).

## 14. Langkah Berikutnya

1. Pemilik project me-review spec ini.
2. Rencana implementasi (`superpowers:writing-plans`) di branch `fase-4b5-radar`.
3. PR briefing untuk sesi `fcc`, dengan worktree terpisah dan batas jalur §12.
4. Pemilik project menerapkan `0008_radar.sql`, lalu uji lapangan §11.
