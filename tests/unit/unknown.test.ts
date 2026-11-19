import { describe, expect, it } from 'vitest';
import { ask, denied, facts, sample, told } from './helpers';

describe('unknown answers', () => {
  it('names the one tenant fact that would settle an early exit from a lease with no exit clause', async () => {
    const a = await ask({ topic: 'early_termination', facts: sample('cobweb-court').facts, tenant: [told('job_transfer')] });
    expect(a.verdict).toBe('unknown');
    expect(a.steps).toEqual([]);
    expect(a.missing).toEqual([{ kind: 'tenant', name: 'military_orders', question: expect.stringContaining('military orders') }]);
    expect(a.paths).toEqual([
      { verdict: 'yes', conditions: ['You have active-duty military orders'] },
      { verdict: 'no', conditions: ['You are not on military orders'] },
    ]);
  });

  it('lists every way to finish the proof, smallest first', async () => {
    const a = await ask({ topic: 'early_termination', facts: sample('wychwood-arms').facts, tenant: [] });
    expect(a.missing.map((m) => (m.kind === 'tenant' ? m.name : m.predicate)).sort()).toEqual(['job_transfer', 'military_orders']);
    const yes = a.paths.filter((p) => p.verdict === 'yes').map((p) => p.conditions);
    expect(yes).toEqual(expect.arrayContaining([['Your employer is transferring you'], ['You have active-duty military orders']]));
    const no = a.paths.find((p) => p.verdict === 'no')!;
    expect(no.conditions).toHaveLength(2);
  });

  it('closes the proof once the tenant answers', async () => {
    const a = await ask({
      topic: 'early_termination',
      facts: sample('cobweb-court').facts,
      tenant: [told('job_transfer'), denied('military_orders')],
    });
    expect(a.verdict).toBe('no');
    expect(a.missing).toEqual([]);
  });

  it('falls back to naming a missing lease fact when no tenant answer can help', async () => {
    const a = await ask({ topic: 'late_fee', facts: facts(['late_fee', 80]), tenant: [] });
    expect(a.verdict).toBe('unknown');
    expect(a.missing).toContainEqual({ kind: 'lease', predicate: 'monthly_rent', topic: 'the monthly rent' });
    expect(a.missing.every((m) => m.kind === 'lease')).toBe(true);
    expect(a.headline).toMatch(/lease is missing a fact/);
  });

  it('names the lease term when a rent question cannot be settled without it', async () => {
    const a = await ask({ topic: 'rent_increase', facts: facts(['monthly_rent', 900]), tenant: [] });
    expect(a.verdict).toBe('unknown');
    expect(a.missing).toContainEqual({ kind: 'lease', predicate: 'term', topic: 'the length of the lease term' });
  });

  it('rejects an unknown topic', async () => {
    await expect(ask({ topic: 'ghosts', facts: [], tenant: [] })).rejects.toThrow(/unknown topic/);
  });
});
