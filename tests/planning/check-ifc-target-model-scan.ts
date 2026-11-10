// #804 fase 1a, fixronde 2, 3 en 4 (review van #864): de doelscanner (`targetModelScan.ts`). Bevat een bestaand doel van
// Opslaan als, een export of AutoSave een gebouwmodel? De regel (Trias, fixronde 4): de scanner zegt "model" precies als
// `readIFC` weigert met `building-model`. Review van #870, ronde 6 (besluit Trias): vindt de grammatica van
// ISO 10303-21 geen datasectie (een kapotte kop, of geen DATA-sectie), dan zegt de scanner 'unreadable' en weigert de
// doelcontrole het schrijven; `readIFC` opent zo'n bestand zoals main. Bewaakt:
//   1. het corpus: voor elk bestand in `tests/fixtures/ifc-foreign/`, `public/examples/`, `examples/` en
//      `tests/planning/fixtures/` (UTF-8 gelezen, zoals `File.text()` en `readTextFile`) dezelfde uitkomst als openen;
//   2. de toestand tussen stukken: elk bestand ook in stukken van 1 en 7 bytes (met terugspoelen), met dezelfde uitkomst;
//   3. alleen entiteittypen tellen: een typenaam in een string (ook met `''`) of in commentaar telt niet;
//   4. "not-ifc" alleen als het eerste statement geen `ISO-10303-21;` is (CSV, XML, JSON, leeg); een UTF-8-BOM,
//      witruimte en commentaar vooraan mogen. Het schema telt niet: een STEP-bestand met een modeltype is een model;
//   5. lezen als stroom: de lezer stopt bij de eerste modelentiteit (hij vraagt geen stukken meer en sluit de bron), en
//      leest een bestand zonder model helemaal. De tijden staan in de uitvoer;
//   6. fixronde 3 (een scan zonder uitkomst is geen vrijbrief): een lange kop of lang commentaar (Sol: `model-ifc4.ifc`
//      met 2 MiB + 1 commentaar na `HEADER;`) geeft in elke stukgrootte (1, 7, 64 KiB, 1 MiB, alles) "model"; ook een
//      lang id, een complexe instantie met een producttype (Terra), en een ongebalanceerde apostrof in de kop;
//   7. een kapotte kop (Terra: alle entiteiten op één regel; Sol: `#30=\nIFCWALL(`; commentaar of een meerregelige
//      string met een modelregel) geeft 'unreadable', zonder terugspoelen; met een geldige kop de randen van de lus van
//      `parseSTEP` (een mislukte entiteit, `ENDSEC;`, commentaar dat een woord samenvoegt) zoals `readIFC`, en
//      terugspoelen voorbij het geheugen (de bron opnieuw lezen);
//   8. de gedeelde zoekregel voor de sectiekop (`stepDataSection.ts`): als tekst en als bytes dezelfde grens; zonder de
//      vormen die main niet kende de positie van de oude `indexOfDataSection` van `readIFC` (overgenomen van 343b74300;
//      geen orakel voor de nieuwe vormen); en op de kleine gevallen een vaste, met de hand afgeleide verwachting van
//      begin en einde van de kop (review van #870, ronde 5 en 6);
//   9. een verschiltest: willekeurige STEP-achtige bestanden geven in elke stukgrootte 'unreadable' als de grammatica
//      breekt, en anders "model" precies als `readIFC` weigert met `building-model`;
//  10. de pariteitstabel: elk bestand uit deze check, de scanner tegen `readIFC`, met dezelfde regel. Afwijken mag alleen
//      in de besloten gevallen (een complexe instantie met een producttype; commentaar vóór de kop), en dan alleen naar
//      "model";
//  11. meer DATA-secties (ISO 10303-21): een wand in de tweede sectie (`council/fix3-twee-data.ifc`, ook met een
//      sectiekop `DATA((…),(…));`) is een model, voor `readIFC` en voor de scanner. Vóór deze fix stopten beide bij de
//      eerste `ENDSEC;`: het bestand opende zonder melding, en opslaan wiste de wand. Ook met parameters bij de EERSTE
//      sectiekop (Sol en Terra, review van #870: `readIFC` gaf `no-data-section`, de scanner "no-model").
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TargetModelScanner, scanTargetBlob, scanTargetBytes, scanTargetSource, type TargetModelScan, type TargetScanStep,
} from '@/services/ifc/foreign/targetModelScan';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { StepDataSectionFinder, indexOfStepDataSection, stepDataSectionBounds } from '@/services/ifc/stepDataSection';
import { brokenHeader, brokenHeaderDataFiles, commentFile, DATA_KOP_VORMEN, dataKopGrens, metDataKop, paramDataFile, solFile, solFileAllSplit, stringFile, terraFile } from './ifcDoelBestanden';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};
const enc = new TextEncoder();
/** De lezer in stukken van `size` bytes, met terugspoelen: na `{ seek }` gaat het volgende stuk vanaf die positie. */
const inChunks = (bytes: Uint8Array, size: number, stats?: { seeks: number; pushed: number }): TargetModelScan => {
  const scanner = new TargetModelScanner();
  let at = 0;
  for (let guard = 0; guard < 1e8; guard++) {
    let step: TargetScanStep;
    if (at < bytes.length) {
      const end = Math.min(at + size, bytes.length);
      step = scanner.push(bytes.subarray(at, end));
      if (stats) stats.pushed += end - at;
      at = end;
    } else {
      step = scanner.end();
    }
    if (step === null) continue;
    if ('result' in step) return step.result;
    if (stats) stats.seeks++;
    at = step.seek;
  }
  throw new Error('inChunks: de lezer komt niet tot een uitkomst');
};
/** De tekst die `readIFC` krijgt: UTF-8, met één BOM vooraan weg (zoals `File.text()` en plugin-fs `readTextFile`). */
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
/** Wat `readIFC` met dit bestand doet: 'ok', of de reden van de fout. */
const readOutcome = (bytes: Uint8Array): string => {
  try {
    readIFC(decode(bytes));
    return 'ok';
  } catch (e) {
    return e instanceof IfcParseError ? e.reason : 'fout buiten de lezer';
  }
};
/** Vindt de grammatica (poging 1 van `stepDataSection.ts`) de datasectie in de tekst die `readIFC` krijgt? */
const grammarOk = (bytes: Uint8Array) => stepDataSectionBounds(decode(bytes))?.grammar === true;
/** De regel voor een STEP-bestand: 'unreadable' als de grammatica breekt, anders "model" precies als `readIFC` het model
 *  weigert. (Voor "not-ifc" staat de verwachting altijd met de hand in de test.) */
const wantOf = (bytes: Uint8Array): TargetModelScan =>
  !grammarOk(bytes) ? 'unreadable' : readOutcome(bytes) === 'building-model' ? 'model' : 'no-model';
/** De besloten afwijkingen: de scanner zegt dan "model", `readIFC` weigert niet met `building-model`. */
type Deviation = 'complexe instantie' | 'commentaar vóór de kop';
/** De pariteitstabel (10): elk bestand uit deze check. */
const parity: Array<{ label: string; bytes: Uint8Array; deviation?: Deviation }> = [];
/** Elke vorm van lezen geeft dezelfde uitkomst: alles in één keer, per byte, per 7 bytes. */
const allWays = (label: string, bytes: Uint8Array, want: TargetModelScan, deviation?: Deviation) => {
  parity.push({ label, bytes, deviation });
  eq(`${label} (één stuk)`, scanTargetBytes(bytes), want);
  eq(`${label} (stukken van 1 byte)`, inChunks(bytes, 1), want);
  eq(`${label} (stukken van 7 bytes)`, inChunks(bytes, 7), want);
};
const SIZES = [1, 7, 64 << 10, 1 << 20, Number.POSITIVE_INFINITY];
/** Zoals `allWays`, in de vijf stukgroottes van de reviews: 1 B, 7 B, 64 KiB, 1 MiB en alles. */
const every = (label: string, bytes: Uint8Array, want: TargetModelScan, deviation?: Deviation) => {
  parity.push({ label, bytes, deviation });
  for (const size of SIZES) {
    eq(`${label} (stukken van ${size === Number.POSITIVE_INFINITY ? 'alles' : size})`,
      size === Number.POSITIVE_INFINITY ? scanTargetBytes(bytes) : inChunks(bytes, size), want);
  }
};

// ── 1 en 2. Dezelfde herkenning als de modelweigering bij openen ──────────────────────────────────────────────────
const files = ['tests/fixtures/ifc-foreign', 'public/examples', 'examples', 'tests/planning/fixtures']
  .flatMap(dir => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).map(f => `${dir}/${f}`));
let models = 0;
const corpusUnreadable: string[] = [];
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(join(ROOT, file)));
  const refused = readOutcome(bytes) === 'building-model';
  if (refused) models++;
  if (!grammarOk(bytes)) corpusUnreadable.push(file);
  allWays(`${file}: gelijk aan de weigering bij openen`, bytes, wantOf(bytes));
}
eq('het corpus heeft bestanden met en zonder model', [models >= 10, files.length - models >= 30], [true, true]);
console.log(`..  ${files.length} bestanden: ${models} met model, ${files.length - models} zonder; gelijk aan de weigering bij openen`
  + `; kop buiten de grammatica: ${corpusUnreadable.length === 0 ? 'geen' : corpusUnreadable.join(', ')}`);

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
// Besluit Trias (review van #870, ronde 6): een STEP-bestand waarin de app geen DATA-sectie vindt, weigert als doel.
allWays('een IFC zonder DATA', enc.encode(HEAD.replace('DATA;\n', '') + 'END-ISO-10303-21;\n'), 'unreadable');
allWays('een IFC zonder DATA, alleen de kop', enc.encode(HEAD.replace('DATA;\n', '')), 'unreadable');
allWays('witruimte en commentaar vóór de kop', enc.encode(`\n  /* ISO-10303-21; niet */\r\n${HEAD}#9=IFCWALL('x',$);\n${TAIL}`), 'model',
  'commentaar vóór de kop');
allWays('een ander eerste statement', enc.encode(`HEADER;\n${HEAD}#9=IFCWALL('x',$);\n${TAIL}`), 'not-ifc');
allWays('kop zonder punt-komma', enc.encode('ISO-10303-21'), 'not-ifc');
// Fixronde 4: een model gevonden voordat de kop beslist is (een heel kort bestand); de kop beslist aan het einde.
allWays('kort, model vóór de beslissing over de kop, geen IFC', enc.encode('X DATA;#9=IFCWALL(1);'), 'not-ifc');
allWays('kort, model vóór de beslissing over de kop, twee BOMs', new Uint8Array([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf,
  ...enc.encode('ISO-10303-21;DATA;#9=IFCWALL(1);END-ISO-10303-21;')]), 'unreadable');

// ── 6. Fixronde 3: geen uitkomst zonder het hele bestand ───────────────────────────────────────────────────────────
const MODEL = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc4.ifc'), 'utf8');
const OWN = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
{
  const model = MODEL;
  const own = OWN;
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
  every('complexe instantie met een producttype', ifc("#1=(IFCBUILDINGELEMENT()IFCELEMENT($)IFCPRODUCT($,$)IFCWALL(.STANDARD.));\n"), 'model',
    'complexe instantie');
  every('complexe instantie, producttype eerst', ifc("#1=( IFCWALL ($) IFCPRODUCT ('(',$) );\n"), 'model', 'complexe instantie');
  every('complexe instantie zonder producttype', ifc("#89=(IFCNAMEDUNIT(*,.LENGTHUNIT.)IFCSIUNIT($,.MILLI.,.METRE.));\n#90=(IFCLABELX('IFCWALL(')IFCX(IFCWALL(1)));\n"), 'no-model');
  // Een ongebalanceerde apostrof in de kop (oude eigen bestanden; `readIFC` vindt `DATA;` dan op de regel, en de lezer
  // leest daar opnieuw, streng).
  const unbalanced = model.replace("FILE_NAME('model-ifc4.ifc'", "FILE_NAME('Jan's model.ifc'");
  let unbalancedRefused = false;
  try { readIFC(unbalanced); } catch (e) { unbalancedRefused = e instanceof IfcParseError && e.reason === 'building-model'; }
  eq('ongebalanceerde apostrof: readIFC weigert als model', unbalancedRefused, true);
  every('ongebalanceerde apostrof in de kop, met model', enc.encode(unbalanced), 'unreadable');
  const unbalancedOwn = enc.encode(own.replace("FILE_NAME('", "FILE_NAME('Jan's "));
  eq('ongebalanceerde apostrof, zonder model: readIFC opent het (zoals main)', readOutcome(unbalancedOwn), 'ok');
  every('ongebalanceerde apostrof in de kop, zonder model', unbalancedOwn, 'unreadable');
  // Fixronde 4 (Terra, VERVOLG 2): een regel `#n=MODELTYPE(` binnen een string van meer regels telt niet meer.
  every('een modelregel binnen een string van meer regels', ifc("#1=IFCTASK('regel 1\n#9=IFCWALL(\n',$);\n"), 'no-model');
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
    let at = 0;
    const result = await scanTargetSource({
      next: async () => {
        if (at >= bytes.length) return null;
        pulled++;
        return bytes.subarray(at, at += CHUNK);
      },
      seek: async (offset) => { at = offset; },
      close: () => { cancelled++; },
    });
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
    await scanTargetSource({
      next: async () => { throw new Error('leesfout'); },
      seek: async () => { /* niet nodig */ },
      close: () => { closed++; },
    });
  } catch (e) { error = (e as Error).message; }
  eq('stroom: een leesfout gaat door, de bron gaat dicht', [error, closed], ['leesfout', 1]);
  // Fixronde 4: een bron die niet terugspoelt (of een bestand dat tijdens het lezen korter wordt) geeft een leesfout,
  // nooit een eindeloze lus. Een entiteit zonder einde vooraan, en meer dan 4096 stukken erachter: de lezer spoelt
  // terug voorbij zijn geheugen.
  const rewindFile = ifc(`#1=IFCTASK('a',\n${"#2=IFCTASK('x',$);\n".repeat(Math.ceil((5 << 20) / 19))}#9=IFCWALL('x',$);\n`);
  for (const [label, shrink] of [['seek doet niets', false], ['het bestand wordt korter', true]] as const) {
    const bytes = rewindFile;
    let at = 0;
    let end = bytes.length;
    let badClosed = 0;
    let badError = '';
    try {
      await scanTargetSource({
        next: async () => (at >= end ? null : bytes.subarray(at, at = Math.min(end, at + 1024))),
        seek: async (offset) => { if (shrink) { at = offset; end = offset + 10; } },
        close: () => { badClosed++; },
      });
    } catch (e) { badError = (e as Error).message; }
    eq(`stroom: ${label}: een leesfout, de bron gaat dicht`, [badError.startsWith('De bron eindigt na terugspoelen'), badClosed], [true, 1]);
  }
  // De Blob van een FSA-handle: dezelfde uitkomst via `stream()`.
  const t0 = performance.now();
  const blob = await scanTargetBlob(new Blob([none as BlobPart]));
  const blobMs = performance.now() - t0;
  eq('Blob: zonder model', blob, 'no-model');
  eq('Blob: model vooraan', await scanTargetBlob(new Blob([front as BlobPart])), 'model');
  console.log(`..  tijden (${(none.length / CHUNK).toFixed(0)} MiB): model vooraan ${early.ms.toFixed(1)} ms, `
    + `zonder model (alles gelezen) ${full.ms.toFixed(0)} ms, via Blob ${blobMs.toFixed(0)} ms`);
}

// ── 7. Fixronde 4: de route van `readIFC` ──────────────────────────────────────────────────────────────────────────
{
  const refusedAsModel = (label: string, bytes: Uint8Array, want: boolean) =>
    eq(`${label}: readIFC ${want ? 'weigert als model' : 'weigert niet als model'}`, readOutcome(bytes) === 'building-model', want);
  // Terra (BLOKKEERT 1) en Sol (BLOKKEERT 1b): de bestanden van de reviewers.
  const terra = enc.encode(terraFile(MODEL));
  const sol = enc.encode(solFile(MODEL));
  eq('Terra: alle entiteiten na DATA; op één regel', terraFile(MODEL).split('\n').filter(l => l.startsWith('DATA;#1=')).length, 1);
  eq('Sol: een regeleinde tussen = en IFCWALL', solFile(MODEL).includes('#30=\nIFCWALL('), true);
  const solAll = enc.encode(solFileAllSplit(MODEL));
  refusedAsModel('Terra', terra, true);
  refusedAsModel('Sol', sol, true);
  refusedAsModel('Sol, elke entiteit gesplitst', solAll, true);
  // Ronde 6 (besluit Trias): de kapotte kop breekt de grammatica. `readIFC` opent zoals main (hier: het model
  // geweigerd); de doelcontrole weigert het schrijven, ook zonder het model te zoeken.
  every('Terra: kapotte kop, alles op één regel', terra, 'unreadable');
  every('Sol: kapotte kop, #30=\\nIFCWALL(', sol, 'unreadable');
  every('Sol: kapotte kop, elke entiteit #n=\\nTYPE(', solAll, 'unreadable');
  // Dezelfde vormen met de wand als enige modelentiteit: zo telt precies deze entiteit.
  const BROKEN = brokenHeader(HEAD);
  const forms: Array<[string, string]> = [
    ['op één regel na DATA;', "#1=IFCTASK('1',$);#30=IFCWALL('x',$);"],
    ['regeleinde tussen = en type', "#1=IFCTASK('1',$);\n#30=\nIFCWALL('x',$);\n"],
    ['witruimte en commentaar tussen #id, =, type en (', "#30 \t/* a */=\r\n /* b */ IFCWALL /* c */\n(\n'x',$)\n;\n"],
    ['commentaar in het type', "#30=IFC/* knip */WALL('x',$);\n"],
    ['regeleinde in het id', "#3\n0=IFCWALL('x',$);\n"],
  ];
  for (const [form, data] of forms) {
    const broken = form === 'op één regel na DATA;' ? enc.encode(BROKEN.replace('DATA;\n', 'DATA;') + data + TAIL) : ifc(data, BROKEN);
    const valid = ifc(data);
    every(`kapotte kop, ${form}`, broken, 'unreadable');
    every(`geldige kop, ${form}`, valid, readOutcome(valid) === 'building-model' ? 'model' : 'no-model');
  }
  refusedAsModel('kapotte kop, witruimte en commentaar tussen de delen', ifc(forms[2][1], BROKEN), true);
  refusedAsModel('kapotte kop, regeleinde in het id (geen entiteit)', ifc(forms[4][1], BROKEN), false);
  // De kop zoals `assertIfcIntegrity`: na de BOM die de decoder weghaalt nog één U+FEFF, en `toUpperCase` (ook `ı` en
  // `ſ`). De regel van fixronde 3 (het eerste statement, alleen ASCII) zag die bestanden als "not-ifc".
  const wall = "#9=IFCWALL('x',$);\n";
  const heads: Array<[string, Uint8Array]> = [
    ['twee BOMs vooraan', new Uint8Array([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, ...ifc(wall)])],
    ['een BOM, witruimte en een tweede BOM (die telt niet)', new Uint8Array([0xef, 0xbb, 0xbf, 0x20, 0xef, 0xbb, 0xbf, ...ifc(wall)])],
    ['ı (U+0131) en ſ (U+017F) in de kop', ifc(wall, HEAD.replace('ISO-10303-21;', 'ıſO-10303-21;'))],
    ['verticale tab en form feed vóór de kop', ifc(wall, `\v\f${HEAD}`)],
    ['een harde spatie (U+00A0) vóór de kop', ifc(wall, `\u00a0${HEAD}`)],
    ['een half BOM vooraan', new Uint8Array([0xef, 0xbb, ...ifc(wall)])],
  ];
  for (const [label, bytes] of heads) {
    const outcome = readOutcome(bytes);
    // Een tweede BOM of ı/ſ: `readIFC` leest de kop, de grammatica (alleen ASCII) niet: weigeren als doel. Stuurtekens
    // vallen weg (§5.2): daar leest de grammatica de kop wel.
    every(`kop: ${label}`, bytes, outcome === 'building-model' ? wantOf(bytes) : 'not-ifc');
  }
  eq('kop: twee BOMs en ı/ſ: readIFC weigert als model', [readOutcome(heads[0][1]), readOutcome(heads[2][1])], ['building-model', 'building-model']);
  eq('kop: twee BOMs, ı/ſ en \\v\\f: de scanner', [heads[0], heads[2], heads[3]].map(h => scanTargetBytes(h[1])), ['unreadable', 'unreadable', 'model']);
  // Sol (VERVOLG 2b): commentaar met een modelregel na DATA;, met een geldige en met een kapotte kop.
  const comment = enc.encode(commentFile(OWN));
  refusedAsModel('commentaar met #900000=IFCWALL(, geldige kop', comment, false);
  eq('commentaar met #900000=IFCWALL(, geldige kop: readIFC opent het', readOutcome(comment), 'ok');
  every('commentaar met #900000=IFCWALL( na DATA;, geldige kop', comment, 'no-model');
  every('commentaar met #900000=IFCWALL( na DATA;, kapotte kop', enc.encode(commentFile(brokenHeader(OWN))), 'unreadable');
  every('commentaar met #900000=IFCWALL(, kleine kop', ifc("/*\n#900000=IFCWALL(\n*/\n#1=IFCTASK('1',$);\n"), 'no-model');
  every('commentaar met #900000=IFCWALL(, kleine kapotte kop', ifc("/*\n#900000=IFCWALL(\n*/\n#1=IFCTASK('1',$);\n", BROKEN), 'unreadable');
  // Terra (VERVOLG 2): een meerregelige string met een regel #9=IFCWALL(.
  const string = enc.encode(stringFile(OWN));
  eq('meerregelige string met #9=IFCWALL(, geldige kop: readIFC opent het', readOutcome(string), 'ok');
  every('meerregelige string met #9=IFCWALL(, geldige kop', string, 'no-model');
  const brokenString = enc.encode(stringFile(brokenHeader(OWN)));
  eq('meerregelige string met #9=IFCWALL(, kapotte kop: readIFC opent het (zoals main)', readOutcome(brokenString), 'ok');
  every('meerregelige string met #9=IFCWALL(, kapotte kop', brokenString, 'unreadable');
  // De randen van de lus van `parseSTEP` en `readEntity`: wat `readIFC` doet, doet de scanner ook.
  const edges: Array<[string, string, string?]> = [
    // Een entiteit zonder einde: `readIFC` leest verder vanaf het teken na de `#` en vindt dan de wand erin.
    ['een wand binnen een entiteit zonder einde', "#1=IFCTASK('a',#9=IFCWALL('x');\n"],
    ['een wand na een entiteit zonder puntkomma', "#1=IFCTASK('a',$)\n#9=IFCWALL('x',$);\n"],
    ['een wand na een string zonder einde in een entiteit', "#1=IFCTASK('a,$);\n#9=IFCWALL('x',$);\n"],
    ['een wand na een lege #', "# #=IFCWALL('x',$);\n#9=IFCWALL('x',$);\n"],
    ['een wand na ENDSEC; (readIFC leest alle DATA-secties)', "#1=IFCTASK('1',$);\nENDSEC;\n#9=IFCWALL('x',$);\n"],
    ['een wand in een tweede DATA-sectie', "#1=IFCTASK('1',$);\nENDSEC;\nDATA;\n#9=IFCWALL('x',$);\n"],
    ['een wand in een tweede DATA-sectie met sectiekop',
      "#1=IFCTASK('1',$);\nENDSEC;\nDATA(('deel 2'),('IFC4'));\n#9=IFCWALL('x',$);\n"],
    ['een wand na endsec; in kleine letters', "endsec;\n#9=IFCWALL('x',$);\n"],
    ['een wand na ENDSEC; in een string', "#1=IFCTASK('ENDSEC;',$);\n#9=IFCWALL('x',$);\n"],
    ['een wand na ENDSE ENDSEC;', "ENDSE ENDSEC;\n#9=IFCWALL('x',$);\n"],
    ['een wand na ENDSENDSEC;', "ENDSENDSEC;\n#9=IFCWALL('x',$);\n"],
    ['een wand na commentaar zonder einde', "/* open\n#9=IFCWALL('x',$);\n"],
    ['een wand na /*/', "/*/ #9=IFCWALL('x',$); */\n#1=IFCTASK('1',$);\n"],
    ['een wand na **/ in commentaar', "/* x **/#9=IFCWALL('x',$);\n"],
    ['commentaar dat /* vormt in de argumenten', "#1=IFCTASK(//*z*/*'*/);\n#9=IFCWALL('x',$);\n"],
    // Na `/*'*/` (samengevoegd) ziet de lus commentaar en `stripStepComments` een string. Mislukt daarna een entiteit,
    // dan gaat `readIFC` verder met de string-toestand van `stripStepComments`: het commentaar erna blijft staan.
    ['een entiteit zonder einde terwijl het weghalen van commentaar in een string staat',
      "#1=IFCTASK(//*z*/*'*/);#2=IFCTASK(/*#9=IFCWALL(1);*/"],
    ['een losse / aan het einde van de datasectie', "#9=IFCWALL('x',$);/"],
    ['een wand na een string met \'\'', "#1=IFCTASK('it''s',$);#9=IFCWALL('x',$);\n"],
    ['een wand binnen een string met \'\' aan het begin', "#1=IFCTASK(''''#9=IFCWALL('x',$);',$);\n"],
    ['een ongebalanceerde apostrof in de datasectie', "#1=IFCTASK('Jan's taak',$);\n#9=IFCWALL('x',$);\n"],
    ['een te lang type', `#9=IFCWALL${'X'.repeat(200)}('x',$);\n`],
    ['een modeltype in kleine letters met cijfers in het id', "#9a_B = ifcbeam ( 'x' , $ ) ;\n"],
    ['twee DATA; (de eerste telt)', "#1=IFCTASK('1',$);\nDATA;\n#9=IFCWALL('x',$);\n"],
  ];
  for (const [label, data] of edges) {
    for (const [head, name] of [[HEAD, 'geldige kop'], [BROKEN, 'kapotte kop']] as const) {
      const bytes = ifc(data, head);
      every(`rand, ${name}: ${label}`, bytes, head === BROKEN ? 'unreadable' : wantOf(bytes));
    }
  }
  // Een paar uitkomsten met de hand vastgelegd (zodat de randen niet alleen "gelijk aan readIFC" zijn).
  eq('rand: de wand binnen een entiteit zonder einde is een model', readOutcome(ifc(edges[0][1])), 'building-model');
  eq('rand: na ENDSEC; telt de wand mee (alle DATA-secties)', readOutcome(ifc(edges[4][1])), 'building-model');
  for (const name of ['een wand in een tweede DATA-sectie', 'een wand in een tweede DATA-sectie met sectiekop']) {
    const data = edges.find(e => e[0] === name)![1];
    eq(`rand: ${name} is een model`, [readOutcome(ifc(data)), scanTargetBytes(ifc(data))], ['building-model', 'model']);
  }
  eq('rand: na commentaar zonder einde telt niets meer',
    readOutcome(ifc(edges.find(e => e[0] === 'een wand na commentaar zonder einde')![1])) === 'building-model', false);
  eq('rand: na terugspoelen telt de string-toestand van het weghalen van commentaar',
    readOutcome(ifc(edges.find(e => e[0].startsWith('een entiteit zonder einde terwijl'))![1])), 'building-model');
  // Kapotte kop met een `DATA;` op codeniveau verderop (de apostrof keert de strings om): `readIFC` leest vanaf dat
  // strenge `DATA;`, niet vanaf de regel. De scanner ook.
  const laterStrict = ifc("#1=IFCTASK('DATA;',$);\n#9=IFCWALL('x',$);\n", BROKEN);
  every('kapotte kop, een streng DATA; verderop', laterStrict, 'unreadable');
  // Terugspoelen voorbij het geheugen: een entiteit zonder einde vooraan, met daarachter meer dan de lezer vasthoudt
  // (16 MiB, of 4096 stukken). Dan leest hij de bron opnieuw vanaf het teken na de `#`.
  const big = (filler: number) => ifc(`#1=IFCTASK('a',\n${"#2=IFCTASK('x',$);\n".repeat(Math.ceil(filler / 19))}#9=IFCWALL('x',$);\n`);
  const smallRewind = big(64 << 10);
  const largeRewind = big(17 << 20);
  refusedAsModel('terugspoelen (17 MiB)', largeRewind, true);
  for (const [bytes, size] of [[smallRewind, 1], [smallRewind, 7], [largeRewind, 64 << 10], [largeRewind, 1 << 20]] as const) {
    const stats = { seeks: 0, pushed: 0 };
    eq(`terugspoelen voorbij het geheugen, stukken van ${size}: model, en de bron opnieuw gelezen`,
      [inChunks(bytes, size, stats), stats.seeks >= 1], ['model', true]);
  }
  eq('terugspoelen in het geheugen (één stuk)', scanTargetBytes(largeRewind), 'model');
  parity.push({ label: 'terugspoelen (17 MiB)', bytes: largeRewind });
  // Een kapotte kop met 3 MiB erachter: de lezer beslist in de kop. Hij spoelt niet terug en leest de rest niet.
  const brokenLong = ifc(`${"#2=IFCTASK('x',$);\n".repeat(Math.ceil((3 << 20) / 19))}#9=IFCWALL('x',$);\n`, BROKEN);
  refusedAsModel('kapotte kop, 3 MiB', brokenLong, true);
  for (const size of [64 << 10, 1 << 20]) {
    const stats = { seeks: 0, pushed: 0 };
    eq(`kapotte kop, 3 MiB, stukken van ${size}: unreadable na het eerste stuk, zonder terugspoelen`,
      [inChunks(brokenLong, size, stats), stats.seeks, stats.pushed], ['unreadable', 0, size]);
  }
  parity.push({ label: 'kapotte kop, 3 MiB', bytes: brokenLong });
  // Een bestand zonder model met een kapotte kop: `readIFC` opent het zoals main; de doelcontrole weigert.
  const brokenOwn = enc.encode(brokenHeader(OWN));
  eq('kapotte kop zonder model: readIFC opent het (zoals main)', readOutcome(brokenOwn), 'ok');
  const stats = { seeks: 0, pushed: 0 };
  eq('kapotte kop zonder model: unreadable, zonder terugspoelen', [inChunks(brokenOwn, 64 << 10, stats), stats.seeks], ['unreadable', 0]);
}

// ── 8. Eén bron voor de sectiekop: tekst en bytes gelijk, de oude regel van `readIFC`, vaste verwachtingen ─────────
// Het orakel: `skipQuotedOrComment`, `startsWithTokenCI`, `indexOfCode` en `indexOfDataSection` uit `ifcReader.ts` op
// 343b74300, letterlijk overgenomen. De nieuwe `stepDataSection.ts` moet op elke invoer dezelfde positie geven: als tekst
// (`readIFC`) en als bytes (de scanner, met de BOM die de decoder weghaalt).
function oldSkip(text: string, i: number): number {
  const c = text.charCodeAt(i);
  if (c === 0x27) {
    for (let j = i + 1; j < text.length; j++) {
      if (text.charCodeAt(j) !== 0x27) continue;
      if (text.charCodeAt(j + 1) === 0x27) { j++; continue; }
      return j + 1;
    }
    return text.length;
  }
  if (c === 0x2f && text.charCodeAt(i + 1) === 0x2a) {
    const end = text.indexOf('*/', i + 2);
    return end < 0 ? text.length : end + 2;
  }
  return -1;
}
function oldStartsWithTokenCI(text: string, i: number, token: string): boolean {
  for (let k = 0; k < token.length; k++) {
    let c = text.charCodeAt(i + k);
    if (c >= 0x61 && c <= 0x7a) c -= 0x20;
    if (c !== token.charCodeAt(k)) return false;
  }
  return true;
}
function oldIndexOfCode(text: string, token: string, from: number): number {
  const first = token.charCodeAt(0);
  for (let i = from; i < text.length;) {
    let c = text.charCodeAt(i);
    if (c === 0x27 || c === 0x2f) {
      const skip = oldSkip(text, i);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c >= 0x61 && c <= 0x7a) c -= 0x20;
    if (c === first && oldStartsWithTokenCI(text, i, token)) return i;
    i++;
  }
  return -1;
}
function oldIndexOfDataSection(content: string): number {
  const strict = oldIndexOfCode(content, 'DATA;', 0);
  if (strict >= 0) return strict;
  const anchored = /^[ \t]*DATA;/im.exec(content);
  return anchored ? anchored.index + anchored[0].toUpperCase().indexOf('DATA;') : -1;
}
/** De vinder zoals de scanner hem voedt: bytes, na de BOM die de decoder weghaalt; de positie als index in de tekst. */
function byteDataSection(bytes: Uint8Array): { at: number; end: number; grammar: boolean } | null {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const finder = new StepDataSectionFinder(true);
  let found: { at: number; end: number; grammar: boolean } | null = null;
  for (let i = start; i < bytes.length && !found; i++) {
    if (finder.step(bytes[i], i)) found = { at: finder.strictAt, end: finder.strictEnd, grammar: true };
  }
  if (!found) {
    const atEnd = finder.grammarAtEnd;
    found = atEnd ? { ...atEnd, grammar: true } : finder.fallback ? { ...finder.fallback, grammar: false } : null;
  }
  const text = (to: number) => decode(bytes.subarray(0, to)).length; // de decoder haalt alleen de eerste BOM weg
  return found && { at: text(found.at), end: text(found.end), grammar: found.grammar };
}
let dataSectionCases = 0;
/** Een vaste verwachting: de `n`-de `kop` in de tekst (0 = de eerste) is de sectiekop, van `DATA` tot en met de `;`; de
 *  lezer gaat verder direct na `kop`. `null`: geen sectiekop. */
type Kop = readonly [kop: string, n?: number] | null;
const kopGrens = (text: string, kop: Kop): { at: number; end: number } | null => {
  if (kop === null) return null;
  let at = -1;
  for (let k = 0; k <= (kop[1] ?? 0); k++) at = text.indexOf(kop[0], at + 1);
  if (at < 0) throw new Error(`kop ${JSON.stringify(kop[0])} staat niet in de tekst`);
  return { at, end: at + kop[0].length };
};
/** Tekst en bytes geven dezelfde grens; zonder de vormen die main niet kende de grens van main (het orakel hierboven);
 *  met `kop` ook de vaste verwachting (review van #870, ronde 5: geen tweede beschrijving van de regels als orakel). */
const sameDataSection = (label: string, bytes: Uint8Array, kop?: Kop) => {
  dataSectionCases++;
  const text = decode(bytes);
  const bounds = stepDataSectionBounds(text);
  const want = bounds?.at ?? -1;
  if (kop !== undefined) eq(`DATA; (${label}): de vaste verwachting`, bounds && { at: bounds.at, end: bounds.end }, kopGrens(text, kop));
  // Main kende alleen `DATA;`, zag stuurtekens niet als niets en kende `\S\'` niet: daar wijkt de grammatica bewust af.
  const nieuw = /DATA[\s/(\\]/i.test(text) || /\\S\\/i.test(text) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|[/*'][\t\n\r]+[/*']/.test(text)
    || /D[\x00-\x1f]+A|A[\x00-\x1f]+T|T[\x00-\x1f]+A|A[\x00-\x1f]+;/i.test(text);
  if (!nieuw) eq(`DATA; (${label}): zonder nieuwe vormen de regel van main`, want, oldIndexOfDataSection(text));
  eq(`DATA; (${label}): de gedeelde regel als tekst`, indexOfStepDataSection(text), want);
  eq(`DATA; (${label}): de gedeelde regel als bytes`, byteDataSection(bytes), bounds);
};
for (const file of files) sameDataSection(file, new Uint8Array(readFileSync(join(ROOT, file))));
for (const c of parity) sameDataSection(c.label, c.bytes);
// Elk geval met een vaste verwachting (`Kop`, zie `kopGrens`): met de hand afgeleid uit de drie pogingen van
// `stepDataSection.ts` (de grammatica, de regel van main, regel-verankerd), niet uit de code zelf.
for (const [label, text, kop] of [
  ['DATA; in een string van de kop (FILE_NAME met 1 parameter: regel van main)', "ISO-10303-21;\nHEADER;\nFILE_NAME('DATA;');\nENDSEC;\nDATA;\n", ['DATA;', 1]],
  ['DATA; in commentaar van de kop', 'ISO-10303-21;\nHEADER;\n/* DATA; */\nENDSEC;\ndata;\n', ['data;']],
  ['alleen regel-verankerd, met spaties en tabs', "ISO-10303-21;\nFILE_NAME('a);\n \t DaTa;\n", ['DaTa;']],
  ['regel-verankerd na \\r, U+2028 en U+2029', "ISO-10303-21;'\rDATA; DATA; DATA;", ['DATA;']],
  ['regel-verankerd na é en een emoji (geen regelbegin)', "ISO-10303-21;'\né DATA;\n😀DATA;\n  DATA;", ['DATA;', 2]],
  ['DDATA; en DATDATA; (regel van main: midden in een woord)', 'DDATA; DATDATA;', ['DATA;']],
  ['commentaar zonder einde', "/* DATA;\nDATA;", ['DATA;', 1]],
  ['/*/ sluit niet', '/*/ DATA; */DATA;', ['DATA;', 1]],
  ['lege tekst', '', null],
  ['DATA, regeleinde, ; (geldige scheiding)', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA\n;", ['DATA\n;']],
  ['geen sectiekop', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATAX;\n", null],
  ['DATA( als eerste sectiekop', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA('deel 1',('IFC4'));\n", ["DATA('deel 1',('IFC4'));"]],
  ['data( in kleine letters', "ISO-10303-21;\nHEADER;\nENDSEC;\ndata('x',('IFC4'));\n", ["data('x',('IFC4'));"]],
  // Ronde 6: de parameters zijn een naam en een lijst (§11.1). Een lijst als naam breekt de grammatica; main kende
  // `DATA(` niet: geen sectiekop.
  ['data(( met een lijst als naam', "ISO-10303-21;\nHEADER;\nENDSEC;\ndata(('x'),('IFC4'));\n", null],
  ["DATA('a') zonder lijst", "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA('a');\n#1=IFCWALL($);\n", null],
  ['DATA; gevolgd door iets anders dan # of ENDSEC (regel van main)', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nX;\n", ['DATA;']],
  ['zonder HEADER; telt alleen DATA; (regel van main)', "ISO-10303-21;\nENDSEC;\nDATA;\nENDSEC;\nDATA('b',('IFC4'));\n", ['DATA;']],
  ['METADATA( en !DATA( in de kop tellen niet', "ISO-10303-21;\nHEADER;\nMETADATA('x');\n!DATA('y');\n_DATA(1);\nENDSEC;\nDATA;\n", ['DATA;']],
  ['*/DATA( na ENDSEC; en commentaar telt wel', "ISO-10303-21;\nHEADER;\nENDSEC;/*c*/DATA('a',('IFC4'));\n", ["DATA('a',('IFC4'));"]],
  ['DATA( zonder ENDSEC; ervoor telt niet', "ISO-10303-21;\n/*c*/DATA('a',('IFC4'));\n", null],
  ['DATA ( met een spatie is een sectiekop', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA ('a',('b'));\n#1=X();", ["DATA ('a',('b'));"]],
  ['DATA/*x*/( met commentaar is een sectiekop', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA/*x*/('a',('b'));\n#1=X();", ["DATA/*x*/('a',('b'));"]],
  ['DATA, regeleinde, ( is een sectiekop', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA\n  ('a',('b'));\n#1=X();", ["DATA\n  ('a',('b'));"]],
  // Ronde 6: na de kop komt een entiteit of ENDSEC. Een tweede kop direct erna breekt de grammatica (dan main: DATA;).
  ['DATA (…); direct gevolgd door DATA;', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA ('a',('b'));\nDATA;", ['DATA;']],
  ['DATA / ( is geen sectiekop (geen commentaar)', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA / ('a');\nDATA;", ['DATA;']],
  ['METADATA ( en x DATA ; na een woord tellen niet, XDATA; wel (regel van main)', "ISO-10303-21;\nMETADATA ('a');\nMETADATA ;\nXDATA;", ['DATA;']],
  ['DATA /*open zonder einde', "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA /* (;", null],
  // Ronde 6 (besluit Trias): na een kapotte kop raadt de vinder niet. Main kende alleen `DATA;`: geen sectiekop.
  ['DATA ( na een kapotte kop: geen sectiekop (zoals main)', "ISO-10303-21;\nFILE_NAME('a);\n  DATA\t\n('a',('IFC4'));\n", null],
  ['DATA( in een string telt niet', "ISO-10303-21;\nHEADER;\nX('DATA(');\nENDSEC;\nDATA('a',('IFC4'));", ["DATA('a',('IFC4'));"]],
  ['DATA( na een kapotte kop: geen sectiekop (zoals main)', "ISO-10303-21;\nFILE_NAME('a);\n  DATA('a',('IFC4'));\n", null],
  ['DDATA( en DATADATA(', "ISO-10303-21;\nDDATA( DATADATA( x DATA(", null],
  // Ronde 3 (Sol en Terra): een oude, rauw geschreven bestandsnaam met één apostrof draait de stringtoestand om.
  ['DATA ( in een kapotte bestandsnaam', "ISO-10303-21;\nHEADER;\nFILE_NAME('Van 't Hof DATA (bouw).ifc');\nENDSEC;\nDATA;\n#1=IFCWALL($);\nENDSEC;\n", ['DATA;']],
  ['DATA( in een kapotte bestandsnaam', "ISO-10303-21;\nHEADER;\nFILE_NAME('Van 't DATA( toren.ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
  ['DATA/*x*/( in een kapotte bestandsnaam', "ISO-10303-21;\nHEADER;\nFILE_NAME('Van 't DATA/*x*/(b.ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
  ['DATA ( na een ; die geen ENDSEC; is', "ISO-10303-21;\nHEADER;\nFILE_NAME('a 't; DATA (b)');\nENDSEC;\nDATA;\n", ['DATA;']],
  ['ENDSEC/**/;/**/DATA (', "ISO-10303-21;\nHEADER;\nENDSEC/**/;/**/DATA ('a',('b'));\n", ["DATA ('a',('b'));"]],
  ['END/**/SEC; is geen ENDSEC;', "ISO-10303-21;\nHEADER;\nEND/**/SEC;\nDATA ('a');\nDATA;", ['DATA;']],
  ['END SEC; is geen ENDSEC;', "ISO-10303-21;\nHEADER;\nX;END SEC; DATA ('a'); DATA;", ['DATA;']],
  ['ENDSENDSEC; is geen ENDSEC;', "ISO-10303-21;\nHEADER;\nENDSENDSEC; DATA ('a');", null],
  ['endsec ; in kleine letters', "ISO-10303-21;\nHEADER;\nendsec ;\n data\t('a',('b'));", ["data\t('a',('b'));"]],
  ['ENDSEC; X DATA ( telt niet', "ISO-10303-21;\nHEADER;\nENDSEC; X DATA ('a'); DATA;", ['DATA;']],
  ["ENDSEC;'x' DATA ( telt niet", "ISO-10303-21;\nHEADER;\nENDSEC;'x' DATA ('a'); DATA;", ['DATA;']],
  ['ENDSEC; / DATA ( telt niet', "ISO-10303-21;\nHEADER;\nENDSEC; / DATA ('a'); DATA;", ['DATA;']],
  // Ronde 3 (Sol): een losse regel `DATA` mag de echte sectiekop op de volgende regel niet verbergen.
  ['DATA, regeleinde, DATA;', "ISO-10303-21;\nFILE_NAME('a);\nDATA\nDATA;\n#9=IFCWALL($);\nENDSEC;\n", ['DATA;']],
  ['DATA, CRLF, ingesprongen DATA;', "ISO-10303-21;\r\nFILE_NAME('a);\r\n  DATA \r\n\t DATA;\r\n", ['DATA;']],
  ['DATA, twee regeleindes, DATA( (geen sectiekop, zoals main)', "ISO-10303-21;\nFILE_NAME('a);\nDATA\n\n DATA('a');\n", null],
  ['DATA, regeleinde, \\v DATA; (geen regelbegin)', "ISO-10303-21;\nFILE_NAME('a);\nDATA\n\vDATA;\n", null],
  ['DATA, regeleinde, \\v, regeleinde, DATA;', "ISO-10303-21;\nFILE_NAME('a);\nDATA\n\v\nDATA;\n", ['DATA;']],
  ['DATA, regeleinde, ENDSEC, regeleinde, DATA;', "ISO-10303-21;\nFILE_NAME('a);\nDATA\nENDSEC\nDATA;\n", ['DATA;']],
  ['DATA, U+2028, DATA;', "ISO-10303-21;\nFILE_NAME('a);\nDATA\n DATA;\n", ['DATA;']],
  // Ronde 5 (Sol en Terra): stuurtekens vallen weg vóór de lexicale regels, ook in de grenzen van commentaar en in `''`.
  ['regeleinde tussen / en * (Terra)', "ISO-10303-21;\nHEADER;\nENDSEC;/\n* DATA; ' */DATA('deel',('IFC4'));\n#1=IFCWALL($);\nENDSEC;\n", ["DATA('deel',('IFC4'));"]],
  ['regeleinde tussen * en / (Sol)', "ISO-10303-21;\nHEADER;\nENDSEC; /* a *\n/ DATA('deel 1',('IFC4'));\n", ["DATA('deel 1',('IFC4'));"]],
  ["regeleinde tussen de apostroffen van '' (Sol)", "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('it'\n's'),'3;1');\nENDSEC;DATA('a',('IFC4'));\n", ["DATA('a',('IFC4'));"]],
  ['U+007F midden in DATA (Sol)', "ISO-10303-21;\nHEADER;\nENDSEC;\nDA\x7fTA('a',('IFC4'));\n", ["DA\x7fTA('a',('IFC4'));"]],
  // Ronde 6 (Sol): `\S\'` is een teken in de string (§6.4.3.1), ook in de sectiekop; de string loopt door tot `''`.
  ["\\S\\' in de naam van de sectiekop (Sol)", "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA('deel \\S\\'',('IFC4'));\n#1=IFCWALL($);\n", ["DATA('deel \\S\\'',('IFC4'));"]],
  ["\\S\\' in de kop (Sol)", "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('a\\S\\'); DATA;'),'2;1');\nENDSEC;\nDATA;\n#1=IFCWALL($);\n", ['DATA;', 1]],
  // Ronde 5 (Sol): een ANCHOR- of REFERENCE-sectie vóór de eerste datasectie, met strings en URI's (tabel 3).
  ['ANCHOR met een string (Sol)', "ISO-10303-21;\nHEADER;\nENDSEC;\nANCHOR;\n<a>='tekst';\n<b>=#1{x:'y'};\nENDSEC;DATA('deel 1',('IFC4'));\n", ["DATA('deel 1',('IFC4'));"]],
  ['REFERENCE met een URI vol leestekens', "ISO-10303-21;\nHEADER;\nENDSEC;\nREFERENCE;\n#5=<http://x/a'b;c(>;\nENDSEC;DATA('d',('IFC4'));\n", ["DATA('d',('IFC4'));"]],
  // Ronde 5 (Sol): de kapotte naam met een komma of haakje na de losse apostrof. De grammatica breekt (een `;` binnen
  // de haakjes, of een woord na de `)` van FILE_NAME); dan de regel van main.
  ["'Van ', ENDSEC; DATA ( (Sol)", "ISO-10303-21;\nHEADER;\nFILE_NAME('Van ', ENDSEC; DATA (bouw).ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
  ["'Van ') ENDSEC; DATA ( (Sol)", "ISO-10303-21;\nHEADER;\nFILE_NAME('Van ') ENDSEC; DATA (bouw).ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
  ['FILE_NAME met te weinig parameters', "ISO-10303-21;\nHEADER;\nFILE_NAME('x');ENDSEC;DATA(('y'));\nENDSEC;\nDATA;\n", ['DATA;']],
  // Ronde 6 (Sol): een kapotte naam die de grammatica wel volgt (7 parameters), met daarna een valse kop `DATA (bouw)`.
  // De kop `DATA (bouw).ifc')` klopt niet (geen string als naam): de grammatica breekt, dan de regel van main.
  ["'Van ', $, $, $, $, $, $); ENDSEC; DATA ( (Sol)", "ISO-10303-21;\nHEADER;\nFILE_NAME('Van ', $, $, $, $, $, $); ENDSEC; DATA (bouw).ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
  // Ronde 6 (Sol): een regeleinde in de kapotte naam vóór `DATA (`. Main zocht alleen `DATA;` aan het begin van een regel.
  ["'Van 't Hof⏎ DATA (bouw).ifc' (Sol)", "ISO-10303-21;\nHEADER;\nFILE_NAME('Van 't Hof\n DATA (bouw).ifc');\nENDSEC;\nDATA;\n", ['DATA;']],
] as const satisfies ReadonlyArray<readonly [string, string, Kop]>) sameDataSection(label, enc.encode(text), kop);
sameDataSection('een BOM vooraan', new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode("'\nDATA;")]), ['DATA;']);
sameDataSection('ongeldige UTF-8 vóór DATA;', new Uint8Array([0x27, 0xe2, 0x80, 0x0a, 0xff, 0x0a, ...enc.encode('DATA;')]), ['DATA;']);
sameDataSection('E2 80 A8 midden in ongeldige UTF-8', new Uint8Array([0x27, 0xe2, 0xe2, 0x80, 0xa8, ...enc.encode('DATA;')]), ['DATA;']);

// ── 9. Verschiltest: willekeurige STEP-achtige bestanden, de scanner tegen `readIFC` ─────────────────────────────────
{
  let seed = 0x804_0004;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  // Geen losse `=`: een `=` staat alleen in een entiteit met een type erna. Zo ontstaat geen complexe instantie (die
  // telt bewust als model, zie 6).
  const TOKENS = ["'", "''", '/*', '*/', '/', '*', '(', ')', '((', '))', ';', ',', '$', ' ', '\t', '\n', '\r\n', '\r', 'x',
    'é', ' ', '😀', '#9=IFCWALL(', '#30=\nIFCWALL(', '#1=IFCTASK(', "#2=IFCTASK('a',$);", "#3=IFCWALL('w',$);",
    '#4 = ifcSite (', '#', '#7', 'IFCWALL', 'IFC/*c*/WALL', 'ENDSEC;', 'endsec;', 'ENDSE', 'DATA;', 'data;', '\nDATA;',
    "'Van 't Hof'", '.T.'];
  const tokens = (n: number) => Array.from({ length: n }, () => pick(TOKENS)).join('');
  const samples = 4000;
  let models = 0;
  let outside = 0;
  const outcomes = new Map<string, number>();
  const scans = new Map<string, number>();
  for (let k = 0; k < samples; k++) {
    // De helft met een kop die de grammatica volgt (geen losse tokens, FILE_NAME met 7 parameters).
    const valid = random() < 0.5;
    const text = 'ISO-10303-21;\nHEADER;\n' + (valid ? '' : tokens(Math.floor(random() * 4)))
      + (valid ? pick(["FILE_NAME('a.ifc','',(''),(''),'','','');\n", '']) : pick(["FILE_NAME('a.ifc');\n", "FILE_NAME('Van 't Hof.ifc');\n", '']))
      + 'ENDSEC;\n' + (valid ? pick(['DATA;\n', '  data;', 'DATA;', '\nDATA;']) + pick(['#1=IFCTASK(', '#9=IFCWALL(', '#2 = IFCTASK', ''])
        : pick(['DATA;\n', '  data;', '', 'DATA;', '\nDATA;']))
      + tokens(1 + Math.floor(random() * 40)) + pick(['ENDSEC;\n', '']) + 'END-ISO-10303-21;\n';
    const bytes = random() < 0.1 ? new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode(text)]) : enc.encode(text);
    const outcome = readOutcome(bytes);
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    if (outcome === 'fout buiten de lezer') outside++;
    const want = wantOf(bytes);
    scans.set(want, (scans.get(want) ?? 0) + 1);
    if (want === 'model') models++;
    const label = `verschiltest ${k}: ${JSON.stringify(text).slice(0, 160)}`;
    eq(`${label} (één stuk)`, scanTargetBytes(bytes), want);
    for (const size of [1, 2, 3, 7]) eq(`${label} (stukken van ${size})`, inChunks(bytes, size), want);
    sameDataSection(`verschiltest ${k}`, bytes);
  }
  eq('verschiltest: genoeg bestanden met model, zonder model en buiten de grammatica',
    ['model', 'no-model', 'unreadable'].map(k => (scans.get(k) ?? 0) > samples / 10), [true, true, true]);
  console.log(`..  verschiltest: ${samples} bestanden, ${models} met model; uitkomst van readIFC: `
    + [...outcomes].map(([o, n]) => `${o} ${n}`).join(', ') + (outside > 0 ? ` (${outside} fout na de modelpoort)` : '')
    + `; scanner: ${[...scans].map(([o, n]) => `${o} ${n}`).join(', ')}`);
}

// ── 11. Meer DATA-secties: het bestand van de sessie IFCX ──────────────────────────────────────────────────────────
{
  const twoData = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'), 'utf8');
  const bytes = enc.encode(twoData);
  eq('fix3-twee-data: readIFC weigert als model (de wand #99999 staat in de tweede DATA-sectie)', readOutcome(bytes), 'building-model');
  every('fix3-twee-data: de scanner zegt model', bytes, 'model');
  // De tabel van de kopvormen uit ISO 10303-21 (`DATA_KOP_VORMEN`, eis van Trias): elke vorm op de planning met de wand
  // in de tweede sectie (fix3), op de planning met een model in de enige sectie (eigen-plus-model) en op de planning
  // zonder model (showcase). De grens is een vaste verwachting uit de tabel, niet alleen gelijk aan de referentie.
  const eigenPlus = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), 'utf8');
  const showcase = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  for (const vorm of DATA_KOP_VORMEN) {
    for (const [file, text, outcome, scan] of [
      ['fix3', twoData, 'building-model', 'model'], ['eigen-plus-model', eigenPlus, 'building-model', 'model'],
      ['showcase', showcase, 'ok', 'no-model'],
    ] as const) {
      for (const alleen of [undefined, 'eerste'] as const) {
        if (alleen && file !== 'fix3') continue;
        const label = `kopvorm ${vorm.id}${alleen ? ' (alleen de eerste)' : ''} op ${file}`;
        const formed = metDataKop(text, vorm, alleen);
        const bytes2 = enc.encode(formed);
        eq(`${label}: de grens uit de tabel`, stepDataSectionBounds(formed), dataKopGrens(text, vorm));
        sameDataSection(label, bytes2);
        eq(`${label}: readIFC`, readOutcome(bytes2), outcome);
        every(`${label}: de scanner`, bytes2, scan);
      }
    }
  }
  // Terra (ronde 4): de kapotte naam samen met elke kopvorm uit de norm. Ronde 6 (besluit Trias): de grammatica breekt,
  // `readIFC` opent zoals main (alleen `DATA;`: het model geweigerd, of geen datasectie), en de scanner weigert het doel.
  const modelText = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc4.ifc'), 'utf8');
  for (const [name, text] of brokenHeaderDataFiles(modelText)) {
    const bytes2 = enc.encode(text);
    const outcome = readOutcome(bytes2);
    eq(`${name} op model-ifc4: readIFC weigert (model of geen datasectie)`, ['building-model', 'no-data-section'].includes(outcome), true);
    eq(`${name} op model-ifc4: buiten de grammatica`, stepDataSectionBounds(text)?.grammar ?? false, false);
    sameDataSection(`${name} op model-ifc4`, bytes2);
    every(`${name} op model-ifc4: de scanner`, bytes2, 'unreadable');
  }
  // Terra: de wand in een eerste sectie `DATA (…)`, daarna een sectie `DATA(…)` zonder wand.
  const terraSpace = enc.encode(HEAD.replace(/DATA;\n$/, "DATA ('deel 1',('IFC4X3_ADD2'));\n") + "#9=IFCWALL('x',$);\n"
    + "ENDSEC;\nDATA('deel 2',('IFC4X3_ADD2'));\n#1=IFCTASK('1',$);\n" + TAIL);
  eq('Terra: wand in DATA (…), daarna DATA(…): readIFC weigert als model', readOutcome(terraSpace), 'building-model');
  every('Terra: wand in DATA (…), daarna DATA(…): de scanner zegt model', terraSpace, 'model');
  // Sol en Terra (review van #870): parameters bij beide sectiekoppen.
  const param = enc.encode(paramDataFile(twoData));
  eq('fix3 met DATA(…) bij beide secties: readIFC weigert als model', readOutcome(param), 'building-model');
  every('fix3 met DATA(…) bij beide secties: de scanner zegt model', param, 'model');
  // Alleen een sectiekop met parameters, met de wand in die enige sectie; en de wand vóór een later `DATA;`.
  const onlyText = HEAD.replace(/DATA;\n$/, "DATA('enig',('IFC4X3_ADD2'));\n") + "#9=IFCWALL('x',$);\n" + TAIL;
  eq('alleen DATA(…): geen DATA; in het bestand', /DATA;/.test(onlyText), false);
  const only = enc.encode(onlyText);
  eq('alleen DATA(…): readIFC weigert als model', readOutcome(only), 'building-model');
  every('alleen DATA(…): de scanner zegt model', only, 'model');
  const before = enc.encode(onlyText.replace('ENDSEC;\nEND-ISO', "ENDSEC;\nDATA;\n#1=IFCTASK('1',$);\nENDSEC;\nEND-ISO"));
  eq('DATA(…) met de wand, daarna DATA;: readIFC weigert als model', readOutcome(before), 'building-model');
  every('DATA(…) met de wand, daarna DATA;: de scanner zegt model', before, 'model');
}

// ── 10. De pariteitstabel ──────────────────────────────────────────────────────────────────────────────────────────
{
  const table = new Map<string, number>();
  for (const c of parity) {
    const scan = scanTargetBytes(c.bytes);
    const outcome = readOutcome(c.bytes);
    const key = `${scan} | ${outcome}${c.deviation ? ` | besloten: ${c.deviation}` : ''}`;
    table.set(key, (table.get(key) ?? 0) + 1);
    if (c.deviation) {
      eq(`pariteit, besloten afwijking (${c.deviation}): ${c.label}`, [scan, outcome === 'building-model'], ['model', false]);
    } else if (scan !== 'not-ifc') {
      eq(`pariteit: ${c.label}: unreadable buiten de grammatica, anders model precies als readIFC weigert`, scan, wantOf(c.bytes));
    } else {
      eq(`pariteit: ${c.label}: not-ifc, en readIFC weigert het model niet`, outcome === 'building-model', false);
    }
  }
  console.log(`..  pariteitstabel (${parity.length} bestanden; scanner | readIFC):`);
  for (const [key, n] of [...table].sort()) console.log(`      ${String(n).padStart(4)}  ${key}`);
  console.log(`..  DATA;: ${dataSectionCases} invoeren, de gedeelde regel gelijk aan de oude (tekst en bytes)`);
}

if (diffs.length > 0) {
  console.log(`XX  ifc-target-model-scan: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-target-model-scan: alle checks groen (${checks})`);
process.exit(0);
