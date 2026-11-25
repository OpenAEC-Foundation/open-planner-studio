import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { IfcxWriteRefusedError, writeIfcx } from '@/services/ifc/ifcx';
import { LOAD_BOUNDARY_MODEL_KEYS, NODES, PATH_MODEL_KEYS, STEP_WRITER_INPUT_NOT_CARRIED, type ModelKey } from '@/services/ifc/ifcx/nodes';
import { IFCX_PLACE_OF_SAVE_KEY } from '@/services/ifc/ifcx/saveKeyPlaces';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { freshPayload } from '@/state/documentContract';
import type { ImportResult } from '@/services/importTypes';
import { attempt, CLOCK, publicRouteProblems, saveInputViaApp, withoutResourceData } from './ifcxProof';
import { fixture } from './ifcRoundtripFixture';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const examplesDir = join(root, 'public/examples');

let passed = 0, failed = 0;
function test(name: string, action: () => void): void {
  try { action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 3000)}`); }
}

const AWAITING_F3_2_MODEL_KEYS: readonly ModelKey[] = [
  'resources', 'assignments', 'baselines', 'activeBaselineId', 'comparedBaselineIds', 'baselineOrphanGuids',
];
const AWAITING_F3_2_FIELDS = new Set<string>([...AWAITING_F3_2_MODEL_KEYS, 'task.resourceIds', 'task.timephasedContours']);

const plannings: readonly (readonly [string, ImportResult])[] = [
  ...readdirSync(examplesDir).filter(name => name.endsWith('.ifc')).sort()
    .map(name => [name, readIFC(readFileSync(join(examplesDir, name), 'utf8'))] as const),
  ['de maximaal gevulde fixture van check-ifc-roundtrip', fixture],
];

test('er zijn acht voorbeelden en de fixture', () => assert.equal(plannings.length, 9));

for (const [name, full] of plannings) {
  const routes: readonly (readonly [string, WriteIFCInput])[] = [[name, full], [`${name} via de app`, saveInputViaApp(full)]];
  for (const [route, input] of routes) {
    test(`${route}: alleen wat F3-2 draagt, weigert de writer, met de velden in de melding`, () => {
      const outcome = attempt(() => writeIfcx(input, CLOCK));
      if (outcome.ok) {
        assert.deepEqual(publicRouteProblems(route, input, outcome.value), []);
        console.log('   geschreven: de planning heeft niets van F3-2');
        return;
      }
      assert.ok(outcome.error instanceof IfcxWriteRefusedError, String(outcome.error));
      assert.equal(outcome.error.code, 'unsupported', outcome.error.message);
      const other = outcome.error.fields.filter(field => !AWAITING_F3_2_FIELDS.has(field));
      assert.deepEqual(other, [], `velden buiten F3-2: ${outcome.error.message}`);
      for (const field of outcome.error.fields) assert.ok(outcome.error.message.includes(field), `${field} staat niet in de melding`);
      console.log(`   wacht op F3-2: ${outcome.error.fields.join(', ')}`);
    });
  }
  const own = withoutResourceData(full);
  for (const [route, input] of [[name, own], [`${name} via de app`, saveInputViaApp(own)]] as const) {
    test(`${route}, zonder resources, toewijzingen en baselines: IFCX opent als de eerste STEP-lezing na de laadgrens, ook na een tweede opslag`, () => {
      const text = writeIfcx(input, CLOCK);
      assert.deepEqual(publicRouteProblems(route, input, text), []);
    });
  }
}

const CARRIED = new Set<ModelKey>([...NODES.flatMap(node => node.modelKeys), ...PATH_MODEL_KEYS, ...LOAD_BOUNDARY_MODEL_KEYS]);

test('elk veld van IFC_SAVE_KEYS heeft een plek in IFCX of een benoemde uitzondering', () => {
  const wrong: string[] = [];
  for (const [saveKey, place] of Object.entries(IFCX_PLACE_OF_SAVE_KEY)) {
    if ('carriedAs' in place) {
      for (const key of place.carriedAs) {
        if (CARRIED.has(key)) continue;
        if (AWAITING_F3_2_MODEL_KEYS.includes(key) && STEP_WRITER_INPUT_NOT_CARRIED.includes(key)) continue;
        wrong.push(`${saveKey}: ${key} heeft geen plek`);
      }
    } else if (place.exception === 'xer-archive') {
      for (const key of place.modelKeys) if (!STEP_WRITER_INPUT_NOT_CARRIED.includes(key)) wrong.push(`${saveKey}: ${key} weigert de writer niet`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('wat geen plek heeft omdat de STEP-schrijver het niet krijgt, verandert de schrijverinvoer niet', () => {
  const payload = freshPayload();
  const plain = buildWriteIFCInput(payload as unknown as IFCSaveSource, 'planOnly');
  const marked = buildWriteIFCInput({
    ...payload, foreignSourceMark: { sha256: 'a'.repeat(64), byteLength: 1 }, ifcSource: { kind: 'path', path: '/elders/bron.ifc' },
  } as unknown as IFCSaveSource, 'planOnly');
  const notWritten = Object.entries(IFCX_PLACE_OF_SAVE_KEY).filter(([, place]) => 'exception' in place && place.exception === 'not-written');
  assert.deepEqual(notWritten.map(([key]) => key).sort(), ['foreignSourceMark', 'ifcSource']);
  assert.deepEqual(marked, plain);
});

console.log(`IFCX-velden: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed) process.exitCode = 1;
