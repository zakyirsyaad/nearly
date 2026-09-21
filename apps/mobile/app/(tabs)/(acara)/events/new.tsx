import { useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { cellToBytes32, createEventTypedData, makeEventId } from "@nearly/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useKabar } from "@/hooks/useKabar";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { getCurrentCell } from "../../../../src/location";
import { ApiError } from "../../../../src/api";
import { postCreateEvent } from "../../../../src/events-api";
import { eventErrorMessage } from "../../../../src/messages";
import { tandaiDataBerubah } from "../../../../src/muat-fokus";
import {
  catatanPusatAcara, kalimatGagalAcara, LABEL_NAMA_ACARA, LABEL_TEMPAT_ACARA, labelBuatAcara,
  TEKS_ACARA_DIBUAT, TEKS_GAGAL_BUAT_ACARA,
} from "../../../../src/teks-acara";

/** Acara berdurasi tiga jam mulai sekarang. Fase ini tidak punya pemilih tanggal. */
const DURASI_DETIK = 3 * 3600;

export default function NewEventScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <NewEventScreenIsi key={signer.address} signer={signer} />;
}

function NewEventScreenIsi({ signer }: { signer: NearlySigner }) {
  const router = useRouter();
  const kabar = useKabar();

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function buat() {
    if (busy || title.trim().length === 0) return;
    setBusy(true);
    try {
      const { cell } = await getCurrentCell();
      const eventId = makeEventId();
      const startsAt = BigInt(Math.floor(Date.now() / 1000));
      const endsAt = startsAt + BigInt(DURASI_DETIK);
      const expiresAt = startsAt + 600n;

      const sigHost = await signer.signTypedData(
        createEventTypedData(
          {
            eventId, host: signer.address, startsAt, endsAt,
            centerCell: cellToBytes32(cell), expiresAt,
          },
          CONFIG.attendanceRegistry,
        ),
      );

      await postCreateEvent({
        eventId, host: signer.address, title: title.trim(), venueLabel: venue.trim(),
        cell, startsAt: startsAt.toString(), endsAt: endsAt.toString(),
        expiresAt: expiresAt.toString(), sigHost,
      });
      // Aksi penting → toast + haptic (spec §7.2, Ruling B2-6). Daftar Acara
      // memuat ulang saat kembali, walau belum 30 detik (Ruling B2-3).
      kabar.berhasil(TEKS_ACARA_DIBUAT);
      tandaiDataBerubah();
      router.replace(`/events/${eventId}`);
    } catch (e) {
      setPesan(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : kalimatGagalAcara(e, TEKS_GAGAL_BUAT_ACARA),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.bagian}>
        <Text variant="caption">{LABEL_NAMA_ACARA}</Text>
        <Input value={title} onChangeText={setTitle} editable={!busy} accessibilityLabel={LABEL_NAMA_ACARA} />
      </View>
      <View style={s.bagian}>
        <Text variant="caption">{LABEL_TEMPAT_ACARA}</Text>
        <Input value={venue} onChangeText={setVenue} editable={!busy} accessibilityLabel={LABEL_TEMPAT_ACARA} />
      </View>
      <Text variant="caption">{catatanPusatAcara()}</Text>
      <Button loading={busy} disabled={busy} onPress={() => void buat()}>{labelBuatAcara(busy)}</Button>
      {pesan ? <Text variant="caption">{pesan}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  bagian: { gap: 8 },
});
