import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
import { useRotatingQr } from "../src/handshake/useRotatingQr";

export default function QrScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <QrScreenIsi key={signer.address} signer={signer} />;
}

function QrScreenIsi({ signer }: { signer: NearlySigner }) {
  const { value, secondsLeft, error } = useRotatingQr(signer);

  if (error) return <View style={s.root}><Text style={s.err}>{error}</Text></View>;
  if (!value) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <QRCode value={value} size={260} />
      <Text style={s.hint}>Minta dia memindai ini. Berganti dalam {secondsLeft} detik.</Text>
      <Text style={s.addr} selectable>{signer.address}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  hint: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  addr: { fontFamily: "Courier", fontSize: 12, opacity: 0.5 },
  err: { fontSize: 15, textAlign: "center" },
});
