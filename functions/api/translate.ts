import { bedrockQuestionTranslator } from '../../src/adapters/bedrock';
import { TranslateRequestSchema } from '../../src/adapters/schemas';
import { bedrockConfig, json, type FunctionContext } from './_env';

/** POST /api/translate: Bedrock maps a question to a topic and tenant facts. */
export async function onRequestPost({ request, env }: FunctionContext): Promise<Response> {
  const config = bedrockConfig(env);
  if (!config) return json({ error: 'Bedrock is not configured' }, 503);
  const body = TranslateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: 'expected { question }' }, 400);
  const translation = await bedrockQuestionTranslator(config).translate(body.data.question);
  return json({ topic: translation.topic, tenant: translation.tenant.map(({ name, value }) => ({ name, value })) });
}
