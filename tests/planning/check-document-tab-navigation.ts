// Documenttab-navigatie (X11): twaalf projecten moeten via de zichtbare tabstrip bereikbaar
// blijven. Deze check bewaakt de pure kern die DocumentTabBar werkelijk gebruikt voor
// pijlnavigatie én het naar beeld brengen van de actieve tab.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentTabControl } from '@/components/layout/DocumentChrome/DocumentTabControl';
import {
  DOCUMENT_TABPANEL_ID,
  documentTabCloseFocusTarget,
  documentTabId,
  documentTabKeyDestination,
  revealDocumentTab,
} from '@/components/layout/DocumentChrome/documentTabNavigation';

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

// Supplementaire wiring-scan: de renderharness hierboven is de componentdekking. Deze kleine
// scan bewaakt uitsluitend de App-grens, waar de gedeelde actieve werkruimte het panel daadwerkelijk
// aan de tablist hangt.
const tabControlSource = readFileSync(resolve(
  process.cwd(),
  'src/components/layout/DocumentChrome/DocumentTabControl.tsx',
), 'utf8');
eq('zichtbare tabnaam blijft decoratief naast de expliciete naam', tabControlSource.includes('className="ops-tab-name" aria-hidden="true"'), true);
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
eq('werkruimte heeft een tabpanel', appSource.includes("role: 'tabpanel' as const"), true);
eq('werkruimte labelt zich met de actieve tab', appSource.includes("'aria-labelledby': documentTabId(activeDocumentId)"), true);

if (diffs.length > 0) {
  console.error(`document-tab-navigation: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  document-tab-navigation: alle ${checks} checks groen`);
