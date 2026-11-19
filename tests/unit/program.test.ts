import { describe, expect, it } from 'vitest';
import { factTerm, factsProgram } from '../../src/logic/program';
import { facts } from './helpers';

describe('factsProgram', () => {
  it('writes lease and tenant facts as Prolog clauses', () => {
    const program = factsProgram(facts(['late_fee', 75], ['repair_deduct_waiver']), [
      { name: 'military_orders', value: false, source: 'answer' },
    ]);
    expect(program).toBe(
      ['lease_fact(late_fee(75), f1).', 'lease_fact(repair_deduct_waiver, f2).', 'tenant_fact(military_orders, no, answer).'].join('\n'),
    );
  });

  it('writes unread clauses as unread/2 facts, after the lease facts', () => {
    const program = factsProgram(facts(['late_fee', 75]), [], [{ predicate: 'pet_policy', clauseId: 's6', number: 6, title: 'ANIMALS' }]);
    expect(program).toBe(['lease_fact(late_fee(75), f1).', 'unread(pet_policy, s6).'].join('\n'));
  });

  it('refuses anything that is not a plain atom or a finite number, so no Prolog can be injected', () => {
    expect(() => factTerm('late_fee', ['x), assert(evil)'])).toThrow(/safe Prolog atom/);
    expect(() => factTerm('Late', [1])).toThrow(/safe Prolog atom/);
    expect(() => factTerm('late_fee', [Number.NaN])).toThrow(/finite/);
  });
});
