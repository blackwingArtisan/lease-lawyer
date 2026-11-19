# Requirements: Proof-chain answers

## Introduction
A renter chooses or uploads a lease and asks a plain question. Lease Lawyer reads the lease into facts, routes the question to a topic, and asks a Prolog rule base to prove Yes or No. The answer comes with a numbered proof chain in which every step cites the lease clause, the model-code section, or the renter's own answer it rests on. When nothing can be proven, the app says which fact is missing and asks for it. When the reader may have missed what a clause says, the app says it cannot tell and never treats the lease as silent.

## Glossary
- **Renter**: the person asking the question.
- **Lease**: plain text with numbered sections (`7. PETS. ...`). Each section is a **clause**.
- **Fact**: a typed statement from the closed vocabulary, such as `late_fee(75)`, with the clause id and the exact quote that supports it.
- **Tenant fact**: something about the renter, such as `job_transfer`, stated in the question or answered later.
- **Model jurisdiction**: the invented rule set in `rulebase.pl`, written to resemble common US landlord-tenant rules.
- **Proof chain**: the proof tree flattened into numbered steps, evidence before the rules that use it, ending at the verdict.
- **Cue words**: words that suggest a clause states a given predicate, such as "pet", "animal", "dog" and "cat" for `pet_policy`.
- **Unread**: a predicate is unread for a clause when the clause has the predicate's cue words but no verified fact for that predicate comes from it.
- **Coverage check**: the reader-independent check that finds unread predicates after verification.

Criteria are written in EARS form: `WHEN <event>`, `WHILE <state>`, `IF <condition> THEN`, or `WHERE <feature>`, followed by `THE SYSTEM SHALL <one behavior>`. A criterion with no trigger is always true. Criteria added when a requirement was split or extended come last in that requirement, so earlier numbers stay valid.

## Requirement 1: Choose or bring a lease
**User story:** As a renter, I want to load my lease, so that answers are about my lease and not a generic one.

1.1 WHEN the app opens THE SYSTEM SHALL show the first sample lease with its clauses.
1.2 WHEN the renter picks a sample lease THE SYSTEM SHALL parse it into clauses.
1.3 WHEN the renter uploads a `.txt` file THE SYSTEM SHALL treat it exactly like a sample lease.
1.4 IF an uploaded file is not plain text THEN THE SYSTEM SHALL refuse it and show the reason.
1.5 WHEN the renter submits pasted text THE SYSTEM SHALL treat it exactly like a sample lease.
1.6 WHEN a lease has been read THE SYSTEM SHALL show how many facts were extracted.
1.7 IF an uploaded file is larger than 200 KB THEN THE SYSTEM SHALL refuse it and show the reason.
1.8 IF an uploaded file is refused THEN THE SYSTEM SHALL keep the current lease loaded.
1.9 IF pasted text is larger than 200 KB THEN THE SYSTEM SHALL refuse it and show the reason.
1.10 IF the lease text has no numbered sections THEN THE SYSTEM SHALL tell the renter that nothing can be cited.

## Requirement 2: Read the lease into facts
**User story:** As a renter, I want the app to read the lease for me, so that I do not have to know which clause matters.

2.1 THE SYSTEM SHALL extract facts only in the closed vocabulary of predicates and argument kinds.
2.2 WHERE the local reader is selected THE SYSTEM SHALL read the lease with deterministic sentence rules.
2.3 WHERE the Bedrock reader is selected THE SYSTEM SHALL send the clauses to Claude on Amazon Bedrock through the app's API with structured output.
2.4 THE SYSTEM SHALL keep a fact only if its quote appears verbatim in the clause it cites.
2.5 IF a fact fails verification THEN THE SYSTEM SHALL drop it.
2.6 WHEN a fact is kept THE SYSTEM SHALL highlight its quote in the lease text.
2.7 WHERE the local reader is selected THE SYSTEM SHALL make no network call to read the lease.
2.8 WHEN a sentence states a vocabulary fact in ordinary lease wording that the sample leases do not use THE SYSTEM SHALL read that fact with the local reader. Ordinary wording includes Lessee, Resident or Occupant for the tenant; Lessor, Owner or Management for the landlord; "No animals of any kind"; "may enter ... upon one day's notice"; "may end this Lease before it expires"; "may raise the rent by up to 4%"; a LENGTH OF LEASE or LEASE PERIOD heading with start and end dates.
2.9 IF a sentence's wording leaves a vocabulary fact uncertain THEN THE SYSTEM SHALL propose no fact from that sentence. Uncertain wording includes a grace period given as "by the 5th day of the month", a flat fee stacked with per-day charges, and an early exit that depends on a condition other than a job move.
2.10 IF a fact's predicate is not in the vocabulary or its arguments have the wrong kind THEN THE SYSTEM SHALL drop the fact.
2.11 IF a fact cites a clause that does not exist THEN THE SYSTEM SHALL drop the fact.
2.12 WHEN a fact is dropped THE SYSTEM SHALL record the reason.

## Requirement 3: Understand the question
**User story:** As a renter, I want to ask in my own words, so that I do not need legal vocabulary.

3.1 WHEN the renter asks a question THE SYSTEM SHALL route it to one topic of the rule base or to none.
3.2 WHEN the question states a tenant fact THE SYSTEM SHALL record it as coming from the question.
3.3 IF no topic fits THEN THE SYSTEM SHALL say the question is outside the rule base.
3.4 WHEN the question denies a tenant fact THE SYSTEM SHALL record the denial as coming from the question.
3.5 IF no topic fits THEN THE SYSTEM SHALL give no verdict.
3.6 IF no topic fits THEN THE SYSTEM SHALL list the topics it can prove.

## Requirement 4: Prove the answer
**User story:** As a renter, I want a Yes or No only when it can be proven, so that I can trust it.

4.1 THE SYSTEM SHALL prove verdicts with a Prolog meta-interpreter over the rule base and the verified lease facts.
4.2 THE SYSTEM SHALL prove that the lease is silent on a fact only when no clause states that fact.
4.3 WHEN exactly one of Yes or No is provable THE SYSTEM SHALL show that verdict.
4.4 IF both Yes and No are provable THEN THE SYSTEM SHALL show neither verdict.
4.5 WHEN the renter opens the Prolog views THE SYSTEM SHALL show the Prolog facts of the lease.
4.6 WHEN a verdict is shown THE SYSTEM SHALL give a one-line answer in plain English.
4.7 IF both Yes and No are provable THEN THE SYSTEM SHALL report a rule-base conflict.
4.8 WHEN the renter opens the Prolog views THE SYSTEM SHALL show the query that was run.
4.9 WHEN the renter opens the Prolog views THE SYSTEM SHALL show the rule base.

## Requirement 5: Show the proof chain
**User story:** As a renter, I want to see why, step by step, so that I can check the answer against my lease.

5.1 WHEN a verdict is proven THE SYSTEM SHALL show the proof as numbered steps.
5.2 WHEN a proof step rests on a lease fact THE SYSTEM SHALL cite the lease section.
5.3 WHEN a proof step rests on a model-code rule THE SYSTEM SHALL cite the model-code section.
5.4 WHEN the renter activates a lease step THE SYSTEM SHALL move focus to that step's quote in the lease.
5.5 WHILE a proof is shown THE SYSTEM SHALL mark the quotes it cites differently from other extracted facts.
5.6 WHEN a proof step uses earlier steps THE SYSTEM SHALL list those steps.
5.7 WHEN a proof step rests on a lease fact THE SYSTEM SHALL quote the clause text exactly.
5.8 WHEN a proof step rests on a model-code rule THE SYSTEM SHALL show its plain-English text.
5.9 WHEN the renter activates a lease step THE SYSTEM SHALL scroll to the clause.
5.10 WHEN the renter activates a lease step THE SYSTEM SHALL mark the quote.
5.11 WHEN a proof step rests on something the renter said THE SYSTEM SHALL say whether it came from the question or from the renter's answer.

## Requirement 6: Say what is missing
**User story:** As a renter, I want to know what the answer depends on, so that I can supply it.

6.1 IF neither verdict is provable THEN THE SYSTEM SHALL search for the smallest sets of tenant facts that would complete a proof.
6.2 WHEN such sets exist THE SYSTEM SHALL ask for each missing tenant fact as a Yes/No question.
6.3 WHEN the renter answers a follow-up question THE SYSTEM SHALL prove again with the answer cited as "from your answer".
6.4 IF no tenant fact can help THEN THE SYSTEM SHALL name the lease fact that is missing.
6.5 WHEN such sets exist THE SYSTEM SHALL show which answers lead to which verdict.

## Requirement 7: Safe and accessible
**User story:** As any visitor, I want the app to be honest and usable, so that I am not misled or locked out.

7.1 THE SYSTEM SHALL state on every page that it is not legal advice.
7.2 THE SYSTEM SHALL let the visitor operate every control by keyboard.
7.3 WHILE the visitor prefers reduced motion THE SYSTEM SHALL not animate the proof chain.
7.4 WHILE the screen is 412 pixels wide THE SYSTEM SHALL fit the page without horizontal scrolling.
7.5 THE SYSTEM SHALL keep AWS credentials on the server.
7.6 THE SYSTEM SHALL state on every page that the rules are an invented model jurisdiction.
7.7 THE SYSTEM SHALL show a visible focus indicator on the focused control.
7.8 WHILE the visitor prefers reduced motion THE SYSTEM SHALL not animate the verdict stamp.
7.9 THE SYSTEM SHALL run every automated test without a network call.
7.10 IF Bedrock credentials are not set THEN THE SYSTEM SHALL answer API requests with status 503.

## Requirement 8: Say "can't tell" when the reader is unsure
**User story:** As a renter, I want the app to admit when it could not read a clause, so that a missed fact is never taken for "the lease says nothing".

8.1 WHEN a clause contains a predicate's cue words AND no verified fact for that predicate comes from that clause THE SYSTEM SHALL record the predicate as unread for that clause.
8.2 WHEN verification of a reader's facts completes THE SYSTEM SHALL run the coverage check, whichever reader produced the facts.
8.3 WHEN verification drops a fact because an identical fact was already kept THE SYSTEM SHALL count the dropped fact's clause as read for that predicate.
8.4 IF a clause names no number or time where a predicate needs one (for example "reasonable notice" for landlord entry) THEN THE SYSTEM SHALL NOT record that predicate as unread for the clause.
8.5 THE SYSTEM SHALL pass every unread predicate and its clause id to the Prolog program as `unread(Predicate, ClauseId)`.
8.6 IF a predicate is unread for any clause THEN THE SYSTEM SHALL NOT prove `absent` for that predicate in strict, tenant or lease mode.
8.7 IF neither Yes nor No is provable AND a proof would hold if the unread clauses were ignored THEN THE SYSTEM SHALL return the verdict unknown.
8.8 WHEN the verdict is unknown because of unread clauses THE SYSTEM SHALL give a headline that begins "Can't tell." and names each blocking section by number and heading.
8.9 WHEN the verdict is unknown because of unread clauses THE SYSTEM SHALL list each blocking section in the answer with the subject it mentions.
8.10 WHEN the verdict is unknown because of unread clauses THE SYSTEM SHALL show the sections with the unknown styling.
8.11 WHEN the renter activates a listed unread section THE SYSTEM SHALL scroll to that clause and move focus to it.
8.12 THE SYSTEM SHALL let the renter activate a listed unread section by keyboard.
8.13 IF an unread predicate is not one the proof relies on to be absent THEN THE SYSTEM SHALL answer as it would without the unread entry.
8.14 WHEN a tenant fact lets a proof go through without relying on absence THE SYSTEM SHALL prove the verdict despite the unread clause.
8.15 WHEN the verdict is unknown because of unread clauses THE SYSTEM SHALL NOT show a proof step that says the lease is silent on a blocked predicate.
8.16 THE SYSTEM SHALL record no unread predicate for any clause of the three sample leases.
8.17 WHEN the lease has unread predicates THE SYSTEM SHALL show them as `unread/2` lines in the Prolog facts view.
8.18 WHERE the Bedrock reader is selected THE SYSTEM SHALL tell the model that clauses it cannot express as facts are flagged for the renter and must not be guessed.
8.19 WHEN an answer names a missing lease fact AND that predicate is unread for a clause THE SYSTEM SHALL name the unread section.
