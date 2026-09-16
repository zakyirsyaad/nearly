/**
 * Klien `GET /graf/*` (spec 6 §4). Tanpa pustaka: tiga endpoint GET tidak
 * butuh satu.
 *
 * Tidak ada header selain `Accept` — header itu termasuk daftar aman CORS,
 * jadi browser tidak mengirim preflight OPTIONS untuk setiap polling.
 */

export type SimpulApi = { address: string; displayName: string; tierLabel: string };
export type SisiApi = { id: number; a: string; b: string; atMs: number; txHash: string };
export type HalamanGraf = { simpul: SimpulApi[]; sisi: SisiApi[]; kursor: number; lengkap: boolean };
export type AcaraApi = { eventId: string; title: string; startsAt: number; endsAt: number; live: boolean };
export type HitunganAcara = { hadir: number; salaman: number };
export type HalamanAcara = HalamanGraf & { acara: AcaraApi; hitungan: HitunganAcara };

/** Batas waktu setiap permintaan (spec 6 §5). */
export const BATAS_WAKTU_MS = 10_000;

export class GalatApi extends Error {
  constructor(
    readonly status: number | null,
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatApi";
  }
}

/** `VITE_API_URL` tanpa garis miring penutup. Kosong = origin yang sama (proxy dev Vite). */
export function basisApi(nilai: string | undefined): string {
  return (nilai ?? "").trim().replace(/\/+$/, "");
}

/**
 * Build produksi tanpa `VITE_API_URL` tidak punya proxy Vite: permintaan jatuh
 * ke Vercel sendiri, rewrite mengembalikan `index.html`, JSON gagal diurai,
 * dan layar menampilkan "Reconnecting…" selamanya — tak bisa dibedakan dari API
 * yang mati. Keadaan itu dideteksi di sini supaya layar bisa mengatakannya.
 */
export function apiBelumDiatur(nilai: string | undefined, produksi: boolean): boolean {
  return produksi && basisApi(nilai) === "";
}

export function urlGraf(basis: string, jalur: string, sejakId?: number): string {
  return sejakId === undefined ? `${basis}${jalur}` : `${basis}${jalur}?sejakId=${sejakId}`;
}

function angka(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Respons yang bentuknya salah ditolak di sini, bukan meledak di kanvas. */
export function pastikanHalaman(x: unknown): HalamanGraf {
  const h = x as Partial<HalamanGraf> | null;
  if (
    !h || !Array.isArray(h.simpul) || !Array.isArray(h.sisi)
    || !angka(h.kursor) || typeof h.lengkap !== "boolean"
    || !h.sisi.every((s) => s && angka(s.id) && typeof s.a === "string" && typeof s.b === "string")
    || !h.simpul.every((s) => s && typeof s.address === "string")
  ) {
    throw new GalatApi(null, "bentuk_tidak_sah", "respons graf tidak berbentuk halaman");
  }
  return h as HalamanGraf;
}

export type KlienGraf = {
  jaringan(sejakId: number): Promise<HalamanGraf>;
  acara(eventId: string, sejakId: number): Promise<HalamanAcara>;
  daftarAcara(): Promise<AcaraApi[]>;
};

type Ambil = (url: string, init: RequestInit) => Promise<Response>;

export function buatKlienGraf(
  basis: string,
  ambil: Ambil = (url, init) => fetch(url, init),
  batasMs = BATAS_WAKTU_MS,
): KlienGraf {
  async function getJson(url: string): Promise<unknown> {
    const kendali = new AbortController();
    const pewaktu = setTimeout(() => kendali.abort(), batasMs);
    try {
      const res = await ambil(url, { signal: kendali.signal, headers: { Accept: "application/json" } });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const kode = (body as { code?: unknown } | null)?.code;
        throw new GalatApi(res.status, typeof kode === "string" ? kode : "http", `HTTP ${res.status}`);
      }
      return body;
    } catch (e) {
      if (e instanceof GalatApi) throw e;
      throw new GalatApi(null, kendali.signal.aborted ? "batas_waktu" : "jaringan", String(e));
    } finally {
      clearTimeout(pewaktu);
    }
  }

  return {
    async jaringan(sejakId) {
      return pastikanHalaman(await getJson(urlGraf(basis, "/graf/jaringan", sejakId)));
    },
    async acara(eventId, sejakId) {
      const body = await getJson(urlGraf(basis, `/graf/acara/${eventId}`, sejakId));
      const h = pastikanHalaman(body) as HalamanAcara;
      if (!h.acara || !h.hitungan || !angka(h.hitungan.hadir) || !angka(h.hitungan.salaman)) {
        throw new GalatApi(null, "bentuk_tidak_sah", "respons acara tanpa acara atau hitungan");
      }
      return h;
    },
    async daftarAcara() {
      const body = (await getJson(urlGraf(basis, "/graf/acara"))) as { acara?: unknown } | null;
      if (!body || !Array.isArray(body.acara)) {
        throw new GalatApi(null, "bentuk_tidak_sah", "respons daftar acara tidak sah");
      }
      return body.acara as AcaraApi[];
    },
  };
}
