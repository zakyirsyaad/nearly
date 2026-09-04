import { useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";

type Row = { address: string; txHash: string; at: number };

export default function Connections() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${CONFIG.apiUrl}/connections/${signer.address}`)
      .then((r) => r.json())
      .then((j) => setRows(j.connections ?? []))
      .catch(() => setRows([]));
  }, [signer.address]);

  if (!rows) return <View style={s.root}><Text>Memuat…</Text></View>;

  if (rows.length === 0) {
    return (
      <View style={s.root}>
        <Text style={s.empty}>
          Belum ada koneksi. Koneksi hanya bisa dibuat dengan bertemu langsung.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.list}
      data={rows}
      keyExtractor={(r) => r.address}
      renderItem={({ item }) => (
        <Link href={`/profile/${item.address}`} style={s.row}>
          <Text style={s.addr}>{item.address}</Text>
        </Link>
      )}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24 },
  list: { padding: 16 },
  row: { paddingVertical: 14 },
  addr: { fontFamily: "Courier", fontSize: 13 },
  empty: { fontSize: 15, lineHeight: 22, textAlign: "center", opacity: 0.7 },
});
