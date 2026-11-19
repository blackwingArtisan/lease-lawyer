# Design: Proof-chain answers

## Overview
A static React app. Everything runs in the browser except the optional Bedrock calls, which go through two Cloudflare Pages Functions.

```
lease text ──parseLease──▶ clauses
     │
     └─▶ LeaseReader (local rules | Bedrock) ──▶ candidate facts ──verifyFacts──▶ facts (with offsets)
                                                                                    │
question ──▶ QuestionTranslator (local classifier | Bedrock) ──▶ topic + tenant facts
                                                                                    ▼
                        factsProgram ──▶ Tau Prolog: prover.pl + rulebase.pl + facts
                                                │
                     strict_proof(Topic, yes|no, P) ──▶ proof term ──▶ proof tree ──▶ numbered steps
                                                │
                     assumption_sets(Topic, V, tenant|lease, S) ──▶ missing facts + paths
```

## Components

### Lease (`src/lease`)
- `parseLease(id, text)` finds numbered headings (`12. EARLY TERMINATION.`) and records each clause's character range.
- `extractFacts(lease)` applies one rule per predicate to each sentence; every candidate carries the sentence as its quote.
- `verifyFacts(lease, candidates)` is the single gate for both readers: closed vocabulary, typed arguments, clause exists, quote found verbatim inside the clause. It returns kept facts with offsets and rejected ones with reasons.

### Logic (`src/logic`)
- `prover.pl` defines `prove(Goal, Proof, Mode, AssumedIn, AssumedOut)`. Body forms: `true`, `and/2`, `lease(F)`, `absent(F)`, `told(T)`, `denied(T)`, `not_told(T)`, `calc(Expr)`, and any head with `rule/3` clauses. In `tenant` mode a missing tenant fact can be assumed; in `lease` mode a missing lease fact or a calculation over it can be assumed. Assumptions are collected without duplicates.
- `rulebase.pl` holds 55 `rule(Id, Head, Body)` terms across eight topics: wear and tear, early termination, pets and assistance animals, landlord entry, late fees, subletting, repair and deduct, rent increases. Statutory rules (`mj_*`) carry the model-code numbers; `mj_1_6` voids any lease term that waives a statutory right.
- `engine.ts` wraps a Tau session (`load`, `once`) and converts terms to plain data. `tau-loader.ts` loads Tau as a classic script in the browser and as CommonJS in Node.
- `ask()` runs strict yes and no, detects conflicts, builds the answer and steps, or runs abduction in tenant mode then lease mode, keeping minimal assumption sets (duplicates and supersets removed, at most six per verdict).
- `proof.ts` converts the proof term to a tree and flattens it post-order so evidence is numbered before the rules that use it.

### Adapters (`src/adapters`, `functions/api`)
```ts
interface LeaseReader { name: string; read(lease: ParsedLease): Promise<CandidateFact[]> }
interface QuestionTranslator { name: string; translate(q: string): Promise<{ topic: string | null; tenant: TenantAnswer[] }> }
```
- Local: `extractFacts`, `classifyQuestion`.
- Remote (browser): POST to `/api/read-lease` and `/api/translate`, validate with zod.
- Bedrock (server): `@anthropic-ai/bedrock-sdk` `messages.parse` with a zod output format, the closed vocabulary in the system prompt, refusal check. Returns 503 when credentials are not set.

### UI (`src/ui`)
- `useLeaseLawyer` holds the lease, verification, question, answer and tenant answers, and discards stale results with a run counter.
- `LeasePane` renders clauses as parchment with `<mark>` runs from `clauseSegments`; cited runs glow.
- `ProofChain` renders steps as electrodes on a charging wire, staggered by CSS variables; a lease step's button focuses its quote.
- `VerdictPanel` stamps Yes, No or Unproven and asks follow-up questions as Yes/No button pairs.
- `Workbench` tabs: Facts in Prolog, The query, Rule book, How it works.

## Error handling
- Reader or translator failure: an alert in the result area; the current lease stays loaded.
- A proof term the prover never builds: `toProofTree` throws, shown as an error rather than a wrong chain.
- Tau step limit (500,000) guards runaway proofs.

## Testing strategy
- Unit: parser, extractor on each sample lease (exact fact lists), verifier rejections, `factsProgram` injection safety, classifier on every example, a verdict matrix of 33 cases across all leases and topics, synthetic edge cases (5% cap boundary, default grace), a no-conflict sweep, rule text in sync with `rulebase.pl`, proof step order and citations, highlight segments, unknown handling, adapter selection and remote adapters with stubbed `fetch`, API functions without credentials.
- End-to-end (Playwright, production build): pick a lease and get a cited proof; void clause cites lease and law; unknown asks and then proves; out-of-scope refusal; upload a lease; Prolog views; phone width.
