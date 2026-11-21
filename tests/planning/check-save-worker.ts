// #804 stap 4: de opslagworker zelf (bytes, fouten, levensduur). De worker is hier een dubbel in dit proces
// (`inProcessSaveWorker.ts`) die de echte handler draait en berichten verstuurt zoals een browser. Knownbug 1936: na elk
// antwoord op een merge stopt de worker en krijgt het volgende verzoek een nieuwe. Een latere startfout is bij een merge
// een fout; een gewoon verzoek valt dan terug zoals op main.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IfcOutput, IfcSaveJob } from '@/state/prepareIfcOutput';
import type { IfcSaveResponse } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import type { IfcSaveWorkerOptions, IfcSaveWorkerPort } from '@/services/ifc/saveWorker/ifcSaveWorker';
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

/** De client van de pariteitsproeven, met elke aangemaakte worker op volgorde. */
const shared: InProcessWorker[] = [];
const saveWorker = createIfcSaveWorker({ createWorker: () => { const w = new InProcessWorker(); shared.push(w); return w; } });
/** Een merge die de hoofdthread weigert (`MergeNeedsPhase2Error`), uit de fixtures hieronder. */
let refusedMergeJob: IfcSaveJob | undefined;
const counts: Record<string, number> = {};
const count = (kind: string) => { counts[kind] = (counts[kind] ?? 0) + 1; };

/** Hoofdthread en worker voor dezelfde toestand en invoer, via `prepareIfcOutput` (de beslisregels één keer). */
async function compare(state: Parameters<typeof prepareIfcOutput>[0], input: Parameters<typeof prepareIfcOutput>[1], label: string) {
  const sourceBefore = state.ifcSource ? sha(state.ifcSource.bytes) : undefined;
  const lengthBefore = state.ifcSource?.bytes.byteLength;
  const main = await outcome(() => prepareIfcOutput(state, input));
  if ('error' in main && main.error instanceof MergeNeedsPhase2Error) refusedMergeJob ??= { kind: 'merge', input, source: state.ifcSource! };
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

await check('de levensduur over alle verzoeken hierboven: een gewoon verzoek houdt de worker, na elke merge een nieuwe (knownbug 1936)', () => {
  const requests = shared.flatMap(w => w.requests);
  assert.ok(requests.length >= 20, `${requests.length} verzoeken`);
  assert.deepEqual(requests.map(r => r.id), requests.map((_r, i) => i + 1), 'oplopende verzoeknummers, ook over de workers heen');
  const merges = requests.filter(r => r.job.kind === 'merge').length;
  assert.ok(merges >= 6, `${merges} merges`);
  for (const [i, w] of shared.entries()) {
    const kinds = w.requests.map(r => r.job.kind);
    const endsWithMerge = kinds.at(-1) === 'merge';
    assert.ok(!kinds.slice(0, -1).includes('merge'), `worker ${i + 1}: na een merge geen verzoek meer (${kinds.join(', ')})`);
    assert.equal(w.terminated, endsWithMerge, `worker ${i + 1}: gestopt precies na een merge, ook na een weigering`);
    if (i < shared.length - 1) assert.ok(endsWithMerge, `worker ${i + 1}: alleen een merge maakt plaats voor een nieuwe worker`);
  }
  assert.equal(shared.length, merges + (requests.at(-1)!.job.kind === 'merge' ? 0 : 1), 'een nieuwe worker na elke merge, en alleen dan');
  assert.ok(shared[0]!.requests.length >= 8, 'de gewone writer van de voorbeelden hergebruikte één worker');
  // Terug overgedragen, niet gekopieerd: na het versturen is de buffer aan de kant van de worker leeg.
  const sentBack = shared.flatMap(w => w.sentBack);
  assert.ok(sentBack.length > 0 && sentBack.every(view => view.byteLength === 0), 'uitvoer overgedragen');
  console.log(`   (vergeleken: ${JSON.stringify(counts)}; ${shared.length} workers voor ${requests.length} verzoeken)`);
});

await check('dezelfde weigering van de merge, met dezelfde gevallen', () => {
  assert.ok((counts.geweigerd ?? 0) >= 1, `weigeringen vergeleken: ${counts.geweigerd ?? 0}`);
});

const fixtureRoute = await openInStore(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), 'eigen-plus-model.ifc');
const fixtureState = fixtureRoute.store.getState();
const fixtureInput = fixtureRoute.snapshot(fixtureRoute.store);
const mergeJob: IfcSaveJob = { kind: 'merge', input: fixtureInput, source: fixtureState.ifcSource! };
/** Dezelfde bron, één taak een dag langer: een merge die nieuwe bytes geeft. */
const changedMergeJob: IfcSaveJob = {
  kind: 'merge', input: { ...await lengthen(fixtureInput, lengthenedTask(fixtureInput).id), writeMode: 'merge' }, source: fixtureState.ifcSource!,
};
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
    // Knownbug 1936: een fout van de gewone writer laat de worker staan; na een fout van de merge stopt hij.
    const worker = shared.at(-1)!;
    assert.equal(worker.requests.at(-1)!.job.kind, job.kind, `${label}: deze worker rekende het verzoek`);
    assert.equal(worker.terminated, job.kind === 'merge', `${label}: ${job.kind === 'merge' ? 'gestopt' : 'blijft staan'}`);
  }
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
  const changed = await handleIfcSaveRequest({ id: 1, job: changedMergeJob });
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

/** Een client met dubbels die de proef zelf start en beantwoordt (`manual`), of die zichzelf beantwoorden (`auto`). Een
 *  gebroken soort start niet: `silent` meldt nooit `started`, `load-fails` faalt bij het laden, `throws` en `null` maken
 *  geen worker. De soorten gelden op volgorde van aanmaken; daarna `auto`. */
type WorkerKind = 'auto' | 'manual' | 'silent' | 'load-fails' | 'throws' | 'null';
function scriptedClient(kinds: readonly WorkerKind[], options: Omit<IfcSaveWorkerOptions, 'createWorker'> = {}) {
  const workers: InProcessWorker[] = [];
  let created = 0;
  const client = createIfcSaveWorker({ startTimeoutMs: 30, ...options, createWorker: () => {
    const kind = kinds[created++] ?? 'auto';
    if (kind === 'throws') throw new Error('SecurityError');
    if (kind === 'null') return null;
    const w = new InProcessWorker(kind === 'load-fails' ? 'manual' : kind);
    if (kind === 'load-fails') setTimeout(() => w.fail('module laadt niet'), 0);
    workers.push(w);
    return w;
  } });
  return { client, workers, created: () => created };
}
/** De uitkomst van een verzoek, zonder `reseed`: de proef zet de klok zelf vlak voor het antwoord van de worker. */
const settled = (run: Promise<IfcOutput>): Promise<Outcome> => run.then(output => ({ output }), error => ({ error }));
const isWorkerError = (result: Outcome, reason: string) =>
  'error' in result && result.error instanceof IfcSaveWorkerError && result.error.reason === reason;

const mainOf = {
  merge: await outcome(() => computeIfcOutputHere(mergeJob)),
  changed: await outcome(() => computeIfcOutputHere(changedMergeJob)),
  writer: await outcome(() => computeIfcOutputHere(writerJob)),
};

await check('knownbug 1936: na elk antwoord op een merge stopt de worker, pas als het antwoord binnen is; een gewoon verzoek houdt hem', async () => {
  const cases: Array<[string, IfcSaveJob, Outcome]> = [
    ['geslaagd, nieuwe bytes', changedMergeJob, mainOf.changed],
    ['geslaagd, ongewijzigd', mergeJob, mainOf.merge],
  ];
  // De weigering komt uit de pariteit van de fixtures hierboven; ontbreekt ze, dan faalt deze proef pas na de andere gevallen.
  const refused = refusedMergeJob && await outcome(() => computeIfcOutputHere(refusedMergeJob!));
  if (refused) {
    assert.ok('error' in refused && refused.error instanceof MergeNeedsPhase2Error, 'de hoofdthread weigert die merge');
    cases.push(['geweigerd', refusedMergeJob!, refused]);
  }
  for (const [label, job, main] of cases) {
    const { client, workers } = scriptedClient(['manual', 'manual'], { timeoutMs: () => 5_000 });
    const run = settled(client.compute(job));
    await turn();
    workers[0]!.start();
    await turn();
    assert.equal(workers[0]!.terminated, false, `${label}: de worker rekent nog; niet gestopt vóór het antwoord`);
    reseed(1);
    await workers[0]!.answer(0);
    const result = await run;
    sameOutcome(result, main, label);
    if (job === mergeJob) assert.equal('output' in result && result.output.prepared?.source, mergeJob.source, `${label}: dezelfde bron terug`);
    assert.equal(workers[0]!.terminated, true, `${label}: na het antwoord gestopt`);
    // Het volgende verzoek, een gewoon: een nieuwe worker; daarna blijft die staan, ook voor een tweede gewoon verzoek.
    for (const n of [1, 2]) {
      const next = settled(client.compute(writerJob));
      await turn();
      assert.equal(workers.length, 2, `${label}: gewoon verzoek ${n} rekent in de tweede worker`);
      workers[1]!.start();
      reseed(1);
      await workers[1]!.answer(n - 1);
      sameOutcome(await next, mainOf.writer, `${label}, gewoon verzoek ${n}`);
      assert.equal(workers[1]!.terminated, false, `${label}: na gewoon verzoek ${n} blijft de worker staan`);
    }
    // `dispose` doet wat het deed: de worker weg, elk later verzoek een fout, en geen nieuwe worker.
    client.dispose();
    assert.equal(workers[1]!.terminated, true, `${label}: dispose stopt de worker`);
    assert.ok(isWorkerError(await settled(client.compute(mergeJob)), 'disposed'), `${label}: na dispose een fout`);
    assert.equal(workers.length, 2, `${label}: na dispose geen nieuwe worker`);
  }
  assert.ok(refused, 'een geweigerde merge uit de fixtures');
});

await check('twee verzoeken in de rij: het tweede wacht zijn beurt af, krijgt na een merge een nieuwe worker en zijn eigen uitkomst', async () => {
  const pairs: Array<[string, IfcSaveJob, Outcome, IfcSaveJob, Outcome]> = [
    ['merge, dan merge', mergeJob, mainOf.merge, changedMergeJob, mainOf.changed],
    ['merge, dan gewoon', changedMergeJob, mainOf.changed, writerJob, mainOf.writer],
    ['gewoon, dan merge', writerJob, mainOf.writer, changedMergeJob, mainOf.changed],
  ];
  for (const [label, firstJob, firstMain, secondJob, secondMain] of pairs) {
    const { client, workers } = scriptedClient(['manual', 'manual']);
    const first = settled(client.compute(firstJob));
    const second = settled(client.compute(secondJob));
    await turn();
    assert.equal(workers.length, 1, `${label}: één worker`);
    assert.equal(workers[0]!.requests.length, 1, `${label}: hoogstens één verzoek tegelijk`);
    workers[0]!.start();
    workers[0]!.emit({ id: 999, result: { kind: 'merge-unchanged', literalCalendarIds: [] } });
    await turn();
    assert.equal(workers[0]!.requests.length, 1, `${label}: een antwoord met een ander nummer telt niet`);
    reseed(1);
    await workers[0]!.answer(0);
    const a = await first;
    sameOutcome(a, firstMain, `${label}: het eerste`);
    if (firstJob === mergeJob) assert.equal('output' in a && a.output.prepared?.source, mergeJob.source, 'ongewijzigd: dezelfde bron terug, zoals op de hoofdthread');
    await turn();
    const freshWorker: boolean = firstJob.kind === 'merge';
    assert.equal(workers[0]!.terminated, freshWorker, `${label}: de eerste worker ${freshWorker ? 'gestopt' : 'blijft staan'}`);
    assert.equal(workers.length, freshWorker ? 2 : 1, `${label}: het tweede verzoek ${freshWorker ? 'in een nieuwe worker' : 'in dezelfde worker'}`);
    const port = workers.at(-1)!;
    port.start();
    reseed(1);
    await port.answer(port.requests.length - 1);
    sameOutcome(await second, secondMain, `${label}: het tweede`);
    assert.equal(port.terminated, secondJob.kind === 'merge', `${label}: na het tweede ${secondJob.kind === 'merge' ? 'gestopt' : 'blijft hij staan'}`);
    assert.deepEqual(workers.flatMap(w => w.requests).map(r => r.id), [1, 2], `${label}: oplopende nummers`);
    client.dispose();
  }
});

/** Rekende de hoofdthread (de terugval)? Die geeft tekst zonder bytes; een antwoord van de worker draagt altijd bytes. */
const onMainThread = (result: Outcome) => 'output' in result && !result.output.prepared && result.output.bytes === undefined
  && typeof result.output.content === 'string';

await check('knownbug 1936: een latere startfout. Een gewoon verzoek valt terug zoals op main, een merge wordt een fout', async () => {
  const broken: WorkerKind[] = ['silent', 'load-fails', 'throws', 'null'];
  // Wat er vóór de mislukte start gebeurde, telkens met een gestarte worker: een merge (de worker stopte gewoon, het geval
  // van de review van #1111: daarna de flag uit en een gewone planning), of een verzoek dat stierf, verliep of afgebroken
  // werd (Automatisch opslaan wijkt). De nieuwe worker daarna start niet.
  const before: Array<[string, (client: ReturnType<typeof scriptedClient>) => Promise<void>]> = [
    ['na een merge', async ({ client }) => { sameOutcome(await outcome(() => client.compute(changedMergeJob)), mainOf.changed, 'de merge vooraf'); }],
    ['na een gestorven verzoek', async ({ client, workers }) => {
      const run = settled(client.compute(writerJob));
      await turn(); workers[0]!.start(); workers[0]!.fail('Out of memory');
      assert.ok(isWorkerError(await run, 'crashed'));
    }],
    ['na een verlopen verzoek', async ({ client, workers }) => {
      const run = settled(client.compute(mergeJob));
      await turn(); workers[0]!.start();
      assert.ok(isWorkerError(await run, 'timeout'));
    }],
    ['na een afgebroken ronde', async ({ client, workers }) => {
      const stop = new AbortController();
      const run = settled(client.compute(mergeJob, stop.signal));
      await turn(); workers[0]!.start(); stop.abort(new Error('wijkt'));
      const result = await run;
      assert.ok('error' in result && result.error instanceof Error && result.error.message === 'wijkt' && !(result.error instanceof IfcSaveWorkerError),
        'het wijken geeft de reden van het signaal, zoals nu');
    }],
  ];
  for (const [when, act] of before) {
    for (const kind of broken) {
      const label = `${when}, dan ${kind}`;
      let limit = when === 'na een verlopen verzoek' ? 40 : 60_000;
      const scripted = scriptedClient([when === 'na een merge' ? 'auto' : 'manual', kind, kind, 'auto'], { timeoutMs: () => limit });
      await act(scripted);
      limit = 60_000;
      assert.equal(scripted.workers[0]!.terminated, true, `${label}: de eerste worker is gestopt`);
      const brokenPort = () => (kind === 'throws' || kind === 'null' ? undefined : scripted.workers.at(-1));
      // Een gewoon verzoek: de verse worker start niet, dus rekent de hoofdthread, met dezelfde uitkomst (main).
      const plain = await outcome(() => scripted.client.compute(writerJob));
      sameOutcome(plain, mainOf.writer, `${label}, gewoon: de terugval`);
      assert.ok(onMainThread(plain), `${label}, gewoon: de hoofdthread rekende`);
      assert.equal(scripted.created(), 2, `${label}, gewoon: één poging`);
      if (brokenPort()) assert.equal(brokenPort()!.terminated, true, `${label}: de worker die niet startte is gestopt`);
      // Daarna rekenen gewone verzoeken de rest van de sessie op de hoofdthread, zoals op main.
      const again = await outcome(() => scripted.client.compute(writerJob));
      assert.ok(onMainThread(again), `${label}, gewoon daarna: weer de hoofdthread`);
      assert.equal(scripted.created(), 2, `${label}, gewoon daarna: geen nieuwe worker`);
      // Een merge daarna: wel een nieuwe worker, en die start niet: een fout, nooit de hoofdthread.
      const failed = await outcome(() => scripted.client.compute(mergeJob));
      assert.ok(isWorkerError(failed, 'not-started'), `${label}, merge: een fout, geen terugval (${'error' in failed ? String(failed.error) : 'een uitkomst'})`);
      assert.equal(scripted.created(), 3, `${label}, merge: een eigen poging`);
      if (brokenPort()) assert.equal(brokenPort()!.terminated, true, `${label}: de worker van de merge die niet startte is gestopt`);
      // De volgende merge probeert opnieuw, en rekent in de worker.
      sameOutcome(await outcome(() => scripted.client.compute(changedMergeJob)), mainOf.changed, `${label}: de merge daarna`);
      assert.equal(scripted.created(), 4, `${label}: een nieuwe aanmaak voor de merge`);
      assert.equal(scripted.workers.at(-1)!.requests.length, 1, `${label}: de nieuwe worker rekende de merge`);
      assert.equal(scripted.workers.at(-1)!.terminated, true, `${label}: en stopte daarna`);
      // Een gewoon verzoek blijft op de hoofdthread.
      assert.ok(onMainThread(await outcome(() => scripted.client.compute(writerJob))), `${label}: gewoon blijft op de hoofdthread`);
      assert.equal(scripted.created(), 4, `${label}: geen worker voor een gewoon verzoek`);
      scripted.client.dispose();
    }
  }
  assert.equal(sha(mergeJob.source.bytes), mergeJob.source.sha256, 'bron intact');
});

await check('één starttijd voor elke worker; na started geldt de rekentijd', async () => {
  // Hier 50 ms om te starten en 3 s om te rekenen. Een merge vooraf, zodat er in de sessie al een worker startte.
  let limit = 3_000;
  const scripted = scriptedClient(['auto', 'silent', 'manual', 'manual', 'silent'], { startTimeoutMs: 50, timeoutMs: () => limit });
  sameOutcome(await outcome(() => scripted.client.compute(changedMergeJob)), mainOf.changed, 'de merge vooraf');
  // De tijd tot `started`: een latere worker die niet start, faalt na de starttijd, niet pas na de rekentijd.
  let begin = performance.now();
  const failed = await outcome(() => scripted.client.compute(mergeJob));
  const startMs = performance.now() - begin;
  assert.ok(isWorkerError(failed, 'not-started'), 'een merge: niet gestart');
  assert.ok(startMs < 1_500, `na de starttijd, niet na de rekentijd (${Math.round(startMs)} ms)`);
  // De tijd daarna: gestart, en het antwoord komt ruim na de starttijd maar binnen de rekentijd. Dat slaagt.
  const slow = settled(scripted.client.compute(changedMergeJob));
  await turn();
  scripted.workers[2]!.start();
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(scripted.workers[2]!.terminated, false, 'na de start telt de starttijd niet meer');
  reseed(1);
  await scripted.workers[2]!.answer(0);
  sameOutcome(await slow, mainOf.changed, 'antwoord na vier keer de starttijd');
  // Na de start geldt de rekentijd: geen antwoord binnen die tijd is een fout.
  limit = 80;
  begin = performance.now();
  const late = settled(scripted.client.compute(mergeJob));
  await turn();
  scripted.workers[3]!.start();
  assert.ok(isWorkerError(await late, 'timeout'), 'geen antwoord binnen de rekentijd');
  assert.ok(performance.now() - begin >= 75, 'pas na de rekentijd');
  // Een gewoon verzoek met een worker die niet start, valt na dezelfde starttijd terug.
  limit = 3_000;
  begin = performance.now();
  const plain = await outcome(() => scripted.client.compute(writerJob));
  assert.ok(onMainThread(plain), 'gewoon: de terugval');
  assert.ok(performance.now() - begin < 1_500, 'gewoon: na de starttijd');
  scripted.client.dispose();
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
