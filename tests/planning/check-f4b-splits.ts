import './domStub';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveDayMeasureBarDrag } from '@/engine/renderer/hourBarDragMath';
import { splitEngineFor, taskSplitMeasure, taskSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { splitPieceRanges } from '@/components/task-sections/TaskSplitsSection';
import {
  dagslotMinutes, dagslotMinutesBetween, dagslotMoment, dagslotWorkMinimum, dragWorkdaySteps, splitWorkdayStart, workOffsetOnAxis,
} from '@/components/canvas/hooks/timelineSnap';
import { buildPrintRows, measureTableColumnWidths, renderReport, type PrintOptions } from '@/services/print/printPreview';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskSplitGap, TaskTime } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Band = { start: number; end: number };
const week = (bands: Band[], friday: Band[] = bands): WorkTimeBands => ({
  byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: friday, 6: [], 7: [] },
});
const cal = (id: string, workTime?: WorkTimeBands): WorkCalendar => ({
  id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  ...(workTime ? { workTime } : {}),
});
const standard = cal('std', week([{ start: 420, end: 720 }, { start: 780, end: 960 }]));
const shortFriday = cal('week', week([{ start: 420, end: 720 }, { start: 780, end: 960 }], [{ start: 420, end: 720 }, { start: 780, end: 840 }]));
const night = cal('nacht', week([{ start: 1320, end: 1800 }]));
const eightToFour = cal('08-16', week([{ start: 480, end: 960 }]));
const scalar = cal('dagkalender');

const I = (iso: string) => parseInstant(iso);
const F = (d: Date) => formatInstant(d, 'hour');
const engineOf = (c: WorkCalendar) => new CalendarEngine(calendarForEngine(c));

function task(time: Partial<TaskTime>, gaps?: TaskSplitGap[]): Task {
  return {
    id: 't', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], activityCodes: {}, customFields: {},
    ...(gaps ? { splitGaps: gaps } : {}),
    time: { ...createDefaultTaskTime('2026-06-01', 1, 'days'), ...time },
  } as Task;
}
const dayTask = (start: string, finish: string, days: number, gaps?: TaskSplitGap[]) =>
  task({ durationUnit: 'days', scheduleDuration: days, scheduleStart: start, earlyStart: start, scheduleFinish: finish, earlyFinish: finish }, gaps);

{
  const std = engineOf(standard);
  same('dagslot = werktijd per dag × 60', dagslotMinutes(std), 480);
  same('ma 13:00 → di 07:00 = 0,375 d = 180 asminuten', dagslotMinutesBetween(I('2026-06-01T13:00'), I('2026-06-02T07:00'), std), 180);
  same('terug naar links is negatief', dagslotMinutesBetween(I('2026-06-02T07:00'), I('2026-06-01T13:00'), std), -180);
  same('werkstuk vanaf ma 13:00 loopt ten minste tot di (180)', dagslotWorkMinimum(I('2026-06-01T13:00'), std, standard), 180);
  same('werkstuk vanaf het begin van de dag: één werkdag', dagslotWorkMinimum(I('2026-06-01T07:00'), std, standard), 480);
  same('moment na 480 asminuten: het begin van de volgende werkdag', F(dagslotMoment(I('2026-06-01T07:00'), 480, std)), '2026-06-02T07:00');
  same('moment na 120 asminuten: een kwart dag', F(dagslotMoment(I('2026-06-01T07:00'), 120, std)), '2026-06-01T09:00');
  const pieces = [{ kind: 'work' as const, minutes: 480 }, { kind: 'gap' as const, minutes: 480 }, { kind: 'work' as const, minutes: 960 }];
  same('werkpositie na de pauze', workOffsetOnAxis(pieces, 1440), { workMinutes: 960, inGap: false });
  same('werkpositie in de pauze', workOffsetOnAxis(pieces, 600), { workMinutes: 480, inGap: true });
  const week6 = engineOf(shortFriday);
  same('korte vrijdag (6 u) telt als één dagslot (480), niet als 360 werkminuten',
    [dagslotMinutesBetween(I('2026-06-05T07:00'), I('2026-06-08T07:00'), week6), week6.workMinutesBetween(I('2026-06-05T07:00'), I('2026-06-08T07:00'))],
    [480, 360]);
  const nightEng = engineOf(night);
  same('nachtploeg: di 22:00 → wo 22:00 = één dagslot', dagslotMinutesBetween(I('2026-06-02T22:00'), I('2026-06-03T22:00'), nightEng), 480);
  same('nachtploeg: de pointer om wo 02:00 valt op het begin van de ploeg van di',
    F(splitWorkdayStart(I('2026-06-03T02:00'), nightEng, night)), '2026-06-02T22:00');
}

{
  const std = engineOf(standard);
  const base = {
    calendar: std, originalStart: I('2026-06-01T07:00'), originalFinish: I('2026-06-03T11:00'), originalDays: 2.5,
    pointerStart: I('2026-06-01T12:00'), pointerCurrent: I('2026-06-01T12:00'), snapMinutes: 1440,
  };
  const drag = (over: Partial<Parameters<typeof resolveDayMeasureBarDrag>[0]>) => {
    const r = resolveDayMeasureBarDrag({ ...base, edge: 'body', ...over });
    return [F(r.start), F(r.finish), r.days];
  };
  same('2,5 d vanaf ma 07:00 eindigt wo 11:00 (motor)', F(std.addMeasuredWorkdays(base.originalStart, 2.5)), '2026-06-03T11:00');
  same('dagzoom: balk +1 werkdag houdt de duur', drag({ edge: 'body', workdaySteps: 1 }), ['2026-06-02T07:00', '2026-06-04T11:00', 2.5]);
  same('dagzoom: balk −1 werkdag over het weekend', drag({ edge: 'body', workdaySteps: -1 }), ['2026-05-29T07:00', '2026-06-02T11:00', 2.5]);
  same('dagzoom: rechterrand +1 werkdag houdt de breuk', drag({ edge: 'right', workdaySteps: 1 }), ['2026-06-01T07:00', '2026-06-04T11:00', 3.5]);
  same('dagzoom: rechterrand niet korter dan één werkdag', drag({ edge: 'right', workdaySteps: -2 }), ['2026-06-01T07:00', '2026-06-01T16:00', 1]);
  same('dagzoom: linkerrand +1 werkdag', drag({ edge: 'left', workdaySteps: 1 }), ['2026-06-02T07:00', '2026-06-03T11:00', 1.5]);
  same('dagzoom: een start midden op de dag houdt zijn plek in de dag',
    drag({ edge: 'body', workdaySteps: 1, originalStart: I('2026-06-01T13:00'), originalFinish: I('2026-06-03T13:00'), originalDays: 2 }),
    ['2026-06-02T13:00', '2026-06-04T12:00', 2]);
  same('uurzoom: rechterrand +2 u geeft een breuk', drag({ edge: 'right', snapMinutes: 60, pointerCurrent: I('2026-06-01T14:00') }),
    ['2026-06-01T07:00', '2026-06-03T12:00', 2.625]);
  same('uurzoom: balk +1 u houdt de duur', drag({ edge: 'body', snapMinutes: 60, pointerCurrent: I('2026-06-01T13:00') }),
    ['2026-06-01T08:00', '2026-06-03T12:00', 2.5]);
  same('uurzoom: rechterrand niet korter dan één uur', drag({ edge: 'right', snapMinutes: 60, pointerCurrent: I('2026-05-25T12:00') }),
    ['2026-06-01T07:00', '2026-06-01T08:00', 0.125]);
  const week6 = engineOf(shortFriday);
  const r = resolveDayMeasureBarDrag({
    calendar: week6, edge: 'right', originalStart: I('2026-06-04T07:00'), originalFinish: I('2026-06-04T16:00'), originalDays: 1,
    workdaySteps: 1, pointerStart: I('2026-06-04T12:00'), pointerCurrent: I('2026-06-05T12:00'), snapMinutes: 1440,
  });
  same('korte vrijdag: de rand +1 werkdag eindigt vr 14:00', [F(r.finish), r.days], ['2026-06-05T14:00', 2]);
  const n = resolveDayMeasureBarDrag({
    calendar: engineOf(night), edge: 'body', originalStart: I('2026-06-01T22:00'), originalFinish: I('2026-06-02T06:00'), originalDays: 1,
    workdaySteps: 1, pointerStart: I('2026-06-02T01:00'), pointerCurrent: I('2026-06-03T01:00'), snapMinutes: 1440,
  });
  same('nachtploeg: één ploeg verder', [F(n.start), F(n.finish)], ['2026-06-02T22:00', '2026-06-03T06:00']);
  const gaps: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }];
  const split = (over: Partial<Parameters<typeof resolveDayMeasureBarDrag>[0]>) => {
    const r = resolveDayMeasureBarDrag({
      calendar: std, edge: 'left', originalStart: I('2026-06-01T07:00'), originalFinish: I('2026-06-05T16:00'), originalDays: 4,
      splitGaps: gaps, pointerStart: I('2026-06-01T12:00'), pointerCurrent: I('2026-06-01T12:00'), snapMinutes: 1440, ...over,
    });
    return [F(r.start), F(r.finish), r.days];
  };
  same('splits, dagzoom: linkerrand +1 werkdag begint di en houdt het einde', split({ workdaySteps: 1 }), ['2026-06-02T07:00', '2026-06-05T16:00', 3]);
  same('splits, dagzoom: linkerrand −1 werkdag begint de vrijdag ervoor', split({ workdaySteps: -1 }), ['2026-05-29T07:00', '2026-06-05T16:00', 5]);
  same('splits, dagzoom: de linkerrand houdt het laatste werkstuk ten minste één werkdag', split({ workdaySteps: 3 }), ['2026-06-03T07:00', '2026-06-05T16:00', 2]);
  same('splits, uurzoom: linkerrand +2 u', split({ snapMinutes: 60, pointerCurrent: I('2026-06-01T14:00') }), ['2026-06-01T09:00', '2026-06-05T16:00', 3.75]);
  same('splits, dagzoom: body +1 werkdag houdt de pauze in het einde', split({ edge: 'body', workdaySteps: 1 }), ['2026-06-02T07:00', '2026-06-08T16:00', 4]);
  same('splits, uurzoom: body +1 u schuift alles een uur, ook over de pauze en het weekend',
    split({ edge: 'body', snapMinutes: 60, pointerCurrent: I('2026-06-01T13:00') }), ['2026-06-01T08:00', '2026-06-08T08:00', 4]);
}
{
  const std = engineOf(standard);
  const steps = (anchor: string, columns: number, side: 'start' | 'end' = 'start', compressed = false, eng = std, c = standard) =>
    dragWorkdaySteps(I(anchor), side, columns, std, compressed, eng, c);
  same('kolommen: ma +1 = 1 werkdag', steps('2026-06-01T07:00', 1), 1);
  same('kolommen: vr +1 (za) = de eerstvolgende werkdag, 1', steps('2026-06-05T07:00', 1), 1);
  same('kolommen: vr +2 (zo) = 1, vr +3 (ma) = 1, vr +4 (di) = 2',
    [steps('2026-06-05T07:00', 2), steps('2026-06-05T07:00', 3), steps('2026-06-05T07:00', 4)], [1, 1, 2]);
  same('kolommen: ma −1 (zo) = de vorige werkdag, −1; ma −3 (vr) = −1; ma −4 (do) = −2',
    [steps('2026-06-08T07:00', -1), steps('2026-06-08T07:00', -3), steps('2026-06-08T07:00', -4)], [-1, -1, -2]);
  same('kolommen: geen beweging = 0', steps('2026-06-01T07:00', 0), 0);
  same('kolommen onder werkdagencompressie: één kolom is één werkdag', steps('2026-06-05T07:00', 3, 'start', true), 3);
  same('rechterrand: de werkdag van het einde (do 11:00) +1 = vr', steps('2026-06-04T11:00', 1, 'end'), 1);
  same('rechterrand op de dagrand: einde vr 16:00 +1 (za) = ma', steps('2026-06-05T16:00', 1, 'end'), 1);
  same('nachtploeg: een start di 22:00 hoort bij di; +1 = wo',
    steps('2026-06-02T22:00', 1, 'start', false, engineOf(night), night), 1);
  same('nachtploeg: een einde za 06:00 hoort bij vr; +1 (za) = ma',
    steps('2026-06-06T06:00', 1, 'end', false, engineOf(night), night), 1);
  const sevenBands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
  const sevenDays = cal('zeven', { byWeekday: { 1: sevenBands, 2: sevenBands, 3: sevenBands, 4: sevenBands, 5: sevenBands, 6: sevenBands, 7: sevenBands } });
  sevenDays.workDays = [1, 2, 3, 4, 5, 6, 7];
  const seven = engineOf(sevenDays);
  same('eigen taakkalender onder compressie: vr +1 kolom = ma = 3 werkdagen van de taak',
    steps('2026-06-05T07:00', 1, 'start', true, seven, sevenDays), 3);
  same('eigen taakkalender onder compressie: ma −1 kolom = vr = −3 werkdagen van de taak',
    steps('2026-06-08T07:00', -1, 'start', true, seven, sevenDays), -3);
  same('eigen taakkalender zonder compressie: vr +1 kolom = za = 1 werkdag van de taak',
    steps('2026-06-05T07:00', 1, 'start', false, seven, sevenDays), 1);
  const moved = resolveDayMeasureBarDrag({
    calendar: seven, edge: 'body', originalStart: I('2026-06-05T07:00'), originalFinish: I('2026-06-05T16:00'), originalDays: 1,
    workdaySteps: steps('2026-06-05T07:00', 1, 'start', true, seven, sevenDays),
    pointerStart: I('2026-06-05T12:00'), pointerCurrent: I('2026-06-08T12:00'), snapMinutes: 1440,
  });
  same('eigen taakkalender onder compressie: de balk landt op maandag, zoals getekend',
    [F(moved.start), F(moved.finish), moved.days], ['2026-06-08T07:00', '2026-06-08T16:00', 1]);
}


{
  const probe = dayTask('2026-06-01T08:00', '2026-06-02T10:00', 1, [
    { afterMinutes: 120, gapMinutes: 60, source: 'user' }, { afterMinutes: 300, gapMinutes: 60, source: 'user' },
  ]);
  same('stukken van de probe (dagslots)', taskSplitSegments(probe, eightToFour, true)?.map(s => [F(s.start), F(s.end)]), [
    ['2026-06-01T08:00', '2026-06-01T10:00'], ['2026-06-01T11:00', '2026-06-01T13:00'], ['2026-06-01T14:00', '2026-06-02T10:00'],
  ]);
  same('paneel Onderbrekingen: van–tot na elke pauze, B4 (knownbug 244)', splitPieceRanges(probe, eightToFour, true), [
    { from: '2026-06-01T11:00', to: '2026-06-01T13:00' }, { from: '2026-06-01T14:00', to: '2026-06-02T10:00' },
  ]);
  const friday = dayTask('2026-06-04T07:00', '2026-06-09T16:00', 3, [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  same('maat van de split-as: OPS dagslots, P6 werkminuten', [taskSplitMeasure(friday, true), taskSplitMeasure(friday, false)], ['workdays', true]);
  same('OPS: het werk na een pauze van één werkdag hervat ma 07:00',
    F(taskSplitSegments(friday, shortFriday, true)![1].start), '2026-06-08T07:00');
  same('P6: dezelfde pauze is 480 werkminuten en hervat ma 09:00',
    F(taskSplitSegments(friday, shortFriday, false)![1].start), '2026-06-08T09:00');
  same('paneel: het stuk na de pauze toont "ma 8 jun" (OPS)', splitPieceRanges(friday, shortFriday, true)[0], { from: '2026-06-08', to: '2026-06-09' });
  const half = dayTask('2026-06-01T07:00', '2026-06-02T16:00', 1, [{ afterMinutes: 240, gapMinutes: 240, source: 'user' }]);
  same('dagkalender: het eerste stuk eindigt na een halve werkdag', F(taskSplitSegments(half, scalar, true)![0].end), '2026-06-01T11:00');
  same('één engine per kalenderobject', splitEngineFor(scalar) === splitEngineFor(scalar), true);
}

{
  const texts: string[] = [];
  const connectors: string[] = [];
  let curPath: unknown[] | null = null;
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash() {}, fillRect() {}, strokeRect() {}, beginPath() { curPath = []; },
    moveTo(x, y) { curPath?.push([x, y]); }, lineTo(x, y) { curPath?.push([x, y]); }, closePath() {},
    fill() { curPath = null; },
    stroke() { if (curPath && /80$/.test(st.strokeStyle)) connectors.push(st.strokeStyle); curPath = null; },
    roundRect() {}, fillText(text) { texts.push(text); }, measureText(t) { return { width: t.length * 6 }; },
  };
  const hourTask = {
    ...task({ durationUnit: 'hours', durationMinutes: 480, scheduleDuration: 1,
      scheduleStart: '2026-06-03T07:00', earlyStart: '2026-06-03T07:00', scheduleFinish: '2026-06-03T17:00', earlyFinish: '2026-06-03T17:00' },
    [{ afterMinutes: 240, gapMinutes: 60, source: 'user' }]),
    id: 'h', name: 'Urentaak',
  } as Task;
  const options = {
    showCritical: true, showFloat: false, showDeps: false, showWeekends: true, showLegend: false, showTaskNames: false,
    showCompletion: false, autoFit: true, customZoom: 22, paperSize: 'A3', orientation: 'landscape', companyName: 'Test',
    barColorSelection: { mode: 'critical' }, activityCodeTypes: [], customFieldDefs: [], taskTypeLabels: {}, barColorNoneLabel: '-',
    dateNotation: 'dmy', timeNotation: '24h',
  } as unknown as PrintOptions;
  const longDay = cal('lang', week([{ start: 420, end: 720 }, { start: 780, end: 1020 }]));
  const widths = (tasks: Task[]) => measureTableColumnWidths(buildPrintRows(tasks, undefined), {
    showCompletion: false, dateNotation: 'dmy', timeNotation: '24h', calendar: longDay, calendars: [],
  }, text => text.length * 6);
  renderReport(() => d2d, [hourTask], [], longDay, 'P', { ...options, columnWidths: widths([hourTask]) });
  same('afdruk: een taak van één dag met een pauze van een uur tekent een onderbreking', connectors.length > 0, true);
  same('afdruk: de tabel toont de start op de dagrand zonder tijd en het einde midden op de dag met tijd',
    [texts.includes('03-06-2026'), texts.includes('03-06-2026 17:00')], [true, false]);
  texts.length = 0;
  const midDay = { ...hourTask, splitGaps: undefined, time: { ...hourTask.time, scheduleStart: '2026-06-03T13:00', earlyStart: '2026-06-03T13:00', scheduleFinish: '2026-06-04T12:00', earlyFinish: '2026-06-04T12:00' } } as Task;
  renderReport(() => d2d, [midDay], [], longDay, 'P', { ...options, columnWidths: widths([midDay]) });
  same('afdruk: start 13:00 en einde 12:00 met tijd (B4)', [texts.includes('03-06-2026 13:00'), texts.includes('04-06-2026 12:00')], [true, true]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`\n${failures.length}/${checks} F4b-splitchecks mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b-splits: ${checks} checks groen.`);
