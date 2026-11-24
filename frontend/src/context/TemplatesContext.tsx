import { createContext, useContext } from "react";
import type { WorkoutSession, WorkoutTemplate, WorkoutTemplateDraft } from "../types";

/**
 * Saved workout templates and everything that can be done with one. Every
 * place that lists templates (the workout-type screen, Regimes, the day
 * editors) reads from here, so each of them can start, edit and delete, not
 * just some.
 */
export interface TemplatesApi {
  templates: WorkoutTemplate[];
  /** For the editor's suggestions (favourites by focus). */
  history:   WorkoutSession[];
  save:   (draft: WorkoutTemplateDraft) => Promise<WorkoutTemplate | null>;
  update: (id: number, draft: WorkoutTemplateDraft) => Promise<WorkoutTemplate | null>;
  remove: (id: number) => Promise<boolean>;
  /** Load into a workout and go to the build screen. */
  start:  (tpl: WorkoutTemplate) => void;
}

const TemplatesContext = createContext<TemplatesApi | null>(null);

export const TemplatesProvider = TemplatesContext.Provider;

export function useTemplates(): TemplatesApi {
  const api = useContext(TemplatesContext);
  if (!api) throw new Error("useTemplates needs a TemplatesProvider");
  return api;
}
