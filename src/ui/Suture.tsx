import { useEffect, useState } from 'react';

interface Props {
  /** The lease fact whose proof step and quote are sewn together, or null for none. */
  factId: string | null;
}

interface Thread {
  d: string;
  x: number;
  y: number;
}

const WIDE = '(min-width: 1001px)';

/**
 * A sewn thread from a Lease step in the proof chain to the quote it cites in the lease: the
 * Frankenstein stitch made visible. Drawn only when both ends are on screen in the two-column layout.
 */
export function Suture({ factId }: Props) {
  const [thread, setThread] = useState<Thread | null>(null);

  useEffect(() => {
    if (!factId) {
      setThread(null);
      return;
    }
    let frame = 0;
    const draw = () => {
      frame = 0;
      const card = document.querySelector(`[data-step-fact="${factId}"] .electrode`);
      const mark = document.querySelector(`mark[data-fact~="${factId}"]`);
      const pane = document.querySelector('[data-testid="lease"]');
      if (!window.matchMedia(WIDE).matches || !card || !mark || !pane) return setThread(null);
      const line = mark.getClientRects()[0] ?? mark.getBoundingClientRect();
      const box = pane.getBoundingClientRect();
      const to = card.getBoundingClientRect();
      const y1 = line.top + line.height / 2;
      const y2 = to.top + to.height / 2;
      const onScreen = (y: number) => y > 0 && y < window.innerHeight;
      if (y1 < box.top + 4 || y1 > box.bottom - 4 || !onScreen(y1) || !onScreen(y2)) return setThread(null);
      const x1 = box.right - 6;
      const x2 = to.left;
      const bend = Math.max(40, (x2 - x1) * 0.55);
      setThread({ d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, x: x1, y: y1 });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    schedule();
    // The chain slides in and the lease scrolls smoothly; follow both while they settle.
    const settle = [120, 400, 900, 1600, 2600].map((ms) => window.setTimeout(schedule, ms));
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      settle.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [factId]);

  if (!thread) return null;
  return (
    <svg className="suture" aria-hidden="true" data-testid="suture" data-fact={factId ?? undefined}>
      <path className="suture-stitch" d={thread.d} />
      <path className="suture-thread" d={thread.d} />
      <circle className="suture-knot" cx={thread.x} cy={thread.y} r={4} />
    </svg>
  );
}
