import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { clauseText } from '../lease/parse';
import type { ParsedLease } from '../lease/types';
import type { LeaseReader, QuestionTranslator } from './types';
import { ReadLeaseResponseSchema, TranslationSchema, tenantFactsPrompt, topicsPrompt, vocabularyPrompt } from './schemas';

/**
 * Server-only AI path: Claude on Amazon Bedrock reads clauses into facts and
 * questions into topics. It runs in the API functions, never in the browser,
 * so AWS credentials stay on the server. Output is constrained by structured
 * outputs, then validated and verified like any other reader's.
 */
export interface BedrockConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  model?: string;
}

/**
 * Bedrock model IDs are the Anthropic model ID with an `anthropic.` prefix, and
 * `AnthropicBedrockMantle` is the SDK's client for Bedrock's Messages API endpoint
 * (`bedrock-mantle.{region}.api.aws/anthropic`, SigV4-signed). Model access is
 * enabled per AWS account and region, so set `BEDROCK_MODEL_ID` to override.
 */
export const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-opus-5-5';

function client(config: BedrockConfig) {
  return new AnthropicBedrockMantle({
    awsRegion: config.region,
    awsAccessKey: config.accessKeyId,
    awsSecretAccessKey: config.secretAccessKey,
    awsSessionToken: config.sessionToken ?? null,
  });
}

const READER_SYSTEM = `You convert residential lease clauses into facts for a Prolog rule engine.
Use only the predicates listed below, with arguments of the listed kinds. Money is a plain number of dollars, counts are whole numbers.
Emit a fact only when a clause states it outright. If a clause is silent, emit nothing for it; the engine treats silence on its own.
For every fact, copy into "quote" the exact sentence from that clause that supports it, character for character, and give the clause id.
Facts whose quote is not found verbatim in the clause are discarded automatically.

Predicates:
${vocabularyPrompt()}`;

function leaseForPrompt(lease: ParsedLease): string {
  return lease.clauses.map((c) => `<clause id="${c.id}">\n${clauseText(lease, c)}\n</clause>`).join('\n');
}

export function bedrockLeaseReader(config: BedrockConfig): LeaseReader {
  const anthropic = client(config);
  return {
    name: 'Claude on Amazon Bedrock',
    async read(lease) {
      const response = await anthropic.messages.parse({
        model: config.model ?? DEFAULT_BEDROCK_MODEL,
        max_tokens: 16000,
        system: READER_SYSTEM,
        output_config: { effort: 'medium', format: zodOutputFormat(ReadLeaseResponseSchema) },
        messages: [{ role: 'user', content: `Lease "${lease.name}":\n${leaseForPrompt(lease)}` }],
      });
      if (response.stop_reason === 'refusal') throw new Error('the model declined to read this lease');
      return response.parsed_output?.facts ?? [];
    },
  };
}

const TRANSLATOR_SYSTEM = `You route a renter's question to exactly one topic that a Prolog rule base can prove, or null if none fits.
Also list facts about the renter that the question itself states (value true) or denies (value false). Do not guess facts the question does not state.

Topics:
${topicsPrompt()}

Renter facts:
${tenantFactsPrompt()}`;

export function bedrockQuestionTranslator(config: BedrockConfig): QuestionTranslator {
  const anthropic = client(config);
  return {
    name: 'Claude on Amazon Bedrock',
    async translate(question) {
      const response = await anthropic.messages.parse({
        model: config.model ?? DEFAULT_BEDROCK_MODEL,
        max_tokens: 2000,
        system: TRANSLATOR_SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(TranslationSchema) },
        messages: [{ role: 'user', content: question }],
      });
      if (response.stop_reason === 'refusal') throw new Error('the model declined to translate this question');
      const parsed = response.parsed_output;
      if (!parsed) return { topic: null, tenant: [] };
      return { topic: parsed.topic, tenant: parsed.tenant.map((t) => ({ ...t, source: 'question' as const })) };
    },
  };
}
