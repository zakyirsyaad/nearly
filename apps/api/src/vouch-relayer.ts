import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { VOUCH_REGISTRY_ABI } from "./abi";
import type { VouchChainPort } from "./ports";

export function createVouchRelayer(cfg: {
  rpcUrl: string; privateKey: Hex; registry: Address;
}): VouchChainPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });
  const base = { address: cfg.registry, abi: VOUCH_REGISTRY_ABI } as const;

  return {
    submitVouch: (a) =>
      client.writeContract({
        ...base, functionName: "vouch",
        args: [a.from, a.to, a.tagsHash, a.expiresAt, a.sig],
      }),
    submitRevoke: (a) =>
      client.writeContract({
        ...base, functionName: "revoke", args: [a.from, a.to, a.expiresAt, a.sig],
      }),
    submitSlash: (subject) =>
      client.writeContract({ ...base, functionName: "slash", args: [subject] }),
  };
}
