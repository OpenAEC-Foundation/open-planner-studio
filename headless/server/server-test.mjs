#!/usr/bin/env node
// Regressietest van de server zelf (naast smoke.mjs, die het contract van buitenaf toetst). Start
// server.mjs als kindproces met kleine grenzen en controleert de randgevallen uit review #442:
//
//   1. een onleesbaar request-target (`GET //[`) geeft 400 en stopt het proces niet;
//   2. uploads boven `maxUploads` krijgen METEEN 503 BUSY, vóór de body; het geheugen (RSS) blijft
//      begrensd en /healthz meldt de lopende uploads;
//   3. een tweede verzoek tijdens een berekening krijgt meteen 503 BUSY;
//   4. tekst uit het IFC-bestand (een relatie-id met merkteken) komt niet in stdout/stderr;
//   5. een body die niet op tijd binnenkomt geeft 408 UPLOAD_TIMEOUT (headersTimeout ≤ requestTimeout);
//   6. SIGTERM tijdens een upload: het verzoek krijgt nog antwoord, het proces stopt met exit 0.
//
//   node headless/server/server-test.mjs        # vraagt `npm run build:core` + npm install hier
// Alleen Linux voor de RSS-meting (/proc); elders wordt die stap overgeslagen.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TOKEN = 'server-test-token-0123456789';
const MARKER = 'CONFIDENTIAL_MARKER';
const MAX_BODY = 1024 * 1024;
let failures = 0;
let checks = 0;
const ok = (label, condition, detail = '') => {
  checks++;
  if (condition) console.log(`OK  ${label}`);
  else { failures++; console.log(`XX  ${label}${detail ? ` — ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [join(here, 'server.mjs')], {
    env: {
      PATH: process.env.PATH, OPS_API_TOKEN: TOKEN, HOST: '127.0.0.1', PORT: '0',
      OPS_API_MAX_BODY_BYTES: String(MAX_BODY), OPS_API_MAX_UPLOADS: '2', OPS_API_TIMEOUT_MS: '20000',
      OPS_API_UPLOAD_TIMEOUT_MS: '2000', ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = { stdout: '', stderr: '' };
  child.stdout.on('data', (d) => { out.stdout += d; });
  child.stderr.on('data', (d) => { out.stderr += d; });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  const port = new Promise((resolve, reject) => {
    const t = setInterval(() => {
      const m = /"msg":"listening".*?"port":(\d+)/.exec(out.stdout);
      if (m) { clearInterval(t); resolve(Number(m[1])); }
      if (child.exitCode !== null) { clearInterval(t); reject(new Error(`server stopte: ${out.stderr}${out.stdout}`)); }
    }, 20);
  });
  return { child, out, exited, port };
}

/** Rauw HTTP via een socket; geeft de eerste antwoordregel terug (of null na `ms`). */
function rawRequest(port, text, { ms = 3000, keepOpen = false } = {}) {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1');
    let data = '';
    const timer = setTimeout(() => resolve({ status: null, socket }), ms);
    socket.on('data', (d) => {
      data += d;
      if (data.includes('\r\n\r\n')) {
        clearTimeout(timer);
        const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(data)?.[1] ?? 0);
        if (!keepOpen) socket.destroy();
        resolve({ status, data, socket });
      }
    });
    socket.on('error', () => { clearTimeout(timer); resolve({ status: -1, data, socket }); });
    socket.write(text);
  });
}
const postHead = (port, length, extra = '') =>
  `POST /v1/schedule HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAuthorization: Bearer ${TOKEN}\r\n` +
  `Content-Type: application/x-step\r\nContent-Length: ${length}\r\n${extra}\r\n`;
const rssKb = (pid) => {
  const path = `/proc/${pid}/status`;
  if (!existsSync(path)) return null;
  return Number(/VmRSS:\s+(\d+)/.exec(readFileSync(path, 'utf8'))?.[1] ?? 0);
};
const health = async (port) => (await fetch(`http://127.0.0.1:${port}/healthz`)).json();

const example = readFileSync(join(here, '..', '..', 'examples', '01-grachtenpand-amsterdam.ifc'), 'utf8');
const markerIfc = readFileSync(join(here, 'fixtures', 'log-marker.ifc'), 'utf8');
ok('0 de fixture bevat het merkteken', markerIfc.includes(MARKER));

const srv = startServer();
try {
  const port = await srv.port;

  // 1. Onleesbaar request-target.
  const bad = await rawRequest(port, 'GET //[ HTTP/1.1\r\nHost: x\r\n\r\n');
  ok('1 GET //[ → 400', bad.status === 400, String(bad.status));
  await sleep(100);
  ok('1a het proces draait nog', srv.child.exitCode === null);
  ok('1b /healthz → ok', (await health(port)).status === 'ok');

  // 2. Uploads boven maxUploads (2) krijgen meteen 503, vóór de body.
  const rssBefore = rssKb(srv.child.pid);
  const chunk = Buffer.alloc(256 * 1024, 0x20);
  const held = [];
  for (let i = 0; i < 2; i++) {
    const r = await rawRequest(port, postHead(port, MAX_BODY - 10), { ms: 300, keepOpen: true });
    r.socket.write(chunk);
    held.push(r);
  }
  ok('2 twee onafgemaakte uploads blijven open (geen antwoord)', held.every((r) => r.status === null), held.map((r) => r.status).join(','));
  const h2 = await health(port);
  ok('2a /healthz meldt 2 lopende uploads', h2.uploads === 2, JSON.stringify(h2));
  const extra = [];
  for (let i = 0; i < 30; i++) {
    const r = await rawRequest(port, postHead(port, MAX_BODY - 10), { ms: 2000, keepOpen: true });
    r.socket.write(chunk);
    extra.push(r);
  }
  ok('2b 30 extra uploads krijgen meteen 503', extra.every((r) => r.status === 503), extra.map((r) => r.status).join(','));
  ok('2c met code BUSY en Retry-After', extra[0].data?.includes('"BUSY"') && /Retry-After: 5/i.test(extra[0].data ?? ''));
  await sleep(300);
  const rssAfter = rssKb(srv.child.pid);
  if (rssBefore !== null && rssAfter !== null) {
    // Begrensd: hooguit 2 × 1 MiB aan body, plus ruimte voor sockets en GC-schommeling.
    ok('2d RSS groeit hooguit 48 MiB', rssAfter - rssBefore < 48 * 1024, `${rssBefore} → ${rssAfter} kB`);
  }
  for (const r of [...held, ...extra]) r.socket.destroy();
  await sleep(200);
  ok('2e na het afbreken: 0 uploads', (await health(port)).uploads === 0);

  // 3. Tweede verzoek tijdens een berekening.
  const first = fetch(`http://127.0.0.1:${port}/v1/schedule`, {
    method: 'POST', body: markerIfc, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/x-step' },
  });
  let busySeen = false;
  for (let i = 0; i < 400 && !busySeen; i++) {
    busySeen = (await health(port)).busy === true;
    if (!busySeen) await sleep(2);
  }
  ok('3 /healthz meldt busy tijdens de berekening', busySeen);
  if (busySeen) {
    const second = await fetch(`http://127.0.0.1:${port}/v1/schedule`, {
      method: 'POST', body: example, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/x-step' },
    });
    const body = await second.json();
    ok('3a tweede verzoek → meteen 503 BUSY', second.status === 503 && body.error?.code === 'BUSY', `${second.status} ${JSON.stringify(body)}`);
  }
  const firstRes = await first;
  const firstBody = await firstRes.json();
  ok('3b het eerste verzoek slaagt', firstRes.status === 200, String(firstRes.status));

  // 4. Het merkteken uit het bestand staat in het antwoord, maar niet in de logs.
  ok('4 de kern meldt de genegeerde relatie (de worker heeft dus gelogd)',
    firstBody.warnings?.some((w) => w.code === 'RELATION_IGNORED' && w.ids.some((id) => id.includes(MARKER))), JSON.stringify(firstBody.warnings));
  await sleep(100);
  ok('4a stdout bevat het merkteken niet', !srv.out.stdout.includes(MARKER));
  ok('4b stderr bevat het merkteken niet en is leeg', !srv.out.stderr.includes(MARKER) && srv.out.stderr === '', srv.out.stderr.slice(0, 200));
  const nonJson = srv.out.stdout.split('\n').filter((l) => l && !l.startsWith('{'));
  ok('4c elke stdout-regel is JSON', nonJson.length === 0, nonJson.slice(0, 2).join(' | '));

  // 5. Body komt niet op tijd (uploadtijd 2 s in deze test).
  const t0 = Date.now();
  const slow = await rawRequest(port, `${postHead(port, 1000)}ISO-10303-21;`, { ms: 6000 });
  ok('5 onafgemaakte body → 408 binnen de uploadtijd', slow.status === 408 && slow.data.includes('UPLOAD_TIMEOUT') && Date.now() - t0 < 4000,
    `${slow.status} na ${Date.now() - t0} ms`);

  // 6. SIGTERM tijdens een upload.
  const body = Buffer.from(example);
  const pending = await rawRequest(port, postHead(port, body.length), { ms: 200, keepOpen: true });
  pending.socket.write(body.subarray(0, 1000));
  srv.child.kill('SIGTERM');
  await sleep(200);
  const answer = new Promise((resolve) => {
    let data = '';
    pending.socket.on('data', (d) => { data += d; if (/\r\n\r\n/.test(data)) resolve(data); });
    pending.socket.on('close', () => resolve(data));
  });
  pending.socket.write(body.subarray(1000));
  const reply = await answer;
  ok('6 de upload tijdens SIGTERM krijgt nog 200', /^HTTP\/1\.1 200/.test(reply), reply.slice(0, 80));
  const code = await srv.exited;
  ok('6a het proces stopt met exit 0', code === 0, String(code));
  ok('6b de log meldt een nette stop', srv.out.stdout.includes('"msg":"stopped","clean":true'), srv.out.stdout.split('\n').slice(-3).join(' | '));
} catch (err) {
  failures++;
  console.log(`XX  de test brak af: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  if (srv.child.exitCode === null) srv.child.kill('SIGKILL');
}

console.log(failures === 0 ? `GROEN — ${checks} servertests` : `ROOD — ${failures} van ${checks} servertests faalden`);
process.exit(failures === 0 ? 0 : 1);
