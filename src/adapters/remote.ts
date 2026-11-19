import type { LeaseReader, QuestionTranslator } from './types';
import { ReadLeaseResponseSchema, TranslationSchema } from './schemas';

/**
 * Browser side of the AI path: posts to the app's own API, which calls Bedrock
 * with server-side credentials (see functions/api). Responses are validated
 * here and the facts are verified again by verifyFacts.
 */
export function remoteLeaseReader(baseUrl = ''): LeaseReader {
  return {
    name: 'Claude on Amazon Bedrock',
    async read(lease) {
      const res = await fetch(`${baseUrl}/api/read-lease`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: lease.id, name: lease.name, text: lease.text }),
      });
      if (!res.ok) throw new Error(`lease reader returned ${res.status}`);
      return ReadLeaseResponseSchema.parse(await res.json()).facts;
    },
  };
}

export function remoteQuestionTranslator(baseUrl = ''): QuestionTranslator {
  return {
    name: 'Claude on Amazon Bedrock',
    async translate(question) {
      const res = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`question translator returned ${res.status}`);
      const parsed = TranslationSchema.parse(await res.json());
      return { topic: parsed.topic, tenant: parsed.tenant.map((t) => ({ ...t, source: 'question' as const })) };
    },
  };
}
