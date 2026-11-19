import type { VerificationResult } from '../lease/types';
import type { Answer } from '../logic/ask';

interface Props {
  readerName: string;
  verification: VerificationResult;
  answer: Answer;
}

const OUTCOME = { yes: 'Proved Yes', no: 'Proved No', unknown: 'No proof either way' } as const;

/**
 * The stitch, shown on every answer: what the reader proposed, what the verifier kept and struck,
 * and what Prolog proved from it. The model reads; Prolog decides.
 */
export function Seam({ readerName, verification, answer }: Props) {
  const kept = verification.facts.length;
  const struck = verification.rejected.length;
  const unread = verification.unread.length;
  return (
    <ol className="seam" aria-label="How this answer was made" data-testid="seam">
      <li className="seam-part">
        <span className="seam-label">Reader</span>
        <span className="seam-value">{readerName}</span>
        <span className="seam-note">{kept + struck} facts proposed</span>
      </li>
      <li className="seam-part">
        <span className="seam-label">Verifier</span>
        <span className="seam-value">{kept} kept word for word</span>
        <span className="seam-note">
          {struck} struck from the record{unread > 0 ? `, ${unread} unreadable` : ''}
        </span>
      </li>
      <li className="seam-part">
        <span className="seam-label">Prolog</span>
        <span className="seam-value">{OUTCOME[answer.verdict]}</span>
        <span className="seam-note">{answer.steps.length > 0 ? `${answer.steps.length} cited steps` : 'nothing assumed'}</span>
      </li>
    </ol>
  );
}
