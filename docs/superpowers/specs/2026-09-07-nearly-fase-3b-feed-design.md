# Nearly Fase 3b — Feed (FYP): Design Spec

**Tanggal:** 2026-09-07
**Status:** Disetujui, siap masuk perencanaan implementasi
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/specs/2026-09-05-nearly-fase-3a-event-design.md` (tuntas, ter-deploy)

---

## 1. Posisi dalam Roadmap, dan Kenapa Urutannya Ditukar

Spec induk §11 menaruh feed di **Fase 5 — FYP**, sesudah "ingin bertemu" di Fase 3. Urutan
itu dibalik di sini, atas keputusan pemilik project, karena urutan aslinya tidak bisa
dijalankan.

Alasannya konkret. Penanda "ingin bertemu" ditujukan ke orang yang **belum** kamu temui —
itu inti kalimat spec induk §7.4, *"online menciptakan keinginan, offline
menyelesaikannya."* Tapi setelah Fase 3a selesai, aplikasi ini tidak punya satu pun
permukaan yang menampilkan orang asing:

- `attendanceSummary` sengaja hanya mengembalikan angka (`rsvps`, `checkins`,
  `rsvpBelumHadir`), tidak pernah daftar alamat.
- Layar profil hanya bisa dicapai dari daftar koneksi — yaitu orang yang sudah kamu temui.

Permukaan yang seharusnya menyediakan orang asing itu adalah feed, dan feed ada di Fase 5.
Jadi "ingin bertemu" tidak punya tempat untuk hidup sampai feed ada.

Maka:

- **Fase 3b (dokumen ini)** — feed unggahan, peringkat berbasis graf pertemuan, suka,
  gambar di BNB Greenfield, lapor unggahan.
- **Fase 3c (spec tersendiri, menyusul)** — penanda "ingin bertemu", angka publiknya,
  penyaring trust-nol, pengungkapan saat saling menandai, dan loop yang menutup keduanya.

Slot 3b/3c dipakai alih-alih menomori ulang seluruh peta fase, supaya spec induk tetap
terbaca dan riwayat keputusan tidak kabur.

**Satu kalimat di spec induk §11 kini terbalik dan harus diperbaiki.** Fase 5 di sana
menulis bahwa tombol ingin bertemu di kartu feed *"mekaniknya sudah ada dari Fase 3"*.
Sekarang justru sebaliknya: feed datang duluan dan menyediakan tempat bagi mekanik itu.
Perbaikan kalimat tersebut termasuk dalam ruang lingkup implementasi fase ini.

**Kriteria selesai:** feed berjalan, unggahan bisa dibuat dengan teks dan gambar, dan
urutannya ditentukan oleh graf pertemuan fisik — bukan oleh keterlibatan semata.

## 2. Keputusan yang Terkunci

| Aspek | Keputusan |
|---|---|
| Urutan fase | Feed didahulukan; "ingin bertemu" pindah ke Fase 3c |
| Hak posting | **Terbuka untuk siapa pun** yang punya wallet — tanpa syarat koneksi maupun tier |
| Isi unggahan | Teks ≤500 karakter, plus **paling banyak satu gambar** |
| Interaksi | Lihat, **suka**, lapor, hapus milik sendiri. **Tanpa balasan, tanpa repost** |
| Suka dan peringkat | **Semua suka dihitung**, tanpa pembobotan trust |
| Penyimpanan | **Tanpa on-chain.** Postgres + BNB Greenfield untuk gambar |
| Peringkat | Jarak graf pertemuan × kompresi log rasio trust, dengan peluruhan diversitas penulis |
| Kompresi skor | `ln` atas `ratio` dari `trust_snapshots`, memakai `SCORE_SCALE` yang sudah ada |
| Visibilitas | **Tahap penyaring terpisah** dari penilaian, bukan skor rendah |
| Unggah gambar | **Asinkron**, fire-and-forget; teks terbit lebih dulu |
| Kunci Greenfield | Kunci relayer yang sama, didanai terpisah di chain Greenfield |

### 2.1 Kenapa posting terbuka untuk siapa pun

Ini keputusan pemilik project, diambil setelah alternatifnya disampaikan. Alternatif yang
ditolak adalah mensyaratkan minimal satu koneksi terverifikasi — yang akan menjadikan
anti-spam bersifat struktural, cerminan persis argumen "inbox tanpa spam" di spec induk
§7.5.

Konsekuensinya dicatat apa adanya di §11, bukan disamarkan.

### 2.2 Kenapa suka ada, tapi balasan tidak

Spec induk §7.4 menulis batas yang keras: *"dari FYP tidak ada jalur untuk terkoneksi
maupun mengirim pesan."*

Balasan secara teknis bukan pesan pribadi, tapi secara praktik ia kanal tulis dari orang
yang belum pernah menemuimu — persis hal yang spec induk §7.5 nyatakan tidak boleh punya
jalur di dalam Nearly. Kalau balasan ada, jaminan "tanpa spam secara struktural" bocor lewat
pintu belakang, dan moderasi percakapan menjadi subsistem tersendiri yang tidak ada di fase
ini.

Suka tidak membawa teks, jadi tidak membuka kanal itu. Ia tetap punya ongkos yang dicatat
di §11.2.

### 2.3 Kenapa unggahan tidak menyentuh chain

Di Fase 3a, `createEvent` dan `checkIn` keduanya on-chain. Di sini tidak, dan bedanya bukan
selera:

**Di Fase 3a selalu ada gerbang sebelum transaksi.** Membuat event butuh tanda tangan host;
check-in butuh RSVP lebih dulu dan tawaran dari host. Tidak ada orang asing yang bisa
memicu transaksi.

**Di sini tidak ada gerbang** — posting terbuka untuk siapa pun (§2.1). Kalau unggahan
menyentuh chain, setiap orang asing bisa membelanjakan gas relayer hanya dengan menulis.

Tiga akibat lain yang ikut menguntungkan: laporan bisa benar-benar menyembunyikan unggahan,
penulis bisa menghapus miliknya, dan narasi BNB tetap terjaga lewat Greenfield.

## 3. Arsitektur

Feed dibangun sebagai **pipeline lima tahap**, meniru bentuk pipeline X (`home-mixer`),
mengikuti pola `rankDiscovery` yang sudah ada di `apps/api/src/discovery.ts`.

```
1. Ambil kandidat     → unggahan ≤14 hari, maks 500, dibagi dalam-jaringan / luar-jaringan
2. Saring visibilitas → buang ter-slash, terlapor melewati ambang, terhapus
3. Skor               → basis trust × jarak graf, ditambah suka dan kebaruan
4. Peluruhan diversitas penulis
5. Pilih top-K, sisipkan slot pendatang baru
```

Tahap 1–5 adalah **fungsi murni tanpa I/O**. Seluruh logika peringkat bisa diuji tanpa
database maupun jaringan, persis seperti `rankDiscovery` sekarang.

### 3.1 Apa yang diambil dari algoritma X, dan apa yang tidak

Repo `xai-org/x-algorithm` dipelajari sebagai rujukan. Yang diambil adalah **pipa-pipanya**,
bukan tujuannya.

**Tidak diambil — fungsi tujuannya.** Seluruh mesin X mengoptimalkan prediksi keterlibatan:
model transformer Phoenix memprediksi ~20 probabilitas aksi (fav, reply, repost, klik, dwell
time, follow penulis, serta sisi negatif seperti block dan report), lalu dijumlahkan
berbobot. Nearly punya tesis berlawanan — yang diinginkan bukan penonton betah di layar,
tapi penonton berangkat menemui orang. Menyalin fungsi tujuannya berarti menyalin bagian
yang salah. Secara praktis juga mustahil: Phoenix butuh data keterlibatan historis untuk
dilatih, dan data itu belum ada.

**Tidak diambil — SimClusters, CLIP, model media, sinyal dwell time.** Infrastruktur
bertahun-tahun, dan dwell time khususnya adalah sinyal pengoptimal perhatian yang
berlawanan arah dengan tesis Nearly.

**Tidak diambil — Thompson sampling untuk pendatang baru.** X membutuhkannya untuk
menyeimbangkan eksplorasi atas jutaan penulis. Di skala ini, menyisihkan slot tetap sudah
cukup dan bisa dijelaskan dalam satu kalimat.

**Diambil — bentuk pipeline bertahap.** Setiap tahap bisa diuji sendiri.

**Diambil — peluruhan diversitas penulis.** Rumus `home-mixer/scorers/ranking_scorer.rs`:
`(1 − lantai) × peluruhan^k + lantai`, dengan `k` = jumlah unggahan penulis yang sama yang
sudah berada lebih tinggi. Tanpa ML, dan mengobati masalah yang persis kita punya: dengan
pengguna sedikit, satu orang rajin akan menguasai seluruh feed.

**Diambil — diskon luar-jaringan.** X mengalikan skor postingan di luar jaringan dengan
`OonWeightFactor` < 1. Padanan Nearly lebih kuat karena "jaringan" kita bukan daftar follow
yang bisa dibeli, melainkan graf pertemuan fisik.

**Diambil — dorongan penulis baru.** X menyisihkan slot untuk postingan berimpresi rendah
dari penulis baru. Kebutuhan kita lebih mendesak: orang yang baru sekali bersalaman harus
terlihat, atau ia tidak akan pernah mendapat koneksi kedua.

**Diambil — pemisahan peringkat dari visibilitas.** X menaruh visibility filtering di
layanan terpisah dengan keputusan ALLOW / INTERSTITIAL / DROP. Yang di-slash atau dilaporkan
dibuang di tahap penyaring, bukan diberi skor rendah — kalau dicampur, pelaku cukup meraih
skor tinggi untuk muncul lagi.

**Diambil — kompresi logaritmik skor kredibilitas.** `user-cred-v2` menjalankan PageRank
lalu memetakan massa ke skor lewat `165.2 + 7.07 × ln(massa)`, dijepit ke [0,100]. Yang
diambil bentuknya, bukan konstantanya — konstanta itu hasil kalibrasi terhadap graf X.

## 4. Model Data

Migrasi `supabase/migrations/0004_feed.sql`. RLS menyala di ketiga tabel, **tanpa policy**,
sama seperti setiap tabel lain di proyek ini; API mengakses lewat service role key.

### 4.1 `posts`

```sql
create table if not exists posts (
  post_id      text primary key check (post_id ~ '^0x[0-9a-f]{64}$'),
  author       text not null references profiles(address) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  -- Greenfield disimpan sebagai bucket + object, BUKAN URL jadi: endpoint
  -- storage provider bisa berubah tanpa membusukkan baris lama.
  image_bucket text,
  image_object text,
  image_mime   text,
  image_status text not null default 'none'
               check (image_status in ('none', 'pending', 'ready', 'failed')),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
```

`post_id` dihasilkan klien sebelum menandatangani, mengikuti pola `makeEventId()` di Fase
3a — supaya id ikut tercakup tanda tangan.

`image_status` membuat unggah asinkron terlihat jujur di UI alih-alih berpura-pura sudah
naik.

### 4.2 `post_likes`

```sql
create table if not exists post_likes (
  post_id    text not null references posts(post_id) on delete cascade,
  address    text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, address)
);
```

Primary key gabungan menegakkan satu suka per alamat per unggahan. Membatalkan suka adalah
penghapusan baris.

### 4.3 `post_reports`

```sql
create table if not exists post_reports (
  post_id    text not null references posts(post_id) on delete cascade,
  reporter   text not null check (reporter ~ '^0x[0-9a-f]{40}$'),
  reason     text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, reporter)
);
```

**Kenapa tabel sendiri, tidak menumpang `reports` yang sudah ada.** Tabel `reports` di
`0002_trust.sql` ber-`subject` **alamat orang**, dan menembus ambangnya berujung slash —
hukuman terhadap manusia yang mencabut trust-nya dan trust penjaminnya. Satu unggahan buruk
tidak sepadan dengan itu, dan menumpangkannya akan menghilangkan informasi unggahan mana
yang bermasalah.

`post_reports` hanya menyembunyikan unggahan di tahap penyaring visibilitas. Eskalasi ke
tingkat orang tetap lewat gerbang `reports` yang sudah berjalan, tidak diubah fase ini.

Ambang penyembunyian: **3 pelapor berbeda**. Primary key gabungan menutup cara termurah
menembusnya — satu orang melapor berkali-kali — persis seperti `reports_one_vote` di tabel
lama.

## 5. Tanda Tangan

Dua tipe EIP-712 baru di `packages/shared/src/feed.ts`:

```
Post { postId: bytes32, author: address, body: string, expiresAt: uint64 }
Like { postId: bytes32, who: address, suka: bool, expiresAt: uint64 }
```

Keduanya **tidak pernah naik ke chain**, dan karena itu tidak boleh punya pasangan typehash
di Solidity mana pun — sama seperti `Rsvp` dan `LihatEvent` di Fase 3a.

**Kenapa tetap ditandatangani.** Alasan identik dengan `Rsvp`: tanpa tanda tangan, `author`
dan `who` datang telanjang dari body request, dan siapa pun bisa memposting atau menyukai
atas nama orang lain.

**Domain** memakai `ConnectionRegistry` sebagai `verifyingContract`. Jangkar identitas feed
adalah graf pertemuan, dan `ConnectionRegistry` adalah kontrak yang memegang graf itu.

**Penjaga Ruling 23.** Nama tipe `Post` dan `Like` unik di seluruh aplikasi, jadi digest-nya
berbeda dari `Accept`, `Vouch`, `Rsvp`, `LihatEvent`, dan setiap tipe lain — tidak ada tanda
tangan yang bisa menyeberang ke jalur tulis lain. Ini dikunci tes typehash (§13.2).

**Satu batas jujur.** Tanda tangan `suka: true` yang tertangkap masih bisa diputar ulang
untuk menyukai lagi setelah dibatalkan, selama `expiresAt` belum lewat. Sama seperti setiap
tanda tangan lain di repo ini; jendela pendek adalah penawarnya, dan konsistensi lebih
berharga daripada mekanisme nonce khusus untuk aksi seringan ini.

## 6. Peringkat

### 6.1 Rumus

```
basis      = ln(1 + rasio × SCORE_SCALE) / ln(1 + SCORE_SCALE)        ∈ [0,1]
jarak      = 1.0 (1 lompatan) · 0.6 (2 lompatan) · 0.3 (luar jaringan)
kebaruan   = 0.5 ^ (umur_jam / 24)
suka       = min(1, ln(1 + jumlah_suka) / ln(1 + 50))

skor_awal  = (0.5·basis + 0.2·suka + 0.3·kebaruan) × jarak

k          = jumlah unggahan penulis sama yang sudah berada lebih tinggi
diversitas = (1 − 0.25) × 0.5^k + 0.25
skor_akhir = skor_awal × diversitas
```

### 6.2 Kenapa `ratio`, bukan skor mentah

`computeTrust` mengeluarkan `ratio = score / topScore`, dan `tier.ts` mendefinisikan tier di
atas rasio itu, bukan skor mentah. Komentar di sana menjelaskan alasannya: ambang absolut
akan menurunkan tier semua orang serentak begitu populasi bertambah, padahal tidak ada yang
berubah pada mereka.

Feed mewarisi sifat itu gratis dengan memakai `ratio`. Nilainya **sudah tersimpan di
`trust_snapshots.ratio`**, dipelihara `recomputeTrust` yang sudah berjalan — jadi penilai
feed **tidak menjalankan PageRank sama sekali**. Nol biaya komputasi tambahan.

### 6.3 Kenapa dikompresi logaritmik

Tanpa kompresi, peluruhan diversitas tidak berfungsi.

Peluruhan bekerja secara perkalian. Rasio PageRank timpang berat — satu node yang terhubung
baik bisa punya rasio ratusan sampai ribuan kali lipat orang biasa. Kalau skor dasar
seseorang 1000× orang lain, `0.5^5` sekalipun tidak menurunkannya dari puncak; unggahan
kelimanya masih mengalahkan unggahan pertama orang lain. Yaitu persis kegagalan yang
peluruhan itu dipasang untuk mencegah.

`ln(1 + rasio × SCORE_SCALE)` menarik ketimpangan 1000× menjadi sekitar 2×, sehingga
pengali-pengali di bawahnya menggigit.

Bentuk `ln(1 + x)` dipilih, bukan `ln(x)`, supaya rasio nol menghasilkan nol dan bukan minus
tak hingga. `SCORE_SCALE` (`1_000_000`) sudah ada di `apps/api/src/trust/recompute.ts` dan
terkunci ke `TrustAttestor.sol` — tidak ada konstanta ajaib baru yang diperkenalkan.
Pembagi `ln(1 + SCORE_SCALE)` menormalkan hasilnya ke [0,1].

**Kompresi ini hidup hanya di penilai feed.** `packages/trust` tidak disentuh, dan skor yang
terbit on-chain lewat `TrustAttestor` tidak berubah sedikit pun.

### 6.4 Jarak graf

Dihitung dari tabel `connections` yang sudah ada:

- **1 lompatan** — kamu pernah bertemu penulisnya.
- **2 lompatan** — seseorang yang kamu temui pernah bertemu penulisnya.
- **Luar jaringan** — selain itu.

**Dihitung dua kueri, bukan per unggahan.** Ambil himpunan 1 lompatan penonton dalam satu
kueri, lalu himpunan 2 lompatan dalam satu kueri lagi (`addr_a in (...) or addr_b in (...)`),
sebelum penilaian dimulai. Jarak tiap unggahan lalu dibaca dari dua himpunan itu di memori.

Ini disebut eksplisit karena review akhir Fase 3a menemukan pola N+1 di `listDiscovery` —
satu kueri hitung koneksi per host — dan memarkirnya sebagai masalah penskalaan. Pola yang
sama di sini akan jauh lebih buruk, karena feed dimuat jauh lebih sering daripada discovery.

**Blokir belum ada, dan implementer tidak boleh mencarinya.** Tabel `connections` di
`0001_init.sql` **tidak punya kolom `blocked`**; medan itu hanya ada di tipe graf trust dan
`apps/api/src/trust/load-graph.ts:150` menetapkannya `false` secara keras. Blokir baru
datang di Fase 4 (spec induk §11). Jadi di fase ini **setiap koneksi dihitung sebagai
lompatan**, tanpa pengecualian.

Aturan yang harus berlaku begitu Fase 4 mendarat, dicatat di sini supaya tidak hilang:
koneksi terblokir tidak boleh dihitung sebagai lompatan, konsisten dengan spec induk §7.5
yang menyatakan koneksi terblokir tidak lagi menghantar trust ke arah mana pun.

### 6.5 Nol koneksi dan penonton anonim tidak butuh cabang khusus

X memerlukan `OonWeightFactor` khusus untuk pengguna baru supaya feed mereka tidak kosong.
Kita tidak.

Penonton dengan nol koneksi melihat semua orang sebagai luar jaringan, jadi seluruh kandidat
dikali 0.3 — pengali seragam, dan pengali seragam tidak mengubah urutan. Feed-nya dengan
sendirinya luruh menjadi trust + suka + kebaruan murni. Tidak ada cabang khusus yang perlu
ditulis maupun diuji, dan karena itu tidak ada cabang khusus yang bisa rusak.

**Penonton anonim** — `GET /feed` tanpa parameter `who` (§9) — jatuh ke jalur yang sama
persis: tidak ada graf untuk diukur, jadi semua kandidat berjarak "luar jaringan". Urutannya
identik dengan penonton bernol koneksi. Yang berbeda hanya di respons: medan `hop` selalu
`null` dan `sudahSuka` selalu `false`.

### 6.6 Slot pendatang baru

**Top-K adalah 30 unggahan per halaman.** Setelah 30 itu diambil, **tiga posisi — 5, 12, dan
20** — disisihkan untuk penulis yang
memenuhi semuanya:

- punya **minimal 1 dan kurang dari 3 koneksi**,
- unggahannya berumur di bawah 48 jam,
- unggahannya tidak lolos top-K.

**Batas bawah 1 itu wajib, bukan kosmetik.** Posting terbuka untuk siapa pun (§2.1), dan
akun bot punya nol koneksi. Syarat "kurang dari 3" saja akan menjadikan setiap bot memenuhi
syarat, sehingga slot yang dipasang untuk menolong pendatang tulus berubah menjadi jalur
cepat ke posisi tetap di feed. Bot bisa menekan tombol; bot tidak bisa membangun graf — jadi
"pernah bertemu setidaknya satu orang" adalah garis yang memisahkan keduanya, sama seperti
penyaring host tanpa koneksi di discovery Fase 3a.

Kandidat diurutkan dengan skor yang sama dan diambil dari atas. Deterministik, bisa diuji
dengan fixture tetap, dan bisa dijelaskan dalam satu kalimat.

Kalau tidak ada kandidat yang memenuhi syarat, slot itu diisi hasil peringkat biasa —
posisinya tidak pernah dibiarkan kosong.

## 7. Penyaring Visibilitas

Tahap **terpisah** dari penilaian, dijalankan sebelum skor dihitung. Sebuah unggahan dibuang
kalau salah satu berlaku:

| Sebab | Sumber |
|---|---|
| Penulisnya ter-slash | tabel `slashes` |
| Unggahan dilaporkan ≥3 pelapor berbeda | `post_reports` |
| Unggahan sudah dihapus penulisnya | `posts.deleted_at` |

**Pengecualian untuk unggahanmu sendiri, dan batasnya.** Dua sebab pertama — penulis
ter-slash dan laporan melewati ambang — **tidak berlaku pada unggahanmu sendiri**: kamu
tetap melihat milikmu, karena menyembunyikannya dari penulisnya sendiri hanya membuat orang
bingung tanpa melindungi siapa pun.

Sebab ketiga **tetap berlaku**: unggahan yang sudah kamu hapus tidak muncul lagi, untukmu
maupun untuk siapa pun. Menghapus harus berarti menghapus.

Status gambar `pending` dan `failed` **bukan sebab penyaringan** sama sekali — unggahan
bergambar tertunda tetap tayang untuk semua orang dengan teksnya, dan gambarnya menyusul.

Pemisahan ini mengikuti `visibility-filtering` di X, dan alasannya sama: kalau visibilitas
dicampur ke dalam skor, pelaku cukup meraih skor cukup tinggi untuk muncul kembali.

## 8. BNB Greenfield

### 8.1 Kenyataan yang mengubah desain

**Greenfield adalah chain terpisah.** Chain id testnet `5600`, gas-nya sendiri. tBNB di BSC
testnet **tidak membayar apa pun di sana**; dana harus disediakan terpisah lewat faucet
Greenfield atau jembatan BSC↔Greenfield.

**Satu gambar bukan satu panggilan API.** Alurnya: hitung checksum Reed-Solomon di server →
`createObject` (transaksi on-chain di Greenfield, ditunggu konfirmasinya) → unggah byte-nya
ke storage provider lewat HTTP. Hitungan detik, bukan milidetik.

**URL baca publik** berbentuk `https://<sp-endpoint>/view/<bucket>/<object>`, dibangun saat
baca dari `image_bucket` + `image_object`.

### 8.2 Konsekuensi desain

**Unggah berjalan asinkron.** `POST /posts` menerbitkan teks seketika.
`POST /posts/:id/image` menyetel `image_status = 'pending'`, membalas 200, lalu menjalankan
unggahan tanpa ditunggu. Saat selesai statusnya jadi `ready`; kalau gagal jadi `failed`.

**Greenfield mati tidak mematikan feed.** Teks tetap terbit dan gambar tinggal tertunda —
inilah alasan utama unggahan tidak digabung menjadi satu permintaan.

**Adapter Greenfield masuk lewat port**, mengikuti pola `attendance` di
`apps/api/src/ports.ts`. Semua tes memakai fake; adapter asli diverifikasi manual saat
deploy (§13.3).

**Kunci.** Kunci relayer yang sama dipakai, didanai terpisah di chain Greenfield. Menambah
kunci baru hanya menambah rahasia untuk dijaga tanpa manfaat nyata di skala ini.

### 8.3 Variabel lingkungan baru

```
GREENFIELD_RPC=https://gnfd-testnet-fullnode-tendermint-ap.bnbchain.org
GREENFIELD_CHAIN_ID=5600
GREENFIELD_BUCKET=
GREENFIELD_SP_ENDPOINT=
```

Kunci penandatangannya adalah `RELAYER_PRIVATE_KEY` yang sudah ada.

## 9. Permukaan API

| Endpoint | Keterangan |
|---|---|
| `POST /posts` | Bertanda tangan `Post`. Teks terbit seketika |
| `POST /posts/:id/image` | Memicu unggah Greenfield asinkron, status jadi `pending` |
| `POST /posts/:id/like` | Bertanda tangan `Like`, medan `suka` true/false |
| `POST /posts/:id/report` | Menyembunyikan unggahan, bukan menghukum orang |
| `POST /posts/:id/delete` | Bertanda tangan penulisnya |
| `GET /feed?who=&cursor=` | Feed terperingkat; `who` opsional |

`:id` di path **wajib** sama dengan `postId` di badan permintaan, dibandingkan
case-insensitive — aturan `sameId` yang sudah ada di `routes/events.ts`. Tanpa itu, path
segment diam-diam diabaikan dan menghasilkan bug klien yang menyakitkan untuk dilacak.

Penghapusan memakai `POST /posts/:id/delete`, bukan `DELETE`, karena `fetch` di React Native
menangani DELETE berbadan permintaan secara tidak konsisten.

### 9.1 Bentuk unggahan gambar

`POST /posts/:id/image` menerima **JSON dengan gambar ter-base64**, bukan multipart —
multipart di React Native butuh penanganan `FormData` yang berbeda-beda antar platform dan
tidak sepadan untuk satu berkas.

- Maksimal **2 MB setelah didekode**. Ini bukan rem biaya (§11.3 menyatakan rem biaya
  sengaja longgar) melainkan pelindung memori API: tanpa batas, satu badan permintaan 100 MB
  cukup untuk mematikan server.
- Hanya diterima kalau `image_status` bernilai `none` atau `failed`. Nilai `failed` itulah
  yang membuat tombol coba-ulang di UI (§11.4) bisa bekerja.
- Hanya penulis unggahan yang boleh memanggilnya, dibuktikan tanda tangan `Post` atas
  `postId` yang sama.

### 9.2 Bentuk respons `GET /feed`

```
{ posts: [ {
    postId, author, displayName, tier, evidenceLine,
    body, imageUrl | null, imageStatus,
    likeCount, sudahSuka, hop, createdAt
  } ], cursor: string | null }
```

`hop` bernilai `1`, `2`, atau `null` (luar jaringan) — inilah medan yang menyalakan baris
alasan di tiap kartu (§10.3). `imageUrl` dibangun server dari `image_bucket` +
`image_object`, dan bernilai `null` selama `imageStatus` belum `ready`.

### 9.3 Kenapa `GET /feed?who=` TIDAK butuh bukti baca

Ini sengaja berbeda dari `GET /events/:id?who=` di Fase 3a, dan perbedaannya harus
dinyatakan supaya tidak terbaca sebagai kelalaian.

Di Fase 3a, `?who=` dijaga tanda tangan `LihatEvent` karena membocorkan **niat seseorang
berada di suatu tempat dan waktu** — informasi yang belum terjadi, tidak tersedia di mana
pun selain database kita, dan persis sinyal yang dilindungi spec induk §10.2 (*"tidak ada
peta dengan pin orang"*).

Di sini `?who=` hanya membocorkan urutan berdasarkan kedekatan graf, dan graf koneksi
**sudah publik on-chain** di `ConnectionRegistry`. Siapa pun bisa membacanya langsung dari
chain. Tidak ada yang bocor melebihi apa yang sudah publik, jadi memasang gerbang di sini
hanya menambah gesekan tanpa menambah perlindungan.

## 10. Mobile

### 10.1 Utang lama yang dibayar di fase ini

Review akhir Fase 3a menemukan duplikasi klien HTTP dan memarkirnya. `api.ts` punya
`post<T>` privat; `events-api.ts` punya `req<T>` yang nyaris identik. Menambah `feed-api.ts`
akan menjadikannya salinan ketiga.

Fase ini mengekstrak `apps/mobile/src/http.ts` lebih dulu, lalu ketiganya memakainya. Ini
bukan refactor tidak berkaitan — ini merapikan kode yang memang sedang disentuh, tepat
sebelum kesalahan yang sama dibuat untuk ketiga kalinya.

### 10.2 Layar

**`app/feed/index.tsx`** — daftar feed. Tiap kartu memuat penulis dengan tier dan buktinya,
teks, gambar (atau penanda sedang diunggah), tombol suka dengan jumlahnya, lapor, dan hapus
kalau itu milik penonton.

**`app/feed/new.tsx`** — tulis teks, opsional pilih satu gambar.

**`app/index.tsx`** mendapat tautan "Feed", mengikuti pola tautan "Acara".

### 10.3 Setiap kartu menyebut alasan ia muncul

Satu baris di tiap kartu: *"kamu bertemu Andi"*, *"Andi pernah bertemu dia"*, atau *"di luar
jaringanmu"*.

Ini bukan hiasan. Spec induk §8 memegang prinsip bahwa tier tidak pernah tampil telanjang,
selalu bersama buktinya — angka peringkat telanjang menghidupkan kecemasan ala Nosedive,
sementara fakta konkret lebih jujur dan lebih berguna bagi orang yang sedang memutuskan.
Feed yang tidak bisa menjelaskan dirinya melanggar prinsip yang sama.

Baris ini juga satu-satunya alasan memilih jarak graf ketimbang PageRank terpersonalisasi:
skor PageRank tidak bisa dijelaskan dalam satu kalimat, jarak graf bisa.

## 11. Batas yang Diakui

Semuanya keputusan sadar, bukan cacat. Ditulis supaya bisa dibongkar kalau nanti terbukti
merugikan.

**11.1 Posting terbuka berarti feed bisa dibanjiri.** Tidak ada syarat koneksi maupun tier
(§2.1). Bot tidak bisa membangun graf, jadi unggahannya akan berperingkat rendah — tapi
unggahannya tetap ada dan tetap memakan kuota kandidat.

**11.2 Semua suka dihitung, jadi feed bisa dipanen bot.** Bot tidak bisa membangun graf
pertemuan, tapi bot sangat bisa membuat seribu alamat dan menekan suka. Kalau ditanya
*"bisakah saya menaikkan unggahan saya dengan bot?"*, jawabannya ya. Ini bertabrakan dengan
klaim penutup Fase 2 di spec induk §11: *"serangan sybil bisa didemokan dan gagal secara
matematis."* Penawarnya diketahui dan ditolak secara sadar: membobot suka dengan trust, sama
seperti penyaring trust-nol pada tap "ingin bertemu" di spec induk §7.6.

**11.3 Biaya Greenfield tidak direm ketat.** Kuota longgar dan pemantauan manual saldo
selama hackathon, alih-alih kuota per alamat per hari. Digabung dengan §11.1, ini keran
terbuka ke dompet Greenfield relayer.

**11.4 Unggah gambar fire-and-forget.** Kalau proses API mati di tengah unggahan, baris itu
tertinggal berstatus `pending` selamanya. Penawarnya: statusnya terlihat jujur dan penulis
bisa mencoba ulang dari UI.

**11.5 Paginasi memberi peringkat ulang.** Jendela kandidat diperingkat utuh setiap
permintaan lalu dipotong per halaman. Karena `kebaruan` terus meluruh, sebuah unggahan bisa
bergeser antar halaman saat menggulir lama. Obatnya diketahui: bekukan peringkat per sesi di
cache.

**11.6 Jendela kandidat dibatasi 14 hari dan 500 unggahan.** Di luar itu tidak pernah ikut
diperingkat, betapapun tinggi skornya.

**11.7 Konstanta peringkat belum dikalibrasi.** Bobot `0.5 / 0.2 / 0.3`, paruh waktu 24 jam,
kejenuhan suka 50, peluruhan 0.5, dan lantai 0.25 dipilih dari penalaran, bukan dari data —
karena datanya belum ada. Semuanya terkunci tes, jadi mengubahnya adalah tindakan sadar.

## 12. Yang Sengaja TIDAK Ada di Fase Ini

Balasan · repost · kutipan · penanda "ingin bertemu" (Fase 3c) · notifikasi proximity ·
unggahan on-chain · lebih dari satu gambar · video · tagar · pencarian · mengikuti akun ·
kuota unggah per alamat · pembobotan suka dengan trust · pembekuan peringkat per sesi.

## 13. Verifikasi

**13.1 Penilai diuji sebagai fungsi murni.** Satu tes per konstanta: ubah `0.5` menjadi
`0.6` pada peluruhan diversitas, satu tes merah. Bukan tes yang lulus karena kebetulan.

**13.2 Tes kunci typehash** untuk `Post` dan `Like`, meniru
`packages/shared/test/event-typehash.test.ts`, membuktikan keduanya tidak bertabrakan dengan
tipe mana pun yang sudah ada. Penjaga langsung terhadap kelas kesalahan Ruling 23.

**13.3 Greenfield tidak pernah disentuh tes.** Adapter di balik port dengan fake. Adapter
asli diverifikasi manual saat deploy: buat bucket, unggah satu gambar, baca kembali lewat
URL publik, dan pastikan `image_status` berpindah `pending` → `ready`.

**13.4 `packages/trust` harus tetap tidak tersentuh.** Dibuktikan dengan
`git diff --stat <base>..HEAD -- packages/trust` kosong, sama seperti Fase 3a.

**13.5 Skor pengguna lama tidak boleh bergeser.** Feed hanya membaca `trust_snapshots.ratio`
dan tidak pernah menulis ke sana.

## 14. Langkah Berikutnya

Spec ini masuk ke `superpowers:writing-plans` untuk menjadi rencana implementasi TDD
task-per-task, lalu dieksekusi dengan `superpowers:subagent-driven-development` seperti Fase
3a.

Setelah 3b tuntas dan ter-deploy, **Fase 3c — "ingin bertemu"** mendapat spec tersendiri,
dengan feed sebagai permukaan tempat penandanya hidup.
