import { describe, expect, it } from 'vitest';
import { CUES, findUnread } from '../../src/lease/coverage';
import { extractFacts } from '../../src/lease/extract';
import { parseLease } from '../../src/lease/parse';
import type { CandidateFact } from '../../src/lease/types';
import { PREDICATES } from '../../src/lease/vocabulary';
import { verifyFacts } from '../../src/lease/verify';
import { PrologSession } from '../../src/logic/engine';
import { PROVER_SOURCE, RULEBASE_SOURCE, factsProgram } from '../../src/logic/program';
import { ask, facts as factList, sample } from './helpers';
import { QUILLON_HEIGHTS, UNREADABLE_RIDERS } from './wordings';

const unread = (text: string, candidates?: CandidateFact[]) => {
  const lease = parseLease('t', text);
  return verifyFacts(lease, candidates ?? extractFacts(lease)).unread.map((u) => `${u.predicate}@${u.clauseId}`);
};

describe('coverage check', () => {
  it('has cue words for every predicate in the vocabulary', () => {
    expect(CUES.map((c) => c.predicate).sort()).toEqual(PREDICATES.map((p) => p.name).sort());
  });

  it('flags a clause that has cue words and no fact', () => {
    expect(unread(UNREADABLE_RIDERS)).toEqual(['pet_policy@s3', 'sublet_policy@s4', 'entry_notice_hours@s5', 'late_fee@s6']);
  });

  it('flags a clause whose fact the reader did not return, whichever reader it was', () => {
    const lease = parseLease('t', '1. ANIMALS. No animals of any kind may be kept in the unit.');
    expect(verifyFacts(lease, []).unread.map((u) => u.predicate)).toEqual(['pet_policy']);
  });

  it('records the section number and heading for the message', () => {
    const lease = parseLease('t', UNREADABLE_RIDERS);
    const [first] = verifyFacts(lease, extractFacts(lease)).unread;
    expect(first).toEqual({ predicate: 'pet_policy', clauseId: 's3', number: 3, title: 'ANIMALS' });
  });

  it('does not flag a clause whose fact was read', () => {
    expect(unread(QUILLON_HEIGHTS)).toEqual([]);
  });

  it('does not flag a fact repeated in a later clause that verification de-duplicated', () => {
    const text = '1. PETS. No pets of any kind are allowed.\n\n2. PETS AGAIN. No pets of any kind are allowed.';
    expect(unread(text)).toEqual([]);
  });

  it('does not count a rejected candidate as a read fact', () => {
    const bad: CandidateFact = { predicate: 'pet_policy', args: ['prohibited'], clauseId: 's1', quote: 'Pets are never allowed.' };
    expect(unread('1. ANIMALS. No animals of any kind may be kept in the unit.', [bad])).toEqual(['pet_policy@s1']);
  });

  it('stays quiet when a clause names no time for entry, ignores service animals and "rent shall not increase"', () => {
    const text = [
      '1. ACCESS. Landlord may enter the Premises at reasonable times with reasonable notice.',
      '2. ASSISTANCE. Service animals are permitted.',
      '3. RENT. Rent shall not increase during the term.',
    ].join('\n\n');
    expect(unread(text)).toEqual([]);
  });

  it('finds nothing unread on the sample leases and the upload fixture, where the lease really is silent', () => {
    for (const id of ['wychwood-arms', 'gaslight-row', 'cobweb-court']) expect(sample(id).unread, id).toEqual([]);
    expect(unread('1. TERM. The term of this Lease is six (6) months, beginning January 1, 2027 and ending June 30, 2027.')).toEqual([]);
  });

  it('does not take "assigned" for an assignment clause', () => {
    expect(unread('1. PREMISES. The unit comes with one assigned parking space.')).toEqual([]);
  });
});

describe('absent/1 and unread predicates', () => {
  const run = async (program: string, goal: string) => {
    const session = await PrologSession.load(PROVER_SOURCE, RULEBASE_SOURCE, program);
    return session.once(goal, ['P']);
  };
  const lease = (u: string[]) => factsProgram(factList(['monthly_rent', 1000]), [], u.map((p) => ({ predicate: p, clauseId: 's3', number: 3, title: 'ANIMALS' })));

  it('succeeds for a predicate with no fact and no unread clause', async () => {
    expect(await run(lease([]), 'prove(absent(pet_policy(_)), P, strict, [], _)')).not.toBeNull();
  });

  it('fails for an unread predicate in strict, tenant and lease mode', async () => {
    for (const mode of ['strict', 'tenant', 'lease']) {
      expect(await run(lease(['pet_policy']), `prove(absent(pet_policy(_)), P, ${mode}, [], _)`), mode).toBeNull();
    }
  });

  it('still succeeds for a different predicate, and in loose mode', async () => {
    expect(await run(lease(['pet_policy']), 'prove(absent(sublet_policy(_)), P, strict, [], _)')).not.toBeNull();
    expect(await run(lease(['pet_policy']), 'prove(absent(pet_policy(_)), P, loose, [], _)')).not.toBeNull();
  });

  it('works for a predicate with no arguments', async () => {
    expect(await run(lease(['repair_deduct_waiver']), 'prove(absent(repair_deduct_waiver), P, strict, [], _)')).toBeNull();
  });
});

describe('ask() when a clause could not be read', () => {
  const readLease = (text: string) => {
    const lease = parseLease('t', text);
    return verifyFacts(lease, extractFacts(lease));
  };
  const rider = readLease(UNREADABLE_RIDERS);

  it('says "can\'t tell" about pets, with the clause, and never calls the lease silent', async () => {
    const a = await ask({ topic: 'pets', facts: rider.facts, tenant: [], unread: rider.unread });
    expect(a.verdict).toBe('unknown');
    expect(a.headline).toBe(
      "Can't tell. Section 3 (ANIMALS) mentions pets, but the reader could not read what it says, so the engine will not treat the lease as silent. Read that section yourself.",
    );
    expect(a.unread).toEqual([{ clauseId: 's3', number: 3, title: 'ANIMALS', subjects: ['pets'] }]);
    expect(a.steps).toEqual([]);
    expect(a.headline).not.toMatch(/says nothing about pets/);
  });

  it('gave the silent-lease Yes before the check, which is the bug being fixed', async () => {
    const a = await ask({ topic: 'pets', facts: rider.facts, tenant: [] });
    expect([a.verdict, a.headline]).toEqual(['yes', expect.stringMatching(/says nothing about pets/)]);
  });

  it('says "can\'t tell" about subletting', async () => {
    const a = await ask({ topic: 'sublet', facts: rider.facts, tenant: [], unread: rider.unread });
    expect(a.verdict).toBe('unknown');
    expect(a.headline).toMatch(/^Can't tell\. Section 4 \(ASSIGNMENT\) mentions subletting,/);
    expect(a.unread.map((u) => u.clauseId)).toEqual(['s4']);
  });

  it('says "can\'t tell" about landlord entry', async () => {
    const a = await ask({ topic: 'entry_without_notice', facts: rider.facts, tenant: [], unread: rider.unread });
    expect(a.verdict).toBe('unknown');
    expect(a.headline).toMatch(/^Can't tell\. Section 5 \(ENTRY\) mentions landlord entry,/);
    expect(a.unread.map((u) => u.clauseId)).toEqual(['s5']);
  });

  it('still lets a tenant answer settle it when the proof does not rest on silence', async () => {
    const first = await ask({ topic: 'pets', facts: rider.facts, tenant: [], unread: rider.unread });
    expect(first.missing).toEqual([{ kind: 'tenant', name: 'assistance_animal', question: expect.stringContaining('assistance animal') }]);
    const settled = await ask({
      topic: 'pets',
      facts: rider.facts,
      tenant: [{ name: 'assistance_animal', value: true, source: 'answer' }],
      unread: rider.unread,
    });
    expect(settled.verdict).toBe('yes');
    expect(settled.unread).toEqual([]);
  });

  it('is not blocked by an unread clause about a different topic', async () => {
    const a = await ask({ topic: 'late_fee', facts: rider.facts, tenant: [], unread: rider.unread.filter((u) => u.predicate === 'pet_policy') });
    expect(a.unread).toEqual([]);
    expect(a.headline).not.toMatch(/^Can't tell/);
  });

  it('names every blocking section when there is more than one', async () => {
    const text = ['1. PETS. See Rider B for animals.', '2. ANIMAL RULES. Dogs and cats are covered by Rider E.'].join('\n\n');
    const r = readLease(text);
    const a = await ask({ topic: 'pets', facts: r.facts, tenant: [], unread: r.unread });
    expect(a.unread.map((u) => u.clauseId)).toEqual(['s1', 's2']);
    expect(a.headline).toBe(
      "Can't tell. Section 1 (PETS) mentions pets and Section 2 (ANIMAL RULES) mentions pets, but the reader could not read what they say, so the engine will not treat the lease as silent. Read those sections yourself.",
    );
  });

  it('keeps every sample verdict the same when the (empty) unread list is passed', async () => {
    for (const id of ['wychwood-arms', 'gaslight-row', 'cobweb-court']) {
      const s = sample(id);
      for (const topic of ['pets', 'sublet', 'entry_without_notice', 'late_fee', 'wear_and_tear', 'rent_increase']) {
        const plain = await ask({ topic, facts: s.facts, tenant: [] });
        const covered = await ask({ topic, facts: s.facts, tenant: [], unread: s.unread });
        expect(covered.verdict, `${id} ${topic}`).toBe(plain.verdict);
      }
    }
  });
});

describe('late-fee clauses that name a day but no grace fact', () => {
  it.each([
    'Rent paid after the third (3rd) of the month incurs a $45 late fee.',
    'A late fee of $30 applies to rent received past the fifth day.',
    'Tenant owes a $25 late charge when rent is more than two days late.',
    'A $60 late fee is due if rent is unpaid on the 6th.',
  ])('flags the grace period: %s', (sentence) => {
    const text = `4. LATE RENT. ${sentence}`;
    expect(unread(text)).toContain('late_fee_grace_days@s4');
  });

  it('does not guess the grace days from a day of the month', () => {
    const lease = parseLease('t', '4. LATE RENT. Rent paid after the third (3rd) of the month incurs a $45 late fee.');
    const facts = verifyFacts(lease, extractFacts(lease)).facts.map((f) => `${f.predicate}(${f.args.join(',')})`);
    expect(facts).toEqual(['late_fee(45)']);
  });

  it('does not flag when a grace fact was read', () => {
    expect(unread('4. LATE RENT. A $50 late fee applies after a grace period of five (5) days.')).toEqual([]);
  });

  it('does not flag a clause with no late-fee cue', () => {
    expect(unread('4. RENT DUE. Rent is due on the 1st of the month.')).not.toContain('late_fee_grace_days@s4');
  });

  it('flags a security clause no reader read', () => {
    const lease = parseLease('t', '5. SECURITY. Lessor holds a bond against damage in excess of normal wear and tear.');
    expect(verifyFacts(lease, []).unread.map((u) => u.predicate)).toContain('deposit_deduction');
  });
});

describe('clauses that look silent but are not', () => {
  const readLease = (text: string) => {
    const lease = parseLease('t', text);
    return verifyFacts(lease, extractFacts(lease));
  };

  it.each([
    'The deposit is non-refundable.',
    'The deposit is nonrefundable under all circumstances.',
    'The deposit will not be refunded at the end of the term.',
    'Tenant forfeits the deposit upon move-out.',
    'Landlord may retain the deposit in full.',
  ])('flags what may be deducted from the deposit: %s', (sentence) => {
    expect(unread(`6. SECURITY DEPOSIT. Tenant shall pay a security deposit of $1,200. ${sentence}`)).toContain('deposit_deduction@s6');
  });

  it('does not flag a non-refundable pet fee in a deposit-free clause', () => {
    expect(unread('7. PET FEE. A one-time pet fee of $250 is non-refundable.')).not.toContain('deposit_deduction@s7');
  });

  it.each([
    'Landlord may enter the Premises at any time.',
    'Landlord may enter the Premises without notice.',
    'Owner may access the unit at any hour and without prior notice.',
    'Management may inspect the unit whenever it chooses.',
  ])('flags landlord entry: %s', (sentence) => {
    expect(unread(`8. ACCESS. ${sentence}`)).toContain('entry_notice_hours@s8');
  });

  it('answers "can\'t tell" about the deposit for a non-refundable clause, not the silent-lease answer', async () => {
    const r = readLease('6. SECURITY DEPOSIT. Tenant shall pay a security deposit of $1,200. The deposit is non-refundable.');
    const a = await ask({ topic: 'wear_and_tear', facts: r.facts, tenant: [], unread: r.unread });
    expect(a.verdict).toBe('unknown');
    expect(a.headline).toMatch(/^Can't tell\. Section 6 \(SECURITY DEPOSIT\) mentions what may be deducted from the deposit,/);
  });

  it('answers "can\'t tell" about entry for an "at any time" clause', async () => {
    const r = readLease('8. ACCESS. Landlord may enter the Premises at any time and without notice.');
    const a = await ask({ topic: 'entry_without_notice', facts: r.facts, tenant: [], unread: r.unread });
    expect(a.verdict).toBe('unknown');
    expect(a.headline).toMatch(/^Can't tell\. Section 8 \(ACCESS\) mentions landlord entry,/);
  });
});
