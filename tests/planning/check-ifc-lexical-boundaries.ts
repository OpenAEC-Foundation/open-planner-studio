import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { scanTargetBytes, scanTargetSource } from '@/services/ifc/foreign/targetModelScan';

// Het vaste voorbeeld is een volledig IFC-bestand. Alleen de onderzochte naam/commentaar verandert.
const source = readFileSync('public/examples/showcase-appartementencomplex.ifc', 'utf8');
const original = 'CPT soundings & soil investigation';
const baseline = readIFC(source).tasks.map(t => t.name);
const enc = new TextEncoder();
let checks = 0;
let failures = 0;
async function check(label: string, run: () => unknown | Promise<unknown>) {
  checks++;
  try { await run(); } catch (error) { failures++; console.error('XX', label, String(error)); }
}
const insert = (fragment: string) => {
  const at = source.lastIndexOf('ENDSEC;');
  return source.slice(0, at) + fragment + '\n' + source.slice(at);
};
const wall = "#99999=IFCWALL('0wall00000000000000000',$,'Wall',$,$,$,$,$,$);";
for (const [raw, expected] of [
  ["a\\S\\'", 'a§'],
  ["a\\S\\', (x); #99999=IFCWALL($); /* tekst */", 'a§, (x); #99999=IFCWALL($); /* tekst */'],
  ["a\\S\\'''b", "a§'b"],
  ["a\\\\S\\\\''b", "a\\S\\'b"],
] as const) {
  const input = source.replace(`'${original}'`, `'${raw}'`);
  const want = baseline.map(n => n === original ? expected : n);
  await check(`shiftliteral ${raw}: openen en heropenen`, () => {
    const opened = readIFC(input);
    assert.deepEqual(opened.tasks.map(t => t.name), want);
    const reopened = readIFC(writeIFC(buildWriteIFCInput(payloadFromImport(opened, null))));
    assert.deepEqual(reopened.tasks.map(t => t.name), want);
  });
  await check(`shiftliteral ${raw}: bytes-route`, async () => {
    assert.deepEqual((await readIfcBytes(enc.encode(input), {}, { createWorker: () => null })).tasks.map(t => t.name), want);
  });
  await check(`shiftliteral ${raw}: doelcontrole`, () => assert.equal(scanTargetBytes(enc.encode(input)), 'no-model'));
}
for (const control of ['\n', '\r', '\t', '\0', '\x1f', '\x7f']) {
  const fragment = `/${control}* ${wall} */`;
  const commented = insert(fragment);
  // Dezelfde geldige kop met een kleine datasectie: elke bytegrens testen kost zo geen miljoenen microtaken.
  const streamText = source.slice(0, source.indexOf('DATA;') + 5)
    + "\n#1=IFCTASK('g',$,'Taak',$,$,'1',$,$,$,.F.,$,$,.CONSTRUCTION.);\n"
    + fragment + '\nENDSEC;\nEND-ISO-10303-21;';
  await check(`commentaarstart ${JSON.stringify(control)}: geen model`, async () => {
    assert.deepEqual(readIFC(commented).tasks.map(t => t.name), baseline);
    assert.equal(scanTargetBytes(enc.encode(commented)), 'no-model');
    const opened = await readIfcBytes(enc.encode(commented), {}, { createWorker: () => null });
    assert.deepEqual(opened.tasks.map(t => t.name), baseline);
    assert.equal(opened.ifcSource?.foreign ?? false, false);
  });
  const exposed = insert(`/* tekst *${control}/ ${wall} /* tekst */`);
  await check(`commentaareinde ${JSON.stringify(control)}: model geweigerd`, () => {
    assert.throws(() => readIFC(exposed), (e: unknown) => (e as { reason?: string }).reason === 'building-model');
    assert.equal(scanTargetBytes(enc.encode(exposed)), 'model');
  });
  for (const size of [1, 2, 7]) {
    await check(`stroom ${size}, ${JSON.stringify(control)}: dezelfde grens`, async () => {
      const bytes = enc.encode(streamText);
      let at = 0;
      const got = await scanTargetSource({
        next: async () => { if (at === bytes.length) return null; const b = bytes.subarray(at, at + size); at += b.length; return b; },
        seek: async (offset) => { at = offset; },
      });
      assert.equal(got, 'no-model');
    });
  }
}
console.log(`${checks} controles, ${failures} fouten`);
process.exitCode = failures ? 1 : 0;
