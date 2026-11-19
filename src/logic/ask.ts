import { predicateSpec, tenantFactSpec } from '../lease/vocabulary';
import type { FactArg, LeaseFact } from '../lease/types';
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
}

export interface AskInput {
  topic: string;
  facts: LeaseFact[];
  tenant: TenantAnswer[];
}

const MAX_PATHS = 6;

/**
 * Answers one question by proof. Tries to prove yes and no from what is
 * known. If neither can be proven, runs the prover again allowing it to
 * assume tenant answers (then lease facts) and reports what it would need.
 */
export async function ask({ topic, facts, tenant }: AskInput): Promise<Answer> {
  const info = topicById(topic);
  if (!info) throw new Error(`unknown topic: ${topic}`);
  const session = await PrologSession.load(PROVER_SOURCE, RULEBASE_SOURCE, factsProgram(facts, tenant));

  const yes = await session.once(`strict_proof(${topic}, yes, P)`, ['P']);
  const no = await session.once(`strict_proof(${topic}, no, P)`, ['P']);
  const base = { topic, question: info.question, missing: [], paths: [], conflict: false };

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

  for (const mode of ['tenant', 'lease'] as const) {
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
    if (paths.length > 0) {
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
        missing: [...missing.values()],
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
