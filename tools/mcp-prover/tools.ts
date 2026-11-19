// The prover's MCP tools, as plain functions over the app's own modules, so they can be tested
// without a transport and answer exactly what the browser app answers.
import { extractFacts } from '../../src/lease/extract';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import { parseLease } from '../../src/lease/parse';
import { verifyFacts } from '../../src/lease/verify';
import { ask } from '../../src/logic/ask';
import type { TenantAnswer } from '../../src/logic/program';
import { RULES } from '../../src/logic/rules';
import { TOPICS } from '../../src/logic/topics';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
}

const leaseInput = {
  lease: {
    type: 'string',
    description: `A sample lease id (${SAMPLE_LEASES.map((s) => s.id).join(', ')}) or the full text of a lease with numbered sections.`,
  },
};
const topicInput = { topic: { type: 'string', enum: TOPICS.map((t) => t.id), description: 'The question to prove.' } };
const tenantInput = {
  tenant: {
    type: 'object',
    additionalProperties: { type: 'boolean' },
    description: 'Answers about the tenant, by fact name, e.g. {"assistance_animal": true}.',
  },
};

export const TOOLS: ToolDefinition[] = [
  {
    name: 'list_rules',
    description: 'Lists every rule in the model rule base with its section, title and plain-English text, and the topics it can prove.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_lease',
    description: 'Reads a lease the way the app does: the facts kept word for word with the clause each came from, and the clauses flagged as unreadable.',
    inputSchema: { type: 'object', properties: leaseInput, required: ['lease'], additionalProperties: false },
  },
  {
    name: 'ask_topic',
    description: 'Proves one topic against a lease with the real Prolog prover. Returns Yes, No or unknown with the headline, the proof steps and what would settle an unknown.',
    inputSchema: { type: 'object', properties: { ...topicInput, ...leaseInput, ...tenantInput }, required: ['topic', 'lease'], additionalProperties: false },
  },
  {
    name: 'explain_proof',
    description: 'Proves one topic and returns the proof as numbered steps, each citing a lease clause, a rule or a tenant answer, plus the raw Prolog proof term.',
    inputSchema: { type: 'object', properties: { ...topicInput, ...leaseInput, ...tenantInput }, required: ['topic', 'lease'], additionalProperties: false },
  },
];

function readLease(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('lease must be a sample lease id or lease text');
  const s = SAMPLE_LEASES.find((l) => l.id === input.trim());
  const lease = s ? parseLease(s.id, s.text, s.name) : parseLease('lease', input);
  return { lease, ...verifyFacts(lease, extractFacts(lease)) };
}

function tenantAnswers(input: unknown): TenantAnswer[] {
  if (input === undefined) return [];
  if (typeof input !== 'object' || input === null) throw new Error('tenant must be an object of true/false answers');
  return Object.entries(input).map(([name, value]) => {
    if (typeof value !== 'boolean') throw new Error(`tenant.${name} must be true or false`);
    return { name, value, source: 'answer' };
  });
}

async function prove(args: Record<string, unknown>) {
  const topic = args['topic'];
  if (typeof topic !== 'string' || !TOPICS.some((t) => t.id === topic)) throw new Error(`topic must be one of: ${TOPICS.map((t) => t.id).join(', ')}`);
  const r = readLease(args['lease']);
  return ask({ topic, facts: r.facts, tenant: tenantAnswers(args['tenant']), unread: r.unread });
}

/** Runs one tool and returns its JSON result. Throws with a readable message on bad input. */
export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (name) {
    case 'list_rules':
      return {
        topics: TOPICS.map((t) => ({ id: t.id, question: t.question })),
        rules: Object.entries(RULES).map(([id, r]) => ({ id, section: r.section, title: r.title, text: r.text })),
      };
    case 'read_lease': {
      const r = readLease(args['lease']);
      return {
        name: r.lease.name,
        facts: r.facts.map((f) => ({ fact: `${f.predicate}(${f.args.join(', ')})`, clause: f.clauseId, quote: f.quote })),
        rejected: r.rejected.length,
        unread: r.unread.map((u) => ({ predicate: u.predicate, section: u.number, title: u.title })),
      };
    }
    case 'ask_topic': {
      const a = await prove(args);
      return {
        verdict: a.verdict,
        headline: a.headline,
        steps: a.steps.map((s) => `${s.n}. ${s.title}${s.cite ? ` (${s.cite})` : ''}`),
        unread: a.unread.map((u) => `Section ${u.number} (${u.title})`),
        wouldSettle: a.paths.map((p) => `${p.verdict}: ${p.conditions.join('; ')}`),
        conflict: a.conflict,
      };
    }
    case 'explain_proof': {
      const a = await prove(args);
      return {
        verdict: a.verdict,
        query: a.query,
        steps: a.steps.map((s) => ({ n: s.n, kind: s.kind, title: s.title, cite: s.cite, quote: s.quote, uses: s.uses, prolog: s.prolog })),
        proofTerm: a.proofTerm ?? null,
      };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
