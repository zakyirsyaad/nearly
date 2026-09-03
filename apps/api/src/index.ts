import { serve } from "@hono/node-server";
import type { Address, Hex } from "viem";
import { createApp } from "./app.js";
import { createStore, createSupabase } from "./db.js";
import { createRelayer } from "./relayer.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} wajib diisi`);
  return v;
}

const registry = required("CONNECTION_REGISTRY_ADDRESS") as Address;

const app = createApp({
  store: createStore(createSupabase(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"))),
  chain: createRelayer({
    rpcUrl: required("OPBNB_TESTNET_RPC"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry,
  }),
  verifyingContract: registry,
  nowMs: () => Date.now(),
});

serve({ fetch: app.fetch, port: 8787 });
console.log("API Nearly berjalan di http://localhost:8787");
