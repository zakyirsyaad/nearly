export const CONNECTION_REGISTRY_ABI = [
  {
    type: "function",
    name: "connect",
    stateMutability: "nonpayable",
    inputs: [
      { name: "initiator", type: "address" },
      { name: "counterparty", type: "address" },
      { name: "nonce", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sigOffer", type: "bytes" },
      { name: "sigAccept", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isConnected",
    stateMutability: "view",
    inputs: [{ name: "x", type: "address" }, { name: "y", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;
