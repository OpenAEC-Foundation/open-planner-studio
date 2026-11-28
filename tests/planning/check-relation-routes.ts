import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import {
  createRelationDraftWithFeedback,
  createRelationsWithFeedback,
  createRelationWithFeedback,
  chainOrder,
  linkTasksInChain,
  requestRelationAssign,
  selectionInView,
} from '@/state/relationActions';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { liveSelectionAnchor, shiftAnchor } from '@/state/slices/selectionSlice';
import type { RelationSetIntent } from '@/types/taskGrid';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const undoDepth = () => S().historyEvents.filter(event => event.state === 'applied').length;
const notes = () => S().ui.notifications.map(n => ({ key: n.messageKey, params: n.params }));
const pairs = () => S().sequences.map(q => {
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name ?? '?';
  return `${name(q.predecessorId)}→${name(q.successorId)}`;
});

function fresh(): void {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.ui.notifications = [];
    state.isDirty = false;
  });
}
function clearNotes(): void {
  useAppStore.setState(state => { state.ui.notifications = []; });
}

{
  fresh();
  const a = S().addTask({ name: 'Grondwerk' });
  const b = S().addTask({ name: 'Fundering' });
  S().addTask({ name: 'Los' });
  ok('1.0 A→B via de lintroute wordt aangemaakt', createRelationWithFeedback(a, b) !== null);
  S().runCPM();
  clearNotes();
  const depth = undoDepth();

  eq('1.1 B→A sluit de kring: geen id', createRelationWithFeedback(b, a), null);
  eq('1.2 en geen tweede relatie', pairs(), ['Grondwerk→Fundering']);
  eq('1.3 geen loze undo-stap', undoDepth(), depth);
  eq('1.4 de melding noemt de kring, geen "Relatie aangemaakt"', notes(), [{
    key: 'notifications.relationCycle', params: { cycle: 'Fundering → Grondwerk → Fundering' },
  }]);

  clearNotes();
  eq('1.5 conceptroute (SS + lag) weigert dezelfde kring', createRelationDraftWithFeedback({
    predecessorId: b, successorId: a, type: 'START_START', lagDays: 2,
  }), null);
  eq('1.6 melding via hetzelfde kanaal', notes().map(n => n.key), ['notifications.relationCycle']);

  eq('1.7 store-actie addSequence weigert de kring zelf', S().addSequence({
    predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0,
  }), null);
  eq('1.8 nog steeds één relatie', S().sequences.length, 1);

  S().runCPM();
  eq('1.9 F5 blijft rekenen (geen "Circular dependency")', S().cpmResult?.error, undefined);

  ok('1.10 A→B SS naast A→B FS mag gewoon', S().addSequence({
    predecessorId: a, successorId: b, type: 'START_START', lagDays: 0,
  }) !== null);
}

{
  fresh();
  const p = S().addTask({ name: 'Fase' });
  S().addTask({ name: 'Wapening', parentId: p });
  const p1 = S().tasks.find(t => t.name === 'Wapening')!.id;
  const q = S().addTask({ name: 'Storten' });
  ok('2.0 Wapening→Storten', S().addSequence({ predecessorId: p1, successorId: q, type: 'FINISH_START', lagDays: 0 }) !== null);
  S().runCPM();
  clearNotes();
  eq('2.1 Storten→Fase sluit via de fase een kring: geweigerd', createRelationWithFeedback(q, p), null);
  eq('2.2 de melding noemt de bladtaken van de kring', notes(), [{
    key: 'notifications.relationCycle', params: { cycle: 'Storten → Wapening → Storten' },
  }]);
  S().runCPM();
  eq('2.3 F5 blijft rekenen', S().cpmResult?.error, undefined);
}

{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
  });
  clearNotes();
  ok('3.1 C→D (los van de bestaande kring) mag', createRelationWithFeedback(c, d) !== null);
  ok('3.2 X→C (hangt aan de kring, sluit zelf niets) mag', createRelationWithFeedback(x, c) !== null);
  eq('3.3 D→X sluit wél een NIEUWE kring (D → X → C → D): geweigerd', createRelationWithFeedback(d, x), null);
  eq('3.4 met de nieuwe kring in de melding, niet de oude', notes().at(-1), {
    key: 'notifications.relationCycle', params: { cycle: 'D → X → C → D' },
  });
}

const wbs = (id: string) => S().tasks.find(t => t.id === id)!.wbsCode;
function gridPredecessors(taskId: string, tokens: readonly { id: string; lag?: string }[]): string {
  const intent: RelationSetIntent = {
    kind: 'relation-set', taskId, direction: 'predecessor',
    value: tokens.map((token, index) => ({
      kind: 'internal', wbsCode: wbs(token.id), relType: 'FS', lagText: token.lag ?? '',
      source: { index, start: index * 10, end: index * 10 + 5, text: `${wbs(token.id)} FS${token.lag ?? ''}` },
    })),
  };
  const result = S().runGridMutation([intent]);
  return result.ok ? 'ok' : result.errors.map(error => error.code).join(',');
}
const hierarchyNotes = () => notes().filter(n => n.key === 'notifications.relationsExcludedByHierarchy');

{
  fresh();
  const a = S().addTask({ name: 'Grondwerk' });
  const b = S().addTask({ name: 'Fundering' });
  const x = S().addTask({ name: 'Steigerbouw' });
  const y = S().addTask({ name: 'Dakwerk' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  clearNotes();
  S().indentTasks([b]);
  eq('4.1 opzet: Fundering hangt onder Grondwerk', S().tasks.find(t => t.id === b)!.parentId, a);
  eq('4.2 de relatie blijft bewaard (niet stil weggegooid)', pairs(), ['Grondwerk→Fundering']);
  eq('4.3 inspringen meldt dat één relatie niet meer meetelt', hierarchyNotes(), [{
    key: 'notifications.relationsExcludedByHierarchy', params: { count: 1 },
  }]);

  eq('4.4 raster: Steigerbouw als voorganger van Dakwerk mag', gridPredecessors(y, [{ id: x }]), 'ok');
  eq('4.5 en staat er', pairs().includes('Steigerbouw→Dakwerk'), true);
  eq('4.6 raster: cel met de bestaande voorouder-relatie plus een nieuwe', gridPredecessors(b, [{ id: a }, { id: x }]), 'ok');
  eq('4.7 raster: lag van de bestaande voorouder-relatie wijzigen', gridPredecessors(b, [{ id: a, lag: '+2d' }, { id: x }]), 'ok');
  eq('4.8 de voorouder-relatie is dezelfde relatie gebleven, nu met lag', S().sequences
    .filter(q => q.predecessorId === a && q.successorId === b).map(q => q.lagDays), [2]);
  const c = S().addTask({ name: 'Uitzetten', parentId: a });
  eq('4.9 raster: nieuwe relatie naar de eigen fase blijft geweigerd', gridPredecessors(c, [{ id: a }]), 'ancestor');
}

{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
  });
  eq('5.1 raster: C als voorganger van D (los van de kring) mag', gridPredecessors(d, [{ id: c }]), 'ok');
  eq('5.2 raster: D als voorganger van C sluit een nieuwe kring', gridPredecessors(c, [{ id: d }]), 'cycle');
  eq('5.3 raster: de bestaande kring herstellen (cel leegmaken) mag', gridPredecessors(x, []), 'ok');
  eq('5.4 daarna geen kring meer', pairs().sort(), ['C→D', 'X→Y']);
}

{
  fresh();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const los = S().addTask({ name: 'Los' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  clearNotes();
  S().indentTasks([los]);
  eq('6.1 verhangen zonder gevolgen voor relaties meldt niets', hierarchyNotes(), []);
  S().outdentTasks([los]);

  S().moveTaskTo(b, { parentId: a, childIndex: 0 });
  eq('6.2 rij slepen (moveTaskTo) meldt het', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  S().undo();
  clearNotes();
  S().moveTasksTo([b], { parentId: a, childIndex: 0 });
  eq('6.3 selectie slepen (moveTasksTo) meldt het', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  S().undo();
  clearNotes();
  S().moveTask(a, b);
  eq('6.4 ouder kiezen (moveTask) meldt het, ook als de voorganger onder de opvolger gaat', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  clearNotes();
  S().moveTask(los, b);
  eq('6.5 een relatie die al niet meetelde, wordt niet opnieuw gemeld', hierarchyNotes(), []);
}

const cycleNotes = () => notes().filter(n => n.key === 'notifications.hierarchyCycle');
const parentName = (id: string) => {
  const parentId = S().tasks.find(t => t.id === id)!.parentId;
  return parentId ? S().tasks.find(t => t.id === parentId)!.name : null;
};
function s4(extra: readonly string[] = []): Record<string, string> {
  fresh();
  const ids: Record<string, string> = {};
  for (const name of ['Grondwerk', 'Fundering', ...extra, 'Keuring']) ids[name] = S().addTask({ name });
  S().addSequence({ predecessorId: ids.Grondwerk, successorId: ids.Keuring, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: ids.Keuring, successorId: ids.Fundering, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  eq('7.0 opzet: het uitgangspunt rekent', S().cpmResult?.error, undefined);
  useAppStore.setState(state => { state.ui.notifications = []; state.isDirty = false; });
  return ids;
}
function expectRefused(label: string, depth: number, cycle: string, parents: Record<string, string | null>): void {
  for (const [name, parent] of Object.entries(parents)) {
    const id = S().tasks.find(t => t.name === name)!.id;
    eq(`${label}: ${name} hangt nog onder ${parent ?? 'de wortel'}`, parentName(id), parent);
  }
  eq(`${label}: geen undo-stap`, undoDepth(), depth);
  eq(`${label}: document niet gewijzigd`, S().isDirty, false);
  eq(`${label}: planning niet verouderd`, S().scheduleStale, false);
  eq(`${label}: melding noemt de kring`, cycleNotes(), [{ key: 'notifications.hierarchyCycle', params: { cycle } }]);
  eq(`${label}: geen "telt niet mee"-melding over een verhanging die niet doorging`, hierarchyNotes(), []);
  S().runCPM();
  eq(`${label}: F5 blijft rekenen`, S().cpmResult?.error, undefined);
}
{
  let ids = s4();
  let depth = undoDepth();
  S().indentTasks([ids.Fundering]);
  expectRefused('7.1 inspringen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  ids = s4();
  depth = undoDepth();
  S().moveTaskTo(ids.Fundering, { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('7.2 rij slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  ids = s4();
  depth = undoDepth();
  S().moveTasksTo([ids.Fundering], { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('7.3 selectie slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  ids = s4();
  depth = undoDepth();
  S().moveTask(ids.Fundering, ids.Grondwerk);
  expectRefused('7.4 ouder kiezen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  ids = s4();
  S().removeSequence(S().sequences.find(q => q.predecessorId === ids.Keuring)!.id);
  S().indentTasks([ids.Fundering]);
  eq('7.5 zonder kring gaat inspringen gewoon door', parentName(ids.Fundering), 'Grondwerk');
  eq('7.6 zonder melding over een kring', cycleNotes(), []);
}

{
  let ids = s4(['Steiger', 'Dak']);
  let depth = undoDepth();
  S().indentTasks([ids.Fundering, ids.Dak]);
  expectRefused('8.1 inspringen van twee taken', depth, 'Fundering → Keuring → Fundering', { Fundering: null, Dak: null });
  S().indentTasks([ids.Dak]);
  eq('8.2 tegenproef: Dak alleen inspringen gaat door', parentName(ids.Dak), 'Steiger');

  ids = s4(['Steiger', 'Dak']);
  depth = undoDepth();
  S().moveTasksTo([ids.Dak, ids.Fundering], { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('8.3 blok slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null, Dak: null });
}

{
  fresh();
  const casco = S().addTask({ name: 'Casco' });
  const kozijnen = S().addTask({ name: 'Kozijnen' });
  S().addSequence({ predecessorId: kozijnen, successorId: casco, type: 'FINISH_START', lagDays: 0 });
  S().indentTasks([kozijnen]);
  const metselwerk = S().addTask({ name: 'Metselwerk', parentId: casco });
  ok('9.0 opzet: Metselwerk → Kozijnen binnen dezelfde fase mag', S().addSequence({
    predecessorId: metselwerk, successorId: kozijnen, type: 'FINISH_START', lagDays: 0,
  }) !== null);
  S().runCPM();
  eq('9.0 opzet: rekent', S().cpmResult?.error, undefined);
  useAppStore.setState(state => { state.ui.notifications = []; state.isDirty = false; });
  const depth = undoDepth();
  S().outdentTasks([kozijnen]);
  expectRefused('9.1 uitspringen', depth, 'Kozijnen → Metselwerk → Kozijnen', { Kozijnen: 'Casco' });
}

{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const fase = S().addTask({ name: 'Fase' });
  const taak = S().addTask({ name: 'Taak' });
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
    state.ui.notifications = [];
  });
  S().indentTasks([taak]);
  eq('10.1 inspringen los van de bestaande kring gaat door', parentName(taak), 'Fase');
  eq('10.2 zonder kringmelding', cycleNotes(), []);
  ok('10.3 (fase bestaat)', fase.length > 0);
}

{
  fresh();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  S().addSequence({ predecessorId: a, successorId: d, type: 'FINISH_START', lagDays: 0 });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; });
  const depth = undoDepth();
  const ids = createRelationsWithFeedback([
    { predecessorId: b, successorId: d, type: 'FINISH_START', lagDays: 2 },
    { predecessorId: a, successorId: d, type: 'FINISH_START', lagDays: 0 },
    { predecessorId: c, successorId: d, type: 'START_START', lagDays: 0 },
  ]);
  eq('11.1 per relatie een id of null', ids.map(id => id === null ? null : 'id'), ['id', null, 'id']);
  eq('11.2 nieuwe relaties staan erin', pairs(), ['A→D', 'B→D', 'C→D']);
  eq('11.3 lag en type per relatie', S().sequences.slice(1).map(q => [q.type, q.lagDays]), [['FINISH_START', 2], ['START_START', 0]]);
  eq('11.4 precies één undo-stap', undoDepth(), depth + 1);
  eq('11.5 de weigering meldt zich', notes().map(n => n.key), ['notifications.relationDuplicate']);
  S().undo();
  eq('11.6 één Ctrl+Z haalt ze allebei weg', pairs(), ['A→D']);

  fresh();
  const p = S().addTask({ name: 'P' });
  const q = S().addTask({ name: 'Q' });
  const r = S().addTask({ name: 'R' });
  const before = undoDepth();
  const loop = createRelationsWithFeedback([
    { predecessorId: q, successorId: p, type: 'FINISH_START', lagDays: 0 },
    { predecessorId: p, successorId: q, type: 'FINISH_START', lagDays: 0 },
    { predecessorId: r, successorId: p, type: 'FINISH_START', lagDays: 0 },
  ]);
  eq('11.7 de kring met een eerdere relatie uit de reeks wordt geweigerd', loop.map(id => id !== null), [true, false, true]);
  eq('11.8 kringmelding', notes().map(n => n.key), ['notifications.relationCycle']);
  eq('11.9 één undo-stap', undoDepth(), before + 1);

  clearNotes();
  const none = createRelationsWithFeedback([{ predecessorId: q, successorId: p, type: 'FINISH_START', lagDays: 0 }]);
  eq('11.10 alles geweigerd: geen relatie', none, [null]);
  eq('11.11 alles geweigerd: geen undo-stap', undoDepth(), before + 1);
  eq('11.12 lege lijst doet niets', createRelationsWithFeedback([]), []);
}

{
  fresh();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  S().addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; });
  const depth = undoDepth();
  const ids = linkTasksInChain([d, a, b, c]);
  eq('12.1 per schakel een id of null', ids.map(id => id === null ? null : 'id'), ['id', null, 'id']);
  eq('12.2 de keten volgt het scherm, niet de klikvolgorde', pairs(), ['B→C', 'A→B', 'C→D']);
  eq('12.3 alles Eind-Start zonder lag', S().sequences.slice(1).map(q => [q.type, q.lagDays]), [['FINISH_START', 0], ['FINISH_START', 0]]);
  eq('12.4 precies één undo-stap', undoDepth(), depth + 1);
  eq('12.5 de bestaande schakel meldt zich', notes().map(n => n.key), ['notifications.relationDuplicate']);
  S().undo();
  eq('12.6 één Ctrl+Z haalt de keten weg', pairs(), ['B→C']);
  eq('12.7 één taak koppelt niets', linkTasksInChain([a]), []);

  const shortcut = SHORTCUTS.find(entry => entry.id === 'edit.linkSelected');
  eq('12.8 Ctrl+F2 staat in het register', shortcut?.combo, { key: 'F2', mod: true });
  S().selectTask(a, false);
  ok('12.9 met één taak doet Ctrl+F2 niets', shortcut?.when?.() === false);
  S().selectTask(c, true);
  S().selectTask(d, true);
  ok('12.10 met drie taken mag Ctrl+F2', shortcut?.when?.() === true);
  shortcut?.run(S());
  eq('12.11 Ctrl+F2 koppelt de selectie als keten', pairs(), ['B→C', 'A→C', 'C→D']);

  S().setUI({ showPropertiesPanel: false, rightPanelCollapsed: true });
  requestRelationAssign(b, 'successor');
  eq('12.12 de taak is de selectie', [S().selectedTaskIds, S().activeTaskId], [[b], b]);
  eq('12.13 eigenschappenpaneel open, rail uitgeklapt',
    [S().ui.showPropertiesPanel, S().ui.rightPanelCollapsed], [true, false]);
  eq('12.14 het verzoek draagt taak en richting', S().ui.pendingRelationAssign, { taskId: b, direction: 'successor' });
  eq('12.15 toewijzen zelf verandert het document niet', pairs(), ['B→C', 'A→C', 'C→D']);

  S().selectTask(d, false);
  S().selectTask(b, false, true);
  eq('12.16 een Shift-bereik volgt de lijst, ook naar boven', S().selectedTaskIds, [b, c, d]);
  const rowOf = (taskId: string) => ({ rowKey: S().viewRows.find(row => row.kind === 'task' && row.task.id === taskId)!.rowKey });
  S().selectTask(a, false, false, rowOf(a));
  S().selectTask(c, true, false, rowOf(c));
  S().selectTask(b, false, true, rowOf(b));
  eq('12.17 na Ctrl C kiest Shift B het bereik C–B', S().selectedTaskIds, [b, c]);
  S().selectTask(a, false, false, rowOf(a));
  S().selectTask(d, false, true, rowOf(d));
  eq('12.17a A, Shift D', S().selectedTaskIds, [a, b, c, d]);
  S().selectTask(b, false, true, rowOf(b));
  eq('12.17b een kleiner bereik laat C en D los', S().selectedTaskIds, [a, b]);
  S().selectTask(d, true, true, rowOf(d));
  S().selectTask(b, true, true, rowOf(b));
  eq('12.17c Ctrl+Shift kiest ook precies het bereik, zoals de takenlijst', S().selectedTaskIds, [a, b]);
  clearNotes();
  const before1217 = S().sequences.map(q => q.id);
  linkTasksInChain(S().selectedTaskIds);
  eq('12.17d Ctrl+F2 koppelt alleen dat bereik', S().sequences.filter(q => !before1217.includes(q.id))
    .map(q => [q.predecessorId, q.successorId]), [[a, b]]);
  S().undo();

  S().setFilter({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'B' });
  S().selectTask(c, false);
  S().selectTask(a, false, true);
  eq('12.18 een weggefilterde taak valt buiten het bereik', S().selectedTaskIds, [a, c]);
  S().setFilter(null);
  S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
  S().selectTask(d, false);
  S().selectTask(b, false, true);
  eq('12.19 bij een aflopende sortering volgt het bereik het scherm', S().selectedTaskIds, [d, c, b]);
  S().setSort([]);

  S().selectTask(a, false);
  S().selectTask(d, true);
  S().setUI({ activeRibbonTab: 'report' });
  ok('12.21 op Rapport doet Ctrl+F2 niets', shortcut?.when?.() === false);
  S().setUI({ activeRibbonTab: 'start', showResourcePanel: true, resourcePanelDocked: false });
  ok('12.22 onder het volledige resourcepaneel doet Ctrl+F2 niets', shortcut?.when?.() === false);
  S().setUI({ resourcePanelDocked: true });
  ok('12.23 met het gedockte resourcepaneel mag Ctrl+F2', shortcut?.when?.() === true);
  S().setUI({ showResourcePanel: false, resourcePanelDocked: false, activeRibbonTab: 'table' });
  ok('12.24 op Tabel mag Ctrl+F2', shortcut?.when?.() === true);
  S().setUI({ activeRibbonTab: 'start' });

  S().setUI({ pendingRelationAssign: null });
  requestRelationAssign('task-bestaat-niet', 'successor');
  eq('12.25 geen verzoek voor een taak die niet bestaat', S().ui.pendingRelationAssign, null);
  const p = S().addTask({ name: 'P' });
  const q = S().addTask({ name: 'Q' });
  const r = S().addTask({ name: 'R' });
  S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
  const before = S().sequences.length;
  linkTasksInChain([p, r, q]);
  eq('12.26 bij een aflopende sortering volgt de keten het scherm', pairs().slice(before), ['R→Q', 'Q→P']);
  S().setSort([]);
}

{
  fresh();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  const ploeg1 = S().addResource({ name: 'Ploeg 1', type: 'LABOR', description: '', maxUnits: 1 });
  const ploeg2 = S().addResource({ name: 'Ploeg 2', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(a, ploeg1, 1, 'UNIFORM');
  S().assignResource(b, ploeg1, 1, 'UNIFORM');
  S().assignResource(c, ploeg2, 1, 'UNIFORM');
  S().assignResource(d, ploeg2, 1, 'UNIFORM');
  S().assignResource(b, ploeg2, 1, 'UNIFORM');
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name;
  const shape = () => S().viewRows.map(row => (row.kind === 'task' ? name(row.task.id) : '|'));
  eq('13.0 B staat in twee rijen', shape(), ['|', 'B', 'A', '|', 'D', 'C', 'B']);
  S().selectTask(c, false);
  S().selectTask(b, false, true, { rowKey: S().viewRows[6].rowKey });
  eq('13.1 het bereik loopt naar de aangeklikte B-rij in ploeg 2', S().selectedTaskIds.map(name), ['C', 'B']);
  S().selectTask(d, false);
  S().selectTask(b, false, true, { rowKey: S().viewRows[1].rowKey });
  eq('13.2 en naar de B-rij in ploeg 1, over de bandkop heen', S().selectedTaskIds.map(name), ['B', 'A', 'D']);
  S().selectTask(b, false, false, { rowKey: S().viewRows[1].rowKey });
  eq('13.10 een Gantt-klik zet de aangeklikte rij als cursorrij', S().ui.gridActiveRowKey, S().viewRows[1].rowKey);
  S().selectTask(c, false, true, { rowKey: S().viewRows[5].rowKey });
  eq('13.11 het bereik begint op de aangeklikte B-rij', S().selectedTaskIds.map(name), ['B', 'A', 'D', 'C']);
  eq('13.12 de cursorrij volgt de Shift-klik', S().ui.gridActiveRowKey, S().viewRows[5].rowKey);
  S().selectTask(b, false, false, { rowKey: S().viewRows[6].rowKey });
  S().selectTasks([b], false, b, { rowKey: S().viewRows[1].rowKey, taskIds: [b] });
  eq('13.20 het kader zet zijn bovenste rij als anker', S().ui.selectionAnchor?.rowKey, S().viewRows[1].rowKey);
  S().selectTask(c, false, true, { rowKey: S().viewRows[5].rowKey });
  eq('13.21 Shift na het kader begint op die rij', S().selectedTaskIds.map(name), ['B', 'A', 'D', 'C']);
  S().selectTask(b, false, false, { rowKey: S().viewRows[1].rowKey });
  S().selectTask(d, true, false, { rowKey: S().viewRows[4].rowKey });
  S().selectTask(d, true, false, { rowKey: S().viewRows[4].rowKey });
  S().selectTask(c, false, true, { rowKey: S().viewRows[5].rowKey });
  eq('13.22 na uitvinken begint Shift op de uitgevinkte rij', S().selectedTaskIds.map(name), ['D', 'C']);
  S().selectTask(b, false, false, { rowKey: S().viewRows[6].rowKey });
  S().selectTask(a, false, true, { rowKey: S().viewRows[2].rowKey });
  eq('13.24 Shift vanaf de onderste B naar A', S().selectedTaskIds.map(name), ['A', 'D', 'C', 'B']);
  S().selectTask(b, false, false, { rowKey: S().viewRows[1].rowKey });
  S().selectTasks([b], false, b, { rowKey: S().viewRows[6].rowKey, taskIds: [b] });
  S().selectTask(a, false, true, { rowKey: S().viewRows[2].rowKey });
  eq('13.25 een kader rond de onderste B, dan Shift A', S().selectedTaskIds.map(name), ['A', 'D', 'C', 'B']);
  eq('13.27 A en D liggen vast', chainOrder(S().viewRows, [d, a])?.map(name), ['A', 'D']);
  eq('13.28 B voor én na D ligt niet vast', chainOrder(S().viewRows, [d, b]), null);
  clearNotes();
  const chainBefore = S().sequences.length;
  eq('13.29 dan legt Ctrl+F2 niets', linkTasksInChain([b, d]), []);
  eq('13.30 en meldt waarom', notes().map(n => n.key), ['notifications.relationChainOrderUnclear']);
  eq('13.31 er is geen relatie bijgekomen', S().sequences.length, chainBefore);
  S().selectTask(b, false, false, { rowKey: S().viewRows[6].rowKey });
  requestRelationAssign(b, 'successor');
  eq('13.38 toewijzen houdt de gekozen rij als anker', S().ui.selectionAnchor?.rowKey, S().viewRows[6].rowKey);
  S().selectTask(b, false, false, { rowKey: S().viewRows[1].rowKey });
  requestRelationAssign(b, 'successor', S().viewRows[6].rowKey);
  eq('13.44 de rij van het rechtsklikmenu wordt het anker', S().ui.selectionAnchor?.rowKey, S().viewRows[6].rowKey);
  eq('13.45 en de cursorrij', S().ui.gridActiveRowKey, S().viewRows[6].rowKey);
  S().setUI({ pendingRelationAssign: null });
  S().deselectAll();
  eq('13.23 niets kiezen wist het anker', S().ui.selectionAnchor, null);
  S().setSort([]);
  S().setGroup([]);

  S().selectTask(a, false);
  S().selectTask(b, true);
  S().selectTask(c, true);
  S().setFilter({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'B' });
  ok('13.3 een verborgen geselecteerde taak telt als niet in beeld', !selectionInView(S()));
  const shortcut = SHORTCUTS.find(entry => entry.id === 'edit.linkSelected');
  ok('13.4 Ctrl+F2 doet dan niets', shortcut?.when?.() === false);
  S().setFilter(null);
  ok('13.5 zonder filter staat de selectie weer in beeld', selectionInView(S()));
  ok('13.6 en mag Ctrl+F2', shortcut?.when?.() === true);
}

{
  fresh();
  const b = S().addTask({ name: 'B' });
  const a = S().addTask({ name: 'A' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  const ploeg1 = S().addResource({ name: 'Ploeg 1', type: 'LABOR', description: '', maxUnits: 1 });
  const ploeg2 = S().addResource({ name: 'Ploeg 2', type: 'LABOR', description: '', maxUnits: 1 });
  for (const [task, res] of [[a, ploeg1], [d, ploeg1], [b, ploeg2], [a, ploeg2], [c, ploeg2]] as const) {
    S().assignResource(task, res, 1, 'UNIFORM');
  }
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name;
  const shape = () => S().viewRows.map(row => (row.kind === 'task' ? name(row.task.id) : '|'));
  eq('13.32 op het scherm', shape(), ['|', 'A', 'D', '|', 'B', 'A', 'C']);
  S().selectTask(b, false, false, { rowKey: S().viewRows[4].rowKey });
  S().deleteTask(b);
  eq('13.33 na verwijderen', shape(), ['|', 'A', 'D', '|', 'A', 'C']);
  eq('13.34 de cursor staat op A in ploeg 2', S().ui.gridActiveRowKey, S().viewRows[4].rowKey);
  eq('13.35 en daar begint Shift', S().ui.selectionAnchor?.rowKey, S().viewRows[4].rowKey);
  S().selectTask(c, false, true, { rowKey: S().viewRows[5].rowKey });
  eq('13.36 Shift op C neemt alleen ploeg 2', S().selectedTaskIds.map(name), ['A', 'C']);
  linkTasksInChain(S().selectedTaskIds);
  eq('13.37 de keten is A → C', pairs(), ['A→C']);
  S().setGroup([]);
}

{
  fresh();
  const g = S().addTask({ name: 'Grondwerk' });
  const f = S().addTask({ name: 'Fundering' });
  const r = S().addTask({ name: 'Ruwbouw' });
  const rowOf = (id: string) => S().viewRows.find(row => row.kind === 'task' && row.task.id === id)!.rowKey;
  S().selectTask(g, false, false, { rowKey: rowOf(g) });
  S().copyTasks();
  const [copy] = S().pasteTasks();
  eq('13.39 na plakken is alleen de kopie gekozen', S().selectedTaskIds, [copy]);
  eq('13.40 en geldt het anker van Grondwerk niet meer', liveSelectionAnchor(S()), null);
  S().selectTask(r, false, true, { rowKey: rowOf(r) });
  const expectRange = (ids: readonly string[]) => {
    const order = S().viewRows.flatMap(row => row.kind === 'task' ? [row.task.id] : []);
    const [from, to] = [order.indexOf(copy), order.indexOf(r)].sort((x, y) => x - y);
    return order.slice(from, to + 1).every(id => ids.includes(id)) && ids.length === to - from + 1;
  };
  ok('13.41 Shift na plakken loopt van de kopie tot Ruwbouw', expectRange(S().selectedTaskIds)
    && S().selectedTaskIds.includes(copy) && !S().selectedTaskIds.includes(g));

  const fase = S().addTask({ name: 'Fase' });
  S().moveTask(g, fase);
  S().moveTask(f, fase);
  S().selectTask(f, false, false, { rowKey: rowOf(f) });
  S().toggleCollapse(fase);
  eq('13.42 inklappen kiest de fase', S().selectedTaskIds, [fase]);
  S().toggleCollapse(fase);
  S().selectTask(g, false, true, { rowKey: rowOf(g) });
  eq('13.43 Shift vanaf de fase neemt Fundering niet mee', [...S().selectedTaskIds].sort(), [fase, g].sort());
}

{
  fresh();
  const a = S().addTask({ name: 'A' });
  const c = S().addTask({ name: 'C' });
  const b = S().addTask({ name: 'B' });
  S().moveTask(c, a);
  const rowOf = (id: string) => S().viewRows.find(row => row.kind === 'task' && row.task.id === id)!.rowKey;
  S().toggleCollapse(a);
  S().selectTask(a, false, false, { rowKey: rowOf(a) });
  S().selectTask(b, false, true, { rowKey: rowOf(b) });
  eq('13.46 A, Shift B', S().selectedTaskIds, [a, b]);
  S().toggleCollapse(a);
  S().selectAllTasks();
  S().toggleCollapse(a);
  eq('13.47 inklappen kiest weer A en B', [...S().selectedTaskIds].sort(), [a, b].sort());
  eq('13.48 het oude anker geldt niet meer', liveSelectionAnchor(S()), null);
  S().toggleCollapse(a);
  S().selectTask(b, false, true, { rowKey: rowOf(b) });
  ok('13.49 Shift op B neemt C niet mee', !S().selectedTaskIds.includes(c));
  eq('13.50 Shift na Ctrl+A begint voor beide oppervlakken bij de actieve taak', shiftAnchor(S())?.taskIds, [b]);
}

{
  fresh();
  const zero = { durationUnit: 'days', scheduleDuration: 0 } as const;
  const m1 = S().addTask({ name: 'M1', isMilestone: true, time: zero as never });
  const m3 = S().addTask({ name: 'M3', isMilestone: true, time: zero as never });
  const na = S().addTask({ name: 'Na' });
  S().toggleCollapse(m1);
  const runIndex = S().viewRows.findIndex(row => row.kind === 'milestones');
  ok(`13.7 M1 en M3 vormen één rij (${S().viewRows.map(row => row.kind).join(', ')})`, runIndex >= 0);
  if (runIndex >= 0) {
    const rowKey = S().viewRows[runIndex].rowKey;
    S().selectTask(na, false);
    S().selectTask(m1, false, true, { rowKey, taskIds: [m1, m3] });
    eq('13.8 het groepsruitje staat op zijn eigen plek in het bereik', S().selectedTaskIds, [m1, m3, na]);
    S().selectTask(na, false);
    S().selectTask(m3, false, true, { rowKey });
    eq('13.9 een los ruitje neemt alleen zichzelf uit de reeksrij', S().selectedTaskIds, [m3, na]);
  }
}

{
  fresh();
  const zero = { durationUnit: 'days', scheduleDuration: 0 } as const;
  const m1 = S().addTask({ name: 'M1', isMilestone: true, time: zero as never });
  const m2 = S().addTask({ name: 'M2', isMilestone: true, time: zero as never });
  const m3 = S().addTask({ name: 'M3', isMilestone: true, time: zero as never });
  const na = S().addTask({ name: 'Na' });
  S().toggleCollapse(m1);
  const run = S().viewRows.find(row => row.kind === 'milestones');
  const naRow = S().viewRows.find(row => row.kind === 'task' && row.task.id === na);
  ok('13.13 M1, M2 en M3 vormen één rij', run !== undefined && naRow !== undefined);
  if (run && naRow) {
    const diamond = { rowKey: run.rowKey, taskIds: [m1, m2] };
    S().selectTask(m3, false, false, { rowKey: run.rowKey });
    S().selectTask(na, false, true, { rowKey: naRow.rowKey });
    eq('13.14 vanaf een los ruitje telt van de reeksrij alleen dat ruitje', S().selectedTaskIds, [m3, na]);
    S().selectTask(m3, false, false, { rowKey: run.rowKey });
    S().selectTask(m1, false, true, diamond);
    eq('13.15 binnen één reeksrij volgt het bereik de rij', S().selectedTaskIds, [m1, m2, m3]);
    S().deselectAll();
    S().selectTask(m1, false, true, diamond);
    eq('13.16 Shift zonder anker kiest het hele groepsruitje', S().selectedTaskIds, [m1, m2]);
    S().selectTask(na, false, false, { rowKey: naRow.rowKey });
    S().selectTask(m1, true, false, diamond);
    eq('13.17 Ctrl op een groepsruitje zet zijn leden erbij', S().selectedTaskIds, [na, m1, m2]);
    S().selectTask(m1, true, false, diamond);
    eq('13.18 en weer samen uit', S().selectedTaskIds, [na]);
    S().selectTask(m1, false, false, diamond);
    eq('13.19 een gewone klik kiest het hele groepsruitje', S().selectedTaskIds, [m1, m2]);
    S().newDocument();
    eq('13.26 een documentwissel wist het Shift-anker', S().ui.selectionAnchor, null);
  }
}

{
  fresh();
  const on = (date: string) => ({
    durationUnit: 'days', scheduleDuration: 0, scheduleStart: date, scheduleFinish: date, earlyStart: date, earlyFinish: date,
  }) as never;
  const midden = S().addTask({ name: 'Midden', isMilestone: true, time: on('2026-03-16') });
  const vroeg = S().addTask({ name: 'Vroeg', isMilestone: true, time: on('2026-03-10') });
  const laat = S().addTask({ name: 'Laat', isMilestone: true, time: on('2026-03-20') });
  const na = S().addTask({ name: 'Na' });
  S().toggleCollapse(midden);
  const run = S().viewRows.find(row => row.kind === 'milestones');
  ok('13.51 Midden, Vroeg en Laat vormen één rij', run !== undefined);
  if (run) {
    S().selectTask(vroeg, false, false, { rowKey: run.rowKey });
    S().selectTask(laat, false, true, { rowKey: run.rowKey });
    eq('13.52 Shift van Vroeg naar Laat neemt Midden mee, zoals getekend', S().selectedTaskIds, [vroeg, midden, laat]);
    eq('13.53 twee ruitjes op één rij: de volgorde ligt niet vast', chainOrder(S().viewRows, [vroeg, laat]), null);
    const before = S().sequences.length;
    clearNotes();
    eq('13.54 de keten koppelt dan niets', linkTasksInChain([vroeg, laat]), []);
    eq('13.55 en meldt waarom', notes().map(n => n.key), ['notifications.relationChainOrderUnclear']);
    eq('13.56 geen relatie erbij', S().sequences.length, before);
    eq('13.57 één ruitje en de taak eronder liggen wel vast', chainOrder(S().viewRows, [na, laat]), [laat, na]);
  }
}

ok('runGridMutation-export bestaat', typeof runGridMutation === 'function');

if (diffs.length > 0) {
  console.log(`XX  relation-routes: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   - ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-routes: alle checks groen (${checks})`);
