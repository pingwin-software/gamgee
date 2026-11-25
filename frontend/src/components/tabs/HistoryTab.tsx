import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Timer, Dumbbell, Layers, Weight, Trophy, ChevronDown, ChevronLeft, ChevronRight,
  Pencil, Flame, CalendarCheck, Heart,
} from "lucide-react";
import type { WorkoutSession, PRDict } from "../../types";
import { fmtDate, fmtDur } from "../../utils";
import { ALL_EX, EM } from "../../data/exercises";
import { MI } from "../../data/muscles";
import { getFocusDef } from "../../data/focuses";
import EditWorkoutModal from "./EditWorkoutModal";
import { useTxt } from "../../context/ToneContext";
import "../../simple.css";
import "../../pages/history.css";

interface Props {
  history: WorkoutSession[];
  prs:     PRDict;
  bodyweight: number | null;
  onDelete: (id: string) => void;
  onUpdate: (session: WorkoutSession) => void;
}

/** Monday first, as on the workout page's week strip. */
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Local `YYYY-MM-DD` of a date (never toISOString: that shifts the day). */
const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayOf = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};
const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// Render a strength set's weight chip. Assisted exercises log an offset from
// bodyweight; show the effective lifted weight when known, else just the offset.
function fmtAssistedSet(w: number, reps: string, bodyweight: number | null): string {
  if (bodyweight != null) {
    const eff = Math.round((bodyweight + w) * 10) / 10;
    return w === 0 ? `${eff}kg (BW) × ${reps}` : `${eff}kg (BW − ${Math.abs(w)}) × ${reps}`;
  }
  if (w === 0) return `BW × ${reps}`;
  return `BW ${w < 0 ? "−" : "+"} ${Math.abs(w)}kg × ${reps}`;
}

const setCount = (w: WorkoutSession) => w.exercises.reduce((a, e) => a + e.sets.length, 0);

/** Tonnage of a session. Assisted exercises log negative weight; skip them so
 *  they don't subtract from the total. */
const volumeOf = (w: WorkoutSession) =>
  w.exercises.reduce((a, e) => e.type !== "strength" ? a :
    a + e.sets.reduce((b, s) => {
      const kg = parseFloat(s.weight) || 0;
      if (kg <= 0) return b;
      return b + kg * (parseInt(s.reps) || 0);
    }, 0), 0);

const fmtVolume = (kg: number) =>
  kg >= 10000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg).toLocaleString("en-US")} kg`;

/** Where the session's sets went: muscle groups, biggest first, at most four
 *  slices (the rest folded into "Other"). */
function splitOf(w: WorkoutSession): { name: string; sets: number }[] {
  const by: Record<string, number> = {};
  w.exercises.forEach(ex => {
    const first = EM[ex.id]?.p[0];
    const group = ex.type === "cardio" ? "Cardio" : (first && MI[first]?.g) || "Other";
    by[group] = (by[group] || 0) + ex.sets.length;
  });
  const sorted = Object.entries(by).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    .map(([name, sets]) => ({ name, sets }));
  if (sorted.length <= 4) return sorted;
  const rest = sorted.slice(3).reduce((a, s) => a + s.sets, 0);
  return [...sorted.slice(0, 3), { name: "Other", sets: rest }];
}

export default function HistoryTab({ history, prs, bodyweight, onDelete, onUpdate }: Props) {
  const t = useTxt();
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [calMonth,       setCalMonth]       = useState(() => new Date());
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [jump,           setJump]           = useState<{ id: string; n: number } | null>(null);

  const toggleExpand = (id: string) =>
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const workoutByDay = useMemo(() => {
    const map: Record<string, WorkoutSession[]> = {};
    history.forEach(w => {
      const d = dayOf(new Date(w.date));
      (map[d] = map[d] || []).push(w);
    });
    return map;
  }, [history]);

  const now      = new Date();
  const today    = dayOf(now);
  const year     = calMonth.getFullYear();
  const month    = calMonth.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const calCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];

  // The header's numbers: weeks in a row with a workout (this week may still be
  // empty without breaking it), sessions this month, sessions in all.
  const stats = useMemo(() => {
    const weeks = new Set(history.map(w => dayOf(mondayOf(new Date(w.date)))));
    const cursor = mondayOf(new Date());
    if (!weeks.has(dayOf(cursor))) cursor.setDate(cursor.getDate() - 7);
    let streak = 0;
    while (weeks.has(dayOf(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 7); }
    const ym = dayOf(new Date()).slice(0, 7);
    const thisMonth = history.filter(w => dayOf(new Date(w.date)).slice(0, 7) === ym).length;
    return { streak, thisMonth };
  }, [history]);

  /** How full a day was, by sets: one of three shades. */
  const levelOf = (iso: string) => {
    const sets = (workoutByDay[iso] ?? []).reduce((a, w) => a + setCount(w), 0);
    if (!workoutByDay[iso]) return 0;
    return sets >= 20 ? 3 : sets >= 10 ? 2 : 1;
  };

  /** Open a day's sessions in the list and bring the first one into view. */
  const jumpToDay = (iso: string) => {
    const sessions = workoutByDay[iso];
    if (!sessions?.length) return;
    setExpanded(p => { const s = new Set(p); sessions.forEach(w => s.add(w.id)); return s; });
    setJump(j => ({ id: sessions[0].id, n: (j?.n ?? 0) + 1 }));
  };

  useEffect(() => {
    if (!jump) return;
    const el = document.getElementById(`hx-s-${jump.id}`);
    if (!el) return;
    const still = document.documentElement.getAttribute("data-reduced-motion") === "1"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    const timer = window.setTimeout(() => setJump(null), 1000);
    return () => window.clearTimeout(timer);
  }, [jump]);

  const handleSave = (updated: WorkoutSession) => {
    onUpdate(updated);
    setEditingSession(null);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setEditingSession(null);
  };

  if (history.length === 0) {
    return (
      <div className="tab-anim">
        <div className="empty"><div className="empty-icon"><ClipboardList size={40} /></div><div className="empty-label">{t("No sessions yet", "No sessions yet. Your legend starts today.", "No sessions yet. Your villain origin starts today.")}</div></div>
      </div>
    );
  }

  const renderSession = (w: WorkoutSession) => {
    const isOpen = expanded.has(w.id);
    const sets   = setCount(w);
    const vol    = volumeOf(w);
    const focus  = w.focus ? getFocusDef(w.focus) : undefined;
    const allCardio = w.exercises.length > 0 && w.exercises.every(e => e.type === "cardio");
    const Icon   = focus?.icon ?? (allCardio ? Heart : Dumbbell);
    const split  = splitOf(w);
    const total  = split.reduce((a, s) => a + s.sets, 0);
    const bodyId = `hx-b-${w.id}`;
    return (
      <div
        key={w.id}
        id={`hx-s-${w.id}`}
        className={`hx-card${isOpen ? " open" : ""}${jump?.id === w.id ? " flash" : ""}`}
      >
        <div className="hx-card-top">
          <button
            type="button" className="hx-card-toggle"
            onClick={() => toggleExpand(w.id)}
            aria-expanded={isOpen} aria-controls={bodyId}
          >
            <span className="hx-card-icon"><Icon size={22} /></span>
            <span className="hx-card-text">
              <span className="hx-card-title">
                <span className="hx-card-date">{fmtDate(w.date)}</span>
                {focus && <span className="hx-card-focus">{focus.name}</span>}
              </span>
              <span className="hx-facts">
                <span className="hx-fact"><Timer size={14} /> <b>{fmtDur(w.duration)}</b></span>
                <span className="hx-fact"><Dumbbell size={14} /> <b>{w.exercises.length}</b> {w.exercises.length === 1 ? "exercise" : "exercises"}</span>
                <span className="hx-fact"><Layers size={14} /> <b>{sets}</b> {sets === 1 ? "set" : "sets"}</span>
                {vol > 0 && <span className="hx-fact"><Weight size={14} /> <b>{fmtVolume(vol)}</b></span>}
              </span>
            </span>
            <ChevronDown size={20} className={`hx-chev${isOpen ? " flip" : ""}`} />
          </button>
          <button
            type="button" className="hx-card-edit"
            onClick={() => setEditingSession(w)}
            aria-label={`Edit session of ${fmtDate(w.date)}`} title="Edit session"
          >
            <Pencil size={18} />
          </button>
        </div>

        {total > 0 && (
          <div className="hx-split">
            <div className="hx-bar" role="img" aria-label={`Sets by muscle group: ${split.map(s => `${s.name} ${s.sets}`).join(", ")}`}>
              {split.map((s, i) => (
                <span key={s.name} className={`hx-tone${i}`} style={{ flex: s.sets }} />
              ))}
            </div>
            <div className="hx-legend" aria-hidden="true">
              {split.map((s, i) => (
                <span key={s.name} className="hx-legend-item">
                  <span className={`hx-legend-dot hx-tone${i}`} />{s.name} {s.sets}
                </span>
              ))}
            </div>
          </div>
        )}

        {isOpen && (
          <div className="hx-body" id={bodyId}>
            {w.exercises.map(ex => (
              <div key={ex.uid} className="hx-ex">
                <div className="hx-ex-name">{ex.name}</div>
                <div className="hx-sets">
                  {ex.sets.map((s, i) => {
                    const kg = parseFloat(s.weight);
                    const isPr = ex.type === "strength" && prs[ex.id] && prs[ex.id].weight === kg;
                    const isAssisted = !!ex.is_assisted || !!ALL_EX.find(e => e.id === ex.id)?.is_assisted;
                    const strengthLabel = isAssisted
                      ? fmtAssistedSet(kg, s.reps, bodyweight)
                      : `${s.weight}kg × ${s.reps}`;
                    return (
                      <span key={i} className={`hx-set${isPr ? " pr" : ""}`}>
                        {ex.type === "cardio" ? `${s.weight}min${s.reps ? ` · ${s.reps}km` : ""}`
                          : ex.type === "timed" ? `${s.weight}s`
                          : strengthLabel}
                        {isPr && <Trophy size={13} aria-label="Personal record" />}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // The list, with a small heading where the month changes.
  let lastMonth = "";
  const listRows = history.map(w => {
    const d = new Date(w.date);
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const head = label !== lastMonth ? <h3 key={`m-${label}`} className="hx-month">{label}</h3> : null;
    lastMonth = label;
    return head ? [head, renderSession(w)] : [renderSession(w)];
  });

  return (
    <div className="tab-anim hx-page">
      <div className="hx-stats">
        <div className="hx-stat hx-stat-main">
          <span className="hx-stat-icon"><Flame size={18} /></span>
          <span className="hx-stat-num">{stats.streak}</span>
          <span className="hx-stat-label">{stats.streak === 1 ? "week in a row" : "weeks in a row"}</span>
        </div>
        <div className="hx-stat">
          <span className="hx-stat-icon"><CalendarCheck size={18} /></span>
          <span className="hx-stat-num">{stats.thisMonth}</span>
          <span className="hx-stat-label">this month</span>
        </div>
        <div className="hx-stat">
          <span className="hx-stat-icon"><Trophy size={18} /></span>
          <span className="hx-stat-num">{history.length}</span>
          <span className="hx-stat-label">{history.length === 1 ? "session in all" : "sessions in all"}</span>
        </div>
      </div>

      {/* One calendar, a month at a time, above the one list: a filled day
          opens its sessions in the list below. */}
      <div className="hx-cal">
        <div className="hx-cal-nav">
          <button type="button" className="hx-round" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={20} /></button>
          <span className="hx-cal-month" aria-live="polite">{monthLabel}</span>
          <button type="button" className="hx-round" onClick={nextMonth} aria-label="Next month"><ChevronRight size={20} /></button>
        </div>
        <div className="hx-grid7" aria-hidden="true">
          {DAYS.map((d, i) => <div key={i} className="hx-dow">{d}</div>)}
        </div>
        <div className="hx-grid7">
          {calCells.map((day, i) => {
            if (!day) return <div key={i} className="hx-cal-pad" />;
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const n   = workoutByDay[iso]?.length ?? 0;
            const lvl = levelOf(iso);
            return (
              <button
                key={i} type="button"
                className={`hx-day${lvl ? ` lvl${lvl}` : ""}${iso === today ? " today" : ""}${iso > today ? " future" : ""}`}
                disabled={n === 0}
                onClick={() => jumpToDay(iso)}
                aria-label={`${longDay(iso)}: ${n === 0 ? "no workout" : n === 1 ? "1 workout" : `${n} workouts`}`}
              >
                {day}
                {n > 1 && <span className="hx-day-count">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hx-list">{listRows}</div>

      {editingSession && (
        <EditWorkoutModal
          session={editingSession}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
}
