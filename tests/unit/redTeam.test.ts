import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localLeaseReader } from '../../src/adapters/local';
import { redTeamLeaseReader } from '../../src/adapters/redTeam';
import { remoteLeaseReader } from '../../src/adapters/remote';
import { createAdapters } from '../../src/adapters/select';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import { parseLease } from '../../src/lease/parse';
import { RED_TEAM_FIXTURES, RED_TEAM_LABEL, redTeamFixture } from '../../src/lease/redTeam';
import type { CandidateFact } from '../../src/lease/types';
import { verifyFacts } from '../../src/lease/verify';

afterEach(() => vi.unstubAllGlobals());

const entry = SAMPLE_LEASES.find((s) => s.id === 'marrowgate-lofts')!;
const lease = parseLease(entry.id, entry.text, entry.name);
const fixture = redTeamFixture(entry.redTeam!)!;
const reader = redTeamLeaseReader(localLeaseReader, fixture);

describe('red-team fixture', () => {
  it('has every quote as a verbatim substring of its clause in Case No. 005 (Req 5.6)', () => {
    expect(RED_TEAM_FIXTURES.map((f) => f.leaseId)).toEqual(['marrowgate-lofts']);
    for (const c of fixture.candidates) {
      const clause = lease.clauses.find((cl) => cl.id === c.clauseId)!;
      expect(lease.text.slice(clause.start, clause.end), c.quote).toContain(c.quote);
    }
  });

  it('gets reader_directed, reader_directed and cue_mismatch (Req 5.7)', () => {
    const { facts, rejected } = verifyFacts(lease, fixture.candidates);
    expect(facts).toEqual([]);
    expect(rejected.map((r) => r.code)).toEqual(['reader_directed', 'reader_directed', 'cue_mismatch']);
    expect(rejected.map((r) => r.section)).toEqual([8, 8, 3]);
  });

  it('is labelled in code and in the reader name as a red-team fixture, not model output (Req 5.6, 5.8)', () => {
    expect(RED_TEAM_LABEL).toBe('Red-team fixture (recorded, not model output)');
    expect(fixture.label).toBe(RED_TEAM_LABEL);
    expect(reader.name).toContain('recorded, not model output');
    const source = readFileSync('src/lease/redTeam.ts', 'utf8');
    expect(source).toMatch(/RED-TEAM FIXTURE/);
    expect(source).toMatch(/NOT MODEL OUTPUT/);
  });

  it('removes duplicates of the local reader candidates and shows a struck count above zero (Req 5.7, 5.10)', async () => {
    const candidates = await reader.read(lease);
    const keys = candidates.map((c) => JSON.stringify([c.predicate, c.args, c.clauseId, c.quote]));
    expect(new Set(keys).size).toBe(keys.length);
    const local = await localLeaseReader.read(lease);
    expect(candidates).toHaveLength(local.length + 2);
    const { rejected } = verifyFacts(lease, candidates);
    expect(rejected.length).toBe(3);
    expect(rejected.map((r) => r.code).sort()).toEqual(['cue_mismatch', 'reader_directed', 'reader_directed']);
  });
});

describe('the same rejection for every reader (Req 2.5, 3.5)', () => {
  const planted: CandidateFact = fixture.candidates[0]!;
  const offTopic: CandidateFact = fixture.candidates[2]!;

  it('gives the local, a stubbed remote and the red-team reader the same rejections', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ facts: [planted, offTopic] }));
    const remote = await remoteLeaseReader('https://lease.example.com').read(lease);
    const readers = {
      local: await localLeaseReader.read(lease),
      remote,
      redTeam: await reader.read(lease),
    };
    const outcome = (candidates: CandidateFact[], c: CandidateFact) =>
      verifyFacts(lease, candidates).rejected.filter((r) => JSON.stringify(r.candidate) === JSON.stringify(c)).map((r) => [r.code, r.reason, r.section]);
    expect(outcome(readers.local, planted)).toEqual([['reader_directed', 'quote is in text addressed to automated readers (section 8)', 8]]);
    expect(outcome(readers.remote, planted)).toEqual(outcome(readers.local, planted));
    expect(outcome(readers.redTeam, planted)).toEqual(outcome(readers.local, planted));
    expect(outcome(readers.remote, offTopic)).toEqual([['cue_mismatch', 'the quoted sentence does not mention late fees', 3]]);
    expect(outcome(readers.redTeam, offTopic)).toEqual(outcome(readers.remote, offTopic));
  });
});

describe('loading Case No. 005 makes no network call (Req 5.9, 9.3)', () => {
  it.each(['local', 'bedrock'] as const)('under the %s backend setting', async (backend) => {
    const fetch = vi.fn(() => {
      throw new Error('network call');
    });
    vi.stubGlobal('fetch', fetch);
    const adapters = createAdapters(backend);
    const configuredRead = vi.spyOn(adapters.reader, 'read');
    // The app reads a sample with a red-team id through the red-team reader, whatever the backend.
    const candidates = await redTeamLeaseReader(localLeaseReader, fixture).read(lease);
    expect(verifyFacts(lease, candidates).rejected.length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
    // The configured reader is the remote (Bedrock) one under "bedrock"; the local one is the red-team reader's own base.
    if (backend === 'bedrock') expect(configuredRead).not.toHaveBeenCalled();
  });

  it('does not import the remote or Bedrock modules', () => {
    const source = readFileSync('src/adapters/redTeam.ts', 'utf8');
    expect(source).not.toMatch(/remote|bedrock|fetch\(/i);
  });
});
