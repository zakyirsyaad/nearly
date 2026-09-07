import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View,
} from "react-native";
import { likeTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { getFeed, postLike, type FeedPost } from "../../src/feed-api";
import { alasanMuncul, feedErrorMessage } from "../../src/messages";

export default function FeedScreen() {
  const signer = useMemo(
    // Domain feed terikat ke ConnectionRegistry, BUKAN AttendanceRegistry.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

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

  async function suka(p: FeedPost) {
    const berikutnya = !p.sudahSuka;
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig = await signer.signTypedData(likeTypedData(
        { postId: p.postId, who: signer.address, suka: berikutnya, expiresAt },
        CONFIG.verifyingContract,
      ));
      await postLike(p.postId, {
        postId: p.postId, who: signer.address, suka: berikutnya,
        expiresAt: expiresAt.toString(), sig,
      });
      // Muat ulang dari server, bukan menebak di klien: jumlah suka milik
      // server, dan menebaknya membuat layar berbohong soal keadaan nyata.
      await muat();
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Gagal menyukai.");
    }
  }

  if (posts === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Link href="/feed/new" style={s.tulis}>Tulis sesuatu</Link>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        ListEmptyComponent={<Text style={s.kosong}>Belum ada unggahan.</Text>}
        renderItem={({ item: p }) => (
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
            <Pressable onPress={() => void suka(p)} hitSlop={8}>
              <Text style={s.suka}>{p.sudahSuka ? "♥" : "♡"} {p.likeCount}</Text>
            </Pressable>
          </View>
        )}
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
  suka: { fontSize: 15, paddingTop: 4 },
});
