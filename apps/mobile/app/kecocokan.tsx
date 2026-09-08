import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { TIER_LABELS } from "@nearly/trust";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { ApiError } from "../src/http";
import {
  getKecocokan, kueriBuktiKecocokan, tandaiKecocokanDilihat, type BarisKecocokan,
} from "../src/meet-api";
import { meetErrorMessage } from "../src/messages";

export default function KecocokanScreen() {
  const signer = useMemo(
    // Domain meet terikat ke ConnectionRegistry, sama seperti tipe feed.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [baris, setBaris] = useState<BarisKecocokan[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const { kecocokan } = await getKecocokan(await kueriBuktiKecocokan(signer));
      setBaris(kecocokan);
      setPesan(null);
      // Membuka layar ini MENANDAI sudah dilihat. Kegagalannya tidak boleh
      // mengosongkan daftar yang sudah berhasil dimuat.
      await tandaiKecocokanDilihat(signer).catch(() => {});
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : "Kecocokan gagal dimuat.");
    }
  }, [signer]);

  // SATU pemicu, bukan dua. `useFocusEffect` sudah menyala saat layar pertama
  // kali fokus — yaitu saat mount — jadi `useEffect` di sini akan menjadi
  // duplikat, bukan pelengkap: dua tanda tangan `LihatKecocokan`, dua
  // `GET /kecocokan`, dan dua `POST /kecocokan/dilihat` yang berlomba setiap
  // kali layar dibuka. Di feed duplikat semacam itu cuma GET yang mubazir; di
  // sini ia menggandakan operasi kripto dan tulisan, ongkos yang di tempat
  // lain repo ini perlakukan sebagai sengaja ("satu tanda tangan per
  // pembukaan").
  //
  // Fokus juga yang membuat pesan `butuh_bukti` jujur: ia menjanjikan "muat
  // ulang layar ini untuk mencoba lagi", dan `muat` memoized pada `signer`
  // yang tidak pernah berubah, jadi tanpa pemicu fokus tidak ada jalan keluar
  // selain menutup aplikasi.
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(k) => k.address}
        ListEmptyComponent={
          // Kalau `pesan` terisi (mis. 403 butuh_bukti), daftar kosong ini BUKAN
          // berarti "belum ada kecocokan" — itu kegagalan otorisasi. Menampilkan
          // teks kosong di atas pesan galat akan membuat kegagalan terlihat
          // seperti keadaan normal, padahal harus tampil sebagai galat yang bisa
          // ditindaklanjuti (muat ulang), bukan pernah sebagai keadaan kosong.
          pesan ? null : (
            <Text style={s.kosong}>
              Belum ada yang saling menandai denganmu. Tandai orang yang ingin kamu temui —
              kalau dia menandaimu balik, kalian akan saling tahu.
            </Text>
          )
        }
        renderItem={({ item: k }) => (
          <View style={s.kartu}>
            <Text style={s.nama}>{k.displayName.trim() || k.address}</Text>
            <Text style={s.meta}>{TIER_LABELS[k.tier] ?? TIER_LABELS[0]}</Text>
            <Text style={s.saling}>Kalian saling ingin bertemu.</Text>
            {/*
              TIDAK ADA tombol pesan, dan itu disengaja (spec §4.2). Pesan baru
              datang di Fase 4. Yang bisa dilakukan cuma melihat profilnya dan
              pergi menemuinya — persis tesis spec induk §7.4.
            */}
            <Link href={`/profile/${k.address}`} style={s.tautan}>Lihat profil</Link>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  pesan: { fontSize: 14, opacity: 0.8 },
  kosong: { fontSize: 15, lineHeight: 22, opacity: 0.6, paddingVertical: 24 },
  kartu: { paddingVertical: 14, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 12, opacity: 0.6 },
  saling: { fontSize: 14, paddingTop: 2 },
  tautan: { fontSize: 15, paddingTop: 6 },
});
