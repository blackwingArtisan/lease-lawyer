import type { Clause, LeaseFact, ParsedLease } from '../lease/types';

/** A run of clause text, marked when it is the quote behind one or more facts. */
export interface Segment {
  text: string;
  start: number;
  factIds: string[];
  /** True when one of the facts is cited by the current proof. */
  cited: boolean;
}

/**
 * Splits a clause into plain and quoted runs so the lease view can underline
 * every extracted fact and light up the ones the current proof cites.
 */
export function clauseSegments(lease: ParsedLease, clause: Clause, facts: LeaseFact[], citedIds: ReadonlySet<string>): Segment[] {
  const inClause = facts.filter((f) => f.clauseId === clause.id && f.start >= clause.start && f.end <= clause.end);
  const cuts = new Set<number>([clause.start, clause.end]);
  for (const f of inClause) {
    cuts.add(f.start);
    cuts.add(f.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    if (end <= start) continue;
    const covering = inClause.filter((f) => f.start <= start && f.end >= end).map((f) => f.id);
    const prev = out[out.length - 1];
    const text = lease.text.slice(start, end);
    if (prev && prev.factIds.join() === covering.join()) {
      prev.text += text;
      continue;
    }
    out.push({ text, start, factIds: covering, cited: covering.some((id) => citedIds.has(id)) });
  }
  return out;
}

/** Fact ids cited anywhere in a list of proof steps. */
export function citedFactIds(steps: { factId?: string }[]): Set<string> {
  return new Set(steps.flatMap((s) => (s.factId ? [s.factId] : [])));
}
