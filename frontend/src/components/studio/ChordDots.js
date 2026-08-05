/* ChordDots — Guitar chord SVG diagram used by PlayerStudio */
export default function ChordDots({ chord }) {
  const shapes = {
    Am: [-1, 0, 2, 2, 1, 0], C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], F: [1, 3, 3, 2, 1, 1],
    Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0],
    A: [-1, 0, 2, 2, 2, 0], B: [-1, 2, 4, 4, 4, 2],
  };
  const frets = shapes[chord];
  if (!frets) return null;
  const W = 72, H = 64, sx = 8, sy = 6, gx = (W - 2 * sx) / 5, gy = (H - sy - 6) / 4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1" data-testid="chord-svg">
      <line x1={sx} y1={sy} x2={W - sx} y2={sy} stroke="#FF5F1F" strokeWidth="2.5" />
      {[1, 2, 3, 4].map((f) => (
        <line key={f} x1={sx} y1={sy + f * gy} x2={W - sx} y2={sy + f * gy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line key={s} x1={sx + s * gx} y1={sy} x2={sx + s * gx} y2={H - 6} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      ))}
      {frets.map((f, i) => {
        if (f <= 0) return null;
        const cx = sx + i * gx, cy = sy + (f - 0.5) * gy;
        return <circle key={`dot-${i}`} cx={cx} cy={cy} r={4} fill="#FF5F1F" filter="url(#glow)" />;
      })}
      {frets.map((f, i) => {
        const cx = sx + i * gx;
        if (f === 0) return <circle key={`o${i}`} cx={cx} cy={sy - 4} r={2.5} fill="none" stroke="#39FF14" strokeWidth="1" />;
        if (f === -1) return <text key={`x${i}`} x={cx} y={sy - 2} textAnchor="middle" fill="#5C5C6B" fontSize="6" fontWeight="bold">x</text>;
        return null;
      })}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}
