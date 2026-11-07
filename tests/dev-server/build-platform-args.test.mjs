// Argumenten van `scripts/build-platform.mjs` (`npm run build:platform`): het basispad.
// Draait geen build; alleen de pure functies `parseArgs` en `validateBase`.
//
// #818: het SuperCloud-contract bouwt met `--base ./` (één bundel onder elk subpad). Een absoluut
// subpad blijft werken zoals voor de Frappe-app (#307).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, validateBase } from '../../scripts/build-platform.mjs';

test('validateBase: ./ en absolute subpaden zijn goed', () => {
  for (const base of ['./', '/', '/tools/planner/', '/assets/open_aec/planner-1.2/']) {
    assert.equal(validateBase(base), null, base);
  }
});

test('validateBase: andere relatieve vormen en kapotte paden zijn fout', () => {
  for (const base of ['', '.', '..', '../', '../x/', 'x/', './/', './x/', '/tools/planner', 'tools/planner/', '/a//b/', '/a/../', '/a/./', '/a b/']) {
    assert.equal(typeof validateBase(base), 'string', JSON.stringify(base));
  }
});

test('parseArgs: --base ./ in beide vormen', () => {
  assert.deepEqual(parseArgs(['--base', './']), { base: './' });
  assert.deepEqual(parseArgs(['--base=./']), { base: './' });
  assert.ok(parseArgs([]).error);
  assert.ok(parseArgs(['--base']).error);
  assert.ok(parseArgs(['--base', '--x']).error);
});
