import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Handshake } from "lucide-react-native";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import { req } from "../../../src/http";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { KOSONG_KONEKSI, TEKS_AKSI_HANDSHAKE, TEKS_GAGAL_MUAT_KONEKSI } from "../../../src/teks-beranda";
import { waktuRelatif } from "../../../src/waktu";

type Row = { address: string; txHash: string; at: number };

export default function Connections() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ConnectionsIsi key={signer.address} signer={signer} />;
}

function ConnectionsIsi({ signer }: { signer: NearlySigner }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [galat, setGalat] = useState(false);

  // Gagal memuat bukan "No connections yet" (review B1 #I3, spec §7.2).
  const muat = useCallback(() => {
    setGalat(false);
    return req<{ connections?: Row[] }>(`/connections/${signer.address}`)
      .then((j) => setRows(j.connections ?? []))
      .catch(() => setGalat(true));
  }, [signer.address]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (!rows) {
    if (galat) {
      return (
        <View style={s.muat}>
          <KeadaanGalat kalimat={TEKS_GAGAL_MUAT_KONEKSI} onCobaLagi={() => void muat()} />
        </View>
      );
    }
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  const kini = new Date();

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(r) => r.address}
      ListEmptyComponent={
        <KeadaanKosong
          Ikon={Handshake}
          kalimat={KOSONG_KONEKSI}
          aksi={{ label: TEKS_AKSI_HANDSHAKE, onPress: () => router.push("/salaman") }}
        />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/profile/${item.address}`)} accessibilityRole="button">
          <Card style={s.kartu}>
            {/* GET /connections tidak mengirim nama; alamat adalah identitasnya
                (spec §9.2, §11 batas #9). */}
            <Text variant="mono">{item.address}</Text>
            <Text variant="caption">{waktuRelatif(new Date(item.at), kini)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
  kartu: { gap: 4 },
});
