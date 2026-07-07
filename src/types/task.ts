import { parseDate, formatDate, addBusinessDays } from '@/utils/dateUtils';
import type { CustomFieldValue } from '@/types/structure';

export type TaskType =
  | 'CONSTRUCTION'
  | 'INSTALLATION'
  | 'DEMOLITION'
  | 'LOGISTIC'
  | 'ATTENDANCE'
  | 'MOVE'
  | 'RENOVATION'
  | 'MAINTENANCE'
  | 'USERDEFINED';

export type TaskStatus = 'NOT_STARTED' | 'STARTED' | 'COMPLETED';

/**
 * Datum-constraints (fase 2.3), P6-soft-semantiek: een constraint breekt nooit de
 * netwerklogica — vroege-zijde types (SNET/FNET) zijn ondergrenzen in de forward pass,
 * late-zijde types (SNLT/FNLT) bovengrenzen in de backward pass; overtreding uit zich
 * als negatieve float, niet als verschoven balken. MSO/MFO werken als P6's "Start On"/
 * "Finish On": onder- én bovengrens tegelijk (de logica-brekende harde pin is bewust
 * niet geïmplementeerd; zie docs/superpowers/specs/2026-07-02-constraints-deadlines-design.md).
 * ALAP schuift de vroege datums op tot de vrije speling 0 is (P6-model).
 */
export type ConstraintType = 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

export interface TaskConstraint {
  type: ConstraintType;
  /** Vereist voor alle types behalve ASAP/ALAP; wordt bij toepassing op een werkdag gesnapt. */
  date?: string;
  /** OPTIONEEL — logica-brekende Mandatory-pin (fase 2.9). Alleen zinvol voor MSO/MFO.
   *  Afwezig/false ⇒ P6-soft "Start On"/"Finish On" (het huidige gedrag, byte-identiek).
   *  true ⇒ P6 Mandatory Start/Finish: pint ES én LF (MSO) resp. EF én LS (MFO) op de datum,
   *  overschrijft de logica, houdt TF=0 op de pin en drijft negatieve float upstream (§4.2). */
  hard?: boolean;
}

/**
 * Externe (cross-project) dependency (fase 2.9, §3.3). GEEN live multi-document-solve: de link
 * rekent altijd op de bevroren `anchorDate` (P6 External Dates). `sourceMissing` is puur een
 * UI-/versheids-signaal (§4.5/§5.5) — het gedrag hangt er niet van af.
 */
export interface ExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';   // is de externe taak mijn voorganger of opvolger?
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;                       // zelfde eenheid-conventie als Sequence (2.8b §3.3)
  /** Bevroren driving-datum van de andere kant (P6 External Dates, Rapport B §3.1). */
  anchorDate: string;                        // date-only (dag) of datetime (uur)
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  /** true ⇒ bronproject niet beschikbaar; de link rekent op de gecachte anchorDate (ghost, §5.5). */
  sourceMissing: boolean;
}

export type DurationType = 'WORKTIME' | 'ELAPSEDTIME';

/**
 * Soort mijlpaal (fase 2.4, P6 Start/Finish Milestone). Dag-granulair grens-model:
 * START ankert op een dagbegin, FINISH op een dageinde (einde werkdag F = begin
 * eerstvolgende werkdag). undefined = automatisch: het anker volgt de bindende
 * relatiezijde (FS/SS → start, FF/SF → finish) — het gedrag van vóór fase 2.4.
 */
export type MilestoneKind = 'START' | 'FINISH';

export interface TaskTime {
  durationType: DurationType;
  scheduleDuration: number; // in work days
  /** OPTIONEEL — canonieke duur in integer MINUTEN (fase 2.8b, §3.1). Aanwezig ⇒ bron van
   *  waarheid; het effectieve `scheduleDuration` is dan de afgeleide `minuten / (effHoursPerDay
   *  × 60)`. Afwezig ⇒ `scheduleDuration` (werkdagen) is de bron (dag-modus, byte-identiek).
   *  INVARIANT (Bevinding 2): `durationMinutes` wordt alleen gezet én gerespecteerd wanneer de
   *  effectieve kalender uur-modus is; op een dag-kalender is sub-dag-duur ongedefinieerd en
   *  valt `durationDaysOf` ALTIJD terug op `scheduleDuration` (nooit een fractionele dag in
   *  `addWorkDays`). Zie `src/engine/scheduler/duration.ts`. */
  durationMinutes?: number;
  scheduleStart: string;    // ISO 8601 — date-only in dag-modus, datetime in uur-modus
  scheduleFinish: string;   // ISO 8601 — date-only in dag-modus, datetime in uur-modus

  // CPM-computed
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;   // work days (fractioneel in uur-modus, §5.5)
  totalFloat: number;  // work days (fractioneel in uur-modus, §5.5)
  isCritical: boolean;
  /** OPTIONEEL — interfererende speling = totalFloat − freeFloat (getekend, fractioneel in
   *  uur-modus; fase 2.9, §4.6). Alleen geschreven wanneer de analyse-laag draait; afwezig ⇒
   *  byte-identiek default-document. */
  interferingFloat?: number;
  /** OPTIONEEL — near-critical-markering (fase 2.9, §4.6). Alleen geschreven bij ingestelde drempel. */
  isNearCritical?: boolean;
  /** OPTIONEEL — float-path-nummer (1 = meest kritiek; fase 2.9, §4.6). Alleen geschreven bij floatPaths. */
  floatPath?: number;

  // Tracking
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  /** OPTIONEEL — resterend werk in integer MINUTEN (uur-modus voortgang, fase 2.8b §5.3). */
  remainingMinutes?: number;
  completion: number; // 0.0 - 1.0
}

export interface Task {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType: TaskType;
  status: TaskStatus;
  isMilestone: boolean;
  /** Alleen relevant bij isMilestone; undefined = automatisch (zie MilestoneKind). */
  milestoneKind?: MilestoneKind;
  /** Verplichte (contractuele) mijlpaal — inspectie-/keurings-/opleverpunt. Markering
   *  voor rapportage & Gantt; datumbewaking loopt via constraint/deadline (fase 2.3). */
  mandatory?: boolean;
  /** Leveling-prioriteit (MSP-conventie, P6 "Activity Priority" analoog): 0–1000, default 500.
   *  1000 = "Do Not Level" (vastgepind, wordt door de nivelleerder nooit verschoven). Ongebruikt
   *  vóór fase 2.5 (was hardcoded 0 overal); vanaf 2.5 stuurt dit de nivelleervolgorde. */
  priority: number;
  /** Vertraging in werkdagen t.o.v. de precedence-feasible early start (de ES die de forward
   *  pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET t.o.v. de
   *  oorspronkelijke CPM-ES, dat zou voorgangersverschuivingen dubbel tellen). Gezet door de
   *  nivelleerder (fase 2.5, nog niet gebouwd). undefined = geen nivellering toegepast.
   *  "Nivellering wissen" zet dit overal terug naar undefined. */
  levelingDelay?: number;
  parentId: string | null; // WBS parent
  childIds: string[];      // WBS children
  time: TaskTime;
  resourceIds: string[];
  color?: string;
  /** Activity-code-toewijzingen: codetype-id → waarde-id (max één waarde per type, P6-invariant). */
  activityCodes?: Record<string, string>;
  /** Custom-field-waarden: velddefinitie-id → waarde (getypeerd volgens CustomFieldDef.type). */
  customFields?: Record<string, CustomFieldValue>;
  /** Datum-constraint (fase 2.3); afwezig = ASAP. PRIMAIR. */
  constraint?: TaskConstraint;
  /** OPTIONEEL — SECUNDAIRE constraint (fase 2.9, P6). Altijd soft (hard verboden op secundair).
   *  Combinatie-regel (P6, Rapport B §1.3): secundair NIET toegestaan als primair Start On/Finish On/
   *  Mandatory is; verder één forward-type + één backward-type die elkaar niet tegenspreken.
   *  Afwezig ⇒ geen tweede grens (byte-identiek). */
  constraint2?: TaskConstraint;
  /** OPTIONEEL — hammock/LOE (fase 2.9, §3.2/§4.4). Afwezig/false ⇒ gewone taak (byte-identiek).
   *  true ⇒ duur wordt AFGELEID (span tussen start-driver en finish-driver);
   *  scheduleDuration/durationMinutes worden genegeerd als invoer en overschreven met de span.
   *  Uitgesloten van het kritieke pad (isCritical altijd false). */
  isHammock?: boolean;
  /** OPTIONEEL — externe (cross-project) dependencies (fase 2.9, §3.3). Afwezig ⇒ geen (byte-identiek). */
  externalLinks?: ExternalLink[];
  /** Zachte deadline (MSP-model): begrenst alleen de late finish — balken bewegen nooit;
   *  overschrijding (earlyFinish > deadline) geeft negatieve float + waarschuwing. */
  deadline?: string;
  /** OPTIONEEL — id in de kalender-bibliotheek (fase 2.8a, §4). undefined = projectkalender
   *  (project.calendarId). Symmetrisch met Resource.calendarId. Bepaalt de kalender waarin de DUUR
   *  en de constraints van deze taak rekenen (§5). */
  calendarId?: string;
  /** OPTIONEEL — vrije aantekeningen/checklist per taak (fase 2.10, item 1). Afwezig ⇒ geen
   *  aantekeningen (byte-identiek). Puur een array-veld, geen dedicated store-acties nodig
   *  (mutaties via `updateTask(taskId, { notes })`). */
  notes?: { id: string; text: string; done: boolean }[];
}

export function createDefaultTaskTime(
  start: string,
  durationDays: number,
): TaskTime {
  // Derive a finish consistent with the duration so the Gantt bar spans the
  // right number of days before CPM runs. Matches CalendarEngine.addWorkDays
  // (inclusive, weekends skipped); runCPM later refines it with the full calendar.
  // Bij een onparseerbare start (bv. corrupte import) NIET formatteren — formatDate
  // (toISOString) gooit dan. Val terug op `start`; de CPM-solver vangt de ongeldige
  // datum verderop af met een nette foutmelding i.p.v. een crash.
  const startDate = parseDate(start);
  const finish =
    durationDays > 0 && !isNaN(startDate.getTime())
      ? formatDate(addBusinessDays(startDate, durationDays))
      : start;
  return {
    durationType: 'WORKTIME',
    scheduleDuration: durationDays,
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: start,
    earlyFinish: finish,
    lateStart: start,
    lateFinish: finish,
    freeFloat: 0,
    totalFloat: 0,
    isCritical: false,
    completion: 0,
  };
}
