// check-leveler-pool-ledger.ts — B1c-plan-2 taak 6: een injecteerbaar poolitem-grootboek naast de
// bestaande per-resource-toets (spec §4, "twee grootboeken"). De test bouwt het grootboek met de
// hand (een simpele in-memory boekhouding) — de verdeler doet dat straks uit `computeLibraryOccupancy`.
//
// Vier gevallen:
//  1. BEIDE toetsen moeten slagen — de pooltoets kan blokkeren waar de projecttoets ruim ruimte heeft.
//  2. Het omgekeerde: de projectinzet blokkeert, ondanks een ruim poolrestprofiel — gewone
//     INSUFFICIENT_CAPACITY, geen RESIDUAL_FULL.
//  3. Twee gestempelde resources in ÉÉN document trekken van HETZELFDE grootboek — geen dubbeltelling.
//  4. Een NIET-geplaatste taak boekt NIET in het poolgrootboek (spec §4 stap 3, "geen cascade").
//
// Helperstijl gekopieerd uit `check-leveler-seam.ts`/`check-leveler-ceiling.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources, type LevelingPoolLedger } from '@/engine/scheduler/ResourceLeveler';
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
  id: 'cal-project-leveler-pool', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

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

/** Hand-gebouwd poolitem-grootboek: constant restprofiel per dag, met een eigen boekhouding zodat
 *  `book()` het restprofiel daadwerkelijk laat zakken (spec: "geklemd op minimaal 0"). `bookedOn` is
 *  GEEN onderdeel van het `LevelingPoolLedger`-contract — puur een testhaak om geval 4 te bewijzen. */
function makeLedger(
  residualPerDay: number,
  poolOf: Record<string, string>,
  horizonIso: string | null = null,
): LevelingPoolLedger & { bookedOn(poolItemId: string, iso: string): number } {
  const booked: Record<string, Record<string, number>> = {};
  return {
    poolItemOf(resourceId: string): string | null {
      return poolOf[resourceId] ?? null;
    },
    residualOn(poolItemId: string, iso: string): number {
      const b = booked[poolItemId]?.[iso] ?? 0;
      return Math.max(0, residualPerDay - b);
    },
    book(poolItemId: string, iso: string, units: number): void {
      if (!booked[poolItemId]) booked[poolItemId] = {};
      booked[poolItemId][iso] = (booked[poolItemId][iso] ?? 0) + units;
    },
    horizonIso,
    bookedOn(poolItemId: string, iso: string): number {
      return booked[poolItemId]?.[iso] ?? 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: BEIDE toetsen moeten slagen. Projectresource R met maxUnits 5 (ruim), poolitem P met
// restprofiel 1/dag (constant — nooit genoeg voor A's vraag van 2/dag). De projecttoets slaagt
// overal, de pooltoets nergens ⇒ geen slot binnen de horizon, reden RESIDUAL_FULL (niet
// NO_WINDOW_IN_HORIZON — de bedoeling was hier expliciet de pool, niet een kale uitputting).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-pool-ledger: pool blokkeert waar het project ruimte heeft (geval 1) --');
{
  const taskA = task('a1', '2026-06-01', '2026-06-01', 1, { priority: 500 });
  const resourceR = res('r-pool1', 5);
  const assignments = [assign('a1-r', 'a1', 'r-pool1', 2)];
  const cpmResult = stubCpmResult('2026-06-01');
  const ledger = makeLedger(1, { 'r-pool1': 'P' });

  const r1 = levelResources(
    [taskA], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, poolLedger: ledger },
  );
  eq('pool blokkeert waar het project ruimte heeft: geen delay', r1.delays['a1'], undefined);
  ok('geen slot binnen de horizon', (r1.unresolved['a1']?.length ?? 0) > 0);
  eq('reden: restcapaciteit vol', r1.unresolvedReasons['a1'], 'RESIDUAL_FULL');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: het omgekeerde — de PROJECTinzet blokkeert. R maxUnits 1, poolrest 99 (ruim). Taak A
// (hoge prioriteit) bezet ma; taak B draagt een deadline op haar EIGEN vroege finish (float 0,
// zelfde techniek als `check-leveler-ceiling.ts` geval 2) én `constrainToFloat: true`, dus B heeft
// GEEN ruimte om te wijken — ze blijft op ma onopgelost. De reden moet de gewone
// INSUFFICIENT_CAPACITY zijn, NIET RESIDUAL_FULL: de pool had hier nooit iets tegengehouden.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-pool-ledger: projectinzet blokkeert (geval 2) --');
{
  const taskA = task('a2', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskB = task('b2', '2026-06-01', '2026-06-01', 1, { priority: 100, deadline: '2026-06-01' });
  const resourceR = res('r-pool2', 1);
  const assignments = [assign('a2-r', 'a2', 'r-pool2', 1), assign('b2-r', 'b2', 'r-pool2', 1)];
  const cpmResult = stubCpmResult('2026-06-01');
  const ledger = makeLedger(99, { 'r-pool2': 'P' });

  const r2 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: true, poolLedger: ledger },
  );
  ok('B blijft onopgelost (geen ruimte om te wijken, float 0)', (r2.unresolved['b2']?.length ?? 0) > 0);
  eq('projectinzet blokkeert ⇒ gewone capaciteitsreden', r2.unresolvedReasons['b2'], 'INSUFFICIENT_CAPACITY');
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3: twee gestempelde resources in ÉÉN document trekken van HETZELFDE grootboek. R1 en R2
// hangen allebei aan poolitem P (restprofiel 1/dag), elk met ruime eigen maxUnits (10). Taak A
// (hoge prioriteit) boekt 1/dag op R1 en plaatst op ma, waarna het poolrestprofiel op ma naar 0
// zakt. Taak B boekt 1/dag op R2 en wil ook ma — zonder gedeeld grootboek zou dat "passen" (R2
// heeft zelf nog volop ruimte); mét gedeeld grootboek wijkt B één dag naar di.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-pool-ledger: gedeeld grootboek, geen dubbeltelling (geval 3) --');
{
  const taskA = task('a3', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskB = task('b3', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const resourceR1 = res('r1-pool3', 10);
  const resourceR2 = res('r2-pool3', 10);
  const assignments = [assign('a3-r', 'a3', 'r1-pool3', 1), assign('b3-r', 'b3', 'r2-pool3', 1)];
  const cpmResult = stubCpmResult('2026-06-01');
  const ledger = makeLedger(1, { 'r1-pool3': 'P', 'r2-pool3': 'P' });

  const r3 = levelResources(
    [taskA, taskB], [], [resourceR1, resourceR2], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, poolLedger: ledger },
  );
  eq('A plaatst zonder delay (eerste in de rangorde, poolrest nog vol)', r3.delays['a3'], undefined);
  eq('gedeeld grootboek: geen dubbeltelling — B wijkt één dag', r3.delays['b3'], 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 4: een NIET-geplaatste taak boekt NIET in het poolgrootboek (spec §4 stap 3, "geen
// cascade"). Poolrest 1/dag (constant); taak A (prio 900, 1/dag) past, taak B (prio 100, vraagt
// 5/dag ⇒ past NOOIT binnen restprofiel 1/dag, ongeacht welke dag) niet. Na de run moet het
// grootboek op ma exact 1 geboekt hebben (van A), niet 6.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-pool-ledger: geen boeking voor een niet-plaatsbare taak (geval 4) --');
{
  const taskA = task('a4', '2026-06-01', '2026-06-01', 1, { priority: 900 });
  const taskB = task('b4', '2026-06-01', '2026-06-01', 1, { priority: 100 });
  const resourceR = res('r-pool4', 10); // ruime projectinzet voor beide — alleen de pool knelt
  const assignments = [assign('a4-r', 'a4', 'r-pool4', 1), assign('b4-r', 'b4', 'r-pool4', 5)];
  const cpmResult = stubCpmResult('2026-06-01');
  const ledger = makeLedger(1, { 'r-pool4': 'P' });

  const r4 = levelResources(
    [taskA, taskB], [], [resourceR], assignments, PROJECT_CAL, [], cpmResult,
    { constrainToFloat: false, poolLedger: ledger },
  );
  eq('A plaatst zonder delay (past binnen het restprofiel)', r4.delays['a4'], undefined);
  ok('B blijft onopgelost (5/dag past nooit binnen restprofiel 1/dag)', (r4.unresolved['b4']?.length ?? 0) > 0);
  eq('geen boeking voor een niet-plaatsbare taak', ledger.bookedOn('P', '2026-06-01'), 1);
  ok('en dus geen negatief restprofiel', ledger.residualOn('P', '2026-06-01') >= 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveler-pool-ledger: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveler-pool-ledger: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
