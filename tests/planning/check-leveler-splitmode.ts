// check-leveler-splitmode.ts — B1c-plan-2 taak 9: "Onderbrekingen toestaan" (spec §4, stap 0).
// `allowSplits` laat de nivelleerder een taak dag-voor-dag plaatsen (leveling-gaten) i.p.v. haar
// als geheel te laten uitlopen, MAAR uitsluitend als fallback: de bestaande aaneengesloten-scan
// blijft altijd EERST geprobeerd. Zonder een venster (`overrunCeilingDays`/`constrainToFloat`) vindt
// die scan op den duur altijd een aaneengesloten gat (elke taak heeft een eindige duur), dus elke
// case hieronder die daadwerkelijk een gat wil ZIEN geeft de wijkende taak een eigen deadline (float
// 0) + een plafond — precies zoals `check-leveler-ceiling.ts` geval 2 dat al doet voor de gewone
// uitloop. Helperstijl gekopieerd uit `check-leveler-splits.ts`/`check-leveler-ceiling.ts`.
//
// Gedeelde weekfixture: PROJECT_CAL (ma-vr, 8u/dag), week ma 2026-06-01 t/m vr 2026-06-05, volgende
// week ma 2026-06-08.
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { enumerateTaskWorkDays } from '@/engine/scheduler/splitWalk';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';

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

const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project-splitmode', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const projEng = new CalendarEngine(PROJECT_CAL);

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

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM' };
}

function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

// Een "blokker": hoge prioriteit, bezet ma+wo+do van zijn resource via een IMPORTSPLIT die dinsdag
// overslaat (afterMinutes 480 = 1 werkdag, gapMinutes 480 = 1 werkdag) — zo ontstaat een ISOLATED
// vrije dag (di) tussen twee bezette dagen, precies het patroon waarop scatter-plaatsing wint van
// een aaneengesloten venster (een aaneengesloten scan kan een los-liggende dag nooit gebruiken).
function blocker(id: string, resourceId: string): { t: Task; a: ResourceAssignment } {
  return {
    t: task(id, '2026-06-01', '2026-06-04', 3, {
      priority: 900,
      splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
    }),
    a: assign(`${id}-r`, id, resourceId, 1),
  };
}

const LEVEL_OPTS_OFF: LevelingOptions = { constrainToFloat: false };
// Deadline op de EIGEN vroege finish (float 0) + een plafond van 3 werkdagen — hetzelfde recept als
// `check-leveler-ceiling.ts` geval 2, nu gecombineerd met `allowSplits`. Met dit plafond faalt de
// aaneengesloten scan van elke wijkende taak hieronder ALTIJD binnen haar venster (de blokker bezet
// precies de eerste drie kandidaatdagen op een manier die geen twee-daagse aaneengesloten rest laat
// vóór het venster dichtklapt), terwijl de scatter-plaatsing de losse dag (di) + de eerste vrije dag
// ná de blokker (vr) wél binnen haar (ruimere) finish-venster krijgt.
const CEILING = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: uit ⇒ uitlopen (geen gaten), aan ⇒ onderbreken (één leveling-gat).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splitmode: uit=uitloop, aan=onderbreking (geval 1) --');
{
  // rOff: A zonder split, bezet gewoon ma/di/wo aaneengesloten (het gedrag van vóór B1c-plan-2
  // taak 9 — geen plafond nodig, B loopt gewoon uit tot de eerste vrije aaneengesloten dag: do).
  const taskAPlain = task('a1', '2026-06-01', '2026-06-03', 3, { priority: 900 });
  const taskBOff = task('b1', '2026-06-01', '2026-06-02', 2, { priority: 100 });
  const resourceOff = res('r-split1-off', 1);
  const assignmentsOff = [
    assign('a1-r', 'a1', 'r-split1-off', 1),
    assign('b1-r', 'b1', 'r-split1-off', 1),
  ];
  const rOff = levelResources(
    [taskAPlain, taskBOff], [], [resourceOff], assignmentsOff, PROJECT_CAL, [], stubCpmResult('2026-06-03'),
    LEVEL_OPTS_OFF,
  );
  eq('zonder onderbrekingen: B loopt uit (start do, delay 3)', rOff.delays['b1'], 3);
  eq('zonder onderbrekingen: geen gaten geschreven', rOff.gaps['b1'], undefined);

  // rOn: dezelfde vraag, maar de blokker A heeft een importsplit (bezet ma+wo+do, di vrij), B
  // draagt een deadline op haar eigen vroege finish (di, float 0) + plafond 3.
  const blk1 = blocker('a1s', 'r-split1-on');
  const taskBOn = task('b1s', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
  });
  const resourceOn = res('r-split1-on', 1);
  const assignmentsOn = [blk1.a, assign('b1s-r', 'b1s', 'r-split1-on', 1)];
  const rOn = levelResources(
    [blk1.t, taskBOn], [], [resourceOn], assignmentsOn, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  eq('met onderbrekingen: B start op de eerste vrije dag (di, delay 1)', rOn.delays['b1s'], 1);
  ok('met onderbrekingen: B krijgt precies één leveling-gat',
    rOn.gaps['b1s']?.length === 1 && rOn.gaps['b1s'][0].source === 'leveling');
  eq('gaten reproduceren de echte geboekte werkdagen (di, vr)',
    enumerateTaskWorkDays(rOn.gaps['b1s'], projEng, '2026-06-02', 2),
    ['2026-06-02', '2026-06-05']);

  // ── Geval 2: de trial-solve ZIET de gaten ─────────────────────────────────────────────────────
  // `projectEndAfter` komt uit één proef-CPM-run op de werkkopieën (A1) — staat het gat niet op de
  // werkkopie vóór die run, dan belooft de preview een einddatum die runCPM nooit haalt. B se nieuwe
  // (opgerekte) finish is vr 06-05 — later dan de blokker A se eigen finish (do 06-04) — dus B moet
  // de projecteinddatum bepalen wanneer (en alleen wanneer) de trial-solve het gat daadwerkelijk ziet.
  eq('projectEndAfter houdt rekening met de opgerekte spanne van B (via het gat)',
    rOn.projectEndAfter, '2026-06-05');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3: de v1-grens — een taak in uitvoering (completion > 0) en een ELAPSEDTIME-taak krijgen
// NOOIT een leveling-gat, ook niet met `allowSplits: true` en exact dezelfde blokker/plafond-vorm.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splitmode: v1-grens — completion>0 en ELAPSEDTIME (geval 3) --');
{
  // CDone: completion 1 ZONDER actualFinish — dat is de rand van isCompletedTask/isInProgressTask
  // (geen van beide vlagt haar als onverplaatsbaar), dus ze is nog gewoon MOVABLE en loopt door
  // findSlot — maar `completion !== 0` sluit haar uit van scatter (splitEligible).
  const blk3 = blocker('x3', 'r-split3');
  const taskCDone = task('cdone3', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 2,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 1, // completion 1, GEEN actualFinish
    },
  });
  const resource3 = res('r-split3', 1);
  const assignments3 = [blk3.a, assign('cdone3-r', 'cdone3', 'r-split3', 1)];
  const r3 = levelResources(
    [blk3.t, taskCDone], [], [resource3], assignments3, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  eq('completion > 0 ⇒ geen leveling-gaten, alleen (evt. onopgeloste) uitloop', r3.gaps['cdone3'], undefined);

  // E: ELAPSEDTIME — geen werkdagbegrip, fysiek niet stil te zetten. Zelfde blokker/plafond-vorm,
  // op ELAPSEDTIME-as (kalenderdagen i.p.v. werkdagen) vertaald.
  const blk4 = blocker('x4', 'r-split4');
  const taskE = task('e4', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 2,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const resource4 = res('r-split4', 1);
  const assignments4 = [blk4.a, assign('e4-r', 'e4', 'r-split4', 1)];
  const r4 = levelResources(
    [blk4.t, taskE], [], [resource4], assignments4, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  eq('ELAPSEDTIME ⇒ geen leveling-gaten', r4.gaps['e4'], undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3b: uur-modus-taken ZIJN split-eligible sinds eigenaarsbesluit 2026-08-31 — de PAUZE is en
// blijft een hele werkdag, ook al is H se eigen duur in werkuren gemeten (16 werkuur = 2 werkdagen
// à 8u). Zelfde blokker/plafond-vorm als geval 1's "aan"-scenario.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splitmode: uur-modus is split-eligible (geval 3b) --');
{
  const blk5 = blocker('x5', 'r-split5');
  const taskH = task('h5', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 2, durationMinutes: 960,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const resource5 = res('r-split5', 1);
  const assignments5 = [blk5.a, assign('h5-r', 'h5', 'r-split5', 1)];
  const r5 = levelResources(
    [blk5.t, taskH], [], [resource5], assignments5, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  ok('uur-modus krijgt precies één leveling-gat (een hele werkdag pauze)',
    r5.gaps['h5']?.length === 1 && r5.gaps['h5'][0].source === 'leveling');
  eq('uur-modus: gaten reproduceren de echte geboekte werkdagen (di, vr)',
    enumerateTaskWorkDays(r5.gaps['h5'], projEng, '2026-06-02', 2),
    ['2026-06-02', '2026-06-05']);
  eq('uur-modus: delay is 1 werkdag (start op di)', r5.delays['h5'], 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 4: een bestaande importsplit blijft staan naast een nieuw leveling-gat — de leveler mag een
// bronsplit NOOIT weggooien. F draagt een importsplit die, geklemd op haar eigen duur, GEEN
// zichtbare pauze oplevert (`afterMinutes` ver voorbij haar eigen werkinhoud) — puur om aan te tonen
// dat de bestaande array-invoer intact blijft naast de nieuwe gat-entry.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splitmode: importsplit blijft, leveling-gat komt erbij (geval 4) --');
{
  const blk6 = blocker('x6', 'r-split6');
  const taskF = task('f6', '2026-06-01', '2026-06-02', 2, {
    priority: 100, deadline: '2026-06-02',
    splitGaps: [{ afterMinutes: 5000, gapMinutes: 100 }], // geklemd, dus inert — zie testcommentaar
  });
  const resource6 = res('r-split6', 1);
  const assignments6 = [blk6.a, assign('f6-r', 'f6', 'r-split6', 1)];
  const r6 = levelResources(
    [blk6.t, taskF], [], [resource6], assignments6, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  ok('importsplit blijft, leveling-gat komt erbij',
    r6.gaps['f6']?.filter(g => g.source === undefined).length === 1);
  ok('en er komt precies één NIEUW leveling-gat bij',
    r6.gaps['f6']?.filter(g => g.source === 'leveling').length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// B1c-plan3 taak 1: scatter-randen (bevindingen 12, 11, 7 uit de eindkeuring van etappe 2).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- B1c-plan3 taak 1: scatter-randen --');

// ── Bevinding 12: `scatterSlot` mag nooit een LEGE dagenset als "geplaatst" teruggeven ────────────
// Een taak met een FRACTIONELE duur strikt tussen 0 en 1 (bv. 0,5) levert bij `distributeUnits` een
// LEGE vraagarray per resource (`durationDays <= 1 && durationDays !== 1` ⇒ `[]`), dus `need` (de
// lengte van die array) wordt 0 — `scatterSlot` gaf dan `[]` terug, dat is truthy, en `findSlot` deed
// `parseDate(scatterDays[0])` op `undefined` ⇒ een Invalid Date als starttijd.
//
// ONDERZOCHT (afwijking van het letterlijke voorschrift, zie ook het commitbericht): met de huidige
// `fits()`/`occurrenceFor()`-implementatie is een lege vraagarray voor ELKE resource van de taak
// tegelijk (de arraylengte hangt uitsluitend af van de taak-eigen duur, niet per resource) — dus
// `fits()` slaagt DAARDOOR triviaal (de binnenlus over een lege array loopt nul keer), en
// `occurrenceFor` levert voor zo'n fractionele duur altijd minstens één dag op (`consumeWorkDays`
// rondt af naar boven). De aaneengesloten scan in `findSlot` plaatst zo'n taak dus altijd al op de
// EERSTE kandidaat, ongeacht plafond/blokkers, en bereikt `scatterSlot` in de praktijk nooit — deze
// case kan daarom niet "rood" draaien vóór de fix (geverifieerd met een side-by-side probe tegen
// deze exacte fixture). De guard blijft niettemin correct en nuttig als vangnet: hij bewaakt precies
// de invariant die het eigen commentaar in `ResourceLeveler.ts` beschrijft, en deze case pint die
// invariant voor het geval een toekomstige wijziging aan `distributeUnits`/`occurrenceFor` de
// symmetrie tussen vraaglengte en dagenlengte doorbreekt.
{
  const blk = blocker('x7', 'r-split7');
  const taskZ = task('z7', '2026-06-01', '2026-06-01', 0.5, {
    priority: 100, deadline: '2026-06-01',
  });
  const resource7 = res('r-split7', 1);
  const assignments7 = [blk.a, assign('z7-r', 'z7', 'r-split7', 1)];
  const rEmpty = levelResources(
    [blk.t, taskZ], [], [resource7], assignments7, PROJECT_CAL, [], stubCpmResult('2026-06-04'),
    { constrainToFloat: false, overrunCeilingDays: CEILING, allowSplits: true },
  );
  ok('lege scatter levert nooit een Invalid Date als start',
    !isNaN(parseDate(rEmpty.shifts['z7']?.newStart ?? '2026-06-01').getTime()));
  eq('lege scatter schrijft geen gaten', rEmpty.gaps['z7'], undefined);
}

// ── Bevinding 11: zonder bindend venster stopt de scatter-scan op de HORIZON, niet op 200.000 ─────
// `allowSplits: true`, GEEN `overrunCeilingDays`, GEEN `constrainToFloat`, en N onafhankelijke
// taken die elk hun eigen resource hebben met `availabilitySteps` naar 0 vanaf de projectstart —
// `scatterSlot` vindt dan nooit een dag. Vóór de fix liep elke taak afzonderlijk HARD_SCAN_CAP
// (200.000) kandidaten af (gemeten: ~2,9s voor 20 taken); erna stopt elke scan op de
// grootboekhorizon (hier: dezelfde `scanLimit`-ondergrens als de aaneengesloten scan, want er is
// geen `poolLedger`) en meldt de eerlijke reden.
{
  const N = 20;
  const tasksN: Task[] = [];
  const resourcesN: Resource[] = [];
  const assignsN: ResourceAssignment[] = [];
  for (let i = 0; i < N; i++) {
    tasksN.push(task(`nw${i}`, '2026-06-01', '2026-06-02', 2, { priority: 100 }));
    resourcesN.push(res(`r-nw${i}`, 1, { availabilitySteps: [{ from: '2026-06-01', maxUnits: 0 }] }));
    assignsN.push(assign(`nw${i}-a`, `nw${i}`, `r-nw${i}`, 1));
  }
  const t0 = Date.now();
  const rNoWindow = levelResources(
    tasksN, [], resourcesN, assignsN, PROJECT_CAL, [], stubCpmResult('2026-06-02'),
    { constrainToFloat: false, allowSplits: true },
  );
  const elapsedMs = Date.now() - t0;
  eq('geen eindeloze scatter-scan: eerlijke horizon-reden', rNoWindow.unresolvedReasons['nw0'], 'NO_WINDOW_IN_HORIZON');
  // Prestatie is GEEN poort, maar de orde van grootte wél zichtbaar. Vóór de fix duurde dit geval
  // (20 onafhankelijke onplaatsbare taken, elk een eigen HARD_SCAN_CAP-scan) ruim 2,9 seconden.
  ok('en hij is niet meer traag', elapsedMs < 2000);
}

// ── Bevinding 7: fractionele uur-modus in de scatter (2,5 dag / 1200 minuten) ─────────────────────
// Taak H: `durationUnit: 'hours'`, `durationMinutes: 1200` (20 werkuur), `scheduleDuration: 2.5` op
// een 8u-kalender, `durationType: 'WORKTIME'`, `completion: 0`, prio 100. Resource R (cap 1) is
// ma+wo bezet door een prio-900-taak (blokker met een importsplit die alleen dinsdag overslaat).
// Met `allowSplits` landt H op di, do en vr: `distributeUnits` rondt 2,5 af naar DRIE curve-slots,
// dus `need === 3` — niet 2 (`Math.floor`) en niet 2,5.
//
// AFWIJKING van het letterlijke voorschrift: het plan verwachtte "precies twee leveling-gaten (na
// di en na do)"; met deze blokker (die alleen woensdag bezet) sluiten do en vr op elkaar aan (geen
// kalenderdag ertussen), dus er ontstaat maar één leveling-gat (na di, wo overslaand). De kern van
// de bevinding — drie curve-slots i.p.v. twee of 2,5 — blijft volledig gedekt door de exacte
// dagenset-assertie hieronder.
{
  const blockerTask = task('blk7h', '2026-06-01', '2026-06-03', 2, {
    priority: 900,
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }], // bezet ma+wo, di vrij
  });
  const blockerAssign = assign('blk7h-r', 'blk7h', 'r-split7h', 1);
  const taskH = task('h7', '2026-06-01', '2026-06-02', 2.5, {
    priority: 100, deadline: '2026-06-05',
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 2.5, durationMinutes: 1200,
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
      earlyStart: '2026-06-01', earlyFinish: '2026-06-02',
      lateStart: '2026-06-01', lateFinish: '2026-06-02',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  });
  const hAssign = assign('h7-r', 'h7', 'r-split7h', 1);
  const resource7h = res('r-split7h', 1);
  const rFrac = levelResources(
    [blockerTask, taskH], [], [resource7h], [blockerAssign, hAssign], PROJECT_CAL, [], stubCpmResult('2026-06-03'),
    { constrainToFloat: false, overrunCeilingDays: 2, allowSplits: true },
  );
  eq('fractionele uur-modus: drie curve-slots, dus drie werkdagen',
    enumerateTaskWorkDays(rFrac.gaps['h7'], projEng, rFrac.shifts['h7']?.newStart ?? '2026-06-01', 3),
    ['2026-06-02', '2026-06-04', '2026-06-05']);
  ok('en precies één leveling-gat (na di, wo overslaand — zie de afwijking hierboven)',
    rFrac.gaps['h7']?.filter(g => g.source === 'leveling').length === 1);
}

// ── Bevinding B8 (fixronde op etappe 3): een scatter die op de ZOEKHORIZON vastloopt meldt dat ────
// Het geval hierboven is het makkelijke: dáár loopt de AANEENGESLOTEN scan zelf al leeg, dus
// `findSlot` zet `horizonExhausted` sowieso. Hier niet: taak `hz` heeft veel speling, dus de
// aaneengesloten scan stopt netjes op de START-grens (`windowLimit`, de baseline-lateStart) — een
// venstergrens, géén uitputting. De scatter mag daarna dóór tot de ruimere FINISH-grens
// (`finishWindowLimit`, de baseline-lateFinish) en raakt onderweg `scanLimit` op. Vóór deze fix
// meldde `scatterSlot` die uitputting niet en verzon `reasonFor` INSUFFICIENT_CAPACITY — een
// diagnose die de gebruiker naar capaciteit stuurt terwijl de zoekhorizon de echte grens was.
//
// De opzet in getallen: `totalWork` = 5 + 1 = 6, dus `scanLimit` = max(16, 30) = 30 kandidaten.
// `anchor` (SNET 2026-07-15) duwt het projecteinde naar 2026-07-15; `hz` heeft geen opvolgers, dus
// haar baseline-lateFinish is dát einde (kandidaat #33 vanaf 2026-06-01) en haar lateStart vier
// werkdagen eerder, 2026-07-09 (kandidaat #29 — nog nét binnen de horizon). Geen plafond, zodat
// `ceilingSet` de reden niet vóór de horizon opeist. De resource is met een `availabilitySteps`-nul
// vanaf de projectstart onbeschikbaar (zelfde truc als bevinding 11 hierboven), dus geen enkele dag
// past — zonder dat dat `totalWork` (en dus de horizon) opblaast.
{
  const hz = task('hz', '2026-06-01', '2026-06-05', 5, { priority: 100 });
  const anchor = task('hz-anchor', '2026-07-15', '2026-07-15', 1, {
    priority: 900, constraint: { type: 'SNET', date: '2026-07-15' },
  });
  const resourceHz = res('r-hz', 1, { availabilitySteps: [{ from: '2026-06-01', maxUnits: 0 }] });
  const rHorizon = levelResources(
    [hz, anchor], [], [resourceHz], [assign('hz-a', 'hz', 'r-hz', 1)],
    PROJECT_CAL, [], stubCpmResult('2026-07-15'),
    { constrainToFloat: true, allowSplits: true },
  );
  eq('scatter die op de horizon vastloopt ⇒ NO_WINDOW_IN_HORIZON',
    rHorizon.unresolvedReasons['hz'], 'NO_WINDOW_IN_HORIZON');
  eq('en er is niets geplaatst', rHorizon.gaps['hz'], undefined);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-splitmode: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-splitmode: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
