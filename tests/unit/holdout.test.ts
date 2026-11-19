import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import { checkArgs, predicateSpec } from '../../src/lease/vocabulary';
import { verifyFacts } from '../../src/lease/verify';
import { ask } from '../../src/logic/ask';
import { TOPICS } from '../../src/logic/topics';
import key from '../holdout/answer-key.json';
import { scoreLease, type AnswerKey, type ReaderApi } from '../holdout/score';

const api = { parseLease, extractFacts, verifyFacts, ask, TOPICS } as unknown as ReaderApi;
const answerKey = key as AnswerKey;
const text = (file: string) => readFileSync(new URL(`../holdout/${file}`, import.meta.url), 'utf8');
const entry = (id: string) => answerKey.leases.find((l) => l.id === id)!;

describe('holdout answer key', () => {
  it('names only facts the vocabulary accepts', () => {
    for (const lease of answerKey.leases) {
      for (const fact of lease.facts) {
        const [, predicate = '', rawArgs] = /^([a-z_]+)(?:\((.*)\))?$/.exec(fact) ?? [];
        const spec = predicateSpec(predicate);
        expect(spec, fact).toBeDefined();
        const args = rawArgs ? rawArgs.split(',').map((a) => (/^\d+(\.\d+)?$/.test(a) ? Number(a) : a)) : [];
        expect(checkArgs(spec!, args), fact).toBeNull();
      }
    }
  });
});

describe('holdout leases (the numbers npm run eval prints)', () => {
  it('lease A: reads all 10 facts and no answer rests on a false "silent"', async () => {
    const score = await scoreLease(api, entry('holdout-a'), text('holdout-a-thornbury.txt'));
    expect(score.factsRead).toBe(10);
    expect(score.wrongFacts).toEqual([]);
    expect(score.falselySilent).toBe(0);
    expect(score.topics.find((t) => t.topic === 'late_fee')?.cantTell).toBe(true);
  });

  it('lease B: reads 8 of 12 facts, flags the other 4 clauses, and no answer rests on a false "silent"', async () => {
    const score = await scoreLease(api, entry('holdout-b'), text('holdout-b-penhallow.txt'));
    expect(score.factsRead).toBe(8);
    expect(score.missedFacts.sort()).toEqual(['entry_notice_hours(12)', 'late_fee_grace_days(5)', 'pet_policy(consent_required)', 'repair_deduct_waiver']);
    expect(score.wrongFacts).toEqual([]);
    expect(score.falselySilent).toBe(0);
    expect(score.topics.filter((t) => t.cantTell).map((t) => t.topic).sort()).toEqual(['entry_without_notice', 'late_fee', 'pets']);
  });
});
