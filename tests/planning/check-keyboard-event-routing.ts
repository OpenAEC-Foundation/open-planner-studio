import './domStub';
import { shouldHandleGlobalShortcutEvent, shouldYieldClipboardShortcutToTaskGrid } from '@/hooks/keyboard/useKeyboardShortcuts';
import {
  dispatchDataGridKeyCommand,
  shouldHandleDataGridClipboardEvent,
  synchronizeDataGridScrollPosition,
} from '@/components/task-grid/DataGridCore';

const failures: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
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

if (failures.length > 0) {
  console.error(`FAIL keyboard-event-routing: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK keyboard-event-routing: ${checks}/${checks}`);
