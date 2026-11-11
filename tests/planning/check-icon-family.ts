// B2 is de vaste iconenfamilie, ook met een oude opgeslagen keuze of ontwikkel-URL.
import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { Icon, ICON_IDS, toIconId } from '@/components/icons/Icon';
import { FEATURE_FLAGS } from '@/utils/featureFlags';
import { loadFeatureFlags } from '@/utils/settingsStore';

const manifest: string[] = JSON.parse(readFileSync('src/components/icons/b2/ids.json', 'utf8'));
assert.deepEqual([...ICON_IDS].sort(), manifest.sort());
assert.ok(!FEATURE_FLAGS.some(flag => flag.id === 'b2-icons'));
for (const stored of [false, true]) {
  localStorage.setItem('ops-featureFlags', JSON.stringify({ 'b2-icons': stored }));
  loadFeatureFlags();
  for (const id of ICON_IDS) {
    for (const size of [16, 24]) {
      const markup = renderToStaticMarkup(createElement(Icon, { id, size }));
      assert.match(markup, /class="oa-icon/);
      assert.ok(!markup.includes('lucide'), id);
      assert.ok(markup.includes(`data-icon="${id}"`), id);
      assert.ok(markup.includes('<path'), id);
      assert.ok(markup.includes(`viewBox="0 0 ${size} ${size}"`), id);
      assert.match(markup, /aria-hidden="true"/);
      if (size === 24) assert.match(markup, /oa-icon__m16/);
    }
  }
}
for (const props of [{ title: 'Taak toevoegen' }, { 'aria-label': 'Toevoegen' }, { 'aria-labelledby': 'taaklabel' }]) {
  const markup = renderToStaticMarkup(createElement(Icon, { id: 'task.add', ...props }));
  assert.match(markup, /role="img"/);
  assert.ok(!markup.includes('aria-hidden="true"'));
}
assert.match(renderToStaticMarkup(createElement(Icon, { id: 'task.add', size: 14, className: 'example', style: { color: 'red' }, title: 'Taak toevoegen' })), /<title>Taak toevoegen<\/title>/);
assert.equal(toIconId('task.add'), 'task.add');
assert.equal(toIconId('onbekend'), undefined);
console.log(`B2 standaard: ${ICON_IDS.length} iconen, twee maten en oude opgeslagen keuzes gecontroleerd.`);
// Net als de andere rendererchecks expliciet afsluiten na alle assertions.
process.exit(0);
