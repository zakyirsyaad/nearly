# Nearly Fase 4a — Blokir: Design Spec

**Tanggal:** 2026-09-08
**Status:** Disetujui, siap masuk perencanaan implementasi
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Fase sebelumnya:** `docs/superpowers/specs/2026-09-07-nearly-fase-3c-ingin-bertemu-design.md` (tuntas, tergabung ke main, terverifikasi lapangan)

---

## 1. Posisi dalam Roadmap

Spec induk §11 menaruh empat hal di bawah satu nama **"Fase 4 — Radar & pesan"**: radar
(siapa di event ini sekarang), mode visibilitas, blokir, dan pesan lewat XMTP. Itu empat
subsistem, bukan satu, dan terlalu besar untuk satu spec. Fase 4 dipecah tiga:

- **4a (dokumen ini)** — blokir
- **4b** — radar & mode visibilitas
- **4c** — pesan XMTP

**Urutannya bukan preferensi, sebagiannya dipaksa spec induk.** §7.5 menyatakan pesan **tidak
boleh dikirim ke produksi tanpa** blokir dari dalam percakapan, lapor dari dalam percakapan,
dan koneksi terblokir yang berhenti menghantar trust. Jadi blokir prasyarat pesan, bukan
saudara sejajarnya.

Di antara 4b dan 4c, rekomendasinya **4c lebih dulu**: pesan yang menyelesaikan tesis produk
di §1 (tidak perlu menyerahkan Telegram), sementara radar adalah tambahan di atas halaman
event yang sudah bekerja. Kalau waktu habis, **4b yang dikorbankan.**

**4a juga melunasi utang yang sudah tercatat.** `apps/api/src/trust/load-graph.ts:150`
menetapkan `blocked` **keras jadi `false`**, dan spec 3b §6.4 sudah menuliskan aturan yang
harus berlaku begitu Fase 4 mendarat: koneksi terblokir tidak boleh dihitung sebagai lompatan.
Sampai fase ini mendarat, graf trust menghitung hubungan yang seharusnya sudah putus.

**Kriteria selesai:** seseorang bisa memblokir siapa pun — termasuk orang asing dari feed —
blokirnya memutus jangkauan dua arah, koneksinya tetap ada di graf tapi berhenti menghantar
trust, dan blokirnya bisa dicabut dari sebuah daftar.

## 2. Keputusan yang Terkunci

| Aspek | Keputusan |
|---|---|
| Siapa yang bisa diblokir | **Siapa pun**, termasuk orang yang belum pernah ditemui |
| Penyimpanan | **Tabel `blocks` tersendiri**, bukan kolom di `connections` |
| Arah efek | **Dua arah** — saling tak terlihat di permukaan yang Nearly kendalikan |
| Mencabut | **Bisa**, lewat daftar blokir. Tanda "ingin bertemu" yang tertekan ikut kembali |
| Tanda "ingin bertemu" | **Tanda dari pemblokir berhenti dihitung** di angka publik yang diblokir; tanda dari yang diblokir **tetap dihitung** di angka pemblokir. Kecocokan bubar dua arah. Barisnya **bertahan** (§5.2, amandemen review akhir) |
| Feed untuk `?who=` | **Efek blokir hanya untuk penonton terbukti** lewat bukti baca `LihatFeed` (§5.1, amandemen review akhir) |
| Handshake saat terblokir | **Dibiarkan berhasil** — koneksinya fakta, blokirnya lapisan di atasnya |
| Blokir vs lapor | **Terpisah penuh.** Tidak ada yang memicu yang lain |
| Pemberitahuan ke yang diblokir | **Tidak ada.** Blokir senyap |
| On-chain | **Tidak ada.** Postgres saja — blokir privat, koneksinya tetap publik on-chain |

### 2.1 Kenapa tabel tersendiri, bukan kolom di `connections`

Dua alasan, keduanya memaksa:

1. **Orang asing bisa diblokir.** `connections` menurut definisi hanya memuat orang yang
   pernah kamu temui. Orang yang menandaimu dari feed — justru yang paling mungkin mengganggu
   — tidak punya baris di sana.
2. **`connections` tidak bisa menyimpan arah.** Skemanya punya
   `check (addr_a < addr_b)` dengan satu baris per pasangan (`0001_init.sql`). Satu boolean di
   baris itu tidak bisa membedakan "A memblokir B" dari "B memblokir A".

### 2.2 Kenapa dua arah

Blokir ada di sini untuk menutup celah yang spec induk §7.5 sebut sendiri: *"sebelum ada
pesan, orang yang pernah bertemu kamu tidak punya cara mengganggumu. Sekarang ada."*

Satu arah tidak koheren dengan tombolnya sendiri: A masih akan melihat unggahan B di feed,
masih bisa mengetuk ke profilnya, dan masih bisa menandainya "ingin bertemu". Kalau kamu
memblokir seseorang, jalur **ke arahnya** harus ikut tertutup, bukan cuma jalur darinya.

## 3. Model Data

Migrasi `supabase/migrations/0006_blokir.sql`:

```sql
create table if not exists blocks (
  blocker    text not null check (blocker ~ '^0x[0-9a-f]{40}$'),
  blocked    text not null check (blocked ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  -- Arah disimpan eksplisit: satu orang memblokir satu orang. Trust nanti
  -- meruntuhkannya jadi simetris, tapi antarmuka butuh tahu siapa yang
  -- memulai supaya hanya pemblokir yang melihat tombol cabut.
  primary key (blocker, blocked),
  -- Memblokir diri sendiri mustahil di basis data DAN ditolak di gerbang
  -- (§7.1) — dua lapis dengan alasan berbeda, lihat catatan di sana.
  constraint blocks_bukan_diri_sendiri check (blocker <> blocked)
);

alter table blocks enable row level security;
```

**Huruf kecil saja, ditegakkan CHECK.** Fase 3b pernah kebobolan di sini: regex
case-insensitive di kolom kunci membuat satu orang bisa masuk dua kali dengan casing berbeda
dan melubangi ambang tiga pelapor. Kunci di sini juga gabungan, jadi jebakannya identik.

**Tanpa foreign key ke `profiles`.** Berbeda dari `ingin_bertemu` di Fase 3c, yang kedua
kolomnya FK. Alasannya: kamu bisa memblokir alamat yang belum pernah menyentuh Nearly sama
sekali, dan `ensureProfile` untuk orang yang mungkin tidak pernah muncul lagi hanya menumpuk
baris profil kosong. Konsekuensinya: kueri yang menggabungkan blokir dengan profil harus
menangani profil yang tidak ada.

**RLS menyala tanpa policy**, seperti setiap tabel lain. API memakai service role key;
ketiadaan policy itulah yang menahan klien anonim.

## 4. Sambungan ke Trust

**`packages/trust` sudah menangani blokir sepenuhnya, dan paket itu TIDAK BOLEH DISENTUH.**

Setiap konsumennya sudah memeriksa dan membuang edge terblokir:

| Berkas | Baris | Perilaku |
|---|---|---|
| `packages/trust/src/types.ts` | 15 | `blocked: boolean` sudah ada di tipe edge |
| `packages/trust/src/graph.ts` | 62, 75 | edge terblokir dibuang dari graf berarah |
| `packages/trust/src/compute.ts` | 18 | tidak dihitung sebagai koneksi |
| `packages/trust/src/diversity.ts` | 58, 97 | tidak dihitung untuk diversitas |
| `packages/trust/src/fingerprint.ts` | 34 | tidak masuk sidik jari |

`graph.ts:47` bahkan sudah menulis komentarnya: *"edge `blocked` dibuang sepenuhnya (Fase 4)"*.

**Jadi sambungannya cuma satu titik.** `apps/api/src/trust/load-graph.ts:150` berhenti menulis
`false` keras dan mulai membaca himpunan blokir. Sebuah edge `blocked: true` kalau **salah satu
arah** memblokir — runtuh jadi simetris persis seperti yang `packages/trust` harapkan, dan itu
benar karena trust memang tidak boleh mengalir ke arah mana pun.

**Himpunan blokir dimuat SEKALI** di awal `loadGraph`, bukan satu kueri per edge. Graf dimuat
utuh setiap recompute; kueri per-edge akan mengubah satu recompute jadi ribuan perjalanan ke
database.

**Memblokir TIDAK memicu recompute** (amandemen review akhir, Ruling R10). Rute blokir sengaja
tidak memanggil `onChanged`. Efek blokir pada skor trust masuk pada recompute **berikutnya** —
yang dipicu handshake atau vouch mana pun.

Alasannya privasi, bukan hemat: recompute segera menulis perubahan tier **on-chain** lewat
`setScore` pada detik blokir terjadi. Stempel waktu publik itu menandai blokir yang privat
(§2) — siapa pun yang mengamati tier dua orang berubah bersamaan tepat setelah salah satunya
aktif bisa menduga hubungannya. Menunda ke recompute berikutnya memutus korelasi waktu itu.
Harganya: skor bisa basi sampai recompute berikutnya (§10.6).

## 5. Efek di Setiap Permukaan

### 5.1 Feed

Dua arah: unggahan B hilang dari feed A, dan unggahan A hilang dari feed B. Disaring di
`feed-store.ts` saat mengumpulkan kandidat.

**Hanya untuk penonton TERBUKTI** (amandemen review akhir, keputusan pemilik). `GET /feed?who=`
sejak Fase 3b menerima `who` tanpa bukti, karena ia hanya dipakai untuk urutan graf dan graf
koneksi publik on-chain. Begitu `who` juga menyaring blokir, rute itu jadi oracle: bandingkan
`GET /feed` dengan `GET /feed?who=A` — penulis yang hilang di yang kedua punya hubungan blokir
dengan A, dan nilai `hop` ikut bergeser. Gratis, tanpa tanda tangan, untuk alamat mana pun.

Jadi `who` punya dua tingkat:

- `who` yang alamatnya valid tetap dipakai untuk **urutan graf**, persis seperti Fase 3b.
- Efek blokir — saringan unggahan dan edge terblokir di `petaHop` — hanya berlaku kalau
  permintaan membawa bukti baca **`LihatFeed`** (`who` + `expiresAt` + `sig`) yang sah, belum
  kedaluwarsa, dan penanda tangannya `who`. Untuk `who` tanpa bukti, tabel `blocks` tidak
  dibaca sama sekali.
- Bukti yang hilang, cacat, kedaluwarsa, milik orang lain, atau bertipe salah **tidak pernah
  4xx**. Rute feed tidak boleh gagal untuk orang yang membuka tautan; ia turun ke "tidak
  terbukti".

**`petaHop` juga harus membuang edge terblokir.** `apps/api/src/feed-store.ts` menghitung
hop dari tabel `connections` **langsung**, terpisah dari graf trust. Edge yang menyentuh
blokir **penonton sendiri** dibuang sebelum lompatan dihitung, sehingga orang ketiga yang hanya
terjangkau lewat orang yang diblokir ikut keluar jangkauan.

**Feed dan trust sengaja TIDAK sepakat sepenuhnya** (amandemen review akhir). Trust membuang
edge antara pasangan terblokir **mana pun**; feed hanya edge yang menyentuh blokir penonton.
Kalau B memblokir Z, penonton masih menjangkau Z lewat B di feed, tapi tidak di trust. Versi
per-pasangan di feed butuh himpunan blokir pihak ketiga, dan `hop` yang dikirim ke penonton
akan membocorkannya — Z yang tiba-tiba "di luar jaringanmu" memberi tahu penonton bahwa B dan
Z saling memblokir.

**Konsekuensi yang tidak akan diduga pengguna:** memblokir seseorang mengubah jarak hop ke
**orang lain**. Kalau B adalah 1-hop dan lewat B kamu terhubung ke sepuluh orang, memblokir B
mendorong kesepuluhnya menjauh atau keluar jangkauan. Itu memang yang §7.5 minta, tapi efeknya
lebih luas dari "satu orang hilang".

**Ini TIDAK dijelaskan di dialog blokir** (keputusan produk, §2). Kalimatnya akan berbunyi
teknis dan menakutkan untuk hal yang jarang terasa, dan mekanik graf bukan yang harus
dipikirkan orang saat sedang ingin menyingkirkan seseorang.

### 5.2 Penanda dan kecocokan

Diamandemen di review akhir (keputusan pemilik: **"hanya sisi yang diblokir"**). A memblokir B:

- Tanda **A ke B berhenti dihitung** — angka publik B turun satu. Dari sisi B, A adalah orang
  yang memblokirnya.
- Tanda **B ke A TETAP dihitung** di angka publik A. Blokir A sendiri tidak pernah menggerakkan
  angka A.
- Aturan yang sama untuk `penandaHadir` di `GET /events/:id`: ia hanya membuang tanda dari
  orang yang **memblokir** pemanggil.
- **Kedua barisnya bertahan.** Mencabut blokir mengembalikan semuanya; tidak ada yang perlu
  menandai ulang.
- **Kecocokan bubar ke dua arah** — di `GET /kecocokan` dan `kutandaiHadir`. Kecocokan adalah
  irisan dua tanda, dan sisi "yang ditandai pemanggil" tetap disaring himpunan blokir dua
  arah. `kutandaiHadir` tetap kecocokan ∩ RSVP (Fase 3c).
- Selama terblokir, keduanya **tidak bisa menandai** satu sama lain; mencabut tanda sendiri
  tetap boleh (R5).

**Kenapa tidak simetris seperti versi awal.** Versi awal membuang tanda dari kedua arah, dan
itu membuat angka publik jadi oracle selisih: A membaca angkanya sendiri (n), memblokir B,
membaca lagi. n−1 berarti **B pernah diam-diam menandai A** — lalu A mencabut blokirnya tanpa
jejak, dan B tidak pernah tahu. Varian lokasinya lewat `penandaHadir`: angkanya turun berarti
B menandai A **dan** RSVP di acara itu. Kelas yang sama dengan Critical Fase 3c. Dengan hanya
membuang tanda dari **pemblokir**, tindakan A sendiri tidak pernah memindahkan angka A, dan
selisih itu tidak ada lagi.

Harganya: B yang diblokir A masih menyumbang satu ke kehadiran publik A. Itu diterima — angka
A hanya berkata "sekian orang ingin bertemu A", dan B memang ingin.

Ini tidak melanggar spec induk §7.6 (*"tidak ada yang bisa menurunkan angka orang lain"*):
yang menurunkan angka B adalah tanda A yang berhenti dihitung karena pilihan A sendiri atas
tandanya sendiri, bukan penghapusan tanda orang lain.

### 5.3 Profil

A membuka profil B lewat daftar blokir: ada tanda jelas dan tombol cabut.

**Batas yang tidak bisa ditepati, dan tidak akan diklaim bisa.** Profil B tidak bisa
benar-benar disembunyikan dari A dalam arti sebaliknya — angka "ingin bertemu" publik menurut
desain §7.6, dan koneksinya publik on-chain di `ConnectionRegistry`. Kalau B membuka profil A
lewat alamat langsung, datanya tetap ada. Yang terputus adalah **jangkauan** B: tidak bisa
menandai, tidak muncul di feed A, dan nanti tidak bisa mengirim pesan.

Menjadikannya 404 akan sekaligus berbohong dan memberi tahu B bahwa ia diblokir. **"Saling tak
terlihat" berlaku untuk permukaan yang Nearly kendalikan; data yang memang publik tetap
publik.**

### 5.4 Handshake — sengaja tidak diubah

Kalau A memblokir B lalu mereka benar-benar bertemu dan memindai QR, **koneksinya dibiarkan
terbentuk.** Itu justru yang §7.5 nyatakan: *"koneksi tetap ada di graf setelah blokir —
pertemuannya memang terjadi, itu fakta — tapi ditandai diblokir."*

Koneksinya catatan faktual bahwa dua orang bertemu; blokirnya lapisan terpisah yang tetap
menahan trust. Menolak handshake akan butuh pesan galat berbeda untuk pemblokir dan yang
diblokir, dan pesan untuk yang diblokir **akan membocorkan blokirnya**. Membiarkannya lewat
lebih sederhana, lebih jujur, dan tidak butuh mekanisme baru.

### 5.5 Lapor — sengaja tidak disentuh

Lapor itu sinyal komunitas yang bisa berujung slash lewat gerbang §9.3; blokir itu privat dan
cuma milikmu. **Tidak ada yang memicu yang lain**, dan gerbang lapor tidak diubah sama sekali.

## 6. Tanda Tangan

Tiga tipe EIP-712 baru, membawa aplikasi ke **22 tipe** (21 di versi awal; `LihatFeed`
ditambahkan di review akhir, keputusan pemilik):

```
Blokir      { target: address, who: address, blokir: bool, expiresAt: uint64 }
LihatBlokir { who: address, expiresAt: uint64 }
LihatFeed   { who: address, expiresAt: uint64 }
```

`Blokir` perintah tulis dengan boolean toggle — pola yang sama dengan `InginBertemu`, satu
tipe untuk memasang dan mencabut. `LihatBlokir` bukti baca untuk `GET /blokir`. `LihatFeed`
bukti baca untuk efek blokir di `GET /feed` (§5.1); ia hidup di keluarga feed
(`packages/shared/src/feed.ts`).

Domain sama seperti seluruh aplikasi:
`{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.

### 6.1 Keluarga Ruling 23 bertambah anggota — dan ini risikonya

`LihatBlokir` jadi tipe **ketiga** yang bentuk fieldnya `{ who, expiresAt }`, bersama
`LihatKecocokan` dan `TandaiDilihat`, dan `LihatFeed` jadi yang **keempat**. Keempatnya
identik bentuknya dan **hanya nama tipenya** yang memisahkan bukti baca dari perintah tulis.

Makin banyak anggota keluarga ini, makin besar peluang seseorang menganggap dua di antaranya
mubazir lalu menggabungkannya — dan penggabungan itu membuat satu tanda tangan sah sebagai
perintah lain. Dua penjaga wajib ada:

1. **Tes typehash** yang menuntut **22** `encodeType` unik di seluruh keluarga, dengan asersi
   jumlah dan asersi tabrakan nama di blok `it` **terpisah** (Fase 3c membuktikan kenapa:
   ketika keduanya satu blok, kegagalan pertama membatalkan blok sebelum asersi kedua
   dijalankan, dan penjaga tabrakan tidak pernah teruji).
2. **Tes kebingungan tipe** berbentuk: tanda tangan sah, dari kunci yang benar, atas nilai
   yang benar, hanya nama tipenya berbeda — harus ditolak. Bentuk persisnya sudah ada di
   `apps/api/test/meet-gate.test.ts` Fase 3c.

`Blokir` juga sebentuk dengan `InginBertemu` (address, address, bool, uint64), tapi nama
medannya berbeda (`blokir` vs `ingin`) sehingga `encodeType`-nya berbeda dua kali. Tetap masuk
hitungan 22 unik, dan tes kebingungan tipenya ada ke dua arah.

## 7. Permukaan API

| Endpoint | Bukti | Keterangan |
|---|---|---|
| `POST /blokir` | `Blokir` | Memasang dan mencabut lewat medan `blokir` |
| `GET /blokir` | `LihatBlokir` | Daftar yang kamu blokir. **403 tanpa bukti sah** |
| `GET /feed` (ubah) | `LihatFeed`, opsional | Efek blokir hanya dengan bukti sah. **Tidak pernah 4xx karena bukti** — tanpa bukti sah turun ke "tidak terbukti" (§5.1) |

**`GET /blokir` menolak 403, bukan mengembalikan daftar kosong.** Daftar siapa yang kamu
blokir itu privat, dan daftar kosong tidak bisa dibedakan dari "kamu tidak memblokir siapa
pun" — persis kegagalan senyap yang aturan 403 di `GET /kecocokan` (spec 3c §6.2) ada untuk
mencegah.

### 7.1 Penolakan di gerbang

**Memblokir diri sendiri ditolak di gerbang**, dan penolakan itu hidup **hanya di gerbang**,
bukan juga di skema Zod — supaya pemeriksaan gerbangnya tetap terjangkau lewat rute dan tidak
menjadi kode mati yang membusuk. Aturan yang sama dipakai penolakan menandai diri sendiri di
Fase 3c §13.7.

CHECK `blocks_bukan_diri_sendiri` di basis data (§3) **bukan duplikasi dari ini**: ia lapis
terakhir yang menahan penulisan langsung ke tabel di luar jalur rute, dan ia tidak pernah
menggantikan pemeriksaan gerbang. Yang tidak boleh ada adalah pemeriksaan **ketiga** di skema.

**Setiap pemulihan tanda tangan wajib lewat `pulihkanTandaTangan`.** Penjaga struktural di
`apps/api/test/sig-rusak.test.ts` memindai semua `*-gate.ts` dan `routes/*.ts` dan akan
menolak panggilan telanjang di gerbang baru ini secara otomatis.

## 8. Mobile

| Berkas | Tanggung jawab |
|---|---|
| `apps/mobile/app/blokir.tsx` | Daftar blokir + tombol cabut |
| `apps/mobile/app/index.tsx` (ubah) | Tautan ke daftar blokir |
| `apps/mobile/app/profile/[address].tsx` (ubah) | Tombol blokir + tanda kalau sudah diblokir |
| `apps/mobile/src/blokir-actions.ts` | **Satu-satunya tempat `Blokir` ditandatangani** |
| `apps/mobile/src/blokir-api.ts` | Pembangun bukti baca + pembacaan daftar |
| `apps/mobile/src/feed-api.ts` (ubah) | `kueriBuktiFeed` — bukti `LihatFeed` di setiap muat feed (amandemen review akhir) |
| `apps/mobile/src/messages.ts` (ubah) | `blokirErrorMessage` |

**Tombol blokir hanya di profil, tidak di kartu feed.** Jalurnya tetap ada: kartu feed sudah
menautkan ke profil sejak Fase 3c, jadi blokir tinggal satu ketukan lebih jauh. Kartu feed
sudah memuat suka, lapor, dan "ingin bertemu"; menambah satu lagi membuatnya penuh untuk aksi
yang jarang.

**Semua teks berbahasa Indonesia**, dalam register hangat orang-kedua yang dipakai layar lain.

## 9. Yang Sengaja TIDAK Ada di Fase Ini

Pesan XMTP (4c) · radar "siapa di event ini sekarang" (4b) · mode visibilitas (4b) · blokir
dari dalam percakapan (4c — percakapannya belum ada untuk ditempati) · perubahan apa pun pada
gerbang lapor · blokir dari kartu feed (§8) · pemberitahuan ke yang diblokir (§2) · blokir
on-chain (§2)

## 10. Batas yang Diakui

**10.1 Blokir tidak bisa menyembunyikan data yang memang publik.** Angka "ingin bertemu" dan
graf koneksi keduanya publik menurut desain. Yang diputus jangkauan, bukan keterlihatan
(§5.3). Jangan pernah mengklaim lebih dari ini dalam pitch.

**10.2 Yang diblokir bisa menyimpulkan.** Sejak amandemen §5.2, yang berhenti dihitung adalah
tanda **pemblokir** di angka orang yang diblokirnya. Jadi B yang diblokir A bisa melihat angka
publiknya sendiri atau `penandaHadir`-nya turun kalau A pernah menandainya; unggahannya hilang
dari feed A; kecocokannya dengan A bubar; dan nanti pesannya tidak sampai. Blokir senyap
berarti tidak ada pemberitahuan, bukan tidak bisa ditebak. Yang **ditutup** amandemen itu arah
sebaliknya: pemblokir tidak lagi bisa memakai blokir untuk mengetahui siapa yang diam-diam
menandainya.

**10.3 Memblokir mengubah jarak ke orang ketiga**, dan itu tidak dijelaskan ke pengguna
(§5.1). Kalau nanti terbukti membingungkan, obatnya sudah diketahui: satu baris penjelasan di
layar daftar blokir, bukan di dialog konfirmasi.

**10.4 Blokir tidak membakar gas relayer secara langsung** (amandemen review akhir, R10).
Versi awal bagian ini menyatakan setiap blokir memicu recompute yang menulis `setScore`
on-chain. Sejak §4 diamandemen, blokir tidak memicu recompute; gasnya dibayar recompute
berikutnya yang memang sudah akan terjadi. Saldo BSC testnet relayer tercatat **0,00887 tBNB**
pada 2026-09-08.

**10.5 Blokir massal tidak dibatasi.** Tidak ada kuota harian seperti pada koneksi dan vouch.
Blokir tidak menghantar apa pun ke siapa pun, jadi menyalahgunakannya hanya merugikan diri
sendiri — tapi ini keputusan sadar, bukan kelalaian. Karena itu pula tabel `blocks` bisa
dibanjiri dari luar (ribuan kunci sekali pakai yang memblokir satu korban); setiap pembaca
himpunan blokir karenanya berhalaman dengan urutan total stabil, dan pemeriksaan satu pasangan
memakai pencarian primary key, bukan memuat himpunan (amandemen review akhir).

**10.6 Skor trust bisa basi setelah blokir** (amandemen review akhir, R10). Karena blokir tidak
memicu recompute (§4), edge terblokir masih menghantar trust sampai handshake atau vouch
mana pun memicu recompute berikutnya. Diterima demi tidak menandai waktu blokir on-chain.

**10.7 Terhadap orang yang sudah cocok, blokir adalah probe RSVP tanpa jejak** (amandemen
review akhir, R11). Pemanggil yang sudah cocok dengan X bisa: baca `kutandaiHadir` di sebuah
acara, blokir X, baca lagi, cabut blokir. Turun satu berarti X RSVP di acara itu. Spec 3c §11.8
menjadikan "kecocokan menyala lagi sebagai *baru*" satu-satunya jejak probe cabut-pasang
tanda; blokir melewati jejak itu, karena memblokir tidak menyentuh `sejakMs` dan mencabutnya
memulihkan kecocokan apa adanya. **Tidak ditutup**: menutupnya berarti kecocokan tidak bubar
saat blokir, yang mematahkan §5.2. Cooldown cabut-blokir di luar cakupan fase ini. Himpunan
yang bisa disurvei tetap terbatas pada orang yang sudah memilih mencocoki pemanggil.

**10.8 Jumlah permintaan `hitungTanda` bergantung pada banyaknya pemblokir** (amandemen review
akhir, M2). Sejak §5.2, angka publik T mengecualikan himpunan pemblokir T, dan `hitungTanda`
butuh 1 permintaan kalau himpunan itu kosong tapi 1+⌈n/100⌉ kalau tidak (R7). Pengamat yang
mengukur latensi `GET /profile/T` secara prinsip bisa menebak "ada yang memblokir T".
Keparahannya rendah — bedanya satu perjalanan ke database, tertimbun jitter jaringan, dan
tidak menyebut siapa — tapi ini batas yang diakui, bukan yang tidak terlihat.

**10.9 Feed dan trust tidak sepakat soal blokir pihak ketiga** (amandemen review akhir, M1).
Lihat §5.1: feed hanya memutus edge yang menyentuh blokir penonton, trust memutus semua edge
terblokir. Menyamakannya di feed akan membocorkan blokir pihak ketiga lewat `hop`.

## 11. Verifikasi

**11.1 Pemetaan blokir ke edge diuji sebagai fungsi murni** — dua arah runtuh jadi satu
boolean, dan pasangan yang tidak punya koneksi tidak menghasilkan edge apa pun.

**11.2 Store diuji dengan mengemudikan store sungguhan** lewat klien Supabase palsu, bukan
hanya pemetaan barisnya. Fase 3c membuktikan kenapa: tiga tes pemetaan murni membiarkan arah
filter tertukar dan `ensureProfile` ganda terhapus tanpa satu tes pun merah.

**11.3 Gerbang diuji** untuk blokir diri sendiri, tanda tangan dari penanda tangan yang salah,
tanda tangan kedaluwarsa, dan **tanda tangan yang panjangnya sah tapi byte `v`-nya rusak** —
yang terakhir wajib mengembalikan 401, bukan 500.

**11.4 `GET /blokir` tanpa bukti wajib 403**, dan diuji juga dengan tanda tangan
`LihatKecocokan` maupun `TandaiDilihat` yang bentuk fieldnya identik — keduanya harus ditolak.
**`GET /feed` dengan `who` tanpa bukti `LihatFeed` sah** (termasuk tanda tangan `LihatKecocokan`)
wajib 200 dengan keluaran yang tidak bergantung pada tabel `blocks` (amandemen review akhir).

**11.4a Invarian angka publik** (amandemen review akhir): X memblokir B yang pernah menandai X
tidak mengubah angka publik X maupun `penandaHadir` X; B memblokir X menurunkannya; kecocokan
dan `kutandaiHadir` tetap bubar ke dua arah. Diuji lewat rute dengan store palsu yang
membedakan kedua arah blokir.

**11.5 Batas global diverifikasi**: `git diff --stat <base>..HEAD -- packages/trust` kosong,
dan 22 `encodeType` unik.

**11.6 Uji lapangan** terhadap API dan Supabase sungguhan, seperti Fase 3b dan 3c: blokir
menurunkan angka publik **yang diblokir** (bukan pemblokir), kecocokan bubar, unggahan hilang
dua arah di feed yang membawa bukti `LihatFeed`, mencabut mengembalikan semuanya, dan skor
trust berubah setelah recompute **berikutnya** (blokir sendiri tidak memicunya, §4).

## 12. Perbaikan Spec Induk yang Termasuk Ruang Lingkup

**12.1 Urutan pengorbanan di §14.6 sudah basi.** Ia menyebut *"FYP (Fase 5) dulu, lalu
vouch/tag di Fase 2"* sebagai urutan pemotongan kalau waktu habis. FYP sudah dibangun sebagai
Fase 3b dan tergabung. Urutan yang berlaku sekarang: **4b (radar & visibilitas) yang pertama
dikorbankan**, lalu vouch/tag.

**12.2 §11 Fase 4 dipecah tiga** (§1 dokumen ini). Spec induk masih menuliskannya sebagai satu
fase.

## 13. Langkah Berikutnya

Rencana implementasi rinci lewat skill `superpowers:writing-plans`, lalu eksekusi.

Setelah 4a tuntas, **4c (pesan XMTP)** menjadi berikutnya — prasyaratnya sudah terpenuhi, dan
`expo-dev-client` sudah terpasang sejak Fase 0 sehingga tidak ada kejutan build.
