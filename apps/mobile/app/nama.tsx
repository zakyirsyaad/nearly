import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { periksaNamaTampilan } from "@nearly/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { CONFIG } from "../src/config";
import type { NearlySigner } from "../src/signer";
import { useDompet, useNearlySigner } from "../src/dompet/konteks-dompet";
import { pesanNamaTidakSah } from "../src/messages";
import { simpanProfil } from "../src/radar/radar-api";
import {
  CATATAN_NAMA, JUDUL_ISI_NAMA, KALIMAT_ISI_NAMA, LABEL_NAMA_TAMPILAN,
  PLACEHOLDER_ISI_NAMA, TEKS_GAGAL_SIMPAN, TEKS_LANJUT,
} from "../src/teks-akun";

/**
 * Gerbang nama (keputusan pemilik 2026-09-24). Muncul setelah dompet siap —
 * dibuat baru maupun diimpor — selama nama tampilan masih kosong, dan tidak
 * bisa dilewati: selama nama kosong, layar inilah SATU-SATUNYA layar akar yang
 * terdaftar (`layarMenurutDompet` + `RUTE_GERBANG_NAMA`), jadi tidak ada
 * tombol kembali maupun tautan dalam yang bisa memutarinya.
 *
 * Gerbangnya tetap gagal-terbuka: kalau aplikasi tidak bisa menanyakan nama ke
 * server (offline), layar ini tidak muncul sama sekali — lihat
 * `src/nama-gerbang.ts`.
 */
export default function NamaScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  if (!signer) return null;
  return <NamaScreenIsi key={signer.address} signer={signer} />;
}

function NamaScreenIsi({ signer }: { signer: NearlySigner }) {
  const { tandaiNama } = useDompet();
  const [nama, setNama] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const cek = periksaNamaTampilan(nama);
  // Tombol mati untuk nama kosong: di sinilah "wajib" itu hidup.
  const bolehLanjut = cek.ok && cek.nama.length > 0 && !sibuk;

  async function simpan() {
    if (!bolehLanjut) {
      if (!cek.ok) setPesan(pesanNamaTidakSah(cek.alasan));
      return;
    }
    setSibuk(true);
    try {
      // Visibilitas bawaan akun baru (spec 4b+5 §3): "terlihat". Layar ini
      // tidak menanyakannya supaya gerbangnya tetap satu keputusan; saklarnya
      // ada di Profil.
      await simpanProfil(signer, { displayName: cek.nama, visibilitas: "terlihat" });
      tandaiNama(cek.nama);
      router.replace("/");
    } catch {
      // Error.message tidak pernah dirender (review B1 #I1).
      setPesan(TEKS_GAGAL_SIMPAN);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={s.flex}>
      <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
        <View style={s.blok}>
          <Text variant="title">{JUDUL_ISI_NAMA}</Text>
          <Text variant="body">{KALIMAT_ISI_NAMA}</Text>
        </View>

        <View style={s.blok}>
          <Text variant="caption">{LABEL_NAMA_TAMPILAN}</Text>
          <Input
            value={nama}
            onChangeText={(t) => { setNama(t); setPesan(null); }}
            placeholder={PLACEHOLDER_ISI_NAMA}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => void simpan()}
          />
          <Text variant="caption">{CATATAN_NAMA}</Text>
          {pesan ? <Text variant="caption">{pesan}</Text> : null}
        </View>

        <Button disabled={!bolehLanjut} onPress={() => void simpan()}>{TEKS_LANJUT}</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 24 },
  blok: { gap: 8 },
});
