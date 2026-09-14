# Nearly — Design Spec

**Tanggal:** 2026-09-03
**Status:** Disetujui, siap masuk perencanaan implementasi
**Kategori:** Consumer App di BNB Chain (opBNB)

---

## 1. Konteks & Masalah

Ide berangkat dari Black Mirror *Nosedive* (setiap orang memberi rating 5 bintang ke orang di
sekitarnya), lalu berkembang lewat diskusi menjadi sesuatu yang lebih tajam dan lebih layak
dipakai sehari-hari.

**Masalah nyata di event Web3:**

- Orang pulang membawa 40 username Telegram yang tidak pernah ditindaklanjuti.
- Di ruangan berisi 500 orang, tidak ada cara tahu siapa yang layak ditemui.
- **Tidak bisa membedakan yang beneran dari yang omong kosong.** Ini penyakit endemik Web3.

**Masalah struktural yang lebih dalam:** setiap social graph yang ada (Farcaster, Lens, X)
dibangun dari *remote-follow*. Artinya bisa dipalsukan oleh siapa saja dengan bot, dan
reputasi di dalamnya tidak membuktikan apa pun tentang keberadaan seseorang sebagai manusia.

## 2. Aturan Inti

> **Koneksi tidak bisa dibuat dari jarak jauh. Titik.**
>
> Tidak ada follow. Tidak ada add friend. Satu-satunya cara masuk ke jaringan seseorang
> adalah berdiri di sebelahnya dan sama-sama menekan konfirmasi.

Dua konsekuensi yang menjadi fondasi seluruh sistem:

1. **Anti-sybil menjadi gratis.** Akun palsu tidak bisa membangun jaringan, karena membangun
   jaringan butuh badan manusia di dalam ruangan.
2. **Graf seseorang menjadi bukti kehadiran nyatanya** di ekosistem — bukan bukti bahwa dia
   rajin ngetweet.

## 3. Proposisi Nilai

**Proof of Human tanpa membuka identitas.**

Pengguna Web3 anonim di online tapi tidak anonim di offline — mereka menunjukkan wajahnya di
event. Nearly memanfaatkan celah itu: kamu bisa tetap `0xanon` dengan PFP kartun, tidak ada
yang tahu namamu, tapi **grafmu membuktikan kamu manusia nyata yang benar-benar muncul.**

Semua proof-of-personhood lain memaksa menyerahkan privasi: Worldcoin memindai iris, KYC
meminta dokumen, BABT butuh akun Binance terverifikasi. Nearly membuktikannya lewat
**kesaksian terkumpul dari manusia lain yang secara fisik bertemu kamu** — tanpa pernah tahu
siapa kamu.

**Beachhead:** event & komunitas Web3. Hackathon ini sendiri menjadi event pertama — demo
hidup dengan juri dan peserta di ruangan, dan kepadatan 500 orang dalam radius 50 m menghapus
masalah cold-start yang biasanya membunuh aplikasi berbasis kedekatan.

**Ekspansi:** komunitas kota tahun-berjalan → coworking → keseharian. Arsitekturnya sudah
arsitektur social discovery umum; tidak ada yang dibuang saat meluas.

## 4. Non-Goals

Dinyatakan eksplisit supaya tidak merembes masuk saat implementasi:

- **Bukan aplikasi dating.** Tidak ada swipe, tidak ada pencocokan berbasis ketertarikan
  romantis. Pengungkapan saat saling menandai "ingin bertemu" (§7.6) adalah sinyal niat
  bertemu secara profesional/komunitas, bukan ketertarikan.
- **Bukan messenger untuk orang asing.** Pesan hanya ada di dalam koneksi yang sudah
  diperoleh lewat pertemuan fisik. Tidak ada cara mengirim pesan ke orang yang belum pernah
  bertemu kamu — lihat §7.5.
- **Bukan credit score.** Skor tidak boleh dipakai mengunci akses ke apa pun di dunia nyata.
- **Bukan token launch.** Tidak ada token di MVP. Poin/tier saja.
- **Tidak menilai kualitas manusia.** Tidak ada seseorang menilai seseorang. Lihat §6.
- **Tidak membuktikan seseorang orang baik.** Hanya bahwa dia manusia nyata yang hadir.
- **Bukan platform tiket.** Fitur event sengaja sederhana: buat, RSVP, check-in. **Tanpa**
  pembayaran/tiket berbayar, tanpa waitlist, tanpa alur persetujuan, tanpa event berulang,
  tanpa co-host, tanpa integrasi kalender & email blast. Semua itu pasca-hackathon.

## 5. Glosarium

| Istilah | Arti |
|---|---|
| **Handshake** | Ritual pertemuan fisik: satu pihak menampilkan QR, satu pihak memindai |
| **Connection** | Hasil handshake yang terverifikasi. Permanen, dua arah, on-chain |
| **Trust Score** | Angka yang *dihitung* dari posisi seseorang di graf. Tidak pernah diberi orang |
| **Tier** | Tampilan Trust Score: `Baru` → `Dikenal` → `Terpercaya` → `Inti` |
| **Vouch** | Jaminan langka & positif-saja terhadap seseorang. Bisa di-slash |
| **Seed set (S)** | Himpunan akun tepercaya awal yang menjadi sumber aliran trust |
| **Selective reveal** | Membuka identitas asli ke satu orang tertentu, bukan ke publik |
| **Ko-lokasi** | Dua device berada di sel geohash yang sama dalam jendela waktu yang sama |
| **Event** | Acara yang dibuat seorang host: nama, tempat, geofence, waktu mulai & selesai |
| **RSVP** | Pernyataan niat hadir. Murah, tidak membuktikan apa pun |
| **Check-in** | Konfirmasi kehadiran yang **hanya berhasil di dalam geofence saat acara berlangsung** |
| **Proof of Attendance** | SBT hasil check-in terverifikasi. Berbeda dari POAP: tidak bisa diklaim dari jauh |

## 6. Keputusan Desain yang Terkunci

| Aspek | Keputusan |
|---|---|
| Aturan inti | Koneksi hanya lewat pertemuan fisik |
| Penilaian | **Tidak ada yang menilai siapa pun.** Trust dihitung dari graf + vouch langka |
| Identitas | Anon penuh, wallet saja, **tanpa OTP** |
| Anti-impersonasi | Display name **tidak pernah unik**; alamat/ENS selalu tampil berdampingan |
| Penautan opsional | ENS + riwayat on-chain + X/Farcaster + POAP |
| Handshake | QR bertanda tangan (rotasi 30 detik) + verifikasi ko-lokasi di server |
| FYP | View-only. **Tidak bisa konek dari sana.** Ada tombol "Ingin bertemu" |
| Pesan | Relay Nearly + E2E (`@noble/*`), **hanya dengan alamat yang ada di graf koneksi** |
| Angka ingin bertemu | Persis & publik; tap dari akun ber-trust nol tidak dihitung |
| Event | Siapa pun boleh mengadakan. **Discovery yang diperoleh, bukan izin membuat** |
| Kehadiran | RSVP + check-in terverifikasi geofence + Proof of Attendance on-chain |
| Platform | React Native / Expo |
| Chain | opBNB |

### Yang sengaja dihapus dari rancangan awal

Verifikasi OTP, integrasi BABT wajib, agregasi rating berbobot, trimmed mean, Nosedive
Protection, anonimitas bintang rendah, kuota & jendela rating, alur sanggah.

**Kalau tidak ada tombol untuk menyerang orang, tidak perlu ada perisai.** Revisi ini
memangkas pekerjaan, bukan menambahnya.

### Prinsip yang tidak boleh dilanggar

1. **Trust tidak pernah turun karena seseorang tidak menyukaimu.** Hanya dua hal yang
   menurunkannya: peluruhan waktu, dan laporan penipuan yang terkonfirmasi.
2. **Tidak ada peta dengan pin orang.** Radar = daftar kartu. Peta pin adalah vektor stalking.
3. **Identitas asli tidak pernah publik.** Dibuka per-orang, atas pilihan pemiliknya.
4. **Lokasi mentah dihapus dalam 24 jam.** Yang bertahan hanya koneksi dan check-in — selnya masih dipakai trust dan menjadi pengecualian yang diakui (§10.2).

## 7. Tujuh Mekanik

### 7.1 Handshake — satu-satunya pintu masuk

1. A menampilkan QR. Payload ditandatangani wallet A, berumur 30 detik, berisi
   `{address, nonce, expiresAt}`.
2. B memindainya.
3. Kedua device mengirim `{geohash7, timestamp}` ke server.
4. Server memverifikasi keduanya di sel geohash yang sama dalam ±2 menit, tanda tangan valid,
   nonce belum dipakai, dan kuota per-event belum habis.
5. `Connection` dicetak — permanen, dua arah, ditulis on-chain lewat relayer.

### 7.2 Trust Score — dihitung, bukan diberi

Tidak ada yang menilai siapa pun. Kepercayaan tumbuh dari posisi seseorang di dalam graf.
Rincian algoritma di §8.

### 7.3 Vouch + Tag — sisi manusiawinya

Setelah terkoneksi, kamu boleh menjamin seseorang (jatah terbatas, mis. 3 per event, supaya
berharga) dan memberi tag: *real builder*, *solid dev*, *paham ZK*. Kalau orang yang kamu
vouch belakangan terbukti scammer, **kredibilitasmu ikut turun.** Skin in the game.

### 7.4 FYP + "Ingin bertemu" — yang menutup lingkaran

Feed berisi unggahan orang Web3. Bisa dilihat, tapi **dari FYP tidak ada jalur untuk
terkoneksi maupun mengirim pesan.** Pesan baru terbuka setelah bertemu fisik (§7.5).
Yang bisa dilakukan: menandai **"ingin bertemu"**. Lalu suatu hari:

> *"Budi, yang saling ingin bertemu denganmu, ada di acara ini."*

Notifikasi kedekatan hanya dikirim kepada **koneksi** (pernah bertemu) dan orang yang **saling**
ingin bertemu — tidak pernah untuk tanda sepihak. Tanda sepihak yang memberi tahu kapan targetnya
hadir adalah vektor penguntitan: siapa pun bisa menandai seseorang lalu menunggu pemberitahuan
lokasinya. Rincian, batas 5 per orang per acara, dan isinya di spec Fase 4b + 5 §6.

Online menciptakan keinginan, offline menyelesaikannya. Ini bukan keterbatasan — ini mesinnya.

### 7.5 Pesan — hadiah dari sudah bertemu

Setelah `Connection` tercetak, kalian bisa saling berkirim pesan. Ini yang langsung
menyelesaikan masalah di §1: kamu tidak perlu menyerahkan Telegram sama sekali —
**kamu bisa tetap anon dan tetap terhubung.**

Konsekuensinya menjadi fitur tersendiri:

> **Inbox tanpa spam, secara struktural.** Di dalam Nearly kamu tidak bisa dikirimi pesan
> oleh orang yang belum pernah bertemu kamu. Bukan karena ada filter spam — karena tidak
> ada jalurnya.

**Teknologi: Relay Nearly + E2E** (`@noble/*`). Rancangan awal memilih XMTP, tetapi diganti di
Fase 4c dengan relay sendiri dan enkripsi E2E — lihat alasan dan arsitektur lengkapnya di
`docs/superpowers/specs/2026-09-13-nearly-fase-4c-pesan-design.md` §2.1. Pesan wallet-ke-wallet,
E2E terenkripsi, identitasnya wallet — cocok betul dengan desain wallet-only kita.

**Batas yang harus dinyatakan jujur, jangan diklaim lebih:**

1. **Jaminan "tanpa spam" ditegakkan di server.** Server relay menolak setiap pesan yang bukan
   berasal dari pasangan di graf koneksi atau yang terblokir ke arah mana pun.
2. **Batas sistem** — server melihat metadata (siapa berkirim ke siapa, kapan), tanpa forward secrecy,
   dan nama pengirim terlihat pihak ketiga push — dirinci di spec 4c §11.

**Celah baru yang dibuka fitur ini, dan harus ditutup di fase yang sama:** sebelum ada
pesan, orang yang pernah bertemu kamu tidak punya cara mengganggumu. Sekarang ada. Karena itu
pesan **tidak boleh dikirim ke produksi tanpa** tiga hal ini:

1. **Blokir dari dalam percakapan** — satu tap. Memblokir langsung menyembunyikan percakapan,
   menghentikan pesan masuk, dan menghentikan pengaruh vouch dan kontribusi trust pada skor (vouch on-chain tidak dicabut otomatis — lihat spec 4c §8.1).
2. **Lapor dari dalam percakapan**, tersambung ke gerbang laporan di §9.3.
3. **Koneksi tetap ada di graf setelah blokir** (pertemuannya memang terjadi, itu fakta), tapi
   ditandai diblokir sehingga tidak lagi menghantar trust ke arah mana pun.

**Efek pada desain lain:** selective reveal (§11 Fase 3) turun prioritas. Kalau kamu sudah
bisa ngobrol tanpa membuka apa pun, membuka identitas asli jadi benar-benar opsional —
bukan jalur utama tindak lanjut.

### 7.6 Penanda "Ingin bertemu" dan angkanya

Setiap profil menampilkan **angka persis berapa orang yang ingin bertemu dia**, terlihat oleh
semua orang. Ini social proof yang mudah dibaca dan mendorong orang datang ke event.

- **Tidak ada yang bisa menurunkan angka orang lain** — konsisten dengan prinsip di §6.
  Mencabut tandamu SENDIRI menurunkan angka, dan itu disengaja: kalau tanda permanen,
  menandai berarti menyerahkan keputusan pengungkapan identitasmu kepada orang lain tanpa
  batas waktu (Fase 3c §2.1).
- **Semua tap dihitung; penyaring trust-nol TIDAK dipasang.** Keputusan pemilik project di
  Fase 3c, menimpa rancangan awal di sini. Akibatnya angka ini bisa digelembungkan bot —
  bot tidak bisa membangun graf, tapi bot bisa menekan tombol. Konsekuensi dan penawarnya
  dicatat di `2026-09-07-nearly-fase-3c-ingin-bertemu-design.md` §11.1.
- **Default anonim.** Yang ditandai tidak tahu siapa yang menandainya.
- **Kalau saling menandai → keduanya terungkap dan diberi tahu.** Tidak creepy karena
  timbal-balik, dan ini dorongan paling kuat untuk benar-benar bertemu.
- **Pemilik profil melihat daftarnya secara privat** — berguna untuk memutuskan datang ke
  event mana: *"12 orang ingin bertemu aku, 4 di antaranya hadir Jumat."*

**Risiko yang disadari dan diterima:** angka publik menciptakan dinamika papan peringkat
popularitas, dan angka kecil pada pengguna baru bisa terasa memalukan. Ini keputusan produk
yang diambil sadar. Kalau nanti terbukti merusak, obatnya sudah diketahui: sembunyikan angka
di bawah ambang tertentu, seperti yang dilakukan sistem tier di §8.

### 7.7 Event & kehadiran terverifikasi

Siapa pun bisa mengadakan event: nama, tempat, geofence, waktu mulai & selesai. Orang lain
RSVP. Sengaja sederhana — batasannya ada di §4.

**Kenapa ini strategis, bukan sekadar fitur tambahan:**

1. **Event adalah sisi pasokan seluruh produk ini.** Nearly butuh orang berada di ruangan yang
   sama. Tanpa fitur ini kita bergantung pada event yang diadakan orang lain di platform lain
   — padahal kedekatan fisik adalah bahan bakar utama kita.
2. **Ini menyambungkan loop "ingin bertemu" menjadi lengkap:**
   > *"12 orang yang ingin bertemu kamu sudah RSVP."*
   > *"4 orang yang saling ingin bertemu denganmu sudah RSVP."*

   Baris kedua dulu berbunyi *"4 orang yang kamu tandai sudah RSVP."* Fase 3c
   mengubahnya: angka itu kini memotong **kecocokan**, bukan tanda sepihak,
   karena versi sepihaknya adalah oracle keanggotaan RSVP — tandai siapa pun,
   baca selisihnya, dan kamu tahu dia akan hadir di mana. Kedua angka juga
   bisa **hilang sama sekali** di acara kecil; itu penyembunyian yang
   disengaja, bukan nol. Perilaku yang mengikat ada di spec Fase 3c §4.3,
   §11.7, dan §11.8.

   Luma memberi tahu kamu *apa* acaranya. Nearly memberi tahu **siapa yang akan ada di sana
   dan kenapa kamu harus datang.**
3. **Kehadiran yang benar-benar terverifikasi.** RSVP di Luma tidak membuktikan apa pun —
   orang RSVP lalu tidak datang. POAP sering cuma link klaim yang bisa disebar ke siapa saja.
   Check-in Nearly **hanya berhasil kalau kamu berada di dalam geofence saat acara
   berlangsung**, lalu dicetak sebagai Proof of Attendance SBT.

**Dan ini memperbaiki algoritma trust, bukan cuma menambah fitur.** Faktor diversitas di §8
sudah membutuhkan informasi "koneksi ini terjadi di event mana". Sebelumnya harus ditebak dari
geohash; sekarang datanya terverifikasi.

**Anti-event-palsu — discovery yang diperoleh, bukan izin membuat.**
Event palsu untuk phishing adalah masalah nyata di Web3. Tapi membatasi *siapa yang boleh
membuat* event akan melanggar prinsip kita sendiri di §6 ("skor tidak boleh dipakai mengunci
akses"). Jadi:

- **Siapa pun boleh mengadakan event.** Tidak ada gerbang.
- Event dari host ber-trust rendah **tetap ada dan tetap bisa dibagikan lewat link** — hanya
  tidak muncul di halaman discovery.
- **Tidak ada yang dilarang; yang harus diperoleh adalah perhatian.** Ini konsisten dengan
  cara kita memperlakukan trust di seluruh produk: sebagai informasi, bukan gerbang.

**Reputasi host** muncul sendiri dari graf: host yang acaranya benar-benar dihadiri orang-orang
tepercaya akan terlihat berbeda dari host yang tidak. Tidak perlu metrik baru.

## 8. Algoritma Trust

Hidup di `packages/trust` sebagai fungsi murni. Bagian yang paling wajib diuji di seluruh
proyek.

Personalized PageRank di atas graf koneksi, disemai dari himpunan tepercaya `S`.

```
Graf G: node = user, edge = koneksi (berbobot vouch)
Seed S: akun tepercaya awal (penyelenggara event, tokoh komunitas)

1. Propagasi   — personalized PageRank dari S dengan damping
2. Diversitas  — H(event) x H(rentang waktu) x (1 - clustering coefficient)
                 event diambil dari check-in TERVERIFIKASI (§7.7), bukan tebakan geohash
                 50 orang di 1 event dalam 1 jam  <<  50 orang di 10 event, 5 kota
3. Bobot vouch — edge ber-vouch menghantar trust lebih besar dari koneksi biasa
4. Peluruhan   — koneksi 2 tahun lalu menghantar lebih lemah dari bulan lalu
5. Slashing    — penipuan terkonfirmasi mengalir balik ke para penjaminnya
```

**Kenapa kebal sybil secara matematis:** 100 akun palsu yang saling terhubung membentuk
gumpalan terisolasi tanpa jalur dari `S` → trust mendekati 0. Bukan tebakan, bukan heuristik.

**Tampilan: tier + bukti, bukan angka telanjang.**

`Baru` → `Dikenal` → `Terpercaya` → `Inti`, selalu disertai fakta konkretnya:

> *"47 koneksi · 6 event · 3 kota · 12 vouch"*

Angka peringkat telanjang akan menghidupkan lagi kecemasan ala Nosedive. Bukti konkret lebih
jujur dan lebih berguna bagi orang yang sedang memutuskan apakah akan bicara dengan seseorang.

## 9. Model Ancaman "Orang Palsu"

Bagian yang paling menentukan produk ini dipercaya atau tidak. "Orang palsu" sebenarnya enam
ancaman berbeda; menyamakannya adalah kesalahan.

### 9.1 Satu manusia, banyak akun (sybil multi-device)

Satu hal yang menguntungkan kita secara matematis dan sering luput: **akun ganda tidak
melipatgandakan trust — mereka mengencerkannya.** Di PageRank, kepercayaan yang mengalir dari
seseorang **dibagi** ke semua koneksinya. Kalau satu orang asli salaman dengan 5 akun milik
operator yang sama, tiap akun cuma menerima 1/5 porsi. Farming multi-device punya hasil yang
makin kecil secara bawaan.

Pertahanan MVP:

- **Sidik jari ko-lokasi** — kemiripan Jaccard antar set koneksi + korelasi temporal. Kelima
  akun muncul di tempat & waktu identik dengan lawan identik → digabung sebagai satu operator.
- **Faktor diversitas** — 150 koneksi dari satu ruangan bernilai jauh di bawah 30 koneksi dari
  6 kota.
- **Kuota connect per event.**
- **Lawan bicara adalah sensornya** — orang yang menyodorkan QR tiga kali dengan tiga akun
  berbeda langsung terlihat dan bisa dilaporkan.

Pasca-hackathon: **device attestation** (App Attest / Play Integrity) — satu akun utama per
perangkat fisik. Tidak menghentikan pemilik 5 HP asli, tapi mematikan emulator dan farm murah.

### 9.2 Impersonasi

Di Twitter nama adalah identitas, jadi impersonasi berhasil. Di sini **nama bukan identitas —
alamat wallet-lah identitasnya**, dan itu tidak bisa dipalsukan.

- **Display name bebas dan tidak pernah unik.** Tidak ada yang bisa "mengklaim" sebuah nama →
  handle-squatting mati sepenuhnya. Alamat/ENS selalu tampil berdampingan.
- **Grafmu tidak bisa disalin.** `0xVitalik` palsu berdiri dengan tier `Baru` dan 0 koneksi;
  yang asli punya 200 koneksi di 15 event. **Reputasimu bukan namamu — reputasimu adalah
  grafmu.**
- **Penautan opsional tanpa mengorbankan anonimitas:** ENS, riwayat on-chain (umur &
  aktivitas wallet), X/Farcaster, POAP event lampau. Semuanya membuktikan *penguasaan*
  identitas, bukan membuka nama asli.

### 9.3 Manusia asli, tapi penipu

Harus dinyatakan jujur — di dokumen ini dan di depan juri:

> **Nearly membuktikan seseorang manusia nyata yang benar-benar hadir. Nearly TIDAK
> membuktikan dia orang baik.** Mengklaim lebih dari itu berbahaya.

Yang bisa dilakukan: **slashing** — penipuan terkonfirmasi menurunkan trust pelaku *dan
mengalir balik ke para penjaminnya*. Itu yang memberi vouch harga.

**Di sinilah brigading bisa menyelinap masuk lagi**, jadi gerbangnya harus ketat:

- Laporan **tidak pernah** langsung menurunkan trust.
- Laporan hanya memicu peninjauan.
- Ambang: beberapa pelapor ber-trust tinggi yang **tidak saling terhubung satu sama lain** —
  sulit dipalsukan karena butuh beberapa orang tepercaya yang independen.
- Isi laporan disimpan **off-chain** (berisi tuduhan terhadap orang); hanya hasil slash yang
  terkonfirmasi yang naik on-chain.

### 9.4 Kongkalikong koneksi

**Satu koneksi per pasangan orang, selamanya** — dua orang tidak bisa saling farming.
Lingkaran 20 orang yang saling connect = gumpalan padat, kena penalti clustering, trust
dibatasi jalur terlemahnya ke `S`.

Tapi jujur: 20 manusia nyata yang benar-benar datang ke event **itu memang komunitas asli** —
bukan serangan, justru itu yang kita ukur.

### 9.5 Wallet ber-reputasi dijual

Reputasi soulbound ke wallet, tapi private key bisa dijual. **Tidak bisa diselesaikan
sepenuhnya** — masalah bawaan semua sistem soulbound. Peredamnya: trust meluruh tanpa
aktivitas dunia nyata baru, jadi akun beli-an berhenti tumbuh lalu layu. Deteksi
diskontinuitas perilaku (perangkat & geografi berubah mendadak) menyusul pasca-hackathon.

### 9.6 GPS spoofing untuk handshake jarak jauh

QR berumur 30 detik + verifikasi ko-lokasi ±2 menit + rate limit. **Tidak sempurna** — BLE
pasca-hackathon yang benar-benar menutup celah ini.

## 10. Arsitektur

```
nearly/
├── apps/
│   ├── mobile/          # Expo (React Native) — aplikasi utama
│   ├── api/             # Hono di Node — backend off-chain
│   └── web/             # Next.js — landing + halaman demo juri (visualisasi graf live)
└── packages/
    ├── contracts/       # Foundry — Solidity di opBNB
    ├── trust/           # Perhitungan Trust (murni, teruji)
    └── shared/          # Tipe + skema Zod bersama
```

### 10.1 Mobile

Expo SDK 52+, Expo Router, TypeScript, TanStack Query + Zustand, relay Nearly + E2E (`@noble/*`)
untuk pesan.

**Penting bagi yang baru di mobile:** Rencana awal memakai XMTP yang membutuhkan native module
(sehingga Expo Go tidak bisa dipakai). Namun, XMTP diganti di Fase 4c dengan relay sendiri + E2E
JS murni (`@noble/*`), sehingga alasan gugurnya Expo Go tersebut tidak lagi berlaku; development
build tetap diperlukan kelak untuk Notification Service Extension (spec 4c §11.5).

Wallet: **connect wallet yang sudah ada** sebagai jalur utama — persona anon seseorang *adalah*
wallet-nya, jadi reputasi harus menempel di sana. Embedded wallet lewat Privy sebagai cadangan
untuk pendatang baru. Tanpa OTP, tanpa email wajib.

### 10.2 Backend off-chain

Hono di Node. **Supabase**: Postgres + PostGIS (verifikasi ko-lokasi) + Realtime (radar event
live). Menyimpan kehadiran sementara, metadata profil, FYP, laporan, dan selective reveal
terenkripsi.

Data lokasi yang tidak dipakai trust — baris `kehadiran`, `notif_kedekatan`, dan sel di QR salaman
serta QR check-in yang kedaluwarsa — dihapus atau dikosongkan **paling lambat 24 jam + interval
sapuan** oleh API sendiri (saat mulai, dan dari rute detak paling sering sekali per 10 menit) serta
alat CLI `apps/api/tools/sapu-lokasi.ts` untuk cron VPS — bukan `pg_cron`, yang belum tentu aktif
di project Supabase. **Pengecualian yang diakui:** `connections.cell` dan `checkins.cell` belum
dihapus karena dipakai sidik jari ko-lokasi trust (`load-graph.ts`); menepatinya butuh perubahan
`packages/trust` dan menjadi pekerjaan terpisah (spec Fase 4b + 5 §4.5, §10.7–8).

### 10.3 On-chain (opBNB, Foundry, viem)

| Kontrak | Isi |
|---|---|
| `NearlyIdentity` | SBT: wallet → handle anon + hash PFP. Tidak bisa dipindah |
| `ConnectionRegistry` | Setiap koneksi ditulis langsung on-chain (opBNB cukup murah) |
| `VouchRegistry` | Vouch + tag; bisa dicabut, bisa di-slash |
| `AttendanceRegistry` | Proof of Attendance SBT hasil check-in terverifikasi geofence |
| `TrustAttestor` | Publikasi skor trust berkala |
| `NearlyResolver` | Antarmuka baca untuk dApp lain: `getTrust(address)`, `getTier(address)` |

**Kenapa blockchain — jawaban yang kokoh:** karena grafnya publik dan setiap koneksi bisa
diverifikasi, **siapa pun bisa menghitung ulang Trust Score sendiri dan membuktikan kami tidak
curang.** Graf sosialnya adalah infrastruktur publik, bukan database kami. Ini yang tidak bisa
dilakukan Postgres.

**Konsekuensi yang disadari:** graf koneksi jadi publik — terlihat bahwa `0xanon` bertemu
`0xfoo` di suatu event. Untuk pengguna anon ini trade-off yang wajar, dan memang diperlukan
agar bisa diverifikasi. Yang **tidak pernah** publik: lokasi presisi, identitas asli, isi
laporan, dan selective reveal.

**Gas:** relayer + EIP-712 — user menandatangani, backend mengirim & membayar. User tidak
pernah melihat kata "gas". ERC-4337 + paymaster menyusul pasca-hackathon.

**Media FYP:** BNB Greenfield (konten dimiliki user).

### 10.4 Sketsa model data (off-chain)

```
profiles(address PK, display_name, pfp_url, ens, created_at, visibilitas)
kehadiran(event_id, address, cell, seen_at)            -- satu baris per orang per acara; dihapus ≤ 24 jam
notif_kedekatan(event_id, penerima, subjek, sent_at)   -- sekali per pasangan per acara; dihapus ≤ 24 jam
connections(a, b, event_id, created_at, tx_hash)        -- UNIQUE(least(a,b), greatest(a,b))
vouches(from_addr, to_addr, tags[], created_at, revoked_at, tx_hash)
reveals(from_addr, to_addr, payload_encrypted, created_at)
reports(reporter, subject, reason, evidence, status, created_at)   -- off-chain
posts(id, author, media_url, text, geohash7, event_id, expires_at)
want_to_meet(from_addr, target_addr, created_at, revealed_at)  -- anonim; terungkap kalau saling
want_to_meet_counts(address, count, updated_at)          -- publik; hanya tap ber-trust > 0
events(id, host_addr, name, venue, geofence, starts_at, ends_at, created_at)
rsvps(event_id, address, created_at)                     -- niat hadir; murah
checkins(event_id, address, geohash7, checked_in_at, tx_hash)  -- hanya di dalam geofence
trust_snapshots(address, score, tier, connections, events, cities, computed_at)
```

## 11. Fase Pembangunan

Tujuh fase. Ruang lingkup bertambah setelah fitur Event masuk, dan keputusannya adalah
**mempertahankan Event dan FYP sekaligus dengan mengurangi kedalaman di tempat lain.** Daftar
pengurangan itu ada di §11.1 — tanpa daftar konkret, keputusan itu kosong dan yang terjadi
justru semua fitur setengah matang.

**Fase 0 — Fondasi.** Monorepo pnpm, Supabase (skema + PostGIS + RLS), skeleton Expo + Expo
Router, connect wallet, scaffolding Foundry. (Catatan awal mewajibkan dev build karena XMTP,
tetapi XMTP diganti di Fase 4c sehingga alasan tersebut gugur; development build tetap
diperlukan kelak untuk Notification Service Extension — spec 4c §11.5).

*Selesai = bisa masuk app dengan wallet, di atas dev build.*

**Fase 1 — Jantung: pertemuan.** QR bertanda tangan + rotasi 30 detik, pemindai, verifikasi
ko-lokasi di server, `ConnectionRegistry` di opBNB testnet, relayer EIP-712, layar Koneksi &
Profil anon. Sekalian: display name tidak unik + alamat/ENS selalu tampil, dan baca ENS &
riwayat on-chain (keduanya cuma pembacaan chain, murah).

*Selesai = dua HP hanya bisa terhubung kalau benar-benar berdekatan.*

**Fase 2 — Trust & pertahanan.** `packages/trust` (PageRank + diversitas + sidik jari
ko-lokasi), `VouchRegistry`, vouch + tag, tampilan tier & bukti, gerbang laporan +
propagasi slash ke penjamin, `TrustAttestor` + `NearlyResolver`.

*Selesai = serangan sybil bisa didemokan dan gagal secara matematis.*

**Fase 3 — Event & "ingin bertemu".** Buat event (nama, venue, geofence, waktu), RSVP,
**check-in terverifikasi geofence** + `AttendanceRegistry` (Proof of Attendance SBT),
discovery yang menyaring host ber-trust rendah, penanda + angka "ingin bertemu" (§7.6),
pengungkapan saat saling menandai, dan loop *"N orang yang ingin bertemu kamu akan hadir."*

*Ditaruh sebelum Radar karena Radar ("siapa di event ini sekarang") mensyaratkan event sudah
menjadi entitas kelas satu. Penanda "ingin bertemu" ditaruh di sini, bukan di FYP, karena di
sinilah nilainya benar-benar terwujud.*

*Selesai = seseorang bisa membuat event, orang lain RSVP, dan check-in hanya berhasil kalau
benar-benar berada di venue saat acara berlangsung.*

**Fase 4 — Radar & pesan.** Siapa di event ini sekarang (daftar kartu), mode visibilitas,
blokir, dan **pesan (relay + E2E, spec 4c) — hanya dengan alamat yang ada di graf koneksi** (§7.5),
lengkap dengan blokir & lapor dari dalam percakapan.

*Selesai = dua orang yang pernah bertemu bisa saling berkirim pesan, dan orang yang belum
pernah bertemu tidak punya jalur apa pun untuk mengirim pesan di dalam Nearly.*

**Fase 5 — FYP.** Feed unggahan (view-only, tanpa jalur koneksi maupun pesan), upload gambar
ke Greenfield, tombol "Ingin bertemu" di kartu feed (mekaniknya menyusul di Fase 3c — feed
dikerjakan lebih dulu justru karena penanda itu butuh permukaan berisi orang yang belum kamu temui),
notifikasi kedekatan (spec Fase 4b + 5 §6), lapor.

*Selesai = feed berjalan dan "ingin bertemu" bisa ditandai langsung dari feed.*

**Fase 6 — Demo.** Event mode untuk venue hackathon, **visualisasi graf live di web** (graf
tumbuh saat orang bersalaman di ruangan — ini money shot-nya), seed trusted core, landing
page, video pitch.

*Selesai = graf tumbuh hidup di layar saat orang-orang bersalaman di ruangan.*

**Catatan urutan (2026-09-07).** Fase 3 dipecah menjadi 3a (event & kehadiran, tuntas),
3b (feed, dokumen `2026-09-07-nearly-fase-3b-feed-design.md`), dan 3c ("ingin bertemu",
menyusul). Feed didahulukan dari "ingin bertemu" karena penanda itu tidak punya permukaan
untuk hidup sampai feed ada.

**Catatan urutan (2026-09-14).** Fase 4 tuntas: 4a (blokir), 4c (pesan relay + E2E), dan 4b
(radar, visibilitas Terlihat/Tersembunyi, nama tampilan — spec `2026-09-14-nearly-fase-4b5-radar-design.md`).
Fase 5 tuntas: feed di 3b, "ingin bertemu" di 3c, notifikasi kedekatan di spec yang sama dengan 4b.

### 11.1 Pengurangan kedalaman yang disepakati

Konsekuensi dari keputusan mempertahankan Event dan FYP sekaligus. Delapan pengurangan ini
dipilih karena tidak ada satu pun yang menyentuh premis produk:

1. **Selective reveal dibuang total.** Sudah redundan sejak pesan masuk — kalau bisa ngobrol
   tanpa membuka apa pun, membuka identitas asli tidak lagi jadi jalur tindak lanjut.
2. **Penautan X/Farcaster + POAP ditunda.** MVP cukup ENS + riwayat on-chain, yang keduanya
   hanya pembacaan RPC. ⚠️ **Ini membalik keputusan sebelumnya** yang memilih ketiganya —
   tiga integrasi OAuth/API di tengah hackathon adalah tempat paling masuk akal untuk memotong,
   karena argumen anti-impersonasi kita bertumpu pada "graf tidak bisa disalin" (§9.2), bukan
   pada tautan-tautan itu.
3. **Tanpa UI antrean moderasi & sanggah.** Gerbang laporan algoritmik (§9.3) tetap dibangun
   penuh; konfirmasinya manual oleh admin. Yang dipotong adalah UI-nya, bukan logikanya.
4. **FYP diringankan** — teks + satu gambar, peringkat sederhana (event yang dihadiri +
   kebaruan), tanpa auto-hide otomatis dan tanpa peringkat berbasis riwayat geohash.
5. **Radar pakai polling ~10 detik**, bukan Supabase Realtime. Cukup untuk satu ruangan.
6. **Mode visibilitas 3 → 2**: **Terlihat** dan **Tersembunyi**, satu saklar per akun. Tersembunyi bersifat timbal balik — tidak muncul di radar, tidak bisa membuka radar, tidak memicu dan tidak menerima notifikasi kedekatan. Mode event digabung ke Terlihat (spec Fase 4b + 5 §2).
7. **Peluruhan waktu trust: skema siap, tidak diaktifkan.** Dalam rentang waktu demo tidak ada
   yang cukup tua untuk meluruh, jadi mengaktifkannya tidak terlihat sama sekali.
8. **Kuota vouch per-event → kuota harian global.** Menghapus satu ketergantungan ke entitas
   event di jalur vouch.

### 11.2 Yang TIDAK boleh dikurangi

Kalau salah satu dari ini dipotong, produknya kehilangan premisnya dan lebih baik tidak
didemokan sama sekali:

- QR handshake + verifikasi ko-lokasi, **termasuk uji negatifnya** (§13)
- `ConnectionRegistry` on-chain
- PageRank + faktor diversitas + sidik jari ko-lokasi
- Event: buat, RSVP, **check-in terverifikasi**, Proof of Attendance
- Pesan yang digerbangi graf koneksi, **plus blokir & lapor dari dalam percakapan** — ini
  keselamatan pengguna, tidak bisa ditawar (§7.5)
- Angka "ingin bertemu" + pengungkapan saat saling menandai

## 12. File & Modul Kunci

- `packages/trust/src/pagerank.ts` — propagasi trust. Inti produk, paling banyak testnya.
- `packages/trust/src/diversity.ts` — entropi event/waktu + sidik jari ko-lokasi (kemiripan
  Jaccard set koneksi + korelasi temporal) untuk mendeteksi akun multi-device.
- `packages/trust/src/slashing.ts` — gerbang laporan (pelapor ber-trust tinggi & tidak saling
  terhubung) + propagasi slash ke penjamin. **Titik paling rawan di seluruh sistem** — di
  sinilah brigading bisa masuk lagi kalau gerbangnya longgar.
- `apps/mobile/src/handshake/` — QR bertanda tangan, rotasi, pemindai. Alur paling penting.
- `apps/api/src/routes/handshake.ts` — verifikasi ko-lokasi (query PostGIS) sebelum mencetak
  koneksi.
- `apps/api/src/routes/checkin.ts` — verifikasi geofence sebelum mencetak Proof of Attendance.
- `packages/contracts/src/ConnectionRegistry.sol` — graf on-chain.
- `packages/contracts/src/AttendanceRegistry.sol` — Proof of Attendance SBT.
- `packages/shared/src/schema.ts` — skema Zod dipakai mobile + api, satu sumber kebenaran.
- `apps/web/src/app/live/page.tsx` — visualisasi graf untuk juri (react-force-graph).

## 13. Verifikasi

**Unit (Vitest) di `packages/trust`** — kasus wajib:

- gumpalan 100 akun sybil terisolasi → trust < 0.01
- 50 koneksi di satu event jauh lebih kecil dari 50 koneksi tersebar di 10 event
- 5 akun dengan pola ko-lokasi identik → terdeteksi sebagai satu operator
- peluruhan waktu; slashing mengalir balik ke penjamin
- **brigading laporan harus gagal**: 20 pelapor yang saling terhubung tidak boleh memicu slash
  apa pun, sementara 3 pelapor ber-trust tinggi yang independen harus memicunya

**Foundry test** semua kontrak — termasuk memastikan transfer SBT selalu gagal, dan koneksi
tidak bisa dicetak tanpa dua tanda tangan.

**Uji handshake negatif** — dua device di geohash berbeda **harus gagal** terkoneksi. Ini test
terpenting di seluruh proyek: kalau ini lolos, seluruh premis produk runtuh.

**Uji check-in negatif** — check-in dari **luar** geofence, atau di dalam geofence tapi
**di luar rentang waktu acara**, harus **gagal** dan tidak boleh mencetak Proof of Attendance.
Ini kembarannya uji handshake negatif: kalau ini lolos, klaim "kehadiran terverifikasi" jadi
bohong dan lebih buruk daripada tidak punya fiturnya.

**Uji RSVP ≠ kehadiran** — akun yang RSVP tapi tidak pernah check-in tidak boleh punya Proof
of Attendance, dan tidak boleh menyumbang apa pun ke faktor diversitas di §8.

**Uji discovery event** — event dari host ber-trust rendah tidak muncul di discovery, tapi
**tetap bisa dibuka lewat link langsung**. Bukan diblokir, hanya tidak dipromosikan.

**Uji gerbang pesan** — akun yang belum pernah handshake dengan kamu **tidak boleh** muncul
di daftar percakapan dan tidak boleh bisa dikirimi pesan dari dalam Nearly. Ini penegakan
server, jadi harus diuji di server (API gerbang pesan) dan client.

**Uji blokir** — setelah memblokir, pesan dari orang itu tidak boleh masuk (penegakan server),
percakapan hilang dari daftar, dan kontribusi trust serta vouch-nya harus hilang dari perhitungan.

**Uji "ingin bertemu"** — tap dari akun ber-trust nol tidak menaikkan angka; saat A dan B
saling menandai, keduanya harus terungkap dan menerima notifikasi; sebelum saling, identitas
penanda tidak boleh terekspos lewat API mana pun.

**Uji privasi** — `sapuLokasi` dengan jam palsu menghapus kehadiran dan notifikasi kedekatan yang
lebih tua dari 24 jam, mengosongkan sel QR yang kedaluwarsa lebih dari 24 jam tanpa menghapus
barisnya, dan tidak menyentuh `connections` maupun `checkins` (`apps/api/test/sapu-lokasi-privasi.test.ts`).

**E2E manual** — dua wallet nyata: scan → koneksi tercetak → cek di opBNB explorer → trust
bergerak.

**Uji lapangan** — pakai di satu meetup nyata sebelum hari demo. Ini yang akan membongkar
masalah akurasi lokasi indoor dan baterai; tidak ada test yang bisa menggantikannya.

## 14. Risiko

1. **Akurasi GPS di dalam ruangan.** Di ballroom hotel GPS bisa meleset 50–100 m — bisa
   membuat verifikasi ko-lokasi terlalu longgar. Mitigasi MVP: geofence event + toleransi
   ketat pada waktu (±2 menit) + QR berumur pendek. **BLE pasca-hackathon** yang jadi solusi
   sebenarnya.
2. **Cold start Trust butuh seed.** Trust dihitung dari jalur ke akun tepercaya, jadi harus ada
   himpunan awal. Di hackathon: penyelenggara & juri. Harus disiapkan sebelum demo.
3. **Graf publik = trade-off privasi** yang disadari (§10.3).
4. **Batas yang diakui terbuka — sampaikan jujur ke juri, ini justru menunjukkan kedalaman:**
   - Sybil multi-device hanya *dideteksi*, belum *dicegah*. Pencegahnya device attestation,
     sengaja ditunda pasca-hackathon karena fiddly di Expo.
   - Wallet ber-reputasi yang dijual tidak bisa dicegah — hanya diredam peluruhan waktu.
   - **Nearly membuktikan seseorang manusia nyata yang hadir, bukan bahwa dia orang baik.**
     Jangan pernah mengklaim lebih dari ini.
5. **Batas pesan relay Nearly + E2E (menggantikan batas praktis XMTP rancangan awal):**
   - XMTP diganti di Fase 4c dengan relay sendiri + E2E (`@noble/*`). Batas-batas arsitektur baru
     ini (metadata server, tanpa forward secrecy, phishing tanda tangan, batas Expo Go vs Notification
     Service Extension, dsb.) diakui terbuka dan dirinci dalam spec Fase 4c §11.
6. **Ruang lingkup adalah risiko terbesar sekarang.** Tujuh fase untuk satu hackathon itu
   berat, dan keputusannya adalah mempertahankan Event + FYP sekaligus dengan mengurangi
   kedalaman (§11.1). **Catatan (2026-09-08):** Fase 4 dipecah tiga — 4a (blokir), 4c (pesan
   relay + E2E), 4b (radar & visibilitas, tuntas bersama notifikasi kedekatan — spec Fase 4b + 5) — lihat spec Fase 4a §1 dan spec Fase 4c. Kalau di tengah jalan ternyata
   tetap tidak cukup waktu, urutan pengorbanan berikutnya: **4b (radar & visibilitas) dulu,
   lalu vouch/tag** — jangan pernah memotong apa pun di §11.2.
7. **Angka "ingin bertemu" yang publik** menciptakan dinamika papan peringkat popularitas —
   keputusan produk yang diambil sadar (§7.6). Obatnya sudah diketahui kalau terbukti merusak.
8. **Hukum privasi (UU PDP Indonesia / GDPR)** — aplikasi mengumpulkan lokasi kasar dan graf
   sosial. Wajib ada ekspor & hapus data satu tap sebelum ada pengguna publik.

## 15. Langkah Berikutnya

Susun rencana implementasi rinci per fase (skill `superpowers:writing-plans`) sebelum
menyentuh kode.
