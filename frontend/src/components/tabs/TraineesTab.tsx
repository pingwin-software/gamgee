import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Send, UserPlus, MessageSquare, Activity, Check, Clock, ClipboardList, Bell, ChevronUp, Dumbbell } from "../../icons";
import type { TrainerLink, Regime, RegimeAssignment, LiveSession } from "../../types";
import { useTxt } from "../../context/ToneContext";
import { ConfirmButton, PlanAvatar, WeekDots } from "./RegimesTab";
import "../../simple.css";
import "../../pages/plans.css";

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface Props {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  trainerLinks: TrainerLink[];
  liveSessions: LiveSession[];
  refreshTrainers: () => Promise<void>;
  onOpenChat: (username: string) => void;
  onOpenLive: (session: LiveSession) => void;
}

export default function TraineesTab({
  authFetch, trainerLinks, liveSessions, refreshTrainers, onOpenChat, onOpenLive,
}: Props) {
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [assignments, setAssignments] = useState<RegimeAssignment[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [assigningTo, setAssigningTo] = useState<{ traineeId: number; username: string } | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [selectedRegime, setSelectedRegime] = useState<number | null>(null);
  const t = useTxt();

  // Escape closes the assign sheet.
  useEffect(() => {
    if (!assigningTo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAssigningTo(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assigningTo]);

  const refresh = async () => {
    const [reg, asn] = await Promise.all([
      authFetch("/api/regimes").then(r => r.ok ? r.json() : []),
      authFetch("/api/assignments/mine").then(r => r.ok ? r.json() : []),
    ]);
    setRegimes(reg);
    setAssignments(asn);
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myTrainees = trainerLinks.filter(l => l.role === "trainer");
  const traineeLiveByOwner: Record<number, LiveSession> = useMemo(() => {
    const map: Record<number, LiveSession> = {};
    for (const s of liveSessions) {
      if (s.status === "active") map[s.owner_id] = s;
    }
    return map;
  }, [liveSessions]);

  const inviteTrainee = async () => {
    setInviteErr(null);
    const username = inviteUsername.trim();
    if (!username) return;
    try {
      const r = await authFetch("/api/trainers/links/invite-trainee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, note: inviteNote || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setInviteErr(e.detail || "Couldn't send invite");
        return;
      }
      setInviteUsername("");
      setInviteNote("");
      setInviteOpen(false);
      refreshTrainers();
    } catch { setInviteErr("Network error"); }
  };

  const removeLink = async (id: number) => {
    await authFetch(`/api/trainers/links/${id}`, { method: "DELETE" });
    refreshTrainers();
  };

  const acceptLink = async (id: number) => {
    await authFetch(`/api/trainers/links/${id}/accept`, { method: "POST" });
    refreshTrainers();
  };

  const assignRegime = async () => {
    if (!assigningTo || !selectedRegime) return;
    try {
      const r = await authFetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainee_id: assigningTo.traineeId,
          regime_id: selectedRegime,
          note: assignNote || undefined,
        }),
      });
      if (r.ok) {
        setAssigningTo(null);
        setAssignNote("");
        setSelectedRegime(null);
        refresh();
      }
    } catch { /* ignore */ }
  };

  // People who asked for you come first; the rest are yours or invited.
  const incoming = myTrainees.filter(l => l.status === "pending_trainee");
  const roster = myTrainees.filter(l => l.status !== "pending_trainee");
  const sent = assignments.filter(a => myTrainees.some(tr => tr.other_user_id === a.trainee_id));
  const lastPlanFor = (userId: number) =>
    sent.filter(a => a.trainee_id === userId && a.status !== "revoked").sort((a, b) => b.created_at - a.created_at)[0];

  return (
    <div className="trainees-tab tab-anim pl-page">
      {incoming.length > 0 && (
        <section className="pl-section">
          <h2 className="pl-head">
            <Bell size={18} /> Requests <span className="pl-count">{incoming.length}</span>
          </h2>
          <div className="pl-grid">
            {incoming.map(l => {
              const name = l.other_name || l.other_username;
              return (
                <article key={l.id} className="pl-card is-on">
                  <div className="pl-card-top">
                    <PlanAvatar name={name} color={l.other_primary_color} />
                    <div className="pl-card-id">
                      <span className="pl-name">{name}</span>
                      <span className="pl-sub">@{l.other_username} · asked {shortDate(l.created_at)}</span>
                      <div className="pl-pills">
                        <span className="pl-tag pl-tag-ok"><UserPlus size={14} /> Wants you as coach</span>
                      </div>
                    </div>
                  </div>
                  {l.note && <p className="pl-quote">“{l.note}”</p>}
                  <div className="pl-actions">
                    <button type="button" className="pl-btn pl-btn-main" onClick={() => acceptLink(l.id)}>
                      <Check size={18} strokeWidth={3} /> Accept
                    </button>
                    <ConfirmButton label="Decline" onConfirm={() => removeLink(l.id)} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="pl-section">
        <h2 className="pl-head">
          <GraduationCap size={18} /> {t("My trainees", "My crew", "My crew")}
          {roster.length > 0 && <span className="pl-count">{roster.length}</span>}
        </h2>

        <div className="pl-starts">
          <button
            type="button"
            className={`start-card${inviteOpen || myTrainees.length > 0 ? "" : " start-card-main"}`}
            onClick={() => { setInviteOpen(o => !o); setInviteErr(null); }}
            aria-expanded={inviteOpen}
          >
            <span className="start-card-icon">{inviteOpen ? <ChevronUp size={22} /> : <UserPlus size={22} />}</span>
            <span className="start-card-text">
              <span className="start-card-kicker">{inviteOpen ? "Invite open" : "New trainee"}</span>
              <span className="start-card-title">{inviteOpen ? "Close the invite" : "Invite a trainee"}</span>
              <span className="start-card-sub">They get a request and choose whether to accept.</span>
            </span>
          </button>
        </div>

        {inviteOpen && (
          <div className="pl-card pl-solo">
            <div className="pl-form">
              <label className="pl-label" htmlFor="pl-invite-user">Their username</label>
              <input
                id="pl-invite-user"
                value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <label className="pl-label" htmlFor="pl-invite-note">A message, if you like</label>
              <textarea
                id="pl-invite-note"
                value={inviteNote}
                onChange={e => setInviteNote(e.target.value)}
                placeholder="Optional message"
                rows={3}
              />
              {inviteErr && <p className="pl-error" role="alert">{inviteErr}</p>}
            </div>
            <div className="pl-actions">
              <button type="button" className="pl-btn" onClick={() => { setInviteOpen(false); setInviteErr(null); }}>Cancel</button>
              <button type="button" className="pl-btn pl-btn-main" onClick={inviteTrainee} disabled={!inviteUsername.trim()}>
                <Send size={18} /> Send invite
              </button>
            </div>
          </div>
        )}

        {myTrainees.length === 0 ? (
          <div className="pl-empty">
            <span className="pl-empty-icon"><GraduationCap size={26} /></span>
            <p>No trainees yet. Invite someone, or wait for a request from your public profile.</p>
          </div>
        ) : (
          <div className="pl-grid">
            {roster.map(l => {
              const live = traineeLiveByOwner[l.other_user_id];
              const name = l.other_name || l.other_username;
              const accepted = l.status === "accepted";
              const plan = lastPlanFor(l.other_user_id);
              return (
                <article key={l.id} className={`pl-card${live ? " is-live" : accepted ? "" : " is-wait"}`}>
                  <div className="pl-card-top">
                    <PlanAvatar name={name} color={l.other_primary_color} live={!!live} />
                    <div className="pl-card-id">
                      <span className="pl-name">{name}</span>
                      <span className="pl-sub">
                        @{l.other_username}
                        {accepted ? ` · since ${shortDate(l.created_at)}` : ` · invited ${shortDate(l.created_at)}`}
                      </span>
                      <div className="pl-pills">
                        {live && <span className="pl-tag pl-tag-live"><span className="pl-live-dot" /> Training now</span>}
                        {!accepted && <span className="pl-tag"><Clock size={14} /> Waiting for their reply</span>}
                        {accepted && plan && (
                          <span className="pl-pill pl-pill-plain"><ClipboardList size={14} /> {plan.regime.name}</span>
                        )}
                        {accepted && !plan && !live && <span className="pl-tag">No plan yet</span>}
                      </div>
                    </div>
                  </div>
                  {live && (
                    <p className="pl-quote">
                      <Dumbbell size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                      {live.current_exercise_name || "Warming up"} · {live.owner_sets_done} {live.owner_sets_done === 1 ? "set" : "sets"} done
                    </p>
                  )}
                  <div className="pl-actions">
                    {live && (
                      <button type="button" className="pl-btn pl-btn-live pl-btn-wide" onClick={() => onOpenLive(live)}>
                        <Activity size={18} /> Watch live
                      </button>
                    )}
                    {accepted && (
                      <>
                        <button
                          type="button"
                          className="pl-btn pl-btn-main"
                          onClick={() => setAssigningTo({ traineeId: l.other_user_id, username: l.other_username })}
                        >
                          <Send size={18} /> Assign plan
                        </button>
                        <button type="button" className="pl-btn" onClick={() => onOpenChat(l.other_username)}>
                          <MessageSquare size={18} /> Chat
                        </button>
                      </>
                    )}
                    <ConfirmButton
                      label={accepted ? "Remove" : "Cancel invite"}
                      onConfirm={() => removeLink(l.id)}
                      className={accepted ? "pl-btn-wide" : ""}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Assignments I have sent */}
      {sent.length > 0 && (
        <section className="pl-section">
          <h2 className="pl-head">
            <ClipboardList size={18} /> Plans I've assigned
            {sent.length > 0 && <span className="pl-count">{sent.length}</span>}
          </h2>
          <div className="pl-grid">
            {sent.map(a => {
              const who = a.trainee_name || a.trainee_username;
              return (
                <article key={a.id} className="pl-card">
                  <div className="pl-card-top">
                    <PlanAvatar name={who} />
                    <div className="pl-card-id">
                      <span className="pl-name">{a.regime.name}</span>
                      <span className="pl-sub">For {who} · sent {shortDate(a.created_at)}</span>
                    </div>
                    {a.status === "accepted" && <span className="pl-tag pl-tag-ok"><Check size={14} strokeWidth={3} /> Accepted</span>}
                  </div>
                  <WeekDots days={a.regime.days} small />
                  <div className="pl-actions">
                    <ConfirmButton
                      label="Revoke"
                      onConfirm={async () => {
                        await authFetch(`/api/assignments/${a.id}`, { method: "DELETE" });
                        refresh();
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {assigningTo && (
        <div className="modal-backdrop" onClick={() => setAssigningTo(null)}>
          <div
            className="modal-card pl-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pl-assign-title"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="pl-assign-title" className="pl-sheet-title">Assign a plan to {assigningTo.username}</h3>
            {regimes.length === 0 ? (
              <p className="pl-muted">You have no regimes yet. Build one on the Regimes page first.</p>
            ) : (
              <>
                <div className="pl-picks" role="radiogroup" aria-label="Pick a regime">
                  {regimes.map(r => {
                    const on = selectedRegime === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`pl-pick${on ? " on" : ""}`}
                        onClick={() => setSelectedRegime(r.id)}
                      >
                        <span className="pl-pick-top">
                          <span className="pl-pick-check"><Check size={15} strokeWidth={3} /></span>
                          <span className="pl-card-id">
                            <span className="pl-name">{r.name}</span>
                            <span className="pl-sub">{r.days_per_week} days a week · {(r.goal || "general").replace("_", " ")}</span>
                          </span>
                        </span>
                        <WeekDots days={r.days} small />
                      </button>
                    );
                  })}
                </div>
                <div className="pl-form">
                  <label className="pl-label" htmlFor="pl-assign-note">A note for your trainee, if you like</label>
                  <textarea
                    id="pl-assign-note"
                    rows={2}
                    value={assignNote}
                    onChange={e => setAssignNote(e.target.value)}
                    placeholder="Optional note for your trainee"
                  />
                </div>
              </>
            )}
            <div className="pl-actions">
              <button type="button" className="pl-btn" onClick={() => setAssigningTo(null)}>Cancel</button>
              <button type="button" className="pl-btn pl-btn-main" onClick={assignRegime} disabled={!selectedRegime}>
                <Send size={18} /> Send plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
