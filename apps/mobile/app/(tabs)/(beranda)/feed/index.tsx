import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { FileText } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, likeTypedData } from "@nearly/shared";
import type { Address } from "viem";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { TautanKecil } from "@/components/tautan-kecil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import {
  getFeed, kueriBuktiFeed, postImage, postLike, type FeedPost,
} from "../../../../src/feed-api";
import {
  bisaHapus, hapusUnggahan, laporUnggahan, MASA_BERLAKU_DETIK,
} from "../../../../src/feed-actions";
import { aksiTanda } from "../../../../src/meet-actions";
import { mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG } from "../../../../src/gambar";
import {
  alamatSingkat, alasanMuncul, feedErrorMessage, meetErrorMessage, meetSuccessMessage,
  namaKartuRadar,
} from "../../../../src/messages";
import {
  KOSONG_FEED, labelHapus, labelSuka, labelTandaFeed, TEKS_GAGAL_HAPUS_UNGGAHAN,
  TEKS_GAGAL_LAPOR_UNGGAHAN, TEKS_GAGAL_MUAT_FEED, TEKS_GAGAL_SUKA, TEKS_GAGAL_UNGGAH_GAMBAR,
  TEKS_GAMBAR_DIUNGGAH, TEKS_GAMBAR_GAGAL, TEKS_IZIN_GALERI, TEKS_PILIH_ULANG_GAMBAR,
  TEKS_TULIS_SESUATU,
} from "../../../../src/teks-feed";
import { TEKS_GAGAL_MENANDAI, TEKS_LAPOR } from "../../../../src/teks-profil";

export default function FeedScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <FeedScreenIsi key={signer.address} signer={signer} />;
}

function FeedScreenIsi({ signer }: { signer: NearlySigner }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  // Galat MUAT terpisah dari pesan AKSI: "Try again" memuat ulang feed, jadi
  // ia tidak boleh muncul di bawah kegagalan menyukai atau menghapus.
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Hapus tidak bisa dibatalkan, jadi butuh dua ketukan. Disimpan sebagai
  // postId, bukan boolean, supaya konfirmasi satu kartu tidak menyalakan
  // konfirmasi kartu lain.
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);
  // postId yang sedang dalam proses ditandai, atau null. Dipakai untuk
  // mencegah dua ketukan beruntun mengirim dua permintaan tanda tangan
  // sekaligus untuk kartu yang sama (finding #5).
  const [tandaiBusyId, setTandaiBusyId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      // Bukti LihatFeed setiap muat: tanpa itu server tidak menerapkan
      // blokirmu di feed (review akhir 4a, C1). Satu tanda tangan per muat,
      // karena `muat` hanya punya satu pemicu di bawah.
      const { posts } = await getFeed(await kueriBuktiFeed(signer));
      setPosts(posts);
      setGalatMuat(null);
      setPesan(null);
    } catch (e) {
      // Unggahan yang sudah tampil DIPERTAHANKAN (Ruling B2-12).
      setGalatMuat(e instanceof ApiError ? feedErrorMessage(e.code) : TEKS_GAGAL_MUAT_FEED);
    }
  }, [signer]);

  // useFocusEffect SENDIRIAN, bukan berpasangan dengan useEffect: ia sudah
  // menyala saat layar pertama kali fokus — yaitu saat mount — jadi useEffect
  // di sebelahnya cuma menggandakan `GET /feed` setiap kali layar dibuka.
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
  }, TEKS_GAGAL_SUKA);

  const lapor = (p: FeedPost) => jalankan(
    () => laporUnggahan(signer, p.postId, CONFIG.verifyingContract),
    TEKS_GAGAL_LAPOR_UNGGAHAN,
  );

  const hapus = (p: FeedPost) => jalankan(
    () => hapusUnggahan(signer, p.postId, CONFIG.verifyingContract),
    TEKS_GAGAL_HAPUS_UNGGAHAN,
  );

  /**
   * Coba unggah lagi setelah `image_status` jadi `failed`. Layar feed TIDAK
   * memegang byte gambar aslinya — jadi tombol ini meminta gambarnya dipilih
   * ulang, bukan berpura-pura bisa mengulang sendiri. Server mengizinkan ini:
   * attachImage menerima status `failed` (spec §9.1).
   */
  const unggahUlang = (p: FeedPost) => jalankan(async () => {
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
  }, TEKS_GAGAL_UNGGAH_GAMBAR);

  async function tandai(p: FeedPost) {
    // Sudah ada permintaan untuk kartu ini yang belum selesai — abaikan
    // ketukan berikutnya alih-alih mengirim tanda tangan kedua.
    if (tandaiBusyId === p.postId) return;
    setTandaiBusyId(p.postId);
    try {
      // Layar feed tidak tahu apakah kamu sudah menandai orang ini — bendera
      // itu hanya keluar dengan bukti baca di layar profil. Jadi dari sini
      // tombolnya SELALU menandai, tidak pernah mencabut.
      await aksiTanda(signer, p.author as Address, false);
      setPesan(meetSuccessMessage(true));
    } catch (e) {
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_MENANDAI);
    } finally {
      setTandaiBusyId(null);
    }
  }

  if (posts === null) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  const tulisBaru = () => router.push("/feed/new");

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      keyExtractor={(p) => p.postId}
      ListHeaderComponent={
        <View style={s.kepala}>
          {/* Aksi utama di baris pertama (§7.1); keadaan kosong membawa aksinya sendiri. */}
          {posts.length > 0 ? <Button onPress={tulisBaru}>{TEKS_TULIS_SESUATU}</Button> : null}
          {galatMuat ? <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} /> : null}
          {pesan ? <Text variant="caption">{pesan}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        galatMuat ? null : (
          <KeadaanKosong
            Ikon={FileText}
            kalimat={KOSONG_FEED}
            aksi={{ label: TEKS_TULIS_SESUATU, onPress: tulisBaru }}
          />
        )
      }
      renderItem={({ item: p }) => {
        const milikku = bisaHapus(p.author, signer.address);
        return (
          <Card style={s.kartu}>
            <Pressable
              onPress={() => router.push(`/profile/${p.author}`)}
              accessibilityRole="button"
              style={s.penulis}
            >
              <Text variant="body" style={s.tebal}>{namaKartuRadar(p.displayName)}</Text>
              {/* Nama tidak pernah tanpa alamat (R4, anti-impersonasi). */}
              <Text variant="mono">{alamatSingkat(p.author)}</Text>
            </Pressable>
            {/* Spec §10.3 — kartu harus menjelaskan kenapa ia muncul. */}
            <Text variant="caption">{alasanMuncul(p.hop, p.displayName)}</Text>
            <Text variant="body">{p.body}</Text>
            {p.imageStatus === "ready" && p.imageUrl
              ? <Image source={{ uri: p.imageUrl }} style={s.gambar} resizeMode="cover" />
              : null}
            {p.imageStatus === "pending" ? <Text variant="caption">{TEKS_GAMBAR_DIUNGGAH}</Text> : null}
            {p.imageStatus === "failed" ? <Text variant="caption">{TEKS_GAMBAR_GAGAL}</Text> : null}

            <View style={s.aksi}>
              <TautanKecil label={labelSuka(p.sudahSuka, p.likeCount)} onPress={() => void suka(p)} />
              <TautanKecil label={TEKS_LAPOR} onPress={() => void lapor(p)} />
              {/*
                Angka publiknya (inginBertemuCount) TIDAK ditampilkan di sini
                (spec §8) — hanya tombolnya. Disembunyikan untuk `milikku`:
                menandai diri sendiri hanya bisa gagal (server menolak dengan
                `tandai_diri`), jadi menawarkannya adalah tombol yang
                menjanjikan aksi yang tidak bisa ia lakukan (finding #4).
              */}
              {!milikku ? (
                <TautanKecil label={labelTandaFeed(tandaiBusyId === p.postId)} onPress={() => void tandai(p)} />
              ) : null}
              {milikku ? (
                <TautanKecil
                  label={labelHapus(konfirmasiHapus === p.postId)}
                  onPress={() => (konfirmasiHapus === p.postId
                    ? void hapus(p)
                    : setKonfirmasiHapus(p.postId))}
                />
              ) : null}
              {milikku && p.imageStatus === "failed" ? (
                <TautanKecil label={TEKS_PILIH_ULANG_GAMBAR} onPress={() => void unggahUlang(p)} />
              ) : null}
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
  kepala: { gap: 12 },
  kartu: { gap: 8 },
  penulis: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  tebal: { fontWeight: "600" },
  gambar: { width: "100%", height: 200, borderRadius: RADIUS.kartu },
  aksi: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
});
