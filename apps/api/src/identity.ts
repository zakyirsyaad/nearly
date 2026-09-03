import { createPublicClient, http, type Address } from "viem";
import { mainnet, opBNBTestnet } from "viem/chains";
import type { IdentityPort } from "./ports.js";

/**
 * ENS hanya ada di Ethereum mainnet — memakai RPC opBNB untuk ENS akan SELALU
 * mengembalikan null tanpa error, dan itu sulit dilacak. Karena itu dua client.
 */
export function createIdentity(mainnetRpc: string, opbnbRpc: string): IdentityPort {
  const eth = createPublicClient({ chain: mainnet, transport: http(mainnetRpc) });
  const opbnb = createPublicClient({ chain: opBNBTestnet, transport: http(opbnbRpc) });

  return {
    ensName: (address) => eth.getEnsName({ address }),
    txCount: (address) => opbnb.getTransactionCount({ address }),
  };
}
