import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { IfcForeignOpenError, readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { scanForeign } from '@/services/ifc/foreign/foreignScan';
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
// Fase 1c: de gewone lezer blijft tolerant. De bytes-route mag na een scannerweigering geen onbeveiligd
// document leveren, ook niet bij deze gemaakte varianten zonder model. Geen lexeruitzondering voor de proef.
async function bytesNamesOrRefusal(text: string, want: readonly string[]) {
  const bytes = enc.encode(text);
  const scan = scanForeign(bytes);
  if (!scan.ok) {
    await assert.rejects(() => readIfcBytes(bytes, {}, { createWorker: () => null }),
      (error: unknown) => error instanceof IfcForeignOpenError && error.code === 'IFC_FOREIGN_OPEN_REFUSED'
        && error.fallback.kind === 'scanner' && error.fallback.reason === scan.reason);
    return undefined;
  }
  const opened = await readIfcBytes(bytes, {}, { createWorker: () => null });
  assert.deepEqual(opened.tasks.map(t => t.name), want);
  return opened;
}
const insert = (fragment: string) => {
  const at = source.lastIndexOf('ENDSEC;');
  return source.slice(0, at) + fragment + '\n' + source.slice(at);
};
const wall = "#99999=IFCWALL('0wall00000000000000000',$,'Wall',$,$,$,$,$,$);";
await check('doelcontrole zoekt lineair door veel korte strings zonder backslashes', () => {
  const input = source.slice(0, source.indexOf('DATA;') + 5)
    + "\n#1=IFCTASK('x',$);\n".repeat(4000) + 'ENDSEC;\nEND-ISO-10303-21;';
  const bytes = enc.encode(input);
  let searched = 0;
  const indexOf = bytes.indexOf.bind(bytes);
  bytes.indexOf = (value, from = 0) => {
    const found = indexOf(value, from);
    searched += (found < 0 ? bytes.length : found + 1) - from;
    return found;
  };
  assert.equal(scanTargetBytes(bytes), 'no-model');
  // Meet doorzochte bytes, geen wandkloklimiet die van de runner afhangt.
  assert.ok(searched <= bytes.length * 50, `${searched} doorzochte bytes bij ${bytes.length} bronbytes`);
});
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
    await bytesNamesOrRefusal(input, want);
  });
  await check(`shiftliteral ${raw}: doelcontrole`, () => assert.equal(scanTargetBytes(enc.encode(input)), 'no-model'));
}
// De planningparser leest de eerste datasectie: een applicatie in een latere sectie mag haar tekst niet omduiden.
await check('tekstversie uit latere DATA verandert de eerste planning niet', () => {
  const external = source.replace(",'OPS');", ",'THIRD');").replace(/'OPS_/g, "'EXT_");
  const at = external.lastIndexOf('ENDSEC;');
  const extra = external.slice(0, at) + "ENDSEC;\nDATA;\n#99999=IFCAPPLICATION($,'0.1','Open Planner Studio','OPS');\n" + external.slice(at);
  const name = "a\\S\\'";
  const withShift = extra.replace(`'${original}'`, `'${name}'`);
  const expected = readIFC(external.replace(`'${original}'`, `'${name}'`)).tasks.map(t => t.name);
  assert.equal(expected.length, baseline.length);
  assert.ok(expected.includes('a§'));
  assert.deepEqual(readIFC(withShift).tasks.map(t => t.name), expected);
});
// Oude OPS 0.1 schreef backslashes letterlijk. De dialectkeuze moet vóór de quotegrenzen gelden.
const legacySource = source.replace("'0.2','Open Planner Studio','OPS'", "'0.1','Open Planner Studio','OPS'");
assert.notEqual(legacySource, source);
const legacyBaseline = readIFC(legacySource).tasks.map(t => t.name);
for (const [label, text, want] of [
  ['oud letterlijk pad', legacySource.replace(`'${original}'`, "'Pad C:\\S\\'"), legacyBaseline.map(n => n === original ? 'Pad C:\\S\\' : n)],
  ['tolerant letterlijk pad', source.replace(`'${original}'`, "'Pad C:\\S\\'"), baseline.map(n => n === original ? 'Pad C:\\S\\' : n)],
  ['CRLF na backslash', source.replace(`'${original}'`, "'a\\\r\nb'"), baseline.map(n => n === original ? 'a\\\r\nb' : n)],
] as const) {
  for (const bytesRoute of [false, true]) {
    await check(`${label}, bytes=${bytesRoute}: openen en opslaan/heropenen`, async () => {
      const opened = bytesRoute ? await readIfcBytes(enc.encode(text), {}, { createWorker: () => null }) : readIFC(text);
      assert.deepEqual(opened.tasks.map(t => t.name), want);
      const saved = writeIFC(buildWriteIFCInput(payloadFromImport(opened, null)));
      const reopened = bytesRoute ? await readIfcBytes(enc.encode(saved), {}, { createWorker: () => null }) : readIFC(saved);
      assert.deepEqual(reopened.tasks.map(t => t.name), want);
      assert.equal(scanTargetBytes(enc.encode(text)), 'no-model');
    });
  }
}
await check('tolerante quotegrenzen bij expliciete literalStepIds-route', () => {
  const text = source.replace(`'${original}'`, "'Pad C:\\S\\'");
  const opened = readIFC(text, {}, { literalStepIds: new Set() });
  assert.deepEqual(opened.tasks.map(t => t.name), baseline.map(n => n === original ? 'Pad C:\\S\\' : n));
  assert.deepEqual(readIFC(writeIFC(buildWriteIFCInput(payloadFromImport(opened, null)))).tasks.map(t => t.name), opened.tasks.map(t => t.name));
});
// De doelcontrole mag een echte wand ná zo'n oude letterlijke padnaam niet missen.
const legacyModel = source.slice(0, source.indexOf('DATA;') + 5)
  + "\n#1=IFCAPPLICATION($,'0.1','Open Planner Studio','OPS');\n"
  + "#2=IFCTASK('g',$,'Pad C:\\S\\',$,$,'1',$,$,$,.F.,$,$,.CONSTRUCTION.);\n"
  + wall + '\nENDSEC;\nEND-ISO-10303-21;';
for (const size of [1, 2, 7]) {
  await check(`oud letterlijk pad, stroom ${size}: echte wand weigeren`, async () => {
    assert.throws(() => readIFC(legacyModel), (e: unknown) => (e as { reason?: string }).reason === 'building-model');
    const bytes = enc.encode(legacyModel);
    let at = 0;
    const got = await scanTargetSource({
      next: async () => { if (at === bytes.length) return null; const b = bytes.subarray(at, at + size); at += b.length; return b; },
      seek: async (offset) => { at = offset; },
    });
    assert.equal(got, 'model');
  });
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
    const opened = await bytesNamesOrRefusal(commented, baseline);
    if (opened) assert.equal(opened.ifcSource?.foreign ?? false, false);
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
