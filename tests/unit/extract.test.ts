import { describe, expect, it } from 'vitest';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import { sample } from './helpers';

const summary = (id: string) =>
  sample(id).facts.map((f) => `${f.predicate}(${f.args.join(',')})@${f.clauseId}`);

describe('rule-based extraction on the sample leases', () => {
  it('reads Wychwood Arms', () => {
    expect(summary('wychwood-arms')).toEqual([
      'term(fixed)@s3',
      'monthly_rent(1850)@s4',
      'late_fee(75)@s5',
      'late_fee_grace_days(5)@s5',
      'security_deposit(1850)@s6',
      'deposit_deduction(damage_beyond_wear)@s6',
      'pet_policy(prohibited)@s8',
      'entry_notice_hours(24)@s9',
      'sublet_policy(consent_required)@s11',
      'early_termination_option(job_relocation,60,1)@s12',
    ]);
  });

  it('reads Gaslight Row', () => {
    expect(summary('gaslight-row')).toEqual([
      'term(fixed)@s3',
      'monthly_rent(2400)@s4',
      'rent_escalation_percent(3)@s4',
      'late_fee(100)@s5',
      'late_fee_grace_days(3)@s5',
      'security_deposit(3600)@s6',
      'deposit_deduction(normal_wear_and_tear)@s6',
      'pet_policy(allowed)@s7',
      'pet_deposit(500)@s7',
      'entry_notice_hours(12)@s8',
      'repair_deduct_waiver()@s9',
      'sublet_policy(prohibited)@s10',
      'early_termination_option(any,30,2)@s11',
    ]);
  });

  it('reads Cobweb Court and finds nothing where the lease is silent', () => {
    expect(summary('cobweb-court')).toEqual([
      'term(fixed)@s3',
      'monthly_rent(1450)@s4',
      'late_fee(150)@s5',
      'late_fee_grace_days(1)@s5',
      'security_deposit(1450)@s6',
    ]);
  });

  it('produces no rejected candidates on the samples', () => {
    for (const id of ['wychwood-arms', 'gaslight-row', 'cobweb-court']) {
      expect(sample(id).rejected).toEqual([]);
    }
  });

  it('quotes every fact verbatim from the clause it cites', () => {
    for (const id of ['wychwood-arms', 'gaslight-row', 'cobweb-court']) {
      const { lease, facts } = sample(id);
      for (const f of facts) {
        const clause = lease.clauses.find((c) => c.id === f.clauseId)!;
        expect(lease.text.slice(f.start, f.end)).toBe(f.quote);
        expect(f.start).toBeGreaterThanOrEqual(clause.start);
        expect(f.end).toBeLessThanOrEqual(clause.end);
      }
    }
  });

  it('reads month-to-month tenancies, consent-based pet clauses and permitted subletting', () => {
    const lease = parseLease(
      't',
      [
        '1. TENANCY. This Agreement creates a month-to-month tenancy.',
        '2. PETS. Tenant may keep a pet only with Landlord’s prior written consent.',
        '3. SUBLETTING. Tenant may sublet the Premises after giving notice.',
        '4. ENTRY. Landlord shall give forty-eight (48) hours notice before entering.',
      ].join('\n\n'),
    );
    const found = extractFacts(lease).map((f) => `${f.predicate}(${f.args.join(',')})`);
    expect(found).toEqual(['term(month_to_month)', 'pet_policy(consent_required)', 'sublet_policy(allowed)', 'entry_notice_hours(48)']);
  });
});
