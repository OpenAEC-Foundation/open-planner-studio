import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { buildGeneratedCalendar } from '@/utils/projectTemplates';
import { computeGenerateSpan, materializeHolidays } from '@/engine/calendar/generateCalendarHolidays';
import { withCanonicalHolidayEnds } from '@/utils/holidayRange';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ResourceType } from '@/types/resource';

const S = () => useAppStore.getState();

export type TutorialLang = 'nl' | 'en';
export const TUTORIAL_LANGS: readonly TutorialLang[] = ['nl', 'en'];

export const STAGE_IDS = [
  'start-tut-1', 'na-tut-1', 'na-tut-2', 'tussen-tut-3-bouwvak', 'na-tut-3', 'na-tut-4',
  'tussen-tut-5-resources', 'tussen-tut-5-toegewezen', 'tussen-tut-5-werkregel', 'na-tut-5',
  'tussen-tut-6-baseline', 'tussen-tut-6-statusdatum', 'tussen-tut-6-voorbereiding', 'tussen-tut-6-ontgraven',
  'tussen-tut-6-fundering', 'tussen-tut-6-metselwerk', 'na-tut-6', 'na-tut-7',
] as const;
export type StageId = typeof STAGE_IDS[number];

export const PROJECT_START = '2027-06-07';
export const BOUWVAK_REGION = 'midden' as const;

type Names = Record<TutorialLang, string>;
const n = (nl: string, en: string): Names => ({ nl, en });

const PROJECT_NAME = n('Aanbouw woning', 'House extension');
const PROJECT_DESCRIPTION = n(
  'Uitbouw van 4 bij 5 meter aan de achtergevel van een eengezinswoning — het oefenproject van de tutorials.',
  'A 4 by 5 metre extension at the rear of a family home — the practice project for the tutorials.',
);
const CALENDAR_NAME = n('Bouwkalender NL', 'Construction calendar NL');
const BASELINE_NAME = n('Basisplanning', 'Baseline');

type PhaseKey = 'P1' | 'P2' | 'P3' | 'P4';
const PHASES: { key: PhaseKey; name: Names }[] = [
  { key: 'P1', name: n('Voorbereiding', 'Preparation') },
  { key: 'P2', name: n('Fundering', 'Foundations') },
  { key: 'P3', name: n('Ruwbouw', 'Shell') },
  { key: 'P4', name: n('Afbouw', 'Finishing') },
];

export type TaskKey =
  | 'msStart' | 'site' | 'garden' | 'setout'
  | 'excavate' | 'rebar' | 'inspection' | 'pour' | 'foundBrick' | 'floor'
  | 'innerLeaf' | 'outerLeaf' | 'roofElements' | 'roofing' | 'frames' | 'breakThrough'
  | 'services' | 'plaster' | 'screed' | 'tiling' | 'painting' | 'cleaning' | 'msHandover';

interface TaskDef {
  key: TaskKey;
  phase: PhaseKey;
  name: Names;
  days?: number;
  milestone?: 'START' | 'FINISH';
  mandatory?: boolean;
}

export const TASKS: TaskDef[] = [
  { key: 'msStart', phase: 'P1', name: n('Start bouw', 'Start of construction'), milestone: 'START' },
  { key: 'site', phase: 'P1', name: n('Bouwplaats inrichten', 'Set up site'), days: 2 },
  { key: 'garden', phase: 'P1', name: n('Tuin en bestrating verwijderen', 'Clear garden and paving'), days: 1 },
  { key: 'setout', phase: 'P1', name: n('Aanbouw uitzetten', 'Set out the extension'), days: 1 },
  { key: 'excavate', phase: 'P2', name: n('Funderingssleuf ontgraven', 'Excavate foundation trench'), days: 2 },
  { key: 'rebar', phase: 'P2', name: n('Wapening en bekisting fundering', 'Foundation formwork and reinforcement'), days: 3 },
  { key: 'inspection', phase: 'P2', name: n('Inspectie wapening', 'Reinforcement inspection'), milestone: 'FINISH', mandatory: true },
  { key: 'pour', phase: 'P2', name: n('Fundering storten', 'Pour foundation'), days: 1 },
  { key: 'foundBrick', phase: 'P2', name: n('Funderingsmetselwerk', 'Foundation brickwork'), days: 2 },
  { key: 'floor', phase: 'P2', name: n('Kanaalplaatvloer leggen', 'Lay hollow-core floor'), days: 1 },
  { key: 'innerLeaf', phase: 'P3', name: n('Binnenspouwblad metselen', 'Build inner cavity leaf'), days: 5 },
  { key: 'outerLeaf', phase: 'P3', name: n('Buitenspouwblad metselen', 'Build outer cavity leaf'), days: 6 },
  { key: 'roofElements', phase: 'P3', name: n('Dakelementen plaatsen', 'Place roof elements'), days: 1 },
  { key: 'roofing', phase: 'P3', name: n('Dakbedekking aanbrengen', 'Apply roofing'), days: 2 },
  { key: 'frames', phase: 'P3', name: n('Kozijnen plaatsen', 'Install window frames'), days: 2 },
  { key: 'breakThrough', phase: 'P3', name: n('Achtergevel doorbreken', 'Break through rear wall'), days: 2 },
  { key: 'services', phase: 'P4', name: n('Installaties aanleggen', 'Install building services'), days: 3 },
  { key: 'plaster', phase: 'P4', name: n('Stucwerk', 'Plastering'), days: 4 },
  { key: 'screed', phase: 'P4', name: n('Dekvloer aanbrengen', 'Lay floor screed'), days: 1 },
  { key: 'tiling', phase: 'P4', name: n('Tegelwerk', 'Tiling'), days: 3 },
  { key: 'painting', phase: 'P4', name: n('Schilderwerk', 'Painting'), days: 3 },
  { key: 'cleaning', phase: 'P4', name: n('Opleverpunten en schoonmaken', 'Snagging and cleaning'), days: 1 },
  { key: 'msHandover', phase: 'P4', name: n('Oplevering', 'Handover'), milestone: 'FINISH' },
];

export const LINKS: { pred: TaskKey; succ: TaskKey; lag?: number }[] = [
  { pred: 'msStart', succ: 'site' },
  { pred: 'site', succ: 'garden' },
  { pred: 'garden', succ: 'setout' },
  { pred: 'setout', succ: 'excavate' },
  { pred: 'excavate', succ: 'rebar' },
  { pred: 'rebar', succ: 'inspection' },
  { pred: 'inspection', succ: 'pour' },
  { pred: 'pour', succ: 'foundBrick', lag: 3 },
  { pred: 'foundBrick', succ: 'floor' },
  { pred: 'floor', succ: 'innerLeaf' },
  { pred: 'floor', succ: 'outerLeaf' },
  { pred: 'innerLeaf', succ: 'roofElements' },
  { pred: 'roofElements', succ: 'roofing' },
  { pred: 'roofing', succ: 'frames' },
  { pred: 'outerLeaf', succ: 'frames' },
  { pred: 'frames', succ: 'breakThrough' },
  { pred: 'breakThrough', succ: 'services' },
  { pred: 'services', succ: 'plaster' },
  { pred: 'plaster', succ: 'screed' },
  { pred: 'plaster', succ: 'painting' },
  { pred: 'screed', succ: 'tiling', lag: 5 },
  { pred: 'tiling', succ: 'cleaning' },
  { pred: 'painting', succ: 'cleaning' },
  { pred: 'cleaning', succ: 'msHandover' },
];

export const CONSTRAINT = { task: 'frames' as TaskKey, type: 'SNET' as const, date: '2027-07-14' };
export const DEADLINE = { task: 'msHandover' as TaskKey, date: '2027-09-10' };

export const HOUR_TASKS: { task: TaskKey; hours: number }[] = [
  { task: 'pour', hours: 6 },
  { task: 'floor', hours: 5 },
  { task: 'roofElements', hours: 6 },
];

export type ResourceKey = 'crew' | 'bricklayer' | 'crane' | 'plasterer' | 'concrete';
export const RESOURCES: {
  key: ResourceKey; name: Names; type: ResourceType; maxUnits: number; unitOfMeasure?: string;
}[] = [
  { key: 'crew', name: n('Timmerploeg', 'Carpentry crew'), type: 'CREW', maxUnits: 1 },
  { key: 'bricklayer', name: n('Metselaar', 'Bricklayer'), type: 'LABOR', maxUnits: 1 },
  { key: 'crane', name: n('Mobiele kraan', 'Mobile crane'), type: 'EQUIPMENT', maxUnits: 1 },
  { key: 'plasterer', name: n('Stukadoor', 'Plasterer'), type: 'SUBCONTRACTOR', maxUnits: 2 },
  { key: 'concrete', name: n('Beton', 'Concrete'), type: 'MATERIAL', maxUnits: 50, unitOfMeasure: 'm³' },
];

export const ASSIGNMENTS: { task: TaskKey; res: ResourceKey; units: number }[] = [
  { task: 'rebar', res: 'crew', units: 1 },
  { task: 'pour', res: 'concrete', units: 8 },
  { task: 'foundBrick', res: 'bricklayer', units: 1 },
  { task: 'floor', res: 'crew', units: 1 },
  { task: 'floor', res: 'crane', units: 1 },
  { task: 'innerLeaf', res: 'bricklayer', units: 1 },
  { task: 'outerLeaf', res: 'bricklayer', units: 1 },
  { task: 'roofElements', res: 'crew', units: 1 },
  { task: 'roofElements', res: 'crane', units: 1 },
  { task: 'frames', res: 'crew', units: 1 },
  { task: 'breakThrough', res: 'bricklayer', units: 1 },
  { task: 'plaster', res: 'plasterer', units: 1 },
];
export const WORK_RULE = { task: 'plaster' as TaskKey, rule: 'FIXED_WORK' as const, unitsAfter: 2 };

export const STATUS_DATE = '2027-06-28';
export const PROGRESS_GROUPS: { stage: StageId; rows: { task: TaskKey; start: string; finish: string }[] }[] = [
  { stage: 'tussen-tut-6-voorbereiding', rows: [
    { task: 'msStart', start: '2027-06-07', finish: '2027-06-07' },
    { task: 'site', start: '2027-06-07', finish: '2027-06-08' },
    { task: 'garden', start: '2027-06-09', finish: '2027-06-09' },
    { task: 'setout', start: '2027-06-10', finish: '2027-06-10' },
  ] },
  { stage: 'tussen-tut-6-ontgraven', rows: [
    { task: 'excavate', start: '2027-06-11', finish: '2027-06-15' },
  ] },
  { stage: 'tussen-tut-6-fundering', rows: [
    { task: 'rebar', start: '2027-06-16', finish: '2027-06-18' },
    { task: 'inspection', start: '2027-06-18', finish: '2027-06-18' },
    { task: 'pour', start: '2027-06-21T07:00', finish: '2027-06-21T14:00' },
  ] },
];
export const LATE_TASK = { task: 'excavate' as TaskKey, extraWorkdays: 1 };
export const IN_PROGRESS = { task: 'foundBrick' as TaskKey, start: '2027-06-25', completion: 0.5 };

export interface StageFacts {
  finish: string;
  projectFinish: string;
  critical: TaskKey[];
  totalFloat: Partial<Record<TaskKey, number>>;
  early: Partial<Record<TaskKey, { start: string; finish: string }>>;
  overallocated: Partial<Record<ResourceKey, number>>;
  statusDate: string | null;
  baselineFinish: string | null;
  counts: { tasks: number; milestones: number; sequences: number; resources: number; assignments: number; baselines: number };
}

export interface TutorialStage {
  id: StageId;
  ifc: string;
  facts: StageFacts;
}

export interface TutorialBuild {
  lang: TutorialLang;
  stages: TutorialStage[];
  finishAfterBouwvak: string;
  bouwvak: { name: string; startDate: string; endDate: string };
  beforeLeveling: StageFacts;
  plasterDays: { before: number; after: number };
  levelingDelays: Partial<Record<TaskKey, number>>;
}

class Builder {
  readonly ids = new Map<TaskKey, string>();
  readonly phaseIds = new Map<PhaseKey, string>();
  readonly resIds = new Map<ResourceKey, string>();
  constructor(readonly lang: TutorialLang) {}

  id(key: TaskKey): string {
    const id = this.ids.get(key);
    if (!id) throw new Error(`tutorialproject: onbekende taak ${key}`);
    return id;
  }
  task(key: TaskKey): Task {
    const t = S().tasks.find(x => x.id === this.id(key));
    if (!t) throw new Error(`tutorialproject: taak ${key} niet in de store (${S().tasks.length} taken)`);
    return t;
  }
  keyOf(id: string): TaskKey | undefined {
    for (const [k, v] of this.ids) if (v === id) return k;
    return undefined;
  }

  calculate(context: string): void {
    S().runCPM();
    const r = S().cpmResult;
    if (!r || r.error) throw new Error(`tutorialproject [${this.lang}] ${context}: berekenen mislukt (${r?.error ?? 'geen resultaat'})`);
  }

  facts(): StageFacts {
    return collectStageFacts(this.lang);
  }

  snapshot(id: StageId): TutorialStage {
    return { id, ifc: writeIFC(buildWriteIFCInput(S(), 'planOnly')), facts: this.facts() };
  }
}

export function collectStageFacts(lang: TutorialLang): StageFacts {
  const st = S();
  const byName = new Map(st.tasks.map(t => [t.name, t]));
  const present = TASKS.filter(d => byName.has(d.name[lang]));
  const task = (k: TaskKey): Task => byName.get(TASKS.find(d => d.key === k)!.name[lang])!;
  const leaves = present.map(d => d.key).filter(k => task(k).childIds.length === 0);
  const order = (k: TaskKey) => TASKS.findIndex(d => d.key === k);
  const byStart = [...leaves].sort((a, c) =>
    task(a).time.earlyStart.localeCompare(task(c).time.earlyStart) || order(a) - order(c));
  const totalFloat: Partial<Record<TaskKey, number>> = {};
  const early: Partial<Record<TaskKey, { start: string; finish: string }>> = {};
  for (const k of leaves) {
    const t = task(k).time;
    totalFloat[k] = t.totalFloat;
    early[k] = { start: t.earlyStart, finish: t.earlyFinish };
  }
  const overallocated: Partial<Record<ResourceKey, number>> = {};
  const rlr = st.resourceLoadResult;
  for (const r of RESOURCES) {
    const res = st.resources.find(x => x.name === r.name[lang]);
    const days = res ? (rlr?.overallocatedDays[res.id]?.length ?? 0) : 0;
    if (days > 0) overallocated[r.key] = days;
  }
  const handover = present.some(d => d.key === 'msHandover') ? task('msHandover') : undefined;
  const activeBaseline = st.baselines.find(bl => bl.id === st.activeBaselineId);
  const baselineFinish = handover && activeBaseline
    ? activeBaseline.tasks.find(bt => bt.taskId === handover.id)?.finish
    : undefined;
  return {
    finish: handover?.time.earlyFinish ?? '',
    projectFinish: leaves.reduce((m, k) => {
      const f = task(k).time.earlyFinish;
      return f > m ? f : m;
    }, ''),
    critical: byStart.filter(k => task(k).time.isCritical),
    totalFloat,
    early,
    overallocated,
    statusDate: st.project.statusDate ?? null,
    baselineFinish: baselineFinish ?? null,
    counts: {
      tasks: st.tasks.length,
      milestones: st.tasks.filter(t => t.isMilestone).length,
      sequences: st.sequences.length,
      resources: st.resources.length,
      assignments: st.assignments.length,
      baselines: st.baselines.length,
    },
  };
}

function fail(lang: TutorialLang, msg: string): never {
  throw new Error(`tutorialproject [${lang}]: ${msg}`);
}

export function buildTutorialProject(lang: TutorialLang): TutorialBuild {
  const b = new Builder(lang);
  const stages: TutorialStage[] = [];

  S().newProject();
  S().setUI({ });
  const span = computeGenerateSpan(PROJECT_START, undefined);
  const wizardCalendar: WorkCalendar = buildGeneratedCalendar(
    { country: 'NL', region: undefined, bouwvak: 'geen' }, span, CALENDAR_NAME[lang],
  );
  S().createNewProject({
    name: PROJECT_NAME[lang],
    description: PROJECT_DESCRIPTION[lang],
    author: '',
    company: '',
    startDate: PROJECT_START,
    endDate: '',
    calendar: wizardCalendar,
    phaseNames: [],
    defaultTaskDurationUnit: 'days',
    schedulingProfile: undefined,
    schedulingOptions: undefined,
  });
  if (S().tasks.length !== 0) fail(lang, 'start-tut-1 is niet leeg');
  stages.push(b.snapshot('start-tut-1'));

  for (const p of PHASES) {
    const id = S().addTask({ name: p.name[lang], time: createDefaultTaskTime(PROJECT_START, 5) });
    if (!id) fail(lang, `fase ${p.key} geweigerd`);
    b.phaseIds.set(p.key, id);
  }
  for (const t of TASKS) {
    const parentId = b.phaseIds.get(t.phase)!;
    const id = S().addTask({
      name: t.name[lang],
      parentId,
      isMilestone: !!t.milestone,
      time: createDefaultTaskTime(PROJECT_START, t.milestone ? 0 : (t.days ?? 5)),
      ...(t.milestone ? { milestoneKind: t.milestone, taskType: t.mandatory ? 'ATTENDANCE' as const : 'USERDEFINED' as const } : {}),
      ...(t.mandatory ? { mandatory: true } : {}),
    });
    if (!id) fail(lang, `taak ${t.key} geweigerd`);
    b.ids.set(t.key, id);
  }
  b.calculate('tut-1');
  const f1 = b.facts();
  for (const k of TASKS.map(t => t.key)) {
    if (f1.early[k]?.start.slice(0, 10) !== PROJECT_START) fail(lang, `tut-1: ${k} begint niet op de projectstart`);
  }
  if (f1.counts.sequences !== 0) fail(lang, 'tut-1 heeft al relaties');
  stages.push(b.snapshot('na-tut-1'));

  for (const l of LINKS) {
    const id = S().addSequence({
      predecessorId: b.id(l.pred), successorId: b.id(l.succ), type: 'FINISH_START', lagDays: l.lag ?? 0,
    });
    if (!id) fail(lang, `relatie ${l.pred} → ${l.succ} geweigerd`);
  }
  b.calculate('tut-2');
  const f2 = b.facts();
  if (f2.finish <= f1.finish) fail(lang, 'tut-2: relaties schuiven de einddatum niet op');
  if (!f2.critical.includes('msHandover')) fail(lang, 'tut-2: oplevering niet kritiek');
  if ((f2.totalFloat.painting ?? 0) <= 0) fail(lang, 'tut-2: schilderwerk heeft geen speling (bedoeld: parallelle tak)');
  stages.push(b.snapshot('na-tut-2'));

  S().ensureProjectCalendarInLibrary();
  const projectCalId = S().project.calendarId;
  const projectSpan = computeGenerateSpan(
    S().project.startDate, S().project.endDate || undefined, S().cpmResult?.projectEnd,
  );
  const { holidays, generation } = materializeHolidays(
    { country: 'NL', region: undefined, bouwvak: BOUWVAK_REGION }, projectSpan.from, projectSpan.to,
  );
  const cals = (structuredClone(S().calendars) as WorkCalendar[]).map(c =>
    c.id === projectCalId ? { ...c, holidays, generation } : c);
  if (!S().commitCalendarLibrary(cals.map(withCanonicalHolidayEnds), projectCalId)) fail(lang, 'tut-3: kalender niet gewijzigd');
  b.calculate('tut-3 kalender');
  const bouwvak = S().calendar.holidays.find(h => h.startDate.startsWith('2027') && /bouwvak/i.test(h.name));
  if (!bouwvak) fail(lang, 'tut-3: geen bouwvak 2027 in de projectkalender');
  const f3cal = b.facts();
  if (f3cal.finish <= f2.finish) fail(lang, 'tut-3: de bouwvak verschuift de einddatum niet');
  stages.push(b.snapshot('tussen-tut-3-bouwvak'));

  S().updateTask(b.id(CONSTRAINT.task), { constraint: { type: CONSTRAINT.type, date: CONSTRAINT.date } });
  b.calculate('tut-3 constraint');
  S().updateTask(b.id(DEADLINE.task), { deadline: DEADLINE.date });
  b.calculate('tut-3 deadline');
  const f3 = b.facts();
  if (f3.early[CONSTRAINT.task]!.start.slice(0, 10) !== CONSTRAINT.date) fail(lang, 'tut-3: de constraint stuurt het plaatsen van de kozijnen niet');
  if (f3.finish.slice(0, 10) > DEADLINE.date) fail(lang, 'tut-3: deadline gemist (bedoeld: met marge gehaald)');
  if ((S().cpmResult?.missedDeadlineTaskIds ?? []).length !== 0) fail(lang, 'tut-3: motor meldt gemiste deadline');
  stages.push(b.snapshot('na-tut-3'));

  S().setUI({ allowMixedDayHour: true });
  const calForHours = S().calendar;
  for (const h of HOUR_TASKS) {
    const t = b.task(h.task);
    const minutes = h.hours * 60;
    const hpd = effHoursPerDay(calForHours);
    S().updateTask(t.id, {
      time: { ...t.time, durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hpd > 0 ? minutes / (hpd * 60) : 0 },
    });
  }
  b.calculate('tut-4');
  for (const h of HOUR_TASKS) {
    const t = b.task(h.task).time;
    if (t.durationUnit !== 'hours' || t.durationMinutes !== h.hours * 60) fail(lang, `tut-4: ${h.task} staat niet in uren`);
    if (!/T\d\d:\d\d/.test(t.earlyFinish)) fail(lang, `tut-4: ${h.task} heeft geen uurprecies einde (${t.earlyFinish})`);
  }
  stages.push(b.snapshot('na-tut-4'));

  for (const r of RESOURCES) {
    b.resIds.set(r.key, S().addResource({
      name: r.name[lang], type: r.type, description: '', maxUnits: r.maxUnits,
      ...(r.unitOfMeasure ? { unitOfMeasure: r.unitOfMeasure } : {}),
    }));
  }
  if (S().resources.length !== RESOURCES.length) fail(lang, 'tut-5: niet alle resources aangemaakt');
  stages.push(b.snapshot('tussen-tut-5-resources'));
  for (const a of ASSIGNMENTS) S().assignResource(b.id(a.task), b.resIds.get(a.res)!, a.units);
  if (S().assignments.length !== ASSIGNMENTS.length) fail(lang, 'tut-5: niet alle toewijzingen gelukt');
  b.calculate('tut-5 toewijzen');
  stages.push(b.snapshot('tussen-tut-5-toegewezen'));
  const plasterBefore = b.task(WORK_RULE.task).time.scheduleDuration;
  S().setTaskWorkRule(b.id(WORK_RULE.task), WORK_RULE.rule);
  const plasterAsg = S().assignments.find(a => a.taskId === b.id(WORK_RULE.task));
  if (!plasterAsg) fail(lang, 'tut-5: stucwerk heeft geen toewijzing');
  S().updateAssignment(plasterAsg.id, { unitsPerDay: WORK_RULE.unitsAfter });
  b.calculate('tut-5 werkregel');
  const plasterAfter = b.task(WORK_RULE.task).time.scheduleDuration;
  if (!(plasterAfter < plasterBefore)) fail(lang, `tut-5: werkregel verkort het stucwerk niet (${plasterBefore} → ${plasterAfter})`);
  const beforeLeveling = b.facts();
  stages.push(b.snapshot('tussen-tut-5-werkregel'));
  const overBefore = Object.keys(beforeLeveling.overallocated);
  if (overBefore.length !== 1 || overBefore[0] !== 'bricklayer') {
    fail(lang, `tut-5: vóór nivelleren hoort alleen de metselaar overbezet te zijn (is: ${overBefore.join(', ') || 'niemand'})`);
  }
  const renewables = S().resources.filter(r => r.type !== 'MATERIAL').map(r => r.id);
  const leveling = S().levelResources({ constrainToFloat: false, resourceIds: renewables });
  if (Object.keys(leveling.unresolved).length !== 0) fail(lang, 'tut-5: nivelleren laat conflicten over');
  S().applyLeveling(leveling);
  const cpm = S().cpmResult;
  if (!cpm || cpm.error) fail(lang, 'tut-5: berekenen na nivelleren mislukt');
  const f5 = b.facts();
  if (Object.keys(f5.overallocated).length !== 0) fail(lang, `tut-5: na nivelleren nog overbezetting (${Object.keys(f5.overallocated).join(', ')})`);
  const levelingDelays: Partial<Record<TaskKey, number>> = {};
  for (const [taskId, d] of Object.entries(leveling.delays)) {
    const k = b.keyOf(taskId);
    if (k && d) levelingDelays[k] = d;
  }
  stages.push(b.snapshot('na-tut-5'));

  S().saveBaseline(BASELINE_NAME[lang]);
  stages.push(b.snapshot('tussen-tut-6-baseline'));
  S().setStatusDate(STATUS_DATE);
  stages.push(b.snapshot('tussen-tut-6-statusdatum'));
  for (const group of PROGRESS_GROUPS) {
    for (const row of group.rows) {
      if (!b.task(row.task).isMilestone && !S().setActualStart(b.id(row.task), row.start)) {
        fail(lang, `tut-6: werkelijke start ${row.task} geweigerd (${row.start})`);
      }
      if (!S().setActualFinish(b.id(row.task), row.finish)) fail(lang, `tut-6: werkelijk einde ${row.task} geweigerd (${row.finish})`);
      const source = b.task(row.task);
      const expected = normalizeTaskDates({ ...source, time: { ...source.time, actualStart: row.start, actualFinish: row.finish } }, S()).time;
      const t = source.time;
      if (t.completion !== 1 || t.actualStart !== expected.actualStart || t.actualFinish !== expected.actualFinish) {
        fail(lang, `tut-6: voortgang ${row.task} is ${t.actualStart} – ${t.actualFinish} ${t.completion}`);
      }
    }
    stages.push(b.snapshot(group.stage));
  }
  if (!S().setActualStart(b.id(IN_PROGRESS.task), IN_PROGRESS.start)) fail(lang, 'tut-6: start lopende taak geweigerd');
  if (!S().setTaskProgress(b.id(IN_PROGRESS.task), IN_PROGRESS.completion)) fail(lang, 'tut-6: voortgang lopende taak geweigerd');
  stages.push(b.snapshot('tussen-tut-6-metselwerk'));
  checkProgressAgainstBaseline(b);
  b.calculate('tut-6');
  const f6 = b.facts();
  if (f6.finish !== '2027-08-31T12:00') fail(lang, `tut-6: onverwacht einde ${f6.finish}`);
  if (f6.counts.baselines !== 1) fail(lang, 'tut-6: geen basisplanning');
  const s6 = b.snapshot('na-tut-6');
  stages.push(s6);
  stages.push({ id: 'na-tut-7', ifc: s6.ifc, facts: s6.facts });

  return {
    lang,
    stages,
    finishAfterBouwvak: f3cal.finish,
    bouwvak: { name: bouwvak.name, startDate: bouwvak.startDate, endDate: bouwvak.endDate },
    beforeLeveling,
    plasterDays: { before: plasterBefore, after: plasterAfter },
    levelingDelays,
  };
}

function checkProgressAgainstBaseline(b: Builder): void {
  const st = S();
  const baseline = st.baselines.find(bl => bl.id === st.activeBaselineId);
  if (!baseline) fail(b.lang, 'tut-6: geen actieve baseline');
  const shift = (iso: string, days: number) => {
    const day = days > 0 ? nextWorkdays(iso.slice(0, 10), days, st.calendar) : iso.slice(0, 10);
    return `${day}${iso.slice(10)}`;
  };
  const planned = (k: TaskKey) => {
    const bt = baseline.tasks.find(x => x.taskId === b.id(k));
    if (!bt) fail(b.lang, `tut-6: ${k} niet in de baseline`);
    return bt;
  };
  let late = 0;
  for (const row of PROGRESS_GROUPS.flatMap(g => g.rows)) {
    const bt = planned(row.task);
    const extra = row.task === LATE_TASK.task ? LATE_TASK.extraWorkdays : 0;
    const want = { start: shift(bt.start, late), finish: shift(bt.finish, late + extra) };
    const source = b.task(row.task);
    const entered = normalizeTaskDates({ ...source, time: { ...source.time, actualStart: row.start, actualFinish: row.finish } }, st).time;
    if (entered.actualStart !== want.start || entered.actualFinish !== want.finish) {
      fail(b.lang, `tut-6: ${row.task} ${row.start} – ${row.finish} wijkt af van baseline + uitloop (${want.start} – ${want.finish})`);
    }
    late += extra;
  }
  const baselineStart = planned(IN_PROGRESS.task).start;
  const actualStart = normalizeTaskDates({ ...b.task(IN_PROGRESS.task), time: { ...b.task(IN_PROGRESS.task).time, actualStart: IN_PROGRESS.start } }, st).time.actualStart;
  if (baselineStart !== '2027-06-23T14:00' || actualStart !== '2027-06-25T07:00') {
    fail(b.lang, `tut-6: onverwachte baseline/werkelijke start ${baselineStart} / ${actualStart}`);
  }
}

function nextWorkdays(iso: string, count: number, cal: WorkCalendar): string {
  const d = new Date(`${iso}T00:00:00Z`);
  let left = count;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = ((d.getUTCDay() + 6) % 7) + 1;
    const day = d.toISOString().slice(0, 10);
    const holiday = cal.holidays.some(h => h.startDate <= day && day <= h.endDate);
    if (cal.workDays.includes(dow) && !holiday) left--;
  }
  return d.toISOString().slice(0, 10);
}
