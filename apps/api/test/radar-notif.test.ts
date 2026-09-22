import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { BATAS_NOTIF_KEDEKATAN, kirimNotifKedekatan, teksNotifKedekatan } from "../src/radar-notif";
import { alamat, duniaRadar, EVENT_RADAR } from "./support/dunia-radar";

const S = alamat(0x5);
const R = alamat(0x7);
const T = alamat(0x8);

const tokenDari = (...orang: Address[]) => Object.fromEntries(orang.map((o) => [o, [`ExponentPushToken[${o.slice(-4)}]`]]));
const penerimaPush = (d: ReturnType<typeof duniaRadar>) =>
  d.push.kirim.mock.calls.map(([p]) => p.tokens[0]);
const token = (o: Address) => `ExponentPushToken[${o.slice(-4)}]`;

describe("teksNotifKedekatan", () => {
  it("kalimat persis spec desain UI §7.4 (makna spec 4b+5 §6.4)", () => {
    expect(teksNotifKedekatan("saling_ingin_bertemu", "Budi")).toBe("Budi is at this event. You both want to meet.");
    expect(teksNotifKedekatan("saling_ingin_bertemu", "  ")).toBe("Someone you both want to meet is at this event.");
    expect(teksNotifKedekatan("pernah_bertemu", "Budi")).toBe("Budi, who you've met, is at this event.");
    expect(teksNotifKedekatan("pernah_bertemu", "")).toBe("Someone you've met is at this event.");
  });
});

describe("kirimNotifKedekatan — penerima", () => {
  it("koneksi yang hadir diberi tahu, DUA arah", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], nama: { [S]: "Sari", [R]: "Rudi" }, token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim.mock.calls.map(([p]) => [p.tokens[0], p.badan])).toEqual([
      [token(R), "Sari, who you've met, is at this event."],
      [token(S), "Rudi, who you've met, is at this event."],
    ]);
  });

  it("saling ingin bertemu diberi tahu, dan kalimatnya mengalahkan pernah bertemu", async () => {
    const d = duniaRadar({
      koneksi: [[S, R]], tanda: [{ who: S, target: R }, { who: R, target: S }], token: tokenDari(S, R),
    });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim.mock.calls.map(([p]) => p.badan)).toEqual([
      "Someone you both want to meet is at this event.",
      "Someone you both want to meet is at this event.",
    ]);
  });

  // Tanda sepihak BUKAN hubungan — vektor penguntitan (spec 4b+5 §6.2, §13 butir 2).
  it("tanda sepihak ke arah mana pun tidak memicu apa pun", async () => {
    for (const tanda of [[{ who: R, target: S }], [{ who: S, target: R }]]) {
      const d = duniaRadar({ tanda, token: tokenDari(S, R) });
      d.hadirkan(S); d.hadirkan(R);
      await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
      expect(d.push.kirim).not.toHaveBeenCalled();
      expect(d.db.notif).toEqual([]);
    }
  });

  it("orang tanpa hubungan tidak diberi tahu", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R, T) });
    d.hadirkan(S); d.hadirkan(R); d.hadirkan(T);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(penerimaPush(d)).not.toContain(token(T));
  });

  it("koneksi yang basi (> 15 menit) atau tidak hadir tidak diberi tahu", async () => {
    const d = duniaRadar({ koneksi: [[S, R], [S, T]], token: tokenDari(S, R, T) });
    d.hadirkan(S); d.hadirkan(R, 16);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("koneksi yang Tersembunyi tidak menerima dan tidak diberitahukan", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], tersembunyi: [R], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("subjek yang Tersembunyi tidak memicu apa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], tersembunyi: [S], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.push.kirim).not.toHaveBeenCalled();
  });

  it("blokir satu arah mana pun memutus kedua arah", async () => {
    for (const blokir of [[{ blocker: S, blocked: R }], [{ blocker: R, blocked: S }]]) {
      const d = duniaRadar({ koneksi: [[S, R]], blokir, token: tokenDari(S, R) });
      d.hadirkan(S); d.hadirkan(R);
      await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
      expect(d.push.kirim).not.toHaveBeenCalled();
    }
  });
});

describe("kirimNotifKedekatan — penggabungan dan batas", () => {
  it("sekali per pasangan per acara: pemicu kedua tidak mengirim ulang", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: R });
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
  });

  it("paling banyak BATAS_NOTIF_KEDEKATAN notifikasi per orang per acara", async () => {
    const koneksiLama = Array.from({ length: BATAS_NOTIF_KEDEKATAN + 2 }, (_, i) => alamat(0x100 + i));
    const d = duniaRadar({
      koneksi: koneksiLama.map((k) => [S, k] as [Address, Address]),
      token: tokenDari(S, ...koneksiLama),
    });
    d.hadirkan(S);
    for (const k of koneksiLama) d.hadirkan(k);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });

    const keS = penerimaPush(d).filter((t) => t === token(S));
    expect(keS).toHaveLength(BATAS_NOTIF_KEDEKATAN);
    expect(d.db.notif.filter((n) => n.penerima === S)).toHaveLength(BATAS_NOTIF_KEDEKATAN);
    // Setiap koneksi tetap diberi tahu tentang S — batas milik PENERIMA.
    for (const k of koneksiLama) expect(penerimaPush(d)).toContain(token(k));
  });

  it("penerima tanpa token tetap tercatat (sekali per pasangan) tapi tidak dikirimi", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(penerimaPush(d)).toEqual([token(S)]);
    expect(d.db.notif).toHaveLength(2);
  });

  it("token mati dihapus lewat hapusTokenPush", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    d.push.kirim.mockResolvedValueOnce({ tokenMati: [token(R)] });
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    expect(d.db.token.map((t) => t.token)).toEqual([token(S)]);
  });
});

describe("kirimNotifKedekatan — isi dan sifat", () => {
  it("muatan: judul Nearly, data jenis radar + eventId, TANPA alamat siapa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], nama: { [S]: "Sari" }, token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S });
    for (const [muatan] of d.push.kirim.mock.calls) {
      expect(muatan.judul).toBe("Nearly");
      expect(muatan.data).toEqual({ jenis: "radar", eventId: EVENT_RADAR });
      const teks = JSON.stringify({ judul: muatan.judul, badan: muatan.badan, data: muatan.data }).toLowerCase();
      expect(teks).not.toContain(S.slice(2));
      expect(teks).not.toContain(R.slice(2));
      expect(teks).not.toContain("hackathon");
      expect(teks).not.toContain("kalibata");
    }
  });

  it("push null → tidak membaca apa pun", async () => {
    const d = duniaRadar({ koneksi: [[S, R]] });
    d.hadirkan(S); d.hadirkan(R);
    await kirimNotifKedekatan({ ...d.deps, push: null }, { eventId: EVENT_RADAR, subjek: S });
    expect(d.deps.radar.hadirSejak).not.toHaveBeenCalled();
  });

  it("tidak pernah melempar: store mati", async () => {
    const d = duniaRadar({ koneksi: [[S, R]] });
    d.hadirkan(S); d.hadirkan(R);
    (d.deps.radar.hadirSejak as unknown as { mockRejectedValueOnce: (e: Error) => void })
      .mockRejectedValueOnce(new Error("supabase mati"));
    await expect(kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S })).resolves.toBeUndefined();
  });

  it("tidak pernah melempar: push mati di satu arah tidak menghentikan arah lain", async () => {
    const d = duniaRadar({ koneksi: [[S, R]], token: tokenDari(S, R) });
    d.hadirkan(S); d.hadirkan(R);
    d.push.kirim.mockRejectedValueOnce(new Error("expo mati"));
    await expect(kirimNotifKedekatan(d.deps, { eventId: EVENT_RADAR, subjek: S })).resolves.toBeUndefined();
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
  });
});
