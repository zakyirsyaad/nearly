import { createPublicClient, http, type Address } from "viem";
import { bscTestnet, mainnet } from "viem/chains";
import type { IdentityPort } from "./ports";

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

    /**
     * Resolusi BALIK lalu dicek MAJU. Reverse record bisa diisi siapa saja
     * dengan nama apa saja; tanpa pemeriksaan maju, alamat mana pun bisa
     * mengaku `vitalik.eth` dan ikut memakai fotonya.
     */
    async ensAvatar(address) {
      const name = await eth.getEnsName({ address });
      if (!name) return null;

      const maju = await eth.getEnsAddress({ name });
      if (!maju || maju.toLowerCase() !== address.toLowerCase()) return null;

      return eth.getEnsAvatar({ name });
    },
  };
}
