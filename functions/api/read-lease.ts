import { bedrockLeaseReader } from '../../src/adapters/bedrock';
import { ReadLeaseRequestSchema } from '../../src/adapters/schemas';
import { parseLease } from '../../src/lease/parse';
import { bedrockConfig, json, type FunctionContext } from './_env';

/** POST /api/read-lease: Bedrock reads a lease into candidate facts. */
export async function onRequestPost({ request, env }: FunctionContext): Promise<Response> {
  const config = bedrockConfig(env);
  if (!config) return json({ error: 'Bedrock is not configured' }, 503);
  const body = ReadLeaseRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: 'expected { id, name, text }' }, 400);
  const lease = parseLease(body.data.id, body.data.text, body.data.name);
  const facts = await bedrockLeaseReader(config).read(lease);
  return json({ facts });
}
