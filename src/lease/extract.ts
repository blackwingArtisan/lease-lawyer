import { sentences, type Sentence } from './parse';
import type { CandidateFact, Clause, FactArg, ParsedLease } from './types';

/**
 * Rule-based lease reader. It reads plain residential lease language
 * sentence by sentence and proposes facts in the shared vocabulary, each
 * quoting the sentence it came from. It is deterministic and free, and it is
 * the default reader for the app and the tests. The AI reader proposes facts
 * in exactly the same shape.
 */
export function extractFacts(lease: ParsedLease): CandidateFact[] {
  const out: CandidateFact[] = [];
  for (const clause of lease.clauses) {
    for (const s of sentences(lease, clause)) {
      for (const rule of RULES) {
        for (const fact of rule(s.text, clause)) {
          out.push({ ...fact, clauseId: clause.id, quote: s.text });
        }
      }
    }
  }
  return out;
}

type Found = { predicate: string; args: FactArg[] };
type SentenceRule = (text: string, clause: Clause) => Found[];

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  'twenty-one': 21, 'twenty-four': 24, 'forty-five': 45, 'forty-eight': 48, 'seventy-two': 72,
};

/** Reads "five (5)", "(5)", "5" or "five" from the start of a phrase. */
const COUNT = String.raw`(?:([a-z]+(?:-[a-z]+)?)\s+\((\d+)\)|(\d+)|([a-z]+(?:-[a-z]+)?))`;

function countFrom(m: RegExpMatchArray, offset: number): number | null {
  const digits = m[offset + 2] ?? m[offset + 3];
  if (digits) return Number(digits);
  const word = m[offset + 4]?.toLowerCase();
  if (word && word in WORD_NUMBERS) return WORD_NUMBERS[word]!;
  return null;
}

function count(text: string, unit: string): number | null {
  const re = new RegExp(`${COUNT}\\s+(?:calendar\\s+|business\\s+)?${unit}`, 'i');
  const m = text.match(re);
  return m ? countFrom(m, 0) : null;
}

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/;

function money(text: string): number | null {
  const m = text.match(MONEY);
  return m ? Number(m[1]!.replace(/,/g, '')) : null;
}

const has = (text: string, re: RegExp) => re.test(text);

const rent: SentenceRule = (t) => {
  const m = t.match(/monthly rent (?:of|is|shall be|in the amount of)\s*\$\s?([\d,]+(?:\.\d{2})?)/i);
  return m ? [{ predicate: 'monthly_rent', args: [Number(m[1]!.replace(/,/g, ''))] }] : [];
};

const deposit: SentenceRule = (t) => {
  const out: Found[] = [];
  if (has(t, /security deposit/i) && !has(t, /late|pet deposit/i)) {
    const amount = money(t);
    if (amount !== null) out.push({ predicate: 'security_deposit', args: [amount] });
  }
  if (has(t, /deposit|deduct/i) && has(t, /wear and tear/i)) {
    if (has(t, /(?:including|regardless of|even for|whether or not)[^.]*wear and tear/i)) {
      out.push({ predicate: 'deposit_deduction', args: ['normal_wear_and_tear'] });
    } else if (has(t, /(?:beyond|except|excluding|other than|exceeding)\s+(?:ordinary\s+|normal\s+|reasonable\s+)?wear and tear/i)) {
      out.push({ predicate: 'deposit_deduction', args: ['damage_beyond_wear'] });
    }
  }
  return out;
};

const term: SentenceRule = (t, clause) => {
  if (has(t, /month[- ]to[- ]month/i) && (has(clause.title, /\bTERM\b|TENANCY/) || has(t, /tenancy|this (?:lease|agreement)/i))) {
    return [{ predicate: 'term', args: ['month_to_month'] }];
  }
  if (
    has(clause.title, /\bTERM\b/) &&
    (has(t, /\b(?:beginning|begins|commencing|starts)\b[^.]*\b(?:ending|ends|terminating)\b/i) || has(t, /term of this (?:lease|agreement) is [^.]*months?/i))
  ) {
    return [{ predicate: 'term', args: ['fixed'] }];
  }
  return [];
};

const earlyTermination: SentenceRule = (t) => {
  if (!has(t, /terminate this (?:lease|agreement) early|early termination/i) || !has(t, /\bmay\b/i)) return [];
  const notice = count(t, "days?'?\\s*(?:prior\\s+)?(?:written\\s+)?notice");
  const fee = count(t, "months?'?s?'?\\s+rent");
  if (notice === null) return [];
  const why = has(t, /(?:employer|employment|job)[^.]*(?:transfer|relocat)|(?:transfer|relocat)[^.]*(?:employer|employment|job|work)/i)
    ? 'job_relocation'
    : 'any';
  return [{ predicate: 'early_termination_option', args: [why, notice, fee ?? 0] }];
};

const pets: SentenceRule = (t) => {
  const out: Found[] = [];
  if (has(t, /\bno pets\b|pets (?:are|shall) not (?:be )?(?:permitted|allowed)|shall not keep any (?:pet|animal)/i)) {
    out.push({ predicate: 'pet_policy', args: ['prohibited'] });
  } else if (has(t, /\bpets?\b/i) && has(t, /written (?:consent|approval|permission)/i)) {
    out.push({ predicate: 'pet_policy', args: ['consent_required'] });
  } else if (has(t, /pets (?:are|shall be) (?:permitted|allowed)|tenant may keep (?:a |one )?pet/i)) {
    out.push({ predicate: 'pet_policy', args: ['allowed'] });
  }
  if (has(t, /pet deposit/i)) {
    const amount = money(t);
    if (amount !== null) out.push({ predicate: 'pet_deposit', args: [amount] });
  }
  return out;
};

const entry: SentenceRule = (t) => {
  if (!has(t, /\benter/i) || !has(t, /notice/i)) return [];
  const hours = count(t, "hours?'?");
  return hours === null ? [] : [{ predicate: 'entry_notice_hours', args: [hours] }];
};

const lateFee: SentenceRule = (t) => {
  if (!has(t, /late (?:fee|charge)/i)) return [];
  const out: Found[] = [];
  const amount = money(t);
  if (amount !== null) out.push({ predicate: 'late_fee', args: [amount] });
  const grace = t.match(new RegExp(`(?:within|grace period of)\\s+${COUNT}\\s+(?:calendar\\s+)?days?`, 'i'));
  if (grace) {
    const days = countFrom(grace, 0);
    if (days !== null) out.push({ predicate: 'late_fee_grace_days', args: [days] });
  }
  return out;
};

const sublet: SentenceRule = (t) => {
  if (!has(t, /\bsub-?let|\bsub-?lease/i)) return [];
  if (has(t, /without (?:the )?(?:prior )?written (?:consent|approval)/i)) {
    return [{ predicate: 'sublet_policy', args: ['consent_required'] }];
  }
  if (has(t, /(?:shall|may) not sub-?(?:let|lease)|sub-?(?:letting|leasing) is (?:not permitted|prohibited)/i)) {
    return [{ predicate: 'sublet_policy', args: ['prohibited'] }];
  }
  if (has(t, /tenant may sub-?(?:let|lease)|sub-?(?:letting|leasing) is (?:permitted|allowed)/i)) {
    return [{ predicate: 'sublet_policy', args: ['allowed'] }];
  }
  return [];
};

const repairWaiver: SentenceRule = (t) =>
  has(t, /waives?\b[^.]*\brepairs?\b[^.]*\bdeduct/i) ? [{ predicate: 'repair_deduct_waiver', args: [] }] : [];

const escalation: SentenceRule = (t) => {
  if (!has(t, /rent/i) || !has(t, /increase/i)) return [];
  const m = t.match(/increase by (?:[a-z-]+ percent\s*)?\(?(\d+(?:\.\d+)?)\s?(?:%|percent)\)?/i);
  return m ? [{ predicate: 'rent_escalation_percent', args: [Number(m[1])] }] : [];
};

const RULES: readonly SentenceRule[] = [rent, deposit, term, earlyTermination, pets, entry, lateFee, sublet, repairWaiver, escalation];

export type { Sentence };
