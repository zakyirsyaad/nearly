import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { Users } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../src/http";
import {
  getKecocokan, kueriBuktiKecocokan, tandaiKecocokanDilihat, type BarisKecocokan,
} from "../../../src/meet-api";
import { meetErrorMessage } from "../../../src/messages";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import {
  KOSONG_KECOCOKAN, LENCANA_SALING_INGIN_BERTEMU, TEKS_GAGAL_KECOCOKAN,
} from "../../../src/teks-akun";

export default function KecocokanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <KecocokanScreenIsi key={signer.address} signer={signer} />;
}

function KecocokanScreenIsi({ signer }: { signer: NearlySigner }) {
  const [baris, setBaris] = useState<BarisKecocokan[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const { muatUlangLencana } = useLencana();

  const muat = useCallback(async () => {
    try {
      const { kecocokan } = await getKecocokan(await kueriBuktiKecocokan(signer));
      setBaris(kecocokan);
      setPesan(null);
      // Membuka layar ini MENANDAI sudah dilihat. Kegagalannya tidak boleh
      // mengosongkan daftar yang sudah berhasil dimuat.
      await tandaiKecocokanDilihat(signer).catch(() => {});
      // Titik lencana tab Profil hilang sekarang, bukan 30 detik lagi (spec §4.4).
      muatUlangLencana();
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_KECOCOKAN);
    }
  }, [signer, muatUlangLencana]);

  // SATU pemicu, bukan dua. `useFocusEffect` sudah menyala saat layar pertama
  // kali fokus — yaitu saat mount — jadi `useEffect` di sini akan menjadi
  // duplikat: dua tanda tangan `LihatKecocokan`, dua `GET /kecocokan`, dan dua
  // `POST /kecocokan/dilihat` yang berlomba setiap kali layar dibuka.
  //
  // Fokus juga yang membuat pesan `butuh_bukti` jujur: ia menjanjikan "reload
  // this screen to try again", dan `muat` memoized pada `signer` yang tidak
  // pernah berubah.
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  if (baris === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={baris}
      keyExtractor={(k) => k.address}
      ListHeaderComponent={pesan ? <Text variant="caption">{pesan}</Text> : null}
      ListEmptyComponent={
        // Kalau `pesan` terisi (mis. 403 butuh_bukti), daftar kosong ini BUKAN
        // berarti "belum ada kecocokan" — itu kegagalan otorisasi. Menampilkan
        // keadaan kosong di atas pesan galat akan membuat kegagalan terlihat
        // seperti keadaan normal.
        pesan ? null : (
          <KeadaanKosong Ikon={Users} kalimat={KOSONG_KECOCOKAN} />
        )
      }
      renderItem={({ item: k }) => (
        <KartuOrang
          nama={k.displayName}
          alamat={k.address}
          terverifikasi={false}
          lencana={<Lencana varian="teks" teks={LENCANA_SALING_INGIN_BERTEMU} />}
          tier={k.tier}
          onPress={() => router.push(`/profile/${k.address}`)}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, gap: 12 },
});
