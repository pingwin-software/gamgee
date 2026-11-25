import { useState } from "react";
import {
  Brain, ChevronRight, Footprints, TrendingUp, TrendingDown, Equal, Compass, Flag, Target,
  type IconType,
} from "../../icons";
import type { ExerciseDef, WorkoutSession, ProgressionOverride } from "../../types";
import { ALL_EX } from "../../data/exercises";
import { analyzeEx, analyzeCardio, type AnalysisResult, type CardioAnalysisResult } from "../../analysis";
import { useTxt } from "../../context/ToneContext";
import ExerciseDiagnostics from "../exercise/ExerciseDiagnostics";
import "../../simple.css";
import "../../pages/progress.css";

interface Props {
  history: WorkoutSession[];
  overrides: Record<string, ProgressionOverride>;
  onSetOverride: (exId: string, override: ProgressionOverride | null) => void;
  onUpdateSession: (session: WorkoutSession) => void;
}

// Sort so the lifts that need attention float to the top: steered first (you
// asked to drive them), then slipping, holding, progressing, then baselines.
const STATUS_ORDER: Record<string, number> = {
  "STEERING": 0, "BACKING OFF": 1, "HOLDING": 2, "PROGRESSING": 3, "BASELINE": 4,
};

/** Pace as m:ss per km, or null when we can't compute it (no distance/time). */
function fmtPace(durationMin: number, distanceKm: number): string | null {
  if (!(durationMin > 0) || !(distanceKm > 0)) return null;
  const secPerKm = (durationMin * 60) / distanceKm;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

type Tone = "up" | "flat" | "down" | "steer" | "new";
type Filter = "up" | "flat" | "down";

/** How each status reads on the page: a word and an icon, with the colour
 * only backing them up. Keyed by the analyzer's status label. */
const TONES: Record<string, { tone: Tone; word: string; Icon: IconType }> = {
  "PROGRESSING": { tone: "up",    word: "Gaining",  Icon: TrendingUp },
  "HOLDING":     { tone: "flat",  word: "Holding",  Icon: Equal },
  "BACKING OFF": { tone: "down",  word: "Slipping", Icon: TrendingDown },
  "STEERING":    { tone: "steer", word: "Steering", Icon: Compass },
  "BASELINE":    { tone: "new",   word: "Baseline", Icon: Flag },
};
const toneOf = (label: string) => TONES[label] ?? TONES.BASELINE;

const FILTERS: { id: Filter; word: string; Icon: IconType }[] = [
  { id: "up",   word: "Gaining",  Icon: TrendingUp },
  { id: "flat", word: "Holding",  Icon: Equal },
  { id: "down", word: "Slipping", Icon: TrendingDown },
];

const num = (v: number) => String(Math.round(v * 10) / 10);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${num(Math.abs(v))}`;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The series as a small line, oldest to newest, ending in a dot. */
function Sparkline({ values, unit, what }: { values: number[]; unit: string; what: string }) {
  const W = 100, H = 32, PAD = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => span === 0 ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const first = values[0], last = values[values.length - 1];
  const dir = last > first ? "up" : last < first ? "down" : "level";
  return (
    <span
      className="pg-spark"
      role="img"
      aria-label={`${what} over ${values.length} sessions: from ${num(first)} ${unit} to ${num(last)} ${unit}, ${dir}.`}
    >
      <span className="pg-spark-clip">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="pg-spark-area" d={`${line} L${W} ${H} L0 ${H} Z`} />
          <path className="pg-spark-line" d={line} />
        </svg>
      </span>
      <span className="pg-spark-dot" style={{ top: `${(y(last) / H) * 100}%` }} />
    </span>
  );
}

export default function CoachTab({ history, overrides, onSetOverride, onUpdateSession }: Props) {
  const t = useTxt();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);

  if (detailId) {
    const ex = ALL_EX.find(e => e.id === detailId);
    if (ex) {
      return (
        <ExerciseDiagnostics
          exId={ex.id}
          exName={ex.name}
          history={history}
          override={overrides[ex.id] ?? null}
          onSetOverride={onSetOverride}
          onUpdateSession={onUpdateSession}
          onBack={() => setDetailId(null)}
        />
      );
    }
  }

  const coachData = ALL_EX
    .filter(ex => ex.type === "strength" && !ex.is_assisted)
    .map(ex => ({ ex, a: analyzeEx(ex.id, history, overrides[ex.id]) }))
    .filter((item): item is { ex: ExerciseDef; a: AnalysisResult } => item.a !== null)
    .sort((x, y) => (STATUS_ORDER[x.a.status.label] ?? 9) - (STATUS_ORDER[y.a.status.label] ?? 9));

  const cardioData = ALL_EX
    .filter(ex => ex.type === "cardio")
    .map(ex => ({ ex, a: analyzeCardio(ex.id, history) }))
    .filter((item): item is { ex: ExerciseDef; a: CardioAnalysisResult } => item.a !== null)
    .sort((x, y) => (STATUS_ORDER[x.a.status.label] ?? 9) - (STATUS_ORDER[y.a.status.label] ?? 9));

  const hasData = coachData.length > 0 || cardioData.length > 0;

  const counts: Record<Filter, number> = { up: 0, flat: 0, down: 0 };
  for (const { a } of [...coachData, ...cardioData]) {
    const tone = toneOf(a.status.label).tone;
    if (tone === "up" || tone === "flat" || tone === "down") counts[tone]++;
  }
  const shown = (label: string) => filter === null || toneOf(label).tone === filter;
  const lifts = coachData.filter(({ a }) => shown(a.status.label));
  const cardio = cardioData.filter(({ a }) => shown(a.status.label));
  const nextLabel = t("Next session", "Next session: go for it", "Next session: manifest it");

  if (!hasData) {
    return (
      <div className="tab-anim">
        <div className="empty">
          <div className="empty-icon"><Brain size={40} /></div>
          <div className="empty-label">{t("Log sessions to unlock coaching", "Log some sessions and the coach wakes up", "Log a few sessions and the coach pulls up")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-anim pg">
      <div className="pg-summary" role="group" aria-label="Show lifts by trend">
        {FILTERS.map(({ id, word, Icon }) => (
          <button
            key={id}
            type="button"
            className={`pg-sum pg-tone-${id}${filter === id ? " on" : ""}${counts[id] === 0 ? " zero" : ""}`}
            aria-pressed={filter === id}
            aria-label={`${word}: ${counts[id]}. ${filter === id ? "Showing only these, tap to show all" : "Tap to show only these"}`}
            onClick={() => setFilter(f => (f === id ? null : id))}
          >
            <span className="pg-sum-icon"><Icon size={20} /></span>
            <span className="pg-sum-num">{counts[id]}</span>
            <span className="pg-sum-label">{word}</span>
          </button>
        ))}
      </div>

      <p className="pg-hint">
        {t(
          "What to work on next, sorted by what needs the most attention. Tap a lift for its chart, to fix a past set or steer where it is heading.",
          "What to hit next, sorted by what needs you most. Tap a lift to see the chart, fix a logged set, or grab the wheel.",
          "What to hit next, sorted by what needs you most, bestie. Tap a lift for the chart, fix a set or steer the vibe."
        )}
      </p>

      {filter !== null && lifts.length === 0 && cardio.length === 0 && (
        <div className="pg-filter-empty">
          <span>{t("Nothing in this group right now.", "Nothing in this pile right now.", "Nothing in this pile right now, bestie.")}</span>
          <button type="button" className="chip-btn" style={{ minHeight: 44 }} onClick={() => setFilter(null)}>Show all</button>
        </div>
      )}

      {lifts.map(({ ex, a }) => {
        const { sessions, last, est1RM, status, nextWeight, nextReps, reason, trendPerSession } = a;
        const { tone, word, Icon } = toneOf(status.label);
        // Plot the RIR-adjusted estimated 1RM: that is the series the trend is
        // fit on, so the line matches the read.
        const TrendIcon = trendPerSession > 0.05 ? TrendingUp : trendPerSession < -0.05 ? TrendingDown : Equal;
        return (
          <button
            key={ex.id}
            type="button"
            className={`pg-lift pg-tone-${tone}`}
            onClick={() => setDetailId(ex.id)}
            title="Open the chart to edit past sets or steer the target"
          >
            <span className="pg-lift-head">
              <span className="pg-lift-name">{ex.name}</span>
              <span className="pg-pill"><Icon size={14} aria-hidden="true" /> {word}</span>
              <span className="pg-lift-chev" aria-hidden="true"><ChevronRight size={18} /></span>
            </span>

            {sessions.length > 1 ? (
              <span className="pg-trend">
                <Sparkline values={sessions.map(s => s.e1rm)} unit="kg" what="Estimated one rep max" />
                <span className="pg-trend-read">
                  <span className="pg-trend-num"><TrendIcon size={16} aria-hidden="true" /> {signed(Number(trendPerSession.toFixed(1)))} kg</span>
                  <span className="pg-trend-sub">per session</span>
                </span>
              </span>
            ) : (
              <span className="pg-first">One session logged. The trend line starts with the next one.</span>
            )}

            <span className="pg-next">
              <span className="pg-next-label"><Target size={13} aria-hidden="true" /> {nextLabel}</span>
              <span className="pg-next-target">
                {nextWeight} <small>kg ×</small> {nextReps} <small>reps</small>
              </span>
              <span className="pg-next-reason">{reason}</span>
            </span>

            <span className="pg-facts">
              <span className="pg-fact">Last <b>{last.topW} kg{last.topR > 0 ? ` × ${last.topR}` : ""}</b></span>
              <span className="pg-fact"><b>{last.totalSets}</b> {last.totalSets === 1 ? "set" : "sets"}</span>
              {est1RM && <span className="pg-fact">Est. 1RM <b>~{est1RM} kg</b></span>}
              <span className="pg-fact">{plural(sessions.length, "session")}</span>
            </span>
          </button>
        );
      })}

      {cardio.length > 0 && (
        <div className="pg-section-head">
          <Footprints size={14} aria-hidden="true" /> {t("Cardio", "Cardio", "Cardio")}
        </div>
      )}
      {cardio.map(({ ex, a }) => {
        const { sessions, last, metric, status, nextDuration, nextDistance, reason, trendPerSession } = a;
        const { tone, word, Icon } = toneOf(status.label);
        const series = sessions.map(s => metric === "distance" ? s.distance : s.duration);
        const unit = metric === "distance" ? "km" : "min";
        const TrendIcon = trendPerSession > 0.01 ? TrendingUp : trendPerSession < -0.01 ? TrendingDown : Equal;
        const lastPace = fmtPace(last.duration, last.distance);
        // Build the next-target line from whichever of duration/distance the
        // session actually carries: never show kg or reps for a run.
        const targetBits: [string, string][] = [];
        if (nextDistance > 0) targetBits.push([String(nextDistance), "km"]);
        if (nextDuration > 0) targetBits.push([String(nextDuration), "min"]);
        return (
          <div key={ex.id} className={`pg-lift pg-tone-${tone}`}>
            <div className="pg-lift-head">
              <span className="pg-lift-name">{ex.name}</span>
              <span className="pg-pill"><Icon size={14} aria-hidden="true" /> {word}</span>
            </div>

            {sessions.length > 1 ? (
              <div className="pg-trend">
                <Sparkline values={series} unit={unit} what={metric === "distance" ? "Distance" : "Time"} />
                <span className="pg-trend-read">
                  <span className="pg-trend-num"><TrendIcon size={16} aria-hidden="true" /> {signed(trendPerSession)} {unit}</span>
                  <span className="pg-trend-sub">per session</span>
                </span>
              </div>
            ) : (
              <div className="pg-first">One session logged. The trend line starts with the next one.</div>
            )}

            <div className="pg-next">
              <span className="pg-next-label"><Target size={13} aria-hidden="true" /> {nextLabel}</span>
              <span className="pg-next-target">
                {targetBits.length === 0 ? "No target yet" : targetBits.map(([v, u], i) => (
                  <span key={u}>{i > 0 && <small> · </small>}{v} <small>{u}</small></span>
                ))}
              </span>
              <span className="pg-next-reason">{reason}</span>
            </div>

            <div className="pg-facts">
              {last.duration > 0 && <span className="pg-fact">Last time <b>{last.duration} min</b></span>}
              {last.distance > 0 && <span className="pg-fact">Last distance <b>{last.distance} km</b></span>}
              {lastPace && <span className="pg-fact">Pace <b>{lastPace}</b></span>}
              <span className="pg-fact">{plural(sessions.length, "session")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
