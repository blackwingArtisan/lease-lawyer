import { cueSubject } from '../lease/coverage';
import { predicateSpec, tenantFactSpec } from '../lease/vocabulary';
import type { FactArg, LeaseFact, UnreadClause } from '../lease/types';
import { PrologSession } from './engine';
import { PROVER_SOURCE, RULEBASE_SOURCE, factsProgram, type TenantAnswer } from './program';
import { factLookup, proofSteps, toProofTree, type ProofNode, type ProofStep } from './proof';
import { ruleInfo } from './rules';
import { isAtom, isCompound, listItems, termToText, type PTerm } from './terms';
import { topicById } from './topics';

export type Verdict = 'yes' | 'no' | 'unknown';

/** Something the proof needs but does not have. */
export type MissingFact =
  | { kind: 'tenant'; name: string; question: string }
  | { kind: 'lease'; predicate: string; topic: string };

/** One way the proof could be completed, and the verdict it would reach. */
export interface ProofPath {
  verdict: 'yes' | 'no';
  conditions: string[];
}

/** A lease section the reader could not read, which blocked a "the lease is silent" proof. */
export interface UnreadSection {
  clauseId: string;
  number: number;
  title: string;
  /** What the section seems to be about, e.g. "pets". */
  subjects: string[];
}

export interface Answer {
  topic: string;
  question: string;
  verdict: Verdict;
  /** The one-line answer. */
  headline: string;
  steps: ProofStep[];
  tree: ProofNode[];
  /** The Prolog goal that was run. */
  query: string;
  /** The proof term exactly as Prolog returned it. */
  proofTerm?: string;
  missing: MissingFact[];
  paths: ProofPath[];
  /** True if the rule base proved both yes and no, which is a bug in the rules. */
  conflict: boolean;
  /** Sections that blocked the proof because the reader could not read them. Empty unless the verdict is "can't tell". */
  unread: UnreadSection[];
}

export interface AskInput {
  topic: string;
  facts: LeaseFact[];
  tenant: TenantAnswer[];
  /** Clauses the coverage check flagged. The engine will not call the lease silent about their predicates. */
  unread?: UnreadClause[];
  /** Prolog rule base to prove against. Defaults to the model jurisdiction. */
  rulebase?: string;
}

const MAX_PATHS = 6;

/**
 * Answers one question by proof. Tries to prove yes and no from what is
 * known. If neither can be proven, runs the prover again allowing it to
 * assume tenant answers (then lease facts) and reports what it would need.
 */
export async function ask({ topic, facts, tenant, unread = [], rulebase = RULEBASE_SOURCE }: AskInput): Promise<Answer> {
  const info = topicById(topic);
  if (!info) throw new Error(`unknown topic: ${topic}`);
  const session = await PrologSession.load(PROVER_SOURCE, rulebase, factsProgram(facts, tenant, unread));

  const yes = await session.once(`strict_proof(${topic}, yes, P)`, ['P']);
  const no = await session.once(`strict_proof(${topic}, no, P)`, ['P']);
  const base = { topic, question: info.question, missing: [], paths: [], conflict: false, unread: [] };

  if (yes && no) {
    return {
      ...base,
      verdict: 'unknown',
      headline: 'The rule base proved both yes and no here, so it cannot give a safe answer.',
      steps: [],
      tree: [],
      query: `verdict(${topic}, V)`,
      conflict: true,
    };
  }

  const proved = yes ?? no;
  if (proved) {
    const verdict: 'yes' | 'no' = yes ? 'yes' : 'no';
    const term = proved['P']!;
    const tree = toProofTree(term);
    const root = tree[0];
    const lookup = withFallback(factLookup(tree), facts);
    const rule = root && root.kind === 'rule' ? ruleInfo(root.ruleId) : undefined;
    return {
      ...base,
      verdict,
      headline: rule?.answer?.(lookup) ?? (verdict === 'yes' ? 'Yes.' : 'No.'),
      steps: proofSteps(tree, facts),
      tree,
      query: `verdict(${topic}, ${verdict})`,
      proofTerm: termToText(term),
    };
  }

  // Would the proof go through if unread clauses were ignored? Then the lease may not be silent after all.
  const blocked = unread.length > 0 ? await blockedByUnread(session, topic, unread) : [];
  if (blocked.length > 0) {
    const sections = unreadSections(blocked);
    // A tenant answer (an assistance animal, an emergency) can still settle the question.
    const { paths, missing } = await abduce(session, topic, 'tenant');
    return {
      ...base,
      verdict: 'unknown',
      headline: cantTellHeadline(sections),
      steps: [],
      tree: [],
      query: `verdict(${topic}, V)`,
      missing,
      paths,
      unread: sections,
    };
  }

  for (const mode of ['tenant', 'lease'] as const) {
    const { paths, missing } = await abduce(session, topic, mode);
    if (paths.length > 0) {
      // A lease fact the rules need may sit in a clause the reader could not read: then the lease is not missing it.
      const unreadNeeded = mode === 'lease' ? unread.filter((u) => missing.some((m) => m.kind === 'lease' && m.predicate === u.predicate)) : [];
      if (unreadNeeded.length > 0) {
        const sections = unreadSections(unreadNeeded);
        return {
          ...base,
          verdict: 'unknown',
          headline: cantTellHeadline(sections),
          steps: [],
          tree: [],
          query: `verdict(${topic}, V)`,
          missing,
          paths,
          unread: sections,
        };
      }
      return {
        ...base,
        verdict: 'unknown',
        headline:
          mode === 'tenant'
            ? 'Not proven yet. The answer depends on facts about you that the lease cannot tell us.'
            : 'Not proven. The lease is missing a fact the rules need.',
        steps: [],
        tree: [],
        query: `verdict(${topic}, V)`,
        missing,
        paths,
      };
    }
  }

  return {
    ...base,
    verdict: 'unknown',
    headline: 'Not proven. No rule in the rule base covers this situation, so the engine will not guess.',
    steps: [],
    tree: [],
    query: `verdict(${topic}, V)`,
  };
}

/** Searches for the smallest sets of assumptions that would finish a proof in the given mode. */
async function abduce(session: PrologSession, topic: string, mode: 'tenant' | 'lease') {
  const paths: ProofPath[] = [];
  const missing = new Map<string, MissingFact>();
  for (const verdict of ['yes', 'no'] as const) {
    const r = await session.once(`assumption_sets(${topic}, ${verdict}, ${mode}, S)`, ['S']);
    const sets = minimalSets((r && listItems(r['S']!)) || []);
    for (const set of sets.slice(0, MAX_PATHS)) {
      paths.push({ verdict, conditions: set.map(describeAssumption) });
      for (const a of set) {
        const m = toMissing(a);
        if (m) missing.set(m.kind === 'tenant' ? `t:${m.name}` : `l:${m.predicate}`, m);
      }
    }
  }
  return { paths, missing: [...missing.values()] };
}

/**
 * Runs the prover in loose mode, where absence ignores unread clauses, and
 * returns the unread entries whose absence that proof relied on. Strict mode
 * has already failed, so any loose proof must have leaned on one of them.
 */
async function blockedByUnread(session: PrologSession, topic: string, unread: UnreadClause[]): Promise<UnreadClause[]> {
  const used = new Set<string>();
  for (const verdict of ['yes', 'no'] as const) {
    const r = await session.once(`loose_proof(${topic}, ${verdict}, P)`, ['P']);
    if (r) for (const name of absentPredicates(toProofTree(r['P']!))) used.add(name);
  }
  return unread.filter((u) => used.has(u.predicate));
}

function absentPredicates(nodes: ProofNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind === 'absent') out.push(n.fact.type === 'compound' || n.fact.type === 'atom' ? n.fact.name : '');
    else if (n.kind === 'rule') out.push(...absentPredicates(n.children));
  }
  return out;
}

function unreadSections(blocked: UnreadClause[]): UnreadSection[] {
  const byClause = new Map<string, UnreadSection>();
  for (const u of blocked) {
    const section = byClause.get(u.clauseId) ?? { clauseId: u.clauseId, number: u.number, title: u.title, subjects: [] };
    const subject = cueSubject(u.predicate);
    if (!section.subjects.includes(subject)) section.subjects.push(subject);
    byClause.set(u.clauseId, section);
  }
  return [...byClause.values()].sort((a, b) => a.number - b.number);
}

function joinWords(items: string[]): string {
  return items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Can't tell. Section 6 (ANIMALS) mentions pets, but the reader could not read what it says, ..." */
export function cantTellHeadline(sections: UnreadSection[]): string {
  const one = sections.length === 1;
  const parts = sections.map((s) => `Section ${s.number} (${s.title}) mentions ${joinWords(s.subjects)}`);
  return (
    `Can't tell. ${joinWords(parts)}, but the reader could not read what ${one ? 'it says' : 'they say'}, ` +
    `so the engine will not treat the lease as silent. Read ${one ? 'that section' : 'those sections'} yourself.`
  );
}

function withFallback(primary: (p: string) => FactArg[] | undefined, facts: LeaseFact[]) {
  return (p: string) => primary(p) ?? facts.find((f) => f.predicate === p)?.args;
}

/** Sorts assumption sets by size and drops duplicates and supersets. */
function minimalSets(sets: PTerm[]): PTerm[][] {
  const asLists = sets.map((s) => listItems(s) ?? []).map((items) => {
    const seen = new Map<string, PTerm>();
    for (const i of items) seen.set(termToText(i), i);
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  });
  asLists.sort((a, b) => a.length - b.length);
  const kept: [string, PTerm][][] = [];
  for (const set of asLists) {
    const keys = new Set(set.map(([k]) => k));
    if (kept.some((k) => k.every(([key]) => keys.has(key)))) continue;
    kept.push(set);
  }
  return kept.map((set) => set.map(([, t]) => t));
}

function toMissing(a: PTerm): MissingFact | null {
  if ((isCompound(a, 'told', 1) || isCompound(a, 'denied', 1)) && isAtom(a.args[0]!)) {
    const name = a.args[0].name;
    return { kind: 'tenant', name, question: tenantFactSpec(name)?.question ?? name };
  }
  if (isCompound(a, 'lease', 1)) {
    const f = a.args[0]!;
    const predicate = f.type === 'compound' || f.type === 'atom' ? f.name : termToText(f);
    return { kind: 'lease', predicate, topic: predicateSpec(predicate)?.topic ?? predicate };
  }
  return null;
}

function describeAssumption(a: PTerm): string {
  if ((isCompound(a, 'told', 1) || isCompound(a, 'denied', 1)) && isAtom(a.args[0]!)) {
    const spec = tenantFactSpec(a.args[0].name);
    if (spec) return a.name === 'told' ? spec.told : spec.denied;
  }
  if (isCompound(a, 'lease', 1)) {
    const f = a.args[0]!;
    const name = f.type === 'compound' || f.type === 'atom' ? f.name : '';
    return `the lease stated ${predicateSpec(name)?.topic ?? termToText(f)}`;
  }
  return termToText(a);
}
