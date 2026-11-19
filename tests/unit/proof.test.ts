import { describe, expect, it } from 'vitest';
import { describeCalc, proofSteps, toProofTree } from '../../src/logic/proof';
import { atom, compound, num, termToText } from '../../src/logic/terms';
import { clauseSegments, citedFactIds } from '../../src/ui/segments';
import { ask, sample } from './helpers';

describe('proof steps for rendering', () => {
  it('orders evidence before the rules that use it and ends at the verdict', async () => {
    const { facts } = sample('gaslight-row');
    const a = await ask({ topic: 'wear_and_tear', facts, tenant: [] });
    expect(a.steps.map((s) => [s.n, s.kind, s.cite, s.uses])).toEqual([
      [1, 'lease', 'Lease §6', []],
      [2, 'lease', 'Lease §6', []],
      [3, 'law', 'MJ §3.4', []],
      [4, 'inference', 'MJ §3.4', [3]],
      [5, 'inference', 'MJ §1.6', [4]],
      [6, 'verdict', 'MJ §3.4, §1.6', [1, 2, 5]],
    ]);
    for (const s of a.steps) for (const u of s.uses) expect(u).toBeLessThan(s.n);
  });

  it('links every lease step to its clause and exact quote', async () => {
    const { facts, lease } = sample('wychwood-arms');
    const a = await ask({ topic: 'late_fee', facts, tenant: [] });
    const leaseSteps = a.steps.filter((s) => s.kind === 'lease');
    expect(leaseSteps.map((s) => s.title)).toEqual(['Late fee of $75', 'Monthly rent is $1,850', 'The late fee starts after a grace period of 5 days']);
    for (const s of leaseSteps) {
      const f = facts.find((x) => x.id === s.factId)!;
      expect(s.clauseId).toBe(f.clauseId);
      expect(s.quote).toBe(lease.text.slice(f.start, f.end));
    }
    expect(a.steps.filter((s) => s.kind === 'calc').map((s) => s.title)).toEqual(['92.5 = 1850 × 0.05', '75 ≤ 92.5', '5 ≥ 5']);
  });

  it('shows tenant answers and silent-lease steps', async () => {
    const a = await ask({
      topic: 'early_termination',
      facts: sample('cobweb-court').facts,
      tenant: [{ name: 'military_orders', value: false, source: 'answer' }],
    });
    expect(a.steps.map((s) => s.title)).toEqual([
      'The lease says nothing about an early termination option',
      'You are not on military orders',
      'Duty to re-rent',
      'No early exit',
    ]);
    expect(a.steps[1]!.detail).toBe('From your answer.');
  });

  it('keeps the raw proof term for the under-the-hood view', async () => {
    const a = await ask({ topic: 'sublet', facts: sample('gaslight-row').facts, tenant: [] });
    expect(a.proofTerm).toBe('rule(sublet_prohibited, verdict(sublet, no), lease(sublet_policy(prohibited), f12))');
  });

  it('rejects proof terms the prover never builds', () => {
    expect(() => toProofTree(compound('mystery', atom('x')))).toThrow(/unexpected proof term/);
    expect(proofSteps(toProofTree(atom('true')), [])).toEqual([]);
  });
});

describe('term formatting', () => {
  it('writes Prolog syntax and readable arithmetic', () => {
    expect(termToText(compound('late_fee', num(75)))).toBe('late_fee(75)');
    expect(termToText(atom('Hello world'))).toBe("'Hello world'");
    expect(termToText(compound('.', atom('a'), compound('.', atom('b'), atom('[]'))))).toBe('[a, b]');
    expect(describeCalc(compound('=<', num(75), num(92.5)))).toBe('75 ≤ 92.5');
  });
});

describe('lease highlighting', () => {
  it('splits a clause into plain and quoted runs and marks cited ones', () => {
    const { lease, facts } = sample('wychwood-arms');
    const clause = lease.clauses.find((c) => c.id === 's6')!;
    const deposit = facts.find((f) => f.predicate === 'security_deposit')!;
    const segs = clauseSegments(lease, clause, facts, new Set([deposit.id]));
    expect(segs.map((s) => s.text).join('')).toBe(lease.text.slice(clause.start, clause.end));
    const cited = segs.filter((s) => s.cited);
    expect(cited).toHaveLength(1);
    expect(cited[0]!.text).toBe(deposit.quote);
    expect(segs.filter((s) => s.factIds.length > 0)).toHaveLength(2);
  });

  it('merges two facts that share one sentence into a single run', () => {
    const { lease, facts } = sample('wychwood-arms');
    const clause = lease.clauses.find((c) => c.id === 's5')!;
    const marked = clauseSegments(lease, clause, facts, new Set()).filter((s) => s.factIds.length > 0);
    expect(marked).toHaveLength(1);
    expect(marked[0]!.factIds).toHaveLength(2);
  });

  it('collects cited fact ids from steps', () => {
    expect([...citedFactIds([{ factId: 'f1' }, {}, { factId: 'f3' }])]).toEqual(['f1', 'f3']);
  });
});
