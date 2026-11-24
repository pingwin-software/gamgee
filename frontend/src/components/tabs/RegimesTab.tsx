import { useEffect, useRef, useState } from "react";
import {
  Bookmark, Calendar, CalendarCheck, Check, ChevronUp, Dumbbell, Pencil, Play, Plus, Trash2, Wand2, X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { DayPlan, Regime, WeeklyPlan, WeekPlanDay, WeekPlan, WorkoutTemplate } from "../../types";
import { weeklyPlanFromWeeks } from "../../data/weeklyPlan";
import { getFocusDef } from "../../data/focuses";
import { useTxt } from "../../context/ToneContext";
import RegimeQuestionnairePanel from "../regime/RegimeQuestionnaire";
import RegimeEditor from "../regime/RegimeEditor";
import TemplateEditorSheet from "../templates/TemplateEditorSheet";
import { useTemplates } from "../../context/TemplatesContext";
import "../../simple.css";
import "../../pages/plans.css";

interface Props {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  weeklyPlan: WeeklyPlan | null;
  setWeeklyPlan: (plan: WeeklyPlan) => void;
  /** Show the saved-templates section (people who use templates). */
  showTemplates?: boolean;
  /** Show the regimes section (people who follow a weekly regime, or a trainer's). */
  showRegimes?: boolean;
}

const WEEK_KEYS: WeekPlanDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEK_LABELS: Record<WeekPlanDay, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_NAMES: Record<WeekPlanDay, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

type DayMap = Partial<Record<string, DayPlan>> | null | undefined;

/* ── Pieces shared by the Plans pages (regimes, coaching, trainees) ─────── */

/** A week at a glance: one dot a day, the focus icon on training days. */
export function WeekDots({ days, small }: { days: DayMap; small?: boolean }) {
  const summary = WEEK_KEYS
    .map(k => {
      const d = days?.[k];
      return `${DAY_NAMES[k]}: ${d?.enabled ? (getFocusDef(d.focus)?.name ?? d.focus ?? "training") : "rest"}`;
    })
    .join(", ");
  return (
    <span className={`pl-week${small ? " pl-week-sm" : ""}`} role="img" aria-label={summary}>
      {WEEK_KEYS.map(k => {
        const d = days?.[k];
        const on = !!d?.enabled;
        const Icon = on ? (getFocusDef(d!.focus)?.icon ?? Dumbbell) : null;
        return (
          <span key={k} className={`pl-day${on ? " on" : ""}`} title={on ? (getFocusDef(d!.focus)?.name ?? d!.focus) : "Rest"}>
            <span className="pl-dot">{Icon && <Icon size={small ? 13 : 16} />}</span>
            <span className="pl-day-label">{small ? WEEK_LABELS[k][0] : WEEK_LABELS[k]}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Initials in a ring of the person's own colour. */
export function PlanAvatar({ name, color, large, live }: { name: string; color?: string | null; large?: boolean; live?: boolean }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2)).toUpperCase();
  const style = color && !live ? ({ "--pl-c": color } as CSSProperties) : undefined;
  return (
    <span className={`pl-avatar${large ? " pl-avatar-lg" : ""}${live ? " live" : ""}`} style={style} aria-hidden="true">
      {initials}
    </span>
  );
}

/** A destructive button that asks once more before it acts: the first tap
 *  arms it for a few seconds, the second one goes through. */
export function ConfirmButton({
  label, armedLabel = "Tap again", icon, onConfirm, className = "",
}: { label: string; armedLabel?: string; icon?: ReactNode; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      className={`pl-btn pl-btn-danger${armed ? " armed" : ""} ${className}`}
      onClick={() => {
        if (timer.current) window.clearTimeout(timer.current);
        if (armed) { setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 4000);
      }}
    >
      {icon ?? <X size={18} />}
      <span aria-live="polite">{armed ? armedLabel : label}</span>
    </button>
  );
}

/* ── Regimes ───────────────────────────────────────────────────────────── */

const firstWeek = (r: Regime): DayMap => (r.weeks && r.weeks.length > 0 ? r.weeks[0].days : r.days);

/** The shape of a week, to tell whether the plan in use came from a regime. */
function weekSig(days: DayMap): string {
  return WEEK_KEYS
    .map(k => {
      const d = days?.[k];
      return d?.enabled ? `${d.focus}:${(d.exerciseIds ?? []).join(",")}` : "-";
    })
    .join("|");
}
const REST_WEEK = WEEK_KEYS.map(() => "-").join("|");

export default function RegimesTab({ authFetch, weeklyPlan, setWeeklyPlan, showTemplates = true, showRegimes = true }: Props) {
  const t = useTxt();
  const { templates, remove: removeTemplate, start: startTemplate } = useTemplates();
  const [editingTpl, setEditingTpl] = useState<WorkoutTemplate | null | "new">(null);
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Regime | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/regimes");
      if (r.ok) setRegimes(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyToWeek = (regime: Regime) => {
    const weeks: WeekPlan[] = (regime.weeks && regime.weeks.length > 0)
      ? regime.weeks.map(w => ({ label: w.label ?? null, days: { ...w.days } }))
      : [{
          label: "Week 1",
          days: Object.fromEntries(
            (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as WeekPlanDay[])
              .map(k => [k, regime.days?.[k]])
              .filter(([, v]) => v),
          ) as WeeklyPlan,
        }];
    const plan = weeklyPlanFromWeeks(weeks);
    setWeeklyPlan(plan);
    setAppliedId(regime.id);
    setTimeout(() => setAppliedId(null), 2500);
  };

  const deleteRegime = async (id: number) => {
    if (!confirm("Delete this regime? Any assignments to trainees will also be revoked.")) return;
    await authFetch(`/api/regimes/${id}`, { method: "DELETE" });
    refresh();
  };

  if (editing) {
    return (
      <RegimeEditor
        authFetch={authFetch}
        regime={editing}
        onSaved={() => { setEditing(null); refresh(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  // The regime whose week is the one in use right now (the first that matches).
  const planWeeks = weeklyPlan?.weeks && weeklyPlan.weeks.length > 0 ? weeklyPlan.weeks : null;
  const planSig = weeklyPlan ? weekSig(planWeeks ? planWeeks[0].days : weeklyPlan) : REST_WEEK;
  const planLen = planWeeks ? planWeeks.length : 1;
  const matches = planSig === REST_WEEK
    ? []
    : regimes.filter(r => weekSig(firstWeek(r)) === planSig && Math.max(1, r.weeks?.length ?? 1) === planLen);
  const activeId = (matches.find(r => r.id === appliedId) ?? matches[0])?.id ?? null;

  return (
    <div className="regimes-tab tab-anim pl-page">
      {showRegimes && (
      <section className="pl-section">
        <h2 className="pl-head">
          <Calendar size={18} /> {t("My regimes", "My programs", "My eras")}
          {regimes.length > 0 && <span className="pl-count">{regimes.length}</span>}
        </h2>

        <div className="pl-starts">
          <button
            type="button"
            className={`start-card${building ? "" : " start-card-main"}`}
            onClick={() => setBuilding(b => !b)}
            aria-expanded={building}
          >
            <span className="start-card-icon">{building ? <ChevronUp size={22} /> : <Wand2 size={22} />}</span>
            <span className="start-card-text">
              <span className="start-card-kicker">{building ? "Builder open" : t("New regime", "New program", "New era")}</span>
              <span className="start-card-title">{building ? "Close the builder" : "Run the questionnaire"}</span>
              <span className="start-card-sub">
                {building ? "Your answers are not saved until you finish." : "A few taps about your goal and your week, and the plan builds itself."}
              </span>
            </span>
          </button>
        </div>

        {building && (
          <RegimeQuestionnairePanel
            authFetch={authFetch}
            onSaved={r => { refresh(); applyToWeek(r); }}
          />
        )}

        {loading && regimes.length === 0 && (
          <div className="pl-grid" aria-busy="true" aria-label="Loading your regimes">
            <div className="pl-skel" /><div className="pl-skel" />
          </div>
        )}

        {!loading && regimes.length === 0 && !building && (
          <div className="pl-empty">
            <span className="pl-empty-icon"><Calendar size={26} /></span>
            <p>{t(
              "No regimes yet. Answer a few questions and get a week built around your goals.",
              "No programs yet. Answer a few questions and get a week built for your gains.",
              "No eras yet. Answer a few questions and get a week built just for you.",
            )}</p>
          </div>
        )}

        {regimes.length > 0 && (
          <div className="pl-grid">
            {regimes.map(r => {
              const isActive = r.id === activeId;
              const justApplied = appliedId === r.id;
              const weeks = r.weeks?.length ?? 1;
              return (
                <article key={r.id} className={`pl-card${isActive ? " is-on" : ""}`}>
                  <div className="pl-card-top">
                    <div className="pl-card-id">
                      <span className="pl-name">{r.name}</span>
                      <div className="pl-pills">
                        <span className="pl-pill pl-pill-plain">{r.days_per_week} days a week</span>
                        <span className="pl-pill pl-pill-plain">{weeks > 1 ? `${weeks} weeks` : "1 week"}</span>
                        <span className="pl-pill">{(r.goal || "general").replace("_", " ")}</span>
                        <span className="pl-pill">{r.experience || "any level"}</span>
                      </div>
                    </div>
                    {isActive && <span className="pl-tag pl-tag-on"><Check size={14} strokeWidth={3} /> Active</span>}
                  </div>
                  {r.description && <p className="pl-desc">{r.description}</p>}
                  <WeekDots days={r.days} />
                  <div className="pl-actions">
                    <button
                      type="button"
                      className={`pl-btn pl-btn-main${justApplied ? " done" : ""}`}
                      onClick={() => applyToWeek(r)}
                    >
                      {justApplied ? <Check size={18} strokeWidth={3} /> : <CalendarCheck size={18} />}
                      {justApplied ? "Applied!" : isActive ? "Apply again" : "Apply to my week"}
                    </button>
                    <button type="button" className="pl-btn" onClick={() => setEditing(r)}>
                      <Pencil size={18} /> Edit
                    </button>
                    <button
                      type="button"
                      className="pl-btn pl-btn-icon pl-btn-danger"
                      onClick={() => deleteRegime(r.id)}
                      aria-label={`Delete regime ${r.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      )}

      {/* Saved templates: single-session blueprints. Each can be started,
          edited or deleted here, same as on the workout-type screen and in the
          day editors. */}
      {showTemplates && (
      <section className="pl-section">
        <h2 className="pl-head">
          <Bookmark size={18} /> My templates
          {templates.length > 0 && <span className="pl-count">{templates.length}</span>}
        </h2>
        <div className="pl-starts">
          <button type="button" className="pl-btn" onClick={() => setEditingTpl("new")}>
            <Plus size={18} /> New template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="pl-muted">No templates yet. Make one here, or build a workout and tap “Save as template”.</p>
        ) : (
          <div className="pl-grid pl-grid-tight">
            {templates.map(tpl => {
              const fd = tpl.focus ? getFocusDef(tpl.focus) : null;
              const Icon = fd?.icon ?? Dumbbell;
              const n = tpl.exercise_ids.length;
              return (
                <article key={tpl.id} className="pl-card pl-tpl">
                  <div className="pl-row pl-row-flat">
                    <span className="pl-icon"><Icon size={22} /></span>
                    <div className="pl-card-id">
                      <span className="pl-name">{tpl.name}</span>
                      <span className="pl-sub">{fd ? `${fd.name} · ` : ""}{n} exercise{n !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="pl-actions">
                    <button type="button" className="pl-btn pl-btn-main" onClick={() => startTemplate(tpl)}>
                      <Play size={18} /> Start
                    </button>
                    <button type="button" className="pl-btn" onClick={() => setEditingTpl(tpl)}>
                      <Pencil size={18} /> Edit
                    </button>
                    <ConfirmButton
                      label="Delete"
                      armedLabel="Tap again"
                      icon={<Trash2 size={18} />}
                      onConfirm={() => { removeTemplate(tpl.id); }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}
      {editingTpl && (
        <TemplateEditorSheet initial={editingTpl === "new" ? null : editingTpl} onClose={() => setEditingTpl(null)} />
      )}
    </div>
  );
}
