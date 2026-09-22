# Nearly contracts

Solidity 0.8.24, built and tested with [Foundry](https://book.getfoundry.sh/). Deployed on BNB Smart
Chain testnet (chainId 97); addresses are in the [root README](../../README.md#contracts-bnb-smart-chain-testnet).

| Contract | Role |
|---|---|
| `ConnectionRegistry` | Every verified in-person connection, one per pair, written by the relayer after the server checks co-location. |
| `AttendanceRegistry` | Proof of attendance from check-ins made inside the venue during the event. |
| `VouchRegistry` | Vouches and tags between people who have met — revocable, and slashable. |
| `TrustAttestor` | Trust scores and tiers published by the attestor. |
| `NearlyResolver` | Read interface for other dApps: trust and tier by address. |

Users never send transactions themselves: they sign EIP-712 messages on the phone, and the API's
relayer submits them.

```bash
forge build
forge test          # 70 tests
```

Deployment scripts are in `script/Deploy.s.sol` (`DeployPhase2` for VouchRegistry, TrustAttestor, and
NearlyResolver; `DeployPhase3a` for AttendanceRegistry). They read `ATTESTOR_ADDRESS` and
`CONNECTION_REGISTRY_ADDRESS` from the environment:

```bash
forge script script/Deploy.s.sol:DeployPhase2 --rpc-url $RPC_URL --private-key <deployer-key> --broadcast
```
