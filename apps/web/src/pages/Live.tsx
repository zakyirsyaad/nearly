import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods, type GraphData, type LinkObject, type NodeObject,
} from "react-force-graph-2d";
import { apiBelumDiatur, basisApi, buatKlienGraf, type AcaraApi } from "../api";
import { KEADAAN_KOSONG, type KeadaanGraf } from "../gabung-graf";
import { labelSimpul, perluLabel, radiusSimpul } from "../label";
import { bacaParamAcara } from "../rute";
import { mulaiSiklus, type Cakupan, type Tampilan } from "../siklus-graf";

/**
 * Layar proyektor (spec 6 §6.1). Teks berbahasa Inggris, sama dengan landing.
 *
 * force-graph MEMUTASI objek simpul (x, y, vx, vy) dan sisi (source/target
 * diganti objek simpul). Karena itu objek gambar disimpan di kolam per
 * cakupan dan DIPAKAI ULANG di setiap polling: objek baru untuk simpul lama
 * akan membuat seluruh graf melompat ke posisi acak setiap 3 detik.
 */

type SimpulGambar = { id: string; label: string; radius: number; baruSampaiMs: number | null; munculMs: number };
type SisiGambar = { id: number; source: string; target: string; baruSampaiMs: number | null };

const WARNA_SIMPUL = "#e8eefc";
const WARNA_SISI = "rgba(160, 180, 220, 0.35)";
const WARNA_SOROT = "#ffd166";
const WARNA_LABEL = "rgba(232, 238, 252, 0.9)";
const DURASI_TUMBUH_MS = 600;

const URL_API = import.meta.env.VITE_API_URL as string | undefined;
const klien = buatKlienGraf(basisApi(URL_API));
/** Build produksi tanpa `VITE_API_URL`: jangan polling, katakan saja (runbook §5). */
const TANPA_API = apiBelumDiatur(URL_API, import.meta.env.PROD);
if (TANPA_API) console.error("Nearly: VITE_API_URL is empty in this production build; /live cannot reach the API.");
const tunda = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ukuranJendela() {
  return { lebar: window.innerWidth, tinggi: window.innerHeight };
}

export function Live() {
  const eventIdUrl = useMemo(() => bacaParamAcara(window.location.search), []);
  const [cakupan, setCakupan] = useState<Cakupan>(
    eventIdUrl ? { jenis: "acara", eventId: eventIdUrl } : { jenis: "jaringan" },
  );
  const [tampilan, setTampilan] = useState<Tampilan>({
    keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null,
  });
  const [ukuran, setUkuran] = useState(ukuranJendela);
  const [daftarAcara, setDaftarAcara] = useState<AcaraApi[]>([]);

  const kanvas = useRef<ForceGraphMethods<NodeObject<SimpulGambar>, LinkObject<SimpulGambar, SisiGambar>> | undefined>(undefined);
  const sudahPas = useRef(false);
  const kolamSimpul = useRef(new Map<string, NodeObject<SimpulGambar>>());
  const kolamSisi = useRef(new Map<number, LinkObject<SimpulGambar, SisiGambar>>());

  useEffect(() => {
    const ubah = () => setUkuran(ukuranJendela());
    window.addEventListener("resize", ubah);
    return () => window.removeEventListener("resize", ubah);
  }, []);

  // Pemilih acara hanya muncul tanpa ?acara (spec 6 §6.1).
  useEffect(() => {
    if (eventIdUrl || TANPA_API) return;
    let hidup = true;
    klien.daftarAcara().then((a) => { if (hidup) setDaftarAcara(a); }).catch(() => {});
    return () => { hidup = false; };
  }, [eventIdUrl]);

  // Di awal acara graf berisi banyak pasangan yang belum saling tersambung.
  // Gaya tolak d3 tanpa batas jarak mendorong komponen-komponen itu menjauh
  // tanpa henti sampai keluar layar; dibatasi supaya semuanya tetap di ruangan.
  useEffect(() => {
    kanvas.current?.d3Force("charge")?.distanceMax?.(250);
  }, []);

  const kunciCakupan = cakupan.jenis === "acara" ? `acara:${cakupan.eventId}` : "jaringan";

  useEffect(() => {
    kolamSimpul.current = new Map();
    kolamSisi.current = new Map();
    sudahPas.current = false;
    setTampilan({ keadaan: KEADAAN_KOSONG, status: "memuat", acara: null, hitungan: null });
    if (TANPA_API) return;
    const siklus = mulaiSiklus({
      klien, cakupan, nowMs: () => Date.now(), tunda, saatBerubah: setTampilan,
    });
    return siklus.hentikan;
    // Sengaja hanya kunciCakupan: objek cakupan baru berisi sama tidak boleh memulai ulang siklus.
  }, [kunciCakupan]);

  const dataGraf = useMemo(
    () => susunDataGraf(tampilan.keadaan, kolamSimpul.current, kolamSisi.current),
    [tampilan.keadaan],
  );
  const jumlahSimpul = tampilan.keadaan.simpul.size;

  const judul = cakupan.jenis === "acara" ? (tampilan.acara?.title ?? "Loading event…") : "Nearly network";
  const angka = cakupan.jenis === "acara"
    ? [
      { nilai: tampilan.hitungan?.salaman ?? 0, label: "handshakes" },
      { nilai: tampilan.hitungan?.hadir ?? 0, label: "checked in" },
    ]
    : [
      { nilai: tampilan.keadaan.sisi.size, label: "connections" },
      { nilai: jumlahSimpul, label: "people" },
    ];

  return (
    <div className="live">
      <ForceGraph2D<SimpulGambar, SisiGambar>
        ref={kanvas}
        graphData={dataGraf}
        width={ukuran.lebar}
        height={ukuran.tinggi}
        backgroundColor="#05070d"
        enableNodeDrag={false}
        autoPauseRedraw={false}
        cooldownTime={15_000}
        // Sekali per cakupan, setelah tata letak awal tenang: seluruh graf
        // masuk layar. Tidak diulang, supaya zoom operator tidak direbut.
        onEngineStop={() => {
          if (sudahPas.current || jumlahSimpul === 0) return;
          sudahPas.current = true;
          kanvas.current?.zoomToFit(600, 80);
        }}
        nodeLabel={() => ""}
        linkColor={(l) => (menyala(l.baruSampaiMs) ? WARNA_SOROT : WARNA_SISI)}
        linkWidth={(l) => (menyala(l.baruSampaiMs) ? 3 : 1)}
        nodeCanvasObject={(n, ctx, skala) => {
          const tumbuh = Math.min(1, (Date.now() - n.munculMs) / DURASI_TUMBUH_MS);
          const r = n.radius * (0.2 + 0.8 * tumbuh);
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = WARNA_SIMPUL;
          ctx.fill();
          if (perluLabel(jumlahSimpul, menyala(n.baruSampaiMs), skala)) {
            const ukuranHuruf = 12 / skala;
            ctx.font = `${ukuranHuruf}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = WARNA_LABEL;
            ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + r + 2 / skala);
          }
        }}
      />

      <header className="live-kiri">
        <h1>{judul}</h1>
        <div className="live-tombol">
          <button
            type="button"
            disabled={!eventIdUrl}
            aria-pressed={cakupan.jenis === "acara"}
            onClick={() => eventIdUrl && setCakupan({ jenis: "acara", eventId: eventIdUrl })}
          >
            This event
          </button>
          <button
            type="button"
            aria-pressed={cakupan.jenis === "jaringan"}
            onClick={() => setCakupan({ jenis: "jaringan" })}
          >
            Whole network
          </button>
        </div>
        {!eventIdUrl && daftarAcara.length > 0 && (
          <label className="live-pemilih">
            Event
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) window.location.assign(`/live?acara=${e.target.value}`);
              }}
            >
              <option value="" disabled>Choose an event…</option>
              {daftarAcara.map((a) => (
                <option key={a.eventId} value={a.eventId}>
                  {a.live ? "● " : ""}{a.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <aside className="live-kanan">
        {angka.map((a) => (
          <div key={a.label} className="live-angka">
            <strong>{a.nilai.toLocaleString("en-US")}</strong>
            <span>{a.label}</span>
          </div>
        ))}
      </aside>

      <footer className="live-bawah">
        <p>Scan, shake hands, watch the graph grow.</p>
        <button type="button" onClick={() => void layarPenuh()}>Fullscreen</button>
      </footer>

      {TANPA_API ? (
        <div className="live-status" role="status">API not configured: set VITE_API_URL and redeploy</div>
      ) : tampilan.status !== "live" && (
        <div className="live-status" role="status">
          {tampilan.status === "memuat" && "Loading…"}
          {tampilan.status === "menyambung-ulang" && "Reconnecting…"}
          {tampilan.status === "tidak-ditemukan" && "Event not found"}
          {tampilan.status === "jendela-tak-didukung" && "This event is longer than 7 days and cannot be shown live"}
        </div>
      )}
    </div>
  );
}

function menyala(baruSampaiMs: number | null): boolean {
  return baruSampaiMs !== null && Date.now() < baruSampaiMs;
}

async function layarPenuh() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

function susunDataGraf(
  keadaan: KeadaanGraf,
  kolamSimpul: Map<string, NodeObject<SimpulGambar>>,
  kolamSisi: Map<number, LinkObject<SimpulGambar, SisiGambar>>,
): GraphData<NodeObject<SimpulGambar>, LinkObject<SimpulGambar, SisiGambar>> {
  const nodes: NodeObject<SimpulGambar>[] = [];
  for (const s of keadaan.simpul.values()) {
    let n = kolamSimpul.get(s.address);
    if (!n) {
      n = {
        id: s.address, label: "", radius: 0, baruSampaiMs: s.baruSampaiMs,
        // Simpul dari muatan awal langsung tampil penuh; yang baru membesar.
        munculMs: s.baruSampaiMs === null ? 0 : Date.now(),
      };
      kolamSimpul.set(s.address, n);
    }
    n.label = labelSimpul(s.displayName, s.address);
    n.radius = radiusSimpul(s.tierLabel);
    n.baruSampaiMs = s.baruSampaiMs;
    nodes.push(n);
  }

  const links: LinkObject<SimpulGambar, SisiGambar>[] = [];
  for (const s of keadaan.sisi.values()) {
    let l = kolamSisi.get(s.id);
    if (!l) {
      l = { id: s.id, source: s.a, target: s.b, baruSampaiMs: s.baruSampaiMs };
      kolamSisi.set(s.id, l);
    }
    // Sisi yang dibuang lalu masuk lagi lewat muat ulang acara memakai objek
    // kolam lamanya, tapi harus tetap menyala sebagai sisi baru.
    l.baruSampaiMs = s.baruSampaiMs;
    links.push(l);
  }
  return { nodes, links };
}
