// POORT #804 FASE 0 (ontwerp "Gebouwmodel behouden in IFC en IFCX", v19, §4.1, §4.2 en §10).
//
// De scanner (`src/services/ifc/foreign/stepScanner.ts`) en de indeling (`classify.ts`) worden nog nergens in de app
// gebruikt. Deze check bewaakt wat fase 1 van ze nodig heeft:
//   1. Scanner op synthetische bytes: elk byte in precies één stuk, CRLF, commentaar (ook tussen `#id`, `=`, type en
//      `(`), tekst met `''`, `\X\`, `\X2\` en Latin-1-bytes, complexe instanties, dubbele GlobalIds, meer
//      DATA-secties, en de weigeringen van `classify-v9.py` (dezelfde reden).
//   2. De indeling leest alleen de velden van de index (`STEP_INDEX_FIELDS`, met een Proxy).
//   3. Het register komt uit de code: elke naam die een per-taak-pset schrijft, staat in zijn `readProps`; elke pset
//      en elk type in de writer-uitvoer staat in het register en in `WRITER_ENTITY_TYPES`.
//   4. De 100 %-P-poort: elk `public/examples/*.ifc` en `examples/*.ifc`, de echte writer-uitvoer in
//      `tests/planning/fixtures/` (ook de oude tags) en `writeIFC(readIFC(x))` met vaste klok voor elk van die bestanden:
//      alleen P, geen vreemde leden, geen vreemde herkomst. Uitzonderingen staan in `OWN_EXCEPTIONS`, met de reden.
//   5. Oude formaten: kale sleutels in `OPS_Assignments`, `IfcTask` met 12 argumenten, `'0.1'`.
//   6. Het corpus van vreemde bestanden (`tests/fixtures/ifc-foreign/`): de aantallen per klasse van
//      `classify-v9.py`, plus inhoudelijke regels (een model zonder planning is 100 % V, de owner history van een
//      ander is C, ...).
//   7. `selectPlanning` kiest dezelfde taken, resources, relaties, kalenders, werkplan en schema als de lezer: `readIFC`
//      op elk eigen bestand, en de bytes-route van fase 1a (`readIfcBytesDetailed`, de lezer volgt `selectPlanning`) op
//      elk bestand van het corpus, ook met een model. Zonder uitzondering: de uitzondering voor een leeg live-schema van
//      eigen herkomst (fix1, §4.2 stap 1) verviel met fase 1a. IFC2X3 met model blijft geweigerd (§4.11).
//   8. Met OPS_IFC_PYTHON=1 (de workflow `ifc-foreign.yml`): de klasse per `#id`, de vreemde leden en de vreemde
//      herkomst zijn gelijk aan `scripts/proef/classify-v9.py --json`, op elk bestand hierboven, op de uitvoer van
//      `writeIFC(readIFC(x))` en op de synthetische weigeringen. Zonder die variabele slaat de check dit over.
//
// Draait via run.sh (ook in de tijdzonematrix: `writeIFC` heeft datumlogica). Exit 0 = alles groen.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  COMPLEX_TYPE, STEP_INDEX_FIELDS, StepIndex, StepScanError, scanStep, type StepScanReason,
} from '@/services/ifc/foreign/stepScanner';
import {
  REGISTER_PSET_NAMES, classOf, classify, isOwnAssignmentKey, type ChunkClass, type Classification,
} from '@/services/ifc/foreign/classify';
import { scanForeign, foreignScanFrom } from '@/services/ifc/foreign/foreignScan';
import { readIFC } from '@/services/ifc/ifcReader';
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { WRITER_ENTITY_TYPES, writeIFC } from '@/services/ifc/ifcWriter';
import { PER_TASK_PSETS, PSET } from '@/services/ifc/ifcPsets';
import type { ImportResult } from '@/services/importTypes';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const WITH_PYTHON = process.env.OPS_IFC_PYTHON === '1';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`, JSON.stringify(got) === JSON.stringify(want));
}

const enc = new TextEncoder();
const rel = (p: string) => relative(ROOT, p);
function listIfc(dir: string, recursive = false): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory() && recursive) out.push(...listIfc(p, true));
    else if (e.isFile() && e.name.endsWith('.ifc')) out.push(p);
  }
  return out;
}
function scanOrError(bytes: Uint8Array): StepIndex | StepScanError {
  try {
    return scanStep(bytes);
  } catch (e) {
    if (e instanceof StepScanError) return e;
    throw e;
  }
}
/** Aantallen en lijsten van een indeling, voor vergelijken en meldingen. */
function summary(index: StepIndex, c: Classification): number[] {
  return [index.entityCount, c.counts.P, c.counts.C, c.counts.A, c.counts.V, c.foreignMembers.length, c.foreignOrigin.length];
}
/** Typen van de stukken met klasse `k`, als `{TYPE: aantal}` (gesorteerd). */
function typesOf(index: StepIndex, c: Classification, k: ChunkClass): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < index.count; i++) if (classOf(c, i) === k) out[index.type(i)] = (out[index.type(i)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
function classById(index: StepIndex, c: Classification): Record<string, ChunkClass> {
  const out: Record<string, ChunkClass> = {};
  for (let i = 0; i < index.count; i++) {
    const k = classOf(c, i);
    if (k) out[index.id(i)] = k;
  }
  return out;
}

/** Vaste klok voor de writer: `new Date()` in de kop, de owner history en de werkplannen. */
const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
function withFixedClock<T>(fn: () => T): T {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(FIXED_NOW); else super(...(a as [number]));
    }
    static now(): number { return FIXED_NOW; }
  }
  globalThis.Date = FixedDate as unknown as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

// ── Python (alleen met OPS_IFC_PYTHON=1) ────────────────────────────────────────────────────────────────────────
interface PythonResult { refused: false; classes: Record<string, string>; members: number[]; origin: number[] }
interface PythonRefusal { refused: true; message: string }
const PY_SCRIPT = join(ROOT, 'scripts', 'proef', 'classify-v9.py');
let pythonFiles = 0;
function runPython(path: string): PythonResult | PythonRefusal {
  const r = spawnSync('python3', ['-I', PY_SCRIPT, path, '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw r.error;
  if (r.status !== 0) return { refused: true, message: (r.stderr || r.stdout).trim().split('\n').pop() ?? '' };
  const j = JSON.parse(r.stdout.split('\n').find(l => l.startsWith('{')) ?? '{}');
  return { refused: false, classes: j.classes, members: j.vreemde_leden, origin: j.vreemde_herkomst };
}
/** Vergelijk de TS-indeling van `bytes` met de voorproef. `path` moet dezelfde bytes bevatten. */
function compareWithPython(label: string, path: string, scanned: StepIndex | StepScanError): void {
  if (!WITH_PYTHON) return;
  pythonFiles++;
  const py = runPython(path);
  if (scanned instanceof StepScanError) {
    ok(`${label}: TS weigert (${scanned.reason}), Python niet`, py.refused);
    return;
  }
  if (py.refused) {
    ok(`${label}: Python weigert (${py.message}), TS niet`, false);
    return;
  }
  const c = classify(scanned);
  const ts = classById(scanned, c);
  const pyClasses = Object.fromEntries(Object.entries(py.classes).map(([k, v]) => [String(k), v]));
  const ids = new Set([...Object.keys(ts), ...Object.keys(pyClasses)]);
  const wrong = [...ids].filter(id => ts[id] !== pyClasses[id]).sort((a, b) => Number(a) - Number(b));
  eq(`${label}: klasse per #id gelijk aan classify-v9.py (eerste verschillen)`,
    wrong.slice(0, 5).map(id => `#${id} ts=${ts[id] ?? '-'} py=${pyClasses[id] ?? '-'}`), []);
  const ids2 = (xs: readonly number[]) => xs.map(i => Number(scanned.id(i))).sort((a, b) => a - b);
  eq(`${label}: vreemde leden gelijk aan classify-v9.py`, ids2(c.foreignMembers), [...py.members].sort((a, b) => a - b));
  eq(`${label}: vreemde herkomst gelijk aan classify-v9.py`, ids2(c.foreignOrigin), [...py.origin].sort((a, b) => a - b));
}
let tmpDir: string | undefined;
function tmpFile(name: string, bytes: Uint8Array | string): string {
  tmpDir ??= mkdtempSync(join(tmpdir(), 'ops-ifc-foreign-'));
  const p = join(tmpDir, name.replace(/[^A-Za-z0-9._-]/g, '_'));
  writeFileSync(p, bytes);
  return p;
}

// ── 1. Scanner op synthetische bytes ────────────────────────────────────────────────────────────────────────────
const KOP = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n"
  + "FILE_NAME('t.ifc','2026-01-01T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\n";
function stepFile(data: string, kop = KOP): string {
  return `${kop}DATA;\n${data}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
function bytesOf(s: string): Uint8Array { return enc.encode(s); }
/** Elk byte in precies één stuk, in bronvolgorde; de soorten in de vaste volgorde. */
function coverage(label: string, index: StepIndex, n: number): void {
  let at = 0;
  let gaps = 0;
  for (let i = 0; i < index.count; i++) {
    if (index.start(i) !== at) gaps++;
    at = index.end(i);
  }
  ok(`${label}: elk byte in precies één stuk (${gaps} gaten, einde ${at} van ${n})`, gaps === 0 && at === n);
  ok(`${label}: eerste stuk is de kop, laatste de staart`, index.kind(0) === 'kop' && index.kind(index.count - 1) === 'staart');
}
const synthetic: { label: string; text: string | Uint8Array }[] = [];
function scanSynthetic(label: string, text: string | Uint8Array): StepIndex | StepScanError {
  synthetic.push({ label, text });
  return scanOrError(typeof text === 'string' ? bytesOf(text) : text);
}

{
  // Basis: drie entiteiten, verwijzingen, tekst met `''` en een `#` en `);` in tekst.
  const text = stepFile([
    "#1=IFCPERSON($,'O''Brien #5 );',$,$,$,$,$,$);",
    "#2=IFCORGANIZATION($,'Org',$,$,$);",
    '#3=IFCPERSONANDORGANIZATION(#1,#2,$);',
  ].join('\n'));
  const idx = scanSynthetic('basis', text);
  if (idx instanceof StepScanError) ok(`basis: onverwacht geweigerd (${idx.reason})`, false);
  else {
    coverage('basis', idx, bytesOf(text).length);
    eq('basis: soorten', Array.from({ length: idx.count }, (_, i) => idx.kind(i)), ['kop', 'data', 'entiteit', 'entiteit', 'entiteit', 'staart']);
    eq('basis: ids en typen', [2, 3, 4].map(i => `#${idx.id(i)} ${idx.type(i)}`), ['#1 IFCPERSON', '#2 IFCORGANIZATION', '#3 IFCPERSONANDORGANIZATION']);
    eq("basis: '#5' in tekst is geen verwijzing", idx.outEnd(2) - idx.outStart(2), 0);
    eq('basis: argumenten van #1 (tekst met `);` telt niet)', idx.argCount(2), 8);
    eq('basis: uitgaand #3', [idx.refAt(4, 0), idx.refAt(4, 1)].map(c => idx.id(c)), ['1', '2']);
    eq('basis: inkomend #1', Array.from({ length: idx.inEnd(2) - idx.inStart(2) }, (_, k) => idx.id(idx.inSource(idx.inStart(2) + k))), ['3']);
    eq('basis: regeleinde', idx.lineEnding, '\n');
    eq('basis: chunkOf', [idx.chunkOf('2'), idx.chunkOf('9'), idx.chunkOf('x')], [3, -1, -1]);
  }
}
{
  // CRLF en commentaar overal: vóór een entiteit, tussen #id en '=', tussen '=' en type, tussen type en '(',
  // binnen de argumenten (met `#9`, `;` en `'`), tussen ')' en ';', en in de kop.
  const lines = [
    "/* voor; 'x' #9 */ #1 /*a*/ = /*b*/ IFCPERSON /*c*/ ($,'P',$,$,$,$,$,$) /*d*/ ;",
    "#2=IFCORGANIZATION($,/* #1 ; ' */'Org',$,$,$);",
    '#3=IFCPERSONANDORGANIZATION(#1,#2,$);',
  ];
  const text = stepFile(lines.join('\r\n'), KOP.replace('HEADER;', 'HEADER; /* kop */')).replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n');
  const idx = scanSynthetic('crlf-commentaar', text);
  if (idx instanceof StepScanError) ok(`crlf-commentaar: onverwacht geweigerd (${idx.reason})`, false);
  else {
    coverage('crlf-commentaar', idx, bytesOf(text).length);
    eq('crlf-commentaar: regeleinde', idx.lineEnding, '\r\n');
    eq('crlf-commentaar: entiteiten', idx.entityCount, 3);
    eq('crlf-commentaar: type ondanks commentaar', idx.type(2), 'IFCPERSON');
    eq('crlf-commentaar: commentaar is geen verwijzing', idx.outEnd(3) - idx.outStart(3), 0);
    ok('crlf-commentaar: het stuk van #1 begint bij het commentaar ervóór', new TextDecoder().decode(bytesOf(text).subarray(idx.start(2), idx.entityStart(2))).includes('/* voor;'));
  }
}
{
  // Tekstcodering: `\X\E9`, `\X2\00E9\X0\` en een rauw Latin-1-byte (0xE9). Het eerste en tweede worden 'é'; het
  // rauwe byte is geen geldige UTF-8 en wordt U+FFFD. De bytes van het stuk blijven gelijk.
  const head = bytesOf(stepFile([
    "#1=IFCPROPERTYSET('0000000000000000000001',$,'Caf\\X\\E9',$,(#2,#3));",
    "#2=IFCPROPERTYSINGLEVALUE('Caf\\X2\\00E9\\X0\\',$,$,$);",
    "#3=IFCPROPERTYSINGLEVALUE('CafLATIN',$,$,$);",
  ].join('\n')));
  const at = new TextDecoder().decode(head).indexOf('LATIN');
  const bytes = new Uint8Array(head.length - 4);
  bytes.set(head.subarray(0, at));
  bytes[at] = 0xe9;
  bytes.set(head.subarray(at + 5), at + 1);
  const idx = scanSynthetic('codering', bytes);
  if (idx instanceof StepScanError) ok(`codering: onverwacht geweigerd (${idx.reason})`, false);
  else {
    coverage('codering', idx, bytes.length);
    eq('codering: \\X\\E9', idx.name(2), 'Café');
    eq('codering: \\X2\\00E9\\X0\\', idx.name(3), 'Café');
    eq('codering: rauw Latin-1-byte', idx.name(4), 'Caf�');
    eq('codering: verwijzingen ondanks Latin-1', [idx.refAt(2, 4)].map(c => idx.id(c)), ['2']);
    ok('codering: het stuk met het rauwe byte is byte-gelijk', bytes.subarray(idx.start(4), idx.end(4)).includes(0xe9));
  }
}
{
  // Complexe instantie: type `(COMPLEX)`, argumenten tellen door over de componenten.
  const text = stepFile([
    "#1=IFCPERSON($,'P',$,$,$,$,$,$);",
    '#2=(IFCA(#1,$)IFCB((#1,#1))IFCC(#1));',
  ].join('\n'));
  const idx = scanSynthetic('complex', text);
  if (idx instanceof StepScanError) ok(`complex: onverwacht geweigerd (${idx.reason})`, false);
  else {
    eq('complex: type', idx.type(3), COMPLEX_TYPE);
    eq('complex: argumentposities van de verwijzingen',
      Array.from({ length: idx.outEnd(3) - idx.outStart(3) }, (_, k) => idx.outArg(idx.outStart(3) + k)), [0, 2, 2, 3]);
  }
}
{
  // Dubbele GlobalIds: geen fout, beide taken blijven stukken.
  const text = stepFile([
    "#1=IFCTASK('2Q0rqWTxL0Hv$KnJ1R9n0Q',$,'A',$,$,$,$,$,$,$,$,$,$);",
    "#2=IFCTASK('2Q0rqWTxL0Hv$KnJ1R9n0Q',$,'B',$,$,$,$,$,$,$,$,$,$);",
  ].join('\n'));
  const idx = scanSynthetic('dubbele-globalid', text);
  if (idx instanceof StepScanError) ok(`dubbele-globalid: onverwacht geweigerd (${idx.reason})`, false);
  else eq('dubbele-globalid: beide taken, zelfde GlobalId', [idx.globalId(2), idx.globalId(3)], ['2Q0rqWTxL0Hv$KnJ1R9n0Q', '2Q0rqWTxL0Hv$KnJ1R9n0Q']);
}
{
  // Twee DATA-secties: de `ENDSEC;` en de tweede `DATA;` vormen samen een data-stuk.
  const text = `${KOP}DATA;\n#1=IFCPERSON($,'P',$,$,$,$,$,$);\nENDSEC;\nDATA;\n#2=IFCORGANIZATION($,'O',$,$,$);\nENDSEC;\nEND-ISO-10303-21;\n`;
  const idx = scanSynthetic('twee-data', text);
  if (idx instanceof StepScanError) ok(`twee-data: onverwacht geweigerd (${idx.reason})`, false);
  else {
    coverage('twee-data', idx, bytesOf(text).length);
    eq('twee-data: soorten', Array.from({ length: idx.count }, (_, i) => idx.kind(i)), ['kop', 'data', 'entiteit', 'data', 'entiteit', 'staart']);
    eq("twee-data: DATA met parameters mag", scanOrError(bytesOf(text.replace('DATA;\n#1', "DATA(('x'),'y');\n#1"))) instanceof StepIndex, true);
  }
}
{
  // Knownbug 1007, grensproef: #2147483647 (2^31 − 1) is het grootste id dat de scanner aanneemt; een verwijzing naar
  // #2147483648 telt als verwijzing zonder doel.
  const text = stepFile([
    "#2147483647=IFCPERSON($,'P',$,$,$,$,$,$);",
    '#1=IFCPERSONANDORGANIZATION(#2147483647,#2147483648,$);',
  ].join('\n'));
  const idx = scanSynthetic('grens-id', text);
  if (idx instanceof StepScanError) ok(`grens-id: onverwacht geweigerd (${idx.reason})`, false);
  else {
    coverage('grens-id', idx, bytesOf(text).length);
    eq('grens-id: ids', [idx.id(2), idx.id(3)], ['2147483647', '1']);
    eq('grens-id: verwijzingen', [idx.id(idx.refAt(3, 0)), idx.refAt(3, 1), idx.danglingRefCount], ['2147483647', -1, 1]);
    eq('grens-id: chunkOf', idx.chunkOf('2147483647'), 2);
  }
}
{
  // Een verwijzing naar een `#id` dat niet bestaat.
  const idx = scanSynthetic('los-eind', stepFile('#1=IFCPERSONANDORGANIZATION(#7,#8,$);'));
  if (idx instanceof StepScanError) ok(`los-eind: onverwacht geweigerd (${idx.reason})`, false);
  else eq('los-eind: verwijzingen zonder doel', [idx.danglingRefCount, idx.refAt(2, 0)], [2, -1]);
}
// Weigeringen: dezelfde invoer als de voorproef, met haar reden.
const ENT = "#1=IFCPERSON($,'P',$,$,$,$,$,$);";
const REFUSALS: { label: string; text: string; reason: StepScanReason }[] = [
  { label: 'leeg', text: '', reason: 'geen-kop' },
  { label: 'geen-step', text: 'hallo;', reason: 'geen-kop' },
  { label: 'geen-header', text: `ISO-10303-21;\nDATA;\n${ENT}\nENDSEC;\nEND-ISO-10303-21;\n`, reason: 'geen-kop' },
  { label: 'geen-einde', text: stepFile(ENT).replace('END-ISO-10303-21;\n', ''), reason: 'geen-einde' },
  { label: 'tekst-zonder-einde', text: stepFile("#1=IFCPERSON($,'P,$);"), reason: 'tekst-zonder-einde' },
  { label: 'commentaar-zonder-einde', text: `${stepFile(ENT)}/* open`, reason: 'commentaar-zonder-einde' },
  { label: 'statement-zonder-puntkomma', text: `${stepFile(ENT)}#9=IFCX()`, reason: 'statement-zonder-puntkomma' },
  { label: 'header-zonder-endsec', text: stepFile(ENT, KOP.replace('ENDSEC;\n', '')), reason: 'sectievolgorde' },
  { label: 'data-zonder-endsec', text: `${KOP}DATA;\n${ENT}\nEND-ISO-10303-21;\n`, reason: 'sectievolgorde' },
  { label: 'buiten-sectie', text: stepFile(ENT, `${KOP}${ENT}\n`), reason: 'sectievolgorde' },
  { label: 'entiteit-in-header', text: stepFile(ENT, KOP.replace('ENDSEC;', `${ENT}\nENDSEC;`)), reason: 'onbekend-statement' },
  { label: 'onzin-in-data', text: stepFile(`${ENT}\nONZIN;`), reason: 'onbekend-statement' },
  { label: 'kleine-letters', text: stepFile("#1=IfcPerson($,'P',$,$,$,$,$,$);"), reason: 'onbekend-statement' },
  { label: 'dubbel-id', text: stepFile(`${ENT}\n${ENT}`), reason: 'dubbel-id' },
  { label: 'geen-entiteiten', text: `${KOP}DATA;\nENDSEC;\nEND-ISO-10303-21;\n`, reason: 'geen-entiteiten' },
  // Knownbug 1007: een `#id` boven 2^31 − 1 krijgt een eigen reden; een misvormd statement met zo'n id blijft
  // `onbekend-statement` (eerst de vorm, dan het id, net als classify-v9.py).
  { label: 'id-te-groot', text: stepFile("#2147483648=IFCPERSON($,'P',$,$,$,$,$,$);"), reason: 'id-te-groot' },
  { label: 'id-te-groot-na-goed', text: stepFile(`${ENT}\n#99999999999999999999=IFCORGANIZATION($,'O',$,$,$);`), reason: 'id-te-groot' },
  { label: 'id-te-groot-misvormd', text: stepFile("#2147483648=IfcPerson($,'P',$,$,$,$,$,$);"), reason: 'onbekend-statement' },
];
for (const r of REFUSALS) {
  const got = scanSynthetic(`weigering ${r.label}`, r.text);
  eq(`weigering ${r.label}: reden`, got instanceof StepScanError ? got.reason : 'geaccepteerd', r.reason);
}

// Brede relaties (review van #863, Sol en Terra): `push(...lijst)` liep vast bij 130.000–150.000 leden op de grens van
// de call stack. Een live-schema en een baseline met elk één relatie naar 150.000 taken, en één ouder met 149.999
// kinderen: de indeling moet zonder fout eindigen en alle taken als planning houden.
{
  const N = 150_000;
  const first = 10;
  const ids: string[] = [];
  const lines: string[] = [
    "#1=IFCWORKPLAN('wp',$,'Plan',$,$,$,'2026-01-01T00:00:00',$,$,$,$,'2026-01-01T00:00:00',$,.PLANNED.);",
    "#2=IFCWORKSCHEDULE('live',$,'Live',$,$,$,'2026-01-01T00:00:00',$,$,$,$,'2026-01-01T00:00:00',$,.PLANNED.);",
    "#3=IFCWORKSCHEDULE('base',$,'Base',$,$,$,'2026-01-01T00:00:00',$,$,$,$,'2026-01-01T00:00:00',$,.BASELINE.);",
    '#4=IFCRELAGGREGATES(\'agg\',$,$,$,#1,(#2,#3));',
  ];
  for (let k = 0; k < N; k++) {
    lines.push(`#${first + k}=IFCTASK('t${k}',$,'T${k}',$,$,$,$,$,$,.F.,$,$,.NOTDEFINED.);`);
    ids.push(`#${first + k}`);
  }
  const all = ids.join(',');
  lines.push(`#${first + N}=IFCRELASSIGNSTOCONTROL('ctl',$,$,$,(${all}),$,#2);`);
  lines.push(`#${first + N + 1}=IFCRELNESTS('nb',$,$,$,#3,(${all}));`);
  lines.push(`#${first + N + 2}=IFCRELNESTS('nt',$,$,$,#${first},(${ids.slice(1).join(',')}));`);
  const wide = scanStep(bytesOf(stepFile(lines.join('\n'))));
  let cls: Classification | undefined;
  let fout = '';
  try { cls = classify(wide); } catch (e) { fout = String(e); }
  eq('brede relaties: de indeling eindigt zonder fout', fout, '');
  eq('brede relaties: alle 150.000 taken zijn planning', cls?.selection.tasks.length, N);
}

// ── 2. De indeling leest alleen de velden van de index ─────────────────────────────────────────────────────────
{
  const sample = scanStep(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'))));
  const touched = new Set<string>();
  const proxy = new Proxy(sample, {
    get(target, prop) {
      if (typeof prop === 'string') touched.add(prop);
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  const viaProxy = classify(proxy);
  eq('Proxy: de indeling leest geen veld buiten STEP_INDEX_FIELDS', [...touched].filter(p => !STEP_INDEX_FIELDS.has(p)), []);
  eq('Proxy: zelfde uitkomst via de Proxy', summary(sample, viaProxy), summary(sample, classify(sample)));
  const publicMembers = new Set([
    ...Object.getOwnPropertyNames(StepIndex.prototype).filter(p => p !== 'constructor'),
    ...Object.keys(sample),
  ]);
  eq('STEP_INDEX_FIELDS = de publieke velden en methoden van StepIndex',
    [...publicMembers].sort(), [...STEP_INDEX_FIELDS].sort());
}

// ── 3. Register ────────────────────────────────────────────────────────────────────────────────────────────────
eq('register: elke PSET-naam staat in het register', Object.values(PSET).filter(n => !REGISTER_PSET_NAMES.has(n)), []);
eq('register: geen naam in het register die niet in PSET of PER_TASK_PSETS staat',
  [...REGISTER_PSET_NAMES].filter(n => !Object.values(PSET).includes(n as never) && !PER_TASK_PSETS.some(d => d.name === n)), []);
ok('register: een GlobalId-sleutel en een #n-sleutel zijn eigen', isOwnAssignmentKey('2Q0rqWTxL0Hv$KnJ1R9n0Q') && isOwnAssignmentKey('2Q0rqWTxL0Hv$KnJ1R9n0Q#3'));
ok('register: VendorSecretNote is geen eigen sleutel', !isOwnAssignmentKey('VendorSecretNote'));

// ── 4–7. Bestanden ─────────────────────────────────────────────────────────────────────────────────────────────
interface Expected {
  reason: string;
  /** [entiteiten, P, C, A, V, vreemde leden, vreemde herkomst] */
  counts: number[];
  /** Verwachte typen per klasse buiten P. */
  types?: Partial<Record<ChunkClass, Record<string, number>>>;
}
const OLD_PROJECT_GAP: Expected['types'] = {
  C: { IFCAPPLICATION: 1, IFCORGANIZATION: 2, IFCOWNERHISTORY: 1, IFCPERSON: 1, IFCPERSONANDORGANIZATION: 1 },
  V: { IFCAXIS2PLACEMENT3D: 1, IFCCARTESIANPOINT: 1, IFCGEOMETRICREPRESENTATIONCONTEXT: 1, IFCPROJECT: 1, IFCSIUNIT: 2, IFCUNITASSIGNMENT: 1 },
};
/** Eigen bestanden die bewust niet 100 % P zijn. */
const OWN_EXCEPTIONS: Record<string, Expected> = {
  'tests/planning/fixtures/werkdag-einde-tussenwaarde.ifc': {
    reason: 'bewust hernoemde properties (GeenEinde, GeenMarkering): vier vreemde leden (§10)',
    counts: [124, 120, 0, 0, 4, 4, 0],
  },
  'tests/planning/fixtures/ifc-arity-oude-writer-merged.ifc': {
    reason: 'bevat een model (IfcSite, IfcWall); project en eenheden zijn gedeeld (C)',
    counts: [421, 407, 5, 0, 9, 0, 0],
  },
  // Writers vóór 87ebd4d46 schreven een IfcProject waar niets naar verwijst (geen OPS_ProjectSettings, geen
  // IfcRelDeclares/Aggregates). Dan is het project met eenheden en context V, en de owner history C, ook in Python.
  // Geen vreemde leden en geen vreemde herkomst. Spec v20 (§4.2, besluit wrakko 9 november 2026): zo'n bestand gaat als
  // een model zonder planning; de writer hangt de planning aan dit project, zonder tweede IfcProject.
  'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc': {
    reason: 'oude writer (12 argumenten, kale sleutels): IfcProject niet gekoppeld', counts: [231, 218, 6, 0, 7, 0, 0], types: OLD_PROJECT_GAP,
  },
  'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc': {
    reason: 'oude writer (12 argumenten): IfcProject niet gekoppeld', counts: [185, 172, 6, 0, 7, 0, 0], types: OLD_PROJECT_GAP,
  },
};
/** Het corpus van vreemde bestanden: de aantallen van `classify-v9.py` (ontwerp v20). */
const CORPUS: Record<string, number[]> = {
  'bonsai-4d.ifc': [168, 13, 15, 13, 127, 0, 11],
  'complexe-instanties.ifc': [80, 0, 0, 0, 80, 0, 0],
  'crlf-commentaar.ifc': [168, 13, 15, 13, 127, 0, 11],
  'dubbele-globalids.ifc': [168, 13, 15, 13, 127, 0, 11],
  'eigen-plus-model.ifc': [400, 310, 13, 0, 77, 0, 0],
  'latin1.ifc': [168, 13, 15, 13, 127, 0, 11],
  'model-ifc2x3.ifc': [86, 0, 0, 0, 86, 0, 0],
  'model-ifc4.ifc': [78, 0, 0, 0, 78, 0, 0],
  'model-ifc4x3.ifc': [78, 0, 0, 0, 78, 0, 0],
  'oud-eigen-0.1-plus-model.ifc': [536, 446, 13, 0, 77, 0, 0],
  'twee-werkplannen.ifc': [127, 15, 16, 6, 90, 0, 13],
  'council/fix1-leeg-live-bl.ifc': [330, 314, 6, 1, 9, 0, 0],
  'council/fix1-leeg-live.ifc': [322, 314, 6, 1, 1, 0, 0],
  'council/fix2-data-in-kop.ifc': [915, 915, 0, 0, 0, 0, 0],
  'council/fix2-vendor-ops.ifc': [915, 909, 6, 0, 0, 0, 369],
  'council/fix3-twee-data.ifc': [916, 915, 0, 0, 1, 0, 0],
  'council/meerregelig.ifc': [915, 915, 0, 0, 0, 0, 0],
  'council/proef-bonsai-achtig.ifc': [43, 15, 5, 5, 18, 0, 10],
  'council/r4-k1.ifc': [72, 65, 1, 1, 5, 0, 0],
  'council/r4-k1-na-opslaan.ifc': [73, 65, 1, 1, 6, 0, 0],
  'council/r4-k2.ifc': [69, 60, 6, 1, 2, 0, 0],
  'council/r4-k3.ifc': [67, 60, 6, 0, 1, 0, 0],
  'council/r5-eigen-plus-bonsai-baseline.ifc': [324, 316, 6, 1, 1, 0, 0],
  'council/r5-prop.ifc': [67, 66, 0, 0, 1, 1, 0],
  'council/r5sol-gedeelde-calendar-pset.ifc': [72, 54, 6, 2, 10, 0, 0],
  'council/r5sol-onbekende-property.ifc': [73, 65, 1, 1, 6, 1, 0],
  'council/r5sol-parallelle-relaties.ifc': [44, 16, 5, 5, 18, 0, 11],
  'council/r6opus-twee-werkplannen.ifc': [46, 15, 5, 5, 21, 0, 10],
  'council/r6opus-twee-werkplannen.na.ifc': [46, 15, 5, 5, 21, 0, 10],
  'council/r6sol-dynamisch-OPS_ActivityCodes.ifc': [69, 68, 0, 0, 1, 1, 0],
  'council/r6sol-dynamisch-OPS_Assignments.ifc': [69, 68, 0, 0, 1, 1, 0],
  'council/r6sol-herkomst-na-eerste-opslag.ifc': [45, 17, 5, 5, 18, 0, 9],
  'council/r6sol-losse-bonsai-toewijzing.ifc': [44, 16, 5, 5, 18, 0, 11],
  'council/r6sol-twee-werkplannen.ifc': [73, 60, 6, 1, 6, 0, 0],
  'council/r6sol-twee-werkplannen-na-volgorderegel.ifc': [73, 59, 6, 2, 6, 0, 0],
  'council/r7fable-eigen-oh-planning.ifc': [46, 15, 5, 5, 21, 0, 10],
  'council/r7sol-OPS_Timephased.ifc': [918, 918, 0, 0, 0, 0, 0],
  'council/r7sol-OPS_TimephasedWindow.ifc': [918, 918, 0, 0, 0, 0, 0],
  'council/r7sol-twee-werkplannen-bronplek.ifc': [73, 60, 6, 1, 6, 0, 0],
  'council/r7sol-vreemd-lid-bij-notitie.ifc': [919, 918, 0, 0, 1, 1, 0],
  'council/r7sol-vreemd-lid-bij-toewijzing.ifc': [919, 918, 0, 0, 1, 1, 0],
  'council/r8sol-lege-structuurmeta-met-templates.ifc': [1512, 1512, 0, 0, 0, 0, 0],
  'council/r8sol-zonder-lege-notitie-pset.ifc': [916, 915, 0, 0, 1, 0, 0],
};
/** Corpusbestanden die de bytes-route weigert, met de reden. */
const ROUTE_REFUSED: Record<string, string> = {
  'model-ifc2x3.ifc': 'IFC2X3 met een model: de huidige route met de modelweigering (§4.11)',
};

/** Eigen bestanden die de scanner bewust weigert (knownbug 1049: de gewone route opent ze dan, zoals main). */
const SCANNER_REFUSED: Record<string, string> = {
  // #870, ronde 8: de echte uitvoer van de writer van v2026.7.12 met `O'Hara Tower` (een kapotte kop).
  'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc': 'tekst-zonder-einde',
};

interface Scanned { bytes: Uint8Array; index: StepIndex; cls: Classification }
function scanPath(label: string, path: string): Scanned | undefined {
  const bytes = new Uint8Array(readFileSync(path));
  const got = scanOrError(bytes);
  compareWithPython(label, path, got);
  if (got instanceof StepScanError) {
    const expected = SCANNER_REFUSED[label];
    ok(`${label}: scanner weigert (${got.reason}: ${got.message})${expected ? ', zoals verwacht' : ''}`, expected === got.reason);
    return undefined;
  }
  if (SCANNER_REFUSED[label]) ok(`${label}: de scanner weigert dit bestand (${SCANNER_REFUSED[label]})`, false);
  coverage(label, got, bytes.length);
  return { bytes, index: got, cls: classify(got) };
}

/** 7. `selectPlanning` tegen `readIFC`: zelfde taken, resources, relaties, kalenders, werkplan en schema. */
let selectionCompared = 0;
function compareSelection(label: string, s: Scanned, read: ImportResult): void {
  selectionCompared++;
  const sel = s.cls.selection;
  const idx = s.index;
  const g = read.ifcGlobalIds ?? {};
  const guids = (prefix: string) => Object.entries(g).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v).sort();
  const own = (xs: readonly number[]) => xs.map(i => idx.globalId(i) ?? '').filter(x => x !== '').sort();
  const got = {
    taken: read.tasks.length, taakGuids: guids('task:'), resources: read.resources.length, resourceGuids: guids('res:'),
    relaties: read.sequences.length, relatieGuids: guids('seq:'), kalenders: 1 + (read.resourceCalendars?.length ?? 0),
    werkplan: g[`wp:${read.project.id}`] ?? '', schema: g[`ws:${read.project.id}`] ?? '',
  };
  const want = {
    taken: sel.tasks.length, taakGuids: own(sel.tasks), resources: sel.resources.length, resourceGuids: own(sel.resources),
    relaties: sel.sequences.length, relatieGuids: own(sel.sequences), kalenders: Math.max(1, sel.calendars.length),
    werkplan: sel.workPlan >= 0 ? idx.globalId(sel.workPlan) ?? '' : '',
    schema: sel.liveSchedules.length > 0 ? idx.globalId(sel.liveSchedules[0]) ?? '' : '',
  };
  for (const k of Object.keys(got) as (keyof typeof got)[]) {
    if (JSON.stringify(got[k]) !== JSON.stringify(want[k])) {
      const short = (v: unknown) => (Array.isArray(v) ? `${v.length} stuks` : v);
      ok(`${label}: selectPlanning ≠ readIFC voor ${k} (readIFC ${short(got[k])}, selectPlanning ${short(want[k])})`, false);
    } else ok(`${label}: ${k}`, true);
  }
}
function tryRead(text: string): ImportResult | undefined {
  try {
    return readIFC(text);
  } catch {
    return undefined;
  }
}

// 4. De 100 %-P-poort en 5. oude formaten.
const ownFiles = [
  ...listIfc(join(ROOT, 'public/examples')),
  ...listIfc(join(ROOT, 'examples')),
  ...listIfc(join(ROOT, 'tests/planning/fixtures'), true),
];
let ownCount = 0;
let ownFullP = 0;
let roundTrips = 0;
const exceptionsSeen = new Set<string>();
for (const path of ownFiles) {
  const label = rel(path);
  const s = scanPath(label, path);
  if (!s) continue;
  ownCount++;
  const counts = summary(s.index, s.cls);
  const exception = OWN_EXCEPTIONS[label];
  if (exception) {
    exceptionsSeen.add(label);
    eq(`${label}: uitzondering (${exception.reason})`, counts, exception.counts);
    for (const [k, types] of Object.entries(exception.types ?? {})) eq(`${label}: typen in ${k}`, typesOf(s.index, s.cls, k as ChunkClass), types);
  } else {
    const fullP = counts[1] === counts[0] && counts[5] === 0 && counts[6] === 0;
    if (fullP) ownFullP++;
    ok(`${label}: 100 % P zonder vreemde leden en herkomst (entiteiten, P, C, A, V, leden, herkomst = ${counts.join(', ')})`, fullP);
  }
  const text = new TextDecoder().decode(s.bytes);
  const read = tryRead(text);
  if (!read) {
    ok(`${label}: readIFC opent een eigen bestand`, label === 'tests/planning/fixtures/ifc-arity-oude-writer-merged.ifc');
    continue;
  }
  compareSelection(label, s, read);
  // writeIFC(readIFC(x)) met vaste klok: altijd 100 % P, ook voor de uitzonderingen hierboven.
  const out = withFixedClock(() => writeIFC(read));
  const outBytes = enc.encode(out);
  const outLabel = `writeIFC(readIFC(${label}))`;
  const outScan = scanOrError(outBytes);
  if (WITH_PYTHON) compareWithPython(outLabel, tmpFile(`uitvoer-${label}`, outBytes), outScan);
  if (outScan instanceof StepScanError) {
    ok(`${outLabel}: scanner weigert (${outScan.reason})`, false);
    continue;
  }
  roundTrips++;
  const outCls = classify(outScan);
  const outCounts = summary(outScan, outCls);
  ok(`${outLabel}: 100 % P (${outCounts.join(', ')})`, outCounts[1] === outCounts[0] && outCounts[5] === 0 && outCounts[6] === 0);
  // Het register dekt de uitvoer: elke pset van de writer staat erin, elk type in WRITER_ENTITY_TYPES.
  const unknownTypes = new Set<string>();
  const unknownPsets = new Set<string>();
  for (let i = 0; i < outScan.count; i++) {
    if (!outScan.isEntity(i)) continue;
    const t = outScan.type(i);
    if (!WRITER_ENTITY_TYPES.has(t)) unknownTypes.add(t);
    if (t === 'IFCPROPERTYSET' && !REGISTER_PSET_NAMES.has(outScan.name(i) ?? '')) unknownPsets.add(outScan.name(i) ?? '');
  }
  eq(`${outLabel}: typen buiten WRITER_ENTITY_TYPES`, [...unknownTypes], []);
  eq(`${outLabel}: psets buiten het register`, [...unknownPsets], []);
  const reread = tryRead(out);
  if (reread) compareSelection(outLabel, { bytes: outBytes, index: outScan, cls: outCls }, reread);
  // Per-taak-psets: elke naam die `write` schrijft, leest `apply` ook (readProps).
  for (const task of read.tasks) {
    for (const d of PER_TASK_PSETS) {
      for (const prop of d.write(task) ?? []) {
        if (!d.readProps.includes(prop.name)) ok(`${label}: ${d.name}.${prop.name} geschreven maar niet in readProps`, false);
      }
    }
  }
}
eq('uitzonderingen: elke uitzondering bestaat nog', Object.keys(OWN_EXCEPTIONS).filter(k => !exceptionsSeen.has(k)), []);
{
  // Oude formaten: controleer dat de fixtures echt het oude formaat hebben.
  const old = (name: string) => scanStep(new Uint8Array(readFileSync(join(ROOT, 'tests/planning/fixtures/oude-tags', name))));
  const taskArgs = (idx: StepIndex) => [...new Set(Array.from({ length: idx.count }, (_, i) => i).filter(i => idx.type(i) === 'IFCTASK').map(i => idx.argCount(i)))];
  const assignmentKeys = (idx: StepIndex) => {
    const keys: string[] = [];
    for (let i = 0; i < idx.count; i++) {
      if (idx.type(i) !== 'IFCPROPERTYSET' || idx.name(i) !== PSET.Assignments) continue;
      for (let k = idx.outStart(i); k < idx.outEnd(i); k++) if (idx.outArg(k) === 4) keys.push(idx.name(idx.outTarget(k)) ?? '');
    }
    return keys;
  };
  const appVersion = (idx: StepIndex) => {
    for (let i = 0; i < idx.count; i++) if (idx.type(i) === 'IFCAPPLICATION') return idx.application(i)?.version;
    return undefined;
  };
  const bare = old('main-df9eafc7d-woongebouw-nieuwbouw.ifc');
  const bareKeys = assignmentKeys(bare);
  ok('oud formaat df9eafc7d: kale GlobalId-sleutels in OPS_Assignments', bareKeys.length > 0 && bareKeys.every(k => /^[0-9A-Za-z_$]{22}$/.test(k)));
  eq('oud formaat df9eafc7d: IfcTask met 12 argumenten', taskArgs(bare), [12]);
  const v72 = old('v2026.7.2-woongebouw-nieuwbouw.ifc');
  eq('oud formaat v2026.7.2: IfcTask met 12 argumenten', taskArgs(v72), [12]);
  const v90 = old('v2026.9.0-10-villa-wassenaar.ifc');
  eq("oud formaat v2026.9.0: versie '0.1' (letterlijke tekst)", appVersion(v90), '0.1');
  ok('oud formaat v2026.9.0: #n-sleutels', assignmentKeys(v90).some(k => /#\d+$/.test(k)));
  eq('oud formaat v2026.9.0: IfcTask met 13 argumenten', taskArgs(v90), [13]);
}

// 6. Het corpus van vreemde bestanden.
const corpusDir = join(ROOT, 'tests/fixtures/ifc-foreign');
const corpusFiles = [...listIfc(corpusDir), ...listIfc(join(corpusDir, 'council'))];
eq('corpus: elk bestand heeft een verwachting', corpusFiles.map(p => relative(corpusDir, p)).filter(n => !CORPUS[n]), []);
eq('corpus: elke verwachting heeft een bestand', Object.keys(CORPUS).filter(n => !existsSync(join(corpusDir, n))), []);
const corpusScans = new Map<string, Scanned>();
let corpusRead = 0;
for (const path of corpusFiles) {
  const name = relative(corpusDir, path);
  const label = `corpus ${name}`;
  const s = scanPath(label, path);
  if (!s) continue;
  corpusScans.set(name, s);
  if (CORPUS[name]) eq(`${label}: aantallen (entiteiten, P, C, A, V, leden, herkomst)`, summary(s.index, s.cls), CORPUS[name]);
  if (tryRead(new TextDecoder().decode(s.bytes))) corpusRead++;
  // 7. De lezer van fase 1a (bytes-route, met de flag): dezelfde keuze als selectPlanning, zonder terugval.
  let route: Awaited<ReturnType<typeof readIfcBytesDetailed>> | Error;
  try {
    route = await readIfcBytesDetailed(s.bytes);
  } catch (e) {
    route = e instanceof Error ? e : new Error(String(e));
  }
  const refused = ROUTE_REFUSED[name];
  if (refused) {
    ok(`${label}: de bytes-route weigert (${refused})`, route instanceof Error && route.message.includes('building model'));
  } else if (route instanceof Error) {
    ok(`${label}: de bytes-route opent (${route.message.slice(0, 80)})`, false);
  } else {
    eq(`${label}: de bytes-route valt niet terug`, route.fallback ?? null, null);
    ok(`${label}: de bytes-route geeft een bron`, route.result.ifcSource !== undefined);
    compareSelection(`${label} (bytes-route)`, s, route.result);
  }
}
eq('corpus: elke weigering van de bytes-route bestaat nog', Object.keys(ROUTE_REFUSED).filter(n => !corpusScans.has(n)), []);
{
  const get = (name: string) => corpusScans.get(name);
  // Een model zonder planning: alles V, niets in D.
  for (const name of ['model-ifc2x3.ifc', 'model-ifc4.ifc', 'model-ifc4x3.ifc']) {
    const s = get(name);
    if (s) eq(`corpus ${name}: geen domeinobjecten`, [s.cls.selection.workPlan, s.cls.selection.tasks.length], [-1, 0]);
  }
  // Bonsai-achtig 4D-bestand van IfcOpenShell.
  const bonsai = get('bonsai-4d.ifc');
  if (bonsai) {
    const { index: idx, cls } = bonsai;
    eq('corpus bonsai-4d: C is alleen de owner history van IfcOpenShell en wat daaraan hangt', typesOf(idx, cls, 'C'),
      { IFCAPPLICATION: 1, IFCORGANIZATION: 1, IFCOWNERHISTORY: 11, IFCPERSON: 1, IFCPERSONANDORGANIZATION: 1 });
    // v20: alleen het eerste live-schema is D; de aggregatie werkplan→(schema 1, schema 2) is gemengd en de
    // IfcRelAssignsToControl van schema 2 heeft een vreemde relating, dus beide A.
    eq('corpus bonsai-4d: A (relaties van een ander naar de planning)', typesOf(idx, cls, 'A'), {
      IFCRELAGGREGATES: 1, IFCRELASSIGNSTOCONTROL: 2, IFCRELASSIGNSTOPROCESS: 2, IFCRELASSIGNSTOPRODUCT: 2, IFCRELDECLARES: 1,
      IFCRELDEFINESBYOBJECT: 4, IFCRELDEFINESBYPROPERTIES: 1,
    });
    ok('corpus bonsai-4d: elke wand is V', Array.from({ length: idx.count }, (_, i) => i).filter(i => idx.type(i) === 'IFCWALL').every(i => classOf(cls, i) === 'V'));
    const dr = Array.from({ length: idx.count }, (_, i) => i).filter(i => cls.selection.inD[i] || cls.inR[i]);
    eq('corpus bonsai-4d: alle D- en R-stukken hebben vreemde herkomst', cls.foreignOrigin.length, dr.length);
    eq('corpus bonsai-4d: twee live-schema\'s, geen eigen baselinekop', [cls.selection.liveSchedules.length, cls.selection.ownBaselines.length], [2, 0]);
    const [eerste, tweede] = cls.selection.liveSchedules;
    eq('corpus bonsai-4d: alleen het eerste live-schema is D, het tweede is V (spec v20)',
      [cls.selection.inD[eerste], cls.selection.inD[tweede], classOf(cls, tweede)], [1, 0, 'V']);
    // Dezelfde inhoud in een andere tekstvorm: dezelfde klasse per #id.
    for (const variant of ['crlf-commentaar.ifc', 'latin1.ifc', 'dubbele-globalids.ifc']) {
      const v = get(variant);
      if (v) eq(`corpus ${variant}: zelfde klasse per #id als bonsai-4d`, classById(v.index, v.cls), classById(idx, cls));
    }
  }
  const crlf = get('crlf-commentaar.ifc');
  if (crlf) eq('corpus crlf-commentaar: regeleinde', crlf.index.lineEnding, '\r\n');
  const dup = get('dubbele-globalids.ifc');
  if (dup) {
    const ids = new Map<string, number>();
    for (let i = 0; i < dup.index.count; i++) {
      const gid = dup.index.globalId(i);
      if (gid) ids.set(gid, (ids.get(gid) ?? 0) + 1);
    }
    ok('corpus dubbele-globalids: er komt een GlobalId twee keer voor', [...ids.values()].some(n => n > 1));
  }
  const complex = get('complexe-instanties.ifc');
  if (complex) ok('corpus complexe-instanties: complexe instanties zijn stukken', Array.from({ length: complex.index.count }, (_, i) => complex.index.type(i)).includes(COMPLEX_TYPE));
  // Eigen planning plus model: het model is V, de gedeelde context is C, geen A en geen vreemde herkomst.
  for (const name of ['eigen-plus-model.ifc', 'oud-eigen-0.1-plus-model.ifc']) {
    const s = get(name);
    if (!s) continue;
    eq(`corpus ${name}: C is de gedeelde context`, typesOf(s.index, s.cls, 'C'), {
      IFCAPPLICATION: 1, IFCAXIS2PLACEMENT3D: 1, IFCCARTESIANPOINT: 1, IFCGEOMETRICREPRESENTATIONCONTEXT: 1, IFCORGANIZATION: 2,
      IFCOWNERHISTORY: 1, IFCPERSON: 1, IFCPERSONANDORGANIZATION: 1, IFCPROJECT: 1, IFCSIUNIT: 2, IFCUNITASSIGNMENT: 1,
    });
    ok(`corpus ${name}: geen product in P of C`, Array.from({ length: s.index.count }, (_, i) => i)
      .filter(i => /^IFC(WALL|SLAB|SITE|BUILDING|BUILDINGSTOREY)/.test(s.index.type(i))).every(i => classOf(s.cls, i) === 'V'));
  }
  // Twee werkplannen: alleen het eerste is D.
  const twee = get('twee-werkplannen.ifc');
  if (twee) {
    const plans = Array.from({ length: twee.index.count }, (_, i) => i).filter(i => twee.index.type(i) === 'IFCWORKPLAN');
    eq('corpus twee-werkplannen: eerste werkplan P, tweede niet', plans.map(i => classOf(twee.cls, i) === 'P'), [true, false]);
  }
  // Vreemde leden in eigen psets (ook in OPS_Assignments, §4.2 v19): V, en de naam is de vreemde.
  for (const name of ['council/r6sol-dynamisch-OPS_Assignments.ifc', 'council/r7sol-vreemd-lid-bij-toewijzing.ifc', 'council/r7sol-vreemd-lid-bij-notitie.ifc']) {
    const s = get(name);
    if (s) eq(`corpus ${name}: het vreemde lid`, s.cls.foreignMembers.map(i => `${s.index.name(i)} ${classOf(s.cls, i)}`), ['VendorSecretNote V']);
  }
  // '/*vendor*/OPS' is tekst, geen commentaar: vreemde herkomst.
  const vendor = get('council/fix2-vendor-ops.ifc');
  if (vendor) ok('corpus fix2-vendor-ops: commentaar binnen tekst blijft tekst (vreemde herkomst)', vendor.cls.foreignOrigin.length > 0);
}
// 8. Synthetische invoer (ook de weigeringen) tegen de voorproef.
if (WITH_PYTHON) {
  for (const s of synthetic) {
    const bytes = typeof s.text === 'string' ? bytesOf(s.text) : s.text;
    compareWithPython(`synthetisch ${s.label}`, tmpFile(`synthetisch-${s.label}.ifc`, bytes), scanOrError(bytes));
  }
}
// 9. De ene gemeten oude kopvorm (v2026.2.0 t/m v2026.7.12) vóór de gedeelde indeling.
{
  const oldBytes = new Uint8Array(readFileSync(join(ROOT,
    'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc')));
  const oldText = new TextDecoder().decode(oldBytes);
  const body = oldText.slice(oldText.indexOf('\nDATA;\n') + '\nDATA;\n'.length);
  const prefix = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\n";
  const header = (name: string, author: string, company: string) => prefix
    + `FILE_NAME('${name}.ifc','2026-01-15T12:00:00',('${author}'),('${company}'),'Open Planner Studio 0.1','Open Planner Studio','');\n`
    + "FILE_SCHEMA(('IFC4X3'));\nENDSEC;\nDATA;\n";
  const scan = scanForeign(oldBytes);
  ok('oude kop: ongewijzigde repo-fixture wordt ingedeeld', scan.ok);
  if (scan.ok) {
    eq('oude kop: repo-fixture alleen P', [scan.counts.C, scan.counts.A, scan.counts.V], [0, 0, 0]);
    eq('oude kop: bronbytes onveranderd', Array.from(oldBytes), Array.from(enc.encode(oldText)));
  }
  const freeFields = [
    ["O'Hara", 'Aannemer', 'Bedrijf'], ['Naam', "D'Artagnan", 'Bedrijf'], ['Naam', 'Auteur', "Van 't Hof"],
    ["O'Hara", "D'Artagnan", "Van 't Hof"], ["O''Hara's", 'Auteur', 'Bedrijf'],
    ["'Naam", 'Auteur', 'Bedrijf'], ["Naam'", 'Auteur', 'Bedrijf'],
    ['Naam', "'Auteur", 'Bedrijf'], ['Naam', "Auteur'", 'Bedrijf'],
    ['Naam', 'Auteur', "'Bedrijf"], ['Naam', 'Auteur', "Bedrijf'"], ["Één O'Hara", 'Auteur', 'Bedrijf'],
  ];
  const wall = "#99001=IFCWALL('0abcdefghijkmnopqrstuv',$,'Wand',$,$,$,$,$,$);\n";
  const pset = "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n"
    + "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\n";
  for (const [n, a, c] of freeFields) {
    const h = header(n, a, c);
    const bytes = enc.encode(h + body);
    const before = bytes.slice();
    const result = scanForeign(bytes);
    ok(`oude kop ${n}/${a}/${c}: herkend`, result.ok);
    if (!result.ok) continue;
    eq(`oude kop ${n}/${a}/${c}: alleen P`, [result.counts.C, result.counts.A, result.counts.V], [0, 0, 0]);
    eq(`oude kop ${n}/${a}/${c}: bron nooit gemuteerd`, Array.from(bytes), Array.from(before));
    const masked = scanForeign(enc.encode(header('x'.repeat(enc.encode(n).length), 'x'.repeat(a.length), 'x'.repeat(c.length)) + body));
    ok('oude kop: veilige referentie scant streng', masked.ok);
    if (masked.ok) eq(`oude kop ${n}: alle posities blijven bronposities`, Array.from(result.chunkStarts), Array.from(masked.chunkStarts));
    for (let i = 0; i < result.chunkIds.length; i++) {
      const id = result.chunkIds[i];
      if (id >= 0) ok(`oude kop ${n}: #${id} staat op zijn echte bronpositie`,
        new TextDecoder().decode(bytes.subarray(result.chunkStarts[i], result.chunkStarts[i + 1])).includes(`#${id}=`));
    }
    for (const [label, extra] of [['wand', wall], ['pset', pset]]) {
      const foreign = scanForeign(enc.encode(h + body.replace('ENDSEC;', extra + 'ENDSEC;')));
      ok(`oude kop ${n}/${a}/${c} + ${label}: vreemd deel blijft zichtbaar`, foreign.ok
        && foreign.counts.C + foreign.counts.A + foreign.counts.V > 0);
    }
  }
  const badHeader = header("O'Hara", 'Auteur', 'Bedrijf');
  const headerMutations: Array<[string, (h: string) => string]> = [
    ['ISO', h => h.replace('ISO-10303-21;', 'ISO-10303-22;')],
    ['HEADER', h => h.replace('HEADER;', 'HEADER ;')],
    ['beschrijving', h => h.replace('SchedulingView', 'CoordinationView')],
    ['beschrijving-versie', h => h.replace("'2;1'", "'3;1'")],
    ['FILE_DESCRIPTION', h => h.replace('FILE_DESCRIPTION', 'FILE_DESCRIPTIOn')],
    ['FILE_NAME', h => h.replace('FILE_NAME', 'FILE_NAMe')],
    ['extensie', h => h.replace(".ifc','", ".ifcx','")],
    ['datumvorm', h => h.replace('T12:00:00', 'T12:00:00Z')],
    ['datumgeldigheid', h => h.replace('2026-01-15', '2026-02-30')],
    ['programmaversie', h => h.replace('Open Planner Studio 0.1', 'Open Planner Studio 0.2')],
    ['programmanaam', h => h.replace("'Open Planner Studio','');", "'Ander programma','');")],
    ['laatste veld', h => h.replace("'Open Planner Studio','');", "'Open Planner Studio','extern');")],
    ['extra veld', h => h.replace("'Open Planner Studio','');", "'Open Planner Studio','','extra');")],
    ['veld minder', h => h.replace("'Open Planner Studio','');", "'Open Planner Studio');")],
    ['extra auteurveld', h => h.replace("('Auteur')", "('Auteur'),'extra'")],
    ['extra kopregel', h => h.replace("FILE_SCHEMA", "FILE_POPULATION('extern');\nFILE_SCHEMA")],
    ['volgorde', h => h.replace(prefix, prefix.replace("HEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');", "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\nHEADER;"))],
    ['commentaar', h => h.replace('HEADER;', 'HEADER;/*extern*/')],
    ['schema', h => h.replace('IFC4X3', 'IFC4')],
    ['schema-regel', h => h.replace('FILE_SCHEMA', 'FILE_SCHEMa')],
    ['ENDSEC', h => h.replace('ENDSEC;', 'ENDSEC ;')],
    ['DATA', h => h.replace('DATA;', 'DATA ;')],
    ['CRLF', h => h.replace(/\n/g, '\r\n')],
    ['BOM', h => '\ufeff' + h],
  ];
  for (const [label, mutate] of headerMutations) {
    const rejected = scanForeign(enc.encode(mutate(badHeader) + body));
    ok(`oude kop vast deel ${label}: kapotte vreemde kop blijft geweigerd`, !rejected.ok);
    // Bij een goed leesbare kop blijft uitsluitend de gewone strenge uitkomst gelden.
    const good = enc.encode(mutate(header('Naam', 'Auteur', 'Bedrijf')) + body);
    const strict = scanOrError(good);
    const got = scanForeign(good);
    if (!(strict instanceof StepScanError)) eq(`oude kop ${label}: goede kop onveranderd`, got, foreignScanFrom(strict, classify(strict), good));
  }
  for (const name of ["O'Hara.ifc','2026-01-15T12:00:00',('dubbel", "O'Hara'),('dubbel", "O'Hara;FILE_POPULATION('x')"]) {
    ok(`oude kop dubbelzinnig ${name}: weigert`, !scanForeign(enc.encode(header(name, 'Auteur', 'Bedrijf') + body)).ok);
  }
  for (const badBody of [body.replace('IFCPERSON(', 'IFCPERSON(' + "'"), body.replace('END-ISO-10303-21;', ''),
    body + "#99003=IFCWALL('x');", body.replace('ENDSEC;', "#99004=IFCWALL('zonder einde\nENDSEC;")]) {
    ok('oude kop: kapotte DATA blijft streng geweigerd', !scanForeign(enc.encode(badHeader + badBody)).ok);
  }
  for (const path of [...ownFiles, ...corpusFiles]) {
    const bytes = new Uint8Array(readFileSync(path));
    const strict = scanOrError(bytes);
    if (strict instanceof StepScanError) continue;
    eq(`oude kop pariteit ${rel(path)}: leesbare scan bytegelijk`, scanForeign(bytes), foreignScanFrom(strict, classify(strict), bytes));
  }
}

if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });

const pythonNote = WITH_PYTHON ? `; ${pythonFiles} bestanden gelijk aan classify-v9.py` : '; zonder Python-vergelijking (OPS_IFC_PYTHON=1)';
if (diffs.length === 0) {
  console.log(`OK  ifc-foreign-classify: alle checks groen (${checks}; eigen ${ownFullP}/${ownCount - exceptionsSeen.size} 100 % P plus `
    + `${exceptionsSeen.size} uitzonderingen, ${roundTrips} keer writeIFC(readIFC(x)) 100 % P, corpus ${corpusScans.size} bestanden, `
    + `waarvan ${corpusRead} zonder model, selectPlanning = lezer op ${selectionCompared} bestanden (corpus via de bytes-route)${pythonNote})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-foreign-classify: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 80)) console.log(`   - ${d}`);
  if (diffs.length > 80) console.log(`   … en nog ${diffs.length - 80}`);
  process.exit(1);
}
