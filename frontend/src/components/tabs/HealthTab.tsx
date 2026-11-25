import { useState, useEffect } from "react";
import {
  Heart, Plus, Minus, Trash2, ChevronDown, Scale, Percent, Ruler, Shirt, BicepsFlexed,
  Footprints, HeartPulse, Pill, Activity, ArrowUpRight, ArrowDownRight, ArrowRight,
  type IconType,
} from "../../icons";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import type { BodyMetric, MetricDef } from "../../types";
import { METRICS } from "../../data/metrics";
import { fmtShortDate } from "../../utils";
import { useTxt } from "../../context/ToneContext";
import "../../simple.css";
import "../../pages/progress.css";

const ICONS: Record<string, IconType> = {
  weight: Scale, body_fat: Percent, waist: Ruler, chest: Shirt, hips: Activity,
  bicep: BicepsFlexed, thigh: Footprints, resting_hr: HeartPulse, zinc: Pill,
};

/** Where the plus and minus buttons start from when nothing has been logged
 * or typed yet. After the first entry they start from the latest value. */
const START: Record<string, number> = {
  weight: 70, body_fat: 20, waist: 80, chest: 95, hips: 95, bicep: 32, thigh: 55, resting_hr: 60, zinc: 10,
};

/** Today as the user's calendar says it (toISOString would give the UTC day). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
/** A value at the metric's precision, without float noise or trailing zeros. */
const fmt = (v: number, m: MetricDef) => String(Number(v.toFixed(Math.max(1, decimals(m.step)))));
const fmtDelta = (d: number, m: MetricDef) => `${d > 0 ? "+" : d < 0 ? "-" : ""}${fmt(Math.abs(d), m)}`;

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.getAttribute("data-reduced-motion") === "1"
    || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function Delta({ diff, metric, since }: { diff: number; metric: MetricDef; since: string }) {
  const flat = Math.abs(diff) < metric.step / 2;
  const Icon = flat ? ArrowRight : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="pg-delta">
      <Icon size={16} aria-hidden="true" />
      {flat ? "Same" : `${fmtDelta(diff, metric)} ${metric.unit}`}
      <span>{flat ? `as ${since}` : `since ${since}`}</span>
    </span>
  );
}

interface Props {
  healthMetrics: BodyMetric[];
  fetchHealthMetrics: (type: string) => Promise<void>;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}

export default function HealthTab({ healthMetrics, fetchHealthMetrics, authFetch }: Props) {
  const t = useTxt();
  const [activeMetric, setActiveMetric] = useState<MetricDef>(METRICS[0]);
  const [showAll, setShowAll]           = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [form, setForm] = useState({
    date:  today(),
    value: "",
    note:  "",
  });

  useEffect(() => {
    fetchHealthMetrics(activeMetric.id);
    setShowAll(false);
    // A half-typed value belongs to the metric it was typed for.
    setForm(f => ({ ...f, value: "" }));
  // fetchHealthMetrics is stable (defined once in WorkoutTracker)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMetric.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value) return;
    const res = await authFetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metric_type: activeMetric.id,
        value:       parseFloat(form.value),
        unit:        activeMetric.unit,
        date:        form.date,
        note:        form.note || null,
      }),
    });
    if (res.ok) {
      setForm(f => ({ ...f, value: "", note: "" }));
      await fetchHealthMetrics(activeMetric.id);
      showToast("Logged!");
    }
  };

  const handleDelete = async (id: number) => {
    await authFetch(`/api/health/${id}`, { method: "DELETE" });
    await fetchHealthMetrics(activeMetric.id);
  };

  const chartData = healthMetrics.map(m => ({
    label: fmtShortDate(m.date),
    value: m.value,
    note:  m.note,
    id:    m.id,
  }));

  const baseline = chartData.length > 0 ? chartData[0].value : null;

  const reversed = [...healthMetrics].reverse();
  const visible  = showAll ? reversed : reversed.slice(0, 10);

  const m      = activeMetric;
  const latest = healthMetrics.length > 0 ? healthMetrics[healthMetrics.length - 1] : null;
  const prev   = healthMetrics.length > 1 ? healthMetrics[healthMetrics.length - 2] : null;
  const first  = healthMetrics.length > 2 ? healthMetrics[0] : null;

  // The plus and minus buttons: from what is typed, else the latest entry,
  // else a likely starting point. The first press only fills the field in.
  const typed    = parseFloat(form.value);
  const hasTyped = Number.isFinite(typed);
  const stepBase = latest ? latest.value : (START[m.id] ?? (m.min + m.max) / 2);
  const nudge = (dir: 1 | -1) => {
    const next = hasTyped ? typed + dir * m.step : stepBase;
    const snapped = Math.round(next / m.step) * m.step;
    const clamped = Math.max(m.min, Math.min(m.max, snapped));
    setForm(f => ({ ...f, value: clamped.toFixed(decimals(m.step)) }));
  };

  const values = healthMetrics.map(x => x.value);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = Math.max((hi - lo) * 0.2, m.step * 2);
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const chartLabel = latest && healthMetrics.length > 1
    ? `${m.label} from ${fmtShortDate(healthMetrics[0].date)} to ${fmtShortDate(latest.date)}: `
      + `started at ${fmt(healthMetrics[0].value, m)} ${m.unit}, now ${fmt(latest.value, m)} ${m.unit}, `
      + (Math.abs(latest.value - healthMetrics[0].value) < m.step / 2
        ? "no change"
        : `${latest.value > healthMetrics[0].value ? "up" : "down"} ${fmt(Math.abs(latest.value - healthMetrics[0].value), m)} ${m.unit}`)
      + ` over ${healthMetrics.length} entries. Lowest ${fmt(lo, m)}, highest ${fmt(hi, m)}.`
    : "";

  return (
    <div className="tab-anim pg">
      {toast && (
        <div className="health-toast" role="status">{toast}</div>
      )}

      {/* Metric selector */}
      <div className="pg-metrics" role="group" aria-label="What to track">
        {METRICS.map(x => {
          const Icon = ICONS[x.id] ?? Activity;
          const on = m.id === x.id;
          return (
            <button
              key={x.id}
              type="button"
              className={`pg-metric${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => setActiveMetric(x)}
            >
              <Icon size={22} aria-hidden="true" />
              {x.label}
            </button>
          );
        })}
      </div>

      {/* Current value and chart */}
      <div className="pg-card pg-hero">
        <div className="pg-kicker">{m.label}</div>
        {latest ? (
          <div className="pg-hero-top">
            <div>
              <div className="pg-hero-value" key={`${m.id}-${latest.id}`}>
                {fmt(latest.value, m)}<small>{m.unit}</small>
              </div>
              <div className="pg-hero-when">Logged {fmtShortDate(latest.date)}</div>
            </div>
            {prev && (
              <div className="pg-deltas">
                <Delta diff={latest.value - prev.value} metric={m} since={fmtShortDate(prev.date)} />
                {first && <Delta diff={latest.value - first.value} metric={m} since="the start" />}
              </div>
            )}
          </div>
        ) : (
          <div className="pg-chart-empty">
            <Heart size={28} aria-hidden="true" />
            <div>{t("Nothing logged yet. Add your first entry below.", "Nothing here yet. Drop your first number below.", "Nothing here yet, bestie. Pop your first number in below.")}</div>
          </div>
        )}
        {chartData.length === 1 && (
          <p className="pg-hint">One more entry and the trend line shows up.</p>
        )}
        {chartData.length >= 2 && (
          <div className="pg-chart" role="img" aria-label={chartLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: -4 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  tickLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  domain={[round1(Math.max(0, lo - pad)), round1(hi + pad)]}
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  tickCount={4}
                  width={44}
                />
                {baseline !== null && (
                  <ReferenceLine
                    y={baseline}
                    stroke="var(--muted)"
                    strokeDasharray="4 4"
                    label={{ value: "Start", fill: "var(--muted)", fontSize: 12, position: "insideTopLeft" }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4 }}
                  contentStyle={{
                    background: "var(--s2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "var(--text)",
                  }}
                  labelStyle={{ color: "var(--muted)", fontSize: 12 }}
                  itemStyle={{ color: "var(--text)" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _name: any, entry: any) => {
                    const note = entry?.payload?.note;
                    return [`${value} ${m.unit}${note ? ` · ${note}` : ""}`, m.label];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  dot={chartData.length > 30 ? false : { r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: "var(--accent)", stroke: "var(--s1)", strokeWidth: 3 }}
                  isAnimationActive={!reducedMotion()}
                  animationDuration={350}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Log form */}
      <div className="pg-card">
        <div className="pg-kicker" style={{ marginBottom: 10 }}>Log {m.label}</div>
        <form onSubmit={handleSubmit} className="pg-log">
          <div className="pg-value" role="group" aria-label={`${m.label} in ${m.unit}`}>
            <button
              type="button"
              className="pg-value-btn"
              onClick={() => nudge(-1)}
              disabled={hasTyped && typed <= m.min}
              aria-label={`Less: ${m.step} ${m.unit}`}
            >
              <Minus size={26} />
            </button>
            <label className="pg-value-field">
              <input
                type="number"
                inputMode="decimal"
                aria-label={`${m.label} in ${m.unit}`}
                placeholder={fmt(stepBase, m)}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                step={m.step}
                min={m.min}
                max={m.max}
              />
              <span className="pg-value-unit">{m.unit}</span>
            </label>
            <button
              type="button"
              className="pg-value-btn"
              onClick={() => nudge(1)}
              disabled={hasTyped && typed >= m.max}
              aria-label={`More: ${m.step} ${m.unit}`}
            >
              <Plus size={26} />
            </button>
          </div>

          <div>
            <label className="pg-label" htmlFor="pg-date">Day</label>
            <div className="pg-field-row">
              <input
                id="pg-date"
                className="field-input"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
              {form.date !== today() && (
                <button type="button" className="chip-btn" onClick={() => setForm(f => ({ ...f, date: today() }))}>
                  Today
                </button>
              )}
            </div>
          </div>

          <textarea
            className="field-input field-textarea"
            placeholder="Note (optional)"
            aria-label="Note (optional)"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            rows={2}
          />
          <button type="submit" className="btn-primary" disabled={!form.value}>
            <Plus size={18} aria-hidden="true" /> {hasTyped ? `Log ${form.value} ${m.unit}` : "Log entry"}
          </button>
        </form>
      </div>

      {/* History */}
      {healthMetrics.length > 0 && (
        <div className="pg-card">
          <div className="pg-kicker">Entries</div>
          <ul className="pg-entries">
            {visible.map(x => (
              <li key={x.id} className="pg-entry">
                <span className="pg-entry-date">{fmtShortDate(x.date)}</span>
                <span className="pg-entry-main">
                  <span className="pg-entry-val">{x.value} <small>{m.unit}</small></span>
                  {x.note && <span className="pg-entry-note">{x.note}</span>}
                </span>
                <button
                  type="button"
                  className="pg-entry-del"
                  onClick={() => handleDelete(x.id)}
                  aria-label={`Delete entry from ${fmtShortDate(x.date)}`}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          {reversed.length > 10 && !showAll && (
            <button type="button" className="pg-more" onClick={() => setShowAll(true)}>
              <ChevronDown size={16} aria-hidden="true" /> Show {reversed.length - 10} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
