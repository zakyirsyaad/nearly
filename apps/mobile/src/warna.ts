/**
 * Warna isian teks, disetel eksplisit di setiap TextInput.
 *
 * Bawaan iOS terlalu pucat di latar terang aplikasi ini — placeholder formulir
 * Buat acara hampir tak terbaca di iPhone. Dan karena app.json memakai
 * userInterfaceStyle "automatic", di mode gelap teks ketikan bawaan ikut
 * memutih di atas latar yang selalu terang. Dijaga test/warna-isian.test.ts.
 */
export const WARNA = {
  /** Abu-abu yang masih terbaca di latar #f2f2f2 maupun putih. */
  placeholder: "#6e6e73",
  teks: "#111",
} as const;
