---
inclusion: always
---
# Structure

```
src/
  lease/        parse a lease into clauses, extract facts, verify quotes, check coverage (unread clauses), the fact vocabulary, sample leases
  logic/        prover.pl and rulebase.pl, the Tau Prolog session, ask() and proof-tree to proof-step conversion
  question/     the keyword classifier for the local translator
  adapters/     reader and translator ports: local, remote (browser to API), bedrock (server only), zod schemas
  ui/           React components and the app state hook; styles.css holds every design token
functions/api/  Cloudflare Pages Functions: read-lease, translate
tests/unit/     Vitest, one file per module
tests/e2e/      Playwright, desktop and phone projects; fixtures/ holds an extra lease to upload
tools/mcp-prover/  stdio MCP server exposing the prover (list_rules, read_lease, ask_topic, explain_proof); npm run mcp:prover
scripts/        sample PDF generator and README media capture
public/samples/ the downloadable sample lease PDF
.kiro/          steering, specs, hooks (agent JSON plus IDE .kiro.hook copies) and settings/mcp.json
```

## Conventions
- Lease clause ids are `s<number>`; fact ids are `f<n>` in extraction order.
- A new topic needs: a `TOPICS` entry, `verdict(<topic>, yes|no)` rules, rule text with an `answer` for each verdict rule, classifier patterns, and rows in the rule-base test matrix.
- A new predicate needs: a `PREDICATES` entry (arguments, topic, describe), an extractor rule, an extraction test, and a `CUES` entry in `src/lease/coverage.ts` (cue words, a short subject for the "can't tell" message) with a coverage test. A unit test fails if a predicate has no cue entry.
- The sample leases must produce no unread entries where they are genuinely silent. If a cue change makes a sample flag, fix the cue, not the verdict matrix.
- Sample data is fictional: invented companies, people and streets, 555-01xx phone numbers, example.com email.
