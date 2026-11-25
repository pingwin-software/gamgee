import { useState } from "react";
import { ChevronDown, TrendingUp } from "../icons";
import Stepper from "./Stepper";
import { analyzeEx } from "../analysis";
import {
  DEFAULT_PROGRESSION_PREFS, PROGRESSION_PRESETS, STEP_CHOICES, presetOf,
  type ProgressionPrefs, type ProgressionPreset, type SlipAction,
} from "../progressionPrefs";
import type { WorkoutSession } from "../types";
import "../simple.css";

const PRESETS: Array<{ id: ProgressionPreset; label: string; hint: string }> = [
  { id: "steady",   label: "Steady",   hint: "More reps before each small jump. Never skips ahead." },
  { id: "standard", label: "Standard", hint: "A few more reps, then the next plate." },
  { id: "fast",     label: "Fast",     hint: "One more rep, then more weight. Easy sets jump at once." },
];

const SLIP: Array<{ id: SlipAction; label: string }> = [
  { id: "step",    label: "Drop one jump" },
  { id: "percent", label: "Drop 10%" },
  { id: "hold",    label: "Hold the weight" },
];

/** A made-up lifter, so the card can show what the current settings would say. */
const SAMPLE: WorkoutSession[] = ([[60, 9], [60, 8]] as const).map(([w, r], i) => ({
  id: `sample-${i}`, date: `2026-01-0${2 - i}`, duration: 0, focus: "push",
  exercises: [{ id: "bench", name: "Bench Press", type: "strength", uid: "sample", sets: [{ weight: String(w), reps: String(r), done: true, rpe: 8 }] }],
})) as unknown as WorkoutSession[];

/** Settings, Workout: how the suggested next weight and reps are worked out.
 * Three presets cover most people; Customise opens every rule. Changes apply
 * at once, everywhere a suggestion shows. */
export default function ProgressionCard({ prefs, onChange }: {
  prefs: ProgressionPrefs;
  onChange: (next: ProgressionPrefs) => void;
}) {
  const preset = presetOf(prefs);
  const [open, setOpen] = useState(preset === null);
  const patch = (p: Partial<ProgressionPrefs>) => onChange({ ...prefs, ...p });
  const sample = analyzeEx("bench", SAMPLE, null, prefs);
  const auto = prefs.repsBeforeWeight === null;

  return (
    <div className="profile-card" style={{ marginBottom: 12 }}>
      <div className="modal-title" style={{ marginBottom: 4 }}><TrendingUp size={15} /> Suggested progression</div>
      <p className="pk-hint">How Gamgee picks your next weight and reps.</p>

      <div className="seg" role="radiogroup" aria-label="Progression pace">
        {PRESETS.map(p => (
          <button
            key={p.id} type="button" role="radio" aria-checked={preset === p.id}
            className={`seg-btn${preset === p.id ? " on" : ""}`}
            onClick={() => onChange(PROGRESSION_PRESETS[p.id])}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="prog-hint">{preset ? PRESETS.find(p => p.id === preset)!.hint : "Your own rules."}</p>

      {sample && (
        <div className="prog-sample">
          <span className="prog-sample-label">Example</span>
          Bench 60 kg × 9 last time → next <b>{sample.nextWeight} kg × {sample.nextReps}</b>
        </div>
      )}

      <button type="button" className="disclose" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        Customise <ChevronDown size={15} className={open ? "flip" : ""} />
      </button>

      {open && (
        <div className="prog-rules">
          <div className="prog-rule">
            <div className="prog-rule-text">
              <div className="prog-rule-name">Reps to add before more weight</div>
              <div className="prog-rule-sub">{auto ? "Automatic: 2 on heavy low-rep sets, 3 otherwise." : prefs.repsBeforeWeight === 0 ? "More weight every session." : "Then the weight goes up and reps start over."}</div>
            </div>
            <div className="prog-rule-ctl">
              <button type="button" role="switch" aria-checked={auto} className={`switch-pill${auto ? " on" : ""}`} onClick={() => patch({ repsBeforeWeight: auto ? 3 : null })}>
                Auto
              </button>
              {!auto && (
                <Stepper value={prefs.repsBeforeWeight ?? 3} min={0} max={10} label="Reps to add before more weight" onChange={v => patch({ repsBeforeWeight: v })} />
              )}
            </div>
          </div>

          {([["stepUpperKg", "Weight jump, upper body"], ["stepLowerKg", "Weight jump, lower body"]] as const).map(([key, name]) => (
            <div className="prog-rule" key={key}>
              <div className="prog-rule-text"><div className="prog-rule-name">{name}</div></div>
              <div className="chips" role="radiogroup" aria-label={name}>
                {STEP_CHOICES.map(kg => (
                  <button key={kg} type="button" role="radio" aria-checked={prefs[key] === kg} className={`chip-btn${prefs[key] === kg ? " on" : ""}`} onClick={() => patch({ [key]: kg })}>
                    {kg} kg
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="prog-rule">
            <div className="prog-rule-text">
              <div className="prog-rule-name">Skip ahead after an easy set</div>
              <div className="prog-rule-sub">{prefs.easyRir === null ? "Always finish the reps first." : `Add weight early when a top set leaves ${prefs.easyRir}+ reps in the tank.`}</div>
            </div>
            <div className="prog-rule-ctl">
              <button type="button" role="switch" aria-checked={prefs.easyRir !== null} className={`switch-pill${prefs.easyRir !== null ? " on" : ""}`} onClick={() => patch({ easyRir: prefs.easyRir === null ? 3 : null })}>
                {prefs.easyRir !== null ? "On" : "Off"}
              </button>
              {prefs.easyRir !== null && (
                <Stepper value={prefs.easyRir} min={1} max={6} label="Reps left in the tank" onChange={v => patch({ easyRir: v })} />
              )}
            </div>
          </div>

          <div className="prog-rule">
            <div className="prog-rule-text">
              <div className="prog-rule-name">When a lift is slipping</div>
              <div className="prog-rule-sub">Strength trending down at the bottom of your rep range.</div>
            </div>
            <div className="chips" role="radiogroup" aria-label="When a lift is slipping">
              {SLIP.map(s => (
                <button key={s.id} type="button" role="radio" aria-checked={prefs.onSlip === s.id} className={`chip-btn${prefs.onSlip === s.id ? " on" : ""}`} onClick={() => patch({ onSlip: s.id })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {preset !== "standard" && (
            <button type="button" className="auth-toggle" style={{ textAlign: "left" }} onClick={() => onChange(DEFAULT_PROGRESSION_PREFS)}>
              Reset to Standard
            </button>
          )}
        </div>
      )}
    </div>
  );
}
