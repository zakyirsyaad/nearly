import { lookup } from "node:dns/promises";
import { isIPv4 } from "node:net";

/**
 * Penjaga SSRF untuk pengambilan URL milik orang lain (2026-09-24).
 *
 * Proksi avatar mengambil URL yang ditulis pemilik nama ENS — sepenuhnya di
 * bawah kendali orang luar. Tanpa penjaga ini, siapa pun bisa mengisi record
 * avatar dengan alamat internal dan memakai API kita sebagai pengintai
 * jaringan dalam. VPS ini menjalankan layanan lain di localhost (API 8787,
 * Lavalink 2333, Python 8080, beberapa kontainer), jadi ancamannya konkret,
 * bukan teoretis.
 */

/** Hanya 443: avatar ENS selalu HTTPS biasa, dan port lain adalah pemindaian. */
export const PORT_DIIZINKAN = "443";

export function ipPrivat(ip: string): boolean {
  const alamat = ip.trim().toLowerCase();

  if (isIPv4(alamat)) {
    const [a = 0, b = 0] = alamat.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;          // privat, loopback, "this host"
    if (a === 172 && b >= 16 && b <= 31) return true;            // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                     // 192.168.0.0/16
    if (a === 169 && b === 254) return true;                     // link-local + metadata cloud
    if (a === 100 && b >= 64 && b <= 127) return true;           // CGNAT 100.64.0.0/10
    if (a >= 224) return true;                                   // multicast & reserved
    return false;
  }

  // IPv6. `::ffff:127.0.0.1` dinilai lewat bagian IPv4-nya.
  const v4 = alamat.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (v4) return ipPrivat(v4);
  if (alamat === "::" || alamat === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(alamat)) return true;            // unique-local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(alamat)) return true;            // link-local fe80::/10
  if (/^ff/.test(alamat)) return true;                           // multicast
  return false;
}

export type HasilHost =
  | { ok: true }
  | { ok: false; alasan: "skema" | "port" | "host" | "ip_privat" | "dns" };

/**
 * `resolve` bisa disuntik supaya tes tidak bergantung pada DNS nyata.
 *
 * SEMUA hasil lookup diperiksa, bukan yang pertama saja: host jahat bisa
 * mengembalikan satu IP publik bersama satu IP internal dan berharap klien
 * memakai yang kedua.
 */
export async function urlAman(
  mentah: string,
  resolve: (host: string) => Promise<string[]> =
    async (host) => (await lookup(host, { all: true })).map((a) => a.address),
): Promise<HasilHost> {
  let url: URL;
  try {
    url = new URL(mentah);
  } catch {
    return { ok: false, alasan: "host" };
  }

  if (url.protocol !== "https:") return { ok: false, alasan: "skema" };
  if ((url.port || PORT_DIIZINKAN) !== PORT_DIIZINKAN) return { ok: false, alasan: "port" };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, alasan: "host" };

  // Host yang SUDAH berupa IP tidak perlu DNS — dan tetap harus publik.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    return ipPrivat(host) ? { ok: false, alasan: "ip_privat" } : { ok: true };
  }

  let ips: string[];
  try {
    ips = await resolve(host);
  } catch {
    return { ok: false, alasan: "dns" };
  }
  if (ips.length === 0) return { ok: false, alasan: "dns" };
  if (ips.some(ipPrivat)) return { ok: false, alasan: "ip_privat" };
  return { ok: true };
}
