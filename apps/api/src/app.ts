import { Hono } from "hono";
import { handshakeRoutes } from "./routes/handshake";
import { profileRoutes } from "./routes/profile";
import { trustRoutes } from "./routes/trust";
import { vouchRoutes } from "./routes/vouch";
import { reportRoutes } from "./routes/report";
import { adminRoutes } from "./routes/admin";
import { eventRoutes } from "./routes/events";
import { feedRoutes } from "./routes/feed";
import { meetRoutes } from "./routes/meet";
import { blokirRoutes } from "./routes/blokir";
import { pesanRoutes } from "./routes/pesan";
import { grafRoutes } from "./routes/graf";
import { recomputeTrust } from "./trust/recompute";
import type {
  GateDeps, TrustStore, VouchStore, ReportStore, AttestorPort, VouchChainPort,
  EventStore, AttendanceChainPort, FeedStore, GreenfieldPort, MeetStore, BlokirStore,
  PesanStore, PushPort,
} from "./ports";
import type { Address } from "viem";
import type { GrafStore } from "./ports";

export type TrustDeps = GateDeps & {
  trust: TrustStore;
  vouches: VouchStore;
  reports: ReportStore;
  attestor: AttestorPort;
  vouchChain: VouchChainPort;
  vouchContract: Address;
  adminToken: string;
  events: EventStore;
  attendance: AttendanceChainPort;
  attendanceContract: Address;
  feed: FeedStore;
  greenfield: GreenfieldPort | null;
  meet: MeetStore;
  blokir: BlokirStore;
  pesan: PesanStore;
  push: PushPort | null;
  graf: GrafStore;
  webOrigins: readonly string[];
};

// Modul-level, dengan sengaja (Task 8): relayer yang sama menandatangani
// connect, vouch, DAN setScore (lihat index.ts — satu RELAYER_PRIVATE_KEY
// untuk ketiganya). recomputeTrust melakukan loadGraph + computeTrust +
// setScore berurutan; dua panggilan onChanged() yang tumpang tindih (dua
// handshake bersamaan di ruangan 100 orang, kasus yang PALING mungkin
// terjadi) akan sama-sama writeContract dengan account yang sama, viem
// mengambil pending nonce yang SAMA untuk keduanya, dan satu transaksi
// tergantikan diam-diam. Paling aman: paling banyak SATU recompute
// berjalan sekaligus, dan panggilan yang tumpang tindih bergabung ke
// promise yang sama alih-alih memicu loadGraph-nya sendiri-sendiri.
let recomputeInFlight: Promise<void> | null = null;

export function createApp(deps: TrustDeps) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));

  const onChanged = (): Promise<void> => {
    if (recomputeInFlight) return recomputeInFlight;
    recomputeInFlight = (async () => {
      try {
        await recomputeTrust({ trust: deps.trust, attestor: deps.attestor, nowMs: deps.nowMs });
      } catch (e) {
        // Perhitungan ulang yang gagal TIDAK boleh menggagalkan handshake atau
        // vouch yang sudah tercetak on-chain. Skor akan menyusul pada pemicu
        // berikutnya; koneksinya sendiri sudah permanen.
        console.error("recompute gagal:", e);
      } finally {
        recomputeInFlight = null;
      }
    })();
    return recomputeInFlight;
  };

  app.route("/", handshakeRoutes({ ...deps, onChanged }));
  app.route("/", profileRoutes(deps));
  app.route("/", trustRoutes(deps));
  app.route("/", vouchRoutes({ ...deps, onChanged }));
  app.route("/", reportRoutes(deps));
  app.route("/", eventRoutes({ ...deps, onChanged }));
  app.route("/", adminRoutes({ ...deps, onChanged }));
  // `onChanged` TIDAK dipanggil dari rute feed — unggahan dan suka tidak
  // mengubah graf pertemuan, jadi tidak ada skor trust yang perlu dihitung
  // ulang.
  app.route("/", feedRoutes(deps));
  // `onChanged` TIDAK dipanggil dari rute meet — menandai bukan bertemu, jadi
  // tidak ada graf pertemuan yang berubah dan tidak ada skor trust yang perlu
  // dihitung ulang (spec §9).
  app.route("/", meetRoutes(deps));
  // `onChanged` TIDAK dipanggil dari rute blokir, walaupun blokir MEMANG
  // mengubah graf trust — dan ini kebalikan dari Fase 3c, jadi alasannya
  // ditulis di sini alih-alih diserahkan ke ingatan.
  //
  // Recompute melakukan loadGraph + computeTrust + setScore on-chain untuk
  // setiap tier yang berubah. Dipanggil dari rute, ia menempel pada permintaan
  // pengguna: memblokir seseorang akan terasa macet berdetik-detik, dan
  // relayer membakar gas tepat pada saat seseorang sedang berusaha
  // menyingkirkan orang lain — momen paling buruk untuk gagal.
  //
  // Alasan yang lebih berat adalah privasi (Ruling R10, spec §4 yang
  // diamandemen): recompute segera menulis perubahan tier ON-CHAIN pada detik
  // blokir terjadi, dan stempel waktu publik itu menandai blokir yang privat.
  //
  // Skornya menyusul pada recompute berikutnya, yang dipicu handshake atau
  // vouch mana pun. Yang HARUS langsung berlaku adalah penyaringan feed dan
  // penanda (Task 9 dan 10), dan keduanya membaca tabel `blocks` secara
  // langsung tanpa menunggu recompute sama sekali.
  app.route("/", blokirRoutes(deps));
  // `onChanged` TIDAK dipanggil dari rute pesan — berkirim pesan bukan bertemu,
  // jadi graf pertemuan tidak berubah dan tidak ada skor trust yang perlu
  // dihitung ulang. Blokir dari percakapan memakai POST /blokir yang sudah ada,
  // yang juga sengaja tanpa recompute (Ruling R10 Fase 4a).
  app.route("/", pesanRoutes(deps));
  // Graf publik baca-saja untuk layar /live (spec 6 §4). `onChanged` TIDAK
  // dipanggil — tidak ada yang ditulis. CORS dipasang DI DALAM grafRoutes dan
  // hanya untuk /graf/*; rute lain di atas tidak pernah mendapat header CORS.
  app.route("/", grafRoutes(deps));
  return app;
}
