// WP7 "Onwerkbaar-venster-detectie" (taak T5): `addWorkDays` levert op de MAX_SCAN-cap-paden nu een
// EXPLICIET `capped`-signaal (via `addWorkDaysChecked`), en de CPM-solver aggregeert de gecapte
// taak-ids als ZACHTE waarschuwing in `cpmResult.cappedTaskIds` — géén error, géén rollback.
//
// Drie eisen (spec §WP7 + T5-brief):
//  1. Kalender mét werkdagen maar een aaneengesloten holiday-blok >366 dagen ⇒ addWorkDaysChecked
//     meldt `capped: true`.
//  2. Normale kalender ⇒ geen capped-signaal én byte-identieke datums (harde datum-asserties + geen
//     `cappedTaskIds` op het resultaat).
//  3. Een solve waarin één taak in een onwerkbaar venster valt ⇒ `cpmResult.cappedTaskIds` bevat
//     precies díe taak; de overige taken normaal doorgerekend; `cpmResult.error` blijft leeg/false.
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

// ── Eis 1: engine-signaal bij een onwerkbaar venster ──────────────────────────────────────────────
test('addWorkDaysChecked meldt capped bij een holiday-blok >366 dagen vanaf de startdatum', () => {
  // Werkweek ma-vr, maar een aaneengesloten feestdagblok van ~575 dagen vanaf de startdatum: elke
  // werkdag-scan botst tegen de MAX_SCAN(366)-grens ⇒ het venster is onwerkbaar.
  const eng = new CalendarEngine(
    makeCal({ holidays: [{ name: 'blok', startDate: '2026-06-01', endDate: '2027-12-31' }] }),
  );
  const res = eng.addWorkDaysChecked(parseDate('2026-06-01'), 5);
  assert(res.capped === true, `verwacht capped=true, kreeg ${JSON.stringify(res)}`);
});

test('addWorkDaysChecked meldt NIET capped op een normale kalender (+ byte-identiek aan addWorkDays)', () => {
  const eng = new CalendarEngine(makeCal({}));
  const start = parseDate('2026-06-01'); // maandag
  const res = eng.addWorkDaysChecked(start, 5);
  assert(res.capped === false, `verwacht capped=false, kreeg ${JSON.stringify(res)}`);
  // 5 werkdagen vanaf ma 06-01 ⇒ laatste werkdag = vr 06-05 (begindag telt als dag 1).
  assertEq(res.date.toISOString().slice(0, 10), '2026-06-05', 'addWorkDaysChecked-datum');
  // Byte-identiek met de bestaande `addWorkDays`-Date-retour.
  assertEq(
    res.date.getTime(), eng.addWorkDays(start, 5).getTime(),
    'addWorkDaysChecked.date ≠ addWorkDays',
  );
});

// ── Eis 2: normale CPM-solve ⇒ geen signaal + byte-identieke datums ────────────────────────────────
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
  // A: ma 06-01 .. wo 06-03 (dur 3). B (FS na A): do 06-04 .. vr 06-05 (dur 2).
  assertEq(A.earlyStart, '2026-06-01T07:00', 'A.earlyStart');
  assertEq(A.earlyFinish, '2026-06-03T16:00', 'A.earlyFinish');
  assertEq(B.earlyStart, '2026-06-04T07:00', 'B.earlyStart');
  assertEq(B.earlyFinish, '2026-06-05T16:00', 'B.earlyFinish');
  // Geen onwerkbaar venster ⇒ geen capped-lijst (byte-identiek resultaat: veld blijft ongezet/leeg).
  const capped = (cpm as any).cappedTaskIds;
  assert(
    capped === undefined || capped.length === 0,
    `verwacht geen cappedTaskIds, kreeg ${JSON.stringify(capped)}`,
  );
});

// ── Eis 3: één taak in een onwerkbaar venster ⇒ zachte waarschuwing, rest normaal ──────────────────
test('solve met één onwerkbare taak: cappedTaskIds bevat precies die taak, rest normaal, geen error', () => {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: CLEAN_WORKDAYS, holidays: [] } as any);
  S().setProject({ startDate: '2026-06-01' });

  // Bibliotheek-kalender met een enorm feestdagblok (jaren) ⇒ de werkdag-scans van de solver botsen
  // herhaald tegen MAX_SCAN; de taak wordt onwerkbaar. Werkweek blijft ma-vr (hasWorkingDays=true, dus
  // GEEN harde `error` — juist het zachte capped-pad).
  const { id: _cid, ...calBase } = S().calendar;
  void _cid;
  const blockCalId = S().addCalendar({
    ...calBase,
    name: 'Onwerkbaar',
    workDays: CLEAN_WORKDAYS,
    holidays: [{ name: 'meerjarig blok', startDate: '2026-06-01', endDate: '2035-01-01' }],
  });

  // A op de schone projectkalender (normaal), B op de onwerkbare kalender.
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
  // Zacht: geen error, geen rollback.
  assert(!cpm.error, `verwacht geen error, kreeg "${cpm.error}"`);
  // A (schone kalender) is gewoon normaal doorgerekend.
  const A = S().tasks.find(t => t.id === aId)!.time;
  assertEq(A.earlyStart, '2026-06-01T07:00', 'A.earlyStart');
  assertEq(A.earlyFinish, '2026-06-03T16:00', 'A.earlyFinish');
  // Precies B zit in de capped-lijst.
  const capped = (cpm as any).cappedTaskIds as string[] | undefined;
  assertEq(capped, [bId], 'cappedTaskIds');
});

await run();
