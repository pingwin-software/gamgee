import { Calendar, Check, Fingerprint, KeyRound, Menu, Play, TrendingUp, User, Users, Zap } from "lucide-react";
import type { WhatsNewId } from "./whatsNew";

/**
 * The moving picture for each What's new entry: a small piece of Gamgee
 * playing out on a loop (`wn-*` keyframes in WhatsNew.css). The base styles
 * are the end state, because under reduced motion the loops stop.
 */
export default function WhatsNewArt({ demo }: { demo: WhatsNewId }) {
  return (
    <div className="wn-art" aria-hidden="true">
      {demo === "oneWay" && <OneWayArt />}
      {demo === "yourApp" && <YourAppArt />}
      {demo === "freshPages" && <FreshPagesArt />}
      {demo === "progression" && <ProgressionArt />}
      {demo === "quickStart" && <QuickStartArt />}
      {demo === "passkeys" && <PasskeysArt />}
    </div>
  );
}

/** The header's menu button folds away; the bottom bar is the way around. */
function OneWayArt() {
  return (
    <div className="wn-ow">
      <div className="wn-ow-hdr">
        <span className="wn-ow-logo" />
        <span className="wn-ow-menu"><Menu size={16} /></span>
      </div>
      <div className="wn-ya-nav wn-ow-nav">
        <Zap size={14} />
        <TrendingUp size={14} className="on" />
        <Users size={14} />
        <Calendar size={14} />
        <User size={14} />
      </div>
    </div>
  );
}

/** An answer ticked, then the bottom bar trims itself to what was picked. */
function YourAppArt() {
  return (
    <div className="wn-ya">
      <div className="wn-ya-card">
        <Zap size={14} /><b>Impromptu</b>
        <span className="wn-ya-tick"><Check size={11} strokeWidth={3} /></span>
      </div>
      <div className="wn-ya-nav">
        <Zap size={14} className="on" />
        <TrendingUp size={14} />
        <Users size={14} className="wn-ya-gone" />
        <Calendar size={14} className="wn-ya-gone" />
        <User size={14} />
      </div>
    </div>
  );
}

/** A password field ignored, the passkey button pressed, a fingerprint, done. */
function PasskeysArt() {
  return (
    <div className="wn-pk">
      <div className="wn-pk-field">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="wn-pk-btn">
        <KeyRound size={13} /> Use a passkey
      </div>
      <div className="wn-pk-scan">
        <Fingerprint size={34} className="wn-pk-print" />
        <span className="wn-pk-ok"><Check size={20} strokeWidth={3} /></span>
      </div>
    </div>
  );
}

/** The pace switch sliding from Standard to Fast, and the suggestion changing with it. */
function ProgressionArt() {
  return (
    <div className="wn-pg">
      <div className="wn-pg-seg">
        <span className="wn-pg-thumb" />
        <span>Steady</span><span>Standard</span><span>Fast</span>
      </div>
      <div className="wn-pg-next">
        <span className="wn-pg-label">Next</span>
        <span className="wn-pg-vals">
          <b className="wn-pg-a">60 kg × 10</b>
          <b className="wn-pg-b">62.5 kg × 8</b>
        </span>
      </div>
    </div>
  );
}

/** One tap on the start card, effort bars filling, the bottom bar underneath. */
function QuickStartArt() {
  return (
    <div className="wn-qs">
      <div className="wn-qs-card">
        <span className="wn-qs-text"><i>Today's plan</i><b>Push Day</b></span>
        <span className="wn-qs-go"><Play size={13} fill="currentColor" /></span>
      </div>
      <div className="wn-qs-bars">
        {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ ["--i" as string]: i, height: `${30 + i * 7}%` }} />)}
      </div>
      <div className="wn-qs-nav">
        <Zap size={14} className="on" /><TrendingUp size={14} /><Users size={14} /><Calendar size={14} /><User size={14} />
      </div>
    </div>
  );
}

/** A heat map filling in day by day, and a podium rising under it. */
function FreshPagesArt() {
  const filled = new Set([2, 5, 8, 9, 11, 13, 16, 18, 19, 20]);
  return (
    <div className="wn-fp">
      <div className="wn-fp-grid">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className={filled.has(i) ? "on" : undefined} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="wn-fp-podium"><span /><span /><span /></div>
    </div>
  );
}
