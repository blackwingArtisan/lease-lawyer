/** One numbered clause of a lease, with its character span in the full lease text. */
export interface Clause {
  /** Stable id used in Prolog facts and in links, e.g. `s6` for section 6. */
  id: string;
  /** Section number as printed in the lease. */
  number: number;
  /** Heading as printed, e.g. "SECURITY DEPOSIT". */
  title: string;
  /** Offset of the first character of the clause in the lease text. */
  start: number;
  /** Offset one past the last character of the clause. */
  end: number;
}

export interface ParsedLease {
  id: string;
  name: string;
  text: string;
  clauses: Clause[];
}

/** A Prolog argument: a lowercase atom or a finite number. */
export type FactArg = string | number;

/**
 * A fact proposed by a lease reader (rule-based or AI). It is untrusted until
 * {@link verifyFacts} confirms its predicate, its arguments and its quote.
 */
export interface CandidateFact {
  predicate: string;
  args: FactArg[];
  clauseId: string;
  /** Exact words from the clause that support the fact. */
  quote: string;
}

/** A fact that passed verification and can be loaded into the Prolog engine. */
export interface LeaseFact extends CandidateFact {
  /** Fact id used inside Prolog, e.g. `f3`. */
  id: string;
  /** Offset of the quote in the full lease text. */
  start: number;
  /** Offset one past the end of the quote. */
  end: number;
}

/** Why the verifier rejected a candidate fact. */
export type RejectionCode =
  | 'unknown_predicate'
  | 'bad_arguments'
  | 'unknown_clause'
  | 'quote_too_short'
  | 'quote_not_found'
  | 'reader_directed'
  | 'cue_mismatch';

export interface RejectedFact {
  candidate: CandidateFact;
  reason: string;
  code: RejectionCode;
  /** Printed section number of the cited clause, or null when the clause id is unknown. */
  section: number | null;
}

export type ReaderDirectedRule = 'salutation' | 'obligation' | 'command' | 'heading' | 'continuation';

/** One sentence addressed to a reader, assistant, model or machine instead of the tenant or landlord. */
export interface ReaderDirectedSpan {
  clauseId: string;
  number: number;
  /** Offsets in the full lease text. */
  start: number;
  end: number;
  text: string;
  rule: ReaderDirectedRule;
}

/**
 * A clause that has a predicate's cue words but yielded no verified fact for
 * that predicate. The engine will not treat the lease as silent about it.
 */
export interface UnreadClause {
  predicate: string;
  clauseId: string;
  /** Section number and heading as printed, for messages. */
  number: number;
  title: string;
  /** True when the cue words sit in text addressed to automated readers. */
  readerDirected?: boolean;
}

export interface VerificationResult {
  facts: LeaseFact[];
  rejected: RejectedFact[];
  /** Set by the coverage check after verification, for every reader. */
  unread: UnreadClause[];
  /** Sentences addressed to automated readers. Reader-independent. */
  readerDirected: ReaderDirectedSpan[];
}
