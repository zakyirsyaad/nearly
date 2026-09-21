import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Hex } from "viem";
import { isEventLive, lihatEventTypedData, rsvpTypedData } from "@nearly/shared";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/api";
import { getEvent, postRsvp, type EventSummary } from "../../../../src/events-api";
import {
  eventErrorMessage, teksKutandaiHadir, teksPenandaHadir,
} from "../../../../src/messages";
import {
  labelRsvp, pasanganBelumHadir, pasanganRsvp, TEKS_BUKA_QR_HOST, TEKS_BUKA_RADAR_ACARA,
  TEKS_CHECK_IN_SAAT_BERLANGSUNG, TEKS_GAGAL_MUAT_ACARA_INI, TEKS_PINDAI_QR_HOST, TEKS_RSVP_DULU,
  TEKS_RSVP_GAGAL, TEKS_RSVP_TERCATAT,
} from "../../../../src/teks-acara";
import { pasanganCheckIn, TEKS_LIVE } from "../../../../src/teks-beranda";
import { formatTanggalJam } from "../../../../src/waktu";

export default function EventDetailScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <EventDetailScreenIsi key={signer.address} signer={signer} />;
}

function EventDetailScreenIsi({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ev, setEv] = useState<EventSummary | null>(null);
  // Diseed dari server (bukan diasumsikan false) — server sudah tahu
  // jawabannya lewat `who`, dan tamu yang RSVP lalu menutup app tidak boleh
  // disuruh RSVP lagi hanya karena state lokal lupa.
  const [sudahRsvp, setSudahRsvp] = useState(false);
  const [sudahCheckIn, setSudahCheckIn] = useState(false);
  // Galat MUAT terpisah dari pesan AKSI: tanpa ini layar yang gagal memuat
  // menampilkan kerangka selamanya (spec §7.2).
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hijau = useColor("verified");

  const load = useCallback(async () => {
    setGalatMuat(null);
    try {
      // Bendera sudahRsvp/sudahCheckIn hanya keluar untuk pemanggil yang
      // MEMBUKTIKAN dirinya alamat itu — tanpa tanda tangan, `?who=` akan
      // jadi oracle yang bisa ditanya siapa pun tentang siapa pun. Tipe
      // LihatEvent dipakai di sini, BUKAN Rsvp: proof baca ini dikirim lewat
      // query string di setiap pembukaan layar, jadi kalau tipenya sama
      // dengan yang diterima POST /events/:id/rsvp, siapa pun yang membaca
      // URL itu (log, proxy) bisa memutarnya ulang sebagai RSVP sungguhan.
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        lihatEventTypedData(
          { eventId: id as Hex, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      const data = await getEvent(id, signer.address, {
        expiresAt: expiresAt.toString(), sig,
      });
      setEv(data);
      setSudahRsvp(data.sudahRsvp === true);
      setSudahCheckIn(data.sudahCheckIn === true);
      return true;
    } catch (e) {
      setGalatMuat(e instanceof ApiError ? eventErrorMessage(e.code) : TEKS_GAGAL_MUAT_ACARA_INI);
      return false;
    }
  }, [id, signer]);

  // Memuat saat fokus (spec §4.6): kembali dari check-in di tab Handshake
  // langsung menampilkan "already checked in" (generasi data, Ruling B2-3).
  useMuatSaatFokus(load);

  async function rsvp() {
    if (busy || !ev) return;
    setBusy(true);
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        rsvpTypedData(
          { eventId: ev.eventId, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      await postRsvp(ev.eventId, {
        eventId: ev.eventId, who: signer.address, expiresAt: expiresAt.toString(), sig,
      });
      setSudahRsvp(true);
      setPesan(TEKS_RSVP_TERCATAT);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rsvped") setSudahRsvp(true);
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : TEKS_RSVP_GAGAL);
    } finally {
      setBusy(false);
    }
  }

  if (!ev) {
    return (
      <View style={s.muat}>
        {galatMuat ? (
          <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void load()} />
        ) : (
          <KerangkaDaftar baris={2} />
        )}
      </View>
    );
  }

  const berlangsung = isEventLive(BigInt(ev.startsAt), BigInt(ev.endsAt), Date.now());
  const akuHost = ev.host.toLowerCase() === signer.address.toLowerCase();

  // Tombol check-in TIDAK PERNAH gagal diam-diam (spec §2.2): syaratnya
  // terbaca sebelum orang berdiri di depan host, bukan sesudah. Kalau tamu
  // sudah check-in, jangan tawarkan tautan pindai lagi — beri tahu saja.
  const alasanTakBisaCheckIn = sudahCheckIn
    ? eventErrorMessage("already_checked_in")
    : !sudahRsvp
      ? TEKS_RSVP_DULU
      : !berlangsung
        ? TEKS_CHECK_IN_SAAT_BERLANGSUNG
        : null;

  const barisPenandaHadir = teksPenandaHadir(ev.penandaHadir);
  const barisKutandaiHadir = teksKutandaiHadir(ev.kutandaiHadir);
  const kehadiran = [
    pasanganRsvp(ev.rsvps ?? 0),
    pasanganCheckIn(ev.checkins ?? 0),
    pasanganBelumHadir(ev.rsvpBelumHadir ?? 0),
  ];

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      <View style={s.kepala}>
        {berlangsung ? (
          <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {TEKS_LIVE}
          </Text>
        ) : null}
        <Text variant="title">{ev.title}</Text>
        {ev.venueLabel ? <Text variant="caption">{ev.venueLabel}</Text> : null}
        <Text variant="caption">{formatTanggalJam(new Date(Number(ev.startsAt) * 1000), new Date())}</Text>
      </View>

      <Card style={s.kartu}>
        {/* Nilai lebih keras dari labelnya (§7.1). */}
        {kehadiran.map((p) => (
          <View key={p.kata} style={s.barisNilai}>
            <Text variant="body" style={s.tebal}>{p.angka}</Text>
            <Text variant="caption" style={s.menyusut}>{p.kata}</Text>
          </View>
        ))}
        {/*
          `undefined` untuk keduanya adalah keadaan NORMAL, bukan nol — untuk
          orang yang membuka tautan tanpa signer, dan untuk penandaHadir juga
          pada acara yang belum melewati kedua ambang k-anonimitas (spec §4.3).
          Gerbangnya di fungsi murni src/messages.ts supaya bisa diuji tanpa
          merender apa pun — regresi "0" di sini mengubah penyembunyian yang
          disengaja menjadi klaim yang bisa bohong.
        */}
        {barisPenandaHadir !== null ? <Text variant="caption">{barisPenandaHadir}</Text> : null}
        {barisKutandaiHadir !== null ? <Text variant="caption">{barisKutandaiHadir}</Text> : null}
      </Card>

      <View style={s.aksi}>
        {!sudahRsvp ? (
          <Button loading={busy} disabled={busy} onPress={() => void rsvp()}>{labelRsvp(busy)}</Button>
        ) : null}

        {alasanTakBisaCheckIn ? (
          <Text variant="caption">{alasanTakBisaCheckIn}</Text>
        ) : (
          <Button variant="outline" onPress={() => router.navigate("/salaman?mode=pindai")}>
            {TEKS_PINDAI_QR_HOST}
          </Button>
        )}

        {/* Radar hanya untuk yang sudah check-in, selama acara berlangsung (spec 4b+5 §8.1). */}
        {berlangsung && sudahCheckIn ? (
          <Button variant="outline" onPress={() => router.push(`/radar/${ev.eventId}`)}>
            {TEKS_BUKA_RADAR_ACARA}
          </Button>
        ) : null}

        {akuHost ? (
          <Button variant="outline" onPress={() => router.push(`/events/${ev.eventId}/host-qr`)}>
            {TEKS_BUKA_QR_HOST}
          </Button>
        ) : null}

        {pesan ? <Text variant="caption">{pesan}</Text> : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  muat: { flex: 1, padding: 16 },
  kepala: { gap: 4 },
  kartu: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  menyusut: { flexShrink: 1 },
  tebal: { fontWeight: "600" },
  aksi: { gap: 12 },
});
