import { recoverTypedDataAddress, type Address, type Hex } from "viem";

/** Umur QR (spec §7.1): 30 detik. */
export const QR_TTL_MS = 30_000;

/** opBNB testnet. */
export const NEARLY_CHAIN_ID = 5611 as const;

export type HandshakeOffer = { initiator: Address; nonce: Hex; expiresAt: bigint };
export type HandshakeAccept = HandshakeOffer & { counterparty: Address };

const TYPES = {
  HandshakeOffer: [
    { name: "initiator", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  HandshakeAccept: [
    { name: "initiator", type: "address" },
    { name: "counterparty", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const HANDSHAKE_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function offerTypedData(offer: HandshakeOffer, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { HandshakeOffer: TYPES.HandshakeOffer },
    primaryType: "HandshakeOffer",
    message: offer,
  } as const;
}

export function acceptTypedData(accept: HandshakeAccept, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { HandshakeAccept: TYPES.HandshakeAccept },
    primaryType: "HandshakeAccept",
    message: accept,
  } as const;
}

export function recoverOfferSigner(
  offer: HandshakeOffer, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...offerTypedData(offer, verifyingContract), signature });
}

export function recoverAcceptSigner(
  accept: HandshakeAccept, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...acceptTypedData(accept, verifyingContract), signature });
}
