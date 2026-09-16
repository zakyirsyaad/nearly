import type { MiddlewareHandler } from "hono";

/**
 * CORS khusus `/graf/*` (spec 6 §4.6). Ditulis sendiri, bukan `hono/cors`:
 * untuk permintaan OPTIONS dari origin yang TIDAK terdaftar, `hono/cors` tetap
 * memasang `Access-Control-Allow-Methods`, sedangkan spec meminta origin lain
 * mendapat NOL header CORS. Aturannya cukup kecil untuk dibaca utuh di sini.
 *
 * - origin terdaftar → `Access-Control-Allow-Origin: <origin itu>`
 * - origin lain, atau tanpa header Origin → tanpa header CORS apa pun
 * - daftar tidak kosong → `Vary: Origin` pada SETIAP respons, termasuk galat
 *   dan yang tanpa ACAO. Respons graf ber-`Cache-Control: public`: tanpa
 *   `Vary`, cache bersama di depan API (CDN kelak) boleh menyimpan varian
 *   tanpa ACAO lalu menyajikannya ke web, dan layar /live mati karena CORS.
 * - daftar kosong → CORS mati sepenuhnya
 * - hanya GET; preflight OPTIONS dari origin terdaftar dijawab 204, dari
 *   origin lain diteruskan apa adanya (tidak ada rute OPTIONS → 404)
 */
export function corsGraf(origins: readonly string[]): MiddlewareHandler {
  const izin = new Set(origins);
  return async (c, next) => {
    const origin = c.req.header("origin");
    const boleh = origin !== undefined && izin.has(origin);

    if (c.req.method === "OPTIONS" && boleh) {
      return c.body(null, 204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
    }

    await next();
    if (boleh) c.header("Access-Control-Allow-Origin", origin);
    // `Vary` bukan header CORS: origin lain tetap mendapat NOL header CORS.
    if (izin.size > 0) c.header("Vary", "Origin", { append: true });
  };
}
