// check-leveler-splits.ts — de nivelleerder boekt en meet op de TAAKkalender, split-bewust
// (B1c-W0.2/W0.3). `ResourceLeveler.ts`s `bookDemandAt` (boeking) en de delay-meting in de
// eligibility-lus rekenden tot deze fix onvoorwaardelijk op AANEENGESLOTEN projectkalender-
// werkdagen (`nextWorkDays`/`projEngine.workDaysBetween`) — dezelfde generatie bug die
// `check-split-walk.ts` (H1-as) en `check-resource-load-splits.ts` (lastlezer) al repareerden voor
// de renderer resp. `computeResourceLoad`. Deze suite sluit het derde gat: de nivelleerder zelf.
//
// Twee groepen, elk vergelijkbaar met check-resource-load-splits.ts's helperstijl (`task()`/`res()`/
// `assign()`), maar roept `levelResources` rechtstreeks aan (zie `tests/planning/harness.ts`s
// `S().levelResources({...})`-aanroep voor de vorm van de invoer).
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
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

// Projectkalender: ma-vr, 8u/dag — zelfde vorm als `check-split-walk.ts`s `DAY_CAL` /
// `check-resource-load-splits.ts`s `PROJECT_CAL`.
const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project-leveler', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

// Zesdaagse kalender: ma-za werkdagen — zelfde vorm als `check-resource-load-splits.ts`s
// `SIX_DAY_CAL`, hier hergebruikt om de taakkalender/projectkalender-divergentie in geval 2 te tonen.
const SIX_DAY_CAL: WorkCalendar = {
  id: 'cal-six-day-leveler', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

/** Leaf-taak, zelfde veldvorm als `check-resource-load-splits.ts`s `task()`. */
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: durationDays,
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

/** Lege/verwaarloosbare CPMResult — `levelResources` gebruikt hem uitsluitend als fallback
 *  (`projectEndBefore` en de foutuitgang); de VERSE interne baseline/PF/proef-solves (A2/A4) rekenen
 *  op eigen `CPMSolver`-runs, niet op dit object. Zelfde precedent als de andere directe-aanroep-
 *  tests in deze map die geen store/harness gebruiken. */
function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

const LEVEL_OPTS: LevelingOptions = { constrainToFloat: false };

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1 (boeking, B1c-W0.2): een gesplitste taak boekt alleen haar ECHTE werkdagen — het gat
// blijft vrij voor een andere taak. Referentiegaten identiek aan `check-split-walk.ts`: taak van
// 06-01, twee gaten van 1 werkdag na resp. dag 1 en aspositie 1440 ⇒ de taak werkt op
// 06-01/06-03/06-05, niet aaneengesloten 06-01/06-02/06-03. VÓÓR de fix boekte `bookDemandAt` de
// AANEENGESLOTEN werkdagen 06-01/06-02/06-03 (dezelfde generatie bug als de lastlezer vóór
// B1c-W0.1) — dus taak B, die precies op het gat (06-02) wil starten, werd ten onrechte weggeduwd.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: gesplitste taak boekt alleen haar echte werkdagen (geval 1) --');
{
  const taskA = task('a', '2026-06-01', '2026-06-05', 3, {
    priority: 600,
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  // Taak B: 1 werkdag, start EXACT op A's gat (06-02) — geen relaties tussen A en B.
  const taskB = task('b', '2026-06-02', '2026-06-02', 1, { priority: 500 });

  const resourceR = res('r1', 1);
  const assignments = [assign('a-r1', 'a', 'r1', 1), assign('b-r1', 'b', 'r1', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r1 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('taak B hoeft niet te wijken: het gat van A is echt vrij', r1.delays['b'], undefined);
  eq('taak A zelf heeft ook geen delay (ze plaatst op haar eigen PF)', r1.delays['a'], undefined);
  ok('geen onopgeloste conflicten', Object.keys(r1.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2 (delay-eenheid, B1c-W0.3): de delay wordt gemeten op de TAAKkalender van de wijkende taak,
// niet de projectkalender — en die meting moet overeenkomen met wat de latere CPM-toepassing
// (`CPMSolver.forwardPass`'s `shiftByLevelingDelay`, die ALTIJD op de taak-eigen kalender rekent)
// werkelijk doet.
//
// SCENARIOKEUZE (zie de takenomschrijving se "LET OP"): de kandidaat-SCAN van `findSlot` blijft deze
// golf op de projectkalender stappen (bewust, zie het commentaar bij `findSlot` in
// `ResourceLeveler.ts`) — vanaf vrijdag 06-05 is de eerstvolgende PROJECTkalender-werkdag dus
// maandag 06-08, nooit zaterdag (die is voor de projectkalender geen werkdag, dus `findSlot` scant
// er nooit naartoe). Taak C (6-daagse kalender, zaterdag = werkdag) wijkt daardoor van PF=vrijdag
// naar start=maandag. Op de PROJECTkalender (ma-vr) zijn dat 2 werkdagen (vr, ma) ⇒ delay 1 — de
// OUDE (foute) meting. Op C's EIGEN taakkalender (ma-za) zijn dat 3 werkdagen (vr, za, ma) ⇒ delay 2
// — de NIEUWE, correcte meting. Het verschil is precies het bewijsstuk: past de CPM-forward-pass de
// OUDE delay (1) toe op C's taakkalender, dan land ze op ZATERDAG 06-06 (1 werkdag ná vrijdag op een
// kalender waar zaterdag werkt) — een dag die de nivelleerder nooit geboekt heeft (booking gebeurde
// op maandag). Past ze de NIEUWE delay (2) toe, dan land ze exact op MAANDAG 06-08 — dezelfde dag
// als de preview-boeking. Dat is de sluitring die deze golf dichtmaakt.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: delay gemeten op de taakkalender (geval 2) --');
{
  const taskD = task('d', '2026-06-05', '2026-06-05', 1, { priority: 900 }); // projectkalender
  const taskC = task('c', '2026-06-05', '2026-06-05', 1, { priority: 100, calendarId: 'cal-six-day-leveler' });

  const resourceR = res('r2', 1);
  const assignments = [assign('d-r2', 'd', 'r2', 1), assign('c-r2', 'c', 'r2', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r2 = levelResources(
    [taskD, taskC], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r2.delays['d'], undefined);
  eq('C wijkt met delay 2 — gemeten op haar EIGEN (zesdaagse) taakkalender, niet de projectkalender',
    r2.delays['c'], 2);
  ok('geen onopgeloste conflicten', Object.keys(r2.unresolved).length === 0);

  // Sluit de cirkel: zet levelingDelay op C zoals `applyLeveling` zou doen (§5.6/Z6: UITSLUITEND
  // `ResourceLeveler` zet dit veld), draai `solveProject` met DEZELFDE kalenders, en bewijs dat de
  // CPM-toepassing exact de dag oplevert die de preview-boeking beloofde (maandag 06-08) — NIET de
  // zaterdag die de OUDE (projectkalender-)meting zou hebben oovergeleverd.
  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r2.delays['d'] },
    { ...taskC, time: { ...taskC.time }, levelingDelay: r2.delays['c'] },
  ];
  const solved = solveProject({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [SIX_DAY_CAL],
  });
  ok('solveProject rekent zonder fout door', !solved.error);
  const cResult = solvedTasks.find(t => t.id === 'c')!;
  eq("C's earlyStart landt op maandag 2026-06-08 — de dag die de preview-boeking beloofde",
    cResult.time.earlyStart, '2026-06-08');

  // Negatieve controle: de OUDE meting (delay=1, op de projectkalender) zou C — via dezelfde
  // taakkalender-toepassing in `CPMSolver.forwardPass`, die dit onderdeel altijd al deed — op
  // zaterdag 06-06 hebben laten landen: een dag die de nivelleerder nooit geboekt heeft. Bewijst dat
  // de oude preview/CPM-divergentie geen constructie-artefact van deze test is, maar een echt gat.
  const oldDelayTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: undefined },
    { ...taskC, time: { ...taskC.time }, levelingDelay: 1 },
  ];
  const oldSolved = solveProject({
    tasks: oldDelayTasks, sequences: [], calendar: PROJECT_CAL, calendars: [SIX_DAY_CAL],
  });
  ok('(negatieve controle) solveProject rekent zonder fout door', !oldSolved.error);
  const oldCResult = oldDelayTasks.find(t => t.id === 'c')!;
  eq('(negatieve controle) de OUDE delay-eenheid (1, projectkalender) zou C op zaterdag 06-06 hebben '
    + 'laten landen — niet de maandag die de boeking beloofde',
    oldCResult.time.earlyStart, '2026-06-06');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3 (ELAPSEDTIME-bevinding, B1c-W0.2): ELAPSEDTIME-taken belanden GEWOON in `demandByTask` —
// er is in `ResourceLeveler.ts` geen filter op `durationType` (alleen op mijlpaal/verzameltaak/
// duur≤0, net als `ResourceLoad.ts`s `computeResourceLoad`). Zonder een eigen tak zou `bookDemandAt`
// `scheduleDuration` via `enumerateTaskWorkDays` als een WERKDAGEN-telling lezen — voor ELAPSEDTIME
// is dat getal KALENDERdagen (`duration.ts`s `elapsedMinutesOf`-docblok) — en dus veel te ver
// doorlopen. Deze fix geeft ELAPSEDTIME-taken dezelfde, spanne-geklemde behandeling als
// `ResourceLoad.ts`, maar VERTAALD over de eventuele delay-verschuiving (`ResourceLoad` boekt altijd
// op de ongewijzigde `earlyStart`, de leveler kan een taak op een ANDERE dag boeken).
//
// Referentiegeval: taak E (ELAPSEDTIME, "duur" 3 — dus een span van 3 KALENDERdagen) heeft de
// HOOGSTE prioriteit en dus GEEN concurrent voor haar eigen slot — ze plaatst op haar eigen PF
// (vrijdag 06-05), delay 0, ONVERSCHOVEN. Dat is bewust: `findSlot`s eigen kandidaat-SCAN (bewust
// niet gefixed deze golf, zie het commentaar bij `findSlot`) telt `dur` nog als AANEENGESLOTEN
// projectkalender-werkdagen i.p.v. de echte ELAPSEDTIME-kalenderdagenspan — zou E hier moeten
// wijken, dan zou die aparte, hier ONGEMOEIDE onnauwkeurigheid het scenario vervuilen (de scan zou
// een 3-werkdagen-venster zoeken i.p.v. de echte 3-kalenderdagenspan, en toevallig weer op een
// volledig-werkdagen-venster landen — geen bewijs voor DEZE fix meer). Door E ONVERSCHOVEN te
// laten plaatsen isoleert dit geval precies `bookDemandAt`s eigen ELAPSEDTIME-tak: haar span
// 06-05..06-07 bevat maar één projectkalender-werkdag (vrijdag zelf, want zaterdag/zondag zijn geen
// werkdagen). Taak F (lage prioriteit) wil vervolgens maandag 06-08 op dezelfde resource.
//   - VÓÓR de fix (dur als AANEENGESLOTEN-werkdagen-telling, oude `nextWorkDays`-boeking): E zou
//     "3 werkdagen" vanaf vrijdag boeken — vr 06-05, MA 06-08, di 06-09 — en zo ten onrechte ook
//     maandag bezetten. F zou dan moeten wijken (delay > 0).
//   - NÁ de fix: E's boeking blijft geklemd op haar eigen 3-kalenderdaagse span (uitsluitend
//     vrijdag), dus raakt maandag niet aan. F krijgt geen delay.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: ELAPSEDTIME-taak boekt spanne-geklemd, niet als werkdagen-telling (geval 3) --');
{
  const taskEBase = task('e', '2026-06-05', '2026-06-07', 3, { priority: 900 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  const taskF = task('f', '2026-06-08', '2026-06-08', 1, { priority: 100 });

  const resourceR = res('r3', 1);
  const assignments = [
    assign('e-r3', 'e', 'r3', 1),
    assign('f-r3', 'f', 'r3', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r3 = levelResources(
    [taskE, taskF], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('E plaatst op haar eigen PF, geen delay (hoogste prioriteit, geen concurrent)', r3.delays['e'], undefined);
  eq('F hoeft niet te wijken: E boekt spanne-geklemd (alleen vrijdag), niet als werkdagen-telling — maandag blijft vrij',
    r3.delays['f'], undefined);
  ok('geen onopgeloste conflicten', Object.keys(r3.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 4 (ELAPSEDTIME-delay-EENHEID, reviewronde taak 4): de delay-METING voor een ELAPSEDTIME-taak
// moet in dezelfde eenheid rekenen als `CPMSolver.forwardPass`'s `shiftByLevelingDelay` bij de
// TOEPASSING gebruikt. Die functie kent voor `task.levelingDelay` TWEE aparte takken (CPMSolver.ts,
// `shiftByLevelingDelay`): WORKTIME schuift `eng.addWorkingDaysSigned(date, delay)` — hele
// WERKdagen op de taak-eigen kalender; ELAPSEDTIME schuift `addElapsedMinutes(date, delay*24*60)` —
// KALE kalenderdagen, 24/7, ONGEACHT welke dagen werkdagen zijn. Geval 2 hierboven bewees al dat de
// meting op de juiste KALENDER moet rekenen (taak- i.p.v. projectkalender); dit geval bewijst dat ze
// ook in de juiste EENHEID moet rekenen (kale kalenderdagen i.p.v. werkdagen) — reviewer-repro op
// commit 9ac2ed49: de delay-meting rekende voor ELKE `durationType` in werkdagen, dus voor een
// ELAPSEDTIME-taak gaf dat een AFSTAND die niet overeenkomt met wat `addElapsedMinutes` bij
// toepassing werkelijk verschuift.
//
// Scenario: taak D (WORKTIME, prio 900) en taak E (ELAPSEDTIME, "duur" 1 — dus een span van 1
// KALENDERdag, prio 100) willen beide vrijdag 2026-06-05 op dezelfde resource (cap 1, projectkalender
// ma-vr). D plaatst het eerst (hoogste prioriteit) en claimt vrijdag; E moet wijken. `findSlot`s
// kandidaat-scan (bewust ongemoeid, projectkalender) vindt maandag 06-08 als eerstvolgende vrije
// projectkalender-werkdag — GEEN ELAPSEDTIME-specifieke keuze, dus dit geval test de EENHEID van de
// meting, niet die scan (zoals de taakomschrijving vroeg).
//   - OUDE (foute) meting: `workDaysBetween(vr, ma)` op de (project)kalender = 2 werkdagen (vr, ma)
//     ⇒ delay 1. Toegepast via `addElapsedMinutes(vrijdag, 1×24×60)` = vrijdag + 1 KALENDERdag =
//     ZATERDAG 06-06 — twee dagen naast de dag waarop E daadwerkelijk geboekt is (maandag).
//   - NIEUWE (correcte) meting: kale kalenderdagen tussen vr en ma (`diffCalendarDays`) = 3 ⇒ delay
//     3. Toegepast via `addElapsedMinutes(vrijdag, 3×24×60)` = vrijdag + 3 kalenderdagen = MAANDAG
//     06-08 — exact de dag waarop `bookDemandAt` E al boekte. Dat is de sluitring die dit geval dichtmaakt.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: ELAPSEDTIME-delay gemeten in kalenderdagen, niet werkdagen (geval 4) --');
{
  const taskD = task('d4', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskEBase = task('e4', '2026-06-05', '2026-06-05', 1, { priority: 100 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };

  const resourceR = res('r4', 1);
  const assignments = [assign('d4-r4', 'd4', 'r4', 1), assign('e4-r4', 'e4', 'r4', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r4 = levelResources(
    [taskD, taskE], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r4.delays['d4'], undefined);
  eq('E wijkt met delay 3 — kale KALENDERdagen tussen vr en ma, niet werkdagen',
    r4.delays['e4'], 3);
  ok('geen onopgeloste conflicten', Object.keys(r4.unresolved).length === 0);

  // Sluit de cirkel: zet levelingDelay op E zoals `applyLeveling` zou doen, draai `solveProject` met
  // DEZELFDE kalender, en bewijs dat de ELAPSEDTIME-toepassing exact de dag oplevert waarop
  // `bookDemandAt` E al boekte (maandag 06-08) — NIET de zaterdag die de OUDE (werkdagen-)meting zou
  // hebben opgeleverd.
  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r4.delays['d4'] },
    { ...taskE, time: { ...taskE.time }, levelingDelay: r4.delays['e4'] },
  ];
  const solved = solveProject({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [],
  });
  ok('solveProject rekent zonder fout door', !solved.error);
  const eResult = solvedTasks.find(t => t.id === 'e4')!;
  eq("E's earlyStart landt op maandag 2026-06-08 — de dag waarop bookDemandAt haar al boekte",
    eResult.time.earlyStart, '2026-06-08');

  // Negatieve controle: de OUDE (werkdagen-)meting (delay=1) zou via `addElapsedMinutes` — dat
  // ONDERDEEL van `shiftByLevelingDelay` bestond al vóór deze fix en is hier ongewijzigd — op
  // zaterdag 06-06 zijn geland: een dag die de nivelleerder nooit geboekt heeft. Bewijst dat de oude
  // preview/CPM-divergentie voor ELAPSEDTIME-taken geen constructie-artefact van deze test is.
  const oldDelayTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: undefined },
    { ...taskE, time: { ...taskE.time }, levelingDelay: 1 },
  ];
  const oldSolved = solveProject({
    tasks: oldDelayTasks, sequences: [], calendar: PROJECT_CAL, calendars: [],
  });
  ok('(negatieve controle) solveProject rekent zonder fout door', !oldSolved.error);
  const oldEResult = oldDelayTasks.find(t => t.id === 'e4')!;
  eq('(negatieve controle) de OUDE delay-eenheid (1 werkdag) zou E op zaterdag 06-06 hebben laten '
    + 'landen — niet de maandag waarop ze geboekt is',
    oldEResult.time.earlyStart, '2026-06-06');
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-splits: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-splits: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
