// Gebruik de echte proef tegen een kleine HTTP-dubbel met het openbare McpToolErr-formaat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';

async function runProbe(dialog) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-linux-probe-'));
  const actions = join(dir, 'toetsen.log');
  const out = join(dir, 'uitvoer');
  mkdirSync(out);
  writeFileSync(join(dir, 'wtype'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$OPS_TEST_ACTIONS"\n', { mode: 0o700 });
  let toolCalls = 0;
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
        const blocked = dialog === 'showWelcomeDialog' ? !existsSync(actions) : toolCalls === 1;
        const toolResult = blocked
          ? { ok: false, code: 'DIALOG_OPEN', error: `A dialog is open (${dialog}); close it first before the AI reads the schedule.`, envelope: {} }
          : { ok: true, data: { tasks: [], total: 0 }, envelope: {} };
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
    const child = spawn(process.execPath, ['scripts/openaec-linux-probe.mjs', 'idle', out], {
      env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, OPS_TEST_ACTIONS: actions,
        OPENAEC_MCP_POORT: String(address.port), OPENAEC_MCP_GEHEIM: 'synthetisch-voor-smoketest-1234567890' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    }).finally(() => clearTimeout(timer));
    const keys = existsSync(actions) ? readFileSync(actions, 'utf8').trim().split('\n') : [];
    assert.ok(toolCalls > 0, 'de proef moet werkelijk een toolresultaat hebben ontvangen');
    assert.equal(code, 0, `de proef bleef vaststaan op ${dialog}: ${output}`);
    assert.ok(existsSync(join(out, 'idle-mcp.txt')), 'de proef moet zijn succesvolle controle vastleggen');
    return keys;
  } finally {
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
