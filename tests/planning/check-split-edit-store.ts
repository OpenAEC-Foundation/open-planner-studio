import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import type { AppState } from '@/state/appStore';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { setGapLength, toSplitPieces, type SplitPiece } from '@/engine/scheduler/splitEdit';
import { contourDaySlots } from '@/engine/contour/contourEdit';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const BANDS = [{ start: 480, end: 960 }];
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
const BAND_CAL: WorkCalendar = {
  id: 'cal-banden', name: 'banden', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};

function freshStore(calendar?: WorkCalendar): {
  S: () => AppState;
  patchTask: (taskId: string, patch: (task: Task) => void) => void;
} {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (calendar) S().setCalendar(calendar);
  return {
    S,
    patchTask: (taskId, patch) => ctx.store.setState((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (task) patch(task);
    }),
  };
}

console.log('-- split-edit-store: solver-fix dag-taak op bandenkalender (T5) --');
{
  const { S } = freshStore(BAND_CAL);
  const id = S().addTask({
    name: 'Gesplitste dagtaak',
    time: createDefaultTaskTime('2026-06-01', 4),
    splitGaps: [{ afterMinutes: 960, gapMinutes: 960, source: 'user' }],
  });
  S().runCPM();
  const t = S().tasks.find(x => x.id === id)!;
  eq('T5 earlyStart blijft de projectstart', t.time.earlyStart, '2026-06-01T08:00');
  eq('T5 earlyFinish telt de pauzedagen mee (4 werk + 2 pauze)', t.time.earlyFinish, '2026-06-08T16:00');
  eq('T5 lateStart spiegelt de gaten-bewuste duur', t.time.lateStart, t.time.earlyStart);
  eq('T5 lateFinish spiegelt de gaten-bewuste duur', t.time.lateFinish, t.time.earlyFinish);
  eq('T5 enige taak ⇒ geen speling', t.time.totalFloat, 0);

  const { S: S2 } = freshStore(BAND_CAL);
  const plainId = S2().addTask({
    name: 'Gatloze dagtaak',
    time: createDefaultTaskTime('2026-06-01', 4),
  });
  S2().runCPM();
  eq('T5 gatloze taak ongewijzigd', S2().tasks.find(x => x.id === plainId)!.time.earlyFinish, '2026-06-04T16:00');
  ok('T5 gatloze taak houdt een lege gatenlijst', S2().tasks.find(x => x.id === plainId)!.splitGaps === undefined);
}

const work = (minutes: number): SplitPiece => ({ kind: 'work', minutes });
const gap = (minutes: number): SplitPiece => ({ kind: 'gap', minutes, source: 'user' });

console.log('-- split-edit-store: setTaskSplits, undo/redo en scheduleFinish (T6.1) --');
{
  const { S } = freshStore();
  const id = S().addTask({ name: 'Tien dagen', time: createDefaultTaskTime('2026-06-01', 10) });
  S().runCPM();
  const finishBefore = S().tasks.find(t => t.id === id)!.time.scheduleFinish;

  const refusal = S().setTaskSplits(id, [work(2400), gap(2400), work(2400)]);
  eq('T6.1 geen weigering', refusal, null);
  const t = S().tasks.find(x => x.id === id)!;
  eq('T6.1 gaten op de H1-as', t.splitGaps, [{ afterMinutes: 2400, gapMinutes: 2400, source: 'user' }]);
  eq('T6.1 duur ongewijzigd (alleen een pauze erbij)', t.time.scheduleDuration, 10);
  ok('T6.1 isDirty', S().isDirty);
  ok('T6.1 scheduleStale', S().scheduleStale);
  eq('T6.1 eigen scheduleFinish groeit mee', t.time.scheduleFinish, "2026-06-19T16:00");
  eq('T6.1 ook earlyFinish, want dáár tekent de renderer de balk uit', t.time.earlyFinish, "2026-06-19T16:00");

  S().undo();
  const undone = S().tasks.find(x => x.id === id)!;
  eq('T6.1 undo herstelt de gaten', undone.splitGaps, undefined);
  eq('T6.1 undo herstelt de finish', undone.time.scheduleFinish, finishBefore);
  S().redo();
  eq('T6.1 redo zet de split terug',
    S().tasks.find(x => x.id === id)!.splitGaps, [{ afterMinutes: 2400, gapMinutes: 2400, source: 'user' }]);
}

console.log('-- split-edit-store: coalesceKey (T6.2) --');
{
  const { S } = freshStore();
  const id = S().addTask({ name: 'Sleepgebaar', time: createDefaultTaskTime('2026-06-01', 10) });
  const depth0 = historyDepthsForActiveScope(S()).undoDepth;
  S().setTaskSplits(id, [work(2400), gap(480), work(2400)], { coalesceKey: `split-${id}` });
  S().setTaskSplits(id, [work(2400), gap(1440), work(2400)], { coalesceKey: `split-${id}` });
  eq('T6.2 twee commits met dezelfde sleutel = één undo-stap',
    historyDepthsForActiveScope(S()).undoDepth, depth0 + 1);
  eq('T6.2 de laatste waarde staat er',
    S().tasks.find(x => x.id === id)!.splitGaps, [{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }]);
  S().undo();
  eq('T6.2 één undo brengt de hele sleep terug', S().tasks.find(x => x.id === id)!.splitGaps, undefined);
}

console.log('-- split-edit-store: werkduur verandert mee (T6.3) --');
{
  const { S } = freshStore();
  const id = S().addTask({ name: 'Stuk korter', time: createDefaultTaskTime('2026-06-01', 10) });
  S().setTaskSplits(id, [work(1440), gap(480), work(2400)]);
  eq('T6.3 duur volgt de stukken', S().tasks.find(x => x.id === id)!.time.scheduleDuration, 8);
}

console.log('-- split-edit-store: adoptieregel (T6.4) --');
{
  const { S } = freshStore();
  const id = S().addTask({
    name: 'Genivelleerd',
    time: createDefaultTaskTime('2026-06-01', 10),
    splitGaps: [{ afterMinutes: 960, gapMinutes: 480, source: 'leveling' }],
  });
  const pieces = toSplitPieces(S().tasks.find(x => x.id === id)!.splitGaps, 4800)!;
  const edited = setGapLength(pieces, 0, 960, 480);
  ok('T6.4 bewerking geslaagd', edited.ok);
  S().setTaskSplits(id, edited.ok ? edited.pieces : null);
  eq('T6.4 geen enkel gat draagt nog "leveling"',
    (S().tasks.find(x => x.id === id)!.splitGaps ?? []).map(g => g.source), ['user']);
}

console.log('-- split-edit-store: Z8-venster losgelaten + melding + EF beweegt mee (T6.5) --');
{
  __resetTimephasedLossNoticeForTests();
  const { S, patchTask } = freshStore(BAND_CAL);
  const id = S().addTask({ name: 'MSP-gestuurd', time: createDefaultTaskTime('2026-06-01', 10) });
  patchTask(id, (task) => { task.timephasedFinishFloor = '2026-06-17T16:00'; });
  S().runCPM();
  const efBefore = S().tasks.find(x => x.id === id)!.time.earlyFinish;
  eq('T6.5 vóór de split stuurt het venster de finish', efBefore, '2026-06-17T16:00');

  S().setTaskSplits(id, [work(2400), gap(2400), work(2400)]);
  const t = S().tasks.find(x => x.id === id)!;
  eq('T6.5 het venster is losgelaten', t.timephasedFinishFloor, undefined);
  eq('T6.5 precies één timephased-verliesmelding',
    S().ui.notifications.filter(n => n.messageKey === 'notifications.mppTimephasedSteeringLost').length, 1);

  S().runCPM();
  const efAfter = S().tasks.find(x => x.id === id)!.time.earlyFinish;
  ok(`T6.5 earlyFinish beweegt mee (${efBefore} → ${efAfter})`, efAfter > efBefore);
}

console.log('-- split-edit-store: contour verhuist mee, geen dubbele schaling (T6.6) --');
{
  const { S, patchTask } = freshStore();
  const id = S().addTask({ name: 'Gecontourd', time: createDefaultTaskTime('2026-06-01', 4) });
  patchTask(id, (task) => {
    task.timephasedContours = [{
      resourceUid: null,
      periods: [0, 480, 960, 1440].map(afterMinutes => (
        { afterMinutes, minutes: 480, workMinutes: 480, kind: 'remaining' as const }
      )),
    }];
  });
  const before = contourDaySlots(S().tasks.find(x => x.id === id)!.timephasedContours![0].periods,
    S().tasks.find(x => x.id === id)!.splitGaps, 480).remaining;
  eq('T6.6 vertrekpunt: vier volle werkdagen', before, [480, 480, 480, 480]);

  S().setTaskSplits(id, [work(960), gap(480), work(960)]);
  const t = S().tasks.find(x => x.id === id)!;
  const after = contourDaySlots(t.timephasedContours![0].periods, t.splitGaps, 480).remaining;
  eq('T6.6 werk per WERKdag ongewijzigd', after, before);
  eq('T6.6 en de som blijft gelijk', after.reduce((a, b) => a + b, 0), before.reduce((a, b) => a + b, 0));
  eq('T6.6 de duur is niet stilletjes veranderd', t.time.scheduleDuration, 4);
}

console.log('-- split-edit-store: contour + duurwijziging op een taak die al een gat had (T6.6b) --');
{
  const { S, patchTask } = freshStore();
  const id = S().addTask({
    name: 'Contour én gat',
    time: createDefaultTaskTime('2026-06-01', 6),
    splitGaps: [{ afterMinutes: 960, gapMinutes: 480, source: 'user' }],
  });
  patchTask(id, (task) => {
    task.timephasedContours = [{
      resourceUid: null,
      periods: [0, 480, 1440, 1920, 2400, 2880].map(afterMinutes => (
        { afterMinutes, minutes: 480, workMinutes: 480, kind: 'remaining' as const }
      )),
    }];
  });
  S().setTaskSplits(id, [work(960), gap(480), work(1440)]);
  const t = S().tasks.find(x => x.id === id)!;
  eq('T6.6b het gat staat waar het stukkenmodel het zette',
    t.splitGaps, [{ afterMinutes: 960, gapMinutes: 480, source: 'user' }]);
  eq('T6.6b de duur volgt de stukken', t.time.scheduleDuration, 5);
  const slots = contourDaySlots(t.timephasedContours![0].periods, t.splitGaps, 480).remaining;
  eq('T6.6b vijf werkdagen in het profiel', slots.length, 5);
  eq('T6.6b en het totale werk is meegeschaald naar de nieuwe duur',
    Math.round(slots.reduce((a, b) => a + b, 0)), 2400);
}

console.log('-- split-edit-store: weigeringen (T6.7) en "alles opheffen" (T6.8) --');
{
  const { S } = freshStore();
  const msId = S().addTask({ name: 'Mijlpaal', isMilestone: true, time: createDefaultTaskTime('2026-06-01', 0) });
  const beyondId = S().addTask({
    name: 'Niet-bewerkbare importsplit',
    time: createDefaultTaskTime('2026-06-01', 2),
    splitGaps: [{ afterMinutes: 1440, gapMinutes: 5760 }],
  });
  const tasksRef = S().tasks;
  const depth0 = historyDepthsForActiveScope(S()).undoDepth;

  eq('T6.7 mijlpaal geweigerd', S().setTaskSplits(msId, [work(240), gap(480), work(240)]), 'milestone');
  eq('T6.7 niet-wélgevormde importsplit geweigerd',
    S().setTaskSplits(beyondId, [work(480), gap(480), work(480)]), 'not-editable');
  ok('T6.7 de takenlijst is referentieel ongewijzigd', S().tasks === tasksRef);
  eq('T6.7 geen enkele undo-stap geschreven', historyDepthsForActiveScope(S()).undoDepth, depth0);

  eq('T6.8 "alle onderbrekingen opheffen" mag wél', S().setTaskSplits(beyondId, null), null);
  eq('T6.8 en de gaten zijn weg', S().tasks.find(x => x.id === beyondId)!.splitGaps, undefined);
  eq('T6.8 als één herkenbare undo-stap', historyDepthsForActiveScope(S()).undoDepth, depth0 + 1);
}

console.log('-- split-edit-store: updateTask klipt een gebruikersgat bij duurkrimp (T6.9) --');
{
  const { S } = freshStore();
  const id = S().addTask({
    name: 'Krimpt',
    time: createDefaultTaskTime('2026-06-01', 10),
    splitGaps: [{ afterMinutes: 2400, gapMinutes: 480, source: 'user' }],
  });
  S().updateTask(id, { time: { ...S().tasks.find(x => x.id === id)!.time, scheduleDuration: 3 } });
  eq('T6.9 het gat ligt voorbij het nieuwe werktotaal en vervalt',
    S().tasks.find(x => x.id === id)!.splitGaps, undefined);
}

console.log('-- split-edit-store: opgeschoven opvolger houdt zijn balk op earlyStart (#171) --');
{
  const { S } = freshStore();
  const pred = S().addTask({ name: 'Voorganger', time: createDefaultTaskTime('2026-06-01', 10) });
  const succ = S().addTask({ name: 'Opvolger', time: createDefaultTaskTime('2026-06-01', 10) });
  S().addSequence({ predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const before = S().tasks.find(x => x.id === succ)!;
  eq('#171 het anker blijft op de projectstart', before.time.scheduleStart, "2026-06-01T07:00");
  eq('#171 de balk begint na de voorganger', before.time.earlyStart, "2026-06-15T07:00");
  const refusal = S().setTaskSplits(succ, [
    { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 480, source: 'user' }, { kind: 'work', minutes: 2400 },
  ] as SplitPiece[]);
  eq('#171 split geaccepteerd', refusal, null);
  const after = S().tasks.find(x => x.id === succ)!;
  eq('#171 voorlopig einde telt vanaf de balkstart', after.time.earlyFinish, "2026-06-29T16:00");
  eq('#171 het ankereinde blijft bij het anker', after.time.scheduleFinish, "2026-06-15T16:00");
  S().runCPM();
  eq('#171 de herberekening bevestigt hetzelfde einde', S().tasks.find(x => x.id === succ)!.time.earlyFinish, "2026-06-29T16:00");
}

if (diffs.length === 0) { console.log(`OK  split-edit-store: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit-store: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
