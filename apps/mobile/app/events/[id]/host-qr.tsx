import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Hex } from "viem";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { useCheckInQr } from "../../../src/events/useCheckInQr";

export default function HostQrScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <HostQrScreenIsi key={signer.address} signer={signer} />;
}

function HostQrScreenIsi({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { value, secondsLeft, error } = useCheckInQr(signer, id as Hex);

  if (error) return <View style={s.root}><Text style={s.err}>{error}</Text></View>;
  if (!value) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <QRCode value={value} size={260} />
      <Text style={s.hint}>
        Minta tamu memindai ini untuk check-in. Berganti dalam {secondsLeft} detik.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  hint: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  err: { fontSize: 15, textAlign: "center" },
});
