import { useState } from "react";
import { useRouter } from "expo-router";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { cellToBytes32, createEventTypedData, makeEventId, GEOFENCE_SPAN_M } from "@nearly/shared";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { getCurrentCell } from "../../../../src/location";
import { ApiError } from "../../../../src/api";
import { postCreateEvent } from "../../../../src/events-api";
import { eventErrorMessage } from "../../../../src/messages";
import { WARNA } from "../../../../src/warna";

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
      router.replace(`/events/${eventId}`);
    } catch (e) {
      setPesan(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : "Gagal membuat acara.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <TextInput
        style={[s.input, { color: WARNA.teks }]}
        placeholderTextColor={WARNA.placeholder}
        placeholder="Nama acara" value={title} onChangeText={setTitle}
      />
      <TextInput
        style={[s.input, { color: WARNA.teks }]}
        placeholderTextColor={WARNA.placeholder}
        placeholder="Nama tempat (opsional)" value={venue} onChangeText={setVenue}
      />
      <Text style={s.catatan}>
        Lokasi kamu saat menekan tombol ini menjadi pusat area acara
        (sekitar {GEOFENCE_SPAN_M} meter). Berdirilah di venue.
      </Text>
      <Button title={busy ? "Membuat…" : "Buat acara"} onPress={() => void buat()} disabled={busy} />
      {pesan && <Text style={s.p}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 16 },
  catatan: { fontSize: 13, opacity: 0.7, lineHeight: 19 },
  p: { fontSize: 15, lineHeight: 22 },
});
