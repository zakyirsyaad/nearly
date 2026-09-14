import type { HalamanGraf } from "./api";

/**
 * Keadaan graf di layar dan penggabungnya (spec 6 §6.2). Murni: keadaan lama
 * TIDAK PERNAH diubah — kanvas menyimpan referensi ke keadaan sebelumnya.
 */

/** Lamanya sisi baru menyala (spec 6 §6.3). */
export const DURASI_SOROT_MS = 4_000;

export type SimpulLayar = {
  /** Huruf kecil — kunci peta. */
  address: string;
  displayName: string;
  tierLabel: string;
  /** null = sudah ada sejak muatan awal; tidak dianimasikan. */
  baruSampaiMs: number | null;
};

export type SisiLayar = {
  id: number;
  a: string;
  b: string;
  atMs: number;
  txHash: string;
  /** Menyala sampai waktu ini. null = bagian muatan awal. */
  baruSampaiMs: number | null;
};

export type KeadaanGraf = {
  readonly simpul: ReadonlyMap<string, SimpulLayar>;
  readonly sisi: ReadonlyMap<number, SisiLayar>;
  readonly kursor: number;
};

export const KEADAAN_KOSONG: KeadaanGraf = { simpul: new Map(), sisi: new Map(), kursor: 0 };

/**
 * `sorot` false untuk halaman-halaman muatan awal: ribuan sisi lama yang
 * menyala bersamaan bukan "graf tumbuh", melainkan layar putih. Setelah muatan
 * awal lengkap, setiap sisi yang baru datang menyala.
 *
 * Mengembalikan keadaan yang SAMA (referensi) bila respons tidak mengubah apa
 * pun, supaya polling tanpa salaman baru tidak memicu render ulang kanvas.
 */
export function gabungHalaman(
  lama: KeadaanGraf,
  halaman: HalamanGraf,
  opsi: { nowMs: number; sorot: boolean },
): KeadaanGraf {
  const baruSampai = opsi.sorot ? opsi.nowMs + DURASI_SOROT_MS : null;
  let simpul: Map<string, SimpulLayar> | null = null;
  let sisi: Map<number, SisiLayar> | null = null;

  for (const s of halaman.simpul) {
    const kunci = s.address.toLowerCase();
    const ada = (simpul ?? lama.simpul).get(kunci);
    if (ada && ada.displayName === s.displayName && ada.tierLabel === s.tierLabel) continue;
    simpul ??= new Map(lama.simpul);
    simpul.set(kunci, {
      address: kunci,
      displayName: s.displayName,
      tierLabel: s.tierLabel,
      // Data yang lebih baru menimpa nama dan tier, tapi simpul yang sudah
      // ada tidak "lahir" lagi.
      baruSampaiMs: ada ? ada.baruSampaiMs : baruSampai,
    });
  }

  for (const s of halaman.sisi) {
    if ((sisi ?? lama.sisi).has(s.id)) continue;
    sisi ??= new Map(lama.sisi);
    const a = s.a.toLowerCase();
    const b = s.b.toLowerCase();
    sisi.set(s.id, { id: s.id, a, b, atMs: s.atMs, txHash: s.txHash, baruSampaiMs: baruSampai });

    // Kanvas melempar galat bila sebuah sisi menunjuk simpul yang tidak ada.
    // API selalu menyertakan simpul untuk sisi di halaman yang sama, tapi
    // layar proyektor tidak boleh padam karena satu respons yang cacat.
    for (const ujung of [a, b]) {
      if ((simpul ?? lama.simpul).has(ujung)) continue;
      simpul ??= new Map(lama.simpul);
      simpul.set(ujung, { address: ujung, displayName: "", tierLabel: "Baru", baruSampaiMs: baruSampai });
    }
  }

  const kursor = Math.max(lama.kursor, halaman.kursor);
  if (simpul === null && sisi === null && kursor === lama.kursor) return lama;
  return { simpul: simpul ?? lama.simpul, sisi: sisi ?? lama.sisi, kursor };
}
