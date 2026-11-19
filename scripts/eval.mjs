#!/usr/bin/env node
/**
 * npm run eval
 *
 * Reproduces the "confident wrong answers, 4 of 8 down to 0" result. Two
 * invented leases in tests/holdout/ were written after the first reader, with
 * wording unlike the samples. This scores today's reader and prover on them,
 * and the first version of the app (the repository's first commit, rebuilt
 * from git history), against the answer key in tests/holdout/answer-key.json.
 *
 *   npm run eval                     today vs the first commit
 *   npm run eval -- --baseline <ref> today vs any commit or tag
 *   npm run eval -- --no-baseline    today only
 *   npm run eval -- --json           print the raw scores
 *
 * Exits 1 if today's reader keeps a fact the lease does not state or gives a
 * Yes or No resting on the lease being silent about something it covers.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function baselineTree() {
  if (flag('--no-baseline')) return null;
  let sha;
  try {
    const ref = option('--baseline') ?? git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0];
    sha = git('rev-parse', '--short', `${ref}^{commit}`);
  } catch {
    console.warn('No git history here (a shallow clone?), so only today\'s reader is scored.\n');
    return null;
  }
  // Inside the repository, so the old source resolves this checkout's node_modules.
  const dir = join(root, '.eval-cache', sha);
  if (!existsSync(join(dir, 'src'))) {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['archive', '--format=tar', sha, 'src'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  return { label: sha === git('rev-parse', '--short', 'HEAD') ? `${sha} (HEAD)` : `first version, ${sha}`, dir };
}

const roots = [];
const base = baselineTree();
if (base) roots.push(base);
roots.push({ label: 'today', dir: root });

const work = mkdtempSync(join(tmpdir(), 'lease-lawyer-eval-'));
const outFile = join(work, 'scores.json');
const run = spawnSync('npx', ['vitest', 'run', '--config', 'tests/holdout/vitest.eval.config.ts', '--reporter=dot'], {
  cwd: root,
  env: { ...process.env, EVAL_ROOTS: JSON.stringify(roots), EVAL_OUT: outFile },
  encoding: 'utf8',
});
if (run.status !== 0 || !existsSync(outFile)) {
  process.stderr.write(run.stdout + run.stderr);
  process.exit(2);
}
const scores = JSON.parse(readFileSync(outFile, 'utf8'));
rmSync(work, { recursive: true, force: true });

if (flag('--json')) {
  console.log(JSON.stringify(scores, null, 2));
} else {
  const topics = scores[0].leases[0].topics.length;
  const rows = [];
  for (const [i, lease] of scores[0].leases.entries()) {
    const cells = (f) => scores.map((s) => f(s.leases[i]));
    rows.push([lease.name, '', ...scores.map(() => '')]);
    rows.push(['', 'facts read', ...cells((l) => `${l.factsRead} of ${l.factsExpected}`)]);
    rows.push(['', 'facts kept that the lease does not state', ...cells((l) => String(l.wrongFacts.length))]);
    rows.push(['', 'Yes/No resting on a false "silent"', ...cells((l) => `${l.falselySilent} of ${topics}`)]);
    rows.push(['', '"Can\'t tell", naming the section', ...cells((l) => `${l.cantTell} of ${topics}`)]);
  }
  const header = ['Holdout lease', 'Measure', ...scores.map((s) => s.label)];
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c].length)));
  const line = (r) => r.map((cell, c) => cell.padEnd(widths[c])).join('  ').trimEnd();
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));

  for (const s of scores) {
    const wrong = s.leases.flatMap((l) => l.topics.filter((t) => t.falseSilence.length).map((t) => ({ lease: l.id, ...t })));
    if (!wrong.length) continue;
    console.log(`\n${s.label}: answers resting on a false "silent"`);
    for (const t of wrong) console.log(`  ${t.lease} ${t.topic}: ${t.verdict.toUpperCase()}, assumes the lease is silent on ${t.falseSilence.join(', ')}`);
  }
}

const today = scores.at(-1).leases;
const failed = today.some((l) => l.wrongFacts.length || l.falselySilent);
process.exit(failed ? 1 : 0);
