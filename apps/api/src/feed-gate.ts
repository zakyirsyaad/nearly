import type { Address, Hex } from "viem";
import { recoverHapusPostSigner, recoverPostSigner } from "@nearly/shared";
import type { FeedDeps } from "./ports";

export type FeedFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "post_exists"; httpStatus: 409 }
  | { code: "post_not_found"; httpStatus: 404 }
  | { code: "not_author"; httpStatus: 403 }
  | { code: "image_slot_taken"; httpStatus: 409 }
  | { code: "image_too_large"; httpStatus: 413 };

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

  const signer = await recoverPostSigner(
    { postId: input.postId, author: input.author, body: input.body, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.author)) {
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
  const signer = await recoverHapusPostSigner(
    { postId: input.postId, author: input.author, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.author)) {
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
