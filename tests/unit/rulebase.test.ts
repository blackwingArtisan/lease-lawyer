import { describe, expect, it } from 'vitest';
import { RULEBASE_SOURCE } from '../../src/logic/program';
import { RULES } from '../../src/logic/rules';
import { TOPICS } from '../../src/logic/topics';
import { TENANT_FACTS } from '../../src/lease/vocabulary';
import { ask, denied, facts, rootRule, sample, told } from './helpers';

type Row = [lease: string, topic: string, tenant: string[], verdict: 'yes' | 'no' | 'unknown', rule?: string];

/** Every sample lease against every topic: the verdict and the rule that decides it. */
const MATRIX: Row[] = [
  ['wychwood-arms', 'wear_and_tear', [], 'no', 'wear_lease_agrees'],
  ['gaslight-row', 'wear_and_tear', [], 'no', 'wear_clause_void'],
  ['cobweb-court', 'wear_and_tear', [], 'no', 'wear_statute'],

  ['wychwood-arms', 'early_termination', ['+job_transfer'], 'yes', 'leave_job_relocation'],
  ['wychwood-arms', 'early_termination', ['-job_transfer', '-military_orders'], 'no', 'leave_relocation_only'],
  ['wychwood-arms', 'early_termination', [], 'unknown'],
  ['gaslight-row', 'early_termination', [], 'yes', 'leave_any_reason'],
  ['cobweb-court', 'early_termination', ['+job_transfer'], 'unknown'],
  ['cobweb-court', 'early_termination', ['+job_transfer', '-military_orders'], 'no', 'leave_no_option'],
  ['cobweb-court', 'early_termination', ['+military_orders'], 'yes', 'leave_military'],

  ['wychwood-arms', 'pets', [], 'unknown'],
  ['wychwood-arms', 'pets', ['-assistance_animal'], 'no', 'pets_prohibited'],
  ['wychwood-arms', 'pets', ['+assistance_animal'], 'yes', 'pets_assistance_animal'],
  ['gaslight-row', 'pets', [], 'yes', 'pets_allowed'],
  ['cobweb-court', 'pets', [], 'yes', 'pets_lease_silent'],

  ['wychwood-arms', 'entry_without_notice', [], 'no', 'entry_lease_notice'],
  ['gaslight-row', 'entry_without_notice', [], 'no', 'entry_short_notice_void'],
  ['cobweb-court', 'entry_without_notice', [], 'no', 'entry_statute'],
  ['cobweb-court', 'entry_without_notice', ['+emergency'], 'yes', 'entry_emergency'],

  ['wychwood-arms', 'late_fee', [], 'yes', 'late_fee_ok'],
  ['gaslight-row', 'late_fee', [], 'no', 'late_fee_grace_too_short'],
  ['cobweb-court', 'late_fee', [], 'no', 'late_fee_too_high'],

  ['wychwood-arms', 'sublet', [], 'yes', 'sublet_with_consent'],
  ['gaslight-row', 'sublet', [], 'no', 'sublet_prohibited'],
  ['cobweb-court', 'sublet', [], 'yes', 'sublet_lease_silent'],

  ['wychwood-arms', 'repair_and_deduct', ['+essential_repair', '+written_notice'], 'yes', 'repair_deduct_allowed'],
  ['gaslight-row', 'repair_and_deduct', ['+essential_repair', '+written_notice'], 'yes', 'repair_deduct_waiver_void'],
  ['cobweb-court', 'repair_and_deduct', ['+essential_repair', '-written_notice'], 'no', 'repair_notice_first'],
  ['cobweb-court', 'repair_and_deduct', ['-essential_repair'], 'no', 'repair_not_essential'],
  ['cobweb-court', 'repair_and_deduct', ['+essential_repair'], 'unknown'],

  ['wychwood-arms', 'rent_increase', [], 'no', 'raise_fixed_term'],
  ['gaslight-row', 'rent_increase', [], 'yes', 'raise_by_clause'],
  ['cobweb-court', 'rent_increase', [], 'no', 'raise_fixed_term'],
];

const tenantOf = (codes: string[]) => codes.map((c) => (c.startsWith('+') ? told(c.slice(1)) : denied(c.slice(1))));

describe('model jurisdiction rule base on the sample leases', () => {
  it.each(MATRIX)('%s / %s %j -> %s', async (leaseId, topic, tenant, verdict, rule) => {
    const answer = await ask({ topic, facts: sample(leaseId).facts, tenant: tenantOf(tenant) });
    expect(answer.conflict).toBe(false);
    expect(answer.verdict).toBe(verdict);
    if (rule) expect(rootRule(answer)).toBe(rule);
    if (verdict !== 'unknown') expect(answer.headline).not.toMatch(/^(Yes|No)\.$/);
  });
});

describe('rules on synthetic facts', () => {
  it('lets a month-to-month landlord raise rent with 30 days notice', async () => {
    const a = await ask({ topic: 'rent_increase', facts: facts(['term', 'month_to_month']), tenant: [] });
    expect([a.verdict, rootRule(a)]).toEqual(['yes', 'raise_month_to_month']);
  });

  it('finds no deposit to keep when the lease has none', async () => {
    const a = await ask({ topic: 'wear_and_tear', facts: facts(['monthly_rent', 1000]), tenant: [] });
    expect([a.verdict, rootRule(a)]).toEqual(['no', 'wear_no_deposit']);
  });

  it('applies the statutory grace period when the lease gives none', async () => {
    const a = await ask({ topic: 'late_fee', facts: facts(['monthly_rent', 2000], ['late_fee', 100]), tenant: [] });
    expect([a.verdict, rootRule(a)]).toEqual(['yes', 'late_fee_ok_default_grace']);
  });

  it('treats a fee exactly at the 5% cap as lawful and one cent over as not', async () => {
    const at = await ask({ topic: 'late_fee', facts: facts(['monthly_rent', 2000], ['late_fee', 100], ['late_fee_grace_days', 5]), tenant: [] });
    const over = await ask({ topic: 'late_fee', facts: facts(['monthly_rent', 2000], ['late_fee', 100.01], ['late_fee_grace_days', 5]), tenant: [] });
    expect(at.verdict).toBe('yes');
    expect([over.verdict, rootRule(over)]).toEqual(['no', 'late_fee_too_high']);
  });

  it('says no late fee can be charged when the lease sets none', async () => {
    const a = await ask({ topic: 'late_fee', facts: facts(['monthly_rent', 1500]), tenant: [] });
    expect([a.verdict, rootRule(a)]).toEqual(['no', 'late_fee_not_in_lease']);
  });

  it('lets pets in with consent and lets a permitted sublet stand', async () => {
    const pets = await ask({ topic: 'pets', facts: facts(['pet_policy', 'consent_required']), tenant: [] });
    const sublet = await ask({ topic: 'sublet', facts: facts(['sublet_policy', 'allowed']), tenant: [] });
    expect(rootRule(pets)).toBe('pets_with_consent');
    expect(rootRule(sublet)).toBe('sublet_allowed');
  });

  it('never proves both yes and no for any topic and any tenant answers (Req 9.8)', async () => {
    const leases = ['wychwood-arms', 'gaslight-row', 'cobweb-court', 'hollowmere-flats', 'marrowgate-lofts'].map((id) => sample(id));
    const names = TENANT_FACTS.map((t) => t.name);
    for (const lease of leases) {
      for (const topic of TOPICS) {
        for (const value of [true, false]) {
          const tenant = names.map((name) => ({ name, value, source: 'answer' as const }));
          const a = await ask({ topic: topic.id, facts: lease.facts, tenant, unread: lease.unread });
          expect(a.conflict, `${lease.lease.id} ${topic.id} with all ${value}`).toBe(false);
        }
      }
    }
  });
});

describe('rule text', () => {
  const ids = [...RULEBASE_SOURCE.matchAll(/^rule\((\w+),/gm)].map((m) => m[1]!);

  it('has plain-English text for every rule in rulebase.pl, and no orphans', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !RULES[id])).toEqual([]);
    expect(Object.keys(RULES).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('gives every verdict rule an answer sentence', () => {
    const verdictRules = [...RULEBASE_SOURCE.matchAll(/^rule\((\w+), verdict\(/gm)].map((m) => m[1]!);
    expect(verdictRules.length).toBeGreaterThan(20);
    expect(verdictRules.filter((id) => !RULES[id]!.answer)).toEqual([]);
  });

  it('covers every topic with at least one yes or no rule', () => {
    for (const t of TOPICS) expect(RULEBASE_SOURCE).toContain(`verdict(${t.id},`);
  });
});
