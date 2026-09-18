import { useState } from "react";
import { Alert, Button, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useDompet } from "../src/dompet/konteks-dompet";
import {
  kataBernomor, PERINGATAN_LIHAT_MNEMONIK, peringatanGantiDompet, pesanGalatDompet,
  TEKS_TANPA_MNEMONIK,
} from "../src/dompet/teks-dompet";

export default function DompetScreen() {
  const {
    address, punyaMnemonik, sudahDicadangkan, tampilkanMnemonik, tandaiSudahDicadangkan, gantiDompet,
  } = useDompet();
  const [kata, setKata] = useState<string[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

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
      setKata(kataBernomor(m));
      setPesan(null);
    } catch (e) {
      setPesan(pesanGalatDompet(e));
    }
  };

  const lihatKata = () => {
    Alert.alert("Lihat 12 kata pemulihan?", PERINGATAN_LIHAT_MNEMONIK, [
      { text: "Batal", style: "cancel" },
      { text: "Tampilkan", onPress: () => { void bukaKata(); } },
    ]);
  };

  const sudahDicatat = async () => {
    try {
      await tandaiSudahDicadangkan();
      setKata(null);
      setPesan("Tersimpan. Simpan catatanmu di tempat yang aman dan tidak online.");
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
    Alert.alert("Ganti dompet?", peringatanGantiDompet({ punyaMnemonik, sudahDicadangkan }), [
      { text: "Batal", style: "cancel" },
      { text: "Hapus dompet dari HP ini", style: "destructive", onPress: () => { void hapus(); } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={s.root}>
      <Text style={s.label}>Alamat</Text>
      {/* Alamat tampil utuh — alamat-lah identitasnya (spec induk §9.2). */}
      <Text style={s.alamat} selectable>{address}</Text>
      <Button title="Bagikan alamat" onPress={bagikan} />
      <Text style={s.catatan}>
        Alamat boleh dibagikan, misalnya ke panitia untuk daftar seed. Yang tidak boleh dibagikan
        kepada siapa pun adalah 12 kata pemulihan.
      </Text>

      <Text style={s.label}>12 kata pemulihan</Text>
      {!punyaMnemonik && <Text style={s.catatan}>{TEKS_TANPA_MNEMONIK}</Text>}
      {punyaMnemonik && kata === null && (
        <Button title="Lihat 12 kata pemulihan" onPress={lihatKata} />
      )}
      {kata && (
        <View style={s.kotakKata}>
          {kata.map((k) => <Text key={k} style={s.kata}>{k}</Text>)}
          <Button title="Sudah saya catat" onPress={() => { void sudahDicatat(); }} />
        </View>
      )}

      <Text style={s.label}>Ganti dompet</Text>
      <Text style={s.catatan}>Menghapus dompet ini dari HP, lalu kembali ke layar Mulai.</Text>
      <Button title={sibuk ? "Menghapus…" : "Ganti dompet"} color="#b00" disabled={sibuk} onPress={ganti} />

      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 12 },
  alamat: { fontFamily: "Courier", fontSize: 13 },
  catatan: { fontSize: 13, lineHeight: 19, opacity: 0.6 },
  kotakKata: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 6 },
  kata: { fontFamily: "Courier", fontSize: 16 },
  pesan: { fontSize: 15, lineHeight: 22 },
});
