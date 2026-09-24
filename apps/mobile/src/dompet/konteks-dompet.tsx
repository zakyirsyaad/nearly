import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import type { Address, Hex } from "viem";
import { createSignerDariKunci, type NearlySigner } from "../signer";
import { req } from "../http";
import { lupakanPendaftaranPush } from "../pesan/push";
import {
  buatDompetBaru, imporDompetKunciDev, imporDompetMnemonik, keadaanPenyimpan, lupakanDompet,
  type InfoDompet,
} from "./aksi-dompet";
import { bacaMnemonik, tandaiSudahDicadangkan as tandaiDiPenyimpan } from "./penyimpan-dompet";

export type KeadaanDompet = "memuat" | "galat" | "belum-ada" | "siap";

export type NilaiDompet = {
  keadaan: KeadaanDompet;
  /** Terisi hanya saat keadaan "galat"; kalimatnya lewat pesanGalatDompet. */
  galat: unknown;
  address: Address | null;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
  /**
   * Nama tampilan milik dompet ini menurut server. `undefined` = belum
   * diketahui (permintaan sedang jalan ATAU gagal) — gerbang nama sengaja
   * gagal-terbuka dalam keadaan itu, lihat src/nama-gerbang.ts.
   */
  namaTampilan: string | null | undefined;
  /** Dipanggil layar nama setelah tersimpan, supaya gerbang langsung membuka. */
  tandaiNama(nama: string): void;
  muatUlang(): void;
  buatBaru(): Promise<void>;
  imporMnemonik(teks: string): Promise<void>;
  imporKunciDev(teks: string): Promise<void>;
  gantiDompet(): Promise<void>;
  tampilkanMnemonik(): Promise<string | null>;
  tandaiSudahDicadangkan(): Promise<void>;
};

type Status =
  | { keadaan: "memuat" }
  | { keadaan: "galat"; galat: unknown }
  | { keadaan: "belum-ada" }
  | { keadaan: "siap"; info: InfoDompet };

const KonteksDompet = createContext<NilaiDompet | null>(null);

/**
 * Kunci privat dipisah ke konteks sendiri, TIDAK ikut di NilaiDompet: layar
 * tidak pernah memegang kunci, hanya signer dari useNearlySigner. Layar yang
 * memakai signer juga tidak dirender ulang saat penanda cadangan berubah.
 */
const KonteksKunci = createContext<Hex | null>(null);

export function DompetProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ keadaan: "memuat" });

  const muatUlang = useCallback(() => {
    setStatus({ keadaan: "memuat" });
    void keadaanPenyimpan().then(setStatus);
  }, []);

  useEffect(() => { muatUlang(); }, [muatUlang]);

  const buatBaru = useCallback(async () => {
    const info = await buatDompetBaru();
    setStatus({ keadaan: "siap", info });
  }, []);

  const imporMnemonik = useCallback(async (teks: string) => {
    const info = await imporDompetMnemonik(teks);
    setStatus({ keadaan: "siap", info });
  }, []);

  const imporKunciDev = useCallback(async (teks: string) => {
    const info = await imporDompetKunciDev(teks, __DEV__);
    setStatus({ keadaan: "siap", info });
  }, []);

  const gantiDompet = useCallback(async () => {
    try {
      await lupakanDompet();
    } catch (galat) {
      // Penghapusan bisa gagal SETELAH kunci terhapus. Keadaan mengikuti isi
      // penyimpan — tidak tetap "siap" menandatangani dengan kunci yang sudah
      // tidak ada di Keychain. Tanpa "memuat", supaya layar Dompet (bila
      // dompet masih ada) tetap terpasang dan menampilkan galatnya.
      lupakanPendaftaranPush();
      setStatus(await keadaanPenyimpan());
      throw galat;
    }
    // Dompet berikutnya mendaftarkan token push ulang; API memindahkan token
    // itu dari dompet lama (pesan-store.ts simpanTokenPush).
    lupakanPendaftaranPush();
    setStatus({ keadaan: "belum-ada" });
  }, []);

  const tandaiSudahDicadangkan = useCallback(async () => {
    await tandaiDiPenyimpan();
    setStatus((s) => (s.keadaan === "siap" ? { keadaan: "siap", info: { ...s.info, sudahDicadangkan: true } } : s));
  }, []);

  const info = status.keadaan === "siap" ? status.info : null;

  // Nama tampilan dibaca dari profil publik — satu permintaan tanpa tanda
  // tangan, dan gagalnya TIDAK mengunci aplikasi (nilai tetap undefined).
  const [namaTampilan, setNamaTampilan] = useState<string | null | undefined>(undefined);
  const alamat = info?.address ?? null;
  useEffect(() => {
    if (!alamat) { setNamaTampilan(undefined); return; }
    let aktif = true;
    void req<{ displayName?: string }>(`/profile/${alamat}`)
      .then((p) => { if (aktif) setNamaTampilan(p.displayName ?? ""); })
      .catch(() => { if (aktif) setNamaTampilan(undefined); });
    return () => { aktif = false; };
  }, [alamat]);

  const tandaiNama = useCallback((nama: string) => setNamaTampilan(nama), []);

  const nilai = useMemo<NilaiDompet>(() => ({
    keadaan: status.keadaan,
    galat: status.keadaan === "galat" ? status.galat : null,
    address: info?.address ?? null,
    punyaMnemonik: info?.punyaMnemonik ?? false,
    sudahDicadangkan: info?.sudahDicadangkan ?? false,
    namaTampilan,
    tandaiNama,
    muatUlang,
    buatBaru,
    imporMnemonik,
    imporKunciDev,
    gantiDompet,
    tampilkanMnemonik: bacaMnemonik,
    tandaiSudahDicadangkan,
  }), [
    status, info, namaTampilan, tandaiNama, muatUlang, buatBaru, imporMnemonik,
    imporKunciDev, gantiDompet, tandaiSudahDicadangkan,
  ]);

  return (
    <KonteksKunci.Provider value={info?.kunci ?? null}>
      <KonteksDompet.Provider value={nilai}>{children}</KonteksDompet.Provider>
    </KonteksKunci.Provider>
  );
}

export function useDompet(): NilaiDompet {
  const nilai = useContext(KonteksDompet);
  if (nilai === null) throw new Error("useDompet harus di dalam DompetProvider (app/_layout.tsx)");
  return nilai;
}

/**
 * Signer dompet HP ini untuk satu kontrak domain EIP-712, atau null bila dompet
 * belum siap. Objeknya stabil selama kunci dan kontraknya sama — efek yang
 * bergantung pada `signer` tidak menembak ulang setiap render.
 */
export function useNearlySigner(verifyingContract: Address): NearlySigner | null {
  const kunci = useContext(KonteksKunci);
  return useMemo(
    () => (kunci === null ? null : createSignerDariKunci(kunci, verifyingContract)),
    [kunci, verifyingContract],
  );
}
