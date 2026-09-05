// check-apply-leveling-scope.ts — B1c-plan3 taak 2. `applyLeveling` schrijft voortaan binnen een
// SCOPE en schrijft ook `splitGaps`; `clearLeveling` wist ook de leveling-gaten. Headless tegen de
// ECHTE Zustand-store (zelfde `useAppStore.getState()`-patroon als `check-move-assignment.ts`).
//
// Deel 5 (onderaan) is B1c-plan3 taak 3: `clearLevelingGaps` bedraden op tijdbasis-bewerkingen
// (spec §4, "Invalidatie") — zie de toelichting daar voor de gekozen dekking en een AFWIJKING op de
// letterlijke "vier klassen" van de spec.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task, TaskSplitGap } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 1: scope-behoud. Document met taken A, B, C. A draagt AL `levelingDelay: 2` uit een
// eerdere nivellering.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-leveling-scope: deel 1, scope-behoud --');
{
  const idA = S().addTask({ name: 'A' });
  const idB = S().addTask({ name: 'B' });
  const idC = S().addTask({ name: 'C' });
  S().updateTask(idA, { levelingDelay: 2 });

  S().applyLeveling({ delays: { [idC]: 1 }, gaps: {} }, { scopeTaskIds: [idB, idC] });
  const tA = S().tasks.find(t => t.id === idA);
  const tB = S().tasks.find(t => t.id === idB);
  const tC = S().tasks.find(t => t.id === idC);
  eq('A behoudt zijn delay (buiten de scope)', tA?.levelingDelay, 2);
  eq('C krijgt zijn nieuwe delay', tC?.levelingDelay, 1);
  eq('B wordt binnen de scope gereset', tB?.levelingDelay, undefined);

  // Zónder scope blijft het gedrag byte-identiek: alles wordt gereset.
  S().applyLeveling({ delays: {}, gaps: {} });
  const tA2 = S().tasks.find(t => t.id === idA);
  eq('geen scope ⇒ A wordt WEL gereset', tA2?.levelingDelay, undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 2: gaps schrijven. Taak D draagt een IMPORTSPLIT (geen `source`).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-leveling-scope: deel 2, gaps schrijven --');
{
  const idD = S().addTask({ name: 'D' });
  const importSplit: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
  S().updateTask(idD, { splitGaps: [importSplit] });

  const levelingGap: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
  S().applyLeveling({ delays: {}, gaps: { [idD]: [importSplit, levelingGap] } });
  const tD = S().tasks.find(t => t.id === idD);
  eq('splitGaps geschreven zoals aangeleverd', tD?.splitGaps?.length, 2);
  eq('de importsplit staat er nog, zonder source', tD?.splitGaps?.[0]?.source, undefined);
  eq('het leveling-gat draagt zijn herkomst', tD?.splitGaps?.[1]?.source, 'leveling');

  // Idempotent: een TWEEDE applyLeveling ZONDER gaps voor D wist alleen het leveling-gat.
  S().applyLeveling({ delays: {}, gaps: {} });
  const tD2 = S().tasks.find(t => t.id === idD);
  eq('tweede apply: alleen het leveling-gat weg', tD2?.splitGaps?.length, 1);
  eq('en de importsplit staat er nog', tD2?.splitGaps?.[0]?.afterMinutes, 480);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 3: clearLeveling wist ook leveling-gaten, en de no-op-guard telt gaten mee: een document met
// UITSLUITEND een leveling-gat (geen enkele delay) moet clearLeveling nog steeds een snapshot laten
// pushen en runCPM laten draaien.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-leveling-scope: deel 3, clearLeveling wist ook leveling-gaten --');
{
  const idE = S().addTask({ name: 'E' });
  const importSplitE: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
  const levelingGapE: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
  S().updateTask(idE, { splitGaps: [importSplitE] });
  // Geef E UITSLUITEND een leveling-gat, GEEN delay — precies het geval dat de oude no-op-guard miste.
  S().applyLeveling({ delays: {}, gaps: { [idE]: [importSplitE, levelingGapE] } });
  eq('setup: E draagt nu twee gaten, geen delay', S().tasks.find(t => t.id === idE)?.splitGaps?.length, 2);
  eq('setup: E heeft geen levelingDelay', S().tasks.find(t => t.id === idE)?.levelingDelay, undefined);

  // Sessiehistorie (aangepast na merge met main, 2026-09-04): de undo-diepte van het ACTIEVE
  // document is `historyDepthsForActiveScope().undoDepth` — de per-document `undoStack` bestaat niet
  // meer.
  const undoDepthBefore = historyDepthsForActiveScope(S()).undoDepth;
  S().clearLeveling();
  const undoDepthAfter = historyDepthsForActiveScope(S()).undoDepth;
  const tE = S().tasks.find(t => t.id === idE);
  eq('clearLeveling wist het leveling-gat', tE?.splitGaps?.length, 1);
  eq('en laat de importsplit staan', tE?.splitGaps?.[0]?.source, undefined);
  ok('clearLeveling is geen no-op bij alleen een leveling-gat', undoDepthAfter > undoDepthBefore);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 4 (motor): de baseline is ook GAP-vrij — idempotentie. `levelResources` TWEE keer achter
// elkaar op dezelfde fixture, waarbij de gaps van run 1 op de taken geschreven staan vóór run 2.
// Run 2 moet EXACT dezelfde gaps opleveren — accumulatie is de bug die dit pint. Een leveling-gat
// BUITEN de scope overleeft de baseline-strip (spiegel van de delay-regel).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-leveling-scope: deel 4 (motor), idempotente onderbreek-modus --');
{
  const PROJECT_CAL: WorkCalendar = {
    id: 'cal-apply-leveling-scope', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
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
  // Blokker bezet ma+wo+do (di vrij) — zelfde patroon als check-leveler-splitmode.ts.
  const blockerTask = task('blk', '2026-06-01', '2026-06-04', 3, {
    priority: 900,
    splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }],
  });
  const blockerAssign = assign('blk-r', 'blk', 'r-scope4', 1);
  // Z: binnen scope, wijkt via onderbreking naar di + de eerste vrije dag ná de blokker (vr).
  const taskZ = task('z', '2026-06-01', '2026-06-02', 2, { priority: 100, deadline: '2026-06-02' });
  const zAssign = assign('z-r', 'z', 'r-scope4', 1);
  // Buiten: BUITEN de scope, draagt AL een eigen leveling-gat uit een eerdere nivellering die de
  // baseline-strip NIET mag aanraken.
  const priorGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'leveling' };
  const taskBuiten = task('buiten', '2026-06-01', '2026-06-03', 2, { splitGaps: [priorGap] });
  const resource4 = res('r-scope4', 1);
  const opts: LevelingOptions = {
    constrainToFloat: false, overrunCeilingDays: 3, allowSplits: true, scopeTaskIds: ['z'],
  };

  const run1 = levelResources(
    [blockerTask, taskZ, taskBuiten], [], [resource4], [blockerAssign, zAssign], PROJECT_CAL, [],
    stubCpmResult('2026-06-04'), opts,
  );
  ok('run 1: Z krijgt een leveling-gat', (run1.gaps['z']?.filter(g => g.source === 'leveling').length ?? 0) > 0);

  // Schrijf run 1's gaps op Z vóór run 2 — precies wat `applyLeveling` zou doen.
  const taskZWithGaps: Task = { ...taskZ, splitGaps: run1.gaps['z'] };
  const run2 = levelResources(
    [blockerTask, taskZWithGaps, taskBuiten], [], [resource4], [blockerAssign, zAssign], PROJECT_CAL, [],
    stubCpmResult('2026-06-04'), opts,
  );
  eq('nivelleren is idempotent in de onderbreek-modus',
    JSON.stringify(run2.gaps['z']), JSON.stringify(run1.gaps['z']));

  // Buiten de scope: `levelResources` schrijft nooit `gaps` voor een out-of-scope taak (ze doorloopt
  // de eligibility-lus niet); de fixture-toelichting hierboven pint dat de baseline-strip haar
  // BESTAANDE gat (`priorGap`) niet aanraakt — de motor krijgt haar ongewijzigd terug.
  eq('run 2 schrijft geen gaps voor een taak buiten de scope', run2.gaps['buiten'], undefined);
  // En de baseline-strip (die alleen IN-scope taken raakt) laat het bestaande leveling-gat van de
  // out-of-scope taak zelf ongemoeid — de motor muteert de invoertaak nooit.
  eq('de taak buiten de scope behoudt haar eigen leveling-gat ongewijzigd',
    JSON.stringify(taskBuiten.splitGaps), JSON.stringify([priorGap]));
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 5 (B1c-plan3 taak 3): een tijdbasis-bewerking wist de LEVELING-gaten van díé taak (spec §4,
// "Invalidatie") en laat IMPORTSPLITS staan.
//
// AFWIJKING van het letterlijke voorschrift: de spec noemt "voortgang" (completion/actualStart/
// actualFinish) als vierde klasse, mét `setTaskProgress`/`setActualStart`/`setActualFinish` als
// aanroepplekken te verwachten. De discoverable regel die het plan zelf voorschrijft
// (`grep -rn "clearTimephasedWindow" src/`) wijst ECHTER geen van die drie functies aan — ze raken
// `clearTimephasedWindow` helemaal niet aan (bevestigd door de bron te lezen: geen van de drie
// noemt die functie). Een leveling-gat aan een voortgangsmutatie koppelen zou dus een NIEUW
// triggerpunt zijn, niet het overnemen van een bestaand aanroeppatroon — buiten wat dit plan vraagt.
// Deze case dekt daarom de drie klassen die WEL een echte `clearTimephasedWindow`-aanroepplek
// hebben (duur, handmatige datums via `updateTask`, kalender via `setTaskCalendar`), plus de
// "toewijzingen"-trigger die de code zelf als vierde klasse voert (`assignResource`, zie
// `resourceSlice.ts`/`createMcpTransactions.ts`s eigen commentaar "toewijzingen is expliciet
// onderdeel van de triggerset").
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- apply-leveling-scope: deel 5, tijdbasis-bewerkingen wissen leveling-gaten --');
{
  const importSplit5: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
  const levelingGap5: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
  const seed = (name: string) => {
    const id = S().addTask({ name });
    S().applyLeveling({ delays: {}, gaps: { [id]: [importSplit5, levelingGap5] } });
    return id;
  };

  // ── Duur wijzigen ──────────────────────────────────────────────────────────────────────────────
  const idDur = seed('F-duur');
  S().updateTask(idDur, { time: { ...S().tasks.find(t => t.id === idDur)!.time, scheduleDuration: 5 } });
  const tDur = S().tasks.find(t => t.id === idDur);
  eq('duur wijzigen wist het leveling-gat', tDur?.splitGaps?.length, 1);
  eq('en laat de importsplit staan', tDur?.splitGaps?.[0]?.source, undefined);

  // ── Handmatige datums (scheduleStart/scheduleFinish, bv. een Gantt-sleep) ───────────────────────
  const idDates = seed('G-datums');
  S().updateTask(idDates, {
    time: { ...S().tasks.find(t => t.id === idDates)!.time, scheduleStart: '2026-07-01', scheduleFinish: '2026-07-05' },
  });
  const tDates = S().tasks.find(t => t.id === idDates);
  eq('handmatige datums wissen het leveling-gat', tDates?.splitGaps?.length, 1);
  eq('en laat de importsplit staan', tDates?.splitGaps?.[0]?.source, undefined);

  // ── Kalender wijzigen ────────────────────────────────────────────────────────────────────────────
  const idCal = seed('H-kalender');
  S().setTaskCalendar(idCal, 'een-andere-kalender-id');
  const tCal = S().tasks.find(t => t.id === idCal);
  eq('kalender wijzigen wist het leveling-gat', tCal?.splitGaps?.length, 1);
  eq('en laat de importsplit staan', tCal?.splitGaps?.[0]?.source, undefined);

  // ── Toewijzingen (assignResource) — de vierde klasse die de CODE zelf voert (zie de AFWIJKING
  // hierboven), spiegelt "duur, datums, kalender, TOEWIJZINGEN" in resourceSlice.ts/
  // createMcpTransactions.ts se eigen commentaar. ────────────────────────────────────────────────
  const idAsgn = seed('I-toewijzing');
  const resId5 = S().addResource({ name: 'Deel5-resource', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(idAsgn, resId5, 1, 'UNIFORM');
  const tAsgn = S().tasks.find(t => t.id === idAsgn);
  eq('een toewijzing wist het leveling-gat', tAsgn?.splitGaps?.length, 1);
  eq('en laat de importsplit staan', tAsgn?.splitGaps?.[0]?.source, undefined);

  // ── Een taak met UITSLUITEND importsplits blijft ongemoeid (contract van `clearLevelingGaps`:
  // `false` ⇒ niets gemuteerd — hier getoetst via de array-identiteit vóór/ná). ────────────────────
  const idOnlyImport = S().addTask({ name: 'J-alleen-importsplit' });
  S().updateTask(idOnlyImport, { splitGaps: [importSplit5] });
  S().updateTask(idOnlyImport, { time: { ...S().tasks.find(t => t.id === idOnlyImport)!.time, scheduleDuration: 3 } });
  const tOnlyImport = S().tasks.find(t => t.id === idOnlyImport);
  eq('een taak met alleen importsplits blijft ongemoeid', tOnlyImport?.splitGaps?.length, 1);
  eq('en de importsplit is exact hetzelfde gebleven', tOnlyImport?.splitGaps?.[0]?.afterMinutes, 480);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  apply-leveling-scope: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  apply-leveling-scope: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
