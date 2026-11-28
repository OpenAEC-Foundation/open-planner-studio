import { useAppStore } from '@/state/appStore';
import {
  buildBaselineOverlay, buildSharedAxis,
  computeContentSpanDays, computeContentWidth, buildHistogramPicker, buildHistogramSeries,
  buildGanttRenderOptions, type GanttRenderOptionsInput,
} from '@/components/canvas/ganttRenderOptions';
import { buildTrace } from '@/engine/taskGrid/trace';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { diffDays, formatDate, parseDate, addCalendarDays } from '@/utils/dateUtils';
import { ORIGIN_PADDING_DAYS, computeEffectiveViewStart, computeFitToProject } from '@/utils/ganttViewport';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import type { TraceMode } from '@/state/slices/types';
import { buildRecordedTime, cpmResultFromRecorded } from '@/engine/scheduler/recordedDates';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const shape = (v: unknown): unknown => {
  if (v instanceof Map) return { __map: [...v.entries()].map(([k, val]) => [k, shape(val)]).sort() };
  if (v instanceof Set) return { __set: [...v].sort() };
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = shape((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
};
const eqDeep = (label: string, got: unknown, want: unknown) => eq(label, shape(got), shape(want));

function oldBaselineOverlay(baselines: Baseline[], activeBaselineId: string | null) {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map = new Map<string, { start: string; finish: string; isMilestone: boolean }>();
  for (const bt of active.tasks) {
    map.set(bt.taskId, { start: bt.start, finish: bt.finish, isMilestone: bt.isMilestone });
  }
  return map;
}

function oldTrace(traceMode: TraceMode, selectedTaskIds: string[], sequences: Sequence[], cpmResult: CPMResult | null) {
  if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
  const focusId = selectedTaskIds[0];
  const drivingIds = cpmResult && !cpmResult.error
    ? new Set(cpmResult.drivingSequenceIds)
    : undefined;
  const tr = traceFrom(focusId, sequences, drivingIds);
  return {
    focusId,
    predecessors: traceMode !== 'successors' ? [...tr.predecessors] : [],
    drivingPredecessors: traceMode !== 'successors' ? [...tr.drivingPredecessors] : [],
    successors: traceMode !== 'predecessors' ? [...tr.successors] : [],
    drivenSuccessors: traceMode !== 'predecessors' ? [...tr.drivenSuccessors] : [],
  };
}

function oldEffectiveViewStart(tasks: Task[], viewStartDate: string): string {
  let earliest = parseDate(viewStartDate);
  for (const task of tasks) {
    const start = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    if (start) {
      const d = parseDate(start);
      if (d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
}

function oldContentSpanDays(tasks: Task[], effectiveViewStart: string, compressNonWorkdays: boolean, sharedAxis: GanttAxis): number | null {
  if (tasks.length === 0) return null;
  const viewStart = effectiveViewStart;
  let maxDays = 365;
  for (const task of tasks) {
    const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
    if (end) {
      const days = compressNonWorkdays
        ? sharedAxis.daySpan(parseDate(viewStart), parseDate(end))
        : diffDays(viewStart, end);
      if (days > maxDays) maxDays = days;
    }
  }
  return maxDays;
}

function oldHistogramSeries(resourceLoadResult: ResourceLoadResult | null, histogramResourceId: string | undefined, resources: Resource[]): HistogramSeries {
  if (!resourceLoadResult) return { load: {}, capacity: {}, overSet: new Set<string>() };
  const { load, capacity, overallocatedDays } = resourceLoadResult;
  if (histogramResourceId) {
    return {
      load: load[histogramResourceId] ?? {},
      capacity: capacity[histogramResourceId] ?? {},
      overSet: new Set(overallocatedDays[histogramResourceId] ?? []),
    };
  }
  const aggLoad: Record<string, number> = {};
  const aggCap: Record<string, number> = {};
  for (const r of resources) {
    if (r.type === 'MATERIAL') continue;
    const l = load[r.id];
    const cp = capacity[r.id];
    if (l) for (const iso in l) aggLoad[iso] = (aggLoad[iso] ?? 0) + l[iso];
    if (cp) for (const iso in cp) aggCap[iso] = (aggCap[iso] ?? 0) + cp[iso];
  }
  const overSet = new Set<string>();
  for (const iso in aggLoad) if (aggLoad[iso] > (aggCap[iso] ?? 0) + 1e-9) overSet.add(iso);
  return { load: aggLoad, capacity: aggCap, overSet };
}

function oldHistogramPicker(resources: Resource[], resourceLoadResult: ResourceLoadResult | null, allLabel: string): HistogramPickerItem[] {
  const over = resourceLoadResult?.overallocatedDays ?? {};
  const anyRenewableOver = resources.some(
    r => r.type !== 'MATERIAL' && (over[r.id]?.length ?? 0) > 0,
  );
  const items: HistogramPickerItem[] = [
    { id: undefined, label: allLabel, overallocated: anyRenewableOver },
  ];
  for (const r of resources) {
    items.push({ id: r.id, label: r.name || r.id, overallocated: (over[r.id]?.length ?? 0) > 0 });
  }
  return items;
}

S().setProject({ startDate: '2027-03-01' });
const idA = S().addTask({ name: 'Fundering', time: { ...S().tasks[0]?.time ?? ({} as Task['time']) } as Task['time'] });
S().updateTask(idA, { time: { ...S().tasks.find(t => t.id === idA)!.time, scheduleStart: '2027-03-01', scheduleFinish: '2027-03-12', scheduleDuration: 10 } });
const idB = S().addTask({ name: 'Ruwbouw' });
S().updateTask(idB, { time: { ...S().tasks.find(t => t.id === idB)!.time, scheduleStart: '2027-03-15', scheduleDuration: 700 } });
const idC = S().addTask({ name: 'Vooronderzoek' });
S().updateTask(idC, { time: { ...S().tasks.find(t => t.id === idC)!.time, scheduleStart: '2026-11-04', scheduleFinish: '2026-11-20', scheduleDuration: 12 } });
S().addSequence({ predecessorId: idA, successorId: idB, type: 'FINISH_START', lagDays: 0 });
const idD = S().addTask({ name: 'Afbouw' });
S().addSequence({ predecessorId: idB, successorId: idD, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

const tasks = S().tasks;
const sequences = S().sequences;
const cpm = S().cpmResult;
const calendar = S().calendar;

const chainBase = tasks[0];
const chained = (over: Partial<Task['time']>): Task => ({
  ...chainBase,
  id: `chain-${JSON.stringify(over)}`,
  time: { ...chainBase.time, earlyStart: '', scheduleStart: '', lateStart: '', earlyFinish: '', scheduleFinish: '', lateFinish: '', ...over },
});
const chainTasks: Task[] = [
  chained({ earlyStart: '2025-05-20', earlyFinish: '2031-01-02' }),
  chained({ scheduleStart: '2019-02-28', scheduleFinish: '2038-07-11' }),
  chained({ lateStart: '2023-08-08', lateFinish: '2033-12-24' }),
  chained({}),
];
const precedenceTasks: Task[] = [chained({
  earlyStart: '2029-06-01', scheduleStart: '2021-01-01', lateStart: '2017-03-03',
  earlyFinish: '2029-07-01', scheduleFinish: '2040-01-01', lateFinish: '2045-01-01',
})];

for (const [i, vsd] of ['2027-03-01', '2026-01-01', '2028-12-31', '2026-11-04'].entries()) {
  eq(`01.${i} effectiveViewStart identiek aan het orakel (viewStartDate=${vsd})`,
    computeEffectiveViewStart(tasks, vsd), oldEffectiveViewStart(tasks, vsd));
}
eq('01b effectiveViewStart volgt elke schakel van de start-veldketen (early → schedule → late)',
  computeEffectiveViewStart(chainTasks, '2030-01-01'), oldEffectiveViewStart(chainTasks, '2030-01-01'));
eq('01d effectiveViewStart: bij drie gezette schakels wint de EERSTE (earlyStart)',
  computeEffectiveViewStart(precedenceTasks, '2035-01-01'), '2029-05-18');
eq('01c effectiveViewStart: de vroegste schakel wint, min de marge van 14 dagen',
  computeEffectiveViewStart(chainTasks, '2030-01-01'), '2019-02-14');
eq('02 effectiveViewStart: leeg takenlijst valt terug op viewStartDate − marge',
  computeEffectiveViewStart([], '2027-03-01'), oldEffectiveViewStart([], '2027-03-01'));

const VIEWPORTS = [
  { chartOriginX: 300, zoom: 30, scrollX: 0 },
  { chartOriginX: 300, zoom: 30, scrollX: 1750 },
  { chartOriginX: 0, zoom: 7.5, scrollX: 420 },
];
for (const compress of [false, true]) {
  const evs = computeEffectiveViewStart(tasks, '2027-03-01');
  for (const [j, vp] of VIEWPORTS.entries()) {
    const axisNew = buildSharedAxis({ calendar, compressNonWorkdays: compress, viewStartDate: evs, ...vp });
    const axisOld = resolveGanttAxis({
      calendar: new CalendarEngine(calendar),
      compressNonWorkdays: compress,
      origin: parseDate(evs),
      ...vp,
    });
    const probe = parseDate('2028-08-14');
    eq(`03.${compress}.${j} sharedAxis.dateToX identiek aan het orakel`, axisNew.dateToX(probe), axisOld.dateToX(probe));
    eq(`04.${compress}.${j} sharedAxis.daySpan identiek aan het orakel`,
      axisNew.daySpan(parseDate(evs), probe), axisOld.daySpan(parseDate(evs), probe));
    eq(`05.${compress}.${j} contentSpanDays identiek aan het orakel`,
      computeContentSpanDays(tasks, evs, compress, axisNew), oldContentSpanDays(tasks, evs, compress, axisOld));
  }
  const axis0 = buildSharedAxis({ calendar, compressNonWorkdays: compress, viewStartDate: evs, ...VIEWPORTS[0] });
  checks++;
  const span = computeContentSpanDays(tasks, evs, compress, axis0);
  if (span === null || span <= 365) diffs.push(`05b.${compress} fixture te kort: contentSpanDays bleef op de 365-bodem (${span}) — de check is dan vacuüm`);
  eq(`05c.${compress} contentSpanDays volgt elke schakel van de finish-veldketen`,
    computeContentSpanDays(chainTasks, '2023-07-25', compress, axis0),
    oldContentSpanDays(chainTasks, '2023-07-25', compress, axis0));
  eq(`05e.${compress} contentSpanDays: bij drie gezette schakels wint de EERSTE (earlyFinish)`,
    computeContentSpanDays(precedenceTasks, '2029-01-01', compress, axis0),
    oldContentSpanDays(precedenceTasks, '2029-01-01', compress, axis0));
  eq(`05d.${compress} contentSpanDays: kort project blijft op de bodem van 365`,
    computeContentSpanDays([chained({ earlyStart: '2027-01-01', earlyFinish: '2027-02-01' })], '2027-01-01', compress, axis0),
    365);
}
eq('06 contentSpanDays: leeg project ⇒ null', computeContentSpanDays([], '2027-03-01', false, buildSharedAxis({
  calendar, compressNonWorkdays: false, viewStartDate: '2027-03-01', chartOriginX: 0, zoom: 30, scrollX: 0,
})), null);

{
  const farViewStart = '2020-01-01';
  const soloStart = '2030-01-01';
  const startOnlyTask = chained({ earlyStart: soloStart });
  const explicitSameDayTask = chained({ earlyStart: soloStart, earlyFinish: soloStart });
  const axisFar = buildSharedAxis({
    calendar, compressNonWorkdays: false, viewStartDate: farViewStart, chartOriginX: 0, zoom: 30, scrollX: 0,
  });
  eq('06b contentSpanDays: taak met alleen start valt terug op start (== expliciete same-day taak)',
    computeContentSpanDays([startOnlyTask], farViewStart, false, axisFar),
    computeContentSpanDays([explicitSameDayTask], farViewStart, false, axisFar));

  const timelineWidth = 1200;
  const fit = computeFitToProject([startOnlyTask], timelineWidth, false);
  checks++;
  if (!fit) {
    diffs.push('06c computeFitToProject: verwacht een fit voor een taak met alleen een start');
  } else {
    const span = computeContentSpanDays([startOnlyTask], fit.viewStartDate, false, axisFar);
    const fitTargetOffsetDays = diffDays(fit.viewStartDate, soloStart);
    checks++;
    if (span === null || fitTargetOffsetDays > span) {
      diffs.push(`06d contentSpanDays (${String(span)}) dekt de fit-doeldatum (${fitTargetOffsetDays} dagen) niet — de fit zou buiten maxScrollX vallen`);
    }
  }
}

eq('07 computeContentWidth: leeg project ⇒ vaste 2000px', computeContentWidth(null, 30), 2000);
eq('08 computeContentWidth: korte span blijft op de 2000px-bodem', computeContentWidth(10, 30), 2000);
eq('09 computeContentWidth: lange span schaalt uitsluitend met zoom',
  computeContentWidth(500, 30), Math.max(2000, (500 * 1.2) * 30));

const traceModes: TraceMode[] = ['off', 'predecessors', 'successors', 'both'];
for (const mode of traceModes) {
  eqDeep(`10.${mode} trace identiek aan het orakel`,
    buildTrace(mode, [idB], sequences, cpm), oldTrace(mode, [idB], sequences, cpm));
}
{
  const tr = buildTrace('both', [idB], sequences, cpm)!;
  checks++;
  if (tr.predecessors.length === 0) diffs.push('10z fixture: focus heeft geen voorgangers — de trace-checks zijn dan half vacuüm');
  checks++;
  if (tr.successors.length === 0) diffs.push('10z fixture: focus heeft geen opvolgers — de trace-checks zijn dan half vacuüm');
}
eq('11 trace: lege selectie ⇒ undefined', buildTrace('both', [], sequences, cpm), undefined);
const cpmFailed = { ...(cpm as CPMResult), error: 'cyclus' } as CPMResult;
const oldFailedTrace = oldTrace('both', [idB], sequences, cpmFailed)!;
eqDeep('12 trace bij een mislukte CPM behoudt het pad met gelijke nadruk',
  buildTrace('both', [idB], sequences, cpmFailed), {
    ...oldFailedTrace,
    drivingPredecessors: oldFailedTrace.predecessors,
    drivenSuccessors: oldFailedTrace.successors,
  });

const baselines: Baseline[] = [{
  id: 'bl1', name: 'Nulmeting', createdAt: '2027-02-01T00:00:00', projectEnd: '2027-05-20', projectDuration: 58,
  tasks: [
    { taskId: idA, start: '2027-03-01', finish: '2027-03-10', duration: 8, isMilestone: false },
    { taskId: idB, start: '2027-03-11', finish: '2027-05-01', duration: 38, isMilestone: true },
  ],
}];
eqDeep('13 baselineOverlay identiek aan het orakel', buildBaselineOverlay(baselines, 'bl1'), oldBaselineOverlay(baselines, 'bl1'));
eq('14 baselineOverlay: geen actieve baseline ⇒ undefined', buildBaselineOverlay(baselines, null), undefined);
eq('15 baselineOverlay: onbekend id ⇒ undefined (niet een lege Map)', buildBaselineOverlay(baselines, 'weg'), undefined);

const resources: Resource[] = [
  { id: 'r1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 },
  { id: 'r2', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 },
  { id: 'r3', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 999, unitOfMeasure: 'm3' },
  { id: 'r4', name: '', type: 'LABOR', description: '', maxUnits: 1 },
];
const load: ResourceLoadResult = {
  load: {
    r1: { '2027-03-01': 3, '2027-03-02': 1, '2027-03-03': 2, '2027-03-04': 2 + 5e-10, '2027-03-05': 2.5 },
    r2: { '2027-03-01': 1 },
    r3: { '2027-03-01': 40 },
  },
  capacity: {
    r1: { '2027-03-01': 2, '2027-03-02': 2, '2027-03-03': 2, '2027-03-04': 2, '2027-03-05': 2 },
    r2: { '2027-03-01': 1 },
    r3: { '2027-03-01': 999 },
  },
  overallocatedDays: { r1: ['2027-03-01', '2027-03-05'], r2: [], r3: [], r4: [] },
  overallocatedReasons: { r1: { '2027-03-01': 'over-capacity', '2027-03-05': 'over-capacity' } },
  hours: {},
};
const materialOnlyOver: ResourceLoadResult = {
  load: { r3: { '2027-03-01': 1500 } },
  capacity: { r3: { '2027-03-01': 999 } },
  overallocatedDays: { r1: [], r2: [], r3: ['2027-03-01'], r4: [] },
  overallocatedReasons: { r3: { '2027-03-01': 'over-capacity' } },
  hours: {},
};
for (const [i, sel] of [undefined, 'r1', 'r3', 'onbekend'].entries()) {
  eqDeep(`16.${i} histogramSeries identiek aan het orakel (selectie=${sel ?? 'alle'})`,
    buildHistogramSeries(load, sel, resources), oldHistogramSeries(load, sel, resources));
}
eqDeep('17 histogramSeries: geen berekening ⇒ lege reeks',
  buildHistogramSeries(null, undefined, resources), oldHistogramSeries(null, undefined, resources));
eq('18 histogramPicker identiek aan het orakel',
  buildHistogramPicker(resources, load, 'Alle resources'), oldHistogramPicker(resources, load, 'Alle resources'));
eq('19 histogramPicker zonder berekening identiek aan het orakel',
  buildHistogramPicker(resources, null, 'Alle resources'), oldHistogramPicker(resources, null, 'Alle resources'));
eq('19b histogramPicker: alleen MATERIAL overbelast ⇒ de somrij-vlag blijft UIT',
  buildHistogramPicker(resources, materialOnlyOver, 'Alle resources')[0].overallocated, false);
eq('19c histogramPicker: de materiaalrij zelf toont zijn overbelasting wél',
  buildHistogramPicker(resources, materialOnlyOver, 'Alle resources').find(i => i.id === 'r3')?.overallocated, true);
eqDeep('19d histogramSeries: MATERIAL telt niet mee in de som over alle resources',
  buildHistogramSeries(materialOnlyOver, undefined, resources), { load: {}, capacity: {}, overSet: new Set<string>() });

const axis = buildSharedAxis({
  calendar, compressNonWorkdays: false, viewStartDate: '2027-02-25', chartOriginX: 300, zoom: 30, scrollX: 0,
});
const cpmDistinct = {
  ...(cpm as CPMResult),
  drivingSequenceIds: ['seq-driving'],
  violatedConstraintTaskIds: ['taak-geschonden'],
  missedDeadlineTaskIds: ['taak-deadline-gemist'],
} as CPMResult;

const baseInput: GanttRenderOptionsInput = {
  rows: S().viewRows,
  sequences,
  calendar,
  resources,
  assignments: S().assignments,
  view: { ...S().view, viewStartDate: '2027-02-25' },
  selectedTaskIds: [idB],
  cpmResult: cpmDistinct,
  statusDate: '2027-04-01',
  showStatusDateLine: false,
  showProgressLine: true,
  showResourceAccent: true,
  showFloatBand: false,
  showBarDates: true,
  barColorSelection: { mode: 'category', field: { src: 'activityCode', typeId: 'discipline' } },
  activityCodeTypes: [{
    id: 'discipline', name: 'Discipline',
    values: [{ id: 'elektra', code: 'E', description: 'Elektra', color: '#11AA55' }],
  }],
  customFieldDefs: [{ id: 'zone', name: 'Zone', type: 'text' }],
  taskTypeLabels: { CONSTRUCTION: 'Constructie', INSTALLATION: 'Installatie' },
  customTaskTypes: [{ id: 'ctt-asbest', name: 'Asbest', color: '#0D9488' }],
  barColorNoneLabel: '(geen-test)',
  showBaselineOverlay: true,
  baselineOverlay: buildBaselineOverlay(baselines, 'bl1'),
  baselineComparisons: undefined,
  trace: buildTrace('both', [idB], sequences, cpmDistinct),
  canvasWidth: 1200,
  canvasHeight: 800,
  rowHeight: 28,
  headerHeight: 50,
  localizedMonths: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  localizedWeekdays: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
  weekStartDay: 'sunday',
  timeNotation: '12h',
  dateNotation: 'mdy',
  enableQuarterHourZoom: true,
  effectiveCalById: new Map(),
  barSplitMode: 'always',

  durationDisplay: 'auto',
  workdayDurationMeasure: false,
  durationSuffixes: { day: 'd', hour: 'u', minute: 'm' },
  externalStaleLabel: 'verouderd (NL-test)',
  durationDrag: { taskId: idA, edge: 'right' },
  highContrast: false,
  darkTheme: true,
  palette: { __testPalette: true } as unknown as GanttRenderOptions['palette'],
  compressNonWorkdays: false,
  axis,
  fontFamily: 'Inter, sans-serif',
  fontScale: 1.25,
};

const optsOk = buildGanttRenderOptions(baseInput);

eq('20 geslaagde CPM: drivingSequenceIds komt door', optsOk.drivingSequenceIds, ['seq-driving']);
eq('21 geslaagde CPM: violatedConstraintTaskIds komt door', optsOk.violatedConstraintTaskIds, ['taak-geschonden']);
eq('22 geslaagde CPM: missedDeadlineTaskIds komt door', optsOk.missedDeadlineTaskIds, ['taak-deadline-gemist']);

const optsFailed = buildGanttRenderOptions({ ...baseInput, cpmResult: cpmFailed });
eq('23 mislukte CPM: geen drivingSequenceIds', optsFailed.drivingSequenceIds, undefined);
eq('24 mislukte CPM: geen violatedConstraintTaskIds', optsFailed.violatedConstraintTaskIds, undefined);
eq('25 mislukte CPM: geen missedDeadlineTaskIds', optsFailed.missedDeadlineTaskIds, undefined);
const optsNoCpm = buildGanttRenderOptions({ ...baseInput, cpmResult: null });
eq('26 geen CPM: geen drivingSequenceIds', optsNoCpm.drivingSequenceIds, undefined);
eq('27 geen CPM: geen violatedConstraintTaskIds', optsNoCpm.violatedConstraintTaskIds, undefined);
eq('28 geen CPM: geen missedDeadlineTaskIds', optsNoCpm.missedDeadlineTaskIds, undefined);

const recordedRecon = cpmResultFromRecorded(
  { [idA]: buildRecordedTime({ start: '2027-03-01', finish: '2027-03-05' })! },
  S().tasks, calendar, [],
);
const optsRecorded = buildGanttRenderOptions({ ...baseInput, cpmResult: recordedRecon });
eq('28b opgeslagen datums: geen driving-informatie ⇒ drivingSequenceIds undefined', optsRecorded.drivingSequenceIds, undefined);
eq('28c opgeslagen datums: missedDeadlineTaskIds komt nog door', optsRecorded.missedDeadlineTaskIds, recordedRecon.missedDeadlineTaskIds);
eq('28d berekend en niets driving blijft een lege lijst (gestreept)',
  buildGanttRenderOptions({ ...baseInput, cpmResult: { ...cpmDistinct, drivingSequenceIds: [] } }).drivingSequenceIds, []);

const passthrough: [string, unknown, unknown][] = [
  ['rows', optsOk.rows, baseInput.rows],
  ['sequences', optsOk.sequences, baseInput.sequences],
  ['calendar', optsOk.calendar, baseInput.calendar],
  ['resources', optsOk.resources, baseInput.resources],
  ['assignments', optsOk.assignments, baseInput.assignments],
  ['view', optsOk.view, baseInput.view],
  ['selectedTaskIds', optsOk.selectedTaskIds, baseInput.selectedTaskIds],
  ['statusDate', optsOk.statusDate, baseInput.statusDate],
  ['showStatusDateLine', optsOk.showStatusDateLine, baseInput.showStatusDateLine],
  ['showProgressLine', optsOk.showProgressLine, baseInput.showProgressLine],
  ['showResourceAccent', optsOk.showResourceAccent, baseInput.showResourceAccent],
  ['showFloatBand', optsOk.showFloatBand, baseInput.showFloatBand],
  ['showBarDates', optsOk.showBarDates, baseInput.showBarDates],
  ['barColorSelection', optsOk.barColorSelection, baseInput.barColorSelection],
  ['activityCodeTypes', optsOk.activityCodeTypes, baseInput.activityCodeTypes],
  ['customFieldDefs', optsOk.customFieldDefs, baseInput.customFieldDefs],
  ['taskTypeLabels', optsOk.taskTypeLabels, baseInput.taskTypeLabels],
  ['customTaskTypes', optsOk.customTaskTypes, baseInput.customTaskTypes],
  ['barColorNoneLabel', optsOk.barColorNoneLabel, baseInput.barColorNoneLabel],
  ['showBaselineOverlay', optsOk.showBaselineOverlay, baseInput.showBaselineOverlay],
  ['baselineOverlay', optsOk.baselineOverlay, baseInput.baselineOverlay],
  ['trace', optsOk.trace, baseInput.trace],
  ['canvasWidth', optsOk.canvasWidth, baseInput.canvasWidth],
  ['canvasHeight', optsOk.canvasHeight, baseInput.canvasHeight],
  ['rowHeight', optsOk.rowHeight, baseInput.rowHeight],
  ['headerHeight', optsOk.headerHeight, baseInput.headerHeight],
  ['localizedMonths', optsOk.localizedMonths, baseInput.localizedMonths],
  ['localizedWeekdays', optsOk.localizedWeekdays, baseInput.localizedWeekdays],
  ['weekStartDay', optsOk.weekStartDay, baseInput.weekStartDay],
  ['timeNotation', optsOk.timeNotation, baseInput.timeNotation],
  ['dateNotation', optsOk.dateNotation, baseInput.dateNotation],
  ['enableQuarterHourZoom', optsOk.enableQuarterHourZoom, baseInput.enableQuarterHourZoom],
  ['effectiveCalById', optsOk.effectiveCalById, baseInput.effectiveCalById],
  ['barSplitMode', optsOk.barSplitMode, baseInput.barSplitMode],
  ['durationDisplay', optsOk.durationDisplay, baseInput.durationDisplay],
  ['workdayDurationMeasure', optsOk.workdayDurationMeasure, baseInput.workdayDurationMeasure],
  ['durationSuffixes', optsOk.durationSuffixes, baseInput.durationSuffixes],
  ['externalStaleLabel', optsOk.externalStaleLabel, baseInput.externalStaleLabel],
  ['durationDrag', optsOk.durationDrag, baseInput.durationDrag],
  ['highContrast', optsOk.highContrast, baseInput.highContrast],
  ['darkTheme', optsOk.darkTheme, baseInput.darkTheme],
  ['palette', optsOk.palette, baseInput.palette],
  ['compressNonWorkdays', optsOk.compressNonWorkdays, baseInput.compressNonWorkdays],
  ['fontFamily', optsOk.fontFamily, baseInput.fontFamily],
  ['fontScale', optsOk.fontScale, baseInput.fontScale],
];
for (const [name, got, want] of passthrough) {
  eqDeep(`29.${name} gaat ongewijzigd door naar de renderer`, got, want);
}
checks++;
if (optsOk.axis !== axis) diffs.push('30 axis: renderer krijgt niet dezelfde as-INSTANTIE als de histogram');

const optsSecondary = buildGanttRenderOptions({
  ...baseInput,
  view: { ...baseInput.view, zoom: 12, scrollX: 400 },

  durationDisplay: undefined,
  durationSuffixes: undefined,
  externalStaleLabel: undefined,
  durationDrag: undefined,
  axis: undefined,
});
eq('31 secundair: geen eigen as (renderer bouwt hem zelf uit view+compressNonWorkdays)', optsSecondary.axis, undefined);
eq('33 secundair: geen sleep-pilletje', optsSecondary.durationDrag, undefined);
eq('34 secundair: eigen zoom', optsSecondary.view.zoom, 12);
eq('35 secundair: eigen scrollX', optsSecondary.view.scrollX, 400);

{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  const canvasPath = join(root, 'src/components/canvas/GanttCanvas.tsx');
  const hostPath = join(root, 'src/components/canvas/hooks/useGanttRendererHost.ts');
  const coordinatorPath = join(root, 'src/components/canvas/hooks/useGanttViewportCoordinator.ts');
  const histogramInteractionPath = join(root, 'src/components/canvas/hooks/useGanttHistogramInteraction.ts');
  const viewportPath = join(root, 'src/utils/ganttViewport.ts');
  checks++;
  if (!existsSync(canvasPath) || !existsSync(hostPath) || !existsSync(coordinatorPath)
    || !existsSync(histogramInteractionPath) || !existsSync(viewportPath)) {
    diffs.push(`36 bron-assert overgeslagen: repo-root niet gevonden vanaf ${dirname(fileURLToPath(import.meta.url))}`);
  } else {
  const raw = readFileSync(canvasPath, 'utf8');

  const stripComments = (s: string): string => {
    let out = '';
    let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') mode = c;
        out += c;
      } else if (mode === 'line') {
        if (c === '\n') { mode = 'code'; out += c; }
      } else if (mode === 'block') {
        if (c === '*' && n === '/') { mode = 'code'; i++; }
      } else {
        if (c === '\\') { out += c + (n ?? ''); i++; continue; }
        if (c === mode) mode = 'code';
        out += c;
      }
    }
    return out;
  };
  const src = stripComments(raw);
  const hostSrc = stripComments(readFileSync(hostPath, 'utf8'));
  const coordinatorSrc = stripComments(readFileSync(coordinatorPath, 'utf8'));
  const histogramInteractionSrc = stripComments(readFileSync(histogramInteractionPath, 'utf8'));
  eq('36a stripComments haalt regelcommentaar weg', stripComments('const a = 1; // weg\nconst b = 2;'), 'const a = 1; \nconst b = 2;');
  eq('36b stripComments haalt blokcommentaar weg', stripComments('const /* weg */ a = 1;'), 'const  a = 1;');
  eq('36c stripComments laat een string met // intact', stripComments("const u = 'https://x'; // weg"), "const u = 'https://x'; ");
  eq('36d stripComments laat een template met // intact', stripComments('const t = `a//b`; /* weg */'), 'const t = `a//b`; ');
  eq('36e stripComments laat een ontsnapt aanhalingsteken heel', stripComments("const s = 'a\\'b'; // weg"), "const s = 'a\\'b'; ");
  eq('36h stripComments is NIET sluitend op een JSX-apostrof (bekende beperking)',
    stripComments("return <p>Don't</p>; // BLIJFT STAAN"), "return <p>Don't</p>; // BLIJFT STAAN");
  eq('36f stripComments haalt commentaar uit het echte bestand', src.includes('K-item 33: de pure afleidingen'), false);
  eq('36g stripComments laat de code van het echte bestand staan', src.includes('export function GanttCanvas('), true);

  eq('37 GanttCanvas instantieert geen renderer meer',
    (src.match(/new (?:GanttRenderer|HistogramRenderer)\(/g) ?? []).length, 0);
  eq('38 rendererhost heeft één gedeelde Gantt-constructorroute',
    (hostSrc.match(/new GanttRenderer\(/g) ?? []).length, 1);
  eq('38a rendererhost bouwt elke Gantt-optie via de gedeelde bouwer',
    (hostSrc.match(/buildGanttRenderOptions\(/g) ?? []).length,
    (hostSrc.match(/new GanttRenderer\(/g) ?? []).length);
  eq('38b rendererhost bezit de enige histogramconstructor',
    (hostSrc.match(/new HistogramRenderer\(/g) ?? []).length, 1);
  eq('38c GanttCanvas bevat geen histogramhittest of bijdragefilter meer', [
    'pickerAt', 'dayAt', 'contributingTaskNames', 'setHistoTooltip',
  ].filter(name => src.includes(name)), []);
  eq('38d histograminteractie gebruikt uitsluitend rendererhittests', [
    'pickerAt', 'dayAt',
  ].filter(name => histogramInteractionSrc.includes(name)), ['pickerAt', 'dayAt']);
  eq('38e histograminteractie dupliceert geen as- of seriesafleiding', [
    'dateToX', 'buildHistogramPicker', 'buildHistogramSeries', 'useAppStore',
  ].filter(name => histogramInteractionSrc.includes(name)), []);

  const { execSync } = await import('node:child_process');
  const { relative } = await import('node:path');
  const chain = String.raw`shownStart\([a-zA-Z_.]*\) \|\| [a-zA-Z_.]*lateStart`;
  const hits = execSync(
    `grep -rlE ${JSON.stringify(chain)} ${JSON.stringify(join(root, 'src'))} || true`,
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean).map(f => relative(root, f)).sort();
  eq('39 de start-veldketen staat in geen enkel bestand buiten ganttViewport.ts',
    hits, ['src/utils/ganttViewport.ts']);
  eq('40 GanttCanvas orkestreert geen viewportformules meer', [
    'computeEffectiveViewStart',
    'computeGanttScrollBounds',
    'setGanttScrollBounds',
    'computeFitToProject',
    'computeFocusTaskHorizontal',
    'resolveWheelFunction',
  ].filter(name => new RegExp(`${name}\\(`).test(src)), []);
  eq('40a viewportcoördinator bezit de effectieve oorsprong',
    (coordinatorSrc.match(/computeEffectiveViewStart\(/g) ?? []).length, 1);
  eq('40b viewportcoördinator bezit fit, focus, bounds en wheel',
    ['computeFitToProject', 'computeFocusTaskHorizontal', 'computeGanttScrollBounds',
      'setGanttScrollBounds', 'resolveWheelFunction']
      .filter(name => new RegExp(`${name}\\(`).test(coordinatorSrc)),
    ['computeFitToProject', 'computeFocusTaskHorizontal', 'computeGanttScrollBounds',
      'setGanttScrollBounds', 'resolveWheelFunction']);

  const viewport = stripComments(readFileSync(viewportPath, 'utf8'));
  eq('41 computeScrollToDate hergebruikt de gedeelde oorsprongsfunctie',
    /computeScrollToDate[\s\S]{0,400}computeEffectiveViewStart\(/.test(viewport), true);

  eq('42 beide panes geven het vertaalde "verouderd"-label mee',
    (src.match(/externalStaleLabel:\s*tTask\(/g) ?? []).length, 2);
  eq('43 geen pane laat externalStaleLabel leeg',
    /externalStaleLabel:\s*undefined/.test(src), false);
  eq('44 histogramas begint op het plotbegin uit pickerWidth en pickerSide',
    /const histogramAxis[\s\S]{0,500}chartOriginX:\s*histogramPlotInsets\(input\.histogramPickerWidth,\s*input\.histogramPickerSide\)\.left/
      .test(coordinatorSrc), true);
  eq('45 HistogramRenderer krijgt pickerWidth en de primaire histogramas samen',
    /const histogramRenderInput[\s\S]{0,500}pickerWidth:\s*histogramPickerWidth[\s\S]{0,500}axis:\s*histogramAxis/.test(src)
      && /new HistogramRenderer[\s\S]{0,200}\.\.\.input\.histogram/.test(hostSrc), true);
  }
}

if (diffs.length === 0) {
  console.log(`OK  gantt-render-options: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-render-options: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
