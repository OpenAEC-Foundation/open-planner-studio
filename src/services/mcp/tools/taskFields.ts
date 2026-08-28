// MCP-bridge — EXPLICIETE veld-allowlist voor taak-invoer (`planner_add_tasks` items en
// `planner_update_tasks.fields`).
//
// WAAROM DIT BESTAAT (root-cause van de duur-bug): `fields` was een kale `Partial<Task>`-merge
// (`Object.assign`). Twee faalvormen kwamen daaruit voort:
//   1. STILLE NO-OP — een agent stuurde `fields: { duration: 10 }` (de naam die de LEEStools
//      teruggeven), `Object.assign` plakte `duration` als rommelveld op het Task-object, de tool
//      antwoordde `ok` en er veranderde niets. De echte duur woont op `time.scheduleDuration`.
//   2. TAK-OVERSCHRIJVING — `fields: { time: {...} }` verving de HELE `time`-tak, waarmee
//      CPM-datums, floats, actuals en completion in één klap verdwenen.
//
// Daarom: één allowlist met PLATTE, agent-vriendelijke namen die exact spiegelen wat
// `planner_get_task` teruggeeft (`duration`, `durationType`, `name`, …). Alles wat er niet in staat
// wordt HARD geweigerd met een bruikbare reden; niets wordt ooit stil geslikt. Geneste takken
// (`time`) zijn nooit rechtstreeks zetbaar — `duration`/`durationType` worden hier vertaald naar een
// veld-voor-veld `TaskTimePatch` die de draft-laag individueel toepast.
//
// DUUR-SEMANTIEK (dag-modus): `duration` is ALTIJD in hele dagen — WERKdagen voor de default
// `durationType: 'WORKTIME'`, KALENDERdagen (24/7, geen kalenderband-toetsing) voor
// `durationType: 'ELAPSEDTIME'` (T8, T8-review L1-correctie: eerdere versies van deze regel
// spraken uitsluitend van "werkdagen" zonder dat onderscheid — zie `duration.ts`'s
// `elapsedMinutesOf` voor de bron van waarheid). `TaskTime.durationMinutes`
// (uur-modus, fase 2.8b) is via de bridge NIET zetbaar; wél wordt hij bij elke duur-wijziging
// GEWIST — precies zoals de dag-tak van de gedeelde duurbediening (`time.scheduleDuration = durDays;
// time.durationMinutes = undefined`). Dat is geen detail maar de éne-bron-invariant: deze bridge
// zet expliciet `durationUnit: 'days'`, waarna uitsluitend `scheduleDuration` invoerbron mag zijn.
// Een achtergebleven minutenwaarde zou een tweede, concurrerende bron vormen.

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
}

/** Wat de validator over de DOELTAAK moet weten (bij aanmaak: een verse, lege taak). */
export interface TaskFieldContext {
  /** Huidige mijlpaal-status van de doeltaak (bij `add_tasks`: false). */
  currentIsMilestone: boolean;
  /** Heeft de doeltaak kinderen? (verzameltaak ⇒ geen mijlpaal). */
  hasChildren: boolean;
  /** Heeft de doeltaak resource-toewijzingen? (mijlpaal mag er geen dragen). */
  hasAssignments: boolean;
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
 * KEUZE-VERANTWOORDING (waarom deze twaalf, en niet meer):
 *  - `name`/`description`/`taskType`/`mandatory`/`milestoneKind` — platte, valideerbare
 *    top-level velden die de leestools ook teruggeven; geen enkel neveneffect.
 *  - `duration`/`durationType` — de ontbrekende hoofdrolspelers (zie de kop).
 *  - `isMilestone` — een taak alsnog tot mijlpaal maken is een reële agent-behoefte; de
 *    duur-0-invariant + de "geen kinderen/toewijzingen"-guard worden hier afgedwongen.
 *  - `priority` — stuurt `planner_level_resources`; er is geen andere weg om hem te zetten.
 *  - `constraint`/`deadline` — de hefbomen voor wat-als-werk die de tool-beschrijving al belooft.
 *  - `calendarId` — taak-kalender (fase 2.8a); geen aparte tool, en een onbekend id zou stil op de
 *    projectkalender terugvallen — daarom hier gevalideerd.
 * BEWUST NIET (elk met een gerichte weiger-hint hieronder): `time`/`status` (voortgangspad =
 * `progress`), `parentId` (`planner_move_task`), `resourceIds` (`planner_manage_assignments`),
 * `constraint2` (P6-combinatieregels die de bridge niet valideert), `isHammock` (maakt de duur
 * AFGELEID en zou duur-invoer opnieuw stil laten verdampen), `wbsCode`/`childIds`/`id`
 * (afgeleid/structureel), en de vrije-vorm-bakken `notes`/`color`/`activityCodes`/`customFields`/
 * `externalLinks`/`levelingDelay` (geen validatie mogelijk, geen leestool-tegenhanger). Z14 voegde
 * daar vier Z0-typecontractvelden aan toe, zelfde behandeling: `splitGaps`/`levelingDelayMinutes`/
 * `levelingDelayElapsed` (vrije-vorm/geen leestool) en `manuallyScheduled` (isHammock-patroon).
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
] as const;

/** Gerichte hints voor sleutels die een agent redelijkerwijs probeert maar die hier niet horen. */
const REJECT_HINTS: Record<string, string> = {
  time: 'zet de duur met `duration` (hele dagen — werkdagen bij WORKTIME, kalenderdagen bij ELAPSEDTIME) en het duurtype met `durationType` — de `time`-tak zelf is niet zetbaar (dat zou CPM-datums, floats en actuals wissen)',
  scheduleDuration: 'gebruik `duration` (hele dagen — werkdagen bij WORKTIME, kalenderdagen bij ELAPSEDTIME)',
  durationMinutes: 'gebruik `duration` met `durationUnit: "hours"`; de bridge berekent en bewaart de exacte minutenbron zelf',
  status: 'gebruik `progress` (voortgangspad), niet `fields.status`',
  completion: 'gebruik `progress.completion` (0–100)',
  actualStart: 'gebruik `progress.actualStart`',
  actualFinish: 'gebruik `progress.actualFinish`',
  parentId: 'gebruik planner_move_task om een taak te verhangen',
  childIds: 'de WBS-boom wijzigt via planner_move_task / planner_add_tasks',
  resourceIds: 'gebruik planner_manage_assignments',
  wbsCode: 'de WBS-code wordt afgeleid',
  id: 'het taak-id ligt vast',
  constraint2: 'een secundaire constraint is via de bridge niet zetbaar (P6-combinatieregels worden hier niet gevalideerd)',
  isHammock: 'hammock/LOE is via de bridge niet zetbaar (de duur wordt dan afgeleid en negeert `duration`)',
  notes: 'taak-aantekeningen zijn via de bridge niet zetbaar',
  // Z14 (etappe "nul afwijkingen"): vier Z0-typecontractvelden, expliciet NIET zetbaar via de
  // bridge (O3-besluit voor manuallyScheduled: "MCP-kant volgt Z14's allowlist-besluit; conform het
  // bestaande isHammock-patroon" — d.w.z. leesbaar via de leestools, maar hier geweigerd, net als
  // isHammock hierboven). splitGaps/levelingDelayMinutes/levelingDelayElapsed volgen dezelfde
  // "vrije-vorm-bak, geen leestool-tegenhanger"-redenering als levelingDelay (zie de klasse-toelichting
  // bovenaan dit bestand).
  splitGaps: 'werkonderbrekingen (splits) zijn via de bridge niet zetbaar (offset-gebaseerd, afgeleid uit een .mpp-import, geen agent-invoervorm)',
  manuallyScheduled: 'handmatig plannen is via de bridge niet zetbaar (de datums blijven dan RAUW staan, ongeacht kalender/relaties/`duration`)',
  levelingDelayMinutes: 'sub-dag-nivelleervertraging is via de bridge niet zetbaar (geen leestool-tegenhanger, zie `levelingDelay`)',
  levelingDelayElapsed: 'sub-dag-nivelleervertraging is via de bridge niet zetbaar (geen leestool-tegenhanger, zie `levelingDelay`)',
  // Z14b (eigenaarsbesluit 2026-08-18 punt 1, F5-fixronde spec-review op 526af9f9): drie NIEUWE
  // .mpp-import-velden, puur data — zelfde "read-only, geen agent-invoervorm"-redenering als
  // splitGaps hierboven, geen van drieën heeft een schrijf-workflow om te valideren.
  mspTaskType: 'MSP\'s eigen Task Type is via de bridge niet zetbaar (puur .mpp-importdata, geen rekengedrag — zie planner_get_task)',
  effortDriven: 'MSP\'s "Effort Driven"-vlag is via de bridge niet zetbaar (puur .mpp-importdata, geen rekengedrag — zie planner_get_task)',
  timephasedContours: 'de rauwe contourperiodes zijn via de bridge niet zetbaar (afgeleid uit een .mpp-import, geen agent-invoervorm — zie planner_get_task)',
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
    ? `onbekend veld '${key}': ${hint}. Toegestaan: ${allowedList()}`
    : `onbekend veld '${key}'; toegestaan: ${allowedList()}`;
}

/** ISO-datum (date-only of datetime) die ook echt parseert. */
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validatie van één `constraint`-object (fase 2.3/2.9-semantiek). */
function parseConstraint(raw: unknown): { ok: true; value: TaskConstraint } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: '`constraint` moet een object zijn ({ type, date?, hard? }) of null om te wissen' };
  const type = raw.type;
  if (typeof type !== 'string' || !(CONSTRAINT_TYPES as string[]).includes(type)) {
    return { ok: false, reason: `\`constraint.type\` moet één van ${CONSTRAINT_TYPES.join(' | ')} zijn` };
  }
  const ct = type as ConstraintType;
  const needsDate = !DATELESS_CONSTRAINTS.includes(ct);
  if (needsDate && !isIsoDate(raw.date)) {
    return { ok: false, reason: `\`constraint.date\` (ISO-datum) is verplicht bij type ${ct}` };
  }
  if (raw.date !== undefined && !isIsoDate(raw.date)) {
    return { ok: false, reason: '`constraint.date` moet een ISO-datum zijn (YYYY-MM-DD)' };
  }
  if (raw.hard !== undefined) {
    if (typeof raw.hard !== 'boolean') return { ok: false, reason: '`constraint.hard` moet een boolean zijn' };
    if (raw.hard && !HARD_CONSTRAINTS.includes(ct)) {
      // Stil negeren zou weer een no-op zijn: `hard` doet alleen iets op MSO/MFO.
      return { ok: false, reason: `\`constraint.hard\` heeft alleen betekenis bij ${HARD_CONSTRAINTS.join('/')}, niet bij ${ct}` };
    }
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'type' && k !== 'date' && k !== 'hard') {
      return { ok: false, reason: `onbekend veld '${k}' in \`constraint\`; toegestaan: type, date, hard` };
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

/**
 * Valideer + vertaal een veld-set (uit `update_tasks.fields` of een `add_tasks`-item) naar een
 * `TaskFieldPatch`. ALLES-OF-NIETS: bij de eerste fout komt er géén (halve) patch terug — de
 * aanroeper weigert het item in zijn geheel, zodat een rotte sleutel nooit een deel-mutatie
 * achterlaat.
 */
export function parseTaskFields(raw: unknown, ctx: TaskFieldContext): TaskFieldResult {
  if (!isPlainObject(raw)) return { ok: false, reason: '`fields` moet een object zijn' };
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: false, reason: '`fields` is leeg' };

  for (const k of keys) {
    if (!(TASK_FIELD_NAMES as readonly string[]).includes(k)) return { ok: false, reason: rejectUnknown(k) };
  }

  const top: Partial<Task> = {};
  const time: TaskTimePatch = {};
  let customTaskType: CustomTaskType | undefined;

  // Effectieve mijlpaal-status: wat er ná deze patch geldt (de duur-0-invariant hangt daaraan).
  const effMilestone = 'isMilestone' in raw ? raw.isMilestone === true : ctx.currentIsMilestone;

  if ('name' in raw) {
    if (typeof raw.name !== 'string' || raw.name.trim() === '') return { ok: false, reason: '`name` moet een niet-lege string zijn' };
    top.name = raw.name;
  }
  if ('description' in raw) {
    if (typeof raw.description !== 'string') return { ok: false, reason: '`description` moet een string zijn' };
    top.description = raw.description;
  }
  if ('duration' in raw) {
    const d = raw.duration;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) {
      return { ok: false, reason: '`duration` moet een eindig getal ≥ 0 zijn in de eenheid van `durationUnit`' };
    }
    if (effMilestone && d > 0) {
      return { ok: false, reason: `een mijlpaal heeft per definitie duur 0; \`duration\`=${d} is niet toegestaan` };
    }
    const unit = raw.durationUnit ?? 'days';
    if (unit !== 'days' && unit !== 'hours') {
      return { ok: false, reason: '`durationUnit` moet `days` of `hours` zijn' };
    }
    if (unit === 'hours') {
      const cal = ctx.durationCalendar(
        typeof raw.calendarId === 'string' || raw.calendarId === null ? raw.calendarId : undefined,
      );
      if (!cal.hasWorkBlocks) {
        return { ok: false, reason: 'een urentaak vereist een taakkalender met concrete werkblokken' };
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
    return { ok: false, reason: '`durationUnit` moet samen met `duration` worden opgegeven; de bridge herinterpreteert geen bestaand getal' };
  }
  if ('durationType' in raw) {
    if (typeof raw.durationType !== 'string' || !(DURATION_TYPES as string[]).includes(raw.durationType)) {
      return { ok: false, reason: `\`durationType\` moet ${DURATION_TYPES.join(' of ')} zijn` };
    }
    time.durationType = raw.durationType as DurationType;
  }
  if ('taskType' in raw) {
    if (typeof raw.taskType !== 'string' || !(TASK_TYPES as string[]).includes(raw.taskType)) {
      return { ok: false, reason: `\`taskType\` moet één van ${TASK_TYPES.join(' | ')} zijn` };
    }
    top.taskType = raw.taskType as TaskType;
    if (raw.taskType !== 'USERDEFINED') top.customTaskTypeId = undefined;
  }
  if ('customTaskType' in raw) {
    const value = raw.customTaskType;
    if (!isPlainObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
      || value.id.trim() === '' || value.name.trim() === '') {
      return { ok: false, reason: '`customTaskType` moet { id, name } met niet-lege strings zijn' };
    }
    if ('taskType' in raw && raw.taskType !== 'USERDEFINED') {
      return { ok: false, reason: '`customTaskType` vereist taskType USERDEFINED (of laat taskType weg)' };
    }
    const candidate = { id: value.id.trim(), name: value.name.trim() };
    const existing = ctx.customTaskTypes.find(type => type.id === candidate.id);
    if (existing && existing.name !== candidate.name) {
      return { ok: false, reason: `customTaskType-id '${candidate.id}' bestaat al met projectsnapshot '${existing.name}'` };
    }
    const sameName = ctx.customTaskTypes.find(type => type.id !== candidate.id
      && type.name.localeCompare(candidate.name, undefined, { sensitivity: 'accent' }) === 0);
    if (sameName) {
      return { ok: false, reason: `customTaskType-naam '${candidate.name}' bestaat al met id '${sameName.id}'` };
    }
    customTaskType = candidate;
    top.taskType = 'USERDEFINED';
    top.customTaskTypeId = candidate.id;
  }
  if ('isMilestone' in raw) {
    if (typeof raw.isMilestone !== 'boolean') return { ok: false, reason: '`isMilestone` moet een boolean zijn' };
    if (raw.isMilestone) {
      if (ctx.hasChildren) return { ok: false, reason: 'een verzameltaak (met kinderen) kan geen mijlpaal worden' };
      if (ctx.hasAssignments) return { ok: false, reason: 'een taak met resource-toewijzingen kan geen mijlpaal worden; verwijder eerst de toewijzingen' };
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
    else return { ok: false, reason: `\`milestoneKind\` moet ${MILESTONE_KINDS.join(' of ')} zijn (of null om te wissen)` };
  }
  if ('mandatory' in raw) {
    if (typeof raw.mandatory !== 'boolean') return { ok: false, reason: '`mandatory` moet een boolean zijn' };
    top.mandatory = raw.mandatory;
  }
  if ('priority' in raw) {
    const p = raw.priority;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 1000) {
      return { ok: false, reason: '`priority` moet een geheel getal 0–1000 zijn (500 = normaal, 1000 = niet nivelleren)' };
    }
    top.priority = p;
  }
  if ('constraint' in raw) {
    if (raw.constraint === null) top.constraint = undefined;
    else {
      const c = parseConstraint(raw.constraint);
      if (!c.ok) return { ok: false, reason: c.reason };
      top.constraint = c.value;
    }
  }
  if ('deadline' in raw) {
    if (raw.deadline === null) top.deadline = undefined;
    else if (isIsoDate(raw.deadline)) top.deadline = raw.deadline;
    else return { ok: false, reason: '`deadline` moet een ISO-datum zijn (YYYY-MM-DD) of null om te wissen' };
  }
  if ('calendarId' in raw) {
    if (raw.calendarId === null) top.calendarId = undefined;
    else if (typeof raw.calendarId !== 'string') return { ok: false, reason: '`calendarId` moet een string zijn (of null voor de projectkalender)' };
    else if (!ctx.calendarExists(raw.calendarId)) {
      return { ok: false, reason: `onbekende calendarId '${raw.calendarId}' (zie planner_get_calendars)` };
    } else top.calendarId = raw.calendarId;
  }

  const hasTime = Object.keys(time).length > 0;
  return { ok: true, patch: { top, ...(hasTime ? { time } : {}), ...(customTaskType ? { customTaskType } : {}) } };
}

// --- Voortgangs-allowlist (`update_tasks.progress`) ----------------------------------------------
//
// ZELFDE ROOT-CAUSE ALS `fields`, ANDERE TAK (audit-bevinding K3): `progress` ging ONGEZIEN naar
// `progress.applyProgressUpdate`, die exact drie sleutels leest (`completion`/`actualStart`/
// `actualFinish`). Een agent die `progress: { percent: 50 }` stuurde, raakte geen van die drie ⇒
// `touchesProgress` bleef false ⇒ zelfs de statusdatum-guard sloeg over ⇒ `{ applied: true }` ⇒ de
// tool antwoordde `updated: ['t1']` terwijl de taak op 0% bleef staan. Idem voor `progress: {}`.
// Daarom hier dezelfde behandeling als `fields`: expliciete allowlist, onbekende sleutel bij NAAM
// geweigerd, en een `progress` zonder ook maar één bekende sleutel geweigerd.

/** De enige sleutels die `applyProgressUpdate` daadwerkelijk leest. */
export const PROGRESS_FIELD_NAMES = ['completion', 'actualStart', 'actualFinish'] as const;

/** Gerichte hints voor voortgangs-sleutels die een agent redelijkerwijs probeert. */
const PROGRESS_REJECT_HINTS: Record<string, string> = {
  percent: 'gebruik `completion` (PROCENTEN 0–100)',
  percentage: 'gebruik `completion` (PROCENTEN 0–100)',
  percentComplete: 'gebruik `completion` (PROCENTEN 0–100)',
  percent_complete: 'gebruik `completion` (PROCENTEN 0–100)',
  progress: 'gebruik `completion` (PROCENTEN 0–100)',
  complete: 'gebruik `completion` (PROCENTEN 0–100)',
  completed: 'gebruik `completion` (PROCENTEN 0–100)',
  status: 'de status wordt AFGELEID uit `completion` en de actuals; hij is niet direct zetbaar',
  start: 'gebruik `actualStart` (ISO-datum)',
  finish: 'gebruik `actualFinish` (ISO-datum)',
  end: 'gebruik `actualFinish` (ISO-datum)',
  actual_start: 'gebruik `actualStart` (ISO-datum)',
  actual_finish: 'gebruik `actualFinish` (ISO-datum)',
  remaining: 'de resterende duur wordt afgeleid uit `completion`',
  remainingTime: 'de resterende duur wordt afgeleid uit `completion`',
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
  if (!isPlainObject(raw)) return { ok: false, reason: '`progress` moet een object zijn ({ completion?, actualStart?, actualFinish? })' };
  const keys = Object.keys(raw);
  const allowed = PROGRESS_FIELD_NAMES.join(', ');
  if (keys.length === 0) {
    return { ok: false, reason: `\`progress\` is leeg; geef minstens één van: ${allowed}` };
  }
  for (const k of keys) {
    if (!(PROGRESS_FIELD_NAMES as readonly string[]).includes(k)) {
      const hint = PROGRESS_REJECT_HINTS[k];
      return {
        ok: false,
        reason: hint
          ? `onbekend veld '${k}' in \`progress\`: ${hint}. Toegestaan: ${allowed}`
          : `onbekend veld '${k}' in \`progress\`; toegestaan: ${allowed}`,
      };
    }
  }

  const value: ProgressPatch = {};
  if ('completion' in raw) {
    const c = raw.completion;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      return { ok: false, reason: '`progress.completion` moet een getal zijn (PROCENTEN 0–100)' };
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
      return { ok: false, reason: `\`progress.${k}\` moet een ISO-datum zijn (YYYY-MM-DD) of null om te wissen` };
    }
    value[k] = v;
  }
  return { ok: true, value };
}

// --- JSON-schema ---------------------------------------------------------------------------------

/** De schema-properties van de allowlist — gedeeld door `add_tasks`-items en `update_tasks.fields`,
 *  zodat schema en runtime-validatie niet uit elkaar kunnen lopen. */
export const TASK_FIELD_SCHEMA_PROPERTIES: Record<string, unknown> = {
  name: { type: 'string', description: 'Taaknaam (niet leeg).' },
  description: { type: 'string' },
  duration: {
    type: 'number',
    minimum: 0,
    description:
      'Native taakduur in de eenheid van `durationUnit` (standaard days voor achterwaartse ' +
      'compatibiliteit). Mijlpaal ⇒ moet 0 zijn.',
  },
  durationUnit: {
    type: 'string',
    enum: ['days', 'hours'],
    description: 'Blijvende taakeenheid. Altijd samen met `duration` opgeven; hours vereist concrete werkblokken.',
  },
  durationType: { type: 'string', enum: ['WORKTIME', 'ELAPSEDTIME'], description: 'WORKTIME = werkdagen (default), ELAPSEDTIME = doorlooptijd.' },
  taskType: { type: 'string', enum: TASK_TYPES },
  customTaskType: {
    type: 'object',
    description: 'OPS-customtype met stabiele id en projectsnapshot-naam; zet taskType op USERDEFINED. Een bestaand id kan niet van naam veranderen.',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
    required: ['id', 'name'], additionalProperties: false,
  },
  isMilestone: {
    type: 'boolean',
    description:
      'Mijlpaal: true zet de duur meteen op 0 (niet toegestaan op een verzameltaak of een taak met ' +
      'toewijzingen). false laat de duur op 0 staan tot je in dezelfde of een volgende call `duration` meestuurt.',
  },
  milestoneKind: { type: ['string', 'null'], enum: ['START', 'FINISH', null], description: 'Anker van de mijlpaal; null = automatisch.' },
  mandatory: { type: 'boolean', description: 'Verplichte (contractuele) mijlpaal — markering voor rapportage.' },
  priority: { type: 'integer', minimum: 0, maximum: 1000, description: 'Nivelleer-prioriteit (default 500; 1000 = nooit verschuiven).' },
  constraint: {
    type: ['object', 'null'],
    description: 'Datum-constraint; null wist hem. `date` is verplicht behalve bij ASAP/ALAP; `hard` alleen bij MSO/MFO.',
    properties: {
      type: { type: 'string', enum: ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'] },
      date: { type: 'string', description: 'ISO-datum (YYYY-MM-DD).' },
      hard: { type: 'boolean', description: 'P6 Mandatory-pin; alleen bij MSO/MFO.' },
    },
    required: ['type'],
    additionalProperties: false,
  },
  deadline: { type: ['string', 'null'], description: 'Zachte deadline (ISO-datum); begrenst alleen de late finish. null wist hem.' },
  calendarId: { type: ['string', 'null'], description: 'Taak-kalender uit de bibliotheek (planner_get_calendars); null = projectkalender.' },
};

/** Eén regel voor in tool-beschrijvingen: welke velden er zijn en dat de rest hard weigert. */
export const TASK_FIELDS_DOC =
  `Toegestane velden: ${TASK_FIELD_NAMES.join(', ')}. Elke andere sleutel wordt GEWEIGERD met een ` +
  'reden (nooit stil genegeerd) en laat het hele item ongewijzigd. `duration` volgt ' +
  '`durationUnit` (`days` of `hours`; zonder eenheid blijft de achterwaarts compatibele dagregel). ' +
  'Geef beide samen om de eenheid bewust te wijzigen; de `time`-tak zelf, `status`, `parentId` en ' +
  '`resourceIds` zijn hier bewust niet zetbaar (gebruik `progress`, planner_move_task resp. ' +
  'planner_manage_assignments).';
