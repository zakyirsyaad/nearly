import { semuaBerkas } from "./berkas";

/**
 * Pola URL setiap berkas layar di app/: segmen grup "(…)" dibuang (R2) dan
 * "index" di akhir dibuang. `app/(tabs)/(pesan)/pesan/index.tsx` → ["pesan"].
 */
export function semuaPolaRute(): string[][] {
  return semuaBerkas("app", /\.tsx$/)
    .filter((b) => !(b.split("/").pop() ?? "").startsWith("_"))
    .map((b) => b.replace(/^app\//, "").replace(/\.tsx$/, "").split("/").filter((s) => !/^\(.+\)$/.test(s)))
    .map((seg) => (seg[seg.length - 1] === "index" ? seg.slice(0, -1) : seg));
}

/** Apakah href (tanpa query/fragmen) cocok dengan salah satu pola; `[param]` cocok dengan segmen apa pun. */
export function cocokRute(href: string, pola: string[][]): boolean {
  const jalur = href.split(/[?#]/)[0] ?? "";
  const seg = jalur.split("/").filter(Boolean);
  return pola.some((p) => p.length === seg.length && p.every((s, i) => /^\[.+\]$/.test(s) || s === seg[i]));
}
