# Tasks: Proof-chain answers

A task is checked only when the code and a test that exercises it both exist. Playwright tests count once they are written; they are run by the operator.

- [x] 1. Lease parser with clause offsets and sentence splitting that respects dollar amounts (Req 1.2, 2.6)
  - [x] 1.1 Unit tests: headings, preamble name, CRLF, duplicate numbers, decimal points
- [x] 2. Closed fact vocabulary with argument kinds and plain-English descriptions (Req 2.1)
- [x] 3. Rule-based extractor for all thirteen predicates (Req 2.2)
  - [x] 3.1 Three fictional sample leases: careful, greedy, thin
  - [x] 3.2 Unit tests: exact fact list per sample, verbatim quotes, extra phrasings
- [x] 4. Verifier: vocabulary, types, clause, verbatim quote, dedupe (Req 2.4, 2.5, 2.10-2.12)
  - [x] 4.1 Unit tests for each rejection reason
- [x] 5. Prolog meta-interpreter with proof terms, closed-world absence and abduction modes (Req 4.1, 4.2, 6.1)
- [x] 6. Model-jurisdiction rule base for eight topics with void-waiver rule (Req 4.1)
  - [x] 6.1 Plain-English rule text and answer sentences, kept in sync by test
  - [x] 6.2 Verdict matrix, boundary cases and no-conflict sweep (Req 4.4)
- [x] 7. Tau Prolog session wrapper and browser/Node loader
- [x] 8. `ask()`: strict proof, conflict, headline, abduction, minimal sets, missing facts (Req 4.3, 4.4, 4.6, 4.7, 6.1-6.4)
  - [x] 8.1 Unit tests for unknown handling
  - [x] 8.2 Unit test for the branch where both Yes and No are provable: verdict unknown, no steps, `conflict` true (Req 4.4, 4.7). The sweep only shows the branch is never reached on the samples.
- [x] 9. Proof tree to numbered steps with citations and uses (Req 5.1-5.3, 5.6-5.8, 5.11)
  - [x] 9.1 Unit tests for order, citations, tenant and absent steps
- [x] 10. Keyword classifier with tenant facts and denials (Req 3.1, 3.2, 3.4)
- [x] 11. Adapter ports, local default, remote client, Bedrock server adapter and Pages Functions (Req 2.3, 7.5, 7.10)
  - [x] 11.1 Unit tests with stubbed fetch; functions refuse without credentials. The Bedrock call itself is type-checked and never run in tests, by design.
- [x] 12. UI: case files, upload and paste, parchment lease with highlights (Req 1.1-1.10, 2.6, 5.5)
  - [x] 12.1 End-to-end: first sample on open, pick, upload and paste a lease (Req 1.1-1.3, 1.5, 1.6)
  - [x] 12.2 Test that a non-text file and a file over 200 KB are refused with a reason and the current lease stays loaded (Req 1.4, 1.7, 1.8). The code exists in `CaseFiles`; nothing tests it.
  - [x] 12.3 Refuse pasted text over 200 KB with a reason. `CaseFiles` truncates it silently today, which drops clauses without telling the renter (Req 1.9).
  - [x] 12.4 Test the "no numbered sections" warning in `LeasePane` (Req 1.10)
- [ ] 13. UI: question form, topic chips, out-of-scope list (Req 3.3, 3.5, 3.6)
  - [x] 13.1 End-to-end: out-of-scope question is refused (Req 3.3)
  - [ ] 13.2 Assert that the out-of-scope view shows no verdict and lists every topic (Req 3.5, 3.6)
- [ ] 14. UI: verdict stamp, follow-up questions, paths (Req 4.3, 6.2, 6.3, 6.5)
  - [x] 14.1 End-to-end: yes, no and unknown stamps; answering a follow-up completes the proof (Req 4.3, 6.2, 6.3)
  - [ ] 14.2 End-to-end: "What would settle it" lists which answers lead to which verdict (Req 6.5). The `paths` data is unit-tested; the list is not.
- [x] 15. UI: electrode proof chain, focus the cited clause (Req 5.1-5.4)
- [ ] 16. UI: workbench with Prolog facts, query and rule book (Req 4.5, 4.8, 4.9)
  - [x] 16.1 End-to-end: Prolog facts and rule book tabs (Req 4.5, 4.9)
  - [ ] 16.2 End-to-end: the query tab shows the query and the proof term (Req 4.8)
- [ ] 17. Theme, disclaimer, keyboard, reduced motion, phone layout (Req 7.1-7.4, 7.6-7.8)
  - [x] 17.1 End-to-end at phone width: no horizontal scroll (Req 7.4)
  - [ ] 17.2 End-to-end: the not-legal-advice and model-jurisdiction footer is on the page (Req 7.1, 7.6)
  - [ ] 17.3 End-to-end: ask a question and follow it up with the keyboard only; focus is visible (Req 7.2, 7.7)
  - [ ] 17.4 End-to-end with `reducedMotion: 'reduce'`: proof chain and verdict stamp do not animate (Req 7.3, 7.8)
- [x] 18. Playwright end-to-end: desktop flows and phone width (Req 1, 3, 5, 6, 7.4)

## Added after the review: "nothing made up" on unseen leases

- [x] 19. Broaden the local reader to ordinary lease wording for every predicate (Req 2.8, 2.9)
  - [x] 19.1 Party words (Lessee, Resident, Occupant; Lessor, Owner, Management), word and mixed counts, days to hours, consent phrasing, negations, "after the term" month-to-month, other-condition early exits
  - [x] 19.2 Unit tests: two invented leases with exact fact lists, a table of one-sentence wordings, verbatim quotes, no grace period guessed from "by the 5th day"
  - [x] 19.3 The sample leases still yield exactly the fact lists in `extract.test.ts`
- [x] 20. Coverage check: cue words per predicate, unread predicates after verification, for every reader (Req 8.1-8.4, 8.16)
  - [x] 20.1 Unit tests: flags a clause with cue words and no fact; does not flag a read fact, a de-duplicated fact, "reasonable notice", service animals, "Rent shall not increase"; rejected candidates do not count; no unread entries on the samples; every predicate has a cue
- [x] 21. Prover and program: `unread/2` facts, `absent/1` fails for unread predicates in every mode, `loose` mode (Req 8.5, 8.6)
  - [x] 21.1 Unit tests: absent fails for an unread predicate in strict, tenant and lease mode, holds for other predicates and in loose mode, works for a predicate with no arguments; `factsProgram` writes `unread/2`
- [x] 22. `ask()` answers "Can't tell" and lists the unread sections (Req 8.7-8.9, 8.13-8.15)
  - [x] 22.1 Unit tests: pets, subletting and entry on a lease with unreadable clauses; the old silent-lease Yes shown without the check; a tenant answer still settles it; unrelated unread clause does not block; two sections; the 33-case matrix unchanged and sample verdicts equal with the check on
- [x] 23. UI: unread section list with a keyboard-accessible button that focuses the clause, `unread/2` lines in the facts view, updated "How it works" and Bedrock prompt (Req 8.10-8.12, 8.17, 8.18)
  - [x] 23.1 End-to-end: paste a lease with an unreadable pets clause, ask "Can I keep a cat?", expect "Can't tell", no "says nothing about pets", the `unread` line, and focus on the clause
  - [x] 23.2 Unit test: the Bedrock reader prompt tells the model not to guess
- [x] 24. Name the unread section when an answer reports a missing lease fact for a predicate that is unread (Req 8.19). Today the "lease is missing a fact" answer does not mention it.
- [x] 25. Unit test that the local reader makes no network call, by stubbing `fetch` to throw (Req 2.7, 7.9)
- [x] 26. Route small-pet and "deposit back" questions, and flag "non-refundable" deposit and "at any time" or "without notice" entry clauses as unread (Req 3.1, 8.1, 8.2)
  - [x] 26.1 Unit tests: classifier wordings; coverage cue wordings; `ask()` answers "Can't tell" for both clause kinds
- [x] 27. PDF upload: read the text layer in the browser with pdf.js, reflow wrapped lines into sentences, refuse scans, damaged files and text over 200 KB with a reason (Req 1.3, 1.4, 1.9)
  - [x] 27.1 Unit tests: line and paragraph reflow; the sample lease PDF reads to the same facts as its text. End-to-end: upload the sample PDF, ask, check the cited quote; refusals keep the current lease
- [x] 28. Flag a clause that defers to another document ("governed by Schedule A") even when it names no time or amount (Req 8.1, 8.2)
  - [x] 28.1 Unit tests: entry clause flagged, "reasonable notice" still not flagged, `ask()` answers "Can't tell"
