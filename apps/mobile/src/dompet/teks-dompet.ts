/**
 * Semua kalimat dompet yang terlihat pengguna, murni dan teruji
 * (test/teks-dompet.test.ts).
 */

export type RingkasDompet = { punyaMnemonik: boolean; sudahDicadangkan: boolean };

/** Spanduk beranda: hanya dompet dari 12 kata yang belum ditandai sudah dicatat. */
export function perluPengingatCadangan(d: RingkasDompet): boolean {
  return d.punyaMnemonik && !d.sudahDicadangkan;
}

export const TEKS_PENGINGAT_CADANGAN =
  "Write down your 12-word recovery phrase. Without it, your identity and connections are gone if you lose this phone or delete the app.";

export const PERINGATAN_MNEMONIK_UTAMA =
  "Don't use the 12 words of a main wallet that holds assets. The wallet key is stored on this phone, not in a hardware wallet.";

export const PERINGATAN_LIHAT_MNEMONIK =
  "Anyone who sees these 12 words can use your identity. Make sure no person and no camera can see your screen.";

export const TEKS_TANPA_MNEMONIK =
  "This wallet was imported from a private key (development only) and has no 12-word recovery phrase.";

export function peringatanGantiDompet(d: RingkasDompet): string {
  if (!d.punyaMnemonik) {
    return "This wallet will be deleted from the phone. Without a 12-word recovery phrase, you can only use it again with the same private key.";
  }
  if (!d.sudahDicadangkan) {
    return "You have NOT written down your 12-word recovery phrase. If this wallet is deleted now, your identity, connections, and message history are gone forever.";
  }
  return "This wallet will be deleted from the phone. Your identity, connections, and message history can only come back through the 12-word recovery phrase you wrote down.";
}

/** "1. kata", "2. kata", … — nomor membantu mencatat urutan dengan benar. */
export function kataBernomor(mnemonik: string): string[] {
  return mnemonik.split(" ").map((k, i) => `${i + 1}. ${k}`);
}

const PESAN_GALAT: Record<string, string> = {
  mnemonik_tidak_sah: "Those 12 words aren't valid. Check the spelling and the order.",
  kunci_tidak_sah: "That private key isn't valid.",
  hanya_pengembangan: "Importing a private key is only available in development mode.",
  dompet_sudah_ada: "This phone already has a wallet. Remove it first with Switch wallet.",
  entropi_lemah: "This phone failed to generate random numbers, so no wallet was created. Close the app, then try again.",
  dompet_tidak_konsisten: "The wallet didn't save correctly and has been rolled back. Try again.",
  dompet_gagal_dihapus: "The wallet couldn't be deleted from the phone. Try again.",
  dompet_rusak:
    "The wallet data on this phone can't be read. Don't delete the app yet — try again, and have your 12-word recovery phrase ready.",
};

export function pesanGalatDompet(e: unknown): string {
  const kode = e instanceof Error ? e.message : "";
  return PESAN_GALAT[kode] ?? "Couldn't set up the wallet. Try again.";
}
