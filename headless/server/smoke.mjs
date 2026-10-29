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

const [baseArg, token] = process.argv.slice(2);
if (!baseArg || !token) {
  console.error('usage: node smoke.mjs <baseUrl> <token>');
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(here, '..', '..', 'examples', '01-grachtenpand-amsterdam.ifc');
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
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* geen JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}
const isError = (r, code) => r.json?.error?.code === code && typeof r.json.error.message === 'string';
const IFC = { 'Content-Type': 'application/x-step' };

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
