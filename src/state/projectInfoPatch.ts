// Welke metadata heeft het Projectinfo-formulier ÉCHT gewijzigd?
// Puur: het formulier stuurt altijd alle velden, en een geïmporteerd project mist vaak
// `defaultTaskDurationUnit` (afwezig ≡ 'days'). Zonder deze vergelijking maakt "Toepassen zonder
// wijziging" een eigen undo-stap, markeert de planning verouderd (want `startDate` zit altijd in de
// patch) en verlaat "datums zoals opgeslagen".
import { projectIfcSchema, type Project } from '@/types/project';
import { DEFAULT_WORK_RULE } from '@/types/workRule';

/** De metadatavelden die het formulier bewerkt. `ifcSchema` en `anchorsFromOpenDocuments` alleen bij bewerken
 *  (de wizard maakt een nieuw project, dat op de standaard begint). */
export type ProjectInfoMetadata = Pick<
  Project, 'name' | 'description' | 'author' | 'company' | 'startDate' | 'endDate' | 'defaultTaskDurationUnit' | 'defaultWorkRule'
> & Partial<Pick<Project, 'ifcSchema' | 'anchorsFromOpenDocuments'>>;

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
  // Het formulier biedt vier regels; een bestand zonder projectkeuze gebruikt de bestaande standaard.
  if (draft.defaultWorkRule !== undefined && (current.defaultWorkRule ?? DEFAULT_WORK_RULE) !== draft.defaultWorkRule) {
    patch.defaultWorkRule = draft.defaultWorkRule;
  }
  // Afwezig ≡ IFC4X3_ADD2 (issue #292): een project zonder veld dat op de standaard blijft, wijzigt niet.
  if (draft.ifcSchema !== undefined && projectIfcSchema(current) !== draft.ifcSchema) {
    patch.ifcSchema = draft.ifcSchema;
    // Een schema dat de gebruiker hier zelf kiest, is zijn antwoord op de schemavraag bij opslaan
    // (besluit eigenaar 2026-10-13): de vraag vervalt, in dezelfde undo-stap.
    if (current.ifcSchemaUnconfirmed !== undefined) patch.ifcSchemaUnconfirmed = undefined;
  }
  // Het vinkje *Ankers uit geopende documenten halen* (stap 1.7): afwezig ≡ uit; uit wordt `undefined`.
  if (draft.anchorsFromOpenDocuments !== undefined
    && (current.anchorsFromOpenDocuments ?? false) !== draft.anchorsFromOpenDocuments) {
    patch.anchorsFromOpenDocuments = draft.anchorsFromOpenDocuments || undefined;
  }
  return patch;
}
