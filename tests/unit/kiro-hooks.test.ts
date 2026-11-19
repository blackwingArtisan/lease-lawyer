import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = '.kiro/hooks';
const files = readdirSync(dir);
const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));

type Hook = { name: string; trigger: string; matcher?: string; action: { type: string; command?: string; prompt?: string } };
const hooks: Record<string, Hook> = Object.fromEntries(files.filter((f) => f.endsWith('.json')).map((f) => [f, read(f).hooks[0]]));
const matches = (f: string, path: string) => new RegExp(hooks[f]!.matcher!).test(path);

describe('Kiro agent hooks', () => {
  it('are valid v1 hook files with a known trigger and action', () => {
    for (const f of Object.keys(hooks)) {
      const file = read(f);
      expect(file.version, f).toBe('v1');
      expect(file.hooks.length, f).toBeGreaterThan(0);
      for (const h of file.hooks as Hook[]) {
        expect(['PostFileSave', 'Stop'], f).toContain(h.trigger);
        expect(h.action.type === 'command' ? h.action.command : h.action.prompt, f).toBeTruthy();
      }
    }
  });

  // The agent reports saved files by absolute path in some sessions and by repo-relative path in others.
  it.each(['', '/home/dev/lease-lawyer/'])('match the files they guard, with prefix "%s"', (prefix) => {
    expect(matches('extraction-guard.json', `${prefix}src/lease/extract.ts`)).toBe(true);
    expect(matches('extraction-guard.json', `${prefix}src/lease/coverage.ts`)).toBe(true);
    expect(matches('extraction-guard.json', `${prefix}src/lease/verify.ts`)).toBe(false);
    expect(matches('rulebase-guard.json', `${prefix}src/logic/rulebase.pl`)).toBe(true);
    expect(matches('rulebase-guard.json', `${prefix}src/logic/rules.ts`)).toBe(true);
    expect(matches('rulebase-guard.json', `${prefix}src/logic/ask.ts`)).toBe(false);
    expect(matches('test-on-save.json', `${prefix}src/ui/App.tsx`)).toBe(true);
    expect(matches('test-on-save.json', `${prefix}tests/unit/pdf.test.ts`)).toBe(true);
    expect(matches('test-on-save.json', `${prefix}README.md`)).toBe(false);
  });

  it('do not fire on look-alike paths outside src/', () => {
    expect(matches('extraction-guard.json', 'notsrc/lease/extract.ts')).toBe(false);
    expect(matches('rulebase-guard.json', 'docs/src/logic/rules.tsx')).toBe(false);
  });
});

describe('Kiro IDE hook copies', () => {
  for (const f of files.filter((f) => f.endsWith('.kiro.hook'))) {
    it(`${f} asks the agent the same thing as its agent hook`, () => {
      const ide = read(f);
      expect(ide.when.type).toBe('fileEdited');
      expect(ide.then.type).toBe('askAgent');
      const twin = hooks[f.replace('.kiro.hook', '.json')]!;
      expect(ide.then.prompt).toBe(twin.action.prompt);
      for (const pattern of ide.when.patterns as string[]) expect(new RegExp(twin.matcher!).test(pattern), pattern).toBe(true);
    });
  }
});
