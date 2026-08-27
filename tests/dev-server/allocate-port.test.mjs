import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  allocateNamedPort,
  allocatePort,
  MIN_PORT,
  MAX_PORT,
  stampLaunchJson,
} from '../../scripts/dev-port.mjs';

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
/** deps + een teller op `stamp`, zodat een test kan eisen dat er NIET gestempeld wordt. */
function spyDeps({ paths, portFree = async () => true }) {
  const calls = [];
  return {
    calls,
    deps: {
      listPaths: () => paths,
      portFree,
      lock: async (_root, fn) => fn(),
      stamp: (root, port) => { calls.push([root, port]); stampLaunchJson(root, port); },
    },
  };
}
function stampOf(root) {
  return JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8')).opsDevPort;
}
function writeStamp(root, port) {
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({ opsDevPort: port }));
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

test('twee worktrees krijgen verschillende poorten binnen de browserlane', async () => {
  const first = wt('browser-a');
  const second = wt('browser-b');
  const d = deps({ paths: [first, second] });

  assert.equal(await allocateNamedPort(first, 'browser', d), 3107);
  assert.equal(await allocateNamedPort(second, 'browser', d), 3108);

  const firstJson = JSON.parse(readFileSync(join(first, '.claude', 'launch.json'), 'utf8'));
  const secondJson = JSON.parse(readFileSync(join(second, '.claude', 'launch.json'), 'utf8'));
  assert.equal(firstJson.opsBrowserTestPort, 3107);
  assert.equal(secondJson.opsBrowserTestPort, 3108);
  rmSync(join(first, '..'), { recursive: true, force: true });
  rmSync(join(second, '..'), { recursive: true, force: true });
});

test('browserstempel laat bestaande devmarker en devconfiguratie inhoudelijk intact', async () => {
  const root = wt('lanes');
  const devConfiguration = {
    name: 'dev',
    runtimeExecutable: 'npm',
    runtimeArgs: ['run', 'dev', '--', '--host'],
    port: 3042,
    extra: { behouden: true },
  };
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({
    version: '0.0.1',
    opsDevPort: 3042,
    configurations: [devConfiguration],
  }));

  assert.equal(await allocateNamedPort(root, 'browser', deps({ paths: [root] })), 3107);
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  assert.equal(json.opsDevPort, 3042);
  assert.deepEqual(json.configurations[0], devConfiguration);
  assert.equal(json.opsBrowserTestPort, 3107);
  rmSync(join(root, '..'), { recursive: true, force: true });
});

// --- botsende stempels: het defect dat twee worktrees op poort 3010 zette ---

test('botsing: twee worktrees met dezelfde stempel → wij wijken uit naar een vrije poort', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeStamp(me, 3010);
  writeStamp(sib, 3010);
  const { calls, deps: d } = spyDeps({ paths: [me, sib] });

  const port = await allocatePort(me, d);

  assert.notEqual(port, 3010, 'de botsende poort mag niet opnieuw uitgedeeld worden');
  assert.equal(port, MIN_PORT, 'de laagste vrije poort is 3007');
  assert.equal(stampOf(me), port, 'de nieuwe poort moet vastgelegd zijn');
  assert.deepEqual(calls, [[me, port]], 'precies één keer stempelen');
  assert.equal(stampOf(sib), 3010, 'de andere worktree behoudt zijn stempel');
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});

test('convergentie: na herstel blijft de nieuwe poort staan bij een tweede aanroep', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeStamp(me, 3010);
  writeStamp(sib, 3010);
  const { calls, deps: d } = spyDeps({ paths: [me, sib] });

  const first = await allocatePort(me, d);
  const second = await allocatePort(me, d);

  assert.equal(second, first, 'geen ping-pong: dezelfde poort terug');
  assert.equal(calls.length, 1, 'de tweede aanroep mag niet opnieuw stempelen');
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});

test('geen churn: een unieke stempel wordt teruggegeven zonder opnieuw te stempelen', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeStamp(me, 3050);
  writeStamp(sib, 3051);
  const { calls, deps: d } = spyDeps({ paths: [me, sib] });

  assert.equal(await allocatePort(me, d), 3050);
  assert.deepEqual(calls, [], 'stamp mag niet aangeroepen worden');
  assert.equal(stampOf(me), 3050);
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});

// DE VALKUIL — deze test bestaat om te voorkomen dat iemand "slim" op bezetting
// gaat herstellen. Onze eigen draaiende dev-server bindt onze eigen poort (en
// allocatePort draait in tauri-dev.mjs vóór acquireGuardLock), dus een gebonden
// poort is juist het teken van normaal gebruik, geen botsing.
test('valkuil: een unieke stempel die op dit moment GEBONDEN is blijft ongewijzigd', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeStamp(me, 3050);
  writeStamp(sib, 3051);
  const { calls, deps: d } = spyDeps({ paths: [me, sib], portFree: async () => false });

  assert.equal(await allocatePort(me, d), 3050, 'bezetting mag de eigen stempel niet afkeuren');
  assert.deepEqual(calls, [], 'stamp mag niet aangeroepen worden');
  assert.equal(stampOf(me), 3050);
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});

test('een symlink-pad naar onszelf telt niet als botsing', async () => {
  const me = wt('me');
  writeStamp(me, 3050);
  // `git worktree list` is niet realpath-genormaliseerd (denk aan /tmp → /private/tmp
  // op macOS): hetzelfde worktree kan onder een ander pad opduiken. Dat is nog
  // steeds ONSZELF en mag onze eigen stempel niet als botsing aanmerken.
  const alias = join(me, '..', 'alias');
  symlinkSync(me, alias, 'dir');
  const { calls, deps: d } = spyDeps({ paths: [alias] });

  assert.equal(await allocatePort(me, d), 3050);
  assert.deepEqual(calls, [], 'stamp mag niet aangeroepen worden');
  rmSync(join(me, '..'), { recursive: true, force: true });
});

test('geen vrije poort meer → begrijpelijke fout in plaats van een willekeurige poort', async () => {
  const me = wt('vol');
  const sib = wt('sib');
  writeStamp(me, 3010);
  writeStamp(sib, 3010); // botsing → herstelpad in
  // alles in het bereik is gebonden
  const { calls, deps: d } = spyDeps({ paths: [me, sib], portFree: async () => false });

  await assert.rejects(
    () => allocatePort(me, d),
    (err) => {
      assert.match(err.message, /Geen vrije dev-poort in 3007-3106/);
      assert.match(err.message, /vol/); // de worktree-naam staat erbij
      return true;
    },
  );
  assert.deepEqual(calls, [], 'bij een fout mag er niets gestempeld worden');
  assert.equal(stampOf(me), 3010, 'de oude stempel blijft staan');
  assert.equal(MAX_PORT, 3106);
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
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
