import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, AppState, ScrollView, Share, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { useDompet } from "../../../src/dompet/konteks-dompet";
import { kataHarusDitutup } from "../../../src/dompet/tampil-kata";
import {
  kataBernomor, PERINGATAN_LIHAT_MNEMONIK, peringatanGantiDompet, pesanGalatDompet,
  TEKS_TANPA_MNEMONIK,
} from "../../../src/dompet/teks-dompet";
import {
  CATATAN_ALAMAT, CATATAN_GANTI_DOMPET, JUDUL_DIALOG_12_KATA, JUDUL_DIALOG_GANTI,
  LABEL_12_KATA, LABEL_ALAMAT, LABEL_GANTI_DOMPET, labelGantiDompet, TEKS_BAGIKAN_ALAMAT,
  TEKS_BATAL, TEKS_CATATAN_TERSIMPAN, TEKS_HAPUS_DOMPET, TEKS_LIHAT_12_KATA,
  TEKS_SUDAH_DICATAT, TEKS_TAMPILKAN,
} from "../../../src/teks-akun";

export default function DompetScreen() {
  const {
    address, punyaMnemonik, sudahDicadangkan, tampilkanMnemonik, tandaiSudahDicadangkan, gantiDompet,
  } = useDompet();
  const [kata, setKata] = useState<string[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const kabar = useKabar();
  const fokus = useRef(false);

  // 12 kata ditutup di DUA pintu (review B1 M3, Ruling B2-1): saat layar
  // kehilangan fokus — tab tetap terpasang saat pindah tab — dan saat aplikasi
  // meninggalkan keadaan aktif, sebelum iOS mengambil cuplikan app switcher.
  useFocusEffect(useCallback(() => {
    fokus.current = true;
    return () => {
      fokus.current = false;
      setKata(null);
    };
  }, []));

  useEffect(() => {
    const langganan = AppState.addEventListener("change", (k) => {
      if (kataHarusDitutup(k)) setKata(null);
    });
    return () => langganan.remove();
  }, []);

  // Sesaat setelah Ganti dompet, sebelum gerbang memindahkan ke layar Mulai.
  if (address === null) return null;

  const bagikan = () => {
    // Share bawaan React Native — tanpa paket baru. Untuk daftar seed panitia.
    Share.share({ message: address }).catch(() => {});
  };

  const bukaKata = async () => {
    try {
      const m = await tampilkanMnemonik();
      if (m === null) {
        setPesan(TEKS_TANPA_MNEMONIK);
        return;
      }
      // Pengguna bisa pindah tab atau keluar aplikasi selagi kata dibaca dari
      // penyimpan aman — kata tidak dibuka di layar yang sudah ditinggalkan.
      if (!fokus.current || kataHarusDitutup(AppState.currentState)) return;
      setKata(kataBernomor(m));
      setPesan(null);
    } catch (e) {
      setPesan(pesanGalatDompet(e));
    }
  };

  const lihatKata = () => {
    Alert.alert(JUDUL_DIALOG_12_KATA, PERINGATAN_LIHAT_MNEMONIK, [
      { text: TEKS_BATAL, style: "cancel" },
      { text: TEKS_TAMPILKAN, onPress: () => { void bukaKata(); } },
    ]);
  };

  const sudahDicatat = async () => {
    try {
      await tandaiSudahDicadangkan();
      setKata(null);
      setPesan(null);
      kabar.berhasil(TEKS_CATATAN_TERSIMPAN);
    } catch (e) {
      setPesan(pesanGalatDompet(e));
    }
  };

  const hapus = async () => {
    setSibuk(true);
    try {
      // Berhasil → gerbang di _layout.tsx pindah ke layar Mulai.
      await gantiDompet();
    } catch (e) {
      setPesan(pesanGalatDompet(e));
      setSibuk(false);
    }
  };

  const ganti = () => {
    Alert.alert(JUDUL_DIALOG_GANTI, peringatanGantiDompet({ punyaMnemonik, sudahDicadangkan }), [
      { text: TEKS_BATAL, style: "cancel" },
      { text: TEKS_HAPUS_DOMPET, style: "destructive", onPress: () => { void hapus(); } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_ALAMAT}</Text>
        {/* Alamat tampil utuh — alamat-lah identitasnya (spec induk §9.2). */}
        <Text variant="mono" selectable>{address}</Text>
        <Button variant="outline" onPress={bagikan}>{TEKS_BAGIKAN_ALAMAT}</Button>
        <Text variant="caption">{CATATAN_ALAMAT}</Text>
      </Card>

      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_12_KATA}</Text>
        {!punyaMnemonik ? <Text variant="caption">{TEKS_TANPA_MNEMONIK}</Text> : null}
        {punyaMnemonik && kata === null ? (
          <Button variant="outline" onPress={lihatKata}>{TEKS_LIHAT_12_KATA}</Button>
        ) : null}
        {kata ? (
          <View style={s.kotakKata}>
            {kata.map((k) => <Text key={k} variant="mono">{k}</Text>)}
            <Button onPress={() => { void sudahDicatat(); }}>{TEKS_SUDAH_DICATAT}</Button>
          </View>
        ) : null}
      </Card>

      <Card style={s.kartu}>
        <Text variant="caption">{LABEL_GANTI_DOMPET}</Text>
        <Text variant="caption">{CATATAN_GANTI_DOMPET}</Text>
        <Button variant="destructive" loading={sibuk} disabled={sibuk} onPress={ganti}>
          {labelGantiDompet(sibuk)}
        </Button>
      </Card>

      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 16 },
  kartu: { gap: 8 },
  kotakKata: { gap: 8 },
});
