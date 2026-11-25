import { useState } from "react";
import { X, Plus, Trash2, Check, Minus } from "../../icons";
import type { WorkoutSession, WorkoutExercise, WorkoutSet, ExerciseDef } from "../../types";
import { ALL_EX } from "../../data/exercises";
import { fmtDate } from "../../utils";
import "../../pages/history.css";

interface Props {
  session: WorkoutSession;
  onSave: (updated: WorkoutSession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function EditWorkoutModal({ session, onSave, onDelete, onClose }: Props) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    session.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s })) }))
  );
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateSet = (uid: string, idx: number, field: keyof WorkoutSet, value: string) =>
    setExercises(p => p.map(ex =>
      ex.uid !== uid ? ex : { ...ex, sets: ex.sets.map((s, i) => i === idx ? { ...s, [field]: value } : s) }
    ));

  const addSet = (uid: string) =>
    setExercises(p => p.map(ex =>
      ex.uid !== uid ? ex : { ...ex, sets: [...ex.sets, { weight: "", reps: "", done: true }] }
    ));

  const removeSet = (uid: string, idx: number) =>
    setExercises(p => p.map(ex =>
      ex.uid !== uid ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) }
    ));

  const removeExercise = (uid: string) =>
    setExercises(p => p.filter(ex => ex.uid !== uid));

  const addExercise = (ex: ExerciseDef) => {
    setExercises(p => [...p, {
      ...ex,
      uid: `${ex.id}_${Date.now()}`,
      sets: [{ weight: "", reps: "", done: true }],
    }]);
    setShowPicker(false);
    setSearch("");
  };

  const handleSave = () => {
    onSave({ ...session, exercises: exercises.filter(ex => ex.sets.length > 0) });
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(session.id);
  };

  const filtered = ALL_EX.filter(ex =>
    !search || ex.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  const weightLabel = (type: string) =>
    type === "cardio" ? "min" : type === "timed" ? "sec" : "kg";

  const hasReps = (type: string) => type !== "timed";

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="edit-sheet hx-edit" role="dialog" aria-modal="true" aria-label="Edit session" onClick={e => e.stopPropagation()}>
          <div className="edit-sheet-hdr">
            <div>
              <div className="hx-edit-title">Edit session</div>
              <div className="hx-edit-date">{fmtDate(session.date)}</div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="edit-sheet-body">
            {exercises.length === 0 && (
              <p className="hx-edit-empty">No exercises left. Add one, or delete the session below.</p>
            )}
            {exercises.map(ex => {
              const cols = hasReps(ex.type) ? "three" : "two";
              const unit = weightLabel(ex.type);
              const repsUnit = ex.type === "cardio" ? "km" : "reps";
              return (
                <div key={ex.uid} className="hx-edit-ex">
                  <div className="hx-edit-ex-head">
                    <span className="hx-edit-ex-name">{ex.name}</span>
                    <button
                      type="button"
                      className="hx-icon-btn"
                      onClick={() => removeExercise(ex.uid)}
                      aria-label={`Remove ${ex.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {ex.sets.length > 0 && (
                    <div className={`hx-edit-row ${cols}`} aria-hidden="true">
                      <span />
                      <span className="hx-edit-lbl">{unit}</span>
                      {hasReps(ex.type) && <span className="hx-edit-lbl">{repsUnit}</span>}
                      <span />
                    </div>
                  )}
                  {ex.sets.map((s, i) => (
                    <div key={i} className={`hx-edit-row ${cols}`}>
                      <span className="hx-edit-num">{i + 1}</span>
                      <input
                        className="hx-edit-inp"
                        type="number"
                        inputMode="decimal"
                        aria-label={`${ex.name}, set ${i + 1}, ${unit}`}
                        value={s.weight}
                        onChange={e => updateSet(ex.uid, i, "weight", e.target.value)}
                      />
                      {hasReps(ex.type) && (
                        <input
                          className="hx-edit-inp"
                          type="number"
                          inputMode="decimal"
                          aria-label={`${ex.name}, set ${i + 1}, ${repsUnit}`}
                          value={s.reps}
                          onChange={e => updateSet(ex.uid, i, "reps", e.target.value)}
                        />
                      )}
                      <button
                        type="button"
                        className="hx-icon-btn"
                        onClick={() => removeSet(ex.uid, i)}
                        aria-label={`Remove set ${i + 1} of ${ex.name}`}
                      >
                        <Minus size={18} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="hx-edit-add" onClick={() => addSet(ex.uid)}>
                    <Plus size={16} /> Add set
                  </button>
                </div>
              );
            })}
            <button type="button" className="hx-edit-add big" onClick={() => setShowPicker(true)}>
              <Plus size={18} /> Add exercise
            </button>
          </div>

          <div className="edit-sheet-footer hx-edit-foot">
            <button
              type="button"
              className={`hx-edit-del${confirmDelete ? " confirm" : ""}`}
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
            >
              <Trash2 size={17} />
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
            <button type="button" className="hx-edit-save" onClick={handleSave}>
              <Check size={18} /> Save
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <div className="overlay" style={{ zIndex: 300 }} onClick={() => setShowPicker(false)}>
          <div className="picker hx-picker" role="dialog" aria-modal="true" aria-label="Add exercise" onClick={e => e.stopPropagation()}>
            <div className="picker-hdr">
              <span className="hx-edit-title">Add exercise</span>
              <button type="button" className="modal-close-btn" onClick={() => setShowPicker(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <input
              className="search-inp hx-picker-inp"
              placeholder="Search exercises..."
              aria-label="Search exercises"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {filtered.map(ex => (
              <button type="button" key={ex.id} className="ex-opt" onClick={() => addExercise(ex)}>
                <div className="type-dot" style={{
                  background: ex.type === "cardio" ? "var(--green)" : ex.type === "timed" ? "var(--blue)" : "var(--accent)"
                }} />
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
