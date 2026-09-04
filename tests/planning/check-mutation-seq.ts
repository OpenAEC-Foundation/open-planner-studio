// check-mutation-seq.ts — B1c-plan3 taak 4 (spec §6a). De teller is MONOTOON en beweegt bij ELKE
// undoable mutatie, óók binnen een coalesce-reeks — dat is precies waar de sessiehistorie zelf
// tekortschiet: een gecoalesceerde reeks schrijft alleen het `after` van een BESTAAND event bij, en
// `pruneSessionHistory` trimt van onderaf. Plus: de voorstel-vingerafdruk (`documentFingerprint`).
//
// AANGEPAST NA MERGE MET MAIN (sessiehistorie, 2026-09-04): geschreven tegen `beginUndoable`/
// `finishUndoable` + `historyEvents` in plaats van tegen de verdwenen per-document `undoStack`.
//
// `createStoreRuntime()` is state-loos qua documentvelden (alle documentdata leeft in het
// meegegeven `AppState`-argument), dus deze test drijft hem met een minimale, met de hand gebouwde
// staat die precies de velden draagt die `createSnapshot`/`beginUndoable` aanraken — geen echte
// Zustand-store nodig.
//
// Draait via run.sh. Exit 0 = alles groen.
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

// Minimale documentstate: precies de velden die `createSnapshot` (via DOCUMENT_FIELDS) en
// `beginUndoable` lezen/schrijven. Cast naar AppState — de rest van de interface (acties) wordt
// door deze test nooit aangeroepen.
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

/** Eén echte, undoable mutatie: `beginUndoable` → iets veranderen → `finishUndoable`. Zonder die
 *  echte wijziging ziet `finishUndoable` een gelijke voor-/nastaat en legt hij bewust NIETS vast. */
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

  // Een gewone mutatie: één history-event ⇒ teller omhoog.
  mutate(rt, state, 'a');
  ok('gewone mutatie bumpt', rt.mutationSeq() > 0);
  eq('en legt één history-event vast', state.historyEvents.length, 1);

  // Een GECOALESCEERDE tweede mutatie levert GEEN tweede event (`finishUndoable` schrijft alleen het
  // `after` van het bestaande event bij) maar is wél een mutatie — de teller moet er dus wél op
  // bewegen. Dat is precies waarom de teller náást de historie bestaat.
  const before = rt.mutationSeq();
  const eventsBefore = state.historyEvents.length;
  mutate(rt, state, 'b', 'k');   // opent de coalesce-reeks: één nieuw event
  mutate(rt, state, 'c', 'k');   // coalesceert erin: GEEN nieuw event
  eq('coalesce levert geen tweede event', state.historyEvents.length, eventsBefore + 1);
  ok('maar de teller beweegt wél', rt.mutationSeq() > before + 1);

  // Een GENESTE `beginUndoable` (dezelfde draft, depth++) levert evenmin een eigen event, maar is
  // wél een mutatie.
  const nestedBefore = rt.mutationSeq();
  const nestedEventsBefore = state.historyEvents.length;
  rt.beginUndoable(state);
  rt.beginUndoable(state);
  state.tasks = [{ id: 'genest' } as unknown as AppState['tasks'][number]];
  rt.finishUndoable(state); // depth 2 → 1: nog niets vastleggen
  rt.finishUndoable(state);
  eq('nesting levert één event', state.historyEvents.length, nestedEventsBefore + 1);
  ok('en twee bumps', rt.mutationSeq() === nestedBefore + 2);

  // Pruning raakt de teller niet (dat is het hele punt van een aparte teller): de historie wordt op
  // MAX_UNDO per scope afgekapt, de teller loopt gewoon door.
  for (let i = 0; i < 150; i++) mutate(rt, state, `iter-${i}`);
  ok('historie is afgekapt op MAX_UNDO', state.historyEvents.length <= MAX_UNDO);
  ok('teller blijft monotoon voorbij MAX_UNDO', rt.mutationSeq() >= 150);

  // Twee contexten hebben ELK hun eigen teller (geen module-global).
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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  check-mutation-seq: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  check-mutation-seq: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
