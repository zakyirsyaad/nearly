import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, likeTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { getFeed, postImage, postLike, type FeedPost } from "../../src/feed-api";
import {
  bisaHapus, hapusUnggahan, laporUnggahan, MASA_BERLAKU_DETIK,
} from "../../src/feed-actions";
import { mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG } from "../../src/gambar";
import { alasanMuncul, feedErrorMessage } from "../../src/messages";

export default function FeedScreen() {
  const signer = useMemo(
    // Domain feed terikat ke ConnectionRegistry, BUKAN AttendanceRegistry.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Hapus tidak bisa dibatalkan, jadi butuh dua ketukan. Disimpan sebagai
  // postId, bukan boolean, supaya konfirmasi satu kartu tidak menyalakan
  // konfirmasi kartu lain.
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const { posts } = await getFeed(signer.address);
      setPosts(posts);
      setPesan(null);
    } catch (e) {
      setPosts([]);
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Feed gagal dimuat.");
    }
  }, [signer.address]);

  useEffect(() => { void muat(); }, [muat]);
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  /**
   * Satu jalur galat untuk semua aksi kartu: ApiError diterjemahkan
   * feedErrorMessage, selebihnya kalimat cadangan. Setelah aksi berhasil,
   * SELALU muat ulang dari server — keadaan feed milik server, dan menebaknya
   * di klien membuat layar berbohong.
   */
  async function jalankan(aksi: () => Promise<void>, gagal: string) {
    try {
      await aksi();
      setKonfirmasiHapus(null);
      await muat();
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : gagal);
    }
  }

  const suka = (p: FeedPost) => jalankan(async () => {
    const berikutnya = !p.sudahSuka;
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + MASA_BERLAKU_DETIK);
    const sig = await signer.signTypedData(likeTypedData(
      { postId: p.postId, who: signer.address, suka: berikutnya, expiresAt },
      CONFIG.verifyingContract,
    ));
    await postLike(p.postId, {
      postId: p.postId, who: signer.address, suka: berikutnya,
      expiresAt: expiresAt.toString(), sig,
    });
  }, "Gagal menyukai.");

  const lapor = (p: FeedPost) => jalankan(
    () => laporUnggahan(signer, p.postId, CONFIG.verifyingContract),
    "Gagal melaporkan unggahan.",
  );

  const hapus = (p: FeedPost) => jalankan(
    () => hapusUnggahan(signer, p.postId, CONFIG.verifyingContract),
    "Gagal menghapus unggahan.",
  );

  /**
   * Coba unggah lagi setelah `image_status` jadi `failed`. Layar feed TIDAK
   * memegang byte gambar aslinya — byte itu hanya pernah ada di layar tulis
   * dan tidak pernah sampai ke Greenfield, justru karena unggahannya gagal.
   * Jadi tombol ini meminta gambarnya dipilih ulang, bukan berpura-pura bisa
   * mengulang sendiri. Server memang mengizinkan ini: attachImage menerima
   * status `failed` (spec §9.1).
   */
  const unggahUlang = (p: FeedPost) => jalankan(async () => {
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

    const mime = mimeGambarDiterima(aset.mimeType);
    if (!mime) {
      setPesan(PESAN_FORMAT_TIDAK_DIDUKUNG);
      return;
    }

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + MASA_BERLAKU_DETIK);
    const sig = await signer.signTypedData(lampirGambarTypedData(
      { postId: p.postId, author: signer.address, mime, expiresAt },
      CONFIG.verifyingContract,
    ));
    await postImage(p.postId, {
      postId: p.postId, author: signer.address, mime,
      expiresAt: expiresAt.toString(), sig, dataBase64: aset.base64,
    });
  }, "Gagal mengunggah gambar.");

  if (posts === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Link href="/feed/new" style={s.tulis}>Tulis sesuatu</Link>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        ListEmptyComponent={<Text style={s.kosong}>Belum ada unggahan.</Text>}
        renderItem={({ item: p }) => {
          const milikku = bisaHapus(p.author, signer.address);
          return (
            <View style={s.kartu}>
              <Text style={s.nama}>{p.displayName.trim() || p.author}</Text>
              {/* Spec §10.3 — kartu harus menjelaskan kenapa ia muncul. */}
              <Text style={s.alasan}>{alasanMuncul(p.hop, p.displayName)}</Text>
              <Text style={s.isi}>{p.body}</Text>
              {p.imageStatus === "ready" && p.imageUrl
                ? <Image source={{ uri: p.imageUrl }} style={s.gambar} resizeMode="cover" />
                : null}
              {p.imageStatus === "pending"
                ? <Text style={s.catatan}>Gambar sedang diunggah…</Text> : null}
              {p.imageStatus === "failed"
                ? <Text style={s.catatan}>Gambar gagal diunggah.</Text> : null}

              <View style={s.aksi}>
                <Pressable onPress={() => void suka(p)} hitSlop={8}>
                  <Text style={s.tombol}>{p.sudahSuka ? "♥" : "♡"} {p.likeCount}</Text>
                </Pressable>

                <Pressable onPress={() => void lapor(p)} hitSlop={8}>
                  <Text style={s.tombol}>Lapor</Text>
                </Pressable>

                {milikku && (
                  <Pressable
                    onPress={() => (konfirmasiHapus === p.postId
                      ? void hapus(p)
                      : setKonfirmasiHapus(p.postId))}
                    hitSlop={8}
                  >
                    <Text style={s.tombol}>
                      {konfirmasiHapus === p.postId ? "Yakin hapus?" : "Hapus"}
                    </Text>
                  </Pressable>
                )}

                {milikku && p.imageStatus === "failed" && (
                  <Pressable onPress={() => void unggahUlang(p)} hitSlop={8}>
                    <Text style={s.tombol}>Pilih ulang gambar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  tulis: { fontSize: 17, paddingVertical: 8 },
  pesan: { fontSize: 14, opacity: 0.8 },
  kosong: { fontSize: 15, opacity: 0.6, paddingVertical: 24 },
  kartu: { paddingVertical: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 15, fontWeight: "600" },
  alasan: { fontSize: 12, opacity: 0.6 },
  isi: { fontSize: 15, lineHeight: 21 },
  gambar: { width: "100%", height: 200, borderRadius: 12 },
  catatan: { fontSize: 12, opacity: 0.6, fontStyle: "italic" },
  aksi: { flexDirection: "row", gap: 18, paddingTop: 4, flexWrap: "wrap" },
  tombol: { fontSize: 15 },
});
