import type { Task } from '@/types/task';

/** Eén cel die ALLEEN voor datumvolgorde-detectie wordt gelezen. `start`/`finish` komen uit de
 *  kolommen Start/Finish en worden NOOIT naar een taak geschreven. */
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
  /** De ruwe cel van de verborgen kolom `OPS Export` (`exportState.ts`). */
  rawExportState?: string;
}

export type ProgressFileIssue =
  | 'tooLarge' | 'tooManyRows' | 'noKeyColumn' | 'noProgressColumns' | 'unreadable'
  /** Het bestand is met een wachtwoord beveiligd (CFB-container i.p.v. ZIP). */
  | 'encrypted'
  /** Een `.csv`: het voortgangsblad bestaat alleen als `.xlsx` (eigenaarsbesluit 2026-10-30). */
  | 'csvNotSupported';

/** Wat de bestandslezer oplevert. */
export interface ProgressSheet {
  fileIssue?: ProgressFileIssue;
  rawRows: readonly RawProgressRow[];
  /** Uitsluitend detectiemateriaal. */
  detectionCells: readonly RawDateCell[];
}

export type DateOrder = 'dmy' | 'mdy';
export type DateOrderDetection =
  /** `contradictoryNoSample`: het bereikbewijs (regel 2) wees tegenstrijdig — sommige cellen
   *  konden alleen dag-eerst kloppen, andere alleen maand-eerst — maar geen enkele cel was zelf
   *  een eerlijk (onder beide lezingen geldig, verschillend) voorbeeld om te tonen. De orde blijft
   *  `dmy` (een keuze moest gemaakt worden), maar dit label zegt eerlijk dat het bestand
   *  tegenstrijdig was. */
  | { order: DateOrder; evidence: 'noAmbiguity' | 'outOfRange' | 'calibration' | 'contradictoryNoSample' }
  /** `sample` is de rauwe celtekst uit het bestand. `sampleAlternatives` zijn de twee lezingen als
   *  ISO-datumstrings (GEEN geformatteerde tekst): de dialoog formatteert ze zelf, locale-bewust, met
   *  `formatDisplayDate`. Beide lezingen zijn gegarandeerd geldige, VERSCHILLENDE kalenderdatums
   *  (nooit een Date.UTC-rollover als "keuze"). */
  | { order: 'ambiguous'; sample: string; sampleAlternatives: [dmyIso: string, mdyIso: string] };

/** Wat er bij de export in de planning stond (`exportState.ts`). Alleen vergelijkingsmateriaal:
 *  wordt nooit naar een taak geschreven. */
export interface ProgressExportState {
  /** Exportmoment, ISO in UTC. */
  exportedAt: string;
  /** Voltooiing 0..1. */
  completion: number;
  actualStart?: string;
  actualFinish?: string;
  /** Berekende start en einde (`computedStart`/`computedFinish`). */
  plannedStart?: string;
  plannedFinish?: string;
}

/** Eén gefinaliseerde rij: waarden geparsed onder de vastgestelde datumvolgorde. */
export interface ProgressRow {
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  name?: string;
  completion?: { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string }
    | { kind: 'outOfRange'; raw: string };
  actualStart?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  actualFinish?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  exportState?: ProgressExportState;
}

/** Handmatige koppelingen: rijnummer → task.id. Leeft in de dialoog, niet in de store. */
export type ProgressOverrides = ReadonlyMap<number, string>;

/** Bij een botsing: de app-waarde houden of de bladwaarde overnemen. */
export type ProgressConflictChoice = 'app' | 'sheet';
/** Keuzes per rijnummer. Leeft in de dialoog, niet in de store. */
export type ProgressConflictChoices = ReadonlyMap<number, ProgressConflictChoice>;

export type ProgressMatchKind = 'id' | 'wbs' | 'manual';

export type ProgressRowReason =
  | 'unmatched' | 'ambiguousWbs' | 'duplicateRow' | 'summaryTask'
  // `noProgressColumns` is geen RIJ-reden: een rij zonder ingevulde voortgangswaarde is `noop`, geen
  // weigering. Als BESTANDSniveau-issue (`ProgressFileIssue`) bestaat de code wel.
  | 'unreadableDate' | 'unreadableNumber'
  // `percentOutOfRange`: een numeriek LEESBARE waarde buiten [0, 100] (bv. "838", "-5") — apart van
  // `unreadableNumber` (tekst/geen match), want de valkuil is anders: een decimaalteken dat een
  // spreadsheet met andere landinstelling als duizendtalscheider las ("8,38" ⇒ 838). De dialoog mag
  // dat verschil expliciet benoemen.
  | 'percentOutOfRange'
  | 'actualAfterStatusDate' | 'actualFinishBeforeStart' | 'conflictingProgressInputs'
  // De taak begint volgens planning pas ná de statusdatum en het blad levert geen werkelijke start —
  // niet verzinnen (`ProgressImportEntryOptions` in taskSlice.ts).
  | 'actualStartRequired'
  | 'rejected';          // overige plannerfout; `plannerCode` draagt de originele code

export type ProgressField = 'completion' | 'actualStart' | 'actualFinish';

export interface ProgressFieldChange {
  field: ProgressField;
  before: string | number | undefined;
  after: string | number | undefined;
}

/** Sinds de export veranderde dit veld in de app én in het blad, en de twee waarden verschillen. */
export interface ProgressFieldConflict {
  field: ProgressField;
  exported: string | number | undefined;
  app: string | number | undefined;
  sheet: string | number | undefined;
}

/** Sinds de export veranderde dit veld alleen in de app: het blad draagt nog de exportwaarde, dus de
 *  app-waarde blijft staan. */
export interface ProgressFieldKept {
  field: ProgressField;
  exported: string | number | undefined;
  app: string | number | undefined;
}

/** De berekende start of het berekende einde ligt op een andere dag dan bij de export. Alleen een
 *  melding; de import raakt plandatums nooit aan. */
export interface ProgressPlannedShift {
  field: 'start' | 'finish';
  exported: string;
  current: string;
}

export interface ProgressPlanRow {
  rowNumber: number;
  /** `unresolved`: de rij heeft een botsing zonder keuze en wacht daarop. */
  outcome: 'apply' | 'noop' | 'refused' | 'unresolved';
  reason?: ProgressRowReason;
  plannerCode?: string;
  match?: ProgressMatchKind;
  /** Waar ⇔ `match === 'wbs'`: gematcht op de zwakkere terugvalsleutel. */
  needsConfirmation?: boolean;
  taskId?: string;
  /** WBS + naam van de GEMATCHTE taak (niet uit het blad). */
  taskLabel?: string;
  changes: readonly ProgressFieldChange[];
  /** Alleen bij `apply`: de volledig gecanonicaliseerde taak zoals hij geschreven wordt. */
  plannedTask?: Task;
  /** Botsingen op deze rij, ongeacht de keuze; afwezig als er geen zijn. */
  conflicts?: readonly ProgressFieldConflict[];
  conflictChoice?: ProgressConflictChoice;
  /** Velden die alleen in de app veranderden; afwezig als er geen zijn. */
  keptApp?: readonly ProgressFieldKept[];
  plannedShifts?: readonly ProgressPlannedShift[];
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
  /** Overrides die naar een niet meer bestaande taak wezen (resolutieregel 2) — nooit stil. */
  ignoredOverrideRows: readonly number[];
  /** Taken zonder enige rij die ze claimde (informatief, niet fout). */
  untouchedTaskCount: number;
  /** Rijen met minstens één botsing. */
  conflictCount: number;
  /** Rijen met een botsing zonder keuze. Zolang dit boven 0 staat, past `applyProgressImport` niets toe. */
  unresolvedConflictCount: number;
  /** Rijen met minstens één veld dat alleen in de app veranderde. */
  appNewerCount: number;
  /** Rijen met een plandatum op een andere dag dan bij de export. */
  plannedShiftCount: number;
  /** Rijen met voortgangswaarden maar zonder bruikbare exportstand. */
  withoutExportStateCount: number;
  /** Het laatste exportmoment in het blad (ISO in UTC), als er een is. */
  exportedAt?: string;
}

/** Harde grenzen op ONGEVALIDEERDE bestandsinvoer. */
/**
 * Widened vorm van `PROGRESS_IMPORT_LIMITS` (die `as const` is — sommige velden dragen daardoor
 * een literal-type, bv. `256` i.p.v. `number`). Losse limieten (tests, een toekomstige instelling)
 * moeten een AFWIJKENDE waarde kunnen meegeven; `typeof PROGRESS_IMPORT_LIMITS` zou dat afdwingen
 * tot exact de standaardwaarde.
 */
export interface ProgressImportLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxCellChars: number;
  readonly maxIdChars: number;
  readonly maxWbsChars: number;
}

export const PROGRESS_IMPORT_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxRows: 50_000,
  maxCellChars: 4096,
  maxIdChars: 256,      // spiegelt isValidPersistedIfcId in ifcReader.ts
  maxWbsChars: 128,
} as const;

/** Kalibratiedrempels (datumvolgorde, regel 3) — geëxporteerd zodat de test ze bij naam noemt. */
export const MIN_CALIBRATION_HITS = 3;
export const CALIBRATION_RATIO = 3;
// Geen vaste no-op-tolerantie op completion: een float-epsilon is per constructie stuk (een blad met
// "34" tegen een taak op 0.335: `0.34 - 0.335` ligt net boven élke drempel die "45,5" nog als
// wijziging moet doorlaten). Zie de precisiebewuste `isCompletionUnchanged` in `buildPlan.ts`.
