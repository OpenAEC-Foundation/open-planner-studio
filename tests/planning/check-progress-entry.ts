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
// Regel 2 (Z1b): voortgang op een taak zonder vastgelegde werkelijke start, waarvan de geplande
// start NA de statusdatum ligt ⇒ de app vraagt de werkelijke start vóór de voortgang wordt toegepast;
// annuleren verandert niets; een antwoord na de statusdatum of na het werkelijke einde wordt gemeld.
// Vóór deze regel leidde elke route die start af uit de geplande start — een datum na de statusdatum.
//
// De browserkant (echte klikken/toetsen) staat in tests/browser/progress-entry.spec.ts.
// Draait via run.sh. Exit 0 = alles groen.
import './domShim';
import { createAppStoreContext, useAppStore, type AppState, type AppStoreContext } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { createTaskDialogSave, draftWithProgress } from '@/state/taskDialogSave';
import { answerActualStartQuestion } from '@/state/actualStartQuestion';
import { planProgressEntry } from '@/engine/progressEntry';
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

// ── 3. Regel 2 (Z1b): voortgang op een taak die pas na de statusdatum begint ⇒ eerst vragen ───────
// Project start twee weken ná vandaag: A en B liggen helemaal na de statusdatum (gisteren).
function daysAfterToday(days: number): string { return daysBeforeToday(-days); }
const SD = daysBeforeToday(1);
function setupFuture(S: () => AppState, statusDate: string | undefined): { A: string; B: string; C: string; M: string } {
  const { A, B, C } = setup(S);
  S().setProject({ startDate: daysAfterToday(14) });
  const M = S().addTask({ name: 'Mijlpaal', isMilestone: true, time: { scheduleDuration: 0 } as Task['time'] });
  if (statusDate) S().setStatusDate(statusDate);
  S().runCPM();
  return { A, B, C, M };
}
const progressOf = (S: () => AppState, id: string) => {
  const t = taskOf(S, id);
  return { completion: t.time.completion, status: t.status, as: t.time.actualStart ?? null, af: t.time.actualFinish ?? null };
};
const UNTOUCHED = { completion: 0, status: 'NOT_STARTED', as: null, af: null };
{
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  eq('3.0 voorwaarde: geplande start B ligt na de statusdatum', taskOf(S, B).time.earlyStart! > SD, true);
  const d0 = undoDepth(S);
  const res = S().enterTaskProgress(B, { field: 'completion', value: 0.5 }, { today: TODAY });
  eq('3a paneel 50 %: eerst de vraag, met de statusdatum als uiterste datum',
    res, { ok: false, reason: 'needsActualStart', question: { taskId: B, statusDate: SD, latest: SD } });
  eq('3a zolang er geen antwoord is: niets veranderd, geen undo-stap',
    { p: progressOf(S, B), steps: undoDepth(S) - d0 }, { p: UNTOUCHED, steps: 0 });
  const answer = daysBeforeToday(4);
  eq('3a met het antwoord: toegepast',
    S().enterTaskProgress(B, { field: 'completion', value: 0.5 }, { today: TODAY, actualStart: answer }), { ok: true });
  eq('3a werkelijke start = het antwoord, geen verzonnen datum; één undo-stap',
    { p: progressOf(S, B), steps: undoDepth(S) - d0 },
    { p: { completion: 0.5, status: 'STARTED', as: answer, af: null }, steps: 1 });
}
{
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  eq('3b 100 %: ook dan eerst de vraag',
    (S().enterTaskProgress(B, { field: 'completion', value: 1 }, { today: TODAY }) as { reason?: string }).reason, 'needsActualStart');
  const answer = daysBeforeToday(6);
  S().enterTaskProgress(B, { field: 'completion', value: 1 }, { today: TODAY, actualStart: answer });
  eq('3b 100 % met antwoord: start = antwoord, einde volgt de bestaande regel (statusdatum)',
    progressOf(S, B), { completion: 1, status: 'COMPLETED', as: answer, af: SD });
}
{
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  const af = daysBeforeToday(3);
  eq('3c werkelijk einde zonder start: vraag, met dat einde als uiterste datum',
    S().enterTaskProgress(B, { field: 'actualFinish', value: af }, { today: TODAY }),
    { ok: false, reason: 'needsActualStart', question: { taskId: B, statusDate: SD, latest: af } });
  eq('3c antwoord ná het werkelijke einde: gemeld, niets veranderd',
    { res: S().enterTaskProgress(B, { field: 'actualFinish', value: af }, { today: TODAY, actualStart: daysBeforeToday(2) }), p: progressOf(S, B) },
    { res: { ok: false, reason: 'actualFinishBeforeStart' }, p: UNTOUCHED });
  eq('3c antwoord ná de statusdatum: gemeld, niets veranderd',
    { res: S().enterTaskProgress(B, { field: 'actualFinish', value: af }, { today: TODAY, actualStart: TODAY }), p: progressOf(S, B) },
    { res: { ok: false, reason: 'afterStatusDate' }, p: UNTOUCHED });
  const answer = daysBeforeToday(8);
  S().enterTaskProgress(B, { field: 'actualFinish', value: af }, { today: TODAY, actualStart: answer });
  eq('3c geldig antwoord: start en einde zoals opgegeven', progressOf(S, B), { completion: 1, status: 'COMPLETED', as: answer, af });
}
{
  const { S } = fresh();
  const { M } = setupFuture(S, SD);
  const date = daysBeforeToday(2);
  eq('3d mijlpaal met een werkelijke datum: geen vraag (start = einde)',
    S().enterTaskProgress(M, { field: 'actualFinish', value: date }, { today: TODAY }), { ok: true });
  eq('3d mijlpaal: werkelijke datum staat', progressOf(S, M), { completion: 1, status: 'COMPLETED', as: date, af: date });
}
{
  // Regel 1 + 2: geen statusdatum, taak begint na vandaag ⇒ vraag tegen VANDAAG; pas het antwoord
  // zet de statusdatum (samen één undo-stap).
  const { S } = fresh();
  const { B } = setupFuture(S, undefined);
  const d0 = undoDepth(S);
  eq('3e zonder statusdatum: de vraag gaat tegen vandaag',
    S().enterTaskProgress(B, { field: 'completion', value: 0.3 }, { today: TODAY }),
    { ok: false, reason: 'needsActualStart', question: { taskId: B, statusDate: TODAY, latest: TODAY } });
  eq('3e zolang er geen antwoord is: ook geen statusdatum', S().project.statusDate ?? null, null);
  S().enterTaskProgress(B, { field: 'completion', value: 0.3 }, { today: TODAY, actualStart: TODAY });
  eq('3e met antwoord: statusdatum vandaag + voortgang, één undo-stap',
    { sd: S().project.statusDate, as: taskOf(S, B).time.actualStart, steps: undoDepth(S) - d0 },
    { sd: TODAY, as: TODAY, steps: 1 });
}
{
  // Geen vraag: taak met een vastgelegde werkelijke start, of een taak die volgens plan al begonnen is.
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  const as = daysBeforeToday(5);
  S().enterTaskProgress(B, { field: 'actualStart', value: as }, { today: TODAY });
  eq('3f vastgelegde start: 60 % zonder vraag',
    S().enterTaskProgress(B, { field: 'completion', value: 0.6 }, { today: TODAY }), { ok: true });
  const past = fresh();
  const { B: pastB } = setup(past.S);
  past.S().setStatusDate(TODAY);
  eq('3f geplande start vóór de statusdatum: geen vraag (de afgeleide start bestaat)',
    past.S().enterTaskProgress(pastB, { field: 'completion', value: 0.6 }, { today: TODAY }), { ok: true });
}
{
  // Taakraster: de hele handeling wordt geweigerd met per taak `actualStartRequired`; dezelfde
  // handeling mét een werkelijke start per taak slaagt (zo herhaalt FullTaskGrid hem na de vraag).
  const { S } = fresh();
  const { B, C } = setupFuture(S, SD);
  const d0 = undoDepth(S);
  const intents = [cell(B, 'task.time.completion', 0.5), cell(C, 'task.time.completion', 0.5)];
  const res = S().runGridMutation(intents, { progressEntry: { today: TODAY } });
  eq('3g raster (twee taken): één vraag per taak, niets veranderd',
    { res: res.ok ? 'ok' : res.errors.map(e => ({ code: e.code, taskId: e.taskId, value: e.value })), steps: undoDepth(S) - d0 },
    { res: [B, C].map(taskId => ({ code: 'actualStartRequired', taskId, value: { statusDate: SD, latest: SD } })), steps: 0 });
  const answer = daysBeforeToday(3);
  const retry = S().runGridMutation(
    [...intents, cell(B, 'task.time.actualStart', answer), cell(C, 'task.time.actualStart', answer)],
    { progressEntry: { today: TODAY } },
  );
  eq('3g raster mét de antwoorden: toegepast, één undo-stap',
    { ok: retry.ok, b: progressOf(S, B), c: progressOf(S, C), steps: undoDepth(S) - d0 },
    { ok: true, b: { completion: 0.5, status: 'STARTED', as: answer, af: null }, c: { completion: 0.5, status: 'STARTED', as: answer, af: null }, steps: 1 });
  const af = daysBeforeToday(2);
  const { S: S2 } = fresh();
  const { B: B2 } = setupFuture(S2, SD);
  const afRes = S2().runGridMutation([cell(B2, 'task.time.actualFinish', af)], { progressEntry: { today: TODAY } });
  eq('3g raster werkelijk einde: vraag met dat einde als uiterste datum',
    afRes.ok ? 'ok' : afRes.errors.map(e => e.value), [{ statusDate: SD, latest: af }]);
  const status = S2().runGridMutation([cell(B2, 'task.status', 'STARTED')], { progressEntry: { today: TODAY } });
  eq('3g raster status "gestart": ook de vraag', status.ok ? 'ok' : status.errors.map(e => e.code), ['actualStartRequired']);
}
{
  // Contextmenu: alle taken die het nodig hebben in één vraag; annuleren verandert niets.
  const S = () => useAppStore.getState();
  const { B, C } = setupFuture(S, SD);
  S().selectTask(B, false);
  S().selectTask(C, true);
  const d0 = undoDepth(S);
  const cancelled = contextMenuBulk.setProgress(B, 0.5);
  eq('3h contextmenu: één vraag voor beide taken',
    S().ui.pendingActualStartQuestion?.items.map(item => ({ taskId: item.taskId, taskName: item.taskName, latest: item.latest })),
    [{ taskId: B, taskName: 'B', latest: SD }, { taskId: C, taskName: 'C', latest: SD }]);
  answerActualStartQuestion(null);
  await cancelled;
  eq('3h annuleren: niets veranderd, vraag weg',
    { b: progressOf(S, B), c: progressOf(S, C), steps: undoDepth(S) - d0, q: S().ui.pendingActualStartQuestion },
    { b: UNTOUCHED, c: UNTOUCHED, steps: 0, q: null });
  const done = contextMenuBulk.setProgress(B, 0.5);
  answerActualStartQuestion({ [B]: daysBeforeToday(2), [C]: daysBeforeToday(3) });
  await done;
  eq('3h beantwoord: beide toegepast met hun eigen start, één undo-stap',
    { b: taskOf(S, B).time.actualStart, c: taskOf(S, C).time.actualStart, steps: undoDepth(S) - d0 },
    { b: daysBeforeToday(2), c: daysBeforeToday(3), steps: 1 });
}
{
  // "Taak bewerken": de concepttaak volgt dezelfde beslissing (planProgressEntry).
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  const draft = taskOf(S, B);
  const plan = planProgressEntry(draft, { field: 'completion', value: 0.5 }, { statusDate: SD, today: TODAY });
  eq('3i dialoog-concept: dezelfde vraag', plan.ok ? 'ok' : plan.reason, 'needsActualStart');
  const answered = planProgressEntry(draft, { field: 'completion', value: 0.5 }, { statusDate: SD, today: TODAY, actualStart: SD });
  eq('3i dialoog-concept met antwoord', answered.ok && answered.change ? answered.change.task.time.actualStart : null, SD);
}
{
  // Het vangnet: de setters zonder invoerbeleid leiden de start nog steeds af (import, generatoren).
  const { S } = fresh();
  const { B } = setupFuture(S, SD);
  S().setTaskProgress(B, 0.5);
  eq('3j vangnet setTaskProgress: afgeleide start zoals voorheen', taskOf(S, B).time.actualStart, taskOf(S, B).time.earlyStart);
}

if (diffs.length === 0) {
  console.log(`OK  progress-entry: alle checks groen (${checks})`);
} else {
  for (const d of diffs) console.log(`XX  progress-entry: ${d}`);
  console.log(`XX  progress-entry: ${diffs.length} afwijking(en) van ${checks}`);
  process.exit(1);
}
