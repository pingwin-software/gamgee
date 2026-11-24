import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { WorkoutTemplate } from "../../types";
import WizardTemplate from "../workout/WizardTemplate";
import { useTemplates } from "../../context/TemplatesContext";
import "./templates.css";

/**
 * The template builder on a full-screen sheet, so a template can be made or
 * edited from wherever it is listed without leaving that page (a regime's
 * day, the weekly plan, Regimes). `initial` null makes a new one.
 */
export default function TemplateEditorSheet({ initial, onClose }: {
  initial: WorkoutTemplate | null;
  onClose: () => void;
}) {
  const { history, save, update } = useTemplates();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Portalled to <body>: the pages it opens from animate in with a transform,
  // which would otherwise pin a fixed sheet inside them.
  return createPortal(
    <div className="tpl-sheet" role="dialog" aria-modal="true" aria-label={initial ? `Edit template ${initial.name}` : "New template"}>
      <div className="tpl-sheet-inner">
        <WizardTemplate
          initial={initial}
          onSaveTemplate={save}
          onUpdateTemplate={update}
          onDone={onClose}
          history={history}
        />
      </div>
    </div>,
    document.body,
  );
}
