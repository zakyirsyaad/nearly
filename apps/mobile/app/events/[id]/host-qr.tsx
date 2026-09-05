import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Hex } from "viem";
import { CONFIG } from "../../../src/config";
import { createDevSigner } from "../../../src/signer";
import { useCheckInQr } from "../../../src/events/useCheckInQr";

export default function HostQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );
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
