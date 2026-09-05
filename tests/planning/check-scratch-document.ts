// check-scratch-document.ts — B1c-plan3 taak 5 (spec §5). Een slapende payload wordt in een eigen
// storecontext bewerkt, en die context laat GEEN sporen na in de app-globale registers.
//
// Draait via run.sh. Exit 0 = alles groen.
import { runInScratchDocument } from '@/state/runtime/scratchDocument';
import { createAppStoreContext, appStoreContext } from '@/state/appStore';
import { DOCUMENT_FIELDS, capturePayload, freshPayload, type DocumentPayload } from '@/state/documentContract';
import { createDefaultProject } from '@/state/defaults';
import { subscribeExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
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

// ═══════════════════════════════════════════════════════════════════════════
// Geval 1: de payload gaat er heel in en heel uit — een no-op-functie mag GEEN enkel documentveld
// veranderen. Loop over DOCUMENT_FIELDS in plaats van met de hand op te sommen: een toekomstig
// documentveld rijdt automatisch mee.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- scratch-document: geval 1, round-trip --');
{
  const payload = basePayload();
  const out = runInScratchDocument(payload, () => {});
  ok('geval 1: de run slaagt', out.ok);
  for (const f of DOCUMENT_FIELDS) {
    eq(`geval 1: round-trip ${f.key}`, (out.payload as unknown as Record<string, unknown>)[f.key], (payload as unknown as Record<string, unknown>)[f.key]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 2: de ECHTE actie draait — `applyLeveling` schrijft de delay op B, strijkt de M10-velden
// glad, zet `isDirty` en draait zelf `runCPM`, zodat de datums doorgerekend terugkomen.
//
// AANGEPAST NA MERGE MET MAIN (sessiehistorie, 2026-09-04). Hier stond "één undo-stap op de eigen
// stack van dat document": undo/redo was toen een `undoStack` PER document(payload). Dat model
// bestaat niet meer — undo/redo is één app-globale sessiechronologie (`AppState.historyEvents`), en
// die van een scratch-context wordt mét de context weggegooid. De opbrengst van deze functie is dus
// uitsluitend de nieuwe payload (+ de meldingen); het history-event registreert de AANROEPER zelf in
// de echte store (zie `librarySlice.applyDistribution`). Dat de payload per constructie géén historie
// kán dragen, pinnen we hieronder op het documentcontract zelf.
// ═══════════════════════════════════════════════════════════════════════════
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
  // De historie hóórt hier niet: `DOCUMENT_FIELDS` is de enige bron van wat een document draagt, en
  // de sessiechronologie staat daar bewust NIET in (hij is app-globaal). Zet iemand hem er alsnog
  // in, dan valt deze assert om — en de `f.key`-vergelijking hierboven zou zelfs al een COMPILE-fout
  // geven zolang hij er niet in staat, dus die kant is by construction al dicht.
  ok('geval 2: een payload draagt geen sessiehistorie',
    !('historyEvents' in (out.payload as unknown as Record<string, unknown>))
    && !('nextHistorySequence' in (out.payload as unknown as Record<string, unknown>)));
}

// ═══════════════════════════════════════════════════════════════════════════
// Geval 3: de extensie-emitter zwijgt in de scratch-context, maar niet in een gewone context — de
// app-globale bus (`subscribeExtensionEvent`) is hetzelfde kanaal in beide gevallen; alleen de
// context bepaalt of hij er iets op zet.
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// Geval 4: meldingen komen naar buiten in plaats van te verdwijnen. Een relatiecyclus laat `runCPM`
// zelf `notify({ messageKey: 'notifications.scheduleFailed', ... })` aanroepen (scheduleSlice.ts) —
// in de scratch-context rendert niemand `ui.notifications`, dus die melding moet bij de AANROEPER
// terugkomen. Structureel gedekt: `DocumentPayload` bevat `ui.notifications` sowieso niet (het zit
// niet in DOCUMENT_FIELDS behalve `collapsedTaskIds`), dus de teruggegeven payload kan de melding
// per constructie nooit dragen — alleen `notifications` in het resultaat kan hem tonen.
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// Geval 5: geen sporen in de app-globale registers — de gemounte productinterface (`appStoreContext`)
// blijft byte-identiek, want elke scratch-run bouwt zijn EIGEN, wegwerpbare context.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- scratch-document: geval 5, geen sporen in de app-store --');
{
  const appBefore = JSON.stringify(capturePayload(appStoreContext.store.getState()));
  runInScratchDocument(basePayload(), (s) => { s.applyLeveling({ delays: { B: 1 }, gaps: {} }); });
  const appAfter = JSON.stringify(capturePayload(appStoreContext.store.getState()));
  eq('geval 5: de app-store is onaangeraakt', appAfter, appBefore);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  scratch-document: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  scratch-document: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
