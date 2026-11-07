// De release begint met de oude Lucide-vormen. B2 blijft een opt-in via de bestaande vlagopslag.
import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { Icon, ICON_IDS } from '@/components/icons/Icon';
import { LUCIDE_ICONS } from '@/components/icons/lucideMapping';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/utils/featureFlags';
import { loadFeatureFlags } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { useAppStore } from '@/state/appStore';

assert.equal(isFeatureEnabled(useAppStore.getState().ui.featureFlags, 'b2-icons'), false);
const manifest: string[] = JSON.parse(readFileSync('src/components/icons/b2/ids.json', 'utf8'));
assert.deepEqual(Object.keys(LUCIDE_ICONS).sort(), [...ICON_IDS].sort(), 'elk gegenereerd id heeft precies één Lucide-regel');
assert.deepEqual(Object.keys(LUCIDE_ICONS).sort(), manifest.sort(), 'ook de bronlijst is volledig gedekt');
for (const id of ICON_IDS) {
  const markup = renderToStaticMarkup(createElement(Icon, { id }));
  assert.match(markup, /class="lucide[^\"]*oa-icon/, id);
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
assert.match(labelled, /oa-icon example text-critical/);
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
