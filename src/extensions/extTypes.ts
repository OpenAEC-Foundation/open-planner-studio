/**
 * PUBLIEK EXTENSIE-CONTRACT — de datavormen die extensies via `api.data.*`, de importer-handlers
 * en `sdk.factory.*` te zien krijgen.
 *
 * Waarom een aparte laag i.p.v. de interne `Task`/`Project`/… uit `src/types/`?
 * Die interne typen zijn het domeinmodel van de app en veranderen vrij mee met refactors; als de
 * extensie-API ze rechtstreeks zou lekken, breekt elke interne rename het publieke contract. Deze
 * `Ext*`-DTO's staan daar bewust los van: ze worden VERSTABILISEERD. Een interne rename raakt
 * alleen de mappers in `extMappers.ts`, nooit extensie-code.
 *
 * NB (2026, audit P16/D2): de vormen SPIEGELEN vandaag nog grotendeels de interne velden — dat is
 * prima; het punt is de ONTKOPPELING, niet een andere gedaante. Voeg je hier een veld toe, dan
 * dwingt `extMappers.ts` (expliciete, veld-voor-veld return-types) af dat je het ook mapt.
 */

// ── Project ──

/** Ext-facing projectkop. Spiegelt {@link import('@/types/project').Project}. */
export interface ExtProject {
  id: string;
  name: string;
  description: string;
  /** ISO 8601 (date-only in dag-modus). */
  startDate: string;
  /** ISO 8601; leeg tot het schema berekend is. */
  endDate: string;
  /** Id van de projectkalender in de kalenderbibliotheek. */
  calendarId: string;
  /** ISO datetime — aanmaakmoment. */
  createdAt: string;
  /** ISO datetime — laatst gewijzigd. */
  modifiedAt: string;
  author: string;
  company: string;
  /** WBS-codes automatisch nummeren (1.2.3) i.p.v. vrije tekst. undefined ⇒ vrije tekst. */
  wbsAutoNumber?: boolean;
  /** P6 "data date" (grens verleden/toekomst). undefined ⇒ geen statusdatum. */
  statusDate?: string;
  /** Voortgangs-scheduling-modus. undefined ⇒ RETAINED_LOGIC. */
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';
  /** Project-scoped reken-opties (P6-geavanceerd). undefined ⇒ alle defaults. */
  schedulingOptions?: ExtSchedulingOptions;
}

/** Ext-facing reken-opties. Spiegelt {@link import('@/types/project').SchedulingOptions}. */
export interface ExtSchedulingOptions {
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; threshold?: number };
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  makeOpenEndedCritical?: boolean;
  nearCriticalThreshold?: number;
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
}

// ── Kalender ──

/** Werktijd-banden per ISO-weekdag (1=ma..7=zo). Spiegelt `WorkTimeBands`. */
export interface ExtWorkTimeBands {
  byWeekday: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>;
}

/** Eén feestdag/uitzonderingsbereik. Spiegelt `Holiday`. */
export interface ExtHoliday {
  name: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
}

/** Ext-facing werkkalender. Spiegelt {@link import('@/types/calendar').WorkCalendar}. */
export interface ExtCalendar {
  id: string;
  name: string;
  description: string;
  /** Werkdagen als ISO-weekdagnummers (1=ma .. 7=zo). */
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  /** Netto werkuren per dag. */
  hoursPerDay: number;
  holidays: ExtHoliday[];
  /** Per-weekdag werktijd-banden. Aanwezig ⇒ uur-kalender; afwezig ⇒ dag-kalender. */
  workTime?: ExtWorkTimeBands;
  /** Ploeg-classificatie. undefined ⇒ FIRST. */
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
}

// ── Taak ──

/** Ext-facing taaktijd (planning + CPM-uitkomst). Spiegelt {@link import('@/types/task').TaskTime}. */
export interface ExtTaskTime {
  durationType: 'WORKTIME' | 'ELAPSEDTIME';
  /** Duur in werkdagen. */
  scheduleDuration: number;
  /** Canonieke duur in integer minuten (uur-modus). Afwezig ⇒ dag-modus. */
  durationMinutes?: number;
  /** ISO 8601 — date-only in dag-modus, datetime in uur-modus. */
  scheduleStart: string;
  scheduleFinish: string;

  // CPM-uitkomst (alleen zinvol na recalculate()).
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;
  totalFloat: number;
  isCritical: boolean;
  interferingFloat?: number;
  isNearCritical?: boolean;
  floatPath?: number;

  // Voortgang / tracking.
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  remainingMinutes?: number;
  /** 0.0 – 1.0. */
  completion: number;
}

/** Datum-constraint. Spiegelt {@link import('@/types/task').TaskConstraint}. */
export interface ExtTaskConstraint {
  type: 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';
  date?: string;
  hard?: boolean;
}

/** Externe (cross-project) dependency. Spiegelt {@link import('@/types/task').ExternalLink}. */
export interface ExtExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  sourceMissing: boolean;
}

/** Vrije aantekening/checklist-item per taak. */
export interface ExtTaskNote {
  id: string;
  text: string;
  done: boolean;
}

/** Ext-facing taak. Spiegelt {@link import('@/types/task').Task}. */
export interface ExtTask {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType:
    | 'CONSTRUCTION'
    | 'INSTALLATION'
    | 'DEMOLITION'
    | 'LOGISTIC'
    | 'ATTENDANCE'
    | 'MOVE'
    | 'RENOVATION'
    | 'MAINTENANCE'
    | 'USERDEFINED';
  status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED';
  isMilestone: boolean;
  milestoneKind?: 'START' | 'FINISH';
  mandatory?: boolean;
  /** Leveling-prioriteit (0–1000, default 500). */
  priority: number;
  levelingDelay?: number;
  /** WBS-ouder; null = top-level. */
  parentId: string | null;
  /** WBS-kinderen. */
  childIds: string[];
  time: ExtTaskTime;
  resourceIds: string[];
  color?: string;
  /** Activity-code-toewijzingen: codetype-id → waarde-id. */
  activityCodes?: Record<string, string>;
  /** Custom-field-waarden: velddefinitie-id → waarde. */
  customFields?: Record<string, string | number | boolean>;
  constraint?: ExtTaskConstraint;
  constraint2?: ExtTaskConstraint;
  isHammock?: boolean;
  externalLinks?: ExtExternalLink[];
  deadline?: string;
  /** Id in de kalenderbibliotheek; undefined ⇒ projectkalender. */
  calendarId?: string;
  notes?: ExtTaskNote[];
}

// ── Relatie ──

/** Ext-facing relatie (precedence-link). Spiegelt {@link import('@/types/sequence').Sequence}. */
export interface ExtSequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'FINISH_START' | 'FINISH_FINISH' | 'START_START' | 'START_FINISH';
  /** Vaste lag in dagen (positief = uitloop, negatief = lead). */
  lagDays: number;
  /** Vaste lag in integer minuten (uur-modus). Afwezig ⇒ lagDays is de bron. */
  lagMinutes?: number;
  /** Lag-eenheid; afwezig ⇒ WORKTIME. */
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  /** Procentuele lag (% van voorgangerduur). Sluit lagDays uit. */
  lagPercent?: number;
}

// ── Resource ──

/** Effective-dated capaciteitsstap. Spiegelt `AvailabilityStep`. */
export interface ExtAvailabilityStep {
  from: string;
  maxUnits: number;
}

/** Ext-facing resource. Spiegelt {@link import('@/types/resource').Resource}. */
export interface ExtResource {
  id: string;
  name: string;
  type: 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW';
  description: string;
  costPerHour?: number;
  /** Capaciteit per werkdag (1 = 100%). */
  maxUnits: number;
  calendarId?: string;
  availabilitySteps?: ExtAvailabilityStep[];
  unitOfMeasure?: string;
  parentId?: string;
}

/** Ext-facing resource-toewijzing. Spiegelt {@link import('@/types/resource').ResourceAssignment}. */
export interface ExtAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  /** Eenheden per werkdag (1 = 100%). */
  unitsPerDay: number;
  curve?: 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';
}

// ── Importresultaat ──

/**
 * Ext-facing importresultaat — wat een importer-handler oplevert en wat `api.data.loadProject`
 * verwacht. Alleen de kernvelden; de host mapt dit naar zijn interne (rijkere) `ImportResult`
 * op de importer-/loadProject-grens (zie `extMappers.fromExtImportResult`).
 */
export interface ExtImportResult {
  project: ExtProject;
  calendar: ExtCalendar;
  tasks: ExtTask[];
  sequences: ExtSequence[];
  resources: ExtResource[];
  assignments: ExtAssignment[];
}
