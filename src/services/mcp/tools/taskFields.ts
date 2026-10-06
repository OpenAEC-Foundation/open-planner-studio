// MCP-bridge — EXPLICIETE veld-allowlist voor taak-invoer (`planner_add_tasks` items en
// `planner_update_tasks.fields`).
//
// WAAROM DIT BESTAAT: een kale `Partial<Task>`-merge (`Object.assign`) van `fields` geeft twee
// faalvormen:
//   1. STILLE NO-OP — `fields: { duration: 10 }` (de naam die de LEEStools teruggeven) plakt
//      `duration` als rommelveld op het Task-object; de tool antwoordt `ok` en er verandert niets.
//      De echte duur woont op `time.scheduleDuration`.
//   2. TAK-OVERSCHRIJVING — `fields: { time: {...} }` vervangt de HELE `time`-tak, waarmee
//      CPM-datums, floats, actuals en completion in één klap verdwijnen.
//
// Daarom: één allowlist met PLATTE, agent-vriendelijke namen die exact spiegelen wat
// `planner_get_task` teruggeeft (`duration`, `durationType`, `name`, …). Alles wat er niet in staat
// wordt HARD geweigerd met een bruikbare reden; niets wordt ooit stil geslikt. Geneste takken
// (`time`) zijn nooit rechtstreeks zetbaar — `duration`/`durationType` worden hier vertaald naar een
// veld-voor-veld `TaskTimePatch` die de draft-laag individueel toepast.
//
// DUUR-SEMANTIEK: `duration` staat in de eenheid van `durationUnit` (default `days`). In dagen mag
// een fractie (2.5) en wordt niet afgerond (de app kent fractionele dagtaken: CSV-import, Tabel
// "1d 4u"; afronden zou een ontwerpkeuze zijn, geen validatie) — WERKdagen voor de default
// `durationType: 'WORKTIME'`, KALENDERdagen (24/7, geen kalenderband-toetsing) voor
// `durationType: 'ELAPSEDTIME'` (zie `duration.ts`'s `elapsedMinutesOf` voor de bron van waarheid).
// `TaskTime.durationMinutes` is nooit rechtstreeks zetbaar. Bij `durationUnit: 'days'` wordt hij
// GEWIST — precies zoals de dag-tak van de gedeelde duurbediening (`time.scheduleDuration = durDays;
// time.durationMinutes = undefined`). Dat is de éne-bron-invariant: daarna mag uitsluitend
// `scheduleDuration` invoerbron zijn; een achtergebleven minutenwaarde zou een tweede, concurrerende
// bron vormen. Bij `durationUnit: 'hours'` (vereist een taakkalender met werkblokken) berekent de
// bridge de exacte minutenbron zelf.

import type {
  ConstraintType,
  DurationType,
  MilestoneKind,
  Task,
  TaskConstraint,
  TaskType,
} from '@/types/task';
import { TASK_TYPES } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import { isRecord } from '@/utils/guards';
import { customTaskTypeClashes } from '@/services/taskTypes/customTaskTypeRules';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { milestoneRefusal } from '@/engine/taskMilestoneTransition';
import {
  validateConstraintPair,
  withPrimaryConstraint,
  type ConstraintPairIssue,
} from '@/engine/scheduler/constraintValidation';

// --- Patch-vorm ----------------------------------------------------------------------------------

/** Veld-voor-veld-patch op `task.time`. NOOIT een hele `TaskTime` — alleen losse sleutels. */
export interface TaskTimePatch {
  scheduleDuration?: number;
  durationUnit?: 'days' | 'hours';
  /** Exacte minutenbron wanneer `durationUnit === 'hours'`. */
  durationMinutes?: number;
  durationType?: DurationType;
  /** true ⇒ `durationMinutes` VERWIJDEREN (dag-modus-schrijfregel, zie de kop). */
  clearDurationMinutes?: boolean;
}

/** Resultaat van een geldige veld-set: top-level velden + (optioneel) losse `time`-sleutels. */
export interface TaskFieldPatch {
  top: Partial<Task>;
  time?: TaskTimePatch;
  customTaskType?: CustomTaskType;
  /** De werkregel loopt NIET via de kale veld-merge maar via `draft.setTaskWorkRule` — een
   *  werkbeschermende regel legt bij het zetten het huidige restwerk van de toewijzingen vast. `null`
   *  = terug naar de projectstandaard. */
  workRule?: WorkRule | null;
}

/** Wat de validator over de DOELTAAK moet weten (bij aanmaak: een verse, lege taak). */
export interface TaskFieldContext {
  /** Huidige mijlpaal-status van de doeltaak (bij `add_tasks`: false). */
  currentIsMilestone: boolean;
  /** Heeft de doeltaak kinderen? (verzameltaak ⇒ geen mijlpaal). */
  hasChildren: boolean;
  /** Heeft de doeltaak resource-toewijzingen? (mijlpaal mag er geen dragen). */
  hasAssignments: boolean;
  /** De bestaande SECUNDAIRE constraint van de doeltaak (bij `add_tasks`: geen). Niet zetbaar via de
   *  bridge, maar een nieuw primair constraint moet er wél mee kloppen — en ASAP/ALAP/null wist hem,
   *  net als paneel en raster (`withPrimaryConstraint`). */
  currentConstraint2?: TaskConstraint;
  /** Bestaat deze kalender-id in de bibliotheek? */
  calendarExists: (id: string) => boolean;
  customTaskTypes: readonly CustomTaskType[];
  /** Effectieve kalender na een eventueel gelijktijdig `calendarId`-veld. */
  durationCalendar: (calendarId: string | null | undefined) => { hoursPerDay: number; hasWorkBlocks: boolean };
}

const DURATION_TYPES: DurationType[] = ['WORKTIME', 'ELAPSEDTIME'];
const CONSTRAINT_TYPES: ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];
const MILESTONE_KINDS: MilestoneKind[] = ['START', 'FINISH'];
/** Constraint-types zónder eigen datum (de rest vereist er één). */
const DATELESS_CONSTRAINTS: ConstraintType[] = ['ASAP', 'ALAP'];
/** Alleen op deze types heeft `hard` (P6 Mandatory) betekenis. */
const HARD_CONSTRAINTS: ConstraintType[] = ['MSO', 'MFO'];

/**
 * De volledige allowlist, in de volgorde waarin hij in foutmeldingen en schema's verschijnt.
 *
 * KEUZE-VERANTWOORDING (waarom deze, en niet meer):
 *  - `name`/`description`/`taskType`/`mandatory`/`milestoneKind` — platte, valideerbare
 *    top-level velden die de leestools ook teruggeven; geen enkel neveneffect.
 *  - `duration`/`durationType` — de ontbrekende hoofdrolspelers (zie de kop).
 *  - `isMilestone` — een taak alsnog tot mijlpaal maken is een reële agent-behoefte; de
 *    duur-0-invariant + de "geen kinderen/toewijzingen"-guard worden hier afgedwongen.
 *  - `priority` — stuurt `planner_level_resources`; er is geen andere weg om hem te zetten.
 *  - `constraint`/`deadline` — de hefbomen voor wat-als-werk die de tool-beschrijving al belooft.
 *  - `calendarId` — taak-kalender; geen aparte tool, en een onbekend id zou stil op de
 *    projectkalender terugvallen — daarom hier gevalideerd.
 * BEWUST NIET (elk met een gerichte weiger-hint hieronder): `time`/`status` (voortgangspad =
 * `progress`), `parentId` (`planner_move_task`), `resourceIds` (`planner_manage_assignments`),
 * `constraint2` (P6-combinatieregels die de bridge niet valideert), `isHammock` (maakt de duur
 * AFGELEID en zou duur-invoer opnieuw stil laten verdampen), `wbsCode`/`childIds`/`id`
 * (afgeleid/structureel), en de vrije-vorm-bakken `notes`/`color`/`activityCodes`/`customFields`/
 * `externalLinks`/`levelingDelay` (geen validatie mogelijk, geen leestool-tegenhanger), en evenzo
 * `levelingDelayMinutes`/`levelingDelayElapsed`, `manuallyScheduled` (isHammock-patroon) en
 * `splitGaps` (eigen tool: `planner_set_task_splits`).
 */
export const TASK_FIELD_NAMES = [
  'name',
  'description',
  'duration',
  'durationUnit',
  'durationType',
  'taskType',
  'customTaskType',
  'isMilestone',
  'milestoneKind',
  'mandatory',
  'priority',
  'constraint',
  'deadline',
  'calendarId',
  'workRule',
] as const;

/** Gerichte hints voor sleutels die een agent redelijkerwijs probeert maar die hier niet horen. */
const REJECT_HINTS: Record<string, string> = {
  time: 'set the duration with `duration` (in days, a fraction such as 2.5 is allowed — working days for WORKTIME, calendar days for ELAPSEDTIME) and the duration type with `durationType` — the `time` branch itself is not settable (that would clear CPM dates, floats and actuals)',
  scheduleDuration: 'use `duration` (in days, a fraction such as 2.5 is allowed — working days for WORKTIME, calendar days for ELAPSEDTIME)',
  durationMinutes: 'use `duration` with `durationUnit: "hours"`; the bridge calculates and stores the exact minute source itself',
  status: 'use `progress` (progress path), not `fields.status`',
  completion: 'use `progress.completion` (0–100)',
  actualStart: 'use `progress.actualStart`',
  actualFinish: 'use `progress.actualFinish`',
  parentId: 'use planner_move_task to re-parent a task',
  childIds: 'the WBS tree changes via planner_move_task / planner_add_tasks',
  resourceIds: 'use planner_manage_assignments',
  wbsCode: 'the WBS code is derived',
  id: 'the task id is fixed',
  constraint2: 'a secondary constraint is not settable via the bridge (P6 combination rules are not validated here)',
  isHammock: 'hammock/LOE is not settable via the bridge (the duration is then derived and ignores `duration`)',
  notes: 'task notes are not settable via the bridge',
  // Niet via `fields` zetbaar. `manuallyScheduled` volgt het isHammock-patroon (leesbaar via de
  // leestools, hier geweigerd); levelingDelayMinutes/levelingDelayElapsed volgen de "vrije-vorm-bak,
  // geen leestool-tegenhanger"-redenering van levelingDelay; splitGaps heeft een eigen tool.
  splitGaps: 'work interruptions (splits) are set with planner_set_task_splits (`interruptions` on the work axis: afterWorkDays/pauseDays or afterWorkHours/pauseHours), not via `fields`',
  manuallyScheduled: 'manual scheduling is not settable via the bridge (the dates then stay RAW, regardless of calendar/relationships/`duration`)',
  levelingDelayMinutes: 'sub-day leveling delay is not settable via the bridge (no read-tool counterpart, see `levelingDelay`)',
  levelingDelayElapsed: 'sub-day leveling delay is not settable via the bridge (no read-tool counterpart, see `levelingDelay`)',
  // Drie .mpp-importvelden, puur data — read-only, geen agent-invoervorm; geen van drieën heeft een
  // schrijf-workflow om te valideren.
  mspTaskType: 'MSP\'s own Task Type is not settable via the bridge (pure .mpp import data, no calculation behaviour — see planner_get_task)',
  effortDriven: 'MSP\'s "Effort Driven" flag is not settable via the bridge (pure .mpp import data, no calculation behaviour — see planner_get_task)',
  timephasedContours: 'the raw contour periods are not settable via the bridge (derived from an .mpp import, no agent input form — see planner_get_task)',
  // De werkvelden per TOEWIJZING zijn geen taakvelden.
  remainingWorkMinutes: 'remaining work belongs to an ASSIGNMENT: planner_manage_assignments `update` with `remainingWorkMinutes`',
  plannedWorkMinutes: 'budgeted work is not settable via the bridge (reference value from an import — see planner_get_task)',
  actualWorkMinutes: 'actual work is not settable via the bridge (a fact from an import; progress goes through `progress`)',
  // P6/.xer-importvelden, zelfde "read-only, geen agent-invoervorm"-redenering als
  // mspTaskType/effortDriven hierboven.
  p6DurationType: 'P6\'s own Duration Type is not settable via the bridge (pure .xer import data, no calculation behaviour — see planner_get_task)',
  p6ActivityType: 'P6\'s own Activity Type is not settable via the bridge (pure .xer import data, no calculation behaviour — see planner_get_task)',
  p6ExplicitTargetWindow: 'the P6 XER provenance for an explicit target window is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6SuspendResume: 'the P6 suspend/resume provenance flag is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6ProjectId: 'P6\'s source project id is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6TaskId: 'P6\'s source activity id is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6CompletePctType: 'P6\'s Completion Percent Type is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6ExpectedFinish: 'P6\'s Expected Finish is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
};

/** Uitkomst van de veldvalidatie. */
export type TaskFieldResult =
  | { ok: true; patch: TaskFieldPatch }
  | { ok: false; reason: string };

function allowedList(): string {
  return TASK_FIELD_NAMES.join(', ');
}

function rejectUnknown(key: string): string {
  const hint = REJECT_HINTS[key];
  return hint
    ? `unknown field '${key}': ${hint}. Allowed: ${allowedList()}`
    : `unknown field '${key}'; allowed: ${allowedList()}`;
}

/** ISO-datum (date-only of datetime) die ook echt parseert. */
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

/** Validatie van één `constraint`-object. */
function parseConstraint(raw: unknown): { ok: true; value: TaskConstraint } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: '`constraint` must be an object ({ type, date?, hard? }) or null to clear it' };
  const type = raw.type;
  if (typeof type !== 'string' || !(CONSTRAINT_TYPES as string[]).includes(type)) {
    return { ok: false, reason: `\`constraint.type\` must be one of ${CONSTRAINT_TYPES.join(' | ')}` };
  }
  const ct = type as ConstraintType;
  const needsDate = !DATELESS_CONSTRAINTS.includes(ct);
  if (needsDate && !isIsoDate(raw.date)) {
    return { ok: false, reason: `\`constraint.date\` (ISO date) is required for type ${ct}` };
  }
  if (raw.date !== undefined && !isIsoDate(raw.date)) {
    return { ok: false, reason: '`constraint.date` must be an ISO date (YYYY-MM-DD)' };
  }
  if (raw.hard !== undefined) {
    if (typeof raw.hard !== 'boolean') return { ok: false, reason: '`constraint.hard` must be a boolean' };
    if (raw.hard && !HARD_CONSTRAINTS.includes(ct)) {
      // Stil negeren zou weer een no-op zijn: `hard` doet alleen iets op MSO/MFO.
      return { ok: false, reason: `\`constraint.hard\` only has meaning for ${HARD_CONSTRAINTS.join('/')}, not for ${ct}` };
    }
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'type' && k !== 'date' && k !== 'hard') {
      return { ok: false, reason: `unknown field '${k}' in \`constraint\`; allowed: type, date, hard` };
    }
  }
  return {
    ok: true,
    value: {
      type: ct,
      ...(isIsoDate(raw.date) ? { date: raw.date } : {}),
      ...(raw.hard === true ? { hard: true } : {}),
    },
  };
}

/** Waarom een nieuw primair constraint niet naast de bestaande secundaire past — agent-leesbaar. */
const CONSTRAINT_PAIR_REASONS: Record<ConstraintPairIssue, string> = {
  'no-secondary-with-mandatory-or-on': 'MSO/MFO (or a hard pin) already fixes start and finish and tolerates no secondary constraint',
  'no-secondary-with-asap-alap': 'ASAP/ALAP carries no date bound and tolerates no secondary constraint',
  'secondary-same-side': 'primary and secondary would then both be a lower bound (SNET/FNET) or both an upper bound (SNLT/FNLT)',
  'secondary-type-invalid': 'the secondary constraint must be SNET, FNET, SNLT or FNLT',
  'secondary-hard-forbidden': 'a secondary constraint may never be hard',
};

function constraintPairReason(
  pair: { constraint: TaskConstraint | undefined; constraint2: TaskConstraint | undefined },
  issues: readonly ConstraintPairIssue[],
): string {
  const primary = pair.constraint?.type ?? 'ASAP';
  const secondary = pair.constraint2 ? `${pair.constraint2.type} ${pair.constraint2.date ?? ''}`.trim() : '?';
  return `\`constraint\` ${primary} does not form a valid pair with the existing secondary constraint (` +
    `${secondary}): ${issues.map(issue => CONSTRAINT_PAIR_REASONS[issue]).join('; ')}. The secondary ` +
    'constraint is not settable via the bridge; `constraint: null` clears both, or choose a primary type on ' +
    'the other side of the bound';
}

/**
 * Valideer + vertaal een veld-set (uit `update_tasks.fields` of een `add_tasks`-item) naar een
 * `TaskFieldPatch`. ALLES-OF-NIETS: bij de eerste fout komt er géén (halve) patch terug — de
 * aanroeper weigert het item in zijn geheel, zodat een rotte sleutel nooit een deel-mutatie
 * achterlaat.
 */
export function parseTaskFields(raw: unknown, ctx: TaskFieldContext): TaskFieldResult {
  if (!isRecord(raw)) return { ok: false, reason: '`fields` must be an object' };
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: false, reason: '`fields` is empty' };

  for (const k of keys) {
    if (!(TASK_FIELD_NAMES as readonly string[]).includes(k)) return { ok: false, reason: rejectUnknown(k) };
  }

  const top: Partial<Task> = {};
  const time: TaskTimePatch = {};
  let customTaskType: CustomTaskType | undefined;

  // Effectieve mijlpaal-status: wat er ná deze patch geldt (de duur-0-invariant hangt daaraan).
  const effMilestone = 'isMilestone' in raw ? raw.isMilestone === true : ctx.currentIsMilestone;

  if ('name' in raw) {
    if (typeof raw.name !== 'string' || raw.name.trim() === '') return { ok: false, reason: '`name` must be a non-empty string' };
    top.name = raw.name;
  }
  if ('description' in raw) {
    if (typeof raw.description !== 'string') return { ok: false, reason: '`description` must be a string' };
    top.description = raw.description;
  }
  if ('duration' in raw) {
    const d = raw.duration;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) {
      return { ok: false, reason: '`duration` must be a finite number ≥ 0 in the unit of `durationUnit`' };
    }
    if (effMilestone && d > 0) {
      return { ok: false, reason: `a milestone has duration 0 by definition; \`duration\`=${d} is not allowed` };
    }
    const unit = raw.durationUnit ?? 'days';
    if (unit !== 'days' && unit !== 'hours') {
      return { ok: false, reason: '`durationUnit` must be `days` or `hours`' };
    }
    if (unit === 'hours') {
      const cal = ctx.durationCalendar(
        typeof raw.calendarId === 'string' || raw.calendarId === null ? raw.calendarId : undefined,
      );
      if (!cal.hasWorkBlocks) {
        return { ok: false, reason: 'an hour task requires a task calendar with concrete work blocks' };
      }
      const minutes = Math.round(d * 60);
      time.durationUnit = 'hours';
      time.durationMinutes = minutes;
      time.scheduleDuration = cal.hoursPerDay > 0 ? minutes / (cal.hoursPerDay * 60) : 0;
    } else {
      time.scheduleDuration = d;
      time.durationUnit = 'days';
      time.clearDurationMinutes = true;
    }
  } else if ('durationUnit' in raw) {
    return { ok: false, reason: '`durationUnit` must be given together with `duration`; the bridge does not reinterpret an existing number' };
  }
  if ('durationType' in raw) {
    if (typeof raw.durationType !== 'string' || !(DURATION_TYPES as string[]).includes(raw.durationType)) {
      return { ok: false, reason: `\`durationType\` must be ${DURATION_TYPES.join(' or ')}` };
    }
    time.durationType = raw.durationType as DurationType;
  }
  if ('taskType' in raw) {
    if (typeof raw.taskType !== 'string' || !(TASK_TYPES as string[]).includes(raw.taskType)) {
      return { ok: false, reason: `\`taskType\` must be one of ${TASK_TYPES.join(' | ')}` };
    }
    top.taskType = raw.taskType as TaskType;
    if (raw.taskType !== 'USERDEFINED') top.customTaskTypeId = undefined;
  }
  if ('customTaskType' in raw) {
    const value = raw.customTaskType;
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
      || value.id.trim() === '' || value.name.trim() === '') {
      return { ok: false, reason: '`customTaskType` must be { id, name } with non-empty strings' };
    }
    if ('taskType' in raw && raw.taskType !== 'USERDEFINED') {
      return { ok: false, reason: '`customTaskType` requires taskType USERDEFINED (or leave taskType out)' };
    }
    const candidate = { id: value.id.trim(), name: value.name.trim() };
    const { sameId, sameNameOtherId } = customTaskTypeClashes(ctx.customTaskTypes, candidate);
    if (sameId && sameId.name !== candidate.name) {
      return { ok: false, reason: `customTaskType id '${candidate.id}' already exists with project snapshot '${sameId.name}'` };
    }
    if (sameNameOtherId) {
      return { ok: false, reason: `customTaskType name '${candidate.name}' already exists with id '${sameNameOtherId.id}'` };
    }
    customTaskType = candidate;
    top.taskType = 'USERDEFINED';
    top.customTaskTypeId = candidate.id;
  }
  if ('isMilestone' in raw) {
    if (typeof raw.isMilestone !== 'boolean') return { ok: false, reason: '`isMilestone` must be a boolean' };
    if (raw.isMilestone) {
      // Dezelfde "wordt mijlpaal"-regel als paneel, dialoog, contextmenu, store en raster.
      const refusal = milestoneRefusal(ctx);
      if (refusal === 'summary') return { ok: false, reason: 'a summary task (with children) cannot become a milestone' };
      if (refusal === 'assignments') return { ok: false, reason: 'a task with resource assignments cannot become a milestone; remove the assignments first' };
      // Mijlpaal ⇒ duur 0 (en géén achtergebleven minutenduur), spiegelt TaskDialog/TaskMilestoneFields.
      time.scheduleDuration = 0;
      time.durationUnit = 'days';
      time.clearDurationMinutes = true;
    }
    top.isMilestone = raw.isMilestone;
  }
  if ('milestoneKind' in raw) {
    const mk = raw.milestoneKind;
    if (mk === null) top.milestoneKind = undefined;
    else if (typeof mk === 'string' && (MILESTONE_KINDS as string[]).includes(mk)) top.milestoneKind = mk as MilestoneKind;
    else return { ok: false, reason: `\`milestoneKind\` must be ${MILESTONE_KINDS.join(' or ')} (or null to clear it)` };
  }
  if ('mandatory' in raw) {
    if (typeof raw.mandatory !== 'boolean') return { ok: false, reason: '`mandatory` must be a boolean' };
    top.mandatory = raw.mandatory;
  }
  if ('priority' in raw) {
    const p = raw.priority;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 1000) {
      return { ok: false, reason: '`priority` must be an integer 0–1000 (500 = normal, 1000 = do not level)' };
    }
    top.priority = p;
  }
  if ('constraint' in raw) {
    let next: TaskConstraint | undefined;
    if (raw.constraint !== null) {
      const c = parseConstraint(raw.constraint);
      if (!c.ok) return { ok: false, reason: c.reason };
      next = c.value;
    }
    // Zelfde canonicalisatie als paneel en raster: null/ASAP wist ook de secundaire constraint,
    // ALAP eveneens; een datumconstraint moet met de bestaande secundaire een geldig paar vormen.
    // Anders blijft `constraint2` na "constraint wissen" stil staan en blijft de taak begrensd.
    const pair = withPrimaryConstraint(next, ctx.currentConstraint2);
    const validation = validateConstraintPair(pair.constraint, pair.constraint2);
    if (!validation.ok) return { ok: false, reason: constraintPairReason(pair, validation.issues) };
    top.constraint = pair.constraint;
    if (ctx.currentConstraint2 && !pair.constraint2) top.constraint2 = undefined;
  }
  if ('deadline' in raw) {
    if (raw.deadline === null) top.deadline = undefined;
    else if (isIsoDate(raw.deadline)) top.deadline = raw.deadline;
    else return { ok: false, reason: '`deadline` must be an ISO date (YYYY-MM-DD) or null to clear it' };
  }
  let workRule: WorkRule | null | undefined;
  if ('workRule' in raw) {
    if (raw.workRule === null) workRule = null;
    else if (typeof raw.workRule === 'string' && (WORK_RULES as readonly string[]).includes(raw.workRule)) workRule = raw.workRule as WorkRule;
    else return { ok: false, reason: `\`workRule\` must be one of ${WORK_RULES.join(' | ')} (or null for the project default)` };
  }
  if ('calendarId' in raw) {
    if (raw.calendarId === null) top.calendarId = undefined;
    else if (typeof raw.calendarId !== 'string') return { ok: false, reason: '`calendarId` must be a string (or null for the project calendar)' };
    else if (!ctx.calendarExists(raw.calendarId)) {
      return { ok: false, reason: `unknown calendarId '${raw.calendarId}' (see planner_get_calendars)` };
    } else top.calendarId = raw.calendarId;
  }

  const hasTime = Object.keys(time).length > 0;
  return {
    ok: true,
    patch: {
      top,
      ...(hasTime ? { time } : {}),
      ...(customTaskType ? { customTaskType } : {}),
      ...(workRule !== undefined ? { workRule } : {}),
    },
  };
}

// --- Voortgangs-allowlist (`update_tasks.progress`) ----------------------------------------------
//
// ZELFDE RISICO ALS `fields`, ANDERE TAK: `progress.applyProgressUpdate` leest exact drie sleutels
// (`completion`/`actualStart`/`actualFinish`). `progress: { percent: 50 }` raakt geen van die drie ⇒
// `touchesProgress` blijft false ⇒ zelfs de statusdatum-guard slaat over ⇒ `{ applied: true }` ⇒ de
// tool zou `updated: ['t1']` antwoorden terwijl de taak op 0% blijft. Idem voor `progress: {}`.
// Daarom hier dezelfde behandeling als `fields`: expliciete allowlist, onbekende sleutel bij NAAM
// geweigerd, en een `progress` zonder ook maar één bekende sleutel geweigerd.

/** De enige sleutels die `applyProgressUpdate` daadwerkelijk leest. */
export const PROGRESS_FIELD_NAMES = ['completion', 'actualStart', 'actualFinish'] as const;

/** Gerichte hints voor voortgangs-sleutels die een agent redelijkerwijs probeert. */
const PROGRESS_REJECT_HINTS: Record<string, string> = {
  percent: 'use `completion` (PERCENT 0–100)',
  percentage: 'use `completion` (PERCENT 0–100)',
  percentComplete: 'use `completion` (PERCENT 0–100)',
  percent_complete: 'use `completion` (PERCENT 0–100)',
  progress: 'use `completion` (PERCENT 0–100)',
  complete: 'use `completion` (PERCENT 0–100)',
  completed: 'use `completion` (PERCENT 0–100)',
  status: 'the status is DERIVED from `completion` and the actuals; it is not directly settable',
  start: 'use `actualStart` (ISO date)',
  finish: 'use `actualFinish` (ISO date)',
  end: 'use `actualFinish` (ISO date)',
  actual_start: 'use `actualStart` (ISO date)',
  actual_finish: 'use `actualFinish` (ISO date)',
  remaining: 'the remaining duration is derived from `completion`',
  remainingTime: 'the remaining duration is derived from `completion`',
};

/** Wat `applyProgressUpdate` als update-object verwacht. */
export interface ProgressPatch {
  completion?: number;
  actualStart?: string;
  actualFinish?: string;
}

export type ProgressParseResult =
  | { ok: true; value: ProgressPatch }
  | { ok: false; reason: string };

/**
 * Valideer één `progress`-blok tegen de allowlist. ALLES-OF-NIETS, net als `parseTaskFields`.
 *
 * `actualStart`/`actualFinish` mogen `null` of `''` zijn: dat is de bestaande WIS-vorm
 * (`applyProgressUpdate` doet `update.actualX || undefined`, en de sleutel-aanwezigheid is wat telt).
 * Die vorm wordt hier naar een expliciete `undefined` genormaliseerd, zodat de sleutel aanwezig blijft.
 */
export function parseProgress(raw: unknown): ProgressParseResult {
  if (!isRecord(raw)) return { ok: false, reason: '`progress` must be an object ({ completion?, actualStart?, actualFinish? })' };
  const keys = Object.keys(raw);
  const allowed = PROGRESS_FIELD_NAMES.join(', ');
  if (keys.length === 0) {
    return { ok: false, reason: `\`progress\` is empty; give at least one of: ${allowed}` };
  }
  for (const k of keys) {
    if (!(PROGRESS_FIELD_NAMES as readonly string[]).includes(k)) {
      const hint = PROGRESS_REJECT_HINTS[k];
      return {
        ok: false,
        reason: hint
          ? `unknown field '${k}' in \`progress\`: ${hint}. Allowed: ${allowed}`
          : `unknown field '${k}' in \`progress\`; allowed: ${allowed}`,
      };
    }
  }

  const value: ProgressPatch = {};
  if ('completion' in raw) {
    const c = raw.completion;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      return { ok: false, reason: '`progress.completion` must be a number (PERCENT 0–100)' };
    }
    value.completion = c;
  }
  for (const k of ['actualStart', 'actualFinish'] as const) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (v === null || v === undefined || v === '') {
      value[k] = undefined; // WIS-vorm: sleutel aanwezig, waarde leeg
      continue;
    }
    if (!isIsoDate(v)) {
      return { ok: false, reason: `\`progress.${k}\` must be an ISO date (YYYY-MM-DD) or null to clear it` };
    }
    value[k] = v;
  }
  return { ok: true, value };
}

// --- JSON-schema ---------------------------------------------------------------------------------

/** De schema-properties van de allowlist — gedeeld door `add_tasks`-items en `update_tasks.fields`,
 *  zodat schema en runtime-validatie niet uit elkaar kunnen lopen. */
export const TASK_FIELD_SCHEMA_PROPERTIES: Record<string, unknown> = {
  name: { type: 'string', description: 'Task name (not empty).' },
  description: { type: 'string' },
  duration: {
    type: 'number',
    minimum: 0,
    description:
      'Native task duration in the unit of `durationUnit` (default days for backward compatibility). In days ' +
      'a fraction is allowed (2.5); the bridge does not round it, but a WORKTIME day task does occupy whole ' +
      'working days in its dates (2.5 ⇒ 3). Milestone ⇒ must be 0.',
  },
  durationUnit: {
    type: 'string',
    enum: ['days', 'hours'],
    description: 'Persistent task unit. Always give it together with `duration`; hours requires concrete work blocks.',
  },
  durationType: { type: 'string', enum: ['WORKTIME', 'ELAPSEDTIME'], description: 'WORKTIME = working days (default), ELAPSEDTIME = elapsed time.' },
  taskType: { type: 'string', enum: TASK_TYPES },
  customTaskType: {
    type: 'object',
    description: 'OPS custom type with a stable id and project snapshot name; sets taskType to USERDEFINED. An existing id cannot change its name.',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
    required: ['id', 'name'], additionalProperties: false,
  },
  isMilestone: {
    type: 'boolean',
    description:
      'Milestone: true sets the duration to 0 right away (not allowed on a summary task or a task with ' +
      'assignments). false leaves the duration at 0 until you send `duration` in the same or a later call.',
  },
  milestoneKind: { type: ['string', 'null'], enum: ['START', 'FINISH', null], description: 'Anchor of the milestone; null = automatic.' },
  mandatory: { type: 'boolean', description: 'Mandatory (contractual) milestone — marker for reporting.' },
  priority: { type: 'integer', minimum: 0, maximum: 1000, description: 'Leveling priority (default 500; 1000 = never shift).' },
  constraint: {
    type: ['object', 'null'],
    description: 'Date constraint; null clears it. `date` is required except for ASAP/ALAP; `hard` only for ' +
      'MSO/MFO. null, ASAP and ALAP also clear an existing secondary constraint; a date type that does not ' +
      'form a valid pair with that secondary one is refused.',
    properties: {
      type: { type: 'string', enum: ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'] },
      date: { type: 'string', description: 'ISO date (YYYY-MM-DD).' },
      hard: { type: 'boolean', description: 'P6 Mandatory pin; only for MSO/MFO.' },
    },
    required: ['type'],
    additionalProperties: false,
  },
  deadline: { type: ['string', 'null'], description: 'Soft deadline (ISO date); only bounds the late finish. null clears it.' },
  calendarId: { type: ['string', 'null'], description: 'Task calendar from the library (planner_get_calendars); null = project calendar.' },
  workRule: {
    type: ['string', 'null'],
    enum: [...WORK_RULES, null],
    description:
      'Work rule (task type) of the task: which corner of work = remaining duration × units stays fixed when ' +
      'another changes. FIXED_DURATION_RATE (default, MSP "Fixed Duration", not effort-driven): duration and ' +
      'units stay, the work follows. FIXED_DURATION_WORK (P6 "Fixed Duration & Units"): duration and work ' +
      'stay, the units follow. FIXED_WORK (MSP "Fixed Work", P6 "Fixed Units"): the work stays; more units ' +
      'or an extra resource make the task shorter. FIXED_RATE (MSP "Fixed Units" effort-driven, P6 "Fixed ' +
      'Units/Time"): the units stay; more work makes the task longer. Switching only the rule changes no ' +
      'number at all. null = back to the project default (planner_update_project `defaultWorkRule`). Only ' +
      'works on ordinary leaf tasks (not on milestones, summary tasks, hammocks or ELAPSEDTIME tasks).',
  },
};

/** Eén regel voor in tool-beschrijvingen: welke velden er zijn en dat de rest hard weigert. */
export const TASK_FIELDS_DOC =
  `Allowed fields: ${TASK_FIELD_NAMES.join(', ')}. Any other key is REFUSED with a reason (never silently ` +
  'ignored) and leaves the whole item unchanged. `duration` follows `durationUnit` (`days` or `hours`; ' +
  'without a unit the backward-compatible day rule stays). Give both together to change the unit ' +
  'deliberately; the `time` branch itself, `status`, `parentId` and `resourceIds` are deliberately not ' +
  'settable here (use `progress`, planner_move_task and planner_manage_assignments respectively). `workRule` ' +
  'sets the task type (work = remaining duration × units; see the field description) — remaining work per ' +
  'assignment is set with planner_manage_assignments.';
