# Nearly

**Connections you can only make in person.**

Nearly is a social graph with one rule: a connection cannot be made remotely. No follows, no friend
requests. The only way into someone's network is to stand next to them and both confirm. Trust is not
rated by anyone — it is computed from the shape of the graph of real meetings, and the connections
themselves live on BNB Smart Chain.

| | |
|---|---|
| **Android app** | [Download APK](https://unduh.nearly.43-134-58-217.sslip.io/nearly.apk) (arm64, ~65 MB) |
| **Web** | [nearly-two.vercel.app](https://nearly-two.vercel.app) — landing page and the [live network graph](https://nearly-two.vercel.app/live) |
| **API** | `https://api.nearly.43-134-58-217.sslip.io` |
| **Chain** | BNB Smart Chain testnet (chainId 97) |
| **Tests** | 2,010 passing — 1,940 TypeScript (Vitest) + 70 Solidity (Foundry) |

iPhone: not yet distributed (TestFlight is planned). Developers can run the app on iOS through Expo Go.

---

## How it works

1. **Meet.** You are in the same room as someone. That is the only starting point Nearly accepts.
2. **Scan.** One phone shows a signed QR code that rotates every 30 seconds; the other phone scans it.
3. **Verified, then recorded.** The server checks that both phones were in the same place at the same
   time (a coarse location cell, not precise GPS). Only then is the connection written on-chain by a
   relayer, so users never need gas. One connection per pair of people, forever.

### Trust comes from the graph

Nobody rates anybody. Trust is computed with personalized PageRank seeded from a small set of trusted
accounts, such as event organizers.

- **Diversity counts.** Meeting people across many events and over time weighs more than meeting many
  people in one room in one hour.
- **Fake accounts struggle.** A cluster of accounts that only connect to each other has no path to the
  trusted seed, so its trust stays near zero. Extra accounts dilute trust instead of multiplying it.
- **A tier with evidence, not a bare number.** People see a tier — New, Known, Trusted, Core —
  alongside concrete facts: connections, events, regions, and vouches.

### Features

- **Wallet on the phone.** Each phone creates its own wallet on first launch, backed up with a
  12-word recovery phrase. Keys never leave the device; actions are signed (EIP-712) and relayed.
- **Handshake** with a rotating signed QR code and a co-location check.
- **Events:** create an event, RSVP, and check in at the door by scanning the host's QR code.
  Check-ins made inside the venue during the event become on-chain proof of attendance.
- **Radar** at an event: a list of the people here right now — not a map, with no distance or
  direction. For people you have not met yet it shows only the number of mutual connections, never
  their names. One Visible / Hidden switch per account.
- **Want to meet:** mark someone you have not met yet. The count is public on their profile; two
  people who mark each other are revealed to each other, and an event shows how many of your mutual
  matches are coming.
- **Vouches and tags** between people who have met — revocable, and slashable.
- **Feed:** anyone with a wallet can post (images are stored on BNB Greenfield). The feed never
  becomes a shortcut: there is no way to connect with or message someone from it.
- **End-to-end encrypted messages**, only between people who have actually met, with push
  notifications that never contain the message content.
- **Block and report**, private by design.
- **Live graph** on the web: the whole network, or a single event, updating as people shake hands.

### Privacy by design

- No map of people. Nearly never shows people as pins on a map.
- Coarse location only — a location cell of about 150 m, never precise coordinates.
- Messages are end-to-end encrypted. The relay stores ciphertext; it can still see who messages whom,
  and when.
- Your real identity is never public. You can stay pseudonymous.

### What Nearly does not claim

- **Nearly proves that a real human showed up. It does not prove that they are a good person.**
- **Multi-device sybils are detected, not prevented.** One person with several real phones can still
  create several accounts; co-location fingerprints and the diversity factor make that pattern
  visible and weaker.
- **Location can be spoofed and is imprecise indoors.** Short-lived QR codes and a tight time window
  raise the cost of faking a meeting; they do not make it impossible.
- **A wallet with a good reputation can be sold.** No soulbound system can fully stop that.
- **The connection graph is public.** Anyone can verify every connection on-chain. Trust scores are
  computed by our server and use some private inputs, so they cannot be fully reproduced from public
  data alone.

---

## Contracts (BNB Smart Chain testnet)

| Contract | Address | Role |
|---|---|---|
| ConnectionRegistry | [`0x7814656e4bcc5acae46099bd0238856e2a118811`](https://testnet.bscscan.com/address/0x7814656e4bcc5acae46099bd0238856e2a118811) | Every verified in-person connection. |
| AttendanceRegistry | [`0x8d1e85ff67553e5569d337690fc8102d7bd02299`](https://testnet.bscscan.com/address/0x8d1e85ff67553e5569d337690fc8102d7bd02299) | Proof of attendance from check-ins made inside the venue during the event. |
| VouchRegistry | [`0xb8472f186725b9895231d1092e887306dbd6e751`](https://testnet.bscscan.com/address/0xb8472f186725b9895231d1092e887306dbd6e751) | Vouches and tags between people who have met — revocable, and slashable. |
| TrustAttestor | [`0x82621fa6e18acc3e403af6f50da18be20005b4e7`](https://testnet.bscscan.com/address/0x82621fa6e18acc3e403af6f50da18be20005b4e7) | Published trust scores and tiers. |
| NearlyResolver | [`0xd95e4b03cf92b541fea31af804c35474b6e49352`](https://testnet.bscscan.com/address/0xd95e4b03cf92b541fea31af804c35474b6e49352) | Read interface for other dApps: trust and tier by address. |

---

## Architecture

```
apps/
  mobile/     Expo SDK 57 · React Native 0.86 · expo-router — the app (Android APK via EAS Build)
  api/        Hono on Node 24 — handshake verification, relayer, trust, events, feed, messages, radar
  web/        Vite + React 19 — landing page and live network graph (Vercel)
packages/
  shared/     EIP-712 types, QR/handshake protocol, message crypto — shared by app, API, and web
  trust/      Personalized PageRank, diversity factor, tiers
  contracts/  Solidity + Foundry — the five contracts above
supabase/     Postgres schema (migrations 0001–0008)
deploy/       systemd unit, nginx and Caddy configs, APK download script
docs/         Design specs, implementation plans, and the deploy/demo runbook
```

- **Off-chain:** Supabase Postgres holds profiles, events, the feed, encrypted messages, and the
  working copy of the graph used to compute trust. Feed images are stored on BNB Greenfield.
- **On-chain:** connections, attendance, vouches, and published trust tiers. A relayer submits every
  transaction, so users never hold gas.
- **Distribution:** EAS Build for the Android APK and EAS Update for over-the-air JavaScript updates.

---

## Running locally

Requirements: Node 24, pnpm 11 (via `corepack enable`), a Supabase project, a BSC testnet RPC, and
Foundry for the contracts.

```bash
pnpm install
cp .env.example .env                 # fill in Supabase, relayer key, and contract addresses
```

Apply the SQL files in `supabase/migrations/` to your Supabase project, in order.

```bash
pnpm --filter @nearly/api dev        # API on http://localhost:8787
pnpm --filter @nearly/web dev        # web (Vite dev server)
```

Mobile, with Expo Go on a phone on the same Wi-Fi: put your laptop's LAN address in
`apps/mobile/.env` (`EXPO_PUBLIC_API_URL=http://<lan-ip>:8787`, plus the contract addresses), then:

```bash
cd apps/mobile && npx expo start -c --go
```

Tests and type checks:

```bash
pnpm test                            # all TypeScript packages
pnpm typecheck
cd packages/contracts && forge test  # Solidity
```

Deploying the API, web, and Android app: see [`docs/demo/runbook.md`](docs/demo/runbook.md)
(written in Indonesian).

---

## Documentation

Design specs and implementation plans live in [`docs/superpowers/`](docs/superpowers/), written in
Indonesian. The main design document is
[`2026-09-03-nearly-design.md`](docs/superpowers/specs/2026-09-03-nearly-design.md).

## License

[MIT](LICENSE)
