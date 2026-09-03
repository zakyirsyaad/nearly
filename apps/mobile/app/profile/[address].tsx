import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../src/config";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
};

export default function ProfileScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    fetch(`${CONFIG.apiUrl}/profile/${address}`).then((r) => r.json()).then(setP).catch(() => {});
  }, [address]);

  if (!p) return <View style={s.root}><Text>Memuat…</Text></View>;

  return (
    <View style={s.root}>
      {/* Nama boleh apa saja dan TIDAK unik. Alamat SELALU tampil di bawahnya —
          nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.name}>{p.displayName || "Tanpa nama"}</Text>
      <Text style={s.addr} selectable>{p.ens ?? p.address}</Text>
      {p.ens && <Text style={s.addr} selectable>{p.address}</Text>}

      <View style={s.facts}>
        <Text style={s.fact}>{p.connectionCount} koneksi</Text>
        <Text style={s.fact}>{p.txCount} transaksi on-chain</Text>
      </View>

      <Text style={s.note}>
        Trust Score menyusul di Fase 2. Untuk sekarang yang ditampilkan adalah faktanya saja.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 8 },
  name: { fontSize: 26, fontWeight: "700" },
  addr: { fontFamily: "Courier", fontSize: 12, opacity: 0.6 },
  facts: { marginTop: 20, gap: 6 },
  fact: { fontSize: 16 },
  note: { marginTop: 24, fontSize: 13, opacity: 0.5, lineHeight: 19 },
});
