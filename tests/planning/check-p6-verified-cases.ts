import { execFileSync } from 'node:child_process';
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
  provenance: { source: string; scope: string; warning: string };
  cases: { id: string; activities: P6Row[] }[];
}

const dataPath = join(HERE, 'cases-p6-verified.json');
const parsed = JSON.parse(readFileSync(dataPath, 'utf-8')) as P6CasesFile;

// Breuken die dit vangt: engine-uitvoer of PASS-oordelen overnemen, de tijd weggooien, of een van
// de 13 daadwerkelijk P6-vergelijkbare cases stil verliezen.
eq('1 precies 13 P6-vergelijkbare cases', parsed.cases.length, 13);
eq('1a precies 27 vastgelegde activiteiten',
  parsed.cases.reduce((sum, item) => sum + item.activities.length, 0), 27);
truthy('1b herkomst noemt P6 23.12 en capturedatum',
  parsed.provenance.source.includes('P6 23.12') && parsed.provenance.source.includes('2026-08-11'));
truthy('1c herkomst begrenst de meetlat tot activity_code + *_p6',
  parsed.provenance.scope.includes('activity_code') && parsed.provenance.scope.includes('*_p6'));
truthy('1d waarschuwing benoemt tijdverlies, finishnormalisatie en nagefitte bronengine',
  parsed.provenance.warning.includes('tijd')
    && parsed.provenance.warning.includes('exclusief/inclusief')
    && parsed.provenance.warning.includes('nagefit'));

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
