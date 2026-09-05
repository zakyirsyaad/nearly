import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { ATTENDANCE_REGISTRY_ABI } from "./abi";
import type { AttendanceChainPort } from "./ports";

/**
 * Cermin vouch-relayer.ts. Memakai RELAYER_PRIVATE_KEY yang SAMA dengan
 * connect, vouch, dan setScore — lihat catatan serialisasi di app.ts: dua
 * transaksi bersamaan dari akun yang sama akan mengambil nonce pending yang
 * sama, dan salah satunya tergantikan diam-diam.
 */
export function createAttendanceRelayer(cfg: {
  rpcUrl: string; privateKey: Hex; registry: Address;
}): AttendanceChainPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });
  const base = { address: cfg.registry, abi: ATTENDANCE_REGISTRY_ABI } as const;

  return {
    submitCreateEvent: (a) =>
      client.writeContract({
        ...base,
        functionName: "createEvent",
        args: [a.eventId, a.host, a.startsAt, a.endsAt, a.centerCell, a.expiresAt, a.sigHost],
      }),
    submitCheckIn: (a) =>
      client.writeContract({
        ...base,
        functionName: "checkIn",
        args: [a.eventId, a.attendee, a.nonce, a.expiresAt, a.sigHost, a.sigAttendee],
      }),
  };
}
