// The Bedrock smoke run, without the network: read each lease with an injected reader,
// verify what it proposed exactly as the app does, score the holdout leases against their
// answer key, and price each call. tools/smoke-bedrock/smoke.ts wires in the real reader.
import type { BedrockReading } from '../../src/adapters/bedrock';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import type { CandidateFact, LeaseFact, UnreadClause } from '../../src/lease/types';
import { verifyFacts } from '../../src/lease/verify';
import { ask } from '../../src/logic/ask';
import { TOPICS } from '../../src/logic/topics';
import { factKey, scoreLease, type HoldoutLease, type ReaderApi } from '../../tests/holdout/score';

export interface SmokeLease {
  id: string;
  name: string;
  text: string;
  /** Present for the holdout leases, which have an answer key. */
  key?: HoldoutLease;
}

/** US dollars per million tokens. */
export interface Prices {
  inputPerMTok: number;
  outputPerMTok: number;
  basis: string;
}

export interface SmokeRecord {
  label: string;
  recordedAt: string;
  model: string;
  lease: { id: string; name: string };
  proposed: number;
  kept: { fact: string; clauseId: string; quote: string }[];
  /** Proposed facts the verifier struck from the record, with its reason. */
  struck: { fact: string; clauseId: string; quote: string; reason: string }[];
  unread: UnreadClause[];
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  priceBasis: string;
  /** For a holdout lease: the same measures `npm run eval` reports for the local reader. */
  holdout?: { factsRead: number; factsExpected: number; wrongFacts: string[]; falselySilent: number; cantTell: number };
  /** Facts the local reader keeps on the same lease, for comparison. */
  localReaderFacts: number;
}

export interface SmokeResult {
  records: SmokeRecord[];
  /** Leases not read because the next call could have taken the run past the spending cap. */
  skipped: string[];
  totalUsd: number;
}

/** Rough upper estimate of one call, used only to stop before the cap: about 3.5 characters a token, 4,000 output tokens. */
export function estimateUsd(lease: SmokeLease, systemChars: number, prices: Prices): number {
  const inputTokens = (lease.text.length + systemChars) / 3.5;
  return (inputTokens * prices.inputPerMTok + 4000 * prices.outputPerMTok) / 1e6;
}

export const costUsd = (usage: BedrockReading['usage'], prices: Prices) =>
  (usage.inputTokens * prices.inputPerMTok + usage.outputTokens * prices.outputPerMTok) / 1e6;

export const recordedLabel = (at: Date) => `Claude on Amazon Bedrock, recorded ${at.toISOString().slice(0, 10)}`;

export async function runSmoke(options: {
  leases: SmokeLease[];
  read: (lease: ReturnType<typeof parseLease>) => Promise<BedrockReading>;
  prices: Prices;
  maxUsd: number;
  systemChars: number;
  now?: () => Date;
  onRecord?: (record: SmokeRecord) => void;
}): Promise<SmokeResult> {
  const { leases, read, prices, maxUsd, systemChars, now = () => new Date(), onRecord } = options;
  const records: SmokeRecord[] = [];
  const skipped: string[] = [];
  let totalUsd = 0;

  for (const entry of leases) {
    if (totalUsd + estimateUsd(entry, systemChars, prices) > maxUsd) {
      skipped.push(entry.id);
      continue;
    }
    const lease = parseLease(entry.id, entry.text, entry.name);
    const reading = await read(lease);
    const verified = verifyFacts(lease, reading.facts);
    const cost = costUsd(reading.usage, prices);
    totalUsd += cost;
    const at = now();

    let holdout: SmokeRecord['holdout'];
    if (entry.key) {
      // Score the recorded reading with the same scorer as npm run eval, by handing it the model's candidates.
      const api = { parseLease, extractFacts: () => reading.facts, verifyFacts, ask, TOPICS } as unknown as ReaderApi;
      const s = await scoreLease(api, entry.key, entry.text);
      holdout = { factsRead: s.factsRead, factsExpected: s.factsExpected, wrongFacts: s.wrongFacts, falselySilent: s.falselySilent, cantTell: s.cantTell };
    }

    const record: SmokeRecord = {
      label: recordedLabel(at),
      recordedAt: at.toISOString(),
      model: reading.model,
      lease: { id: entry.id, name: entry.name },
      proposed: reading.facts.length,
      kept: verified.facts.map((f: LeaseFact) => ({ fact: factKey(f), clauseId: f.clauseId, quote: f.quote })),
      struck: verified.rejected.map(({ candidate, reason }: { candidate: CandidateFact; reason: string }) => ({
        fact: factKey(candidate),
        clauseId: candidate.clauseId,
        quote: candidate.quote,
        reason,
      })),
      unread: verified.unread,
      usage: reading.usage,
      costUsd: Number(cost.toFixed(6)),
      priceBasis: prices.basis,
      holdout,
      localReaderFacts: verifyFacts(lease, extractFacts(lease)).facts.length,
    };
    records.push(record);
    onRecord?.(record);
  }
  return { records, skipped, totalUsd };
}

/** The Markdown summary written beside the recorded readings. */
export function summaryMarkdown(result: SmokeResult, region: string): string {
  const rows = result.records.map((r) => {
    const h = r.holdout ? `${r.holdout.factsRead} of ${r.holdout.factsExpected} facts, ${r.holdout.falselySilent} falsely silent` : '';
    return `| ${r.lease.name} | ${r.proposed} | ${r.kept.length} | ${r.struck.length} | ${r.unread.length} | ${r.localReaderFacts} | ${h} | ${r.usage.inputTokens} / ${r.usage.outputTokens} | $${r.costUsd.toFixed(4)} |`;
  });
  const first = result.records[0];
  const lines = [
    '# Bedrock smoke run',
    '',
    first ? `${first.label}. Model \`${first.model}\` in \`${region}\`. Prices: ${first.priceBasis}.` : 'No lease was read.',
    '',
    '| Lease | Proposed | Kept | Struck | Unread clauses | Local reader keeps | Holdout score | Tokens in / out | Cost |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Total: $${result.totalUsd.toFixed(4)}.${result.skipped.length ? ` Skipped to stay under the cap: ${result.skipped.join(', ')}.` : ''}`,
  ];
  const struck = result.records.flatMap((r) => r.struck.map((s) => `- ${r.lease.name}, ${s.clauseId}: \`${s.fact}\` quoting "${s.quote}" (${s.reason})`));
  if (struck.length) lines.push('', '## Struck from the record', '', ...struck);
  return lines.join('\n') + '\n';
}
