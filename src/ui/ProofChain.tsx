import type { ProofStep, StepKind } from '../logic/proof';

const KIND_LABEL: Record<StepKind, string> = {
  lease: 'Lease',
  absent: 'Lease is silent',
  tenant: 'You',
  calc: 'Arithmetic',
  law: 'Model code',
  inference: 'Rule',
  verdict: 'Verdict',
  assumed: 'Missing',
};

interface Props {
  steps: ProofStep[];
  onShowClause: (factId: string) => void;
}

/**
 * The proof as a chain of electrodes: evidence first, then each rule as it
 * fires, ending in the verdict. Lease steps link to the highlighted clause.
 */
export function ProofChain({ steps, onShowClause }: Props) {
  return (
    <section className="chain-wrap" aria-labelledby="chain-heading">
      <h3 id="chain-heading" className="chain-title">
        Proof chain <span className="chain-count">{steps.length} steps</span>
      </h3>
      <ol className="chain" data-testid="proof-chain" style={{ ['--steps' as string]: steps.length }}>
        {steps.map((s) => (
          <li key={s.n} className={`step step-${s.kind}`} style={{ ['--i' as string]: s.n - 1 }} data-testid="proof-step" data-kind={s.kind}>
            <span className="electrode" aria-hidden="true">
              <span className="electrode-n">{s.n}</span>
            </span>
            <div className="step-card">
              <p className="step-meta">
                <span className="step-kind">{KIND_LABEL[s.kind]}</span>
                {s.cite && <span className="step-cite">{s.cite}</span>}
                {s.uses.length > 0 && <span className="step-uses">from {s.uses.map((u) => `step ${u}`).join(', ')}</span>}
              </p>
              <p className="step-title">{s.title}</p>
              {s.kind === 'lease' && s.quote ? (
                <blockquote className="step-quote">{s.quote}</blockquote>
              ) : (
                s.detail && <p className="step-detail">{s.detail}</p>
              )}
              <div className="step-foot">
                <code className="step-prolog">{s.prolog}</code>
                {s.kind === 'lease' && s.factId && (
                  <button type="button" className="linkish" data-testid="show-clause" onClick={() => onShowClause(s.factId!)}>
                    Show {s.cite} in the lease
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
