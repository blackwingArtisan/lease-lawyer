import { describe, expect, it } from 'vitest';
import type { BedrockReading } from '../../src/adapters/bedrock';
import { extractFacts } from '../../src/lease/extract';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import type { ParsedLease } from '../../src/lease/types';
import { costUsd, recordedLabel, runSmoke, summaryMarkdown, type Prices, type SmokeLease } from '../../tools/smoke-bedrock/run';
import key from '../holdout/answer-key.json';
import holdoutA from '../holdout/holdout-a-thornbury.txt?raw';
import type { AnswerKey } from '../holdout/score';

const prices: Prices = { inputPerMTok: 4, outputPerMTok: 20, basis: 'test prices' };
const usage = { inputTokens: 3000, outputTokens: 1000 };
const at = new Date('2026-11-20T12:00:00Z');

/** A stand-in for Bedrock: proposes what the local reader reads, plus one fact with a made-up quote. */
async function stubRead(lease: ParsedLease): Promise<BedrockReading> {
  const facts = extractFacts(lease);
  const first = lease.clauses[0]!;
  facts.push({ predicate: 'pet_policy', args: ['allowed'], clauseId: first.id, quote: 'Cats and dogs are always welcome here.' });
  return { facts, model: 'anthropic.claude-opus-5-5', usage };
}

const cobweb = SAMPLE_LEASES.find((s) => s.id === 'cobweb-court')!;
const holdout: SmokeLease = { id: 'holdout-a', name: 'Lease A', text: holdoutA, key: (key as AnswerKey).leases[0] };

describe('Bedrock smoke run (reader stubbed, no network)', () => {
  it('strikes a proposed fact whose quote is not in the lease and records why', async () => {
    const { records } = await runSmoke({ leases: [cobweb], read: stubRead, prices, maxUsd: 1, systemChars: 2000, now: () => at });
    const [r] = records;
    expect(r!.label).toBe('Claude on Amazon Bedrock, recorded 2026-11-20');
    expect(r!.struck).toEqual([expect.objectContaining({ fact: 'pet_policy(allowed)', reason: 'quote not found in section 1' })]);
    expect(r!.proposed).toBe(r!.kept.length + 1);
    expect(r!.localReaderFacts).toBe(r!.kept.length);
  });

  it('scores a holdout reading with the eval scorer', async () => {
    const { records } = await runSmoke({ leases: [holdout], read: stubRead, prices, maxUsd: 1, systemChars: 2000, now: () => at });
    expect(records[0]!.holdout).toEqual({ factsRead: 10, factsExpected: 10, wrongFacts: [], falselySilent: 0, cantTell: 1 });
  });

  it('prices each call from its token usage and stops before the cap', async () => {
    expect(costUsd(usage, prices)).toBeCloseTo(0.032, 6);
    const result = await runSmoke({ leases: [cobweb, holdout], read: stubRead, prices, maxUsd: 0.09, systemChars: 2000, now: () => at });
    expect(result.records.map((r) => r.lease.id)).toEqual(['cobweb-court']);
    expect(result.skipped).toEqual(['holdout-a']);
    expect(result.totalUsd).toBeCloseTo(0.032, 6);
  });

  it('writes a summary that lists every struck quote', async () => {
    const result = await runSmoke({ leases: [cobweb], read: stubRead, prices, maxUsd: 1, systemChars: 2000, now: () => at });
    const md = summaryMarkdown(result, 'us-east-1');
    expect(md).toContain(recordedLabel(at));
    expect(md).toContain('## Struck from the record');
    expect(md).toContain('Cats and dogs are always welcome here.');
  });
});
