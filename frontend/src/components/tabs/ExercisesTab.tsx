import { useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, BookOpen, ChevronDown, Dumbbell, Timer, HeartPulse, Sparkles,
} from "../../icons";
import type { CustomExerciseDef, ExerciseType } from "../../types";
import { MI } from "../../data/muscles";
import { getCustomExercises, deleteCustomExercise } from "../../data/exercises";
import CustomExerciseModal from "../workout/CustomExerciseModal";
import { useTxt } from "../../context/ToneContext";
import "../../pages/chat.css";

const TYPE_ICON: Record<ExerciseType, typeof Dumbbell> = {
  strength: Dumbbell,
  timed: Timer,
  cardio: HeartPulse,
};

/** How long a first tap on Delete stays armed before it goes back. */
const CONFIRM_MS = 4000;

export default function ExercisesTab() {
  const t = useTxt();
  const [items,    setItems]    = useState<CustomExerciseDef[]>(() => getCustomExercises());
  const [creating, setCreating] = useState(false);
  const [editing,  setEditing]  = useState<CustomExerciseDef | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Delete takes two taps: the first arms the button, the second deletes.
  const [armed,    setArmed]    = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [armed]);

  const refresh = () => setItems(getCustomExercises());

  const handleDelete = (id: string) => {
    deleteCustomExercise(id);
    refresh();
    setExpanded(p => { const n = new Set(p); n.delete(id); return n; });
    setArmed(null);
  };

  const toggleExpand = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addLabel = t("Add custom exercise", "Build a new lift", "Cook up a new move");

  return (
    <div className="tab-anim ch-ex-page">
      <div className="ch-ex-top">
        <div>
          <h2 className="ch-title">{t("Custom exercises", "Custom lifts", "Custom moves")}</h2>
          {items.length > 0 && (
            <div className="ch-ex-count">
              {items.length === 1 ? "1 of your own" : `${items.length} of your own`}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <button type="button" className="ch-big-btn" onClick={() => setCreating(true)}>
            <Plus size={20} /> {addLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="ch-empty">
          <span className="ch-empty-icon"><Sparkles size={34} /></span>
          <div className="ch-empty-text">
            {t(
              "No custom exercises yet. Build one to add it to your catalog.",
              "No homemade lifts yet, bro. Roll your own.",
              "No custom moves yet, bestie. Cook one up."
            )}
          </div>
          <button type="button" className="ch-big-btn" onClick={() => setCreating(true)}>
            <Plus size={20} /> {addLabel}
          </button>
        </div>
      ) : (
        <div className="ch-ex-grid">
          {items.map(ex => {
            const primary   = ex.primary.map(m => MI[m]?.n).filter(Boolean);
            const secondary = ex.secondary.map(m => MI[m]?.n).filter(Boolean);
            const isOpen          = expanded.has(ex.id);
            const hasInstructions = !!ex.instructions?.trim();
            const sure            = armed === ex.id;
            const TypeIcon        = TYPE_ICON[ex.type] ?? Dumbbell;
            return (
              <div key={ex.id} className={`ch-ex-card ${ex.type}`}>
                <button
                  type="button"
                  className="ch-ex-head"
                  onClick={() => toggleExpand(ex.id)}
                  aria-expanded={isOpen}
                >
                  <span className="ch-ex-dot" aria-hidden="true"><TypeIcon size={20} /></span>
                  <span className="ch-ex-main">
                    <span className="ch-ex-name">{ex.name}</span>
                    <span className="ch-ex-meta">{ex.type} · {ex.cat}</span>
                  </span>
                  <ChevronDown size={20} className={`ch-ex-chev${isOpen ? " flip" : ""}`} aria-hidden="true" />
                </button>

                {(primary.length > 0 || secondary.length > 0) && (
                  <div className="ch-ex-chips">
                    {primary.map(n => <span key={`p${n}`} className="ch-ex-chip">{n}</span>)}
                    {secondary.map(n => <span key={`s${n}`} className="ch-ex-chip second">{n}</span>)}
                  </div>
                )}

                {isOpen && (
                  <div className="ch-ex-detail">
                    {hasInstructions ? (
                      <>
                        <div className="ch-ex-detail-label">
                          <BookOpen size={14} />
                          {t("Instructions", "How to do it")}
                        </div>
                        <div className="ch-ex-detail-text">{ex.instructions}</div>
                      </>
                    ) : (
                      <div className="ch-ex-detail-none">
                        {t(
                          "No instructions yet. Tap Edit to add cues.",
                          "No notes yet. Hit Edit and drop some wisdom.",
                          "No notes yet. Hit Edit and gatekeep nothing."
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="ch-ex-actions">
                  <button
                    type="button"
                    className="ch-ex-btn"
                    onClick={() => setEditing(ex)}
                    aria-label={`Edit ${ex.name}`}
                  >
                    <Pencil size={18} /> {t("Edit", "Edit")}
                  </button>
                  <button
                    type="button"
                    className={`ch-ex-btn del${sure ? " sure" : ""}`}
                    onClick={() => (sure ? handleDelete(ex.id) : setArmed(ex.id))}
                    onBlur={() => { if (sure) setArmed(null); }}
                    aria-label={sure ? `Tap again to delete ${ex.name}` : `Delete ${ex.name}`}
                  >
                    <Trash2 size={18} /> {sure ? "Tap again" : t("Delete", "Delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <CustomExerciseModal
          onClose={() => setCreating(false)}
          onCreated={refresh}
        />
      )}
      {editing && (
        <CustomExerciseModal
          onClose={() => setEditing(null)}
          onCreated={refresh}
          editing={editing}
        />
      )}
    </div>
  );
}
