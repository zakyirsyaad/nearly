import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { NearlySigner } from "../../src/signer";
import { useRotatingQr } from "../../src/handshake/useRotatingQr";

/**
 * Mode "Show QR" layar Salaman — isi app/qr.tsx lama, dipindah apa adanya
 * (spec desain UI §6.2, Ruling A10). Dipasang hanya saat tab Salaman fokus dan
 * mode ini aktif; melepasnya menghentikan useRotatingQr, dan memasangnya lagi
 * langsung membuat offer baru. Tampilan dan kalimat dimigrasi Rencana B 5(a).
 */
export function ModeQr({ signerSalaman }: { signerSalaman: NearlySigner }) {
  const { value, secondsLeft, error } = useRotatingQr(signerSalaman);

  if (error) return <View style={s.root}><Text style={s.err}>{error}</Text></View>;
  if (!value) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <QRCode value={value} size={260} />
      <Text style={s.hint}>Minta dia memindai ini. Berganti dalam {secondsLeft} detik.</Text>
      <Text style={s.addr} selectable>{signerSalaman.address}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  hint: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  addr: { fontFamily: "Courier", fontSize: 12, opacity: 0.5 },
  err: { fontSize: 15, textAlign: "center" },
});
