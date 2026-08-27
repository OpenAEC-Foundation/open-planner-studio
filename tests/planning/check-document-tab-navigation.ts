// Documenttab-navigatie (X11): twaalf projecten moeten via de zichtbare tabstrip bereikbaar
// blijven. Deze check bewaakt de pure kern die DocumentTabBar werkelijk gebruikt voor
// pijlnavigatie én het naar beeld brengen van de actieve tab.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloseDocumentDialogControl } from '@/components/layout/DocumentChrome/CloseDocumentDialogControl';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { DocumentTabControl } from '@/components/layout/DocumentChrome/DocumentTabControl';
import {
  DOCUMENT_TABPANEL_ID,
  documentTabCloseFocusTarget,
  documentTabId,
  documentTabKeyDestination,
  handleDocumentTabKeyDown,
  revealDocumentTab,
} from '@/components/layout/DocumentChrome/documentTabNavigation';
import {
  documentTabFocusTargetOutsideOverview,
  projectOverviewCloseButtonId,
  projectOverviewCloseFocusTarget,
} from '@/components/layout/DocumentChrome/projectOverviewFocus';

// shortcutRegistry importeert de i18n-config, die bij initialisatie document/localStorage leest.
// Zet alleen voor deze headless check het minimale DOM-contract neer vóór de dynamische import;
// de productiehelpers zelf blijven DOM-vrij.
Object.assign(globalThis, {
  document: { documentElement: {} },
  localStorage: { getItem: () => null, setItem: () => undefined },
});
const { SHORTCUTS, matchesCombo } = await import('@/hooks/keyboard/shortcutRegistry');

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const ids = Array.from({ length: 12 }, (_, index) => `doc-${index + 1}`);

// Tab 10–12 mogen geen onbereikbare staart van een Ctrl/Cmd-1..9-reeks zijn.
eq('LTR tab 9 → pijltje rechts bereikt tab 10', documentTabKeyDestination(ids, 'doc-9', 'ArrowRight', 'ltr'), 'doc-10');
eq('LTR tab 10 → pijltje rechts bereikt tab 11', documentTabKeyDestination(ids, 'doc-10', 'ArrowRight', 'ltr'), 'doc-11');
eq('LTR tab 11 → pijltje rechts bereikt tab 12', documentTabKeyDestination(ids, 'doc-11', 'ArrowRight', 'ltr'), 'doc-12');
eq('LTR tab 12 → pijltje rechts wrapt naar tab 1', documentTabKeyDestination(ids, 'doc-12', 'ArrowRight', 'ltr'), 'doc-1');
eq('LTR tab 1 → pijltje links wrapt naar tab 12', documentTabKeyDestination(ids, 'doc-1', 'ArrowLeft', 'ltr'), 'doc-12');
eq('RTL pijltje rechts gaat naar de vorige tab', documentTabKeyDestination(ids, 'doc-6', 'ArrowRight', 'rtl'), 'doc-5');
eq('RTL pijltje links gaat naar de volgende tab', documentTabKeyDestination(ids, 'doc-6', 'ArrowLeft', 'rtl'), 'doc-7');
eq('Home bereikt bewust de eerste tab in RTL', documentTabKeyDestination(ids, 'doc-11', 'Home', 'rtl'), 'doc-1');
eq('End bereikt bewust de laatste tab in RTL', documentTabKeyDestination(ids, 'doc-2', 'End', 'rtl'), 'doc-12');
eq('andere toets verandert de actieve tab niet', documentTabKeyDestination(ids, 'doc-10', 'Enter', 'ltr'), null);
eq('een niet-bestaande actieve id veroorzaakt geen gok', documentTabKeyDestination(ids, 'verdwenen', 'ArrowRight', 'ltr'), null);

// Volledig eventcontract dat DocumentTabBar rechtstreeks gebruikt. Een guard in de component
// vanaf index 9 moet deze reeks niet buiten de geteste productiehandler kunnen afkappen.
function runTabKey(
  cardId: string,
  key: string,
  direction: 'ltr' | 'rtl',
  sameTarget = true,
): { result: string | null; effects: string[] } {
  const effects: string[] = [];
  const currentTarget = {};
  const result = handleDocumentTabKeyDown(
    {
      key,
      target: sameTarget ? currentTarget : {},
      currentTarget,
      preventDefault: () => { effects.push('preventDefault'); },
    },
    ids,
    cardId,
    direction,
    {
      switchTo: (id) => { effects.push(`switch:${id}`); },
      focusTab: (id) => { effects.push(`focus:${id}`); },
    },
  );
  return { result, effects };
}

eq('component-event LTR 9 → 10 voert prevent/switch/focus uit', runTabKey('doc-9', 'ArrowRight', 'ltr'), {
  result: 'doc-10', effects: ['preventDefault', 'switch:doc-10', 'focus:doc-10'],
});
eq('component-event LTR 10 → 11 voert prevent/switch/focus uit', runTabKey('doc-10', 'ArrowRight', 'ltr'), {
  result: 'doc-11', effects: ['preventDefault', 'switch:doc-11', 'focus:doc-11'],
});
eq('component-event LTR 11 → 12 voert prevent/switch/focus uit', runTabKey('doc-11', 'ArrowRight', 'ltr'), {
  result: 'doc-12', effects: ['preventDefault', 'switch:doc-12', 'focus:doc-12'],
});
eq('component-event LTR 12 → 1 wrapt volledig', runTabKey('doc-12', 'ArrowRight', 'ltr'), {
  result: 'doc-1', effects: ['preventDefault', 'switch:doc-1', 'focus:doc-1'],
});
eq('component-event RTL 9 → 10 gebruikt ArrowLeft', runTabKey('doc-9', 'ArrowLeft', 'rtl'), {
  result: 'doc-10', effects: ['preventDefault', 'switch:doc-10', 'focus:doc-10'],
});
eq('component-event RTL 12 → 1 wrapt met ArrowLeft', runTabKey('doc-12', 'ArrowLeft', 'rtl'), {
  result: 'doc-1', effects: ['preventDefault', 'switch:doc-1', 'focus:doc-1'],
});
eq('child-event wordt niet als tabtoets afgehandeld', runTabKey('doc-9', 'ArrowRight', 'ltr', false), {
  result: null, effects: [],
});

// Ctrl/Cmd-contract: dit is bewust een aparte sectie van pijlnavigatie. Alleen 1–9 zijn globale
// sneltoetsen; tab 10–12 zijn via de tablist bereikbaar, niet via een verzonnen Ctrl/Cmd+10.
const documentShortcuts = SHORTCUTS.filter(shortcut => shortcut.id.startsWith('nav.switchDocument'));
eq('Ctrl/Cmd-contract bevat precies negen entries', documentShortcuts.length, 9);
eq('Ctrl/Cmd-contract is exact 1–9', documentShortcuts.map(shortcut => shortcut.combo.key), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
eq('Ctrl+1 matcht de eerste entry', matchesCombo({ key: '1', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false } as KeyboardEvent, documentShortcuts[0]?.combo), true);
eq('Cmd+1 matcht de eerste entry', matchesCombo({ key: '1', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false } as KeyboardEvent, documentShortcuts[0]?.combo), true);
eq('Ctrl+10 heeft geen entry', documentShortcuts.some(shortcut => shortcut.combo.key === '10'), false);

// Close-focuskern: focus ontstaat pas wanneer de aangevraagde id in de nieuwe, gecommitteerde
// kaartenlijst verdwenen is. Daardoor zijn schoon sluiten en dirty save/don't-save gelijkwaardig,
// terwijl annuleren geen focusbeweging veroorzaakt.
const before = [{ id: 'doc-1', isActive: true }, { id: 'doc-2', isActive: false }];
eq('schoon actief sluiten focust het nieuwe actieve document', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  [{ id: 'doc-2', isActive: true }],
  'doc-1',
), 'doc-2');
eq('schoon inactief sluiten behoudt focus op het actieve document', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  [{ id: 'doc-1', isActive: true }],
  'doc-2',
), 'doc-1');
eq('dirty save focust pas na verdwijnen van het document', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  [{ id: 'doc-2', isActive: true }],
  'doc-1',
), 'doc-2');
eq('dirty dont-save focust pas na verdwijnen van het document', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  [{ id: 'doc-2', isActive: true }],
  'doc-1',
), 'doc-2');
eq('cancel verplaatst de focus niet', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  before,
  'doc-1',
), null);
eq('laatste document focust het nieuw aangemaakte actieve document', documentTabCloseFocusTarget(
  ['doc-1'],
  [{ id: 'doc-new', isActive: true }],
  'doc-1',
), 'doc-new');
eq('onbekende verwijdering veroorzaakt geen focusgok', documentTabCloseFocusTarget(
  before.map(doc => doc.id),
  [{ id: 'doc-2', isActive: true }],
  null,
), null);

// Overzicht-focuspolicy: bij een gecommitteerde verwijdering blijft focus in de zichtbare overlay.
// Dezelfde index wint, anders de vorige; een vervangend vers document is de nieuwe kaart op index 0.
eq('overview schoon actief sluiten focust dezelfde zichtbare index', projectOverviewCloseFocusTarget(
  ['doc-1', 'doc-2', 'doc-3'], ['doc-1', 'doc-3'], 'doc-2',
), 'doc-3');
eq('overview schoon inactief sluiten focust dezelfde zichtbare index', projectOverviewCloseFocusTarget(
  ['doc-1', 'doc-2', 'doc-3'], ['doc-1', 'doc-3'], 'doc-2',
), 'doc-3');
eq('overview dirty save focust na commit dezelfde index', projectOverviewCloseFocusTarget(
  ['doc-1', 'doc-2', 'doc-3'], ['doc-1', 'doc-3'], 'doc-2',
), 'doc-3');
eq('overview dirty dont-save focust na commit vorige bij laatste index', projectOverviewCloseFocusTarget(
  ['doc-1', 'doc-2', 'doc-3'], ['doc-1', 'doc-2'], 'doc-3',
), 'doc-2');
eq('overview Cancel verschuift niets zolang kaart blijft bestaan', projectOverviewCloseFocusTarget(
  ['doc-1', 'doc-2', 'doc-3'], ['doc-1', 'doc-2', 'doc-3'], 'doc-2',
), null);
eq('overview laatste document focust vervangende nieuwe kaart', projectOverviewCloseFocusTarget(
  ['doc-1'], ['doc-new'], 'doc-1',
), 'doc-new');
eq('tabbar claimt geen verborgen closefocus onder het overzicht', documentTabFocusTargetOutsideOverview(
  true, 'doc-3',
), null);
eq('tabbar claimt closefocus zonder overzicht wel', documentTabFocusTargetOutsideOverview(
  false, 'doc-3',
), 'doc-3');
eq('overview-sluitknop-id is stabiel', projectOverviewCloseButtonId('doc-3'), 'ops-overview-close-doc-3');

eq('stabiele tabpanel-id', DOCUMENT_TABPANEL_ID, 'ops-document-tabpanel');
eq('tab-id gebruikt de stabiele document-id-afleiding', documentTabId('doc-7'), 'ops-document-tab-doc-7');

const calls: ScrollIntoViewOptions[] = [];
revealDocumentTab({ scrollIntoView: (options?: ScrollIntoViewOptions) => { calls.push(options ?? {}); } });
eq('actieve tab wordt minimaal in beide richtingen naar beeld gebracht', calls, [{ block: 'nearest', inline: 'nearest' }]);

// Kleinste passende renderharness: React render-to-string test de geproduceerde interactieve DOM
// zonder een nieuw testframework. Toetsnavigatie en focusdoel hierboven gebruiken de letterlijke
// productiehelpers; de browserproef dekt vervolgens echte events, focus en scroll.
const renderedTab = renderToStaticMarkup(createElement(DocumentTabControl, {
  card: {
    id: 'doc-7', title: 'Project zeven', fileName: null, code: 'PZ', color: '#123456',
    isActive: true, isDirty: true, taskCount: 0, milestoneCount: 0, criticalCount: 0,
    endDate: null, thumb: [],
  },
  index: 6,
  closeLabel: 'Sluiten',
  tabRef: null,
  onSelect: () => undefined,
  onKeyDown: () => undefined,
  onClose: () => undefined,
}));
eq('gerenderde tab heeft stabiel id en geselecteerde roving-tabindex', /id="ops-document-tab-doc-7"[^>]*role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"/.test(renderedTab), true);
eq('gerenderde tab koppelt aan het tabpanel', /role="tab"[^>]*aria-controls="ops-document-tabpanel"/.test(renderedTab), true);
eq('gerenderde tabnaam bevat geen sluitnaam', /role="tab"[^>]*aria-label="Project zeven"/.test(renderedTab), true);
eq('gerenderde sluitknop is een sibling van de tab', /role="tab"[\s\S]*?<\/button><button[^>]*class="ops-tab-close"[^>]*aria-label="Sluiten Project zeven"/.test(renderedTab), true);

// Productieactiehelper: de test voert de echte branches uit; callbacks leggen alleen de zichtbare
// store-/focus-effecten vast. Een verkeerde Cancel/Discard-branch kan daardoor niet groen blijven.
function closeActionHarness(options?: {
  pendingId?: string;
  activeId?: string;
  save?: (setDirty: (dirty: boolean) => void) => Promise<void>;
}) {
  const effects: string[] = [];
  let dirty = true;
  const pendingId = options?.pendingId ?? 'doc-2';
  let activeId = options?.activeId ?? 'doc-2';
  const actions = createCloseDocumentDialogActions({
    pendingId,
    getActiveDocumentId: () => activeId,
    getIsDirty: () => dirty,
    switchDocument: (id) => { activeId = id; effects.push(`switch:${id}`); },
    closeDocument: (id) => { effects.push(`close:${id}`); },
    saveFile: async () => {
      effects.push('save');
      await (options?.save?.((value) => { dirty = value; }) ?? Promise.resolve());
    },
    clearPending: () => { effects.push('clear'); },
    restoreOpenerFocus: () => { effects.push('restoreFocus'); },
  });
  return { actions, effects };
}

{
  const { actions, effects } = closeActionHarness();
  actions.cancel();
  eq('Cancel laat document open, sluit dialoog en herstelt opener', effects, ['clear', 'restoreFocus']);
}
{
  const { actions, effects } = closeActionHarness();
  actions.discard();
  eq("Don't Save gebruikt uitsluitend de discardtak", effects, ['close:doc-2', 'clear']);
}
{
  const { actions, effects } = closeActionHarness({
    activeId: 'doc-1',
    save: async (setDirty) => { setDirty(false); },
  });
  await actions.save();
  eq('dirty Save wisselt, bewaart en sluit pas na schone commit', effects, [
    'switch:doc-2', 'save', 'close:doc-2', 'clear',
  ]);
}
{
  const { actions, effects } = closeActionHarness({ save: async () => undefined });
  await actions.save();
  eq('geannuleerde Save As laat document open, sluit dialoog en herstelt opener', effects, [
    'save', 'clear', 'restoreFocus',
  ]);
}
{
  const { actions, effects } = closeActionHarness({ save: async () => { throw new Error('schrijffout'); } });
  await actions.save();
  eq('mislukte Save laat document open, sluit dialoog en herstelt opener', effects, [
    'save', 'clear', 'restoreFocus',
  ]);
}

function findControl(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (predicate(node)) return node;
  const children = node.props.children;
  const values = Array.isArray(children) ? children : [children];
  for (const child of values) {
    const found = findControl(child, predicate);
    if (found) return found;
  }
  return null;
}

const dialogEvents: string[] = [];
const dialogControl = CloseDocumentDialogControl({
  title: 'Wijzigingen opslaan?',
  body: 'Project twee bevat wijzigingen.',
  cancelLabel: 'Annuleren',
  discardLabel: 'Niet opslaan',
  saveLabel: 'Opslaan',
  cancelButtonRef: null,
  onCancel: () => { dialogEvents.push('cancel'); },
  onDiscard: () => { dialogEvents.push('discard'); },
  onSave: () => { dialogEvents.push('save'); },
});
const backdropClick = dialogControl.props.onClick as (() => void) | undefined;
backdropClick?.();
eq('werkelijke dialogbackdrop is naar Cancel bedraad', dialogEvents, ['cancel']);
dialogEvents.length = 0;
const cancelControl = findControl(dialogControl, element => element.props['data-ops-close-choice'] === 'cancel');
(cancelControl?.props.onClick as (() => void) | undefined)?.();
eq('werkelijke Cancel-knop is naar Cancel bedraad', dialogEvents, ['cancel']);
dialogEvents.length = 0;
const discardControl = findControl(dialogControl, element => element.props['data-ops-close-choice'] === 'discard');
(discardControl?.props.onClick as (() => void) | undefined)?.();
eq("werkelijke Don't Save-knop is naar discard bedraad", dialogEvents, ['discard']);
const renderedDialog = renderToStaticMarkup(createElement(CloseDocumentDialogControl, {
  title: 'Wijzigingen opslaan?', body: 'Project twee bevat wijzigingen.', cancelLabel: 'Annuleren',
  discardLabel: 'Niet opslaan', saveLabel: 'Opslaan', cancelButtonRef: null,
  onCancel: () => undefined, onDiscard: () => undefined, onSave: () => undefined,
}));
eq('gerenderde dialoog onderscheidt alle drie acties semantisch', [
  /data-ops-close-choice="cancel"/.test(renderedDialog),
  /data-ops-close-choice="discard"/.test(renderedDialog),
  /data-ops-close-choice="save"/.test(renderedDialog),
], [true, true, true]);

// Supplementaire wiring-scan: de renderharness hierboven is de componentdekking. Deze kleine
// scan bewaakt uitsluitend de App-grens, waar de gedeelde actieve werkruimte het panel daadwerkelijk
// aan de tablist hangt.
const tabControlSource = readFileSync(resolve(
  process.cwd(),
  'src/components/layout/DocumentChrome/DocumentTabControl.tsx',
), 'utf8');
eq('zichtbare tabnaam blijft decoratief naast de expliciete naam', tabControlSource.includes('className="ops-tab-name" aria-hidden="true"'), true);
const tabBarSource = readFileSync(resolve(
  process.cwd(),
  'src/components/layout/DocumentChrome/DocumentTabBar.tsx',
), 'utf8');
eq('DocumentTabBar delegeert elke tabindex zonder indexguard aan de productiehandler',
  tabBarSource.includes('onKeyDown={(event) => onTabKeyDown(event, card.id)}'), true);
eq('DocumentTabBar geeft closefocus expliciet op zolang het overzicht open is',
  tabBarSource.includes('documentTabFocusTargetOutsideOverview(\n      projectOverviewOpen,'), true);
const overviewSource = readFileSync(resolve(
  process.cwd(),
  'src/components/layout/DocumentChrome/ProjectOverview.tsx',
), 'utf8');
eq('ProjectOverview koppelt stabiele sluitknoprefs aan zijn post-close focuspolicy',
  overviewSource.includes('id={projectOverviewCloseButtonId(card.id)}')
    && overviewSource.includes('projectOverviewCloseFocusTarget('), true);
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
eq('werkruimte heeft een tabpanel', appSource.includes("role: 'tabpanel' as const"), true);
eq('werkruimte labelt zich met de actieve tab', appSource.includes("'aria-labelledby': documentTabId(activeDocumentId)"), true);

if (diffs.length > 0) {
  console.error(`document-tab-navigation: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  document-tab-navigation: alle ${checks} checks groen`);
