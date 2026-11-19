import type Tau from 'tau-prolog';
import { loadTau, type TauProlog } from './tau-loader';
import type { PTerm } from './terms';

const STEP_LIMIT = 500_000;

type TauTerm = Tau.type.Term | Tau.type.Num | Tau.type.Var;

/** Converts a Tau Prolog term to plain data. */
export function fromTau(pl: TauProlog, t: TauTerm): PTerm {
  if (t instanceof pl.type.Num) return { type: 'num', value: t.value };
  if (t instanceof pl.type.Var) return { type: 'var', name: t.id };
  if (t.args.length === 0) return { type: 'atom', name: t.id };
  return { type: 'compound', name: t.id, args: t.args.map((a) => fromTau(pl, a)) };
}

/**
 * A thin promise wrapper around one Tau Prolog session. Tau Prolog
 * (BSD-3-Clause, tau-prolog.org) is an ISO Prolog interpreter written in
 * JavaScript; it runs the same in the browser and in Node.
 */
export class PrologSession {
  private constructor(
    private readonly pl: TauProlog,
    private readonly session: Tau.type.Session,
  ) {}

  static async load(...programs: string[]): Promise<PrologSession> {
    const pl = await loadTau();
    const session = pl.create(STEP_LIMIT);
    await new Promise<void>((resolve, reject) => {
      session.consult(programs.join('\n\n'), {
        text: true,
        file: false,
        url: false,
        html: false,
        script: false,
        success: resolve,
        error: (err) => reject(new Error(`Prolog program did not load: ${err.toString()}`)),
      });
    });
    return new PrologSession(pl, session);
  }

  /** Runs a goal and returns the bindings of the named variables for the first answer, or null if it fails. */
  once(goal: string, vars: string[]): Promise<Record<string, PTerm> | null> {
    const session = this.session;
    return new Promise((resolve, reject) => {
      const fail = (err: { toString(): string }) => reject(new Error(`Prolog error in ${goal}: ${err.toString()}`));
      session.query(goal.trim().replace(/\.?$/, '.'), {
        error: fail,
        success: () => {
          session.answer({
            success: (answer) => {
              const out: Record<string, PTerm> = {};
              for (const v of vars) {
                const bound = answer.lookup(v);
                out[v] = bound ? fromTau(this.pl, bound) : { type: 'var', name: v };
              }
              resolve(out);
            },
            fail: () => resolve(null),
            error: fail,
            limit: () => reject(new Error(`Prolog step limit reached in ${goal}`)),
          });
        },
      });
    });
  }
}
