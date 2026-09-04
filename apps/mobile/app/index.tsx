import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";

export default function Home() {
  if (!CONFIG.devPrivateKey) {
    return (
      <View style={s.root}>
        <Text style={s.h1}>Nearly</Text>
        <Text style={s.p}>
          Isi EXPO_PUBLIC_DEV_PRIVATE_KEY untuk mode pengembangan. Connect wallet sungguhan
          menyusul setelah alur handshake terbukti jalan.
        </Text>
      </View>
    );
  }

  const signer = createDevSigner(CONFIG.devPrivateKey, CONFIG.verifyingContract);

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      <Link href="/qr" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/scan" style={s.link}>Pindai QR orang lain</Link>
      <Link href="/connections" style={s.link}>Koneksiku</Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  h1: { fontSize: 32, fontWeight: "700" },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.7 },
  addr: { fontFamily: "Courier", fontSize: 13, opacity: 0.6 },
  link: { fontSize: 17, paddingVertical: 12 },
});
