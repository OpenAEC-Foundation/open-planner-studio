// Geavanceerde-CPM golf-0-checks (fase 2.9). Bewijzen dat de datamodel-uitbreiding + plumbing
// DEFAULT-INERT is: een 2.8b-document (geen 2.9-velden) solvet byte-identiek, de nieuwe
// CPMResult-velden dragen hun inerte defaults, de nieuwe per-taak-velden blijven ongeschreven, en
// de velden-catalogus kent de vier nieuwe keys. GEEN gedragswijziging in golf 0.
//
// Draait via run.sh (esbuild-bundel, zoals check-datetime.ts). Exit 0 = alles groen.
import { CPMSolver, type CPMResult, type CPMOptions } from '@/engine/scheduler/CPMSolver';
import { createDefaultTaskTime, type Task, type TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { FILTER_SORT_BUILTIN_KEYS, fieldKind, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';
import type { FieldRef, BuiltinFieldKey } from '@/state/slices/types';

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
 *  entries), zodat "byte-identiek" hard te vergelijken is. De 2.9-analyse-velden zitten er BEWUST
 *  NIET in — die horen in golf 0 ongeschreven te blijven (apart gecheckt). */
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

// ── 3) Per-taak-analyse-velden ONGESCHREVEN bij default (§3.5) ────────────────
const all = [...rA.tasks.values()];
eq('14 elke taak interferingFloat === undefined', all.every(t => t.interferingFloat === undefined), true);
eq('15 elke taak isNearCritical === undefined', all.every(t => t.isNearCritical === undefined), true);
eq('16 elke taak floatPath === undefined', all.every(t => t.floatPath === undefined), true);

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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  advanced-cpm-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  advanced-cpm-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
