# Requirements: Proof-chain answers

## Introduction
A renter chooses or uploads a lease and asks a plain question. Lease Lawyer reads the lease into facts, routes the question to a topic, and asks a Prolog rule base to prove Yes or No. The answer comes with a numbered proof chain in which every step cites the lease clause, the model-code section, or the renter's own answer it rests on. When nothing can be proven, the app says which fact is missing and asks for it.

## Glossary
- **Renter**: the person asking the question.
- **Lease**: plain text with numbered sections (`7. PETS. ...`). Each section is a **clause**.
- **Fact**: a typed statement from the closed vocabulary, such as `late_fee(75)`, with the clause id and the exact quote that supports it.
- **Tenant fact**: something about the renter, such as `job_transfer`, stated in the question or answered later.
- **Model jurisdiction**: the invented rule set in `rulebase.pl`, written to resemble common US landlord-tenant rules.
- **Proof chain**: the proof tree flattened into numbered steps, evidence before the rules that use it, ending at the verdict.

## Requirement 1: Choose or bring a lease
**User story:** As a renter, I want to load my lease, so that answers are about my lease and not a generic one.

1.1 WHEN the app opens THE SYSTEM SHALL load the first sample lease and show its clauses.
1.2 WHEN the renter picks a sample lease THE SYSTEM SHALL parse it into clauses and show how many facts were extracted.
1.3 WHEN the renter uploads a `.txt` file or pastes text THE SYSTEM SHALL treat it exactly like a sample lease.
1.4 IF an uploaded file is not plain text or is larger than 200 KB THEN THE SYSTEM SHALL refuse it with a reason and keep the current lease.

## Requirement 2: Read the lease into facts
**User story:** As a renter, I want the app to read the lease for me, so that I do not have to know which clause matters.

2.1 THE SYSTEM SHALL extract facts only in the closed vocabulary of predicates and argument kinds.
2.2 WHEN the local reader is selected THE SYSTEM SHALL extract facts with deterministic sentence rules and no network call.
2.3 WHEN the Bedrock reader is selected THE SYSTEM SHALL send the clauses to Claude on Amazon Bedrock through the app's API with structured output.
2.4 THE SYSTEM SHALL keep a fact only if its predicate and arguments are valid, its clause exists, and its quote appears verbatim in that clause.
2.5 IF a fact fails verification THEN THE SYSTEM SHALL drop it and record the reason.
2.6 THE SYSTEM SHALL highlight every kept fact's quote in the lease text.

## Requirement 3: Understand the question
**User story:** As a renter, I want to ask in my own words, so that I do not need legal vocabulary.

3.1 WHEN the renter asks a question THE SYSTEM SHALL route it to one topic of the rule base or to none.
3.2 WHEN the question states or denies a tenant fact THE SYSTEM SHALL record it as coming from the question.
3.3 IF no topic fits THEN THE SYSTEM SHALL say the question is outside the rule base, give no verdict, and list the topics it can prove.

## Requirement 4: Prove the answer
**User story:** As a renter, I want a Yes or No only when it can be proven, so that I can trust it.

4.1 THE SYSTEM SHALL prove verdicts with a Prolog engine running a meta-interpreter over the rule base and the facts.
4.2 THE SYSTEM SHALL treat lease facts as closed-world: a lease is silent on a fact only when no clause states it.
4.3 WHEN exactly one of Yes or No is provable THE SYSTEM SHALL show that verdict with a one-line answer in plain English.
4.4 IF both Yes and No are provable THEN THE SYSTEM SHALL show neither and report a rule-base conflict.
4.5 THE SYSTEM SHALL show the Prolog facts, the query and the rule base on request.

## Requirement 5: Show the proof chain
**User story:** As a renter, I want to see why, step by step, so that I can check the answer against my lease.

5.1 WHEN a verdict is proven THE SYSTEM SHALL show the proof as numbered steps in which each step lists the earlier steps it uses.
5.2 THE SYSTEM SHALL cite each lease step by section and quote the clause text exactly.
5.3 THE SYSTEM SHALL cite each law step by model-code section and show its plain-English text.
5.4 WHEN the renter activates a lease step THE SYSTEM SHALL scroll to the clause, move focus to the quote and mark it.
5.5 THE SYSTEM SHALL mark the quotes cited by the current proof differently from other extracted facts.

## Requirement 6: Say what is missing
**User story:** As a renter, I want to know what the answer depends on, so that I can supply it.

6.1 IF neither verdict is provable THEN THE SYSTEM SHALL search for the smallest sets of tenant facts that would complete a proof.
6.2 WHEN such sets exist THE SYSTEM SHALL ask for each missing tenant fact as a Yes/No question and show which answers lead to which verdict.
6.3 WHEN the renter answers THE SYSTEM SHALL prove again with the answer cited as "from your answer".
6.4 IF no tenant fact can help THEN THE SYSTEM SHALL name the lease fact that is missing.

## Requirement 7: Safe and accessible
**User story:** As any visitor, I want the app to be honest and usable, so that I am not misled or locked out.

7.1 THE SYSTEM SHALL state on every page that it is not legal advice and that the rules are an invented model jurisdiction.
7.2 THE SYSTEM SHALL be fully usable by keyboard, with visible focus.
7.3 WHILE the visitor prefers reduced motion THE SYSTEM SHALL not animate the proof chain or the verdict stamp.
7.4 THE SYSTEM SHALL fit a 412-pixel-wide phone screen without horizontal scrolling.
7.5 THE SYSTEM SHALL keep AWS credentials on the server and run every test without a network call.
