import type { TenantAnswer } from '../logic/program';

export interface Translation {
  /** Topic id from TOPICS, or null when no rule covers the question. */
  topic: string | null;
  /** Facts about the tenant stated in the question itself. */
  tenant: TenantAnswer[];
}

type Pattern = [RegExp, number];

/** Weighted keyword patterns per topic. The highest total wins. */
const TOPIC_PATTERNS: Record<string, Pattern[]> = {
  wear_and_tear: [
    [/wear[- ]and[- ]tear/i, 4],
    [/\bdeposit\b/i, 2],
    [/\b(?:repaint|carpet|scuff|nail holes?|cleaning fee)/i, 2],
    [/\b(?:keep|deduct|withhold|take)\b[^?]*\bdeposit/i, 2],
    [/\b(?:get|getting|receive|see)\b[^?]*\bdeposit\b[^?]*\bback\b|\bdeposit back\b|\breturn (?:of )?(?:my|the|our) deposit\b/i, 3],
  ],
  early_termination: [
    [/break (?:my|the|our) lease/i, 5],
    [/\b(?:end|terminate|cancel|leave|get out of)\b[^?]*\b(?:lease|early)/i, 3],
    [/\bmove out early\b|\bearly termination\b/i, 4],
    [/\b(?:transferr?ed|relocat\w*|deploy\w*|military orders)\b/i, 2],
  ],
  pets: [
    [/\b(?:pets?|dogs?|cats?|puppy|kitten|animals?|ferrets?|birds?|rabbits?|parrots?|(?:gold)?fish|hamsters?|gerbils?|guinea pigs?|snakes?|lizards?|turtles?|reptiles?)\b/i, 4],
    [/\b(?:emotional support|service animal|assistance animal|esa)\b/i, 3],
  ],
  entry_without_notice: [
    [/\b(?:enter|entry|come in(?:to)?|let (?:him|her|them)self in|walk in|show up|inspect\w*)\b/i, 4],
    [/\b(?:without (?:notice|telling|warning|asking))\b/i, 2],
  ],
  late_fee: [
    [/\blate (?:fee|charge|penalty)s?\b/i, 5],
    [/\b(?:pay(?:ing)? (?:rent )?late|rent is late|late on rent)\b/i, 4],
  ],
  sublet: [
    [/\bsub-?(?:let|lease|letting|leasing|tenant)\b/i, 5],
    [/\b(?:airbnb|short-term rental|rent (?:out )?my (?:room|apartment|place))\b/i, 4],
  ],
  repair_and_deduct: [
    [/\b(?:repair|fix|broken|not working|won'?t fix|doesn'?t fix|ignores?)\b/i, 2],
    [/\b(?:deduct|withhold|take)\b[^?]*\brent\b/i, 3],
    [/\brepair and deduct\b/i, 5],
    [/\b(?:heat|heater|furnace|hot water|no water|plumbing|toilet|electric\w*|power|sewage|mold)\b/i, 2],
  ],
  rent_increase: [
    [/\b(?:raise|increase|hike|bump|jack up)\b[^?]*\brent\b/i, 5],
    [/\brent\b[^?]*\b(?:increase|go up|goes up|raised|higher)\b/i, 5],
  ],
};

const TENANT_PATTERNS: Array<[string, RegExp, RegExp?]> = [
  ['job_transfer', /\b(?:transferr?(?:ed|ing)?|relocat\w*|new job|job offer|company is moving|employer is moving)\b/i, /\bnot (?:being )?(?:transferred|relocat\w*)/i],
  ['military_orders', /\b(?:military|deploy\w*|pcs|active[- ]duty|orders)\b/i, /\bnot (?:in the )?(?:military|on (?:military )?orders)/i],
  ['assistance_animal', /\b(?:emotional support|esa|service (?:dog|animal)|assistance animal)\b/i, /\bnot (?:an? )?(?:emotional support|service|assistance)/i],
  ['emergency', /\b(?:emergency|fire|flood\w*|burst|gas leak|smoke|sparking)\b/i, /\bnot an emergency\b|\bno emergency\b/i],
  ['essential_repair', /\b(?:heat|heater|heating|furnace|hot water|no water|plumbing|toilet|electric\w*|power|sewage|gas)\b/i],
  ['written_notice', /\b(?:in writing|written notice|wrote (?:to|a letter)|sent (?:a |an )?(?:letter|email)|emailed)\b/i, /\b(?:haven'?t|have not|didn'?t|did not) (?:told|tell|written|write|sent|send|emailed|email)/i],
];

/**
 * Free, rule-based question translator: maps a plain-English question to one
 * topic and to any tenant facts the question states outright.
 */
export function classifyQuestion(question: string): Translation {
  const scores = Object.entries(TOPIC_PATTERNS).map(([topic, patterns]) => ({
    topic,
    score: patterns.reduce((sum, [re, w]) => sum + (re.test(question) ? w : 0), 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const topic = best && best.score >= 3 ? best.topic : null;

  const tenant: TenantAnswer[] = [];
  for (const [name, yes, no] of TENANT_PATTERNS) {
    if (no?.test(question)) tenant.push({ name, value: false, source: 'question' });
    else if (yes.test(question)) tenant.push({ name, value: true, source: 'question' });
  }
  return { topic, tenant };
}
