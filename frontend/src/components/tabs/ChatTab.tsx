import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Send, MessageSquarePlus, GraduationCap, Users, ChevronLeft, MessagesSquare, Hand, X,
} from "lucide-react";
import type { ChatMessage, Conversation, Buddy, TrainerLink } from "../../types";
import { fmtDate } from "../../utils";
import { useTxt } from "../../context/ToneContext";
import "../../pages/chat.css";

interface Props {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  conversations: Conversation[];
  refreshConversations: () => Promise<void>;
  activeConvId: number | null;
  setActiveConvId: (id: number | null) => void;
  currentUserId: number | null;
  buddies: Buddy[];
  trainerLinks: TrainerLink[];
  /** WorkoutTracker owns the chat WebSocket; ChatTab registers a callback in
   *  this set so each incoming message is appended to the active thread. */
  messageSubscribersRef: MutableRefObject<Set<(m: ChatMessage) => void>>;
}

type ContactKind = "buddy" | "coach" | "trainee";
interface Contact {
  username: string;
  name: string | null;
  primary_color: string | null;
  kind: ContactKind;
}

/** Up to two initials: "Ana Marić" is AM, "sam" is S. */
function initials(label: string | null | undefined): string {
  const words = (label || "?").trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const DAY_MS = 86_400_000;
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Whole days between a moment and today (0 = today, 1 = yesterday). */
function daysAgo(ms: number): number {
  return Math.round((startOfDay(Date.now()) - startOfDay(ms)) / DAY_MS);
}

/** Short time for the list: now, 5 min, 14:20, Yesterday, Mon, then the date. */
function listTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  const days = daysAgo(ms);
  if (days <= 0) return clock(ms);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(ms).toLocaleDateString([], { weekday: "short" });
  return fmtDate(new Date(ms).toISOString());
}

/** Label of a day divider inside a conversation. */
function dayLabel(ms: number): string {
  const days = daysAgo(ms);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(ms).toLocaleDateString([], { weekday: "long" });
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

/** Messages from one sender within this gap read as one group. */
const GROUP_GAP_MS = 5 * 60_000;

const reducedMotion = () =>
  typeof window !== "undefined" && (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.getAttribute("data-reduced-motion") === "1"
  );

export default function ChatTab({
  authFetch, conversations, refreshConversations,
  activeConvId, setActiveConvId, currentUserId,
  buddies, trainerLinks, messageSubscribersRef,
}: Props) {
  const t = useTxt();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // What a screen reader hears when someone else's message lands in the open thread.
  const [heard, setHeard] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvQuery, setNewConvQuery] = useState("");
  const [newConvErr, setNewConvErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragOffset = useRef(0);
  const dragActive = useRef(false);

  const isFullscreenMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 480px)").matches;

  const closeThread = () => {
    const el = threadRef.current;
    if (!el || !isFullscreenMobile() || reducedMotion()) {
      setActiveConvId(null);
      return;
    }
    el.style.transition = "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "translateY(100%)";
    window.setTimeout(() => setActiveConvId(null), 220);
  };

  const onThreadTouchStart = (e: React.TouchEvent) => {
    if (!isFullscreenMobile()) return;
    const target = e.target as HTMLElement;
    // Only engage drag from the top of the sheet — never from scrollable body or composer.
    if (target.closest(".ch-log")) return;
    if (target.closest(".ch-composer")) return;
    dragStartY.current = e.touches[0].clientY;
    dragOffset.current = 0;
    dragActive.current = false;
    const el = threadRef.current;
    if (el) el.style.transition = "";
  };

  const onThreadTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy <= 0) {
      // Pulling up — ignore until the user pulls down past the engagement threshold.
      return;
    }
    if (!dragActive.current && dy < 6) return;
    dragActive.current = true;
    dragOffset.current = dy;
    const el = threadRef.current;
    if (el) {
      el.classList.add("is-dragging");
      el.style.transform = `translateY(${dy}px)`;
    }
  };

  const onThreadTouchEnd = () => {
    if (dragStartY.current == null) return;
    const wasDragging = dragActive.current;
    const offset = dragOffset.current;
    dragStartY.current = null;
    dragOffset.current = 0;
    dragActive.current = false;
    const el = threadRef.current;
    if (!wasDragging) return;
    const threshold = Math.min(140, window.innerHeight * 0.22);
    if (offset > threshold) {
      closeThread();
      return;
    }
    if (el) {
      el.style.transition = "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)";
      el.style.transform = "translateY(0)";
      window.setTimeout(() => {
        if (!el) return;
        el.classList.remove("is-dragging");
        el.style.transform = "";
        el.style.transition = "";
      }, 240);
    }
  };

  // Reset any inline transform when the active conversation changes so a
  // newly-opened thread always starts from its CSS-animated entry state.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.transition = "";
    el.classList.remove("is-dragging");
  }, [activeConvId]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConvId) ?? null,
    [conversations, activeConvId]
  );

  // Build a deduped, sorted list of chat-able contacts: accepted buddies + accepted coaches/trainees.
  const contacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();
    for (const b of buddies) {
      if (b.status !== "accepted") continue;
      map.set(b.username, {
        username: b.username,
        name: b.name,
        primary_color: b.primary_color,
        kind: "buddy",
      });
    }
    for (const l of trainerLinks) {
      if (l.status !== "accepted") continue;
      // role "trainee" = this user is the trainee; the other side is the coach
      const kind: ContactKind = l.role === "trainee" ? "coach" : "trainee";
      // Coach/trainee labelling wins over buddy if both apply
      map.set(l.other_username, {
        username: l.other_username,
        name: l.other_name,
        primary_color: l.other_primary_color,
        kind,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.username).localeCompare(b.name || b.username)
    );
  }, [buddies, trainerLinks]);

  const filteredContacts = useMemo(() => {
    const q = newConvQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      c.username.toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q)
    );
  }, [contacts, newConvQuery]);

  // Load thread when activeConv changes
  useEffect(() => {
    setHeard("");
    if (!activeConvId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(`/api/chat/conversations/${activeConvId}/messages?limit=80`);
        if (!r.ok) return;
        const data: ChatMessage[] = await r.json();
        if (!cancelled) setMessages(data);
        authFetch(`/api/chat/conversations/${activeConvId}/read`, { method: "POST" })
          .then(() => refreshConversations()).catch(() => {});
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeConvId, authFetch, refreshConversations]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Real-time delivery: the chat WebSocket pushes each new message to a
  // subscriber set on WorkoutTracker. We register here while the tab is
  // mounted, append messages destined for the open thread (deduped by id),
  // and mark them read so the unread badge clears on the sender's side too.
  useEffect(() => {
    const onMessage = (m: ChatMessage) => {
      if (m.conversation_id !== activeConvId) return;
      setMessages(prev => {
        if (prev.some(x => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (m.sender_id !== currentUserId) {
        setHeard(`${m.sender_name || m.sender_username}: ${m.body}`);
        authFetch(`/api/chat/conversations/${activeConvId}/read`, { method: "POST" })
          .catch(() => {});
      }
    };
    const subs = messageSubscribersRef.current;
    subs.add(onMessage);
    return () => { subs.delete(onMessage); };
  }, [activeConvId, currentUserId, authFetch, messageSubscribersRef]);

  const sendMessage = async () => {
    if (!activeConvId || !input.trim() || sending) return;
    setSending(true);
    const body = input.trim();
    setInput("");
    try {
      const r = await authFetch(`/api/chat/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const msg: ChatMessage = await r.json();
        // The WebSocket echo for our own message may have arrived first;
        // dedup by id so we don't double-render on the sender's side.
        setMessages(prev => (prev.some(x => x.id === msg.id) ? prev : [...prev, msg]));
        refreshConversations();
      } else {
        setInput(body);
      }
    } catch {
      setInput(body);
    } finally {
      setSending(false);
    }
  };

  const openConversationWith = async (username: string) => {
    if (!username.trim() || opening) return;
    setOpening(true);
    setNewConvErr(null);
    try {
      const r = await authFetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setNewConvErr(err.detail || "Couldn't open chat with that user");
        return;
      }
      const conv: Conversation = await r.json();
      await refreshConversations();
      setActiveConvId(conv.id);
      setNewConvOpen(false);
      setNewConvQuery("");
    } catch {
      setNewConvErr("Network error");
    } finally {
      setOpening(false);
    }
  };

  const open = activeConvId != null;
  const kindLabel: Record<ContactKind, string> = {
    buddy: "Buddy",
    coach: "Coach",
    trainee: "Trainee",
  };
  const totalUnread = conversations.reduce((n, c) => n + (c.unread_count > 0 ? c.unread_count : 0), 0);
  const activeName = activeConv?.other_name || activeConv?.other_username || "";

  // Each message with what goes above it: a day divider, a group's time.
  const rows = useMemo(() => messages.map((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const newDay = !prev || startOfDay(prev.created_at) !== startOfDay(m.created_at);
    const head = newDay || prev.sender_id !== m.sender_id
      || m.created_at - prev.created_at > GROUP_GAP_MS;
    const last = !next || next.sender_id !== m.sender_id
      || startOfDay(next.created_at) !== startOfDay(m.created_at)
      || next.created_at - m.created_at > GROUP_GAP_MS;
    return { m, newDay, head, last };
  }), [messages]);

  return (
    <div className={`ch-shell${open ? " is-open" : ""}`}>
      <div className="ch-sr" aria-live="polite" role="status">{heard}</div>

      <section className="ch-side tab-anim" aria-label="Conversations">
        <div className="ch-head">
          <h2 className="ch-title">
            Chat
            {totalUnread > 0 && (
              <span className="ch-title-count" aria-label={`${totalUnread} unread`}>{totalUnread}</span>
            )}
          </h2>
          <button
            type="button"
            className={`ch-new-btn${newConvOpen ? " on" : ""}`}
            onClick={() => setNewConvOpen(v => !v)}
            aria-expanded={newConvOpen}
          >
            {newConvOpen ? <X size={18} /> : <MessageSquarePlus size={18} />}
            {newConvOpen ? "Close" : "New chat"}
          </button>
        </div>

        {newConvOpen && (
          <div className="ch-picker">
            <div className="ch-picker-hint">
              {t(
                "Pick a buddy or coach, or type any username.",
                "Pick a buddy or coach, or type any username.",
                "Pick a bestie or coach, or type any username."
              )}
            </div>
            <div className="ch-picker-row">
              <input
                autoFocus
                className="ch-field"
                value={newConvQuery}
                onChange={e => setNewConvQuery(e.target.value)}
                placeholder="Name or username"
                aria-label="Search by name or username"
                autoCapitalize="none"
                autoCorrect="off"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    // If exactly one filtered result, open them. Else use raw text.
                    if (filteredContacts.length === 1) openConversationWith(filteredContacts[0].username);
                    else openConversationWith(newConvQuery);
                  }
                  if (e.key === "Escape") setNewConvOpen(false);
                }}
              />
              <button
                type="button"
                className="ch-open-btn"
                onClick={() => openConversationWith(newConvQuery)}
                disabled={!newConvQuery.trim() || opening}
              >
                Open
              </button>
            </div>
            {filteredContacts.length === 0 ? (
              <div className="ch-note">
                {contacts.length === 0
                  ? "No buddies or coaches yet. Add buddies on the Buddies page, or type a username above."
                  : "No matches. Press Open to try that username anyway."}
              </div>
            ) : (
              <div className="ch-people">
                {filteredContacts.map(c => (
                  <button
                    type="button"
                    key={c.username}
                    className="ch-person"
                    onClick={() => openConversationWith(c.username)}
                    disabled={opening}
                    title={`@${c.username}`}
                  >
                    <span
                      className="ch-av ch-av-lg"
                      style={{ "--c": c.primary_color || "var(--accent)" } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      {initials(c.name || c.username)}
                    </span>
                    <span className="ch-person-name">{c.name || c.username}</span>
                    <span className={`ch-person-kind ${c.kind}`}>
                      {c.kind === "coach" || c.kind === "trainee"
                        ? <GraduationCap size={13} />
                        : <Users size={13} />}
                      {kindLabel[c.kind]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {newConvErr && <div className="ch-err" role="alert">{newConvErr}</div>}
          </div>
        )}

        {conversations.length === 0 ? (
          !newConvOpen && (
            <div className="ch-empty">
              <span className="ch-empty-icon"><MessagesSquare size={34} /></span>
              <div className="ch-empty-text">
                {t(
                  "No chats yet. Message a buddy or your coach.",
                  "Quiet in here, bro. Hit up a buddy or your coach.",
                  "So quiet, bestie. Message a buddy or your coach."
                )}
              </div>
            </div>
          )
        ) : (
          <div className="ch-list">
            {conversations.map(c => {
              const label = c.other_name || c.other_username;
              const unread = c.unread_count > 0;
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`ch-row${unread ? " unread" : ""}`}
                  onClick={() => setActiveConvId(c.id)}
                  aria-current={c.id === activeConvId ? "true" : undefined}
                >
                  <span
                    className="ch-av"
                    style={{ "--c": c.other_primary_color || "var(--accent)" } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    {initials(label)}
                    {c.kind === "coach" && (
                      <span className="ch-av-badge"><GraduationCap size={12} /></span>
                    )}
                  </span>
                  <span className="ch-row-main">
                    <span className="ch-row-name">
                      {label}
                      {c.kind === "coach" && <span className="ch-sr">, coaching channel</span>}
                    </span>
                    <span className="ch-row-preview">
                      {c.last_message_preview || "No messages yet"}
                    </span>
                  </span>
                  <span className="ch-row-meta">
                    {c.last_message_at > 0 && (
                      <span className="ch-row-time">{listTime(c.last_message_at)}</span>
                    )}
                    {unread && (
                      <span className="ch-pill">
                        {c.unread_count}<span className="ch-sr"> unread</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {open ? (
        <section
          ref={threadRef}
          className="ch-thread"
          aria-label={activeName ? `Conversation with ${activeName}` : "Conversation"}
          onTouchStart={onThreadTouchStart}
          onTouchMove={onThreadTouchMove}
          onTouchEnd={onThreadTouchEnd}
          onTouchCancel={onThreadTouchEnd}
        >
          <div className="ch-handle" aria-hidden="true" />
          <div className="ch-thread-head">
            <button type="button" className="ch-back" onClick={closeThread} aria-label="Back to chats">
              <ChevronLeft size={20} /> Back
            </button>
            <span
              className="ch-av ch-av-sm"
              style={{ "--c": activeConv?.other_primary_color || "var(--accent)" } as React.CSSProperties}
              aria-hidden="true"
            >
              {initials(activeName)}
            </span>
            <span className="ch-thread-who">
              <strong className="ch-thread-name">{activeName}</strong>
              {activeConv && (
                <span className="ch-thread-sub">
                  {activeConv.kind === "coach"
                    ? <><GraduationCap size={13} /> Coaching channel</>
                    : <>@{activeConv.other_username}</>}
                </span>
              )}
            </span>
          </div>

          <div ref={scrollerRef} className="ch-log">
            {messages.length === 0 && (
              <div className="ch-hello">
                <Hand size={34} />
                <span>{t("Say hello.", "Say hi, bro.", "Say hi, bestie.")}</span>
              </div>
            )}
            {rows.map(({ m, newDay, head, last }) => {
              const mine = currentUserId != null && m.sender_id === currentUserId;
              const side = mine ? "mine" : "theirs";
              return [
                newDay && <div key={`d${m.id}`} className="ch-day">{dayLabel(m.created_at)}</div>,
                head && <div key={`t${m.id}`} className={`ch-stamp ${side}`}>{clock(m.created_at)}</div>,
                <div key={m.id} className={`ch-msg ${side}${last ? "" : " mid"}`}>
                  <div className="ch-bubble">
                    <span className="ch-sr">{mine ? "You: " : `${m.sender_name || m.sender_username}: `}</span>
                    {m.body}
                  </div>
                </div>,
              ];
            })}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); sendMessage(); }}
            className="ch-composer"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message"
              aria-label={activeName ? `Message ${activeName}` : "Message"}
              className="ch-field"
              enterKeyHint="send"
              autoComplete="off"
            />
            <button
              className="ch-send"
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </form>
        </section>
      ) : (
        <div className="ch-blank">
          <span className="ch-empty-icon"><MessagesSquare size={34} /></span>
          <span>Pick a chat to start talking.</span>
        </div>
      )}
    </div>
  );
}
