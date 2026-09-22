import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { sesiPesan } from "../../../../src/pesan/sesi";
import { getPercakapan, type RingkasanPercakapanApi } from "../../../../src/pesan/pesan-api";
import { bukaBaris, kunciLawan } from "../../../../src/pesan/pesan-actions";
import { daftarkanPush } from "../../../../src/pesan/push";
import { pesanErrorMessage, teksLencana } from "../../../../src/messages";
import {
  KOSONG_PESAN, TEKS_GAGAL_MUAT_DAFTAR_PESAN, TEKS_PESAN_TIDAK_TERVERIFIKASI,
} from "../../../../src/teks-pesan";

type Baris = RingkasanPercakapanApi & { pratinjau: string };

export default function DaftarPesanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <DaftarPesanScreenIsi key={signer.address} signer={signer} />;
}

function DaftarPesanScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  // TIDAK menangkap galatnya sendiri — pemicu di bawah yang menangkap, pola
  // yang sama dengan blokir.tsx (Ruling R9 Fase 4a).
  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    // Izin notifikasi diminta saat layar pesan pertama kali dibuka (spec 4c §9).
    void daftarkanPush(sesi);
    const { percakapan } = await getPercakapan(sesi);
    const hasil = await Promise.all(percakapan.map(async (p): Promise<Baris> => {
      try {
        const t = bukaBaris(sesi, await kunciLawan(sesi, p.lawan), p.terakhir);
        return { ...p, pratinjau: t.status === "sah" ? t.isi : TEKS_PESAN_TIDAK_TERVERIFIKASI };
      } catch {
        return { ...p, pratinjau: "…" };
      }
    }));
    setBaris(hasil);
    setGalat(null);
  }, [signer]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      // Baris yang sudah tampil DIPERTAHANKAN; muat pertama yang gagal
      // meninggalkan `baris` null → galat + Try again (Ruling B2-12).
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_DAFTAR_PESAN);
    });
    void jalankan();
    const t = setInterval(() => { void jalankan(); }, 15_000);
    return () => { aktif = false; clearInterval(t); };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

  const cobaLagi = () => setPercobaan((n) => n + 1);

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris ?? []}
      keyExtractor={(b) => b.lawan}
      ListHeaderComponent={baris !== null && galat ? <KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} /> : null}
      ListEmptyComponent={
        baris === null ? (
          galat ? <KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} /> : <KerangkaDaftar />
        ) : galat ? null : (
          // Daftar kosong di samping galat BUKAN "belum ada percakapan".
          <KeadaanKosong Ikon={MessageCircle} kalimat={KOSONG_PESAN} />
        )
      }
      renderItem={({ item }) => {
        const lencana = teksLencana(item.belumDibaca);
        return (
          <KartuOrang
            nama={item.displayName}
            alamat={item.lawan}
            // Pesan hanya antar-koneksi (spec 4c §4), dan koneksi berlaku
            // selamanya: lawan bicara selalu orang yang pernah kamu temui (R9).
            terverifikasi
            lencana={lencana ? <Lencana varian="teks" teks={lencana} /> : undefined}
            keterangan={item.pratinjau}
            barisKeterangan={1}
            tier={item.tier}
            onPress={() => router.push(`/pesan/${item.lawan}`)}
          />
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
});
