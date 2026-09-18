import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../../src/config";
import { req } from "../../../src/http";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";

type Row = { address: string; txHash: string; at: number };

export default function Connections() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ConnectionsIsi key={signer.address} signer={signer} />;
}

function ConnectionsIsi({ signer }: { signer: NearlySigner }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    req<{ connections?: Row[] }>(`/connections/${signer.address}`)
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
