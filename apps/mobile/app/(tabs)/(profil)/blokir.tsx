import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { ShieldOff } from "lucide-react-native";
import type { Address } from "viem";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../src/http";
import { getBlokir, kueriBuktiBlokir, type BarisBlokir } from "../../../src/blokir-api";
import { aksiBlokir } from "../../../src/blokir-actions";
import { blokirErrorMessage, blokirTombolLabel } from "../../../src/messages";
import {
  KOSONG_BLOKIR, TEKS_BLOKIR_DICABUT_GAGAL_MUAT, TEKS_GAGAL_MUAT_BLOKIR,
} from "../../../src/teks-akun";
import { teksGagalBlokir } from "../../../src/teks-profil";

export default function BlokirScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <BlokirScreenIsi key={signer.address} signer={signer} />;
}

function BlokirScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<BarisBlokir[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  // Galat MUAT terpisah dari pesan AKSI: "Try again" memuat ulang daftar, jadi
  // ia tidak boleh muncul di bawah kegagalan mencabut blokir.
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  // TIDAK menangkap galatnya sendiri: pemanggil (pemicu fokus di bawah, dan
  // `cabut`) yang memutuskan apa arti kegagalan di konteks masing-masing.
  const muat = useCallback(async () => {
    const { blokir } = await getBlokir(await kueriBuktiBlokir(signer));
    setBaris(blokir);
    setGalatMuat(null);
    // muat yang berhasil memensiunkan pesan aksi yang basi juga (perilaku
    // sebelum B2): kalau reload sesudah cabut sempat gagal lalu berhasil di
    // percobaan berikutnya, pesan lama itu tidak boleh terus menempel.
    setPesan(null);
  }, [signer]);

  // Galat dari `muat` ditangani DI SINI, bukan di dalam `muat`: reload di
  // dalam `cabut` punya arti kegagalannya sendiri. Baris yang sudah tampil
  // DIPERTAHANKAN (review B1 M1, spec §7.2).
  const muatDenganGalat = useCallback(() => {
    return muat().catch((e: unknown) => {
      setGalatMuat(e instanceof ApiError ? blokirErrorMessage(e.code) : TEKS_GAGAL_MUAT_BLOKIR);
    });
  }, [muat]);

  // SATU pemicu. `useFocusEffect` sudah menyala saat layar pertama kali fokus.
  useFocusEffect(useCallback(() => { void muatDenganGalat(); }, [muatDenganGalat]));

  async function cabut(alamat: string) {
    if (sibuk) return;
    setSibuk(alamat);
    setPesan(null);
    try {
      await aksiBlokir(signer, alamat as Address, true);
    } catch (e) {
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(true));
      setSibuk(null);
      return;
    }
    setSibuk(null);
    try {
      await muat();
    } catch {
      // Pencabutannya SUDAH tersimpan. Mengatakan "gagal mencabut" di sini
      // akan berbohong tentang aksi yang berhasil — jadi baris yang dicabut
      // dibuang dari state lokal (tanpa membuang seluruh daftar) dan
      // pesannya jujur: aksinya berhasil, cuma daftarnya yang gagal segar.
      setBaris((b) => b?.filter((x) => x.address !== alamat) ?? b);
      setPesan(TEKS_BLOKIR_DICABUT_GAGAL_MUAT);
    }
  }

  if (baris === null) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatDenganGalat()} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris}
      keyExtractor={(b) => b.address}
      ListHeaderComponent={
        galatMuat || pesan ? (
          <View style={s.kepala}>
            {galatMuat ? <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatDenganGalat()} /> : null}
            {pesan ? <Text variant="caption">{pesan}</Text> : null}
          </View>
        ) : null
      }
      ListEmptyComponent={
        // Kalau `galatMuat` terisi, daftar kosong ini BUKAN berarti "kamu tidak
        // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
        // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
        // pengguna.
        galatMuat ? null : (
          <KeadaanKosong Ikon={ShieldOff} kalimat={KOSONG_BLOKIR} />
        )
      }
      renderItem={({ item }) => (
        <Card style={s.kartu}>
          <Text variant="mono">{item.address}</Text>
          <Button
            variant="destructive"
            // `true` tetap: setiap baris di layar ini, by construction, adalah
            // orang yang sudah diblokir pengguna.
            disabled={sibuk === item.address}
            loading={sibuk === item.address}
            onPress={() => { void cabut(item.address); }}
          >
            {blokirTombolLabel(true, sibuk === item.address)}
          </Button>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
  kartu: { gap: 8 },
  kepala: { gap: 8 },
});
