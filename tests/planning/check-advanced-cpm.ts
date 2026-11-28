import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import { CPMSolver, type CPMResult, type CPMOptions } from '@/engine/scheduler/CPMSolver';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { Task, TaskConstraint, ExternalLink } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { FILTER_SORT_BUILTIN_KEYS, fieldKind, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';
import type { FieldRef, BuiltinFieldKey } from '@/types/view';
import { validateConstraintPair } from '@/engine/scheduler/constraintValidation';
import { refreshExternalAnchors, externalSourceSide, type ExternalSourceDoc } from '@/engine/externalLinks';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import { legacyCpmOptions, legacyEffective } from './legacySolveOptions';

const diffs: string[] = [];
let checks = 0;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const CAL: WorkCalendar = {
  id: 'c', name: 'c', description: 'c',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

function mkTask(id: string, dur: number, extra: Partial<Task> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime('2026-06-01', dur), resourceIds: [],
    ...extra,
  };
}
function fs(id: string, pred: string, succ: string): Sequence {
  return { id, predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays: 0 };
}
function solve(tasks: Task[], seqs: Sequence[], opts: CPMOptions = legacyCpmOptions()): CPMResult {
  for (const task of tasks) Object.assign(task, normalizeTaskDates(task, { calendar: CAL, calendars: [] }));
  return new CPMSolver(tasks, seqs, CAL, [], opts).solve();
}

function digest(r: CPMResult): string {
  const tasks = [...r.tasks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, t]) => [
    id, t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish, t.totalFloat, t.freeFloat, t.isCritical,
  ]);
  return JSON.stringify({
    tasks, cp: r.criticalPath, pe: r.projectEnd, pd: r.projectDuration,
    drv: [...r.drivingSequenceIds].sort(), viol: [...r.violatedConstraintTaskIds].sort(),
  });
}

const netA: Task[] = [mkTask('A1', 5), mkTask('A2', 4), mkTask('A3', 2), mkTask('END', 1)];
const seqA: Sequence[] = [fs('s1', 'A1', 'END'), fs('s2', 'A2', 'END'), fs('s3', 'A3', 'END')];
const rA = solve(netA, seqA);

eq('01 FILTER_SORT bevat freeFloat', FILTER_SORT_BUILTIN_KEYS.includes('freeFloat'), true);
eq('02 FILTER_SORT bevat interferingFloat', FILTER_SORT_BUILTIN_KEYS.includes('interferingFloat'), true);
eq('03 FILTER_SORT bevat isNearCritical', FILTER_SORT_BUILTIN_KEYS.includes('isNearCritical'), true);
eq('04 FILTER_SORT bevat floatPath', FILTER_SORT_BUILTIN_KEYS.includes('floatPath'), true);
const dummyCtx = { customFieldDefs: [] } as unknown as FieldCatalogCtx;
const bk = (key: BuiltinFieldKey): FieldRef => ({ src: 'builtin', key });
eq('05 fieldKind freeFloat = number', fieldKind(bk('freeFloat'), dummyCtx), 'number');
eq('06 fieldKind interferingFloat = number', fieldKind(bk('interferingFloat'), dummyCtx), 'number');
eq('07 fieldKind isNearCritical = boolean', fieldKind(bk('isNearCritical'), dummyCtx), 'boolean');
eq('08 fieldKind floatPath = number', fieldKind(bk('floatPath'), dummyCtx), 'number');

const cpmResultSection = readFileSync(join(ROOT, 'src/components/task-sections/TaskCpmResultSection.tsx'), 'utf8');
eq('08a CPM-paneel toont totale, vrije en interfererende speling via de gedeelde opmaak',
  ['totalFloat', 'freeFloat', 'interferingFloat'].every(f => cpmResultSection.includes(`{days(task.time.${f})}`))
    && /formatWorkDaysText\(/.test(cpmResultSection), true);
eq('08b CPM-paneel toont geen ruwe of eigen afgeronde speling meer',
  /\{(Math\.round\()?task\.time\.(totalFloat|freeFloat|interferingFloat)\)?\}/.test(cpmResultSection), false);

eq('09 criticalPaths lengte precies 1 (floatPaths uit)', rA.criticalPaths.length, 1);
eq('10 criticalPaths[0] == criticalPath', JSON.stringify(rA.criticalPaths[0]), JSON.stringify(rA.criticalPath));
eq('11 nearCriticalTaskIds leeg (drempel ongezet)', rA.nearCriticalTaskIds.length, 0);
eq('12 floatPathByTask leeg (floatPaths uit)', Object.keys(rA.floatPathByTask).length, 0);
eq('13 net A niet-triviaal (criticalPath bevat A1)', rA.criticalPath.includes('A1'), true);

const all = [...rA.tasks.values()];
eq('14 elke taak interferingFloat === tf−ff (golf 2: altijd berekend)',
  all.every(t => t.interferingFloat === t.totalFloat - t.freeFloat), true);
eq('15 elke taak isNearCritical === undefined (geen drempel)', all.every(t => t.isNearCritical === undefined), true);
eq('16 elke taak floatPath === undefined (floatPaths uit)', all.every(t => t.floatPath === undefined), true);

const rNone = solve(netA, seqA);
const rEmptyOpts = solve(netA, seqA, { schedulingOptions: legacyEffective({}) });
const rFullDefaults = solve(netA, seqA, {
  schedulingOptions: legacyEffective({ lagCalendar: 'predecessor', criticalDefinition: { mode: 'totalFloat', threshold: 0 }, totalFloatMode: 'smallest' }),
});
eq('17 leeg schedulingOptions ⇒ byte-identieke solve', digest(rEmptyOpts), digest(rNone));
eq('18 default-waarden-blok ⇒ byte-identieke solve', digest(rFullDefaults), digest(rNone));

const snet: TaskConstraint = { type: 'SNET', date: '2026-06-10' };
const netB: Task[] = [mkTask('P', 2), mkTask('Q', 3, { constraint: snet })];
const seqB: Sequence[] = [fs('b1', 'P', 'Q')];
const netBdecor: Task[] = [
  mkTask('P', 2, { isHammock: false, externalLinks: [] }),
  mkTask('Q', 3, {
    constraint: { type: 'SNET', date: '2026-06-10', hard: true },
    constraint2: { type: 'FNLT', date: '2026-06-30' },
    isHammock: false,
    externalLinks: [{
      id: 'x1', direction: 'predecessor', relType: 'FS', anchorDate: '2026-05-20',
      sourceRef: { projectId: 'p2', taskId: 't9' }, sourceMissing: true,
    }],
  }),
];
eq('19 2.9-taakvelden aanwezig ⇒ byte-identieke solve (inert)', digest(solve(netBdecor, seqB)), digest(solve(netB, seqB)));

const cyc: Task[] = [mkTask('U', 1), mkTask('V', 1)];
const seqCyc: Sequence[] = [fs('c1', 'U', 'V'), fs('c2', 'V', 'U')];
const rErr = solve(cyc, seqCyc);
eq('20 cyclus ⇒ error gezet', typeof rErr.error === 'string' && rErr.error.length > 0, true);
eq('21 error-result: criticalPaths aanwezig, lengte 1', rErr.criticalPaths.length, 1);
eq('22 error-result: nearCriticalTaskIds/floatPathByTask leeg',
  rErr.nearCriticalTaskIds.length === 0 && Object.keys(rErr.floatPathByTask).length === 0, true);

const c = (type: string, extra: Partial<TaskConstraint> = {}): TaskConstraint =>
  ({ type: type as TaskConstraint['type'], date: '2026-06-03', ...extra });
eq('23 geen secundair ⇒ ok', validateConstraintPair(c('SNET'), undefined).ok, true);
eq('24 SNET+FNLT (S9-venster) ⇒ ok', validateConstraintPair(c('SNET'), c('FNLT')).ok, true);
eq('25 FNET+SNLT (finish-onder + start-boven) ⇒ ok', validateConstraintPair(c('FNET'), c('SNLT')).ok, true);
eq('26 MSO-primair + secundair ⇒ verboden',
  validateConstraintPair(c('MSO'), c('FNLT')).issues.includes('no-secondary-with-mandatory-or-on'), true);
eq('27 harde primaire pin + secundair ⇒ verboden',
  validateConstraintPair(c('MSO', { hard: true }), c('FNLT')).issues.includes('no-secondary-with-mandatory-or-on'), true);
eq('28 secundair.hard ⇒ verboden',
  validateConstraintPair(c('SNET'), c('FNLT', { hard: true })).issues.includes('secondary-hard-forbidden'), true);
eq('29 twee gelijksoortige grenzen (SNET+FNET) ⇒ verboden',
  validateConstraintPair(c('SNET'), c('FNET')).issues.includes('secondary-same-side'), true);
eq('30 secundair type MSO ⇒ ongeldig',
  validateConstraintPair(c('SNET'), c('MSO')).issues.includes('secondary-type-invalid'), true);
eq('31 ASAP-primair + secundair ⇒ verboden',
  validateConstraintPair(c('ASAP'), c('FNLT')).issues.includes('no-secondary-with-asap-alap'), true);

const pinTasks: Task[] = [
  mkTask('A', 5),
  mkTask('B', 2, { constraint: { type: 'MSO', date: '2026-06-03', hard: true } }),
];
const pinSeq: Sequence[] = [fs('p1', 'A', 'B')];
const rp1 = solve(pinTasks, pinSeq);
const rp2 = solve(pinTasks, pinSeq);
eq('32 harde pin: solve idempotent (zelfde digest)', digest(rp1), digest(rp2));
eq('33 harde pin: B start vóór A klaar (logica gebroken)', rp1.tasks.get('B')!.earlyStart, '2026-06-03T08:00');
eq('34 harde pin: B tf=0 (pin kritiek-neutraal)', rp1.tasks.get('B')!.totalFloat, 0);
eq('35 harde pin: A negatieve float upstream', rp1.tasks.get('A')!.totalFloat, -3);
eq('36 harde pin: B in violatedConstraintTaskIds (rawMax > pin)', rp1.violatedConstraintTaskIds.includes('B'), true);

const rNear1 = solve(netA, seqA, { schedulingOptions: legacyEffective({ nearCriticalThreshold: 1 }) });
eq('37 near thr1: nearCriticalTaskIds == [A2]', JSON.stringify([...rNear1.nearCriticalTaskIds].sort()), JSON.stringify(['A2']));
eq('38 near thr1: A1 tf=0 NIET near (randgeval)', rNear1.tasks.get('A1')!.isNearCritical, false);
eq('39 near thr1: A2 tf=thr WÉL near (randgeval)', rNear1.tasks.get('A2')!.isNearCritical, true);
eq('40 near thr1: A3 tf=3 niet near', rNear1.tasks.get('A3')!.isNearCritical, false);
eq('41 near: criticalPath ongewijzigd (A1,END)', JSON.stringify([...rNear1.criticalPath].sort()), JSON.stringify(['A1', 'END']));
const rNear3 = solve(netA, seqA, { schedulingOptions: legacyEffective({ nearCriticalThreshold: 3 }) });
eq('42 near thr3: {A2,A3}', JSON.stringify([...rNear3.nearCriticalTaskIds].sort()), JSON.stringify(['A2', 'A3']));
eq('43 near thr3: A3 tf=thr WÉL near', rNear3.tasks.get('A3')!.isNearCritical, true);

const rThr1 = solve(netA, seqA, { schedulingOptions: legacyEffective({ criticalDefinition: { mode: 'totalFloat', threshold: 1 } }) });
eq('44 crit thr1: criticalPath = {A1,A2,END}', JSON.stringify([...rThr1.criticalPath].sort()), JSON.stringify(['A1', 'A2', 'END']));
eq('45 crit thr1: A2 kritiek (tf1≤1)', rThr1.tasks.get('A2')!.isCritical, true);
eq('46 crit thr1: A3 niet kritiek (tf3)', rThr1.tasks.get('A3')!.isCritical, false);

const rLP = solve(netA, seqA, { schedulingOptions: legacyEffective({ criticalDefinition: { mode: 'longestPath' } }) });
eq('47 longestPath: criticalPath = {A1,END}', JSON.stringify([...rLP.criticalPath].sort()), JSON.stringify(['A1', 'END']));
eq('48 longestPath: A2 niet kritiek', rLP.tasks.get('A2')!.isCritical, false);
const netAdl: Task[] = [mkTask('A1', 5), mkTask('A2', 4, { deadline: '2026-06-04' }), mkTask('A3', 2), mkTask('END', 1)];
const rDlDefault = solve(netAdl, seqA);
const rDlLP = solve(netAdl, seqA, { schedulingOptions: legacyEffective({ criticalDefinition: { mode: 'longestPath' } }) });
eq('49 deadline: A2 tf=0', rDlDefault.tasks.get('A2')!.totalFloat, 0);
eq('50 deadline+totalFloat: A2 kritiek (tf≤0)', rDlDefault.tasks.get('A2')!.isCritical, true);
eq('51 deadline+longestPath: A2 NIET kritiek (ongeacht tf=0)', rDlLP.tasks.get('A2')!.isCritical, false);
eq('52 deadline+longestPath: criticalPath = {A1,END}', JSON.stringify([...rDlLP.criticalPath].sort()), JSON.stringify(['A1', 'END']));

const netO: Task[] = [mkTask('OA', 1), mkTask('OB', 2), mkTask('OC', 5)];
const seqO: Sequence[] = [fs('o1', 'OA', 'OB'), fs('o2', 'OA', 'OC')];
const rODefault = solve(netO, seqO);
const rOForce = solve(netO, seqO, { schedulingOptions: legacyEffective({ makeOpenEndedCritical: true }) });
eq('53 open-ended default: OB niet kritiek', rODefault.tasks.get('OB')!.isCritical, false);
eq('54 open-ended default: OB tf=3', rODefault.tasks.get('OB')!.totalFloat, 3);
eq('55 makeOpenEndedCritical: OB kritiek', rOForce.tasks.get('OB')!.isCritical, true);
eq('56 makeOpenEndedCritical: OB tf geforceerd 0', rOForce.tasks.get('OB')!.totalFloat, 0);
eq('57 makeOpenEndedCritical: OC blijft kritiek', rOForce.tasks.get('OC')!.isCritical, true);
eq('58 makeOpenEndedCritical: OB intf=tf−ff invariant', rOForce.tasks.get('OB')!.interferingFloat, 0);

eq('59 totalFloatMode finish ⇒ digest identiek', digest(solve(netA, seqA, { schedulingOptions: legacyEffective({ totalFloatMode: 'finish' }) })), digest(rA));
eq('60 totalFloatMode start ⇒ digest identiek', digest(solve(netA, seqA, { schedulingOptions: legacyEffective({ totalFloatMode: 'start' }) })), digest(rA));

const rFP = solve(netA, seqA, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } }) });
eq('61 free-float: A1=1', rFP.floatPathByTask['A1'], 1);
eq('62 free-float: END=1 (zelfde driving-keten als A1)', rFP.floatPathByTask['END'], 1);
eq('63 free-float: A2=2', rFP.floatPathByTask['A2'], 2);
eq('64 free-float: A3=3', rFP.floatPathByTask['A3'], 3);
eq('65 free-float: criticalPaths[0] == criticalPath', JSON.stringify(rFP.criticalPaths[0]), JSON.stringify(rFP.criticalPath));
eq('66 free-float: precies 1 kritieke keten', rFP.criticalPaths.length, 1);
eq('67 free-float: criticalPaths[0] = [A1,END]', JSON.stringify(rFP.criticalPaths[0]), JSON.stringify(['A1', 'END']));
eq('68 free-float: alle 4 taken een floatPath', Object.keys(rFP.floatPathByTask).length, 4);
eq('69 free-float: per-taak floatPath == floatPathByTask',
  [...rFP.tasks.entries()].every(([id, t]) => t.floatPath === rFP.floatPathByTask[id]), true);

const rTFp = solve(netA, seqA, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 10 } }) });
eq('70 total-float: A1=1 (tf0)', rTFp.floatPathByTask['A1'], 1);
eq('71 total-float: END=1 (tf0, zelfde rang)', rTFp.floatPathByTask['END'], 1);
eq('72 total-float: A2=2 (tf1)', rTFp.floatPathByTask['A2'], 2);
eq('73 total-float: A3=3 (tf3)', rTFp.floatPathByTask['A3'], 3);
eq('74 total-float: criticalPaths[0] == criticalPath', JSON.stringify(rTFp.criticalPaths[0]), JSON.stringify(rTFp.criticalPath));

const rMax2 = solve(netA, seqA, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 2 } }) });
eq('75 maxPaths2: A1=1', rMax2.floatPathByTask['A1'], 1);
eq('76 maxPaths2: A2=2', rMax2.floatPathByTask['A2'], 2);
eq('77 maxPaths2: A3 GEEN floatPath (map)', rMax2.floatPathByTask['A3'], undefined);
eq('78 maxPaths2: A3 GEEN floatPath (per-taak)', rMax2.tasks.get('A3')!.floatPath, undefined);
eq('79 maxPaths2: precies 3 toegewezen', Object.keys(rMax2.floatPathByTask).length, 3);
const netBig: Task[] = [mkTask('END', 1)];
const seqBig: Sequence[] = [];
for (let i = 1; i <= 6; i++) { netBig.unshift(mkTask('T' + i, i)); seqBig.push(fs('bs' + i, 'T' + i, 'END')); }
const rBig = solve(netBig, seqBig, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 2 } }) });
eq('80 groot net maxPaths2: hoogste padnummer 2', Math.max(...Object.values(rBig.floatPathByTask)), 2);

const rDis = solve(netA, seqA, { schedulingOptions: legacyEffective({ floatPaths: { enabled: false, method: 'FREE_FLOAT', maxPaths: 10 } }) });
eq('81 disabled: floatPathByTask leeg', Object.keys(rDis.floatPathByTask).length, 0);
eq('82 disabled: criticalPaths == [criticalPath]', JSON.stringify(rDis.criticalPaths), JSON.stringify([rDis.criticalPath]));
eq('83 disabled: geen per-taak floatPath', [...rDis.tasks.values()].every(t => t.floatPath === undefined), true);
eq('84 disabled: digest byte-identiek aan geen-opties', digest(rDis), digest(rA));

const netSh: Task[] = [mkTask('S', 3), mkTask('B', 5), mkTask('C', 2)];
const seqSh: Sequence[] = [fs('sh1', 'S', 'B'), fs('sh2', 'S', 'C')];
const rSh = solve(netSh, seqSh, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } }) });
eq('85 gedeeld: B=1 (langste keten peelt eerst)', rSh.floatPathByTask['B'], 1);
eq('86 gedeeld: S=1 (padnummer van de EERSTE peel)', rSh.floatPathByTask['S'], 1);
eq('87 gedeeld: C=2 (tweede peel; S houdt zijn 1)', rSh.floatPathByTask['C'], 2);
eq('88 gedeeld: criticalPaths[0] == criticalPath', JSON.stringify(rSh.criticalPaths[0]), JSON.stringify(rSh.criticalPath));
eq('89 gedeeld: criticalPaths[0] = [S,B]', JSON.stringify(rSh.criticalPaths[0]), JSON.stringify(['S', 'B']));

function lk(id: string, pred: string, succ: string, type: Sequence['type']): Sequence {
  return { id, predecessorId: pred, successorId: succ, type, lagDays: 0 };
}
function s10(bDur: number): { r: CPMResult; tasks: Task[] } {
  const tasks = [mkTask('A', 3), mkTask('B', bDur), mkTask('H', 1, { isHammock: true })];
  const seqs = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
  return { r: solve(tasks, seqs), tasks };
}
const engDay = new CalendarEngine(CAL);

const s10a = s10(2);
const hA = s10a.r.tasks.get('H')!;
eq('90 S10-v1: H.es', hA.earlyStart, '2026-06-01T08:00');
eq('91 S10-v1: H.ef', hA.earlyFinish, '2026-06-05T16:00');
eq('92 S10-v1: H tf=0', hA.totalFloat, 0);
eq('93 S10-v1: H ff=0', hA.freeFloat, 0);
eq('94 S10-v1: H interfering=0', hA.interferingFloat, 0);
eq('95 S10-v1: H NOOIT kritiek', hA.isCritical, false);
eq('96 S10-v1: H niet in criticalPath', s10a.r.criticalPath.includes('H'), false);
eq('97 S10-v1: criticalPath = {A,B}', JSON.stringify([...s10a.r.criticalPath].sort()), JSON.stringify(['A', 'B']));
eq('98 S10-v1: afgeleide scheduleDuration = span 5', s10a.tasks.find(t => t.id === 'H')!.time.scheduleDuration, 5);
eq('99 S10-v1: span == workDaysBetween(ES,EF)',
  s10a.tasks.find(t => t.id === 'H')!.time.scheduleDuration,
  engDay.workDaysBetween(parseDate(hA.earlyStart), parseDate(hA.earlyFinish)));

const s10b = s10(4);
const hB = s10b.r.tasks.get('H')!;
eq('100 S10-v2: H.ef her-spant naar 06-09', hB.earlyFinish, '2026-06-09T16:00');
eq('101 S10-v2: afgeleide scheduleDuration = span 7', s10b.tasks.find(t => t.id === 'H')!.time.scheduleDuration, 7);
eq('102 S10-v2: span == workDaysBetween(ES,EF)',
  s10b.tasks.find(t => t.id === 'H')!.time.scheduleDuration,
  engDay.workDaysBetween(parseDate(hB.earlyStart), parseDate(hB.earlyFinish)));
eq('103 S10-v2: H nooit kritiek', hB.isCritical, false);

const H8: WorkCalendar = {
  id: 'h8', name: 'h8', description: 'h8',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [] } },
} as unknown as WorkCalendar;
function mkH(id: string, mins: number, extra: Partial<Task> = {}): Task {
  const t = mkTask(id, mins / 480, extra);
  t.time = createDefaultTaskTime('2026-07-06', mins / 480, 'hours');
  t.time.durationMinutes = mins;
  return t;
}
const engH8 = new CalendarEngine(H8);
const hourTasks = [mkH('A', 240), mkH('B', 360), mkH('H', 480, { isHammock: true })];
const hourSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
const rHour = new CPMSolver(hourTasks, hourSeq, H8, [], legacyCpmOptions()).solve();
const hH = rHour.tasks.get('H')!;
eq('104 uur: H.es', hH.earlyStart, '2026-07-06T08:00');
eq('105 uur: H.ef', hH.earlyFinish, '2026-07-07T10:00');
eq('106 uur: H fractionele durationMinutes = 600', hourTasks.find(t => t.id === 'H')!.time.durationMinutes, 600);
eq('107 uur: scheduleDuration = 1.25 dag', hourTasks.find(t => t.id === 'H')!.time.scheduleDuration, 1.25);
eq('108 uur: span == workMinutesBetween(ES,EF)',
  hourTasks.find(t => t.id === 'H')!.time.durationMinutes,
  engH8.workMinutesBetween(parseInstant(hH.earlyStart), parseInstant(hH.earlyFinish)));
eq('109 uur: H tf=0 ff=0 nooit kritiek', hH.totalFloat === 0 && hH.freeFloat === 0 && hH.isCritical === false, true);

const nfdTasks = [mkTask('A', 3), mkTask('H', 1, { isHammock: true })];
const rNfd = solve(nfdTasks, [lk('l2', 'A', 'H', 'START_START')]);
const hNfd = rNfd.tasks.get('H')!;
eq('110 geen finish-driver: H.ef == H.es (nul-lengte)', hNfd.earlyFinish, hNfd.earlyStart);
eq('111 geen finish-driver: waarschuwing gerapporteerd', JSON.stringify(rNfd.hammockNoFinishDriverTaskIds), JSON.stringify(['H']));
eq('112 geen finish-driver: H nog steeds nooit kritiek', hNfd.isCritical, false);
eq('113 met finish-driver: waarschuwingslijst leeg', JSON.stringify(s10a.r.hammockNoFinishDriverTaskIds), JSON.stringify([]));

const succTasks = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }),
  mkTask('Z', 2, { constraint: { type: 'FNLT', date: '2026-06-08' } })];
const succSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'),
  lk('l3', 'B', 'H', 'FINISH_FINISH'), lk('l4', 'H', 'Z', 'FINISH_START')];
const rSucc = solve(succTasks, succSeq);
eq('114 opvolger: Z.es (FS vanaf H rekent forward door)', rSucc.tasks.get('Z')!.earlyStart, '2026-06-08T08:00');
eq('115 opvolger: Z negatief door FNLT (tf=-1)', rSucc.tasks.get('Z')!.totalFloat, -1);
eq('116 opvolger: start-driver A GEEN negatieve float via hammock (tf=2)', rSucc.tasks.get('A')!.totalFloat, 2);
eq('117 opvolger: finish-driver B GEEN negatieve float via hammock (tf=2)', rSucc.tasks.get('B')!.totalFloat, 2);
eq('118 opvolger: H blijft LS=ES/LF=EF ⇒ tf=0, nooit kritiek', rSucc.tasks.get('H')!.totalFloat === 0 && rSucc.tasks.get('H')!.isCritical === false, true);
eq('119 opvolger: criticalPath = {Z} (alleen de echte eindketen)', JSON.stringify([...rSucc.criticalPath].sort()), JSON.stringify(['Z']));

const rFpHam = solve(
  [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }), mkTask('Z', 2)],
  [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH'), lk('l4', 'H', 'Z', 'FINISH_START')],
  { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } }) },
);
eq('120 float-paths: H NIET in floatPathByTask', rFpHam.floatPathByTask['H'], undefined);
eq('121 float-paths: H per-taak floatPath ongeschreven', rFpHam.tasks.get('H')!.floatPath, undefined);
eq('122 float-paths: Z=1 (echte eindketen)', rFpHam.floatPathByTask['Z'], 1);
eq('123 float-paths: criticalPaths bevat H niet', rFpHam.criticalPaths.every(p => !p.includes('H')), true);

const plainTasks = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1)];
const plainFalse = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: false })];
const plainSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
eq('124 isHammock afwezig ≡ false (byte-identieke solve)', digest(solve(plainFalse, plainSeq)), digest(solve(plainTasks, plainSeq)));
eq('125 gewone taak ≠ hammock (vlag heeft effect: H kritiek als gewone taak)', solve(plainTasks, plainSeq).tasks.get('H')!.isCritical, true);
eq('126 hammock-tweeling: H als hammock is NIET kritiek', s10a.r.tasks.get('H')!.isCritical, false);
const idemT = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true })];
const idemS = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
const idem1 = digest(new CPMSolver(idemT, idemS, CAL, [], legacyCpmOptions()).solve());
const idem2 = digest(new CPMSolver(idemT, idemS, CAL, [], legacyCpmOptions()).solve());
eq('127 hammock: solve idempotent na duur-mutatie (zelfde digest)', idem1, idem2);

eq('128 side pred FS ⇒ finish', externalSourceSide('predecessor', 'FS'), 'finish');
eq('129 side pred FF ⇒ finish', externalSourceSide('predecessor', 'FF'), 'finish');
eq('130 side pred SS ⇒ start', externalSourceSide('predecessor', 'SS'), 'start');
eq('131 side pred SF ⇒ start', externalSourceSide('predecessor', 'SF'), 'start');
eq('132 side succ FS ⇒ start', externalSourceSide('successor', 'FS'), 'start');
eq('133 side succ SS ⇒ start', externalSourceSide('successor', 'SS'), 'start');
eq('134 side succ FF ⇒ finish', externalSourceSide('successor', 'FF'), 'finish');
eq('135 side succ SF ⇒ finish', externalSourceSide('successor', 'SF'), 'finish');

function srcTask(id: string, es: string, ef: string, ls = es, lf = ef): Task {
  const t = mkTask(id, 1);
  t.time.earlyStart = es; t.time.scheduleStart = es;
  t.time.earlyFinish = ef; t.time.scheduleFinish = ef;
  t.time.lateStart = ls; t.time.lateFinish = lf;
  return t;
}
function extLink(
  id: string, direction: ExternalLink['direction'], relType: ExternalLink['relType'],
  ref: ExternalLink['sourceRef'], anchor = '2000-01-01', missing = true,
): ExternalLink {
  return { id, direction, relType, anchorDate: anchor, sourceRef: ref, sourceMissing: missing };
}

const SRC_ES = '2026-06-05', SRC_EF = '2026-06-08', SRC_LS = '2026-06-12', SRC_LF = '2026-06-15';
const source: ExternalSourceDoc = {
  projectId: 'SRC', filePath: '/tmp/src.ifc', projectName: 'Bronproject',
  tasks: [srcTask('X', SRC_ES, SRC_EF, SRC_LS, SRC_LF)],
};
const refX = (): ExternalLink['sourceRef'] => ({ projectId: 'SRC', taskId: 'X' });
const localMulti: Task = mkTask('L', 3, {
  externalLinks: [
    extLink('p-fs', 'predecessor', 'FS', refX()),
    extLink('p-ff', 'predecessor', 'FF', refX()),
    extLink('p-ss', 'predecessor', 'SS', refX()),
    extLink('p-sf', 'predecessor', 'SF', refX()),
    extLink('s-fs', 'successor', 'FS', refX()),
    extLink('s-ss', 'successor', 'SS', refX()),
    extLink('s-ff', 'successor', 'FF', refX()),
    extLink('s-sf', 'successor', 'SF', refX()),
  ],
});
const refreshed = refreshExternalAnchors([localMulti], source);
const byId = new Map((refreshed.tasks[0].externalLinks ?? []).map(l => [l.id, l]));
eq('136 ververs pred FS ⇒ bron.earlyFinish', byId.get('p-fs')!.anchorDate, SRC_EF);
eq('137 ververs pred FF ⇒ bron.earlyFinish', byId.get('p-ff')!.anchorDate, SRC_EF);
eq('138 ververs pred SS ⇒ bron.earlyStart', byId.get('p-ss')!.anchorDate, SRC_ES);
eq('139 ververs pred SF ⇒ bron.earlyStart', byId.get('p-sf')!.anchorDate, SRC_ES);
eq('140 ververs succ FS ⇒ bron.lateStart', byId.get('s-fs')!.anchorDate, SRC_LS);
eq('141 ververs succ SS ⇒ bron.lateStart', byId.get('s-ss')!.anchorDate, SRC_LS);
eq('142 ververs succ FF ⇒ bron.lateFinish', byId.get('s-ff')!.anchorDate, SRC_LF);
eq('143 ververs succ SF ⇒ bron.lateFinish', byId.get('s-sf')!.anchorDate, SRC_LF);
eq('144 ververs: alle 8 sourceMissing=false', (refreshed.tasks[0].externalLinks ?? []).every(l => l.sourceMissing === false), true);
eq('145 ververs: refreshed-teller = 8', refreshed.refreshed, 8);
eq('146 ververs: brontaak-naam gecanonicaliseerd', byId.get('p-fs')!.sourceRef.taskName, 'X');
eq('147 ververs: changed=true', refreshed.changed, true);

const mixed: Task = mkTask('L2', 3, {
  externalLinks: [
    extLink('found', 'predecessor', 'FS', { projectId: 'SRC', taskId: 'X' }, '2000-01-01', false),
    extLink('gone', 'predecessor', 'FS', { projectId: 'SRC', taskId: 'GHOST' }, '2019-12-31', false),
    extLink('other', 'predecessor', 'FS', { projectId: 'OTHER', taskId: 'Z' }, '2018-01-01', false),
  ],
});
const rMix = refreshExternalAnchors([mixed], source);
const mixById = new Map((rMix.tasks[0].externalLinks ?? []).map(l => [l.id, l]));
eq('148 sourceMissing: gevonden brontaak ⇒ anker bijgewerkt', mixById.get('found')!.anchorDate, SRC_EF);
eq('149 sourceMissing: gevonden ⇒ sourceMissing=false', mixById.get('found')!.sourceMissing, false);
eq('150 sourceMissing: ontbrekende brontaak ⇒ sourceMissing=true', mixById.get('gone')!.sourceMissing, true);
eq('151 sourceMissing: ontbrekend ⇒ oud anker behouden', mixById.get('gone')!.anchorDate, '2019-12-31');
eq('152 sourceMissing: andere bron ⇒ ongemoeid (anker)', mixById.get('other')!.anchorDate, '2018-01-01');
eq('153 sourceMissing: andere bron ⇒ ongemoeid (sourceMissing)', mixById.get('other')!.sourceMissing, false);
eq('154 sourceMissing: missing-teller = 1', rMix.missing, 1);

const byPath: Task = mkTask('L3', 3, {
  externalLinks: [extLink('fp', 'predecessor', 'SS', { projectId: 'WRONG', taskId: 'X', filePath: '/tmp/src.ifc' }, '2000-01-01', true)],
});
const rPath = refreshExternalAnchors([byPath], source);
eq('155 filePath-fallback: gematcht ⇒ anker uit bron', rPath.tasks[0].externalLinks![0].anchorDate, SRC_ES);
eq('156 filePath-fallback: projectId gecanonicaliseerd naar bron', rPath.tasks[0].externalLinks![0].sourceRef.projectId, 'SRC');

const windowsSource: ExternalSourceDoc = {
  ...source, projectId: 'SRC-WIN', filePath: 'C:/PROJECTEN/BRON.ifc',
};
const byWindowsPath: Task = mkTask('L4', 3, {
  externalLinks: [extLink('fp-win', 'predecessor', 'SS', {
    projectId: 'OUD-EN-FOUT', taskId: 'X', filePath: 'c:\\projecten\\.\\bron.IFC',
  }, '2000-01-01', true)],
});
const rWindowsPath = refreshExternalAnchors([byWindowsPath], windowsSource);
eq('156a genormaliseerde Windows-fallback matcht ondanks fout projectId',
  rWindowsPath.tasks[0].externalLinks![0].anchorDate, SRC_ES);
eq('156b genormaliseerde Windows-fallback canonicaliseert projectId',
  rWindowsPath.tasks[0].externalLinks![0].sourceRef.projectId, 'SRC-WIN');
const relativeSource: ExternalSourceDoc = { ...source, projectId: 'SRC-REL', filePath: 'relatief.ifc' };
const relativeLegacy: Task = mkTask('L5', 3, {
  externalLinks: [extLink('fp-rel', 'predecessor', 'SS', {
    projectId: 'ANDERS', taskId: 'X', filePath: 'relatief.ifc',
  }, '2000-01-01', true)],
});
const rRelative = refreshExternalAnchors([relativeLegacy], relativeSource);
eq('156c ongeldig relatief legacypad matcht niet', rRelative.changed, false);

const duplicateProjectTask: Task = mkTask('L6', 3, {
  externalLinks: [
    extLink('same-id-a', 'predecessor', 'FS', {
      projectId: 'DUPLICATE-PROJECT', taskId: 'X', filePath: '/tmp/kopie-a.ifc',
    }, '2001-01-01', false),
    extLink('same-id-b', 'predecessor', 'FS', {
      projectId: 'DUPLICATE-PROJECT', taskId: 'X', filePath: '/tmp/kopie-b.ifc',
    }, '2002-02-02', false),
  ],
});
const duplicateSourceA: ExternalSourceDoc = {
  projectId: 'DUPLICATE-PROJECT', filePath: '/tmp/kopie-a.ifc', projectName: 'Kopie A',
  tasks: [srcTask('X', '2026-08-03', '2026-08-05')],
};
const duplicateSourceB: ExternalSourceDoc = {
  projectId: 'DUPLICATE-PROJECT', filePath: '/tmp/kopie-b.ifc', projectName: 'Kopie B',
  tasks: [srcTask('X', '2026-09-07', '2026-09-11')],
};
const duplicateAfterA = refreshExternalAnchors([duplicateProjectTask], duplicateSourceA, 'file-path');
const duplicateAfterB = refreshExternalAnchors(duplicateAfterA.tasks, duplicateSourceB, 'file-path');
const duplicateLinks = new Map(duplicateAfterB.tasks[0].externalLinks!.map(link => [link.id, link]));
eq('156d gelijke project-id: pad A krijgt alleen anker A',
  duplicateLinks.get('same-id-a')!.anchorDate, '2026-08-05');
eq('156e gelijke project-id: pad B krijgt alleen anker B',
  duplicateLinks.get('same-id-b')!.anchorDate, '2026-09-11');
eq('156f gelijke project-id: bron A ververst exact één link', duplicateAfterA.refreshed, 1);
eq('156g gelijke project-id: bron B ververst exact één link', duplicateAfterB.refreshed, 1);

const already = refreshExternalAnchors(rPath.tasks, source);
eq('157 idempotent: tweede ververs ⇒ changed=false', already.changed, false);
eq('158 idempotent: task-referentie behouden', already.tasks[0] === rPath.tasks[0], true);

const noLinks = [mkTask('N', 2)];
const rNo = refreshExternalAnchors(noLinks, source);
eq('159 geen-links: referentie behouden', rNo.tasks[0] === noLinks[0], true);
eq('160 geen-links: changed=false', rNo.changed, false);

const rtProject: Project = {
  id: 'proj-rt', name: 'RT', description: '', startDate: '2026-06-01', endDate: '2026-06-30',
  calendarId: CAL.id, createdAt: '2026-06-01', modifiedAt: '2026-06-01', author: 'test', company: 'test',
};
const rtLinks: ExternalLink[] = [
  { id: 'rt1', direction: 'predecessor', relType: 'FS', lagDays: 2, anchorDate: '2026-06-08',
    sourceRef: { projectId: 'SRC', projectName: 'Bron', taskId: 'X', taskName: 'X-taak', filePath: '/tmp/src.ifc' }, sourceMissing: false },
  { id: 'rt2', direction: 'successor', relType: 'FF', lagMinutes: 90, anchorDate: '2026-06-10T12:00',
    sourceRef: { projectId: 'SRC', taskId: 'Y' }, sourceMissing: true },
];
const rtTask = mkTask('Local', 3, { externalLinks: rtLinks });
const ifc = writeIFC({ project: rtProject, calendar: CAL, tasks: [rtTask], sequences: [], resources: [], assignments: [] });
eq('161 IFC-write: OPS_ExternalLink-pset aanwezig', ifc.includes("'OPS_ExternalLink'"), true);
const backTask = readIFC(ifc).tasks.find(t => t.name === 'Local');
eq('162 IFC-round-trip: taak teruggevonden', !!backTask, true);
eq('163 IFC-round-trip: externalLinks byte-gelijk', JSON.stringify(backTask?.externalLinks ?? null), JSON.stringify(rtLinks));
const ifcNone = writeIFC({ project: rtProject, calendar: CAL, tasks: [mkTask('Plain', 2)], sequences: [], resources: [], assignments: [] });
eq('164 IFC-write: geen links ⇒ geen OPS_ExternalLink-pset', ifcNone.includes('OPS_ExternalLink'), false);

function tfMap(r: CPMResult): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [id, t] of r.tasks) m[id] = t.totalFloat;
  return m;
}
const s2 = [mkTask('A', 3), mkTask('B', 2, { constraint: { type: 'SNLT', date: '2026-06-03' } })];
const s2seq = [fs('s2s', 'A', 'B')];
const s2start = tfMap(solve(s2, s2seq, { schedulingOptions: legacyEffective({ totalFloatMode: 'start' }) }));
const s2finish = tfMap(solve(s2, s2seq, { schedulingOptions: legacyEffective({ totalFloatMode: 'finish' }) }));
const s2small = tfMap(solve(s2, s2seq, { schedulingOptions: legacyEffective({ totalFloatMode: 'smallest' }) }));
eq('165 disc S2 (SNLT): start == finish per taak', JSON.stringify(s2start), JSON.stringify(s2finish));
eq('166 disc S2: smallest == start (drie modi identiek)', JSON.stringify(s2small), JSON.stringify(s2start));
eq('167 disc S2: waarde niet-triviaal (B tf=-1)', s2finish['B'], -1);
const qn = [mkH('Q1', 960), mkH('Q2', 720), mkH('Q3', 480), mkH('ENDH', 480)];
const qs = [lk('qa', 'Q1', 'ENDH', 'FINISH_START'), lk('qb', 'Q2', 'ENDH', 'FINISH_START'), lk('qc', 'Q3', 'ENDH', 'FINISH_START')];
const qStart = tfMap(new CPMSolver(qn, qs, H8, [], { schedulingOptions: legacyEffective({ totalFloatMode: 'start' }) }).solve());
const qFinish = tfMap(new CPMSolver(qn, qs, H8, [], { schedulingOptions: legacyEffective({ totalFloatMode: 'finish' }) }).solve());
eq('168 disc uur: start == finish per taak (fractioneel)', JSON.stringify(qStart), JSON.stringify(qFinish));
eq('169 disc uur: Q2 fractionele tf=0.5 (niet-triviaal)', qFinish['Q2'], 0.5);
eq('170 disc uur: Q3 fractionele tf=1.0', qFinish['Q3'], 1);

const HAM = (): Task[] => [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }), mkTask('Z', 2)];
const HAMSEQ = [lk('hs1', 'A', 'B', 'FINISH_START'), lk('hs2', 'A', 'H', 'START_START'), lk('hs3', 'B', 'H', 'FINISH_FINISH'), lk('hs4', 'H', 'Z', 'FINISH_START')];
type Scen = { label: string; run: () => CPMResult; hammocks?: string[] };
const scen: Scen[] = [
  { label: 'netA', run: () => solve(netA, seqA) },
  { label: 'netA+near2', run: () => solve(netA, seqA, { schedulingOptions: legacyEffective({ nearCriticalThreshold: 2 }) }) },
  { label: 'netA+fp', run: () => solve(netA, seqA, { schedulingOptions: legacyEffective({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } }) }) },
  { label: 'netA+longest', run: () => solve(netA, seqA, { schedulingOptions: legacyEffective({ criticalDefinition: { mode: 'longestPath' } }) }) },
  { label: 'S2-neg', run: () => solve(s2, s2seq) },
  { label: 'pin', run: () => solve(pinTasks, pinSeq) },
  { label: 'ham+near2+fp', run: () => solve(HAM(), HAMSEQ, { schedulingOptions: legacyEffective({ nearCriticalThreshold: 2, floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } }) }), hammocks: ['H'] },
  { label: 'qnet-hour', run: () => new CPMSolver(qn, qs, H8, [], { schedulingOptions: legacyEffective({ nearCriticalThreshold: 0.5 }) }).solve() },
];
let sweepOk = true;
for (const s of scen) {
  const r = s.run();
  for (const [id, t] of r.tasks) {
    if (!(Math.abs((t.interferingFloat ?? NaN) - (t.totalFloat - t.freeFloat)) <= 1e-9)) { sweepOk = false; diffs.push(`sweep ${s.label}: ${id} intf≠tf−ff`); }
  }
  if (r.criticalPaths.length < 1 || JSON.stringify(r.criticalPaths[0]) !== JSON.stringify(r.criticalPath)) { sweepOk = false; diffs.push(`sweep ${s.label}: criticalPaths[0]≠criticalPath`); }
  for (const h of s.hammocks ?? []) {
    if (r.floatPathByTask[h] !== undefined) { sweepOk = false; diffs.push(`sweep ${s.label}: hammock ${h} heeft floatPath`); }
    if (r.nearCriticalTaskIds.includes(h)) { sweepOk = false; diffs.push(`sweep ${s.label}: hammock ${h} near-critical`); }
    if (r.tasks.get(h)?.isNearCritical === true) { sweepOk = false; diffs.push(`sweep ${s.label}: hammock ${h} isNearCritical`); }
    if (r.criticalPaths.some(p => p.includes(h))) { sweepOk = false; diffs.push(`sweep ${s.label}: hammock ${h} in kritieke keten`); }
  }
}
eq('171 invariant-sweep I1..I3 groen over alle sweep-netten', sweepOk, true);
const modeNets: { label: string; m: (mode: 'start' | 'finish') => CPMResult }[] = [
  { label: 'netA', m: mode => solve(netA, seqA, { schedulingOptions: legacyEffective({ totalFloatMode: mode }) }) },
  { label: 'S2', m: mode => solve(s2, s2seq, { schedulingOptions: legacyEffective({ totalFloatMode: mode }) }) },
  { label: 'pin', m: mode => solve(pinTasks, pinSeq, { schedulingOptions: legacyEffective({ totalFloatMode: mode }) }) },
  { label: 'ham', m: mode => solve(HAM(), HAMSEQ, { schedulingOptions: legacyEffective({ totalFloatMode: mode }) }) },
  { label: 'qnet', m: mode => new CPMSolver(qn, qs, H8, [], { schedulingOptions: legacyEffective({ totalFloatMode: mode }) }).solve() },
];
let modeOk = true;
for (const n of modeNets) if (JSON.stringify(tfMap(n.m('start'))) !== JSON.stringify(tfMap(n.m('finish')))) { modeOk = false; diffs.push(`mode ${n.label}: start≠finish`); }
eq('172 totalFloatMode start==finish over alle sweep-netten (I4)', modeOk, true);

const hourPin = [mkH('A', 960), mkH('B', 480, { constraint: { type: 'MSO', date: '2026-07-07T08:00', hard: true } })];
const hourPinSeq = [lk('hp', 'A', 'B', 'FINISH_START')];
const hp1 = new CPMSolver(hourPin, hourPinSeq, H8, [], legacyCpmOptions()).solve();
const hp2 = new CPMSolver(hourPin, hourPinSeq, H8, [], legacyCpmOptions()).solve();
eq('173 uur harde pin: solve idempotent (zelfde digest)', digest(hp1), digest(hp2));
eq('174 uur harde pin: B gepind op 07-07T08:00 (logica gebroken)', hp1.tasks.get('B')!.earlyStart, '2026-07-07T08:00');
eq('175 uur harde pin: B in violatedConstraintTaskIds', hp1.violatedConstraintTaskIds.includes('B'), true);

type TaskNote = { id: string; text: string; done: boolean };
const notesA: TaskNote[] = [
  { id: 'n1', text: 'Bekist controleren vóór storten', done: false },
  { id: 'n2', text: 'Wapening gekeurd', done: true },
];
const notesB: TaskNote[] = [
  { id: 'n3', text: 'Materiaal besteld', done: false },
];
const notesTaskA = mkTask('NotesA', 3, { notes: notesA });
const notesTaskB = mkTask('NotesB', 2, { notes: notesB });
const notesTaskC = mkTask('NotesC', 1);
const ifcNotes = writeIFC({ project: rtProject, calendar: CAL, tasks: [notesTaskA, notesTaskB, notesTaskC], sequences: [], resources: [], assignments: [] });
eq('176 IFC-write: OPS_TaskNotes-pset aanwezig', ifcNotes.includes("'OPS_TaskNotes'"), true);
const notesBack = readIFC(ifcNotes).tasks;
const backA = notesBack.find(t => t.name === 'NotesA');
const backB = notesBack.find(t => t.name === 'NotesB');
const backC = notesBack.find(t => t.name === 'NotesC');
eq('177 IFC-round-trip: taak A teruggevonden', !!backA, true);
eq('178 IFC-round-trip: notes A byte-gelijk (mix open/done)', JSON.stringify(backA?.notes ?? null), JSON.stringify(notesA));
eq('179 IFC-round-trip: notes B byte-gelijk (enkele open)', JSON.stringify(backB?.notes ?? null), JSON.stringify(notesB));
eq('180 IFC-round-trip: taak zonder notes ⇒ notes blijft undefined', backC?.notes, undefined);
const ifcNoNotes = writeIFC({ project: rtProject, calendar: CAL, tasks: [mkTask('PlainNotes', 2)], sequences: [], resources: [], assignments: [] });
eq('181 IFC-write: geen notes ⇒ geen OPS_TaskNotes-pset', ifcNoNotes.includes('OPS_TaskNotes'), false);

function mkStartMs(id: string): Task {
  return mkTask(id, 0, { isMilestone: true, milestoneKind: 'START' } as Partial<Task>);
}

const gateS: Task = mkStartMs('GateS');
const gateP: Task = mkTask('GateP', 3, {
  constraint: { type: 'MSO', date: '2026-06-10', hard: true },
});
gateP.time.completion = 1;
gateP.time.actualStart = '2026-06-10';
gateP.time.actualFinish = '2026-06-12';
const gateSeq: Sequence[] = [fs('gp1', 'GateS', 'GateP')];
const rGateA = solve([gateS, gateP], gateSeq, legacyCpmOptions({ dataDate: '2026-07-01' }));
eq('182 detector-gate: actual EXACT op de pin ⇒ GEEN violation', rGateA.violatedConstraintTaskIds.includes('GateP'), false);
eq('183 detector-gate: P blijft gepind op zijn actuals (ES)', rGateA.tasks.get('GateP')!.earlyStart, '2026-06-10T08:00');
eq('184 detector-gate: P blijft gepind op zijn actuals (EF)', rGateA.tasks.get('GateP')!.earlyFinish, '2026-06-12T16:00');

const gateP2: Task = mkTask('GateP2', 3, {
  constraint: { type: 'MSO', date: '2026-06-10', hard: true },
});
gateP2.time.completion = 1;
gateP2.time.actualStart = '2026-06-15';
gateP2.time.actualFinish = '2026-06-17';
const rGateB = solve([mkStartMs('GateS2'), gateP2], [fs('gp2', 'GateS2', 'GateP2')], legacyCpmOptions({ dataDate: '2026-07-01' }));
eq('185 detector-gate CONTROLE: actual NA de pin ⇒ violation blijft vuren', rGateB.violatedConstraintTaskIds.includes('GateP2'), true);

const gateQ: Task = mkTask('GateQ', 20);
const gateP3: Task = mkTask('GateP3', 3, {
  constraint: { type: 'MSO', date: '2026-06-10', hard: true },
});
const rGateC = solve([gateQ, gateP3], [fs('gp3', 'GateQ', 'GateP3')]);
eq('186 detector-gate CONTROLE: geen actuals + structureel te laat ⇒ violation blijft vuren', rGateC.violatedConstraintTaskIds.includes('GateP3'), true);

{
  const kid1 = mkTask('AC-kid1', 5, { parentId: 'AC-sum' });
  const kid2 = mkTask('AC-kid2', 3, { parentId: 'AC-sum' });
  const sum = mkTask('AC-sum', 0, { childIds: ['AC-kid1', 'AC-kid2'] });
  const tasks = [sum, kid1, kid2];
  const result = {
    tasks: new Map([
      ['AC-kid1', { earlyStart: '2026-06-01', earlyFinish: '2026-06-05', lateStart: '2026-06-03',
        lateFinish: '2026-06-07', totalFloat: 2, freeFloat: 1, isCritical: true, interferingFloat: 1 }],
      ['AC-kid2', { earlyStart: '2026-06-02', earlyFinish: '2026-06-04', lateStart: '2026-06-08',
        lateFinish: '2026-06-10', totalFloat: 4, freeFloat: 3, isCritical: false, interferingFloat: 1 }],
    ]),
    projectStart: '2026-06-01', projectEnd: '2026-06-05', criticalPath: ['AC-kid1'],
  } as unknown as Parameters<typeof applyCpmResult>[1];

  applyCpmResult(tasks, result, { projectCalendar: CAL, calendars: [CAL] });

  eq('187 rollup: earlyStart = vroegste kind', sum.time.earlyStart, '2026-06-01');
  eq('188 rollup: earlyFinish = laatste kind', sum.time.earlyFinish, '2026-06-05');
  eq('189 rollup: kritiek als één kind kritiek is', sum.time.isCritical, true);
  eq('190 rollup: lateStart = vroegste late kind', sum.time.lateStart, '2026-06-03');
  eq('191 rollup: lateFinish = laatste late kind', sum.time.lateFinish, '2026-06-10');
  eq('192 rollup: totalFloat = min over kinderen (krapste kind bepaalt)', sum.time.totalFloat, 2);
  eq('193 rollup: freeFloat = min over kinderen', sum.time.freeFloat, 1);
  eq('194 rollup: interferingFloat = tf − ff, ook op de verzameltaak', sum.time.interferingFloat, 1);
  eq('195 blad: interferingFloat komt door', kid2.time.interferingFloat, 1);
}

{
  const x = mkTask('T8-X', 4);
  const y = mkTask('T8-Y', 2);
  const k1 = mkTask('T8-K1', 3, { parentId: 'T8-S' });
  const k2 = mkTask('T8-K2', 5, { parentId: 'T8-S' });
  const seqIntoSummary = fs('t8-seq-in', 'T8-X', 'T8-S');
  const seqOutOfSummary = fs('t8-seq-out', 'T8-S', 'T8-Y');
  const seqBogus = fs('t8-seq-bogus', 'does-not-exist', 'T8-Y');

  let threw = false;
  let result: CPMResult | undefined;
  try {
    result = solve([x, y, k1, k2], [seqIntoSummary, seqOutOfSummary, seqBogus]);
  } catch {
    threw = true;
  }
  eq('196 T8: relatie op samenvattingstaak crasht de solver niet meer', threw, false);
  eq('197 T8: geen circulaire-dependency-fout gemeld (de relaties zijn gewoon acyclisch)', result?.error, undefined);
  eq(
    '198 T8: de drie genegeerde relaties staan in droppedSequenceIds',
    [...(result?.droppedSequenceIds ?? [])].sort().join(','),
    ['t8-seq-bogus', 't8-seq-in', 't8-seq-out'].sort().join(','),
  );
  eq('199 T8: X (voormalig "voorganger" van S) start gewoon op het anker', result?.tasks.get('T8-X')?.earlyStart, '2026-06-01T08:00');
  eq('200 T8: Y (voormalig "opvolger" van S) start gewoon op het anker (geen wachten op S)', result?.tasks.get('T8-Y')?.earlyStart, '2026-06-01T08:00');
  eq('201 T8: K1/K2 rekenen normaal door — K2 (langste kind) is kritiek', result?.tasks.get('T8-K2')?.isCritical, true);
}

{
  const a = mkTask('T8-A', 3);
  const b = mkTask('T8-B', 2);
  const result = solve([a, b], [fs('t8-normal', 'T8-A', 'T8-B')]);
  eq('202 T8: normale relatie blijft ongemoeid — geen droppedSequenceIds', result.droppedSequenceIds, undefined);
  eq('203 T8: normale relatie blijft ongemoeid — B start ná A (FS)', result.tasks.get('T8-B')?.earlyStart, '2026-06-04T08:00');
}

const RCAL: WorkCalendar = {
  id: 'rcal', name: 'rcal', description: 'rcal (2u/dag, corpusloos — Z8-fixronde-2)',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 10, hoursPerDay: 2, holidays: [],
  workTime: { byWeekday: { 1: [{ start: 480, end: 600 }], 2: [{ start: 480, end: 600 }], 3: [{ start: 480, end: 600 }], 4: [{ start: 480, end: 600 }], 5: [{ start: 480, end: 600 }], 6: [], 7: [] } },
} as unknown as WorkCalendar;
function mkProg(id: string, extra: Partial<Task> = {}): Task {
  const t = mkTask(id, 1, extra);
  t.time = createDefaultTaskTime('2026-07-06', 1, 'hours');
  t.time.durationMinutes = 480;
  t.time.completion = 0.5;
  t.time.actualStart = '2026-07-06T08:00';
  t.time.remainingMinutes = 240;
  return t;
}
const ip1 = mkProg('IP1', { timephasedDurationWalks: [{ anchor: '2026-07-06T08:00', resourceCalendarId: 'rcal' }] });
const rIp1 = new CPMSolver([ip1], [], H8, [RCAL], legacyCpmOptions()).solve();
const ip1r = rIp1.tasks.get('IP1')!;
eq('204 Z8-fix2: progressCal=RCAL (2u/dag) ⇒ 240min restwerk loopt over 2 dagen', ip1r.earlyFinish, '2026-07-07T10:00');
const ip2 = mkProg('IP2');
const rIp2 = new CPMSolver([ip2], [], H8, [RCAL], legacyCpmOptions()).solve();
const ip2r = rIp2.tasks.get('IP2')!;
eq('205 Z8-fix2: zonder walk ⇒ progressCal blijft H8 (8u/dag) ⇒ zelfde dag klaar', ip2r.earlyFinish, '2026-07-06T12:00');
eq('206 Z8-fix2: IP1 (RCAL) en IP2 (H8) geven AANTOONBAAR verschillende antwoorden', ip1r.earlyFinish !== ip2r.earlyFinish, true);

const ip3 = mkProg('IP3', {
  timephasedDurationWalks: [{ anchor: '2026-07-06T08:00', resourceCalendarId: 'rcal' }],
});
ip3.time.resume = '2026-07-01T08:00';
ip3.time.remainingMinutes = 60;
const rIp3 = new CPMSolver([ip3], [], H8, [RCAL], legacyCpmOptions()).solve();
const ip3r = rIp3.tasks.get('IP3')!;
eq('207 Z8-fix2: EF<ES-wacht klemt ef op actualES (hostiel resume vóór actualStart)', ip3r.earlyFinish, '2026-07-06T08:00');
eq('208 Z8-fix2: es blijft actualES, geen inversie', ip3r.earlyStart <= ip3r.earlyFinish, true);

function sfChain(preDur: number) {
  const pre = mkTask('SF-PRE', preDur);
  const sf1 = mkTask('SF1', 1);
  const sf2 = mkTask('SF2', 1, { timephasedFinishFloor: '2026-06-01T16:00' });
  const seqs = [fs('sfp', 'SF-PRE', 'SF1'), lk('sf1', 'SF1', 'SF2', 'START_FINISH')];
  return new CPMSolver([pre, sf1, sf2], seqs, H8, [], legacyCpmOptions()).solve().tasks.get('SF2')!;
}
const sf2aR = sfChain(1);
eq('209 Z8-deferred: SF-druk laat het venster winnen (niet bevroren)', sf2aR.earlyFinish, '2026-06-02T08:00');
const sf2bR = sfChain(11);
eq('210 Z8-deferred: +10 werkdagen vóór SF1 ⇒ earlyFinish beweegt mee (niet bevroren op het venster)', sf2bR.earlyFinish !== sf2aR.earlyFinish, true);
eq('211 Z8-deferred: SF-druk wint nu van het venster, ook 10 werkdagen verder', sf2bR.earlyFinish > '2026-06-01T16:00', true);

const invPre = mkTask('INV-PRE', 5);
const inv = mkTask('INV', 1, { timephasedFinishFloor: '2026-06-01T10:00' });
const rInv = new CPMSolver([invPre, inv], [fs('invfs', 'INV-PRE', 'INV')], H8, [], legacyCpmOptions()).solve();
const invR = rInv.tasks.get('INV')!;
eq('212 Z8-slotronde: AUTO-tak EF<ES-wacht — ef geklemd op es (stale venster vóór voorganger-druk)', invR.earlyFinish, invR.earlyStart);
eq('213 Z8-slotronde: es blijft de voorganger-gedreven 2026-06-08T08:00, niet het stale venster', invR.earlyStart, '2026-06-08T08:00');

{
  const X = mkTask('Z9B2-X', 6);
  const P = mkTask('Z9B2-P', 2, { constraint: { type: 'ALAP' } });
  const Q = mkTask('Z9B2-Q', 2);
  const M = mkTask('Z9B2-M', 2, { manuallyScheduled: true });
  const seqPQ = fs('z9b2-pq', 'Z9B2-P', 'Z9B2-Q');
  const seqXQ = fs('z9b2-xq', 'Z9B2-X', 'Z9B2-Q');
  const seqPM = fs('z9b2-pm', 'Z9B2-P', 'Z9B2-M');
  const r = solve([X, P, Q, M], [seqPQ, seqXQ, seqPM]);
  eq('214 Z9b/applyAlap-precondition: P werd daadwerkelijk ALAP-opgeschoven (niet op haar vroegste anker)', r.tasks.get('Z9B2-P')!.earlyStart !== '2026-06-01', true);
  eq('215 Z9b/applyAlap: M houdt haar rauwe anker ongeacht P se ALAP-push', r.tasks.get('Z9B2-M')!.earlyStart, '2026-06-01T08:00');
  eq('216 Z9b/applyAlap: P->M krijgt GEEN sequenceFreeFloat-invoer (blijft ongezien, als een hammock-relatie)', Object.prototype.hasOwnProperty.call(r.sequenceFreeFloat, seqPM.id), false);
  eq('217 Z9b/applyAlap: P->M staat niet in drivingSequenceIds', r.drivingSequenceIds.includes(seqPM.id), false);
  eq('218 Z9b/applyAlap-contrast: P->Q (auto) draagt WEL een sequenceFreeFloat-invoer', Object.prototype.hasOwnProperty.call(r.sequenceFreeFloat, seqPQ.id), true);
}

{
  const mkid1 = mkTask('Z9B3-kid1', 5, { parentId: 'Z9B3-sum' });
  const mkid2 = mkTask('Z9B3-kid2', 3, { parentId: 'Z9B3-sum' });
  const mkid3 = mkTask('Z9B3-kid3', 5, { parentId: 'Z9B3-sum' });
  const msum = mkTask('Z9B3-sum', 0, {
    childIds: ['Z9B3-kid1', 'Z9B3-kid2', 'Z9B3-kid3'],
    manuallyScheduled: true,
    time: { ...createDefaultTaskTime('2026-07-01', 3), scheduleStart: '2026-07-01', scheduleFinish: '2026-07-03' },
  });
  const tasks = [msum, mkid1, mkid2, mkid3];
  const result = {
    tasks: new Map([
      ['Z9B3-kid1', { earlyStart: '2026-06-01', earlyFinish: '2026-06-05', lateStart: '2026-06-03',
        lateFinish: '2026-06-07', totalFloat: 2, freeFloat: 1, isCritical: true, interferingFloat: 1 }],
      ['Z9B3-kid2', { earlyStart: '2026-06-02', earlyFinish: '2026-06-04', lateStart: '2026-06-08',
        lateFinish: '2026-06-10', totalFloat: 4, freeFloat: 3, isCritical: false, interferingFloat: 1 }],
      ['Z9B3-kid3', { earlyStart: '2026-08-01', earlyFinish: '2026-08-05', lateStart: '2026-08-03',
        lateFinish: '2026-08-07', totalFloat: 2, freeFloat: 1, isCritical: false, interferingFloat: 1 }],
    ]),
    projectStart: '2026-06-01', projectEnd: '2026-08-05', criticalPath: ['Z9B3-kid1'],
  } as unknown as Parameters<typeof applyCpmResult>[1];

  applyCpmResult(tasks, result, { projectCalendar: CAL, calendars: [CAL] });

  eq('219 Z9b/manual-rollup: earlyStart = eigen scheduleStart, NIET het vroegste kind', msum.time.earlyStart, '2026-07-01');
  eq('220 Z9b/manual-rollup: earlyFinish = eigen scheduleFinish, NIET het laatste kind', msum.time.earlyFinish, '2026-07-03');
  eq('221 Z9b/manual-rollup: lateStart = earlyStart (definitorisch, mirrort de manual-bladtaak-conventie)', msum.time.lateStart, '2026-07-01');
  eq('222 Z9b/manual-rollup: lateFinish = earlyFinish', msum.time.lateFinish, '2026-07-03');
  eq('223 Z9b/manual-rollup: totalFloat = 0 (definitorisch, niet het min-over-kinderen)', msum.time.totalFloat, 0);
  eq('224 Z9b/manual-rollup: freeFloat = 0', msum.time.freeFloat, 0);
  eq('225 Z9b/manual-rollup: interferingFloat = 0', msum.time.interferingFloat, 0);
  eq('226 Z9b/manual-rollup: isCritical blijft van de kinderen afgeleid', msum.time.isCritical, true);
  eq('227 Z9b/manual-rollup-contrast: kid1 zelf blijft ongewijzigd', mkid1.time.earlyStart, '2026-06-01');
  eq('228 Z9b/manual-rollup-richting: een LATER kind (2026-08-05) duwt earlyFinish niet voorbij de eigen 2026-07-03', msum.time.earlyFinish, '2026-07-03');
}

if (diffs.length === 0) {
  console.log(`OK  advanced-cpm-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  advanced-cpm-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
