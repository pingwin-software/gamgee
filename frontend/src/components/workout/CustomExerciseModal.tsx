import { useMemo, useState } from "react";
import { X } from "../../icons";
import type { ActiveMuscles, CustomExerciseDef, ExerciseType } from "../../types";
import BodyMap from "../BodyMap";
import { MI } from "../../data/muscles";
import {
  EX,
  CUSTOM_CATEGORY,
  makeCustomExerciseId,
  saveCustomExercise,
} from "../../data/exercises";
import { useTxt } from "../../context/ToneContext";

interface Props {
  onClose:   () => void;
  onCreated: (def: CustomExerciseDef) => void;
  editing?:  CustomExerciseDef;
}

const TYPE_OPTIONS: { value: ExerciseType; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "timed",    label: "Timed"    },
  { value: "cardio",   label: "Cardio"   },
];

export default function CustomExerciseModal({ onClose, onCreated, editing }: Props) {
  const t = useTxt();

  // Muscles by group (Back, Core, Quads...): tapping the drawing opens one.
  const musclesByGroup = useMemo(() => {
    const groups: Record<string, { mid: string; label: string }[]> = {};
    Object.entries(MI).forEach(([mid, info]) => {
      (groups[info.g] ??= []).push({ mid, label: info.n });
    });
    return groups;
  }, []);

  // Categories that already exist in the catalog, plus the dedicated "Custom" bucket
  const categoryOptions = useMemo(() => {
    const cats = Object.keys(EX).filter(c => c !== CUSTOM_CATEGORY);
    return [CUSTOM_CATEGORY, ...cats];
  }, []);

  const [name, setName]                 = useState(editing?.name ?? "");
  const [type, setType]                 = useState<ExerciseType>(editing?.type ?? "strength");
  const [cat, setCat]                   = useState<string>(editing?.cat ?? CUSTOM_CATEGORY);
  const [primary, setPrimary]           = useState<Set<string>>(new Set(editing?.primary ?? []));
  const [secondary, setSecondary]       = useState<Set<string>>(new Set(editing?.secondary ?? []));
  const [instructions, setInstructions] = useState(editing?.instructions ?? "");

  // One list of muscles; the switch above it says what a tap marks. A muscle
  // is primary or secondary, never both, so marking it one clears the other.
  const [marking, setMarking] = useState<"primary" | "secondary">("primary");
  // The group tapped on the drawing: lit up there, its muscles listed below.
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const first = editing?.primary?.[0];
    return first ? MI[first]?.g ?? null : null;
  });
  const groupLit: ActiveMuscles | undefined = openGroup
    ? Object.fromEntries((musclesByGroup[openGroup] ?? []).map(m => [m.mid, "primary" as const]))
    : undefined;
  const picked: ActiveMuscles = {
    ...Object.fromEntries([...secondary].map(m => [m, "secondary" as const])),
    ...Object.fromEntries([...primary].map(m => [m, "primary" as const])),
  };
  const unpick = (mid: string) => {
    if (primary.has(mid)) { const n = new Set(primary); n.delete(mid); setPrimary(n); }
    if (secondary.has(mid)) { const n = new Set(secondary); n.delete(mid); setSecondary(n); }
  };
  const toggleMuscle = (mid: string) => {
    const [mine, setMine, other, setOther] = marking === "primary"
      ? [primary, setPrimary, secondary, setSecondary]
      : [secondary, setSecondary, primary, setPrimary];
    const next = new Set(mine);
    if (next.has(mid)) next.delete(mid);
    else {
      next.add(mid);
      if (other.has(mid)) { const o = new Set(other); o.delete(mid); setOther(o); }
    }
    setMine(next);
  };

  const canSave = name.trim().length > 0 && primary.size > 0;

  const handleSave = () => {
    if (!canSave) return;
    const trimmedInstr = instructions.trim();
    const def: CustomExerciseDef = {
      id: editing?.id ?? makeCustomExerciseId(name),
      name: name.trim(),
      type,
      cat,
      primary: Array.from(primary),
      secondary: Array.from(secondary),
      ...(trimmedInstr ? { instructions: trimmedInstr } : {}),
    };
    saveCustomExercise(def);
    onCreated(def);
    onClose();
  };

  return (
    <div className="cf-overlay" onClick={onClose}>
      <div className="cf-modal cx-modal" onClick={e => e.stopPropagation()}>
        <div className="cf-modal-title">
          {editing
            ? t("Edit Custom Exercise", "Tune Your Lift", "Tune Your Move")
            : t("New Custom Exercise", "Roll-Your-Own Lift", "Cook Your Own Move")}
        </div>

        <input
          className="cf-modal-input"
          placeholder={t("Name (e.g. Cable Crossover)", "Name it, bro", "Name it, bestie")}
          value={name}
          maxLength={48}
          autoFocus
          onChange={e => setName(e.target.value)}
        />

        <div className="cf-modal-icon-label">{t("Type", "Type")}</div>
        <div className="cx-type-row">
          {TYPE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              className={`cx-type-btn${type === o.value ? " selected" : ""}`}
              onClick={() => setType(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="cf-modal-icon-label">{t("Category", "Category")}</div>
        <select
          className="cf-modal-input cx-cat-select"
          value={cat}
          onChange={e => setCat(e.target.value)}
        >
          {categoryOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="cf-modal-icon-label">
          {t("Muscles", "Muscles")}
          <span className="cx-hint">{t("one primary at least", "pick one+ primary")}</span>
        </div>
        <div className="seg cx-mark-seg" role="group" aria-label="A tap marks">
          <button type="button" className={`seg-btn${marking === "primary" ? " on" : ""}`} aria-pressed={marking === "primary"} onClick={() => setMarking("primary")}>
            <span className="cx-dot primary" aria-hidden="true" />Primary{primary.size > 0 ? ` (${primary.size})` : ""}
          </button>
          <button type="button" className={`seg-btn${marking === "secondary" ? " on" : ""}`} aria-pressed={marking === "secondary"} onClick={() => setMarking("secondary")}>
            <span className="cx-dot secondary" aria-hidden="true" />Secondary{secondary.size > 0 ? ` (${secondary.size})` : ""}
          </button>
        </div>
        {/* Tap the drawing to pick a group; then the muscles in it, below. */}
        <div className="cx-map-card">
          <div className="cx-map">
            <BodyMap
              active={picked}
              focusMuscles={groupLit}
              scale={1.55}
              onPickMuscle={mid => setOpenGroup(g => (g === MI[mid]?.g ? null : MI[mid]?.g ?? null))}
            />
          </div>
          <div className="cx-legend" aria-hidden="true">
            <span><span className="cx-dot primary" />Primary</span>
            <span><span className="cx-dot secondary" />Secondary</span>
            <span><span className="cx-dot group" />Group</span>
          </div>
        </div>
        {openGroup ? (
          <div className="cx-group-panel" key={openGroup}>
            <div className="cx-group-head">
              <span className="cx-group-name">{openGroup}</span>
              <span className="cx-group-sub">Tap to mark {marking}</span>
              <button type="button" className="cx-group-close" onClick={() => setOpenGroup(null)} aria-label="Close group">
                <X size={16} />
              </button>
            </div>
            <div className="cx-muscle-chips">
              {(musclesByGroup[openGroup] ?? []).map(m => {
                const state = primary.has(m.mid) ? "primary" : secondary.has(m.mid) ? "secondary" : "";
                return (
                  <button
                    key={m.mid}
                    type="button"
                    className={`cx-muscle-chip${state ? ` ${state}` : ""}`}
                    aria-pressed={!!state}
                    onClick={() => toggleMuscle(m.mid)}
                  >
                    <span className={`cx-dot${state ? ` ${state}` : " cx-dot-off"}`} aria-hidden="true" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="cx-map-hint">Tap the body where this lift works.</p>
        )}
        {primary.size + secondary.size > 0 && (
          <div className="cx-picked-wrap">
            <div className="cx-picked-label">Picked</div>
            <div className="cx-picked" aria-label="Picked muscles">
              {[...primary, ...secondary].map(mid => (
                <button
                  key={mid}
                  type="button"
                  className={`cx-muscle-chip ${primary.has(mid) ? "primary" : "secondary"}`}
                  onClick={() => unpick(mid)}
                  aria-label={`Remove ${MI[mid]?.n ?? mid}`}
                >
                  {MI[mid]?.n ?? mid} <X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="cf-modal-icon-label" style={{ marginTop: 12 }}>
          {t("Instructions", "How to do it")}
          <span className="cx-hint">{t("optional", "optional")}</span>
        </div>
        <textarea
          className="cf-modal-input cx-instructions"
          placeholder={t("Cue your form, setup, and tempo…", "Tell future-you how to nail this lift…", "Tell future-you how to slay this move…")}
          value={instructions}
          maxLength={2000}
          rows={4}
          onChange={e => setInstructions(e.target.value)}
        />

        <div className="cf-modal-actions" style={{ marginTop: 18 }}>
          <button className="cf-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="cf-btn-save" onClick={handleSave} disabled={!canSave}>
            {editing ? t("Save", "Lock It In", "Lock It In") : t("Create", "Make It", "Make It Happen")}
          </button>
        </div>
      </div>
    </div>
  );
}
