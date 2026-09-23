import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
// Font di-self-host (tanpa request ke Google Fonts); sama dengan aplikasi mobile.
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./gaya.css";
import { Landing } from "./pages/Landing";
import { pilihHalaman } from "./rute";

// Layar graf dimuat terpisah: force-graph cukup berat, dan pengunjung landing
// page tidak perlu mengunduhnya.
const Live = lazy(() => import("./pages/Live").then((m) => ({ default: m.Live })));

const akar = document.getElementById("root");
if (!akar) throw new Error("elemen #root tidak ada di index.html");

createRoot(akar).render(
  <StrictMode>
    {pilihHalaman(window.location.pathname) === "live"
      ? <Suspense fallback={<div className="live live-memuat">Loading…</div>}><Live /></Suspense>
      : <Landing />}
  </StrictMode>,
);
