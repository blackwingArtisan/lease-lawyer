import { sentences, type Sentence } from './parse';
import type { CandidateFact, Clause, FactArg, ParsedLease } from './types';

/**
 * Rule-based lease reader. It reads plain residential lease language
 * sentence by sentence and proposes facts in the shared vocabulary, each
 * quoting the sentence it came from. It is deterministic and free, and it is
 * the default reader for the app and the tests. The AI reader proposes facts
 * in exactly the same shape.
 *
 * No rule set reads every lease. When a rule is not sure, it proposes nothing:
 * the coverage check (coverage.ts) then flags the clause as unread, so the
 * engine says "can't tell" and never treats the lease as silent.
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

const ONES: Record<string, number> = {
  a: 1, an: 1, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "twenty-four" -> 24, "sixty" -> 60, "least five" -> 5. Unknown words give null. */
function wordNumber(phrase: string): number | null {
  const words = phrase.toLowerCase().split(/[- ]+/).filter(Boolean);
  const last = words[words.length - 1];
  const prev = words[words.length - 2];
  if (last !== undefined && prev !== undefined && prev in TENS && last in ONES && last !== 'a' && last !== 'an') {
    return TENS[prev]! + ONES[last]!;
  }
  if (last === undefined) return null;
  if (last in TENS) return TENS[last]!;
  if (last in ONES) return ONES[last]!;
  return null;
}

/** Reads "five (5)", "5", or "five" / "twenty-four". Groups: 1 word, 2 digits in brackets, 3 digits, 4 word. */
const COUNT = String.raw`(?:([a-z]+(?:[- ][a-z]+)?)\s+\((\d+)\)|(\d+)|([a-z]+(?:[- ][a-z]+)?))`;

function countFrom(m: RegExpMatchArray): number | null {
  const digits = m[2] ?? m[3];
  if (digits) return Number(digits);
  const word = m[4];
  return word ? wordNumber(word) : null;
}

/** The first number that sits directly before `tail`, optionally after `prefix` (which must not capture). */
function countBefore(text: string, tail: string, prefix = ''): number | null {
  const m = text.match(new RegExp(`${prefix}${COUNT}${tail}`, 'i'));
  return m ? countFrom(m) : null;
}

const APOS = `['’]`;
const MONEY_SRC = String.raw`\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)`;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** A dollar amount written next to a label, either "label ... $X" or "$X ... label". */
function moneyNear(text: string, label: string): number | null {
  const after = text.match(new RegExp(`${label}[^.$]{0,40}?${MONEY_SRC}`, 'i'));
  if (after) return toNumber(after[1]!);
  const before = text.match(new RegExp(`${MONEY_SRC}[^.$]{0,30}?${label}`, 'i'));
  return before ? toNumber(before[1]!) : null;
}

const has = (text: string, re: RegExp) => re.test(text);

/** The words a lease uses for the two parties. */
const LANDLORD = /\b(?:landlord|lessor|owner|management)\b/i;
const TENANT = /\b(?:tenant|lessee|resident|occupant|renter)s?\b/i;

/** Written consent or approval, in the ways leases phrase it. */
const CONSENT = new RegExp(
  String.raw`(?:written|prior|advance|express)\s+(?:consent|approval|permission|authori[sz]ation)` +
    String.raw`|(?:consent|approval|permission)\s+(?:of|from)\s+(?:the\s+)?(?:landlord|lessor|owner|management)` +
    String.raw`|(?:landlord|lessor|owner|management)${APOS}?s?\s+(?:consent|approval|permission)`,
  'i',
);

// --- Rent -------------------------------------------------------------------

const rent: SentenceRule = (t, clause) => {
  if (has(t, /\b(?:late|deposit|increas\w*|rais\w*|escalat\w*|returned|fee|charge|penalt\w*|utilit\w*)\b/i)) return [];
  if (has(t, /\b(?:per|a|each|every)\s+(?:year|week)\b|\b(?:annual\w*|weekly|yearly|bi-?weekly)\b/i)) return [];
  const titled = has(clause.title, /\brent\b/i);
  const direct = t.match(
    new RegExp(
      String.raw`\b(?:monthly |base |basic |total )?rent\b(?: payment)?\s*(?:of|is|shall be|will be|in the amount of|equals|:)\s*(?:the (?:sum|amount) of\s*)?${MONEY_SRC}`,
      'i',
    ),
  );
  if (direct && (has(t, /\bmonth(?:ly)?\b/i) || titled)) return [{ predicate: 'monthly_rent', args: [toNumber(direct[1]!)] }];
  const periodic = t.match(new RegExp(`${MONEY_SRC}\\s*(?:per|a|each|every|/)\\s*month\\b`, 'i'));
  if (periodic && (has(t, /\brent\b/i) || titled)) return [{ predicate: 'monthly_rent', args: [toNumber(periodic[1]!)] }];
  return [];
};

// --- Deposit ----------------------------------------------------------------

const WEAR = /wear (?:and|&) tear/i;

const deposit: SentenceRule = (t, clause) => {
  const out: Found[] = [];
  const depositTitle = has(clause.title, /\bdeposit/i);
  if (
    has(t, /\bdeposit\b/i) &&
    (depositTitle || has(t, /\b(?:security|damage)\s+deposit/i)) &&
    !has(t, /\blate\b|\b(?:pets?|animals?)\b|non-?refundable|\bapplication\b|\bkey\b/i)
  ) {
    const amount = moneyNear(t, String.raw`(?:(?:security|damage|rental|move-in)\s+)?deposit`);
    if (amount !== null) out.push({ predicate: 'security_deposit', args: [amount] });
  }
  if (out.length === 0 && !has(t, /\blate\b|\b(?:pets?|animals?)\b|non-?refundable|\bapplication\b|\bkey\b/i)) {
    // "deposit $X with Lessor as security", "$X as a security", "security of $X"
    const held =
      t.match(new RegExp(String.raw`\bdeposit(?:s|ed)?\s+(?:the\s+(?:sum|amount)\s+of\s+)?${MONEY_SRC}[^.$]{0,60}?\bas\s+(?:a\s+|the\s+|its\s+|their\s+)?(?:security|surety)\b`, 'i')) ??
      t.match(new RegExp(String.raw`${MONEY_SRC}[^.$]{0,50}?\bas\s+(?:a\s+|the\s+)?(?:security|surety)\b`, 'i')) ??
      t.match(new RegExp(String.raw`\b(?:security|surety)\s+(?:of|in the amount of|totall?ing)\s+${MONEY_SRC}`, 'i'));
    if (held) out.push({ predicate: 'security_deposit', args: [toNumber(held[1]!)] });
  }
  const securityTitle = has(clause.title, /\bsecurity\b/i);
  const beyondWear = has(t, /\b(?:beyond|in excess of|exceeding|over and above)\s+(?:ordinary\s+|normal\s+|reasonable\s+)*wear\b/i);
  if ((has(t, /deposit|deduct|\bsecurity\b/i) || depositTitle || securityTitle) && (has(t, WEAR) || beyondWear)) {
    const limits =
      has(t, /\b(?:will|shall|may|can|does|do|would)\s+not\b[^.]*\b(?:deduct|charge|withhold|retain|keep|apply|bill)\w*\b[^.]*wear (?:and|&) tear/i) ||
      has(t, /wear (?:and|&) tear\s+(?:excepted|excluded|is excepted|is excluded|is not|are not|shall not|will not)\b/i) ||
      beyondWear ||
      has(t, /\b(?:except|excepting|excluding|exclusive of|other than|not including|beyond|exceeding|in excess of|apart from)\s+(?:for\s+)?(?:ordinary\s+|normal\s+|reasonable\s+)*wear (?:and|&) tear/i) ||
      has(t, /\bnot\s+for\b[^.]*wear (?:and|&) tear|\bno\s+(?:deductions?|charges?)\s+(?:will be made\s+)?for\b[^.]*wear/i) ||
      has(t, /wear (?:and|&) tear[^.]*(?:landlord|lessor|owner|management)['’]?s?\s+(?:responsibility|expense|cost)/i);
    if (limits) {
      out.push({ predicate: 'deposit_deduction', args: ['damage_beyond_wear'] });
    } else if (
      has(t, /(?:including|regardless of|even for|whether or not)[^.]*wear (?:and|&) tear/i) ||
      has(t, /\b(?:may|will|shall)\s+(?:also\s+)?(?:deduct|charge|retain|keep|withhold|apply)\b[^.]*\bwear (?:and|&) tear/i)
    ) {
      out.push({ predicate: 'deposit_deduction', args: ['normal_wear_and_tear'] });
    }
  }
  return out;
};

// --- Term -------------------------------------------------------------------

const TERM_TITLE = /\b(?:term|lease term|lease period|length of (?:the )?lease|lease length|duration|tenancy|period of (?:the )?lease)\b/i;

const term: SentenceRule = (t, clause) => {
  const titled = has(clause.title, TERM_TITLE);
  if (has(t, /month[- ]to[- ]month|periodic tenancy/i)) {
    // "After the term, the tenancy becomes month-to-month" does not describe the lease term.
    if (has(t, /\b(?:after|following|upon|thereafter|then|becomes?|converts?|renews?|continues?|holdover|holding over|expir\w+|end of)\b/i)) return [];
    return titled || has(t, /tenancy|this (?:lease|agreement)/i) ? [{ predicate: 'term', args: ['month_to_month'] }] : [];
  }
  if (!titled) return [];
  const dated =
    has(t, /\b(?:beginning|begins?|commenc\w+|starts?|starting|effective)\b[^.]*\b(?:ending|ends?|expir\w+|through|until|terminat\w+)\b/i) ||
    has(t, /\bfrom\b[^.]*\b(?:through|until|to)\b[^.]*\b\d{4}\b/i);
  const lengthStated =
    !has(t, /\brenew\w*|\bextension/i) &&
    has(t, /\b(?:term|lease|tenancy|period)\b[^.]*?(?:\d+\)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty-four|thirty-six|a)\s*-?\s*(?:months?|years?)\b/i);
  return dated || lengthStated ? [{ predicate: 'term', args: ['fixed'] }] : [];
};

// --- Early termination ------------------------------------------------------

const MODAL = /\b(?:may|can|shall have the (?:right|option) to|has the (?:right|option) to|is entitled to|is permitted to|is allowed to)\b/i;

const EARLY_TITLE = /\bearly\b|\blease[- ]?break\b|\bbreak(?:ing)?\b/i;
/** "Should Lessee need to break this Agreement," only restates the wish to leave; it is not a condition. */
const WISH_TO_LEAVE = /^\s*(?:should|if|in the event that|in case)\s+(?:the\s+)?(?:tenant|lessee|resident|occupant|renter)s?\s+(?:need|needs|wish|wishes|want|wants|desire|desires|elect|elects|decide|decides)\s+to\s+(?:break|end|terminate|cancel|leave)\b[^,.]*,\s*/i;

const earlyTermination: SentenceRule = (text, clause) => {
  const t = text.replace(WISH_TO_LEAVE, 'Tenant ');
  const early =
    (has(clause.title, EARLY_TITLE) && has(text, /\b(?:break|end|terminate|cancel|leave)\b[^.]*\b(?:lease|agreement|tenancy)\b/i)) ||
    has(t, /\bearly (?:termination|end|move[- ]?out|exit|release|cancellation)\b/i) ||
    has(t, /\b(?:terminate|end|cancel|break)\b[^.]*\b(?:lease|agreement|tenancy)\b[^.]*\b(?:early|before (?:it|the lease|the term|this lease|its|the end|expir)\w*|prior to (?:the )?(?:end|expir)\w*)/i);
  if (!early) return [];
  if (has(t, /\b(?:may|can) not\b|\bcannot\b|\bshall not\b|\bno right\b/i)) return [];
  // The party who "may" end the lease early must be the tenant, not the landlord.
  const modal = t.match(MODAL);
  if (!modal || modal.index === undefined) return [];
  const subject = t.slice(0, modal.index);
  if (!has(subject, TENANT) || has(subject, LANDLORD)) return [];

  const notice =
    countBefore(t, String.raw`\s+(?:calendar\s+)?days?['’]?\s*(?:prior\s+|advance\s+)?(?:written\s+)?notice`) ??
    countBefore(t, String.raw`\s+(?:calendar\s+)?days?\b`, String.raw`\bnotice\b[^.]*?\b`);
  if (notice === null) return [];
  const fee = countBefore(t, String.raw`\s+months?['’]?s?['’]?\s+rent`);
  const noFee = has(t, /\b(?:no|without|free of|waiv\w+)\s+(?:any\s+)?(?:early termination\s+)?(?:fee|penalt\w*|charge)/i);
  if (fee === null && !noFee && has(t, /\bfee\b|\bpenalt\w*|\bpay(?:ing|ment)?\b|\$|\bforfeit\w*|\bcharge\b|\bliquidated\b/i)) return [];

  const job = has(t, /(?:employer|employment|job)[^.]*(?:transfer|relocat)|(?:transfer|relocat)[^.]*(?:employer|employment|job|work)/i);
  // A condition other than a job move (deployment, illness, ...) is not "any reason" and is not in the vocabulary.
  if (!job && has(t, /^\s*(?:if|in the event|upon|when|should)\b|\b(?:if|in the event|provided that|only if|only when|solely|unless)\b/i)) return [];
  return [{ predicate: 'early_termination_option', args: [job ? 'job_relocation' : 'any', notice, fee ?? 0] }];
};

// --- Pets -------------------------------------------------------------------

/** Service and assistance animals are covered by law, not by the pet policy. */
const ASSISTANCE = /\b(?:service|assistance|support|guide|comfort)\s+(?:animals?|dogs?|cats?)\b|\bemotional[- ]support\s+(?:animals?|dogs?|cats?)\b/gi;
const PET_WORD = /\b(?:pets?|animals?|dogs?|cats?)\b/i;
const GENERIC_PET = /\b(?:pets?|animals?)\b/i;

function petPolicy(t: string): 'prohibited' | 'allowed' | 'consent_required' | null {
  if (has(t, CONSENT) && has(t, GENERIC_PET)) {
    const permits = has(t, /\bwithout\b/i) && has(t, /\b(?:may|can|are permitted|are allowed)\b/i) && !has(t, /\bnot?\b|prohibit/i);
    return permits ? 'allowed' : 'consent_required';
  }
  const noList = t.match(
    /\bno\s+((?:(?:other|additional|domestic|household|exotic)\s+)?(?:pets?|animals?|dogs?|cats?|birds?|reptiles?|rodents?|livestock|fish)(?:\s*,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+)?)+/i,
  );
  if (
    (noList && has(noList[0], GENERIC_PET)) ||
    has(t, /\b(?:pets?|animals?)\b[^.]*?\b(?:(?:are|is|shall be|will be|may be)\s+(?:strictly\s+|expressly\s+|absolutely\s+)?(?:prohibited|forbidden|banned|disallowed)|(?:are|is|shall|will|may|can)\s+not\s+(?:be\s+)?(?:permitted|allowed|welcome|kept))/i) ||
    has(t, /\b(?:shall|may|will|must|can|does|do)\s+not\s+(?:keep|have|bring|harbor|maintain|own|house|allow|permit|board)\b[^.]*\b(?:pets?|animals?)\b/i) ||
    has(t, /\b(?:agrees?|promises?)\s+not\s+to\s+(?:keep|have|bring|harbor|maintain|own)\b[^.]*\b(?:pets?|animals?)\b/i) ||
    has(t, /\bpet[- ]free\b/i)
  ) {
    return 'prohibited';
  }
  if (
    has(t, /\b(?:pets?|animals?)\b[^.]*?\b(?:are|is|shall be|will be|may be)\s+(?:generally\s+)?(?:permitted|allowed|welcome|accepted)\b/i) ||
    has(t, /\b(?:tenant|lessee|resident|occupant)s?\s+(?:may|can|is allowed to|is permitted to)\s+(?:keep|have|own|maintain|house)\b[^.]*\b(?:pets?|animals?)\b/i)
  ) {
    return 'allowed';
  }
  return null;
}

const pets: SentenceRule = (text) => {
  const t = text.replace(ASSISTANCE, ' ');
  const out: Found[] = [];
  if (has(t, PET_WORD)) {
    const policy = petPolicy(t);
    if (policy) out.push({ predicate: 'pet_policy', args: [policy] });
  }
  const perPet = t.match(new RegExp(String.raw`\bdeposit\s+of\s+${MONEY_SRC}\s*(?:per|for each|for every|for any)\s+(?:pet|animal)\b`, 'i'));
  const amount = has(t, /\b(?:pet|animal)\s+deposits?\b/i) ? moneyNear(t, String.raw`(?:pet|animal)\s+deposit`) : perPet ? toNumber(perPet[1]!) : null;
  if (amount !== null) out.push({ predicate: 'pet_deposit', args: [amount] });
  return out;
};

// --- Landlord entry ---------------------------------------------------------

const entry: SentenceRule = (t) => {
  if (!has(t, /\b(?:enter(?:s|ing)?|entry|access(?:ing)?|inspect\w*)\b/i)) return [];
  if (!has(t, /\bnotice\b|\bnotif\w*|\badvance\b|\bahead\b|\binform\w*|\bwarn\w*/i)) return [];
  // "may enter without notice in an emergency" is not a notice period.
  if (has(t, /\bemergenc/i) && !has(t, /\bexcept\b[^,.]*\bemergenc|non-?emergenc|\bother than\b[^,.]*emergenc|\bnot (?:an )?emergenc/i)) return [];
  const hours = countBefore(t, String.raw`\s+hours?\b`);
  const days = countBefore(t, String.raw`\s+days?\b`);
  if (hours !== null && days !== null && hours !== days * 24) return [];
  const total = hours ?? (days === null ? null : days * 24);
  return total === null ? [] : [{ predicate: 'entry_notice_hours', args: [total] }];
};

// --- Late fees --------------------------------------------------------------

const LATE_FEE_LABEL = String.raw`late\s+(?:fee|charge|payment\s+fee)s?`;

const lateFee: SentenceRule = (t) => {
  if (!has(t, new RegExp(`\\b${LATE_FEE_LABEL}`, 'i'))) return [];
  const out: Found[] = [];
  // A per-day or stacked fee is not one flat amount, so it is left unread.
  const stacked = has(t, /\b(?:per|each|every)\s+(?:day|week)\b|\bdaily\b|\bplus\b|\bin addition\b|\badditional\b/i);
  const amount = stacked ? null : moneyNear(t, LATE_FEE_LABEL);
  if (amount !== null) out.push({ predicate: 'late_fee', args: [amount] });
  const days =
    countBefore(t, String.raw`\s+(?:calendar\s+)?days?\b`, String.raw`(?:within|grace period of)\s+`) ??
    countBefore(t, String.raw`[- ](?:calendar[- ])?days?\s+grace`) ??
    countBefore(t, String.raw`\s+(?:calendar\s+)?days?\b`, String.raw`grace period\b[^.]*?\b`);
  if (days !== null) out.push({ predicate: 'late_fee_grace_days', args: [days] });
  return out;
};

// --- Subletting -------------------------------------------------------------

const SUBLET_SUBJECT = /\bsub-?(?:let|leas\w*|tenan\w*)|\bassign(?:s|ment|ing)?\b|\b(?:rent|let|lease)(?:ing|s)?\s+out\b|\bshort-term rental|\bairbnb/i;
const NEGATED = /\b(?:shall|may|will|must|can|could|does|do|agrees?)\s+not\b|\bnot\s+(?:to\s+)?(?:permitted|allowed)|\bno\s+(?:sub-?\w+|assign\w*)|\b(?:prohibit\w*|forbid\w*|forbidden)\b|\bcannot\b/i;

const sublet: SentenceRule = (t) => {
  if (!has(t, SUBLET_SUBJECT)) return [];
  const policy = (value: string): Found[] => [{ predicate: 'sublet_policy', args: [value] }];
  if (has(t, CONSENT)) {
    const permits = !has(t, NEGATED) && has(t, /\bwithout\b/i) && has(t, /\b(?:may|can|is permitted|are permitted|allowed)\b/i);
    return policy(permits ? 'allowed' : 'consent_required');
  }
  if (has(t, NEGATED)) return policy('prohibited');
  if (
    has(t, /\b(?:tenant|lessee|resident|occupant)s?\s+(?:may|can|is permitted to|is allowed to)\s+(?:sub-?\w+|assign|rent out|let out)/i) ||
    has(t, /\b(?:sub-?(?:letting|leasing)|assignment)\s+(?:is|are)\s+(?:permitted|allowed)/i)
  ) {
    return policy('allowed');
  }
  return [];
};

// --- Repair and deduct ------------------------------------------------------

const repairWaiver: SentenceRule = (t) =>
  has(t, /\bwaive[sd]?\b[^.]*\b(?:repairs?|deduct\w*)\b[^.]*\bdeduct/i) ||
  has(t, /\b(?:shall|may|will|can)\s+not\b[^.]*\b(?:repairs?|fix)\b[^.]*\bdeduct\w*\b[^.]*\brent\b/i) ||
  has(t, /\bno\s+(?:right|remedy|self-help)\b[^.]*\b(?:repairs?|deduct\w*)\b[^.]*\b(?:deduct|rent)/i) ||
  has(t, /\b(?:waive[sd]?|waiver)\b[^.]*\brepair[- ]and[- ]deduct\b|\brepair[- ]and[- ]deduct\b[^.]*\b(?:waived|not (?:available|permitted|allowed))/i)
    ? [{ predicate: 'repair_deduct_waiver', args: [] }]
    : [];

// --- Rent increases ---------------------------------------------------------

const escalation: SentenceRule = (t) => {
  if (!has(t, /\brent\b/i) || !has(t, /\b(?:increas\w*|rais\w*|escalat\w*|adjust\w*|go(?:es)? up)\b/i)) return [];
  if (has(t, /\blate\b|\bfee\b|\bdeposit\b|\binterest\b/i)) return [];
  if (has(t, /\b(?:shall|will|may|can)\s+not\s+(?:be\s+)?(?:increas|rais|chang|adjust)|\bnot\s+(?:be\s+)?(?:increased|raised|changed|adjusted)|\bno\s+(?:rent\s+)?increase/i)) return [];
  const values = new Set<number>();
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|per ?cent)/gi)) values.add(Number(m[1]));
  for (const m of t.matchAll(/\b([a-z]+(?:-[a-z]+)?)\s+(?:per ?cent)/gi)) {
    const n = wordNumber(m[1]!);
    if (n !== null) values.add(n);
  }
  const only = values.size === 1 ? [...values][0]! : null;
  return only === null ? [] : [{ predicate: 'rent_escalation_percent', args: [only] }];
};

const RULES: readonly SentenceRule[] = [rent, deposit, term, earlyTermination, pets, entry, lateFee, sublet, repairWaiver, escalation];

export type { Sentence };
