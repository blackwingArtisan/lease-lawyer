# Changelog

Notable changes to Lease Lawyer. The Kiro sessions and what they changed are recorded separately in [KIRO-LOG.md](KIRO-LOG.md).

## Unreleased

### Added
- `npm run smoke:bedrock`: the first live check of the Bedrock reader. Without `--yes` it prints the plan and a cost estimate and sends nothing; with it, it reads the four samples and two holdout leases, verifies each proposed fact, scores the holdouts with the eval scorer, prices each call from its token usage, stops before a spending cap, and writes labelled readings and a summary to `docs/bedrock-smoke/`. The Bedrock adapter now reports the model and token usage of each reading, and accepts a named AWS profile for local tools.
- A second Kiro spec, `.kiro/specs/pdf-reader/`, headed "documented after the build": requirements, design and tasks for PDF upload, written from the shipped code and tests. Three untested criteria are open tasks.
- Continuous integration (`.github/workflows/ci.yml`): type check, unit tests, the holdout eval and the Playwright suite on every push and pull request, with a README badge.
- A unit test for every Kiro spec's `tasks.md`: each cited requirement exists, and no task is checked while one of its sub-tasks is open.
- `npm run eval`: scores the reader and prover on the two unseen leases in `tests/holdout/` against an answer key, beside the first version rebuilt from git history, and prints facts read, facts kept that the lease does not state, Yes or No answers resting on a false "silent", and "Can't tell" answers. A unit test pins today's numbers.
- Cloudflare Pages deploy settings (`wrangler.toml`) and `public/_headers` for asset caching and security headers; the README's Deploy section has the two commands.
- An MCP server for the prover (`tools/mcp-prover/`, `npm run mcp:prover`) with `list_rules`, `read_lease`, `ask_topic` and `explain_proof`, and a Kiro MCP config that registers it alongside Context7 and the AWS Documentation server.
- Kiro IDE `.kiro.hook` copies of the extraction and rule-base guards, kept in step with the agent hooks by a unit test.
- README media: a GIF of the first-visit tour and three stills (a proved No, a Can't tell, the phone layout), regenerated with `npm run media` against a running build.
- Phone flow: case files swipe sideways in their own row, the lease folds under a "Read the lease (13 facts)" button and opens itself when a proof step points into it, and a floating "Back to the answer" button returns to the verdict.
- PDF upload. The text layer is read in the browser with pdf.js (loaded only when a PDF is chosen), wrapped lines are reflowed into whole sentences so quotes stay verbatim, and scans, damaged files and very long documents are refused with a reason. A sample lease PDF can be downloaded from the "Your own" card; it reads to exactly the same facts as its text version.
- `ask()` takes an optional rule base, the hook a per-state rule pack will use.
- The suture: in the two-column layout, a sewn thread with cross-stitches runs from the quote in the lease to its Lease step in the proof chain. It starts on the clause the verdict turns on, follows the step you point at, focus or show, and redraws as the lease and the page scroll.
- A 30-second tour that runs once on a first visit: the greedy lease is asked about its deposit and proved wrong in cited steps, the clause lights up, then the trick lease is asked about pets and answers "Can't tell". Captions explain each beat. Any click or key press hands control back, "Skip tour" ends it, and a "Replay the 30-second tour" chip in the masthead runs it again. Under reduced motion it never starts by itself. `?tour=on` forces it for recordings and `?tour=off` suppresses it.
- The seam: every answer shows how it was made, sewn together in one strip. Reader (which reader, how many facts it proposed), Verifier (how many it kept word for word, how many it struck from the record, how many clauses were unreadable), Prolog (what it proved, in how many cited steps).
- A bigger rubber stamp and one flash of lightning when a Yes or No lands. Both replay on every new answer and stay still under reduced motion.
- Mild fog drifting across the bottom of the library and a candlelit vignette, static under reduced motion.
- A fourth sample, Hollowmere Flats, the "try to make it lie" lease: its pets clause points to a rider, its deposit deductions to an exhibit, it lets the landlord enter "at any time", and it states the subletting rule as a double negative. Lease Lawyer answers "Can't tell" on pets, deposit deductions and entry, and reads the double negative correctly as "written consent required".
- "Can't tell" has its own stamp: amber, dashed, with a question mark, shown when the reader could not read a clause the answer depends on. "Unproven" stays for answers that are open for other reasons.
- Unreadable clauses are outlined in amber in the lease, with a typed note naming what the reader could not read. The clause an answer is blocked on is marked more strongly and scrolled into view inside the lease.
- After an answer, the lease scrolls (inside its own pane) to the first cited quote.
- Before the first question, the result area shows an unlit proof chain: "Ask, and the circuit will charge."

### Changed
- KIRO-LOG.md opens with a table of the Kiro features the repository uses, with files, evidence and results, then the measured results and a dated timeline; the exact prompts moved to an appendix.
- The README leads with the problem and the promise: a 30-second path through the app, sourced figures on renters, the justice gap and legal-AI hallucination, the measured drop from 4 of 8 confident wrong answers to 0 on an unseen lease, why a chatbot alone is not enough, prior art (Catala, Blawx, Logical English, Docassemble) and what this adds, and where it goes next. The engine details follow below.
- The verdict lands in view: after a question is asked, the page scrolls the result to the top of the window (instantly under reduced motion) and moves focus to it. A smaller masthead and a tighter case strip keep the topic chips above the fold at 1280x720, and an end-to-end test checks the stamp is fully in view at 1280x720 and 1440x900.
- The hero line now states the promise: "Chatbots guess about your lease. Lease Lawyer proves it, or says it can't tell."

### Fixed
- Kiro hook matchers now fire on absolute paths as well as repo-relative ones.
- Pasted text over 200 KB is refused with a reason instead of being cut short, which could have dropped clauses and made the lease look silent.
- A clause that defers to another document ("Entry by Landlord is governed by Schedule A") is flagged as unreadable even when it names no time or amount.
- When the fact a proof needs sits in an unreadable clause, the answer names that clause ("Can't tell. Section 5 ...") instead of saying the lease is missing the fact.
- The selected "Your own" card kept light text on a light background (contrast about 1.35:1); it now stays dark with a green outline.
- The hidden file input no longer takes a tab stop.
- Choosing a new lease scrolls the lease pane back to the top.
- Questions about small pets ("Can I keep a goldfish?", hamsters, birds, reptiles) are routed to the pets rules instead of being refused as out of scope.
- "Can I get my deposit back?" is routed to the deposit rules.
- A deposit clause that says the deposit is non-refundable, will not be refunded, or is forfeited is no longer treated as silent about deductions; the answer is "Can't tell" with the section named.
- An entry clause that says the landlord may enter "at any time" or "without notice" is no longer treated as silent about entry.
- The unit suite allows 20 seconds per test, so a cold first run of the Prolog engine cannot time out.
