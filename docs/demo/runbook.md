# Runbook Demo Nearly — Deploy dan Hari-H

**Spec:** `docs/superpowers/specs/2026-09-14-nearly-fase-6-demo-design.md` §8
**Dijalankan oleh:** pemilik project. Sesi eksekusi kode TIDAK menjalankan satu pun langkah di sini.

> **Uji lapangan di satu meetup nyata SEBELUM hari-H** (spec induk §13). Akurasi lokasi di dalam
> ruangan, baterai, dan sinyal venue tidak bisa diuji dari meja. Kalau belum pernah dicoba di
> ruangan sungguhan, anggap demo belum siap.

Dokumen ini hanya menyebut **nama** variabel env. Nilainya tidak pernah ditulis di repo, di
issue, maupun di chat.

Placeholder yang dipakai di bawah: `<domain>` = domain milikmu (mis. `nearly.xyz`),
`<vps>` = alamat IP VPS, `<vercel-domain>` = domain yang diberikan Vercel.

---

## 1. VPS — API

### 1.1 Prasyarat

- Ubuntu/Debian dengan akses `sudo`, port 22, 80, dan 443 terbuka.
- **Node 24** (dari NodeSource, sehingga biner ada di `/usr/bin/node`), `corepack` untuk pnpm,
  `git`, dan **Caddy** (paket resmi `caddy` dari repositori Caddy).

```bash
node -v                 # harus v24.x
corepack enable
caddy version
```

### 1.2 Kode

```bash
sudo useradd --system --create-home --home-dir /var/lib/nearly --shell /usr/sbin/nologin nearly
sudo mkdir -p /opt/nearly && sudo chown nearly:nearly /opt/nearly
sudo -u nearly git clone <url-repo> /opt/nearly
cd /opt/nearly
sudo -u nearly corepack pnpm install --frozen-lockfile
```

`tsx` ada di `devDependencies` API dan dibutuhkan saat berjalan, jadi JANGAN pakai `--prod`.

### 1.3 Berkas env `/etc/nearly/api.env`

```bash
sudo mkdir -p /etc/nearly
sudo touch /etc/nearly/api.env
sudo chown root:nearly /etc/nearly/api.env
sudo chmod 640 /etc/nearly/api.env
sudoedit /etc/nearly/api.env
```

Isi dengan baris `NAMA=nilai` untuk variabel berikut (nilainya dari `.env` laptopmu, bukan dari dokumen ini):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ya | |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | rahasia — hanya di server |
| `RPC_URL` | ya | BSC testnet |
| `MAINNET_RPC` | ya | ENS |
| `RELAYER_PRIVATE_KEY` | ya | rahasia — dompet relayer sekali pakai |
| `CONNECTION_REGISTRY_ADDRESS` | ya | |
| `VOUCH_REGISTRY_ADDRESS` | ya | |
| `TRUST_ATTESTOR_ADDRESS` | ya | |
| `ATTENDANCE_REGISTRY_ADDRESS` | ya | |
| `ADMIN_TOKEN` | ya | rahasia |
| `WEB_ORIGINS` | ya untuk web | origin web dipisah koma, mis. `https://<vercel-domain>`; spasi dan garis miring penutup dibuang otomatis |
| `PORT` | tidak | default `8787`; kalau diubah, ubah juga `deploy/Caddyfile` |
| `GREENFIELD_RPC`, `GREENFIELD_CHAIN_ID`, `GREENFIELD_BUCKET`, `GREENFIELD_SP_ENDPOINT` | tidak | isi keempatnya atau kosongkan keempatnya |

`WEB_ORIGINS` kosong berarti layar `/live` di Vercel TIDAK bisa membaca API (CORS mati). Itu
disengaja untuk pengembangan lokal, dan penyebab paling mungkin kalau web memuat tapi graf kosong.

### 1.4 Layanan systemd

```bash
sudo cp /opt/nearly/deploy/nearly-api.service /etc/systemd/system/nearly-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now nearly-api
sudo systemctl status nearly-api --no-pager
curl -s http://localhost:8787/health          # {"ok":true}
journalctl -u nearly-api -n 50 --no-pager      # kalau gagal: env apa yang kurang?
```

### 1.5 Caddy dan DNS

1. Di pengelola DNS domainmu: rekaman **A** `api.<domain>` → `<vps>`. Tunggu sampai
   `dig +short api.<domain>` mengembalikan `<vps>`.
2. Pasang Caddyfile dan beri tahu Caddy nama host-nya:

```bash
sudo cp /opt/nearly/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl edit caddy
#   tambahkan di bagian yang dibuka editor:
#   [Service]
#   Environment=NEARLY_API_HOST=api.<domain>
sudo systemctl restart caddy
```

3. Verifikasi dari laptop, bukan dari VPS:

```bash
curl -s https://api.<domain>/health           # {"ok":true}
curl -s https://api.<domain>/graf/acara       # {"acara":[...]}
```

### 1.6 Memperbarui API

```bash
cd /opt/nearly
sudo -u nearly git pull
sudo -u nearly corepack pnpm install --frozen-lockfile
sudo systemctl restart nearly-api
```

---

## 2. Vercel — Web

1. Hubungkan repo di Vercel. **Root Directory:** `apps/web`. Framework preset: Vite.
2. **Build Command:** `pnpm build`. **Output Directory:** `dist`.
3. **Environment Variables:** `VITE_API_URL` = `https://api.<domain>` (Production dan Preview).
   `VITE_*` ikut terbundel ke browser — jangan pernah menaruh rahasia di sana.
4. Repo memakai `packageManager: pnpm@11.x`. Kalau build Vercel gagal karena versi pnpm, tambahkan
   env `ENABLE_EXPERIMENTAL_COREPACK` = `1` lalu deploy ulang.
5. Setelah deploy: tambahkan `https://<vercel-domain>` (dan domain kustom web bila ada) ke
   `WEB_ORIGINS` di `/etc/nearly/api.env`, lalu `sudo systemctl restart nearly-api`.
6. Buka `https://<vercel-domain>/` (landing) dan `https://<vercel-domain>/live` (graf seluruh jaringan).
   `vercel.json` menulis ulang semua path ke `index.html`, jadi memuat ulang `/live` tidak 404.

Periksa CORS dari laptop:

```bash
curl -s -D - -o /dev/null -H "Origin: https://<vercel-domain>" https://api.<domain>/graf/jaringan | grep -i access-control
# harus: access-control-allow-origin: https://<vercel-domain>
```

---

## 3. Aplikasi mobile

1. Di **`apps/mobile/.env`** (BUKAN `.env` di root repo): `EXPO_PUBLIC_API_URL=https://api.<domain>`.
2. Jalankan ulang Metro dengan cache bersih: `cd apps/mobile && npx expo start -c`.
3. Dengan domain HTTPS, HP tidak lagi bergantung pada IP Wi-Fi Mac — HP dan laptop boleh di jaringan berbeda.

---

## 4. H-1

1. **Saldo relayer.** Isi tBNB dompet relayer dari faucet BSC testnet. Setiap salaman, check-in,
   dan perubahan tier mengirim transaksi.
2. **CSV panitia & juri.** Format `address,catatan,bobot` (lihat `docs/demo/seed-inti-contoh.csv`).
   Catatan tanpa koma.
3. **Seed trusted core — uji coba dulu:**

```bash
cd /opt/nearly/apps/api
sudo -u nearly node --env-file=/etc/nearly/api.env --import=tsx tools/seed-inti.ts /path/panitia.csv
```

   Periksa daftar yang tercetak. Satu baris salah → tidak ada yang ditulis; perbaiki CSV dan ulangi.

4. **Seed trusted core — sungguhan:**

```bash
sudo -u nearly node --env-file=/etc/nearly/api.env --import=tsx tools/seed-inti.ts /path/panitia.csv --jalankan
```

   Hitung ulang berjalan satu kali dan dapat mengirim `setScore` untuk setiap tier yang berubah.
5. **Periksa hasil:** panitia bertier **Inti** di aplikasi; event `ScoreUpdated` terlihat di BscScan
   testnet pada kontrak `TrustAttestor`.
6. **Acara uji.** Buat acara lewat aplikasi dengan waktu mulai **sebelum sekarang** — pemilih acara
   di `/live` hanya menampilkan acara yang sudah mulai (atau berakhir ≤ 7 hari lalu). Jendela waktunya
   **tidak boleh beririsan** dengan acara hackathon: salaman di irisan dua acara yang sama-sama
   dihadiri hanya tampil di layar acara ber-`event_id` terkecil (spec §4.3 syarat 3).
7. **Check-in dan satu salaman** dengan dua HP di dalam venue uji.
8. **Laptop proyektor:** buka `https://<vercel-domain>/live?acara=<eventId>`, pastikan sisi baru
   menyala dalam ≤ 6 detik setelah salaman, lalu tekan **Fullscreen**.
9. **Rekam layar** graf selama uji ini — itulah rencana cadangan (bagian 6).

---

## 5. Hari-H

1. Buat acara hackathon lewat aplikasi (waktu mulai sebelum pintu dibuka).
2. Host menampilkan QR check-in di pintu.
3. Laptop proyektor: `https://<vercel-domain>/live?acara=<eventId>`, layar penuh.

**Daftar periksa bila graf tidak bergerak** — urut, berhenti di yang pertama gagal:

1. Pojok kanan bawah menampilkan **Reconnecting…**? → masalah jaringan laptop atau API.
2. `curl -s https://api.<domain>/health` → `{"ok":true}`? Kalau tidak:
   `sudo systemctl status nearly-api` dan `journalctl -u nearly-api -n 100`.
3. `curl -s "https://api.<domain>/graf/acara/<eventId>"` → `hitungan.salaman` naik setelah salaman?
   - Tidak naik, tapi salaman di HP berhasil → kedua orang sudah check-in di acara ini? Salaman
     dihitung untuk acara hanya bila **keduanya** check-in dan waktunya di dalam jendela acara.
   - Salaman di HP gagal → lihat pesan galat di HP.
4. Relayer masih bersaldo? Periksa saldo dompet relayer di BscScan testnet. Saldo habis = salaman
   dan check-in gagal dengan `chain_error`.
5. Satu orang tidak bisa bersalaman lagi → kuota koneksi harian (30 per orang per hari,
   `DAILY_CONNECTION_QUOTA` di `apps/api/src/handshake-gate.ts`) mungkin habis. Itu perilaku
   yang disengaja, bukan kerusakan.
6. Web memuat tapi graf kosong dan tidak ada **Reconnecting…** → buka DevTools; galat CORS berarti
   origin web belum ada di `WEB_ORIGINS`.

---

## 6. Rencana cadangan

Bila API atau jaringan venue gagal dan tidak pulih dalam beberapa menit: putar **rekaman layar graf
dari uji H-1** di proyektor dan jelaskan terus terang bahwa itu rekaman. Jangan menyajikan rekaman
sebagai siaran langsung.

---

## 7. Kerangka video pitch (±3 menit)

Pembuatan video di luar kode. Adegan:

1. **Masalah (0:00–0:30).** Koneksi palsu: pulang dari acara membawa puluhan username yang tak
   pernah ditindaklanjuti, dan tidak ada cara membedakan yang beneran dari yang omong kosong.
2. **Salaman QR (0:30–1:00).** Dua orang, dua HP, QR yang berganti tiap 30 detik, koneksi tercatat
   on-chain. Tidak ada tombol follow.
3. **Graf tumbuh di proyektor (1:00–1:45).** Layar `/live?acara=…`: sisi baru menyala saat orang
   bersalaman di ruangan.
4. **Trust dari graf (1:45–2:30).** Tier + bukti, bukan angka telanjang; kenapa gumpalan akun palsu
   tetap mendekati nol.
5. **Batas yang jujur (2:30–3:00).** Nearly membuktikan manusia hadir, bukan bahwa ia orang baik;
   sybil multi-perangkat dideteksi, belum dicegah.
