import type { Address, Hex } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import type { AcaraGraf, CheckInGraf, KoneksiGraf, ProfilRingkas } from "./ports";

/** Paling banyak sisi per respons (spec 6 §4.2). */
export const BATAS_HALAMAN = 2000;

/** Daftar acara di pemilih `/live`: berakhir paling lama 7 hari lalu (spec 6 §4.3). */
export const JENDELA_DAFTAR_ACARA_DETIK = 7 * 86_400;
export const BATAS_DAFTAR_ACARA = 50;

/**
 * Jendela acara terpanjang yang mau digambar layar graf (spec 6 §4.5).
 * `AttendanceRegistry` hanya memeriksa `endsAt > startsAt`, jadi siapa pun bisa
 * membuat acara bertahun-tahun; tanpa batas ini satu permintaan publik ke
 * `/graf/acara/<id itu>` membaca hampir seluruh `connections` dan `checkins`.
 */
export const BATAS_JENDELA_ACARA_GRAF_DETIK = 7 * 86_400;

/** Batas `Date` JavaScript dalam milidetik; di atasnya `toISOString()` melempar RangeError. */
const DATE_MAKS_MS = 8.64e15;

export type TierLabel = (typeof TIER_LABELS)[number];

export type SimpulPublik = { address: Address; displayName: string; tierLabel: TierLabel };
export type SisiPublik = { id: number; a: Address; b: Address; atMs: number; txHash: Hex };
export type AcaraPublik = { eventId: Hex; title: string; startsAt: number; endsAt: number; live: boolean };

export type HalamanGraf = {
  simpul: SimpulPublik[];
  sisi: SisiPublik[];
  kursor: number;
  lengkap: boolean;
};

export type HalamanAcara = HalamanGraf & {
  acara: AcaraPublik;
  hitungan: { hadir: number; salaman: number };
};

/**
 * Memotong sisi (sudah urut `id` naik, semuanya `id > sejakId`) menjadi satu
 * halaman. `kursor` tidak pernah mundur: halaman kosong mengembalikan
 * `sejakId` apa adanya.
 */
export function potongHalaman(
  urut: KoneksiGraf[], sejakId: number, batas = BATAS_HALAMAN,
): { sisi: KoneksiGraf[]; kursor: number; lengkap: boolean } {
  const sisi = urut.slice(0, batas);
  const terakhir = sisi[sisi.length - 1];
  return { sisi, kursor: terakhir ? terakhir.id : sejakId, lengkap: urut.length <= batas };
}

/** Alamat unik (huruf kecil) yang muncul di sisi, urut kemunculan. */
export function alamatDiSisi(sisi: KoneksiGraf[]): Address[] {
  const unik = new Set<string>();
  for (const s of sisi) {
    unik.add(s.a.toLowerCase());
    unik.add(s.b.toLowerCase());
  }
  return [...unik] as Address[];
}

/** Alamat tanpa snapshot — atau tier di luar rentang — tampil `Baru`. */
export function labelTier(tier: number | undefined): TierLabel {
  return TIER_LABELS[tier ?? 0] ?? TIER_LABELS[0];
}

/**
 * Penyaring kunci JSON, bagian simpul. Setiap medan disebut SATU PER SATU —
 * jangan pernah mengganti ini dengan spread, karena spread adalah cara kolom
 * baru di store diam-diam keluar lewat endpoint publik (spec 6 §4.4).
 */
export function susunSimpul(alamat: Address[], profil: Map<string, ProfilRingkas>): SimpulPublik[] {
  return alamat.map((a) => {
    const p = profil.get(a.toLowerCase());
    return {
      address: a.toLowerCase() as Address,
      displayName: p?.displayName ?? "",
      tierLabel: labelTier(p?.tier),
    };
  });
}

/** Penyaring kunci JSON, bagian sisi. Medan disebut satu per satu, tanpa spread. */
export function keSisiPublik(k: KoneksiGraf): SisiPublik {
  return {
    id: k.id,
    a: k.a.toLowerCase() as Address,
    b: k.b.toLowerCase() as Address,
    atMs: k.atMs,
    txHash: k.txHash,
  };
}

/** Penyaring kunci JSON, bagian acara. Medan disebut satu per satu, tanpa spread. */
export function keAcaraPublik(e: AcaraGraf, nowDetik: number): AcaraPublik {
  return {
    eventId: e.eventId,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    live: e.startsAt <= nowDetik && nowDetik <= e.endsAt,
  };
}

/**
 * ATURAN "SALAMAN DI ACARA INI". WAJIB identik dengan `eventOccasionFor` di
 * apps/api/src/trust/load-graph.ts — dikunci tes graf-konsistensi.test.ts
 * yang menjalankan `rowsToGraph` pada data yang sama.
 *
 * Koneksi milik acara E bila, dan hanya bila:
 *   1. KEDUA alamat check-in di E, dan
 *   2. waktu koneksi di jendela `[startsAt, endsAt]` E (inklusif), dan
 *   3. di antara semua acara yang memenuhi 1 dan 2, `event_id` E yang terkecil
 *      secara leksikografis — pemecah seri trust untuk acara tumpang tindih.
 *
 * Tanpa butir 3, sebuah salaman di dua acara tumpang tindih tampil di layar
 * kedua acara, sementara trust hanya menghitungnya untuk satu. Layar proyektor
 * dan skor lalu menceritakan dua kisah tentang ruangan yang sama.
 */
export function sisiAcara(
  eventId: Hex,
  koneksi: KoneksiGraf[],
  acara: AcaraGraf[],
  checkins: CheckInGraf[],
): KoneksiGraf[] {
  const jendela = new Map<string, { mulaiMs: number; akhirMs: number }>();
  for (const e of acara) {
    jendela.set(e.eventId.toLowerCase(), { mulaiMs: e.startsAt * 1000, akhirMs: e.endsAt * 1000 });
  }

  const hadirDi = new Map<string, Set<string>>();
  for (const c of checkins) {
    const addr = c.address.toLowerCase();
    let s = hadirDi.get(addr);
    if (!s) {
      s = new Set();
      hadirDi.set(addr, s);
    }
    s.add(c.eventId.toLowerCase());
  }

  const target = eventId.toLowerCase();

  function acaraMilik(k: KoneksiGraf): string | null {
    const ea = hadirDi.get(k.a.toLowerCase());
    const eb = hadirDi.get(k.b.toLowerCase());
    if (!ea || !eb) return null;
    const cocok: string[] = [];
    for (const id of ea) {
      if (!eb.has(id)) continue;
      const w = jendela.get(id);
      if (!w) continue;
      if (k.atMs < w.mulaiMs || k.atMs > w.akhirMs) continue;
      cocok.push(id);
    }
    if (cocok.length === 0) return null;
    cocok.sort();
    return cocok[0]!;
  }

  return koneksi
    .filter((k) => acaraMilik(k) === target)
    .sort((x, y) => x.id - y.id);
}

/**
 * Apakah jendela acara boleh dibaca untuk layar graf: bilangan bulat detik yang
 * aman, tidak terbalik, paling lama `BATAS_JENDELA_ACARA_GRAF_DETIK`, dan masih
 * di dalam rentang `Date` — store mengubah `akhir + 1 ms` menjadi ISO, dan
 * RangeError di sana akan menjadi 500 alih-alih jawaban yang jelas.
 */
export function jendelaAcaraDidukung(e: AcaraGraf): boolean {
  return Number.isSafeInteger(e.startsAt) && Number.isSafeInteger(e.endsAt)
    && e.startsAt >= 0 && e.endsAt >= e.startsAt
    && e.endsAt - e.startsAt <= BATAS_JENDELA_ACARA_GRAF_DETIK
    && e.endsAt * 1000 + 1 <= DATE_MAKS_MS;
}

/** Jumlah alamat unik yang check-in di acara `eventId`. */
export function hitungHadir(eventId: Hex, checkins: CheckInGraf[]): number {
  const target = eventId.toLowerCase();
  const unik = new Set<string>();
  for (const c of checkins) {
    if (c.eventId.toLowerCase() === target) unik.add(c.address.toLowerCase());
  }
  return unik.size;
}

/**
 * `sejakId` dari query. Kosong → 0. Selain bilangan bulat ≥ 0 yang aman → null
 * (rute menjawab 400). Dibatasi `Number.MAX_SAFE_INTEGER` karena `id` bigserial
 * dibandingkan sebagai number di seluruh jalur ini.
 */
export function bacaSejakId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 0;
  if (!/^\d{1,16}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** `event_id` sah: 0x + 64 hex. Dinormalkan huruf kecil. */
export function bacaEventId(raw: string): Hex | null {
  return /^0x[0-9a-fA-F]{64}$/.test(raw) ? (raw.toLowerCase() as Hex) : null;
}
