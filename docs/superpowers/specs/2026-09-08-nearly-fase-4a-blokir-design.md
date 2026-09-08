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
| Tanda "ingin bertemu" | **Berhenti dihitung**, barisnya **bertahan** |
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

**Memblokir memicu recompute** lewat `onChanged` yang sudah ada di `app.ts`, termasuk penjaga
anti-tumpang-tindih `recomputeInFlight`-nya.

## 5. Efek di Setiap Permukaan

### 5.1 Feed

Dua arah: unggahan B hilang dari feed A, dan unggahan A hilang dari feed B. Disaring di
`feed-store.ts` saat mengumpulkan kandidat.

**`petaHop` juga harus membuang edge terblokir.** `apps/api/src/feed-store.ts:53` menghitung
hop dari tabel `connections` **langsung**, terpisah dari graf trust — dan komentarnya di baris
50-51 sudah menunjuk ke fase ini. Tanpa perubahan ini feed dan trust memberi jawaban berbeda
tentang graf yang sama, dan yang salah justru feed, karena ia yang menentukan apa yang orang
lihat.

**Konsekuensi yang tidak akan diduga pengguna:** memblokir seseorang mengubah jarak hop ke
**orang lain**. Kalau B adalah 1-hop dan lewat B kamu terhubung ke sepuluh orang, memblokir B
mendorong kesepuluhnya menjauh atau keluar jangkauan. Itu memang yang §7.5 minta, tapi efeknya
lebih luas dari "satu orang hilang".

**Ini TIDAK dijelaskan di dialog blokir** (keputusan produk, §2). Kalimatnya akan berbunyi
teknis dan menakutkan untuk hal yang jarang terasa, dan mekanik graf bukan yang harus
dipikirkan orang saat sedang ingin menyingkirkan seseorang.

### 5.2 Penanda dan kecocokan

- Tanda B ke A **berhenti dihitung** — angka publik A turun satu.
- **Dan sebaliknya juga.** Kalau A pernah menandai B, tanda itu ikut berhenti dihitung dan
  angka publik B turun satu. Efeknya simetris seperti seluruh blokir ini: A tidak boleh terus
  menyumbang ke kehadiran publik orang yang ia blokir, sama seperti sebaliknya. Yang asimetris
  hanya siapa yang bisa mencabutnya.
- **Kedua barisnya bertahan.** Mencabut blokir mengembalikan tanda dari kedua arah; tidak ada
  yang perlu menandai ulang.
- **Kecocokan bubar** — mengikuti sendirinya, karena kecocokan adalah irisan dua tanda dan
  satu sisinya kini tertekan. Mekanik yang sama persis dengan mencabut tanda.
- Selama terblokir, keduanya **tidak bisa menandai** satu sama lain.

Ini tidak melanggar spec induk §7.6 (*"tidak ada yang bisa menurunkan angka orang lain"*):
yang menurunkan angka A adalah A sendiri, bukan orang lain.

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

Dua tipe EIP-712 baru, membawa aplikasi ke **21 tipe**:

```
Blokir      { target: address, who: address, blokir: bool, expiresAt: uint64 }
LihatBlokir { who: address, expiresAt: uint64 }
```

`Blokir` perintah tulis dengan boolean toggle — pola yang sama dengan `InginBertemu`, satu
tipe untuk memasang dan mencabut. `LihatBlokir` bukti baca untuk `GET /blokir`.

Domain sama seperti seluruh aplikasi:
`{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.

### 6.1 Keluarga Ruling 23 bertambah anggota — dan ini risikonya

`LihatBlokir` akan jadi tipe **ketiga** yang bentuk fieldnya `{ who, expiresAt }`, bersama
`LihatKecocokan` dan `TandaiDilihat`. Ketiganya identik bentuknya dan **hanya nama tipenya**
yang memisahkan bukti baca dari perintah tulis.

Makin banyak anggota keluarga ini, makin besar peluang seseorang menganggap dua di antaranya
mubazir lalu menggabungkannya — dan penggabungan itu membuat satu tanda tangan sah sebagai
perintah lain. Dua penjaga wajib ada:

1. **Tes typehash** yang menuntut **21** `encodeType` unik di seluruh keluarga, dengan asersi
   jumlah dan asersi tabrakan nama di blok `it` **terpisah** (Fase 3c membuktikan kenapa:
   ketika keduanya satu blok, kegagalan pertama membatalkan blok sebelum asersi kedua
   dijalankan, dan penjaga tabrakan tidak pernah teruji).
2. **Tes kebingungan tipe** berbentuk: tanda tangan sah, dari kunci yang benar, atas nilai
   yang benar, hanya nama tipenya berbeda — harus ditolak. Bentuk persisnya sudah ada di
   `apps/api/test/meet-gate.test.ts` Fase 3c.

`Blokir` juga sebentuk dengan `InginBertemu` (address, address, bool, uint64), tapi nama
medannya berbeda (`blokir` vs `ingin`) sehingga `encodeType`-nya berbeda dua kali. Tetap masuk
hitungan 21 unik.

## 7. Permukaan API

| Endpoint | Bukti | Keterangan |
|---|---|---|
| `POST /blokir` | `Blokir` | Memasang dan mencabut lewat medan `blokir` |
| `GET /blokir` | `LihatBlokir` | Daftar yang kamu blokir. **403 tanpa bukti sah** |

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

**10.2 Yang diblokir bisa menyimpulkan.** Tandanya berhenti dihitung, unggahannya hilang dari
feed lawan, dan nanti pesannya tidak sampai. Blokir senyap berarti tidak ada pemberitahuan,
bukan tidak bisa ditebak.

**10.3 Memblokir mengubah jarak ke orang ketiga**, dan itu tidak dijelaskan ke pengguna
(§5.1). Kalau nanti terbukti membingungkan, obatnya sudah diketahui: satu baris penjelasan di
layar daftar blokir, bukan di dialog konfirmasi.

**10.4 Setiap blokir membakar gas relayer.** Recompute menulis `setScore` on-chain untuk tier
yang berubah. Sudah berlaku untuk setiap handshake juga, tapi ia satu lagi hal yang menarik
dari kolam yang sama — dan saldo BSC testnet relayer tercatat **0,00887 tBNB** pada
2026-09-08, cukup untuk beberapa puluh transaksi saja.

**10.5 Blokir massal tidak dibatasi.** Tidak ada kuota harian seperti pada koneksi dan vouch.
Blokir tidak menghantar apa pun ke siapa pun, jadi menyalahgunakannya hanya merugikan diri
sendiri — tapi ini keputusan sadar, bukan kelalaian.

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

**11.5 Batas global diverifikasi**: `git diff --stat <base>..HEAD -- packages/trust` kosong,
dan 21 `encodeType` unik.

**11.6 Uji lapangan** terhadap API dan Supabase sungguhan, seperti Fase 3b dan 3c: blokir
menurunkan angka publik, kecocokan bubar, unggahan hilang dua arah, mencabut mengembalikan
semuanya, dan skor trust berubah setelah recompute.

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
