import { createPublicClient, http, type Address } from "viem";
import { bscTestnet, mainnet } from "viem/chains";
import type { IdentityPort } from "./ports.js";

/**
 * ENS hanya ada di Ethereum mainnet — memakai RPC BSC untuk ENS akan SELALU
 * mengembalikan null tanpa error, dan itu sulit dilacak. Karena itu dua client.
 */
export function createIdentity(mainnetRpc: string, chainRpc: string): IdentityPort {
  const eth = createPublicClient({ chain: mainnet, transport: http(mainnetRpc) });
  const chain = createPublicClient({ chain: bscTestnet, transport: http(chainRpc) });

  return {
    ensName: (address) => eth.getEnsName({ address }),
    txCount: (address) => chain.getTransactionCount({ address }),
  };
}
