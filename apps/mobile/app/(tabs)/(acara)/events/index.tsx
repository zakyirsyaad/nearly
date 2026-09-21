import { useCallback, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { CalendarDays, Plus } from "lucide-react-native";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { ApiError } from "../../../../src/api";
import { acaraLive, liveDulu } from "../../../../src/events/daftar-acara";
import { getDiscovery, type EventSummary } from "../../../../src/events-api";
import { eventErrorMessage } from "../../../../src/messages";
import {
  KOSONG_ACARA, metaAcara, TEKS_BUAT_ACARA, TEKS_GAGAL_MUAT_ACARA, teksRsvp,
} from "../../../../src/teks-acara";
import { TEKS_LIVE } from "../../../../src/teks-beranda";

export default function EventsScreen() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { events: rows } = await getDiscovery();
      setEvents(rows);
      setGalat(null);
      return true;
    } catch (e) {
      // Daftar yang sudah tampil DIPERTAHANKAN (Ruling B2-12). Error.message
      // tidak pernah dirender (review B1 #I1).
      setGalat(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : TEKS_GAGAL_MUAT_ACARA);
      return false;
    }
  }, []);

  // Segar saat kembali ke layar ini dalam batas §4.6 — dan langsung setelah
  // acara dibuat, lewat generasi data (Ruling B2-3).
  useMuatSaatFokus(load);

  const kini = Date.now();
  const urut = events ? liveDulu(events, kini) : [];
  const kosong = events !== null && events.length === 0;
  const buat = () => router.push("/events/new");

  return (
    <FlatList
      contentContainerStyle={s.daftar}
      contentInsetAdjustmentBehavior="automatic"
      data={urut}
      keyExtractor={(e) => e.eventId}
      ListHeaderComponent={
        <View style={s.kepala}>
          {/* Aksi utama di baris pertama (§7.1); keadaan kosong membawa aksinya sendiri. */}
          {!kosong ? <Button icon={Plus} onPress={buat}>{TEKS_BUAT_ACARA}</Button> : null}
          {events !== null && galat ? (
            <KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        events === null ? (
          galat ? <KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} /> : <KerangkaDaftar />
        ) : galat ? null : (
          <KeadaanKosong
            Ikon={CalendarDays}
            kalimat={KOSONG_ACARA}
            aksi={{ label: TEKS_BUAT_ACARA, onPress: buat }}
          />
        )
      }
      renderItem={({ item }) => <KartuAcara acara={item} kiniMs={kini} />}
    />
  );
}

/** Kartu acara (pola daftar §7.1): "● LIVE" hijau, judul, waktu · tempat, jumlah RSVP. */
function KartuAcara({ acara, kiniMs }: { acara: EventSummary; kiniMs: number }) {
  const hijau = useColor("verified");
  return (
    <Pressable onPress={() => router.push(`/events/${acara.eventId}`)} accessibilityRole="button">
      <Card style={s.kartu}>
        {acaraLive(acara, kiniMs) ? (
          <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {TEKS_LIVE}
          </Text>
        ) : null}
        <Text variant="body" style={s.tebal}>{acara.title}</Text>
        <Text variant="caption">{metaAcara(acara, new Date(kiniMs))}</Text>
        <Text variant="caption">{teksRsvp(acara.rsvpCount ?? 0)}</Text>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  daftar: { padding: 16, paddingBottom: 32, gap: 12 },
  kepala: { gap: 12 },
  kartu: { gap: 4 },
  tebal: { fontWeight: "600" },
});
