import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLDEN_SAMPLE_IDS, sampleGolden, type SampleGolden } from './golden-helpers';

/**
 * Golden of the four samples that existed before the possessed-lease feature,
 * recorded from the code before any source file changed. If this fails, fix
 * the code, not the golden.
 */
const golden = JSON.parse(readFileSync('tests/unit/golden/samples.json', 'utf8')) as Record<string, SampleGolden>;

const cache = new Map<string, Promise<SampleGolden>>();
const compute = (id: string) => {
  if (!cache.has(id)) cache.set(id, sampleGolden(id));
  return cache.get(id)!;
};

describe('golden of the four existing samples', () => {
  it.each(GOLDEN_SAMPLE_IDS)('%s keeps its facts, unread entries and rejections (Req 9.4, 9.6)', async (id) => {
    const live = await compute(id);
    const want = golden[id]!;
    expect(live.facts).toEqual(want.facts);
    expect(live.factsDigest).toBe(want.factsDigest);
    expect(live.unread).toEqual(want.unread);
    expect(live.rejected).toBe(want.rejected);
  });

  it.each(GOLDEN_SAMPLE_IDS)('%s keeps every verdict, headline and step list for every tenant answer (Req 9.5)', async (id) => {
    const live = await compute(id);
    const want = golden[id]!;
    expect(live.verdicts).toEqual(want.verdicts);
    expect(live.answers).toEqual(want.answers);
  });

  it('covers exactly the four samples that existed before the feature', () => {
    expect(Object.keys(golden)).toEqual([...GOLDEN_SAMPLE_IDS]);
  });
});
