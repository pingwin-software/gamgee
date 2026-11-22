/**
 * What's new: one entry per feature people will notice, newest first. A pull
 * request that adds something important people will see adds an entry here
 * (CLAUDE.md, "What's new"): `{ id, date }` at the top of WHATS_NEW, its words
 * in WHATS_NEW_COPY and its moving picture in WhatsNewArt.tsx.
 *
 * The sheet opens by itself once when an account has entries it has not seen
 * in this browser, dated after the day it joined: a newcomer is not handed
 * the history.
 */
export type WhatsNewId = "progression" | "quickStart" | "passkeys";

export interface WhatsNewEntry {
  /** Stable: it is what "seen" remembers. */
  id: WhatsNewId;
  /** The day it reached Gamgee, `YYYY-MM-DD`. */
  date: string;
}

export const WHATS_NEW: readonly WhatsNewEntry[] = [
  { id: "progression", date: "2026-11-22" },
  { id: "quickStart", date: "2026-11-22" },
  { id: "passkeys", date: "2026-11-22" },
];

/** Title and a few lines per entry. `**words**` show in bold. */
export const WHATS_NEW_COPY: Record<WhatsNewId, { title: string; body: string }> = {
  progression: {
    title: "Your gains, your rules",
    body:
      "You can now tell Gamgee how to push you. Under **Me, Settings, Workout** pick **Steady**, **Standard** or **Fast**, or open **Customise**: how many reps to add before the weight goes up, how big each jump is for upper and lower body, whether an easy set lets you skip ahead, and what happens when a lift is slipping. The example updates as you tap, so you can see what you are signing up for. The plates still will not lift themselves.",
  },
  quickStart: {
    title: "Less tapping, more lifting",
    body:
      "The home screen now shows **your week** and starts **today's plan** or **repeats your last workout** in one tap. Cardio moved onto the build screen, effort is picked by **tapping a bar** (the face says how it feels), and sets and reps have **plus and minus buttons**. Everything lives in five places along the bottom: **Train, Progress, Social, Plans, Me**. Settings moved in with your profile under **Me**.",
  },
  passkeys: {
    title: "Skip password day",
    body:
      "Your thumbs lift enough already. Add a **passkey** under **Me, Settings, Account** and next time tap **Use a passkey**: your fingerprint, face or screen lock does the rest, no typing. Your password still works, and too many wrong guesses at it now earn a 15 minute rest period.",
  },
};

const seenKey = (userId: number) => `gamgee_whats_new_seen_${userId}`;

export function loadSeen(userId: number): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(seenKey(userId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markSeen(userId: number, entries: readonly WhatsNewEntry[]): void {
  try {
    const ids = new Set([...loadSeen(userId), ...entries.map(e => e.id)]);
    localStorage.setItem(seenKey(userId), JSON.stringify([...ids]));
  } catch { /* private mode: it will simply show again */ }
}

/** Entries not seen yet and dated after the day the account was made
 * (`joined` is an ISO timestamp; empty or null means a long-standing account). */
export function unseen(
  entries: readonly WhatsNewEntry[],
  seen: readonly string[],
  joined: string | null | undefined,
): WhatsNewEntry[] {
  const joinedDay = (joined ?? "").slice(0, 10);
  return entries.filter(e => !seen.includes(e.id) && e.date > joinedDay);
}
