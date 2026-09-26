// Voortgang INVULLEN via de UI (`engine/progressEntry.ts`) — de besluiten van de eigenaar, per regel
// headless tegen de ECHTE store, via exact de functies die de UI-routes aanroepen:
//   - eigenschappenpaneel: `enterTaskProgress` (TaskPropertiesPanel.tsx);
//   - contextmenu: `contextMenuBulk.setProgress` (GanttCanvas/FullTaskGrid);
//   - taakraster: `runGridMutation(intents, { progressEntry })` (FullTaskGrid.tsx);
//   - "Taak bewerken": `draftWithProgress` + `createTaskDialogSave` (TaskDialog.tsx).
//
// Regel 1 (Z1): voortgang invullen zonder statusdatum ⇒ de statusdatum gaat op VANDAAG (zoals het
// statusdatumveld hem oplevert: datum zonder tijd), in dezelfde undo-stap, met één melding. Zonder
// statusdatum rekende de solver een lopende taak vooruit met haar restduur en achteruit met de volle
// duur: speling −1 en onterecht kritiek (audit/weergaven z1-voortgang-zonder-statusdatum.ts).
// De headless setters (`setTaskProgress` & co.) blijven het vangnet, zonder deze regel.
//
// De browserkant (echte klikken/toetsen) staat in tests/browser/progress-entry.spec.ts.
// Draait via run.sh. Exit 0 = alles groen.
import './domShim';
import { createAppStoreContext, useAppStore, type AppState, type AppStoreContext } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { createTaskDialogSave, draftWithProgress } from '@/state/taskDialogSave';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { displayDate } from '@/utils/displayDate';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

// "Vandaag" zoals de gebruiker hem in het statusdatumveld typt: de LOKALE kalenderdag, zonder tijd.
// Bewust hier los uitgeschreven (niet `localTodayIso` importeren): de check toetst die functie.
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
/** Kalenderdag `days` vóór vandaag (UTC-rekenwerk op de datumstring, tijdzone-onafhankelijk). */
function daysBeforeToday(days: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Het Z1-scenario: A (5 wd) → B (3 wd) FS, projectstart vier weken vóór vandaag, geen statusdatum.
 *  B's geplande start ligt dus vóór vandaag. */
function setup(S: () => AppState): { A: string; B: string; C: string } {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: daysBeforeToday(28), name: 'Z1' });
  const A = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as Task['time'] });
  const B = S().addTask({ name: 'B', time: { scheduleDuration: 3 } as Task['time'] });
  const C = S().addTask({ name: 'C', time: { scheduleDuration: 2 } as Task['time'] });
  S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return { A, B, C };
}

function fresh(): { ctx: AppStoreContext; S: () => AppState } {
  const ctx = createAppStoreContext();
  return { ctx, S: () => ctx.store.getState() };
}

const taskOf = (S: () => AppState, id: string) => S().tasks.find(t => t.id === id)!;
const undoDepth = (S: () => AppState) => historyDepthsForActiveScope(S()).undoDepth;
const todayNotices = (S: () => AppState) => S().ui.notifications.filter(n => n.messageKey === 'notifications.statusDateSetToday');
function cell(taskId: string, columnId: string, value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route: 'task-progress', value };
}

/** Referentie: dezelfde voortgang, maar de gebruiker zette de statusdatum eerst zelf op vandaag. */
function referenceB(): { es?: string; ef?: string; tf?: number } {
  const { S } = fresh();
  const { B } = setup(S);
  S().setStatusDate(TODAY);
  S().setTaskProgress(B, 0.5);
  S().runCPM();
  const b = taskOf(S, B).time;
  return { es: b.earlyStart, ef: b.earlyFinish, tf: b.totalFloat };
}
const REF = referenceB();

/** Wat elke UI-route na "B op 50 %" moet opleveren. */
function expectRule1(label: string, S: () => AppState, B: string, depthBefore: number): void {
  eq(`${label}: statusdatum = vandaag (datum zonder tijd)`, S().project.statusDate, TODAY);
  eq(`${label}: voortgang staat`, taskOf(S, B).time.completion, 0.5);
  eq(`${label}: één undo-stap`, undoDepth(S) - depthBefore, 1);
  const notices = todayNotices(S);
  eq(`${label}: één melding, met de datum in de notatie van de gebruiker`,
    notices.map(n => ({ count: n.count, date: n.params?.date })),
    [{ count: 1, date: displayDate(TODAY, S().ui.dateNotation) }]);
  S().runCPM();
  const b = taskOf(S, B).time;
  eq(`${label}: planning = met statusdatum vandaag (geen speling −1)`, { es: b.earlyStart, ef: b.earlyFinish, tf: b.totalFloat }, REF);
  S().undo();
  eq(`${label}: Ctrl+Z draait statusdatum én voortgang samen terug`,
    { statusDate: S().project.statusDate ?? null, completion: taskOf(S, B).time.completion }, { statusDate: null, completion: 0 });
}

// ── 1. Regel 1 per UI-route ──────────────────────────────────────────────────────────────────────
{
  const { S } = fresh();
  const { B } = setup(S);
  const d0 = undoDepth(S);
  const res = S().enterTaskProgress(B, { field: 'completion', value: 0.5 }, { today: TODAY });
  eq('1a paneel (%): geaccepteerd', res, { ok: true });
  expectRule1('1a paneel (%)', S, B, d0);
}
{
  const { S } = fresh();
  const { B } = setup(S);
  const d0 = undoDepth(S);
  const as = daysBeforeToday(3);
  eq('1b paneel (werkelijke start): geaccepteerd',
    S().enterTaskProgress(B, { field: 'actualStart', value: as }, { today: TODAY }), { ok: true });
  eq('1b paneel (werkelijke start): statusdatum = vandaag', S().project.statusDate, TODAY);
  eq('1b paneel (werkelijke start): start staat, één undo-stap',
    { as: taskOf(S, B).time.actualStart, steps: undoDepth(S) - d0 }, { as, steps: 1 });
}
{
  const S = () => useAppStore.getState();
  const { A, B, C } = setup(S);
  S().selectTask(B, false);
  S().selectTask(C, true);
  const d0 = undoDepth(S);
  contextMenuBulk.setProgress(B, 0.5);
  eq('1c contextmenu (selectie B+C): beide 50 %, A niet', [A, B, C].map(id => taskOf(S, id).time.completion), [0, 0.5, 0.5]);
  expectRule1('1c contextmenu', S, B, d0);
}
{
  const { S } = fresh();
  const { B } = setup(S);
  const d0 = undoDepth(S);
  const res = S().runGridMutation([cell(B, 'task.time.completion', 0.5)], { progressEntry: { today: TODAY } });
  eq('1d taakraster: geaccepteerd', res.ok, true);
  expectRule1('1d taakraster', S, B, d0);
}
{
  const { ctx, S } = fresh();
  const { B } = setup(S);
  const d0 = undoDepth(S);
  const t = taskOf(S, B);
  // De dialoog rekent de concepttaak zonder statusdatum met vandaag (TaskDialog.tsx).
  const draft = draftWithProgress({ ...t, time: { ...t.time } }, 0.5, TODAY);
  createTaskDialogSave(ctx)({
    editingTaskId: B, draft, startDate: t.time.earlyStart || t.time.scheduleStart, today: TODAY,
  });
  expectRule1('1e Taak bewerken', S, B, d0);
}

// ── 2. Wat NIET verandert ────────────────────────────────────────────────────────────────────────
{
  // Geen voortgang over (0 %) ⇒ geen statusdatum en geen melding. (De eerste 0 % legt op een verse
  // taak de restduur vast — het bestaande vangnetgedrag; daarna is 0 % een echte no-op.)
  const { S } = fresh();
  const { B } = setup(S);
  S().enterTaskProgress(B, { field: 'completion', value: 0 }, { today: TODAY });
  const d0 = undoDepth(S);
  S().enterTaskProgress(B, { field: 'completion', value: 0 }, { today: TODAY });
  S().runGridMutation([cell(B, 'task.time.completion', 0)], { progressEntry: { today: TODAY } });
  eq('2a 0 %: geen statusdatum, geen melding; nog eens 0 % is geen undo-stap',
    { sd: S().project.statusDate ?? null, steps: undoDepth(S) - d0, notices: todayNotices(S).length },
    { sd: null, steps: 0, notices: 0 });
}
{
  // Een werkelijke datum ná vandaag bestaat niet zodra de statusdatum vandaag wordt ⇒ geweigerd.
  const { S } = fresh();
  const { B } = setup(S);
  const future = new Date(`${TODAY}T00:00:00Z`);
  future.setUTCDate(future.getUTCDate() + 2);
  const iso = future.toISOString().slice(0, 10);
  const res = S().enterTaskProgress(B, { field: 'actualStart', value: iso }, { today: TODAY });
  eq('2b werkelijke start ná vandaag: geweigerd, niets veranderd',
    { res, sd: S().project.statusDate ?? null, as: taskOf(S, B).time.actualStart ?? null },
    { res: { ok: false, reason: 'afterStatusDate' }, sd: null, as: null });
}
{
  // Met een statusdatum: die blijft staan, geen melding.
  const { S } = fresh();
  const { B } = setup(S);
  S().setStatusDate(daysBeforeToday(1));
  S().enterTaskProgress(B, { field: 'completion', value: 0.5 }, { today: TODAY });
  eq('2c bestaande statusdatum blijft, geen melding',
    { sd: S().project.statusDate, notices: todayNotices(S).length }, { sd: daysBeforeToday(1), notices: 0 });
}
{
  // Het headless vangnet (generatoren, testharnassen, extensies): ongewijzigd, geen statusdatum.
  const { S } = fresh();
  const { B } = setup(S);
  S().setTaskProgress(B, 0.5);
  S().runGridMutation([cell(B, 'task.time.completion', 0.6)]);
  eq('2d setters en raster zonder invoerbeleid: geen statusdatum', S().project.statusDate ?? null, null);
}

if (diffs.length === 0) {
  console.log(`OK  progress-entry: alle checks groen (${checks})`);
} else {
  for (const d of diffs) console.log(`XX  progress-entry: ${d}`);
  console.log(`XX  progress-entry: ${diffs.length} afwijking(en) van ${checks}`);
  process.exit(1);
}
