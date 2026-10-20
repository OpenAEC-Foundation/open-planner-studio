/**
 * De XER-schrijver (`src/services/xer/xerWriter.ts`, issue #391 "Write XER").
 *
 * (a) Rondgang OPS → XER → `readXER`: de vijf voorbeeldprojecten en een synthetisch project met alle
 *     relatietypes, lag, constraints, mijlpalen, samenvattingen, meerdere kalenders, resources met
 *     toewijzingen en voortgang. Vergeleken: naam, code, duur, kalender, relaties, constraints,
 *     toewijzingen en voortgang.
 * (b) Na `solveProject()` geven origineel en ingelezen kopie dezelfde vroege en late datums en
 *     dezelfde speling. Beide rekenen met DEZELFDE regels: de lezer opent een XER altijd met het
 *     rekenprofiel Primavera P6, dus het origineel krijgt hier dat profiel en de opties zoals de
 *     lezer ze terugleest. Rekent het project zelf anders, dan meldt de schrijver `schedulingRules`
 *     (getoetst). Elke afwijking staat als eigen regel in de uitvoer.
 * (c) Rondgang XER → OPS → XER → OPS op de fixtures in `tests/browser/fixtures/xer/`, plus een
 *     stabiliteitstoets: de tweede en de derde export zijn byte-gelijk.
 *
 * Daarnaast: de codering (Windows-1252 als alles past, anders UTF-8 met melding), escaping
 * (tab, regeleinde, aanhalingsteken) en het verliesverslag.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { parseXerTables } from '@/services/xer/xerTables';
import { writeXER, encodeWindows1252, type XerWriteInput, type XerWriteResult } from '@/services/xer/xerWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { taskMinutesForWrite } from '@/services/subdayIo';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project } from '@/types/project';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { effectiveWorkRule, remainingMinutesOf, totalMinutesOf } from '@/engine/work/workRuleApply';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { parseDate, parseInstant } from '@/utils/dateUtils';

declare const process: { exit(code: number): never; env: Record<string, string | undefined> };

const diffs: string[] = [];
const notes: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: unknown): void { eq(label, Boolean(value), true); }

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXPORT_DATE = '2026-10-20';

// ── Hulp ─────────────────────────────────────────────────────────────────────────────────────────

interface Doc {
  project: Project;
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

function docOf(result: ImportResult): Doc {
  return {
    project: result.project,
    calendar: result.calendar,
    calendars: result.resourceCalendars ?? [],
    tasks: result.tasks,
    sequences: result.sequences,
    resources: result.resources,
    assignments: result.assignments,
  };
}

function write(doc: Doc, extra: Partial<XerWriteInput> = {}): XerWriteResult {
  return writeXER({ ...doc, exportDate: EXPORT_DATE, ...extra });
}

function readBack(bytes: Uint8Array): XerReadResult {
  const parsed = readXER(bytes);
  if (isMultiDocumentImport(parsed)) throw new Error('XER-export gaf meerdere projecten');
  return parsed;
}

function solve(doc: Doc): string | undefined {
  const result = solveProject(solveInputFor(doc.project, doc.tasks, doc.sequences, doc.calendar, doc.calendars));
  return result.error;
}

function effCal(doc: Doc, task: Task): WorkCalendar {
  return (task.calendarId && doc.calendars.find(c => c.id === task.calendarId)) || doc.calendar;
}

/** Duur in werkminuten, ongeacht dag- of uurmodus. */
function minutesOf(doc: Doc, task: Task): number {
  if (task.isMilestone) return 0;
  return taskMinutesForWrite(task, effCal(doc, task).hoursPerDay);
}

const day = (iso: string | undefined) => (iso ?? '').slice(0, 10);

/** Taken per naam; de projectknoop (een wortel die de schrijver toevoegde) telt niet mee. */
function byName(tasks: readonly Task[]): Map<string, Task> {
  return new Map(tasks.map(t => [t.name, t]));
}

/** Naam van de ouder; een ouder die de projectknoop is (`projectNodeName`), telt als geen ouder. */
function parentName(all: readonly Task[], task: Task, projectNodeName?: string): string {
  const parent = all.find(t => t.id === task.parentId);
  if (!parent) return '';
  return parent.name === projectNodeName && !parent.parentId ? '' : parent.name;
}

/**
 * Plaats van een instant als werkminuten sinds 2000-01-01 op de kalender van de taak. Een dagdatum
 * (dagmodus) staat voor het begin van de eerste werkband die dag (`start`) of het einde van de
 * laatste (`finish`); een uurinstant voor zichzelf. Zo zijn "vrijdag 16:00" en "maandag 07:00"
 * dezelfde plaats in de werktijd, en "2026-03-05" in dagmodus gelijk aan "2026-03-05T16:00".
 */
const positionEngines = new Map<string, CalendarEngine>();
function workPosition(cal: WorkCalendar, iso: string | undefined, side: 'start' | 'finish'): number | undefined {
  if (!iso) return undefined;
  let engine = positionEngines.get(cal.id + JSON.stringify(cal.holidays.length));
  if (!engine) { engine = new CalendarEngine(calendarForEngine(cal)); positionEngines.set(cal.id + JSON.stringify(cal.holidays.length), engine); }
  let instant: Date;
  if (iso.length >= 16) instant = parseInstant(iso);
  else {
    const bands = engine.effectiveBandsOn(parseDate(iso));
    const base = parseDate(iso).getTime();
    const minute = side === 'start' ? bands[0]?.start ?? cal.workStartHour * 60 : bands[bands.length - 1]?.end ?? cal.workEndHour * 60;
    instant = new Date(base + minute * 60_000);
  }
  const anchor = new Date(Date.UTC(2000, 0, 1));
  return engine.workMinutesBetween(anchor, instant);
}

// ── (a) en (b): één vergelijking voor elk OPS-project ────────────────────────────────────────────

interface Compared { deviations: string[] }

function compareRoundTrip(label: string, original: Doc, written: XerWriteResult, back: XerReadResult): Compared {
  const deviations: string[] = [];
  const reread = docOf(back);
  const origTasks = byName(original.tasks);
  const backTasks = byName(reread.tasks);
  const nodeName = back.project.name;
  ok(`${label}: namen zijn uniek in het origineel (anders is de vergelijking niet eenduidig)`, origTasks.size === original.tasks.length);

  for (const task of original.tasks) {
    const other = backTasks.get(task.name);
    if (!other) { deviations.push(`${label}: taak '${task.name}' ontbreekt na inlezen`); continue; }
    const where = `${label} '${task.name}'`;
    if (isSummaryTask(task) !== isSummaryTask(other)) deviations.push(`${where}: samenvatting ${isSummaryTask(task)} → ${isSummaryTask(other)}`);
    const p1 = parentName(original.tasks, task);
    const p2 = parentName(reread.tasks, other, nodeName);
    if (p1 !== p2) deviations.push(`${where}: ouder '${p1}' → '${p2}'`);
    if (!isLeafTask(task)) continue;
    if ((task.wbsCode || '') !== other.wbsCode && task.wbsCode) deviations.push(`${where}: code '${task.wbsCode}' → '${other.wbsCode}'`);
    const m1 = minutesOf(original, task);
    const m2 = minutesOf(reread, other);
    if (Math.abs(m1 - m2) > 0.5) deviations.push(`${where}: duur ${m1} → ${m2} min`);
    if (effCal(original, task).name !== effCal(reread, other).name) {
      deviations.push(`${where}: kalender '${effCal(original, task).name}' → '${effCal(reread, other).name}'`);
    }
    if (task.isMilestone !== other.isMilestone) deviations.push(`${where}: mijlpaal ${task.isMilestone} → ${other.isMilestone}`);
    if (!!task.isHammock !== !!other.isHammock) deviations.push(`${where}: hamer ${!!task.isHammock} → ${!!other.isHammock}`);
    const c1 = task.constraint && task.constraint.type !== 'ASAP' ? `${task.constraint.type}${task.constraint.hard ? '!' : ''}@${day(task.constraint.date)}` : '';
    const c2 = other.constraint ? `${other.constraint.type}${other.constraint.hard ? '!' : ''}@${day(other.constraint.date)}` : '';
    if (c1 !== c2) deviations.push(`${where}: constraint ${c1 || '-'} → ${c2 || '-'}`);
    const s1 = task.constraint2 && task.constraint2.type !== 'ASAP' ? `${task.constraint2.type}@${day(task.constraint2.date)}` : '';
    const s2 = other.constraint2 ? `${other.constraint2.type}@${day(other.constraint2.date)}` : '';
    if (s1 !== s2) deviations.push(`${where}: tweede constraint ${s1 || '-'} → ${s2 || '-'}`);
    if (task.status !== other.status) deviations.push(`${where}: status ${task.status} → ${other.status}`);
    if (Math.abs(task.time.completion - other.time.completion) > 1e-6) deviations.push(`${where}: voortgang ${task.time.completion} → ${other.time.completion}`);
    if (day(task.time.actualStart) !== day(other.time.actualStart)) deviations.push(`${where}: werkelijke start ${task.time.actualStart} → ${other.time.actualStart}`);
    if (day(task.time.actualFinish) !== day(other.time.actualFinish)) deviations.push(`${where}: werkelijk einde ${task.time.actualFinish} → ${other.time.actualFinish}`);
  }
  if (backTasks.size > origTasks.size + 1) deviations.push(`${label}: ${backTasks.size - origTasks.size} taken meer na inlezen`);

  // Relaties: sleutel = voorganger→opvolger, type en lag in minuten (op de lagkalender).
  const relKey = (doc: Doc, s: Sequence) => {
    const p = doc.tasks.find(t => t.id === s.predecessorId)?.name;
    const q = doc.tasks.find(t => t.id === s.successorId)?.name;
    return `${p}→${q} ${s.type}`;
  };
  const relLag = (doc: Doc, s: Sequence) => {
    if (typeof s.lagMinutes === 'number') return s.lagMinutes;
    const pred = doc.tasks.find(t => t.id === s.predecessorId);
    return (s.lagDays ?? 0) * (pred ? effCal(doc, pred) : doc.calendar).hoursPerDay * 60;
  };
  const leafRel = (doc: Doc) => doc.sequences.filter(s =>
    isLeafTask(doc.tasks.find(t => t.id === s.predecessorId)) && isLeafTask(doc.tasks.find(t => t.id === s.successorId)));
  // Een procent-lag bakt de schrijver uit tot een vaste lag (gemeld als `percentLags`); die toetst (b).
  const r1 = new Map(leafRel(original).filter(s => typeof s.lagPercent !== 'number').map(s => [relKey(original, s), relLag(original, s)]));
  const r2 = new Map(reread.sequences.map(s => [relKey(reread, s), relLag(reread, s)]));
  for (const [key, lag] of r1) {
    if (!r2.has(key)) deviations.push(`${label}: relatie ${key} ontbreekt`);
    else if (Math.abs(r2.get(key)! - lag) > 0.5) deviations.push(`${label}: relatie ${key} lag ${lag} → ${r2.get(key)} min`);
  }
  const summaryRel = original.sequences.length - leafRel(original).length;
  if (summaryRel === 0 && r2.size !== leafRel(original).length) deviations.push(`${label}: ${r1.size} relaties → ${r2.size}`);

  // Toewijzingen: taak, resource, inzet, curve.
  const asgKey = (doc: Doc, a: ResourceAssignment) => {
    const t = doc.tasks.find(x => x.id === a.taskId)?.name;
    const r = doc.resources.find(x => x.id === a.resourceId)?.name;
    return `${t}/${r}`;
  };
  const a2 = new Map(reread.assignments.map(a => [asgKey(reread, a), a]));
  for (const a of original.assignments) {
    if (!isLeafTask(original.tasks.find(t => t.id === a.taskId))) continue;
    const other = a2.get(asgKey(original, a));
    if (!other) { deviations.push(`${label}: toewijzing ${asgKey(original, a)} ontbreekt`); continue; }
    if (Math.abs(other.unitsPerDay - a.unitsPerDay) > 1e-6) deviations.push(`${label}: toewijzing ${asgKey(original, a)} inzet ${a.unitsPerDay} → ${other.unitsPerDay}`);
    if ((a.curve ?? 'UNIFORM') !== (other.curve ?? 'UNIFORM')) deviations.push(`${label}: toewijzing ${asgKey(original, a)} curve ${a.curve} → ${other.curve}`);
  }
  for (const res of original.resources) {
    const other = reread.resources.find(r => r.name === res.name);
    if (!other) { deviations.push(`${label}: resource '${res.name}' ontbreekt`); continue; }
    if (Math.abs(other.maxUnits - res.maxUnits) > 1e-9) deviations.push(`${label}: resource '${res.name}' max ${res.maxUnits} → ${other.maxUnits}`);
    if ((res.costPerHour ?? null) !== (other.costPerHour ?? null)) deviations.push(`${label}: resource '${res.name}' tarief ${res.costPerHour} → ${other.costPerHour}`);
  }
  // Werkregel, activiteittype en werk per toewijzing (review PR #393, punten 3, 5 en 7).
  for (const task of original.tasks.filter(isLeafTask)) {
    const other = backTasks.get(task.name);
    if (!other) continue;
    const where = `${label} '${task.name}'`;
    const rule1 = effectiveWorkRule(task, original.project.defaultWorkRule);
    const rule2 = effectiveWorkRule(other, reread.project.defaultWorkRule);
    if (!task.isMilestone && rule1 !== rule2) deviations.push(`${where}: werkregel ${rule1} → ${rule2}`);
    if (!task.isMilestone && !task.isHammock) {
      const type1 = task.p6ActivityType === 'TT_WBS' || task.p6ActivityType === 'TT_Rsrc' ? task.p6ActivityType : 'TT_Task';
      if (type1 !== (other.p6ActivityType ?? 'TT_Task')) deviations.push(`${where}: activiteittype ${type1} → ${other.p6ActivityType}`);
    }
  }
  const workOf = (doc: Doc, a: ResourceAssignment) => {
    const task = doc.tasks.find(t => t.id === a.taskId)!;
    const ctx = { hoursPerDay: effCal(doc, task).hoursPerDay };
    const planned = a.plannedWorkMinutes ?? (task.isMilestone ? 0 : totalMinutesOf(task, ctx)) * (a.plannedUnitsPerDay ?? a.unitsPerDay);
    const remaining = a.remainingWorkMinutes ?? (task.isMilestone ? 0 : remainingMinutesOf(task, ctx)) * a.unitsPerDay;
    const actual = a.actualWorkMinutes ?? Math.max(0, planned - remaining);
    return [planned, remaining, actual].map(v => Math.round(v));
  };
  for (const a of original.assignments) {
    if (!isLeafTask(original.tasks.find(t => t.id === a.taskId))) continue;
    if (original.resources.find(r => r.id === a.resourceId)?.type === 'MATERIAL') continue; // hoeveelheid, geen werk
    const other = a2.get(asgKey(original, a));
    if (!other) continue;
    const w1 = workOf(original, a);
    const w2 = workOf(reread, other);
    if (w1.some((v, i) => Math.abs(v - w2[i]) > 1)) deviations.push(`${label}: toewijzing ${asgKey(original, a)} werk begroot/rest/verricht ${w1.join('/')} → ${w2.join('/')} min`);
  }
  // Kalenders: werkminuten per kalenderdag over het projectbereik (ook nachtbanden en uitzonderingen).
  for (const cal of [original.calendar, ...original.calendars]) {
    const other = cal === original.calendar ? reread.calendar : [reread.calendar, ...reread.calendars].find(c => c.name === cal.name);
    if (!other) { deviations.push(`${label}: kalender '${cal.name}' ontbreekt`); continue; }
    const e1 = new CalendarEngine(calendarForEngine(cal));
    const e2 = new CalendarEngine(calendarForEngine(other));
    const from = parseDate(original.project.startDate.slice(0, 10)).getTime() - 31 * 86_400_000;
    const bad: string[] = [];
    for (let d = 0; d < 500 && bad.length < 3; d++) {
      const a = new Date(from + d * 86_400_000);
      const b = new Date(from + (d + 1) * 86_400_000);
      const m1 = e1.isHourMode ? e1.workMinutesBetween(a, b) : (e1.isWorkDay(a) ? 1 : 0);
      const m2 = e1.isHourMode ? e2.workMinutesBetween(a, b) : (e2.isWorkDay(a) ? 1 : 0);
      if (m1 !== m2) bad.push(`${a.toISOString().slice(0, 10)} ${m1} → ${m2}`);
    }
    if (bad.length > 0) deviations.push(`${label}: kalender '${cal.name}' werktijd per dag: ${bad.join(', ')}`);
  }
  // Wat P6 te zien krijgt: TASKRSRC begroot/rest/verricht (uren) = het effectieve werk van het
  // origineel (review punt 5: afgeleid restwerk is restduur × inzet, niet de hele begroting).
  const parsed = parseXerTables(written.bytes);
  const cellsOf = (name: string) => (parsed.tables.get(name)?.rows ?? []).map(r => r.cells);
  const codeByTaskId = new Map(cellsOf('TASK').map(c => [c.task_id, c.task_code]));
  const nameByRsrcId = new Map(cellsOf('RSRC').map(c => [c.rsrc_id, c.rsrc_name]));
  for (const row of cellsOf('TASKRSRC')) {
    const task = original.tasks.find(t => isLeafTask(t) && t.wbsCode === codeByTaskId.get(row.task_id));
    const res = original.resources.find(r => r.name === nameByRsrcId.get(row.rsrc_id));
    const a = task && res && original.assignments.find(x => x.taskId === task.id && x.resourceId === res.id);
    if (!a || res?.type === 'MATERIAL') continue;
    const want = workOf(original, a).map(v => Math.round(v / 60 * 100) / 100);
    const got = [row.target_qty, row.remain_qty, row.act_reg_qty].map(v => Math.round(Number(v) * 100) / 100);
    if (want.some((v, i) => Math.abs(v - got[i]) > 0.02)) deviations.push(`${label}: TASKRSRC ${task!.name}/${res!.name} begroot/rest/verricht ${want.join('/')} → ${got.join('/')} u`);
  }
  void written;
  return { deviations };
}

const P6_PROVENANCE_FIELDS = ['p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6DurationType', 'p6ActivityType'] as const;

/** (b): reken beide door met dezelfde regels en vergelijk vroeg/laat/speling per bladtaak. */
function compareSchedules(label: string, original: Doc, back: XerReadResult): string[] {
  const deviations: string[] = [];
  const reread = docOf(back);
  const aligned: Doc = {
    ...original,
    project: {
      ...original.project,
      schedulingProfile: back.project.schedulingProfile,
      schedulingOptions: back.project.schedulingOptions,
      progressMode: back.project.progressMode,
    },
    // De P6-conventies gelden voor taken met P6-herkomst (`p6ProjectId`/`p6TaskId`, het expliciete
    // targetvenster, het type %-gereed, duurtype en activiteittype), die de lezer zet. Dezelfde
    // regels betekent dus ook: dezelfde herkomstvelden. Zonder dit verschilt bijvoorbeeld een
    // voltooide taak: onder P6-herkomst staan haar vroege datums op de statusdatum (B3).
    tasks: original.tasks.map(t => {
      const twin = reread.tasks.find(x => x.name === t.name);
      const p6: Partial<Task> = {};
      if (twin) for (const key of P6_PROVENANCE_FIELDS) if (twin[key] !== undefined) (p6 as Record<string, unknown>)[key] = twin[key];
      return { ...t, time: { ...t.time }, ...p6 };
    }),
  };
  const e1 = solve(aligned);
  const e2 = solve(reread);
  if (e1 || e2) { deviations.push(`${label}: rekenfout ${e1 ?? ''} / ${e2 ?? ''}`); return deviations; }
  const backTasks = byName(reread.tasks);
  for (const task of aligned.tasks) {
    if (!isLeafTask(task)) continue;
    const other = backTasks.get(task.name);
    if (!other) continue;
    const where = `${label} '${task.name}'`;
    const cal = effCal(aligned, task);
    for (const field of ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish'] as const) {
      const side = task.isMilestone ? (task.milestoneKind === 'FINISH' ? 'finish' : 'start')
        : field.endsWith('Start') ? 'start' : 'finish';
      const a = workPosition(cal, task.time[field], side);
      const b = workPosition(cal, other.time[field], side);
      if (a === undefined || b === undefined || Math.abs(a - b) > 0.5) {
        deviations.push(`${where}: ${field} ${task.time[field]} → ${other.time[field]}`);
      }
    }
    for (const field of ['totalFloat', 'freeFloat'] as const) {
      if (Math.abs(task.time[field] - other.time[field]) > 1e-6) {
        deviations.push(`${where}: ${field} ${task.time[field]} → ${other.time[field]}`);
      }
    }
  }
  return deviations;
}

// ── Synthetisch project ──────────────────────────────────────────────────────────────────────────

function synthetic(): Doc {
  const project = createDefaultProject();
  project.id = 'proj-xer-writer';
  project.name = 'Rondgang "XER" — één'; // aanhalingsteken, streepje en accent: escaping en codering
  project.startDate = '2026-03-02';
  project.statusDate = '2026-03-11';
  project.p6ProjectCode = 'RND-01';
  project.schedulingProfile = builtInProfile('p6');
  project.schedulingOptions = { p6CompletedLateFromRemainingWindow: true, lagCalendar: 'predecessor', totalFloatMode: 'finish', criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 } };
  project.progressMode = 'RETAINED_LOGIC';
  // Geërfde werkregel (review PR #393, punt 3): geen taak heeft een eigen regel.
  project.defaultWorkRule = 'FIXED_WORK';
  const calendar: WorkCalendar = {
    id: 'cal-default', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' }, { name: 'Bouwvak', startDate: '2026-03-16', endDate: '2026-03-17' }],
  };
  const sixDay: WorkCalendar = {
    id: 'cal-zes', name: 'Zesdaagse week', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 6, workEndHour: 14, hoursPerDay: 8, holidays: [],
    workingExceptions: [{ name: 'Inhaaldag', startDate: '2026-03-08', endDate: '2026-03-08', bands: [{ start: 360, end: 840 }] }],
  };
  // Uurkalender met een nachtband en een werkende uitzondering over middernacht (review punt 6).
  const night: WorkCalendar = {
    id: 'cal-nacht', name: 'Nachtploeg', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 22, workEndHour: 6, hoursPerDay: 8,
    workTime: { byWeekday: { 1: [{ start: 1320, end: 1800 }], 2: [{ start: 1320, end: 1800 }], 3: [{ start: 1320, end: 1800 }], 4: [{ start: 1320, end: 1800 }], 5: [{ start: 1320, end: 1800 }], 6: [], 7: [] } },
    holidays: [{ name: 'Vrij', startDate: '2026-03-25', endDate: '2026-03-25' }],
    workingExceptions: [{ name: 'Zaterdagnacht', startDate: '2026-03-14', endDate: '2026-03-14', bands: [{ start: 1320, end: 1800 }] }],
  };
  let n = 0;
  const task = (name: string, start: string, days: number, extra: Partial<Task> = {}): Task => ({
    id: `t${++n}`, name, description: '', wbsCode: `A${n * 10}`, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime(start, days), ...extra,
  });
  const s1 = task('Fase 1', '2026-03-02', 0, { isSummary: true, wbsCode: '1' });
  const s2 = task('Fase 2', '2026-03-02', 0, { isSummary: true, wbsCode: '2' });
  const a = task('Grondwerk', '2026-03-02', 4, { parentId: s1.id, status: 'COMPLETED' });
  a.time.actualStart = '2026-03-02'; a.time.actualFinish = '2026-03-05'; a.time.completion = 1;
  const b = task('Fundering\tstorten', '2026-03-06', 6, { parentId: s1.id, status: 'STARTED', calendarId: sixDay.id });
  b.name = 'Fundering storten';
  b.time.actualStart = '2026-03-06'; b.time.completion = 0.5;
  const m1 = task('Start ruwbouw', '2026-03-16', 0, { parentId: s2.id, isMilestone: true, milestoneKind: 'START' });
  const c = task('Ruwbouw', '2026-03-16', 10, { parentId: s2.id, constraint: { type: 'SNET', date: '2026-03-18' }, notes: [{ id: 'n1', text: 'Let op:\nkraan huren', done: false }] });
  const d = task('Gevel', '2026-03-30', 5, { parentId: s2.id, constraint: { type: 'FNLT', date: '2026-05-29' }, constraint2: { type: 'SNET', date: '2026-03-20' } });
  const e = task('Afbouw', '2026-04-06', 8, { parentId: s2.id, constraint: { type: 'ALAP' }, priority: 750 });
  const f = task('Oplevering', '2026-04-30', 0, { isMilestone: true, milestoneKind: 'FINISH', constraint: { type: 'MFO', date: '2026-06-12', hard: true } });
  const g = task('Installaties', '2026-04-01', 3, { parentId: s2.id, constraint: { type: 'MSO', date: '2026-04-15' } });
  const h = task('Keuring', '2026-04-01', 1, { parentId: s2.id, constraint: { type: 'SNLT', date: '2026-06-01' }, p6ActivityType: 'TT_WBS' });
  const i = task('Schoonmaak', '2026-04-01', 2, { parentId: s2.id, constraint: { type: 'FNET', date: '2026-04-20' } });
  s1.childIds = [a.id, b.id];
  s2.childIds = [m1.id, c.id, d.id, e.id, g.id, h.id, i.id];
  const tasks = [s1, a, b, s2, m1, c, d, e, g, h, i, f];
  let r = 0;
  const seq = (p: Task, q: Task, type: Sequence['type'], lagDays = 0, extra: Partial<Sequence> = {}): Sequence => ({
    id: `r${++r}`, predecessorId: p.id, successorId: q.id, type, lagDays, ...extra,
  });
  const sequences: Sequence[] = [
    seq(a, b, 'FINISH_START', 1),
    seq(b, m1, 'FINISH_START'),
    seq(m1, c, 'START_START', 2),
    seq(c, d, 'FINISH_FINISH', 0, { lagMinutes: 240, lagDays: 0.5 }),
    seq(d, e, 'FINISH_START', -1),
    seq(e, f, 'START_FINISH', 0),
    seq(c, g, 'FINISH_START'),
    seq(g, h, 'FINISH_START'),
    seq(h, i, 'FINISH_START'),
    seq(i, f, 'FINISH_START'),
  ];
  const resources: Resource[] = [
    { id: 'res-timmerman', name: 'Timmerman', type: 'LABOR', description: 'Ploeg van twee', maxUnits: 2, costPerHour: 55 },
    { id: 'res-beton', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 0, unitOfMeasure: 'm3', costPerHour: 120 },
    { id: 'res-kraan', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: sixDay.id },
    { id: 'res-bewaking', name: 'Bewaking', type: 'LABOR', description: '', maxUnits: 1, calendarId: night.id },
  ];
  const assignments: ResourceAssignment[] = [
    { id: 'as1', taskId: a.id, resourceId: 'res-timmerman', unitsPerDay: 1 },
    { id: 'as2', taskId: b.id, resourceId: 'res-timmerman', unitsPerDay: 0.5, curve: 'FRONT_LOADED' },
    { id: 'as3', taskId: b.id, resourceId: 'res-beton', unitsPerDay: 12 },
    { id: 'as4', taskId: c.id, resourceId: 'res-kraan', unitsPerDay: 1, curve: 'BELL' },
  ];
  return { project, calendar, calendars: [calendar, sixDay, night], tasks, sequences, resources, assignments };
}

// ── (a)+(b) synthetisch ──────────────────────────────────────────────────────────────────────────
{
  const doc = synthetic();
  // Eerst doorrekenen, zoals `exportAs` dat doet.
  eq('S0 synthetisch project rekent zonder fout', solve(doc), undefined);
  const written = write(doc, { projectCode: 'RND-01' });
  eq('S1 codering Windows-1252 (alle tekens passen)', written.encoding, 'windows-1252');
  ok('S2 ERMHDR-kop met versie en valuta', written.text.startsWith('ERMHDR\t20.12\t2026-10-20\tProject\tadmin\tadmin\tdbxDatabaseNoName\tProject Management\tEUR\r\n'));
  ok('S3 eindigt op %E', written.text.endsWith('%E\r\n'));
  for (const t of ['CURRTYPE', 'PROJECT', 'CALENDAR', 'SCHEDOPTIONS', 'PROJWBS', 'TASK', 'TASKPRED', 'RSRC', 'TASKRSRC', 'RSRCCURVDATA', 'TASKMEMO', 'UMEASURE']) {
    ok(`S4 tabel ${t} aanwezig`, written.text.includes(`%T\t${t}\r\n`));
  }
  ok('S5 aanhalingsteken als "" in de projectnaam', written.text.includes('Rondgang ""XER"" — één'));
  ok('S6 regeleinde in een notitie als DEL-DEL', written.text.includes('Let op:\u007f\u007fkraan huren'));
  ok('S7 tab in een naam is een spatie geworden', !/Fundering\tstorten/.test(written.text));
  ok('S8 bytes zijn Windows-1252 (é = 0xE9, — = 0x97)', written.bytes.includes(0xe9) && written.bytes.includes(0x97));
  const back = readBack(written.bytes);
  eq('S9 lezer: codering', back.xer.tableReport.encoding, 'windows-1252');
  eq('S10 lezer: geen tabelproblemen', back.xer.tableReport.issues, []);
  eq('S11 lezer: geen kalenderproblemen', back.xer.calendarIssues, []);
  eq('S12 lezer: geen onbekende enum-waarden', back.xer.enumFallbacks, []);
  eq('S13 projectnaam', back.project.name, 'Rondgang "XER" — één');
  eq('S14 statusdatum', back.project.statusDate, '2026-03-11');
  eq('S15 rekenprofiel P6', back.project.schedulingProfile?.baseId, 'p6');
  eq('S16 lagkalender', back.project.schedulingOptions?.lagCalendar, 'predecessor');
  const cmp = compareRoundTrip('synthetisch', doc, written, back);
  eq('S17 (a) rondgang zonder afwijkingen', cmp.deviations, []);
  const sched = compareSchedules('synthetisch', doc, back);
  eq('S18 (b) zelfde vroege/late datums en speling', sched, []);
  // Kalenders: banden, feestdagen, werkende uitzondering.
  const zes = back.resourceCalendars?.find(c => c.name === 'Zesdaagse week');
  eq('S19 zesdaagse kalender: werkdagen', zes?.workDays, [1, 2, 3, 4, 5, 6]);
  eq('S20 zesdaagse kalender: werkende uitzondering', zes?.workingExceptions?.map(w => [w.startDate, w.bands]), [['2026-03-08', [{ start: 360, end: 840 }]]]);
  eq('S21 projectkalender: feestdagen per datum', back.calendar.holidays.map(h => h.startDate).sort(), ['2026-03-16', '2026-03-17', '2026-04-27']);
  eq('S22 projectkalender: uren per dag', back.calendar.hoursPerDay, 8);
  // Resources.
  const beton = back.resources.find(r => r.name === 'Beton');
  eq('S23 materiaal: type en eenheid', [beton?.type, beton?.unitOfMeasure], ['MATERIAL', 'm3']);
  const kraan = back.resources.find(r => r.name === 'Kraan');
  eq('S24 materieel: type en kalender', [kraan?.type, back.resourceCalendars?.find(c => c.id === kraan?.calendarId)?.name], ['EQUIPMENT', 'Zesdaagse week']);
  // Notities en codes.
  eq('S25 notitie terug met regeleinde', back.tasks.find(t => t.name === 'Ruwbouw')?.notes?.map(x => x.text), ['Let op:\nkraan huren']);
  eq('S26 projectcode als proj_short_name', back.xer.scheduleOptions.sourceRows.find(r => r.table === 'PROJECT')?.cells.proj_short_name, 'RND-01');
  // Verliesverslag: dit project heeft feestdagnamen, een beschrijving bij een resource (gaat mee),
  // en geen andere verliezen.
  eq('S27 verliesverslag', written.loss, [{ code: 'holidayNames', count: 5 }]);
  // Vastgelegde rekenuitvoer reist mee als "Datums zoals opgeslagen".
  const rec = back.recordedTimes?.[back.tasks.find(t => t.name === 'Gevel')!.id];
  const gevel = doc.tasks.find(t => t.name === 'Gevel')!;
  eq('S28 vastgelegde vroege start/einde = berekende datums', [day(rec?.start), day(rec?.finish)], [day(gevel.time.earlyStart), day(gevel.time.earlyFinish)]);
}

// ── Verliesverslag en codering ───────────────────────────────────────────────────────────────────
{
  const doc = synthetic();
  doc.project.schedulingProfile = builtInProfile('ops');
  doc.project.description = 'Omschrijving';
  const t = doc.tasks.find(x => x.name === 'Gevel')!;
  t.description = 'Tekst';
  t.deadline = '2026-05-01';
  t.activityCodes = { fase: 'ruwbouw' };
  t.name = 'Gevel Łódź';
  const s1 = doc.tasks.find(x => x.name === 'Fase 1')!;
  doc.sequences.push({ id: 'rs', predecessorId: s1.id, successorId: t.id, type: 'FINISH_START', lagDays: 0, lagPercent: 50 });
  doc.sequences.push({ id: 're', predecessorId: doc.tasks.find(x => x.name === 'Keuring')!.id, successorId: doc.tasks.find(x => x.name === 'Schoonmaak')!.id, type: 'START_START', lagDays: 2, lagUnit: 'ELAPSEDTIME' });
  doc.resources.push({ id: 'res-ploeg', name: 'Ploeg', type: 'CREW', description: '', maxUnits: 1 });
  const written = write(doc, { baselineCount: 2 });
  const loss = Object.fromEntries(written.loss.map(l => [l.code, l.count]));
  eq('V1 rekenprofiel OPS ⇒ schedulingRules', loss.schedulingRules, 1);
  {
    // P6-profiel zonder de bronvlag voor voltooide taken: de lezer zet die vlag wel (RETAINED_LOGIC).
    const p6doc = synthetic();
    delete p6doc.project.schedulingOptions!.p6CompletedLateFromRemainingWindow;
    eq('V1b voltooide taak zonder P6-bronvlag ⇒ schedulingRules', write(p6doc).loss.find(l => l.code === 'schedulingRules')?.count, 1);
  }
  eq('V2 baselines geteld', loss.baselines, 2);
  eq('V3 relatie met een samenvatting geteld', loss.summaryRelations, 1);
  eq('V4 procent-lag uitgebakken (per bladrelatie)', loss.percentLags, 2);
  eq('V5 kalenderdag-lag geteld', loss.elapsedLags, 1);
  eq('V6 beschrijving, deadline, activiteitcode geteld', [loss.taskDescriptions, loss.deadlines, loss.activityCodes], [1, 1, 1]);
  eq('V7 resourcetype ploeg geteld', loss.resourceTypes, 1);
  eq('V8 projectgegevens geteld', loss.projectDetails, 1);
  // Ł en ź vallen buiten Windows-1252; ó past wel.
  eq('V9 teken buiten Windows-1252 ⇒ UTF-8 met melding', [written.encoding, loss.nonLatinText], ['utf-8', 2]);
  const back = readBack(written.bytes);
  eq('V10 UTF-8 leest terug met Ł', [back.xer.tableReport.encoding, back.tasks.some(x => x.name === 'Gevel Łódź')], ['utf-8', true]);
  ok('V11 UTF-8 zonder BOM (eerste byte E)', written.bytes[0] === 0x45);
  // Encoder zelf.
  eq('V12 encoder: € en ü', Array.from(encodeWindows1252('€ü').bytes ?? []), [0x80, 0xfc]);
  eq('V13 encoder: Ł past niet', encodeWindows1252('Ł').unencodable, 1);
}

// ── (a)+(b) voorbeeldprojecten ───────────────────────────────────────────────────────────────────
{
  const dir = join(ROOT, 'public/examples');
  const files = readdirSync(dir).filter(f => f.endsWith('.ifc')).sort();
  ok('E0 voorbeeldprojecten gevonden', files.length >= 5);
  for (const file of files) {
    const original = docOf(readIFC(readFileSync(join(dir, file), 'utf8')));
    const err = solve(original);
    eq(`E1 ${file}: rekent`, err, undefined);
    const written = write(original);
    let back: XerReadResult;
    try { back = readBack(written.bytes); } catch (error) { diffs.push(`E2 ${file}: lezen faalt: ${String(error)}`); continue; }
    eq(`E3 ${file}: geen tabelproblemen`, back.xer.tableReport.issues, []);
    eq(`E4 ${file}: geen kalenderproblemen`, back.xer.calendarIssues, []);
    eq(`E5 ${file}: geen onbekende enum-waarden`, back.xer.enumFallbacks, []);
    const cmp = compareRoundTrip(file, original, written, back);
    eq(`E6 ${file}: (a) rondgang zonder afwijkingen`, cmp.deviations, []);
    // Een deadline kent XER niet; de writer meldt die als verlies (`deadlines`). Een deadline stuurt
    // de late datums, dus (b) vergelijkt dan met het origineel zonder deadlines. De afwijking die
    // de deadline zelf geeft, staat hieronder als notitie (niet verdoezeld).
    const deadlineCount = original.tasks.filter(t => t.deadline).length;
    if (deadlineCount > 0) {
      eq(`E7a ${file}: deadlines gemeld als verlies`, written.loss.find(l => l.code === 'deadlines')?.count, deadlineCount);
      const withDeadlines = compareSchedules(file, original, back);
      notes.push(`${file}: ${deadlineCount} deadline(s) vallen weg; met deadline wijken ${new Set(withDeadlines.map(d => d.split("'")[1])).size} taken af in late datums/speling`);
    }
    const withoutDeadlines: Doc = { ...original, tasks: original.tasks.map(t => { const { deadline: _d, ...rest } = t; return rest; }) };
    const sched = compareSchedules(file, withoutDeadlines, back);
    eq(`E7 ${file}: (b) zelfde vroege/late datums en speling`, sched, []);
    notes.push(`${file}: ${original.tasks.length} taken, ${original.sequences.length} relaties, verlies ${JSON.stringify(written.loss)}`);
  }
}

// ── (c) XER → OPS → XER → OPS op de fixtures ────────────────────────────────────────────────────
{
  const dir = join(ROOT, 'tests/browser/fixtures/xer');
  const files = readdirSync(dir).filter(f => f.endsWith('.xer')).sort();
  ok('X0 XER-fixtures gevonden', files.length >= 3);
  for (const file of files) {
    const first = readBack(new Uint8Array(readFileSync(join(dir, file))));
    const doc1 = docOf(first);
    // Zoals `exportAs`: een verouderd schema eerst doorrekenen.
    eq(`X0 ${file}: rekent`, solve(doc1), undefined);
    const w1 = write(doc1, { projectCode: first.xer.scheduleOptions.sourceRows.find(r => r.table === 'PROJECT')?.cells.proj_short_name });
    const second = readBack(w1.bytes);
    const doc2 = docOf(second);
    eq(`X0 ${file}: rekent na rondgang`, solve(doc2), undefined);
    const leaves1 = doc1.tasks.filter(isLeafTask);
    const leaves2 = doc2.tasks.filter(isLeafTask);
    eq(`X1 ${file}: aantal activiteiten`, leaves2.length, leaves1.length);
    for (const t1 of leaves1) {
      // P6 eist een numeriek task_id; de writer nummert een niet-numeriek id (T1) dus opnieuw.
      // Zoek de activiteit daarom op haar code (task_code), die wel ongewijzigd reist.
      const t2 = leaves2.find(t => t.wbsCode === t1.wbsCode);
      if (!t2) { diffs.push(`X2 ${file}: activiteit ${t1.wbsCode} ontbreekt`); continue; }
      eq(`X3 ${file} ${t1.wbsCode}: naam, code, status`, [t2.name, t2.wbsCode, t2.status], [t1.name, t1.wbsCode, t1.status]);
      eq(`X4 ${file} ${t1.wbsCode}: duur en restduur (min)`, [t2.time.durationMinutes, t2.time.remainingMinutes], [t1.time.durationMinutes, t1.time.remainingMinutes]);
      eq(`X5 ${file} ${t1.wbsCode}: geplande start en einde`, [t2.time.scheduleStart, t2.time.scheduleFinish], [t1.time.scheduleStart, t1.time.scheduleFinish]);
      eq(`X6 ${file} ${t1.wbsCode}: type, duurtype, werkregel`, [t2.p6ActivityType, t2.p6DurationType, t2.workRule], [t1.p6ActivityType, t1.p6DurationType, t1.workRule]);
      eq(`X7 ${file} ${t1.wbsCode}: kalender`, effCal(doc2, t2).name, effCal(doc1, t1).name);
    }
    eq(`X8 ${file}: kalenderbanden`, doc2.calendar.workTime, doc1.calendar.workTime);
    eq(`X9 ${file}: projectnaam`, second.project.name, first.project.name);
    eq(`X10 ${file}: (b) zelfde vroege/late datums en speling`, compareSchedules(file, doc1, second), []);
    // Stabiliteit: XER → OPS → XER → OPS → XER geeft byte-gelijke tweede en derde export.
    const w2 = write(doc2, { projectCode: second.xer.scheduleOptions.sourceRows.find(r => r.table === 'PROJECT')?.cells.proj_short_name });
    eq(`X11 ${file}: tweede en derde export byte-gelijk`, w2.text === w1.text, true);
    if (w2.text !== w1.text) {
      const a = w1.text.split('\r\n'); const b = w2.text.split('\r\n');
      const i = a.findIndex((line, k) => line !== b[k]);
      diffs.push(`   eerste verschil op regel ${i + 1}:\n     ${a[i]}\n     ${b[i]}`);
    }
    notes.push(`${file}: verlies ${JSON.stringify(w1.loss)}`);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────────
for (const note of notes) console.log(`   · ${note}`);
if (diffs.length === 0) {
  console.log(`OK  xer-writer: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  xer-writer: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
