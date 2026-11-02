// Alleen de CI-smoketest; spreekt de openbare MCP-interface van de echte AppImage.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const [mode, out, extra] = process.argv.slice(2);
const marker = 'SIGTERM-herstelproef-753';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(root, e.name)) : [join(root, e.name)]);
}
if (mode === 'recovery') {
  const files = walk(extra).filter(p => p.endsWith('.ifc'));
  assert.ok(files.some(p => readFileSync(p, 'utf8').includes(marker)), 'laatste taakbewerking ontbreekt in het herstelbestand na SIGTERM');
  writeFileSync(join(out, 'herstel.txt'), 'OK laatste niet-opgeslagen taak staat in een IFC-herstelbestand\n');
} else if (mode === 'memory') {
  const pids = [Number(extra)];
  for (let i = 0; i < pids.length; i++) {
    const path = `/proc/${pids[i]}/task/${pids[i]}/children`;
    if (existsSync(path)) pids.push(...readFileSync(path, 'utf8').trim().split(/\s+/).filter(Boolean).map(Number));
  }
  const pss = pids.reduce((total, pid) => total + Number(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+)/m)?.[1] ?? 0), 0);
  assert.ok(pss > 0);
  writeFileSync(join(out, 'geheugen.md'), `Geheugen zonder geopend bestand: **${(pss / 1024).toFixed(1)} MiB PSS** (${pids.length} processen, gedeelde pagina's proportioneel geteld).\n`);
} else {
  const url = `http://127.0.0.1:${process.env.OPENAEC_MCP_POORT}/mcp`;
  const authorization = `Bearer ${process.env.OPENAEC_MCP_GEHEIM}`;
  let session;
  let id = 0;
  async function request(method, params = {}) {
    const response = await fetch(url, {
      method: 'POST', headers: { authorization, 'content-type': 'application/json', ...(session ? { 'Mcp-Session-Id': session } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    session = response.headers.get('Mcp-Session-Id') ?? session;
    const body = await response.json();
    assert.equal(body.error, undefined, JSON.stringify(body.error));
    return body.result;
  }
  let connected = false;
  for (let i = 0; i < 150; i++) {
    try { await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'openaec-linux-ci', version: '1' } }); connected = true; break; }
    catch { await delay(200); }
  }
  assert.ok(connected, 'AppImage-MCP startte niet op de opgegeven poort');
  const tools = await request('tools/list');
  assert.ok(tools.tools.some(t => t.name === 'planner_list_tasks'));
  for (const origin of ['', 'https://ongewenst.example']) {
    const response = await fetch(url, { method: 'POST', headers: { authorization, origin }, body: '{}', signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 403, 'iedere Origin-header moet worden geweigerd');
  }
  assert.equal((await fetch(url, { method: 'POST', body: '{}', signal: AbortSignal.timeout(5000) })).status, 401);
  async function tool(name, args = {}) {
    const response = await request('tools/call', { name, arguments: args });
    const result = response.structuredContent ?? JSON.parse(response.content.find(c => c.type === 'text').text);
    return result;
  }
  let tasks;
  for (let i = 0; i < 100; i++) {
    tasks = await tool('planner_list_tasks');
    if (tasks.ok && (mode === 'idle' || tasks.data.total > 0)) break;
    // Echte toetsactie: een verse Linux-gebruiker sluit het gewone welkomstvenster met Escape.
    if (tasks.error?.code === 'DIALOG_OPEN') execFileSync('wtype', ['-k', 'Escape']);
    await delay(200);
  }
  assert.equal(tasks.ok, true, JSON.stringify(tasks));
  if (mode === 'idle') assert.equal(tasks.data.total, 0, 'rustmeting vereist een sessie zonder bestand');
  else {
    assert.ok(tasks.data.total > 0, 'startbestand is niet via de normale openroute geladen');
    const changed = await tool('planner_add_tasks', { tasks: [{ tempId: 'tmp-sigterm', name: marker, duration: 1 }] });
    assert.equal(changed.ok, true, JSON.stringify(changed));
  }
  writeFileSync(join(out, `${mode}-mcp.txt`), `OK MCP-authenticatie, Origin-weigering en ${tasks.data.total} taken\n`);
}
