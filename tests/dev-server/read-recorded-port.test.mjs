import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRecordedPort } from '../../scripts/dev-port.mjs';

function fixture(launchJson) {
  const root = mkdtempSync(join(tmpdir(), 'ops-rrp-'));
  mkdirSync(join(root, '.claude'));
  if (launchJson !== undefined) writeFileSync(join(root, '.claude', 'launch.json'), launchJson);
  return root;
}
test('leest opsDevPort als geldig getal in bereik', () => {
  const root = fixture(JSON.stringify({ opsDevPort: 3042, configurations: [] }));
  assert.equal(readRecordedPort(root), 3042);
  rmSync(root, { recursive: true, force: true });
});
test('negeert het configurations[].port-veld (template-3007) zonder opsDevPort', () => {
  const root = fixture(JSON.stringify({ configurations: [{ name: 'dev', port: 3007 }] }));
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});
test('ontbrekend bestand → null (gooit niet)', () => {
  const root = fixture(undefined);
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});
test('kapotte JSON → null (gooit niet)', () => {
  const root = fixture('{ niet-json');
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});
test('opsDevPort buiten bereik → null', () => {
  const root = fixture(JSON.stringify({ opsDevPort: 9999 }));
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});
test('root === null → null', () => {
  assert.equal(readRecordedPort(null), null);
});
