import { useState } from "react";
import { Zap, Calendar, Shuffle, TrendingUp, Heart, Users, GraduationCap, Check, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EVERYTHING, type UsageExtra, type UsageProfile, type UsageStyle } from "../usageProfile";
import "./UsageQuestionnaire.css";

const STYLES: { key: UsageStyle; Icon: LucideIcon; title: string; sub: string }[] = [
  { key: "spot", Icon: Zap,      title: "I make it up on the spot", sub: "Walk in, pick some lifts, log them. No plans, no homework." },
  { key: "plan", Icon: Calendar, title: "I follow a plan",          sub: "Same routine on set days, from a regime you build or get from a trainer." },
  { key: "both", Icon: Shuffle,  title: "A bit of both",            sub: "A plan most days, freestyle when the mood strikes." },
];

const EXTRAS: { key: UsageExtra; Icon: LucideIcon; title: string; sub: string }[] = [
  { key: "progress", Icon: TrendingUp,    title: "See my progress",     sub: "PRs and trends" },
  { key: "body",     Icon: Heart,         title: "Track my body",       sub: "Weight and measurements" },
  { key: "social",   Icon: Users,         title: "Train with friends",  sub: "Buddies, chat, alerts" },
  { key: "coach",    Icon: GraduationCap, title: "Work with a trainer", sub: "Coaching and assigned plans" },
];

/**
 * The first-run questionnaire: how workouts get made, then what else is
 * wanted. The answers decide which pages and workout steps the app shows
 * (usageProfile.ts). Opens by itself for an account that has never answered;
 * Settings opens it again with `initial` and `onCancel`.
 */
export default function UsageQuestionnaire({ initial, onDone, onCancel }: {
  initial?: UsageProfile | null;
  onDone: (p: UsageProfile) => void;
  /** Present only when reopened from Settings: closes without changing anything. */
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<UsageStyle | null>(initial?.style ?? null);
  const [extras, setExtras] = useState<UsageExtra[]>(initial?.extras ?? []);

  const toggle = (e: UsageExtra) =>
    setExtras(prev => (prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]));

  return (
    <div className="modal-backdrop uq-backdrop" onClick={onCancel}>
      <div
        className="modal-card uq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uq-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="uq-progress" aria-hidden="true">
          <span className={step >= 0 ? "on" : ""} /><span className={step >= 1 ? "on" : ""} />
        </div>

        {step === 0 ? (
          <>
            <div className="uq-kicker">Quick setup, 2 questions</div>
            <h2 id="uq-title" className="uq-title">How do you put a workout together?</h2>
            <p className="uq-sub">We'll hide the stuff you'd never touch. Change it any time in Settings.</p>
            <div className="uq-options" role="radiogroup" aria-label="How you train">
              {STYLES.map(o => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={style === o.key}
                  className={`uq-option${style === o.key ? " on" : ""}`}
                  onClick={() => setStyle(o.key)}
                >
                  <span className="uq-option-icon"><o.Icon size={22} /></span>
                  <span className="uq-option-text">
                    <span className="uq-option-title">{o.title}</span>
                    <span className="uq-option-sub">{o.sub}</span>
                  </span>
                  <span className="uq-tick" aria-hidden="true">{style === o.key && <Check size={16} strokeWidth={3} />}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="uq-kicker">Last one</div>
            <h2 id="uq-title" className="uq-title">What else do you want in here?</h2>
            <p className="uq-sub">Pick any, or none. Logging workouts and your history are always there.</p>
            <div className="uq-grid">
              {EXTRAS.map(o => {
                const on = extras.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    className={`uq-extra${on ? " on" : ""}`}
                    onClick={() => toggle(o.key)}
                  >
                    <span className="uq-tick" aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
                    <o.Icon size={22} />
                    <span className="uq-option-title">{o.title}</span>
                    <span className="uq-option-sub">{o.sub}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="uq-foot">
          {step === 0 ? (
            onCancel
              ? <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
              : <span />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setStep(0)}>Back</button>
          )}
          {step === 0 ? (
            <button type="button" className="btn-primary" disabled={!style} onClick={() => setStep(1)}>Next</button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => style && onDone({ style, extras })}>Done</button>
          )}
        </div>
        <button type="button" className="uq-everything" onClick={() => onDone(EVERYTHING)}>
          <LayoutGrid size={14} /> Skip, show me everything
        </button>
      </div>
    </div>
  );
}
