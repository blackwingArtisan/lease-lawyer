import type { FactArg } from './types';

/**
 * The closed vocabulary of lease facts. A lease reader may only emit these
 * predicates; anything else is rejected before it reaches the Prolog engine.
 * The same table drives the plain-English wording in the proof chain.
 */
type ArgSpec = { kind: 'money' } | { kind: 'count' } | { kind: 'percent' } | { kind: 'atom'; values: readonly string[] };

export interface PredicateSpec {
  name: string;
  args: readonly ArgSpec[];
  /** Short noun phrase used when the fact is missing, e.g. "the monthly rent". */
  topic: string;
  describe: (args: FactArg[]) => string;
}

const money = { kind: 'money' } as const;
const count = { kind: 'count' } as const;
const percent = { kind: 'percent' } as const;
const atom = (...values: string[]) => ({ kind: 'atom', values }) as const;

export function formatMoney(value: FactArg): string {
  if (typeof value !== 'number') return String(value);
  const cents = Math.round(value * 100);
  const whole = cents % 100 === 0;
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

const plural = (n: FactArg, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const PREDICATES: readonly PredicateSpec[] = [
  {
    name: 'monthly_rent',
    args: [money],
    topic: 'the monthly rent',
    describe: ([a]) => `Monthly rent is ${formatMoney(a!)}`,
  },
  {
    name: 'security_deposit',
    args: [money],
    topic: 'a security deposit',
    describe: ([a]) => `Landlord holds a security deposit of ${formatMoney(a!)}`,
  },
  {
    name: 'term',
    args: [atom('fixed', 'month_to_month')],
    topic: 'the length of the lease term',
    describe: ([a]) => (a === 'fixed' ? 'The lease runs for a fixed term' : 'The tenancy is month-to-month'),
  },
  {
    name: 'deposit_deduction',
    args: [atom('normal_wear_and_tear', 'damage_beyond_wear')],
    topic: 'what may be deducted from the deposit',
    describe: ([a]) =>
      a === 'normal_wear_and_tear'
        ? 'The lease says the landlord will charge the deposit for normal wear and tear'
        : 'The lease limits deposit deductions to damage beyond normal wear and tear',
  },
  {
    name: 'early_termination_option',
    args: [atom('any', 'job_relocation'), count, count],
    topic: 'an early termination option',
    describe: ([why, notice, fee]) =>
      `${why === 'any' ? 'Tenant may end the lease early for any reason' : 'Tenant may end the lease early after a job relocation'}, with ${plural(notice!, "day's", "days'")} notice and a fee of ${plural(fee!, "month's", "months'")} rent`,
  },
  {
    name: 'pet_policy',
    args: [atom('prohibited', 'allowed', 'consent_required')],
    topic: 'a pet policy',
    describe: ([a]) =>
      a === 'prohibited' ? 'The lease prohibits pets' : a === 'allowed' ? 'The lease permits pets' : 'Pets need the landlord’s written consent',
  },
  {
    name: 'pet_deposit',
    args: [money],
    topic: 'a pet deposit',
    describe: ([a]) => `Pet deposit of ${formatMoney(a!)} per animal`,
  },
  {
    name: 'entry_notice_hours',
    args: [count],
    topic: 'how much notice the landlord gives before entry',
    describe: ([a]) => `Landlord gives ${plural(a!, "hour's", "hours'")} notice before entering`,
  },
  {
    name: 'late_fee',
    args: [money],
    topic: 'a late fee',
    describe: ([a]) => `Late fee of ${formatMoney(a!)}`,
  },
  {
    name: 'late_fee_grace_days',
    args: [count],
    topic: 'the grace period before a late fee',
    describe: ([a]) => `The late fee starts after a grace period of ${plural(a!, 'day', 'days')}`,
  },
  {
    name: 'sublet_policy',
    args: [atom('prohibited', 'consent_required', 'allowed')],
    topic: 'a subletting policy',
    describe: ([a]) =>
      a === 'prohibited'
        ? 'The lease prohibits subletting'
        : a === 'allowed'
          ? 'The lease permits subletting'
          : 'Subletting needs the landlord’s written consent',
  },
  {
    name: 'repair_deduct_waiver',
    args: [],
    topic: 'a waiver of the repair-and-deduct remedy',
    describe: () => 'The lease says the tenant waives the right to repair and deduct',
  },
  {
    name: 'rent_escalation_percent',
    args: [percent],
    topic: 'a rent increase clause',
    describe: ([a]) => `Rent rises ${a}% during the term`,
  },
];

const BY_NAME = new Map(PREDICATES.map((p) => [p.name, p]));

export function predicateSpec(name: string): PredicateSpec | undefined {
  return BY_NAME.get(name);
}

/** Returns null when the arguments fit the predicate, otherwise the reason they do not. */
export function checkArgs(spec: PredicateSpec, args: FactArg[]): string | null {
  if (args.length !== spec.args.length) {
    return `${spec.name} takes ${spec.args.length} ${spec.args.length === 1 ? "argument" : "arguments"}, got ${args.length}`;
  }
  for (const [i, arg] of args.entries()) {
    const want = spec.args[i]!;
    if (want.kind === 'atom') {
      if (typeof arg !== 'string' || !want.values.includes(arg)) {
        return `argument ${i + 1} of ${spec.name} must be one of ${want.values.join(', ')}`;
      }
    } else {
      if (typeof arg !== 'number' || !Number.isFinite(arg) || arg < 0) {
        return `argument ${i + 1} of ${spec.name} must be a non-negative number`;
      }
      if (want.kind === 'count' && !Number.isInteger(arg)) {
        return `argument ${i + 1} of ${spec.name} must be a whole number`;
      }
    }
  }
  return null;
}

/**
 * Facts about the tenant's own situation. They never come from the lease:
 * they come from the question or from the tenant answering a follow-up.
 */
export interface TenantFactSpec {
  name: string;
  question: string;
  told: string;
  denied: string;
}

export const TENANT_FACTS: readonly TenantFactSpec[] = [
  {
    name: 'job_transfer',
    question: 'Is your employer transferring you to a job far from home?',
    told: 'Your employer is transferring you',
    denied: 'You are not moving for a job transfer',
  },
  {
    name: 'military_orders',
    question: 'Are you on active-duty military orders to move or deploy?',
    told: 'You have active-duty military orders',
    denied: 'You are not on military orders',
  },
  {
    name: 'assistance_animal',
    question: 'Is the animal a service or assistance animal (including an emotional support animal) for a disability?',
    told: 'The animal is an assistance animal',
    denied: 'The animal is an ordinary pet',
  },
  {
    name: 'emergency',
    question: 'Is this an emergency, such as a fire, flood or gas leak?',
    told: 'There is an emergency',
    denied: 'There is no emergency',
  },
  {
    name: 'essential_repair',
    question: 'Is the problem with heat, water, electricity, plumbing or another essential service?',
    told: 'An essential service is broken',
    denied: 'The repair is not to an essential service',
  },
  {
    name: 'written_notice',
    question: 'Did you tell the landlord about the problem in writing at least 14 days ago?',
    told: 'You gave written notice at least 14 days ago',
    denied: 'You have not given 14 days’ written notice',
  },
];

const TENANT_BY_NAME = new Map(TENANT_FACTS.map((t) => [t.name, t]));

export function tenantFactSpec(name: string): TenantFactSpec | undefined {
  return TENANT_BY_NAME.get(name);
}
