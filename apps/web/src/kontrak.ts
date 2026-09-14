/**
 * Kontrak Nearly di BNB Smart Chain testnet (chainId 97), untuk bagian
 * "On-chain" landing page (spec 6 §6.4).
 *
 * Disalin VERBATIM dari packages/contracts/broadcast/Deploy.s.sol/97/ —
 * run-1788453189701.json (ConnectionRegistry), run-1788544216266.json
 * (VouchRegistry, TrustAttestor, NearlyResolver), dan run-1788754863309.json
 * = run-latest.json (AttendanceRegistry). run-latest.json saja hanya memuat
 * deploy terakhir (AttendanceRegistry), jadi ketiga run dibaca.
 * Folder broadcast di-gitignore; salinan inilah sumber web.
 */

export const CHAIN_ID = 97;
export const BSCSCAN_TESTNET = "https://testnet.bscscan.com";

export type Kontrak = { nama: string; alamat: `0x${string}`; peran: string };

export const KONTRAK: readonly Kontrak[] = [
  {
    nama: "ConnectionRegistry",
    alamat: "0x7814656e4bcc5acae46099bd0238856e2a118811",
    peran: "Every verified in-person connection.",
  },
  {
    nama: "AttendanceRegistry",
    alamat: "0x8d1e85ff67553e5569d337690fc8102d7bd02299",
    peran: "Proof of attendance from check-ins made inside the venue during the event.",
  },
  {
    nama: "VouchRegistry",
    alamat: "0xb8472f186725b9895231d1092e887306dbd6e751",
    peran: "Vouches and tags between people who have met — revocable, and slashable.",
  },
  {
    nama: "TrustAttestor",
    alamat: "0x82621fa6e18acc3e403af6f50da18be20005b4e7",
    peran: "Published trust scores and tiers.",
  },
  {
    nama: "NearlyResolver",
    alamat: "0xd95e4b03cf92b541fea31af804c35474b6e49352",
    peran: "Read interface for other dApps: trust and tier by address.",
  },
];

export function tautanBscScan(alamat: string): string {
  return `${BSCSCAN_TESTNET}/address/${alamat}`;
}
