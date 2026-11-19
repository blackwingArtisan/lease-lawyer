import { describe, expect, it } from 'vitest';
import { parseLease } from '../../src/lease/parse';
import { verifyFacts } from '../../src/lease/verify';
import type { CandidateFact } from '../../src/lease/types';

const lease = parseLease('t', '1. RENT. Monthly rent is $900.00, due monthly.\n\n2. PETS. No pets of any kind.');
const ok: CandidateFact = { predicate: 'monthly_rent', args: [900], clauseId: 's1', quote: 'Monthly rent is $900.00, due monthly.' };

describe('verifyFacts', () => {
  it('keeps a well-formed fact and records where its quote sits', () => {
    const { facts, rejected } = verifyFacts(lease, [ok]);
    expect(rejected).toEqual([]);
    expect(facts[0]).toMatchObject({ id: 'f1', predicate: 'monthly_rent' });
    expect(lease.text.slice(facts[0]!.start, facts[0]!.end)).toBe(ok.quote);
  });

  it('rejects a quote that is not in the cited clause (a hallucination)', () => {
    const { facts, rejected } = verifyFacts(lease, [{ ...ok, quote: 'Monthly rent is $450.00, due monthly.' }]);
    expect(facts).toEqual([]);
    expect(rejected[0]!.reason).toMatch(/quote not found in section 1/);
  });

  it('rejects a real quote attributed to the wrong clause', () => {
    const { rejected } = verifyFacts(lease, [{ ...ok, clauseId: 's2' }]);
    expect(rejected[0]!.reason).toMatch(/quote not found/);
  });

  it('rejects unknown predicates, wrong arity, wrong types and unknown atoms', () => {
    const { facts, rejected } = verifyFacts(lease, [
      { ...ok, predicate: 'landlord_is_nice' },
      { ...ok, args: [] },
      { ...ok, args: ['nine hundred'] },
      { ...ok, args: [-5] },
      { predicate: 'pet_policy', args: ['maybe'], clauseId: 's2', quote: 'No pets of any kind.' },
      { predicate: 'entry_notice_hours', args: [12.5], clauseId: 's1', quote: ok.quote },
    ]);
    expect(facts).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      'unknown predicate "landlord_is_nice"',
      'monthly_rent takes 1 argument, got 0',
      'argument 1 of monthly_rent must be a non-negative number',
      'argument 1 of monthly_rent must be a non-negative number',
      'argument 1 of pet_policy must be one of prohibited, allowed, consent_required',
      'argument 1 of entry_notice_hours must be a whole number',
    ]);
  });

  it('rejects a missing clause and a too-short quote', () => {
    const { rejected } = verifyFacts(lease, [
      { ...ok, clauseId: 's9' },
      { ...ok, quote: 'rent' },
    ]);
    expect(rejected.map((r) => r.reason)).toEqual(['no clause with id "s9"', 'quote is too short to verify']);
  });

  it('drops duplicate facts', () => {
    expect(verifyFacts(lease, [ok, ok]).facts).toHaveLength(1);
  });
});
