import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Keeps each Kiro spec's task list honest: every requirement a task cites
 * exists, and no task is checked while one of its sub-tasks is still open.
 */
const root = '.kiro/specs';
const specs = readdirSync(root).filter((d) => existsSync(`${root}/${d}/tasks.md`));

interface Task {
  line: number;
  depth: number;
  done: boolean;
  text: string;
}

function tasks(spec: string): Task[] {
  return readFileSync(`${root}/${spec}/tasks.md`, 'utf8')
    .split('\n')
    .flatMap((text, i) => {
      const m = /^(\s*)- \[( |x)\] (.*)$/.exec(text);
      return m ? [{ line: i + 1, depth: m[1]!.length, done: m[2] === 'x', text: m[3]! }] : [];
    });
}

function requirementIds(spec: string): Set<string> {
  const path = `${root}/${spec}/requirements.md`;
  const ids = new Set<string>();
  if (!existsSync(path)) return ids;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const heading = /^## Requirement (\d+)\b/.exec(line);
    if (heading) ids.add(heading[1]!);
    const criterion = /^(\d+\.\d+) /.exec(line);
    if (criterion) ids.add(criterion[1]!);
  }
  return ids;
}

/** "Req 1, 2.4, 2.10-2.12" -> ["1", "2.4", "2.10", "2.11", "2.12"] */
export function citedRequirements(task: string): string[] {
  const out: string[] = [];
  for (const [, list] of task.matchAll(/\(Req ([^)]*)\)/g)) {
    for (const part of list!.split(',').map((p) => p.trim())) {
      const range = /^(\d+)\.(\d+)-(\d+)\.(\d+)$/.exec(part);
      if (range && range[1] === range[3]) {
        for (let n = Number(range[2]); n <= Number(range[4]); n++) out.push(`${range[1]}.${n}`);
      } else {
        out.push(part);
      }
    }
  }
  return out;
}

describe('citedRequirements', () => {
  it('expands lists and ranges', () => {
    expect(citedRequirements('x (Req 1, 2.4, 2.10-2.12)')).toEqual(['1', '2.4', '2.10', '2.11', '2.12']);
  });
});

describe.each(specs)('spec %s', (spec) => {
  const ids = requirementIds(spec);
  const list = tasks(spec);

  it('has tasks', () => {
    expect(list.length).toBeGreaterThan(0);
  });

  it('cites only requirements that exist', () => {
    const missing = list.flatMap((t) => citedRequirements(t.text).filter((r) => !ids.has(r)).map((r) => `line ${t.line}: Req ${r}`));
    expect(missing).toEqual([]);
  });

  it('checks a task only when all of its sub-tasks are checked', () => {
    const open: string[] = [];
    list.forEach((t, i) => {
      if (!t.done) return;
      for (const child of list.slice(i + 1)) {
        if (child.depth <= t.depth) break;
        if (!child.done) open.push(`line ${t.line} is checked but line ${child.line} is open`);
      }
    });
    expect(open).toEqual([]);
  });
});
