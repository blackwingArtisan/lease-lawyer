---
inclusion: always
---
# Tech stack and engineering rules

## Stack
- TypeScript, `strict` and `noUncheckedIndexedAccess`. Node 24+.
- React 19 single-page app built with Vite. Plain CSS with design tokens (custom properties); no UI framework.
- Logic: Tau Prolog 0.3.4 (BSD-3-Clause), run in the browser. Loaded as a classic script because it assigns to undeclared names, which a strict-mode bundle forbids; loaded as CommonJS under Node for tests.
- Validation: zod at every trust boundary (API bodies, model output).
- Tests: Vitest for units, Playwright (Chromium, `--disable-audio-output`) for end-to-end tests against the production build.
- Deploy target (free): Cloudflare Pages for the static app, Pages Functions for the `/api` endpoints. Not deployed from this repo.

## Logic rules
- The rule base lives in `src/logic/rulebase.pl` as `rule(Id, Head, Body)` terms. Every rule id has plain-English text in `src/logic/rules.ts`; a unit test keeps the two in sync.
- The prover (`src/logic/prover.pl`) is a meta-interpreter that returns a proof term. Modes: `strict` (known facts only), `tenant` and `lease` (may assume missing facts and report them).
- Closed world for lease facts: `absent(F)` is provable only when no clause states F.
- The rule base must never prove both yes and no. A unit test checks every topic on every sample lease with every tenant answer.
- Facts are written into Prolog only as plain atoms and finite numbers. Anything else throws.

## Adapters
Each AI step is an interface with a free local implementation (default, used by every test) and a real one that is written and type-checked but not run in tests.

| Port | Local (default) | Real | Selected by |
|---|---|---|---|
| Lease reader | rule-based sentence extractor | Claude on Amazon Bedrock, structured output | `VITE_AI_BACKEND=local\|bedrock` |
| Question translator | weighted keyword classifier | Claude on Amazon Bedrock, structured output | `VITE_AI_BACKEND=local\|bedrock` |

The Bedrock SDK runs only in the Pages Functions, so AWS credentials never reach the browser. Whatever the reader returns goes through `verifyFacts`.

## Ports
Dev 3160, preview 3161, Playwright 3162.
