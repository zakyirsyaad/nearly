import type { Address, Hex } from "viem";
import {
  acceptTypedData, offerTypedData,
  type HandshakeAccept, type HandshakeOffer,
} from "@nearly/shared";
import type { NearlySigner } from "./signer.js";

type SignTypedData = (args: unknown) => Promise<Hex>;

/**
 * Signer yang memakai wallet sungguhan lewat wagmi/Reown. Bentuknya sengaja
 * identik dengan createDevSigner supaya seluruh layar tidak perlu tahu
 * bedanya — port yang sama, implementasi berbeda.
 */
export function createWalletSigner(
  account: Address,
  signTypedDataAsync: SignTypedData,
  verifyingContract: Address,
): NearlySigner {
  return {
    address: account,
    signOffer: (offer: HandshakeOffer) =>
      signTypedDataAsync(offerTypedData(offer, verifyingContract)),
    signAccept: (accept: HandshakeAccept) =>
      signTypedDataAsync(acceptTypedData(accept, verifyingContract)),
  };
}
