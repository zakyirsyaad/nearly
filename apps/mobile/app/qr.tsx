import { useMemo } from "react";
import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { useRotatingQr } from "../src/handshake/useRotatingQr";

export default function QrScreen() {
  // WAJIB useMemo: tanpa ini signer lahir baru tiap render, refresh ikut berubah,
  // dan efek rotasi jalan ulang tiap detik — QR berganti tiap detik, bukan 30 detik.
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
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
