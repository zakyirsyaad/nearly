import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import { kirimPushPesan, teksPush } from "../src/pesan-push";
import { buatPengguna, duniaPesan } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>;
let B: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B] = await Promise.all([buatPengguna("a1"), buatPengguna("b2")]);
});

const baris = (id: string) => ({ id, pengirim: A.address.toLowerCase() as Address, penerima: B.address.toLowerCase() as Address });

function dengPesanBelumDibaca(d: ReturnType<typeof duniaPesan>, id: string) {
  d.db.pesan.push({
    id, pengirim: A.address.toLowerCase() as Address, penerima: B.address.toLowerCase() as Address,
    ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: d.jam.sekarang, dibacaAtMs: null,
  });
}

describe("teksPush", () => {
  it("nama tampilan, atau fallback bila kosong (spec desain UI §7.4)", () => {
    expect(teksPush("Ani")).toBe("New message from Ani");
    expect(teksPush("  ")).toBe("New message from a connection");
    expect(teksPush("")).toBe("New message from a connection");
  });
});

describe("kirimPushPesan", () => {
  it("mengirim nama pengirim ke token penerima", async () => {
    const d = duniaPesan({ nama: { [A.address]: "Ani" } });
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.push.kirim).toHaveBeenCalledWith({
      tokens: ["ExponentPushToken[b]"], judul: "Nearly", badan: "New message from Ani", data: { jenis: "pesan" },
    });
  });

  // Spec 4c §7.2 — tidak pernah alamat pengirim, alamat penerima, atau isi.
  it("muatan push tidak memuat alamat mana pun", async () => {
    const d = duniaPesan({ nama: { [A.address]: "Ani" } });
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    const muatan = JSON.stringify(d.push.kirim.mock.calls[0]![0]).toLowerCase();
    expect(muatan).not.toContain(A.address.toLowerCase().slice(2));
    expect(muatan).not.toContain(B.address.toLowerCase().slice(2));
  });

  it("digabung per pengirim: pesan belum dibaca lain dari pengirim yang sama → tidak dikirim", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    dengPesanBelumDibaca(d, "id-2");
    await kirimPushPesan(d.deps, baris("id-2"));
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("penerima tanpa token → tidak mengirim dan tidak membaca nama", async () => {
    const d = duniaPesan();
    dengPesanBelumDibaca(d, "id-1");
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.push.kirim).not.toHaveBeenCalled();
    expect(d.deps.meet.profilRingkas).not.toHaveBeenCalled();
  });

  it("token mati dihapus", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[mati]" });
    dengPesanBelumDibaca(d, "id-1");
    d.push.kirim.mockResolvedValueOnce({ tokenMati: ["ExponentPushToken[mati]"] });
    await kirimPushPesan(d.deps, baris("id-1"));
    expect(d.db.token).toEqual([]);
  });

  it("push yang gagal tidak pernah melempar", async () => {
    const d = duniaPesan();
    d.db.token.push({ address: B.address.toLowerCase(), token: "ExponentPushToken[b]" });
    dengPesanBelumDibaca(d, "id-1");
    d.push.kirim.mockRejectedValueOnce(new Error("Expo mati"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(kirimPushPesan(d.deps, baris("id-1"))).resolves.toBeUndefined();
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });

  it("push null → tidak melakukan apa pun", async () => {
    const d = duniaPesan();
    await expect(kirimPushPesan({ ...d.deps, push: null }, baris("id-1"))).resolves.toBeUndefined();
    expect(d.deps.pesan.tokenPush).not.toHaveBeenCalled();
  });
});
