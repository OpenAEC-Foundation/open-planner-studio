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
import { readdirSync, readFileSync } from 'node:fs';
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
const FOREIGN_FIXTURES = join(here, '..', '..', 'tests', 'fixtures', 'ifc-foreign');
const EXAMPLE_DIRS = [join(here, '..', '..', 'examples'), join(here, '..', '..', 'public', 'examples')];
const OLD_TAGS = join(here, '..', '..', 'tests', 'planning', 'fixtures', 'oude-tags');
const PROJECT_NAME_IN_SETTINGS = join(here, '..', '..', 'tests', 'planning', 'fixtures', 'projectnaam-in-settings', 'showcase-verbouwing-eengezinswoning.ifc');
const SCHEDULE_READ_OTHERWISE = 'het voorbeeld met een leeg eigen werkschema, een baseline en een losse taak';
const NAME_READ_OTHERWISE = 'de woning met een externe pset aan het project';
const DURATION_OUTSIDE_PLANNING = 'een ongeldige duur buiten de planning die de bytes-route leest';
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
const BYTES = { 'Content-Type': 'application/octet-stream' };
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const EXTERN_PSET = "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n"
  + "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;";
const MODEL_REFUSAL = 'Could not read IFC: This IFC file contains building model objects.';
const BONSAI_WALL_A_TIME = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00',$,$,";
const BONSAI_WALL_A_STALE = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00','2026-03-02T09:00:00','2026-03-06T17:00:00',";
const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const EPOCH_SECONDS = /\b\d{10}\b/g;
const refusalOf = (r) => `${r.status} ${r.json?.error?.code}:${r.json?.error?.details?.reason}`;

function emptyOwnSchedule(source, looseTask) {
  const lines = source.split('\n');
  const schedule = lines.find(l => l.startsWith('#47=IFCWORKSCHEDULE('));
  const task = lines.find(l => l.startsWith('#52=IFCTASK('));
  const added = [schedule.replace(/^#47=IFCWORKSCHEDULE\('[^']*'/, "#99010=IFCWORKSCHEDULE('1SolR4BaselineSchema01'").replace('.PLANNED.);', '.BASELINE.);')];
  if (looseTask) added.push(task.replace(/^#52=IFCTASK\('[^']*',#6,'[^']*',\$,\$,'[^']*'/, "#99011=IFCTASK('1SolR4LooseTask0000001',#6,'Loose task',$,$,'99'"));
  const moved = lines.map(l => l.startsWith('#158=IFCRELNESTS(') ? l.replace(',#47,(', ',#99010,(')
    : l.startsWith('#312=IFCRELASSIGNSTOCONTROL(') ? l.replace(',$,#47);', ',$,#99010);') : l).join('\n');
  return Buffer.from(moved.replace('ENDSEC;\nEND-ISO-10303-21;', `${added.join('\n')}\nENDSEC;\nEND-ISO-10303-21;`));
}
function projectPset(source) {
  return Buffer.from(source.replace('ENDSEC;\nEND-ISO-10303-21;', [
    "#99020=IFCPROPERTYSINGLEVALUE('ExternalCode',$,IFCTEXT('X-1'),$);",
    "#99021=IFCPROPERTYSET('1SolR4ExternalPset0001',#6,'ExternalMetadata',$,(#99020));",
    "#99022=IFCRELDEFINESBYPROPERTIES('1SolR4ExternalRel00001',#6,$,$,(#13),#99021);",
    'ENDSEC;', 'END-ISO-10303-21;'].join('\n')));
}
function withoutWriteTime(text, from, to) {
  const now = (ms) => ms >= from - 5000 && ms <= to + 5000;
  return text.replace(ISO_TIME, t => now(Date.parse(t.endsWith('Z') ? t : `${t}Z`)) ? 'SCHRIJFTIJD' : t)
    .replace(EPOCH_SECONDS, n => now(Number(n) * 1000) ? 'SCHRIJFTIJD' : n);
}
const sameAnswer = (a, b) => a.status === b.status && a.headers.get('content-type') === b.headers.get('content-type') && a.text === b.text;
const refusedAsModel = (r) => r.status === 422 && r.json?.error?.code === 'IFC_READ_FAILED' && r.json.error.message.startsWith(MODEL_REFUSAL);
async function modelOutcome(body, asText, asBytes) {
  const ifcText = await call('/v1/schedule?output=ifc', { method: 'POST', body, headers: IFC });
  const ifcBytes = await call('/v1/schedule?output=ifc', { method: 'POST', body, headers: BYTES });
  if (!sameAnswer(ifcText, asText)) return { broken: `output=ifc als tekst wijkt af van de samenvatting als tekst: ${refusalOf(ifcText)}` };
  if (sameAnswer(asBytes, asText)) {
    return sameAnswer(ifcBytes, ifcText) ? {} : { broken: `de bytes-route las niet, maar output=ifc wijkt af van main: ${refusalOf(ifcBytes)}` };
  }
  if (asBytes.status !== 200 || !asBytes.json?.foreignContent) return { broken: `samenvatting van een model: ${asBytes.status} ${asBytes.text.slice(0, 160)}` };
  if (sameAnswer(ifcBytes, ifcText)) return { modelSummaryOnly: true };
  if (ifcBytes.status !== 200 || ifcBytes.headers.get('content-type') !== 'application/octet-stream') {
    return { broken: `output=ifc van een model: ${refusalOf(ifcBytes)} ${ifcBytes.headers.get('content-type')}` };
  }
  const reread = await call('/v1/schedule', { method: 'POST', body: ifcBytes.bytes, headers: BYTES });
  if (!sameAnswer(reread, asBytes)) return { broken: `de bewaarde bytes dragen een andere planning dan de samenvatting: ${reread.text.slice(0, 160)}` };
  return { keptModel: true, sameAsSource: ifcBytes.bytes.equals(body) };
}
async function outcomeAsBytes(body) {
  const asText = await call('/v1/schedule', { method: 'POST', body, headers: IFC });
  const asBytes = await call('/v1/schedule', { method: 'POST', body, headers: BYTES });
  if (refusedAsModel(asText)) return modelOutcome(body, asText, asBytes);
  if (!sameAnswer(asBytes, asText)) {
    return { broken: `samenvatting: tekst ${asText.status} ${asText.text.slice(0, 120)}, bytes ${asBytes.status} ${asBytes.text.slice(0, 120)}` };
  }
  const from = Date.now();
  const ifcText = await call('/v1/schedule?output=ifc', { method: 'POST', body, headers: IFC });
  const ifcBytes = await call('/v1/schedule?output=ifc', { method: 'POST', body, headers: BYTES });
  const to = Date.now();
  const seen = `tekst ${refusalOf(ifcText)} ${ifcText.headers.get('content-type')}, bytes ${refusalOf(ifcBytes)} ${ifcBytes.headers.get('content-type')}`;
  if (refusalOf(ifcText) !== '500 IFC_WRITE_FAILED:foreign') {
    const same = ifcBytes.status === ifcText.status && ifcBytes.headers.get('content-type') === ifcText.headers.get('content-type')
      && withoutWriteTime(ifcBytes.text, from, to) === withoutWriteTime(ifcText.text, from, to);
    return same ? {} : { broken: `output=ifc wijkt af van main: ${seen}` };
  }
  if (ifcBytes.status === 200) {
    if (ifcBytes.headers.get('content-type') !== 'application/octet-stream') return { broken: `bewaarde bytes met een ander type: ${seen}` };
    const reread = await call('/v1/schedule', { method: 'POST', body: ifcBytes.bytes, headers: IFC });
    return sameAnswer(reread, asText) ? { kept: true }
      : { broken: `de bewaarde bytes dragen een andere planning dan de samenvatting: ${reread.status} ${reread.text.slice(0, 160)}` };
  }
  const mainMessage = ifcText.json.error.message;
  const message = ifcBytes.json?.error?.message ?? '';
  if (refusalOf(ifcBytes) !== refusalOf(ifcText) || !message.startsWith(mainMessage)) return { broken: `een andere weigering dan main: ${seen} ${message}` };
  return message === mainMessage ? {} : { refusedWithDifference: true };
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

  const exampleBytes = readFileSync(EXAMPLE);
  const legacyPlanning = Buffer.from(example.replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));"));
  const legacyWithPset = Buffer.from(legacyPlanning.toString('utf8').replace('ENDSEC;\nEND-ISO-10303-21;', EXTERN_PSET));
  const scheduleReadOtherwise = emptyOwnSchedule(example, true);
  const eigenPlusModel = readFileSync(join(FOREIGN_FIXTURES, 'eigen-plus-model.ifc'), 'utf8');
  const nameReadOtherwise = projectPset(readFileSync(PROJECT_NAME_IN_SETTINGS, 'utf8'));
  const ifcFiles = (dir, prefix = '') => readdirSync(dir).filter(f => f.endsWith('.ifc')).sort().map(f => [`${prefix}${f}`, readFileSync(join(dir, f))]);
  const corpus = [
    ...EXAMPLE_DIRS.flatMap(dir => ifcFiles(dir)),
    ...ifcFiles(OLD_TAGS, 'oude-tags/'),
    ['een IFC2X3-planning', legacyPlanning],
    ['een IFC2X3-planning met een externe pset', legacyWithPset],
    ['het voorbeeld met een leeg eigen werkschema', emptyOwnSchedule(example, false)],
    ['het voorbeeld met een externe pset', Buffer.from(example.replace('ENDSEC;\nEND-ISO-10303-21;', EXTERN_PSET))],
    ...ifcFiles(FOREIGN_FIXTURES, 'ifc-foreign/'),
    [SCHEDULE_READ_OTHERWISE, scheduleReadOtherwise],
    [NAME_READ_OTHERWISE, nameReadOtherwise],
  ];
  const forms = [
    ['kaal', b => b],
    ['met BOM', b => Buffer.concat([UTF8_BOM, b])],
    ['met BOM en een spatie', b => Buffer.concat([UTF8_BOM, Buffer.from(' '), b])],
  ];
  const cases = [
    ...corpus.flatMap(([name, source]) => forms.map(([form, shape]) => [`${name}, ${form}`, shape(source)])),
    ['het voorbeeld met een dubbele BOM', Buffer.concat([UTF8_BOM, UTF8_BOM, exampleBytes])],
    ['het voorbeeld met een BOM na een spatie', Buffer.concat([Buffer.from(' '), UTF8_BOM, exampleBytes])],
    ['het voorbeeld met U+00A0 na een BOM', Buffer.concat([UTF8_BOM, Buffer.from(' '), exampleBytes])],
  ];
  const kept = [];
  const refusedWithDifference = [];
  const keptModels = [];
  const changedModels = [];
  const modelSummaryOnly = [];
  for (const [label, body] of cases) {
    const outcome = await outcomeAsBytes(body);
    ok(`${label}: als bytes het antwoord van main, behalve waar main een gebouwmodel of het schrijven met foreign weigerde`, !outcome.broken, outcome.broken);
    if (outcome.kept) kept.push(label);
    if (outcome.refusedWithDifference) refusedWithDifference.push(label);
    if (outcome.keptModel) keptModels.push(label);
    if (outcome.keptModel && !outcome.sameAsSource) changedModels.push(label);
    if (outcome.modelSummaryOnly) modelSummaryOnly.push(label);
  }
  const inEveryForm = names => names.flatMap(name => forms.map(([form]) => `${name}, ${form}`)).sort();
  const sameList = (seen, expected) => JSON.stringify([...seen].sort()) === JSON.stringify(expected);
  const expectKept = inEveryForm(['oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc', 'oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc', 'het voorbeeld met een externe pset']);
  ok('alleen bij de twee oude woongebouw-bestanden en het voorbeeld met een externe pset komen bewaarde bytes terug waar main het schrijven weigerde, in elke vorm',
    sameList(kept, expectKept), kept.join(' | '));
  ok('alleen bij de twee bestanden die de bytes-route anders leest blijft de weigering van main, met het verschil erbij, in elke vorm',
    sameList(refusedWithDifference, inEveryForm([SCHEDULE_READ_OTHERWISE, NAME_READ_OTHERWISE])), refusedWithDifference.join(' | '));
  const expectKeptModels = inEveryForm(['bonsai-4d.ifc', 'crlf-commentaar.ifc', 'dubbele-globalids.ifc', 'eigen-plus-model.ifc', 'latin1.ifc',
    'oud-eigen-0.1-plus-model.ifc', 'twee-werkplannen.ifc'].map(file => `ifc-foreign/${file}`));
  ok('zeven van de elf modelbestanden komen als bytes met samenvatting en bewaarde bytes terug, in elke vorm; de andere vier krijgen de 422 van main',
    sameList(keptModels, expectKeptModels), keptModels.join(' | '));
  ok('de bewaarde modelbestanden komen byte voor byte als de bron terug: er valt niets te herrekenen', changedModels.length === 0, changedModels.join(' | '));
  ok('geen modelbestand uit de lus geeft alleen een samenvatting', modelSummaryOnly.length === 0, modelSummaryOnly.join(' | '));

  const readErrors = [
    ['een lege body', Buffer.alloc(0)],
    ['alleen witruimte', Buffer.from('  \n\t ')],
    ['geen STEP-kop', Buffer.from('dit is geen IFC')],
    ['een NUL vóór de kop', Buffer.concat([Buffer.from([0]), exampleBytes])],
    ['alleen de kop', Buffer.from('ISO-10303-21;\n')],
    ['een afgekapt voorbeeld', Buffer.from(example.slice(0, example.lastIndexOf('END-ISO-10303-21;')))],
    ['een afgekapt model', Buffer.from(eigenPlusModel.slice(0, eigenPlusModel.lastIndexOf('END-ISO-10303-21;')))],
    ['5000 spaties na de sluitmarkering', Buffer.from(example + ' '.repeat(5000))],
    ['geen DATA-sectie', Buffer.from("ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\nEND-ISO-10303-21;\n")],
    ['nul taken', Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n')],
    ['een ongeldige duur', Buffer.from(example.replace("'P0Y0M5D'", "'P0Y0M5X'"))],
    [DURATION_OUTSIDE_PLANNING, Buffer.from(scheduleReadOtherwise.toString('utf8').replace("'P0Y0M23D'", "'P0Y0M23X'"))],
  ];
  for (const [label, body] of readErrors) {
    for (const path of ['/v1/schedule', '/v1/schedule?output=ifc']) {
      const asText = await call(path, { method: 'POST', body, headers: IFC });
      const asBytes = await call(path, { method: 'POST', body, headers: BYTES });
      ok(`leesfout ${label}, ${path}: als bytes dezelfde status, code, melding en details als als tekst`,
        asText.status >= 400 && !refusedAsModel(asText) && sameAnswer(asBytes, asText),
        `tekst ${asText.status} ${asText.text.slice(0, 120)}, bytes ${asBytes.status} ${asBytes.text.slice(0, 120)}`);
    }
  }

  const bonsai = readFileSync(join(FOREIGN_FIXTURES, 'bonsai-4d.ifc'), 'utf8');
  const staleBonsai = Buffer.from(bonsai.replace(BONSAI_WALL_A_TIME, BONSAI_WALL_A_STALE));
  ok('fixture: een Bonsai-planning met een vroege start die de berekening niet geeft', !staleBonsai.equals(Buffer.from(bonsai)));
  ok('de Bonsai-planning met een vroege start: als bytes een samenvatting, maar output=ifc blijft de 422 van main omdat de merge weigert',
    (await outcomeAsBytes(staleBonsai)).modelSummaryOnly === true);

  for (const [label, body, expect, fields] of [
    [SCHEDULE_READ_OTHERWISE, scheduleReadOtherwise, s => s?.counts?.tasks === 52 && s?.project?.finish === '2028-01-12T16:00',
      ['counts.tasks', 'project.finish']],
    [NAME_READ_OTHERWISE, nameReadOtherwise, s => s?.project?.name === 'Refurbishment & Extension of a Family Home' && s?.counts?.tasks === 20,
      ['project.name']],
  ]) {
    for (const path of ['/v1/schedule', '/v1/schedule?output=summary']) {
      const r = await call(path, { method: 'POST', body, headers: BYTES });
      ok(`${label} als bytes, ${path} → 200 met de samenvatting van main`, r.status === 200 && expect(r.json),
        `${r.status} ${r.json?.counts?.tasks} taken, ${r.json?.project?.finish}, ${r.json?.project?.name}`);
    }
    const r = await call('/v1/schedule?output=ifc', { method: 'POST', body, headers: BYTES });
    const message = r.json?.error?.message ?? '';
    ok(`${label} als bytes, output=ifc → de weigering foreign van main, met ${fields.join(' en ')} in de melding`,
      refusalOf(r) === '500 IFC_WRITE_FAILED:foreign' && fields.every(field => message.includes(field)), `${refusalOf(r)} ${message}`);
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
