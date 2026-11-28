import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { addBusinessDays, formatDate, isoDayOfWeek } from '@/utils/dateUtils';
import { easterSunday } from '@/engine/calendar/holidays';
import type { Holiday, WorkCalendar } from '@/types/calendar';
import type { CustomFieldType } from '@/types/structure';
import { generateId } from '@/utils/id';
import topologies from './example-topologies.json';
import { EXAMPLE_RESOURCES } from './example-resources';
import { SHOWCASES } from './showcases';
import { TERREIN_ONDERAANNEMER, ANCHOR_TASK_NAME, buildGrootSpec } from './showcase-groot';
import type { ProjectSpec, CalSpec, TaskSpec, LinkSpec } from './spec';

const S = () => useAppStore.getState();

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => formatDate(d);
const oneDay = (name: string, d: Date): Holiday => ({ name, startDate: iso(d), endDate: iso(d) });

function nlHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  let kings = new Date(Date.UTC(year, 3, 27));
  if (isoDayOfWeek(kings) === 7) kings = new Date(Date.UTC(year, 3, 26));
  return [
    oneDay("New Year's Day", new Date(Date.UTC(year, 0, 1))),
    oneDay('Good Friday', addDays(easter, -2)),
    { name: 'Easter', startDate: iso(easter), endDate: iso(addDays(easter, 1)) },
    oneDay("King's Day", kings),
    oneDay('Liberation Day', new Date(Date.UTC(year, 4, 5))),
    oneDay('Ascension Day', addDays(easter, 39)),
    { name: 'Whitsun', startDate: iso(addDays(easter, 49)), endDate: iso(addDays(easter, 50)) },
    { name: 'Christmas', startDate: iso(new Date(Date.UTC(year, 11, 25))), endDate: iso(new Date(Date.UTC(year, 11, 26))) },
  ];
}

function bouwvak(year: number): Holiday {
  let d = new Date(Date.UTC(year, 6, 1));
  while (isoDayOfWeek(d) !== 1) d = addDays(d, 1);
  d = addDays(d, 21);
  return { name: 'Construction holiday (northern region)', startDate: iso(d), endDate: iso(addDays(d, 20)) };
}

export function anchorDate(): Date {
  const year = new Date().getFullYear() + 1;
  let d = new Date(Date.UTC(year, 2, 1));
  while (isoDayOfWeek(d) !== 1) d = addDays(d, 1);
  return d;
}

function holidaysForSpan(anchor: Date): Holiday[] {
  const y = anchor.getUTCFullYear();
  return [...nlHolidays(y), bouwvak(y), ...nlHolidays(y + 1), bouwvak(y + 1)];
}

function extraHolidayRange(anchor: Date, h: { name: string; fromDay: number; calendarDays: number }): Holiday {
  const start = addBusinessDays(anchor, h.fromDay + 1);
  return { name: h.name, startDate: iso(start), endDate: iso(addDays(start, h.calendarDays - 1)) };
}

function buildCalendar(anchor: Date, cal?: CalSpec): WorkCalendar {
  const workDays = cal?.workDays ?? [1, 2, 3, 4, 5];
  const extraHolidays = (cal?.extraHolidays ?? []).map(h => extraHolidayRange(anchor, h));
  const holidays = [...holidaysForSpan(anchor), ...extraHolidays];
  return {
    id: 'cal-default',
    name: cal?.name ?? 'Construction calendar NL',
    description: cal?.description ?? 'Standard construction calendar: Mon-Fri 07:00-16:00',
    workDays,
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays,
    ...(cal?.workTime ? { workTime: cal.workTime } : {}),
  };
}

function offset(anchor: Date, n: number): string {
  return formatDate(addBusinessDays(anchor, n + 1));
}

export interface BuildResult {
  ifc: string;
  stats: {
    tasks: number; milestones: number; sequences: number; resources: number;
    assignments: number; codeTypes: number; customFields: number;
    critical: number; leaves: number;
  };
}

export function build(spec: ProjectSpec): BuildResult {
  const anchor = new Date(anchorDate().getTime() + (spec.anchorShiftDays ?? 0) * 86400000);
  const anchorIso = formatDate(anchor);

  S().newProject();
  S().setCalendar(buildCalendar(anchor, spec.calendar));
  S().setProject({
    name: spec.name,
    description: spec.description ?? '',
    startDate: anchorIso,
    author: spec.author ?? 'Project manager',
    company: spec.company ?? 'Construction Company BV',
  });
  if (spec.schedulingOptions) S().setProject({ schedulingOptions: spec.schedulingOptions });

  const codeTypeIds: Record<string, string> = {};
  const codeValueIds: Record<string, string> = {};
  for (const ct of spec.codeTypes ?? []) {
    const tid = S().addActivityCodeType(ct.name);
    codeTypeIds[ct.name] = tid;
    for (const v of ct.values) {
      const vid = S().addActivityCodeValue(tid, { code: v.code, description: v.description, color: v.color });
      codeValueIds[`${ct.name}::${v.code}`] = vid;
    }
  }
  const fieldIds: Record<string, string> = {};
  for (const f of spec.fields ?? []) {
    fieldIds[f.name] = S().addCustomField(f.name, f.type as CustomFieldType);
  }

  const resIds: Record<string, string> = {};
  for (const r of spec.resources ?? []) {
    let calendarId: string | undefined;
    if (r.calendar) {
      const base = buildCalendar(anchor, r.calendar);
      const { id: _id, ...rest } = base;
      void _id;
      calendarId = S().addCalendar({ ...rest, name: r.calendar.name ?? `${r.name} calendar` });
    }
    const steps = r.steps?.map(s => ({ from: offset(anchor, s.fromDay), maxUnits: s.maxUnits }));
    resIds[r.name] = S().addResource({
      name: r.name,
      type: r.type ?? 'LABOR',
      description: r.description ?? '',
      maxUnits: r.maxUnits ?? 1,
      ...(r.costPerHour !== undefined ? { costPerHour: r.costPerHour } : {}),
      ...(r.unitOfMeasure ? { unitOfMeasure: r.unitOfMeasure } : {}),
      ...(calendarId ? { calendarId } : {}),
      ...(steps && steps.length ? { availabilitySteps: steps } : {}),
      ...(r.parent ? { parentId: resIds[r.parent] } : {}),
    });
  }

  const taskCalendarIds: Record<string, string> = {};
  for (const [key, cal] of Object.entries(spec.calendars ?? {})) {
    const base = buildCalendar(anchor, cal);
    const { id: _id, ...rest } = base;
    void _id;
    taskCalendarIds[key] = S().addCalendar({ ...rest, name: cal.name ?? key });
  }

  const taskIds: Record<string, string> = {};
  let milestones = 0;
  const addSpecTask = (t: TaskSpec): string => {
    if (t.milestone) milestones++;
    const dur = t.milestone ? 0 : (t.dur ?? 5);
    const time = createDefaultTaskTime(anchorIso, dur);
    if (t.durMinutes !== undefined) time.durationMinutes = t.durMinutes;
    const constraint = t.constraint
      ? {
          type: t.constraint.type as any,
          ...(t.constraint.offsetDay !== undefined ? { date: offset(anchor, t.constraint.offsetDay) } : {}),
          ...(t.constraint.hard ? { hard: true } : {}),
        }
      : undefined;
    const constraint2 = t.constraint2
      ? { type: t.constraint2.type as any, ...(t.constraint2.offsetDay !== undefined ? { date: offset(anchor, t.constraint2.offsetDay) } : {}) }
      : undefined;
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? taskIds[t.parent] : null,
      taskType: (t.taskType as any) ?? 'CONSTRUCTION',
      time,
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.mandatory ? { mandatory: true } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(constraint ? { constraint } : {}),
      ...(constraint2 ? { constraint2 } : {}),
      ...(t.hammock ? { isHammock: true } : {}),
      ...(t.deadlineDay !== undefined ? { deadline: offset(anchor, t.deadlineDay) } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.calendarKey ? { calendarId: taskCalendarIds[t.calendarKey] } : {}),
      ...(t.notes && t.notes.length
        ? { notes: t.notes.map(n => ({ id: generateId('note'), text: n.text, done: n.done })) }
        : {}),
    });
    taskIds[t.key] = id;
    if (t.externalLink) S().addExternalLink(id, t.externalLink);
    for (const [typeName, code] of Object.entries(t.codes ?? {})) {
      const tid = codeTypeIds[typeName]; const vid = codeValueIds[`${typeName}::${code}`];
      if (tid && vid) S().setTaskActivityCode(id, tid, vid);
    }
    for (const [fname, value] of Object.entries(t.fields ?? {})) {
      const fid = fieldIds[fname];
      if (fid) S().setTaskCustomField(id, fid, value as any);
    }
    return id;
  };
  for (const t of spec.tasks) addSpecTask(t);

  const addSpecLink = (l: LinkSpec) => {
    const pred = taskIds[l.pred], succ = taskIds[l.succ];
    if (!pred || !succ) throw new Error(`[${spec.slug}] onbekende relatie ${l.pred} → ${l.succ}`);
    S().addSequence({
      predecessorId: pred, successorId: succ, type: (l.type as any) ?? 'FINISH_START',
      lagDays: l.lag ?? 0,
      ...(l.lagUnit ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
  };
  for (const l of spec.links ?? []) addSpecLink(l);

  for (const t of spec.tasks) {
    for (const a of t.assign ?? []) {
      const rid = resIds[a.res];
      if (!rid) throw new Error(`[${spec.slug}] taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(taskIds[t.key], rid, a.units, a.curve as any);
    }
  }

  S().runCPM();

  const baselineIds: Record<string, string> = {};
  for (const b of spec.baselines ?? []) {
    const m = b.mutationBefore;
    if (m) {
      for (const t of m.addTasks ?? []) addSpecTask(t);
      for (const l of m.addLinks ?? []) addSpecLink(l);
      for (const e of m.extendDurations ?? []) {
        const id = taskIds[e.key];
        if (!id) throw new Error(`[${spec.slug}] extendDurations: onbekende taak "${e.key}"`);
        const task = S().tasks.find(x => x.id === id);
        if (!task) throw new Error(`[${spec.slug}] extendDurations: taak "${e.key}" niet in store`);
        S().updateTask(id, { time: { ...task.time, scheduleDuration: e.dur } });
      }
      if (m.addHolidays?.length) {
        const cal = S().calendar;
        S().setCalendar({ ...cal, holidays: [...cal.holidays, ...m.addHolidays.map(h => extraHolidayRange(anchor, h))] });
      }
      S().runCPM();
    }
    baselineIds[b.name] = S().saveBaseline(b.name);
  }
  if (spec.activeBaselineName) {
    const id = baselineIds[spec.activeBaselineName];
    if (!id) throw new Error(`[${spec.slug}] activeBaselineName "${spec.activeBaselineName}" komt niet voor in baselines`);
    S().setActiveBaseline(id);
  }
  for (const name of spec.comparedBaselineNames ?? []) {
    const id = baselineIds[name];
    if (!id) throw new Error(`[${spec.slug}] comparedBaselineNames: "${name}" komt niet voor in baselines`);
    S().toggleComparedBaseline(id);
  }

  let needsRecompute = false;
  if (spec.statusFromPlanFinish !== undefined) {
    const sid = taskIds[spec.statusFromPlanFinish];
    const planned = sid ? S().tasks.find(x => x.id === sid)?.time : undefined;
    if (!planned) throw new Error(`[${spec.slug}] statusFromPlanFinish: onbekende taak "${spec.statusFromPlanFinish}"`);
    S().setStatusDate(planned.earlyFinish || planned.scheduleFinish);
    needsRecompute = true;
  } else if (spec.statusDay !== undefined) {
    S().setStatusDate(offset(anchor, spec.statusDay));
    needsRecompute = true;
  }
  const allTaskSpecs = [...spec.tasks, ...(spec.baselines ?? []).flatMap(b => b.mutationBefore?.addTasks ?? [])];
  for (const t of allTaskSpecs) {
    if (t.completion === undefined && t.actualStartDay === undefined
        && t.actualFinishDay === undefined && !t.actualsFromPlan) continue;
    needsRecompute = true;
    const id = taskIds[t.key];
    if (t.actualsFromPlan) {
      const planned = S().tasks.find(x => x.id === id)?.time;
      if (!planned) throw new Error(`[${spec.slug}] taak "${t.name}": niet in store (actualsFromPlan)`);
      const as = planned.earlyStart || planned.scheduleStart;
      const af = planned.earlyFinish || planned.scheduleFinish;
      if (!S().setActualStart(id, as)) throw new Error(`[${spec.slug}] taak "${t.name}": geplande start ${as} ligt ná de statusdatum`);
      if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
      if (!S().setActualFinish(id, af)) throw new Error(`[${spec.slug}] taak "${t.name}": gepland einde ${af} ligt ná de statusdatum`);
      continue;
    }
    if (t.actualStartDay !== undefined) {
      const ok = S().setActualStart(id, offset(anchor, t.actualStartDay));
      if (!ok) throw new Error(`[${spec.slug}] taak "${t.name}": actualStartDay ligt ná statusDay (geweigerd door setActualStart)`);
    }
    if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
    if (t.actualFinishDay !== undefined) {
      const ok = S().setActualFinish(id, offset(anchor, t.actualFinishDay));
      if (!ok) throw new Error(`[${spec.slug}] taak "${t.name}": actualFinishDay ligt ná statusDay (geweigerd door setActualFinish)`);
    }
  }
  if (needsRecompute) S().runCPM();

  const st = S();
  const leaves = st.tasks.filter(t => t.childIds.length === 0);
  const critical = leaves.filter(t => t.time.isCritical).length;
  const ifcContent = writeIFC(buildWriteIFCInput(st, 'planOnly'));
  return {
    ifc: ifcContent,
    stats: {
      tasks: st.tasks.length, milestones, sequences: st.sequences.length,
      resources: st.resources.length, assignments: st.assignments.length,
      codeTypes: st.activityCodeTypes.length, customFields: st.customFieldDefs.length,
      critical, leaves: leaves.length,
    },
  };
}

interface TopoChild { name: string; duration?: number; taskType?: string; isCritical?: boolean; milestone?: boolean; depType?: string; lag?: number }
interface TopoPhase { name: string; wbs: string; taskType?: string; children: TopoChild[] }
interface TopoDef { id: string; name: string; description?: string; author?: string; company?: string; phases: TopoPhase[] }

const SIX_DAY = new Set([4, 8, 11, 13, 15, 17]);

function startKind(name: string): 'START' | 'FINISH' | undefined {
  if (/\bstart\b|commencement|kick-?off/i.test(name)) return 'START';
  if (/handover|topping out|weathertight|complete|completion|finish|ready\b|delivered/i.test(name)) return 'FINISH';
  return undefined;
}
const isMandatoryMs = (name: string) => /inspection|handover|approval|acceptance|certification|sign-?off/i.test(name);

export function topologyToSpec(def: TopoDef, index: number): ProjectSpec {
  const tasks: ProjectSpec['tasks'] = [];
  const links: NonNullable<ProjectSpec['links']> = [];
  const phaseFirst: string[] = [];
  const phaseLastReal: string[] = [];
  const phaseWorkdays: number[] = [];
  const slug: string = (topologies as any).filenames[index];
  const resourceSet = EXAMPLE_RESOURCES[slug];
  const usedAssignments = new Map<string, number>();

  def.phases.forEach((phase, pi) => {
    const pkey = `p${pi}`;
    tasks.push({ name: phase.name, key: pkey, taskType: phase.taskType });
    let prev: string | null = null;
    let prevReal: string | null = null;
    let firstKey: string | null = null;
    let sum = 0;
    phase.children.forEach((child, ci) => {
      const key = `${pkey}_${ci}`;
      const ms = !!child.milestone;
      const dur = ms ? 0 : (child.duration ?? 5);
      sum += dur;
      const assign = ms ? undefined : resourceSet?.assignments[child.name];
      if (assign) usedAssignments.set(child.name, (usedAssignments.get(child.name) ?? 0) + 1);
      tasks.push({
        name: child.name, key, parent: pkey,
        taskType: child.taskType ?? phase.taskType,
        dur: ms ? undefined : dur,
        ...(ms ? { milestone: true } : {}),
        ...(ms && startKind(child.name) ? { milestoneKind: startKind(child.name) } : {}),
        ...(ms && isMandatoryMs(child.name) ? { mandatory: true } : {}),
        ...(assign ? { assign } : {}),
      });
      if (firstKey === null) firstKey = key;
      if (prev) {
        if (child.depType === 'SS') links.push({ pred: prev, succ: key, type: 'START_START', lag: child.lag ?? 0 });
        else links.push({ pred: prev, succ: key, lag: child.lag ?? 0 });
      }
      prev = key;
      if (!ms) prevReal = key;
    });
    phaseFirst.push(firstKey ?? `${pkey}_0`);
    phaseLastReal.push(prevReal ?? firstKey ?? `${pkey}_0`);
    phaseWorkdays.push(sum);
  });

  const n = def.phases.length;
  for (let pi = 1; pi < n; pi++) {
    const predReal = phaseLastReal[pi - 1];
    const predFirst = phaseFirst[pi - 1];
    const succFirst = phaseFirst[pi];
    const predLen = phaseWorkdays[pi - 1];
    const last = pi === n - 1;
    const style = last ? 0 : (pi % 4);
    if (style === 1) {
      links.push({ pred: predFirst, succ: succFirst, type: 'START_START', lag: Math.max(1, Math.round(predLen * 0.5)) });
    } else if (style === 2) {
      links.push({ pred: predFirst, succ: succFirst, type: 'START_START', lagPercent: 40 });
    } else if (style === 3) {
      links.push({ pred: predReal, succ: succFirst, lag: -Math.max(1, Math.round(predLen * 0.2)) });
    } else {
      links.push({ pred: predReal, succ: succFirst, lag: 0 });
    }
    if (pi === Math.floor(n / 2) && !last) {
      links.push({ pred: predReal, succ: phaseLastReal[pi], type: 'FINISH_FINISH', lag: 2 });
    }
  }

  for (const name of Object.keys(resourceSet?.assignments ?? {})) {
    const hits = usedAssignments.get(name) ?? 0;
    if (hits !== 1) throw new Error(`[${slug}] toewijzing "${name}" raakt ${hits} taken (verwacht precies 1)`);
  }

  return {
    slug,
    name: def.name,
    description: def.description,
    author: def.author,
    company: def.company,
    category: 'basic',
    calendar: SIX_DAY.has(index)
      ? { workDays: [1, 2, 3, 4, 5, 6], name: 'Infrastructure calendar Mon-Sat', description: 'Infrastructure/hydraulic works: Mon-Sat' }
      : undefined,
    ...(resourceSet ? { resources: resourceSet.resources } : {}),
    tasks, links,
  };
}

function buildGrootWithExternalSource(): { groot: ProjectSpec; terrain: ProjectSpec; terrainBuild: BuildResult } {
  const terrainBuild = build(TERREIN_ONDERAANNEMER);
  const parsed = readIFC(terrainBuild.ifc);
  const anchorTask = parsed.tasks.find(t => t.name === ANCHOR_TASK_NAME);
  if (!anchorTask) throw new Error(`extern bronbestand: ankertaak "${ANCHOR_TASK_NAME}" niet gevonden`);
  const groot = buildGrootSpec({
    anchorDate: anchorTask.time.earlyFinish || anchorTask.time.scheduleFinish,
    sourceProjectId: parsed.project.id,
    sourceProjectName: parsed.project.name,
    sourceTaskId: anchorTask.id,
    sourceTaskName: anchorTask.name,
  });
  return { groot, terrain: TERREIN_ONDERAANNEMER, terrainBuild };
}

export function allSpecs(): ProjectSpec[] {
  return allSpecsWithSource().specs;
}

export function allBuilds(): { spec: ProjectSpec; res: BuildResult }[] {
  const { specs, terrain, terrainBuild } = allSpecsWithSource();
  return specs.map(spec => ({ spec, res: spec === terrain ? terrainBuild : build(spec) }));
}

function allSpecsWithSource(): { specs: ProjectSpec[]; terrain: ProjectSpec; terrainBuild: BuildResult } {
  const defs: TopoDef[] = (topologies as any).defs;
  const basics = defs.map((d, i) => topologyToSpec(d, i));
  const { groot, terrain, terrainBuild } = buildGrootWithExternalSource();
  return { specs: [...SHOWCASES, groot, terrain, ...basics], terrain, terrainBuild };
}
