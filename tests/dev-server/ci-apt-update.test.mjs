import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = readFileSync(new URL('../../scripts/ci-apt-update.sh', import.meta.url), 'utf8');
const original = '# fixture\ndeb [signed-by=/key] mirror+file:/etc/apt/apt-mirrors.txt jammy main\ndeb https://example.invalid jammy main\n';
for (const [name, first, second, expected] of [
  ['officieel bereikbaar', 0, 0, 0],
  ['DNS-fout, mirror bereikbaar', 100, 0, 0],
  ['timeout, mirror bereikbaar', 124, 0, 0],
  ['beide onbereikbaar', 100, 100, 1],
  ['onbekende bronindeling', 0, 0, 1],
]) {
  test(`CI APT: ${name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-apt-'));
    try {
      const sources = join(dir, 'sources.list');
      const initial = name === 'onbekende bronindeling' ? 'deb https://other.invalid jammy main\n' : original;
      writeFileSync(sources, initial);
      // Geen root, netwerk of host-APT: echte bronwissel met nagebootste sudo/timeout/apt-get.
      writeFileSync(join(dir, 'sudo'), '#!/bin/bash\nexec "$@"\n', { mode: 0o755 });
      writeFileSync(join(dir, 'timeout'), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$FIXTURE/timeout.log"\nshift 3\nexec "$@"\n', { mode: 0o755 });
      writeFileSync(join(dir, 'apt-get'), `#!/bin/bash
printf '%s\n' "$*" >> "$FIXTURE/apt.log"
if grep -q archive.ubuntu.com "$FIXTURE/sources.list"; then exit ${first}; else exit ${second}; fi
`, { mode: 0o755 });
      const result = spawnSync('bash', ['-e', '-c', script.replace('sources=/etc/apt/sources.list', `sources='${sources}'`)], {
        encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FIXTURE: dir },
      });
      assert.equal(result.status, expected, result.stdout + result.stderr);
      const after = readFileSync(sources, 'utf8');
      assert.equal(after, first === 0 && expected === 0 ? original.replace('mirror+file:/etc/apt/apt-mirrors.txt', 'https://archive.ubuntu.com/ubuntu/') : initial);
      if (name === 'onbekende bronindeling') {
        assert.match(result.stdout, /Onverwachte APT-bronnen/);
      } else {
        const calls = readFileSync(join(dir, 'apt.log'), 'utf8').trim().split('\n');
        assert.equal(calls.length, first === 0 ? 1 : 2);
        for (const call of calls) assert.match(call, /Acquire::Retries=1.*Acquire::http::Timeout=15.*Acquire::https::Timeout=15 --error-on=any update$/);
        assert.match(readFileSync(join(dir, 'timeout.log'), 'utf8'), /--verbose --kill-after=10s 2m apt-get/);
        assert.match(result.stdout, expected === 1 ? /runner-mirrors ook mislukt/ : first === 0 ? /gekozen: officieel/ : /gekozen: oorspronkelijke/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('build en Playwright kiezen dezelfde APT-route vóór installatie', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(workflow.match(/bash scripts\/ci-apt-update.sh/g)?.length, 2);
  assert.match(workflow, /bash scripts\/ci-apt-update.sh[\s\S]*?apt-get[^\n]*install -y libwebkit/);
  assert.match(workflow, /Select reachable APT source for Playwright[\s\S]*?bash scripts\/ci-apt-update.sh\s+- name: Install Playwright Chromium\s+run: npx playwright install --with-deps --only-shell chromium/);
});
