import { useEffect, useState } from "react";
import { Search, Check, MessageSquare, GraduationCap, Award, ClipboardList, CalendarCheck, Clock, Send, UserPlus, Users } from "lucide-react";
import type { TrainerPublic, TrainerLink, RegimeAssignment } from "../../types";
import { useTxt } from "../../context/ToneContext";
import { ConfirmButton, PlanAvatar, WeekDots } from "./RegimesTab";
import "../../simple.css";
import "../../pages/plans.css";

interface Props {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  trainerLinks: TrainerLink[];
  assignments: RegimeAssignment[];
  refreshTrainers: () => Promise<void>;
  onOpenChat: (username: string) => void;
  onApplyRegime: (assignment: RegimeAssignment) => void;
}

export default function CoachingTab({
  authFetch, trainerLinks, assignments, refreshTrainers, onOpenChat, onApplyRegime,
}: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TrainerPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [openTrainer, setOpenTrainer] = useState<TrainerPublic | null>(null);
  const t = useTxt();

  // Escape closes the request sheet.
  useEffect(() => {
    if (!openTrainer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenTrainer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTrainer]);

  // Initial trainer list
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch("/api/trainers")
      .then(r => r.ok ? r.json() : [])
      .then((data: TrainerPublic[]) => { if (!cancelled) setResults(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authFetch]);

  // Search trainers when q changes
  useEffect(() => {
    const t = setTimeout(() => {
      const url = q.trim() ? `/api/trainers?q=${encodeURIComponent(q.trim())}` : "/api/trainers";
      authFetch(url)
        .then(r => r.ok ? r.json() : [])
        .then((data: TrainerPublic[]) => setResults(data))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, authFetch]);

  const requestTrainer = async (username: string) => {
    setRequesting(username);
    try {
      const r = await authFetch("/api/trainers/links/request-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, note: note || undefined }),
      });
      if (r.ok) {
        await refreshTrainers();
        setNote("");
        setOpenTrainer(null);
        // Refresh local results
        const url = q.trim() ? `/api/trainers?q=${encodeURIComponent(q.trim())}` : "/api/trainers";
        const refresh = await authFetch(url);
        if (refresh.ok) setResults(await refresh.json());
      }
    } finally {
      setRequesting(null);
    }
  };

  const acceptLink = async (id: number) => {
    await authFetch(`/api/trainers/links/${id}/accept`, { method: "POST" });
    refreshTrainers();
  };
  const removeLink = async (id: number) => {
    await authFetch(`/api/trainers/links/${id}`, { method: "DELETE" });
    refreshTrainers();
  };

  // From the trainee's perspective, links where they are the trainee
  const myCoaches = trainerLinks.filter(l => l.role === "trainee");

  const plans = assignments.filter(a => a.trainee_username && a.regime);
  const showPlans = assignments.filter(a => a.trainer_id !== a.trainee_id).length > 0;
  const openName = openTrainer ? (openTrainer.name || openTrainer.username) : "";

  return (
    <div className="coaching-tab tab-anim pl-page">
      {/* My coaches */}
      <section className="pl-section">
        <h2 className="pl-head">
          <GraduationCap size={18} /> My coaches
        </h2>
        {myCoaches.length === 0 && (
          <div className="pl-empty">
            <span className="pl-empty-icon"><GraduationCap size={26} /></span>
            <p>{t(
              "You have no trainer yet. Pick one from the list below.",
              "No coach in your corner yet. Pick one from the list below.",
              "No coach yet, bestie. Pick one from the list below.",
            )}</p>
          </div>
        )}
        {myCoaches.length > 0 && (
          <div className="pl-grid">
            {myCoaches.map(l => {
              const name = l.other_name || l.other_username;
              const active = l.status === "accepted";
              return (
                <article key={l.id} className={`pl-card${active ? " is-on" : " is-wait"}`}>
                  <div className="pl-card-top">
                    <PlanAvatar name={name} color={l.other_primary_color} large />
                    <div className="pl-card-id">
                      <span className="pl-name">{name}</span>
                      <span className="pl-sub">@{l.other_username}</span>
                      <div className="pl-pills">
                        {active && <span className="pl-tag pl-tag-on"><Check size={14} strokeWidth={3} /> Coaching active</span>}
                        {l.status === "pending_trainee" && <span className="pl-tag"><Clock size={14} /> Waiting for their reply</span>}
                        {l.status === "pending_trainer" && <span className="pl-tag pl-tag-ok"><UserPlus size={14} /> Invited you</span>}
                      </div>
                    </div>
                  </div>
                  {l.status === "pending_trainer" && l.note && <p className="pl-quote">“{l.note}”</p>}
                  <div className="pl-actions">
                    {active && (
                      <button type="button" className="pl-btn pl-btn-main" onClick={() => onOpenChat(l.other_username)}>
                        <MessageSquare size={18} /> Chat
                      </button>
                    )}
                    {l.status === "pending_trainer" && (
                      <button type="button" className="pl-btn pl-btn-main" onClick={() => acceptLink(l.id)}>
                        <Check size={18} strokeWidth={3} /> Accept
                      </button>
                    )}
                    <ConfirmButton
                      label={active ? "Stop coaching" : l.status === "pending_trainer" ? "Decline" : "Cancel request"}
                      onConfirm={() => removeLink(l.id)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Assigned regimes */}
      {showPlans && (
        <section className="pl-section">
          <h2 className="pl-head">
            <ClipboardList size={18} /> Plans from your coach
            {plans.length > 0 && <span className="pl-count">{plans.length}</span>}
          </h2>
          <div className="pl-grid">
            {plans.map(a => {
              const weeks = a.regime.weeks?.length ?? 1;
              return (
                <article key={a.id} className="pl-card">
                  <div className="pl-card-top">
                    <span className="pl-icon"><ClipboardList size={22} /></span>
                    <div className="pl-card-id">
                      <span className="pl-name">{a.regime.name}</span>
                      <span className="pl-sub">
                        From {a.trainer_name || a.trainer_username} · {a.regime.days_per_week} days a week
                        {weeks > 1 ? ` · ${weeks} weeks` : ""}
                      </span>
                    </div>
                  </div>
                  {a.regime.description && <p className="pl-desc">{a.regime.description}</p>}
                  {a.note && <p className="pl-quote">“{a.note}”</p>}
                  <WeekDots days={a.regime.days} />
                  <div className="pl-actions">
                    <button type="button" className="pl-btn pl-btn-main" onClick={() => onApplyRegime(a)}>
                      <CalendarCheck size={18} /> Apply to my week
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Trainer directory */}
      <section className="pl-section">
        <h2 className="pl-head">
          <Search size={18} /> Find a trainer
        </h2>
        <div className="pl-search">
          <Search size={18} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Name, username or specialty"
            aria-label="Search trainers by name, username or specialty"
            type="search"
            enterKeyHint="search"
          />
        </div>
        {loading && results.length === 0 && (
          <div className="pl-grid" aria-busy="true" aria-label="Loading trainers">
            <div className="pl-skel" /><div className="pl-skel" />
          </div>
        )}
        {results.length === 0 && !loading && (
          <p className="pl-muted">
            No trainers found. Be the first: sign up with a trainer account from the login screen.
          </p>
        )}
        <div className="pl-grid">
          {results.map(tr => {
            const name = tr.name || tr.username;
            return (
              <article key={tr.id} className={`pl-card${tr.link_status === "accepted" ? " is-on" : ""}`}>
                <div className="pl-card-top">
                  <PlanAvatar name={name} color={tr.primary_color} />
                  <div className="pl-card-id">
                    <span className="pl-name">{name}</span>
                    <span className="pl-sub">@{tr.username}</span>
                    <div className="pl-pills">
                      {tr.trainer_years_experience != null && (
                        <span className="pl-pill pl-pill-plain">
                          <Award size={14} /> {tr.trainer_years_experience} {tr.trainer_years_experience === 1 ? "year" : "years"}
                        </span>
                      )}
                      <span className="pl-pill pl-pill-plain">
                        <Users size={14} /> {tr.trainee_count} {tr.trainee_count === 1 ? "trainee" : "trainees"}
                      </span>
                    </div>
                  </div>
                </div>
                {tr.trainer_bio && <p className="pl-desc">{tr.trainer_bio}</p>}
                {tr.trainer_specialties && tr.trainer_specialties.length > 0 && (
                  <div className="pl-pills">
                    {tr.trainer_specialties.slice(0, 4).map(s => (
                      <span key={s} className="pl-pill">{s}</span>
                    ))}
                  </div>
                )}
                <div className="pl-actions">
                  {tr.link_status === "self" && <span className="pl-tag">This is you</span>}
                  {tr.link_status === "accepted" && <span className="pl-tag pl-tag-on"><Check size={14} strokeWidth={3} /> Coaching active</span>}
                  {tr.link_status === "pending_trainee" && <span className="pl-tag"><Clock size={14} /> Waiting for their reply</span>}
                  {tr.link_status === "pending_trainer" && <span className="pl-tag pl-tag-ok"><UserPlus size={14} /> They invited you</span>}
                  {tr.link_status === "none" && (
                    <button type="button" className="pl-btn pl-btn-main" onClick={() => setOpenTrainer(tr)}>
                      <UserPlus size={18} /> Ask to coach me
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {openTrainer && (
        <div className="modal-backdrop" onClick={() => setOpenTrainer(null)}>
          <div
            className="modal-card pl-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pl-ask-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="pl-card-top">
              <PlanAvatar name={openName} color={openTrainer.primary_color} />
              <div className="pl-card-id">
                <h3 id="pl-ask-title" className="pl-sheet-title">Ask {openName} to coach you</h3>
              </div>
            </div>
            <div className="pl-form">
              <label className="pl-label" htmlFor="pl-ask-note">A message, if you like: what are you working on?</label>
              <textarea
                id="pl-ask-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
                placeholder="Hi, I want to focus on my deadlift over the next 3 months…"
              />
            </div>
            <div className="pl-actions">
              <button type="button" className="pl-btn" onClick={() => setOpenTrainer(null)}>Cancel</button>
              <button
                type="button"
                className="pl-btn pl-btn-main"
                onClick={() => requestTrainer(openTrainer.username)}
                disabled={requesting === openTrainer.username}
              >
                <Send size={18} /> Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
