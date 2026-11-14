// #804, PR 7e: tijd laten verstrijken op de echte bytes-openroute, zonder wachten of herhalen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { prepareIfcWrite, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { openInStore, lengthen, lengthenedTask, storeEdit } from './ifcAppRoute';
import { concat, mergeProblems } from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RealDate = Date, realRandom = Math.random;
const BASE = RealDate.UTC(2026, 10, 14, 11, 11, 48);
const reseed = installDeterminism();
let now = BASE, boundary = Infinity, canons = 0;
// De klok telt de ene datumingang van iedere canon, zowel op de basis als na de reparatie.
// Ook de vaste datum heeft een constructor; de overige datumconversies tellen niet mee.
class Clock extends RealDate {
  constructor(...args: unknown[]) {
    const stack = new Error().stack ?? '';
    if (stack.includes('at planningCanon (') &&
      ((!args.length && stack.includes('at writeIfcParts (')) || stack.split('\n')[2]?.includes('at writeIFCForComparison ('))) {
      if (++canons >= boundary) now = BASE + 1000;
    }
    if (args.length) super(...args as [number]); else super(now);
  }
  static now() { return now; }
}
globalThis.Date = Clock as DateConstructor;
const modes = ['vast', 'eerste-grens', 'laatste-grens', 'milliseconde', 'uur'] as const;
type Mode = typeof modes[number];
function clock(mode: Mode = 'vast') {
  canons = 0;
  boundary = mode === 'eerste-grens' ? 2 : mode === 'laatste-grens' ? 4 : Infinity;
  now = BASE + (mode === 'milliseconde' ? 1 : mode === 'uur' ? 3600000 : 0);
}
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
function identical(output: Uint8Array, source: Uint8Array) {
  assert.equal(output.length, source.length, 'de bronlengte blijft exact');
  assert.equal(sha(output), sha(source), 'de bronbytes blijven exact');
}
function realWriteClock(output: Uint8Array | string) {
  const text = typeof output === 'string' ? output : new TextDecoder().decode(output);
  assert(!text.includes('1970-01-01T00:00:00'), 'de vergelijkingsdatum lekt niet naar uitvoer');
  assert(!/=IFCOWNERHISTORY\([^\n]*,0\);/.test(text), 'ook de owner history houdt de echte schrijfklok');
}
let passed = 0, failed = 0;
async function check(name: string, action: () => void | Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error).slice(0, 1200)}`); }
}
async function outcome(input: WriteIFCInput, source: IfcSource) {
  try {
    const prepared = await prepareIfcWrite(input, source);
    const bytes = concat(prepared.parts);
    realWriteClock(bytes);
    return { kind: 'geschreven', bytes } as const;
  } catch (error) {
    if (!(error instanceof MergeNeedsPhase2Error)) throw error;
    return { kind: 'geweigerd', reasons: [...new Set(error.cases.map(c => c.kind))].sort() } as const;
  }
}

try {
  const own = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
  const office = readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8');
  const wall = [
    "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
    "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
    '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);',
    "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
  ].join('\n');
  const at = office.lastIndexOf('ENDSEC;');
  const withWall = new TextEncoder().encode(`${office.slice(0, at)}${wall}\n${office.slice(at)}`);
  const fixtures = [
    ['eigen-plus-model', own], ['kantoor-plus-wand', withWall],
    ['latin1', new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/latin1.ifc')))],
  ] as const;
  for (const [name, bytes] of fixtures) {
    clock(); reseed(0x804);
    const { store } = await openInStore(bytes, `${name}.ifc`);
    const state = store.getState(), source = state.ifcSource!;
    assert(source?.foreign, `${name}: echte vreemde bytes-openroute`);
    const input = buildWriteIFCInput(state, 'merge');
    for (const mode of modes) await check(`${name}: onbewerkt / ${mode}`, async () => {
      clock(mode);
      identical(concat((await prepareIfcWrite(input, source)).parts), bytes);
      assert.equal(canons, 4, 'ook de laatste twee canons zijn doorlopen');
      clock(mode);
      const output = await prepareIfcOutput(state, input);
      assert(output.prepared);
      identical(concat(output.prepared.parts), bytes);
      assert.equal(canons, 4);
    });
    clock('milliseconde');
    const edits: [string, WriteIFCInput][] = [
      ['duur', await lengthen(input, lengthenedTask(input).id)],
      ['taak-erbij', await storeEdit(input, s => { s.addTask({ name: 'Kloktaak', position: { anchorId: lengthenedTask(input).id, where: 'below' } }, { phaseAssignments: 'move', answered: true }); })],
      ['projectnaam', await storeEdit(input, s => { s.updateProject({ name: 'Echte projectwijziging' }); })],
    ];
    for (const [edit, changed] of edits) {
      clock();
      const reference = await outcome(changed, source);
      for (const mode of modes) await check(`${name}: ${edit} / ${mode}`, async () => {
        assert.notEqual(planningCanon(changed), planningCanon(input), 'echte bewerking telt mee');
        assert.notEqual(changed.project.modifiedAt, input.project.modifiedAt, 'de echte actie wijzigt modifiedAt');
        if (name !== 'latin1' && edit === 'duur') assert.equal(reference.kind, 'geschreven', 'de gewone duuractie blijft schrijven');
        clock(mode);
        const actual = await outcome(changed, source);
        assert.equal(actual.kind, reference.kind);
        if (actual.kind === 'geweigerd' && reference.kind === 'geweigerd') assert.deepEqual(actual.reasons, reference.reasons);
        if (actual.kind === 'geschreven') {
          assert.notEqual(sha(actual.bytes), sha(bytes), 'bewerkt gaat door de merge');
          assert.deepEqual(mergeProblems(bytes, actual.bytes), []);
        }
      });
    }
    await check(`${name}: gewijzigde projecttijdstempel blijft meetellen`, () => {
      const changed = structuredClone(input);
      changed.project.modifiedAt = new RealDate(BASE + 3600000).toISOString();
      assert.notEqual(planningCanon(changed), planningCanon(input));
    });
  }

  await check('terugval is per ontbrekend projectveld; gewoon openen houdt zijn klok', () => {
    clock();
    const original = readIFC(office).project;
    const fallback = { createdAt: '2040-01-02T03:04:05.000Z', modifiedAt: '2041-02-03T04:05:06.000Z' };
    for (const [property, field, present] of [
      ['CreatedAt', 'createdAt', 'modifiedAt'], ['ModifiedAt', 'modifiedAt', 'createdAt'],
    ] as const) {
      const missing = office.replace(`'${property}'`, `'Ontbrekend${property}'`);
      assert.notEqual(missing, office);
      clock('milliseconde');
      const ordinary = readIFC(missing).project;
      assert.equal(ordinary[field], new RealDate(BASE + 1).toISOString());
      const reread = readIFC(missing, {}, { projectTimestampFallback: fallback }).project;
      assert.equal(reread[field], fallback[field]);
      assert.equal(reread[present], original[present], 'opgeslagen waarde wint van de terugval');
    }
  });

  await check('echte opgeslagen projectdatums blijven leidend bij de herlezing', async () => {
    clock();
    const { store } = await openInStore(own);
    const input = buildWriteIFCInput(store.getState(), 'merge');
    for (const field of ['CreatedAt', 'ModifiedAt'] as const) {
      const original = new TextDecoder().decode(own);
      const tampered = original.replace(new RegExp(`'${field}',\\$,IFCTEXT\\('[^']*'\\)`), `'${field}',$,IFCTEXT('2031-02-03T04:05:06.000Z')`);
      assert.notEqual(tampered, original, `${field}: de uitvoer is werkelijk gemuteerd`);
      const { store: reread } = await openInStore(new TextEncoder().encode(tampered));
      // Ongewijzigde-byte-uitvoer met een andere opgeslagen datum: de scan/kaart is geldig,
      // maar de vaste herlezing moet het verschil met de oorspronkelijke planning zien.
      const source = { ...reread.getState().ifcSource!, opened: input };
      await assert.rejects(() => prepareIfcWrite(input, source), (e: unknown) =>
        e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen'));
    }
  });

  await check('lege planstart en baseline zonder eigen datum hebben dezelfde vergelijkingsklok', async () => {
    clock();
    const { store } = await openInStore(own);
    store.getState().saveBaseline('Klokbaseline');
    const input = structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
    input.tasks = []; input.sequences = []; input.assignments = [];
    input.project.startDate = ''; input.project.endDate = '';
    input.baselines![0].createdAt = '';
    const before = planningCanon(input);
    clock('uur');
    assert.equal(planningCanon(input), before);
    input.baselines![0].createdAt = '2032-03-04T05:06:07.000Z';
    assert.notEqual(planningCanon(input), before, 'een echte baseline-aanmaakdatum telt wel mee');
  });

  // Gemeten op basis 648a75c0db458ff1f274da8b7c8ffeba1a2054aa, dezelfde invoer,
  // klok BASE, TZ=Europe/Amsterdam en seed 0x804. Referentie wordt nooit tijdens de check gemaakt.
  const writerReference: { name: string; bytes: number; sha256: string }[] = [
  {
    "name": "03-kantoorgebouw-zuidas.ifc",
    "bytes": 86375,
    "sha256": "730410007944b6f0d10a82ac8a5c81ee013958b4879f4f64f999520f78cd8718"
  },
  {
    "name": "10-villa-wassenaar.ifc",
    "bytes": 59137,
    "sha256": "5a2c4c53997e172af8a71d2e70aed83c04fa66d048ee848aad6e94f5c16cbf09"
  },
  {
    "name": "showcase-verbouwing-eengezinswoning.ifc",
    "bytes": 32622,
    "sha256": "62b90d8aaade89669c2a4f75f47dcf280be241b81c2e3980a2609d120c33ebb8"
  }
];
  for (const row of writerReference) await check(`gewone writer bytegelijk aan basis: ${row.name}`, async () => {
    const zone = process.env.TZ; process.env.TZ = 'Europe/Amsterdam';
    try {
      clock(); reseed(0x804);
      const input = readIFC(readFileSync(join(root, 'public/examples', row.name), 'utf8'));
      const output = writeIFC(input);
      assert.equal(Buffer.byteLength(output), row.bytes);
      assert.equal(sha(output), row.sha256);
      realWriteClock(output);
      const { store } = await openInStore(new TextEncoder().encode(output));
      const prepared = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      realWriteClock(concat(prepared.parts));
      const regular = await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'));
      assert.equal(typeof regular.content, 'string'); realWriteClock(regular.content!);
    } finally { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; }
  });

  await check('Opslaan als download en Opslaan als siteversie bevatten uitsluitend de echte schrijfklok', async () => {
    clock();
    const { store } = await openInStore(own);
    const state = store.getState(), task = lengthenedTask(buildWriteIFCInput(state, 'merge'));
    state.updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    const element = document.createElement, body = document.body;
    let downloaded: Blob | undefined, version: Blob | undefined;
    URL.createObjectURL = blob => { downloaded = blob as Blob; return 'blob:klok'; };
    URL.revokeObjectURL = () => {};
    const doc = document as unknown as Record<string, unknown>;
    doc.createElement = () => ({ style: {}, click() {}, remove() {} });
    doc.body = { appendChild() {} };
    const win = window as unknown as Record<string, unknown>;
    try {
      clock('uur');
      await store.getState().saveFileAs();
      assert(downloaded, 'de echte downloadroute heeft bytes');
      const output = new Uint8Array(await downloaded.arrayBuffer());
      realWriteClock(output); assert.notEqual(sha(output), sha(own));
      win.openaecHost = { storage: {
        list: async () => [], versions: async () => [],
        save: async (request: { data: Blob }) => { version = request.data; return { id: 'klokbestand', name: 'klok.ifc', version: 'v2' }; },
      } };
      store.setState(s => {
        s.filePath = null; s.fileHandle = null; s.siteFileId = 'klokbestand'; s.siteFileVersion = 'v1';
        s.foreignSourceMark = { ...s.foreignSourceMark!, filePath: null, siteFileId: 'klokbestand' };
      });
      await store.getState().saveFile();
      assert(version, 'de echte siteversieroute heeft bytes');
      realWriteClock(new Uint8Array(await version.arrayBuffer()));
    } finally {
      URL.createObjectURL = create; URL.revokeObjectURL = revoke;
      doc.createElement = element; doc.body = body; delete win.openaecHost;
    }
  });
} finally { globalThis.Date = RealDate; Math.random = realRandom; }
console.log(`IFC-klok: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed) process.exitCode = 1;
