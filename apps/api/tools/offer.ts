/**
 * Harness sisi-A: membuat offer, mengirim lokasinya SENDIRI ke API, lalu
 * mencetak isi QR yang biasanya ditampilkan di layar HP.
 *
 * Dipakai berpasangan dengan peer.ts untuk menguji seluruh alur handshake
 * tanpa perangkat sama sekali.
 *
 *   tsx tools/offer.ts --at jakarta
 *
 * Env: DEV_PRIVATE_KEY, API_URL, CONNECTION_REGISTRY_ADDRESS
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { encodeCell, encodeQr, makeNonce, offerTypedData, qrExpiresAt } from "@nearly/shared";

const KOTA: Record<string, [number, number]> = {
  jakarta: [-6.2088, 106.8456],
  bandung: [-6.9175, 107.6191],
  surabaya: [-7.2575, 112.7521],
};

function arg(n: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
function need(n: string, v: string | undefined) {
  if (!v) throw new Error(`${n} wajib diisi`);
  return v;
}
function cellFrom(at: string): string {
  const p = KOTA[at.toLowerCase()];
  if (p) return encodeCell(p[0], p[1]);
  const [lat, lon] = at.split(",").map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error(`--at tidak dikenali: "${at}"`);
  return encodeCell(lat!, lon!);
}

async function main() {
  const apiUrl = need("API_URL", process.env.API_URL);
  const registry = need("CONNECTION_REGISTRY_ADDRESS", process.env.CONNECTION_REGISTRY_ADDRESS) as Address;
  const account = privateKeyToAccount(need("DEV_PRIVATE_KEY", process.env.DEV_PRIVATE_KEY) as Hex);

  const at = arg("at") ?? "jakarta";
  const cell = cellFrom(at);
  const nonce = makeNonce();
  const expiresAt = qrExpiresAt(Date.now());
  const offer = { initiator: account.address, nonce, expiresAt };
  const sigOffer = await account.signTypedData(offerTypedData(offer, registry));

  const res = await fetch(`${apiUrl}/handshake/offer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initiator: account.address, nonce, expiresAt: expiresAt.toString(),
      sigOffer, cell, atMs: Date.now(),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`OFFER DITOLAK ${res.status}: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.error(`A  : ${account.address}\nlok: ${at} -> ${cell}\n`);
  console.log(encodeQr({ v: 1, ...offer, sigOffer })); // stdout = isi QR saja
}

main().catch((e) => {
  console.error(`GAGAL: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
