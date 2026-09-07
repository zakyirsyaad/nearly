import { CONFIG } from "./config";

export class ApiError extends Error {
  constructor(public code: string, public status: number, public reason?: string) {
    super(`${code}${reason ? ` (${reason})` : ""}`);
  }
}

/**
 * Satu-satunya klien HTTP aplikasi ini. Sebelum berkas ini ada, api.ts dan
 * events-api.ts memelihara salinan yang nyaris identik — dan feed akan
 * menjadi yang ketiga.
 */
export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "unknown",
      res.status,
      typeof json.reason === "string" ? json.reason : undefined,
    );
  }
  return json as T;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return req<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
