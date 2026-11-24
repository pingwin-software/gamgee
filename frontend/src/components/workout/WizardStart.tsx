import { useState } from "react";
import { Check, Flame, Play, RotateCcw } from "lucide-react";
import type { DayPlan, ExerciseDef, WeeklyPlan, WorkoutSession } from "../../types";
import { fmtDate, fmtDur } from "../../utils";
import { WEEK_DAYS, dayMapForCurrentWeek, getTodayKey } from "../../data/weeklyPlan";
import { getFocusDef } from "../../data/focuses";
import { ALL_EX } from "../../data/exercises";
import "../../simple.css";
import { useToneMode, useTxt } from "../../context/ToneContext";
import {
  useBroQuotes, useGrlQuotes, useProQuotes,
  useHeroCallsBro, useHeroCallsGrl,
} from "../../hooks/useContentLibrary";
import OnboardingHint from "../OnboardingHint";

interface Props {
  history:     WorkoutSession[];
  weeklyPlan:  WeeklyPlan | null;
  /** Open the builder (pick a mode, a focus, exercises). */
  onStart:     () => void;
  /** Start logging at once with these exercises, weights filled from history. */
  onQuickStart: (exercises: ExerciseDef[], focus: string | null, plan?: DayPlan) => void;
  /** Today's plan has no fixed exercises: open the builder with it loaded. */
  onLoadToday: (plan: DayPlan) => void;
  /** The builder button's words (it opens the plan screen for plan-only users). */
  buildLabel?: string;
}

/** Local `YYYY-MM-DD` of a date (never toISOString: that shifts the day). */
const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** This week, Monday to Sunday: which days were trained, which are planned. */
function WeekStrip({ history, weeklyPlan }: { history: WorkoutSession[]; weeklyPlan: WeeklyPlan | null }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const trained = new Set(history.map(s => dayOf(new Date(s.date))));
  const plan = dayMapForCurrentWeek(weeklyPlan);
  const todayKey = dayOf(today);
  let done = 0;
  const days = WEEK_DAYS.map((d, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = dayOf(date);
    const isDone = trained.has(key);
    if (isDone) done += 1;
    const planned = plan[d.key]?.enabled ? getFocusDef(plan[d.key]!.focus) : null;
    return { ...d, key2: key, isDone, planned, isToday: key === todayKey, past: key < todayKey };
  });
  return (
    <div className="week-strip" aria-label={`This week: ${done} workout${done === 1 ? "" : "s"} done`}>
      <div className="week-days">
        {days.map(d => {
          const Icon = d.planned?.icon;
          return (
            <div key={d.key} className={`week-day${d.isDone ? " done" : ""}${d.isToday ? " today" : ""}${d.past && !d.isDone ? " missed" : ""}`}>
              <span className="week-dot">
                {d.isDone ? <Check size={15} strokeWidth={3} /> : Icon ? <Icon size={14} /> : null}
              </span>
              <span className="week-label">{d.short[0]}</span>
            </div>
          );
        })}
      </div>
      {done > 0 && <div className="week-count"><Flame size={13} /> {done} this week</div>}
    </div>
  );
}

export default function WizardStart({ history, weeklyPlan, onStart, onQuickStart, onLoadToday, buildLabel = "BUILD WORKOUT" }: Props) {
  const lastSession = history[0] ?? null;
  const todayPlan = dayMapForCurrentWeek(weeklyPlan)[getTodayKey()];
  const todayFocus = todayPlan?.enabled ? getFocusDef(todayPlan.focus) : null;
  const todayExs = todayPlan?.enabled
    ? todayPlan.exerciseIds.map(id => ALL_EX.find(e => e.id === id)).filter((e): e is ExerciseDef => !!e)
    : [];
  const lastExs = lastSession
    ? lastSession.exercises.map(e => ALL_EX.find(x => x.id === e.id)).filter((e): e is ExerciseDef => !!e && e.type !== "cardio")
    : [];
  const lastFocus = lastSession?.focus ? getFocusDef(lastSession.focus) : null;
  const names = (exs: ExerciseDef[]) => exs.slice(0, 3).map(e => e.name).join(", ") + (exs.length > 3 ? ` +${exs.length - 3}` : "");
  const mode = useToneMode();
  const t = useTxt();
  const broQuotes = useBroQuotes();
  const grlQuotes = useGrlQuotes();
  const proQuotes = useProQuotes();
  const heroBro   = useHeroCallsBro();
  const heroGrl   = useHeroCallsGrl();
  // Pick once on mount so a later refetch doesn't reshuffle what's on screen.
  const [broQuote] = useState(() => broQuotes[Math.floor(Math.random() * broQuotes.length)]);
  const [grlQuote] = useState(() => grlQuotes[Math.floor(Math.random() * grlQuotes.length)]);
  const [proQuote] = useState(() => proQuotes[Math.floor(Math.random() * proQuotes.length)]);
  const [broHero]  = useState(() => heroBro[Math.floor(Math.random() * heroBro.length)]);
  const [grlHero]  = useState(() => heroGrl[Math.floor(Math.random() * heroGrl.length)]);

  const hero      = mode === "grl" ? grlHero : broHero;
  const activeQuote =
    mode === "grl" ? grlQuote :
    mode === "bro" ? broQuote :
    proQuote;
  const quoteText = activeQuote.text;
  const attr      = activeQuote.source;

  return (
    <div className="start-screen">
      <OnboardingHint hintKey="start" step="START" title={t("Build your first workout", "Build your first session", "Build your first era")}>
        {t(
          "Tap the button below to start. We'll walk through picking a focus, optional cardio, and your exercises.",
          "Hit the button below. We'll guide you through focus, cardio, and your lifts.",
          "Tap the button below, bestie. We'll guide you through focus, cardio, and your moves."
        )}
      </OnboardingHint>
      <h1 className="start-hero">{hero[0]}<br /><span>{hero[1]}</span></h1>
      <div className="start-quote">
        &ldquo;{quoteText}&rdquo;
        {attr && <div className="start-quote-attr">{attr}</div>}
      </div>
      <WeekStrip history={history} weeklyPlan={weeklyPlan} />

      <div className="start-cards">
        {todayPlan?.enabled && todayFocus && (
          <button
            type="button"
            className="start-card start-card-main"
            onClick={() => (todayExs.length > 0 ? onQuickStart(todayExs, todayPlan.focus, todayPlan) : onLoadToday(todayPlan))}
          >
            <span className="start-card-icon"><todayFocus.icon size={22} /></span>
            <span className="start-card-text">
              <span className="start-card-kicker">{t("Today's plan", "Today's mission", "Today's era")}</span>
              <span className="start-card-title">{todayFocus.name}</span>
              <span className="start-card-sub">{todayExs.length > 0 ? names(todayExs) : "Exercises picked for you"}</span>
            </span>
            <span className="start-card-go"><Play size={18} fill="currentColor" /></span>
          </button>
        )}
        {lastSession && lastExs.length > 0 && (
          <button
            type="button"
            className={`start-card${todayFocus ? "" : " start-card-main"}`}
            onClick={() => onQuickStart(lastExs, lastSession.focus ?? null)}
          >
            <span className="start-card-icon"><RotateCcw size={20} /></span>
            <span className="start-card-text">
              <span className="start-card-kicker">{t("Repeat last workout", "Run it back", "Run it back")}</span>
              <span className="start-card-title">{lastFocus?.name ?? "Last session"}</span>
              <span className="start-card-sub">{names(lastExs)} · {fmtDate(lastSession.date)} · {fmtDur(lastSession.duration)}</span>
            </span>
            <span className="start-card-go"><Play size={18} fill="currentColor" /></span>
          </button>
        )}
      </div>

      <button className={todayFocus || lastExs.length > 0 ? "start-build" : "btn-start"} onClick={onStart} style={{ marginBottom: 12 }}>
        {buildLabel}
      </button>
    </div>
  );
}
