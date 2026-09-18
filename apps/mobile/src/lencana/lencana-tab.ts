/** Lencana tab dimuat paling sering sekali per 30 detik (spec desain UI §4.4). */
export const JEDA_LENCANA_MS = 30_000;

export type AngkaLencana = { belumDibaca: number; kecocokanBaru: number };

export const LENCANA_KOSONG: AngkaLencana = { belumDibaca: 0, kecocokanBaru: 0 };

/** Murni. `paksa` — setelah menandai dibaca/dilihat — melewati batas 30 detik. */
export function bolehMuatLencana(terakhirMs: number | null, sekarangMs: number, paksa: boolean): boolean {
  return paksa || terakhirMs === null || sekarangMs - terakhirMs >= JEDA_LENCANA_MS;
}
