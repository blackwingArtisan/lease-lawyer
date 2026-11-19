import { predicateSpec, tenantFactSpec } from '../lease/vocabulary';
import type { FactArg, LeaseFact } from '../lease/types';
import { ruleInfo, type FactLookup } from './rules';
import { compoundOf, isAtom, isCompound, termToText, type PTerm } from './terms';

/** The proof tree returned by prove/5, as plain data. */
export type ProofNode =
  | { kind: 'rule'; ruleId: string; goal: PTerm; children: ProofNode[] }
  | { kind: 'lease'; fact: PTerm; factId: string }
  | { kind: 'absent'; fact: PTerm }
  | { kind: 'tenant'; name: string; value: boolean; source: string }
  | { kind: 'not_told'; name: string }
  | { kind: 'calc'; expr: PTerm }
  | { kind: 'assumed'; goal: PTerm };

/** Converts the proof term from Prolog into a tree. Throws on a term the prover never builds. */
export function toProofTree(t: PTerm): ProofNode[] {
  if (isAtom(t, 'true')) return [];
  const c = compoundOf(t);
  if (!c) throw new Error(`unexpected proof term: ${termToText(t)}`);
  const [a, b, d] = c.args;
  switch (`${c.name}/${c.args.length}`) {
    case 'and/2':
      return [...toProofTree(a!), ...toProofTree(b!)];
    case 'rule/3':
      if (!isAtom(a!)) throw new Error('rule id must be an atom');
      return [{ kind: 'rule', ruleId: atomName(a!), goal: b!, children: toProofTree(d!) }];
    case 'lease/2':
      if (!isAtom(b!)) throw new Error('fact id must be an atom');
      return [{ kind: 'lease', fact: a!, factId: atomName(b!) }];
    case 'absent/1':
      return [{ kind: 'absent', fact: a! }];
    case 'told/2':
    case 'denied/2':
      if (!isAtom(a!) || !isAtom(b!)) throw new Error('tenant fact must be atoms');
      return [{ kind: 'tenant', name: atomName(a!), value: c.name === 'told', source: atomName(b!) }];
    case 'not_told/1':
      if (!isAtom(a!)) throw new Error('tenant fact must be an atom');
      return [{ kind: 'not_told', name: atomName(a!) }];
    case 'calc/1':
      return [{ kind: 'calc', expr: a! }];
    case 'assumed/1':
      return [{ kind: 'assumed', goal: a! }];
    default:
      throw new Error(`unexpected proof term: ${termToText(t)}`);
  }
}

function atomName(t: PTerm): string {
  return t.type === 'atom' ? t.name : termToText(t);
}

export type StepKind = 'lease' | 'absent' | 'tenant' | 'calc' | 'law' | 'inference' | 'verdict' | 'assumed';

/** One numbered step of the proof chain as the reader sees it. */
export interface ProofStep {
  n: number;
  kind: StepKind;
  title: string;
  detail: string;
  /** Rule citation, e.g. "MJ §3.4", or the lease section. */
  cite?: string;
  /** Lease citation for lease steps. */
  factId?: string;
  clauseId?: string;
  quote?: string;
  /** Step numbers this step relies on. */
  uses: number[];
  /** The Prolog goal this step proves. */
  prolog: string;
}

export function termArgs(t: PTerm): FactArg[] {
  if (t.type !== 'compound') return [];
  return t.args.map((a) => (a.type === 'num' ? a.value : a.type === 'atom' ? a.name : '_'));
}

function factName(t: PTerm): string {
  return t.type === 'compound' || t.type === 'atom' ? t.name : '?';
}

export function describeFact(t: PTerm): string {
  const spec = predicateSpec(factName(t));
  return spec ? spec.describe(termArgs(t)) : termToText(t);
}

const SYMBOLS: Record<string, string> = { '=<': '≤', '>=': '≥', '<': '<', '>': '>', '*': '×', '+': '+', '-': '−', '/': '÷' };

export function describeCalc(t: PTerm): string {
  if (t.type === 'compound' && t.args.length === 2) {
    const [a, b] = t.args as [PTerm, PTerm];
    if (t.name === 'is') return `${describeCalc(a)} = ${describeCalc(b)}`;
    const sym = SYMBOLS[t.name];
    if (sym) return `${describeCalc(a)} ${sym} ${describeCalc(b)}`;
  }
  return termToText(t);
}

function describeAssumed(goal: PTerm): string {
  const c = compoundOf(goal, undefined, 1);
  const inner = c?.args[0];
  if (c && inner && c.name === 'lease') return `If the lease stated ${predicateSpec(factName(inner))?.topic ?? termToText(inner)}`;
  if (c && inner && (c.name === 'told' || c.name === 'denied') && inner.type === 'atom') {
    const spec = tenantFactSpec(inner.name);
    return spec ? (c.name === 'told' ? spec.told : spec.denied) : termToText(goal);
  }
  return termToText(goal);
}

/**
 * Flattens a proof tree into a numbered chain: evidence first, then each rule
 * once its premises are on the page, ending with the verdict. Every step
 * records which earlier steps it uses.
 */
export function proofSteps(roots: ProofNode[], facts: LeaseFact[]): ProofStep[] {
  const steps: ProofStep[] = [];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const push = (s: Omit<ProofStep, 'n'>) => {
    const step = { ...s, n: steps.length + 1 };
    steps.push(step);
    return step.n;
  };

  const visit = (node: ProofNode): number => {
    switch (node.kind) {
      case 'lease': {
        const f = byId.get(node.factId);
        return push({
          kind: 'lease',
          title: describeFact(node.fact),
          detail: f ? `“${f.quote}”` : '',
          factId: node.factId,
          clauseId: f?.clauseId,
          quote: f?.quote,
          cite: f ? `Lease ${f.clauseId.replace(/^s/, '§')}` : 'Lease',
          uses: [],
          prolog: `lease(${termToText(node.fact)})`,
        });
      }
      case 'absent': {
        const spec = predicateSpec(factName(node.fact));
        return push({
          kind: 'absent',
          title: `The lease says nothing about ${spec?.topic ?? termToText(node.fact)}`,
          detail: 'Every clause was read; none states this.',
          cite: 'Whole lease',
          uses: [],
          prolog: `absent(${termToText(node.fact)})`,
        });
      }
      case 'tenant': {
        const spec = tenantFactSpec(node.name);
        return push({
          kind: 'tenant',
          title: spec ? (node.value ? spec.told : spec.denied) : node.name,
          detail: node.source === 'question' ? 'From your question.' : 'From your answer.',
          cite: 'You',
          uses: [],
          prolog: `${node.value ? 'told' : 'denied'}(${node.name})`,
        });
      }
      case 'not_told': {
        const spec = tenantFactSpec(node.name);
        return push({
          kind: 'tenant',
          title: `You have not said: ${spec ? spec.told.charAt(0).toLowerCase() + spec.told.slice(1) : node.name}`,
          detail: 'If that changes, ask again.',
          cite: 'You',
          uses: [],
          prolog: `not_told(${node.name})`,
        });
      }
      case 'calc':
        return push({ kind: 'calc', title: describeCalc(node.expr), detail: 'Arithmetic check.', cite: 'Math', uses: [], prolog: `calc(${termToText(node.expr)})` });
      case 'assumed':
        return push({ kind: 'assumed', title: describeAssumed(node.goal), detail: 'Not known yet.', cite: 'Missing', uses: [], prolog: termToText(node.goal) });
      case 'rule': {
        const uses = node.children.map(visit);
        const info = ruleInfo(node.ruleId);
        const isVerdict = isCompound(node.goal, 'verdict', 2);
        return push({
          kind: isVerdict ? 'verdict' : uses.length === 0 ? 'law' : 'inference',
          title: info.title,
          detail: info.text,
          cite: info.section,
          uses,
          prolog: termToText(node.goal),
        });
      }
    }
  };

  roots.forEach(visit);
  return steps;
}

/** Looks up lease fact arguments anywhere in a proof tree, for filling answer text. */
export function factLookup(roots: ProofNode[]): FactLookup {
  const found = new Map<string, FactArg[]>();
  const walk = (n: ProofNode) => {
    if (n.kind === 'lease') {
      const name = factName(n.fact);
      if (!found.has(name)) found.set(name, termArgs(n.fact));
    } else if (n.kind === 'rule') {
      n.children.forEach(walk);
    }
  };
  roots.forEach(walk);
  return (p) => found.get(p);
}
