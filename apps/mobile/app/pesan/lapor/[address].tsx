import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../../../src/config";
import { createDevSigner } from "../../../src/signer";
import { ApiError } from "../../../src/http";
import { aksiBlokir } from "../../../src/blokir-actions";
import { sesiPesan } from "../../../src/pesan/sesi";
import { getRiwayat } from "../../../src/pesan/pesan-api";
import {
  bukaBaris, kunciLawan, laporanSiapDikirim, laporkanPercakapan, MAKS_BUKTI_LAPORAN,
  type PesanTerbuka,
} from "../../../src/pesan/pesan-actions";
import { blokirErrorMessage, pesanErrorMessage } from "../../../src/messages";

type PesanSah = Extract<PesanTerbuka, { status: "sah" }>;

export default function LaporPesanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [masuk, setMasuk] = useState<PesanSah[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Hanya pesan MASUK yang terverifikasi yang bisa jadi bukti — server menolak
    // yang lain dengan 422 (spec 4c §8.2).
    setMasuk(pesan.map((b) => bukaBaris(sesi, k, b))
      .filter((p): p is PesanSah => !p.dariAku && p.status === "sah"));
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    muat().catch((e: unknown) => {
      if (!aktif) return;
      setMasuk([]);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Pesan gagal dimuat.");
    });
    return () => { aktif = false; };
  }, [muat]));

  function alih(id: string) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else if (baru.size < MAKS_BUKTI_LAPORAN) baru.add(id);
      return baru;
    });
  }

  async function kirim() {
    if (sibuk || !masuk || !laporanSiapDikirim(dipilih.size, alasan)) return;
    setSibuk(true);
    setGalat(null);
    const bukti = masuk.filter((p) => dipilih.has(p.id))
      .map((p) => ({ pesanId: p.id, isi: p.isi, dikirimMs: p.dikirimMs, tanda: p.tanda }));
    try {
      await laporkanPercakapan(signer, lawan, alasan, bukti);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Laporan gagal dikirim.");
      setSibuk(false);
      return;
    }
    setSibuk(false);
    Alert.alert("Laporan terkirim", "Laporanmu akan ditinjau. Blokir orang ini juga?", [
      { text: "Nanti", style: "cancel", onPress: () => router.back() },
      {
        text: "Blokir",
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            // Laporannya SUDAH terkirim — jangan katakan sebaliknya.
            .catch((e: unknown) => setGalat(e instanceof ApiError
              ? `Laporan terkirim, tapi gagal memblokir: ${blokirErrorMessage(e.code)}`
              : "Laporan terkirim, tapi gagal memblokir."));
        },
      },
    ]);
  }

  if (masuk === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Text style={s.peringatan}>
        Pesan yang kamu pilih akan bisa dibaca peninjau. Pesan lain tetap terenkripsi.
      </Text>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <Text style={s.label}>Pilih 1–{MAKS_BUKTI_LAPORAN} pesan sebagai bukti</Text>
      <FlatList
        style={s.daftar}
        data={masuk}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={galat ? null : <Text style={s.kosong}>Tidak ada pesan masuk yang bisa dijadikan bukti.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => alih(item.id)} style={s.baris}>
            <Text style={s.kotak}>{dipilih.has(item.id) ? "☑" : "☐"}</Text>
            <Text style={s.isi}>{item.isi}</Text>
          </Pressable>
        )}
      />
      <TextInput
        style={s.input}
        value={alasan}
        onChangeText={setAlasan}
        placeholder="Alasan (minimal 10 karakter)"
        multiline
        maxLength={1000}
      />
      <Button
        title={sibuk ? "Mengirim…" : "Kirim laporan"}
        disabled={sibuk || !laporanSiapDikirim(dipilih.size, alasan)}
        onPress={() => { void kirim(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  tengah: { flex: 1 },
  peringatan: { backgroundColor: "#fff4e5", padding: 10, borderRadius: 8, color: "#7a4a00" },
  galat: { color: "#b00" },
  label: { fontWeight: "600" },
  daftar: { flex: 1 },
  kosong: { color: "#666" },
  baris: { flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  kotak: { fontSize: 18 },
  isi: { flex: 1 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, minHeight: 60 },
});
