import type { Task } from '@/types/task';

/** Eén cel die ALLEEN voor datumvolgorde-detectie wordt gelezen (A5.2/A5.4). `start`/`finish` komen
 *  uit de kolommen Start/Finish en worden NOOIT naar een taak geschreven. */
export interface RawDateCell {
  rowNumber: number;
  field: 'actualStart' | 'actualFinish' | 'start' | 'finish';
  raw: string;
  /** Alleen gezet bij een harde id-treffer — de ijkpuntregel gebruikt niets zwakkers. */
  taskId?: string;
}

/** Eén rij zoals de bestandslezer hem oplevert: sleutels al genormaliseerd, waarden nog RAUW
 *  (de datumvolgorde is op dat moment nog niet bekend). */
export interface RawProgressRow {
  /** 1-gebaseerd rijnummer in het bronbestand, inclusief de kopregel. Sleutel van de overrides. */
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  /** Naam uit het blad — UITSLUITEND om de preview leesbaar te maken; nooit geschreven. */
  name?: string;
  rawCompletion?: string;
  rawActualStart?: string;
  rawActualFinish?: string;
}

export type ProgressFileIssue =
  | 'tooLarge' | 'tooManyRows' | 'noKeyColumn' | 'noProgressColumns' | 'unreadable';

/** Wat een bestandslezer (CSV nu, XLSX later) oplevert. */
export interface ProgressSheet {
  fileIssue?: ProgressFileIssue;
  rawRows: readonly RawProgressRow[];
  /** Uitsluitend detectiemateriaal (A5.4). */
  detectionCells: readonly RawDateCell[];
}

export type DateOrder = 'dmy' | 'mdy';
export type DateOrderDetection =
  | { order: DateOrder; evidence: 'noAmbiguity' | 'outOfRange' | 'calibration' }
  | { order: 'ambiguous'; sample: string; sampleAlternatives: [string, string] };

/** Eén gefinaliseerde rij: waarden geparsed onder de vastgestelde datumvolgorde. */
export interface ProgressRow {
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  name?: string;
  completion?: { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string };
  actualStart?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  actualFinish?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
}

/** Handmatige koppelingen (E3/A11): rijnummer → task.id. Leeft in de dialoog, niet in de store. */
export type ProgressOverrides = ReadonlyMap<number, string>;

export type ProgressMatchKind = 'id' | 'wbs' | 'manual';

export type ProgressRowReason =
  | 'unmatched' | 'ambiguousWbs' | 'duplicateRow' | 'summaryTask'
  | 'unreadableDate' | 'unreadableNumber' | 'noProgressColumns'
  | 'actualAfterStatusDate' | 'actualFinishBeforeStart' | 'conflictingProgressInputs'
  | 'rejected';          // overige plannerfout; `plannerCode` draagt de originele code

export interface ProgressFieldChange {
  field: 'completion' | 'actualStart' | 'actualFinish';
  before: string | number | undefined;
  after: string | number | undefined;
}

export interface ProgressPlanRow {
  rowNumber: number;
  outcome: 'apply' | 'noop' | 'refused';
  reason?: ProgressRowReason;
  plannerCode?: string;
  match?: ProgressMatchKind;
  /** Waar ⇔ `match === 'wbs'`: gematcht op de zwakkere terugvalsleutel (A11). */
  needsConfirmation?: boolean;
  taskId?: string;
  /** WBS + naam van de GEMATCHTE taak (niet uit het blad). */
  taskLabel?: string;
  changes: readonly ProgressFieldChange[];
  /** Alleen bij `apply`: de volledig gecanonicaliseerde taak zoals hij geschreven wordt. */
  plannedTask?: Task;
}

export interface ProgressImportPlan {
  rows: readonly ProgressPlanRow[];
  appliedCount: number;
  noopCount: number;
  refusedCount: number;
  /** Rijen die op koppeling wachten: `unmatched` of `ambiguousWbs`. */
  needsLinkCount: number;
  /** Rijen met `needsConfirmation` (WBS-terugval, nog niet bevestigd). */
  needsConfirmationCount: number;
  /** Overrides die naar een niet meer bestaande taak wezen (A11 regel 2) — nooit stil. */
  ignoredOverrideRows: readonly number[];
  /** Taken zonder enige rij die ze claimde (informatief, niet fout). */
  untouchedTaskCount: number;
}

/** Harde grenzen op ONGEVALIDEERDE bestandsinvoer (hardening — zie de checklist). */
export const PROGRESS_IMPORT_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxRows: 50_000,
  maxCellChars: 4096,
  maxIdChars: 256,      // spiegelt isValidPersistedIfcId in ifcReader.ts
  maxWbsChars: 128,
} as const;

/** Kalibratiedrempels (A5.2 regel 3) — geëxporteerd zodat de test ze bij naam noemt. */
export const MIN_CALIBRATION_HITS = 3;
export const CALIBRATION_RATIO = 3;
// PERCENT_EPSILON (no-op-tolerantie op completion, A6) is VERWIJDERD — fixronde na de
// Opus-eindreview: een vaste float-epsilon is per constructie stuk (0.335 rondt af naar het door
// onze eigen `writeCSV` geschreven "34"; `0.34 - 0.335` ligt net boven élke drempel die ook "45,5"
// nog als echte wijziging moet doorlaten, E6). Vervangen door de vorm-bewuste
// `isCompletionUnchanged` in `buildPlan.ts` (heel-procent ⇒ rond-vergelijking; decimaal ⇒
// float-tolerante exacte gelijkheid) — geen losse drempelconstante meer nodig.
