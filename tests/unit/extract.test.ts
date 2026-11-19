import { describe, expect, it } from 'vitest';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import { verifyFacts } from '../../src/lease/verify';
import { sample } from './helpers';
import { LARKSPUR_FLATS, QUILLON_HEIGHTS } from './wordings';

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

const read = (text: string) => {
  const lease = parseLease('t', text);
  const result = verifyFacts(lease, extractFacts(lease));
  return { lease, ...result, summary: result.facts.map((f) => `${f.predicate}(${f.args.join(',')})@${f.clauseId}`) };
};

describe('extraction on leases worded differently from the samples', () => {
  it('reads Larkspur Flats (Lessor and Lessee wording)', () => {
    const r = read(LARKSPUR_FLATS);
    expect(r.rejected).toEqual([]);
    expect(r.summary).toEqual([
      'term(fixed)@s1',
      'monthly_rent(1600)@s2',
      'security_deposit(1600)@s3',
      'deposit_deduction(damage_beyond_wear)@s3',
      'pet_policy(prohibited)@s4',
      'entry_notice_hours(24)@s5',
      'late_fee(50)@s6',
      'sublet_policy(prohibited)@s7',
      'early_termination_option(any,60,1)@s8',
      'rent_escalation_percent(4)@s9',
      'repair_deduct_waiver()@s10',
    ]);
  });

  it('does not guess a grace period from "by the 5th day of the month"', () => {
    const r = read(LARKSPUR_FLATS);
    expect(r.summary.some((f) => f.startsWith('late_fee_grace_days'))).toBe(false);
    expect(r.unread.map((u) => `${u.predicate}@${u.clauseId}`)).toEqual(['late_fee_grace_days@s6']);
  });

  it('reads Quillon Heights (Resident, Owner, Management and Occupant wording)', () => {
    const r = read(QUILLON_HEIGHTS);
    expect(r.rejected).toEqual([]);
    expect(r.unread).toEqual([]);
    expect(r.summary).toEqual([
      'term(fixed)@s1',
      'monthly_rent(1725)@s2',
      'security_deposit(1725)@s3',
      'deposit_deduction(damage_beyond_wear)@s3',
      'pet_policy(consent_required)@s4',
      'entry_notice_hours(24)@s5',
      'late_fee(60)@s6',
      'late_fee_grace_days(4)@s6',
      'sublet_policy(consent_required)@s7',
      'rent_escalation_percent(3)@s8',
    ]);
  });

  it('keeps every quote verbatim inside the clause it cites', () => {
    for (const text of [LARKSPUR_FLATS, QUILLON_HEIGHTS]) {
      const { lease, facts } = read(text);
      for (const f of facts) {
        const clause = lease.clauses.find((c) => c.id === f.clauseId)!;
        expect(lease.text.slice(f.start, f.end)).toBe(f.quote);
        expect(f.start).toBeGreaterThanOrEqual(clause.start);
        expect(f.end).toBeLessThanOrEqual(clause.end);
      }
    }
  });
});

/** [heading, sentence, facts read]. One clause each, so only the sentence rules are under test. */
type Case = [heading: string, sentence: string, facts: string[]];

const WORDINGS: Case[] = [
  // rent
  ['RENT', 'Tenant shall pay rent of $1,600 per month.', ['monthly_rent(1600)']],
  ['RENT', 'Rent is $1,600.00 monthly.', ['monthly_rent(1600)']],
  ['RENT', 'The rent is $1,100 a month, due on the first.', ['monthly_rent(1100)']],
  ['RENT', 'Resident agrees to pay $980 per month as rent.', ['monthly_rent(980)']],
  ['RENT', 'Annual rent is $19,200.', []],
  ['RENT', 'Rent is $300 per week.', []],
  // deposit
  ['DEPOSIT', 'A deposit of $1,600 is due at signing.', ['security_deposit(1600)']],
  ['SECURITY DEPOSIT', 'Lessee shall pay a damage deposit of $900.', ['security_deposit(900)']],
  ['DEPOSIT', 'A non-refundable deposit of $200 secures the unit.', []],
  ['DEPOSIT', 'Landlord will not deduct for ordinary wear and tear.', ['deposit_deduction(damage_beyond_wear)']],
  ['DEPOSIT', 'Normal wear and tear excepted, Owner may deduct the cost of repairs from the deposit.', ['deposit_deduction(damage_beyond_wear)']],
  ['DEPOSIT', 'The deposit will be applied to damage other than reasonable wear and tear.', ['deposit_deduction(damage_beyond_wear)']],
  ['DEPOSIT', 'Management may deduct carpet cleaning, including normal wear and tear, from the deposit.', ['deposit_deduction(normal_wear_and_tear)']],
  ['DEPOSIT', 'Lessor shall deduct a repainting charge for wear and tear from the deposit.', ['deposit_deduction(normal_wear_and_tear)']],
  // term
  ['LENGTH OF LEASE', 'This lease starts on April 1, 2027 and expires on March 31, 2028.', ['term(fixed)']],
  ['LEASE PERIOD', 'The tenancy runs from July 1, 2027 through June 30, 2028.', ['term(fixed)']],
  ['TERM', 'The lease term is one year.', ['term(fixed)']],
  ['TERM', 'This is a month-to-month tenancy.', ['term(month_to_month)']],
  ['TERM', 'After the first year the tenancy becomes month-to-month.', []],
  // pets
  ['ANIMALS', 'No animals of any kind may be kept in the unit.', ['pet_policy(prohibited)']],
  ['PETS', 'No dogs, cats or other animals are allowed.', ['pet_policy(prohibited)']],
  ['PETS', 'Pets shall not be permitted in the building.', ['pet_policy(prohibited)']],
  ['PETS', 'Tenant agrees not to keep any pets on the premises.', ['pet_policy(prohibited)']],
  ['PETS', 'No dogs are allowed.', []],
  ['PETS', 'Animals are allowed only with Owner\'s written approval.', ['pet_policy(consent_required)']],
  ['PETS', 'No pets without the prior written consent of Landlord.', ['pet_policy(consent_required)']],
  ['PETS', 'Pets are welcome.', ['pet_policy(allowed)']],
  ['PETS', 'Resident may keep up to two pets.', ['pet_policy(allowed)']],
  ['PETS', 'Service animals are permitted.', []],
  ['PETS', 'A pet deposit of $300 is due for each pet.', ['pet_deposit(300)']],
  ['PETS', 'The animal deposit is $250 per animal.', ['pet_deposit(250)']],
  // entry
  ['ENTRY', 'Lessor may enter the unit upon one day\'s notice.', ['entry_notice_hours(24)']],
  ['ACCESS', 'Management may enter with at least twenty-four (24) hours\' advance notice.', ['entry_notice_hours(24)']],
  ['ACCESS', 'Owner shall give two days written notice before entry.', ['entry_notice_hours(48)']],
  ['ACCESS', 'Landlord shall have access to the unit on 36 hours notice.', ['entry_notice_hours(36)']],
  ['ACCESS', 'Owner may enter with twenty four hours notice.', ['entry_notice_hours(24)']],
  ['ENTRY', 'Landlord may enter without notice in an emergency.', []],
  ['ENTRY', 'Landlord may enter at reasonable times with reasonable notice.', []],
  // late fees
  ['LATE FEES', 'A late charge of $50 applies if rent is not received by the 5th day of the month.', ['late_fee(50)']],
  ['LATE FEES', 'Tenant shall pay a $40 late fee if rent is not paid within three (3) days of the due date.', ['late_fee(40)', 'late_fee_grace_days(3)']],
  ['LATE FEES', 'A late fee of $25 plus $5 per day applies.', []],
  ['LATE FEES', 'There is a five-day grace period before any late fee of $45 applies.', ['late_fee(45)', 'late_fee_grace_days(5)']],
  // subletting
  ['ASSIGNMENT', 'The Lessee shall not assign this Lease or sublet the unit.', ['sublet_policy(prohibited)']],
  ['SUBLETTING', 'The Occupant may not rent out any part of the unit to another person without written approval.', ['sublet_policy(consent_required)']],
  ['SUBLETTING', 'Subletting is not permitted.', ['sublet_policy(prohibited)']],
  ['SUBLETTING', 'Resident may sublease with Landlord\'s approval.', ['sublet_policy(consent_required)']],
  ['SUBLETTING', 'Resident may sublet without Owner\'s consent.', ['sublet_policy(allowed)']],
  ['ASSIGNMENT', 'Assignment of this Lease is governed by Rider C.', []],
  // leaving early
  ['EARLY END', 'The Lessee may end this Lease before it expires by giving sixty (60) days\' written notice and paying a fee equal to one month\'s rent.', ['early_termination_option(any,60,1)']],
  ['EARLY END', 'Resident may terminate this Lease early on 30 days notice with no penalty.', ['early_termination_option(any,30,0)']],
  ['EARLY END', 'If Resident\'s employer transfers Resident, Resident may terminate this Lease early by giving 45 days written notice and paying two months\' rent.', ['early_termination_option(job_relocation,45,2)']],
  ['EARLY END', 'If Tenant is deployed, Tenant may terminate this Lease early on 30 days notice.', []],
  ['EARLY END', 'Landlord may terminate this Lease early if Tenant stops paying rent, on 10 days notice.', []],
  ['EARLY END', 'Tenant may end this Lease early on 30 days notice and a $500 fee.', []],
  // repair and deduct
  ['REPAIRS', 'The Lessee has no right to deduct repair costs from rent.', ['repair_deduct_waiver()']],
  ['REPAIRS', 'Resident waives the right to repair and deduct.', ['repair_deduct_waiver()']],
  ['REPAIRS', 'Tenant shall not make repairs and deduct the cost from rent.', ['repair_deduct_waiver()']],
  // rent increases
  ['RENT CHANGES', 'The Lessor may raise the rent by up to 4%.', ['rent_escalation_percent(4)']],
  ['RENT INCREASE', 'Rent will increase three percent (3%) at renewal.', ['rent_escalation_percent(3)']],
  ['RENT INCREASE', 'Rent shall not increase during the term.', []],
  ['RENT INCREASE', 'Rent may rise by 3% or 5% each year.', []],
];

describe('sentence rules on ordinary lease wording', () => {
  it.each(WORDINGS)('%s: %s', (heading, sentence, expected) => {
    const r = read(`1. ${heading}. ${sentence}`);
    expect(r.rejected).toEqual([]);
    expect(r.summary.map((s) => s.replace(/@s1$/, ''))).toEqual(expected);
  });
});

describe('unseen-lease wordings: security, wear, early exit', () => {
  const CASES: Array<[string, string, string[]]> = [
    ['SECURITY', 'At move-in, Tenant will deposit $900 with Owner as security.', ['security_deposit(900)']],
    ['SECURITY', 'Resident pays a sum of $1,250 as a security deposit.', ['security_deposit(1250)']],
    ['SECURITY', 'Management holds security of $800 for the unit.', ['security_deposit(800)']],
    ['SECURITY', 'Owner may apply the security to damage beyond ordinary wear.', ['deposit_deduction(damage_beyond_wear)']],
    ['SECURITY', 'Charges apply to damage in excess of normal wear and tear.', ['deposit_deduction(damage_beyond_wear)']],
    ['DEPOSIT', 'Ordinary wear and tear excepted, the deposit covers damage.', ['deposit_deduction(damage_beyond_wear)']],
    ['EARLY EXIT', 'If Resident wishes to end this lease, Resident may do so on forty-five (45) days written notice and payment of two (2) months rent.', ['early_termination_option(any,45,2)']],
    ['EARLY TERMINATION', 'Should Tenant want to leave this Lease, Tenant can do so with sixty (60) days notice and one (1) months rent as a fee.', ['early_termination_option(any,60,1)']],
    ['EARLY TERMINATION', 'Owner may break this Agreement with thirty (30) days notice.', []],
  ];
  it.each(CASES)('%s: %s', (heading, sentence, expected) => {
    const r = read(`1. ${heading}. ${sentence}`);
    expect(r.rejected).toEqual([]);
    expect(r.summary.map((s) => s.replace(/@s1$/, ''))).toEqual(expected);
  });

  it('reads the full unseen-lease clauses with the quote verbatim', () => {
    const text =
      '5. SECURITY. Upon signing, Lessee shall deposit $1,390 with Lessor as security. Lessor may apply the security only to unpaid rent and to damage in excess of normal wear and tear.\n\n' +
      '9. EARLY TERMINATION. Should Lessee need to break this Agreement, Lessee may do so with thirty (30) days\' written notice and payment of one (1) month\'s rent as a termination fee.';
    const r = read(text);
    expect(r.rejected).toEqual([]);
    expect(r.summary).toEqual(['security_deposit(1390)@s5', 'deposit_deduction(damage_beyond_wear)@s5', 'early_termination_option(any,30,1)@s9']);
  });
});
