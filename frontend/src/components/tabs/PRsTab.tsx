import { useMemo, useState } from "react";
import { Trash2, Trophy, Medal, Sparkles, Heart, CalendarDays } from "lucide-react";
import type { PRDict, PersonalRecord } from "../../types";
import { fmtDate, orm1 } from "../../utils";
import { ALL_EX, EM } from "../../data/exercises";
import { MI } from "../../data/muscles";
import { useTxt } from "../../context/ToneContext";
import "../../simple.css";
import "../../pages/history.css";

interface Props {
  prs: PRDict;
  bodyweight: number | null;
  onDelete: (exerciseId: string) => void;
}

type Sort = "new" | "strong";
const NEW_DAYS = 7;

/** The muscle group a lift mostly trains, for the filter chips. */
const groupOf = (id: string): string => {
  const first = EM[id]?.p[0];
  return (first && MI[first]?.g) || "Other";
};

export default function PRsTab({ prs, bodyweight, onDelete }: Props) {
  const t = useTxt();
  const [group, setGroup] = useState<string>("all");
  const [sort,  setSort]  = useState<Sort>("new");

  const { lifts, cardio, groups, medals } = useMemo(() => {
    const all = Object.entries(prs).map(([id, pr]) => {
      const isAssisted = !!ALL_EX.find(e => e.id === id)?.is_assisted;
      // Estimated one-rep max: what the medals and "Strongest" go by. Assisted
      // lifts log an offset from bodyweight, so they have none.
      const est = !pr.isCardio && !isAssisted && pr.weight > 0
        ? (pr.reps > 0 ? orm1(pr.weight, pr.reps) : pr.weight)
        : 0;
      return { id, pr, isAssisted, est, group: groupOf(id), time: new Date(pr.date).getTime() };
    });
    const lifts  = all.filter(e => !e.pr.isCardio);
    const cardio = all.filter(e => e.pr.isCardio).sort((a, b) => b.time - a.time);
    const counts: Record<string, number> = {};
    lifts.forEach(e => { counts[e.group] = (counts[e.group] || 0) + 1; });
    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const medals: Record<string, number> = {};
    [...lifts].filter(e => e.est > 0).sort((a, b) => b.est - a.est).slice(0, 3)
      .forEach((e, i) => { medals[e.id] = i + 1; });
    return { lifts, cardio, groups, medals };
  }, [prs]);

  if (Object.keys(prs).length === 0) {
    return (
      <div className="tab-anim">
        <div className="empty"><div className="empty-icon"><Trophy size={40} /></div><div className="empty-label">{t("No PRs yet", "No PRs yet. Do you even lift, bro?", "No PRs yet. Your first one is loading, bestie.")}</div></div>
      </div>
    );
  }

  // A filter whose last record was deleted falls back to everything.
  const active = group !== "all" && !groups.some(([g]) => g === group) ? "all" : group;
  const shown = lifts
    .filter(e => active === "all" || e.group === active)
    .sort((a, b) => sort === "strong" ? (b.est - a.est) || (b.time - a.time) : b.time - a.time);

  const n = Object.keys(prs).length;
  const fresh = (pr: PersonalRecord) => Date.now() - new Date(pr.date).getTime() < NEW_DAYS * 86400000;

  const card = (e: (typeof lifts)[number]) => {
    const { id, pr, isAssisted } = e;
    const effective = isAssisted && bodyweight != null
      ? Math.round((bodyweight + pr.weight) * 10) / 10
      : null;
    const headlineVal = effective != null
      ? effective
      : isAssisted ? Math.abs(pr.weight) : pr.weight;
    const headlineUnit = pr.isCardio ? "min"
      : isAssisted
        ? (effective != null ? "kg" : pr.weight === 0 ? "kg at BW" : "kg below BW")
        : "kg";
    const rank = medals[id];
    return (
      <div key={id} className={`hx-pr${rank ? ` rank${rank}` : ""}`}>
        <button
          type="button"
          className="hx-pr-del"
          onClick={() => onDelete(id)}
          aria-label={`Delete PR for ${pr.name}`}
        >
          <Trash2 size={17} />
        </button>
        <div className="hx-pr-top">
          {rank && (
            <span className={`hx-medal rank${rank}`} title={`Number ${rank} by estimated one-rep max`}>
              <Medal size={14} />{rank}<span className="hx-sr"> by estimated one-rep max</span>
            </span>
          )}
          {fresh(pr) && <span className="hx-new"><Sparkles size={12} />New</span>}
        </div>
        <div className="hx-pr-name">{pr.name}</div>
        <div className="hx-pr-val">
          {headlineVal}<span className="hx-pr-unit">{headlineUnit}</span>
        </div>
        {pr.reps > 0 && (
          <div className="hx-pr-line">{pr.isCardio ? `${pr.reps} km` : `× ${pr.reps} ${pr.reps === 1 ? "rep" : "reps"}`}</div>
        )}
        {isAssisted && effective != null && pr.weight !== 0 && (
          <div className="hx-pr-soft">BW − {Math.abs(pr.weight)}kg</div>
        )}
        {!pr.isCardio && !isAssisted && pr.weight > 0 && pr.reps > 0 && (
          <div className="hx-pr-soft">est. 1RM ~{orm1(pr.weight, pr.reps)}kg</div>
        )}
        <div className="hx-pr-date"><CalendarDays size={13} />{fmtDate(pr.date)}</div>
      </div>
    );
  };

  return (
    <div className="tab-anim hx-page">
      <div className="hx-pr-head">
        <span className="hx-pr-cup"><Trophy size={26} /></span>
        <div>
          <div className="hx-pr-count">{t(`${n} Personal Record${n !== 1 ? "s" : ""}`, `${n} ${n !== 1 ? "Pages" : "Page"} of the Swoly Bible`, `${n} Iconic ${n !== 1 ? "Moments" : "Moment"}`)}</div>
          {Object.keys(medals).length > 0 && (
            <div className="hx-pr-sub">Medals go to your three strongest lifts.</div>
          )}
        </div>
      </div>

      {lifts.length > 0 && (
        <>
          {groups.length > 1 && (
            <div className="hx-filter" role="group" aria-label="Show records for">
              <button type="button" className={`chip-btn${active === "all" ? " on" : ""}`} aria-pressed={active === "all"} onClick={() => setGroup("all")}>
                All <b>{lifts.length}</b>
              </button>
              {groups.map(([g, count]) => (
                <button key={g} type="button" className={`chip-btn${active === g ? " on" : ""}`} aria-pressed={active === g} onClick={() => setGroup(g)}>
                  {g} <b>{count}</b>
                </button>
              ))}
            </div>
          )}
          {lifts.length > 1 && (
            <div className="seg" role="group" aria-label="Order">
              <button type="button" className={`seg-btn${sort === "new" ? " on" : ""}`} aria-pressed={sort === "new"} onClick={() => setSort("new")}>Newest</button>
              <button type="button" className={`seg-btn${sort === "strong" ? " on" : ""}`} aria-pressed={sort === "strong"} onClick={() => setSort("strong")}>Strongest</button>
            </div>
          )}
          <div className="hx-shelf">{shown.map(card)}</div>
        </>
      )}

      {cardio.length > 0 && (
        <>
          <h3 className="hx-section-title"><Heart size={14} /> Cardio bests</h3>
          <div className="hx-shelf">{cardio.map(card)}</div>
        </>
      )}
    </div>
  );
}
