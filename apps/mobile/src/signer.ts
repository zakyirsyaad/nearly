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
};

/**
 * Signer untuk pengembangan: menandatangani dengan private key lokal, sehingga
 * seluruh alur handshake bisa diuji di simulator tanpa memasang aplikasi wallet
 * di dua perangkat.
 *
 * PERINGATAN: private key yang masuk lewat EXPO_PUBLIC_* IKUT TERBUNDEL dan bisa
 * dibaca siapa pun yang punya file aplikasinya. Pakai HANYA dompet sekali pakai
 * berisi tBNB testnet, dan jangan pernah aktif di build produksi.
 */
export function createDevSigner(privateKey: Hex, verifyingContract: Address): NearlySigner {
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    signOffer: (offer) => account.signTypedData(offerTypedData(offer, verifyingContract)),
    signAccept: (accept) => account.signTypedData(acceptTypedData(accept, verifyingContract)),
  };
}
