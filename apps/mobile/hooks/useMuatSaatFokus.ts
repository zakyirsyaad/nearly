import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { generasiDataKini, perluMuatUlang } from "../src/muat-fokus";

/**
 * Memuat saat layar tab fokus (spec desain UI §4.6): paling sering sekali per
 * 30 detik, KECUALI data berubah di tab lain (generasi naik) atau pemuatan
 * sebelumnya gagal (review B1 M7, Ruling B2-3). `muat` mengembalikan `true`
 * hanya bila SEMUA bagiannya berhasil.
 */
export function useMuatSaatFokus(muat: () => Promise<boolean>): void {
  const terakhir = useRef<number | null>(null);
  const generasiDimuat = useRef<number | null>(null);

  useFocusEffect(useCallback(() => {
    const kini = Date.now();
    const generasi = generasiDataKini();
    if (!perluMuatUlang(terakhir.current, generasiDimuat.current, kini, generasi)) return;
    terakhir.current = kini;
    generasiDimuat.current = generasi;
    void muat().then((berhasil) => {
      // Batas 30 detik hanya untuk pemuatan yang BERHASIL: tanpa ini, satu
      // kegagalan jaringan membuat layar basi 30 detik penuh.
      if (!berhasil && terakhir.current === kini) terakhir.current = null;
    });
  }, [muat]));
}
