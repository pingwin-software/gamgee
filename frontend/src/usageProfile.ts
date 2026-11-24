import type { ProgressionPrefs } from "./progressionPrefs";

/**
 * What someone uses Gamgee for, from the first-run questionnaire
 * (components/UsageQuestionnaire.tsx). Every answer switches something off:
 * the app shows only the pages, workout steps and logging the answers ask for.
 *
 * Stored in localStorage (`gamgee_usage_profile`, with the user id) and on
 * the account (`users.usage_profile` via PATCH /auth/preferences). `null`
 * means not answered yet: the questionnaire opens, and until then everything
 * shows.
 */

/** Ways a workout gets made. Any mix, at least one:
 * - `regime`: a weekly plan, each weekday's workout set in advance;
 * - `templates`: saved workouts picked from (Push, Pull, Legs), no calendar;
 * - `spot`: built impromptu, lifts picked there and then. */
export type UsageWay = "regime" | "templates" | "spot";
/** How the next weights are found: suggested by Gamgee from history, the
 * same fixed jump for every lift, or typed by the user with no suggestions. */
export type UsageProgression = "auto" | "fixed" | "manual";
/** What a workout logs beyond weight and reps. */
export type UsageLog = "rest" | "effort" | "cardio";
export type UsageExtra = "progress" | "body" | "social" | "coach";

export interface UsageProfile {
  ways: UsageWay[];
  progression: UsageProgression;
  /** The jump, kg, every lift gets each session when `progression` is fixed. */
  fixedStepKg: number;
  /** Rest timer, effort ratings (reps left, session effort), cardio. */
  logging: UsageLog[];
  /** Everything else wanted beyond logging workouts. */
  extras: UsageExtra[];
}

export const USAGE_WAYS: readonly UsageWay[] = ["regime", "templates", "spot"];
export const USAGE_LOGS: readonly UsageLog[] = ["rest", "effort", "cardio"];
export const USAGE_EXTRAS: readonly UsageExtra[] = ["progress", "body", "social", "coach"];
export const FIXED_STEPS = [1.25, 2.5, 5] as const;

/** The whole app, as it was before the questionnaire. */
export const EVERYTHING: UsageProfile = {
  ways: [...USAGE_WAYS], progression: "auto", fixedStepKg: 2.5, logging: [...USAGE_LOGS], extras: [...USAGE_EXTRAS],
};

/** Whether a profile turns nothing off. */
export const isEverything = (p: UsageProfile) =>
  p.ways.length === USAGE_WAYS.length && p.progression === "auto" &&
  p.logging.length === USAGE_LOGS.length && p.extras.length === USAGE_EXTRAS.length;

const KEY = "gamgee_usage_profile";

/** Untrusted input (localStorage, the server) to a valid profile, or null. */
export function normalizeUsageProfile(raw: unknown): UsageProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { ways?: unknown; extras?: unknown; progression?: unknown; fixedStepKg?: unknown; logging?: unknown };
  const inList = <T extends string>(all: readonly T[], v: unknown, fallback: readonly T[]): T[] => {
    const list: unknown[] = Array.isArray(v) ? v : [...fallback];
    return all.filter(x => list.includes(x));
  };
  const ways = inList(USAGE_WAYS, r.ways, []);
  if (ways.length === 0) return null;
  return {
    ways,
    progression: r.progression === "fixed" || r.progression === "manual" ? r.progression : "auto",
    fixedStepKg: FIXED_STEPS.find(v => v === r.fixedStepKg) ?? 2.5,
    logging: inList(USAGE_LOGS, r.logging, USAGE_LOGS),
    extras: inList(USAGE_EXTRAS, r.extras, []),
  };
}

/** The last answers kept in this browser, and whose they are. */
function readLocal(): { userId: number | null; profile: UsageProfile | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { userId?: unknown; profile?: unknown } | null;
    return {
      userId: typeof raw?.userId === "number" ? raw.userId : null,
      profile: normalizeUsageProfile(raw?.profile),
    };
  } catch { return { userId: null, profile: null }; }
}

/** For the first paint, before the account is known: the last answers here. */
export function loadUsageProfile(): UsageProfile | null {
  return readLocal().profile;
}

/** This account's answers as kept in this browser (another account's don't count). */
export function loadUsageProfileFor(userId: number): UsageProfile | null {
  const local = readLocal();
  return local.userId === userId ? local.profile : null;
}

export function saveUsageProfile(userId: number | null, p: UsageProfile | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify({ userId, profile: p }));
    else localStorage.removeItem(KEY);
  } catch { /* private mode: the account copy still applies */ }
}

/* ── What the answers switch on ─────────────────────────────────────────── */

/** Impromptu workouts: the focus pick and the build screen. */
export const buildsOnTheSpot = (p: UsageProfile | null) => !p || p.ways.includes("spot");
/** The weekly regime: today's plan, the week editor, regimes. */
export const usesRegime = (p: UsageProfile | null) => !p || p.ways.includes("regime");
/** Saved workout templates. */
export const usesTemplates = (p: UsageProfile | null) => !p || p.ways.includes("templates");
/** Whether there is a plan screen (regime or templates) between start and build. */
export const followsPlans = (p: UsageProfile | null) => usesRegime(p) || usesTemplates(p);
/** Whether Gamgee suggests next weights (history ramp, coach hints, Apply, Progress, effort setup). */
export const suggestsWeights = (p: UsageProfile | null) => !p || p.progression !== "manual";
/** Whether a workout logs this extra (rest timer, effort, cardio). */
export const logs = (p: UsageProfile | null, what: UsageLog) => !p || p.logging.includes(what);

/** Progression prefs for "the same jump on every lift, every session". */
export function fixedProgressionPrefs(stepKg: number): ProgressionPrefs {
  return { repsBeforeWeight: 0, stepUpperKg: stepKg, stepLowerKg: stepKg, easyRir: null, onSlip: "hold" };
}

/** Every page key, in the order AppHeader lists them. */
export const ALL_PAGES = [
  "workout", "exercises", "history", "prs", "coach", "health",
  "buddies", "chat", "notifications", "regimes", "coaching", "trainees", "profile",
] as const;

/**
 * The pages to show. Workout, History and Me are always there. Trainees
 * follows the trainer flag, not the answers, so a trainer never loses their
 * clients.
 */
export function visiblePages(p: UsageProfile | null, isTrainer: boolean): Set<string> {
  if (!p) {
    return new Set(ALL_PAGES.filter(k => k !== "trainees" || isTrainer));
  }
  const has = (e: UsageExtra) => p.extras.includes(e);
  const pages = new Set<string>(["workout", "history", "profile"]);
  // The exercise library (and custom exercises) serves picking lifts by
  // hand: impromptu workouts and templates. A regime is filled in its editor.
  if (buildsOnTheSpot(p) || usesTemplates(p)) pages.add("exercises");
  // Plans holds regimes and templates; a trainer hands plans over as
  // regimes, so coaching brings it along too.
  if (usesRegime(p) || usesTemplates(p) || has("coach")) pages.add("regimes");
  // Trends draws each lift's next target: no use to someone who wants no suggestions.
  if (has("progress")) { pages.add("prs"); if (p.progression !== "manual") pages.add("coach"); }
  if (has("body")) pages.add("health");
  if (has("social")) pages.add("buddies");
  // Chat and alerts carry both buddy and trainer traffic.
  if (has("social") || has("coach")) { pages.add("chat"); pages.add("notifications"); }
  if (has("coach")) pages.add("coaching");
  if (isTrainer) pages.add("trainees");
  return pages;
}

/**
 * Where Back goes from a builder step. Step 3 (cardio) is gone, so Build
 * goes to Focus; with no impromptu workouts it goes to the plan screen (a
 * template or today's plan brought them there), and with no plan screen
 * Focus goes back to the start.
 */
export function wizardBackStep(step: number, p: UsageProfile | null): number {
  if (step === 6 || step === 7) return 1;
  if (step === 4) return buildsOnTheSpot(p) ? 2 : 1;
  if (step === 2) return followsPlans(p) ? 1 : 0;
  return Math.max(0, step - 1);
}
