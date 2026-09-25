// PR #170-hercheck, punt 1 en 2 — de bewerksessie van de taakdialoog (`historyMark` /
// `revertHistorySince` / `squashHistorySince`) raakt uitsluitend haar EIGEN events. Een MCP-mutatie
// die tijdens de open dialoog landt blijft bij Annuleren staan en houdt bij Opslaan een eigen
// undo-stap. Headless tegen een echte, geïsoleerde storecontext.
import { test, assert, assertEq, run } from './harness';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';

function setup(): { ctx: AppStoreContext; a: string; b: string } {
  const ctx = createAppStoreContext();
  const s = ctx.store.getState();
  const a = s.addTask({ name: 'A' });
  const b = s.addTask({ name: 'B' });
  ctx.runtime.resetUndoCoalescing();
  return { ctx, a, b };
}

const nameOf = (ctx: AppStoreContext, id: string) => ctx.store.getState().tasks.find(t => t.id === id)?.name;
const applied = (ctx: AppStoreContext) => ctx.store.getState().historyEvents
  .filter(e => e.state === 'applied').sort((l, r) => l.sequence - r.sequence);
const mcpRename = (ctx: AppStoreContext, id: string, name: string) => {
  const tx = createMcpTransactions(ctx);
  const res = tx.run(() => tx.draft.updateTaskFields(id, { name }));
  assert(res.ok, 'voorwaarde: MCP-transactie slaagt');
};

test('Annuleren: MCP tussendoor blijft staan, dialoogwijziging weg, geen redo', () => {
  const { ctx, a, b } = setup();
  const mark = ctx.store.getState().historyMark();
  mcpRename(ctx, b, 'B-ai');
  ctx.store.getState().updateTask(a, { name: 'A-dialoog' });
  ctx.store.getState().revertHistorySince(mark);
  assertEq(nameOf(ctx, a), 'A', 'dialoogwijziging hoort teruggedraaid');
  assertEq(nameOf(ctx, b), 'B-ai', 'de MCP-wijziging hoort te blijven');
  assertEq(applied(ctx).at(-1)?.label, 'MCP-bewerking', 'de MCP-stap blijft de nieuwste undo-stap');
  assert(!ctx.store.getState().historyEvents.some(e => e.state === 'undone'), 'Annuleren laat geen redo achter');
  assertEq(ctx.store.getState().ui.notifications.length, 0, 'geen melding als alles terug kon');
});

test('Annuleren: dialoogwerk ONDER een MCP-stap blijft (chronologie intact) + melding', () => {
  const { ctx, a, b } = setup();
  const mark = ctx.store.getState().historyMark();
  ctx.store.getState().updateTask(a, { name: 'A-dialoog' });
  mcpRename(ctx, b, 'B-ai');
  ctx.store.getState().revertHistorySince(mark);
  assertEq(nameOf(ctx, b), 'B-ai', 'de MCP-wijziging hoort te blijven');
  assertEq(nameOf(ctx, a), 'A-dialoog', 'dialoogwerk onder de MCP-stap kan niet los terug');
  assert(ctx.store.getState().ui.notifications.some(n => n.messageKey === 'notifications.taskEditRevertBlocked'),
    'de gebruiker hoort een melding te krijgen');
  assert(!ctx.store.getState().historyEvents.some(e => e.sessionKey !== undefined), 'sessiesleutels opgeruimd');
  ctx.store.getState().undo();
  assertEq([nameOf(ctx, a), nameOf(ctx, b)], ['A-dialoog', 'B'], 'eerste undo = de MCP-stap');
  ctx.store.getState().undo();
  assertEq([nameOf(ctx, a), nameOf(ctx, b)], ['A', 'B'], 'tweede undo = de dialoogstap');
});

test('Opslaan: één undo-stap voor de dialoog, MCP een eigen stap', () => {
  const { ctx, a, b } = setup();
  const before = applied(ctx).length;
  const mark = ctx.store.getState().historyMark();
  mcpRename(ctx, b, 'B-ai');
  ctx.store.getState().updateTask(a, { name: 'A-1' });
  ctx.store.getState().updateTask(a, { description: 'omschrijving' });
  ctx.store.getState().squashHistorySince(mark, 'Taak bewerken');
  const events = applied(ctx);
  assertEq(events.length, before + 2, 'MCP-stap + één dialoogstap');
  assertEq(events.slice(-2).map(e => e.label), ['MCP-bewerking', 'Taak bewerken'], 'labels en volgorde');
  ctx.store.getState().undo();
  assertEq(nameOf(ctx, a), 'A', 'één undo draait de hele dialoogsessie terug');
  assertEq(ctx.store.getState().tasks.find(t => t.id === a)?.description ?? '', '', 'ook de omschrijving');
  assertEq(nameOf(ctx, b), 'B-ai', 'de MCP-stap staat nog');
  ctx.store.getState().undo();
  assertEq(nameOf(ctx, b), 'B', 'tweede undo = de MCP-stap');
});

test('Opslaan: MCP tussen dialoogbewerkingen splitst, maar voegt nooit samen', () => {
  const { ctx, a, b } = setup();
  const mark = ctx.store.getState().historyMark();
  ctx.store.getState().updateTask(a, { name: 'A-1' });
  ctx.store.getState().updateTask(a, { name: 'A-2' });
  mcpRename(ctx, b, 'B-ai');
  ctx.store.getState().updateTask(a, { name: 'A-3' });
  ctx.store.getState().updateTask(a, { description: 'x' });
  ctx.store.getState().squashHistorySince(mark, 'Taak bewerken');
  const labels = applied(ctx).filter(e => e.sequence >= mark.sequence).map(e => e.label);
  assertEq(labels, ['Taak bewerken', 'MCP-bewerking', 'Taak bewerken'], 'twee dialoogreeksen rond de MCP-stap');
  ctx.store.getState().undo();
  assertEq([nameOf(ctx, a), nameOf(ctx, b)], ['A-2', 'B-ai'], 'undo 1: tweede dialoogreeks');
  ctx.store.getState().undo();
  assertEq([nameOf(ctx, a), nameOf(ctx, b)], ['A-2', 'B'], 'undo 2: alleen de MCP-stap');
});

test('historyMark breekt coalescing af (punt 2)', () => {
  const { ctx, a } = setup();
  ctx.store.getState().updateTask(a, { name: 'A-voor' }, { coalesceKey: 'edit:name' });
  const mark = ctx.store.getState().historyMark();
  ctx.store.getState().updateTask(a, { name: 'A-dialoog' }, { coalesceKey: 'edit:name' });
  ctx.store.getState().revertHistorySince(mark);
  assertEq(nameOf(ctx, a), 'A-voor', 'alleen de dialoogbewerking hoort terug te gaan');
});

await run();
