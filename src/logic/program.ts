import prover from './prover.pl?raw';
import rulebase from './rulebase.pl?raw';
import type { FactArg, LeaseFact } from '../lease/types';

export const PROVER_SOURCE = prover;
export const RULEBASE_SOURCE = rulebase;

/** A yes/no fact about the tenant and where it came from. */
export interface TenantAnswer {
  name: string;
  value: boolean;
  source: 'question' | 'answer';
}

const ATOM = /^[a-z][a-z0-9_]*$/;

function arg(a: FactArg): string {
  if (typeof a === 'number') {
    if (!Number.isFinite(a)) throw new Error(`not a finite number: ${a}`);
    return String(a);
  }
  if (!ATOM.test(a)) throw new Error(`not a safe Prolog atom: ${a}`);
  return a;
}

export function factTerm(predicate: string, args: FactArg[]): string {
  if (!ATOM.test(predicate)) throw new Error(`not a safe Prolog atom: ${predicate}`);
  return args.length === 0 ? predicate : `${predicate}(${args.map(arg).join(', ')})`;
}

/** The Prolog clauses for one lease and one tenant. Only verified facts reach this point. */
export function factsProgram(facts: LeaseFact[], tenant: TenantAnswer[]): string {
  const lines = facts.map((f) => `lease_fact(${factTerm(f.predicate, f.args)}, ${arg(f.id)}).`);
  for (const t of tenant) {
    lines.push(`tenant_fact(${arg(t.name)}, ${t.value ? 'yes' : 'no'}, ${t.source}).`);
  }
  return lines.join('\n');
}
