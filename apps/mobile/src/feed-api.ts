import type { Hex } from "viem";
import { postJson, req } from "./http";

export type FeedPost = {
  postId: Hex;
  author: string;
  displayName: string;
  tier: number;
  body: string;
  imageUrl: string | null;
  imageStatus: "none" | "pending" | "ready" | "failed";
  likeCount: number;
  sudahSuka: boolean;
  /**
   * 0 (milikmu), 1, 2, atau null (luar jaringan). Menyalakan baris alasan di
   * kartu.
   */
  hop: 0 | 1 | 2 | null;
  createdAtMs: number;
};

export function getFeed(who?: string, cursor?: string) {
  const q = new URLSearchParams();
  if (who) q.set("who", who);
  if (cursor) q.set("cursor", cursor);
  const s = q.toString();
  return req<{ posts: FeedPost[]; cursor: string | null }>(`/feed${s ? `?${s}` : ""}`);
}

export const postPost = (b: unknown) => postJson<{ ok: true }>("/posts", b);
export const postLike = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/like`, b);
/**
 * Laporan butuh tanda tangan `LaporPost` (spec §5). Tipenya dinyatakan di
 * sini, bukan `unknown`, supaya pemanggil yang lupa menandatangani gagal saat
 * typecheck alih-alih mendapat 401 saat dijalankan.
 */
export type LaporPostBody = {
  postId: Hex;
  reporter: string;
  reason: string;
  /** unix DETIK sebagai string — JSON tidak punya bigint. */
  expiresAt: string;
  sig: Hex;
};

export const postReport = (id: Hex, b: LaporPostBody) =>
  postJson<{ ok: true }>(`/posts/${id}/report`, b);
export type HapusPostBody = {
  postId: Hex;
  author: string;
  /** unix DETIK sebagai string. */
  expiresAt: string;
  sig: Hex;
};

export const postDelete = (id: Hex, b: HapusPostBody) =>
  postJson<{ ok: true }>(`/posts/${id}/delete`, b);
export const postImage = (id: Hex, b: unknown) =>
  postJson<{ ok: true; imageStatus: string }>(`/posts/${id}/image`, b);
