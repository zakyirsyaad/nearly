import { useCallback, useMemo, useRef, useState } from "react";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { MAKS_ISI_PESAN } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { aksiBlokir } from "../../src/blokir-actions";
import { sesiPesan } from "../../src/pesan/sesi";
import { getRiwayat, postDibaca } from "../../src/pesan/pesan-api";
import { bukaBaris, kirimPesan, kunciLawan, type PesanTerbuka } from "../../src/pesan/pesan-actions";
import {
  blokirErrorMessage, labelKirimPesan, pesanErrorMessage, sisaKarakterPesan,
} from "../../src/messages";

export default function PercakapanScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [daftar, setDaftar] = useState<PesanTerbuka[] | null>(null);
  const [isi, setIsi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const ditandaiSampai = useRef(0);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Terbaru dulu — FlatList `inverted` menaruhnya di bawah.
    setDaftar(pesan.map((b) => bukaBaris(sesi, k, b)));
    setGalat(null);

    const masukTerbaru = pesan.find((b) => b.pengirim.toLowerCase() === lawan.toLowerCase());
    if (masukTerbaru && masukTerbaru.createdAtMs > ditandaiSampai.current) {
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
    }
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      setDaftar((d) => d ?? []);
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Percakapan gagal dimuat.");
    });
    void jalankan();
    // Polling hanya selama layar aktif (spec 4c §9): pembersih di bawah
    // menghentikannya saat layar kehilangan fokus.
    const t = setInterval(() => { void jalankan(); }, 4_000);
    return () => { aktif = false; clearInterval(t); };
  }, [muat]));

  async function kirim() {
    if (sibuk || isi.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await kirimPesan(await sesiPesan(signer), lawan, isi);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : "Pesan gagal dikirim.");
      setSibuk(false);
      return;
    }
    setIsi("");
    setSibuk(false);
    // Pesannya SUDAH tersimpan. Gagal memuat ulang bukan kegagalan kirim —
    // polling berikutnya akan menampilkannya.
    muat().catch(() => {});
  }

  function blokir() {
    Alert.alert(
      "Blokir orang ini?",
      "Laporkan dulu kalau perlu — setelah diblokir, pesannya tidak bisa dipilih lagi sampai blokir dicabut.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Blokir",
          style: "destructive",
          onPress: () => {
            aksiBlokir(signer, lawan, false)
              .then(() => router.replace("/pesan"))
              .catch((e: unknown) => setGalat(
                e instanceof ApiError ? blokirErrorMessage(e.code) : "Gagal memblokir."));
          },
        },
      ],
    );
  }

  const sisa = sisaKarakterPesan(isi);

  if (daftar === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: "Pesan" }} />
      <Text style={s.alamat}>{lawan}</Text>
      <View style={s.aksi}>
        <Button title="Lapor" onPress={() => router.push(`/pesan/lapor/${lawan}`)} />
        <Button title="Blokir" color="#b00" onPress={blokir} />
      </View>
      {galat && <Text style={s.galat}>{galat}</Text>}
      <FlatList
        inverted
        style={s.daftar}
        data={daftar}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={[s.gelembung, item.dariAku ? s.milikku : s.milikLawan]}>
            <Text style={item.status === "sah" ? s.teks : s.tidakSah}>
              {item.status === "sah" ? item.isi : "Pesan tidak bisa diverifikasi"}
            </Text>
          </View>
        )}
      />
      <View style={s.tulis}>
        <TextInput
          style={s.input}
          value={isi}
          onChangeText={setIsi}
          placeholder="Tulis pesan"
          multiline
          maxLength={MAKS_ISI_PESAN}
        />
        <Button
          title={labelKirimPesan(sibuk)}
          disabled={sibuk || isi.trim().length === 0 || sisa < 0}
          onPress={() => { void kirim(); }}
        />
      </View>
      {sisa < 100 && <Text style={s.sisa}>{sisa} karakter tersisa</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 8 },
  tengah: { flex: 1 },
  alamat: { fontFamily: "monospace", fontSize: 11, color: "#666" },
  aksi: { flexDirection: "row", justifyContent: "space-between" },
  galat: { color: "#b00" },
  daftar: { flex: 1 },
  gelembung: { maxWidth: "80%", padding: 10, borderRadius: 12, marginVertical: 3 },
  milikku: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  milikLawan: { alignSelf: "flex-start", backgroundColor: "#f1f1f1" },
  teks: { color: "#111" },
  tidakSah: { color: "#b00", fontStyle: "italic" },
  tulis: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, maxHeight: 120 },
  sisa: { color: "#666", fontSize: 12, textAlign: "right" },
});
