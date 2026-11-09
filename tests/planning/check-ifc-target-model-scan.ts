// #804 fase 1a, fixronde 2 (review van #864, ronde 2): de doelscanner (`targetModelScan.ts`). Bevat een bestaand doel
// van Opslaan als, een export of AutoSave een gebouwmodel? Bewaakt:
//   1. dezelfde herkenning als de modelweigering bij openen (`readIFC`, knownbug 110): voor elk bestand in
//      `tests/fixtures/ifc-foreign/`, `public/examples/`, `examples/` en `tests/planning/fixtures/` zegt de scanner
//      "model" precies als openen weigert (dus nooit bij een eigen bestand van de app);
//   2. de toestand tussen stukken: elk bestand ook in stukken van 1 en 7 bytes, met dezelfde uitkomst;
//   3. alleen entiteittypen tellen: een typenaam in een string (ook met `''`) of in commentaar telt niet;
//   4. alleen een IFC telt: zonder `ISO-10303-21;`, of met een ander schema dan IFC, is de uitkomst "not-ifc" (CSV,
//      XML, JSON, een andere STEP-toepassing, een lege of te grote kop); een UTF-8-BOM vooraan mag;
//   5. lezen als stroom: de lezer stopt bij de eerste modelentiteit (hij vraagt geen stukken meer en sluit de bron), en
//      leest een bestand zonder model helemaal. De tijden staan in de uitvoer.
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TargetModelScanner, scanTargetBlob, scanTargetBytes, scanTargetChunks, type TargetModelScan,
} from '@/services/ifc/foreign/targetModelScan';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};
const enc = new TextEncoder();
const inChunks = (bytes: Uint8Array, size: number): TargetModelScan => {
  const scanner = new TargetModelScanner();
  for (let i = 0; i < bytes.length; i += size) {
    const r = scanner.push(bytes.subarray(i, i + size));
    if (r) return r;
  }
  return scanner.end();
};
/** Elke vorm van lezen geeft dezelfde uitkomst: alles in één keer, per byte, per 7 bytes. */
const allWays = (label: string, bytes: Uint8Array, want: TargetModelScan) => {
  eq(`${label} (één stuk)`, scanTargetBytes(bytes), want);
  eq(`${label} (stukken van 1 byte)`, inChunks(bytes, 1), want);
  eq(`${label} (stukken van 7 bytes)`, inChunks(bytes, 7), want);
};

// ── 1 en 2. Dezelfde herkenning als de modelweigering bij openen ──────────────────────────────────────────────────
const files = ['tests/fixtures/ifc-foreign', 'public/examples', 'examples', 'tests/planning/fixtures']
  .flatMap(dir => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).map(f => `${dir}/${f}`));
let models = 0;
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(join(ROOT, file)));
  let refused: boolean;
  try {
    readIFC(new TextDecoder('latin1').decode(bytes));
    refused = false;
  } catch (e) {
    refused = e instanceof IfcParseError && e.reason === 'building-model';
  }
  if (refused) models++;
  allWays(`${file}: gelijk aan de weigering bij openen`, bytes, refused ? 'model' : 'no-model');
}
eq('het corpus heeft bestanden met en zonder model', [models >= 10, files.length - models >= 30], [true, true]);
console.log(`..  ${files.length} bestanden: ${models} met model, ${files.length - models} zonder; gelijk aan de weigering bij openen`);

// ── 3. Alleen entiteittypen tellen ────────────────────────────────────────────────────────────────────────────────
const HEAD = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [x]'),'2;1');\n"
  + "FILE_NAME('a.ifc','2026-11-09T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\nDATA;\n";
const TAIL = 'ENDSEC;\nEND-ISO-10303-21;\n';
const ifc = (data: string, head = HEAD) => enc.encode(head + data + TAIL);
allWays('alleen planning', ifc("#1=IFCPROJECT('0',$,'P',$,$,$,$,$,$);\n#2=IFCTASK('1',$,'Taak',$,$,$,$,$,$,.F.,$,$,$);\n"), 'no-model');
allWays('typenaam in een string', ifc("#1=IFCTASK('1',$,'#9=IFCWALL(''x'');',$,$,$,$,$,$,.F.,$,$,$);\n"), 'no-model');
allWays('typenaam in een string met aanhalingstekens', ifc("#1=IFCTASK('it''s #9=IFCWALL(',$,$);\n#2=IFCTASK('''',$);\n"), 'no-model');
allWays('typenaam in commentaar', ifc("/* #9=IFCWALL('x'); */\n#1=IFCTASK('1',$); /* ** / * IFCSITE( */\n"), 'no-model');
allWays('commentaar tussen id en type', ifc("#9=/* x */IFCWALL('x',$);\n"), 'model');
allWays('kleine letters en spaties', ifc("#9 = ifcWall ('x',$);\n"), 'model');
allWays('een type van IfcTypeProduct', ifc("#9=IFCWALLTYPE('x',$);\n"), 'model');
allWays('een ruimtelijk element', ifc("#9=IFCSITE('x',$);\n"), 'model');
allWays('een type dat erop lijkt', ifc("#9=IFCWALLSTANDARDCASEX('x',$);\n#10=IFCPROPERTYSINGLEVALUE('IFCWALL',$,IFCLABEL('IFCWALL'),$);\n"), 'no-model');
allWays('model achteraan', ifc(`${"#1=IFCTASK('1',$);\n".repeat(2000)}#9=IFCBEAM('x',$);\n`), 'model');
allWays('IFC2X3-schema', ifc("#9=IFCWALL('x',$);\n", HEAD.replace('IFC4X3_ADD2', 'IFC2X3')), 'model');

// ── 4. Alleen een IFC ─────────────────────────────────────────────────────────────────────────────────────────────
allWays('UTF-8-BOM vooraan', new Uint8Array([0xef, 0xbb, 0xbf, ...ifc("#9=IFCWALL('x',$);\n")]), 'model');
allWays('CSV', enc.encode('Naam;Start;Einde\n#9=IFCWALL(;x;y\n'), 'not-ifc');
allWays('XML (MSPDI)', enc.encode('<?xml version="1.0"?><Project><Name>#9=IFCWALL(</Name></Project>'), 'not-ifc');
allWays('JSON (IFCX nog niet)', enc.encode('{"header":{"ifcxVersion":"2.0"},"data":[{"path":"IFCWALL("}]}'), 'not-ifc');
allWays('leeg bestand', new Uint8Array(), 'not-ifc');
allWays('een andere STEP-toepassing', ifc("#9=IFCWALL('x',$);\n", HEAD.replace("'IFC4X3_ADD2'", "'AUTOMOTIVE_DESIGN'")), 'not-ifc');
allWays('STEP zonder schema', ifc("#9=IFCWALL('x',$);\n", HEAD.replace("FILE_SCHEMA(('IFC4X3_ADD2'));\n", '')), 'not-ifc');
allWays('een IFC-woord in een andere kopregel telt niet als schema',
  ifc("#9=IFCWALL('x',$);\n", HEAD.replace("'IFC4X3_ADD2'", "'AP214'").replace("'a.ifc'", "'IFC4'")), 'not-ifc');
allWays('een IFC zonder DATA', enc.encode(HEAD.replace('DATA;\n', '') + 'END-ISO-10303-21;\n'), 'no-model');
eq('een te grote kop zonder DATA', scanTargetBytes(enc.encode(`ISO-10303-21;\nHEADER;\n/*${'x'.repeat(1 << 21)}*/`)), 'not-ifc');

// ── 5. Lezen als stroom ───────────────────────────────────────────────────────────────────────────────────────────
{
  const CHUNK = 1 << 20;
  const filler = "#1=IFCTASK('1',$,'Taak met een naam',$,$,$,$,$,$,.F.,$,$,$);\n".repeat(Math.ceil((16 * CHUNK) / 64));
  const front = ifc(`#9=IFCWALL('x',$);\n${filler}`);
  const none = ifc(filler);
  const measure = async (bytes: Uint8Array) => {
    let pulled = 0;
    let cancelled = 0;
    const t0 = performance.now();
    const result = await scanTargetChunks(async () => {
      if (pulled * CHUNK >= bytes.length) return null;
      return bytes.subarray(pulled++ * CHUNK, pulled * CHUNK);
    }, () => { cancelled++; });
    return { result, pulled, cancelled, ms: performance.now() - t0 };
  };
  const early = await measure(front);
  eq('stroom: model vooraan stopt na het eerste stuk en sluit de bron', [early.result, early.pulled, early.cancelled], ['model', 1, 1]);
  const full = await measure(none);
  eq('stroom: zonder model leest hij alles en sluit de bron', [full.result, full.pulled, full.cancelled],
    ['no-model', Math.ceil(none.length / CHUNK), 1]);
  // Een leesfout gaat door naar de aanroeper (die telt hem als niet leesbaar), en de bron gaat toch dicht.
  let closed = 0;
  let error = '';
  try {
    await scanTargetChunks(async () => { throw new Error('leesfout'); }, () => { closed++; });
  } catch (e) { error = (e as Error).message; }
  eq('stroom: een leesfout gaat door, de bron gaat dicht', [error, closed], ['leesfout', 1]);
  // De Blob van een FSA-handle: dezelfde uitkomst via `stream()`.
  const t0 = performance.now();
  const blob = await scanTargetBlob(new Blob([none as BlobPart]));
  const blobMs = performance.now() - t0;
  eq('Blob: zonder model', blob, 'no-model');
  eq('Blob: model vooraan', await scanTargetBlob(new Blob([front as BlobPart])), 'model');
  console.log(`..  tijden (${(none.length / CHUNK).toFixed(0)} MiB): model vooraan ${early.ms.toFixed(1)} ms, `
    + `zonder model (alles gelezen) ${full.ms.toFixed(0)} ms, via Blob ${blobMs.toFixed(0)} ms`);
}

if (diffs.length > 0) {
  console.log(`XX  ifc-target-model-scan: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-target-model-scan: alle checks groen (${checks})`);
process.exit(0);
