import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Hex } from "viem";
import { KeadaanGalat } from "@/components/keadaan";
import { TautanKecil } from "@/components/tautan-kecil";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { getPost, kueriBuktiFeed, type FeedPost } from "../../../../src/feed-api";
import {
  bisaHapus, hapusUnggahan, laporUnggahan, sukaUnggahan,
} from "../../../../src/feed-actions";
import {
  alamatSingkat, alasanMuncul, feedErrorMessage, namaKartuRadar,
} from "../../../../src/messages";
import {
  labelHapus, labelSuka, TEKS_GAGAL_HAPUS_UNGGAHAN, TEKS_GAGAL_LAPOR_UNGGAHAN,
  TEKS_GAGAL_MUAT_FEED, TEKS_GAGAL_SUKA, TEKS_GAMBAR_DIUNGGAH, TEKS_GAMBAR_GAGAL,
  TEKS_UNGGAHAN_HILANG,
} from "../../../../src/teks-feed";
import { TEKS_LAPOR } from "../../../../src/teks-profil";
import { waktuRelatif } from "../../../../src/waktu";

/**
 * Detail satu unggahan (2026-09-24). Ada karena kartu feed memotong dua hal:
 * teksnya dipotong dua baris dan fotonya dipangkas jadi jalur 200 px. Di sini
 * keduanya utuh — foto memakai rasio aslinya, dibaca dari `onLoad`, karena
 * server tidak menyimpan dimensi gambar.
 *
 * Datanya diambil ulang dari `GET /posts/:id`, bukan dioper lewat parameter
 * navigasi: layar ini juga terbuka dari tautan dalam dan setelah aplikasi
 * dimuat ulang, dan keadaan unggahan (suka, laporan, hapus) milik server.
 */
export default function DetailUnggahan() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet (Ruling D4).
  if (!signer) return null;
  return <DetailUnggahanIsi key={signer.address} signer={signer} />;
}

function DetailUnggahanIsi({ signer }: { signer: NearlySigner }) {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [rasio, setRasio] = useState<number | null>(null);

  const muat = useCallback(async () => {
    try {
      setPost(await getPost(postId as Hex, await kueriBuktiFeed(signer)));
      setGalat(null);
    } catch (e) {
      // 404 berarti unggahannya dihapus, dilaporkan cukup banyak, atau
      // penulisnya kena slash — kalimatnya berbeda dari gagal jaringan.
      if (e instanceof ApiError && e.status === 404) setGalat(TEKS_UNGGAHAN_HILANG);
      else setGalat(e instanceof ApiError ? feedErrorMessage(e.code) : TEKS_GAGAL_MUAT_FEED);
    }
  }, [postId, signer]);

  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  async function jalankan(aksi: () => Promise<void>, gagal: string) {
    try {
      await aksi();
      setKonfirmasiHapus(false);
      await muat();
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : gagal);
    }
  }

  if (!post) {
    return (
      <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
        {galat ? <KeadaanGalat kalimat={galat} onCobaLagi={() => void muat()} /> : null}
      </ScrollView>
    );
  }

  const milikku = bisaHapus(post.author, signer.address);

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      <Card style={s.kartu}>
        <Pressable
          onPress={() => router.push(`/profile/${post.author}`)}
          accessibilityRole="button"
          style={s.penulis}
        >
          <Text variant="body" style={s.tebal}>{namaKartuRadar(post.displayName)}</Text>
          {/* Nama tidak pernah tanpa alamat (R4, anti-impersonasi). */}
          <Text variant="mono">{alamatSingkat(post.author)}</Text>
        </Pressable>
        <Text variant="caption">
          {alasanMuncul(post.hop, post.displayName)} · {waktuRelatif(new Date(post.createdAtMs), new Date())}
        </Text>

        {/* Teks UTUH: tidak ada numberOfLines, itulah gunanya layar ini. */}
        <Text variant="body">{post.body}</Text>

        {post.imageStatus === "ready" && post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={[s.gambar, rasio ? { aspectRatio: rasio } : s.gambarSementara]}
            resizeMode="contain"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width > 0 && height > 0) setRasio(width / height);
            }}
          />
        ) : null}
        {post.imageStatus === "pending" ? <Text variant="caption">{TEKS_GAMBAR_DIUNGGAH}</Text> : null}
        {post.imageStatus === "failed" ? <Text variant="caption">{TEKS_GAMBAR_GAGAL}</Text> : null}

        <View style={s.aksi}>
          <TautanKecil
            label={labelSuka(post.sudahSuka, post.likeCount)}
            onPress={() => void jalankan(
              () => sukaUnggahan(signer, post, CONFIG.verifyingContract),
              TEKS_GAGAL_SUKA,
            )}
          />
          <TautanKecil
            label={TEKS_LAPOR}
            onPress={() => void jalankan(
              () => laporUnggahan(signer, post.postId, CONFIG.verifyingContract),
              TEKS_GAGAL_LAPOR_UNGGAHAN,
            )}
          />
          {milikku ? (
            <TautanKecil
              label={labelHapus(konfirmasiHapus)}
              onPress={() => {
                // Dua ketukan: hapus tidak bisa dibatalkan (pola kartu feed).
                if (!konfirmasiHapus) { setKonfirmasiHapus(true); return; }
                void jalankan(async () => {
                  await hapusUnggahan(signer, post.postId, CONFIG.verifyingContract);
                  router.back();
                }, TEKS_GAGAL_HAPUS_UNGGAHAN);
              }}
            />
          ) : null}
        </View>

        {pesan ? <Text variant="caption">{pesan}</Text> : null}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 16 },
  kartu: { gap: 8 },
  penulis: { flexDirection: "row", alignItems: "baseline", columnGap: 8, flexWrap: "wrap" },
  tebal: { fontWeight: "600" },
  gambar: { width: "100%", borderRadius: RADIUS.kartu },
  // Sebelum rasio aslinya diketahui: kotak yang sama dengan kartu feed, jadi
  // tata letaknya tidak melompat saat gambar selesai dimuat.
  gambarSementara: { height: 200 },
  aksi: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
});
