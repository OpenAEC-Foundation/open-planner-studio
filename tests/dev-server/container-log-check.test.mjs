import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Voer de ECHTE shellstap uit de workflow uit; alleen Docker is een gecontroleerde double.
const workflow = readFileSync(new URL('../../.github/workflows/headless-api.yml', import.meta.url), 'utf8');
const containerJob = workflow.split('\n  container:\n')[1];
assert.ok(containerJob, 'containerjob bestaat');
const logStep = containerJob.split('      - name: Logs bevatten geen token en geen IFC-inhoud\n')[1];
assert.ok(logStep, 'logstap bestaat');
const script = logStep.split('        run: |\n')[1].split('\n      - name:')[0]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n');

const cases = [
  ['geen container, geen token', { FAKE_NAMES: '' }, 0, /logcontrole niet uitgevoerd/],
  ['andere container is niet api', { FAKE_NAMES: 'api-old' }, 0, /logcontrole niet uitgevoerd/],
  ['Docker onbereikbaar is een fout', { FAKE_PS_FAIL: '1' }, 1, /Docker unavailable/],
  ['bestaande container zonder token', { FAKE_NAMES: 'api' }, 1, /Testtoken ontbreekt/],
  ['normale veilige log', { FAKE_NAMES: 'api', OPS_API_TOKEN: 'synthetic-test-token', FAKE_LOG: 'server ready' }, 0, /server ready/],
  ['token werkelijk in de log', { FAKE_NAMES: 'api', OPS_API_TOKEN: 'synthetic-test-token', FAKE_LOG: 'synthetic-test-token' }, 1, /token staat in de log/],
  ['IFC werkelijk in de log', { FAKE_NAMES: 'api', OPS_API_TOKEN: 'synthetic-test-token', FAKE_LOG: 'ISO-10303-21;' }, 1, /IFC-inhoud staat in de log/],
  ['log ophalen mislukt', { FAKE_NAMES: 'api', OPS_API_TOKEN: 'synthetic-test-token', FAKE_LOG_FAIL: '1' }, 1, /Containerlog kon niet worden gelezen/],
];
for (const [name, env, code, message] of cases) {
  test(`containerlog: ${name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-container-log-'));
    try {
      writeFileSync(join(dir, 'docker'), `#!/usr/bin/env bash
if [ "$1" = ps ]; then
  if [ "\${FAKE_PS_FAIL:-}" = 1 ]; then echo 'Docker unavailable' >&2; exit 1; fi
  printf '%s\\n' "\${FAKE_NAMES:-}"
elif [ "$1" = logs ]; then
  if [ "\${FAKE_LOG_FAIL:-}" = 1 ]; then exit 1; fi
  printf '%s\\n' "\${FAKE_LOG:-}"
else exit 2
fi
`, { mode: 0o755 });
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
        cwd: dir, encoding: 'utf8',
        env: { ...process.env, OPS_API_TOKEN: '', FAKE_NAMES: '', FAKE_PS_FAIL: '', FAKE_LOG: '', FAKE_LOG_FAIL: '',
          ...env, PATH: `${dir}:${process.env.PATH}` },
      });
      assert.equal(result.status, code, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, message);
      assert.doesNotMatch(result.stdout + result.stderr, /synthetic-test-token|ISO-10303-21;/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
