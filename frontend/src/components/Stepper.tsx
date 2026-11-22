import { Minus, Plus } from "lucide-react";
import "../simple.css";

/** A whole number changed with big minus and plus buttons: quicker and more
 * forgiving than a phone keyboard mid-workout. */
export default function Stepper({ value, min, max, onChange, label, format }: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Screen-reader name, e.g. "Working sets for Bench Press". */
  label: string;
  format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="qstep" role="group" aria-label={label}>
      <button type="button" className="qstep-btn" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Less: ${label}`}>
        <Minus size={16} />
      </button>
      <output className="qstep-val" aria-live="polite">{format ? format(value) : value}</output>
      <button type="button" className="qstep-btn" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`More: ${label}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}
