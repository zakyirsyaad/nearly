import { describe, expect, it, vi } from "vitest";
import { ipPrivat, urlAman } from "../src/ssrf";

/**
 * Penjaga SSRF (2026-09-24). URL avatar ditulis pemilik nama ENS — orang luar.
 * Tanpa penjaga ini, siapa pun bisa menunjuk avatarnya ke layanan internal VPS
 * dan memakai API kita sebagai pengintai jaringan dalam.
 */
const publik = async () => ["93.184.216.34"];

/** Union-nya sengaja sempit: alasan hanya ada saat ditolak. */
const alasan = (h: Awaited<ReturnType<typeof urlAman>>) => (h.ok ? null : h.alasan);

describe("ipPrivat", () => {
  it("mengenali alamat internal IPv4", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.254",
      "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "239.1.1.1",
    ]) expect(ipPrivat(ip), ip).toBe(true);
  });

  it("membiarkan alamat publik lewat, termasuk tetangga rentang privat", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "172.15.0.1", "100.63.255.255", "1.1.1.1"])
      expect(ipPrivat(ip), ip).toBe(false);
  });

  it("mengenali alamat internal IPv6, termasuk yang menyamar sebagai IPv4", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"])
      expect(ipPrivat(ip), ip).toBe(true);
    expect(ipPrivat("2606:4700:4700::1111")).toBe(false);
  });
});

describe("urlAman", () => {
  it("menerima https publik", async () => {
    expect(await urlAman("https://contoh.test/a.png", publik)).toEqual({ ok: true });
  });

  it("menolak skema selain https", async () => {
    for (const u of ["http://contoh.test/a", "file:///etc/passwd", "gopher://contoh.test/"])
      expect((await urlAman(u, publik)).ok, u).toBe(false);
  });

  it("menolak port selain 443 — port lain artinya pemindaian", async () => {
    const hasil = await urlAman("https://contoh.test:8787/x", publik);
    expect(hasil).toEqual({ ok: false, alasan: "port" });
  });

  it("menolak alamat internal yang ditulis langsung", async () => {
    for (const u of [
      "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.1/x", "https://[::1]/x",
    ]) expect(alasan(await urlAman(u, publik)), u).toBe("ip_privat");
  });

  it("menolak host yang DNS-nya menunjuk ke dalam", async () => {
    const hasil = await urlAman("https://jahat.test/x", async () => ["127.0.0.1"]);
    expect(hasil).toEqual({ ok: false, alasan: "ip_privat" });
  });

  it("SEMUA hasil DNS diperiksa, bukan yang pertama saja", async () => {
    // Host jahat bisa menjawab satu IP publik + satu internal, berharap
    // pemeriksaan berhenti di hasil pertama.
    const hasil = await urlAman("https://campur.test/x", async () => ["93.184.216.34", "127.0.0.1"]);
    expect(hasil).toEqual({ ok: false, alasan: "ip_privat" });
  });

  it("DNS gagal atau kosong → ditolak, bukan diteruskan", async () => {
    expect(alasan(await urlAman("https://x.test/a", async () => { throw new Error("nx"); }))).toBe("dns");
    expect(alasan(await urlAman("https://x.test/a", async () => []))).toBe("dns");
  });

  it("URL cacat ditolak tanpa menyentuh DNS", async () => {
    const resolve = vi.fn(publik);
    expect((await urlAman("bukan url", resolve)).ok).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });
});
