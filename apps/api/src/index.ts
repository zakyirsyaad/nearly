import { serve } from "@hono/node-server";
import type { Address, Hex } from "viem";
import { createApp } from "./app";
import { createProfileStore, createStore, createSupabase } from "./db";
import { createIdentity } from "./identity";
import { createRelayer } from "./relayer";
import { createTrustStore, createVouchStore, createReportStore } from "./trust/store";
import { createAttestor } from "./trust/attestor";
import { createVouchRelayer } from "./vouch-relayer";
import { createEventStore } from "./event-store";
import { createAttendanceRelayer } from "./attendance-relayer";
import { createFeedStore } from "./feed-store";
import { bacaKonfigurasiGreenfield, createGreenfield } from "./greenfield";
import { createMeetStore } from "./meet-store";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} wajib diisi`);
  return v;
}

const registry = required("CONNECTION_REGISTRY_ADDRESS") as Address;
const vouchRegistry = required("VOUCH_REGISTRY_ADDRESS") as Address;
const trustAttestorAddress = required("TRUST_ATTESTOR_ADDRESS") as Address;
const attendanceRegistry = required("ATTENDANCE_REGISTRY_ADDRESS") as Address;

// Greenfield OPSIONAL saat boot. Kosong semua berarti penyebaran tanpa
// lampiran gambar dan API menyala normal; terisi separuh berarti salah ketik
// dan bacaKonfigurasiGreenfield melempar. Lihat alasannya di greenfield.ts.
const gf = bacaKonfigurasiGreenfield(process.env);
const greenfield = gf.mode === "aktif"
  ? createGreenfield({ ...gf.cfg, privateKey: required("RELAYER_PRIVATE_KEY") as Hex })
  : null;
if (greenfield === null) {
  // Berisik dengan sengaja: mode terdegradasi yang senyap persis bahaya yang
  // aturan boot lama coba cegah, dan itu kekhawatiran yang sah.
  console.warn(
    "[greenfield] TIDAK dikonfigurasi — lampiran gambar dinonaktifkan. "
    + "Semua fitur lain berjalan normal; POST /posts/:id/image membalas 503 "
    + "image_unavailable, dan gambar lama tampil tanpa URL.",
  );
}

const supabase = createSupabase(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);

const app = createApp({
  store: createStore(supabase),
  profiles: createProfileStore(supabase),
  identity: createIdentity(required("MAINNET_RPC"), required("RPC_URL")),
  chain: createRelayer({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry,
  }),
  verifyingContract: registry,
  nowMs: () => Date.now(),
  trust: createTrustStore(supabase),
  vouches: createVouchStore(supabase),
  reports: createReportStore(supabase),
  attestor: createAttestor({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    attestor: trustAttestorAddress,
  }),
  vouchChain: createVouchRelayer({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry: vouchRegistry,
  }),
  vouchContract: vouchRegistry,
  adminToken: required("ADMIN_TOKEN"),
  events: createEventStore(supabase),
  attendance: createAttendanceRelayer({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry: attendanceRegistry,
  }),
  attendanceContract: attendanceRegistry,
  feed: createFeedStore(supabase),
  greenfield,
  meet: createMeetStore(supabase),
});

serve({ fetch: app.fetch, port: 8787 });
console.log("API Nearly berjalan di http://localhost:8787");
