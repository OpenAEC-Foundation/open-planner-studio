#!/usr/bin/env node
// Smoke-test van de headless API tegen een draaiende server (lokaal, container of AWS).
//
//   node headless/server/smoke.mjs <baseUrl> <token>
//   node headless/server/smoke.mjs https://planner-api.example.org "$OPS_API_TOKEN"
//
// Draai hem tegen een server zonder ander verkeer: tijdens een berekening geeft de server meteen
// 503 BUSY (geen wachtrij), en dat zou hier als fout tellen.
//
// Controleert: health (zonder token), 401 zonder en met een fout token, 404, 405, 415, een
// voorbeeld-IFC doorrekenen met de verwachte uitkomst (JSON en IFC), 400 bij geen IFC, 422 bij een
// IFC zonder taken, en 413 bij een body boven de grens die /healthz meldt. Exitcode 0 = groen.
// Alleen Node 22 (fetch); geen dependencies. Het token komt nooit in de uitvoer.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerDigest, BYTES_TYPE, corpusCases, EXAMPLE, MODEL_REFUSAL_BODY, REQUESTS } from './smoke-corpus.mjs';

const [baseArg, token] = process.argv.slice(2);
if (!baseArg || !token) {
  console.error('usage: node smoke.mjs <baseUrl> <token>');
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');
const here = dirname(fileURLToPath(import.meta.url));
// Dezelfde verwachte uitkomst als scripts/verify-core-package.mjs.
const EXPECTED = { name: 'New-Build Canal House, Amsterdam', start: '2027-03-01', finish: '2028-01-12T16:00', tasks: 51 };

let failures = 0;
let checks = 0;
function ok(label, condition, detail = '') {
  checks++;
  if (condition) {
    console.log(`OK  ${label}`);
  } else {
    failures++;
    console.log(`XX  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
async function call(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const h = { ...headers };
  if (auth === true) h.Authorization = `Bearer ${token}`;
  else if (typeof auth === 'string') h.Authorization = auth;
  const res = await fetch(`${base}${path}`, { method, body, headers: h });
  const bytes = Buffer.from(await res.arrayBuffer());
  const text = bytes.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch { /* geen JSON */ }
  return { status: res.status, headers: res.headers, bytes, text, json };
}
const isError = (r, code) => r.json?.error?.code === code && typeof r.json.error.message === 'string';
const IFC = { 'Content-Type': 'application/x-step' };
const BYTES = { 'Content-Type': BYTES_TYPE };
const reference = JSON.parse(readFileSync(join(here, 'main-reference.json'), 'utf8'));
const describe = (r) => `${r.status} ${r.headers.get('content-type')}${r.status === 200 ? '' : ` ${r.text.slice(0, 160)}`}`;
const describeMain = (m) => `${m.status} ${m.type}${m.body === undefined ? '' : ` ${m.body.slice(0, 160)}`}`;
function mainError(m) {
  try { return JSON.parse(m.body ?? '').error ?? null; } catch { return null; }
}
function sameAsMain(r, main, kind, source) {
  if (r.status !== main.status || r.headers.get('content-type') !== main.type) return false;
  return main.body !== undefined ? r.text === main.body : answerDigest(r.text, kind, r.status, source) === main.sha256;
}
const mainRefusedModel = (m) => m.status === 422 && m.body === MODEL_REFUSAL_BODY;
const mainRefusedForeign = (m) => m.status === 500 && mainError(m)?.code === 'IFC_WRITE_FAILED' && mainError(m).details?.reason === 'foreign';
const EXPECTATION = {
  main: 'elk antwoord is dat van main',
  model: 'main weigert het gebouwmodel; als bytes een samenvatting en de bron byte voor byte terug',
  'model-summary': 'main weigert het gebouwmodel; als bytes een samenvatting, en bij output=ifc het antwoord van main',
  kept: 'main weigert het schrijven met foreign; als bytes de bewaarde bytes, met de planning van main',
};

async function bytesProblems(c, record) {
  const problems = [];
  const answers = [];
  for (const [path, kind] of REQUESTS) answers.push([path, kind, await call(path, { method: 'POST', body: c.body, headers: BYTES })]);
  const expect = c.expect?.kind ?? 'main';
  if (!c.expect && (mainRefusedModel(record.summary) || mainRefusedForeign(record.ifc))) {
    problems.push('main weigert hier vanwege vreemde inhoud, maar het geval heeft geen verwachte uitkomst');
  }
  const [summary, summaryAgain] = answers.filter(([, kind]) => kind === 'summary').map(([, , r]) => r);
  if (summary.text !== summaryAgain.text) problems.push('bytes: de standaardaanroep en output=summary geven een ander antwoord');
  for (const [path, kind, r] of answers) {
    const main = record[kind];
    const fail = (why) => problems.push(`bytes ${path}: ${why} (main ${describeMain(main)})`);
    const modelSummary = (expect === 'model' || expect === 'model-summary') && kind === 'summary';
    const keptOnRead = expect === 'model' && kind === 'ifc';
    const writeCase = expect === 'kept' && kind === 'ifc';
    if (!modelSummary && !keptOnRead && !writeCase) {
      if (!sameAsMain(r, main, kind, c.body)) fail(`${describe(r)} ≠ main`);
    } else if ((modelSummary || keptOnRead) && !mainRefusedModel(main)) {
      fail('main weigerde hier geen gebouwmodel');
    } else if (writeCase && !mainRefusedForeign(main)) {
      fail('main weigerde hier niet met foreign');
    } else if (modelSummary) {
      if (r.status !== 200 || !r.json?.foreignContent) fail(`geen samenvatting met foreignContent: ${describe(r)}`);
    } else if (keptOnRead || expect === 'kept') {
      if (r.status !== 200 || r.headers.get('content-type') !== 'application/octet-stream') {
        fail(`geen bewaarde bytes: ${describe(r)}`);
        continue;
      }
      if (c.expect.sameAsSource && !r.bytes.equals(c.body)) fail('de bewaarde bytes zijn niet de bron');
      const again = await call('/v1/schedule', { method: 'POST', body: r.bytes, headers: keptOnRead ? BYTES : IFC });
      if (keptOnRead ? again.text !== summary.text : !sameAsMain(again, record.summary, 'summary', c.body)) {
        fail(`opnieuw ingestuurd geven de bewaarde bytes een andere samenvatting: ${describe(again)}`);
      }
    }
  }
  return problems;
}

try {
  // 1. Health, zonder token.
  const health = await call('/healthz', { auth: false });
  ok('GET /healthz → 200 zonder token', health.status === 200 && health.json?.status === 'ok', `${health.status} ${health.text.slice(0, 200)}`);
  ok('/healthz noemt versie en grenzen', typeof health.json?.version === 'string' && Number.isInteger(health.json?.limits?.maxBodyBytes)
    && Number.isInteger(health.json?.limits?.maxUploads) && Number.isInteger(health.json?.limits?.uploadTimeoutMs)
    && typeof health.json?.busy === 'boolean', health.text.slice(0, 200));
  ok('elk antwoord heeft een X-Request-Id', !!health.headers.get('x-request-id'));
  const maxBody = health.json?.limits?.maxBodyBytes ?? 20 * 1024 * 1024;
  console.log(`    versie ${health.json?.version}, body-grens ${maxBody} bytes`);

  const example = readFileSync(EXAMPLE, 'utf8');

  // 2. Auth.
  const noToken = await call('/v1/schedule', { method: 'POST', body: example, headers: IFC, auth: false });
  ok('POST zonder token → 401', noToken.status === 401 && isError(noToken, 'UNAUTHORIZED'), `${noToken.status} ${noToken.text.slice(0, 200)}`);
  ok('401 heeft WWW-Authenticate: Bearer', noToken.headers.get('www-authenticate') === 'Bearer');
  const badToken = await call('/v1/schedule', { method: 'POST', body: example, headers: IFC, auth: 'Bearer wrong-token-0123456789' });
  ok('POST met fout token → 401', badToken.status === 401 && isError(badToken, 'UNAUTHORIZED'), String(badToken.status));

  // 3. Routes en invoertype.
  const missing = await call('/v1/does-not-exist');
  ok('onbekend pad → 404', missing.status === 404 && isError(missing, 'NOT_FOUND'), String(missing.status));
  const wrongMethod = await call('/v1/schedule');
  ok('GET /v1/schedule → 405 met Allow: POST', wrongMethod.status === 405 && isError(wrongMethod, 'METHOD_NOT_ALLOWED')
    && wrongMethod.headers.get('allow') === 'POST', String(wrongMethod.status));
  const wrongType = await call('/v1/schedule', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  ok('JSON-body → 415', wrongType.status === 415 && isError(wrongType, 'UNSUPPORTED_MEDIA_TYPE'), String(wrongType.status));
  const wrongOutput = await call('/v1/schedule?output=pdf', { method: 'POST', body: example, headers: IFC });
  ok('output=pdf → 400', wrongOutput.status === 400 && isError(wrongOutput, 'BAD_REQUEST'), String(wrongOutput.status));

  // 4. Doorrekenen: JSON-samenvatting.
  const started = Date.now();
  const summary = await call('/v1/schedule', { method: 'POST', body: example, headers: { ...IFC, 'X-Request-Id': 'smoke-test-1' } });
  ok('voorbeeld doorrekenen → 200', summary.status === 200, `${summary.status} ${summary.text.slice(0, 300)}`);
  ok('X-Request-Id wordt teruggegeven', summary.headers.get('x-request-id') === 'smoke-test-1');
  const s = summary.json;
  ok('samenvatting: formatVersion 1 en projectnaam', s?.formatVersion === 1 && s?.project?.name === EXPECTED.name, s?.project?.name);
  ok(`samenvatting: ${EXPECTED.start} → ${EXPECTED.finish}`, s?.project?.start === EXPECTED.start && s?.project?.finish === EXPECTED.finish,
    `${s?.project?.start} → ${s?.project?.finish}`);
  ok(`samenvatting: ${EXPECTED.tasks} taken`, s?.counts?.tasks === EXPECTED.tasks && s?.tasks?.length === EXPECTED.tasks, String(s?.counts?.tasks));
  console.log(`    doorgerekend in ${Date.now() - started} ms`);

  // 5. Doorrekenen: herberekende IFC.
  const ifc = await call('/v1/schedule?output=ifc', { method: 'POST', body: example, headers: IFC });
  ok('output=ifc → 200 met IFC-tekst', ifc.status === 200 && ifc.text.startsWith('ISO-10303-21;')
    && (ifc.headers.get('content-type') ?? '').startsWith('application/x-step'), `${ifc.status} ${ifc.text.slice(0, 80)}`);
  const again = await call('/v1/schedule', { method: 'POST', body: ifc.text, headers: IFC });
  ok('herberekende IFC geeft hetzelfde einde', again.status === 200 && again.json?.project?.finish === EXPECTED.finish, String(again.json?.project?.finish));

  const cases = corpusCases();
  const unrecorded = cases.filter(c => !reference.cases[c.label]).map(c => c.label);
  console.log(`    referentie van main ${reference.main}, ${cases.length} gevallen`);
  ok('de referentie van main dekt het hele corpus en niets anders', unrecorded.length === 0 && Object.keys(reference.cases).length === cases.length,
    `${unrecorded.length} ontbreken (${unrecorded.slice(0, 3).join(' | ')}), referentie ${Object.keys(reference.cases).length}, corpus ${cases.length}`);
  for (const c of cases) {
    const record = reference.cases[c.label];
    if (!record) continue;
    const problems = [];
    for (const type of c.textTypes) {
      for (const [path, kind] of REQUESTS) {
        const r = await call(path, { method: 'POST', body: c.body, headers: { 'Content-Type': type } });
        if (!sameAsMain(r, record[kind], kind, c.body)) problems.push(`${type} ${path}: ${describe(r)} ≠ main ${describeMain(record[kind])}`);
      }
    }
    problems.push(...await bytesProblems(c, record));
    ok(`${c.label}: ${EXPECTATION[c.expect?.kind ?? 'main']}`, problems.length === 0, problems.join('; '));
  }

  // 6. Ongeldige invoer.
  const notIfc = await call('/v1/schedule', { method: 'POST', body: 'dit is geen IFC', headers: { 'Content-Type': 'text/plain' } });
  ok('geen IFC → 400 INVALID_INPUT', notIfc.status === 400 && isError(notIfc, 'INVALID_INPUT'), `${notIfc.status} ${notIfc.text.slice(0, 200)}`);
  const empty = await call('/v1/schedule', { method: 'POST', body: 'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n', headers: IFC });
  ok('IFC zonder taken → 422', empty.status === 422 && (isError(empty, 'NO_TASKS') || isError(empty, 'IFC_READ_FAILED')), `${empty.status} ${empty.text.slice(0, 200)}`);

  // 7. Te grote body.
  const big = Buffer.alloc(maxBody + 1, 0x20);
  big.write('ISO-10303-21;\n');
  const tooBig = await call('/v1/schedule', { method: 'POST', body: big, headers: IFC });
  ok(`body van ${maxBody + 1} bytes → 413`, tooBig.status === 413 && isError(tooBig, 'PAYLOAD_TOO_LARGE'), `${tooBig.status} ${tooBig.text.slice(0, 200)}`);

  // 8. De server leeft nog.
  const after = await call('/healthz', { auth: false });
  ok('/healthz na de test → 200', after.status === 200);
} catch (err) {
  failures++;
  console.log(`XX  de smoke-test brak af: ${err instanceof Error ? err.message : String(err)}`);
}

console.log(failures === 0 ? `GROEN — ${checks} checks tegen ${base}` : `ROOD — ${failures} van ${checks} checks faalden tegen ${base}`);
process.exit(failures === 0 ? 0 : 1);
