import { writeIFC } from '@/services/ifc/ifcWriter';
import { checkIfcSchema, parseStep } from './ifcSchemaCheck';
import { readIFC } from '@/services/ifc/ifcReader';
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { solveProject } from '@/engine/scheduler/solveProject';
import { ALL_RECORDED_SLOT_KEYS, IFC_TASKTIME_SLOTS, TASKTIME_SLOT, IFC_TASK_SLOTS, TASK_SLOT } from '@/services/ifc/ifcTaskSlots';
import type { Task, TaskTime, TaskSplitGap } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { IFC_SCHEMAS, type Project } from '@/types/project';
import type { WorkCalendar, Holiday, WorkingException } from '@/types/calendar';
import type { ActivityCodeType, ActivityCodeValue, CustomFieldDef } from '@/types/structure';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';
import type { ExtTaskTime } from '@/extensions/extTypes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { crewEdgeResources } from './ifcCrewIndexFixture';
import { COST_RESOURCE_NAMES, fixture, plainTime, RMember, TM, TX } from './ifcRoundtripFixture';

declare const process: { exit(code: number): never };

const HERE = fileURLToPath(new URL('.', import.meta.url));

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

for (const duplicates of [false, true]) {
  const crewResources = crewEdgeResources(duplicates);
  const before = structuredClone(crewResources);
  const input: ImportResult = { ...fixture, tasks: [], sequences: [], assignments: [], resources: crewResources, baselines: [] };
  const ifc = writeIFC(input);
  const entities = parseStep(ifc);
  const names = new Map(entities.filter(e => e.type.endsWith('RESOURCE')).map(e => [
    e.id, e.args[2].k === 'str' ? e.args[2].raw.slice(1, -1) : '',
  ]));
  const nests = entities.filter(e => e.type === 'IFCRELNESTS' && e.args[4].k === 'ref' && names.has(e.args[4].id));
  const actual = nests.map(e => ({
    parent: e.args[4].k === 'ref' ? names.get(e.args[4].id) : '',
    members: e.args[5].k === 'list' ? e.args[5].items.map(v => v.k === 'ref' ? names.get(v.id) : '') : [],
  }));
  const alpha = duplicates ? 'Alfa laatste' : 'Alfa';
  const alphaMembers = duplicates
    ? ['Alfa twee', 'Alfa een laatste', 'Alfa een laatste', 'Alfa twee'] : ['Alfa twee', 'Alfa een'];
  const expected = [
    { parent: 'Beta', members: ['Beta een'] }, { parent: alpha, members: alphaMembers },
    { parent: 'Lege sleutel', members: ['Lid lege sleutel'] },
    ...(duplicates ? [{ parent: alpha, members: alphaMembers }] : []),
  ];
  assert(JSON.stringify(actual) === JSON.stringify(expected), `ploegen: exacte nest-/ledenvolgorde, dubbele id's=${duplicates}`);
  assert(JSON.stringify(crewResources) === JSON.stringify(before), 'ploegen: schrijven behoudt invoer');
  assert(!nests.some(e => JSON.stringify(e.args).includes('"id":0')), 'ploegen: geen #0-verwijzingen');
  if (!duplicates) {
    const reopened = readIFC(ifc);
    const again = readIFC(writeIFC(reopened));
    const pairs = (r: ImportResult) => r.resources.map(member => [member.name, r.resources.find(p => p.id === member.parentId)?.name]);
    assert(JSON.stringify(pairs(reopened)) === JSON.stringify(pairs(again)), 'ploegen: koppelingen blijven na tweede export gelijk');
    crewResources.find(r => r.id === 'a1')!.parentId = 'constructor';
    const changed = readIFC(writeIFC(input));
    assert(changed.resources.find(r => r.id === changed.resources.find(m => m.name === 'Alfa een')?.parentId)?.name === 'Beta',
      'ploegen: volgende save leest gewijzigde koppeling op hetzelfde invoerobject');
    crewResources.find(r => r.id === 'a1')!.parentId = '__proto__';
    const restored = readIFC(writeIFC(input));
    assert(restored.resources.find(r => r.id === restored.resources.find(m => m.name === 'Alfa een')?.parentId)?.name === 'Alfa',
      'ploegen: teruggezette koppeling wordt opnieuw gelezen');
  }
}

{
  const damaged = crewEdgeResources().slice(0, 2).map((r, i) => ({
    ...r, id: i === 0 ? NaN : 'lid-nan', type: i === 0 ? 'CREW' : 'LABOR', parentId: NaN,
  })) as unknown as Resource[];
  const output = writeIFC({ ...fixture, tasks: [], sequences: [], assignments: [], resources: damaged, baselines: [] });
  assert(!parseStep(output).some(e => e.type === 'IFCRELNESTS'), 'ploegen: NaN blijft ongelijk aan zichzelf');
}

type Any = Record<string, unknown>;
const def = <T>(v: T | undefined): v is T => v !== undefined;

interface Keys {
  cal(id: string | undefined): string | undefined;
  task(id: string): string;
  res(id: string): string;
  codeType(id: string): string;
  codeValue(id: string): string;
  fieldDef(id: string): string;
}

const KEEP = { keep: true } as const;

type CanonCell<T> =
  | typeof KEEP
  | { readonly skip: string }
  | { readonly as?: string; readonly get: (o: T, k: Keys) => unknown };

type CanonSpec<T> = Record<keyof T, CanonCell<T>>;

function canonize<T extends object>(spec: CanonSpec<T>, o: T, k: Keys): Any {
  const src = o as unknown as Any;
  const out: Any = {};
  for (const key of Object.keys(spec) as (keyof T & string)[]) {
    const cell = spec[key];
    if ('skip' in cell) continue;
    if ('keep' in cell) out[key] = src[key];
    else out[cell.as ?? key] = cell.get(o, k);
  }
  return out;
}

const HOLIDAY_CANON = {
  name: KEEP, startDate: KEEP, endDate: KEEP,
} satisfies CanonSpec<Holiday>;

const WORKING_EXCEPTION_CANON = {
  name: KEEP, startDate: KEEP, endDate: KEEP, bands: KEEP,
} satisfies CanonSpec<WorkingException>;

const CALENDAR_CANON = {
  id: { skip: 'wijkt na het eerste inlezen af (uit het GlobalId); de NAAM is de natuurlijke sleutel (Keys.cal)' },
  name: KEEP, description: KEEP,
  workDays: { get: (c: WorkCalendar) => [...c.workDays] },
  workStartHour: KEEP, workEndHour: KEEP, hoursPerDay: KEEP,
  simpleBreakStartMinute: { skip: 'optioneel scalar-pauzepatroon; gedekt door check-calendar-breaks.ts' },
  simpleBreakDurationMinutes: { skip: 'optioneel scalar-pauzepatroon; gedekt door check-calendar-breaks.ts' },
  holidays: {
    get: (c: WorkCalendar, k: Keys) => [...c.holidays]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(h => canonize(HOLIDAY_CANON, h, k)),
  },
  workingExceptions: {
    get: (c: WorkCalendar, k: Keys) => [...(c.workingExceptions ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => canonize(WORKING_EXCEPTION_CANON, e, k)),
  },
  ifcTimePeriods: { get: (c: WorkCalendar) => c.ifcTimePeriods ?? [] },
  p6Source: KEEP,
  p6NonWorkPenaltyDates: KEEP,
  p6NonWorkPenaltyDatesState: KEEP,
  generation: KEEP,
  workTime: {
    get: (c: WorkCalendar) => c.workTime
      ? ([1, 2, 3, 4, 5, 6, 7] as const).map(d => (c.workTime!.byWeekday[d] ?? []).map(b => ({ start: b.start, end: b.end })))
      : undefined,
  },
  shift: KEEP,
  libraryOrigin: KEEP,
} satisfies CanonSpec<WorkCalendar>;

const TIME_CANON = {
  durationType: KEEP, durationUnit: KEEP, scheduleDuration: KEEP,
  durationMinutes: KEEP,
  scheduleStart: KEEP, scheduleFinish: KEEP,
  earlyStart: KEEP, earlyFinish: KEEP, lateStart: KEEP, lateFinish: KEEP,
  freeFloat: KEEP, totalFloat: KEEP, isCritical: KEEP,
  interferingFloat: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  totalFloatMinutes: KEEP,
  freeFloatMinutes: KEEP,
  isNearCritical: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  floatPath: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  actualStart: KEEP, actualFinish: KEEP, actualDuration: KEEP, remainingTime: KEEP,
  remainingMinutes: KEEP,
  completion: KEEP,
  progressBeforeRecalculation: { skip: 'tijdelijke rekenbasis tot F5, geen planningsdata voor IFC' },
  resume: KEEP, stop: KEEP,
} satisfies CanonSpec<TaskTime>;

const TASK_CANON = {
  id: { skip: 'wijkt na het eerste inlezen af (uit het GlobalId); wbsCode is de natuurlijke sleutel (Keys.task)' },
  name: KEEP, description: KEEP, wbsCode: KEEP, taskType: KEEP,
  customTaskTypeId: { skip: 'lege optionele fixturewaarde normaliseert naar undefined; echte custom-id wordt gedekt door check-custom-task-types.ts' },
  status: KEEP,
  isMilestone: KEEP, milestoneKind: KEEP, mandatory: KEEP, priority: KEEP, levelingDelay: KEEP,
  levelingDelayMinutes: KEEP, levelingDelayElapsed: KEEP, splitGaps: KEEP, manuallyScheduled: KEEP,
  timephasedFinishFloor: KEEP, timephasedStartAnchor: KEEP,
  timephasedDurationWalks: {
    get: (t: Task, k: Keys) => (t.timephasedDurationWalks ?? []).map(w => ({
      anchor: w.anchor, resourceCalendarId: k.cal(w.resourceCalendarId), workMinutes: w.workMinutes ?? null,
    })),
  },
  timephasedContours: KEEP,
  mspTaskType: KEEP, effortDriven: KEEP,
  workRule: KEEP,
  p6DurationType: KEEP,
  p6ActivityType: KEEP,
  p6ProjectId: KEEP,
  p6TaskId: KEEP,
  p6ExplicitTargetWindow: KEEP,
  p6CompletePctType: KEEP,
  p6ExpectedFinish: KEEP,
  p6SuspendResume: KEEP,
  isSummary: { skip: 'false is de afwezige default; expliciet true round-trippt in check-xer-reader' },
  parentId: { as: 'parent', get: (t: Task, k: Keys) => (t.parentId ? k.task(t.parentId) : null) },
  childIds: { as: 'children', get: (t: Task, k: Keys) => t.childIds.map(c => k.task(c)).sort() },
  time: { get: (t: Task, k: Keys) => canonize(TIME_CANON, t.time, k) },
  resourceIds: { get: (t: Task, k: Keys) => [...t.resourceIds].map(id => k.res(id)).sort() },
  color: KEEP,
  activityCodes: {
    get: (t: Task, k: Keys) => t.activityCodes
      ? Object.fromEntries(Object.entries(t.activityCodes).map(([ty, va]) => [k.codeType(ty), k.codeValue(va)]))
      : undefined,
  },
  customFields: {
    get: (t: Task, k: Keys) => t.customFields
      ? Object.fromEntries(Object.entries(t.customFields).map(([d, v]) => [k.fieldDef(d), v]))
      : undefined,
  },
  constraint: KEEP, constraint2: KEEP, isHammock: KEEP, externalLinks: KEEP, deadline: KEEP,
  calendarId: { as: 'calendar', get: (t: Task, k: Keys) => k.cal(t.calendarId) },
  notes: KEEP,
} satisfies CanonSpec<Task>;

const SEQUENCE_CANON = {
  id: { skip: 'wijkt na het eerste inlezen af (uit het GlobalId); de relatie is identificeerbaar via pred/succ/type' },
  predecessorId: { as: 'pred', get: (s: Sequence, k: Keys) => k.task(s.predecessorId) },
  successorId: { as: 'succ', get: (s: Sequence, k: Keys) => k.task(s.successorId) },
  type: KEEP, lagDays: KEEP, lagMinutes: KEEP, lagUnit: KEEP, lagPercent: KEEP,
  p6StartAtPredecessorFinishBoundary: KEEP,
} satisfies CanonSpec<Sequence>;

const RESOURCE_CANON = {
  id: { skip: 'wijkt na het eerste inlezen af (uit het GlobalId); de NAAM is de natuurlijke sleutel (Keys.res)' },
  name: KEEP, type: KEEP, description: KEEP, costPerHour: KEEP,
  availability: { skip: '(b) @deprecated migratieveld; de writer schrijft het bewust niet (KNOWN_GAPS)' },
  maxUnits: KEEP,
  calendarId: { as: 'calendar', get: (r: Resource, k: Keys) => k.cal(r.calendarId) },
  availabilitySteps: KEEP, unitOfMeasure: KEEP,
  parentId: { as: 'parent', get: (r: Resource, k: Keys) => (r.parentId ? k.res(r.parentId) : undefined) },
  color: KEEP,
  libraryOrigin: KEEP,
} satisfies CanonSpec<Resource>;

const ASSIGNMENT_CANON = {
  id: { skip: 'wijkt na het eerste inlezen af (uit het GlobalId); taak+resource+units identificeren de toewijzing' },
  taskId: { as: 'task', get: (a: ResourceAssignment, k: Keys) => k.task(a.taskId) },
  resourceId: { as: 'resource', get: (a: ResourceAssignment, k: Keys) => k.res(a.resourceId) },
  unitsPerDay: KEEP, curve: KEEP,
  plannedUnitsPerDay: KEEP,
  workWindowStart: KEEP, workWindowFinish: KEEP,
  curveValues: KEEP,
  plannedWorkMinutes: KEEP, actualWorkMinutes: KEEP, remainingWorkMinutes: KEEP,
  costAmount: {
    get: (a: ResourceAssignment, k: Keys) => (COST_RESOURCE_NAMES.has(k.res(a.resourceId)) ? a.costAmount : undefined),
  },
} satisfies CanonSpec<ResourceAssignment>;

const PROJECT_CANON = {
  id: { skip: 'documentinterne id; de reader genereert een eigen id, geen contractuele data' },
  name: KEEP,
  description: KEEP, startDate: KEEP, endDate: KEEP,
  calendarId: { as: 'calendar', get: (p: Project, k: Keys) => k.cal(p.calendarId) },
  createdAt: KEEP, modifiedAt: KEEP, author: KEEP, company: KEEP,
  wbsAutoNumber: KEEP, statusDate: KEEP, progressMode: KEEP,
  schedulingOptions: {
    get: (p: Project, k: Keys) => (p.schedulingOptions?.leveling?.resources
      ? {
        ...p.schedulingOptions,
        leveling: {
          ...p.schedulingOptions.leveling,
          resources: p.schedulingOptions.leveling.resources.map(entry => ({ ...entry, resourceId: k.res(entry.resourceId) })),
        },
      }
      : p.schedulingOptions),
  },
  schedulingProfile: KEEP,
  defaultTaskDurationUnit: KEEP,
  defaultWorkRule: KEEP,
  companyId: KEEP, companyName: KEEP,
  ifcSchema: KEEP,
  ifcSchemaUnconfirmed: KEEP,
  p6ProjectCode: KEEP,
  dependentProjectsFolder: KEEP,
  anchorsFromOpenDocuments: KEEP,
} satisfies CanonSpec<Project>;

const BASELINE_TASK_CANON = {
  taskId: { as: 'task', get: (bt: BaselineTask, k: Keys) => k.task(bt.taskId) },
  sourceTaskId: KEEP, sourceTaskCode: KEEP,
  start: KEEP, finish: KEEP, duration: KEEP, isMilestone: KEEP, milestoneKind: KEEP,
} satisfies CanonSpec<BaselineTask>;

const BASELINE_CANON = {
  id: KEEP,
  name: KEEP, createdAt: KEEP, sourceProjectId: KEEP,
  tasks: {
    get: (b: Baseline, k: Keys) => (b.tasks ?? []).map(bt => canonize(BASELINE_TASK_CANON, bt, k))
      .sort((x, y) => String(x.task).localeCompare(String(y.task))),
  },
  projectEnd: KEEP, projectDuration: KEEP,
} satisfies CanonSpec<Baseline>;

const CODE_VALUE_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de CODE is hier de natuurlijke sleutel' },
  code: KEEP, description: KEEP, color: KEEP,
} satisfies CanonSpec<ActivityCodeValue>;

const CODE_TYPE_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de NAAM is hier de natuurlijke sleutel' },
  name: KEEP,
  values: {
    get: (t: ActivityCodeType, k: Keys) => [...t.values]
      .sort((x, y) => x.code.localeCompare(y.code))
      .map(v => canonize(CODE_VALUE_CANON, v, k)),
  },
} satisfies CanonSpec<ActivityCodeType>;

const FIELD_DEF_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de NAAM is hier de natuurlijke sleutel' },
  name: KEEP, type: KEEP,
} satisfies CanonSpec<CustomFieldDef>;

function canon(r: ImportResult): Any {
  const cals = [r.calendar, ...(r.resourceCalendars ?? [])];
  const calNameById = new Map(cals.map(c => [c.id, c.name]));
  const taskKeyById = new Map(r.tasks.map(t => [t.id, t.wbsCode]));
  const resNameById = new Map(r.resources.map(res => [res.id, res.name]));
  const typeNameById = new Map((r.activityCodeTypes ?? []).map(t => [t.id, t.name]));
  const codeById = new Map<string, string>();
  for (const t of r.activityCodeTypes ?? []) for (const v of t.values) codeById.set(v.id, v.code);
  const defNameById = new Map((r.customFieldDefs ?? []).map(d => [d.id, d.name]));

  const k: Keys = {
    cal: id => (id ? calNameById.get(id) ?? id : undefined),
    task: id => taskKeyById.get(id) ?? id,
    res: id => resNameById.get(id) ?? id,
    codeType: id => typeNameById.get(id) ?? id,
    codeValue: id => codeById.get(id) ?? id,
    fieldDef: id => defNameById.get(id) ?? id,
  };

  return {
    project: canonize(PROJECT_CANON, r.project, k),
    calendar: canonize(CALENDAR_CANON, r.calendar, k),
    resourceCalendars: (r.resourceCalendars ?? []).map(c => canonize(CALENDAR_CANON, c, k))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    tasks: [...r.tasks].sort((a, b) => a.wbsCode.localeCompare(b.wbsCode)).map(t => canonize(TASK_CANON, t, k)),
    sequences: [...r.sequences].map(s => canonize(SEQUENCE_CANON, s, k))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    resources: [...r.resources].sort((a, b) => a.name.localeCompare(b.name)).map(res => canonize(RESOURCE_CANON, res, k)),
    assignments: [...r.assignments].map(a => canonize(ASSIGNMENT_CANON, a, k))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    activityCodeTypes: [...(r.activityCodeTypes ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => canonize(CODE_TYPE_CANON, t, k)),
    customFieldDefs: [...(r.customFieldDefs ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => canonize(FIELD_DEF_CANON, d, k)),
    baselines: [...(r.baselines ?? [])].map(b => canonize(BASELINE_CANON, b, k))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    activeBaselineId: r.activeBaselineId ?? null,
    importPristine: r.importPristine ?? false,
    recordedSourceFormat: r.recordedSourceFormat ?? null,
  };
}

function collectDiffs(path: string, a: unknown, b: unknown, out: string[]): void {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    if (aa.length !== bb.length) out.push(`${path}: array-lengte ${aa.length} ≠ ${bb.length}`);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) collectDiffs(`${path}[${i}]`, aa[i], bb[i], out);
    return;
  }
  const ao = a && typeof a === 'object' ? a as Any : undefined;
  const bo = b && typeof b === 'object' ? b as Any : undefined;
  if (ao || bo) {
    const keys = new Set([...Object.keys(ao ?? {}), ...Object.keys(bo ?? {})]);
    for (const k of [...keys].sort()) {
      const av = ao?.[k];
      const bv = bo?.[k];
      if (av === undefined && bv === undefined) continue;
      collectDiffs(path ? `${path}.${k}` : k, av, bv, out);
    }
    return;
  }
  if (a !== b) out.push(`${path}: verwacht ${JSON.stringify(a)} — kreeg ${JSON.stringify(b)}`);
}

const expectedInput: ImportResult = { ...fixture, resourceCalendars: (fixture.resourceCalendars ?? []).filter(c => c.id !== fixture.project.calendarId) };
const firstIfc = writeIFC(fixture);
const rt1 = readIFC(firstIfc);
const rt2 = readIFC(writeIFC(rt1));
assert(rt1.tasks.every(task => !task.time.progressBeforeRecalculation),
  'de tijdelijke rekenbasis voor voortgang wordt niet in IFC bewaard');

const hasP6BoundarySequence = (input: ImportResult) =>
  input.sequences.some(sequence => sequence.p6StartAtPredecessorFinishBoundary === true);

{
  const validIfc = writeIFC(fixture);
  const lines = validIfc.split('\n');
  const psetIndex = lines.findIndex(line => line.includes("'OPS_Sequences'"));
  assert(psetIndex >= 0, 'OPS_Sequences-pset ontbreekt in de geldige writerfixture');
  const psetId = lines[psetIndex].match(/^#(\d+)=/)?.[1];
  assert(!!psetId, 'STEP-id van OPS_Sequences-pset ontbreekt');
  const relationIndex = lines.findIndex(line => line.includes('IFCRELDEFINESBYPROPERTIES(')
    && line.endsWith(`,#${psetId});`));
  assert(relationIndex >= 0, 'IFCRELDEFINESBYPROPERTIES voor OPS_Sequences ontbreekt');

  const orphan = readIFC(lines.filter((_, index) => index !== relationIndex).join('\n'));
  assert(!hasP6BoundarySequence(orphan),
    'een orphan OPS_Sequences-pset zonder relatie naar het live schema blijft inert');

  const maskedLines = [...lines];
  maskedLines.splice(psetIndex, 0,
    "#990001=IFCPROPERTYSINGLEVALUE('P6StartAtPredecessorFinishBoundarySequenceGuids',$,IFCTEXT('[\"masker\"]'),$);",
    "#990002=IFCPROPERTYSET('maskerpset00000000000001',#1,'OPS_Sequences',$,(#990001));");
  const masked = readIFC(maskedLines.join('\n'));
  assert(hasP6BoundarySequence(masked),
    'een eerdere orphan OPS_Sequences-pset mag de later geldig gekoppelde pset niet maskeren');

  const baselineScheduleId = lines.find(line => line.includes('IFCWORKSCHEDULE(') && line.includes('.BASELINE.'))
    ?.match(/^#(\d+)=/)?.[1];
  assert(!!baselineScheduleId, 'baseline-IFCWORKSCHEDULE ontbreekt in de fixture');
  const wrongLines = [...lines];
  wrongLines[relationIndex] = wrongLines[relationIndex].replace(/,\(#[^)]+\),(#\d+)\);$/, `,(#${baselineScheduleId}),$1);`);
  const wrongSchedule = readIFC(wrongLines.join('\n'));
  assert(!hasP6BoundarySequence(wrongSchedule),
    'OPS_Sequences op een baseline/verkeerd schema activeert de live relatie niet');

  const owner = lines[relationIndex].match(/,\((#\d+)\),#\d+\);$/)?.[1];
  assert(!!owner, 'live schema-eigenaar ontbreekt in OPS_Sequences-relatie');
  const duplicateLines = [...lines];
  duplicateLines.splice(relationIndex + 1, 0,
    "#990003=IFCPROPERTYSINGLEVALUE('P6StartAtPredecessorFinishBoundarySequenceGuids',$,IFCTEXT('[\"duplicaat\"]'),$);",
    "#990004=IFCPROPERTYSET('duplicaatpset000000000001',#1,'OPS_Sequences',$,(#990003));",
    `#990005=IFCRELDEFINESBYPROPERTIES('duplicaatrel0000000000001',#1,$,$,(${owner}),#990004);`);
  const duplicate = readIFC(duplicateLines.join('\n'));
  assert(!hasP6BoundarySequence(duplicate),
    'twee geldig gekoppelde OPS_Sequences-bronnen zijn ambigu en falen gesloten');
}

{
  const costLine = firstIfc.split('\n').find(line => line.includes('IFCCONSTRUCTIONMATERIALRESOURCE(') && line.includes("'Leges vergunning'"));
  assert(!!costLine && costLine.includes(",'COST',") && costLine.endsWith('.USERDEFINED.);'),
    `#815: kostenresource als IFCCONSTRUCTIONMATERIALRESOURCE met ObjectType 'COST' en .USERDEFINED. (kreeg ${costLine})`);
  const matLine = firstIfc.split('\n').find(line => line.includes('IFCCONSTRUCTIONMATERIALRESOURCE(') && line.includes("'Beton C30'"));
  assert(!!matLine && !matLine.includes(",'COST',"), '#815: gewoon materiaal krijgt geen COST-markering');
  for (const [label, rt] of [['rt1', rt1], ['rt2', rt2]] as const) {
    const cost = rt.resources.find(r => r.name === 'Leges vergunning');
    assert(cost?.type === 'COST', `#815 ${label}: kostenresource leest terug als COST (kreeg ${cost?.type})`);
    const mat = rt.resources.find(r => r.name === 'Beton C30');
    assert(mat?.type === 'MATERIAL', `#815 ${label}: materiaal blijft MATERIAL`);
    const costOn = (wbs: string) => rt.assignments.find(a => a.resourceId === cost?.id
      && rt.tasks.find(t => t.id === a.taskId)?.wbsCode === wbs);
    assert(costOn('1.2')?.costAmount === 1250.55, `#815 ${label}: bedrag met centen blijft 1250.55 (kreeg ${costOn('1.2')?.costAmount})`);
    assert(costOn('1.1')?.costAmount === 0, `#815 ${label}: bedrag 0 op de mijlpaal blijft 0 (kreeg ${costOn('1.1')?.costAmount})`);
    assert(!!costOn('1.3') && costOn('1.3')!.costAmount === undefined, `#815 ${label}: zonder bedrag blijft zonder bedrag`);
    const a1Back = rt.assignments.find(a => a.unitsPerDay === 2 && rt.resources.find(r => r.id === a.resourceId)?.name === 'Timmerman Jan');
    assert(!!a1Back && a1Back.costAmount === undefined, '#815: een bedrag op een werkresource valt bij het lezen weg');
  }
  const dirty = writeIFC({
    ...fixture,
    assignments: [...fixture.assignments.filter(a => a.id !== 'a4'),
      { id: 'a4', taskId: 't-x', resourceId: 'r-cost', unitsPerDay: 3, curve: 'BELL', remainingWorkMinutes: 600, costAmount: 10 }],
  });
  const dirtyBack = readIFC(dirty);
  const dirtyCost = dirtyBack.resources.find(r => r.name === 'Leges vergunning');
  const dirtyA4 = dirtyBack.assignments.find(a => a.resourceId === dirtyCost?.id && a.costAmount === 10);
  assert(!!dirtyA4 && dirtyA4.unitsPerDay === 1 && dirtyA4.remainingWorkMinutes === undefined && dirtyA4.curve === undefined,
    `#815: werkvelden op een kostentoewijzing worden bij lezen gewist (kreeg ${JSON.stringify(dirtyA4)})`);
}

{
  const orphanPenaltyIfc = writeIFC(fixture).split('\n')
    .filter(line => !line.includes("IFCPROPERTYSINGLEVALUE('P6Source'"))
    .join('\n');
  const orphanPenalty = readIFC(orphanPenaltyIfc);
  assert(orphanPenalty.calendar.p6Source === undefined
    && orphanPenalty.calendar.p6NonWorkPenaltyDates === undefined,
  'P6NonWorkPenaltyDates zonder P6Source=XER blijft bij IFC-inlees inert en wordt niet gematerialiseerd');
}

{
  const hostile = JSON.stringify({
    p6Source: 'XER',
    p6CompletedLateFromRemainingWindow: true,
    useProjectEndDateForFloat: 'ja',
    preserveActualDatesInBackwardPass: 1,
    lagCalendar: 'maan',
    totalFloatMode: 'finish',
    nearCriticalThreshold: 'drie',
    criticalDefinition: { mode: 'NIET_BESTAAND', thresholdHours: 'tekst' },
    floatPaths: { enabled: true, method: 'TOTAL_FLOAT' },
    onzin: [1, 2, 3],
  });
  const written = writeIFC({ ...fixture, project: { ...fixture.project, schedulingProfile: undefined } });
  const pattern = /IFCPROPERTYSINGLEVALUE\('SchedulingOptions',\$,IFCTEXT\('[^']*'\),\$\)/;
  assert(pattern.test(written), 'fixture schrijft het OPS_SchedulingOptions-pset (anker voor de vijandige vervanging)');
  const hostileIfc = written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${hostile}'),$)`);
  const canon = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) =>
    (v && typeof v === 'object' && !Array.isArray(v))
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v);
  const hostileProject = readIFC(hostileIfc).project;
  assert(canon(hostileProject.schedulingOptions) === canon({
    p6CompletedLateFromRemainingWindow: true,
    totalFloatMode: 'finish',
  }), 'vijandig OPS_SchedulingOptions-JSON: alleen de goed getypeerde, bekende projectopties overleven; onzin-mode, string-getallen, onbekende sleutels en een half floatPaths-blok vallen weg');
  assert(canon(hostileProject.schedulingProfile) === canon({
    baseId: 'p6', id: 'p6', name: '',
    overrides: {
      preserveActualDatesInBackwardPass: false, clampNegativeFreeFloat: false,
      p6ZeroDurationUsesPlannedBoundary: false, p6UseTaskPlannedStartFloor: false,
      p6PreserveActualInstants: false,
      p6PreserveZeroDurationConstraintInstants: false,
    },
  }), 'vijandige blob mét XER-bronmarkering ⇒ p6-profiel; ontbrekende/ongeldige A-conventies als afwijking uit');
  const gatedNoSource = JSON.stringify({
    p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true, p6FinishMilestoneBoundaryWindow: true,
    p6PreserveActualInstants: true, p6UseRemainingStartForProgress: true, p6PreserveZeroDurationConstraintInstants: true,
    lagCalendar: 'successor',
  });
  const gatedProject = readIFC(written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${gatedNoSource}'),$)`)).project;
  assert(gatedProject.schedulingProfile === undefined
    && canon(gatedProject.schedulingOptions) === canon({ lagCalendar: 'successor' }),
  'vijandige blob met A15–A20 true zónder bronmarkering ⇒ geen profiel (vroeger inert) en opties zonder die sleutels');

  const hostileCritical = JSON.stringify({ criticalDefinition: { mode: 'longestPath', threshold: 'x', thresholdHours: -4 }, floatPaths: { enabled: false, method: 'FREE_FLOAT', maxPaths: 2 } });
  const partialIfc = written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${hostileCritical}'),$)`);
  assert(canon(readIFC(partialIfc).project.schedulingOptions) === canon({
    criticalDefinition: { mode: 'longestPath', thresholdHours: -4 },
    floatPaths: { enabled: false, method: 'FREE_FLOAT', maxPaths: 2 },
  }), 'geneste blokken: een geldige mode met een ongeldige threshold houdt alleen de geldige velden; een compleet floatPaths-blok blijft heel');

  const hostileLeveling = JSON.stringify({
    leveling: {
      enabled: false, preserveScheduledDates: 'N', levelAllResources: true, extra: 1,
      priority: [{ field: 'priority_type', direction: 'ASC' }, { field: 'x-drop', direction: 'ASC' },
        { field: 'task_code', direction: 'UP' }, 'kaal', { field: 'task_code', direction: 'DESC', x: 1 }],
      resources: [{ resourceId: 'r-a', maxUnitsPerHour: -1 }, { resourceId: '' }, { resourceId: 7 },
        { resourceId: 'r-b', maxUnitsPerHour: 2 }],
    },
  });
  assert(canon(readIFC(written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${hostileLeveling}'),$)`)).project.schedulingOptions) === canon({
    leveling: {
      levelAllResources: true,
      priority: [{ field: 'priority_type', direction: 'ASC' }, { field: 'task_code', direction: 'DESC' }],
      resources: [{ resourceId: 'r-a' }, { resourceId: 'r-b', maxUnitsPerHour: 2 }],
    },
  }), 'vijandig nivelleerblok: string-boolean, onbekende sleutels, ongeldige veldnamen/richtingen, lege/niet-string-ids en negatieve capaciteit vallen weg; de geldige rest blijft');
  const noEnabled = JSON.stringify({ lagCalendar: 'successor', leveling: { levelAllResources: true, priority: [] } });
  assert(canon(readIFC(written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${noEnabled}'),$)`)).project.schedulingOptions) === canon({ lagCalendar: 'successor', leveling: { levelAllResources: true, priority: [] } }),
    'nivelleerblok zonder enabled blijft staan (er is geen aan/uit-veld; eigenaarsbeslissing 1 open)');
  const legacyEnabledOnly = JSON.stringify({ lagCalendar: 'successor', leveling: { enabled: true, extra: 1 } });
  assert(canon(readIFC(written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${legacyEnabledOnly}'),$)`)).project.schedulingOptions) === canon({ lagCalendar: 'successor' }),
    'nivelleerblok met alleen onbekende sleutels (ook een oude enabled) vervalt helemaal; enabled overleeft nooit');

  const emptyIfc = written.replace(pattern, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('{"onzin":true}'),$)`);
  assert(readIFC(emptyIfc).project.schedulingOptions === undefined,
    'een JSON-blob zonder één geldige sleutel levert géén leeg optieobject maar undefined (default-inert, zoals een afwezig pset)');
}

{
  const absentPenaltyIfc = writeIFC(fixture).split('\n')
    .filter(line => !line.includes("IFCPROPERTYSINGLEVALUE('P6NonWorkPenaltyDates'"))
    .join('\n');
  const absentPenalty = readIFC(absentPenaltyIfc);
  assert(absentPenalty.calendar.p6Source === undefined
    && absentPenalty.calendar.p6NonWorkPenaltyDates === undefined
    && absentPenalty.calendar.p6NonWorkPenaltyDatesState === 'ABSENT',
  'P6Source=XER zonder penaltylijst blijft diagnostisch ABSENT en activeert geen halve P6-kalendersemantiek');
}

{
  const rejectedPenaltyIfc = writeIFC(fixture).replace(
    '["2026-12-27"]', '["2026-12-27",7]',
  );
  const rejectedPenalty = readIFC(rejectedPenaltyIfc);
  assert(rejectedPenalty.calendar.p6Source === undefined
    && rejectedPenalty.calendar.p6NonWorkPenaltyDates === undefined
    && rejectedPenalty.calendar.p6NonWorkPenaltyDatesState === 'REJECTED',
  'één corrupte P6-penaltywaarde wijst de volledige lijst diagnostisch af en laat p6Source niet half actief');

  const rejectedInput: ImportResult = {
    ...fixture,
    calendar: {
      ...fixture.calendar,
      p6Source: undefined,
      p6NonWorkPenaltyDates: undefined,
      p6NonWorkPenaltyDatesState: 'REJECTED',
    },
  };
  const rejectedRoundTrip = readIFC(writeIFC(rejectedInput));
  assert(rejectedRoundTrip.calendar.p6Source === undefined
    && rejectedRoundTrip.calendar.p6NonWorkPenaltyDates === undefined
    && rejectedRoundTrip.calendar.p6NonWorkPenaltyDatesState === 'REJECTED',
  'REJECTED penaltydiagnostiek rondt inert afzonderlijk door IFC zonder P6-herkomst te herstellen');
  const solveAxes = (input: ImportResult) => {
    const solved = solveProject({
      tasks: input.tasks, sequences: input.sequences, calendar: input.calendar,
      calendars: input.resourceCalendars ?? [], dataDate: input.project.statusDate,
      progressMode: input.project.progressMode, schedulingOptions: solveOptionsFor(input.project).schedulingOptions,
      projectStartDate: input.project.startDate, projectEndDate: input.project.endDate,
    });
    assert(!solved.error, `solverfout in REJECTED-inertietest: ${solved.error}`);
    return input.tasks.map(task => [task.wbsCode, task.time.earlyStart, task.time.earlyFinish,
      task.time.lateStart, task.time.lateFinish, task.time.totalFloat, task.time.freeFloat]);
  };
  const clean = { ...rejectedRoundTrip, calendar: { ...rejectedRoundTrip.calendar,
    p6NonWorkPenaltyDatesState: undefined } };
  assert(JSON.stringify(solveAxes(rejectedRoundTrip)) === JSON.stringify(solveAxes(clean)),
    'REJECTED penaltydiagnostiek is solver-inert');
}

{
  const diffs: string[] = [];
  collectDiffs('', canon(expectedInput), canon(rt1), diffs);
  assert(diffs.length === 0, `round-trip-afwijkingen (${diffs.length}):\n${diffs.map(d => `        - ${d}`).join('\n')}`);

  assert(rt1.tasks.every(t => (rt1.recordedFields?.[t.id] ?? []).length === ALL_RECORDED_SLOT_KEYS.length),
    '(1b) een door OPS zelf geschreven bestand moet ALLE negen slots (7 rekenslots + 2 invoerslots) als aanwezig melden');
}

{
  const sameFileAgain = readIFC(firstIfc);
  const idsByWbs = (r: ImportResult) => Object.fromEntries(r.tasks.map(task => [task.wbsCode, task.id]));
  assert(JSON.stringify(idsByWbs(rt1)) === JSON.stringify(idsByWbs(sameFileAgain)),
    '(1c) twee parses van hetzelfde IFC-bestand moeten dezelfde taak-id per WBS leveren');
  assert(JSON.stringify(idsByWbs(rt1)) === JSON.stringify(idsByWbs(rt2)),
    '(1c) openen en opnieuw opslaan mag taak-id\'s voor externe bronverversing niet veranderen');
  assert(rt1.project.id === sameFileAgain.project.id,
    '(1c) twee parses van hetzelfde IFC-bestand moeten hetzelfde project-id leveren');
  assert(rt1.project.id === rt2.project.id,
    '(1c) openen en opnieuw opslaan mag het project-id voor externe bronverversing niet veranderen');
}

{
  const diffs: string[] = [];
  collectDiffs('', canon(rt1), canon(rt2), diffs);
  assert(diffs.length === 0, `idempotentie-afwijkingen (${diffs.length}):\n${diffs.map(d => `        - ${d}`).join('\n')}`);
}

{
  const enc = new TextEncoder();
  for (const [label, text, want] of [['eerste', firstIfc, rt1], ['tweede', writeIFC(rt1), rt2]] as const) {
    const viaBytes = await readIfcBytesDetailed(enc.encode(text));
    const diffs: string[] = [];
    collectDiffs('', canon(want), canon(viaBytes.result), diffs);
    assert(diffs.length === 0, `(2b) bytes-route ≠ readIFC na de ${label} round-trip (${diffs.length}):\n${diffs.slice(0, 20).map(d => `        - ${d}`).join('\n')}`);
    assert(viaBytes.fallback === undefined, `(2b) bytes-route valt niet terug na de ${label} round-trip (${JSON.stringify(viaBytes.fallback)})`);
    const source = viaBytes.result.ifcSource;
    assert(source !== undefined && !source.foreign && source.foreignObjectCount === 0 && source.foreignMembers.length === 0,
      `(2b) de bron na de ${label} round-trip heeft geen vreemd deel`);
  }
}

{
  const tByWbs = (r: ImportResult, wbs: string) => r.tasks.find(t => t.wbsCode === wbs)!;
  const rMem = rt1.resources.find(r => r.name === 'Timmerman Jan')!;
  const tmOut = tByWbs(rt1, '1.1');
  const txOut = tByWbs(rt1, '1.2');

  assert(tmOut.time.interferingFloat === undefined && def(TM.time.interferingFloat), '(a) time.interferingFloat — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.isNearCritical === undefined && def(TM.time.isNearCritical), '(a) time.isNearCritical — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.floatPath === undefined && def(TM.time.floatPath), '(a) time.floatPath — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.durationUnit === 'hours' && tmOut.time.durationMinutes === 480,
    '(b) time.durationUnit/durationMinutes blijven native uren met exacte minuten');
  assert(tmOut.time.remainingMinutes === 0, '(b) time.remainingMinutes blijft exact nul in uur-modus');
  assert(rMem.availability === undefined && def(RMember.availability), '(b) resource.availability (deprecated) niet geschreven');
  void txOut;
}

{
  assert(rt1.project.companyId === 'c-fixture', 'project.companyId round-trip');
  assert(rt1.project.companyName === 'Fixture Bouw BV', 'project.companyName round-trip');
  const rMem = rt1.resources.find(r => r.name === 'Timmerman Jan')!;
  assert(rMem.libraryOrigin?.companyId === 'c-fixture'
    && rMem.libraryOrigin?.libraryItemId === 'lib-res1'
    && rMem.libraryOrigin?.poolVersion === 4, 'resource.libraryOrigin round-trip');
  const rtProjCal = rt1.calendar;
  assert(rtProjCal.libraryOrigin?.companyId === 'c-fixture'
    && rtProjCal.libraryOrigin?.libraryItemId === 'lib-projcal'
    && rtProjCal.libraryOrigin?.poolVersion === 4, 'projectkalender.libraryOrigin round-trip');
  const rtLibCal = (rt1.resourceCalendars ?? []).find(c => c.name === 'Sublokatie kalender')!;
  assert(rtLibCal.libraryOrigin?.companyId === 'c-fixture'
    && rtLibCal.libraryOrigin?.libraryItemId === 'lib-libcal'
    && rtLibCal.libraryOrigin?.poolVersion === 4, 'bibliotheekkalender.libraryOrigin round-trip');
}

{
  const emptyEnd: ImportResult = { ...fixture, project: { ...fixture.project, endDate: '' } };
  const rtEmpty = readIFC(writeIFC(emptyEnd));
  assert(rtEmpty.project.endDate === '', `lege endDate moet leeg terugkomen — kreeg ${JSON.stringify(rtEmpty.project.endDate)}`);
  assert(rtEmpty.project.startDate === '2026-06-15', `gevulde startDate naast een lege endDate — kreeg ${JSON.stringify(rtEmpty.project.startDate)}`);

  const legacy = writeIFC(fixture).split('\n')
    .filter(l => !/IFCPROPERTYSINGLEVALUE\('Project(Start|End)Date'/.test(l)).join('\n');
  const rtLegacy = readIFC(legacy);
  assert(rtLegacy.project.startDate === '2026-07-06', `zonder pset-veld terugvallen op IFCWORKPLAN.StartTime — kreeg ${JSON.stringify(rtLegacy.project.startDate)}`);
  assert(rtLegacy.project.endDate === '2026-07-24', `zonder pset-veld terugvallen op IFCWORKPLAN.FinishTime — kreeg ${JSON.stringify(rtLegacy.project.endDate)}`);

  const ifc = writeIFC(fixture);
  const workPlan = parseStep(ifc).find(entity => entity.type === 'IFCWORKPLAN')!;
  const derivedSpan = (args: typeof workPlan.args) =>
    args[11]?.k === 'str' && args[11].raw.startsWith("'2026-07-06T")
    && args[12]?.k === 'str' && args[12].raw.startsWith("'2026-07-24T");
  assert(derivedSpan(workPlan.args),
    'IFCWORKPLAN.StartTime/FinishTime moeten de AFGELEIDE taak-span houden (2026-07-06 … 2026-07-24)');
  const creation = workPlan.args[6];
  if (creation.k !== 'str') throw new Error('IFCWORKPLAN.CreationDate moet een datumstring zijn');
  for (const date of ['2026-06-15', '2026-09-30']) {
    const wpLine = ifc.split('\n').find(line => line.includes('IFCWORKPLAN('))!;
    const collisionLine = wpLine.replace(creation.raw, "'" + date + "T12:00:00'");
    const collision = parseStep(ifc.replace(wpLine, collisionLine)).find(entity => entity.type === 'IFCWORKPLAN')!;
    assert(collision.args[6].k === 'str' && collision.args[6].raw === "'" + date + "T12:00:00'",
      'testvoorwaarde: CreationDate valt op de contractuele datum ' + date);
    assert(derivedSpan(collision.args), 'CreationDate ' + date + ' verandert het oordeel over de taak-span niet');
  }
}

{
  const ifc = writeIFC(fixture);

  const entityGuids = [...ifc.matchAll(/^#\d+=IFC[A-Z]+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  const dupes = entityGuids.filter((g, i) => entityGuids.indexOf(g) !== i);
  assert(entityGuids.length > 20, `verwachtte een flink aantal entity-GlobalIds — kreeg ${entityGuids.length}`);
  assert(dupes.length === 0, `entity-GlobalIds moeten uniek zijn — dubbel: ${[...new Set(dupes)].join(', ')}`);

  assert(ifc.includes("'TaskGuids'"), 'writeBaselineMeta moet een TaskGuids-map schrijven zolang er baselines zijn');

  const baseRt = readIFC(ifc);
  const bt0 = baseRt.baselines![0].tasks[0];
  assert(baseRt.tasks.some(t => t.id === bt0.taskId),
    'basisgeval: de baseline-taak moet normaal op een bestaande taak worden geremapt');

  const other = baseRt.tasks.find(t => t.id !== bt0.taskId)!;
  const otherLine = ifc.split('\n').find(l => l.includes('=IFCTASK(') && l.includes(`'${other.name}'`))!;
  const otherGuid = /=IFCTASK\('([0-9A-Za-z_$]{22})'/.exec(otherLine)![1];
  const mapLine = ifc.split('\n').find(l => l.includes("'TaskGuids'"))!;
  const origGuid = /IFCTEXT\('.*?:.*?([0-9A-Za-z_$]{22})/.exec(mapLine)?.[1];
  assert(!!origGuid, 'kon het eerste GlobalId in de TaskGuids-map niet uitlezen');
  const tampered = ifc.replace(mapLine, mapLine.replace(origGuid!, otherGuid));
  const rtTampered = readIFC(tampered);
  const otherInTampered = rtTampered.tasks.find(t => t.name === other.name)!;
  assert(rtTampered.baselines![0].tasks.some(bt => bt.taskId === otherInTampered.id),
    'de reader moet de expliciete TaskGuids-map volgen, niet de hash herberekenen (B8-ontkoppeling)');

  const legacy = ifc.split('\n').filter(l => !l.includes("'TaskGuids'")).join('\n');
  const rtLegacyGuids = readIFC(legacy);
  assert(rtLegacyGuids.tasks.some(t => t.id === rtLegacyGuids.baselines![0].tasks[0].taskId),
    'zonder TaskGuids-map (oud bestand) moet de remap terugvallen op het herberekenen van de hash');
}

{
  const TT_LEEG = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Extern A',$,$,'1.1',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    "#3=IFCTASK('g3',$,'Zonder tijd',$,$,'1.2',$,$,$,.F.,$,$,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtLeeg = readIFC(TT_LEEG);
  assert(rtLeeg.tasks.length === 2, `9r fixture moet precies twee taken opleveren — kreeg ${rtLeeg.tasks.length}`);
  const leegId = rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.id;
  assert(JSON.stringify(rtLeeg.recordedFields?.[leegId]) === JSON.stringify(['scheduleStart', 'scheduleFinish']),
    `9r geen rekenslot, wel de twee invoerslots aanwezig gemeld — kreeg ${JSON.stringify(rtLeeg.recordedFields?.[leegId])}`);
  assert(rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.time.scheduleStart === '2026-03-02',
    `9r scheduleStart moet gewoon gelezen worden — kreeg ${rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.time.scheduleStart}`);
  const zonderTijdId = rtLeeg.tasks.find(t => t.wbsCode === '1.2')!.id;
  assert(JSON.stringify(rtLeeg.recordedFields?.[zonderTijdId]) === JSON.stringify([]),
    `9r taak zonder IfcTaskTime moet een lege lijst geven (niet ontbrekend, en niet de twee invoerslots) — kreeg ${JSON.stringify(rtLeeg.recordedFields?.[zonderTijdId])}`);

  const TT_VOL = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06','2026-03-02','2026-03-06','2026-03-04','2026-03-10',$,'P2D',.T.,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Extern A',$,$,'1.1',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtVol = readIFC(TT_VOL);
  assert(rtVol.tasks.length === 1, `9r VOL-fixture moet precies één taak opleveren — kreeg ${rtVol.tasks.length}`);
  const wantVol = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'isCritical', 'scheduleStart', 'scheduleFinish'];
  assert(JSON.stringify(rtVol.recordedFields?.[rtVol.tasks[0].id]) === JSON.stringify(wantVol),
    `9r gevulde reken- én invoerslots wél gemeld — kreeg ${JSON.stringify(rtVol.recordedFields?.[rtVol.tasks[0].id])}`);

  const TT_HALF_SCHEDULE = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,$,'2026-03-06',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Half schedule',$,$,'1.3',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtHalf = readIFC(TT_HALF_SCHEDULE);
  assert(rtHalf.tasks.length === 1, `9r HALF-fixture moet precies één taak opleveren — kreeg ${rtHalf.tasks.length}`);
  const halfId = rtHalf.tasks[0].id;
  assert(JSON.stringify(rtHalf.recordedFields?.[halfId]) === JSON.stringify(['scheduleFinish']),
    `9r $-ScheduleStart telt niet mee als aanwezig, ScheduleFinish wel — kreeg ${JSON.stringify(rtHalf.recordedFields?.[halfId])}`);
}

{
  const ifc = writeIFC(fixture);
  const lines = ifc.split('\n');
  const ids = lines.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const newRecId = Math.max(...ids) + 1;

  const kerstIdx = lines.findIndex(l => l.includes("IFCWORKTIME('Kerst',.PREDICTED.,$,$,"));
  assert(kerstIdx >= 0, 'kon de ongepatchte Kerst-feestdagregel niet vinden (verwacht args[3]=$)');
  const patchedLine = lines[kerstIdx].replace(
    "IFCWORKTIME('Kerst',.PREDICTED.,$,$,",
    `IFCWORKTIME('Kerst',.PREDICTED.,$,#${newRecId},`,
  );
  assert(patchedLine !== lines[kerstIdx], 'kon de RecurrencePattern-ref niet inpatchen in de Kerst-regel');
  lines[kerstIdx] = patchedLine;

  const dataEndIdx = lines.lastIndexOf('ENDSEC;');
  assert(dataEndIdx > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden');
  lines.splice(dataEndIdx, 0, `#${newRecId}=IFCRECURRENCEPATTERN(.YEARLY.,$,$,(25),(12),$,$,$);`);

  const rt = readIFC(lines.join('\n'));
  const kerstAsHoliday = rt.calendar.holidays.find(h => h.name === 'Kerst');
  const kerstAsException = (rt.calendar.workingExceptions ?? []).find(e => e.name === 'Kerst');
  assert(!!kerstAsHoliday, 'extern-fragment: "Kerst" met gevulde-maar-ongemarkeerde RecurrencePattern moet als feestdag teruglezen');
  assert(!kerstAsException, 'extern-fragment: "Kerst" mag NIET als werkende uitzondering teruglezen — dat was precies de spec-reviewregressie');
}

{
  const ifc7a = writeIFC(fixture).split("'WorkingExceptionKeysV1'").join("'IgnoredWorkingExceptionKeysV1'");
  const lines7a = ifc7a.split('\n');
  const wexcIdx = lines7a.findIndex(l => l.includes("'WorkingExceptionIds'"));
  assert(wexcIdx >= 0, 'kon de WorkingExceptionIds-property niet vinden (verwacht op libCal, die heeft werkende uitzonderingen)');
  const corruptedLine = lines7a[wexcIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedLine !== lines7a[wexcIdx], 'kon de WorkingExceptionIds-waarde niet corrumperen');
  lines7a[wexcIdx] = corruptedLine;

  let rt7a: ImportResult | undefined;
  let threw: unknown;
  try {
    rt7a = readIFC(lines7a.join('\n'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `corrupte WorkingExceptionIds-JSON mag niet crashen — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  const libCalOut = (rt7a?.resourceCalendars ?? []).find(c => c.name === 'Sublokatie kalender');
  assert(!!libCalOut, 'kon libCal niet terugvinden ná de corrupte-JSON-fallback');
  assert((libCalOut?.workingExceptions ?? []).length === 0,
    `corrupte JSON moet terugvallen op "alles is feestdag" — workingExceptions moet leeg zijn, kreeg ${libCalOut?.workingExceptions?.length ?? 'n.v.t.'}`);
  const holidayNames = (libCalOut?.holidays ?? []).map(h => h.name).sort();
  assert(holidayNames.includes('Overwerkdag') && holidayNames.includes('Verschoven werkdag'),
    `corrupte JSON: de twee werkende uitzonderingen moeten als feestdag teruglezen — kreeg holidays: ${JSON.stringify(holidayNames)}`);
}

{
  const ifc7b = writeIFC(fixture);
  const lines7b = ifc7b.split('\n');
  const ids7b = lines7b.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const newTpId = Math.max(...ids7b) + 1;
  const newRecId = newTpId + 1;

  const nieuwjaarIdx = lines7b.findIndex(l => l.includes("IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,$,"));
  assert(nieuwjaarIdx >= 0, 'kon de ongepatchte Nieuwjaar-feestdagregel niet vinden (verwacht args[3]=$)');
  const patchedLine = lines7b[nieuwjaarIdx].replace(
    "IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,$,",
    `IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,#${newRecId},`,
  );
  assert(patchedLine !== lines7b[nieuwjaarIdx], 'kon de RecurrencePattern-ref niet inpatchen in de Nieuwjaar-regel');
  lines7b[nieuwjaarIdx] = patchedLine;

  const dataEndIdx7b = lines7b.lastIndexOf('ENDSEC;');
  assert(dataEndIdx7b > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden');
  lines7b.splice(dataEndIdx7b, 0,
    `#${newTpId}=IFCTIMEPERIOD('06:00:00','12:00:00');`,
    `#${newRecId}=IFCRECURRENCEPATTERN(.YEARLY.,$,$,(1),(1),$,$,(#${newTpId}));`,
  );

  const rt7b = readIFC(lines7b.join('\n'));
  const nieuwjaarAsHoliday = rt7b.calendar.holidays.find(h => h.name === 'Nieuwjaar');
  const nieuwjaarAsException = (rt7b.calendar.workingExceptions ?? []).find(e => e.name === 'Nieuwjaar');
  assert(!!nieuwjaarAsHoliday,
    'extern-fragment-met-TimePeriods: "Nieuwjaar" moet als feestdag teruglezen, ook met daadwerkelijke banden op de ongemarkeerde recurrence');
  assert(!nieuwjaarAsException,
    'extern-fragment-met-TimePeriods: "Nieuwjaar" mag NIET als werkende uitzondering teruglezen — de OPS-markering ontbreekt, TimePeriods alleen is geen signaal');
}

{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const S = () => useAppStore.getState();
  S().newProject();
  S().addTask({
    name: 'T14b-bron-store',
    time: { scheduleStart: '2026-08-10', scheduleDuration: 3, durationType: 'WORKTIME' } as TaskTime,
  });

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8a) writeIFC mag niet crashen na addTask zonder time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-bron-store');
    assert(out?.time.completion === 0, `(8a) completion moet via de merge-default op 0 uitkomen — kreeg ${out?.time.completion}`);
    assert(!ifcOut.includes('undefined'), `(8a) writeIFC-uitvoer mag nooit de tekst "undefined" bevatten — bewijst dat ALLE gemergede time-velden gevuld zijn, niet alleen completion`);
  }
}

{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { draft, runInMcpTransaction } = await import('@/state/mcpTransaction');
  const S = () => useAppStore.getState();
  S().newProject();
  const tx = runInMcpTransaction(() => {
    draft.addTask({
      name: 'T14b-bron-mcp',
      time: { scheduleStart: '2026-08-11', scheduleDuration: 2, durationType: 'WORKTIME' } as TaskTime,
    });
  });
  assert(tx.ok, `(8b) draft.addTask hoort binnen zijn MCP-transactie te slagen`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8b) writeIFC mag niet crashen na draft.addTask zonder time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-bron-mcp');
    assert(out?.time.completion === 0, `(8b) completion moet via de merge-default op 0 uitkomen — kreeg ${out?.time.completion}`);
    assert(!ifcOut.includes('undefined'), `(8b) writeIFC-uitvoer mag nooit de tekst "undefined" bevatten — bewijst dat ALLE gemergede time-velden gevuld zijn, niet alleen completion`);
  }
}

{
  const { fromExtTaskTime } = await import('@/extensions/extMappers');
  const brokenExtTime = {
    durationType: 'WORKTIME',
    scheduleStart: '2026-08-12',
    scheduleFinish: '2026-08-14',
  } as unknown as Parameters<typeof fromExtTaskTime>[0];

  const mapped = fromExtTaskTime(brokenExtTime);
  assert(mapped.completion === 0, `(8c) fromExtTaskTime zonder completion moet op 0 terugvallen — kreeg ${mapped.completion}`);
  assert(mapped.scheduleDuration === 0, `(8c) fromExtTaskTime zonder scheduleDuration moet op 0 terugvallen — kreeg ${mapped.scheduleDuration}`);
  assert(mapped.isCritical === false, `(8c) fromExtTaskTime zonder isCritical moet op false terugvallen — kreeg ${mapped.isCritical}`);
  assert(mapped.earlyStart === '2026-08-12' && mapped.lateStart === '2026-08-12',
    `(8c) ontbrekende early/lateStart moeten op scheduleStart terugvallen — kreeg earlyStart=${mapped.earlyStart}, lateStart=${mapped.lateStart}`);
  assert(mapped.earlyFinish === '2026-08-14' && mapped.lateFinish === '2026-08-14',
    `(8c) ontbrekende early/lateFinish moeten op scheduleFinish terugvallen — kreeg earlyFinish=${mapped.earlyFinish}, lateFinish=${mapped.lateFinish}`);

  const asTask: Task = {
    id: 't-8c', name: 'T14b-mapper-rand', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: mapped,
  };
  const rt8c = readIFC(writeIFC({ ...fixture, tasks: [...fixture.tasks, asTask] }));
  const out8c = rt8c.tasks.find(t => t.name === 'T14b-mapper-rand');
  assert(out8c?.time.completion === 0, `(8c) de gemapte taak moet ook door writeIFC/readIFC heen completion 0 houden — kreeg ${out8c?.time.completion}`);
}

{
  const brokenTask: Task = {
    id: 't-8d-vangnet', name: 'T14b-vangnet', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-08-15', '2026-08-17', 2), completion: undefined as unknown as number },
  };
  const brokenFixture: ImportResult = { ...fixture, tasks: [...fixture.tasks, brokenTask] };

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(brokenFixture);
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8d) writeIFC mag nooit crashen op een kunstmatig-kapotte time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-vangnet');
    assert(out?.time.completion === 0, `(8d) completion moet via het vangnet op 0 terugkomen — kreeg ${out?.time.completion}`);
  }
}

{
  const { toExtTask } = await import('@/extensions/extMappers');
  const withFields: Task = {
    id: 't-8e', name: '(8e)-met-velden', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: plainTime('2026-08-18', '2026-08-20', 2),
    mspTaskType: 'FIXED_DURATION', effortDriven: true,
    timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 60, workMinutes: 60, kind: 'actual' }] }],
    p6DurationType: 'DT_FixedQty', p6ActivityType: 'TT_LOE', p6ExplicitTargetWindow: true, p6SuspendResume: true,
  };
  const mapped8e = toExtTask(withFields);
  assert(mapped8e.mspTaskType === 'FIXED_DURATION', `(8e) toExtTask moet mspTaskType doorgeven — kreeg ${mapped8e.mspTaskType}`);
  assert(mapped8e.effortDriven === true, `(8e) toExtTask moet effortDriven doorgeven — kreeg ${mapped8e.effortDriven}`);
  assert(
    JSON.stringify(mapped8e.timephasedContours) === JSON.stringify(withFields.timephasedContours),
    `(8e) toExtTask moet timephasedContours doorgeven — kreeg ${JSON.stringify(mapped8e.timephasedContours)}`,
  );
  assert(mapped8e.p6DurationType === 'DT_FixedQty', `(8e) toExtTask moet p6DurationType doorgeven — kreeg ${mapped8e.p6DurationType}`);
  assert(mapped8e.p6ActivityType === 'TT_LOE', `(8e) toExtTask moet p6ActivityType doorgeven — kreeg ${mapped8e.p6ActivityType}`);
  assert(mapped8e.p6ExplicitTargetWindow === true, `(8e) toExtTask moet p6ExplicitTargetWindow doorgeven — kreeg ${mapped8e.p6ExplicitTargetWindow}`);
  assert(mapped8e.p6SuspendResume === true, `(8e) toExtTask moet p6SuspendResume doorgeven — kreeg ${mapped8e.p6SuspendResume}`);

  const withoutFields: Task = {
    id: 't-8e-neg', name: '(8e)-zonder-velden', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: plainTime('2026-08-18', '2026-08-20', 2),
  };
  const mapped8eNeg = toExtTask(withoutFields);
  assert(mapped8eNeg.mspTaskType === undefined, `(8e) zonder mspTaskType blijft toExtTask.mspTaskType undefined — kreeg ${mapped8eNeg.mspTaskType}`);
  assert(mapped8eNeg.effortDriven === undefined, `(8e) zonder effortDriven blijft toExtTask.effortDriven undefined — kreeg ${mapped8eNeg.effortDriven}`);
  assert(mapped8eNeg.timephasedContours === undefined, `(8e) zonder timephasedContours blijft toExtTask.timephasedContours undefined — kreeg ${mapped8eNeg.timephasedContours}`);
  assert(mapped8eNeg.p6DurationType === undefined, `(8e) zonder p6DurationType blijft toExtTask.p6DurationType undefined — kreeg ${mapped8eNeg.p6DurationType}`);
  assert(mapped8eNeg.p6ActivityType === undefined, `(8e) zonder p6ActivityType blijft toExtTask.p6ActivityType undefined — kreeg ${mapped8eNeg.p6ActivityType}`);
  assert(mapped8eNeg.p6ExplicitTargetWindow === undefined, `(8e) zonder p6ExplicitTargetWindow blijft toExtTask.p6ExplicitTargetWindow undefined — kreeg ${mapped8eNeg.p6ExplicitTargetWindow}`);
  assert(mapped8eNeg.p6SuspendResume === undefined, `(8e) zonder p6SuspendResume blijft toExtTask.p6SuspendResume undefined — kreeg ${mapped8eNeg.p6SuspendResume}`);
}

{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-update-store' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, completion: 0.4 } });

  S().updateTask(id, {
    time: { scheduleStart: '2026-09-01', scheduleDuration: 4, durationType: 'WORKTIME' } as TaskTime,
  });

  const expected9a = 0.4 * full.scheduleDuration / 4;
  const afterPartial = S().tasks.find(t => t.id === id)!.time;
  assert(afterPartial.completion === expected9a, `(9a) een partiële time-update mag completion niet wissen (gedane werk blijft) — kreeg ${afterPartial.completion}, verwacht ${expected9a}`);
  assert(afterPartial.scheduleStart === '2026-09-01T07:00', `(9a) de daadwerkelijk opgegeven scheduleStart moet wél doorkomen — kreeg ${afterPartial.scheduleStart}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9a) writeIFC mag niet crashen na een partiële time-update — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-store');
    assert(out?.time.completion === expected9a, `(9a) completion moet ${expected9a} blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
}

{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { draft, runInMcpTransaction } = await import('@/state/mcpTransaction');
  const S = () => useAppStore.getState();
  S().newProject();
  let id = '';
  let expected9b = NaN;
  const tx = runInMcpTransaction(() => {
    id = draft.addTask({ name: 'T14b-update-mcp' });
    const full = S().tasks.find(t => t.id === id)!.time;
    expected9b = 0.4 * full.scheduleDuration / 3;
    draft.updateTaskFields(id, { time: { ...full, completion: 0.4 } });

    draft.updateTaskFields(id, {
      time: { scheduleStart: '2026-09-02', scheduleDuration: 3, durationType: 'WORKTIME', completion: undefined } as unknown as TaskTime,
    });
  });
  assert(tx.ok, `(9b) beide draftupdates horen binnen hun MCP-transactie te slagen`);

  const afterPartial = S().tasks.find(t => t.id === id)!.time;
  assert(afterPartial.completion === expected9b, `(9b) draft.updateTaskFields mag completion niet wissen bij een partiële time-update (gedane werk blijft) — kreeg ${afterPartial.completion}, verwacht ${expected9b}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9b) writeIFC mag niet crashen na een partiële time-update via draft.updateTaskFields — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-mcp');
    assert(out?.time.completion === expected9b, `(9b) completion moet ${expected9b} blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
}

{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-update-ext' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, completion: 0.4 } });

  S().updateTask(id, fromExtTaskUpdates({
    time: { scheduleStart: '2026-09-03' } as unknown as ExtTaskTime,
  }));

  const afterExt = S().tasks.find(t => t.id === id)!.time;
  assert(afterExt.completion === 0.4, `(9c) api.data.updateTask-pad mag completion niet wissen bij een partiële time-update — kreeg ${afterExt.completion}`);
  assert(afterExt.scheduleStart === '2026-09-03T07:00', `(9c) de daadwerkelijk opgegeven scheduleStart moet wél doorkomen — kreeg ${afterExt.scheduleStart}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9c) writeIFC mag niet crashen ná het volledige api.data.updateTask-pad — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-ext');
    assert(out?.time.completion === 0.4, `(9c) completion moet 0.4 blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
}

{
  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const patch = fromExtTaskUpdates({ time: { scheduleStart: '2026-09-04' } as unknown as ExtTaskTime });
  assert(patch.time?.scheduleStart === '2026-09-04', `(9d) fromExtTaskUpdates moet de opgegeven scheduleStart doorgeven — kreeg ${patch.time?.scheduleStart}`);
  assert(patch.time?.completion === undefined, `(9d) fromExtTaskUpdates mag GEEN completion fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.completion}`);
  assert(patch.time?.isCritical === undefined, `(9d) fromExtTaskUpdates mag GEEN isCritical fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.isCritical}`);
  assert(patch.time?.freeFloat === undefined, `(9d) fromExtTaskUpdates mag GEEN freeFloat fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.freeFloat}`);
}

{
  const { mergeTaskTime, createDefaultTaskTime } = await import('@/utils/taskDefaults');
  const base: TaskTime = {
    ...createDefaultTaskTime('2026-08-01', 5),
    durationUnit: 'hours',
    completion: 0.4,
    durationMinutes: 240,
    interferingFloat: 1.5,
    isNearCritical: true,
    floatPath: 2,
    actualStart: '2026-08-01',
    actualFinish: '2026-08-03',
    actualDuration: 2,
    remainingTime: 1,
    remainingMinutes: 60,
  };

  const notMentioned = mergeTaskTime(base, { scheduleStart: '2026-08-10' });
  assert(notMentioned.durationMinutes === 240, `(10a) ontbrekende sleutel moet durationMinutes behouden — kreeg ${notMentioned.durationMinutes}`);
  assert(notMentioned.interferingFloat === 1.5, `(10a) ontbrekende sleutel moet interferingFloat behouden — kreeg ${notMentioned.interferingFloat}`);
  assert(notMentioned.isNearCritical === true, `(10a) ontbrekende sleutel moet isNearCritical behouden — kreeg ${notMentioned.isNearCritical}`);
  assert(notMentioned.floatPath === 2, `(10a) ontbrekende sleutel moet floatPath behouden — kreeg ${notMentioned.floatPath}`);
  assert(notMentioned.actualStart === '2026-08-01', `(10a) ontbrekende sleutel moet actualStart behouden — kreeg ${notMentioned.actualStart}`);
  assert(notMentioned.actualFinish === '2026-08-03', `(10a) ontbrekende sleutel moet actualFinish behouden — kreeg ${notMentioned.actualFinish}`);
  assert(notMentioned.actualDuration === 2, `(10a) ontbrekende sleutel moet actualDuration behouden — kreeg ${notMentioned.actualDuration}`);
  assert(notMentioned.remainingTime === 1, `(10a) ontbrekende sleutel moet remainingTime behouden — kreeg ${notMentioned.remainingTime}`);
  assert(notMentioned.remainingMinutes === 60, `(10a) ontbrekende sleutel moet remainingMinutes behouden — kreeg ${notMentioned.remainingMinutes}`);

  const explicitlyCleared = mergeTaskTime(base, {
    scheduleStart: '2026-08-10',
    durationUnit: 'days',
    durationMinutes: undefined,
    interferingFloat: undefined,
    isNearCritical: undefined,
    floatPath: undefined,
    actualStart: undefined,
    actualFinish: undefined,
    actualDuration: undefined,
    remainingTime: undefined,
    remainingMinutes: undefined,
  });
  assert(explicitlyCleared.durationMinutes === undefined, `(10a) expliciete undefined-sleutel moet durationMinutes wissen — kreeg ${explicitlyCleared.durationMinutes}`);
  assert(explicitlyCleared.interferingFloat === undefined, `(10a) expliciete undefined-sleutel moet interferingFloat wissen — kreeg ${explicitlyCleared.interferingFloat}`);
  assert(explicitlyCleared.isNearCritical === undefined, `(10a) expliciete undefined-sleutel moet isNearCritical wissen — kreeg ${explicitlyCleared.isNearCritical}`);
  assert(explicitlyCleared.floatPath === undefined, `(10a) expliciete undefined-sleutel moet floatPath wissen — kreeg ${explicitlyCleared.floatPath}`);
  assert(explicitlyCleared.actualStart === undefined, `(10a) expliciete undefined-sleutel moet actualStart wissen — kreeg ${explicitlyCleared.actualStart}`);
  assert(explicitlyCleared.actualFinish === undefined, `(10a) expliciete undefined-sleutel moet actualFinish wissen — kreeg ${explicitlyCleared.actualFinish}`);
  assert(explicitlyCleared.actualDuration === undefined, `(10a) expliciete undefined-sleutel moet actualDuration wissen — kreeg ${explicitlyCleared.actualDuration}`);
  assert(explicitlyCleared.remainingTime === undefined, `(10a) expliciete undefined-sleutel moet remainingTime wissen — kreeg ${explicitlyCleared.remainingTime}`);
  assert(explicitlyCleared.remainingMinutes === undefined, `(10a) expliciete undefined-sleutel moet remainingMinutes wissen — kreeg ${explicitlyCleared.remainingMinutes}`);
  assert(notMentioned.completion === 0.4 && explicitlyCleared.completion === 0.4, '(10a) completion (verplicht veld) mag door dit blok niet geraakt worden');
}

{
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();

  const setFullProgress = (id: string) => {
    const full = S().tasks.find(t => t.id === id)!.time;
    S().updateTask(id, {
      time: {
        ...full,
        durationUnit: 'hours',
        completion: 0.4,
        durationMinutes: 240,
        actualStart: '2026-08-01',
        actualFinish: '2026-08-03',
        remainingTime: 1,
        remainingMinutes: 60,
        resume: '2026-08-02',
        stop: '2026-08-02',
      },
    });
  };
  const assertPreserved = (label: string, id: string) => {
    const t = S().tasks.find(x => x.id === id)!.time;
    assert(t.completion === 0.4, `${label} completion moet 0.4 blijven — kreeg ${t.completion}`);
    assert(t.durationMinutes === 240, `${label} durationMinutes moet 240 blijven — kreeg ${t.durationMinutes}`);
    assert(t.actualStart === '2026-08-01T07:00', `${label} actualStart moet blijven — kreeg ${t.actualStart}`);
    assert(t.actualFinish === '2026-08-03T16:00', `${label} actualFinish moet blijven — kreeg ${t.actualFinish}`);
    assert(t.remainingTime === 1, `${label} remainingTime moet blijven — kreeg ${t.remainingTime}`);
    assert(t.remainingMinutes === 60, `${label} remainingMinutes moet blijven — kreeg ${t.remainingMinutes}`);
    assert(t.resume === '2026-08-02T07:00', `${label} resume moet blijven — kreeg ${t.resume}`);
    assert(t.stop === '2026-08-02T16:00', `${label} stop moet blijven — kreeg ${t.stop}`);
  };

  S().newProject();
  const baseCalendar = S().calendar;
  S().setCalendar({
    ...baseCalendar,
    workTime: {
      byWeekday: {
        1: [{ start: 420, end: 960 }],
        2: [{ start: 420, end: 960 }],
        3: [{ start: 420, end: 960 }],
        4: [{ start: 420, end: 960 }],
        5: [{ start: 420, end: 960 }],
        6: [],
        7: [],
      },
    },
  });
  const id1 = S().addTask({ name: 'T14b-10b-taskslice' });
  setFullProgress(id1);
  S().updateTask(id1, { time: { scheduleStart: '2026-09-10', scheduleDuration: 4, durationType: 'WORKTIME' } as TaskTime });
  assertPreserved('(10b/taskSlice)', id1);

  const { draft, runInMcpTransaction } = await import('@/state/mcpTransaction');
  let id2 = '';
  const tx = runInMcpTransaction(() => {
    id2 = draft.addTask({ name: 'T14b-10b-mcp' });
    setFullProgress(id2);
    draft.updateTaskFields(id2, { time: { scheduleStart: '2026-09-11', scheduleDuration: 3, durationType: 'WORKTIME' } as TaskTime });
  });
  assert(tx.ok, '(10b/draft.updateTaskFields) hoort binnen zijn MCP-transactie te slagen');
  assertPreserved('(10b/draft.updateTaskFields)', id2);

  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const id3 = S().addTask({ name: 'T14b-10b-ext' });
  setFullProgress(id3);
  S().updateTask(id3, fromExtTaskUpdates({ time: { scheduleStart: '2026-09-12' } as unknown as ExtTaskTime }));
  assertPreserved('(10b/api.data.updateTask)', id3);
}

{
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-10c-clear' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, durationUnit: 'hours', durationMinutes: 240 } });
  assert(S().tasks.find(t => t.id === id)!.time.durationMinutes === 240, '(10c) opzet: durationMinutes moet eerst gezet zijn');

  const current = S().tasks.find(t => t.id === id)!.time;
  const cleared = { ...current, durationUnit: 'days' as const, scheduleDuration: 0, durationMinutes: undefined };
  S().updateTask(id, { time: cleared });

  assert(S().tasks.find(t => t.id === id)!.time.durationMinutes === undefined,
    `(10c) een expliciete undefined-sleutel moet durationMinutes daadwerkelijk wissen — kreeg ${S().tasks.find(t => t.id === id)!.time.durationMinutes}`);
}

{
  const taskDialogPath = join(HERE, '..', '..', 'src', 'components', 'dialogs', 'TaskDialog.tsx');
  const src = readFileSync(taskDialogPath, 'utf8');
  const taskDurationFieldPath = join(HERE, '..', '..', 'src', 'components', 'task-sections', 'TaskDurationField.tsx');
  const taskDurationFieldSource = readFileSync(taskDurationFieldPath, 'utf8');
  const milestoneTransitionPath = join(HERE, '..', '..', 'src', 'engine', 'taskMilestoneTransition.ts');
  const milestoneTransitionSource = readFileSync(milestoneTransitionPath, 'utf8');
  const dialogSavePath = join(HERE, '..', '..', 'src', 'state', 'taskDialogSave.ts');
  const dialogSaveSource = readFileSync(dialogSavePath, 'utf8');
  assert(!src.includes('delete time.durationMinutes') && !dialogSaveSource.includes('delete time.durationMinutes'),
    '(10d) TaskDialog.tsx/taskDialogSave.ts mogen geen `delete time.durationMinutes` meer bevatten (zou de merge-sleutel weer laten verdwijnen)');
  assert(src.includes('saveTaskDialog('),
    '(10d) TaskDialog.tsx moet Opslaan aan de gedeelde saveTaskDialog (state/taskDialogSave.ts) delegeren');
  assert(src.includes('<TaskDurationField'),
    '(10d) TaskDialog.tsx moet duurmutaties aan het gedeelde TaskDurationField delegeren');
  const assignCount = (taskDurationFieldSource.match(/time\.durationMinutes = undefined;/g) ?? []).length;
  assert(assignCount === 1,
    `(10d) TaskDurationField.tsx moet de dagmodus precies 1× met \`time.durationMinutes = undefined;\` wissen — kreeg ${assignCount}`);
  assert(dialogSaveSource.includes('taskMilestoneTransition(editingTask, draft.isMilestone)'),
    '(10d) het dialoog-Opslaan (taskDialogSave.ts) moet de gedeelde mijlpaaltransitie gebruiken');
  assert(/durationMinutes:\s*undefined/.test(milestoneTransitionSource),
    '(10d) de gedeelde mijlpaaltransitie moet durationMinutes met een aanwezige undefined-sleutel wissen');
}

{
  const { writeMSPDI } = await import('@/services/msproject/mspdiWriter');
  const brokenTask: Task = {
    id: 't-10e-mspdi-vangnet', name: 'T14b-mspdi-vangnet', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-09-05', '2026-09-07', 2), completion: undefined as unknown as number },
  };
  const xmlOut = writeMSPDI(
    fixture.project, fixture.calendar, [...fixture.tasks, brokenTask], fixture.sequences,
    fixture.resources, fixture.assignments, fixture.resourceCalendars, fixture.baselines,
    fixture.activeBaselineId ?? null,
  );
  assert(!xmlOut.includes('NaN'), '(10e) writeMSPDI-uitvoer mag nooit de tekst "NaN" bevatten (ongeguarde completion × 100)');
  const afterName = xmlOut.slice(xmlOut.indexOf('T14b-mspdi-vangnet'));
  const m = /<PercentComplete>(-?\d+)<\/PercentComplete>/.exec(afterName);
  assert(!!m && m[1] === '0', `(10e) PercentComplete moet via het vangnet 0 zijn — kreeg ${m?.[1] ?? 'GEEN MATCH'}`);
}

{
  const mkCompl = (id: string, completion: number): Task => ({
    id, name: `M3-${id}`, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-08-15', '2026-08-17', 2), completion },
  });
  const t38 = mkCompl('m3-38pct', 0.38);
  const t9955 = mkCompl('m3-9955pct', 0.955);
  const ifcOut = writeIFC({ ...fixture, tasks: [...fixture.tasks, t38, t9955] });
  const back = readIFC(ifcOut);
  const back38 = back.tasks.find((t) => t.name === 'M3-m3-38pct');
  const back9955 = back.tasks.find((t) => t.name === 'M3-m3-9955pct');
  assert(back38?.time.completion === 0.38, `(11a) M3-precisie: 38% blijft 0,38 (niet 0,4 — de oude 10%-afrondbug), kreeg ${back38?.time.completion}`);
  assert(back9955?.time.completion === 0.955, `(11b) M3-precisie: 95,5% blijft 0,955 (niet 1,0/100% — de VOLTOOID-gedragswisseling), kreeg ${back9955?.time.completion}`);
  assert((back9955?.time.completion ?? 0) < 1, '(11c) M3-precisie: 95,5% mag NIET als 100% (completion===1, VOLTOOID-tak) terugkomen');

  assert(ifcOut.includes('0.38'), 'setup (11d): writer emitteert "0.38" letterlijk (geen trailing nullen)');
  const legacyText = ifcOut.replace('0.38', '0.4');
  const legacyBack = readIFC(legacyText);
  const legacyTask = legacyBack.tasks.find((t) => t.name === 'M3-m3-38pct');
  assert(legacyTask?.time.completion === 0.4, `(11d) M3-backward-compat: een 1-decimaal-bestand (extern/oud, "0.4") leest gewoon 0,4 — geen nieuwe leesklem, kreeg ${legacyTask?.time.completion}`);

  const t13 = { ...mkCompl('rule3', 0.4 * 10 / 12), time: { ...mkCompl('rule3', 0).time, scheduleDuration: 12, remainingTime: 8, completion: 0.4 * 10 / 12, actualStart: '2026-08-15' } };
  const out13 = writeIFC({ ...fixture, tasks: [...fixture.tasks, t13, t38] });
  const back13 = readIFC(out13).tasks.find((t) => t.name === 'M3-rule3');
  assert(back13?.time.completion === 0.4 * 10 / 12, `(11e) restduurregel: 4/12 komt exact terug, kreeg ${back13?.time.completion}`);
  assert(back13?.time.remainingTime === 8, `(11e) restduurregel: restduur 8 d komt exact terug, kreeg ${back13?.time.remainingTime}`);
}

{
  const ifc12 = writeIFC(fixture);
  const rt12setup = readIFC(ifc12);
  const tx12setup = rt12setup.tasks.find(t => t.wbsCode === '1.2');
  assert(tx12setup?.splitGaps === undefined, 'setup (12): TX heeft geen splitGaps vóór de patch');

  const lines12 = ifc12.split('\n');
  const ids12 = lines12.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const propId = Math.max(...ids12) + 1;
  const setId = propId + 1;
  const relId = setId + 1;
  const dataEndIdx12 = lines12.lastIndexOf('ENDSEC;');
  assert(dataEndIdx12 > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden (blok 12)');
  const txLine = lines12.find(l => /=IFCTASK\(/.test(l) && l.includes("'Ruwbouw'"));
  assert(!!txLine, 'kon de IFCTASK-regel van TX (Ruwbouw) niet vinden');
  const txId = parseInt(/^#(\d+)=/.exec(txLine!)![1], 10);
  const fakeGaps = JSON.stringify([{ afterMinutes: 999, gapMinutes: 999 }]);
  lines12.splice(dataEndIdx12, 0,
    `#${propId}=IFCPROPERTYSINGLEVALUE('Splits',$,IFCTEXT('${fakeGaps}'),$);`,
    `#${setId}=IFCPROPERTYSET('2z14fakesplitspset0000001',#1,'EXT_FakeSplits',$,(#${propId}));`,
    `#${relId}=IFCRELDEFINESBYPROPERTIES('2z14fakesplitsrel00000001',#1,$,$,(#${txId}),#${setId});`,
  );

  const rt12 = readIFC(lines12.join('\n'));
  const tx12 = rt12.tasks.find(t => t.wbsCode === '1.2');
  assert(tx12?.splitGaps === undefined,
    `(12) extern-fragment: een pset met een NIET-OPS-naam ('EXT_FakeSplits') die toevallig geldige splits-JSON draagt, mag NIET als splitGaps gelezen worden — kreeg ${JSON.stringify(tx12?.splitGaps)}`);
}

{
  const ifc13 = writeIFC(fixture);
  const lines13 = ifc13.split('\n');
  const splitsIdx = lines13.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('Splits',"));
  assert(splitsIdx >= 0, 'kon de Splits-property niet vinden (verwacht op TM, die heeft splitGaps)');
  const corruptedSplitsLine = lines13[splitsIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedSplitsLine !== lines13[splitsIdx], 'kon de Splits-waarde niet corrumperen');
  lines13[splitsIdx] = corruptedSplitsLine;

  let rt13: ImportResult | undefined;
  let threw13: unknown;
  try {
    rt13 = readIFC(lines13.join('\n'));
  } catch (e) {
    threw13 = e;
  }
  assert(!threw13, `corrupte Splits-JSON mag niet crashen — kreeg: ${threw13 instanceof Error ? threw13.message : String(threw13)}`);
  const tm13 = rt13?.tasks.find(t => t.wbsCode === '1.1');
  assert(!!tm13, 'kon TM niet terugvinden ná de corrupte-Splits-fallback');
  assert(tm13?.splitGaps === undefined,
    `corrupte Splits-JSON moet terugvallen op "geen splits" (geen fantoomdata) — kreeg ${JSON.stringify(tm13?.splitGaps)}`);
}

{
  const ifc14 = writeIFC(fixture);
  const lines14 = ifc14.split('\n');
  const windowsIdx = lines14.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('Windows',") && l.includes('workWindowStart'));
  assert(windowsIdx >= 0, 'kon de Windows-property niet vinden (verwacht op t-x, A1 heeft een workWindow)');
  const corruptedWindowsLine = lines14[windowsIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedWindowsLine !== lines14[windowsIdx], 'kon de Windows-waarde niet corrumperen');
  lines14[windowsIdx] = corruptedWindowsLine;

  let rt14: ImportResult | undefined;
  let threw14: unknown;
  try {
    rt14 = readIFC(lines14.join('\n'));
  } catch (e) {
    threw14 = e;
  }
  assert(!threw14, `corrupte Windows-JSON mag niet crashen — kreeg: ${threw14 instanceof Error ? threw14.message : String(threw14)}`);
  const a1Back = rt14?.assignments.find(a => {
    const t = rt14!.tasks.find(tt => tt.id === a.taskId);
    const r = rt14!.resources.find(rr => rr.id === a.resourceId);
    return t?.wbsCode === '1.2' && r?.name === 'Timmerman Jan' && a.unitsPerDay === 2;
  });
  assert(!!a1Back, 'kon A1 (t-x/r-mem, unitsPerDay 2) niet terugvinden ná de corrupte-Windows-fallback');
  assert(a1Back?.workWindowStart === undefined && a1Back?.workWindowFinish === undefined,
    `corrupte Windows-JSON moet terugvallen op "geen venster" (geen fantoomdata) — kreeg start=${a1Back?.workWindowStart} finish=${a1Back?.workWindowFinish}`);
}

{
  const ifc15 = writeIFC(fixture);
  const lines15 = ifc15.split('\n');
  const walksIdx = lines15.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('DurationWalks',"));
  assert(walksIdx >= 0, 'kon de DurationWalks-property niet vinden (verwacht op t-m)');
  const corruptedWalksLine = lines15[walksIdx].replace('"workMinutes":1440', '"workMinutes":"oops"');
  assert(corruptedWalksLine !== lines15[walksIdx], 'kon de workMinutes-waarde niet corrumperen (verwacht letterlijk "workMinutes":1440 in de geschreven JSON)');
  lines15[walksIdx] = corruptedWalksLine;

  let rt15: ImportResult | undefined;
  let threw15: unknown;
  try {
    rt15 = readIFC(lines15.join('\n'));
  } catch (e) {
    threw15 = e;
  }
  assert(!threw15, `semantisch-corrupte DurationWalks-JSON mag niet crashen — kreeg: ${threw15 instanceof Error ? threw15.message : String(threw15)}`);
  const tm15 = rt15?.tasks.find(t => t.name === 'Oplevering');
  assert(!!tm15, 'kon TM (Oplevering) niet terugvinden ná de corrupte-workMinutes-fallback');
  assert(tm15?.timephasedDurationWalks === undefined,
    `semantisch-corrupte workMinutes op ÉÉN item laat de HELE walks-lijst wegvallen (geen gedeeltelijke redding) — kreeg ${JSON.stringify(tm15?.timephasedDurationWalks)}`);
}

{
  const leeg = readIFC(writeIFC({ ...fixture, project: { ...fixture.project, startDate: '' } }));
  assert(leeg.project.startDate === '',
    `(16a) bewust lege ProjectStartDate moet leeg round-trippen — kreeg ${JSON.stringify(leeg.project.startDate)}`);

  const tt = new Array<string>(IFC_TASKTIME_SLOTS.length).fill('$');
  tt[TASKTIME_SLOT.durationType] = '.WORKTIME.';
  tt[TASKTIME_SLOT.scheduleDuration] = "'P5D'";
  tt[TASKTIME_SLOT.scheduleStart] = "'2026-03-02'";
  tt[TASKTIME_SLOT.scheduleFinish] = "'2026-03-06'";
  const tk = new Array<string>(IFC_TASK_SLOTS.length).fill('$');
  tk[TASK_SLOT.globalId] = "'gT'";
  tk[TASK_SLOT.name] = "'A'";
  tk[TASK_SLOT.identification] = "'1.1'";
  tk[TASK_SLOT.isMilestone] = '.F.';
  tk[TASK_SLOT.taskTime] = '#9';
  tk[TASK_SLOT.predefinedType] = '.CONSTRUCTION.';
  const extern = (workplanRegel: string): string => [
    'ISO-10303-21;', 'HEADER;', "FILE_NAME('x.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('gP',$,'Extern',$,$,$,$,$,$);",
    ...(workplanRegel ? [workplanRegel] : []),
    `#9=IFCTASKTIME(${tt.join(',')});`,
    `#2=IFCTASK(${tk.join(',')});`,
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const zonder = readIFC(extern(''));
  assert(zonder.project.startDate === '2026-03-02',
    `(16b) zonder enige projectstart-bron wordt de vroegste taakstart afgeleid — kreeg ${JSON.stringify(zonder.project.startDate)}`);
  const leegSlot = readIFC(extern("#5=IFCWORKPLAN('gW',$,'Plan',$,$,$,$,$,$,$,$,$,$,$,.PLANNED.);"));
  assert(leegSlot.project.startDate === '2026-03-02',
    `(16c) een leeg IFCWORKPLAN-StartTime-slot telt als afwezig (geen "vandaag") — kreeg ${JSON.stringify(leegSlot.project.startDate)}`);
}

{
  const ifc17 = writeIFC(fixture);
  const lines17 = ifc17.split('\n');
  const splitsIdx17 = lines17.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('Splits',"));
  assert(splitsIdx17 >= 0, '(17a) kon de Splits-property niet vinden');
  const hostileGaps = JSON.stringify([{ afterMinutes: 120, gapMinutes: 60, source: 'iets-anders' }]);
  assert(!hostileGaps.includes("'"), '(17a) vooronderstelling: de JSON bevat geen quotes om te escapen');
  const hostileLine = lines17[splitsIdx17].replace(/IFCTEXT\('[^']*'\)/, `IFCTEXT('${hostileGaps}')`);
  assert(hostileLine !== lines17[splitsIdx17], '(17a) kon de Splits-waarde niet patchen');
  lines17[splitsIdx17] = hostileLine;

  const rt17 = readIFC(lines17.join('\n'));
  const tm17 = rt17.tasks.find(t => t.wbsCode === '1.1');
  assert(!!tm17?.splitGaps && tm17.splitGaps.length === 1,
    `(17a) het gat zelf blijft staan ondanks de onbekende source — kreeg ${JSON.stringify(tm17?.splitGaps)}`);
  assert(tm17?.splitGaps?.[0].source === undefined,
    `(17a) een onbekende source-waarde wordt WEGGELATEN (gesloten verzameling) — kreeg ${JSON.stringify(tm17?.splitGaps?.[0].source)}`);
  assert(tm17?.splitGaps?.[0].afterMinutes === 120 && tm17?.splitGaps?.[0].gapMinutes === 60,
    `(17a) afterMinutes/gapMinutes blijven ongemoeid — kreeg ${JSON.stringify(tm17?.splitGaps?.[0])}`);

  const rt17c = readIFC(writeIFC(fixture));
  const tm17c = rt17c.tasks.find(t => t.wbsCode === '1.1');
  assert(tm17c?.splitGaps?.length === 3,
    `(17c) alle drie de gaten komen terug — kreeg ${JSON.stringify(tm17c?.splitGaps)}`);
  assert(tm17c?.splitGaps?.[2].source === 'user',
    `(17c) source 'user' round-trippt — kreeg ${JSON.stringify(tm17c?.splitGaps?.[2])}`);
  assert(tm17c?.splitGaps?.[2].afterMinutes === 1440 && tm17c?.splitGaps?.[2].gapMinutes === 480,
    `(17c) afterMinutes/gapMinutes van het gebruikersgat blijven ongemoeid — kreeg ${JSON.stringify(tm17c?.splitGaps?.[2])}`);

  const { clearLevelingGaps } = await import('@/utils/taskDefaults');
  const gapImport: TaskSplitGap = { afterMinutes: 120, gapMinutes: 60 };
  const gapLeveling: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'leveling' };

  const taskBoth: Task = { ...TX, splitGaps: [gapImport, gapLeveling] };
  const clearedBoth = clearLevelingGaps(taskBoth);
  assert(clearedBoth === true, '(17b) clearLevelingGaps geeft true terug als er iets gewist is');
  assert(JSON.stringify(taskBoth.splitGaps) === JSON.stringify([gapImport]),
    `(17b) alleen het leveling-gat is gewist, het importsplit blijft — kreeg ${JSON.stringify(taskBoth.splitGaps)}`);

  const taskOnlyLeveling: Task = { ...TX, splitGaps: [gapLeveling] };
  const clearedOnlyLeveling = clearLevelingGaps(taskOnlyLeveling);
  assert(clearedOnlyLeveling === true, '(17b) clearLevelingGaps geeft true terug (enige gat was leveling)');
  assert(taskOnlyLeveling.splitGaps === undefined,
    `(17b) leeg resultaat ⇒ splitGaps wordt undefined, niet een lege array (golden rule) — kreeg ${JSON.stringify(taskOnlyLeveling.splitGaps)}`);

  const taskOnlyImport: Task = { ...TX, splitGaps: [gapImport] };
  const clearedOnlyImport = clearLevelingGaps(taskOnlyImport);
  assert(clearedOnlyImport === false, '(17b) clearLevelingGaps geeft false terug als er niets te wissen viel');
  assert(JSON.stringify(taskOnlyImport.splitGaps) === JSON.stringify([gapImport]),
    '(17b) importsplit blijft ongemoeid bij een no-op-aanroep');

  const taskNoGaps: Task = { ...TX, splitGaps: undefined };
  assert(clearLevelingGaps(taskNoGaps) === false, '(17b) geen splitGaps ⇒ no-op, false');
}

{
  const mkFrac = (id: string, dur: number, extra: Partial<TaskTime> = {}): Task => ({
    id, name: `FR-${id}`, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-09-01', '2026-09-03', dur), ...extra },
  });
  const frTasks: Task[] = [
    mkFrac('2_5', 2.5),
    mkFrac('0_5', 0.5),
    mkFrac('1_25', 1.25),
    mkFrac('act', 2, { actualStart: '2026-09-01', actualDuration: 1.5, completion: 0.25 }),
    mkFrac('ruis', 0.1 + 0.2),
    mkFrac('ruis3a', 2.9999999999999996),
    mkFrac('ruis3b', 3.0000000000000004),
    mkFrac('klein', 1e-7),
    mkFrac('spel', 2, { totalFloat: -1.5, freeFloat: 0.25 }),
  ];
  const frSeqs: Sequence[] = [
    { id: 'fr-s1', predecessorId: '2_5', successorId: '0_5', type: 'FINISH_START', lagDays: 0.5 },
    { id: 'fr-s2', predecessorId: '0_5', successorId: '1_25', type: 'FINISH_START', lagDays: -1.5 },
  ];
  const input18: ImportResult = {
    ...fixture, tasks: [...fixture.tasks, ...frTasks], sequences: [...fixture.sequences, ...frSeqs],
  };
  const ifc18 = writeIFC(input18);
  const rt18 = readIFC(ifc18);
  const frTime = (r: ImportResult, id: string): TaskTime | undefined => r.tasks.find(t => t.name === `FR-${id}`)?.time;
  const b = (id: string) => frTime(rt18, id);

  for (const lit of ["'PT20H0M0S'", "'PT4H0M0S'", "'PT10H0M0S'", "'PT12H0M0S'", "IFCDURATION('-PT12H0M0S')"]) {
    assert(ifc18.includes(lit), `(18a) writer emitteert ${lit} voor een breuk in dagen`);
  }
  for (const lit of ["'P0Y0M2.5D'", "'P0Y0M0.5D'", "'P0Y0M1.25D'", "'P0Y0M1.5D'", "'P0.5D'", "'-P1.5D'"]) {
    assert(!ifc18.includes(lit), `(18a) writer schrijft geen gebroken dag-duur ${lit} meer`);
  }

  assert(b('2_5')?.scheduleDuration === 2.5, `(18b) 2,5 dag round-trippt als 2,5 (was 5) — kreeg ${b('2_5')?.scheduleDuration}`);
  assert(b('0_5')?.scheduleDuration === 0.5, `(18b) 0,5 dag round-trippt als 0,5 (was 5) — kreeg ${b('0_5')?.scheduleDuration}`);
  assert(b('1_25')?.scheduleDuration === 1.25, `(18b) 1,25 dag round-trippt als 1,25 (was 25) — kreeg ${b('1_25')?.scheduleDuration}`);

  assert(b('act')?.actualDuration === 1.5, `(18c) actualDuration 1,5 round-trippt (was 5) — kreeg ${b('act')?.actualDuration}`);

  assert(b('ruis')?.scheduleDuration === 0.3, `(18d) 0.1+0.2 komt terug als 0,3 (was 3·10¹⁶) — kreeg ${b('ruis')?.scheduleDuration}`);
  assert(b('ruis3a')?.scheduleDuration === 3, `(18d) 2.9999999999999996 komt terug als 3 — kreeg ${b('ruis3a')?.scheduleDuration}`);
  assert(b('ruis3b')?.scheduleDuration === 3, `(18d) 3.0000000000000004 komt terug als 3 (was 4) — kreeg ${b('ruis3b')?.scheduleDuration}`);
  assert(b('klein')?.scheduleDuration === 0, `(18d) 1e-7 dag komt terug als 0 (was −7) — kreeg ${b('klein')?.scheduleDuration}`);
  const dayLits = ifc18.match(/'-?P[\dYMeE.+-]*D'/g) ?? [];
  const bad = dayLits.filter(l => !/^'-?P(?:0Y0M)?-?\d+(?:\.\d{1,6})?D'$/.test(l));
  assert(dayLits.length > 0 && bad.length === 0,
    `(18d) elke dag-duur in het bestand is een kaal decimaal (≤ 6 decimalen, geen exponent) — afwijkend: ${JSON.stringify(bad)}`);

  assert(b('spel')?.totalFloat === -1.5, `(18e) totalFloat −1,5 round-trippt — kreeg ${b('spel')?.totalFloat}`);
  assert(b('spel')?.freeFloat === 0.25, `(18e) freeFloat 0,25 round-trippt — kreeg ${b('spel')?.freeFloat}`);

  const idName = new Map(rt18.tasks.map(t => [t.id, t.name]));
  const lagOf = (p: string, s: string) => rt18.sequences.find(q => idName.get(q.predecessorId) === `FR-${p}` && idName.get(q.successorId) === `FR-${s}`)?.lagDays;
  assert(lagOf('2_5', '0_5') === 0.5, `(18f) lag 0,5 dag round-trippt (was 5) — kreeg ${lagOf('2_5', '0_5')}`);
  assert(lagOf('0_5', '1_25') === -1.5, `(18f) lead −1,5 dag round-trippt via '-P1.5D' (was −5) — kreeg ${lagOf('0_5', '1_25')}`);

  const rt18b = readIFC(writeIFC(rt18));
  const keys = ['scheduleDuration', 'actualDuration', 'remainingTime', 'totalFloat', 'freeFloat'] as const;
  for (const t of frTasks) {
    const id = t.id;
    const one = keys.map(k => frTime(rt18, id)?.[k]);
    const two = keys.map(k => frTime(rt18b, id)?.[k]);
    assert(JSON.stringify(one) === JSON.stringify(two), `(18g) ${id}: tweede round-trip identiek — ${JSON.stringify(one)} vs ${JSON.stringify(two)}`);
  }

  const ifcWhole = writeIFC(fixture);
  const wholeLits = ifcWhole.match(/'-?P[\dYMeE.+-]*D'/g) ?? [];
  assert(wholeLits.length > 0 && wholeLits.every(l => /^'-?P(?:0Y0M)?\d+D'$/.test(l)),
    `(18h) hele dagen: alleen gehele dag-literals — kreeg ${JSON.stringify([...new Set(wholeLits)])}`);
  assert(ifcWhole.includes("'P0Y0M5D'") && ifcWhole.includes("'P0Y0M3D'") && ifcWhole.includes("IFCDURATION('P2D')"),
    '(18h) hele dagen: P0Y0M5D / P0Y0M3D / P2D-lag ongewijzigd');

  const cases: [string, number, string][] = [
    ["'PT12.5H'", 1.5625, 'decimale uren exact: 12,5/8 werkdagen'],
    ["'-PT12.5H'", -1.5625, 'negatieve decimale uren met voorloopteken (was −1)'],
    ["'-P2.5D'", -2.5, 'lead met ISO-voorloopteken (was −5)'],
    ["'P0Y0M-2.5D'", -2.5, 'legacy-notatie met het teken bij het getal (was −5)'],
    ["'P0Y0M1e-7D'", 1e-7, 'exponent uit een bestand van vóór de writer-afronding (was −7)'],
    ["'P0Y0M3D'", 3, 'hele dag (ongewijzigd)'],
    ["'-P2D'", -2, 'hele lead (ongewijzigd)'],
    ["'PT16H'", 2, 'hele uren (ongewijzigd)'],
  ];
  const lines18: string[] = [];
  cases.forEach(([lit], i) => {
    const tt = new Array<string>(IFC_TASKTIME_SLOTS.length).fill('$');
    tt[TASKTIME_SLOT.durationType] = '.WORKTIME.';
    tt[TASKTIME_SLOT.scheduleDuration] = "'P1D'";
    tt[TASKTIME_SLOT.scheduleStart] = "'2026-03-02'";
    tt[TASKTIME_SLOT.scheduleFinish] = "'2026-03-02'";
    tt[TASKTIME_SLOT.totalFloat] = lit;
    const tk = new Array<string>(IFC_TASK_SLOTS.length).fill('$');
    tk[TASK_SLOT.globalId] = `'gT${i}'`;
    tk[TASK_SLOT.name] = `'P${i}'`;
    tk[TASK_SLOT.identification] = `'${i + 1}'`;
    tk[TASK_SLOT.isMilestone] = '.F.';
    tk[TASK_SLOT.taskTime] = `#${100 + i}`;
    tk[TASK_SLOT.predefinedType] = '.CONSTRUCTION.';
    lines18.push(`#${100 + i}=IFCTASKTIME(${tt.join(',')});`, `#${200 + i}=IFCTASK(${tk.join(',')});`);
  });
  const extern18 = readIFC([
    'ISO-10303-21;', 'HEADER;', "FILE_NAME('x.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;', "#1=IFCPROJECT('gP',$,'Extern',$,$,$,$,$,$);", ...lines18, 'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n'));
  assert(extern18.calendar.hoursPerDay === 8, `(18i) opzet: standaardkalender van 8 u/dag — kreeg ${extern18.calendar.hoursPerDay}`);
  cases.forEach(([lit, want, why], i) => {
    const got = extern18.tasks.find(t => t.name === `P${i}`)?.time.totalFloat;
    assert(got === want, `(18i) ${lit} → ${want}: ${why} — kreeg ${got}`);
  });
}

for (const schema of IFC_SCHEMAS) {
  const result = checkIfcSchema(`round-trip-fixture (${schema})`, writeIFC({ ...fixture, project: { ...fixture.project, ifcSchema: schema } }), undefined, schema);
  assert(result.checks > 100, `(19) ${schema}: testvoorwaarde: de schematoets liep (${result.checks} entiteiten getoetst)`);
  for (const failure of result.failures) assert(false, `(19) ${failure}`);
  if (result.failures.length === 0) assert(true, `(19) schemageldig in ${schema}`);
}

{
  const calendarValues = (r: ImportResult) => [r.calendar, ...(r.resourceCalendars ?? [])]
    .map(c => ({ name: c.name, holidays: c.holidays, workingExceptions: c.workingExceptions ?? [] }));
  const renumber = (text: string) => text.replace(/'(?:''|[^'])*'|#\d+/g, token =>
    token.startsWith('#') ? `#${Number(token.slice(1)) + 10000}` : token);
  for (const schema of IFC_SCHEMAS) {
    const input = { ...fixture, project: { ...fixture.project, ifcSchema: schema } };
    const written = writeIFC(input);
    const expected = calendarValues(readIFC(written));
    assert(expected.some(c => c.workingExceptions.length > 0), "112: testvoorwaarde werkende uitzonderingen aanwezig");
    assert(renumber(written) !== written, "112: testvoorwaarde echte STEP-refs vernummerd");
    assert(written.includes("'WorkingExceptionKeysV1'"), '112: writer geeft inhoudssleutels uit');
    assert(JSON.stringify(calendarValues(readIFC(renumber(written)))) === JSON.stringify(expected),
      `112 ${schema}: vernummerde refs behouden feestdagen en werkende uitzonderingen`);
    const legacy = written.split("'WorkingExceptionKeysV1'").join("'IgnoredWorkingExceptionKeysV1'");
    assert(JSON.stringify(calendarValues(readIFC(legacy))) === JSON.stringify(expected),
      `112 ${schema}: legacy-ids blijven leesbaar`);
    const corruptIds = written.replace(/('WorkingExceptionIds',\$,IFCTEXT\()'[^']*'/g, "$1'{kapot'");
    assert(corruptIds !== written, '112: testvoorwaarde legacy-ids gecorrumpeerd');
    assert(JSON.stringify(calendarValues(readIFC(renumber(corruptIds)))) === JSON.stringify(expected),
      `112 ${schema}: V1 heeft voorrang boven onbruikbare legacy-ids`);
    const corruptKeys = written.replace(/('WorkingExceptionKeysV1',\$,IFCTEXT\()'[^']*'/g, "$1'{kapot'");
    assert(corruptKeys !== written, '112: testvoorwaarde V1 gecorrumpeerd');
    const rejected = readIFC(corruptKeys);
    assert([rejected.calendar, ...(rejected.resourceCalendars ?? [])].every(c => !c.workingExceptions?.length),
      `112 ${schema}: corrupte V1 gebruikt niet alsnog mogelijk verouderde ids`);
  }
  for (const bands of [undefined, [], [{ start: 0, end: 1440 }], [{ start: 1320, end: 1740 }]]) {
    const exception = { name: "Nacht 'één' #123", startDate: '2027-06-05', endDate: '2027-06-05', bands };
    const input = { ...fixture, calendar: { ...fixture.calendar, workingExceptions: [exception] } };
    const written = writeIFC(input);
    assert(JSON.stringify(calendarValues(readIFC(renumber(written)))) === JSON.stringify(calendarValues(readIFC(written))),
      `112: Unicode/quotes/reftekst en banden ${JSON.stringify(bands)} blijven behouden`);
  }
}

if (fails === 0) {
  console.log(`OK  ifc-roundtrip: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-roundtrip: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
