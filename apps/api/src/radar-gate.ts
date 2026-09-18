import type { Address, Hex } from "viem";
import { isEventLive, isInsideGeofence } from "@nearly/shared";
import { TIER_LABELS } from "@nearly/trust";
import { buatCacheSingkat } from "./cache-singkat";
import { kecocokanDari } from "./meet-rank";
import type { EventRecord, RadarDeps } from "./ports";

/** "Hadir sekarang": detak dalam 15 menit terakhir (keputusan #1). */
export const JENDELA_HADIR_MS = 15 * 60_000;
/** Detak lebih rapat dari ini ditolak 429 (spec 4b+5 §5.1 langkah 6). */
export const JEDA_DETAK_MIN_MS = 20_000;
export const MAKS_KARTU_RADAR = 200;

export type RadarFailure =
  | { code: "event_not_found"; httpStatus: 404 }
  | { code: "event_tidak_berlangsung"; httpStatus: 409 }
  | { code: "belum_check_in"; httpStatus: 403 }
  | { code: "terlalu_cepat"; httpStatus: 429 }
  | { code: "tersembunyi"; httpStatus: 403 }
  | { code: "belum_hadir"; httpStatus: 403 };

export type RadarResult<T> = { ok: true; value: T } | { ok: false; failure: RadarFailure };

const fail = (failure: RadarFailure): { ok: false; failure: RadarFailure } => ({ ok: false, failure });
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const kecil = (a: string) => a.toLowerCase();

/** Yang dikirim ke HP. Langkah 7 dan 8 BUKAN galat (spec 4b+5 §5.1). */
export type JawabanDetak =
  | { hadir: true }
  | { hadir: false; alasan: "tersembunyi" | "di_luar_area" };

/** `baruHadir` untuk rute saja — TIDAK PERNAH dikirim ke HP. */
export type HasilDetak = { jawaban: JawabanDetak; baruHadir: boolean };

/**
 * Hanya kunci ini. Yang TIDAK PERNAH ada: `cell`, `seen_at`, jumlah detak,
 * jarak, skor trust mentah, dan siapa yang disembunyikan blokir (§5.2).
 */
export type KartuRadar = {
  address: Address;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
  /**
   * Desain UI §8.3: HANYA kartu `pernahBertemu === false`, HANYA bila ≥ 1.
   * Angka saja — tidak pernah daftar, nama, atau alamat koneksi bersama.
   */
  koneksiBersama?: number;
};

/** Radar dipanggil tiap 10 detik per penonton; angka basi sampai 60 detik diterima (§8.3). */
export const UMUR_CACHE_KONEKSI_BERSAMA_MS = 60_000;

export type PenghitungKoneksiBersama = (
  aku: Address, kandidat: Address[], kecuali: readonly string[],
) => Promise<Map<string, number>>;

/**
 * Penghitung ber-cache, dibuat SEKALI per radarRoutes (Ruling A17). Kunci:
 * pemanggil + himpunan kandidat + himpunan blokir — perubahan blokir
 * menghitung ulang seketika.
 */
export function buatPenghitungKoneksiBersama(deps: Pick<RadarDeps, "radar" | "nowMs">): PenghitungKoneksiBersama {
  const cache = buatCacheSingkat<Map<string, number>>(deps.nowMs, UMUR_CACHE_KONEKSI_BERSAMA_MS);
  return (aku, kandidat, kecuali) => {
    const kunci = [
      kecil(aku),
      [...kandidat].map(kecil).sort().join(","),
      [...kecuali].map(kecil).sort().join(","),
    ].join("|");
    return cache.ambil(kunci, () => deps.radar.hitungKoneksiBersama(aku, kandidat, kecuali));
  };
}

export type ResponsRadar = { kartu: KartuRadar[]; jumlah: number };

/**
 * Visibilitas dibaca SAAT permintaan. Alamat yang tidak ada di peta dianggap
 * tersembunyi — gagal tertutup: store yang lupa satu alamat tidak boleh
 * menampilkan orang yang memilih bersembunyi.
 */
async function terlihat(deps: RadarDeps, address: Address): Promise<boolean> {
  const peta = await deps.profilSaya.visibilitasBanyak([address]);
  return peta.get(kecil(address)) === "terlihat";
}

/** Langkah 3–5, bersama untuk detak dan radar. */
async function gerbangAcara(
  eventId: Hex, pemanggil: Address, deps: RadarDeps, nowMs: number,
): Promise<RadarResult<EventRecord>> {
  const ev = await deps.events.getEvent(eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });
  if (!isEventLive(ev.startsAt, ev.endsAt, nowMs)) {
    return fail({ code: "event_tidak_berlangsung", httpStatus: 409 });
  }
  if (!(await deps.events.hasCheckIn(eventId, pemanggil))) {
    return fail({ code: "belum_check_in", httpStatus: 403 });
  }
  return ok(ev);
}

/**
 * `POST /radar/:eventId/detak`, langkah 3–9 (spec 4b+5 §5.1). Langkah 1
 * (sesi) dan 2 (badan) milik rute. Pertama yang gagal menang.
 */
export async function detak(
  pemanggil: Address, eventIdMentah: Hex, cell: string, deps: RadarDeps,
): Promise<RadarResult<HasilDetak>> {
  const now = deps.nowMs();
  const eventId = kecil(eventIdMentah) as Hex;
  const aku = kecil(pemanggil) as Address;

  const acara = await gerbangAcara(eventId, aku, deps, now);
  if (!acara.ok) return acara;

  // Laju dihitung dari `seen_at` baris yang ada — tanpa tabel atau memori tambahan.
  const sebelumnya = await deps.radar.ambilKehadiran(eventId, aku);
  if (sebelumnya && now - sebelumnya.seenAtMs < JEDA_DETAK_MIN_MS) {
    return fail({ code: "terlalu_cepat", httpStatus: 429 });
  }

  // Langkah 7 dan 8 menghapus baris: orang langsung hilang dari radar saat
  // pindah ke Tersembunyi atau keluar area, tanpa menunggu 15 menit.
  if (!(await terlihat(deps, aku))) {
    await deps.radar.hapusKehadiran(eventId, aku);
    return ok({ jawaban: { hadir: false, alasan: "tersembunyi" }, baruHadir: false });
  }
  if (!isInsideGeofence(acara.value.centerCell, cell)) {
    await deps.radar.hapusKehadiran(eventId, aku);
    return ok({ jawaban: { hadir: false, alasan: "di_luar_area" }, baruHadir: false });
  }

  const sudahHadir = sebelumnya !== null && now - sebelumnya.seenAtMs <= JENDELA_HADIR_MS;
  await deps.radar.simpanKehadiran(eventId, aku, cell, now);
  return ok({ jawaban: { hadir: true }, baruHadir: !sudahHadir });
}

/** Saling ingin bertemu → pernah bertemu → tier tertinggi → alamat. */
export function urutkanKartuRadar(
  a: { address: string; tier: number; pernahBertemu: boolean; salingInginBertemu: boolean },
  b: { address: string; tier: number; pernahBertemu: boolean; salingInginBertemu: boolean },
): number {
  return (Number(b.salingInginBertemu) - Number(a.salingInginBertemu))
    || (Number(b.pernahBertemu) - Number(a.pernahBertemu))
    || (b.tier - a.tier)
    || a.address.localeCompare(b.address);
}

const labelTier = (tier: number): string => TIER_LABELS[tier] ?? TIER_LABELS[0];

/**
 * `GET /radar/:eventId`, langkah 2–7 (spec 4b+5 §5.2). Langkah 5 dan 6
 * menegakkan timbal balik: siapa pun yang bisa melihat radar sedang terlihat
 * di radar yang sama.
 */
export async function lihatRadar(
  pemanggil: Address, eventIdMentah: Hex, deps: RadarDeps,
  hitungBersama: PenghitungKoneksiBersama = (a, k, x) => deps.radar.hitungKoneksiBersama(a, k, x),
): Promise<RadarResult<ResponsRadar>> {
  const now = deps.nowMs();
  const eventId = kecil(eventIdMentah) as Hex;
  const aku = kecil(pemanggil) as Address;

  const acara = await gerbangAcara(eventId, aku, deps, now);
  if (!acara.ok) return acara;

  if (!(await terlihat(deps, aku))) return fail({ code: "tersembunyi", httpStatus: 403 });

  const barisku = await deps.radar.ambilKehadiran(eventId, aku);
  if (!barisku || now - barisku.seenAtMs > JENDELA_HADIR_MS) {
    return fail({ code: "belum_hadir", httpStatus: 403 });
  }

  const hadir = (await deps.radar.hadirSejak(eventId, now - JENDELA_HADIR_MS))
    .map((a) => kecil(a) as Address)
    .filter((a) => a !== aku);
  if (hadir.length === 0) return ok({ kartu: [], jumlah: 0 });

  // Visibilitas dari `profiles`, BUKAN dari baris kehadiran — pindah ke
  // Tersembunyi berlaku seketika walau barisnya masih ada. Blokir DUA arah.
  // `blokirKu` (SATU arah: yang diblokir pemanggil) hanya untuk hitungan
  // koneksi bersama di bawah — lihat komentarnya.
  const [visibilitas, terblokir, blokirKu] = await Promise.all([
    deps.profilSaya.visibilitasBanyak(hadir),
    deps.blokir.himpunanUntuk(aku),
    deps.blokir.diblokirOleh(aku),
  ]);
  const lolos = hadir.filter((a) => visibilitas.get(a) === "terlihat" && !terblokir.has(a));
  if (lolos.length === 0) return ok({ kartu: [], jumlah: 0 });

  const kecuali = [...terblokir];
  const [koneksi, oleh, ke, profil] = await Promise.all([
    deps.radar.terhubungDengan(aku, lolos),
    deps.meet.tandaOleh(aku, kecuali),
    deps.meet.tandaKe(aku, kecuali),
    deps.meet.profilRingkas(lolos),
  ]);
  const saling = new Set(kecocokanDari(oleh, ke).map((k) => kecil(k.address)));

  const baris = lolos.map((a) => ({
    address: a,
    displayName: profil.get(a)?.displayName ?? "",
    tier: profil.get(a)?.tier ?? 0,
    pernahBertemu: koneksi.has(a),
    salingInginBertemu: saling.has(a),
  })).sort(urutkanKartuRadar).slice(0, MAKS_KARTU_RADAR);

  // Koneksi bersama (desain UI §8.3): HANYA untuk kartu yang belum ditemui,
  // dihitung SETELAH saringan visibilitas dan blokir di atas — orang
  // Tersembunyi tidak pernah menjadi subjek hitungan. Yang dikecualikan dari
  // hitungan hanya orang yang DIBLOKIR pemanggil (satu arah, keputusan pemilik
  // 2026-09-18): graf koneksi publik, jadi mengecualikan orang yang memblokir
  // pemanggil membuat angka yang turun satu menjadi oracle "siapa yang
  // memblokirku" — alasan yang sama dengan `inginBertemuCount`. Gagal =
  // kunci hilang di semua kartu, bukan angka karangan; radar tetap jalan.
  const belumBertemu = baris.filter((b) => !b.pernahBertemu).map((b) => b.address);
  const bersama = belumBertemu.length === 0
    ? new Map<string, number>()
    : await hitungBersama(aku, belumBertemu, blokirKu.map((b) => kecil(b.address))).catch(() => null);

  // Dibangun kunci demi kunci, BUKAN spread — medan tambahan di `baris`
  // (mis. `tier` mentah) tidak boleh ikut terkirim.
  const kartu: KartuRadar[] = baris.map((b) => {
    const k: KartuRadar = {
      address: b.address,
      displayName: b.displayName,
      tierLabel: labelTier(b.tier),
      pernahBertemu: b.pernahBertemu,
      salingInginBertemu: b.salingInginBertemu,
    };
    const n = b.pernahBertemu ? undefined : bersama?.get(b.address);
    if (n !== undefined && n >= 1) k.koneksiBersama = n;
    return k;
  });
  // `jumlah` = kartu yang dikirim. Jumlah sebelum penyaringan akan membocorkan
  // berapa orang disembunyikan blokir atau visibilitas.
  return ok({ kartu, jumlah: kartu.length });
}
