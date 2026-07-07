// Geavanceerde-CPM checks (fase 2.9, golf 0 + 1 + 2 + 3). Golf 0/1: datamodel + plumbing default-inert,
// validateConstraintPair, harde-pin-idempotentie. Golf 2 (§4.6): de analyse-laag — interfering float
// (ALTIJD tf−ff), near-critical-drempel (0<tf≤thr; tf=0 niet, tf=thr wél), kritiek-definitie-opties
// (totalFloat-drempel, longestPath tf-onafhankelijk incl. discriminator), open-ended-kritiek, en de
// TF-berekeningswijze (in de huidige symmetrische backward-pass observationeel identiek). Golf 3 (§4.6):
// multiple float paths — FREE_FLOAT-peel + TOTAL_FLOAT-rangschikking, maxPaths harde begrenzing,
// gedeelde-voorganger-eerste-peel, criticalPaths[0]===criticalPath byte-compat, enabled=false inert.
//
// Draait via run.sh (esbuild-bundel, zoals check-datetime.ts). Exit 0 = alles groen.
import { CPMSolver, type CPMResult, type CPMOptions } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createDefaultTaskTime, type Task, type TaskConstraint, type ExternalLink } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { FILTER_SORT_BUILTIN_KEYS, fieldKind, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';
import type { FieldRef, BuiltinFieldKey } from '@/state/slices/types';
import { validateConstraintPair } from '@/engine/scheduler/constraintValidation';
import { refreshExternalAnchors, externalSourceSide, type ExternalSourceDoc } from '@/engine/externalLinks';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── Testbouwstenen ───────────────────────────────────────────────────────────
// Schone dag-kalender ma-vr, geen feestdagen, geen workTime (dag-modus) — byte-identiek referentie.
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
function solve(tasks: Task[], seqs: Sequence[], opts: CPMOptions = {}): CPMResult {
  return new CPMSolver(tasks, seqs, CAL, [], opts).solve();
}

/** Stabiele vergelijkbare fingerprint van álle gedragswijzigende uitvoer (Map → gesorteerde
 *  entries), zodat "byte-identiek" hard te vergelijken is. De 2.9-analyse-velden (interfering/near/
 *  floatPath) zitten er BEWUST NIET in — interfering wordt sinds golf 2 altijd geschreven maar raakt
 *  de planning niet, dus de byte-identiteit-vergelijkingen blijven zuiver op es/ef/ls/lf/tf/ff/crit. */
function digest(r: CPMResult): string {
  const tasks = [...r.tasks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, t]) => [
    id, t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish, t.totalFloat, t.freeFloat, t.isCritical,
  ]);
  return JSON.stringify({
    tasks, cp: r.criticalPath, pe: r.projectEnd, pd: r.projectDuration,
    drv: [...r.drivingSequenceIds].sort(), viol: [...r.violatedConstraintTaskIds].sort(),
  });
}

// ── Net A — float-net (A1 kritiek, A2/A3 met speling) ────────────────────────
// A1(5),A2(4),A3(2) elk →FS END(1); roots starten ma 2026-06-01.
const netA: Task[] = [mkTask('A1', 5), mkTask('A2', 4), mkTask('A3', 2), mkTask('END', 1)];
const seqA: Sequence[] = [fs('s1', 'A1', 'END'), fs('s2', 'A2', 'END'), fs('s3', 'A3', 'END')];
const rA = solve(netA, seqA);

// ── 1) Velden-catalogus: de vier nieuwe keys aanwezig + juiste soort (§3.5) ───
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

// ── 2) CPMResult-vormcontract: criticalPaths ALTIJD [criticalPath] (§3.5/§4.6) ─
eq('09 criticalPaths lengte precies 1 (floatPaths uit)', rA.criticalPaths.length, 1);
eq('10 criticalPaths[0] == criticalPath', JSON.stringify(rA.criticalPaths[0]), JSON.stringify(rA.criticalPath));
eq('11 nearCriticalTaskIds leeg (drempel ongezet)', rA.nearCriticalTaskIds.length, 0);
eq('12 floatPathByTask leeg (floatPaths uit)', Object.keys(rA.floatPathByTask).length, 0);
// Sanity: het net is niet-triviaal (A1 kritiek, END kritiek) — anders zeggen de checks weinig.
eq('13 net A niet-triviaal (criticalPath bevat A1)', rA.criticalPath.includes('A1'), true);

// ── 3) Per-taak-analyse-velden (§3.5/§4.6): interfering ALTIJD, near/floatPath default-ongeschreven ─
const all = [...rA.tasks.values()];
eq('14 elke taak interferingFloat === tf−ff (golf 2: altijd berekend)',
  all.every(t => t.interferingFloat === t.totalFloat - t.freeFloat), true);
eq('15 elke taak isNearCritical === undefined (geen drempel)', all.every(t => t.isNearCritical === undefined), true);
eq('16 elke taak floatPath === undefined (floatPaths uit)', all.every(t => t.floatPath === undefined), true);

// ── 4) Plumbing byte-identiek: met vs zonder (leeg) schedulingOptions (§2) ─────
const rNone = solve(netA, seqA);                              // opties-object leeg
const rEmptyOpts = solve(netA, seqA, { schedulingOptions: {} });    // leeg 2.9-blok doorgegeven
const rFullDefaults = solve(netA, seqA, {
  schedulingOptions: { lagCalendar: 'predecessor', criticalDefinition: { mode: 'totalFloat', threshold: 0 }, totalFloatMode: 'smallest' },
});
eq('17 leeg schedulingOptions ⇒ byte-identieke solve', digest(rEmptyOpts), digest(rNone));
eq('18 default-waarden-blok ⇒ byte-identieke solve', digest(rFullDefaults), digest(rNone));

// ── 5) Optionele TAAK-velden (hard/constraint2/isHammock/externalLinks) inert ──
// Net B: P(2)→FS Q(3), Q met soft SNET. Decoratie voegt alle 2.9-taakvelden toe die golf 0 MOET
// negeren; de solve moet identiek blijven (bewijs: geen enkele gedragswijzigende tak geraakt).
const snet: TaskConstraint = { type: 'SNET', date: '2026-06-10' };
const netB: Task[] = [mkTask('P', 2), mkTask('Q', 3, { constraint: snet })];
const seqB: Sequence[] = [fs('b1', 'P', 'Q')];
const netBdecor: Task[] = [
  mkTask('P', 2, { isHammock: false, externalLinks: [] }),
  mkTask('Q', 3, {
    constraint: { type: 'SNET', date: '2026-06-10', hard: true },   // `hard` moet inert zijn
    constraint2: { type: 'FNLT', date: '2026-06-30' },              // secundair moet inert zijn
    isHammock: false,
    externalLinks: [{
      id: 'x1', direction: 'predecessor', relType: 'FS', anchorDate: '2026-05-20',
      sourceRef: { projectId: 'p2', taskId: 't9' }, sourceMissing: true,
    }],
  }),
];
eq('19 2.9-taakvelden aanwezig ⇒ byte-identieke solve (inert)', digest(solve(netBdecor, seqB)), digest(solve(netB, seqB)));

// ── 6) CPMResult-velden ook aanwezig op de FOUT-tak (cyclus) ──────────────────
const cyc: Task[] = [mkTask('U', 1), mkTask('V', 1)];
const seqCyc: Sequence[] = [fs('c1', 'U', 'V'), fs('c2', 'V', 'U')];
const rErr = solve(cyc, seqCyc);
eq('20 cyclus ⇒ error gezet', typeof rErr.error === 'string' && rErr.error.length > 0, true);
eq('21 error-result: criticalPaths aanwezig, lengte 1', rErr.criticalPaths.length, 1);
eq('22 error-result: nearCriticalTaskIds/floatPathByTask leeg',
  rErr.nearCriticalTaskIds.length === 0 && Object.keys(rErr.floatPathByTask).length === 0, true);

// ── 7) Golf 1 — validateConstraintPair (§4.3), pure authoring-guard ───────────
// De SOLVER rekent altijd gewoon door; deze helper weigert enkel nonsensicale paren voor de UI.
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

// ── 8) Golf 1 — harde-pin-idempotentie (§8.4c): twee solves = zelfde datums ────
// A(5)→FS B(2), B HARD MSO 06-03 (scenario S8). De pin breekt de logica; herhaald solven moet
// bit-identiek zijn (geen accumulerende instance-state).
const pinTasks: Task[] = [
  mkTask('A', 5),
  mkTask('B', 2, { constraint: { type: 'MSO', date: '2026-06-03', hard: true } }),
];
const pinSeq: Sequence[] = [fs('p1', 'A', 'B')];
const rp1 = solve(pinTasks, pinSeq);
const rp2 = solve(pinTasks, pinSeq);
eq('32 harde pin: solve idempotent (zelfde digest)', digest(rp1), digest(rp2));
eq('33 harde pin: B start vóór A klaar (logica gebroken)', rp1.tasks.get('B')!.earlyStart, '2026-06-03');
eq('34 harde pin: B tf=0 (pin kritiek-neutraal)', rp1.tasks.get('B')!.totalFloat, 0);
eq('35 harde pin: A negatieve float upstream', rp1.tasks.get('A')!.totalFloat, -3);
eq('36 harde pin: B in violatedConstraintTaskIds (rawMax > pin)', rp1.violatedConstraintTaskIds.includes('B'), true);

// ── 9) Golf 2 — near-critical-drempel (§4.6) op net A (A1 tf0, A2 tf1, A3 tf3, END tf0) ─
const rNear1 = solve(netA, seqA, { schedulingOptions: { nearCriticalThreshold: 1 } });
eq('37 near thr1: nearCriticalTaskIds == [A2]', JSON.stringify([...rNear1.nearCriticalTaskIds].sort()), JSON.stringify(['A2']));
eq('38 near thr1: A1 tf=0 NIET near (randgeval)', rNear1.tasks.get('A1')!.isNearCritical, false);
eq('39 near thr1: A2 tf=thr WÉL near (randgeval)', rNear1.tasks.get('A2')!.isNearCritical, true);
eq('40 near thr1: A3 tf=3 niet near', rNear1.tasks.get('A3')!.isNearCritical, false);
eq('41 near: criticalPath ongewijzigd (A1,END)', JSON.stringify([...rNear1.criticalPath].sort()), JSON.stringify(['A1', 'END']));
const rNear3 = solve(netA, seqA, { schedulingOptions: { nearCriticalThreshold: 3 } });
eq('42 near thr3: {A2,A3}', JSON.stringify([...rNear3.nearCriticalTaskIds].sort()), JSON.stringify(['A2', 'A3']));
eq('43 near thr3: A3 tf=thr WÉL near', rNear3.tasks.get('A3')!.isNearCritical, true);

// ── 10) Golf 2 — kritiek-definitie: totalFloat-drempel (§4.6) ──────────────────
const rThr1 = solve(netA, seqA, { schedulingOptions: { criticalDefinition: { mode: 'totalFloat', threshold: 1 } } });
eq('44 crit thr1: criticalPath = {A1,A2,END}', JSON.stringify([...rThr1.criticalPath].sort()), JSON.stringify(['A1', 'A2', 'END']));
eq('45 crit thr1: A2 kritiek (tf1≤1)', rThr1.tasks.get('A2')!.isCritical, true);
eq('46 crit thr1: A3 niet kritiek (tf3)', rThr1.tasks.get('A3')!.isCritical, false);

// ── 11) Golf 2 — kritiek-definitie: longestPath (§4.6, tf-onafhankelijk) ───────
const rLP = solve(netA, seqA, { schedulingOptions: { criticalDefinition: { mode: 'longestPath' } } });
eq('47 longestPath: criticalPath = {A1,END}', JSON.stringify([...rLP.criticalPath].sort()), JSON.stringify(['A1', 'END']));
eq('48 longestPath: A2 niet kritiek', rLP.tasks.get('A2')!.isCritical, false);
// Discriminator: A2 krijgt tf=0 via een deadline, tóch NIET kritiek in longestPath (ongeacht tf).
const netAdl: Task[] = [mkTask('A1', 5), mkTask('A2', 4, { deadline: '2026-06-04' }), mkTask('A3', 2), mkTask('END', 1)];
const rDlDefault = solve(netAdl, seqA);
const rDlLP = solve(netAdl, seqA, { schedulingOptions: { criticalDefinition: { mode: 'longestPath' } } });
eq('49 deadline: A2 tf=0', rDlDefault.tasks.get('A2')!.totalFloat, 0);
eq('50 deadline+totalFloat: A2 kritiek (tf≤0)', rDlDefault.tasks.get('A2')!.isCritical, true);
eq('51 deadline+longestPath: A2 NIET kritiek (ongeacht tf=0)', rDlLP.tasks.get('A2')!.isCritical, false);
eq('52 deadline+longestPath: criticalPath = {A1,END}', JSON.stringify([...rDlLP.criticalPath].sort()), JSON.stringify(['A1', 'END']));

// ── 12) Golf 2 — makeOpenEndedCritical (§3.4): OA(1)→FS OB(2); OA→FS OC(5) ─────
const netO: Task[] = [mkTask('OA', 1), mkTask('OB', 2), mkTask('OC', 5)];
const seqO: Sequence[] = [fs('o1', 'OA', 'OB'), fs('o2', 'OA', 'OC')];
const rODefault = solve(netO, seqO);
const rOForce = solve(netO, seqO, { schedulingOptions: { makeOpenEndedCritical: true } });
eq('53 open-ended default: OB niet kritiek', rODefault.tasks.get('OB')!.isCritical, false);
eq('54 open-ended default: OB tf=3', rODefault.tasks.get('OB')!.totalFloat, 3);
eq('55 makeOpenEndedCritical: OB kritiek', rOForce.tasks.get('OB')!.isCritical, true);
eq('56 makeOpenEndedCritical: OB tf geforceerd 0', rOForce.tasks.get('OB')!.totalFloat, 0);
eq('57 makeOpenEndedCritical: OC blijft kritiek', rOForce.tasks.get('OC')!.isCritical, true);
eq('58 makeOpenEndedCritical: OB intf=tf−ff invariant', rOForce.tasks.get('OB')!.interferingFloat, 0);

// ── 13) Golf 2 — TF-berekeningswijze (§3.4): observationeel identiek in de symmetrische ─
//        backward-pass (LS=LF−dur ⇒ start-float == finish-float). Byte-inert bewezen via digest.
eq('59 totalFloatMode finish ⇒ digest identiek', digest(solve(netA, seqA, { schedulingOptions: { totalFloatMode: 'finish' } })), digest(rA));
eq('60 totalFloatMode start ⇒ digest identiek', digest(solve(netA, seqA, { schedulingOptions: { totalFloatMode: 'start' } })), digest(rA));

// ── 14) Golf 3 — multiple float paths: FREE_FLOAT-peel op net A (§4.6) ─────────
const rFP = solve(netA, seqA, { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } } });
eq('61 free-float: A1=1', rFP.floatPathByTask['A1'], 1);
eq('62 free-float: END=1 (zelfde driving-keten als A1)', rFP.floatPathByTask['END'], 1);
eq('63 free-float: A2=2', rFP.floatPathByTask['A2'], 2);
eq('64 free-float: A3=3', rFP.floatPathByTask['A3'], 3);
// Byte-compat-invariant (§4.6, expliciet gevraagd): criticalPaths[0] === criticalPath.
eq('65 free-float: criticalPaths[0] == criticalPath', JSON.stringify(rFP.criticalPaths[0]), JSON.stringify(rFP.criticalPath));
eq('66 free-float: precies 1 kritieke keten', rFP.criticalPaths.length, 1);
eq('67 free-float: criticalPaths[0] = [A1,END]', JSON.stringify(rFP.criticalPaths[0]), JSON.stringify(['A1', 'END']));
// Elke toegewezen taak precies één floatPath: map ↔ per-taak-veld consistent; alle 4 toegewezen.
eq('68 free-float: alle 4 taken een floatPath', Object.keys(rFP.floatPathByTask).length, 4);
eq('69 free-float: per-taak floatPath == floatPathByTask',
  [...rFP.tasks.entries()].every(([id, t]) => t.floatPath === rFP.floatPathByTask[id]), true);

// ── 15) Golf 3 — TOTAL_FLOAT-rangschikking (distinct tf {0,1,3}) ───────────────
const rTFp = solve(netA, seqA, { schedulingOptions: { floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 10 } } });
eq('70 total-float: A1=1 (tf0)', rTFp.floatPathByTask['A1'], 1);
eq('71 total-float: END=1 (tf0, zelfde rang)', rTFp.floatPathByTask['END'], 1);
eq('72 total-float: A2=2 (tf1)', rTFp.floatPathByTask['A2'], 2);
eq('73 total-float: A3=3 (tf3)', rTFp.floatPathByTask['A3'], 3);
eq('74 total-float: criticalPaths[0] == criticalPath', JSON.stringify(rTFp.criticalPaths[0]), JSON.stringify(rTFp.criticalPath));

// ── 16) Golf 3 — maxPaths harde begrenzing: A3 krijgt GEEN floatPath ───────────
const rMax2 = solve(netA, seqA, { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 2 } } });
eq('75 maxPaths2: A1=1', rMax2.floatPathByTask['A1'], 1);
eq('76 maxPaths2: A2=2', rMax2.floatPathByTask['A2'], 2);
eq('77 maxPaths2: A3 GEEN floatPath (map)', rMax2.floatPathByTask['A3'], undefined);
eq('78 maxPaths2: A3 GEEN floatPath (per-taak)', rMax2.tasks.get('A3')!.floatPath, undefined);
eq('79 maxPaths2: precies 3 toegewezen', Object.keys(rMax2.floatPathByTask).length, 3);
// Harde grens óók bij een groter net: 6 parallelle paden, maxPaths=2 ⇒ hoogste padnummer 2.
const netBig: Task[] = [mkTask('END', 1)];
const seqBig: Sequence[] = [];
for (let i = 1; i <= 6; i++) { netBig.unshift(mkTask('T' + i, i)); seqBig.push(fs('bs' + i, 'T' + i, 'END')); }
const rBig = solve(netBig, seqBig, { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 2 } } });
eq('80 groot net maxPaths2: hoogste padnummer 2', Math.max(...Object.values(rBig.floatPathByTask)), 2);

// ── 17) Golf 3 — enabled=false ⇒ VOLLEDIG inert (byte-identiek golf 0) ─────────
const rDis = solve(netA, seqA, { schedulingOptions: { floatPaths: { enabled: false, method: 'FREE_FLOAT', maxPaths: 10 } } });
eq('81 disabled: floatPathByTask leeg', Object.keys(rDis.floatPathByTask).length, 0);
eq('82 disabled: criticalPaths == [criticalPath]', JSON.stringify(rDis.criticalPaths), JSON.stringify([rDis.criticalPath]));
eq('83 disabled: geen per-taak floatPath', [...rDis.tasks.values()].every(t => t.floatPath === undefined), true);
eq('84 disabled: digest byte-identiek aan geen-opties', digest(rDis), digest(rA));

// ── 18) Golf 3 — gedeelde voorganger over twee ketens: nummer van de EERSTE peel ─
// S(3) root; S→FS B(5) (langste keten), S→FS C(2). S is driving-voorganger van B én C.
const netSh: Task[] = [mkTask('S', 3), mkTask('B', 5), mkTask('C', 2)];
const seqSh: Sequence[] = [fs('sh1', 'S', 'B'), fs('sh2', 'S', 'C')];
const rSh = solve(netSh, seqSh, { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } } });
eq('85 gedeeld: B=1 (langste keten peelt eerst)', rSh.floatPathByTask['B'], 1);
eq('86 gedeeld: S=1 (padnummer van de EERSTE peel)', rSh.floatPathByTask['S'], 1);
eq('87 gedeeld: C=2 (tweede peel; S houdt zijn 1)', rSh.floatPathByTask['C'], 2);
eq('88 gedeeld: criticalPaths[0] == criticalPath', JSON.stringify(rSh.criticalPaths[0]), JSON.stringify(rSh.criticalPath));
eq('89 gedeeld: criticalPaths[0] = [S,B]', JSON.stringify(rSh.criticalPaths[0]), JSON.stringify(['S', 'B']));

// ── 19) Golf 4 — hammocks (§4.4) ──────────────────────────────────────────────
// Relatie-helpers voor de driver-topologie: SS/FS = start-driver, FF/SF = finish-driver (B6).
function lk(id: string, pred: string, succ: string, type: Sequence['type']): Sequence {
  return { id, predecessorId: pred, successorId: succ, type, lagDays: 0 };
}
// Hammock H met start-driver SS(A→H) en finish-driver FF(B→H); A(3)→FS B(dur). Ongewijzigde
// driver-topologie van S10; alleen B's duur varieert (⇒ her-spanning van de hammock).
function s10(bDur: number): { r: CPMResult; tasks: Task[] } {
  const tasks = [mkTask('A', 3), mkTask('B', bDur), mkTask('H', 1, { isHammock: true })];
  const seqs = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
  return { r: solve(tasks, seqs), tasks };
}
const engDay = new CalendarEngine(CAL);

// S10-v1 (B dur2): H 06-01..06-05, span 5 werkdagen; nooit kritiek.
const s10a = s10(2);
const hA = s10a.r.tasks.get('H')!;
eq('90 S10-v1: H.es', hA.earlyStart, '2026-06-01');
eq('91 S10-v1: H.ef', hA.earlyFinish, '2026-06-05');
eq('92 S10-v1: H tf=0', hA.totalFloat, 0);
eq('93 S10-v1: H ff=0', hA.freeFloat, 0);
eq('94 S10-v1: H interfering=0', hA.interferingFloat, 0);
eq('95 S10-v1: H NOOIT kritiek', hA.isCritical, false);
eq('96 S10-v1: H niet in criticalPath', s10a.r.criticalPath.includes('H'), false);
eq('97 S10-v1: criticalPath = {A,B}', JSON.stringify([...s10a.r.criticalPath].sort()), JSON.stringify(['A', 'B']));
// 8.4-d: hammock-span == workDaysBetween(ES,EF); zelfstandig herberekend via CalendarEngine.
eq('98 S10-v1: afgeleide scheduleDuration = span 5', s10a.tasks.find(t => t.id === 'H')!.time.scheduleDuration, 5);
eq('99 S10-v1: span == workDaysBetween(ES,EF)',
  s10a.tasks.find(t => t.id === 'H')!.time.scheduleDuration,
  engDay.workDaysBetween(parseDate(hA.earlyStart), parseDate(hA.earlyFinish)));

// S10-v2 (B dur4): driver verschuift ⇒ H her-spant naar EF 06-09, span 7.
const s10b = s10(4);
const hB = s10b.r.tasks.get('H')!;
eq('100 S10-v2: H.ef her-spant naar 06-09', hB.earlyFinish, '2026-06-09');
eq('101 S10-v2: afgeleide scheduleDuration = span 7', s10b.tasks.find(t => t.id === 'H')!.time.scheduleDuration, 7);
eq('102 S10-v2: span == workDaysBetween(ES,EF)',
  s10b.tasks.find(t => t.id === 'H')!.time.scheduleDuration,
  engDay.workDaysBetween(parseDate(hB.earlyStart), parseDate(hB.earlyFinish)));
eq('103 S10-v2: H nooit kritiek', hB.isCritical, false);

// Uur-modus hammock (H8, band [480,960]): fractionele span (600 werkmin = 1,25 dag). 8.4-d in uur-modus.
const H8: WorkCalendar = {
  id: 'h8', name: 'h8', description: 'h8',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [] } },
} as unknown as WorkCalendar;
function mkH(id: string, mins: number, extra: Partial<Task> = {}): Task {
  const t = mkTask(id, mins / 480, extra);           // scheduleStart 2026-06-01 (ongebruikt) → anker in H8
  t.time = createDefaultTaskTime('2026-07-06', mins / 480);
  t.time.durationMinutes = mins;
  return t;
}
const engH8 = new CalendarEngine(H8);
const hourTasks = [mkH('A', 240), mkH('B', 360), mkH('H', 480, { isHammock: true })];
const hourSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
const rHour = new CPMSolver(hourTasks, hourSeq, H8, [], {}).solve();
const hH = rHour.tasks.get('H')!;
eq('104 uur: H.es', hH.earlyStart, '2026-07-06T08:00');
eq('105 uur: H.ef', hH.earlyFinish, '2026-07-07T10:00');
eq('106 uur: H fractionele durationMinutes = 600', hourTasks.find(t => t.id === 'H')!.time.durationMinutes, 600);
eq('107 uur: scheduleDuration = 1.25 dag', hourTasks.find(t => t.id === 'H')!.time.scheduleDuration, 1.25);
// 8.4-d uur: span == workMinutesBetween(ES,EF), zelfstandig herberekend.
eq('108 uur: span == workMinutesBetween(ES,EF)',
  hourTasks.find(t => t.id === 'H')!.time.durationMinutes,
  engH8.workMinutesBetween(parseInstant(hH.earlyStart), parseInstant(hH.earlyFinish)));
eq('109 uur: H tf=0 ff=0 nooit kritiek', hH.totalFloat === 0 && hH.freeFloat === 0 && hH.isCritical === false, true);

// Hammock zónder finish-driver ⇒ EF=ES (nul-lengte) + waarschuwing in het resultaat.
const nfdTasks = [mkTask('A', 3), mkTask('H', 1, { isHammock: true })];
const rNfd = solve(nfdTasks, [lk('l2', 'A', 'H', 'START_START')]);
const hNfd = rNfd.tasks.get('H')!;
eq('110 geen finish-driver: H.ef == H.es (nul-lengte)', hNfd.earlyFinish, hNfd.earlyStart);
eq('111 geen finish-driver: waarschuwing gerapporteerd', JSON.stringify(rNfd.hammockNoFinishDriverTaskIds), JSON.stringify(['H']));
eq('112 geen finish-driver: H nog steeds nooit kritiek', hNfd.isCritical, false);
eq('113 met finish-driver: waarschuwingslijst leeg', JSON.stringify(s10a.r.hammockNoFinishDriverTaskIds), JSON.stringify([]));

// Hammock met opvolger (§4.4): FS vanaf H rekent forward door; H geeft GEEN backward-druk aan de
// drivers. Een STRAKKE opvolger (Z FNLT ⇒ Z negatief) mag NIET via de hammock heen negatieve float
// op de start-/finish-driver leggen — A/B houden hun eigen (positieve) float.
const succTasks = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }),
  mkTask('Z', 2, { constraint: { type: 'FNLT', date: '2026-06-08' } })];
const succSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'),
  lk('l3', 'B', 'H', 'FINISH_FINISH'), lk('l4', 'H', 'Z', 'FINISH_START')];
const rSucc = solve(succTasks, succSeq);
eq('114 opvolger: Z.es (FS vanaf H rekent forward door)', rSucc.tasks.get('Z')!.earlyStart, '2026-06-08');
eq('115 opvolger: Z negatief door FNLT (tf=-1)', rSucc.tasks.get('Z')!.totalFloat, -1);
eq('116 opvolger: start-driver A GEEN negatieve float via hammock (tf=2)', rSucc.tasks.get('A')!.totalFloat, 2);
eq('117 opvolger: finish-driver B GEEN negatieve float via hammock (tf=2)', rSucc.tasks.get('B')!.totalFloat, 2);
eq('118 opvolger: H blijft LS=ES/LF=EF ⇒ tf=0, nooit kritiek', rSucc.tasks.get('H')!.totalFloat === 0 && rSucc.tasks.get('H')!.isCritical === false, true);
eq('119 opvolger: criticalPath = {Z} (alleen de echte eindketen)', JSON.stringify([...rSucc.criticalPath].sort()), JSON.stringify(['Z']));

// Float-paths negeren de hammock (§4.4/§4.6): H nooit in floatPathByTask.
const rFpHam = solve(
  [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }), mkTask('Z', 2)],
  [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH'), lk('l4', 'H', 'Z', 'FINISH_START')],
  { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } } },
);
eq('120 float-paths: H NIET in floatPathByTask', rFpHam.floatPathByTask['H'], undefined);
eq('121 float-paths: H per-taak floatPath ongeschreven', rFpHam.tasks.get('H')!.floatPath, undefined);
eq('122 float-paths: Z=1 (echte eindketen)', rFpHam.floatPathByTask['Z'], 1);
eq('123 float-paths: criticalPaths bevat H niet', rFpHam.criticalPaths.every(p => !p.includes('H')), true);

// isHammock afwezig ≡ isHammock:false ≡ gewone taak (byte-identiek). H als gewone taak ⇒ ES via de
// volledige max (incl. FF-start-equivalent) ⇒ ANDER resultaat dan een hammock (bewijst dat de vlag telt).
const plainTasks = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1)];
const plainFalse = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: false })];
const plainSeq = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
eq('124 isHammock afwezig ≡ false (byte-identieke solve)', digest(solve(plainFalse, plainSeq)), digest(solve(plainTasks, plainSeq)));
eq('125 gewone taak ≠ hammock (vlag heeft effect: H kritiek als gewone taak)', solve(plainTasks, plainSeq).tasks.get('H')!.isCritical, true);
eq('126 hammock-tweeling: H als hammock is NIET kritiek', s10a.r.tasks.get('H')!.isCritical, false);
// Twee keer solve op dezelfde task-objecten (afgeleide-duur-mutatie) ⇒ idempotent.
const idemT = [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true })];
const idemS = [lk('l1', 'A', 'B', 'FINISH_START'), lk('l2', 'A', 'H', 'START_START'), lk('l3', 'B', 'H', 'FINISH_FINISH')];
const idem1 = digest(new CPMSolver(idemT, idemS, CAL, [], {}).solve());
const idem2 = digest(new CPMSolver(idemT, idemS, CAL, [], {}).solve());
eq('127 hammock: solve idempotent na duur-mutatie (zelfde digest)', idem1, idem2);

// ══════════════════════════════════════════════════════════════════════════════
//  Golf 5 (§4.5/§5.5) — externe (cross-project) dependencies: ververs-mapping, sourceMissing-gedrag,
//  IFC-round-trip. De SOLVER-kant (bevroren datum-grenzen: FS/SS start-grens, FF/SF finish-grens,
//  successor-bovengrens, uur-anker, lag-varianten) is handberekend in cases-advanced-cpm.json.
// ══════════════════════════════════════════════════════════════════════════════

// (a) externalSourceSide-mapping: welke brontaak-zijde (start/finish) elk relType leest (§4.5). De
//     conventie is voorganger→opvolger; bij `predecessor` telt het EERSTE teken (bron = mijn voorganger),
//     bij `successor` het TWEEDE (bron = mijn opvolger).
eq('128 side pred FS ⇒ finish', externalSourceSide('predecessor', 'FS'), 'finish');
eq('129 side pred FF ⇒ finish', externalSourceSide('predecessor', 'FF'), 'finish');
eq('130 side pred SS ⇒ start', externalSourceSide('predecessor', 'SS'), 'start');
eq('131 side pred SF ⇒ start', externalSourceSide('predecessor', 'SF'), 'start');
eq('132 side succ FS ⇒ start', externalSourceSide('successor', 'FS'), 'start');
eq('133 side succ SS ⇒ start', externalSourceSide('successor', 'SS'), 'start');
eq('134 side succ FF ⇒ finish', externalSourceSide('successor', 'FF'), 'finish');
eq('135 side succ SF ⇒ finish', externalSourceSide('successor', 'SF'), 'finish');

/** Brontaak met expliciete vroege datums (het anker leest earlyStart/earlyFinish, §4.5). */
function srcTask(id: string, es: string, ef: string): Task {
  const t = mkTask(id, 1);
  t.time.earlyStart = es; t.time.scheduleStart = es;
  t.time.earlyFinish = ef; t.time.scheduleFinish = ef;
  return t;
}
function extLink(
  id: string, direction: ExternalLink['direction'], relType: ExternalLink['relType'],
  ref: ExternalLink['sourceRef'], anchor = '2000-01-01', missing = true,
): ExternalLink {
  return { id, direction, relType, anchorDate: anchor, sourceRef: ref, sourceMissing: missing };
}

// (b) refreshExternalAnchors: elk relType leest de juiste brontaak-datum + zet sourceMissing=false.
const SRC_ES = '2026-06-05', SRC_EF = '2026-06-08';
const source: ExternalSourceDoc = {
  projectId: 'SRC', filePath: '/tmp/src.ifc', projectName: 'Bronproject',
  tasks: [srcTask('X', SRC_ES, SRC_EF)],
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
eq('140 ververs succ FS ⇒ bron.earlyStart', byId.get('s-fs')!.anchorDate, SRC_ES);
eq('141 ververs succ SS ⇒ bron.earlyStart', byId.get('s-ss')!.anchorDate, SRC_ES);
eq('142 ververs succ FF ⇒ bron.earlyFinish', byId.get('s-ff')!.anchorDate, SRC_EF);
eq('143 ververs succ SF ⇒ bron.earlyFinish', byId.get('s-sf')!.anchorDate, SRC_EF);
eq('144 ververs: alle 8 sourceMissing=false', (refreshed.tasks[0].externalLinks ?? []).every(l => l.sourceMissing === false), true);
eq('145 ververs: refreshed-teller = 8', refreshed.refreshed, 8);
eq('146 ververs: brontaak-naam gecanonicaliseerd', byId.get('p-fs')!.sourceRef.taskName, 'X');
eq('147 ververs: changed=true', refreshed.changed, true);

// (c) sourceMissing-gedrag: brontaak weg ⇒ sourceMissing=true + oud anker behouden; andere bron ⇒ ongemoeid.
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

// Fallback-match op filePath wanneer de projectId (nog) niet klopt (§3.3/§5.5).
const byPath: Task = mkTask('L3', 3, {
  externalLinks: [extLink('fp', 'predecessor', 'SS', { projectId: 'WRONG', taskId: 'X', filePath: '/tmp/src.ifc' }, '2000-01-01', true)],
});
const rPath = refreshExternalAnchors([byPath], source);
eq('155 filePath-fallback: gematcht ⇒ anker uit bron', rPath.tasks[0].externalLinks![0].anchorDate, SRC_ES);
eq('156 filePath-fallback: projectId gecanonicaliseerd naar bron', rPath.tasks[0].externalLinks![0].sourceRef.projectId, 'SRC');

// Byte-stabiliteit: een reeds-actueel document geeft dezelfde referentie terug (changed=false).
const already = refreshExternalAnchors(rPath.tasks, source);
eq('157 idempotent: tweede ververs ⇒ changed=false', already.changed, false);
eq('158 idempotent: task-referentie behouden', already.tasks[0] === rPath.tasks[0], true);

// Taak zonder links: onaangeroerd (referentie behouden).
const noLinks = [mkTask('N', 2)];
const rNo = refreshExternalAnchors(noLinks, source);
eq('159 geen-links: referentie behouden', rNo.tasks[0] === noLinks[0], true);
eq('160 geen-links: changed=false', rNo.changed, false);

// (d) IFC-round-trip van externe links: schrijf+lees terug (spiegel writeExternalLinks/OPS_ExternalLink).
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
const ifc = writeIFC(rtProject, CAL, [rtTask], [], [], []);
eq('161 IFC-write: OPS_ExternalLink-pset aanwezig', ifc.includes("'OPS_ExternalLink'"), true);
const backTask = readIFC(ifc).tasks.find(t => t.name === 'Local');
eq('162 IFC-round-trip: taak teruggevonden', !!backTask, true);
eq('163 IFC-round-trip: externalLinks byte-gelijk', JSON.stringify(backTask?.externalLinks ?? null), JSON.stringify(rtLinks));
// Geen links ⇒ geen pset (byte-identiek met bestaande bestanden).
const ifcNone = writeIFC(rtProject, CAL, [mkTask('Plain', 2)], [], [], []);
eq('164 IFC-write: geen links ⇒ geen OPS_ExternalLink-pset', ifcNone.includes('OPS_ExternalLink'), false);

// ══════════════════════════════════════════════════════════════════════════════
//  Golf 8 (§8.4 / testplan) — UNVERIFIED-gaten dichten + invariant-sweep.
// ══════════════════════════════════════════════════════════════════════════════

// ── 20) totalFloatMode 'start' vs 'finish' DISCRIMINATOR (scope 1b, de golf-2-vraag) ─────────────
// Golf 2 meldde 'start'/'finish'/'smallest' als "observationeel identiek in de huidige symmetrische
// backward-pass". Golf 8 bewijst dat hard op de netten die een verschil ZOUDEN tonen als het bestond.
// UITKOMST: PROVABLY identiek. De backward pass leidt de late start ALTIJD af als LF ⊖ duur in de
// EIGEN kalender (CPMSolver.ts:1175 `lateStart = subDuration(lateFinish, task)`). Daardoor is
// startFloat = signedFloat(ES,LS) per constructie exact gelijk aan finishFloat = signedFloat(EF,LF)
// voor élke taak — ES/LS en EF/LF verschillen door dezelfde duur-verschuiving binnen één kalender,
// dus hun werkdag-afstand is gelijk. Er is geen tak die LS onafhankelijk van LF kapt (ook een SNLT
// gaat via een LF-grens). Bewezen op (a) een SNLT-net met negatieve float (schijnbaar start-zijdig)
// en (b) een FRACTIONEEL uur-net (H8) met half-dag-floats.
function tfMap(r: CPMResult): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [id, t] of r.tasks) m[id] = t.totalFloat;
  return m;
}
// (a) S2-net: A(3)→FS B(2), B SNLT 06-03 ⇒ tf −1 (negatief).
const s2 = [mkTask('A', 3), mkTask('B', 2, { constraint: { type: 'SNLT', date: '2026-06-03' } })];
const s2seq = [fs('s2s', 'A', 'B')];
const s2start = tfMap(solve(s2, s2seq, { schedulingOptions: { totalFloatMode: 'start' } }));
const s2finish = tfMap(solve(s2, s2seq, { schedulingOptions: { totalFloatMode: 'finish' } }));
const s2small = tfMap(solve(s2, s2seq, { schedulingOptions: { totalFloatMode: 'smallest' } }));
eq('165 disc S2 (SNLT): start == finish per taak', JSON.stringify(s2start), JSON.stringify(s2finish));
eq('166 disc S2: smallest == start (drie modi identiek)', JSON.stringify(s2small), JSON.stringify(s2start));
eq('167 disc S2: waarde niet-triviaal (B tf=-1)', s2finish['B'], -1);
// (b) H8 uur-net Q1(16u),Q2(12u),Q3(8u)→FS ENDH(8u): fractionele floats.
const qn = [mkH('Q1', 960), mkH('Q2', 720), mkH('Q3', 480), mkH('ENDH', 480)];
const qs = [lk('qa', 'Q1', 'ENDH', 'FINISH_START'), lk('qb', 'Q2', 'ENDH', 'FINISH_START'), lk('qc', 'Q3', 'ENDH', 'FINISH_START')];
const qStart = tfMap(new CPMSolver(qn, qs, H8, [], { schedulingOptions: { totalFloatMode: 'start' } }).solve());
const qFinish = tfMap(new CPMSolver(qn, qs, H8, [], { schedulingOptions: { totalFloatMode: 'finish' } }).solve());
eq('168 disc uur: start == finish per taak (fractioneel)', JSON.stringify(qStart), JSON.stringify(qFinish));
eq('169 disc uur: Q2 fractionele tf=0.5 (niet-triviaal)', qFinish['Q2'], 0.5);
eq('170 disc uur: Q3 fractionele tf=1.0', qFinish['Q3'], 1);

// ── 21) Invariant-sweep (scope 3) over een representatieve reeks netten+opties ────────────────────
// Elke solve moet vier invarianten halen: (I1) interferingFloat == tf−ff voor élke taak; (I2)
// criticalPaths[0] == criticalPath én |criticalPaths| ≥ 1; (I3) een hammock heeft nooit een floatPath,
// is nooit near-critical en zit in geen kritieke keten; (I4, apart hieronder) 'start'/'finish'-tf gelijk.
const HAM = (): Task[] => [mkTask('A', 3), mkTask('B', 2), mkTask('H', 1, { isHammock: true }), mkTask('Z', 2)];
const HAMSEQ = [lk('hs1', 'A', 'B', 'FINISH_START'), lk('hs2', 'A', 'H', 'START_START'), lk('hs3', 'B', 'H', 'FINISH_FINISH'), lk('hs4', 'H', 'Z', 'FINISH_START')];
type Scen = { label: string; run: () => CPMResult; hammocks?: string[] };
const scen: Scen[] = [
  { label: 'netA', run: () => solve(netA, seqA) },
  { label: 'netA+near2', run: () => solve(netA, seqA, { schedulingOptions: { nearCriticalThreshold: 2 } }) },
  { label: 'netA+fp', run: () => solve(netA, seqA, { schedulingOptions: { floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } } }) },
  { label: 'netA+longest', run: () => solve(netA, seqA, { schedulingOptions: { criticalDefinition: { mode: 'longestPath' } } }) },
  { label: 'S2-neg', run: () => solve(s2, s2seq) },
  { label: 'pin', run: () => solve(pinTasks, pinSeq) },
  { label: 'ham+near2+fp', run: () => solve(HAM(), HAMSEQ, { schedulingOptions: { nearCriticalThreshold: 2, floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } } }), hammocks: ['H'] },
  { label: 'qnet-hour', run: () => new CPMSolver(qn, qs, H8, [], { schedulingOptions: { nearCriticalThreshold: 0.5 } }).solve() },
];
let sweepOk = true;
for (const s of scen) {
  const r = s.run();
  for (const [id, t] of r.tasks) {
    if (Math.abs((t.interferingFloat ?? NaN) - (t.totalFloat - t.freeFloat)) > 1e-9) { sweepOk = false; diffs.push(`sweep ${s.label}: ${id} intf≠tf−ff`); }
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
// I4 — 'start'/'finish'-tf identiek over de sweep-netten (bevestigt scope 1b breder dan één net).
const modeNets: { label: string; m: (mode: 'start' | 'finish') => CPMResult }[] = [
  { label: 'netA', m: mode => solve(netA, seqA, { schedulingOptions: { totalFloatMode: mode } }) },
  { label: 'S2', m: mode => solve(s2, s2seq, { schedulingOptions: { totalFloatMode: mode } }) },
  { label: 'pin', m: mode => solve(pinTasks, pinSeq, { schedulingOptions: { totalFloatMode: mode } }) },
  { label: 'ham', m: mode => solve(HAM(), HAMSEQ, { schedulingOptions: { totalFloatMode: mode } }) },
  { label: 'qnet', m: mode => new CPMSolver(qn, qs, H8, [], { schedulingOptions: { totalFloatMode: mode } }).solve() },
];
let modeOk = true;
for (const n of modeNets) if (JSON.stringify(tfMap(n.m('start'))) !== JSON.stringify(tfMap(n.m('finish')))) { modeOk = false; diffs.push(`mode ${n.label}: start≠finish`); }
eq('172 totalFloatMode start==finish over alle sweep-netten (I4)', modeOk, true);

// ── 22) Harde-pin-idempotentie ook in UUR-modus (scope 3; dag bestond als check 32) ──────────────
const hourPin = [mkH('A', 960), mkH('B', 480, { constraint: { type: 'MSO', date: '2026-07-07T08:00', hard: true } })];
const hourPinSeq = [lk('hp', 'A', 'B', 'FINISH_START')];
const hp1 = new CPMSolver(hourPin, hourPinSeq, H8, [], {}).solve();
const hp2 = new CPMSolver(hourPin, hourPinSeq, H8, [], {}).solve();
eq('173 uur harde pin: solve idempotent (zelfde digest)', digest(hp1), digest(hp2));
eq('174 uur harde pin: B gepind op 07-07T08:00 (logica gebroken)', hp1.tasks.get('B')!.earlyStart, '2026-07-07T08:00');
eq('175 uur harde pin: B in violatedConstraintTaskIds', hp1.violatedConstraintTaskIds.includes('B'), true);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  advanced-cpm-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  advanced-cpm-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
