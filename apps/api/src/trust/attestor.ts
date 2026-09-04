import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { TRUST_ATTESTOR_ABI } from "../abi";
import type { AttestorPort } from "../ports";

export function createAttestor(cfg: {
  rpcUrl: string; privateKey: Hex; attestor: Address;
}): AttestorPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });

  return {
    setScore(who, score, tier) {
      return client.writeContract({
        address: cfg.attestor,
        abi: TRUST_ATTESTOR_ABI,
        functionName: "setScore",
        args: [who, score, tier],
      });
    },
  };
}
