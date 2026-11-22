import { createHash } from 'node:crypto';
import { extractFacts } from '../../src/lease/extract';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import { parseLease } from '../../src/lease/parse';
import { verifyFacts } from '../../src/lease/verify';
import { ask } from '../../src/logic/ask';
import type { TenantAnswer } from '../../src/logic/program';
import { TOPICS } from '../../src/logic/topics';
import { TENANT_FACTS } from '../../src/lease/vocabulary';

/** The four samples that existed before the possessed-lease feature. */
export const GOLDEN_SAMPLE_IDS = ['wychwood-arms', 'gaslight-row', 'cobweb-court', 'hollowmere-flats'] as const;

export const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);

/** Every tenant-answer set the golden covers: none, all yes, all no, and each fact alone as yes and as no. */
export function tenantCombos(): { label: string; tenant: TenantAnswer[] }[] {
  const names = TENANT_FACTS.map((t) => t.name);
  const all = (value: boolean) => names.map((name) => ({ name, value, source: 'answer' as const }));
  const combos = [
    { label: 'none', tenant: [] as TenantAnswer[] },
    { label: 'all-yes', tenant: all(true) },
    { label: 'all-no', tenant: all(false) },
  ];
  for (const name of names) {
    combos.push({ label: `+${name}`, tenant: [{ name, value: true, source: 'answer' }] });
    combos.push({ label: `-${name}`, tenant: [{ name, value: false, source: 'answer' }] });
  }
  return combos;
}

export interface SampleGolden {
  /** Kept facts as `id predicate(args)@clause start-end`. */
  facts: string[];
  factsDigest: string;
  /** Unread entries as `predicate@clause`. */
  unread: string[];
  rejected: number;
  /** One letter per tenant combination (y, n, ?) for each topic. */
  verdicts: Record<string, string>;
  /** Digest of every answer's verdict, headline, steps, missing facts and paths for each topic. */
  answers: Record<string, string>;
}

/** Computes the golden for one sample from live code. Uses the same calls as the app. */
export async function sampleGolden(id: string): Promise<SampleGolden> {
  const s = SAMPLE_LEASES.find((l) => l.id === id);
  if (!s) throw new Error(`no sample ${id}`);
  const lease = parseLease(s.id, s.text, s.name);
  const { facts, unread, rejected } = verifyFacts(lease, extractFacts(lease));
  const verdicts: Record<string, string> = {};
  const answers: Record<string, string> = {};
  for (const topic of TOPICS) {
    let letters = '';
    const parts: unknown[] = [];
    for (const { label, tenant } of tenantCombos()) {
      const a = await ask({ topic: topic.id, facts, tenant, unread });
      letters += a.verdict === 'yes' ? 'y' : a.verdict === 'no' ? 'n' : '?';
      parts.push([label, a.verdict, a.headline, a.steps, a.missing, a.paths, a.conflict]);
    }
    verdicts[topic.id] = letters;
    answers[topic.id] = digest(parts);
  }
  return {
    facts: facts.map((f) => `${f.id} ${f.predicate}(${f.args.join(',')})@${f.clauseId} ${f.start}-${f.end}`),
    factsDigest: digest(facts),
    unread: unread.map((u) => `${u.predicate}@${u.clauseId}`),
    rejected: rejected.length,
    verdicts,
    answers,
  };
}
