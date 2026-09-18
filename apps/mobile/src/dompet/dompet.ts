import { english, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { sha256, toHex, type Address, type Hex } from "viem";

/**
 * Inti dompet per pengguna — fungsi murni, TANPA impor react-native atau expo,
 * supaya seluruhnya teruji di vitest (spec dompet §4).
 *
 * Hanya 12 kata (128 bit entropi) yang dibuat dan diterima. Jalur turunan
 * standar m/44'/60'/0'/0/0 — alamat yang sama dengan MetaMask untuk 12 kata
 * yang sama.
 */
export const JUMLAH_KATA = 12;
const BAIT_ENTROPI = 16;

/** Huruf kecil, spasi di tepi dibuang, spasi/baris baru di antara kata menjadi satu spasi. */
export function normalisasiMnemonik(teks: string): string {
  return teks.trim().toLowerCase().split(/\s+/).filter((k) => k !== "").join(" ");
}

function bitDari(bait: Uint8Array): string {
  return Array.from(bait, (b) => b.toString(2).padStart(8, "0")).join("");
}

/** BIP-39: 128 bit entropi + 4 bit checksum (sha256) → 12 kata daftar English. */
export function mnemonikDariEntropi(entropi: Uint8Array): string {
  if (entropi.length !== BAIT_ENTROPI) throw new Error("entropi harus 16 bait");
  const checksum = sha256(entropi, "bytes")[0]! >> 4;
  const bit = bitDari(entropi) + checksum.toString(2).padStart(4, "0");
  const kata: string[] = [];
  for (let i = 0; i < JUMLAH_KATA; i++) {
    kata.push(english[parseInt(bit.slice(i * 11, i * 11 + 11), 2)]!);
  }
  return kata.join(" ");
}

/**
 * 12 kata baru dari `crypto.getRandomValues`.
 *
 * Sengaja TIDAK memakai `generateMnemonic` viem (Ruling D2): generator itu
 * mengambil `globalThis.crypto` saat modul @noble/hashes pertama kali dimuat,
 * dan di Hermes objek itu baru ada setelah src/polyfills.ts berjalan. Di sini
 * `globalThis.crypto` dibaca saat fungsi DIPANGGIL.
 *
 * Penjaga kewarasan: bila semua bait sama (mis. `getRandomValues` tidak
 * mengisi buffer sehingga tetap nol → "abandon … about", kata yang dikenal
 * publik), MELEMPAR `entropi_lemah`. Peluang 16 bait acak sungguhan semuanya
 * sama adalah 2^-120.
 */
export function buatMnemonik(): string {
  const entropi = new Uint8Array(BAIT_ENTROPI);
  globalThis.crypto.getRandomValues(entropi);
  if (entropi.every((b) => b === entropi[0])) throw new Error("entropi_lemah");
  return mnemonikDariEntropi(entropi);
}

/** Tepat 12 kata dari daftar English dengan checksum BIP-39 yang benar. */
export function mnemonikSah(teks: string): boolean {
  const kata = normalisasiMnemonik(teks).split(" ");
  if (kata.length !== JUMLAH_KATA) return false;
  const indeks = kata.map((k) => english.indexOf(k));
  if (indeks.some((i) => i < 0)) return false;
  const bit = indeks.map((i) => i.toString(2).padStart(11, "0")).join("");
  const entropi = new Uint8Array(BAIT_ENTROPI);
  for (let i = 0; i < BAIT_ENTROPI; i++) entropi[i] = parseInt(bit.slice(i * 8, i * 8 + 8), 2);
  // Menyandikan ulang entropinya harus menghasilkan kata yang sama persis —
  // itu sekaligus memeriksa 4 bit checksum.
  return mnemonikDariEntropi(entropi) === kata.join(" ");
}

/**
 * Kunci privat jalur m/44'/60'/0'/0/0. Mahal: PBKDF2-SHA512 2048 putaran dalam
 * JS murni — dipanggil HANYA saat membuat atau mengimpor dompet, tidak pernah
 * saat aplikasi dibuka (spec dompet R3).
 */
export function kunciDariMnemonik(teks: string): Hex {
  const mnemonik = normalisasiMnemonik(teks);
  if (!mnemonikSah(mnemonik)) throw new Error("mnemonik_tidak_sah");
  const kunci = mnemonicToAccount(mnemonik).getHdKey().privateKey;
  if (!kunci) throw new Error("mnemonik_tidak_sah");
  return toHex(kunci);
}

/**
 * `0x` + 64 hex huruf kecil, atau null. Menerima tanpa awalan `0x` dan huruf
 * besar, karena kunci biasanya ditempel dari pengelola kunci lain. Menolak
 * nilai di luar rentang kurva secp256k1 (mis. nol).
 */
export function normalisasiKunciPrivat(teks: string): Hex | null {
  const t = teks.trim().toLowerCase();
  const hex = t.startsWith("0x") ? t : `0x${t}`;
  if (!/^0x[0-9a-f]{64}$/.test(hex)) return null;
  try {
    privateKeyToAccount(hex as Hex);
  } catch {
    return null;
  }
  return hex as Hex;
}

export function kunciPrivatSah(teks: string): boolean {
  return normalisasiKunciPrivat(teks) !== null;
}

export function alamatDariKunci(kunci: Hex): Address {
  return privateKeyToAccount(kunci).address;
}
