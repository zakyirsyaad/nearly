/** Target sentuh minimum (spec desain UI §3.7): 44 pt iOS / 48 dp Android → 48. */
export const TARGET_SENTUH = 48;

export type Sisi = { top: number; bottom: number; left: number; right: number };

/**
 * hitSlop yang membawa elemen selebar × setinggi itu ke TARGET_SENTUH tanpa
 * membesarkan tampilannya. Contoh: tombol kirim 40×40 → 4 di tiap sisi.
 */
export function hitSlopSampai(lebar: number, tinggi: number = lebar): Sisi {
  const v = Math.max(0, Math.ceil((TARGET_SENTUH - tinggi) / 2));
  const h = Math.max(0, Math.ceil((TARGET_SENTUH - lebar) / 2));
  return { top: v, bottom: v, left: h, right: h };
}
