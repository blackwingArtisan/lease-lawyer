import { useEffect, useMemo, useRef } from 'react';
import type { LeaseFact, ParsedLease } from '../lease/types';
import { predicateSpec } from '../lease/vocabulary';
import { clauseSegments } from './segments';

interface Props {
  lease: ParsedLease;
  facts: LeaseFact[];
  cited: ReadonlySet<string>;
  /** A fact id, or a clause id when `clause` is set. */
  focus: { id: string; nonce: number; clause?: boolean } | null;
}

/** The lease as a parchment document. Extracted facts are underlined; cited ones glow. */
export function LeasePane({ lease, facts, cited, focus }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const describe = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of facts) m.set(f.id, predicateSpec(f.predicate)?.describe(f.args) ?? f.predicate);
    return m;
  }, [facts]);

  useEffect(() => {
    if (!focus || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>(focus.clause ? `[data-clause="${focus.id}"]` : `[data-fact~="${focus.id}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    el.focus({ preventScroll: true });
  }, [focus]);

  const preamble = lease.clauses.length > 0 ? lease.text.slice(0, lease.clauses[0]!.start).trim() : lease.text.trim();

  return (
    <div className="parchment" ref={scroller} data-testid="lease" tabIndex={0} aria-label={`Text of ${lease.name}`}>
      {preamble && (
        <header className="lease-head">
          {preamble.split('\n').map((line, i) => (
            <p key={i} className={i === 0 ? 'lease-kind' : 'lease-name'}>
              {line}
            </p>
          ))}
        </header>
      )}
      {lease.clauses.length === 0 && (
        <p className="lease-warning">No numbered sections were found, so nothing could be cited. Number each section like &ldquo;4. RENT.&rdquo;</p>
      )}
      {lease.clauses.map((clause) => (
        <p key={clause.id} id={`clause-${clause.id}`} className="clause" data-clause={clause.id} tabIndex={-1}>
          {clauseSegments(lease, clause, facts, cited).map((seg) =>
            seg.factIds.length === 0 ? (
              <span key={seg.start}>{seg.text}</span>
            ) : (
              <mark
                key={seg.start}
                className={seg.cited ? 'fact cited' : 'fact'}
                data-fact={seg.factIds.join(' ')}
                data-testid={seg.cited ? 'cited-span' : undefined}
                tabIndex={-1}
                title={seg.factIds.map((id) => describe.get(id)).join(' · ')}
              >
                {seg.text}
              </mark>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
