import { ed25519, x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { bytesToUtf8 } from "@noble/ciphers/utils";
import type { Hex } from "viem";

/**
 * Kripto pesan Fase 4c — SATU implementasi untuk HP dan server (spec 4c §5).
 * Kalau penyandian kanoniknya ditulis dua kali, dua sisi bisa diam-diam
 * berbeda format dan setiap tanda tangan gagal tanpa pesan galat yang jelas.
 *
 * Setiap fungsi `verifikasi*` dan `bukaPesan` TIDAK PERNAH melempar. Masukan
 * cacat berarti `false`. Itu yang membuat server tidak butuh pembungkus
 * seperti `pulihkanTandaTangan` untuk Ed25519.
 */
export const LABEL_PESAN = "nearly-pesan-v1";
export const MAKS_ISI_PESAN = 2000;

const SALT = utf8ToBytes(LABEL_PESAN);
const kecil = (a: string) => a.toLowerCase();
const keHex = (b: Uint8Array): Hex => `0x${bytesToHex(b)}`;
const dariHex = (h: string): Uint8Array => hexToBytes(h.startsWith("0x") ? h.slice(2) : h);

// base64 lewat btoa/atob: tersedia global di Node dan di Hermes.
function keBase64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function dariBase64(s: string): Uint8Array {
  const bin = atob(s);
  const keluar = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) keluar[i] = bin.charCodeAt(i);
  return keluar;
}

export type KunciPesanTurunan = {
  privTanda: Uint8Array;
  pubTanda: Hex;
  privEnkripsi: Uint8Array;
  pubEnkripsi: Hex;
};

/** Spec 4c §5.1. `tandaTangan` = tanda tangan EIP-712 `KunciPesan`, 65 byte. */
export function turunkanKunciPesan(tandaTangan: Hex): KunciPesanTurunan {
  const bahan = dariHex(tandaTangan);
  if (bahan.length !== 65) throw new Error("tanda tangan KunciPesan harus 65 byte");
  const privTanda = hkdf(sha256, bahan, SALT, utf8ToBytes("tanda-ed25519"), 32);
  const privEnkripsi = hkdf(sha256, bahan, SALT, utf8ToBytes("enkripsi-x25519"), 32);
  return {
    privTanda,
    pubTanda: keHex(ed25519.getPublicKey(privTanda)),
    privEnkripsi,
    pubEnkripsi: keHex(x25519.getPublicKey(privEnkripsi)),
  };
}

/**
 * Spec 4c §5.2 butir 2. Alamat diurutkan supaya kedua pihak mendapat kunci
 * yang sama — itu yang membuat pengirim bisa membaca riwayat kirimannya.
 */
export function kunciPercakapan(
  privEnkripsiKu: Uint8Array, pubEnkripsiLawan: Hex, alamatA: string, alamatB: string,
): Uint8Array {
  const [x, y] = [kecil(alamatA), kecil(alamatB)].sort();
  const rahasia = x25519.getSharedSecret(privEnkripsiKu, dariHex(pubEnkripsiLawan));
  return hkdf(sha256, rahasia, SALT, utf8ToBytes(`percakapan|${x}|${y}`), 32);
}

export type IsiAmplop = { pengirim: string; penerima: string; dikirimMs: number; isi: string };
export type Amplop = IsiAmplop & { v: 1; tanda: Hex };

/** Spec 4c §5.3. `isi` TERAKHIR: baris baru di dalamnya tidak bisa menggeser medan lain. */
export function stringAmplop(a: IsiAmplop): string {
  return `${LABEL_PESAN}\n${kecil(a.pengirim)}\n${kecil(a.penerima)}\n${a.dikirimMs}\n${a.isi}`;
}

export function tandaAmplop(privTanda: Uint8Array, a: IsiAmplop): Hex {
  return keHex(ed25519.sign(utf8ToBytes(stringAmplop(a)), privTanda));
}

export function verifikasiAmplop(a: IsiAmplop & { tanda: string }, pubTanda: string): boolean {
  try {
    if (!Number.isSafeInteger(a.dikirimMs) || a.dikirimMs < 0) return false;
    return ed25519.verify(dariHex(a.tanda), utf8ToBytes(stringAmplop(a)), dariHex(pubTanda));
  } catch {
    return false;
  }
}

const aad = (pengirim: string, penerima: string) =>
  utf8ToBytes(`${kecil(pengirim)}|${kecil(penerima)}`);

export function enkripsiPesan(p: {
  kunci: KunciPesanTurunan;
  pubEnkripsiLawan: Hex;
  pengirim: string;
  penerima: string;
  isi: string;
  dikirimMs: number;
}): { ciphertext: string; nonce: Hex } {
  if (p.isi.length === 0 || p.isi.length > MAKS_ISI_PESAN) {
    throw new Error(`isi pesan harus 1–${MAKS_ISI_PESAN} karakter`);
  }
  const isiAmplop: IsiAmplop = {
    pengirim: kecil(p.pengirim), penerima: kecil(p.penerima), dikirimMs: p.dikirimMs, isi: p.isi,
  };
  const amplop: Amplop = { v: 1, ...isiAmplop, tanda: tandaAmplop(p.kunci.privTanda, isiAmplop) };
  const nonce = randomBytes(24);
  const kunci = kunciPercakapan(p.kunci.privEnkripsi, p.pubEnkripsiLawan, p.pengirim, p.penerima);
  const ct = xchacha20poly1305(kunci, nonce, aad(p.pengirim, p.penerima))
    .encrypt(utf8ToBytes(JSON.stringify(amplop)));
  return { ciphertext: keBase64(ct), nonce: keHex(nonce) };
}

export type HasilBuka = { ok: true; amplop: Amplop } | { ok: false };

/**
 * Menolak (tanpa melempar) bila dekripsi gagal, bila pengirim/penerima di dalam
 * amplop tidak sama dengan kolom baris, atau bila tanda tangannya tidak cocok
 * dengan kunci tanda pengirim (spec 4c §5.2).
 *
 * `pubEnkripsiLawan` SELALU kunci enkripsi pihak LAIN dalam percakapan — untuk
 * pesan masuk maupun keluar. `pubTandaPengirim` kunci tanda siapa pun yang
 * menulis pesannya.
 */
export function bukaPesan(p: {
  kunci: KunciPesanTurunan;
  pubEnkripsiLawan: Hex;
  pubTandaPengirim: Hex;
  pengirim: string;
  penerima: string;
  ciphertext: string;
  nonce: Hex;
}): HasilBuka {
  try {
    const kunci = kunciPercakapan(p.kunci.privEnkripsi, p.pubEnkripsiLawan, p.pengirim, p.penerima);
    const polos = xchacha20poly1305(kunci, dariHex(p.nonce), aad(p.pengirim, p.penerima))
      .decrypt(dariBase64(p.ciphertext));
    const a = JSON.parse(bytesToUtf8(polos)) as Partial<Amplop>;
    if (a.v !== 1 || typeof a.isi !== "string" || typeof a.dikirimMs !== "number"
      || typeof a.tanda !== "string" || typeof a.pengirim !== "string"
      || typeof a.penerima !== "string") {
      return { ok: false };
    }
    if (kecil(a.pengirim) !== kecil(p.pengirim) || kecil(a.penerima) !== kecil(p.penerima)) {
      return { ok: false };
    }
    if (!verifikasiAmplop(a as Amplop, p.pubTandaPengirim)) return { ok: false };
    return { ok: true, amplop: a as Amplop };
  } catch {
    return { ok: false };
  }
}

export type IsiRequest = {
  method: string;
  pathDenganQuery: string;
  badan: string;
  ts: number;
  who: string;
};

/** Spec 4c §5.4. */
export function stringRequest(r: IsiRequest): string {
  const hashBadan = bytesToHex(sha256(utf8ToBytes(r.badan)));
  return `nearly-req-v1\n${r.method.toUpperCase()}\n${r.pathDenganQuery}\n${hashBadan}\n${r.ts}\n${kecil(r.who)}`;
}

export function tandaRequest(privTanda: Uint8Array, r: IsiRequest): Hex {
  return keHex(ed25519.sign(utf8ToBytes(stringRequest(r)), privTanda));
}

export function verifikasiRequest(r: IsiRequest & { tanda: string }, pubTanda: string): boolean {
  try {
    return ed25519.verify(dariHex(r.tanda), utf8ToBytes(stringRequest(r)), dariHex(pubTanda));
  } catch {
    return false;
  }
}

/** uuid v4 dari keacakan kriptografis — id pesan dibuat HP supaya kirim ulang idempoten. */
export function buatIdPesan(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
