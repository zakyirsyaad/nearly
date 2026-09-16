import type { RadarStore } from "./ports";

/** Sapuan oportunistik dari rute detak paling sering sekali per 10 menit per proses (spec 4b+5 §4.5). */
export const JEDA_SAPU_MS = 10 * 60_000;

/** Tidak pernah melempar: kegagalan dicatat, pemanggil tidak ikut gagal. */
export async function sapuLokasiAman(radar: Pick<RadarStore, "sapuLokasi">, nowMs: number): Promise<void> {
  try {
    await radar.sapuLokasi(nowMs);
  } catch (e) {
    console.error("sapu lokasi gagal:", e instanceof Error ? e.message : e);
  }
}

/**
 * Penanda waktu di MEMORI, satu per `radarRoutes` — `createApp` dipanggil
 * sekali per proses di index.ts. `mungkinSapu` tanpa await dan dijamin tidak
 * pernah melempar.
 */
export function buatPenyapuLokasi(deps: { radar: Pick<RadarStore, "sapuLokasi">; nowMs: () => number }) {
  let terakhirMs: number | null = null;
  return {
    mungkinSapu(): void {
      const now = deps.nowMs();
      if (terakhirMs !== null && now - terakhirMs < JEDA_SAPU_MS) return;
      terakhirMs = now;
      void sapuLokasiAman(deps.radar, now);
    },
  };
}
