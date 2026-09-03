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
event. Nearly memanfaatkan celah itu: kamu bisa tetap `0xghost` dengan PFP kartun, tidak ada
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

- **Bukan aplikasi dating.** Tidak ada swipe, tidak ada matching berbasis ketertarikan.
- **Bukan messenger.** Tidak ada DM. Kontak lanjutan terjadi lewat selective reveal.
- **Bukan credit score.** Skor tidak boleh dipakai mengunci akses ke apa pun di dunia nyata.
- **Bukan token launch.** Tidak ada token di MVP. Poin/tier saja.
- **Tidak menilai kualitas manusia.** Tidak ada seseorang menilai seseorang. Lihat §6.
- **Tidak membuktikan seseorang orang baik.** Hanya bahwa dia manusia nyata yang hadir.

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
4. **Lokasi mentah dihapus dalam 24 jam.** Yang bertahan hanya koneksi.

## 7. Empat Mekanik

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

Feed berisi unggahan orang Web3. Bisa dilihat, **tidak bisa dikoneksikan, tidak bisa di-DM.**
Yang bisa dilakukan: menandai **"ingin bertemu"**. Lalu suatu hari:

> *"@0xghost yang kamu tandai sedang ada di event ini."*

Online menciptakan keinginan, offline menyelesaikannya. Ini bukan keterbatasan — ini mesinnya.

## 8. Algoritma Trust

Hidup di `packages/trust` sebagai fungsi murni. Bagian yang paling wajib diuji di seluruh
proyek.

Personalized PageRank di atas graf koneksi, disemai dari himpunan tepercaya `S`.

```
Graf G: node = user, edge = koneksi (berbobot vouch)
Seed S: akun tepercaya awal (penyelenggara event, tokoh komunitas)

1. Propagasi   — personalized PageRank dari S dengan damping
2. Diversitas  — H(event) x H(rentang waktu) x (1 - clustering coefficient)
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

Expo SDK 52+, Expo Router, TypeScript, TanStack Query + Zustand.

Wallet: **connect wallet yang sudah ada** sebagai jalur utama — persona anon seseorang *adalah*
wallet-nya, jadi reputasi harus menempel di sana. Embedded wallet lewat Privy sebagai cadangan
untuk pendatang baru. Tanpa OTP, tanpa email wajib.

### 10.2 Backend off-chain

Hono di Node. **Supabase**: Postgres + PostGIS (verifikasi ko-lokasi) + Realtime (radar event
live). Menyimpan presence sementara, metadata profil, FYP, laporan, dan selective reveal
terenkripsi.

Tabel presence mentah **auto-purge 24 jam** (Postgres cron). Yang bertahan hanya koneksi.

### 10.3 On-chain (opBNB, Foundry, viem)

| Kontrak | Isi |
|---|---|
| `NearlyIdentity` | SBT: wallet → handle anon + hash PFP. Tidak bisa dipindah |
| `ConnectionRegistry` | Setiap koneksi ditulis langsung on-chain (opBNB cukup murah) |
| `VouchRegistry` | Vouch + tag; bisa dicabut, bisa di-slash |
| `TrustAttestor` | Publikasi skor trust berkala |
| `NearlyResolver` | Antarmuka baca untuk dApp lain: `getTrust(address)`, `getTier(address)` |

**Kenapa blockchain — jawaban yang kokoh:** karena grafnya publik dan setiap koneksi bisa
diverifikasi, **siapa pun bisa menghitung ulang Trust Score sendiri dan membuktikan kami tidak
curang.** Graf sosialnya adalah infrastruktur publik, bukan database kami. Ini yang tidak bisa
dilakukan Postgres.

**Konsekuensi yang disadari:** graf koneksi jadi publik — terlihat bahwa `0xghost` bertemu
`0xfoo` di suatu event. Untuk pengguna anon ini trade-off yang wajar, dan memang diperlukan
agar bisa diverifikasi. Yang **tidak pernah** publik: lokasi presisi, identitas asli, isi
laporan, dan selective reveal.

**Gas:** relayer + EIP-712 — user menandatangani, backend mengirim & membayar. User tidak
pernah melihat kata "gas". ERC-4337 + paymaster menyusul pasca-hackathon.

**Media FYP:** BNB Greenfield (konten dimiliki user).

### 10.4 Sketsa model data (off-chain)

```
profiles(address PK, display_name, pfp_url, ens, created_at, visibility)
presence(ephemeral_id, geohash7, seen_at)              -- purge < 24 jam
connections(a, b, event_id, created_at, tx_hash)        -- UNIQUE(least(a,b), greatest(a,b))
vouches(from_addr, to_addr, tags[], created_at, revoked_at, tx_hash)
reveals(from_addr, to_addr, payload_encrypted, created_at)
reports(reporter, subject, reason, evidence, status, created_at)   -- off-chain
posts(id, author, media_url, text, geohash7, event_id, expires_at)
want_to_meet(from_addr, target_addr, created_at)         -- privat, hanya pemiliknya
events(id, name, geofence, starts_at, ends_at)
trust_snapshots(address, score, tier, connections, events, cities, computed_at)
```

## 11. Fase Pembangunan

**Fase 0 — Fondasi.** Monorepo pnpm, Supabase (skema + PostGIS + RLS), skeleton Expo + Expo
Router, connect wallet, scaffolding Foundry.
*Selesai = bisa masuk app dengan wallet.*

**Fase 1 — Jantung: pertemuan.** QR bertanda tangan + rotasi 30 detik, pemindai, verifikasi
ko-lokasi di server, `ConnectionRegistry` di opBNB testnet, relayer EIP-712, layar Koneksi &
Profil anon. Sekalian: display name tidak unik + alamat/ENS selalu tampil, dan baca ENS &
riwayat on-chain (keduanya cuma pembacaan chain, murah).
*Selesai = dua HP hanya bisa terhubung kalau benar-benar berdekatan.*

**Fase 2 — Trust & pertahanan.** `packages/trust` (PageRank + diversitas + peluruhan + sidik
jari ko-lokasi), `VouchRegistry`, vouch + tag, tampilan tier & bukti, alur lapor + slashing
trust-weighted (laporan off-chain, hasil slash on-chain), `TrustAttestor` + `NearlyResolver`.
*Selesai = serangan sybil bisa didemokan dan gagal secara matematis.*

**Fase 3 — Radar & pengungkapan.** Siapa di event ini sekarang (daftar kartu + Realtime), mode
visibilitas (ghost / visible / event), selective reveal per-orang, blokir, penautan
X/Farcaster + POAP.

*Selesai = bisa melihat siapa yang hadir di event ini, dan membuka identitas ke satu
orang tertentu tanpa pernah menjadi publik.*
**Fase 4 — FYP.** Feed unggahan (view-only, tanpa jalur koneksi), upload ke Greenfield, tombol
"Ingin bertemu" + notifikasi proximity, lapor & auto-hide.

*Selesai = feed berjalan, dan tanda "ingin bertemu" memicu notifikasi saat orangnya
benar-benar hadir di satu tempat denganmu.*
**Fase 5 — Demo.** Event mode untuk venue hackathon, **visualisasi graf live di web** (graf
tumbuh saat orang bersalaman di ruangan — ini money shot-nya), seed trusted core, landing
page, video pitch.

*Selesai = graf tumbuh hidup di layar saat orang-orang bersalaman di ruangan.*

**Kalau waktu menipis, Fase 4 yang dikorbankan** — FYP setengah jadi lebih merusak demo
daripada tidak ada FYP.

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
- `packages/contracts/src/ConnectionRegistry.sol` — graf on-chain.
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

**Uji privasi** — verifikasi tabel presence mentah benar-benar terhapus setelah 24 jam.

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
5. **Hukum privasi (UU PDP Indonesia / GDPR)** — aplikasi mengumpulkan lokasi kasar dan graf
   sosial. Wajib ada ekspor & hapus data satu tap sebelum ada pengguna publik.

## 15. Langkah Berikutnya

Susun rencana implementasi rinci per fase (skill `superpowers:writing-plans`) sebelum
menyentuh kode.
