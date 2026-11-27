import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { writeIfcx } from '@/services/ifc/ifcx';
import { LOAD_BOUNDARY_MODEL_KEYS, NODES, PATH_MODEL_KEYS, STEP_WRITER_INPUT_NOT_CARRIED, type ModelKey } from '@/services/ifc/ifcx/nodes';
import { IFCX_PLACE_OF_SAVE_KEY } from '@/services/ifc/ifcx/saveKeyPlaces';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { freshPayload } from '@/state/documentContract';
import type { FeatureFlagValues } from '@/utils/featureFlags';
import { CLOCK, encode, stepToIfcxDifferences, publicRouteProblems, withFilledGlobalIds } from './ifcxProof';
import { PROJECT_KEYS_CARRIED } from '@/services/ifc/ifcx/fields/documentFields';
import { lengthenedTask, openInStore } from './ifcAppRoute';
import { fixture } from './ifcRoundtripFixture';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const IFCX_ON: FeatureFlagValues = { ifcx: true };

let passed = 0, failed = 0;
async function test(name: string, action: () => void | Promise<void>): Promise<void> {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 3000)}`); }
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const saveInput = (store: Store): WriteIFCInput => structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
const openedInApp = async (bytes: Uint8Array, name: string): Promise<Store> => (await openInStore(bytes, name, IFCX_ON)).store;

interface Planning { readonly name: string; readonly file: string; readonly bytes: Uint8Array }
const filesIn = (folder: string): Planning[] => readdirSync(join(root, folder)).filter(name => name.endsWith('.ifc')).sort()
  .map(name => ({ name, file: name, bytes: new Uint8Array(readFileSync(join(root, folder, name))) }));
const examples = filesIn('public/examples');
const oldTags = filesIn('tests/planning/fixtures/oude-tags');
const plannings: readonly Planning[] = [
  ...examples, ...oldTags,
  { name: 'de maximaal gevulde fixture van check-ifc-roundtrip', file: 'fixture.ifc', bytes: encode(writeIFC(fixture)) },
];

await test('de acht voorbeelden, de elf bestanden van oude releases en de fixture', () => {
  assert.equal(examples.length, 8);
  assert.equal(oldTags.length, 11);
});

for (const planning of plannings) {
  const read = readIFC(new TextDecoder().decode(planning.bytes));
  await test(`${planning.name}, rechtstreeks: slaat volledig op als IFCX en opent als de eerste STEP-lezing na de laadgrens, ook na een tweede opslag`, () => {
    assert.deepEqual(publicRouteProblems(planning.name, read, writeIfcx(read, CLOCK)), []);
  });
  await test(`${planning.name}, geopend in de app met de opslaginvoer van Ctrl+S: slaat volledig op als IFCX en opent als de eerste STEP-lezing na de laadgrens, ook na een tweede opslag`, async () => {
    const input = saveInput(await openedInApp(planning.bytes, planning.file));
    assert.deepEqual(publicRouteProblems(`${planning.name} in de app`, input, writeIfcx(input, CLOCK)), []);
  });
}

interface Edit { readonly taskId: string; readonly typeId: string; readonly valueId: string; readonly fieldId: string }

function editInApp(store: Store): Edit {
  const taskId = lengthenedTask(saveInput(store)).id;
  const typeId = store.getState().addActivityCodeType('Zone');
  const valueId = store.getState().addActivityCodeValue(typeId, { code: 'Z1', description: 'Zone 1' });
  store.getState().setTaskActivityCode(taskId, typeId, valueId);
  const fieldId = store.getState().addCustomField('Controle', 'text');
  store.getState().setTaskCustomField(taskId, fieldId, 'Gecontroleerd');
  store.getState().setTaskWorkRule(taskId, 'FIXED_WORK');
  return { taskId, typeId, valueId, fieldId };
}

function assertEdited(input: WriteIFCInput, edit: Edit, label: string): void {
  const task = input.tasks.find(item => item.id === edit.taskId);
  assert.ok(task, `${label}: de taak ${edit.taskId}`);
  assert.equal(task.activityCodes?.[edit.typeId], edit.valueId, `${label}: de code`);
  assert.equal(task.customFields?.[edit.fieldId], 'Gecontroleerd', `${label}: het eigen veld`);
  assert.equal(task.workRule, 'FIXED_WORK', `${label}: de werkregel`);
  assert.equal(task.time.durationUnit, 'hours', `${label}: vast werk staat in de urenmaat`);
  assert.ok(input.activityCodeTypes?.some(type => type.id === edit.typeId && type.values.some(value => value.id === edit.valueId)), `${label}: de codesoort`);
  assert.ok(input.customFieldDefs?.some(def => def.id === edit.fieldId && def.type === 'text'), `${label}: de definitie van het eigen veld`);
}

async function reopenedPair(stepInput: WriteIFCInput, ifcxInput: WriteIFCInput): Promise<{ step: Store; ifcx: Store }> {
  return {
    step: await openedInApp(encode(writeIFC(stepInput)), 'plan.ifc'),
    ifcx: await openedInApp(encode(writeIfcx(ifcxInput, CLOCK)), 'plan.ifcx'),
  };
}

const EDITED: readonly Planning[] = [
  oldTags.find(planning => planning.name === 'v2026.9.0-urentaak-10-villa-wassenaar.ifc')!,
  examples.find(planning => planning.name === 'showcase-rijwoningen-de-akkers.ifc')!,
];

for (const planning of EDITED) {
  await test(`${planning.name}: een code, een eigen veld en vast werk op een taak, in de app; STEP en IFCX uit dezelfde opslaginvoer openen in de app als dezelfde planning, ook na opnieuw opslaan en heropenen`, async () => {
    const store = await openedInApp(planning.bytes, planning.file);
    const edit = editInApp(store);
    const input = saveInput(store);
    assertEdited(input, edit, 'na de bewerking');
    const first = await reopenedPair(input, input);
    assert.equal(first.ifcx.getState().fileFormat, 'ifcx');
    assertEdited(saveInput(first.ifcx), edit, 'na heropenen van IFCX');
    assert.deepEqual(stepToIfcxDifferences(withFilledGlobalIds(saveInput(first.step)), saveInput(first.ifcx)), [], 'na heropenen');
    const second = await reopenedPair(saveInput(first.step), saveInput(first.ifcx));
    assertEdited(saveInput(second.ifcx), edit, 'na de tweede opslag');
    assert.deepEqual(stepToIfcxDifferences(withFilledGlobalIds(saveInput(second.step)), saveInput(second.ifcx)), [], 'na opnieuw opslaan en heropenen');
  });
}

const CARRIED = new Set<ModelKey>([...NODES.flatMap(node => node.modelKeys), ...PATH_MODEL_KEYS, ...LOAD_BOUNDARY_MODEL_KEYS]);

await test('elk veld van IFC_SAVE_KEYS heeft een plek in IFCX of een benoemde uitzondering', () => {
  assert.equal(IFCX_PLACE_OF_SAVE_KEY.project.stepOnlyProjectField, 'ifcSchemaUnconfirmed');
  assert.ok(!PROJECT_KEYS_CARRIED.includes('ifcSchemaUnconfirmed'));
  assert.ok(PROJECT_KEYS_CARRIED.includes('ifcSchema'));
  const wrong: string[] = [];
  for (const [saveKey, place] of Object.entries(IFCX_PLACE_OF_SAVE_KEY)) {
    if ('carriedAs' in place) {
      for (const key of place.carriedAs) {
        if (CARRIED.has(key)) continue;
        wrong.push(`${saveKey}: ${key} heeft geen plek`);
      }
    } else if (place.exception === 'xer-archive') {
      for (const key of place.modelKeys) if (!STEP_WRITER_INPUT_NOT_CARRIED.includes(key)) wrong.push(`${saveKey}: ${key} weigert de writer niet`);
    }
  }
  assert.deepEqual(wrong, []);
});

await test('wat geen plek heeft omdat de STEP-schrijver het niet krijgt, verandert de schrijverinvoer niet', () => {
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
