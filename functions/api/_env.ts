import type { BedrockConfig } from '../../src/adapters/bedrock';

/** Bindings for the Cloudflare Pages Functions. Secrets are set in the Pages dashboard, never in the repo. */
export interface Env {
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  BEDROCK_MODEL_ID?: string;
}

export interface FunctionContext {
  request: Request;
  env: Env;
}

export function bedrockConfig(env: Env): BedrockConfig | null {
  if (!env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) return null;
  return {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
    model: env.BEDROCK_MODEL_ID,
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
