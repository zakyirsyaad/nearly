import { CHAIN_ID, KONTRAK, tautanBscScan } from "../kontrak";

/**
 * Landing page (spec 6 §6.4). Bahasa Inggris.
 *
 * ATURAN SALINAN: setiap klaim harus bisa ditunjuk ke spec. Rujukannya ditulis
 * di komentar tepat di atas setiap blok — "induk" = 2026-09-03-nearly-design.md,
 * "fase 6" = 2026-09-14-nearly-fase-6-demo-design.md. Tidak ada angka
 * pengguna, testimoni, logo mitra, atau analitik. Klaim baru tanpa rujukan
 * tidak boleh masuk.
 */
export function Landing() {
  return (
    <main className="landing">
      {/* induk §2 (aturan inti), fase 6 §6.4 butir 1 */}
      <section className="hero">
        <p className="merek">Nearly</p>
        <h1>Connections you can only make in person.</h1>
        <p className="lead">
          Nearly is a social graph with one rule: a connection cannot be made remotely. No follows,
          no friend requests. The only way into someone&apos;s network is to stand next to them and
          both confirm.
        </p>
        <a className="tombol-utama" href="/live">See the live graph</a>
      </section>

      {/* induk §7.1 (QR 30 detik, verifikasi ko-lokasi, on-chain lewat relayer), §9.4 (satu
          koneksi per pasangan); fase 6 §1 dan §6.4 butir 2 (BNB Smart Chain testnet) */}
      <section>
        <h2>How it works</h2>
        <ol className="langkah">
          <li>
            <h3>Meet</h3>
            <p>You are in the same room as someone. That is the only starting point Nearly accepts.</p>
          </li>
          <li>
            <h3>Scan</h3>
            <p>One phone shows a signed QR code that rotates every 30 seconds. The other phone scans it.</p>
          </li>
          <li>
            <h3>Verified, then recorded</h3>
            <p>
              The server checks that both phones were in the same place at the same time. Only then is
              the connection written on-chain, on BNB Smart Chain testnet. One connection per pair of
              people, forever.
            </p>
          </li>
        </ol>
      </section>

      {/* induk §7.2 dan §8 (PageRank dari seed, diversitas, sybil terisolasi, tier + bukti),
          §9.1 (akun ganda mengencerkan), §14 butir 2 (seed = penyelenggara) */}
      <section>
        <h2>Trust comes from the graph</h2>
        <p>
          Nobody rates anybody. Trust is computed from where you sit in the graph of real meetings,
          using personalized PageRank seeded from a small set of trusted accounts, such as event
          organizers.
        </p>
        <ul>
          <li>
            <strong>Diversity counts.</strong> Meeting people across many events and over time weighs
            more than meeting many people in one room in one hour.
          </li>
          <li>
            <strong>Fake accounts struggle.</strong> A cluster of accounts that only connect to each
            other has no path to the trusted seed, so its trust stays near zero. Extra accounts dilute
            trust instead of multiplying it.
          </li>
          <li>
            <strong>A tier with evidence, not a bare number.</strong> People see a tier alongside
            concrete facts: connections, events, regions, and vouches.
          </li>
        </ul>
      </section>

      {/* induk §6 prinsip 2 dan 3 (tanpa peta orang, identitas asli tidak publik), §7.5 (pesan
          E2E hanya antar yang pernah bertemu, batas metadata server); fase 6 §6.4 butir 4 (lokasi
          kasar saja) */}
      <section>
        <h2>Privacy by design</h2>
        <ul>
          <li><strong>No map of people.</strong> Nearly never shows people as pins on a map.</li>
          <li>
            <strong>Coarse location only.</strong> Handshakes are checked against a coarse location
            cell, not precise GPS coordinates.
          </li>
          <li>
            <strong>End-to-end encrypted messages</strong>, and only between people who have actually
            met. The relay stores ciphertext; it can still see who messages whom, and when.
          </li>
          <li><strong>Your real identity is never public.</strong> You can stay pseudonymous.</li>
        </ul>
      </section>

      {/* induk §9.3 dan §14 butir 4 ("jangan pernah mengklaim lebih dari ini"), §9.1 (sybil
          dideteksi, tidak dicegah), §9.5 (wallet dijual), §9.6 dan §14 butir 1 (GPS), §10.3 dan
          §14 butir 3 (graf publik; catatan 2026-09-17 di §10.3: skor TIDAK bisa dihitung ulang dari
          data publik sejak blokir privat dan seed off-chain, spec 4a §2); fase 6 §6.4 butir 5 —
          bagian ini WAJIB ada */}
      <section className="batas">
        <h2>What Nearly does not claim</h2>
        <ul>
          <li>
            <strong>Nearly proves that a real human showed up. It does not prove that they are a good
            person.</strong>
          </li>
          <li>
            <strong>Multi-device sybils are detected, not prevented.</strong> One person with several
            real phones can still create several accounts; co-location fingerprints and the diversity
            factor make that pattern visible and weaker.
          </li>
          <li>
            <strong>Location can be spoofed and is imprecise indoors.</strong> Short-lived QR codes and a
            tight time window raise the cost of faking a meeting; they do not make it impossible.
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
      </section>

      {/* fase 6 §6.4 butir 6; alamat dari src/kontrak.ts, peran dari induk §10.3 */}
      <section>
        <h2>On-chain</h2>
        <p>BNB Smart Chain testnet (chainId {CHAIN_ID}).</p>
        <ul className="kontrak">
          {KONTRAK.map((k) => (
            <li key={k.nama}>
              <span className="kontrak-nama">{k.nama}</span>
              <span className="kontrak-peran">{k.peran}</span>
              <a href={tautanBscScan(k.alamat)} target="_blank" rel="noreferrer">
                <code>{k.alamat}</code>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="kaki">
        <p>Nearly · testnet demo</p>
      </footer>
    </main>
  );
}
