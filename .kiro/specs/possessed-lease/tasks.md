# Tasks: Possessed lease, struck from the record

A task is checked only when the code and a test that exercises it both exist. Playwright tests count once they are written and pass with `npm run test:e2e`. Run Session A before Session B. No task adds an npm dependency, calls Bedrock or calls any network service.

## Session A: verifier and sample

- [x] 1. Record a golden of the four existing samples before any source file changes: extracted facts, `unread`, `rejected` and the answer headline and step list for every topic and every tenant answer (Req 9.4-9.6)
  - [x] 1.1 Unit test `tests/unit/golden-samples.test.ts` that compares live results to the recorded golden and fails on any difference
- [x] 2. Add `RejectionCode`, `RejectedFact.code` and `.section`, `ReaderDirectedSpan`, `VerificationResult.readerDirected` and `UnreadClause.readerDirected` to `src/lease/types.ts`, and fix every place TypeScript reports (Req 9.7, 9.10)
- [x] 3. Reader-directed detector `src/lease/readerDirected.ts` with the salutation, obligation, command, heading and continuation rules, NFKC normalization and the word lists in design.md (Req 1.1-1.8, 1.11, 1.12, 9.1, 9.2)
  - [x] 3.1 Unit tests `tests/unit/readerDirected.test.ts`: positive wordings for each rule, letter case, zero-width and full-width forms, span offsets slice back to the sentence text, rule name recorded (Req 1.1-1.8, 1.12)
  - [x] 3.2 Unit tests: negative wordings ("automated system emails each receipt", "ignore previous written warnings", meter reader, fire-alarm system) are not marked (Req 1.11)
  - [x] 3.3 Unit test: no spans on the four samples, the two holdout leases, `tests/unit/wordings.ts` and `tests/e2e/fixtures` (Req 1.9, 1.10)
  - [x] 3.4 Unit test: detection on a 200 KB lease finishes within a generous bound and gives the same result twice (Req 9.1, 9.2)
- [x] 4. `cueMatches(predicate, text)` in `src/lease/coverage.ts`, shared by the coverage check and the cross-check, with `strip` and `ignore` applied (Req 3.7)
  - [x] 4.1 Unit tests: strip and ignore honoured, predicate without a cue entry never matches (Req 3.7)
- [x] 5. Verifier: reader-directed check and cue cross-check after the existing checks, `code` and `section` on every rejection, spans in the result (Req 2.1-2.5, 3.1-3.5, 9.7)
  - [x] 5.1 Unit tests in `verify.test.ts`: code and section for all seven causes; the five existing reasons unchanged; a quote that overlaps flagged text is rejected, including a substring of the flagged sentence; an ordinary sentence in the same clause is kept (Req 2.1, 2.2, 2.4, 9.7)
  - [x] 5.2 Unit tests `cueCrossCheck.test.ts`: mismatch rejected with the subject in the reason; multi-sentence quote; earlier reason kept when a fact fails two checks (Req 3.1-3.4)
  - [x] 5.3 Unit test: the local reader, a stubbed remote reader and the red-team reader get the same rejection for the same candidate (Req 2.5, 3.5)
  - [x] 5.4 Unit test: every fact the local extractor produces on the samples, holdouts and `wordings.ts` passes the cross-check, so the fact lists equal the golden (Req 3.6, 9.4)
  - [x] 5.5 Unit test: no kept fact overlaps a reader-directed span, on Case No. 005 and on generated leases that place each audience, frame and payload in each clause position (Req 2.3)
- [x] 6. Coverage: second pass that records reader-directed unread entries, even when another sentence of the clause has a kept fact and even when no fact was proposed (Req 4.1-4.3, 9.10)
  - [x] 6.1 Unit tests in `coverage.test.ts`: entry with `readerDirected` set; entry with no proposed fact; entry beside a kept fact; first-pass behavior and the sample leases' unread lists unchanged (Req 4.1-4.3, 9.6)
- [x] 7. `ask()`: carry `readerDirected` into `UnreadSection` so the section list can say the section is addressed to automated readers; headline text unchanged (Req 4.4, 4.5)
  - [x] 7.1 Unit tests in `unknown.test.ts`: a lease with a note on pets answers "Can't tell" naming the section; an ordinary "Pets are prohibited." beside a note keeps a proved No and cites only the ordinary clause; no Yes or No whose only support is a reader-directed quote (Req 4.4-4.7)
- [x] 8. Case No. 005: `src/lease/fixtures/marrowgate-lofts.txt`, a fifth entry in `SAMPLE_LEASES` with invented data only (Req 5.1-5.4)
  - [x] 8.1 Unit tests: the exact fact list the local reader produces, reader-directed spans only in clause 8, no mention of pets outside clause 8, invented-data scan (555-01xx, example.com) (Req 5.2-5.4)
  - [x] 8.2 Audit tests that loop over `SAMPLE_LEASES` (`helpers.ts`, `offline.test.ts`, `extract.test.ts`, the rule-base sweep) and keep them correct with five leases; Case No. 005 joins the no-conflict sweep (Req 9.5, 9.8)
  - [x] 8.3 Unit test: on Case No. 005, "Can I get a dog?" is `unknown`, the headline begins "Can't tell." and names section 8, and the other topics prove as they would without clause 8 (Req 5.11, 5.12, 9.8)
- [x] 9. Red-team fixture `src/lease/redTeam.ts` and reader `src/adapters/redTeam.ts`, labelled in code and name as a red-team fixture and not model output (Req 5.5-5.9)
  - [x] 9.1 Unit tests `redTeam.test.ts`: every fixture quote is a verbatim substring of Case No. 005; the three candidates get `reader_directed`, `reader_directed` and `cue_mismatch`; the label text; duplicates with the local reader's candidates removed; the struck count is greater than zero (Req 5.6-5.8, 5.10)
  - [x] 9.2 Unit test: loading Case No. 005 calls neither `fetch` nor the remote or Bedrock readers, under both backend settings (Req 5.9, 9.3)
- [x] 10. Bedrock system prompt: lease text is data and reader-directed sentences are not instructions and must not yield facts (Req 2.6)
  - [x] 10.1 Unit test in `adapters.test.ts` that the prompt says so; the Bedrock call itself stays unrun (Req 2.6, 9.3)
- [x] 11. Confirm that `tests/unit/spec-tasks.test.ts` already reads `.kiro/specs/possessed-lease/` (it lists every folder with a `tasks.md`), and add a case to it only if this folder is skipped; also check that every criterion number in `requirements.md` is cited by at least one task, and that `package.json` and the lockfile are unchanged (Req 9.3, 9.9)

## Session B: seam, tour and docs

- [x] 12. `Seam.tsx`: the struck list, one line per rejected fact, with the badge text, plain-words predicate, quote, reason and a section button that scrolls to the clause and moves focus; `data-testid` hooks; the `VerdictPanel` wording for reader-directed sections (Req 4.5, 6.1-6.8)
  - [x] 12.1 Unit or component-level test that the number of struck lines equals `rejected.length`, and that no lines render when nothing was rejected (Req 6.4, 6.8)
  - [x] 12.2 Unit test: a rejection with an unknown clause id renders no section button (Req 6.6)
- [x] 13. `useLeaseLawyer.ts`, `App.tsx` and `CaseFiles.tsx`: pass the red-team id from the sample to the loader, use the red-team reader for Case No. 005, expose `readerName`, show the "red-team fixture" tag on the tile and the label "recorded, not model output" in the seam (Req 5.5, 5.8, 5.9)
- [x] 14. `styles.css`: `--struck` tokens, red crossed-out styling, strike animation, reduced-motion override, phone wrapping (Req 6.3, 6.9, 7.5, 7.6, 7.8)
- [x] 15. Playwright `tests/e2e/struck.spec.ts` on the production build: Case No. 005 shows struck lines with the badge text, reasons and sections; the count matches the Verifier note and is not zero; "Can I get a dog?" gives "Can't tell" naming section 8 (Req 5.10, 5.11, 6.1-6.5)
  - [x] 15.1 Keyboard: Tab to a section button, Enter moves focus to the clause, the focus ring is visible (Req 6.7, 7.3, 7.4)
  - [x] 15.2 Screen reader semantics: the labelled list and the badge text are in the accessibility tree, and the strike is not the only cue (Req 7.1, 7.2)
  - [x] 15.3 `AxeBuilder` reports zero violations on Case No. 005 with struck lines shown, on the desktop and phone projects (Req 7.5, 7.7)
    - `struck.spec.ts` runs `AxeBuilder` with `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`; `playwright.config.ts` now also sends `struck.spec.ts` to the phone project. The contrast-ratio test stays as a second guard for Req 7.5.
  - [x] 15.4 `reducedMotion: 'reduce'`: struck lines show their final state and `animation-name` is none (Req 7.6)
  - [x] 15.5 Phone width 412 px: no horizontal scroll with struck lines shown (Req 7.8)
  - [x] 15.6 A route handler aborts any request outside the local server and the test asserts none was made on loading Case No. 005 (Req 5.9, 9.3)
- [x] 16. Tour: sixth frame that loads Case No. 005, asks "Can I get a dog?" and shows the live struck count in the caption with the struck lines in view; `TOTAL` becomes 6 (Req 8.1-8.4)
  - [x] 16.1 Update `tests/e2e/tour.spec.ts` to six frames and assert the caption count equals the struck lines on screen; the skip and click-away tests still pass (Req 8.2, 8.3, 8.6)
  - [x] 16.2 Test that the tour does not auto-start under reduced motion (Req 8.5)
- [x] 17. Update `mobile.spec.ts` and `lease-lawyer.spec.ts` for the sixth case tile and re-run the full unit and end-to-end suites (Req 9.3, 9.5)
- [ ] 18. README: a short "Possessed lease" section with the screenshot of the struck list, the red-team fixture label, the list of what detection can and cannot catch (homoglyphs, unlisted wording) and the updated case count; "How it works" text in the Workbench; `KIRO-LOG.md` entry (Req 5.6, 5.8)
