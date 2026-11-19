import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProverServer } from '../../tools/mcp-prover/server';
import { RULES } from '../../src/logic/rules';

const client = new Client({ name: 'test', version: '0' });

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createProverServer().connect(a);
  await client.connect(b);
});
afterAll(() => client.close());

async function call(name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { error: r.isError === true, text: r.content[0]!.text, json: () => JSON.parse(r.content[0]!.text) };
}

describe('the prover MCP server', () => {
  it('lists its four tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['list_rules', 'read_lease', 'ask_topic', 'explain_proof']);
  });

  it('lists every rule in the rule base', async () => {
    const { rules } = (await call('list_rules')).json();
    expect(rules.map((r: { id: string }) => r.id)).toEqual(Object.keys(RULES));
  });

  it('reads a sample lease with its unreadable clauses', async () => {
    const r = (await call('read_lease', { lease: 'hollowmere-flats' })).json();
    expect(r.facts).toHaveLength(6);
    expect(r.unread.map((u: { predicate: string }) => u.predicate)).toEqual(['deposit_deduction', 'pet_policy', 'entry_notice_hours']);
  });

  it('proves the same answer the app shows, with cited steps', async () => {
    const r = (await call('ask_topic', { topic: 'wear_and_tear', lease: 'gaslight-row' })).json();
    expect(r.verdict).toBe('no');
    expect(r.steps[0]).toBe('1. Landlord holds a security deposit of $3,600 (Lease §6)');
  });

  it('takes lease text and tenant answers', async () => {
    const lease = '1. RENT. Monthly rent is $1,000.00.\n\n2. PETS. No pets of any kind are allowed.';
    expect((await call('ask_topic', { topic: 'pets', lease })).json().verdict).toBe('unknown');
    expect((await call('ask_topic', { topic: 'pets', lease, tenant: { assistance_animal: true } })).json().verdict).toBe('yes');
  });

  it('explains a proof down to the Prolog term', async () => {
    const r = (await call('explain_proof', { topic: 'wear_and_tear', lease: 'gaslight-row' })).json();
    expect(r.query).toBe('verdict(wear_and_tear, no)');
    expect(r.steps.some((s: { quote?: string }) => s.quote?.includes('normal wear and tear'))).toBe(true);
    expect(r.proofTerm).toMatch(/^rule\(wear_clause_void/);
  });

  it('reports bad input as a tool error', async () => {
    const r = await call('ask_topic', { topic: 'parking', lease: 'gaslight-row' });
    expect(r.error).toBe(true);
    expect(r.text).toMatch(/^topic must be one of/);
  });
});
