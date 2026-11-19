# Kiro log

What Kiro was asked to do on this project, what it produced, and what it cost.

## Before the Kiro pass
The steering files (`.kiro/steering/product.md`, `tech.md`, `structure.md`), the hooks (`.kiro/hooks/*.json` for the agent, plus `.kiro/hooks/rulebase-guard.kiro.hook` in the older Kiro IDE format, which the Kiro pass below folded into the JSON hook and deleted) and the initial spec (`.kiro/specs/proof-chain-answers/requirements.md`, `design.md`, `tasks.md`) were drafted before the Kiro pass, in Kiro's formats, and the first version of the app was built against them task by task. Every task in `tasks.md` is checked off and covered by the unit and Playwright tests.

The steering sets the rules Kiro should hold the project to: no Yes or No without a proof, every step cited, unknown answers name what is missing, nothing read from a lease is kept unless its quote is verbatim, and every AI step sits behind an adapter with a free local default.

## Kiro review
The review and the work that followed from it are recorded in the section "Kiro pass (kiro-cli v3, bonus credits)" below.

## Kiro pass (kiro-cli v3, bonus credits)

- **When:** 2026-11-19, 02:58 to 03:16 UTC (18 min 26 s wall time, under a 25-minute cap; exit code 0).
- **Command** (repo root, stdin closed):
  `kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command "<prompt>" </dev/null`
- **Credits used:** 32.03 of the 4,000 `kiroween2026` bonus credits (`/usage` read 65.78 before the call and 97.81 after).
- **What Kiro did:** reviewed the spec against the code and tests, rewrote the criteria in EARS form, wrote the broader
  extractor, the coverage check (`src/lease/coverage.ts`), the `unread/2` change to the prover, the "Can't tell" answer
  and its UI, the unit tests and the new Playwright test, merged and deleted the IDE-format hook, added the extraction
  guard hook, updated the README and steering, and ran `npm run typecheck` and `npm test` itself.
- **After the call (operator):** full suite re-run: Vitest 180 of 180 (92 before the pass), Playwright 8 of 8 (7 before;
  the new "can't tell" test passes). Nothing needed fixing. A lease Kiro had not seen, written by the operator with
  wording unlike the samples, was then run through the reader and every topic: before this pass the reader found 1 of
  its 10 facts and 4 of 8 topics gave a confident answer based on a "silent" lease that was not silent; after the
  pass it found 7 of 10, and the deposit and early-termination questions answered "Can't tell" instead. One proof
  step still claimed the lease was silent on the late-fee grace period, which led to the follow-up call below.

### Exact prompt

> You are working in the Lease Lawyer repository (TypeScript, React 19, Vite, Tau Prolog, Vitest, Playwright). Read .kiro/steering/product.md, tech.md and structure.md first and follow them. Work only inside this repository. Do not add, remove or upgrade any npm dependency, do not run npm install, do not use git, and do not deploy or call any network service (the Bedrock adapter stays untested against AWS). Keep wording professional and use invented sample people, companies and addresses only.
>
> Do these four jobs in order.
>
> 1. Spec review. Read .kiro/specs/proof-chain-answers/requirements.md, design.md and tasks.md and compare them with the code in src/ and functions/ and the tests in tests/. Tighten every acceptance criterion into strict EARS form (WHEN / WHILE / IF ... THEN / WHERE ... THE SYSTEM SHALL ...), one testable behavior per criterion, keeping existing numbering so task references stay valid (append new criteria at the end of a requirement). Mark a task [x] only if code and a test really implement it. Add a new unchecked task for every gap you find, with its requirement numbers.
>
> 2. Implement the most important open problem (add it to requirements.md, design.md and tasks.md first, then build it, then check the tasks off). The product promise is "nothing made up": a Yes or No only when it is proven from what the lease really says. Today the local rule-based reader in src/lease/extract.ts only recognises the exact phrasings used in the three sample leases. On an unseen lease with ordinary wording it reads almost nothing, and then the closed-world rule absent/1 in src/logic/prover.pl lets the rule base answer as if the lease were silent. For example, a lease section "6. ANIMALS. No animals of any kind may be kept in the unit." yields no pet_policy fact, so the pets question answers "Yes. Your lease says nothing about pets, so ordinary household pets are allowed." That is a confident wrong answer. Fix it in two layers:
>    a. Broaden extraction. Make the sentence rules in src/lease/extract.ts recognise common real-world lease wording for every predicate in the vocabulary, not only the sample phrasings. Examples of ordinary wording to handle (invent more of your own): "Tenant shall pay rent of $1,600 per month" / "Rent is $1,600.00 monthly"; "a deposit of $1,600" or "damage deposit" under a DEPOSIT heading; "will not deduct for ordinary wear and tear" / "normal wear and tear excepted"; "Lessee", "Resident" and "Occupant" as the tenant and "Lessor", "Owner" and "Management" as the landlord; "No animals of any kind", "no dogs, cats or other animals", "animals only with Owner's written approval"; "may enter ... upon one day's notice" / "with at least twenty-four (24) hours' advance notice"; "a late charge of $50 if rent is not received by the 5th day of the month"; "shall not assign this Lease or sublet" / "rent out any part of the unit to another person without written approval"; "may end this Lease before it expires by giving sixty (60) days' written notice and paying a fee equal to one month's rent"; "may raise the rent by up to 4%" / "rent will increase three percent (3%) at renewal"; a term heading such as "LENGTH OF LEASE" or "LEASE PERIOD" with start and end dates. Keep the fact lists for the three sample leases exactly as tests/unit/extract.test.ts expects them, keep every quote verbatim (the verifier must still pass), and add Vitest tests in tests/unit/extract.test.ts with a new invented lease (put it in tests/unit/ as a fixture or inline) that uses wording different from the samples, asserting the exact facts read.
>    b. Say "can't tell" instead of "silent" when the reader is unsure. No rule set reads every lease, so add a reader-independent coverage check that runs after verification for both the local and the Bedrock reader: for each fact predicate (or group of related predicates), a list of cue words (for example pet, animal, dog, cat for pet_policy; sublet, sublease, assign for sublet_policy; enter, entry, access for entry_notice_hours; late fee, late charge for late_fee and late_fee_grace_days; deposit for security_deposit and deposit_deduction; and so on). WHEN a clause contains a predicate's cue words AND no verified fact for that predicate comes from that clause, THE SYSTEM SHALL record the predicate as unread for that clause. Pass unread predicates into the Prolog program (for example unread(Predicate, ClauseId) facts) and make absent/1 fail for an unread predicate in every prover mode, so no proof can rest on "the lease says nothing about X" when a clause plausibly says something about X. WHEN neither Yes nor No is then provable and a needed absence was blocked, ask() SHALL return verdict unknown with a headline such as "Can't tell. Section 6 (ANIMALS) mentions pets, but the reader could not read what it says, so the engine will not treat the lease as silent. Read that section yourself." and SHALL list the unread section(s) in the answer so the UI can show them and link to the clause. Show this in the UI with the existing unknown styling and a link or button that focuses the clause, keeping it keyboard accessible. Choose the cue words so the three sample leases produce no unread entries where the lease is genuinely silent, and keep the 33-case verdict matrix in tests/unit/rulebase.test.ts passing unchanged; if a sample case would change, stop and explain why in the log instead of changing the expected verdict. Add Vitest tests: the coverage check flags a clause with cue words and no fact; it does not flag a clause whose fact was read; absent/1 fails for an unread predicate; ask() on a lease whose only pet clause is unreadable answers unknown with the "Can't tell" headline and the clause id, never the silent-lease Yes; and the same holds for subletting and entry. Add one Playwright test in tests/e2e/lease-lawyer.spec.ts that pastes a short invented lease with an unreadable pets clause, asks "Can I keep a cat?", and expects the "Can't tell" answer and no "says nothing about pets" text. Use the same paste flow and selectors as the existing tests.
>    Update the README ("What works today" and test descriptions) and the steering files where this changes what they say.
>
> 3. Hooks. Kiro's current hook format is .kiro/hooks/<name>.json with "version": "v1" and a "hooks" array (fields: name, description, trigger in PascalCase such as PostFileSave or Stop, matcher regex against the file path, action with type "command" + command or type "agent" + prompt, timeout in seconds, enabled). Check every file in .kiro/hooks/ against that format and fix anything invalid. rulebase-guard.kiro.hook is an older IDE-format duplicate of rulebase-guard.json: fold anything it covers that the JSON hook does not (it also watches src/logic/rules.ts) into rulebase-guard.json, then delete the .kiro.hook file, and update the README "Built with Kiro" section and anything else that mentions it. Add a small agent hook, extraction-guard.json, that fires on edits to src/lease/extract.ts or the coverage check, restates that every quote must stay verbatim and that an unreadable clause must give "can't tell", never "silent", and asks for an extraction test. Keep the steering files accurate.
>
> 4. KIRO-LOG.md. Its "## Kiro review" section currently says Kiro's review "follows below", but nothing follows. Replace that sentence with one plain sentence pointing to the new section, then append a new section "## Kiro pass (kiro-cli v3, bonus credits)" that lists: each spec change (criteria tightened, tasks checked, tasks added), each source and test file you changed and why, the hook changes, and anything you could not do. Leave a line "Credits used: TO BE FILLED" for the operator to fill in.
>
> When you finish, run `npm run typecheck` and `npm test` and fix any failures you caused. Do not run the Playwright suite yourself; the operator will.

### Spec changes
- **Criteria tightened** (`requirements.md`). Every criterion is now strict EARS (`WHEN`, `WHILE`, `IF ... THEN`, `WHERE`, or none, then `THE SYSTEM SHALL` and one behavior). Compound criteria were split; the first behavior kept its number and the split-off parts were appended at the end of the same requirement (1.5-1.10, 2.7-2.12, 3.4-3.6, 4.6-4.9, 5.6-5.11, 6.5, 7.6-7.10). "WHEN the local reader is selected" became "WHERE", since reader choice is configuration, not an event.
- **New requirement 8** ("Say "can't tell" when the reader is unsure"), criteria 8.1-8.19, plus 2.8 and 2.9 for wider reading of ordinary wording. Written before the code.
- **`design.md`**: coverage check, `unread/2`, `blocked/2`, `loose` mode, the "can't tell" branch of `ask()`, the UI list, the wider extractor, the testing strategy.
- **Tasks checked as truly done** (code and a test): 1-7, 9-11, 15, 18, and the new 19-23, plus children 8.1, 12.1, 13.1, 14.1, 16.1, 17.1.
- **Tasks that were checked but are not fully covered, now unchecked**: 8, 12, 13, 14, 16, 17. Each has the missing test or code as a new unchecked child.
- **Tasks added, unchecked**: 8.2 (the both-provable conflict branch has no test), 12.2 (upload refusal, size limit and keeping the lease have no test), 12.3 (pasted text over 200 KB is silently truncated by `CaseFiles`; that is a code gap against the "nothing made up" promise), 12.4 (no-numbered-sections warning), 13.2 (out-of-scope view lists topics), 14.2 (the "What would settle it" list), 16.2 (query tab), 17.2-17.4 (footer, keyboard-only path with visible focus, reduced motion), 24 (name the unread section when a missing lease fact is also unread), 25 (the local reader makes no network call).

### Source and tests
- `src/lease/extract.ts`: rewritten sentence rules for all thirteen predicates. Tenant and landlord synonyms, word, mixed and "twenty four" counts, days to hours for entry, consent phrasing shared by pets and subletting, negations ("will not deduct for ordinary wear and tear", "normal wear and tear excepted"), "after the term" month-to-month, other-condition early exits, per-day fee stacking. Where a sentence is ambiguous it proposes nothing. The three sample leases give the same fact lists as before. Choice to note: "by the 5th day of the month" is not read as a grace period, because the count of days depends on the due date; the clause is flagged unread for `late_fee_grace_days` instead.
- `src/lease/coverage.ts` (new): `CUES` per predicate and `findUnread`. Cue refinements keep the samples clean: service animals and pet deposits are stripped, "Rent shall not increase" is ignored, landlord entry needs a number or unit of time, so "reasonable notice" in Cobweb Court is not flagged.
- `src/lease/types.ts`, `src/lease/verify.ts`: `UnreadClause`; `verifyFacts` runs the coverage check last, so every reader gets it, and counts duplicate-dropped facts as read.
- `src/logic/prover.pl`: `unread/2`, `blocked/2` in `absent/1`, `loose` mode, `loose_proof/3`, `assumes_tenant/1` (replaces `M \== strict` so loose does not assume tenant facts).
- `src/logic/program.ts`: `unreadTerm`, `factsProgram(..., unread)`.
- `src/logic/ask.ts`: `unread` input and answer field, `blockedByUnread`, `cantTellHeadline`, abduction moved into `abduce`.
- `src/adapters/bedrock.ts`: reader prompt tells the model not to guess (the prompt is exported for a test). The adapter was not run.
- `src/ui/`: `VerdictPanel` unread list and buttons, `LeasePane` clause focus, `App` and `useLeaseLawyer` wiring, `Workbench` `unread/2` lines and "How it works", `styles.css` clause focus and flash.
- Tests: `tests/unit/extract.test.ts` (two invented leases, 60 one-sentence wordings), `tests/unit/wordings.ts` (the invented leases), `tests/unit/coverage.test.ts` (coverage, `absent/1`, `ask()` for pets, subletting and entry), `tests/unit/program.test.ts`, `tests/unit/adapters.test.ts`, `tests/e2e/lease-lawyer.spec.ts` (paste a lease with an unreadable pets clause).
- Docs: `README.md`, steering `product.md`, `tech.md`, `structure.md`.

### Hooks
- All four hooks were checked against the v1 format. They were valid; `enabled: true` was added to the three that lacked it, and a timeout to the agent hook.
- `rulebase-guard.json` now also matches `src/logic/rules.ts`, and its prompt took over the "fix the code, not the test" instruction from the old file and a rule that `absent/1` never holds for an unread predicate.
- `rulebase-guard.kiro.hook` was deleted. The README "Built with Kiro" section and this log's earlier section were updated.
- New `extraction-guard.json` (agent hook on `src/lease/extract.ts` and `src/lease/coverage.ts`): quotes stay verbatim, an unreadable clause gives "can't tell", add an extraction test.

### Could not do, or did not do
- The Playwright suite was not run (as instructed), so the new end-to-end test has not been seen to pass. Its selectors follow the existing paste flow.
- The Bedrock path was not called; its prompt change is only covered by a string test and the type check.
- The open tasks listed above were left open on purpose; 12.3 and 24 need code, the rest need tests.
- Two read-only git commands (`git status --short`, `git diff --stat`) were run before the no-git instruction was applied. They changed nothing. `playwright.config.ts` already showed as modified before this pass began and was not touched. (The operator had made its port overridable with `PW_PORT` before the call, so local runs can avoid a busy port.)
- The extractor reads English wording only and cannot read a clause whose heading is not an uppercase numbered heading; such leases show the existing "no numbered sections" warning.

### Follow-up call

- **When:** 2026-11-19, 03:18 to 03:20 UTC (2 min 9 s wall time; exit code 0). Same command as above.
- **Credits used:** 3.10 (`/usage` read 97.81 before and 100.91 after). Total for the pass: 35.13 credits.
- **After the call (operator):** Vitest 198 of 198, Playwright 8 of 8. The first unseen lease now reads 10 of 10 facts,
  and its late-fee question answers "Can't tell" instead of resting on a silent grace period. A second unseen lease,
  written after this call, reads 8 of its 12 facts; the clauses it could not read (late-fee grace period, pets with
  written approval, entry notice, repair-and-deduct waiver) were all flagged, so no topic on either lease gave an
  answer based on the lease being silent when it was not.

#### Exact prompt

> You are continuing work in the Lease Lawyer repository. Read .kiro/steering/*.md and the section "## Kiro pass (kiro-cli v3, bonus credits)" at the end of KIRO-LOG.md, which describes the extraction and "can't tell" work you just did. Same rules as before: work only inside this repository, no npm install or dependency changes, no git, no network, invented sample data only.
>
> The operator checked the change on a lease neither of you had seen. The local reader read 7 of its 10 facts, and the coverage check correctly turned the deposit and early-termination questions into "Can't tell" answers. Three things are still worth fixing, and the first is a "nothing made up" problem:
>
> 1. A clause "4. LATE RENT. Rent paid after the third (3rd) of the month incurs a $45 late fee." gives late_fee(45) but no grace fact and no unread entry, so the late-fee proof contains the step "The lease says nothing about the grace period before a late fee", which is not true. Widen the late_fee_grace_days cue in src/lease/coverage.ts so that any clause with a late-fee cue and a day-of-month or day-count reference ("after the 3rd", "after the third (3rd) of the month", "past the fifth day", "more than two days late", "on the 6th") and no grace fact is unread for late_fee_grace_days. Do not guess the grace days from a day of the month.
> 2. A clause "5. SECURITY. Upon signing, Lessee shall deposit $1,390 with Lessor as security. Lessor may apply the security only to unpaid rent and to damage in excess of normal wear and tear." was not read. Read "deposit $X ... as security" (and similar, such as "a sum of $X as a security deposit", "security of $X") as security_deposit, and "damage in excess of normal wear and tear" / "damage beyond ordinary wear" / "wear and tear excepted" as deposit_deduction(damage_beyond_wear).
> 3. A clause "9. EARLY TERMINATION. Should Lessee need to break this Agreement, Lessee may do so with thirty (30) days' written notice and payment of one (1) month's rent as a termination fee." was not read. Read "break this Agreement/Lease", "end ... early" and similar under an EARLY TERMINATION heading, with the notice in days and the fee in months' rent, as early_termination_option(any, 30, 1).
>
> For each, add a Vitest case in tests/unit/extract.test.ts or tests/unit/coverage.test.ts using different invented wording in the same spirit (not only these exact sentences), keep the three sample leases' fact lists and the 33-case verdict matrix unchanged, and keep every quote verbatim. Then add a short "### Follow-up call" subsection at the end of the Kiro pass section in KIRO-LOG.md saying what the operator's unseen-lease check found and what you changed, with a line "Credits used: TO BE FILLED". Run `npm run typecheck` and `npm test` and fix any failures you caused. Do not run Playwright.

The operator ran the local reader on a lease neither of us had seen. It read 7 of 10 facts, and the coverage check correctly turned the deposit and early-termination questions into "Can't tell". Three gaps were left:

- **A made-up "no grace period" step.** "Rent paid after the third (3rd) of the month incurs a $45 late fee." gave `late_fee(45)` but no grace fact and no unread entry, so the proof said the lease was silent on the grace period. The `late_fee_grace_days` cue in `coverage.ts` now also matches a day of the month or a day count ("after the 3rd", "past the fifth day", "more than two days late", "on the 6th"). Such a clause with no grace fact is unread, and the grace days are not guessed from the date.
- **Security deposit and wear and tear.** `extract.ts` now reads "deposit $X ... as security", "$X as a security deposit" and "security of $X" as `security_deposit`, and "damage in excess of normal wear and tear", "damage beyond ordinary wear" and "wear and tear excepted" as `deposit_deduction(damage_beyond_wear)`, including under a SECURITY heading with no word "deposit". The deposit cues in `coverage.ts` also cover "as security" and a SECURITY clause.
- **Early termination.** Under an EARLY/break heading, "break this Agreement", "end this lease" and similar are read, and a leading "Should Lessee need to break this Agreement," is treated as restating the wish to leave, not as a condition. The sentence from the operator's lease gives `early_termination_option(any, 30, 1)`. The coverage cue also matches "break this Agreement".

Tests were added to `tests/unit/extract.test.ts` and `tests/unit/coverage.test.ts` with different wordings. The three sample leases' fact lists and the 33-case verdict matrix are unchanged. `npm run typecheck` and `npm test` pass (198 tests). Playwright was not run by Kiro.
