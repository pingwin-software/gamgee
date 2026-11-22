import { useEffect, useState, type ReactNode } from "react";
import { Zap, ClipboardList, Trophy, Heart, Brain, User, LogOut, Menu, X, Shield, Wrench, Users, Bell, MessageSquare, ChevronDown, HelpCircle, GraduationCap, MessagesSquare, Calendar, Settings, Sparkles, TrendingUp } from "lucide-react";
import "../simple.css";
import { fmtClock } from "../utils";
import { useTxt } from "../context/ToneContext";
import { useOnboarding } from "../context/OnboardingContext";

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
  onLogout:     () => void;
  onLogoClick?: () => void;
  isAdmin?:     boolean;
  notifBell?:   ReactNode;
  onOpenFeedback?: () => void;
  onOpenWhatsNew?: () => void;
}

export default function AppHeader({ active, elapsed, wStep, historyCount, prCount, coachCount, buddyCount, unreadNotif, unreadChat = 0, isTrainer = false, traineeCount = 0, assignmentCount = 0, tab, setTab, onLogout, onLogoClick, isAdmin, notifBell, onOpenFeedback, onOpenWhatsNew }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [lastPage, setLastPage] = useState<Record<string, string>>({});
  const t = useTxt();
  const { openWelcome } = useOnboarding();
  const workoutLabel = active ? "ACTIVE" : wStep > 0 ? "BUILD" : "WORKOUT";

  // Help/tour walks through the workout-wizard flow, so land the user on the
  // workout home screen first — otherwise the tour overlays don't match what's
  // visible behind them.
  const openHelp = () => {
    onLogoClick?.();
    openWelcome();
  };

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

  type MenuItem = { key: string };
  type MenuGroup = { id: string; label: string; Icon: typeof Zap; items: MenuItem[] };

  const planItems: MenuItem[] = [{ key: "regimes" }, { key: "coaching" }];
  if (isTrainer) planItems.push({ key: "trainees" });
  const sections: MenuGroup[] = [
    { id: "train",    label: "Train",    Icon: Zap,        items: [{ key: "workout" }, { key: "exercises" }] },
    { id: "progress", label: "Progress", Icon: TrendingUp, items: [{ key: "history" }, { key: "prs" }, { key: "coach" }, { key: "health" }] },
    { id: "social",   label: "Social",   Icon: Users,      items: [{ key: "buddies" }, { key: "chat" }, { key: "notifications" }] },
    { id: "plans",    label: "Plans",    Icon: Calendar,   items: planItems },
    { id: "me",       label: "Me",       Icon: User,       items: [{ key: "profile" }] },
  ];
  const menuStructure = sections;
  const isGroup = (_e: MenuGroup): _e is MenuGroup => true;

  const tabByKey = Object.fromEntries(tabs.map(t => [t.key, t]));

  // Auto-expand whichever group contains the active tab so the user can see where they are.
  const groupForTab = (key: string) => sections.find(g => g.items.some(i => i.key === key))?.id;
  const currentSection = sections.find(g => g.id === groupForTab(tab)) ?? sections[0];
  // A section's badge counts only what is waiting for the user (unread chat
  // and alerts, a regime assigned to them), not how many
  // workouts or PRs a page holds.
  const WAITING = new Set(["chat", "notifications", "regimes"]);
  const badgeOf = (g: MenuGroup) =>
    g.items.reduce((sum, i) => sum + (WAITING.has(i.key) && typeof tabByKey[i.key]?.badge === "number" ? (tabByKey[i.key].badge as number) : 0), 0);
  // A section reopens on the page it was last left on.
  const openSection = (g: MenuGroup) => {
    if (g.id === currentSection.id) return;
    setTab(lastPage[g.id] && g.items.some(i => i.key === lastPage[g.id]) ? lastPage[g.id] : g.items[0].key);
  };
  // The page strip steps aside while a workout is being built or logged.
  const focused = tab === "workout" && (active || wStep > 0);

  const handleTabSelect = (key: string) => {
    setTab(key);
    setMenuOpen(false);
  };

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !(prev[id] ?? id === groupForTab(tab)) }));

  const isGroupOpen = (id: string) => openGroups[id] ?? id === groupForTab(tab);

  const renderMenuItem = (key: string, nested = false) => {
    const def = tabByKey[key];
    if (!def) return null;
    const { Icon, label, badge } = def;
    return (
      <button
        key={key}
        className={`mobile-nav-item${nested ? " mobile-nav-item-nested" : ""}${tab === key ? " active" : ""}`}
        onClick={() => handleTabSelect(key)}
      >
        <Icon size={18} />
        <span>{label}</span>
        {badge !== null && <span className="tab-badge">{badge}</span>}
      </button>
    );
  };

  const activeTabDef = tabs.find(t => t.key === tab);
  const sectionId = currentSection.id;
  useEffect(() => {
    setLastPage(prev => (prev[sectionId] === tab ? prev : { ...prev, [sectionId]: tab }));
  }, [sectionId, tab]);

  return (
    <>
      <div className="hdr">
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
          {active
            ? <div className="timer-pill"><Zap size={14} />{fmtClock(elapsed)}</div>
            : <div className="hdr-current-tab">{activeTabDef?.label}</div>
          }
          <div className="hdr-actions">
            {notifBell}
            <button
              className="logout-btn hdr-settings-btn"
              onClick={() => setTab("settings")}
              title={t("Settings", "Settings", "Settings")}
              aria-label="Settings"
            >
              <Settings size={15} />
              <span className="logout-label">Settings</span>
            </button>
            <button className="logout-btn hdr-help-btn" onClick={openHelp} title={t("Help & tour", "Help & tour", "Help & tour")}>
              <HelpCircle size={15} />
              <span className="logout-label">Help</span>
            </button>
            {isAdmin && (
              <a href="/admin" className="logout-btn" title="Admin panel" style={{ textDecoration: "none" }}>
                <Shield size={15} />
                <span className="logout-label">Admin</span>
              </a>
            )}
            <button className="logout-btn" onClick={onLogout} title="Logout">
              <LogOut size={15} />
              <span className="logout-label">Logout</span>
            </button>
            <button
              className={`hamburger-btn${menuOpen ? " open" : ""}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
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
        {currentSection.items.length > 1 && !focused && (
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
        {menuOpen && (
          <nav className="mobile-nav">
            {menuStructure.map(entry => {
              if (!isGroup(entry)) return null;
              if (entry.items.length === 1) return renderMenuItem(entry.items[0].key);
              const open = isGroupOpen(entry.id);
              const groupBadge = badgeOf(entry);
              return (
                <div key={entry.id} className={`mobile-nav-group${open ? " open" : ""}`}>
                  <button
                    className="mobile-nav-item mobile-nav-group-header"
                    onClick={() => toggleGroup(entry.id)}
                    aria-expanded={open}
                  >
                    <span className="mobile-nav-group-label">{entry.label}</span>
                    {groupBadge > 0 && !open && <span className="tab-badge">{groupBadge}</span>}
                    <ChevronDown size={18} className="mobile-nav-chevron" />
                  </button>
                  {open && (
                    <div className="mobile-nav-group-items">
                      {entry.items.map(i => renderMenuItem(i.key, true))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mobile-nav-divider" />
            <button
              className="mobile-nav-item"
              onClick={() => { setMenuOpen(false); openHelp(); }}
            >
              <HelpCircle size={18} />
              <span>Help &amp; tour</span>
            </button>
            {onOpenWhatsNew && (
              <button
                className="mobile-nav-item"
                onClick={() => { setMenuOpen(false); onOpenWhatsNew(); }}
              >
                <Sparkles size={18} />
                <span>What's new</span>
              </button>
            )}
            {onOpenFeedback && (
              <button
                className="mobile-nav-item"
                onClick={() => { setMenuOpen(false); onOpenFeedback(); }}
              >
                <MessageSquare size={18} />
                <span>Send Feedback</span>
              </button>
            )}
            {isAdmin && (
              <a
                href="/admin"
                className="mobile-nav-item mobile-nav-admin"
                onClick={() => setMenuOpen(false)}
                style={{ textDecoration: "none" }}
              >
                <Shield size={18} />
                <span>Admin</span>
              </a>
            )}
            <button
              className="mobile-nav-item mobile-nav-logout"
              onClick={() => { setMenuOpen(false); onLogout(); }}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </nav>
        )}
      </div>
      {menuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)} />
      )}
      {/* Phones: the five sections along the bottom, under the thumb. It
          steps aside while a workout is being built or logged. */}
      {!focused && (
        <nav className="bottom-nav" aria-label="Sections">
          {sections.map(g => {
            const badge = badgeOf(g);
            const on = currentSection.id === g.id;
            return (
              <button key={g.id} type="button" className={`bottom-nav-btn${on ? " active" : ""}`} aria-current={on ? "page" : undefined} onClick={() => openSection(g)}>
                <span className="bottom-nav-icon">
                  <g.Icon size={20} />
                  {badge > 0 && !on && <span className="bottom-nav-badge">{badge > 99 ? "99+" : badge}</span>}
                </span>
                <span className="bottom-nav-label">{g.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}
