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

const pindai = () => tanpaKomentar(baca("components/salaman/mode-pindai.tsx"));

describe("mode Pindai memakai sheet, bukan teks hasil (spec §6.2, keputusan #16D)", () => {
  it("postAccept berhasil membuka sheet dan tidak berpindah layar", () => {
    const isi = pindai();
    expect(isi).toContain("setHasil({ initiator: payload.initiator, txHash });");
    expect(isi).toContain("<SheetBertemu");
    expect(isi).not.toContain("router.push(");
    expect(isi).not.toContain("router.navigate(");
  });

  it("onScan diabaikan selama sheet terbuka", () => {
    expect(pindai()).toContain("if (busy || hasil) return;");
  });

  it("check-in berhasil tetap teks hasil + toast, tanpa sheet", () => {
    const isi = pindai();
    const cabang = isi.slice(isi.indexOf("const checkin = decodeCheckInQr(data);"), isi.indexOf("const payload = decodeQr(data);"));
    expect(cabang).toContain("setResult(teksCheckInBerhasil(txHash));");
    expect(cabang).toContain("kabar.berhasil(teksCheckInBerhasil(txHash));");
    expect(cabang).not.toContain("setHasil(");
  });

  it("sisi QR tidak diberi sinyal baru — mode QR dan useRotatingQr tidak memuat sheet", () => {
    expect(baca("components/salaman/mode-qr.tsx")).not.toContain("SheetBertemu");
    expect(baca("src/handshake/useRotatingQr.ts")).not.toContain("SheetBertemu");
  });
});

describe("judul besar layar Handshake (spec §4.7, amandemen 2026-09-19)", () => {
  it("isi layar berada di dalam ScrollView dengan penyesuaian inset otomatis", () => {
    const isi = baca("app/(tabs)/(salaman)/salaman.tsx");
    expect(isi).toContain('contentInsetAdjustmentBehavior="automatic"');
    expect(isi).toContain("<ScrollView");
  });

  it("kuncinya terdaftar di LAYAR_TERMIGRASI", async () => {
    const { LAYAR_TERMIGRASI } = await import("../src/judul-layar");
    expect(LAYAR_TERMIGRASI.has("(tabs)/(salaman)/salaman")).toBe(true);
  });
});
