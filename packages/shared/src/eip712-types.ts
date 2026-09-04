/**
 * Literal ini WAJIB identik kata-per-kata dengan OFFER_TYPEHASH dan
 * ACCEPT_TYPEHASH di packages/contracts/src/ConnectionRegistry.sol.
 *
 * Kalau berbeda, setiap tanda tangan yang dibuat aplikasi akan ditolak kontrak
 * dengan BadOfferSignature — error yang tidak menunjukkan penyebab sebenarnya.
 */
export const OFFER_TYPE_STRING =
  "HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)";

export const ACCEPT_TYPE_STRING =
  "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)";

/** Bentuk string tipe EIP-712 dari definisi field, sesuai spesifikasi encodeType. */
export function encodeEip712Type(
  name: string,
  fields: readonly { name: string; type: string }[],
): string {
  return `${name}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}
