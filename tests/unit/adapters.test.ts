import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as readLease } from '../../functions/api/read-lease';
import { onRequestPost as translate } from '../../functions/api/translate';
import { bedrockConfig } from '../../functions/api/_env';
import { localLeaseReader, localQuestionTranslator } from '../../src/adapters/local';
import { remoteLeaseReader, remoteQuestionTranslator } from '../../src/adapters/remote';
import { TranslationSchema, vocabularyPrompt } from '../../src/adapters/schemas';
import { createAdapters, parseBackend } from '../../src/adapters/select';
import { verifyFacts } from '../../src/lease/verify';
import { sample } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const post = (body: unknown) =>
  new Request('https://lease.example.com/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('adapter selection', () => {
  it('defaults to the free local adapters', () => {
    expect(parseBackend(undefined)).toBe('local');
    expect(parseBackend('anything')).toBe('local');
    expect(createAdapters('local')).toEqual({ reader: localLeaseReader, translator: localQuestionTranslator });
  });

  it('routes the bedrock backend through the app API', () => {
    expect(parseBackend('bedrock')).toBe('bedrock');
    expect(createAdapters('bedrock').reader.name).toBe('Claude on Amazon Bedrock');
  });
});

describe('remote adapters (fetch stubbed, no network)', () => {
  it('verifies model facts like any other reader, so an invented quote is dropped', async () => {
    const { lease } = sample('cobweb-court');
    const rent = lease.clauses.find((c) => c.title === 'RENT')!;
    const fetchStub = vi.fn(async () =>
      Response.json({
        facts: [
          { predicate: 'monthly_rent', args: [1450], clauseId: rent.id, quote: 'Monthly rent is $1,450.00' },
          { predicate: 'pet_policy', args: ['allowed'], clauseId: rent.id, quote: 'Cats and dogs are welcome.' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const candidates = await remoteLeaseReader('https://lease.example.com').read(lease);
    const { facts, rejected } = verifyFacts(lease, candidates);
    expect(fetchStub).toHaveBeenCalledWith('https://lease.example.com/api/read-lease', expect.objectContaining({ method: 'POST' }));
    expect(facts.map((f) => f.predicate)).toEqual(['monthly_rent']);
    expect(rejected).toHaveLength(1);
  });

  it('rejects a translation outside the closed topic list', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ topic: 'haunting', tenant: [] }));
    await expect(remoteQuestionTranslator().translate('Is my flat haunted?')).rejects.toThrow();
  });

  it('marks translated tenant facts as coming from the question', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ topic: 'pets', tenant: [{ name: 'assistance_animal', value: true }] }));
    expect(await remoteQuestionTranslator().translate('Can I keep my service dog?')).toEqual({
      topic: 'pets',
      tenant: [{ name: 'assistance_animal', value: true, source: 'question' }],
    });
  });

  it('surfaces an HTTP error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }));
    await expect(remoteQuestionTranslator().translate('x')).rejects.toThrow('question translator returned 503');
  });
});

describe('API functions without credentials', () => {
  it('needs region and both keys before it will call Bedrock', () => {
    expect(bedrockConfig({})).toBeNull();
    expect(bedrockConfig({ AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'id' })).toBeNull();
    expect(bedrockConfig({ AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret' })).toMatchObject({
      region: 'us-east-1',
    });
  });

  it('answers 503 when Bedrock is not configured', async () => {
    const r1 = await readLease({ request: post({ id: 'x', name: 'x', text: 'x' }), env: {} });
    const r2 = await translate({ request: post({ question: 'x' }), env: {} });
    expect([r1.status, r2.status]).toEqual([503, 503]);
  });

  it('answers 400 to a malformed body before any model call', async () => {
    const env = { AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 'secret' };
    const r1 = await readLease({ request: post({ text: '' }), env });
    const r2 = await translate({ request: post({}), env });
    expect([r1.status, r2.status]).toEqual([400, 400]);
  });
});

describe('model prompts', () => {
  it('lists every predicate with its allowed values', () => {
    expect(vocabularyPrompt()).toContain('pet_policy(one of prohibited|allowed|consent_required)');
    expect(TranslationSchema.safeParse({ topic: null, tenant: [] }).success).toBe(true);
  });
});
