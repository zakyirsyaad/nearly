import { describe, expect, it } from "vitest";
import { modeSalamanDariParam, PILIHAN_MODE_SALAMAN } from "../src/salaman-mode";
import { baca } from "./support/berkas";

describe("mode layar Salaman (spec desain UI §6.2)", () => {
  it("mode awal Show QR; ?mode=pindai membuka Scan", () => {
    expect(modeSalamanDariParam(undefined)).toBe("qr");
    expect(modeSalamanDariParam("pindai")).toBe("pindai");
    expect(modeSalamanDariParam(["pindai"])).toBe("pindai");
    expect(modeSalamanDariParam("lain")).toBe("qr");
  });

  it("label segmen berbahasa Inggris, Show QR lebih dulu", () => {
    expect(PILIHAN_MODE_SALAMAN.map((p) => [p.nilai, p.label])).toEqual([["qr", "Show QR"], ["pindai", "Scan"]]);
  });

  it("isi mode dirender hanya saat tab fokus, di komponen isi (R10)", () => {
    const isi = baca("app/(tabs)/(salaman)/salaman.tsx");
    const pembungkus = isi.slice(isi.indexOf("export default function"), isi.indexOf("function SalamanIsi"));
    expect(pembungkus).not.toContain("useIsFocused");
    expect(isi).toContain("const fokus = useIsFocused();");
    expect(isi).toMatch(/\{fokus && \(/);
    expect(isi).toContain("<ModeQr signerSalaman={signerSalaman} />");
    expect(isi).toContain("<ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />");
  });

  it("mode Pindai tetap mencoba QR check-in sebelum QR salaman, dengan penjaga busy", () => {
    const isi = baca("components/salaman/mode-pindai.tsx");
    const checkin = isi.indexOf("decodeCheckInQr(data)");
    expect(checkin).toBeGreaterThan(-1);
    expect(checkin).toBeLessThan(isi.indexOf("decodeQr(data)"));
    expect(isi).toContain("if (busy || hasil) return;");
  });
});
