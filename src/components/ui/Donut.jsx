/**
 * Two-to-four segment ring chart in plain SVG (no chart library needed).
 * segments: [{ value, label, color }]; colors are CSS variables.
 * The centre shows the total; a text legend always accompanies it, so the
 * chart never carries information by colour alone.
 */
export default function Donut({ segments, size = 148, thickness = 18, centerLabel, centerValue, label }) {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter(s => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-track)" strokeWidth={thickness} />
      {total > 0 && segments.map((s, i) => {
        const len = (Number(s.value) || 0) / total * c;
        if (len <= 0) return null;
        const dash = Math.max(0, len - gap);
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: 'var(--fg)', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {centerValue}
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: 'var(--fg-3)', fontSize: 11, fontWeight: 700 }}>
        {centerLabel}
      </text>
    </svg>
  );
}
