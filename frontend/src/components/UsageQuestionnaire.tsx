import { useState } from "react";
import {
  Zap, Calendar, Bookmark, TrendingUp, Heart, Users, GraduationCap, Check, LayoutGrid,
  Sparkles, Ruler, PenLine, Timer, Gauge, Bike,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  EVERYTHING, FIXED_STEPS, type UsageExtra, type UsageLog, type UsageProfile, type UsageProgression, type UsageWay,
} from "../usageProfile";
import "./UsageQuestionnaire.css";

type Choice<K extends string> = { key: K; Icon: LucideIcon; title: string; sub: string };

const WAYS: Choice<UsageWay>[] = [
  { key: "regime",    Icon: Calendar, title: "A weekly regime", sub: "Each weekday's workout is set in advance (Mon chest, Wed back…). Open the app and today's is ready." },
  { key: "templates", Icon: Bookmark, title: "Templates",       sub: "A few saved workouts you pick from, like Push, Pull and Legs. No calendar, you choose which one." },
  { key: "spot",      Icon: Zap,      title: "Impromptu",       sub: "Build it there and then: pick a focus, add lifts, go." },
];

const PROGRESSIONS: Choice<UsageProgression>[] = [
  { key: "auto",   Icon: Sparkles, title: "Suggest them for me",     sub: "Gamgee reads your history and fills in the next weight and reps." },
  { key: "fixed",  Icon: Ruler,    title: "Same jump, every lift",   sub: "Last time's weight plus a fixed amount you pick. No clever stuff." },
  { key: "manual", Icon: PenLine,  title: "I'll decide myself",      sub: "No suggestions. Last time's numbers are shown, you type the rest." },
];

const LOGS: Choice<UsageLog>[] = [
  { key: "rest",   Icon: Timer, title: "Rest timer",       sub: "Counts down between sets" },
  { key: "effort", Icon: Gauge, title: "Rate my effort",   sub: "Reps left per set, how hard the session was" },
  { key: "cardio", Icon: Bike,  title: "Cardio",           sub: "Add a run or a bike before or after" },
];

const EXTRAS: Choice<UsageExtra>[] = [
  { key: "progress", Icon: TrendingUp,    title: "See my progress",     sub: "PRs and trends" },
  { key: "body",     Icon: Heart,         title: "Track my body",       sub: "Weight and measurements" },
  { key: "social",   Icon: Users,         title: "Train with friends",  sub: "Buddies, chat, alerts" },
  { key: "coach",    Icon: GraduationCap, title: "Work with a trainer", sub: "Coaching and assigned plans" },
];

const STEPS = 4;

/**
 * The first-run questionnaire, four short questions: how workouts get made,
 * how weights go up, what a workout logs, and what else is wanted. Every
 * answer switches something off (usageProfile.ts). Opens by itself for an
 * account that has never answered; Settings opens it again with `initial`
 * and `onCancel`.
 */
export default function UsageQuestionnaire({ initial, onDone, onCancel }: {
  initial?: UsageProfile | null;
  onDone: (p: UsageProfile) => void;
  /** Present only when reopened from Settings: closes without changing anything. */
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [ways, setWays] = useState<UsageWay[]>(initial?.ways ?? []);
  const [progression, setProgression] = useState<UsageProgression | null>(initial?.progression ?? null);
  const [fixedStepKg, setFixedStepKg] = useState<number>(initial?.fixedStepKg ?? 2.5);
  const [logging, setLogging] = useState<UsageLog[]>(initial?.logging ?? []);
  const [extras, setExtras] = useState<UsageExtra[]>(initial?.extras ?? []);

  const toggle = <K extends string>(list: K[], set: (v: K[]) => void, k: K) =>
    set(list.includes(k) ? list.filter(x => x !== k) : [...list, k]);

  const canNext = step === 0 ? ways.length > 0 : step === 1 ? !!progression : true;
  const finish = () => {
    if (ways.length && progression) onDone({ ways, progression, fixedStepKg, logging, extras });
  };

  /** One-pick list (radio group). */
  const single = <K extends string>(label: string, opts: Choice<K>[], value: K | null, set: (k: K) => void) => (
    <div className="uq-options" role="radiogroup" aria-label={label}>
      {opts.map(o => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          className={`uq-option${value === o.key ? " on" : ""}`}
          onClick={() => set(o.key)}
        >
          <span className="uq-option-icon"><o.Icon size={22} /></span>
          <span className="uq-option-text">
            <span className="uq-option-title">{o.title}</span>
            <span className="uq-option-sub">{o.sub}</span>
          </span>
          <span className="uq-tick" aria-hidden="true">{value === o.key && <Check size={16} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  );

  /** Any-of grid (toggle buttons). */
  const multi = <K extends string>(opts: Choice<K>[], value: K[], set: (v: K[]) => void) => (
    <div className={`uq-grid${opts.length === 3 ? " uq-grid-3" : ""}`}>
      {opts.map(o => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            className={`uq-extra${on ? " on" : ""}`}
            onClick={() => toggle(value, set, o.key)}
          >
            <span className="uq-tick" aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
            <o.Icon size={22} />
            <span className="uq-option-title">{o.title}</span>
            <span className="uq-option-sub">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );

  const heads = [
    { kicker: `Quick setup, ${STEPS} questions`, title: "How do you build your workouts?", sub: "Pick one or more. Whatever you leave out disappears from the app. Change it any time in Settings." },
    { kicker: "Question 2", title: "How should your weights go up?", sub: "For the next session of each lift." },
    { kicker: "Question 3", title: "While you lift, do you want…", sub: "Pick any, or none. Weight, reps and ticking off sets are always there." },
    { kicker: "Last one", title: "What else do you want in here?", sub: "Pick any, or none. Your history is always there." },
  ];
  const head = heads[step];

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
          {Array.from({ length: STEPS }, (_, i) => <span key={i} className={step >= i ? "on" : ""} />)}
        </div>

        <div className="uq-kicker">{head.kicker}</div>
        <h2 id="uq-title" className="uq-title">{head.title}</h2>
        <p className="uq-sub">{head.sub}</p>

        {step === 0 && multi(WAYS, ways, setWays)}
        {step === 1 && (
          <>
            {single("How weights go up", PROGRESSIONS, progression, setProgression)}
            {progression === "fixed" && (
              <div className="uq-steps">
                <span className="uq-steps-label">Jump per session</span>
                <div className="seg" role="radiogroup" aria-label="Jump per session">
                  {FIXED_STEPS.map(v => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={fixedStepKg === v}
                      className={`seg-btn${fixedStepKg === v ? " on" : ""}`}
                      onClick={() => setFixedStepKg(v)}
                    >
                      +{v} kg
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {step === 2 && multi(LOGS, logging, setLogging)}
        {step === 3 && multi(EXTRAS, extras, setExtras)}

        <div className="uq-foot">
          {step === 0 ? (
            onCancel
              ? <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
              : <span />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step < STEPS - 1 ? (
            <button type="button" className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button type="button" className="btn-primary" onClick={finish}>Done</button>
          )}
        </div>
        <button type="button" className="uq-everything" onClick={() => onDone(EVERYTHING)}>
          <LayoutGrid size={14} /> Skip, show me everything
        </button>
      </div>
    </div>
  );
}
