// Documenttab-navigatie (X11): twaalf projecten moeten via de zichtbare tabstrip bereikbaar
// blijven. Deze check bewaakt de pure kern die DocumentTabBar werkelijk gebruikt voor
// pijlnavigatie én het naar beeld brengen van de actieve tab.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  documentTabKeyDestination,
  revealDocumentTab,
} from '@/components/layout/DocumentChrome/documentTabNavigation';

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
eq('tab 9 → pijltje rechts bereikt tab 10', documentTabKeyDestination(ids, 'doc-9', 'ArrowRight'), 'doc-10');
eq('tab 10 → pijltje rechts bereikt tab 11', documentTabKeyDestination(ids, 'doc-10', 'ArrowRight'), 'doc-11');
eq('tab 11 → pijltje rechts bereikt tab 12', documentTabKeyDestination(ids, 'doc-11', 'ArrowRight'), 'doc-12');
eq('tab 12 → pijltje rechts wrapt naar tab 1', documentTabKeyDestination(ids, 'doc-12', 'ArrowRight'), 'doc-1');
eq('tab 1 → pijltje links wrapt naar tab 12', documentTabKeyDestination(ids, 'doc-1', 'ArrowLeft'), 'doc-12');
eq('Home bereikt de eerste tab', documentTabKeyDestination(ids, 'doc-11', 'Home'), 'doc-1');
eq('End bereikt de twaalfde tab', documentTabKeyDestination(ids, 'doc-2', 'End'), 'doc-12');
eq('andere toets verandert de actieve tab niet', documentTabKeyDestination(ids, 'doc-10', 'Enter'), null);
eq('een niet-bestaande actieve id veroorzaakt geen gok', documentTabKeyDestination(ids, 'verdwenen', 'ArrowRight'), null);
eq('cijfer 10 is geen verborgen sneltoets', documentTabKeyDestination(ids, 'doc-10', '10'), null);

const calls: ScrollIntoViewOptions[] = [];
revealDocumentTab({ scrollIntoView: (options?: ScrollIntoViewOptions) => { calls.push(options ?? {}); } });
eq('actieve tab wordt minimaal in beide richtingen naar beeld gebracht', calls, [{ block: 'nearest', inline: 'nearest' }]);

// Dit project heeft geen DOM-testframework. Bewaak daarom de kleine structurele ARIA-grens op de
// echte componentbron: een interactieve sluitknop mag geen descendant van role=tab zijn, en de
// tabnaam moet expliciet zijn zodat een wijziging aan de sluitknop hem niet kan vervuilen.
const tabBarSource = readFileSync(resolve(
  process.cwd(),
  'src/components/layout/DocumentChrome/DocumentTabBar.tsx',
), 'utf8');
eq('documenttab is een native button', tabBarSource.includes('<button\n                ref={(element) => {'), true);
eq('documenttab heeft een expliciete toegankelijke naam', tabBarSource.includes('aria-label={card.title}'), true);
eq('zichtbare tabnaam is decoratief naast de expliciete naam', tabBarSource.includes('className="ops-tab-name" aria-hidden="true"'), true);
eq('sluitknop staat buiten de tab-button', /role="tab"[\s\S]*?<\/button>\s*<button[\s\S]*?className="ops-tab-close"/.test(tabBarSource), true);
eq('tabgroep is presentational voor de tablist', tabBarSource.includes('className="ops-tab-group"\n              role="presentation"'), true);

if (diffs.length > 0) {
  console.error(`document-tab-navigation: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  document-tab-navigation: alle ${checks} checks groen`);
