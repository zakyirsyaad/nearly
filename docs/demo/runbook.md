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

**Firewall — tutup semua selain SSH dan HTTP(S).** API (`@hono/node-server`) mendengarkan di SEMUA
antarmuka pada port 8787. Tanpa firewall, siapa pun bisa memanggil `http://<vps>:8787` langsung,
melewati HTTPS dan batas koneksi Caddy. Izinkan SSH **sebelum** mengaktifkan, supaya sesi tidak
terkunci:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose          # hanya 22, 80, 443 yang ALLOW IN
```

Periksa dari laptop (bukan dari VPS): `curl -m 5 http://<vps>:8787/health` harus **gagal/timeout**,
sedangkan `curl https://api.<domain>/health` tetap `{"ok":true}` (setelah bagian 1.5). Kalau penyedia
VPS punya firewall di panel web (security group), atur aturan yang sama di sana juga.

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
| `HOST` | tidak | kosong = semua antarmuka; **`127.0.0.1` di VPS bersama** (bagian 1.5b) supaya API hanya bisa dipanggil dari nginx di mesin yang sama |
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

1. Di pengelola DNS domainmu: rekaman **A** `api.<domain>` dan `unduh.<domain>` → `<vps>`. Tunggu sampai `dig +short api.<domain>` dan `dig +short unduh.<domain>` mengembalikan `<vps>`.
2. Pasang Caddyfile dan beri tahu Caddy nama host-nya:

```bash
sudo cp /opt/nearly/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl edit caddy
#   tambahkan di bagian yang dibuka editor:
#   [Service]
#   Environment=NEARLY_API_HOST=api.<domain>
#   Environment=NEARLY_DOWNLOAD_HOST=unduh.<domain>
sudo NEARLY_API_HOST=api.<domain> NEARLY_DOWNLOAD_HOST=unduh.<domain> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl restart caddy
```

`caddy validate` harus berakhir dengan `Valid configuration` sebelum restart. Caddyfile ini belum
pernah dijalankan oleh sesi kode (tidak ada Caddy di mesin pengembang) — kalau validasi gagal di blok
`handle /graf/*`, hapus blok `transport http { max_conns_per_host 16 }` saja; sisanya konfigurasi
standar.

`/graf/*` lewat proxy tersendiri yang dibatasi 16 koneksi ke API (spec 6 §4.5): lonjakan permintaan
graf mengantre di Caddy, dan salaman di ruangan tetap mendapat koneksi sendiri.

**Opsional — batas laju per IP untuk `/graf/*`.** Caddy standar tidak punya ini; butuh plugin
[`caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit), yang berarti membangun biner Caddy
sendiri dengan `xcaddy` dan mengganti biner paket. Lakukan **hanya** bila endpoint graf benar-benar
dibanjiri, dan jauh sebelum hari-H — biner kustom tidak ikut pembaruan `apt`. Sketsa (periksa README
plugin untuk sintaks versi terbaru):

```caddyfile
{
	# Harus sebelum `handle`: blok handle menghentikan rantai, jadi urutan
	# "before reverse_proxy" membuat rate_limit tidak pernah dijalankan.
	order rate_limit before basic_auth
}

{$NEARLY_API_HOST} {
	rate_limit {
		zone graf {
			match {
				path /graf/*
			}
			key {remote_host}
			events 120
			window 1m
		}
	}
	# ... blok handle yang sudah ada ...
}
```

Satu layar `/live` memanggil ±20 kali per menit. Jangan pasang batas yang terlalu ketat: semua laptop
di Wi-Fi venue bisa keluar lewat SATU IP publik yang sama.

3. Verifikasi dari laptop, bukan dari VPS:

```bash
curl -s https://api.<domain>/health           # {"ok":true}
curl -s https://api.<domain>/graf/acara       # {"acara":[...]}
```

### 1.5b VPS bersama — nginx sudah memegang port 80/443 (spec distribusi D13)

Pakai bagian ini **sebagai ganti Caddy (1.5) dan firewall (1.1)** bila VPS sudah menjalankan nginx untuk
proyek lain. Caddy tidak bisa berbagi port 80/443 dengan nginx, dan `ufw default deny` akan memutus
port proyek lain. Perbedaannya dengan jalur standar:

- **Node 24 terpisah** di `/opt/node24`, khusus untuk Nearly; `/usr/bin/node` milik proyek lain tidak
  disentuh. Unit systemd memakai drop-in yang menunjuk ke biner itu.
- **API hanya di `127.0.0.1`** (`HOST=127.0.0.1` di `/etc/nearly/api.env`), bukan firewall.
- **nginx + certbot** yang sudah ada: dua situs baru dari `deploy/nginx/`, sertifikat lewat
  `certbot --nginx`. Situs lain tidak diubah.
- **Nama host tanpa membeli domain:** `api.nearly.<ip-dengan-strip>.sslip.io` dan
  `unduh.nearly.<ip-dengan-strip>.sslip.io` langsung menunjuk ke IP itu. Pindah ke domain sendiri nanti:
  ganti `server_name`, jalankan certbot lagi, lalu `eas update` dengan `EXPO_PUBLIC_API_URL` baru.

```bash
# Node 24 terpisah (versi LTS terbaru dari https://nodejs.org/dist/latest-v24.x/)
cd /tmp && curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
TAR=$(grep -o 'node-v24[^ ]*-linux-x64.tar.xz' SHASUMS256.txt)
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$TAR" && grep " $TAR\$" SHASUMS256.txt | sha256sum -c -
sudo mkdir -p /opt/node24 && sudo tar -xJf "$TAR" -C /opt/node24 --strip-components=1
/opt/node24/bin/node -v                        # v24.x

# 1.2 dijalankan dengan Node itu (bukan corepack sistem):
sudo -u nearly env PATH=/opt/node24/bin:$PATH corepack pnpm install --frozen-lockfile

# 1.4 dengan drop-in: ExecStart memakai /opt/node24
sudo mkdir -p /etc/systemd/system/nearly-api.service.d
printf '[Service]\nExecStart=\nExecStart=/opt/node24/bin/node --env-file=/etc/nearly/api.env --import=tsx src/index.ts\n' \
  | sudo tee /etc/systemd/system/nearly-api.service.d/node24.conf

# Situs nginx
API=api.nearly.<ip-dengan-strip>.sslip.io
UNDUH=unduh.nearly.<ip-dengan-strip>.sslip.io
sed "s/__NEARLY_API_HOST__/$API/" /opt/nearly/deploy/nginx/nearly-api.conf | sudo tee /etc/nginx/sites-available/nearly-api
sed "s/__NEARLY_DOWNLOAD_HOST__/$UNDUH/" /opt/nearly/deploy/nginx/nearly-unduh.conf | sudo tee /etc/nginx/sites-available/nearly-unduh
sudo ln -s /etc/nginx/sites-available/nearly-api /etc/nginx/sites-available/nearly-unduh /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d "$API" -d "$UNDUH" --redirect
```

`sudo nginx -t` harus lolos **sebelum** reload: satu kesalahan di situs baru ikut menjatuhkan situs
proyek lain. Verifikasi dari laptop: `curl -s https://$API/health` → `{"ok":true}`, dan
`curl -m 5 http://<vps>:8787/health` harus gagal. Kalau penyedia VPS punya security group di panel
web, pastikan 8787 tidak dibuka di sana.

### 1.6 Memperbarui API

```bash
cd /opt/nearly
sudo -u nearly git pull
sudo -u nearly corepack pnpm install --frozen-lockfile
sudo systemctl restart nearly-api
```

### 1.7 Unduhan APK (`unduh.<domain>`)

Folder yang dilayani blok kedua Caddyfile (spec distribusi D4):

```bash
sudo mkdir -p /srv/nearly/unduh
sudo chown "$USER" /srv/nearly/unduh      # pengguna SSH-mu yang mengunggah
```

Setiap APK baru (dari bagian 3.4) diunggah dari laptop dengan nama tetap:

```bash
scp ~/Downloads/<berkas-dari-eas>.apk <user>@<vps>:/srv/nearly/unduh/nearly.apk
curl -sI https://unduh.<domain>/nearly.apk | grep -i "content-type\|content-length"
# content-type: application/vnd.android.package-archive
```

---

## 2. Vercel — Web

1. Hubungkan repo di Vercel. **Root Directory:** `apps/web`. Framework preset: Vite.
2. **Build Command:** `pnpm build`. **Output Directory:** `dist`.
3. **Environment Variables:** `VITE_API_URL` = `https://api.<domain>` (Production dan Preview).
   `VITE_*` ikut terbundel ke browser — jangan pernah menaruh rahasia di sana. Nilai ini dibaca **saat
   build**: menambah atau mengubahnya setelah deploy butuh **Redeploy**. Build tanpa nilai ini
   menampilkan **API not configured: set VITE_API_URL and redeploy** di `/live`. `VITE_APK_URL` = `https://unduh.<domain>/nearly.apk` (Production) — tanpa nilai ini bagian **Get the app** di landing tidak tampil (spec distribusi D10). Isi setelah APK pertama diunggah (bagian 1.7), lalu Redeploy.
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

## 3. Aplikasi mobile — APK Android lewat EAS (spec distribusi)

Peserta memasang **aplikasi sendiri**, bukan Expo Go. Semua perintah dari `apps/mobile`, di laptop
pemilik, dengan `npx eas-cli@latest` (atau `npm i -g eas-cli`, lalu `eas login` sekali).

### 3.1 Pengembangan lokal (tidak berubah)

`apps/mobile/.env` (BUKAN `.env` root) hanya dibaca Metro di laptop. Untuk Expo Go dengan API
produksi: `EXPO_PUBLIC_API_URL=https://api.<domain>`, lalu `npx expo start -c`. Build EAS **tidak**
membaca berkas ini. Nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` di berkas itu boleh dihapus: setiap HP
membuat dompetnya sendiri di layar **Get started**.

### 3.2 Nilai env untuk build (sekali, lalu setiap kali berubah)

Build dan update membaca EAS environment variables (spec distribusi D6):

```bash
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.<domain> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_CONNECTION_REGISTRY --value <alamat> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_VOUCH_REGISTRY --value <alamat> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_ATTENDANCE_REGISTRY --value <alamat> --visibility plaintext
eas env:list --environment preview
```

Alamat kontrak = nilai yang sama dengan `/etc/nearly/api.env`. Tanpa keempatnya aplikasi berhenti
saat dibuka (`src/config.ts`). `EXPO_PUBLIC_*` ikut terbundel ke aplikasi — jangan pernah menaruh
rahasia di sana.

### 3.3 Notifikasi push (Firebase, sekali)

1. [console.firebase.google.com](https://console.firebase.google.com) → proyek baru (Analytics
   boleh dimatikan) → **Add app → Android**, package `app.nearly.mobile` → unduh
   `google-services.json`. Berkas ini tidak di-commit (`.gitignore`).
2. Simpan sebagai EAS file variable (spec distribusi D7):
   `eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret`
3. Firebase → **Project settings → Service accounts → Generate new private key** (JSON). Unggah:
   `eas credentials -p android` → profil `preview` → **Google Service Account → Manage your Google
   Service Account Key for Push Notifications (FCM V1)** → pilih berkas JSON tadi. Hapus berkas JSON
   itu dari laptop setelah terunggah.

### 3.4 Build APK

```bash
eas build -p android --profile preview
```

±15 menit di antrean gratis. Unduh APK dari tautan yang dicetak, lalu unggah ke VPS (bagian 1.7).
`versionCode` naik otomatis, jadi APK baru terpasang di atas APK lama dan dompet di HP tetap ada.
APK hanya berisi `arm64-v8a` (spec distribusi D14, ±3× lebih kecil dari APK universal): HP Android
32-bit lama dan emulator x86 tidak bisa memasangnya.

APK besar lambat diunduh dari CDN EAS (±40 KB/s per koneksi). Lebih cepat bila VPS yang mengunduhnya
langsung dalam potongan paralel: `/opt/nearly/deploy/unduh-apk.sh <url-artefak-eas> <ukuran-bait>` di VPS (sebagai `ubuntu`, pemilik folder unduhan) (ukuran dari
`curl -sIL <url> | grep -i content-length`), lalu hasilnya terpasang di `/srv/nearly/unduh/nearly.apk`.

Uji penerimaan (spec distribusi §6): pasang dari landing di HP Android nyata → buat dompet →
salaman dengan perangkat kedua → kirim pesan dari perangkat kedua saat aplikasi di latar belakang →
notifikasi muncul, ketuk membuka Percakapan.

### 3.5 Memperbarui tanpa build ulang (EAS Update)

Perubahan yang hanya menyentuh JavaScript/TypeScript:

```bash
eas update --channel preview --environment preview --message "<ringkas perubahan>"
```

HP mengunduh pembaruan saat aplikasi dibuka, dan memakainya pada pembukaan berikutnya. Perubahan
**native** (dependensi baru dengan kode native, plugin/izin di `app.json`, ikon) tidak bisa lewat
update: naikkan `version` di `app.json` (mis. `0.2.0` → `0.3.0`), build ulang (3.4), unggah APK baru.
`runtimeVersion` mengikuti `version`, jadi update untuk 0.3.0 tidak pernah sampai ke APK 0.2.0.

---

## 4. H-1

1. **Saldo relayer.** Isi tBNB dompet relayer dari faucet BSC testnet. Setiap salaman, check-in,
   dan perubahan tier mengirim transaksi.
2. **CSV panitia & juri.** Setiap panitia dan juri membuka aplikasi di HP-nya sendiri: **Create a new wallet**
   (atau **Use an existing wallet** bila sudah punya 12 kata), lalu tab **Profile** › **Wallet** →
   **Show 12-word recovery phrase** → catat → **I've written them down**, lalu **Share address** dan kirim alamatnya
   ke penyusun CSV. Tanpa 12 kata yang tercatat, HP hilang atau aplikasi terhapus berarti alamat seed itu
   hilang dan CSV harus diulang. Format `address,catatan,bobot` (lihat `docs/demo/seed-inti-contoh.csv`).
   Catatan tanpa koma. Bobot desimal biasa, > 0 dan ≤ 100 (`1`, `1.5`, `2`). Tempel alamat apa adanya
   dari **Share address** (atau BscScan): alamat huruf campur diperiksa checksum-nya, jadi salah ketik
   satu karakter ditolak.
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

   > **Jalankan saat TIDAK ada salaman, atau hentikan API sebentar.** Alat ini dan API memakai
   > `RELAYER_PRIVATE_KEY` yang sama, tetapi pengaman "satu hitung ulang pada satu waktu" hanya
   > berlaku di dalam proses API. Salaman (termasuk salaman uji H-1) yang memicu hitung ulang di API
   > bersamaan dengan alat ini bisa mengambil **nonce yang sama**; satu `setScore` lalu tergantikan
   > diam-diam dan tier di chain tidak cocok dengan tier di aplikasi. Cara paling aman:
   >
   > ```bash
   > sudo systemctl stop nearly-api
   > sudo -u nearly node --env-file=/etc/nearly/api.env --import=tsx tools/seed-inti.ts /path/panitia.csv --jalankan
   > sudo systemctl start nearly-api
   > curl -s https://api.<domain>/health        # {"ok":true}
   > ```
   >
   > Hal yang sama berlaku untuk `tools/recompute.ts`.
5. **Periksa hasil:** panitia bertier **Core** di aplikasi; event `ScoreUpdated` terlihat di BscScan
   testnet pada kontrak `TrustAttestor`.
6. **Acara uji.** Buat acara lewat aplikasi (tab **Events** › **Create event**) dengan waktu mulai **sebelum sekarang** — pemilih acara
   di `/live` hanya menampilkan acara yang sudah mulai (atau berakhir ≤ 7 hari lalu). Jendela waktunya
   **tidak boleh beririsan** dengan acara hackathon: salaman di irisan dua acara yang sama-sama
   dihadiri hanya tampil di layar acara ber-`event_id` terkecil (spec §4.3 syarat 3).
7. **Check-in dan satu salaman** dengan dua HP di dalam venue uji: host membuka tab **Events** › acara › **Open check-in QR (you're the host)**; tamu mengetuk **Scan the host's QR to check in** (atau tab **Handshake** › **Scan**). Salaman: satu HP di tab **Handshake** mode **Show QR**, yang lain mode **Scan** — pemindai melihat sheet **You met …**.
8. **Laptop proyektor:** buka `https://<vercel-domain>/live?acara=<eventId>`, pastikan sisi baru
   menyala dalam ≤ 6 detik setelah salaman, lalu tekan **Fullscreen**.
9. **Uji jaringan venue — DARI Wi-Fi venue, bukan dari rumah.** Kalau bisa, datang ke venue H-1;
   kalau tidak, lakukan paling awal di hari-H sebelum pintu dibuka. Dari laptop proyektor DAN satu HP
   yang tersambung ke Wi-Fi venue:

   ```bash
   curl -s -m 10 https://api.<domain>/health              # {"ok":true}
   curl -s -m 10 -o /dev/null -w "%{http_code}\n" https://<vercel-domain>/live   # 200
   ```

   Buka juga `https://<vercel-domain>/live` di browser laptop dan pastikan graf memuat (bukan
   **Reconnecting…**). Wi-Fi venue yang **memfilter DNS** bisa memblokir domain baru atau
   `*.vercel.app` tanpa pesan galat yang jelas — ini **pernah terjadi saat uji lapangan**: RPC
   blockchain diarahkan ke halaman blokir, dan yang menolong adalah **WARP / 1.1.1.1** di laptop.
   Dengan API di VPS, RPC dipanggil dari VPS, jadi pemblokiran RPC tidak lagi mengenai salaman — tetapi
   domain API dan domain web tetap bisa diblokir. Siapkan:
   - **Hotspot HP cadangan** (kuota cukup) untuk laptop proyektor, dan beri tahu panitia bahwa peserta
     bisa pindah ke data seluler bila salaman gagal karena jaringan;
   - **WARP / 1.1.1.1** terpasang dan sudah dicoba di laptop proyektor (atau DNS publik `1.1.1.1`);
   - jika Wi-Fi venue gagal uji ini: laptop proyektor langsung pakai hotspot, jangan menunggu.
10. **Rekam layar** graf selama uji ini — itulah rencana cadangan (bagian 6).

---

## 5. Hari-H

1. Buat acara hackathon lewat aplikasi (waktu mulai sebelum pintu dibuka).
2. Host menampilkan QR check-in di pintu. Peserta yang baru memasang aplikasi membuat dompet di layar
   **Get started** lebih dulu (beberapa detik "Setting up wallet…"), baru memindai QR check-in.
3. Laptop proyektor: `https://<vercel-domain>/live?acara=<eventId>`, layar penuh.
4. Sebelum pintu dibuka: ulangi uji jaringan venue (H-1 butir 9) dari laptop proyektor dan satu HP di
   Wi-Fi venue. Hotspot HP cadangan menyala dan siap dipakai.

**Daftar periksa bila graf tidak bergerak** — urut, berhenti di yang pertama gagal:

1. Layar menampilkan pesan yang tidak hilang?
   - **API not configured: set VITE_API_URL and redeploy** → env `VITE_API_URL` tidak ada saat build
     Vercel. Isi di Vercel (bagian 2 butir 3), lalu **Redeploy** — mengisi env saja tidak mengubah build
     yang sudah jalan.
   - **This event is longer than 7 days and cannot be shown live** → acara dibuat dengan jendela lebih
     dari 7 hari; buat ulang acara dengan jendela yang benar.
   - **Event not found** → `eventId` di URL salah atau acara belum tersimpan.
2. Pojok kanan bawah menampilkan **Reconnecting…**? → masalah jaringan laptop atau API. Coba
   `curl -s https://api.<domain>/health` dari laptop yang sama; kalau gagal di Wi-Fi venue tapi berhasil
   lewat hotspot HP, Wi-Fi venue memblokir domain API → pindah ke hotspot atau nyalakan WARP / 1.1.1.1
   (H-1 butir 9).
3. `curl -s https://api.<domain>/health` → `{"ok":true}`? Kalau tidak:
   `sudo systemctl status nearly-api` dan `journalctl -u nearly-api -n 100`.
4. `curl -s "https://api.<domain>/graf/acara/<eventId>"` → `hitungan.salaman` naik setelah salaman?
   - Tidak naik, tapi salaman di HP berhasil → kedua orang sudah check-in di acara ini? Salaman
     dihitung untuk acara hanya bila **keduanya** check-in dan waktunya di dalam jendela acara. Salaman
     yang terjadi SEBELUM salah satu pihak check-in ikut muncul begitu check-in-nya masuk (layar memuat
     ulang penuh saat hitungan berubah, atau paling lambat tiap 60 detik).
   - Salaman di HP gagal → lihat pesan galat di HP.
5. Relayer masih bersaldo? Periksa saldo dompet relayer di BscScan testnet. Saldo habis = salaman
   dan check-in gagal dengan `chain_error`.
6. Satu orang tidak bisa bersalaman lagi → kuota koneksi harian (30 per orang per hari,
   `DAILY_CONNECTION_QUOTA` di `apps/api/src/handshake-gate.ts`) mungkin habis. Itu perilaku
   yang disengaja, bukan kerusakan.
7. Web memuat tapi graf kosong dan tidak ada **Reconnecting…** → buka DevTools; galat CORS berarti
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

---

## 8. iPhone — TestFlight (tahap 2, spec distribusi §7)

Belum dijalankan. Prasyarat: **Apple Developer Program** ($99/tahun) atas nama pemilik. Tidak perlu
Xcode: EAS membangun di cloud dan membuat sertifikat, profil provisioning, dan kunci APNs push.

1. Env `production`: ulangi bagian 3.2 dengan `--environment production` (API dan alamat kontrak yang
   sama). Push iOS lewat APNs tidak memakai `google-services.json`.
2. `eas build -p ios --profile production` — pertama kali, login Apple ID dan biarkan EAS membuat
   kredensial (termasuk kunci push).
3. `eas submit -p ios --latest` — pilih/buat app di App Store Connect saat ditanya.
4. App Store Connect → TestFlight → **External Testing** → grup baru → tambahkan build → isi
   informasi uji → kirim ke **Beta App Review** (±1–2 hari, sekali per versi).
5. Setelah disetujui: aktifkan **Public Link**, taruh di landing menggantikan "iPhone: coming soon".
6. Pembaruan JS: `eas update --channel production --environment production --message "…"`.

