import { describe, expect, it, vi } from "vitest";
import { alamat, duniaGraf, idAcara, iso, NOW_GRAF, type DataDunia } from "./support/dunia-graf";

const A = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const E1 = idAcara("11");
const T0 = Math.floor(NOW_GRAF / 1000) - 3_600;
const ORIGIN = "https://nearly.vercel.app";

function koneksi(id: number, a: string, b: string, detik: number) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return {
    id, addr_a: x, addr_b: y, created_at: iso(detik * 1000),
    tx_hash: `0x${String(id).padStart(64, "0")}`, cell: "qqguv1r", nonce: `0x${String(id).padStart(64, "9")}`,
  };
}

const DATA: Partial<DataDunia> = {
  events: [{ event_id: E1, host: A, title: "BNB Hack", center_cell: "qqguv1r", starts_at: T0, ends_at: T0 + 7_200 }],
  checkins: [
    { event_id: E1, address: A, cell: "qqguv1r", nonce: "0x01" },
    { event_id: E1, address: B, cell: "qqguv1r", nonce: "0x02" },
    { event_id: E1, address: C, cell: "qqguv1r", nonce: "0x03" },
  ],
  connections: [koneksi(1, A, B, T0 + 60), koneksi(2, B, C, T0 + 120)],
  profil: { [A]: { displayName: "Budi", tier: 2 } },
};

/** Seluruh nama kunci, di kedalaman berapa pun. */
function semuaKunci(x: unknown, keluar = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => semuaKunci(v, keluar));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      keluar.add(k);
      semuaKunci(v, keluar);
    }
  }
  return keluar;
}

function headerCors(res: Response): string[] {
  return [...res.headers.keys()].filter((k) => k.toLowerCase().startsWith("access-control-"));
}

describe("GET /graf/jaringan", () => {
  it("bentuk respons: simpul dari sisi halaman ini, tier tanpa snapshot Baru, kursor, lengkap", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request("/graf/jaringan");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=2");
    expect(await res.json()).toEqual({
      simpul: [
        { address: A, displayName: "Budi", tierLabel: "Terpercaya" },
        { address: B, displayName: "", tierLabel: "Baru" },
        { address: C, displayName: "", tierLabel: "Baru" },
      ],
      sisi: [
        { id: 1, a: A, b: B, atMs: (T0 + 60) * 1000, txHash: `0x${"1".padStart(64, "0")}` },
        { id: 2, a: B, b: C, atMs: (T0 + 120) * 1000, txHash: `0x${"2".padStart(64, "0")}` },
      ],
      kursor: 2,
      lengkap: true,
    });
  });

  it("sejakId melewati sisi yang sudah dimiliki; halaman kosong mempertahankan kursor", async () => {
    const { app } = duniaGraf(DATA);
    const satu = await (await app.request("/graf/jaringan?sejakId=1")).json() as { sisi: { id: number }[]; kursor: number };
    expect(satu.sisi.map((s) => s.id)).toEqual([2]);
    const kosong = await (await app.request("/graf/jaringan?sejakId=2")).json();
    expect(kosong).toEqual({ simpul: [], sisi: [], kursor: 2, lengkap: true });
  });

  it("sejakId tak sah → 400 invalid_cursor", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request("/graf/jaringan?sejakId=-5");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_cursor" });
  });
});

describe("GET /graf/acara", () => {
  it("daftar acara untuk pemilih, dengan live", async () => {
    const { app } = duniaGraf(DATA);
    expect(await (await app.request("/graf/acara")).json()).toEqual({
      acara: [{ eventId: E1, title: "BNB Hack", startsAt: T0, endsAt: T0 + 7_200, live: true }],
    });
  });
});

describe("GET /graf/acara/:eventId", () => {
  it("halaman graf ditambah acara dan hitungan", async () => {
    const { app } = duniaGraf(DATA);
    const body = await (await app.request(`/graf/acara/${E1}`)).json() as Record<string, unknown>;
    expect(body.acara).toEqual({ eventId: E1, title: "BNB Hack", startsAt: T0, endsAt: T0 + 7_200, live: true });
    expect(body.hitungan).toEqual({ hadir: 3, salaman: 2 });
    expect(body.kursor).toBe(2);
    expect(body.lengkap).toBe(true);
  });

  it("id huruf besar dinormalkan", async () => {
    const { app } = duniaGraf(DATA);
    expect((await app.request(`/graf/acara/${E1.toUpperCase().replace("0X", "0x")}`)).status).toBe(200);
  });

  it("acara tidak ada → 404 event_not_found", async () => {
    const { app } = duniaGraf(DATA);
    const res = await app.request(`/graf/acara/${idAcara("99")}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "event_not_found" });
  });

  it("id berbentuk salah → 404 tanpa menyentuh store", async () => {
    const { app, graf } = duniaGraf(DATA);
    expect((await app.request("/graf/acara/bukan-id")).status).toBe(404);
    expect(graf.acara).not.toHaveBeenCalled();
  });
});

describe("yang tidak pernah keluar (spec 6 §4.4)", () => {
  const DILARANG = [
    "cell", "center_cell", "centerCell", "nonce", "score", "ratio", "operator_cluster", "operatorCluster",
    "blocked", "blocker", "blocks", "blokir", "terblokir", "diblokir", "host",
  ];
  const DIIZINKAN = new Set([
    "simpul", "address", "displayName", "tierLabel", "sisi", "id", "a", "b", "atMs", "txHash",
    "kursor", "lengkap", "acara", "eventId", "title", "startsAt", "endsAt", "live", "hitungan", "hadir", "salaman",
  ]);

  it("tidak ada kunci terlarang di respons mana pun — walau store membawanya", async () => {
    const { app } = duniaGraf(DATA);
    const kunci = new Set<string>();
    for (const jalur of ["/graf/jaringan", "/graf/acara", `/graf/acara/${E1}`]) {
      semuaKunci(await (await app.request(jalur)).json(), kunci);
    }
    for (const k of DILARANG) expect(kunci.has(k), `kunci terlarang: ${k}`).toBe(false);
    for (const k of kunci) {
      expect(k, `kunci tak dikenal: ${k}`).not.toMatch(/cell|nonce|score|ratio|operator|block|blokir|vouch|slash|report|lapor/i);
    }
    expect([...kunci].filter((k) => !DIIZINKAN.has(k))).toEqual([]);
  });

  it("sisi antara dua orang yang saling memblokir tampil tanpa penanda apa pun", async () => {
    const tanpa = duniaGraf(DATA);
    const dengan = duniaGraf({ ...DATA, blocks: [{ blocker: A, blocked: B }, { blocker: B, blocked: A }] });
    for (const jalur of ["/graf/jaringan", `/graf/acara/${E1}`]) {
      const x = await (await tanpa.app.request(jalur)).json() as { sisi: Record<string, unknown>[] };
      const y = await (await dengan.app.request(jalur)).json() as { sisi: Record<string, unknown>[] };
      expect(y).toEqual(x);
      const ab = y.sisi.find((s) => s.id === 1)!;
      expect(Object.keys(ab).sort()).toEqual(["a", "atMs", "b", "id", "txHash"]);
    }
  });
});

describe("cache 2 detik (spec 6 §4.5)", () => {
  it("dua permintaan identik dalam 2 detik → satu kueri store", async () => {
    const { app, graf, jam } = duniaGraf(DATA);
    await app.request("/graf/jaringan?sejakId=0");
    jam.sekarang += 1_999;
    await app.request("/graf/jaringan?sejakId=0");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(1);

    jam.sekarang += 1;
    await app.request("/graf/jaringan?sejakId=0");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(2);
  });

  it("permintaan bersamaan menunggu kueri yang sama", async () => {
    const { app, graf } = duniaGraf(DATA);
    await Promise.all([app.request(`/graf/acara/${E1}`), app.request(`/graf/acara/${E1}`)]);
    expect(graf.acara).toHaveBeenCalledTimes(1);
  });

  it("sejakId berbeda adalah kunci berbeda", async () => {
    const { app, graf } = duniaGraf(DATA);
    await app.request("/graf/jaringan?sejakId=0");
    await app.request("/graf/jaringan?sejakId=1");
    expect(graf.koneksiSejak).toHaveBeenCalledTimes(2);
  });

  it("galat store tidak disimpan", async () => {
    // Hono mencetak galat 500 ke console.error; dibungkam supaya keluaran tes bersih.
    const diam = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = duniaGraf(DATA);
    let gagal = true;
    const asli = d.graf.koneksiSejak;
    d.graf.koneksiSejak = async (s, b) => {
      if (gagal) throw new Error("mati");
      return asli(s, b);
    };
    expect((await d.app.request("/graf/jaringan")).status).toBe(500);
    gagal = false;
    expect((await d.app.request("/graf/jaringan")).status).toBe(200);
    diam.mockRestore();
  });
});

describe("CORS (spec 6 §4.6)", () => {
  it("origin terdaftar mendapat header origin itu", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: ORIGIN } });
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("origin lain tidak mendapat header CORS apa pun", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: "https://jahat.example" } });
    expect(res.status).toBe(200);
    expect(headerCors(res)).toEqual([]);
  });

  it("WEB_ORIGINS kosong → tidak ada header, bahkan untuk origin yang biasanya sah", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [] });
    const res = await app.request(`/graf/acara/${E1}`, { headers: { Origin: ORIGIN } });
    expect(headerCors(res)).toEqual([]);
  });

  it("preflight: origin terdaftar dijawab 204 dengan GET saja; origin lain tanpa header", async () => {
    const { app } = duniaGraf(DATA, { webOrigins: [ORIGIN] });
    const ok = await app.request("/graf/jaringan", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-methods")).toBe("GET");
    const lain = await app.request("/graf/jaringan", { method: "OPTIONS", headers: { Origin: "https://jahat.example" } });
    expect(headerCors(lain)).toEqual([]);
  });
});
