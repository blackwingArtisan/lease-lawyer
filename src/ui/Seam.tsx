import { cueSubject } from '../lease/coverage';
import type { CandidateFact, RejectedFact, VerificationResult } from '../lease/types';
import { checkArgs, predicateSpec } from '../lease/vocabulary';
import type { Answer } from '../logic/ask';

interface Props {
  readerName: string;
  verification: VerificationResult;
  answer: Answer;
  /** Scroll to a lease section and move focus to it. */
  onShowClause?: (clauseId: string) => void;
}

const OUTCOME = { yes: 'Proved Yes', no: 'Proved No', unknown: 'No proof either way' } as const;

/** The claim a candidate made, in words. An unknown predicate or bad arguments are shown as the reader wrote them. */
export function claimText(c: CandidateFact): string {
  const spec = predicateSpec(c.predicate);
  if (spec && checkArgs(spec, c.args) === null) return spec.describe(c.args);
  return `${c.predicate}(${c.args.join(', ')})`;
}

/** One line of the struck list. A rejection with no section number gets no section button. */
export function StruckLine({ rejected, onShowClause }: { rejected: RejectedFact; onShowClause?: (clauseId: string) => void }) {
  const { candidate, reason, section } = rejected;
  return (
    <li className="struck-line" data-testid="struck-line" data-code={rejected.code}>
      <span className="struck-badge">
        <span aria-hidden="true">&#x2715; </span>STRUCK FROM THE RECORD
      </span>
      <span className="struck-topic">About {cueSubject(candidate.predicate)}</span>
      <del className="struck-claim">{claimText(candidate)}</del>
      <q className="struck-quote">{candidate.quote}</q>
      <span className="struck-reason" data-testid="struck-reason">
        {reason}
      </span>
      {section !== null && (
        <button type="button" className="chip struck-section" data-testid="struck-section" onClick={() => onShowClause?.(candidate.clauseId)}>
          Section {section}
        </button>
      )}
    </li>
  );
}

/** The list of every fact the verifier threw out, one line each: exactly `rejected`, in order. */
export function StruckList({ rejected, onShowClause }: { rejected: RejectedFact[]; onShowClause?: (clauseId: string) => void }) {
  if (rejected.length === 0) return null;
  return (
    <section className="struck" aria-labelledby="struck-title" data-testid="struck-list">
      <h3 id="struck-title" className="struck-title">
        Struck from the record ({rejected.length})
      </h3>
      <ul className="struck-lines" aria-labelledby="struck-title">
        {rejected.map((r, i) => (
          <StruckLine key={i} rejected={r} onShowClause={onShowClause} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The stitch, shown on every answer: what the reader proposed, what the verifier kept and struck,
 * and what Prolog proved from it. The model reads; Prolog decides.
 */
export function Seam({ readerName, verification, answer, onShowClause }: Props) {
  const kept = verification.facts.length;
  const struck = verification.rejected.length;
  const unread = verification.unread.length;
  return (
    <div className="seam-wrap">
      <ol className="seam" aria-label="How this answer was made" data-testid="seam">
        <li className="seam-part">
          <span className="seam-label">Reader</span>
          <span className="seam-value" data-testid="reader-name">
            {readerName}
          </span>
          <span className="seam-note">{kept + struck} facts proposed</span>
        </li>
        <li className="seam-part">
          <span className="seam-label">Verifier</span>
          <span className="seam-value">{kept} kept word for word</span>
          <span className="seam-note" data-testid="struck-count">
            {struck} struck from the record{unread > 0 ? `, ${unread} unreadable` : ''}
          </span>
        </li>
        <li className="seam-part">
          <span className="seam-label">Prolog</span>
          <span className="seam-value">{OUTCOME[answer.verdict]}</span>
          <span className="seam-note">{answer.steps.length > 0 ? `${answer.steps.length} cited steps` : 'nothing assumed'}</span>
        </li>
      </ol>
      <StruckList rejected={verification.rejected} onShowClause={onShowClause} />
    </div>
  );
}
