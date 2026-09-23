// Membuat apps/web/public/og.png (1200x630) dari ikon "n" + warna palet aplikasi.
// Jalankan dari apps/web: node scripts/buat-og.mjs. Hasilnya di-commit ke public/.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const sumber = readFileSync("../mobile/assets/sumber/n.svg", "utf8");
const path = sumber.match(/\sd="([^"]+)"/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#07090f"/>
<rect x="80" y="252" width="126" height="126" rx="24" fill="#f3ba2f"/>
<path transform="translate(104 276) scale(0.78)" d="${path}" fill="#07090f"/>
<text x="80" y="470" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="600" fill="#e6edf7">Connections you can only</text>
<text x="80" y="546" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="600" fill="#e6edf7">make in person.</text>
<text x="1120" y="546" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#8a96ad">BNB Smart Chain testnet</text>
</svg>`;
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
writeFileSync("public/og.png", png);
console.log("og.png:", png.length, "bait");
