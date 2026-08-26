import fs from 'node:fs';
import path from 'node:path';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { dateToX, MS_PER_DAY, xToDate, xToDayOffset } from '@/engine/renderer/timeAxis';
import { buildCalendarAxis, buildWorkdayAxis, resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { buildSharedAxis } from '@/components/canvas/ganttRenderOptions';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;

function equal(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
}

function close(label: string, actual: number, expected: number, tolerance = 1e-8): void {
  checks++;
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    diffs.push(`${label}: kreeg ${actual}, verwacht ${expected}`);
  }
}

const origin = new Date('2026-08-24T00:00:00.000Z');
const target = new Date(origin.getTime() + 2.5 * MS_PER_DAY);

// De positionele hot-pathfuncties behouden byte-identiek de formule; alleen de naam van het
// derde argument wordt semantisch `chartOriginX`.
for (const [chartOriginX, zoom, scrollX] of [
  [0, 30, 0],
  [317, 7.5, -125],
  [317, 90, 2048],
] as const) {
  const expected = chartOriginX + 2.5 * zoom - scrollX;
  close(`dateToX oorsprong=${chartOriginX} zoom=${zoom} scroll=${scrollX}`, dateToX(target, origin, chartOriginX, zoom, scrollX), expected);
  close(`xToDayOffset inverse oorsprong=${chartOriginX}`, xToDayOffset(expected, chartOriginX, zoom, scrollX), 2.5);
  equal(`xToDate inverse oorsprong=${chartOriginX}`, xToDate(expected, origin, chartOriginX, zoom, scrollX).getTime(), target.getTime());
}

const calendar: WorkCalendar = {
  id: 'coordinate-contract',
  name: 'Coordinate contract',
  description: '',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [],
};
const engine = new CalendarEngine(calendar);

for (const chartOriginX of [0, 317]) {
  const zoom = 24;
  const scrollX = chartOriginX === 0 ? 900 : -33;
  const calendarAxis = buildCalendarAxis({ origin, chartOriginX, zoom, scrollX });
  close(`kalenderas oorsprong ${chartOriginX}`, calendarAxis.dateToX(target), chartOriginX + 2.5 * zoom - scrollX);
  equal(`kalenderas roundtrip ${chartOriginX}`, calendarAxis.xToDate(calendarAxis.dateToX(target)).getTime(), target.getTime());

  const workdayAxis = buildWorkdayAxis({ calendar: engine, origin, chartOriginX, zoom, scrollX });
  const nextWorkday = new Date('2026-08-25T00:00:00.000Z');
  close(`werkdagenas oorsprong ${chartOriginX}`, workdayAxis.dateToX(nextWorkday), chartOriginX + zoom - scrollX);
  equal(`werkdagenas roundtrip ${chartOriginX}`, workdayAxis.xToDate(workdayAxis.dateToX(nextWorkday)).getTime(), nextWorkday.getTime());

  const resolved = resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: chartOriginX !== 0,
    origin,
    chartOriginX,
    zoom,
    scrollX,
  });
  close(`resolveGanttAxis oorsprong ${chartOriginX}`, resolved.dateToX(origin), chartOriginX - scrollX);

  const shared = buildSharedAxis({
    calendar,
    compressNonWorkdays: chartOriginX !== 0,
    viewStartDate: '2026-08-24',
    chartOriginX,
    zoom,
    scrollX,
  });
  close(`buildSharedAxis oorsprong ${chartOriginX}`, shared.dateToX(origin), chartOriginX - scrollX);
}

const root = process.cwd();
const timeAxisSource = fs.readFileSync(path.join(root, 'src/engine/renderer/timeAxis.ts'), 'utf8');
const workdayAxisSource = fs.readFileSync(path.join(root, 'src/engine/renderer/workdayAxis.ts'), 'utf8');
const renderOptionsSource = fs.readFileSync(path.join(root, 'src/components/canvas/ganttRenderOptions.ts'), 'utf8');

equal('timeAxis gebruikt chartOriginX', /chartOriginX:\s*number/.test(timeAxisSource), true);
equal('timeAxis noemt de oude oorsprong niet meer', /taskTableWidth/.test(timeAxisSource), false);
equal('workdayAxis gebruikt chartOriginX', /chartOriginX:\s*number/.test(workdayAxisSource), true);
equal('workdayAxis noemt de oude oorsprong niet meer', /taskTableWidth/.test(workdayAxisSource), false);
equal('SharedAxisInput gebruikt chartOriginX', /interface SharedAxisInput[\s\S]*?chartOriginX:\s*number/.test(renderOptionsSource), true);

if (diffs.length > 0) {
  console.error(`XX  gantt-coordinate-contracts: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.error(`   - ${diff}`);
  process.exit(1);
}

console.log(`OK  gantt-coordinate-contracts: ${checks}/${checks}`);
