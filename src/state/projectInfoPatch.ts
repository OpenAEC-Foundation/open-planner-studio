// Welke metadata heeft het Projectinfo-formulier ÉCHT gewijzigd? (gebruikstest I5, rekenprofielen).
// Puur: het formulier stuurt altijd alle velden, en een geïmporteerd project mist vaak
// `defaultTaskDurationUnit` (afwezig ≡ 'days'). Zonder deze vergelijking maakte "Toepassen zonder
// wijziging" een eigen undo-stap, markeerde de planning verouderd (want `startDate` zat altijd in de
// patch) en verliet "datums zoals opgeslagen".
import type { Project } from '@/types/project';

/** De metadatavelden die het formulier bewerkt. */
export type ProjectInfoMetadata = Pick<
  Project, 'name' | 'description' | 'author' | 'company' | 'startDate' | 'endDate' | 'defaultTaskDurationUnit'
>;

const FIELDS = ['name', 'description', 'author', 'company', 'startDate', 'endDate'] as const;

/** Alleen de velden die inhoudelijk verschillen; `modifiedAt` doet nooit mee. Leeg ⇒ niets te doen. */
export function projectInfoPatch(current: Project, draft: ProjectInfoMetadata): Partial<Project> {
  const patch: Partial<Project> = {};
  for (const key of FIELDS) {
    if ((current[key] ?? '') !== (draft[key] ?? '')) patch[key] = draft[key];
  }
  if ((current.defaultTaskDurationUnit ?? 'days') !== (draft.defaultTaskDurationUnit ?? 'days')) {
    patch.defaultTaskDurationUnit = draft.defaultTaskDurationUnit;
  }
  return patch;
}
