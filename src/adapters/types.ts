import type { CandidateFact, ParsedLease } from '../lease/types';
import type { Translation } from '../question/classify';

/**
 * Reads a parsed lease and proposes facts in the shared vocabulary. Every
 * proposal is checked by verifyFacts before the logic engine sees it, so a
 * reader can miss facts but cannot invent one.
 */
export interface LeaseReader {
  readonly name: string;
  read(lease: ParsedLease): Promise<CandidateFact[]>;
}

/** Turns a plain-English question into a topic and any tenant facts it states. */
export interface QuestionTranslator {
  readonly name: string;
  translate(question: string): Promise<Translation>;
}

export interface Adapters {
  reader: LeaseReader;
  translator: QuestionTranslator;
}
