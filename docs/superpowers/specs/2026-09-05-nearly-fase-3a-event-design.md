# Nearly Fase 3a — Event & Kehadiran Terverifikasi: Design Spec

**Tanggal:** 2026-09-05
**Status:** Disetujui, siap masuk perencanaan implementasi
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/specs/2026-09-04-nearly-fase-2-trust-design.md` (tuntas, ter-deploy)

---

## 1. Posisi dalam Roadmap

Spec induk §11 menaruh satu fase bernama **Fase 3 — Event & "ingin bertemu"**. Isinya
sebenarnya dua subsistem yang tidak saling menyentuh: entitas event beserta kehadirannya,
dan penanda "ingin bertemu" beserta angkanya. Keduanya hanya bertemu di satu kalimat —
*"N orang yang ingin bertemu kamu akan hadir di event ini"* — dan kalimat itu baru mungkin
setelah event ada.

Karena itu Fase 3 dipecah:

- **Fase 3a (dokumen ini)** — event, RSVP, check-in terverifikasi, `AttendanceRegistry`,
  discovery, dan peralihan `occasionId` dari tebakan ke data.
- **Fase 3b (spec tersendiri, menyusul)** — penanda "ingin bertemu", angka publiknya,
  penyaring trust-nol, pengungkapan saat saling menandai, dan loop yang menutup keduanya.

**Kriteria selesai (spec induk §11):** seseorang bisa membuat event, orang lain RSVP, dan
check-in hanya berhasil kalau benar-benar berada di venue saat acara berlangsung.

**Kenapa fase ini strategis, bukan fitur tambahan.** Event adalah sisi pasokan seluruh
produk (spec induk §7.7): Nearly butuh orang berada di ruangan yang sama, dan tanpa fitur
ini kita menumpang event yang diadakan orang lain di platform lain. Fase ini juga membayar
utang teknis Fase 2 — faktor diversitas di spec induk §8 sejak awal membutuhkan informasi
"koneksi ini terjadi di event mana", dan sampai sekarang informasi itu masih ditebak dari
geohash.

## 2. Keputusan yang Terkunci

| Aspek | Keputusan |
|---|---|
| Ruang lingkup | Event & kehadiran saja; "ingin bertemu" pindah ke Fase 3b |
| Geofence | Sel geohash7 pusat + 8 tetangga (≈460 m × 460 m). Tanpa GPS presisi di server |
| On-chain | `createEvent` **dan** `checkIn`, keduanya di `AttendanceRegistry` |
| Bentuk kehadiran | Mapping + event log. **Bukan** ERC-721 |
| Check-in | Pindai QR host yang berputar 30 detik **dan** berada di dalam geofence |
| RSVP | **Wajib** sebelum check-in |
| Koneksi → event | Hanya kalau **kedua** pihak punya check-in terverifikasi di event itu |
| Discovery | Sembunyikan host ter-slash dan host tanpa koneksi; sisanya diurutkan skor host |
| Siapa boleh mengadakan | Siapa pun. Tidak ada gerbang (spec induk §7.7) |

### 2.1 Kenapa check-in memakai ritual QR yang sama dengan handshake

Rancangan awal memakai check-in mandiri: tamu menekan tombol, server memeriksa sel geohash
dan jendela waktu. Rancangan itu ditinggalkan karena hanya sekuat kejujuran perangkat —
satu aplikasi GPS palsu menembusnya dari rumah, dan seluruh klaim "kehadiran terverifikasi"
runtuh di pertanyaan pertama juri.

Check-in lewat QR host menuntut sesuatu yang tidak bisa dipalsukan dari jauh: **melihat
layar host.** Dan ini bukan mekanik baru — ini ritual Fase 1 yang sudah terbukti jalan di
perangkat nyata: QR bertanda tangan berumur 30 detik, dipindai pihak lain, kedua perangkat
mengirim selnya sendiri, server memverifikasi ko-lokasi. `packages/shared/src/qr.ts`,
`handshake.ts`, dan `colocation.ts` dipakai ulang apa adanya.

Konsekuensi yang lebih besar dari sekadar keamanan: **Nearly hanya punya satu primitif.**
Pertemuan fisik yang dibuktikan lewat QR + ko-lokasi. Koneksi memakainya; sekarang kehadiran
memakai primitif yang sama. Bukan dua sistem, satu sistem yang dipakai dua kali.

Dua lapisnya saling menambal:

- QR host menutup kelemahan GPS palsu — sel yang dipalsukan tidak memberimu QR yang berlaku.
- Geofence menutup kelemahan QR yang difoto — foto yang dikirim ke seberang kota tidak
  lolos, karena sel penerima di luar area.

Keduanya tetap bisa ditembus **bersamaan** (§13 butir 1). Yang berubah: curang sekarang
butuh dua kecurangan terkoordinasi, bukan satu aplikasi gratisan.

### 2.2 Kenapa RSVP wajib sebelum check-in

Ini keputusan pemilik project, diambil setelah argumen tandingannya disampaikan.

Argumen tandingnya: orang yang berdiri di venue sudah membuktikan hal yang lebih kuat
daripada orang yang menekan RSVP dari kasur, dan menolaknya berarti menolak bukti yang lebih
kuat demi bukti yang lebih lemah. Di meetup Web3, orang datang mendadak karena diajak teman
di tempat.

Argumen yang menang: host butuh daftar siapa yang akan datang, dan daftar itu baru punya
arti kalau kehadiran memang bagian darinya. Daftar hadir dijamin selalu himpunan bagian dari
daftar RSVP, sehingga tidak ada dua daftar yang harus direkonsiliasi.

Peredam yang disepakati: di layar detail event, tombol check-in **tidak pernah gagal diam-
diam**. Ia tampil nonaktif dengan keterangan "RSVP dulu untuk bisa check-in", jadi syaratnya
terbaca sebelum orang berdiri di depan host. Penolakannya sendiri tetap ditegakkan server
(`not_rsvped`); ini murni soal orang tidak dikagetkan.

Biayanya dicatat apa adanya di §13 butir 4.

### 2.3 Kenapa mapping, bukan ERC-721

Spec induk §5 menyebut hasil check-in sebagai "Proof of Attendance SBT". Fase ini menyimpan
kehadiran sebagai `mapping` plus event log, bukan token ERC-721 yang tidak bisa dipindahkan.

Alasannya biaya-manfaat: mapping sudah sepenuhnya bisa diverifikasi siapa pun di explorer,
sementara ERC-721 menambah 60–80 baris kontrak, `tokenURI` yang harus dibangkitkan on-chain
sebagai data URI, dan permukaan uji yang lebih luas — semuanya demi badge yang muncul di
dompet.

**Konsekuensi bahasa, dan ini harus dipatuhi:** jangan menyebut hasil check-in Fase 3a
sebagai SBT atau NFT, di spec maupun di depan juri. Sebutnya **catatan kehadiran on-chain**.
Melapisinya dengan ERC-721 tetap terbuka pasca-fase ini tanpa mengubah data yang sudah ada.

## 3. Arsitektur

```
packages/shared/          murni, tanpa I/O
  geofence.ts             isInsideGeofence, geofenceCells, isEventLive
  event.ts                tipe EIP-712: CreateEvent, CheckInOffer, CheckInAccept, Rsvp
  schema.ts               (+) skema zod untuk empat permintaan baru

packages/contracts/
  src/AttendanceRegistry.sol
  test/AttendanceRegistry.t.sol
  script/Deploy.s.sol     (+) deploy kontrak keempat

apps/api/src/
  event-gate.ts           seluruh aturan penolakan, memakai store palsu di test
  attendance-relayer.ts   cermin vouch-relayer.ts
  routes/events.ts        enam endpoint
  ports.ts                (+) EventStore, AttendanceChainPort
  trust/load-graph.ts     (M) occasionIdOf + rowsToGraph

apps/mobile/app/events/
  index.tsx               discovery
  new.tsx                 buat event
  [id].tsx                detail + RSVP + check-in
  [id]/host-qr.tsx        QR check-in milik host

supabase/migrations/
  0003_events.sql         empat tabel
```

`packages/trust` **tidak tersentuh sama sekali.** Seluruh perubahan pada mesin trust
terkurung di `apps/api/src/trust/load-graph.ts`. Ini memang dirancang begitu sejak Fase 2
(spec Fase 2 §2.1).

## 4. Model Data

`supabase/migrations/0003_events.sql`. Mengikuti dua migrasi sebelumnya: RLS menyala tanpa
satu pun policy publik, dan aturan ditegakkan lewat constraint database, bukan di kode
aplikasi.

### 4.1 `events`

| Kolom | Tipe | Catatan |
|---|---|---|
| `event_id` | `text` PK | `^0x[0-9a-f]{64}$`, identik dengan yang on-chain |
| `host` | `text` | FK ke `profiles(address)` |
| `title` | `text` | |
| `venue_label` | `text` | Nama tempat yang ditulis host. Bebas, tidak diverifikasi |
| `center_cell` | `char(7)` | Sel geohash7 tempat host berdiri saat membuat event |
| `starts_at` | `bigint` | unix **DETIK** — satuan yang sama dengan kontrak |
| `ends_at` | `bigint` | unix **DETIK** |
| `tx_hash` | `text` | |
| `created_at` | `timestamptz` | |

Constraint `events_window check (ends_at > starts_at)`.

**Daftar 9 sel geofence sengaja tidak disimpan.** Cukup `center_cell`; tetangganya dihitung
saat verifikasi. Menyimpan turunan yang bisa dihitung ulang hanya menciptakan dua sumber
kebenaran yang bisa berselisih.

### 4.2 `rsvps`

`(event_id, address)` sebagai primary key — itu saja yang menegakkan satu RSVP per orang per
event. `created_at`. Tidak ada kolom status: RSVP tidak bisa dibatalkan di fase ini (§14).

### 4.3 `checkin_offers`

Cermin `handshake_offers` dari Fase 1, dan alasan keberadaannya sama: menahan pemutaran ulang.

| Kolom | Tipe | Catatan |
|---|---|---|
| `nonce` | `text` PK | `^0x[0-9a-f]{64}$` |
| `event_id` | `text` | FK ke `events` |
| `host` | `text` | Penandatangan tawaran |
| `expires_at` | `bigint` | unix DETIK |
| `sig_host` | `text` | |
| `cell` | `char(7)` | Sel yang dikirim **host sendiri** saat menampilkan QR |
| `at_ms` | `bigint` | **MILIDETIK** |
| `consumed_at` | `timestamptz` | |

Indeks pada `expires_at`, sama seperti Fase 1.

### 4.4 `checkins`

`(event_id, address)` sebagai primary key — inilah yang menegakkan "check-in sekali, tidak
bisa diulang". Plus `nonce` (unik, menautkan ke tawaran yang dipakai), `cell` dan `at_ms`
yang dikirim tamu, dan `tx_hash`. Indeks tambahan pada `address`, karena `load-graph`
menanyakannya per-orang.

## 5. Geofence

Geohash membagi bumi jadi kotak dan memberi tiap kotak sebuah kode teks. Presisi 7 ≈ 153 m ×
153 m, sudah dipakai sejak Fase 1 (`packages/shared/src/geohash.ts`).

`geofenceCells(centerCell)` = sel pusat + 8 tetangganya = area ≈460 m × 460 m.
`isInsideGeofence(centerCell, deviceCell)` benar kalau `deviceCell` ada di himpunan itu.

Perangkat menghitung selnya sendiri dari GPS dan **hanya mengirim kodenya**. Server tidak
pernah menerima maupun menyimpan koordinat presisi — spec induk §10.2 dan prinsip keempat di
§6 tetap utuh.

**Kerapian yang muncul gratis:** hubungan bertetangga itu simetris. Untuk mencari event mana
yang memuat perangkat di sel `X`, server menghitung 9 sel di sekitar `X` sendiri lalu mencari
event yang `center_cell`-nya ada di antaranya. Satu query indeks biasa. Tanpa PostGIS.

## 6. Alur Check-in

```
HOST                          TAMU                         SERVER
  |                             |                            |
  | buka layar QR check-in      |                            |
  | tanda tangani CheckInOffer  |                            |
  |   {eventId, nonce,          |                            |
  |    expiresAt = +30 dtk}     |                            |
  |----- POST /events/:id/checkin-offer {sig, cell, atMs} -->|
  |                             |                            | simpan tawaran
  | tampilkan QR ---------------|                            |
  |                       pindai QR                          |
  |                       tanda tangani CheckInAccept        |
  |                         {eventId, nonce, attendee,       |
  |                          expiresAt}                      |
  |                             |-- POST /events/:id/checkin |
  |                             |   {sig, cell, atMs} ------>|
  |                                                          | 1 event ada?
  |                                                          | 2 nonce ada & belum dipakai?
  |                                                          | 3 belum kedaluwarsa?
  |                                                          | 4 tamu sudah RSVP?
  |                                                          | 5 belum pernah check-in?
  |                                                          | 6 sekarang di [mulai, selesai]?
  |                                                          | 7 sel tamu di geofence?
  |                                                          | 8 ko-lokasi host & tamu?
  |                                                          | 9 relayer -> checkIn()
```

**Kedua tanda tangan diverifikasi server lebih dulu**, sebelum langkah 9. Kontrak memang
memverifikasinya lagi — di situlah jaminan sebenarnya — tetapi meneruskan tanda tangan cacat
ke chain berarti membakar gas relayer untuk transaksi yang sudah pasti revert. Alasan yang
sama dipakai `isActiveVouch` di Fase 2.

Langkah 8 memakai `verifyColocation` Fase 1 apa adanya (toleransi ±120 detik, sel tetangga
diterima). Langkah 7 dan 8 menjawab pertanyaan berbeda: 7 memastikan tamu di venue yang
diumumkan, 8 memastikan tamu benar-benar di depan host saat itu.

**Kode penolakan** yang dikembalikan `event-gate.ts`:
`event_not_found`, `offer_not_found`, `offer_expired`, `offer_consumed`, `not_rsvped`,
`already_checked_in`, `event_not_live`, `outside_geofence`, `cell_too_far`, `time_too_far`,
`bad_signature`.

## 7. On-chain — `AttendanceRegistry`

### 7.1 Antarmuka

```solidity
function createEvent(
    bytes32 eventId, address host,
    uint64 startsAt, uint64 endsAt, bytes32 centerCell,
    uint64 expiresAt, bytes calldata sigHost
) external;

function checkIn(
    bytes32 eventId, address attendee, bytes32 nonce,
    uint64 expiresAt, bytes calldata sigHost, bytes calldata sigAttendee
) external;
```

Pola persis `ConnectionRegistry` dan `VouchRegistry`: relayer satu-satunya `msg.sender` yang
diterima, tapi setiap panggilan membawa tanda tangan EIP-712 yang diverifikasi **di dalam
kontrak**. Relayer tidak bisa mengarang event atas nama orang lain, dan tidak bisa mencetak
kehadiran orang yang tidak menandatanganinya.

`checkIn` menuntut **dua** tanda tangan, sama seperti `ConnectionRegistry.connect` menuntut
`sigOffer` dan `sigAccept`: yang satu membuktikan host membuka pintu, yang satu membuktikan
tamu melangkah masuk.

Penyimpanan:

```solidity
struct EventRecord { address host; uint64 startsAt; uint64 endsAt; bytes32 centerCell; }
mapping(bytes32 => EventRecord) public events;
mapping(bytes32 => mapping(address => uint64)) public attendedAt;
mapping(bytes32 => bool) public usedNonce;

event EventCreated(bytes32 indexed eventId, address indexed host, uint64 startsAt, uint64 endsAt);
event CheckedIn(bytes32 indexed eventId, address indexed attendee, uint64 at);
```

`centerCell` adalah 7 huruf geohash yang dijejalkan ke satu `bytes32`. Disimpan apa adanya,
bukan hash-nya: venue event memang informasi publik, jadi meng-hash tidak melindungi apa pun
sementara kemampuan orang luar mengaudit geofence hilang percuma.

### 7.2 Apa yang ditegakkan kontrak, dan apa yang tidak

Ditegakkan kontrak, tidak bergantung pada server:

- Event harus ada sebelum ada yang check-in.
- `block.timestamp` harus di dalam `[startsAt, endsAt]`.
- Tanda tangan host dan tamu harus sah, tidak kedaluwarsa, dan tidak malleable
  (penjagaan `HALF_N` yang sama seperti `VouchRegistry`).
- Nonce sekali pakai; check-in kedua untuk pasangan (event, orang) ditolak.
- Kehadiran permanen. Tidak ada fungsi pembatal.

**Tidak ditegakkan kontrak:** geofence. Kontrak tidak punya cara mengetahui di mana perangkat
berada, jadi di situ server yang menjadi saksi. Nyatakan ini apa adanya kalau ditanya; jangan
mengklaim geofence terjamin on-chain.

### 7.3 Biaya gas

BSC testnet (chainId 97), gas price 0.1 gwei. `createEvent` menulis satu struct (3 slot),
`checkIn` menulis dua slot. Dibanding tiga kontrak Fase 2 yang seluruh deploy-nya hanya
0.000136 tBNB, biaya fase ini tidak berarti. Tidak ada mekanisme penghematan gas seperti
`trust_published` di Fase 2 yang perlu ditiru di sini: check-in memang seharusnya satu
transaksi per orang per event.

**Alamat ter-deploy (BSC testnet, 2026-09-07):**
`AttendanceRegistry` = `0x8D1e85ff67553e5569d337690FC8102D7Bd02299`,
attestor = `0xD4f3eb5724ECcAd969331144385C08a14325284E` (sama dengan
`RELAYER_PRIVATE_KEY`). Deploy memakai 963.011 gas pada 0.1 gwei = 0.0000963 tBNB.
Biaya nyata per transaksi terukur: `createEvent` 98.813 gas, `checkIn` 88.189 gas.

## 8. Discovery

Aturan spec induk §7.7 yang harus dipatuhi: **siapa pun boleh mengadakan event**, dan event
host ber-trust rendah tetap ada serta tetap bisa dibagikan lewat link — hanya tidak menonjol
di halaman discovery. Yang harus diperoleh adalah perhatian, bukan izin.

`GET /events` mengembalikan event yang `ends_at`-nya belum lewat, kecuali:

- host ada di tabel `slashes` (penipuan terkonfirmasi), atau
- host tidak punya satu pun koneksi di tabel `connections`.

Sisanya **diurutkan** berdasarkan skor host di `trust_snapshots` (menurun), lalu `starts_at`
(menaik).

**Kenapa mengurutkan, bukan menyembunyikan tier Baru.** Tier dihitung relatif terhadap skor
tertinggi di graf (spec Fase 2 §4.5). Di graf kecil hampir semua orang bertier Baru, jadi
ambang "minimal Dikenal" berisiko membuat halaman discovery kosong saat demo — dan
menyembunyikan host tulus yang baru bergabung. Urutan menegakkan hal yang sama tanpa
menghasilkan halaman kosong.

Dua penyaring yang tersisa dipilih karena keduanya bukan soal populer atau tidak: alamat
ter-slash sudah melewati peninjauan manusia, dan alamat tanpa koneksi **belum pernah bertemu
siapa pun** — bot bisa menekan tombol, tapi bot tidak bisa membangun graf.

`GET /events/:id` **tidak pernah menyaring apa pun.** Itulah "tetap bisa dibagikan lewat link".

## 9. Sambungan ke Trust

Sekarang `occasionIdOf(cell, atMs)` menebak occasion dari `(sel, jendela 3 jam)`. Tebakan itu
diganti data.

**Aturan penetapan:** sebuah koneksi `(a, b, atMs)` dicap milik event `E` kalau — dan hanya
kalau — `a` **dan** `b` dua-duanya punya baris di `checkins` untuk `E`, dan `atMs` jatuh di
dalam jendela `E`. **Perhatikan satuannya:** `starts_at`/`ends_at` adalah unix DETIK
sementara `atMs` MILIDETIK, jadi perbandingannya `starts_at * 1000 <= atMs <= ends_at * 1000`.
Ini persis jenis kekeliruan yang diperingatkan komentar satuan waktu di
`packages/shared/src/schema.ts`, dan harus dikunci sebuah test tersendiri. Kalau tidak ada `E` yang memenuhi, koneksi jatuh ke
`occasionIdOf(cell, atMs)` seperti sekarang.

Kalau ada lebih dari satu `E` yang memenuhi (dua acara tumpang tindih yang dihadiri keduanya),
ambil `event_id` terkecil secara leksikografis. Aturan ini sewenang-wenang tetapi
**deterministik** — dan determinisme yang penting di sini, karena skor harus sama tiap kali
dihitung ulang.

**Yang berubah:** `occasionIdOf` dan `rowsToGraph`, keduanya di
`apps/api/src/trust/load-graph.ts`. `rowsToGraph` menerima dua koleksi baris tambahan
(`checkins`, `events`) di `GraphRows`.

Catatan lama menyebut "hanya `occasionIdOf` yang berubah"; itu tidak akurat — `rowsToGraph`
ikut berubah karena ia yang perlu menerima baris check-in. Yang tetap benar dan penting:
`packages/trust` tidak tersentuh.

**Koneksi lama tidak berubah nilainya.** Koneksi Fase 1 tanpa `cell` tetap memakai
`tanpa-sel-{i}:0`, dan koneksi Fase 2 tetap memakai tebakan geohash. Tidak ada migrasi data
dan tidak ada skor yang bergeser karena fase ini dipasang.

## 10. Permukaan API

| Endpoint | Isi |
|---|---|
| `POST /events` | Buat event. Bertanda tangan, diteruskan relayer ke `createEvent` |
| `GET /events` | Discovery (§8) |
| `GET /events/:id` | Detail. Selalu bisa dibuka, tanpa penyaring |
| `POST /events/:id/rsvp` | Bertanda tangan, murni off-chain |
| `POST /events/:id/checkin-offer` | Host menyimpan tawaran QR. Bertanda tangan host |
| `POST /events/:id/checkin` | Tamu menukar tawaran jadi kehadiran (§6). Badan: `{nonce, sigAttendee, cell, atMs}` |
| `GET /events/:id/attendance` | RSVP, hadir, dan RSVP-yang-belum-hadir |

Check-in memanggil `deps.onChanged()` setelah berhasil, sama seperti handshake dan vouch —
kehadiran baru mengubah penetapan occasion, yang mengubah diversitas, yang mengubah skor.

## 11. Mobile

Empat layar di `apps/mobile/app/events/`:

- `index.tsx` — daftar discovery.
- `new.tsx` — form buat event. Mengambil sel dari GPS saat host berdiri di venue; jelaskan
  di layar bahwa lokasi saat menekan tombol itulah yang jadi pusat geofence.
- `[id].tsx` — detail. Tombol RSVP; tombol check-in nonaktif dengan keterangan "RSVP dulu
  untuk bisa check-in" selama belum RSVP (§2.2), dan nonaktif dengan keterangan waktu selama
  acara belum mulai atau sudah selesai.
- `[id]/host-qr.tsx` — layar QR check-in, hanya terbuka untuk host event itu.

Dua aturan repo dari Fase 1 tetap berlaku dan mudah dilanggar: **import relatif ditulis tanpa
ekstensi** (Metro tidak memetakan `"./x.js"` ke `x.ts`), dan **signer tidak boleh dibuat di
badan komponen React**.

Pemindai memakai ulang `app/scan.tsx` Fase 1; bedanya cuma isi payload dan endpoint tujuan.

## 12. Verifikasi

Empat lapis, mengikuti pembagian yang sudah terbukti di Fase 1–2. Test ditulis lebih dulu.

**`packages/shared`** — murni, tanpa I/O:
- `isInsideGeofence`: sel pusat, kedelapan tetangga, sel di luar, dan sel yang bertetangga
  dengan tetangga (harus ditolak).
- `isEventLive`: detik pertama dan detik terakhir jendela masuk; satu detik sebelum dan
  sesudah tidak.

**`apps/api`** — `event-gate` dengan store palsu, satu test per kode penolakan di §6, plus
jalur berhasil.

**`load-graph`** — koneksi dicap ke event hanya kalau kedua pihak check-in; koneksi dengan
satu pihak saja jatuh ke tebakan; koneksi Fase 1 lama tidak berubah nilainya; dua event
tumpang tindih menghasilkan pilihan yang sama tiap kali dijalankan.

**Foundry — `AttendanceRegistry.t.sol`**: bukan-relayer ditolak; tanda tangan host palsu
ditolak; tanda tangan tamu palsu ditolak; tanda tangan malleable ditolak; check-in sebelum
`startsAt` dan sesudah `endsAt` ditolak; nonce dipakai ulang ditolak; check-in kedua ditolak;
check-in ke event yang tidak ada ditolak.

## 13. Batas yang Diakui

Sampaikan jujur, jangan diklaim lebih.

1. **QR host bisa difoto dan diteruskan.** Orang yang berada di dalam geofence tetapi tidak
   benar-benar di ruangan bisa check-in memakai foto QR yang dikirim temannya. Rotasi 30
   detik memperkecil jendelanya dan geofence membatasi jangkauannya, tetapi tidak
   menutupnya. Menutupnya butuh sesuatu yang tidak dimiliki fase ini — attestation perangkat
   atau bukti kedekatan Bluetooth.
2. **Geofence disaksikan server, bukan kontrak.** Kontrak menegakkan jendela waktu dan kedua
   tanda tangan; letak perangkat tidak bisa diketahuinya. GPS palsu **ditambah** QR yang
   diteruskan menembus keduanya. Butuh dua kecurangan terkoordinasi, bukan satu — itu
   peningkatan nyata dari rancangan mandiri, bukan penutupan.
3. **Host tidak membuktikan menguasai venue.** Siapa pun bisa membuat event di koordinat mana
   pun, termasuk di alamat orang lain. Yang menahan penyalahgunaan bukan gerbang pembuatan
   (spec induk §7.7 melarangnya) melainkan discovery yang diperoleh dan gerbang laporan
   Fase 2.
4. **Check-in mewajibkan RSVP, jadi orang yang datang mendadak tertolak** sampai ia RSVP
   lebih dulu. Ini keputusan sadar (§2.2), bukan kelalaian. Peredamnya ada di UI, bukan di
   aturan. Konsekuensi turunan: angka "hadir tanpa RSVP" selalu nol, jadi perbandingan
   RSVP-vs-benar-benar-datang yang disinggung spec induk §7.7 hanya bisa dibaca satu arah —
   berapa yang RSVP lalu tidak muncul.
5. **Host adalah titik tunggal kegagalan.** Tanpa host yang hadir dengan layar aktif, tidak
   ada seorang pun yang bisa check-in. Panitia tidak bisa membantu karena konsep co-host
   dikeluarkan dari ruang lingkup oleh spec induk §4. Di acara besar ini menghasilkan antrean
   di satu titik.
6. **Geofence 460 m itu kasar.** Di kawasan padat, acara di gedung sebelah berada di area
   yang sama. Yang tetap membedakan adalah QR host — bukan geofence-nya.
7. **`cell` dan `at_ms` dikirim perangkat masing-masing**, sama seperti Fase 1. Tidak ada
   sumber lokasi tepercaya di mana pun dalam sistem ini.

## 14. Yang Sengaja TIDAK Ada di Fase Ini

Spec induk §4 mengeluarkan sebagian besar ini dari MVP; sisanya YAGNI.

Tiket berbayar dan pembayaran · waitlist · alur persetujuan · event berulang · co-host dan
panitia · integrasi kalender & email blast · pembatalan RSVP · penyuntingan dan pembatalan
event · badge ERC-721 (§2.3) · penanda "ingin bertemu" beserta angkanya (Fase 3b) · Radar
"siapa di event ini sekarang" (Fase 4).

## 15. Langkah Berikutnya

Rencana implementasi lewat skill `superpowers:writing-plans`, lalu dikerjakan dengan TDD
seperti Fase 1 dan 2. Setelah 3a tuntas dan ter-deploy, Fase 3b — "ingin bertemu" — mendapat
spec-nya sendiri.
