// #804 stap 4: de opslagworker zelf (bytes, fouten, levensduur). De worker is hier een dubbel in dit proces
// (`inProcessSaveWorker.ts`) die de echte handler draait en berichten verstuurt zoals een browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IfcOutput, IfcSaveJob } from '@/state/prepareIfcOutput';
import type { IfcSaveResponse } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import type { IfcSaveWorkerPort } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { installDeterminism } from './ifcPariteitKern';
import { lengthen, lengthenedTask, loadStore, openInStore } from './ifcAppRoute';
import { InProcessWorker } from './inProcessSaveWorker';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reseed = installDeterminism();
await loadStore();
const { prepareIfcOutput, computeIfcOutputHere } = await import('@/state/prepareIfcOutput');
const { handleIfcSaveRequest, wireError, errorFromWire } = await import('@/services/ifc/saveWorker/ifcSaveProtocol');
const { createIfcSaveWorker, ifcSaveTimeoutMs } = await import('@/services/ifc/saveWorker/ifcSaveWorker');
const { IfcSaveWorkerError } = await import('@/services/ifc/saveWorker/ifcSaveWorkerError');
const { MergeNeedsPhase2Error } = await import('@/services/ifc/foreign/mergeWriter');
const { StepScanError } = await import('@/services/ifc/foreign/stepScanner');
const { IfcCalendarTimePrecisionError, IfcParseError } = await import('@/services/ifc/ifcErrors');
const { XerSourceArchiveValidationError } = await import('@/services/xerSourceArchive');
const { readIFC } = await import('@/services/ifc/ifcReader');
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { generateBenchmarkProject } = await import('@/services/benchmark/generateProject');

let passed = 0, failed = 0;
async function check(name: string, action: () => void | Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack : error).slice(0, 1500)}`); }
}
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const turn = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const read = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));

type Outcome = { readonly output: IfcOutput } | { readonly error: unknown };
async function outcome(run: () => Promise<IfcOutput>): Promise<Outcome> {
  reseed(1);
  try { return { output: await run() }; } catch (error) { return { error }; }
}
function ownFields(error: object) {
  return Object.fromEntries(Object.entries(error).filter(([key]) => key !== 'stack'));
}
function sameError(viaWorker: unknown, main: unknown, label: string) {
  assert.ok(main instanceof Error, `${label}: de hoofdthread gooit een Error`);
  assert.ok(viaWorker instanceof Error, `${label}: via de worker ook (${String(viaWorker)})`);
  assert.equal(Object.getPrototypeOf(viaWorker), Object.getPrototypeOf(main), `${label}: dezelfde foutsoort`);
  assert.ok(!(viaWorker instanceof IfcSaveWorkerError), `${label}: geen transportfout`);
  assert.equal(viaWorker.message, main.message, `${label}: dezelfde tekst`);
  assert.equal(viaWorker.name, main.name, `${label}: dezelfde naam`);
  assert.deepEqual(ownFields(viaWorker), ownFields(main), `${label}: dezelfde gegevens`);
}
const SOURCE_FIELDS = ['sha256', 'schemaName', 'chunkStarts', 'chunkIds', 'classes', 'stepIds', 'foreignMembers', 'foreign',
  'foreignObjectCount', 'buildingModel', 'lineEnding', 'opened'] as const;
/** Dezelfde uitkomst, of dezelfde fout. Geeft de soort terug voor de telling. */
function sameOutcome(viaWorker: Outcome, main: Outcome, label: string): 'writer' | 'merge' | 'geweigerd' | 'fout' {
  if ('error' in main) {
    assert.ok('error' in viaWorker, `${label}: de hoofdthread weigert, de worker niet`);
    sameError(viaWorker.error, main.error, label);
    return main.error instanceof MergeNeedsPhase2Error ? 'geweigerd' : 'fout';
  }
  assert.ok('output' in viaWorker, `${label}: de worker gaf een fout: ${'error' in viaWorker ? String(viaWorker.error) : ''}`);
  const a = viaWorker.output, b = main.output;
  assert.deepEqual([...a.literalCalendarIds], [...b.literalCalendarIds], `${label}: dezelfde letterlijke kalenders`);
  if (!b.prepared) {
    assert.ok(!a.prepared, `${label}: de gewone writer`);
    // De worker geeft bytes; de terugval op de hoofdthread geeft tekst, zoals `prepareIfcOutput` zonder worker.
    if (a.bytes) assert.equal(sha(a.bytes), sha(new TextEncoder().encode(b.content)), `${label}: dezelfde sha256`);
    assert.equal(a.content, b.content, `${label}: dezelfde tekst`);
    return 'writer';
  }
  assert.ok(a.prepared, `${label}: de merge geeft een voorbereide opslag terug`);
  assert.equal(sha(a.prepared.bytes), sha(b.prepared.bytes), `${label}: dezelfde bytes`);
  assert.equal(a.prepared.sha256, b.prepared.sha256, `${label}: dezelfde sha256`);
  assert.equal(a.prepared.sha256, sha(a.prepared.bytes), `${label}: de sha256 hoort bij de bytes`);
  assert.equal(a.prepared.bytes, a.prepared.source.bytes, `${label}: de uitvoer is de buffer van de nieuwe bron`);
  for (const key of SOURCE_FIELDS) assert.deepEqual(a.prepared.source[key], b.prepared.source[key], `${label}: bron.${key}`);
  assert.equal(sha(a.prepared.source.bytes), sha(b.prepared.source.bytes), `${label}: bron.bytes`);
  if (a.prepared.source.opened) assert.ok(Object.isFrozen(a.prepared.source.opened.tasks), `${label}: bron.opened is bevroren`);
  return 'merge';
}

const shared = new InProcessWorker();
let sharedStarts = 0;
const saveWorker = createIfcSaveWorker({ createWorker: () => { sharedStarts++; return shared; } });
const counts: Record<string, number> = {};
const count = (kind: string) => { counts[kind] = (counts[kind] ?? 0) + 1; };

/** Hoofdthread en worker voor dezelfde toestand en invoer, via `prepareIfcOutput` (de beslisregels één keer). */
async function compare(state: Parameters<typeof prepareIfcOutput>[0], input: Parameters<typeof prepareIfcOutput>[1], label: string) {
  const sourceBefore = state.ifcSource ? sha(state.ifcSource.bytes) : undefined;
  const lengthBefore = state.ifcSource?.bytes.byteLength;
  const main = await outcome(() => prepareIfcOutput(state, input));
  const viaWorker = await outcome(() => prepareIfcOutput(state, input, undefined, saveWorker.compute));
  if ('output' in main && main.output.prepared && 'output' in viaWorker && viaWorker.output.prepared) {
    // Gaf de hoofdthread de bron zelf terug (ongewijzigd), dan de worker ook: dezelfde identiteit.
    assert.equal(viaWorker.output.prepared.source === state.ifcSource, main.output.prepared.source === state.ifcSource,
      `${label}: bron-identiteit`);
  }
  count(sameOutcome(viaWorker, main, label));
  if (state.ifcSource) {
    assert.equal(state.ifcSource.bytes.byteLength, lengthBefore, `${label}: de bronbytes op de hoofdthread zijn niet overgedragen`);
    assert.equal(sha(state.ifcSource.bytes), sourceBefore, `${label}: de bronbytes op de hoofdthread zijn intact`);
  }
}

await check('pariteit: de voorbeelden (gewone writer)', async () => {
  const files = readdirSync(join(root, 'public/examples')).filter(f => f.endsWith('.ifc')).sort();
  assert.ok(files.length >= 8);
  for (const file of files) {
    const { store, snapshot } = await openInStore(read(`public/examples/${file}`), file);
    await compare(store.getState(), snapshot(store), file);
  }
});

await check('pariteit: de fixtures met een vreemd deel (merge), ongewijzigd en na een bewerking', async () => {
  const files = readdirSync(join(root, 'tests/fixtures/ifc-foreign')).filter(f => f.endsWith('.ifc')).sort();
  let opened = 0;
  for (const file of files) {
    let route: Awaited<ReturnType<typeof openInStore>>;
    try { route = await openInStore(read(`tests/fixtures/ifc-foreign/${file}`), file); } catch { continue; }
    opened++;
    const state = route.store.getState();
    const input = route.snapshot(route.store);
    await compare(state, input, `${file} ongewijzigd`);
    const task = lengthenedTask(input);
    if (!task) continue; // alleen een model, geen taak om te bewerken
    await compare(state, { ...await lengthen(input, task.id), writeMode: 'merge' }, `${file} een dag langer`);
  }
  assert.ok(opened >= 6, `${opened} fixtures geopend`);
  assert.ok((counts.merge ?? 0) >= 6, `merges vergeleken: ${counts.merge ?? 0}`);
});

let plan1000: WriteIFCInput | undefined;
await check('pariteit: een gegenereerd plan van 1.000 taken, gewone writer en merge', async () => {
  const { store } = createAppStoreContext();
  store.getState().openAsDocument(generateBenchmarkProject(1000), { name: 'plan-1000.ifc', ref: null });
  const input = buildWriteIFCInput(store.getState(), 'merge');
  assert.ok(input.tasks.length >= 1000, `${input.tasks.length} taken`);
  plan1000 = input;
  let start = performance.now();
  await compare(store.getState(), input, 'plan 1000 writer');
  console.log(`   (1000 taken, gewone writer, beide routes: ${Math.round(performance.now() - start)} ms)`);
  // Dezelfde planning met een wand van een ander programma: de merge.
  const office = (await prepareIfcOutput(store.getState(), input)).content!;
  const wall = [
    "#990001=IFCORGANIZATION($,'Arch',$,$,$);", "#990002=IFCAPPLICATION(#990001,'1','Revit','RVT');",
    "#990003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#990004=IFCPERSONANDORGANIZATION(#990003,#990001,$);',
    '#990005=IFCOWNERHISTORY(#990004,#990002,$,.ADDED.,$,$,$,1);',
    "#990006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#990005,'Wand',$,$,$,$,$,$);",
  ].join('\n');
  const at = office.lastIndexOf('ENDSEC;');
  const route = await openInStore(new TextEncoder().encode(`${office.slice(0, at)}${wall}\n${office.slice(at)}`), 'plan-1000-wand.ifc');
  const state = route.store.getState();
  assert.equal(state.ifcSource?.foreign, true);
  const mergeInput = route.snapshot(route.store);
  start = performance.now();
  await compare(state, mergeInput, 'plan 1000 merge ongewijzigd');
  await compare(state, { ...await lengthen(mergeInput, lengthenedTask(mergeInput).id), writeMode: 'merge' }, 'plan 1000 merge een dag langer');
  console.log(`   (1000 taken, merge, twee keer beide routes: ${Math.round(performance.now() - start)} ms)`);
});

await check('één worker voor alle verzoeken hierboven, na elkaar', () => {
  assert.equal(sharedStarts, 1, 'dezelfde worker hergebruikt');
  assert.equal(shared.terminated, false, 'een weigering of fout van de merge laat de worker staan');
  assert.ok(shared.requests.length >= 20, `${shared.requests.length} verzoeken`);
  assert.deepEqual(shared.requests.map(r => r.id), shared.requests.map((_r, i) => i + 1), 'oplopende verzoeknummers');
  // Terug overgedragen, niet gekopieerd: na het versturen is de buffer aan de kant van de worker leeg.
  assert.ok(shared.sentBack.length > 0 && shared.sentBack.every(view => view.byteLength === 0), 'uitvoer overgedragen');
  console.log(`   (vergeleken: ${JSON.stringify(counts)})`);
});

await check('dezelfde weigering van de merge, met dezelfde gevallen', () => {
  assert.ok((counts.geweigerd ?? 0) >= 1, `weigeringen vergeleken: ${counts.geweigerd ?? 0}`);
});

const fixtureRoute = await openInStore(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), 'eigen-plus-model.ifc');
const fixtureState = fixtureRoute.store.getState();
const fixtureInput = fixtureRoute.snapshot(fixtureRoute.store);
const mergeJob: IfcSaveJob = { kind: 'merge', input: fixtureInput, source: fixtureState.ifcSource! };
const writerJob: IfcSaveJob = { kind: 'writer', input: { ...plan1000!, writeMode: 'merge' } };

await check('dezelfde fouten over de grens: writer, scanner en de merge zelf', async () => {
  const zoned = readFileSync(join(root, 'tests/planning/fixtures/periode-oude-minuutfractie.ifc'), 'utf8')
    .replace("IFCTIMEPERIOD('07:30.5:00','16:00:00')", "IFCTIMEPERIOD('07:30:01Z','16:00:00Z')");
  const fine = readIFC(zoned);
  fine.calendar.workTime!.byWeekday[1][0].start += 1;
  const jobs: Array<[string, IfcSaveJob, new (...args: never[]) => Error]> = [
    ['kalenderprecisie (writer)', { kind: 'writer', input: { ...fine, writeMode: 'planOnly' } }, IfcCalendarTimePrecisionError],
    ['geen STEP (scanner)', { kind: 'merge', input: fixtureInput, source: { ...mergeJob.source, bytes: new TextEncoder().encode('geen ifc') } }, StepScanError],
    ['andere bron dan de index', { kind: 'merge', input: fixtureInput, source: { ...mergeJob.source, chunkIds: new Int32Array(mergeJob.source.chunkIds.length) } }, Error],
  ];
  for (const [label, job, kind] of jobs) {
    const main = await outcome(() => computeIfcOutputHere(job));
    const viaWorker = await outcome(() => saveWorker.compute(job));
    assert.ok('error' in main && main.error instanceof kind, `${label}: de hoofdthread gooit ${kind.name} (${'error' in main ? String(main.error) : 'geen fout'})`);
    sameError('error' in viaWorker ? viaWorker.error : undefined, main.error, label);
  }
  assert.equal(shared.terminated, false, 'inhoudelijke fouten laten de worker staan');
});

await check('elke foutsoort van de grens komt terug als zichzelf, met haar gegevens', () => {
  const errors: Error[] = [
    new MergeNeedsPhase2Error([{ kind: 'vreemde-herkomst', sourceId: 12, detail: 'x' }, { kind: 'niet-gedragen', detail: 'y',
      field: { type: 'IFCTASK', slot: 3, source: "'a'", output: "'b'" } as never }]),
    new IfcCalendarTimePrecisionError(481.5), new StepScanError('id-te-groot', 'te groot', 17), new IfcParseError('no-data-section', 'leeg'),
    new XerSourceArchiveValidationError('archief'), new TypeError('type'), new RangeError('bereik'), new Error('gewoon'),
  ];
  for (const error of errors) sameError(errorFromWire(structuredClone(wireError(error))), error, error.name);
  const thrown = errorFromWire(structuredClone(wireError('tekst')));
  assert.equal(Object.getPrototypeOf(thrown), Error.prototype);
  assert.equal(thrown.message, 'tekst');
});

await check('de worker start niet: de hoofdthread rekent en geeft hetzelfde', async () => {
  const main = { writer: await outcome(() => computeIfcOutputHere(writerJob)), merge: await outcome(() => computeIfcOutputHere(mergeJob)) };
  const silent = new InProcessWorker('silent');
  const failing = new InProcessWorker('manual');
  const factories: Array<[string, () => IfcSaveWorkerPort | null, InProcessWorker?]> = [
    ['geen Worker', () => null],
    ['constructor weigert (sandbox)', () => { throw new Error('SecurityError'); }],
    ['geen started binnen de starttijd', () => silent, silent],
    ['fout bij het laden', () => { setTimeout(() => failing.fail('module laadt niet'), 0); return failing; }, failing],
  ];
  for (const [label, factory, port] of factories) {
    let created = 0;
    const client = createIfcSaveWorker({ createWorker: () => { created++; return factory(); }, startTimeoutMs: 30 });
    for (const job of [writerJob, mergeJob]) {
      const viaFallback = await outcome(() => client.compute(job));
      sameOutcome(viaFallback, job.kind === 'writer' ? main.writer : main.merge, `${label}, ${job.kind}`);
    }
    assert.equal(created, 1, `${label}: na een startprobleem rekent de rest van de sessie de hoofdthread`);
    if (port) assert.equal(port.terminated, true, `${label}: de worker is gestopt`);
    assert.equal(sha(mergeJob.source.bytes), mergeJob.source.sha256, `${label}: bron intact`);
    client.dispose();
  }
});

await check('de worker sterft, overschrijdt de tijd of antwoordt verkeerd: een fout, de hoofdthread rekent niet opnieuw', async () => {
  for (const [label, act, reason] of [
    ['sterft', (w: InProcessWorker) => w.fail('Out of memory'), 'crashed'],
    ['geen antwoord', () => undefined, 'timeout'],
    ['onleesbaar antwoord', (w: InProcessWorker) => w.onmessageerror?.call(w as unknown as Worker, {} as MessageEvent), 'transport'],
  ] as const) {
    const workers: InProcessWorker[] = [];
    const client = createIfcSaveWorker({
      createWorker: () => { const w = new InProcessWorker('manual'); workers.push(w); return w; }, timeoutMs: () => 40,
    });
    const run = client.compute(mergeJob);
    await turn();
    workers[0]!.start();
    act(workers[0]!);
    await assert.rejects(run, (error: unknown) => error instanceof IfcSaveWorkerError && error.reason === reason, label);
    assert.equal(workers[0]!.terminated, true, `${label}: de worker is gestopt`);
    assert.equal(sha(mergeJob.source.bytes), mergeJob.source.sha256, `${label}: bron intact`);
    // De volgende opslag start een nieuwe worker; de hoofdthread rekende niet.
    const next = client.compute(writerJob);
    await turn();
    assert.equal(workers.length, 2, `${label}: de volgende opslag krijgt een nieuwe worker`);
    workers[1]!.start();
    await workers[1]!.answer(0);
    assert.ok((await next).bytes, `${label}: de nieuwe worker rekent`);
    client.dispose();
  }
  // Ook een verzoek dat niet over de grens kan, is een fout en geen terugval.
  const port = new InProcessWorker('auto');
  const client = createIfcSaveWorker({ createWorker: () => port });
  await assert.rejects(client.compute({ kind: 'writer', input: { ...writerJob.input, kanNiet: () => 1 } as never }),
    (error: unknown) => error instanceof IfcSaveWorkerError && error.reason === 'transport');
  client.dispose();
  // Een antwoord met het juiste nummer dat niet bij het verzoek past, of een verplicht veld mist: een transportfout,
  // de worker gestopt, en nooit een uitkomst die een schrijfroute kan gebruiken (review van #1016, blokkade 1).
  const changed = await handleIfcSaveRequest({ id: 1, job: { ...mergeJob, input: { ...await lengthen(fixtureInput, lengthenedTask(fixtureInput).id), writeMode: 'merge' } } });
  assert.ok('result' in changed.response && changed.response.result.kind === 'merge');
  const prepared = changed.response.result.prepared;
  const wrong: Array<[string, IfcSaveJob, unknown]> = [
    ['een writerantwoord op een mergeverzoek', mergeJob, { result: { kind: 'writer', bytes: new Uint8Array([35]), literalCalendarIds: [] } }],
    ['een writerantwoord zonder bytes', writerJob, { result: { kind: 'writer', literalCalendarIds: [] } }],
    ['een ongewijzigde merge op een writerverzoek', writerJob, { result: { kind: 'merge-unchanged', literalCalendarIds: [] } }],
    ['een merge op een writerverzoek', writerJob, { result: { kind: 'merge', prepared } }],
    ['een merge zonder bron', mergeJob, { result: { kind: 'merge', prepared: { ...prepared, source: undefined } } }],
    ['een merge waarvan de bron andere bytes heeft', mergeJob, { result: { kind: 'merge', prepared: { ...prepared, bytes: new Uint8Array(prepared.bytes) } } }],
    ['een merge zonder indexarrays', mergeJob, { result: { kind: 'merge', prepared: { ...prepared, source: { ...prepared.source, classes: [] } } } }],
    ['een onbekende antwoordsoort', writerJob, { result: { kind: 'iets', bytes: new Uint8Array([35]), literalCalendarIds: [] } }],
    ['letterlijke kalenders geen lijst', writerJob, { result: { kind: 'writer', bytes: new Uint8Array([35]), literalCalendarIds: 'cal' } }],
    ['een fout van een onbekende soort', writerJob, { error: { type: 'BestaatNiet', name: 'X', message: 'x', data: {} } }],
    ['een fout zonder tekst', writerJob, { error: { type: 'Error', name: 'Error', data: {} } }],
    ['geen uitkomst en geen fout', writerJob, {}],
  ];
  for (const [label, job, body] of wrong) {
    const port = new InProcessWorker('manual');
    let created = 0;
    const client = createIfcSaveWorker({ createWorker: () => { created++; return port; } });
    const run = client.compute(job);
    await turn();
    port.start();
    port.emit({ id: port.requests[0]!.id, ...(body as object) } as IfcSaveResponse);
    await assert.rejects(run, (error: unknown) => error instanceof IfcSaveWorkerError && error.reason === 'transport', label);
    assert.equal(port.terminated, true, `${label}: de worker is gestopt`);
    // De volgende opslag krijgt een nieuwe worker.
    const next = client.compute(writerJob);
    await turn();
    assert.equal(created, 2, `${label}: een nieuwe worker`);
    port.start();
    client.dispose();
    await assert.rejects(next);
  }
});

await check('dispose tijdens een verzoek: een fout, en een laat antwoord doet niets', async () => {
  const port = new InProcessWorker('manual');
  let created = 0;
  const client = createIfcSaveWorker({ createWorker: () => { created++; return port; } });
  const run = client.compute(mergeJob);
  let settled = 0;
  run.then(() => { settled++; }, () => { settled++; });
  await turn();
  port.start();
  client.dispose();
  await assert.rejects(run, (error: unknown) => error instanceof IfcSaveWorkerError && error.reason === 'disposed');
  assert.equal(port.terminated, true);
  // Het late antwoord: de handler rekent het uit en stuurt het; er luistert niemand meer en er verandert niets.
  const late = await handleIfcSaveRequest(port.requests[0]!);
  port.emit(late.response);
  await turn();
  assert.equal(settled, 1, 'de opslag eindigde één keer');
  await assert.rejects(client.compute(writerJob), (error: unknown) => error instanceof IfcSaveWorkerError && error.reason === 'disposed');
  assert.equal(created, 1, 'na dispose geen nieuwe worker');
});

await check('twee verzoeken na elkaar via dezelfde worker: het tweede wacht zijn beurt af', async () => {
  const port = new InProcessWorker('manual');
  let created = 0;
  const client = createIfcSaveWorker({ createWorker: () => { created++; return port; } });
  const first = client.compute(mergeJob);
  const second = client.compute(writerJob);
  await turn();
  assert.equal(port.requests.length, 1, 'hoogstens één verzoek tegelijk');
  port.start();
  port.emit({ id: 999, result: { kind: 'merge-unchanged', literalCalendarIds: [] } });
  await turn();
  assert.equal(port.requests.length, 1, 'een antwoord met een ander nummer telt niet');
  await port.answer(0);
  const a = await first;
  assert.equal(a.prepared?.source, mergeJob.source, 'ongewijzigd: dezelfde bron terug, zoals op de hoofdthread');
  await turn();
  assert.equal(port.requests.length, 2);
  assert.deepEqual(port.requests.map(r => r.id), [1, 2]);
  await port.answer(1);
  assert.ok((await second).bytes);
  assert.equal(created, 1);
  client.dispose();
});

await check('de bron gaat als kopie heen: de buffers op de hoofdthread blijven bruikbaar', async () => {
  const port = new InProcessWorker('auto');
  const client = createIfcSaveWorker({ createWorker: () => port });
  await client.compute(mergeJob);
  assert.equal(mergeJob.source.bytes.byteLength, fixtureState.ifcSource!.bytes.byteLength);
  assert.equal(sha(mergeJob.source.bytes), mergeJob.source.sha256);
  assert.ok(mergeJob.source.chunkStarts.length > 0 && mergeJob.source.classes.length > 0);
  assert.notEqual(port.requests[0]!.job.kind === 'merge' && port.requests[0]!.job.source.bytes, mergeJob.source.bytes, 'een eigen kopie');
  client.dispose();
});

await check('de rekentijd groeit mee met de bron', () => {
  assert.equal(ifcSaveTimeoutMs(writerJob), 60_000);
  const big = { ...mergeJob, source: { ...mergeJob.source, bytes: new Uint8Array(0) } };
  Object.defineProperty(big.source.bytes, 'byteLength', { value: 300 * 2 ** 20 });
  assert.equal(ifcSaveTimeoutMs(big), 360_000);
  assert.ok(ifcSaveTimeoutMs(mergeJob) > 60_000);
});

// De bundel van de worker bewijst tests/browser/save-worker-production.spec.ts met de echte Vite-productiebouw.

console.log(`\n${passed} OK, ${failed} XX`);
if (failed) process.exit(1);
