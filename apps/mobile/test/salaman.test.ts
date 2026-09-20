import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Tes baca-kode: repo ini tidak punya harness render React Native (pola yang
// sama dengan test/salaman-mode.test.ts dan test/review-fondasi.test.ts).
const sheet = () => tanpaKomentar(baca("components/salaman/sheet-bertemu.tsx"));

describe("sheet salaman berhasil (spec desain UI §6.2, R13)", () => {
  it("memakai Modal React Native dengan onRequestClose, bukan komponen BNA", () => {
    const isi = sheet();
    expect(isi).toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*"react-native"/);
    expect(isi).toContain("onRequestClose={pindaiOrangLain}");
    expect(isi).not.toContain("bottom-sheet");
  });

  it("geser bawaan Modal, dan memudar saat Reduce Motion menyala", () => {
    expect(sheet()).toContain('animationType={gerakDikurangi ? "fade" : "slide"}');
  });

  it("haptic Success dipicu saat sheet terbuka", () => {
    const isi = sheet();
    expect(isi).toContain("Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)");
    // Dipicu oleh efek pembukaan, bukan oleh penangan tombol penutup.
    const efek = isi.slice(isi.indexOf("useEffect(() => {"), isi.indexOf("}, [hasil.initiator]);"));
    expect(efek).toContain("Haptics.notificationAsync");
  });

  it("nama diambil dari GET /profile publik tanpa bukti (R14)", () => {
    const isi = sheet();
    expect(isi).toContain("req<{ displayName?: string }>(`/profile/${untuk}`)");
    expect(isi).not.toContain("kueriBuktiProfil");
  });

  it("jawaban basi dibuang dengan membandingkan alamat sebelum mengisi nama (R14)", () => {
    const isi = sheet();
    expect(isi).toContain("if (!terpasang.current) return;");
    expect(isi).toContain("if (alamatKini.current.toLowerCase() !== untuk.toLowerCase()) return;");
  });

  it("View profile menutup sheet lalu membuka profil; hanya di penangan itu ada router.push", () => {
    const isi = sheet();
    const penangan = isi.slice(isi.indexOf("const lihatProfil"), isi.indexOf("const pindaiOrangLain"));
    expect(penangan).toContain("onTutup();");
    expect(penangan).toContain("router.push(`/profile/${hasil.initiator}`);");
    expect([...isi.matchAll(/router\.push\(/g)]).toHaveLength(1);
  });

  it("judul, lencana, dan baris tx memakai fungsi murni yang teruji", () => {
    const isi = sheet();
    expect(isi).toContain("judulSheetBertemu(nama, hasil.initiator)");
    expect(isi).toContain("AWALAN_SHEET_BERTEMU");
    expect(isi).toContain('<Lencana varian="terverifikasi" />');
    expect(isi).toContain("teksTerkoneksi(hasil.txHash)");
  });

  it("avatarmu bercincin primary, avatarnya bercincin verified (#16D)", () => {
    const isi = sheet();
    expect(isi).toContain('cincin="primary"');
    expect(isi).toContain('cincin="verified"');
    // Layar Salaman tidak memuat namamu sendiri (§11 batas #17).
    expect(isi).toContain("nama={null}");
  });
});
