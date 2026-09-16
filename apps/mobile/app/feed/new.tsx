import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Image, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, makePostId, postTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { postImage, postPost } from "../../src/feed-api";
import { feedErrorMessage } from "../../src/messages";
import {
  mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG, type MimeGambar,
} from "../../src/gambar";
import { WARNA } from "../../src/warna";

const MAKS = 500;

export default function TulisScreen() {
  const router = useRouter();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [teks, setTeks] = useState("");
  const [gambar, setGambar] =
    useState<{ uri: string; base64: string; mime: MimeGambar } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function pilihGambar() {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setPesan("Nearly butuh izin galeri untuk melampirkan gambar.");
      return;
    }
    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.7,
    });
    const aset = hasil.assets?.[0];
    if (hasil.canceled || !aset?.base64) return;

    // DITOLAK, bukan dilabeli ulang. Bentuk lamanya memaksa apa pun yang
    // bukan PNG menjadi "image/jpeg", sehingga HEIC atau WebP dari galeri
    // naik berlabel JPEG dan gambarnya tidak akan pernah tampil. `mime`
    // diikat tanda tangan LampirGambar justru supaya tidak bisa
    // diselewengkan — kliennya sendiri tidak boleh jadi yang menyelewengkan.
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
          setPesan("Teks terbit, tapi gambarnya gagal dikirim. Coba lampirkan lagi nanti.");
        }
      }
      router.replace("/feed");
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Gagal mengunggah.");
    } finally {
      setSibuk(false);
    }
  }

  const sisa = MAKS - teks.length;

  return (
    <View style={s.root}>
      <TextInput
        style={[s.input, { color: WARNA.teks }]}
        placeholderTextColor={WARNA.placeholder}
        multiline
        maxLength={MAKS}
        placeholder="Apa yang lagi kamu bangun?"
        value={teks}
        onChangeText={setTeks}
      />
      <Text style={s.hitung}>{sisa} karakter tersisa</Text>
      {gambar && <Image source={{ uri: gambar.uri }} style={s.pratinjau} resizeMode="cover" />}
      <Button title={gambar ? "Ganti gambar" : "Tambah gambar"} onPress={() => void pilihGambar()} />
      <Button
        title={sibuk ? "Mengirim…" : "Unggah"}
        onPress={() => void kirim()}
        disabled={sibuk || teks.trim().length === 0}
      />
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  input: { minHeight: 120, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  hitung: { fontSize: 12, opacity: 0.6 },
  pratinjau: { width: "100%", height: 180, borderRadius: 12 },
  pesan: { fontSize: 14, opacity: 0.8 },
});
