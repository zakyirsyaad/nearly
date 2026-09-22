import { useState } from "react";
import { useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, makePostId, postTypedData } from "@nearly/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { postImage, postPost } from "../../../../src/feed-api";
import { feedErrorMessage } from "../../../../src/messages";
import {
  mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG, type MimeGambar,
} from "../../../../src/gambar";
import {
  labelGambar, labelUnggah, PLACEHOLDER_TULIS, TEKS_GAGAL_UNGGAH, TEKS_IZIN_GALERI,
  TEKS_TERBIT_GAMBAR_GAGAL, TEKS_UNGGAHAN_TERKIRIM,
} from "../../../../src/teks-feed";
import { teksSisaKarakter } from "../../../../src/teks-ui";

const MAKS = 500;

export default function TulisScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <TulisScreenIsi key={signer.address} signer={signer} />;
}

function TulisScreenIsi({ signer }: { signer: NearlySigner }) {
  const router = useRouter();
  const kabar = useKabar();
  const [teks, setTeks] = useState("");
  const [gambar, setGambar] =
    useState<{ uri: string; base64: string; mime: MimeGambar } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function pilihGambar() {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setPesan(TEKS_IZIN_GALERI);
      return;
    }
    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.7,
    });
    const aset = hasil.assets?.[0];
    if (hasil.canceled || !aset?.base64) return;

    // DITOLAK, bukan dilabeli ulang: HEIC atau WebP yang naik berlabel JPEG
    // tidak akan pernah tampil. `mime` diikat tanda tangan LampirGambar
    // justru supaya tidak bisa diselewengkan — kliennya sendiri tidak boleh
    // jadi yang menyelewengkan.
    const mime = mimeGambarDiterima(aset.mimeType);
    if (!mime) {
      setPesan(PESAN_FORMAT_TIDAK_DIDUKUNG);
      return;
    }
    setPesan(null);
    setGambar({ uri: aset.uri, base64: aset.base64, mime });
  }

  async function kirim() {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const postId = makePostId();
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig = await signer.signTypedData(postTypedData(
        { postId, author: signer.address, body: teks, expiresAt }, CONFIG.verifyingContract,
      ));
      await postPost({
        postId, author: signer.address, body: teks,
        expiresAt: expiresAt.toString(), sig,
      });

      // Gambar dikirim SETELAH teks terbit, dan kegagalannya tidak membatalkan
      // unggahan (spec §8.2). Tanda tangannya tipe LampirGambar yang terpisah.
      if (gambar) {
        try {
          const expGambar = BigInt(Math.floor(Date.now() / 1000) + 300);
          const sigGambar = await signer.signTypedData(lampirGambarTypedData(
            { postId, author: signer.address, mime: gambar.mime, expiresAt: expGambar },
            CONFIG.verifyingContract,
          ));
          await postImage(postId, {
            postId, author: signer.address, mime: gambar.mime,
            expiresAt: expGambar.toString(), sig: sigGambar, dataBase64: gambar.base64,
          });
        } catch {
          setPesan(TEKS_TERBIT_GAMBAR_GAGAL);
        }
      }
      // Teksnya SUDAH terbit (Ruling B2-6).
      kabar.berhasil(TEKS_UNGGAHAN_TERKIRIM);
      router.replace("/feed");
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : TEKS_GAGAL_UNGGAH);
    } finally {
      setSibuk(false);
    }
  }

  const sisa = MAKS - teks.length;

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Input
        type="textarea"
        rows={5}
        maxLength={MAKS}
        placeholder={PLACEHOLDER_TULIS}
        accessibilityLabel={PLACEHOLDER_TULIS}
        value={teks}
        onChangeText={setTeks}
      />
      <Text variant="caption" style={s.kanan}>{teksSisaKarakter(sisa)}</Text>
      {gambar ? <Image source={{ uri: gambar.uri }} style={s.pratinjau} resizeMode="cover" /> : null}
      <Button variant="outline" onPress={() => void pilihGambar()}>{labelGambar(gambar !== null)}</Button>
      <Button loading={sibuk} disabled={sibuk || teks.trim().length === 0} onPress={() => void kirim()}>
        {labelUnggah(sibuk)}
      </Button>
      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 12 },
  kanan: { textAlign: "right" },
  pratinjau: { width: "100%", height: 180, borderRadius: RADIUS.kartu },
});
