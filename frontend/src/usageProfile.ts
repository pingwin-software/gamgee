/**
 * What someone uses Gamgee for, from the first-run questionnaire
 * (components/UsageQuestionnaire.tsx). The app shows only the pages and
 * workout steps that serve those answers.
 *
 * Stored in localStorage (`gamgee_usage_profile`) and on the account
 * (`users.usage_profile` via PATCH /auth/preferences). `null` means not
 * answered yet: the questionnaire opens, and until then everything shows.
 */
export type UsageStyle = "spot" | "plan" | "both";
export type UsageExtra = "progress" | "body" | "social" | "coach";

export interface UsageProfile {
  /** How workouts are made: on the spot, from a plan (regime), or both. */
  style: UsageStyle;
  /** Everything else they want, beyond logging workouts. */
  extras: UsageExtra[];
}

export const USAGE_EXTRAS: readonly UsageExtra[] = ["progress", "body", "social", "coach"];

/** The whole app, as it was before the questionnaire. */
export const EVERYTHING: UsageProfile = { style: "both", extras: [...USAGE_EXTRAS] };

const KEY = "gamgee_usage_profile";

/** Untrusted input (localStorage, the server) to a valid profile, or null. */
export function normalizeUsageProfile(raw: unknown): UsageProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { style?: unknown; extras?: unknown };
  if (r.style !== "spot" && r.style !== "plan" && r.style !== "both") return null;
  const extras = Array.isArray(r.extras) ? r.extras : [];
  return { style: r.style, extras: USAGE_EXTRAS.filter(e => extras.includes(e)) };
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
  // Building on the spot needs the exercise library; a plan user picks
  // exercises inside the plan editor instead.
  if (p.style !== "plan") pages.add("exercises");
  // A trainer hands plans over as regimes, so coaching brings Regimes along.
  if (p.style !== "spot" || has("coach")) pages.add("regimes");
  if (has("progress")) { pages.add("prs"); pages.add("coach"); }
  if (has("body")) pages.add("health");
  if (has("social")) pages.add("buddies");
  // Chat and alerts carry both buddy and trainer traffic.
  if (has("social") || has("coach")) { pages.add("chat"); pages.add("notifications"); }
  if (has("coach")) pages.add("coaching");
  if (isTrainer) pages.add("trainees");
  return pages;
}

/** Whether the workout builder offers one-off workouts (focus, build). */
export const buildsOnTheSpot = (p: UsageProfile | null) => !p || p.style !== "plan";
/** Whether the workout builder offers the weekly plan, regimes and templates. */
export const followsPlans = (p: UsageProfile | null) => !p || p.style !== "spot";

/**
 * Where Back goes from a builder step. Step 3 (cardio) is gone, so Build
 * goes to Focus; with no one-off workouts it goes to the plan screen (a
 * template or today's plan brought them there), and with no plan screen
 * Focus goes back to the start.
 */
export function wizardBackStep(step: number, p: UsageProfile | null): number {
  if (step === 6 || step === 7) return 1;
  if (step === 4) return buildsOnTheSpot(p) ? 2 : 1;
  if (step === 2) return followsPlans(p) ? 1 : 0;
  return Math.max(0, step - 1);
}
