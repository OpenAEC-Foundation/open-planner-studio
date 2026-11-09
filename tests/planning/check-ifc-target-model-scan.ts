// #804 fase 1a, fixronde 2 en 3 (review van #864): de doelscanner (`targetModelScan.ts`). Bevat een bestaand doel van
// Opslaan als, een export of AutoSave een gebouwmodel? Bewaakt:
//   1. dezelfde herkenning als de modelweigering bij openen (`readIFC`, knownbug 110): voor elk bestand in
//      `tests/fixtures/ifc-foreign/`, `public/examples/`, `examples/` en `tests/planning/fixtures/` zegt de scanner
//      "model" precies als openen weigert (dus nooit bij een eigen bestand van de app);
//   2. de toestand tussen stukken: elk bestand ook in stukken van 1 en 7 bytes, met dezelfde uitkomst;
//   3. alleen entiteittypen tellen: een typenaam in een string (ook met `''`) of in commentaar telt niet;
//   4. "not-ifc" alleen als het eerste statement geen `ISO-10303-21;` is (CSV, XML, JSON, leeg); een UTF-8-BOM,
//      witruimte en commentaar vooraan mogen. Het schema telt niet: een STEP-bestand met een modeltype is een model;
//   5. lezen als stroom: de lezer stopt bij de eerste modelentiteit (hij vraagt geen stukken meer en sluit de bron), en
//      leest een bestand zonder model helemaal. De tijden staan in de uitvoer;
//   6. fixronde 3 (een scan zonder uitkomst is geen vrijbrief): een lange kop of lang commentaar (Sol: `model-ifc4.ifc`
//      met 2 MiB + 1 commentaar na `HEADER;`) geeft in elke stukgrootte (1, 7, 64 KiB, 1 MiB, alles) "model"; ook een
//      lang id, een complexe instantie met een producttype (Terra), en een ongebalanceerde apostrof in de kop (die
//      `readIFC` toestaat; de lezer per regel vangt dat).
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
// Fixronde 3: het schema telt niet meer. Een STEP-bestand met een modeltype is een model; zonder modeltype mag het.
allWays('een andere STEP-toepassing met een modeltype', ifc("#9=IFCWALL('x',$);\n", HEAD.replace("'IFC4X3_ADD2'", "'AUTOMOTIVE_DESIGN'")), 'model');
allWays('een andere STEP-toepassing zonder modeltype', ifc("#9=CARTESIAN_POINT('',(0.,0.,0.));\n", HEAD.replace("'IFC4X3_ADD2'", "'AUTOMOTIVE_DESIGN'")), 'no-model');
allWays('STEP zonder schema, met een modeltype', ifc("#9=IFCWALL('x',$);\n", HEAD.replace("FILE_SCHEMA(('IFC4X3_ADD2'));\n", '')), 'model');
allWays('een IFC zonder DATA', enc.encode(HEAD.replace('DATA;\n', '') + 'END-ISO-10303-21;\n'), 'no-model');
allWays('witruimte en commentaar vóór de kop', enc.encode(`\n  /* ISO-10303-21; niet */\r\n${HEAD}#9=IFCWALL('x',$);\n${TAIL}`), 'model');
allWays('een ander eerste statement', enc.encode(`HEADER;\n${HEAD}#9=IFCWALL('x',$);\n${TAIL}`), 'not-ifc');
allWays('kop zonder punt-komma', enc.encode('ISO-10303-21'), 'not-ifc');

// ── 6. Fixronde 3: geen uitkomst zonder het hele bestand ───────────────────────────────────────────────────────────
{
  const sizes = [1, 7, 64 << 10, 1 << 20, Number.POSITIVE_INFINITY];
  const every = (label: string, bytes: Uint8Array, want: TargetModelScan) => {
    for (const size of sizes) {
      eq(`${label} (stukken van ${size === Number.POSITIVE_INFINITY ? 'alles' : size})`,
        size === Number.POSITIVE_INFINITY ? scanTargetBytes(bytes) : inChunks(bytes, size), want);
    }
  };
  const model = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc4.ifc'), 'latin1');
  const own = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'latin1');
  const longComment = `/*${'x'.repeat((2 << 20) + 1)}*/`;
  const afterHeader = (t: string, insert: string) => t.replace('HEADER;', `HEADER;${insert}`);
  const afterData = (t: string, insert: string) => t.replace('DATA;', `DATA;${insert}`);
  const sol = afterHeader(model, longComment);
  eq('Sol: model-ifc4.ifc met 2 MiB + 1 commentaar na HEADER; is 2.101.711 bytes', sol.length, 2_101_711);
  let solRefused = false;
  try { readIFC(sol); } catch (e) { solRefused = e instanceof IfcParseError && e.reason === 'building-model'; }
  eq('Sol: readIFC weigert dat bestand als model', solRefused, true);
  every('Sol: lange kop met model', enc.encode(sol), 'model');
  every('lang commentaar in DATA, met model', enc.encode(afterData(model, longComment)), 'model');
  every('lange kop zonder model (alles gelezen)', enc.encode(afterHeader(own, longComment)), 'no-model');
  every('lang commentaar in DATA, zonder model', enc.encode(afterData(own, longComment)), 'no-model');
  every('lange string in de kop, met model', enc.encode(model.replace("FILE_NAME('", `FILE_NAME('${'y'.repeat(2 << 20)}`)), 'model');
  every('een lang id', ifc(`#${'0'.repeat(300)}9=IFCWALL('x',$);\n`), 'model');
  // Complexe instanties (Terra): het deeltype telt, ook tussen andere deelrecords en met haakjes in strings.
  every('complexe instantie met een producttype', ifc("#1=(IFCBUILDINGELEMENT()IFCELEMENT($)IFCPRODUCT($,$)IFCWALL(.STANDARD.));\n"), 'model');
  every('complexe instantie, producttype eerst', ifc("#1=( IFCWALL ($) IFCPRODUCT ('(',$) );\n"), 'model');
  every('complexe instantie zonder producttype', ifc("#89=(IFCNAMEDUNIT(*,.LENGTHUNIT.)IFCSIUNIT($,.MILLI.,.METRE.));\n#90=(IFCLABELX('IFCWALL(')IFCX(IFCWALL(1)));\n"), 'no-model');
  // Een ongebalanceerde apostrof in de kop (oude eigen bestanden; `readIFC` vindt `DATA;` dan op de regel). Lezer 1 ziet
  // daarna code als string; lezer 2 vindt de regel met het model.
  const unbalanced = model.replace("FILE_NAME('model-ifc4.ifc'", "FILE_NAME('Jan's model.ifc'");
  let unbalancedRefused = false;
  try { readIFC(unbalanced); } catch (e) { unbalancedRefused = e instanceof IfcParseError && e.reason === 'building-model'; }
  eq('ongebalanceerde apostrof: readIFC weigert als model', unbalancedRefused, true);
  every('ongebalanceerde apostrof in de kop, met model', enc.encode(unbalanced), 'model');
  every('ongebalanceerde apostrof in de kop, zonder model', enc.encode(own.replace("FILE_NAME('", "FILE_NAME('Jan's ")), 'no-model');
  // Bewust te veel: een regel `#n=MODELTYPE(` binnen een string van meer regels.
  every('een modelregel binnen een string van meer regels (weigert te veel)', ifc("#1=IFCTASK('regel 1\n#9=IFCWALL(\n',$);\n"), 'model');
}

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
