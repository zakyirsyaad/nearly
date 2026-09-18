import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { sesiPesan } from "../../../../src/pesan/sesi";
import { getPercakapan, type RingkasanPercakapanApi } from "../../../../src/pesan/pesan-api";
import { bukaBaris, kunciLawan } from "../../../../src/pesan/pesan-actions";
import { daftarkanPush } from "../../../../src/pesan/push";
import { pesanErrorMessage, teksLencana } from "../../../../src/messages";

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
        return { ...p, pratinjau: t.status === "sah" ? t.isi : "Pesan tidak bisa diverifikasi" };
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
      setBaris((b) => b ?? []);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Percakapan gagal dimuat.");
    });
    void jalankan();
    const t = setInterval(() => { void jalankan(); }, 15_000);
    return () => { aktif = false; clearInterval(t); };
  }, [muat]));

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(b) => b.lawan}
        ListEmptyComponent={
          // Daftar kosong di samping galat BUKAN "belum ada percakapan".
          galat ? null : (
            <Text style={s.kosong}>
              Belum ada percakapan. Pesan hanya bisa dikirim ke orang yang pernah kamu temui — buka profil koneksimu untuk mulai.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const lencana = teksLencana(item.belumDibaca);
          return (
            <Link href={`/pesan/${item.lawan}`} style={s.kartu}>
              <Text style={s.nama}>
                {item.displayName || "Tanpa nama"}{lencana ? `  (${lencana})` : ""}
              </Text>
              {"\n"}
              <Text style={s.alamat}>{item.lawan}</Text>
              {"\n"}
              <Text style={s.pratinjau}>{item.pratinjau}</Text>
            </Link>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  galat: { color: "#b00" },
  kosong: { color: "#666", lineHeight: 20 },
  kartu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  nama: { fontWeight: "600" },
  alamat: { fontFamily: "monospace", fontSize: 11, color: "#666" },
  pratinjau: { color: "#333" },
});
