import { useEffect, useRef, useState } from "react";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface NumFieldProps {
  value: number | undefined;
  min: number;
  max: number;
  /** Allow decimals (weights); otherwise whole numbers only. */
  decimal?: boolean;
  step?: number;
  /** Value restored when the field is left empty. Without one, an empty
   * field stays empty and commits `undefined`. */
  fallback?: number;
  placeholder?: string;
  onCommit: (v: number | undefined) => void;
}

/** Number input that keeps what the user is typing as text, so the field can
 * be cleared and retyped. Clamping and the fallback are applied only when the
 * field is left; while typing, a value is committed as soon as it is in range. */
export default function NumField({ value, min, max, decimal, step = 1, fallback, placeholder, onCommit }: NumFieldProps) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);

  // Follow outside changes (reset button, seeded configs) while not editing.
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);

  const parse = (v: string): number | null => {
    const n = decimal ? parseFloat(v.replace(",", ".")) : parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <input
      type="number"
      inputMode={decimal ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step}
      value={text}
      placeholder={placeholder}
      onFocus={e => { focused.current = true; e.target.select(); }}
      onChange={e => {
        const v = e.target.value;
        setText(v);
        const n = parse(v);
        if (n == null) {
          if (fallback == null) onCommit(undefined);
        } else if (n >= min && n <= max) {
          onCommit(n);
        }
      }}
      onBlur={() => {
        focused.current = false;
        const n = parse(text);
        const final = n == null ? fallback : clamp(n, min, max);
        setText(final == null ? "" : String(final));
        if (final !== value) onCommit(final);
      }}
    />
  );
}
