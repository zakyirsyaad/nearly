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
  /** 1, 2, atau null (luar jaringan). Menyalakan baris alasan di kartu. */
  hop: 1 | 2 | null;
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
export const postReport = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/report`, b);
export const postDelete = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/delete`, b);
export const postImage = (id: Hex, b: unknown) =>
  postJson<{ ok: true; imageStatus: string }>(`/posts/${id}/image`, b);
