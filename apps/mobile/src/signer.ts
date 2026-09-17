import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  acceptTypedData, offerTypedData,
  type HandshakeAccept, type HandshakeOffer,
} from "@nearly/shared";

export type NearlySigner = {
  address: Address;
  signOffer(offer: HandshakeOffer): Promise<Hex>;
  signAccept(accept: HandshakeAccept): Promise<Hex>;
  /** Method generik untuk EIP-712 lain di luar handshake, mis. vouch (Fase 2). */
  signTypedData(data: unknown): Promise<Hex>;
};

/**
 * Signer dari kunci privat dompet di HP ini (spec dompet §3). Tanda tangan
 * lokal viem deterministik (RFC 6979) — syarat kunci pesan Fase 4c.
 *
 * Satu-satunya pemanggil di aplikasi adalah useNearlySigner
 * (src/dompet/konteks-dompet.tsx); layar tidak pernah memegang kunci privat.
 * Dijaga test/dompet-tanpa-kunci-dev.test.ts.
 */
export function createSignerDariKunci(privateKey: Hex, verifyingContract: Address): NearlySigner {
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    signOffer: (offer) => account.signTypedData(offerTypedData(offer, verifyingContract)),
    signAccept: (accept) => account.signTypedData(acceptTypedData(accept, verifyingContract)),
    signTypedData: (data) => account.signTypedData(data as Parameters<typeof account.signTypedData>[0]),
  };
}
