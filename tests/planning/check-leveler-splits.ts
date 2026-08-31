// check-leveler-splits.ts — de nivelleerder boekt en meet op de TAAKkalender, split-bewust
// (B1c-W0.2/W0.3), met de plaatsings-as gelijkgetrokken aan de meet-as, een verse baseline-spanne
// voor ELAPSEDTIME-boeking en guards op lege datums (kwaliteitsronde taak 4, C1/C2/I3/I4/I5/I6/M9).
// `ResourceLeveler.ts`s `bookDemandAt` (boeking) en de delay-meting in de eligibility-lus rekenden
// oorspronkelijk onvoorwaardelijk op AANEENGESLOTEN projectkalender-werkdagen — dezelfde generatie
// bug die `check-split-walk.ts` (H1-as) en `check-resource-load-splits.ts` (lastlezer) al
// repareerden voor de renderer resp. `computeResourceLoad`. Eerste reparatieronde (B1c-W0.2/W0.3,
// commit 9ac2ed49/23082edd) verhuisde de METING naar de taakkalender maar liet de KANDIDAAT-scan
// (waar mag een taak beginnen) op de projectkalender staan — de oude "−1"-aftrek absorbeerde dat
// verschil toevallig stil zólang er capaciteitsdruk was, maar gaf bij NUL druk een spookvertraging.
// Deze ronde trekt de plaatsings-as gelijk met de meet-as (C1/C2) en deelt de dagenset tussen
// conflictdetectie en boeking (I5/I6).
//
// Helperstijl vergelijkbaar met check-resource-load-splits.ts's `task()`/`res()`/`assign()`, maar
// roept `levelResources` rechtstreeks aan (zie `tests/planning/harness.ts`s
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
// `SIX_DAY_CAL`, hier hergebruikt om de taakkalender/projectkalender-divergentie te tonen.
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
// Geval 2 (delay op de taakkalender, MET capaciteitsdruk, B1c-W0.3 + kwaliteitsronde taak 4 C1/C2):
// taak C (6-daagse kalender, zaterdag = werkdag) botst met taak D op vrijdag en moet wijken. Sinds
// C1/C2 stapt de kandidaat-SCAN nu ook op C's EIGEN kalender, dus de eerstvolgende kandidaat ná een
// bezette vrijdag is ZATERDAG (een taak-werkdag) — niet meer maandag zoals vóór deze ronde (toen de
// scan nog aaneengesloten op de projectkalender stapte en zaterdag oversloeg). Dat is precies de
// bedoeling van C1/C2: C's WERKELIJKE eerstvolgende vrije dag is zaterdag, dus haar delay is nu 1
// (vr→za), niet de kunstmatig opgeblazen 2 (vr→za→ma op de OUDE projectkalender-scan) uit de vorige
// ronde. Sluit de cirkel: dezelfde delay via `solveProject` toegepast (`shiftByLevelingDelay` rekent
// altijd al op de taak-eigen kalender) landt exact op diezelfde zaterdag.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: delay op de taakkalender, met capaciteitsdruk (geval 2) --');
{
  const taskD = task('d', '2026-06-05', '2026-06-05', 1, { priority: 900 }); // projectkalender
  const taskC = task('c', '2026-06-05', '2026-06-05', 1, { priority: 100, calendarId: 'cal-six-day-leveler' });

  // De RESOURCE zelf krijgt ook de zesdaagse kalender: `capacityOf` rekent op de RESOURCE-kalender,
  // niet de taakkalender (zelfde principe als `ResourceLoad.ts`'s `computeResourceLoad` — een
  // resource zonder eigen kalender valt terug op de projectkalender, en dan is zaterdag daar
  // capaciteit 0, ongeacht wat C's EIGEN kalender zegt — een genuine, geen vals-positief conflict).
  // Zonder deze regel test dit geval per ongeluk de resource-capaciteitskant i.p.v. de kandidaat-as
  // (C1/C2) die hier bewezen moet worden.
  const resourceR = res('r2', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [assign('d-r2', 'd', 'r2', 1), assign('c-r2', 'c', 'r2', 1)];

  const cpmResult = stubCpmResult('2026-06-05');
  const r2 = levelResources(
    [taskD, taskC], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r2.delays['d'], undefined);
  eq('C wijkt met delay 1 — de kandidaat-scan vindt zaterdag (C.EIGEN werkdag) als eerstvolgende vrije dag',
    r2.delays['c'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r2.unresolved).length === 0);

  // Sluit de cirkel: zet levelingDelay op C zoals `applyLeveling` zou doen, draai `solveProject` met
  // DEZELFDE kalenders, en bewijs dat de CPM-toepassing exact de dag oplevert die de preview-boeking
  // beloofde (zaterdag 06-06).
  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r2.delays['d'] },
    { ...taskC, time: { ...taskC.time }, levelingDelay: r2.delays['c'] },
  ];
  const solved = solveProject({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [SIX_DAY_CAL],
  });
  ok('solveProject rekent zonder fout door', !solved.error);
  const cResult = solvedTasks.find(t => t.id === 'c')!;
  eq("C's earlyStart landt op zaterdag 2026-06-06 — de dag die de preview-boeking beloofde",
    cResult.time.earlyStart, '2026-06-06');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3 (ELAPSEDTIME-boeking spanne-geklemd, B1c-W0.2/I3): taak E (ELAPSEDTIME, "duur" 2 —
// dus een span van 2 KALENDERdagen, hoogste prioriteit, geen concurrent) plaatst onverschoven op
// haar eigen PF (vrijdag 06-05). CPM berekent haar span zelf (`addElapsedMinutes(start,
// duur×24×60)`): vrijdag + 2 kalenderdagen = zondag 06-07 — dus de span 06-05..06-07 bevat maar één
// projectkalender-werkdag (vrijdag zelf; zaterdag/zondag zijn geen werkdagen). Taak F (lage
// prioriteit) wil vervolgens maandag 06-08 op dezelfde resource.
//   - VÓÓR de fix (dur als AANEENGESLOTEN-werkdagen-telling): E zou "2 werkdagen" vanaf vrijdag
//     boeken — vr 06-05, MA 06-08 — en zo ten onrechte ook maandag bezetten. F zou moeten wijken.
//   - NÁ de fix: E's boeking blijft geklemd op haar eigen 2-kalenderdaagse span (uitsluitend
//     vrijdag), dus raakt maandag niet aan. F krijgt geen delay.
// LET OP (I3): de span komt uit de VERSE `baseline`, niet uit de `earlyStart`/`earlyFinish` die op
// de testfixture staan — die twee MOETEN dus overeenkomen met wat CPM zelf voor duur 2 berekent
// (vrijdag..zondag), anders test dit geval een fixture die met zichzelf in tegenspraak is.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: ELAPSEDTIME-taak boekt spanne-geklemd, niet als werkdagen-telling (geval 3) --');
{
  const taskEBase = task('e', '2026-06-05', '2026-06-07', 2, { priority: 900 });
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
// Geval 4 (ELAPSEDTIME-delay-EENHEID + waarneembare boeking, reviewronde taak 4 + kwaliteitsronde
// taak 4 C1/C2): de delay-METING voor een ELAPSEDTIME-taak rekent in kale KALENDERdagen
// (`diffCalendarDays`), niet werkdagen — dezelfde eenheid als `CPMSolver.shiftByLevelingDelay`s
// `addElapsedMinutes(date, delay×24×60)`-tak bij TOEPASSING gebruikt.
//
// SCENARIOKEUZE (herzien t.o.v. de vorige ronde, ná C1/C2). Taak D (WORKTIME, prio 900) en taak E
// (ELAPSEDTIME, "duur" 4 — een span van 4 KALENDERdagen, prio 100) willen beide vrijdag 2026-06-05
// op dezelfde resource. D claimt vrijdag eerst. Sinds C1/C2 is ELKE kalenderdag een geldige
// ELAPSEDTIME-kandidaat (`nextCandidateAfterFor` stapt voor ELAPSEDTIME met `addCalendarDays`, niet
// een werkdag-snap) — E's eerstvolgende kandidaat ná de bezette vrijdag is dus ZATERDAG (niet meer
// maandag, de kunstmatige projectkalender-vertraging uit de vorige ronde). Op zaterdag (span
// za..wo, want de 4-kalenderdaagse span verschuift MEE) is er geen conflict meer met D (die alleen
// vrijdag bezet) — E "past" er, met delay 1 (kale kalenderdagen vr→za).
//
// Om E's BOEKING zelf waarneembaar te maken (niet enkel de delay-METING) staat er een DERDE taak G
// (lage prioriteit) die MAANDAG 2026-06-08 wil — een dag binnen E's geboekte span (za..wo). G moet
// daardoor ZELF wijken; dat maakt een mutatie die `bookDemandAt`s ELAPSEDTIME-tak breekt (maar de
// delay-meting intact laat) rood, zoals de dekking vroeg.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: ELAPSEDTIME-delay in kalenderdagen + waarneembare boeking (geval 4) --');
{
  const taskD = task('d4', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskEBase = task('e4', '2026-06-05', '2026-06-09', 4, { priority: 100 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  const taskG = task('g4', '2026-06-08', '2026-06-08', 1, { priority: 10 });

  const resourceR = res('r4', 1);
  const assignments = [
    assign('d4-r4', 'd4', 'r4', 1),
    assign('e4-r4', 'e4', 'r4', 1),
    assign('g4-r4', 'g4', 'r4', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-09');
  const r4 = levelResources(
    [taskD, taskE, taskG], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('D (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r4.delays['d4'], undefined);
  eq('E wijkt met delay 1 — kale KALENDERdag vr→za (elke kalenderdag is een geldige ELAPSEDTIME-kandidaat, C1/C2)',
    r4.delays['e4'], 1);
  ok('G moet wijken: E boekt maandag daadwerkelijk (waarneembare boeking, dekking geval 4)',
    (r4.delays['g4'] ?? 0) > 0);
  ok('geen onopgeloste conflicten', Object.keys(r4.unresolved).length === 0);

  // Sluit de cirkel: zet levelingDelay op E zoals `applyLeveling` zou doen, draai `solveProject` met
  // DEZELFDE kalender, en bewijs dat de ELAPSEDTIME-toepassing exact de dag oplevert waarop
  // `bookDemandAt` E al boekte (zaterdag 06-06).
  const solvedTasks: Task[] = [
    { ...taskD, time: { ...taskD.time }, levelingDelay: r4.delays['d4'] },
    { ...taskE, time: { ...taskE.time }, levelingDelay: r4.delays['e4'] },
  ];
  const solved = solveProject({
    tasks: solvedTasks, sequences: [], calendar: PROJECT_CAL, calendars: [],
  });
  ok('solveProject rekent zonder fout door', !solved.error);
  const eResult = solvedTasks.find(t => t.id === 'e4')!;
  eq("E's earlyStart landt op zaterdag 2026-06-06 — de dag waarop bookDemandAt haar al boekte",
    eResult.time.earlyStart, '2026-06-06');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 5 (C1-dekking): een taak op een 6-daagse kalender ZONDER capaciteitsdruk (geen concurrent)
// hoort delay 0 te krijgen, ook als haar PF op een dag valt die voor de PROJECTkalender geen
// werkdag is (zaterdag) maar voor haar EIGEN kalender wél. VÓÓR C1 snapte de (movable) kandidaat-
// scan met `projEngine.nextWorkDay`, dus PF=zaterdag werd altijd naar maandag geduwd — een
// spookvertraging zonder enig echt conflict (reviewer-probes K/A/E/J). NÁ C1 is de eerste kandidaat
// `engineForTask(taak).nextWorkDay(pf)`, en zaterdag IS een werkdag op de zesdaagse kalender, dus de
// taak plaatst meteen op haar eigen PF.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: 6-daagse taak zonder capaciteitsdruk ⇒ geen spookvertraging (geval 5, C1) --');
{
  // 2026-06-06 is een zaterdag.
  const taskH = task('h5', '2026-06-06', '2026-06-06', 1, {
    priority: 500, calendarId: 'cal-six-day-leveler',
  });
  // Resource krijgt dezelfde zesdaagse kalender — anders toont `capacityOf` (RESOURCE-kalender,
  // zie geval 2's toelichting) 0 op zaterdag en test dit geval per ongeluk de resource-capaciteit
  // i.p.v. de kandidaat-as.
  const resourceR = res('r5', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [assign('h5-r5', 'h5', 'r5', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r5 = levelResources(
    [taskH], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('geen enkele taak krijgt een delay — de taak plaatst meteen op haar eigen (weekend-)PF', r5.delays, {});
  ok('geen onopgeloste conflicten', Object.keys(r5.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 6 (C2-dekking): dezelfde spookvertraging, maar dan voor een VASTGEPINDE taak (priority
// 1000) — het pinned-pad in de eligibility-lus snapte VÓÓR C2 ook onvoorwaardelijk met
// `projEngine.nextWorkDay`. Een gepinde taak op een 6-daagse kalender met PF op zaterdag (geen
// concurrent, dus geen echt conflict — vastgepinde taken scannen toch al niet op capaciteit) hoort
// dus ook delay 0 te krijgen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: vastgepinde 6-daagse taak, PF in het weekend ⇒ geen delay (geval 6, C2) --');
{
  // 2026-06-06 is een zaterdag; taak P heeft geen voorgangers, dus PF = haar eigen (ongesnapte)
  // scheduleStart-anker (`ownAnchor`) — precies zoals een gewone wortel-taak.
  const taskP = task('p6', '2026-06-06', '2026-06-06', 1, {
    priority: 1000, calendarId: 'cal-six-day-leveler',
  });
  const resourceR = res('r6', 1);
  const assignments = [assign('p6-r6', 'p6', 'r6', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r6 = levelResources(
    [taskP], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('vastgepinde taak krijgt geen delay — snapt op haar EIGEN kalender-as, niet de projectkalender', r6.delays, {});
  ok('geen onopgeloste conflicten', Object.keys(r6.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 7 (boekingskant van `engineForTask` op een gesplitste taak op een AFWIJKENDE kalender):
// taak S (zesdaagse kalender, splitGaps) begint donderdag 06-04 (een zesdaagse werkdag), werkt 3
// zesdaagse-werkdagen met een gat van 1 zesdaagse-werkdag na dag 2. Op de zesdaagse as: dag1=do
// 06-04, dag2=vr 06-05, gat=1 werkdag (za 06-06, want zaterdag IS een werkdag op deze kalender),
// dag3=de eerstvolgende zesdaagse werkdag ná het gat = ma 06-08 (zondag is ook op deze kalender
// vrij). S werkt dus do/vr/ma, met ZATERDAG als haar eigen pauze — een dag die de PROJECTkalender
// toch al nooit als werkdag zou tellen, dus dat op zichzelf bewijst nog niets. Het discriminerende
// bewijs zit in MAANDAG: had `bookDemandAt` de PROJECTkalender gebruikt (i.p.v. `engineForTask`s
// zesdaagse kalender) voor de split-wandeling, dan was de telling van "de eerstvolgende werkdag ná
// het gat" ANDERS uitgekomen (de wandeling zelf loopt over de kalender van de ENGINE die je
// meegeeft) — hier geverifieerd door een concurrent op maandag (S's ECHTE derde werkdag) ÉN een
// concurrent op zaterdag (S's pauzedag, die vrij moet blijven) tegelijk te toetsen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: gesplitste taak op een afwijkende (zesdaagse) kalender boekt correct (geval 7) --');
{
  const taskS = task('s7', '2026-06-04', '2026-06-08', 3, {
    priority: 900, calendarId: 'cal-six-day-leveler',
    splitGaps: [{ afterMinutes: 960, gapMinutes: 480 }], // na 2 werkdagen (2×480 min): 1 werkdag gat
  });
  // Concurrent 1: wil MAANDAG 06-08 — S's ECHTE derde werkdag. Moet wijken (S bezet maandag echt).
  const taskConflictMonday = task('t7-mon', '2026-06-08', '2026-06-08', 1, { priority: 100 });
  // Concurrent 2: wil ZATERDAG 06-06 — S's eigen pauzedag. Hoeft NIET te wijken (S werkt er niet).
  // Krijgt ZELF ook de zesdaagse kalender: op de projectkalender is zaterdag toch al nooit een
  // kandidaat (haar eigen kandidaat-as zou meteen naar maandag snappen, los van S's boeking), dus
  // zonder deze kalender test dit geval niets over S's boeking.
  const taskFreeSaturday = task('t7-sat', '2026-06-06', '2026-06-06', 1, {
    priority: 50, calendarId: 'cal-six-day-leveler',
  });

  // Resource krijgt dezelfde zesdaagse kalender — anders toont `capacityOf` (RESOURCE-kalender,
  // zie geval 2's toelichting) 0 op zaterdag, los van of S daar wel of niet boekt.
  const resourceR = res('r7', 1, { calendarId: 'cal-six-day-leveler' });
  const assignments = [
    assign('s7-r7', 's7', 'r7', 1),
    assign('t7-mon-r7', 't7-mon', 'r7', 1),
    assign('t7-sat-r7', 't7-sat', 'r7', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r7 = levelResources(
    [taskS, taskConflictMonday, taskFreeSaturday], [], [resourceR], assignments,
    PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('S plaatst op haar eigen PF, geen delay (hoogste prioriteit)', r7.delays['s7'], undefined);
  ok('de concurrent op MAANDAG moet wijken — S bezet daar echt (haar derde werkdag op de zesdaagse as)',
    (r7.delays['t7-mon'] ?? 0) > 0);
  eq('de concurrent op ZATERDAG hoeft niet te wijken — dat is S\'s eigen pauzedag, niet een geboekte dag',
    r7.delays['t7-sat'], undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 8 (I3, reviewer-probe F): een STALE opgeslagen spanne op een ELAPSEDTIME-taak mag de
// boeking niet sturen — de VERSE baseline-spanne (CPM herrekend uit `scheduleStart` + `duur`) is de
// bron van waarheid, niet de mogelijk-verouderde `task.time.earlyStart/earlyFinish` op het
// binnenkomende taakobject. Taak G: ELAPSEDTIME, "duur" 5 (dus een ECHTE CPM-span van
// 2026-06-01..2026-06-06), maar met een opzettelijk STALE, INCONSISTENTE opgeslagen spanne van
// slechts 1 dag (06-01..06-01) — alsof de taak sinds een eerdere duurwijziging niet herrekend is.
// Een hogere-prioriteit concurrent claimt woensdag 06-03 (binnen G's ECHTE span, cap 1). Gebruikte
// `bookDemandAt` de stale 1-daagse spanne, dan zou G's boeking het conflict op 06-03 nooit zien
// (haar "spanne" zou allang voorbij zijn) en zou G onterecht delay 0 krijgen. Met de verse baseline
// ziet G het conflict wél en wijkt — delay 3, exact het reviewer-repro-getal.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: verse baseline-spanne wint van een stale opgeslagen spanne (geval 8, I3/probe F) --');
{
  const taskGBase = task('g8', '2026-06-01', '2026-06-01', 5, { priority: 500 }); // STALE: 1-daagse spanne
  const taskG: Task = { ...taskGBase, time: { ...taskGBase.time, durationType: 'ELAPSEDTIME' } };
  const taskConflict = task('t8-conflict', '2026-06-03', '2026-06-03', 1, { priority: 900 });

  const resourceR = res('r8', 1);
  const assignments = [assign('g8-r8', 'g8', 'r8', 1), assign('t8-r8', 't8-conflict', 'r8', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r8 = levelResources(
    [taskG, taskConflict], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('de concurrent (hoogste prioriteit) plaatst op haar eigen PF, geen delay', r8.delays['t8-conflict'], undefined);
  eq('G ziet het conflict op 06-03 ONDANKS de stale opgeslagen spanne — verse baseline wint (I3)',
    r8.delays['g8'], 3);
  ok('geen onopgeloste conflicten', Object.keys(r8.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 9 (I4, probe G — verdediging-in-diepte, EERLIJKE SCOPE na slotronde-taak-4-reviewbevinding
// L2): lege/onparseerbare `earlyStart`/`earlyFinish` op een ELAPSEDTIME-taak mochten VÓÓR I3
// `bookDemandAt` laten crashen (`RangeError` via `formatDate`/`toISOString` op een Invalid Date uit
// `addCalendarDays(parseDate(''), …)`). Taak K heeft een geldige `scheduleStart` (de baseline-solve
// slaagt dus gewoon) maar LEGE `earlyStart`/`earlyFinish` op het binnenkomende taakobject.
//
// Dit geval claimt NIET dat de `!rawStart`/`isNaN`-guards in `occurrenceFor` hier daadwerkelijk
// geraakt worden — reviewer-mutatie N4 (die guards verwijderen) bleef op dit geval groen, en dat is
// verwacht: sinds I3 leest `occurrenceFor` voor ELAPSEDTIME EERST `baseline.tasks.get(task.id)`, en
// die is voor een taak met een geldige `scheduleStart` altijd aanwezig met een geldige, herrekende
// spanne (CPMSolver's eigen guard laat de HELE solve al falen bij een ongeldige `scheduleStart`, dus
// een taak die de baseline wél haalt heeft per constructie een geldig resultaat) — de stale/lege
// `task.time.earlyStart/earlyFinish` worden hier dus nooit gelezen, ongeacht of de guard bestaat. Wat
// dit geval WEL bewijst: `levelResources` crasht niet meer op deze ooit-gevaarlijke invoervorm via de
// publieke API — de crash zelf is al door de I3-omleiding (verse baseline i.p.v. de stale velden)
// verholpen; de guards in `occurrenceFor` blijven verdediging-in-diepte voor een pad dat via de
// publieke API niet construeerbaar bleek (een taak met geldige `scheduleStart` maar zónder entry in
// `baseline.tasks` vereist dat de hele solve faalt, en dan keert `levelResources` al bij de
// `baseline.error`-guard (regel ~188) terug, ver vóór `occurrenceFor` wordt aangeroepen).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: lege earlyStart/earlyFinish crashen niet (geval 9, I4/probe G) --');
{
  const taskKBase = task('k9', '2026-06-01', '2026-06-01', 2, { priority: 500 });
  const taskK: Task = {
    ...taskKBase,
    time: { ...taskKBase.time, durationType: 'ELAPSEDTIME', earlyStart: '', earlyFinish: '' },
  };
  const resourceR = res('r9', 1);
  const assignments = [assign('k9-r9', 'k9', 'r9', 1)];

  const cpmResult = stubCpmResult('2026-06-02');
  let threw: unknown;
  let r9: ReturnType<typeof levelResources> | undefined;
  try {
    r9 = levelResources([taskK], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS);
  } catch (e) {
    threw = e;
  }
  ok('levelResources crasht niet op lege earlyStart/earlyFinish', threw === undefined);
  ok('resultaat komt terug (geen exceptie onderweg gesmoord)', r9 !== undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 10 (L1, reviewer-probe L): een LEEG kandidaatvenster telt niet als passend. `fits(byRes, [])`
// is triviaal waar (de binnenlus over `occ` loopt nul keer), en sinds ELAPSEDTIME-kandidaten per
// KALENDERdag stappen (C1/C2) kan een korte elapsed-spanne volledig in een weekend vallen — dan
// levert `occurrenceFor` `[]` (geen enkele projectkalender-werkdag in die spanne).
//
// Scenario (spiegelt de reviewer-repro): taak D (WORKTIME, prio 900) claimt vrijdag 2026-06-05 op de
// resource. Taak E (ELAPSEDTIME, "duur" 1 — een span van 1 KALENDERdag, prio 100) wil ook vrijdag en
// moet wijken. Haar kandidaat-scan stapt per kalenderdag: vr (echt bezet, occ=['vr']) → za (haar
// span za..zo bevat GEEN projectkalender-werkdag, occ=[]) → zo (span zo..ma bevat wél een werkdag,
// occ=['ma']).
//   - VÓÓR de fix: `fits(byRes, [])` op zaterdag is triviaal waar ⇒ E "past" daar, plaatst op
//     zaterdag (delay 1), maar boekt NERGENS iets — haar vraag verdwijnt stilzwijgend uit het
//     grootboek. Een concurrent F die vervolgens maandag wil (E's ECHTE dag, ware de scan correct)
//     zou dan GEEN delay krijgen — een vals-vrije dag.
//   - NÁ de fix: het lege venster op zaterdag wordt overgeslagen; E plaatst pas op zondag (delay 2),
//     met een ECHTE boeking op maandag (haar verschoven span zo..ma bevat precies één werkdag). F
//     moet daardoor wél wijken — haar vraag is zichtbaar in het grootboek gebleven.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: leeg kandidaatvenster telt niet als passend (geval 10, L1/probe L) --');
{
  const taskD = task('d10', '2026-06-05', '2026-06-05', 1, { priority: 900 });
  const taskEBase = task('e10', '2026-06-05', '2026-06-05', 1, { priority: 100 });
  const taskE: Task = { ...taskEBase, time: { ...taskEBase.time, durationType: 'ELAPSEDTIME' } };
  // Concurrent op MAANDAG (E's ECHTE geboekte dag bij een correcte scan) — moet wijken ALLEEN als
  // E's vraag daadwerkelijk in het grootboek staat.
  const taskF = task('f10', '2026-06-08', '2026-06-08', 1, { priority: 10 });

  const resourceR = res('r10', 1);
  const assignments = [
    assign('d10-r10', 'd10', 'r10', 1),
    assign('e10-r10', 'e10', 'r10', 1),
    assign('f10-r10', 'f10', 'r10', 1),
  ];

  const cpmResult = stubCpmResult('2026-06-08');
  const r10 = levelResources(
    [taskD, taskE, taskF], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('D plaatst op haar eigen PF, geen delay', r10.delays['d10'], undefined);
  eq('E slaat het lege weekend-venster over: delay 2 (vr→zo), niet de vals-vrije 1 (vr→za)',
    r10.delays['e10'], 2);
  ok('F moet wijken: E\'s vraag staat echt in het grootboek (op maandag), niet spoorloos verdwenen',
    (r10.delays['f10'] ?? 0) > 0);
  ok('geen onopgeloste conflicten', Object.keys(r10.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 11 (L5-dekking): een taak op een RUIMERE kalender dan haar resource krijgt WÉL een echte,
// capaciteit-gedreven delay — dit houdt de as-oorzaak (C1/C2, spookvertraging zonder capaciteitsdruk,
// gevallen 5/6) strikt gescheiden van de capaciteits-oorzaak (een resource die op een dag simpelweg
// niet kan werken, ongeacht wat de taakkalender zegt — hetzelfde principe als `ResourceLoad.ts`).
//
// Taak MOV (zesdaagse kalender, dus zaterdag = werkdag) start op zaterdag 2026-06-06 — haar EIGEN
// kandidaat-as vindt dat meteen een geldige kandidaat (geen axis-spook, C1 werkt correct). Maar haar
// RESOURCE heeft GEEN eigen kalender (valt terug op de projectkalender, ma-vr) — de resource kan op
// zaterdag simpelweg niet werken. Dat is een ECHT capaciteitsconflict, geen kandidaat-as-bug: MOV
// wijkt naar maandag, met delay 1 (za→ma, 2 werkdagen op haar EIGEN kalender min 1).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: taak op ruimere kalender dan haar resource krijgt een echte, capaciteit-gedreven delay (geval 11, L5) --');
{
  // 2026-06-06 is een zaterdag.
  const taskMov = task('mov11', '2026-06-06', '2026-06-06', 1, {
    priority: 500, calendarId: 'cal-six-day-leveler',
  });
  // Resource ZONDER eigen kalender (valt terug op PROJECT_CAL, ma-vr) — bewust GEEN zesdaagse
  // kalender, in tegenstelling tot geval 2/5/7: hier is het capaciteitsverschil precies het punt.
  const resourceR = res('r11', 1);
  const assignments = [assign('mov11-r11', 'mov11', 'r11', 1)];

  const cpmResult = stubCpmResult('2026-06-06');
  const r11 = levelResources(
    [taskMov], [], [resourceR], assignments, PROJECT_CAL, [SIX_DAY_CAL], cpmResult, LEVEL_OPTS,
  );

  eq('MOV wijkt met delay 1 — echte capaciteitsdruk (resource kan zaterdag niet werken), geen axis-spook',
    r11.delays['mov11'], 1);
  ok('geen onopgeloste conflicten', Object.keys(r11.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 12 (eindpoortronde W0, showcase "rijwoningen-de-akkers"): een VOLTOOIDE taak
// (`completion>=1 && actualFinish`) is ONVERPLAATSBAAR — nooit een `levelingDelay`, want
// `CPMSolver.forwardPass`'s VOLTOOID-tak plant haar onvoorwaardelijk op haar actuals en negeert
// `levelingDelay` volledig (een delay zou een stille no-op zijn — precies de showcase-bevinding:
// House 1 kreeg voorheen `levelingDelay=15`, maar bleef gewoon op haar actuals staan, en het
// conflict met House 2 herleefde stil zonder dat `unresolved` het meldde). Haar vraag telt WEL als
// vaste last in het grootboek.
//
// SCENARIOKEUZE — priority bewust OMGEDRAAID (H1 laag, concurrent hoog): zonder dat zou de
// eligibility-sortering H1 toevallig ALS EERSTE plaatsen (gelijke prioriteit, stabiele
// aanmaakvolgorde), en dan zou zelfs de OUDE code (die een voltooide taak nog als een gewone
// movable taak behandelt) hem nooit hoeven te verschuiven — geen bewijskracht. Met H1 op lage
// prioriteit test dit geval het ECHTE verschil: vóór deze fix zou de hoger-geprioriteerde
// concurrent EERST het vak claimen en zou H1 (behandeld als gewone movable taak) daarna MOETEN
// wijken — een `levelingDelay` krijgen die `CPMSolver.forwardPass`'s VOLTOOID-tak straks gewoon
// negeert, zodat H1 in werkelijkheid op haar actuals blijft staan terwijl de concurrent DENKT het
// veld voor zich te hebben: een stille, herlevende dubbele boeking — exact de showcase-bevinding
// (House 1 kreeg `levelingDelay=15`, bleef op haar actuals, conflict met House 2 herleefde stil).
//
// Sub-geval A: concurrent met ELDERS ruimte (geen smoothing-venster) moet er ECHT omheen —
// waarneembare boeking (net als geval 4/10), dus GEEN onopgeloste conflicten.
// Sub-geval B: eerlijkheid van `unresolved` — een concurrent ZONDER speling (nul totale float, want
// ze deelt met H1b de laatste earlyFinish van het tweetal-universum) kan nergens anders heen binnen
// haar smoothing-venster (`constrainToFloat: true`) en moet dus ECHT (en ALLEEN zij, niet H1b) in
// `unresolved` belanden.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: voltooide taak is onverplaatsbaar, boekt als vaste last (geval 12) --');
{
  // Sub-geval A: concurrent met speling routeert er succesvol omheen.
  const h1aBase = task('h1a', '2026-06-01', '2026-06-01', 1, { priority: 100 }); // laag — zie SCENARIOKEUZE
  const h1a: Task = {
    ...h1aBase,
    time: { ...h1aBase.time, completion: 1, actualStart: '2026-06-01', actualFinish: '2026-06-01' },
  };
  const h2a = task('h2a', '2026-06-01', '2026-06-01', 1, { priority: 900 }); // hoog

  const resourceRA = res('r12a', 1);
  const assignmentsA = [assign('h1a-r12a', 'h1a', 'r12a', 1), assign('h2a-r12a', 'h2a', 'r12a', 1)];

  const cpmResultA = stubCpmResult('2026-06-01');
  const r12a = levelResources(
    [h1a, h2a], [], [resourceRA], assignmentsA, PROJECT_CAL, [], cpmResultA, LEVEL_OPTS,
  );

  eq('H1 (voltooid, LAGE prioriteit) krijgt NOOIT een levelingDelay — negeert de prioriteitsstrijd volledig',
    r12a.delays['h1a'], undefined);
  ok('H2 (hoge prioriteit) wijkt écht: H1\'s boeking is een vaste last, waarneembaar via een echte delay ondanks haar hogere prioriteit',
    (r12a.delays['h2a'] ?? 0) > 0);
  ok('sub-geval A is volledig opgelost — geen onopgeloste conflicten', Object.keys(r12a.unresolved).length === 0);

  // Sub-geval B: concurrent ZONDER speling (nul float — deelt de laatste earlyFinish met H1b, er is
  // niets dat haar verder kan absorberen) belandt eerlijk in `unresolved`, ipv stil te verdwijnen —
  // en H1b zelf mag daar NOOIT in verschijnen (ze doet niet eens mee aan de eligibility-lus).
  const h1bBase = task('h1b', '2026-06-01', '2026-06-01', 1, { priority: 100 }); // laag
  const h1b: Task = {
    ...h1bBase,
    time: { ...h1bBase.time, completion: 1, actualStart: '2026-06-01', actualFinish: '2026-06-01' },
  };
  const h3 = task('h3', '2026-06-01', '2026-06-01', 1, { priority: 900 }); // hoog

  const resourceRB = res('r12b', 1);
  const assignmentsB = [assign('h1b-r12b', 'h1b', 'r12b', 1), assign('h3-r12b', 'h3', 'r12b', 1)];

  const cpmResultB = stubCpmResult('2026-06-01');
  const SMOOTH_OPTS: LevelingOptions = { constrainToFloat: true };
  const r12b = levelResources(
    [h1b, h3], [], [resourceRB], assignmentsB, PROJECT_CAL, [], cpmResultB, SMOOTH_OPTS,
  );

  eq('H1b (voltooid) krijgt NOOIT een levelingDelay, ook niet in smoothing-modus', r12b.delays['h1b'], undefined);
  eq('H3 krijgt geen delay (bleef op haar eigen PF staan — het venster liet geen slot toe)',
    r12b.delays['h3'], undefined);
  eq('ALLEEN H3 belandt in unresolved — H1b doet niet mee aan de eligibility-lus en kan er dus nooit in staan',
    Object.keys(r12b.unresolved).sort(), ['h3']);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 13 (eindpoortronde W0, slot — W1, reviewer-probe M): een taak IN UITVOERING
// (`(actualStart || completion > 0) && completion < 1`) is EVENZEER onverplaatsbaar als een
// voltooide taak — `CPMSolver.forwardPass`'s IN-UITVOERING-tak (~regel 1458-1844) plant haar,
// net als de VOLTOOID-tak, onvoorwaardelijk op haar actuals/restwerk en negeert `levelingDelay`
// volledig. Geval 12 dekte alleen VOLTOOID; deze fix breidt `fixedLoadIds` uit naar `isImmovableTask`
// (voltooid ÓF in uitvoering). Zelfde SCENARIOKEUZE als geval 12 (priority omgedraaid: B laag, de
// concurrent hoog) — anders zou de eligibility-sortering B toevallig als eerste plaatsen en zou zelfs
// de oude code (die een taak-in-uitvoering nog als gewone movable taak behandelt) hem nooit hoeven te
// verschuiven, geen bewijskracht.
//
// Sub-geval A: concurrent met ELDERS ruimte moet er ECHT omheen — waarneembare boeking, GEEN
// onopgeloste conflicten.
// Sub-geval B: eerlijkheid van `unresolved` — een concurrent ZONDER speling kan nergens anders heen
// en moet dus ECHT (en ALLEEN zij, niet B) in `unresolved` belanden.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: taak IN UITVOERING is onverplaatsbaar, boekt als vaste last (geval 13, W1/probe M) --');
{
  // Sub-geval A: concurrent met speling routeert er succesvol omheen.
  const bABase = task('b13a', '2026-06-01', '2026-06-01', 1, { priority: 100 }); // laag — zie SCENARIOKEUZE
  const b13a: Task = {
    ...bABase,
    time: { ...bABase.time, completion: 0.5, actualStart: '2026-06-01' }, // in uitvoering, geen actualFinish
  };
  const z13a = task('z13a', '2026-06-01', '2026-06-01', 1, { priority: 900 }); // hoog

  const resourceRA = res('r13a', 1);
  const assignmentsA = [assign('b13a-r13a', 'b13a', 'r13a', 1), assign('z13a-r13a', 'z13a', 'r13a', 1)];

  const cpmResultA = stubCpmResult('2026-06-01');
  const r13a = levelResources(
    [b13a, z13a], [], [resourceRA], assignmentsA, PROJECT_CAL, [], cpmResultA, LEVEL_OPTS,
  );

  eq('B (in uitvoering, LAGE prioriteit) krijgt NOOIT een levelingDelay', r13a.delays['b13a'], undefined);
  ok('Z (hoge prioriteit) wijkt écht: B\'s boeking is een vaste last, ondanks haar hogere prioriteit',
    (r13a.delays['z13a'] ?? 0) > 0);
  ok('sub-geval A is volledig opgelost — geen onopgeloste conflicten', Object.keys(r13a.unresolved).length === 0);

  // Sub-geval B: concurrent ZONDER speling belandt eerlijk in `unresolved`, B zelf nooit.
  const bBBase = task('b13b', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const b13b: Task = {
    ...bBBase,
    time: { ...bBBase.time, completion: 0.5, actualStart: '2026-06-01' },
  };
  const z13b = task('z13b', '2026-06-01', '2026-06-01', 1, { priority: 900 });

  const resourceRB = res('r13b', 1);
  const assignmentsB = [assign('b13b-r13b', 'b13b', 'r13b', 1), assign('z13b-r13b', 'z13b', 'r13b', 1)];

  const cpmResultB = stubCpmResult('2026-06-01');
  const SMOOTH_OPTS13: LevelingOptions = { constrainToFloat: true };
  const r13b = levelResources(
    [b13b, z13b], [], [resourceRB], assignmentsB, PROJECT_CAL, [], cpmResultB, SMOOTH_OPTS13,
  );

  eq('B (in uitvoering) krijgt NOOIT een levelingDelay, ook niet in smoothing-modus', r13b.delays['b13b'], undefined);
  eq('Z krijgt geen delay (bleef op haar eigen PF staan — het venster liet geen slot toe)',
    r13b.delays['z13b'], undefined);
  eq('ALLEEN Z belandt in unresolved — B doet niet mee aan de eligibility-lus en kan er dus nooit in staan',
    Object.keys(r13b.unresolved).sort(), ['z13b']);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 14 (eindpoortronde W0, slot — W2, reviewer-probe N2): de leveler-zijde van de VOLTOOID-
// mapping in `occurrenceFor` was ongedekt voor een MEERDAAGSE taak — geval 12 se voltooide taken zijn
// allemaal ÉÉNdaags, dus een mutatie die `|| isCompletedTask` uit `occurrenceFor` verwijdert bleef
// daar onopgemerkt groen. Dit geval bouwt de showcase-bevinding rechtstreeks na op de LEVELER
// (niet — zoals de vorige ronde — alleen op `ResourceLoad.ts`): "Roof structure — House 1"
// (completion=1, actualStart 04-29, actualFinish 05-04 via snapOnOrBefore, scheduleDuration=5) met
// een feestdagenblok op 05-05/05-06 net ná haar echte einde. H1's ECHTE werkdagen (04-29..05-04,
// het weekend 05-02/05-03 overslaand) zijn woe/do/vr/ma — 4 dagen, NIET de 5 die een kale
// `scheduleDuration`-werkdagenwandeling (die de feestdagen zou overslaan en doorlopen tot en met de
// FANTOOMDAG do 05-07) zou opleveren.
//
// Twee concurrenten op dezelfde resource: één op de fantoomdag 05-07 (hoeft NIET te wijken — H1
// boekt daar met de fix niets), één op de ECHTE laatste werkdag 05-04 (moet WÉL wijken — H1 bezet
// die dag echt).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: meerdaagse voltooide taak over een feestdagenblok (geval 14, W2/probe N2) --');
{
  // Ma-vr, met een feestdagenblok op di 05-05/woe 05-06 — net ná H1's echte einde (05-04).
  const HOLIDAY_CAL: WorkCalendar = {
    id: 'cal-holiday-leveler', name: 'feestdagen', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'blokvakantie', startDate: '2026-05-05', endDate: '2026-05-06' }],
  };
  const h1Base = task('h1-n2', '2026-04-29', '2026-05-04', 5, { priority: 500 }); // scheduleDuration=5: stale plan
  const h1n2: Task = {
    ...h1Base,
    time: { ...h1Base.time, completion: 1, actualStart: '2026-04-29', actualFinish: '2026-05-04' },
  };
  const tPhantom = task('t14-phantom', '2026-05-07', '2026-05-07', 1, { priority: 500 });
  const tReal = task('t14-real', '2026-05-04', '2026-05-04', 1, { priority: 500 });

  const resourceR = res('r14', 1);
  const assignments = [
    assign('h1-n2-r14', 'h1-n2', 'r14', 1),
    assign('t14-phantom-r14', 't14-phantom', 'r14', 1),
    assign('t14-real-r14', 't14-real', 'r14', 1),
  ];

  const cpmResult = stubCpmResult('2026-05-07');
  const r14 = levelResources(
    [h1n2, tPhantom, tReal], [], [resourceR], assignments, HOLIDAY_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('H1 (voltooid, meerdaags) krijgt NOOIT een levelingDelay', r14.delays['h1-n2'], undefined);
  eq('concurrent op de FANTOOMDAG 05-07 hoeft niet te wijken — H1 boekt daar niets (fix)',
    r14.delays['t14-phantom'], undefined);
  ok('concurrent op de ECHTE laatste werkdag 05-04 moet wél wijken — H1 bezet die dag echt',
    (r14.delays['t14-real'] ?? 0) > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 15 (B1c-plan-2 taak 2, L3; scherper gemaakt in de B1c-plan-2-etappe-2-fixronde, bevinding 2):
// memoisatie van `occurrenceFor` is ZUIVER — de cachesleutel moet op (taak, startdag) sleutelen, niet
// op alleen de startdag. De oorspronkelijke versie van dit geval vergeleek twee identieke
// `levelResources`-aanroepen met elkaar: omdat `occCache` per aanroep vers wordt aangemaakt
// (`ResourceLeveler.ts`), gaf een FOUTE sleutel in BEIDE runs hetzelfde (foute) antwoord — de test kon
// dus per constructie nooit falen. Deze fixture pint in plaats daarvan de LETTERLIJKE, juiste uitkomst
// van één run, op een scenario dat een datum-only-sleutel aantoonbaar anders laat uitpakken (geverifieerd
// door de sleutel lokaal terug te zetten naar `${formatDate(startDate)}`: X15/Y15/Z15 hieronder gaf dan
// `delays: {}` in plaats van `z15: 2`).
//
// X (dur 1, prio 900, eigen resource rx) plaatst als eerste op 06-01 — haar occurrence (1 dag) komt in
// de cache. Y (dur 3, prio 500, eigen resource ry, GEEN conflict met X) start ook op 06-01: met een
// datum-only-sleutel leest Y's `occurrenceFor(y15, 06-01)` ten onrechte X's 1-dagse occurrence terug in
// plaats van haar eigen 3-daagse, dus Y's conflict-/boekingslus (`i < occ.length`) stopt na dag 1 — Y
// boekt dan nooit 06-02/06-03 op ry. Z (dur 1, prio 100, óók op ry, 06-02) botst met Y's ECHTE dag 2 en
// hoort dus te wijken — met de kapotte cache ziet Z geen conflict en blijft gewoon staan.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-splits: memoisatie van occurrenceFor sleutelt op (taak, startdag) (geval 15, L3) --');
{
  const taskX = task('x15', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskY = task('y15', '2026-06-01', '2026-06-03', 3, { priority: 500 });
  const taskZ = task('z15', '2026-06-02', '2026-06-02', 1, { priority: 100 });

  const resourceRX = res('rx-15', 1);
  const resourceRY = res('ry-15', 1);
  const assignments = [
    assign('x15-r', 'x15', 'rx-15', 1),
    assign('y15-r', 'y15', 'ry-15', 1),
    assign('z15-r', 'z15', 'ry-15', 1),
  ];
  const cpmResult = stubCpmResult('2026-06-03');
  const tasksList: Task[] = [taskX, taskY, taskZ];
  const resourcesList: Resource[] = [resourceRX, resourceRY];
  const run = levelResources(
    tasksList, [], resourcesList, assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS,
  );

  eq('memo-zuiverheid: Z wijkt 2 dagen om Y se ECHTE (3-daagse) bezetting van ry heen',
    run.delays, { z15: 2 });
  eq('memo-zuiverheid: Z se nieuwe start is 06-04, ná Y se volledige occurrence',
    run.shifts['z15']?.newStart, '2026-06-04');
  eq('memo-zuiverheid: geen onopgeloste conflicten', run.unresolved, {});
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
