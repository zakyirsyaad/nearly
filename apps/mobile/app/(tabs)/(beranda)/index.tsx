import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Copy, Handshake } from "lucide-react-native";
import type { Address } from "viem";
import { isEventLive, lihatEventTypedData } from "@nearly/shared";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { TautanKecil } from "@/components/tautan-kecil";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { hitSlopSampai } from "../../../src/aksesibilitas";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useDompet, useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { perluPengingatCadangan, TEKS_PENGINGAT_CADANGAN } from "../../../src/dompet/teks-dompet";
import { getDiscovery, getEvent, type EventSummary } from "../../../src/events-api";
import { getFeed, kueriBuktiFeed } from "../../../src/feed-api";
import { req } from "../../../src/http";
import { alamatSingkat, namaKartuRadar } from "../../../src/messages";
import { bolehMuatFokus } from "../../../src/muat-fokus";
import {
  JUDUL_FEED, JUDUL_RECENTLY_MET, KOSONG_KONEKSI, LABEL_SALIN_ALAMAT, pasanganCheckIn,
  TEKS_AKSI_HANDSHAKE, TEKS_ALAMAT_DISALIN, TEKS_BUKA_ACARA, TEKS_BUKA_DOMPET, TEKS_BUKA_RADAR,
  TEKS_GAGAL_MUAT_KONEKSI, TEKS_LIHAT_SEMUA, TEKS_LIVE, TEKS_SALIN, TEKS_SUDAH_CHECK_IN,
} from "../../../src/teks-beranda";
import { fetchTrust } from "../../../src/trust-api";
import { sapaan, waktuRelatif } from "../../../src/waktu";

/** Batas jumlah kartu per bagian (spec §6.1). */
const MAKS_LIVE = 2;
const MAKS_KONEKSI = 3;
const MAKS_FEED = 2;
/** Ikon "Copy" sengaja lebih kecil dari teksnya — bukan ukuran huruf. */
const IKON_SALIN = 14;

type KartuKoneksi = { alamat: string; nama: string; tier: number | null; waktu: string };
type KartuFeed = { id: string; nama: string; waktu: string; isi: string };

export default function Home() {
  // Bukti feed memakai ConnectionRegistry; bendera sudahCheckIn kartu LIVE
  // memakai AttendanceRegistry — domain yang sama dengan layar Detail acara.
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const { punyaMnemonik, sudahDicadangkan } = useDompet();
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer || !signerHadir) return null;
  return (
    <HomeIsi
      key={signer.address}
      signer={signer}
      signerHadir={signerHadir}
      pengingatCadangan={perluPengingatCadangan({ punyaMnemonik, sudahDicadangkan })}
    />
  );
}

function HomeIsi({
  signer,
  signerHadir,
  pengingatCadangan,
}: {
  signer: NearlySigner;
  signerHadir: NearlySigner;
  pengingatCadangan: boolean;
}) {
  const [nama, setNama] = useState<string | null>(null);
  const [live, setLive] = useState<EventSummary[]>([]);
  const [koneksi, setKoneksi] = useState<KartuKoneksi[] | null>(null);
  const [galatKoneksi, setGalatKoneksi] = useState(false);
  const [feed, setFeed] = useState<KartuFeed[] | null>(null);
  const kabar = useKabar();

  const kuning = useColor("primary");
  const hijau = useColor("verified");
  const spandukLatar = useColor("spandukLatar");
  const spandukGaris = useColor("spandukGaris");

  async function salinAlamat() {
    try {
      // Alamat UTUH, bukan yang disingkat (#16C).
      await Clipboard.setStringAsync(signer.address);
      kabar.disalin(TEKS_ALAMAT_DISALIN);
    } catch {
      // Gagal menyalin → tidak ada toast dan TIDAK ada kalimat galat baru:
      // spec §7.3 tidak mengizinkan kalimat yang belum diputuskan (#16C).
    }
  }

  // Setiap bagian memuat SENDIRI dan gagal SENDIRI (spec §6.1): satu bagian
  // yang gagal tidak pernah menutup bagian lain atau mengosongkan layar.
  const muatNama = useCallback(async () => {
    try {
      const p = await req<{ displayName?: string }>(`/profile/${signer.address}`);
      setNama(p.displayName?.trim() || null);
    } catch {
      // Nama bukan identitas; tanpa nama, alamatnya tetap tampil (spec §9.2).
    }
  }, [signer.address]);

  const muatLive = useCallback(async () => {
    try {
      const { events } = await getDiscovery();
      const sekarang = Date.now();
      const berlangsung = events
        .filter((e) => isEventLive(BigInt(e.startsAt), BigInt(e.endsAt), sekarang))
        .slice(0, MAKS_LIVE);
      const rinci = await Promise.all(berlangsung.map(async (e) => {
        try {
          // Bukti BACA (LihatEvent), bukan Rsvp — sama dengan layar Detail
          // acara: tipe yang sama dengan POST akan bisa diputar ulang.
          const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
          const sig = await signerHadir.signTypedData(
            lihatEventTypedData(
              { eventId: e.eventId, who: signerHadir.address, expiresAt },
              CONFIG.attendanceRegistry,
            ),
          );
          return await getEvent(e.eventId, signerHadir.address, {
            expiresAt: expiresAt.toString(), sig,
          });
        } catch {
          // Tanpa bukti, kartunya tetap tampil — hanya tanpa "You're checked in".
          return e;
        }
      }));
      setLive(rinci);
    } catch {
      setLive([]);
    }
  }, [signerHadir]);

  const muatKoneksi = useCallback(async () => {
    setGalatKoneksi(false);
    try {
      const { connections } = await req<{ connections?: { address: string; at: number }[] }>(
        `/connections/${signer.address}`,
      );
      const kini = new Date();
      const kartu = await Promise.all((connections ?? []).slice(0, MAKS_KONEKSI).map(async (k) => {
        // GET /connections tidak mengirim nama; nama dan tier diambil per
        // orang (§11 batas #9). Kegagalannya membuat kartu tampil tanpa
        // nama/tier, bukan menghilangkan kartunya.
        const [namaOrang, tier] = await Promise.all([
          req<{ displayName?: string }>(`/profile/${k.address}`).then((p) => p.displayName ?? "").catch(() => ""),
          fetchTrust(k.address as Address).then((t) => t.tier).catch(() => null),
        ]);
        return { alamat: k.address, nama: namaOrang, tier, waktu: waktuRelatif(new Date(k.at), kini) };
      }));
      setKoneksi(kartu);
    } catch {
      // Daftar yang sudah tampil dibiarkan; galat hanya muncul bila belum ada
      // apa pun untuk ditampilkan (§7.2).
      setGalatKoneksi(true);
    }
  }, [signer.address]);

  const muatFeed = useCallback(async () => {
    try {
      const { posts } = await getFeed(await kueriBuktiFeed(signer));
      const kini = new Date();
      setFeed(posts.slice(0, MAKS_FEED).map((p) => ({
        id: p.postId,
        nama: namaKartuRadar(p.displayName),
        waktu: waktuRelatif(new Date(p.createdAtMs), kini),
        isi: p.body,
      })));
    } catch {
      setFeed([]);
    }
  }, [signer]);

  // Memuat saat fokus, paling sering sekali per 30 detik (spec §4.6) — setara
  // "satu tanda tangan per pembukaan beranda" hari ini.
  const terakhir = useRef<number | null>(null);
  useFocusEffect(useCallback(() => {
    const kini = Date.now();
    if (!bolehMuatFokus(terakhir.current, kini)) return;
    terakhir.current = kini;
    void muatNama();
    void muatLive();
    void muatKoneksi();
    void muatFeed();
  }, [muatNama, muatLive, muatKoneksi, muatFeed]));

  return (
    <SafeAreaView edges={["top"]} style={s.flex}>
      <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
        <View style={s.kepala}>
          <Text variant="heading">{sapaan(new Date())}</Text>
          {nama ? <Text variant="title">{nama}</Text> : null}
          <View style={s.barisAlamat}>
            {/* Alamat SINGKAT (#16C); yang utuh ada di Wallet dan Profile. */}
            <Text variant="mono">{alamatSingkat(signer.address)}</Text>
            <Pressable
              onPress={() => void salinAlamat()}
              accessibilityRole="button"
              accessibilityLabel={LABEL_SALIN_ALAMAT}
              hitSlop={hitSlopSampai(48, 20)}
              style={s.salin}
            >
              <Copy color={kuning} size={IKON_SALIN} />
              <Text
                variant="label"
                style={{ color: kuning }}
                maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}
              >
                {TEKS_SALIN}
              </Text>
            </Pressable>
          </View>
        </View>

        {pengingatCadangan ? (
          <View style={[s.spanduk, { backgroundColor: spandukLatar, borderColor: spandukGaris }]}>
            <Text variant="caption" style={{ color: kuning }}>{TEKS_PENGINGAT_CADANGAN}</Text>
            <TautanKecil label={TEKS_BUKA_DOMPET} onPress={() => router.push("/dompet")} />
          </View>
        ) : null}

        {live.map((e) => (
          <Card key={e.eventId} style={s.kartu}>
            <View style={s.barisKartu}>
              <Text variant="label" style={{ color: hijau }}>{TEKS_LIVE}</Text>
              <View style={s.nilai}>
                <Text variant="body" style={s.tebal}>{pasanganCheckIn(e.checkins ?? 0).angka}</Text>
                <Text variant="caption">{pasanganCheckIn(e.checkins ?? 0).kata}</Text>
              </View>
            </View>
            <Text variant="title">{e.title}</Text>
            {e.sudahCheckIn ? (
              <View style={s.barisKartu}>
                <Text variant="caption" style={s.menyusut}>{TEKS_SUDAH_CHECK_IN}</Text>
                <TautanKecil label={TEKS_BUKA_RADAR} onPress={() => router.push(`/radar/${e.eventId}`)} />
              </View>
            ) : (
              <TautanKecil label={TEKS_BUKA_ACARA} onPress={() => router.push(`/events/${e.eventId}`)} />
            )}
          </Card>
        ))}

        <View style={s.bagian}>
          <View style={s.barisJudul}>
            <Text variant="title" style={s.menyusut}>{JUDUL_RECENTLY_MET}</Text>
            <TautanKecil label={TEKS_LIHAT_SEMUA} onPress={() => router.push("/connections")} />
          </View>
          {koneksi === null ? (
            galatKoneksi ? (
              <KeadaanGalat kalimat={TEKS_GAGAL_MUAT_KONEKSI} onCobaLagi={() => void muatKoneksi()} />
            ) : (
              <KerangkaDaftar baris={MAKS_KONEKSI} />
            )
          ) : koneksi.length === 0 ? (
            <KeadaanKosong
              Ikon={Handshake}
              kalimat={KOSONG_KONEKSI}
              aksi={{ label: TEKS_AKSI_HANDSHAKE, onPress: () => router.push("/salaman") }}
            />
          ) : (
            koneksi.map((k) => (
              <KartuOrang
                key={k.alamat}
                nama={k.nama}
                alamat={k.alamat}
                terverifikasi
                lencana={<Lencana varian="terverifikasi" />}
                keterangan={k.waktu}
                tier={k.tier ?? undefined}
                onPress={() => router.push(`/profile/${k.alamat}`)}
              />
            ))
          )}
        </View>

        {feed === null || feed.length > 0 ? (
          <View style={s.bagian}>
            <View style={s.barisJudul}>
              <Text variant="title" style={s.menyusut}>{JUDUL_FEED}</Text>
              <TautanKecil label={TEKS_LIHAT_SEMUA} onPress={() => router.push("/feed")} />
            </View>
            {feed === null ? (
              <KerangkaDaftar baris={MAKS_FEED} />
            ) : (
              feed.map((p) => (
                <Card key={p.id} style={s.kartu}>
                  <View style={s.barisKartu}>
                    <Text variant="body" style={[s.tebal, s.menyusut]}>{p.nama}</Text>
                    <Text variant="caption">{p.waktu}</Text>
                  </View>
                  <Text variant="body" numberOfLines={2}>{p.isi}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 4 },
  barisAlamat: { flexDirection: "row", alignItems: "center", gap: 12 },
  salin: { flexDirection: "row", alignItems: "center", gap: 4 },
  spanduk: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12, gap: 4 },
  kartu: { gap: 8 },
  barisKartu: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nilai: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  bagian: { gap: 12 },
  barisJudul: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  // Teks panjang di baris label + tautan membungkus ke baris baru alih-alih
  // mendorong tautannya keluar layar (review B1 #I5).
  menyusut: { flexShrink: 1 },
  tebal: { fontWeight: "600" },
});
