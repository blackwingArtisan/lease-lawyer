import { sentences } from './parse';
import type { ParsedLease, ReaderDirectedSpan, UnreadClause } from './types';

/**
 * The coverage check. It does not read facts; it notices where a reader may
 * have missed one. For each predicate it holds cue words. When a clause
 * contains a predicate's cue words and no verified fact for that predicate
 * comes from that clause, the predicate is "unread" for that clause. The
 * logic engine then refuses to treat the lease as silent about it.
 *
 * It looks only at the lease text and the verified facts, so it behaves the
 * same for the local reader and the Bedrock reader.
 */
interface CueSpec {
  predicate: string;
  /** What the clause is about, in a few words, for the "can't tell" answer. */
  subject: string;
  /** Matched against the clause heading and against each sentence. */
  cue: RegExp;
  /** Matched against the clause heading only. */
  titleCue?: RegExp;
  /** Removed from the text before cue and needs are tested. */
  strip?: RegExp;
  /** A sentence that matches this does not count as a cue. */
  ignore?: RegExp;
  /** The clause must also match this (heading plus sentences) for the cue to count. */
  needs?: RegExp;
}

const PET_ASSISTANCE = /\b(?:service|assistance|support|guide|comfort)\s+(?:animals?|dogs?|cats?)\b|\bemotional[- ]support\s+(?:animals?|dogs?|cats?)\b/gi;
const PET_DEPOSIT = /\b(?:pet|animal)\s+deposits?\b/gi;
const LATE_FEE_CUE = /\blate\s+(?:fees?|charges?|payment\s+fees?|penalt(?:y|ies))\b|\b(?:penalty|charge|fee)\s+for\s+late\b/i;
const ORDINAL = String.raw`(?:\d{1,2}(?:st|nd|rd|th)|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|fifteenth|twentieth)\b)`;
/** A day of the month or a count of days that says when late starts. */
const LATE_DAY_REF = new RegExp(
  String.raw`\b(?:after|past|beyond|on|by|before|until|following)\s+(?:the\s+)?${ORDINAL}` +
    String.raw`|\b(?:after|past|beyond)\s+(?:the\s+)?\w+(?:\s+\(\d+\w*\))?\s+day\b` +
    String.raw`|\b(?:\w+\s+(?:\(\d+\)\s+)?|\d+\s+)days?\s+(?:late|overdue|past|after|beyond)\b` +
    String.raw`|\b(?:day|days)\s+of\s+the\s+month\b`,
  'i',
);
const NUMBER_WORDS = String.raw`one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|ninety`;

export const CUES: readonly CueSpec[] = [
  {
    predicate: 'monthly_rent',
    subject: 'the monthly rent',
    cue: /\bmonthly rent\b|\brent\b[^.$]{0,30}\$|\$\s?[\d,.]+\s*(?:per|a|each|every|\/)\s*month\b|\brent\s+(?:is|shall be|will be|equals)\s+\$|\brent of\b|\brent in the amount\b/i,
    ignore: /\b(?:late|deposit|fee|charge|increas\w*|rais\w*)\b/i,
  },
  {
    predicate: 'security_deposit',
    subject: 'the security deposit',
    cue: /\bdeposit\b|\bas\s+(?:a\s+|the\s+)?(?:security|surety)\b|\bsecurity\s+(?:of|in the amount of)\s+\$/i,
    strip: PET_DEPOSIT,
  },
  {
    predicate: 'deposit_deduction',
    subject: 'what may be deducted from the deposit',
    // "Non-refundable" and "forfeit" say what happens to the deposit, so a clause with them is never silent.
    cue: /\b(?:deduct\w*|withh[eo]ld\w*|forfeit\w*|retain\w*)\b|wear (?:and|&) tear|\b(?:ordinary|normal|reasonable) wear\b|\bapply\w*\b[^.]*\b(?:deposit|security)\b[^.]*\b(?:damage|wear)\b|\bnon-?refundable\b|\bnot\s+(?:be\s+)?refund(?:able|ed)\b/i,
    needs: /\bdeposit\b|\bsecurity\b/i,
    strip: PET_DEPOSIT,
  },
  {
    predicate: 'term',
    subject: 'the length of the lease',
    cue: /month[- ]to[- ]month|\bperiodic tenancy\b|\b(?:beginning|begins?|commenc\w+|starts?|starting)\b[^.]*\b(?:ending|ends?|expir\w+|terminat\w+|through|until)\b|\b(?:runs?|running)\b[^.]*\b(?:through|until|months?|years?)\b/i,
    titleCue: /\b(?:term|lease term|lease period|length of (?:the )?lease|lease length|duration|tenancy|period of (?:the )?lease)\b/i,
  },
  {
    predicate: 'early_termination_option',
    subject: 'ending the lease early',
    cue: /\bearly (?:termination|end|move[- ]?out|exit|release|cancellation)\b|\b(?:terminate|end|cancel|break)\b[^.]*\b(?:lease|agreement|tenancy)\b[^.]*\b(?:early|before (?:it|the lease|the term|this lease|its|the end|expir)\w*|prior to (?:the )?(?:end|expir)\w*)|\b(?:lease|buy)[- ]?(?:break|out)\b|\bbreak(?:ing)?\s+(?:this|the|your)\s+(?:lease|agreement)\b/i,
  },
  {
    predicate: 'pet_policy',
    subject: 'pets',
    cue: /\b(?:pets?|animals?|dogs?|cats?|puppy|puppies|kittens?|ferrets?|reptiles?|livestock)\b/i,
    strip: PET_ASSISTANCE,
  },
  {
    predicate: 'pet_deposit',
    subject: 'a pet deposit',
    cue: /\b(?:pet|animal)\s+(?:deposits?|fees?|rent)\b|\bdeposit\b[^.]*\b(?:pets?|animals?)\b/i,
  },
  {
    predicate: 'entry_notice_hours',
    subject: 'landlord entry',
    cue: /\b(?:enter(?:s|ing)?|entry|access(?:ing)?|inspect\w*)\b/i,
    // A clause that names no time at all ("reasonable notice") gives nothing to read.
    // "At any time" and "without notice" name a time too: none at all.
    needs: new RegExp(
      String.raw`\d|\b(?:${NUMBER_WORDS}|hours?|days?|overnight|week)\b|\bat\s+any\s+(?:time|hour)\b|\banytime\b|\bwhenever\b|\bwithout\s+(?:any\s+|prior\s+|advance\s+)?(?:notice|warning)\b`,
      'i',
    ),
  },
  {
    predicate: 'late_fee',
    subject: 'late fees',
    cue: LATE_FEE_CUE,
  },
  {
    predicate: 'late_fee_grace_days',
    subject: 'the grace period for late fees',
    cue: new RegExp(String.raw`\bgrace\b|\bnot (?:received|paid|made|postmarked)\b|\bafter (?:the )?due date\b|\bby the (?:\w+ )?day\b|\bwithin\b[^.]*\b(?:days?|due)\b|` + LATE_DAY_REF.source, 'i'),
    needs: LATE_FEE_CUE,
  },
  {
    predicate: 'sublet_policy',
    subject: 'subletting',
    cue: /\bsub-?(?:let|leas\w*|tenan\w*)|\bassign(?:s|ment|ing)?\b|\b(?:rent|let|lease)(?:ing|s)?\s+out\b|\bshort-term rental|\bairbnb/i,
  },
  {
    predicate: 'repair_deduct_waiver',
    subject: 'repair and deduct',
    cue: /\bwaive[sd]?\b[^.]*\b(?:repairs?|deduct\w*)\b|\brepair[- ]and[- ]deduct\b|\bdeduct\w*\b[^.]*\brepairs?\b[^.]*\brent\b|\brepairs?\b[^.]*\bdeduct\w*\b[^.]*\brent\b|\bwithhold\w*\b[^.]*\brent\b/i,
  },
  {
    predicate: 'rent_escalation_percent',
    subject: 'rent increases',
    cue: /\brent\b[^.]*\b(?:increases?|increased|raise[sd]?|raising|escalat\w*|adjust\w*|go(?:es)? up)\b|\b(?:increase[sd]?|rais(?:e|es|ed|ing)|escalat\w*|adjust\w*)\b[^.]*\brent\b/i,
    // "Rent shall not increase" states no increase, so there is nothing to read.
    ignore: /\b(?:shall|will|may|can)\s+not\s+(?:be\s+)?(?:increas|rais|chang|adjust)|\bnot\s+(?:be\s+)?(?:increased|raised|changed|adjusted)|\bno\s+(?:rent\s+)?increase|\blate\b|\bfee\b|\bdeposit\b/i,
  },
];

/** A clause that sends the reader to another document ("see Rider B", "governed by Schedule A") says something, just not here. */
const ELSEWHERE = /\b(?:schedule|rider|exhibit|addendum|attachment|appendix)\s+(?:[A-Z]|\d{1,2})\b/i;

const SUBJECTS = new Map(CUES.map((c) => [c.predicate, c.subject]));
const CUE_BY_PREDICATE = new Map(CUES.map((c) => [c.predicate, c]));

/** A few words naming what a predicate is about, e.g. "pets" for pet_policy. */
export function cueSubject(predicate: string): string {
  return SUBJECTS.get(predicate) ?? predicate;
}

/**
 * True when a clause heading has the predicate's cue words or its `titleCue`.
 * The extractor reads some facts from sentences whose heading supplies the
 * topic ("SECURITY. Owner may apply the security to damage ..."), as the
 * coverage check does, so the verifier's cross-check accepts that too.
 */
export function cueMatchesHeading(predicate: string, title: string): boolean {
  const spec = CUE_BY_PREDICATE.get(predicate);
  if (!spec) return false;
  const clean = spec.strip ? title.replace(spec.strip, ' ') : title;
  return cueMatches(predicate, title) || (spec.titleCue?.test(clean) ?? false);
}

/**
 * True when `text` (one sentence or a clause heading) has the predicate's cue
 * words, after the predicate's `strip` is removed and unless its `ignore`
 * matches. `needs` is not applied, because a clause heading may supply it.
 * A predicate with no cue entry never matches. The coverage check and the
 * verifier's cross-check both use this, so they cannot drift apart.
 */
export function cueMatches(predicate: string, text: string): boolean {
  const spec = CUE_BY_PREDICATE.get(predicate);
  if (!spec) return false;
  const clean = spec.strip ? text.replace(spec.strip, ' ') : text;
  return spec.cue.test(clean) && !(spec.ignore?.test(clean) ?? false);
}

/** What the reader got from each clause: the predicate and the clause it was read from. */
export interface CoveredFact {
  predicate: string;
  clauseId: string;
}

/**
 * Returns every (predicate, clause) pair where the clause has the predicate's
 * cue words but no verified fact for that predicate came from it.
 */
export function findUnread(lease: ParsedLease, covered: readonly CoveredFact[], readerDirected: readonly ReaderDirectedSpan[] = []): UnreadClause[] {
  const read = new Set(covered.map((f) => `${f.predicate}@${f.clauseId}`));
  const out: UnreadClause[] = [];
  for (const clause of lease.clauses) {
    const parts = sentences(lease, clause).map((s) => s.text);
    for (const spec of CUES) {
      if (read.has(`${spec.predicate}@${clause.id}`)) continue;
      const clean = (text: string) => (spec.strip ? text.replace(spec.strip, ' ') : text);
      const whole = clean([clause.title, ...parts].join(' '));
      if (spec.needs && !spec.needs.test(whole) && !ELSEWHERE.test(whole)) continue;
      const hit =
        (spec.titleCue?.test(clean(clause.title)) ?? false) ||
        [clause.title, ...parts].some((text) => cueMatches(spec.predicate, text));
      if (hit) out.push({ predicate: spec.predicate, clauseId: clause.id, number: clause.number, title: clause.title });
    }
  }
  return markReaderDirected(lease, out, readerDirected);
}

/**
 * Second pass: a reader-directed sentence with a predicate's cue words makes
 * that predicate unread for its clause, whether or not another sentence of the
 * clause has a kept fact and whether or not any reader proposed one. An entry
 * the first pass already made for the same clause is marked, not duplicated.
 * Unread only blocks "the lease is silent" proofs; it never weakens a proof
 * that rests on a kept fact.
 */
function markReaderDirected(lease: ParsedLease, unread: UnreadClause[], spans: readonly ReaderDirectedSpan[]): UnreadClause[] {
  if (spans.length === 0) return unread;
  const out = unread.map((u) => ({ ...u }));
  for (const span of spans) {
    const clause = lease.clauses.find((c) => c.id === span.clauseId);
    if (!clause) continue;
    for (const spec of CUES) {
      const titleHit = span.rule === 'heading' && (spec.titleCue?.test(clause.title) ?? false);
      if (!titleHit && !cueMatches(spec.predicate, span.text)) continue;
      const existing = out.find((u) => u.predicate === spec.predicate && u.clauseId === clause.id);
      if (existing) existing.readerDirected = true;
      else out.push({ predicate: spec.predicate, clauseId: clause.id, number: clause.number, title: clause.title, readerDirected: true });
    }
  }
  return out.sort((a, b) => a.number - b.number || CUES.findIndex((c) => c.predicate === a.predicate) - CUES.findIndex((c) => c.predicate === b.predicate));
}
