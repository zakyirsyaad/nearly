import { describe, expect, it } from "vitest";
import { baca, semuaBerkas, tanpaKomentar } from "./support/berkas";

// Temuan review akhir Rencana A (2026-09-18). Tes baca-kode: repo tidak punya
// harness render RN (lihat test/salaman-mode.test.ts untuk pola yang sama).

describe("layar di atas tab tidak menumpuk navigator tab kedua (review A #1)", () => {
  it("app/profile/** tidak memakai router.push — tujuan tab dicapai dengan router.navigate", () => {
    for (const berkas of semuaBerkas("app/profile")) {
      expect(tanpaKomentar(baca(berkas)), berkas).not.toMatch(/router\.push\(/);
    }
    expect(baca("app/profile/[address].tsx")).toContain("router.navigate(`/pesan/${address}`)");
  });
});

describe("QR check-in host hanya berjalan saat layarnya fokus (review A #2, spec §4.6)", () => {
  it("komponen isi membaca useIsFocused dan hanya merender QR (useCheckInQr) saat fokus", () => {
    const isi = tanpaKomentar(baca("app/(tabs)/(acara)/events/[id]/host-qr.tsx"));
    const bagianIsi = isi.slice(isi.indexOf("function HostQrScreenIsi"), isi.indexOf("function QrCheckInAktif"));
    expect(bagianIsi).toContain("const fokus = useIsFocused();");
    expect(bagianIsi).toContain("return fokus ? <QrCheckInAktif signer={signer} /> : null;");
    // Hook QR hanya di komponen yang dilepas saat tidak fokus (interval
    // rotasi dan GPS dibersihkan saat unmount).
    expect(isi.slice(0, isi.indexOf("function QrCheckInAktif"))).not.toContain("useCheckInQr(");
    expect(isi.slice(isi.indexOf("function QrCheckInAktif"))).toContain("useCheckInQr(");
  });
});

describe("parameter mode Handshake dipakai sekali lalu dibersihkan (review A #3)", () => {
  it("setelah ?mode diterapkan, parameternya dikosongkan supaya tautan yang sama berlaku lagi", () => {
    const isi = tanpaKomentar(baca("app/(tabs)/(salaman)/salaman.tsx"));
    const efek = isi.slice(isi.indexOf("useEffect(() => {"), isi.indexOf("}, [modeParam]);"));
    expect(efek).toContain("setMode(modeSalamanDariParam(modeParam));");
    expect(efek).toContain("router.setParams({ mode: undefined });");
  });
});

describe("jawaban lencana yang basi tidak menimpa yang baru (review A #4)", () => {
  it("setiap pemuatan bernomor, dan hanya jawaban nomor terakhir yang dipakai", () => {
    const isi = tanpaKomentar(baca("src/lencana/konteks-lencana.tsx"));
    expect(isi).toContain("const nomorTerakhir = useRef(0);");
    expect(isi).toContain("const nomor = ++nomorTerakhir.current;");
    expect(isi).toMatch(/if \(terpasang\.current && nomor === nomorTerakhir\.current\) setAngka\(/);
  });
});
