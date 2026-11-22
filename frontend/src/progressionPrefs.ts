/**
 * How the suggested progression behaves, chosen by the user in Settings.
 *
 * The analyzer (analysis.ts) reads the current prefs from this module rather
 * than taking them as an argument, so every caller (active workout, coach
 * tab, ramped pre-fill) follows the same rules without threading a prop.
 * WorkoutTracker owns the state and calls setProgressionPrefs during render.
 */
export type SlipAction = "step" | "percent" | "hold";

export interface ProgressionPrefs {
  /** Reps to add at a weight before the weight goes up. `null` = automatic
   * (2 for low-rep work, 3 otherwise); 0 = add weight every session. */
  repsBeforeWeight: number | null;
  /** Weight jump for upper-body lifts, kg. */
  stepUpperKg: number;
  /** Weight jump for lower-body lifts, kg. */
  stepLowerKg: number;
  /** Add weight early when the top set left this many reps in reserve.
   * `null` = never skip ahead. */
  easyRir: number | null;
  /** What to suggest when a lift is slipping at the bottom of its range. */
  onSlip: SlipAction;
}

export const DEFAULT_PROGRESSION_PREFS: ProgressionPrefs = {
  repsBeforeWeight: null,
  stepUpperKg: 2.5,
  stepLowerKg: 5,
  easyRir: 3,
  onSlip: "step",
};

export type ProgressionPreset = "steady" | "standard" | "fast";

export const PROGRESSION_PRESETS: Record<ProgressionPreset, ProgressionPrefs> = {
  // Earn every plate: more reps first, smaller jumps, never skip ahead.
  steady:   { repsBeforeWeight: 4, stepUpperKg: 1.25, stepLowerKg: 2.5, easyRir: null, onSlip: "hold" },
  standard: DEFAULT_PROGRESSION_PREFS,
  // Weight goes up fast: one extra rep, then a plate; easy sets jump at once.
  fast:     { repsBeforeWeight: 1, stepUpperKg: 2.5, stepLowerKg: 5, easyRir: 2, onSlip: "step" },
};

export const STEP_CHOICES = [1, 1.25, 2.5, 5, 10] as const;

const same = (a: ProgressionPrefs, b: ProgressionPrefs) =>
  a.repsBeforeWeight === b.repsBeforeWeight && a.stepUpperKg === b.stepUpperKg &&
  a.stepLowerKg === b.stepLowerKg && a.easyRir === b.easyRir && a.onSlip === b.onSlip;

/** The preset these prefs match, or null when the user has tuned them by hand. */
export function presetOf(prefs: ProgressionPrefs): ProgressionPreset | null {
  return (Object.keys(PROGRESSION_PRESETS) as ProgressionPreset[])
    .find(k => same(PROGRESSION_PRESETS[k], prefs)) ?? null;
}

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

/** Untrusted input (localStorage, the server) to valid prefs. */
export function normalizeProgressionPrefs(raw: unknown): ProgressionPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PROGRESSION_PREFS;
  const reps = r.repsBeforeWeight === null ? null : num(r.repsBeforeWeight, 0, 10);
  const easy = r.easyRir === null ? null : num(r.easyRir, 1, 6);
  return {
    repsBeforeWeight: reps === undefined ? d.repsBeforeWeight : reps === null ? null : Math.round(reps),
    stepUpperKg: num(r.stepUpperKg, 0.25, 20) ?? d.stepUpperKg,
    stepLowerKg: num(r.stepLowerKg, 0.25, 20) ?? d.stepLowerKg,
    easyRir: easy === undefined ? d.easyRir : easy === null ? null : Math.round(easy),
    onSlip: r.onSlip === "percent" || r.onSlip === "hold" || r.onSlip === "step" ? r.onSlip : d.onSlip,
  };
}

const KEY = "gamgee_progression_prefs";

export function loadProgressionPrefs(): ProgressionPrefs {
  try {
    return normalizeProgressionPrefs(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return DEFAULT_PROGRESSION_PREFS;
  }
}

export function saveProgressionPrefs(prefs: ProgressionPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}

let current: ProgressionPrefs = DEFAULT_PROGRESSION_PREFS;

export function getProgressionPrefs(): ProgressionPrefs { return current; }
export function setProgressionPrefs(prefs: ProgressionPrefs): void { current = prefs; }
