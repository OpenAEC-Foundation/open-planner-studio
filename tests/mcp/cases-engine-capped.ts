import { useAppStore, test, assert, assertEq, run } from './harness';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

function makeCal(overrides: Partial<WorkCalendar>): WorkCalendar {
  return {
    id: 'test-cal',
    name: 'Test',
    description: '',
    workDays: [...CLEAN_WORKDAYS],
    workStartHour: 8,
    workEndHour: 17,
    hoursPerDay: 8,
    holidays: [],
    ...overrides,
  };
}

test('addWorkDaysChecked meldt capped bij een holiday-blok >366 dagen vanaf de startdatum', () => {
  const eng = new CalendarEngine(
    makeCal({ holidays: [{ name: 'blok', startDate: '2026-06-01', endDate: '2027-12-31' }] }),
  );
  const res = eng.addWorkDaysChecked(parseDate('2026-06-01'), 5);
  assert(res.capped === true, `verwacht capped=true, kreeg ${JSON.stringify(res)}`);
});

test('addWorkDaysChecked meldt NIET capped op een normale kalender (+ byte-identiek aan addWorkDays)', () => {
  const eng = new CalendarEngine(makeCal({}));
  const start = parseDate('2026-06-01');
  const res = eng.addWorkDaysChecked(start, 5);
  assert(res.capped === false, `verwacht capped=false, kreeg ${JSON.stringify(res)}`);
  assertEq(res.date.toISOString().slice(0, 10), '2026-06-05', 'addWorkDaysChecked-datum');
  assertEq(
    res.date.getTime(), eng.addWorkDays(start, 5).getTime(),
    'addWorkDaysChecked.date ≠ addWorkDays',
  );
});

test('normale CPM-solve: byte-identieke datums en géén cappedTaskIds', () => {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: CLEAN_WORKDAYS, holidays: [] } as any);
  S().setProject({ startDate: '2026-06-01' });

  const aId = S().addTask({
    name: 'A', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 3),
  });
  const bId = S().addTask({
    name: 'B', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 2),
  });
  S().addSequence({ predecessorId: aId, successorId: bId, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();

  const cpm = S().cpmResult!;
  assert(!cpm.error, `onverwachte fout: ${cpm.error}`);
  const A = S().tasks.find(t => t.id === aId)!.time;
  const B = S().tasks.find(t => t.id === bId)!.time;
  assertEq(A.earlyStart, '2026-06-01T07:00', 'A.earlyStart');
  assertEq(A.earlyFinish, '2026-06-03T16:00', 'A.earlyFinish');
  assertEq(B.earlyStart, '2026-06-04T07:00', 'B.earlyStart');
  assertEq(B.earlyFinish, '2026-06-05T16:00', 'B.earlyFinish');
  const capped = (cpm as any).cappedTaskIds;
  assert(
    capped === undefined || capped.length === 0,
    `verwacht geen cappedTaskIds, kreeg ${JSON.stringify(capped)}`,
  );
});

test('solve met één onwerkbare taak: cappedTaskIds bevat precies die taak, rest normaal, geen error', () => {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: CLEAN_WORKDAYS, holidays: [] } as any);
  S().setProject({ startDate: '2026-06-01' });

  const { id: _cid, ...calBase } = S().calendar;
  void _cid;
  const blockCalId = S().addCalendar({
    ...calBase,
    name: 'Onwerkbaar',
    workDays: CLEAN_WORKDAYS,
    holidays: [{ name: 'meerjarig blok', startDate: '2026-06-01', endDate: '2035-01-01' }],
  });

  const aId = S().addTask({
    name: 'A', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 3),
  });
  const bId = S().addTask({
    name: 'B', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 2),
  });
  S().setTaskCalendar(bId, blockCalId);
  S().runCPM();

  const cpm = S().cpmResult!;
  assert(!cpm.error, `verwacht geen error, kreeg "${cpm.error}"`);
  const A = S().tasks.find(t => t.id === aId)!.time;
  assertEq(A.earlyStart, '2026-06-01T07:00', 'A.earlyStart');
  assertEq(A.earlyFinish, '2026-06-03T16:00', 'A.earlyFinish');
  const capped = (cpm as any).cappedTaskIds as string[] | undefined;
  assertEq(capped, [bId], 'cappedTaskIds');
});

await run();
