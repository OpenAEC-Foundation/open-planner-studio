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
  scheduleStart: string;    // ISO 8601
  scheduleFinish: string;   // ISO 8601

  // CPM-computed
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;   // work days
  totalFloat: number;  // work days
  isCritical: boolean;

  // Tracking
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
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
  priority: number;
  parentId: string | null; // WBS parent
  childIds: string[];      // WBS children
  time: TaskTime;
  resourceIds: string[];
  color?: string;
  /** Activity-code-toewijzingen: codetype-id → waarde-id (max één waarde per type, P6-invariant). */
  activityCodes?: Record<string, string>;
  /** Custom-field-waarden: velddefinitie-id → waarde (getypeerd volgens CustomFieldDef.type). */
  customFields?: Record<string, CustomFieldValue>;
  /** Datum-constraint (fase 2.3); afwezig = ASAP. */
  constraint?: TaskConstraint;
  /** Zachte deadline (MSP-model): begrenst alleen de late finish — balken bewegen nooit;
   *  overschrijding (earlyFinish > deadline) geeft negatieve float + waarschuwing. */
  deadline?: string;
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
