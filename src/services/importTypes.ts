import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';

/**
 * Eén gedeelde payload-vorm voor een ingelezen project (audit P1). De vier readers (`readIFC`,
 * `readMSPDI`, `readP6XML`, `readCSV`) gaven elk een eigen ad-hoc objectvorm terug (11/9/7/6
 * velden), die de store met `as`-casts moest verzoenen. Nu retourneren ze allemaal dit type:
 *
 *  - De **kernvelden** levert elk formaat altijd.
 *  - De **optionele velden** levert niet elk formaat: CSV/P6 kennen bv. geen baselines, alleen
 *    IFC kent activity-codes/custom-fields. Ontbrekend ⇒ afwezig (`undefined`), de aanroeper
 *    valt terug op `?? []` / `?? null`.
 *
 * `writeIFC` hergebruikt dit type (zie `WriteIFCInput` in `ifcWriter.ts`) omdat de writer exact
 * dezelfde payload nodig heeft — zo blijft de IFC-round-trip symmetrisch getypeerd.
 */
export interface ImportResult {
  // Kernvelden — door elk formaat geleverd.
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  // Optionele velden — niet elk formaat levert deze.
  resourceCalendars?: WorkCalendar[];
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  baselines?: Baseline[];
  activeBaselineId?: string | null;
}
