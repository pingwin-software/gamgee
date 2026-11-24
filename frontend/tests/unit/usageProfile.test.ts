import { describe, expect, it } from "vitest";
import {
  EVERYTHING, ALL_PAGES, normalizeUsageProfile, visiblePages, wizardBackStep, isEverything,
  buildsOnTheSpot, followsPlans, usesRegime, usesTemplates, suggestsWeights, logs, fixedProgressionPrefs,
  type UsageProfile,
} from "../../src/usageProfile";
import { normalizeProgressionPrefs } from "../../src/progressionPrefs";

const p = (ways: UsageProfile["ways"], more: Partial<UsageProfile> = {}): UsageProfile =>
  ({ ways, progression: "auto", fixedStepKg: 2.5, logging: ["rest", "effort", "cardio"], extras: [], ...more });

describe("usage profile", () => {
  it("cleans untrusted input", () => {
    expect(normalizeUsageProfile(null)).toBeNull();
    expect(normalizeUsageProfile({ ways: [] })).toBeNull();
    expect(normalizeUsageProfile({ ways: ["nope"] })).toBeNull();
    expect(normalizeUsageProfile({
      ways: ["spot", "regime"], extras: ["social", "juggling", "progress"],
      progression: "fixed", fixedStepKg: 5, logging: ["cardio", "naps"],
    })).toEqual({ ways: ["regime", "spot"], progression: "fixed", fixedStepKg: 5, logging: ["cardio"], extras: ["progress", "social"] });
    // Left-out answers keep the full app's behaviour.
    expect(normalizeUsageProfile({ ways: ["templates"], fixedStepKg: 7 }))
      .toEqual({ ways: ["templates"], progression: "auto", fixedStepKg: 2.5, logging: ["rest", "effort", "cardio"], extras: [] });
  });

  it("shows everything until answered, and for Everything", () => {
    const all = new Set(ALL_PAGES.filter(k => k !== "trainees"));
    expect(visiblePages(null, false)).toEqual(all);
    expect(visiblePages(EVERYTHING, false)).toEqual(all);
    expect(isEverything(EVERYTHING)).toBe(true);
    expect(isEverything(p(["spot"]))).toBe(false);
  });

  it("keeps the bare minimum for an impromptu lifter", () => {
    expect([...visiblePages(p(["spot"]), false)].sort()).toEqual(["exercises", "history", "profile", "workout"]);
  });

  it("gives regimes and templates the Plans page, the library only to hand-pickers", () => {
    const regime = visiblePages(p(["regime"]), false);
    expect(regime.has("regimes")).toBe(true);
    expect(regime.has("exercises")).toBe(false);
    const templates = visiblePages(p(["templates"]), false);
    expect(templates.has("regimes")).toBe(true);
    expect(templates.has("exercises")).toBe(true);
  });

  it("maps each extra to its pages", () => {
    expect(visiblePages(p(["spot"], { extras: ["progress"] }), false))
      .toEqual(new Set(["workout", "exercises", "history", "profile", "prs", "coach"]));
    expect(visiblePages(p(["spot"], { extras: ["body"] }), false).has("health")).toBe(true);
    const social = visiblePages(p(["spot"], { extras: ["social"] }), false);
    expect(["buddies", "chat", "notifications"].every(k => social.has(k))).toBe(true);
    // A trainer hands plans over as regimes, and talks in chat.
    const coach = visiblePages(p(["spot"], { extras: ["coach"] }), false);
    expect(["coaching", "regimes", "chat", "notifications"].every(k => coach.has(k))).toBe(true);
    expect(coach.has("buddies")).toBe(false);
  });

  it("drops Trends for someone who wants no weight suggestions", () => {
    const pages = visiblePages(p(["spot"], { extras: ["progress"], progression: "manual" }), false);
    expect(pages.has("prs")).toBe(true);
    expect(pages.has("coach")).toBe(false);
    expect(suggestsWeights(p(["spot"], { progression: "manual" }))).toBe(false);
    expect(suggestsWeights(p(["spot"], { progression: "fixed" }))).toBe(true);
  });

  it("turns a fixed jump into valid progression rules", () => {
    const prefs = fixedProgressionPrefs(1.25);
    expect(normalizeProgressionPrefs(prefs)).toEqual(prefs);
    expect(prefs).toMatchObject({ repsBeforeWeight: 0, stepUpperKg: 1.25, stepLowerKg: 1.25, easyRir: null });
  });

  it("logs only what was picked", () => {
    const prof = p(["spot"], { logging: ["cardio"] });
    expect(logs(prof, "cardio")).toBe(true);
    expect(logs(prof, "rest")).toBe(false);
    expect(logs(null, "rest")).toBe(true);
  });

  it("never hides a trainer's trainees", () => {
    expect(visiblePages(p(["spot"]), true).has("trainees")).toBe(true);
    expect(visiblePages(p(["spot"]), false).has("trainees")).toBe(false);
  });

  it("skips the steps a profile leaves out, going back too", () => {
    expect(buildsOnTheSpot(p(["regime"]))).toBe(false);
    expect(usesRegime(p(["templates"]))).toBe(false);
    expect(usesTemplates(p(["templates"]))).toBe(true);
    expect(followsPlans(p(["spot"]))).toBe(false);
    // Everyone: build -> focus -> plan screen -> start.
    expect(wizardBackStep(4, EVERYTHING)).toBe(2);
    expect(wizardBackStep(2, EVERYTHING)).toBe(1);
    expect(wizardBackStep(1, EVERYTHING)).toBe(0);
    // Impromptu only: there is no plan screen.
    expect(wizardBackStep(2, p(["spot"]))).toBe(0);
    // Templates only: there is no focus pick.
    expect(wizardBackStep(4, p(["templates"]))).toBe(1);
    // Plan and template editors go back to the plan screen.
    expect(wizardBackStep(7, null)).toBe(1);
    expect(wizardBackStep(5, null)).toBe(4);
  });
});
