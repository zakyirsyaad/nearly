import { GEOFENCE_SPAN_M } from "@nearly/shared";
import { jamak, pasanganJamak } from "./jamak";
import { formatTanggalJam } from "./waktu";

/**
 * Teks layar Acara (spec desain UI §7.1, §7.4): terjemahan 1:1 kalimat yang
 * sudah ada di events/index, events/[id], events/new, dan events/[id]/host-qr,
 * ditambah satu teks baru "Event created." (Ruling B2-6).
 */

/* Daftar acara — app/(tabs)/(acara)/events/index.tsx */

export const TEKS_BUAT_ACARA = "Create event";
export const KOSONG_ACARA = "No upcoming events yet. You can create the first one.";
export const TEKS_GAGAL_MUAT_ACARA = "Couldn't load events.";

/** "{rsvpCount} RSVP" di kartu daftar. */
export function teksRsvp(n: number): string {
  return jamak(n, "RSVP", "RSVPs");
}

/**
 * Baris waktu + tempat kartu acara: "Aug 12, 19:42 · Aula" — pengganti
 * API locale bawaan (spec §7.4). `startsAt` = detik unix string.
 */
export function metaAcara(a: { startsAt: string; venueLabel: string }, sekarang: Date): string {
  const waktu = formatTanggalJam(new Date(Number(a.startsAt) * 1000), sekarang);
  return a.venueLabel ? `${waktu} · ${a.venueLabel}` : waktu;
}

/* Detail acara — app/(tabs)/(acara)/events/[id].tsx */

export const TEKS_GAGAL_MUAT_ACARA_INI = "Couldn't load this event.";

/** Pasangan nilai/label kartu kehadiran (§7.1): nilai lebih keras dari labelnya. */
export function pasanganRsvp(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "RSVP", "RSVPs");
}

export function pasanganBelumHadir(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "not checked in yet", "not checked in yet");
}

export function labelRsvp(sibuk: boolean): string {
  return sibuk ? "Sending…" : "RSVP";
}

export const TEKS_RSVP_TERCATAT = "RSVP recorded. Check in at the venue by scanning the host's QR code.";
export const TEKS_RSVP_GAGAL = "RSVP failed.";
export const TEKS_RSVP_DULU = "RSVP first to be able to check in.";
export const TEKS_CHECK_IN_SAAT_BERLANGSUNG = "Check-in opens while the event is running.";
/** Kalimat spec §4.1 (dulu "Pindai QR host untuk check-in"). */
export const TEKS_PINDAI_QR_HOST = "Scan the host's QR to check in";
export const TEKS_BUKA_RADAR_ACARA = "Open radar";
export const TEKS_BUKA_QR_HOST = "Open check-in QR (you're the host)";

/* Buat acara — app/(tabs)/(acara)/events/new.tsx */

export const LABEL_NAMA_ACARA = "Event name";
export const LABEL_TEMPAT_ACARA = "Venue name (optional)";

export function catatanPusatAcara(): string {
  return `Your location when you tap this button becomes the center of the event area (about ${GEOFENCE_SPAN_M} meters). Stand at the venue.`;
}

export function labelBuatAcara(sibuk: boolean): string {
  return sibuk ? "Creating…" : TEKS_BUAT_ACARA;
}

export const TEKS_GAGAL_BUAT_ACARA = "Couldn't create the event.";
/** Teks BARU (Ruling B2-6): §7.2 mewajibkan toast untuk acara dibuat. */
export const TEKS_ACARA_DIBUAT = "Event created.";

/* QR check-in host — app/(tabs)/(acara)/events/[id]/host-qr.tsx */

export function teksPetunjukQrHost(detik: number): string {
  return `Ask guests to scan this to check in. Changes in ${jamak(detik, "second", "seconds")}.`;
}

export const TEKS_GAGAL_SIAPKAN_QR_HOST = "Couldn't prepare the check-in QR code.";

/* Lokasi ditolak (Ruling B2-14) */

/** Terjemahan kalimat yang hari ini tampil lewat Error.message ("Izin lokasi ditolak"). */
export const TEKS_IZIN_LOKASI_DITOLAK = "Location access was denied.";

/**
 * Kalimat untuk galat yang BUKAN ApiError di layar Acara. Error.message tidak
 * pernah dirender (review B1 #I1); lokasi ditolak dikenali lewat namanya
 * supaya modul ini tetap murni (tanpa impor expo-location).
 */
export function kalimatGagalAcara(e: unknown, cadangan: string): string {
  return e instanceof Error && e.name === "LocationDeniedError" ? TEKS_IZIN_LOKASI_DITOLAK : cadangan;
}
