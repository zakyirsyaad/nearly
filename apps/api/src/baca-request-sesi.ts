import type { Context } from "hono";
import type { RequestPesan } from "./pesan-auth";

/**
 * Salinan `bacaRequest` dan `uraiJson` dari routes/pesan.ts, dengan sengaja:
 * spec 4b+5 §12 melarang mengubah kode Fase 4c selain memanggilnya, jadi
 * fungsi privat di sana tidak diekspor ulang.
 *
 * Badan dibaca sebagai TEKS satu kali — hash-nya masuk tanda tangan sesi —
 * lalu diurai dari teks yang sama.
 */
export async function bacaRequestSesi(c: Context): Promise<RequestPesan> {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    pathDenganQuery: url.pathname + url.search,
    badan: await c.req.text(),
    header: (nama) => c.req.header(nama),
  };
}

export function uraiJsonAman(teks: string): unknown {
  try { return JSON.parse(teks); } catch { return null; }
}
