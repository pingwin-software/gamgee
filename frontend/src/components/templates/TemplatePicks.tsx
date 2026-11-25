import { useEffect, useRef, useState } from "react";
import { Bookmark, Pencil, Plus, Trash2 } from "../../icons";
import type { WorkoutTemplate } from "../../types";
import { getFocusDef } from "../../data/focuses";
import { useTemplates } from "../../context/TemplatesContext";
import TemplateEditorSheet from "./TemplateEditorSheet";
import "./templates.css";

/**
 * "From template" in a plan's day editor: tap a template's name to fill the
 * day with it; the pencil edits it, the bin deletes it (tap twice), and New
 * makes another. Nothing shows for someone who doesn't use templates.
 */
export default function TemplatePicks({ onApply }: { onApply: (tpl: WorkoutTemplate) => void }) {
  const { templates, remove, enabled } = useTemplates();
  const [editing, setEditing] = useState<WorkoutTemplate | null | "new">(null);
  const [armed, setArmed] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const del = (tpl: WorkoutTemplate) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (armed === tpl.id) { setArmed(null); remove(tpl.id); return; }
    setArmed(tpl.id);
    timer.current = window.setTimeout(() => setArmed(null), 4000);
  };

  if (!enabled) return null;
  return (
    <div className="ww-template-row tpl-picks">
      <span className="ww-template-lbl"><Bookmark size={11} /> From template</span>
      {templates.map(tpl => {
        const fd = tpl.focus ? getFocusDef(tpl.focus) : null;
        const n = tpl.exercise_ids.length;
        return (
          <span key={tpl.id} className="tpl-pick">
            <button
              type="button"
              className="tpl-pick-use"
              title={`${fd ? `${fd.name} · ` : ""}${n} exercise${n !== 1 ? "s" : ""}, replaces this day`}
              onClick={() => onApply(tpl)}
            >
              {tpl.name}
            </button>
            <button type="button" className="tpl-pick-act" onClick={() => setEditing(tpl)} aria-label={`Edit template ${tpl.name}`}>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className={`tpl-pick-act danger${armed === tpl.id ? " armed" : ""}`}
              onClick={() => del(tpl)}
              aria-label={armed === tpl.id ? `Tap again to delete ${tpl.name}` : `Delete template ${tpl.name}`}
            >
              {armed === tpl.id ? <span aria-live="polite">Delete?</span> : <Trash2 size={14} />}
            </button>
          </span>
        );
      })}
      <button type="button" className="tpl-pick-new" onClick={() => setEditing("new")}>
        <Plus size={13} /> New
      </button>
      {editing && (
        <TemplateEditorSheet initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
