import { useEffect, useState } from "react";
import { Zap, ClipboardList, Trophy, Heart, Brain, User, Wrench, Users, Bell, GraduationCap, MessagesSquare, Calendar, TrendingUp } from "lucide-react";
import "../simple.css";
import { fmtClock } from "../utils";
import { useTxt } from "../context/ToneContext";

interface Props {
  active:       boolean;
  elapsed:      number;
  wStep:        number;
  historyCount: number;
  prCount:      number;
  coachCount:   number;
  buddyCount:   number;
  unreadNotif:  number;
  unreadChat?:  number;
  isTrainer?:   boolean;
  traineeCount?: number;
  assignmentCount?: number;
  tab:          string;
  setTab:       (t: string) => void;
  onLogoClick?: () => void;
  /** The pages to show (usageProfile.ts); sections left empty are dropped. */
  pages?:       Set<string>;
}

export default function AppHeader({ active, elapsed, wStep, historyCount, prCount, coachCount, buddyCount, unreadNotif, unreadChat = 0, isTrainer = false, traineeCount = 0, assignmentCount = 0, tab, setTab, onLogoClick, pages }: Props) {
  const [lastPage, setLastPage] = useState<Record<string, string>>({});
  const t = useTxt();
  const workoutLabel = active ? "ACTIVE" : wStep > 0 ? "BUILD" : "WORKOUT";

  // Every page, by key. Pages are grouped into five sections (below); the
  // sections are the top-level navigation, the pages the strip under it.
  const tabs = [
    { key: "workout",       Icon: Zap,           label: workoutLabel,  badge: null },
    { key: "exercises",     Icon: Wrench,        label: "EXERCISES",   badge: null },
    { key: "history",       Icon: ClipboardList, label: "HISTORY",     badge: historyCount || null },
    { key: "prs",           Icon: Trophy,        label: "PRs",         badge: prCount || null },
    { key: "coach",         Icon: Brain,         label: "TRENDS",      badge: coachCount || null },
    { key: "health",        Icon: Heart,         label: "BODY",        badge: null },
    { key: "buddies",       Icon: Users,         label: "BUDDIES",     badge: buddyCount || null },
    { key: "chat",          Icon: MessagesSquare, label: "CHAT",       badge: unreadChat || null },
    { key: "notifications", Icon: Bell,          label: "ALERTS",      badge: unreadNotif || null },
    { key: "regimes",       Icon: Calendar,      label: "REGIMES",     badge: assignmentCount || null },
    { key: "coaching",      Icon: GraduationCap, label: "COACHING",    badge: null },
    { key: "trainees",      Icon: GraduationCap, label: "TRAINEES",    badge: traineeCount || null },
    { key: "profile",       Icon: User,          label: "ME",          badge: null },
  ];

  type PageItem = { key: string };
  type Section = { id: string; label: string; Icon: typeof Zap; items: PageItem[] };

  const planItems: PageItem[] = [{ key: "regimes" }, { key: "coaching" }];
  if (isTrainer) planItems.push({ key: "trainees" });
  // Only the pages the user's answers call for (Workout and Me always stay);
  // a section with none of them left is not shown at all.
  const shown = (items: PageItem[]) => (pages ? items.filter(i => pages.has(i.key)) : items);
  const sections: Section[] = ([
    { id: "train",    label: "Train",    Icon: Zap,        items: [{ key: "workout" }, { key: "exercises" }] },
    { id: "progress", label: "Progress", Icon: TrendingUp, items: [{ key: "history" }, { key: "prs" }, { key: "coach" }, { key: "health" }] },
    { id: "social",   label: "Social",   Icon: Users,      items: [{ key: "buddies" }, { key: "chat" }, { key: "notifications" }] },
    { id: "plans",    label: "Plans",    Icon: Calendar,   items: planItems },
    { id: "me",       label: "Me",       Icon: User,       items: [{ key: "profile" }] },
  ] as Section[])
    .map(g => ({ ...g, items: shown(g.items) }))
    .filter(g => g.items.length > 0);

  const tabByKey = Object.fromEntries(tabs.map(t => [t.key, t]));

  const groupForTab = (key: string) => sections.find(g => g.items.some(i => i.key === key))?.id;
  const currentSection = sections.find(g => g.id === groupForTab(tab)) ?? sections[0];
  // A section's badge counts only what is waiting for the user (unread chat
  // and alerts, a regime assigned to them), not how many
  // workouts or PRs a page holds.
  const WAITING = new Set(["chat", "notifications", "regimes"]);
  const badgeOf = (g: Section) =>
    g.items.reduce((sum, i) => sum + (WAITING.has(i.key) && typeof tabByKey[i.key]?.badge === "number" ? (tabByKey[i.key].badge as number) : 0), 0);
  // A section reopens on the page it was last left on.
  const openSection = (g: Section) => {
    if (g.id === currentSection.id) return;
    setTab(lastPage[g.id] && g.items.some(i => i.key === lastPage[g.id]) ? lastPage[g.id] : g.items[0].key);
  };
  // The page strip steps aside while a workout is being built or logged; the
  // dock only while it is being built, so a lift can be checked in History or
  // a buddy answered mid-workout (the header timer shows it is still running).
  const focused = tab === "workout" && (active || wStep > 0);
  const building = tab === "workout" && !active && wStep > 0;

  const showStrip = currentSection.items.length > 1 && !focused;
  const activeTabDef = tabs.find(t => t.key === tab);
  const sectionId = currentSection.id;
  useEffect(() => {
    setLastPage(prev => (prev[sectionId] === tab ? prev : { ...prev, [sectionId]: tab }));
  }, [sectionId, tab]);

  return (
    <>
      <div className={`hdr${showStrip ? " hdr-strip" : ""}`}>
        <div className="hdr-top">
          <button
            type="button"
            className="hdr-brand"
            onClick={onLogoClick}
            aria-label="Go to start"
          >
            <div className="logo-img" role="img" aria-label="Gamgee" />
            <div className="hdr-brand-text">
              <div className="logo-name">GAMGEE</div>
              <div className="logo-sub">{t("Workout Tracker", "Built Different (Allegedly)", "She's Built That Way")}</div>
            </div>
          </button>
          {/* The page name only where the page strip does not already say it. */}
          {active
            ? <div className="timer-pill"><Zap size={14} />{fmtClock(elapsed)}</div>
            : !showStrip && <div className="hdr-current-tab">{activeTabDef?.label}</div>
          }
        </div>
        <div className="tabs">
          {sections.map(g => {
            const badge = badgeOf(g);
            return (
              <button key={g.id} className={`tab ${currentSection.id === g.id ? "active" : ""}`} onClick={() => openSection(g)}>
                <g.Icon size={12} />
                <span className="tab-label">{g.label.toUpperCase()}</span>
                {badge > 0 && currentSection.id !== g.id && <span className="tab-badge">{badge}</span>}
              </button>
            );
          })}
        </div>
        {showStrip && (
          <div className="subtabs" role="tablist" aria-label={currentSection.label}>
            {currentSection.items.map(i => {
              const def = tabByKey[i.key];
              if (!def) return null;
              return (
                <button key={i.key} role="tab" aria-selected={tab === i.key} className={`subtab${tab === i.key ? " active" : ""}`} onClick={() => setTab(i.key)}>
                  {def.label}
                  {def.badge !== null && <span className="tab-badge">{def.badge}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Phones: the five sections in a dock floating at the bottom, under the
          thumb. One solid pill glides to the picked section, stretching as it
          goes; the mark it lands on jumps. It is the only navigation on a
          phone (no menu repeats it), and steps aside while a workout is being
          built. */}
      {!building && (
        <nav className="bottom-nav" aria-label="Sections">
          <div className="bottom-nav-track" style={{ ["--tab" as string]: sections.findIndex(g => g.id === currentSection.id), ["--tabs" as string]: sections.length }}>
            <span className="bottom-nav-glider" aria-hidden="true">
              {/* Keyed, so the pill stretches as it sets off each time. */}
              <span key={currentSection.id} className="bottom-nav-glider-pill" />
            </span>
            {sections.map(g => {
              const badge = badgeOf(g);
              const on = currentSection.id === g.id;
              return (
                <button key={g.id} type="button" className={`bottom-nav-btn${on ? " active" : ""}`} aria-current={on ? "page" : undefined} onClick={() => openSection(g)}>
                  <span className="bottom-nav-icon">
                    {/* Keyed, so the mark jumps each time its tab is picked. */}
                    <g.Icon key={on ? "on" : "off"} size={26} strokeWidth={on ? 2.6 : 2} className="bottom-nav-mark" />
                    {badge > 0 && !on && <span className="bottom-nav-badge">{badge > 99 ? "99+" : badge}</span>}
                  </span>
                  <span className="bottom-nav-label">{g.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
