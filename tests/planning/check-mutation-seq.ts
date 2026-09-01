// check-mutation-seq.ts — B1c-plan3 taak 4 (spec §6a). De teller is MONOTOON en beweegt bij ELKE
// undoable mutatie, óók binnen een coalesce-reeks — dat is precies waar `undoStack.length` en het
// interne undo-volgnummer tekortschieten. Plus: de voorstel-vingerafdruk (`documentFingerprint`).
//
// `createStoreRuntime()` is state-loos qua documentvelden (alle documentdata leeft in het
// meegegeven `AppState`-argument), dus deze test drijft hem met een minimale, met de hand gebouwde
// staat die precies de velden draagt die `createSnapshot`/`beginUndoable` aanraken — geen echte
// Zustand-store nodig.
//
// Draait via run.sh. Exit 0 = alles groen.
import { createStoreRuntime } from '@/state/runtime/storeRuntime';
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
    undoStack: [], redoStack: [], activeDocumentId: docId,
  } as unknown as AppState;
}

console.log('-- check-mutation-seq: de monotone teller --');
{
  const rt = createStoreRuntime();
  const state = fakeState();
  eq('start op 0', rt.mutationSeq(), 0);

  // Een gewone mutatie: snapshot gepusht ⇒ teller omhoog.
  rt.beginUndoable(state);
  ok('gewone mutatie bumpt', rt.mutationSeq() > 0);

  // Een GECOALESCEERDE tweede mutatie pusht GEEN snapshot (undoStack groeit niet) maar is wél een
  // mutatie — de teller moet er dus wél op bewegen.
  const before = rt.mutationSeq();
  const depthBefore = state.undoStack.length;
  rt.beginUndoable(state, { coalesceKey: 'k' });
  rt.beginUndoable(state, { coalesceKey: 'k' });
  eq('coalesce pusht geen tweede snapshot', state.undoStack.length, depthBefore + 1);
  ok('maar de teller beweegt wél', rt.mutationSeq() > before + 1);

  // MAX_UNDO-trimming raakt de teller niet (dat is het hele punt van een aparte teller).
  for (let i = 0; i < 150; i++) rt.beginUndoable(state, { coalesceKey: `iter-${i}` });
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
