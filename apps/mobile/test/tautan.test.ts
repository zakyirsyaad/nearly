import { describe, expect, it } from "vitest";
import { baca, semuaBerkas } from "./support/berkas";
import { cocokRute, semuaPolaRute } from "./support/rute";

/** Tautan statis di satu berkas; `${…}` di templat menjadi segmen bebas "_". */
function tautanStatis(isi: string): string[] {
  const hasil: string[] = [];
  for (const m of isi.matchAll(/href="([^"]+)"/g)) hasil.push(m[1] ?? "");
  for (const m of isi.matchAll(/router\.(?:push|replace|navigate)\("([^"]+)"\)/g)) hasil.push(m[1] ?? "");
  for (const m of isi.matchAll(/(?:href=\{|router\.(?:push|replace|navigate)\()`([^`]+)`/g)) {
    hasil.push((m[1] ?? "").replace(/\$\{[^}]+\}/g, "_"));
  }
  return hasil;
}

const tautan = [...semuaBerkas("app"), ...semuaBerkas("components")]
  .filter((b) => b.endsWith(".tsx"))
  .flatMap((b) => tautanStatis(baca(b)).map((href) => ({ berkas: b, href })));

// Spec desain UI §5, §10.1: layar pindah ke grup tab tanpa mengubah URL (R2);
// satu-satunya URL baru /salaman, dan /qr + /scan hilang.
describe("tautan", () => {
  it("ada tautan yang diperiksa", () => {
    expect(tautan.length).toBeGreaterThan(0);
  });

  it("setiap tautan statis menunjuk rute yang ada", () => {
    const pola = semuaPolaRute();
    expect(tautan.filter((t) => !cocokRute(t.href, pola))).toEqual([]);
  });

  it("tidak ada lagi /qr atau /scan", () => {
    expect(tautan.filter((t) => /^\/(qr|scan)(\/|\?|$)/.test(t.href))).toEqual([]);
  });
});
