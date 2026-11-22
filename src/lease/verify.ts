import { cueMatches, cueMatchesHeading, cueSubject, findUnread } from './coverage';
import { sentences } from './parse';
import { detectReaderDirected, overlappingSpans } from './readerDirected';
import { checkArgs, predicateSpec } from './vocabulary';
import type { CandidateFact, LeaseFact, ParsedLease, ReaderDirectedSpan, RejectedFact, RejectionCode, VerificationResult } from './types';

/**
 * The guard between any lease reader and the logic engine. A candidate fact
 * is kept only when its predicate is in the vocabulary, its arguments have the
 * right types, its clause exists, and its quote appears word for word inside
 * that clause. An AI reader therefore cannot add a fact the lease does not say.
 *
 * Two more checks follow, in this order: the quote must not sit in text
 * addressed to automated readers, and the sentence it quotes must have the
 * cue words of the fact's predicate. A fact failing an earlier check keeps
 * that earlier reason.
 *
 * It then runs the coverage check, which flags clauses that look like they
 * state a fact the reader did not return, and clauses with reader-directed
 * text about a topic. That works the same for every reader.
 */
export function verifyFacts(lease: ParsedLease, candidates: CandidateFact[]): VerificationResult {
  const readerDirected = detectReaderDirected(lease);
  const facts: LeaseFact[] = [];
  const rejected: RejectedFact[] = [];
  const seen = new Set<string>();
  const duplicates: CandidateFact[] = [];
  for (const candidate of candidates) {
    const result = check(lease, candidate, readerDirected);
    if ('code' in result) {
      rejected.push({ candidate, reason: result.reason, code: result.code, section: sectionOf(lease, candidate.clauseId) });
      continue;
    }
    const reason = result;
    const key = `${candidate.predicate}(${candidate.args.join(',')})`;
    if (seen.has(key)) {
      duplicates.push(candidate);
      continue;
    }
    seen.add(key);
    facts.push({ ...candidate, id: `f${facts.length + 1}`, start: reason.start, end: reason.end });
  }
  // A fact repeated in a second clause was still read there.
  const unread = findUnread(lease, [...facts, ...duplicates], readerDirected);
  return { facts, rejected, unread, readerDirected };
}

function sectionOf(lease: ParsedLease, clauseId: string): number | null {
  return lease.clauses.find((cl) => cl.id === clauseId)?.number ?? null;
}

interface Failure {
  code: RejectionCode;
  reason: string;
}

function check(lease: ParsedLease, c: CandidateFact, readerDirected: readonly ReaderDirectedSpan[]): Failure | { start: number; end: number } {
  const spec = predicateSpec(c.predicate);
  if (!spec) return { code: 'unknown_predicate', reason: `unknown predicate "${c.predicate}"` };
  const argProblem = checkArgs(spec, c.args);
  if (argProblem) return { code: 'bad_arguments', reason: argProblem };
  const clause = lease.clauses.find((cl) => cl.id === c.clauseId);
  if (!clause) return { code: 'unknown_clause', reason: `no clause with id "${c.clauseId}"` };
  const quote = c.quote.trim();
  if (quote.length < 8) return { code: 'quote_too_short', reason: 'quote is too short to verify' };
  const body = lease.text.slice(clause.start, clause.end);
  const at = body.indexOf(quote);
  if (at < 0) return { code: 'quote_not_found', reason: `quote not found in section ${clause.number}` };
  const start = clause.start + at;
  const end = start + quote.length;
  if (overlappingSpans(readerDirected, start, end).length > 0) {
    return { code: 'reader_directed', reason: `quote is in text addressed to automated readers (section ${clause.number})` };
  }
  // The cue words must appear in a sentence the quote overlaps (or in the quote itself, if it sits outside any sentence).
  // The clause heading may supply the topic, as it does in the coverage check.
  const overlapped = sentences(lease, clause).filter((s) => s.start < end && start < s.end);
  const texts = overlapped.length > 0 ? overlapped.map((s) => s.text) : [quote];
  if (!texts.some((t) => cueMatches(c.predicate, t)) && !cueMatchesHeading(c.predicate, clause.title)) {
    return { code: 'cue_mismatch', reason: `the quoted sentence does not mention ${cueSubject(c.predicate)}` };
  }
  return { start, end };
}
