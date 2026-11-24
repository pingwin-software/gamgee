import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ChevronDown, Gauge, AlertCircle, RotateCcw } from "lucide-react";
import type { ExerciseDef, ExerciseConfig, PRDict, WorkoutSession } from "../../types";
import { prescribeExercise } from "../../analysis";
import { MI } from "../../data/muscles";
import { EM } from "../../data/exercises";
import { useTxt } from "../../context/ToneContext";
import NumField from "../NumField";
import Stepper from "../Stepper";
import EffortPicker from "../EffortPicker";

interface Props {
  planned: ExerciseDef[];
  prs: PRDict;
  history: WorkoutSession[];
  /** Pre-existing per-exercise configs (from a regime day, or the user's
   * last-used prescribe configs saved to localStorage). */
  initialConfigs: Record<string, ExerciseConfig>;
  onBack: () => void;
  /** Called when the user starts the workout. Passes the final per-exercise
   * config map; the workout starter consumes it via {@link prescribeExercise}
   * to lay out warmup + working sets. */
  onStart: (configs: Record<string, ExerciseConfig>) => void;
}

const DEFAULT_RPE = 7;
const DEFAULT_WORKING_SETS = 3;
const DEFAULT_WORKING_REPS = 8;
const DEFAULT_WARMUP_SETS = 2;

/** Pick the most recent top-set (heaviest × reps) for an exercise from the
 * user's history, as a fallback reference when no PR is recorded. */
function refFromHistory(exId: string, history: WorkoutSession[]): { weight: number; reps: number } | null {
  for (const w of history) {
    const ex = w.exercises.find(e => e.id === exId);
    if (!ex || !ex.sets.length) continue;
    let top: { w: number; r: number } | null = null;
    for (const s of ex.sets) {
      if (s.is_warmup) continue;
      const wt = parseFloat(s.weight);
      const r = parseInt(s.reps);
      if (!Number.isFinite(wt) || wt <= 0) continue;
      const reps = Number.isFinite(r) && r > 0 ? r : 0;
      if (!top || wt > top.w || (wt === top.w && reps > top.r)) top = { w: wt, r: reps };
    }
    if (top) return { weight: top.w, reps: Math.max(1, top.r || 1) };
  }
  return null;
}

export default function WizardPrescribe({ planned, prs, history, initialConfigs, onBack, onStart }: Props) {
  const t = useTxt();

  // Seed per-exercise configs from (1) the regime's day plan / saved configs,
  // (2) the user's PR for that exercise, (3) the top set from history. If
  // none of those exist the user has to fill in the reference manually — the
  // "no reference, ask for every exercise" case.
  const initial = useMemo<Record<string, ExerciseConfig>>(() => {
    const out: Record<string, ExerciseConfig> = {};
    for (const ex of planned) {
      if (ex.type !== "strength") continue;
      const fromCfg = initialConfigs[ex.id] ?? {};
      const pr = prs[ex.id];
      const hist = !pr ? refFromHistory(ex.id, history) : null;
      const max_weight = fromCfg.max_weight ?? pr?.weight ?? hist?.weight ?? undefined;
      const max_reps   = fromCfg.max_reps   ?? pr?.reps   ?? hist?.reps   ?? undefined;
      out[ex.id] = {
        rpe: fromCfg.rpe ?? DEFAULT_RPE,
        max_weight,
        max_reps,
        warmup_sets:  fromCfg.warmup_sets  ?? DEFAULT_WARMUP_SETS,
        working_sets: fromCfg.working_sets ?? DEFAULT_WORKING_SETS,
        working_reps: fromCfg.working_reps ?? DEFAULT_WORKING_REPS,
      };
    }
    return out;
  }, [planned, prs, history, initialConfigs]);

  const [configs, setConfigs] = useState<Record<string, ExerciseConfig>>(initial);
  // Which cards show their detail (reference max, sets, reps, own effort).
  // A lift with no reference opens by itself: that is the one thing we must ask.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) =>
    setOpenIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const strengthExs = planned.filter(ex => ex.type === "strength");
  const missingRef = strengthExs.filter(ex => {
    const cfg = configs[ex.id];
    return !cfg?.max_weight || cfg.max_weight <= 0 || !cfg?.max_reps || cfg.max_reps <= 0;
  });
  const allReady = missingRef.length === 0;

  const setCfg = (exId: string, patch: Partial<ExerciseConfig>) =>
    setConfigs(prev => ({ ...prev, [exId]: { ...(prev[exId] ?? {}), ...patch } }));

  // One effort for the whole session: the common case. It is "mixed" once a
  // lift has been given its own under Adjust.
  const efforts = strengthExs.map(ex => configs[ex.id]?.rpe ?? DEFAULT_RPE);
  const sessionRpe = efforts.length ? Math.round(efforts.reduce((a, b) => a + b, 0) / efforts.length) : DEFAULT_RPE;
  const mixed = new Set(efforts).size > 1;
  const setSessionRpe = (rpe: number) =>
    setConfigs(prev => {
      const next = { ...prev };
      for (const ex of strengthExs) next[ex.id] = { ...(next[ex.id] ?? {}), rpe };
      return next;
    });

  const resetCfg = (exId: string) => {
    const ex = planned.find(e => e.id === exId);
    if (!ex) return;
    const pr = prs[exId];
    const hist = !pr ? refFromHistory(exId, history) : null;
    setConfigs(prev => ({
      ...prev,
      [exId]: {
        rpe: DEFAULT_RPE,
        max_weight: pr?.weight ?? hist?.weight ?? undefined,
        max_reps:   pr?.reps   ?? hist?.reps   ?? undefined,
        warmup_sets:  DEFAULT_WARMUP_SETS,
        working_sets: DEFAULT_WORKING_SETS,
        working_reps: DEFAULT_WORKING_REPS,
      },
    }));
  };

  return (
    <>
      <div className="wz-hdr">
        <button className="wz-back" onClick={onBack}><ArrowLeft size={13} /> BACK</button>
        <span className="wz-focus-label"><Gauge size={13} /> RPE SETUP</span>
        <span className="wz-hdr-end" aria-hidden="true" />
      </div>

      <div className="prescribe-session">
        <div className="prescribe-session-title">
          {t("How hard today?", "How hard are we going?", "What's the effort, bestie?")}
        </div>
        <EffortPicker value={sessionRpe} onChange={setSessionRpe} label="Effort for the whole session (1 easy, 10 max)" />
        <div className="prescribe-session-sub">
          {mixed
            ? "Some lifts have their own effort. Tap a bar to set them all again."
            : t("We work out sets, reps and weight from this.", "We do the math from here.", "We'll do the math from here.")}
        </div>
      </div>

      {missingRef.length > 0 && (
        <div className="prescribe-warn">
          <AlertCircle size={13} />
          <span>
            {t(
              `Add your best set (weight × reps) for ${missingRef.length} lift${missingRef.length === 1 ? "" : "s"} below.`,
              `Drop a best set for ${missingRef.length} lift${missingRef.length === 1 ? "" : "s"} so we know where to load you up.`,
              `Plug in a best set for ${missingRef.length} lift${missingRef.length === 1 ? "" : "s"} so we can do the math, bestie.`
            )}
          </span>
        </div>
      )}

      <div className="prescribe-list">
        {strengthExs.map(ex => {
          const cfg = configs[ex.id] ?? {};
          const rpe = cfg.rpe ?? DEFAULT_RPE;
          const hasRef = !!(cfg.max_weight && cfg.max_weight > 0 && cfg.max_reps && cfg.max_reps > 0);
          const refSource = prs[ex.id]
            ? "from PR"
            : refFromHistory(ex.id, history)
              ? "from history"
              : null;
          const presc = hasRef ? prescribeExercise(ex.id, cfg) : null;
          const muscleNames = (EM[ex.id]?.p ?? []).map(mid => MI[mid]?.n).filter(Boolean).join(" · ");
          const open = !hasRef || openIds.has(ex.id);
          const working = cfg.working_sets ?? DEFAULT_WORKING_SETS;
          const reps = cfg.working_reps ?? DEFAULT_WORKING_REPS;
          const warmups = cfg.warmup_sets ?? DEFAULT_WARMUP_SETS;

          return (
            <div key={ex.id} className={`prescribe-card${hasRef ? "" : " prescribe-card-needs-ref"}`}>
              <button
                type="button"
                className="prescribe-card-head prescribe-card-toggle"
                onClick={() => toggleOpen(ex.id)}
                aria-expanded={open}
                disabled={!hasRef}
              >
                <div className="prescribe-card-title">
                  <div className="prescribe-ex-name">{ex.name}</div>
                  <div className="prescribe-ex-muscles">
                    {presc && presc.working.weight > 0
                      ? <span className="prescribe-plan">{presc.working.count} × {presc.working.reps} @ <b>{presc.working.weight} kg</b>{mixed ? ` · effort ${rpe}` : ""}</span>
                      : muscleNames}
                  </div>
                </div>
                {hasRef && <span className="prescribe-adjust">Adjust <ChevronDown size={14} className={open ? "flip" : ""} /></span>}
              </button>

              {open && (
                <div className="prescribe-detail">
                  <div className="prescribe-row">
                    <label className="prescribe-field">
                      <span className="prescribe-field-label">Best set: weight (kg)</span>
                      <NumField
                        value={cfg.max_weight}
                        min={0}
                        max={1000}
                        step={0.5}
                        decimal
                        placeholder="—"
                        onCommit={v => setCfg(ex.id, { max_weight: v })}
                      />
                    </label>
                    <label className="prescribe-field">
                      <span className="prescribe-field-label">× reps</span>
                      <NumField
                        value={cfg.max_reps}
                        min={1}
                        max={30}
                        placeholder="—"
                        onCommit={v => setCfg(ex.id, { max_reps: v })}
                      />
                    </label>
                    {refSource && hasRef && (
                      <span className="prescribe-ref-source">{refSource}</span>
                    )}
                  </div>

                  <div className="prescribe-steppers">
                    <div className="prescribe-stepper">
                      <span className="prescribe-field-label">Warmup sets</span>
                      <Stepper value={warmups} min={0} max={6} label={`Warmup sets for ${ex.name}`} onChange={v => setCfg(ex.id, { warmup_sets: v })} />
                    </div>
                    <div className="prescribe-stepper">
                      <span className="prescribe-field-label">Working sets</span>
                      <Stepper value={working} min={1} max={10} label={`Working sets for ${ex.name}`} onChange={v => setCfg(ex.id, { working_sets: v })} />
                    </div>
                    <div className="prescribe-stepper">
                      <span className="prescribe-field-label">Target reps</span>
                      <Stepper value={reps} min={1} max={30} label={`Target reps for ${ex.name}`} onChange={v => setCfg(ex.id, { working_reps: v })} />
                    </div>
                  </div>

                  <div className="prescribe-own-effort">
                    <span className="prescribe-field-label"><Gauge size={11} /> Effort for this lift</span>
                    <EffortPicker compact value={rpe} onChange={v => setCfg(ex.id, { rpe: v })} label={`Effort for ${ex.name} (1 easy, 10 max)`} />
                  </div>

                  {presc && presc.warmup.length > 0 && (
                    <div className="prescribe-preview">
                      <span className="prescribe-preview-warmup">
                        Warmup: {presc.warmup.map(w => `${w.weight}×${w.reps}`).join(" → ")}
                      </span>
                    </div>
                  )}

                  <button type="button" className="auth-toggle prescribe-reset-link" onClick={() => resetCfg(ex.id)}>
                    <RotateCcw size={11} /> Reset this lift
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="prescribe-footer">
        <button className="wz-next" onClick={() => onStart(configs)} disabled={!allReady}>
          {t("START WORKOUT", "START THE GRIND", "START IT")} <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}
