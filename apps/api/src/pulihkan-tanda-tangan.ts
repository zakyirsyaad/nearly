import type { Address } from "viem";

/**
 * Membungkus satu pemulihan penanda tangan EIP-712, mengembalikan `null`
 * alih-alih melempar.
 *
 * Kenapa ini ada. Skema Zod hanya memeriksa BENTUK tanda tangan — 65 byte
 * heksadesimal. Ia tidak bisa memeriksa isinya. Tanda tangan yang panjangnya
 * benar tapi byte `v`-nya di luar {0, 1, 27, 28} (mis. `0x99…99`) lolos skema,
 * lalu membuat viem melempar `Invalid yParityOrV value` — bukan mengembalikan
 * alamat yang salah, melainkan melempar synchronously di dalam promise.
 *
 * Lemparan itu menembus kontrak `Result` yang dideklarasikan setiap gerbang.
 * Akibatnya permintaan berakhir 500, padahal yang benar 401: pemanggil memang
 * mengirim tanda tangan yang tidak sah, dan itu kegagalan aturan bisnis biasa,
 * bukan kerusakan server. Bug ini terkonfirmasi hidup pada verifikasi lapangan
 * Fase 3b — `POST /posts/:id/report` mengembalikan 500 untuk badan seperti itu.
 *
 * `null` sengaja tidak dibedakan dari "alamat tidak cocok" di sisi pemanggil:
 * keduanya menghasilkan kegagalan tanda tangan yang sama persis, sehingga
 * respons tidak pernah memberi tahu penyerang MENGAPA tanda tangannya ditolak.
 *
 * Bungkus HANYA panggilan recover-nya. Menaruh panggilan store di dalam blok
 * yang sama akan mencuci pemadaman infrastruktur menjadi penolakan aturan
 * bisnis yang terlihat normal — kegagalan yang jauh lebih sulit dilihat
 * daripada bug yang diperbaiki di sini.
 */
export async function pulihkanTandaTangan(
  pulihkan: () => Promise<Address>,
): Promise<Address | null> {
  try {
    return await pulihkan();
  } catch {
    return null;
  }
}
