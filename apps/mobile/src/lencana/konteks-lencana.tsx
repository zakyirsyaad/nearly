import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { NearlySigner } from "../signer";
import { getKecocokan, kueriBuktiKecocokan } from "../meet-api";
import { sesiPesan } from "../pesan/sesi";
import { getBelumDibaca } from "../pesan/pesan-api";
import { bolehMuatLencana, LENCANA_KOSONG, type AngkaLencana } from "./lencana-tab";

export type NilaiLencana = AngkaLencana & {
  /** Muat ulang SEKARANG, melewati batas 30 detik — dipanggil setelah menandai dibaca/dilihat. */
  muatUlangLencana: () => void;
  /** Muat bila sudah lewat 30 detik — dipanggil saat tab aktif berganti. */
  muatBilaPerlu: () => void;
};

const KonteksLencana = createContext<NilaiLencana>({
  ...LENCANA_KOSONG,
  muatUlangLencana: () => {},
  muatBilaPerlu: () => {},
});

/**
 * Angka lencana tab Pesan (belum dibaca) dan Profil (kecocokan baru) — spec
 * desain UI §4.4, pengganti lencana di daftar tautan beranda lama. Dipanggil
 * SEKALI, di (tabs)/_layout.tsx (pola pembungkus: signer tidak pernah null di
 * sini). Dimuat saat terpasang, saat tab aktif berganti, dan saat aplikasi
 * kembali ke depan; paling sering sekali per 30 detik.
 *
 * Satu tanda tangan per pemuatan untuk tiap angka — ongkos yang dipilih sadar
 * (spec §6.2 Fase 3c): endpoint hitung tanpa autentikasi akan membocorkan
 * berapa kecocokan dimiliki sebuah alamat. Dompet di HP menandatangani tanpa
 * jendela konfirmasi (spec dompet §3).
 */
export function useLencanaTab(signer: NearlySigner): NilaiLencana {
  const [angka, setAngka] = useState<AngkaLencana>(LENCANA_KOSONG);
  const terakhirMs = useRef<number | null>(null);
  const terpasang = useRef(true);
  // Nomor pemuatan: jawaban yang datang terlambat dari pemuatan LAMA tidak
  // boleh menimpa angka dari pemuatan paksa sesudahnya (mis. setelah pesan
  // dibaca) selama 30 detik (review Rencana A #4).
  const nomorTerakhir = useRef(0);
  useEffect(() => () => { terpasang.current = false; }, []);

  const muat = useCallback((paksa: boolean) => {
    const sekarang = Date.now();
    if (!bolehMuatLencana(terakhirMs.current, sekarang, paksa)) return;
    terakhirMs.current = sekarang;
    const nomor = ++nomorTerakhir.current;
    // Fungsi async DI DALAM callback, bukan callback yang async. Masing-masing
    // angka gagal sendiri menjadi 0: lencana tidak boleh menggagalkan apa pun.
    void (async () => {
      const [kecocokanBaru, belumDibaca] = await Promise.all([
        (async () => (await getKecocokan(await kueriBuktiKecocokan(signer))).baru)().catch(() => 0),
        (async () => (await getBelumDibaca(await sesiPesan(signer))).total)().catch(() => 0),
      ]);
      if (terpasang.current && nomor === nomorTerakhir.current) setAngka({ belumDibaca, kecocokanBaru });
    })();
  }, [signer]);

  useEffect(() => { muat(false); }, [muat]);

  useEffect(() => {
    const langganan = AppState.addEventListener("change", (s) => { if (s === "active") muat(false); });
    return () => langganan.remove();
  }, [muat]);

  const muatUlangLencana = useCallback(() => muat(true), [muat]);
  const muatBilaPerlu = useCallback(() => muat(false), [muat]);

  return useMemo(
    () => ({ ...angka, muatUlangLencana, muatBilaPerlu }),
    [angka, muatUlangLencana, muatBilaPerlu],
  );
}

export function PenyediaLencana({ nilai, children }: { nilai: NilaiLencana; children: ReactNode }) {
  return <KonteksLencana.Provider value={nilai}>{children}</KonteksLencana.Provider>;
}

/** Angka lencana dan pemuat ulang untuk layar di dalam (tabs). */
export function useLencana(): NilaiLencana {
  return useContext(KonteksLencana);
}
