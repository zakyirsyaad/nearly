import { CONFIG } from "./config";

export class ApiError extends Error {
  constructor(public code: string, public status: number, public reason?: string) {
    super(`${code}${reason ? ` (${reason})` : ""}`);
  }
}

/**
 * Batas tunggu satu permintaan. Tanpa ini, server yang diam — API mati, IP LAN
 * di EXPO_PUBLIC_API_URL basi, iPhone di Wi-Fi lain — membuat layar berputar
 * selamanya karena fetch React Native tidak punya batas waktu sendiri.
 * Relayer mengirim transaksi tanpa menunggu receipt, jadi rute on-chain pun
 * biasanya menjawab jauh di bawah angka ini.
 */
export const BATAS_WAKTU_MS = 15_000;

/**
 * Kode galat sisi klien: server tidak menjawab dalam batas waktu, atau
 * jaringannya gagal sebelum ada respons. Status 0 karena memang tidak ada
 * respons HTTP.
 */
export const SERVER_TAK_TERJANGKAU = "server_tak_terjangkau";

/**
 * fetch yang dibatalkan setelah `batasWaktuMs`, dan yang menerjemahkan
 * kegagalan jaringan menjadi ApiError supaya layar bisa menampilkan kalimat
 * yang bisa ditindaklanjuti — bukan "Gagal dimuat" atau spinner abadi.
 *
 * Pemanggil tidak boleh mengirim `signal` sendiri: signal milik batas waktu
 * akan menimpanya. Belum ada pemanggil yang butuh keduanya.
 */
export async function fetchDenganBatas(
  url: string, init: RequestInit | undefined, batasWaktuMs: number,
): Promise<Response> {
  const pengendali = new AbortController();
  const penghitung = setTimeout(() => pengendali.abort(), batasWaktuMs);
  try {
    return await fetch(url, { ...init, signal: pengendali.signal });
  } catch {
    // AbortError (batas waktu) dan TypeError("Network request failed") sama
    // artinya bagi pengguna: server tidak bisa dihubungi dari sini.
    throw new ApiError(SERVER_TAK_TERJANGKAU, 0);
  } finally {
    clearTimeout(penghitung);
  }
}

/**
 * Satu-satunya klien HTTP aplikasi ini. Sebelum berkas ini ada, api.ts dan
 * events-api.ts memelihara salinan yang nyaris identik — dan feed akan
 * menjadi yang ketiga.
 */
export async function req<T>(
  path: string, init?: RequestInit, batasWaktuMs = BATAS_WAKTU_MS,
): Promise<T> {
  const res = await fetchDenganBatas(`${CONFIG.apiUrl}${path}`, init, batasWaktuMs);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "unknown",
      res.status,
      typeof json.reason === "string" ? json.reason : undefined,
    );
  }
  return json as T;
}

export function postJson<T>(
  path: string, body: unknown, batasWaktuMs = BATAS_WAKTU_MS,
): Promise<T> {
  return req<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, batasWaktuMs);
}
