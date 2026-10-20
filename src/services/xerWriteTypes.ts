/**
 * Het contract van de XER-schrijver (`services/xer/xerWriter.ts`): invoer, uitvoer en de soorten
 * verlies. Bewust buiten `services/xer/`: die map is een lazy chunk die alleen `formatRegistry.ts`
 * laadt (`check-xer-chunk-boundary.ts`); de store en de melding (`state/xerExportNotice.ts`) hebben
 * alleen deze typen nodig.
 */
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';

/** Eén soort verlies. De melding toont per code één regel met het aantal (`exportXerLossNotice`). */
export type XerWriteLossCode =
  | 'taskDescriptions' | 'activityCodes' | 'customFields' | 'externalLinks' | 'baselines'
  | 'deadlines' | 'customTaskTypes' | 'taskCategories' | 'manualTasks' | 'elapsedDurations'
  | 'levelingDelays' | 'splits' | 'percentLags' | 'elapsedLags' | 'summaryRelations'
  | 'summaryAssignments' | 'resourceTypes' | 'libraryLinks' | 'holidayNames' | 'noteStatus'
  | 'truncatedNames' | 'changedIds' | 'nonLatinText' | 'projectDetails' | 'schedulingRules'
  | 'summaryNotes' | 'priorities';

export interface XerWriteLoss {
  readonly code: XerWriteLossCode;
  readonly count: number;
}

export interface XerWriteInput {
  project: Project;
  /** Projectkalender. */
  calendar: WorkCalendar;
  /** De kalenderbibliotheek (mag de projectkalender bevatten). */
  calendars: readonly WorkCalendar[];
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
  /** Alleen geteld voor het verliesverslag: XER-baselines zijn aparte projecten (nog niet geschreven). */
  baselineCount?: number;
  /** P6 Project-ID van het document (`documentProjectCode`); leeg ⇒ `OPS:` + intern id. */
  projectCode?: string | null;
  /** Bewaarde P6 Resource-ID's (`rsrc_short_name`) per resource-id, uit een eerdere XER-import. */
  resourceCodes?: ReadonlyMap<string, string>;
  /** Exportdatum in de `ERMHDR`-kop; weglaten ⇒ vandaag. Tests geven een vaste datum. */
  exportDate?: string;
}

export interface XerWriteResult {
  /** De bestandsinhoud als tekst (regels met `\r\n`, zoals P6). */
  text: string;
  /** De bytes in `encoding`. */
  bytes: Uint8Array;
  /** `windows-1252` als elk teken past, anders `utf-8` (zonder BOM) en een `nonLatinText`-verlies. */
  encoding: 'windows-1252' | 'utf-8';
  loss: readonly XerWriteLoss[];
}

/** Vaste volgorde van de regels in de melding. */
export const LOSS_ORDER: readonly XerWriteLossCode[] = [
  'schedulingRules', 'baselines', 'summaryRelations', 'summaryAssignments', 'percentLags', 'elapsedLags',
  'elapsedDurations', 'manualTasks', 'levelingDelays', 'splits', 'deadlines', 'externalLinks',
  'activityCodes', 'customFields', 'customTaskTypes', 'taskCategories', 'priorities', 'taskDescriptions',
  'summaryNotes', 'noteStatus',
  'resourceTypes', 'libraryLinks', 'holidayNames', 'projectDetails', 'truncatedNames', 'changedIds', 'nonLatinText',
];
