import type { Address, Hex } from "viem";
import { isInsideGeofence } from "@nearly/shared";
import type { AcaraRingkas, KoneksiPasangan, PertemuanStore, RadarStore } from "./ports";

/** Spec desain UI §8.1: acaraBersama paling banyak 10, terbaru dulu. */
export const MAKS_ACARA_BERSAMA = 10;

export type AcaraPertemuan = { eventId: Hex; title: string; venueLabel: string };

/**
 * Riwayat pertemuan pemanggil dengan orang yang profilnya dibuka (§8.1).
 * `acaraBersama[].startsAt` = detik unix sebagai string (Ruling A16).
 */
export type Pertemuan = {
  salaman: { atMs: number; acara: AcaraPertemuan | null };
  acaraBersama: (AcaraPertemuan & { startsAt: string })[];
  jumlahAcaraBersama: number;
};

const kecil = (a: string) => a.toLowerCase();
const terbaruDulu = (a: AcaraRingkas, b: AcaraRingkas) =>
  (b.startsAt - a.startsAt) || a.eventId.localeCompare(b.eventId);

/**
 * Acara tempat salaman terjadi: salah satu acara yang KEDUANYA check-in, yang
 * jendelanya [startsAt, endsAt] memuat waktu koneksi, dan — bila sel koneksi
 * ada — geofence-nya memuat sel itu. Lebih dari satu → startsAt terbaru.
 */
export function acaraSalaman(koneksi: KoneksiPasangan, bersama: AcaraRingkas[]): AcaraRingkas | null {
  const cocok = bersama.filter((a) =>
    koneksi.atMs >= a.startsAt * 1000
    && koneksi.atMs <= a.endsAt * 1000
    && (koneksi.cell === null || isInsideGeofence(a.centerCell, koneksi.cell)));
  return [...cocok].sort(terbaruDulu)[0] ?? null;
}

/**
 * Murni. Dibangun kunci demi kunci — `centerCell`, `endsAt`, sel koneksi, tx
 * hash, dan host tidak pernah ikut (aturan bersama §8 #1, #3).
 */
export function susunPertemuan(koneksi: KoneksiPasangan, bersama: AcaraRingkas[]): Pertemuan {
  const di = acaraSalaman(koneksi, bersama);
  const lain = bersama.filter((a) => a.eventId !== di?.eventId).sort(terbaruDulu);
  return {
    salaman: {
      atMs: koneksi.atMs,
      acara: di ? { eventId: di.eventId, title: di.title, venueLabel: di.venueLabel } : null,
    },
    acaraBersama: lain.slice(0, MAKS_ACARA_BERSAMA).map((a) => ({
      eventId: a.eventId,
      title: a.title,
      venueLabel: a.venueLabel,
      startsAt: String(a.startsAt),
    })),
    jumlahAcaraBersama: lain.length,
  };
}

/**
 * null bila pemanggil membuka profilnya sendiri atau keduanya tidak
 * terkoneksi — co-kehadiran tanpa salaman BUKAN pertemuan (§8.1). Blokir dan
 * visibilitas tidak berpengaruh: ini riwayat pemanggil sendiri, dan salaman +
 * check-in sudah publik on-chain.
 */
export async function bacaPertemuan(
  pemanggil: Address, addr: Address, store: PertemuanStore,
): Promise<Pertemuan | null> {
  if (kecil(pemanggil) === kecil(addr)) return null;
  const koneksi = await store.koneksiPasangan(pemanggil, addr);
  if (!koneksi) return null;
  return susunPertemuan(koneksi, await store.acaraCheckInBersama(pemanggil, addr));
}

/**
 * Jumlah penjamin AKTIF `addr` yang terkoneksi dengan pemanggil, tanpa
 * pemanggil sendiri, `addr` sendiri, dan setiap alamat yang DIBLOKIR pemanggil
 * (`kecuali`, satu arah — keputusan pemilik 2026-09-18: menyaring orang yang
 * memblokir pemanggil membuat angka ini oracle blokir, karena graf vouch dan
 * koneksi publik). Hanya angka — siapa penjaminnya tidak pernah keluar.
 */
export async function hitungDijaminKenalan(
  pemanggil: Address,
  addr: Address,
  kecuali: ReadonlySet<string>,
  deps: { pertemuan: Pick<PertemuanStore, "penjaminAktif">; radar: Pick<RadarStore, "terhubungDengan"> },
): Promise<number> {
  const aku = kecil(pemanggil);
  const dia = kecil(addr);
  const penjamin = [...new Set((await deps.pertemuan.penjaminAktif(addr)).map(kecil))]
    .filter((p) => p !== aku && p !== dia && !kecuali.has(p)) as Address[];
  if (penjamin.length === 0) return 0;
  return (await deps.radar.terhubungDengan(pemanggil, penjamin)).size;
}
