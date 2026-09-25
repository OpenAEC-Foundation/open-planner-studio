import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const diffs: string[] = [];
let checks = 0;

function truthy(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
}

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

interface P6Row extends Record<string, string> {
  activity_code: string;
  ES_p6: string;
  EF_p6: string;
  LS_p6: string;
  LF_p6: string;
  TF_p6: string;
  FF_p6: string;
}
interface P6CasesFile {
  provenance: {
    repository: string;
    sourceCommit: string;
    capture: string;
    scope: string;
    warning: string;
  };
  cases: { id: string; sourceSha256: string; activities: P6Row[] }[];
}

const EXPECTED_CASES = [
  { id: '01-fs-chain', sourceSha256: '9d06cd88cfdce11a33d853ca5410088d9ab0a1a82aa384237147cd9a08ac70fb', activities: ['A', 'B', 'C'] },
  { id: '02-ss-with-lag', sourceSha256: '7719cb13f2bfd5297dc5302f9f2ab672376d7b6e7cafcbfa5c52cbbf64c45cae', activities: ['A', 'B'] },
  { id: '03-ff-with-lag', sourceSha256: 'bb8f76a2bdb926bdd0e7177f28c94da117cd8c55b110882f84ae958ed028d2da', activities: ['A', 'B'] },
  { id: '04-sf-edge-case', sourceSha256: 'be04f8ccd8430726635b87654b2039d64fb70779f12562f260bdf3e72d3eb654', activities: ['A', 'B'] },
  { id: '05-negative-float', sourceSha256: '463f4ea2ee5e973340d82b26e2adbf0305b0815161f8b78dc074f381140d22b1', activities: ['A', 'B'] },
  { id: '06-multiple-calendars', sourceSha256: '8623f28be05dfcbee390746c5ece5aacfb5c1501edbee3e74ffee92ac1730432', activities: ['A', 'B'] },
  { id: '07-ontario-holidays', sourceSha256: '23ec9703eab963f8f1300ecdc7bfadd902668314d3008e172048a7adb5042026', activities: ['A'] },
  { id: '08-in-progress-retained-logic', sourceSha256: '67c9811d83cdeace67fe7b410aa59b8550ae30cee287d6ee2bda7cd4347e255d', activities: ['A', 'B'] },
  { id: '09-completed-successor', sourceSha256: '0307a19fb51a61f1ad7b6445cbd6f2a20618ee4408912bc2cd320aca6ed1416b', activities: ['A', 'B'] },
  { id: '10-out-of-sequence-progress', sourceSha256: '2f598578d4539a95ea80698ab2979fd28a3cb007d8fe09e679a1173f00f5c5f6', activities: ['A', 'B'] },
  { id: '11-mandatory-start-finish', sourceSha256: 'b4353c7fcdfff89ae1740cfa1e85a5c72d7c9493a53eea37a5cab246b828453b', activities: ['A', 'B'] },
  { id: '12-snet-fnlt', sourceSha256: '42480cf535150559b1ed5ed11d5e7604ee3c6ae1d666b9a555ab84b4936f0ee6', activities: ['A', 'B'] },
  { id: '13-alap', sourceSha256: '6ed931a167215ec05a8410c0751a02e429026b62410f0fed4f8768746f6a37bc', activities: ['A', 'B', 'C'] },
] as const;
const EXPECTED_FLOATS = [
  '01-fs-chain/A=0/0', '01-fs-chain/B=0/0', '01-fs-chain/C=0/0',
  '02-ss-with-lag/A=0/0', '02-ss-with-lag/B=1/1',
  '03-ff-with-lag/A=0/0', '03-ff-with-lag/B=0/0',
  '04-sf-edge-case/A=0/3', '04-sf-edge-case/B=2/2',
  '05-negative-float/A=-7/0', '05-negative-float/B=-7/0',
  '06-multiple-calendars/A=0/0', '06-multiple-calendars/B=1/1',
  '07-ontario-holidays/A=0/0',
  '08-in-progress-retained-logic/A=0/0', '08-in-progress-retained-logic/B=0/0',
  '09-completed-successor/A=0/0', '09-completed-successor/B=/',
  '10-out-of-sequence-progress/A=0/0', '10-out-of-sequence-progress/B=0/0',
  '11-mandatory-start-finish/A=0/5', '11-mandatory-start-finish/B=0/0',
  '12-snet-fnlt/A=0/0', '12-snet-fnlt/B=0/0',
  '13-alap/A=0/0', '13-alap/B=0/0', '13-alap/C=0/0',
] as const;
const EXPECTED_P6_CASES_SHA256 = '50a2eb1c8eada4ec0fe6dbeba93c53d78f7d26024bdc21640b03bd5b994127f3';

const dataPath = join(HERE, 'cases-p6-verified.json');
const parsed = JSON.parse(readFileSync(dataPath, 'utf-8')) as P6CasesFile;

// Breuken die dit vangt: engine-uitvoer of PASS-oordelen overnemen, de tijd weggooien, of een van
// de 13 daadwerkelijk P6-vergelijkbare cases stil verliezen.
eq('1 precies 13 P6-vergelijkbare cases', parsed.cases.length, 13);
eq('1a precies 27 vastgelegde activiteiten',
  parsed.cases.reduce((sum, item) => sum + item.activities.length, 0), 27);
eq('1b bronrepository is exact gepind', parsed.provenance.repository,
  'https://github.com/danafitkowski/cpp-cpm-engine.git');
eq('1c broncommit is exact gepind', parsed.provenance.sourceCommit,
  'c279a5c4ff204ba763a6f9726aa6383574b50475');
truthy('1d capture-attestatie noemt P6 23.12, datum en ontbrekend primair sheet',
  parsed.provenance.capture.includes('P6 23.12')
    && parsed.provenance.capture.includes('2026-08-11')
    && parsed.provenance.capture.includes('niet meegecommit'));
truthy('1c herkomst begrenst de meetlat tot activity_code + *_p6',
  parsed.provenance.scope.includes('activity_code') && parsed.provenance.scope.includes('*_p6'));
truthy('1d waarschuwing benoemt tijdverlies, finishnormalisatie en nagefitte bronengine',
  parsed.provenance.warning.includes('tijd')
    && parsed.provenance.warning.includes('exclusief/inclusief')
    && parsed.provenance.warning.includes('nagefit'));

eq('1e exacte case-, digest- en activiteitsets', parsed.cases.map(item => ({
  id: item.id,
  sourceSha256: item.sourceSha256,
  activities: item.activities.map(activity => activity.activity_code),
})), EXPECTED_CASES);
eq('1f TF/FF-pins blijven exact, inclusief de bewust lege completed-successor-cellen',
  parsed.cases.flatMap(item => item.activities.map(activity =>
    `${item.id}/${activity.activity_code}=${activity.TF_p6}/${activity.FF_p6}`)), EXPECTED_FLOATS);
eq('1g alle P6-waarheidscellen zijn corpusloos vastgepind; geen enginekolom kan insluipen',
  createHash('sha256').update(JSON.stringify(parsed.cases)).digest('hex'), EXPECTED_P6_CASES_SHA256);

const expectedKeys = ['activity_code', 'ES_p6', 'EF_p6', 'LS_p6', 'LF_p6', 'TF_p6', 'FF_p6'];
for (const item of parsed.cases) {
  for (const activity of item.activities) {
    eq(`${item.id}/${activity.activity_code}: uitsluitend identiteit en *_p6-kolommen`,
      Object.keys(activity), expectedKeys);
    for (const key of ['ES_p6', 'EF_p6', 'LS_p6', 'LF_p6'] as const) {
      const value = activity[key];
      truthy(`${item.id}/${activity.activity_code}/${key}: kloktijd onvertaald bewaard`,
        value === '' || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?: A)?$/.test(value));
    }
    for (const key of ['TF_p6', 'FF_p6'] as const) {
      const value = activity[key];
      truthy(`${item.id}/${activity.activity_code}/${key}: numeriek of expliciet leeg`,
        value === '' || /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value));
    }
  }
}

// Met de publieke bron gemount moet de generator byte-identiek reproduceren. Zonder bron blijft de
// gecommitte data volledig gevalideerd en wordt alleen deze herkomstpariteitscheck overgeslagen.
const sourceRoot = process.env.OPS_P6_COMPARISON;
if (sourceRoot) {
  const generatedPath = join(mkdtempSync(join(tmpdir(), 'ops-p6-verified-')), 'cases.json');
  execFileSync(process.execPath, [
    join(HERE, '../../scripts/generate-p6-verified-cases.mjs'),
    sourceRoot,
    generatedPath,
  ]);
  eq('2 generator reproduceert cases-p6-verified.json byte-identiek',
    readFileSync(generatedPath, 'utf-8'), readFileSync(dataPath, 'utf-8'));
} else {
  console.log('OK  p6-verified-cases: bron niet aanwezig (OPS_P6_COMPARISON) — generatorpariteit overgeslagen');
}

if (diffs.length === 0) {
  console.log(`OK  p6-verified-cases: ${checks} checks groen`);
} else {
  console.log(`XX  p6-verified-cases: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
