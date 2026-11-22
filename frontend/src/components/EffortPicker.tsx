import "../simple.css";

/** Words for an effort level, shared by every place effort is picked. */
export function effortLabel(level: number): string {
  if (level <= 2) return "Way too easy";
  if (level <= 4) return "Easy day";
  if (level <= 6) return "On point";
  if (level <= 7) return "Solid grind";
  if (level <= 8) return "Hard";
  if (level <= 9) return "Brutal";
  return "Max effort";
}

/** Green through amber to red as the effort climbs. */
export function effortColor(level: number): string {
  if (level <= 3) return "#4CA87C";
  if (level <= 5) return "#8BC34A";
  if (level <= 7) return "#E8C547";
  if (level <= 8) return "#FF9F43";
  return "#FF6B6B";
}

/** A little face that strains as the effort goes up. */
function Face({ level, color }: { level: number; color: string }) {
  // Mouth: a smile at 1 flattening to a grimace at 10. Brows tilt in as it gets hard.
  const curve = 6 - (level - 1) * 1.1;       // +6 smile … about -4 frown
  const tilt = Math.max(0, level - 5) * 0.7; // brow angle
  const sweat = level >= 8;
  return (
    <svg className="effort-face" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke={color} strokeWidth="2.5" />
      <path d={`M14 ${17 - tilt} L20 ${17 + tilt}`} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d={`M34 ${17 - tilt} L28 ${17 + tilt}`} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="17.5" cy="22.5" r="2" fill={color} />
      <circle cx="30.5" cy="22.5" r="2" fill={color} />
      <path d={`M16 32 Q24 ${32 + curve} 32 32`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {sweat && <path d="M40 12 q3 5 0 7 q-3 -2 0 -7" fill={color} />}
    </svg>
  );
}

/**
 * Effort (RPE 1 to 10) picked by tapping a bar: ten bars climbing like a
 * flame, a face that strains with it, and the level in words. Replaces the
 * range sliders; arrow keys still work (it is a radio group).
 */
export default function EffortPicker({ value, onChange, label, compact }: {
  value: number;
  onChange: (v: number) => void;
  /** Screen-reader name, e.g. "Effort for Bench Press". */
  label: string;
  /** Bars only, on one line: for lists where every row has one. */
  compact?: boolean;
}) {
  const color = effortColor(value);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    onChange(Math.max(1, Math.min(10, value + d)));
  };
  return (
    <div className={`effort${compact ? " effort-compact" : ""}`}>
      {!compact && (
        <div className="effort-read">
          <Face level={value} color={color} />
          <div>
            <div className="effort-num" style={{ color }}>{value}<span>/10</span></div>
            <div className="effort-word">{effortLabel(value)}</div>
          </div>
        </div>
      )}
      <div className="effort-bars" role="radiogroup" aria-label={label} onKeyDown={onKey}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n}: ${effortLabel(n)}`}
            tabIndex={n === value ? 0 : -1}
            className={`effort-bar${n <= value ? " lit" : ""}${n === value ? " top" : ""}`}
            style={{ ["--h" as string]: `${28 + n * 7.2}%`, ["--c" as string]: effortColor(n) }}
            onClick={() => onChange(n)}
          >
            <span />
          </button>
        ))}
      </div>
      {compact && <span className="effort-compact-val" style={{ color }}>{value}</span>}
    </div>
  );
}
