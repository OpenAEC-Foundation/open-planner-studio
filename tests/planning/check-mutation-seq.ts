import { createStoreRuntime, MAX_UNDO } from '@/state/runtime/storeRuntime';
import { documentFingerprint, type FingerprintInput } from '@/services/library/proposalFingerprint';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { AppState } from '@/state/appStore';

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

function fakeState(docId = 'doc-fake'): AppState {
  return {
    project: createDefaultProject(),
    calendar: createDefaultCalendar(),
    tasks: [], sequences: [], resources: [], assignments: [], calendars: [],
    activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [],
    cpmResult: null, resourceLoadResult: null, scheduleStale: false,
    baselines: [], activeBaselineId: null, recordedDates: null, datesAsRecorded: false,
    historyEvents: [], nextHistorySequence: 1, activeDocumentId: docId, isDirty: false,
  } as unknown as AppState;
}

function mutate(rt: ReturnType<typeof createStoreRuntime>, state: AppState, id: string,
                coalesceKey?: string): void {
  rt.beginUndoable(state, coalesceKey ? { coalesceKey } : undefined);
  state.tasks = [{ id } as unknown as AppState['tasks'][number]];
  rt.finishUndoable(state);
}

console.log('-- check-mutation-seq: de monotone teller --');
{
  const rt = createStoreRuntime();
  const state = fakeState();
  eq('start op 0', rt.mutationSeq(), 0);

  mutate(rt, state, 'a');
  ok('gewone mutatie bumpt', rt.mutationSeq() > 0);
  eq('en legt één history-event vast', state.historyEvents.length, 1);

  const before = rt.mutationSeq();
  const eventsBefore = state.historyEvents.length;
  mutate(rt, state, 'b', 'k');
  mutate(rt, state, 'c', 'k');
  eq('coalesce levert geen tweede event', state.historyEvents.length, eventsBefore + 1);
  ok('maar de teller beweegt wél', rt.mutationSeq() > before + 1);

  const nestedBefore = rt.mutationSeq();
  const nestedEventsBefore = state.historyEvents.length;
  rt.beginUndoable(state);
  rt.beginUndoable(state);
  state.tasks = [{ id: 'genest' } as unknown as AppState['tasks'][number]];
  rt.finishUndoable(state);
  rt.finishUndoable(state);
  eq('nesting levert één event', state.historyEvents.length, nestedEventsBefore + 1);
  ok('en twee bumps', rt.mutationSeq() === nestedBefore + 2);

  for (let i = 0; i < 150; i++) mutate(rt, state, `iter-${i}`);
  ok('historie is afgekapt op MAX_UNDO', state.historyEvents.length <= MAX_UNDO);
  ok('teller blijft monotoon voorbij MAX_UNDO', rt.mutationSeq() >= 150);

  const rt2 = createStoreRuntime();
  ok('per context', rt2.mutationSeq() === 0 && rt.mutationSeq() > 0);
}

console.log('-- check-mutation-seq: de vingerafdruk --');
{
  const tasksA: unknown[] = [];
  const inputA: FingerprintInput = {
    tasks: tasksA, sequences: [], resources: [], assignments: [], calendar: {}, calendars: [],
    project: {}, cpmResult: null, scheduleStale: false, datesAsRecorded: false,
  };
  const fpA = documentFingerprint(inputA, 5);
  const fpB = documentFingerprint(inputA, 5);
  ok('zelfde referenties ⇒ zelfde vingerafdruk', fpA === fpB);

  const inputC: FingerprintInput = { ...inputA, tasks: [] };
  const fpC = documentFingerprint(inputC, 5);
  ok('nieuwe tasks-referentie ⇒ andere vingerafdruk', fpA !== fpC);

  const fpD = documentFingerprint(inputA, 6);
  ok('andere mutationSeq ⇒ andere vingerafdruk', fpA !== fpD);

  const inputE: FingerprintInput = { ...inputA, scheduleStale: true };
  const fpE = documentFingerprint(inputE, 5);
  ok('primitief veld telt ook mee (scheduleStale)', fpA !== fpE);
}

if (diffs.length === 0) {
  console.log(`OK  check-mutation-seq: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  check-mutation-seq: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
