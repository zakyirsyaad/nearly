import { jamak } from "./jamak";

/**
 * Tanggal dan jam berbahasa Inggris (spec desain UI §7.4). Fungsi murni TANPA
 * API locale bawaan (`Intl`/`Date#toLocale*`): hasilnya di Hermes/Expo Go
 * tidak dijamin sama antarperangkat, dan tes harus deterministik. Semua
 * memakai zona waktu lokal HP.
 */
const BULAN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MENIT_MS = 60_000;
const JAM_MS = 60 * MENIT_MS;
const HARI_MS = 24 * JAM_MS;

const duaDigit = (n: number) => String(n).padStart(2, "0");

/** "Aug 12"; bila bukan tahun berjalan: "Aug 12, 2025". */
export function formatTanggal(t: Date, sekarang: Date): string {
  const dasar = `${BULAN[t.getMonth()] ?? ""} ${t.getDate()}`;
  return t.getFullYear() === sekarang.getFullYear() ? dasar : `${dasar}, ${t.getFullYear()}`;
}

/** 24 jam, dua digit: "19:42", "08:05". */
export function formatJam(t: Date): string {
  return `${duaDigit(t.getHours())}:${duaDigit(t.getMinutes())}`;
}

/** Tanggal + jam acara: "Aug 12, 19:42" — pengganti API locale bawaan ("id-ID", …). */
export function formatTanggalJam(t: Date, sekarang: Date): string {
  return `${formatTanggal(t, sekarang)}, ${formatJam(t)}`;
}

function selisihHariKalender(t: Date, sekarang: Date): number {
  const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((awalHari(sekarang) - awalHari(t)) / HARI_MS);
}

/**
 * < 1 menit "just now"; < 60 menit "N minutes ago"; < 24 jam "N hours ago";
 * hari kalender sebelumnya "yesterday"; ≤ 6 hari "N days ago"; selebihnya tanggal.
 */
export function waktuRelatif(t: Date, sekarang: Date): string {
  const selisih = sekarang.getTime() - t.getTime();
  if (selisih < MENIT_MS) return "just now";
  if (selisih < JAM_MS) return jamak(Math.floor(selisih / MENIT_MS), "minute ago", "minutes ago");
  if (selisih < HARI_MS) return jamak(Math.floor(selisih / JAM_MS), "hour ago", "hours ago");
  const hari = selisihHariKalender(t, sekarang);
  if (hari <= 1) return "yesterday";
  if (hari <= 6) return jamak(hari, "day ago", "days ago");
  return formatTanggal(t, sekarang);
}

/** Sapaan Beranda (spec §6.1): 04:00–11:59 morning, 12:00–17:59 afternoon, selainnya evening. */
export function sapaan(t: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const jam = t.getHours();
  if (jam >= 4 && jam < 12) return "Good morning";
  if (jam >= 12 && jam < 18) return "Good afternoon";
  return "Good evening";
}

/** Hari kalender lokal yang sama (pemisah hari Percakapan, Ruling B2-11). */
export function hariSama(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
