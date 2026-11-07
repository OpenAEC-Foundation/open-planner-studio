// Alleen de CI-smoketest; spreekt de openbare MCP-interface van de echte AppImage.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  let rssFallback = 0;
  const pss = pids.reduce((total, pid) => {
    try { return total + Number(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+)/m)?.[1] ?? 0); }
    catch {
      // Een niet-dumpbaar sandboxproces laat smaps niet lezen; benoem de ruimere RSS-terugval.
      const path = `/proc/${pid}/status`;
      if (!existsSync(path)) return total;
      rssFallback++;
      return total + Number(readFileSync(path, 'utf8').match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
    }
  }, 0);
  assert.ok(pss > 0);
  writeFileSync(join(out, 'geheugen.md'), `Geheugen zonder geopend bestand: **${(pss / 1024).toFixed(1)} MiB** (${pids.length} processen, PSS; RSS-terugval voor ${rssFallback} processen zonder leesbare smaps).\n`);
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
    if (tasks.code === 'DIALOG_OPEN' && typeof tasks.error === 'string' && tasks.error.includes('(showWelcomeDialog)')) {
      execFileSync('wtype', ['-k', 'Escape']);
    }
    await delay(200);
  }
  assert.equal(tasks.ok, true, JSON.stringify(tasks));
  if (mode === 'idle') assert.equal(tasks.data.total, 0, 'rustmeting vereist een sessie zonder bestand');
  else {
    assert.ok(tasks.data.total > 0, 'startbestand is niet via de normale openroute geladen');
    const seed = 'Checkpoint-voor-SIGTERM-753';
    const added = await tool('planner_add_tasks', { tasks: [{ tempId: 'tmp-sigterm', name: seed, duration: 1 }] });
    assert.equal(added.ok, true, JSON.stringify(added));
    // Opstart-/UI-wijzigingen kunnen de 10s-throttle al hebben gestart vóór de eerste dirty-taak.
    // Wacht één heel interval plus schrijfmarge op het checkpoint; wijzig daarna pas opnieuw.
    let checkpoint = false;
    for (let i = 0; i < 150; i++) {
      if (existsSync(process.env.XDG_DATA_HOME)) {
        checkpoint = walk(process.env.XDG_DATA_HOME).filter(p => p.endsWith('.ifc'))
          .some(p => readFileSync(p, 'utf8').includes(seed));
      }
      if (checkpoint) break;
      await delay(100);
    }
    if (!checkpoint) {
      const root = process.env.XDG_DATA_HOME;
      writeFileSync(join(out, 'checkpoint-diagnose.json'), JSON.stringify({
        documents: await tool('planner_list_documents'),
        recoveryFiles: existsSync(root) ? walk(root).filter(p => /recovery\.[^/]+$/.test(p)).map(p => relative(root, p)) : [],
      }, null, 2));
    }
    assert.ok(checkpoint, 'periodieke herstelopslag leverde binnen 15 seconden geen eerste checkpoint');
    // De echte Ctrl+S-route schrijft buiten HOME naar OPENAEC_MAP, zonder de MCP-padgrens te verruimen.
    execFileSync('wtype', ['-M', 'ctrl', '-k', 's', '-m', 'ctrl']);
    const source = join(process.env.OPENAEC_MAP, 'plannen/proef é.ifc');
    let saved = false;
    for (let i = 0; i < 40; i++) {
      saved = readFileSync(source, 'utf8').includes(seed);
      if (saved) break;
      await delay(100);
    }
    assert.ok(saved, 'Ctrl+S heeft het startbestand in OPENAEC_MAP niet opgeslagen');
    const listed = await tool('planner_list_tasks', { limit: 1000 });
    const task = listed.data.tasks.find(t => t.name === seed);
    assert.ok(task);
    const changed = await tool('planner_update_tasks', { updates: [{ id: task.id, fields: { name: marker } }] });
    assert.equal(changed.ok, true, JSON.stringify(changed));
    const current = await tool('planner_list_tasks', { limit: 1000 });
    assert.ok(current.data.tasks.some(t => t.name === marker), 'de laatste taakbewerking moet werkelijk zijn toegepast');
    assert.ok(!walk(process.env.XDG_DATA_HOME).filter(p => p.endsWith('.ifc'))
      .some(p => readFileSync(p, 'utf8').includes(marker)), 'de laatste wijziging moet nog binnen de throttle wachten op SIGTERM');
  }
  writeFileSync(join(out, `${mode}-mcp.txt`), `OK MCP-authenticatie, Origin-weigering en ${tasks.data.total} taken\n`);
}
