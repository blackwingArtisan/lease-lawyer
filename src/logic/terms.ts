/** A Prolog term converted to plain data, so the rest of the app never touches engine objects. */
export type PTerm =
  | { type: 'num'; value: number }
  | { type: 'atom'; name: string }
  | { type: 'var'; name: string }
  | { type: 'compound'; name: string; args: PTerm[] };

export const atom = (name: string): PTerm => ({ type: 'atom', name });
export const num = (value: number): PTerm => ({ type: 'num', value });
export const compound = (name: string, ...args: PTerm[]): PTerm => ({ type: 'compound', name, args });

export type Compound = Extract<PTerm, { type: 'compound' }>;

/** Returns the term as a compound when it matches the name and arity, else null. */
export function compoundOf(t: PTerm, name?: string, arity?: number): Compound | null {
  return t.type === 'compound' && (name === undefined || t.name === name) && (arity === undefined || t.args.length === arity) ? t : null;
}

export function isCompound(t: PTerm, name?: string, arity?: number): t is Extract<PTerm, { type: 'compound' }> {
  return t.type === 'compound' && (name === undefined || t.name === name) && (arity === undefined || t.args.length === arity);
}

export function isAtom(t: PTerm, name?: string): t is Extract<PTerm, { type: 'atom' }> {
  return t.type === 'atom' && (name === undefined || t.name === name);
}

/** Converts a Prolog list term to an array. Returns null when it is not a proper list. */
export function listItems(t: PTerm): PTerm[] | null {
  const out: PTerm[] = [];
  let cur = t;
  while (isCompound(cur, '.', 2)) {
    out.push(cur.args[0]!);
    cur = cur.args[1]!;
  }
  return isAtom(cur, '[]') ? out : null;
}

const SIMPLE_ATOM = /^[a-z][a-zA-Z0-9_]*$/;
const OPERATORS = new Set(['=<', '>=', '<', '>', 'is', '=', '*', '+', '-', '/']);

function quoteAtom(name: string): string {
  if (SIMPLE_ATOM.test(name) || name === '[]') return name;
  return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
}

/** Writes a term in standard Prolog syntax. */
export function termToText(t: PTerm): string {
  switch (t.type) {
    case 'num':
      return formatNumber(t.value);
    case 'atom':
      return quoteAtom(t.name);
    case 'var':
      return t.name.startsWith('_') ? '_' : t.name;
    case 'compound': {
      const items = listItems(t);
      if (items) return `[${items.map(termToText).join(', ')}]`;
      if (t.args.length === 2 && OPERATORS.has(t.name)) {
        return `${termToText(t.args[0]!)} ${t.name} ${termToText(t.args[1]!)}`;
      }
      if (t.name === ',' && t.args.length === 2) return `${termToText(t.args[0]!)}, ${termToText(t.args[1]!)}`;
      return `${quoteAtom(t.name)}(${t.args.map(termToText).join(', ')})`;
    }
  }
}
