import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { ArrowUp, Ellipsis } from "lucide-react-native";
import type { Address } from "viem";
import { MAKS_ISI_PESAN } from "@nearly/shared";
import { Avatar } from "@/components/avatar";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { hitSlopSampai } from "../../../../src/aksesibilitas";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { HindariKeyboard } from "../../../../src/hindari-keyboard";
import { ApiError, req } from "../../../../src/http";
import { aksiBlokir } from "../../../../src/blokir-actions";
import { sesiPesan } from "../../../../src/pesan/sesi";
import { getRiwayat, postDibaca } from "../../../../src/pesan/pesan-api";
import { useLencana } from "../../../../src/lencana/konteks-lencana";
import {
  bukaBaris, bukaBertahap, kirimPesan, kunciLawan, type PesanTerbuka,
} from "../../../../src/pesan/pesan-actions";
import {
  alamatSingkat, blokirErrorMessage, labelKirimPesan, pesanErrorMessage, sisaKarakterPesan,
} from "../../../../src/messages";
import { TEKS_BATAL } from "../../../../src/teks-akun";
import { TEKS_LAPOR, teksGagalBlokir } from "../../../../src/teks-profil";
import {
  ISI_DIALOG_BLOKIR, JUDUL_DIALOG_BLOKIR, LABEL_OPSI_LAIN, perluPemisahHari, PLACEHOLDER_PESAN,
  TEKS_BLOKIR, TEKS_GAGAL_KIRIM_PESAN, TEKS_GAGAL_MUAT_PERCAKAPAN, TEKS_PESAN_TIDAK_TERVERIFIKASI,
  TEKS_TERENKRIPSI,
} from "../../../../src/teks-pesan";
import { teksSisaKarakter } from "../../../../src/teks-ui";
import { formatTanggal } from "../../../../src/waktu";

// Memberi event loop kesempatan memproses event keyboard dan sentuhan.
const jedaUi = () => new Promise<void>((r) => { setTimeout(r, 0); });

export default function PercakapanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <PercakapanScreenIsi key={signer.address} signer={signer} />;
}

function PercakapanScreenIsi({ signer }: { signer: NearlySigner }) {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const [daftar, setDaftar] = useState<PesanTerbuka[] | null>(null);
  const [isi, setIsi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [nama, setNama] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const ditandaiSampai = useRef(0);
  const layarAktif = useRef(false);
  const { muatUlangLencana } = useLencana();
  // Pembukaan PERTAMA dibuat bertahap (lihat bukaBertahap). Polling sesudahnya
  // membuka sekaligus: pesan lama sudah tersimpan dan murah, dan bertahap di
  // setiap polling akan menyusutkan daftar ke bagian awal lalu menumbuhkannya
  // lagi — berkedip tiap 4 detik.
  const tahap = useRef<"belum" | "berjalan" | "selesai">("belum");
  const kuning = useColor("primary");
  const teksDiKuning = useColor("primaryForeground");
  const latarKartu = useColor("card");
  const garis = useColor("border");
  const merah = useColor("destructive");
  const redup = useColor("textMuted");

  // Nama lawan untuk kepala (spec §6.5, Ruling B2-9): SATU GET /profile publik,
  // pola yang sama dengan sheet salaman (R14). Gagal atau kosong → kepala
  // hanya alamat singkat, tanpa pesan galat.
  useEffect(() => {
    let aktif = true;
    req<{ displayName?: string }>(`/profile/${lawan}`)
      .then((p) => { if (aktif) setNama(p.displayName?.trim() || null); })
      .catch(() => {});
    return () => { aktif = false; };
  }, [lawan]);

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    if (tahap.current === "berjalan") return; // putaran polling ini dilewati
    // Terbaru dulu — FlatList `inverted` menaruhnya di bawah.
    const buka = (b: (typeof pesan)[number]) => bukaBaris(sesi, k, b);
    if (tahap.current === "belum") {
      tahap.current = "berjalan";
      let selesai = false;
      try {
        selesai = await bukaBertahap(pesan, buka, {
          awal: 8, potongan: 4, jeda: jedaUi,
          masihBerlaku: () => layarAktif.current, tampilkan: setDaftar,
        });
      } finally {
        tahap.current = selesai ? "selesai" : "belum";
      }
      if (!selesai) return;
    } else {
      setDaftar(pesan.map(buka));
    }
    setGalat(null);

    const masukTerbaru = pesan.find((b) => b.pengirim.toLowerCase() === lawan.toLowerCase());
    if (masukTerbaru && masukTerbaru.createdAtMs > ditandaiSampai.current) {
      await postDibaca(sesi, lawan, masukTerbaru.createdAtMs);
      // Sesudah berhasil, bukan sebelum: yang gagal harus dicoba lagi saat
      // polling berikutnya.
      ditandaiSampai.current = masukTerbaru.createdAtMs;
      // Lencana tab Pesan turun sekarang, bukan 30 detik lagi (spec desain UI §4.4).
      muatUlangLencana();
    }
  }, [signer, lawan, muatUlangLencana]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    layarAktif.current = true;
    const jalankan = () => muat().catch((e: unknown) => {
      if (!aktif) return;
      // Muat pertama yang gagal meninggalkan `daftar` null → galat + Try again;
      // sesudahnya pesan yang sudah tampil dipertahankan (Ruling B2-12).
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_PERCAKAPAN);
    });
    void jalankan();
    // Polling hanya selama layar aktif (spec 4c §9): pembersih di bawah
    // menghentikannya saat layar kehilangan fokus.
    const t = setInterval(() => { void jalankan(); }, 4_000);
    return () => { aktif = false; layarAktif.current = false; clearInterval(t); };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

  async function kirim() {
    if (sibuk || isi.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await kirimPesan(await sesiPesan(signer), lawan, isi);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_KIRIM_PESAN);
      setSibuk(false);
      return;
    }
    setIsi("");
    setSibuk(false);
    // Pesannya SUDAH tersimpan. Gagal memuat ulang bukan kegagalan kirim —
    // polling berikutnya akan menampilkannya.
    muat().catch(() => {});
  }

  function blokir() {
    Alert.alert(JUDUL_DIALOG_BLOKIR, ISI_DIALOG_BLOKIR, [
      { text: TEKS_BATAL, style: "cancel" },
      {
        text: TEKS_BLOKIR,
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            .catch((e: unknown) => setGalat(
              e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(false)));
        },
      },
    ]);
  }

  // Menu ⋯ (spec §6.5, Ruling B2-10): aksi yang sudah ada di layar ini, dialog bawaan.
  function bukaMenu() {
    Alert.alert(nama ?? alamatSingkat(lawan), undefined, [
      { text: TEKS_LAPOR, onPress: () => router.push(`/pesan/lapor/${lawan}`) },
      { text: TEKS_BLOKIR, style: "destructive", onPress: blokir },
      { text: TEKS_BATAL, style: "cancel" },
    ]);
  }

  const sisa = sisaKarakterPesan(isi);
  const bisaKirim = !sibuk && isi.trim().length > 0 && sisa >= 0;

  if (daftar === null) {
    return (
      <View style={s.muat}>
        {galat ? (
          <KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  const kini = new Date();

  return (
    <HindariKeyboard>
      <View style={s.root}>
        <View style={s.kepala}>
          <Avatar nama={nama} alamat={lawan} ukuran={UKURAN.avatarKartu} cincin="verified" />
          <View style={s.kepalaTeks}>
            {nama ? <Text variant="body" style={s.tebal}>{nama}</Text> : null}
            {/* Nama tidak pernah tanpa alamat (R4, anti-impersonasi). */}
            <Text variant="mono">{alamatSingkat(lawan)}</Text>
            <Text variant="caption">{TEKS_TERENKRIPSI}</Text>
          </View>
          <Pressable
            onPress={bukaMenu}
            accessibilityRole="button"
            accessibilityLabel={LABEL_OPSI_LAIN}
            style={s.tombolMenu}
          >
            <Ellipsis color={redup} size={24} />
          </Pressable>
        </View>

        {galat ? <Text variant="caption" style={{ color: merah }}>{galat}</Text> : null}

        <FlatList
          inverted
          style={s.daftar}
          contentContainerStyle={s.isiDaftar}
          // Isian multiline: return menyisipkan baris, bukan menutup keyboard.
          // Menggeser daftar adalah jalan keluarnya.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          data={daftar}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <View style={s.sel}>
              {/* Di dalam sel `inverted` isi tetap tegak: pemisah tampil di atas
                  pesan TERLAMA pada harinya (Ruling B2-11). */}
              {perluPemisahHari(daftar, index) ? (
                <Text variant="caption" style={s.pemisah}>{formatTanggal(new Date(item.createdAtMs), kini)}</Text>
              ) : null}
              <View
                style={[
                  s.gelembung,
                  item.dariAku
                    ? { alignSelf: "flex-end", backgroundColor: kuning, borderBottomRightRadius: RADIUS.gelembungSudut }
                    : {
                      alignSelf: "flex-start",
                      backgroundColor: latarKartu,
                      borderColor: garis,
                      borderWidth: 1,
                      borderBottomLeftRadius: RADIUS.gelembungSudut,
                    },
                ]}
              >
                <Text
                  variant="body"
                  style={item.status !== "sah" ? { color: merah } : item.dariAku ? { color: teksDiKuning } : undefined}
                >
                  {item.status === "sah" ? item.isi : TEKS_PESAN_TIDAK_TERVERIFIKASI}
                </Text>
              </View>
            </View>
          )}
        />

        <View style={s.tulis}>
          <View style={s.isian}>
            <Input
              value={isi}
              onChangeText={setIsi}
              placeholder={PLACEHOLDER_PESAN}
              accessibilityLabel={PLACEHOLDER_PESAN}
              type="textarea"
              rows={1}
              inputStyle={s.batasTinggi}
              maxLength={MAKS_ISI_PESAN}
            />
          </View>
          <Pressable
            onPress={() => { void kirim(); }}
            disabled={!bisaKirim}
            hitSlop={hitSlopSampai(UKURAN.tombolKirim)}
            accessibilityRole="button"
            accessibilityLabel={labelKirimPesan(sibuk)}
            accessibilityState={{ disabled: !bisaKirim, busy: sibuk }}
            style={[s.kirim, { backgroundColor: kuning, opacity: bisaKirim ? 1 : 0.4 }]}
          >
            <ArrowUp color={teksDiKuning} size={20} />
          </Pressable>
        </View>
        {sisa < 100 ? <Text variant="caption" style={s.kanan}>{teksSisaKarakter(sisa)}</Text> : null}
      </View>
    </HindariKeyboard>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { flex: 1, padding: 12, gap: 8 },
  kepala: { flexDirection: "row", alignItems: "center", gap: 12 },
  kepalaTeks: { flex: 1, gap: 4 },
  tebal: { fontWeight: "600" },
  tombolMenu: {
    width: UKURAN.sentuh,
    height: UKURAN.sentuh,
    alignItems: "center",
    justifyContent: "center",
  },
  daftar: { flex: 1 },
  isiDaftar: { gap: 4 },
  sel: { gap: 8, paddingVertical: 4 },
  pemisah: { alignSelf: "center" },
  gelembung: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.gelembung },
  tulis: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  isian: { flex: 1 },
  batasTinggi: { maxHeight: 120 },
  kirim: {
    width: UKURAN.tombolKirim,
    height: UKURAN.tombolKirim,
    borderRadius: RADIUS.kartu,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kanan: { textAlign: "right" },
});
