import { formatMoney } from '../lease/vocabulary';
import type { FactArg } from '../lease/types';

const plural = (n: unknown, one: string, many: string, fallback: string) =>
  typeof n === 'number' ? `${n} ${n === 1 ? one : many}` : fallback;
const days = (n: unknown) => plural(n, 'day', 'days', 'too few days');
const monthsRent = (n: unknown) => plural(n, 'month’s rent', 'months’ rent', 'the stated rent');

/** Lease fact arguments found in a proof, keyed by predicate. */
export type FactLookup = (predicate: string) => FactArg[] | undefined;

export interface RuleInfo {
  /** Where the rule sits in the model code, e.g. "MJ §3.4". */
  section: string;
  /** Short name shown on the proof step. */
  title: string;
  /** What the rule says, in plain English. */
  text: string;
  /** For verdict rules: the one-line answer, filled from the cited facts. */
  answer?: (fact: FactLookup) => string;
}

const money = (fact: FactLookup, predicate: string, i = 0) => {
  const v = fact(predicate)?.[i];
  return v === undefined ? 'the stated amount' : formatMoney(v);
};

/**
 * Plain-English text for every rule in rulebase.pl. A unit test checks that
 * the two stay in step: every rule id has text, and every text has a rule.
 */
export const RULES: Record<string, RuleInfo> = {
  mj_1_6: {
    section: 'MJ §1.6',
    title: 'No waiving tenant protections',
    text: 'A lease term that takes away a right this code gives tenants is unenforceable. The rest of the lease still stands.',
  },

  mj_3_4: {
    section: 'MJ §3.4',
    title: 'Wear and tear is not damage',
    text: 'A landlord may deduct from a security deposit only for unpaid rent and for damage beyond normal wear and tear. Normal wear and tear means the ordinary decline from everyday living: faded paint, light scuffs, worn carpet paths.',
  },
  mj_3_4_waiver: {
    section: 'MJ §3.4',
    title: 'Deposit protection cannot be waived',
    text: 'A lease term that charges the deposit for normal wear and tear takes away the protection in §3.4.',
  },
  wear_clause_void: {
    section: 'MJ §3.4, §1.6',
    title: 'The wear-and-tear charge is void',
    text: 'The lease tries to charge the deposit for normal wear and tear, but that term is unenforceable.',
    answer: () =>
      'No. Your lease says the landlord will charge your deposit for normal wear and tear, but that term is unenforceable. Only unpaid rent and real damage can come out of the deposit.',
  },
  wear_lease_agrees: {
    section: 'MJ §3.4',
    title: 'Lease and law agree',
    text: 'The lease already limits deductions to damage beyond normal wear and tear, which matches the code.',
    answer: (f) =>
      `No. Your lease and the model code agree: your ${money(f, 'security_deposit')} deposit covers only unpaid rent and damage beyond normal wear and tear.`,
  },
  wear_statute: {
    section: 'MJ §3.4',
    title: 'The code fills the gap',
    text: 'The lease does not say what may be deducted, so the code decides: not normal wear and tear.',
    answer: (f) =>
      `No. Your lease does not say what may come out of your ${money(f, 'security_deposit')} deposit, so the model code decides: normal wear and tear cannot be charged.`,
  },
  wear_no_deposit: {
    section: 'MJ §3.4',
    title: 'No deposit to keep',
    text: 'The lease does not mention a security deposit, so there is nothing to deduct from.',
    answer: () => 'No. Your lease does not provide for a security deposit, so there is nothing for the landlord to keep.',
  },

  mj_4_1: {
    section: 'MJ §4.1',
    title: 'Fees must be in the lease',
    text: 'A landlord may charge a fee only if the lease states it.',
  },
  mj_4_3: {
    section: 'MJ §4.3',
    title: 'Late fee cap',
    text: 'A late fee may not exceed 5% of one month’s rent.',
  },
  mj_4_3_grace: {
    section: 'MJ §4.3',
    title: 'Five-day grace period',
    text: 'No late fee may be charged until rent is at least 5 days late.',
  },
  late_fee_ok: {
    section: 'MJ §4.3',
    title: 'Late fee within the limits',
    text: 'The fee is at or under the cap and the grace period is at least 5 days.',
    answer: (f) =>
      `Yes. The ${money(f, 'late_fee')} late fee is within the 5% cap on ${money(f, 'monthly_rent')} rent, and the lease gives the required grace period.`,
  },
  late_fee_ok_default_grace: {
    section: 'MJ §4.3',
    title: 'Late fee within the cap',
    text: 'The fee is within the cap. The lease gives no grace period, so the 5-day statutory grace period applies.',
    answer: (f) =>
      `Yes, after 5 days. The ${money(f, 'late_fee')} fee is within the cap, but it cannot be charged until rent is 5 days late.`,
  },
  late_fee_too_high: {
    section: 'MJ §4.3',
    title: 'Late fee over the cap',
    text: 'The late fee in the lease is more than 5% of the monthly rent.',
    answer: (f) =>
      `No. The ${money(f, 'late_fee')} late fee is more than 5% of your ${money(f, 'monthly_rent')} rent, so it is over the legal cap.`,
  },
  late_fee_grace_too_short: {
    section: 'MJ §4.3',
    title: 'Grace period too short',
    text: 'The lease charges the late fee before rent is 5 days late.',
    answer: (f) =>
      `No, not as written. Your lease charges the fee after ${days(f('late_fee_grace_days')?.[0])}, but no late fee may be charged until rent is 5 days late.`,
  },
  late_fee_not_in_lease: {
    section: 'MJ §4.1',
    title: 'No late fee in the lease',
    text: 'The lease does not state a late fee, so none can be charged.',
    answer: () => 'No. Your lease does not set a late fee, and a landlord may only charge fees the lease states.',
  },

  mj_4_5: {
    section: 'MJ §4.5',
    title: 'Fixed-term rent is locked',
    text: 'During a fixed term, rent may change only as the lease itself provides.',
  },
  mj_4_6: {
    section: 'MJ §4.6',
    title: '30 days’ notice to raise rent',
    text: 'In a month-to-month tenancy, the landlord may raise rent with at least 30 days’ written notice.',
  },
  raise_fixed_term: {
    section: 'MJ §4.5',
    title: 'Rent fixed for the term',
    text: 'The lease is for a fixed term and has no rent increase clause.',
    answer: () => 'No. Your lease is for a fixed term with no rent increase clause, so the rent is locked until the term ends.',
  },
  raise_by_clause: {
    section: 'MJ §4.5',
    title: 'Increase written into the lease',
    text: 'The lease itself provides for a rent increase during the term.',
    answer: (f) =>
      `Yes, but only as written. Your lease raises the rent by ${String(f('rent_escalation_percent')?.[0] ?? 'the stated')}% partway through the term. Any other increase must wait until the term ends.`,
  },
  raise_month_to_month: {
    section: 'MJ §4.6',
    title: 'Month-to-month increase',
    text: 'In a month-to-month tenancy, rent may rise with 30 days’ written notice.',
    answer: () => 'Yes, with notice. In a month-to-month tenancy the landlord must give you at least 30 days’ written notice first.',
  },

  mj_5_1: {
    section: 'MJ §5.1',
    title: '24 hours’ notice to enter',
    text: 'Except in an emergency, a landlord must give at least 24 hours’ notice before entering, and may enter only at reasonable times.',
  },
  mj_5_1_waiver: {
    section: 'MJ §5.1',
    title: 'Notice floor cannot be cut',
    text: 'A lease that allows entry on less than 24 hours’ notice takes away the protection in §5.1.',
  },
  mj_5_2: {
    section: 'MJ §5.2',
    title: 'Emergency entry',
    text: 'In an emergency that threatens people or property, a landlord may enter without notice.',
  },
  entry_emergency: {
    section: 'MJ §5.2',
    title: 'Emergency entry allowed',
    text: 'There is an emergency, so notice is not required.',
    answer: () => 'Yes, in a real emergency. The landlord may enter without notice to deal with it, and should tell you afterwards.',
  },
  entry_lease_notice: {
    section: 'MJ §5.1',
    title: 'Lease notice meets the floor',
    text: 'The lease requires at least the 24 hours’ notice the code demands.',
    answer: (f) =>
      `No. Outside an emergency, your landlord must give at least ${String(f('entry_notice_hours')?.[0] ?? 24)} hours’ notice, as your lease says.`,
  },
  entry_short_notice_void: {
    section: 'MJ §5.1, §1.6',
    title: 'Short-notice clause is void',
    text: 'The lease allows entry on less notice than the code requires, so that term is unenforceable.',
    answer: (f) =>
      `No. Your lease allows entry after ${String(f('entry_notice_hours')?.[0] ?? 'less than 24')} hours’ notice, but that is below the 24-hour minimum, so the landlord must give at least 24 hours’ notice.`,
  },
  entry_statute: {
    section: 'MJ §5.1',
    title: 'Code sets the notice',
    text: 'The lease does not set a notice period in hours, so the 24-hour floor applies.',
    answer: () => 'No. Your lease does not set a notice period in hours, so the 24-hour minimum applies outside emergencies.',
  },

  mj_6_2: {
    section: 'MJ §6.2',
    title: 'Military release',
    text: 'A tenant who receives active-duty military orders to move or deploy may end the lease with 30 days’ written notice and a copy of the orders, without an early termination fee.',
  },
  mj_6_4: {
    section: 'MJ §6.4',
    title: 'Duty to re-rent',
    text: 'A tenant who leaves early may owe rent until the end of the term, but the landlord must make reasonable efforts to re-rent the home, and the tenant owes nothing for any period it is re-rented.',
  },
  leave_any_reason: {
    section: 'MJ §6.1',
    title: 'Lease has an exit clause',
    text: 'The lease lets the tenant end it early for any reason on the stated terms.',
    answer: (f) => {
      const [, notice, fee] = f('early_termination_option') ?? [];
      return `Yes. Your lease lets you leave early for any reason with ${String(notice ?? 'the stated')} days’ written notice and a fee of ${monthsRent(fee)}.`;
    },
  },
  leave_job_relocation: {
    section: 'MJ §6.1',
    title: 'Job relocation exit',
    text: 'The lease lets the tenant end it early after a job transfer, and the tenant is being transferred.',
    answer: (f) => {
      const [, notice, fee] = f('early_termination_option') ?? [];
      return `Yes. Your lease has a job relocation clause: give ${String(notice ?? 'the stated')} days’ written notice and pay ${monthsRent(fee)} as the fee.`;
    },
  },
  leave_military: {
    section: 'MJ §6.2',
    title: 'Military orders',
    text: 'The tenant has active-duty military orders.',
    answer: () => 'Yes. With active-duty orders you may end the lease on 30 days’ written notice with a copy of the orders, and no early termination fee.',
  },
  leave_no_option: {
    section: 'MJ §6.4',
    title: 'No early exit',
    text: 'The lease has no early termination option and no statutory release applies.',
    answer: () =>
      'No, not without cost. Your lease has no early exit, so you may owe rent until the home is re-rented. The landlord must try to re-rent it.',
  },
  leave_relocation_only: {
    section: 'MJ §6.4',
    title: 'Exit only for a job transfer',
    text: 'The lease allows an early exit only for a job transfer, and that does not apply.',
    answer: () =>
      'No, not without cost. Your lease only allows an early exit for a job transfer, so you may owe rent until the home is re-rented. The landlord must try to re-rent it.',
  },

  mj_7_1: {
    section: 'MJ §7.1',
    title: 'Assistance animals',
    text: 'A landlord must allow an assistance animal that a tenant needs because of a disability, even under a no-pets clause, and may not charge a pet deposit or pet fee for it.',
  },
  mj_7_3: {
    section: 'MJ §7.3',
    title: 'Silent lease allows pets',
    text: 'If the lease says nothing about pets, the tenant may keep ordinary household pets and is liable for any damage they cause.',
  },
  pets_assistance_animal: {
    section: 'MJ §7.1',
    title: 'Assistance animal allowed',
    text: 'The animal is an assistance animal, so it must be allowed.',
    answer: () => 'Yes. An assistance animal must be allowed even under a no-pets clause, and you cannot be charged a pet deposit for it.',
  },
  pets_allowed: {
    section: 'Lease',
    title: 'Lease permits pets',
    text: 'The lease expressly permits pets.',
    answer: (f) => {
      const deposit = f('pet_deposit')?.[0];
      return deposit === undefined
        ? 'Yes. Your lease permits pets.'
        : `Yes. Your lease permits pets with a ${formatMoney(deposit)} pet deposit per animal.`;
    },
  },
  pets_with_consent: {
    section: 'Lease',
    title: 'Pets with consent',
    text: 'The lease allows pets with the landlord’s written consent.',
    answer: () => 'Yes, with written consent. Ask your landlord in writing before the pet moves in.',
  },
  pets_lease_silent: {
    section: 'MJ §7.3',
    title: 'Lease is silent on pets',
    text: 'The lease says nothing about pets, so ordinary pets are allowed.',
    answer: () => 'Yes. Your lease says nothing about pets, so ordinary household pets are allowed. You are responsible for any damage.',
  },
  pets_prohibited: {
    section: 'Lease',
    title: 'Lease prohibits pets',
    text: 'The lease bans pets and the animal is an ordinary pet.',
    answer: () => 'No. Your lease bans pets. An assistance animal would be different.',
  },

  mj_8_2: {
    section: 'MJ §8.2',
    title: 'Consent not unreasonably withheld',
    text: 'Where a lease requires consent to sublet, the landlord may not unreasonably refuse it.',
  },
  mj_8_3: {
    section: 'MJ §8.3',
    title: 'Silent lease allows subletting',
    text: 'If the lease says nothing about subletting, the tenant may sublet after giving the landlord written notice. The tenant stays responsible for the rent.',
  },
  sublet_prohibited: {
    section: 'Lease',
    title: 'Lease bans subletting',
    text: 'The lease prohibits subletting.',
    answer: () => 'No. Your lease prohibits subletting.',
  },
  sublet_with_consent: {
    section: 'MJ §8.2',
    title: 'Sublet with consent',
    text: 'The lease requires consent, which may not be unreasonably withheld.',
    answer: () => 'Yes, with written consent. Your landlord must approve, but may not refuse without a good reason.',
  },
  sublet_allowed: {
    section: 'Lease',
    title: 'Lease permits subletting',
    text: 'The lease expressly permits subletting.',
    answer: () => 'Yes. Your lease permits subletting. You stay responsible for the rent.',
  },
  sublet_lease_silent: {
    section: 'MJ §8.3',
    title: 'Lease is silent on subletting',
    text: 'The lease says nothing about subletting, so the code allows it with notice.',
    answer: () => 'Yes, with notice. Your lease says nothing about subletting, so you may sublet after telling the landlord in writing.',
  },

  mj_10_2: {
    section: 'MJ §10.2',
    title: 'Repair and deduct',
    text: 'If an essential service (heat, water, electricity, plumbing) fails and the landlord does not fix it within 14 days of written notice, the tenant may have it repaired and deduct the reasonable cost from rent, up to one month’s rent.',
  },
  mj_10_2_notice: {
    section: 'MJ §10.2',
    title: 'Written notice first',
    text: 'The repair-and-deduct remedy is available only 14 days after written notice to the landlord.',
  },
  mj_10_2_scope: {
    section: 'MJ §10.2',
    title: 'Essential services only',
    text: 'Repair and deduct covers only essential services, not cosmetic or minor repairs.',
  },
  mj_10_2_waiver: {
    section: 'MJ §10.2',
    title: 'Repair remedy cannot be waived',
    text: 'A lease term that waives repair and deduct takes away the remedy in §10.2.',
  },
  repair_deduct_waiver_void: {
    section: 'MJ §10.2, §1.6',
    title: 'Repair waiver is void',
    text: 'The remedy applies, and the lease waiver of it is unenforceable.',
    answer: (f) =>
      `Yes. Your lease's waiver of repair and deduct is unenforceable. Keep receipts; the deduction is capped at one month’s rent (${money(f, 'monthly_rent')}).`,
  },
  repair_deduct_allowed: {
    section: 'MJ §10.2',
    title: 'Repair and deduct applies',
    text: 'An essential service failed and written notice was given at least 14 days ago.',
    answer: (f) =>
      `Yes. You may have it repaired and deduct the reasonable cost from rent, up to one month’s rent (${money(f, 'monthly_rent')}). Keep receipts.`,
  },
  repair_notice_first: {
    section: 'MJ §10.2',
    title: 'Give written notice first',
    text: 'The 14-day written notice has not been given yet.',
    answer: () => 'Not yet. Tell your landlord about the problem in writing first. If it is still not fixed after 14 days, you may repair and deduct.',
  },
  repair_not_essential: {
    section: 'MJ §10.2',
    title: 'Not an essential repair',
    text: 'Repair and deduct does not cover this kind of repair.',
    answer: () => 'No. Repair and deduct covers only essential services such as heat, water, electricity and plumbing.',
  },
};

export function ruleInfo(id: string): RuleInfo {
  return RULES[id] ?? { section: 'Rule', title: id.replace(/_/g, ' '), text: '' };
}
