import { Task, TaskTime, TaskType, ConstraintType, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceType, ResourceAssignment, AvailabilityStep, ResourceCurve } from '@/types/resource';
import { Project, SchedulingOptions } from '@/types/project';
import { WorkCalendar, Holiday, CalendarGeneration, createDefaultCalendar } from '@/types/calendar';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';
import { ifcGuid } from './ifcWriter';
import { normalizeImportedProgress } from '@/services/importNormalize';
import type { WorkTimeBands } from '@/types/calendar';
import {
  canonicalizeBands, clockToMinutes, deriveHoursPerDay, hasNonAnchorTime, isoDurationToMinutes,
  isSubDayMinutes, workDaysFromBands,
} from '@/services/subdayIo';

/** Synthetisch anker dat de DAG-schrijver op date-only datetimes plakt (§7.1). Een taak-datetime met
 *  een andere tijd-van-de-dag is sub-dag-informatie (discriminator (c)). */
const IFC_TIME_ANCHOR = '07:00:00';

/** Rauwe (gecanonicaliseerde) banden per gelezen kalender-object + of ze afwijken van het
 *  enkelvoudige dag-patroon (discriminator (a)/(b)). Gevuld door `buildCalendarFromEntity`, gelezen
 *  door de uur-modus-post-pass. WeakMap ⇒ per-parse, geen lek. */
const rawBandsRegistry = new WeakMap<WorkCalendar, { canonical: WorkTimeBands; deviates: boolean }>();

/** Fase 2.5-defaults — zie ifcWriter.ts (golden-rule-guards). */
const DEFAULT_PRIORITY = 500;
const VALID_CURVES: ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];

interface StepEntity {
  id: string; // STEP entity ID (may include letters, e.g. "300T")
  type: string;
  args: string[];
  raw: string;
}

/** Parse an IFC STEP file into the internal model */
export function readIFC(content: string): {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resourceCalendars: WorkCalendar[];
  baselines: Baseline[];
  activeBaselineId: string | null;
} {
  const entities = parseSTEP(content);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  // Extract project
  const project = extractProject(entities, entityMap);
  const calendar = extractCalendar(entities, entityMap);
  // Taken die aan een `.BASELINE.`-IfcWorkSchedule hangen zijn baseline-snapshots, geen live
  // taken (fase 2.6, §8.3) — sla ze over (robuust tegen externe tools; OPS zelf hangt er geen op).
  const baselineTaskStepIds = collectBaselineTaskStepIds(entities);
  const { tasks, taskStepIdMap, taskTimeEntities } = extractTasks(entities, entityMap, baselineTaskStepIds);
  const sequences = extractSequences(entities, entityMap, taskStepIdMap);
  extractNesting(entities, entityMap, tasks, taskStepIdMap);
  const { resources, resourceStepIdMap, resourceGuidMap } = extractResources(entities, entityMap);
  extractResourceMeta(entities, entityMap, resources, resourceStepIdMap, resourceGuidMap);
  extractCrewNesting(entities, resources, resourceStepIdMap);
  const resourceCalendars = extractCalendarLibrary(
    entities, entityMap, resources, resourceStepIdMap, tasks, taskStepIdMap,
  );
  // Fase 2.8b (§7.1, golf 4): uur-modus-post-pass. Ná extractCalendarLibrary zodat elke
  // `task.calendarId` (en dus de effectieve kalender) is geresolved. Zet `workTime` op kalenders
  // die afwijken van het dag-patroon (discriminator a/b/c) en herinterpreteert de duren/datetimes
  // van uur-taken minuut-precies. Dag-bestanden leveren geen signaal ⇒ ongemoeid (byte-identiek).
  applyHourModeIFC(tasks, calendar, resourceCalendars, taskTimeEntities);
  const assignments = extractAssignments(entities, entityMap, taskStepIdMap, resourceStepIdMap);
  const { activityCodeTypes, customFieldDefs } = extractStructure(
    entities, entityMap, project, tasks, taskStepIdMap,
  );
  extractLevelingMeta(entities, entityMap, tasks, taskStepIdMap);

  // Baselines (fase 2.6, §8.3): autoritatieve OPS_Baselines-JSON, met taskId-remap via GlobalId.
  const { baselines, activeBaselineId } = extractBaselines(entities, entityMap, taskStepIdMap);

  // Scheduling-options (fase 2.9, §3.4/§6): het volledige blok uit de OPS_SchedulingOptions-JSON.
  const schedulingOptions = extractSchedulingOptions(entities, entityMap);
  if (schedulingOptions) project.schedulingOptions = schedulingOptions;

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6) — ná extractStructure zodat
  // project.statusDate (uit OPS_ProjectSettings) beschikbaar is als default-actualFinish.
  normalizeImportedProgress(tasks, project.statusDate);

  return {
    project, calendar, tasks, sequences, resources, assignments,
    activityCodeTypes, customFieldDefs, resourceCalendars,
    baselines, activeBaselineId,
  };
}

function parseSTEP(content: string): StepEntity[] {
  const entities: StepEntity[] = [];
  const dataSection = content.split('DATA;')[1]?.split('ENDSEC;')[0];
  if (!dataSection) return entities;

  // Strip comments (/* ... */) and normalize whitespace
  const clean = dataSection
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\r\n/g, '\n');

  // Match all entity definitions: #123=IFCTYPE(...); or #300T=IFCTASKTIME(...);
  const entityRegex = /#(\w+)\s*=\s*(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  let match;
  while ((match = entityRegex.exec(clean)) !== null) {
    entities.push({
      id: match[1],
      type: match[2].toUpperCase(),
      args: splitArgs(match[3]),
      raw: match[0],
    });
  }

  return entities;
}

/** Split IFC arguments respecting nested parentheses and quotes */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      if (i + 1 < argsStr.length && argsStr[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (inString) {
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function stripQuotes(s: string): string {
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseRef(s: string): string | null {
  const m = s.trim().match(/^#(\w+)$/);
  return m ? m[1] : null;
}

function parseRefs(s: string): string[] {
  const refs: string[] = [];
  const matches = s.matchAll(/#(\w+)/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

function parseDateFromIFC(s: string): string {
  if (!s || s === '$') return formatDate(new Date());
  const clean = stripQuotes(s);
  // Extract just the date part
  return clean.substring(0, 10);
}

function parseDurationDays(s: string): number {
  if (!s || s === '$') return 0;
  const clean = stripQuotes(s);
  // Parse ISO 8601 duration: P0Y0M5D of P5D of PT8H. Negatief kan op twee manieren voorkomen:
  // standaardconform met voorloopteken vóór de P ('-P2D', zo schrijven wij een lead) of als
  // app-interne legacy-notatie met het teken bij het getal ('P0Y0M-2D'). Beide lezen.
  const leadingNeg = clean.startsWith('-');
  const applySign = (n: number) => (leadingNeg && n > 0 ? -n : n);
  const dayMatch = clean.match(/(-?\d+)D/);
  if (dayMatch) return applySign(parseInt(dayMatch[1]));
  const hourMatch = clean.match(/(-?\d+)H/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1]);
    return applySign(h < 0 ? -Math.ceil(-h / 8) : Math.ceil(h / 8));
  }
  return 0;
}

function parseTaskType(s: string): TaskType {
  const clean = s.replace(/\./g, '').trim();
  const valid: TaskType[] = ['CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE', 'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED'];
  return valid.includes(clean as TaskType) ? (clean as TaskType) : 'CONSTRUCTION';
}

function parseSequenceType(s: string): SequenceType {
  const clean = s.replace(/\./g, '').trim();
  const map: Record<string, SequenceType> = {
    'FINISH_START': 'FINISH_START',
    'START_START': 'START_START',
    'FINISH_FINISH': 'FINISH_FINISH',
    'START_FINISH': 'START_FINISH',
  };
  return map[clean] || 'FINISH_START';
}

function extractProject(entities: StepEntity[], _entityMap: Map<string, StepEntity>): Project {
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const wp = entities.find(e => e.type === 'IFCWORKPLAN');

  return {
    id: generateId('proj'),
    name: proj ? stripQuotes(proj.args[2] || '') : 'Geïmporteerd Project',
    description: wp ? stripQuotes(wp.args[3] || '') : '',
    startDate: wp ? parseDateFromIFC(wp.args[12] || '') : formatDate(new Date()),
    endDate: wp ? parseDateFromIFC(wp.args[13] || '') : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };
}

function extractCalendar(entities: StepEntity[], entityMap: Map<string, StepEntity>): WorkCalendar {
  const cal = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (!cal) return createDefaultCalendar();
  return buildCalendarFromEntity(cal, entityMap, entities);
}

/** Enkelband-kalender uit de scalar `workStartHour/EndHour` (fallback wanneer geen banden geregistreerd
 *  zijn, bv. een default-kalender die door een sub-dag-taak alsnog uur-modus wordt). */
function synthBandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

/**
 * Fase 2.8b (§7.1, golf 4) — uur-modus-post-pass. Draait ná het resolven van elke `task.calendarId`.
 * Beslist per kalender (project + bibliotheek) of hij uur-modus is volgens de normatieve
 * discriminator (7-intro): (a)/(b) uit de eigen banden, of (c) sub-dag-informatie van een taak die
 * hem gebruikt (een duur met tijdcomponent die niet op hele dagen valt, of een datetime met een
 * echte tijd-van-de-dag ≠ `T07:00`). Uur-kalenders krijgen `workTime` + afgeleide `hoursPerDay`;
 * hun taken krijgen minuut-precieze `durationMinutes` en echte tijden. Geen signaal ⇒ alles blijft
 * dag-modus (byte-identiek).
 */
function applyHourModeIFC(
  tasks: Task[],
  projectCal: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  taskTimeEntities: Map<string, StepEntity>,
): void {
  const libById = new Map(resourceCalendars.map(c => [c.id, c]));
  const effCalOf = (t: Task): WorkCalendar => (t.calendarId && libById.get(t.calendarId)) || projectCal;

  // 1. Sub-dag-signaal (c) per taak, t.o.v. de HUIDIGE (scalar/afgeleide) hpd van de effectieve
  //    kalender. Verzamel welke kalenders daardoor uur-modus moeten worden.
  const subDayCals = new Set<WorkCalendar>();
  for (const t of tasks) {
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const effCal = effCalOf(t);
    const durMin = isoDurationToMinutes(stripQuotes(e.args[4] || ''));
    const durSignal = durMin != null && isSubDayMinutes(durMin, effCal.hoursPerDay);
    const dateSignal = [5, 6, 7, 8, 9, 10, 16, 17]
      .some(i => hasNonAnchorTime(stripQuotes(e.args[i] || ''), IFC_TIME_ANCHOR));
    if (durSignal || dateSignal) subDayCals.add(effCal);
  }

  // 2. Promoveer kalenders die afwijken (a/b uit de banden) of een (c)-signaal droegen.
  for (const cal of [projectCal, ...resourceCalendars]) {
    if (cal.workTime) continue;
    const info = rawBandsRegistry.get(cal);
    if (!(info?.deviates || subDayCals.has(cal))) continue;
    const bands = info?.canonical ?? synthBandsFromScalar(cal);
    cal.workTime = bands;
    const wd = workDaysFromBands(bands);
    if (wd.length > 0) cal.workDays = wd;
    cal.hoursPerDay = deriveHoursPerDay(bands, cal.hoursPerDay);
  }

  // 3. Herinterpreteer de taken op een uur-kalender: minuut-precieze duur + echte tijden.
  for (const t of tasks) {
    const effCal = effCalOf(t);
    if (!effCal.workTime) continue;
    const e = taskTimeEntities.get(t.id);
    if (!e) continue;
    const hpd = effCal.hoursPerDay;
    const durMin = isoDurationToMinutes(stripQuotes(e.args[4] || ''));
    const minutes = durMin != null ? durMin : Math.round(t.time.scheduleDuration * hpd * 60);
    t.time.durationMinutes = minutes;
    if (hpd > 0) t.time.scheduleDuration = minutes / (hpd * 60);
    const toHour = (raw: string | undefined): string | undefined => {
      const q = stripQuotes(raw || '');
      return q && q !== '$' ? formatInstant(parseInstant(q), 'hour') : undefined;
    };
    const ss = toHour(e.args[5]); if (ss) t.time.scheduleStart = ss;
    const sf = toHour(e.args[6]); if (sf) t.time.scheduleFinish = sf;
    const es = toHour(e.args[7]); if (es) t.time.earlyStart = es;
    const ef = toHour(e.args[8]); if (ef) t.time.earlyFinish = ef;
    const ls = toHour(e.args[9]); if (ls) t.time.lateStart = ls;
    const lf = toHour(e.args[10]); if (lf) t.time.lateFinish = lf;
    const as = toHour(e.args[16]); if (as) t.time.actualStart = as;
    const af = toHour(e.args[17]); if (af) t.time.actualFinish = af;
    const remMin = isoDurationToMinutes(stripQuotes(e.args[18] || ''));
    if (remMin != null) t.time.remainingMinutes = remMin;
  }
}

function extractTasks(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  baselineTaskStepIds: Set<string> = new Set(),
): { tasks: Task[]; taskStepIdMap: Map<string, string>; taskTimeEntities: Map<string, StepEntity> } {
  const taskEntities = entities.filter(e => e.type === 'IFCTASK' && !baselineTaskStepIds.has(e.id));
  const tasks: Task[] = [];
  const taskStepIdMap = new Map<string, string>(); // STEP #id -> our task id
  // Fase 2.8b (§7.1): onze taak-id → IFCTASKTIME-entiteit, zodat de uur-modus-post-pass de rauwe
  // duur-/datetime-strings kan herlezen zodra de effectieve kalender bekend is.
  const taskTimeEntities = new Map<string, StepEntity>();

  for (const te of taskEntities) {
    const id = generateId('task');
    taskStepIdMap.set(te.id, id);

    // Twee IFCTASK-lay-outs (L1-fix, zie writeTask): spec-conform IFC 4.3 telt 13 args
    // (WorkMethod op index 8; IsMilestone/Priority/TaskTime/PredefinedType op 9/10/11/12) —
    // dat schrijven wij nu zelf en dat schrijven ook bestanden van derden. Oudere
    // OPS-bestanden tellen 12 args (WorkMethod ontbrak; dezelfde vier attributen één
    // positie eerder op 8/9/10/11). Detectie op arg-count: exact 12 = legacy-OPS-lay-out,
    // al het andere = spec-lay-out.
    const legacy12 = te.args.length === 12;
    const isMilestoneIdx = legacy12 ? 8 : 9;
    const priorityIdx = legacy12 ? 9 : 10;
    const taskTimeIdx = legacy12 ? 10 : 11;
    const predefinedTypeIdx = legacy12 ? 11 : 12;

    // Parse IfcTaskTime reference
    const taskTimeRef = parseRef(te.args[taskTimeIdx] || '');
    let time: TaskTime;
    if (taskTimeRef) {
      const ttEntity = entityMap.get(taskTimeRef);
      time = ttEntity ? parseTaskTime(ttEntity) : createDefaultTaskTime(formatDate(new Date()), 5);
      if (ttEntity) taskTimeEntities.set(id, ttEntity);
    } else {
      time = createDefaultTaskTime(formatDate(new Date()), 5);
    }

    const isMilestone = te.args[isMilestoneIdx]?.includes('T') || false;
    if (isMilestone) time.scheduleDuration = 0;

    // IfcTask.Priority (zie writeTask voor de index-verificatie). Veilige parse
    // zonder `||`-valkuil (§7.6): `0 || 500` zou een legitieme prioriteit 0 corrumperen.
    const priorityRaw = (te.args[priorityIdx] || '').trim();
    let priority = DEFAULT_PRIORITY;
    if (priorityRaw && priorityRaw !== '$') {
      const p = parseInt(priorityRaw, 10);
      priority = Number.isFinite(p) ? p : DEFAULT_PRIORITY;
    }

    tasks.push({
      id,
      name: stripQuotes(te.args[2] || '') || 'Naamloze taak',
      description: stripQuotes(te.args[3] || '') || '',
      wbsCode: stripQuotes(te.args[5] || '') || '',
      taskType: te.args[predefinedTypeIdx] ? parseTaskType(te.args[predefinedTypeIdx]) : 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone,
      priority,
      parentId: null,
      childIds: [],
      time,
      resourceIds: [],
    });
  }

  return { tasks, taskStepIdMap, taskTimeEntities };
}

/** Optionele datum/duur uit een IfcTaskTime-slot: `$`/leeg ⇒ undefined (geen "vandaag"-fallback,
 *  anders zou een legacy-bestand met lege actuals-slots ze als gezet inlezen). */
function optDate(s: string | undefined): string | undefined {
  return s && s !== '$' ? parseDateFromIFC(s) : undefined;
}
function optDuration(s: string | undefined): number | undefined {
  return s && s !== '$' ? parseDurationDays(s) : undefined;
}

function parseTaskTime(e: StepEntity): TaskTime {
  // Voortgang (fase 2.6, §8.1): slots 15 ActualDuration, 16 ActualStart, 17 ActualFinish,
  // 18 RemainingTime (StatusTime slot 14 wordt genegeerd — we lezen de projectbrede statusdatum
  // uit OPS_ProjectSettings, §15.3). `$` ⇒ undefined zodat legacy-bestanden ongewijzigd laden.
  return {
    durationType: e.args[3]?.includes('ELAPSED') ? 'ELAPSEDTIME' : 'WORKTIME',
    scheduleDuration: parseDurationDays(e.args[4] || ''),
    scheduleStart: parseDateFromIFC(e.args[5] || ''),
    scheduleFinish: parseDateFromIFC(e.args[6] || ''),
    earlyStart: parseDateFromIFC(e.args[7] || ''),
    earlyFinish: parseDateFromIFC(e.args[8] || ''),
    lateStart: parseDateFromIFC(e.args[9] || ''),
    lateFinish: parseDateFromIFC(e.args[10] || ''),
    freeFloat: parseDurationDays(e.args[11] || ''),
    totalFloat: parseDurationDays(e.args[12] || ''),
    isCritical: e.args[13]?.includes('T') || false,
    actualDuration: optDuration(e.args[15]),
    actualStart: optDate(e.args[16]),
    actualFinish: optDate(e.args[17]),
    remainingTime: optDuration(e.args[18]),
    completion: parseFloat(e.args[19] || '0') || 0,
  };
}

function extractSequences(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): Sequence[] {
  const seqEntities = entities.filter(e => e.type === 'IFCRELSEQUENCE');
  const sequences: Sequence[] = [];

  for (const se of seqEntities) {
    const predRef = parseRef(se.args[4] || '');
    const succRef = parseRef(se.args[5] || '');
    if (!predRef || !succRef) continue;

    const predId = taskStepIdMap.get(predRef);
    const succId = taskStepIdMap.get(succRef);
    if (!predId || !succId) continue;

    // Lag. Twee lay-outs van IFCLAGTIME ondersteunen:
    //  - conform IFC 4.3 (huidige writer): arg 4 = LagValue als getypte select
    //    (IFCDURATION('P2D') / IFCRATIOMEASURE(0.5)), arg 5 = DurationType (.WORKTIME./.ELAPSEDTIME.);
    //  - legacy (oudere app-versies, omgewisseld): arg 4 = .WORKTIME., arg 5 = 'P0Y0M2D'.
    let lagDays = 0;
    let lagUnit: Sequence['lagUnit'];
    let lagPercent: number | undefined;
    // Fase 2.8b (§7.1): uur-lag heeft een tijdcomponent (`IFCDURATION('PT..')`) ⇒ `lagMinutes` als
    // bron van waarheid. Alleen de uur-schrijver emitteert die vorm; dag-bestanden (`P{d}D`) leveren
    // `null` en houden `lagDays`.
    let lagMinutes: number | undefined;
    const lagRef = parseRef(se.args[6] || '');
    if (lagRef) {
      const lagEntity = entityMap.get(lagRef);
      if (lagEntity && lagEntity.type === 'IFCLAGTIME') {
        const lagValue = (lagEntity.args[3] || '').trim();
        const durType = (lagEntity.args[4] || '').trim();
        const ratioMatch = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+)\s*\)$/i);
        const durMatch = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
        if (ratioMatch) {
          // Ratio → procent; afronden tegen floating-point-ruis (0.33*100 = 33.000000000000004).
          lagPercent = Math.round(parseFloat(ratioMatch[1]) * 100 * 1e6) / 1e6;
        } else if (durMatch) {
          lagDays = parseDurationDays(durMatch[1]);
          lagMinutes = isoDurationToMinutes(stripQuotes(durMatch[1])) ?? undefined;
        } else if (lagValue.startsWith("'")) {
          // Ongetypte duur-string (soepel lezen van andermans bestanden).
          lagDays = parseDurationDays(lagValue);
          lagMinutes = isoDurationToMinutes(stripQuotes(lagValue)) ?? undefined;
        } else {
          // Legacy-lay-out: de duur staat in arg 5.
          lagDays = parseDurationDays(lagEntity.args[4] || '');
        }
        if (/ELAPSEDTIME/i.test(durType)) lagUnit = 'ELAPSEDTIME';
      }
    }

    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: parseSequenceType(se.args[7] || ''),
      lagDays,
    };
    if (lagUnit) seq.lagUnit = lagUnit;
    if (lagPercent !== undefined) seq.lagPercent = lagPercent;
    if (lagMinutes !== undefined) seq.lagMinutes = lagMinutes;
    sequences.push(seq);
  }

  return sequences;
}

/** Parse een getypeerd NominalValue zoals IFCTEXT('x'), IFCREAL(1.5), IFCBOOLEAN(.T.),
 *  IFCDATE('2026-01-01'), IFCINTEGER(2), IFCMONETARYMEASURE(3.5). */
function parseTypedValue(s: string): CustomFieldValue | undefined {
  const m = (s || '').trim().match(/^IFC\w+\s*\(([\s\S]*)\)$/i);
  if (!m) return undefined;
  const inner = m[1].trim();
  if (inner === '.T.') return true;
  if (inner === '.F.') return false;
  if (inner.startsWith("'")) return stripQuotes(inner);
  const n = parseFloat(inner);
  return Number.isFinite(n) ? n : undefined;
}

const MEASURE_TO_FIELD: Record<string, CustomFieldType> = {
  ifctext: 'text', ifclabel: 'text', ifcreal: 'number', ifcinteger: 'integer',
  ifcmonetarymeasure: 'cost', ifcdate: 'date', ifcboolean: 'boolean',
};

/**
 * Fase 2.2 — structuurdefinities en taakwaarden teruglezen (spiegel van writeStructure):
 * de OPS_StructureMeta-JSON is autoritair (verliesloos, behoudt ids/kleuren); ontbreekt die
 * (bestand van een andere tool), dan reconstrueren we de definities uit de conformante
 * IFCPROPERTYSETTEMPLATE-declaraties met verse ids. Taakwaarden (OPS_CustomFields /
 * OPS_ActivityCodes-psets) worden per NAAM teruggemapt naar de definities; het
 * OPS_ProjectSettings-pset zet project.wbsAutoNumber.
 */
function extractStructure(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  project: Project,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): { activityCodeTypes: ActivityCodeType[]; customFieldDefs: CustomFieldDef[] } {
  let activityCodeTypes: ActivityCodeType[] = [];
  let customFieldDefs: CustomFieldDef[] = [];

  // 1. Autoritaire meta-JSON.
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== 'OPS_StructureMeta') continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const meta = JSON.parse(raw);
        if (Array.isArray(meta.activityCodeTypes)) activityCodeTypes = meta.activityCodeTypes;
        if (Array.isArray(meta.customFieldDefs)) customFieldDefs = meta.customFieldDefs;
      } catch { /* corrupte meta — val terug op templates */ }
    }
  }

  // 2. Terugval: reconstrueer definities uit de conformante templates (verse ids).
  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) {
    for (const e of entities) {
      if (e.type !== 'IFCPROPERTYSETTEMPLATE') continue;
      const setName = stripQuotes(e.args[2] || '');
      for (const tmplRef of parseRefs(e.args[6] || '')) {
        const tmpl = entityMap.get(tmplRef);
        if (!tmpl || tmpl.type !== 'IFCSIMPLEPROPERTYTEMPLATE') continue;
        const name = stripQuotes(tmpl.args[2] || '');
        const templateType = (tmpl.args[4] || '').replace(/\./g, '').trim();
        if (setName === 'OPS_CustomFields' && templateType === 'P_SINGLEVALUE') {
          const measure = stripQuotes(tmpl.args[5] || '').toLowerCase();
          customFieldDefs.push({ id: generateId('cfd'), name, type: MEASURE_TO_FIELD[measure] ?? 'text' });
        } else if (setName === 'OPS_ActivityCodes' && templateType === 'P_ENUMERATEDVALUE') {
          const enumEntity = entityMap.get(parseRef(tmpl.args[7] || '') || '');
          const values = enumEntity && enumEntity.type === 'IFCPROPERTYENUMERATION'
            ? splitArgs((enumEntity.args[1] || '').replace(/^\(|\)$/g, ''))
                .map(v => parseTypedValue(v))
                .filter((v): v is string => typeof v === 'string')
                .map(code => ({ id: generateId('acv'), code }))
            : [];
          activityCodeTypes.push({ id: generateId('act'), name, values });
        }
      }
    }
  }

  const typeByName = new Map(activityCodeTypes.map(t => [t.name, t]));
  const defByName = new Map(customFieldDefs.map(d => [d.name, d]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  // 3. Waarden per object via IFCRELDEFINESBYPROPERTIES.
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const psetName = stripQuotes(pset.args[2] || '');
    const objectRefs = parseRefs(rel.args[4] || '');
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p);

    if (psetName === 'OPS_ProjectSettings') {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        const name = stripQuotes(prop.args[0] || '');
        const v = parseTypedValue(prop.args[2] || '');
        if (name === 'wbsAutoNumber') {
          if (typeof v === 'boolean') project.wbsAutoNumber = v;
        } else if (name === 'StatusDate') {
          // Fase 2.6 (§8.2): P6 data date → project.statusDate.
          if (typeof v === 'string' && v) project.statusDate = v.substring(0, 10);
        } else if (name === 'ProgressMode') {
          // Fase 2.6 (§8.2): alleen PROGRESS_OVERRIDE wordt geschreven; RETAINED_LOGIC is de default.
          if (v === 'PROGRESS_OVERRIDE' || v === 'RETAINED_LOGIC') project.progressMode = v;
        }
      }
      continue;
    }

    if (psetName === 'OPS_Constraints') {
      // Fase 2.3/2.9: datum-constraint (+ harde pin + secundair) + deadline per taak (spiegel van
      // writeConstraints). Afwezige velden ⇒ gewoon weg (default-inert, dag-modus-analoog).
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (!task) continue;
        let ctype: string | undefined;
        let cdate: string | undefined;
        let hard = false;
        let ctype2: string | undefined;
        let cdate2: string | undefined;
        for (const prop of props) {
          if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
          const name = stripQuotes(prop.args[0] || '');
          const value = parseTypedValue(prop.args[2] || '');
          // Fase 2.9: Hard is een IFCBOOLEAN — niet overslaan met de string-guard hieronder.
          if (name === 'Hard') { if (value === true) hard = true; continue; }
          if (typeof value !== 'string') continue;
          if (name === 'ConstraintType') ctype = value;
          else if (name === 'ConstraintDate') cdate = value;
          else if (name === 'ConstraintType2') ctype2 = value;
          else if (name === 'ConstraintDate2') cdate2 = value;
          else if (name === 'Deadline') task.deadline = value;
        }
        const valid = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];
        if (ctype && valid.includes(ctype)) {
          task.constraint = {
            type: ctype as ConstraintType,
            ...(cdate ? { date: cdate } : {}),
            ...(hard ? { hard: true } : {}),
          };
        }
        // Secundaire constraint is altijd soft (geen hard-veld).
        if (ctype2 && valid.includes(ctype2)) {
          task.constraint2 = { type: ctype2 as ConstraintType, ...(cdate2 ? { date: cdate2 } : {}) };
        }
      }
      continue;
    }

    if (psetName === 'OPS_Hammock') {
      // Fase 2.9 (§3.2/§6): hammock/LOE-vlag terug (spiegel van writeHammockMeta).
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (!task) continue;
        for (const prop of props) {
          if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
          if (stripQuotes(prop.args[0] || '') !== 'IsHammock') continue;
          if (parseTypedValue(prop.args[2] || '') === true) task.isHammock = true;
        }
      }
      continue;
    }

    if (psetName === 'OPS_ExternalLink') {
      // Fase 2.9 (§4.5/§6): externe (cross-project) dependencies uit het autoritatieve JSON-veld
      // (spiegel van writeExternalLinks). De volledige geneste array round-trippt 1-op-1.
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (!task) continue;
        for (const prop of props) {
          if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
          if (stripQuotes(prop.args[0] || '') !== 'Links') continue;
          const value = parseTypedValue(prop.args[2] || '');
          if (typeof value !== 'string' || !value) continue;
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) task.externalLinks = parsed;
          } catch {
            // Corrupte JSON: negeren (net als een onleesbare baseline-blob) i.p.v. de load te breken.
          }
        }
      }
      continue;
    }

    if (psetName === 'OPS_Milestone') {
      // Fase 2.4: mijlpaalsoort + verplicht-vlag (spiegel van writeMilestoneMeta).
      for (const objRef of objectRefs) {
        const taskId = taskStepIdMap.get(objRef);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (!task) continue;
        for (const prop of props) {
          if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
          const name = stripQuotes(prop.args[0] || '');
          const value = parseTypedValue(prop.args[2] || '');
          if (name === 'MilestoneKind' && (value === 'START' || value === 'FINISH')) {
            task.milestoneKind = value;
          } else if (name === 'Mandatory' && value === true) {
            task.mandatory = true;
          }
        }
      }
      continue;
    }

    if (psetName !== 'OPS_CustomFields' && psetName !== 'OPS_ActivityCodes') continue;
    for (const objRef of objectRefs) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (!task) continue;
      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        if (psetName === 'OPS_CustomFields' && prop.type === 'IFCPROPERTYSINGLEVALUE') {
          const def = defByName.get(name);
          const value = parseTypedValue(prop.args[2] || '');
          if (def && value !== undefined) {
            task.customFields = { ...(task.customFields ?? {}), [def.id]: value };
          }
        } else if (psetName === 'OPS_ActivityCodes' && prop.type === 'IFCPROPERTYENUMERATEDVALUE') {
          const type = typeByName.get(name);
          const codes = splitArgs((prop.args[2] || '').replace(/^\(|\)$/g, ''))
            .map(v => parseTypedValue(v))
            .filter((v): v is string => typeof v === 'string');
          const value = type?.values.find(v => v.code === codes[0]);
          if (type && value) {
            task.activityCodes = { ...(task.activityCodes ?? {}), [type.id]: value.id };
          }
        }
      }
    }
  }

  return { activityCodeTypes, customFieldDefs };
}

function extractNesting(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): void {
  const nestEntities = entities.filter(e => e.type === 'IFCRELNESTS');
  // Index tasks by id once. Voorheen werd elke parent/child via tasks.find()
  // in de lus opgezocht, waardoor nesting O(nestings × children × tasks) was.
  const taskById = new Map<string, Task>(tasks.map(t => [t.id, t]));

  for (const ne of nestEntities) {
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = taskStepIdMap.get(parentRef);
    if (!parentId) continue; // Could be WorkSchedule, skip
    const parent = taskById.get(parentId);
    if (!parent) continue;

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = taskStepIdMap.get(childRef);
      if (!childId) continue;
      const child = taskById.get(childId);
      if (!child) continue;
      child.parentId = parentId;
      if (!parent.childIds.includes(childId)) {
        parent.childIds.push(childId);
      }
    }
  }
}

function extractResources(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
): { resources: Resource[]; resourceStepIdMap: Map<string, string>; resourceGuidMap: Map<string, string> } {
  const resTypes: Record<string, ResourceType> = {
    IFCLABORRESOURCE: 'LABOR',
    IFCCONSTRUCTIONEQUIPMENTRESOURCE: 'EQUIPMENT',
    IFCCONSTRUCTIONMATERIALRESOURCE: 'MATERIAL',
    IFCSUBCONTRACTRESOURCE: 'SUBCONTRACTOR',
    IFCCREWRESOURCE: 'CREW',
    // Herbruikbaar bekisting e.d. (domeinrapport §8.A) — nooit geschreven door OPS zelf,
    // maar acceptabel binnenkomend als EQUIPMENT.
    IFCCONSTRUCTIONPRODUCTRESOURCE: 'EQUIPMENT',
  };

  const resources: Resource[] = [];
  const resourceStepIdMap = new Map<string, string>();
  const resourceGuidMap = new Map<string, string>(); // IFC GlobalId-string -> ons resource-id

  for (const e of entities) {
    const resType = resTypes[e.type];
    if (!resType) continue;

    const id = generateId('res');
    resourceStepIdMap.set(e.id, id);
    resourceGuidMap.set(stripQuotes(e.args[0] || ''), id);

    resources.push({
      id,
      name: stripQuotes(e.args[2] || '') || 'Resource',
      type: resType,
      description: stripQuotes(e.args[3] || '') || '',
      maxUnits: 1,
    });
  }

  return { resources, resourceStepIdMap, resourceGuidMap };
}

/**
 * Fase 2.5 — `OPS_Resource`-pset teruglezen (§7.2, spiegel van `writeResourceMeta`):
 * MaxUnits/CostPerHour/UnitOfMeasure/AvailabilitySteps + de `ParentGuid`-vangnetproperty
 * (§7.3) — die laatste wordt alleen toegepast als `extractCrewNesting` de relatie nog niet
 * had gelegd (IFCRELNESTS is de primaire bron, ParentGuid is het vangnet voor bestanden van
 * andere tools die de nest-relatie anders lezen).
 */
function extractResourceMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  resourceGuidMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    if (stripQuotes(pset.args[2] || '') !== 'OPS_Resource') continue;

    const objectRefs = parseRefs(rel.args[4] || '');
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of objectRefs) {
      const resId = resourceStepIdMap.get(objRef);
      const res = resId ? resourceById.get(resId) : undefined;
      if (!res) continue;

      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (name === 'MaxUnits' && typeof value === 'number') {
          res.maxUnits = value;
        } else if (name === 'CostPerHour' && typeof value === 'number') {
          res.costPerHour = value;
        } else if (name === 'UnitOfMeasure' && typeof value === 'string') {
          res.unitOfMeasure = value;
        } else if (name === 'AvailabilitySteps' && typeof value === 'string') {
          const steps: AvailabilityStep[] = value
            .split(';')
            .map(pair => {
              const [from, maxUnitsStr] = pair.split(':');
              return { from: (from || '').trim(), maxUnits: parseFloat(maxUnitsStr) };
            })
            .filter(s => s.from && Number.isFinite(s.maxUnits));
          if (steps.length > 0) res.availabilitySteps = steps;
        } else if (name === 'ParentGuid' && typeof value === 'string' && !res.parentId) {
          const parentId = resourceGuidMap.get(value);
          if (parentId) res.parentId = parentId;
        }
      }
    }
  }
}

/**
 * Fase 2.5 — ploeg-hiërarchie teruglezen (§7.3, spiegel van `writeCrewNesting`): dezelfde
 * `IFCRELNESTS`-entiteiten als de WBS-taakhiërarchie (`extractNesting`), maar dan met
 * `RelatingObject`/`RelatedObjects` die via `resourceStepIdMap` resolven i.p.v.
 * `taskStepIdMap` — relaties voor taken resolven hier simpelweg niet (`continue`).
 */
function extractCrewNesting(
  entities: StepEntity[],
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
): void {
  const resourceById = new Map(resources.map(r => [r.id, r]));
  for (const ne of entities) {
    if (ne.type !== 'IFCRELNESTS') continue;
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = resourceStepIdMap.get(parentRef);
    if (!parentId) continue; // geen resource-nest (WBS/workschedule) — niet onze zaak

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = resourceStepIdMap.get(childRef);
      const child = childId ? resourceById.get(childId) : undefined;
      if (child) child.parentId = parentId;
    }
  }
}

/** Parse een STEP-lijstwaarde van gehele getallen zoals `(1,2,3,4,5)` naar `[1,2,3,4,5]`. Leeg/`$`
 *  ⇒ `[]` (golden rule bij de aanroeper: alleen toepassen als er iets uitkomt). */
function parseIntList(s: string): number[] {
  const inner = (s || '').trim().replace(/^\(|\)$/g, '');
  if (!inner) return [];
  return inner.split(',').map(x => parseInt(x.trim(), 10)).filter(Number.isFinite);
}

/**
 * Fase 2.8a (§8.2) — `calendar.generation`-herkomst teruglezen uit het `OPS_Calendar`-pset
 * (spiegel van `writeCalendarGenerationMeta`): zoekt de `IFCRELDEFINESBYPROPERTIES` die het
 * `IFCWORKCALENDAR` met STEP-id `calStepId` target. Golden rule/legacy (§4.3/§8.2): geen pset
 * gevonden, of een onvolledige/corrupte set (ontbrekende RuleSetId/jaren) ⇒ `undefined` — NOOIT
 * een kalender laten hergenereren op basis van een gok.
 */
function extractCalendarGeneration(
  calStepId: string,
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): CalendarGeneration | undefined {
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const objectRefs = parseRefs(rel.args[4] || '');
    if (!objectRefs.includes(calStepId)) continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET' || stripQuotes(pset.args[2] || '') !== 'OPS_Calendar') continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    let ruleSetId: HolidayCountry | undefined;
    let region: string | undefined;
    let breakChoice: CalendarGeneration['breakChoice'];
    let generatedFromYear: number | undefined;
    let generatedToYear: number | undefined;
    for (const prop of props) {
      const name = stripQuotes(prop.args[0] || '');
      const value = parseTypedValue(prop.args[2] || '');
      if (name === 'RuleSetId' && typeof value === 'string') ruleSetId = value as HolidayCountry;
      else if (name === 'Region' && typeof value === 'string') region = value;
      else if (name === 'BreakChoice' && typeof value === 'string') breakChoice = value as CalendarGeneration['breakChoice'];
      // 'WinterStop' (verwijderde feature, fase 2.8b) wordt in oude bestanden genegeerd; de
      // gematerialiseerde feestdagen zelf staan los in de kalender en blijven behouden.
      else if (name === 'GeneratedFromYear' && typeof value === 'number') generatedFromYear = value;
      else if (name === 'GeneratedToYear' && typeof value === 'number') generatedToYear = value;
    }
    if (!ruleSetId || generatedFromYear === undefined || generatedToYear === undefined) continue; // onvolledig — negeer

    return {
      ruleSetId,
      ...(region ? { region } : {}),
      ...(breakChoice ? { breakChoice } : {}),
      generatedFromYear,
      generatedToYear,
    };
  }
  return undefined;
}

/** Bouwt een `WorkCalendar` uit een `IFCWORKCALENDAR`-entiteit: naam/omschrijving/feestdagen
 *  (bestaand), plus (fase 2.8a, §8.1) werkdagen/uren teruggelezen uit de
 *  `WorkingTimes`-keten (args[5] → IFCWORKTIME → RecurrencePattern-ref → IFCRECURRENCEPATTERN
 *  DayComponent (args[2]) + TimePeriods (args[7]) → IFCTIMEPERIOD start/eind-uur) — de writer
 *  schreef dit al spec-conform (`ifcWriter.ts` `writeCalendar`), alleen de reader las het nog
 *  niet terug. Golden rule: ontbreekt de keten (bestand van een ander tool, of geen worktime),
 *  dan blijven de `createDefaultCalendar()`-defaults (ma-vr 07-16) staan. Tot slot (§8.2) de
 *  `OPS_Calendar`-pset → `generation` (legacy/onvolledig ⇒ `undefined`, nooit gegokt). */
function buildCalendarFromEntity(
  cal: StepEntity,
  entityMap: Map<string, StepEntity>,
  entities: StepEntity[],
): WorkCalendar {
  const calendar = createDefaultCalendar();
  calendar.name = stripQuotes(cal.args[2] || '') || calendar.name;
  calendar.description = stripQuotes(cal.args[3] || '') || calendar.description;

  // Werkweek + uren (§8.1). WorkingTimes (args[5]) is een lijst met precies één ref (zo schrijft
  // de writer 'm) naar het "hoofd"-IFCWORKTIME; de holiday-IFCWORKTIME's zitten in ExceptionTimes
  // (args[6]) en hebben geen RecurrencePattern-ref (args[3] blijft `$` daar).
  const workTimeRefs = parseRefs(cal.args[5] || '');
  let periods: { start: number; end: number }[] = []; // ALLE banden (minuten), fase 2.8b §7.1
  let calWorkDays: number[] = [];
  for (const wtRef of workTimeRefs) {
    const wt = entityMap.get(wtRef);
    if (!wt || wt.type !== 'IFCWORKTIME') continue;
    const recurrenceRef = parseRef(wt.args[3] || '');
    if (!recurrenceRef) continue;
    const rec = entityMap.get(recurrenceRef);
    if (!rec || rec.type !== 'IFCRECURRENCEPATTERN') continue;

    const workDays = parseIntList(rec.args[2] || '');
    if (workDays.length > 0) { calendar.workDays = workDays; calWorkDays = workDays; }

    const timePeriodRefs = parseRefs(rec.args[7] || '');
    // ALLE TimePeriods lezen (fase 2.8b §7.1: `TimePeriods` is native een lijst — pauze/split-shift).
    for (const tpRef of timePeriodRefs) {
      const tp = entityMap.get(tpRef);
      if (!tp || tp.type !== 'IFCTIMEPERIOD') continue;
      const s = clockToMinutes(stripQuotes(tp.args[0] || ''));
      const e = clockToMinutes(stripQuotes(tp.args[1] || ''));
      if (s != null && e != null) periods.push({ start: s, end: e });
    }
    // Scalar uit de EERSTE periode — houdt de dag-kalender byte-identiek (de post-pass promoveert
    // pas naar uur-modus bij een echte afwijking, discriminator a/b/c).
    if (timePeriodRefs.length > 0) {
      const tp = entityMap.get(timePeriodRefs[0]);
      if (tp && tp.type === 'IFCTIMEPERIOD') {
        const startHour = parseInt(stripQuotes(tp.args[0] || '').split(':')[0], 10);
        const endHour = parseInt(stripQuotes(tp.args[1] || '').split(':')[0], 10);
        if (Number.isFinite(startHour)) calendar.workStartHour = startHour;
        if (Number.isFinite(endHour)) calendar.workEndHour = endHour;
        if (Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour) {
          calendar.hoursPerDay = endHour - startHour;
        }
      }
    }
    break; // writer schrijft precies één werktijdslot in WorkingTimes
  }

  // Rauwe banden registreren (dezelfde periodes op elke werkdag — IFC's enkele recurrence-conventie)
  // + afwijking (a/b) bepalen, voor de uur-modus-post-pass.
  const days = (calWorkDays.length > 0 ? calWorkDays : calendar.workDays).filter(d => d >= 1 && d <= 7);
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  for (const d of days) rawByWeekday[d as 1] = periods.map(p => ({ ...p }));
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  rawBandsRegistry.set(calendar, { canonical: bands, deviates });

  // Ploeg-classificatie uit `PredefinedType` (arg 7) → `shift` (§7.1). `.FIRSTSHIFT.`/afwezig ⇒
  // undefined (byte-identiek — de schrijver emitteert `.FIRSTSHIFT.` voor undefined).
  const predef = (cal.args[7] || '').toUpperCase();
  if (predef.includes('SECONDSHIFT')) calendar.shift = 'SECOND';
  else if (predef.includes('THIRDSHIFT')) calendar.shift = 'THIRD';
  else if (predef.includes('USERDEFINED')) calendar.shift = 'USERDEFINED';

  const exceptionRefs = parseRefs(cal.args[6] || '');
  const holidays: Holiday[] = [];
  for (const ref of exceptionRefs) {
    const wt = entityMap.get(ref);
    if (wt && wt.type === 'IFCWORKTIME') {
      holidays.push({
        name: stripQuotes(wt.args[0] || '') || 'Feestdag',
        startDate: parseDateFromIFC(wt.args[4] || ''),
        endDate: parseDateFromIFC(wt.args[5] || ''),
      });
    }
  }
  if (holidays.length > 0) calendar.holidays = holidays;

  // §4.3/§8.2 golden rule: createDefaultCalendar() zet altijd `generation` (nieuwe projecten zijn
  // per definitie gegenereerd) — een uit IFC gelezen kalender is dat NIET tenzij de OPS_Calendar-
  // pset het expliciet zegt. Eerst wissen, dan (evt.) invullen uit de pset.
  delete calendar.generation;
  calendar.generation = extractCalendarGeneration(cal.id, entities, entityMap);

  return calendar;
}

/**
 * Fase 2.8a (§8.2) — kalender-bibliotheek teruglezen (generalisatie van de oude "resource-
 * kalenders"-route, fase 2.5 §7.5): alle `IFCWORKCALENDAR`-entiteiten behalve degene die
 * `extractCalendar` al als projectkalender heeft gepakt (de eerste in het bestand — zelfde,
 * bewust ongewijzigde regel als `extractCalendar` zelf hanteert, en de schrijf-conventie die
 * `writeIFC` aanhoudt: de projectkalender staat altijd als eerste in het bestand).
 *
 * Onderscheid taken-vs-resources via `IFCRELASSIGNSTOCONTROL.RelatedObjects`: de writer schrijft
 * per bibliotheek-kalender twee LOSSE rel-entiteiten (één met resource-refs, één met taak-refs),
 * dus elke rel resolvet hier via precies één van de twee maps. Eén kalender kan zo door zowel een
 * resource- als een taak-rel worden aangewezen — de STEP-id van het `IFCWORKCALENDAR` dedupt de
 * kalender zelf (`calByStepId`) zodat hij maar één keer in de bibliotheek terechtkomt.
 */
function extractCalendarLibrary(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  resources: Resource[],
  resourceStepIdMap: Map<string, string>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): WorkCalendar[] {
  const projectCalendarEntity = entities.find(e => e.type === 'IFCWORKCALENDAR');
  const resourceById = new Map(resources.map(r => [r.id, r]));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const calendars: WorkCalendar[] = [];
  const calByStepId = new Map<string, WorkCalendar>(); // IFCWORKCALENDAR STEP-id -> onze kalender

  for (const ce of entities) {
    if (ce.type !== 'IFCRELASSIGNSTOCONTROL') continue;
    const controlRef = parseRef(ce.args[6] || '');
    if (!controlRef) continue;
    const controlEntity = entityMap.get(controlRef);
    if (!controlEntity || controlEntity.type !== 'IFCWORKCALENDAR') continue;
    if (projectCalendarEntity && controlRef === projectCalendarEntity.id) continue; // projectkalender, geen bibliotheek-entry

    let cal = calByStepId.get(controlRef);
    if (!cal) {
      cal = buildCalendarFromEntity(controlEntity, entityMap, entities);
      cal.id = generateId('rescal');
      calByStepId.set(controlRef, cal);
      calendars.push(cal);
    }

    const relatedRefs = parseRefs(ce.args[4] || '');
    for (const r of relatedRefs) {
      const resId = resourceStepIdMap.get(r);
      if (resId) {
        const res = resourceById.get(resId);
        if (res) res.calendarId = cal.id;
        continue;
      }
      const taskId = taskStepIdMap.get(r);
      if (taskId) {
        const task = taskById.get(taskId);
        if (task) task.calendarId = cal.id;
      }
    }
  }

  return calendars;
}

interface AssignmentMeta {
  unitsPerDay: number;
  curve?: ResourceCurve;
}

/** Per-taak verzamelde OPS_Assignments-meta: nieuw formaat (`GUID#N`-propnamen) als
 *  geordende wachtrij per resource-GUID, oud formaat (kale GUID) als één meta per GUID. */
interface TaskAssignmentMeta {
  /** Nieuw formaat (M3): resource-GUID -> metas gesorteerd op `#N`-volgnummer. Meerdere
   *  assignments van dezelfde resource op één taak consumeren de wachtrij in volgorde —
   *  de `IFCRELASSIGNSTOPROCESS.RelatedObjects`-volgorde en de `#N`-volgorde komen uit
   *  dezelfde bron (de assignments-array, zie writeAssignments/writeAssignmentMeta), dus
   *  ze lopen per resource synchroon. */
  queues: Map<string, AssignmentMeta[]>;
  /** Legacy formaat (pre-M3-bestanden): kale resource-GUID als propnaam, max één meta
   *  per GUID (het oude last-wins-gedrag — meer valt uit zo'n bestand niet te herstellen). */
  legacy: Map<string, AssignmentMeta>;
}

/**
 * Fase 2.5 — `OPS_Assignments`-pset teruglezen (§7.4, spiegel van `writeAssignmentMeta`):
 * property-naam = `"<resource-GUID>#<volgnummer>"` (nieuw formaat, M3-fix: uniek per
 * assignment, zodat dubbele assignments van dezelfde resource op één taak niet meer
 * last-wins-dedupen) óf de kale resource-GUID (legacy, pre-M3-bestanden); waarde =
 * `"unitsPerDay|curve"`. Ontbreekt de pset-entry (legacy bestand) dan geldt de bestaande
 * fallback `unitsPerDay: 1, curve: undefined`.
 */
function extractAssignments(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  resourceStepIdMap: Map<string, string>,
): ResourceAssignment[] {
  // 1. OPS_Assignments-psets per taak verzamelen: taskStepRef -> TaskAssignmentMeta.
  const metaByTask = new Map<string, TaskAssignmentMeta>();
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    if (stripQuotes(pset.args[2] || '') !== 'OPS_Assignments') continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of parseRefs(rel.args[4] || '')) {
      let taskMeta = metaByTask.get(objRef);
      if (!taskMeta) {
        taskMeta = { queues: new Map(), legacy: new Map() };
        metaByTask.set(objRef, taskMeta);
      }
      // Nieuw formaat eerst indexeren zodat de wachtrij op volgnummer gesorteerd wordt
      // (de STEP-property-volgorde in de pset is in de praktijk al de schrijfvolgorde,
      // maar de expliciete `#N` is de autoritaire volgorde).
      const indexed: { guid: string; index: number; meta: AssignmentMeta }[] = [];
      for (const prop of props) {
        const propName = stripQuotes(prop.args[0] || '');
        const value = parseTypedValue(prop.args[2] || '');
        if (typeof value !== 'string') continue;
        const [unitsRaw, curveRaw] = value.split('|');
        const unitsPerDay = parseFloat(unitsRaw);
        const curve = VALID_CURVES.includes(curveRaw as ResourceCurve) ? (curveRaw as ResourceCurve) : undefined;
        const meta: AssignmentMeta = { unitsPerDay: Number.isFinite(unitsPerDay) ? unitsPerDay : 1, curve };
        // `#` komt nooit voor in een IFC-GlobalId (charset [0-9A-Za-z_$]), dus een
        // `GUID#N`-match is eenduidig nieuw formaat; al het andere is legacy kale-GUID.
        const m = propName.match(/^(.+)#(\d+)$/);
        if (m) {
          indexed.push({ guid: m[1], index: parseInt(m[2], 10), meta });
        } else {
          taskMeta.legacy.set(propName, meta);
        }
      }
      indexed.sort((a, b) => a.index - b.index);
      for (const { guid, meta } of indexed) {
        let queue = taskMeta.queues.get(guid);
        if (!queue) { queue = []; taskMeta.queues.set(guid, queue); }
        queue.push(meta);
      }
    }
  }

  // 2. IFCRELASSIGNSTOPROCESS: task <-> resources, met de meta uit stap 1 erbij.
  const assignEntities = entities.filter(e => e.type === 'IFCRELASSIGNSTOPROCESS');
  const assignments: ResourceAssignment[] = [];

  for (const ae of assignEntities) {
    const taskRef = parseRef(ae.args[6] || '');
    if (!taskRef) continue;
    const taskId = taskStepIdMap.get(taskRef);
    if (!taskId) continue;
    const taskMeta = metaByTask.get(taskRef);

    const resRefs = parseRefs(ae.args[4] || '');
    for (const resRef of resRefs) {
      const resId = resourceStepIdMap.get(resRef);
      if (!resId) continue;

      const resEntity = entityMap.get(resRef);
      const resGuid = resEntity ? stripQuotes(resEntity.args[0] || '') : '';
      // Nieuw formaat: consumeer de volgende meta uit de wachtrij voor deze resource
      // (elke herhaling van dezelfde resource in RelatedObjects is een eigen assignment);
      // val terug op de legacy kale-GUID-meta voor pre-M3-bestanden.
      const meta = taskMeta?.queues.get(resGuid)?.shift() ?? taskMeta?.legacy.get(resGuid);

      // 'UNIFORM' is de writer-default (a.curve ?? 'UNIFORM') — canonicaliseer terug naar
      // undefined zodat undefined en 'UNIFORM' round-trippen naar dezelfde waarde
      // (Resource-Assignment.curve: "undefined = UNIFORM", zie src/types/resource.ts).
      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId: resId,
        unitsPerDay: meta?.unitsPerDay ?? 1,
        ...(meta?.curve && meta.curve !== 'UNIFORM' ? { curve: meta.curve } : {}),
      });
    }
  }

  return assignments;
}

/**
 * Fase 2.5 — `OPS_Leveling`-pset teruglezen (§7.6, spiegel van `writeLevelingMeta`):
 * `LevelingDelay` (werkdagen) per taak; ontbreekt de pset dan blijft `levelingDelay`
 * `undefined` (default, `extractTasks` zet het veld niet).
 */
function extractLevelingMeta(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): void {
  const taskById = new Map(tasks.map(t => [t.id, t]));
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    if (stripQuotes(pset.args[2] || '') !== 'OPS_Leveling') continue;

    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p && p.type === 'IFCPROPERTYSINGLEVALUE');

    for (const objRef of parseRefs(rel.args[4] || '')) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (!task) continue;
      for (const prop of props) {
        if (stripQuotes(prop.args[0] || '') !== 'LevelingDelay') continue;
        const value = parseTypedValue(prop.args[2] || '');
        if (typeof value === 'number' && Number.isFinite(value)) {
          task.levelingDelay = Math.round(value);
        }
      }
    }
  }
}

/**
 * Fase 2.6 — verzamel de STEP-#id's van taken die onder een `.BASELINE.`-IfcWorkSchedule hangen
 * (§8.3). OPS zelf hangt géén taken onder baseline-schema's (de datums leven in de OPS_Baselines-
 * JSON), maar externe tools kunnen dat wél doen; die taken zijn baseline-snapshots, geen live
 * taken, en mogen niet als echte taak worden ingeladen. Koppeling via IFCRELNESTS (RelatingObject
 * = het schema) of IFCRELASSIGNSTOCONTROL (control = het schema). PredefinedType `.BASELINE.` staat
 * op arg-index 14 van IFCWORKSCHEDULE.
 */
function collectBaselineTaskStepIds(entities: StepEntity[]): Set<string> {
  const baselineSchedIds = new Set(
    entities
      .filter(e => e.type === 'IFCWORKSCHEDULE' && (e.args[14] || '').includes('BASELINE'))
      .map(e => e.id),
  );
  const taskStepIds = new Set<string>();
  if (baselineSchedIds.size === 0) return taskStepIds;
  for (const e of entities) {
    if (e.type === 'IFCRELNESTS') {
      const relating = parseRef(e.args[4] || '');
      if (relating && baselineSchedIds.has(relating)) {
        for (const r of parseRefs(e.args[5] || '')) taskStepIds.add(r);
      }
    } else if (e.type === 'IFCRELASSIGNSTOCONTROL') {
      const control = parseRef(e.args[6] || '');
      if (control && baselineSchedIds.has(control)) {
        for (const r of parseRefs(e.args[4] || '')) taskStepIds.add(r);
      }
    }
  }
  return taskStepIds;
}

/**
 * Fase 2.6 — baselines teruglezen uit het autoritatieve `OPS_Baselines`-JSON (§8.3, spiegel van
 * `writeBaselineMeta`). De JSON bewaart per baseline-taak de INTERNE `taskId` van t.t.v. opslaan;
 * bij het inlezen zijn de taak-id's her-gegenereerd, dus we mappen elke `taskId` deterministisch
 * terug via `ifcGuid(taskId)` → de IFCTASK-GlobalId → de nieuwe id. Baseline-taken zonder match
 * (taak sindsdien verwijderd) behouden hun oude id en tonen later als "vervallen" in de variance.
 */
function extractBaselines(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): { baselines: Baseline[]; activeBaselineId: string | null } {
  // GlobalId → nieuwe taak-id (voor de taskId-remap).
  const guidToTaskId = new Map<string, string>();
  for (const e of entities) {
    if (e.type !== 'IFCTASK') continue;
    const newId = taskStepIdMap.get(e.id);
    if (newId) guidToTaskId.set(stripQuotes(e.args[0] || ''), newId);
  }

  let baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;

  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== 'OPS_Baselines') continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const name = stripQuotes(prop.args[0] || '');
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      if (name === 'Baselines') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) baselines = parsed as Baseline[];
        } catch { /* corrupte JSON — negeer, baselines blijft leeg */ }
      } else if (name === 'ActiveBaselineId') {
        activeBaselineId = raw;
      }
    }
  }

  // taskId-remap via GlobalId.
  for (const b of baselines) {
    if (!Array.isArray(b.tasks)) { b.tasks = []; continue; }
    for (const bt of b.tasks as BaselineTask[]) {
      const remapped = guidToTaskId.get(ifcGuid(bt.taskId));
      if (remapped) bt.taskId = remapped;
    }
  }

  // Actieve id valideren tegen de geladen set; anders op de nieuwste (of null) terugvallen.
  if (activeBaselineId && !baselines.some(b => b.id === activeBaselineId)) {
    activeBaselineId = baselines.length ? baselines[baselines.length - 1].id : null;
  }

  return { baselines, activeBaselineId };
}

/**
 * Fase 2.9 (§3.4/§6) — scheduling-options teruglezen uit het autoritatieve `OPS_SchedulingOptions`-
 * JSON op de `IfcWorkSchedule` (spiegel van `writeSchedulingOptionsMeta`, exact het extractBaselines-
 * patroon). Afwezig/corrupt ⇒ `undefined` (default-inert; alle solver-defaults blijven staan).
 */
function extractSchedulingOptions(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): SchedulingOptions | undefined {
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== 'OPS_SchedulingOptions') continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      if (stripQuotes(prop.args[0] || '') !== 'SchedulingOptions') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string' || !raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as SchedulingOptions;
        }
      } catch { /* corrupte JSON — negeer, opties blijven op default */ }
    }
  }
  return undefined;
}
