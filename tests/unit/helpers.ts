import { extractFacts } from '../../src/lease/extract';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import { parseLease } from '../../src/lease/parse';
import type { FactArg, LeaseFact } from '../../src/lease/types';
import { verifyFacts } from '../../src/lease/verify';
import { ask } from '../../src/logic/ask';
import type { TenantAnswer } from '../../src/logic/program';

export function sample(id: string) {
  const s = SAMPLE_LEASES.find((l) => l.id === id);
  if (!s) throw new Error(`no sample ${id}`);
  const lease = parseLease(s.id, s.text, s.name);
  const result = verifyFacts(lease, extractFacts(lease));
  return { lease, ...result };
}

/** Builds verified-looking facts directly, for rule tests that do not need a lease. */
export function facts(...items: [string, ...FactArg[]][]): LeaseFact[] {
  return items.map(([predicate, ...args], i) => ({
    id: `f${i + 1}`,
    predicate,
    args,
    clauseId: 's1',
    quote: `${predicate} clause`,
    start: 0,
    end: 1,
  }));
}

export const told = (name: string): TenantAnswer => ({ name, value: true, source: 'answer' });
export const denied = (name: string): TenantAnswer => ({ name, value: false, source: 'answer' });

export function rootRule(answer: Awaited<ReturnType<typeof ask>>): string | undefined {
  const root = answer.tree[0];
  return root?.kind === 'rule' ? root.ruleId : undefined;
}

export { ask };
