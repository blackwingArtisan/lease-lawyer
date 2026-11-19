import { localLeaseReader, localQuestionTranslator } from './local';
import { remoteLeaseReader, remoteQuestionTranslator } from './remote';
import type { Adapters } from './types';

export type Backend = 'local' | 'bedrock';

export function parseBackend(value: string | undefined): Backend {
  return value === 'bedrock' ? 'bedrock' : 'local';
}

/**
 * Picks the adapters from VITE_AI_BACKEND. The default, "local", is free and
 * offline. "bedrock" routes through the app's API to Claude on Amazon Bedrock.
 */
export function createAdapters(backend: Backend): Adapters {
  if (backend === 'bedrock') {
    return { reader: remoteLeaseReader(), translator: remoteQuestionTranslator() };
  }
  return { reader: localLeaseReader, translator: localQuestionTranslator };
}
