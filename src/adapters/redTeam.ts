import { RED_TEAM_LABEL, type RedTeamFixture } from '../lease/redTeam';
import type { CandidateFact } from '../lease/types';
import type { LeaseReader } from './types';

const key = (c: CandidateFact) => JSON.stringify([c.predicate, c.args, c.clauseId, c.quote]);

/**
 * A reader that returns the base reader's candidates plus a red-team
 * fixture's recorded candidates, minus exact duplicates. It makes no network
 * call and uses no AI service. Its name says it is
 * a red-team fixture and not model output.
 */
export function redTeamLeaseReader(base: LeaseReader, fixture: RedTeamFixture): LeaseReader {
  return {
    name: fixture.label || RED_TEAM_LABEL,
    read: async (lease) => {
      const own = await base.read(lease);
      const seen = new Set(own.map(key));
      return [...own, ...fixture.candidates.filter((c) => !seen.has(key(c)))];
    },
  };
}
