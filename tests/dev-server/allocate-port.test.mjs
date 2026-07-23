import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocatePort } from '../../scripts/dev-port.mjs';

function wt(name) {
  const root = join(mkdtempSync(join(tmpdir(), 'ops-alloc-')), name);
  mkdirSync(join(root, '.claude'), { recursive: true });
  return root;
}
function deps({ paths }) {
  return {
    listPaths: () => paths,
    portFree: async () => true,      // niets gebonden
    lock: async (_root, fn) => fn(), // geen echte flock
  };
}
test('idempotent: bestaande opsDevPort wordt teruggegeven zonder toewijzen', async () => {
  const root = wt('a');
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({ opsDevPort: 3050 }));
  assert.equal(await allocatePort(root, deps({ paths: [root] })), 3050);
  rmSync(join(root, '..'), { recursive: true, force: true });
});
test('kiest de laagste vrije poort en legt opsDevPort + configurations[dev].port vast', async () => {
  const root = wt('b');
  assert.equal(await allocatePort(root, deps({ paths: [root] })), 3007);
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  assert.equal(json.opsDevPort, 3007);
  assert.equal(json.configurations.find((c) => c.name === 'dev').port, 3007);
  rmSync(join(root, '..'), { recursive: true, force: true });
});
test('vermijdt poorten die al door een sibling-worktree geclaimd zijn', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeFileSync(join(sib, '.claude', 'launch.json'), JSON.stringify({ opsDevPort: 3007 }));
  assert.equal(await allocatePort(me, deps({ paths: [me, sib] })), 3008);
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});
test('behoudt een bestaande preview-configuratie bij het stempelen', async () => {
  const root = wt('c');
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({
    version: '0.0.1',
    configurations: [
      { name: 'dev', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 3007 },
      { name: 'preview', runtimeExecutable: 'npm', runtimeArgs: ['run', 'preview'], port: 4173 },
    ],
  }));
  await allocatePort(root, deps({ paths: [root] }));
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  const prev = json.configurations.find((c) => c.name === 'preview');
  assert.ok(prev);
  assert.equal(prev.port, 4173);
  rmSync(join(root, '..'), { recursive: true, force: true });
});

test('herstelt een onbruikbare (array) launch.json naar een geldig object met opsDevPort', async () => {
  const root = wt('d');
  writeFileSync(join(root, '.claude', 'launch.json'), '[1,2,3]');
  const port = await allocatePort(root, deps({ paths: [root] }));
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  assert.equal(Array.isArray(json), false);
  assert.equal(json.opsDevPort, port);
  assert.equal(json.configurations.find((c) => c.name === 'dev').port, port);
  rmSync(join(root, '..'), { recursive: true, force: true });
});
