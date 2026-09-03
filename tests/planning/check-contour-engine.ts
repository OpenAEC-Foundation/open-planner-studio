// check-contour-engine.ts — de contour-engine (2026-09): vijf lagen, elk headless tegen de echte
// code (geen mocks van de engine of de adapters):
//   (a) de pure kern (`src/engine/contour/contourEngine.ts`): 21-punts-tabellen, slotgewichten,
//       periodes → dagslots (mét gat-uitlijning), contour↔toewijzing-koppeling, herschaling;
//   (b) de lastlezers: `computeResourceLoad`/`computeHistogramReport` verdelen een opgeslagen
//       contour als DATA (fracties blijven staan, gaten dragen geen last) en vallen zonder contour
//       byte-identiek terug op `distributeUnits`; `curveValues` (exacte P6-curve) telt als data;
//   (c) de nivelleerder boekt de contour-dagvraag (een halve-eenheid-contour past naast een
//       halve-eenheid-taak op een capaciteit van 1, waar de formule 1/dag zou botsen);
//   (d) bewerken: `rescaleTaskContours` (taakslice/MCP/grid-tweelingen) rekt de periodes én de
//       importsplits proportioneel mee, laat actuals staan en houdt bij FIXED_WORK het werk vast;
//   (e) de adapters: MSPDI `<TimephasedData>` en P6 `<ResourceCurve>`/`<ResourceCurveObjectId>`/
//       `<PlannedCurve>`-spreiding round-trippen via de echte writer→reader, plus de IFC-koppeling
//       (`resourceId` op een contour overleeft de resource-id-regeneratie van de IFC-lezer).
//
// Kalender: ma–vr 8u (08:00–16:00), week van ma 2026-06-01. Draait via run.sh. Exit 0 = groen.
import {
  CONTOUR_SHAPE_VALUES, MSPDI_WORKCONTOUR_CONTOURED, isFlatCurveValues, matchContourShape,
  matchContoursToAssignments, matchCurveValues, normalizeCurveValues, periodsSpanMinutes,
  periodsToSlotWork, periodsToWorkDaySlots, periodsWorkMinutes, rescaleContourForDuration,
  rescaleFactor, rescaleSplitGaps, slotWeightsFromValues, taskWorkMinutes,
} from '@/engine/contour/contourEngine';
import {
  axisOffsetMinutes, contourPeriodsToP6Spread, minutesToMspdiValue, mspdiValueToMinutes,
  p6SpreadToContourPeriods, splitGapsFromContours,
} from '@/services/contourIo';
import { computeResourceLoad, computeHistogramReport, assignmentDayUnits, distributeUnits } from '@/engine/scheduler/ResourceLoad';
import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { rescaleTaskContours } from '@/utils/taskDefaults';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

declare const process: { exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
const r3 = (xs: readonly number[]): number[] => xs.map((x) => Math.round(x * 1000) / 1000);

const CAL: WorkCalendar = {
  id: 'cal-contour', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const MPD = 480;

function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}
function res(id: string, maxUnits = 1, extra?: Partial<Resource>): Resource {
  return { id, name: id, type: 'LABOR', description: '', maxUnits, ...extra };
}
function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number, extra?: Partial<ResourceAssignment>): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, ...extra };
}
const P = (afterMinutes: number, minutes: number, workMinutes: number, kind: 'actual' | 'remaining' = 'remaining'): TimephasedContourPeriod =>
  ({ afterMinutes, minutes, workMinutes, kind });

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) kern: 21-punts-tabellen --');
{
  eq('a1 FRONT_LOADED over 2 slots = 65/35', r3(slotWeightsFromValues(CONTOUR_SHAPE_VALUES.FRONT_LOADED, 2)), [0.65, 0.35]);
  eq('a2 FLAT over 3 slots = derden', r3(slotWeightsFromValues(CONTOUR_SHAPE_VALUES.FLAT, 3)), r3([1 / 3, 1 / 3, 1 / 3]));
  const w20 = slotWeightsFromValues(CONTOUR_SHAPE_VALUES.BELL, 20);
  eq('a3 BELL over 20 slots = de tabel zelf (÷100)', r3(w20), r3(CONTOUR_SHAPE_VALUES.BELL.slice(1).map((v) => v / 100)));
  ok('a4 som van de gewichten is exact 1', Math.abs(slotWeightsFromValues(CONTOUR_SHAPE_VALUES.EARLY_PEAK, 7).reduce((a, b) => a + b, 0) - 1) < 1e-12);
  eq('a5 lege slots bij 0', slotWeightsFromValues(CONTOUR_SHAPE_VALUES.FLAT, 0), []);
  eq('a6 matchCurveValues herkent elke OPS-vorm', [
    matchCurveValues(CONTOUR_SHAPE_VALUES.FLAT), matchCurveValues(CONTOUR_SHAPE_VALUES.FRONT_LOADED),
    matchCurveValues(CONTOUR_SHAPE_VALUES.BACK_LOADED), matchCurveValues(CONTOUR_SHAPE_VALUES.BELL),
    matchCurveValues(CONTOUR_SHAPE_VALUES.EARLY_PEAK), matchCurveValues(CONTOUR_SHAPE_VALUES.LATE_PEAK),
  ], ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK']);
  eq('a7 DOUBLE_PEAK/TURTLE zijn geen OPS-curve maar wél een vorm', [
    matchCurveValues(CONTOUR_SHAPE_VALUES.DOUBLE_PEAK), matchContourShape(CONTOUR_SHAPE_VALUES.TURTLE),
  ], [undefined, 'TURTLE']);
  const flat7 = [0, ...new Array<number>(20).fill(7)];
  eq('a8 vlak met een andere constante is ook UNIFORM', [isFlatCurveValues(flat7), matchCurveValues(flat7)], [true, 'UNIFORM']);
  eq('a9 normalizeCurveValues: lengte/negatief/nul-som afgewezen, index 0 gedwongen 0', [
    normalizeCurveValues([1, 2, 3]), normalizeCurveValues([0, ...new Array<number>(19).fill(5), -1]),
    normalizeCurveValues(new Array<number>(21).fill(0)), normalizeCurveValues([9, ...new Array<number>(20).fill(5)])?.[0],
  ], [null, null, null, 0]);
  eq('a10 MSPDI-code Contoured = 8', MSPDI_WORKCONTOUR_CONTOURED, 8);
}

console.log('-- (a) kern: periodes → slots --');
{
  const periods = [P(0, 480, 240), P(480, 480, 0), P(960, 480, 480)];
  eq('a11 slotwerk per dag (met gat als 0)', periodsToSlotWork(periods, MPD), [240, 0, 480]);
  eq('a12 spanne en werk', [periodsSpanMinutes(periods), periodsWorkMinutes(periods)], [1440, 720]);
  eq('a13 periode over een slotgrens wordt naar rato gesplitst', periodsToSlotWork([P(240, 480, 480)], MPD), [240, 240]);
  eq('a14 minSlots vult aan met 0', periodsToSlotWork([P(0, 480, 480)], MPD, 3), [480, 0, 0]);
  eq('a15 uitlijning op werkdagen: het gat-slot verdwijnt', periodsToWorkDaySlots(periods, [{ afterMinutes: 480, gapMinutes: 480 }], MPD), [240, 480]);
  eq('a16 werk in een gat-slot schuift door naar de volgende werkdag (nooit weg)',
    periodsToWorkDaySlots([P(0, 480, 240), P(480, 480, 60), P(960, 480, 480)], [{ afterMinutes: 480, gapMinutes: 480 }], MPD), [240, 540]);
  eq('a17 zonder gaten identiek aan periodsToSlotWork', periodsToWorkDaySlots(periods, undefined, MPD), [240, 0, 480]);
  eq('a18 corrupte periodes (NaN/negatief/nul-lang) worden genegeerd',
    periodsToSlotWork([P(NaN, 480, 480), P(0, 0, 100), P(0, 480, -5), P(480, 480, 120)], MPD), [0, 120]);
  eq('a19 taakwerkminuten: dagen × mpd, uren = durationMinutes', [
    taskWorkMinutes({ durationUnit: 'days', scheduleDuration: 3 }, 8),
    taskWorkMinutes({ durationUnit: 'hours', durationMinutes: 300, scheduleDuration: 0.625 }, 8),
  ], [1440, 300]);
}

console.log('-- (a) kern: contour ↔ toewijzing --');
{
  const c1: TaskTimephasedContour = { resourceUid: 1, resourceId: 'r1', periods: [P(0, 480, 480)] };
  const c2: TaskTimephasedContour = { resourceUid: 2, resourceId: 'r1', periods: [P(0, 480, 240)] };
  const cOld: TaskTimephasedContour = { resourceUid: 7, periods: [P(0, 480, 120)] };
  const a1 = assign('a1', 't', 'r1', 1);
  const a2 = assign('a2', 't', 'r1', 1);
  const a3 = assign('a3', 't', 'r9', 1);
  const m = matchContoursToAssignments([c1, c2], [a1, a2, a3]);
  eq('a20 twee toewijzingen van dezelfde resource krijgen elk hun eigen contour, in volgorde',
    [m.get('a1')?.resourceUid, m.get('a2')?.resourceUid, m.has('a3')], [1, 2, false]);
  eq('a21 Z14b-contour zonder resourceId: alleen de 1-op-1-terugval', [
    matchContoursToAssignments([cOld], [a1]).get('a1')?.resourceUid,
    matchContoursToAssignments([cOld], [a1, a2]).size,
  ], [7, 0]);
}

console.log('-- (a) kern: herschaling --');
{
  const periods = [P(0, 480, 480, 'actual'), P(480, 480, 240), P(960, 480, 0), P(1440, 480, 480)];
  // Taak 3 werkdagen (1440 min) + 1 dag gat; actual = 480 ⇒ restant 960 → 1920 is factor 2.
  const scaled = rescaleContourForDuration(periods, 1440, 2400);
  eq('a22 actual blijft staan, restant ×2 op as én werk', scaled, [
    P(0, 480, 480, 'actual'), P(480, 960, 480), P(1440, 960, 0), P(2400, 960, 960),
  ]);
  eq('a23 FIXED_WORK houdt het werk vast (dichtheid daalt)', rescaleContourForDuration([P(0, 480, 480)], 480, 960, 'FIXED_WORK'), [P(0, 960, 480)]);
  eq('a24 gelijke duur ⇒ ongewijzigd, ongeldig ⇒ ongewijzigd', [
    rescaleFactor(periods, 1440, 1440), rescaleFactor(periods, 1440, 0), rescaleFactor(periods, 480, 960),
  ], [null, null, null]);
  eq('a25 importsplits schalen mee, nivelleergaten niet', rescaleSplitGaps(
    [{ afterMinutes: 960, gapMinutes: 480 }, { afterMinutes: 1200, gapMinutes: 480, source: 'leveling' }],
    periods, 1440, 2400,
  ), [{ afterMinutes: 1440, gapMinutes: 960 }, { afterMinutes: 1200, gapMinutes: 480, source: 'leveling' }]);

  // De taak-helper (aanroep vanuit taskSlice/MCP/grid): periodes én gaten, mspTaskType-bewust.
  const t = task('t', '2026-06-01', '2026-06-03', 3, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 240), P(480, 480, 0), P(960, 960, 960)] }],
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  t.time.scheduleDuration = 6; // bewerking: 3 → 6 dagen (de aanroeper heeft de oude 1440 al vastgelegd)
  ok('a26 rescaleTaskContours meldt een echte herschaling', rescaleTaskContours(t, 1440, 8));
  eq('a27 periodes ×2', t.timephasedContours?.[0].periods, [P(0, 960, 480), P(960, 960, 0), P(1920, 1920, 1920)]);
  eq('a28 gaten ×2', t.splitGaps, [{ afterMinutes: 960, gapMinutes: 960 }]);
  ok('a29 idempotent: nogmaals met de nieuwe duur ⇒ niets', !rescaleTaskContours(t, 2880, 8));
  const noC = task('u', '2026-06-01', '2026-06-03', 3);
  ok('a30 taak zonder contour ⇒ no-op', !rescaleTaskContours(noC, 1440, 8));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) lastlezers: contour als data --');
{
  // 3-daagse taak ma 06-01..wo 06-03, contour: ma 0.5, di gat, wo 1.0 — en het gat zit óók in splitGaps
  // (zoals de .mpp-lezer beide uit dezelfde periodes afleidt), dus de taak werkt ma/wo/do.
  const t = task('t', '2026-06-01', '2026-06-04', 3, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 240), P(480, 480, 0), P(960, 480, 480), P(1440, 480, 480)] }],
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  const a = assign('a', 't', 'r1', 1);
  const load = computeResourceLoad([res('r1', 1)], [a], [t], CAL, []);
  eq('b1 dagbelasting volgt de contour (fractie blijft, gatdag draagt niets)', load.load.r1, { '2026-06-01': 0.5, '2026-06-03': 1, '2026-06-04': 1 });
  eq('b2 geen overallocatie', load.overallocatedDays.r1, undefined);
  eq('b3 assignmentDayUnits: contourdata zonder hele-eenheden-afronding', assignmentDayUnits(t, a, MPD, undefined, [a]), [0.5, 1, 1]);

  // Zonder contour: byte-identiek aan de formule.
  const plain = task('p', '2026-06-01', '2026-06-03', 3);
  const ap = assign('ap', 'p', 'r1', 2, { curve: 'FRONT_LOADED' });
  eq('b4 zonder contour = distributeUnits', assignmentDayUnits(plain, ap, MPD), distributeUnits(2, 3, 'FRONT_LOADED'));

  // curveValues (exacte P6-curve) telt als data: FRONT_LOADED-tabel over 2 dagen = 65/35 van 2×1.
  const two = task('q', '2026-06-01', '2026-06-02', 2);
  const aq = assign('aq', 'q', 'r1', 1, { curve: 'FRONT_LOADED', curveValues: [...CONTOUR_SHAPE_VALUES.FRONT_LOADED] });
  eq('b5 curveValues verdeelt met de 21-punts-tabel (geen vervlakking op 2 dagen)', r3(assignmentDayUnits(two, aq, MPD)), [1.3, 0.7]);
  eq('b6 de formule geeft hier het hele-eenheden-artefact [2,0] (bestaand gedrag, ongewijzigd)', distributeUnits(1, 2, 'FRONT_LOADED'), [2, 0]);

  // Histogram-rapport ziet dezelfde dagwaarden + veroorzaker-attributie op de contourdag.
  const over = task('o', '2026-06-01', '2026-06-01', 1, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 720)] }],
  });
  const ao = assign('ao', 'o', 'r1', 1);
  const rep = computeHistogramReport({
    tasks: [over], sequences: [], assignments: [ao], resources: [res('r1', 1)], calendar: CAL, calendars: [],
    cpmResult: null, from: '2026-06-01', to: '2026-06-01', bucket: 'dag',
  });
  eq('b7 histogram: 1,5 eenheid uit de contour, overbelast, veroorzaker = de toewijzing', [
    rep.resources[0].buckets[0].load, rep.resources[0].buckets[0].overallocatedDays, rep.resources[0].buckets[0].causes?.[0].contribution,
  ], [1.5, ['2026-06-01'], 1.5]);

  // Contour langer dan de duur: het totaal blijft behouden (aanroeper enumereert genoeg dagen).
  const longer = task('l', '2026-06-01', '2026-06-01', 1, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 480), P(480, 480, 480)] }],
  });
  const al = assign('al', 'l', 'r1', 1);
  eq('b8 contour voorbij scheduleDuration verliest geen werk', computeResourceLoad([res('r1')], [al], [longer], CAL, []).load.r1, { '2026-06-01': 1, '2026-06-02': 1 });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) nivelleerder boekt de contour --');
{
  function stubCpmResult(projectEnd: string): CPMResult {
    return {
      tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
      truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
      outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
      hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
    };
  }
  const OPTS: LevelingOptions = { constrainToFloat: false };
  // A: 2 dagen met een halve-eenheid-contour (units 1 — de formule zou 1/dag boeken). B: 2 dagen 0.5/dag.
  const mk = (withContour: boolean) => {
    const a = task('a', '2026-06-01', '2026-06-02', 2, {
      priority: 600,
      ...(withContour ? { timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 960, 480)] }] } : {}),
    });
    const b = task('b', '2026-06-01', '2026-06-02', 2, { priority: 500 });
    const assignments = [assign('a-r1', 'a', 'r1', 1), assign('b-r1', 'b', 'r1', 0.5)];
    return levelResources([a, b], [], [res('r1', 1)], assignments, CAL, [], stubCpmResult('2026-06-02'), OPTS);
  };
  eq('c1 met contour (0,5/dag) past B ernaast: geen delay', mk(true).delays['b'], undefined);
  ok('c2 zonder contour boekt A 1/dag en moet B wijken', (mk(false).delays['b'] ?? 0) > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) adapters: as-vertaling --');
{
  const eng = new CalendarEngine(CAL);
  const start = new Date('2026-06-01T00:00:00Z');
  eq('e1 dag-modus asoffset: werkdagen vóór de dag × mpd, eindinstant mét tijd telt de eigen dag', [
    axisOffsetMinutes(eng, start, new Date('2026-06-01T08:00:00Z')),
    axisOffsetMinutes(eng, start, new Date('2026-06-03T08:00:00Z')),
    axisOffsetMinutes(eng, start, new Date('2026-06-03T16:00:00Z'), true),
    axisOffsetMinutes(eng, start, new Date('2026-06-08T08:00:00Z')), // over het weekend
    axisOffsetMinutes(eng, start, new Date('2026-05-20T08:00:00Z')), // vóór de start ⇒ 0
  ], [0, 960, 1440, 2400, 0]);
  eq('e2 P6-spreiding heen en terug', [
    p6SpreadToContourPeriods('4:8;0:8;8:8', 0, 'remaining'),
    contourPeriodsToP6Spread([P(0, 480, 240), P(480, 480, 0), P(960, 480, 480)]),
    contourPeriodsToP6Spread([P(0, 480, 240), P(960, 480, 480)]), // leeg stuk as ⇒ "0:8"
    p6SpreadToContourPeriods('Front Loaded', 0, 'remaining'),      // naam, geen spreiding
    p6SpreadToContourPeriods('4:8;kapot', 0, 'remaining'),
  ], [
    [P(0, 480, 240), P(480, 480, 0), P(960, 480, 480)], '4:8;0:8;8:8', '4:8;0:8;8:8', [], [],
  ]);
  eq('e3 MSPDI-duurnotatie', [mspdiValueToMinutes('PT8H30M0S'), mspdiValueToMinutes('PT0H0M0S'), mspdiValueToMinutes('P2D'), mspdiValueToMinutes('x'), minutesToMspdiValue(510)],
    [510, 0, 2880, null, 'PT8H30M0S']);
  eq('e4 gaten uit contouren = dezelfde afleiding als de .mpp-lezer',
    splitGapsFromContours([[P(0, 480, 240), P(480, 480, 0), P(960, 480, 480)]]), [{ afterMinutes: 480, gapMinutes: 480 }]);
}

console.log('-- (e) adapters: MSPDI round-trip --');
{
  const project = createDefaultProject();
  project.startDate = '2026-06-01';
  const t = task('t', '2026-06-01', '2026-06-04', 3, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 240), P(480, 480, 0), P(960, 480, 480), P(1440, 480, 480)] }],
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    resourceIds: ['r1'],
  });
  const plain = task('p', '2026-06-08', '2026-06-09', 2, { resourceIds: ['r1'] });
  const r1 = res('r1', 1);
  const assignments = [assign('a', 't', 'r1', 1), assign('b', 'p', 'r1', 1, { curve: 'BELL' })];
  const xml = writeMSPDI(project, CAL, [t, plain], [], [r1], assignments, []);
  ok('e5 writer schrijft TimephasedData + WorkContour 8 voor de contourtaak', xml.includes('<TimephasedData>') && xml.includes('<WorkContour>8</WorkContour>'));
  ok('e6 writer schrijft alleen werkdagen met een 0-item voor het gat (4 items: ma/di/wo/do)', (xml.match(/<TimephasedData>/g) ?? []).length === 4 && xml.includes('<Value>PT0H0M0S</Value>'));
  ok('e7 gewone curve blijft WorkContour 6 (Bell), zonder TimephasedData', xml.includes('<WorkContour>6</WorkContour>'));
  const back = readMSPDI(xml);
  const bt = back.tasks.find((x) => x.name === 't')!;
  const bp = back.tasks.find((x) => x.name === 'p')!;
  eq('e8 contour komt terug op de taak, gekoppeld aan de resource', [
    bt.timephasedContours?.length, bt.timephasedContours?.[0].resourceId === back.assignments.find((a) => a.taskId === bt.id)?.resourceId,
  ], [1, true]);
  eq('e9 slotwerk per dag identiek na round-trip', periodsToSlotWork(bt.timephasedContours![0].periods, MPD), [240, 0, 480, 480]);
  eq('e10 gaten afgeleid uit de contour', bt.splitGaps, [{ afterMinutes: 480, gapMinutes: 480 }]);
  eq('e11 taak zonder contour blijft zonder (Bell-curve intact)', [bp.timephasedContours, back.assignments.find((a) => a.taskId === bp.id)?.curve], [undefined, 'BELL']);
  const load = computeResourceLoad(back.resources, back.assignments, back.tasks, back.calendar, back.resourceCalendars ?? []);
  eq('e12 lastlezer ziet na round-trip dezelfde dagverdeling', load.load[back.resources[0].id]['2026-06-01'], 0.5);
}

console.log('-- (e) adapters: P6 round-trip --');
{
  const project = createDefaultProject();
  project.startDate = '2026-06-01';
  const t = task('t', '2026-06-01', '2026-06-04', 3, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 240), P(480, 480, 0), P(960, 480, 480), P(1440, 480, 480)] }],
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    resourceIds: ['r1'],
  });
  const plain = task('p', '2026-06-08', '2026-06-09', 2, { resourceIds: ['r1', 'r2'] });
  const custom = [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]; // geen OPS-vorm
  const assignments = [
    assign('a', 't', 'r1', 1),
    assign('b', 'p', 'r1', 1, { curve: 'LATE_PEAK' }),
    assign('c', 'p', 'r2', 0.5, { curveValues: custom }),
  ];
  const xml = writeP6XML(project, CAL, [t, plain], [], [res('r1', 1), res('r2', 1)], assignments, []);
  ok('e13 writer schrijft ResourceCurve-catalogus + ResourceCurveObjectId', (xml.match(/<ResourceCurve>/g) ?? []).length === 2 && xml.includes('<ResourceCurveObjectId>'));
  ok('e14 writer schrijft een spreidingsstring in PlannedCurve (geen curvenaam meer)', /<PlannedCurve>4:8;0:8;8:8;8:8<\/PlannedCurve>/.test(xml) && !xml.includes('<PlannedCurve>Late Peak</PlannedCurve>'));
  ok('e15 PlannedStartDate als anker meegeschreven', xml.includes('<PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>'));
  const back = readP6XML(xml);
  const bt = back.tasks.find((x) => x.name === 't')!;
  const bp = back.tasks.find((x) => x.name === 'p')!;
  eq('e16 contour terug via de spreiding', periodsToSlotWork(bt.timephasedContours![0].periods, MPD), [240, 0, 480, 480]);
  eq('e17 gaten afgeleid', bt.splitGaps, [{ afterMinutes: 480, gapMinutes: 480 }]);
  const asgnP = back.assignments.filter((a) => a.taskId === bp.id);
  const late = asgnP.find((a) => a.unitsPerDay === 1)!;
  const cust = asgnP.find((a) => a.unitsPerDay === 0.5)!;
  eq('e18 LATE_PEAK komt als LATE_PEAK terug (exacte tabelmatch) mét de 21 waarden', [late.curve, late.curveValues], ['LATE_PEAK', CONTOUR_SHAPE_VALUES.LATE_PEAK]);
  eq('e19 eigen curve: geen OPS-vorm, wél de exacte waarden', [cust.curve, cust.curveValues], [undefined, custom]);
  ok('e20 taak zonder contour krijgt er geen', bp.timephasedContours === undefined);

  // Compat: een bestand van de oude OPS-schrijver droeg de curveNAAM in <PlannedCurve>.
  const legacy = xml.replace(/<ResourceCurveObjectId>\d+<\/ResourceCurveObjectId>/g, '').replace(/<PlannedCurve>[^<]*<\/PlannedCurve>/g, '<PlannedCurve>Bell Shaped</PlannedCurve>');
  const backLegacy = readP6XML(legacy);
  eq('e21 legacy curvenaam in PlannedCurve wordt nog als curve gelezen (alleen `a` droeg het element)',
    backLegacy.assignments.map((a) => a.curve), ['BELL', undefined, undefined]);
}

console.log('-- (e) IFC: contour-koppeling overleeft de resource-id-regeneratie --');
{
  const project = createDefaultProject();
  project.startDate = '2026-06-01';
  const t = task('t', '2026-06-01', '2026-06-03', 3, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r1', periods: [P(0, 480, 240), P(480, 960, 960)] }],
    resourceIds: ['r1'],
  });
  const resources = [res('r1', 1), res('r2', 1)];
  const assignments = [assign('a', 't', 'r2', 1), assign('b', 't', 'r1', 1)]; // r2 eerst: volgorde ≠ resource-volgorde
  const ifc = writeIFC({ project, calendar: CAL, tasks: [t], sequences: [], resources, assignments });
  const back = readIFC(ifc);
  const bt = back.tasks[0];
  const contour = bt.timephasedContours?.[0];
  const toR1 = back.assignments.find((a) => back.resources.find((r) => r.id === a.resourceId)?.name === 'r1');
  ok('e22 resource-ids zijn geregenereerd (de test toetst iets echts)', toR1 !== undefined && toR1.resourceId !== 'r1');
  eq('e23 contour.resourceId wijst na herladen naar de NIEUWE id van r1', contour?.resourceId, toR1?.resourceId);
  const m = matchContoursToAssignments(bt.timephasedContours, back.assignments.filter((a) => a.taskId === bt.id));
  eq('e24 koppeling landt op de r1-toewijzing, niet op de eerste', m.get(toR1!.id)?.periods.length, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) store: updateTask herschaalt de contour, een naam-/datumwijziging niet --');
{
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'contour-store', time: createDefaultTaskTime('2026-06-01', 3) });
  S().updateTask(id, {
    timephasedContours: [{ resourceUid: null, resourceId: 'r-x', periods: [P(0, 480, 240), P(480, 480, 0), P(960, 960, 960)] }],
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  const find = () => S().tasks.find((t) => t.id === id)!;
  S().updateTask(id, { name: 'hernoemd' });
  eq('d1 naamswijziging raakt de contour niet', find().timephasedContours?.[0].periods, [P(0, 480, 240), P(480, 480, 0), P(960, 960, 960)]);
  S().updateTask(id, { time: { ...find().time, scheduleStart: '2026-06-08' } });
  eq('d2 datumverschuiving raakt de contour niet (offset-as)', find().timephasedContours?.[0].periods[2], P(960, 960, 960));
  S().updateTask(id, { time: { ...find().time, scheduleDuration: 6 } });
  eq('d3 duur 3 → 6 dagen: periodes ×2', find().timephasedContours?.[0].periods, [P(0, 960, 480), P(960, 960, 0), P(1920, 1920, 1920)]);
  eq('d4 importsplits ×2 mee', find().splitGaps, [{ afterMinutes: 960, gapMinutes: 960 }]);
  S().undo();
  eq('d5 undo herstelt de oude contour', find().timephasedContours?.[0].periods[0], P(0, 480, 240));
  S().newProject();
}

// ═══════════════════════════════════════════════════════════════════════════
if (diffs.length > 0) {
  console.log(`XX contour-engine — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
console.log(`OK contour-engine: ${checks}/${checks} groen`);
