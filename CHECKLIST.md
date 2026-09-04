# Tripwire — Working Checklist

Verified against `main` at **`15b505d`**. Re-verify before trusting any unchecked box —
this repo moves fast (46 commits landed in the time it took to write the first draft
of this file).

Pairs with the **Tripwire System Reference**, which describes what exists. This file is
only about what to do next.

Phases 0–2 are the hackathon path. Phases 3–7 turn it into a product.

---

## Phase 0 — Get it running locally

- [ ] `npm install` at the repo root
- [ ] `cd backend && npm install`
- [ ] `cd frontend && npm install`
- [ ] Copy env templates: `.env.example` → `.env` at root, `backend/`, `frontend/`
- [ ] Set `ANTHROPIC_API_KEY` in `backend/.env` — **it is not in the template** (see Phase 0.5)
- [ ] `npx hardhat test` — expect **41 passing**
- [ ] `forge test` — expect **12 passing**
- [ ] `cd backend && npm test` — expect **460 passing**
- [ ] Start a local chain: `anvil`
- [ ] `npx hardhat run scripts/localDeploy.ts --network localhost`
- [ ] Copy `frontend/.env.example` → `frontend/.env` (it ships working localhost defaults)
- [ ] Start everything at once: `npm run dev:all` — orchestrator `:3001`, audit `:3002`,
      sim `:3003`, dashboard `:5173`. It prints `all four services are up`, and fails
      loudly (killing the rest) if any one does not bind.
- [ ] Confirm in the dashboard: the risk feed populates, the attack button fires, and
      the audit card fills in after a transaction
- [ ] `cd backend && npm run demo:policy`
- [ ] `cd backend && npm run demo:reconcile`
- [ ] Run the drainer end to end and watch it get caught

**Exit criteria:** all three suites green on your machine, and you have seen the attack
blocked in the dashboard — not just in a test log.

---

## Phase 0.5 — Small fixes, all verified still present at `15b505d`

- [ ] **`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` missing from `backend/.env.example`.**
      `llmReasoning.ts` reads both. A new contributor has no way to know.
- [x] ~~Conflicting chain defaults~~ — `CHAIN_ID` now defaults to `51` (Apothem),
      matching `VITE_CHAIN`. Flagged as a Phase 1 blocker below.
- [ ] **Foundry is not in CI.** `.github/workflows/ci.yml` runs `yarn`, `yarn build`,
      `yarn coverage` only. `forge test` never runs — so the fail-closed assertion,
      your single most important safety claim, is not gated on any push. Add the step.
- [x] ~~Legacy model pinned~~ — `DEFAULT_MODEL` is now `claude-haiku-4-5-20251001`,
      the pinned snapshot per the model docs (`claude-haiku-4-5` is an alias that
      resolves to it). String confirmed against the docs; **the live call has not been
      made** — there were no Anthropic credentials on the machine it was changed from.
- [ ] **Confirm the LLM pass actually works before the demo.** `reasonAboutTx` never
      throws: a rejected model ID, a bad key, or a timeout all resolve to `undefined`
      and fall back to the rule-engine verdict, so a broken LLM step looks identical to
      a working one from the outside. Run it once with a real key:
      `cd backend && ANTHROPIC_API_KEY=sk-... npm run check:llm` — it prints the model
      sent, the HTTP status, and PASS only on a structured verdict.

Already fixed, listed so nobody re-does them:

- [x] ~~`npm run orchestrator` started nothing~~ — entrypoint added (`f663283`)
- [x] ~~Audit and simulation APIs had no entrypoints, cards 404'd~~ — added (`fe29cab`, `0e3acfd`)
- [x] ~~Attack button posted the wrong body shape~~ — sends a real `setApprovalForAll` payload
- [x] ~~Audit trail reset on restart~~ — persists to `.data/audit.jsonl` by default (`c1e9f79`)
- [x] ~~Audit ledger was structurally always empty~~ — orchestrator now writes to the shared sink (`15b505d`)

Flagged by the System Reference, not independently confirmed:

- [ ] Duplicate audit ledger — `auditLedger.ts` vs `auditLedgerSink.ts`. `auditLedgerSink`
      is the wired one (both the audit API and the orchestrator use it). Confirm
      `auditLedger.ts` is dead, then delete it.
- [ ] Possible drift between `frontend/src/policyParser.ts` and the backend compiler.
      Two parsers for one policy language is a correctness risk — add a shared test
      fixture both must satisfy, or delete one.

---

## Phase 1 — Prove it live

**The blocking phase.** Everything is built; none of it is demonstrable until this is done.

> **Blocker before starting any real testnet watcher.** `CHAIN_ID` in `backend/.env`
> selects which chain `backend/src/index.ts` polls. It must match the chain the Guard
> is actually deployed on (`51` for Apothem) *and* the frontend's `VITE_CHAIN`. Get
> this wrong and the watcher polls an empty chain: no verdicts are ever written, and
> the Guard — correctly — fails closed on every transaction. It looks like a broken
> Guard; it is a misconfigured watcher. The template now defaults to `51`; change it
> and `VITE_CHAIN` together, never one alone.
>
> Note this does *not* affect `npm run dev:all`, which never starts the watcher.

- [ ] Fund an Apothem account from the faucet
- [ ] Set `PRIVATE_KEY` in root `.env`
- [ ] Confirm `CHAIN_ID` (backend) and `VITE_CHAIN` (frontend) both name the chain you
      are deploying to — see the blocker above
- [ ] `npx hardhat run scripts/deployTestnet.ts --network apothem`
- [ ] `npx hardhat run scripts/verifyDeployment.ts --network apothem` — the verification
      script already exists, use it
- [ ] Record `GUARD_ADDRESS`, `RISK_REGISTRY_ADDRESS`, `SAFE_ADDRESS` in `DEPLOY_TESTNET.md`
- [ ] Fill `frontend/.env` with all three addresses
- [ ] Enable the Guard on the Safe (`setGuard`), confirm on-chain
- [ ] Set the relayer as `freezeAuthority`; confirm the owner is a **different** address
- [ ] Benign path live: small transfer executes, verdict shows low risk
- [ ] Attack path live: drainer proposes `setApprovalForAll`, Guard blocks it
- [ ] Fail-closed live: propose a tx with the relayer stopped — must revert
- [ ] Limits live: set them on-chain, confirm a breach reverts
- [ ] Freeze live: trip it, confirm everything reverts, unfreeze as owner
- [ ] **Rehearse the whole demo twice, timed**
- [ ] Record a backup video of a clean run

**Exit criteria:** a stranger opens the dashboard, watches an attack get caught, and you
never touch a terminal to explain it.

---

## Phase 2 — Fix the story

The build is ahead of the pitch. Close the gap.

- [ ] Proposal: make **XDC Apothem primary**, not "Sepolia (default) or XDC Apothem"
- [ ] Proposal: describe **both** watcher paths — Safe Transaction Service where
      available, on-chain `execTransaction` decoding on Apothem where it is not
- [ ] Proposal: replace the appendix Guard skeleton — the real one has per-tx limits,
      a rolling 24h cap, and a one-directional freeze authority
- [ ] Proposal: **promote natural-language policy from "P2 stretch" to headline.** Shipped.
- [ ] Proposal: add the reliability layer — job queue with retry/dead-letter, circuit
      breakers, reconciliation. Currently unmentioned.
- [ ] Market review: reframe "open gaps" as **evidence** — NL policy and the auditable
      reasoning trail are built, not opportunities
- [ ] Rewrite the opening claim. Not "protect the wallet, not the protocol" — Safe Shield
      ships that today. Use: *open, self-hostable, natural-language-configured
      enforcement for the users enterprise platforms don't serve.*
- [ ] Add deployed addresses to the README

---

## Phase 2.5 — Known rough edges

- [ ] Two processes each open their own `AuditLedger` over one append-only file. Fine
      for one writer; if the watcher ever also writes audit events, `seq` numbers will
      interleave. Needs a single writer or a real store before that happens.
- [ ] The relayer is a dry-run logger — verdicts are scored and served but never written
      on-chain. Swap for `VerdictRelayer` once Phase 1 deployment lands.
- [ ] Root has a latent peer conflict: `ethers` v6 vs `@gnosis.pm/safe-contracts`
      wanting v5. `npm install` at the root fails on it; use `yarn` (as CI does).
- [ ] `concurrently` is pinned to `^9` — v10 requires Node >=22 and CI runs Node 20.

---

## Phase 3 — Make it safe to run for real

Everything above is a demo. Everything below makes it a product.

- [ ] Move the relayer key out of an env var — KMS, HSM, or a cloud signer
- [ ] Test asserting the relayer key **cannot** call any Safe execution function
- [ ] Key rotation without redeploying the Guard
- [ ] Rate-limit and back off on every external call: GoPlus, the LLM, the RPC
- [ ] RPC outage handling: retry with backoff, always fail **closed**
- [ ] Expose circuit-breaker state in metrics (the breakers exist — make them visible)
- [ ] Move the file-backed store to a real database when state outgrows one process
- [ ] Health and readiness endpoints on every HTTP service (`/health` exists — extend)
- [ ] Structured logging, correlation id per transaction hash
- [ ] Metrics: verdicts/min, score distribution, propose→verdict latency, relayer failures
- [ ] Alerting when the watcher stalls or the relayer cannot submit
- [ ] Document the trust model: exactly what the relayer can and cannot do

---

## Phase 4 — Product surface

- [ ] Onboarding: attach the Guard to an **existing** Safe, no redeploy
- [ ] Multi-Safe support — one dashboard, several wallets
- [ ] DAO / multi-signer treasury view
- [ ] Policy templates: conservative / balanced / permissive
- [ ] Policy diff and preview before activation (`policyVersion.ts` already exists — surface it)
- [ ] Policy rollback from history
- [ ] Notifications on verdict: email, Telegram, Slack, webhook
- [ ] Human override / cancel of a delayed transaction from the dashboard
- [ ] Export the audit trail — CSV and JSON
- [ ] Mobile-usable dashboard, since freezing is an emergency action

---

## Phase 5 — Trust and security

- [ ] External audit of `TripwireGuard.sol` and `RiskRegistry.sol`
- [ ] Invariant / fuzz tests: the Guard must never allow an unscored tx under any input
- [ ] Fuzz the rolling-window accounting for overflow and boundary bugs
- [ ] Reentrancy review of `checkTransaction` / `checkAfterExecution`
- [ ] Gas-griefing review — a malicious tx must not make enforcement fail open
- [ ] Publish the reasoning trail: make verdicts and explanations publicly readable.
      That is the trust argument against black-box competitors.
- [ ] Bug bounty, even a small one
- [ ] Document what happens if the backend disappears entirely (answer today: the Guard
      fails closed — say it loudly, it is a strength)

---

## Phase 6 — Scale and multi-chain

- [ ] Deploy to XDC mainnet
- [ ] Keep Sepolia as the secondary testnet
- [ ] Confirm addresses and config are cleanly per-chain
- [ ] Load-test the watcher against a busy Safe
- [ ] Backfill and replay: reconstruct verdicts for historical transactions
- [ ] Cost model: gas and LLM spend per verdict

---

## Phase 7 — Go to market

- [ ] Landing page with a live demo, not a video
- [ ] Docs site: setup, policy language reference, trust model
- [ ] Self-hosting guide — this is the differentiator, make it genuinely easy
- [ ] Pricing: free self-hosted, paid managed
- [ ] Name the competitors openly — Forta, Blockaid, Hypernative, Safe Shield — and state
      the narrower claim. Buyers and judges both respect that more than pretending the
      field is empty.

---

## Deliberately not doing

- [ ] ~~Pre-deployment smart-contract scanner~~ — not in the challenge brief, and it walks
      into the crowded static-analysis lane the market review says you are *not* competing
      in. Keep it as stated roadmap, not built scope.

---

## Definition of done

| Stage | Done when |
|---|---|
| Hackathon | Phases 0–2; live attack caught on stage |
| Pilot | Phase 3; one real user's testnet Safe running for a week |
| Product | Phases 4–5; audited, multi-Safe, self-hostable |
| Market | Phases 6–7; mainnet, documented, priced |
