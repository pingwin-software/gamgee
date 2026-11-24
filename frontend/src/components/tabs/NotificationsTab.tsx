import { useEffect, useMemo, useState } from "react";
import {
  Bell, BellOff, Check, Trash2, Trophy, Zap, Send, UserPlus, Users, Dumbbell,
  CheckCheck, MessageSquare, GraduationCap, Calendar,
} from "lucide-react";
import type { AppNotification, NotificationKind } from "../../types";
import { useTxt } from "../../context/ToneContext";
import "../../simple.css";
import "../../pages/social.css";

interface Props {
  notifications:  AppNotification[];
  unreadCount:    number;
  onMarkRead:     (id: number) => Promise<void>;
  onMarkAll:      () => Promise<void>;
  onDelete:       (id: number) => Promise<void>;
  onGoToBuddies:  () => void;
  onGoToChat:     (conversationId?: number) => void;
  refresh:        () => Promise<void>;
  authFetch:      (url: string, opts?: RequestInit) => Promise<Response>;
}

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  buddy_request:  UserPlus,
  buddy_accepted: Users,
  workout_done:   Dumbbell,
  pr_set:         Trophy,
  motivate:       Send,
  live_started:   Zap,
  live_joined:    Users,
  live_ended:     Zap,
  chat_message:   MessageSquare,
  trainer_link_request:  GraduationCap,
  trainer_link_accepted: GraduationCap,
  regime_assigned: Calendar,
};

const KIND_LABEL: Record<NotificationKind, string> = {
  buddy_request:  "Buddy request",
  buddy_accepted: "Buddy accepted",
  workout_done:   "Workout done",
  pr_set:         "New PR",
  motivate:       "Motivation",
  live_started:   "Live workout",
  live_joined:    "Joined live",
  live_ended:     "Live ended",
  chat_message:   "New message",
  trainer_link_request:  "Coaching request",
  trainer_link_accepted: "Coaching accepted",
  regime_assigned: "Plan assigned",
};

/** The colour of each kind's round icon (a class in social.css). The icon's
    shape and the label under the text say the same thing, so colour is never
    the only signal. */
const KIND_TONE: Record<NotificationKind, string> = {
  buddy_request:  "",
  buddy_accepted: "so-k-green",
  workout_done:   "so-k-green",
  pr_set:         "so-k-gold",
  motivate:       "so-k-red",
  live_started:   "so-k-red",
  live_joined:    "",
  live_ended:     "so-k-muted",
  chat_message:   "",
  trainer_link_request:  "",
  trainer_link_accepted: "so-k-green",
  regime_assigned: "so-k-gold",
};

type Filter = "all" | "unread";
const KINDS: NotificationKind[] = [
  "workout_done", "pr_set", "motivate",
  "buddy_request", "buddy_accepted",
  "live_started", "live_joined", "live_ended",
  "chat_message", "trainer_link_request", "trainer_link_accepted", "regime_assigned",
];

export default function NotificationsTab({
  notifications, unreadCount,
  onMarkRead, onMarkAll, onDelete, onGoToBuddies, onGoToChat, refresh, authFetch,
}: Props) {
  const t = useTxt();
  const [filter, setFilter]   = useState<Filter>("all");
  const [kindSel, setKindSel] = useState<NotificationKind | "all">("all");
  // Full history — bell only loads the latest 30; the history page asks for more.
  const [history, setHistory] = useState<AppNotification[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch("/api/notifications?limit=200")
      .then(r => r.ok ? r.json() : [])
      .then((data: AppNotification[]) => {
        if (!cancelled) setHistory(data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    refresh();
    return () => { cancelled = true; };
  }, [authFetch, refresh]);

  // Always prefer the freshest data from props for items we already have
  // (so optimistic mark-read updates propagate without a re-fetch).
  const merged = useMemo(() => {
    const propsById = new Map(notifications.map(n => [n.id, n]));
    const base = history ?? notifications;
    return base.map(n => propsById.get(n.id) ?? n);
  }, [history, notifications]);

  // Mirror parent mutations into local `history` so older items (beyond the
  // latest-30 the parent tracks) reflect deletes / read-status changes
  // without requiring a remount + re-fetch.
  const handleDelete = async (id: number) => {
    setHistory(h => h ? h.filter(n => n.id !== id) : h);
    await onDelete(id);
  };
  const handleMarkRead = async (id: number) => {
    setHistory(h => h ? h.map(n => n.id === id ? { ...n, read: true } : n) : h);
    await onMarkRead(id);
  };
  const handleMarkAll = async () => {
    setHistory(h => h ? h.map(n => ({ ...n, read: true })) : h);
    await onMarkAll();
  };

  const filtered = useMemo(() => {
    return merged
      .filter(n => filter === "all" ? true : !n.read)
      .filter(n => kindSel === "all" ? true : n.kind === kindSel);
  }, [merged, filter, kindSel]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const handleClick = async (n: AppNotification) => {
    if (!n.read) await handleMarkRead(n.id);
    if (n.kind === "chat_message") {
      onGoToChat(readConvId(n.payload));
      return;
    }
    if ([
      "buddy_request", "buddy_accepted", "motivate",
      "live_started", "live_joined", "workout_done", "pr_set", "live_ended",
    ].includes(n.kind)) {
      onGoToBuddies();
    }
  };

  const unreadInList = merged.filter(n => !n.read).length;
  const kindCounts = KINDS
    .map(k => ({ kind: k, count: merged.filter(n => n.kind === k).length }))
    .filter(k => k.count > 0);

  return (
    <div className="tab-anim so-root">
      {unreadCount > 0 && (
        <div className="so-head">
          <button type="button" className="so-act so-act-main so-act-fit" onClick={() => handleMarkAll()}>
            <CheckCheck size={18} aria-hidden="true" /> Mark all read
          </button>
        </div>
      )}

      <div className="seg so-seg" role="group" aria-label="Show">
        <button
          type="button"
          className={`seg-btn${filter === "all" ? " on" : ""}`}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All ({merged.length})
        </button>
        <button
          type="button"
          className={`seg-btn${filter === "unread" ? " on" : ""}`}
          aria-pressed={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadInList})
        </button>
      </div>

      {kindCounts.length > 1 && (
        <div className="so-chips" role="group" aria-label="Kind of alert">
          <button
            type="button"
            className={`so-chip${kindSel === "all" ? " on" : ""}`}
            aria-pressed={kindSel === "all"}
            onClick={() => setKindSel("all")}
          >
            {kindSel === "all" && <Check size={15} aria-hidden="true" />} Any kind
          </button>
          {kindCounts.map(({ kind, count }) => {
            const Icon = KIND_ICON[kind];
            return (
              <button
                key={kind}
                type="button"
                className={`so-chip${kindSel === kind ? " on" : ""}`}
                aria-pressed={kindSel === kind}
                onClick={() => setKindSel(kind)}
              >
                <Icon size={15} aria-hidden="true" /> {KIND_LABEL[kind]}
                <span className="so-chip-n">{count}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* One kind only, and it is the one picked: the chips are hidden, so
          the way back to every kind stays on screen. */}
      {kindCounts.length <= 1 && kindSel !== "all" && (
        <div className="so-chips">
          <button type="button" className="so-chip" onClick={() => setKindSel("all")}>Show every kind</button>
        </div>
      )}

      {loading && history === null && (
        <div className="so-empty"><div className="so-empty-text">Loading…</div></div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="so-empty">
          <div className="so-empty-icon">
            {filter === "unread" ? <CheckCheck size={32} /> : <BellOff size={32} />}
          </div>
          <div className="so-empty-text">
            {filter === "unread"
              ? t("No unread alerts.", "All caught up.", "All caught up, bestie.")
              : kindSel !== "all"
                ? "No alerts of this kind."
                : t("No alerts yet. When your buddies lift, you will see it here.",
                    "Nothing yet. Get some buddies lifting.",
                    "Nothing yet. Recruit some besties.")}
          </div>
        </div>
      )}

      {groups.map(({ label, items }) => (
        <section key={label} className="so-list" aria-label={label}>
          <div className="so-title">{label}</div>
          <ul className="so-list">
            {items.map(n => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <li key={n.id} className={`so-alert${n.read ? "" : " unread"}`}>
                  <button type="button" className="so-alert-main" onClick={() => handleClick(n)}>
                    <span className={`so-ico ${KIND_TONE[n.kind] ?? ""}`}>
                      <Icon size={20} aria-hidden="true" />
                      {!n.read && <span className="so-dot" role="img" aria-label="Unread" />}
                    </span>
                    <span className="so-alert-body">
                      <span className="so-alert-msg">{n.message}</span>
                      <span className="so-alert-meta" title={fmtAbsolute(n.created_at)}>
                        {KIND_LABEL[n.kind] ?? n.kind} · {fmtRelative(n.created_at)}
                      </span>
                    </span>
                  </button>
                  <span className="so-alert-acts">
                    {!n.read && (
                      <button
                        type="button"
                        className="so-alert-act"
                        onClick={() => handleMarkRead(n.id)}
                        aria-label="Mark read"
                        title="Mark read"
                      >
                        <Check size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="so-alert-act del"
                      onClick={() => handleDelete(n.id)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function readConvId(payload: unknown): number | undefined {
  if (payload && typeof payload === "object" && "conversation_id" in payload) {
    const v = (payload as { conversation_id?: unknown }).conversation_id;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function groupByDay(items: AppNotification[]): Array<{ label: string; items: AppNotification[] }> {
  if (items.length === 0) return [];
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;

  const buckets: Record<string, AppNotification[]> = {
    "Today": [], "Yesterday": [], "Earlier": [],
  };

  for (const n of items) {
    const ts = n.created_at;
    if (ts >= today)          buckets["Today"].push(n);
    else if (ts >= yesterday) buckets["Yesterday"].push(n);
    else                      buckets["Earlier"].push(n);
  }

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

/** "5 min ago" for the last day, the date and time after that. */
function fmtRelative(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return fmtAbsolute(ms);
}

function fmtAbsolute(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString([], sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
  return `${date} · ${time}`;
}
