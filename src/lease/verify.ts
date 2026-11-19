import { findUnread } from './coverage';
import { checkArgs, predicateSpec } from './vocabulary';
import type { CandidateFact, LeaseFact, ParsedLease, RejectedFact, VerificationResult } from './types';

/**
 * The guard between any lease reader and the logic engine. A candidate fact
 * is kept only when its predicate is in the vocabulary, its arguments have the
 * right types, its clause exists, and its quote appears word for word inside
 * that clause. An AI reader therefore cannot add a fact the lease does not say.
 *
 * It then runs the coverage check, which flags clauses that look like they
 * state a fact the reader did not return. That works the same for every reader.
 */
export function verifyFacts(lease: ParsedLease, candidates: CandidateFact[]): VerificationResult {
  const facts: LeaseFact[] = [];
  const rejected: RejectedFact[] = [];
  const seen = new Set<string>();
  const duplicates: CandidateFact[] = [];
  for (const candidate of candidates) {
    const reason = check(lease, candidate);
    if (typeof reason === 'string') {
      rejected.push({ candidate, reason });
      continue;
    }
    const key = `${candidate.predicate}(${candidate.args.join(',')})`;
    if (seen.has(key)) {
      duplicates.push(candidate);
      continue;
    }
    seen.add(key);
    facts.push({ ...candidate, id: `f${facts.length + 1}`, start: reason.start, end: reason.end });
  }
  // A fact repeated in a second clause was still read there.
  const unread = findUnread(lease, [...facts, ...duplicates]);
  return { facts, rejected, unread };
}

function check(lease: ParsedLease, c: CandidateFact): string | { start: number; end: number } {
  const spec = predicateSpec(c.predicate);
  if (!spec) return `unknown predicate "${c.predicate}"`;
  const argProblem = checkArgs(spec, c.args);
  if (argProblem) return argProblem;
  const clause = lease.clauses.find((cl) => cl.id === c.clauseId);
  if (!clause) return `no clause with id "${c.clauseId}"`;
  const quote = c.quote.trim();
  if (quote.length < 8) return 'quote is too short to verify';
  const body = lease.text.slice(clause.start, clause.end);
  const at = body.indexOf(quote);
  if (at < 0) return `quote not found in section ${clause.number}`;
  return { start: clause.start + at, end: clause.start + at + quote.length };
}
