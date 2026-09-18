import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../src/config";
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
import { ApiError } from "../src/http";
import { getBlokir, kueriBuktiBlokir, type BarisBlokir } from "../src/blokir-api";
import { aksiBlokir } from "../src/blokir-actions";
import { blokirErrorMessage, blokirTombolLabel } from "../src/messages";

export default function BlokirScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <BlokirScreenIsi key={signer.address} signer={signer} />;
}

function BlokirScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<BarisBlokir[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  // TIDAK menangkap galatnya sendiri: pemanggil (pemicu fokus di bawah, dan
  // `cabut`) yang memutuskan apa arti kegagalan di konteks masing-masing.
  // Kalau fungsi ini menangkap sendiri, `catch` di sekitar `await muat()` di
  // `cabut` jadi kode mati — padahal justru DI SANA kegagalan reload berarti
  // sesuatu yang berbeda dari kegagalan muat pertama kali (lihat komentar di
  // `cabut`).
  const muat = useCallback(async () => {
    const { blokir } = await getBlokir(await kueriBuktiBlokir(signer));
    setBaris(blokir);
    setPesan(null);
  }, [signer]);

  // SATU pemicu. `useFocusEffect` sudah menyala saat layar pertama kali
  // fokus — yaitu saat mount — jadi `useEffect` di sebelahnya akan jadi
  // duplikat: dua tanda tangan dan dua permintaan setiap layar dibuka.
  //
  // Galat dari `muat` ditangani DI SINI, bukan di dalam `muat`, supaya muat
  // pertama kali yang gagal mengosongkan daftar dan menampilkan pesan galat —
  // beda dengan reload di dalam `cabut`, yang tidak boleh mengosongkan daftar
  // yang barusan berhasil diperbarui aksinya.
  useFocusEffect(useCallback(() => {
    muat().catch((e) => {
      setBaris([]);
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : "Daftar blokir gagal dimuat.");
    });
  }, [muat]));

  async function cabut(alamat: string) {
    if (sibuk) return;
    setSibuk(alamat);
    setPesan(null);
    try {
      await aksiBlokir(signer, alamat as Address, true);
    } catch (e) {
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : "Gagal mencabut blokir.");
      setSibuk(null);
      return;
    }
    setSibuk(null);
    try {
      await muat();
    } catch {
      // Pencabutannya SUDAH tersimpan. Mengatakan "gagal mencabut" di sini
      // akan berbohong tentang aksi yang berhasil — jadi baris yang dicabut
      // dibuang dari state lokal (tanpa membuang seluruh daftar) dan
      // pesannya jujur: aksinya berhasil, cuma daftarnya yang gagal segar.
      setBaris((b) => b?.filter((x) => x.address !== alamat) ?? b);
      setPesan("Blokir sudah dicabut, tapi daftarnya gagal dimuat ulang.");
    }
  }

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(b) => b.address}
        ListEmptyComponent={
          // Kalau `pesan` terisi, daftar kosong ini BUKAN berarti "kamu tidak
          // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
          // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
          // pengguna.
          pesan ? null : (
            <Text style={s.kosong}>
              Kamu belum memblokir siapa pun. Blokir bisa dipasang dari layar profil seseorang.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={s.kartu}>
            <Text style={s.alamat}>{item.address}</Text>
            <Button
              // `true` tetap: setiap baris di layar ini, by construction, adalah
              // orang yang sudah diblokir pengguna.
              title={blokirTombolLabel(true, sibuk === item.address)}
              disabled={sibuk === item.address}
              onPress={() => { void cabut(item.address); }}
            />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  pesan: { color: "#b00", marginBottom: 8 },
  kosong: { color: "#666", lineHeight: 20 },
  kartu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", gap: 8 },
  alamat: { fontFamily: "monospace", fontSize: 12 },
});
