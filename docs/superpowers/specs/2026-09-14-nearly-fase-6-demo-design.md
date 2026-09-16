# Nearly Fase 6 — Demo: Design Spec

**Tanggal:** 2026-09-14
**Status:** disetujui pemilik project (brainstorming 2026-09-14), menunggu review tertulis
**Spec induk:** `docs/superpowers/specs/2026-09-03-nearly-design.md`
**Dikerjakan paralel dengan:** Fase 4b + 5 (`2026-09-14-nearly-fase-4b5-radar-design.md`)

---

## 1. Posisi dalam Roadmap

Spec induk §11 menutup peta fase dengan **Fase 6 — Demo**: event mode untuk venue hackathon,
visualisasi graf live di web, seed trusted core, landing page, dan video pitch. Kriteria selesainya
satu kalimat: *graf tumbuh hidup di layar saat orang-orang bersalaman di ruangan.*

Semua bahan graf itu sudah ada. Setiap salaman yang lolos ko-lokasi tercatat di `connections` dan
di `ConnectionRegistry` (BSC testnet, chainId 97); setiap check-in tercatat di `checkins` dan
`AttendanceRegistry`. Yang belum ada adalah **cara melihatnya**: tidak ada aplikasi web, tidak ada
endpoint yang mengembalikan graf, tidak ada CORS, dan API belum pernah di-deploy.

Fase ini dikerjakan **paralel dengan Fase 4b + 5** di sesi eksekusi terpisah. Fase ini sengaja
dirancang hampir lepas dari jalur itu: web baru yang **membaca** data publik, ditambah alat dan panduan
operasional. Batas jalur di §11 wajib dipatuhi.

## 2. Keputusan yang Terkunci

Diputuskan pemilik project saat brainstorming. Tidak dibuka ulang saat implementasi.

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Cakupan graf | **Keduanya, bisa diganti**: "Acara ini" dan "Seluruh jaringan" |
| 2 | Label simpul | **Nama tampilan + alamat singkat**, mis. `Budi · 0x12ab…cdef` (awalnya `Budi · 0x12ab…`; diubah 2026-09-17, lihat §6.3) |
| 3 | Hosting API | **VPS** milik pemilik project |
| 4 | Hosting web | **Vercel** |
| 5 | Bahasa landing page | **Inggris** (aplikasi tetap berbahasa Indonesia) |
| 6 | Pengaturan nama tampilan | Dikerjakan di jalur **4b + 5**, bukan di sini. Selama nama kosong, simpul menampilkan alamat singkat saja |

Keputusan teknis yang diambil saat menulis spec ini (bisa ditinjau di review spec):

- **R1. Vite + React + TypeScript, bukan Next.js.** Spec induk §10 dan §12 menulis Next.js
  (`apps/web/src/app/live/page.tsx`). Landing page dan layar graf sama-sama cukup berupa berkas statis
  yang memanggil API; tidak ada data yang harus dirender di server. Vite menghasilkan satu folder
  statis untuk Vercel, lebih sedikit konsep yang harus dipahami, dan mengikuti vitest yang sudah
  dipakai repo. Dicatat sebagai amandemen spec induk (§12).
- **R2. `react-force-graph-2d`** untuk graf (spec induk menyebut react-force-graph). Kanvas 2D, bukan
  3D: terbaca dari belakang ruangan dan ringan di laptop proyektor.
- **R3. Polling tiap 3 detik** dengan kursor, bukan WebSocket/SSE/Realtime. Spec induk §11.1 butir 5
  sudah memilih polling untuk radar; alasan yang sama berlaku, dan jeda 3 detik tidak terasa sebagai
  "tidak live" di layar proyektor.
- **R4. Tanpa tipe EIP-712 baru dan tanpa autentikasi.** Graf koneksi memang publik (spec induk §10);
  endpoint graf hanya membaca data yang sudah publik on-chain atau lewat endpoint yang ada.
- **R5. Simpul di graf acara hanya orang yang punya salaman di acara itu**, bukan seluruh daftar
  check-in. Angka hadir tetap tampil sebagai hitungan. Menampilkan setiap orang yang check-in sebagai
  simpul menambah paparan tanpa menambah momen "graf tumbuh".
- **R6. Tanpa migrasi.** Kursor memakai `connections.id` (`bigserial`, `0001_init.sql:26`) dan
  penyaringan acara memakai kunci `checkins` yang sudah ada. Bila rencana implementasi membuktikan
  indeks baru diperlukan, nomornya **`0009`**.

## 3. Arsitektur

```
HP peserta ──salaman / check-in──▶ API (VPS, HTTPS lewat Caddy) ──▶ Supabase + BSC testnet
                                        ▲
                                        │ GET /graf/* tiap 3 detik (CORS: domain web)
                                        │
                  Layar proyektor ── apps/web (Vercel, statis) ── Landing page
```

Tiga bagian kode dan satu bagian operasional:

1. **API**: modul graf baca-saja + CORS untuk domain web + `PORT` dari env (§4).
2. **`apps/web`**: landing page dan layar `/live` (§5, §6).
3. **Alat seed trusted core** (§7).
4. **Panduan deploy dan hari-H** (§8) — dijalankan pemilik project, bukan sesi eksekusi.

## 4. API Graf

### 4.1 Modul

- `apps/api/src/routes/graf.ts` — rute, dengan deps sempit sendiri (`Pick<…>`, pola `trustRoutes`).
- `apps/api/src/graf-store.ts` — kueri Supabase.
- `apps/api/src/graf.ts` — fungsi murni: bentuk respons, penyaringan acara, pemotongan halaman.

`TrustStore.loadGraph` **tidak dipakai**: ia membawa sel, blokir, slash, dan vouch yang tidak boleh
keluar lewat endpoint publik. Modul graf menulis kueri sempitnya sendiri.

### 4.2 `GET /graf/jaringan?sejakId=<id>`

Koneksi dengan `id > sejakId` (default 0), urut `id` naik, paling banyak **2000 per respons**.

```json
{
  "simpul": [{ "address": "0x…", "displayName": "Budi", "tierLabel": "Terpercaya" }],
  "sisi": [{ "id": 42, "a": "0x…", "b": "0x…", "atMs": 1757830000000, "txHash": "0x…" }],
  "kursor": 42,
  "lengkap": true
}
```

- `simpul` hanya memuat alamat yang muncul di `sisi` halaman ini; web menggabungkannya dengan yang
  sudah dimiliki (§6.2).
- `kursor` = `id` terbesar di halaman (atau `sejakId` bila halaman kosong); `lengkap: false` berarti
  masih ada halaman berikutnya.
- `tierLabel` dari `trust_snapshots.tier` lewat `TIER_LABELS` (`packages/trust/src/tier.ts:12`) —
  sumber yang sama dengan `GET /trust/:address`. Alamat tanpa snapshot → `Baru`.
- `displayName` dari `profiles.display_name` (bisa kosong).

### 4.3 `GET /graf/acara` dan `GET /graf/acara/:eventId?sejakId=<id>`

`GET /graf/acara` — daftar acara untuk pemilih di layar `/live`: acara yang sedang berlangsung dan
yang berakhir dalam 7 hari terakhir, paling banyak 50, `{ acara: [{ eventId, title, startsAt, endsAt,
live }] }`. Satu-satunya tujuannya supaya operator proyektor tidak perlu menyalin id acara 66 karakter.

`GET /graf/acara/:eventId` — bentuk sama dengan §4.2, ditambah:

```json
{
  "acara": { "eventId": "0x…", "title": "BNB Hackathon Jakarta", "startsAt": 1757800000, "endsAt": 1757886400, "live": true },
  "hitungan": { "hadir": 212, "salaman": 87 }
}
```

**Aturan "salaman di acara ini" wajib identik dengan aturan trust**
(`eventOccasionFor`, `apps/api/src/trust/load-graph.ts:120`). Sebuah koneksi termasuk acara E bila
ketiga syarat ini benar:

1. **kedua** alamat sudah check-in di E;
2. waktu koneksi berada di jendela `[starts_at, ends_at]` E;
3. di antara **semua** acara yang memenuhi syarat 1 dan 2 untuk koneksi itu, `event_id` E adalah yang
   **terkecil secara leksikografis**.

Syarat 3 adalah pemecah seri trust untuk **acara yang tumpang tindih**: kalau dua orang sama-sama
check-in di dua acara yang jendelanya beririsan dan bersalaman di irisan itu, trust memberi salaman
tersebut ke **satu** acara saja — aturannya sewenang-wenang tapi deterministik, supaya skor sama
setiap kali dihitung ulang (`load-graph.ts:115-118`). Graf acara mengikutinya, sehingga **salaman itu
hanya tampil di layar acara ber-`event_id` terkecil** dan tidak muncul di layar acara yang lain. Untuk
hackathon satu acara ini tidak berpengaruh; runbook (§8 butir 4) meminta acara uji tidak dibuat
dengan jendela yang beririsan dengan acara utama.

Tes konsistensi (§10) menyusun data yang sama, menjalankan `rowsToGraph` yang sudah diekspor, dan
membuktikan himpunan sisi graf acara sama persis dengan koneksi yang diberi occasion acara E oleh
trust. Aturan dua tempat yang berselisih akan membuat layar proyektor dan skor trust menceritakan
dua kisah berbeda tentang ruangan yang sama.

`hitungan.hadir` = jumlah check-in acara (angka yang sudah publik lewat
`GET /events/:id/attendance`). `hitungan.salaman` = jumlah seluruh sisi acara, bukan hanya di halaman
ini. Acara tidak ada → 404 `event_not_found`; jendela acara lebih dari 7 hari (atau di luar rentang
tanggal) → 404 `event_window_unsupported` (catatan 2026-09-17 di §4.5).

### 4.4 Yang tidak pernah keluar

Dari seluruh endpoint graf: `cell`, `center_cell`, `nonce`, skor atau rasio trust, `operator_cluster`,
vouch, laporan, slash, **dan apa pun tentang blokir**. Blokir bersifat pribadi (spec 4a): sisi antara
dua orang yang saling memblokir tetap tampil karena koneksinya publik on-chain, tetapi tidak ada satu
pun penanda yang membedakan sisi itu. Tes route memeriksa **nama kunci JSON** (§10).

### 4.5 Beban

Endpoint graf publik dan dipanggil tiap 3 detik oleh setiap layar yang terbuka. Setiap respons
disimpan di memori proses selama **2 detik** per kunci (path + `sejakId`), sehingga sepuluh tab yang
terbuka tidak berarti sepuluh kali kueri. Respons juga membawa `Cache-Control: public, max-age=2`.

**Catatan (2026-09-17, review akhir I-2 dan M-3).** Kunci per `sejakId` di `/graf/acara/:eventId`
adalah amplifikasi beban: setiap `sejakId` berbeda menjalankan ulang pekerjaan penuh (acara, acara
beririsan, seluruh check-in, seluruh koneksi di jendela, profil) padahal hasilnya sama dan baru
dipotong di akhir. Siapa pun cukup memutar `sejakId=0..999`. Ditambah lagi `AttendanceRegistry` hanya
memeriksa `endsAt > startsAt`, sehingga acara berjendela bertahun-tahun membuat satu permintaan membaca
hampir seluruh `connections` dan `checkins`, dan `endsAt` yang sangat besar membuat `toISOString()`
melempar `RangeError` (500). Perilaku baru:

- **`/graf/acara/:eventId`:** hasil berat (acara, sisi acara lengkap, `hitungan.hadir`, profil semua
  alamat sisi) disimpan 2 detik **per `eventId` saja**; potongan per `sejakId` dihitung di atasnya tanpa
  kueri. Acara yang tidak ada juga disimpan per `eventId`. `/graf/jaringan` dan `/graf/acara` tetap
  memakai kunci lama (koneksi sejak `sejakId` memang berbeda per kunci, dan cache dibatasi 1000 kunci).
- **Jendela acara dibatasi 7 hari** untuk layar graf, juga bilangan bulat detik yang aman, tidak
  terbalik, dan di dalam rentang `Date`. Selain itu → **404 `event_window_unsupported`**, diputuskan
  sebelum kueri berat apa pun. 404 dipilih seperti id berbentuk salah: acara itu memang tidak tersedia
  sebagai layar graf, dan layar `/live` berhenti mencoba ulang pada 404 (dengan pesan tersendiri).
- **Caddy:** `/graf/*` lewat `reverse_proxy` tersendiri dengan `max_conns_per_host 16`, sehingga
  lonjakan permintaan graf mengantre di Caddy dan tidak menghabiskan kapasitas API untuk salaman.
  Batas laju per IP tidak ada di Caddy standar (butuh plugin); dicatat sebagai langkah opsional di
  runbook.
- **`Vary: Origin`** dipasang pada **setiap** respons `/graf/*` (termasuk galat dan yang tanpa ACAO)
  selama `WEB_ORIGINS` tidak kosong, supaya cache bersama di depan API kelak tidak menyajikan varian
  tanpa ACAO ke web (§4.6).

### 4.6 CORS

Middleware hanya untuk `/graf/*`. Env baru `WEB_ORIGINS` berisi daftar origin dipisah koma
(mis. `https://nearly.vercel.app`). Origin di daftar → header `Access-Control-Allow-Origin` origin itu;
origin lain → tanpa header CORS (`Vary: Origin` tetap ada, lihat catatan §4.5). `WEB_ORIGINS` kosong
atau tidak ada → CORS mati; pengembangan lokal
memakai proxy dev server Vite. Hanya metode `GET`.

Rute lain (salaman, pesan, feed, dll.) **tidak** mendapat CORS. Aplikasi mobile tidak butuh CORS, dan
membuka rute tulis ke browser tidak punya alasan.

### 4.7 `PORT`

`apps/api/src/index.ts` membaca `PORT` dari env, default `8787`. Satu-satunya perubahan di berkas itu
selain merakit rute graf.

## 5. `apps/web` — Struktur

Workspace baru, otomatis tercakup `pnpm-workspace.yaml` (`apps/*`).

| Berkas | Isi |
|---|---|
| `package.json` | `@nearly/web`; skrip `dev`, `build`, `preview`, `test` (vitest), `typecheck` |
| `vite.config.ts` | React; proxy dev `/graf` → `http://localhost:8787` |
| `vercel.json` | rewrite semua path ke `index.html` |
| `src/main.tsx` | memilih halaman dari `location.pathname`: `/live` → Live, lainnya → Landing |
| `src/api.ts` | klien `GET /graf/*`, basis dari `VITE_API_URL`, batas waktu 10 detik |
| `src/gabung-graf.ts` | fungsi murni penggabung halaman graf (§6.2) |
| `src/label.ts` | fungsi murni label simpul |
| `src/kontrak.ts` | alamat kontrak testnet untuk landing page (§6.4) |
| `src/pages/Landing.tsx` | landing page (§6.4) |
| `src/pages/Live.tsx` | layar proyektor (§6.1) |

Tanpa router pustaka: dua halaman tidak butuh satu. Tanpa pustaka UI dan tanpa Tailwind: CSS biasa
dalam satu berkas, supaya tidak ada konfigurasi tambahan yang harus dijaga.

`@nearly/shared` **tidak** diimpor: web tidak menandatangani apa pun dan tidak butuh viem.

## 6. `apps/web` — Perilaku

### 6.1 Layar `/live` (event mode)

"Event mode untuk venue hackathon" (spec induk §11) diwujudkan sebagai layar ini, dibuka di laptop
yang tersambung ke proyektor. Tidak ada perubahan aplikasi mobile; check-in tetap lewat QR host di HP
(Fase 3a).

URL: `/live` (seluruh jaringan) atau `/live?acara=<eventId>`.

Tata letak, tema gelap untuk proyektor:

- **Kanvas graf** memenuhi layar.
- **Pojok kiri atas:** judul acara (atau "Nearly network"), dan tombol **This event / Whole network**.
  Tombol "This event" hanya aktif bila ada `?acara`. Tanpa `?acara`, muncul pemilih acara dari
  `GET /graf/acara`.
- **Pojok kanan atas:** angka besar — *handshakes* dan *checked in* (mode acara) atau *connections* dan
  *people* (mode jaringan).
- **Bawah:** satu baris "Scan, shake hands, watch the graph grow." dan tombol layar penuh.

Teks layar `/live` berbahasa Inggris, sama dengan landing page.

### 6.2 Penggabungan dan polling

`gabung-graf.ts` menerima keadaan `{ simpul: Map, sisi: Map, kursor }` dan satu respons, lalu
mengembalikan keadaan baru tanpa mengubah yang lama:

- sisi digabung berdasarkan `id`, simpul berdasarkan alamat huruf kecil;
- data simpul yang lebih baru (nama, tier) menimpa yang lama;
- `kursor` tidak pernah mundur;
- sisi yang baru masuk ditandai `baruSampaiMs`, dipakai untuk efek menyala.

Siklus: muat halaman berturut-turut sampai `lengkap: true`, lalu polling tiap **3 detik** dengan
`sejakId = kursor`. Gagal → tampilkan "Reconnecting…" di sudut, **pertahankan graf yang sudah ada**,
coba lagi dengan jeda naik 3 → 6 → 12 detik (maks 12), kembali ke 3 detik saat berhasil. Mengganti
cakupan menyetel ulang keadaan dan memuat dari awal.

**Catatan (2026-09-17, review akhir I-1 dan M-1).** Desain kursor di atas mengandaikan himpunan sisi
hanya bertambah dengan `id` yang naik. Dua andaian itu tidak selalu benar:

1. **Keanggotaan sisi acara bukan fakta tetap.** Salaman tidak mensyaratkan check-in, dan check-in sah
   selama acara berlangsung. A dan B bersalaman pukul 09:05 (id 41, belum milik acara), B baru check-in
   pukul 09:10 — id 41 *menjadi* milik acara setelah kursor sudah lewat, sehingga `sejakId = kursor`
   tidak pernah mengembalikannya, sementara `hitungan.salaman` sudah menghitungnya. Sebaliknya,
   check-in belakangan di acara tumpang tindih ber-`event_id` lebih kecil *memindahkan* sisi ke acara
   lain (§4.3 syarat 3), tetapi penggabung yang hanya menambah tetap menggambarnya. Akar masalahnya di
   desain kursor spec ini, bukan di pelaksanaan.
2. **`bigserial` bisa commit tidak berurutan.** Dua salaman bersamaan dapat membuat id 11 terbaca
   sebelum id 10; polling di sela itu memajukan kursor melewati id 10.

Perilaku baru:

- Setelah muatan awal, polling memakai **`sejakId = max(0, kursor − 50)`**. Gabung idempoten per `id`,
  jadi baris yang terbaca ulang tidak menggandakan apa pun. Muatan awal tetap persis di kursor.
- **Mode acara:** bila `hitungan.salaman` ≠ jumlah sisi yang dimiliki layar, **atau** sudah 60 detik
  sejak muat penuh terakhir (untuk pertukaran yang jumlahnya sama), layar memuat ulang dari
  `sejakId = 0` dan **mengganti** himpunan sisi dan simpul (`gantiHalaman`). Graf lama tetap tampil
  selama halaman muat ulang dikumpulkan; sisi dan simpul yang masih ada memakai objek lamanya (tidak
  berkedip, tidak melompat, tidak menyala ulang); hanya sisi yang benar-benar baru yang menyala; sisi
  yang pindah ke acara lain dan simpul yang tak lagi punya sisi dibuang. Setelah satu muat ulang,
  pemeriksaan hitungan baru dilakukan lagi di polling berikutnya, supaya server yang tidak konsisten
  tidak dibanjiri muat ulang beruntun. Biayanya kecil karena hasil acara di server disimpan per
  `eventId` (§4.5).
- Mode jaringan tidak memuat ulang: koneksi tidak pernah berpindah atau menghilang.

### 6.3 Tampilan simpul dan sisi

- Label (`label.ts`): `Budi · 0x12ab…cdef` bila nama ada, `0x12ab…cdef` bila kosong. Nama dipotong 20
  karakter. Alamat singkat = 6 karakter awal (termasuk `0x`) + `…` + 4 karakter akhir. **Tidak pernah**
  "Tanpa nama" di layar proyektor.

  **Catatan (2026-09-17, review akhir M-2, keputusan pemilik project).** Semula alamat singkat hanya 6
  karakter awal (`0x12ab…`) = 16 bit, sehingga alamat berawalan sama bisa di-grind dalam hitungan detik
  untuk menyamar, mis. `Budi · 0x12ab…` palsu di proyektor — padahal spec induk §9.2 bersandar pada
  alamat yang selalu tampil di samping nama. Awal + akhir menaikkannya ke 32 bit.
- Ukuran simpul naik dengan tier (Baru terkecil, Inti terbesar); warna simpul sama untuk semua tier,
  karena warna tier akan dibaca sebagai peringkat di depan ruangan.
- Sisi baru **menyala selama 4 detik**, simpul baru muncul dengan animasi membesar. Inilah momen yang
  dicari demo.
- Label digambar untuk semua simpul bila jumlahnya ≤ 300; di atas itu hanya untuk simpul baru dan saat
  diperbesar.

### 6.4 Landing page `/`

Bahasa Inggris. Satu halaman, bagian berurutan:

1. **Hero** — satu kalimat nilai Nearly (koneksi hanya lewat pertemuan fisik), tombol **See the live
   graph** → `/live`.
2. **How it works** — tiga langkah: bertemu → pindai QR yang berganti tiap 30 detik → server
   memverifikasi kalian berdekatan, koneksi tercatat on-chain di BNB Smart Chain testnet.
3. **Trust comes from the graph** — PageRank dari graf pertemuan, diversitas, kenapa akun palsu sulit
   menaikkan skor (spec induk §8).
4. **Privacy by design** — tanpa peta berisi orang, lokasi kasar saja, pesan terenkripsi ujung ke ujung.
5. **What Nearly does not claim** — ringkasan jujur batas dari spec induk §9 dan §14: Nearly
   membuktikan manusia hadir, bukan bahwa ia orang baik; sybil multi-perangkat dideteksi, tidak
   dicegah. Bagian ini wajib ada; spec induk: *"Jangan pernah mengklaim lebih dari ini."*
6. **On-chain** — alamat kontrak testnet dengan tautan BscScan testnet, dari `src/kontrak.ts` yang
   disalin dari `packages/contracts/broadcast/Deploy.s.sol/97/`.

Setiap klaim teknis di landing page harus bisa ditunjuk ke spec induk atau spec fase. Tidak ada angka
pengguna, tidak ada testimoni, tidak ada logo mitra.

## 7. Seed Trusted Core

Spec induk §8: seed adalah akun tepercaya awal — penyelenggara acara dan tokoh komunitas; di
hackathon, panitia dan juri. Hari ini seed ditambah satu per satu lewat `apps/api/tools/seed.ts`.

Alat baru `apps/api/tools/seed-inti.ts <berkas.csv> [--jalankan]`:

- CSV berkolom `address,catatan,bobot`; baris kosong dan baris diawali `#` diabaikan.
- **Semua baris divalidasi sebelum satu pun ditulis**: alamat sah, bobot angka > 0, alamat tidak
  berulang. Satu baris salah → keluar dengan daftar kesalahan, tanpa menulis apa pun.
- **Tanpa `--jalankan` = uji coba**: mencetak apa yang akan di-upsert dan tidak menulis.
- Dengan `--jalankan`: upsert ke `trust_seeds`, lalu **satu kali** hitung ulang trust dengan jalur yang
  sama dengan `tools/recompute.ts`.
- Mencetak peringatan bahwa hitung ulang dapat mengirim transaksi `setScore` lewat relayer untuk setiap
  tier yang berubah, sehingga saldo tBNB relayer harus cukup.

Logika validasi CSV ditaruh sebagai fungsi murni yang diuji. **Sesi eksekusi hanya menulis dan menguji
alat ini; tidak pernah menjalankannya dengan `--jalankan`.**

## 8. Deploy dan Hari-H — Panduan

Berkas `docs/demo/runbook.md`, ditambah templat konfigurasi yang di-commit:

| Berkas | Isi |
|---|---|
| `deploy/nearly-api.service` | unit systemd: `node --env-file=/etc/nearly/api.env --import=tsx src/index.ts`, restart otomatis |
| `deploy/Caddyfile` | `api.<domain>` → `localhost:8787`, HTTPS otomatis |
| `apps/web/vercel.json` | §5 |

Isi runbook:

1. **VPS** — prasyarat (Node 24, pnpm, Caddy), clone, `pnpm install`, berkas env di `/etc/nearly/api.env`
   (daftar **nama** variabel saja, termasuk `WEB_ORIGINS` dan `PORT`), pasang unit systemd, pasang
   Caddyfile, arahkan DNS `api.<domain>` ke VPS, verifikasi `curl https://api.<domain>/health`
   (`app.ts:54`).
2. **Vercel** — hubungkan repo, root directory `apps/web`, build `pnpm build`, output `dist`, env
   `VITE_API_URL=https://api.<domain>`; tambahkan domain Vercel ke `WEB_ORIGINS` di VPS.
3. **Aplikasi mobile** — `EXPO_PUBLIC_API_URL=https://api.<domain>` di **`apps/mobile/.env`** (bukan
   `.env` root), jalankan ulang Metro dengan `-c`. Dengan domain HTTPS, HP tidak lagi bergantung pada IP
   Wi-Fi Mac.
4. **H-1** — isi saldo relayer dari faucet BSC testnet; siapkan CSV panitia & juri; `seed-inti.ts` uji
   coba lalu `--jalankan`; pastikan panitia bertier **Inti** dan `ScoreUpdated` terlihat di BscScan;
   buat acara uji lewat aplikasi dengan jendela waktu yang **tidak beririsan** dengan acara hackathon
   (§4.3 syarat 3 — salaman di irisan hanya tampil di satu layar); uji check-in dan satu salaman; buka
   `/live?acara=…` di laptop proyektor.
5. **Hari-H** — buat acara hackathon, host menampilkan QR check-in di pintu, layar `/live?acara=…`
   layar penuh; daftar periksa bila graf tidak bergerak (API hidup? `/graf/acara/:id` menjawab? relayer
   masih bersaldo?).
6. **Rencana cadangan** — rekaman layar graf dari uji H-1 bila API atau jaringan venue gagal.
7. **Kerangka video pitch** — adegan 3 menit: masalah (koneksi palsu), salaman QR, graf tumbuh di
   proyektor, trust dari graf, batas yang jujur. Pembuatan videonya di luar kode.

Runbook menulis peringatan eksplisit: uji lapangan di meetup nyata sebelum hari-H (spec induk §13).

## 9. Yang Sengaja TIDAK Ada di Fase Ini

- Perubahan aplikasi mobile apa pun, termasuk pengaturan nama (jalur 4b + 5).
- Login, dompet, atau tanda tangan di web.
- Profil orang di web, pencarian alamat, halaman per orang.
- Graf 3D, peta, atau posisi geografis simpul.
- Supabase Realtime, WebSocket, SSE (R3).
- Menjalankan deploy, membuat akun Vercel/VPS/domain, atau menjalankan `seed-inti.ts --jalankan`.
- Pembuatan video pitch.
- Analitik atau pelacakan pengunjung di landing page.

## 10. Verifikasi

**`apps/api`**
- `graf.ts` murni: pemotongan 2000 per halaman, `kursor`, `lengkap`, tier tanpa snapshot → `Baru`.
- **Tes konsistensi aturan acara:** himpunan sisi `GET /graf/acara/:id` sama dengan koneksi yang diberi
  occasion acara itu oleh `rowsToGraph`, untuk data berisi: salaman di dalam jendela oleh dua orang
  yang check-in (masuk), salaman di luar jendela (tidak), salaman dengan satu pihak belum check-in
  (tidak), dan dua acara tumpang tindih yang sama-sama dihadiri — salaman di irisan jendela masuk ke
  acara ber-`event_id` terkecil dan **tidak** masuk ke acara yang lain (§4.3 syarat 3).
- **Tes nama kunci JSON:** tidak ada `cell`, `center_cell`, `nonce`, `score`, `ratio`,
  `operator_cluster`, atau kunci terkait blokir di respons mana pun.
- Sisi antara dua orang yang saling memblokir tetap tampil **tanpa penanda apa pun**.
- CORS: origin terdaftar mendapat header; origin lain tidak; `WEB_ORIGINS` kosong → tidak ada header;
  rute non-graf tidak pernah mendapat header CORS.
- Cache 2 detik: dua permintaan identik dalam 2 detik → satu kueri store.
- `PORT` dari env dan default 8787.
- `seed-inti`: satu baris salah → nol tulisan; alamat berulang ditolak; tanpa `--jalankan` → nol
  tulisan.
- Langkah mutasi dijalankan sungguhan untuk: aturan acara (hapus syarat jendela waktu → tes
  konsistensi merah), penyaring kunci JSON, dan validasi-sebelum-tulis `seed-inti`.

**`apps/web`**
- `gabung-graf.ts`: dedup sisi dan simpul, data simpul baru menimpa, kursor tidak mundur, keadaan lama
  tidak termutasi.
- `label.ts`: nama ada / kosong / panjang, alamat singkat.
- Jeda coba ulang 3 → 6 → 12 → kembali 3.
- `pnpm --filter @nearly/web build` dan `typecheck` bersih.

**Global**
- `pnpm -r test` dan `pnpm -r typecheck` hijau, termasuk workspace web.

**Uji lapangan (pemilik project)**
1. API di VPS menjawab lewat HTTPS; web di Vercel memuat graf seluruh jaringan.
2. Dua HP bersalaman di acara uji → sisi baru menyala di `/live?acara=…` dalam ≤ 6 detik.
3. Ganti ke "Whole network" dan kembali → graf dimuat ulang tanpa galat.
4. Matikan API sebentar → "Reconnecting…", graf tetap tampil, pulih sendiri.
5. `seed-inti.ts` uji coba terhadap CSV contoh → keluaran sesuai, tanpa tulisan.

## 11. Batas Jalur Paralel dengan Fase 4b + 5

| | Jalur ini (Fase 6) | Jalur 4b + 5 |
|---|---|---|
| Branch / worktree | `fase-6-demo` | `fase-4b5-radar` |
| Migrasi | tidak ada (bila perlu: **`0009`**) | `0008_radar.sql` |
| Tipe EIP-712 | **tidak menambah** | +1 → 25 |
| `apps/mobile` | **tidak menyentuh** | ya |
| `apps/web` | ya | tidak menyentuh |
| `apps/api` | `routes/graf.ts`, `graf.ts`, `graf-store.ts`, CORS, `PORT`, `tools/seed-inti.ts` | rute radar & profil, store baru |

Berkas bersama yang disentuh kedua jalur — **hanya penambahan, di akhir blok yang ada**, tanpa mengubah
atau memindahkan baris yang sudah ada: `apps/api/src/ports.ts`, `apps/api/src/app.ts`,
`apps/api/src/index.ts`, `apps/api/test/support/deps.ts`. `pnpm-lock.yaml` pasti berubah di jalur ini
(workspace web baru); konflik lockfile diselesaikan dengan `pnpm install` ulang, bukan diedit tangan.
Jalur yang merge **kedua** melakukan rebase dan menjalankan ulang seluruh tes.

Jalur ini **tidak** mengubah: `packages/trust`, `packages/contracts`, `packages/shared`,
`apps/api/src/trust/**` (hanya mengimpor `rowsToGraph` dan `TIER_LABELS` untuk tes dan label), gerbang
tulis mana pun, dan seluruh kode Fase 4c.

## 12. Perbaikan Spec Induk yang Termasuk Ruang Lingkup

Task terakhir rencana implementasi memperbarui `2026-09-03-nearly-design.md`:

1. **§10 dan §12:** `apps/web` Next.js → **Vite + React**, dengan alasan R1;
   `apps/web/src/app/live/page.tsx` → `apps/web/src/pages/Live.tsx`.
2. **§10 hosting:** API di VPS di belakang Caddy (HTTPS), web di Vercel, CORS terbatas `/graf/*`.
3. **§11 Fase 6:** "event mode" = layar `/live?acara=…`; seed trusted core lewat `seed-inti.ts`;
   video pitch di luar kode.
4. **Peta fase:** Fase 6 tuntas secara kode; kesiapan demo bergantung pada runbook §8 yang dijalankan
   pemilik project.

## 13. Langkah Berikutnya

1. Pemilik project me-review spec ini.
2. Rencana implementasi (`superpowers:writing-plans`) di branch `fase-6-demo`.
3. PR briefing untuk sesi `fcc`, dengan worktree terpisah dan batas jalur §11.
4. Pemilik project menjalankan runbook §8 (VPS, Vercel, seed) dan uji lapangan §10.
