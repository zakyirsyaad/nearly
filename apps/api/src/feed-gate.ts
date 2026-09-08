import type { Address, Hex } from "viem";
import {
  recoverHapusPostSigner, recoverLampirGambarSigner, recoverLaporPostSigner,
  recoverLikeSigner, recoverPostSigner,
} from "@nearly/shared";
import type { FeedDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type FeedFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "post_exists"; httpStatus: 409 }
  | { code: "post_not_found"; httpStatus: 404 }
  | { code: "not_author"; httpStatus: 403 }
  | { code: "image_slot_taken"; httpStatus: 409 }
  | { code: "image_too_large"; httpStatus: 413 }
  | { code: "image_unavailable"; httpStatus: 503 };

export type FeedResult<T> = { ok: true; value: T } | { ok: false; failure: FeedFailure };

const fail = (failure: FeedFailure): { ok: false; failure: FeedFailure } =>
  ({ ok: false, failure });

const sudahLewat = (deps: FeedDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type CreatePostInput = {
  postId: Hex; author: Address; body: string; expiresAt: bigint; sig: Hex;
};

export async function createPost(
  input: CreatePostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  if (await deps.feed.getPost(input.postId)) {
    return fail({ code: "post_exists", httpStatus: 409 });
  }

  const signer = await pulihkanTandaTangan(() => recoverPostSigner(
      { postId: input.postId, author: input.author, body: input.body, expiresAt: input.expiresAt },
      input.sig,
      deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  // Waktu buat diambil dari server, bukan jam klien: jam perangkat bisa
  // digeser, dan `kebaruan` di penilai memakai nilai ini langsung.
  await deps.feed.createPost({
    postId: input.postId, author: input.author, body: input.body, createdAtMs: deps.nowMs(),
  });
  return { ok: true, value: undefined };
}

export type DeletePostInput = {
  postId: Hex; author: Address; expiresAt: bigint; sig: Hex;
};

export async function deletePost(
  input: DeletePostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  if (!post) return fail({ code: "post_not_found", httpStatus: 404 });

  // recoverHapusPostSigner, BUKAN recoverPostSigner. Tipe `Post` juga memuat
  // {postId, author, expiresAt}; kalau dipakai di sini, tanda tangan yang
  // dibuat untuk MEMPOSTING akan sah pula sebagai perintah MENGHAPUS. Kelas
  // kesalahan Ruling 23, dan dikunci tes.
  const signer = await pulihkanTandaTangan(() => recoverHapusPostSigner(
      { postId: input.postId, author: input.author, expiresAt: input.expiresAt },
      input.sig,
      deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!samaAlamat(post.author, input.author)) {
    return fail({ code: "not_author", httpStatus: 403 });
  }

  // Menghapus dua kali bukan galat — hasil akhirnya sama.
  if (post.deleted) return { ok: true, value: undefined };

  await deps.feed.markDeleted(input.postId);
  return { ok: true, value: undefined };
}

export type LikeInput = {
  postId: Hex; who: Address; suka: boolean; expiresAt: bigint; sig: Hex;
};

export async function setLike(input: LikeInput, deps: FeedDeps): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  // Unggahan terhapus diperlakukan sama dengan tidak ada: menghapus berarti
  // menghapus, termasuk bagi orang yang menyimpan tautannya.
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  // `suka` dari MASUKAN, bukan nilai karangan server. Ini yang membuat satu
  // tanda tangan tidak bisa dipakai dua arah.
  const signer = await pulihkanTandaTangan(() => recoverLikeSigner(
      { postId: input.postId, who: input.who, suka: input.suka, expiresAt: input.expiresAt },
      input.sig,
      deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.feed.setLike(input.postId, input.who, input.suka);
  return { ok: true, value: undefined };
}

export type ReportPostInput = {
  postId: Hex; reporter: Address; reason: string; expiresAt: bigint; sig: Hex;
};

/**
 * Laporan BERTANDA TANGAN — justru KARENA POST /report di Fase 2 melakukannya
 * (lihat routes/report.ts, yang memulihkan `recoverReportSigner` dan menolak
 * signer yang tidak cocok).
 *
 * Primary key (post_id, reporter) hanya menutup satu orang melapor
 * berkali-kali dengan alamat yang SAMA. Ia tidak menutup apa pun kalau
 * alamatnya berganti-ganti, dan `post_reports.reporter` bukan foreign key ke
 * `profiles` (migrasi 0004 hanya memeriksa format) — alamat pelapor bahkan
 * tidak perlu pernah ada. Tanpa tanda tangan ini, tiga permintaan dengan tiga
 * alamat karangan sudah cukup untuk melewati ambang 3 pelapor dan
 * menyembunyikan unggahan siapa pun dari feed semua orang, secara permanen.
 * Penulisnya tidak akan pernah tahu, karena `terlihat()` mengecualikan
 * unggahan sendiri dari penyaring laporan.
 *
 * Laporan sendiri TETAP off-chain; tanda tangan ini murni otentikasi ke
 * server, sama seperti Fase 2.
 */
export async function reportPost(
  input: ReportPostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  const signer = await pulihkanTandaTangan(() => recoverLaporPostSigner(
      {
        postId: input.postId, reporter: input.reporter,
        reason: input.reason, expiresAt: input.expiresAt,
      },
      input.sig,
      deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.reporter)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.feed.addReport(input.postId, input.reporter, input.reason);
  return { ok: true, value: undefined };
}

/**
 * Batas ukuran gambar. Ini BUKAN rem biaya — spec §11.3 menyatakan rem biaya
 * sengaja dibuat longgar dan dipantau manual. Ini pelindung memori API:
 * tanpa batas, satu badan permintaan 100 MB cukup untuk mematikan server.
 */
export const MAKS_GAMBAR_BYTES = 2 * 1024 * 1024;

const EKSTENSI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Deterministik dari postId, bukan acak: percobaan ulang setelah `failed`
 * menimpa objek yang sama alih-alih meninggalkan sampah di Greenfield yang
 * tidak dirujuk baris mana pun.
 */
export function objectNameOf(postId: Hex, mime: string): string {
  return `${postId.slice(2)}.${EKSTENSI[mime] ?? "bin"}`;
}

export type AttachImageInput = {
  postId: Hex; author: Address; mime: string; expiresAt: bigint;
  sig: Hex; dataBase64: string;
};

export async function attachImage(
  input: AttachImageInput, deps: FeedDeps,
): Promise<FeedResult<{ objectName: string; bytes: Uint8Array }>> {
  // Diperiksa PALING AWAL, dan 503 bukan 4xx: tanpa Greenfield endpoint ini
  // tidak bisa memenuhi permintaan siapa pun, dan itu keadaan server — bukan
  // kesalahan pemanggil. Ia juga tidak membocorkan apa pun, karena jawabannya
  // sama untuk setiap unggahan dan setiap penanya.
  //
  // Wajib mendahului setImagePending di bawah. Kalau tidak, baris akan
  // ditinggalkan `pending` selamanya untuk unggahan yang tidak pernah punya
  // kesempatan berjalan, dan penulisnya melihat pemintal yang tak pernah
  // selesai alih-alih jawaban.
  if (deps.greenfield === null) {
    return fail({ code: "image_unavailable", httpStatus: 503 });
  }

  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  const signer = await pulihkanTandaTangan(() => recoverLampirGambarSigner(
      { postId: input.postId, author: input.author, mime: input.mime, expiresAt: input.expiresAt },
      input.sig,
      deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!samaAlamat(post.author, input.author)) {
    return fail({ code: "not_author", httpStatus: 403 });
  }

  // Satu gambar per unggahan. `failed` sengaja BOLEH dicoba ulang — itu yang
  // membuat tombol coba-ulang di UI bekerja (spec §11.4).
  if (post.imageStatus === "pending" || post.imageStatus === "ready") {
    return fail({ code: "image_slot_taken", httpStatus: 409 });
  }

  const bytes = new Uint8Array(Buffer.from(input.dataBase64, "base64"));
  if (bytes.byteLength > MAKS_GAMBAR_BYTES) {
    return fail({ code: "image_too_large", httpStatus: 413 });
  }

  const objectName = objectNameOf(input.postId, input.mime);
  await deps.feed.setImagePending(input.postId, objectName, input.mime);
  return { ok: true, value: { objectName, bytes } };
}

/**
 * Dipanggil TANPA `await` oleh rute (spec §8.2). Karena itu ia tidak boleh
 * melempar apa pun: pelemparan dari promise yang tidak di-await menjadi
 * unhandled rejection yang bisa menjatuhkan proses.
 *
 * Kegagalan berhenti di sini sebagai status `failed`, dan teks unggahannya
 * tetap tayang — Greenfield mati tidak mematikan feed.
 */
export async function prosesUnggahGambar(
  deps: FeedDeps, postId: Hex, objectName: string, mime: string, bytes: Uint8Array,
): Promise<void> {
  const gf = deps.greenfield;
  if (gf === null) {
    // Tidak terjangkau lewat rute — attachImage sudah menolak lebih dulu.
    // Ada supaya kalau suatu saat terjangkau, yang tercatat adalah sebabnya,
    // bukan TypeError "cannot read properties of null" yang menyesatkan.
    console.error("unggah gambar dilewati: Greenfield tidak dikonfigurasi");
    await deps.feed.setImageFailed(postId).catch(() => {});
    return;
  }

  try {
    await gf.upload({ objectName, mime, bytes });
    await deps.feed.setImageDone(postId, gf.bucket);
  } catch (e) {
    console.error("unggah gambar gagal:", e);
    try {
      await deps.feed.setImageFailed(postId);
    } catch (e2) {
      // Database ikut bermasalah. Baris tertinggal `pending` (spec §11.4);
      // penulis bisa mencoba ulang setelah statusnya terlihat macet.
      console.error("menandai gambar gagal juga gagal:", e2);
    }
  }
}
