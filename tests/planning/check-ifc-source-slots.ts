import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { classify, classOf } from '@/services/ifc/foreign/classify';
import { foreignScanFrom, scanForeign, scanForeignToOpen } from '@/services/ifc/foreign/foreignScan';
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { foreignOriginAmong, isSourceSlots, scanSourceSlots, type SourcePieceSlots, type SourceSlots } from '@/services/ifc/foreign/sourceSlots';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { slotTableOf } from '@/services/ifc/ifcSlotTables';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { outputFromResult, resultFits, runIfcSaveJob } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import type { IfcSaveJob } from '@/state/prepareIfcOutput';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { recoveryDocumentWithSource } from '@/state/readRecoveryDocument';
import { fakeScanWorker, fakeScanWorkerStats } from './fakeScanWorker';
import { createForeignScanHandler, type ForeignScanWorkerRequest, type ForeignScanWorkerResponse } from '@/services/ifc/foreign/foreignScanHandler';
import type { ForeignScanWorker } from '@/services/ifc/foreign/foreignScanRunner';
import { cloneDomain, openForeign } from './ifcMergeKern';
import { lengthen, lengthenedTask, loadStore, openInStore, recalculated } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
installDeterminism();
const FOREIGN = join(root, 'tests/fixtures/ifc-foreign');
const text = (name: string) => readFileSync(join(root, name), 'utf8');
const bytesOf = (content: string) => new TextEncoder().encode(content);
const BONSAI = text('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
const OWN = text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
const PLAIN = text('public/examples/03-kantoorgebouw-zuidas.ifc');

let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error); }
}

const slotsOf = (source: IfcSource | null | undefined): SourceSlots => {
  assert(source?.sourceSlots, 'de bron heeft sourceSlots');
  return source.sourceSlots;
};
const pieceAt = (slots: SourceSlots, stepId: number): SourcePieceSlots => {
  const piece = slots.get(stepId);
  assert(piece, `sourceSlots heeft #${stepId}`);
  return piece;
};
const withLine = (content: string, line: string) => {
  const end = content.lastIndexOf('ENDSEC;');
  return `${content.slice(0, end)}${line}\n${content.slice(end)}`;
};

function expectedSlots(index: StepIndex): Map<number, SourcePieceSlots> {
  const cls = classify(index);
  const foreignOrigin = new Set(cls.foreignOrigin);
  const out = new Map<number, SourcePieceSlots>();
  const read = (chunk: number): SourcePieceSlots | undefined => {
    const args = index.argTokens(chunk);
    if (!args || index.literalText(chunk)) return undefined;
    const table = slotTableOf(index.type(chunk), args);
    if (!table || args.length !== table.slots.length) return undefined;
    if (table.slots.some((slot, k) => table.positions(args)[slot.key] !== k)) return undefined;
    return { entity: index.type(chunk), table: table.naam, slots: new Map(table.slots.map((slot, k) => [slot.key, args[k]])) };
  };
  for (let chunk = 0; chunk < index.count; chunk++) {
    if (!index.isEntity(chunk)) continue;
    const klass = classOf(cls, chunk);
    const dOrR = cls.selection.inD[chunk] === 1 || cls.inR[chunk] === 1;
    if (!dOrR || klass !== 'P' || !foreignOrigin.has(chunk)) continue;
    const piece = read(chunk);
    if (!piece) continue;
    const ownedSlot = piece.table === 'IfcTask' ? 'taskTime' : piece.table === 'IfcRelSequence' ? 'timeLag' : undefined;
    const ownedRef = ownedSlot ? /^#(\d+)$/.exec(piece.slots.get(ownedSlot) ?? '') : null;
    const owned = ownedRef ? read(index.chunkOf(String(Number(ownedRef[1])))) : undefined;
    const ownedTable = ownedSlot === 'taskTime' ? 'IfcTaskTime' : 'IfcLagTime';
    out.set(Number(index.id(chunk)), owned?.table === ownedTable ? { ...piece, owned } : piece);
  }
  return out;
}

await check('Bonsai-4D: owner history, Creators, Status en QuantityInProcess staan per slotnaam als token van de bron', async () => {
  const withProcess = withLine(BONSAI, "#9001=IFCRELASSIGNSTOPROCESS('1ToewijzingVanBonsai01',#119,$,$,(#118),$,#108,#121);");
  const statused = withProcess.replace("#108=IFCTASK('3nYnvm_qVbnd$Ai6Exqj91',#107,'Wand B bouwen',$,$,'1.2',$,$,",
    "#108=IFCTASK('3nYnvm_qVbnd$Ai6Exqj91',#107,'Wand B bouwen',$,$,'1.2',$,'ON HOLD',");
  assert.notEqual(statused, withProcess, 'de bron heeft een Status van Bonsai');
  const { store } = await openInStore(bytesOf(statused));
  const slots = slotsOf(store.getState().ifcSource);
  const task = pieceAt(slots, 108);
  assert.deepEqual([task.entity, task.table], ['IFCTASK', 'IfcTask']);
  assert.deepEqual([task.slots.get('ownerHistory'), task.slots.get('status'), task.slots.get('name')], ['#107', "'ON HOLD'", "'Wand B bouwen'"]);
  assert.deepEqual(task.owned && [task.owned.table, task.owned.slots.get('scheduleDuration')], ['IfcTaskTime', "'P5D'"]);
  const plan = pieceAt(slots, 90);
  assert.deepEqual([plan.table, plan.slots.get('ownerHistory'), plan.slots.get('creators'), plan.slots.get('name')],
    ['IfcWorkPlan', '#89', '(#1)', "'Plan'"]);
  const live = pieceAt(slots, 94);
  assert.deepEqual([live.table, live.slots.get('creators'), live.slots.get('predefinedType')], ['IfcWorkSchedule (live)', '(#1)', '.PLANNED.']);
  const assignment = pieceAt(slots, 9001);
  assert.deepEqual([assignment.table, assignment.slots.get('ownerHistory'), assignment.slots.get('quantityInProcess')],
    ['IfcRelAssignsToProcess', '#119', '#121']);
  const nests = pieceAt(slots, 106);
  assert.deepEqual([nests.table, nests.slots.get('ownerHistory'), nests.slots.get('relatedObjects')], ['IfcRelNests', '#168', '(#104,#108)']);
  assert.equal(slots.has(120), false, 'een gemengde toewijzing (resource en wand) is geen eigen relatie: geen sourceSlots');
  assert.equal(slots.has(135), false, 'een baseline van Bonsai is vreemd: geen sourceSlots');
  assert.deepEqual(slots, expectedSlots(scanForeignStep(bytesOf(statused))), 'precies de D- en R-stukken van vreemde herkomst');
});

await check('elk corpusbestand met een vreemd deel: precies de D- en R-stukken van een ander programma, in de vorm van het schema', async () => {
  const files = [
    ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
    ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
  ].sort();
  let withSlots = 0, foreignFiles = 0;
  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(join(FOREIGN, file)));
    const read = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null }).catch(() => undefined);
    const source = read?.result.ifcSource;
    if (!source) continue;
    if (!source.foreign) {
      assert.equal('sourceSlots' in source, false, `${file}: zonder vreemd deel geen sourceSlots`);
      continue;
    }
    foreignFiles++;
    const index = scanForeignStep(bytes);
    assert.deepEqual(source.sourceSlots, expectedSlots(index), `${file}: sourceSlots`);
    const classes = classify(index).classes;
    const pChunks = Array.from({ length: index.count }, (_, c) => c).filter(c => classes[c] === 1);
    assert.deepEqual(scanSourceSlots(index, foreignOriginAmong(index, pChunks)), source.sourceSlots,
      `${file}: dezelfde stukken als de writer na opslaan zou aanwijzen`);
    if (source.sourceSlots!.size > 0) withSlots++;
  }
  console.log(`   ${foreignFiles} bestanden met een vreemd deel, ${withSlots} met stukken van een ander programma`);
  assert(withSlots >= 10, `${withSlots} bestanden met sourceSlots`);
});

await check('een oude lay-out en de oude letterlijke codering: die tokens bewaart de bron niet', async () => {
  const old = BONSAI.replace("#100=IFCTASK('2lNOVVAc3x$DPP3aHgo958',#99,'Ruwbouw',$,$,'1',$,$,$,.F.,$,$,.NOTDEFINED.);",
    "#100=IFCTASK('2lNOVVAc3x$DPP3aHgo958',#99,'Ruwbouw',$,$,'1',$,$,.F.,$,$,.NOTDEFINED.);");
  assert.notEqual(old, BONSAI);
  const index = scanForeignStep(bytesOf(old));
  const slots = scanSourceSlots(index, classify(index).foreignOrigin);
  assert.equal(slots.has(100), false, 'een taak met 12 argumenten: geen tokens');
  assert.equal(slots.has(104), true, 'de andere taken wel');
  const literal = scanForeignStep(bytesOf(text('tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc')));
  const literalChunks = Array.from({ length: literal.count }, (_, c) => c).filter(c => literal.isEntity(c) && literal.literalText(c)
    && slotTableOf(literal.type(c), literal.argTokens(c) ?? []) !== undefined);
  assert(literalChunks.length > 0, 'het oude eigen bestand heeft stukken met de oude letterlijke codering');
  assert.equal(scanSourceSlots(literal, literalChunks).size, 0, 'geen tokens uit een stuk met de oude letterlijke codering');
});

await check('zonder vreemd deel geen sourceSlots; met alleen eigen stukken een lege kaart; met de flag uit geen bron', async () => {
  const plain = await openInStore(bytesOf(PLAIN));
  const plainSource = plain.store.getState().ifcSource!;
  assert.equal(plainSource.foreign, false);
  assert.equal('sourceSlots' in plainSource, false, 'een eigen bestand: geen nieuw veld op de bron');
  const plainScan = scanForeignToOpen(bytesOf(PLAIN));
  assert(plainScan.ok && !('sourceSlots' in plainScan), 'een eigen bestand: de scan verzamelt niets');
  const own = await openInStore(bytesOf(OWN));
  assert.equal(own.store.getState().ifcSource!.foreign, true);
  assert.deepEqual(own.store.getState().ifcSource!.sourceSlots, new Map(), 'eigen planning met model: alles eigen herkomst');
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext();
  const noModel = text('tests/fixtures/ifc-foreign/council/fix2-vendor-ops.ifc');
  const withFlag = await openInStore(bytesOf(noModel));
  assert.equal(withFlag.store.getState().ifcSource?.buildingModel, false, 'een planning van een ander programma zonder gebouwmodel');
  assert((withFlag.store.getState().ifcSource?.sourceSlots?.size ?? 0) > 0, 'met de flag: sourceSlots');
  await store.getState().openOpenedFile({ name: 'vendor.ifc', content: noModel, bytes: bytesOf(noModel), ref: null });
  assert(store.getState().tasks.length > 0, 'flag uit: de planning is geopend');
  assert.equal(store.getState().ifcSource ?? null, null, 'flag uit: geen bron, zoals op main');
});

await check('alleen openen verzamelt sourceSlots: de doelcontrole en de interne scans niet', async () => {
  const bytes = bytesOf(BONSAI);
  const target = scanForeign(bytes);
  assert(target.ok && !('sourceSlots' in target), 'scanForeign (doelcontrole, headless) zonder sourceSlots');
  const index = scanForeignStep(bytes);
  assert(!('sourceSlots' in foreignScanFrom(index, classify(index), bytes)), 'foreignScanFrom zonder sourceSlots');
  const opened = scanForeignToOpen(bytes);
  assert(opened.ok && opened.sourceSlots && opened.sourceSlots.size > 0, 'openen: met sourceSlots');
  const callers: string[] = [];
  for (const file of readdirSync(join(root, 'src'), { recursive: true }) as string[]) {
    if (!/\.tsx?$/.test(file)) continue;
    const count = readFileSync(join(root, 'src', file), 'utf8').split('scanSourceSlots(').length - 1;
    for (let n = 0; n < count; n++) callers.push(file);
  }
  assert.deepEqual(callers.sort(), [
    'services/ifc/foreign/foreignScan.ts', 'services/ifc/foreign/mergeWriter.ts', 'services/ifc/foreign/sourceSlots.ts',
  ], 'scanSourceSlots: de definitie, het openen en de bron die de writer teruggeeft');
});

await check('de scanworker: sourceSlots komen gekloond en gelijk terug, een kapotte kaart is een transportfout', async () => {
  const bytes = bytesOf(BONSAI);
  const stats = fakeScanWorkerStats();
  const viaWorker = await readIfcBytesDetailed(bytes, {}, { createWorker: () => fakeScanWorker('ok', stats) });
  assert.equal(stats.workers, 1, 'de scan liep in de Worker');
  const here = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null });
  assert.deepEqual(viaWorker.result.ifcSource!.sourceSlots, here.result.ifcSource!.sourceSlots);
  const slots = here.result.ifcSource!.sourceSlots!;
  assert.equal(isSourceSlots(structuredClone(slots)), true, 'na structuredClone nog een geldige kaart');
  const first = [...slots][0];
  assert.equal(isSourceSlots(Object.fromEntries(slots)), false, 'een gewoon object is geen kaart');
  assert.equal(isSourceSlots(new Map([['90', first[1]]])), false, 'een sleutel moet een STEP-id zijn');
  assert.equal(isSourceSlots(new Map([[first[0], { ...first[1], slots: Object.fromEntries(first[1].slots) }]])), false, 'slots als object');
  assert.equal(isSourceSlots(new Map([[first[0], { ...first[1], owned: { ...first[1], owned: first[1] } }]])), false, 'twee lagen eigendom');
});

function editingScanWorker(edit: (outcome: Record<string, unknown>) => void, seen: { edited: number }): ForeignScanWorker {
  const worker = { onmessage: null, onerror: null, onmessageerror: null, terminate: () => {} } as unknown as ForeignScanWorker;
  const handle = createForeignScanHandler((response, transfer) => {
    const data = structuredClone(response, { transfer }) as ForeignScanWorkerResponse;
    if ('outcome' in data && data.outcome.ok) { edit(data.outcome as unknown as Record<string, unknown>); seen.edited++; }
    setTimeout(() => (worker.onmessage as unknown as ((e: { data: unknown }) => void) | null)?.({ data }), 0);
  });
  (worker as { postMessage: (request: ForeignScanWorkerRequest) => void }).postMessage = request => {
    const copy = structuredClone(request);
    setTimeout(() => handle(copy), 0);
  };
  return worker;
}

await check('de scanworker: een vreemde bron zonder kaart, of een kaart zonder vreemd deel, is een transportfout', async () => {
  const here = await readIfcBytesDetailed(bytesOf(BONSAI), {}, { createWorker: () => null });
  const stripped = { edited: 0 };
  const withoutMap = await readIfcBytesDetailed(bytesOf(BONSAI), {}, {
    createWorker: () => editingScanWorker(outcome => { delete outcome.sourceSlots; }, stripped),
  });
  assert.equal(stripped.edited, 1, 'de Worker antwoordde zonder kaart');
  assert.deepEqual(withoutMap.result.ifcSource!.sourceSlots, here.result.ifcSource!.sourceSlots, 'de terugval op deze thread vulde de kaart');
  const added = { edited: 0 };
  const plain = await readIfcBytesDetailed(bytesOf(PLAIN), {}, {
    createWorker: () => editingScanWorker(outcome => { outcome.sourceSlots = new Map(); }, added),
  });
  assert.equal(added.edited, 1, 'de Worker antwoordde met een kaart bij een eigen bestand');
  assert.equal('sourceSlots' in plain.result.ifcSource!, false, 'de terugval: geen kaart zonder vreemd deel');
});

await check('owned volgt de verwijzing zoals de lezer haar leest: direct, met het id zoals het er staat', async () => {
  const longer = BONSAI.replace("#110=IFCTASKTIME($,$,$,$,'P5D',", "#110=IFCTASKTIME($,$,$,$,'P17D',");
  assert.notEqual(longer, BONSAI);
  for (const [vorm, token, read] of [['direct', '#110', true], ['als lijst', '(#110)', false], ['met een voorloopnul', '#0110', false]] as const) {
    const src = longer.replace(",'1.2',$,$,$,.F.,$,#110,.NOTDEFINED.);", `,'1.2',$,$,$,.F.,$,${token},.NOTDEFINED.);`);
    assert(token === '#110' || src !== longer, `${vorm}: de bron is aangepast`);
    const opened = await readIfcBytesDetailed(bytesOf(src), {}, { createWorker: () => null });
    const task = opened.result.tasks.find(t => t.name === 'Wand B bouwen');
    assert.equal(task?.time.scheduleDuration === 17, read, `${vorm}: de lezer leest de taaktijd ${read ? 'wel' : 'niet'}`);
    const owned = pieceAt(slotsOf(opened.result.ifcSource), 108).owned;
    assert.equal(owned?.slots.get('scheduleDuration'), read ? "'P17D'" : undefined, `${vorm}: owned volgt de lezer`);
  }
});

await check('de opslagworker: de bron reist met haar sourceSlots heen en terug (resultFits, outputFromResult)', async () => {
  const opened = await openForeign(bytesOf(BONSAI));
  const unchangedJob = structuredClone<IfcSaveJob>({ kind: 'merge', input: { ...cloneDomain(opened), writeMode: 'merge' }, source: opened.ifcSource! });
  assert.deepEqual(unchangedJob.kind === 'merge' && unchangedJob.source.sourceSlots, opened.ifcSource!.sourceSlots, 'heen: gekloond en gelijk');
  const unchanged: unknown = structuredClone(await runIfcSaveJob(unchangedJob));
  assert(resultFits(unchangedJob, unchanged), 'het antwoord op een ongewijzigde planning past');
  assert.equal(unchanged.kind, 'merge-unchanged');
  assert.deepEqual(outputFromResult(unchangedJob, unchanged).prepared?.source.sourceSlots, opened.ifcSource!.sourceSlots,
    'ongewijzigd: de bron van het verzoek, met dezelfde sourceSlots');

  const own = await openForeign(bytesOf(OWN));
  const input = { ...cloneDomain(own), writeMode: 'merge' as const };
  input.project.description = `${input.project.description} (proef opslagworker)`;
  const job = structuredClone<IfcSaveJob>({ kind: 'merge', input, source: own.ifcSource! });
  const result: unknown = structuredClone(await runIfcSaveJob(job));
  assert(resultFits(job, result), 'het antwoord met een nieuwe bron past');
  assert.equal(result.kind, 'merge');
  const direct = await prepareIfcWrite(structuredClone(input), own.ifcSource!);
  assert.deepEqual(outputFromResult(job, result).prepared?.source.sourceSlots, direct.source.sourceSlots, 'terug: dezelfde sourceSlots als op deze thread');
  if (result.kind !== 'merge') return;
  const withSlots = { ...result, prepared: { ...result.prepared, source: { ...result.prepared.source, sourceSlots: opened.ifcSource!.sourceSlots } } };
  assert(resultFits(job, structuredClone(withSlots)), 'een gevulde kaart komt door');
  assert.deepEqual(outputFromResult(job, structuredClone(withSlots)).prepared?.source.sourceSlots, opened.ifcSource!.sourceSlots);
  const asObject = { ...result, prepared: { ...result.prepared, source: { ...result.prepared.source, sourceSlots: Object.fromEntries(opened.ifcSource!.sourceSlots!) } } };
  assert.equal(resultFits(job, asObject), false, 'sourceSlots als gewoon object: het antwoord past niet');
  const { sourceSlots: _dropped, ...withoutMap } = result.prepared.source;
  assert.equal(result.prepared.source.foreign, true, 'de nieuwe bron heeft een vreemd deel');
  assert.equal(resultFits(job, { ...result, prepared: { ...result.prepared, source: withoutMap } }), false,
    'een vreemde bron zonder kaart: het antwoord past niet');
  assert.equal(resultFits(job, { ...result, prepared: { ...result.prepared, source: { ...result.prepared.source, sourceSlots: new Map() } } }), true,
    'een lege kaart is geldig');
  assert.equal(resultFits(job, { ...result, prepared: { ...result.prepared, source: { ...withoutMap, foreign: false } } }), true,
    'een bron zonder vreemd deel zonder kaart past');
  assert.equal(resultFits(job, { ...result, prepared: { ...result.prepared, source: { ...result.prepared.source, foreign: false } } }), false,
    'een bron zonder vreemd deel met een kaart past niet');
});

await check('de bron na opslaan komt van de writer en is gelijk aan heropenen', async () => {
  const { store, snapshot } = await openInStore(bytesOf(BONSAI));
  const source = store.getState().ifcSource!;
  const unchanged = await prepareIfcWrite(cloneDomain(snapshot(store)), source);
  assert.strictEqual(unchanged.source, source, 'ongewijzigd: dezelfde bron, met haar sourceSlots');
  const own = await openInStore(bytesOf(OWN));
  const ownSource = own.store.getState().ifcSource!;
  const domain = cloneDomain(own.snapshot(own.store));
  const written = await prepareIfcWrite(await recalculated(await lengthen(domain, lengthenedTask(domain).id)), ownSource);
  assert.notStrictEqual(written.source, ownSource, 'de bewerking schrijft een nieuwe bron');
  const reopened = await openForeign(written.bytes);
  assert.deepEqual(written.source.sourceSlots, reopened.ifcSource!.sourceSlots, 'heropenen geeft dezelfde sourceSlots');
  assert.deepEqual(written.source.sourceSlots, new Map(), 'de writer schreef alles met eigen herkomst');
});

await check('tabbladwissel en Ctrl+Z: de bron houdt haar sourceSlots', async () => {
  const { store } = await openInStore(bytesOf(BONSAI));
  const source = store.getState().ifcSource!;
  const before = structuredClone(source.sourceSlots);
  const first = store.getState().activeDocumentId;
  store.getState().newDocument();
  assert.equal(store.getState().ifcSource ?? null, null, 'het nieuwe tabblad heeft geen bron');
  store.getState().switchDocument(first);
  assert.strictEqual(store.getState().ifcSource, source, 'terug: dezelfde bron');
  const task = store.getState().tasks[0];
  store.getState().updateTask(task.id, { name: `${task.name} (proef)` });
  store.getState().undo();
  assert.strictEqual(store.getState().ifcSource, source, 'na Ctrl+Z: dezelfde bron');
  assert.deepEqual(store.getState().ifcSource!.sourceSlots, before);
});

await check('crashherstel met een herstelrecord zoals vóór deze PR: de bron komt terug met haar sourceSlots', async () => {
  const bytes = bytesOf(BONSAI);
  const fresh = await openForeign(bytes);
  const reference = { sha256: fresh.ifcSource!.sha256, byteLength: bytes.length, foreign: true as const };
  const snapshot = recoveryInputFromParsed(readIFC(writeIFC(cloneDomain(fresh))), {
    id: 'herstel', filePath: null, siteFileId: null, siteFileVersion: null, foreignSource: null, isDirty: true, datesAsRecorded: false,
  });
  const recovered = await recoveryDocumentWithSource(bytes, snapshot, reference);
  assert.equal(recovered.sourceRestored, true);
  assert.deepEqual(recovered.ifcSource!.sourceSlots, fresh.ifcSource!.sourceSlots);
});

function manyForeignTasks(tasks: number, members: number): Uint8Array {
  const lines = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('','',(''),(''),'','','');",
    "FILE_SCHEMA(('IFC4X3_ADD2'));", 'ENDSEC;', 'DATA;',
    "#1=IFCAPPLICATION($,'1','Bonsai','Bonsai');", '#2=IFCOWNERHISTORY($,#1,$,.ADDED.,$,$,$,0);',
    "#3=IFCWALL('W000000000000000000000',$,$,$,$,$,$,$,$);",
  ];
  const ref = (n: number) => `#${100 + 2 * n}`;
  for (let n = 0; n < tasks; n++) {
    lines.push(`${ref(n)}=IFCTASK('T${String(n).padStart(21, '0')}',#2,'Taak',$,$,$,$,$,$,.F.,$,#${101 + 2 * n},.NOTDEFINED.);`);
    lines.push(`#${101 + 2 * n}=IFCTASKTIME($,$,$,$,'P1D',${'$,'.repeat(14)}$);`);
  }
  const related = Array.from({ length: members }, (_, n) => ref(n % tasks)).join(',');
  lines.push(`#9=IFCRELASSIGNSTOCONTROL('C000000000000000000000',#2,$,$,(${related}),$,#3);`);
  lines.push('ENDSEC;', 'END-ISO-10303-21;', '');
  return bytesOf(lines.join('\n'));
}

function countedScan(bytes: Uint8Array) {
  const index = scanStep(bytes);
  const pieces = Array.from({ length: index.count }, (_, c) => c).filter(c => index.isEntity(c) && index.type(c) !== 'IFCTASKTIME');
  let argTokens = 0, refAt = 0, mapSets = 0;
  const realArgTokens = index.argTokens.bind(index), realRefAt = index.refAt.bind(index);
  index.argTokens = (i: number) => { argTokens++; return realArgTokens(i); };
  index.refAt = (i: number, arg: number) => { refAt++; return realRefAt(i, arg); };
  const realSet = Map.prototype.set;
  Map.prototype.set = function (this: Map<unknown, unknown>, key: unknown, value: unknown) { mapSets++; return realSet.call(this, key, value); } as typeof realSet;
  let slots: Map<number, SourcePieceSlots>;
  try { slots = scanSourceSlots(index, pieces); }
  finally { Map.prototype.set = realSet; }
  return { slots, pieces: pieces.length, work: argTokens + refAt + mapSets, argTokens };
}

await check('veel taken en één relatie met tienduizenden leden: het werk groeit lineair met de stukken, niet met de leden', async () => {
  const small = countedScan(manyForeignTasks(1_000, 1_000)), large = countedScan(manyForeignTasks(4_000, 4_000));
  const growth = large.work / small.work;
  console.log(`   werk (argTokens, refAt, Map.set): 1.000 taken ${small.work}, 4.000 taken ${large.work}, groei ${growth.toFixed(2)}`);
  assert(growth < 4.5, `vier keer zoveel taken geeft ${growth.toFixed(2)} keer zoveel werk; lineair is 4`);
  assert(large.argTokens <= 2 * large.pieces, `${large.argTokens} keer argTokens voor ${large.pieces} stukken`);
  const crowded = countedScan(manyForeignTasks(10, 50_000));
  console.log(`   één relatie met 50.000 leden en 10 taken: werk ${crowded.work}`);
  assert(crowded.work < 1_000, `${crowded.work} bewerkingen: het werk hangt niet af van het aantal leden`);
  const relation = crowded.slots.get(9);
  assert.equal(relation?.slots.get('relatedObjects')?.split(',').length, 50_000, 'de ledenlijst staat heel in het token');
  assert.equal(large.slots.get(100)?.owned?.slots.get('scheduleDuration'), "'P1D'", 'de taaktijd hoort bij haar taak');
});

console.log(`sourceSlots: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
