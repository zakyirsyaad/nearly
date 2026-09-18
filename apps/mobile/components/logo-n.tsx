import Svg, { Path } from "react-native-svg";
import { useColor } from "@/hooks/useColor";

/** Path "n" — SAMA PERSIS dengan assets/sumber/n.svg (dijaga test/ikon.test.ts). */
export const PATH_N =
  "M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z";

/**
 * Logo "n" besar untuk layar Mulai (spec desain UI §3.5, §7.1) — digambar
 * dari path yang sama dengan ikon, bukan dari PNG.
 */
export function LogoN({ ukuran, warna = "primary" }: { ukuran: number; warna?: "primary" | "text" }) {
  const isi = useColor(warna);
  return (
    <Svg width={ukuran} height={ukuran} viewBox="0 0 100 100">
      <Path d={PATH_N} fill={isi} />
    </Svg>
  );
}
