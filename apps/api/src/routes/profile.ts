import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import { recoverLihatProfilSigner } from "@nearly/shared";
import type { BlokirStore, GateDeps, MeetStore } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

type ProfileMeetDeps = {
  meet: MeetStore;
  blokir: BlokirStore;
  verifyingContract: Address;
  nowMs: () => number;
};

/**
 * Mengembalikan alamat pemanggil HANYA kalau bukti LihatProfil-nya sah untuk
 * `target` ini. Selain itu null.
 *
 * Tanda tangan cacat BUKAN galat (spec §5.1): rute profil tidak boleh gagal
 * untuk orang asing yang membuka tautan. Yang terjadi hanya bendera tidak
 * keluar. Ini sengaja berbeda dari GET /kecocokan yang menolak 403 — di sana
 * yang dikembalikan adalah identitas orang lain.
 *
 * Tipe LihatProfil, BUKAN InginBertemu: yang kedua adalah perintah TULIS.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, target: Address, deps: ProfileMeetDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  // Lewat pulihkanTandaTangan: tanda tangan yang cacat bentuknya membuat viem
  // melempar. Itu tetap "tidak terbukti", bukan 500.
  const signer = await pulihkanTandaTangan(() => recoverLihatProfilSigner(
      { target, who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== who.toLowerCase()) return null;
  return who.toLowerCase() as Address;
}

export function profileRoutes(deps: GateDeps & ProfileMeetDeps) {
  const r = new Hono();

  r.get("/connections/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);
    const addr = raw.toLowerCase() as Address;
    return c.json({ connections: await deps.profiles.listConnections(addr, 100) });
  });

  // Jawaban ya/tidak untuk "apakah A dan B sudah terkoneksi", dipakai layar
  // profil mobile untuk memutuskan apakah tombol Vouch muncul. Sengaja BUKAN
  // menarik daftar koneksi (GET /connections/:address dibatasi 100 terbaru) —
  // pasangan yang sudah terkoneksi tapi di luar 100 terbaru harus tetap benar.
  r.get("/connected/:a/:b", async (c) => {
    const rawA = c.req.param("a");
    const rawB = c.req.param("b");
    if (!isAddress(rawA) || !isAddress(rawB)) return c.json({ code: "invalid_address" }, 400);
    const connected = await deps.store.areConnected(
      rawA.toLowerCase() as Address,
      rawB.toLowerCase() as Address,
    );
    return c.json({ connected });
  });

  r.get("/profile/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);
    const addr = raw.toLowerCase() as Address;

    // Profil tidak boleh ikut mati kalau RPC mainnet atau opBNB sedang tersendat.
    // Anon tanpa ENS adalah keadaan NORMAL, bukan kesalahan.
    const [displayName, ens, txCount, connectionCount] = await Promise.all([
      deps.profiles.getDisplayName(addr).catch(() => ""),
      deps.identity.ensName(addr).catch(() => null),
      deps.identity.txCount(addr).catch(() => 0),
      deps.profiles.countConnections(addr).catch(() => 0),
    ]);

    // Angka publik (spec induk §7.6): keluar tanpa bukti apa pun — TAPI hanya
    // kalau store benar-benar menjawab.
    //
    // Sengaja BUKAN `.catch(() => 0)` seperti tiga panggilan di atas. Di sana
    // `null`/`0` adalah kebenaran: anon tanpa ENS memang tidak punya nama, dan
    // alamat baru memang punya nol transaksi. Di sini `0` adalah KARANGAN —
    // layar profil mencetaknya sebagai "0 orang ingin bertemu dia", sebuah
    // klaim faktual tentang orang lain yang lahir dari store yang sedang mati.
    // Klien sudah merender ketiadaan kunci ini dengan benar (tidak menampilkan
    // apa-apa), jadi kegagalan menghilangkan kuncinya, bukan memalsukan nol.
    //
    // `himpunanUntuk` DI DALAM rantai yang sama, bukan di-`.catch()` sendiri
    // dengan jatuh ke himpunan kosong: himpunan kosong berarti TIDAK ADA yang
    // disaring, jadi kegagalan store blokir akan membuat tanda dari orang yang
    // memblokir/diblokir ikut kehitung sebagai angka publik yang SALAH,
    // bukan sekadar angka yang hilang. Satu-satunya keluaran yang jujur saat
    // salah satu store gagal adalah kunci ini hilang sama sekali.
    const inginBertemuCount = await deps.blokir.himpunanUntuk(addr)
      .then((s) => deps.meet.hitungTanda(addr, [...s]))
      .then((n): number | undefined => n)
      .catch(() => undefined);

    const dasar = {
      address: addr, displayName, ens, txCount, connectionCount,
      ...(inginBertemuCount !== undefined ? { inginBertemuCount } : {}),
    };

    const pemanggil = await pemanggilTerbukti(c.req.query(), addr, deps);
    if (!pemanggil) return c.json(dasar);

    // Satu pembacaan himpunan blokir pemanggil, dipakai KEDUA bendera di
    // bawah. Beda dari angka publik di atas: di sini kegagalan boleh keluar
    // sebagai 500 — pemanggil sudah membuktikan dirinya, jadi tidak ada
    // orang asing yang menerima jawaban yang dikarang untuknya.
    const kecuali = [...await deps.blokir.himpunanUntuk(pemanggil)];
    // `sudahKublokir` diambil DALAM Promise.all yang sama dengan dua bendera
    // di atas — bukan sequential round-trip tambahan. `adaBlokir` hanya satu
    // arah ("apakah blocker memblokir blocked"), jadi urutan argumennya di
    // sini menentukan: (pemanggil, addr) berarti "apakah AKU memblokir DIA".
    // Kalau dibalik, korban blokir sepihak (dia memblokir aku, bukan aku dia)
    // akan salah melihat tombol "Cabut blokir" untuk blokir yang tidak pernah
    // dipasangnya.
    const [sudahKutandai, diaMenandaiku, sudahKublokir] = await Promise.all([
      deps.meet.adaTanda(addr, pemanggil, kecuali),
      deps.meet.adaTanda(pemanggil, addr, kecuali),
      deps.blokir.adaBlokir(pemanggil, addr),
    ]);
    return c.json({
      ...dasar,
      sudahKutandai,
      salingMenandai: sudahKutandai && diaMenandaiku,
      sudahKublokir,
    });
  });

  return r;
}
