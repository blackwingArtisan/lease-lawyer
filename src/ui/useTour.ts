import { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_LEASES } from '../lease/fixtures';
import type { LabState, LeaseSource } from './useLeaseLawyer';

export const TOUR_SEEN_KEY = 'lease-lawyer.tour-seen';
const TOTAL = 6;

export interface TourFrame {
  n: number;
  total: number;
  caption: string;
}

interface Controls {
  state: LabState;
  pick: (source: LeaseSource) => void;
  submit: (question: string) => void;
  showFact: (factId: string) => void;
}

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    // Storage can be blocked; the tour then simply offers itself again next time.
  }
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The 30-second tour: a greedy lease proved wrong in cited steps, a trick lease the engine will not
 * guess about, then a poisoned lease whose planted note to the AI reader the verifier strikes.
 * It runs once on a first visit (not under reduced motion), can be replayed,
 * and stops the moment the visitor clicks or types anywhere else.
 */
export function useTour(controls: Controls) {
  const live = useRef(controls);
  live.current = controls;
  const [frame, setFrame] = useState<TourFrame | null>(null);
  const [seen, setSeen] = useState(readSeen);
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current++;
    setFrame(null);
  }, []);

  const start = useCallback(async () => {
    const id = ++runId.current;
    markSeen();
    setSeen(true);
    const alive = () => runId.current === id;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (ok: () => boolean, ms = 6000) => {
      const end = Date.now() + ms;
      while (alive() && !ok() && Date.now() < end) await wait(50);
    };
    const ready = () => live.current.state.status === 'ready' && live.current.state.verification !== null;
    const answered = (question: string) => ready() && live.current.state.answer?.question === question;
    const show = (n: number, caption: string) => alive() && setFrame({ n, total: TOTAL, caption });
    const sample = (leaseId: string) => {
      const s = SAMPLE_LEASES.find((l) => l.id === leaseId)!;
      return { id: s.id, name: s.name, text: s.text, redTeam: s.redTeam };
    };

    show(1, 'Case No. 002 is a greedy lease. Ask it whether the landlord can keep the deposit for wear and tear.');
    live.current.pick(sample('gaslight-row'));
    await until(ready);
    await wait(1600);
    if (!alive()) return;
    live.current.submit('Can my landlord keep my deposit for normal wear and tear?');
    await until(() => answered('Can the landlord keep part of my deposit for normal wear and tear?'));
    show(2, 'No. Prolog proved it step by step, and every step cites the lease or the model code.');
    await wait(4400);
    if (!alive()) return;

    const leaseSteps = live.current.state.answer?.steps.filter((s) => s.kind === 'lease' && s.factId) ?? [];
    const clause = leaseSteps[leaseSteps.length - 1];
    show(3, 'Here is the clause the proof rests on, word for word. The rule that voids it is cited too.');
    if (clause?.factId) live.current.showFact(clause.factId);
    await wait(4200);
    if (!alive()) return;

    show(4, 'Case No. 004 tries to trick it: the pets clause points to a rider that is not attached.');
    live.current.pick(sample('hollowmere-flats'));
    await until(ready);
    await wait(1600);
    if (!alive()) return;
    live.current.submit('Can I get a dog?');
    await until(() => answered('Can I keep an animal in my home?'));
    show(5, "So it will not guess: Can't tell, and here is the clause to read yourself. No answer without a proof.");
    await wait(5600);
    if (!alive()) return;

    show(6, 'Case No. 005 hides a note to the AI reader. Watch the verifier strike it from the record.');
    live.current.pick(sample('marrowgate-lofts'));
    await until(ready);
    await wait(1600);
    if (!alive()) return;
    live.current.submit('Can I get a dog?');
    await until(() => answered('Can I keep an animal in my home?'));
    await wait(150);
    if (!alive()) return;
    const struck = live.current.state.verification?.rejected.length ?? 0;
    show(
      6,
      `Case No. 005 hides a note to the AI reader. The verifier struck ${struck} ${struck === 1 ? 'fact' : 'facts'} from the record, and the answer is Can't tell.`,
    );
    // Put the struck lines in view (without a smooth scroll under reduced motion).
    document
      .querySelector('[data-testid="struck-list"]')
      ?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    await wait(6400);
    if (alive()) setFrame(null);
  }, []);

  // A first visit runs the tour once, unless the visitor prefers reduced motion.
  // ?tour=on forces it (for recordings); ?tour=off suppresses it.
  const autoStarted = useRef(false);
  const leaseReady = controls.state.status === 'ready' && controls.state.verification !== null;
  useEffect(() => {
    if (autoStarted.current || !leaseReady) return;
    autoStarted.current = true;
    const param = new URLSearchParams(window.location.search).get('tour');
    const auto = param === 'on' || (param !== 'off' && !readSeen() && !prefersReducedMotion());
    if (!auto) return;
    const timer = setTimeout(() => void start(), 900);
    return () => clearTimeout(timer);
  }, [leaseReady, start]);

  // Any click or key press outside the tour caption hands control back to the visitor.
  useEffect(() => {
    if (!frame) return;
    const onInput = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-tour-ui]')) return;
      stop();
    };
    document.addEventListener('pointerdown', onInput, true);
    document.addEventListener('keydown', onInput, true);
    return () => {
      document.removeEventListener('pointerdown', onInput, true);
      document.removeEventListener('keydown', onInput, true);
    };
  }, [frame, stop]);

  return { frame, seen, start, stop };
}
