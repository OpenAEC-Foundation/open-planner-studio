// F4b (spec "alleen uren" §3.11): de contourdialoog toont dezelfde dagen en delen als histogram en
// nivelleerder.
//
// De dialoog leest de plaatsing van `workPlacement.ts` (`taskLoadPlacement`) en de belasting per dag
// (`assignmentLoadOnPlacement`), net als het histogram. Een fase is een inzet per werkdag; het werk van
// een dag is inzet × deel van de dag × werktijd per dag. Toepassen schrijft periodes die de belasting
// precies zo terugleest.
//  - Probe uit §3.11 (knownbugs 143): urentaak 24 u vanaf wo 3 jun 11:00 ⇒ wo 0,5, do 1, vr 1, ma 0,5.
//  - Een dagenmaat-taak van 2,5 d vanaf ma 07:00 ⇒ ma 1, di 1, wo 0,5.
//  - Een korte vrijdag (6 u) bij een urentaak ⇒ vr 0,75.
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { assignmentLoadOnPlacement, taskLoadPlacement } from '@/engine/scheduler/ResourceLoad';
import { assignmentPlacementLoad } from '@/engine/scheduler/workPlacement';
import {
  contourDayModel, contourPeriodsFromRates, ratesFromShapeWork, remainingMinutesOfRates,
} from '@/engine/contour/contourDays';
import { shapeSlotWork } from '@/engine/contour/contourEdit';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import type { Task, TaskTime, TaskTimephasedContour } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}
const r6 = (xs: readonly number[]) => xs.map(x => Number(x.toFixed(6)));

type Band = { start: number; end: number };
const std: Band[] = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const cal = (id: string, byDay: Record<number, Band[]>): WorkCalendar => ({
  id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, byDay[d] ?? []])) as WorkTimeBands['byWeekday'] },
});
const standard = cal('std', { 1: std, 2: std, 3: std, 4: std, 5: std });
// De voorbeeldweek: ma–do 8 u, vr 6 u (07:00–12:00 + 13:00–14:00).
const shortFriday = cal('kortevr', { 1: std, 2: std, 3: std, 4: std, 5: [{ start: 420, end: 720 }, { start: 780, end: 840 }] });
const engineOf = (c: WorkCalendar) => new CalendarEngine(calendarForEngine(c));
const ops = { workdayDurationMeasure: true };

function task(time: Partial<TaskTime>, extra: Partial<Task> = {}): Task {
  return {
    id: 't', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'], activityCodes: {}, customFields: {},
    ...extra,
    time: { ...createDefaultTaskTime('2026-06-01', 1, 'days'), ...time },
  } as Task;
}
const assignment: ResourceAssignment = { id: 'a', taskId: 't', resourceId: 'r', unitsPerDay: 1 };

// ── 1. De probe van §3.11: een urentaak die midden op de dag begint ──────────────────────────────
const hourTask = task({ durationUnit: 'hours', durationMinutes: 1440, earlyStart: '2026-06-03T11:00', earlyFinish: '2026-06-08T11:00' });
{
  const eng = engineOf(standard);
  const m = contourDayModel(hourTask, assignment, null, eng, ops);
  same('urentaak 24 u vanaf wo 11:00: de dagen', m.isos, ['2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08']);
  same('urentaak: het deel per dag (wo 0,5, do 1, vr 1, ma 0,5)', r6(m.shares), [0.5, 1, 1, 0.5]);
  same('urentaak: één inzet van 1 over alle dagen', m.remainingRates, [1, 1, 1, 1]);
  const histogram = assignmentLoadOnPlacement(hourTask, assignment, taskLoadPlacement(hourTask, eng, ops)!.days, eng, null);
  same('dialoog = histogram: inzet × deel per dag', r6(m.remainingRates.map((r, i) => r * m.shares[i])), r6(histogram));
  same('urentaak: het werk is 24 u', remainingMinutesOfRates(m.remainingRates, m.shares, m.mpd), 1440);
}

// ── 2. Een dagenmaat-taak met een breuk ──────────────────────────────────────────────────────────
const dayTask = task({ durationUnit: 'days', scheduleDuration: 2.5, earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-03T11:00' });
{
  const m = contourDayModel(dayTask, assignment, null, engineOf(standard), ops);
  same('dagenmaat 2,5 d vanaf ma 07:00: ma, di, wo', m.isos, ['2026-06-01', '2026-06-02', '2026-06-03']);
  same('dagenmaat: wo telt half', r6(m.shares), [1, 1, 0.5]);
  same('dagenmaat: het werk is 2,5 × 8 u', remainingMinutesOfRates(m.remainingRates, m.shares, m.mpd), 1200);
}

// ── 3. De korte vrijdag bij een urentaak en bij een dagenmaat-taak ───────────────────────────────
{
  const hours = task({ durationUnit: 'hours', durationMinutes: 2280, earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-05T14:00' });
  const m = contourDayModel(hours, assignment, null, engineOf(shortFriday), ops);
  same('urentaak 38 u op de voorbeeldweek: vr 0,75 van een dag', r6(m.shares), [1, 1, 1, 1, 0.75]);
  const days = task({ durationUnit: 'days', scheduleDuration: 5, earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-05T14:00' });
  const d = contourDayModel(days, assignment, null, engineOf(shortFriday), ops);
  same('dagenmaat 5 d op de voorbeeldweek: vr is één werkdag (dagslot)', r6(d.shares), [1, 1, 1, 1, 1]);
}

// ── 4. Toepassen zonder wijziging legt de verdeling vast, niets anders ───────────────────────────
for (const [name, t] of [['urentaak', hourTask], ['dagenmaat', dayTask]] as const) {
  const eng = engineOf(standard);
  const m = contourDayModel(t, assignment, null, eng, ops);
  const periods = contourPeriodsFromRates(undefined, m.remainingRates, m.days, m.mpd);
  const contour: TaskTimephasedContour = { resourceUid: null, resourceId: 'r', periods };
  const before = assignmentLoadOnPlacement(t, assignment, m.days, eng, null);
  const after = assignmentPlacementLoad(assignment, m.days, m.mpd, contour, () => []);
  same(`${name}: na Toepassen boekt het histogram hetzelfde`, r6(after), r6(before));
  const again = contourDayModel(t, assignment, contour, eng, ops);
  same(`${name}: de dialoog leest dezelfde inzet terug`, r6(again.remainingRates), r6(m.remainingRates));
}

// Een urentaak loopt per werkblok (twee stukken per dag rond de pauze); opgeslagen wordt één periode per dag.
{
  const eng = engineOf(standard);
  const t = task({ durationUnit: 'hours', durationMinutes: 960, earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-02T16:00' });
  const m = contourDayModel(t, assignment, null, eng, ops);
  same('urentaak met pauze: twee stukken per dag in de plaatsing', m.days.map(d => d.ranges.length), [2, 2]);
  same('urentaak met pauze: één periode per dag', contourPeriodsFromRates(undefined, m.remainingRates, m.days, m.mpd),
    [{ afterMinutes: 0, minutes: 480, workMinutes: 480, kind: 'remaining' }, { afterMinutes: 480, minutes: 480, workMinutes: 480, kind: 'remaining' }]);
}

// ── 5. Een andere inzet per dag en het verrichte werk ────────────────────────────────────────────
{
  const eng = engineOf(standard);
  const m = contourDayModel(hourTask, assignment, null, eng, ops);
  const periods = contourPeriodsFromRates(
    [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }], [2, 1, 1, 0], m.days, m.mpd,
  );
  same('de actual-periodes blijven staan', periods.filter(p => p.kind === 'actual'), [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }]);
  const contour: TaskTimephasedContour = { resourceUid: null, resourceId: 'r', periods };
  const back = contourDayModel(hourTask, assignment, contour, eng, ops);
  same('inzet 2 op een halve dag: 2 terug, niet 1', r6(back.remainingRates), [2, 1, 1, 0]);
  same('verricht werk per dag', r6(back.actualMinutes), [240, 0, 0, 0]);
  same('histogram: verricht + rest per dag', r6(assignmentPlacementLoad(assignment, m.days, m.mpd, contour, () => [])), [1.5, 1, 1, 0]);
}

// ── 6. Een vorm houdt het totaal, met het deel van de dag ────────────────────────────────────────
{
  const m = contourDayModel(hourTask, assignment, null, engineOf(standard), ops);
  const total = remainingMinutesOfRates(m.remainingRates, m.shares, m.mpd);
  const rates = ratesFromShapeWork(shapeSlotWork('BELL', total, m.days.length), m.shares, total, m.mpd);
  same('vorm Bel: het totaal blijft 24 u', Number(remainingMinutesOfRates(rates, m.shares, m.mpd).toFixed(6)), 1440);
  same('vorm Bel: een piek in het midden', rates[1] > rates[0] && rates[2] > rates[3], true);
}

// ── 7. De dialoog gebruikt deze regel ────────────────────────────────────────────────────────────
const root = resolvePath(fileURLToPath(new URL('.', import.meta.url)), '../../src');
const dialog = readFileSync(resolvePath(root, 'components', 'dialogs', 'ContourDialog.tsx'), 'utf8');
same('ContourDialog leest contourDayModel en schrijft contourPeriodsFromRates', [
  /contourDayModel\(task, assignment, contour, engine, effectiveSchedulingOptions\(/.test(dialog),
  /contourPeriodsFromRates\(model\.contour\?\.periods, rates, model\.placement, model\.mpd\)/.test(dialog),
  /contourLookup\(/.test(dialog),
  /taskWorkDayIsos|assignmentDayUnits|buildEditedContourPeriods/.test(dialog),
], [true, true, true, false]);

if (failures.length > 0) {
  for (const f of failures) console.log(`   XX ${f}`);
  console.error(`\nTOTAAL: ${failures.length}/${checks} afwijking(en)`);
  process.exit(1);
}
console.log(`   OK ${checks} controles op de dagen van de contourdialoog (F4b, §3.11)`);
console.log('\nTOTAAL: alles groen');
process.exit(0);
