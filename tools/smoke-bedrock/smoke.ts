// npm run smoke:bedrock [-- --yes] [--max-usd 1] [--out docs/bedrock-smoke]
//
// Reads the four sample leases and the two holdout leases with Claude on Amazon Bedrock,
// verifies every proposed fact exactly as the app does, and records the readings, the struck
// quotes, the holdout scores and the cost. Without --yes it only prints the plan and an
// estimate; nothing is sent. Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY,
// or from the AWS profile in AWS_PROFILE. Not run in tests or CI.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bedrockReadingFn, DEFAULT_BEDROCK_MODEL, READER_SYSTEM, type BedrockConfig } from '../../src/adapters/bedrock';
import { SAMPLE_LEASES } from '../../src/lease/fixtures';
import key from '../../tests/holdout/answer-key.json';
import holdoutA from '../../tests/holdout/holdout-a-thornbury.txt?raw';
import holdoutB from '../../tests/holdout/holdout-b-penhallow.txt?raw';
import type { AnswerKey } from '../../tests/holdout/score';
import { estimateUsd, runSmoke, summaryMarkdown, type Prices, type SmokeLease } from './run';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
const model = process.env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL;
const maxUsd = Number(option('--max-usd') ?? 1);
const outDir = option('--out') ?? 'docs/bedrock-smoke';
// Anthropic's first-party list price for the default model. Bedrock bills at its own rates; pass yours.
const prices: Prices = {
  inputPerMTok: Number(option('--price-in') ?? 4),
  outputPerMTok: Number(option('--price-out') ?? 20),
  basis: option('--price-in') || option('--price-out') ? 'as passed on the command line' : 'estimated at $4 / $20 per million input / output tokens',
};

const texts: Record<string, string> = { 'holdout-a-thornbury.txt': holdoutA, 'holdout-b-penhallow.txt': holdoutB };
const leases: SmokeLease[] = [
  ...SAMPLE_LEASES.map((s) => ({ id: s.id, name: s.name, text: s.text })),
  ...(key as AnswerKey).leases.map((k) => ({ id: k.id, name: k.name, text: texts[k.file]!, key: k })),
];

const estimate = leases.reduce((sum, l) => sum + estimateUsd(l, READER_SYSTEM.length, prices), 0);
console.log(`Bedrock smoke run: ${leases.length} leases, model ${model}, region ${region}`);
console.log(`Estimated cost at most $${estimate.toFixed(2)} (${prices.basis}); cap $${maxUsd.toFixed(2)}.`);

if (!args.includes('--yes')) {
  for (const l of leases) console.log(`  ${l.id.padEnd(18)} ${String(l.text.length).padStart(5)} chars  ~$${estimateUsd(l, READER_SYSTEM.length, prices).toFixed(3)}`);
  console.log('\nNothing was sent. Run `npm run smoke:bedrock -- --yes` to call Bedrock.');
  process.exit(0);
}

const config: BedrockConfig =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { region, model, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, sessionToken: process.env.AWS_SESSION_TOKEN }
    : { region, model, profile: process.env.AWS_PROFILE ?? 'default' };

mkdirSync(outDir, { recursive: true });
const result = await runSmoke({
  leases,
  read: bedrockReadingFn(config),
  prices,
  maxUsd,
  systemChars: READER_SYSTEM.length,
  onRecord: (r) => {
    writeFileSync(join(outDir, `${r.lease.id}.json`), JSON.stringify(r, null, 2) + '\n');
    const h = r.holdout ? `, holdout ${r.holdout.factsRead}/${r.holdout.factsExpected} facts, ${r.holdout.falselySilent} falsely silent` : '';
    console.log(`  ${r.lease.id.padEnd(18)} proposed ${r.proposed}, kept ${r.kept.length}, struck ${r.struck.length}, unread ${r.unread.length}${h}, $${r.costUsd.toFixed(4)}`);
  },
});
writeFileSync(join(outDir, 'README.md'), summaryMarkdown(result, region));
console.log(`\nTotal $${result.totalUsd.toFixed(4)}. Wrote ${result.records.length} readings and a summary to ${outDir}/.`);
