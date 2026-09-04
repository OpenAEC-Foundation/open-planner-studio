import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseFreePort,
  chooseFreePortFor,
  PORT_LANES,
  MIN_PORT,
  MAX_PORT,
} from '../../scripts/dev-port.mjs';

test('browserlane start op 3107 en blijft los van het devbereik', () => {
  assert.deepEqual(PORT_LANES.browser, {
    min: 3107,
    max: 3206,
    marker: 'opsBrowserTestPort',
  });
  assert.equal(chooseFreePortFor('browser', new Set(), () => false), 3107);
});

test('kiest MIN_PORT als niets geclaimd of gebonden is', () => {
  assert.equal(chooseFreePort(new Set(), () => false), MIN_PORT);
});
test('slaat geclaimde poorten over', () => {
  assert.equal(chooseFreePort(new Set([3007, 3008]), () => false), 3009);
});
test('slaat gebonden poorten over', () => {
  assert.equal(chooseFreePort(new Set(), (p) => p === 3007), 3008);
});
test('combineert geclaimd én gebonden', () => {
  assert.equal(chooseFreePort(new Set([3007]), (p) => p === 3008), 3009);
});
test('gooit als het hele bereik vol is', () => {
  const full = new Set();
  for (let p = MIN_PORT; p <= MAX_PORT; p++) full.add(p);
  assert.throws(() => chooseFreePort(full, () => false), /Geen vrije/);
});
