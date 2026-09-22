/**
 * Skema warna aplikasi. Nearly SELALU gelap (spec desain UI §3.2, keputusan
 * #2): hook ini tidak membaca skema OS dan tidak memakai ModeProvider BNA.
 * Tipe kembaliannya tetap dua nilai supaya `useColor` salinan BNA tidak
 * perlu disunting.
 */
export function useColorScheme(): "light" | "dark" {
  return "dark";
}
