import type { Address, Hex } from "viem";

export type PendingOffer = {
  nonce: Hex;
  initiator: Address;
  expiresAt: bigint;
  sigOffer: Hex;
  /** Sel geohash7 yang dikirim A sendiri. */
  cell: string;
  /** Milidetik. */
  atMs: number;
  consumed: boolean;
};

export type HandshakeStore = {
  putOffer(offer: Omit<PendingOffer, "consumed">): Promise<void>;
  getOffer(nonce: Hex): Promise<PendingOffer | null>;
  consumeOffer(nonce: Hex): Promise<void>;
  areConnected(a: Address, b: Address): Promise<boolean>;
  countConnectionsSince(addr: Address, sinceMs: number): Promise<number>;
  recordConnection(row: {
    a: Address; b: Address; nonce: Hex; txHash: Hex; atMs: number;
  }): Promise<void>;
};

export type ChainPort = {
  submitConnect(args: {
    initiator: Address; counterparty: Address; nonce: Hex;
    expiresAt: bigint; sigOffer: Hex; sigAccept: Hex;
  }): Promise<Hex>;
};

export type GateDeps = {
  store: HandshakeStore;
  chain: ChainPort;
  profiles: ProfileStore;
  identity: IdentityPort;
  verifyingContract: Address;
  nowMs: () => number;
};

export type ConnectionRow = { address: Address; txHash: Hex; at: number };

export type ProfileStore = {
  listConnections(addr: Address, limit: number): Promise<ConnectionRow[]>;
  countConnections(addr: Address): Promise<number>;
  getDisplayName(addr: Address): Promise<string>;
};

export type IdentityPort = {
  /** ENS hidup di Ethereum mainnet, BUKAN di opBNB. */
  ensName(addr: Address): Promise<string | null>;
  txCount(addr: Address): Promise<number>;
};
