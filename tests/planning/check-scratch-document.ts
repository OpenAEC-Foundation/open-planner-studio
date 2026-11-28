import { runInScratchDocument } from '@/state/runtime/scratchDocument';
import { createAppStoreContext, appStoreContext } from '@/state/appStore';
import { DOCUMENT_FIELDS, capturePayload, freshPayload, type DocumentPayload } from '@/state/documentContract';
import { createDefaultProject } from '@/state/defaults';
import { subscribeExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import {
  claimLevelingDelayRoundedNotice, __resetTimephasedLossNoticeForTests,
} from '@/state/timephasedLossNotice';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const diffs: string[] = [];
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

const PROJECT_CAL: WorkCalendar = {
  id: 'cal-default', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
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

function basePayload(): DocumentPayload {
  const taskA = task('A', '2026-06-01', '2026-06-03', 3);
  const taskB = task('B', '2026-06-01', '2026-06-03', 3);
  return {
    ...freshPayload(),
    project: { ...createDefaultProject(), name: 'Scratch', startDate: '2026-06-01', calendarId: 'cal-default' },
    calendar: PROJECT_CAL,
    calendars: [PROJECT_CAL],
    tasks: [taskA, taskB],
  };
}

console.log('-- scratch-document: geval 1, round-trip --');
{
  const payload = basePayload();
  const out = runInScratchDocument(payload, () => {});
  ok('geval 1: de run slaagt', out.ok);
  for (const f of DOCUMENT_FIELDS) {
    eq(`geval 1: round-trip ${f.key}`, (out.payload as unknown as Record<string, unknown>)[f.key], (payload as unknown as Record<string, unknown>)[f.key]);
  }
}

console.log('-- scratch-document: geval 2, echte acties --');
{
  const payload = basePayload();
  const beforeStart = payload.tasks.find(t => t.id === 'B')!.time.earlyStart;
  const out = runInScratchDocument(payload, (s) => {
    s.applyLeveling({ delays: { B: 2 }, gaps: {} });
  });
  ok('geval 2: de run slaagt', out.ok);
  eq('geval 2: de delay is geschreven', out.payload.tasks.find(t => t.id === 'B')!.levelingDelay, 2);
  eq('geval 2: doorgerekend (scheduleStale false)', out.payload.scheduleStale, false);
  ok('geval 2: er is een verse cpmResult', out.payload.cpmResult !== null);
  eq('geval 2: en het document staat als gewijzigd', out.payload.isDirty, true);
  ok('geval 2: nieuwe datums geschreven', out.payload.tasks.find(t => t.id === 'B')!.time.earlyStart !== beforeStart);
  ok('geval 2: een payload draagt geen sessiehistorie',
    !('historyEvents' in (out.payload as unknown as Record<string, unknown>))
    && !('nextHistorySequence' in (out.payload as unknown as Record<string, unknown>)));
}

console.log('-- scratch-document: geval 3, de extensie-emitter zwijgt --');
{
  const seen: unknown[] = [];
  const unsub = subscribeExtensionEvent(HOST_EVENTS.scheduleCalculated, (data) => seen.push(data));
  const payload = basePayload();
  runInScratchDocument(payload, (s) => { s.runCPM(); });
  eq('geval 3: scratch-run vuurt geen extensie-event', seen.length, 0);

  const seenNormal: unknown[] = [];
  const unsubNormal = subscribeExtensionEvent(HOST_EVENTS.scheduleCalculated, (data) => seenNormal.push(data));
  const normalCtx = createAppStoreContext();
  normalCtx.store.setState((s) => {
    s.project = payload.project;
    s.calendar = payload.calendar;
    s.calendars = payload.calendars;
    s.tasks = payload.tasks;
  });
  normalCtx.store.getState().runCPM();
  ok('geval 3: een gewone context vuurt dat wél', seenNormal.length > 0);

  unsub();
  unsubNormal();
}

console.log('-- scratch-document: geval 4, meldingen bubbelen op --');
{
  const taskC1 = task('C1', '2026-06-01', '2026-06-02', 1);
  const taskC2 = task('C2', '2026-06-01', '2026-06-02', 1);
  const payload: DocumentPayload = {
    ...basePayload(),
    tasks: [taskC1, taskC2],
    sequences: [
      { id: 'seq-1', predecessorId: 'C1', successorId: 'C2', type: 'FINISH_START', lagDays: 0 },
      { id: 'seq-2', predecessorId: 'C2', successorId: 'C1', type: 'FINISH_START', lagDays: 0 },
    ],
  };
  const out = runInScratchDocument(payload, (s) => { s.runCPM(); });
  ok('geval 4: de run slaagt (notify gooit niet)', out.ok);
  ok('geval 4: fouten uit de scratch-run bubbelen op',
    out.notifications.some(n => n.messageKey === 'notifications.scheduleFailed'));
}

console.log('-- scratch-document: geval 5, geen sporen in de app-store --');
{
  const appBefore = JSON.stringify(capturePayload(appStoreContext.store.getState()));
  runInScratchDocument(basePayload(), (s) => { s.applyLeveling({ delays: { B: 1 }, gaps: {} }); });
  const appAfter = JSON.stringify(capturePayload(appStoreContext.store.getState()));
  eq('geval 5: de app-store is onaangeraakt', appAfter, appBefore);
}

console.log('-- scratch-document: geval 5b, de sessie-gates van de app blijven vrij --');
{
  __resetTimephasedLossNoticeForTests();
  const appDocId = appStoreContext.store.getState().activeDocumentId;
  const scratchPayload: DocumentPayload = {
    ...basePayload(),
    tasks: [task('A', '2026-06-01', '2026-06-03', 3), task('B', '2026-06-01', '2026-06-03', 3, { levelingDelayMinutes: 120 })],
  };
  let scratchDocId = '';
  const out = runInScratchDocument(scratchPayload, (s) => {
    scratchDocId = s.activeDocumentId;
    s.applyLeveling({ delays: { B: 1 }, gaps: {} });
  });
  ok('geval 5b: de run slaagt', out.ok);
  ok('geval 5b: de M10-melding is in de scratch daadwerkelijk gezet (anders bewijst deze case niets)',
    out.notifications.some(n => n.messageKey === 'notifications.levelingDelayRoundedToWorkdays'));
  ok('geval 5b: de scratch-context draait onder een EIGEN document-id', scratchDocId !== '' && scratchDocId !== appDocId);
  ok('geval 5b: de M10-gate van het app-document is nog vrij', claimLevelingDelayRoundedNotice(appDocId));

  __resetTimephasedLossNoticeForTests();
  const realDocId = 'doc-echt-slapend';
  runInScratchDocument(scratchPayload, (s) => { s.applyLeveling({ delays: { B: 1 }, gaps: {} }); }, realDocId);
  eq('geval 5b: de gate van het meegegeven docId is geclaimd', claimLevelingDelayRoundedNotice(realDocId), false);
  ok('geval 5b: en die van het app-document nog steeds niet', claimLevelingDelayRoundedNotice(appDocId));
  __resetTimephasedLossNoticeForTests();
}

if (diffs.length === 0) {
  console.log(`OK  scratch-document: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  scratch-document: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
