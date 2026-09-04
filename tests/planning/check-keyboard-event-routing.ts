import './domStub';
import { shouldHandleGlobalShortcutEvent, shouldYieldClipboardShortcutToTaskGrid } from '@/hooks/keyboard/useKeyboardShortcuts';
import {
  dispatchDataGridKeyCommand,
  shouldHandleDataGridClipboardEvent,
  synchronizeDataGridScrollPosition,
} from '@/components/task-grid/DataGridCore';
import { resolveTaskGridCommand } from '@/engine/taskGrid/navigation';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

const failures: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) failures.push(label);
}

const gridTarget = { closest: (selector: string) => selector.includes('task-grid-core') ? {} : null };
const editorTarget = { closest: (selector: string) => selector.includes('input') ? {} : selector.includes('task-grid-core') ? {} : null };
const outsideTarget = { closest: () => null };
for (const key of ['c', 'v']) {
  eq(`${key}: globale taakshortcut wijkt voor een gefocuste gridcel`,
    shouldYieldClipboardShortcutToTaskGrid({ key, ctrlKey: true, metaKey: false, target: gridTarget }), true);
  eq(`${key}: buiten de grid blijft de globale taakshortcut eigenaar`,
    shouldYieldClipboardShortcutToTaskGrid({ key, ctrlKey: true, metaKey: false, target: outsideTarget }), false);
}
eq('Native grid-copy/paste wordt op een gewone gridcel verwerkt',
  shouldHandleDataGridClipboardEvent({ target: gridTarget }), true);
eq('Native copy/paste in een celelement blijft van het invoerveld',
  shouldHandleDataGridClipboardEvent({ target: editorTarget }), false);

const externalScrollTarget = { scrollTop: 0, scrollLeft: 17 };
synchronizeDataGridScrollPosition(externalScrollTarget, 4_000.5, 17);
eq('Een externe verticale scrollprop trekt de echte DOM-scrollpositie mee',
  externalScrollTarget.scrollTop, 4_000.5);
eq('De verticale synchronisatie laat een al gelijke horizontale positie ongemoeid',
  externalScrollTarget.scrollLeft, 17);

// Dit is bewust hetzelfde cancelable native Event-object in beide fasen. De echte helper uit
// DataGridCore handelt de celopdracht af; daarna simuleren we de browser-bubbelgrens naar de
// globale listener. Een gestopte of al afgehandelde gebeurtenis mag daar nooit taakverwijdering
// bereiken.
for (const key of ['Delete', 'Backspace']) {
  const event = new Event('keydown', { cancelable: true }) as Event & { key: string };
  Object.defineProperty(event, 'key', { value: key });
  let clearCount = 0;
  let globalDeleteCount = 0;
  dispatchDataGridKeyCommand(
    event as unknown as React.KeyboardEvent<HTMLDivElement>,
    { kind: 'clear-cells' },
    () => { clearCount++; },
  );
  if (!event.cancelBubble && shouldHandleGlobalShortcutEvent(event as unknown as KeyboardEvent)) {
    globalDeleteCount++;
  }
  eq(`${key}: één grid-clear`, clearCount, 1);
  eq(`${key}: nul globale taakverwijderingen`, globalDeleteCount, 0);
  eq(`${key}: hetzelfde native event is geannuleerd`, event.defaultPrevented, true);
  eq(`${key}: hetzelfde native event is aan de gridgrens gestopt`, event.cancelBubble, true);
}

// WCAG 2.1.2, echte modules end-to-end: Tab op de allerlaatste cel en Shift+Tab op de allereerste
// cel moeten via de volledige dispatchketen (resolveTaskGridCommand → dispatchDataGridKeyCommand)
// `unhandled` opleveren, zodat `preventDefault`/`stopPropagation` NIET worden aangeroepen en de
// native browserfocusverplaatsing kan doorgaan.
{
  const taskRows: ViewRow[] = ['ta', 'tb'].map(id => ({
    kind: 'task', rowKey: id, task: { id } as Task, depth: 0, dimmed: false,
  }));
  const columns = [taskColumnId('name'), taskColumnId('duration')];
  const rowIndex = createTaskGridRowIndex(taskRows);
  const resolve = (activeCell: { rowKey: string; columnId: typeof columns[number] }, shiftKey: boolean) =>
    resolveTaskGridCommand({
      event: { key: 'Tab', shiftKey },
      mode: 'select',
      active: activeCell,
      rowIndex,
      columns,
      rowHeight: 36,
      viewportHeight: 72,
      isReadOnly: () => false,
    });

  const lastCellCommand = resolve({ rowKey: 'tb', columnId: columns[1] }, false);
  const lastCellEvent = new Event('keydown', { cancelable: true }) as Event & { key: string };
  Object.defineProperty(lastCellEvent, 'key', { value: 'Tab' });
  let lastCellHandled = false;
  const lastCellDispatched = dispatchDataGridKeyCommand(
    lastCellEvent as unknown as React.KeyboardEvent<HTMLDivElement>,
    lastCellCommand,
    () => { lastCellHandled = true; },
  );
  eq('Tab op de laatste cel resolvet naar unhandled', lastCellCommand.kind, 'unhandled');
  eq('Tab op de laatste cel wordt niet gedispatcht', lastCellDispatched, false);
  eq('Tab op de laatste cel roept preventDefault niet aan', lastCellEvent.defaultPrevented, false);
  eq('Tab op de laatste cel stopt de bubbel niet', lastCellEvent.cancelBubble, false);
  eq('Tab op de laatste cel roept onCommand niet aan', lastCellHandled, false);

  const firstCellCommand = resolve({ rowKey: 'ta', columnId: columns[0] }, true);
  const firstCellEvent = new Event('keydown', { cancelable: true }) as Event & { key: string };
  Object.defineProperty(firstCellEvent, 'key', { value: 'Tab' });
  let firstCellHandled = false;
  const firstCellDispatched = dispatchDataGridKeyCommand(
    firstCellEvent as unknown as React.KeyboardEvent<HTMLDivElement>,
    firstCellCommand,
    () => { firstCellHandled = true; },
  );
  eq('Shift+Tab op de eerste cel resolvet naar unhandled', firstCellCommand.kind, 'unhandled');
  eq('Shift+Tab op de eerste cel wordt niet gedispatcht', firstCellDispatched, false);
  eq('Shift+Tab op de eerste cel roept preventDefault niet aan', firstCellEvent.defaultPrevented, false);
  eq('Shift+Tab op de eerste cel stopt de bubbel niet', firstCellEvent.cancelBubble, false);
  eq('Shift+Tab op de eerste cel roept onCommand niet aan', firstCellHandled, false);
}

// Napunt 1 (onafhankelijke eindreview op b0107289): Escape in selectiemodus moet BEIDE doen —
// de grid geeft zijn eigen exit-to-container-commando (focus naar de gridcontainer) én laat het
// event doorbubbelen naar de globale `edit.deselect`-sneltoets (deselectAll, traceMode/
// showDependencyMode uit). De eerdere fix riep onvoorwaardelijk preventDefault+stopPropagation
// aan voor elk afgehandeld commando, waardoor de globale poort (`shouldHandleGlobalShortcutEvent`,
// die `!event.defaultPrevented` toetst) Escape nooit meer bereikte zolang een gridcel focus had.
{
  const taskRows: ViewRow[] = ['ta', 'tb'].map(id => ({
    kind: 'task', rowKey: id, task: { id } as Task, depth: 0, dimmed: false,
  }));
  const columns = [taskColumnId('name'), taskColumnId('duration')];
  const rowIndex = createTaskGridRowIndex(taskRows);
  const escapeCommand = resolveTaskGridCommand({
    event: { key: 'Escape' },
    mode: 'select',
    active: { rowKey: 'ta', columnId: columns[0] },
    rowIndex,
    columns,
    rowHeight: 36,
    viewportHeight: 72,
    isReadOnly: () => false,
  });
  eq('Escape in selectiemodus resolvet naar exit-to-container', escapeCommand.kind, 'exit-to-container');

  const escapeEvent = new Event('keydown', { cancelable: true }) as Event & { key: string };
  Object.defineProperty(escapeEvent, 'key', { value: 'Escape' });
  let gridHandledCount = 0;
  const escapeDispatched = dispatchDataGridKeyCommand(
    escapeEvent as unknown as React.KeyboardEvent<HTMLDivElement>,
    escapeCommand,
    () => { gridHandledCount++; },
  );
  eq('Escape wordt als gridcommando gedispatcht (onCommand loopt, focus is de grid-eigen taak)',
    escapeDispatched, true);
  eq('De grid roept onCommand precies één keer aan voor exit-to-container', gridHandledCount, 1);
  eq('Escape roept preventDefault NIET aan (anders bereikt edit.deselect de window-listener nooit)',
    escapeEvent.defaultPrevented, false);
  eq('Escape stopt de bubbel NIET (moet naar de globale Escape-listener doorlopen)',
    escapeEvent.cancelBubble, false);
  ok('De globale sneltoetspoort ziet Escape dus als onafgehandeld en mag doorgaan',
    shouldHandleGlobalShortcutEvent(escapeEvent as unknown as KeyboardEvent));

  // Einde-tot-einde: de ECHTE `edit.deselect`-entry uit het register tegen een echte store met
  // een echte selectie en actieve trace-/dependency-modus, zodat het volledige globale effect
  // (niet alleen "wordt niet tegengehouden") aantoonbaar nog steeds afvuurt.
  const deselectEntry = SHORTCUTS.find(entry => entry.id === 'edit.deselect');
  if (!deselectEntry) {
    failures.push('edit.deselect ontbreekt in SHORTCUTS — kan het globale Escape-effect niet bewijzen');
    checks++;
  } else {
    useAppStore.getState().newProject();
    const taskId = useAppStore.getState().addTask({ name: 'Escape-doel' });
    useAppStore.getState().selectTask(taskId, false);
    useAppStore.getState().setUI({ showDependencyMode: true, traceMode: 'both' });
    eq('Vóór Escape: taak is geselecteerd', useAppStore.getState().selectedTaskIds.length, 1);
    deselectEntry.run(useAppStore.getState());
    eq('edit.deselect (via de globale bubbel) heft de selectie op', useAppStore.getState().selectedTaskIds.length, 0);
    eq('edit.deselect zet showDependencyMode weer uit', useAppStore.getState().ui.showDependencyMode, false);
    eq('edit.deselect zet traceMode weer uit', useAppStore.getState().ui.traceMode, 'off');
  }
}

if (failures.length > 0) {
  console.error(`FAIL keyboard-event-routing: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK keyboard-event-routing: ${checks}/${checks}`);
