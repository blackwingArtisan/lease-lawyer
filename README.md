# Lease Lawyer

**Ask your lease a plain question and get an answer you can check: a 1970s logic engine proves it step by step, and every step cites the exact clause it rests on.**

A Kiroween 2026 entry in the Frankenstein category: Prolog, the logic language of 1972, stitched to a modern language model. The model reads the lease; Prolog decides.

## Who it is for
Renters reading a lease they did not write, and the tenant-union volunteers and housing counselors who help them. "Can my landlord keep my deposit for normal wear and tear?" deserves an answer, and it deserves a reason you can point to.

## What works today
- **Three sample leases and your own.** Pick a fictional sample (careful, greedy, thin) or upload or paste a plain-text lease with numbered sections.
- **Facts read from the lease, never invented.** A rule-based reader turns clauses into typed facts such as `late_fee(75)` and `early_termination_option(job_relocation, 60, 1)`. It reads ordinary lease wording, not only the samples: Tenant, Lessee, Resident or Occupant; Landlord, Lessor, Owner or Management; "No animals of any kind"; "upon one day's notice"; "may end this Lease before it expires"; "rent will increase three percent (3%)"; a LENGTH OF LEASE heading with dates. When a sentence is ambiguous it proposes nothing. Each fact keeps the exact sentence it came from, and a verifier drops any fact whose quote is not in the clause it cites. Kept quotes are highlighted in the lease.
- **"Can't tell" instead of a wrong "silent".** No reader reads every lease. A coverage check, run for both the local and the Bedrock reader, looks for clauses that mention a topic (pet, animal, sublet, assign, enter, access, late fee, deposit and so on) but yielded no fact. The prover then refuses to treat the lease as silent on that topic. A lease section like "6. ANIMALS. Regarding animals, see Rider B." answers a pets question with "Can't tell. Section 6 (ANIMALS) mentions pets, but the reader could not read what it says...", plus a button that jumps to the section.
- **Answers by proof.** Tau Prolog runs a proof-producing meta-interpreter over a rule base for an invented "model jurisdiction": eight topics (deposit and wear and tear, leaving early, pets and assistance animals, landlord entry, late fees, subletting, repair and deduct, rent increases) in 55 rules, including a rule that voids lease terms waiving tenant protections.
- **A proof chain you can click.** Each step is numbered, says which earlier steps it uses, and cites a lease section (with the quote), a model-code section, an arithmetic check, or your own answer. Clicking a lease step scrolls to the clause and lights up the quote.
- **Unknown means "here is what I need".** When neither Yes nor No is provable, the engine searches for the smallest sets of facts that would finish the proof, asks for them as Yes/No questions, and shows which answers lead where. Answer, and the proof completes with your answer cited.
- **Out-of-scope questions get no guess**, just the list of what the engine can prove.
- **Under the hood:** the generated Prolog facts, the query, the raw proof term and the full rule book are one tab away.
- **Haunted law library design**, keyboard accessible, reduced-motion aware, phone friendly.

## Run it
Node 24+.

```bash
npm install
npm run dev          # http://localhost:3160
```

Production build and preview:

```bash
npm run build
npm run preview      # http://localhost:3161
```

## Test it

```bash
npm run typecheck
npm test                              # Vitest unit tests
npx playwright install chromium       # first time only
npm run test:e2e                      # Playwright against the production build, port 3162
```

The unit tests cover the parser, the extractor on each sample lease and on two invented leases and a table of one-sentence wordings, the coverage check (flagged and not flagged clauses, `absent/1` failing for an unread predicate, `ask()` answering "Can't tell" for pets, subletting and entry), every verifier rejection, Prolog injection safety, the question classifier, a 33-case verdict matrix across all leases and topics, boundary cases, a sweep proving no topic ever proves both Yes and No, rule text kept in sync with the Prolog rule base, proof step order and citations, highlighting, unknown handling, and the adapters with `fetch` stubbed. The end-to-end tests pick, upload or paste a lease, ask a question, and check that the proof chain cites the right clause (or, for a pasted lease with an unreadable pets clause, that the answer is "Can't tell" and the section is focused), on desktop and at phone width. No test makes a network call.

## Architecture

```
lease text ─▶ parseLease ─▶ clauses
                 └─▶ LeaseReader (local rules | Claude on Bedrock) ─▶ candidate facts ─▶ verifyFacts ─▶ facts + quote offsets
question ───▶ QuestionTranslator (local classifier | Claude on Bedrock) ─▶ topic + tenant facts
facts + unread clauses + tenant facts ─▶ Tau Prolog: prover.pl + rulebase.pl
       strict_proof(Topic, yes|no, Proof) ─▶ proof tree ─▶ numbered, cited steps ─▶ UI
       assumption_sets(Topic, V, tenant|lease, Sets) ─▶ missing facts + follow-up questions
```

| Path | What it holds |
|---|---|
| `src/lease/` | parser, extractor, verifier, coverage check, fact vocabulary, sample leases |
| `src/logic/prover.pl` | meta-interpreter: proof terms, closed-world `absent/1` (blocked for unread predicates), abduction modes |
| `src/logic/rulebase.pl` | the model-jurisdiction rules as `rule(Id, Head, Body)` |
| `src/logic/` | Tau Prolog session, `ask()`, proof tree to steps, rule text |
| `src/question/` | keyword classifier |
| `src/adapters/` | reader and translator ports: local, remote, Bedrock |
| `functions/api/` | Cloudflare Pages Functions that call Bedrock with server-side credentials |
| `src/ui/` | React components and the theme |

## Adapters: local and real

| Port | Local (default, free, offline) | Real (written and type-checked, not run in tests) |
|---|---|---|
| Lease reader | rule-based sentence extractor | Claude on Amazon Bedrock via `@anthropic-ai/bedrock-sdk`, structured output against the closed vocabulary |
| Question translator | weighted keyword classifier | Claude on Amazon Bedrock, structured output against the topic list |

Choose with `VITE_AI_BACKEND=local|bedrock` (see `.env.example`). With `bedrock`, the browser posts to `/api/read-lease` and `/api/translate`; the Pages Functions read `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (and optional `AWS_SESSION_TOKEN`, `BEDROCK_MODEL_ID`) from Pages secrets and answer 503 when they are not set. Model output goes through the same verifier as the local reader, so a hallucinated clause quote is dropped before Prolog sees it.

The Bedrock path uses the SDK's `AnthropicBedrockMantle` client (Bedrock's Messages API endpoint) and defaults to the model ID `anthropic.claude-opus-5-5`, following Anthropic's Bedrock naming. Both are checked against the installed SDK's types and Anthropic's provider documentation; the path has not been called against a live AWS account. Before deploying, confirm the model is enabled for your account and region in the Bedrock console, or set `BEDROCK_MODEL_ID`.

## Deploy
Target: Cloudflare Pages (free tier). Build command `npm run build`, output directory `dist`; `functions/` deploys as Pages Functions. Not deployed from this repository.

## Built with Kiro
Kiro's spec-driven workflow shaped this project:
- `.kiro/steering/`: product promise, tech rules and structure, included in every Kiro session.
- `.kiro/specs/proof-chain-answers/`: requirements in EARS form, the design, and the task list, each task mapped to requirement numbers.
- `.kiro/hooks/`: hooks in the current `version: "v1"` JSON format. `test-on-save.json` runs the unit tests when source or Prolog files are saved, `rulebase-guard.json` guards the rule base and rule text (rule text, no yes/no conflicts, closed-world absence, matrix rows), `extraction-guard.json` guards the extractor and coverage check (verbatim quotes, "can't tell" for unreadable clauses, an extraction test), and `typecheck-on-stop.json` type-checks when the agent stops.

See [KIRO-LOG.md](KIRO-LOG.md) for what was written before the Kiro pass and what Kiro did.

## Not legal advice
The rule base describes an invented model jurisdiction, written to resemble common US landlord-tenant rules for teaching and triage. Real rules vary by state and city.

## Credits
- [Tau Prolog](http://tau-prolog.org/) by José Antonio Riaza Valverde, BSD-3-Clause.
- Fonts: IM Fell English (OFL), Special Elite (Apache 2.0), Spectral (OFL), IBM Plex Mono (OFL), via Fontsource.
- Sample leases, companies, people, addresses and phone numbers are fictional.

## License
MIT, © 2026 Stubborn Otter Software.
