/**
 * Harness sisi-B untuk menguji handshake dengan HANYA SATU perangkat fisik.
 *
 * HP kamu berperan sebagai A (menampilkan QR, memakai GPS sungguhan).
 * Skrip ini berperan sebagai B — menandatangani accept dan mengirim LOKASINYA
 * SENDIRI, persis seperti aplikasi mobile melakukannya.
 *
 * Kegunaan utamanya: lokasi B bisa ditentukan bebas, sehingga uji negatif
 * (spec §13 — dua pihak berjauhan HARUS gagal) cukup satu perintah.
 *
 * Pakai:
 *   tsx tools/peer.ts --qr '<isi QR>' --at jakarta     # harus BERHASIL
 *   tsx tools/peer.ts --qr '<isi QR>' --at bandung     # harus GAGAL
 *   tsx tools/peer.ts --qr '<isi QR>' --at -6.2,106.84 # koordinat bebas
 *
 * Env: PEER_PRIVATE_KEY, API_URL, CONNECTION_REGISTRY_ADDRESS
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { acceptTypedData, decodeQr, encodeCell, isQrExpired } from "@nearly/shared";

const KOTA: Record<string, [number, number]> = {
  jakarta: [-6.2088, 106.8456],
  bandung: [-6.9175, 107.6191],
  surabaya: [-7.2575, 112.7521],
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function need(name: string, v: string | undefined): string {
  if (!v) throw new Error(`${name} wajib diisi`);
  return v;
}

function cellFrom(at: string): string {
  const preset = KOTA[at.toLowerCase()];
  if (preset) return encodeCell(preset[0], preset[1]);

  const [lat, lon] = at.split(",").map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error(`--at tidak dikenali: "${at}". Pakai ${Object.keys(KOTA).join("|")} atau "lat,lon".`);
  }
  return encodeCell(lat!, lon!);
}

async function main() {
  const apiUrl = need("API_URL", process.env.API_URL);
  const registry = need("CONNECTION_REGISTRY_ADDRESS", process.env.CONNECTION_REGISTRY_ADDRESS) as Address;
  const account = privateKeyToAccount(need("PEER_PRIVATE_KEY", process.env.PEER_PRIVATE_KEY) as Hex);

  const payload = decodeQr(need("--qr", arg("qr")));
  if (!payload) throw new Error("Isi QR tidak bisa dibaca sebagai payload Nearly.");
  if (isQrExpired(payload, Date.now())) {
    throw new Error("QR sudah kedaluwarsa (umurnya 30 detik). Ambil isi QR yang baru.");
  }
  if (payload.initiator.toLowerCase() === account.address.toLowerCase()) {
    throw new Error("PEER_PRIVATE_KEY sama dengan initiator. Pakai dompet berbeda.");
  }

  const at = arg("at") ?? "jakarta";
  const cell = cellFrom(at);

  const accept = {
    initiator: payload.initiator,
    counterparty: account.address,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
  };
  const sigAccept = await account.signTypedData(acceptTypedData(accept, registry));

  console.log(`B  : ${account.address}`);
  console.log(`A  : ${payload.initiator}`);
  console.log(`lok: ${at} -> ${cell}`);

  const res = await fetch(`${apiUrl}/handshake/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initiator: payload.initiator,
      counterparty: account.address,
      nonce: payload.nonce,
      expiresAt: payload.expiresAt.toString(),
      sigAccept,
      cell,
      atMs: Date.now(),
    }),
  });
  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    console.log(`\nBERHASIL  tx: ${(body as { txHash?: string }).txHash}`);
    return;
  }
  console.log(`\nDITOLAK   ${res.status}  ${JSON.stringify(body)}`);
  // Ditolak bukan error skrip — untuk uji negatif, DITOLAK justru hasil yang benar.
}

main().catch((e) => {
  console.error(`\nGAGAL: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
