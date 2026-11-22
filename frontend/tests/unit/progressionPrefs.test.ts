import { describe, expect, it } from "vitest";
import { analyzeEx } from "../../src/analysis";
import {
  DEFAULT_PROGRESSION_PREFS, PROGRESSION_PRESETS, normalizeProgressionPrefs, presetOf,
  type ProgressionPrefs,
} from "../../src/progressionPrefs";
import type { WorkoutSession } from "../../src/types";

/** Newest-first history of bench sessions, each one top set. */
function bench(...sets: Array<[weight: number, reps: number, rpe?: number]>): WorkoutSession[] {
  return sets.map(([w, r, rpe], i) => ({
    id: `s${i}`, date: `2026-11-${String(20 - i).padStart(2, "0")}`, duration: 0, focus: "push",
    exercises: [{ id: "bench", name: "Bench", type: "strength", uid: "u", sets: [{ weight: String(w), reps: String(r), done: true, rpe: rpe ?? null }] }],
  })) as unknown as WorkoutSession[];
}
const with_ = (p: Partial<ProgressionPrefs>): ProgressionPrefs => ({ ...DEFAULT_PROGRESSION_PREFS, ...p });

describe("progression preferences", () => {
  it("by default adds a rep inside the range and keeps the weight", () => {
    const a = analyzeEx("bench", bench([60, 9], [60, 8]), null, DEFAULT_PROGRESSION_PREFS)!;
    expect([a.nextWeight, a.nextReps]).toEqual([60, 10]);
  });

  it("adds weight every session when no reps are asked for first", () => {
    const a = analyzeEx("bench", bench([60, 8], [60, 8]), null, with_({ repsBeforeWeight: 0 }))!;
    expect([a.nextWeight, a.nextReps]).toEqual([62.5, 8]);
  });

  it("waits for more reps when the range is widened", () => {
    const prefs = with_({ repsBeforeWeight: 5 });
    expect(analyzeEx("bench", bench([60, 11], [60, 8]), null, prefs)!.nextWeight).toBe(60);
    expect(analyzeEx("bench", bench([60, 13], [60, 8]), null, prefs)!.nextWeight).toBe(62.5);
  });

  it("uses the chosen weight jump", () => {
    const a = analyzeEx("bench", bench([60, 11], [60, 8]), null, with_({ stepUpperKg: 1.25 }))!;
    expect(a.nextWeight).toBe(61.25);
  });

  it("skips ahead on an easy set only when allowed", () => {
    const easy = bench([60, 9, 6], [60, 8, 6]); // RPE 6 = 4 reps in reserve
    expect(analyzeEx("bench", easy, null, with_({ easyRir: 3 }))!.nextWeight).toBe(62.5);
    expect(analyzeEx("bench", easy, null, with_({ easyRir: null }))!.nextWeight).toBe(60);
  });

  it("follows the choice for a slipping lift", () => {
    const slipping = bench([100, 5], [100, 6], [100, 7], [100, 8]);
    expect(analyzeEx("bench", slipping, null, with_({ onSlip: "step" }))!.nextWeight).toBe(97.5);
    expect(analyzeEx("bench", slipping, null, with_({ onSlip: "percent" }))!.nextWeight).toBe(90);
    expect(analyzeEx("bench", slipping, null, with_({ onSlip: "hold" }))!.nextWeight).toBe(100);
  });

  it("names its presets and cleans stored values", () => {
    expect(presetOf(PROGRESSION_PRESETS.standard)).toBe("standard");
    expect(presetOf(PROGRESSION_PRESETS.fast)).toBe("fast");
    expect(presetOf(with_({ stepUpperKg: 10 }))).toBeNull();
    expect(normalizeProgressionPrefs(null)).toEqual(DEFAULT_PROGRESSION_PREFS);
    expect(normalizeProgressionPrefs({ repsBeforeWeight: 99, stepUpperKg: -1, onSlip: "x", easyRir: null }))
      .toEqual({ ...DEFAULT_PROGRESSION_PREFS, easyRir: null });
  });
});
