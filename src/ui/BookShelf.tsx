/** Decorative row of book spines across the masthead. Deterministic, so it never shifts between renders. */
const SPINES = Array.from({ length: 64 }, (_, i) => {
  const seed = (i * 7919 + 104729) % 997;
  return {
    width: 10 + (seed % 14),
    height: 62 + (seed % 30),
    hue: [18, 28, 8, 140, 35, 0][seed % 6]!,
    light: 14 + (seed % 12),
    band: seed % 3 === 0,
  };
});

export function BookShelf() {
  let x = 0;
  return (
    <svg className="shelf" viewBox="0 0 1200 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {SPINES.map((s, i) => {
        const el = (
          <g key={i}>
            <rect x={x} y={100 - s.height} width={s.width - 1} height={s.height} fill={`hsl(${s.hue} 35% ${s.light}%)`} />
            {s.band && <rect x={x} y={100 - s.height + 10} width={s.width - 1} height={3} fill="#c9a14a" opacity="0.55" />}
            <rect x={x} y={92} width={s.width - 1} height={2} fill="#c9a14a" opacity="0.35" />
          </g>
        );
        x += s.width + 1;
        return el;
      })}
      <rect x="0" y="97" width="1200" height="3" fill="#3a2a1c" />
    </svg>
  );
}
