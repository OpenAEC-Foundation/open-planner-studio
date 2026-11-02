import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const yaml = readFileSync(new URL('../../.github/workflows/renderer-performance.yml', import.meta.url), 'utf8');
// Voer de echte bundelstap uit tegen kleine Git-fixtures. Alleen esbuild is vervangen door
// een teller: dit toetst de bronselectie, zonder een build of prestatiemeting te starten.
const step = yaml.slice(yaml.indexOf('      - name: Bundel dezelfde invoer'));
const block = step.match(/        run: \|\n((?:          [^\n]*\n|\n)*)/)?.[1];
assert.ok(block, 'de bundelstap bestaat');
const script = block.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');
const renderer = 'src/engine/renderer/GanttRenderer.ts';

for (const [label, files, compare] of [
  ['alleen een test', ['tests/planning/check-render-caches.ts'], false],
  ['alleen de renderer', [renderer], true],
  ['een andere productbron', ['src/other.ts'], null],
  ['renderer en andere productbron', [renderer, 'src/other.ts'], null],
]) {
  test(`renderer-meting: ${label}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'ops-renderer-scope-'));
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const put = (file, text) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
    try {
      git('init', '-q');
      git('config', 'user.email', 'tests@example.invalid');
      git('config', 'user.name', 'Test');
      put(renderer, '// basis\n');
      git('add', 'src');
      git('commit', '-qm', 'basis');
      const base = git('rev-parse', 'HEAD');
      for (const file of files) put(file, '// gewijzigde fixture\n');
      git('add', 'src', ...(files.some(file => file.startsWith('tests/')) ? ['tests'] : []));
      git('commit', '-qm', 'fixture');
      put('node_modules/.bin/esbuild', '#!/bin/sh\nprintf "bundel\\n" >> "$RUNNER_TEMP/calls"\n');
      chmodSync(join(root, 'node_modules/.bin/esbuild'), 0o755);
      const output = join(root, 'output');
      const result = spawnSync('bash', ['-c', script], { cwd: root, encoding: 'utf8', env: {
        ...process.env, PR_BASE: base, RUNNER_TEMP: root, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output,
      } });
      if (compare === null) {
        assert.notEqual(result.status, 0, 'een gecombineerde bronwijziging vraagt nog steeds een eigen meetopzet');
      } else {
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(readFileSync(output, 'utf8'), new RegExp(`^compare=${compare}$`, 'm'));
        if (compare) assert.equal(readFileSync(join(root, 'calls'), 'utf8'), 'bundel\nbundel\n');
        else assert.equal(existsSync(join(root, 'calls')), false, 'zonder productwijziging worden geen meetbundels gemaakt');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('meting en artifact-upload lopen alleen nadat de twee rendererbundels zijn gemaakt', () => {
  assert.match(yaml, /- name: Bundel dezelfde invoer[^]*?\n        id: bundle\n/);
  assert.match(yaml, /- name: Meet afwisselend[^\n]*\n        if: steps\.bundle\.outputs\.compare == 'true'/);
  assert.match(yaml, /- uses: actions\/upload-artifact@v4\n        if: always\(\) && steps\.bundle\.outputs\.compare == 'true'/);
});
