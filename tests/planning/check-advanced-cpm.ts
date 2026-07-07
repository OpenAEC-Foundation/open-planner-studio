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
import { createDefaultTaskTime, type Task, type TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { FILTER_SORT_BUILTIN_KEYS, fieldKind, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';
import type { FieldRef, BuiltinFieldKey } from '@/state/slices/types';
import { validateConstraintPair } from '@/engine/scheduler/constraintValidation';

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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  advanced-cpm-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  advanced-cpm-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
