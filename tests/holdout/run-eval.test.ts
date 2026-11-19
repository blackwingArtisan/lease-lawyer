import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import key from './answer-key.json';
import { scoreLease, type AnswerKey, type LeaseScore, type ReaderApi } from './score';

/**
 * Scores each source tree named in EVAL_ROOTS (a JSON list of {label, dir})
 * against the holdout leases and writes the results to EVAL_OUT. Driven by
 * scripts/eval.mjs.
 */
it('scores each source tree on the holdout leases', async () => {
  const roots = JSON.parse(process.env.EVAL_ROOTS ?? '[]') as { label: string; dir: string }[];
  const out: { label: string; leases: LeaseScore[] }[] = [];
  for (const { label, dir } of roots) {
    const load = (path: string) => import(/* @vite-ignore */ join(dir, path));
    const api = {
      ...(await load('src/lease/parse.ts')),
      ...(await load('src/lease/extract.ts')),
      ...(await load('src/lease/verify.ts')),
      ...(await load('src/logic/ask.ts')),
      ...(await load('src/logic/topics.ts')),
    } as ReaderApi;
    const leases: LeaseScore[] = [];
    for (const entry of (key as AnswerKey).leases) {
      const text = readFileSync(new URL(entry.file, import.meta.url), 'utf8');
      leases.push(await scoreLease(api, entry, text));
    }
    out.push({ label, leases });
  }
  writeFileSync(process.env.EVAL_OUT ?? 'eval-results.json', JSON.stringify(out, null, 2));
});
