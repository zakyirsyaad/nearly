# Nearly Fase 2 — Trust Score: Design Spec

**Tanggal:** 2026-09-04
**Status:** Disetujui, siap masuk perencanaan implementasi
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/plans/2026-09-03-nearly-fase-0-1.md` (tuntas)

---

## 1. Posisi dalam Roadmap

Fase 1 membangun grafnya: dua HP hanya bisa terkoneksi kalau benar-benar berdekatan, dan
koneksinya tercatat on-chain. Tapi graf mentah itu **cuma daftar**. Profil yang menulis
"47 koneksi" belum memberi tahu apa pun — bot juga bisa punya 47 koneksi sesama bot.

Fase 2 mengubah daftar itu menjadi informasi, dan dengan begitu menjawab masalah yang
ditulis spec induk §1: *"Di ruangan berisi 500 orang, tidak ada cara tahu siapa yang layak
ditemui."*

**Kriteria selesai (spec induk §11):** serangan sybil bisa didemokan dan gagal secara
matematis.

Tiga fase berikutnya bergantung pada fase ini dan tidak bisa dibangun tanpanya:

| Bergantung pada trust | Fase | Rujukan |
|---|---|---|
| Tap "ingin bertemu" dari akun ber-trust nol tidak dihitung | 3 | §7.6 |
| Event dari host ber-trust rendah tidak muncul di discovery | 3 | §7.7 |
| Gerbang laporan butuh pelapor ber-trust tinggi | 2 | §9.3 |
| `NearlyResolver.getTier()` untuk dApp lain | 2 | §10.3 |

## 2. Keputusan yang Terkunci

Diambil lewat sesi brainstorming 2026-09-04. Semua sudah final; yang berubah dari spec induk
diberi tanda.

| Aspek | Keputusan | Catatan |
|---|---|---|
| Sumber diversitas | Tipe netral `occasionId`, bukan `eventId` | ⚠️ menyimpang dari §8 — lihat §2.1 |
| Isi occasion di Fase 2 | `(cell geohash7, jendela 3 jam)` | Fase 3 mengisinya dari check-in terverifikasi |
| Skor on-chain | Semua on-chain, `setScore` satu tx per alamat | Merkle root ditolak |
| Kapan dihitung ulang | Tiap ada koneksi/vouch baru | Snapshot DB tiap kali |
| Kapan ditulis on-chain | Hanya alamat yang **tier**-nya berubah | Pengendali biaya gas |
| Seed set | Wallet pemilik project, satu alamat | Bisa dilebarkan tanpa deploy ulang |
| Penyimpanan seed | Tabel `trust_seeds` | Bukan env var |
| Tier | Rasio terhadap skor tertinggi di graf | Ambang tetap 0.02 / 0.15 / 0.45 |
| Vouch + tag | **Masuk** Fase 2 | §14 risiko 6 mengizinkan menundanya; tidak diambil |
| Peluruhan waktu | Dibangun & diuji, **tidak diaktifkan** | §11.1 butir 7 |
| Arsitektur | Fungsi murni di `packages/trust`, dirakit API | Sama seperti pola Fase 1 |
| `fingerprint.ts` | Dipisah dari `diversity.ts` | ⚠️ menyimpang dari §12 — lihat §2.2 |

### 2.1 Kenapa `occasionId`, bukan `eventId`

Spec induk §8 menyatakan faktor diversitas mengambil event dari check-in terverifikasi
(§7.7), *"bukan tebakan geohash"*. Tapi entitas event dan check-in baru lahir di **Fase 3** —
setelah fase ini. Di Fase 2 belum ada event yang bisa dipakai.

Penyelesaiannya: `packages/trust` menerima `occasionId: string` yang **netral terhadap
sumbernya**. Fase 2 mengisinya dari `(cell, jendela 3 jam)` — yang secara alami
mengelompokkan koneksi di satu ruangan pada satu sore. Fase 3 mengisinya dari `event_id`
check-in terverifikasi.

`packages/trust` tidak berubah sebaris pun saat pergantian itu. Janji §8 tetap ditepati
begitu event masuk, dan demo anti-sybil tetap bisa dijalankan sekarang.

### 2.2 Kenapa `fingerprint.ts` dipisah

Spec induk §12 menaruh sidik jari ko-lokasi di dalam `diversity.ts`. Tugas keduanya berbeda:
diversitas menilai **satu orang**; sidik jari mencari **beberapa akun yang ternyata satu
operator**. Keduanya sama-sama padat test, dan digabung akan menghasilkan file tersulit
dibaca di seluruh repo.

## 3. Arsitektur

```
packages/trust/src/
  types.ts        Kosakata bersama: TrustGraph, TrustEdge, Seed, TrustResult
  pagerank.ts     Personalized PageRank dari seed
  diversity.ts    Entropi occasion x entropi waktu x (1 - clustering)
  fingerprint.ts  Sidik jari ko-lokasi: Jaccard + korelasi temporal
  vouch.ts        Bobot edge dari vouch
  slashing.ts     Gerbang laporan + propagasi slash ke penjamin
  tier.ts         Rasio ke seed -> tier
  index.ts        computeTrust(graph, opts) -> TrustResult[]

apps/api/src/trust/
  load-graph.ts   Supabase -> TrustGraph. Satu-satunya yang tahu SQL trust
  recompute.ts    Perakit: muat -> hitung -> simpan snapshot -> publish tier yang berubah
  publish.ts      Port ke TrustAttestor

apps/api/src/routes/   trust.ts, vouch.ts, report.ts, admin.ts
packages/contracts/src/  VouchRegistry.sol, TrustAttestor.sol, NearlyResolver.sol
supabase/migrations/0002_trust.sql
apps/mobile/           badge tier + baris bukti, tombol vouch + tag, tombol lapor
```

**`computeTrust` adalah satu-satunya pintu keluar `packages/trust`.** Masuk: graf sebagai
data biasa. Keluar: skor, tier, bukti, dan daftar klaster operator. **Tidak ada I/O di
dalamnya sama sekali.**

Konsekuensi terpentingnya: uji "100 bot terisolasi menghasilkan trust mendekati nol" berjalan
sebagai unit test biasa — tanpa DB, tanpa chain, tanpa device. Ini syarat §13 spec induk, dan
alasan pola ini dipilih ulang dari Fase 1 (`colocation.ts` murni, `handshake-gate.ts`
merakit).

## 4. Algoritma

### 4.1 Masukan

```ts
type TrustEdge = {
  a: Address; b: Address;   // urutan kanonik, a < b
  occasionId: string;       // Fase 2: (cell, jendela 3 jam); Fase 3: id event
  atMs: number;
  blocked: boolean;         // Fase 4; sudah ada di tipe, selalu false sekarang
};

type Vouch = { from: Address; to: Address; atMs: number };   // BERARAH

type Seed = { address: Address; weight: number };

type TrustGraph = {
  edges: TrustEdge[];
  vouches: Vouch[];
  seeds: Seed[];
  slashed: Address[];       // pelaku yang sudah dikonfirmasi manusia
  nowMs: number;
};

type TrustResult = {
  address: Address;
  score: number;            // PageRank mentah
  ratio: number;            // score / skor tertinggi di graf, 0..1
  tier: 0 | 1 | 2 | 3;      // Baru, Dikenal, Terpercaya, Inti
  evidence: {
    connections: number; occasions: number; regions: number; vouches: number;
  };
  operatorCluster: string | null;
};
```

### 4.2 Personalized PageRank

Damping `d = 0.85`, power iteration sampai selisih L1 antar iterasi `< 1e-9`, batas 100
iterasi. Koneksi bersifat dua arah, jadi tiap edge menjadi dua edge berarah berbobot
`vouchWeight x decay(umur)`.

**Yang membuat ini kebal sybil ada di satu detail:** vektor teleport diisi **seed**, bukan
disebar rata ke semua node. Di PageRank biasa setiap node mendapat jatah awal, dan gumpalan
100 bot yang padat justru **menumpuk** peringkat. Dengan teleport hanya ke seed, kepercayaan
cuma bisa masuk lewat seed, sehingga gumpalan tanpa jalur ke seed konvergen ke ~0.

Ini bukan penyetelan parameter dan bukan heuristik — ini yang membuat klaim §8 spec induk
benar secara matematis.

`decay()` dibangun lengkap dan diuji, tapi **mengembalikan 1 di Fase 2** sesuai §11.1 butir 7:
dalam rentang waktu demo tidak ada koneksi yang cukup tua untuk meluruh, jadi mengaktifkannya
tidak terlihat sama sekali.

**Vouch disimpan terpisah dari edge, bukan sebagai `vouchWeight` di dalamnya.** Edge adalah
pertemuan fisik dan bersifat dua arah — ia kanonik (`a < b`). Vouch bersifat **berarah** (§5),
jadi satu angka pada edge kanonik tidak bisa menyatakan siapa menjamin siapa. Bobot arah
dirakit di `graph.ts` saat graf berarah dibangun.

### 4.3 Diversitas

```
D       = H_occasion x H_waktu x (1 - C)      semuanya dinormalisasi ke 0..1
pengali = 0.15 + 0.85 x D
```

- `H_occasion` — entropi Shannon ternormalisasi atas sebaran koneksi antar occasion.
  50 koneksi di satu occasion memberi `H = 0`; 50 koneksi merata di 10 occasion memberi
  `H ≈ 0.59`.
- `H_waktu` — entropi yang sama atas ember waktu harian.
- `C` — koefisien clustering lokal: makin semua kenalanmu saling kenal, makin kecil `1 - C`.

**Lantai `0.15` sengaja ada.** Tanpa itu, pengguna baru yang jujur — baru punya satu-dua
koneksi di satu tempat — mendapat entropi nol dan skor nol, persis seperti bot. Dia memang
harus rendah, tapi tidak boleh difitnah.

### 4.4 Sidik jari ko-lokasi

Untuk tiap pasang akun, bandingkan himpunan koneksinya:

```
J = |N(u) ∩ N(v)| / |N(u) ∪ N(v)|                    kemiripan Jaccard
T = porsi koneksi bersama yang terjadi di occasion sama dalam ±10 menit

J >= 0.8  DAN  T >= 0.6  DAN  keduanya punya >= 5 koneksi  ->  satu operator
```

Akun yang tergabung dalam satu klaster **berbagi satu skor, dibagi rata**. Ini menegakkan
argumen §9.1 spec induk secara langsung: memiliki 5 akun tidak melipatgandakan trust, ia
**mengencerkannya**.

Ketiga ambang di atas adalah tebakan awal yang jujur dan akan disetel setelah melihat data
lapangan. Karena itu semuanya **parameter fungsi**, bukan angka yang ditanam di dalam badan
fungsi.

### 4.5 Tier & bukti

```
rasio = skor / skor tertinggi di graf

Baru        rasio < 0.02
Dikenal     0.02 <= rasio < 0.15
Terpercaya  0.15 <= rasio < 0.45
Inti        rasio >= 0.45
```

**Penyebutnya skor tertinggi di graf, bukan skor seed.** Ini koreksi terhadap rancangan awal,
dan alasannya matematis: PageRank berpersonalisasi **tidak menjamin seed memegang skor
tertinggi.** Kepercayaan mengalir keluar dari seed lalu menumpuk di simpul yang paling banyak
tetangganya; seed sendiri hanya menerima kembali lewat jatah teleport dan pantulan. Pada graf
sesederhana `seed—A—B`, A memperoleh 0.459 sementara seed 0.345.

Kalau penyebutnya skor seed, rasio bisa melebihi 1 dan janji "hasilnya 0 sampai 1" jadi tidak
benar. Dengan penyebut skor tertinggi, rentangnya benar menurut konstruksi, selalu ada tepat
satu orang di 1.00, dan kalimat *"seberapa dekat orang ini ke pusat kepercayaan"* menjadi tepat
apa adanya. Sifat yang membuat rasio dipilih sejak awal tidak berubah sedikit pun: pembilang
dan penyebut menyusut dengan proporsi yang sama saat populasi bertambah.

**Kenapa rasio, bukan skor mentah.** Skor PageRank bersifat relatif — jumlah seluruh skor
selalu 1. Dengan 20 pengguna rata-rata orang mendapat 0.05; dengan 200 pengguna, 0.005. Orang
yang sama, posisi yang sama di graf, tapi angkanya menyusut 10x hanya karena orang lain
mendaftar. Ambang absolut pada skor mentah akan menurunkan tier semua peserta serentak di
tengah demo, dan di depan juri itu terlihat seperti sistemnya rusak.

Rasio tidak bergerak saat populasi bertambah, karena pembilang dan penyebut menyusut dengan
proporsi yang sama. Tier hanya berubah kalau **posisi orang itu di graf**
berubah.

**Persentil populasi ditolak** meski tampak menarik: ia membuat tier jadi zero-sum — seseorang
bisa turun tier tanpa melakukan apa pun, hanya karena orang lain naik. Itu melanggar prinsip
terkunci §6 spec induk (*"Trust tidak pernah turun karena seseorang tidak menyukaimu"*) lewat
pintu belakang.

**Bukti yang ditampilkan di samping tier:** jumlah koneksi, occasion, wilayah, dan vouch.
"Wilayah" diambil dari 4 huruf pertama geohash (~40 km). Kita tidak tahu nama kotanya dan
tidak perlu tahu, jadi labelnya **"wilayah"**, bukan "kota" — jangan mengklaim lebih dari yang
kita punya.

### 4.6 Urutan perhitungan

Urutan ini mengikat: mengubahnya mengubah hasil, jadi ia bagian dari spec, bukan detail
implementasi.

```
1. Bangun graf berarah dari edges (tiap koneksi -> dua arah, bobot vouchWeight x decay)
2. Buang kontribusi alamat yang sudah di-slash          (§6)
3. Personalized PageRank dari seed                      -> pr[addr]
4. Kalikan dengan pengali diversitas                    -> pr x (0.15 + 0.85 x D)
5. Bagi rata skor antar anggota satu klaster operator   (§4.4)
6. Terapkan penalti penjamin 0.7^n                      (§6, n = jumlah pelaku terkonfirmasi)
7. rasio = skor / skor tertinggi di graf  ->  tier      (§4.5)
```

Diversitas diterapkan **setelah** PageRank, bukan sebagai bobot edge di dalamnya: diversitas
adalah sifat **satu orang** (seberapa tersebar pertemuannya), sedangkan bobot edge adalah
sifat **satu hubungan**. Mencampurnya membuat diversitas seseorang bocor mempengaruhi skor
tetangganya, dan itu tidak pernah dimaksudkan.

Pembagian klaster (langkah 5) datang setelah diversitas karena lima akun satu operator
biasanya juga punya diversitas rendah — keduanya harus mengenai mereka, dan urutan ini
membuat efeknya menumpuk, bukan saling menutupi.

## 5. Vouch

Memakai pola yang sudah terbukti di Fase 1: pengguna menandatangani EIP-712, relayer yang
mengirim dan membayar gas.

- **Syarat: koneksi harus sudah ada.** Ditegakkan dua kali — di API, dan di `VouchRegistry`
  lewat `ConnectionRegistry.isConnected()`. Vouch tanpa pernah bertemu tidak mungkin, dan itu
  ditegakkan kontrak, bukan sekadar server.
- **Kuota 3 per hari, global** (§11.1 butir 8), ditegakkan di API — sama seperti kuota 30
  koneksi/hari di Fase 1. Ini **aturan server, bukan jaminan protokol**, dan harus disebut
  begitu kalau ditanya.
- **Arah vouch berarti.** A vouch B membuat edge `A -> B` berbobot 3; `B -> A` tetap 1.
  Jaminanmu mendorong kepercayaan ke dia, bukan memantul balik — kamu tidak bisa menaikkan
  skormu sendiri dengan menjamin orang.
- **Tag: teks di DB, hash-nya on-chain.** Menyimpan array string di BSC mahal tanpa guna.
  `VouchRegistry` menyimpan `(from, to, at, tagsHash)`; teksnya di Postgres. Hash tetap
  membuktikan tag tidak diubah belakangan.
- **Bisa dicabut.** `revoke()` menghapus bobot tambahan dan melepas tanggung jawab ke depan,
  **tapi tidak menghapus slash yang sudah terjadi.** Kalau tidak begitu, orang tinggal
  mencabut vouch begitu tercium ada masalah, dan "skin in the game" (§7.3) jadi kosong.
- **Tidak ada kebalikan vouch.** Tidak ada downvote, tidak ada rating. Prinsip §6.

## 6. Laporan & Slashing

Spec induk §12 menyebut ini **titik paling rawan di seluruh sistem** — di sinilah brigading
bisa menyelinap masuk kalau gerbangnya longgar. Karena itu aturannya eksplisit:

```
Laporan TIDAK PERNAH menurunkan trust secara langsung. Ia hanya memicu peninjauan.

Gerbang lolos hanya kalau SEMUA terpenuhi:
  >= 3 pelapor
  setiap pelapor tier Terpercaya ke atas (rasio >= 0.15)
  tidak ada dua pelapor yang saling terkoneksi
  tidak ada dua pelapor dalam satu klaster operator yang sama
```

Tiga syarat terakhir yang mematikan brigading. Gerombolan 20 orang yang saling kenal secara
definisi saling terkoneksi, jadi mereka hanya terhitung **satu suara** berapa pun jumlahnya.
Untuk lolos dibutuhkan tiga orang tepercaya yang **tidak saling mengenal** — pola yang sangat
sulit dipalsukan, karena penyerang harus memiliki tiga identitas tepercaya yang saling asing.

**Lolos gerbang bukan berarti di-slash.** Statusnya menjadi `layak_ditinjau`, lalu manusia
yang mengonfirmasi lewat perintah admin. §11.1 butir 3 memotong **UI antreannya, bukan
logikanya**.

**Propagasi slash** setelah konfirmasi:

1. Skor pelaku dinolkan; edge-nya berhenti menghantar kepercayaan.
2. **Satu lompatan** balik ke tiap penjaminnya: skor masing-masing dikali `0.7`, menumpuk
   kalau ia menjamin lebih dari satu pelaku terkonfirmasi.

Berhenti di satu lompatan secara sengaja. Tanpa batas itu, satu penipu bisa menyeret separuh
graf — dan penjamin-dari-penjamin tidak pernah menjamin siapa pun secara langsung.

**Isi laporan tetap off-chain** (berisi tuduhan terhadap orang, §9.3). Yang naik on-chain
hanya hasil slash yang sudah terkonfirmasi.

## 7. On-chain

Jaringan: **BSC testnet, chainId 97** — mengikuti keputusan Fase 1 (catatan pelaksanaan butir
7), bukan opBNB seperti di spec induk §10.3.

| Kontrak | Isi |
|---|---|
| `VouchRegistry` | `vouch(from, to, tagsHash, expiresAt, sig)`, `revoke(...)`, `slash(subject)` |
| `TrustAttestor` | `setScore(who, score, tier)` + event `ScoreUpdated` |
| `NearlyResolver` | `getTrust()`, `getTier()`, `isSlashed()`, `isConnected()` — hanya baca |

**`VouchRegistry`.** Semua fungsi `onlyAttestor` dan memverifikasi tanda tangan pengguna,
sama seperti `ConnectionRegistry` di Fase 1. Kunci map-nya **berarah** (`keccak(from, to)`),
bukan kanonik seperti koneksi: A menjamin B tidak sama dengan B menjamin A.

**`TrustAttestor`.** `score` disimpan sebagai `uint32` = rasio x 1.000.000 — jadi rasio 0.15
tersimpan sebagai `150000`; Solidity tidak punya bilangan desimal. Tiap penulisan memancarkan
`ScoreUpdated`, sehingga seluruh riwayat skor bisa direkonstruksi siapa pun dari log.

**`NearlyResolver`.** Alamat ketiga registry di-`immutable`. Inilah permukaan yang dipakai
dApp lain, dan alasan §10.3 menyebut Nearly sebagai infrastruktur publik, bukan database kita.

### 7.1 Pengendalian biaya gas

PageRank bersifat **global**: satu salaman baru menggeser skor hampir semua orang di graf.
Kalau setiap pergeseran ditulis on-chain, ruangan 100 orang menghasilkan sekitar
100 x 100 = ~10.000 transaksi, sementara saldo relayer saat ini cukup untuk **~53**.

Karena itu:

- **Hitung ulang** tiap ada koneksi/vouch baru, dan **simpan ke `trust_snapshots` tiap kali** —
  sehingga skor di aplikasi selalu segar dan graf terlihat tumbuh hidup.
- **Tulis on-chain hanya alamat yang tier-nya berubah.** Tetap satu tx per skor, tetap
  eksplisit per alamat, tetap terbaca `NearlyResolver`. Yang tidak ditulis hanyalah pergeseran
  0.0001 yang tidak mengubah apa pun yang dilihat orang.

Perkiraan turun dari ribuan transaksi menjadi puluhan.

**Tindakan operasional sebelum demo:** isi ulang dompet relayer dari faucet BSC testnet.
Ini sudah tercatat sebagai hal terbuka di akhir Fase 1 dan menjadi lebih mendesak sekarang.

## 8. Data Off-chain

`supabase/migrations/0002_trust.sql` — enam tabel. RLS menyala tanpa satu pun policy publik,
sama seperti Fase 1; API mengaksesnya lewat service role key.

```
trust_seeds      address PK, weight, note, added_at
vouches          from_addr, to_addr, tags[], tags_hash, created_at, revoked_at, tx_hash
                 PK (from_addr, to_addr)          -- berarah, bukan kanonik
reports          id, reporter, subject, reason, evidence, status, created_at
                 UNIQUE (reporter, subject)       -- satu orang satu suara per subjek
slashes          subject, confirmed_at, tx_hash
trust_snapshots  address PK, score, ratio, tier, connections, occasions, regions,
                 vouches, operator_cluster, computed_at
trust_published  address PK, tier, score, tx_hash, published_at
```

**`trust_published` ada untuk menjawab satu pertanyaan:** apakah tier alamat ini sudah berubah
sejak terakhir dipublikasi? Tanpa tabel ini, tidak ada cara mengetahui transaksi mana yang
layak dikirim, dan penghematan gas di §7.1 tidak bisa ditegakkan.

`UNIQUE (reporter, subject)` pada `reports` menutup cara paling murah menembus gerbang §6:
satu orang mengirim laporan yang sama berkali-kali agar terhitung beberapa pelapor.

## 9. Permukaan API

| Endpoint | Isi |
|---|---|
| `GET /trust/:address` | tier, rasio, dan bukti — dibaca dari `trust_snapshots` |
| `POST /vouch` | EIP-712, diteruskan relayer; kuota harian ditegakkan di sini |
| `POST /vouch/revoke` | mencabut vouch |
| `POST /report` | menyimpan laporan; **tidak pernah** langsung mengubah skor |
| `POST /admin/slash/:address` | konfirmasi manusia; dijaga token admin |

Recompute dipicu setelah handshake dan vouch berhasil.

Port baru di `apps/api/src/ports.ts`, mengikuti pola Fase 1: `TrustStore`, `VouchStore`,
`ReportStore`, `AttestorPort`.

## 10. Mobile

- **Badge tier + baris bukti** di layar profil: `Terpercaya - 47 koneksi · 6 occasion ·
  3 wilayah · 12 vouch`. Tier tanpa bukti akan menghidupkan lagi kecemasan ala Nosedive; §8
  spec induk mensyaratkan keduanya bersama.
- **Tombol vouch + pemilih tag** di profil orang yang sudah terkoneksi. Sisa kuota hari ini
  tampil di sebelahnya — kalau jatahnya tidak terlihat, ia tidak terasa berharga.
- **Tombol lapor**, dengan teks yang jujur bahwa laporan memicu peninjauan, bukan hukuman.

## 11. Verifikasi

Inilah yang menentukan Fase 2 boleh disebut selesai atau tidak.

**Unit (Vitest) di `packages/trust`:**

| Uji | Harus |
|---|---|
| 100 akun sybil terisolasi | rasio < 0.01 |
| 50 koneksi di 1 occasion vs 50 koneksi di 10 occasion | yang pertama jauh lebih kecil |
| 5 akun berpola ko-lokasi identik | terdeteksi satu operator, skor dibagi rata |
| Peluruhan waktu (diaktifkan khusus di test) | koneksi lama menghantar lebih lemah |
| Slash terkonfirmasi | menjalar balik ke penjamin, berhenti di 1 lompatan |
| **20 pelapor yang saling terkoneksi** | **tidak memicu apa pun** |
| 3 pelapor tier Terpercaya dan saling asing | memicu peninjauan |
| Populasi naik 20 -> 200, graf orang itu tetap | tier-nya tidak berubah |
| Input sama dijalankan dua kali | keluaran identik persis |

Dua baris tebal itu yang paling penting. Kalau uji brigading lolos padahal seharusnya gagal,
gerbang laporan bocor — dan §12 spec induk menyebut itu titik paling rawan di seluruh sistem.

Uji determinisme ada karena §10.3 menjanjikan siapa pun bisa menghitung ulang skor dan
membuktikan kita tidak curang. Hasil yang tidak deterministik membatalkan janji itu.

**Foundry:**

- `vouch` tanpa koneksi yang sudah ada harus gagal
- `vouch`, `revoke`, `slash`, `setScore` dari bukan attestor harus gagal
- tanda tangan salah harus gagal
- `NearlyResolver` mengembalikan nilai yang konsisten dengan ketiga registry

**API (Vitest):**

- kuota 3 vouch/hari ditegakkan
- recompute terpanggil setelah handshake dan vouch berhasil
- publish on-chain terjadi **hanya** untuk alamat yang tier-nya berubah
- `POST /report` tidak pernah mengubah skor secara langsung
- pagar chainId Fase 1 tetap hijau untuk ketiga kontrak baru

**Manual sebelum demo:** isi `trust_seeds`, jalankan recompute, pastikan tier pemilik project
`Inti` dan alamat acak tanpa koneksi `Baru`, lalu cek `ScoreUpdated` muncul di BSC testnet
explorer.

## 12. Batas yang Diakui

Sampaikan jujur, jangan diklaim lebih:

1. **Kuota vouch adalah aturan server, bukan jaminan protokol.** Kontrak tidak mengetahui
   kuota harian; API yang menegakkannya.
2. **Seed set adalah satu-satunya kepercayaan yang disuntik manusia.** Semua angka lain
   dihitung. Salah memilih seed berarti salah seluruh papan skor — dan di Fase 2 seed-nya
   hanya satu alamat, sehingga graf tepercaya bisa sempit kalau pemilik project tidak sempat
   banyak bersalaman. Peredamnya: `trust_seeds` bisa dilebarkan lewat `insert`, tanpa deploy
   ulang dan tanpa restart.
3. **Ambang sidik jari ko-lokasi belum tervalidasi lapangan.** `J >= 0.8`, `T >= 0.6` adalah
   tebakan awal; keduanya parameter supaya bisa disetel setelah data nyata masuk.
4. **Sidik jari ko-lokasi bisa menggabungkan orang jujur.** Kalau beberapa orang yang
   benar-benar berbeda hanya pernah menyalami himpunan lawan bicara yang sama, pada menit
   yang sama, tidak ada satu pun informasi di graf yang membedakan mereka dari beberapa akun
   milik satu orang — dan mereka akan digabung, sehingga skor mereka dibagi rata. Dalam
   praktik ini jarang, karena orang sungguhan di ruangan sungguhan juga menyalami orang lain
   yang berbeda-beda; justru keragaman kecil itulah sinyalnya. Ditemukan lewat test dan
   dikunci sebuah test yang sengaja menyatakan batas ini.
5. **"Independen" di gerbang laporan berarti tidak bersebelahan berpasangan, bukan lebih.**
   Rantai kenalan A-B-C-D-E bisa menyumbang {A, C, E} — ketiganya memang tidak saling
   terkoneksi langsung, tapi mereka satu lingkaran sosial. Aturan yang lebih ketat tidak
   tersedia secara praktis: menuntut pelapor dari komponen terhubung yang berbeda akan
   membuat gerbang tidak pernah lolos, karena di graf sosial nyata hampir semua orang berada
   di satu komponen raksasa. Yang menahan celah ini adalah tiga lapis lain — pelapor harus
   mencapai tier Terpercaya, klaster operator ikut diperiksa, dan **tidak ada slash yang
   terjadi tanpa konfirmasi manusia.** Dikunci sebuah test yang sengaja menyatakan batas ini.
6. **Sybil multi-device dideteksi, belum dicegah** (§14 spec induk). Pencegahnya device
   attestation, ditunda pasca-hackathon.
7. **Nearly membuktikan seseorang manusia nyata yang hadir — bukan bahwa dia orang baik.**
   Mengklaim lebih dari ini berbahaya.

## 13. Yang Sengaja TIDAK Ada di Fase Ini

- **Tidak ada event, RSVP, check-in.** Fase 3. `occasionId` mengisi perannya sementara (§2.1).
- **Tidak ada blokir.** Fase 4. Kolom `blocked` sudah ada di tipe dan selalu `false`.
- **Tidak ada UI antrean moderasi & sanggah** (§11.1 butir 3). Gerbangnya penuh, konfirmasinya
  perintah admin.
- **Peluruhan waktu tidak aktif** (§11.1 butir 7).
- **Tidak ada XMTP, radar, FYP.**
- **Tidak ada batch `setScores`.** Satu tx per skor, sesuai keputusan terkunci. Batching bisa
  ditambahkan nanti tanpa mengubah pemanggilnya kalau volume menuntut.

## 14. Langkah Berikutnya

Susun rencana implementasi rinci (skill `superpowers:writing-plans`) sebelum menyentuh kode,
mengikuti pola `docs/superpowers/plans/2026-09-03-nearly-fase-0-1.md`.
