import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getDiscovery, type EventSummary } from "../../src/events-api";
import { ApiError } from "../../src/api";
import { eventErrorMessage } from "../../src/messages";

function waktuSingkat(unixSec: string): string {
  return new Date(Number(unixSec) * 1000).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function EventsScreen() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { events: rows } = await getDiscovery();
      setEvents(rows);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : "Gagal memuat acara.",
      );
    }
  }, []);

  // useFocusEffect, bukan useEffect: daftar harus segar setiap kali layar ini
  // kembali terlihat — mis. sesudah membuat acara lalu menekan kembali.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (error) return <View style={s.root}><Text style={s.p}>{error}</Text></View>;
  if (!events) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <Link href="/events/new" style={s.buat}>Buat acara</Link>
      <FlatList
        data={events}
        keyExtractor={(e) => e.eventId}
        ListEmptyComponent={
          <Text style={s.p}>Belum ada acara yang akan datang. Kamu bisa membuat yang pertama.</Text>
        }
        renderItem={({ item }) => (
          // asChild WAJIB: Link merender Text, dan View di dalam Text tidak sah
          // di React Native. asChild membuat Pressable yang menjadi tautannya.
          <Link href={`/events/${item.eventId}`} asChild>
            <Pressable style={s.kartu}>
              <Text style={s.judul}>{item.title}</Text>
              <Text style={s.meta}>
                {waktuSingkat(item.startsAt)}
                {item.venueLabel ? ` · ${item.venueLabel}` : ""}
              </Text>
              <Text style={s.meta}>{item.rsvpCount ?? 0} RSVP</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  buat: { fontSize: 16, fontWeight: "600", paddingVertical: 8 },
  kartu: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  judul: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
});
