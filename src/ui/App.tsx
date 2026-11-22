import { useEffect, useMemo, useRef, useState } from 'react';
import { createAdapters, parseBackend } from '../adapters/select';
import { SAMPLE_LEASES } from '../lease/fixtures';
import { TOPICS } from '../logic/topics';
import { citedFactIds } from './segments';
import { useLeaseLawyer, type LeaseSource } from './useLeaseLawyer';
import { BookShelf } from './BookShelf';
import { CaseFiles } from './CaseFiles';
import { LeasePane } from './LeasePane';
import { ProofChain } from './ProofChain';
import { Seam } from './Seam';
import { Suture } from './Suture';
import { useMediaQuery } from './useMediaQuery';
import { useTour } from './useTour';
import { VerdictPanel } from './VerdictPanel';
import { Workbench } from './Workbench';

const backend = parseBackend(import.meta.env.VITE_AI_BACKEND);

export function App() {
  const adapters = useMemo(() => createAdapters(backend), []);
  const { state, loadLease, askQuestion, answerFollowUp } = useLeaseLawyer(adapters);
  const [draft, setDraft] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [focusFact, setFocusFact] = useState<{ id: string; nonce: number; clause?: boolean } | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  // On a phone the lease folds away under the answer's way, opens itself when a step points into it,
  // and a floating button leads back to the answer.
  const phone = useMediaQuery('(max-width: 560px)');
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [backToAnswer, setBackToAnswer] = useState(false);
  const showLease = !phone || leaseOpen;
  useEffect(() => {
    if (!focusFact || !phone) return;
    setLeaseOpen(true);
    setBackToAnswer(true);
  }, [focusFact, phone]);
  const returnToAnswer = () => {
    setBackToAnswer(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    resultRef.current?.focus({ preventScroll: true });
  };

  const pick = (source: LeaseSource) => {
    setSourceId(source.id);
    setFocusFact(null);
    void loadLease(source);
  };

  useEffect(() => {
    const first = SAMPLE_LEASES[0]!;
    pick(first);
    // Load the first sample once on start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cited = useMemo(() => citedFactIds(state.answer?.steps ?? []), [state.answer]);
  const blocking = useMemo(() => new Set((state.answer?.unread ?? []).map((u) => u.clauseId)), [state.answer]);
  // The stitch starts on the last lease step of the proof (the clause the verdict turns on); pointing at another step moves it.
  const [pointed, setPointed] = useState<string | null>(null);
  const sewn = useMemo(() => {
    const leaseSteps = (state.answer?.steps ?? []).filter((s) => s.kind === 'lease' && s.factId);
    if (pointed && leaseSteps.some((s) => s.factId === pointed)) return pointed;
    return leaseSteps[leaseSteps.length - 1]?.factId ?? null;
  }, [state.answer, pointed]);
  const busy = state.status === 'reading' || state.status === 'thinking';
  const factCount = state.verification?.facts.length ?? 0;

  // After a question is asked, bring the verdict into view once it renders, then move focus to it.
  const revealPending = useRef(false);
  const submit = (text: string) => {
    setDraft(text);
    setFocusFact(null);
    setBackToAnswer(false);
    revealPending.current = true;
    void askQuestion(text);
  };
  useEffect(() => {
    if (!revealPending.current || busy) return;
    if (!state.answer && !state.outOfScope && !state.error) return;
    revealPending.current = false;
    const result = resultRef.current;
    if (!result) return;
    const target = result.querySelector<HTMLElement>('.verdict-row, .out-of-scope, .error') ?? result;
    const box = target.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      result.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    result.focus({ preventScroll: true });
  }, [state.answer, state.outOfScope, state.error, busy]);

  const tour = useTour({
    state,
    pick,
    submit,
    showFact: (factId) => setFocusFact({ id: factId, nonce: Date.now() }),
  });

  return (
    <div className="page">
      <div className="fog" aria-hidden="true" />
      <a className="skip" href="#lab">Skip to the question</a>
      <header className="masthead">
        <BookShelf />
        <div className="masthead-inner">
          <p className="eyebrow">A haunted law library &middot; est. 1972</p>
          <h1 className="title">
            Lease <span className="bolt" aria-hidden="true">&#x26A1;</span> Lawyer
          </h1>
          <p className="tagline">
            <strong>Chatbots guess about your lease. Lease Lawyer proves it, or says it can&rsquo;t tell.</strong> Every answer is a
            Prolog proof, and every step cites the words in your lease.
          </p>
          <button type="button" className="chip tour-chip" data-testid="tour-start" data-tour-ui onClick={() => void tour.start()}>
            <span aria-hidden="true">&#x25B6;</span> {tour.seen ? 'Replay the 30-second tour' : 'Take the 30-second tour'}
          </button>
        </div>
      </header>

      <main>
        <section aria-labelledby="cases-heading" className="cases">
          <h2 id="cases-heading" className="section-title">
            <span className="numeral">I.</span> Choose a lease
          </h2>
          <CaseFiles selected={sourceId} onPick={pick} />
        </section>

        <div className="workspace">
          <section className="lease-col" aria-labelledby="lease-heading">
            <h2 id="lease-heading" className="section-title">
              <span className="numeral">II.</span> The lease
              {state.lease && (
                <span className="section-meta" data-testid="fact-count">
                  {state.status === 'reading' ? 'reading…' : `${factCount} facts extracted`}
                </span>
              )}
            </h2>
            {phone && state.lease && (
              <button
                type="button"
                className="chip lease-toggle"
                data-testid="lease-toggle"
                aria-expanded={leaseOpen}
                aria-controls="lease-text"
                onClick={() => setLeaseOpen((o) => !o)}
              >
                {leaseOpen ? 'Hide the lease' : `Read the lease (${state.status === 'reading' ? 'reading…' : `${factCount} facts`})`}
              </button>
            )}
            {!showLease ? null : state.lease ? (
              <LeasePane
                lease={state.lease}
                facts={state.verification?.facts ?? []}
                cited={cited}
                unread={state.verification?.unread ?? []}
                blocking={blocking}
                focus={focusFact}
              />
            ) : (
              <p className="muted">Choose a lease to begin.</p>
            )}
          </section>

          <section className="lab-col" id="lab" aria-labelledby="lab-heading">
            <h2 id="lab-heading" className="section-title">
              <span className="numeral">III.</span> The laboratory
            </h2>

            <form
              className="ask"
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
            >
              <label htmlFor="question" className="ask-label">
                Your question
              </label>
              <div className="ask-row">
                <textarea
                  id="question"
                  data-testid="question"
                  value={draft}
                  rows={2}
                  placeholder="Can my landlord keep my deposit for normal wear and tear?"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit(draft);
                    }
                  }}
                />
                <button type="submit" className="lever" data-testid="ask" disabled={busy || !draft.trim() || !state.verification}>
                  <span className="lever-icon" aria-hidden="true">&#x26A1;</span>
                  {state.status === 'thinking' ? 'Proving…' : 'Prove it'}
                </button>
              </div>
              <div className="examples" role="group" aria-label="Example questions">
                {TOPICS.map((t) => (
                  <button key={t.id} type="button" className="chip" onClick={() => submit(t.examples[0]!)} disabled={busy || !state.verification}>
                    {t.label}
                  </button>
                ))}
              </div>
            </form>

            <section ref={resultRef} tabIndex={-1} className="result" aria-live="polite" aria-busy={busy} data-testid="result">
              {state.error && (
                <p className="error" role="alert">
                  Something went wrong: {state.error}
                </p>
              )}
              {state.outOfScope && (
                <div className="out-of-scope" data-testid="out-of-scope">
                  <p className="verdict-headline">
                    That question is outside this rule base, so the engine will not guess. It can prove answers about:
                  </p>
                  <ul className="topic-list">
                    {TOPICS.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="linkish" onClick={() => submit(t.examples[0]!)}>
                          {t.question}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {state.answer && (
                <>
                  <VerdictPanel
                    answer={state.answer}
                    question={state.question}
                    onFollowUp={answerFollowUp}
                    onShowClause={(clauseId) => setFocusFact({ id: clauseId, nonce: Date.now(), clause: true })}
                    tenant={state.tenant}
                    busy={busy}
                  />
                  {state.verification && (
                    <Seam
                      readerName={state.readerName}
                      verification={state.verification}
                      answer={state.answer}
                      onShowClause={(clauseId) => setFocusFact({ id: clauseId, nonce: Date.now(), clause: true })}
                    />
                  )}
                  {state.answer.steps.length > 0 && (
                    <ProofChain
                      key={`${state.answer.query}:${state.answer.proofTerm ?? ''}`}
                      steps={state.answer.steps}
                      onShowClause={(factId) => {
                        setPointed(factId);
                        setFocusFact({ id: factId, nonce: Date.now() });
                      }}
                      onPoint={setPointed}
                    />
                  )}
                </>
              )}
              {!state.answer && !state.outOfScope && !state.error && (
                <div className="idle" data-testid="idle">
                  <ol className="ghost-chain" aria-hidden="true">
                    <li />
                    <li />
                    <li />
                    <li />
                  </ol>
                  <div>
                    <p className="idle-title">Ask, and the circuit will charge.</p>
                    <p className="muted">
                      Tap a topic above or write your own question. Every answer is a proof: each step cites a lease clause, a rule of the
                      model code, or something you told us. When the lease cannot be read, the answer is &ldquo;Can&rsquo;t tell&rdquo;.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <Workbench verification={state.verification} answer={state.answer} readerName={state.readerName} translatorName={adapters.translator.name} />
          </section>
        </div>
      </main>

      <Suture factId={sewn} />

      {phone && backToAnswer && (
        <button type="button" className="lever small back-to-answer" data-testid="back-to-answer" onClick={returnToAnswer}>
          <span aria-hidden="true">&uarr;</span> Back to the answer
        </button>
      )}

      {tour.frame && (
        <div className="tour" role="status" data-testid="tour" data-tour-ui>
          <p className="tour-count">
            Tour {tour.frame.n} of {tour.frame.total}
          </p>
          <p className="tour-caption">{tour.frame.caption}</p>
          <button type="button" className="chip" onClick={tour.stop}>
            Skip tour
          </button>
        </div>
      )}

      <footer className="footer">
        <p>
          <strong>Not legal advice.</strong> Lease Lawyer applies an invented &ldquo;model jurisdiction&rdquo; rule base for teaching and
          triage. Real landlord-tenant rules vary by state and city; check your local law or a tenant union before you act.
        </p>
        <p className="credits">
          Logic by <a href="http://tau-prolog.org/">Tau Prolog</a> (BSD-3-Clause). Type by IM Fell (OFL), Special Elite (Apache 2.0),
          Spectral and IBM Plex Mono (OFL). Sample leases, names and addresses are fictional. &copy; 2026 Stubborn Otter Software, MIT
          License.
        </p>
      </footer>
    </div>
  );
}
