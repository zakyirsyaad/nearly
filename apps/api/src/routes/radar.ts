import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Hex } from "viem";
import { DetakRequestSchema } from "@nearly/shared";
import { bacaRequestSesi, uraiJsonAman } from "../baca-request-sesi";
import { pemanggilPesan } from "../pesan-auth";
import { buatPenyapuLokasi } from "../penyapu-lokasi";
import type { RadarDeps } from "../ports";
import { buatPenghitungKoneksiBersama, detak, lihatRadar } from "../radar-gate";
import { kirimNotifKedekatan } from "../radar-notif";

const BUTUH_AUTENTIKASI = { code: "butuh_autentikasi" } as const;
const EVENT_ID = /^0x[0-9a-fA-F]{64}$/;

export function radarRoutes(deps: RadarDeps) {
  const r = new Hono();
  const penyapu = buatPenyapuLokasi({ radar: deps.radar, nowMs: deps.nowMs });
  // Satu cache per proses untuk koneksi bersama (desain UI §8.3, Ruling A17).
  const hitungBersama = buatPenghitungKoneksiBersama(deps);

  // Diautentikasi sesi Ed25519 Fase 4c (R1): polling tidak boleh memunculkan
  // popup dompet. Urutan spec 4b+5 §5.1: sesi → badan → acara → … .
  r.post(
    "/radar/:eventId/detak",
    bodyLimit({ maxSize: 1024, onError: (c) => c.json({ code: "terlalu_besar" }, 413) }),
    async (c) => {
      const req = await bacaRequestSesi(c);
      const pemanggil = await pemanggilPesan(req, deps);
      if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
      const parsed = DetakRequestSchema.safeParse(uraiJsonAman(req.badan));
      if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
      // eventId cacat bentuk diperlakukan sama dengan acara yang tidak ada.
      const eventId = c.req.param("eventId");
      if (!EVENT_ID.test(eventId)) return c.json({ code: "event_not_found", httpStatus: 404 }, 404);

      const hasil = await detak(pemanggil, eventId.toLowerCase() as Hex, parsed.data.cell, deps);
      if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

      if (hasil.value.baruHadir) {
        // TANPA await, dengan sengaja (spec 4b+5 §6.5). Dijamin tidak pernah melempar.
        void kirimNotifKedekatan(deps, { eventId: eventId.toLowerCase() as Hex, subjek: pemanggil });
      }
      if (hasil.value.jawaban.hadir) penyapu.mungkinSapu();
      // HANYA `jawaban` — `baruHadir` tidak pernah keluar.
      return c.json(hasil.value.jawaban);
    },
  );

  r.get("/radar/:eventId", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequestSesi(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const eventId = c.req.param("eventId");
    if (!EVENT_ID.test(eventId)) return c.json({ code: "event_not_found", httpStatus: 404 }, 404);
    const hasil = await lihatRadar(pemanggil, eventId.toLowerCase() as Hex, deps, hitungBersama);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ kartu: hasil.value.kartu, jumlah: hasil.value.jumlah });
  });

  return r;
}
