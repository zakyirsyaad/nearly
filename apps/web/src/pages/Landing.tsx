import { CHAIN_ID, KONTRAK, tautanBscScan } from "../kontrak";
import { tautanApk } from "../unduhan";

/**
 * Landing page (spec 6 §6.4). Bahasa Inggris.
 *
 * ATURAN SALINAN: setiap klaim harus bisa ditunjuk ke spec. Rujukannya ditulis
 * di komentar tepat di atas setiap blok — "induk" = 2026-09-03-nearly-design.md,
 * "fase 6" = 2026-09-14-nearly-fase-6-demo-design.md. Tidak ada angka
 * pengguna, testimoni, logo mitra, atau analitik. Klaim baru tanpa rujukan
 * tidak boleh masuk.
 *
 * TAMPILAN: palet disalin dari aplikasi (gaya.css :root). Di bawah hero tidak
 * ada kartu — hanya tipografi, baris bergaris, dan satu diagram graf.
 */
export function Landing({ apkUrl = tautanApk() }: { apkUrl?: string | null } = {}) {
  return (
    <main className="landing">
      <header className="bar">
        <div className="wadah">
          <p className="merek"><span aria-hidden="true">n</span>Nearly</p>
          <nav>
            <a href="#cara">How it works</a>
            <a href="#fitur">Features</a>
            <a href="#trust">Trust</a>
            <a href="#onchain">On-chain</a>
            <a href="https://github.com/zakyirsyaad/nearly" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <a className="tombol-utama" href={apkUrl ?? "/live"}>
            {apkUrl ? "Download" : "Live graph"}
          </a>
        </div>
      </header>

      {/* induk §2 (aturan inti), fase 6 §6.4 butir 1 */}
      <section className="hero">
        <div className="wadah">
          <h1>Connections you can only make in person.</h1>
          <p className="lead">
            Nearly is a social graph with one rule: a connection cannot be made remotely. No follows,
            no friend requests. The only way into someone&apos;s network is to stand next to them and
            both confirm.
          </p>
          <p className="aksi">
            {apkUrl && <a className="tombol-utama" href={apkUrl}>Download for Android</a>}
            <a className="tombol-kedua" href="/live">See the live graph</a>
          </p>
          {/* fase 6 §6.4 butir 2 (chain), distribusi D1 (iPhone menyusul), lisensi repo */}
          <p className="meta">
            <span>BNB Smart Chain testnet</span>
            <span aria-hidden="true">·</span>
            <span>Open source, MIT</span>
            <span aria-hidden="true">·</span>
            <span>iPhone: coming soon</span>
          </p>
        </div>
      </section>

      {/* distribusi D1, D4, D10; "stays on your phone" = spec dompet 2026-09-17
          (dompet dibuat dan disimpan di HP) */}
      {apkUrl && (
        <section className="unduh pita">
          <div className="wadah dua-kolom">
            <div>
              <h2>Get the app</h2>
              {/* distribusi D1 & D4: APK diunduh langsung dari VPS, bukan lewat toko aplikasi */}
              <p className="judul-samping">
                Android, straight from this page — no store account needed.
              </p>
              <p className="catatan">iPhone: coming soon.</p>
            </div>
            <ol>
              <li>Open the downloaded file on your Android phone.</li>
              <li>If Android asks, allow installing apps from this source.</li>
              <li>Open Nearly and create your wallet. It stays on your phone.</li>
            </ol>
          </div>
        </section>
      )}

      {/* induk §2 — aturan inti, kalimat yang sama dengan lead di atas */}
      <section className="aturan">
        <div className="wadah">
          <p>A connection cannot be made <em>remotely</em>.</p>
          <p>Stand next to someone. Both confirm. That is the only way in.</p>
        </div>
      </section>

      {/* induk §7.1 (QR 30 detik, verifikasi ko-lokasi, on-chain lewat relayer), §9.4 (satu
          koneksi per pasangan); fase 6 §1 dan §6.4 butir 2 (BNB Smart Chain testnet) */}
      <section id="cara" className="pita">
        <div className="wadah">
        <h2>How it works</h2>
        <ol className="langkah">
          <li>
            <p className="nomor" aria-hidden="true">1</p>
            <h3>Meet</h3>
            <p>You are in the same room as someone. That is the only starting point Nearly accepts.</p>
          </li>
          <li>
            <p className="nomor" aria-hidden="true">2</p>
            <h3>Scan</h3>
            <p>One phone shows a signed QR code that rotates every 30 seconds. The other phone scans it.</p>
          </li>
          <li>
            <p className="nomor" aria-hidden="true">3</p>
            <h3>Verified, then recorded</h3>
            <p>
              The server checks that both phones were in the same place at the same time. Only then is
              the connection written on-chain, on BNB Smart Chain testnet. One connection per pair of
              people, forever.
            </p>
          </li>
        </ol>
        </div>
      </section>

      {/* Fitur yang ada di aplikasi. Rujukan per butir: induk §7.1 (salaman), spec 3a
          (acara & check-in), spec 4b5 (radar, Terlihat/Tersembunyi), spec 3c (ingin
          bertemu), spec 4c (pesan E2E), spec 3b (feed terbuka, tanpa jalur koneksi),
          induk §7.3 (vouch revocable & slashable), spec dompet 2026-09-17 (12 kata di HP).
          Tidak ada fitur yang belum ada di aplikasi. */}
      <section id="fitur">
        <div className="wadah">
          <h2>Inside the app</h2>
          <ul className="fitur">
            <li>
              <h3>Handshake <small>the one rule</small></h3>
              <p>A signed QR code that rotates every 30 seconds, plus a co-location check.</p>
            </li>
            <li>
              <h3>Events</h3>
              <p>
                Create an event, RSVP, and check in at the door by scanning the host&apos;s QR code.
                Check-ins inside the venue become proof of attendance on-chain.
              </p>
            </li>
            <li>
              <h3>Radar</h3>
              <p>
                At an event, see who is here right now — a list, never a map, with no distance and no
                direction. One Visible or Hidden switch for your whole account.
              </p>
            </li>
            <li>
              <h3>Want to meet</h3>
              <p>
                Mark someone you have not met yet. When you both mark each other, you are revealed to
                each other, and an event shows how many of your matches are coming.
              </p>
            </li>
            <li>
              <h3>Messages</h3>
              <p>
                End-to-end encrypted, and only between people who have actually met. Push
                notifications never carry the message itself.
              </p>
            </li>
            <li>
              <h3>Feed</h3>
              <p>
                Anyone with a wallet can post. There is no way to connect with or message someone
                from the feed — meeting is still the only path.
              </p>
            </li>
            <li>
              <h3>Vouches and tags</h3>
              <p>Between people who have met — revocable, and slashable.</p>
            </li>
            <li>
              <h3>Your wallet <small>on your phone</small></h3>
              <p>
                Created on first launch and backed up with a 12-word recovery phrase. Keys never
                leave the device; the relayer pays the gas.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* induk §7.2 dan §8 (PageRank dari seed, diversitas, sybil terisolasi, tier + bukti),
          §9.1 (akun ganda mengencerkan), §14 butir 2 (seed = penyelenggara). Diagram di bawah
          menggambarkan §8 — simpul seed, jaringan yang terhubung, dan gumpalan tanpa jalur. */}
      <section id="trust">
        <div className="wadah">
        <h2>Trust comes from the graph</h2>
        <div className="trust-isi">
        <div>
        <p className="sorot">Nobody rates anybody. Trust is the shape of who you have really met.</p>
        <p className="rincian">
          Trust is computed with personalized PageRank seeded from a small set of trusted accounts,
          such as event organizers. Meeting people across many events and over time weighs more than
          meeting many people in one room in one hour. A cluster of accounts that only connect to each
          other has no path to the trusted seed, so its trust stays near zero — extra accounts dilute
          trust instead of multiplying it. People see a tier alongside concrete facts: connections,
          events, regions, and vouches.
        </p>
        </div>
        <div>
        <svg
          className="graf"
          viewBox="0 0 640 210"
          role="img"
          aria-label="A trusted seed account connects to people met across events, while a cluster of accounts that only connect to each other has no path to the seed."
        >
          <g className="graf-sisi">
            <line x1="120" y1="100" x2="210" y2="58" />
            <line x1="120" y1="100" x2="212" y2="140" />
            <line x1="120" y1="100" x2="196" y2="100" />
            <line x1="210" y1="58" x2="300" y2="40" />
            <line x1="196" y1="100" x2="300" y2="40" />
            <line x1="196" y1="100" x2="304" y2="118" />
            <line x1="212" y1="140" x2="304" y2="118" />
            <line x1="304" y1="118" x2="386" y2="86" />
            <line x1="300" y1="40" x2="386" y2="86" />
            <line x1="516" y1="52" x2="572" y2="92" />
            <line x1="516" y1="52" x2="500" y2="120" />
            <line x1="572" y1="92" x2="500" y2="120" />
          </g>
          <circle className="graf-seed" cx="120" cy="100" r="11" />
          <g className="graf-simpul">
            <circle cx="210" cy="58" r="6" />
            <circle cx="196" cy="100" r="6" />
            <circle cx="212" cy="140" r="6" />
            <circle cx="300" cy="40" r="6" />
            <circle cx="304" cy="118" r="6" />
            <circle cx="386" cy="86" r="6" />
          </g>
          <g className="graf-palsu">
            <circle cx="516" cy="52" r="5" />
            <circle cx="572" cy="92" r="5" />
            <circle cx="500" cy="120" r="5" />
          </g>
        </svg>
        {/* Legenda di luar SVG: teks SVG ikut mengecil di layar ponsel sampai tak terbaca.
            Warna selalu berpasangan dengan label. */}
        <ul className="legenda">
          <li><span className="titik-seed" aria-hidden="true" />Trusted seed, such as an event organizer</li>
          <li><span className="titik-palsu" aria-hidden="true" />Accounts that only connect to each other — no path, trust stays near zero</li>
        </ul>
        </div>
        </div>
        </div>
      </section>

      {/* induk §6 prinsip 2 dan 3 (tanpa peta orang, identitas asli tidak publik), §7.5 (pesan
          E2E hanya antar yang pernah bertemu, batas metadata server); fase 6 §6.4 butir 4 (lokasi
          kasar saja) */}
      <section className="pita">
        <div className="wadah dua-kolom">
        <div>
          <h2>Privacy by design</h2>
          {/* induk §7.1 (verifikasi ko-lokasi) + §6 prinsip 2 (tanpa peta orang) */}
          <p className="judul-samping">
            The graph needs to know that two people stood in the same place — nothing more.
          </p>
        </div>
        <ul className="privasi">
          <li>
            <Silang />
            <p>
              <strong>No map of people.</strong> <span>Nearly never shows people as pins on a map.</span>
            </p>
          </li>
          <li>
            <Centang />
            <p>
              <strong>Coarse location only.</strong>{" "}
              <span>Handshakes are checked against a coarse location cell, not precise GPS coordinates.</span>
            </p>
          </li>
          <li>
            <Centang />
            <p>
              <strong>End-to-end encrypted messages</strong>{" "}
              <span>
                — and only between people who have actually met. The relay stores ciphertext; it can
                still see who messages whom, and when.
              </span>
            </p>
          </li>
          <li>
            <Silang />
            <p>
              <strong>Your real identity is never public.</strong> <span>You can stay pseudonymous.</span>
            </p>
          </li>
        </ul>
        </div>
      </section>

      {/* induk §9.3 dan §14 butir 4 ("jangan pernah mengklaim lebih dari ini"), §9.1 (sybil
          dideteksi, tidak dicegah), §9.5 (wallet dijual), §9.6 dan §14 butir 1 (GPS), §10.3 dan
          §14 butir 3 (graf publik; catatan 2026-09-17 di §10.3: skor TIDAK bisa dihitung ulang dari
          data publik sejak blokir privat dan seed off-chain, spec 4a §2); fase 6 §6.4 butir 5 —
          bagian ini WAJIB ada */}
      <section className="batas">
        <div className="wadah">
        <h2>What Nearly does not claim</h2>
        <p>
          Nearly proves that a real human showed up. It does not prove that they are a good person.
        </p>
        <ul>
          <li>
            <strong>Multi-device sybils are detected, not prevented.</strong> One person with several
            real phones can still create several accounts; co-location fingerprints and the diversity
            factor make that pattern visible and weaker.
          </li>
          <li>
            <strong>Location can be spoofed and is imprecise indoors.</strong> Short-lived QR codes and
            a tight time window raise the cost of faking a meeting; they do not make it impossible.
          </li>
          <li>
            <strong>A wallet with a good reputation can be sold.</strong> No soulbound system can fully
            stop that, including this one.
          </li>
          <li>
            <strong>The connection graph is public.</strong> Anyone can see that two addresses met, and
            verify every connection on-chain. Trust scores are computed by our server and use some
            private inputs, so they cannot be fully reproduced from public data alone.
          </li>
        </ul>
        </div>
      </section>

      {/* fase 6 §6.4 butir 6; alamat dari src/kontrak.ts, peran dari induk §10.3 */}
      <section id="onchain">
        <div className="wadah">
        <h2>On-chain</h2>
        <p className="rincian">BNB Smart Chain testnet (chainId {CHAIN_ID}).</p>
        <ul className="kontrak">
          {KONTRAK.map((k) => (
            <li key={k.nama}>
              <a href={tautanBscScan(k.alamat)} target="_blank" rel="noreferrer">
                <span>
                  <span className="kontrak-nama">{k.nama}</span>
                  <span className="kontrak-peran">{k.peran}</span>
                </span>
                <span className="kontrak-alamat">{k.alamat}</span>
              </a>
            </li>
          ))}
        </ul>
        </div>
      </section>

      {/* induk §2 — ajakan penutup memakai kalimat utama yang sama */}
      <section className="penutup">
        <div className="wadah">
          <p>Connections you can only make in person.</p>
          <p className="aksi">
            {apkUrl && <a className="tombol-utama" href={apkUrl}>Download for Android</a>}
            <a className="tombol-kedua" href="/live">See the live graph</a>
          </p>
        </div>
      </section>

      <footer>
        <div className="wadah kaki">
          <p className="merek"><span aria-hidden="true">n</span>Nearly · testnet demo</p>
          <nav>
            <a href="/live">Live graph</a>
            {apkUrl && <a href={apkUrl}>Download APK</a>}
            <a href="https://github.com/zakyirsyaad/nearly" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/** Penanda privasi: ikon SELALU berdampingan dengan teksnya, tidak pernah sendirian. */
function Centang() {
  return (
    <svg className="ya" viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden="true">
      <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Silang() {
  return (
    <svg className="tidak" viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
