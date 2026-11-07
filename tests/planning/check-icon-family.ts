// De release begint met de oude Lucide-vormen. B2 blijft een opt-in via de bestaande vlagopslag.
import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { Icon, ICON_IDS } from '@/components/icons/Icon';
import { LUCIDE_ICONS, LUCIDE_SHAPES, type LucideShape } from '@/components/icons/lucideMapping';
import type { IconId } from '@/components/icons/Icon';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/utils/featureFlags';
import { loadFeatureFlags } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { useAppStore } from '@/state/appStore';
import { HelpButton } from '@/components/common/HelpButton';
import { NoticeStrip } from '@/components/layout/NoticeStrip';

assert.equal(isFeatureEnabled(useAppStore.getState().ui.featureFlags, 'b2-icons'), false);
const manifest: string[] = JSON.parse(readFileSync('src/components/icons/b2/ids.json', 'utf8'));
assert.deepEqual(Object.keys(LUCIDE_ICONS).sort(), [...ICON_IDS].sort(), 'elk gegenereerd id heeft precies één Lucide-regel');
assert.deepEqual(Object.keys(LUCIDE_ICONS).sort(), manifest.sort(), 'ook de bronlijst is volledig gedekt');
for (const id of ICON_IDS) {
  const markup = renderToStaticMarkup(createElement(Icon, { id }));
  assert.match(markup, /class="lucide[ "]/, id);
  assert.ok(!markup.includes('oa-icon'), `zonder B2 geen B2-CSS op ${id} (zoals de mini-stand op 16 px)`);
  assert.ok(markup.includes(`data-icon="${id}"`), id);
  assert.match(markup, /stroke-width="2"/, `de oude Lucide-lijndikte voor ${id}`);
  assert.match(markup, /width="16" height="16"/, id);
  assert.match(markup, /viewBox="0 0 24 24"/, id);
  assert.match(markup, /aria-hidden="true"/, id);
  assert.ok(!markup.includes('oa-icon__m24') && !markup.includes('--icon-accent'), id);
}

const labelled = renderToStaticMarkup(createElement(Icon, {
  id: 'task.add', size: 14, className: 'example text-critical', title: 'Taak toevoegen',
  style: { color: 'red' }, 'data-example': 'behouden',
} as Parameters<typeof Icon>[0]));
assert.match(labelled, /width="14" height="14"/);
assert.match(labelled, /class="lucide [^"]* example text-critical"/);
assert.match(labelled, /style="color:red"/);
assert.match(labelled, /data-example="behouden"/);
assert.match(labelled, /<title>Taak toevoegen<\/title>/);
assert.match(labelled, /role="img"/);
assert.ok(!labelled.includes('aria-hidden="true"'));
for (const props of [{ 'aria-label': 'Toevoegen' }, { 'aria-labelledby': 'taaklabel' }]) {
  const markup = renderToStaticMarkup(createElement(Icon, { id: 'task.add', ...props }));
  assert.match(markup, /role="img"/);
  assert.ok(!markup.includes('aria-hidden="true"'));
}
const explicit = renderToStaticMarkup(createElement(Icon, { id: 'task.add', size: 24, 'aria-hidden': false }));
assert.match(explicit, /width="24" height="24"/);
assert.match(explicit, /aria-hidden="false"/);
assert.ok(!renderToStaticMarkup(createElement(Icon, { id: 'status.warning' })).includes('oa-icon--warning'),
  'Lucide erft de tekstkleur, zonder de B2-statuskleur');
assert.equal(FEATURE_FLAGS.find(flag => flag.id === 'b2-icons')?.hidden, true, 'geen zichtbare instelling');

// Zonder B2 per plek de oude vorm, maat en kleur van vóór #765 (review van Sol op #844, punt 3 en 4).
// Leest de aanroep in de bron en tekent die met dezelfde props; `lucide={{ … }}` moet een letterlijke waarde zijn.
function iconAt(file: string, id: string, nth = 0): string {
  const text = readFileSync(file, 'utf8');
  const tags = [...text.matchAll(new RegExp(`<Icon id="${id.replace('.', '\\.')}"([^>]*?)/>`, 'g'))];
  assert.ok(tags[nth], `${file}: <Icon id="${id}"> nummer ${nth + 1}`);
  const attrs = tags[nth][1];
  const props: Record<string, unknown> = { id };
  const size = /\bsize=\{(\d+)\}/.exec(attrs);
  if (size) props.size = Number(size[1]);
  const className = /\bclassName="([^"]*)"/.exec(attrs);
  if (className) props.className = className[1];
  const lucide = /\blucide=\{(\{[^}]*\})\}/.exec(attrs);
  if (lucide) props.lucide = new Function(`return (${lucide[1]});`)();
  return renderToStaticMarkup(createElement(Icon, props as unknown as Parameters<typeof Icon>[0]));
}
/** De vorm via zijn Lucide-klasse (`lucide-…`); die haalt de test uit de Lucide-vorm zelf. */
function shapeClass(markup: string): string {
  return /class="lucide (lucide-[\w-]+)/.exec(markup)?.[1] ?? '?';
}
function expectLucide(markup: string, shape: LucideShape | IconId, size: number, where: string): void {
  const Shape = shape in LUCIDE_SHAPES ? LUCIDE_SHAPES[shape as LucideShape] : LUCIDE_ICONS[shape as IconId];
  assert.equal(shapeClass(markup), shapeClass(renderToStaticMarkup(createElement(Shape))), `${where}: oude vorm ${shape}`);
  assert.match(markup, new RegExp(`width="${size}" height="${size}"`), `${where}: oude maat ${size} px`);
}
// Eén id, meerdere oude vormen: de plek houdt zijn eigen oude vorm.
expectLucide(renderToStaticMarkup(createElement(HelpButton, { articleId: 'test' })), 'CircleHelp', 16, 'HelpButton');
expectLucide(iconAt('src/components/dialogs/NewOrOpenProjectDialog.tsx', 'file.new'), 'FilePlus2', 16, 'Nieuw of openen');
expectLucide(iconAt('src/components/layout/DocumentChrome/ProjectRail.tsx', 'documents.overview'), 'LayoutGrid', 20, 'ProjectRail');
expectLucide(iconAt('src/components/panels/WarningsPanel.tsx', 'status.error'), 'OctagonAlert', 13, 'Waarschuwingen');
expectLucide(iconAt('src/components/backstage/Backstage.tsx', 'project.recent'), 'Clock', 14, 'Bestand → Recent');
// Lint: groot 20 px en klein 14 px, zoals vóór #765 (B2 tekent 24 en 16).
expectLucide(iconAt('src/components/layout/Ribbon/ribbonConfig.tsx', 'solver.run'), 'solver.run', 20, 'Berekenen');
expectLucide(iconAt('src/components/layout/Ribbon/ribbonConfig.tsx', 'task.add'), 'task.add', 20, 'Taak toevoegen');
expectLucide(iconAt('src/components/layout/Ribbon/ribbonConfig.tsx', 'edit.undo'), 'edit.undo', 14, 'Ongedaan maken in het lint');
expectLucide(iconAt('src/components/layout/Ribbon/ribbonConfig.tsx', 'wbs.auto-number'), 'wbs.auto-number', 14, 'WBS-nummering');
expectLucide(iconAt('src/components/layout/Ribbon/ribbonWidgets.tsx', 'view.zoom-in'), 'view.zoom-in', 14, 'Inzoomen');
// Kleur: het plusje bij Aantekening toevoegen erft weer de oranje tekstkleur; de modusmelding is weer oranje.
assert.ok(!iconAt('src/components/task-sections/TaskNotesFields.tsx', 'task.note-add').includes('text-text-secondary'),
  'Aantekening toevoegen: geen grijze klasse zonder B2');
const notice = renderToStaticMarkup(createElement(NoticeStrip, {
  icon: 'task.split-mode', text: 'Splitsen', actionLabel: 'Klaar', onAction: () => {},
}));
assert.match(notice, /class="lucide lucide-scissors shrink-0 text-accent"/, 'modusmelding: het oranje Lucide-icoon van vóór #765');
assert.ok(!notice.includes('text-text-secondary'), 'modusmelding: geen grijze B2-klasse');
// Met B2 telt `lucide` niet mee.
useAppStore.getState().setUI({ featureFlags: { 'b2-icons': true } });
const b2 = renderToStaticMarkup(createElement(Icon, { id: 'task.add', size: 24, lucide: { icon: 'Clock', size: 20 } }));
assert.match(b2, /width="24" height="24"/);
assert.ok(b2.includes('oa-icon__m24') && !b2.includes('lucide'), 'B2 negeert de oude Lucide-aanroep');
useAppStore.getState().setUI({ featureFlags: {} });
assert.equal(isFeatureEnabled(useAppStore.getState().ui.featureFlags, 'b2-icons'), false);

// Een nieuwe sessie leest dezelfde vlagopslag; de URL wijzigt geen andere voorkeuren.
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
function search(value: string): void {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: value } } });
}
try {
  localStorage.clear();
  search('');
  assert.deepEqual(loadFeatureFlags(), {});
  localStorage.setItem('ops-featureFlags', JSON.stringify({ 'demo-topbar-animation': true }));
  search('?icons=b2');
  const enabled = loadFeatureFlags();
  assert.equal(isFeatureEnabled(enabled, 'b2-icons'), true);
  assert.equal(enabled['demo-topbar-animation'], true);
  search('');
  assert.deepEqual(loadFeatureFlags(), enabled, 'B2 blijft aan na herladen zonder parameter');
  search('?icons=lucide');
  const disabled = loadFeatureFlags();
  assert.equal(isFeatureEnabled(disabled, 'b2-icons'), false);
  assert.equal(disabled['demo-topbar-animation'], true);
  search('');
  assert.deepEqual(loadFeatureFlags(), disabled, 'Lucide blijft aan na herladen zonder parameter');
  search('?icons=onbekend');
  assert.deepEqual(loadFeatureFlags(), disabled, 'onbekende URL-waarde wijzigt niets');
  for (const invalid of ['kapot', 'null', '[]', '{"b2-icons":"true"}']) {
    localStorage.setItem('ops-featureFlags', invalid);
    assert.equal(isFeatureEnabled(loadFeatureFlags(), 'b2-icons'), false, invalid);
  }
  // Ingebedde apps kunnen opslag weigeren. De URL blijft dan voor deze sessie werken.
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('opslag geweigerd'); } });
  search('');
  assert.deepEqual(loadFeatureFlags(), {});
  search('?icons=b2');
  assert.equal(isFeatureEnabled(loadFeatureFlags(), 'b2-icons'), true);
  // Een volle opslag kan nog wel de oude Lucide-keuze lezen. Hydratatie mag de URL niet terugdraaien.
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => key === 'ops-featureFlags' ? '{"b2-icons":false}' : null,
    setItem: () => { throw new Error('opslag vol'); },
  } });
  assert.equal(isFeatureEnabled((await loadAllSettings()).featureFlags ?? {}, 'b2-icons'), true);
} finally {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

console.log(`OK  iconen: standaard Lucide, alle ${ICON_IDS.length} ids gedekt, toegankelijkheid en blijvende URL-keuze gecontroleerd`);
process.exit(0);
