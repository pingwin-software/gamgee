import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import {
  Users, UserPlus, Search, Check, X as XIcon, Trash2, Send,
  Trophy, Flame, Zap, Play, LogOut, Crown, Medal, ChevronDown,
  Dumbbell, Radio, Clock,
  MessageCircle,
} from "../../icons";
import type {
  Buddy, UserSearchResult, ScoreboardRow, MotivatePreset, LiveSession,
} from "../../types";
import { useTxt } from "../../context/ToneContext";
import PublicProfileModal from "../PublicProfileModal";
import "../../simple.css";
import "../../pages/social.css";

type Sub = "scoreboard" | "buddies" | "live" | "find";
type Period = "week" | "month";

interface Props {
  authFetch:        (url: string, opts?: RequestInit) => Promise<Response>;
  buddies:          Buddy[];
  liveSessions:     LiveSession[];
  myLiveSession:    LiveSession | null;
  workoutActive:    boolean;
  workoutFocus:     string | null;
  workoutDoneSets:  number;
  refreshBuddies:   () => Promise<void>;
  refreshLive:      () => Promise<void>;
  startLiveSession: (note: string) => Promise<void>;
  endLiveSession:   () => Promise<void>;
  joinLiveSession:  (id: string) => Promise<void>;
  /** Open (or start) the chat with a buddy, by username. */
  onOpenChat:       (username: string) => void;
}

/** Initials in a ring of the person's own colour. */
function Avatar({ name, color, size = "md" }: {
  name: string; color: string | null | undefined; size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span
      className={`so-av so-av-${size}`}
      style={{ "--c": color ?? "var(--primary)" } as CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function BuddiesTab({
  authFetch, buddies, liveSessions, myLiveSession,
  workoutActive, workoutFocus, workoutDoneSets,
  refreshBuddies, refreshLive,
  startLiveSession, endLiveSession, joinLiveSession, onOpenChat,
}: Props) {
  const t = useTxt();
  const [sub, setSub] = useState<Sub>("scoreboard");
  const [scoreboard, setScoreboard] = useState<ScoreboardRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const openProfile = useCallback((userId: number) => setProfileUserId(userId), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const loadScoreboard = useCallback(async () => {
    try {
      const r = await authFetch("/api/buddies/scoreboard");
      if (r.ok) setScoreboard(await r.json());
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    if (sub === "scoreboard") loadScoreboard();
  }, [sub, loadScoreboard]);

  // ── Subnav ──
  const tabs: Array<{ key: Sub; label: string; Icon: typeof Trophy; badge: number | null }> = [
    { key: "scoreboard", label: t("Scoreboard", "Leaderboard", "Leaderboard"), Icon: Trophy, badge: null },
    { key: "buddies",    label: t("Buddies", "The Crew", "The Bestie List"),   Icon: Users,  badge: buddies.length || null },
    { key: "live",       label: t("Live", "Live Squad", "Live Squad"),         Icon: Zap,    badge: liveSessions.length || null },
    { key: "find",       label: t("Find", "Recruit", "Add"),                   Icon: Search, badge: null },
  ];

  const incoming = buddies.filter(b => b.status === "pending_in");
  // What the scoreboard already knows about each person (last workout,
  // streak), for the buddy cards.
  const statsById = useMemo(() => new Map(scoreboard.map(r => [r.user_id, r])), [scoreboard]);

  return (
    <div className="tab-anim so-root">
      {toast && <div className="health-toast" role="status">{toast}</div>}

      <div className="so-nav" role="group" aria-label="Buddies pages">
        {tabs.map(({ key, label, Icon, badge }) => (
          <button
            key={key}
            type="button"
            className={`so-nav-btn${sub === key ? " on" : ""}${key === "live" && badge ? " live" : ""}`}
            aria-pressed={sub === key}
            onClick={() => setSub(key)}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="so-nav-label">{label}</span>
            {badge !== null && <span className="so-nav-count">{badge}</span>}
          </button>
        ))}
      </div>

      {incoming.length > 0 && sub !== "find" && (
        <IncomingRequests
          incoming={incoming}
          authFetch={authFetch}
          refresh={refreshBuddies}
          onToast={showToast}
        />
      )}

      {sub === "scoreboard" && (
        <ScoreboardView rows={scoreboard} loading={loading} onOpenProfile={openProfile} />
      )}

      {sub === "buddies" && (
        <BuddiesList
          buddies={buddies}
          statsById={statsById}
          authFetch={authFetch}
          refresh={refreshBuddies}
          onToast={showToast}
          onLoading={setLoading}
          onOpenProfile={openProfile}
          onOpenChat={onOpenChat}
          onFind={() => setSub("find")}
        />
      )}

      {sub === "live" && (
        <LiveView
          sessions={liveSessions}
          mine={myLiveSession}
          workoutActive={workoutActive}
          workoutFocus={workoutFocus}
          workoutDoneSets={workoutDoneSets}
          refreshLive={refreshLive}
          startLiveSession={startLiveSession}
          endLiveSession={endLiveSession}
          joinLiveSession={joinLiveSession}
          onToast={showToast}
          onOpenProfile={openProfile}
        />
      )}

      {sub === "find" && (
        <FindBuddies
          authFetch={authFetch}
          refresh={refreshBuddies}
          onToast={showToast}
          onOpenProfile={openProfile}
        />
      )}

      {profileUserId !== null && (
        <PublicProfileModal
          userId={profileUserId}
          authFetch={authFetch}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}

// ─── Scoreboard ────────────────────────────────────────────────────────────

function ScoreboardView({ rows, loading, onOpenProfile }: {
  rows: ScoreboardRow[]; loading: boolean;
  onOpenProfile: (userId: number) => void;
}) {
  const t = useTxt();
  const [period, setPeriod] = useState<Period>("week");
  const count = useCallback(
    (r: ScoreboardRow) => period === "week" ? r.workouts_week : r.workouts_month,
    [period],
  );
  // The server sorts by the week; the month needs its own order. The sort is
  // stable, so ties keep the server's order.
  const ranked = useMemo(() => [...rows].sort((a, b) => count(b) - count(a)), [rows, count]);

  if (loading) {
    return <div className="so-empty"><div className="so-empty-text">Loading…</div></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="so-empty">
        <div className="so-empty-icon"><Trophy size={32} /></div>
        <div className="so-empty-text">{t("No data yet. Log a workout to appear here.", "Log a session to climb the leaderboard.", "Log a session, bestie. The leaderboard misses you.")}</div>
      </div>
    );
  }
  const max = Math.max(...ranked.map(count), 1);
  const podium = ranked.length >= 2 ? ranked.slice(0, 3) : [];
  const unit = period === "week" ? "this week" : "this month";
  return (
    <>
      <div className="seg so-seg" role="group" aria-label="Period">
        <button type="button" className={`seg-btn${period === "week" ? " on" : ""}`} aria-pressed={period === "week"} onClick={() => setPeriod("week")}>
          Last 7 days
        </button>
        <button type="button" className={`seg-btn${period === "month" ? " on" : ""}`} aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
          Last 30 days
        </button>
      </div>

      {period === "week" && (
        <p className="so-intro">{t(
          "You and your buddies, ranked by workouts in the last 7 days.",
          "Last 7 days. Lift more or get clowned.",
          "Last 7 days, bestie. Show up or get out-glowed."
        )}</p>
      )}
      {period === "month" && (
        <p className="so-intro">{t(
          "You and your buddies, ranked by workouts in the last 30 days.",
          "Last 30 days. The long game counts.",
          "Last 30 days, bestie. Consistency is the glow-up."
        )}</p>
      )}

      {podium.length > 0 && (
        <div className="so-podium" key={period}>
          {podium.map((r, i) => {
            const name = r.name ?? r.username;
            return (
              <button
                key={r.user_id}
                type="button"
                className={`so-pod so-m${i + 1}${r.is_self ? " self" : ""}`}
                onClick={() => onOpenProfile(r.user_id)}
                aria-label={`Place ${i + 1}: ${name}${r.is_self ? " (you)" : ""}, ${count(r)} workouts. View profile`}
              >
                <span className="so-pod-medal">
                  {i === 0 ? <Crown size={26} /> : <Medal size={22} />}
                </span>
                <Avatar name={name} color={r.primary_color} size={i === 0 ? "xl" : "lg"} />
                <span className="so-pod-name">{r.is_self ? "You" : name}</span>
                <span className="so-pod-block">
                  <span className="so-pod-val">{count(r)}</span>
                  <span className="so-pod-unit">{count(r) === 1 ? "workout" : "workouts"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="so-list" key={`list-${period}`}>
        {ranked.map((r, i) => {
          const name = r.name ?? r.username;
          const pct = Math.round((count(r) / max) * 100);
          return (
            <button
              key={r.user_id}
              type="button"
              className={`so-rank${r.is_self ? " self" : ""}`}
              style={{ "--c": r.primary_color ?? "var(--primary)" } as CSSProperties}
              onClick={() => onOpenProfile(r.user_id)}
              aria-label={`Place ${i + 1}: ${name}${r.is_self ? " (you)" : ""}, ${count(r)} workouts ${unit}. View profile`}
            >
              <span className={`so-rank-pos${i < 3 ? ` so-m${i + 1}` : ""}`}>{i + 1}</span>
              <Avatar name={name} color={r.primary_color} />
              <span className="so-rank-main">
                <span className="so-name">
                  <span className="so-name-text">{name}</span>
                  {r.is_self && <span className="so-tag so-tag-you">You</span>}
                  {r.current_streak > 0 && (
                    <span className="so-tag so-tag-fire"><Flame size={12} />{r.current_streak}</span>
                  )}
                </span>
                <span className="so-bar"><span className="so-bar-fill" style={{ width: `${pct}%` }} /></span>
                <span className="so-rank-meta">
                  {period === "week"
                    ? <span><Dumbbell size={13} />{fmtVol(r.volume_week)} lifted</span>
                    : <span><Dumbbell size={13} />{r.workouts_total} in total</span>}
                  <span><Trophy size={13} />{r.pr_count} {r.pr_count === 1 ? "PR" : "PRs"}</span>
                </span>
              </span>
              <span className="so-rank-val">
                <b>{count(r)}</b>
                <small>{period === "week" ? "week" : "month"}</small>
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 1 && (
        <p className="so-note">{t(
          "It is only you here. Add a buddy under Find to have someone to chase.",
          "Just you up here. Recruit someone to beat.",
          "Just you up here, bestie. Add someone to out-glow.",
        )}</p>
      )}
    </>
  );
}

function fmtVol(kg: number): string {
  if (!kg) return "0";
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
}

/** "Trained today", "Trained 3 days ago", from a workout's date string. */
function fmtLastWorkout(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Trained today";
  if (days === 1) return "Trained yesterday";
  if (days < 30) return `Trained ${days} days ago`;
  return `Last trained ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

// ─── Incoming requests banner ─────────────────────────────────────────────

function IncomingRequests({ incoming, authFetch, refresh, onToast }: {
  incoming: Buddy[];
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const accept = async (id: number) => {
    const r = await authFetch(`/api/buddies/requests/${id}/accept`, { method: "POST" });
    if (r.ok) { onToast("Buddy added"); await refresh(); }
  };
  const decline = async (id: number) => {
    const r = await authFetch(`/api/buddies/${id}`, { method: "DELETE" });
    if (r.ok) { onToast("Declined"); await refresh(); }
  };
  return (
    <>
      <div className="so-title"><UserPlus size={15} /> {incoming.length === 1 ? "1 buddy request" : `${incoming.length} buddy requests`}</div>
      {incoming.map(b => {
        const name = b.name ?? b.username;
        return (
          <div key={b.id} className="so-card so-card-hot">
            <div className="so-person">
              <Avatar name={name} color={b.primary_color} />
              <span className="so-person-text">
                <span className="so-name"><span className="so-name-text">{name}</span></span>
                <span className="so-sub">@{b.username} wants to be your buddy</span>
              </span>
            </div>
            <div className="so-actions">
              <button type="button" className="so-act so-act-main" onClick={() => accept(b.id)}>
                <Check size={18} aria-hidden="true" /> Accept
              </button>
              <button type="button" className="so-act so-act-no" onClick={() => decline(b.id)}>
                <XIcon size={18} aria-hidden="true" /> Decline
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Buddies list ─────────────────────────────────────────────────────────

function BuddiesList({ buddies, statsById, authFetch, refresh, onToast, onLoading, onOpenProfile, onOpenChat, onFind }: {
  buddies: Buddy[];
  statsById: Map<number, ScoreboardRow>;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
  onToast: (m: string) => void;
  onLoading: (l: boolean) => void;
  onOpenProfile: (userId: number) => void;
  onOpenChat: (username: string) => void;
  onFind: () => void;
}) {
  const t = useTxt();
  const accepted = buddies.filter(b => b.status === "accepted");
  const pending = buddies.filter(b => b.status === "pending_out");
  const [motivateBuddy, setMotivateBuddy] = useState<Buddy | null>(null);

  if (accepted.length === 0 && pending.length === 0) {
    return (
      <div className="so-empty">
        <div className="so-empty-icon"><Users size={32} /></div>
        <div className="so-empty-text">{t("No buddies yet. Find someone to lift with.", "No squad yet. Recruit someone.", "No besties yet. Adopt one.")}</div>
        <button type="button" className="so-act so-act-main so-act-fit" onClick={onFind}>
          <Search size={18} aria-hidden="true" /> Find people
        </button>
      </div>
    );
  }

  return (
    <>
      {pending.length > 0 && (
        <div className="so-title"><Clock size={15} /> Waiting for an answer</div>
      )}
      {pending.map(b => {
        const name = b.name ?? b.username;
        return (
          <div key={b.id} className="so-card">
            <div className="so-row">
              <div className="so-person">
                <Avatar name={name} color={b.primary_color} />
                <span className="so-person-text">
                  <span className="so-name"><span className="so-name-text">{name}</span></span>
                  <span className="so-sub">@{b.username} · request sent</span>
                </span>
              </div>
              <button
                type="button"
                className="so-act so-act-no so-act-fit"
                onClick={async () => {
                  const r = await authFetch(`/api/buddies/${b.id}`, { method: "DELETE" });
                  if (r.ok) { onToast("Cancelled"); await refresh(); }
                }}
              >
                <XIcon size={18} aria-hidden="true" /> Cancel
              </button>
            </div>
          </div>
        );
      })}

      {accepted.length > 0 && pending.length > 0 && (
        <div className="so-title"><Users size={15} /> Your buddies</div>
      )}
      {accepted.map(b => (
        <BuddyCard
          key={b.id}
          buddy={b}
          stats={statsById.get(b.user_id)}
          authFetch={authFetch}
          refresh={refresh}
          onToast={onToast}
          onLoading={onLoading}
          onMotivate={() => setMotivateBuddy(b)}
          onOpenProfile={() => onOpenProfile(b.user_id)}
          onOpenChat={() => onOpenChat(b.username)}
        />
      ))}

      {motivateBuddy && (
        <MotivateDialog
          buddy={motivateBuddy}
          authFetch={authFetch}
          onClose={() => setMotivateBuddy(null)}
          onToast={onToast}
        />
      )}
    </>
  );
}

function BuddyCard({ buddy, stats, authFetch, refresh, onToast, onLoading, onMotivate, onOpenProfile, onOpenChat }: {
  buddy: Buddy;
  stats: ScoreboardRow | undefined;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
  onToast: (m: string) => void;
  onLoading: (l: boolean) => void;
  onMotivate: () => void;
  onOpenProfile: () => void;
  onOpenChat: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = buddy.name ?? buddy.username;
  const last = fmtLastWorkout(stats?.last_workout);

  const togglePref = async (key: "notify_workout" | "notify_pr" | "notify_motivate" | "notify_live") => {
    onLoading(true);
    const r = await authFetch(`/api/buddies/${buddy.id}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: !buddy[key] }),
    });
    if (r.ok) await refresh();
    onLoading(false);
  };

  const remove = async () => {
    if (!confirm(`Remove ${name} as buddy?`)) return;
    const r = await authFetch(`/api/buddies/${buddy.id}`, { method: "DELETE" });
    if (r.ok) { onToast("Buddy removed"); await refresh(); }
  };

  return (
    <div className="so-card">
      <button
        type="button"
        className="so-person"
        onClick={onOpenProfile}
        aria-label={`View ${name}'s profile`}
      >
        <Avatar name={name} color={buddy.primary_color} size="lg" />
        <span className="so-person-text">
          <span className="so-name">
            <span className="so-name-text">{name}</span>
            {stats && stats.current_streak > 0 && (
              <span className="so-tag so-tag-fire"><Flame size={12} />{stats.current_streak}</span>
            )}
          </span>
          <span className="so-sub">{last ?? `@${buddy.username}`}</span>
          {stats && (
            <span className="so-sub">
              {stats.workouts_week} {stats.workouts_week === 1 ? "workout" : "workouts"} in the last 7 days
            </span>
          )}
        </span>
      </button>
      <div className="so-actions">
        <button type="button" className="so-act so-act-main" onClick={onMotivate}>
          <Send size={18} aria-hidden="true" /> Motivate
        </button>
        <button type="button" className="so-act" onClick={onOpenChat}>
          <MessageCircle size={18} aria-hidden="true" /> Chat
        </button>
      </div>
      <button type="button" className="disclose" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>More</span>
        <ChevronDown size={18} className={open ? "flip" : undefined} aria-hidden="true" />
      </button>
      {open && (
        <div className="so-more">
          <div className="so-more-title">Tell me when {name}…</div>
          <PrefToggle label="Finishes a workout" on={buddy.notify_workout} onClick={() => togglePref("notify_workout")} />
          <PrefToggle label="Sets a new PR" on={buddy.notify_pr} onClick={() => togglePref("notify_pr")} />
          <PrefToggle label="Sends me motivation" on={buddy.notify_motivate} onClick={() => togglePref("notify_motivate")} />
          <PrefToggle label="Starts or ends a live session" on={buddy.notify_live} onClick={() => togglePref("notify_live")} />
          <button type="button" className="so-danger" onClick={remove}>
            <Trash2 size={16} aria-hidden="true" /> Remove buddy
          </button>
        </div>
      )}
    </div>
  );
}

function PrefToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`pref-toggle${on ? " on" : ""}`}
      onClick={onClick}
    >
      <span className="pref-radio" aria-hidden="true" />
      <span className="pref-toggle-body">
        <span className="pref-toggle-label">{label}</span>
      </span>
    </button>
  );
}

// ─── Motivate dialog ──────────────────────────────────────────────────────

function MotivateDialog({ buddy, authFetch, onClose, onToast }: {
  buddy: Buddy;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [presets, setPresets] = useState<MotivatePreset[]>([]);
  const [picked, setPicked]   = useState<string | null>(null);
  const [custom, setCustom]   = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    authFetch("/api/buddies/motivate/presets")
      .then(r => r.ok ? r.json() : [])
      .then((d: MotivatePreset[]) => setPresets(d))
      .catch(() => {});
  }, [authFetch]);

  const message = useMemo(() => {
    if (custom.trim()) return custom.trim();
    if (picked) return presets.find(p => p.id === picked)?.message ?? "";
    return "";
  }, [custom, picked, presets]);

  const send = async () => {
    if (!message) return;
    setSending(true); setErr("");
    const r = await authFetch(`/api/buddies/${buddy.id}/motivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, preset: custom.trim() ? null : picked }),
    });
    setSending(false);
    if (r.ok) {
      onToast(`Sent to ${buddy.name ?? buddy.username}`);
      onClose();
    } else {
      const body = await r.json().catch(() => ({}));
      setErr(body.detail ?? "Failed to send");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card so-root"
        role="dialog"
        aria-modal="true"
        aria-label={`Motivate ${buddy.name ?? buddy.username}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-title">
          <Send size={16} /> Motivate {buddy.name ?? buddy.username}
        </div>
        <div className="modal-sub">Tap one, or write your own.</div>
        <div className="so-presets">
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              className={`so-preset${picked === p.id ? " on" : ""}`}
              aria-pressed={picked === p.id}
              onClick={() => { setPicked(p.id); setCustom(""); }}
            >
              {p.message}
            </button>
          ))}
        </div>
        <textarea
          className="field-input field-textarea"
          placeholder="Your own words…"
          aria-label="Your own message"
          value={custom}
          maxLength={240}
          onChange={e => { setCustom(e.target.value); setPicked(null); }}
          rows={3}
        />
        {err && <p className="auth-err">{err}</p>}
        <div className="so-actions">
          <button type="button" className="so-act" onClick={onClose}>Cancel</button>
          <button type="button" className="so-act so-act-main" disabled={!message || sending} onClick={send}>
            <Send size={18} aria-hidden="true" /> {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Find users ───────────────────────────────────────────────────────────

function FindBuddies({ authFetch, refresh, onToast, onOpenProfile }: {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
  onToast: (m: string) => void;
  onOpenProfile: (userId: number) => void;
}) {
  const t = useTxt();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await authFetch(`/api/buddies/search?q=${encodeURIComponent(q.trim())}`);
        if (r.ok) setResults(await r.json());
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(handle);
  }, [q, authFetch]);

  const sendRequest = async (username: string) => {
    const r = await authFetch("/api/buddies/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (r.ok) {
      onToast("Request sent");
      await refresh();
      setResults(prev => prev.map(p => p.username === username ? { ...p, relationship: "pending_out" } : p));
    } else {
      const body = await r.json().catch(() => ({}));
      onToast(body.detail ?? "Failed");
    }
  };

  return (
    <>
      <label className="so-field">
        <Search size={20} aria-hidden="true" />
        <input
          className="so-input"
          type="search"
          placeholder="Search by username or name"
          aria-label="Search by username or name"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
      </label>

      {!q.trim() && (
        <div className="so-empty">
          <div className="so-empty-icon"><UserPlus size={32} /></div>
          <div className="so-empty-text">{t(
            "Type a name or username to find people to train with.",
            "Type a name. Recruit the squad.",
            "Type a name, bestie. Build the list.",
          )}</div>
        </div>
      )}
      {loading && <div className="so-note" role="status">Searching…</div>}
      {results.length === 0 && q.trim() && !loading && (
        <div className="so-note" role="status">No one found by that name.</div>
      )}

      <div className="so-list">
        {results.map(r => {
          const canOpen = r.relationship === "accepted" || r.relationship === "self";
          const name = r.name ?? r.username;
          const who = (
            <>
              <Avatar name={name} color={r.primary_color} />
              <span className="so-person-text">
                <span className="so-name"><span className="so-name-text">{name}</span></span>
                <span className="so-sub">@{r.username}</span>
              </span>
            </>
          );
          return (
            <div key={r.id} className="so-card">
              <div className="so-row">
                {canOpen ? (
                  <button
                    type="button"
                    className="so-person"
                    onClick={() => onOpenProfile(r.id)}
                    aria-label={`View ${name}'s profile`}
                  >
                    {who}
                  </button>
                ) : (
                  <div className="so-person">{who}</div>
                )}
                {r.relationship === "self" && (
                  <span className="so-tag so-tag-you">You</span>
                )}
                {r.relationship === "accepted" && (
                  <span className="so-tag so-tag-ok"><Check size={12} /> Buddy</span>
                )}
                {r.relationship === "pending_out" && (
                  <span className="so-tag"><Clock size={12} /> Request sent</span>
                )}
                {r.relationship === "pending_in" && (
                  <span className="so-tag"><UserPlus size={12} /> Asked you</span>
                )}
                {r.relationship === "none" && (
                  <button type="button" className="so-act so-act-main so-act-fit" onClick={() => sendRequest(r.username)}>
                    <UserPlus size={18} aria-hidden="true" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Live (co-working out) ────────────────────────────────────────────────

function LiveView({
  sessions, mine, workoutActive, workoutFocus, workoutDoneSets,
  refreshLive, startLiveSession, endLiveSession, joinLiveSession, onToast,
  onOpenProfile,
}: {
  sessions: LiveSession[];
  mine: LiveSession | null;
  workoutActive: boolean;
  workoutFocus: string | null;
  workoutDoneSets: number;
  refreshLive: () => Promise<void>;
  startLiveSession: (note: string) => Promise<void>;
  endLiveSession: () => Promise<void>;
  joinLiveSession: (id: string) => Promise<void>;
  onToast: (m: string) => void;
  onOpenProfile: (userId: number) => void;
}) {
  const t = useTxt();
  const [note, setNote] = useState("");

  const buddyHosted = sessions.filter(s => !mine || s.id !== mine.id);

  return (
    <>
      <p className="so-intro">{t(
        "Broadcast your workout so buddies can join. Their sets count next to yours in real time.",
        "Broadcast the grind. Buddies in, sets stack up.",
        "Broadcast the grind, bestie. Squad sets stack up live."
      )}</p>

      {mine ? (
        <div className="so-card so-live">
          <div className="so-live-head">
            <span className="so-live-badge"><span className="so-pulse" /> LIVE</span>
            <span>You are broadcasting</span>
            {mine.focus && <span className="so-tag so-tag-focus">{mine.focus}</span>}
          </div>
          {mine.note && <div className="so-quote">"{mine.note}"</div>}
          <div className="so-sets">
            <div className="so-set">
              <span className="so-set-val">{mine.owner_sets_done}</span>
              <span className="so-set-lbl">your sets</span>
            </div>
            {mine.participants.map(p => (
              <div key={p.user_id} className="so-set">
                <Avatar name={p.name ?? p.username} color={p.primary_color} size="sm" />
                <span className="so-set-val">{p.sets_done}</span>
                <span className="so-set-lbl">{p.name ?? p.username}</span>
              </div>
            ))}
            {mine.participants.length === 0 && (
              <div className="so-set so-set-wait">Waiting for buddies to join…</div>
            )}
          </div>
          {workoutActive && mine.owner_sets_done !== workoutDoneSets && (
            <div className="so-note">Your live count follows your workout by itself.</div>
          )}
          <button type="button" className="so-act so-act-no" onClick={async () => {
            await endLiveSession();
            onToast("Live session ended");
          }}>
            <LogOut size={18} aria-hidden="true" /> End live session
          </button>
        </div>
      ) : (
        <div className="so-card">
          <div className="so-live-head"><Radio size={20} aria-hidden="true" /> Go live</div>
          <div className="so-note">
            {workoutActive
              ? `You are logging a ${workoutFocus ?? "workout"} now. Let your buddies in.`
              : "Start a workout first (or right after), then go live."}
          </div>
          <input
            className="so-input"
            placeholder="Add a note, like: Push day at Iron Gym"
            aria-label="Note for your buddies"
            value={note}
            maxLength={140}
            onChange={e => setNote(e.target.value)}
          />
          <button
            type="button"
            className="so-act so-act-main"
            onClick={async () => {
              await startLiveSession(note);
              setNote("");
              onToast("You're live!");
            }}
          >
            <Play size={18} aria-hidden="true" /> Go live
          </button>
        </div>
      )}

      <div className="so-title"><Zap size={15} /> Buddies live now</div>
      {buddyHosted.length === 0 ? (
        <div className="so-note">No buddies are live right now.</div>
      ) : (
        buddyHosted.map(s => (
          <BuddyLiveCard
            key={s.id}
            session={s}
            onJoin={async () => {
              await joinLiveSession(s.id);
              await refreshLive();
              onToast(`Joined ${s.owner_name ?? s.owner_username}`);
            }}
            onOpenProfile={() => onOpenProfile(s.owner_id)}
          />
        ))
      )}
    </>
  );
}

function BuddyLiveCard({ session: s, onJoin, onOpenProfile }: {
  session: LiveSession;
  onJoin: () => Promise<void>;
  onOpenProfile: () => void;
}) {
  const name = s.owner_name ?? s.owner_username;
  return (
    <div className="so-card so-live">
      <div className="so-row">
        <button
          type="button"
          className="so-person"
          onClick={onOpenProfile}
          aria-label={`View ${name}'s profile`}
        >
          <Avatar name={name} color={s.owner_primary_color} size="lg" />
          <span className="so-person-text">
            <span className="so-name"><span className="so-name-text">{name}</span></span>
            <span className="so-sub">{s.focus ? `${s.focus} · ` : ""}@{s.owner_username}</span>
          </span>
        </button>
        <span className="so-live-badge"><span className="so-pulse" /> LIVE</span>
      </div>
      {s.note && <div className="so-quote">"{s.note}"</div>}
      {s.current_exercise_name && (
        <div className="so-now"><Dumbbell size={15} aria-hidden="true" /> Now: <b>{s.current_exercise_name}</b></div>
      )}
      <div className="so-sets">
        <div className="so-set">
          <span className="so-set-val">{s.owner_sets_done}</span>
          <span className="so-set-lbl">{s.owner_username} sets</span>
        </div>
        {s.participants.map(p => (
          <div key={p.user_id} className="so-set">
            <span className="so-set-val">{p.sets_done}</span>
            <span className="so-set-lbl">{p.name ?? p.username}</span>
          </div>
        ))}
      </div>
      <button type="button" className="so-act so-act-main" onClick={onJoin}>
        <Play size={18} aria-hidden="true" /> Join
      </button>
    </div>
  );
}
