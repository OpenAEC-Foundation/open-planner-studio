import './domStub';
// ⚠ bij een baseline van een urentaak met de oude dagtelling (eigenaarsbesluit 2026-10-15).
//
// Sinds optie 2 ("een dag is de werktijd van de taakkalender", zie `hourTaskScheduleDuration`) is een
// taak van 1870 u op een kalender met 8 u/dag en blokken van 10 u 187 d. Een oudere versie sloeg in de
// baseline 233,75 d op (1870 ÷ 8). De eigenaar besloot: niet omrekenen, wel een klein ⚠ met uitleg in de
// kolommen Baselineduur en Duurafwijking — en alleen als de baselineduur aantoonbaar bij de oude telling
// past (`src/engine/baselineOldDay.ts`).
//
// Fixture: `tests/browser/fixtures/ifc/oude-baseline.ifc`, gemaakt met main 3832e5d85 (oude telling) uit
// de XER-fixture van `check-dag-is-werktijd.ts`: kalender "Lange dagen" (8 u/dag, ma–vr 07:00–17:00),
// urentaak A 1870 u, dagtaak D 40 u, baseline "Oud" met A = 233,75 d.
//  §1 oude telling ⇒ ⚠ (A); een dagtaak ⇒ geen ⚠ (D).
//  §2 nieuwe baseline (zelfde taak, nieuwe telling 187 d) ⇒ geen ⚠.
//  §3 twee maatstaven: de huidige werkminuten (vangt ook een gestarte taak) en de baselinespan (vangt een
//     latere duurwijziging); de span beslist als hij bij een telling past, anders de werkminuten.
//  §4 een kalender waarvan de opgeslagen uren per dag gelijk zijn aan de blokken (of minder dan één minuut
//     per dag afwijken) ⇒ geen ⚠.
//  §5 het raster (echte adapter): ⚠ in Baselineduur en Duurafwijking van "Oud", nergens anders.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppStoreContext } from '@/state/appStore';
import { parseOpenedFile } from '@/services/formatRegistry';
import { baselineHasOldDayCount, createBaselineOldDayCheck } from '@/engine/baselineOldDay';
import { engineForTaskCalendar } from '@/engine/scheduler/CPMSolver';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { baselineColumnId } from '@/engine/taskGrid/fieldIds';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import type { BaselineTask } from '@/types/baseline';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { OpenedImport } from '@/services/importTypes';

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  const w = console.warn; const l = console.log; const i = console.info;
  console.warn = () => {}; console.log = () => {}; console.info = () => {};
  try { return await fn(); } finally { console.warn = w; console.log = l; console.info = i; }
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IFC = readFileSync(join(ROOT, 'tests', 'browser', 'fixtures', 'ifc', 'oude-baseline.ifc'), 'utf8');
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
const ctx = createAppStoreContext();
await quiet(async () => ctx.store.getState().applyOpenedImport(
  await parseOpenedFile({ name: 'oude-baseline.ifc', text: IFC }) as OpenedImport, OPEN));
const S = () => ctx.store.getState();
const taskCoded = (code: string) => S().tasks.find((t) => t.wbsCode === code)!;
const A = taskCoded('A');
const D = taskCoded('D');
const oldBaseline = S().baselines.find((b) => b.name === 'Oud')!;
const snapshotOf = (taskId: string, baseline = oldBaseline): BaselineTask => baseline.tasks.find((t) => t.taskId === taskId)!;

same('testvoorwaarde: A is een urentaak van 187 d; de oude baseline zegt 233,75 d; de kalender 8 u/dag bij blokken van 10 u', {
  unit: A.time.durationUnit, sd: A.time.scheduleDuration, baseline: snapshotOf(A.id)?.duration,
  hpd: resolveCalendar(A.calendarId, S().calendars, S().calendar).hoursPerDay,
  eff: effHoursPerDay(resolveCalendar(A.calendarId, S().calendars, S().calendar)),
}, { unit: 'hours', sd: 187, baseline: 233.75, hpd: 8, eff: 10 });

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 Oude telling ⇒ ⚠; dagtaak ⇒ geen ⚠
// ════════════════════════════════════════════════════════════════════════════════════════════════
const check = createBaselineOldDayCheck(S().calendar, S().calendars);
same('§1 oude telling: A met baseline 233,75 d ⇒ ⚠', check(A, snapshotOf(A.id)), true);
same('§1 dagtaak D ⇒ geen ⚠', check(D, snapshotOf(D.id)), false);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 Nieuwe baseline ⇒ geen ⚠
// ════════════════════════════════════════════════════════════════════════════════════════════════
await quiet(() => S().saveBaseline('Nieuw'));
const newBaseline = S().baselines.find((b) => b.name === 'Nieuw')!;
same('§2 testvoorwaarde: de nieuwe baseline zegt 187 d, met dezelfde datums als de oude',
  [snapshotOf(A.id, newBaseline).duration, snapshotOf(A.id, newBaseline).start === snapshotOf(A.id).start,
    snapshotOf(A.id, newBaseline).finish === snapshotOf(A.id).finish], [187, true, true]);
same('§2 nieuwe telling ⇒ geen ⚠', check(A, snapshotOf(A.id, newBaseline)), false);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 Twee maatstaven: de huidige werkminuten (a) en de baselinespan (b)
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const old = snapshotOf(A.id);
  const changed = { ...A, time: { ...A.time, durationMinutes: 120000 } }; // 2000 u: duur gewijzigd na de baseline
  // (a) De baseline past bij de huidige werkminuten in de oude telling, de span niet:
  same('§3a gestarte taak: span 5 werkdagen (werkelijk begin tot einde), 233,75 d = 112200 min ÷ 480 ⇒ ⚠',
    check(A, { ...old, finish: '2026-08-07T17:00' }), true);
  same('§3a onderbreking (einde een week later), duur ongewijzigd ⇒ ⚠', check(A, { ...old, finish: '2027-04-27T17:00' }), true);
  same('§3a baseline zonder einde, duur ongewijzigd ⇒ ⚠', check(A, { ...old, finish: '' }), true);
  // (b) De duur veranderde na de baseline, maar de span past bij de oude telling:
  same('§3b duur gewijzigd (2000 u), span 187 werkdagen = 233,75 × 480 min ⇒ ⚠', check(changed, old), true);
  // Geen van beide past ⇒ geen ⚠:
  same('§3 duur gewijzigd én onderbreking ⇒ geen ⚠', check(changed, { ...old, finish: '2027-04-27T17:00' }), false);
  same('§3 een duur die bij geen van beide telt (200 d) ⇒ geen ⚠', check(A, { ...old, duration: 200 }), false);
  same('§3 nieuwe baseline, daarna duur × 0,8 (1496 u = 187 × 480 min): de span past bij de nieuwe telling ⇒ geen ⚠',
    check({ ...A, time: { ...A.time, durationMinutes: 89760 } }, snapshotOf(A.id, newBaseline)), false);
  same('§3 oude baseline, daarna duur × 1,25 (2337,5 u = 233,75 × 600 min): de span past bij de oude telling ⇒ ⚠',
    check({ ...A, time: { ...A.time, durationMinutes: 140250 } }, old), true);
  same('§3 nieuwe baseline van een gestarte taak (187 d, span 5 werkdagen) ⇒ geen ⚠',
    check(A, { ...snapshotOf(A.id, newBaseline), finish: '2026-08-07T17:00' }), false);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 Kalender zonder afwijking ⇒ geen ⚠
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const cal = resolveCalendar(A.calendarId, S().calendars, S().calendar);
  const same10 = { ...cal, hoursPerDay: 10 };
  const engine: CalendarEngine = engineForTaskCalendar(new Map(), same10);
  same('§4 opgeslagen 10 u/dag bij blokken van 10 u: de oude baseline 233,75 d ⇒ geen ⚠',
    baselineHasOldDayCount(A, snapshotOf(A.id), same10, engine), false);
  // Een afwijking onder de tolerantie (0,3 min per dag): ook een baseline die precies bij die opgeslagen
  // waarde past, krijgt geen ⚠ — over 187 d is dat 56 min verschil, maar het is geen andere dagtelling.
  const almost = { ...cal, hoursPerDay: 10.005 };
  same('§4 opgeslagen 10,005 u/dag bij blokken van 10 u (0,3 min per dag): baseline 112200 ÷ (10,005 × 60) d ⇒ geen ⚠',
    baselineHasOldDayCount(A, { ...snapshotOf(A.id), duration: 112200 / (10.005 * 60) }, almost,
      engineForTaskCalendar(new Map(), almost)), false);
  same('§4 dezelfde kalender met 8 u/dag ⇒ wel ⚠ (controle van de opzet)',
    baselineHasOldDayCount(A, snapshotOf(A.id), cal, engineForTaskCalendar(new Map(), cal)), true);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 Raster: de echte adapter
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const s = S();
  const adapter = createTaskGridAdapter({
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
    scheduleStale: s.scheduleStale, wbsAutoNumber: false,
    effectiveHoursPerDay: (t) => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    baselineOldDay: createBaselineOldDayCheck(s.calendar, s.calendars),
    labelForColumn: (k) => k,
    labelForText: (k) => ({ 'taskGrid.summary.baselineOldDay': 'UITLEG', 'duration.suffixDay': 'd' } as Record<string, string>)[k] ?? k,
    numberLocale: 'nl',
    surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
  });
  const rowOf = (id: string) => s.viewRows.find((r) => r.kind === 'task' && r.task.id === id)!;
  const warningOf = (taskId: string, baselineId: string, field: string) =>
    adapter.getCell(rowOf(taskId).rowKey, baselineColumnId(s.project.id, baselineId, field as never))?.warning ?? null;
  const W = { kind: 'baseline-old-day', text: 'UITLEG' };
  same('§5 "Oud", taak A: ⚠ in Baselineduur en Duurafwijking, niet in begin, einde en de datumafwijkingen',
    ['duration', 'varianceDuration', 'start', 'finish', 'varianceStart', 'varianceFinish'].map((f) => warningOf(A.id, oldBaseline.id, f)),
    [W, W, null, null, null, null]);
  same('§5 "Oud", dagtaak D: geen ⚠', [warningOf(D.id, oldBaseline.id, 'duration'), warningOf(D.id, oldBaseline.id, 'varianceDuration')], [null, null]);
  same('§5 "Nieuw", taak A: geen ⚠', [warningOf(A.id, newBaseline.id, 'duration'), warningOf(A.id, newBaseline.id, 'varianceDuration')], [null, null]);
  same('§5 de celtekst blijft het getal (alleen weergave): Baselineduur 233,75d, Duurafwijking −46,75d',
    [adapter.getCell(rowOf(A.id).rowKey, baselineColumnId(s.project.id, oldBaseline.id, 'duration'))?.text,
      adapter.getCell(rowOf(A.id).rowKey, baselineColumnId(s.project.id, oldBaseline.id, 'varianceDuration'))?.copyText],
    ['233,75d', '-46.75']);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  baseline-oude-dagtelling: ${f}`);
  console.log(`XX  baseline-oude-dagtelling: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  baseline-oude-dagtelling: alle ${checks} checks groen`);
