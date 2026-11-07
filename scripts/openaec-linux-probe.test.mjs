// Gebruik de echte proef tegen een kleine HTTP-dubbel met het openbare McpToolErr-formaat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';

async function runProbe(dialog, file = false) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-linux-probe-'));
  const actions = join(dir, 'toetsen.log');
  const out = join(dir, 'uitvoer');
  const workspace = join(dir, 'openaec');
  const source = join(workspace, 'plannen/proef é.ifc');
  const recovery = join(dir, 'data');
  const checkpoint = join(recovery, 'recovery.snapshot.fixture.1.ifc');
  mkdirSync(out);
  mkdirSync(join(workspace, 'plannen'), { recursive: true });
  mkdirSync(recovery);
  writeFileSync(source, 'oorspronkelijk startbestand');
  writeFileSync(join(dir, 'wtype'), `#!/bin/sh
printf "%s\\n" "$*" >> "$OPS_TEST_ACTIONS"
if [ "$*" = '-M ctrl -k s -m ctrl' ]; then
  test -f "$OPS_TEST_CHECKPOINT" || exit 42
  printf '%s' 'Checkpoint-voor-SIGTERM-753' > "$OPS_TEST_SOURCE"
fi
`, { mode: 0o700 });
  let toolCalls = 0;
  let checkpointTimer;
  const tasks = file ? [{ id: 'oorspronkelijk', name: 'Bestaande taak' }] : [];
  const server = createServer((req, res) => {
    if (req.headers.origin !== undefined) { res.writeHead(403).end(); return; }
    if (req.headers.authorization !== 'Bearer synthetisch-voor-smoketest-1234567890') { res.writeHead(401).end(); return; }
    let input = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { input += chunk; });
    req.on('end', () => {
      const request = JSON.parse(input);
      let result;
      if (request.method === 'initialize') {
        result = { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test', version: '1' } };
      } else if (request.method === 'tools/list') {
        result = { tools: [{ name: 'planner_list_tasks' }] };
      } else {
        toolCalls++;
        // Het welkom verdwijnt pas na de echte wtype-aanroep van het proefscript. In het andere
        // scenario verdwijnt de vraag door de fixture zelf, zonder een automatische toetsactie.
        const blocked = dialog ? (dialog === 'showWelcomeDialog' ? !existsSync(actions) : toolCalls === 1) : false;
        const name = request.params.name;
        if (!blocked && name === 'planner_add_tasks') {
          const seed = request.params.arguments.tasks[0].name;
          tasks.push({ id: 'toegevoegd', name: seed });
          // Een gewone opstart-update kan de eerste dirty-save achter de 10s-throttle zetten.
          // Vijf seconden is bewust langer dan de oorspronkelijke vierseconden-aanname.
          checkpointTimer = setTimeout(() => writeFileSync(checkpoint, seed), 5000);
        }
        if (!blocked && name === 'planner_update_tasks') {
          tasks.find(t => t.id === 'toegevoegd').name = request.params.arguments.updates[0].fields.name;
        }
        const toolResult = blocked
          ? { ok: false, code: 'DIALOG_OPEN', error: `A dialog is open (${dialog}); close it first before the AI reads the schedule.`, envelope: {} }
          : { ok: true, data: { tasks, total: tasks.length }, envelope: {} };
        result = { structuredContent: toolResult, content: [{ type: 'text', text: JSON.stringify(toolResult) }], isError: blocked };
      }
      res.writeHead(200, { 'content-type': 'application/json', 'Mcp-Session-Id': 'synthetische-sessie' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
    });
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const mode = file ? 'file' : 'idle';
    const child = spawn(process.execPath, ['scripts/openaec-linux-probe.mjs', mode, out], {
      env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, OPS_TEST_ACTIONS: actions,
        OPS_TEST_CHECKPOINT: checkpoint, OPS_TEST_SOURCE: source,
        OPENAEC_MAP: workspace, XDG_DATA_HOME: recovery,
        OPENAEC_MCP_POORT: String(address.port), OPENAEC_MCP_GEHEIM: 'synthetisch-voor-smoketest-1234567890' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), file ? 10000 : 3000);
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    }).finally(() => clearTimeout(timer));
    const keys = existsSync(actions) ? readFileSync(actions, 'utf8').trim().split('\n') : [];
    assert.ok(toolCalls > 0, 'de proef moet werkelijk een toolresultaat hebben ontvangen');
    assert.equal(code, 0, `de proef mislukte (${mode}, ${dialog ?? 'geen dialoog'}): ${output}`);
    assert.ok(existsSync(join(out, `${mode}-mcp.txt`)), 'de proef moet zijn succesvolle controle vastleggen');
    return keys;
  } finally {
    clearTimeout(checkpointTimer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('de Linux-proef leest de bovenliggende DIALOG_OPEN-code en sluit het welkom met Escape', async () => {
  assert.deepEqual(await runProbe('showWelcomeDialog'), ['-k Escape']);
});

test('de Linux-proef sluit geen andere dialoogvraag met een automatische Escape', async () => {
  assert.deepEqual(await runProbe('pendingIfcSchemaQuestion'), []);
});

test('de Linux-proef wacht het eerste checkpoint af als de opstartfase de herstelthrottle al activeerde', async () => {
  assert.deepEqual(await runProbe(null, true), ['-M ctrl -k s -m ctrl']);
});
