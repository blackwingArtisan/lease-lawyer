import type { Clause, ParsedLease } from './types';

const HEADING = /^[ \t]*(\d{1,3})\.[ \t]+([A-Z][A-Z0-9 ,&'’/-]*?)\.[ \t]+/gm;

/**
 * Splits lease text into numbered clauses ("6. SECURITY DEPOSIT. ...").
 * Each clause runs from its heading to the next heading or the end of the text.
 */
export function parseLease(id: string, text: string, name?: string): ParsedLease {
  const normalized = text.replace(/\r\n?/g, '\n');
  const heads = [...normalized.matchAll(HEADING)];
  const clauses: Clause[] = heads.map((m, i) => {
    const start = m.index;
    const next = heads[i + 1];
    const end = trimEnd(normalized, next ? next.index : normalized.length);
    const number = Number(m[1]);
    return { id: `s${number}`, number, title: m[2]!.trim(), start, end };
  });
  dedupeIds(clauses);
  return { id, name: name ?? guessName(normalized, id), text: normalized, clauses };
}

function trimEnd(text: string, end: number): number {
  while (end > 0 && /\s/.test(text[end - 1]!)) end--;
  return end;
}

function dedupeIds(clauses: Clause[]): void {
  const seen = new Map<string, number>();
  for (const c of clauses) {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    if (n > 0) c.id = `${c.id}_${n + 1}`;
  }
}

function guessName(text: string, fallback: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const second = lines[1];
  if (second && !/^\d+\./.test(second)) return second;
  return lines[0] ?? fallback;
}

export function clauseText(lease: ParsedLease, clause: Clause): string {
  return lease.text.slice(clause.start, clause.end);
}

/** A sentence inside a clause, with offsets into the full lease text. */
export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Splits a clause body into sentences. A period followed by a digit
 * (as in "$1,850.00") does not end a sentence. The heading is skipped.
 */
export function sentences(lease: ParsedLease, clause: Clause): Sentence[] {
  const raw = clauseText(lease, clause);
  const headingLength = raw.match(/^[ \t]*\d{1,3}\.[ \t]+[^.]*\.[ \t]+/)?.[0].length ?? 0;
  const out: Sentence[] = [];
  const re = /[^\s][^]*?(?:[.!?](?!\d)(?=\s|$)|$)/g;
  const body = raw.slice(headingLength);
  for (const m of body.matchAll(re)) {
    const textPart = m[0].trim();
    if (!textPart) continue;
    const start = clause.start + headingLength + m.index;
    out.push({ text: textPart, start, end: start + textPart.length });
  }
  return out;
}
