import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CardioPlan, DayPlan, ExerciseConfig, ExerciseDef, WorkoutExercise, WorkoutSet, PRDict, WorkoutSession, WeeklyPlan, RestPrefs, WizardTransitionStyle, WorkoutTemplate, WorkoutTemplateDraft, ProgressionOverride, TrainingSuggestion } from "../../types";
import WizardStart from "./WizardStart";
import TrainingSuggestionBanner from "./TrainingSuggestionBanner";
import WizardMode from "./WizardMode";
import WizardFocus from "./WizardFocus";
import WizardBuild from "./WizardBuild";
import WizardPrescribe from "./WizardPrescribe";
import WizardWeeklySetup from "./WizardWeeklySetup";
import WizardTemplate from "./WizardTemplate";
import { buildsOnTheSpot, followsPlans, logs, suggestsWeights, usesRegime, usesTemplates, wizardBackStep, type UsageProfile } from "../../usageProfile";
import ActiveWorkout from "./ActiveWorkout";

interface Props {
  active:          boolean;
  wStep:           number;
  setWStep:        (s: number) => void;
  focus:           string | null;
  setFocus:        (f: string) => void;
  cardio:          CardioPlan;
  setCardio:       (c: CardioPlan) => void;
  planned:         ExerciseDef[];
  setPlanned:      (fn: (p: ExerciseDef[]) => ExerciseDef[]) => void;
  exercises:       WorkoutExercise[];
  prs:             PRDict;
  history:         WorkoutSession[];
  doneSets:        number;
  weeklyPlan:      WeeklyPlan | null;
  setWeeklyPlan:   (plan: WeeklyPlan) => void;
  templates:       WorkoutTemplate[];
  onSaveTemplate:  (draft: WorkoutTemplateDraft) => Promise<WorkoutTemplate | null>;
  onUpdateTemplate:(id: number, draft: WorkoutTemplateDraft) => Promise<WorkoutTemplate | null>;
  onDeleteTemplate:(id: number) => Promise<boolean>;
  onLoadTemplate:  (tpl: WorkoutTemplate) => void;
  progressionOverrides: Record<string, ProgressionOverride>;
  restPrefs:       RestPrefs;
  bodyweight:      number | null;
  wizardTransition: WizardTransitionStyle;
  authFetch:       (url: string, opts?: RequestInit) => Promise<Response>;
  onLoadToday:     (plan: DayPlan) => void;
  startFromWizard: (autoFill: boolean) => void;
  /** One tap from the landing screen: start logging these exercises now. */
  onQuickStart:    (exercises: ExerciseDef[], focus: string | null, plan?: DayPlan) => void;
  /** Location/time based recommendation shown on the landing screen (or null). */
  suggestion:          TrainingSuggestion | null;
  onStartSuggestion:   (s: TrainingSuggestion) => void;
  onDismissSuggestion: () => void;
  /** Pre-existing per-exercise prescribe configs (from a regime day or the
   * user's last-used RPE setup); seeded into the prescribe step when the
   * user picks RPE-driven mode. */
  prescribeInitialConfigs: Record<string, ExerciseConfig>;
  startFromPrescribe: (configs: Record<string, ExerciseConfig>) => void;
  addExercise:     (ex: ExerciseDef) => void;
  removeExercise:  (uid: string) => void;
  updateSet:       (uid: string, idx: number, field: keyof WorkoutSet, value: string) => void;
  setSetRpe:       (uid: string, idx: number, rpe: number | null) => void;
  toggleSet:       (uid: string, idx: number) => void;
  addSet:          (uid: string) => void;
  removeSet:       (uid: string, idx: number) => void;
  toggleExerciseLock: (uid: string) => void;
  isNewPr:         (exId: string, weight: string) => boolean;
  finishWorkout:   () => void;
  cancelWorkout:   () => void;
  applyProgressionAll: () => void;
  /** The questionnaire answers: which workout steps to offer. */
  usage?:          UsageProfile | null;
}

export default function WorkoutTab({
  active, wStep, setWStep, focus, setFocus, cardio, setCardio,
  planned, setPlanned, exercises, prs, history, doneSets,
  weeklyPlan, setWeeklyPlan, templates, onSaveTemplate, onUpdateTemplate, onDeleteTemplate, onLoadTemplate, progressionOverrides, restPrefs, bodyweight, wizardTransition, authFetch, onLoadToday,
  startFromWizard, onQuickStart, suggestion, onStartSuggestion, onDismissSuggestion, prescribeInitialConfigs, startFromPrescribe, addExercise, removeExercise,
  updateSet, setSetRpe, toggleSet, addSet, removeSet, toggleExerciseLock, isNewPr, finishWorkout, cancelWorkout, applyProgressionAll,
  usage = null,
}: Props) {
  // Only the ways the user builds workouts (questionnaire): impromptu only
  // skips the plan screen and goes straight to the focus pick; without
  // impromptu the start opens the plan screen with no one-off option; the
  // weekly regime and templates each show only when picked.
  const onTheSpot = buildsOnTheSpot(usage);
  const plans     = followsPlans(usage);
  const regime    = usesRegime(usage);
  const tpls      = usesTemplates(usage);
  const startLabel = onTheSpot ? "BUILD WORKOUT"
    : regime && tpls ? "MY PLAN & TEMPLATES"
    : regime ? "MY PLAN" : "MY TEMPLATES";
  const buildBackStep = wizardBackStep(4, usage);
  const prevStepRef = useRef(wStep);
  const goingBack   = wStep < prevStepRef.current;
  prevStepRef.current = wStep;
  const stepAnim = goingBack ? "wstep-anim-back" : "wstep-anim";

  // Capture the latest pointerdown coordinates so the earthquake can radiate
  // from wherever the user actually tapped, rather than the screen centre.
  const lastClickRef = useRef<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      lastClickRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // Which template the dedicated builder (step 7) is editing, or null for a
  // fresh "new template" flow.
  const [editingTpl, setEditingTpl] = useState<WorkoutTemplate | null>(null);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [quake, setQuake] = useState<{ vx: number; vy: number; lx: number; ly: number; id: number } | null>(null);
  const triggerQuake = useCallback(() => {
    const { x: vx, y: vy } = lastClickRef.current;
    const rect = hostRef.current?.getBoundingClientRect();
    const lx = rect ? vx - rect.left : vx;
    const ly = rect ? vy - rect.top  : vy;
    setQuake({ vx, vy, lx, ly, id: Date.now() + Math.random() });
  }, []);
  useEffect(() => {
    if (!quake) return;
    const t = window.setTimeout(() => setQuake(null), 650);
    return () => window.clearTimeout(t);
  }, [quake]);

  const setWStepQuake = useCallback((s: number) => {
    if (s !== wStep) triggerQuake();
    setWStep(s);
  }, [wStep, setWStep, triggerQuake]);
  const onLoadTodayQuake = useCallback((plan: DayPlan) => {
    triggerQuake();
    onLoadToday(plan);
  }, [onLoadToday, triggerQuake]);
  const startFromWizardQuake = useCallback((autoFill: boolean) => {
    triggerQuake();
    startFromWizard(autoFill);
  }, [startFromWizard, triggerQuake]);
  const startFromPrescribeQuake = useCallback((configs: Record<string, ExerciseConfig>) => {
    triggerQuake();
    startFromPrescribe(configs);
  }, [startFromPrescribe, triggerQuake]);
  const hostStyle: CSSProperties | undefined = quake
    ? ({ "--quake-x": `${quake.lx}px`, "--quake-y": `${quake.ly}px` } as CSSProperties)
    : undefined;
  const rippleStyle: CSSProperties | undefined = quake
    ? ({ "--quake-x": `${quake.vx}px`, "--quake-y": `${quake.vy}px` } as CSSProperties)
    : undefined;

  const shakingNow = quake && wizardTransition === "earthquake";

  return (
    <>
      <div ref={hostRef} className={`wtab-quake-host${shakingNow ? " earthquake-shake" : ""}`} style={hostStyle}>
      {/* Step 0 — landing */}
      {!active && wStep === 0 && (
        <div key="wstep-0" className={stepAnim}>
          {suggestion && (
            <TrainingSuggestionBanner
              suggestion={suggestion}
              onStart={onStartSuggestion}
              onDismiss={onDismissSuggestion}
            />
          )}
          <WizardStart
            history={history}
            weeklyPlan={regime ? weeklyPlan : null}
            onStart={() => setWStepQuake(plans ? 1 : 2)}
            buildLabel={startLabel}
            onQuickStart={(exs, f, plan) => { triggerQuake(); onQuickStart(exs, f, plan); }}
            onLoadToday={onLoadTodayQuake}
          />
        </div>
      )}

      {/* Step 1 — mode: single vs weekly plan */}
      {!active && wStep === 1 && (
        <div key="wstep-1" className={stepAnim}>
          <WizardMode
            weeklyPlan={weeklyPlan}
            templates={templates}
            onSingle={() => setWStepQuake(2)}
            onLoadToday={onLoadTodayQuake}
            onLoadTemplate={tpl => { triggerQuake(); onLoadTemplate(tpl); }}
            onNewTemplate={() => { setEditingTpl(null); setWStepQuake(7); }}
            onEditTemplate={tpl => { setEditingTpl(tpl); setWStepQuake(7); }}
            onDeleteTemplate={onDeleteTemplate}
            onSetupPlan={() => setWStepQuake(6)}
            onBack={() => setWStepQuake(0)}
            allowOneOff={onTheSpot}
            showRegime={regime}
            showTemplates={tpls}
          />
        </div>
      )}

      {/* Step 2 — focus */}
      {!active && wStep === 2 && (
        <div key="wstep-2" className={stepAnim}>
          <WizardFocus
            focus={focus}
            setFocus={setFocus}
            onBack={() => setWStepQuake(wizardBackStep(2, usage))}
            onNext={() => setWStepQuake(4)}
          />
        </div>
      )}

      {/* Step 4 — build (also starts the workout, no separate review screen) */}
      {!active && wStep === 4 && focus && (
        <div key="wstep-4" className={stepAnim}>
          <WizardBuild
            focus={focus}
            planned={planned}
            setPlanned={setPlanned}
            onBack={() => setWStepQuake(buildBackStep)}
            onStart={startFromWizardQuake}
            cardio={cardio}
            setCardio={setCardio}
            onConfigureRpe={suggestsWeights(usage) && logs(usage, "effort") ? () => setWStepQuake(5) : undefined}
            onSaveTemplate={tpls ? onSaveTemplate : undefined}
            showCardio={logs(usage, "cardio")}
            suggests={suggestsWeights(usage)}
            history={history}
          />
        </div>
      )}

      {/* Step 5 — RPE-driven prescription setup */}
      {!active && wStep === 5 && (
        <div key="wstep-5" className={stepAnim}>
          <WizardPrescribe
            planned={planned}
            prs={prs}
            history={history}
            initialConfigs={prescribeInitialConfigs}
            onBack={() => setWStepQuake(4)}
            onStart={startFromPrescribeQuake}
          />
        </div>
      )}

      {/* Step 6 — weekly plan editor */}
      {!active && wStep === 6 && (
        <div key="wstep-6" className={stepAnim}>
          <WizardWeeklySetup
            initial={weeklyPlan}
            onPersist={setWeeklyPlan}
            onDone={() => setWStepQuake(1)}
            authFetch={authFetch}
          />
        </div>
      )}

      {/* Step 7 — dedicated template builder (no workout) */}
      {!active && wStep === 7 && (
        <div key="wstep-7" className={stepAnim}>
          <WizardTemplate
            initial={editingTpl}
            onSaveTemplate={onSaveTemplate}
            onUpdateTemplate={onUpdateTemplate}
            onDone={() => { setEditingTpl(null); setWStepQuake(1); }}
            history={history}
          />
        </div>
      )}

      {/* Active workout */}
      {active && (
        <div className="screen-anim">
          <ActiveWorkout
            exercises={exercises}
            prs={prs}
            history={history}
            doneSets={doneSets}
            progressionOverrides={progressionOverrides}
            restPrefs={restPrefs}
            bodyweight={bodyweight}
            onFinish={finishWorkout}
            onCancel={cancelWorkout}
            addExercise={addExercise}
            removeExercise={removeExercise}
            updateSet={updateSet}
            setSetRpe={setSetRpe}
            toggleSet={toggleSet}
            addSet={addSet}
            removeSet={removeSet}
            toggleExerciseLock={toggleExerciseLock}
            isNewPr={isNewPr}
            applyProgressionAll={applyProgressionAll}
            suggests={suggestsWeights(usage)}
            restTimer={logs(usage, "rest")}
            rateEffort={logs(usage, "effort")}
          />
        </div>
      )}
      </div>
      {quake && wizardTransition !== "none" && (
        <div
          key={quake.id}
          className={`wz-fx wz-fx-${wizardTransition}`}
          style={rippleStyle}
          aria-hidden
        />
      )}
    </>
  );
}
