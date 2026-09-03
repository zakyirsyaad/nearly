import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { opBNBTestnet } from "viem/chains";
import { CONNECTION_REGISTRY_ABI } from "./abi.js";
import type { ChainPort } from "./ports.js";

/**
 * Relayer = attestor. Server membayar gas supaya pengguna tidak pernah melihat
 * kata "gas" (spec §10.3). Pengguna tetap yang menandatangani persetujuannya.
 */
export function createRelayer(cfg: {
  rpcUrl: string; privateKey: Hex; registry: Address;
}): ChainPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: opBNBTestnet,
    transport: http(cfg.rpcUrl),
  });

  return {
    async submitConnect(args) {
      return client.writeContract({
        address: cfg.registry,
        abi: CONNECTION_REGISTRY_ABI,
        functionName: "connect",
        args: [
          args.initiator, args.counterparty, args.nonce,
          args.expiresAt, args.sigOffer, args.sigAccept,
        ],
      });
    },
  };
}
