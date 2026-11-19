import { afterEach, describe, expect, it, vi } from 'vitest';
import { localLeaseReader, localQuestionTranslator } from '../../src/adapters/local';
import { createAdapters } from '../../src/adapters/select';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import { parseLease } from '../../src/lease/parse';

describe('the local reader and translator', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('make no network call', async () => {
    const fetch = vi.fn(() => {
      throw new Error('network call');
    });
    vi.stubGlobal('fetch', fetch);
    for (const s of SAMPLE_LEASES) {
      const facts = await localLeaseReader.read(parseLease(s.id, s.text, s.name));
      expect(facts.length, s.id).toBeGreaterThan(0);
    }
    expect((await localQuestionTranslator.translate('Can I get a dog?')).topic).toBe('pets');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('are the default when no backend is configured', () => {
    const adapters = createAdapters('local');
    expect(adapters.reader).toBe(localLeaseReader);
    expect(adapters.translator).toBe(localQuestionTranslator);
  });
});
