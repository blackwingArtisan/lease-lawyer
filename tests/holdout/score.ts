/**
 * Scores a lease reader and the prover against the holdout answer key.
 *
 * The functions are passed in rather than imported, so the same scoring runs
 * against today's source and against an earlier version of it (see
 * scripts/eval.mjs). Only the parts of the API that every version shares are
 * used.
 */

export interface HoldoutLease {
  id: string;
  file: string;
  name: string;
  /** Every fact the lease states, as `predicate(arg,...)`, or the bare predicate when it has no arguments. */
  facts: string[];
  /** Predicates a clause speaks to without stating a value. */
  alsoCovers: string[];
}

export interface AnswerKey {
  about: string;
  leases: HoldoutLease[];
}

interface Fact {
  predicate: string;
  args: (string | number)[];
}

interface Step {
  kind: string;
  prolog?: string;
}

interface Answer {
  verdict: string;
  headline: string;
  steps: Step[];
  unread?: unknown[];
}

/** The slice of the app's API the scorer uses. */
export interface ReaderApi {
  parseLease(id: string, text: string): unknown;
  extractFacts(lease: never): unknown[];
  verifyFacts(lease: never, candidates: never[]): { facts: Fact[]; unread?: unknown[] };
  ask(input: { topic: string; facts: never[]; tenant: never[]; unread?: never[] }): Promise<Answer>;
  TOPICS: readonly { id: string }[];
}

export interface TopicScore {
  topic: string;
  verdict: string;
  headline: string;
  /** Predicates the proof called absent although the lease covers them. Only counted for a Yes or No. */
  falseSilence: string[];
  cantTell: boolean;
}

export interface LeaseScore {
  id: string;
  name: string;
  factsExpected: number;
  factsRead: number;
  missedFacts: string[];
  /** Facts the reader kept that the lease does not state. */
  wrongFacts: string[];
  topics: TopicScore[];
  /** Yes or No answers resting on the lease being silent about something it covers. */
  falselySilent: number;
  cantTell: number;
}

export const factKey = (f: Fact): string => (f.args.length ? `${f.predicate}(${f.args.join(',')})` : f.predicate);

const predicateOf = (key: string): string => key.replace(/\(.*$/, '');

export async function scoreLease(api: ReaderApi, entry: HoldoutLease, text: string): Promise<LeaseScore> {
  const lease = api.parseLease(entry.id, text) as never;
  const result = api.verifyFacts(lease, api.extractFacts(lease) as never[]);
  const read = new Set(result.facts.map(factKey));
  const expected = new Set(entry.facts);
  const covered = new Set([...entry.facts.map(predicateOf), ...entry.alsoCovers]);

  const topics: TopicScore[] = [];
  for (const { id } of api.TOPICS) {
    const answer = await api.ask({
      topic: id,
      facts: result.facts as never[],
      tenant: [],
      unread: (result.unread ?? []) as never[],
    });
    const decided = answer.verdict === 'yes' || answer.verdict === 'no';
    const falseSilence = decided
      ? answer.steps
          .filter((s) => s.kind === 'absent')
          .map((s) => /^absent\(([a-z_]+)/.exec(s.prolog ?? '')?.[1] ?? '')
          .filter((p) => covered.has(p))
      : [];
    topics.push({
      topic: id,
      verdict: answer.verdict,
      headline: answer.headline,
      falseSilence: [...new Set(falseSilence)],
      cantTell: answer.verdict === 'unknown' && (answer.unread?.length ?? 0) > 0,
    });
  }

  return {
    id: entry.id,
    name: entry.name,
    factsExpected: expected.size,
    factsRead: [...expected].filter((k) => read.has(k)).length,
    missedFacts: [...expected].filter((k) => !read.has(k)),
    wrongFacts: [...read].filter((k) => !expected.has(k)),
    topics,
    falselySilent: topics.filter((t) => t.falseSilence.length > 0).length,
    cantTell: topics.filter((t) => t.cantTell).length,
  };
}
