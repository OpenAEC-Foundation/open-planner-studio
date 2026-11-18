/**
 * Objecten op de site, naast ERPNext: `records` op `window.openaecHost` (OpenAEC SuperCloud).
 *
 * De site bewaart objecten van een tool in één doctype (OpenAEC Object): een soort en een sleutel uit
 * de tool, een titel en de gegevens als JSON. De planner bewaart er zijn taken mee bij een project in
 * ERPNext. Een record met `task` wordt daar ook een gewone taak (Task); de site antwoordt met de naam
 * ervan (`taskId`).
 *
 * Alleen lezen van de host en een pure vertaling van taken naar records: geen store, geen i18n. Het
 * venster (`SiteRecordsDialog`) levert de taken en het GlobalId per taak aan.
 */
import type { Task } from '@/types/task';
import { formatDate, parseInstant } from '@/utils/dateUtils';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { candidateHosts } from './siteHost';

/** Wat van een record ook een taak in ERPNext maakt: datums als `JJJJ-MM-DD`, voortgang in procenten. */
export interface SiteRecordTask {
  start?: string | null;
  end?: string | null;
  progress?: number | null;
}

/** Eén object van de tool op de site. */
export interface SiteRecord {
  /** Wat het is, in de woorden van de tool. De planner gebruikt `taak`. */
  kind: string;
  /** Het id in de tool; dezelfde sleutel opnieuw bewaren werkt het record bij. */
  key: string;
  title: string;
  data: unknown;
  /** Alleen bij bewaren, met een project: ook als taak in ERPNext. */
  task?: SiteRecordTask | null;
  /** De taak in ERPNext die erbij hoort. */
  taskId?: string | null;
  modified?: string;
  author?: string;
}

/** Waar records bij horen: een project in ERPNext, het geopende bestand, of alleen de gebruiker. */
export interface SiteRecordScope {
  project?: string;
  file?: boolean;
}

export interface SiteRecordProject {
  id: string;
  title: string;
}

/** `records` op de host. Elke functie geeft een Promise; een geweigerde Promise is een fout met `message`. */
export interface SiteHostRecords {
  projects(): Promise<SiteRecordProject[]>;
  list(scope?: SiteRecordScope & { kind?: string }): Promise<SiteRecord[]>;
  save(records: SiteRecord[], scope?: SiteRecordScope): Promise<{ kind: string; key: string; taskId: string | null }[]>;
  delete(records: { kind: string; key: string }[], scope?: SiteRecordScope): Promise<number>;
}

/** De soort waaronder de planner zijn taken bewaart. */
export const TASK_RECORD_KIND = 'taak';

/** Is `value` een `SiteHostRecords` (vier functies)? Zonder `instanceof`: de host kan uit een ander venster komen. */
export function isSiteHostRecords(value: unknown): value is SiteHostRecords {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.projects === 'function' && typeof r.list === 'function'
    && typeof r.save === 'function' && typeof r.delete === 'function';
}

/** De records van de eerste host die ze geeft, anders `null`. Kijkt op het moment van aanroepen. */
export function siteHostRecords(): SiteHostRecords | null {
  for (const host of candidateHosts()) {
    let records: unknown;
    try {
      records = host.records;
    } catch {
      continue; // een getter van een vreemd venster kan gooien
    }
    if (isSiteHostRecords(records)) return records;
  }
  return null;
}

/** Kan de planner nu objecten op de site bewaren? */
export function siteRecordsAvailable(): boolean {
  return siteHostRecords() !== null;
}

/** De dag van een ISO-moment (`2026-12-01` of `2026-12-01T08:00`), of `null` als het leeg of ongeldig is. */
function isoDay(value: string | undefined): string | null {
  if (!value) return null;
  const moment = parseInstant(value);
  return Number.isNaN(moment.getTime()) ? null : formatDate(moment);
}

/**
 * De taken van een planning als records, in de volgorde van de planning. Samenvattingstaken gaan niet
 * mee: zij volgen uit hun onderliggende taken en horen in ERPNext niet als eigen taak. De datums zijn
 * de berekende (vroegste) start en het berekende einde; ontbreken die, dan de ingevoerde.
 *
 * `globalIdOf` geeft het GlobalId waaronder de taak in het IFC-bestand staat. Dat is de sleutel: hij
 * blijft gelijk als de planning wordt opgeslagen en weer geopend.
 */
export function tasksToRecords(tasks: readonly Task[], globalIdOf: (taskId: string) => string): SiteRecord[] {
  return tasks.filter((task) => !isSummaryTask(task)).map((task) => {
    const start = isoDay(task.time.earlyStart) ?? isoDay(task.time.scheduleStart);
    const end = isoDay(task.time.earlyFinish) ?? isoDay(task.time.scheduleFinish);
    const progress = Math.round(Math.min(1, Math.max(0, task.time.completion ?? 0)) * 100);
    return {
      kind: TASK_RECORD_KIND,
      key: globalIdOf(task.id),
      title: task.name,
      data: { wbs: task.wbsCode, start, end, progress, milestone: task.isMilestone },
      task: { start, end, progress },
    };
  });
}
