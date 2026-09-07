import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { getKecocokan, kueriBuktiKecocokan } from "../src/meet-api";
import { teksLencana } from "../src/messages";

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

  const [baru, setBaru] = useState(0);

  useEffect(() => {
    // Satu tanda tangan per pembukaan beranda, hanya untuk angka lencana.
    // Ongkos yang dipilih sadar (spec §6.2): endpoint hitung tanpa autentikasi
    // akan membocorkan berapa kecocokan dimiliki sebuah alamat.
    //
    // Fungsi async DI DALAM useEffect, bukan useEffect yang async —
    // useEffect yang mengembalikan Promise merusak jalur pembersihannya.
    void (async () => {
      try {
        const { baru } = await getKecocokan(await kueriBuktiKecocokan(signer));
        setBaru(baru);
      } catch {
        // Beranda tidak boleh gagal hanya karena lencana gagal dimuat.
        setBaru(0);
      }
    })();
  }, [signer]);

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      <Link href="/qr" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/scan" style={s.link}>Pindai QR orang lain</Link>
      <Link href="/connections" style={s.link}>Koneksiku</Link>
      <Link href="/events" style={s.link}>Acara</Link>
      <Link href="/feed" style={s.link}>Feed</Link>
      <Link href="/kecocokan" style={s.link}>
        Saling ingin bertemu{teksLencana(baru) ? `  ${teksLencana(baru)}` : ""}
      </Link>
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
