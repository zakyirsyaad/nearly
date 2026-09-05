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

export const TRUST_ATTESTOR_ABI = [
  {
    type: "function",
    name: "setScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "who", type: "address" },
      { name: "score", type: "uint32" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "scores",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [
      { name: "score", type: "uint32" },
      { name: "tier", type: "uint8" },
      { name: "at", type: "uint64" },
    ],
  },
] as const;

export const VOUCH_REGISTRY_ABI = [
  {
    type: "function",
    name: "vouch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tagsHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "expiresAt", type: "uint64" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "slash",
    stateMutability: "nonpayable",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isVouched",
    stateMutability: "view",
    inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }],
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

export const ATTENDANCE_REGISTRY_ABI = [
  {
    type: "function",
    name: "createEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "bytes32" },
      { name: "host", type: "address" },
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "centerCell", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sigHost", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "bytes32" },
      { name: "attendee", type: "address" },
      { name: "nonce", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sigHost", type: "bytes" },
      { name: "sigAttendee", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasAttended",
    stateMutability: "view",
    inputs: [{ name: "eventId", type: "bytes32" }, { name: "who", type: "address" }],
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
