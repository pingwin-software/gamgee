import { describe, expect, it } from "vitest";
import { WHATS_NEW, WHATS_NEW_COPY, unseen } from "../../src/whatsnew/whatsNew";

describe("What's new", () => {
  it("lists unique ids, newest first, with real dates", () => {
    const ids = WHATS_NEW.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of WHATS_NEW) expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = WHATS_NEW.map(e => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("has words for every entry, with no em dashes", () => {
    for (const { id } of WHATS_NEW) {
      const copy = WHATS_NEW_COPY[id];
      expect(copy.title && copy.body).toBeTruthy();
      expect(copy.title + copy.body).not.toContain("—");
    }
  });

  it("shows only what is unseen and newer than the account", () => {
    const entries = [
      { id: "passkeys", date: "2026-11-22" },
      { id: "older", date: "2026-11-10" },
    ] as unknown as typeof WHATS_NEW;
    expect(unseen(entries, [], null)).toHaveLength(2);
    expect(unseen(entries, ["passkeys"], "").map(e => e.id)).toEqual(["older"]);
    // Joined the day the newest landed: it was already there.
    expect(unseen(entries, [], "2026-11-22T09:00:00Z")).toEqual([]);
    expect(unseen(entries, [], "2026-11-15T09:00:00Z").map(e => e.id)).toEqual(["passkeys"]);
  });
});
