import { vi } from "vitest";
import type { Address, Hex } from "viem";
import type { AcaraRingkas, PertemuanStore, RadarStore } from "../../src/ports";

/**
 * Dunia riwayat pertemuan di memori: `connections` (dengan waktu dan sel),
 * `events`, `checkins`, dan `vouches` sebagai struktur data, dengan
 * PertemuanStore dan `terhubungDengan` yang membacanya SUNGGUHAN.
 */
export function duniaPertemuan(awal: {
  koneksi?: { a: Address; b: Address; atMs: number; cell?: string | null }[];
  acara?: AcaraRingkas[];
  checkIn?: { eventId: Hex; address: Address }[];
  vouch?: { from: Address; to: Address; dicabut?: boolean }[];
} = {}) {
  const kecil = (x: string) => x.toLowerCase();
  const pasangan = (x: string, y: string) => [kecil(x), kecil(y)].sort().join("|");
  const koneksi = new Map((awal.koneksi ?? []).map((k) => [pasangan(k.a, k.b), { atMs: k.atMs, cell: k.cell ?? null }]));
  const acara = awal.acara ?? [];
  const hadir = new Set((awal.checkIn ?? []).map((c) => `${kecil(c.eventId)}|${kecil(c.address)}`));
  const vouch = awal.vouch ?? [];

  const pertemuan: PertemuanStore = {
    koneksiPasangan: vi.fn(async (x: Address, y: Address) => koneksi.get(pasangan(x, y)) ?? null),
    acaraCheckInBersama: vi.fn(async (x: Address, y: Address) => acara.filter((e) =>
      hadir.has(`${kecil(e.eventId)}|${kecil(x)}`) && hadir.has(`${kecil(e.eventId)}|${kecil(y)}`))),
    penjaminAktif: vi.fn(async (to: Address) => vouch
      .filter((v) => kecil(v.to) === kecil(to) && !v.dicabut)
      .map((v) => kecil(v.from) as Address)),
  };

  const radar: Pick<RadarStore, "terhubungDengan"> = {
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => k !== kecil(who) && koneksi.has(pasangan(who, k))))),
  };

  return { pertemuan, radar };
}
