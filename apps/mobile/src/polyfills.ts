import * as Crypto from "expo-crypto";

/**
 * React Native tidak menyediakan `crypto.getRandomValues` secara global,
 * padahal makeNonce() di @nearly/shared membutuhkannya. Tanpa ini, layar QR
 * crash begitu dibuka.
 *
 * WAJIB diimpor sebagai baris PERTAMA di app/_layout.tsx, sebelum modul apa pun
 * yang menyentuh crypto.
 */
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = Crypto.getRandomValues;
}
