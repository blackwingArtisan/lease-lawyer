import type { Answer } from '../logic/ask';
import type { TenantAnswer } from '../logic/program';

interface Props {
  answer: Answer;
  question: string;
  tenant: TenantAnswer[];
  busy: boolean;
  onFollowUp: (name: string, value: boolean) => void;
  /** Scroll to a lease section and move focus to it. */
  onShowClause: (clauseId: string) => void;
}

const STAMP = { yes: 'Yes', no: 'No', unknown: 'Unproven' } as const;
const CANT_TELL = "Can't tell";

/** The verdict stamp, the one-line answer, and, when the proof is open, what it still needs. */
export function VerdictPanel({ answer, question, tenant, busy, onFollowUp, onShowClause }: Props) {
  const answered = new Map(tenant.map((t) => [t.name, t.value]));
  const tenantMissing = answer.missing.filter((m) => m.kind === 'tenant');
  const leaseMissing = answer.missing.filter((m) => m.kind === 'lease');
  // "Can't tell" is its own outcome: the lease does speak to the question, but the reader could not read it.
  const cantTell = answer.verdict === 'unknown' && answer.unread.length > 0;
  const label = cantTell ? CANT_TELL : STAMP[answer.verdict];
  // A new key per answer replays the stamp and the flash without remounting the follow-up buttons.
  const landing = `${answer.query}:${answer.proofTerm ?? ''}:${answer.verdict}`;
  return (
    <div
      className={`verdict verdict-${answer.verdict}${cantTell ? ' verdict-cant-tell' : ''}`}
      data-testid="verdict"
      data-verdict={answer.verdict}
      style={{ ['--steps' as string]: answer.steps.length }}
    >
      <p className="asked">
        <span className="asked-label">You asked</span> {question}
        <span className="asked-topic">Proved as: {answer.question}</span>
      </p>
      <div className="verdict-row">
        {answer.verdict !== 'unknown' && <span key={`flash-${landing}`} className="lightning" aria-hidden="true" />}
        <p key={landing} className="stamp" data-testid="stamp" aria-label={`Verdict: ${label}`}>
          {cantTell && (
            <span className="stamp-mark" aria-hidden="true">
              ?
            </span>
          )}
          {label}
        </p>
        <p className="verdict-headline" data-testid="headline">
          {answer.headline}
        </p>
      </div>

      {answer.unread.length > 0 && (
        <div className="followups" data-testid="unread">
          <p className="followups-title">The reader could not read:</p>
          <ul className="unread-list">
            {answer.unread.map((u) => (
              <li key={u.clauseId}>
                <button type="button" className="linkish" data-testid="show-unread" onClick={() => onShowClause(u.clauseId)}>
                  Section {u.number} ({u.title})
                </button>{' '}
                mentions {u.subjects.join(' and ')}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {tenantMissing.length > 0 && (
        <div className="followups" data-testid="followups">
          <p className="followups-title">The circuit is open. Close it by answering:</p>
          {tenantMissing.map((m) => (
            <fieldset key={m.name} className="followup">
              <legend>{m.question}</legend>
              <div className="followup-buttons">
                <button type="button" className="chip yes" disabled={busy} aria-pressed={answered.get(m.name) === true} onClick={() => onFollowUp(m.name, true)}>
                  Yes
                </button>
                <button type="button" className="chip no" disabled={busy} aria-pressed={answered.get(m.name) === false} onClick={() => onFollowUp(m.name, false)}>
                  No
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {leaseMissing.length > 0 && (
        <div className="followups" data-testid="lease-missing">
          <p className="followups-title">The lease never states:</p>
          <ul>
            {leaseMissing.map((m) => (
              <li key={m.predicate}>{m.topic}</li>
            ))}
          </ul>
        </div>
      )}

      {answer.paths.length > 0 && (
        <details className="paths">
          <summary>What would settle it</summary>
          <ul>
            {answer.paths.map((p, i) => (
              <li key={i}>
                <strong>{p.verdict === 'yes' ? 'Yes' : 'No'}</strong> if {p.conditions.join(' and ').replace(/^./, (c) => c.toLowerCase())}.
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
