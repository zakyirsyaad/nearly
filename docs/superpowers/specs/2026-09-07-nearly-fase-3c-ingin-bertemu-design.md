# Nearly Fase 3c — "Ingin Bertemu": Design Spec

**Tanggal:** 2026-09-07
**Status:** Disetujui, siap masuk perencanaan implementasi
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/specs/2026-09-07-nearly-fase-3b-feed-design.md` (tuntas, tergabung ke main)

---

## 1. Posisi dalam Roadmap

Fase 3 di spec induk §11 dipecah tiga:

- **3a** — event, RSVP, check-in terverifikasi (tuntas, ter-deploy)
- **3b** — feed, peringkat berbasis graf pertemuan, gambar Greenfield (tuntas, tergabung)
- **3c (dokumen ini)** — penanda "ingin bertemu", angka publiknya, pengungkapan saat saling
  menandai, dan loop yang menutup keduanya ke event

3b dikerjakan lebih dulu justru karena penanda ini butuh permukaan berisi orang yang **belum**
kamu temui, dan sampai feed ada, permukaan itu tidak ada.

**Satu prasyarat yang ditemukan saat merancang fase ini:** kartu feed **tidak menautkan ke
profil**. Satu-satunya jalan ke layar profil masih dari daftar koneksi — yaitu orang yang
sudah kamu temui. Jadi 3b membangun permukaan berisi orang asing, tapi profil mereka tetap
tidak bisa dibuka. Menambahkan tautan itu termasuk ruang lingkup fase ini.

**Kriteria selesai:** seseorang bisa menandai orang yang belum pernah ditemuinya, angkanya
terlihat publik di profil, dua orang yang saling menandai saling terungkap, dan layar event
memberi tahu berapa di antara mereka yang akan hadir.

## 2. Keputusan yang Terkunci

| Aspek | Keputusan |
|---|---|
| Mencabut tanda | **Bisa dicabut, dan angkanya ikut turun** |
| Penyaring bot | **TIDAK ADA — semua tap dihitung** (menimpa spec induk §7.6, lihat §2.2) |
| Ruang lingkup | Penanda + angka + pengungkapan + **loop event**. Daftar privat ditunda (§12) |
| Pemberitahuan | **Di dalam aplikasi saja** — layar kecocokan dengan lencana. Tanpa push |
| Penyimpanan | **Tanpa on-chain.** Postgres saja |
| Kecocokan | **Dihitung, tidak disimpan** — dua baris ada, itu saja definisinya |
| Angka publik | Hidup di layar profil. Tombolnya di kartu feed **dan** layar profil |
| Bukti baca | `GET /profile/:address` butuh tanda tangan untuk membuka bendera pribadi |

### 2.1 Kenapa mencabut menurunkan angka

Spec induk §7.6 menulis *"Hanya bisa naik. Tidak ada yang bisa menurunkan angka orang
lain."* Tekanannya ada pada **orang lain** — dan itu tetap berlaku penuh. Yang §7.6 tidak
jawab adalah apakah kamu boleh mencabut tandamu sendiri.

Jawabannya ya, karena alternatifnya lebih buruk dalam dua arah. Kalau tanda permanen,
menandai berarti menyerahkan keputusan pengungkapan identitasmu kepada orang lain tanpa
batas waktu: kamu menandai hari ini, dia menandaimu balik setahun lagi, dan kalian terbuka
satu sama lain walau kamu sudah tidak menginginkannya. Kalau tanda bisa dicabut tapi
angkanya tidak turun, angka publiknya berhenti jujur — ia menghitung orang yang **pernah**
ingin bertemu, bukan yang **masih**, dan lama-lama tidak berarti apa-apa.

Kalimat §7.6 itu perlu ditulis ulang menjadi *"tidak ada yang bisa menurunkan angka orang
lain"*, yang memang maksud aslinya.

### 2.2 Kenapa tidak ada penyaring bot, dan apa ongkosnya

Ini keputusan pemilik project, dan ia **menimpa spec induk secara langsung**. §7.6 menulis:

> **Tap dari akun ber-trust nol tidak dihitung.** Angkanya tetap persis dan tetap publik;
> ini semata supaya angka tidak bisa digelembungkan bot. Bot tidak bisa membangun graf, tapi
> bot bisa menekan tombol — jadi penyaring ini perlu.

Fase ini tidak memasang penyaring itu. Setiap tap dihitung.

Konsekuensinya dicatat penuh di §11.1, bukan disamarkan. Perbaikan spec induk termasuk ruang
lingkup implementasi fase ini — kode yang diam-diam berbeda dari spec-nya lebih berbahaya
daripada keputusan yang tercatat.

### 2.3 Kenapa tidak menyentuh chain

Berbeda dari Fase 3a, di sini alasannya bukan biaya melainkan sifat fiturnya sendiri.

§7.6 mewajibkan penanda ini **default anonim**: yang ditandai tidak tahu siapa yang
menandainya. Apa pun yang naik ke chain bersifat publik selamanya — alamat penandanya
terbaca siapa saja, langsung dari node. On-chain tidak cuma mahal di sini, ia **merusak
sifat inti fiturnya**, dan tidak ada cara menambalnya selain tidak melakukannya.

## 3. Model Data

Migrasi `supabase/migrations/0005_meet.sql`. RLS menyala tanpa policy, seperti setiap tabel
lain; API mengakses lewat service role key.

### 3.1 `ingin_bertemu`

```sql
create table if not exists ingin_bertemu (
  target     text not null references profiles(address) on delete cascade,
  who        text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  -- Satu tanda per pasangan. Mencabut adalah penghapusan baris, dan angka
  -- publiknya adalah hitungan baris untuk satu target (§2.1).
  primary key (target, who),
  -- Menandai diri sendiri tidak berarti apa-apa dan akan mengotori angka.
  constraint ingin_bertemu_bukan_diri check (target <> who)
);

create index if not exists ingin_bertemu_who_idx on ingin_bertemu (who);
```

Indeks pada `who` diperlukan karena kecocokan dan loop event membaca dari kedua arah:
"siapa yang menandaiku" memakai primary key, "siapa yang kutandai" memakai indeks ini.

### 3.2 Kolom baru di `profiles`

```sql
alter table profiles add column if not exists cocok_dilihat_at timestamptz;
```

Kecocokan tidak disimpan (§4.1), jadi "sudah dilihat" tidak bisa ditempelkan padanya. Satu
kolom nullable di `profiles` cukup: lencana menghitung kecocokan yang lebih baru dari nilai
ini, dan `null` berarti semuanya baru. Satu kolom, bukan tabel baru.

## 4. Kecocokan dan Pengungkapan

### 4.1 Kecocokan dihitung, tidak disimpan

Dua orang saling menandai berarti dua baris ada. Itu saja definisinya.

Konsekuensinya penting: kalau salah satu mencabut, kecocokannya lenyap dengan sendirinya.
Tidak ada tabel kecocokan yang bisa desinkron dari tanda yang menjadi sumbernya, dan tidak
ada jalur kode yang bisa lupa menghapusnya.

### 4.2 Kartu kecocokan tidak punya tombol lanjutan

Layar kecocokan menampilkan alamat, nama tampilan, tier, dan tautan ke profil. **Tidak ada
tombol pesan, dan itu disengaja** — pesan baru datang di Fase 4 (spec induk §11).

Yang bisa dilakukan cuma melihat profilnya dan pergi menemuinya, persis tesis spec induk §7.4: online
menciptakan keinginan, offline menyelesaikannya. Menaruh tombol chat di sini akan
membocorkan aturan inti lewat pintu belakang — argumen yang sama persis dengan penolakan
balasan di feed (spec 3b §2.2).

### 4.3 Loop event

Layar detail event menampilkan dua angka, keduanya hanya untuk pemanggil yang terbukti:

- **Berapa orang yang menandaimu sudah RSVP di acara ini** (`penandaHadir`) — irisan antara
  himpunan penandamu dan himpunan RSVP acara.
- **Berapa orang yang SALING ingin bertemu denganmu sudah RSVP di acara ini**
  (`kutandaiHadir`) — irisan antara himpunan **kecocokan**-mu dan himpunan RSVP acara.

Inilah yang spec induk §7.7 sebut sebagai alasan strategis seluruh fitur event: *"Luma
memberi tahu kamu apa acaranya. Nearly memberi tahu siapa yang akan ada di sana dan kenapa
kamu harus datang."*

Angka, bukan daftar. Daftar akan membocorkan siapa yang menandai siapa, dan itu justru yang
dijaga §7.6.

**Perbaikan yang ditemukan saat implementasi (bukan di rancangan awal fase ini):** cabang
publik `GET /events/:id` sudah membocorkan jumlah RSVP event kepada siapa pun. Di event kecil
— dua orang RSVP, misalnya — pemanggil yang tahu dirinya salah satu dari keduanya bisa
membaca `penandaHadir: 1` sebagai "peserta satunya menandaiku", mengidentifikasi penandanya
lewat eliminasi murni, tanpa pernah menandai balik. Itu tepat fakta "X menandai Y" yang dijaga
spec induk §7.6, disusun ulang dari sebuah angka — dan seluruh premis fase ini adalah bahwa
pengungkapan butuh KEDUA pihak.

Perbaikannya: `penandaHadir` hanya disertakan saat DUA ambang terpenuhi sekaligus —
`summary.rsvps ≥ PENANDA_HADIR_MIN_RSVP` (5) **dan** nilai angkanya sendiri
`≥ PENANDA_HADIR_MIN_NILAI` (3), keduanya konstanta di `apps/api/src/routes/events.ts`.
Kalau salah satu tidak terpenuhi, kuncinya **dihilangkan sama sekali** dari respons — bukan
`0`, bukan `null` — supaya ketiadaan angka tidak sendirinya jadi klaim faktual. Ambang RSVP
itu **lunak** dan ambang nilai itu yang mengikat; alasannya dieja di §11.7.

**Perbaikan kedua, ditemukan pada review akhir cabang: `kutandaiHadir` versi sepihak adalah
oracle keanggotaan RSVP.** Rancangan awal menghitungnya sebagai `|tandaOleh ∩ RSVP(acara)|`.
Operan kedua itu baris privat orang lain, dan tiga langkah berikut seluruhnya berada di dalam
kemampuan klien yang sudah dikirim:

1. Baca `kutandaiHadir` untuk acara E. Cabang terbukti hanya meminta bukti `LihatEvent` yang
   ditandatangani sendiri — tidak perlu RSVP, check-in, atau hubungan apa pun dengan E.
2. `POST /ingin-bertemu` menandai korban X. Menandai itu gratis, sepihak, tidak butuh kontak
   sebelumnya, dan **senyap**: X melihat `inginBertemuCount` publiknya naik satu, tapi tidak
   pernah tahu oleh siapa.
3. Baca `kutandaiHadir` lagi. Selisih 1 berarti **X sudah RSVP di E**. Cabut tandanya —
   barisnya terhapus dan angkanya kembali seperti semula.

Diulang lintas hasil penemuan acara, itu memberi kalender X ke depan. Status RSVP per orang
privat di seluruh bagian aplikasi lain; ini menjadikannya oracle lokasi fisik di aplikasi yang
justru mempertemukan orang asing secara fisik, dan bisa dijalankan orang yang belum pernah
ditemui atau disadari X.

Perbaikannya: memotong **kecocokan**, bukan tanda sepihak — `kecocokanDari(tandaOleh, tandaKe)`
lalu `irisan(...)`, keduanya fungsi murni yang sudah ada di `apps/api/src/meet-rank.ts`. Kedua
pihak dalam sebuah kecocokan sudah sepakat saling terlihat, jadi angkanya tidak mengungkap apa
pun yang baru: agar RSVP X ikut terhitung, X harus lebih dulu menandai pemanggil balik —
pilihan X sendiri. Tanpa persetujuan dua arah itu angkanya tidak bergerak sedikit pun, jadi
tidak ada yang bisa dipancing dari luar. Karena itu `kutandaiHadir` tetap **tidak** diberi
ambang: yang ditampilkannya sudah berada di dalam batas pengungkapan yang dibuka kedua orang
itu sendiri.

Konsekuensi yang disengaja: orang yang kamu tandai tapi belum menandaimu balik **tidak** ikut
terhitung. Kalimat di layar acara ikut berubah menjadi "N orang yang saling ingin bertemu
denganmu sudah RSVP" — kalimat lama akan mengklaim lebih banyak daripada yang dihitung.

Ini mengurangi risiko, bukan menghapusnya — lihat residunya di §11.7.

## 5. Tanda Tangan

Empat tipe EIP-712 baru di `packages/shared/src/meet.ts`:

```
InginBertemu   { target: address, who: address, ingin: bool, expiresAt: uint64 }
LihatProfil    { target: address, who: address, expiresAt: uint64 }
LihatKecocokan { who: address, expiresAt: uint64 }
TandaiDilihat  { who: address, expiresAt: uint64 }
```

**Kenapa `LihatKecocokan` terpisah dari `LihatProfil`.** `LihatProfil` mengikat `target`,
karena ia membuka bendera tentang HUBUNGAN antara dua orang. Membaca daftar kecocokan sendiri
tidak punya target — yang dibuktikan cuma "aku adalah `who`". Memaksakan `LihatProfil` di sana
berarti mengarang `target` yang tidak berarti apa-apa.

**`LihatKecocokan` dan `TandaiDilihat` berbentuk field IDENTIK, dan itu justru intinya.** Yang
pertama bukti BACA, yang kedua perintah TULIS. Nama tipe yang berbeda membuat digest-nya
berbeda, dan itulah satu-satunya hal yang mencegah tanda tangan baca yang bocor lewat query
string dipakai menghapus lencana kecocokan orang lain. Ini pelajaran Ruling 23 dipakai dengan
sengaja, bukan kebetulan.

Keempatnya **tidak pernah naik ke chain** (§2.3), dan karena itu tidak boleh punya pasangan
typehash di Solidity mana pun — sama seperti `Rsvp`, `LihatEvent`, dan kelima tipe feed.

**Kenapa `TandaiDilihat` tipe tersendiri, bukan `LihatProfil` yang dipakai ulang.** Menandai
kecocokan sebagai sudah dilihat adalah perintah **TULIS** ke barismu sendiri, sementara
`LihatProfil` adalah bukti **BACA**. Memakai yang kedua untuk yang pertama mengulang persis
kelas kesalahan Ruling 23: bukti baca berkeliaran di query string, dan kalau ia sah sebagai
perintah tulis, siapa pun yang menangkapnya bisa menghapus lencana kecocokan orang lain —
menyembunyikan dari mereka bahwa seseorang baru saja saling menandai. `TandaiDilihat` tidak
memuat `target` sama sekali karena ia tidak berbicara tentang orang lain.

**Kenapa menandai ditandatangani.** Tanpa itu, `who` datang telanjang dari badan permintaan
dan siapa pun bisa menandai atas nama orang lain. Di sini akibatnya lebih berat daripada di
feed: menandai bisa memicu pengungkapan identitas, jadi memalsukan tanda berarti bisa
memaksa orang terungkap.

**`ingin` dibuat `bool`** supaya pencabutan ikut ditandatangani — kalau tidak, siapa pun bisa
mencabut tanda orang lain lewat badan permintaan.

**Domain** memakai `ConnectionRegistry` sebagai `verifyingContract`, sama seperti tipe feed:
jangkar identitas seluruh aplikasi ini adalah graf pertemuan, dan kontrak itulah yang
memegangnya.

### 5.1 Kenapa `LihatProfil` ada, dan kenapa ia KEBALIKAN dari keputusan di feed

Di spec 3b §9.3 diputuskan bahwa `GET /feed?who=` **tidak** butuh bukti baca, karena yang
bocor cuma urutan berdasarkan kedekatan graf — dan graf koneksi sudah publik on-chain, jadi
gerbang di situ menambah gesekan tanpa menambah perlindungan.

Di sini kebalikannya, dan alasannya harus dinyatakan supaya perbedaannya tidak terbaca
sebagai kelalaian: **"X menandai Y" tidak publik di mana pun.** Itu justru informasi yang
§7.6 nyatakan default anonim. Kalau `GET /profile/:address?who=` mengembalikan "apakah `who`
sudah menandai orang ini" tanpa bukti, siapa pun bisa menanyakan satu alamat demi satu alamat
dan memetakan siapa menginginkan siapa — membatalkan anonimitas yang jadi syarat fiturnya.

Jadi bendera pribadi hanya keluar kalau pemanggil membuktikan dirinya `who` lewat tanda
tangan `LihatProfil`. Ini pola yang sama persis dengan `LihatEvent` di Fase 3a.

Tanda tangan yang cacat **bukan galat**: rute profil tidak boleh gagal untuk orang asing yang
membuka tautan. Yang terjadi hanya bendera tidak keluar.

### 5.2 Penjaga Ruling 23

Keempat nama baru unik di seluruh aplikasi, jadi digest-nya berbeda dari satu sama lain dan
dari **kelima belas tipe yang sudah ada**: `HandshakeOffer`, `HandshakeAccept`, `Vouch`,
`RevokeVouch`, `Report`, `CreateEvent`, `CheckInOffer`, `CheckInAccept`, `Rsvp`,
`LihatEvent`, `Post`, `Like`, `HapusPost`, `LampirGambar`, `LaporPost`. Setelah fase ini
aplikasi memiliki **sembilan belas** tipe EIP-712, dan tidak satu pun boleh bertabrakan.

Di sini taruhannya lebih tinggi daripada di fase mana pun sebelumnya. Kalau bukti baca bisa
dipakai sebagai perintah tulis, tanda tangan yang bocor lewat query string — log akses,
proxy, siapa pun yang membaca URL dalam masa berlakunya — bisa dipakai **menandai orang atas
nama korban**, dan menandai bisa memicu pengungkapan identitas. Dikunci tes (§13.2).

### 5.3 Loop event tidak butuh mesin bukti baca baru

`GET /events/:id` sudah menerima `?who=&expiresAt=&sig=` dan sudah memverifikasinya dengan
`recoverLihatEventSigner` untuk membuka `sudahRsvp` dan `sudahCheckIn` (spec 3a §9.1). Dua
angka loop menempel di cabang terbukti yang sudah ada itu — nol mesin baru.

Keduanya memang harus dijaga. Tanpa itu, siapa pun bisa menanyakan "berapa orang yang ingin
bertemu Alice akan datang ke acara ini", dan dengan mengulanginya lintas banyak acara, pola
tanda Alice bisa disimpulkan tanpa pernah melihat satu nama pun.

## 6. Permukaan API

| Endpoint | Keterangan |
|---|---|
| `POST /ingin-bertemu` | Bertanda tangan `InginBertemu`, medan `ingin` true/false |
| `GET /kecocokan?who=&expiresAt=&sig=` | Daftar kecocokan; **wajib** bukti `LihatKecocokan` |
| `POST /kecocokan/dilihat` | Bertanda tangan **`TandaiDilihat`**, menyetel `cocok_dilihat_at` |
| `GET /profile/:address` | **diperluas** — lihat §6.1 |
| `GET /events/:id` | **diperluas** — dua angka loop di cabang terbukti |

### 6.1 Bentuk respons `GET /profile/:address`

Medan yang sudah ada (`address`, `displayName`, `ens`, `txCount`, `connectionCount`) tidak
berubah. Tiga tambahan:

```
inginBertemuCount   tanpa bukti apa pun — angka publik (spec induk §7.6);
                    HILANG (bukan 0) kalau store gagal menjawab
sudahKutandai       HANYA dengan bukti LihatProfil
salingMenandai      HANYA dengan bukti LihatProfil
```

`inginBertemuCount` tidak butuh bukti, tapi ia juga **bukan** medan yang selalu ada. Kalau
`hitungTanda` gagal, kuncinya dihilangkan alih-alih dijatuhkan ke `0`: layar profil mencetak
angka ini sebagai "0 orang ingin bertemu dia", klaim faktual tentang orang lain yang lahir
dari store yang sedang mati. Klien sudah merender ketiadaannya dengan benar (tidak
menampilkan apa-apa), jadi ketiadaan itulah jawaban yang jujur — bandingkan dengan `ens: null`
dan `txCount: 0` di respons yang sama, yang memang benar untuk anon tanpa ENS.

### 6.2 Bentuk respons `GET /kecocokan`

```
{ kecocokan: [ { address, displayName, tier, sejakMs } ], baru: number }
```

`sejakMs` adalah waktu kecocokan terbentuk — yaitu yang **lebih baru** di antara dua baris
tandanya (§7). `baru` adalah jumlah kecocokan dengan `sejakMs` melewati `cocok_dilihat_at`,
dan **inilah satu-satunya sumber angka lencana di beranda** — tidak ada endpoint hitung
terpisah. Beranda memanggil endpoint yang sama dan membaca `baru`; layar kecocokan memanggilnya
dan menampilkan daftarnya. Satu sumber kebenaran, satu tanda tangan.

`GET /kecocokan` **berbeda** dari rute profil dalam satu hal penting: ia mengembalikan
identitas orang lain, jadi bukti baca di sana bukan opsional. Tanpa tanda tangan sah, ia
menolak dengan `403` — bukan mengembalikan daftar kosong, karena daftar kosong dan "kamu tidak
berhak" adalah dua hal berbeda dan klien perlu membedakannya.

**Konsekuensi yang perlu dinyatakan:** beranda kini melakukan satu operasi tanda tangan setiap
kali dibuka, hanya untuk mengambil angka lencana. Beranda sudah memegang signer, jadi tidak
ada gesekan yang terlihat pengguna — tapi ini ongkos yang dipilih sadar demi tidak membangun
endpoint hitung tanpa autentikasi, yang akan membocorkan berapa kecocokan dimiliki sebuah
alamat.

## 7. Peringkat dan Perhitungan

Tiga perhitungan yang sebenarnya bisa salah di fase ini semuanya **fungsi murni** di
`apps/api/src/meet-rank.ts`. Menaruhnya di store berarti hanya bisa diuji dengan Supabase
sungguhan; di sini setiap kasus tepi punya tesnya sendiri.

**Kecocokan** — irisan antara himpunan "yang kutandai" dan "yang menandaiku". Pembandingan
alamat selalu case-insensitive.

**Lencana** — kecocokan yang `created_at`-nya lebih baru dari `cocok_dilihat_at`. Waktu
kecocokan adalah yang **lebih baru** di antara dua baris tandanya: kecocokan baru ada saat
tanda kedua dibuat. `cocok_dilihat_at` bernilai `null` berarti semuanya baru.

**Dua angka loop event** — irisan antara himpunan penanda dan himpunan RSVP acara.

## 8. Mobile

**Kartu feed** dapat tombol "Ingin bertemu" dan tautan ke profil penulisnya. Tautan itu belum
pernah ada (§1) dan merupakan prasyarat, bukan tambahan.

**Layar profil** dapat angka publik dan tombolnya. Angka tampil untuk semua orang; tombolnya
menampilkan keadaan saat ini (sudah menandai atau belum) hanya setelah bukti baca berhasil.

**Layar `kecocokan.tsx`** baru — daftar orang yang saling menandai denganmu, dengan tautan ke
profil masing-masing dan tanpa tombol lanjutan (§4.2). Membuka layar ini memanggil
`POST /kecocokan/dilihat`.

**Beranda** dapat tautan "Saling ingin bertemu" berlencana jumlah kecocokan baru.

**Layar detail event** dapat dua baris loop, hanya kalau bukti bacanya berhasil.

**Angka publik tidak ditampilkan di kartu feed**, hanya tombolnya. Kartu feed sudah memuat
nama, tier, baris alasan, teks, gambar, dan empat tombol; menambah angka bukti sosial di sana
akan menenggelamkan baris alasan yang justru dijaga spec 3b §10.3 sebagai hal yang tidak
boleh hilang.

## 9. Sambungan ke Trust

**Tidak ada.** Menandai tidak menghasilkan koneksi, tidak menyentuh graf pertemuan, dan tidak
mengubah skor siapa pun. `recomputeTrust` **tidak** dipanggil dari rute mana pun di fase ini —
sama seperti feed di Fase 3b, dan untuk alasan yang sama: keinginan bertemu bukan pertemuan.

Ini juga yang membuat aturan inti Nearly tetap utuh. Menandai seseorang tidak mendekatkanmu
padanya di graf; hanya bersalaman yang melakukan itu.

## 10. Yang Sengaja TIDAK Ada di Fase Ini

Daftar privat semua penandamu (spec induk §7.6 — ditunda sadar, lihat §12) · push
notification · pesan (Fase 4) · daftar nama di loop event (hanya angka, §4.3) · angka ingin
bertemu di kartu feed (§8) · penyaring bot (§2.2) · menandai lewat pencarian alamat ·
riwayat tanda yang sudah dicabut.

## 11. Batas yang Diakui

Semuanya keputusan sadar. Ditulis supaya bisa dibongkar kalau nanti terbukti merugikan.

**11.1 Angka ingin bertemu bisa digelembungkan bot.** Tidak ada penyaring (§2.2), padahal
spec induk §7.6 mewajibkannya. Bot tidak bisa membangun graf pertemuan, tapi bot sangat bisa
membuat seribu alamat dan menekan tombol. Karena angka ini adalah **angka paling menonjol di
seluruh produk** — terpampang di setiap profil sebagai bukti sosial — ia juga sasaran
pemalsuan yang paling menarik. Digabung dengan keputusan suka di spec 3b §11.2, sekarang ada
dua angka publik yang bisa dipalsukan, dan keduanya bertabrakan dengan klaim penutup Fase 2
di spec induk §11: *"serangan sybil bisa didemokan dan gagal secara matematis."* Penawarnya
diketahui dan ditolak secara sadar: menghitung hanya tap dari alamat yang punya minimal satu
koneksi terverifikasi — garis yang sama yang sudah dipakai discovery Fase 3a dan slot
pendatang Fase 3b.

**11.2 Pengungkapan tidak bisa dibatalkan dalam arti sebenarnya.** Mencabut tanda menghapus
kecocokan dari daftar kedua pihak, tapi orang yang sudah melihat identitasmu tidak bisa
melupakannya. Yang bisa ditutup hanya pintunya, bukan yang sudah lewat.

**11.3 Tanda tangan `ingin: true` bisa diputar ulang** dalam masa berlaku `expiresAt`, dan di
sini akibatnya lebih berat daripada suka di feed: ia bisa **membuka kembali pintu
pengungkapan yang baru saja seseorang tutup**. Jendelanya pendek dan ini konsisten dengan
setiap tanda tangan lain di repo; mekanisme nonce khusus ditolak karena konsistensi lebih
berharga daripada menutup jendela sesempit itu di satu tempat saja.

**11.4 Angka publik menciptakan dinamika papan peringkat.** Diakui sejak spec induk §7.6:
angka kecil pada pengguna baru bisa terasa memalukan. Obatnya sudah diketahui kalau nanti
terbukti merusak — sembunyikan angka di bawah ambang tertentu, seperti yang dilakukan sistem
tier di §8.

**11.5 Kecocokan hanya diketahui saat aplikasi dibuka.** Tanpa push notification, momen paling
bernilai di produk ini — dua orang saling menemukan — bisa lewat berhari-hari. Diterima
karena push adalah subsistem utuh dengan izin OS, kredensial FCM/APNs, dan jalur yang tidak
bisa diuji tanpa perangkat asli.

**11.6 Setiap muat layar profil butuh satu tanda tangan.** Itu ongkos bukti baca §5.1. Layar
profil sudah punya signer, jadi tidak ada gesekan yang terlihat pengguna — tapi ia tetap satu
operasi kriptografi per muat.

**11.7 Dua ambang `penandaHadir`: yang satu lunak, yang satu mengikat, dan residunya tetap
ada.** Ditemukan saat implementasi (Task 10) lalu diperbaiki lagi pada review akhir cabang —
lihat §4.3. Jujurnya begini, satu per satu:

**Ambang RSVP (`PENANDA_HADIR_MIN_RSVP`, 5) LUNAK.** Ia mengandaikan bahwa `summary.rsvps`
mengukur besar kerumunan. Itu tidak benar: `rsvp()` di `apps/api/src/event-gate.ts` hanya
memeriksa kedaluwarsa, keberadaan acara, acara belum usai, tanda tangan, dan duplikat — tidak
ada tier, tidak ada syarat koneksi, tidak ada ongkos, tidak ada tulisan on-chain. **Baris RSVP
gratis dibuat.** Penyerang di acara berdua cukup menambahkan empat alamat miliknya sendiri:
`summary.rsvps` jadi 6, gerbangnya terbuka, dan `penandaHadir: 1` tetap berarti "satu-satunya
peserta sungguhan yang lain menandaiku". Himpunan anonimitasnya tidak bertambah seorang pun.
Ambang ini dipertahankan sebagai lapis kedua, bukan sebagai jaminan.

**Ambang nilai (`PENANDA_HADIR_MIN_NILAI`, 3) yang benar-benar menutup identifikasi.** Kasus
yang menunjuk orang adalah angka KECIL, bukan kerumunan kecil: `penandaHadir: 1` menyebut satu
orang lewat eliminasi berapa pun besar acaranya. Ambang pada nilai menutup itu tanpa
bergantung pada jumlah RSVP sama sekali — dan justru itu yang membuatnya kebal terhadap
serangan di atas: **menggelembungkan RSVP tidak menaikkan `penandaHadir`.** Angka itu hanya
naik kalau orang sungguhan menandai pemanggil, dan penyerang tidak punya cara memaksa siapa
pun melakukannya. Sybil bisa membuka gerbang pertama; gerbang ini tidak.

**Residunya tetap berdiri, dan tidak boleh dibaca sebagai selesai.** Pada jumlah peserta N
berapa pun, `penandaHadir === N − 1` tetap berarti SEMUA peserta lain menandaimu — kesimpulan
yang bisa ditarik pemanggil sendiri tanpa bantuan siapa pun, dan yang tidak ditutup oleh
ambang mana pun di atas. Menaikkan ambang memperkecil peluang kebetulan seperti itu, tidak
menutupnya; ini k-anonimitas seperti di mana saja — butuh kerumunan yang cukup besar, bukan
jaminan matematis. Obat yang lebih kuat (mis. menyembunyikan jumlah RSVP itu sendiri) ditolak
untuk fase ini karena mengubah kontrak publik yang sudah dipakai fitur lain.

Perhatikan bahwa `kutandaiHadir` **tidak** punya residu sejenis setelah perbaikan §4.3: ia
memotong kecocokan, jadi setiap angkanya sudah berada di dalam pengungkapan yang dibuka kedua
pihak sendiri.

## 12. Penundaan Sadar

**Daftar privat pemilik profil.** Spec induk §7.6 menjanjikan: *"Pemilik profil melihat
daftarnya secara privat — berguna untuk memutuskan datang ke event mana."* Fase ini tidak
membangunnya.

Loop event (§4.3) memberi manfaat utama yang dijanjikan kalimat itu — memutuskan datang ke
event mana — memakai angka saja, tanpa daftar. Daftar penuh adalah permukaan privasi
tersendiri: ia mengungkap identitas orang yang **belum** menandai balik, yang bertentangan
langsung dengan anonimitas default kecuali dirancang dengan hati-hati sebagai pengecualian
sepihak.

Ditunda, bukan dibuang. Ia mendapat keputusan tersendiri di fase berikutnya.

## 13. Verifikasi

**13.1 Ketiga perhitungan diuji sebagai fungsi murni** dengan fixture: kecocokan, lencana,
dan dua angka loop event. Termasuk kasus tepi — pencabutan di tengah, alamat beda
kapitalisasi, himpunan kosong, dan `cocok_dilihat_at` bernilai `null`.

**13.2 Tes silang tipe.** Setiap tipe tulis (`InginBertemu`, `TandaiDilihat`) tidak sah
sebagai tipe baca (`LihatProfil`, `LihatKecocokan`) dan sebaliknya. Pasangan
`LihatKecocokan`/`TandaiDilihat` mendapat perhatian khusus karena bentuk fieldnya identik —
hanya nama tipenya yang memisahkan bukti baca dari perintah tulis. Ini penjaga langsung terhadap kelas kesalahan Ruling 23,
dan di fase ini taruhannya adalah kemampuan memalsukan tanda atas nama orang lain.

**13.3 Bukti baca benar-benar menjaga.** Satu tes memanggil `GET /profile/:address?who=`
**tanpa** tanda tangan dan membuktikan `sudahKutandai` tidak keluar. Satu tes lagi memanggil
`GET /kecocokan` tanpa tanda tangan dan membuktikan ia MENOLAK, bukan mengembalikan daftar
kosong.

**13.4 Typehash lintas seluruh aplikasi.** Tes menuntut **sembilan belas** `encodeType` unik
di seluruh `packages/shared` — bukan hanya di dalam keluarga meet. Tabrakan lintas keluarga
justru yang paling mungkin lolos, karena tidak ada satu berkas pun yang memuat semuanya. Tes
ini juga menuntut ketiga tipe baru tidak punya pasangan di Solidity mana pun.

**13.5 `packages/trust` harus tetap tidak tersentuh.** Dibuktikan `git diff --stat
<base>..HEAD -- packages/trust` kosong, sama seperti dua fase sebelumnya.

**13.6 `recomputeTrust` tidak dipanggil dari rute mana pun di fase ini** (§9). Dibuktikan
dengan pembacaan `app.ts`: rute meet dirakit tanpa `onChanged`.

**13.7 Menandai diri sendiri ditolak** di gerbang, bukan hanya di database.

## 14. Perbaikan Spec Induk yang Termasuk Ruang Lingkup

Dua kalimat di spec induk §7.6 menjadi tidak akurat karena fase ini dan harus diperbaiki
bersamaan dengan implementasinya:

1. *"Hanya bisa naik. Tidak ada yang bisa menurunkan angka orang lain."* → hanya bagian
   kedua yang berlaku; mencabut tandamu sendiri menurunkan angka (§2.1).
2. *"Tap dari akun ber-trust nol tidak dihitung … jadi penyaring ini perlu."* → penyaring
   tidak dipasang, dan konsekuensinya dicatat di §11.1 dokumen ini (§2.2).

Kode yang diam-diam berbeda dari spec-nya lebih berbahaya daripada keputusan yang tercatat.

## 15. Langkah Berikutnya

Spec ini masuk ke `superpowers:writing-plans` untuk menjadi rencana implementasi TDD
task-per-task, lalu dieksekusi dengan `superpowers:subagent-driven-development` seperti dua
fase sebelumnya.

Setelah 3c tuntas, Fase 3 selesai seluruhnya dan **Fase 4 — Radar & pesan** menjadi berikutnya
(spec induk §11).
