import { describe, expect, it } from "vitest";
import {
  EVERYTHING, ALL_PAGES, normalizeUsageProfile, visiblePages, wizardBackStep,
  buildsOnTheSpot, followsPlans, type UsageProfile,
} from "../../src/usageProfile";

const p = (style: UsageProfile["style"], extras: UsageProfile["extras"] = []): UsageProfile => ({ style, extras });

describe("usage profile", () => {
  it("cleans untrusted input", () => {
    expect(normalizeUsageProfile(null)).toBeNull();
    expect(normalizeUsageProfile({ style: "nope" })).toBeNull();
    expect(normalizeUsageProfile({ style: "spot", extras: ["social", "juggling", "progress"] }))
      .toEqual({ style: "spot", extras: ["progress", "social"] });
    expect(normalizeUsageProfile({ style: "plan" })).toEqual({ style: "plan", extras: [] });
  });

  it("shows everything until answered, and for Everything", () => {
    const all = new Set(ALL_PAGES.filter(k => k !== "trainees"));
    expect(visiblePages(null, false)).toEqual(all);
    expect(visiblePages(EVERYTHING, false)).toEqual(all);
  });

  it("keeps the bare minimum for an on-the-spot lifter", () => {
    expect([...visiblePages(p("spot"), false)].sort()).toEqual(["exercises", "history", "profile", "workout"]);
  });

  it("shows a plan follower their regimes, not the exercise library", () => {
    const pages = visiblePages(p("plan"), false);
    expect(pages.has("regimes")).toBe(true);
    expect(pages.has("exercises")).toBe(false);
  });

  it("maps each extra to its pages", () => {
    expect(visiblePages(p("spot", ["progress"]), false)).toEqual(new Set(["workout", "exercises", "history", "profile", "prs", "coach"]));
    expect(visiblePages(p("spot", ["body"]), false).has("health")).toBe(true);
    const social = visiblePages(p("spot", ["social"]), false);
    expect(["buddies", "chat", "notifications"].every(k => social.has(k))).toBe(true);
    // A trainer hands plans over as regimes, and talks in chat.
    const coach = visiblePages(p("spot", ["coach"]), false);
    expect(["coaching", "regimes", "chat", "notifications"].every(k => coach.has(k))).toBe(true);
    expect(coach.has("buddies")).toBe(false);
  });

  it("never hides a trainer's trainees", () => {
    expect(visiblePages(p("spot"), true).has("trainees")).toBe(true);
    expect(visiblePages(p("spot"), false).has("trainees")).toBe(false);
  });

  it("skips the steps a profile leaves out, going back too", () => {
    expect(buildsOnTheSpot(p("plan"))).toBe(false);
    expect(followsPlans(p("spot"))).toBe(false);
    // Everyone: build -> focus -> plan screen -> start.
    expect(wizardBackStep(4, EVERYTHING)).toBe(2);
    expect(wizardBackStep(2, EVERYTHING)).toBe(1);
    expect(wizardBackStep(1, EVERYTHING)).toBe(0);
    // On the spot: there is no plan screen.
    expect(wizardBackStep(2, p("spot"))).toBe(0);
    // Plan only: there is no focus pick.
    expect(wizardBackStep(4, p("plan"))).toBe(1);
    // Plan and template editors go back to the plan screen.
    expect(wizardBackStep(7, null)).toBe(1);
    expect(wizardBackStep(5, null)).toBe(4);
  });
});
