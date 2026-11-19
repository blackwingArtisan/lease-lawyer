# Design: Proof-chain answers

## Overview
A static React app. Everything runs in the browser except the optional Bedrock calls, which go through two Cloudflare Pages Functions.

```
lease text ──parseLease──▶ clauses
     │
     └─▶ LeaseReader (local rules | Bedrock) ──▶ candidate facts ──verifyFacts──▶ facts (with offsets)
                                                                                    + findUnread ──▶ unread clauses
                                                                                    │
question ──▶ QuestionTranslator (local classifier | Bedrock) ──▶ topic + tenant facts
                                                                                    ▼
                        factsProgram ──▶ Tau Prolog: prover.pl + rulebase.pl + facts + unread(Predicate, ClauseId)
                                                │
                     strict_proof(Topic, yes|no, P) ──▶ proof term ──▶ proof tree ──▶ numbered steps
                                                │
                     loose_proof(Topic, yes|no, P) ──▶ which unread clauses blocked a proof ──▶ "Can't tell"
                                                │
                     assumption_sets(Topic, V, tenant|lease, S) ──▶ missing facts + paths
```

## Components

### Lease (`src/lease`)
- `parseLease(id, text)` finds numbered headings (`12. EARLY TERMINATION.`) and records each clause's character range.
- `extractFacts(lease)` applies one rule per predicate to each sentence; every candidate carries the sentence as its quote. The rules read ordinary lease wording, not only the sample phrasings: the tenant may be called Tenant, Lessee, Resident or Occupant and the landlord Landlord, Lessor, Owner or Management; counts may be digits, words ("twenty four") or both ("sixty (60)"); a day's notice for entry becomes 24 hours. When a sentence is ambiguous (a grace period given as "by the 5th day", a fee stacked with per-day charges, an early exit that depends on something other than a job move, a negated or after-the-term month-to-month phrase) the rule proposes nothing, so the coverage check can flag the clause.
- `verifyFacts(lease, candidates)` is the single gate for both readers: closed vocabulary, typed arguments, clause exists, quote found verbatim inside the clause. It returns kept facts with offsets, rejected ones with reasons, and `unread`, the output of the coverage check.
- `findUnread(lease, covered)` (`coverage.ts`) is the coverage check. `CUES` holds, for every predicate, a cue regex (tested on the heading and on each sentence), an optional heading-only cue, an optional `strip` (service animals and pet deposits are removed before testing pet and deposit cues), an optional `ignore` (for example "Rent shall not increase"), and an optional `needs` that the clause must also match (landlord entry needs a number or a unit of time, so "reasonable notice" alone is not flagged). A predicate is unread for a clause when its cue matches and no kept fact, and no fact dropped as a duplicate, for that predicate comes from that clause. Rejected candidates do not count as read. It uses only the lease text and the verified facts, so it behaves the same for every reader.

### Logic (`src/logic`)
- `prover.pl` defines `prove(Goal, Proof, Mode, AssumedIn, AssumedOut)`. Body forms: `true`, `and/2`, `lease(F)`, `absent(F)`, `told(T)`, `denied(T)`, `not_told(T)`, `calc(Expr)`, and any head with `rule/3` clauses. In `tenant` mode a missing tenant fact can be assumed; in `lease` mode a missing lease fact or a calculation over it can be assumed. Assumptions are collected without duplicates.
- `absent(F)` holds only when no lease fact matches F and `blocked(F, Mode)` fails. `blocked/2` succeeds when `unread(Name, _)` exists for F's predicate name, in every mode except `loose`. `loose` is strict proving with that one check removed; `loose_proof/3` exists only so `ask()` can learn which unread clauses a proof would have relied on.
- `rulebase.pl` holds 55 `rule(Id, Head, Body)` terms across eight topics: wear and tear, early termination, pets and assistance animals, landlord entry, late fees, subletting, repair and deduct, rent increases. Statutory rules (`mj_*`) carry the model-code numbers; `mj_1_6` voids any lease term that waives a statutory right.
- `engine.ts` wraps a Tau session (`load`, `once`) and converts terms to plain data. `tau-loader.ts` loads Tau as a classic script in the browser and as CommonJS in Node.
- `ask()` runs strict yes and no, detects conflicts, builds the answer and steps. If neither is proven and `unread` is not empty it runs `loose_proof` for yes and no and collects the `absent` nodes whose predicate is unread. Because strict proving failed, any loose proof must rest on one of them. If there is one, `ask()` returns verdict `unknown`, the headline from `cantTellHeadline` ("Can't tell. Section 6 (ANIMALS) mentions pets, but the reader could not read what it says, so the engine will not treat the lease as silent. Read that section yourself."), the blocking sections in `Answer.unread`, and the tenant-mode abduction paths so a tenant answer can still settle it. Otherwise it runs abduction in tenant mode then lease mode, keeping minimal assumption sets (duplicates and supersets removed, at most six per verdict).
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
- `useLeaseLawyer` holds the lease, verification, question, answer and tenant answers, and discards stale results with a run counter. It passes `verification.unread` to `ask()`.
- `LeasePane` renders clauses as parchment with `<mark>` runs from `clauseSegments`; cited runs glow.
- `ProofChain` renders steps as electrodes on a charging wire, staggered by CSS variables; a lease step's button focuses its quote.
- `VerdictPanel` stamps Yes, No or Unproven and asks follow-up questions as Yes/No button pairs. When `answer.unread` is not empty it lists each section as a button ("Section 6 (ANIMALS)") that scrolls to the clause and focuses it (`LeasePane` accepts a clause focus as well as a fact focus; clauses are focusable with `tabIndex={-1}`).
- `Workbench` tabs: Facts in Prolog (including `unread/2` lines), The query, Rule book, How it works.

## Error handling
- Reader or translator failure: an alert in the result area; the current lease stays loaded.
- A clause the reader could not read is never an error and never silence: it becomes `unread/2`, and a proof that needed the lease to be silent about it becomes "Can't tell".
- A proof term the prover never builds: `toProofTree` throws, shown as an error rather than a wrong chain.
- Tau step limit (500,000) guards runaway proofs.

## Testing strategy
- Unit: parser, extractor on each sample lease (exact fact lists) and on two invented leases and a table of one-sentence wordings (Lessee/Lessor, Resident/Owner/Management, "No animals of any kind", "upon one day's notice", and so on), coverage check (flagged, not flagged, de-duplicated, rejected, sample leases clean), `absent/1` failing for an unread predicate in every mode, `ask()` answering "Can't tell" for pets, subletting and entry on a lease with unreadable clauses, verifier rejections, `factsProgram` injection safety, classifier on every example, a verdict matrix of 33 cases across all leases and topics, synthetic edge cases (5% cap boundary, default grace), a no-conflict sweep, rule text in sync with `rulebase.pl`, proof step order and citations, highlight segments, unknown handling, adapter selection and remote adapters with stubbed `fetch`, API functions without credentials.
- End-to-end (Playwright, production build): pick a lease and get a cited proof; void clause cites lease and law; unknown asks and then proves; out-of-scope refusal; upload a lease; Prolog views; phone width.
