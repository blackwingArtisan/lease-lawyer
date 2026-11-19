import { z } from 'zod';
import { TOPICS } from '../logic/topics';
import { PREDICATES, TENANT_FACTS } from '../lease/vocabulary';

/** Wire shapes shared by the AI adapters and the HTTP endpoints. Anything that fails these is dropped. */
export const CandidateFactSchema = z.object({
  predicate: z.string(),
  args: z.array(z.union([z.string(), z.number()])),
  clauseId: z.string(),
  quote: z.string(),
});

export const ReadLeaseResponseSchema = z.object({
  facts: z.array(CandidateFactSchema),
});

const topicIds = TOPICS.map((t) => t.id) as [string, ...string[]];
const tenantNames = TENANT_FACTS.map((t) => t.name) as [string, ...string[]];

export const TranslationSchema = z.object({
  topic: z.enum(topicIds).nullable(),
  tenant: z.array(
    z.object({
      name: z.enum(tenantNames),
      value: z.boolean(),
    }),
  ),
});

export const ReadLeaseRequestSchema = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
  text: z.string().min(1).max(200_000),
});

export const TranslateRequestSchema = z.object({
  question: z.string().min(1).max(2000),
});

/** The fact vocabulary written out for a model prompt. */
export function vocabularyPrompt(): string {
  return PREDICATES.map((p) => {
    const args = p.args.map((a) => (a.kind === 'atom' ? `one of ${a.values.join('|')}` : a.kind)).join(', ');
    return `- ${p.name}(${args}): ${p.topic}`;
  }).join('\n');
}

export function topicsPrompt(): string {
  return TOPICS.map((t) => `- ${t.id}: ${t.question}`).join('\n');
}

export function tenantFactsPrompt(): string {
  return TENANT_FACTS.map((t) => `- ${t.name}: ${t.question}`).join('\n');
}
