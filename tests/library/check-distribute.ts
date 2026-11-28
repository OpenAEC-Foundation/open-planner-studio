import { computeDistribution, type DistributionDocInput, type DistributionLevelRun, type DistributionShortfall } from '@/services/library/distribute';
import { computeLibraryOccupancy } from '@/services/library/occupancy';
import type { LevelingPoolLedger } from '@/engine/scheduler/ResourceLeveler';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';
import type { CompanyPool } from '@/types/library';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { neutralSolveOptions } from './neutralSolveOptions';
import { normalizeTaskDates } from '@/state/migrations/minuteModel';

declare const process: { exit(code: number): never };

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

function cal(id = 'cal-1'): WorkCalendar {
  return {
    id, name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
}
function poolRes(id: string, name: string, maxUnits: number, extra?: Partial<Resource>): Resource {
  return { id, name, type: 'LABOR', description: '', maxUnits, ...extra };
}
function stamped(id: string, libraryItemId: string, companyId = 'c1', extra?: Partial<Resource>): Resource {
  return {
    id, name: `kopie ${libraryItemId}`, type: 'LABOR', description: '', maxUnits: 99,
    libraryOrigin: { companyId, libraryItemId, poolVersion: 1 },
    ...extra,
  };
}
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
function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve };
}
function pool(resources: Resource[]): CompanyPool {
  return {
    companyId: 'c1', companyName: 'Bibliotheek 1', poolVersion: 1,
    modifiedAt: '2026-08-14T00:00:00.000Z', calendars: [], resources,
  };
}

interface DistDocOpts {
  companyId?: string | null;
  rank?: number;
  pinned?: boolean;
  datesAsRecorded?: boolean;
  ceilingWorkdays?: number | null;
  resources?: Resource[];
  assignments?: ResourceAssignment[];
  tasks?: Task[];
  sequences?: Sequence[];
  calendar?: WorkCalendar;
  scheduleStale?: boolean;
  omitSolveInput?: boolean;
}
function distDoc(docId: string, opts: DistDocOpts = {}): DistributionDocInput {
  const calendar = opts.calendar ?? cal();
  const tasks = opts.tasks ?? [];
  const sequences = opts.sequences ?? [];
  return {
    docId, title: `Project ${docId}`,
    scheduleStale: opts.scheduleStale ?? false,
    companyId: opts.companyId === undefined ? 'c1' : opts.companyId,
    resources: opts.resources ?? [],
    assignments: opts.assignments ?? [],
    tasks,
    calendar,
    calendars: [],
    loadOptions: neutralSolveOptions().schedulingOptions,
    ...(opts.omitSolveInput ? {} : { solveInput: { tasks, sequences, options: neutralSolveOptions() } }),
    rank: opts.rank ?? 1,
    pinned: opts.pinned ?? false,
    datesAsRecorded: opts.datesAsRecorded ?? false,
    ceilingWorkdays: opts.ceilingWorkdays ?? null,
    levelInput: { tasks, sequences, options: neutralSolveOptions() },
  };
}
const OPTS_OFF = { allowSplits: false };

console.log('-- distribute: float eerst, geen einddatum-kosten (case 1) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const taskZ = task('z', '2026-08-03', '2026-08-05', 3);
  const taskA = task('a', '2026-08-03', '2026-08-04', 2);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [taskZ, taskA],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [d0, d1], OPTS_OFF);
  assert(result.blocked === null, 'case 1: geen blokkade');
  const doc1 = result.docs.find(d => d.docId === 'd1')!;
  assert(doc1 !== undefined, 'case 1: d1 staat in het voorstel');
  assert(doc1.delays['a'] === 1, `case 1: A wijkt met precies 1 dag (kreeg ${JSON.stringify(doc1.delays)})`);
  assert(doc1.endShiftWorkdays === 0, `case 1: float wordt benut zonder einddatum-kosten (kreeg ${doc1.endShiftWorkdays})`);
}

console.log('-- distribute: rangorde gerespecteerd (case 2) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 2)],
  });
  const d1 = mk('d1', 1);
  const d2 = mk('d2', 2);
  const p2 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p2.docs.length === 2, 'case 2: twee deelnemers in het voorstel');
  assert(JSON.stringify(p2.docs[0].delays) === '{}', `case 2: nr. 1 blijft staan (kreeg ${JSON.stringify(p2.docs[0].delays)})`);
  assert(Object.keys(p2.docs[1].delays).length > 0, 'case 2: nr. 2 wijkt om nr. 1 heen');
}

console.log('-- distribute: rangorde is de fairness-knop (case 3) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 2)],
  });
  const normal = computeDistribution('c1', p, 'lib-1', [mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  const reversed = computeDistribution('c1', p, 'lib-1', [mk('d1', 2), mk('d2', 1)], OPTS_OFF);
  const wijktNormal = normal.docs.find(d => Object.keys(d.delays).length > 0)?.docId;
  const wijktReversed = reversed.docs.find(d => Object.keys(d.delays).length > 0)?.docId;
  assert(wijktNormal === 'd2', `case 3: bij normale rangorde wijkt d2 (kreeg ${wijktNormal})`);
  assert(wijktReversed === 'd1', `case 3: bij omgedraaide rangorde wijkt d1 (kreeg ${wijktReversed})`);
}

console.log('-- distribute: plafonds zijn hard (case 4) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-04', 2)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 2)],
  });
  const d2 = distDoc('d2', {
    rank: 2, ceilingWorkdays: 1,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1, { deadline: '2026-08-03' })],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 2)],
  });
  const p4 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p4.docs[0].docId === 'd1' && p4.docs[0].shortfalls.length === 0, 'case 4: d1 (rank1) plaatst zonder tekort');
  assert(p4.docs[1].docId === 'd2', 'case 4: d2 staat op index 1');
  assert(p4.docs[1].shortfalls.length > 0, 'case 4: d2 houdt een tekort over');
  assert(
    p4.docs[1].shortfalls[0]?.reason === 'RESIDUAL_FULL',
    `case 4: reden is RESIDUAL_FULL — het is de pool, niet d2 se eigen plafond (kreeg ${p4.docs[1].shortfalls[0]?.reason})`,
  );
  assert(p4.hasShortfall === true, 'case 4: hasShortfall staat');
}

console.log('-- distribute: CEILING_TOO_TIGHT blijft bestaan zonder pool-blokkade (case 4b) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 5)]);
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 0,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [
      task('a1', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('a2', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-08-03' }),
    ],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1), assign('d1-a2', 'a2', 'd1-r1', 1)],
  });
  const p4b = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  const shortfallA2 = p4b.docs[0].shortfalls.find(s => s.taskId === 'a2');
  assert(
    shortfallA2?.reason === 'CEILING_TOO_TIGHT',
    `case 4b: zonder pool-blokkade blijft het eigen plafond de reden (kreeg ${shortfallA2?.reason})`,
  );
}

console.log('-- distribute: plafond t.o.v. de huidige (genivelleerde) planning (case 5) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-06', '2026-08-06', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const mkD1 = (ceilingWorkdays: number) => {
    const taskX = task('x', '2026-08-03', '2026-08-03', 1, { levelingDelay: 2 });
    const taskA = task('a', '2026-08-06', '2026-08-06', 1);
    const seq: Sequence = { id: 'seq-xa', predecessorId: 'x', successorId: 'a', type: 'FINISH_START', lagDays: 0 };
    return distDoc('d1', {
      rank: 1, ceilingWorkdays,
      resources: [stamped('d1-r1', 'lib-1')],
      tasks: [taskX, taskA],
      sequences: [seq],
      assignments: [assign('d1-a1', 'a', 'd1-r1', 2)],
    });
  };
  const p5a = computeDistribution('c1', p, 'lib-1', [d0, mkD1(0)], OPTS_OFF);
  const p5b = computeDistribution('c1', p, 'lib-1', [d0, mkD1(1)], OPTS_OFF);
  const doc5a = p5a.docs.find(d => d.docId === 'd1')!;
  const doc5b = p5b.docs.find(d => d.docId === 'd1')!;
  assert(doc5a.shortfalls.length > 0, 'case 5: plafond 0 (geen ruimte) ⇒ tekort');
  assert(doc5b.shortfalls.length === 0 && doc5b.delays['a'] === 1, `case 5: plafond 1 past precies (kreeg ${JSON.stringify(doc5b.delays)}, tekorten ${JSON.stringify(doc5b.shortfalls)})`);
}

console.log('-- distribute: onbereikbaar plafond door een deadline (case 6) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 5,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [
      task('d', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('c', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-06-01' }),
    ],
    assignments: [assign('d1-a1', 'd', 'd1-r1', 2), assign('d1-a2', 'c', 'd1-r1', 2)],
  });
  const p6 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  const doc6 = p6.docs[0];
  assert(doc6.delays['d'] === undefined, 'case 6: D (hoogste prioriteit) plaatst zonder delay');
  const shortfallC = doc6.shortfalls.find(s => s.taskId === 'c');
  assert(shortfallC?.reason === 'CEILING_UNREACHABLE', `case 6: onbereikbaar plafond ⇒ eigen reden (kreeg ${shortfallC?.reason})`);
}

console.log('-- distribute: gepind document (case 7) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const p7 = computeDistribution('c1', p, 'lib-1', [d0], OPTS_OFF);
  assert(p7.docs.length === 1, 'case 7: het gepinde document staat in het voorstel');
  assert(JSON.stringify(p7.docs[0].delays) === '{}', 'case 7: gepind document doet niet mee');
  assert(p7.docs[0].participated === false && p7.docs[0].pinnedReason === 'pin', 'case 7: pinnedReason is "pin"');
  assert((p7.fixedLoadByDay['2026-08-03'] ?? 0) > 0, `case 7: maar bezet het profiel wél (kreeg ${p7.fixedLoadByDay['2026-08-03']})`);
}

console.log('-- distribute: document kan niet wijken, maar meldt zijn tekort (case 8 / 760) --');
for (const capacity of [1, 2]) {
  const p = pool([poolRes('lib-1', 'Kraan', capacity)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const d2 = distDoc('d2', {
    rank: 2,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1, { priority: 1000 })],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 1)],
  });
  const p8 = computeDistribution('c1', p, 'lib-1', [d1, d2], OPTS_OFF);
  assert(p8.docs[0].docId === 'd1' && p8.docs[0].cannotMove === false, 'case 8: d1 (rank1) is gewoon movable');
  assert(p8.docs[1].docId === 'd2', 'case 8: d2 staat op index 1');
  assert(p8.docs[1].cannotMove === true, `case 8: document kan niet wijken (kreeg ${p8.docs[1].cannotMove})`);
  assert(p8.hasShortfall === (capacity === 1), '760: een vastgepind document moet dezelfde poolcapaciteit respecteren');
  assert(p8.afterIncomplete === p8.hasShortfall, '760: het voorstel vermeldt dat het niet past');
  assert(Object.keys(p8.docs[1].delays).length === 0, '760: de pin krijgt geen capaciteitsvertraging');
  if (capacity === 1) {
    assert(p8.docs[1].shortfalls.some(s => s.taskId === 'a2' && s.days.includes('2026-08-03')), '760: het tekort noemt de vaste taak en haar conflictdag');
  }
}

console.log('-- distribute: min met de projectinzet (case 9) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [
      task('a1', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('a2', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-08-03' }),
    ],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1), assign('d1-a2', 'a2', 'd1-r1', 1)],
  });
  const p9 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  assert(p9.docs[0].delays['a2'] === 1, `case 9: A2 wijkt om de eigen (krappere) projectinzet heen (kreeg ${JSON.stringify(p9.docs[0].delays)})`);
  const shortfallA2 = p9.docs[0].shortfalls.find(s => s.taskId === 'a2');
  assert(shortfallA2 === undefined || shortfallA2.reason !== 'RESIDUAL_FULL', 'case 9: nooit RESIDUAL_FULL — de pool zelf had ruimte');
}

console.log('-- distribute: gedeeld grootboek binnen één document (case 10) --');
{
  const p10pool = pool([poolRes('lib-1', 'Kraan', 1)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1'), stamped('d1-r2', 'lib-1')],
    tasks: [
      task('a', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('b', '2026-08-03', '2026-08-03', 1, { priority: 100 }),
    ],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1), assign('d1-a2', 'b', 'd1-r2', 1)],
  });
  const p10 = computeDistribution('c1', p10pool, 'lib-1', [d1], OPTS_OFF);
  assert(p10.docs[0].delays['a'] === undefined, 'case 10: A plaatst zonder delay (eerst in de rij)');
  assert(p10.docs[0].delays['b'] === 1, `case 10: gedeeld grootboek — B wijkt één dag (kreeg ${JSON.stringify(p10.docs[0].delays)})`);
}

console.log('-- distribute: som van plafonds ≠ oplossing (case 11) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-07', 5)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const mk = (id: string, rank: number) => distDoc(id, {
    rank, ceilingWorkdays: 1,
    resources: [stamped(`${id}-r1`, 'lib-1')],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1, { deadline: '2026-08-03' })],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const p11 = computeDistribution('c1', p, 'lib-1', [d0, mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  assert(p11.hasShortfall === true, 'case 11: hasShortfall staat');
  const part = p11.docs.filter(d => d.participated);
  assert(part.length === 2 && part.every(d => d.shortfalls.length > 0), 'case 11: BEIDE documenten houden een tekort — geen som-shortcut');
}

console.log('-- distribute: tekort cascadeert niet (case 12) --');
{
  const p12pool = pool([poolRes('lib-1', 'Kraan', 1)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const d2 = distDoc('d2', {
    rank: 2,
    resources: [stamped('d2-r1', 'lib-1')],
    tasks: [task('a2', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d2-a1', 'a2', 'd2-r1', 3)],
  });
  const d3 = distDoc('d3', {
    rank: 3,
    resources: [stamped('d3-r1', 'lib-1')],
    tasks: [task('a3', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d3-a1', 'a3', 'd3-r1', 1)],
  });
  const withShortfallDoc = computeDistribution('c1', p12pool, 'lib-1', [d1, d2, d3], OPTS_OFF);
  const withoutShortfallDoc = computeDistribution('c1', p12pool, 'lib-1', [d1, d3], OPTS_OFF);

  const d2Result = withShortfallDoc.docs.find(d => d.docId === 'd2')!;
  assert(d2Result.shortfalls.length > 0, 'case 12: d2 (intrinsiek onoplosbaar) houdt een tekort');

  const d3With = withShortfallDoc.docs.find(d => d.docId === 'd3')!;
  const d3Without = withoutShortfallDoc.docs.find(d => d.docId === 'd3')!;
  assert(
    JSON.stringify(d3With.delays) === JSON.stringify(d3Without.delays),
    `case 12: geen cascade — d3 krijgt dezelfde plaatsing mét/zonder het tekortdocument (met: ${JSON.stringify(d3With.delays)}, zonder: ${JSON.stringify(d3Without.delays)})`,
  );
  assert(Object.keys(d3With.delays).length > 0, 'case 12 sanity: d3 wijkt daadwerkelijk (anders test dit niets)');
  for (const v of Object.values(withShortfallDoc.residualByDay)) {
    assert(v >= 0, `case 12: restprofiel blijft altijd >= 0 (kreeg ${v})`);
  }
}

console.log('-- distribute: #63 is impliciet gepind (case 13) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    datesAsRecorded: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 1)],
  });
  const p13 = computeDistribution('c1', p, 'lib-1', [d0], OPTS_OFF);
  assert(p13.docs[0]?.pinnedReason === 'dates-as-recorded', `case 13: #63 is impliciet gepind (kreeg ${p13.docs[0]?.pinnedReason})`);
  assert(JSON.stringify(p13.docs[0]?.delays) === '{}', 'case 13: #63-document wordt nooit beschreven');
}

console.log('-- distribute: uncounted blokkeert de hele actie (case 14) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const staleDoc = distDoc('doc-stale', {
    scheduleStale: true, omitSolveInput: true,
    resources: [stamped('ds-r1', 'lib-1')],
    tasks: [task('ds-t1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('ds-a1', 'ds-t1', 'ds-r1', 1)],
  });
  const okDoc = distDoc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const p14 = computeDistribution('c1', p, 'lib-1', [staleDoc, okDoc], OPTS_OFF);
  assert(p14.blocked?.reason === 'UNCOUNTED_DOCUMENT', `case 14: uncounted blokkeert (kreeg ${p14.blocked?.reason})`);
  assert(JSON.stringify(p14.blocked?.docIds) === JSON.stringify(['doc-stale']), `case 14: en noemt welk document (kreeg ${JSON.stringify(p14.blocked?.docIds)})`);
  assert(p14.docs.length === 0, 'case 14: en levert geen voorstel');
}

console.log('-- distribute: onderbreek-modus schrijft geldige splitGaps (case 15) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 1)]);
  const blocker = task('x0', '2026-08-03', '2026-08-05', 3, {
    priority: 900,
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [blocker],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 1)],
  });
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 3,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('b', '2026-08-03', '2026-08-04', 2, { deadline: '2026-08-04' })],
    assignments: [assign('d1-a1', 'b', 'd1-r1', 1)],
  });
  const p15 = computeDistribution('c1', p, 'lib-1', [d0, d1], { allowSplits: true });
  const doc15 = p15.docs.find(d => d.docId === 'd1')!;
  const gaps = doc15.gaps['b'];
  assert(!!gaps && gaps.length === 1 && gaps[0].source === 'leveling', `case 15: het voorstel draagt precies één leveling-gat (kreeg ${JSON.stringify(gaps)})`);

  const fixture: ImportResult = {
    project: createDefaultProject(),
    calendar: createDefaultCalendar(),
    tasks: [task('rt', '2026-08-03', '2026-08-04', 2, { splitGaps: gaps })],
    sequences: [], resources: [], assignments: [],
  };
  const back = readIFC(writeIFC(fixture));
  assert(
    JSON.stringify(back.tasks[0]?.splitGaps) === JSON.stringify(gaps),
    `case 15: het leveling-gat (incl. herkomstveld) overleeft de IFC-round-trip (kreeg ${JSON.stringify(back.tasks[0]?.splitGaps)}, verwacht ${JSON.stringify(gaps)})`,
  );
}

console.log('-- distribute: MATERIAL-poolitem blokkeert de hele actie (case 16, bevinding 1) --');
{
  const p = pool([poolRes('lib-mat', 'Beton', 1, { type: 'MATERIAL' })]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-mat', 'c1', { type: 'MATERIAL' })],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const p16 = computeDistribution('c1', p, 'lib-mat', [mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  assert(p16.blocked?.reason === 'MATERIAL_ITEM', `case 16: MATERIAL-poolitem blokkeert (kreeg ${p16.blocked?.reason})`);
  assert(p16.docs.length === 0, 'case 16: en levert geen leeg "opgelost"-voorstel');
  assert(
    JSON.stringify([...(p16.blocked?.docIds ?? [])].sort()) === JSON.stringify(['d1', 'd2']),
    `case 16: noemt beide documenten die er al op boeken (kreeg ${JSON.stringify(p16.blocked?.docIds)})`,
  );
}

console.log('-- distribute: NO_DEMAND is het algemenere vangnet naast MATERIAL_ITEM (case 17, bevinding 1) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { type: 'MATERIAL' })],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  const p17 = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  assert(p17.blocked?.reason === 'NO_DEMAND', `case 17: algemener vangnet blokkeert (kreeg ${p17.blocked?.reason})`);
  assert(p17.docs.length === 0, 'case 17: en levert geen leeg "opgelost"-voorstel');
}

console.log('-- distribute: het poolitem-grootboek boekt PER ITEM (bevinding 6) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [task('a1', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1)],
  });
  let capturedLedger: LevelingPoolLedger | undefined;
  const stubRun: DistributionLevelRun = (_doc, options) => {
    capturedLedger = options.poolLedger;
    return {
      delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {},
      projectEndBefore: '2026-08-03', projectEndAfter: '2026-08-03', gaps: {},
    };
  };
  computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF, stubRun);
  const l = capturedLedger!;
  assert(l !== undefined, 'bevinding 6: de motor-run kreeg een poolLedger mee');
  const before = l.residualOn('lib-1', '2026-08-03');
  l.book('een-ander-item', '2026-08-03', 99);
  assert(
    l.residualOn('lib-1', '2026-08-03') === before,
    'bevinding 6: een boeking op een ANDER itemId raakt dit poolitem niet',
  );
}

console.log('-- distribute: afterLoadByDay + residualByDay = capaciteit (taak 11a) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const taskZ = task('z', '2026-08-03', '2026-08-05', 3);
  const taskA = task('a', '2026-08-03', '2026-08-04', 2);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [taskZ, taskA],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [d0, d1], OPTS_OFF);
  const poolItem = p.resources[0];
  const docIds = result.docs.map(d => d.docId);
  for (const iso of Object.keys(result.residualByDay)) {
    const sumAfter = docIds.reduce((sum, id) => sum + (result.afterLoadByDay[id]?.[iso] ?? 0), 0);
    const cap = maxUnitsOn(poolItem, iso);
    assert(
      sumAfter + result.residualByDay[iso] === cap,
      `taak 11a: dag ${iso}: Σafter (${sumAfter}) + rest (${result.residualByDay[iso]}) !== capaciteit (${cap})`,
    );
  }
  assert(
    JSON.stringify(result.afterLoadByDay['d0']) === JSON.stringify(result.bookingByDay['d0']),
    `taak 11b: gepind document staat ongewijzigd in de na-stand (na: ${JSON.stringify(result.afterLoadByDay['d0'])}, voor: ${JSON.stringify(result.bookingByDay['d0'])})`,
  );
}

console.log('-- distribute: tekort ⇒ afterIncomplete en ontbrekende vraag (taak 11c) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d1 = distDoc('d1', {
    rank: 1, ceilingWorkdays: 0,
    resources: [stamped('d1-r1', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [
      task('a1', '2026-08-03', '2026-08-03', 1, { priority: 900 }),
      task('a2', '2026-08-03', '2026-08-03', 1, { priority: 100, deadline: '2026-08-03' }),
    ],
    assignments: [assign('d1-a1', 'a1', 'd1-r1', 1), assign('d1-a2', 'a2', 'd1-r1', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  const shortfallA2 = result.docs[0].shortfalls.find(s => s.taskId === 'a2');
  assert(
    shortfallA2?.reason === 'CEILING_TOO_TIGHT',
    `taak 11c sanity: tekort door het eigen plafond, niet door de pool (kreeg ${shortfallA2?.reason})`,
  );
  assert(result.hasShortfall === true, 'taak 11c sanity: hasShortfall staat');
  assert(result.afterIncomplete === true, `taak 11c: afterIncomplete volgt hasShortfall (kreeg ${result.afterIncomplete})`);
  const poolItem = p.resources[0];
  const conflictIso = '2026-08-03';
  const sumAfter = result.docs.reduce((sum, d) => sum + (result.afterLoadByDay[d.docId]?.[conflictIso] ?? 0), 0);
  const cap = maxUnitsOn(poolItem, conflictIso);
  assert(sumAfter < cap, `taak 11c: de niet-geplaatste vraag (a2) ontbreekt uit afterLoadByDay — som (${sumAfter}) < capaciteit (${cap})`);
}

console.log('-- distribute: blocked-voorstel ⇒ bookingByDay/afterLoadByDay leeg (taak 11d) --');
{
  const p = pool([poolRes('lib-mat', 'Beton', 1, { type: 'MATERIAL' })]);
  const mk = (id: string, rank: number) => distDoc(id, {
    rank,
    resources: [stamped(`${id}-r1`, 'lib-mat', 'c1', { type: 'MATERIAL' })],
    tasks: [task(`${id}-t1`, '2026-08-03', '2026-08-03', 1)],
    assignments: [assign(`${id}-a1`, `${id}-t1`, `${id}-r1`, 1)],
  });
  const result = computeDistribution('c1', p, 'lib-mat', [mk('d1', 1), mk('d2', 2)], OPTS_OFF);
  assert(result.blocked?.reason === 'MATERIAL_ITEM', 'taak 11d sanity: geblokkeerd (zelfde fixture als case 16)');
  assert(JSON.stringify(result.bookingByDay) === '{}', `taak 11d: bookingByDay is leeg bij blokkade (kreeg ${JSON.stringify(result.bookingByDay)})`);
  assert(JSON.stringify(result.afterLoadByDay) === '{}', `taak 11d: afterLoadByDay is leeg bij blokkade (kreeg ${JSON.stringify(result.afterLoadByDay)})`);
  assert(result.afterIncomplete === false, 'taak 11d: afterIncomplete is false bij blokkade');
}

console.log('-- distribute: bookingByDay bevat elk boekend document, gelijk aan de bezetting (taak 11e) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 2)]);
  const d0 = distDoc('d0', {
    pinned: true,
    resources: [stamped('d0-r1', 'lib-1')],
    tasks: [task('x0', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('d0-a1', 'x0', 'd0-r1', 2)],
  });
  const taskZ = task('z', '2026-08-03', '2026-08-05', 3);
  const taskA = task('a', '2026-08-03', '2026-08-04', 2);
  const d1 = distDoc('d1', {
    rank: 1,
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [taskZ, taskA],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [d0, d1], OPTS_OFF);
  const { rows } = computeLibraryOccupancy('c1', p, [d0, d1]);
  const row = rows.find(r => r.libraryItemId === 'lib-1')!;
  assert(row.docs.length > 0, 'taak 11e sanity: er boeken documenten op dit poolitem');
  for (const booking of row.docs) {
    assert(
      JSON.stringify(result.bookingByDay[booking.docId]) === JSON.stringify(booking.dailyLoad),
      `taak 11e: bookingByDay['${booking.docId}'] == row.docs[].dailyLoad (kreeg ${JSON.stringify(result.bookingByDay[booking.docId])}, verwacht ${JSON.stringify(booking.dailyLoad)})`,
    );
  }
}

console.log('-- distribute: na-boeking buiten de voor-dagen, endShiftWorkdays is geen maat (case 18) --');
for (const manual of [true, false]) {
  const p = pool([poolRes('lib-1', 'Gedeelde kraan', 1)]);
  const mk = (docId: string, rank: number): DistributionDocInput => {
    const t = normalizeTaskDates(task(`${docId}-t1`, '2026-09-07', '2026-09-18', 10, { manuallyScheduled: manual }),
      { calendar: cal(), calendars: [] });
    return distDoc(docId, {
      rank,
      resources: [stamped(`${docId}-r1`, 'lib-1')],
      tasks: [t],
      assignments: [assign(`${docId}-a1`, t.id, `${docId}-r1`, 1)],
    });
  };
  const label = `case 18 (manuallyScheduled=${manual})`;
  const result = computeDistribution('c1', p, 'lib-1', [mk('A', 1), mk('B', 2)], OPTS_OFF);
  assert(result.blocked === null, `${label}: geen blokkade`);

  const docB = result.docs.find(d => d.docId === 'B')!;
  assert(docB !== undefined && docB.participated, `${label}: B doet mee als deelnemer`);
  if (manual) {
    assert(Object.keys(docB.delays).length === 0, `${label}: geen vertraging op handmatige taken`);
    assert(docB.shortfalls.length > 0 && result.hasShortfall, `${label}: vaste botsing blijft zichtbaar`);
    assert(docB.endShiftWorkdays === 0, `${label}: projecteinde blijft vast`);
    assert(JSON.stringify(result.afterLoadByDay.B) === JSON.stringify(result.bookingByDay.B), `${label}: boeking blijft op haar echte dagen`);
    continue;
  }
  assert(docB.shortfalls.length === 0, `${label}: B is geplaatst, dus geen tekort (kreeg ${JSON.stringify(docB.shortfalls)})`);
  assert(result.hasShortfall === false, `${label}: geen tekort in het voorstel`);

  const before = result.bookingByDay['B'] ?? {};
  const after = result.afterLoadByDay['B'] ?? {};
  const sum = (m: Record<string, number>): number => Object.values(m).reduce((n, v) => n + v, 0);
  assert(Object.keys(after).length > 0, `${label}: afterLoadByDay['B'] is NIET leeg — een geplaatste boeking mag niet stil verdwijnen`);
  assert(sum(after) === sum(before), `${label}: B houdt zonder tekort exact evenveel werk (voor ${sum(before)}, na ${sum(after)})`);

  const beforeDays = new Set([...Object.keys(result.fixedLoadByDay), ...Object.values(result.bookingByDay).flatMap(m => Object.keys(m))]);
  assert(
    Object.keys(after).every(iso => !beforeDays.has(iso)),
    `${label}: B's na-dagen vallen buiten de voor-dagen (na ${JSON.stringify(Object.keys(after))})`,
  );

  assert(
    docB.endShiftWorkdays === (manual ? 0 : 10),
    `${label}: endShiftWorkdays is ${manual ? 0 : 10} (kreeg ${docB.endShiftWorkdays}) — een handmatig geplande taak schuift haar einddatum niet op`,
  );
  assert(docB.delays['B-t1'] === 10, `${label}: de boeking schuift wél tien werkdagen (kreeg ${JSON.stringify(docB.delays)})`);
}

console.log('-- distribute: samenvattingsrelatie wordt uitgeklapt (audit 2026-09-26) --');
{
  const p = pool([poolRes('lib-1', 'Kraan', 1)]);
  const summary = task('s', '2026-08-03', '2026-08-07', 5, { childIds: ['a'] });
  const taskA = task('a', '2026-08-03', '2026-08-07', 5, { parentId: 's', priority: 400 });
  const taskB = task('b', '2026-08-10', '2026-08-10', 1, { priority: 600 });
  const d1 = distDoc('d1', {
    resources: [stamped('d1-r1', 'lib-1')],
    tasks: [summary, taskA, taskB],
    sequences: [{ id: 'sb', predecessorId: 's', successorId: 'b', type: 'FINISH_START', lagDays: 0 }],
    assignments: [assign('d1-a1', 'a', 'd1-r1', 1), assign('d1-a2', 'b', 'd1-r1', 1)],
  });
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); };
  let result: ReturnType<typeof computeDistribution>;
  try {
    result = computeDistribution('c1', p, 'lib-1', [d1], OPTS_OFF);
  } finally {
    console.warn = origWarn;
  }
  const dropped = warnings.filter(w => w.includes('genegeerd'));
  assert(dropped.length === 0, `samenvattingsrelatie: de leveler negeert geen relatie (kreeg ${dropped.join(' | ')})`);
  const doc = result.docs.find(d => d.docId === 'd1');
  assert(doc !== undefined, 'samenvattingsrelatie: d1 in het voorstel');
  assert(JSON.stringify(doc?.delays) === '{}', `samenvattingsrelatie: geen onterechte vertraging (kreeg ${JSON.stringify(doc?.delays)})`);
  assert(!result.hasShortfall, 'samenvattingsrelatie: geen tekort');
}

{
  const p = pool([poolRes('lib-1', 'Kraan', 1)]);
  const doc = distDoc('pins', {
    resources: [stamped('r', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [task('pin-a', '2026-08-03', '2026-08-03', 1, { priority: 1000 }),
      task('pin-b', '2026-08-03', '2026-08-03', 1, { priority: 1000 }),
      task('movable', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('a', 'pin-a', 'r', 1), assign('b', 'pin-b', 'r', 1), assign('c', 'movable', 'r', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [doc], OPTS_OFF);
  const shortfalls = result.docs[0].shortfalls;
  assert(result.hasShortfall, '322 pinconflicten maken het voorstel niet conflictvrij');
  assert(shortfalls.length === 2, '322 beide pins houden een tekort');
  for (const id of ['pin-a', 'pin-b']) {
    const shortfall = shortfalls.find(s => s.taskId === id);
    assert(shortfall?.reason === undefined, '322 geen verzonnen zoekreden voor een pin');
    const expected: DistributionShortfall = { taskId: id, days: ['2026-08-03'] };
    assert(JSON.stringify(shortfall) === JSON.stringify(expected), '322 conflictdag en optioneel redencontract blijven beschikbaar');
  }
}

console.log('-- distribute: twee projectresources op hetzelfde item tellen samen (349) --');
for (const allowSplits of [false, true]) {
  const p = pool([poolRes('lib-1', 'Gedeelde kraan', 1)]);
  const doc = distDoc('dubbele-koppeling', {
    resources: [stamped('r1', 'lib-1', 'c1', { maxUnits: 1 }), stamped('r2', 'lib-1', 'c1', { maxUnits: 1 })],
    tasks: [task('dubbele-vraag', '2026-08-03', '2026-08-03', 1)],
    assignments: [assign('a1', 'dubbele-vraag', 'r1', 1), assign('a2', 'dubbele-vraag', 'r2', 1)],
  });
  const result = computeDistribution('c1', p, 'lib-1', [doc], { allowSplits });
  assert(result.blocked === null, '349: invoer is geldig');
  assert(result.hasShortfall && result.afterIncomplete, '349: twee op capaciteit één blijft een tekort');
  assert(result.docs[0].shortfalls.some(s => s.taskId === 'dubbele-vraag'), '349: tekort noemt de taak');
  assert(Object.values(result.afterLoadByDay['dubbele-koppeling'] ?? {}).every(v => v <= 1), '349: geen verborgen overboeking');
}

if (fails === 0) {
  console.log(`OK  distribute: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  distribute: ${fails} afwijking(en) van ${checks}`);
  process.exit(1);
}
