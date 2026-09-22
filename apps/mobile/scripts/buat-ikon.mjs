// Membuat PNG ikon dan splash dari assets/sumber/n.svg (spec desain UI §3.5, R11).
// Jalankan dari akar repo: pnpm --filter @nearly/mobile run ikon
// Hasilnya di-commit; mesin pemilik tidak punya rsvg-convert/ImageMagick.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ASET = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
// Sama dengan theme/colors.ts (primary, background): skrip Node ini tidak bisa
// mengimpor TypeScript.
const KUNING = "#f3ba2f";
const GELAP = "#07090f";
const SISI = 1024;

const sumber = readFileSync(join(ASET, "sumber", "n.svg"), "utf8");
const path = sumber.match(/\sd="([^"]+)"/)?.[1];
if (!path) throw new Error('path "n" tidak ditemukan di assets/sumber/n.svg');

// "n" (kotak x 28–72, y 25–75 di viewBox 100) diskalakan di sekitar pusat (50, 50).
function svg({ latar, warna, skala }) {
  const geser = 50 - 50 * skala;
  const kotak = latar ? `<rect width="100" height="100" fill="${latar}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SISI}" height="${SISI}" viewBox="0 0 100 100">${kotak}<path transform="translate(${geser} ${geser}) scale(${skala})" d="${path}" fill="${warna}"/></svg>`;
}

function tulis(nama, isi, sisi = SISI) {
  const png = new Resvg(isi, { fitTo: { mode: "width", value: sisi } }).render().asPng();
  writeFileSync(join(ASET, nama), png);
  console.log(`${nama}: ${png.length} bait`);
}

// icon.png: latar kuning penuh (iOS memotong sudut sendiri), "n" gelap
// selebar ±57% kanvas — lebar path 44, jadi skala 57/44.
tulis("icon.png", svg({ latar: KUNING, warna: GELAP, skala: 57 / 44 }));
// adaptive-icon.png: transparan, "n" gelap di dalam zona aman tengah 66%
// (setengah diagonal kotak 33,3 × 0,9 = 30 ≤ 33).
tulis("adaptive-icon.png", svg({ latar: null, warna: GELAP, skala: 0.9 }));
// splash-icon.png: transparan, "n" kuning (imageWidth 120 di app.json).
tulis("splash-icon.png", svg({ latar: null, warna: KUNING, skala: 1 }));

// notification-icon.png: ikon kecil bilah status Android — sistem hanya memakai
// kanal alfa, jadi "n" putih di atas transparan; warnanya diberi plugin
// expo-notifications (app.json, "color"). 96×96 = xxxhdpi (spec distribusi D9).
tulis("notification-icon.png", svg({ latar: null, warna: "#ffffff", skala: 1 }), 96);
