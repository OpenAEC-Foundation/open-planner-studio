// Welke metadata heeft het Projectinfo-formulier ÉCHT gewijzigd?
// Puur: het formulier stuurt altijd alle velden, en een geïmporteerd project mist vaak
// `defaultTaskDurationUnit` (afwezig ≡ 'days'). Zonder deze vergelijking maakt "Toepassen zonder
// wijziging" een eigen undo-stap, markeert de planning verouderd (want `startDate` zit altijd in de
// patch) en verlaat "datums zoals opgeslagen".
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
