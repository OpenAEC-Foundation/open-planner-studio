// #804, knownbug 1131 stap 3: de TypeScript-ingang van `place_file_exclusive`. De Rust-kant draait
// in `cargo test place_file`; deze proef legt vast dat de ingang elke uitkomst van het commando op
// dezelfde `code` leest (dezelfde JSON als `place_file_uitkomsten_hebben_vaste_codes`), dat alles wat
// er niet op lijkt `io` wordt, en dat er buiten Tauri niets wordt aangeroepen.
import assert from 'node:assert/strict';
import { placeFileExclusive, type PlaceFileOutcome } from '@/services/fileAccess/placeFileExclusive';

let passed = 0;
let failed = 0;
async function check(name: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}`, error); }
}

const calls: Array<{ command: string; args: unknown }> = [];
let answer: { resolve?: unknown; reject?: unknown } = {};
function installTauri() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: unknown) => {
          calls.push({ command, args });
          if ('reject' in answer) throw answer.reject;
          return answer.resolve;
        },
      },
    },
  });
}

const FROM = '/home/planner/project/save-mhx1q2k9ab3.ops-save.tmp';
const TO = '/home/planner/project/doel.ifc';

// Letterlijk de JSON uit de Rust-proef `place_file_uitkomsten_hebben_vaste_codes`.
const placed: Array<[string, PlaceFileOutcome]> = [
  ['{"code":"placed"}', { code: 'placed' }],
  ['{"code":"dir-not-synced","message":"m"}', { code: 'dir-not-synced', message: 'm' }],
];
const refusedByRust: Array<[string, PlaceFileOutcome]> = [
  ['{"code":"target-exists"}', { code: 'target-exists' }],
  ['{"code":"unsupported","message":"m"}', { code: 'unsupported', message: 'm' }],
  ['{"code":"io","message":"m"}', { code: 'io', message: 'm' }],
  ['{"code":"source-changed","restored":true}', { code: 'source-changed', restored: true }],
  ...(['path-shape', 'helper-name', 'scope', 'not-regular-file'] as const).map((reason): [string, PlaceFileOutcome] =>
    [`{"code":"refused","reason":"${reason}"}`, { code: 'refused', reason }]),
];

async function main() {
  await check('buiten Tauri: unsupported, geen aanroep', async () => {
    assert.equal('window' in globalThis, false);
    assert.deepEqual(await placeFileExclusive(FROM, TO), { code: 'unsupported', message: 'not-tauri' });
  });

  installTauri();

  await check('het commando krijgt precies from en to', async () => {
    calls.length = 0;
    answer = { resolve: JSON.parse('{"code":"placed"}') };
    await placeFileExclusive(FROM, TO);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'place_file_exclusive');
    assert.deepEqual(calls[0].args, { from: FROM, to: TO });
  });

  await check('geslaagde uitkomsten', async () => {
    for (const [json, expected] of placed) {
      answer = { resolve: JSON.parse(json) };
      assert.deepEqual(await placeFileExclusive(FROM, TO), expected, json);
    }
  });

  await check('fouten van het commando', async () => {
    for (const [json, expected] of refusedByRust) {
      answer = { reject: JSON.parse(json) };
      assert.deepEqual(await placeFileExclusive(FROM, TO), expected, json);
    }
  });

  await check('onbekende vorm wordt io, nooit placed', async () => {
    const odd: Array<[unknown, PlaceFileOutcome]> = [
      // Een oudere app zonder het commando weigert met een tekst.
      ['Command place_file_exclusive not found', { code: 'io', message: 'Command place_file_exclusive not found' }],
      [{ code: 'refused', reason: 'iets-anders' }, { code: 'io', message: '{"code":"refused","reason":"iets-anders"}' }],
      [{ code: 'geplaatst' }, { code: 'io', message: '{"code":"geplaatst"}' }],
      [{ code: 'source-changed' }, { code: 'io', message: '{"code":"source-changed"}' }],
      [null, { code: 'io', message: 'null' }],
    ];
    for (const [value, expected] of odd) {
      answer = { reject: value };
      assert.deepEqual(await placeFileExclusive(FROM, TO), expected, String(value));
      answer = { resolve: value };
      assert.deepEqual(await placeFileExclusive(FROM, TO), expected, String(value));
    }
  });

  console.log(`\n${passed} OK, ${failed} XX`);
  if (failed > 0) process.exit(1);
}

void main();
