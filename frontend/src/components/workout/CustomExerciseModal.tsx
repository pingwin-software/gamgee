import { useMemo, useState } from "react";
import type { CustomExerciseDef, ExerciseType } from "../../types";
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

  // Build the muscle list grouped by anatomical region
  const groupedMuscles = useMemo(() => {
    const groups: Record<string, { mid: string; label: string }[]> = {};
    Object.entries(MI).forEach(([mid, info]) => {
      if (!groups[info.g]) groups[info.g] = [];
      groups[info.g].push({ mid, label: info.n });
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
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
            Primary{primary.size > 0 ? ` (${primary.size})` : ""}
          </button>
          <button type="button" className={`seg-btn${marking === "secondary" ? " on" : ""}`} aria-pressed={marking === "secondary"} onClick={() => setMarking("secondary")}>
            Secondary{secondary.size > 0 ? ` (${secondary.size})` : ""}
          </button>
        </div>
        <div className="cx-muscle-section">
          {groupedMuscles.map(([group, muscles]) => (
            <div key={group} className="cx-muscle-group">
              <div className="cx-muscle-group-label">{group}</div>
              <div className="cx-muscle-chips">
                {muscles.map(m => (
                  <button
                    key={m.mid}
                    type="button"
                    className={`cx-muscle-chip${primary.has(m.mid) ? " primary" : secondary.has(m.mid) ? " secondary" : ""}`}
                    aria-pressed={primary.has(m.mid) || secondary.has(m.mid)}
                    onClick={() => toggleMuscle(m.mid)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

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
