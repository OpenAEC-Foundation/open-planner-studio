// Mijlpalen-overzicht: "Kritiek" volgt de kritiek-definitie van de solver (audit weergaven, bevinding 9).
//
// AANLEIDING. Gantt, raster, tooltip, kritiek-rapport en MCP lezen `isCritical`: de solverdefinitie
// met drempel (Rekenopties), "langste pad", "voltooid is nooit kritiek" en hammock. Het
// Mijlpalen-overzicht (scherm én vector-PDF) rekende zelf `tf <= 0`. Met een drempel van 2 wd stond
// een rode, kritieke mijlpaal (TF 1) daardoor groen als "Op schema"; en een voltooide mijlpaal met
// TF 0 stond als "Kritiek" terwijl de solver zegt dat hij het niet is. De eigen te-laat-regel van het
// rapport (geschonden constraint, gemiste deadline of tf < 0) blijft bewust staan.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { computeMilestoneRows } from '@/components/panels/MilestoneReport';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

function project(schedulingOptions?: SchedulingOptions): void {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Mijlpalen', ...(schedulingOptions ? { schedulingOptions } : {}) });
}
const rowOf = (id: string) => computeMilestoneRows(S().tasks, S().cpmResult).find(r => r.id === id);
const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;

// ── 1. Drempel "kritiek bij TS ≤ 2 wd": M (TF 1) is kritiek ─────────────────
{
  project({ criticalDefinition: { mode: 'totalFloat', threshold: 2 } } as SchedulingOptions);
  const A = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as TaskTime });
  const B = S().addTask({ name: 'B', time: { scheduleDuration: 6 } as TaskTime });
  const M = S().addTask({ name: 'M oplevering ruwbouw', isMilestone: true });
  const E = S().addTask({ name: 'E', time: { scheduleDuration: 1 } as TaskTime });
  S().addSequence({ predecessorId: A, successorId: M, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: M, successorId: E, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: B, successorId: E, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  eq('1 opzet: M heeft TF 1 en is kritiek volgens de solver', [taskOf(M).time.totalFloat, taskOf(M).time.isCritical], [1, true]);
  eq('1a Mijlpalen-overzicht: M staat als kritiek', rowOf(M)?.status, 'critical');
}

// ── 2. Standaarddefinitie, voltooide mijlpaal met TF 0: nooit kritiek ────────
{
  project();
  S().setProject({ statusDate: '2026-06-10' });
  const A = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as TaskTime });
  const M = S().addTask({ name: 'M fundering klaar', isMilestone: true });
  const E = S().addTask({ name: 'E', time: { scheduleDuration: 3 } as TaskTime });
  S().addSequence({ predecessorId: A, successorId: M, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: M, successorId: E, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  // A volgens plan afgerond, daarna M op zijn (herberekende) datum vóór de statusdatum.
  eq('2 opzet: actuals van A geaccepteerd', [S().setActualStart(A, '2026-06-01'), S().setActualFinish(A, '2026-06-05')], [true, true]);
  S().runCPM();
  eq('2 opzet: actual van M geaccepteerd', S().setActualFinish(M, taskOf(M).time.earlyStart.slice(0, 10)), true);
  S().runCPM();
  const m = taskOf(M);
  eq('2 opzet: M voltooid, TF 0, niet kritiek volgens de solver', [m.time.completion, m.time.totalFloat, m.time.isCritical], [1, 0, false]);
  eq('2a Mijlpalen-overzicht: M staat NIET als kritiek', rowOf(M)?.status, 'onSchedule');
}

// ── 3. De eigen te-laat-regel blijft: TF < 0 ⇒ te laat, ook als hij kritiek is ─
{
  project();
  const A = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as TaskTime });
  const M = S().addTask({ name: 'M met deadline', isMilestone: true });
  S().addSequence({ predecessorId: A, successorId: M, type: 'FINISH_START', lagDays: 0 });
  S().updateTask(M, { deadline: '2026-06-03' });
  S().runCPM();
  const m = taskOf(M);
  eq('3 opzet: M mist zijn deadline (TF < 0) en is kritiek', [m.time.totalFloat < 0, m.time.isCritical], [true, true]);
  eq('3a Mijlpalen-overzicht: M staat als te laat', rowOf(M)?.status, 'late');
}

// ── 4. Gewoon geval: speling > 0, niet kritiek ⇒ op schema ───────────────────
{
  project();
  const A = S().addTask({ name: 'A', time: { scheduleDuration: 2 } as TaskTime });
  const B = S().addTask({ name: 'B', time: { scheduleDuration: 8 } as TaskTime });
  const M = S().addTask({ name: 'M tussendoel', isMilestone: true });
  const E = S().addTask({ name: 'E', time: { scheduleDuration: 1 } as TaskTime });
  S().addSequence({ predecessorId: A, successorId: M, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: M, successorId: E, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: B, successorId: E, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  eq('4 opzet: M heeft speling en is niet kritiek', [taskOf(M).time.totalFloat > 0, taskOf(M).time.isCritical], [true, false]);
  eq('4a Mijlpalen-overzicht: M op schema', rowOf(M)?.status, 'onSchedule');
}

if (diffs.length === 0) {
  console.log(`OK  milestone-report-status: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  milestone-report-status: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
